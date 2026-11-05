'use strict';
/**
 * NHẬP HẰNG NGÀY theo từng dự án – bảng nhập/sửa trực tiếp.
 * Quy tắc (cấu hình ở src/entities.js -> DAILY.rules):
 *   - Ngày: bắt buộc, dạng dd/mm/yyyy, không trước minDate, không sau hôm nay (nếu allowFutureDate = false)
 *   - Nội dung: bắt buộc            - Số lượng: bắt buộc, > 0, tối đa 3 chữ số lẻ
 *   - Đơn giá: bắt buộc, >= 0       - Thành tiền = Số lượng × Đơn giá (máy chủ tự tính, làm tròn đến đồng)
 * Quyền: mọi người đã đăng nhập thêm / sửa; chỉ Quản trị xóa.
 * Hai người sửa cùng 1 dòng: người lưu sau được báo "dòng vừa được người khác sửa" (không ghi đè âm thầm).
 */
const express = require('express');
const asyncRouter = require('../router');
const { ENTITIES, DAILY } = require('../entities');
const T = require('../text');
const { sendXlsx } = require('../xlsx');
const { fmtDate } = require('../views/layout');
const { dailyPage } = require('../views/daily');

const L = DAILY.labels;
const R = DAILY.rules;

/** Kiểm tra 1 dòng. Trả về { data, errors: { tên_ô: 'lỗi' } } */
function validateRow(body, project) {
  const errors = {};
  const str = (k) => String(body[k] ?? '').trim();

  let entry_date = T.parseDate(str('entry_date'));
  if (entry_date === null) errors.entry_date = `Chưa nhập ${L.entry_date}`;
  else if (Number.isNaN(entry_date)) errors.entry_date = 'Ngày không hợp lệ (dd/mm/yyyy)';
  else if (entry_date < R.minDate) errors.entry_date = `Ngày không được trước ${T.fmtDay(R.minDate)}`;
  else if (!R.allowFutureDate && entry_date > T.todayVN()) errors.entry_date = 'Không được nhập ngày sau hôm nay';
  if (errors.entry_date) entry_date = null;

  const content = str('content');
  if (!content) errors.content = `Chưa nhập ${L.content}`;
  else if (content.length > R.contentMax) errors.content = `Tối đa ${R.contentMax} ký tự`;

  const unit = str('unit');
  if (unit.length > R.unitMax) errors.unit = `Tối đa ${R.unitMax} ký tự`;
  const doc_no = str('doc_no');
  if (doc_no.length > R.docMax) errors.doc_no = `Tối đa ${R.docMax} ký tự`;
  const note = str('note');
  if (note.length > R.noteMax) errors.note = `Tối đa ${R.noteMax} ký tự`;

  const qty = T.parseQty(str('quantity'));
  if (qty === null) errors.quantity = `Chưa nhập ${L.quantity}`;
  else if (Number.isNaN(qty)) errors.quantity = 'Số không hợp lệ. Dùng dấu phẩy cho số lẻ, VD: 12,5';
  else if (qty <= 0) errors.quantity = 'Phải lớn hơn 0';
  else if (qty > T.QTY_MAX_MILLI) errors.quantity = 'Số quá lớn';

  const price = T.parseMoney(str('unit_price'));
  if (price === null) errors.unit_price = `Chưa nhập ${L.unit_price}`;
  else if (Number.isNaN(price)) errors.unit_price = 'Chỉ nhập số, VD: 185.000';
  else if (price < 0) errors.unit_price = 'Không được âm';
  else if (price > R.priceMax) errors.unit_price = 'Số quá lớn';

  let amount = null;
  if (!errors.quantity && !errors.unit_price) {
    amount = T.calcAmount(qty, price);
    if (amount > T.MONEY_MAX) errors.quantity = 'Thành tiền vượt giới hạn (1 triệu tỷ đồng)';
  }

  if (R.blockCompletedProject && project.status === 'Đã hoàn thành') {
    errors._row = 'Dự án đã hoàn thành, không nhập thêm được';
  }

  return {
    errors,
    data: {
      project_id: project.id, entry_date, doc_no: doc_no || null, content, unit: unit || null,
      quantity: Number.isNaN(qty) ? null : T.milliToDb(qty), unit_price: price, amount, note: note || null,
    },
  };
}

/** Dữ liệu 1 dòng gửi cho trình duyệt (đã định dạng sẵn) */
function rowOut(r) {
  const milli = T.qtyToMilli(r.quantity);
  return {
    id: r.id, version: r.version,
    entry_date: T.fmtDay(r.entry_date), doc_no: r.doc_no || '', content: r.content, unit: r.unit || '',
    quantity: T.fmtQty(milli), unit_price: T.fmtMoney(r.unit_price), amount: Number(r.amount),
    note: r.note || '', updated_by_name: r.updated_by_name || '', updated_at: fmtDate(r.updated_at),
  };
}

/** Khoảng ngày mặc định: tháng hiện tại */
function period(q) {
  const today = T.todayVN();
  const all = q.all === '1';
  const from = all ? '' : (T.parseDate(q.from) || `${today.slice(0, 8)}01`);
  const to = all ? '' : (T.parseDate(q.to) || '');
  return { from: Number.isNaN(from) ? '' : from, to: Number.isNaN(to) ? '' : to, all };
}

