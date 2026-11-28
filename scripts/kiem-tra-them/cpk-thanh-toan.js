// V22.28.11.26 – CP khác (hộp HĐ › của nhóm): bấm tên mở hộp; thanh toán ngay trong hộp như HĐ thầu phụ (+ Thanh toán, Xoá)
// Tình huống người dùng: CP khác "Vệ sinh công nghiệp" phát sinh TĐ3 7,5tr -> thanh toán 5tr -> đã trả 5, còn lại 2,5; xoá -> 0
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/cpk-thanh-toan.js [url] [thư mục ảnh]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002', SP = process.argv[3];
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const id = await p.evaluate(async () => { const P = (u, b) => api(u, { method: 'POST', body: JSON.stringify(b) });
    const d = await P('/api/du-an', { ma_du_an: 'DA-CT' + Date.now().toString().slice(-4), ten_du_an: 'Thử CP khác TT', trang_thai: 'Đang thi công' });
    await P(`/api/du-an/${d.id}/doanh-thu`, { loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'C', ngay: '2026-01-01', gia_tri: '550000000' });
    await P(`/api/du-an/${d.id}/thau-phu`, { so_ma: 'TP-A', nhom: 'thau_phu', doi_tac: 'A', hd: { gia_tri: 100000000, vat: 0, ngay: '2026-02-01' } });
    await P(`/api/du-an/${d.id}/du-tru`, { nhom: 'thau_phu', loai: 'ky', la_cp: true, td_ps: 3, so_tien: 7500000, vat: 0, noi_dung: 'CP khác · Vệ sinh công nghiệp' }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  await p.click('#tab-cost [data-tdpick="3"]'); await p.waitForTimeout(800);
  await p.click('.dtcp-table [data-dtcphd="thau_phu"]'); await p.waitForTimeout(600); if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(600); }
  chk('tên CP khác bấm được', Boolean(await p.$('#tpn-dlg .tp-cpk-ten[data-cpkopen]')));
  await p.click('#tpn-dlg .tp-cpk-ten'); await p.waitForTimeout(600);
  chk('hộp CP khác có phần Thanh toán + ô nhập', Boolean(await p.$('#cpk-dlg #cpk-ttso')));
  await p.click('#cpk-ttso'); await p.keyboard.type('5000000'); await p.keyboard.press('Enter'); await p.waitForTimeout(2000);
  const h = () => p.evaluate(() => document.querySelector('#cpk-dlg .cpk-h')?.innerText || '');
  chk('đã trả 5.000.000 · còn lại 2.500.000', /đã trả 5\.000\.000.*còn lại 2\.500\.000/.test(await h()), await h());
  chk('1 dòng thanh toán', (await p.$$('#cpk-dlg [data-cpkxtt]')).length === 1);
  if (SP) await (await p.$('#cpk-dlg')).screenshot({ path: `${SP}/cpk-tt.png` });
  await p.click('#cpk-dlg [data-cpkxtt]'); await p.waitForTimeout(1800);
  chk('xoá thanh toán: đã trả 0', /đã trả 0\b/.test(await h()), await h());
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
