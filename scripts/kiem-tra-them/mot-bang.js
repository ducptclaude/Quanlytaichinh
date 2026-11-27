// V18.27.11.26 – Hộp "Chi tiết ›" 1 bảng: mỗi khoản + các lần chi bên dưới; "+ Chi" ghi chi ngay trong bảng, "Xoá" lần chi / khoản
// Tình huống người dùng: khoản "Lương BCH" TĐ1 50 · chi T10 50, T11 45, T12 45 -> Đã chi 140, TĐ2 = 140 · xoá chi T12 -> 95
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/mot-bang.js [url] [thư mục ảnh]
const { chromium, devices } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002', SP = process.argv[3];
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const id = await p.evaluate(async () => { const d = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ma_du_an: 'DA-1B' + Date.now().toString().slice(-4), ten_du_an: 'Thử 1 bảng', trang_thai: 'Đang thi công' }) });
    await api(`/api/du-an/${d.id}/du-tru`, { method: 'POST', body: JSON.stringify({ nhom: 'gt_luong', nhom_con: 'luong', loai: 'ky', so_tien: 50000000, vat: 0, noi_dung: 'Lương BCH' }) }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  await p.click('#tab-cost [data-tdpick="2"]'); await p.waitForTimeout(800);
  const mo = async () => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click('.dtcp-table [data-dtcpkh="gt_luong|luong"]'); await p.waitForTimeout(600); };
  await mo();
  for (const [nd, so] of [['Lương BCH tháng 10', '50000000'], ['Lương BCH tháng 11', '45000000'], ['Lương BCH tháng 12', '45000000']]) {
    await p.click('#khds-dlg [data-khchi]'); await p.waitForTimeout(300);
    await p.fill('#khds-dlg tr.khds-new [data-f="nd"]', nd); await p.click('#khds-dlg tr.khds-new [data-f="so"]'); await p.keyboard.type(so); await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  }
  const dong = () => p.evaluate(() => [...document.querySelectorAll('#khds-dlg tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ').trim()));
  let ds = await dong();
  chk('3 lần chi hiện dưới khoản', ds.filter((x) => /Đã chi:/.test(x)).length === 3, JSON.stringify(ds));
  const L = () => p.evaluate(() => (costData.cp_nhom.find((x) => x.code === 'gt_luong')?.gt || []).map((x) => Math.round(Number(x) || 0)));
  let v = await L(); chk('TĐ1 = 50, TĐ2 = 140, TĐ3 = 140', v[0] === 50e6 && v[1] === 140e6 && v[2] === 140e6, String(v));
  if (SP) await (await p.$('#khds-dlg')).screenshot({ path: `${SP}/mot-bang-pc.png` });
  chk('không tràn ngang hộp', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // xoá lần chi tháng 12
  await p.evaluate(() => [...document.querySelectorAll('#khds-dlg tr.khds-chi')].find((tr) => /tháng 12/.test(tr.innerText)).querySelector('[data-chixoa]').click()); await p.waitForTimeout(1800);
  ds = await dong(); v = await L();
  chk('xoá chi tháng 12: còn 2 lần chi, TĐ2 = 95', ds.filter((x) => /Đã chi:/.test(x)).length === 2 && v[1] === 95e6, `${v} ${JSON.stringify(ds)}`);
  // xoá khoản
  await p.click('#khds-dlg [data-khxoa]'); await p.waitForTimeout(1800);
  chk('xoá khoản: không còn khoản', /Chưa có khoản nào/.test(await p.evaluate(() => document.querySelector('#khds-dlg tbody').innerText)));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
  if (SP) { // ảnh điện thoại
    const b2 = await chromium.launch(); const q = await (await b2.newContext(devices['iPhone 13'])).newPage();
    await q.goto(B + '/login'); await q.fill('[name=username]', 'admin'); await q.fill('[name=password]', process.env.BKS_PASS);
    await Promise.all([q.waitForURL(B + '/'), q.click('form button[type=submit]')]); await q.waitForTimeout(1500);
    await q.evaluate(async (i) => { const k = await api(`/api/du-an/${i}/du-tru`, { method: 'POST', body: JSON.stringify({ nhom: 'gt_luong', nhom_con: 'luong', loai: 'ky', so_tien: 50000000, vat: 0, noi_dung: 'Lương BCH' }) });
      await api(`/api/du-an/${i}/chi-phi`, { method: 'POST', body: JSON.stringify({ nhom: 'gt_luong', nhom_con: 'luong', noi_dung: 'Lương BCH tháng 10', gia_tri: 50000000, vat: 0, ngay: '2026-11-05', goi_id: k.id }) });
      revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await q.waitForTimeout(2500);
    await q.click('#tab-cost [data-tdpick="2"]'); await q.waitForTimeout(800); await q.click('.dtcp-table [data-dtcpkh="gt_luong|luong"]'); await q.waitForTimeout(600);
    await q.screenshot({ path: `${SP}/mot-bang-ip.png` }); console.log('điện thoại tràn ngang:', await q.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    await b2.close();
  }
})();
