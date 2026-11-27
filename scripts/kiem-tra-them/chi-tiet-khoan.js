// V06.27.11.26 – Nút "Chi tiết ›" ở dòng con gián tiếp (Lương / Thưởng…) trên bảng DT-CP: danh sách khoản theo 3 TĐ + thêm khoản ngay tại TĐ đang xem
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/chi-tiet-khoan.js [url]
const { chromium, devices } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch();
  for (const [n, o] of [['pc', { viewport: { width: 1366, height: 900 } }], ['ip13', devices['iPhone 13']]]) {
    const p = await (await br.newContext(o)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
    await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
    await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
    const da = await p.evaluate(async (n) => { const d = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ma_du_an: 'DA-CK' + n + Date.now().toString().slice(-3), ten_du_an: 'Thử chi tiết khoản', trang_thai: 'Đang thi công' }) });
      await api(`/api/du-an/${d.id}/doanh-thu`, { method: 'POST', body: JSON.stringify({ loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'K', ngay: '2026-01-01', gia_tri: '550000000' }) }); return d.id; }, n);
    await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, da); await p.waitForTimeout(2500);
    const td = async (k) => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(800); };
    const L = () => p.evaluate(() => (costData.cp_nhom.find((x) => x.code === 'gt_luong')?.gt || [0, 0, 0]).map((x) => Math.round(Number(x) || 0)));
    const them = async (sel, ten, so) => { await p.click(sel); await p.waitForTimeout(500); if (ten !== null) await p.fill('#khds-dlg [name=ten]', ten);
      if (so !== null) { await p.click('#khds-dlg [name=so]'); await p.keyboard.type(String(so)); } await p.click('#khds-dlg button[type=submit]'); await p.waitForTimeout(1600); };
    const nutL = '.dtcp-table [data-dtcpkh="gt_luong|luong"]', nutT = '.dtcp-table [data-dtcpkh="gt_luong|thuong_dot"]';
    await td(1);
    chk(`${n}: dòng Lương có nút Chi tiết ›`, Boolean(await p.$(nutL)));
    await them(nutL, 'Lương tháng 10', 50000000); await td(1); await them(nutT, 'Thưởng đợt 1', 25000000);
    let v = await L(); chk(`${n}: TĐ1 = 75`, v[0] === 75e6, String(v));
    await td(2); await p.click(nutL); await p.waitForTimeout(500);
    chk(`${n}: TĐ2 hộp gợi ý tên "Lương tháng 11"`, (await p.inputValue('#khds-dlg [name=ten]')) === 'Lương tháng 11', await p.inputValue('#khds-dlg [name=ten]'));
    await p.click('#khds-dlg [name=so]'); await p.keyboard.type('45000000'); await p.click('#khds-dlg button[type=submit]'); await p.waitForTimeout(1600);
    v = await L(); chk(`${n}: TĐ2 = 120, TĐ1 giữ 75`, v[0] === 75e6 && v[1] === 120e6, String(v));
    const ds = await p.evaluate(() => [...document.querySelectorAll('#khds-dlg tbody tr')].map((tr) => tr.innerText.replace(/\s+/g, ' ')));
    chk(`${n}: hộp liệt kê Lương T10 và T11 (phát sinh TĐ2, TĐ1 = —)`, ds.length === 2 && /Phát sinh TĐ2/.test(ds[1]) && /—/.test(ds[1]), JSON.stringify(ds));
    // bấm tên khoản -> mở hộp khoản
    await p.click('#khds-dlg [data-khopen]'); await p.waitForTimeout(500);
    chk(`${n}: bấm tên khoản mở hộp khoản`, Boolean(await p.$('#pk-dlg[open]')));
    // TĐ3: thêm khoản phát sinh chưa chốt (TĐ3 = đã chi)
    await td(3); await them(nutL, null, null);
    v = await L(); chk(`${n}: TĐ3 khoản "Lương tháng 12" chưa trả: TĐ1, TĐ2 không đổi`, v[0] === 75e6 && v[1] === 120e6, String(v));
    chk(`${n}: không tràn, không lỗi trang`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) && !errs.length, errs[0]);
  }
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
