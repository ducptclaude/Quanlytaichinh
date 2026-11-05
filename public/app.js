'use strict';
(function () {
  // 1) Kiểm tra độ mạnh mật khẩu ngay khi gõ (máy chủ vẫn kiểm tra lại)
  var tests = {
    len: function (s) { return s.length >= 8; },
    upper: function (s) { return /[A-Z]/.test(s); },
    lower: function (s) { return /[a-z]/.test(s); },
    digit: function (s) { return /[0-9]/.test(s); },
    special: function (s) { return /[^A-Za-z0-9]/.test(s); },
  };
  document.querySelectorAll('[data-pw-form]').forEach(function (form) {
    var pw = form.querySelector('[data-pw-input]');
    var pw2 = form.querySelector('[data-pw-confirm]');
    if (!pw || !pw2) return;
    var rules = form.querySelectorAll('[data-pw-rules] li');
    var matchHint = form.querySelector('[data-pw-match]');
    function update() {
      var v = pw.value;
      rules.forEach(function (li) { li.classList.toggle('ok', tests[li.dataset.rule](v)); });
      if (!matchHint) return;
      if (pw2.value) {
        var same = pw2.value === v;
        matchHint.textContent = same ? '✓ Mật khẩu khớp' : '✗ Mật khẩu chưa khớp';
        matchHint.className = 'hint ' + (same ? 'ok' : 'bad');
      } else {
        matchHint.textContent = '';
      }
    }
    pw.addEventListener('input', update);
    pw2.addEventListener('input', update);
    form.addEventListener('submit', function (e) {
      var allOk = Object.keys(tests).every(function (k) { return tests[k](pw.value); });
      if (!allOk || pw.value !== pw2.value) {
        e.preventDefault();
        update();
        pw.focus();
      }
    });
  });

  // 2) Hỏi xác nhận trước thao tác quan trọng (khóa, xóa)
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!window.confirm(form.getAttribute('data-confirm'))) e.preventDefault();
    });
  });

  // 3) Ô số tiền: tự thêm dấu chấm phân cách hàng nghìn khi gõ
  function fmt(v) {
    var digits = String(v).replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  document.addEventListener('input', function (e) {
    var inp = e.target;
    if (!inp.matches || !inp.matches('input[data-money]')) return;
    var before = inp.value;
    var pos = inp.selectionStart;
    var digitsLeft = before.slice(0, pos).replace(/[^0-9]/g, '').length;
    var after = fmt(before);
    if (after === before) return;
    inp.value = after;
    var i = 0, seen = 0;
    while (i < after.length && seen < digitsLeft) { if (/[0-9]/.test(after[i])) seen++; i++; }
    try { inp.setSelectionRange(i, i); } catch (err) { /* bỏ qua */ }
  });

  // 5) Ô ngày dd/mm/yyyy, gõ tắt: "5" -> 05/tháng này/năm nay ; "5/3" -> 05/03/năm nay ; "050326" -> 05/03/2026
  function pad(n) { return String(n).padStart(2, '0'); }
  function normDate(v) {
    var s = String(v || '').trim();
    if (!s) return '';
    var now = new Date();
    var d, m, y, g;
    if ((g = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +g[1]; m = +g[2]; d = +g[3]; }
    else if ((g = s.match(/^(\d{1,2})(?:[\/.\-](\d{1,2})(?:[\/.\-](\d{2}|\d{4}))?)?$/))) {
      d = +g[1]; m = g[2] ? +g[2] : now.getMonth() + 1; y = g[3] ? +g[3] : now.getFullYear();
    } else if ((g = s.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/))) { d = +g[1]; m = +g[2]; y = +g[3]; }
    else return s;
    if (y < 100) y += 2000;
    var t = new Date(y, m - 1, d);
    if (t.getFullYear() !== y || t.getMonth() !== m - 1 || t.getDate() !== d) return s; // để máy chủ báo lỗi
    return pad(d) + '/' + pad(m) + '/' + y;
  }
  window.QL = { normDate: normDate };
  document.addEventListener('focusout', function (e) {
    var inp = e.target;
    if (inp.matches && inp.matches('input[data-date]')) inp.value = normDate(inp.value);
  });

  // 6) Ô tự tính tổng (VD: Tổng sau VAT = Chưa VAT + VAT)
  function num(v) { var d = String(v || '').replace(/[^0-9]/g, ''); return d ? Number(d) : 0; }
  function recalc(form) {
    form.querySelectorAll('output[data-sum]').forEach(function (out) {
      var names = out.getAttribute('data-sum').split(',');
      var first = form.querySelector('[name="' + names[0] + '"]');
      if (!first || !String(first.value).trim()) { out.textContent = '—'; return; }
      var total = names.reduce(function (s, n) { var i = form.querySelector('[name="' + n + '"]'); return s + (i ? num(i.value) : 0); }, 0);
      out.textContent = total.toLocaleString('vi-VN');
    });
  }
  document.addEventListener('input', function (e) {
    if (e.target.form && e.target.form.querySelector('output[data-sum]')) recalc(e.target.form);
  });

  // 7) Chọn khoản mục có lưu ý (VD: Lãi vay chỉ nhập phần lãi) -> hiện nhắc nhở
  document.addEventListener('change', function (e) {
    var sel = e.target;
    if (!sel.matches || !sel.matches('select[data-warn-select]')) return;
    var box = sel.parentNode.querySelector('.select-warn');
    var opt = sel.options[sel.selectedIndex];
    var w = opt && opt.getAttribute('data-warn');
    if (box) { box.hidden = !w; box.textContent = w ? '⚠ ' + w : ''; }
  });

  // 4) Ô lọc dạng chọn: đổi là lọc ngay
  document.querySelectorAll('select[data-autosubmit]').forEach(function (sel) {
    sel.addEventListener('change', function () { if (sel.form) sel.form.submit(); });
  });
})();
