'use strict';
// V10.19.11.26: Tỷ giá USD / EUR – Vietcombank, giá BÁN (chuyển khoản), tự cập nhật.
// Lấy từ bảng tỷ giá XML công khai của Vietcombank; giữ trong bộ nhớ 1 giờ, lưu bản tốt gần nhất vào Cài đặt
// (khoá "ty_gia_vcb") để dùng khi mạng / trang Vietcombank lỗi. Chỉ dùng để HIỂN THỊ / XUẤT – số liệu vẫn lưu bằng VND.
const URL_VCB = process.env.VCB_URL || 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
const KEY = 'ty_gia_vcb';
const TTL = 60 * 60 * 1000;
let cache = null; // { t, v }

const so = (s) => { const n = Number(String(s ?? '').replace(/,/g, '').trim()); return Number.isFinite(n) && n > 0 ? n : null; };
// Đọc 1 thẻ <Exrate CurrencyCode="USD" ... Sell="26,340.00" /> (thứ tự thuộc tính bất kỳ)
function docXml(xml) {
  const out = {};
  for (const m of String(xml).matchAll(/<Exrate\b([^>]*)\/?>/gi)) {
    const at = {}; for (const a of m[1].matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) at[a[1].toLowerCase()] = a[2];
    const ma = String(at.currencycode || '').trim().toUpperCase();
    if (ma === 'USD' || ma === 'EUR') out[ma] = { ban: so(at.sell), mua_ck: so(at.transfer), mua_tm: so(at.buy) };
  }
  // <DateTime>11/19/2026 3:45:12 PM</DateTime> (giờ Việt Nam, kiểu Mỹ) -> "19/11/2026 15:45"
  let ngay = null;
  const d = String(xml).match(/<DateTime>\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?\s*<\/DateTime>/i);
  if (d) {
    let h = Number(d[4]); if (d[6]) { const pm = d[6].toUpperCase() === 'PM'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    ngay = `${d[2].padStart(2, '0')}/${d[1].padStart(2, '0')}/${d[3]} ${String(h).padStart(2, '0')}:${d[5]}`;
  }
  return { USD: out.USD?.ban || null, EUR: out.EUR?.ban || null, ngay };
}

async function layTyGia(store, { moi = false } = {}) {
  if (!moi && cache && Date.now() - cache.t < TTL) return cache.v;
  let v = null;
  try {
    const r = await fetch(URL_VCB, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/xml,text/xml,*/*' } });
    if (r.ok) {
      const x = docXml(await r.text());
      if (x.USD && x.EUR) {
        v = { USD: x.USD, EUR: x.EUR, ngay: x.ngay, nguon: 'Vietcombank – giá bán', lay_luc: new Date().toISOString() };
        try { await store.saveSettings({ [KEY]: JSON.stringify(v) }); } catch { /* không lưu được: vẫn dùng bản vừa lấy */ }
      }
    }
  } catch { /* mất mạng / Vietcombank lỗi -> dùng bản đã lưu */ }
  if (!v) {
    try { const s = (await store.getSettings())[KEY]; if (s) v = { ...JSON.parse(s), cu: true }; } catch { v = null; }
  }
  if (v) cache = { t: Date.now() - (v.cu ? TTL - 5 * 60 * 1000 : 0), v }; // bản cũ: thử lấy lại sau 5 phút
  return v;
}

module.exports = { layTyGia, docXml };
