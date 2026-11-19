// Ghi số tiền thật quy đổi trước VAT (mục II, III, IV) của từng dự án -> tệp JSON để so trước / sau
const { chromium } = require('playwright'); const B = 'http://127.0.0.1:3002', OUT = process.argv[2];
(async () => { const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  await p.evaluate(() => showTab('report')); await p.waitForTimeout(2500);
  const kq = await p.evaluate(async () => {
    const list = (await api('/api/bao-cao')).du_an, P = { to: bNowYm() };
    const m4 = bMuc4Data(list, 'gt').rows, th = bTongHopData(list, 'gt', P).rows, m3 = bMuc3Data(list, 'gt', th, 3).R;
    return list.map((d) => { const a = m4.find((x) => x.d.id === d.id), b = th.find((x) => x.d.id === d.id), c = m3.find((x) => x.x.d.id === d.id);
      return { ma: d.ma_du_an, iv_da_nhan: a?.nhan, iv_con_lai: a?.con, iv_da_chi: a?.chi, ii_thu: b?.thu, ii_chi: b?.chi, iii_con_phai_thu: c?.pt, iii_con_phai_chi: c?.pc }; });
  });
  require('fs').writeFileSync(OUT, JSON.stringify(kq, null, 1)); console.log('ghi', kq.length, 'dự án · lỗi trang', errs.length, errs[0] || '');
  await br.close(); })();
