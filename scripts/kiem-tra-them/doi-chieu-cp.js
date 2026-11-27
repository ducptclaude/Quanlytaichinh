// V08.27.11.26 – Đối chiếu chi phí theo TĐ ở 3 nơi tính, mọi dự án mẫu:
//  (1) máy chủ cp_nhom (Chi phí › bảng DT-CP) · (2) thẻ tổng trang Chi phí (giao diện tự cộng) · (3) Báo cáo mục IV (c1/c2/c3)
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/doi-chieu-cp.js [url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỆCH:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  await p.evaluate(() => showTab('report')); await p.waitForTimeout(2500);
  const m4 = await p.evaluate(() => Object.fromEntries(bMuc4Data(BC.du_an, 'sv').rows.map((x) => [x.d.id, [x.c1, x.c2, x.c3]])));
  const ds = await p.evaluate(async () => (await api('/api/du-an')).map((d) => ({ id: d.id, ma: d.ma_du_an })));
  for (const d of ds) {
    await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, d.id); await p.waitForTimeout(1500);
    for (const k of [1, 2, 3]) {
      await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(500);
      const r = await p.evaluate((k) => {
        const sv = (costData.cp_nhom || []).reduce((a, n) => a + (Number(n.sv?.[k - 1]) || 0), 0);
        const the = Number(document.querySelector('#c-k-sau')?.innerText.replace(/\D/g, '') || 0) * (/-|−/.test(document.querySelector('#c-k-sau')?.innerText || '') ? -1 : 1);
        return { sv: Math.round(sv), the };
      }, k);
      const bc = Math.round(m4[d.id]?.[k - 1] ?? NaN);
      chk(`${d.ma} TĐ${k}: máy chủ = báo cáo mục IV`, Math.abs(r.sv - bc) <= 1, `${r.sv} / ${bc}`);
      chk(`${d.ma} TĐ${k}: thẻ tổng trang Chi phí = máy chủ`, Math.abs(r.the - r.sv) <= 2, `${r.the} / ${r.sv}`);
    }
  }
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} KHỚP, ${loi} LỆCH`);
  await br.close();
})();
