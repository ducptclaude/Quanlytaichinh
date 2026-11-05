'use strict';
/** Giao diện (HTML tạo trực tiếp, không dùng thư viện khuôn mẫu) */
const { version } = require('../package.json');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function initials(name) {
  const words = String(name || 'QL').trim().split(/\s+/).filter(Boolean);
  const s = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || 'QL').slice(0, 2);
  return s.toUpperCase();
}

function logo(ctx) {
  // Logo: nếu có file public/logo.png thì đặt LOGO_URL=/logo.png; chưa có thì hiện chữ viết tắt
  if (ctx.logoUrl) return `<img class="logo-img" src="${esc(ctx.logoUrl)}" alt="Logo">`;
  return `<span class="logo-badge" aria-hidden="true">${esc(initials(ctx.appName))}</span>`;
}

function banner(ctx) {
  if (ctx.dbMode === 'memory') {
    return `<div class="banner banner-warn" role="alert">
      ⚠️ <b>Chưa nối kho dữ liệu.</b> Hệ thống đang chạy tạm — mọi dữ liệu sẽ <b>mất khi khởi động lại</b>.
      Hãy gắn PostgreSQL trên Railway trước khi dùng thật.</div>`;
  }
  if (ctx.dbMode === 'postgres' && !ctx.dbHealthy) {
    return `<div class="banner banner-error" role="alert">
      ⛔ <b>Mất kết nối kho dữ liệu.</b> Vui lòng thử lại sau ít phút hoặc báo Quản trị.</div>`;
  }
  return '';
}

