'use strict';
/** Bài thử: Dự án / Doanh thu / Chi phí / Báo cáo / Xuất Excel */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, PW } = require('./helpers');
const T = require('../src/text');

/* ---------- Hàm xử lý chữ / số ---------- */
test('bỏ dấu, sắp xếp tự nhiên, đọc số tiền, đọc ngày', () => {
  assert.equal(T.normalize('Đường Láng – HÀ NỘI'), 'duong lang – ha noi');
  assert.ok(T.matches('Chung cư Đông Đô', 'dong do'));
  assert.ok(T.matches('Chung cư Đông Đô', 'ĐÔNG chung'));
  assert.ok(!T.matches('Chung cư Đông Đô', 'tay do'));
  assert.deepEqual(['MA-10', 'MA-2', 'ma-1', 'MA-1A'].sort(T.naturalCompare), ['ma-1', 'MA-1A', 'MA-2', 'MA-10']);
  assert.equal(T.parseMoney('1.250.000.000'), 1250000000);
  assert.equal(T.parseMoney('1,250,000'), 1250000);
  assert.equal(T.parseMoney(''), null);
  assert.ok(Number.isNaN(T.parseMoney('12a')));
  assert.equal(T.parseDate('2026-02-28'), '2026-02-28');
  assert.equal(T.parseDate('5/3/2026'), '2026-03-05');
  assert.ok(Number.isNaN(T.parseDate('2026-02-30')));
});

/* ---------- Luồng trên web ---------- */
let srv; let admin; let user;
const ids = {};

before(async () => {
  srv = await startServer();
  const b = srv.browser();
  await b.post('/setup', { company_name: 'ABC', app_name: 'QLTC', full_name: 'Quản Trị', username: 'admin', password: PW, password2: PW });
  admin = srv.browser();
  await admin.post('/login', { username: 'admin', password: PW });
  await admin.post('/tai-khoan/moi', { full_name: 'Kế Toán Viên', username: 'ketoan', role: 'user', password: PW, password2: PW });
  user = srv.browser();
  await user.post('/login', { username: 'ketoan', password: PW });
});
after(async () => srv && srv.stop());

const idFromList = (html, code) => {
  const m = html.match(new RegExp(`href="/[a-z-]+/(\\d+)">${code}</a>`));
  return m && Number(m[1]);
};

test('Dự án: thêm mới, bắt buộc, mã không trùng (kể cả khác hoa/thường)', async () => {
  const miss = await admin.post('/du-an/moi', { code: '', name: '', status: 'Đang thi công' });
  assert.equal(miss.status, 400);
  assert.match(miss.text, /Chưa nhập Mã dự án/);
  assert.match(miss.text, /Chưa nhập Tên dự án/);

  for (const [code, name, status, value] of [
    ['DA-10', 'Chung cư Đông Đô', 'Đang thi công', '50.000.000.000'],
    ['DA-2', 'Nhà xưởng Bình Dương', 'Chuẩn bị thi công', '12.000.000.000'],
    ['DA-1', 'Trường học Hòa Bình', 'Đã hoàn thành', ''],
  ]) {
    const r = await admin.post('/du-an/moi', { code, name, status, contract_value: value, investor: 'Sở GD', category: 'Dân dụng' });
    assert.equal(r.location, '/du-an?ok=created', `thêm ${code}`);
  }
  const dup = await user.post('/du-an/moi', { code: 'da-10', name: 'Trùng', status: 'Đang thi công' });
  assert.equal(dup.status, 400);
  assert.match(dup.text, /đã tồn tại/);

  const bad = await admin.post('/du-an/moi', { code: 'DA 99 có dấu', name: 'X', status: 'Lạ', contract_value: 'abc', start_date: '2026-05-01', end_date: '2026-01-01' });
  assert.match(bad.text, /chỉ gồm chữ không dấu/);
  assert.match(bad.text, /Trạng thái: giá trị không hợp lệ/);
  assert.match(bad.text, /chỉ nhập số/);
  assert.match(bad.text, /không được trước ngày khởi công/);
});

