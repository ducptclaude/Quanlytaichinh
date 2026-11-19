// Kiểm tra khoá số dự án (còn lại = 0): danh sách, chặn ghi, mở khoá Passcode, khoá lại
const B = 'http://127.0.0.1:3002'; let ck = '';
const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
const call = async (m, u, b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b ? JSON.stringify(b) : undefined, redirect: 'manual' }); const sc = r.headers.getSetCookie(); if (sc.length) ck = sc.map((c) => c.split(';')[0]).join('; '); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; };
(async () => {
  await call('POST', '/api/auth/login', { username: 'admin', password: process.env.BKS_PASS });
  console.log('đặt passcode', (await call('PUT', '/api/settings/passcode', { current_password: process.env.BKS_PASS, passcode: process.env.BKS_PC, passcode2: process.env.BKS_PC })).s);
  let pid = (await call('GET', '/api/du-an')).j.find((x) => x.ma_du_an === 'DA-KS')?.id;
  if (!pid) {
    pid = (await call('POST', '/api/du-an', { ma_du_an: 'DA-KS', ten_du_an: 'Thử khoá số', trang_thai: 'Đang thi công' })).j.id;
    const hd = (await call('POST', `/api/du-an/${pid}/doanh-thu`, { loai: 'hd', vat: 10, ma_loai: 'HĐ', so_ma: 'K1', ngay: '2026-01-01', gia_tri: '1000000000' })).j;
    console.log('tạo HĐ', hd?.id, (await call('POST', `/api/du-an/${pid}/tien-ve`, { loai: 'tam_ung', so_tien: '1100000000', ngay: '2026-02-01', hd_id: hd.id })).s);
  }
  const tt = (await call('GET', '/api/du-an-tinh-trang')).j, ds = (await call('GET', '/api/du-an')).j;
  const bc = (await call('GET', '/api/bao-cao')).j.du_an;
  for (const d of bc) console.log(d.ma_du_an, d.trang_thai_tu_dong, 'phải thu', d.con_lai?.pt, 'phải chi', d.con_lai?.pc, 'khoá', d.con_lai?.khoa);
  const k = tt.find((x) => x.khoa); if (!k) return console.log('Không có dự án khoá số');
  const ma = ds.find((x) => x.id === k.id).ma_du_an;
  let r = await call('POST', `/api/du-an/${k.id}/tien-ve`, { ngay: '2026-11-19', so_tien: 1000, noi_dung: 'thử' });
  console.log(ma, 'ghi tiền về khi khoá ->', r.s, r.j?.error || r.j?.errors);
  r = await call('POST', `/api/du-an/${k.id}/mo-khoa-so`, { passcode: 'sai' }); console.log('mở khoá sai passcode ->', r.s);
  r = await call('POST', `/api/du-an/${k.id}/mo-khoa-so`, { passcode: process.env.BKS_PC }); console.log('mở khoá đúng ->', r.s);
  console.log('trạng thái sau mở:', JSON.stringify((await call('GET', '/api/du-an-tinh-trang')).j.find((x) => x.id === k.id)));
  r = await call('PUT', `/api/du-an/${k.id}/bh`, {}); console.log('ghi khi đang mở ->', r.s, '(khác 423 là đạt)');
  r = await call('POST', `/api/du-an/${k.id}/khoa-so`, {}); console.log('khoá lại ->', r.s);
  r = await call('PUT', `/api/du-an/${k.id}/bh`, {}); console.log('ghi sau khoá lại ->', r.s);
  const mo = tt.find((x) => !x.khoa); r = await call('PUT', `/api/du-an/${mo.id}/bh`, {}); console.log('dự án chưa khoá ghi ->', r.s, '(khác 423 là đạt)');
})();
