'use strict';
const { esc, layout, alertBox, logo, newPasswordFields, roleLabel, fmtDate, version } = require('./layout');

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
      ${newPasswordFields('Mật khẩu')}
    </fieldset>
    <button class="btn btn-primary btn-block" type="submit">Hoàn tất khởi tạo</button>
  </form>
</div>`,
  });
}

function supportLine(ctx) {
  const parts = [];
  if (ctx.contactPhone) parts.push(`☎ <a href="tel:${esc(ctx.contactPhone.replace(/[^0-9+]/g, ''))}">${esc(ctx.contactPhone)}</a>`);
  if (ctx.contactEmail) parts.push(`✉ <a href="mailto:${esc(ctx.contactEmail)}">${esc(ctx.contactEmail)}</a>`);
  return parts.length ? `<p class="support">Hỗ trợ: ${parts.join(' · ')}</p>` : '';
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
  ${supportLine(ctx)}
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
  <div class="tile"><div class="tile-label">Vai trò</div><div class="tile-value">${roleLabel(ctx.user.role)}</div></div>
  <div class="tile"><div class="tile-label">Kho dữ liệu</div><div class="tile-value">${
    ctx.dbMode === 'postgres' ? (ctx.dbHealthy ? '🟢 Đã kết nối' : '🔴 Mất kết nối') : '🟡 Chạy tạm'}</div></div>
  <div class="tile"><div class="tile-label">Phiên bản</div><div class="tile-value">${esc(version)}</div></div>
</section>`,
  });
}

/* ---------- Tab Cá nhân ---------- */
function personalPage(ctx, { me, errors, success, forced }) {
  return layout(ctx, {
    title: 'Cá nhân',
    body: `
<h1 class="page-title">Cá nhân</h1>
${forced ? alertBox('Quản trị vừa đặt lại mật khẩu cho bạn. Vui lòng đổi mật khẩu mới trước khi tiếp tục.', 'warn') : ''}
${alertBox(success, 'success')}
<div class="cols">
  <section class="panel">
    <h2>Thông tin tài khoản</h2>
    <dl class="info">
      <dt>Họ và tên</dt><dd>${esc(me.full_name)}</dd>
      <dt>Tên đăng nhập</dt><dd>${esc(me.username)}</dd>
      <dt>Vai trò</dt><dd>${roleLabel(me.role)}</dd>
      <dt>Ngày tạo</dt><dd>${fmtDate(me.created_at)}</dd>
      <dt>Đăng nhập gần nhất</dt><dd>${fmtDate(me.last_login_at)}</dd>
    </dl>
    <p class="hint">Cần sửa họ tên hoặc vai trò? Vui lòng liên hệ Quản trị.</p>
  </section>
  <section class="panel">
    <h2>Đổi mật khẩu</h2>
    ${alertBox(errors)}
    <form method="post" action="/ca-nhan/doi-mat-khau" class="form" data-pw-form novalidate>
      <label><span>Mật khẩu hiện tại <span class="req">*</span></span>
        <input name="current_password" type="password" required autocomplete="current-password"></label>
      ${newPasswordFields()}
      <button class="btn btn-primary" type="submit">Đổi mật khẩu</button>
      <small class="hint">Sau khi đổi, các thiết bị khác đang đăng nhập tài khoản này sẽ bị đăng xuất.</small>
    </form>
  </section>
</div>`,
  });
}

/* ---------- Tab Liên hệ ---------- */
function contactPage(ctx, { errors, success, values }) {
  const isAdmin = ctx.user.role === 'admin';
  const v = values || { contact_phone: ctx.contactPhone, contact_email: ctx.contactEmail, contact_person: ctx.contactPerson };
  const phoneHref = (ctx.contactPhone || '').replace(/[^0-9+]/g, '');
  return layout(ctx, {
    title: 'Liên hệ',
    body: `
<h1 class="page-title">Liên hệ & hỗ trợ</h1>
${alertBox(success, 'success')}
<div class="cols">
  <section class="panel">
    <h2>Thông tin hỗ trợ</h2>
    <dl class="info">
      <dt>Đơn vị</dt><dd>${esc(ctx.companyName) || '—'}</dd>
      <dt>Người phụ trách</dt><dd>${esc(ctx.contactPerson) || '—'}</dd>
      <dt>Điện thoại</dt><dd>${ctx.contactPhone ? `<a href="tel:${esc(phoneHref)}">${esc(ctx.contactPhone)}</a>` : '<span class="muted">Chưa cập nhật</span>'}</dd>
      <dt>Email hỗ trợ</dt><dd>${ctx.contactEmail ? `<a href="mailto:${esc(ctx.contactEmail)}">${esc(ctx.contactEmail)}</a>` : '<span class="muted">Chưa cập nhật</span>'}</dd>
      <dt>Hệ thống</dt><dd>${esc(ctx.appName)}</dd>
      <dt>Phiên bản</dt><dd><span class="badge">${esc(version)}</span></dd>
    </dl>
    <p class="hint">Phiên bản ghi theo dạng V[lần cập nhật trong ngày].[ngày].[tháng].[năm].</p>
  </section>
  ${isAdmin ? `
  <section class="panel">
    <h2>Sửa thông tin liên hệ</h2>
    ${alertBox(errors)}
    <form method="post" action="/lien-he" class="form" novalidate>
      <label>Người phụ trách hỗ trợ
        <input name="contact_person" maxlength="100" value="${esc(v.contact_person)}" placeholder="VD: Phòng Hành chính"></label>
      <label>Số điện thoại hỗ trợ
        <input name="contact_phone" maxlength="20" inputmode="tel" value="${esc(v.contact_phone)}" placeholder="VD: 0901 234 567"></label>
      <label>Email hỗ trợ
        <input name="contact_email" type="email" maxlength="120" value="${esc(v.contact_email)}" placeholder="VD: hotro@congty.vn"></label>
      <button class="btn btn-primary" type="submit">Lưu thông tin</button>
    </form>
  </section>` : ''}
</div>`,
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

module.exports = { setupPage, loginPage, homePage, personalPage, contactPage, messagePage };
