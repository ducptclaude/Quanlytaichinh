// V16.27.11.26 – Mở khoá dự án 1 lần = mở mọi khoá số của dự án (nhóm đã quyết toán, dòng HĐ đầu vào đã có số QT…); khoá lại = khoá hết
// Lỗi khoá trả kèm mo_khoa_da (mã dự án) để trang hỏi Passcode 1 lần rồi làm tiếp. Khoá TĐ đã trình / duyệt không bị mở.
// Chạy: BKS_PASS=... BKS_PC=... node scripts/kiem-tra-them/mo-khoa-1-lan.js [url]
const B = process.argv[2] || 'http://127.0.0.1:3002'; let ck = '';
const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
const call = async (m, u, b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b ? JSON.stringify(b) : undefined, redirect: 'manual' }); const sc = r.headers.getSetCookie(); if (sc.length) ck = sc.map((c) => c.split(';')[0]).join('; '); let j = null; try { j = await r.json(); } catch { /* */ } return { s: r.status, j }; };
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  await call('POST', '/api/auth/login', { username: 'admin', password: process.env.BKS_PASS });
  await call('PUT', '/api/settings/passcode', { current_password: process.env.BKS_PASS, passcode: process.env.BKS_PC, passcode2: process.env.BKS_PC });
  const pid = (await call('POST', '/api/du-an', { ma_du_an: 'DA-MK' + Date.now().toString().slice(-4), ten_du_an: 'Thử mở khoá 1 lần', trang_thai: 'Đang thi công' })).j.id;
  // nhóm lương đã quyết toán TĐ3 + HĐ đầu vào có dòng HĐ đã có số quyết toán
  await call('POST', `/api/du-an/${pid}/du-tru`, { nhom: 'gt_luong', loai: 'qt', so_tien: 100000000, vat: 0, noi_dung: 'QT lương' });
  const tp = (await call('POST', `/api/du-an/${pid}/thau-phu`, { so_ma: 'TPK', nhom: 'thau_phu', doi_tac: 'A', hd: { gia_tri: 100000000, vat: 0, ngay: '2026-01-01' } })).j.id;
  const ln = (await call('GET', `/api/du-an/${pid}/chi-phi`)).j.thau_phu.find((c) => c.id === tp).lines[0];
  chk('ghi số QT dòng HĐ', (await call('PUT', `/api/tp-hd-pl/${ln.id}/qt`, { gt_qt: '95000000' })).s === 200);
  const a1 = await call('POST', `/api/du-an/${pid}/du-tru`, { nhom: 'gt_luong', loai: 'ky', so_tien: 1000000, vat: 0, noi_dung: 'Lương thử' });
  chk('nhóm đã QT: chặn 423 kèm mã dự án', a1.s === 423 && a1.j?.mo_khoa_da === pid, JSON.stringify(a1));
  const b1 = await call('POST', '/api/dieu-chinh', { loai: 'tp', vb_id: ln.id, so_tien: 1000000, ngay: '2026-02-01' });
  chk('dòng HĐ đã QT: chặn 423 kèm mã dự án', b1.s === 423 && b1.j?.mo_khoa_da === pid, JSON.stringify(b1));
  chk('mở khoá dự án 1 lần (Passcode)', (await call('POST', `/api/du-an/${pid}/mo-khoa-so`, { passcode: process.env.BKS_PC })).s === 200);
  chk('sau mở: thêm khoản nhóm đã QT được', (await call('POST', `/api/du-an/${pid}/du-tru`, { nhom: 'gt_luong', loai: 'ky', so_tien: 1000000, vat: 0, noi_dung: 'Lương thử' })).s === 201);
  chk('sau mở: điều chỉnh dòng HĐ đã QT được', [200, 201].includes((await call('POST', '/api/dieu-chinh', { loai: 'tp', vb_id: ln.id, so_tien: 1000000, ngay: '2026-02-01' })).s));
  chk('trạng thái dự án: mo = true', (await call('GET', '/api/du-an-tinh-trang')).j.find((x) => x.id === pid)?.mo === true);
  chk('khoá lại', (await call('POST', `/api/du-an/${pid}/khoa-so`, {})).s === 200);
  chk('sau khoá lại: chặn lại 423', (await call('POST', `/api/du-an/${pid}/du-tru`, { nhom: 'gt_luong', loai: 'ky', so_tien: 1000000, vat: 0, noi_dung: 'Lương thử 2' })).s === 423);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
})();
