// V03.28.11.26 – 6 việc theo rà soát: (1) ghi chi khi TĐ đã duyệt -> khoá, hỏi mở TĐ · (2) cảnh báo chưa chọn khoản · (3) bỏ form thêm khoản trùng
//  (4) xoá khoản: hộp 3 nút · (5) Sửa lần chi · (6) dòng TỔNG hộp HĐ › cộng CP khác
// Chạy: BKS_PASS=... BKS_PC=... node scripts/kiem-tra-them/sau-viec.js [url]
const { chromium } = require('playwright');
const B = process.argv[2] || 'http://127.0.0.1:3002';
let ok = 0, loi = 0; const chk = (t, c, x = '') => { if (c) ok++; else { loi++; console.log('  LỖI:', t, x); } };
(async () => {
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  await p.goto(B + '/login'); await p.fill('[name=username]', 'admin'); await p.fill('[name=password]', process.env.BKS_PASS);
  await Promise.all([p.waitForURL(B + '/'), p.click('form button[type=submit]')]); await p.waitForTimeout(1500);
  const J = (u, m = 'GET', b) => p.evaluate(async ([u, m, b]) => { const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch {} return { s: r.status, j }; }, [u, m, b]);
  await J('/api/settings/passcode', 'PUT', { current_password: process.env.BKS_PASS, passcode: process.env.BKS_PC, passcode2: process.env.BKS_PC });
  const id = (await J('/api/du-an', 'POST', { ma_du_an: 'DA-6V' + Date.now().toString().slice(-4), ten_du_an: 'Thử 6 việc', trang_thai: 'Đang thi công' })).j.id;
  await J(`/api/du-an/${id}/doanh-thu`, 'POST', { loai: 'hd', vat: 0, ma_loai: 'HĐ', so_ma: 'C', ngay: '2026-01-01', gia_tri: '550000000' });
  const kh = (await J(`/api/du-an/${id}/du-tru`, 'POST', { nhom: 'gt_luong', nhom_con: 'luong', loai: 'ky', so_tien: 50000000, vat: 0, noi_dung: 'Lương BCH' })).j.id;
  await J(`/api/du-an/${id}/thau-phu`, 'POST', { so_ma: 'TP-A', nhom: 'thau_phu', doi_tac: 'A', hd: { gia_tri: 100000000, vat: 0, ngay: '2026-02-01' } });
  const cpk = (await J(`/api/du-an/${id}/du-tru`, 'POST', { nhom: 'thau_phu', loai: 'ky', la_cp: true, td_ps: 2, so_tien: 7500000, vat: 0, noi_dung: 'CP khác · Vệ sinh' })).j.id;
  // (1) TĐ1 duyệt -> ghi chi TĐ1 bị khoá (423 + mo_td k=1); ghi ở TĐ2 vẫn được
  await J(`/api/du-an/${id}/td/1`, 'POST', { viec: 'trinh' }); chk('duyệt TĐ1', (await J(`/api/du-an/${id}/td/1`, 'POST', { viec: 'duyet' })).s === 200);
  const c1 = await J(`/api/du-an/${id}/chi-phi`, 'POST', { nhom: 'gt_luong', nhom_con: 'luong', noi_dung: 'Lương T9', gia_tri: 10000000, vat: 0, ngay: '2026-11-01', goi_id: kh });
  chk('(1) V04: ghi chi vào TĐ1 đã duyệt -> tự chuyển sang TĐ2', c1.s === 201 && Number((await J(`/api/du-an/${id}/chi-phi`)).j.items.find((x) => x.id === c1.j.id)?.td_ps) === 2, JSON.stringify(c1));
  await J(`/api/chi-phi/${c1.j.id}`, 'DELETE');
  const c2 = await J(`/api/du-an/${id}/chi-phi`, 'POST', { nhom: 'gt_luong', nhom_con: 'luong', noi_dung: 'Lương T10', gia_tri: 30000000, vat: 0, ngay: '2026-11-01', goi_id: kh, td_ps: 2 });
  chk('(1) ghi chi ở TĐ2 (chưa duyệt) vẫn được', c2.s === 201, JSON.stringify(c2));
  await J(`/api/du-an/${id}/chi-phi`, 'POST', { nhom: 'thau_phu', noi_dung: 'TT vệ sinh', gia_tri: 5000000, vat: 0, ngay: '2026-11-02', goi_id: cpk, td_ps: 2 });
  await p.evaluate((i) => { revProjectId = i; revAll = false; costAll = false; showTab('cost'); }, id); await p.waitForTimeout(2500);
  // (3) TĐ1 không còn form "+ Thêm khoản chi tiết" dưới bảng
  await p.click('#tab-cost [data-tdpick="1"]'); await p.waitForTimeout(700);
  chk('(3) TĐ1 bỏ form thêm khoản trùng', !(await p.$('#pk-f[data-k="1"]')));
  await p.click('#tab-cost [data-tdpick="2"]'); await p.waitForTimeout(700);
  chk('(3) TĐ2 ô Khoản không còn "Khoản mới"', !(await p.$('#pk-f select[name=khoan] option[value=moi]')));
  // (2) cảnh báo khi ghi chi lương không chọn khoản
  await p.click('[data-cfopen]'); await p.waitForTimeout(500);
  await p.evaluate(() => { const e = cForm.elements; e.nhom.value = 'gt_luong'; e.nhom.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { const e = cForm.elements; if (e.nhom_con) e.nhom_con.value = 'luong'; if (e.le_goi) e.le_goi.value = ''; e.noi_dung.value = 'Lương lẻ'; e.gia_tri.value = '1.000.000'; e.gia_tri.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.waitForTimeout(300);
  chk('(2) cảnh báo vàng "Chưa chọn Thuộc gói / khoản"', /Chưa chọn "Thuộc gói \/ khoản"/.test(await p.evaluate(() => document.querySelector('#c-canh-bao')?.innerText || '')), await p.evaluate(() => document.querySelector('#c-canh-bao')?.innerText || ''));
  await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  // (5) Sửa lần chi trong hộp Chi tiết: 30 -> 32
  await p.click('.dtcp-table [data-dtcpkh="gt_luong|luong"]'); await p.waitForTimeout(600);
  await p.click('#khds-dlg [data-chisua]'); await p.waitForTimeout(300);
  await p.fill('#khds-dlg tr.chi-sua [data-f="so"]', ''); await p.click('#khds-dlg tr.chi-sua [data-f="so"]'); await p.keyboard.type('32000000'); await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  const da = await p.evaluate(() => (costData.items || []).filter((c) => c.nhom === 'gt_luong').map((c) => Number(c.gia_tri)));
  chk('(5) sửa lần chi 30 -> 32', da.length === 1 && da[0] === 32e6, JSON.stringify(da));
  // (6) hộp HĐ › thầu phụ: TỔNG còn lại gồm CP khác (HĐ 100 chưa trả + CP khác 7,5 − 5 = 102,5)
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await p.click('.dtcp-table [data-dtcphd="thau_phu"]'); await p.waitForTimeout(600); if (await p.$('#dtcp-hd-dlg[open]')) { await p.click('#dtcp-hd-dlg [data-hdb]'); await p.waitForTimeout(600); }
  const tong = await p.evaluate(() => [...document.querySelectorAll('#tpn-dlg tfoot .tp-grand td')].map((td) => td.innerText.trim()));
  chk('(6) TỔNG: đã trả gồm 5 của CP khác, còn lại 102,5', tong.some((x) => /^5(\.000\.000)?$|^5,0$/.test(x)) && tong.some((x) => /102[.,]5/.test(x)), JSON.stringify(tong));
  // (4) xoá khoản có lần chi -> hộp 3 nút; chọn "Không xoá" thì khoản còn
  await p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
  await p.click('.dtcp-table [data-dtcpkh="gt_luong|luong"]'); await p.waitForTimeout(600);
  await p.click('#khds-dlg [data-khxoa]'); await p.waitForTimeout(400);
  const nut = await p.evaluate(() => [...document.querySelectorAll('dialog.hoi-chon[open] button')].map((b) => b.innerText));
  chk('(4) hộp 3 nút', nut.length === 3 && /Xoá khoản \+ 1 lần chi/.test(nut[0]) && /giữ lần chi/.test(nut[1]) && /Không xoá/.test(nut[2]), JSON.stringify(nut));
  await p.click('dialog.hoi-chon[open] [data-i="2"]'); await p.waitForTimeout(800);
  chk('(4) "Không xoá": khoản còn', await p.evaluate((k) => (costData.du_tru || []).some((r) => r.id === k), kh));
  await p.click('#khds-dlg [data-khxoa]'); await p.waitForTimeout(400); await p.click('dialog.hoi-chon[open] [data-i="0"]'); await p.waitForTimeout(1500);
  // khoản thuộc TĐ1 đã duyệt -> trang hỏi Passcode mở khoá TĐ1 rồi làm tiếp
  chk('(1) xoá khoản TĐ1 đã duyệt: trang hỏi Passcode', Boolean(await p.$('dialog.pass-dlg[open]')));
  if (await p.$('dialog.pass-dlg[open]')) { await p.fill('dialog.pass-dlg [name=pc]', process.env.BKS_PC); await p.click('dialog.pass-dlg button[type=submit]'); await p.waitForTimeout(2500); }
  chk('(4) "Xoá khoản + lần chi": khoản và lần chi đều mất', await p.evaluate((k) => !(costData.du_tru || []).some((r) => r.id === k) && !(costData.items || []).some((c) => c.nhom === 'gt_luong'), kh));
  chk('không lỗi trang', !errs.length, errs[0]);
  console.log(`KẾT QUẢ: ${ok} ĐẠT, ${loi} LỖI`);
  await br.close();
})();
