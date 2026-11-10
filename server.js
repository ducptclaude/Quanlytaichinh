const express = require('express');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/db');
const auth = require('./lib/auth');
const security = require('./lib/security');
const audit = require('./lib/audit');
const { TP_NHOM, TRANG_THAI, ROLES, QUYEN, validateProject, validateUser, validateSettings, validateContact, validateTarget, validateRevenue, validateTienVe, validateCost, validateTp, validateTpLine, validateTpPay, passwordErrors, passcodeErrors } = require('./lib/validate');
const { buildContracts, summarizeContracts } = require('./lib/subcontract');
const { KHOI_CHI_PHI, NHOM_CHI_PHI, summarizeCost, sortCost, costLine } = require('./lib/cost');
const { summarizeProject } = require('./lib/dashboard');
const { projectReport } = require('./lib/report');
const { DEMO_PREFIX, seedDemo } = require('./lib/demo');
const { buildDtcp, costLinesFor, congTy } = require('./lib/export-dtcp');
const PHIEN_BAN = require('./lib/version').readVersion(); // đọc 1 lần khi khởi động
// Tài khoản khách (Chỉ xem, dùng 1 lần): dùng 30 phút tính từ lần đăng nhập đầu, hết hạn thì tự xóa; tạo mà quá 24 giờ chưa đăng nhập cũng tự xóa
const KHACH_PHUT = Math.max(1, Math.round(Number(process.env.KHACH_PHUT) || 30)), KHACH_CHUA_DUNG_GIO = 24; // KHACH_PHUT: biến môi trường để chạy thử nhanh (mặc định 30)
const khachHetHan = (u) => Boolean(u?.khach && u.het_han && new Date(u.het_han).getTime() <= Date.now());
const gioVN = (t) => new Date(t).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
let donKhachChay = false;
async function donKhach() { // xóa tài khoản khách hết hạn + ghi nhật ký (chạy mỗi phút và khi phát hiện khách hết hạn)
  if (donKhachChay || !dbState.ready) return;
  donKhachChay = true;
  try {
    for (const u of await store.listExpiredGuests(KHACH_CHUA_DUNG_GIO)) {
      if (!(await store.deleteUser(u.id))) continue;
      const ly_do = u.het_han ? `hết ${KHACH_PHUT} phút sử dụng (hạn ${gioVN(u.het_han)})` : `tạo quá ${KHACH_CHUA_DUNG_GIO} giờ chưa đăng nhập`;
      await store.addLog({ username: 'he-thong', ho_ten: 'Hệ thống', hanh_dong: 'Xóa', doi_tuong: 'Tài khoản khách', noi_dung: `Tự xóa ${u.username} (${u.full_name}) – ${ly_do}` });
      console.log(`[KHÁCH] Tự xóa ${u.username} – ${ly_do}`);
    }
  } catch (e) { console.error('Lỗi dọn tài khoản khách:', e.message); } finally { donKhachChay = false; }
}
const { LOAI_DOANH_THU, calcLine, markTamTinh, summarize, sortRevenue, tienVeLabel, sortTienVe, summarizeTienVe } = require('./lib/revenue');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ENV = (process.env.APP_ENV || 'production').trim().toLowerCase();
const SETUP_TOKEN = (process.env.SETUP_TOKEN || '').trim();

app.set('trust proxy', 1); // Railway đứng sau proxy HTTPS
app.disable('x-powered-by');
app.use(security.headers);   // header bảo mật (CSP, HSTS, chặn iframe...)
// Yêu cầu nội bộ khi DUYỆT: máy chủ tự gửi lại yêu cầu gốc của người nhập tới chính nó (chỉ từ máy này, có mã bí mật sinh lúc khởi động)
const NOI_BO = require('crypto').randomBytes(32).toString('hex');
app.use((req, _res, next) => {
  const k = req.get('X-Noi-Bo');
  const ip = req.socket?.remoteAddress || '';
  if (k && k.length === NOI_BO.length && require('crypto').timingSafeEqual(Buffer.from(k), Buffer.from(NOI_BO)) && /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip)) {
    req.noiBo = Number(req.get('X-Noi-Bo-User')) || 0;
  }
  next();
});
app.use((req, res, next) => (req.noiBo !== undefined ? next() : security.rateLimit(req, res, next))); // giới hạn tần suất theo IP, vượt ngưỡng chặn tạm thời
app.use(express.json({ limit: '1mb' }));

// Trạng thái kết nối CSDL (web vẫn chạy khi CSDL lỗi để hiển thị nguyên nhân)
const dbState = { ready: false, error: null, attempts: 0 };

