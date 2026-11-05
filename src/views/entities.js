'use strict';
/** Giao diện chung cho các danh mục: danh sách + biểu mẫu */
const { esc, layout, alertBox, fmtDate } = require('./layout');
const T = require('../text');

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
  if (f.type === 'ref') {
    return rec[f.name] ? `<a href="/du-an/${rec[f.name]}" class="ref-link">${esc(v)}</a>` : '';
  }
  return esc(v);
}

function listPage(ctx, d) {
  const { e, refs, query, sort, dir, filters, search } = d;
  const listFields = e.fields.filter((f) => f.list);
  const isFiltered = Boolean(search) || filters.some((f) => query[`f_${f.name}`]);

  const th = (name, label, cls = '') => {
    const active = sort === name;
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
    const arrow = active ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="${cls}"><a class="sort ${active ? 'on' : ''}" href="${e.path}${qs(query, { sort: name, dir: nextDir, page: '' })}">${esc(label)}${arrow}</a></th>`;
  };

  const filterControls = filters.map((f) => {
    const cur = String(query[`f_${f.name}`] || '');
    const opts = f.type === 'ref'
      ? refs[f.ref].list.map((r) => [String(r.id), `${r.code} – ${r.name || ''}`])
      : f.options.map((o) => [o, o]);
    return `<label class="flt"><span>${esc(f.label)}</span>
      <select name="f_${f.name}" data-autosubmit><option value="">Tất cả</option>${opts.map(([v, l]) =>
        `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  }).join('');

  const totalsHtml = Object.entries(d.totals).map(([name, sum]) => {
    const f = e.fields.find((x) => x.name === name);
    return `<span>${esc(f.label.replace(' (đ)', ''))}: <b>${T.fmtMoney(sum)} đ</b></span>`;
  }).join('');

  const rows = d.pageRows.map(({ r, shown }) => `
    <tr>
      <td data-label="${esc(e.codeLabel)}"><a class="code" href="${e.path}/${r.id}">${esc(r.code)}</a></td>
      ${listFields.map((f) => `<td data-label="${esc(f.label)}" class="${f.type === 'money' ? 'num' : ''}">${cellHtml(f, r, shown)}</td>`).join('')}
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
    <thead><tr>${th('code', e.codeLabel)}${listFields.map((f) => th(f.name, f.label, f.type === 'money' ? 'num' : '')).join('')}${th('updated_at', 'Cập nhật cuối')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>${pager}` : `
<div class="empty">${isFiltered ? 'Không có kết quả phù hợp.' : `Chưa có ${esc(e.single)} nào.`}
  ${isFiltered ? '' : `<a class="btn btn-primary" href="${e.path}/moi">+ Thêm ${esc(e.single)} đầu tiên</a>`}</div>`}`,
  });
}

function fieldHtml(f, values, refs) {
  const raw = values[f.name];
  const v = raw === null || raw === undefined ? '' : raw;
  const req = f.required ? ' required' : '';
  const star = f.required ? ' <span class="req">*</span>' : '';
  const label = `<span>${esc(f.label)}${star}</span>`;
  switch (f.type) {
    case 'textarea':
      return `<label class="full">${label}<textarea name="${f.name}" rows="3" maxlength="${f.maxlength || 1000}">${esc(v)}</textarea></label>`;
    case 'select':
      return `<label>${label}<select name="${f.name}"${req}>
        ${f.required && f.default ? '' : '<option value="">— Chọn —</option>'}
        ${f.options.map((o) => `<option ${String(v) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    case 'ref': {
      const list = refs[f.ref].list;
      if (!list.length) {
        return `<label>${label}<span class="hint bad">Chưa có dự án nào. <a href="/du-an/moi">Thêm dự án trước</a>.</span></label>`;
      }
      return `<label>${label}<select name="${f.name}"${req}><option value="">— Chọn dự án —</option>
        ${list.map((r) => `<option value="${r.id}" ${String(v) === String(r.id) ? 'selected' : ''}>${esc(r.code)} – ${esc(r.name || '')}</option>`).join('')}
      </select></label>`;
    }
    case 'money': {
      const shown = typeof v === 'number' ? T.fmtMoney(v) : v;
      return `<label>${label}<input name="${f.name}" value="${esc(shown)}" inputmode="numeric" autocomplete="off" data-money placeholder="VD: 1.250.000.000"${req}></label>`;
    }
    case 'date':
      return `<label>${label}<input type="date" name="${f.name}" value="${esc(v)}"${req}></label>`;
    default:
      return `<label>${label}<input name="${f.name}" value="${esc(v)}" maxlength="${f.maxlength || 200}"${req}></label>`;
  }
}

function formPage(ctx, { e, refs, values = {}, rec, errors, success, isNew }) {
  const isAdmin = ctx.user.role === 'admin';
  const title = isNew ? `Thêm ${e.single}` : `${e.codeLabel}: ${rec.code}`;
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
    <label><span>${esc(e.codeLabel)} <span class="req">*</span></span>
      <input name="code" value="${esc(values.code || '')}" required maxlength="50" placeholder="${esc(e.codePlaceholder)}" autocomplete="off">
      <small class="hint">Không được trùng. Chữ không dấu, số, . _ / -</small></label>
    ${e.fields.map((f) => fieldHtml(f, values, refs)).join('')}
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
