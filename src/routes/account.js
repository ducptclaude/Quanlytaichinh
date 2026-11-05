'use strict';
/** Tab Cá nhân (đổi mật khẩu) và tab Liên hệ (Quản trị sửa thông tin hỗ trợ) */
const asyncRouter = require('../router');
const auth = require('../auth');
const { personalPage, contactPage } = require('../views/pages');

module.exports = function accountRouter({ store, ctxOf, requireLogin, reloadSettings, sessionToken, clientIp }) {
  const r = asyncRouter();

  /* ---------- Cá nhân ---------- */
  r.get('/ca-nhan', requireLogin, async (req, res) => {
    const me = await store.getUser(req.user.id);
    res.send(personalPage(ctxOf(req), {
      me,
      forced: me.must_change_password,
      success: req.query.ok === 'pw' ? 'Đã đổi mật khẩu thành công.' : '',
    }));
  });

  r.post('/ca-nhan/doi-mat-khau', requireLogin, async (req, res) => {
    const me = await store.getUser(req.user.id);
    const show = (errors, status = 400) => res.status(status).send(personalPage(ctxOf(req), {
      me, errors, forced: me.must_change_password,
    }));

    const locked = auth.lockRemaining(me.username, clientIp(req));
    if (locked > 0) {
      return show([`Nhập sai quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(locked / 60)} phút.`], 429);
    }

    const current = String(req.body.current_password || '').slice(0, 200);
    const password = String(req.body.password || '');
    if (!(await auth.verifyPassword(current, me.password_hash))) {
      const left = auth.recordFailure(me.username, clientIp(req));
      return show([left > 0
        ? `Mật khẩu hiện tại không đúng. Còn ${left} lần thử.`
        : 'Nhập sai quá nhiều lần. Tạm khóa 15 phút.']);
    }
    auth.clearFailures(me.username);

    const errors = auth.checkPasswordStrength(password).map((e) => `Mật khẩu mới: ${e}`);
    if (password !== String(req.body.password2 || '')) errors.push('Hai lần nhập mật khẩu mới không khớp');
    if (!errors.length && password === current) errors.push('Mật khẩu mới phải khác mật khẩu hiện tại');
    if (errors.length) return show(errors);

    await store.setPassword(me.id, await auth.hashPassword(password), {
      mustChange: false, keepToken: sessionToken(req),
    });
    console.log(`[account] ${me.username} đổi mật khẩu`);
    res.redirect('/ca-nhan?ok=pw');
  });

  /* ---------- Liên hệ ---------- */
  r.get('/lien-he', requireLogin, (req, res) => {
    res.send(contactPage(ctxOf(req), { success: req.query.ok ? 'Đã lưu thông tin liên hệ.' : '' }));
  });

  r.post('/lien-he', requireLogin, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).redirect('/lien-he');
    const v = {
      contact_person: String(req.body.contact_person || '').trim(),
      contact_phone: String(req.body.contact_phone || '').trim(),
      contact_email: String(req.body.contact_email || '').trim().toLowerCase(),
    };
    const errors = [];
    if (v.contact_person.length > 100) errors.push('Người phụ trách tối đa 100 ký tự');
    if (v.contact_phone && !/^[0-9+][0-9 .()-]{7,19}$/.test(v.contact_phone)) {
      errors.push('Số điện thoại không hợp lệ (8-20 ký tự, chỉ gồm số, khoảng trắng, + . ( ) -)');
    }
    if (v.contact_email && (v.contact_email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.contact_email))) {
      errors.push('Email không hợp lệ');
    }
    if (errors.length) return res.status(400).send(contactPage(ctxOf(req), { errors, values: v }));

    await store.setSettings(v);
    await reloadSettings();
    console.log(`[contact] ${req.user.username} cập nhật thông tin liên hệ`);
    res.redirect('/lien-he?ok=1');
  });

  return r;
};
