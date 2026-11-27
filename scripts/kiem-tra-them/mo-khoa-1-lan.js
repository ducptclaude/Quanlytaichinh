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
// ---- V17.27.11.26: khoá TĐ đã duyệt -> lỗi kèm mo_td; mở khoá TĐk mở luôn TĐ sau (đã trình / duyệt) ----
(async () => {
  await new Promise((r) => setTimeout(r, 4000));
  let ok2 = 0, loi2 = 0; const c2 = (t, c, x = '') => { if (c) ok2++; else { loi2++; console.log('  LỖI:', t, x); } };
  await call('POST', '/api/auth/login', { username: 'admin', password: process.env.BKS_PASS });
  const pid = (await call('POST', '/api/du-an', { ma_du_an: 'DA-MT' + Date.now().toString().slice(-4), ten_du_an: 'Thử mở khoá TĐ', trang_thai: 'Đang thi công' })).j.id;
  await call('POST', `/api/du-an/${pid}/doanh-thu`, { loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'C', ngay: '2026-01-01', gia_tri: '500000000' });
  const k1 = (await call('POST', `/api/du-an/${pid}/du-tru`, { nhom: 'gt_luong', nhom_con: 'luong', loai: 'ky', so_tien: 50000000, vat: 0, noi_dung: 'Lương' })).j.id;
  for (const k of [1, 2]) { await call('POST', `/api/du-an/${pid}/td/${k}`, { viec: 'trinh' }); c2(`duyệt TĐ${k}`, (await call('POST', `/api/du-an/${pid}/td/${k}`, { viec: 'duyet' })).s === 200); }
  const x = await call('DELETE', `/api/du-tru/${k1}`);
  c2('xoá khoản TĐ1 khi TĐ1 đã duyệt: 423 kèm mo_td k=1', x.s === 423 && x.j?.mo_td?.k === 1 && x.j?.mo_td?.da === pid, JSON.stringify(x.j));
  c2('mở khoá TĐ1 sai passcode bị chặn', (await call('POST', `/api/du-an/${pid}/mo-td/1`, { passcode: '00000000' })).s !== 200);
  const m = await call('POST', `/api/du-an/${pid}/mo-td/1`, { passcode: process.env.BKS_PC });
  c2('mở khoá TĐ1 -> mở luôn TĐ2', m.s === 200 && JSON.stringify(m.j?.mo) === '["TĐ1","TĐ2"]', JSON.stringify(m.j));
  c2('sau mở: xoá được', (await call('DELETE', `/api/du-tru/${k1}`)).s < 300);
  console.log(`KẾT QUẢ (khoá TĐ): ${ok2} ĐẠT, ${loi2} LỖI`);
})();