// Health check cho Railway: luôn trả 200 khi web đang chạy, kèm tình trạng CSDL
app.get('/health', async (_req, res) => {
  if (dbState.ready) {
    try {
      await store.ping();
    } catch (e) {
      return res.json({ status: 'db_error', db: store.kind, target: store.target, error: e.message });
    }
  }
  res.json({
    status: dbState.ready ? 'ok' : 'db_error',
    db: store.kind,
    target: store.target,
    ...(dbState.ready ? {} : { error: dbState.error || 'Đang kết nối...', attempts: dbState.attempts }),
  });
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Khi CSDL chưa sẵn sàng: trả trang báo lỗi rõ ràng thay vì 502
app.use((req, res, next) => {
  if (dbState.ready) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({ errors: ['Chưa kết nối được cơ sở dữ liệu: ' + (dbState.error || 'đang kết nối...')] });
  }
  res.status(503).type('html').send(dbErrorPage());
});
app.use(auth.loadUser);
// Yêu cầu nội bộ khi duyệt: chạy dưới tên người nhập (nhật ký ghi đúng người nhập)
app.use((req, _res, next) => {
  if (req.noiBo === undefined) return next();
  store.getUserById(req.noiBo).then((u) => { if (u) req.user = { ...u, active: true }; next(); }).catch(next);
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const view = (name) => path.join(__dirname, 'views', name);
const parseId = (v) => {
  const id = Number(v);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const bad = (res, errors, code = 400) => res.status(code).json({ errors: [].concat(errors) });
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// =====================================================================
// Trang (HTML)
// =====================================================================
app.get('/', wrap(async (req, res) => {
  if ((await store.countUsers()) === 0) return res.redirect('/setup');
  if (!req.user) return res.redirect('/login');
  res.sendFile(view('index.html'));
}));
app.get('/login', wrap(async (req, res) => {
  if ((await store.countUsers()) === 0) return res.redirect('/setup');
  if (req.user) return res.redirect('/');
  res.sendFile(view('login.html'));
}));
app.get('/setup', wrap(async (_req, res) => {
  if ((await store.countUsers()) > 0) return res.redirect('/login');
  res.sendFile(view('setup.html'));
}));

// =====================================================================
// API
// =====================================================================
const api = express.Router();
// Quyền theo nhóm thao tác (lib/validate.js QUYEN)
const quyen = (k) => auth.requireRole(...QUYEN[k]);
const canHd = quyen('hd'), canTien = quyen('tien'), canTd = quyen('td'), canXoaDa = quyen('xoa_da');
const canAny = auth.requireRole(...new Set([...QUYEN.hd, ...QUYEN.tien, ...QUYEN.ns]));
const canMoKhoa = auth.requireRole(...new Set([...QUYEN.hd, ...QUYEN.tien])); // mở khóa HĐ đầu vào: người sửa HĐ/PL hoặc thanh toán
api.use(security.sameOrigin);
api.use(auth.csrfGuard);

api.get('/meta', wrap(async (_req, res) => {
  const s = await store.getSettings();
  res.json({
    trang_thai: TRANG_THAI,
    loai_doanh_thu: LOAI_DOANH_THU,
    nhom_chi_phi: NHOM_CHI_PHI,
    khoi_chi_phi: KHOI_CHI_PHI,
    roles: ROLES, quyen: QUYEN, tp_nhom: TP_NHOM,
    db: store.kind,
    ten_cong_ty: s.ten_cong_ty,
    ten_he_thong: s.ten_he_thong,
    needs_setup: (await store.countUsers()) === 0,
    setup_token_required: Boolean(SETUP_TOKEN),
    phien_ban: PHIEN_BAN,
    idle_phut: store.IDLE_SEC / 60, // không thao tác quá số phút này -> tự đăng xuất
    moi_truong: APP_ENV, // 'staging' = hệ thống thử nghiệm (đặt biến APP_ENV trên Railway)
  });
}));

// ---------- Setup lần đầu ----------
api.post('/setup', wrap(async (req, res) => {
  const body = req.body || {};
  if (SETUP_TOKEN && !safeEq(body.setup_token || '', SETUP_TOKEN)) return bad(res, 'Mã khởi tạo (SETUP_TOKEN) không đúng', 403);
  const s = validateSettings(body);
  const u = validateUser({ ...body, role: 'admin' }, true);
  const errors = [...s.errors, ...u.errors];
  if (errors.length) return bad(res, errors);

  const id = await store.createFirstAdmin(
    { username: u.data.username, full_name: u.data.full_name, password_hash: await auth.hashPassword(u.data.password) },
    s.data);
  if (!id) return bad(res, 'Hệ thống đã được khởi tạo trước đó', 409);
  await auth.startSession(req, res, id);
  await store.touchLogin(id);
  res.status(201).json({ ok: true });
}));

// ---------- Đăng nhập / đăng xuất ----------
api.post('/auth/login', wrap(async (req, res) => {
  const ip = req.ip;
  const username = String(req.body?.username || '').trim().toLowerCase();
  const wait = Math.max(auth.loginBlocked(ip), auth.loginBlocked('u:' + username));
  if (wait) return bad(res, `Sai quá nhiều lần. Thử lại sau ${wait} phút`, 429);

  const password = String(req.body?.password || '');
  const user = await store.getUserForLogin(username);
  const ok = await auth.verifyPassword(password, user ? user.password_hash : auth.DUMMY_HASH);
  if (!user || !ok) {
    // khóa theo IP và theo tài khoản (chống dò mật khẩu từ nhiều IP vào 1 tài khoản)
    auth.loginFailed(ip);
    if (user) auth.loginFailed('u:' + username);
    security.loginFailedIp(ip);
    security.log(`Đăng nhập sai: "${username.slice(0, 50)}" từ IP ${ip}`);
    audit.log(req, 'Đăng nhập sai', 'Tài khoản', user ? 'Sai mật khẩu' : 'Tên đăng nhập không tồn tại', { username: username.slice(0, 50), ho_ten: user?.full_name || '', user_id: user?.id || null });
    return bad(res, 'Sai tên đăng nhập hoặc mật khẩu', 401);
  }
  if (!user.active) return bad(res, 'Tài khoản đã bị khóa. Liên hệ quản trị viên', 403);
  if (khachHetHan(user)) {
    audit.log(req, 'Đăng nhập sai', 'Tài khoản khách', `Đăng nhập khi đã hết ${KHACH_PHUT} phút sử dụng`, { username: user.username, ho_ten: user.full_name, user_id: user.id });
    donKhach();
    return bad(res, `Tài khoản khách đã hết thời gian sử dụng (${KHACH_PHUT} phút)`, 403);
  }
  // Khách chỉ dùng trên 1 thiết bị: thiết bị đăng nhập đầu được gắn, thiết bị khác bị từ chối (cookie thiết bị đặt sau khi tạo phiên)
  let tb = '';
  if (user.khach) {
    tb = auth.readCookie(req, 'tb') || '';
    const dev = crypto.createHash('sha256').update(/^[A-Za-z0-9_-]{20,64}$/.test(tb || '') ? tb : (tb = crypto.randomBytes(24).toString('base64url'))).digest('hex');
    const gan = await store.bindGuestDevice(user.id, dev);
    if (gan !== dev) {
      audit.log(req, 'Đăng nhập sai', 'Tài khoản khách', `Đăng nhập từ thiết bị khác (chỉ dùng trên 1 thiết bị) · ${audit.device(req.get('User-Agent'))}`, { username: user.username, ho_ten: user.full_name, user_id: user.id });
      return bad(res, 'Tài khoản khách chỉ dùng được trên thiết bị đã đăng nhập lần đầu', 403);
    }
  }
  auth.loginOk(ip);
  auth.loginOk('u:' + username);
  console.log(`[ĐĂNG NHẬP] ${new Date().toISOString()} ${user.username} từ IP ${ip}`);
  audit.log(req, 'Đăng nhập', 'Tài khoản', `Đăng nhập thành công · ${audit.device(req.get('User-Agent'))}`,
    { user_id: user.id, username: user.username, ho_ten: user.full_name });
  await auth.startSession(req, res, user.id);
  await store.touchLogin(user.id);
  if (user.khach) {
    auth.setDeviceCookie(req, res, tb);
    const han = await store.startGuestClock(user.id, KHACH_PHUT);
    if (!user.het_han && han) audit.log(req, 'Đăng nhập', 'Tài khoản khách', `Đăng nhập lần đầu – bắt đầu tính ${KHACH_PHUT} phút, hết hạn lúc ${gioVN(han)}`,
      { user_id: user.id, username: user.username, ho_ten: user.full_name });
  }
  res.json({ ok: true });
}));

api.post('/auth/logout', wrap(async (req, res) => {
  if (req.user) {
    const idle = req.body?.ly_do === 'het_phien';
    audit.log(req, idle ? 'Hết phiên' : 'Đăng xuất', 'Tài khoản', idle ? `Tự đăng xuất do không thao tác ${store.IDLE_SEC / 60} phút` : 'Đăng xuất');
  }
  await auth.endSession(req, res);
  res.json({ ok: true });
}));
// Trang đóng / tải lại -> tạm ngoại tuyến (gửi bằng fetch keepalive khi rời trang)
api.post('/auth/away', wrap(async (req, res) => {
  await auth.markAway(req);
  res.json({ ok: true });
}));

// Từ đây trở xuống: bắt buộc đăng nhập
api.use(auth.requireAuth);
// Khách hết hạn: đăng xuất ngay, xóa tài khoản
api.use(wrap(async (req, res, next) => {
  if (!khachHetHan(req.user)) return next();
  await auth.endSession(req, res);
  donKhach();
  return bad(res, `Tài khoản khách đã hết thời gian sử dụng (${KHACH_PHUT} phút)`, 401);
}));
// IT (Kỹ thuật hệ thống): chỉ vào phần kỹ thuật – không đọc / ghi số liệu dự án, báo cáo tài chính
const IT_DUOC_VAO = /^\/(meta|auth\/|users(\/|$)|nhat-ky|lien-he$|settings$)/;
api.use((req, res, next) => (req.user?.role === 'it' && !IT_DUOC_VAO.test(req.path) ? bad(res, 'Vai trò Kỹ thuật hệ thống không xem số liệu dự án', 403) : next()));
// Chỉ xem: chặn mọi lệnh ghi (trừ đăng xuất / tạm vắng / tự đổi mật khẩu) – chỉ đọc số liệu; đổi đơn vị tiền hiển thị lưu trên trình duyệt, không qua máy chủ
const CHI_XEM_DUOC_GHI = /^\/auth\/(logout|away|change-password)$/;
api.use((req, res, next) => (req.user?.role === 'viewer' && !['GET', 'HEAD'].includes(req.method) && !CHI_XEM_DUOC_GHI.test(req.path)
  ? bad(res, 'Vai trò Chỉ xem không được thay đổi hoặc xuất dữ liệu', 403) : next()));
// ===================== PHÊ DUYỆT (V02.09.11.26) =====================
// Tiền · giá trị hợp đồng · chốt TĐ · số dư đầu kỳ: người nhập KHÔNG có quyền duyệt -> yêu cầu được GIỮ ở hồ sơ "Chờ duyệt",
// CHƯA ghi vào số liệu (không tính vào tổng). Quản trị / Lãnh đạo duyệt -> máy chủ ghi đúng yêu cầu gốc; từ chối / hủy -> không ghi gì.
// Sửa / xóa nội dung đã duyệt: số cũ vẫn tính cho tới khi bản sửa / xóa được duyệt. Quản trị / Lãnh đạo nhập -> ghi ngay (tự duyệt).
const laDuyet = (req) => QUYEN.duyet.includes(req.user.role);
const Q_ANY = [...new Set([...QUYEN.hd, ...QUYEN.tien, ...QUYEN.ns])];
// [phương thức, đường dẫn, đối tượng, loại bản ghi, cách tìm dự án ('p' = id dự án trong đường dẫn, 'tp' = id HĐ thầu phụ, 'r' = id bản ghi, '' = không), quyền]
const DUYET_TRUOC = [
  ['POST', /^\/du-an\/(\d+)\/doanh-thu$/, 'Doanh thu', 'doanh_thu', 'p', QUYEN.hd],
  ['PUT', /^\/doanh-thu\/(\d+)$/, 'Doanh thu', 'doanh_thu', 'r', QUYEN.hd],
  ['DELETE', /^\/doanh-thu\/(\d+)$/, 'Doanh thu', 'doanh_thu', 'r', QUYEN.hd],
  ['POST', /^\/du-an\/(\d+)\/tien-ve$/, 'Tiền về', 'tien_ve', 'p', QUYEN.tien],
  ['PUT', /^\/tien-ve\/(\d+)$/, 'Tiền về', 'tien_ve', 'r', QUYEN.tien],
  ['DELETE', /^\/tien-ve\/(\d+)$/, 'Tiền về', 'tien_ve', 'r', QUYEN.tien],
  ['POST', /^\/du-an\/(\d+)\/chi-phi$/, 'Chi phí', 'chi_phi', 'p', QUYEN.tien],
  ['PUT', /^\/chi-phi\/(\d+)$/, 'Chi phí', 'chi_phi', 'r', QUYEN.tien],
  ['DELETE', /^\/chi-phi\/(\d+)$/, 'Chi phí', 'chi_phi', 'r', QUYEN.tien],
  ['POST', /^\/du-an\/(\d+)\/thau-phu$/, 'Thầu phụ', 'thau_phu', 'p', QUYEN.hd],
  ['PUT', /^\/thau-phu\/(\d+)$/, 'Thầu phụ', 'thau_phu', 'r', QUYEN.hd],
  ['DELETE', /^\/thau-phu\/(\d+)$/, 'Thầu phụ', 'thau_phu', 'r', QUYEN.hd],
  ['POST', /^\/thau-phu\/(\d+)\/hd-pl$/, 'Thầu phụ – HĐ/PL', 'tp_hd_pl', 'tp', QUYEN.hd],
  ['PUT', /^\/tp-hd-pl\/(\d+)$/, 'Thầu phụ – HĐ/PL', 'tp_hd_pl', 'r', QUYEN.hd],
  ['DELETE', /^\/tp-hd-pl\/(\d+)$/, 'Thầu phụ – HĐ/PL', 'tp_hd_pl', 'r', QUYEN.hd],
  ['POST', /^\/thau-phu\/(\d+)\/thanh-toan$/, 'Thầu phụ – thanh toán', 'tp_thanh_toan', 'tp', QUYEN.tien],
  ['PUT', /^\/tp-thanh-toan\/(\d+)$/, 'Thầu phụ – thanh toán', 'tp_thanh_toan', 'r', QUYEN.tien],
  ['DELETE', /^\/tp-thanh-toan\/(\d+)$/, 'Thầu phụ – thanh toán', 'tp_thanh_toan', 'r', QUYEN.tien],
  ['PUT', /^\/du-an\/(\d+)\/thoi-diem\/([123])$/, 'Thời điểm (TĐ)', 'td', 'p', QUYEN.td],
  ['DELETE', /^\/du-an\/(\d+)\/thoi-diem\/([123])$/, 'Thời điểm (TĐ)', 'td', 'p', QUYEN.td],
  ['PUT', /^\/du-an\/(\d+)\/bh$/, 'DT-CP dự kiến · BH/Khác', 'bh', 'p', Q_ANY],
  ['PUT', /^\/so-du-dau-ky$/, 'Số dư đầu kỳ', 'sddk', '', ['admin', 'ke_toan']],
];
const KIEM = { // kiểm tra dữ liệu ngay lúc gửi (lỗi báo ngay cho người nhập, không phải chờ tới lúc duyệt)
  doanh_thu: (b, m, cu) => validateRevenue(m === 'PUT' ? { ...b, loai: cu?.loai } : b), tien_ve: (b) => validateTienVe(b),
  chi_phi: (b, m) => validateCost(m === 'POST' ? { ...b, _new: true } : b),
  thau_phu: (b, m) => (m === 'POST' ? (() => { const t = validateTp(b), l = validateTpLine({ ...(b.hd || {}), ma_loai: 'HĐ' });
    return { data: { ...t.data, gia_tri: l.data.gia_tri, ngay: l.data.ngay }, errors: [...t.errors, ...l.errors] }; })() : validateTp(b)),
  tp_hd_pl: (b) => validateTpLine(b), tp_thanh_toan: (b) => validateTpPay(b),
};
const soTien = (x) => { const n = Number(String(x ?? '').replace(/[.,\s]/g, '')); return Number.isFinite(n) && String(x ?? '').trim() !== '' ? n : null; };
api.use(wrap(async (req, res, next) => {
  if (req.noiBo !== undefined || !req.user || !['POST', 'PUT', 'DELETE'].includes(req.method)) return next();
  const r = DUYET_TRUOC.find(([m, re]) => m === req.method && re.test(req.path));
  if (!r || laDuyet(req)) return next(); // không thuộc diện duyệt / người có quyền duyệt -> ghi ngay
  const [method, re, doi_tuong, kind, tim, roles] = r;
  if (!roles.includes(req.user.role)) return bad(res, 'Bạn không có quyền thực hiện thao tác này', 403);
  const m = req.path.match(re), id = Number(m[1]) || 0, body = { ...(req.body || {}) };
  let du_an_id = null, before = null, ban_ghi_id = null;
  if (tim === 'p') { const p = await store.getProject(id); if (!p) return bad(res, 'Không tìm thấy dự án', 404); du_an_id = p.id; }
  if (tim === 'tp') { const t = await store.getTp(id); if (!t) return bad(res, 'Không tìm thấy hợp đồng đầu vào', 404); du_an_id = t.du_an_id; }
  if (tim === 'r') {
    before = await store.auditInfo(kind, id);
    if (!before) return bad(res, 'Không tìm thấy dòng số liệu (có thể đã bị xóa)', 404);
    ban_ghi_id = id;
    du_an_id = (await store.listProjects()).find((p) => p.ma_du_an === before.ma_du_an)?.id || null;
  }
  if (kind === 'sddk') du_an_id = Number(body.du_an_id) || null;
  // Kiểm tra dữ liệu lúc gửi
  let data = null;
  if (method !== 'DELETE' && KIEM[kind]) { const v = KIEM[kind](body, method, before); if (v.errors.length) return bad(res, v.errors); data = v.data; }
  // Xóa HĐ / PL, HĐ thầu phụ: kiểm tra Passcode NGAY lúc gửi (không lưu Passcode vào hồ sơ)
  if (method === 'DELETE' && (kind === 'thau_phu' || kind === 'tp_hd_pl' || (kind === 'doanh_thu' && (await store.getRevenue(id))?.loai === 'hd'))) {
    if (!(await requirePasscode(req, res))) return;
  }
  delete body.passcode;
  // Nội dung hồ sơ: trước → sau
  const hanh_dong = method === 'POST' ? 'Thêm' : method === 'DELETE' ? 'Xóa' : 'Sửa';
  let noi_dung = '';
  if (kind === 'td') noi_dung = method === 'DELETE' ? `Xóa số liệu TĐ${m[2]}` : `Chốt / sửa TĐ${m[2]}: DT ${audit.money(soTien(body.dt))} · CP ${audit.money(soTien(body.cp))}${body.ngay ? ' · ngày ' + String(body.ngay).split('-').reverse().join('/') : ''}`;
  else if (kind === 'bh') noi_dung = ['DT-CP dự kiến / BH-Khác', body.ns_cp !== undefined && `DT-CP dự kiến: ${audit.money(soTien(body.ns_cp))}`, body.bh_khac !== undefined && `BH/Khác: ${audit.money(soTien(body.bh_khac))}`].filter(Boolean).join(' | ');
  else if (kind === 'sddk') noi_dung = `${du_an_id ? 'Số dư đầu kỳ dự án' : 'Số dư đầu kỳ chung (công ty)'}: ${audit.money(soTien(body.so_tien))}`;
  else if (method === 'POST') noi_dung = audit.describe(kind, { ...data, tp: data?.so_ma || '', hd: '', so_hieu: [data?.ma_loai, data?.so_ma || data?.so_hieu].filter(Boolean).join(' ') }) || doi_tuong;
  else if (method === 'PUT') { const d = audit.diff(kind, before, { ...before, ...data }); noi_dung = audit.describe(kind, before) + (d ? ` | ${d}` : ''); }
  else noi_dung = audit.describe(kind, before);
  if (kind === 'thau_phu' && method === 'POST' && data?.gia_tri !== undefined) noi_dung += ` · HĐ gốc ${audit.money(data.gia_tri)}`;
  const tien = method === 'DELETE' ? (before?.gia_tri ?? before?.so_tien ?? null)
    : kind === 'td' ? soTien(body.cp) : kind === 'sddk' ? soTien(body.so_tien) : kind === 'bh' ? soTien(body.bh_khac)
      : (data?.gia_tri ?? data?.so_tien ?? null);
  const du_an = du_an_id ? (await store.listProjects()).find((p) => p.id === du_an_id)?.ma_du_an || '' : before?.ma_du_an || '';
  const hs = await store.addDuyet({ hanh_dong, doi_tuong, loai: kind, ban_ghi_id, du_an, du_an_id, noi_dung: noi_dung.slice(0, 1000), so_tien: tien === null ? null : Math.round(tien),
    nguoi_nhap_id: req.user.id, nguoi_nhap: req.user.username, ho_ten_nhap: req.user.full_name || '', yeu_cau: { method, path: req.path, body } });
  audit.log(req, 'Gửi duyệt', doi_tuong, `${hanh_dong} · ${noi_dung}`.slice(0, 1000), { du_an });
  dyBao({ loai: 'gui', uid: req.user.id, du_an_id });
  res.status(202).json({ cho_duyet: true, id: hs.id, thong_bao: `Đã gửi duyệt: ${hanh_dong.toLowerCase()} ${doi_tuong.toLowerCase()}. Số liệu chưa tính vào tổng cho tới khi Quản trị / Lãnh đạo duyệt.` });
}));
// Kênh đẩy thông báo tức thì (Server-Sent Events): có hồ sơ mới / duyệt / từ chối / hủy -> mọi máy đang mở web cập nhật ngay, không chờ 30 giây
const dyKenh = new Set();
function dyBao(d) {
  const msg = `event: duyet\ndata: ${JSON.stringify({ ...d, t: Date.now() })}\n\n:${' '.repeat(512)}\n\n`; // đệm để không bị giữ lại ở máy chủ trung gian
  for (const c of dyKenh) { try { c.write(msg); } catch { dyKenh.delete(c); } }
}
// Ghi lại yêu cầu gốc khi duyệt (gửi tới chính máy chủ, dưới tên người nhập)
async function ghiYeuCau(hs, approver) {
  const y = typeof hs.yeu_cau === 'string' ? JSON.parse(hs.yeu_cau) : hs.yeu_cau;
  const u = hs.nguoi_nhap_id && (await store.getUserById(hs.nguoi_nhap_id));
  const uid = u && u.active !== false ? u.id : approver.id; // người nhập đã bị khóa -> ghi dưới tên người duyệt
  const r = await fetch(`http://127.0.0.1:${PORT}/api${y.path}`, { method: y.method,
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', 'X-Noi-Bo': NOI_BO, 'X-Noi-Bo-User': String(uid) },
    body: y.method === 'GET' ? undefined : JSON.stringify(y.body || {}) });
  const b = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: Number(b?.id) || null } : { ok: false, loi: (b.errors || ['Lỗi ' + r.status]).join('; ') };
}
// Hồ sơ tự động cho thao tác KHÔNG phải chờ (Quản trị / Lãnh đạo tự nhập, thông tin dự án…) – để có lịch sử. Không tạo khi đang ghi lúc duyệt.
const KHONG_DUYET = new Set(['Tài khoản', 'Cài đặt', 'Liên hệ', 'Mục tiêu năm', 'Dữ liệu mẫu', 'Cá nhân', 'Ảnh công trình']);
audit.onGhi(({ req, hanh_dong, doi_tuong, kind, ban_ghi_id, du_an, noi_dung }) => {
  if (req.user && req.noiBo === undefined && !KHONG_DUYET.has(doi_tuong)) dyBao({ loai: 'ghi', uid: req.user.id, du_an });
  if (!req.user || req.noiBo !== undefined || KHONG_DUYET.has(doi_tuong)) return;
  const tu = QUYEN.duyet.includes(req.user.role);
  store.addDuyet({ hanh_dong, doi_tuong, loai: kind || '', ban_ghi_id, du_an, noi_dung, nguoi_nhap_id: req.user.id, nguoi_nhap: req.user.username, ho_ten_nhap: req.user.full_name || '',
    ...(tu ? { trang_thai: 'duyet', nguoi_duyet_id: req.user.id, nguoi_duyet: req.user.full_name || req.user.username, ly_do: 'Tự duyệt (người nhập có quyền duyệt)' } : {}) })
    .catch((e) => console.error('Lỗi tạo hồ sơ duyệt:', e.message));
});
api.use(audit.middleware); // ghi nhật ký mọi thao tác thêm / sửa / xóa

// ---------- Phê duyệt ----------
// Số hồ sơ để hiện chuông / số trên tab: người duyệt = số chờ duyệt; người nhập = số của mình bị từ chối trong 7 ngày, số đang chờ
api.get('/duyet/dem', quyen('nop'), wrap(async (req, res) => {
  const out = { la_duyet: laDuyet(req), cua_toi_cho: await store.countDuyet('cho', req.user.id), cua_toi_tu_choi: await store.countDuyet('tu_choi', req.user.id, 7) };
  if (out.la_duyet) out.cho = await store.countDuyet('cho');
  res.json(out);
}));
// Danh sách: ?tt=cho|duyet|tu_choi (trống = tất cả) &q= &trang= ; người nhập chỉ xem hồ sơ của mình
api.get('/duyet', quyen('nop'), wrap(async (req, res) => {
  const tt = ['cho', 'duyet', 'tu_choi', 'huy'].includes(req.query.tt) ? req.query.tt : '';
  const trang = Math.max(0, Math.min(1000, Number(req.query.trang) || 0)), LIM = 50;
  const du_an_id = parseId(req.query.du_an); // mục "Chờ duyệt" trong Nhập liệu: mọi hồ sơ của dự án đó
  const r = await store.listDuyet({ tt, du_an_id, q: String(req.query.q || '').trim().slice(0, 100),
    nguoi_nhap_id: du_an_id || (laDuyet(req) && req.query.cua_toi !== '1') ? null : req.user.id, limit: LIM, offset: trang * LIM });
  r.rows = r.rows.map(({ yeu_cau, ...x }) => x); // không trả yêu cầu gốc ra trình duyệt
  res.json({ ...r, trang, moi_trang: LIM, la_duyet: laDuyet(req) });
}));
// Nhãn "Chờ duyệt" / "Bị từ chối" trên các dòng số liệu ở trang nhập liệu
api.get('/duyet/nhan', quyen('nop'), wrap(async (_req, res) => res.json(await store.nhanDuyet())));
// Duyệt / từ chối: { ids: [..], hanh_dong: 'duyet' | 'tu_choi', ly_do }
api.post('/duyet/xu-ly', quyen('duyet'), wrap(async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 1000);
  const hd = req.body?.hanh_dong === 'tu_choi' ? 'tu_choi' : req.body?.hanh_dong === 'duyet' ? 'duyet' : null;
  const ly_do = String(req.body?.ly_do || '').replace(/[<>]/g, '').trim().slice(0, 500);
  if (!ids.length || !hd) return bad(res, 'Chưa chọn hồ sơ hoặc thao tác không hợp lệ');
  if (hd === 'tu_choi' && !ly_do) return bad(res, 'Từ chối cần ghi lý do');
  const ten = req.user.full_name || req.user.username, xong = [], loi = [];
  for (const id of ids.sort((a, b) => a - b)) { // theo thứ tự gửi: thêm trước, sửa / xóa sau
    const hs = await store.getDuyet(id);
    if (!hs || hs.trang_thai !== 'cho') continue;
    if (hd === 'duyet' && hs.yeu_cau) { // ghi vào số liệu
      const g = await ghiYeuCau(hs, req.user).catch((e) => ({ ok: false, loi: e.message }));
      if (!g.ok) { await store.capNhatDuyet(id, { loi: g.loi.slice(0, 500) }); loi.push(`${hs.hanh_dong} ${hs.doi_tuong}${hs.du_an ? ' · ' + hs.du_an : ''}: ${g.loi}`); continue; }
      const r2 = await store.capNhatDuyet(id, { trang_thai: 'duyet', ban_ghi_id: hs.hanh_dong === 'Thêm' ? g.id : null, nguoi_duyet_id: req.user.id, nguoi_duyet: ten, ly_do, loi: '' });
      if (r2) xong.push(r2);
    } else {
      const r2 = await store.capNhatDuyet(id, { trang_thai: hd, nguoi_duyet_id: req.user.id, nguoi_duyet: ten, ly_do });
      if (r2) xong.push(r2);
    }
  }
  for (const r of xong.slice(0, 200)) {
    audit.log(req, hd === 'duyet' ? 'Duyệt' : 'Từ chối', 'Phê duyệt', `${r.hanh_dong} ${r.doi_tuong}${r.du_an ? ' · ' + r.du_an : ''} (người nhập ${r.ho_ten_nhap || r.nguoi_nhap})${ly_do ? ' | Lý do: ' + ly_do : ''}`);
  }
  if (xong.length > 200) audit.log(req, hd === 'duyet' ? 'Duyệt' : 'Từ chối', 'Phê duyệt', `… và ${xong.length - 200} hồ sơ khác`);
  if (xong.length || loi.length) dyBao({ loai: hd, uid: req.user.id, ghi: hd === 'duyet' && xong.length > 0 });
  res.json({ ok: !loi.length, so: xong.length, loi });
}));
// Thử đường truyền tức thì (công khai, không chứa số liệu): 3 nhịp cách nhau 1 giây rồi đóng
app.get('/su-kien-thu', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.(); res.write(':' + ' '.repeat(2048) + '\n\n');
  let n = 0; const t = setInterval(() => { res.write(`data: nhip ${++n} ${Date.now()}\n\n:${' '.repeat(512)}\n\n`); if (n >= 3) { clearInterval(t); res.end(); } }, 1000);
  req.on('close', () => clearInterval(t));
});
// Kết nối nhận thông báo tức thì (trình duyệt tự nối lại khi rớt mạng); nhịp giữ kết nối 20 giây
api.get('/duyet/su-kien', quyen('nop'), (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', Connection: 'keep-alive' });
  res.flushHeaders?.();
  res.write(':' + ' '.repeat(2048) + '\nretry: 3000\n\n'); // đệm 2 KB đầu: đẩy qua bộ đệm của máy chủ trung gian (Railway) ngay
  if (dyKenh.size > 500) { res.end(); return; } // giới hạn số kết nối
  dyKenh.add(res);
  const nhip = setInterval(() => { try { res.write(': nhip\n\n'); } catch { /* đã đóng */ } }, 20000);
  req.on('close', () => { clearInterval(nhip); dyKenh.delete(res); });
});
// Hủy hồ sơ còn chờ: người nhập tự hủy nội dung nhập sai (chưa duyệt -> chưa ghi gì vào số liệu) hoặc người duyệt hủy. Ghi nhật ký.
api.post('/duyet/huy', quyen('nop'), wrap(async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 500);
  if (!ids.length) return bad(res, 'Chưa chọn hồ sơ');
  let so = 0;
  for (const id of ids) {
    const hs = await store.getDuyet(id);
    if (!hs || hs.trang_thai !== 'cho') continue;
    if (hs.nguoi_nhap_id !== req.user.id && !laDuyet(req)) return bad(res, 'Chỉ người nhập hoặc người duyệt được hủy hồ sơ này', 403);
    const tu = hs.nguoi_nhap_id === req.user.id;
    const r = await store.capNhatDuyet(id, { trang_thai: 'huy', nguoi_duyet_id: req.user.id, nguoi_duyet: req.user.full_name || req.user.username,
      ly_do: tu ? 'Người nhập tự hủy (chưa duyệt, chưa tính vào số liệu)' : 'Người duyệt hủy' });
    if (r) { so++; dyBao({ loai: 'huy', uid: req.user.id }); audit.log(req, 'Hủy gửi duyệt', 'Phê duyệt', `${hs.hanh_dong} ${hs.doi_tuong}${hs.du_an ? ' · ' + hs.du_an : ''} · ${hs.noi_dung}`.slice(0, 1000), { du_an: hs.du_an }); }
  }
  res.json({ ok: true, so });
}));

