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

/* ---------- Số lượng (tối đa 3 chữ số lẻ) ----------
 * Kiểu Việt Nam: dấu chấm phân cách hàng nghìn, dấu PHẨY là số lẻ.  "1.250,5" = 1250,5
 * Để tránh hiểu nhầm, "12.5" (nhóm sau dấu chấm không đủ 3 số) bị từ chối.
 * Trả về số nguyên "phần nghìn" (milli): 12,5 -> 12500 ; rỗng -> null ; sai -> NaN
 */
const QTY_MAX_MILLI = 1e12; // 1 tỷ đơn vị
function parseQty(input) {
  let s = String(input ?? '').trim().replace(/\s+/g, '');
  if (!s) return null;
  if (!/^[0-9][0-9.,]*$/.test(s)) return NaN;
  const parts = s.split(',');
  if (parts.length > 2) return NaN;
  const [intPart, frac = ''] = parts;
  if (intPart.includes('.') && !/^\d{1,3}(\.\d{3})+$/.test(intPart)) return NaN;
  if (frac.length > 3 || !/^\d*$/.test(frac)) return NaN;
  s = intPart.replace(/\./g, '');
  const milli = Number(s) * 1000 + Number((frac + '000').slice(0, 3));
  return Number.isSafeInteger(milli) ? milli : NaN;
}
/** 12500 -> "12,5" ; 1250000 -> "1.250" */
function fmtQty(milli) {
  if (milli === null || milli === undefined || milli === '') return '';
  const m = Math.round(Number(milli));
  const int = Math.trunc(m / 1000);
  const frac = String(Math.abs(m % 1000)).padStart(3, '0').replace(/0+$/, '');
  return int.toLocaleString('vi-VN') + (frac ? `,${frac}` : '');
}
/** Số lượng lưu trong kho dữ liệu dạng "12.500" (NUMERIC) -> milli */
const qtyToMilli = (v) => (v === null || v === undefined || v === '' ? null : Math.round(Number(v) * 1000));
/** milli -> chuỗi lưu kho "12.5" */
const milliToDb = (m) => (m === null ? null : (m / 1000).toFixed(3));

/** Thành tiền = Số lượng × Đơn giá, làm tròn đến đồng (từ 0,5 làm tròn lên). Tính bằng số nguyên lớn, không sai số. */
function calcAmount(qtyMilli, unitPrice) {
  if (qtyMilli === null || unitPrice === null || Number.isNaN(qtyMilli) || Number.isNaN(unitPrice)) return null;
  const v = (BigInt(qtyMilli) * BigInt(unitPrice) + 500n) / 1000n;
  return Number(v);
}

/** Hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
function todayVN() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

module.exports = {
  parseQty, fmtQty, qtyToMilli, milliToDb, calcAmount, todayVN, QTY_MAX_MILLI, normalize, matches, naturalCompare, parseMoney, fmtMoney, MONEY_MAX, parseDate, fmtDay };
