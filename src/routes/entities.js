'use strict';
/**
 * Bộ xử lý chung cho mỗi danh mục (Dự án / Doanh thu / Chi phí):
 * danh sách + tìm kiếm không dấu + lọc + sắp xếp tự nhiên + phân trang + xuất Excel + thêm / sửa / xóa.
 * Quyền: mọi người đã đăng nhập xem / thêm / sửa; chỉ Quản trị được XÓA.
 */
const asyncRouter = require('../router');
const { ENTITIES } = require('../entities');
const T = require('../text');
const { sendXlsx } = require('../xlsx');
const views = require('../views/entities');
const { fmtDate } = require('../views/layout');

const PAGE_SIZE = 50;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,49}$/;

const OK_MSG = { created: 'Đã thêm mới.', updated: 'Đã lưu thay đổi.', deleted: 'Đã xóa.' };

/** Nạp dữ liệu tham chiếu (VD: danh sách dự án cho Doanh thu / Chi phí) */
async function loadRefs(store, key) {
  const refs = {};
  for (const f of ENTITIES[key].fields) {
    if (f.type === 'ref' && !refs[f.ref]) {
      const list = await store.listRecords(f.ref);
      list.sort((a, b) => T.naturalCompare(a.code, b.code));
      refs[f.ref] = { list, byId: new Map(list.map((r) => [r.id, r])) };
    }
  }
  return refs;
}

/** Giá trị hiển thị của 1 ô */
function display(f, v, refs) {
  if (v === null || v === undefined || v === '') return '';
  switch (f.type) {
    case 'money': return T.fmtMoney(v);
    case 'date': return T.fmtDay(v);
    case 'select': {
      const o = optionList(f).find((x) => x.value === String(v));
      return o ? o.label : String(v);
    }
    case 'ref': {
      const r = refs[f.ref] && refs[f.ref].byId.get(v);
      return r ? `${r.code} – ${r.name || ''}` : '(đã xóa)';
    }
    default: return String(v);
  }
}

/** Kiểm tra dữ liệu nhập; trả về { data, errors } */
function validate(e, body, refs, fixedCode) {
  const errors = [];
  const data = {};
  // Danh mục tự đánh mã (VD: Chi phí): không nhận mã từ người dùng
  const code = e.codeAuto ? String(fixedCode || '') : String(body.code || '').trim();
  if (!code) errors.push(`Chưa nhập ${e.codeLabel}`);
  else if (!CODE_RE.test(code)) errors.push(`${e.codeLabel}: tối đa 50 ký tự, chỉ gồm chữ không dấu, số và . _ / -`);
  data.code = code;

  for (const f of e.fields) {
    if (f.computed) continue; // ô tự tính: không nhận từ người dùng
    const raw = String(body[f.name] ?? '').trim();
    let v = raw === '' ? (f.blankAsZero ? 0 : null) : raw;
    if (v !== null) {
      switch (f.type) {
        case 'text': case 'textarea':
          if (f.maxlength && v.length > f.maxlength) errors.push(`${f.label}: tối đa ${f.maxlength} ký tự`);
          break;
        case 'select':
          if (!optionList(f).some((o) => o.value === v)) errors.push(`${f.label}: giá trị không hợp lệ`);
          break;
        case 'money':
          if (raw === '' && f.blankAsZero) break;
          v = T.parseMoney(raw);
          if (Number.isNaN(v)) errors.push(`${f.label}: chỉ nhập số (VD: 1.250.000)`);
          else if (v < 0) errors.push(`${f.label}: không được âm`);
          else if (f.positive && v === 0) errors.push(`${f.label}: phải lớn hơn 0`);
          else if (v > T.MONEY_MAX) errors.push(`${f.label}: số quá lớn`);
          break;
        case 'date':
          v = T.parseDate(raw);
          if (Number.isNaN(v)) errors.push(`${f.label}: ngày không hợp lệ`);
          break;
        case 'ref':
          v = Number(raw);
          if (!Number.isInteger(v) || !refs[f.ref].byId.has(v)) errors.push(`${f.label}: chưa chọn hoặc không còn tồn tại`);
          break;
        default:
      }
    }
    if (f.required && (v === null || v === undefined)) errors.push(`Chưa nhập ${f.label}`);
    data[f.name] = v;
  }
  // Ô tự tính (VD: Tổng sau VAT = Chưa VAT + VAT)
  for (const f of e.fields.filter((x) => x.computed)) {
    const ok = !errors.length;
    data[f.name] = ok ? f.computed(data) : null;
  }
  // Giới hạn tỷ lệ (VD: Tiền VAT không vượt 10% tiền chưa VAT)
  for (const f of e.fields.filter((x) => x.maxRatio)) {
    const base = data[f.maxRatio.of];
    const v = data[f.name];
    if (typeof base === 'number' && typeof v === 'number' && v > Math.ceil(base * f.maxRatio.ratio)) {
      errors.push(`${f.label}: không được vượt ${f.maxRatio.ratio * 100}% ${e.fields.find((x) => x.name === f.maxRatio.of).label.replace(' (đ)', '')} `
        + `(tối đa ${T.fmtMoney(Math.ceil(base * f.maxRatio.ratio))} đ)`);
    }
  }
  // Ngày kết thúc không trước ngày bắt đầu (Dự án)
  if (data.start_date && data.end_date && data.end_date < data.start_date) {
    errors.push('Ngày hoàn thành không được trước ngày khởi công');
  }
  return { data, errors };
}

