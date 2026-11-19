// VAT riêng của đợt điều chỉnh
const B = 'http://127.0.0.1:3002'; let ck = ''; const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
const J = async (u, m = 'GET', b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b && JSON.stringify(b) }); const t = await r.text(); let o; try { o = JSON.parse(t); } catch { o = t; } return { s: r.status, o }; };
let ok = 0, bad = 0; const chk = (t, a, e) => { const d = JSON.stringify(a) === JSON.stringify(e); d ? ok++ : bad++; console.log((d ? '  ĐẠT ' : '  LỖI ') + t + ' = ' + JSON.stringify(a) + (d ? '' : ' (kỳ vọng ' + JSON.stringify(e) + ')')); };
(async () => {
  const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: H(), body: JSON.stringify({ username: 'admin', password: process.env.BKS_PASS }) }); ck = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const pid = (await J('/api/du-an', 'POST', { ma_du_an: 'DA-VAT', ten_du_an: 'Thử VAT đợt', trang_thai: 'Đang thi công' })).o.id;
  const A = (await J(`/api/du-an/${pid}/doanh-thu`, 'POST', { loai: 'hd', ma_loai: 'HĐ', so_ma: 'V', gia_tri: '100000000', vat: 10 })).o.id;
  const vb = async () => (await J(`/api/du-an/${pid}/doanh-thu`)).o.items.find((x) => x.id === A);
  const ps = async () => (await J('/api/bao-cao')).o.du_an.find((x) => x.id === pid).moc.dt.ps.sv;
  const d1 = (await J('/api/dieu-chinh', 'POST', { loai: 'dt', vb_id: A, so_tien: '20000000' })).o.id;
  chk('đợt không ghi VAT -> theo HĐ 10%: sau VAT', (await vb()).sau_vat, 132000000);
  await J('/api/dieu-chinh', 'POST', { loai: 'dt', vb_id: A, so_tien: '10000000', vat: 8 });
  chk('thêm đợt +10tr VAT 8%: sau VAT = 132 + 10,8', (await vb()).sau_vat, 142800000);
  chk('báo cáo TĐ2 sau VAT khớp', await ps(), 142800000);
  chk('VAT sai (150) bị chặn', (await J('/api/dieu-chinh', 'POST', { loai: 'dt', vb_id: A, so_tien: '1', vat: 150 })).s, 400);
  await J(`/api/dieu-chinh/${d1}`, 'PUT', { so_tien: '20000000', vat: 0, noi_dung: '' });
  chk('sửa đợt 1 thành VAT 0%: sau VAT = 110 + 20 + 10,8', (await vb()).sau_vat, 140800000);
  chk('đợt lưu VAT', (await vb()).dot.map((d) => d.vat), [0, 8]);
  console.log(`\nKẾT QUẢ: ${ok} ĐẠT, ${bad} LỖI`);
})();
