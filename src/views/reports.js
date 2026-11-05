'use strict';
const { esc, layout } = require('./layout');
const { statusBadge, qs } = require('./entities');
const { PROJECT_STATUS } = require('../entities');
const T = require('../text');

const money = (n) => (n === null || n === undefined ? '' : T.fmtMoney(n));
const pctTxt = (n) => (n === null || n === undefined ? '—' : `${n.toLocaleString('vi-VN')}%`);
const sign = (n) => (n < 0 ? 'neg' : '');

function reportPage(ctx, rep) {
  const f = rep.filter;
  const t = rep.totals;
  const hasNone = t.unclassified > 0;
  const dateQs = (extra) => qs({ ...extra, ...(f.from ? { from: T.fmtDay(f.from) } : {}), ...(f.to ? { to: T.fmtDay(f.to) } : {}) });

  const rows = rep.rows.map((x) => `
    <tr>
      <td data-label="Mã dự án"><a class="code" href="/du-an/${x.id}">${esc(x.code)}</a></td>
      <td data-label="Dự án"><span>${esc(x.name)}<br>${statusBadge(x.status)}</span></td>
      <td data-label="Doanh thu" class="num"><a href="/doanh-thu${qs({ f_project_id: x.id })}">${money(x.revenue)}</a></td>
      <td data-label="(1) CP trực tiếp" class="num"><a href="/chi-phi${qs({ f_project_id: x.id, f_cost_group: 'TT' })}">${money(x.direct)}</a></td>
      <td data-label="Lãi gộp" class="num ${sign(x.gross)}"><b>${money(x.gross)}</b><small class="pct">${pctTxt(x.grossMargin)}</small></td>
      <td data-label="(2) CP gián tiếp" class="num"><a href="/chi-phi${qs({ f_project_id: x.id, f_cost_group: 'GT' })}">${money(x.indirect)}</a></td>
      <td data-label="(3) CP tài chính" class="num"><a href="/chi-phi${qs({ f_project_id: x.id, f_cost_group: 'TC' })}">${money(x.financial)}</a></td>
      ${hasNone ? `<td data-label="(4) Chưa phân loại" class="num warn-cell"><a href="/chi-phi${qs({ f_project_id: x.id, f_cost_item: '__none' })}">${money(x.unclassified)}</a></td>` : ''}
      <td data-label="Lợi nhuận" class="num ${sign(x.profit)}"><b>${money(x.profit)}</b><small class="pct">${pctTxt(x.margin)}</small></td>
      <td data-label="% Thu / HĐ" class="num">${pctTxt(x.collected)}</td>
    </tr>`).join('');

  const itemRows = rep.items.map((g) => `
    <tr class="grp"><td>${esc(g.label)}</td><td class="num"><b>${money(g.amount)}</b></td><td class="num">${pctTxt(t.cost ? Math.round((g.amount / t.cost) * 1000) / 10 : null)}</td></tr>
    ${g.items.map((i) => `<tr><td class="indent"><a href="/chi-phi${qs({ f_cost_item: i.value })}">${esc(i.label)}</a></td>
      <td class="num">${money(i.amount)}</td><td class="num">${pctTxt(t.cost ? Math.round((i.amount / t.cost) * 1000) / 10 : null)}</td></tr>`).join('')}`).join('');

  return layout(ctx, {
    title: 'Báo cáo',
    body: `
<div class="page-head">
  <h1 class="page-title">Báo cáo doanh thu – chi phí – lợi nhuận</h1>
  <div class="head-actions"><a class="btn btn-outline" href="/bao-cao/xuat-excel${dateQs({ status: f.status })}">⬇ Xuất Excel</a></div>
</div>
<form class="filterbar" method="get" action="/bao-cao">
  <label class="flt"><span>Trạng thái dự án</span>
    <select name="status" data-autosubmit><option value="">Tất cả</option>
    ${PROJECT_STATUS.map((s) => `<option ${s === f.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
  <label class="flt"><span>Từ ngày</span><input name="from" value="${esc(T.fmtDay(f.from))}" placeholder="dd/mm/yyyy" inputmode="numeric" autocomplete="off" data-date></label>
  <label class="flt"><span>Đến ngày</span><input name="to" value="${esc(T.fmtDay(f.to))}" placeholder="dd/mm/yyyy" inputmode="numeric" autocomplete="off" data-date></label>
  <div class="flt-actions"><button class="btn btn-primary" type="submit">Xem</button>
    ${f.status || f.from || f.to ? '<a class="btn btn-outline" href="/bao-cao">Bỏ lọc</a>' : ''}</div>
</form>
${hasNone ? `<div class="alert alert-warn">⚠ Có <b>${money(t.unclassified)} đ</b> chi phí cũ <b>chưa chọn khoản mục</b> (cột "(4) Chưa phân loại").
  <a href="/chi-phi?f_cost_item=__none">Xem và phân loại lại</a> để báo cáo theo nhóm được chính xác.</div>` : ''}
<section class="grid kpis kpis-5">
  <div class="tile"><div class="tile-label">Doanh thu (chưa VAT)</div><div class="tile-value">${money(t.revenue)} đ</div></div>
  <div class="tile"><div class="tile-label">(1) CP trực tiếp</div><div class="tile-value">${money(t.direct)} đ</div></div>
  <div class="tile"><div class="tile-label">Lãi gộp</div><div class="tile-value ${sign(t.gross)}">${money(t.gross)} đ</div>
    <div class="tile-sub">% lãi gộp: ${pctTxt(t.grossMargin)}</div></div>
  <div class="tile"><div class="tile-label">(2) Gián tiếp + (3) Tài chính</div><div class="tile-value">${money(t.indirect + t.financial)} đ</div>
    <div class="tile-sub">Gián tiếp ${money(t.indirect)} · Tài chính ${money(t.financial)}</div></div>
  <div class="tile"><div class="tile-label">Lợi nhuận</div><div class="tile-value ${sign(t.profit)}">${money(t.profit)} đ</div>
    <div class="tile-sub">Tỷ suất: ${pctTxt(t.margin)} · ${rep.rows.length}${rep.rows.length !== rep.projectCount ? `/${rep.projectCount}` : ''} dự án</div></div>
</section>
${rep.rows.length ? `
<div class="panel panel-flush">
  <table class="table table-report">
    <thead><tr><th>Mã dự án</th><th>Dự án</th><th class="num">Doanh thu</th><th class="num">(1) CP trực tiếp</th><th class="num">Lãi gộp<small class="pct">% lãi gộp</small></th><th class="num">(2) CP gián tiếp</th><th class="num">(3) CP tài chính</th>
      ${hasNone ? '<th class="num">(4) Chưa phân loại</th>' : ''}<th class="num">Lợi nhuận<small class="pct">tỷ suất</small></th><th class="num">% Thu / HĐ</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td data-label="Tổng" colspan="2"><b>Tổng (${rep.rows.length} dự án)</b></td>
      <td data-label="Doanh thu" class="num">${money(t.revenue)}</td><td data-label="(1) CP trực tiếp" class="num">${money(t.direct)}</td>
      <td data-label="Lãi gộp" class="num ${sign(t.gross)}">${money(t.gross)}<small class="pct">${pctTxt(t.grossMargin)}</small></td>
      <td data-label="(2) CP gián tiếp" class="num">${money(t.indirect)}</td><td data-label="(3) CP tài chính" class="num">${money(t.financial)}</td>
      ${hasNone ? `<td data-label="(4) Chưa phân loại" class="num">${money(t.unclassified)}</td>` : ''}
      <td data-label="Lợi nhuận" class="num ${sign(t.profit)}">${money(t.profit)}<small class="pct">${pctTxt(t.margin)}</small></td>
      <td data-label="% Thu / HĐ" class="num">${pctTxt(t.collected)}</td>
    </tr></tfoot>
  </table>
</div>` : '<div class="empty">Chưa có dự án phù hợp.</div>'}

<h2 class="section-title">Chi phí theo khoản mục</h2>
<div class="panel panel-flush panel-items">
  <table class="table table-items">
    <thead><tr><th>Nhóm / Khoản mục</th><th class="num">Chi phí chưa VAT (đ)</th><th class="num">Tỷ trọng</th></tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot><tr><td><b>Tổng chi phí</b></td><td class="num">${money(t.cost)}</td><td class="num">${t.cost ? '100%' : '—'}</td></tr></tfoot>
  </table>
</div>
<p class="hint formula">Cách tính (tiền chưa VAT): Lãi gộp = Doanh thu − (1) · Lợi nhuận = Doanh thu − (1) − (2) − (3)${hasNone ? ' − (4)' : ''} ·
  Tỷ suất = Lợi nhuận ÷ Doanh thu · % Thu/HĐ = Doanh thu ÷ Giá trị hợp đồng. Lãi vay chỉ tính phần lãi.
  Lọc theo ngày áp dụng cho ngày chứng từ; Giá trị HĐ không lọc theo ngày.</p>`,
  });
}

module.exports = { reportPage };
