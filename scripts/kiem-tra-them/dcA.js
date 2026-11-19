// Đợt A: mỗi HĐ / PL có 3 TĐ độc lập
const B = 'http://127.0.0.1:3002'; let ck = ''; const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
const J = async (u, m = 'GET', b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b && JSON.stringify(b) }); const t = await r.text(); if (r.status >= 300) console.log('!!', m, u, r.status, t.slice(0, 200)); try { return JSON.parse(t); } catch { return t; } };
let ok = 0, bad = 0; const chk = (t, a, e) => { const d = JSON.stringify(a) === JSON.stringify(e); d ? ok++ : bad++; console.log((d ? '  ĐẠT ' : '  LỖI ') + t + ' = ' + JSON.stringify(a) + (d ? '' : ' (kỳ vọng ' + JSON.stringify(e) + ')')); };
const tr = (x) => Math.round(x / 1e6);
(async () => {
  const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: H(), body: JSON.stringify({ username: 'admin', password: process.env.BKS_PASS }) }); ck = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const pid = (await J('/api/du-an', 'POST', { ma_du_an: 'DA-A', ten_du_an: 'Thử Đợt A', trang_thai: 'Đang thi công' })).id;
  const M = async () => ((await J('/api/bao-cao')).du_an.find((x) => x.id === pid));
  const add = (b) => J(`/api/du-an/${pid}/doanh-thu`, 'POST', { loai: 'hd', vat: 10, ...b });
  // HĐ A ký 1.000 · PL01 của A ký 200 · HĐ B ký 500
  const A = (await add({ ma_loai: 'HĐ', so_ma: 'A', ngay: '2026-01-01', gia_tri: '1000000000' })).id;
  const P1 = (await add({ ma_loai: 'PL01', so_ma: 'A', ngay: '2026-03-01', gia_tri: '200000000' })).id;
  const Bh = (await add({ ma_loai: 'HĐ', so_ma: 'B', ngay: '2026-02-01', gia_tri: '500000000' })).id;
  let d = await M(); console.log('DOANH THU (triệu) – chỉ ký');
  chk('TĐ1 = 1.000 + 200 + 500', tr(d.moc.dt.goc.gt), 1700); chk('TĐ2 = TĐ1', tr(d.moc.dt.ps.gt), 1700); chk('TĐ3 = TĐ2', tr(d.moc.dt.qt.gt), 1700);
  chk('tách HĐ / PL ở TĐ1', d.moc.chia.hd.map(tr).concat(d.moc.chia.pl.map(tr)), [1500, 1500, 1500, 200, 200, 200]);
  // Đợt điều chỉnh: A +120, A −30, PL01 +50
  const d1 = (await J('/api/dieu-chinh', 'POST', { loai: 'dt', vb_id: A, ngay: '2026-04-01', noi_dung: 'Phát sinh móng', so_tien: '120000000' })).id;
  await J('/api/dieu-chinh', 'POST', { loai: 'dt', vb_id: A, ngay: '2026-05-01', noi_dung: 'Giảm hạng mục', so_tien: '-30000000' });
  await J('/api/dieu-chinh', 'POST', { loai: 'dt', vb_id: P1, ngay: '2026-06-01', so_tien: '50000000' });
  d = await M(); console.log('Sau 3 đợt điều chỉnh');
  chk('TĐ1 không đổi', tr(d.moc.dt.goc.gt), 1700); chk('TĐ2 = 1.700 + 120 − 30 + 50', tr(d.moc.dt.ps.gt), 1840); chk('TĐ3 = TĐ2 (chưa QT)', tr(d.moc.dt.qt.gt), 1840);
  chk('mục IV: điều chỉnh HĐ / PL01', Object.fromEntries(d.moc.dt.pl.map((x) => [x.ma, tr(x.gt)])), { HĐ: 90, PL01: 50 });
  const rv = (await J(`/api/du-an/${pid}/doanh-thu`)).items.find((x) => x.id === A);
  chk('dòng A: giá trị ký / hiện hành / số đợt', [tr(rv.gia_tri_ky), tr(rv.gia_tri), rv.dot.length], [1000, 1090, 2]);
  await J(`/api/dieu-chinh/${d1}`, 'PUT', { ngay: '2026-04-01', noi_dung: 'Phát sinh móng', so_tien: '100000000' });
  d = await M(); chk('sửa đợt +120 -> +100: TĐ2', tr(d.moc.dt.ps.gt), 1820);
  // Quyết toán HĐ A: A = 1.050, PL01 chưa có số -> = TĐ2 (250) + lưu ý; đóng
  await J(`/api/doanh-thu/${A}/quyet-toan`, 'PUT', { ngay_qt: '2026-10-01', dong: true, items: [{ id: A, gt_qt: '1050000000' }, { id: P1, gt_qt: '' }] }); // thiếu PL01 -> không chốt
  await J(`/api/doanh-thu/${A}/quyet-toan`, 'PUT', { ngay_qt: '2026-10-01', dong: true, items: [{ id: A, gt_qt: '1050000000' }, { id: P1, gt_qt: '250000000' }] });
  d = await M(); console.log('Quyết toán HĐ A');
  chk('TĐ3 = A 1.050 + PL01 250 + B 500', tr(d.moc.dt.qt.gt), 1800); chk('chốt đủ số: không còn văn bản thiếu QT', d.moc.qt_thieu, 0);
  const hA = d.hds.find((h) => h.so_ma === 'A'); chk('HĐ A đã QT, không tạm tính', [hA.da_qt, hA.tam_tinh], [true, false]);
  chk('tách HĐ / PL ở TĐ3', [tr(d.moc.chia.hd[2]), tr(d.moc.chia.pl[2])], [1550, 250]);
  const items = (await J(`/api/du-an/${pid}/doanh-thu`)).items; chk('nhãn tạm tính: A, PL01 hết; B còn', items.filter((x) => x.loai === 'hd').map((x) => `${x.so_hieu}:${x.tam_tinh}`).sort(), ['HĐ A:false', 'HĐ B:true', 'PL01 A:false']);
  // HĐ đầu vào
  console.log('HĐ ĐẦU VÀO (triệu)');
  const T1 = (await J(`/api/du-an/${pid}/thau-phu`, 'POST', { nhom: 'thau_phu', so_ma: 'T1', doi_tac: 'X', hd: { ngay: '2026-01-05', gia_tri: '600000000', vat: 10 } })).id;
  const L1 = (await J(`/api/du-an/${pid}/chi-phi`)).thau_phu.find((c) => c.so_ma === 'T1').lines[0].id;
  await J(`/api/thau-phu/${T1}/hd-pl`, 'POST', { ma_loai: 'PL01', ngay: '2026-03-02', gia_tri: '100000000', vat: 10 });
  await J('/api/dieu-chinh', 'POST', { loai: 'tp', vb_id: L1, ngay: '2026-04-02', so_tien: '40000000' });
  d = await M();
  chk('TĐ1 = 600 + 100', tr(d.moc.cp.tp_goc.gt), 700); chk('TĐ2 = 700 + 40', tr(d.moc.cp.tp_ps.gt), 740); chk('TĐ3 = TĐ2 (chưa QT)', tr(d.moc.cp.tp_qt.gt), 740);
  const c = (await J(`/api/du-an/${pid}/chi-phi`)).thau_phu.find((x) => x.so_ma === 'T1');
  chk('HĐ T1: giá trị HĐ hiện hành 740 (sau VAT 814)', [tr(c.hd_gia_tri), tr(c.hd_sau_vat)], [740, 814]);
  chk('tách HĐ / PL đầu vào', [d.moc.cp.tp_chia.hd.map(tr), d.moc.cp.tp_chia.pl.map(tr)], [[600, 640, 640], [100, 100, 100]]);
  // duyệt: QS gửi đợt -> chờ
  await J('/api/users', 'POST', { username: 'qsA', password: 'Test@12345', password2: 'Test@12345', full_name: 'QSA', role: 'qs' }).catch(() => {});
  const ckA = ck; const r2 = await fetch(B + '/api/auth/login', { method: 'POST', headers: H(), body: JSON.stringify({ username: 'qsA', password: 'Test@12345' }) }); ck = r2.headers.getSetCookie().map((x) => x.split(';')[0]).join('; ');
  const g = await fetch(B + '/api/dieu-chinh', { method: 'POST', headers: H(), body: JSON.stringify({ loai: 'dt', vb_id: Bh, ngay: '2026-07-01', so_tien: '10000000' }) });
  chk('QS gửi đợt điều chỉnh -> chờ duyệt', g.status, 202);
  ck = ckA; d = await M(); chk('chưa duyệt: TĐ2 không đổi', tr(d.moc.dt.ps.gt), 1820);
  console.log(`\nKẾT QUẢ: ${ok} ĐẠT, ${bad} LỖI`);
})();
