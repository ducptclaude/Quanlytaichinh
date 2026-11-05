'use strict';
/** Xử lý chữ, số tiền, ngày tháng dùng chung */

/** Bỏ dấu tiếng Việt + chữ thường: "Đường Láng" -> "duong lang" */
function normalize(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Tìm kiếm: mọi từ khóa (không dấu) đều phải có trong nội dung */
function matches(haystack, query) {
  const q = normalize(query);
  if (!q) return true;
  const h = normalize(haystack);
  return q.split(' ').every((w) => h.includes(w));
}

/** So sánh tự nhiên: MA-2 đứng trước MA-10 */
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
const naturalCompare = (a, b) => collator.compare(String(a ?? ''), String(b ?? ''));

/* ---------- Số tiền (đồng, số nguyên) ---------- */
const MONEY_MAX = 1e15; // 1 triệu tỷ đồng

/** "1.250.000" | "1,250,000" | "1250000" -> 1250000 ; rỗng -> null ; sai -> NaN */
function parseMoney(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  if (!/^-?[0-9][0-9., ]*$/.test(s)) return NaN;
  const n = Number(s.replace(/[., ]/g, ''));
  return Number.isSafeInteger(n) ? n : NaN;
}
const fmtMoney = (n) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('vi-VN'));

/* ---------- Ngày (lưu dạng YYYY-MM-DD) ---------- */
function parseDate(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const v = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (v) m = [null, v[3], v[2].padStart(2, '0'), v[1].padStart(2, '0')];
  }
  if (!m) return NaN;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return NaN;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
function fmtDay(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
function todayVN() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

module.exports = {
  todayVN, normalize, matches, naturalCompare, parseMoney, fmtMoney, MONEY_MAX, parseDate, fmtDay };
