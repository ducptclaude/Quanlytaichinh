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

test('Doanh thu / Chi phí: gắn dự án, 3 cột tiền (chưa VAT, VAT, sau VAT), khoản mục', async () => {
  const bad = await user.post('/doanh-thu/moi', { code: 'DT-1', project_id: '9999', doc_date: '2026-13-01', content: '', amount: '-5' });
  assert.equal(bad.status, 400);
  assert.match(bad.text, /Dự án: chưa chọn hoặc không còn tồn tại/);
  assert.match(bad.text, /Ngày: ngày không hợp lệ/);
  assert.match(bad.text, /không được âm/);

  // Số phiếu tự đề xuất
  assert.match((await user.get('/doanh-thu/moi')).text, /name="code" value="DT-0001"/);

  const rev = [['DT-1', 'DA-10', '2026-01-15', '10.000.000.000', '1.000.000.000'], ['DT-2', 'DA-10', '2026-06-15', '5.000.000.000', ''],
    ['DT-3', 'DA-2', '2026-03-01', '2.000.000.000', '160.000.000']];
  for (const [code, p, d, a, v] of rev) {
    const r = await user.post('/doanh-thu/moi', { code, project_id: String(ids[p]), doc_date: d, content: `Thu ${code}`, kind: 'Tạm ứng', amount: a, vat_amount: v, total_amount: '999' });
    assert.equal(r.location, '/doanh-thu?ok=created', code);
  }
  // Chi phí: 1 dòng = 1 hợp đồng; mã CP-0001 do hệ thống tự đánh (mã gửi lên bị bỏ qua)
  const cost = [
    ['HD-01', 'DA-10', '2026-02-01', '6.000.000.000', '600.000.000', 'TT01', 'Phần thân', 'Thép Hòa Phát'],
    ['', 'DA-10', '2026-02-10', '1.000.000.000', '', 'GT02', 'Lương ban chỉ huy', ''],
    ['', 'DA-10', '2026-03-01', '1.500.000.000', '', 'TC02', 'Lãi vay tháng 2', 'Ngân hàng ACB'],
    ['HD-01', 'DA-2', '2026-03-05', '2.500.000.000', '200.000.000', 'TT04', 'Nhân công tổ đội', 'Tổ đội ông Nam'],
  ];
  for (const [no, p, d, a, v, item, content, supplier] of cost) {
    const r = await user.post('/chi-phi/moi', { code: 'BO-QUA', contract_no: no, supplier, project_id: String(ids[p]), doc_date: d, content, cost_item: item, amount: a, vat_amount: v });
    assert.equal(r.location, '/chi-phi?ok=created', content);
  }
  const form0 = await user.get('/chi-phi/moi');
  assert.doesNotMatch(form0.text, /name="code"/); // không còn ô mã trên biểu mẫu
  assert.match(form0.text, /Thuộc hợp đồng chủ đầu tư/);
  assert.match(form0.text, /class="date-pick"/); // có nút chọn trên lịch
  const listAll = await user.get('/chi-phi');
  assert.match(listAll.text, /CP-0004/);
  assert.doesNotMatch(listAll.text, /BO-QUA/);
  // Số HĐ trùng trong CÙNG nhà cung cấp -> chặn (không phân biệt hoa/thường, dấu); khác nhà cung cấp -> được
  const dupNo = await user.post('/chi-phi/moi', { contract_no: 'hd-01', supplier: 'thep hoa phat', project_id: String(ids['DA-1']), doc_date: '2026-01-01', content: 'x', cost_item: 'TT01', amount: '100' });
  assert.equal(dupNo.status, 400);
  assert.match(dupNo.text, /Số hợp đồng &quot;hd-01&quot; đã có cho/);
  // Sửa chính dòng đó (giữ nguyên Số HĐ) vẫn lưu được, mã không đổi
  const firstId = Number((listAll.text.match(/href="\/chi-phi\/(\d+)">CP-0001</) || [])[1]);
  const keep = await user.post(`/chi-phi/${firstId}`, { code: 'DOI-MA', contract_no: 'HD-01', supplier: 'Thép Hòa Phát', project_id: String(ids['DA-10']), doc_date: '01/02/2026', content: 'Phần thân', cost_item: 'TT01', amount: '6.000.000.000', vat_amount: '600.000.000' });
  assert.equal(keep.location, `/chi-phi/${firstId}?ok=updated`);
  assert.match((await user.get(`/chi-phi/${firstId}`)).text, /<dd>CP-0001<\/dd>/);

  const noItem = await user.post('/chi-phi/moi', { project_id: String(ids['DA-1']), doc_date: '2026-01-01', content: 'x', amount: '100' });
  assert.match(noItem.text, /Chưa nhập Nhóm chi phí/);
  const zero = await user.post('/chi-phi/moi', { project_id: String(ids['DA-1']), doc_date: '2026-01-01', content: 'x', cost_item: 'TT01', amount: '0' });
  assert.match(zero.text, /phải lớn hơn 0/);
  const vatHigh = await user.post('/chi-phi/moi', { project_id: String(ids['DA-1']), doc_date: '2026-01-01', content: 'x', cost_item: 'TT01', amount: '1.000.000', vat_amount: '1.000.000' });
  assert.match(vatHigh.text, /VAT \(đ\): không được vượt 10% Giá trị hợp đồng \(tối đa 100\.000 đ\)/);
  const badItem = await user.post('/chi-phi/moi', { project_id: String(ids['DA-1']), doc_date: '2026-01-01', content: 'x', cost_item: 'Vật tư', amount: '100' });
  assert.match(badItem.text, /Nhóm chi phí: giá trị không hợp lệ/);
  const noDate = await user.post('/chi-phi/moi', { project_id: String(ids['DA-1']), content: 'x', cost_item: 'TT01', amount: '100' });
  assert.match(noDate.text, /Chưa nhập Ngày ký/);

  // Tổng sau VAT do máy tính (bỏ qua số người dùng gửi lên)
  const list = await user.get(`/doanh-thu?f_project_id=${ids['DA-10']}`);
  assert.match(list.text, /Tiền chưa VAT: <b>15\.000\.000\.000 đ<\/b>/);
  assert.match(list.text, /Tiền VAT: <b>1\.000\.000\.000 đ<\/b>/);
  assert.match(list.text, /Tổng sau VAT: <b>16\.000\.000\.000 đ<\/b>/);
  // Lọc theo nhóm chi phí, tìm không dấu theo tên khoản mục
  const g = await user.get('/chi-phi?f_cost_group=TC');
  assert.match(g.text, /CP-0003/);
  assert.doesNotMatch(g.text, /CP-0001</);
  const s = await user.get(`/chi-phi?q=${encodeURIComponent('vat tu chinh')}`);
  assert.match(s.text, /CP-0001/);
  assert.doesNotMatch(s.text, /CP-0004</);
  // Lãi vay: có lời nhắc chỉ nhập phần lãi
  const form = await user.get('/chi-phi/moi');
  assert.match(form.text, /<optgroup label="3\. Chi phí tài chính">/);
  assert.match(form.text, /data-warn="Chỉ nhập phần LÃI vay/);
  // Gợi ý khi gõ: nhà cung cấp / nội dung đã nhập
  assert.match(form.text, /<option value="Thép Hòa Phát">/);
});

test('Báo cáo: Lãi gộp, CP gián tiếp, tài chính, Lợi nhuận (chưa VAT); lọc theo ngày; chưa phân loại', async () => {
  const { buildReport } = require('../src/routes/reports');
  const fake = {
    async listRecords(k) {
      return {
        projects: [{ id: 1, code: 'A-2', name: 'A', status: 'Đang thi công', contract_value: 1000 },
          { id: 2, code: 'A-10', name: 'B', status: 'Đã hoàn thành', contract_value: null }],
        revenues: [{ project_id: 1, doc_date: '2026-01-01', amount: 400, vat_amount: 40 }, { project_id: 1, doc_date: '2026-05-01', amount: 100, vat_amount: 10 }],
        costs: [
          { project_id: 1, doc_date: '2026-01-10', amount: 200, vat_amount: 20, cost_item: 'TT01' },
          { project_id: 1, doc_date: '2026-01-11', amount: 50, cost_item: 'TT05' },
          { project_id: 1, doc_date: '2026-03-01', amount: 60, cost_item: 'GT02' },
          { project_id: 1, doc_date: '2026-03-02', amount: 40, cost_item: 'TC02' },
          { project_id: 2, doc_date: '2026-02-01', amount: 30, cost_item: null }, // dữ liệu cũ chưa phân loại
        ],
      }[k];
    },
  };
  const rep = await buildReport(fake);
  assert.deepEqual(rep.rows.map((r) => r.code), ['A-2', 'A-10']);
  const a = rep.rows[0];
  assert.equal(a.revenue, 500); // chưa VAT, không cộng 50 VAT
  assert.equal(a.direct, 250); assert.equal(a.gross, 250); assert.equal(a.grossMargin, 50);
  assert.equal(a.indirect, 60); assert.equal(a.financial, 40);
  assert.equal(a.cost, 350); assert.equal(a.profit, 150); assert.equal(a.margin, 30); assert.equal(a.collected, 50);
  const b = rep.rows[1];
  assert.equal(b.unclassified, 30); assert.equal(b.profit, -30); assert.equal(b.margin, null); assert.equal(b.collected, null);
  assert.equal(rep.totals.profit, 120);
  assert.equal(rep.totals.unclassified, 30);
  const tt = rep.items.find((x) => x.key === 'TT');
  assert.equal(tt.amount, 250);
  assert.equal(tt.items.find((i) => i.value === 'TT01').amount, 200);
  assert.equal(rep.items.find((x) => x.key === 'NONE').amount, 30);
  const ranged = await buildReport(fake, { from: '01/01/2026', to: '31/01/2026' });
  assert.equal(ranged.rows[0].revenue, 400);
  assert.equal(ranged.rows[0].cost, 250);
  assert.equal(ranged.rows[0].profit, 150);
  assert.equal(ranged.rows[1].cost, 0);

  const page = await admin.get('/bao-cao');
  // DA-10: DT 15 tỷ; TT 6 tỷ -> lãi gộp 9 tỷ (60%); GT 1 tỷ; TC 1,5 tỷ -> LN 6,5 tỷ (43,3%), thu/HĐ 30%
  assert.match(page.text, /9\.000\.000\.000/);
  assert.match(page.text, /60%/);
  assert.match(page.text, /6\.500\.000\.000/);
  assert.match(page.text, /43,3%/);
  // DA-2: DT 2 tỷ, CP 2,5 tỷ -> lỗ 500 triệu
  assert.match(page.text, /class="num neg"><b>-500\.000\.000/);
  assert.match(page.text, /Lãi vay ngân hàng \(chỉ phần lãi\)/);
});

test('Xóa: chỉ Quản trị; không xóa được dự án đang có doanh thu/chi phí', async () => {
  const forbidden = await user.post(`/du-an/${ids['DA-1']}/xoa`);
  assert.equal(forbidden.status, 403);
  const inUse = await admin.post(`/du-an/${ids['DA-10']}/xoa`);
  assert.match(inUse.location, /err=in_use/);
  const msg = await admin.get(inUse.location);
  assert.match(msg.text, /2 khoản doanh thu, 3 hợp đồng chi phí/);
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
