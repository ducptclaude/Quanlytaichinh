// Xác thực 2 lớp (mã 6 số đổi mỗi 30 giây – dùng Google Authenticator / Microsoft Authenticator…)
// Chuẩn TOTP (RFC 6238, SHA-1, 6 số, 30 giây), không dùng thư viện ngoài.
// Khóa bí mật lưu trong CSDL; nếu đặt biến môi trường TOTP_KEY (chuỗi bất kỳ, dài) thì khóa được mã hóa AES-256-GCM trước khi lưu.
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(buf) {
  let bits = 0, val = 0, out = '';
  for (const b of buf) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  const s = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0, val = 0; const out = [];
  for (const c of s) {
    val = (val << 5) | B32.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

const newSecret = () => base32Encode(crypto.randomBytes(20));

function codeAt(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

// Chống dùng lại cùng 1 mã (bắt chước / nghe lén): nhớ bước thời gian đã dùng của từng tài khoản
const daDung = new Map(); // userId -> counter
function verify(secret, code, userId) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c) || !secret) return false;
  const now = Math.floor(Date.now() / 30000);
  for (const d of [0, -1, 1]) { // chấp nhận lệch đồng hồ ±30 giây
    const ctr = now + d;
    const ok = crypto.timingSafeEqual(Buffer.from(codeAt(secret, ctr)), Buffer.from(c));
    if (ok) {
      if (userId && (daDung.get(userId) || 0) >= ctr) return false;
      if (userId) daDung.set(userId, ctr);
      return true;
    }
  }
  return false;
}

// ---------- Mã hóa khóa bí mật khi lưu ----------
const KEY = (process.env.TOTP_KEY || '').trim() ? crypto.createHash('sha256').update(process.env.TOTP_KEY.trim()).digest() : null;
function seal(secret) {
  if (!KEY) return 'p:' + secret;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return 'g:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
}
function open(stored) {
  const s = String(stored || '');
  if (s.startsWith('p:')) return s.slice(2);
  if (s.startsWith('g:')) {
    if (!KEY) return null; // đã mã hóa nhưng thiếu TOTP_KEY -> không giải được
    const b = Buffer.from(s.slice(2), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  }
  return null;
}

const otpauthUrl = (secret, account, issuer) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

module.exports = { newSecret, verify, seal, open, otpauthUrl, codeAt, base32Decode };