// ---------- Nhật ký hoạt động ----------
const SU_KIEN = { xuat_excel: 'Excel', xuat_pptx: 'PowerPoint', in_pdf: 'In / PDF', xuat_csv: 'CSV' };
const LOG_PAGE_DEPTH = 10000; // xem theo trang tối đa 10.000 dòng mới nhất (sâu hơn: lọc theo ngày hoặc xuất CSV)
api.post('/nhat-ky/su-kien', wrap(async (req, res) => {
  const loai = SU_KIEN[req.body?.loai];
  if (!loai) return bad(res, 'Sự kiện không hợp lệ');
  audit.log(req, 'Xuất báo cáo', 'Báo cáo', `${loai} · ${String(req.body?.pham_vi || '').replace(/[<>]/g, '').slice(0, 200)}`);
  res.json({ ok: true });
}));
api.get('/nhat-ky', quyen('nhat_ky'), wrap(async (req, res) => {
  const q = req.query;
  const date = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : '');
  const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
  // Chuyển trang theo số: lấy page × limit dòng mới nhất rồi cắt trang; giới hạn độ sâu để không giải nén quá nhiều lưu trữ
  const page = q.before ? 1 : Math.min(Math.max(1, parseInt(q.page, 10) || 1), Math.max(1, Math.floor(LOG_PAGE_DEPTH / limit)));
  const rows = await store.listLogs({
    user_id: parseId(q.user_id), hanh_dong: audit.HANH_DONG.includes(q.hanh_dong) ? q.hanh_dong : '',
    q: String(q.q || '').trim().slice(0, 100), tu: date(q.tu), den: date(q.den), before: parseId(q.before), limit: page * limit,
  });
  res.json({ items: rows.slice((page - 1) * limit, page * limit), more: rows.length > page * limit, page, max_page: Math.max(1, Math.floor(LOG_PAGE_DEPTH / limit)),
    hanh_dong: audit.HANH_DONG, ...(q.before ? {} : { thong_ke: await store.logStats(), tai_khoan: (await store.listUsers()).map((u) => ({ id: u.id, username: u.username, full_name: u.full_name })) }) });
}));