/** Chuẩn hóa để so trùng: bỏ dấu, chữ thường, gộp khoảng trắng */
const sameKey = (v) => T.normalize(String(v ?? '')).replace(/\s+/g, ' ').trim();

/** Kiểm tra trùng theo nhóm ô (VD: Số hợp đồng trong cùng 1 nhà cung cấp); trả về câu báo lỗi hoặc '' */
function uniqueError(e, data, records, selfId) {
  const u = e.uniqueWith;
  if (!u || !sameKey(data[u.when])) return '';
  const key = (r) => u.fields.map((k) => sameKey(r[k])).join('\u0001');
  const mine = key(data);
  return records.some((r) => r.id !== selfId && key(r) === mine) ? u.message(data) : '';
}

/** Lọc + tìm + sắp xếp theo tham số trên đường dẫn */
function query(e, records, refs, q) {
  const filters = e.fields.filter((f) => f.filter);
  let rows = records.map((r) => {
    const shown = Object.fromEntries(e.fields.map((f) => [f.name, display(f, r[f.name], refs)]));
    return { r, shown, hay: [r.code, ...Object.values(shown)].join(' ') };
  });
  const search = String(q.q || '').trim().slice(0, 100);
  if (search) rows = rows.filter((x) => T.matches(x.hay, search));
  for (const f of filters) {
    const v = q[`f_${f.name}`];
    if (v === '__none') rows = rows.filter((x) => x.r[f.name] == null || x.r[f.name] === '');
    else if (v) rows = rows.filter((x) => String(x.r[f.name] ?? '') === String(v));
    if (f.groupFilter) {
      const g = q[`f_${f.groupFilter.name}`];
      if (g) rows = rows.filter((x) => (optionList(f).find((o) => o.value === x.r[f.name]) || {}).group === g);
    }
  }

  const sortable = ['code', 'updated_at', ...e.fields.filter((f) => f.list).map((f) => f.name)];
  const sort = sortable.includes(q.sort) ? q.sort : 'code';
  const dir = q.dir === 'desc' ? -1 : 1;
  const f = e.fields.find((x) => x.name === sort);
  const isField = Boolean(f);
  const cmp = (a, b) => {
    if (sort === 'code') return T.naturalCompare(a.r.code, b.r.code);
    if (sort === 'updated_at') return new Date(a.r.updated_at) - new Date(b.r.updated_at);
    const va = a.r[sort]; const vb = b.r[sort];
    if (f.type === 'money') return va - vb;
    if (f.type === 'date') return va < vb ? -1 : va > vb ? 1 : 0;
    return T.naturalCompare(a.shown[sort], b.shown[sort]);
  };
  rows.sort((a, b) => {
    if (isField) { // ô trống luôn xuống cuối, dù sắp tăng hay giảm
      const na = a.r[sort] == null; const nb = b.r[sort] == null;
      if (na !== nb) return na ? 1 : -1;
      if (na && nb) return T.naturalCompare(a.r.code, b.r.code);
    }
    return cmp(a, b) * dir || T.naturalCompare(a.r.code, b.r.code); // cùng giá trị -> theo mã
  });

  const totals = {};
  for (const tf of e.fields.filter((x) => x.total)) {
    totals[tf.name] = rows.reduce((s, x) => s + (Number(x.r[tf.name]) || 0), 0);
  }
  return { rows, search, sort, dir: dir === -1 ? 'desc' : 'asc', totals, filters };
}

