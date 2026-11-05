'use strict';
/**
 * CẤU HÌNH CÁC DANH MỤC (Dự án, Doanh thu, Chi phí)
 * ------------------------------------------------
 * Muốn thêm / bớt / đổi tên ô: sửa ở đây. Kho dữ liệu tự THÊM cột mới khi khởi động
 * (không bao giờ xóa cột cũ -> dữ liệu cũ an toàn).
 *
 * Loại ô (type):
 *   text   – chữ (maxlength)          textarea – chữ nhiều dòng
 *   select – chọn trong danh sách (options)
 *   money  – số tiền, đồng, số nguyên  date – ngày
 *   ref    – chọn 1 bản ghi của danh mục khác (ref: 'projects')
 * required: true  -> bắt buộc
 * list: true      -> hiện trong bảng danh sách
 * Ô "code" (Mã) luôn có, bắt buộc, KHÔNG được trùng (không phân biệt hoa/thường).
 */

const PROJECT_STATUS = ['Chuẩn bị thi công', 'Đang thi công', 'Đã hoàn thành'];

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
      { name: 'investor', label: 'Chủ đầu tư', type: 'text', maxlength: 200, list: true },
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
    codePlaceholder: 'VD: DT-001',
    fields: [
      { name: 'project_id', label: 'Dự án', type: 'ref', ref: 'projects', required: true, list: true, filter: true },
      { name: 'doc_date', label: 'Ngày', type: 'date', required: true, list: true },
      { name: 'content', label: 'Nội dung', type: 'text', required: true, maxlength: 300, list: true },
      { name: 'kind', label: 'Hình thức', type: 'select', options: ['Tạm ứng', 'Thanh toán theo khối lượng', 'Quyết toán', 'Khác'], list: true, filter: true },
      { name: 'amount', label: 'Số tiền (đ)', type: 'money', required: true, positive: true, list: true, total: true },
      { name: 'note', label: 'Ghi chú', type: 'textarea', maxlength: 1000 },
    ],
  },

  costs: {
    table: 'costs',
    path: '/chi-phi',
    title: 'Chi phí',
    single: 'khoản chi phí',
    codeLabel: 'Số chứng từ',
    codePlaceholder: 'VD: CP-001',
    fields: [
      { name: 'project_id', label: 'Dự án', type: 'ref', ref: 'projects', required: true, list: true, filter: true },
      { name: 'doc_date', label: 'Ngày', type: 'date', required: true, list: true },
      { name: 'content', label: 'Nội dung', type: 'text', required: true, maxlength: 300, list: true },
      { name: 'cost_type', label: 'Loại chi phí', type: 'select', options: ['Vật tư', 'Nhân công', 'Máy thi công', 'Thầu phụ', 'Chi phí chung', 'Khác'], list: true, filter: true },
      { name: 'supplier', label: 'Nhà cung cấp / Thầu phụ', type: 'text', maxlength: 200 },
      { name: 'amount', label: 'Số tiền (đ)', type: 'money', required: true, positive: true, list: true, total: true },
      { name: 'note', label: 'Ghi chú', type: 'textarea', maxlength: 1000 },
    ],
  },
};

// Thứ tự tạo bảng (bảng được tham chiếu phải tạo trước)
const ORDER = ['projects', 'revenues', 'costs'];

module.exports = { ENTITIES, ORDER, PROJECT_STATUS };
