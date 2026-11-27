// V20.27.11.26 – Hộp HĐ › (khối I) tab TĐ2: dòng gói còn mở hiện "chưa ký HĐ X"; nút "± Gói" gõ số dự trù TĐ2 mới của riêng gói
// Tình huống người dùng: gói Thầu phụ 165 (trước VAT), đã ký HĐ 150 -> TĐ2 = 165, "chưa ký HĐ 15" · ± Gói 160 -> TĐ2 = 160, "chưa ký HĐ 10"
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/goi-td2.js [url] [thư mục ảnh]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002', SP = process.argv[3];
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  let traLoi = '160tr'; p.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(traLoi) : d.accept()));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const id = await p.evaluate(async () => { const P = (u, b) => api(u, { method: 'POST', body: JSON.stringify(b) });
    const d = await P('/api/du-an', { ma_du_an: 'DA-GT' + Date.now().toString().slice(-4), ten_du_an: 'Thử gói TĐ2', trang_thai: 'Đang thi công' });
    await P(`/api/du-an/${d.id}/doanh-thu`, { loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'C', ngay: '2026-01-01', gia_tri: '550000000' });
    const g = await P(`/api/du-an/${d.id}/du-tru`, { nhom: 'thau_phu', loai: 'ky', dtcp: true, so_tien: 165000000, vat: 0, noi_dung: 'DT-CP · Thầu phụ' });
    await P(`/api/du-an/${d.id}/thau-phu`, { so_ma: 'TP-A', nhom: 'thau_phu', doi_tac: 'A', goi_id: g.id, hd: { gia_tri: 150000000, vat: 0, ngay: '2026-02-01' } }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  await p.click('#tab-cost [data-tdpick="2"]'); await p.waitForTimeout(800);
  const TP = () => p.evaluate(() => Math.round(Number(costData.cp_nhom.find((x) => x.code === 'thau_phu')?.gt?.[1]) || 0));
  chk('TĐ2 thầu phụ = 165 (gói mở giữ phần chưa ký)', (await TP()) === 165e6, String(await TP()));
  const moHd = async () => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click('.dtcp-table [data-dtcphd="thau_phu"]'); await p.waitForTimeout(600); if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(600); } };
  await moHd();
  const chip = () => p.evaluate(() => document.querySelector('#tpn-dlg .tp-chuaky')?.innerText || '');
  chk('dòng gói hiện "chưa ký HĐ 15"', /chưa ký HĐ\s*15/.test(await chip()), await chip());
  if (SP) await (await p.$('#tpn-dlg')).screenshot({ path: `${SP}/goi-td2.png` });
  chk('có nút ± Gói', Boolean(await p.$('#tpn-dlg [data-goidc]')));
  await p.click('#tpn-dlg [data-goidc]'); await p.waitForTimeout(2000);
  chk('± Gói 160: TĐ2 thầu phụ = 160', (await TP()) === 160e6, String(await TP()));
  await moHd();
  chk('sau ± Gói: "chưa ký HĐ 10"', /chưa ký HĐ\s*10/.test(await chip()), await chip());
  chk('TĐ1 giữ 165', (await p.evaluate(() => Math.round(Number(costData.cp_nhom.find((x) => x.code === 'thau_phu')?.gt?.[0]) || 0))) === 165e6);
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
