'use strict';
/**
 * Quản lý tài khoản (chỉ Quản trị).
 * Quy tắc bảo vệ:
 *  - Luôn còn ít nhất 1 Quản trị đang hoạt động (kiểm tra trong kho dữ liệu, có khóa giao dịch)
 *  - Không ai tự khóa, tự xóa, tự hạ quyền chính mình
 */
const asyncRouter = require('../router');
const auth = require('../auth');
const { userListPage, userCreatePage, userEditPage } = require('../views/users');
const { ROLE_LABEL } = require('../views/layout');

const OK_MSG = {
  created: 'Đã tạo tài khoản.',
  updated: 'Đã lưu thay đổi.',
  locked: 'Đã khóa tài khoản và đăng xuất người dùng khỏi mọi thiết bị.',
  unlocked: 'Đã mở khóa tài khoản.',
  deleted: 'Đã xóa tài khoản.',
  reset: 'Đã đặt lại mật khẩu. Người dùng đã bị đăng xuất khỏi mọi thiết bị.',
};
const ERR_MSG = {
  last_admin: 'Không thực hiện được: hệ thống phải luôn còn ít nhất 1 Quản trị đang hoạt động.',
  self: 'Không thể tự khóa, tự xóa hoặc tự hạ quyền của chính mình.',
  not_found: 'Không tìm thấy tài khoản.',
  duplicate: 'Tên đăng nhập đã tồn tại.',
};

function validateProfile(body) {
  const v = {
    full_name: String(body.full_name || '').trim(),
    role: String(body.role || ''),
  };
  const errors = [];
  if (!v.full_name) errors.push('Chưa nhập Họ và tên');
  if (v.full_name.length > 100) errors.push('Họ và tên tối đa 100 ký tự');
  if (!ROLE_LABEL[v.role]) errors.push('Vai trò không hợp lệ');
  return { v, errors };
}

function validateNewPassword(body) {
  const password = String(body.password || '');
  const errors = auth.checkPasswordStrength(password).map((e) => `Mật khẩu: ${e}`);
  if (password !== String(body.password2 || '')) errors.push('Hai lần nhập mật khẩu không khớp');
  return { password, errors };
}

module.exports = function usersRouter({ store, ctxOf, requireAdmin }) {
  const r = asyncRouter();
  r.use(requireAdmin);

  const idOf = (req) => {
    const id = Number(req.params.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };
  const loadTarget = async (req, res) => {
    const id = idOf(req);
    const target = id ? await store.getUser(id) : null;
    if (!target) res.redirect('/tai-khoan?err=not_found');
    return target;
  };
  const fail = (res, id, code) =>
    res.redirect(id ? `/tai-khoan/${id}?err=${code}` : `/tai-khoan?err=${code}`);

  /* Danh sách */
  r.get('/', async (req, res) => {
    const users = await store.listUsers();
    res.send(userListPage(ctxOf(req), {
      users, success: OK_MSG[req.query.ok], error: ERR_MSG[req.query.err],
    }));
  });

  /* Tạo mới */
  r.get('/moi', (req, res) => res.send(userCreatePage(ctxOf(req), {})));

  r.post('/moi', async (req, res) => {
    const { v, errors } = validateProfile(req.body);
    v.username = String(req.body.username || '').trim().toLowerCase();
    v.must_change = req.body.must_change === '1';
    if (!/^[a-z0-9._-]{3,40}$/.test(v.username)) {
      errors.push('Tên đăng nhập 3-40 ký tự, chỉ gồm chữ không dấu, số, dấu . _ -');
    }
    const pw = validateNewPassword(req.body);
    errors.push(...pw.errors);
    if (errors.length) return res.status(400).send(userCreatePage(ctxOf(req), { errors, values: v }));

    try {
      await store.createUser({
        username: v.username, full_name: v.full_name, role: v.role,
        password_hash: await auth.hashPassword(pw.password), must_change_password: v.must_change,
      });
      console.log(`[users] ${req.user.username} tạo tài khoản ${v.username} (${v.role})`);
      res.redirect('/tai-khoan?ok=created');
    } catch (e) {
      if (e.code === 'duplicate') {
        return res.status(400).send(userCreatePage(ctxOf(req), { errors: [ERR_MSG.duplicate], values: v }));
      }
      throw e;
    }
  });

  /* Xem / sửa */
  r.get('/:id', async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    res.send(userEditPage(ctxOf(req), {
      target, success: OK_MSG[req.query.ok], errors: ERR_MSG[req.query.err],
    }));
  });

  r.post('/:id/sua', async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    const isSelf = target.id === req.user.id;
    if (isSelf) req.body.role = target.role; // ô vai trò bị khóa với chính mình
    const { v, errors } = validateProfile(req.body);
    if (isSelf && v.role !== target.role) errors.push(ERR_MSG.self);
    if (errors.length) {
      return res.status(400).send(userEditPage(ctxOf(req), { target, errors, values: { ...target, ...v } }));
    }
    try {
      await store.updateUser(target.id, { full_name: v.full_name, role: v.role });
      if (v.role !== target.role) {
        console.log(`[users] ${req.user.username} đổi vai trò ${target.username}: ${target.role} -> ${v.role}`);
      }
      res.redirect(`/tai-khoan/${target.id}?ok=updated`);
    } catch (e) {
      if (ERR_MSG[e.code]) return fail(res, target.id, e.code);
      throw e;
    }
  });

  /* Khóa / mở khóa */
  for (const [path, active, ok] of [['khoa', false, 'locked'], ['mo-khoa', true, 'unlocked']]) {
    r.post(`/:id/${path}`, async (req, res) => {
      const target = await loadTarget(req, res);
      if (!target) return;
      if (target.id === req.user.id) return fail(res, target.id, 'self');
      try {
        await store.updateUser(target.id, { is_active: active });
        console.log(`[users] ${req.user.username} ${active ? 'mở khóa' : 'khóa'} ${target.username}`);
        res.redirect(`/tai-khoan/${target.id}?ok=${ok}`);
      } catch (e) {
        if (ERR_MSG[e.code]) return fail(res, target.id, e.code);
        throw e;
      }
    });
  }

  /* Xóa */
  r.post('/:id/xoa', async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.id === req.user.id) return fail(res, target.id, 'self');
    try {
      await store.deleteUser(target.id);
      console.log(`[users] ${req.user.username} xóa tài khoản ${target.username}`);
      res.redirect('/tai-khoan?ok=deleted');
    } catch (e) {
      if (ERR_MSG[e.code]) return fail(res, target.id, e.code);
      throw e;
    }
  });

  /* Đặt lại mật khẩu */
  r.post('/:id/dat-lai-mat-khau', async (req, res) => {
    const target = await loadTarget(req, res);
    if (!target) return;
    if (target.id === req.user.id) return res.redirect('/ca-nhan');
    const pw = validateNewPassword(req.body);
    if (pw.errors.length) {
      return res.status(400).send(userEditPage(ctxOf(req), { target, errors: pw.errors }));
    }
    await store.setPassword(target.id, await auth.hashPassword(pw.password), {
      mustChange: req.body.must_change === '1',
    });
    auth.clearFailures(target.username); // gỡ tạm khóa đăng nhập (nếu có)
    console.log(`[users] ${req.user.username} đặt lại mật khẩu cho ${target.username}`);
    res.redirect(`/tai-khoan/${target.id}?ok=reset`);
  });

  return r;
};
