'use strict';
/** Bài thử: Nhập hằng ngày */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PW } = require('./helpers');
const T = require('../src/text');

test('Số lượng kiểu Việt Nam và Thành tiền không sai số', () => {
  assert.equal(T.parseQty('12,5'), 12500);
  assert.equal(T.parseQty('1.250,75'), 1250750);
  assert.ok(Number.isNaN(T.parseQty('12.5'))); // tránh hiểu nhầm dấu chấm là số lẻ
  assert.ok(Number.isNaN(T.parseQty('1,2345')));
  assert.equal(T.fmtQty(1250750), '1.250,75');
  assert.equal(T.calcAmount(T.parseQty('12,5'), 185000), 2312500);
  assert.equal(T.calcAmount(T.parseQty('0,333'), 1000001), 333000); // 333.000,333 -> 333.000
  assert.equal(T.calcAmount(T.parseQty('0,5'), 1), 1); // 0,5 đồng -> làm tròn lên 1
  assert.equal(T.calcAmount(T.parseQty('3'), 33333), 99999);
  // 0,1 + 0,2 kiểu số thực dễ sai; ở đây tính nguyên
  assert.equal(T.calcAmount(T.parseQty('0,3'), 1000000000), 300000000);
});

let srv; let admin; let user; let pid; let pid2;
const day = (iso) => T.fmtDay(iso);
const today = T.todayVN();

before(async () => {
  srv = await startServer();
  const b = srv.browser();
  await b.post('/setup', { company_name: 'ABC', app_name: 'QLTC', full_name: 'Quản Trị', username: 'admin', password: PW, password2: PW });
  admin = srv.browser();
  await admin.post('/login', { username: 'admin', password: PW });
  await admin.post('/tai-khoan/moi', { full_name: 'Chỉ Huy Trưởng', username: 'cht', role: 'user', password: PW, password2: PW });
  user = srv.browser();
  await user.post('/login', { username: 'cht', password: PW });
  await admin.post('/du-an/moi', { code: 'DA-1', name: 'Nhà xưởng', status: 'Đang thi công' });
  await admin.post('/du-an/moi', { code: 'DA-2', name: 'Kho', status: 'Đang thi công' });
  const list = (await admin.get('/du-an')).text;
  pid = Number(list.match(/href="\/du-an\/(\d+)">DA-1</)[1]);
  pid2 = Number(list.match(/href="\/du-an\/(\d+)">DA-2</)[1]);
});
after(async () => srv && srv.stop());

const row = (o) => ({ project_id: pid, entry_date: day(today), content: 'Bê tông M300', unit: 'm3', quantity: '12,5', unit_price: '1.850.000', ...o });

let r1;
test('Thêm dòng: tự tính thành tiền, ghi người cập nhật', async () => {
  const res = await user.json('/nhap-hang-ngay/api/luu', row({ doc_no: 'PN-01', note: 'Đổ sàn tầng 2' }));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  r1 = res.body.row;
  assert.equal(r1.amount, 23125000);
  assert.equal(r1.quantity, '12,5');
  assert.equal(r1.unit_price, '1.850.000');
  assert.equal(r1.updated_by_name, 'Chỉ Huy Trưởng');
  assert.equal(r1.version, 1);
});

test('Quy tắc ràng buộc: bắt buộc, số lượng > 0, ngày hợp lệ, không quá hôm nay', async () => {
  const tomorrow = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);
  const res = await user.json('/nhap-hang-ngay/api/luu', row({ entry_date: day(tomorrow), content: '', quantity: '0', unit_price: 'abc' }));
  assert.equal(res.status, 400);
  const e = res.body.errors;
  assert.match(e.entry_date, /sau hôm nay/);
  assert.match(e.content, /Chưa nhập/);
  assert.match(e.quantity, /lớn hơn 0/);
  assert.match(e.unit_price, /Chỉ nhập số/);
  const e2 = (await user.json('/nhap-hang-ngay/api/luu', row({ entry_date: '31/02/2026', quantity: '12.5' }))).body.errors;
  assert.match(e2.entry_date, /không hợp lệ/);
  assert.match(e2.quantity, /dấu phẩy/);
  const e3 = (await user.json('/nhap-hang-ngay/api/luu', row({ project_id: 99999 }))).body.errors;
  assert.match(e3._row, /Dự án không còn/);
});

