// Kiểm tra giao diện trên nhiều loại màn hình: mức phóng, độ rộng nội dung, cỡ chữ thực, tràn ngang, lỗi trang
const { chromium, devices } = require('playwright'); const B = 'http://127.0.0.1:3002', SP = process.argv[2];
const SCR = [
  ['24in-1920x1080', { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }],
  ['27in-2560x1440', { viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 }],
  ['Mac14-1512x982@2x', { viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 }],
  ['Mac16-1728x1117@2x', { viewport: { width: 1728, height: 1117 }, deviceScaleFactor: 2 }],
  ['Win-1536x864@1.25', { viewport: { width: 1536, height: 864 }, deviceScaleFactor: 1.25 }],
  ['laptop-1366x768', { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 }],
  ['iPhone13', devices['iPhone 13']],
];
(async () => { const br = await chromium.launch();
 for (const [n, o] of SCR) {
  const p = await (await br.newContext(o)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const info = await p.evaluate(() => { const m = document.querySelector('main'); const z = getComputedStyle(document.documentElement).getPropertyValue('--uiz').trim();
    const h = document.querySelector('main h2, main h1'); const fs = h ? parseFloat(getComputedStyle(h).fontSize) * (parseFloat(getComputedStyle(m).zoom) || 1) : 0;
    return `phóng ${z || 1} · nội dung rộng ${Math.round(m.getBoundingClientRect().width * (parseFloat(getComputedStyle(m).zoom) || 1))}px / màn ${innerWidth}px · cỡ chữ tiêu đề thực ${fs.toFixed(1)}px`; });
  const tran = [];
  for (const tab of ['report', 'revenue', 'cost']) {
    await p.evaluate((t) => showTab(t), tab); await p.waitForTimeout(2200);
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) tran.push(tab);
    if (tab === 'report' && /24in|Mac14/.test(n)) await p.screenshot({ path: `${SP}/scr-${n}.png` });
  }
  await p.evaluate(() => { try { BST.view = 'dash'; } catch {} document.querySelector('[data-bview="dash"], [data-view="dash"]')?.click(); }); await p.waitForTimeout(1500);
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) tran.push('dashboard');
  console.log(`${n}: ${info} · tràn ngang: ${tran.length ? tran.join(', ') : 'không'} · lỗi trang: ${errs.length}${errs[0] ? ' ' + errs[0] : ''}`);
 } await br.close(); })();
