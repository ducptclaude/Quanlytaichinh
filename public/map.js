// =====================================================================
// BẢN ĐỒ PHÂN BỔ DỰ ÁN (Leaflet 1.9.4 nhúng tại /vendor/leaflet, nền OpenStreetMap)
// - Báo cáo: vòng tròn mỗi dự án (to nhỏ = doanh thu TĐ mới nhất · thực tế), màu theo tỷ suất hoặc trạng thái,
//   khung Trọng điểm + doanh thu theo khu vực, danh sách dự án chưa có vị trí
// - Form Dự án: hộp "Chọn trên bản đồ" để lấy tọa độ
// =====================================================================
const MAP_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const MAP_HOME = [16.054, 108.202]; // mặc định: Đà Nẵng
const MAP_ST = { 'Chuẩn bị': '#d08a1e', 'Đang thi công': '#3462a3', 'Tạm dừng': '#c0392b', 'Hoàn thành': '#0f7a4f' }; // cùng màu nhãn tình trạng
let bMapObj = null;

function mapLeaflet() {
  if (!document.querySelector('link[data-leaflet]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/vendor/leaflet/leaflet.css'; l.dataset.leaflet = '1';
    document.head.appendChild(l);
  }
  return bLoad('/vendor/leaflet/leaflet.js');
}
// Nền dự phòng (OSM Humanitarian – máy chủ openstreetmap.fr, cùng dữ liệu OpenStreetMap): dùng khi máy người xem không tải được ảnh nền OSM (mạng chặn, máy chủ OSM từ chối)
const MAP_TILE2 = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
function mapTiles() {
  const osm = L.tileLayer(MAP_TILE, { maxZoom: 19, attribution: MAP_ATTR, referrerPolicy: 'strict-origin-when-cross-origin' }); // OSM yêu cầu gửi tên miền
  let err = 0, ok = 0;
  osm.on('tileload', () => { ok++; });
  osm.on('tileerror', () => {
    const m = osm._map;
    if (++err < 3 || ok || !m) return; // vài ô lỗi lẻ tẻ thì bỏ qua; lỗi liên tục, chưa ô nào tải được -> đổi nền
    m.removeLayer(osm);
    L.tileLayer(MAP_TILE2, { maxZoom: 19, subdomains: 'abc', attribution: `${MAP_ATTR} · nền HOT (openstreetmap.fr)` }).addTo(m);
  });
  return osm;
}
// Ô bản đồ đổi kích thước (vẽ lúc đang ẩn, đổi bố cục, xoay điện thoại, mở/đóng khung bên) -> Leaflet tính lại và tải đủ nền
function mapWatch(m, el) {
  if (!('ResizeObserver' in window)) return;
  let t = 0;
  const ro = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => { if (m._container === el && document.body.contains(el)) m.invalidateSize(); }, 120); });
  ro.observe(el);
  m.on('unload', () => ro.disconnect());
}
const mapTsCol = (ts) => (ts >= 0.15 ? '#0f7a4f' : ts >= 0.1 ? '#c9a227' : '#b4471c');

// Khu vực để gộp: lấy phần trước dấu phẩy, bỏ "quận / huyện / phường / Q. / P.", viết hoa chữ đầu mỗi từ
// -> "Cẩm Lệ, Đà Nẵng", "Q. Cẩm Lệ", "quận cẩm lệ" đều thành "Cẩm Lệ"
function mapKv(s) {
  const goc = String(s || '').split(',')[0].trim();
  let t = goc.replace(/^(quận|huyện|phường|xã|thị xã|thành phố|tp\.?|q\.|p\.)\s*/i, '').trim();
  if (/^\d+$/.test(t)) t = (/^(phường|p\.)/i.test(goc) ? 'Phường ' : 'Quận ') + t; // "Quận 7", "Phường 3": giữ chữ đứng trước số
  if (!t) return 'Chưa ghi khu vực';
  return t.toLocaleLowerCase('vi').replace(/(^|\s)(\p{L})/gu, (m, a, c) => a + c.toLocaleUpperCase('vi'));
}
// Số liệu từng dự án: doanh thu, chi phí, lợi nhuận TĐ mới nhất (thực tế hệ thống, cùng nguồn mục I-A)
function mapData(list, v) {
  const by = new Map(bMuc4Data(list, v).rows.map((x) => [x.d.id, x]));
  return list.map((d) => { const x = by.get(d.id) || { t3: 0, c3: 0, l3: 0 };
    return { d, dt: x.t3, cp: x.c3, ln: x.l3, kv: mapKv(d.khu_vuc || d.dia_diem),
      co: Number.isFinite(d.vi_do) && Number.isFinite(d.kinh_do) && d.vi_do !== null && d.kinh_do !== null }; });
}


