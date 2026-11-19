const { chromium } = require('playwright'); const B = 'http://127.0.0.1:3002';
(async () => { const br = await chromium.launch();
  const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const pid = await p.evaluate(async () => (await api('/api/du-an')).find((d) => d.ma_du_an === 'DA-A').id);
  await p.evaluate((id) => { revProjectId = id; revAll = false; costAll = false; }, pid);
  let ok = 0, bad = 0;
  const thu = async (where) => {
    const coHop = await p.evaluate(() => Boolean(document.querySelector('dialog[open]')));
    const els = await p.$$(coHop ? 'dialog[open] input.money:not([disabled])' : 'main > .tab-panel:not([hidden]) input.money:not([disabled])');
    for (const el of els) {
      if (!(await el.isVisible())) continue;
      const name = await el.evaluate((x) => x.name || x.dataset.f || x.className);
      for (const [go, mong] of [['123456789', '123.456.789'], ['1,5 tỷ', '1.500.000.000'], ['-2.500.000', '-2.500.000']]) {
        await el.fill(''); await el.click(); await p.keyboard.type(go, { delay: 5 }); await el.evaluate((x) => x.blur());
        const v = await el.inputValue();
        if (v === mong) ok++; else { bad++; console.log(`  LỖI ${where} · ô ${name}: gõ "${go}" -> "${v}" (kỳ vọng ${mong})`); }
      }
      await el.fill('');
    }
  };
  await p.evaluate(() => showTab('revenue')); await p.waitForTimeout(1800); await thu('Doanh thu');
  await p.evaluate(() => showTab('cost')); await p.waitForTimeout(1800); await thu('Chi phí');
  await p.evaluate(() => openTp(costData.thau_phu.find((c) => c.so_ma === 'T1').id)); await p.waitForTimeout(500);
  await p.click('#tp-dlg [data-addpay="dot"]'); await p.waitForTimeout(300); await thu('Hộp HĐ đầu vào'); await p.evaluate(() => closeTp());
  await p.evaluate(() => showTab('revenue')); await p.waitForTimeout(1500);
  await p.evaluate(() => openDc('dt', revData.items.find((r) => r.so_hieu === 'HĐ B').id)); await p.waitForTimeout(400); await thu('Hộp đợt điều chỉnh'); await p.evaluate(() => $('#dc-dlg').close());
  await p.evaluate(() => showTab('cost')); await p.waitForTimeout(1500);
  await p.evaluate(() => openDtr('vat_tu', true)); await p.waitForTimeout(400); await thu('Hộp dự trù'); await p.evaluate(() => $('#dtr-dlg').close());
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${bad} LỖI · lỗi trang: ${errs.length} ${errs[0] || ''}`);
  await br.close(); })();
