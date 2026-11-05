'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const { createStore } = require('./src/db');
const auth = require('./src/auth');
const pages = require('./src/views/pages');
const { version } = require('./src/version');
const usersRouter = require('./src/routes/users');
const accountRouter = require('./src/routes/account');
const { entityRouter } = require('./src/routes/entities');
const reportsRouter = require('./src/routes/reports');
const { ENTITIES } = require('./src/entities');

const PORT = process.env.PORT || 3000;
const SESSION_HOURS = 12;
const COOKIE = 'sid';
const SETUP_TOKEN = (process.env.SETUP_TOKEN || '').trim();

/* ---------- Bản thử nghiệm hay bản chính ----------
 * APP_ENV=staging | production  (đặt tay, ưu tiên cao nhất)
 * Nếu không đặt: Railway tự cấp RAILWAY_ENVIRONMENT_NAME và RAILWAY_GIT_BRANCH
 *  -> môi trường khác "production" hoặc chạy từ nhánh staging thì coi là bản thử.
 */
function detectStaging() {
  const appEnv = (process.env.APP_ENV || '').trim().toLowerCase();
  if (appEnv) return appEnv !== 'production';
  const envName = (process.env.RAILWAY_ENVIRONMENT_NAME || '').trim().toLowerCase();
  const branch = (process.env.RAILWAY_GIT_BRANCH || '').trim().toLowerCase();
  return Boolean((envName && envName !== 'production') || branch === 'staging');
}
const IS_STAGING = detectStaging();

const store = createStore();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Railway đứng sau proxy https

/* ---------- Cấu hình hệ thống (đọc từ kho dữ liệu, giữ tạm trong bộ nhớ) ---------- */
let settings = null; // null = chưa đọc được
async function loadSettings() {
  settings = await store.getSettings();
  return settings;
}
function ctxOf(req) {
  const s = settings || {};
  return {
    appName: s.app_name || 'Hệ thống quản lý',
    companyName: s.company_name || '',
    copyright: s.copyright || '',
    contactPerson: s.contact_person || '',
    contactPhone: s.contact_phone || '',
    contactEmail: s.contact_email || '',
    logoUrl: process.env.LOGO_URL || '',
    dbMode: store.mode,
    dbHealthy: store.isHealthy(),
    isStaging: IS_STAGING,
    user: req.user || null,
    path: (req.originalUrl || req.path).split('?')[0],
  };
}