function layout(ctx, { title, body, bare = false }) {
  const year = new Date().getFullYear();
  const footer = ctx.copyright
    ? esc(ctx.copyright)
    : `© ${year} ${esc(ctx.companyName || 'Tên công ty')}. Bảo lưu mọi quyền.`;

  const header = bare ? '' : `
  <header class="topbar">
    <a class="brand" href="/">${logo(ctx)}
      <span class="brand-text">
        <span class="brand-name">${esc(ctx.appName)}</span>
        ${ctx.companyName ? `<span class="brand-sub">${esc(ctx.companyName)}</span>` : ''}
      </span>
    </a>
    ${ctx.user ? `
    <div class="userbox">
      <span class="user-name" title="${esc(ctx.user.username)}">${esc(ctx.user.full_name)}
        <small>${ctx.user.role === 'admin' ? 'Quản trị' : 'Người dùng'}</small></span>
      <form method="post" action="/logout"><button class="btn btn-ghost" type="submit">Đăng xuất</button></form>
    </div>` : ''}
  </header>`;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(ctx.appName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=${version}">
</head>
<body class="${bare ? 'page-bare' : ''}">
${banner(ctx)}
${header}
<main class="main">${body}</main>
<footer class="footer"><span>${footer}</span><span class="ver">Phiên bản ${version}</span></footer>
<script src="/app.js?v=${version}" defer></script>
</body>
</html>`;
}

function alertBox(msg, type = 'error') {
  if (!msg) return '';
  const items = Array.isArray(msg) ? `<ul>${msg.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : esc(msg);
  return `<div class="alert alert-${type}" role="alert">${items}</div>`;
}

const pwRules = `
<ul class="pw-rules" data-pw-rules>
  <li data-rule="len">Tối thiểu 8 ký tự</li>
  <li data-rule="upper">Có chữ hoa (A-Z)</li>
  <li data-rule="lower">Có chữ thường (a-z)</li>
  <li data-rule="digit">Có chữ số (0-9)</li>
  <li data-rule="special">Có ký tự đặc biệt (!@#$...)</li>
</ul>`;

function setupPage(ctx, { errors, values = {}, needToken }) {
  const v = (k) => esc(values[k] || '');
  return layout(ctx, {
    title: 'Khởi tạo lần đầu',
    bare: true,
    body: `
<div class="card card-wide">
  <div class="card-head">
    ${logo(ctx)}
    <div><h1>Khởi tạo hệ thống</h1>
    <p class="muted">Chỉ thực hiện <b>một lần</b>. Sau khi hoàn tất, trang này tự khóa.</p></div>
  </div>
  ${alertBox(errors)}
  <form method="post" action="/setup" class="form" data-pw-form novalidate>
    ${needToken ? `
    <fieldset><legend>Xác thực</legend>
      <label><span>Mã khởi tạo <span class="req">*</span></span>
        <input name="setup_token" type="password" required autocomplete="off">
        <small class="hint">Mã do người cài đặt đặt trên Railway (biến SETUP_TOKEN).</small></label>
    </fieldset>` : ''}
    <fieldset><legend>Thông tin đơn vị</legend>
      <label><span>Tên công ty <span class="req">*</span></span>
        <input name="company_name" required maxlength="150" value="${v('company_name')}" placeholder="VD: Công ty CP Đầu tư ABC"></label>
      <label><span>Tên hệ thống <span class="req">*</span></span>
        <input name="app_name" required maxlength="80" value="${v('app_name')}" placeholder="VD: Quản lý Tài chính Dự án"></label>
      <label>Dòng bản quyền ở chân trang
        <input name="copyright" maxlength="200" value="${v('copyright')}" placeholder="Để trống: © ${new Date().getFullYear()} [Tên công ty]. Bảo lưu mọi quyền.">
      </label>
    </fieldset>
    <fieldset><legend>Tài khoản Quản trị</legend>
      <label><span>Họ và tên <span class="req">*</span></span>
        <input name="full_name" required maxlength="100" value="${v('full_name')}" autocomplete="name"></label>
      <label><span>Tên đăng nhập <span class="req">*</span></span>
        <input name="username" required maxlength="40" value="${v('username')}" autocomplete="username"
               pattern="[a-zA-Z0-9._-]{3,40}" placeholder="3-40 ký tự: chữ, số, . _ -">
      </label>
      <label><span>Mật khẩu <span class="req">*</span></span>
        <input name="password" type="password" required autocomplete="new-password" data-pw-input></label>
      ${pwRules}
      <label><span>Nhập lại mật khẩu <span class="req">*</span></span>
        <input name="password2" type="password" required autocomplete="new-password" data-pw-confirm></label>
      <small class="hint" data-pw-match></small>
    </fieldset>
    <button class="btn btn-primary btn-block" type="submit">Hoàn tất khởi tạo</button>
  </form>
</div>`,
  });
}

function loginPage(ctx, { error, username = '', info } = {}) {
  return layout(ctx, {
    title: 'Đăng nhập',
    bare: true,
    body: `
<div class="card">
  <div class="card-head center">
    ${logo(ctx)}
    <div><h1>${esc(ctx.appName)}</h1>
    ${ctx.companyName ? `<p class="muted">${esc(ctx.companyName)}</p>` : ''}</div>
  </div>
  ${alertBox(info, 'success')}
  ${alertBox(error)}
  <form method="post" action="/login" class="form">
    <label>Tên đăng nhập
      <input name="username" required autocomplete="username" value="${esc(username)}" autofocus></label>
    <label>Mật khẩu
      <input name="password" type="password" required autocomplete="current-password"></label>
    <button class="btn btn-primary btn-block" type="submit">Đăng nhập</button>
  </form>
</div>`,
  });
}

function homePage(ctx) {
  return layout(ctx, {
    title: 'Trang chủ',
    body: `
<section class="hero">
  <h1>Xin chào, ${esc(ctx.user.full_name)} 👋</h1>
  <p>Chào mừng đến với <b>${esc(ctx.appName)}</b>. Khung hệ thống đã sẵn sàng — các chức năng nghiệp vụ sẽ được bổ sung tiếp.</p>
</section>
<section class="grid">
  <div class="tile"><div class="tile-label">Đơn vị</div><div class="tile-value">${esc(ctx.companyName)}</div></div>
  <div class="tile"><div class="tile-label">Vai trò</div><div class="tile-value">${ctx.user.role === 'admin' ? 'Quản trị' : 'Người dùng'}</div></div>
  <div class="tile"><div class="tile-label">Kho dữ liệu</div><div class="tile-value">${
    ctx.dbMode === 'postgres' ? (ctx.dbHealthy ? '🟢 Đã kết nối' : '🔴 Mất kết nối') : '🟡 Chạy tạm'}</div></div>
  <div class="tile"><div class="tile-label">Phiên bản</div><div class="tile-value">${version}</div></div>
</section>`,
  });
}

function messagePage(ctx, { title, message, status = 'error', link = '/' }) {
  return layout(ctx, {
    title,
    bare: true,
    body: `<div class="card center"><h1>${esc(title)}</h1>${alertBox(message, status)}
      <a class="btn btn-primary" href="${esc(link)}">Quay lại</a></div>`,
  });
}

module.exports = { setupPage, loginPage, homePage, messagePage, esc };
