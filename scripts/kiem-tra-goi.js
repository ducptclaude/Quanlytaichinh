// Kiểm tra tự động: GÓI CHI PHÍ – HĐ ĐẦU VÀO – KHÓA THANH TOÁN (tạo 1 dự án thử, nhập đủ tình huống, so số Báo cáo)
// CHỈ chạy trên máy thử (localhost) vì có GHI dữ liệu. Chạy: node scripts/kiem-tra-goi.js http://localhost:3972 <tài khoản> <mật khẩu>
// Tình huống (đơn vị U = 1 triệu, VAT 0%):
//   Doanh thu: HĐ H1 1000 (+100 điều chỉnh) · HĐ H2 500 (quyết toán 480)
//   Gói TĐ1:   G1 thầu phụ 300 @H1 · G2 vật tư 200 @H2 · G3 nhân công 100 @H1 (đóng ở TĐ2)
//   HĐ đầu vào: TP1 gắn G1 ký 280 (+30) · TP2 phát sinh 50 @H1 · TP3 120 @H2 (QT 110, trả đủ)
//   Điều chỉnh nhóm thầu phụ +20 · chi phí lương 40 (không gắn HĐ)
// Kỳ vọng: CP TĐ1/2/3 = 760 / 740 / 730 · DT = 1500 / 1600 / 1580
//   Chi phí theo HĐ: H1 400 / 360 / 360 · H2 320 / 320 / 310 · không gắn HĐ 40 / 60 / 60
//   Khóa: TP2 trả đủ chưa QT -> KHÔNG khóa · TP3 trả đủ + đã QT -> khóa (thanh toán thêm bị chặn 423)
const [URL_, USER, PASS] = process.argv.slice(2);
if (!URL_ || !USER || !PASS) { console.log('Cách dùng: node scripts/kiem-tra-goi.js <URL máy thử> <tài khoản> <mật khẩu>'); process.exit(2); }
const BASE = URL_.replace(/\/$/, '');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.log('Chỉ chạy trên máy thử (localhost) – script này GHI dữ liệu.'); process.exit(2); }
const U = 1e6, NGAY = new Date().toISOString().slice(0, 10);
let cookie = '';
async function api(method, url, body, okStatus) {
  const r = await fetch(BASE + '/api' + url, { method, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: BASE, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  const j = await r.json().catch(() => null);
  if (okStatus) return { status: r.status, j };
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(j?.error || j)}`);
  return j;
}
let pass = 0, fail = 0;
const check = (cond, what, detail = '') => { if (cond) pass++; else { fail++; console.log(`  ✗ ${what}${detail ? ' — ' + detail : ''}`); } };
const eq = (a, b, what) => check(Math.abs(a - b) < 1, what, `được ${a / U}, cần ${b / U}`);

(async () => {
  await api('POST', '/auth/login', { username: USER, password: PASS });
  const ma = 'KT-GOI-' + Date.now().toString().slice(-6);
  const da = await api('POST', '/du-an', { ma_du_an: ma, ten_du_an: 'Kiểm tra gói chi phí', trang_thai: 'Đang thi công' });
  const id = da.id;
  console.log(`Dự án thử ${ma} (#${id})`);
  // ---- Doanh thu ----
  const H1 = (await api('POST', `/du-an/${id}/doanh-thu`, { loai: 'hd', ma_loai: 'HĐ', so_ma: 'H1', gia_tri: 1000 * U, vat: 0, ngay: NGAY })).id;
  const H2 = (await api('POST', `/du-an/${id}/doanh-thu`, { loai: 'hd', ma_loai: 'HĐ', so_ma: 'H2', gia_tri: 500 * U, vat: 0, ngay: NGAY })).id;
  await api('POST', '/dieu-chinh', { loai: 'dt', vb_id: H1, so_tien: 100 * U, ngay: NGAY, noi_dung: 'Tăng khối lượng' });
  await api('PUT', `/doanh-thu/${H2}/quyet-toan`, { ngay_qt: NGAY, dong: true, items: [{ id: H2, gt_qt: 480 * U }] });
  // ---- Gói TĐ1 + điều chỉnh nhóm ----
  const goi = async (nhom, so, hd, ten) => (await api('POST', `/du-an/${id}/du-tru`, { nhom, loai: 'ky', so_tien: so * U, vat: 0, noi_dung: ten, hd_cdt_id: hd, ngay: NGAY })).id;
  const G1 = await goi('thau_phu', 300, H1, 'G1 thầu phụ');
  await goi('vat_tu', 200, H2, 'G2 vật tư');
  const G3 = await goi('nhan_cong', 100, H1, 'G3 nhân công');
  // ---- HĐ đầu vào ----
  const tp = async (b) => (await api('POST', `/du-an/${id}/thau-phu`, b)).id;
  const TP1 = await tp({ so_ma: 'TP1', nhom: 'thau_phu', doi_tac: 'Nhà thầu A', goi_id: G1, hd: { gia_tri: 280 * U, vat: 0, ngay: NGAY } });
  const TP2 = await tp({ so_ma: 'TP2', nhom: 'thau_phu', doi_tac: 'Nhà thầu B', phat_sinh: true, hd_cdt_id: H1, hd: { gia_tri: 50 * U, vat: 0, ngay: NGAY } });
  const TP3 = await tp({ so_ma: 'TP3', nhom: 'thau_phu', doi_tac: 'Nhà thầu C', hd_cdt_id: H2, hd: { gia_tri: 120 * U, vat: 0, ngay: NGAY } });
  await api('PUT', `/du-tru/${G3}`, { tinh_trang: 'dong' });
  await api('POST', `/du-an/${id}/du-tru`, { nhom: 'thau_phu', loai: 'dc', so_tien: 20 * U, vat: 0, noi_dung: 'Điều chỉnh nhóm thầu phụ', ngay: NGAY });
  await api('POST', `/du-an/${id}/chi-phi`, { nhom: 'gt_luong', nhom_con: 'luong', noi_dung: 'Lương ban chỉ huy', gia_tri: 40 * U, vat: 0, ngay: NGAY });
  let cp = await api('GET', `/du-an/${id}/chi-phi`);
  const line = (tid) => cp.thau_phu.find((c) => c.id === tid).lines.find((l) => l.ma_loai === 'HĐ');
  await api('POST', '/dieu-chinh', { loai: 'tp', vb_id: line(TP1).id, so_tien: 30 * U, ngay: NGAY, noi_dung: 'Phát sinh TP1' });
  await api('PUT', `/tp-hd-pl/${line(TP3).id}`, { ma_loai: 'HĐ', gia_tri: 120 * U, vat: 0, gia_tri_qt: 110 * U, ngay: NGAY });
  // ---- Thanh toán ----
  await api('POST', `/thau-phu/${TP2}/thanh-toan`, { loai: 'dot', dot: 1, so_tien: 50 * U, ngay: NGAY });
  await api('POST', `/thau-phu/${TP3}/thanh-toan`, { loai: 'quyet_toan', dot: 1, so_tien: 110 * U, ngay: NGAY });

  // ---- Đối chiếu Báo cáo ----
  const bc = await api('GET', '/bao-cao');
  const d = bc.du_an.find((x) => x.id === id);
  const m = d.moc, v = 'gt';
  const dr = m.cp.dtru?.[v] || [0, 0, 0];
  const C = [m.cp.tp_goc[v] + m.cp.khac[v] + dr[0], m.cp.tp_ps[v] + m.cp.khac[v] + dr[1], m.cp.tp_qt[v] + m.cp.khac[v] + dr[2]];
  console.log('1) Tổng dự án');
  [760, 740, 730].forEach((x, i) => eq(C[i], x * U, `Chi phí TĐ${i + 1}`));
  [[m.dt.goc[v], 1500], [m.dt.ps[v], 1600], [m.dt.qt[v], 1580]].forEach(([a, b], i) => eq(a, b * U, `Doanh thu TĐ${i + 1}`));
  console.log('2) Chi phí theo từng HĐ chủ đầu tư');
  const hd = (so) => (d.hds || []).find((h) => h.so_ma === so);
  const cH = (so) => hd(so)?.cp_td?.[v] || [0, 0, 0];
  [[400, 360, 360], [320, 320, 310]].forEach((xs, j) => xs.forEach((x, i) => eq(cH(j ? 'H2' : 'H1')[i], x * U, `H${j + 1} chi phí TĐ${i + 1}`)));
  [40, 60, 60].forEach((x, i) => eq(C[i] - cH('H1')[i] - cH('H2')[i], x * U, `Phần không gắn HĐ TĐ${i + 1}`));
  console.log('3) Khóa HĐ đầu vào');
  cp = await api('GET', `/du-an/${id}/chi-phi`);
  const c2 = cp.thau_phu.find((c) => c.id === TP2), c3 = cp.thau_phu.find((c) => c.id === TP3);
  check(c2.khoa && !c2.khoa_so, 'TP2 trả đủ, chưa QT -> chưa khóa sổ', `khoa=${c2.khoa} khoa_so=${c2.khoa_so}`);
  check(c3.khoa_so, 'TP3 trả đủ + đã QT -> khóa sổ', `khoa_so=${c3.khoa_so}`);
  const r2 = await api('POST', `/thau-phu/${TP2}/thanh-toan`, { loai: 'dot', dot: 2, so_tien: 0, ngay: NGAY }, true);
  check(r2.status === 201, 'TP2 vẫn nhập thanh toán được', `mã ${r2.status}`);
  const r3 = await api('POST', `/thau-phu/${TP3}/thanh-toan`, { loai: 'dot', dot: 2, so_tien: 1 * U, ngay: NGAY }, true);
  check(r3.status === 423, 'TP3 đã khóa -> chặn thanh toán thêm', `mã ${r3.status}`);
  console.log(`\nKẾT QUẢ: ${pass} kiểm tra ĐẠT, ${fail} LỖI`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('Dừng vì lỗi:', e.message); process.exit(1); });
