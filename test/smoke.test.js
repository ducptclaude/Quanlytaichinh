'use strict';
/**
 * Chạy thử tự động toàn bộ luồng chính:  npm test
 * Mặc định chạy chế độ bộ nhớ tạm. Muốn thử với PostgreSQL:
 *   TEST_DATABASE_URL=postgres://... npm test   (nên dùng kho dữ liệu trống, dành riêng để thử)
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const PW = 'Abcd@1234';
let server;

before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: process.env.TEST_DATABASE_URL || '', APP_ENV: 'staging' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) return; } catch (_) { /* chờ */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Máy chủ không khởi động được');
});
after(() => server && server.kill());

/** Trình duyệt giả lập có giữ cookie */
function browser() {
  let cookie = '';
  async function req(method, url, form) {
    const res = await fetch(BASE + url, {
      method, redirect: 'manual',
      headers: { cookie, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) {
      const m = set.match(/sid=([^;]*)/);
      if (m) cookie = m[1] ? `sid=${m[1]}` : '';
    }
    return { status: res.status, location: res.headers.get('location') || '', text: await res.text() };
  }
  return { get: (u) => req('GET', u), post: (u, f) => req('POST', u, f) };
}
async function login(username, password = PW) {
  const b = browser();
  const r = await b.post('/login', { username, password });
  return { b, r };
}
async function userId(admin, username) {
  const list = await admin.get('/tai-khoan');
  const re = new RegExp(`<b>[^<]*</b>(?:(?!</tr>).)*?${username}</td>(?:(?!</tr>).)*?/tai-khoan/(\\d+)"`, 's');
  const m = list.text.match(re);
  assert.ok(m, `không thấy tài khoản ${username}`);
  return m[1];
}

let admin; // phiên của Quản trị gốc

test('health + chưa khởi tạo thì chuyển về /setup', async () => {
  const h = await (await fetch(`${BASE}/health`)).json();
  assert.equal(h.status, 'ok');
  assert.match(h.version, /^V\d+\.\d{2}\.\d{2}\.\d{4}$/);
  assert.equal(h.environment, 'staging');
  const r = await browser().get('/');
  assert.equal(r.location, '/setup');
});

test('khởi tạo: từ chối mật khẩu yếu, sau đó khởi tạo được và tự khóa', async () => {
  const b = browser();
  const weak = await b.post('/setup', { company_name: 'ABC', app_name: 'QLTC', full_name: 'Quản trị', username: 'admin', password: 'abc', password2: 'abc' });
  assert.equal(weak.status, 400);
  const ok = await b.post('/setup', { company_name: 'ABC', app_name: 'QLTC', full_name: 'Quản trị', username: 'admin', password: PW, password2: PW });
  assert.match(ok.text, /Khởi tạo thành công/);
  assert.match(ok.text, /HỆ THỐNG THỬ NGHIỆM/);
  const again = await b.post('/setup', { company_name: 'X', app_name: 'X', full_name: 'X', username: 'hacker', password: PW, password2: PW });
  assert.equal(again.location, '/login');
});

test('đăng nhập Quản trị, thấy tab Tài khoản', async () => {
  const { b, r } = await login('admin');
  assert.equal(r.location, '/');
  admin = b;
  const home = await admin.get('/');
  assert.match(home.text, /href="\/tai-khoan"/);
});

test('tạo tài khoản: chặn trùng tên và mật khẩu yếu', async () => {
  const weak = await admin.post('/tai-khoan/moi', { full_name: 'Nhân viên A', username: 'nva', role: 'user', password: '123', password2: '123' });
  assert.equal(weak.status, 400);
  const ok = await admin.post('/tai-khoan/moi', { full_name: 'Nhân viên A', username: 'nva', role: 'user', password: PW, password2: PW });
  assert.equal(ok.location, '/tai-khoan?ok=created');
  const dup = await admin.post('/tai-khoan/moi', { full_name: 'Trùng', username: 'NVA', role: 'user', password: PW, password2: PW });
  assert.match(dup.text, /đã tồn tại/);
});

test('người dùng thường không vào được Quản lý tài khoản, không sửa được Liên hệ', async () => {
  const { b } = await login('nva');
  const r = await b.get('/tai-khoan');
  assert.equal(r.status, 403);
  await b.post('/lien-he', { contact_phone: '0999999999' });
  const c = await b.get('/lien-he');
  assert.doesNotMatch(c.text, /0999999999/);
  assert.doesNotMatch(c.text, /Sửa thông tin liên hệ/);
});

test('không tự khóa / tự xóa / tự hạ quyền; luôn còn ít nhất 1 Quản trị', async () => {
  const myId = await userId(admin, 'admin');
  assert.match((await admin.post(`/tai-khoan/${myId}/khoa`)).location, /err=self/);
  assert.match((await admin.post(`/tai-khoan/${myId}/xoa`)).location, /err=self/);
  await admin.post(`/tai-khoan/${myId}/sua`, { full_name: 'Quản trị', role: 'user' });
  const me = await admin.get('/ca-nhan');
  assert.match(me.text, /<dd>Quản trị<\/dd>/); // vai trò vẫn là Quản trị

  // Quản trị thứ 2 hạ quyền / khóa Quản trị gốc: được, nhưng không được làm mất Quản trị cuối cùng
  await admin.post('/tai-khoan/moi', { full_name: 'QT 2', username: 'qt2', role: 'admin', password: PW, password2: PW, must_change: '' });
  const { b: qt2 } = await login('qt2');
  const r1 = await qt2.post(`/tai-khoan/${myId}/sua`, { full_name: 'Quản trị', role: 'user' });
  assert.match(r1.location, /ok=updated/);
  const qt2Id = await userId(qt2, 'qt2');
  // admin gốc giờ là người dùng thường -> không còn quyền
  assert.equal((await admin.get('/tai-khoan')).status, 403);
  // qt2 là Quản trị duy nhất -> tự hạ quyền bị chặn
  await qt2.post(`/tai-khoan/${qt2Id}/sua`, { full_name: 'QT 2', role: 'user' });
  assert.equal((await qt2.get('/tai-khoan')).status, 200);
  // khôi phục admin gốc
  assert.match((await qt2.post(`/tai-khoan/${myId}/sua`, { full_name: 'Quản trị', role: 'admin' })).location, /ok=updated/);
  assert.equal((await admin.get('/tai-khoan')).status, 200);
});

test('khóa tài khoản -> bị đăng xuất, không đăng nhập được; mở khóa lại được', async () => {
  const { b: user } = await login('nva');
  const id = await userId(admin, 'nva');
  assert.match((await admin.post(`/tai-khoan/${id}/khoa`)).location, /ok=locked/);
  assert.equal((await user.get('/')).location, '/login');
  assert.match((await login('nva')).r.text, /đã bị khóa/);
  await admin.post(`/tai-khoan/${id}/mo-khoa`);
  assert.equal((await login('nva')).r.location, '/');
});

test('đặt lại mật khẩu -> người dùng bắt buộc đổi mật khẩu', async () => {
  const id = await userId(admin, 'nva');
  const NEW = 'Tam@thoi99';
  assert.match((await admin.post(`/tai-khoan/${id}/dat-lai-mat-khau`, { password: NEW, password2: NEW, must_change: '1' })).location, /ok=reset/);
  assert.equal((await login('nva')).r.status, 401); // mật khẩu cũ hết hiệu lực
  const { b, r } = await login('nva', NEW);
  assert.equal(r.location, '/ca-nhan');
  assert.equal((await b.get('/')).location, '/ca-nhan'); // chưa đổi thì không đi đâu được
  const same = await b.post('/ca-nhan/doi-mat-khau', { current_password: NEW, password: NEW, password2: NEW });
  assert.match(same.text, /phải khác/);
  const ok = await b.post('/ca-nhan/doi-mat-khau', { current_password: NEW, password: PW, password2: PW });
  assert.equal(ok.location, '/ca-nhan?ok=pw');
  assert.equal((await b.get('/')).status, 200);
});

test('đổi mật khẩu: sai mật khẩu hiện tại bị từ chối', async () => {
  const { b } = await login('nva');
  const r = await b.post('/ca-nhan/doi-mat-khau', { current_password: 'Sai@12345', password: 'Moi@12345', password2: 'Moi@12345' });
  assert.match(r.text, /không đúng/);
});

test('Liên hệ: Quản trị sửa được, kiểm tra email/số điện thoại', async () => {
  const bad = await admin.post('/lien-he', { contact_phone: 'abc', contact_email: 'khong-hop-le' });
  assert.equal(bad.status, 400);
  const ok = await admin.post('/lien-he', { contact_person: 'Phòng HC', contact_phone: '0901 234 567', contact_email: 'hotro@abc.vn' });
  assert.equal(ok.location, '/lien-he?ok=1');
  const page = await admin.get('/lien-he');
  assert.match(page.text, /0901 234 567/);
  assert.match(page.text, /hotro@abc\.vn/);
  assert.match(page.text, /V\d+\.\d{2}\.\d{2}\.\d{4}/);
  const loginPage = await browser().get('/login');
  assert.match(loginPage.text, /0901 234 567/);
});

test('xóa tài khoản', async () => {
  const id = await userId(admin, 'qt2');
  assert.equal((await admin.post(`/tai-khoan/${id}/xoa`)).location, '/tai-khoan?ok=deleted');
  assert.equal((await login('qt2')).r.status, 401);
});

test('đăng nhập sai 5 lần -> tạm khóa', async () => {
  let last;
  for (let i = 0; i < 5; i++) last = (await login('nva', 'Sai@00000')).r;
  assert.match(last.text, /Tạm khóa/);
  assert.equal((await login('nva')).r.status, 429);
});

test('kho dữ liệu: chặn mọi thao tác làm mất Quản trị cuối cùng (lớp bảo vệ thứ 2)', async () => {
  const { createStore } = require('../src/db');
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const s = createStore();
  process.env.DATABASE_URL = saved || '';
  await s.completeSetup({ settings: {}, admin: { username: 'a', full_name: 'A', password_hash: 'x' } });
  await assert.rejects(s.updateUser(1, { role: 'user' }), { code: 'last_admin' });
  await assert.rejects(s.updateUser(1, { is_active: false }), { code: 'last_admin' });
  await assert.rejects(s.deleteUser(1), { code: 'last_admin' });
  assert.equal((await s.getUser(1)).role, 'admin');
});