/* ---------- Bảo mật cơ bản ---------- */
app.use((req, res, next) => {
  res.set({
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '7d', index: false }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));

/* Chống gửi biểu mẫu giả mạo từ trang khác */
app.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const origin = req.get('origin') || req.get('referer') || '';
  if (!origin) return next(); // một số trình duyệt cũ không gửi; cookie SameSite vẫn bảo vệ
  try {
    if (new URL(origin).host === req.get('host')) return next();
  } catch (_) { /* bỏ qua */ }
  res.status(403).send('Yêu cầu không hợp lệ.');
});

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) {
      try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (_) { /* bỏ cookie lỗi */ }
    }
  });
  return out;
}
function sessionToken(req) {
  const t = parseCookies(req)[COOKIE];
  return t && /^[a-f0-9]{64}$/.test(t) ? t : null;
}
function setSessionCookie(req, res, token, maxAgeSec) {
  const parts = [`${COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (req.secure) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
const clientIp = (req) => req.ip || req.socket.remoteAddress || 'unknown';

/* ---------- Trang kiểm tra /health (không cần đăng nhập) ---------- */
app.get('/health', async (req, res) => {
  const dbOk = await store.ping();
  const database = store.mode === 'memory' ? 'not_configured' : dbOk ? 'connected' : 'error';
  const ok = database !== 'error';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    version,
    environment: IS_STAGING ? 'staging' : 'production',
    database,
    setup_done: settings ? Boolean(settings.setup_done) : null,
    uptime_seconds: Math.round(process.uptime()),
    time: new Date().toISOString(),
  });
});

/* ---------- Đọc cấu hình + người đang đăng nhập ---------- */
app.use(async (req, res, next) => {
  try {
    if (!settings) await loadSettings();
  } catch (e) {
    console.error('[app] Không đọc được cấu hình:', e.message);
    return res.status(503).send(pages.messagePage(ctxOf(req), {
      title: 'Không kết nối được kho dữ liệu',
      message: 'Hệ thống tạm thời không truy cập được kho dữ liệu. Vui lòng thử lại sau ít phút.',
    }));
  }
  try {
    const token = sessionToken(req);
    if (token) req.user = await store.getSessionUser(token);
  } catch (e) {
    console.error('[app] Lỗi đọc phiên đăng nhập:', e.message);
  }
  next();
});

/* Chưa khởi tạo -> mọi trang chuyển về /setup */
app.use((req, res, next) => {
  const done = Boolean(settings.setup_done);
  if (!done && req.path !== '/setup') return res.redirect('/setup');
  if (done && req.path === '/setup') return res.redirect(req.user ? '/' : '/login');
  next();
});

/* Bị Quản trị đặt lại mật khẩu -> phải đổi mật khẩu trước khi làm việc khác */
app.use((req, res, next) => {
  if (req.user && req.user.must_change_password
      && !['/ca-nhan', '/ca-nhan/doi-mat-khau', '/logout'].includes(req.path)) {
    return res.redirect('/ca-nhan');
  }
  next();
});

/* ---------- Khởi tạo lần đầu ---------- */
app.get('/setup', (req, res) => {
  res.send(pages.setupPage(ctxOf(req), { needToken: Boolean(SETUP_TOKEN) }));
});

app.post('/setup', async (req, res) => {
  const b = req.body || {};
  const values = {
    company_name: String(b.company_name || '').trim(),
    app_name: String(b.app_name || '').trim(),
    copyright: String(b.copyright || '').trim(),
    full_name: String(b.full_name || '').trim(),
    username: String(b.username || '').trim().toLowerCase(),
  };
  const password = String(b.password || '');
  const errors = [];

  if (SETUP_TOKEN) {
    const given = crypto.createHash('sha256').update(String(b.setup_token || '')).digest();
    const want = crypto.createHash('sha256').update(SETUP_TOKEN).digest();
    if (!crypto.timingSafeEqual(given, want)) errors.push('Mã khởi tạo không đúng');
  }
  if (!values.company_name) errors.push('Chưa nhập Tên công ty');
  if (values.company_name.length > 150) errors.push('Tên công ty tối đa 150 ký tự');
  if (!values.app_name) errors.push('Chưa nhập Tên hệ thống');
  if (values.app_name.length > 80) errors.push('Tên hệ thống tối đa 80 ký tự');
  if (values.copyright.length > 200) errors.push('Dòng bản quyền tối đa 200 ký tự');
  if (!values.full_name) errors.push('Chưa nhập Họ và tên');
  if (values.full_name.length > 100) errors.push('Họ và tên tối đa 100 ký tự');
  if (!/^[a-z0-9._-]{3,40}$/.test(values.username)) {
    errors.push('Tên đăng nhập 3-40 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -');
  }
  auth.checkPasswordStrength(password).forEach((e) => errors.push(`Mật khẩu: ${e}`));
  if (password !== String(b.password2 || '')) errors.push('Hai lần nhập mật khẩu không khớp');

  if (errors.length) {
    return res.status(400).send(pages.setupPage(ctxOf(req), { errors, values, needToken: Boolean(SETUP_TOKEN) }));
  }

  try {
    const password_hash = await auth.hashPassword(password);
    const result = await store.completeSetup({
      settings: {
        company_name: values.company_name,
        app_name: values.app_name,
        copyright: values.copyright,
      },
      admin: { username: values.username, full_name: values.full_name, password_hash },
    });
    await loadSettings();
    if (!result.ok) return res.redirect('/login');
    console.log(`[setup] Đã khởi tạo hệ thống, quản trị: ${values.username}`);
    res.send(pages.loginPage(ctxOf(req), {
      username: values.username,
      info: 'Khởi tạo thành công! Trang khởi tạo đã tự khóa. Hãy đăng nhập bằng tài khoản Quản trị vừa tạo.',
    }));
  } catch (e) {
    console.error('[setup] Lỗi:', e.message);
    res.status(500).send(pages.setupPage(ctxOf(req), {
      errors: ['Có lỗi khi lưu dữ liệu, vui lòng thử lại.'], values, needToken: Boolean(SETUP_TOKEN),
    }));
  }
});

/* ---------- Đăng nhập / Đăng xuất ---------- */
const DUMMY_HASH_P = auth.hashPassword(crypto.randomBytes(16).toString('hex'));

app.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.send(pages.loginPage(ctxOf(req)));
});

app.post('/login', async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase().slice(0, 40);
  const password = String(req.body.password || '').slice(0, 200);
  const ip = clientIp(req);
  const ctx = ctxOf(req);

  const locked = auth.lockRemaining(username, ip);
  if (locked > 0) {
    return res.status(429).send(pages.loginPage(ctx, {
      username,
      error: `Đăng nhập sai quá nhiều lần. Tạm khóa, vui lòng thử lại sau ${Math.ceil(locked / 60)} phút.`,
    }));
  }

  try {
    const user = username ? await store.findUserByUsername(username) : null;
    // luôn kiểm tra mật khẩu (kể cả khi không có tài khoản) để không lộ tài khoản nào tồn tại
    const ok = await auth.verifyPassword(password, user ? user.password_hash : await DUMMY_HASH_P);

    if (!user || !ok) {
      const left = auth.recordFailure(username, ip);
      const msg = left > 0
        ? `Sai tên đăng nhập hoặc mật khẩu. Còn ${left} lần thử trước khi bị tạm khóa.`
        : `Đăng nhập sai quá nhiều lần. Tạm khóa ${auth.LOCK_MS / 60000} phút.`;
      return res.status(401).send(pages.loginPage(ctx, { username, error: msg }));
    }
    if (!user.is_active) {
      return res.status(403).send(pages.loginPage(ctx, {
        username, error: 'Tài khoản đã bị khóa. Vui lòng liên hệ Quản trị.',
      }));
    }

    auth.clearFailures(username);
    const token = crypto.randomBytes(32).toString('hex');
    await store.createSession(token, user.id, new Date(Date.now() + SESSION_HOURS * 3600 * 1000));
    await store.touchLogin(user.id);
    setSessionCookie(req, res, token, SESSION_HOURS * 3600);
    res.redirect(user.must_change_password ? '/ca-nhan' : '/');
  } catch (e) {
    console.error('[login] Lỗi:', e.message);
    res.status(500).send(pages.loginPage(ctx, { username, error: 'Có lỗi hệ thống, vui lòng thử lại.' }));
  }
});

app.post('/logout', async (req, res) => {
  const token = sessionToken(req);
  if (token) await store.deleteSession(token).catch(() => {});
  setSessionCookie(req, res, '', 0);
  res.redirect('/login');
});

/* ---------- Các trang cần đăng nhập ---------- */
function requireLogin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.redirect('/login');
  if (req.user.role !== 'admin') {
    return res.status(403).send(pages.messagePage(ctxOf(req), {
      title: 'Không có quyền', message: 'Chức năng này chỉ dành cho Quản trị.',
    }));
  }
  next();
}

app.get('/', requireLogin, async (req, res, next) => {
  try {
    const rep = await reportsRouter.buildReport(store);
    res.send(pages.homePage(ctxOf(req), rep));
  } catch (e) { next(e); }
});

for (const key of Object.keys(ENTITIES)) {
  app.use(ENTITIES[key].path, entityRouter(key, { store, ctxOf, requireLogin }));
}
app.use('/bao-cao', reportsRouter({ store, ctxOf, requireLogin }));

app.use('/tai-khoan', usersRouter({ store, ctxOf, requireAdmin }));
app.use(accountRouter({ store, ctxOf, requireLogin, reloadSettings: loadSettings, sessionToken, clientIp }));

/* ---------- Không tìm thấy / lỗi ---------- */
app.use((req, res) => {
  res.status(404).send(pages.messagePage(ctxOf(req), {
    title: 'Không tìm thấy trang', message: 'Đường dẫn không tồn tại.',
  }));
});
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[app] Lỗi:', err.stack || err.message);
  res.status(err.status === 413 ? 413 : 500).send(pages.messagePage(ctxOf(req), {
    title: 'Có lỗi xảy ra', message: 'Vui lòng thử lại sau.',
  }));
});

/* ---------- Khởi động ---------- */
async function start() {
  try {
    await store.init();
    await loadSettings();
    console.log(`[db] Chế độ lưu trữ: ${store.mode === 'postgres' ? 'PostgreSQL' : 'BỘ NHỚ TẠM (chưa nối kho dữ liệu)'}`);
  } catch (e) {
    console.error('[db] Không kết nối được PostgreSQL, sẽ thử lại định kỳ:', e.message);
    const retry = async () => {
      try {
        await store.init();
        await loadSettings();
        console.log('[db] Đã kết nối lại PostgreSQL');
      } catch (_) {
        setTimeout(retry, 30000); // thử lại sau 30 giây
      }
    };
    setTimeout(retry, 30000);
  }

  setInterval(() => store.purgeExpiredSessions().catch(() => {}), 60 * 60 * 1000).unref();

  app.listen(PORT, () => console.log(
    `[app] Phiên bản ${version} (${IS_STAGING ? 'BẢN THỬ' : 'bản chính'}) đang chạy tại cổng ${PORT}`
  ));
}

if (require.main === module) start();
module.exports = { app, start };
