// Chạy: BKS_PASS=... node scripts/kiem-tra-them/do-toan-bo.js (máy chủ thử ở cổng 3002, có dữ liệu mẫu)
// Dò toàn bộ giao diện sau khi gỡ mã thừa: mọi tab × TĐ, chế độ Báo cáo / Dashboard, các hộp, trợ lý, xuất file – ghi lỗi trang, NaN / undefined lọt ra
const { chromium, devices } = require('playwright'); const B = 'http://127.0.0.1:3002';
(async () => { const br = await chromium.launch(); const kq = [];
 for (const [n, o] of [['pc', { viewport: { width: 1366, height: 900 }, acceptDownloads: true }], ['ip13', { ...devices['iPhone 13'], acceptDownloads: true }]]) {
  const p = await (await br.newContext(o)).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const xau = async (ten) => { const t = await p.evaluate(() => document.querySelector('main')?.innerText + [...document.querySelectorAll('dialog[open]')].map((d) => d.innerText).join(' ')); const m = t.match(/\bNaN\b|undefined|\[object Object\]/); if (m) kq.push(`${n} ${ten}: "${m[0]}"`); };
  const id = await p.evaluate(async () => (await api('/api/du-an')).find((d) => d.ma_du_an === 'DEMO-02').id);
  for (const tab of ['report', 'duyet', 'projects', 'users', 'settings', 'guide', 'profile']) { await p.evaluate((t) => showTab(t), tab); await p.waitForTimeout(1500); await xau(tab); }
  await p.evaluate(() => showTab('report')); await p.waitForTimeout(1500);
  for (const k of [1, 2, 3]) { await p.evaluate((k) => { BST.i_td = k; renderReport(); }, k); await p.waitForTimeout(500); await xau('báo cáo TĐ' + k); }
  await p.evaluate(() => { BST.view = 'db'; renderReport(); }); await p.waitForTimeout(1500); await xau('dashboard');
  await p.evaluate(() => { BST.view = 'bc'; renderReport(); }); await p.waitForTimeout(800);
  await p.evaluate((i) => { baoCaoTheoDuAn(i); renderReport(); }, id); await p.waitForTimeout(1200); await xau('báo cáo 1 dự án');
  for (const tab of ['revenue', 'cost']) {
    await p.evaluate(([t, i]) => { revProjectId = i; revAll = false; costAll = false; showTab(t); }, [tab, id]); await p.waitForTimeout(2200);
    for (const k of [1, 2, 3]) { await p.click(`#tab-${tab} [data-tdpick="${k}"]`); await p.waitForTimeout(900); await xau(`${tab} TĐ${k}`);
      if (tab === 'cost') {
        await p.click('.dtcp-table [data-dtcphd="thau_phu"]'); await p.waitForTimeout(500); if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(500); }
        await xau(`HĐ › TĐ${k}`); const tp = await p.$('#tpn-dlg [data-tpopen]'); if (tp) { await tp.click(); await p.waitForTimeout(600); await xau(`hộp HĐ thầu phụ TĐ${k}`); }
        await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
        await p.click('.dtcp-table [data-dtcpkh="gt_luong|luong"]'); await p.waitForTimeout(500); await xau(`Chi tiết lương TĐ${k}`);
        await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
        await p.click('.dtcp-table [data-dtcpls]').catch(() => {}); await p.waitForTimeout(500); await xau(`Lịch sử TĐ${k}`);
        await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
        await p.click('[data-cfopen]'); await p.waitForTimeout(400); await xau(`Ghi khoản đã chi TĐ${k}`); await p.keyboard.press('Escape');
      }
    }
  }
  // xem tất cả dự án ở Doanh thu / Chi phí
  await p.evaluate(() => { revAll = true; costAll = true; showTab('cost'); }); await p.waitForTimeout(2000); await xau('chi phí tất cả');
  await p.evaluate(() => { showTab('revenue'); }); await p.waitForTimeout(2000); await xau('doanh thu tất cả');
  if (n === 'pc') { // xuất file
    await p.evaluate(() => { revAll = false; costAll = false; showTab('report'); }); await p.waitForTimeout(1500);
    for (const b of ['#b-xlsx', '#b-xlsx-mau', '#b-pptx']) { try { const dl = p.waitForEvent('download', { timeout: 90000 }); await p.evaluate(() => document.querySelector('#xuat-grp [data-grp-toggle]').click()); await p.click(b); const d = await dl; kq.push(`xuất ${b}: ${d.suggestedFilename()}`); } catch (e) { kq.push(`xuất ${b}: LỖI ${e.message.slice(0, 80)}`); } }
  }
  kq.push(`${n}: lỗi trang ${errs.length}${errs.length ? ' – ' + [...new Set(errs)].slice(0, 3).join(' | ') : ''} · tràn ${await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)}`);
 }
 console.log(kq.join('\n')); await br.close(); })();
