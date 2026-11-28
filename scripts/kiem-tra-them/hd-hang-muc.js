// V07.28.11.26 – Nút "HĐ ›" ở từng dòng con (Vật tư chính / Vật tư phụ) mở thẳng gói / HĐ của hạng mục đó; dòng cha Vật tư không còn nút
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/hd-hang-muc.js [url] [thư mục ảnh]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002', SP = process.argv[3];
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const id = await p.evaluate(async () => { const P = (u, b) => api(u, { method: 'POST', body: JSON.stringify(b) });
    const d = await P('/api/du-an', { ma_du_an: 'DA-VT' + Date.now().toString().slice(-4), ten_du_an: 'Thử vật tư', trang_thai: 'Đang thi công' });
    await P(`/api/du-an/${d.id}/doanh-thu`, { loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'C', ngay: '2026-01-01', gia_tri: '550000000' });
    const g1 = await P(`/api/du-an/${d.id}/du-tru`, { nhom: 'vat_tu', nhom_con: 'chinh', loai: 'ky', dtcp: true, so_tien: 75000000, vat: 0, noi_dung: 'DT-CP · Vật tư chính' });
    await P(`/api/du-an/${d.id}/du-tru`, { nhom: 'vat_tu', nhom_con: 'phu', loai: 'ky', dtcp: true, so_tien: 50000000, vat: 0, noi_dung: 'DT-CP · Vật tư phụ' });
    await P(`/api/du-an/${d.id}/thau-phu`, { so_ma: 'VT-A', nhom: 'vat_tu', doi_tac: 'Thép A', goi_id: g1.id, hd: { gia_tri: 70000000, vat: 0, ngay: '2026-02-01' } }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  await p.click('#tab-cost [data-tdpick="2"]'); await p.waitForTimeout(800);
  chk('dòng cha Vật tư không còn nút HĐ ›', !(await p.$('.dtcp-table tr.dtcp-cha[data-cha="vat_tu"] [data-dtcphd]')));
  chk('dòng Vật tư chính / phụ có nút HĐ ›', Boolean(await p.$('.dtcp-table [data-dtcphd="vat_tu"][data-con="chinh"]')) && Boolean(await p.$('.dtcp-table [data-dtcphd="vat_tu"][data-con="phu"]')));
  const mo = async (con) => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click(`.dtcp-table [data-dtcphd="vat_tu"][data-con="${con}"]`); await p.waitForTimeout(700); if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(700); } };
  const doc = () => p.evaluate(() => ({ h3: document.querySelector('#tpn-dlg h3')?.innerText || '', t: document.querySelector('#tpn-dlg tbody')?.innerText || '' }));
  await mo('chinh'); let d = await doc();
  chk('Vật tư chính: tiêu đề + chỉ gói chính và HĐ VT-A', /Vật tư chính/.test(d.h3) && /Vật tư chính/.test(d.t) && /VT-A/.test(d.t) && !/Vật tư phụ/.test(d.t), JSON.stringify(d).slice(0, 300));
  if (SP) await (await p.$('#tpn-dlg')).screenshot({ path: `${SP}/hd-vt-chinh.png` });
  await mo('phu'); d = await doc();
  chk('Vật tư phụ: chỉ gói phụ, không có HĐ VT-A', /Vật tư phụ/.test(d.h3) && /Vật tư phụ/.test(d.t) && !/VT-A/.test(d.t), JSON.stringify(d).slice(0, 300));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
