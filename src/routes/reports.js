'use strict';
/**
 * Báo cáo tổng hợp theo dự án.
 * CÔNG THỨC (đơn vị: đồng, số nguyên – không làm tròn khi cộng):
 *   Doanh thu  = tổng "Số tiền" các khoản doanh thu của dự án (trong khoảng ngày lọc, nếu có)
 *   Chi phí    = tổng "Số tiền" các khoản chi phí của dự án (trong khoảng ngày lọc, nếu có)
 *   Lợi nhuận  = Doanh thu − Chi phí
 *   Tỷ suất LN = Lợi nhuận ÷ Doanh thu × 100%      (không tính khi Doanh thu = 0)
 *   % Thu/HĐ   = Doanh thu ÷ Giá trị hợp đồng × 100% (không tính khi chưa có Giá trị HĐ)
 */
const asyncRouter = require('../router');
const T = require('../text');
const { PROJECT_STATUS } = require('../entities');
const { sendXlsx } = require('../xlsx');
const { fmtDate } = require('../views/layout');
const { reportPage } = require('../views/reports');

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null); // 1 chữ số thập phân

async function buildReport(store, q = {}) {
  const status = PROJECT_STATUS.includes(q.status) ? q.status : '';
  const okDate = (v) => { const d = T.parseDate(v); return d && !Number.isNaN(d) ? d : ''; };
  const from = okDate(q.from);
  const to = okDate(q.to);
  const inRange = (d) => (!from || (d && d >= from)) && (!to || (d && d <= to));

  const [projects, revenues, costs] = await Promise.all([
    store.listRecords('projects'), store.listRecords('revenues'), store.listRecords('costs'),
  ]);
  const sumBy = (list) => {
    const m = new Map();
    for (const x of list) {
      if (!inRange(x.doc_date)) continue;
      m.set(x.project_id, (m.get(x.project_id) || 0) + (Number(x.amount) || 0));
    }
    return m;
  };
  const rev = sumBy(revenues);
  const cost = sumBy(costs);

  const rows = projects
    .filter((p) => !status || p.status === status)
    .sort((a, b) => T.naturalCompare(a.code, b.code))
    .map((p) => {
      const r = rev.get(p.id) || 0;
      const c = cost.get(p.id) || 0;
      return {
        id: p.id, code: p.code, name: p.name, status: p.status,
        contract: p.contract_value ?? null, revenue: r, cost: c, profit: r - c,
        margin: pct(r - c, r), collected: pct(r, p.contract_value),
      };
    });

  const sum = (k) => rows.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const totals = { contract: sum('contract'), revenue: sum('revenue'), cost: sum('cost') };
  totals.profit = totals.revenue - totals.cost;
  totals.margin = pct(totals.profit, totals.revenue);
  totals.collected = pct(totals.revenue, totals.contract);

  const byStatus = Object.fromEntries(PROJECT_STATUS.map((s) => [s, projects.filter((p) => p.status === s).length]));
  return { rows, totals, filter: { status, from, to }, byStatus, projectCount: projects.length };
}

module.exports = function reportsRouter({ store, ctxOf, requireLogin }) {
  const r = asyncRouter();
  r.use(requireLogin);

  r.get('/', async (req, res) => {
    res.send(reportPage(ctxOf(req), await buildReport(store, req.query)));
  });

  r.get('/xuat-excel', async (req, res) => {
    const rep = await buildReport(store, req.query);
    const f = rep.filter;
    const range = f.from || f.to ? `Từ ${f.from ? T.fmtDay(f.from) : '…'} đến ${f.to ? T.fmtDay(f.to) : '…'}` : 'Toàn bộ thời gian';
    const s = ctxOf(req);
    const stamp = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/\//g, '-');
    sendXlsx(res, `Bao_cao_tong_hop_${stamp}.xlsx`, {
      sheetName: 'Bao cao',
      title: `BÁO CÁO TỔNG HỢP DOANH THU – CHI PHÍ THEO DỰ ÁN – ${s.companyName}`,
      subtitle: `${range}${f.status ? ` · Trạng thái: ${f.status}` : ''} · Xuất lúc ${fmtDate(new Date())} bởi ${req.user.full_name}`,
      columns: [
        { label: 'Mã dự án', type: 'text', width: 12 }, { label: 'Tên dự án', type: 'text', width: 36 },
        { label: 'Trạng thái', type: 'text', width: 18 }, { label: 'Giá trị HĐ (đ)', type: 'money' },
        { label: 'Doanh thu (đ)', type: 'money' }, { label: 'Chi phí (đ)', type: 'money' },
        { label: 'Lợi nhuận (đ)', type: 'money' }, { label: 'Tỷ suất LN', type: 'percent', width: 12 },
        { label: '% Thu / HĐ', type: 'percent', width: 12 },
      ],
      rows: rep.rows.map((x) => [x.code, x.name, x.status, x.contract, x.revenue, x.cost, x.profit, x.margin, x.collected]),
      totals: [`Tổng (${rep.rows.length} dự án)`, '', '', rep.totals.contract, rep.totals.revenue, rep.totals.cost,
        rep.totals.profit, rep.totals.margin, rep.totals.collected],
    });
  });

  return r;
};

module.exports.buildReport = buildReport;
