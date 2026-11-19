'use strict';
/* Giao diện Sáng / Tối.
   - Lần đầu: theo cài đặt của máy (Windows / điện thoại đang để tối thì hiện tối).
   - Bấm nút ☀️/🌙: đổi và ghi nhớ trên máy này (localStorage "bks-theme").
   - In / PDF luôn dùng giao diện sáng. Nạp trong <head> để không bị nháy màu khi mở trang. */
(function () {
  var KEY = 'bks-theme';
  var SVG = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  var MOON = SVG + '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  var SUN = SVG + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function current() { var s = saved(); return s === 'dark' || s === 'light' ? s : (mq && mq.matches ? 'dark' : 'light'); }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].innerHTML = t === 'dark' ? SUN : MOON; // V08.19.11.26: biểu tượng nét mảnh thay emoji
      btns[i].title = t === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
      btns[i].setAttribute('aria-label', btns[i].title);
    }
  }
  apply(current());
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (!saved()) apply(current()); });
  // In / PDF: tạm về sáng, in xong trả lại
  var before = null;
  window.addEventListener('beforeprint', function () { before = root.getAttribute('data-theme'); root.setAttribute('data-theme', 'light'); });
  window.addEventListener('afterprint', function () { if (before) apply(before); before = null; });
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('[data-theme-toggle]')) { // trang Đăng nhập / Khởi tạo: nút nổi góc phải
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'theme-btn floating'; b.setAttribute('data-theme-toggle', '');
      document.body.appendChild(b);
    }
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (!b) return;
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (err) { /* chế độ riêng tư: vẫn đổi, không nhớ */ }
      apply(next);
    });
    apply(current());
  });
})();
