// Kiểm tra quy trình duyệt mới: chờ duyệt không tính tổng, duyệt mới ghi, sửa đã duyệt giữ số cũ, tự hủy, xóa đã duyệt cần passcode
const B = 'http://127.0.0.1:3002';
const mk = () => { let ck = ''; const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
  const J = async (u, m = 'GET', b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b && JSON.stringify(b) }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } return { s: r.status, j }; };
  const login = async (u, p) => { const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: H(), body: JSON.stringify({ username: u, password: p }) }); ck = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; '); return r.status; };
  return { J, login }; };
let ok = 0, fail = 0; const chk = (ten, dk, x = '') => { if (dk) ok++; else fail++; console.log((dk ? '  ĐẠT ' : '  LỖI ') + ten + (dk ? '' : ' → ' + JSON.stringify(x).slice(0, 300))); };
(async () => {
  const A = mk(), Q = mk(), K = mk();
  await A.login('admin', process.env.BKS_PASS);
  for (const [u, role] of [['qs1', 'qs'], ['kt1', 'ke_toan']]) await A.J('/api/users', 'POST', { username: u, password: 'Test@12345', password2: 'Test@12345', full_name: u.toUpperCase(), role });
  chk('đăng nhập QS', (await Q.login('qs1', 'Test@12345')) === 200); chk('đăng nhập KT', (await K.login('kt1', 'Test@12345')) === 200);
  await A.J('/api/settings/passcode', 'PUT', { current_password: process.env.BKS_PASS, passcode: process.env.BKS_PC, passcode2: process.env.BKS_PC });
  const pr = (await A.J('/api/du-an', 'POST', { ma_du_an: 'DY-01', ten_du_an: 'Thử duyệt', trang_thai: 'Đang thi công' })).j; const pid = pr.id;
  const tong = async () => { const d = (await A.J('/api/bao-cao')).j.du_an.find((x) => x.id === pid); return { tv: d.tien_ve, cp: d.thuc_hien?.chi_phi, tp: d.moc.cp.tp_ps.gt, ncp: (await A.J(`/api/du-an/${pid}/chi-phi`)).j.items.length }; };
  const t0 = await tong();
  // 1. KT thêm chi phí -> chờ duyệt, không tính tổng
  const c1 = await K.J(`/api/du-an/${pid}/chi-phi`, 'POST', { nhom: 'vat_tu', nhom_con: 'chinh', noi_dung: 'Thép', ngay: '2026-11-01', gia_tri: '100000000', vat: 10 });
  chk('KT thêm chi phí -> 202 chờ duyệt', c1.s === 202 && c1.j.cho_duyet, c1);
  chk('chưa duyệt: không có dòng chi phí, tổng không đổi', (await tong()).ncp === t0.ncp, await tong());
  // 2. dữ liệu sai báo ngay
  const c2 = await K.J(`/api/du-an/${pid}/chi-phi`, 'POST', { nhom: 'vat_tu', nhom_con: 'chinh', noi_dung: '', gia_tri: 'abc' });
  chk('dữ liệu sai bị chặn ngay (400)', c2.s === 400, c2);
  // 3. QS không được nhập tiền (quyền)
  chk('QS gửi chi phí bị chặn quyền (403)', (await Q.J(`/api/du-an/${pid}/chi-phi`, 'POST', { nhom: 'vat_tu', nhom_con: 'chinh', noi_dung: 'x', gia_tri: '1' })).s === 403);
  // 4. Mục chờ duyệt theo dự án
  const ds = (await K.J(`/api/duyet?tt=cho&du_an=${pid}`)).j;
  chk('mục Chờ duyệt dự án có 1 hồ sơ, có số tiền, không lộ yêu cầu gốc', ds.tong === 1 && ds.rows[0].so_tien === 100000000 && !('yeu_cau' in ds.rows[0]), ds);
  // 5. QS không duyệt được
  chk('QS không duyệt được (403)', (await Q.J('/api/duyet/xu-ly', 'POST', { ids: [c1.j.id], hanh_dong: 'duyet' })).s === 403);
  // 6. Admin duyệt -> ghi vào số liệu
  const d1 = await A.J('/api/duyet/xu-ly', 'POST', { ids: [c1.j.id], hanh_dong: 'duyet' });
  const items = (await A.J(`/api/du-an/${pid}/chi-phi`)).j.items;
  chk('duyệt -> dòng chi phí được ghi', d1.j.so === 1 && items.length === t0.ncp + 1, d1);
  const cid = items.find((x) => x.noi_dung === 'Thép')?.id;
  const hs1 = (await A.J('/api/duyet?tt=duyet')).j.rows.find((x) => x.id === c1.j.id);
  chk('hồ sơ đã duyệt gắn đúng dòng số liệu', hs1 && hs1.ban_ghi_id === cid, hs1);
  // 7. KT sửa dòng đã duyệt -> chờ; số cũ vẫn giữ
  const s1 = await K.J(`/api/chi-phi/${cid}`, 'PUT', { nhom: 'vat_tu', nhom_con: 'chinh', noi_dung: 'Thép', ngay: '2026-11-01', gia_tri: '150000000', vat: 10 });
  const g1 = (await A.J(`/api/du-an/${pid}/chi-phi`)).j.items.find((x) => x.id === cid).gia_tri;
  chk('sửa đã duyệt -> chờ, số cũ (100tr) vẫn tính', s1.s === 202 && Number(g1) === 100000000, { s1, g1 });
  // 8. KT tự hủy bản sửa (nhập sai) -> không cần duyệt
  const h1 = await K.J('/api/duyet/huy', 'POST', { ids: [s1.j.id] });
  chk('người nhập tự hủy hồ sơ chưa duyệt', h1.j.so === 1, h1);
  // 9. người khác không hủy được hồ sơ của KT
  const s2 = await K.J(`/api/chi-phi/${cid}`, 'PUT', { nhom: 'vat_tu', nhom_con: 'chinh', noi_dung: 'Thép', ngay: '2026-11-01', gia_tri: '120000000', vat: 10 });
  chk('QS không hủy được hồ sơ của KT', (await Q.J('/api/duyet/huy', 'POST', { ids: [s2.j.id] })).s === 403);
  await A.J('/api/duyet/xu-ly', 'POST', { ids: [s2.j.id], hanh_dong: 'duyet' });
  const g2 = (await A.J(`/api/du-an/${pid}/chi-phi`)).j.items.find((x) => x.id === cid).gia_tri;
  chk('duyệt bản sửa -> số mới 120tr', Number(g2) === 120000000, g2);
  // 10. Từ chối: không ghi gì
  const x1 = await K.J(`/api/chi-phi/${cid}`, 'DELETE', {});
  chk('xóa từ chối thiếu lý do bị chặn', (await A.J('/api/duyet/xu-ly', 'POST', { ids: [x1.j.id], hanh_dong: 'tu_choi' })).s === 400);
  await A.J('/api/duyet/xu-ly', 'POST', { ids: [x1.j.id], hanh_dong: 'tu_choi', ly_do: 'Không đúng' });
  chk('từ chối xóa -> dòng vẫn còn', (await A.J(`/api/du-an/${pid}/chi-phi`)).j.items.some((x) => x.id === cid));
  // 11. QS thêm HĐ thầu phụ (chờ), xóa HĐ thầu phụ đã duyệt cần Passcode lúc gửi
  const tp = await Q.J(`/api/du-an/${pid}/thau-phu`, 'POST', { nhom: 'thau_phu', so_ma: 'TP-Q1', doi_tac: 'Q', hd: { ngay: '2026-11-02', gia_tri: '50000000', vat: 10, td: 2 } });
  chk('QS thêm HĐ thầu phụ -> chờ, chưa vào TĐ2', tp.s === 202 && (await tong()).tp === t0.tp, await tong());
  const dtp = await A.J('/api/duyet/xu-ly', 'POST', { ids: [tp.j.id], hanh_dong: 'duyet' });
  chk('duyệt HĐ thầu phụ -> vào TĐ2 (+50tr)', (await tong()).tp === t0.tp + 50000000, dtp);
  const tpid = (await A.J(`/api/du-an/${pid}/chi-phi`)).j.thau_phu.find((x) => x.so_ma === 'TP-Q1').id;
  chk('xóa HĐ thầu phụ sai Passcode bị chặn ngay', (await Q.J(`/api/thau-phu/${tpid}`, 'DELETE', { passcode: '00000000' })).s === 403);
  const xtp = await Q.J(`/api/thau-phu/${tpid}`, 'DELETE', { passcode: process.env.BKS_PC });
  chk('xóa đúng Passcode -> chờ duyệt, HĐ vẫn còn', xtp.s === 202 && (await tong()).tp === t0.tp + 50000000, xtp);
  await A.J('/api/duyet/xu-ly', 'POST', { ids: [xtp.j.id], hanh_dong: 'duyet' });
  chk('duyệt xóa -> HĐ thầu phụ bị xóa', (await tong()).tp === t0.tp, await tong());
  // 12. Lỗi lúc duyệt (bản ghi đã mất) -> hồ sơ vẫn chờ, báo lỗi
  const s3 = await K.J(`/api/chi-phi/${cid}`, 'PUT', { nhom: 'vat_tu', nhom_con: 'chinh', noi_dung: 'Thép', ngay: '2026-11-01', gia_tri: '1', vat: 10 });
  await A.J(`/api/chi-phi/${cid}`, 'DELETE', {});
  const d3 = await A.J('/api/duyet/xu-ly', 'POST', { ids: [s3.j.id], hanh_dong: 'duyet' });
  chk('duyệt lỗi -> báo lỗi, hồ sơ vẫn chờ', d3.j.so === 0 && d3.j.loi.length === 1 && (await A.J('/api/duyet?tt=cho')).j.rows.some((x) => x.id === s3.j.id && x.loi), d3);
  // 13. Chốt TĐ, số dư đầu kỳ (KT)
  const sd = await K.J('/api/so-du-dau-ky', 'PUT', { du_an_id: 0, so_tien: 5000000 });
  chk('KT nhập số dư đầu kỳ -> chờ', sd.s === 202, sd);
  chk('số dư chưa đổi khi chưa duyệt', !(await A.J('/api/bao-cao')).j.so_du_dau_ky?.chung);
  await A.J('/api/duyet/xu-ly', 'POST', { ids: [sd.j.id], hanh_dong: 'duyet' });
  chk('duyệt -> số dư = 5tr', (await A.J('/api/bao-cao')).j.so_du_dau_ky?.chung === 5000000, (await A.J('/api/bao-cao')).j.so_du_dau_ky);
  // 14. Admin nhập -> ghi ngay
  const ad = await A.J(`/api/du-an/${pid}/chi-phi`, 'POST', { nhom: 'vat_tu', nhom_con: 'chinh', noi_dung: 'Cát', ngay: '2026-11-01', gia_tri: '1000000', vat: 0 });
  chk('Quản trị nhập -> ghi ngay (201)', ad.s === 201, ad);
  // 15. Nhật ký
  const nk = (await A.J('/api/nhat-ky?limit=200')).j; const L = (nk.items || nk.rows || nk).map((x) => x.hanh_dong + '|' + x.username);
  chk('nhật ký có Gửi duyệt / Duyệt / Từ chối / Hủy gửi duyệt', ['Gửi duyệt|kt1', 'Duyệt|admin', 'Từ chối|admin', 'Hủy gửi duyệt|kt1'].every((k) => L.includes(k)), L.slice(0, 30));
  chk('ghi khi duyệt mang tên người nhập (Thêm|kt1)', L.includes('Thêm|kt1'), L.slice(0, 30));
  console.log(`\nKẾT QUẢ: ${ok} ĐẠT, ${fail} LỖI`);
})();