api.get('/auth/me', (req, res) => res.json(req.user));

api.post('/auth/change-password', wrap(async (req, res) => {
  if (req.user.khach) return bad(res, 'Tài khoản khách không đổi được mật khẩu', 403);
  const { current_password, new_password } = req.body || {};
  const hash = await store.getPasswordHash(req.user.id);
  if (!(await auth.verifyPassword(current_password || '', hash))) return bad(res, 'Mật khẩu hiện tại không đúng');
  if (String(new_password) === String(current_password)) return bad(res, 'Mật khẩu mới phải khác mật khẩu hiện tại');
  const errors = passwordErrors(new_password, req.user.username);
  if (errors.length) return bad(res, errors);
  await store.updateUser(req.user.id, { password_hash: await auth.hashPassword(new_password) });
  await store.deleteUserSessions(req.user.id, req.sessionHash); // đăng xuất các thiết bị khác
  res.json({ ok: true });
}));

// ---------- Cài đặt hệ thống ----------
const PASSCODE_KEY = 'xoa_hd_passcode';
api.get('/settings', wrap(async (_req, res) => {
  const s = await store.getSettings();
  res.json({ ten_cong_ty: s.ten_cong_ty, ten_he_thong: s.ten_he_thong, passcode_set: Boolean(s[PASSCODE_KEY]) });
}));

// Đặt / đổi Passcode xóa HĐ/PL (chỉ Quản trị, phải nhập lại mật khẩu đăng nhập)
api.put('/settings/passcode', auth.requireRole('admin'), wrap(async (req, res) => {
  const { current_password, passcode, passcode2 } = req.body || {};
  const hash = await store.getPasswordHash(req.user.id);
  if (!(await auth.verifyPassword(current_password || '', hash))) return bad(res, 'Mật khẩu đăng nhập không đúng');
  if (String(passcode) !== String(passcode2)) return bad(res, 'Passcode nhập lại không khớp');
  const errors = passcodeErrors(passcode);
  if (errors.length) return bad(res, errors);
  await store.saveSettings({ [PASSCODE_KEY]: await auth.hashPassword(String(passcode)) });
  console.log(`[NHẬT KÝ] ${new Date().toISOString()} ${req.user.username} đã đặt/đổi Passcode xóa HĐ/PL`);
  res.json({ ok: true });
}));

// Chống dò passcode: sai 5 lần / 15 phút / tài khoản -> khóa xóa
const passFails = new Map();
const PASS_WINDOW = 15 * 60e3;
function passcodeLocked(uid) {
  const a = passFails.get(uid);
  if (!a || Date.now() - a.first > PASS_WINDOW) return 0;
  return a.count >= 5 ? Math.ceil((a.first + PASS_WINDOW - Date.now()) / 60e3) : 0;
}
// Kiểm tra Passcode xóa (gửi lỗi và trả false nếu không hợp lệ)
async function requirePasscode(req, res) {
  if (req.noiBo !== undefined) return true; // ghi khi duyệt: Passcode đã kiểm tra lúc người nhập gửi
  const stored = (await store.getSettings())[PASSCODE_KEY];
  if (!stored) { bad(res, 'Quản trị chưa đặt Passcode xóa (tab Cài đặt). Chưa thể xóa.', 403); return false; }
  const wait = passcodeLocked(req.user.id);
  if (wait) { bad(res, `Nhập sai Passcode quá nhiều lần. Thử lại sau ${wait} phút`, 429); return false; }
  if (!(await auth.verifyPassword(String(req.body?.passcode ?? ''), stored))) {
    const left = passcodeFailed(req.user.id);
    bad(res, left > 0 ? `Passcode không đúng (còn ${left} lần thử)` : 'Passcode không đúng. Đã khóa chức năng xóa 15 phút', 403);
    return false;
  }
  passFails.delete(req.user.id);
  return true;
}
function passcodeFailed(uid) {
  const a = passFails.get(uid);
  if (!a || Date.now() - a.first > PASS_WINDOW) passFails.set(uid, { first: Date.now(), count: 1 });
  else a.count++;
  return 5 - passFails.get(uid).count;
}
api.put('/settings', auth.requireRole('admin'), wrap(async (req, res) => {
  const { data, errors } = validateSettings(req.body || {});
  if (errors.length) return bad(res, errors);
  await store.saveSettings(data);
  res.json(data);
}));

// ---------- Tab Liên hệ: Thông tin hệ thống & hỗ trợ ----------
//   Phiên bản tự động theo version.json; Quản trị có thể ghi đè – bản ghi đè chỉ áp dụng đến lần phát hành kế tiếp
const CONTACT_KEY = 'lien_he';
const CONTACT_DEFAULT = { ten: 'Hệ thống nội bộ', so_huu: 'Ban Kiểm soát', phat_trien: 'Le Phan Vinh Tu', sdt: '0794 570 057', mail: 'lephanvinhtu.tu@gmail.com' };
async function readContact() {
  let saved = {};
  try { saved = JSON.parse((await store.getSettings())[CONTACT_KEY] || '{}'); } catch {}
  const info = { ...CONTACT_DEFAULT, ...saved };
  const override = saved.phien_ban && saved.phien_ban_goc === PHIEN_BAN.ma ? saved.phien_ban : '';
  delete info.phien_ban; delete info.phien_ban_goc;
  return { ...info, phien_ban: override ? { ma: override, tu_dong: PHIEN_BAN.ma, ghi_de: true } : { ...PHIEN_BAN, ghi_de: false } };
}
api.get('/lien-he', wrap(async (_req, res) => res.json(await readContact())));
api.put('/lien-he', quyen('lien_he'), wrap(async (req, res) => {
  const { data, errors } = validateContact(req.body || {});
  if (errors.length) return bad(res, errors);
  const save = { ...data, phien_ban_goc: data.phien_ban ? PHIEN_BAN.ma : '' };
  if (data.phien_ban === PHIEN_BAN.ma) { save.phien_ban = ''; save.phien_ban_goc = ''; } // trùng số tự động -> không cần ghi đè
  await store.saveSettings({ [CONTACT_KEY]: JSON.stringify(save) });
  console.log(`[NHẬT KÝ] ${req.user.username} sửa thông tin Liên hệ${save.phien_ban ? ` (ghi đè phiên bản ${save.phien_ban})` : ''}`);
  res.json(await readContact());
}));

// ---------- Quản lý tài khoản (chỉ Quản trị) ----------
const users = express.Router();
users.use(quyen('tai_khoan'));
// IT quản lý tài khoản nhưng không đụng tới tài khoản / vai trò Quản trị và không xóa tài khoản
const laIT = (req) => req.user.role === 'it';

users.get('/', wrap(async (_req, res) => res.json(await store.listUsers())));

users.post('/', wrap(async (req, res) => {
  const { data, errors } = validateUser(req.body || {}, true);
  if (errors.length) return bad(res, errors);
  if (laIT(req) && data.role === 'admin') return bad(res, 'Kỹ thuật hệ thống không được tạo tài khoản Quản trị', 403);
  const id = await store.createUser({ ...data, password_hash: await auth.hashPassword(data.password) });
  res.status(201).json({ id });
}));

// Tạo tài khoản khách: Chỉ xem, tên + mật khẩu tự sinh (chỉ hiện 1 lần), dùng KHACH_PHUT phút từ lần đăng nhập đầu
users.post('/khach', wrap(async (req, res) => {
  const ghi = String(req.body?.ghi_chu || '').replace(/[<>]/g, '').trim().slice(0, 60);
  const rnd = (set, n) => Array.from(crypto.randomBytes(n), (b) => set[b % set.length]).join('');
  const LO = 'abcdefghjkmnpqrstuvwxyz', UP = 'ABCDEFGHJKMNPQRSTUVWXYZ', SO = '23456789', DB = '@#$%&*!?';
  const pw = [...rnd(UP, 3) + rnd(LO, 4) + rnd(SO, 3) + rnd(DB, 2)];
  for (let i = pw.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [pw[i], pw[j]] = [pw[j], pw[i]]; } // trộn thứ tự
  const password = pw.join(''), password_hash = await auth.hashPassword(password);
  let id = null, username = '';
  for (let i = 0; i < 5 && !id; i++) { // trùng tên (rất hiếm) thì sinh lại
    username = 'khach-' + rnd(LO + SO, 6);
    try { id = await store.createUser({ username, full_name: ghi ? `Khách – ${ghi}` : 'Khách', role: 'viewer', active: true, khach: true, password_hash }); } catch (e) { if (i === 4) throw e; }
  }
  audit.log(req, 'Thêm', 'Tài khoản khách', `${username} (${ghi ? `Khách – ${ghi}` : 'Khách'}, Chỉ xem) – dùng ${KHACH_PHUT} phút từ lần đăng nhập đầu, chỉ trên 1 thiết bị; chưa đăng nhập sau ${KHACH_CHUA_DUNG_GIO} giờ thì tự xóa`);
  res.status(201).json({ id, username, password, phut: KHACH_PHUT, chua_dung_gio: KHACH_CHUA_DUNG_GIO });
}));

users.put('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const target = await store.getUserById(id);
  if (!target) return bad(res, 'Không tìm thấy tài khoản', 404);
  if (target.khach) return bad(res, 'Tài khoản khách không sửa được – chỉ xóa hoặc tạo tài khoản khách mới');
  const { data, errors } = validateUser(req.body || {}, false, target.username);
  if (errors.length) return bad(res, errors);
  if (laIT(req) && (target.role === 'admin' || data.role === 'admin')) return bad(res, 'Kỹ thuật hệ thống không được sửa tài khoản Quản trị hoặc cấp quyền Quản trị', 403);

  const isSelf = id === req.user.id;
  if (isSelf && (data.role !== 'admin' || !data.active)) return bad(res, 'Không thể tự hạ quyền hoặc khóa chính mình');
  const losesAdmin = target.role === 'admin' && target.active && (data.role !== 'admin' || !data.active);
  if (losesAdmin && (await store.countActiveAdmins(id)) === 0) return bad(res, 'Hệ thống phải còn ít nhất 1 Quản trị đang hoạt động');

  const fields = { full_name: data.full_name, role: data.role, active: data.active };
  if (data.password) fields.password_hash = await auth.hashPassword(data.password);
  await store.updateUser(id, fields);
  // Đổi mật khẩu / khóa / đổi quyền -> buộc đăng nhập lại
  if (data.password || !data.active || data.role !== target.role) {
    await store.deleteUserSessions(id, isSelf ? req.sessionHash : '');
  }
  res.json({ id });
}));

// ---------- Phiên đăng nhập của 1 tài khoản (quản trị): xem và buộc đăng xuất ----------
const sessionTarget = async (req, res) => {
  const id = parseId(req.params.id);
  const u = id && (await store.getUserById(id));
  if (!u) { bad(res, 'Không tìm thấy tài khoản', 404); return null; }
  if (laIT(req) && u.role === 'admin') { bad(res, 'Kỹ thuật hệ thống không xem / đăng xuất phiên của Quản trị', 403); return null; }
  return u;
};
users.get('/:id/sessions', wrap(async (req, res) => {
  const u = await sessionTarget(req, res); if (!u) return;
  const rows = await store.listUserSessions(u.id);
  res.json(rows.map(({ token_hash, ua, ...r }) => ({ ...r, thiet_bi: audit.device(ua), hien_tai: token_hash === req.sessionHash })));
}));
// Đăng xuất 1 phiên (sid) hoặc tất cả phiên (không có sid); không đăng xuất chính phiên quản trị đang dùng
users.delete('/:id/sessions/:sid?', wrap(async (req, res) => {
  const u = await sessionTarget(req, res); if (!u) return;
  const sid = req.params.sid ? String(req.params.sid).replace(/[^0-9a-f]/gi, '').slice(0, 16) : '';
  if (sid) {
    if (req.sessionHash && req.sessionHash.startsWith(sid)) return bad(res, 'Không thể đăng xuất phiên bạn đang dùng (dùng nút Đăng xuất)');
    const s = await store.deleteSessionById(u.id, sid);
    if (!s) return bad(res, 'Phiên đã kết thúc hoặc không tồn tại', 404);
    audit.log(req, 'Đăng xuất', 'Tài khoản', `Quản trị buộc đăng xuất 1 phiên của ${u.username} · ${audit.device(s.ua)} · IP ${s.ip || '—'}`);
    return res.json({ ok: true, so_phien: 1 });
  }
  const n = (await store.listUserSessions(u.id)).filter((x) => x.token_hash !== req.sessionHash).length;
  await store.deleteUserSessions(u.id, req.sessionHash || '');
  audit.log(req, 'Đăng xuất', 'Tài khoản', `Quản trị buộc đăng xuất tất cả phiên của ${u.username} (${n} phiên)`);
  res.json({ ok: true, so_phien: n });
}));

