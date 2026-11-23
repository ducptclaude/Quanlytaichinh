// BẢO VỆ DỮ LIỆU TRÊN TRANG (chạy sau app.js)
//  1. Dấu chìm (chỉ Chỉ xem / khách): tên người xem + tên đăng nhập + giờ in mờ phủ toàn trang và trên bản in / PDF -> lộ ảnh chụp là biết ai làm lộ.
//  2. Vai Chỉ xem / khách: chặn chuột phải, bôi đen, sao chép, lưu trang, xem mã nguồn, công cụ lập trình (F12).
//  3. Xác thực 2 lớp: bật / tắt ở mục Cá nhân; bắt buộc theo vai -> hiện màn hình thiết lập.
//  4. Quản trị: Cài đặt -> Bảo mật nâng cao (bắt buộc 2 lớp, gỡ 2 lớp) + Sao lưu dữ liệu (tự động 02:00, sao lưu ngay, tải về).
(function () {
  'use strict';
  let me = null;
  const fmtTg = (d) => new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const taiScript = (src) => new Promise((ok, loi) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return ok();
    const s = document.createElement('script'); s.src = src; s.dataset.src = src; s.onload = ok; s.onerror = loi; document.head.appendChild(s);
  });

  // ================= 1. DẤU CHÌM =================
  function dauChim() {
    const chu = `${me.full_name || me.username} · ${me.username} · ${fmtTg(Date.now())}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="230"><text x="20" y="130" transform="rotate(-22 230 115)" font-family="Arial, sans-serif" font-size="15" fill="#64748b" fill-opacity="0.13">${chu.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</text></svg>`;
    let el = document.getElementById('bv-wm');
    if (!el) { el = document.createElement('div'); el.id = 'bv-wm'; el.setAttribute('aria-hidden', 'true'); document.body.appendChild(el); }
    el.style.backgroundImage = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
  }
  function giuDauChim() {
    dauChim();
    setInterval(dauChim, 60e3); // cập nhật giờ mỗi phút
    // Bị xóa / ẩn bằng công cụ trình duyệt -> tự gắn lại
    new MutationObserver(() => {
      const el = document.getElementById('bv-wm');
      if (!el || el.style.display === 'none' || el.hidden) { el?.remove(); dauChim(); }
    }).observe(document.body, { childList: true, attributes: true, subtree: false });
  }

  // ================= 2. CHỐNG SAO CHÉP (Chỉ xem / khách) =================
  function chongSaoChep() {
    document.documentElement.classList.add('bv-khoa');
    const oNhap = (t) => t && t.closest && t.closest('input, textarea, select, [contenteditable="true"]');
    const chan = (e) => { if (!oNhap(e.target)) { e.preventDefault(); return false; } };
    ['contextmenu', 'copy', 'cut', 'dragstart', 'selectstart'].forEach((ev) => document.addEventListener(ev, chan, true));
    document.addEventListener('keydown', (e) => {
      const k = (e.key || '').toLowerCase(), c = e.ctrlKey || e.metaKey;
      const cam = k === 'f12' || (c && ['s', 'u', 'p'].includes(k)) || (c && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) || (e.metaKey && e.altKey && ['i', 'j', 'c', 'u'].includes(k));
      if (cam || (c && ['c', 'x', 'a'].includes(k) && !oNhap(e.target))) { e.preventDefault(); e.stopPropagation(); return false; }
    }, true);
    // Mở công cụ lập trình (cửa sổ trong bị thu hẹp bất thường) -> che nội dung
    const che = document.createElement('div');
    che.id = 'bv-che'; che.hidden = true;
    che.textContent = 'Nội dung được bảo vệ. Đóng công cụ lập trình của trình duyệt (F12) để tiếp tục xem.';
    document.body.appendChild(che);
    setInterval(() => {
      const mo = window.outerWidth - window.innerWidth > 200 || window.outerHeight - window.innerHeight > 220;
      che.hidden = !mo;
    }, 1500);
  }

  // ================= 3. XÁC THỰC 2 LỚP – mục Cá nhân =================
  async function khung2Lop(hop, batBuoc) {
    const st = await api('/api/auth/2fa');
    hop.innerHTML = `<h2>Xác thực 2 lớp</h2>
      <p class="small">Đăng nhập cần thêm <b>mã 6 số</b> trên điện thoại (Google Authenticator, Microsoft Authenticator…). Lộ mật khẩu vẫn không ai vào được.</p>
      <p class="small">Trạng thái: <b class="${st.bat ? 'ok' : 'warn'}">${st.bat ? 'ĐANG BẬT ✓' : 'CHƯA BẬT'}</b>${st.bat_buoc ? ' · <b>bắt buộc với vai trò của bạn</b>' : ''}</p>
      <div id="tf-body"></div><div id="tf-msg" class="msg" role="alert"></div>`;
    const body = hop.querySelector('#tf-body'), msg = hop.querySelector('#tf-msg');
    if (!st.bat) {
      body.innerHTML = `<form id="tf-tao" class="stack" autocomplete="off">
          <label>Mật khẩu đăng nhập của bạn *<input name="current_password" type="password" required autocomplete="current-password"></label>
          <div class="actions"><button type="submit" class="primary">Bắt đầu thiết lập</button></div></form>`;
      body.querySelector('#tf-tao').onsubmit = async (e) => {
        e.preventDefault();
        try {
          const r = await api('/api/auth/2fa/tao', { method: 'POST', body: JSON.stringify({ current_password: e.target.current_password.value }) });
          body.innerHTML = `<ol class="small">
              <li>Mở ứng dụng xác thực trên điện thoại → <b>Thêm tài khoản</b> → <b>Quét mã QR</b> bên dưới<br>(hoặc chọn "Nhập khóa thiết lập" và gõ khóa).</li>
              <li>Nhập mã 6 số ứng dụng hiện ra rồi bấm <b>Bật</b>.</li></ol>
            <div id="tf-qr" class="tf-qr"></div>
            <p class="small center">Khóa: <code class="tf-key">${esc(r.khoa)}</code></p>
            <form id="tf-bat" class="stack" autocomplete="off">
              <label>Mã 6 số *<input name="ma_otp" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autocomplete="one-time-code"></label>
              <div class="actions"><button type="submit" class="primary">Bật xác thực 2 lớp</button></div></form>`;
          try {
            await taiScript('/vendor/qrcode-generator-1.4.4.js');
            const qr = window.qrcode(0, 'M'); qr.addData(r.url); qr.make();
            body.querySelector('#tf-qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
          } catch { body.querySelector('#tf-qr').innerHTML = '<p class="small">Không tạo được mã QR – hãy nhập khóa bằng tay.</p>'; }
          body.querySelector('#tf-bat').onsubmit = async (ev) => {
            ev.preventDefault();
            try {
              await api('/api/auth/2fa/bat', { method: 'POST', body: JSON.stringify({ ma_otp: ev.target.ma_otp.value }) });
              me.totp_on = true;
              document.getElementById('bv-ep')?.remove();
              await khung2Lop(hop, batBuoc);
              showMsg(hop.querySelector('#tf-msg'), 'Đã bật xác thực 2 lớp. Lần đăng nhập sau sẽ hỏi mã 6 số.');
            } catch (err) { showMsg(msg, err.message, 'err'); }
          };
        } catch (err) { showMsg(msg, err.message, 'err'); }
      };
    } else if (!st.bat_buoc) {
      body.innerHTML = `<details><summary class="small">Tắt xác thực 2 lớp</summary>
        <form id="tf-tat" class="stack" autocomplete="off">
          <label>Mật khẩu đăng nhập *<input name="current_password" type="password" required autocomplete="current-password"></label>
          <label>Mã 6 số hiện tại *<input name="ma_otp" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label>
          <div class="actions"><button type="submit" class="danger">Tắt</button></div></form></details>`;
      body.querySelector('#tf-tat').onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api('/api/auth/2fa/tat', { method: 'POST', body: JSON.stringify(formData(e.target)) });
          await khung2Lop(hop, batBuoc);
          showMsg(hop.querySelector('#tf-msg'), 'Đã tắt xác thực 2 lớp');
        } catch (err) { showMsg(msg, err.message, 'err'); }
      };
    }
  }

  // Bắt buộc 2 lớp mà chưa bật -> màn hình thiết lập phủ toàn trang
  function epThietLap() {
    const ep = document.createElement('div');
    ep.id = 'bv-ep';
    ep.innerHTML = `<div class="card narrow"><p class="warn-bar" style="position:static">Quản trị đã bắt buộc xác thực 2 lớp cho vai trò của bạn. Thiết lập xong mới tiếp tục làm việc được.</p>
      <div id="bv-ep-2lop"></div><div class="actions"><button type="button" id="bv-ep-out">Đăng xuất</button></div></div>`;
    document.body.appendChild(ep);
    khung2Lop(ep.querySelector('#bv-ep-2lop'), true);
    ep.querySelector('#bv-ep-out').onclick = async () => { try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* bỏ qua */ } location.href = '/login'; };
  }

  // ================= 4. QUẢN TRỊ: bảo mật nâng cao + sao lưu =================
  async function quanTriBaoMat(hop) {
    const s = await api('/api/settings/bao-mat');
    hop.innerHTML = `<h2>Bảo mật nâng cao</h2>
      <form id="bm-form" class="stack" autocomplete="off">
        <label class="chk"><input type="checkbox" name="bat_buoc_2_lop" ${s.bat_buoc_2_lop ? 'checked' : ''}> Bắt buộc xác thực 2 lớp cho Quản trị, Lãnh đạo, Kỹ thuật hệ thống</label>
        <p class="small muted">${s.chua_bat.length ? 'Chưa bật 2 lớp: ' + s.chua_bat.map(esc).join(', ') + ' (sẽ phải thiết lập ở lần vào tiếp theo).' : 'Tất cả tài khoản thuộc các vai trò trên đã bật 2 lớp.'}</p>
        <label>Mật khẩu đăng nhập của bạn *<input name="current_password" type="password" required autocomplete="current-password"></label>
        <div class="actions"><button type="submit" class="primary">Lưu</button></div>
        <div id="bm-msg" class="msg" role="alert"></div></form>
      <h3 class="small">Gỡ xác thực 2 lớp (người dùng mất / đổi điện thoại)</h3>
      <div class="actions"><select id="bm-user"></select><button type="button" id="bm-go" class="danger">Gỡ 2 lớp</button></div>
      <div id="bm-msg2" class="msg" role="alert"></div>`;
    hop.querySelector('#bm-form').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/api/settings/bao-mat', { method: 'PUT', body: JSON.stringify({ bat_buoc_2_lop: e.target.bat_buoc_2_lop.checked, current_password: e.target.current_password.value }) });
        await quanTriBaoMat(hop);
        showMsg(hop.querySelector('#bm-msg'), 'Đã lưu cài đặt bảo mật');
      } catch (err) { showMsg(hop.querySelector('#bm-msg'), err.message, 'err'); }
    };
    try {
      const ds = (await api('/api/users')).filter((u) => u.totp_on);
      const sel = hop.querySelector('#bm-user');
      sel.innerHTML = ds.length ? ds.map((u) => `<option value="${u.id}">${esc(u.full_name || u.username)} (${esc(u.username)})</option>`).join('') : '<option value="">Chưa ai bật 2 lớp</option>';
      hop.querySelector('#bm-go').disabled = !ds.length;
      hop.querySelector('#bm-go').onclick = async () => {
        if (!sel.value || !confirm('Gỡ xác thực 2 lớp của tài khoản này? Người đó sẽ bị đăng xuất và phải thiết lập lại.')) return;
        try { await api(`/api/users/${sel.value}/2fa`, { method: 'DELETE' }); await quanTriBaoMat(hop); showMsg(hop.querySelector('#bm-msg2'), 'Đã gỡ xác thực 2 lớp'); }
        catch (err) { showMsg(hop.querySelector('#bm-msg2'), err.message, 'err'); }
      };
    } catch { /* danh sách tài khoản lỗi: bỏ qua */ }
  }

  async function quanTriSaoLuu(hop) {
    const { items } = await api('/api/sao-luu');
    hop.innerHTML = `<h2>Sao lưu dữ liệu</h2>
      <p class="small">Tự động sao lưu <b>toàn bộ dữ liệu</b> lúc <b>02:00</b> mỗi ngày, giữ 7 bản mới nhất (chống xóa nhầm / nhập sai).
      Bản sao lưu nằm cùng máy chủ dữ liệu – <b>nên tải 1 bản về máy mỗi tuần</b>. Tải về cần Passcode xóa và được ghi nhật ký.</p>
      <div class="actions"><button type="button" class="primary" id="sl-ngay">Sao lưu ngay</button></div>
      <div class="table-wrap"><table><thead><tr><th>Thời điểm</th><th>Loại</th><th class="num">Dung lượng</th><th></th></tr></thead>
      <tbody>${items.length ? items.map((b) => `<tr><td>${fmtTg(b.tao_luc)}</td><td>${esc(b.ly_do)}</td><td class="num">${kb(b.kich_thuoc)}</td>
        <td><button type="button" class="sm" data-sl="${b.id}">Tải về</button></td></tr>`).join('') : '<tr><td colspan="4" class="muted">Chưa có bản sao lưu</td></tr>'}</tbody></table></div>
      <div id="sl-msg" class="msg" role="alert"></div>`;
    const msg = hop.querySelector('#sl-msg');
    hop.querySelector('#sl-ngay').onclick = async (e) => {
      e.target.disabled = true;
      try { await api('/api/sao-luu', { method: 'POST', body: '{}' }); await quanTriSaoLuu(hop); showMsg(hop.querySelector('#sl-msg'), 'Đã tạo bản sao lưu'); }
      catch (err) { showMsg(msg, err.message, 'err'); e.target.disabled = false; }
    };
    hop.querySelectorAll('[data-sl]').forEach((b) => { b.onclick = async () => {
      const passcode = prompt('Nhập Passcode xóa (8 chữ số) để tải bản sao lưu:');
      if (!passcode) return;
      try {
        const r = await fetch(`/api/sao-luu/${b.dataset.sl}/tai`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' }, body: JSON.stringify({ passcode }) });
        if (!r.ok) throw new Error(((await r.json().catch(() => ({}))).errors || ['Lỗi ' + r.status]).join('\n'));
        const ten = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'mymoney-saoluu.json.gz';
        const url = URL.createObjectURL(await r.blob());
        const a = document.createElement('a'); a.href = url; a.download = ten; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showMsg(msg, 'Đã tải ' + ten + ' – cất giữ cẩn thận (có toàn bộ số liệu).');
      } catch (err) { showMsg(msg, err.message, 'err'); }
    }; });
  }

  // ================= KHỞI ĐỘNG =================
  async function khoiDong() {
    try { me = await api('/api/auth/me'); } catch { return; }
    if (!me) return;
    // Dấu chìm + chặn sao chép: chỉ vai Chỉ xem và tài khoản khách
    if (me.role === 'viewer' || me.khach) { giuDauChim(); chongSaoChep(); }
    // Cá nhân: thêm khung 2 lớp (khách không có mục Cá nhân)
    const prof = document.querySelector('#tab-profile');
    if (prof && !me.khach) {
      const hop = document.createElement('div'); hop.className = 'card narrow'; hop.id = 'tf-card';
      prof.appendChild(hop);
      khung2Lop(hop).catch(() => hop.remove());
    }
    // Cài đặt (Quản trị): bảo mật nâng cao + sao lưu
    const set = document.querySelector('#tab-settings');
    if (set && me.role === 'admin') {
      const a = document.createElement('div'); a.className = 'card narrow'; set.appendChild(a); quanTriBaoMat(a).catch(() => a.remove());
      const b = document.createElement('div'); b.className = 'card narrow'; set.appendChild(b); quanTriSaoLuu(b).catch(() => b.remove());
    }
    // Bắt buộc 2 lớp mà chưa bật
    if (!me.totp_on && !me.khach) {
      try { const st = await api('/api/auth/2fa'); if (st.bat_buoc && !st.bat) epThietLap(); } catch { /* bỏ qua */ }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', khoiDong); else khoiDong();
})();
