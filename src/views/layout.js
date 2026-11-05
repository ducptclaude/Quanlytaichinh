'use strict';
/** Khung trang chung: đầu trang, menu, cảnh báo, chân trang */
const { version } = require('../version');

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ROLE_LABEL = { admin: 'Quản trị', user: 'Người dùng' };
const roleLabel = (r) => ROLE_LABEL[r] || r;

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function initials(name) {
  const words = String(name || 'QL').trim().split(/\s+/).filter(Boolean);
  const s = words.length >= 2 ? words[0][0] + words[1][0] : (words[0] || 'QL').slice(0, 2);
  return s.toUpperCase();
}

function logo(ctx) {
  // Logo: đặt file vào public/ rồi khai LOGO_URL=/logo.png; chưa có thì hiện chữ viết tắt
  if (ctx.logoUrl) return `<img class="logo-img" src="${esc(ctx.logoUrl)}" alt="Logo">`;
  return `<span class="logo-badge" aria-hidden="true">${esc(initials(ctx.appName))}</span>`;
}

function banners(ctx) {
  let html = '';
  if (ctx.isStaging) {
    html += `<div class="banner banner-staging" role="note">HỆ THỐNG THỬ NGHIỆM
      <span>· Dữ liệu ở đây chỉ dùng để thử, không phải dữ liệu thật</span></div>`;
  }
  if (ctx.dbMode === 'memory') {
    html += `<div class="banner banner-warn" role="alert">
      ⚠️ <b>Chưa nối kho dữ liệu.</b> Hệ thống đang chạy tạm — mọi dữ liệu sẽ <b>mất khi khởi động lại</b>.
      Hãy gắn PostgreSQL trên Railway trước khi dùng thật.</div>`;
  } else if (ctx.dbMode === 'postgres' && !ctx.dbHealthy) {
    html += `<div class="banner banner-error" role="alert">
      ⛔ <b>Mất kết nối kho dữ liệu.</b> Vui lòng thử lại sau ít phút hoặc báo Quản trị.</div>`;
  }
  return html;
}

function nav(ctx) {
  if (!ctx.user || ctx.user.must_change_password) return '';
  const items = [
    ['/', 'Trang chủ'],
    ['/du-an', 'Dự án'],
    ['/nhap-hang-ngay', 'Nhập hằng ngày'],
    ['/doanh-thu', 'Doanh thu'],
    ['/chi-phi', 'Chi phí'],
    ['/bao-cao', 'Báo cáo'],
    ...(ctx.user.role === 'admin' ? [['/tai-khoan', 'Tài khoản']] : []),
    ['/ca-nhan', 'Cá nhân'],
    ['/lien-he', 'Liên hệ'],
  ];
  const isActive = (href) => (href === '/' ? ctx.path === '/' : ctx.path.startsWith(href));
  return `<nav class="tabs" aria-label="Menu chính">${items.map(([href, label]) =>
    `<a href="${href}" class="${isActive(href) ? 'active' : ''}">${label}</a>`).join('')}</nav>`;
}

function layout(ctx, { title, body, bare = false, scripts = [] }) {
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
    ${nav(ctx)}
    ${ctx.user ? `
    <div class="userbox">
      <span class="user-name" title="${esc(ctx.user.username)}">${esc(ctx.user.full_name)}
        <small>${roleLabel(ctx.user.role)}</small></span>
      <form method="post" action="/logout"><button class="btn btn-ghost" type="submit">Đăng xuất</button></form>
    </div>` : ''}
  </header>`;

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ctx.isStaging ? '[THỬ] ' : ''}${esc(title)} · ${esc(ctx.appName)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=${esc(version)}">
</head>
<body class="${bare ? 'page-bare' : ''}">
${banners(ctx)}
${header}
<main class="main">${body}</main>
<footer class="footer"><span>${footer}</span><a class="ver" href="/lien-he">Phiên bản ${esc(version)}</a></footer>
<script src="/app.js?v=${esc(version)}" defer></script>
${scripts.map((s) => `<script src="${esc(s)}?v=${esc(version)}" defer></script>`).join('')}
</body>
</html>`;
}

function alertBox(msg, type = 'error') {
  if (!msg || (Array.isArray(msg) && !msg.length)) return '';
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

/** Ô mật khẩu mới + nhập lại, có kiểm tra ngay khi gõ */
function newPasswordFields(label = 'Mật khẩu mới') {
  return `
      <label><span>${esc(label)} <span class="req">*</span></span>
        <input name="password" type="password" required autocomplete="new-password" data-pw-input></label>
      ${pwRules}
      <label><span>Nhập lại mật khẩu <span class="req">*</span></span>
        <input name="password2" type="password" required autocomplete="new-password" data-pw-confirm></label>
      <small class="hint" data-pw-match></small>`;
}

module.exports = { esc, layout, alertBox, logo, pwRules, newPasswordFields, roleLabel, fmtDate, version, ROLE_LABEL };