async function bMapInit(list, v) {
  const el = document.getElementById('b-map');
  if (bMapObj) { bMapObj.remove(); bMapObj = null; }
  if (!el) return;
  const R = mapData(list, v).filter((x) => x.co);
  try { await mapLeaflet(); } catch { el.innerHTML = '<div class="map-empty">Không tải được thư viện bản đồ.</div>'; return; }
  if (!document.body.contains(el)) return; // trang đã vẽ lại trong lúc tải
  const m = bMapObj = L.map(el, { zoomControl: false, scrollWheelZoom: false });
  L.control.zoom({ position: 'bottomright' }).addTo(m);
  mapTiles().addTo(m);
  mapWatch(m, el);
  if (!R.length) { m.setView(MAP_HOME, 12); return; }
  const mode = BST.map_mode === 'tt' ? 'tt' : 'ts', mx = Math.max(...R.map((x) => Math.max(0, x.dt)), 1);
  const MK = new Map(); // id dự án -> vòng tròn (để bấm "Đi tới dự án")
  for (const x of [...R].sort((a, b) => b.dt - a.dt)) { // vòng lớn vẽ trước, vòng nhỏ nằm trên
    const ts = x.dt ? x.ln / x.dt : 0, col = mode === 'ts' ? mapTsCol(ts) : (MAP_ST[x.d.trang_thai] || '#8a94a6');
    const c = L.circleMarker([x.d.vi_do, x.d.kinh_do], { radius: 9 + Math.sqrt(Math.max(0, x.dt) / mx) * 22, color: '#fff', weight: 2.5, fillColor: col, fillOpacity: 0.82 }).addTo(m);
    c.bindPopup(`<div class="map-pp"><b>${esc(x.d.ma_du_an)}</b> · ${esc(x.d.ten_du_an)}
      <div class="map-pp-s">${esc(x.kv)} · ${esc(x.d.trang_thai)} · ${Number(x.d.tien_do) || 0}%${x.d.chu_dau_tu ? `<br>CĐT: ${esc(x.d.chu_dau_tu)}` : ''}</div>
      <table><tr><td>Doanh thu</td><td>${bTy(x.dt)} ${TY()}</td></tr><tr><td>Chi phí</td><td>${bTy(x.cp)} ${TY()}</td></tr>
      <tr><td>Lợi nhuận</td><td class="${x.ln < 0 ? 'neg' : ''}">${bTy(x.ln)} ${TY()} · ${bpct(x.ln, x.dt)}</td></tr></table>
      <button type="button" class="map-pp-b" data-mapprj="${x.d.id}">Mở thẻ dự án →</button></div>`);
    L.marker([x.d.vi_do, x.d.kinh_do], { interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'map-lbl-w', html: `<span class="map-lbl">${esc(x.d.ma_du_an)}</span>`, iconSize: null, iconAnchor: [-14, 10] }) }).addTo(m);
    MK.set(x.d.id, { c, x });
  }
  // Canh vùng nhìn: 1 dự án -> mức quận/phường (13); nhiều dự án -> vừa đủ tất cả, chừa lề cho vòng tròn và nhãn, tối đa mức 14.
  // Canh lại khi khung đổi kích thước (trang vừa vẽ xong, đổi cỡ cửa sổ) cho đến khi người dùng tự kéo / phóng to.
  const pts = R.map((x) => [x.d.vi_do, x.d.kinh_do]), rMax = 9 + 22;
  let tuChinh = false;
  const pad = { paddingTopLeft: [rMax + 10, rMax + 10], paddingBottomRight: [rMax + 90, rMax + 10] };
  const fitTo = (P, anim) => { if (P.length === 1) m.setView(P[0], P === pts ? 13 : 15, { animate: anim }); else m.fitBounds(P, { ...pad, maxZoom: 14, animate: anim }); };
  // không canh khi khung đang ẩn (rộng 0) – sẽ canh khi khung hiện ra (ResizeObserver)
  const fit = () => { if (tuChinh || !document.body.contains(el) || !el.clientWidth || !el.clientHeight) return; m.invalidateSize({ pan: false }); fitTo(pts, false); };
  m._bks = { MK, fitTo, pts, R, khoa: () => { tuChinh = true; }, mo: () => { tuChinh = false; fit(); } };
  m.setView(pts[0], 12, { animate: false }); // vùng nhìn tạm (kể cả khi khung đang ẩn), fit() canh lại khi khung có kích thước
  fit();
  requestAnimationFrame(fit); setTimeout(fit, 250);
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => fit()); ro.observe(el); m.on('unload', () => ro.disconnect()); }
  // người dùng tự kéo / lăn chuột / bấm nút phóng to -> giữ nguyên vùng họ chọn, không tự canh lại
  ['mousedown', 'wheel', 'touchstart', 'keydown'].forEach((ev) => el.addEventListener(ev, () => { tuChinh = true; }, { passive: true }));
  m.on('focus click', () => m.scrollWheelZoom.enable()); // lăn chuột phóng to chỉ sau khi bấm vào bản đồ (tránh kẹt khi cuộn trang)
  m.on('blur mouseout', () => m.scrollWheelZoom.disable());
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-mapprj]');
  if (b) { bMapObj?.closePopup(); return openProjectReport(Number(b.dataset.mapprj)); }
  const B = bMapObj?._bks;
  const go = e.target.closest('[data-mapgo]');
  if (go && B) { const k = B.MK.get(Number(go.dataset.mapgo)); if (!k) return; B.khoa();
    document.querySelectorAll('.map-go button').forEach((x) => x.classList.toggle('on', x === go));
    bMapObj.flyTo(k.c.getLatLng(), Math.max(bMapObj.getZoom(), 15), { duration: 0.8 }); bMapObj.once('moveend', () => k.c.openPopup());
    document.getElementById('b-map')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
  const kvb = e.target.closest('[data-mapkv]');
  if (kvb && B) { const P = B.R.filter((x) => x.kv === kvb.dataset.mapkv).map((x) => [x.d.vi_do, x.d.kinh_do]); if (!P.length) return; B.khoa();
    document.querySelectorAll('.map-r').forEach((x) => x.classList.toggle('on', x === kvb)); bMapObj.closePopup(); B.fitTo(P, true); return; }
  if (e.target.closest('[data-mapall]') && B) { document.querySelectorAll('.map-r.on, .map-go .on').forEach((x) => x.classList.remove('on')); bMapObj.closePopup(); B.mo(); return; }
  const md = e.target.closest('[data-mapmode]');
  if (md && BC) { BST.map_mode = md.dataset.mapmode; bSave(); return renderKeepPos(`[data-mapmode="${md.dataset.mapmode}"]`); }
});

