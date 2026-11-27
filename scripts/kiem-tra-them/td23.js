// V06.26.11.26 – Kiểm tra trình / duyệt / khoá TĐ2, TĐ3 (cùng cách TĐ1) + bảng DT-CP TĐ2 (± điều chỉnh) / TĐ3 (chỉ xem)
// Chạy: BKS_PASS=... BKS_PC=... node scripts/kiem-tra-them/td23.js [url]  (cần dữ liệu mẫu DEMO-xx, tài khoản admin)
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const J = (u, m = 'GET', b) => p.evaluate(async ([u, m, b]) => { const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; }, [u, m, b]);
  await J('/api/settings/passcode', 'PUT', { current_password: process.env.BKS_PASS, passcode: process.env.BKS_PC, passcode2: process.env.BKS_PC });
  const ds = (await J('/api/du-an')).j, d = ds.find((x) => x.ma_du_an === 'DEMO-02') || ds[1], id = d.id;
  const TD = (k, viec, extra = {}) => J(k === 1 ? `/api/du-an/${id}/td1` : `/api/du-an/${id}/td/${k}`, 'POST', { viec, ...extra });
  const rev = (await J(`/api/du-an/${id}/doanh-thu`)).j.items.find((r) => r.loai === 'hd');
  // 1) thứ tự: TĐ2 chưa trình được khi TĐ1 chưa duyệt
  chk('TĐ2 chưa trình được khi TĐ1 chưa duyệt', (await TD(2, 'trinh')).s === 400);
  chk('trình TĐ1', (await TD(1, 'trinh')).s === 200); chk('Quản trị tự duyệt TĐ1', (await TD(1, 'duyet')).s === 200);
  // 2) TĐ2 đang lập: nhập ± ở bảng DT-CP TĐ2 (giao diện)
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  await p.click('#tab-cost [data-tdpick="2"]').catch(() => {}); await p.waitForTimeout(500);
  await p.evaluate(() => { cfMode = '2'; costKpiTd(); }); await p.waitForTimeout(800);
  chk('TĐ2 có bảng DT-CP', await p.evaluate(() => document.querySelector('.dtcp-table')?.dataset.k === '2'));
  chk('TĐ2 có cột TĐ1 và ± so TĐ1', await p.evaluate(() => { const h = document.querySelector('.dtcp-table thead').innerText; return /TĐ1/i.test(h) && /± so TĐ1/i.test(h); }));
  const cp2a = await p.evaluate(() => Number(costData.cp_nhom.find((n) => n.code === 'tc_chi_phi')?.gt?.[1]) || 0);
  const ip = p.locator('.dtcp-table tr.dtcp-n[data-nhom="tc_chi_phi"] .dtcp-in');
  chk('ô nhập TĐ2 mở', await ip.isEnabled());
  const cur = await p.evaluate(() => Number(document.querySelector('.dtcp-table tr.dtcp-n[data-nhom="tc_chi_phi"]').dataset.auto) || 0); // V02.27.11.26: ô TĐ2 = SỐ CUỐI
  await ip.fill(String(cur + 50000000)); await p.waitForTimeout(200);
  chk('xem trước: ± so TĐ1 hiện', await p.evaluate(() => /▲|▼|=/.test(document.querySelector('.dtcp-table tr.dtcp-n[data-nhom="tc_chi_phi"] .dtcp-lech').innerText)));
  await p.click('[data-dtcpluu]'); await p.waitForTimeout(2000);
  const cp2b = await p.evaluate(() => Number(costData.cp_nhom.find((n) => n.code === 'tc_chi_phi')?.gt?.[1]) || 0);
  chk('gõ số cuối = hiện tại + 50tr: chi phí nhóm TĐ2 tăng đúng 50.000.000', cp2b - cp2a === 50000000, `${cp2a} -> ${cp2b}`);
  const r2 = (await J(`/api/du-an/${id}/chi-phi`)).j.du_tru.find((r) => r.dtcp && r.nhom === 'tc_chi_phi' && (r.loai === 'dc' || Number(r.td_ps) === 2));
  chk('phần chênh +50tr ghi thành 1 dòng (gói của dòng hoặc khoản phát sinh TĐ2)', r2 && Number(r2.so_tien) === 50000000, JSON.stringify(r2));
  // 3) trình TĐ2 -> khoá dự trù và HĐ
  chk('trình TĐ2', (await TD(2, 'trinh')).s === 200);
  chk('TĐ2 chờ duyệt: chặn điều chỉnh dự trù', (await J(`/api/du-tru/${r2.id}`, 'PUT', { so_tien: 1 })).s === 423);
  chk('TĐ2 chờ duyệt: chặn đợt điều chỉnh HĐ', (await J('/api/dieu-chinh', 'POST', { loai: 'dt', vb_id: rev.id, so_tien: 1000000, kieu: 'pm', ngay: '2026-11-20' })).s === 423);
  chk('TĐ2 chờ duyệt: chặn thêm dự trù dc', (await J(`/api/du-an/${id}/du-tru`, 'POST', { nhom: 'tc_chi_phi', loai: 'dc', so_tien: '1000', vat: 0 })).s === 423);
  chk('TĐ2 đã trình: không mở khoá TĐ1', (await TD(1, 'mo', { passcode: process.env.BKS_PC })).s === 400);
  chk('TĐ3 chưa trình được khi TĐ2 chưa duyệt', (await TD(3, 'trinh')).s === 400);
  chk('duyệt TĐ2', (await TD(2, 'duyet')).s === 200);
  // 4) TĐ3: bảng chỉ xem; trình -> khoá quyết toán
  await p.evaluate(() => loadCost()); await p.waitForTimeout(1200);
  await p.click('#tab-cost [data-tdpick="3"]').catch(() => {}); await p.waitForTimeout(500); await p.evaluate(() => { cfMode = '2'; costKpiTd(); }); await p.waitForTimeout(800);
  chk('TĐ3 có bảng DT-CP, không có ô nhập', await p.evaluate(() => document.querySelector('.dtcp-table')?.dataset.k === '3' && !document.querySelector('.dtcp-table .dtcp-in')));
  chk('TĐ3 có nút Trình duyệt TĐ3', await p.evaluate(() => Boolean(document.querySelector('[data-td1="trinh"][data-tdk="3"]'))));
  chk('trình TĐ3', (await TD(3, 'trinh')).s === 200);
  chk('TĐ3 chờ duyệt: chặn nhập quyết toán văn bản', (await J(`/api/doanh-thu/${rev.id}/qt`, 'PUT', { gt_qt: '1000' })).s === 423);
  chk('trả lại TĐ3', (await TD(3, 'tra', { ly_do: 'thử' })).s === 200);
  chk('TĐ3 bị trả lại: hết khoá', (await J(`/api/doanh-thu/${rev.id}/qt`, 'PUT', { gt_qt: String(Math.round(Number(rev.gia_tri))) })).s !== 423);
  await J(`/api/doanh-thu/${rev.id}/qt`, 'DELETE', { passcode: process.env.BKS_PC });
  // 5) trang Duyệt hiện TĐ2 đã duyệt
  await p.evaluate(() => showTab('duyet')); await p.waitForTimeout(1500);
  chk('trang Duyệt có bảng thời điểm', await p.evaluate(() => /Thời điểm/.test(document.querySelector('#dy-td1')?.innerText || '')));
  // 6) mở khoá ngược: TĐ2 rồi TĐ1
  chk('mở khoá TĐ2', (await TD(2, 'mo', { passcode: process.env.BKS_PC })).s === 200);
  chk('mở khoá TĐ1', (await TD(1, 'mo', { passcode: process.env.BKS_PC })).s === 200);
  await J(`/api/du-tru/${r2.id}`, 'DELETE');
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
