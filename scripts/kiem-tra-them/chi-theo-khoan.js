// V15.27.11.26 – Tiền chi gắn khoản tính theo TĐ của KHOẢN, không theo tab đang mở lúc ghi
// Tình huống người dùng: dự trù chung Lương TĐ1 50 · TĐ2 Lương tháng 10 = 50, T11 = 45 · ghi chi T10 48 lúc đang mở tab TĐ3
//  -> TĐ1 = 50, TĐ2 = 95 (không bị trừ mất 48), TĐ3 = 93 (T10 đã chi -> thực chi 48; T11 chưa chi -> TĐ2 45); thẻ tổng trang Chi phí = máy chủ
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/chi-theo-khoan.js [url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const id = await p.evaluate(async () => {
    const P = (u, b) => api(u, { method: 'POST', body: JSON.stringify(b) });
    const d = await P('/api/du-an', { ma_du_an: 'DA-CK' + Date.now().toString().slice(-4), ten_du_an: 'Thử chi theo khoản', trang_thai: 'Đang thi công' });
    await P(`/api/du-an/${d.id}/doanh-thu`, { loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'C', ngay: '2026-01-01', gia_tri: '550000000' });
    await P(`/api/du-an/${d.id}/du-tru`, { nhom: 'gt_luong', nhom_con: 'luong', loai: 'ky', dtcp: true, so_tien: 50000000, vat: 0, noi_dung: 'DT-CP · Lương' });
    const t10 = await P(`/api/du-an/${d.id}/du-tru`, { nhom: 'gt_luong', nhom_con: 'luong', loai: 'ky', td_ps: 2, so_tien: 50000000, vat: 0, noi_dung: 'Lương tháng 10' });
    await P(`/api/du-an/${d.id}/du-tru`, { nhom: 'gt_luong', nhom_con: 'luong', loai: 'ky', td_ps: 2, so_tien: 45000000, vat: 0, noi_dung: 'Lương tháng 11' });
    await P(`/api/du-an/${d.id}/chi-phi`, { nhom: 'gt_luong', nhom_con: 'luong', noi_dung: 'Lương tháng 10', gia_tri: 48000000, vat: 0, ngay: '2026-11-05', goi_id: t10.id, td_ps: 3 });
    return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  const L = await p.evaluate(() => (costData.cp_nhom.find((x) => x.code === 'gt_luong')?.gt || []).map((x) => Math.round(Number(x) || 0)));
  chk('Lương TĐ1 = 50', L[0] === 50e6, String(L)); chk('Lương TĐ2 = 95 (chi ghi lúc mở TĐ3 không làm giảm TĐ2)', L[1] === 95e6, String(L)); chk('Lương TĐ3 = 93 (T10 thực chi 48 + T11 chưa chi = TĐ2 45 – V20.27.11.26)', L[2] === 93e6, String(L));
  for (const k of [1, 2, 3]) {
    await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(600);
    const r = await p.evaluate((k) => ({ sv: Math.round((costData.cp_nhom || []).reduce((a, n) => a + (Number(n.sv?.[k - 1]) || 0), 0)), the: Number(document.querySelector('#c-k-sau')?.innerText.replace(/\D/g, '') || 0) }), k);
    chk(`TĐ${k}: thẻ tổng trang Chi phí = máy chủ`, Math.abs(r.the - r.sv) <= 2, `${r.the} / ${r.sv}`);
  }
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