// ---------------------------------------------------------------------
// Form Dự án: chọn vị trí trên bản đồ -> điền ô Tọa độ "vĩ độ, kinh độ"
// ---------------------------------------------------------------------
const mapParse = (s) => { const m = String(s || '').trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!m) return null; const la = Number(m[1].replace(',', '.')), lo = Number(m[2].replace(',', '.'));
  return Math.abs(la) <= 90 && Math.abs(lo) <= 180 ? [la, lo] : null; };
const mapFmt = (la, lo) => `${la.toFixed(6)}, ${lo.toFixed(6)}`;

async function mapPicker(input) {
  const dlg = document.createElement('dialog');
  dlg.className = 'pass-dlg map-dlg';
  dlg.innerHTML = `<div class="stack"><h3>Chọn vị trí công trình</h3>
    <p class="muted small">Bấm vào bản đồ để đặt vị trí (kéo, lăn chuột để phóng to). Hoặc dán tọa độ từ Google Maps: bấm chuột phải vào điểm → chép dòng số đầu tiên.</p>
    <div class="map-pick" id="map-pick"></div>
    <div class="map-pick-v">Vị trí: <b id="map-pick-t">chưa chọn</b></div>
    <div class="actions"><button type="button" class="primary" data-ok disabled>Dùng vị trí này</button><button type="button" data-clear>Xóa vị trí</button><button type="button" data-x>Hủy</button></div></div>`;
  document.body.appendChild(dlg);
  dlg.showModal();
  const close = () => { pm?.remove(); dlg.remove(); };
  let pm = null, pt = mapParse(input.value), mk = null;
  dlg.addEventListener('close', close);
  dlg.querySelector('[data-x]').onclick = () => dlg.close();
  dlg.querySelector('[data-clear]').onclick = () => { input.value = ''; input.dispatchEvent(new Event('input')); dlg.close(); };
  dlg.querySelector('[data-ok]').onclick = () => { if (pt) { input.value = mapFmt(pt[0], pt[1]); input.dispatchEvent(new Event('input')); } dlg.close(); };
  try { await mapLeaflet(); } catch { dlg.querySelector('#map-pick').textContent = 'Không tải được thư viện bản đồ.'; return; }
  pm = L.map('map-pick').setView(pt || MAP_HOME, pt ? 16 : 12);
  mapTiles().addTo(pm);
  mapWatch(pm, pm.getContainer());
  const set = (la, lo) => { pt = [la, lo];
    if (mk) mk.setLatLng(pt); else mk = L.circleMarker(pt, { radius: 10, color: '#fff', weight: 3, fillColor: '#b4471c', fillOpacity: 0.95 }).addTo(pm);
    dlg.querySelector('#map-pick-t').textContent = mapFmt(la, lo); dlg.querySelector('[data-ok]').disabled = false; };
  if (pt) set(pt[0], pt[1]);
  pm.on('click', (e) => set(e.latlng.lat, e.latlng.lng));
  setTimeout(() => pm.invalidateSize(), 60);
}
