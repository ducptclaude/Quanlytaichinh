'use strict';
/**
 * Mật khẩu (mã hóa scrypt có sẵn trong Node) + chặn tạm khi đăng nhập sai nhiều lần.
 */
const crypto = require('crypto');

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`);
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const parts = String(stored || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return resolve(false);
    const [, N, r, p, saltB64, keyB64] = parts;
    const expected = Buffer.from(keyB64, 'base64');
    crypto.scrypt(password, Buffer.from(saltB64, 'base64'), expected.length,
      { N: +N, r: +r, p: +p }, (err, key) => {
        if (err) return resolve(false);
        resolve(key.length === expected.length && crypto.timingSafeEqual(key, expected));
      });
  });
}

/** Trả về danh sách lỗi (rỗng = đạt) */
function checkPasswordStrength(pw) {
  const errors = [];
  pw = String(pw || '');
  if (pw.length < 8) errors.push('Tối thiểu 8 ký tự');
  if (pw.length > 128) errors.push('Tối đa 128 ký tự');
  if (!/[A-Z]/.test(pw)) errors.push('Có ít nhất 1 chữ hoa (A-Z)');
  if (!/[a-z]/.test(pw)) errors.push('Có ít nhất 1 chữ thường (a-z)');
  if (!/[0-9]/.test(pw)) errors.push('Có ít nhất 1 chữ số (0-9)');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('Có ít nhất 1 ký tự đặc biệt (!@#$...)');
  return errors;
}

/* ---------- Chặn tạm khi sai nhiều lần ----------
 * Theo dõi riêng theo tên đăng nhập và theo địa chỉ máy (IP).
 * - Tên đăng nhập: sai 5 lần trong 15 phút -> khóa 15 phút
 * - Địa chỉ máy : sai 20 lần trong 15 phút -> khóa 15 phút (chống dò nhiều tài khoản)
 */
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const LIMITS = { user: 5, ip: 20 };
const attempts = new Map(); // key -> { count, first, lockedUntil }

function _get(key) {
  const now = Date.now();
  let a = attempts.get(key);
  if (a && a.lockedUntil && a.lockedUntil <= now) { attempts.delete(key); a = null; }
  if (a && !a.lockedUntil && now - a.first > WINDOW_MS) { attempts.delete(key); a = null; }
  return a;
}

/** Số giây còn bị khóa (0 = không khóa) */
function lockRemaining(username, ip) {
  const now = Date.now();
  let max = 0;
  for (const key of [`u:${username}`, `i:${ip}`]) {
    const a = _get(key);
    if (a && a.lockedUntil) max = Math.max(max, Math.ceil((a.lockedUntil - now) / 1000));
  }
  return max;
}

/** Ghi nhận 1 lần sai; trả về số lần còn lại cho tên đăng nhập */
function recordFailure(username, ip) {
  const now = Date.now();
  let left = LIMITS.user;
  for (const [key, limit] of [[`u:${username}`, LIMITS.user], [`i:${ip}`, LIMITS.ip]]) {
    let a = _get(key);
    if (!a) { a = { count: 0, first: now, lockedUntil: 0 }; attempts.set(key, a); }
    a.count += 1;
    if (a.count >= limit) a.lockedUntil = now + LOCK_MS;
    if (key.startsWith('u:')) left = Math.max(0, limit - a.count);
  }
  // giới hạn bộ nhớ
  if (attempts.size > 10000) {
    for (const k of attempts.keys()) { _get(k); if (attempts.size <= 8000) break; }
  }
  return left;
}

function clearFailures(username) {
  attempts.delete(`u:${username}`);
}

module.exports = {
  hashPassword, verifyPassword, checkPasswordStrength,
  lockRemaining, recordFailure, clearFailures,
  LIMITS, LOCK_MS,
};