users.delete('/:id', wrap(async (req, res) => {
  if (laIT(req)) return bad(res, 'Kỹ thuật hệ thống chỉ được khóa, không được xóa tài khoản', 403);
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  if (id === req.user.id) return bad(res, 'Không thể xóa tài khoản đang đăng nhập');
  const target = await store.getUserById(id);
  if (!target) return bad(res, 'Không tìm thấy tài khoản', 404);
  if (target.role === 'admin' && target.active && (await store.countActiveAdmins(id)) === 0) {
    return bad(res, 'Hệ thống phải còn ít nhất 1 Quản trị đang hoạt động');
  }
  await store.deleteUser(id);
  res.status(204).end();
}));
api.use('/users', users);

// ---------- Dự án ----------

api.get('/du-an', wrap(async (_req, res) => res.json(await store.listProjects())));
// Tình trạng tự động theo số liệu (không trả số tiền): [{ id, tt }]
api.get('/du-an-tinh-trang', wrap(async (_req, res) => res.json((await reportProjects()).map((d) => ({ id: d.id, tt: d.trang_thai_tu_dong })))));

api.post('/du-an', canHd, wrap(async (req, res) => {
  const { data, errors } = validateProject(req.body || {});
  if (errors.length) return bad(res, errors);
  res.status(201).json(await store.createProject(data, req.user.id));
}));

api.put('/du-an/:id', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const { data, errors } = validateProject(req.body || {});
  if (errors.length) return bad(res, errors);
  const ok = await store.updateProject(id, data, req.user.id);
  ok ? res.json({ id }) : bad(res, 'Không tìm thấy dự án', 404);
}));

// Sửa riêng ngày bắt đầu / kết thúc (từ khung công trình ở Báo cáo): để trống = hệ thống tự lấy theo ngày ký HĐ / ngày quyết toán
api.put('/du-an/:id/ngay', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await store.listProjects()).find((p) => p.id === id);
  if (!cur) return bad(res, 'Không tìm thấy dự án', 404);
  const iso = (x) => (x === null || x === '' || x === undefined ? null : String(x));
  const { data, errors } = validateProject({ ...cur, ngay_bat_dau: iso(req.body?.ngay_bat_dau), ngay_ket_thuc: iso(req.body?.ngay_ket_thuc) });
  if (errors.length) return bad(res, errors);
  await store.updateProject(id, data, req.user.id);
  res.json({ id, ngay_bat_dau: data.ngay_bat_dau, ngay_ket_thuc: data.ngay_ket_thuc });
}));

// Số liệu nhập tay của công trình: DT-CP dự kiến (mục I) · BH/Khác + ghi chú (mục IV)
api.put('/du-an/:id/bh', canAny, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await store.listProjects()).find((p) => p.id === id);
  if (!cur) return bad(res, 'Không tìm thấy dự án', 404);
  const raw = String(req.body?.bh_khac ?? '').replace(/[.,\s]/g, '');
  const bh = raw === '' ? 0 : Number(raw);
  if (!Number.isInteger(bh) || Math.abs(bh) > 1e15) return bad(res, 'BH/Khác phải là số nguyên (đồng)');
  const ghi = String(req.body?.ghi_chu_bh ?? '').trim().slice(0, 300);
  // DT-CP dự kiến – chi phí (trước VAT): không gửi -> giữ nguyên
  const rawNs = req.body?.ns_cp === undefined ? null : String(req.body.ns_cp).replace(/[.,\s]/g, '');
  const ns = rawNs === null ? Number(cur.ns_cp) || 0 : rawNs === '' ? 0 : Number(rawNs);
  if (!Number.isInteger(ns) || ns < 0 || ns > 1e15) return bad(res, 'DT-CP dự kiến phải là số nguyên không âm (đồng)');
  // DT-CP dự kiến: Lãnh đạo (QUYEN.ns) · BH/Khác + ghi chú: Kế toán (QUYEN.tien); đổi trường không thuộc quyền -> từ chối
  const doi = (a, b) => (Number(a) || 0) !== (Number(b) || 0);
  if (doi(ns, cur.ns_cp) && !QUYEN.ns.includes(req.user.role)) return bad(res, 'Bạn không có quyền sửa DT-CP dự kiến', 403);
  if ((doi(bh, cur.bh_khac) || ghi !== (cur.ghi_chu_bh || '')) && !QUYEN.tien.includes(req.user.role)) return bad(res, 'Bạn không có quyền sửa BH/Khác, ghi chú', 403);
  await store.setProjectBh(id, { bh_khac: bh, ghi_chu_bh: ghi, ns_cp: ns }, req.user.id);
  const f = (x) => new Intl.NumberFormat('vi-VN').format(Number(x) || 0);
  audit.log(req, 'Sửa', 'Dự án', `DT-CP dự kiến ${f(ns)} đ · BH/Khác ${f(bh)} đ · Ghi chú: ${ghi || '—'} | Trước: DT-CP dự kiến ${f(cur.ns_cp)} đ · BH ${f(cur.bh_khac)} đ · ${cur.ghi_chu_bh || '—'}`, { du_an: cur.ma_du_an });
  res.json({ id, bh_khac: bh, ghi_chu_bh: ghi, ns_cp: ns });
}));

// Dữ liệu sẽ bị xóa theo dự án (hiện trước khi xác nhận, ghi vào nhật ký)
async function projectImpact(id) {
  const [rev, tv, cost, tp, td] = await Promise.all([store.listRevenue(id), store.listTienVe(id), store.listCost(id), store.listTp(id), store.listThoiDiem(id)]);
  const c = tp.contracts || tp;
  return { hd_pl: rev.filter((r) => r.loai === 'hd').length, nt_qt: rev.filter((r) => r.loai === 'qt').length, tien_ve: tv.length,
    chi_phi: cost.length, thau_phu: c.length, tp_thanh_toan: (tp.pays || c.flatMap((x) => x.pays || [])).length, thoi_diem: td.length };
}
const impactTxt = (x) => `${x.hd_pl} dòng HĐ/PL, ${x.nt_qt} nghiệm thu/QT, ${x.tien_ve} tiền về, ${x.thau_phu} HĐ thầu phụ (${x.tp_thanh_toan} thanh toán), ${x.chi_phi} chi phí, ${x.thoi_diem} thời điểm TĐ`;
api.get('/du-an/:id/impact', canXoaDa, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || !(await store.getProject(id))) return bad(res, 'Không tìm thấy dự án', 404);
  res.json(await projectImpact(id));
}));
// Xóa dự án: xóa luôn toàn bộ dữ liệu liên quan -> bắt buộc Passcode xóa (như xóa HĐ/PL, HĐ thầu phụ)
api.delete('/du-an/:id', canXoaDa, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const p = await store.getProject(id);
  if (!p) return bad(res, 'Không tìm thấy dự án', 404);
  if (!(await requirePasscode(req, res))) return;
  const x = await projectImpact(id);
  const ok = await store.deleteProject(id);
  if (!ok) return bad(res, 'Không tìm thấy dự án', 404);
  console.log(`[NHẬT KÝ] ${new Date().toISOString()} ${req.user.username} đã XÓA DỰ ÁN ${p.ma_du_an} – ${p.ten_du_an}: ${impactTxt(x)}`);
  audit.log(req, 'Xóa', 'Dự án', `Xóa dự án ${p.ma_du_an} – ${p.ten_du_an} (có Passcode) · kèm ${impactTxt(x)}`, { du_an: p.ma_du_an });
  res.status(204).end();
}));

// Nâng cấp dữ liệu (1 lần): HĐ thầu phụ chưa gắn HĐ CĐT mà ghi chú / số HĐTP chứa đúng 1 số HĐ CĐT -> tự gắn
async function migrateTpHdCdt() {
  const KEY = 'mig_tp_hd_cdt';
  if ((await store.getSettings())[KEY]) return 0;
  let n = 0;
  for (const p of await store.listProjects()) {
    const masters = (await store.listRevenue(p.id)).filter((r) => r.loai === 'hd' && r.ma_loai === 'HĐ' && r.so_ma);
    if (!masters.length) continue;
    for (const t of (await store.listTp(p.id)).contracts) {
      if (t.hd_cdt_id) continue;
      const text = `${t.ghi_chu} ${t.so_ma}`.toLowerCase();
      const hit = masters.filter((m) => text.includes(String(m.so_ma).toLowerCase()));
      // nhiều số khớp (vd "01/04" nằm trong "01/04/2025") -> lấy số dài nhất nếu duy nhất
      const best = hit.sort((a, b) => b.so_ma.length - a.so_ma.length).filter((m, i, a) => m.so_ma.length === a[0].so_ma.length);
      if (best.length === 1) { await store.setTpHdCdt(t.id, best[0].id); n++; }
    }
  }
  await store.saveSettings({ [KEY]: new Date().toISOString() });
  if (n) console.log(`[NHẬT KÝ] Tự gắn ${n} HĐ thầu phụ vào HĐ chủ đầu tư theo ghi chú`);
  return n;
}

// ---------- Dashboard tổng: số liệu từ Doanh thu + Chi phí của mọi dự án ----------
api.get('/dashboard', wrap(async (_req, res) => {
  const list = await store.listProjects();
  const du_an = await Promise.all(list.map(async (p) => {
    const [rev, tienVe, cost, tp] = await Promise.all([
      store.listRevenue(p.id), store.listTienVe(p.id), store.listCost(p.id), store.listTp(p.id)]);
    return {
      id: p.id, ma_du_an: p.ma_du_an, ten_du_an: p.ten_du_an,
      ...summarizeProject({ rev: rev.map(calcLine), tienVe, cost: cost.map(costLine), tp: buildContracts(tp) }),
    };
  }));
  res.json({ du_an });
}));

// ---------- Báo cáo tổng quan (tab Báo cáo): toàn bộ số liệu liên kết + dòng chi tiết để xuất ----------
// Số liệu báo cáo của các dự án (withCost: kèm dòng chi phí gốc cho bản xuất Excel mẫu trình ký)
async function reportProjects({ withCost = false } = {}) {
  const list = await store.listProjects();
  const du_an = await Promise.all(list.map(async (p) => {
    const [rev, tienVe, cost, tp] = await Promise.all([
      store.listRevenue(p.id), store.listTienVe(p.id), store.listCost(p.id), store.listTp(p.id)]);
    const lines = sortCost(cost).map(costLine);
    const d = projectReport(p, { rev: sortRevenue(rev).map(calcLine), tienVe: sortTienVe(tienVe), cost: lines, tp: buildContracts(tp) });
    if (withCost) d.chi_tiet_cp = costLinesFor(lines);
    return d;
  }));
  const tds = await store.listThoiDiem();
  for (const d of du_an) d.thoi_diem = tds.filter((t) => t.du_an_id === d.id).map(({ du_an_id, ...t }) => t);
  return du_an;
}
// Số dư đầu kỳ (nhập tay, đồng): 1 số chung của công ty + số từng dự án – lưu trong Cài đặt (không đổi cấu trúc kho dữ liệu)
const SDDK_KEY = 'so_du_dau_ky';
const sddkOf = (s) => { try { const o = JSON.parse(s[SDDK_KEY] || '{}'); return { chung: Number(o.chung) || 0, du_an: o.du_an && typeof o.du_an === 'object' ? o.du_an : {} }; } catch { return { chung: 0, du_an: {} }; } };
api.put('/so-du-dau-ky', auth.requireRole('admin', 'ke_toan'), wrap(async (req, res) => {
  const id = Number(req.body?.du_an_id) || 0; // 0 = số dư chung
  const raw = req.body?.so_tien;
  const v = raw === '' || raw === null || raw === undefined ? 0 : Number(raw);
  if (!Number.isSafeInteger(v) || Math.abs(v) > 1e15) return bad(res, 'Số dư đầu kỳ phải là số nguyên (đồng)');
  const s = await store.getSettings();
  const o = sddkOf(s);
  let ten = 'Số dư chung (công ty)';
  if (id) {
    const p = (await store.listProjects()).find((x) => x.id === id);
    if (!p) return bad(res, 'Không tìm thấy dự án', 404);
    ten = `${p.ma_du_an} – ${p.ten_du_an}`;
  }
  const cu = id ? Number(o.du_an[id]) || 0 : o.chung;
  if (id) { if (v) o.du_an[id] = v; else delete o.du_an[id]; } else o.chung = v;
  await store.saveSettings({ [SDDK_KEY]: JSON.stringify(o) });
  audit.log(req, 'Sửa', 'Số dư đầu kỳ', `${ten}: ${cu.toLocaleString('vi-VN')} → ${v.toLocaleString('vi-VN')} đ`);
  res.json(o);
}));
api.get('/bao-cao', quyen('bao_cao'), wrap(async (req, res) => {
  const du_an = await reportProjects();
  const s = await store.getSettings();
  res.json({
    so_du_dau_ky: sddkOf(s),
    lap_luc: new Date().toISOString(), nguoi_lap: req.user.full_name || req.user.username,
    ten_cong_ty: s.ten_cong_ty, ten_he_thong: s.ten_he_thong, phien_ban: PHIEN_BAN.ma, cong_ty: congTy(s.ten_cong_ty),
    khoi: KHOI_CHI_PHI.map((k) => ({ code: k.code, ten: k.ten })), du_an,
    muc_tieu: await readTargets(), la_quan_tri: req.user.role === 'admin',
  });
}));