function entityRouter(key, { store, ctxOf, requireLogin }) {
  const e = { key, ...ENTITIES[key] };
  const r = asyncRouter();
  r.use(requireLogin);

  const idOf = (req) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  /* Danh sách */
  r.get('/', async (req, res) => {
    const refs = await loadRefs(store, key);
    const all = await store.listRecords(key);
    const result = query(e, all, refs, req.query);
    const pages = Math.max(1, Math.ceil(result.rows.length / PAGE_SIZE));
    const page = Math.min(pages, Math.max(1, parseInt(req.query.page, 10) || 1));
    res.send(views.listPage(ctxOf(req), {
      e, refs, ...result, total: all.length, query: req.query,
      pageRows: result.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pages,
      success: OK_MSG[req.query.ok], error: req.query.err === 'not_found' ? 'Không tìm thấy bản ghi (có thể đã bị xóa).' : '',
    }));
  });

  /* Xuất Excel (theo đúng bộ lọc / tìm kiếm / sắp xếp đang xem) */
  r.get('/xuat-excel', async (req, res) => {
    const refs = await loadRefs(store, key);
    const result = query(e, await store.listRecords(key), refs, req.query);
    const gf = e.fields.find((f) => f.groupFilter);
    const groupOf = (rec) => {
      if (!gf) return '';
      const o = optionList(gf).find((x) => x.value === rec[gf.name]);
      return o ? o.groupLabel : 'Chưa phân loại';
    };
    const columns = [
      { label: e.codeLabel, type: 'text', width: 14 },
      ...(gf ? [{ label: gf.groupFilter.label, type: 'text', width: 22 }] : []),
      ...e.fields.map((f) => ({ label: f.label, type: f.type === 'money' ? 'money' : 'text', width: f.type === 'textarea' ? 40 : undefined })),
      { label: 'Người cập nhật cuối', type: 'text' },
      { label: 'Thời gian cập nhật', type: 'text', width: 18 },
    ];
    const rows = result.rows.map(({ r: rec, shown }) => [
      rec.code,
      ...(gf ? [groupOf(rec)] : []),
      ...e.fields.map((f) => (f.type === 'money' ? rec[f.name] : shown[f.name])),
      rec.updated_by_name || '', fmtDate(rec.updated_at),
    ]);
    const hasTotal = e.fields.some((f) => f.total);
    const totals = hasTotal
      ? [`Tổng (${rows.length})`, ...(gf ? [''] : []), ...e.fields.map((f) => (f.total ? result.totals[f.name] : '')), '', '']
      : null;
    const stamp = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/\//g, '-');
    const s = ctxOf(req);
    sendXlsx(res, `${e.title}_${stamp}.xlsx`, {
      sheetName: e.title,
      title: `DANH SÁCH ${e.title.toUpperCase()} – ${s.companyName}`,
      subtitle: `Xuất lúc ${fmtDate(new Date())} bởi ${req.user.full_name}${result.search ? ` · Tìm: "${result.search}"` : ''} · ${rows.length} dòng`,
      columns, rows, totals,
    });
  });

  /* Thêm mới */
  r.get('/moi', async (req, res) => {
    const refs = await loadRefs(store, key);
    const values = Object.fromEntries(e.fields.filter((f) => f.default).map((f) => [f.name, f.default]));
    if (req.query.project_id) values.project_id = Number(req.query.project_id);
    const all = await store.listRecords(key);
    if (e.autoCode) values.code = nextCode(e.autoCode, all);
    res.send(views.formPage(ctxOf(req), {
      e, refs, values, isNew: true, success: OK_MSG[req.query.ok], suggest: suggestions(e, all),
    }));
  });

  r.post('/moi', async (req, res) => {
    const refs = await loadRefs(store, key);
    let all = await store.listRecords(key);
    const { data, errors } = validate(e, req.body, refs, e.codeAuto ? nextCode(e.autoCode, all) : undefined);
    if (!errors.length) { const u = uniqueError(e, data, all); if (u) errors.push(u); }
    if (!errors.length) {
      try {
        // Mã tự đánh: nếu 2 người lưu cùng lúc bị trùng mã thì lấy số kế tiếp (tối đa 5 lần)
        for (let i = 0; ; i++) {
          try { await store.createRecord(key, data, req.user); break; } catch (err) {
            if (!(e.codeAuto && err.code === 'duplicate' && i < 4)) throw err;
            all = await store.listRecords(key);
            data.code = nextCode(e.autoCode, all);
          }
        }
        console.log(`[${key}] ${req.user.username} thêm ${data.code}`);
        const next = req.body.next === 'new';
        const keep = next && data.project_id ? `&project_id=${data.project_id}` : '';
        return res.redirect(next ? `${e.path}/moi?ok=created${keep}` : `${e.path}?ok=created`);
      } catch (err) {
        if (err.code === 'duplicate') errors.push(`${e.codeLabel} "${data.code}" đã tồn tại`);
        else if (err.code === 'ref_missing') errors.push('Dự án được chọn không còn tồn tại');
        else throw err;
      }
    }
    res.status(400).send(views.formPage(ctxOf(req), {
      e, refs, values: { ...req.body, ...pickValid(data) }, errors, isNew: true, suggest: suggestions(e, await store.listRecords(key)),
    }));
  });

  /* Xem / sửa */
  r.get('/:id', async (req, res) => {
    const id = idOf(req);
    const rec = id && (await store.getRecord(key, id));
    if (!rec) return res.redirect(`${e.path}?err=not_found`);
    const refs = await loadRefs(store, key);
    res.send(views.formPage(ctxOf(req), {
      e, refs, values: rec, rec, success: OK_MSG[req.query.ok], suggest: suggestions(e, await store.listRecords(key)),
      errors: req.query.err === 'in_use' ? [await inUseMessage(store, key, id)] : undefined,
    }));
  });

  r.post('/:id', async (req, res) => {
    const id = idOf(req);
    const rec = id && (await store.getRecord(key, id));
    if (!rec) return res.redirect(`${e.path}?err=not_found`);
    const refs = await loadRefs(store, key);
    const { data, errors } = validate(e, req.body, refs, rec.code);
    if (!errors.length) { const u = uniqueError(e, data, await store.listRecords(key), id); if (u) errors.push(u); }
    if (!errors.length) {
      try {
        await store.updateRecord(key, id, data, req.user);
        console.log(`[${key}] ${req.user.username} sửa ${data.code}`);
        return res.redirect(`${e.path}/${id}?ok=updated`);
      } catch (err) {
        if (err.code === 'duplicate') errors.push(`${e.codeLabel} "${data.code}" đã tồn tại`);
        else if (err.code === 'ref_missing') errors.push('Dự án được chọn không còn tồn tại');
        else if (err.code === 'not_found') return res.redirect(`${e.path}?err=not_found`);
        else throw err;
      }
    }
    res.status(400).send(views.formPage(ctxOf(req), {
      e, refs, values: { ...req.body, ...pickValid(data) }, rec, errors, suggest: suggestions(e, await store.listRecords(key)),
    }));
  });

  /* Xóa (chỉ Quản trị) */
  r.post('/:id/xoa', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send('Chỉ Quản trị được xóa.');
    const id = idOf(req);
    const rec = id && (await store.getRecord(key, id));
    if (!rec) return res.redirect(`${e.path}?err=not_found`);
    try {
      await store.deleteRecord(key, id);
      console.log(`[${key}] ${req.user.username} xóa ${rec.code}`);
      res.redirect(`${e.path}?ok=deleted`);
    } catch (err) {
      if (err.code === 'in_use') return res.redirect(`${e.path}/${id}?err=in_use`);
      if (err.code === 'not_found') return res.redirect(`${e.path}?err=not_found`);
      throw err;
    }
  });

  return r;
}

