// V07.27.11.26 – Dự trù chung (dòng bảng DT-CP) chỉ giữ phần còn lại sau khoản chi tiết đã xác định cùng hạng mục: TĐk = MAX(chung, tổng chi tiết)
// Tình huống người dùng: TĐ1 "DT-CP · Lương" 50 (chưa xác định) -> TĐ2 xác định "Lương tháng 10" 50 => 50 (không phải 100); + tháng 11 45 => 95
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/du-tru-chung.js [url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const da = await p.evaluate(async () => { const d = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ma_du_an: 'DA-DC' + Date.now().toString().slice(-4), ten_du_an: 'Thử dự trù chung', trang_thai: 'Đang thi công' }) });
    await api(`/api/du-an/${d.id}/doanh-thu`, { method: 'POST', body: JSON.stringify({ loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'C', ngay: '2026-01-01', gia_tri: '550000000' }) }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, da); await p.waitForTimeout(2500);
  const td = async (k) => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(800); };
  const L = () => p.evaluate(() => (costData.cp_nhom.find((x) => x.code === 'gt_luong')?.gt || [0, 0, 0]).map((x) => Math.round(Number(x) || 0)));
  const hang = (c) => p.evaluate((c) => Number(document.querySelector(`.dtcp-table tr.dtcp-con[data-nhom="gt_luong"][data-con="${c}"] .dtcp-tt`)?.innerText.replace(/\D/g, '') || -1), c);
  const the = () => p.evaluate(() => Number(document.querySelector('#c-k-B2')?.innerText.replace(/\D/g, '') || -1));
  const nut = '.dtcp-table [data-dtcpkh="gt_luong|luong"]';
  const them = async (ten, so) => { await p.click(nut); await p.waitForTimeout(500); await p.fill('#khds-dlg [name=ten]', ten); await p.click('#khds-dlg [name=so]'); await p.keyboard.type(String(so)); await p.click('#khds-dlg button[type=submit]'); await p.waitForTimeout(1600); };
  // TĐ1: dự trù chung Lương 50 (gõ ở bảng)
  await td(1); const ip = '.dtcp-table tr.dtcp-con[data-nhom="gt_luong"][data-con="luong"] .dtcp-in';
  await p.fill(ip, ''); await p.click(ip); await p.keyboard.type('50000000'); await p.click('[data-dtcpluu]'); await p.waitForTimeout(2000);
  let v = await L(); chk('TĐ1 dự trù chung Lương = 50', v[0] === 50e6, String(v));
  // TĐ2: xác định Lương tháng 10 = 50 -> vẫn 50
  await td(2); await them('Lương tháng 10', 50000000);
  v = await L(); chk('TĐ2 xác định T10 50: Lương TĐ2 = 50 (không cộng dồn thành 100)', v[1] === 50e6 && v[0] === 50e6, String(v));
  const ds = await p.evaluate(() => [...document.querySelectorAll('#khds-dlg tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim())));
  const chung = ds.find((r) => /DT-CP/.test(r[0])), t10 = ds.find((r) => /tháng 10/.test(r[0]));
  chk('hộp Chi tiết: dự trù chung TĐ2 còn 0, T10 = 50, Cộng TĐ2 = 50', chung && /^0$/.test(chung[2]) && t10 && /50\.000\.000/.test(t10[2]) && /50\.000\.000/.test(await p.evaluate(() => document.querySelector('#khds-dlg tfoot td:nth-child(3)').innerText)), JSON.stringify(ds));
  // + tháng 11 45 -> 95
  await td(2); await them('Lương tháng 11', 45000000);
  v = await L(); chk('TĐ2 + T11 45: Lương TĐ2 = 95', v[1] === 95e6, String(v));
  await td(2); chk('bảng DT-CP TĐ2 dòng Lương = 95', (await hang('luong')) === 95e6, String(await hang('luong')));
  chk('thẻ "Chi phí gián tiếp" TĐ2 = 95', (await the()) === 95e6, String(await the()));
  // chi tiết ít hơn dự trù: T10 sửa còn 30 -> dự trù chung còn 20 giữ lại? (đã có T11 45 -> 75 > 50, chung = 0)
  // TĐ1 có chung 50 + khoản chi tiết TĐ1 20 -> TĐ1 = MAX(50, 20) = 50
  await td(1); await them('Lương tháng 9', 20000000);
  v = await L(); chk('TĐ1 chung 50 + chi tiết TĐ1 20: TĐ1 = 50 (không 70)', v[0] === 50e6, String(v));
  await td(1); chk('thẻ "Chi phí gián tiếp" TĐ1 = 50', (await the()) === 50e6, String(await the()));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