// Xuất Excel theo mẫu trình ký (logo, font, bố cục) – ?ids=1,2,3 (bỏ trống = tất cả dự án)
api.get('/bao-cao/dtcp.xlsx', quyen('xuat'), wrap(async (req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  const all = await reportProjects({ withCost: true });
  const du_an = ids.length ? all.filter((d) => ids.includes(d.id)) : all;
  if (!du_an.length) return bad(res, 'Không có dự án để xuất');
  const ngay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const buf = await buildDtcp({ du_an, ngay, nguoi_lap: req.user.full_name || req.user.username, ten_cong_ty: (await store.getSettings()).ten_cong_ty });
  audit.log(req, 'Xuất báo cáo', 'Báo cáo', `Excel mẫu trình ký (DT–CP) · ${du_an.length} dự án`);
  const ten = `BaoCao_DTCP_${ngay.replace(/-/g, '')}.xlsx`;
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${ten}"` });
  res.send(Buffer.from(buf));
}));

// ---------- Thời điểm chốt số thực tế của công trình (TĐ1–TĐ3) ----------
const tdVal = (b) => {
  const errors = [];
  const td = Number(b.td), ngay = String(b.ngay || ''), dt = Number(b.dt), cp = Number(b.cp);
  if (![1, 2, 3].includes(td)) errors.push('Thời điểm phải là TĐ1, TĐ2 hoặc TĐ3');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay) || Number.isNaN(Date.parse(ngay))) errors.push('Nhập ngày chốt số hợp lệ');
  if (!Number.isInteger(dt) || dt < 0 || dt > 1e15) errors.push('Doanh thu phải là số nguyên không âm (đồng)');
  if (!Number.isInteger(cp) || cp < 0 || cp > 1e15) errors.push('Chi phí phải là số nguyên không âm (đồng)');
  return { data: { td, ngay, dt, cp, ghi_chu: String(b.ghi_chu || '').trim().slice(0, 200) }, errors };
};
const TD_TEN = { 1: 'Ký hợp đồng', 2: 'Có phát sinh', 3: 'Quyết toán' };
const tdTxt = (t) => (t ? `${TD_TEN[t.td] || ''} · ${t.ngay.split('-').reverse().join('/')} · DT ${new Intl.NumberFormat('vi-VN').format(t.dt)} đ · CP ${new Intl.NumberFormat('vi-VN').format(t.cp)} đ` : '—');
api.put('/du-an/:id/thoi-diem/:td', canTd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const p = id && (await store.getProject(id));
  if (!p) return bad(res, 'Không tìm thấy công trình', 404);
  const { data, errors } = tdVal({ ...(req.body || {}), td: req.params.td });
  if (errors.length) return bad(res, errors);
  const all = await store.listThoiDiem(id);
  const old = all.find((t) => t.td === data.td);
  // TĐ gần nhất trước / sau đã chốt (TĐ2 có thể bỏ trống khi không phát sinh: TĐ3 chỉ cần TĐ1)
  const prev = all.filter((t) => t.td < data.td).sort((a, b) => b.td - a.td)[0], next = all.filter((t) => t.td > data.td).sort((a, b) => a.td - b.td)[0];
  if (data.td > 1 && !all.some((t) => t.td === 1)) return bad(res, `Cần chốt TĐ1 (ký hợp đồng) trước khi nhập TĐ${data.td}`);
  if (prev && data.ngay < prev.ngay) return bad(res, `Ngày TĐ${data.td} không được trước ngày TĐ${prev.td} (${prev.ngay.split('-').reverse().join('/')})`);
  if (next && data.ngay > next.ngay) return bad(res, `Ngày TĐ${data.td} không được sau ngày TĐ${next.td} (${next.ngay.split('-').reverse().join('/')})`);
  await store.setThoiDiem(id, data.td, data, req.user.id);
  audit.log(req, old ? 'Sửa' : 'Thêm', 'Thời điểm', `TĐ${data.td} · ${tdTxt(data)}${old ? ` | Trước: ${tdTxt(old)}` : ''}`, { du_an: p.ma_du_an });
  res.json(await store.listThoiDiem(id));
}));
api.delete('/du-an/:id/thoi-diem/:td', canTd, wrap(async (req, res) => {
  const id = parseId(req.params.id), td = Number(req.params.td);
  const p = id && (await store.getProject(id));
  if (!p) return bad(res, 'Không tìm thấy công trình', 404);
  const all = await store.listThoiDiem(id);
  const old = all.find((t) => t.td === td);
  if (all.some((t) => t.td > td)) return bad(res, `Xóa TĐ${Math.max(...all.map((t) => t.td))} trước (xóa từ thời điểm sau cùng)`);
  if (!old || !(await store.deleteThoiDiem(id, td))) return bad(res, 'Thời điểm chưa có số liệu', 404);
  audit.log(req, 'Xóa', 'Thời điểm', `TĐ${td} · ${tdTxt(old)}`, { du_an: p.ma_du_an });
  res.status(204).end();
}));

// ---------- Mục tiêu năm (Báo cáo) ----------
const TARGET_KEY = 'muc_tieu';
async function readTargets() {
  try { return JSON.parse((await store.getSettings())[TARGET_KEY] || '{}'); } catch { return {}; }
}
api.get('/muc-tieu', wrap(async (_req, res) => res.json(await readTargets())));
api.put('/muc-tieu', auth.requireRole('admin'), wrap(async (req, res) => {
  const { data, errors } = validateTarget(req.body || {});
  if (errors.length) return bad(res, errors);
  const all = await readTargets();
  const { nam, ...t } = data;
  if (Object.values(t).every((x) => x === null)) delete all[nam]; else all[nam] = t;
  await store.saveSettings({ [TARGET_KEY]: JSON.stringify(all) });
  console.log(`[NHẬT KÝ] ${req.user.username} đặt mục tiêu năm ${nam}: ${JSON.stringify(t)}`);
  res.json(all);
}));

// ---------- Dữ liệu mẫu (tester) – chỉ Quản trị ----------
const demoProjects = async () => (await store.listProjects()).filter((p) => p.ma_du_an.startsWith(DEMO_PREFIX));
api.get('/demo', auth.requireRole('admin'), wrap(async (_req, res) => res.json({ count: (await demoProjects()).length })));
api.post('/demo', auth.requireRole('admin'), wrap(async (req, res) => {
  if ((await demoProjects()).length) return bad(res, 'Đã có dữ liệu mẫu (DEMO-...). Hãy xóa dữ liệu mẫu trước khi tạo lại.', 409);
  const seed = Number.isInteger(req.body?.seed) ? req.body.seed : 22; // bộ số mẫu đã chọn: mọi công trình có lãi, không cảnh báo
  const t0 = Date.now();
  try {
    const count = await seedDemo(store, req.user.id, seed);
    console.log(`[NHẬT KÝ] ${req.user.username} tạo dữ liệu mẫu (${Date.now() - t0} ms):`, JSON.stringify(count));
    res.status(201).json({ count, ms: Date.now() - t0 });
  } catch (e) {
    for (const p of await demoProjects()) await store.deleteProject(p.id); // tạo lỗi giữa chừng -> dọn sạch
    throw e;
  }
}));
api.delete('/demo', auth.requireRole('admin'), wrap(async (req, res) => {
  if (!(await requirePasscode(req, res))) return;
  const list = await demoProjects();
  for (const p of list) await store.deleteProject(p.id);
  console.log(`[NHẬT KÝ] ${req.user.username} xóa ${list.length} dự án dữ liệu mẫu`);
  res.json({ deleted: list.length });
}));

// ---------- Ảnh công trình (1 ảnh đại diện / dự án, lưu trong CSDL) ----------
const IMG_MAX = 3 * 1024 * 1024;
function imageMime(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
api.get('/du-an/:id/anh', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const img = id && (await store.getProjectImage(id));
  if (!img) return res.status(404).end();
  const etag = `"anh-${id}-${img.v}"`;
  res.set({ 'Cache-Control': 'private, max-age=86400', ETag: etag });
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type(img.mime).send(img.data);
}));
api.put('/du-an/:id/anh', canHd, express.raw({ type: () => true, limit: IMG_MAX }), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || !(await store.getProject(id))) return bad(res, 'Không tìm thấy công trình', 404);
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const mime = imageMime(buf);
  if (!mime) return bad(res, 'Chỉ nhận ảnh JPG, PNG hoặc WEBP');
  await store.setProjectImage(id, mime, buf);
  console.log(`[NHẬT KÝ] ${req.user.username} cập nhật ảnh công trình #${id} (${Math.round(buf.length / 1024)} KB)`);
  res.json({ ok: true });
}));
api.delete('/du-an/:id/anh', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  await store.deleteProjectImage(id);
  res.status(204).end();
}));

// ---------- Doanh thu theo công trình ----------
api.get('/du-an/:id/doanh-thu', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const du_an = await store.getProject(id);
  if (!du_an) return bad(res, 'Không tìm thấy công trình', 404);
  const tien_ve = sortTienVe(await store.listTienVe(id)).map((r) => ({ ...r, nhan: tienVeLabel(r) }));
  const items = markTamTinh(sortRevenue(await store.listRevenue(id)).map(calcLine), tien_ve); // tạm tính = HĐ chưa quyết toán
  res.json({ du_an, items, tong: summarize(items), tien_ve, tong_tien_ve: summarizeTienVe(tien_ve) });
}));

// Doanh thu tổng hợp TẤT CẢ dự án (chỉ xem): số HĐ/PL ghi kèm mã dự án để không gộp nhầm HĐ trùng số giữa các dự án
api.get('/doanh-thu-tong', wrap(async (_req, res) => {
  const projects = await store.listProjects();
  const items = [], tien_ve = [];
  for (const p of projects) {
    const [rev, tv] = await Promise.all([store.listRevenue(p.id), store.listTienVe(p.id)]);
    for (const r of markTamTinh(sortRevenue(rev).map(calcLine), tv))
      items.push({ ...r, du_an_id: p.id, ma_du_an: p.ma_du_an, so_ma: r.so_ma ? `${p.ma_du_an} · ${r.so_ma}` : r.so_ma, so_hieu: `${p.ma_du_an} · ${r.so_hieu}` });
    for (const t of sortTienVe(tv)) tien_ve.push({ ...t, du_an_id: p.id, ma_du_an: p.ma_du_an, nhan: `${p.ma_du_an} · ${tienVeLabel(t)}` });
  }
  res.json({ tat_ca: true, so_du_an: projects.length, du_an: { id: 0, ma_du_an: 'Tất cả', ten_du_an: `Tất cả dự án (${projects.length})`, chu_dau_tu: '' },
    items, tong: summarize(items), tien_ve, tong_tien_ve: summarizeTienVe(tien_ve) });
}));

// ---------- Giá trị tiền về ----------
api.post('/du-an/:id/tien-ve', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  if (!(await store.getProject(id))) return bad(res, 'Không tìm thấy công trình', 404);
  const { data, errors } = validateTienVe(req.body || {});
  if (errors.length) return bad(res, errors);
  const refErr = await checkHeadRef(data.hd_id, id);
  if (refErr) return bad(res, refErr);
  res.status(201).json(await store.createTienVe(id, data, req.user.id));
}));

api.put('/tien-ve/:id', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const cur = await store.getTienVe(id);
  if (!cur) return bad(res, 'Không tìm thấy dòng tiền về', 404);
  const { data, errors } = validateTienVe(req.body || {});
  if (errors.length) return bad(res, errors);
  const refErr = await checkHeadRef(data.hd_id, cur.du_an_id);
  if (refErr) return bad(res, refErr);
  const ok = await store.updateTienVe(id, data, req.user.id);
  ok ? res.json({ id }) : bad(res, 'Không tìm thấy dòng tiền về', 404);
}));

api.delete('/tien-ve/:id', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const ok = await store.deleteTienVe(id);
  ok ? res.status(204).end() : bad(res, 'Không tìm thấy dòng tiền về', 404);
}));