test('Sửa trực tiếp + chống ghi đè khi 2 người cùng sửa', async () => {
  const a = await user.json('/nhap-hang-ngay/api/luu', row({ id: r1.id, version: r1.version, quantity: '10' }));
  assert.equal(a.status, 200);
  assert.equal(a.body.row.amount, 18500000);
  assert.equal(a.body.row.version, 2);
  // admin vẫn cầm phiên bản cũ (1) -> bị báo xung đột, không ghi đè
  const b = await admin.json('/nhap-hang-ngay/api/luu', row({ id: r1.id, version: 1, quantity: '99' }));
  assert.equal(b.status, 409);
  assert.match(b.body.errors._row, /vừa được Chỉ Huy Trưởng sửa/);
  assert.equal(b.body.current.quantity, '10');
  // không cho sửa dòng của dự án khác bằng cách đổi project_id
  const c = await user.json('/nhap-hang-ngay/api/luu', row({ id: r1.id, version: 2, project_id: pid2 }));
  assert.equal(c.status, 404);
});

test('Dòng tổng, gợi ý nội dung, lọc theo kỳ, theo dự án', async () => {
  await user.json('/nhap-hang-ngay/api/luu', row({ content: 'Thép D16', unit: 'kg', quantity: '1.500', unit_price: '18.500' }));
  await user.json('/nhap-hang-ngay/api/luu', row({ entry_date: '15/01/2026', content: 'Cát vàng', quantity: '20', unit_price: '350.000' }));
  await user.json('/nhap-hang-ngay/api/luu', row({ project_id: pid2, content: 'Gạch ống', unit: 'viên', quantity: '5.000', unit_price: '1.200' }));
  const page = await user.get(`/nhap-hang-ngay?du_an=${pid}`); // mặc định: tháng này
  const data = JSON.parse(page.text.match(/<script type="application\/json" id="grid-data">([\s\S]*?)<\/script>/)[1]);
  const inMonth = data.rows.map((r) => r.content);
  assert.ok(inMonth.includes('Bê tông M300') && inMonth.includes('Thép D16'));
  assert.ok(!inMonth.includes('Cát vàng') || today.slice(0, 7) === '2026-01');
  assert.ok(!inMonth.includes('Gạch ống')); // dự án khác
  const sum = data.rows.reduce((s, r) => s + r.amount, 0);
  assert.equal(sum, 18500000 + 27750000);
  // gợi ý: có nội dung đã nhập + ĐVT + đơn giá gần nhất
  const s = data.suggestions.find((x) => x.c === 'Thép D16');
  assert.deepEqual(s, { c: 'Thép D16', u: 'kg', p: '18.500' });
  assert.match(page.text, /<option value="Gạch ống">/); // gợi ý dùng chung mọi dự án
  const all = await user.get(`/nhap-hang-ngay?du_an=${pid}&all=1`);
  assert.match(all.text, /Cát vàng/);
  // nội dung có ký tự đặc biệt không phá trang
  await user.json('/nhap-hang-ngay/api/luu', row({ content: '</script><b>x</b>' }));
  const p2 = await user.get(`/nhap-hang-ngay?du_an=${pid}`);
  assert.doesNotMatch(p2.text, /<\/script><b>x<\/b>/);
});

test('Xóa: chỉ Quản trị; dự án có dòng nhập thì không xóa được', async () => {
  const no = await user.json('/nhap-hang-ngay/api/xoa', { id: r1.id });
  assert.equal(no.status, 403);
  const ok = await admin.json('/nhap-hang-ngay/api/xoa', { id: r1.id });
  assert.equal(ok.body.ok, true);
  const del = await admin.post(`/du-an/${pid2}/xoa`);
  assert.match(del.location, /err=in_use/);
  assert.match((await admin.get(del.location)).text, /1 dòng nhập hằng ngày/);
});

test('Xuất Excel theo dự án; chưa đăng nhập bị chặn', async () => {
  const x = await user.get(`/nhap-hang-ngay/xuat-excel?du_an=${pid}&all=1`);
  assert.equal(x.status, 200);
  assert.equal(x.body.slice(0, 2).toString(), 'PK');
  const anon = srv.browser();
  assert.equal((await anon.get('/nhap-hang-ngay')).location, '/login');
  const api = await anon.json('/nhap-hang-ngay/api/luu', row({}));
  assert.notEqual(api.status, 200);
});
