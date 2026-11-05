'use strict';
/**
 * Báo cáo tổng hợp theo dự án.
 * CÔNG THỨC (đơn vị: đồng, số nguyên; TẤT CẢ tính trên tiền CHƯA VAT):
 *   Doanh thu            = tổng "Tiền chưa VAT" các khoản doanh thu của dự án (trong khoảng ngày lọc, nếu có)
 *   (1) CP trực tiếp     = tổng chi phí thuộc nhóm TT (Vật tư chính, Vật tư phụ, Máy móc thiết bị, Nhân công, Thầu phụ)
 *   Lãi gộp              = Doanh thu − (1)                 % Lãi gộp = Lãi gộp ÷ Doanh thu × 100%
 *   (2) CP gián tiếp     = tổng nhóm GT (Tiện ích, Lương, Thưởng, Ngoại giao)
 *   (3) CP tài chính     = tổng nhóm TC (Chi phí tài chính, Lãi vay – chỉ phần lãi, Phạt chủ đầu tư)
 *   (4) Chưa phân loại   = chi phí cũ chưa chọn khoản mục (hiện cảnh báo để phân loại lại)
 *   Tổng chi phí         = (1) + (2) + (3) + (4)
 *   Lợi nhuận            = Doanh thu − Tổng chi phí        Tỷ suất LN = Lợi nhuận ÷ Doanh thu × 100%
 *   % Thu / HĐ           = Doanh thu ÷ Giá trị hợp đồng × 100%
 *   Các tỷ lệ: không tính khi mẫu số = 0; làm tròn 1 chữ số thập phân.
 */
const asyncRouter = require('../router');
const T = require('../text');
const { PROJECT_STATUS, COST_GROUPS, COST_ITEMS, costGroupOf } = require('../entities');
const { sendXlsx } = require('../xlsx');
const { fmtDate } = require('../views/layout');
const { reportPage } = require('../views/reports');

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null); // 1 chữ số thập phân
const BUCKETS = ['TT', 'GT', 'TC', 'NONE'];