api.post('/du-an/:id/doanh-thu', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  if (!(await store.getProject(id))) return bad(res, 'Không tìm thấy công trình', 404);
  const { data, errors } = validateRevenue(req.body || {});
  if (errors.length) return bad(res, errors);
  const refErr = await checkHdRef(data, id);
  if (refErr) return bad(res, refErr);
  res.status(201).json(await store.createRevenue(id, data, req.user.id));
}));

// Phải là hợp đồng gốc (HĐ) của cùng công trình
async function checkHeadRef(hdId, duAnId) {
  const hd = await store.getRevenue(hdId);
  if (!hd || hd.loai !== 'hd' || hd.du_an_id !== duAnId) return 'Số HĐ không thuộc công trình này, hãy chọn lại';
  return hd.ma_loai === 'HĐ' ? null : 'Chỉ chọn hợp đồng gốc (HĐ), không chọn phụ lục';
}

// Mục 1: không trùng tên "HĐ/PL + Số mã" trong cùng công trình
// Mục 2: dòng HT/QT phải tham chiếu 1 dòng HĐ/PL của cùng công trình
async function checkHdRef(data, duAnId, selfId = 0) {
  if (data.loai === 'hd') {
    const list = await store.listRevenue(duAnId);
    // PL cùng Số mã với một HĐ đã có -> dùng đúng cách viết của HĐ đó (gộp nhóm chính xác)
    if (data.ma_loai !== 'HĐ') {
      const head = list.find((r) => r.loai === 'hd' && r.ma_loai === 'HĐ' && r.id !== selfId &&
        String(r.so_ma).toLowerCase() === data.so_ma.toLowerCase());
      if (head) { data.so_ma = head.so_ma; data.so_hieu = `${data.ma_loai} ${data.so_ma}`; }
    }
    const dup = list.some((r) =>
      r.loai === 'hd' && r.id !== selfId && String(r.so_hieu).toLowerCase() === data.so_hieu.toLowerCase());
    return dup ? `"${data.so_hieu}" đã có trong công trình này` : null;
  }
  // Chỉ gắn với hợp đồng gốc (HĐ), không gắn vào phụ lục để tránh nhiễu số liệu
  return checkHeadRef(data.hd_id, duAnId);
}

api.put('/doanh-thu/:id', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const cur = await store.getRevenue(id);
  if (!cur) return bad(res, 'Không tìm thấy dòng doanh thu', 404);
  // Không cho đổi loại dòng (HĐ/PL ↔ HT/QT) khi sửa
  const { data, errors } = validateRevenue({ ...(req.body || {}), loai: cur.loai });
  if (errors.length) return bad(res, errors);
  const refErr = await checkHdRef(data, cur.du_an_id, id);
  if (refErr) return bad(res, refErr);
  if (cur.loai === 'hd' && cur.ma_loai === 'HĐ' && data.ma_loai !== 'HĐ') {
    const { qt, tv } = await store.countRevenueRefs(id);
    if (qt || tv) return bad(res, `Không đổi được loại của "${cur.so_hieu}" vì đang có dòng HT/QT hoặc Tiền về gắn vào HĐ này`);
  }
  const ok = await store.updateRevenue(id, data, req.user.id);
  ok ? res.json({ id }) : bad(res, 'Không tìm thấy dòng doanh thu', 404);
}));

// Phạm vi ảnh hưởng khi xóa 1 dòng HĐ/PL (để hiện cho người dùng xác nhận)
async function contractImpact(cur) {
  const items = (await store.listRevenue(cur.du_an_id)).map(calcLine);
  const self = items.find((r) => r.id === cur.id);
  const out = { so_hieu: cur.so_hieu, sau_vat: self?.sau_vat || 0, pls: [], qt: { n: 0, sau_vat: 0 }, tv: { n: 0, so_tien: 0 } };
  if (cur.loai !== 'hd' || cur.ma_loai !== 'HĐ') return out;
  const so = String(cur.so_ma).toLowerCase();
  out.pls = items.filter((r) => r.loai === 'hd' && r.ma_loai !== 'HĐ' && String(r.so_ma).toLowerCase() === so)
    .map((r) => ({ so_hieu: r.so_hieu, sau_vat: r.sau_vat }));
  const qts = items.filter((r) => r.loai === 'qt' && r.hd_id === cur.id);
  out.qt = { n: qts.length, sau_vat: qts.reduce((s, r) => s + r.sau_vat, 0) };
  const tvs = (await store.listTienVe(cur.du_an_id)).filter((r) => r.hd_id === cur.id);
  out.tv = { n: tvs.length, so_tien: tvs.reduce((s, r) => s + r.so_tien, 0) };
  return out;
}

api.get('/doanh-thu/:id/impact', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await store.getRevenue(id));
  if (!cur) return bad(res, 'Không tìm thấy dòng doanh thu', 404);
  const im = await contractImpact(cur);
  // HĐ thầu phụ đang gắn HĐ CĐT này (không bị xóa, chỉ chuyển về "Chưa gắn HĐ CĐT")
  im.tp = cur.ma_loai === 'HĐ' ? (await store.listTp(cur.du_an_id)).contracts.filter((t) => t.hd_cdt_id === cur.id).length : 0;
  res.json(im);
}));

api.delete('/doanh-thu/:id', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const cur = await store.getRevenue(id);
  if (!cur) return bad(res, 'Không tìm thấy dòng doanh thu', 404);
  const cascade = req.body?.cascade === true;
  if (cur.loai === 'hd') {
    const { qt, tv } = await store.countRevenueRefs(id);
    if ((qt || tv) && !cascade) {
      const parts = [qt && `${qt} dòng Hoàn thành/Quyết toán`, tv && `${tv} dòng Tiền về`].filter(Boolean).join(' và ');
      return bad(res, `Không xóa được "${cur.so_hieu}": đang được ${parts} tham chiếu. Chọn "Xóa toàn bộ hợp đồng" để xóa kèm.`, 409);
    }
    // Xóa Số HĐ/PL phải nhập Passcode do Quản trị đặt
    if (!(await requirePasscode(req, res))) return;
    // Xóa toàn bộ hợp đồng: HĐ + PL cùng Số mã + HT/QT + Tiền về
    if (cascade && cur.ma_loai === 'HĐ') {
      const im = await contractImpact(cur);
      await store.deleteContractCascade(cur);
      console.log(`[NHẬT KÝ] ${new Date().toISOString()} ${req.user.username} đã XÓA TOÀN BỘ HỢP ĐỒNG "${cur.so_hieu}" ` +
        `(công trình #${cur.du_an_id}): HĐ ${im.sau_vat}đ; ${im.pls.length} PL [${im.pls.map((p) => p.so_hieu).join(', ')}]; ` +
        `${im.qt.n} dòng HT/QT ${im.qt.sau_vat}đ; ${im.tv.n} dòng tiền về ${im.tv.so_tien}đ`);
      return res.status(204).end();
    }
  }
  const ok = await store.deleteRevenue(id);
  if (ok && cur.loai === 'hd') console.log(`[NHẬT KÝ] ${new Date().toISOString()} ${req.user.username} đã xóa "${cur.so_hieu}" (công trình #${cur.du_an_id}, dòng #${id})`);
  ok ? res.status(204).end() : bad(res, 'Không tìm thấy dòng doanh thu', 404);
}));

// ---------- Chi phí công trình ----------
api.get('/du-an/:id/chi-phi', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const du_an = await store.getProject(id);
  if (!du_an) return bad(res, 'Không tìm thấy công trình', 404);
  const items = sortCost(await store.listCost(id)).map(costLine);
  const thau_phu = buildContracts(await store.listTp(id));
  // Nhóm 1 Thầu phụ = giá trị HT/QT của các HĐTP (+ dòng thầu phụ nhập kiểu cũ nếu có)
  const tpAsCost = thau_phu.map((c) => ({ nhom: c.nhom || 'thau_phu', gia_tri: c.qt_gia_tri, tien_vat: c.qt_tien_vat, sau_vat: c.qt_sau_vat, tam_tinh: c.tam_tinh }));
  // Danh sách HĐ chủ đầu tư (HĐ gốc) để gộp / gắn thầu phụ, theo thứ tự như tab Doanh thu
  const hd_cdt = sortRevenue((await store.listRevenue(id)).filter((r) => r.loai === 'hd' && r.ma_loai === 'HĐ'))
    .map((r) => ({ id: r.id, so_ma: r.so_ma, so_hieu: r.so_hieu, ngay: r.ngay }));
  res.json({ du_an, items, thau_phu, hd_cdt, tong_tp: summarizeContracts(thau_phu), tong: summarizeCost([...items, ...tpAsCost]) });
}));

// Chi phí tổng hợp TẤT CẢ dự án (chỉ xem): ghép dữ liệu từng dự án, tính tổng bằng cùng hàm như từng dự án
api.get('/chi-phi-tong', wrap(async (_req, res) => {
  const projects = await store.listProjects();
  const items = [], thau_phu = [], hd_cdt = [];
  for (const p of projects) {
    const [cost, tp, rev] = await Promise.all([store.listCost(p.id), store.listTp(p.id), store.listRevenue(p.id)]);
    for (const r of sortCost(cost).map(costLine)) items.push({ ...r, du_an_id: p.id, ma_du_an: p.ma_du_an });
    for (const c of buildContracts(tp)) thau_phu.push({ ...c, du_an_id: p.id, ma_du_an: p.ma_du_an });
    for (const r of sortRevenue(rev.filter((x) => x.loai === 'hd' && x.ma_loai === 'HĐ')))
      hd_cdt.push({ id: r.id, so_ma: r.so_ma, so_hieu: `${p.ma_du_an} · ${r.so_hieu}`, ngay: r.ngay, du_an_id: p.id });
  }
  const tpAsCost = thau_phu.map((c) => ({ nhom: c.nhom || 'thau_phu', gia_tri: c.qt_gia_tri, tien_vat: c.qt_tien_vat, sau_vat: c.qt_sau_vat, tam_tinh: c.tam_tinh }));
  res.json({ tat_ca: true, so_du_an: projects.length, du_an: { id: 0, ma_du_an: 'Tất cả', ten_du_an: `Tất cả dự án (${projects.length})`, chu_dau_tu: '' },
    items, thau_phu, hd_cdt, tong_tp: summarizeContracts(thau_phu), tong: summarizeCost([...items, ...tpAsCost]) });
}));

api.post('/du-an/:id/chi-phi', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  if (!(await store.getProject(id))) return bad(res, 'Không tìm thấy công trình', 404);
  const { data, errors } = validateCost({ ...(req.body || {}), _new: true });
  if (errors.length) return bad(res, errors);
  res.status(201).json(await store.createCost(id, data, req.user.id));
}));

api.put('/chi-phi/:id', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const { data, errors } = validateCost(req.body || {});
  if (errors.length) return bad(res, errors);
  const ok = await store.updateCost(id, data, req.user.id);
  ok ? res.json({ id }) : bad(res, 'Không tìm thấy dòng chi phí', 404);
}));

api.delete('/chi-phi/:id', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return bad(res, 'ID không hợp lệ');
  const ok = await store.deleteCost(id);
  ok ? res.status(204).end() : bad(res, 'Không tìm thấy dòng chi phí', 404);
}));

// ---------- Thầu phụ theo hợp đồng ----------
const LOCK_MSG = 'Hợp đồng đã thanh toán đủ (còn lại = 0) – đã khóa số. Muốn điều chỉnh, bấm Mở khóa (cần Passcode).';
// Mở khóa tạm (sau khi nhập đúng Passcode): tpId -> hết hạn; khóa lại khi đóng bảng chi tiết hoặc sau 60 phút
const tpMoKhoa = new Map();
const TP_MO_KHOA_MS = 60 * 60 * 1000;
async function tpIsLocked(tpId) {
  const exp = tpMoKhoa.get(tpId);
  if (exp && exp > Date.now()) return false;
  if (exp) tpMoKhoa.delete(tpId);
  const tp = await store.getTp(tpId);
  if (!tp) return false;
  const c = buildContracts(await store.listTp(tp.du_an_id)).find((x) => x.id === tpId);
  return Boolean(c?.khoa);
}
async function lockedErr(res, tpId) {
  if (await tpIsLocked(tpId)) { bad(res, LOCK_MSG, 423); return true; }
  return false;
}
async function tpOf(req, res) {
  const id = parseId(req.params.id);
  const tp = id && (await store.getTp(id));
  if (!tp) { bad(res, 'Không tìm thấy hợp đồng thầu phụ', 404); return null; }
  return tp;
}

api.post('/du-an/:id/thau-phu', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || !(await store.getProject(id))) return bad(res, 'Không tìm thấy công trình', 404);
  const t = validateTp(req.body || {});
  const l = validateTpLine({ ...(req.body?.hd || {}), ma_loai: 'HĐ' });
  const errors = [...t.errors, ...l.errors];
  if (errors.length) return bad(res, errors);
  if (t.data.hd_cdt_id) { const e = await checkHeadRef(t.data.hd_cdt_id, id); if (e) return bad(res, 'HĐ chủ đầu tư: ' + e); }
  res.status(201).json(await store.createTp(id, t.data, l.data, req.user.id));
}));

