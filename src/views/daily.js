'use strict';
/** Giao diện Nhập hằng ngày – bảng nhập trực tiếp (vẽ bằng public/grid.js) */
const { esc, layout } = require('./layout');
const { DAILY } = require('../entities');
const T = require('../text');
const { statusBadge } = require('./entities');

const L = DAILY.labels;
/** Nhúng dữ liệu an toàn vào trang (không chạy như mã) */
const jsonData = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function dailyPage(ctx, d) {
  const { projects, project, per } = d;
  const opts = projects.map((p) =>
    `<option value="${p.id}" ${project && p.id === project.id ? 'selected' : ''}>${esc(p.code)} – ${esc(p.name || '')}</option>`).join('');
  const base = project ? `?du_an=${project.id}` : '';
  const qsPeriod = per.all ? '&all=1' : `&from=${esc(per.from)}${per.to ? `&to=${esc(per.to)}` : ''}`;

  const picker = `
<form class="filterbar" method="get" action="${DAILY.path}">
  <label class="flt flt-search"><span>Dự án <span class="req">*</span></span>
    <select name="du_an" data-autosubmit><option value="">— Chọn dự án —</option>${opts}</select></label>
  ${project ? `
  <label class="flt"><span>Từ ngày</span><input name="from" value="${esc(T.fmtDay(per.from))}" placeholder="dd/mm/yyyy" data-date inputmode="numeric" autocomplete="off"></label>
  <label class="flt"><span>Đến ngày</span><input name="to" value="${esc(T.fmtDay(per.to))}" placeholder="dd/mm/yyyy" data-date inputmode="numeric" autocomplete="off"></label>
  <div class="flt-actions">
    <button class="btn btn-primary" type="submit">Xem</button>
    <a class="btn btn-outline" href="${DAILY.path}${base}&all=1">Tất cả</a>
  </div>` : ''}
</form>`;

  if (!project) {
    return layout(ctx, {
      title: DAILY.title,
      body: `<div class="page-head"><h1 class="page-title">${esc(DAILY.title)}</h1></div>${picker}
<div class="empty">${projects.length ? 'Chọn một dự án để bắt đầu nhập.' : 'Chưa có dự án nào. <a class="btn btn-primary" href="/du-an/moi">+ Thêm dự án</a>'}</div>`,
    });
  }

  const cols = [
    ['entry_date', L.entry_date, 'date'], ['doc_no', L.doc_no, 'text'], ['content', L.content, 'text'],
    ['unit', L.unit, 'text'], ['quantity', L.quantity, 'qty'], ['unit_price', L.unit_price, 'money'],
    ['amount', L.amount, 'calc'], ['note', L.note, 'text'],
  ];

  return layout(ctx, {
    title: `${DAILY.title} – ${project.code}`,
    scripts: ['/grid.js'],
    body: `
<div class="page-head">
  <h1 class="page-title">${esc(DAILY.title)} <small class="muted">${esc(project.code)} – ${esc(project.name || '')}</small> ${statusBadge(project.status)}</h1>
  <div class="head-actions">
    <a class="btn btn-outline" href="${DAILY.path}/xuat-excel${base}${qsPeriod}">⬇ Xuất Excel</a>
  </div>
</div>
${picker}
<p class="summary"><span>Kỳ: <b>${per.all ? 'Toàn bộ' : `${esc(T.fmtDay(per.from))} → ${per.to ? esc(T.fmtDay(per.to)) : 'nay'}`}</b></span>
  <span class="hint">Gõ trực tiếp vào bảng · <b>Enter</b> để lưu dòng · ô Nội dung có gợi ý · số lẻ dùng dấu phẩy (12,5)</span></p>
<div class="panel panel-flush">
  <table class="table dgrid" id="grid" data-project="${project.id}" data-today="${esc(d.today)}" data-can-delete="${d.canDelete ? '1' : ''}">
    <thead><tr><th class="c-stt">#</th>${cols.map(([k, l, t]) =>
      `<th class="c-${k}${['qty', 'money', 'calc'].includes(t) ? ' num' : ''}">${esc(l)}${['entry_date', 'content', 'quantity', 'unit_price'].includes(k) ? ' <span class="req">*</span>' : ''}</th>`).join('')}
      <th class="c-meta">Cập nhật</th><th class="c-act"></th></tr></thead>
    <tbody></tbody>
    <tfoot><tr><td colspan="7" class="t-label">Tổng cộng: <b data-total-count>0</b> dòng</td>
      <td class="num" data-label="${esc(L.amount)}"><b data-total-amount>0</b></td><td colspan="3"></td></tr></tfoot>
  </table>
</div>
<datalist id="dl-content">${d.suggestions.map((s) => `<option value="${esc(s.c)}">`).join('')}</datalist>
<datalist id="dl-unit">${[...new Set(['m3', 'm2', 'm', 'md', 'tấn', 'kg', 'cái', 'bộ', 'công', 'ca', 'chuyến', 'lít', 'bao', 'viên', ...d.suggestions.map((s) => s.u).filter(Boolean)])]
      .map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
<script type="application/json" id="grid-data">${jsonData({ rows: d.rows, suggestions: d.suggestions, cols })}</script>
<noscript><div class="alert alert-error">Trang này cần bật JavaScript trên trình duyệt.</div></noscript>`,
  });
}

module.exports = { dailyPage };