async function buildReport(store, q = {}) {
  const status = PROJECT_STATUS.includes(q.status) ? q.status : '';
  const okDate = (v) => { const d = T.parseDate(v); return d && !Number.isNaN(d) ? d : ''; };
  const from = okDate(q.from);
  const to = okDate(q.to);
  const inRange = (d) => (!from || (d && d >= from)) && (!to || (d && d <= to));

  const [projects, revenues, costs] = await Promise.all([
    store.listRecords('projects'), store.listRecords('revenues'), store.listRecords('costs'),
  ]);
  const shown = projects
    .filter((p) => !status || p.status === status)
    .sort((a, b) => T.naturalCompare(a.code, b.code));
  const shownIds = new Set(shown.map((p) => p.id));

  const rev = new Map();
  for (const x of revenues) {
    if (!inRange(x.doc_date)) continue;
    rev.set(x.project_id, (rev.get(x.project_id) || 0) + (Number(x.amount) || 0));
  }
  const cost = new Map(); // project_id -> { TT, GT, TC, NONE }
  const byItem = new Map(); // khoản mục -> tổng (của các dự án đang xem)
  for (const x of costs) {
    if (!inRange(x.doc_date)) continue;
    const g = costGroupOf(x.cost_item) || 'NONE';
    const amt = Number(x.amount) || 0;
    if (!cost.has(x.project_id)) cost.set(x.project_id, { TT: 0, GT: 0, TC: 0, NONE: 0 });
    cost.get(x.project_id)[g] += amt;
    if (shownIds.has(x.project_id)) {
      const k = costGroupOf(x.cost_item) ? x.cost_item : '__none';
      byItem.set(k, (byItem.get(k) || 0) + amt);
    }
  }

  const calc = (r, c, contract) => {
    const total = c.TT + c.GT + c.TC + c.NONE;
    return {
      revenue: r, direct: c.TT, gross: r - c.TT, grossMargin: pct(r - c.TT, r),
      indirect: c.GT, financial: c.TC, unclassified: c.NONE, cost: total,
      profit: r - total, margin: pct(r - total, r), contract: contract ?? null, collected: pct(r, contract),
    };
  };

  const rows = shown.map((p) => ({
    id: p.id, code: p.code, name: p.name, status: p.status,
    ...calc(rev.get(p.id) || 0, cost.get(p.id) || { TT: 0, GT: 0, TC: 0, NONE: 0 }, p.contract_value),
  }));
  const sum = (k) => rows.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  const totals = calc(sum('revenue'), { TT: sum('direct'), GT: sum('indirect'), TC: sum('financial'), NONE: sum('unclassified') }, sum('contract'));

  // Chi tiết theo khoản mục, có cộng theo nhóm
  const items = COST_GROUPS.map((g) => {
    const list = COST_ITEMS.filter((i) => i.group === g.key).map((i) => ({ value: i.value, label: i.label, amount: byItem.get(i.value) || 0 }));
    return { key: g.key, label: g.label, amount: list.reduce((s, i) => s + i.amount, 0), items: list };
  });
  if (byItem.get('__none')) items.push({ key: 'NONE', label: 'Chưa phân loại', amount: byItem.get('__none'), items: [] });

  const byStatus = Object.fromEntries(PROJECT_STATUS.map((s) => [s, projects.filter((p) => p.status === s).length]));
  return { rows, totals, items, filter: { status, from, to }, byStatus, projectCount: projects.length };
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
    const t = rep.totals;
    const range = f.from || f.to ? `Từ ${f.from ? T.fmtDay(f.from) : '…'} đến ${f.to ? T.fmtDay(f.to) : '…'}` : 'Toàn bộ thời gian';
    const s = ctxOf(req);
    const stamp = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).replace(/\//g, '-');
    const hasNone = t.unclassified > 0;
    const cols = [
      ['Mã dự án', 'text', 12, (x) => x.code], ['Tên dự án', 'text', 32, (x) => x.name], ['Trạng thái', 'text', 18, (x) => x.status],
      ['Giá trị HĐ (đ)', 'money', 18, (x) => x.contract], ['Doanh thu chưa VAT (đ)', 'money', 18, (x) => x.revenue],
      ['(1) CP trực tiếp (đ)', 'money', 18, (x) => x.direct], ['Lãi gộp (đ)', 'money', 18, (x) => x.gross],
      ['% Lãi gộp', 'percent', 11, (x) => x.grossMargin], ['(2) CP gián tiếp (đ)', 'money', 18, (x) => x.indirect],
      ['(3) CP tài chính (đ)', 'money', 18, (x) => x.financial],
      ...(hasNone ? [['(4) Chưa phân loại (đ)', 'money', 18, (x) => x.unclassified]] : []),
      ['Tổng chi phí (đ)', 'money', 18, (x) => x.cost], ['Lợi nhuận (đ)', 'money', 18, (x) => x.profit],
      ['Tỷ suất LN', 'percent', 11, (x) => x.margin], ['% Thu / HĐ', 'percent', 11, (x) => x.collected],
    ];
    sendXlsx(res, `Bao_cao_tong_hop_${stamp}.xlsx`, {
      sheetName: 'Bao cao',
      title: `BÁO CÁO DOANH THU – CHI PHÍ – LỢI NHUẬN THEO DỰ ÁN – ${s.companyName}`,
      subtitle: `${range}${f.status ? ` · Trạng thái: ${f.status}` : ''} · Số liệu chưa VAT · Xuất lúc ${fmtDate(new Date())} bởi ${req.user.full_name}`,
      columns: cols.map(([label, type, width]) => ({ label, type, width })),
      rows: rep.rows.map((x) => cols.map((c) => c[3](x))),
      totals: cols.map((c, i) => (i === 0 ? `Tổng (${rep.rows.length} dự án)` : i < 3 ? '' : c[3](t))),
    });
  });

  return r;
};

module.exports.buildReport = buildReport;
module.exports.BUCKETS = BUCKETS;
