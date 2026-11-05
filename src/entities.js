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

/** Ba ô tiền dùng chung cho Doanh thu và Chi phí */
const MONEY_VAT_FIELDS = [
  { name: 'amount', label: 'Tiền chưa VAT (đ)', type: 'money', required: true, positive: true, list: true, total: true },
  { name: 'vat_amount', label: 'Tiền VAT (đ)', type: 'money', list: true, total: true, blankAsZero: true,
    maxRatio: { of: 'amount', ratio: 0.1 }, hint: 'Nhập tay theo hóa đơn. Để trống = 0.' },
  { name: 'total_amount', label: 'Tổng sau VAT (đ)', type: 'money', list: true, total: true,
    computed: (d) => (d.amount == null ? null : d.amount + (d.vat_amount || 0)), sumOf: ['amount', 'vat_amount'] },
];

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
    table: 'costs',
    path: '/chi-phi',
    title: 'Chi phí',
    single: 'khoản chi phí',
    codeLabel: 'Số phiếu chi',
    codePlaceholder: 'VD: CP-0001',
    autoCode: { prefix: 'CP-', pad: 4 },
    fields: [
      { name: 'project_id', label: 'Dự án', type: 'ref', ref: 'projects', required: true, list: true, filter: true },
      { name: 'doc_date', label: 'Ngày', type: 'date', required: true, list: true },
      { name: 'cost_item', label: 'Khoản mục chi phí', type: 'select', options: COST_ITEMS, required: true, list: true, filter: true,
        groupFilter: { name: 'cost_group', label: 'Nhóm chi phí', groups: COST_GROUPS } },
      { name: 'content', label: 'Nội dung', type: 'text', required: true, maxlength: 300, list: true, suggest: true },
      { name: 'supplier', label: 'Nhà cung cấp / Thầu phụ', type: 'text', maxlength: 200, suggest: true },
      { name: 'invoice_no', label: 'Số hóa đơn', type: 'text', maxlength: 50, hint: 'Được trùng giữa các nhà cung cấp.' },
      ...MONEY_VAT_FIELDS,
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
