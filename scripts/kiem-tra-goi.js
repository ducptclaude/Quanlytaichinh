// Kiểm tra tự động: GÓI CHI PHÍ – HĐ ĐẦU VÀO – KHÓA THANH TOÁN (tạo 1 dự án thử, nhập đủ tình huống, so số Báo cáo)
// CHỈ chạy trên máy thử (localhost) vì có GHI dữ liệu. Chạy: node scripts/kiem-tra-goi.js http://localhost:3972 <tài khoản> <mật khẩu>
// Tình huống (đơn vị U = 1 triệu, VAT 0%):
//   Doanh thu: HĐ H1 1000 (+100 điều chỉnh) · HĐ H2 500 (quyết toán 480)
//   Gói TĐ1:   G1 thầu phụ 300 @H1 · G2 vật tư 200 @H2 · G3 nhân công 100 @H1 (đóng ở TĐ2)
//   HĐ đầu vào: TP1 gắn G1 ký 280 (+30) · TP2 phát sinh 50 @H1 · TP3 120 @H2 (QT 110, trả đủ)
//   Điều chỉnh nhóm thầu phụ +20 · chi phí lương 40 (không gắn HĐ)
//   Mua lẻ vật tư gắn gói G2: 50 rồi thêm 180 (vượt gói) -> TĐ1 giữ = gói; TĐ2/3 = mua lẻ + phần gói chưa mua hết
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
  const G2 = await goi('vat_tu', 200, H2, 'G2 vật tư');
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

  // ---- Đối chiếu Báo cáo (dùng lại sau mỗi bước) ----
  const doiChieu = async (ten, eC, eH1, eH2, eR, kiemDt = false) => {
    console.log(ten);
    const bc = await api('GET', '/bao-cao');
    const d = bc.du_an.find((x) => x.id === id);
    const m = d.moc, v = 'gt';
    const dr = m.cp.dtru?.[v] || [0, 0, 0];
    const C = [m.cp.tp_goc[v] + m.cp.khac[v] + dr[0], m.cp.tp_ps[v] + m.cp.khac[v] + dr[1], m.cp.tp_qt[v] + m.cp.khac[v] + dr[2]];
    eC.forEach((x, i) => eq(C[i], x * U, `Chi phí dự án TĐ${i + 1}`));
    if (kiemDt) [[m.dt.goc[v], 1500], [m.dt.ps[v], 1600], [m.dt.qt[v], 1580]].forEach(([a, b], i) => eq(a, b * U, `Doanh thu TĐ${i + 1}`));
    const cH = (so) => (d.hds || []).find((h) => h.so_ma === so)?.cp_td?.[v] || [0, 0, 0];
    [eH1, eH2].forEach((xs, k) => xs.forEach((x, i) => eq(cH(k ? 'H2' : 'H1')[i], x * U, `H${k + 1} chi phí TĐ${i + 1}`)));
    eR.forEach((x, i) => eq(C[i] - cH('H1')[i] - cH('H2')[i], x * U, `Phần không gắn HĐ TĐ${i + 1}`));
  };
  await doiChieu('1) Gói – HĐ đầu vào – điều chỉnh – quyết toán', [760, 740, 730], [400, 360, 360], [320, 320, 310], [40, 60, 60], true);
  // ---- V27.12: mua lẻ gắn gói G2 (vật tư 200 @H2) ----
  const le = (so, goiId, nhom = 'vat_tu', con = 'chinh') => api('POST', `/du-an/${id}/chi-phi`, { nhom, nhom_con: con, noi_dung: 'Mua lẻ thép', doi_tac: 'Cửa hàng', gia_tri: so * U, vat: 0, ngay: NGAY, goi_id: goiId }, true);
  check((await le(50, G2)).status === 201, 'Gắn mua lẻ 50 vào gói G2');
  await doiChieu('2) Mua lẻ 50 gắn G2: TĐ1 vẫn = gói, TĐ2/3 = 50 + phần gói còn 150', [760, 740, 730], [400, 360, 360], [320, 320, 310], [40, 60, 60]);
  check((await le(180, G2)).status === 201, 'Gắn mua lẻ 180 vào gói G2');
  await doiChieu('3) Mua lẻ vượt gói (230 > 200): TĐ2/3 = mua lẻ thực 230', [760, 770, 760], [400, 360, 360], [320, 350, 340], [40, 60, 60]);
  const sai = await le(10, G2, 'nhan_cong', 'giao_khoan');
  check(sai.status === 400, 'Chặn gắn mua lẻ khác nhóm với gói', `mã ${sai.status}`);
  const dong = await le(10, G3, 'nhan_cong', 'giao_khoan');
  check(dong.status === 400, 'Chặn gắn mua lẻ vào gói đã đóng', `mã ${dong.status}`);
  console.log('4) Khóa HĐ đầu vào');
  cp = await api('GET', `/du-an/${id}/chi-phi`);
  const c2 = cp.thau_phu.find((c) => c.id === TP2), c3 = cp.thau_phu.find((c) => c.id === TP3);
  check(c2.khoa && !c2.khoa_so, 'TP2 trả đủ, chưa QT -> chưa khóa sổ', `khoa=${c2.khoa} khoa_so=${c2.khoa_so}`);
  check(c3.khoa_so, 'TP3 trả đủ + đã QT -> khóa sổ', `khoa_so=${c3.khoa_so}`);
  const r2 = await api('POST', `/thau-phu/${TP2}/thanh-toan`, { loai: 'dot', dot: 2, so_tien: 0, ngay: NGAY }, true);
  check(r2.status === 201, 'TP2 vẫn nhập thanh toán được', `mã ${r2.status}`);
  const r3 = await api('POST', `/thau-phu/${TP3}/thanh-toan`, { loai: 'dot', dot: 2, so_tien: 1 * U, ngay: NGAY }, true);
  check(r3.status === 423, 'TP3 đã khóa -> chặn thanh toán thêm', `mã ${r3.status}`);
  // ---- V10.16: dự trù % gián tiếp / tài chính (× doanh thu TĐ1, TĐ2); TĐ3 = thực chi ----
  const thucChi = async () => (await api('GET', '/bao-cao')).du_an.find((x) => x.id === id).tien_thuc;
  const tc0 = JSON.stringify(await thucChi());
  await api('PUT', `/du-an/${id}/ty-le`, { pt_gt1: '10', pt_gt2: '', pt_tc1: '5', pt_tc2: '' });
  await doiChieu('5) Gián tiếp 10%, tài chính 5% DT (TĐ2 theo TĐ1): TĐ1 = 760 − lương 40 + 150 + 75 · TĐ2 = 770 − 40 + 160 + 80 · TĐ3 = thực chi', [945, 970, 760], [400, 360, 360], [320, 350, 340], [225, 260, 60]);
  check(JSON.stringify(await thucChi()) === tc0, 'Thực chi (mục II) không đổi khi nhập %');
  await api('PUT', `/du-an/${id}/ty-le`, { pt_gt2: '12' });
  await doiChieu('6) TĐ2 gián tiếp 12% → 192', [945, 1002, 760], [400, 360, 360], [320, 350, 340], [225, 292, 60]);
  const sai2 = await api('PUT', `/du-an/${id}/ty-le`, { pt_gt1: '120' }, true);
  check(sai2.status === 400, 'Chặn tỷ lệ > 100%', `mã ${sai2.status}`);
  await api('PUT', `/du-an/${id}/ty-le`, { pt_gt1: '', pt_gt2: '', pt_tc1: '', pt_tc2: '' });
  await doiChieu('7) Xóa % → về cách tính cũ', [760, 770, 760], [400, 360, 360], [320, 350, 340], [40, 60, 60]);
  // ---- V04.17: khoản gián tiếp / tài chính nhập như thầu phụ: TĐ1 dự trù · TĐ2 điều chỉnh theo khoản · TĐ3 = thực chi / số chốt ----
  const K1 = (await api('POST', `/du-an/${id}/du-tru`, { nhom: 'gt_luong', loai: 'ky', so_tien: 100 * U, vat: 0, noi_dung: 'Lương BCH', ngay: NGAY })).id;
  await doiChieu('8) Khoản Lương 100 (TĐ1): TĐ1, TĐ2 +100 · TĐ3 = thực chi (không đổi)', [860, 870, 760], [400, 360, 360], [320, 350, 340], [140, 160, 60]);
  check((await le(30, K1, 'gt_luong', 'luong')).status === 201, 'Ghi chi lương 30 gắn khoản Lương');
  await doiChieu('9) Đã chi 30: TĐ1 = 100 · TĐ2 = 30 + còn 70 · TĐ3 = thực chi +30', [860, 870, 790], [400, 360, 360], [320, 350, 340], [140, 160, 90]);
  check((await api('POST', `/du-an/${id}/du-tru`, { nhom: 'gt_luong', loai: 'dc', so_tien: 20 * U, vat: 0, noi_dung: 'Bảng lương thật', ngay: NGAY, goi_ref: K1 }, true)).status === 201, 'Điều chỉnh +20 của riêng khoản Lương');
  await doiChieu('10) Điều chỉnh khoản +20: TĐ2 = 30 + (120 − 30)', [860, 890, 790], [400, 360, 360], [320, 350, 340], [140, 180, 90]);
  const sai3 = await api('POST', `/du-an/${id}/du-tru`, { nhom: 'gt_luong', loai: 'dc', so_tien: 5 * U, vat: 0, noi_dung: 'sai', ngay: NGAY, goi_ref: G2 }, true);
  check(sai3.status === 400, 'Chặn điều chỉnh gắn khoản khác nhóm', `mã ${sai3.status}`);
  await le(100, K1, 'gt_luong', 'luong');
  await doiChieu('11) Chi vượt (130 > 120): TĐ2 = thực chi 130 · TĐ3 = 130', [860, 900, 890], [400, 360, 360], [320, 350, 340], [140, 190, 190]);
  check((await api('PUT', `/du-tru/${K1}`, { gt_chot: 150 * U }, true)).status === 200, 'Chốt số khoản Lương 150 (TĐ3)');
  await doiChieu('12) Chốt 150 (đã chi 130, còn phải trả 20): TĐ3 = 150', [860, 900, 910], [400, 360, 360], [320, 350, 340], [140, 190, 210]);
  check((await api('PUT', `/du-tru/${G2}`, { gt_chot: 1 * U }, true)).status === 400, 'Chặn chốt số cho gói chi phí trực tiếp');
  await api('PUT', `/du-an/${id}/ty-le`, { pt_gt1: '10', pt_tc1: '5' });
  await doiChieu('13) V16.17: gián tiếp đã có khoản → mặc định theo khoản (bỏ qua 10%); tài chính chưa có khoản → 5%', [935, 980, 910], [400, 360, 360], [320, 350, 340], [215, 270, 210]);
  await api('PUT', `/du-an/${id}/ty-le`, { tien_gt1: String(200 * U), ct_gt1: '200tr' });
  await doiChieu('13b) Nhập số 200 nhưng vẫn chọn "theo khoản" → không đổi', [935, 980, 910], [400, 360, 360], [320, 350, 340], [215, 270, 210]);
  await api('PUT', `/du-an/${id}/ty-le`, { cach_gt: 'nhap' });
  await doiChieu('13c) Chọn "Số nhập" → gián tiếp TĐ1, TĐ2 = 200 (TĐ2 trống = theo TĐ1)', [995, 1010, 910], [400, 360, 360], [320, 350, 340], [275, 300, 210]);
  await api('PUT', `/du-an/${id}/ty-le`, { cach_gt: 'khoan' });
  await doiChieu('13d) Chọn lại "Theo khoản"', [935, 980, 910], [400, 360, 360], [320, 350, 340], [215, 270, 210]);
  const sai4 = await api('PUT', `/du-an/${id}/ty-le`, { tien_tc1: '-5' }, true);
  check(sai4.status === 400, 'Chặn số tiền dự trù âm', `mã ${sai4.status}`);
  await api('PUT', `/du-an/${id}/ty-le`, { pt_gt1: '', pt_tc1: '', tien_gt1: '', tien_tc1: '', ct_gt1: '', cach_gt: '' });
  await api('PUT', `/du-tru/${K1}`, { gt_chot: '' });
  await doiChieu('14) Bỏ % và bỏ chốt → TĐ3 về thực chi', [860, 900, 890], [400, 360, 360], [320, 350, 340], [140, 190, 190]);
  // ---- V01.26: bảng DT-CP TĐ1 (dòng dtcp) · trình / duyệt / khoá TĐ1 (người lập ≠ người duyệt) ----
  const D1 = (await api('POST', `/du-an/${id}/du-tru`, { nhom: 'may_moc', loai: 'ky', dtcp: true, ct_nhap: '31tr', noi_dung: 'DT-CP · Máy móc thiết bị', so_tien: 31 * U, vat: 0, ngay: NGAY })).id;
  await doiChieu('15) Bảng DT-CP: máy móc nhập 31tr → TĐ1, TĐ2, TĐ3 +31 (dự trù TĐ1 của nhóm)', [891, 931, 921], [400, 360, 360], [320, 350, 340], [171, 221, 221]);
  check((await api('GET', `/du-an/${id}/chi-phi`)).du_tru.find((r) => r.id === D1)?.ct_nhap === '31tr', 'Lưu công thức đã gõ của dòng DT-CP');
  check((await api('POST', `/du-an/${id}/td1`, { viec: 'trinh' }, true)).status === 200, 'Trình duyệt TĐ1');
  check((await api('POST', `/du-an/${id}/du-tru`, { nhom: 'khac', loai: 'ky', so_tien: 5 * U, vat: 0, noi_dung: 'gói mới', ngay: NGAY }, true)).status === 423, 'Đã trình: chặn thêm dự trù TĐ1');
  check((await api('PUT', `/du-tru/${D1}`, { so_tien: 40 * U, noi_dung: 'x', vat: 0, ngay: NGAY }, true)).status === 423, 'Đã trình: chặn sửa số dự trù TĐ1');
  check((await api('PUT', `/du-an/${id}/ty-le`, { pt_gt1: '5' }, true)).status === 423, 'Đã trình: chặn sửa dự trù nhanh TĐ1');
  const PS = await api('POST', `/du-an/${id}/du-tru`, { nhom: 'gt_luong', loai: 'ky', so_tien: 0, vat: 0, noi_dung: 'Lương phát sinh', ngay: NGAY }, true);
  check(PS.status === 201, 'Đã trình: vẫn thêm được khoản phát sinh TĐ2 (TĐ1 = 0)', `mã ${PS.status}`);
  check((await api('POST', `/du-an/${id}/td1`, { viec: 'duyet' }, true)).status === 400, 'Người lập không tự duyệt TĐ1');
  // người duyệt khác (Lãnh đạo) – đăng nhập phiên riêng
  const tk = 'ktduyet' + Date.now().toString().slice(-5), mk = 'Kt@' + Date.now().toString().slice(-6) + 'a';
  const tao = await api('POST', '/users', { username: tk, full_name: 'Kiểm thử duyệt', role: 'lanh_dao', password: mk, active: true }, true);
  if (tao.status === 201 || tao.status === 200) {
    const c0 = cookie; cookie = ''; await api('POST', '/auth/login', { username: tk, password: mk });
    check((await api('POST', `/du-an/${id}/td1`, { viec: 'duyet' }, true)).status === 200, 'Lãnh đạo khác duyệt TĐ1 → khoá');
    cookie = c0;
    const da = (await api('GET', `/du-an/${id}/chi-phi`)).du_an;
    check(da.td1_tt === 'duyet' && JSON.parse(da.td1_so || '{}').cp === 891 * U, 'Lưu giá cơ sở TĐ1 (CP 891)', `${da.td1_tt} ${da.td1_so}`);
    check((await api('PUT', `/du-tru/${D1}`, { so_tien: 40 * U, noi_dung: 'x', vat: 0, ngay: NGAY }, true)).status === 423, 'Đã duyệt: khoá sửa dự trù TĐ1');
  } else check(false, 'Tạo tài khoản duyệt thử', `mã ${tao.status} ${JSON.stringify(tao.j)}`);
  console.log(`\nKẾT QUẢ: ${pass} kiểm tra ĐẠT, ${fail} LỖI`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('Dừng vì lỗi:', e.message); process.exit(1); });
