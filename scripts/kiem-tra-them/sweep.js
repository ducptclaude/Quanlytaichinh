// Quét: mọi trang × 5 đơn vị (+ hộp chi tiết đang mở): mã lạ lọt ra màn hình, NaN / undefined, lỗi trang, số không đổi theo đơn vị
const { chromium } = require('playwright'); const B = 'http://127.0.0.1:3002';
(async () => { const br = await chromium.launch();
  const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const pid = await p.evaluate(async () => (await api('/api/du-an')).find((d) => d.ma_du_an === 'DA-A').id);
  await p.evaluate((id) => { revProjectId = id; revAll = false; costAll = false; }, pid);
  const bad = []; let n = 0;
  const scan = async (where) => {
    const r = await p.evaluate(() => {
      const vis = (el) => el && el.offsetParent !== null;
      const roots = [...document.querySelectorAll('main > .tab-panel:not([hidden]), dialog[open]')];
      const txt = roots.map((x) => x.innerText).join('\n');
      const hits = [];
      for (const re of [/<\/?(span|b|div|td|small)\b[^>]*>?/, /title="/, /\bNaN\b/, /\bundefined\b/, /\bInfinity\b/, /\[object Object\]/, /\bnull\b(?! *\))/])
        { const m = txt.match(re); if (m) hits.push(txt.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\s+/g, ' ')); }
      return hits;
    });
    n++; for (const h of r) bad.push(`${where}: …${h}…`);
  };
  const setDv = async (dv) => { await p.selectOption('#dv-pick', dv); await p.waitForTimeout(1600); };
  const snap = () => p.evaluate(() => [...document.querySelectorAll('main > .tab-panel:not([hidden]) td.num, dialog[open] td.num, main > .tab-panel:not([hidden]) .kpi .value')].slice(0, 60).map((x) => x.innerText.trim()).join('|'));
  for (const tab of ['projects', 'revenue', 'cost', 'report', 'duyet']) {
    await p.evaluate((t) => showTab(t), tab); await p.waitForTimeout(2200);
    const seen = new Set();
    for (const dv of ['dong', 'nghin', 'trieu', 'ty', 'auto']) { await setDv(dv); await scan(`${tab}/${dv}`); seen.add(await snap()); }
    console.log(`${tab}: ${seen.size} cách hiển thị khác nhau qua 5 đơn vị`);
  }
  // Hộp chi tiết đang mở + đổi đơn vị
  const hop = [['HĐ đầu vào', async () => { await p.evaluate(() => showTab('cost')); await p.waitForTimeout(1800); await p.evaluate(() => openTp(costData.thau_phu.find((c) => c.so_ma === 'T1').id)); }, () => p.evaluate(() => closeTp())],
    ['Đợt điều chỉnh', async () => { await p.evaluate(() => showTab('revenue')); await p.waitForTimeout(1800); await p.evaluate(() => openDc('dt', revData.items.find((r) => r.so_hieu === 'HĐ A').id)); }, () => p.evaluate(() => $('#dc-dlg').close())],
    ['Quyết toán', async () => { await p.evaluate(() => openQtDt(revData.items.find((r) => r.so_hieu === 'HĐ A').id)); }, () => p.evaluate(() => $('#qtdt-dlg').close())]];
  for (const [ten, mo, dong] of hop) {
    await setDv('dong'); await mo(); await p.waitForTimeout(600);
    const a = await snap(); await setDv('ty'); const b = await snap(); await scan(`hộp ${ten}/tỷ`);
    console.log(`hộp ${ten}: đổi đơn vị ${a !== b ? 'CÓ cập nhật' : 'KHÔNG cập nhật'} · còn mở: ${await p.evaluate(() => Boolean(document.querySelector('dialog[open]')))}`);
    await dong(); await setDv('auto');
  }
  console.log(`\nĐã quét ${n} màn hình · lỗi hiển thị: ${bad.length}`); [...new Set(bad)].slice(0, 25).forEach((x) => console.log('  ' + x));
  console.log('lỗi trang:', errs.length, [...new Set(errs)].slice(0, 5));
  await br.close(); })();
