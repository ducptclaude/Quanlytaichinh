// V02.27.11.26 – Bảng DT-CP TĐ2 "số cuối" + gói còn mở = MAX(gói ± đ/c, HĐ + mua lẻ)
// Tình huống người dùng báo: TĐ1 Thầu phụ 165 · Vật tư chính 75 · Vật tư phụ 50 · Nhân công 50 (trước VAT); gắn HĐ Thầu phụ 15, Nhân công 40.
// Chạy: BKS_PASS=... node scripts/kiem-tra-them/td2-socuoi.js [url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const da = await p.evaluate(async () => { const d = await api('/api/du-an', { method: 'POST', body: JSON.stringify({ ma_du_an: 'DA-SC' + Date.now().toString().slice(-4), ten_du_an: 'Thử số cuối TĐ2', trang_thai: 'Đang thi công' }) });
    await api(`/api/du-an/${d.id}/doanh-thu`, { method: 'POST', body: JSON.stringify({ loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'S1', ngay: '2026-01-01', gia_tri: '550000000' }) }); return d.id; });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, da); await p.waitForTimeout(2500);
  const td = async (k) => { await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click(`#tab-cost [data-tdpick="${k}"]`); await p.waitForTimeout(800); };
  const o = (nhom, con = '') => `.dtcp-table tr.dtcp-n[data-nhom="${nhom}"]${con ? `[data-con="${con}"]` : ':not(.dtcp-con)'} .dtcp-in`;
  const go = async (sel, v) => { await p.fill(sel, ''); await p.click(sel); await p.keyboard.type(v); };
  const cp = (code) => p.evaluate((c) => (costData.cp_nhom.find((n) => n.code === c)?.gt || [0, 0, 0]).map((x) => Math.round(Number(x) || 0)), code);
  const tt = (nhom, con = '') => p.evaluate((s) => Number(document.querySelector(s.replace(' .dtcp-in', ' .dtcp-tt')).innerText.replace(/\D/g, '')), o(nhom, con));
  // ---- TĐ1 ----
  await td(1);
  await go(o('thau_phu'), '165000000'); await go(o('vat_tu', 'chinh'), '75000000'); await go(o('vat_tu', 'phu'), '50000000'); await go(o('nhan_cong'), '50000000');
  await p.click('[data-dtcpluu]'); await p.waitForTimeout(2500);
  chk('TĐ1 Thầu phụ 165', (await cp('thau_phu'))[0] === 165e6, String(await cp('thau_phu')));
  chk('TĐ1 Vật tư 125', (await cp('vat_tu'))[0] === 125e6, String(await cp('vat_tu')));
  // gắn HĐ thật: Thầu phụ 15 tr, Nhân công 40 tr (ký ở TĐ2, gắn gói)
  await p.evaluate(async (i) => { const g = (await api(`/api/du-an/${i}/chi-phi`)).du_tru, gid = (n) => g.find((r) => r.loai === 'ky' && r.nhom === n).id;
    const mk = (nhom, so, gt) => api(`/api/du-an/${i}/thau-phu`, { method: 'POST', body: JSON.stringify({ nhom, so_ma: so, doi_tac: 'Cty ' + so, goi_id: gid(nhom), hinh_thuc: 'hd', hd: { ngay: '2026-03-01', gia_tri: gt, vat: 10, td: 2 } }) });
    await mk('thau_phu', 'TP-A', 15000000); await mk('nhan_cong', 'NC-A', 40000000); }, da);
  await p.evaluate(() => loadCost()); await p.waitForTimeout(1500);
  // ---- TĐ2: gói còn mở giữ phần chưa ký ----
  let t = await cp('thau_phu'); chk('① Thầu phụ TĐ2 = MAX(gói 165, HĐ 15) = 165 (không rơi về 15)', t[1] === 165e6, String(t));
  t = await cp('nhan_cong'); chk('① Nhân công TĐ2 = MAX(gói 50, HĐ 40) = 50', t[1] === 50e6, String(t));
  await td(2);
  chk('② dòng Vật tư phụ TĐ2 hiện 50 (không dồn sang chính)', (await tt('vat_tu', 'phu')) === 50e6, String(await tt('vat_tu', 'phu')));
  chk('② dòng Vật tư chính TĐ2 hiện 75', (await tt('vat_tu', 'chinh')) === 75e6, String(await tt('vat_tu', 'chinh')));
  // gõ số cuối Vật tư phụ = 45 tr, Thầu phụ = 150 tr
  await go(o('vat_tu', 'phu'), '45000000'); await go(o('thau_phu'), '150000000');
  chk('xem trước: Vật tư phụ thành tiền = 45 (số cuối, không cộng thêm)', (await tt('vat_tu', 'phu')) === 45e6, String(await tt('vat_tu', 'phu')));
  await p.click('[data-dtcpluu]'); await p.waitForTimeout(2500);
  t = await cp('vat_tu'); chk('② Vật tư TĐ1 125 · TĐ2 120 (75 + 45)', t[0] === 125e6 && t[1] === 120e6, String(t));
  t = await cp('thau_phu'); chk('② Thầu phụ TĐ2 = 150 (gói 165 − 15)', t[0] === 165e6 && t[1] === 150e6, String(t));
  const dcs = await p.evaluate(() => costData.du_tru.filter((r) => r.loai === 'dc').map((r) => ({ so: Number(r.so_tien), goi: Boolean(r.goi_ref) })));
  chk('③ chênh lệch ghi vào gói của dòng (−5, −15, gắn gói)', dcs.length === 2 && dcs.every((x) => x.goi) && dcs.map((x) => x.so).sort((a, b) => a - b).join() === '-15000000,-5000000', JSON.stringify(dcs));
  // gõ lại số cuối (sửa): Vật tư phụ 48 -> đợt của gói cập nhật thành −2, không thêm đợt mới
  await go(o('vat_tu', 'phu'), '48000000'); await p.click('[data-dtcpluu]'); await p.waitForTimeout(2000);
  t = await cp('vat_tu'); chk('sửa số cuối Vật tư phụ 48: TĐ2 Vật tư = 123', t[1] === 123e6, String(t));
  chk('sửa số cuối: vẫn 1 đợt cho gói phụ', await p.evaluate(() => costData.du_tru.filter((r) => r.loai === 'dc' && r.nhom === 'vat_tu').length === 1));
  // không cho thấp hơn HĐ đã ký
  await go(o('thau_phu'), '10000000'); await p.click('[data-dtcpluu]'); await p.waitForTimeout(1200);
  chk('Thầu phụ số cuối 10 < HĐ 15 -> báo không cho', /không nhỏ hơn/.test(await p.evaluate(() => document.querySelector('#dtcp-msg')?.innerText || '')));
  // dòng chưa có gói: MMTB số cuối 20 -> khoản phát sinh TĐ2
  await go(o('may_moc'), '20000000'); await p.fill(o('thau_phu'), ''); await p.click('[data-dtcpluu]'); await p.waitForTimeout(2000);
  t = await cp('may_moc'); chk('dòng chưa có gói: MMTB phát sinh TĐ2 20 (TĐ1 = 0)', t[0] === 0 && t[1] === 20e6, String(t));
  // hộp chi tiết Vật tư: không còn "Điều chỉnh cả nhóm", gói phụ TĐ2 = 48 × 1,1
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())); await p.click('.dtcp-table [data-dtcphd="vat_tu"]'); await p.waitForTimeout(600);
  if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(500); }
  const txt = await p.evaluate(() => document.querySelector('#tpn-dlg')?.innerText || '');
  chk('③ hộp chi tiết: không có dòng "Điều chỉnh cả nhóm"', !/Điều chỉnh cả nhóm/.test(txt));
  chk('③ hộp chi tiết: gói Vật tư phụ TĐ2 = 52.800.000 (48 tr + VAT)', /52\.800\.000|52,8/.test(txt), txt.slice(0, 300));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
