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
  const rows = rep.rows.map((x) => `
    <tr>
      <td data-label="Mã dự án"><a class="code" href="/du-an/${x.id}">${esc(x.code)}</a></td>
      <td data-label="Tên dự án">${esc(x.name)}</td>
      <td data-label="Trạng thái">${statusBadge(x.status)}</td>
      <td data-label="Giá trị HĐ" class="num">${money(x.contract)}</td>
      <td data-label="Doanh thu" class="num"><a href="/doanh-thu?f_project_id=${x.id}">${money(x.revenue)}</a></td>
      <td data-label="Chi phí" class="num"><a href="/chi-phi?f_project_id=${x.id}">${money(x.cost)}</a></td>
      <td data-label="Lợi nhuận" class="num ${sign(x.profit)}"><b>${money(x.profit)}</b></td>
      <td data-label="Tỷ suất LN" class="num ${sign(x.margin)}">${pctTxt(x.margin)}</td>
      <td data-label="% Thu / HĐ" class="num">${pctTxt(x.collected)}</td>
    </tr>`).join('');

  return layout(ctx, {
    title: 'Báo cáo',
    body: `
<div class="page-head">
  <h1 class="page-title">Báo cáo tổng hợp theo dự án</h1>
  <div class="head-actions"><a class="btn btn-outline" href="/bao-cao/xuat-excel${qs(f)}">⬇ Xuất Excel</a></div>
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
<section class="grid kpis">
  <div class="tile"><div class="tile-label">Doanh thu</div><div class="tile-value">${money(t.revenue)} đ</div></div>
  <div class="tile"><div class="tile-label">Chi phí</div><div class="tile-value">${money(t.cost)} đ</div></div>
  <div class="tile"><div class="tile-label">Lợi nhuận</div><div class="tile-value ${sign(t.profit)}">${money(t.profit)} đ</div>
    <div class="tile-sub">Tỷ suất: ${pctTxt(t.margin)}</div></div>
  <div class="tile"><div class="tile-label">Dự án</div><div class="tile-value">${rep.rows.length}${rep.rows.length !== rep.projectCount ? ` / ${rep.projectCount}` : ''}</div>
    <div class="tile-sub">${PROJECT_STATUS.map((s) => `${esc(s)}: ${rep.byStatus[s]}`).join(' · ')}</div></div>
</section>
${rep.rows.length ? `
<div class="panel panel-flush">
  <table class="table table-report">
    <thead><tr><th>Mã dự án</th><th>Tên dự án</th><th>Trạng thái</th><th class="num">Giá trị HĐ</th><th class="num">Doanh thu</th>
      <th class="num">Chi phí</th><th class="num">Lợi nhuận</th><th class="num">Tỷ suất LN</th><th class="num">% Thu / HĐ</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr>
      <td data-label="Tổng" colspan="3"><b>Tổng (${rep.rows.length} dự án)</b></td>
      <td data-label="Giá trị HĐ" class="num">${money(t.contract)}</td><td data-label="Doanh thu" class="num">${money(t.revenue)}</td>
      <td data-label="Chi phí" class="num">${money(t.cost)}</td><td data-label="Lợi nhuận" class="num ${sign(t.profit)}">${money(t.profit)}</td>
      <td data-label="Tỷ suất LN" class="num">${pctTxt(t.margin)}</td><td data-label="% Thu / HĐ" class="num">${pctTxt(t.collected)}</td>
    </tr></tfoot>
  </table>
</div>` : '<div class="empty">Chưa có dự án phù hợp.</div>'}
<p class="hint formula">Cách tính: Lợi nhuận = Doanh thu − Chi phí · Tỷ suất LN = Lợi nhuận ÷ Doanh thu ·
  % Thu/HĐ = Doanh thu ÷ Giá trị hợp đồng. Lọc theo ngày áp dụng cho ngày chứng từ của doanh thu và chi phí; Giá trị HĐ không lọc theo ngày.</p>`,
  });
}

module.exports = { reportPage };