// Gợi ý khi nhập HĐ đầu vào: nhà thầu đã có + hạng mục từng thi công (gộp theo tên, không phân biệt hoa thường)
api.get('/thau-phu-goi-y', wrap(async (_req, res) => {
  const m = new Map();
  for (const r of await store.listTpGoiY()) {
    const k = r.doi_tac.trim().toLowerCase(); if (!k) continue;
    const o = m.get(k) || { doi_tac: r.doi_tac.trim(), nhom: r.nhom, so_hd: 0, hang_muc: [] };
    o.so_hd++;
    const hm = String(r.hang_muc || '').trim();
    if (hm) { const h = o.hang_muc.find((x) => x.ten.toLowerCase() === hm.toLowerCase()); if (h) { h.n++; if (!h.du_an.includes(r.ma_du_an)) h.du_an.push(r.ma_du_an); } else o.hang_muc.push({ ten: hm, n: 1, du_an: [r.ma_du_an] }); }
    m.set(k, o);
  }
  res.json([...m.values()].map((o) => ({ ...o, hang_muc: o.hang_muc.sort((a, b) => b.n - a.n) })).sort((a, b) => b.so_hd - a.so_hd || a.doi_tac.localeCompare(b.doi_tac, 'vi')));
}));

api.put('/thau-phu/:id', canHd, wrap(async (req, res) => {
  const tp = await tpOf(req, res); if (!tp) return;
  const body = req.body || {};
  const { data, errors } = validateTp(body);
  if (errors.length) return bad(res, errors);
  if (!('hd_cdt_id' in body)) data.hd_cdt_id = tp.hd_cdt_id ?? null; // không gửi -> giữ nguyên liên kết
  if (!('hang_muc' in body)) data.hang_muc = tp.hang_muc || '';   // không gửi -> giữ nguyên hạng mục
  if (data.hd_cdt_id) { const e = await checkHeadRef(data.hd_cdt_id, tp.du_an_id); if (e) return bad(res, 'HĐ chủ đầu tư: ' + e); }
  await store.updateTp(tp.id, data, req.user.id);
  res.json({ id: tp.id });
}));

api.delete('/thau-phu/:id', canHd, wrap(async (req, res) => {
  const tp = await tpOf(req, res); if (!tp) return;
  if (!(await requirePasscode(req, res))) return;
  const c = buildContracts(await store.listTp(tp.du_an_id)).find((x) => x.id === tp.id);
  await store.deleteTp(tp.id);
  console.log(`[NHẬT KÝ] ${new Date().toISOString()} ${req.user.username} đã XÓA HĐ THẦU PHỤ "${tp.so_ma}" (công trình #${tp.du_an_id}): ` +
    `${c.lines.length} dòng HĐ/PL, HĐ ${c.hd_sau_vat}đ, HT/QT ${c.qt_sau_vat}đ, ${c.pays.length} dòng thanh toán ${c.da_tt}đ`);
  res.status(204).end();
}));

api.post('/thau-phu/:id/hd-pl', canHd, wrap(async (req, res) => {
  const tp = await tpOf(req, res); if (!tp) return;
  if (await lockedErr(res, tp.id)) return;
  const { data, errors } = validateTpLine(req.body || {});
  if (errors.length) return bad(res, errors);
  res.status(201).json(await store.createTpLine(tp.id, data, req.user.id));
}));

api.put('/tp-hd-pl/:id', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await store.getTpLine(id));
  if (!cur) return bad(res, 'Không tìm thấy dòng HĐ/PL', 404);
  if (await lockedErr(res, cur.tp_id)) return;
  const { data, errors } = validateTpLine(req.body || {});
  if (errors.length) return bad(res, errors);
  if ((cur.ma_loai === 'HĐ') !== (data.ma_loai === 'HĐ')) return bad(res, 'Không đổi được dòng HĐ gốc thành PL (và ngược lại)');
  await store.updateTpLine(id, data, req.user.id);
  res.json({ id });
}));

api.delete('/tp-hd-pl/:id', canHd, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await store.getTpLine(id));
  if (!cur) return bad(res, 'Không tìm thấy dòng HĐ/PL', 404);
  if (cur.ma_loai === 'HĐ') return bad(res, 'Dòng HĐ gốc không xóa riêng được. Hãy xóa cả hợp đồng thầu phụ.');
  if (await lockedErr(res, cur.tp_id)) return;
  if (!(await requirePasscode(req, res))) return;
  await store.deleteTpLine(id);
  const tp = await store.getTp(cur.tp_id);
  console.log(`[NHẬT KÝ] ${new Date().toISOString()} ${req.user.username} đã xóa "${cur.ma_loai} ${tp?.so_ma}" (HĐ thầu phụ #${cur.tp_id})`);
  res.status(204).end();
}));

api.post('/thau-phu/:id/thanh-toan', canTien, wrap(async (req, res) => {
  const tp = await tpOf(req, res); if (!tp) return;
  if (await lockedErr(res, tp.id)) return;
  const { data, errors } = validateTpPay(req.body || {});
  if (errors.length) return bad(res, errors);
  const r = await store.createTpPay(tp.id, data, req.user.id);
  res.status(201).json(r);
}));

// Mở khóa tạm HĐ đầu vào đã thanh toán đủ (cần Passcode); số liệu giữ nguyên
api.post('/thau-phu/:id/mo-khoa', canMoKhoa, wrap(async (req, res) => {
  const tp = await tpOf(req, res); if (!tp) return;
  if (!(await requirePasscode(req, res))) return;
  tpMoKhoa.set(tp.id, Date.now() + TP_MO_KHOA_MS);
  console.log(`[NHẬT KÝ] ${new Date().toISOString()} ${req.user.username} đã MỞ KHÓA HĐ đầu vào "${tp.so_ma}" (#${tp.id}) để điều chỉnh`);
  res.json({ ok: true, het_han: TP_MO_KHOA_MS / 60000 });
}));
// Khóa lại (đóng bảng chi tiết): nếu Còn lại vẫn = 0 thì tự khóa như cũ
api.post('/thau-phu/:id/khoa', canMoKhoa, wrap(async (req, res) => {
  const tp = await tpOf(req, res); if (!tp) return;
  tpMoKhoa.delete(tp.id);
  res.json({ ok: true });
}));

api.put('/tp-thanh-toan/:id', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await store.getTpPay(id));
  if (!cur) return bad(res, 'Không tìm thấy dòng thanh toán', 404);
  if (await lockedErr(res, cur.tp_id)) return;
  const { data, errors } = validateTpPay(req.body || {});
  if (errors.length) return bad(res, errors);
  await store.updateTpPay(id, data, req.user.id);
  res.json({ id });
}));

api.delete('/tp-thanh-toan/:id', canTien, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await store.getTpPay(id));
  if (!cur) return bad(res, 'Không tìm thấy dòng thanh toán', 404);
  if (await lockedErr(res, cur.tp_id)) return;
  await store.deleteTpPay(id);
  res.status(204).end();
}));

app.use('/api', api);
app.use('/api', (_req, res) => bad(res, 'Không tìm thấy API', 404));

// Xử lý lỗi chung
app.use((err, req, res, _next) => {
  if (err.code === '23505') {
    const msg = /thau-phu$|thau-phu\/\d+$/.test(req.path) ? 'Số hợp đồng này đã có trong công trình (thầu phụ, vật tư, MMTB, nhân công dùng chung danh sách số HĐ)'
      : req.path.includes('hd-pl') ? 'Loại HĐ/PL này đã có trong hợp đồng thầu phụ'
      : req.path.includes('thanh-toan') ? 'Trùng dữ liệu: số đợt thanh toán / quyết toán này đã có'
      : req.path.includes('tien-ve')
      ? 'Trùng dữ liệu: số đợt thanh toán này đã có trong HĐ, hoặc HĐ đã có dòng Quyết toán'
      : /users/.test(err.table || err.detail || '') || req.path.includes('/users') || req.path.includes('/setup')
        ? 'Tên đăng nhập đã tồn tại' : 'Mã dự án đã tồn tại';
    return bad(res, msg, 409);
  }
  if (err.type === 'entity.parse.failed') return bad(res, 'Dữ liệu JSON không hợp lệ');
  if (err.type === 'entity.too.large') return bad(res, req.path.endsWith('/anh') ? 'Ảnh quá lớn (tối đa 3 MB)' : 'Dữ liệu gửi lên quá lớn', 413);
  console.error(err);
  bad(res, 'Lỗi máy chủ', 500);
});

// =====================================================================
// Chẩn đoán lỗi CSDL
// =====================================================================
function dbHint(msg = '') {
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return 'Không tìm thấy máy chủ CSDL. Service PostgreSQL chưa có, sai tên trong ${{...}}, hoặc nằm ở project/môi trường khác.';
  if (/ECONNREFUSED/i.test(msg)) return 'Máy chủ CSDL từ chối kết nối. Service PostgreSQL chưa chạy xong (chờ 1–2 phút) hoặc đang lỗi.';
  if (/password authentication|authentication failed/i.test(msg)) return 'Sai mật khẩu CSDL. Hãy dùng tham chiếu ${{Postgres.DATABASE_URL}} thay vì dán tay giá trị cũ.';
  if (/does not exist/i.test(msg)) return 'Tên database trong DATABASE_URL không tồn tại.';
  if (/timeout|ETIMEDOUT/i.test(msg)) return 'Hết thời gian chờ kết nối CSDL. Kiểm tra service PostgreSQL có đang Active.';
  if (/Invalid URL|invalid connection|getaddrinfo .*undefined/i.test(msg)) return 'DATABASE_URL sai định dạng. Phải có dạng postgresql://user:pass@host:5432/db';
  if (/SSL|certificate/i.test(msg)) return 'Lỗi SSL khi kết nối CSDL.';
  return 'Kiểm tra biến DATABASE_URL và service PostgreSQL trên Railway.';
}

function dbErrorPage() {
  const e = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="10"><title>Chưa kết nối CSDL</title><link rel="icon" href="/img/favicon.png?v=mm1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap&subset=vietnamese"><link rel="stylesheet" href="/style.css"></head>
<body class="auth-page"><div class="auth-box wide"><div class="auth-brand"><img class="logo-full" src="/img/logo-full.png?v=mm1" alt="MyMoney">
<h1>Chưa kết nối được cơ sở dữ liệu</h1><p class="muted">Web đang chạy, đang tự thử kết nối lại (lần ${dbState.attempts}). Trang tự tải lại sau 10 giây.</p></div>
<div class="stack"><div><b>Nguyên nhân có thể:</b><br>${e(dbHint(dbState.error))}</div>
<div><b>Lỗi chi tiết:</b><br><code>${e(dbState.error || 'Đang kết nối...')}</code></div>
<div><b>DATABASE_URL đang trỏ tới:</b><br><code>${e(store.target)}</code></div></div></div>
<div class="auth-foot">Produced by the Supervisory Board</div></body></html>`;
}

// =====================================================================
// Khởi động: mở cổng web NGAY, rồi kết nối CSDL (tự thử lại mãi, không tắt web)
// =====================================================================
console.log(`Khởi động... PORT=${PORT} | CSDL: ${store.kind} | DATABASE_URL: ${store.target}`);
app.listen(PORT, '0.0.0.0', () => console.log(`Server chạy tại cổng ${PORT}`));

(async function connectDb() {
  for (;;) {
    dbState.attempts++;
    try {
      await store.init();
      const n = await store.migrateHdCodes();
      if (n) console.log(`Đã tách Loại/Số mã cho ${n} dòng HĐ/PL cũ`);
      const m = await store.migrateQtToHead();
      if (m) console.log(`Đã chuyển ${m} dòng HT/QT từ phụ lục sang HĐ gốc`);
      const t = await store.migrateTienVeHd();
      if (t) console.log(`Đã gắn HĐ cho ${t} dòng tiền về cũ`);
      await migrateTpHdCdt();
      dbState.ready = true;
      dbState.error = null;
      audit.startPrune();
      donKhach(); setInterval(donKhach, 60e3).unref(); // dọn tài khoản khách hết hạn mỗi phút
      console.log(`Đã kết nối CSDL (${store.kind}) sau ${dbState.attempts} lần thử`);
      return;
    } catch (e) {
      dbState.error = e.message || String(e);
      console.error(`Kết nối CSDL thất bại (lần ${dbState.attempts}): ${dbState.error} -> ${dbHint(dbState.error)}`);
      await new Promise((r) => setTimeout(r, Math.min(30000, 3000 * dbState.attempts)));
    }
  }
})();

// Không để lỗi bất ngờ làm sập web
process.on('unhandledRejection', (e) => console.error('Lỗi chưa xử lý:', e));