/** Danh sách lựa chọn dạng chuẩn { value, label, group, groupLabel, warn } */
function optionList(f) {
  return (f.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

/** Số phiếu tiếp theo: lớn nhất trong các mã cùng tiền tố + 1 (VD: CP-0007 -> CP-0008) */
function nextCode({ prefix, pad }, records) {
  const pre = prefix.toLowerCase();
  let max = 0;
  for (const r of records) {
    const c = String(r.code).toLowerCase();
    const rest = c.startsWith(pre) ? c.slice(pre.length) : '';
    if (/^[0-9]+$/.test(rest)) max = Math.max(max, Number(rest));
  }
  return `${prefix}${String(max + 1).padStart(pad, '0')}`;
}

/** Gợi ý khi gõ: giá trị đã từng nhập của các ô có suggest: true (nhiều lần dùng xếp trước) */
function suggestions(e, records) {
  const out = {};
  for (const f of e.fields.filter((x) => x.suggest)) {
    const count = new Map();
    for (const r of records) {
      const v = String(r[f.name] ?? '').trim();
      if (v) count.set(v, (count.get(v) || 0) + 1);
    }
    out[f.name] = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([v]) => v);
  }
  return out;
}

/** Giữ lại giá trị đã chuẩn hóa hợp lệ để hiện lại trên biểu mẫu */
function pickValid(data) {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null && !Number.isNaN(v)));
}

async function inUseMessage(store, key, id) {
  const used = await store.countRefs(key, id);
  const parts = used.map((u) => `${u.n} ${u.single}`);
  const legacy = used.some((u) => u.legacy);
  return `Không xóa được: đang có ${parts.join(', ')} gắn với ${ENTITIES[key].single} này. `
    + (legacy
      ? 'Dữ liệu cũ của tab "Nhập hằng ngày" (đã bỏ) được giữ lại để không mất số liệu – nếu thật sự cần xóa dự án, hãy báo người phụ trách hệ thống.'
      : 'Hãy xóa hoặc chuyển các khoản đó sang dự án khác trước.');
}

module.exports = { entityRouter, loadRefs, display, optionList, nextCode };
