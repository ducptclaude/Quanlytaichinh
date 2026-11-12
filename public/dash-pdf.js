// =====================================================================
// DASHBOARD PDF – 1 TRANG A4 NGANG (in -> "Lưu dưới dạng PDF")
// Dựng riêng một trang gọn từ cùng số liệu báo cáo (bMuc4Data = thực tế, bTongHopData = dòng tiền),
// theo phạm vi và nút Trước / Sau VAT đang chọn. Không đổi số, chỉ trình bày lại cho trang in.
// =====================================================================
const DP = { dt: '#3462a3', cp: '#b07338', ln: '#2a9d8f', navy: '#1f2a44', gold: '#c9a96a', ok: '#0f7a4f', bad: '#b4471c' };

function dpHtml(list, v) {
  const A = bMuc4Data(list, v), T = A.T, C = bTongHopData(list, v, { to: '9999-12' }), TC = C.T;
  const vt = v === 'gt' ? 'trước VAT' : 'sau VAT', n = A.rows.length;
  const ty = (x) => `<span class="${x < 0 ? 'neg' : ''}">${bTyFix(x)}</span>`;
  const pc = (a, b) => (b ? `${((a / b) * 100).toFixed(1).replace('.', ',')}%` : '–');
  const d = (cur, base, good) => { const x = cur - base; if (Math.abs(x) < 5e6) return '<span class="dp-eq">— không đổi so với lúc ký</span>';
    return `<span class="${(x > 0) === good ? 'dp-ok' : 'dp-bad'}">${x > 0 ? '▲' : '▼'} ${bTyFix(Math.abs(x))}</span> <span class="dp-eq">so với lúc ký</span>`; };
  const ngay = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const one = list.length === 1 ? list[0] : null;
  // Đầu trang như Dashboard: 3 chỉ số DT – CP – LN theo TĐ đang chọn trên Dashboard + bảng Kế hoạch (mục I) – Thực (mục II) – Còn lại (mục III)
  const k = [1, 2, 3].includes(Number(BST.db_td)) ? Number(BST.db_td) : 3;
  const tk = T['t' + k], ck = T['c' + k], lk = T['l' + k];
  const M3 = bMuc3Data(list, v, C.rows, 3).T; // Kế hoạch – Thực – Còn lại: luôn số mới nhất
  const vs = (cur, base, good) => (k === 1 ? '<span class="dp-eq">Kế hoạch lúc ký hợp đồng</span>' : d(cur, base, good));
  const kpi = (lab, val, unit, sub, col) => `<div class="dp-k" style="--c:${col}"><div class="dp-kl">${lab}</div><div class="dp-kv">${val}<small>${unit}</small></div><div class="dp-ks">${sub}</div></div>`;
  const kpis = [
    kpi(`Doanh thu · TĐ${k}`, ty(tk), 'tỷ', vs(tk, T.t1, true), DP.dt),
    kpi(`Chi phí · TĐ${k}`, ty(ck), 'tỷ', `Bằng <b>${pc(ck, tk)}</b> doanh thu`, DP.cp),
    kpi(`Lợi nhuận · TĐ${k}`, ty(lk), 'tỷ', `Tỷ suất <b>${pc(lk, tk)}</b>${k === 1 ? '' : ` · lúc ký ${pc(T.l1, T.t1)}`}`, DP.ln),
  ].join('');
  const mxR = (lab, col, a, b2, c) => `<tr><th><i style="background:${col}"></i>${lab}</th><td>${ty(a)}</td><td>${ty(b2)}</td><td class="dp-mxc">${ty(c)}</td></tr>`;
  const mxT = `<table class="dp-mx"><thead><tr><th>Tỷ đồng</th><th>Kế hoạch <small>Mới nhất</small></th><th>Thực <small>Mục II · lũy kế</small></th><th class="dp-mxc">Còn lại <small>Mục III</small></th></tr></thead>
    <tbody>${mxR('Doanh thu', DP.dt, M3.dt, M3.thu, M3.pt)}${mxR('Chi phí', DP.cp, M3.cp, M3.chi, M3.pc)}${mxR('Lợi nhuận', DP.ln, M3.dt - M3.cp, M3.thu - M3.chi, M3.con)}</tbody></table>`;
  // Biểu đồ cột 3 thời điểm (thực tế) – trục từ 0
  const TV = [[T.t1, T.c1, T.l1], [T.t2, T.c2, T.l2], [T.t3, T.c3, T.l3]];
  const W = 380, H = A.rows.length > 6 ? 118 : 132, L = 30, B = H - 20, top = 12, mx = Math.max(1, ...TV.flat());
  const raw = mx / 4, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((x) => x >= raw), hi = Math.ceil((mx * 1.12) / step) * step;
  const Y = (x) => B - (Math.max(0, x) / hi) * (B - top), gw = (W - L) / 3, bw = 22;
  let svg = '';
  for (let t = 0; t <= hi + 1; t += step) svg += `<line x1="${L}" x2="${W}" y1="${Y(t)}" y2="${Y(t)}" stroke="#ece6dc"/><text x="${L - 5}" y="${Y(t) + 3}" text-anchor="end" font-size="8" fill="#8a7b6b">${(t / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</text>`;
  TV.forEach((g, i) => { const cx = L + gw * (i + 0.5);
    g.forEach((x, j) => { const xx = cx + (j - 1.5) * (bw + 4) + 2, col = [DP.dt, DP.cp, x < 0 ? DP.bad : DP.ln][j];
      svg += `<rect x="${xx}" y="${Y(x)}" width="${bw}" height="${Math.max(1, B - Y(x))}" rx="3" fill="${col}"/><text x="${xx + bw / 2}" y="${Y(x) - 3}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#2b2118">${bTyFix(x)}</text>`; });
    svg += `<text x="${cx}" y="${B + 14}" text-anchor="middle" font-size="9" font-weight="700" fill="#1f2a44">TĐ${i + 1} · ${['Theo HĐ gốc', 'HĐ + phụ lục', 'Quyết toán'][i]}</text>`; });
  // Vòng cơ cấu doanh thu TĐ3
  const lp = T.t3 > 0 ? Math.max(0, Math.min(1, T.l3 / T.t3)) : 0, r0 = 46, C0 = 2 * Math.PI * r0;
  const donut = `<svg viewBox="0 0 120 120" width="${A.rows.length > 6 ? 92 : 112}" height="${A.rows.length > 6 ? 92 : 112}"><circle cx="60" cy="60" r="${r0}" fill="none" stroke="${T.l3 < 0 ? DP.bad : DP.cp}" stroke-width="16"/>
    ${lp ? `<circle cx="60" cy="60" r="${r0}" fill="none" stroke="${DP.ln}" stroke-width="16" stroke-dasharray="${(C0 * lp).toFixed(1)} ${C0.toFixed(1)}" transform="rotate(-90 60 60)"/>` : ''}
    <text x="60" y="58" text-anchor="middle" font-size="15" font-weight="800" fill="#2b2118">${bTyFix(T.t3)}</text><text x="60" y="72" text-anchor="middle" font-size="8" fill="#8a7b6b">tỷ doanh thu</text></svg>`;
  // Thanh ngang
  const bar = (rows, max, col) => rows.map(([nm, x, e]) => `<div class="dp-hb"><span class="dp-hn" title="${esc(nm)}">${esc(nm)}</span><span class="dp-tr"><i style="width:${max ? Math.min(100, (Math.abs(x) / max) * 100) : 0}%;background:${x < 0 ? DP.bad : col}"></i></span><b>${bTyFix(x)}</b><em>${e}</em></div>`).join('');
  const prj = [...A.rows].sort((a, b) => b.l3 - a.l3), pmx = Math.max(1, ...prj.map((x) => Math.abs(x.l3)));
  const kvM = new Map(); for (const x of A.rows) { const k = typeof mapKv === 'function' ? mapKv(x.d.khu_vuc || x.d.dia_diem) : (x.d.khu_vuc || x.d.dia_diem || '–'); kvM.set(k, (kvM.get(k) || 0) + Math.max(0, x.t3)); }
  const kv = [...kvM].sort((a, b) => b[1] - a[1]), kvT = kv.reduce((a, [, x]) => a + x, 0);
  const nTop = A.rows.length > 6 ? 4 : 6;
  const thuRows = A.rows.map((x) => { const c = C.rows.find((r) => r.d.id === x.d.id) || { thu: 0 }; return [x.d.ma_du_an, x.t3 ? Math.min(1, Math.max(0, c.thu / x.t3)) : 0]; }).sort((a, b) => a[1] - b[1]).slice(0, nTop);
  const thuBar = thuRows.map(([m, r]) => `<div class="dp-hb"><span class="dp-hn">${esc(m)}</span><span class="dp-tr"><i style="width:${(r * 100).toFixed(1)}%;background:${r >= 0.999 ? DP.ok : DP.gold}"></i></span><b>${(r * 100).toFixed(0)}%</b><em>${r >= 0.999 ? 'đủ' : ''}</em></div>`).join('');
  // Điểm nhấn: 4 ô tự động
  const byThu = new Map(C.rows.map((r) => [r.d.id, r.thu]));
  const best = prj[0], low = [...A.rows].filter((x) => x.t3).sort((a, b) => a.l3 / a.t3 - b.l3 / b.t3)[0];
  const owe = [...A.rows].sort((a, b) => (b.t3 - (byThu.get(b.d.id) || 0)) - (a.t3 - (byThu.get(a.d.id) || 0)))[0];
  const st = {}; A.rows.forEach((x) => { st[x.d.trang_thai] = (st[x.d.trang_thai] || 0) + 1; });
  const cell = (ic, lab, main, sub) => `<div class="dp-in"><span class="dp-ic">${ic}</span><div><div class="dp-il">${lab}</div><div class="dp-iv">${main}</div><div class="dp-is">${sub}</div></div></div>`;
  const ins = [
    cell('★', 'Lãi cao nhất', best ? `${esc(best.d.ma_du_an)} · ${bTyFix(best.l3)} tỷ` : '–', best ? `${esc(best.d.ten_du_an)} · tỷ suất ${pc(best.l3, best.t3)}` : ''),
    cell('%', 'Tỷ suất thấp nhất', low ? `${esc(low.d.ma_du_an)} · ${pc(low.l3, low.t3)}` : '–', low ? esc(low.d.ten_du_an) : ''),
    cell('₫', 'Còn phải thu lớn nhất', owe ? `${esc(owe.d.ma_du_an)} · ${bTyFix(owe.t3 - (byThu.get(owe.d.id) || 0))} tỷ` : '–', `Tổng còn phải thu ${bTyFix(T.t3 - TC.thu)} tỷ`),
    cell('▣', 'Tình trạng dự án', Object.entries(st).map(([k, x]) => `${x} ${esc(({ 'Đang thi công': 'thi công', 'Hoàn thành': 'xong', 'Chuẩn bị': 'chuẩn bị', 'Tạm dừng': 'tạm dừng' })[k] || k.toLowerCase())}`).join(' · '), `Lợi nhuận ${T.l3 - T.l1 >= 0 ? 'tăng' : 'giảm'} ${bTyFix(Math.abs(T.l3 - T.l1))} tỷ so với lúc ký`),
  ].join('');
  // Bảng dự án: tối đa 12 dòng, còn lại gộp 1 dòng
  const MAXR = 8, rowsT = [...A.rows].sort((a, b) => b.t3 - a.t3), shown = rowsT.slice(0, MAXR), rest = rowsT.slice(MAXR);
  const byC = new Map(C.rows.map((r) => [r.d.id, r]));
  const tr = (x, i) => { const c = byC.get(x.d.id) || { thu: 0 };
    return `<tr><td>${i + 1}</td><td><b>${esc(x.d.ma_du_an)}</b></td><td class="dp-nm">${esc(x.d.ten_du_an)}</td><td>${esc(x.d.trang_thai)}</td><td>${Number(x.d.tien_do) || 0}%</td>
      <td>${ty(x.t3)}</td><td>${ty(x.c3)}</td><td class="dp-lnc"><b>${ty(x.l3)}</b></td><td>${pc(x.l3, x.t3)}</td><td>${dl(x.l3, x.l1)}</td><td>${ty(c.thu)}</td><td>${ty(x.t3 - c.thu)}</td></tr>`; };
  const dl = (a, b0) => { const x = a - b0; return Math.abs(x) < 5e6 ? '<span class="dp-eq">—</span>' : `<span class="${x > 0 ? 'dp-ok' : 'dp-bad'}">${x > 0 ? '▲' : '▼'} ${bTyFix(Math.abs(x))}</span>`; };
  const S = (arr, k) => arr.reduce((a, x) => a + x[k], 0), thuR = rest.reduce((a, x) => a + (byC.get(x.d.id)?.thu || 0), 0);
  return `<div class="dp">
    <div class="dp-hd"><img src="/img/logo-icon.png?v=mm1" alt=""><div class="dp-ht"><div class="dp-co">${esc(BC.ten_cong_ty || '')}</div><h1>DASHBOARD TÀI CHÍNH DỰ ÁN</h1>
      <div class="dp-sc">${one ? `Dự án: <b>${esc(one.ma_du_an)} – ${esc(one.ten_du_an)}</b>` : `Phạm vi: <b>Tất cả dự án (${n})</b>`} · Đơn vị: tỷ đồng, ${vt} · Số thực tế theo dữ liệu hệ thống, dòng tiền lũy kế đến ${ngay}</div></div>
      <div class="dp-dt"><span>Ngày lập</span><b>${ngay}</b></div></div>
    <div class="dp-top">${kpis}${mxT}</div>
    <div class="dp-r2">
      <div class="dp-c"><div class="dp-ct">Doanh thu – Chi phí – Lợi nhuận qua 3 thời điểm <span class="dp-lg"><i style="background:${DP.dt}"></i>DT <i style="background:${DP.cp}"></i>CP <i style="background:${DP.ln}"></i>LN</span></div>
        <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">${svg}</svg>
        <table class="dp-mini"><tr><th></th><th>TĐ1</th><th>TĐ2</th><th>TĐ3</th></tr>${[['Tỷ suất', 2], ['CP / DT', 1]].map(([lb, j]) => `<tr><td>${lb}</td>${TV.map((g) => `<td>${pc(g[j], g[0])}</td>`).join('')}</tr>`).join('')}</table></div>
      <div class="dp-c"><div class="dp-ct">Cơ cấu doanh thu · TĐ3</div><div class="dp-dn">${donut}<div>
        <div class="dp-li"><i style="background:${DP.cp}"></i>Chi phí<b>${pc(T.c3, T.t3)}</b><small>${bTyFix(T.c3)} tỷ</small></div>
        <div class="dp-li"><i style="background:${DP.ln}"></i>Lợi nhuận<b>${pc(T.l3, T.t3)}</b><small>${bTyFix(T.l3)} tỷ</small></div></div></div>
        <div class="dp-ct dp-ct2">Doanh thu theo khu vực</div>${bar(kv.slice(0, A.rows.length > 6 ? 4 : 5).map(([k, x]) => [k, x, pc(x, kvT)]), kv[0]?.[1] || 0, DP.dt)}</div>
      <div class="dp-c"><div class="dp-ct">Lợi nhuận theo dự án · TĐ3</div>${bar(prj.slice(0, nTop).map((x) => [`${x.d.ma_du_an}`, x.l3, pc(x.l3, x.t3)]), pmx, DP.ln)}
        ${prj.length > nTop ? `<div class="dp-note">… và ${prj.length - nTop} dự án khác</div>` : ''}
        <div class="dp-ct dp-ct2">Tỷ lệ đã thu tiền CĐT</div>${thuBar}</div>
    </div>
    <table class="dp-tb" style="--rp:${shown.length <= 5 ? 2.3 : shown.length <= 6 ? 1.6 : 0.8}mm"><colgroup><col style="width:7mm"><col style="width:21mm"><col><col style="width:23mm"><col style="width:12mm">${'<col style="width:19mm">'.repeat(3)}<col style="width:14mm"><col style="width:21mm"><col style="width:19mm"><col style="width:22mm"></colgroup><thead><tr><th>STT</th><th>Mã DA</th><th>Tên dự án</th><th>Tình trạng</th><th>% HT</th><th>Doanh thu</th><th>Chi phí</th><th class="dp-lnc">Lợi nhuận</th><th>Tỷ suất</th><th>LN so lúc ký</th><th>Đã thu</th><th>Còn phải thu</th></tr></thead>
      <tbody>${shown.map(tr).join('')}${rest.length ? `<tr class="dp-rest"><td></td><td colspan="4">… và ${rest.length} dự án khác</td><td>${ty(S(rest, 't3'))}</td><td>${ty(S(rest, 'c3'))}</td><td class="dp-lnc">${ty(S(rest, 'l3'))}</td><td>${pc(S(rest, 'l3'), S(rest, 't3'))}</td><td>${dl(S(rest, 'l3'), S(rest, 'l1'))}</td><td>${ty(thuR)}</td><td>${ty(S(rest, 't3') - thuR)}</td></tr>` : ''}</tbody>
      <tfoot><tr><td></td><td colspan="4">Tổng cộng (${n} dự án)</td><td>${ty(T.t3)}</td><td>${ty(T.c3)}</td><td class="dp-lnc">${ty(T.l3)}</td><td>${pc(T.l3, T.t3)}</td><td>${dl(T.l3, T.l1)}</td><td>${ty(TC.thu)}</td><td>${ty(T.t3 - TC.thu)}</td></tr></tfoot></table>
    <div class="dp-ins">${ins}</div>
    <div class="dp-ft"><div class="dp-fn">TĐ1 theo HĐ gốc · TĐ2 HĐ + phụ lục · TĐ3 quyết toán (dự án chưa quyết toán tạm tính theo TĐ2). Chi phí = HĐ đầu vào + chi phí khác đã ghi nhận.
      Dòng tiền không gồm tiền vay, trả nợ gốc. Số làm tròn 0,01 tỷ; tổng cộng tính từ số đã làm tròn. Nguồn: ${esc(BC.ten_he_thong || 'PROJECT PROFIT')} · ${esc(BC.phien_ban || '')}.</div>
      <div class="dp-sg"><div><span>Người lập</span></div><div><span>Ban Kiểm soát</span></div><div><span>Ban Giám đốc</span></div></div></div>
  </div>`;
}

