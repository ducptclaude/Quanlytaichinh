'use strict';
/**
 * CẤU HÌNH CÁC DANH MỤC (Dự án, Doanh thu, Chi phí)
 * ------------------------------------------------
 * Muốn thêm / bớt / đổi tên ô: sửa ở đây. Kho dữ liệu tự THÊM cột mới khi khởi động
 * (không bao giờ xóa cột cũ -> dữ liệu cũ an toàn).
 *
 * Loại ô (type):
 *   text   – chữ (maxlength; suggest: true = gợi ý từ dữ liệu đã nhập)
 *   textarea – chữ nhiều dòng
 *   select – chọn trong danh sách (options: chuỗi, hoặc { value, label, group } để chia nhóm)
 *   money  – số tiền, đồng, số nguyên  date – ngày (dd/mm/yyyy)
 *   ref    – chọn 1 bản ghi của danh mục khác (ref: 'projects')
 * required: true   -> bắt buộc          list: true  -> hiện trong bảng danh sách
 * total: true      -> cộng tổng          computed: (dữ liệu) => giá trị  -> ô tự tính, không nhập
 * Ô "code" luôn có, bắt buộc, KHÔNG được trùng (không phân biệt hoa/thường).
 * autoCode: { prefix, pad } -> tự đề xuất số tiếp theo khi thêm mới (vẫn sửa được).
 */

const PROJECT_STATUS = ['Chuẩn bị thi công', 'Đang thi công', 'Đã hoàn thành'];

/* ---------- Khoản mục chi phí (3 nhóm) ----------
 * Mã khoản mục (value) được lưu trong kho dữ liệu: KHÔNG đổi mã đã dùng; đổi tên (label) thì thoải mái.
 */
const COST_GROUPS = [
  { key: 'TT', label: '1. Chi phí trực tiếp', short: 'CP trực tiếp' },
  { key: 'GT', label: '2. Chi phí gián tiếp', short: 'CP gián tiếp' },
  { key: 'TC', label: '3. Chi phí tài chính', short: 'CP tài chính' },
];
const COST_ITEMS = [
  { value: 'TT01', label: 'Vật tư chính', group: 'TT' },
  { value: 'TT02', label: 'Vật tư phụ', group: 'TT' },
  { value: 'TT03', label: 'Máy móc thiết bị', group: 'TT' },
  { value: 'TT04', label: 'Nhân công', group: 'TT' },
  { value: 'TT05', label: 'Thầu phụ', group: 'TT' },
  { value: 'GT01', label: 'Chi phí tiện ích phục vụ thi công', group: 'GT' },
  { value: 'GT02', label: 'Chi phí lương', group: 'GT' },
  { value: 'GT03', label: 'Chi phí thưởng', group: 'GT' },
  { value: 'GT04', label: 'Chi phí ngoại giao', group: 'GT' },
  { value: 'TC01', label: 'Chi phí tài chính', group: 'TC' },
  { value: 'TC02', label: 'Lãi vay ngân hàng (chỉ phần lãi)', group: 'TC',
    warn: 'Chỉ nhập phần LÃI vay. Tiền trả GỐC không phải chi phí – không nhập vào đây.' },
  { value: 'TC03', label: 'Đóng phạt chủ đầu tư', group: 'TC' },
].map((x) => ({ ...x, groupLabel: COST_GROUPS.find((g) => g.key === x.group).label }));

/** Ba ô tiền dùng chung cho Doanh thu và Chi phí (nhãn có thể đổi theo từng danh mục) */
const moneyVatFields = (L = {}) => [
  { name: 'amount', label: L.amount || 'Tiền chưa VAT (đ)', listLabel: L.amountList, type: 'money', required: true, positive: true, list: true, total: true },
  { name: 'vat_amount', label: L.vat || 'Tiền VAT (đ)', type: 'money', list: L.vatList !== false, total: true, blankAsZero: true,
    maxRatio: { of: 'amount', ratio: 0.1 }, hint: L.vatHint || 'Nhập tay theo hóa đơn. Để trống = 0.' },
  { name: 'total_amount', label: L.total || 'Tổng sau VAT (đ)', listLabel: L.totalList, type: 'money', list: true, total: true,
    computed: (d) => (d.amount == null ? null : d.amount + (d.vat_amount || 0)), sumOf: ['amount', 'vat_amount'],
    hint: L.totalHint || 'Tự tính = Chưa VAT + VAT' },
];
const MONEY_VAT_FIELDS = moneyVatFields();

