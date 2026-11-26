// V12.26.11.26 – "CP khác" của nhóm theo quy tắc phát sinh:
//  TĐ1: TĐ2 = TĐ1 (± điều chỉnh), TĐ3 = TĐ2 (quyết toán / chốt) · TĐ2: TĐ1 = 0 · TĐ3: TĐ1 = TĐ2 = 0. Số so trên máy chủ (cp_nhom, trước VAT) và hộp chi tiết.
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/cp-khac.js [url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const da = await p.evaluate(async () => { const d = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ma_du_an: 'DA-CPK' + Date.now().toString().slice(-4), ten_du_an: 'Thử CP khác', trang_thai: 'Đang thi công' }) });
    await api(`/api/du-an/${d.id}/doanh-thu`, { method: 'POST', body: JSON.stringify({ loai: 'hd', vat: 10, ma_loai: 'HĐ', so_ma: 'H1', ngay: '2026-01-01', gia_tri: '1000000000' }) }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, da); await p.waitForTimeout(2500);
  const cp = () => p.evaluate(() => (costData.cp_nhom.find((n) => n.code === 'thau_phu')?.gt || [0, 0, 0]).map((x) => Math.round(Number(x) || 0)));
  const td = async (k) => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(700); };
  const moNhom = async () => { await p.click('.dtcp-table [data-dtcphd="thau_phu"]'); await p.waitForTimeout(500); if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(500); } };
  const themCp = async (nd, so) => { await p.evaluate(() => { const b = document.createElement('button'); b.dataset.nhcp = 'thau_phu|0'; document.body.appendChild(b); b.click(); b.remove(); }); await p.waitForTimeout(400);
    await p.fill('#nhcp-dlg [name=nd]', nd); await p.click('#nhcp-dlg [name=so]'); await p.keyboard.type(String(so)); await p.fill('#nhcp-dlg [name=vat]', '0'); await p.click('#nhcp-dlg button[type=submit]'); await p.waitForTimeout(1600); };
  const idCua = (nd) => p.evaluate((n) => costData.du_tru.find((r) => r.la_cp && r.noi_dung === 'CP khác · ' + n)?.id, nd);
  const moCpk = async (id) => { await p.evaluate((i) => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); openCpk(i); }, id); await p.waitForTimeout(400); };
  // ---- A: phát sinh TĐ1 = 100 tr ----
  await td(1); await themCp('Vệ sinh A', 100000000); const A = await idCua('Vệ sinh A');
  chk('tạo CP khác TĐ1', Boolean(A)); let c = await cp();
  chk('A TĐ1: TĐ1 = TĐ2 = TĐ3 = 100 tr', c[0] === 100e6 && c[1] === 100e6 && c[2] === 100e6, String(c));
  // TĐ2: + 20 tr
  await td(2); await moCpk(A);
  chk('hộp chi tiết CP khác mở, có ô điều chỉnh TĐ2', await p.evaluate(() => Boolean(document.querySelector('#cpk-dlg[open] #cpk-dc'))));
  await p.fill('#cpk-dcnd', 'Tăng khối lượng'); await p.click('#cpk-dc'); await p.keyboard.type('20000000'); await p.click('[data-cpkdc]'); await p.waitForTimeout(1600);
  c = await cp(); chk('A ± TĐ2 +20 tr: TĐ1 100 · TĐ2 120 · TĐ3 120', c[0] === 100e6 && c[1] === 120e6 && c[2] === 120e6, String(c));
  // TĐ3: chốt 115 tr
  await td(3); await moCpk(A); await p.click('#cpk-chot'); await p.keyboard.type('115000000'); await p.click('[data-cpkchot]'); await p.waitForTimeout(1600);
  c = await cp(); chk('A chốt TĐ3 115 tr: TĐ1 100 · TĐ2 120 · TĐ3 115', c[0] === 100e6 && c[1] === 120e6 && c[2] === 115e6, String(c));
  const kpi = await p.evaluate(() => [...document.querySelectorAll('#cpk-dlg .cpk-kpis .value')].map((x) => x.innerText.replace(/\D/g, '')));
  chk('hộp chi tiết hiện TĐ1/2/3 = 100/120/115 tr', kpi[0] === '100000000' && kpi[1] === '120000000' && kpi[2] === '115000000', JSON.stringify(kpi));
  // bỏ chốt -> TĐ3 = TĐ2
  await p.fill('#cpk-chot', ''); await p.click('[data-cpkchot]'); await p.waitForTimeout(1500);
  c = await cp(); chk('bỏ chốt: TĐ3 = TĐ2 = 120', c[2] === 120e6, String(c));
  // nhóm trong hộp chi tiết khớp máy chủ
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await moNhom();
  const dong = await p.evaluate(() => document.querySelector('#tpn-dlg tr.tp-r-goi')?.innerText.replace(/\s+/g, ' '));
  chk('hộp nhóm: dòng CP khác có nút Chi tiết và cột Còn lại', await p.evaluate(() => Boolean(document.querySelector('#tpn-dlg [data-cpkopen]'))) && /(^|\D)120(\D|$)|120\.000\.000/.test(dong || ''), dong);
  // ---- B: phát sinh TĐ2 = 30 tr ----
  await td(2); await themCp('Phát sinh B', 30000000); const Bid = await idCua('Phát sinh B');
  c = await cp(); chk('B phát sinh TĐ2: TĐ1 vẫn 100 · TĐ2 150 · TĐ3 150', c[0] === 100e6 && c[1] === 150e6 && c[2] === 150e6, String(c));
  await moCpk(Bid); await p.click('#cpk-dc'); await p.keyboard.type('-5000000'); await p.click('[data-cpkdc]'); await p.waitForTimeout(1500);
  c = await cp(); chk('B ± TĐ2 −5 tr: TĐ2 145', c[1] === 145e6, String(c));
  // ---- C: phát sinh TĐ3 = 8 tr ----
  await td(3); await themCp('Quyết toán C', 8000000);
  c = await cp(); chk('C phát sinh TĐ3: TĐ1 100 · TĐ2 145 · TĐ3 153', c[0] === 100e6 && c[1] === 145e6 && c[2] === 153e6, String(c));
  // ---- xoá B ----
  await td(2); await moCpk(Bid); await p.click('[data-cpkxoa]'); await p.waitForTimeout(1500);
  c = await cp(); chk('xoá B (kèm đợt điều chỉnh): TĐ2 120 · TĐ3 128', c[1] === 120e6 && c[2] === 128e6, String(c));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