// Dashboard PDF: in NGUYÊN CỤM Dashboard như trên màn hình (tiêu đề, chỉ số, bảng Kế hoạch – Thực – Còn lại, khối I–IV, biểu đồ, danh mục, bản đồ)
// – đang ở chế độ Báo cáo thì tạm chuyển sang Dashboard rồi trả lại; tự chọn khổ A4 dọc / ngang và thu nhỏ vừa đúng 1 trang.
// (Bản 1 trang dựng riêng cũ: dpHtml() – giữ lại, không dùng.)
function dpPrint() {
  if (!BC) return;
  const doiView = BST.view !== 'db';
  if (doiView) { BST.view = 'db'; renderReport(); }
  if (typeof logEvent === 'function') logEvent('dashboard_pdf', bLogScope());
  setTimeout(() => { // chờ biểu đồ, bản đồ vẽ xong
    const el = document.querySelector('#b-report .db');
    if (!el) return;
    // Giữ nguyên bố cục màn hình: khổ giấy hẹp sẽ kích hoạt kiểu xếp điện thoại -> chụp lại kiểu dáng đang thấy, gắn tạm lên từng phần tử
    const goc = new Map(), DS = ['display', 'gridTemplateColumns', 'gridColumnStart', 'gridColumnEnd', 'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis',
      'columnGap', 'rowGap', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontSize', 'lineHeight', 'whiteSpace'];
    const CAO = '.db-mapc, canvas';
    [el, ...el.querySelectorAll('*')].forEach((x) => {
      const cs = getComputedStyle(x);
      goc.set(x, x.getAttribute('style'));
      DS.forEach((k) => { x.style[k] = cs[k]; });
      if (x.matches(CAO)) x.style.height = cs.height; // giữ chiều cao (biểu đồ co giãn theo bề ngang)
    });
    const traGoc = () => goc.forEach((v, x) => (v === null ? x.removeAttribute('style') : x.setAttribute('style', v)));
    // Bố cục in cố định (không phụ thuộc màn hình): 4 khối I–IV một hàng, Danh mục + Bản đồ cạnh nhau, căn giữa trang
    const S = (sel, o) => el.querySelectorAll(sel).forEach((x) => Object.assign(x.style, o));
    const boCuc = (W) => {
      Object.assign(el.style, { width: W + 'px', maxWidth: 'none', margin: '0 auto' });
      S('.db-kpis', { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' });
      S('.db-kgr', { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' });
      S('.db-flow', { gridTemplateColumns: 'minmax(0, 1fr) 46px minmax(0, 1fr) 46px minmax(0, 1fr) 46px minmax(0, 1fr)' });
      S('.db-flow > .db-arrow', { gridColumnStart: 'auto', gridColumnEnd: 'auto', transform: 'none', height: 'auto' });
      S('.db-flow > .db-arrow i', { transform: 'none' }); S('.db-flow > .db-arrow span', { display: 'none' });
      S('.db-row2', { gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr) minmax(0, .95fr)' });
      S('.db-c-flow', { gridColumnStart: 'auto', gridColumnEnd: 'auto' });
      S('.db-row3', { gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)' });
      S('.db-table .db-ten', { maxWidth: '150px' }); S('.db-c-tbl .table-wrap', { overflow: 'visible' });
      S('.db-table td, .db-table th', { paddingLeft: '4px', paddingRight: '4px', fontSize: '11.5px' }); S('.db-table .db-pc .db-bar', { width: '28px' });
      const tbl = el.querySelector('.db-c-tbl'), mc = el.querySelector('.db-mapc'), box = mc?.closest('.db-c-map');
      if (mc) { mc.style.minHeight = '0'; mc.style.height = '240px'; }
      if (tbl && mc && box) mc.style.height = Math.max(240, tbl.getBoundingClientRect().height - (mc.getBoundingClientRect().top - box.getBoundingClientRect().top) - 16) + 'px';
      return [el.scrollWidth, el.scrollHeight];
    };
    const MM = 96 / 25.4, LE = 7; // lề 7mm
    const doc = [210 - 2 * LE, 297 - 2 * LE].map((x) => x * MM), ngang = [doc[1], doc[0]];
    const thu = [1300, 1450, 1600, 1800].map((W) => { // thử các độ rộng, chọn cách cho chữ to nhất mà vừa 1 trang
      const [w, h] = boCuc(W), zD = Math.min(doc[0] / w, doc[1] / h), zN = Math.min(ngang[0] / w, ngang[1] / h);
      return { W, w, laNgang: zN > zD, z: Math.max(zD, zN) };
    }).sort((x, y) => y.z - x.z)[0];
    const [w] = boCuc(thu.W);
    const laNgang = thu.laNgang, z = Math.min(1, thu.z * 0.985);
    if (typeof bMapObj !== 'undefined' && bMapObj) bMapObj.invalidateSize();
    const st = document.createElement('style');
    st.id = 'dbp-style';
    st.textContent = `@media print { @page { size: A4 ${laNgang ? 'landscape' : 'portrait'}; margin: ${LE}mm; }
      body.dbp-on #b-report .db { zoom: ${z.toFixed(4)}; width: ${w}px; } }`;
    document.head.appendChild(st);
    document.body.classList.add('dbp-on');
    const xong = () => {
      window.removeEventListener('afterprint', xong);
      document.body.classList.remove('dbp-on'); st.remove(); traGoc();
      if (typeof bMapObj !== 'undefined' && bMapObj) bMapObj.invalidateSize();
      if (doiView) { BST.view = 'bc'; renderReport(); }
    };
    window.addEventListener('afterprint', xong);
    setTimeout(() => window.print(), 450); // chờ bản đồ vẽ lại theo khung mới
  }, doiView ? 900 : 150);
}
document.getElementById('b-dash-pdf')?.addEventListener('click', dpPrint);
