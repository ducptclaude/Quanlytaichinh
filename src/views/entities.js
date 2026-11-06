'use strict';
/** Giao diện chung cho các danh mục: danh sách + biểu mẫu */
const { esc, layout, alertBox, fmtDate } = require('./layout');
const T = require('../text');

/** Danh sách lựa chọn dạng chuẩn { value, label, group, groupLabel, warn } */
const optionList = (f) => (f.options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

/** Các thẻ <option>, tự chia nhóm (optgroup) nếu lựa chọn có nhóm */
function optionTags(f, cur) {
  const list = optionList(f);
  const one = (o) => `<option value="${esc(o.value)}"${o.warn ? ` data-warn="${esc(o.warn)}"` : ''} ${String(cur) === o.value ? 'selected' : ''}>${esc(o.label)}</option>`;
  if (!list.some((o) => o.groupLabel)) return list.map(one).join('');
  const groups = [...new Set(list.map((o) => o.groupLabel))];
  return groups.map((g) => `<optgroup label="${esc(g)}">${list.filter((o) => o.groupLabel === g).map(one).join('')}</optgroup>`).join('');
}

const STATUS_CLASS = { 'Chuẩn bị thi công': 'st-prep', 'Đang thi công': 'st-doing', 'Đã hoàn thành': 'st-done' };
const statusBadge = (v) => (v ? `<span class="badge ${STATUS_CLASS[v] || ''}">${esc(v)}</span>` : '');

/** Tạo chuỗi tham số đường dẫn, giữ bộ lọc hiện tại */
function qs(query, over = {}) {
  const keep = { ...query, ...over };
  delete keep.ok; delete keep.err;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(keep)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function cellHtml(f, rec, shown) {
  const v = shown[f.name];
  if (f.name === 'status') return statusBadge(v);
  if (f.type === 'select' && f.required && !rec[f.name]) return '<span class="badge badge-warn">Chưa phân loại</span>';
  if (f.type === 'ref') {
    return rec[f.name] ? `<a href="/du-an/${rec[f.name]}" class="ref-link">${esc(v)}</a>` : '';
  }
  return esc(v);
}

function listPage(ctx, d) {
  const { e, refs, query, sort, dir, filters, search } = d;
  const listFields = e.fields.filter((f) => f.list);
  const isFiltered = Boolean(search) || filters.some((f) => query[`f_${f.name}`] || (f.groupFilter && query[`f_${f.groupFilter.name}`]));

  const th = (name, label, cls = '') => {
    const active = sort === name;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    const arrow = active ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="${cls}"><a class="sort ${active ? 'on' : ''}" href="${e.path}${qs(query, { sort: name, dir: nextDir, page: '' })}">${esc(label)}${arrow}</a></th>`;
  };

  const filterControls = filters.map((f) => {
    const cur = String(query[`f_${f.name}`] || '');
    let opts;
    if (f.type === 'ref') {
      opts = refs[f.ref].list.map((r) => `<option value="${r.id}" ${String(r.id) === cur ? 'selected' : ''}>${esc(r.code)} – ${esc(r.name || '')}</option>`).join('');
    } else {
      opts = optionTags(f, cur)
        + (f.required ? `<option value="__none" ${cur === '__none' ? 'selected' : ''}>(Chưa phân loại)</option>` : '');
    }
    let group = '';
    if (f.groupFilter) {
      const g = String(query[`f_${f.groupFilter.name}`] || '');
      group = `<label class="flt"><span>${esc(f.groupFilter.label)}</span>
      <select name="f_${f.groupFilter.name}" data-autosubmit><option value="">Tất cả</option>${f.groupFilter.groups.map((x) =>
        `<option value="${esc(x.key)}" ${x.key === g ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>`;
    }
    return `${group}<label class="flt"><span>${esc(f.label)}</span>
      <select name="f_${f.name}" data-autosubmit><option value="">Tất cả</option>${opts}</select></label>`;
  }).join('');

  const totalsHtml = Object.entries(d.totals).map(([name, sum]) => {
    const f = e.fields.find((x) => x.name === name);
    return `<span>${esc(f.label.replace(' (đ)', ''))}: <b>${T.fmtMoney(sum)} đ</b></span>`;
  }).join('');

  const rows = d.pageRows.map(({ r, shown }) => `
    <tr>
      <td data-label="${esc(e.codeLabel)}"><a class="code" href="${e.path}/${r.id}">${esc(r.code)}</a></td>
      ${listFields.map((f) => `<td data-label="${esc(f.listLabel || f.label)}" class="${f.type === 'money' ? 'num' : ''}">${cellHtml(f, r, shown)}</td>`).join('')}
      <td data-label="Cập nhật cuối" class="meta"><span>${esc(r.updated_by_name || '')}<small>${fmtDate(r.updated_at)}</small></span></td>
    </tr>`).join('');

  const pager = d.pages > 1 ? `<nav class="pager">${
    d.page > 1 ? `<a class="btn btn-sm btn-outline" href="${e.path}${qs(query, { page: d.page - 1 })}">‹ Trước</a>` : ''}
    <span>Trang ${d.page} / ${d.pages}</span>${
    d.page < d.pages ? `<a class="btn btn-sm btn-outline" href="${e.path}${qs(query, { page: d.page + 1 })}">Sau ›</a>` : ''}</nav>` : '';

  return layout(ctx, {
    title: e.title,
    body: `
<div class="page-head">
  <h1 class="page-title">${esc(e.title)} <span class="count">${d.total}</span></h1>
  <div class="head-actions">
    <a class="btn btn-outline" href="${e.path}/xuat-excel${qs(query, { page: '' })}">⬇ Xuất Excel</a>
    <a class="btn btn-primary" href="${e.path}/moi${query.f_project_id ? `?project_id=${esc(query.f_project_id)}` : ''}">+ Thêm ${esc(e.single)}</a>
  </div>
</div>
${alertBox(d.success, 'success')}
${alertBox(d.error)}
<form class="filterbar" method="get" action="${e.path}">
  <label class="flt flt-search"><span>Tìm kiếm</span>
    <input type="search" name="q" value="${esc(search)}" placeholder="Mã, tên, nội dung… (gõ không dấu cũng được)"></label>
  ${filterControls}
  <input type="hidden" name="sort" value="${esc(sort)}"><input type="hidden" name="dir" value="${esc(dir)}">
  <div class="flt-actions">
    <button class="btn btn-primary" type="submit">Tìm</button>
    ${isFiltered ? `<a class="btn btn-outline" href="${e.path}">Bỏ lọc</a>` : ''}
  </div>
</form>
<p class="summary"><span>Hiển thị <b>${d.rows.length}</b>${isFiltered ? ` / ${d.total}` : ''} bản ghi</span>${totalsHtml}</p>
${d.rows.length ? `
<div class="panel panel-flush">
  <table class="table">
    <thead><tr>${th('code', e.codeLabel)}${listFields.map((f) => th(f.name, f.listLabel || f.label, f.type === 'money' ? 'num' : '')).join('')}${th('updated_at', 'Cập nhật cuối')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>${pager}` : `
<div class="empty">${isFiltered ? 'Không có kết quả phù hợp.' : `Chưa có ${esc(e.single)} nào.`}
  ${isFiltered ? '' : `<a class="btn btn-primary" href="${e.path}/moi">+ Thêm ${esc(e.single)} đầu tiên</a>`}</div>`}`,
  });
}

function fieldHtml(f, values, refs, suggest = {}) {
  const raw = values[f.name];
  const v = raw === null || raw === undefined ? '' : raw;
  const req = f.required ? ' required' : '';
  const star = f.required ? ' <span class="req">*</span>' : '';
  const label = `<span>${esc(f.label)}${star}</span>`;
  const hint = f.hint ? `<small class="hint">${esc(f.hint)}</small>` : '';
  if (f.computed) {
    const n = typeof v === 'number' ? v : null;
    return `<label>${label}<output class="computed" data-sum="${esc((f.sumOf || []).join(','))}">${n === null ? '—' : T.fmtMoney(n)}</output>
      <small class="hint">${esc(f.hint || 'Tự tính')}</small></label>`;
  }
  switch (f.type) {
    case 'textarea':
      return `<label class="full">${label}<textarea name="${f.name}" rows="3" maxlength="${f.maxlength || 1000}">${esc(v)}</textarea></label>`;
    case 'select': {
      const sel = optionList(f).find((o) => o.value === String(v));
      return `<label>${label}<select name="${f.name}"${req} data-warn-select>
        ${f.required && f.default ? '' : '<option value="">— Chọn —</option>'}
        ${optionTags(f, v)}</select>${hint}
        <span class="alert alert-warn select-warn" ${sel && sel.warn ? '' : 'hidden'}>⚠ ${esc(sel && sel.warn ? sel.warn : '')}</span></label>`;
    }
    case 'ref': {
      const list = refs[f.ref].list;
      if (!list.length) {
        return `<label>${label}<span class="hint bad">Chưa có dự án nào. <a href="/du-an/moi">Thêm dự án trước</a>.</span></label>`;
      }
      return `<label>${label}<select name="${f.name}"${req}><option value="">— Chọn dự án —</option>
        ${list.map((r) => `<option value="${r.id}" ${String(v) === String(r.id) ? 'selected' : ''}>${esc(refOptionLabel(f, r))}</option>`).join('')}
      </select></label>`;
    }
    case 'money': {
      const shown = typeof v === 'number' ? T.fmtMoney(v) : v;
      return `<label>${label}<input name="${f.name}" value="${esc(shown)}" inputmode="numeric" autocomplete="off" data-money placeholder="${f.blankAsZero ? '0' : 'VD: 1.250.000.000'}"${req}>${hint}</label>`;
    }
    case 'date': {
      const shown = /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? T.fmtDay(v) : v;
      // Gõ tay dd/mm/yyyy hoặc bấm 📅 để chọn trên lịch (ô lịch không gửi lên máy chủ)
      return `<label>${label}<span class="date-wrap"><input name="${f.name}" value="${esc(shown)}" placeholder="dd/mm/yyyy" inputmode="numeric" autocomplete="off" data-date${req}>`
        + '<span class="date-btn" title="Chọn trên lịch" aria-hidden="true">📅<input type="date" class="date-pick" tabindex="-1" aria-label="Chọn ngày trên lịch"></span></span></label>';
    }
    default: {
      const list = suggest[f.name] && suggest[f.name].length ? ` list="dl-${f.name}"` : '';
      const dl = list ? `<datalist id="dl-${f.name}">${suggest[f.name].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : '';
      return `<label>${label}<input name="${f.name}" value="${esc(v)}" maxlength="${f.maxlength || 200}" autocomplete="off"${list}${req}>${hint}${dl}</label>`;
    }
  }
}

/** Nhãn dự án trong ô chọn; refDetail: thêm chủ đầu tư + giá trị hợp đồng để chọn đúng hợp đồng */
function refOptionLabel(f, r) {
  const base = `${r.code} – ${r.name || ''}`;
  if (!f.refDetail) return base;
  return base + (r.investor ? ` · CĐT: ${r.investor}` : '') + (r.contract_value ? ` · HĐ ${T.fmtMoney(r.contract_value)} đ` : '');
}

function formPage(ctx, { e, refs, values = {}, rec, errors, success, isNew, suggest }) {
  const isAdmin = ctx.user.role === 'admin';
  const title = isNew ? `Thêm ${e.single}`
    : e.codeAuto ? `${e.title}: ${rec.contract_no ? `HĐ ${rec.contract_no}` : rec.code}` : `${e.codeLabel}: ${rec.code}`;
  const isProject = e.key === 'projects';
  return layout(ctx, {
    title,
    body: `
<p class="crumb"><a href="${e.path}">← ${esc(e.title)}</a></p>
<div class="page-head">
  <h1 class="page-title">${esc(title)}</h1>
  ${!isNew && isProject ? statusBadge(rec.status) : ''}
</div>
${alertBox(success, 'success')}
${alertBox(errors)}
<section class="panel">
  <form method="post" action="${isNew ? `${e.path}/moi` : `${e.path}/${rec.id}`}" class="form form-grid" novalidate>
    ${e.codeAuto ? '' : `<label><span>${esc(e.codeLabel)} <span class="req">*</span></span>
      <input name="code" value="${esc(values.code || '')}" required maxlength="50" placeholder="${esc(e.codePlaceholder)}" autocomplete="off">
      <small class="hint">Không được trùng. Chữ không dấu, số, . _ / -</small></label>`}
    ${e.fields.map((f) => fieldHtml(f, values, refs, suggest)).join('')}
    <div class="form-actions full">
      <button class="btn btn-primary" type="submit">Lưu</button>
      ${isNew ? '<button class="btn btn-outline" type="submit" name="next" value="new">Lưu & thêm tiếp</button>' : ''}
      <a class="btn btn-outline" href="${e.path}">Hủy</a>
    </div>
  </form>
</section>
${isNew ? '' : `
<div class="cols cols-meta">
  <section class="panel">
    <h2>Lịch sử</h2>
    <dl class="info small">
      ${e.codeAuto ? `<dt>Mã hệ thống</dt><dd>${esc(rec.code)}</dd>` : ''}
      <dt>Tạo bởi</dt><dd>${esc(rec.created_by_name || '—')} · ${fmtDate(rec.created_at)}</dd>
      <dt>Cập nhật cuối</dt><dd>${esc(rec.updated_by_name || '—')} · ${fmtDate(rec.updated_at)}</dd>
    </dl>
    ${isProject ? `<p class="quick">
      <a class="btn btn-sm btn-outline" href="/doanh-thu?f_project_id=${rec.id}">Doanh thu của dự án</a>
      <a class="btn btn-sm btn-outline" href="/chi-phi?f_project_id=${rec.id}">Chi phí của dự án</a></p>` : ''}
  </section>
  ${isAdmin ? `
  <section class="panel panel-danger">
    <h2>Xóa ${esc(e.single)}</h2>
    <form method="post" action="${e.path}/${rec.id}/xoa" data-confirm="XÓA VĨNH VIỄN ${esc(e.single)} ${esc(rec.code)}? Thao tác này không hoàn tác được.">
      <button class="btn btn-danger" type="submit">🗑 Xóa</button>
    </form>
    <p class="hint">${isProject ? 'Chỉ xóa được dự án chưa có doanh thu / chi phí nào.' : 'Chỉ Quản trị được xóa.'}</p>
  </section>` : ''}
</div>`}`,
  });
}

module.exports = { listPage, formPage, statusBadge, qs };
