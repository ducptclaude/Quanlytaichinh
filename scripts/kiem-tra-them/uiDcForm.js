const { chromium, devices } = require('playwright'); const B = 'http://127.0.0.1:3002', SP = process.argv[2];
(async () => { const br = await chromium.launch();
 for (const [n, o] of [['pc', { viewport: { width: 1366, height: 900 } }], ['ip13', devices['iPhone 13']]]) {
  const p = await (await br.newContext(o)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const pid = await p.evaluate(async () => (await api('/api/du-an')).find((d) => d.ma_du_an === 'DA-TD').id);
  await p.evaluate((id) => { revProjectId = id; revAll = false; showTab('revenue'); }, pid); await p.waitForTimeout(1500);
  const hien = () => p.evaluate(() => `form TĐ1:${!$('.rev-form[data-loai="hd"]').hidden ? 'hiện' : 'ẩn'} · form TĐ2:${!$('#dc-form').hidden ? 'hiện' : 'ẩn'}`);
  for (const k of [1, 3, 2]) { await p.click(`#tab-revenue [data-tdpick="${k}"]`); await p.waitForTimeout(400); console.log(n, `TĐ${k}:`, await hien()); }
  console.log(n, 'Văn bản chọn được:', await p.evaluate(() => [...$('#dc-form').elements.vb_id.options].map((o) => o.text.trim()).join(' | ')));
  const p2 = await p.evaluate(() => revData.items.find((r) => r.so_hieu === 'PL02 X').id);
  await p.selectOption('#dc-form [name=vb_id]', String(p2));
  await p.click('#dc-form [name=so_tien]'); await p.keyboard.type('+5tr'); await p.press('#dc-form [name=so_tien]', 'Tab');
  console.log(n, 'Xem trước (±):', await p.evaluate(() => $('#dc-form .dc-preview').innerText));
  if (n === 'pc') await (await p.$('.rev-card[data-loai="hd"]')).screenshot({ path: `${SP}/DcForm.png` });
  await p.click('#dc-form button[type=submit]'); await p.waitForTimeout(1200);
  console.log(n, 'Ghi ±:', await p.evaluate(() => $('#td-hd-msg').innerText), '· TĐ2 PL02 =', await p.evaluate((id) => revData.items.find((r) => r.id === id).gia_tri, p2));
  await p.selectOption('#dc-form [name=kieu]', 'chot'); await p.fill('#dc-form [name=so_tien]', '130tr'); await p.press('#dc-form [name=so_tien]', 'Tab');
  console.log(n, 'Xem trước (chốt):', await p.evaluate(() => $('#dc-form .dc-preview').innerText));
  await p.click('#dc-form button[type=submit]'); await p.waitForTimeout(1200);
  console.log(n, 'Ghi chốt:', await p.evaluate(() => $('#td-hd-msg').innerText), '· TĐ2 PL02 =', await p.evaluate((id) => revData.items.find((r) => r.id === id).gia_tri, p2));
  console.log(n, 'Nút ở dòng (TĐ2):', await p.evaluate(() => [...document.querySelectorAll('.rev-card[data-loai="hd"] tr.hd-head .row-actions, .rev-card[data-loai="hd"] tr.hd-child .row-actions')].map((x) => x.innerText.trim() || '(trống)').join(' | ')),
    '· bảng cuộn ngang:', await p.evaluate(() => { const w = document.querySelector('.rev-card[data-loai="hd"] .table-wrap'); return w.scrollWidth > w.clientWidth + 1; }));
  await p.evaluate(async (id) => { for (const d of revData.items.find((r) => r.id === id).dot) await api(`/api/dieu-chinh/${d.id}`, { method: 'DELETE' }); }, p2);
  console.log(n, 'tràn trang:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'lỗi trang:', errs.length, errs[0] || '');
 } await br.close(); })();
