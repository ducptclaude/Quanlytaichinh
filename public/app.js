'use strict';
// Kiểm tra độ mạnh mật khẩu ngay khi gõ (máy chủ vẫn kiểm tra lại)
(function () {
  var form = document.querySelector('[data-pw-form]');
  if (!form) return;
  var pw = form.querySelector('[data-pw-input]');
  var pw2 = form.querySelector('[data-pw-confirm]');
  var rules = form.querySelectorAll('[data-pw-rules] li');
  var matchHint = form.querySelector('[data-pw-match]');
  var tests = {
    len: function (s) { return s.length >= 8; },
    upper: function (s) { return /[A-Z]/.test(s); },
    lower: function (s) { return /[a-z]/.test(s); },
    digit: function (s) { return /[0-9]/.test(s); },
    special: function (s) { return /[^A-Za-z0-9]/.test(s); },
  };
  function update() {
    var v = pw.value;
    rules.forEach(function (li) {
      li.classList.toggle('ok', tests[li.dataset.rule](v));
    });
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
})();
