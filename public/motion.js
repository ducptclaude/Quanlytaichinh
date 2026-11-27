// =====================================================================
// HIỆU ỨNG TRANG BÁO CÁO (chỉ là cách hiện số, không đổi số liệu)
// Mức 1 – chuyển động: số chạy đếm, cột mọc, thanh chạy, vòng vẽ dần, khối trượt vào khi cuộn tới;
//         vẽ lại do thao tác (đổi TĐ…) thì số chuyển mượt từ giá trị cũ sang giá trị mới, không chạy lại hiệu ứng xuất hiện
// Mức 2 – chiều sâu 3D: thẻ nghiêng theo con trỏ chuột (chỉ máy có chuột), thẻ TĐ đang chọn nổi lên
// Tự tắt khi máy bật "giảm chuyển động"; khi in hiện ngay số cuối
// =====================================================================
const MO_SO = ['.b-cash-i b', '.jr-ln', '.cf-tv', '.cf-dv', '.f-card.kx .f-val', '.map-hot .v'];
const MO_KHOI = ['.jr', '.cf-t', '.cf-c', '.dc', '.f-card.kx', '.map-w', '.th-tdp', '.cf-tb', '.pc-gal'];
const MO_TILT = '.cf-t, .jr-nd, .f-card.kx, .map-hot';
const moTat = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const moCu = new Map(); // khóa ô số -> giá trị lần vẽ trước (để chuyển mượt)
let moIO = null;
const moRun = new Set(); // các ô đang chạy đếm (để kết thúc ngay khi in)

// Tìm số đầu tiên trong ô (dạng 1.895,77 · −146,19 · 30,2)
const MO_RE = /([−-]?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?/;


// ---- Mức 2: thẻ nghiêng theo con trỏ (chỉ thiết bị có chuột) ----
if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
  let cur = null;
  document.addEventListener('pointermove', (e) => {
    if (moTat()) return;
    const el = e.target.closest?.(MO_TILT);
    if (cur && cur !== el) { cur.style.transform = ''; cur.classList.remove('mo-tilt'); cur = null; }
    if (!el || !el.closest('#b-report')) return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    cur = el; el.classList.add('mo-tilt');
    el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) translateZ(6px)`;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (cur) { cur.style.transform = ''; cur.classList.remove('mo-tilt'); cur = null; } });
}
// In / xuất PDF: kết thúc mọi số đang chạy, hiện ngay số cuối
window.addEventListener('beforeprint', () => { [...moRun].forEach((j) => j.end()); document.querySelectorAll('#b-report .mo-rv').forEach((el) => el.classList.add('mo-in')); });