test('Dự án: sắp xếp mã đúng thứ tự (DA-2 trước DA-10), tìm không dấu, lọc trạng thái', async () => {
  const list = await admin.get('/du-an');
  const order = [...list.text.matchAll(/class="code" href="\/du-an\/\d+">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(order, ['DA-1', 'DA-2', 'DA-10']);
  for (const c of order) ids[c] = idFromList(list.text, c);

  const desc = await admin.get('/du-an?sort=code&dir=desc');
  assert.deepEqual([...desc.text.matchAll(/class="code" href="\/du-an\/\d+">([^<]+)</g)].map((m) => m[1]), ['DA-10', 'DA-2', 'DA-1']);

  const s = await admin.get(`/du-an?q=${encodeURIComponent('dong do')}`);
  assert.match(s.text, /Chung cư Đông Đô/);
  assert.doesNotMatch(s.text, /Nhà xưởng/);

  const f = await admin.get(`/du-an?f_status=${encodeURIComponent('Đã hoàn thành')}`);
  assert.match(f.text, /Trường học Hòa Bình/);
  assert.doesNotMatch(f.text, /Chung cư Đông Đô/);

  const byValue = await admin.get('/du-an?sort=contract_value&dir=desc');
  assert.deepEqual([...byValue.text.matchAll(/class="code" href="\/du-an\/\d+">([^<]+)</g)].map((m) => m[1]), ['DA-10', 'DA-2', 'DA-1']);
});

test('Sửa: ghi tên người cập nhật cuối; không đổi mã thành mã đã có', async () => {
  const id = ids['DA-2'];
  const r = await user.post(`/du-an/${id}`, { code: 'DA-2', name: 'Nhà xưởng Bình Dương GĐ1', status: 'Đang thi công', contract_value: '12.000.000.000' });
  assert.equal(r.location, `/du-an/${id}?ok=updated`);
  const page = await admin.get(`/du-an/${id}`);
  assert.match(page.text, /Cập nhật cuối<\/dt><dd>Kế Toán Viên/);
  assert.match(page.text, /Tạo bởi<\/dt><dd>Quản Trị/);
  const list = await admin.get('/du-an');
  assert.match(list.text, /Kế Toán Viên/);
  const dup = await user.post(`/du-an/${id}`, { code: 'DA-10', name: 'X', status: 'Đang thi công' });
  assert.match(dup.text, /đã tồn tại/);
});

test('Doanh thu / Chi phí: gắn dự án, số tiền hợp lệ, tổng cộng', async () => {
  const bad = await user.post('/doanh-thu/moi', { code: 'DT-1', project_id: '9999', doc_date: '2026-13-01', content: '', amount: '-5' });
  assert.equal(bad.status, 400);
  assert.match(bad.text, /Dự án: chưa chọn hoặc không còn tồn tại/);
  assert.match(bad.text, /Ngày: ngày không hợp lệ/);
  assert.match(bad.text, /không được âm/);

  const rev = [['DT-1', 'DA-10', '2026-01-15', '10.000.000.000'], ['DT-2', 'DA-10', '2026-06-15', '5.000.000.000'], ['DT-3', 'DA-2', '2026-03-01', '2.000.000.000']];
  for (const [code, p, d, a] of rev) {
    const r = await user.post('/doanh-thu/moi', { code, project_id: String(ids[p]), doc_date: d, content: `Thu ${code}`, kind: 'Tạm ứng', amount: a });
    assert.equal(r.location, '/doanh-thu?ok=created', code);
  }
  const cost = [['CP-1', 'DA-10', '2026-02-01', '8.500.000.000', 'Vật tư'], ['CP-2', 'DA-2', '2026-03-05', '2.500.000.000', 'Nhân công']];
  for (const [code, p, d, a, t] of cost) {
    const r = await user.post('/chi-phi/moi', { code, project_id: String(ids[p]), doc_date: d, content: `Chi ${code}`, cost_type: t, amount: a });
    assert.equal(r.location, '/chi-phi?ok=created', code);
  }
  const zero = await user.post('/chi-phi/moi', { code: 'CP-9', project_id: String(ids['DA-1']), doc_date: '2026-01-01', content: 'x', amount: '0' });
  assert.match(zero.text, /phải lớn hơn 0/);

  const list = await user.get(`/doanh-thu?f_project_id=${ids['DA-10']}`);
  assert.match(list.text, /Số tiền: <b>15\.000\.000\.000 đ<\/b>/);
  const s = await user.get(`/chi-phi?q=${encodeURIComponent('vat tu')}`);
  assert.match(s.text, /CP-1/);
  assert.doesNotMatch(s.text, /CP-2</);
});

test('Báo cáo: công thức Lợi nhuận, Tỷ suất, % Thu/HĐ; lọc theo ngày', async () => {
  const { buildReport } = require('../src/routes/reports');
  const fake = {
    async listRecords(k) {
      return {
        projects: [{ id: 1, code: 'A-2', name: 'A', status: 'Đang thi công', contract_value: 1000 },
          { id: 2, code: 'A-10', name: 'B', status: 'Đã hoàn thành', contract_value: null }],
        revenues: [{ project_id: 1, doc_date: '2026-01-01', amount: 400 }, { project_id: 1, doc_date: '2026-05-01', amount: 100 }],
        costs: [{ project_id: 1, doc_date: '2026-01-10', amount: 350 }, { project_id: 2, doc_date: '2026-02-01', amount: 30 }],
      }[k];
    },
  };
  const rep = await buildReport(fake);
  assert.deepEqual(rep.rows.map((r) => r.code), ['A-2', 'A-10']);
  const a = rep.rows[0];
  assert.equal(a.revenue, 500); assert.equal(a.cost, 350); assert.equal(a.profit, 150);
  assert.equal(a.margin, 30); assert.equal(a.collected, 50);
  const b = rep.rows[1];
  assert.equal(b.profit, -30); assert.equal(b.margin, null); assert.equal(b.collected, null);
  assert.equal(rep.totals.profit, 120);
  const ranged = await buildReport(fake, { from: '2026-01-01', to: '2026-01-31' });
  assert.equal(ranged.rows[0].revenue, 400);
  assert.equal(ranged.rows[0].profit, 50);
  assert.equal(ranged.rows[1].cost, 0);

  const page = await admin.get('/bao-cao');
  // DA-10: DT 15 tỷ, CP 8,5 tỷ -> LN 6,5 tỷ, tỷ suất 43,3%, thu/HĐ 30%
  assert.match(page.text, /6\.500\.000\.000/);
  assert.match(page.text, /43,3%/);
  assert.match(page.text, /30%/);
  // DA-2: DT 2 tỷ, CP 2,5 tỷ -> lỗ 500 triệu
  assert.match(page.text, /class="num neg"><b>-500\.000\.000/);
});

test('Xóa: chỉ Quản trị; không xóa được dự án đang có doanh thu/chi phí', async () => {
  const forbidden = await user.post(`/du-an/${ids['DA-1']}/xoa`);
  assert.equal(forbidden.status, 403);
  const inUse = await admin.post(`/du-an/${ids['DA-10']}/xoa`);
  assert.match(inUse.location, /err=in_use/);
  const msg = await admin.get(inUse.location);
  assert.match(msg.text, /2 khoản doanh thu, 1 khoản chi phí/);
  const ok = await admin.post(`/du-an/${ids['DA-1']}/xoa`);
  assert.equal(ok.location, '/du-an?ok=deleted');
  assert.doesNotMatch((await admin.get('/du-an')).text, /Trường học Hòa Bình/);
});

test('Xuất Excel: đúng định dạng file .xlsx', async () => {
  for (const url of ['/du-an/xuat-excel', `/doanh-thu/xuat-excel?f_project_id=${ids['DA-10']}`, '/chi-phi/xuat-excel', '/bao-cao/xuat-excel']) {
    const r = await user.get(url);
    assert.equal(r.status, 200, url);
    assert.match(r.type, /spreadsheetml/);
    assert.equal(r.body.slice(0, 2).toString(), 'PK', url);
  }
});

test('Chưa đăng nhập thì không xem được danh mục', async () => {
  const r = await srv.browser().get('/du-an');
  assert.equal(r.location, '/login');
  const x = await srv.browser().get('/bao-cao/xuat-excel');
  assert.equal(x.location, '/login');
});