/** Câu lệnh bổ sung dữ liệu cũ (chỉ điền vào ô đang TRỐNG, không ghi đè) */
const fillVat = (t) => [
  `UPDATE ${t} SET vat_amount = 0 WHERE vat_amount IS NULL`,
  `UPDATE ${t} SET total_amount = amount + vat_amount WHERE total_amount IS NULL AND amount IS NOT NULL`,
];

const ENTITIES = {
  projects: {
    table: 'projects',
    path: '/du-an',
    title: 'Dự án',
    single: 'dự án',
    codeLabel: 'Mã dự án',
    codePlaceholder: 'VD: DA-01',
    fields: [
      { name: 'name', label: 'Tên dự án', type: 'text', required: true, maxlength: 200, list: true },
      { name: 'investor', label: 'Chủ đầu tư', type: 'text', maxlength: 200, list: true, suggest: true },
      { name: 'location', label: 'Địa điểm', type: 'text', maxlength: 200 },
      { name: 'category', label: 'Nhóm', type: 'select', options: ['Dân dụng', 'Công nghiệp', 'Hạ tầng', 'Khác'], list: true },
      { name: 'contract_value', label: 'Giá trị hợp đồng (đ)', type: 'money', list: true },
      { name: 'start_date', label: 'Ngày khởi công', type: 'date' },
      { name: 'end_date', label: 'Ngày hoàn thành (dự kiến)', type: 'date' },
      { name: 'status', label: 'Trạng thái', type: 'select', options: PROJECT_STATUS, required: true, list: true, filter: true, default: 'Chuẩn bị thi công' },
      { name: 'note', label: 'Ghi chú', type: 'textarea', maxlength: 1000 },
    ],
  },

  revenues: {
    table: 'revenues',
    path: '/doanh-thu',
    title: 'Doanh thu',
    single: 'khoản doanh thu',
    codeLabel: 'Số chứng từ',
    codePlaceholder: 'VD: DT-0001',
    autoCode: { prefix: 'DT-', pad: 4 },
    fields: [
      { name: 'project_id', label: 'Dự án', type: 'ref', ref: 'projects', required: true, list: true, filter: true },
      { name: 'doc_date', label: 'Ngày', type: 'date', required: true, list: true },
      { name: 'invoice_no', label: 'Số hóa đơn', type: 'text', maxlength: 50, hint: 'Được trùng giữa các đơn vị.' },
      { name: 'content', label: 'Nội dung', type: 'text', required: true, maxlength: 300, list: true, suggest: true },
      { name: 'kind', label: 'Hình thức', type: 'select', options: ['Tạm ứng', 'Thanh toán theo khối lượng', 'Quyết toán', 'Khác'], list: true, filter: true },
      ...MONEY_VAT_FIELDS,
      { name: 'note', label: 'Ghi chú', type: 'textarea', maxlength: 1000 },
    ],
    migrate: fillVat('revenues'),
  },

  costs: {
    // 1 dòng = 1 hợp đồng với thầu phụ / nhà cung cấp / hộ kinh doanh (quyết định 06/11/2026).
    // Báo cáo cộng GIÁ TRỊ HỢP ĐỒNG (chưa VAT). Mã CP-0001 do hệ thống tự đánh, không hiện trên biểu mẫu.
    // Ô cũ "Số hóa đơn" (invoice_no) bỏ khỏi biểu mẫu nhưng cột vẫn GIỮ trong kho.
    table: 'costs',
    path: '/chi-phi',
    title: 'Chi phí',
    single: 'hợp đồng chi phí',
    codeLabel: 'Mã',
    codeAuto: true,
    autoCode: { prefix: 'CP-', pad: 4 },
    // Số hợp đồng không được trùng trong CÙNG 1 thầu phụ / nhà cung cấp (khác đơn vị thì được trùng)
    uniqueWith: { fields: ['supplier', 'contract_no'], when: 'contract_no',
      message: (d) => `Số hợp đồng "${d.contract_no}" đã có cho ${d.supplier ? `"${d.supplier}"` : 'đơn vị (không tên)'}` },
    fields: [
      { name: 'cost_item', label: 'Nhóm chi phí', type: 'select', options: COST_ITEMS, required: true, list: true, filter: true,
        groupFilter: { name: 'cost_group', label: 'Phân loại', groups: COST_GROUPS } },
      { name: 'project_id', label: 'Thuộc hợp đồng chủ đầu tư', listLabel: 'Dự án (HĐ CĐT)', type: 'ref', ref: 'projects', refDetail: true, required: true, list: true, filter: true },
      { name: 'contract_no', label: 'Số hợp đồng', type: 'text', maxlength: 50, list: true, hint: 'Không trùng trong cùng 1 thầu phụ / nhà cung cấp.' },
      { name: 'supplier', label: 'Thầu phụ / Nhà cung cấp / Hộ kinh doanh', listLabel: 'Thầu phụ / NCC', type: 'text', maxlength: 200, suggest: true, list: true },
      { name: 'content', label: 'Hạng mục thi công', listLabel: 'Hạng mục', type: 'text', required: true, maxlength: 300, list: true, suggest: true },
      { name: 'doc_date', label: 'Ngày ký', type: 'date', required: true, list: true },
      ...moneyVatFields({
        amount: 'Giá trị hợp đồng (đ)', amountList: 'Giá trị HĐ (đ)', vat: 'VAT (đ)', vatList: false,
        vatHint: 'Nhập tay. Không có VAT thì bỏ trống.',
        total: 'Giá trị sau VAT (đ)', totalList: 'Sau VAT (đ)', totalHint: 'Tạm tính = Giá trị hợp đồng + VAT (VAT trống = giá trị hợp đồng)',
      }),
      { name: 'note', label: 'Ghi chú', type: 'textarea', maxlength: 1000 },
    ],
    migrate: [
      // Phân loại cũ (ô "Loại chi phí") -> khoản mục mới; chỉ chuyển loại rõ nghĩa, chỉ điền ô đang trống.
      // "Chi phí chung", "Khác" để TRỐNG -> hiện "Chưa phân loại" để người dùng tự chọn lại.
      'ALTER TABLE costs ADD COLUMN IF NOT EXISTS cost_type TEXT',
      `UPDATE costs SET cost_item = CASE cost_type
          WHEN 'Vật tư' THEN 'TT01' WHEN 'Máy thi công' THEN 'TT03'
          WHEN 'Nhân công' THEN 'TT04' WHEN 'Thầu phụ' THEN 'TT05' END
        WHERE cost_item IS NULL AND cost_type IN ('Vật tư', 'Máy thi công', 'Nhân công', 'Thầu phụ')`,
      ...fillVat('costs'),
    ],
  },
};

/**
 * Bảng dữ liệu cũ của tab "Nhập hằng ngày" (ĐÃ BỎ tab từ V6).
 * Giữ nguyên bảng để không mất dữ liệu; chỉ dùng để chặn xóa dự án còn dữ liệu cũ.
 */
const LEGACY_REFS = [
  { table: 'daily_entries', field: 'project_id', parent: 'projects', single: 'dòng "Nhập hằng ngày" (dữ liệu cũ)' },
];

// Thứ tự tạo bảng (bảng được tham chiếu phải tạo trước)
const ORDER = ['projects', 'revenues', 'costs'];

const costGroupOf = (item) => (COST_ITEMS.find((x) => x.value === item) || {}).group || null;

module.exports = { ENTITIES, ORDER, PROJECT_STATUS, COST_GROUPS, COST_ITEMS, costGroupOf, LEGACY_REFS };
