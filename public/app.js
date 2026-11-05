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
})();
