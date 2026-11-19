// Chi phí không gắn HĐ phát sinh tại TĐ1 / TĐ2 / TĐ3
const B = 'http://127.0.0.1:3002'; let ck = ''; const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Origin: B, Cookie: ck });
const J = async (u, m = 'GET', b) => { const r = await fetch(B + u, { method: m, headers: H(), body: b && JSON.stringify(b) }); const t = await r.text(); let o; try { o = JSON.parse(t); } catch { o = t; } if (r.status >= 300) console.log('!!', m, u, r.status, t.slice(0, 160)); return { s: r.status, o }; };
let ok = 0, bad = 0; const chk = (t, a, e) => { const d = JSON.stringify(a) === JSON.stringify(e); d ? ok++ : bad++; console.log((d ? '  ĐẠT ' : '  LỖI ') + t + ' = ' + JSON.stringify(a) + (d ? '' : ' (kỳ vọng ' + JSON.stringify(e) + ')')); };
const tr = (x) => Math.round(x / 1e6);
(async () => {
  const r = await fetch(B + '/api/auth/login', { method: 'POST', headers: H(), body: JSON.stringify({ username: 'admin', password: process.env.BKS_PASS }) }); ck = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const pid = (await J('/api/du-an', 'POST', { ma_du_an: 'DA-CP', ten_du_an: 'Thử chi phí phát sinh theo TĐ', trang_thai: 'Đang thi công' })).o.id;
  const M = async () => (await J('/api/bao-cao')).o.du_an.find((x) => x.id === pid).moc;
  const add = (nd, gt, td_ps) => J(`/api/du-an/${pid}/chi-phi`, 'POST', { nhom: 'to_chuc', noi_dung: nd, ngay: '2026-03-01', gia_tri: gt, vat: 0, ...(td_ps ? { td_ps } : {}) });
  await add('Lán trại (TĐ1)', '10000000');
  const c2 = (await add('Thuê thêm kho (TĐ2)', '6000000', 2)).o.id;
  await add('Phát sinh lúc quyết toán (TĐ3)', '3000000', 3);
  let m = await M();
  chk('chi phí khác TĐ1 / TĐ2 / TĐ3', m.cp.khac_td.gt.map(tr), [10, 16, 19]);
  chk('giá vốn trực tiếp (B1) theo TĐ', m.cp.khac_b1_td.gt.map(tr), [10, 16, 19]);
  chk('tổng chi phí khác (đã ghi) vẫn đủ 19', tr(m.cp.khac.gt), 19);
  const items = (await J(`/api/du-an/${pid}/chi-phi`)).o.items;
  chk('lưu "phát sinh tại TĐ"', items.map((x) => x.td_ps ?? null).sort(), [2, 3, null].sort());
  await J(`/api/chi-phi/${c2}`, 'PUT', { nhom: 'to_chuc', noi_dung: 'Thuê thêm kho (TĐ2) – sửa', ngay: '2026-03-01', gia_tri: '8000000', vat: 0 });
  m = await M(); chk('sửa dòng TĐ2 (giữ phát sinh TĐ2): TĐ1 / TĐ2 / TĐ3', m.cp.khac_td.gt.map(tr), [10, 18, 21]);
  console.log(`\nKẾT QUẢ: ${ok} ĐẠT, ${bad} LỖI`);
})();
