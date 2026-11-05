'use strict';
/** Giao diện Quản lý tài khoản (chỉ Quản trị) */
const { esc, layout, alertBox, newPasswordFields, roleLabel, fmtDate, ROLE_LABEL } = require('./layout');

function roleOptions(selected) {
  return Object.entries(ROLE_LABEL)
    .map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('');
}

function statusBadge(u) {
  if (!u.is_active) return '<span class="badge badge-off">Đã khóa</span>';
  if (u.must_change_password) return '<span class="badge badge-warn">Chờ đổi mật khẩu</span>';
  return '<span class="badge badge-on">Hoạt động</span>';
}

function userListPage(ctx, { users, success, error }) {
  const me = ctx.user.id;
  const rows = users.map((u) => `
    <tr>
      <td data-label="Họ và tên"><span><b>${esc(u.full_name)}</b>${u.id === me ? ' <span class="you">(bạn)</span>' : ''}</span></td>
      <td data-label="Tên đăng nhập">${esc(u.username)}</td>
      <td data-label="Vai trò">${roleLabel(u.role)}</td>
      <td data-label="Trạng thái">${statusBadge(u)}</td>
      <td data-label="Đăng nhập gần nhất">${fmtDate(u.last_login_at)}</td>
      <td class="actions"><a class="btn btn-sm btn-outline" href="/tai-khoan/${u.id}">Sửa / Thao tác</a></td>
    </tr>`).join('');

  return layout(ctx, {
    title: 'Quản lý tài khoản',
    body: `
<div class="page-head">
  <h1 class="page-title">Quản lý tài khoản <span class="count">${users.length}</span></h1>
  <a class="btn btn-primary" href="/tai-khoan/moi">+ Tạo tài khoản</a>
</div>
${alertBox(success, 'success')}
${alertBox(error)}
<div class="panel panel-flush">
  <table class="table">
    <thead><tr><th>Họ và tên</th><th>Tên đăng nhập</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập gần nhất</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
<p class="hint">Quy tắc: hệ thống luôn còn ít nhất 1 Quản trị đang hoạt động; bạn không thể tự khóa, tự xóa hay tự hạ quyền của chính mình.</p>`,
  });
}

function userCreatePage(ctx, { errors, values = {} }) {
  const v = (k) => esc(values[k] || '');
  return layout(ctx, {
    title: 'Tạo tài khoản',
    body: `
<p class="crumb"><a href="/tai-khoan">← Danh sách tài khoản</a></p>
<h1 class="page-title">Tạo tài khoản mới</h1>
<section class="panel panel-narrow">
  ${alertBox(errors)}
  <form method="post" action="/tai-khoan/moi" class="form" data-pw-form novalidate>
    <label><span>Họ và tên <span class="req">*</span></span>
      <input name="full_name" required maxlength="100" value="${v('full_name')}"></label>
    <label><span>Tên đăng nhập <span class="req">*</span></span>
      <input name="username" required maxlength="40" value="${v('username')}" autocomplete="off"
             pattern="[a-zA-Z0-9._-]{3,40}" placeholder="3-40 ký tự: chữ không dấu, số, . _ -"></label>
    <label><span>Vai trò <span class="req">*</span></span>
      <select name="role">${roleOptions(values.role || 'user')}</select></label>
    ${newPasswordFields('Mật khẩu ban đầu')}
    <label class="check"><input type="checkbox" name="must_change" value="1" ${values.must_change === false ? '' : 'checked'}>
      Bắt buộc đổi mật khẩu ở lần đăng nhập đầu</label>
    <button class="btn btn-primary" type="submit">Tạo tài khoản</button>
  </form>
</section>`,
  });
}

function userEditPage(ctx, { target, errors, success, values }) {
  const isSelf = target.id === ctx.user.id;
  const v = values || target;
  return layout(ctx, {
    title: `Tài khoản ${target.username}`,
    body: `
<p class="crumb"><a href="/tai-khoan">← Danh sách tài khoản</a></p>
<div class="page-head">
  <h1 class="page-title">${esc(target.full_name)} <small class="muted">@${esc(target.username)}</small></h1>
  ${statusBadge(target)}
</div>
${alertBox(success, 'success')}
${alertBox(errors)}
${isSelf ? alertBox('Đây là tài khoản của bạn: không thể tự đổi vai trò, tự khóa hoặc tự xóa. Đổi mật khẩu của bạn ở tab Cá nhân.', 'info') : ''}
<div class="cols">
  <section class="panel">
    <h2>Thông tin</h2>
    <form method="post" action="/tai-khoan/${target.id}/sua" class="form" novalidate>
      <label>Tên đăng nhập <input value="${esc(target.username)}" disabled></label>
      <label><span>Họ và tên <span class="req">*</span></span>
        <input name="full_name" required maxlength="100" value="${esc(v.full_name)}"></label>
      <label><span>Vai trò <span class="req">*</span></span>
        <select name="role" ${isSelf ? 'disabled' : ''}>${roleOptions(v.role)}</select>
        ${isSelf ? '<small class="hint">Không thể tự đổi vai trò của mình.</small>' : ''}</label>
      <dl class="info small">
        <dt>Ngày tạo</dt><dd>${fmtDate(target.created_at)}</dd>
        <dt>Đăng nhập gần nhất</dt><dd>${fmtDate(target.last_login_at)}</dd>
      </dl>
      <button class="btn btn-primary" type="submit">Lưu thay đổi</button>
    </form>
  </section>

  ${isSelf ? '' : `
  <section class="panel">
    <h2>Đặt lại mật khẩu</h2>
    <form method="post" action="/tai-khoan/${target.id}/dat-lai-mat-khau" class="form" data-pw-form novalidate>
      ${newPasswordFields('Mật khẩu mới')}
      <label class="check"><input type="checkbox" name="must_change" value="1" checked>
        Bắt buộc người dùng đổi mật khẩu ở lần đăng nhập tới</label>
      <button class="btn btn-primary" type="submit">Đặt lại mật khẩu</button>
      <small class="hint">Người dùng sẽ bị đăng xuất khỏi mọi thiết bị.</small>
    </form>
  </section>

  <section class="panel panel-danger">
    <h2>Khóa / Xóa tài khoản</h2>
    <form method="post" action="/tai-khoan/${target.id}/${target.is_active ? 'khoa' : 'mo-khoa'}" class="inline-form"
      ${target.is_active ? `data-confirm="Khóa tài khoản ${esc(target.username)}? Người này sẽ bị đăng xuất và không đăng nhập được."` : ''}>
      <button class="btn ${target.is_active ? 'btn-warn' : 'btn-outline'}" type="submit">
        ${target.is_active ? '🔒 Khóa tài khoản' : '🔓 Mở khóa tài khoản'}</button>
    </form>
    <p class="hint">Khóa: giữ nguyên dữ liệu, chỉ chặn đăng nhập. Nên dùng thay cho Xóa.</p>
    <form method="post" action="/tai-khoan/${target.id}/xoa" class="inline-form"
      data-confirm="XÓA VĨNH VIỄN tài khoản ${esc(target.username)}? Thao tác này không hoàn tác được.">
      <button class="btn btn-danger" type="submit">🗑 Xóa tài khoản</button>
    </form>
  </section>`}
</div>`,
  });
}

module.exports = { userListPage, userCreatePage, userEditPage };
