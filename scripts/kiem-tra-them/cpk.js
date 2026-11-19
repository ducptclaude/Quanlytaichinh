// Chi phí khác (không gắn HĐ) nhập từ hộp HĐ đầu vào
const B = 'http://127.0.0.1:3002'; let ck = ''; const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
const J = async (u, m = 'GET', b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b && JSON.stringify(b) }); const t = await r.text(); let o; try { o = JSON.parse(t); } catch { o = t; } return { s: r.status, o }; };
let ok = 0, bad = 0; const chk = (t, a, e) => { const d = JSON.stringify(a) === JSON.stringify(e); d ? ok++ : bad++; console.log((d ? '  ĐẠT ' : '  LỖI ') + t + ' = ' + JSON.stringify(a) + (d ? '' : ' (kỳ vọng ' + JSON.stringify(e) + ')')); };
(async () => {
  const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: H(), body: JSON.stringify({ username: 'admin', password: process.env.BKS_PASS }) }); ck = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const pid = (await J('/api/du-an', 'POST', { ma_du_an: 'DA-CK', ten_du_an: 'Thử chi phí khác', trang_thai: 'Đang thi công' })).o.id;
  const T = (await J(`/api/du-an/${pid}/thau-phu`, 'POST', { nhom: 'thau_phu', so_ma: 'TK', doi_tac: 'X', hd: { ngay: '2026-01-05', gia_tri: '100000000', vat: 0 } })).o.id;
  const base = { nhom: 'thau_phu', noi_dung: 'Thuê cẩu ngoài HĐ', ngay: '2026-03-01', gia_tri: '5000000', vat: 0 };
  chk('Thầu phụ không qua hộp HĐ -> chặn', (await J(`/api/du-an/${pid}/chi-phi`, 'POST', base)).s, 400);
  const id = (await J(`/api/du-an/${pid}/chi-phi`, 'POST', { ...base, tp_ref: T, td_ps: 2 })).o.id;
  chk('Thầu phụ nhập từ hộp HĐ (chi phí khác) -> được', Number.isInteger(id), true);
  const cp = (await J(`/api/du-an/${pid}/chi-phi`)).o;
  const x = cp.items.find((y) => y.id === id), c = cp.thau_phu.find((y) => y.so_ma === 'TK');
  chk('lưu HĐ nhập từ + phát sinh TĐ2', [x.tp_ref, x.td_ps], [T, 2]);
  chk('giá trị HĐ không đổi', Math.round(c.hd_gia_tri / 1e6), 100);
  await J(`/api/chi-phi/${id}`, 'PUT', { ...base, gia_tri: '6000000' });
  const x2 = (await J(`/api/du-an/${pid}/chi-phi`)).o.items.find((y) => y.id === id);
  chk('sửa: giữ HĐ nhập từ + phát sinh TĐ2', [x2.tp_ref, x2.td_ps, Number(x2.gia_tri)], [T, 2, 6000000]);
  const m = (await J('/api/bao-cao')).o.du_an.find((y) => y.id === pid).moc.cp;
  chk('báo cáo: chi phí khác TĐ1/TĐ2/TĐ3 (triệu)', m.khac_td.gt.map((v) => v / 1e6), [0, 6, 6]);
  chk('báo cáo: HĐ đầu vào TĐ2 không cộng chi phí khác', m.tp_ps.gt / 1e6, 100);
  console.log(`\nKẾT QUẢ: ${ok} ĐẠT, ${bad} LỖI`);
})();
