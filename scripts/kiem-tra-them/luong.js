// V04.27.11.26 – Lương phát sinh liên tục theo tháng (file Giả định 2 của người dùng):
//  TĐ1: dự trù lương T10 50 + thưởng 25 · TĐ2: + lương T11 45 (khoản mới) · TĐ3: + lương T12 (khoản mới TĐ3), trả lương 3 tháng, chốt thưởng 30
//  Mong đợi nhóm Lương: TĐ1 75 · TĐ2 120 · TĐ3 170 (50 + 45 + 45 đã trả + thưởng chốt 30). Kèm: gợi ý tên tháng kế tiếp, Lịch sử, Gộp vào gói.
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/luong.js [url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const da = await p.evaluate(async () => { const d = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ma_du_an: 'DA-L' + Date.now().toString().slice(-4), ten_du_an: 'Thử lương', trang_thai: 'Đang thi công' }) });
    await api(`/api/du-an/${d.id}/doanh-thu`, { method: 'POST', body: JSON.stringify({ loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'L1', ngay: '2026-01-01', gia_tri: '550000000' }) }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, da); await p.waitForTimeout(2500);
  const td = async (k) => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(800); await p.evaluate(() => { const d = document.querySelector('#c-pt details.pk-them'); if (d) d.open = true; }); };
  const L = () => p.evaluate(() => (costData.cp_nhom.find((n) => n.code === 'gt_luong')?.gt || [0, 0, 0]).map((x) => Math.round(Number(x) || 0)));
  const sel = (n, v) => p.evaluate(([n, v]) => { const e = document.querySelector(`#pk-f [name=${n}]`); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [n, v]);
  const so = async (v) => { await p.fill('#pk-f [name=so_tien]', ''); await p.click('#pk-f [name=so_tien]'); await p.keyboard.type(String(v)); };
  // ---- TĐ1 ----
  await td(1); await sel('nhom', 'gt_luong'); await p.fill('#pk-f [name=noi_dung]', 'Lương tháng 10'); await so(50000000); await p.click('#pk-f button[type=submit]'); await p.waitForTimeout(1500);
  await td(1); await sel('nhom', 'gt_luong'); await p.fill('#pk-f [name=noi_dung]', 'Thưởng đợt'); await so(25000000);
  chk('TĐ1 thêm "Thưởng đợt": ô Hạng mục tự chọn Thưởng đợt', (await p.inputValue('#pk-f [name=nhom_con]')) === 'thuong_dot', await p.inputValue('#pk-f [name=nhom_con]')); await p.click('#pk-f button[type=submit]'); await p.waitForTimeout(1500);
  chk('TĐ1 lương + thưởng = 75', (await L())[0] === 75e6, String(await L()));
  // ---- TĐ2: khoản mới, tên gợi ý "Lương tháng 11" ----
  await td(2); await sel('khoan', 'moi'); await sel('nhom', 'gt_luong'); await p.waitForTimeout(200);
  chk('TĐ2 khoản mới: gợi ý tên "Lương tháng 11"', (await p.inputValue('#pk-f [name=ten]')) === 'Lương tháng 11', await p.inputValue('#pk-f [name=ten]'));
  await so(45000000); await p.click('#pk-f button[type=submit]'); await p.waitForTimeout(1500);
  let v = await L(); chk('TĐ2 = 120 (TĐ1 vẫn 75)', v[0] === 75e6 && v[1] === 120e6, String(v));
  // ---- TĐ3: khoản mới "Lương tháng 12" (TĐ3 có lựa chọn Khoản mới) ----
  await td(3);
  chk('TĐ3 có "＋ Khoản mới (phát sinh TĐ3)"', await p.evaluate(() => [...document.querySelectorAll('#pk-f [name=khoan] option')].some((o) => o.value === 'moi' && /TĐ3/.test(o.textContent))));
  await sel('khoan', 'moi'); await sel('nhom', 'gt_luong'); await p.waitForTimeout(200);
  chk('TĐ3 khoản mới: gợi ý tên "Lương tháng 12"', (await p.inputValue('#pk-f [name=ten]')) === 'Lương tháng 12', await p.inputValue('#pk-f [name=ten]'));
  await p.click('#pk-f button[type=submit]'); await p.waitForTimeout(1500);
  v = await L(); chk('thêm khoản T12 chưa trả: TĐ1 75, TĐ2 120 không đổi', v[0] === 75e6 && v[1] === 120e6, String(v));
  // trả lương 3 tháng (gắn khoản) + chốt thưởng 30
  await p.evaluate(async (i) => { const ds = (await api(`/api/du-an/${i}/chi-phi`)).du_tru.filter((r) => r.loai === 'ky' && r.nhom === 'gt_luong'), id = (t) => ds.find((r) => r.noi_dung === t).id;
    const chi = (t, gt, ngay) => api(`/api/du-an/${i}/chi-phi`, { method: 'POST', body: JSON.stringify({ nhom: 'gt_luong', nhom_con: 'luong', noi_dung: 'Trả ' + t, ngay, gia_tri: gt, vat: 0, goi_id: id(t) }) });
    await chi('Lương tháng 10', 50000000, '2026-10-31'); await chi('Lương tháng 11', 45000000, '2026-11-26'); await chi('Lương tháng 12', 45000000, '2026-11-27');
    await api(`/api/du-tru/${id('Thưởng đợt')}`, { method: 'PUT', body: JSON.stringify({ gt_chot: 30000000 }) }); }, da);
  await p.evaluate(() => loadCost()); await p.waitForTimeout(1500);
  v = await L(); chk('TĐ3 = 50 + 45 + 45 đã trả + thưởng chốt 30 = 170 (như file Giả định 2)', v[2] === 170e6, String(v));
  // ---- V05.27.11.26: bảng DT-CP tách Lương / Thưởng tết-lễ / Thưởng đợt ở cả 3 TĐ ----
  const hm = (c) => p.evaluate((c) => Number(document.querySelector(`.dtcp-table tr.dtcp-con[data-nhom="gt_luong"][data-con="${c}"] .dtcp-tt`)?.innerText.replace(/\D/g, '') || -1), c);
  for (const [k, l, tdot] of [[1, 50e6, 25e6], [2, 95e6, 25e6], [3, 140e6, 30e6]]) {
    await td(k); const a = await hm('luong'), b = await hm('thuong_dot'), c0 = await hm('thuong_le');
    chk(`TĐ${k} tách: Lương ${l / 1e6} · Thưởng đợt ${tdot / 1e6} · Thưởng tết/lễ 0`, a === l && b === tdot && c0 === 0, `${a} / ${b} / ${c0}`);
  }
  // ---- Lịch sử trên bảng DT-CP ----
  await td(2);
  chk('bảng DT-CP: dòng lương có "Lịch sử (n) ›"', await p.evaluate(() => /Lịch sử \(\d+\)/.test(document.querySelector('.dtcp-table [data-dtcpls="gt_luong"]')?.innerText || '')));
  await p.click('.dtcp-table [data-dtcpls="gt_luong"]'); await p.waitForTimeout(500);
  chk('bấm Lịch sử: mở hộp liệt kê khoản / đợt của nhóm', await p.evaluate(() => [...document.querySelectorAll('dialog[open]')].some((d) => [...d.querySelectorAll('input')].some((i) => /Lương tháng 11/.test(i.value)) || /Lương tháng 11/.test(d.innerText))));
  // ---- Gộp "Điều chỉnh cả nhóm" kiểu cũ vào gói ----
  await p.evaluate(async (i) => {
    const g = await api(`/api/du-an/${i}/du-tru`, { method: 'POST', body: JSON.stringify({ nhom: 'vat_tu', nhom_con: 'phu', loai: 'ky', dtcp: true, noi_dung: 'DT-CP · Vật tư phụ', so_tien: 50000000, vat: 10, ngay: '2026-01-01' }) });
    await api(`/api/du-an/${i}/du-tru`, { method: 'POST', body: JSON.stringify({ nhom: 'vat_tu', nhom_con: 'phu', loai: 'dc', goi_ref: g.id, dtcp: true, noi_dung: 'DT-CP TĐ2', so_tien: -50000000, vat: 10, ngay: '2026-11-27' }) });
    await api(`/api/du-an/${i}/du-tru`, { method: 'POST', body: JSON.stringify({ nhom: 'vat_tu', nhom_con: 'phu', loai: 'dc', dtcp: true, noi_dung: 'DT-CP TĐ2 · điều chỉnh (cũ)', so_tien: 45000000, vat: 10, ngay: '2026-11-26' }) }); }, da);
  await p.evaluate(() => { document.querySelectorAll('dialog[open]').forEach((d) => d.close()); return loadCost(); }); await p.waitForTimeout(1500);
  const vt0 = await p.evaluate(() => (costData.cp_nhom.find((n) => n.code === 'vat_tu')?.gt || []).map((x) => Math.round(x)));
  await p.click('.dtcp-table [data-dtcphd="vat_tu"]'); await p.waitForTimeout(600); if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(500); }
  chk('hộp chi tiết có nút "Gộp vào gói"', Boolean(await p.$('#tpn-dlg [data-gopdc]')));
  await p.click('#tpn-dlg [data-gopdc]'); await p.waitForTimeout(2500);
  const vt1 = await p.evaluate(() => (costData.cp_nhom.find((n) => n.code === 'vat_tu')?.gt || []).map((x) => Math.round(x)));
  chk('gộp xong: tổng Vật tư không đổi (TĐ2 45)', vt0.join() === vt1.join() && vt1[1] === 45e6, `${vt0} -> ${vt1}`);
  const txt = await p.evaluate(() => document.querySelector('#tpn-dlg')?.innerText || '');
  chk('gộp xong: hết dòng "Điều chỉnh cả nhóm", gói phụ TĐ2 = 49.500.000 (45 tr + VAT)', !/Điều chỉnh cả nhóm/.test(txt) && /49\.500\.000|49,5/.test(txt), txt.slice(0, 300));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