module.exports = function dailyRouter({ store, ctxOf, requireLogin }) {
  const r = asyncRouter();
  r.use(requireLogin);
  r.use('/api', express.json({ limit: '20kb' }));

  async function sortedProjects() {
    const list = await store.listRecords(DAILY.parent);
    return list.sort((a, b) => T.naturalCompare(a.code, b.code));
  }

  /* Trang nhập */
  r.get('/', async (req, res) => {
    const projects = await sortedProjects();
    const pid = Number(req.query.du_an);
    const project = projects.find((p) => p.id === pid) || null;
    const per = period(req.query);
    const rows = project ? (await store.listDaily(project.id, per)).map(rowOut) : [];
    const suggestions = project ? await store.dailySuggestions() : [];
    res.send(dailyPage(ctxOf(req), {
      projects, project, rows, per, today: T.fmtDay(T.todayVN()),
      suggestions: suggestions.map((s) => ({ c: s.content, u: s.unit || '', p: s.unit_price == null ? '' : T.fmtMoney(s.unit_price) })),
      canDelete: req.user.role === 'admin',
    }));
  });

  /* Lưu 1 dòng (thêm mới nếu chưa có id) */
  r.post('/api/luu', async (req, res) => {
    const b = req.body || {};
    const project = await store.getRecord(DAILY.parent, Number(b.project_id));
    if (!project) return res.status(400).json({ ok: false, errors: { _row: 'Dự án không còn tồn tại' } });
    const { data, errors } = validateRow(b, project);
    if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

    try {
      let row;
      if (b.id) {
        const cur = await store.getDaily(Number(b.id));
        if (!cur || cur.project_id !== project.id) return res.status(404).json({ ok: false, errors: { _row: 'Dòng này không còn tồn tại (có thể đã bị xóa). Hãy tải lại trang.' } });
        row = await store.updateDaily(cur.id, Number(b.version), data, req.user);
      } else {
        row = await store.createDaily(data, req.user);
      }
      res.json({ ok: true, row: rowOut(row) });
    } catch (e) {
      if (e.code === 'conflict') {
        return res.status(409).json({
          ok: false, current: e.current ? rowOut(e.current) : null,
          errors: { _row: `Dòng này vừa được ${e.current ? e.current.updated_by_name : 'người khác'} sửa. Đã hiện lại số liệu mới nhất – hãy kiểm tra và sửa lại nếu cần.` },
        });
      }
      if (e.code === 'not_found') return res.status(404).json({ ok: false, errors: { _row: 'Dòng này không còn tồn tại. Hãy tải lại trang.' } });
      if (e.code === 'ref_missing') return res.status(400).json({ ok: false, errors: { _row: 'Dự án không còn tồn tại' } });
      throw e;
    }
  });

  /* Xóa 1 dòng (chỉ Quản trị) */
  r.post('/api/xoa', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ ok: false, errors: { _row: 'Chỉ Quản trị được xóa' } });
    try {
      await store.deleteDaily(Number((req.body || {}).id));
      res.json({ ok: true });
    } catch (e) {
      if (e.code === 'not_found') return res.json({ ok: true }); // đã bị xóa trước đó
      throw e;
    }
  });

  /* Xuất Excel */
  r.get('/xuat-excel', async (req, res) => {
    const project = await store.getRecord(DAILY.parent, Number(req.query.du_an));
    if (!project) return res.redirect(DAILY.path);
    const per = period(req.query);
    const rows = await store.listDaily(project.id, per);
    const total = rows.reduce((s, x) => s + Number(x.amount), 0);
    const range = per.all ? 'Toàn bộ thời gian' : `Từ ${T.fmtDay(per.from) || '…'} đến ${T.fmtDay(per.to) || 'nay'}`;
    const stamp = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/\//g, '-');
    sendXlsx(res, `${DAILY.title}_${project.code}_${stamp}.xlsx`, {
      sheetName: project.code,
      title: `${DAILY.title.toUpperCase()} – ${project.code} – ${project.name}`,
      subtitle: `${range} · Xuất lúc ${fmtDate(new Date())} bởi ${req.user.full_name}`,
      columns: [
        { label: 'STT', type: 'number', width: 6 }, { label: L.entry_date, type: 'text', width: 12 },
        { label: L.doc_no, type: 'text', width: 12 }, { label: L.content, type: 'text', width: 36 },
        { label: L.unit, type: 'text', width: 8 }, { label: L.quantity, type: 'qty', width: 12 },
        { label: `${L.unit_price} (đ)`, type: 'money', width: 16 }, { label: `${L.amount} (đ)`, type: 'money', width: 18 },
        { label: L.note, type: 'text', width: 24 }, { label: 'Người cập nhật', type: 'text', width: 20 },
      ],
      rows: rows.map((x, i) => [i + 1, T.fmtDay(x.entry_date), x.doc_no, x.content, x.unit, Number(x.quantity),
        Number(x.unit_price), Number(x.amount), x.note, x.updated_by_name]),
      totals: [`Tổng (${rows.length} dòng)`, '', '', '', '', '', '', total, '', ''],
    });
  });

  return r;
};

module.exports.validateRow = validateRow;
module.exports.ENTITY = ENTITIES[DAILY.parent];
