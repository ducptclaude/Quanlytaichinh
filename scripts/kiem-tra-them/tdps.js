// Mục thêm vào HĐ đầu vào phát sinh tại TĐ1 / TĐ2 / TĐ3
const B = 'http://127.0.0.1:3002'; let ck = ''; const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
const J = async (u, m = 'GET', b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b && JSON.stringify(b) }); const t = await r.text(); let o; try { o = JSON.parse(t); } catch { o = t; } if (r.status >= 300) console.log('!!', m, u, r.status, t.slice(0, 160)); return { s: r.status, o }; };
let ok = 0, bad = 0; const chk = (t, a, e) => { const d = JSON.stringify(a) === JSON.stringify(e); d ? ok++ : bad++; console.log((d ? '  ĐẠT ' : '  LỖI ') + t + ' = ' + JSON.stringify(a) + (d ? '' : ' (kỳ vọng ' + JSON.stringify(e) + ')')); };
const tr = (x) => Math.round(x / 1e6);
(async () => {
  const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: H(), body: JSON.stringify({ username: 'admin', password: process.env.BKS_PASS }) }); ck = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const pid = (await J('/api/du-an', 'POST', { ma_du_an: 'DA-PS', ten_du_an: 'Thử phát sinh theo TĐ', trang_thai: 'Đang thi công' })).o.id;
  const M = async () => (await J('/api/bao-cao')).o.du_an.find((x) => x.id === pid).moc.cp;
  const T = (await J(`/api/du-an/${pid}/thau-phu`, 'POST', { nhom: 'thau_phu', so_ma: 'TPS', doi_tac: 'X', hd: { ngay: '2026-01-05', gia_tri: '100000000', vat: 0 } })).o.id;
  const add = (ma, gt, td_ps) => J(`/api/thau-phu/${T}/hd-pl`, 'POST', { ma_loai: ma, ngay: '2026-02-01', gia_tri: gt, vat: 0, ...(td_ps ? { td_ps } : {}) });
  await add('PL01', '20000000');        // thêm ở TĐ1
  await add('PL02', '30000000', 2);     // thêm ở TĐ2
  await add('PL03', '40000000', 3);     // thêm ở TĐ3
  let m = await M();
  chk('TĐ1 = HĐ 100 + PL01 20 (không tính PL02, PL03)', tr(m.tp_goc.gt), 120);
  chk('TĐ2 = 120 + PL02 30 (không tính PL03)', tr(m.tp_ps.gt), 150);
  chk('TĐ3 = 150 + PL03 40', tr(m.tp_qt.gt), 190);
  const c = (await J(`/api/du-an/${pid}/chi-phi`)).o.thau_phu.find((x) => x.so_ma === 'TPS');
  const L = Object.fromEntries(c.lines.map((l) => [l.ma_loai, l]));
  chk('lưu "phát sinh tại TĐ"', [L.HĐ.td_ps ?? null, L.PL01.td_ps ?? null, L.PL02.td_ps, L.PL03.td_ps], [null, null, 2, 3]);
  // PL02: tăng thêm ở TĐ2 (+5) -> TĐ2 155, TĐ3 195
  await J('/api/dieu-chinh', 'POST', { loai: 'tp', vb_id: L.PL02.id, so_tien: '5000000' });
  m = await M(); chk('PL02 tăng +5 ở TĐ2: TĐ1/TĐ2/TĐ3', [tr(m.tp_goc.gt), tr(m.tp_ps.gt), tr(m.tp_qt.gt)], [120, 155, 195]);
  // PL03 quyết toán 38 -> TĐ3 = 155 + 38
  await J(`/api/tp-hd-pl/${L.PL03.id}/qt`, 'PUT', { gt_qt: '38000000' });
  m = await M(); chk('PL03 quyết toán 38: TĐ3', tr(m.tp_qt.gt), 193);
  // sửa PL02 ở TĐ (giữ nguyên phát sinh TĐ2)
  await J(`/api/tp-hd-pl/${L.PL02.id}`, 'PUT', { ma_loai: 'PL02', ngay: '2026-02-01', gia_tri: '32000000', vat: 0, giu_qt: true });
  const c2 = (await J(`/api/du-an/${pid}/chi-phi`)).o.thau_phu.find((x) => x.so_ma === 'TPS');
  chk('sửa PL02: vẫn phát sinh TĐ2', c2.lines.find((l) => l.ma_loai === 'PL02').td_ps, 2);
  m = await M(); chk('sau sửa PL02 32 (+5 đợt): TĐ1/TĐ2', [tr(m.tp_goc.gt), tr(m.tp_ps.gt)], [120, 157]);
  console.log(`\nKẾT QUẢ: ${ok} ĐẠT, ${bad} LỖI`);
})();
