'use strict';
/* Chuyển ngôn ngữ: Việt Nam / English.
   - Lựa chọn ghi nhớ trên máy (localStorage "bks-lang"), mặc định Việt Nam.
   - English: tải từ điển /i18n-en.js rồi dịch chữ trên trang (kể cả phần hiện ra sau, hộp thông báo).
   - Chỉ đổi chữ hiển thị; dữ liệu người dùng nhập (tên dự án, đối tác...) và ô nhập liệu giữ nguyên.
   - Về Việt Nam: tải lại trang. In / PDF in đúng ngôn ngữ đang xem. */
(function () {
  var KEY = 'bks-lang';
  var VN = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ]/;
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-confirm'];
  function lang() { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'vi'; } catch (e) { return 'vi'; } }
  var L = lang();
  document.documentElement.setAttribute('lang', L);

  var dict = null, pats = null;
  function load(cb) {
    if (window.BKS_EN) return cb();
    var s = document.createElement('script'); s.src = '/i18n-en.js'; s.onload = cb; document.head.appendChild(s);
  }
  var low = null;
  function prep() {
    dict = window.BKS_EN.exact;
    low = {}; Object.keys(dict).forEach(function (k) { var l = k.toLowerCase(); if (!(l in low)) low[l] = dict[k]; });
    pats = window.BKS_EN.patterns.map(function (p) {
      var parts = p[0].split('{}').map(function (x) { return x.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'); });
      // lits: các phần chữ cố định (đã gộp khoảng trắng) để lọc nhanh trước khi so mẫu
      var lits = p[0].split('{}').map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      return { re: new RegExp('^' + parts.join('(.+?)') + '$'), en: p[1], lits: lits, short: lits.join('').length < 16 };
    });
  }
  // Dịch 1 chuỗi: khớp nguyên câu → khớp mẫu có số liệu → giữ nguyên
  // Đơn vị trong phần số liệu: "+77,58 tỷ (+4,3%)" -> "+77,58 bn (+4,3%)"
  function units(g) {
    return g.replace(/(\d)\s*tỷ đồng/g, '$1 bn VND').replace(/(\d)\s*triệu đồng/g, '$1 mn VND').replace(/(\d)\s*điểm %/g, '$1 pp')
      .replace(/(\d)\s*tỷ(?![A-Za-zÀ-ỹ])/g, '$1 bn').replace(/(\d)\s*triệu(?![A-Za-zÀ-ỹ])/g, '$1 mn').replace(/(\d)\s*nghìn(?![A-Za-zÀ-ỹ])/g, '$1 k').replace(/(\d)\s*đồng(?![A-Za-zÀ-ỹ])/g, '$1 VND').replace(/(\d)\s*đ(?![A-Za-zÀ-ỹ])/g, '$1 VND');
  }
  var done = new Set(); // câu đã là kết quả dịch (còn tên riêng tiếng Việt) -> không dịch lại, tránh lặp vô hạn
  function tr(s) {
    if (!s || done.has(s)) return s;
    if (!VN.test(s) && s.indexOf('Doanh thu') < 0) { // chữ Việt không dấu (VD "Doanh thu"): chỉ tra nguyên câu
      var k0 = s.trim().replace(/\s+/g, ' '), e0 = dict[k0] != null ? dict[k0] : low[k0.toLowerCase()];
      if (e0 == null || !k0) return s;
      var r0 = s.match(/^\s*/)[0] + (k0 === k0.toUpperCase() && /[a-z]/i.test(k0) ? e0.toUpperCase() : e0) + s.match(/\s*$/)[0];
      done.add(r0); return r0;
    }
    var r = tr1(s);
    if (r !== s) done.add(r); // kết quả đã dịch -> không dịch lại (tránh lặp)
    return r;
  }
  function tr1(s) {
    var lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    var k = s.trim().replace(/\s+/g, ' ');
    if (dict[k] != null) return lead + dict[k] + tail;
    var lk = low[k.toLowerCase()]; // khác kiểu hoa / thường: "DOANH THU", "doanh thu", "Sau VAT"
    if (lk != null) {
      var en = k === k.toUpperCase() ? lk.toUpperCase() : (k[0] === k[0].toLowerCase() ? lk[0].toLowerCase() + lk.slice(1) : lk[0].toUpperCase() + lk.slice(1));
      return lead + en + tail;
    }
    if (k.length > 600) return s;
    for (var i = 0; i < pats.length; i++) {
      var P = pats[i], pos = 0, ok = true;
      for (var q = 0; q < P.lits.length; q++) { pos = k.indexOf(P.lits[q], pos); if (pos < 0) { ok = false; break; } pos += P.lits[q].length; }
      if (!ok) continue;
      var m = P.re.exec(k);
      // Mẫu ngắn (VD "{} đồng") chỉ áp dụng khi phần thay vào là số liệu / chữ dịch được -> tránh dịch ghép dở "Ký hợp VND"
      if (m) for (var g = 1; g < m.length; g++) m[g] = units(m[g]);
      if (m && P.short) for (g = 1; g < m.length; g++) if (VN.test(m[g]) && dict[m[g].trim()] == null) { m = null; break; }
      if (m) {
        var j = 1, out = P.en.replace(/\{\}/g, function () { var g = m[j++]; return dict[g.trim()] != null ? dict[g.trim()] : g; });
        return lead + out + tail;
      }
    }
    return s;
  }
  window.BKS_T = function (s) { return L === 'en' && dict ? tr(s) : s; };

  function skip(el) { return !el || el.closest('script,style,textarea,[data-no-i18n]'); }
  function walk(root) {
    if (root.nodeType === 3) { if (!skip(root.parentElement)) { var t = tr(root.nodeValue); if (t !== root.nodeValue) root.nodeValue = t; } return; }
    if (root.nodeType !== 1 || skip(root)) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (x) { if (!skip(x.parentElement)) { var t = tr(x.nodeValue); if (t !== x.nodeValue) x.nodeValue = t; } });
    var els = [root].concat([].slice.call(root.querySelectorAll('[' + ATTRS.join('],[') + '],input[type=button],input[type=submit]')));
    els.forEach(function (el) {
      if (skip(el)) return;
      ATTRS.forEach(function (a) { var v = el.getAttribute(a); if (v) { var t = tr(v); if (t !== v) el.setAttribute(a, t); } });
      if ((el.type === 'button' || el.type === 'submit') && el.value && VN.test(el.value)) el.value = tr(el.value);
    });
  }
  function fixTitle() { var t = tr(document.title); if (t !== document.title) document.title = t; } // chỉ gán khi đổi (tránh lặp)
  function start() {
    prep();
    walk(document.body);
    fixTitle();
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') walk(m.target);
        else m.addedNodes.forEach(walk);
      });
      fixTitle();
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // Hộp thông báo / xác nhận của trình duyệt
    ['alert', 'confirm', 'prompt'].forEach(function (f) {
      var o = window[f]; window[f] = function (msg, def) { return o.call(window, tr(String(msg == null ? '' : msg)), def); };
    });
  }

  // Ô chọn ngôn ngữ: thanh đầu trang (nếu có chỗ [data-lang-slot]) hoặc nổi ở góc (trang Đăng nhập / Khởi tạo)
  function picker() {
    var sel = document.createElement('select');
    sel.className = 'lang-pick'; sel.setAttribute('data-no-i18n', ''); sel.title = L === 'en' ? 'Language' : 'Ngôn ngữ';
    sel.innerHTML = '<option value="vi">🇻🇳 Việt Nam</option><option value="en">🇬🇧 English</option>';
    sel.value = L;
    sel.addEventListener('change', function () {
      try { localStorage.setItem(KEY, sel.value); } catch (e) { /* chế độ riêng tư */ }
      location.reload();
    });
    var slot = document.querySelector('[data-lang-slot]');
    if (slot) slot.appendChild(sel); else { sel.classList.add('floating'); document.body.appendChild(sel); }
  }

  document.addEventListener('DOMContentLoaded', function () {
    picker();
    if (L === 'en') load(start);
  });
})();
