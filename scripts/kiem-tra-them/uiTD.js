// Giao diện nhập theo tab TĐ1 / TĐ2 / TĐ3 (dữ liệu DA-TD do tdk.js tạo)
const { chromium, devices } = require('playwright'); const B = 'http://127.0.0.1:3002', SP = process.argv[2];
(async () => { const br = await chromium.launch();
 for (const [n, o] of [['pc', { viewport: { width: 1366, height: 900 } }], ['ip13', devices['iPhone 13']]]) {
  const p = await (await br.newContext(o)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const pid = await p.evaluate(async () => (await api('/api/du-an')).find((d) => d.ma_du_an === 'DA-TD').id);
  await p.evaluate((id) => { revProjectId = id; revAll = false; costAll = false; showTab('revenue'); }, pid); await p.waitForTimeout(1500);
  const nut = () => p.evaluate(() => [...document.querySelectorAll('.rev-card[data-loai="hd"] tbody tr.hd-head, .rev-card[data-loai="hd"] tbody tr.hd-child')].map((tr) => tr.querySelector('.kind-tag').innerText + ':' + tr.querySelector('.row-actions').innerText.replace(/\s+/g, ' ').trim()).join(' | '));
  const form = () => p.evaluate(() => !$('.rev-form[data-loai="hd"]').hidden);
  const pick = async (k) => { await p.click(`#tab-revenue [data-tdpick="${k}"]`); await p.waitForTimeout(500); };
  await pick(1); console.log(n, 'TĐ1 · form thêm:', await form(), '·', await nut());
  if (n === 'pc') await (await p.$('.rev-card[data-loai="hd"]')).screenshot({ path: `${SP}/TD1.png` });
  await pick(2); console.log(n, 'TĐ2 · form thêm:', await form(), '·', await nut());
  // TĐ2: chốt giá trị mới cho PL02 = 150tr
  const p2 = await p.evaluate(() => revData.items.find((r) => r.so_hieu === 'PL02 X').id);
  await p.click(`.rev-card [data-rdot="${p2}"]:not(.link-btn)`); await p.waitForTimeout(400);
  await p.selectOption('#dc-dlg tr[data-k="new"] [data-f="kieu"]', 'chot');
  await p.fill('#dc-dlg tr[data-k="new"] [data-f="so_tien"]', '150tr'); await p.click('#dc-dlg tr[data-k="new"] [data-save]'); await p.waitForTimeout(1200);
  console.log(n, 'Chốt giá trị mới 150tr ->', await p.evaluate(() => $('#dc-msg').innerText), '· TĐ2 PL02 =', await p.evaluate((id) => revData.items.find((r) => r.id === id).gia_tri, p2));
  if (n === 'pc') await (await p.$('#dc-dlg')).screenshot({ path: `${SP}/TD2-dot.png` });
  await p.click('#dc-dlg [data-close]');
  await pick(3); console.log(n, 'TĐ3 ·', await nut());
  if (n === 'pc') await (await p.$('.rev-card[data-loai="hd"]')).screenshot({ path: `${SP}/TD3-truoc.png` });
  await p.fill(`.rev-card [data-qtin="${p2}"]`, '148tr'); await p.click(`.rev-card [data-rqtsave="${p2}"]`); await p.waitForTimeout(1200);
  console.log(n, 'Lưu QT PL02 ->', await p.evaluate(() => $('#td-hd-msg').innerText), '·', await nut());
  if (n === 'pc') await (await p.$('.rev-card[data-loai="hd"]')).screenshot({ path: `${SP}/TD3-dong.png` });
  // mở khoá PL02 bằng Passcode (để máy kia thử lại)
  await p.click(`.rev-card [data-rmokhoa="${p2}"]`); await p.waitForTimeout(300);
  await p.fill('dialog.pass-dlg [name=pc]', process.env.BKS_PC); await p.click('dialog.pass-dlg button[type=submit]'); await p.waitForTimeout(1200);
  console.log(n, 'Mở khoá ->', await p.evaluate(() => $('#td-hd-msg').innerText));
  // xóa đợt chốt vừa thêm (trả lại như cũ cho máy kia)
  await p.evaluate(async (id) => { const r = revData.items.find((x) => x.id === id); for (const d of r.dot) await api(`/api/dieu-chinh/${d.id}`, { method: 'DELETE' }); }, p2);
  // HĐ đầu vào theo TĐ
  await p.evaluate(() => showTab('cost')); await p.waitForTimeout(1500);
  for (const k of [1, 2, 3]) {
    await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(300);
    await p.evaluate(() => openTp(costData.thau_phu.find((c) => c.so_ma === 'TX').id)); await p.waitForTimeout(500);
    const st = await p.evaluate(() => [...document.querySelectorAll('#tp-dlg .tp-dtl')[0].querySelectorAll('tbody tr')].map((tr) => `${tr.querySelector('.kind-tag').innerText}[ký:${tr.querySelector('[data-f="gia_tri"]')?.disabled ? 'khoá' : 'mở'} qt:${tr.querySelector('[data-f="gia_tri_qt"]') ? (tr.querySelector('[data-f="gia_tri_qt"]').disabled ? 'khoá' : 'mở') : '🔒'} ${tr.querySelector('.row-actions').innerText.replace(/\s+/g, ' ').trim()}]`).join(' '));
    console.log(n, `HĐ đầu vào TĐ${k}:`, st, '· +PL:', await p.evaluate(() => Boolean(document.querySelector('#tp-dlg [data-addpl]'))));
    if (n === 'pc' && k === 3) await (await p.$('#tp-dlg')).screenshot({ path: `${SP}/TD3-tp.png` });
    await p.evaluate(() => closeTp()); await p.waitForTimeout(300);
  }
  console.log(n, 'tràn:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'lỗi trang:', errs.length, errs[0] || '');
 } await br.close(); })();
