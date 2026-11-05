'use strict';
/* Bảng nhập trực tiếp – Nhập hằng ngày
 * - Gõ trực tiếp, Enter (hoặc rời khỏi dòng) để lưu dòng
 * - Thành tiền tự tính = Số lượng × Đơn giá (máy chủ tính lại khi lưu)
 * - Chọn Nội dung đã từng nhập -> tự điền ĐVT, Đơn giá gần nhất (nếu đang trống)
 */
(function () {
  var table = document.getElementById('grid');
  if (!table) return;
  var data = JSON.parse(document.getElementById('grid-data').textContent);
  var tbody = table.tBodies[0];
  var projectId = Number(table.dataset.project);
  var canDelete = table.dataset.canDelete === '1';
  var today = table.dataset.today;
  var COLS = data.cols; // [tên, nhãn, loại]
  var sugg = {};
  data.suggestions.forEach(function (s) { sugg[s.c.toLowerCase()] = s; });

  /* ---------- Số ---------- */
  function parseMoney(s) {
    s = String(s || '').trim();
    if (!s) return null;
    if (!/^[0-9][0-9., ]*$/.test(s)) return NaN;
    return Number(s.replace(/[., ]/g, ''));
  }
  function parseQty(s) { // trả về phần nghìn
    s = String(s || '').replace(/\s+/g, '');
    if (!s) return null;
    if (!/^[0-9][0-9.,]*$/.test(s)) return NaN;
    var parts = s.split(',');
    if (parts.length > 2) return NaN;
    var ip = parts[0]; var fr = parts[1] || '';
    if (ip.indexOf('.') >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(ip)) return NaN;
    if (fr.length > 3) return NaN;
    return Number(ip.replace(/\./g, '')) * 1000 + Number((fr + '000').slice(0, 3));
  }
  function fmtMoney(n) { return n === null || n === undefined || n === '' || isNaN(n) ? '' : Number(n).toLocaleString('vi-VN'); }
  function fmtQty(m) {
    if (m === null || isNaN(m)) return '';
    var i = Math.trunc(m / 1000); var f = String(m % 1000).padStart(3, '0').replace(/0+$/, '');
    return i.toLocaleString('vi-VN') + (f ? ',' + f : '');
  }
  function calc(q, p) {
    if (q === null || p === null || isNaN(q) || isNaN(p)) return null;
    return Number((BigInt(q) * BigInt(p) + 500n) / 1000n);
  }

  /* ---------- Vẽ dòng ---------- */
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function makeRow(row) {
    var tr = el('tr', { class: 'g-row' + (row.id ? '' : ' g-new') });
    tr._row = row;
    tr.appendChild(el('td', { class: 'c-stt', 'data-label': '#' }));
    COLS.forEach(function (c) {
      var name = c[0]; var label = c[1]; var type = c[2];
      var td = el('td', { class: 'c-' + name + (['qty', 'money', 'calc'].indexOf(type) >= 0 ? ' num' : ''), 'data-label': label });
      if (type === 'calc') {
        td.appendChild(el('span', { 'data-amount': '' }, row.id ? fmtMoney(row.amount) : ''));
      } else {
        var inp = el('input', { name: name, autocomplete: 'off', 'aria-label': label });
        if (type === 'date') { inp.setAttribute('placeholder', 'dd/mm/yyyy'); inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('data-date', ''); }
        if (type === 'qty') { inp.setAttribute('inputmode', 'decimal'); inp.setAttribute('placeholder', '0'); }
        if (type === 'money') { inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('data-money', ''); inp.setAttribute('placeholder', '0'); }
        if (name === 'content') { inp.setAttribute('list', 'dl-content'); inp.setAttribute('placeholder', row.id ? '' : 'Gõ nội dung mới…'); }
        if (name === 'unit') inp.setAttribute('list', 'dl-unit');
        inp.value = row[name] || '';
        td.appendChild(inp);
      }
      tr.appendChild(td);
    });
    tr.appendChild(el('td', { class: 'c-meta', 'data-label': 'Cập nhật' }));
    var act = el('td', { class: 'c-act' });
    act.appendChild(el('span', { class: 'g-state', 'aria-live': 'polite' }));
    if (canDelete) {
      var del = el('button', { type: 'button', class: 'g-del', title: 'Xóa dòng', 'aria-label': 'Xóa dòng' }, '✕');
      act.appendChild(del);
    }
    tr.appendChild(act);
    paintMeta(tr);
    return tr;
  }

  function paintMeta(tr) {
    var r = tr._row;
    var meta = tr.querySelector('.c-meta');
    meta.innerHTML = '';
    if (r.id) {
      meta.appendChild(el('span', {}, r.updated_by_name));
      meta.appendChild(el('small', {}, r.updated_at));
    } else {
      meta.appendChild(el('small', { class: 'muted' }, 'Dòng mới'));
    }
    var del = tr.querySelector('.g-del');
    if (del) del.hidden = !r.id;
  }

  function renumber() {
    var n = 0; var total = 0;
    Array.prototype.forEach.call(tbody.querySelectorAll('tr.g-row'), function (tr) {
      if (tr._row.id) { n++; total += Number(tr._row.amount) || 0; tr.querySelector('.c-stt').textContent = n; }
      else tr.querySelector('.c-stt').textContent = '+';
    });
    table.querySelector('[data-total-count]').textContent = n.toLocaleString('vi-VN');
    table.querySelector('[data-total-amount]').textContent = fmtMoney(total);
  }

  function addBlankRow() {
    var rows = tbody.querySelectorAll('tr.g-row');
    var last = rows.length ? rows[rows.length - 1]._row : null;
    var tr = makeRow({ entry_date: (last && last.entry_date) || today });
    tbody.appendChild(tr);
    renumber();
    return tr;
  }

  function values(tr) {
    var v = { project_id: projectId };
    Array.prototype.forEach.call(tr.querySelectorAll('input[name]'), function (i) { v[i.name] = i.value; });
    if (tr._row.id) { v.id = tr._row.id; v.version = tr._row.version; }
    return v;
  }

  function isBlank(tr) {
    if (tr._row.id) return false;
    return Array.prototype.every.call(tr.querySelectorAll('input[name]'), function (i) {
      return i.name === 'entry_date' || !i.value.trim();
    });
  }

  function preview(tr) {
    var q = parseQty(tr.querySelector('[name=quantity]').value);
    var p = parseMoney(tr.querySelector('[name=unit_price]').value);
    var a = calc(q, p);
    tr.querySelector('[data-amount]').textContent = a === null ? '' : fmtMoney(a);
  }

  /* ---------- Thông báo lỗi trên dòng ---------- */
  function clearErrors(tr) {
    Array.prototype.forEach.call(tr.querySelectorAll('input.err'), function (i) { i.classList.remove('err'); i.removeAttribute('title'); });
    var next = tr.nextElementSibling;
    if (next && next.classList.contains('g-msg')) next.remove();
  }
  function showErrors(tr, errors) {
    clearErrors(tr);
    var msgs = [];
    Object.keys(errors).forEach(function (k) {
      var inp = tr.querySelector('[name=' + k + ']');
      var label = (COLS.filter(function (c) { return c[0] === k; })[0] || [])[1];
      if (inp) { inp.classList.add('err'); inp.setAttribute('title', errors[k]); }
      msgs.push((label ? label + ': ' : '') + errors[k]);
    });
    var msg = el('tr', { class: 'g-msg' });
    var td = el('td', { colspan: String(COLS.length + 3) }, '⚠ ' + msgs.join(' · '));
    msg.appendChild(td);
    tr.after(msg);
    var first = tr.querySelector('input.err');
    if (first) first.focus();
  }
  function setState(tr, state) {
    tr.classList.remove('dirty', 'saving', 'saved', 'failed');
    if (state) tr.classList.add(state);
    var s = tr.querySelector('.g-state');
    s.textContent = { dirty: '●', saving: '…', saved: '✓', failed: '!' }[state] || '';
    s.title = { dirty: 'Chưa lưu – nhấn Enter để lưu', saving: 'Đang lưu', saved: 'Đã lưu', failed: 'Chưa lưu được' }[state] || '';
  }

  /* ---------- Lưu / xóa ---------- */
  function post(url, body) {
    return fetch(url, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      if (res.redirected || (res.headers.get('content-type') || '').indexOf('json') < 0) {
        return { ok: false, errors: { _row: 'Phiên đăng nhập đã hết. Hãy đăng nhập lại (sao chép lại số liệu đang gõ nếu cần).' } };
      }
      return res.json();
    }).catch(function () {
      return { ok: false, errors: { _row: 'Mất kết nối mạng – chưa lưu được. Kiểm tra mạng rồi nhấn Enter để thử lại.' } };
    });
  }

  function save(tr, focusNext) {
    if (tr._saving) return tr._saving;
    if (!tr.classList.contains('dirty') && !tr.classList.contains('failed')) {
      if (focusNext) moveDown(tr, focusNext);
      return Promise.resolve();
    }
    if (isBlank(tr)) { setState(tr, null); clearErrors(tr); return Promise.resolve(); }
    var wasNew = !tr._row.id;
    setState(tr, 'saving');
    tr._saving = post(location.pathname + '/api/luu', values(tr)).then(function (res) {
      tr._saving = null;
      if (res.ok) {
        tr._row = res.row;
        COLS.forEach(function (c) {
          var inp = tr.querySelector('[name=' + c[0] + ']');
          if (inp && document.activeElement !== inp) inp.value = res.row[c[0]] || '';
          else if (inp && c[2] !== 'text') inp.value = res.row[c[0]] || '';
        });
        tr.querySelector('[data-amount]').textContent = fmtMoney(res.row.amount);
        tr.classList.remove('g-new');
        clearErrors(tr);
        setState(tr, 'saved');
        paintMeta(tr);
        rememberSuggestion(res.row);
        if (wasNew) addBlankRow();
        renumber();
        if (focusNext) moveDown(tr, focusNext);
      } else {
        if (res.current) { // người khác vừa sửa -> hiện số liệu mới nhất
          tr._row = res.current;
          COLS.forEach(function (c) { var i = tr.querySelector('[name=' + c[0] + ']'); if (i) i.value = res.current[c[0]] || ''; });
          tr.querySelector('[data-amount]').textContent = fmtMoney(res.current.amount);
          paintMeta(tr); renumber();
        }
        setState(tr, 'failed');
        showErrors(tr, res.errors || { _row: 'Chưa lưu được' });
      }
    });
    return tr._saving;
  }

  function moveDown(tr, field) {
    var next = tr.nextElementSibling;
    while (next && !next.classList.contains('g-row')) next = next.nextElementSibling;
    if (!next) return;
    var inp = next.querySelector('[name=' + field + ']') || next.querySelector('input');
    if (inp) { inp.focus(); if (inp.select) inp.select(); }
  }

  function rememberSuggestion(r) {
    var key = r.content.toLowerCase();
    if (!sugg[key]) {
      var dl = document.getElementById('dl-content');
      dl.appendChild(el('option', { value: r.content }));
    }
    sugg[key] = { c: r.content, u: r.unit, p: r.unit_price };
  }

  /* ---------- Sự kiện ---------- */
  tbody.addEventListener('input', function (e) {
    var tr = e.target.closest('tr.g-row');
    if (!tr) return;
    setState(tr, 'dirty');
    if (e.target.name === 'quantity' || e.target.name === 'unit_price') preview(tr);
    if (e.target.name === 'content') { // chọn gợi ý -> tự điền ĐVT, đơn giá nếu trống
      var s = sugg[e.target.value.trim().toLowerCase()];
      if (s) {
        var u = tr.querySelector('[name=unit]'); var p = tr.querySelector('[name=unit_price]');
        if (!u.value && s.u) u.value = s.u;
        if (!p.value && s.p) { p.value = s.p; preview(tr); }
      }
    }
  });

  tbody.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.isComposing) return;
    var tr = e.target.closest('tr.g-row');
    if (!tr) return;
    e.preventDefault();
    if (e.target.name === 'quantity') normalizeQty(e.target);
    if (e.target.name === 'entry_date' && window.QL) e.target.value = window.QL.normDate(e.target.value);
    save(tr, e.target.name);
  });

  // Rời khỏi dòng -> tự lưu
  tbody.addEventListener('focusout', function (e) {
    var tr = e.target.closest('tr.g-row');
    if (!tr) return;
    if (e.target.name === 'quantity') normalizeQty(e.target);
    setTimeout(function () {
      if (!tr.isConnected || tr.contains(document.activeElement)) return;
      if (tr.classList.contains('dirty')) save(tr);
    }, 0);
  });

  function normalizeQty(inp) {
    var m = parseQty(inp.value);
    if (m !== null && !isNaN(m)) { inp.value = fmtQty(m); preview(inp.closest('tr')); }
  }

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('.g-del');
    if (!btn) return;
    var tr = btn.closest('tr.g-row');
    var r = tr._row;
    if (!r.id) return;
    if (!window.confirm('Xóa dòng "' + r.content + '" (' + r.entry_date + ', ' + fmtMoney(r.amount) + ' đ)?')) return;
    setState(tr, 'saving');
    post(location.pathname + '/api/xoa', { id: r.id }).then(function (res) {
      if (res.ok) {
        clearErrors(tr); tr.remove(); renumber();
      } else { setState(tr, 'failed'); showErrors(tr, res.errors); }
    });
  });

  window.addEventListener('beforeunload', function (e) {
    if (tbody.querySelector('tr.dirty, tr.saving')) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- Khởi tạo ---------- */
  data.rows.forEach(function (r) { tbody.appendChild(makeRow(r)); });
  addBlankRow();
  renumber();
})();
