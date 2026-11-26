// V10.26.11.26 – Hộp chi tiết nhóm HĐ đầu vào: "+ HĐ" (nhà thầu mới) và "+ CP khác" phát sinh tại TĐ2 / TĐ3 -> TĐ trước = 0
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/nhom-ps.js [url]   (dữ liệu mẫu DEMO-xx, tài khoản admin)
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const id = await p.evaluate(async () => (await api('/api/du-an')).find((d) => d.ma_du_an === 'DEMO-07').id);
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  const cp = () => p.evaluate(() => { const g = costData.cp_nhom.find((n) => n.code === 'thau_phu')?.gt || [0, 0, 0]; return g.map((x) => Math.round(Number(x) || 0)); });
  const moNhom = async (k) => {
    await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.waitForTimeout(200);
    await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(700);
    await p.click('.dtcp-table [data-dtcphd="thau_phu"]'); await p.waitForTimeout(600);
    if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(600); }
  };
  const themCp = async (nd, so) => { await p.click('#tpn-dlg [data-nhcp]'); await p.waitForTimeout(400); await p.fill('#nhcp-dlg [name=nd]', nd); await p.click('#nhcp-dlg [name=so]'); await p.keyboard.type(String(so)); await p.fill('#nhcp-dlg [name=vat]', '0'); await p.click('#nhcp-dlg button[type=submit]'); await p.waitForTimeout(1800); };
  const themHd = async (so, gt) => { await p.click('#tpn-dlg [data-nhhd]'); await p.waitForTimeout(700);
    await p.fill('#cf-dlg [name=so_tp]', so); await p.fill('#cf-dlg [name=doi_tac]', 'Cty thử ' + so); await p.fill('#cf-dlg [name=ngay]', '20/11/2026');
    await p.click('#cf-dlg [name=gia_tri]'); await p.keyboard.type(String(gt)); await p.fill('#cf-dlg [name=vat]', '0');
    await p.click('#cf-dlg #c-form button[type=submit]'); await p.waitForTimeout(2000); await p.keyboard.press('Escape'); await p.waitForTimeout(300); };
  // ---- TĐ2 ----
  const c0 = await cp();
  await moNhom(2);
  chk('hộp nhóm có nút + HĐ và + CP khác', await p.evaluate(() => Boolean(document.querySelector('#tpn-dlg [data-nhhd]') && document.querySelector('#tpn-dlg [data-nhcp]'))));
  const gd = await p.evaluate(() => [...document.querySelectorAll('#tpn-dlg tr.tp-r-goi')].map((tr) => ({ coHd: Boolean(tr.querySelector('[data-tpgr]')) || !/Chưa có HĐ/.test(tr.querySelector('.tp-dt')?.innerText || ''), nut: Boolean(tr.querySelector('[data-goihd]')) })));
  if (gd.some((x) => x.coHd)) chk('gói đã có HĐ vẫn có + HĐ (nhiều nhà thầu)', gd.some((x) => x.coHd && x.nut), JSON.stringify(gd)); else console.log('  (bỏ qua: HĐ CĐT này không có gói có HĐ)');
  await themCp('Vệ sinh công nghiệp TĐ2', 10000000);
  const c1 = await cp();
  chk('CP khác phát sinh TĐ2: TĐ1 không đổi', c1[0] === c0[0], `${c0} -> ${c1}`);
  chk('CP khác phát sinh TĐ2: TĐ2 +10 tr', c1[1] - c0[1] === 10000000, `${c0} -> ${c1}`);
  chk('CP khác phát sinh TĐ2: TĐ3 +10 tr', c1[2] - c0[2] === 10000000, `${c0} -> ${c1}`);
  await moNhom(2); await themHd('TP-PS2-' + Date.now().toString().slice(-4), 20000000);
  const c2 = await cp();
  chk('HĐ mới phát sinh TĐ2: TĐ1 không đổi', c2[0] === c1[0], `${c1} -> ${c2}`);
  chk('HĐ mới phát sinh TĐ2: TĐ2 +20 tr', c2[1] - c1[1] === 20000000, `${c1} -> ${c2}`);
  // ---- TĐ3 ----
  await moNhom(3); await themCp('Phát sinh quyết toán TĐ3', 5000000);
  const c3 = await cp();
  chk('CP khác phát sinh TĐ3: TĐ1, TĐ2 không đổi', c3[0] === c2[0] && c3[1] === c2[1], `${c2} -> ${c3}`);
  chk('CP khác phát sinh TĐ3: TĐ3 +5 tr', c3[2] - c2[2] === 5000000, `${c2} -> ${c3}`);
  await moNhom(3); await themHd('TP-PS3-' + Date.now().toString().slice(-4), 7000000);
  const c4 = await cp();
  chk('HĐ mới phát sinh TĐ3: TĐ1, TĐ2 không đổi', c4[0] === c3[0] && c4[1] === c3[1], `${c3} -> ${c4}`);
  chk('HĐ mới phát sinh TĐ3: TĐ3 +7 tr', c4[2] - c3[2] === 7000000, `${c3} -> ${c4}`);
  // ---- hiển thị ----
  await moNhom(1);
  chk('TĐ1: không hiện khoản phát sinh TĐ2 / TĐ3', await p.evaluate(() => !/Phát sinh TĐ/.test(document.querySelector('#tpn-dlg')?.innerText || '')));
  await p.keyboard.press('Escape');
  const tp = await p.evaluate(() => costData.thau_phu.find((c) => (c.nhom || 'thau_phu') === 'thau_phu').id);
  await p.evaluate((i) => openTp(i), tp); await p.waitForTimeout(500);
  chk('hộp HĐ thầu phụ không còn "+ Chi phí khác"', await p.evaluate(() => !document.querySelector('#tp-dlg [data-addcpk]')));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
