const fmt = new Intl.NumberFormat('vi-VN');
const slug = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, '-');
const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const dmy = (d) => (d ? String(d).slice(0, 10).split('-').reverse().join('/') : '');
const dt = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—');

let META = {};
let ME = {};
let projects = [];
let users = [];

// =====================================================================
// Khởi động
// =====================================================================
(async () => {
  try {
    [META, ME] = await Promise.all([api('/api/meta'), api('/api/auth/me')]);
    // chờ các file giao diện còn lại (report.js, map.js…) tải xong rồi mới mở tab – mạng chậm thì /api trả về trước khi report.js kịp tải
    if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  } catch (err) {
    return alert('Không tải được dữ liệu: ' + err.message);
  }
  dbWarning(META);
  applyBranding(META);
  $('#me-name').textContent = ME.full_name || ME.username;
  $('#me-role').textContent = META.roles[ME.role];

  // Ẩn chức năng không thuộc quyền
  $$('[data-role]').forEach((el) => {
    if (!el.dataset.role.split(' ').includes(ME.role)) el.remove();
  });
  { const g = $('[data-grp="qt"] [data-grp-toggle]'); const ten = { bks: 'Kiểm soát', it: 'Hệ thống' }[ME.role]; if (g && ten) g.innerHTML = `${ten} <span class="caret">▾</span>`; } // BKS: nhật ký · IT: tài khoản, nhật ký
  // Lãnh đạo, Ban Kiểm soát: xem Dự án / Doanh thu / Chi phí (chỉ xem – không có form, nút sửa) -> nhóm menu gọi là "Dữ liệu"
  if (!can('hd') && !can('tien')) { const g = $('[data-grp="nhap"] [data-grp-toggle]'); if (g) g.innerHTML = 'Dữ liệu <span class="caret">▾</span>'; }
  if (!can('xuat')) document.body.classList.add('no-xuat');
  if (ME.role === 'viewer') document.body.classList.add('chi-xem');
  if (ME.khach) khachInit();
  if (can('nop')) duyetInit(); // tab Duyệt: số hồ sơ, thông báo, nhãn trên dòng số liệu // tài khoản khách: đồng hồ đếm ngược, không có mục Cá nhân // ẩn liên kết sang trang nhập liệu – xem style.css // Chỉ xem: chặn in (Ctrl+P) – xem style.css
  document.body.classList.add('roles-ready'); // đến đây mới hiện các mục theo quyền (tránh nhấp nháy tab quản trị)

  const stSel = $('#p-form [name=trang_thai]');
  // Trạng thái tự chạy theo số liệu; chỉ chọn tay khi Tạm dừng
  if (stSel) { stSel.innerHTML = '<option value="Đang thi công">Tự động (theo số liệu)</option><option value="Tạm dừng">Tạm dừng</option>'; stSel.title = 'Trạng thái tự chạy theo số liệu: Chuẩn bị · Đang thi công · Hoàn thành (đã quyết toán hoặc đạt 100%). Chỉ chọn tay khi dự án Tạm dừng'; }
  const roleSel = $('#u-form [name=role]');
  if (roleSel) roleSel.innerHTML = Object.entries(META.roles).filter(([k]) => ME.role === 'admin' || k !== 'admin').map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');

  // Mặc định vào Báo cáo; người nhập liệu mở lại đúng mục đang làm dở (mục không thuộc quyền -> Báo cáo)
  let start = 'report';
  try { start = localStorage.getItem('tab') || start; } catch {}
  const macDinh = $('.topbar [data-tab="report"]') ? 'report' : $('.topbar [data-tab="revenue"]') ? 'revenue' : 'users'; // nhập liệu (không có Báo cáo) -> Doanh thu · IT -> Tài khoản
  showTab($(`.topbar [data-tab="${start}"]`) ? start : macDinh);
})();

function applyBranding(s) {
  $('#sys-name').textContent = s.ten_he_thong;
  $('#company').textContent = s.ten_cong_ty;
  applyFoot(s.ten_cong_ty);
  document.title = (META && META.moi_truong === 'staging' ? '[TEST] ' : '') + s.ten_he_thong;
}

// =====================================================================
// Tab
// =====================================================================
const loaders = { duyet: () => loadDuyet(), projects: loadProjects, revenue: loadRevenueTab, cost: loadCostTab, users: () => (can('tai_khoan') ? loadUsers() : Promise.resolve()).then(() => loadLogs()), settings: loadSettings, profile: async () => {}, contact: loadContact, report: () => { BST.chi_tiet = false; return loadReport(); } }; // mỗi lần vào tab Báo cáo: chi tiết ẩn

const NHAP_LIEU = ['projects', 'revenue', 'cost'];
// Menu Xuất: chọn xong một mục thì đóng menu
$('#xuat-grp .tab-menu')?.addEventListener('click', (e) => { if (e.target.closest('button')) setTimeout(closeMenus); });
// Chọn đơn vị tiền (toàn hệ thống): lưu theo trình duyệt rồi vẽ lại trang đang xem
if ($('#dv-pick')) {
  $('#dv-pick').value = DV_CHON;
  $('#dv-pick').addEventListener('change', (e) => {
    DV_CHON = DV[e.target.value] ? e.target.value : 'auto';
    try { localStorage.setItem('dv_tien', DV_CHON); } catch {}
    const cur = $$('main > .tab-panel').find((x) => !x.hidden)?.id.replace('tab-', '');
    if (cur === 'report' && typeof renderKeepPos === 'function') return renderKeepPos(null); // báo cáo: vẽ lại tại chỗ, giữ kỳ / mục đang mở
    const veHop = () => { // hộp chi tiết đang mở: vẽ lại theo đơn vị mới
      if ($('#tp-dlg')?.open && typeof renderTpDlg === 'function') renderTpDlg();
      if ($('#dc-dlg')?.open) renderDc();
      if ($('#qtdt-dlg')?.open) renderQtDt();
      if ($('#dtr-dlg')?.open) renderDtr();
    };
    if (cur && loaders[cur]) Promise.resolve(loaders[cur]()).then(veHop).catch((err) => alert(err.message));
  });
}
const closeMenus = () => $$('.tab-grp.open').forEach((g) => { g.classList.remove('open'); $('[data-grp-toggle]', g).setAttribute('aria-expanded', 'false'); });
function showTab(name) {
  if (ME?.role === 'viewer' && !$(`.topbar [data-tab="${name}"]`)) return;
  if (name === 'report' && !can('bao_cao')) return; // Báo cáo: chỉ Quản trị, Lãnh đạo, Ban Kiểm soát (và Chỉ xem) // Chỉ xem: không mở trang ngoài quyền (Dự án, Doanh thu, Chi phí…) dù bấm từ liên kết nào
  closeMenus();
  $$('.topbar [data-tab], #subnav [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-grp').forEach((g) => g.classList.toggle('active', Boolean($(`[data-tab="${name}"]`, g))));
  $('#subnav').hidden = !NHAP_LIEU.includes(name);
  if ($('#xuat-grp')) $('#xuat-grp').hidden = name !== 'report' || !can('xuat'); // nút Xuất chỉ hiện ở trang Báo cáo, vai có quyền xuất
  $$('main > .tab-panel').forEach((p) => (p.hidden = p.id !== 'tab-' + name));
  try { localStorage.setItem('tab', name); } catch {}
  return Promise.resolve(loaders[name]()).catch((err) => alert(err.message));
}
// Menu nhóm: bấm để mở / đóng; bấm mục con -> chuyển trang; bấm ra ngoài hoặc Esc -> đóng
document.addEventListener('click', (e) => {
  const tg = e.target.closest('[data-grp-toggle]');
  if (tg) {
    const g = tg.closest('.tab-grp'), open = !g.classList.contains('open');
    closeMenus();
    g.classList.toggle('open', open); tg.setAttribute('aria-expanded', String(open));
    return;
  }
  const t = e.target.closest('.topbar [data-tab], #subnav [data-tab]');
  if (t) return showTab(t.dataset.tab);
  if (!e.target.closest('.tab-menu')) closeMenus();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

// Tín hiệu trực tuyến: trang đang mở báo máy chủ mỗi 20 giây; đóng / tải lại trang báo ngoại tuyến ngay.
// Tab Tài khoản tự làm mới danh sách mỗi 10 giây (trạng thái do máy chủ tính, không phụ thuộc giờ máy người xem)
// Không thao tác (chuột, bàn phím, cuộn, chạm) quá 60 phút -> tự đăng xuất; tính chung mọi tab của trình duyệt.
const idleMs = () => (Number(META?.idle_phut) || 60) * 60 * 1000;
const AUTO = { headers: { 'X-Auto': '1' } };
let lastAct = Date.now(), actSent = 0;
const actStore = (t) => { try { localStorage.setItem('last_act', String(t)); } catch {} };
const actRead = () => { try { return Number(localStorage.getItem('last_act')) || 0; } catch { return 0; } };
['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => {
  const t = Date.now();
  if (t - lastAct > 5000) { lastAct = t; actStore(t); }
}, { passive: true, capture: true }));
actStore(lastAct);
const idleFor = () => Date.now() - Math.max(lastAct, actRead());
setInterval(async () => {
  if (idleFor() >= idleMs() - 60 * 1000) { // trước hạn máy chủ 1 phút để còn ghi nhật ký "Hết phiên"
    await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({ ly_do: 'het_phien' }) }).catch(() => {});
    location.href = '/login?het_phien=1';
    return;
  }
  // tín hiệu trực tuyến; có thao tác kể từ lần trước -> báo máy chủ gia hạn phiên
  const acted = Math.max(lastAct, actRead()) > actSent;
  if (acted) actSent = Date.now();
  api('/api/auth/me', acted ? {} : AUTO).catch(() => {});
}, 20 * 1000);
window.addEventListener('pagehide', () => {
  try { fetch('/api/auth/away', { method: 'POST', keepalive: true, headers: { 'X-Requested-With': 'fetch' } }); } catch {}
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') api('/api/auth/me', AUTO).catch(() => {}); });
setInterval(() => {
  if (document.visibilityState === 'visible' && !$('#tab-users')?.hidden && can('nhat_ky')) {
    if (can('tai_khoan')) loadUsers(true).catch(() => {});
    loadLogs(true).catch(() => {});
  }
}, 10 * 1000);

$('#btn-logout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/login';
});

// =====================================================================
// DỰ ÁN
// =====================================================================
const pForm = $('#p-form');
// Quyền theo nhóm thao tác – bảng QUYEN do máy chủ gửi (lib/validate.js): hd giá trị (QS) · tien tiền (Kế toán) · td/ns (Lãnh đạo) · nhat_ky (BKS)
const can = (k) => (META?.quyen?.[k] || []).includes(ME?.role);
const canEdit = () => can('hd') || can('tien');

let dash = { du_an: [] };
const dashById = () => new Map(dash.du_an.map((d) => [d.id, d]));
// Danh sách dự án: số liệu Thực hiện, trước VAT (xem đủ các lớp / VAT ở tab Báo cáo)
const DSTATE = { vat: 'gt', lop: 'th' };
const LOP = { dk: 'du_kien', th: 'thuc_hien' };
const lopOf = (d, lop = DSTATE.lop) => d[LOP[lop] || 'thuc_hien'];

async function loadProjects() {
  let tt;
  [projects, dash, tt] = await Promise.all([api('/api/du-an'), api('/api/dashboard'), api('/api/du-an-tinh-trang').catch(() => [])]);
  const m = new Map(tt.map((x) => [x.id, x.tt]));
  for (const r of projects) { r.trang_thai_nhap = r.trang_thai; if (m.has(r.id)) r.trang_thai = m.get(r.id); } // trạng thái tự động theo số liệu
  renderProjects();
}

function renderProjects() {
  const q = slug($('#p-search').value.trim());
  const rows = q ? projects.filter((r) => slug(`${r.ma_du_an} ${r.ten_du_an} ${r.chu_dau_tu}`).includes(q)) : projects;
  const cols = 8;
  // Tiến độ (ngày) = ngày kết thúc − ngày bắt đầu (như biểu mẫu dự án)
  const days = (r) => { if (!r.ngay_bat_dau || !r.ngay_ket_thuc) return '<span class="muted">—</span>';
    const n = Math.round((Date.parse(String(r.ngay_ket_thuc).slice(0, 10)) - Date.parse(String(r.ngay_bat_dau).slice(0, 10))) / 86400000);
    return Number.isFinite(n) ? `<b class="${n < 0 ? 'neg' : ''}">${n.toLocaleString('vi-VN')}</b> <span class="muted small">ngày</span>` : '<span class="muted">—</span>'; };
  $('#p-tbody').innerHTML = rows.length
    ? rows.map((r) => `
      <tr>
        <td><a href="#" class="p-open" data-brep="${r.id}" title="Xem báo cáo công trình"><b class="p-ma">${esc(r.ma_du_an)}</b></a></td>
        <td><a href="#" class="p-open" data-brep="${r.id}" title="Xem báo cáo công trình">${esc(r.ten_du_an)}</a></td>
        <td>${esc(r.chu_dau_tu)}</td>
        <td><span class="st st-${slug(r.trang_thai)}" title="Tự động theo số liệu${r.trang_thai_nhap === 'Tạm dừng' ? ' (đang chọn Tạm dừng)' : ''}">${esc(r.trang_thai)}</span></td>
        <td class="num">${days(r)}</td>
        <td class="small">${dmy(r.ngay_bat_dau)}${r.ngay_ket_thuc ? '<br>→ ' + dmy(r.ngay_ket_thuc) : ''}</td>
        <td class="muted">${esc(r.nguoi_cap_nhat || '')}</td>
        <td class="row-actions">
          ${can('hd') ? `<button data-edit="${r.id}">Sửa</button>
          ${can('xoa_da') ? `<button class="danger" data-del="${r.id}">Xóa</button>` : ''}` : ''}
        </td>
      </tr>`).join('')
    : `<tr><td colspan="${cols}" class="empty">Chưa có dữ liệu</td></tr>`;
}

// =====================================================================
// Tiện ích biểu đồ dùng chung (tab Báo cáo – public/report.js)
// =====================================================================
const SVGNS = 'http://www.w3.org/2000/svg';

// Số gọn cho trục / nhãn: 1,25 tỷ · 850 tr
function shortMoney(n) {
  const a = Math.abs(n);
  const f = (x) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: x >= 100 ? 0 : x >= 10 ? 1 : 2 }).format(x);
  if (a >= 1e9) return (n < 0 ? '-' : '') + f(a / 1e9) + ' tỷ';
  if (a >= 1e6) return (n < 0 ? '-' : '') + f(a / 1e6) + ' tr';
  return fmt.format(n);
}

// ---------- Tooltip dùng chung ----------
const tip = $('#d-tip');
function showTip(html, x, y) {
  tip.innerHTML = html;
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let left = x + 14, top = y + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top + h > window.innerHeight - 8) top = y - h - 14;
  tip.style.left = Math.max(8, left) + 'px';
  tip.style.top = Math.max(8, top) + 'px';
}
const hideTip = () => { tip.hidden = true; };

function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, val] of Object.entries(attrs)) el.setAttribute(k, val);
  if (parent) parent.appendChild(el);
  return el;
}

// Bước chia trục "đẹp"
function niceTicks(min, max, count = 5) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t));
  return ticks;
}

function resetProjectForm() {
  pForm.reset();
  pForm.elements.id.value = '';
  $('#p-form-title').textContent = 'Thêm dự án';
  pDays();
}

pForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = formData(pForm);
  const id = body.id;
  delete body.id;
  // Ô Tọa độ "vĩ độ, kinh độ" -> 2 trường vi_do, kinh_do (trống = chưa có vị trí)
  const td = String(body.toa_do || '').trim(); delete body.toa_do;
  if (td && !mapParse(td)) return showMsg($('#p-msg'), 'Tọa độ không hợp lệ. Nhập dạng: 16.0689, 108.2230 (hoặc bấm 📍 Chọn trên bản đồ)', 'err');
  [body.vi_do, body.kinh_do] = td ? mapParse(td) : [null, null];
  // Giá trị HĐ / Đã giải ngân nhập tay (cũ) đã thay bằng số liệu Doanh thu – Chi phí: giữ nguyên giá trị đang lưu
  const old = projects.find((x) => x.id === Number(id));
  body.gia_tri_hd = old ? old.gia_tri_hd : 0;
  body.da_giai_ngan = old ? old.da_giai_ngan : 0;
  try {
    const r = await api(id ? `/api/du-an/${id}` : '/api/du-an', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    showMsg($('#p-msg'), id ? 'Đã cập nhật dự án' : 'Đã thêm dự án');
    resetProjectForm();
    await loadProjects();
    // Thêm dự án mới xong -> chuyển sang Nhập liệu › Doanh thu của dự án đó để nhập tiếp HĐ
    if (!id && r?.id && !r.cho_duyet && can('hd')) {
      revProjectId = Number(r.id); revAll = false;
      try { localStorage.setItem('revProject', revProjectId); localStorage.setItem('revAll', '0'); } catch { /* chế độ riêng tư */ }
      await showTab('revenue');
      let m = $('#r-new-msg');
      if (!m) { m = document.createElement('div'); m.id = 'r-new-msg'; m.className = 'msg'; m.setAttribute('role', 'status'); $('#r-project-info')?.after(m); }
      showMsg(m, `✓ Đã thêm dự án ${body.ma_du_an || ''} – nhập HĐ / phụ lục với chủ đầu tư bên dưới`);
      setTimeout(() => showMsg(m, ''), 12000);
    }
  } catch (err) {
    showMsg($('#p-msg'), err.message, 'err');
  }
});
$('#p-map-pick')?.addEventListener('click', () => mapPicker(pForm.elements.toa_do));
// Tiến độ (ngày) = ngày kết thúc − ngày bắt đầu (tự tính, chỉ hiện)
function pDays() {
  const o = $('#p-days'); if (!o || !pForm) return;
  const a = pForm.elements.ngay_bat_dau?.value, b = pForm.elements.ngay_ket_thuc?.value;
  if (!a || !b) { o.textContent = '—'; o.title = 'Nhập đủ ngày bắt đầu và ngày kết thúc'; return; }
  const n = Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  o.textContent = Number.isFinite(n) ? `${n.toLocaleString('vi-VN')} ngày` : '—';
  o.classList.toggle('neg', n < 0); o.title = n < 0 ? 'Ngày kết thúc trước ngày bắt đầu' : '';
}
pForm?.addEventListener('input', pDays); pForm?.addEventListener('change', pDays);
$('#p-cancel')?.addEventListener('click', () => { resetProjectForm(); showMsg($('#p-msg'), ''); });
$('#p-search').addEventListener('input', renderProjects);

$('#p-tbody').addEventListener('click', async (e) => {
  const brep = e.target.closest('[data-brep]')?.dataset.brep;
  if (brep) {
    e.preventDefault();
    if (can('bao_cao')) return openProjectReport(Number(brep));
    revProjectId = Number(brep); revAll = false; // vai nhập liệu (không xem Báo cáo): mở Doanh thu của dự án
    try { localStorage.setItem('revProject', revProjectId); localStorage.setItem('revAll', '0'); } catch { /* bỏ qua */ }
    return showTab('revenue');
  }
  const { edit, del, rev, cost } = e.target.dataset;
  if (rev || cost) {
    revProjectId = Number(rev || cost);
    return showTab(rev ? 'revenue' : 'cost');
  }
  if (edit) {
    const r = projects.find((x) => x.id === Number(edit));
    if (!r) return;
    for (const [k, v] of Object.entries(r)) if (pForm.elements[k]) pForm.elements[k].value = v ?? '';
    if (pForm.elements.trang_thai) pForm.elements.trang_thai.value = r.trang_thai === 'Tạm dừng' ? 'Tạm dừng' : 'Đang thi công'; // khác Tạm dừng = Tự động
    pForm.elements.toa_do.value = r.vi_do != null && r.kinh_do != null ? mapFmt(Number(r.vi_do), Number(r.kinh_do)) : '';
    $('#p-form-title').textContent = 'Sửa dự án ' + r.ma_du_an;
    pDays();
    pForm.scrollIntoView({ behavior: 'smooth' });
  }
  if (del) { // xóa dự án = xóa toàn bộ dữ liệu liên quan -> hiện số dòng bị xóa và bắt buộc Passcode
    const r = projects.find((x) => x.id === Number(del));
    try {
      const x = await api(`/api/du-an/${del}/impact`);
      const pc = await askPasscode(`Xóa dự án ${r ? r.ma_du_an + ' – ' + r.ten_du_an : ''}?`,
        `Sẽ xóa vĩnh viễn kèm toàn bộ dữ liệu: ${x.hd_pl} dòng HĐ/PL, ${x.nt_qt} nghiệm thu/QT, ${x.tien_ve} tiền về, ${x.thau_phu} HĐ đầu vào – thầu phụ, vật tư, MMTB, nhân công (${x.tp_thanh_toan} thanh toán), ${x.chi_phi} chi phí, ${x.thoi_diem} thời điểm TĐ. Không hoàn tác được.`);
      if (pc === null) return;
      await api(`/api/du-an/${del}`, { method: 'DELETE', body: JSON.stringify({ passcode: pc }) });
      await loadProjects();
    } catch (err) {
      alert(err.message);
    }
  }
});

// Xuất CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt)
$('#p-csv').addEventListener('click', () => {
  const by = dashById();
  const v = DSTATE.vat;
  const vt = v === 'gt' ? ' (trước VAT)' : ' (sau VAT)';
  const head = ['Mã DA', 'Tên dự án', 'Chủ đầu tư', 'Số HĐ',
    'DT dự kiến' + vt, 'CP dự kiến' + vt, 'LN dự kiến' + vt, 'DT thực hiện' + vt, 'CP thực hiện' + vt, 'LN thực hiện' + vt,
    'Tiền về', 'Còn lại theo HĐ', 'Còn phải thu (theo nghiệm thu)', 'Tiến độ %', 'Trạng thái', 'Ngày bắt đầu', 'Ngày kết thúc'];
  const line = (r) => {
    const d = by.get(r.id);
    if (!d) return [r.ma_du_an, r.ten_du_an, r.chu_dau_tu, '', '', '', '', '', '', '', '', '', '', r.tien_do, r.trang_thai, r.ngay_bat_dau, r.ngay_ket_thuc];
    const k = d.du_kien, t = d.thuc_hien;
    return [r.ma_du_an, r.ten_du_an, r.chu_dau_tu, d.so_hd,
      k.doanh_thu[v], k.chi_phi[v], k.doanh_thu[v] - k.chi_phi[v], t.doanh_thu[v], t.chi_phi[v], t.doanh_thu[v] - t.chi_phi[v],
      d.tien_ve, k.con_lai, t.con_lai, r.tien_do, r.trang_thai, r.ngay_bat_dau, r.ngay_ket_thuc];
  };
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [head.map(q).join(','), ...projects.map((r) => line(r).map(q).join(','))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `du-an_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  logEvent('xuat_csv', `Danh sách dự án (${projects.length} dự án)`);
});

// Ghi nhật ký xuất báo cáo (không chặn thao tác nếu lỗi)
function logEvent(loai, pham_vi) {
  api('/api/nhat-ky/su-kien', { method: 'POST', body: JSON.stringify({ loai, pham_vi }) }).catch(() => {});
}

// =====================================================================
// DOANH THU theo công trình
// =====================================================================
// Công thức giống máy chủ (lib/revenue.js): Tiền VAT = làm tròn(Giá trị × VAT% / 100); VAT 0% = tạm tính
const REV_LABEL = {
  hd: { title: '1. Hợp đồng / Phụ lục', short: 'HĐ/PL', so: 'Số HĐ / Phụ lục *', soPh: '' },
  qt: { title: '2. Giá trị Hoàn thành / Quyết toán', short: 'HT/QT', so: 'Đợt / Hồ sơ HT/QT *', soPh: 'Nghiệm thu đợt 1, Quyết toán...' },
};
let revProjectId = null;
let revData = null;
try { revProjectId = Number(localStorage.getItem('revProject')) || null; } catch {}

const calcVat = (giaTri, vat) => {
  if (!vat || !giaTri) return 0;
  const g = BigInt(giaTri) * BigInt(vat);
  return Number((g + (g < 0n ? -50n : 50n)) / 100n);
};
const money = (n) => fmt.format(n);
// Số tiền hiển thị theo đơn vị đang chọn (mặc định đồng); khác đồng thì rê chuột xem số đồng đầy đủ
const dvm = (n, def = 'dong', autoD) => (dvKey(def) === 'dong' ? fmt.format(n || 0) : `<span title="${fmt.format(n || 0)} đồng">${dvNum(n, def, autoD)}</span>`);
const dvT = (n, def = 'dong') => dvNum(n, def) + (dvKey(def) === def ? '' : ' ' + dvU(def).ngan); // cho textContent (thẻ tổng)
const vatBadge = (vat) => (vat ? `${vat}%` : '<span class="muted" title="Chưa có VAT">0%</span>');

// Dựng 2 khối (HĐ/PL và HT/QT) từ một mẫu chung
// Doanh thu: "Tất cả dự án" = chỉ xem tổng hợp (ẩn form nhập, khóa sửa / xóa / nhập tiền về)
let revAll = (() => { try { return localStorage.getItem('revAll') === '1'; } catch { return false; } })();
const canRv = (k) => can(k) && !revAll;
function buildRevenueSections() {
  const wrap = $('#r-sections');
  if (wrap.dataset.built) return;
  wrap.dataset.built = '1';
  wrap.innerHTML = Object.entries(REV_LABEL).map(([loai, L]) => `
    <div class="card rev-card" data-loai="${loai}">
      ${loai === 'qt' ? `<div class="toolbar tv-head"><h2>${L.title}</h2><button type="button" class="sm" id="qt-toggle-all">Mở tất cả</button></div>` : `<h2>${L.title}</h2>`}
      ${loai === 'hd' ? '<div data-td-mode class="td-mode"></div><div class="msg" id="td-hd-msg" role="alert"></div>' : ''}
      ${can('hd') ? `
      <form class="grid-form rev-form" data-loai="${loai}" novalidate>
        <input type="hidden" name="id">
        ${loai === 'hd' ? `
        <label>Loại *<select name="ma_loai"></select></label>
        <label>Số mã HĐ *<input name="so_ma" maxlength="120" placeholder="Số mới: gõ · Số đã có: nhấp đúp" title="Số HĐ mới: gõ trực tiếp. Số HĐ đã có: nhấp đúp (hoặc phím ↓) để chọn, hệ thống tự chọn PL kế tiếp"><span class="calc-note so-preview"></span></label>` : `
        <label>${L.so}<input name="so_hieu" required maxlength="150" placeholder="${L.soPh}"></label>`}
        ${loai === 'qt' ? `<label>Số HĐ *<input name="hd_ref" placeholder="Gõ để tìm Số HĐ ở mục 1"><input type="hidden" name="hd_id"></label>` : ''}
        <label>Ngày<input name="ngay" class="date-dmy"></label>
        ${loai === 'hd' ? `
        <label title="TĐ1 – giá trị lúc ký HĐ / PL. Tăng / giảm sau khi ký: bấm ± Đợt ở dòng văn bản">Giá trị ký – TĐ1 (trước VAT) *<input name="gia_tri" class="money" required placeholder="0 · PL giảm: nhập số âm"></label>` : `
        <label>Giá trị ${L.short} (trước VAT) *<input name="gia_tri" class="money" required placeholder="0"></label>`}
        <label>VAT (%)<input name="vat" type="number" min="0" max="100" step="1" placeholder="0 = chưa có VAT"></label>
        <label>Giá trị ${L.short} (sau VAT)<output class="calc" name="sau_vat">0</output><span class="calc-note vat-note"></span></label>
        <label class="span-2">Ghi chú<input name="ghi_chu" maxlength="500"></label>
        <div class="actions">
          <button type="submit" class="primary">Thêm dòng</button>
          <button type="button" class="rev-cancel">Hủy</button>
        </div>
        <div class="msg" role="alert"></div>
      </form>` : ''}
      <div class="table-wrap">
        <table class="rev-table ${loai === 'hd' ? 'td-mode-tbl' : ''}">
          <thead><tr>
            <th class="num">#</th><th>${loai === 'hd' ? 'Số HĐ / Phụ lục' : 'Số HĐ / Đợt – Hồ sơ'}</th><th>${loai === 'hd' ? 'Ngày ký' : 'Ngày'}</th>
            ${loai === 'hd' ? `<th class="num td-col" title="Ký – giá trị lúc ký (trước VAT)">TĐ1</th><th class="num td-col" title="Điều chỉnh – TĐ1 + các đợt tăng / giảm (trước VAT)">TĐ2</th><th class="num td-col" title="Quyết toán – giá trị quyết toán (trước VAT). Chưa có = TĐ2">TĐ3</th><th class="num">VAT</th>`
              : '<th class="num">Trước VAT</th><th class="num">VAT</th><th class="num">Tiền VAT</th>'}
            <th class="num">Sau VAT</th><th>Ghi chú</th><th>Người cập nhật</th>${can('hd') ? '<th></th>' : ''}
          </tr></thead>
          <tbody></tbody>
          <tfoot></tfoot>
        </table>
      </div>
      ${loai === 'qt' && can('hd') ? `
      <div class="tv-tools qt-tools">
        <label class="tv-hd-pick">Thêm cho HĐ <select id="qt-hd-pick"></select></label>
        <button type="button" data-qtq="dot" title="Thêm đợt kế tiếp, tên theo hồ sơ đã có (VD Hoàn thành đợt 2 -> Hoàn thành đợt 3)">+ Đợt tiếp theo</button>
        <button type="button" data-qtq="qt">+ Quyết toán</button>
        <span class="muted small">Đã có đợt thanh toán / quyết toán: Giá trị hoàn thành = tổng lũy kế các đợt; chưa có: tính theo chi phí (cost to cost)</span>
      </div>` : ''}
    </div>`).join('');

  wrap.insertAdjacentHTML('beforeend', tienVeCardHtml());
  $$('.rev-form', wrap).forEach((f) => {
    attachMoneyInput(f.elements.gia_tri);
    attachDateInput(f.elements.ngay);
    if (f.elements.hd_ref) f._hdAc = attachAutocomplete(f.elements.hd_ref, f.elements.hd_id, hdOptions);
    if (f.elements.ma_loai) {
      attachQuickPicker(f.elements.so_ma, soMaOptions, (o) => pickExistingSoMa(f, o.value), 'Chưa có số HĐ nào – hãy gõ số mới');
      f.elements.ma_loai.addEventListener('change', () => { f._manualLoai = true; fillMaLoaiOptions(f); updateSoPreview(f); });
      f.elements.so_ma.addEventListener('input', () => syncMaLoai(f));
    }
    const update = () => updateRevPreview(f);
    f.elements.gia_tri.addEventListener('input', update);
    if (f.elements.td) { // Thuộc TĐ tự gợi ý theo loại (HĐ -> TĐ1, PL -> TĐ2) cho tới khi người dùng tự chọn
      f.elements.td.addEventListener('change', () => { f._manualTd = true; });
      const goiY = () => { if (!f._manualTd) f.elements.td.value = String(tdDangChon()); }; // theo TĐ đang chọn (nút TĐ1/TĐ2/TĐ3 – dùng chung với Báo cáo)
      f.elements.ma_loai?.addEventListener('change', goiY); f.elements.so_ma?.addEventListener('input', () => setTimeout(goiY, 0)); f._tdGoiY = goiY;
    }
    f.elements.vat.addEventListener('input', update);
    f.addEventListener('submit', (e) => { e.preventDefault(); saveRevenue(f); });
    $('.rev-cancel', f).addEventListener('click', () => resetRevForm(f));
  });
  wrap.addEventListener('click', onRevTableClick);
  // Nhấp đúp vào Số mã trong bảng mục 1 -> điền sẵn form với PL kế tiếp
  wrap.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.so-ma-pick');
    const f = $('.rev-form[data-loai="hd"]');
    if (!el || !f) return;
    window.getSelection?.().removeAllRanges();
    resetRevForm(f);
    pickExistingSoMa(f, el.dataset.soma);
    showMsg($('.msg', f), `Thêm ${f.elements.ma_loai.value} cho ${el.dataset.soma} – nhập giá trị rồi bấm Thêm dòng`);
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  bindTienVe();
}

// Tính trực tiếp Giá trị sau VAT khi đang nhập
function updateRevPreview(f) {
  const raw = parseMoney(f.elements.gia_tri.value);
  const gt = raw && raw !== '-' ? Number(raw) : 0;
  const vatStr = f.elements.vat.value.trim();
  const vat = vatStr === '' ? 0 : Number(vatStr);
  const out = f.elements.sau_vat;
  const note = $('.vat-note', f);
  if (!Number.isInteger(vat) || vat < 0 || vat > 100) {
    out.value = '—';
    note.textContent = 'VAT phải là số nguyên 0–100';
    note.className = 'calc-note vat-note err';
    return;
  }
  const tv = calcVat(gt, vat);
  out.value = money(gt + tv);
  note.textContent = vat ? `Tiền VAT: ${money(tv)}` : 'Chưa có VAT';
  note.className = 'calc-note vat-note' + (vat ? '' : ' warn');
}

// Danh sách gợi ý Số HĐ/PL = các dòng ở mục 1 của công trình đang chọn
// Chỉ gợi ý hợp đồng gốc (HĐ); giá trị hiển thị = HĐ tổng (HĐ + các PL cùng Số mã)
function hdOptions() {
  const rows = (revData?.items || []).filter((r) => r.loai === 'hd');
  return hdGroups(rows).filter((g) => g.head).map((g) => {
    const tong = [g.head, ...g.pls].reduce((s, r) => s + r.sau_vat, 0);
    return {
      id: g.head.id,
      label: g.head.so_hieu,
      sub: `HĐ tổng ${money(tong)} đ sau VAT${g.pls.length ? ` (gồm ${g.pls.length} PL)` : ''}${g.head.ngay ? ' · ' + dmy(g.head.ngay) : ''}`,
    };
  });
}

// Ô chọn Loại: HĐ, PL01, PL02...; "(đã có)" tính theo Số mã đang nhập
function hdRows() { return (revData?.items || []).filter((r) => r.loai === 'hd'); }
function fillMaLoaiOptions(f, keep) {
  const cur = keep ?? f.elements.ma_loai.value;
  const so = normVn(f.elements.so_ma.value);
  const same = so ? hdRows().filter((r) => normVn(r.so_ma) === so && r.id !== Number(f.elements.id.value)) : [];
  const plNum = (l) => (String(l || '').startsWith('PL') ? Number(l.slice(2)) : 0);
  const n = Math.max(10, Math.max(0, ...same.map((r) => plNum(r.ma_loai)), plNum(cur)) + 5);
  const used = new Set(same.map((r) => r.ma_loai));
  const opts = ['HĐ', ...Array.from({ length: n }, (_, i) => 'PL' + String(i + 1).padStart(2, '0'))];
  f.elements.ma_loai.innerHTML = opts.map((o) => `<option value="${o}">${o}${used.has(o) ? ' (đã có)' : ''}</option>`).join('');
  if (cur) f.elements.ma_loai.value = cur;
}
// Loại tự theo Số mã: số mới -> HĐ; số đã có -> PL kế tiếp (trừ khi người dùng đã tự chọn Loại)
function syncMaLoai(f) {
  if (f.elements.id.value) return updateSoPreview(f);
  const so = f.elements.so_ma.value.trim();
  const auto = so ? nextPlFor(so) : 'HĐ';
  fillMaLoaiOptions(f, f._manualLoai ? f.elements.ma_loai.value : auto);
  updateSoPreview(f);
}
// Danh sách Số mã HĐ đã có (để nhấp đúp chọn lại, tránh gõ sai)
function soMaOptions() {
  return hdGroups(hdRows()).map((g) => {
    const tong = [g.head, ...g.pls].filter(Boolean).reduce((s, r) => s + r.sau_vat, 0);
    const pls = g.pls.map((r) => r.ma_loai).join(', ');
    return {
      value: g.so_ma,
      label: g.so_ma,
      sub: `${g.head ? 'Có HĐ' : 'Chưa có HĐ gốc'}${pls ? ' · ' + pls : ''} · Tổng ${money(tong)} đ sau VAT · Tiếp theo: ${nextPlFor(g.so_ma)}`,
    };
  });
}
// PL kế tiếp của một Số mã: chưa có HĐ gốc -> HĐ; có rồi -> PL lớn nhất + 1
function nextPlFor(soMa) {
  const rows = hdRows().filter((r) => normVn(r.so_ma) === normVn(soMa));
  if (!rows.some((r) => r.ma_loai === 'HĐ')) return 'HĐ';
  const maxPl = Math.max(0, ...rows.map((r) => (r.ma_loai || '').startsWith('PL') ? Number(r.ma_loai.slice(2)) : 0));
  return 'PL' + String(maxPl + 1).padStart(2, '0');
}
function pickExistingSoMa(f, soMa) {
  f._manualLoai = false;
  f.elements.so_ma.value = soMa;
  syncMaLoai(f);
  f._tdGoiY?.();
  f.elements.gia_tri.focus({ preventScroll: true });
}
// Văn bản HĐ / PL đã có (cùng Số mã + Loại) – nhập ở form mới = ghi điều chỉnh TĐ2 cho văn bản đó
const vbDaCo = (f) => (f.elements.id.value ? null : hdRows().find((r) => normVn(r.so_ma) === normVn(f.elements.so_ma.value) && r.ma_loai === f.elements.ma_loai.value) || null);
function updateSoPreview(f) {
  const so = f.elements.so_ma.value.trim(), co = so && vbDaCo(f);
  const el = $('.so-preview', f);
  el.innerHTML = !so ? '' : co ? `<b class="warn-text">${esc(co.so_hieu)} đã có</b> – số nhập sẽ ghi thành <b>điều chỉnh TĐ2</b> (+ tăng / − giảm)` : `Hiển thị: ${esc(f.elements.ma_loai.value)} ${esc(so)}`;
  if (!f.elements.id.value) $('button[type=submit]', f).textContent = co ? 'Ghi điều chỉnh → TĐ2' : 'Thêm dòng';
}

function resetRevForm(f) {
  f.reset();
  f.elements.id.value = '';
  if (f._hdAc) f._hdAc.clear();
  if (f.elements.ma_loai) {
    f._manualLoai = false;
    syncMaLoai(f);
  }
  $('button[type=submit]', f).textContent = 'Thêm dòng';
  showMsg($('.msg', f), '');
  f._manualTd = false; f._tdGoiY?.();
  updateRevPreview(f);
}

async function loadRevenueTab() {
  buildRevenueSections();
  projects = await api('/api/du-an');
  const sel = $('#r-project');
  $('#r-empty').hidden = projects.length > 0;
  $('#r-body').hidden = true;
  sel.hidden = !projects.length;
  if (!projects.length) return;
  if (!projects.some((p) => p.id === revProjectId)) revProjectId = projects[0].id;
  sel.innerHTML = `<option value="all">Tất cả dự án (${projects.length}) – chỉ xem tổng hợp</option>` +
    projects.map((p) => `<option value="${p.id}">${esc(p.ma_du_an)} – ${esc(p.ten_du_an)}</option>`).join('');
  sel.value = revAll ? 'all' : revProjectId;
  await loadRevenue();
}

$('#r-project').addEventListener('change', (e) => {
  revAll = e.target.value === 'all';
  try { localStorage.setItem('revAll', revAll ? '1' : ''); } catch {}
  if (!revAll) { revProjectId = Number(e.target.value); costAll = false; try { localStorage.setItem('costAll', ''); } catch {} if (can('bao_cao')) baoCaoTheoDuAn(revProjectId); } // đồng bộ Chi phí + Báo cáo
  loadRevenue().catch((err) => alert(err.message));
});

let tvProject = null;
async function loadRevenue() {
  if (!revAll) try { localStorage.setItem('revProject', revProjectId); } catch {}
  const key = revAll ? 'all' : revProjectId;
  if (tvProject !== key) {
    // Đổi công trình: bỏ dữ liệu đang nhập dở của công trình trước
    tvProject = key;
    tvDrafts = null;
    tvEdits = {};
    $$('.rev-form').forEach(resetRevForm);
  }
  revData = await api(revAll ? '/api/doanh-thu-tong' : `/api/du-an/${revProjectId}/doanh-thu`);
  const p = revData.du_an;
  $('#r-project-info').innerHTML = revAll
    ? `<b>Tổng hợp ${revData.so_du_an} dự án</b> · chỉ xem – muốn nhập, sửa doanh thu hãy chọn từng dự án`
    : `Mã: <b>${esc(p.ma_du_an)}</b> · Chủ đầu tư: <b>${esc(p.chu_dau_tu || '—')}</b>`;
  $('#tab-revenue').classList.toggle('rev-all', revAll);
  $('#r-body').hidden = false;
  renderRevenue();
  // Cập nhật ô chọn Loại theo dữ liệu mới, không xóa nội dung đang nhập
  const fHd = $('.rev-form[data-loai="hd"]');
  if (fHd && !fHd.elements.id.value) syncMaLoai(fHd);
}

// Tên đợt kế tiếp của 1 HĐ theo tên hồ sơ đã nhập (bỏ hồ sơ "Quyết toán"): "Hoàn thành đợt 2" -> "Hoàn thành đợt 3";
//  chưa có đợt nào -> "Hoàn thành đợt 1"
function tenDotKeTiep(hdId) {
  const ds = revData.items.filter((r) => r.loai === 'qt' && r.hd_id === hdId && !/quy[eế]t to[aá]n/i.test(r.so_hieu || ''));
  const coSo = ds.map((r) => String(r.so_hieu || '').trim().match(/^(.*?)(\d+)$/)).filter(Boolean);
  if (!coSo.length) return `Hoàn thành đợt ${ds.length + 1}`;
  const cuoi = ds.map((r, i) => ({ r, i })).filter((x) => /\d+$/.test(String(x.r.so_hieu || '').trim())).pop().r; // hồ sơ có số nhập sau cùng
  const tien = String(cuoi.so_hieu).trim().match(/^(.*?)(\d+)$/)[1];
  const max = Math.max(...coSo.filter((m) => m[1] === tien).map((m) => Number(m[2])));
  return `${tien}${max + 1}`;
}
// ---------- Thời điểm đang làm việc (TĐ1 / TĐ2 / TĐ3) – dùng chung Báo cáo (BST.i_td) và Nhập liệu ----------
const TD_PICK = [[1, 'Ký HĐ'], [2, 'Điều chỉnh'], [3, 'Quyết toán']];
const tdDangChon = () => { const n = Number(typeof BST !== 'undefined' ? BST.i_td : 1); return [1, 2, 3].includes(n) ? n : 1; };
// Chế độ nhập theo TĐ đang chọn: TĐ1 giá trị ký · TĐ2 điều chỉnh (nhiều lần) · TĐ3 số quyết toán (có số = khoá)
const TD_MODE_TXT = {
  1: '<b>TĐ1 – Giá trị ký ban đầu:</b> thêm / sửa HĐ, PL với giá trị lúc ký. Không ảnh hưởng TĐ2, TĐ3.',
  2: '<b>TĐ2 – Điều chỉnh:</b> bấm <b>± Điều chỉnh</b> ở văn bản để nhập tăng / giảm hoặc chốt giá trị mới – nhập được nhiều lần (mỗi lần 1 đợt). Chưa điều chỉnh = TĐ1.',
  3: '<b>TĐ3 – Quyết toán:</b> nhập số quyết toán từng HĐ / PL. Có số = <b>khoá</b> văn bản (cả TĐ1, TĐ2); HĐ và mọi PL có số = <b>đóng</b> HĐ. Chưa có số = TĐ2, vẫn nhập tiếp được. Mở khoá cần Passcode.',
};
function renderTdMode() {
  const k = tdDangChon();
  $$('[data-td-mode]').forEach((el) => { el.innerHTML = TD_MODE_TXT[k]; el.className = 'td-mode td-mode-' + k; });
}
function renderTdPick() {
  renderTdMode();
  const n = tdDangChon();
  $$('[data-td-pick]').forEach((el) => {
    el.innerHTML = TD_PICK.map(([k, t]) => `<button type="button" data-tdpick="${k}" class="${k === n ? 'on' : ''}" title="Đang nhập cho TĐ${k} – ${t}. Dùng chung với Báo cáo"><b>TĐ${k}</b> ${t}</button>`).join('');
  });
}
// Chọn TĐ ở Nhập liệu: đổi luôn TĐ của Báo cáo; ô "Thuộc thời điểm" của dòng mới nhảy theo
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tdpick]'); if (!b) return;
  BST.i_td = Number(b.dataset.tdpick); try { bSave(); } catch { /* chưa tải Báo cáo */ }
  renderTdPick();
  $$('.rev-form[data-loai="hd"]').forEach((f) => { if (!f.elements.id.value) { f._manualTd = false; f._tdGoiY?.(); } });
  if (cForm?.elements.td && !cForm.elements.id.value) cForm.elements.td.value = String(tdDangChon());
  const tab = ['revenue', 'cost'].find((x) => !$('#tab-' + x).hidden);
  if (cForm && tab === 'cost') setCostMode();
  showMsg($(tab === 'cost' ? '#c-msg' : '#r-new-msg') || document.createElement('div'), '');
  // đổi chế độ nhập: vẽ lại bảng + hộp chi tiết đang mở
  if (tab === 'revenue' && revData) renderRevenue();
  if (tab === 'cost' && costData) renderCost();
  if ($('#tp-dlg')?.open) renderTpDlg();
  if ($('#dc-dlg')?.open) renderDc();
  if ($('#dtr-dlg')?.open) renderDtr();
});
function renderRevenue() {
  renderTdPick();
  const { items, tong } = revData;
  { // Mục 2: ô chọn HĐ cho thanh "Thêm cho HĐ" (+ Đợt thanh toán / + Quyết toán)
    const pick = $('#qt-hd-pick');
    if (pick) {
      const heads = items.filter((r) => r.loai === 'hd' && r.ma_loai === 'HĐ'), keep = Number(pick.value);
      pick.innerHTML = heads.map((h) => `<option value="${h.id}">${esc(h.so_hieu)}</option>`).join('');
      if (heads.some((h) => h.id === keep)) pick.value = keep;
      pick.closest('.qt-tools').hidden = revAll || !heads.length;
    }
  }
  const hd = tong.hd, qt = tong.qt;
  $('#r-k-hd').textContent = dvT(hd.sau_vat);
  $('#r-k-hd-sub').innerHTML = `${hd.so_dong} dòng${hd.tam_tinh ? ' · <span class="warn-text" title="HĐ chưa quyết toán">có HĐ tạm tính</span>' : ''}`;
  $('#r-k-qt').textContent = dvT(qt.sau_vat);
  $('#r-k-qt-sub').innerHTML = `${qt.so_dong} dòng`;
  const tv = revData.tong_tien_ve;
  $('#r-k-tv').textContent = dvT(tv.tong);
  $('#r-k-tv-sub').textContent = `Tạm ứng ${dvT(tv.tam_ung)} · Thanh toán ${dvT(tv.thanh_toan)} · Quyết toán ${dvT(tv.quyet_toan)}`;

  for (const loai of Object.keys(REV_LABEL)) {
    const cols = (canRv('hd') ? 10 : 9) + (loai === 'hd' ? 1 : 0);
    const card = $(`.rev-card[data-loai="${loai}"]`);
    const rows = items.filter((r) => r.loai === loai);
    if (loai === 'hd') {
      const f = $('.rev-form', card); if (f) f.hidden = canRv('hd') && tdDangChon() !== 1;
      $('table', card).dataset.tdOn = tdDangChon();
      $('tbody', card).innerHTML = rows.length ? hdGroupsHtml(rows) : `<tr><td colspan="${cols}" class="empty">Chưa có dữ liệu</td></tr>`;
    } else $('tbody', card).innerHTML = rows.length ? qtGroupsHtml(rows) : `<tr><td colspan="${cols}" class="empty">Chưa có dữ liệu</td></tr>`;
    const t = tong[loai];
    if (loai === 'hd') {
      const gs = hdGroups(rows), t1 = gs.reduce((a, g) => a + grpTd(g).t1, 0), t2 = gs.reduce((a, g) => a + grpTd(g).t2, 0), t3 = gs.reduce((a, g) => a + grpTd(g).t3, 0);
      $('tfoot', card).innerHTML = `
      <tr>
        <td></td><td colspan="2">TỔNG ${REV_LABEL[loai].short}${t.tam_tinh ? ' <span class="st st-tam-tinh" title="Có HĐ chưa quyết toán">Có tạm tính</span>' : ''}</td>
        <td class="num">${dvm(t1)}</td><td class="num">${dvm(t2)}${tdDelta(t2, t1)}</td><td class="num">${dvm(t3)}${tdDelta(t3, t2)}</td><td></td>
        <td class="num">${dvm(t.sau_vat)}<div class="td-note">tại TĐ2</div></td>
        <td colspan="${canRv('hd') ? 3 : 2}"></td>
      </tr>`;
      $$('input.qt-in', card).forEach(attachMoneyInput);
      continue;
    }
    $('tfoot', card).innerHTML = `
      <tr>
        <td></td><td colspan="2">TỔNG ${REV_LABEL[loai].short}${t.tam_tinh ? ' <span class="st st-tam-tinh" title="Có HĐ chưa quyết toán">Có tạm tính</span>' : ''}</td>
        <td class="num">${dvm(t.gia_tri)}</td><td></td>
        <td class="num">${dvm(t.tien_vat)}</td>
        <td class="num">${dvm(t.sau_vat)}</td>
        <td colspan="${canRv('hd') ? 3 : 2}"></td>
      </tr>`;
  }
  updateQtToggleAll();
  renderTienVe();
}

// ---------- Mục 2: gộp HT/QT theo hợp đồng (dòng tổng HĐ, các đợt là tập con, mặc định thu gọn) ----------
const qtOpen = new Set();
function qtGroupList(rows) {
  const heads = tvHeads();
  const order = new Map(heads.map((h, i) => [h.id, i]));
  const groups = new Map();
  for (const r of rows) {
    const k = r.hd_id && order.has(r.hd_id) ? r.hd_id : 0; // 0 = chưa gắn HĐ (dữ liệu cũ)
    if (!groups.has(k)) groups.set(k, { k, head: heads.find((h) => h.id === k) || null, rows: [] });
    groups.get(k).rows.push(r);
  }
  // Trong 1 HĐ: các đợt theo số thứ tự (đợt 2 trước đợt 10), Quyết toán luôn ở cuối, rồi theo ngày
  const coll = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
  const isQt = (r) => normVn(r.so_hieu).includes('quyet toan');
  for (const g of groups.values()) {
    g.rows.sort((a, b) => isQt(a) - isQt(b) || coll.compare(a.so_hieu, b.so_hieu) ||
      String(a.ngay || '9999').localeCompare(String(b.ngay || '9999')) || a.id - b.id);
  }
  return [...groups.values()].sort((a, b) => (a.k ? order.get(a.k) : 1e6) - (b.k ? order.get(b.k) : 1e6));
}
function qtGroupsHtml(rows) {
  const edit = canRv('hd');
  // Giá trị HĐ (gồm PL, sau VAT) của từng HĐ để tính % đã nghiệm thu
  const hdVal = new Map();
  for (const g of hdGroups(revData.items.filter((r) => r.loai === 'hd'))) {
    if (g.head) hdVal.set(g.head.id, [g.head, ...g.pls].reduce((s, r) => s + r.sau_vat, 0));
  }
  return qtGroupList(rows).map((g, gi) => {
    const n = gi + 1;
    const open = !g.k || qtOpen.has(g.k);
    const sum = (f) => g.rows.reduce((s, r) => s + r[f], 0);
    const daQt = g.rows.some((r) => normVn(r.so_hieu).includes('quyet toan'));
    const tamTinh = g.rows.some((r) => r.tam_tinh);
    const base = hdVal.get(g.k);
    const pctHd = base ? ` · đạt ${(sum('sau_vat') / base * 100).toFixed(1).replace('.', ',')}% giá trị HĐ` : '';
    const head = `<tr class="tv-head-row ${g.k ? '' : 'tv-sub-warn'}">
      <td class="num">${n}</td>
      <td>${g.k ? `<button class="grp-toggle" data-qtgrp="${g.k}" title="${open ? 'Thu gọn' : 'Mở chi tiết'}">${open ? '▾' : '▸'}</button>
        <span class="kind-tag kind-hd">HĐ</span> <b>${esc(g.head.so_ma || g.head.so_hieu)}</b>` : '<span class="st st-tam-tinh">Chưa gắn HĐ</span>'}
        <span class="muted small">(${g.rows.length} đợt)</span>
        ${daQt ? ' <span class="st st-hoan-thanh">Đã quyết toán</span>' : ''}${tamTinh ? ' <span class="st st-tam-tinh">Có tạm tính</span>' : ''}</td>
      <td></td>
      <td class="num strong">${dvm(sum('gia_tri'))}</td><td></td>
      <td class="num strong">${dvm(sum('tien_vat'))}</td>
      <td class="num tv-head-sum">${dvm(sum('sau_vat'))}</td>
      <td colspan="2" class="muted small">${g.rows.length} đợt${pctHd}</td>
      ${edit ? `<td class="row-actions">${g.k && !daQt ? `<button class="sm" data-qtadd="${g.k}" title="Thêm đợt nghiệm thu / quyết toán cho HĐ này">+ Đợt</button>` : ''}</td>` : ''}
    </tr>`;
    return head + (open ? g.rows.map((r, i) => `
      <tr class="tv-child" data-rid="${r.id}">
        <td class="num muted">${n}.${i + 1}</td>
        <td class="indent"><span class="tree">└</span><b>${esc(r.so_hieu)}</b></td>
        <td>${dmy(r.ngay)}</td>
        <td class="num">${dvm(r.gia_tri)}</td>
        <td class="num">${vatBadge(r.vat)}</td>
        <td class="num">${dvm(r.tien_vat)}</td>
        <td class="num strong">${dvm(r.sau_vat)}</td>
        <td class="wrap">${esc(r.ghi_chu)}</td>
        <td class="muted">${esc(r.nguoi_cap_nhat || '')}</td>
        ${edit ? `<td class="row-actions"><button data-redit="${r.id}">Sửa</button><button class="danger" data-rdel="${r.id}">Xóa</button></td>` : ''}
      </tr>`).join('') : '');
  }).join('');
}
function updateQtToggleAll() {
  const btn = $('#qt-toggle-all');
  if (!btn) return;
  const ks = qtGroupList(revData.items.filter((r) => r.loai === 'qt')).map((g) => g.k).filter(Boolean);
  btn.hidden = !ks.length;
  btn.textContent = ks.some((k) => !qtOpen.has(k)) ? 'Mở tất cả' : 'Thu gọn tất cả';
}

// ---------- Mục 1: nhóm PL theo Số mã HĐ (HĐ là dòng cha, PL là tập con) ----------
const hdCollapsed = new Set();
const hdKey = (r) => normVn(r.so_ma || r.so_hieu);

function hdGroups(rows) {
  const map = new Map();
  for (const r of rows) {           // rows đã sắp: HĐ trước, PL01, PL02...
    const k = hdKey(r);
    if (!map.has(k)) map.set(k, { key: k, so_ma: r.so_ma || r.so_hieu, head: null, pls: [] });
    const g = map.get(k);
    if (r.ma_loai === 'HĐ' && !g.head) g.head = r; else g.pls.push(r);
  }
  // Trong 1 HĐ: phụ lục theo ngày ký, rồi số PL
  const so = (m) => (String(m || '').startsWith('PL') ? Number(String(m).slice(2)) || 0 : 0);
  for (const g of map.values()) g.pls.sort((a, b) => String(a.ngay || '9999').localeCompare(String(b.ngay || '9999')) || so(a.ma_loai) - so(b.ma_loai));
  // Nhóm có HĐ đứng trước (theo ngày HĐ), nhóm chỉ có PL (chưa có HĐ) xếp sau
  return [...map.values()].sort((a, b) =>
    (a.head ? 0 : 1) - (b.head ? 0 : 1) ||
    String(a.head?.ngay || '9999').localeCompare(String(b.head?.ngay || '9999')) ||
    (a.head?.id || a.pls[0].id) - (b.head?.id || b.pls[0].id));
}

// Đợt A – mỗi văn bản HĐ / PL có 3 thời điểm độc lập: TĐ1 ký · TĐ2 = TĐ1 + các đợt điều chỉnh · TĐ3 = quyết toán (chưa có = TĐ2)
const nnV = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
const vbTd = (r) => { const t1 = Number(r.gia_tri_ky ?? r.gia_tri) || 0, t2 = Number(r.gia_tri) || 0, q = nnV(r.gt_qt); return { t1, t2, t3: q ?? t2, coQt: q !== null }; };
// Mũi tên chênh lệch so với thời điểm trước (bằng nhau: không ghi gì)
const tdDelta = (v, truoc) => { const d = Math.round(v - truoc); return d ? `<div class="td-note ${d > 0 ? 'td-up' : 'td-down'}">${d > 0 ? '▲ +' : '▼ '}${dvm(d)}</div>` : ''; };
// Dòng thuộc HĐ đã chốt quyết toán (khoá toàn bộ HĐ)
const hdKhoa = (r) => r && r.loai === 'hd' && revData.items.some((h) => h.loai === 'hd' && h.ma_loai === 'HĐ' && h.qt_dong && hdKey(h) === hdKey(r));
function hdRowHtml(r, stt, { child = false, toggle = '', head = null, g = null } = {}) {
  const x = vbTd(r), dong = head?.qt_dong || r.qt_dong, khoa = hdKhoa(r) || x.coQt, md = tdDangChon();
  const ds = r.dot || [];
  const thieu = dong && !x.coQt;
  const t3 = !child && g && !g.pls.length ? grpTd(g).t3 : x.t3; // HĐ không có PL: TĐ3 theo cả HĐ (kể cả hồ sơ QT cũ ở mục 2)
  const qtTag = !child && r.qt_dong ? ` <span class="st st-hoan-thanh" title="HĐ và mọi PL đã có số quyết toán – đã đóng (khoá toàn bộ)">🔒 Đã đóng QT${r.ngay_qt ? ' ' + dmy(r.ngay_qt) : ''}</span>` : '';
  return `
    <tr class="${child ? 'hd-child' : 'hd-head'}" data-rid="${r.id}" ${child ? `data-grp-child="${esc(hdKey(r))}"` : ''}>
      <td class="num muted">${stt}</td>
      <td class="${child ? 'indent' : ''}">${toggle}${child ? '<span class="tree">└</span>' : ''}<span class="kind-tag ${r.ma_loai === 'HĐ' ? 'kind-hd' : ''}">${esc(r.ma_loai || '')}</span> ${can('hd') ? `<b class="so-ma-pick" data-soma="${esc(r.so_ma || '')}" title="Nhấp đúp để thêm phụ lục cho ${esc(r.so_ma || '')}">${esc(r.so_ma || r.so_hieu)}</b>` : `<b>${esc(r.so_ma || r.so_hieu)}</b>`}${qtTag}${!child && r.tam_tinh ? ' <span class="st st-tam-tinh" title="HĐ chưa quyết toán – giá trị tạm tính">Tạm tính</span>' : ''}</td>
      <td>${dmy(r.ngay)}</td>
      <td class="num">${dvm(x.t1)}</td>
      <td class="num">${canRv('hd') && md === 2 && !khoa ? `<button type="button" class="link-btn" data-rdot="${r.id}" title="Xem / thêm điều chỉnh">${dvm(x.t2)}</button>` : dvm(x.t2)}${tdDelta(x.t2, x.t1)}${ds.length ? `<div class="td-note muted">${ds.length} đợt</div>` : ''}</td>
      <td class="num ${x.coQt || (g && !g.pls.length && t3 !== x.t2) ? '' : 'muted'}">${canRv('hd') && md === 3 && !x.coQt && !hdKhoa(r)
        ? `<input class="money num qt-in" data-qtin="${r.id}" placeholder="${dvNum(x.t2, 'dong')}" title="Nhập số quyết toán (đồng, trước VAT). Lưu xong văn bản bị khoá">`
        : `${x.coQt ? '🔒 ' : ''}${dvm(t3)}`}${tdDelta(t3, x.t2)}${thieu ? '<div class="td-note warn-text" title="Đã đóng quyết toán nhưng văn bản này chưa có số quyết toán – tạm lấy TĐ2">⚠ chưa có số QT</div>' : ''}</td>
      <td class="num">${vatBadge(r.vat)}</td>
      <td class="num strong">${dvm(r.sau_vat)}</td>
      <td class="wrap">${esc(r.ghi_chu)}</td>
      <td class="muted">${esc(r.nguoi_cap_nhat || '')}</td>
      ${canRv('hd') ? `<td class="row-actions">${khoa
        ? (md === 3 && x.coQt ? `<button data-rmokhoa="${r.id}" title="Bỏ số quyết toán để sửa lại (cần Passcode)">🔓 Mở khoá</button>` : '<span class="muted small" title="Đã có số quyết toán – khoá văn bản (TĐ1, TĐ2, TĐ3)">🔒 Khoá</span>')
        : md === 1 ? `<button data-redit="${r.id}">Sửa</button><button class="danger" data-rdel="${r.id}">Xóa</button>`
          : md === 2 ? `<button data-rdot="${r.id}" title="Nhập tăng / giảm hoặc chốt giá trị mới (TĐ2)">± Điều chỉnh</button>`
            : `<button class="primary" data-rqtsave="${r.id}" title="Lưu số quyết toán – văn bản sẽ bị khoá">Lưu QT</button>`}</td>` : ''}
    </tr>${ds.map((d, k) => `
    <tr class="dc-row" ${child ? `data-grp-child="${esc(hdKey(r))}"` : ''}>
      <td></td><td class="indent${child ? '2' : ''}" colspan="3"><span class="tree">↳</span> Đợt ${k + 1}${d.ngay ? ' · ' + dmy(d.ngay) : ''}${d.noi_dung ? ' · ' + esc(d.noi_dung) : ''}</td>
      <td class="num ${Number(d.so_tien) > 0 ? 'td-up' : 'td-down'}">${Number(d.so_tien) > 0 ? '+' : ''}${dvm(d.so_tien)}</td>
      <td colspan="${canRv('hd') ? 6 : 5}"></td>
    </tr>`).join('')}`;
}
// TĐ1 / TĐ2 / TĐ3 của 1 HĐ (HĐ + các PL) – cùng cách tính với Báo cáo
function grpTd(g) {
  const ms = [g.head, ...g.pls].filter(Boolean).map(vbTd);
  const t1 = ms.reduce((a, x) => a + x.t1, 0), t2 = ms.reduce((a, x) => a + x.t2, 0);
  const cu = g.head && !g.head.qt_dong && !ms.some((x) => x.coQt) ? k3Qt(g) : null; // dữ liệu cũ: TĐ3 = hồ sơ quyết toán ở mục 2
  const t3 = cu !== null ? cu : ms.reduce((a, x) => a + x.t3, 0);
  return { t1, t2, t3, cu: cu !== null, thieu: g.head?.qt_dong ? ms.filter((x) => !x.coQt).length : 0 };
}
// TĐ3 của 1 HĐ khi đã có hồ sơ quyết toán ở mục 2: tổng các đợt HT/QT của HĐ (như Báo cáo); chưa quyết toán -> null
function k3Qt(g) {
  if (!g.head) return null;
  const qts = revData.items.filter((q) => q.loai === 'qt' && q.hd_id === g.head.id);
  const daQt = qts.some((q) => /quy[eế]t to[aá]n/i.test(q.so_hieu || '')) || (revData.tien_ve || []).some((t) => t.hd_id === g.head.id && t.loai === 'quyet_toan');
  return daQt && qts.length ? qts.reduce((a, q) => a + q.gia_tri, 0) : null;
}
function hdGroupsHtml(rows) {
  return hdGroups(rows).map((g, gi) => {
    const n = gi + 1;
    const members = [g.head, ...g.pls].filter(Boolean);
    const closed = hdCollapsed.has(g.key);
    const toggle = g.pls.length
      ? `<button class="grp-toggle" data-grp="${esc(g.key)}" title="${closed ? 'Mở' : 'Thu gọn'} phụ lục">${closed ? '▸' : '▾'}</button>`
      : '<span class="grp-toggle-sp"></span>';
    let html = '';
    if (g.head) html += hdRowHtml(g.head, n, { toggle, g });
    else html += `<tr class="hd-head hd-orphan"><td class="num muted">${n}</td><td colspan="${canRv('hd') ? 10 : 9}">${toggle}${canRv('hd') ? `<b class="so-ma-pick" data-soma="${esc(g.so_ma)}" title="Nhấp đúp để thêm dòng cho ${esc(g.so_ma)}">${esc(g.so_ma)}</b>` : `<b>${esc(g.so_ma)}</b>`} <span class="st st-tam-tinh">Chưa có HĐ gốc</span></td></tr>`;
    if (!closed) g.pls.forEach((r, i) => { html += hdRowHtml(r, `${n}.${i + 1}`, { child: true, head: g.head }); });
    if (g.pls.length) {
      const sum = (f) => members.reduce((s, r) => s + r[f], 0);
      const tt = members.some((r) => r.tam_tinh), gt = grpTd(g);
      html += `
        <tr class="hd-sub">
          <td></td>
          <td colspan="2">Cộng ${esc(g.so_ma)} <span class="muted small">(${g.head ? 'HĐ + ' : ''}${g.pls.length} PL)</span>${tt ? ' <span class="st st-tam-tinh" title="HĐ chưa quyết toán – giá trị tạm tính">Tạm tính</span>' : ''}
            ${gt.cu ? '<div class="td-note muted">TĐ3 = hồ sơ quyết toán ở mục 2</div>' : ''}${gt.thieu ? `<div class="td-note warn-text">⚠ ${gt.thieu} văn bản chưa có số QT – tạm lấy TĐ2</div>` : ''}</td>
          <td class="num">${dvm(gt.t1)}</td><td class="num">${dvm(gt.t2)}${tdDelta(gt.t2, gt.t1)}</td><td class="num">${dvm(gt.t3)}${tdDelta(gt.t3, gt.t2)}</td><td></td>
          <td class="num">${dvm(sum('sau_vat'))}</td>
          <td colspan="${canRv('hd') ? 3 : 2}"></td>
        </tr>`;
    }
    return html;
  }).join('');
}

async function saveRevenue(f) {
  const msgEl = $('.msg', f);
  const id = f.elements.id.value;
  const ngay = dmyToIso(f.elements.ngay.value);
  if (ngay === null) return showMsg(msgEl, 'Ngày không hợp lệ, nhập theo dạng dd/mm/yyyy', 'err');
  const body = {
    loai: f.dataset.loai,
    ...(f.elements.ma_loai
      ? { ma_loai: f.elements.ma_loai.value, so_ma: f.elements.so_ma.value }
      : { so_hieu: f.elements.so_hieu.value }),
    ngay,
    gia_tri: parseMoney(f.elements.gia_tri.value),
    vat: f.elements.vat.value,
    ghi_chu: f.elements.ghi_chu.value,
    ...(f.elements.td ? { td: f.elements.td.value } : {}),
  };
  if (f.elements.hd_id) {
    if (!f.elements.hd_id.value) return showMsg(msgEl, 'Chọn Số HĐ từ danh sách gợi ý (nhập HĐ ở mục 1 trước nếu chưa có)', 'err');
    body.hd_id = f.elements.hd_id.value;
  }
  // Văn bản đã có: ghi thành 1 đợt điều chỉnh TĐ2 (+ tăng / − giảm) rồi tự chuyển sang tab TĐ2
  const co = f.dataset.loai === 'hd' && vbDaCo(f);
  if (co) {
    if (!Number(body.gia_tri)) return showMsg(msgEl, `Nhập số tăng (+) hoặc giảm (−) cho ${co.so_hieu}`, 'err');
    try {
      await api('/api/dieu-chinh', { method: 'POST', body: JSON.stringify({ loai: 'dt', vb_id: co.id, ngay, noi_dung: body.ghi_chu || 'Điều chỉnh', so_tien: body.gia_tri }) });
      BST.i_td = 2; try { bSave(); } catch { /* chưa tải Báo cáo */ }
      resetRevForm(f);
      await loadRevenue();
      showMsg($('#td-hd-msg'), `Đã ghi điều chỉnh ${Number(body.gia_tri) > 0 ? '+' : ''}${money(body.gia_tri)} đ cho ${co.so_hieu} vào TĐ2 – đã chuyển sang tab TĐ2`);
    } catch (err) { showMsg(msgEl, err.message, 'err'); }
    return;
  }
  try {
    await api(id ? `/api/doanh-thu/${id}` : `/api/du-an/${revProjectId}/doanh-thu`,
      { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    if (body.hd_id) qtOpen.add(Number(body.hd_id)); // mở nhóm HĐ vừa nhập
    resetRevForm(f);
    showMsg(msgEl, id ? 'Đã cập nhật' : 'Đã thêm dòng');
    await loadRevenue();
  } catch (err) {
    showMsg(msgEl, err.message, 'err');
  }
}

async function onRevTableClick(e) {
  const { redit, rdel, grp, qtgrp, qtadd, rdot, rqt, rqtsave, rmokhoa } = e.target.dataset;
  const tdMsg = (t, ty) => showMsg($('#td-hd-msg'), t, ty);
  if (rqtsave) {
    const el = $(`.rev-card [data-qtin="${rqtsave}"]`); el?.dispatchEvent(new Event('blur'));
    const v = parseMoney(el?.value), r = revData.items.find((x) => x.id === Number(rqtsave));
    if (v === '' || v === '-' || Number(v) < 0) return tdMsg(`Nhập số quyết toán cho ${r?.so_hieu || ''}`, 'err');
    if (!confirm(`Lưu số quyết toán ${money(v)} đ cho ${r?.so_hieu}? Văn bản sẽ bị KHOÁ (muốn sửa phải mở khoá bằng Passcode).`)) return;
    try { const o = await api(`/api/doanh-thu/${rqtsave}/qt`, { method: 'PUT', body: JSON.stringify({ gt_qt: v }) }); await loadRevenue(); tdMsg(o?.dong ? `Đã lưu – HĐ ${r?.so_ma} đã quyết toán hết, đã đóng (khoá toàn bộ)` : `Đã lưu số quyết toán ${r?.so_hieu} – văn bản đã khoá`); }
    catch (err) { tdMsg(err.message, 'err'); }
    return;
  }
  if (rmokhoa) {
    const r = revData.items.find((x) => x.id === Number(rmokhoa));
    const pc = await askPasscode(`Mở khoá quyết toán ${r?.so_hieu || ''}?`, 'Bỏ số quyết toán của văn bản này để sửa lại (có ghi nhật ký). HĐ sẽ mở lại nếu đang đóng.', '🔓 Mở khoá');
    if (pc === null) return;
    try { await api(`/api/doanh-thu/${rmokhoa}/qt`, { method: 'DELETE', body: JSON.stringify({ passcode: pc }) }); await loadRevenue(); tdMsg(`Đã mở khoá ${r?.so_hieu}`); }
    catch (err) { tdMsg(err.message, 'err'); }
    return;
  }
  if (rdot) return openDc('dt', Number(rdot));
  if (rqt) return openQtDt(Number(rqt));
  if (qtgrp !== undefined) {
    const k = Number(qtgrp);
    qtOpen.has(k) ? qtOpen.delete(k) : qtOpen.add(k);
    return renderRevenue();
  }
  if (e.target.id === 'qt-toggle-all') {
    const ks = qtGroupList(revData.items.filter((r) => r.loai === 'qt')).map((g) => g.k).filter(Boolean);
    const close = ks.every((k) => qtOpen.has(k));
    ks.forEach((k) => (close ? qtOpen.delete(k) : qtOpen.add(k)));
    return renderRevenue();
  }
  if (e.target.dataset.qtq) {
    // Thanh "Thêm cho HĐ" mục 2: + Đợt thanh toán (đặt tên đợt kế tiếp) / + Quyết toán – điền sẵn form
    const f = $('.rev-form[data-loai="qt"]'); const k = Number($('#qt-hd-pick')?.value);
    if (!f || !k) return;
    resetRevForm(f); f._hdAc?.set(k);
    const qt = e.target.dataset.qtq === 'qt', ten = qt ? 'Quyết toán' : tenDotKeTiep(k);
    f.elements.so_hieu.value = ten;
    showMsg($('.msg', f), qt ? 'Nhập giá trị quyết toán (phần còn lại sau các đợt đã nghiệm thu / thanh toán)' : `Nhập giá trị "${ten}"`);
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => f.elements.gia_tri.focus(), 300);
    return;
  }
  if (qtadd) {
    // Thêm đợt cho HĐ: điền sẵn Số HĐ và tên đợt kế tiếp
    const f = $('.rev-form[data-loai="qt"]');
    if (!f) return;
    resetRevForm(f);
    const k = Number(qtadd);
    f._hdAc?.set(k);
    f.elements.so_hieu.value = tenDotKeTiep(k); // theo tên hồ sơ đã có: Hoàn thành đợt 2 -> Hoàn thành đợt 3
    showMsg($('.msg', f), 'Nhập giá trị đợt mới (đổi tên thành "Quyết toán" nếu là hồ sơ quyết toán)');
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => f.elements.gia_tri.focus(), 300);
    return;
  }
  if (grp !== undefined) {
    hdCollapsed.has(grp) ? hdCollapsed.delete(grp) : hdCollapsed.add(grp);
    return renderRevenue();
  }
  if (redit) {
    const r = revData.items.find((x) => x.id === Number(redit));
    const f = $(`.rev-form[data-loai="${r.loai}"]`);
    f.elements.id.value = r.id;
    if (f.elements.ma_loai) {
      f._manualLoai = true;
      f.elements.so_ma.value = r.so_ma || '';
      fillMaLoaiOptions(f, r.ma_loai);
      updateSoPreview(f);
    } else {
      f.elements.so_hieu.value = r.so_hieu;
    }
    f.elements.ngay.value = isoToDmy(r.ngay);
    f.elements.gia_tri.value = money(r.gia_tri_ky ?? r.gia_tri); // sửa giá trị KÝ (TĐ1); tăng / giảm sau ký sửa ở ± Đợt
    f.elements.vat.value = r.vat;
    f.elements.ghi_chu.value = r.ghi_chu || '';
    if (f._hdAc) f._hdAc.set(r.hd_id);
    $('button[type=submit]', f).textContent = 'Lưu thay đổi';
    showMsg($('.msg', f), 'Đang sửa: ' + r.so_hieu);
    updateRevPreview(f);
    f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (rdel) {
    const r = revData.items.find((x) => x.id === Number(rdel));
    if (!r) return;
    let body;
    if (r.loai === 'hd') {
      // Xóa Số HĐ/PL: bắt buộc Passcode; HĐ có dữ liệu kèm theo -> liệt kê và xóa toàn bộ
      let im;
      try { im = await api(`/api/doanh-thu/${r.id}/impact`); } catch (err) { return alert(err.message); }
      const cascade = r.ma_loai === 'HĐ' && (im.pls.length || im.qt.n || im.tv.n);
      const lines = [`${r.so_hieu}: ${money(im.sau_vat)} đ sau VAT`];
      if (cascade) {
        if (im.pls.length) lines.push(`${im.pls.length} phụ lục: ${im.pls.map((p) => `${p.so_hieu} (${money(p.sau_vat)} đ)`).join(', ')}`);
        if (im.qt.n) lines.push(`${im.qt.n} dòng Hoàn thành/Quyết toán: ${money(im.qt.sau_vat)} đ`);
        if (im.tv.n) lines.push(`${im.tv.n} dòng Tiền về: ${money(im.tv.so_tien)} đ`);
      }
      if (im.tp) lines.push(`${im.tp} HĐ đầu vào (thầu phụ, vật tư…) đang gắn HĐ này sẽ KHÔNG bị xóa, chỉ chuyển về nhóm "Chưa gắn HĐ CĐT"`);
      const pc = await askPasscode(
        cascade ? `Xóa toàn bộ hợp đồng "${r.so_hieu}"?` : `Xóa "${r.so_hieu}"?`,
        (cascade ? 'Sẽ xóa tất cả dữ liệu sau:\n• ' : '') + lines.join('\n• ') + '\nThao tác này không hoàn tác được.');
      if (pc === null) return;
      body = JSON.stringify({ passcode: pc, cascade: Boolean(cascade) });
    } else if (!confirm(`Xóa dòng "${r.so_hieu}"?`)) return;
    try {
      await api(`/api/doanh-thu/${rdel}`, { method: 'DELETE', body });
      tvDrafts = null;
      tvEdits = {};
      await loadRevenue();
    } catch (err) {
      alert(err.message);
    }
  }
}

// ---------------------------------------------------------------------
// 3. GIÁ TRỊ TIỀN VỀ – theo từng HĐ, bảng sửa trực tiếp, chèn dòng
// ---------------------------------------------------------------------
const TV_ORDER = { tam_ung: 0, dot: 1, quyet_toan: 2 };
const tvLabel = (r) => (r.loai === 'dot' ? 'TT Đợt' : r.loai === 'tam_ung' ? 'Tạm ứng' : 'Quyết toán');
let tvDrafts = null;   // dòng chưa lưu: [{key, loai, dot, hd_id}]
let tvEdits = {};      // nội dung đang sửa chưa lưu: key -> {so_tien, ngay, ghi_chu, dot, hd_id}
let tvSeq = 0;
const tvOpen = new Set();  // nhóm HĐ đang mở (mặc định thu gọn)

function tienVeCardHtml() {
  return `
    <div class="card" id="tv-card">
      <div class="toolbar tv-head">
        <h2>3. Giá trị tiền về</h2>
        <button type="button" class="sm" id="tv-toggle-all">Mở tất cả</button>
        <div class="tv-total">Tổng: <b id="tv-total">0</b></div>
      </div>
      <div class="table-wrap">
        <table class="tv-table">
          <thead><tr>
            <th class="num">#</th><th>Nội dung</th><th class="num">Giá trị tiền về</th><th>Ngày (dd/mm/yyyy)</th>
            <th>Ghi chú</th><th>Người cập nhật</th>${can('tien') ? '<th></th>' : ''}
          </tr></thead>
          <tbody id="tv-body"></tbody>
          <tfoot id="tv-foot"></tfoot>
        </table>
      </div>
      ${can('tien') ? `
      <div class="tv-tools">
        <label class="tv-hd-pick">Thêm cho HĐ <select id="tv-hd-pick"></select></label>
        <button type="button" data-tvadd="tam_ung">+ Tạm ứng</button>
        <button type="button" data-tvadd="dot">+ Chèn đợt thanh toán</button>
        <button type="button" data-tvadd="quyet_toan" id="tv-add-qt">+ Quyết toán</button>
        <span class="spacer"></span>
        <button type="button" class="primary" id="tv-save-all" hidden>Lưu tất cả (<span id="tv-dirty">0</span>)</button>
      </div>
      <div class="msg" id="tv-msg" role="alert"></div>` : ''}
    </div>`;
}

// Danh sách hợp đồng gốc (HĐ) theo thứ tự ở mục 1
function tvHeads() {
  return hdGroups((revData?.items || []).filter((r) => r.loai === 'hd')).filter((g) => g.head).map((g) => g.head);
}
const tvPickHd = () => Number($('#tv-hd-pick')?.value) || tvHeads()[0]?.id || null;

// Giá trị đang hiển thị của 1 dòng (ưu tiên nội dung đang sửa)
function tvVal(r) {
  const e = tvEdits[r.key] || {};
  return {
    so_tien: e.so_tien ?? (r.id ? money(r.so_tien) : ''),
    ngay: e.ngay ?? isoToDmy(r.ngay),
    ghi_chu: e.ghi_chu ?? (r.ghi_chu || ''),
    dot: e.dot ?? (r.dot ?? ''),
    hd_id: e.hd_id ?? (r.hd_id ?? ''),
  };
}
const tvDirty = (r) => !r.id || Boolean(tvEdits[r.key]);

// Dòng hiển thị = dòng đã lưu + dòng nháp; nhóm theo HĐ (thứ tự mục 1), trong nhóm: Tạm ứng → Đợt → Quyết toán
function tvRows() {
  const heads = tvHeads();
  const saved = revData.tien_ve.map((r) => ({ ...r, key: 'id' + r.id }));
  if (tvDrafts === null && (saved.length || !canRv('tien') || heads.length)) {
    // Công trình chưa có dữ liệu: gợi ý sẵn mẫu Tạm ứng / TT Đợt 1 / Quyết toán cho HĐ đầu tiên
    const hd_id = heads[0]?.id;
    tvDrafts = saved.length || !canRv('tien') ? [] : [
      { key: 'd' + ++tvSeq, loai: 'tam_ung', hd_id },
      { key: 'd' + ++tvSeq, loai: 'dot', dot: 1, hd_id },
      { key: 'd' + ++tvSeq, loai: 'quyet_toan', hd_id },
    ];
  }
  const order = new Map(heads.map((h, i) => [h.id, i]));
  const gOrd = (r) => (r.hd_id && order.has(r.hd_id) ? order.get(r.hd_id) : 1e6);
  return [...saved, ...(tvDrafts || [])].sort((a, b) =>
    gOrd(a) - gOrd(b) ||
    TV_ORDER[a.loai] - TV_ORDER[b.loai] || (a.loai === 'dot' ? (a.dot || 0) - (b.dot || 0) : 0) ||
    String(a.ngay || '9999').localeCompare(String(b.ngay || '9999')) || (a.id || 1e9) - (b.id || 1e9));
}

function renderTienVe() {
  const heads = tvHeads();
  const rows = tvRows();
  const edit = canRv('tien');
  const cols = edit ? 7 : 6;
  const hdName = (id) => heads.find((h) => h.id === Number(id))?.so_hieu;
  $('#tv-total').textContent = dvT(revData.tong_tien_ve.tong);

  // Gom nhóm theo HĐ (dòng chưa chọn HĐ / HĐ không còn -> nhóm "Chưa chọn HĐ")
  const groups = [];
  for (const r of rows) {
    const k = r.hd_id && hdName(r.hd_id) ? Number(r.hd_id) : 0;
    let g = groups[groups.length - 1];
    if (!g || g.k !== k) groups.push(g = { k, rows: [] });
    g.rows.push(r);
  }

  const childHtml = (r, stt, orphan) => {
    const v = tvVal(r);
    const label = r.loai === 'dot'
      ? (edit ? `TT Đợt <input class="tv-dot" data-f="dot" type="number" min="1" max="999" step="1" value="${esc(v.dot)}">` : `TT Đợt ${esc(r.dot)}`)
      : tvLabel(r);
    const hdSel = orphan && edit ? `<select class="tv-in tv-hd" data-f="hd_id">
        <option value="">— Chọn HĐ —</option>
        ${heads.map((h) => `<option value="${h.id}" ${Number(v.hd_id) === h.id ? 'selected' : ''}>${esc(h.so_hieu)}</option>`).join('')}
      </select>` : '';
    if (!edit) {
      return `<tr class="tv-child"><td class="num muted">${stt}</td>
        <td class="indent"><span class="tree">└</span><b>${label}</b></td><td class="num">${dvm(r.so_tien)}</td>
        <td>${isoToDmy(r.ngay)}</td><td class="wrap">${esc(r.ghi_chu)}</td><td class="muted">${esc(r.nguoi_cap_nhat || '')}</td></tr>`;
    }
    const cls = !r.id ? 'tv-draft' : tvEdits[r.key] ? 'tv-dirty' : '';
    return `<tr class="tv-child ${cls}" data-key="${r.key}">
      <td class="num muted">${stt}</td>
      <td class="indent"><span class="tree">└</span>${hdSel}<b>${label}</b>${!r.id ? ' <span class="st st-tam-tinh">Chưa lưu</span>' : ''}</td>
      <td class="num"><input class="tv-in money num" data-f="so_tien" value="${esc(v.so_tien)}" placeholder="Nhập giá trị"></td>
      <td><input class="tv-in date-dmy" data-f="ngay" value="${esc(v.ngay)}"></td>
      <td><input class="tv-in" data-f="ghi_chu" maxlength="500" value="${esc(v.ghi_chu)}"></td>
      <td class="muted">${esc(r.nguoi_cap_nhat || '')}</td>
      <td class="row-actions">
        <button class="primary sm" data-tvsave="${r.key}" ${tvDirty(r) ? '' : 'hidden'}>Lưu</button>
        <button class="danger sm" data-tvdel="${r.key}">${r.id ? 'Xóa' : 'Bỏ'}</button>
      </td>
    </tr>`;
  };

  $('#tv-body').innerHTML = groups.length ? groups.map((g, gi) => {
    const n = gi + 1;
    const saved = g.rows.filter((r) => r.id);
    const sum = (f) => saved.filter(f).reduce((s, r) => s + r.so_tien, 0);
    const orphan = g.k === 0;
    // Nhóm đang nhập dở hoặc "Chưa chọn HĐ" luôn mở
    const busy = g.rows.some((r) => !r.id || tvEdits[r.key]);
    const open = orphan || busy || tvOpen.has(g.k);
    const hasQt = g.rows.some((r) => r.loai === 'quyet_toan');
    const parts = [['Tạm ứng', (r) => r.loai === 'tam_ung'], ['Thanh toán', (r) => r.loai === 'dot'], ['Quyết toán', (r) => r.loai === 'quyet_toan']]
      .filter(([, f]) => saved.some(f)).map(([t, f]) => `${t} ${money(sum(f))}`).join(' · ');
    const head = `<tr class="tv-head-row ${orphan ? 'tv-sub-warn' : ''}">
      <td class="num">${n}</td>
      <td>${orphan ? '' : `<button class="grp-toggle" data-tvgrp="${g.k}" title="${open ? 'Thu gọn' : 'Mở chi tiết'}">${open ? '▾' : '▸'}</button>`}
        ${orphan ? '<span class="st st-tam-tinh">Chưa chọn HĐ</span>' : `<span class="kind-tag kind-hd">HĐ</span> <b>${esc(hdName(g.k).replace(/^HĐ\s+/, ''))}</b>`}
        <span class="muted small">(${g.rows.length} dòng)</span></td>
      <td class="num tv-head-sum">${dvm(sum(() => true))}</td>
      <td colspan="2" class="muted small">${parts}</td>
      <td colspan="${cols - 5}" class="row-actions">${edit && !orphan ? `
        <button class="sm" data-tvadd="tam_ung" data-hd="${g.k}" title="Thêm Tạm ứng">+ TƯ</button>
        <button class="sm" data-tvadd="dot" data-hd="${g.k}" title="Chèn đợt thanh toán">+ Đợt</button>
        <button class="sm" data-tvadd="quyet_toan" data-hd="${g.k}" ${hasQt ? 'disabled title="HĐ đã có Quyết toán"' : 'title="Thêm Quyết toán"'}>+ QT</button>` : ''}</td>
    </tr>`;
    return head + (open ? g.rows.map((r, i) => childHtml(r, `${n}.${i + 1}`, orphan)).join('') : '');
  }).join('') : `<tr><td colspan="${cols}" class="empty">${heads.length ? 'Chưa có dữ liệu' : 'Chưa có HĐ ở mục 1 – hãy nhập HĐ trước'}</td></tr>`;

  const t = revData.tong_tien_ve;
  $('#tv-foot').innerHTML = `<tr><td></td><td>TỔNG TIỀN VỀ</td><td class="num">${dvm(t.tong)}</td><td colspan="${cols - 3}"></td></tr>`;
  const anyClosed = groups.some((g) => g.k && !tvOpen.has(g.k));
  $('#tv-toggle-all').textContent = anyClosed ? 'Mở tất cả' : 'Thu gọn tất cả';
  $('#tv-toggle-all').hidden = !groups.some((g) => g.k);

  if (edit) {
    $$('#tv-body input.money').forEach(attachMoneyInput);
    $$('#tv-body input.date-dmy').forEach(attachDateInput);
    // Ô chọn HĐ để thêm dòng (dùng khi HĐ chưa có dòng tiền về nào)
    const pick = $('#tv-hd-pick');
    const keep = Number(pick.value);
    pick.innerHTML = heads.map((h) => `<option value="${h.id}">${esc(h.so_hieu)}</option>`).join('');
    if (heads.some((h) => h.id === keep)) pick.value = keep;
    const none = !heads.length;
    pick.disabled = none;
    $$('.tv-tools [data-tvadd]').forEach((b) => (b.disabled = none));
    updateTvButtons();
    updateTvSaveAll();
  }
}

// Mỗi HĐ chỉ 1 dòng Quyết toán
function updateTvButtons() {
  const hd = tvPickHd();
  const hasQt = tvRows().some((r) => r.loai === 'quyet_toan' && Number(tvVal(r).hd_id) === hd);
  const btn = $('#tv-add-qt');
  btn.disabled = !hd || hasQt;
  btn.title = hasQt ? 'HĐ này đã có dòng Quyết toán' : '';
}

function updateTvSaveAll() {
  const n = tvRows().filter((r) => tvDirty(r) && (r.id || tvEdits[r.key])).length;
  $('#tv-dirty').textContent = n;
  $('#tv-save-all').hidden = n === 0;
}

function tvFind(key) { return tvRows().find((r) => r.key === key); }

// Lưu 1 dòng; trả về true nếu thành công
async function tvSave(key, { silent = false } = {}) {
  const r = tvFind(key);
  if (!r) return false;
  const v = tvVal(r);
  const msg = $('#tv-msg');
  const label = r.loai === 'dot' ? `TT Đợt ${v.dot}` : tvLabel(r);
  const ngay = dmyToIso(v.ngay);
  const so = parseMoney(v.so_tien);
  if (!v.hd_id) { showMsg(msg, `${label}: chưa chọn Số HĐ`, 'err'); return false; }
  if (!so || so === '-') { showMsg(msg, `${label}: chưa nhập giá trị`, 'err'); return false; }
  if (ngay === null) { showMsg(msg, `${label}: ngày không hợp lệ, nhập dd/mm/yyyy`, 'err'); return false; }
  const body = { loai: r.loai, dot: r.loai === 'dot' ? v.dot : null, so_tien: so, ngay, ghi_chu: v.ghi_chu, hd_id: v.hd_id };
  try {
    await api(r.id ? `/api/tien-ve/${r.id}` : `/api/du-an/${revProjectId}/tien-ve`,
      { method: r.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    delete tvEdits[key];
    tvOpen.add(Number(v.hd_id));
    if (!r.id) tvDrafts = tvDrafts.filter((d) => d.key !== key);
    if (!silent) showMsg(msg, `Đã lưu: ${label}`);
    return true;
  } catch (err) {
    showMsg(msg, `${label}: ${err.message}`, 'err');
    return false;
  }
}

async function tvReload() {
  revData = await api(`/api/du-an/${revProjectId}/doanh-thu`);
  renderRevenue();
}

function bindTienVe() {
  const card = $('#tv-card');
  if (!canRv('tien')) return;
  $('#tv-hd-pick').addEventListener('change', updateTvButtons);
  // Ghi nhận nội dung đang sửa
  card.addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-key]');
    if (!tr || !e.target.dataset.f) return;
    const key = tr.dataset.key;
    tvEdits[key] = { ...tvVal(tvFind(key)), ...(tvEdits[key] || {}), [e.target.dataset.f]: e.target.value };
    if (!tr.classList.contains('tv-draft')) tr.classList.add('tv-dirty');
    $(`[data-tvsave="${key}"]`, tr).hidden = false;
    updateTvSaveAll();
    if (e.target.dataset.f === 'hd_id') updateTvButtons();
  });
  // Enter = lưu dòng
  card.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-key]');
    if (e.key === 'Enter' && tr) { e.preventDefault(); $(`[data-tvsave="${tr.dataset.key}"]`, tr).click(); }
  });
  card.addEventListener('click', async (e) => {
    const { tvsave, tvdel, tvadd, tvgrp } = e.target.dataset;
    if (tvgrp !== undefined) {
      const k = Number(tvgrp);
      tvOpen.has(k) ? tvOpen.delete(k) : tvOpen.add(k);
      return renderTienVe();
    }
    if (e.target.id === 'tv-toggle-all') {
      const ks = [...new Set(tvRows().map((r) => Number(r.hd_id)).filter(Boolean))];
      const close = ks.every((k) => tvOpen.has(k));
      ks.forEach((k) => (close ? tvOpen.delete(k) : tvOpen.add(k)));
      return renderTienVe();
    }
    if (tvsave) {
      e.target.disabled = true;
      if (await tvSave(tvsave)) await tvReload();
      else e.target.disabled = false;
    }
    if (tvdel) {
      const r = tvFind(tvdel);
      if (!r) return;
      if (!r.id) {
        tvDrafts = tvDrafts.filter((d) => d.key !== tvdel);
        delete tvEdits[tvdel];
        return renderTienVe();
      }
      const label = r.loai === 'dot' ? `TT Đợt ${r.dot}` : tvLabel(r);
      if (!confirm(`Xóa dòng "${label}" của ${r.hd_so_hieu || 'chưa chọn HĐ'} (${money(r.so_tien)})?`)) return;
      try {
        await api(`/api/tien-ve/${r.id}`, { method: 'DELETE' });
        delete tvEdits[tvdel];
        showMsg($('#tv-msg'), `Đã xóa: ${label}`);
        await tvReload();
      } catch (err) { showMsg($('#tv-msg'), err.message, 'err'); }
    }
    if (tvadd) {
      const hd_id = Number(e.target.dataset.hd) || tvPickHd();
      if (!hd_id) return;
      tvOpen.add(hd_id);
      const rows = tvRows().filter((r) => Number(tvVal(r).hd_id) === hd_id);
      const d = { key: 'd' + ++tvSeq, loai: tvadd, hd_id };
      if (tvadd === 'dot') d.dot = Math.max(0, ...rows.filter((r) => r.loai === 'dot').map((r) => Number(tvVal(r).dot) || 0)) + 1;
      tvDrafts = tvDrafts || [];
      tvDrafts.push(d);
      renderTienVe();
      $(`tr[data-key="${d.key}"] input[data-f="so_tien"]`)?.focus();
    }
  });
  $('#tv-save-all').addEventListener('click', async (e) => {
    e.target.disabled = true;
    const keys = tvRows().filter((r) => tvDirty(r) && (r.id || tvEdits[r.key])).map((r) => r.key);
    let okN = 0;
    for (const k of keys) if (await tvSave(k, { silent: true })) okN++;
    await tvReload();
    if (okN === keys.length) showMsg($('#tv-msg'), `Đã lưu ${okN} dòng`);
    e.target.disabled = false;
  });
}

// =====================================================================
// CHI PHÍ theo công trình (dùng chung công trình đang chọn với tab Doanh thu)
// =====================================================================
let costData = null;
let costAll = (() => { try { return localStorage.getItem('costAll') === '1'; } catch { return false; } })(); // Chi phí: xem tổng hợp tất cả dự án
const costOpen = new Set();
// 3 khối chi phí (trực tiếp / gián tiếp / tài chính): mặc định thu gọn, chỉ hiện tiêu đề + Tổng; bấm tiêu đề để mở
const cKhoiMo = new Set();
const khoiOfNhom = (code) => NHOM().find((n) => n.code === code)?.khoi;
let cBlocksOn = false; // cả 3 khối chi tiết: mặc định ẩn, bấm "Hiện bảng chi tiết chi phí" để xem
function cBlocksShow(on) {
  cBlocksOn = on;
  const w = $('#c-blocks'), b = $('#c-blocks-toggle'); if (!w || !b) return;
  w.hidden = !on; b.setAttribute('aria-expanded', String(on));
  b.textContent = on ? 'Ẩn bảng chi tiết chi phí ▴' : 'Hiện bảng chi tiết chi phí ▾';
  b.classList.toggle('primary', !on);
}
const moKhoiCua = (code) => { const k = khoiOfNhom(code); if (k) cKhoiMo.add(k); cBlocksShow(true); }; // vừa thêm / mở nhóm -> hiện bảng, mở khối chứa nhóm          // nhóm / hạng mục đang mở: 'thau_phu', 'vat_tu', 'vat_tu:chinh'...
const cForm = $('#c-form');
const NHOM = () => META.nhom_chi_phi || [];
const KHOI = () => META.khoi_chi_phi || [];
const nhomOf = (khoi) => NHOM().filter((n) => n.khoi === khoi);
const BANKS = ['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'Techcombank', 'MB Bank', 'ACB', 'VPBank', 'Sacombank',
  'SHB', 'TPBank', 'HDBank', 'VIB', 'OCB', 'MSB', 'SeABank', 'Eximbank', 'LPBank', 'NCB', 'Nam A Bank', 'Bac A Bank', 'PVcomBank', 'ABBANK', 'KienlongBank'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const stt = (k, i) => (k.danh_so === 'la_ma' ? ROMAN[i] || String(i + 1) : String(i + 1));

async function loadCostTab() {
  projects = await api('/api/du-an');
  const sel = $('#c-project');
  $('#c-empty').hidden = projects.length > 0;
  $('#c-body').hidden = true;
  sel.hidden = !projects.length;
  if (!projects.length) return;
  if (!projects.some((p) => p.id === revProjectId)) revProjectId = projects[0].id;
  sel.innerHTML = `<option value="all">Tất cả dự án (${projects.length}) – chỉ xem tổng hợp</option>` +
    projects.map((p) => `<option value="${p.id}">${esc(p.ma_du_an)} – ${esc(p.ten_du_an)}</option>`).join('');
  sel.value = costAll ? 'all' : revProjectId;
  if (cForm?.isConnected && !cForm.dataset.ready) initCostForm(); // vai trò chỉ xem: form đã gỡ khỏi trang -> bỏ qua
  await loadCost();
}

$('#c-project').addEventListener('change', (e) => {
  costAll = e.target.value === 'all'; // "Tất cả dự án": chỉ xem, không đổi dự án đang chọn của tab Doanh thu
  try { localStorage.setItem('costAll', costAll ? '1' : ''); } catch {}
  if (!costAll) { revProjectId = Number(e.target.value); revAll = false; try { localStorage.setItem('revAll', ''); } catch {} if (can('bao_cao')) baoCaoTheoDuAn(revProjectId); } // đồng bộ Doanh thu + Báo cáo
  if (cForm?.isConnected) resetCostForm();
  loadCost().catch((err) => alert(err.message));
});

async function loadCost() {
  if (!costAll) try { localStorage.setItem('revProject', revProjectId); } catch {}
  costData = await api(costAll ? '/api/chi-phi-tong' : `/api/du-an/${revProjectId}/chi-phi`);
  const p = costData.du_an;
  $('#c-project-info').innerHTML = costAll
    ? `<b>Tổng hợp ${costData.so_du_an} dự án</b> · chỉ xem – muốn nhập, sửa chi phí hãy chọn từng dự án`
    : `Mã: <b>${esc(p.ma_du_an)}</b> · Chủ đầu tư: <b>${esc(p.chu_dau_tu || '—')}</b>`;
  const fc = cForm?.closest('.card'); if (fc) fc.hidden = costAll; // ẩn form nhập khi xem tổng hợp
  $('#tab-cost').classList.toggle('cost-all', costAll);
  $('#c-body').hidden = false;
  renderCost();
}

// ---------- Form nhập ----------
// Nhóm Thầu phụ (thêm mới) -> form tạo hợp đồng thầu phụ; các nhóm khác -> dòng chi phí
// Hợp đồng đầu vào: thầu phụ luôn theo HĐ; vật tư, MMTB, nhân công chọn Hình thức = Hợp đồng
const HDV = ['thau_phu', 'vat_tu', 'nhan_cong', 'may_moc']; // thứ tự hiển thị: Thầu phụ, Vật tư, Nhân công, MMTB
const TPN = () => META.tp_nhom || { thau_phu: 'Thầu phụ', vat_tu: 'Vật tư', may_moc: 'Máy móc thiết bị', nhan_cong: 'Nhân công giao khoán' };
const TP_DT = { thau_phu: 'Nhà thầu phụ', vat_tu: 'Nhà cung cấp', may_moc: 'Đơn vị cho thuê / cung cấp', nhan_cong: 'Tổ đội / nhà thầu nhân công' };
const TP_TAG = { thau_phu: 'TP', vat_tu: 'VT', may_moc: 'MMTB', nhan_cong: 'NC' };
const LE_NHOM = ['vat_tu', 'may_moc', 'nhan_cong']; // nhóm có thể vừa có HĐ vừa có chi phí mua lẻ
const TP_NGAN = { thau_phu: 'Thầu phụ', vat_tu: 'Vật tư', may_moc: 'MMTB', nhan_cong: 'Nhân công' };
const tpTen = (c) => (TPN()[c?.nhom || 'thau_phu'] || 'Thầu phụ').toLowerCase();
const costTpMode = () => {
  const e = cForm.elements;
  return !e.id.value && (e.nhom.value === 'thau_phu' || (HDV.includes(e.nhom.value) && e.hinh_thuc.value === 'hd'));
};
// Ô Hình thức: chỉ hiện ở vật tư, MMTB, nhân công khi thêm mới; lựa chọn theo quyền (HĐ: QS · dòng chi phí: Kế toán)
function fillHinhThuc() {
  const e = cForm.elements, hdv = !e.id.value && HDV.includes(e.nhom.value) && e.nhom.value !== 'thau_phu';
  // Có cả 2 quyền mới cho chọn; chỉ 1 quyền -> tự chọn đúng hình thức được phép
  $('#c-ht-wrap').hidden = !(hdv && can('hd') && can('tien')) || tdDangChon() !== 1;
  if (hdv && !(can('hd') && can('tien'))) e.hinh_thuc.value = can('hd') ? 'hd' : 'le';
  if (hdv && tdDangChon() !== 1) e.hinh_thuc.value = 'le'; // TĐ2 / TĐ3: chỉ thêm dòng chi phí mua lẻ, HĐ đầu vào mới tạo ở TĐ1
}
function setCostMode() {
  fillHinhThuc();
  const tp = costTpMode();
  // TĐ2 / TĐ3: không tạo HĐ đầu vào mới (thầu phụ chỉ có dạng HĐ -> ẩn ô nhập, hướng dẫn)
  const chan = tp && tdDangChon() !== 1;
  [...cForm.children].forEach((el) => { if ((el.tagName === 'LABEL' || el.classList.contains('actions') || el.classList.contains('tp-hint')) && !el.querySelector('[name=nhom]')) el.classList.toggle('td-an', chan); });
  const note = $('#c-td-note');
  if (note) {
    note.hidden = !chan && !(HDV.includes(cForm.elements.nhom.value) && tdDangChon() !== 1 && !cForm.elements.id.value);
    note.innerHTML = chan
      ? `<b>Đang ở TĐ${tdDangChon()}:</b> HĐ ${esc((TPN()[cForm.elements.nhom.value] || '').toLowerCase())} mới chỉ tạo ở tab <b>TĐ1</b>. Điều chỉnh / quyết toán HĐ đã có: nhấp đúp Số HĐ ở bảng "1. Hợp đồng đầu vào".`
      : `<b>Đang ở TĐ${tdDangChon()}:</b> chỉ thêm dòng chi phí mua lẻ. HĐ đầu vào mới tạo ở tab <b>TĐ1</b>.`;
  }
  $$('.c-tp', cForm).forEach((el) => (el.hidden = !tp));
  $$('.c-gen', cForm).forEach((el) => (el.hidden = tp));
  if (tp) $('#c-sub-wrap').hidden = true;
  updateNoiDungHint();
  if (cForm.elements.sau_vat) updateCostPreview();
  const req = NHOM().find((n) => n.code === cForm.elements.nhom.value)?.bat_buoc_doi_tac;
  $('#c-dt-label').textContent = tp ? TP_DT[cForm.elements.nhom.value] : req ? `${req} *` : 'Đối tác / Nhà cung cấp';
  $('#c-so-label').textContent = `Số HĐ ${(TPN()[cForm.elements.nhom.value] || '').toLowerCase()} *`;
  // Trả nợ vay ngân hàng: gợi ý tên ngân hàng (đã nhập trước đó + ngân hàng phổ biến)
  const dt = cForm.elements.doi_tac;
  if (req && !tp) {
    const used = (costData?.items || []).filter((r) => r.nhom === cForm.elements.nhom.value && r.doi_tac).map((r) => r.doi_tac);
    const banks = [...new Set([...used, ...BANKS])];
    $('#bank-list').innerHTML = banks.map((b) => `<option value="${esc(b)}">`).join('');
    dt.setAttribute('list', 'bank-list');
    dt.placeholder = 'Gõ hoặc chọn tên ngân hàng';
  } else if (tp) {
    dt.removeAttribute('list'); // gợi ý nhà thầu bằng danh sách tự làm (attachCombo)
    dt.placeholder = 'Gõ tên – gợi ý từ các HĐ đã nhập';
    tpGoiYLoad();
  } else {
    dt.removeAttribute('list');
    dt.placeholder = '';
  }
  $('#c-ngay-label').textContent = tp ? 'Ngày ký HĐ' : 'Ngày';
  $('#c-gt-label').textContent = tp ? 'Giá trị HĐ (trước VAT) *' : 'Giá trị (trước VAT) *';
  $('button[type=submit]', cForm).textContent = cForm.elements.id.value ? 'Lưu thay đổi' : tp ? `Tạo HĐ ${(TPN()[cForm.elements.nhom.value] || '').toLowerCase()}` : 'Thêm dòng';
}

// ---------- Bộ nhớ gợi ý HĐ đầu vào: nhà thầu đã có + hạng mục từng thi công (mọi dự án) ----------
let tpGoiY = null, tpGoiYAt = 0;
async function tpGoiYLoad(force) {
  if (!force && tpGoiY && Date.now() - tpGoiYAt < 60000) return tpGoiY;
  try { tpGoiY = await api('/api/thau-phu-goi-y'); tpGoiYAt = Date.now(); } catch { tpGoiY = tpGoiY || []; }
  return tpGoiY;
}
const tpGoiYOf = (ten) => (tpGoiY || []).find((x) => x.doi_tac.toLowerCase() === String(ten || '').trim().toLowerCase());
// Danh sách gợi ý: nhà thầu (cùng loại HĐ lên trước) · hạng mục (của nhà thầu đang nhập lên trước)
const tpDtItems = () => {
  if (!cForm || !costTpMode()) return [];
  const nhom = cForm.elements.nhom.value;
  return (tpGoiY || []).slice().sort((a, b) => (b.nhom === nhom) - (a.nhom === nhom))
    .map((x) => ({ v: x.doi_tac, sub: `${x.so_hd} HĐ${x.hang_muc[0] ? ' · ' + x.hang_muc.map((h) => h.ten).slice(0, 2).join(', ') : ''}` }));
};
const tpHmItems = (ten) => {
  const g = tpGoiYOf(ten);
  const mine = (g?.hang_muc || []).map((h) => ({ v: h.ten, sub: h.du_an.slice(0, 3).join(', '), top: true }));
  const seen = new Set(mine.map((x) => x.v.toLowerCase()));
  const other = [];
  for (const x of tpGoiY || []) for (const h of x.hang_muc) if (!seen.has(h.ten.toLowerCase())) { seen.add(h.ten.toLowerCase()); other.push({ v: h.ten, sub: x.doi_tac }); }
  return [...mine, ...other];
};
// Gõ / chọn nhà thầu đã có -> tự điền hạng mục gần nhất (chỉ khi ô hạng mục trống hoặc đang là số tự điền trước đó)
function tpHmAuto(input, hm) {
  const g = tpGoiYOf(input.value);
  if (!hm || !g?.hang_muc.length) return;
  if (!hm.value.trim() || hm.dataset.auto === '1') { hm.value = g.hang_muc[0].ten; hm.dataset.auto = '1'; }
}

// Gợi ý ô Nội dung đúng theo nhóm / hạng mục đang chọn
function updateNoiDungHint() {
  const n = NHOM().find((x) => x.code === cForm.elements.nhom.value);
  const sc = n?.sub.find((x) => x.code === cForm.elements.nhom_con.value);
  cForm.elements.noi_dung.placeholder = sc?.goi_y || n?.goi_y || '';
}

function fillSubOptions(nhomCode, keep) {
  const n = NHOM().find((x) => x.code === nhomCode);
  const has = Boolean(n?.sub.length);
  $('#c-sub-wrap').hidden = !has;
  cForm.elements.nhom_con.innerHTML = has ? n.sub.map((s) => `<option value="${s.code}">${esc(s.ten)}</option>`).join('') : '';
  if (has && keep && n.sub.some((s) => s.code === keep)) cForm.elements.nhom_con.value = keep;
  setCostMode();
}

function updateCostPreview() {
  const raw = parseMoney(cForm.elements.gia_tri.value);
  const gt = raw && raw !== '-' ? Number(raw) : 0;
  const vs = cForm.elements.vat.value.trim();
  const vat = vs === '' ? 0 : Number(vs);
  const note = $('.vat-note', cForm);
  if (!Number.isInteger(vat) || vat < 0 || vat > 100) {
    cForm.elements.sau_vat.value = '—';
    note.textContent = 'VAT phải là số nguyên 0–100';
    note.className = 'calc-note vat-note err';
    return;
  }
  const tv = calcVat(gt, vat);
  cForm.elements.sau_vat.value = money(gt + tv);
  const noVat = NHOM().find((n) => n.code === cForm.elements.nhom.value)?.khong_vat;
  note.textContent = vat ? `Tiền VAT: ${money(tv)}` : noVat ? 'Không chịu VAT' : 'Chưa có VAT';
  note.className = 'calc-note vat-note' + (vat || noVat ? '' : ' warn');
}

function initCostForm() {
  cForm.dataset.ready = '1';
  // Nhóm Thầu phụ (tạo HĐ thầu phụ) thuộc quyền QS; các nhóm chi phí còn lại thuộc quyền Kế toán
  const duocNhap = (code) => (code === 'thau_phu' ? can('hd') : HDV.includes(code) ? can('tien') || can('hd') : can('tien'));
  cForm.elements.nhom.innerHTML = KHOI().map((k) => {
    const opts = nhomOf(k.code).map((n, i) => (duocNhap(n.code) ? `<option value="${n.code}">${stt(k, i)}. ${esc(n.ten)}</option>` : '')).join('');
    return opts ? `<optgroup label="${esc(k.ten)}">${opts}</optgroup>` : '';
  }).join('');
  fillSubOptions(cForm.elements.nhom.value);
  cForm.elements.nhom.addEventListener('change', () => fillSubOptions(cForm.elements.nhom.value));
  cForm.elements.nhom_con.addEventListener('change', updateNoiDungHint);
  cForm.elements.hinh_thuc.addEventListener('change', () => fillSubOptions(cForm.elements.nhom.value, cForm.elements.nhom_con.value));
  attachMoneyInput(cForm.elements.gia_tri);
  attachDateInput(cForm.elements.ngay);
  cForm.elements.gia_tri.addEventListener('input', updateCostPreview);
  cForm.elements.vat.addEventListener('input', updateCostPreview);
  cForm.addEventListener('submit', (e) => { e.preventDefault(); saveCost(); });
  attachQuickPicker(cForm.elements.so_tp,
    () => (costData?.thau_phu || []).map((c) => ({ value: c.id, label: c.so_ma, sub: `${TPN()[c.nhom] || ''} · ${c.doi_tac || '—'} · HĐ ${money(c.hd_sau_vat)} đ · Còn lại ${money(c.con_lai)} đ` })),
    (o) => openTp(o.value), 'Chưa có hợp đồng nào – hãy gõ số mới');
  $('#c-cancel').addEventListener('click', () => { resetCostForm(); showMsg($('#c-msg'), ''); });
  updateCostPreview();
}

if (cForm?.elements.hang_muc) {
  const e0 = cForm.elements;
  attachCombo(e0.doi_tac, tpDtItems, () => tpHmAuto(e0.doi_tac, e0.hang_muc));
  attachCombo(e0.hang_muc, () => (costTpMode() ? tpHmItems(e0.doi_tac.value) : []));
  e0.doi_tac.addEventListener('input', () => { if (costTpMode()) tpHmAuto(e0.doi_tac, e0.hang_muc); });
  // bấm vào ô: nạp lại bộ nhớ gợi ý nếu đã cũ rồi vẽ lại danh sách
  [e0.doi_tac, e0.hang_muc].forEach((el) => el.addEventListener('focus', () => { if (costTpMode()) tpGoiYLoad().then(() => document.activeElement === el && el._cbRender?.()); }));
  e0.hang_muc.addEventListener('input', (ev) => { if (ev.isTrusted) delete e0.hang_muc.dataset.auto; }); // tự gõ -> không tự điền đè
}
function resetCostForm(nhom, sub) {
  const keepNhom = nhom || cForm.elements.nhom.value;
  const keepSub = sub || cForm.elements.nhom_con.value;
  cForm.reset();
  if (cForm.elements.td) cForm.elements.td.value = String(tdDangChon()); // HĐ đầu vào mới: thuộc TĐ đang chọn
  cForm.elements.id.value = '';
  cForm.elements.nhom.value = keepNhom;
  fillSubOptions(keepNhom, keepSub);
  $('#c-form-title').textContent = 'Thêm chi phí';
  setCostMode();
  updateCostPreview();
}

async function saveCost() {
  const msg = $('#c-msg');
  const id = cForm.elements.id.value;
  const ngay = dmyToIso(cForm.elements.ngay.value);
  if (ngay === null) return showMsg(msg, 'Ngày không hợp lệ, nhập theo dạng dd/mm/yyyy', 'err');
  const e = cForm.elements;
  const reqDt = NHOM().find((n) => n.code === e.nhom.value)?.bat_buoc_doi_tac;
  if (reqDt && !costTpMode() && !e.doi_tac.value.trim()) return showMsg(msg, `Nhập ${reqDt.toLowerCase()}`, 'err');
  if (costTpMode() && tdDangChon() !== 1) return showMsg(msg, 'HĐ đầu vào mới chỉ tạo ở tab TĐ1', 'err');
  if (costTpMode()) {
    // Tạo hợp đồng thầu phụ kèm dòng HĐ gốc
    try {
      const so = e.so_tp.value.trim(), nhom = e.nhom.value;
      await api(`/api/du-an/${revProjectId}/thau-phu`, { method: 'POST', body: JSON.stringify({
        nhom, so_ma: so, doi_tac: e.doi_tac.value, hang_muc: e.hang_muc?.value || '', ghi_chu: e.ghi_chu.value, hd_cdt_id: e.hd_cdt.value,
        hd: { ngay, gia_tri: parseMoney(e.gia_tri.value), vat: e.vat.value, td: Number(e.td?.value) || 1 }, // ký ở TĐ1 / TĐ2 (HĐ ký thêm) / TĐ3
      }) });
      costOpen.add(nhom); moKhoiCua(nhom);
      tpOpen.add(Number(e.hd_cdt.value) || 0); // mở nhóm HĐ CĐT vừa thêm
      const hinh = e.hinh_thuc.value;
      tpGoiYAt = 0; // nạp lại bộ nhớ gợi ý (có nhà thầu / hạng mục mới)
      resetCostForm(nhom);
      e.hinh_thuc.value = hinh; setCostMode();
      showMsg(msg, `Đã tạo HĐ ${(TPN()[nhom] || '').toLowerCase()} ${so}. Nhấp đúp vào số HĐ ở bảng "1. Hợp đồng đầu vào" để nhập PL, HT/QT, thanh toán.`);
      await loadCost();
    } catch (err) {
      showMsg(msg, err.message, 'err');
    }
    return;
  }
  const body = {
    nhom: e.nhom.value, nhom_con: e.nhom_con.value, noi_dung: e.noi_dung.value, doi_tac: e.doi_tac.value,
    so_ct: e.so_ct.value, ngay, gia_tri: parseMoney(e.gia_tri.value), vat: e.vat.value, ghi_chu: e.ghi_chu.value,
  };
  try {
    await api(id ? `/api/chi-phi/${id}` : `/api/du-an/${revProjectId}/chi-phi`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    costOpen.add(body.nhom); moKhoiCua(body.nhom);
    if (body.nhom_con) costOpen.add(`${body.nhom}:${body.nhom_con}`);
    resetCostForm(body.nhom, body.nhom_con);
    showMsg(msg, id ? 'Đã cập nhật' : 'Đã thêm dòng');
    await loadCost();
  } catch (err) {
    showMsg(msg, err.message, 'err');
  }
}

// ---------- Bảng cây: Nhóm -> Hạng mục -> Chi tiết ----------
function renderCost() {
  renderDuTru();
  const { items, tong } = costData;
  const edit = can('tien') && !costAll;
  const daTag = (r) => (costAll && r.ma_du_an ? `<span class="c-da">${esc(r.ma_du_an)}</span>` : ''); // xem tổng hợp: ghi mã dự án
  const pct = (v) => (tong.sau_vat ? ((v / tong.sau_vat) * 100).toFixed(1) + '%' : '—');
  $('#c-k-sau').textContent = dvT(tong.sau_vat);
  $('#c-k-sub').innerHTML = `Trước VAT ${dvT(tong.gia_tri)} · VAT ${dvT(tong.tien_vat)}${tong.tam_tinh ? ' · <span class="warn-text" title="Có HĐ đầu vào chưa quyết toán">có HĐ tạm tính</span>' : ''}` +
    (tong.ngoai_cp.so_dong ? `<br>Không gồm trả nợ gốc vay: ${dvT(tong.ngoai_cp.sau_vat)}` : '') +
    (tong.vay?.so_dong ? `<br>Không gồm tiền vay nhận về (tiền vào): ${dvT(tong.vay.sau_vat)}` : '');
  for (const k of KHOI()) {
    const t = tong.theo_khoi[k.code];
    $(`#c-k-${k.code}`).textContent = dvT(t.sau_vat);
    $(`#c-k-${k.code}-sub`).textContent = `${pct(t.sau_vat)} tổng chi phí · ${t.so_dong} dòng`;
  }

  // Tỷ trọng chỉ hiện ở cấp nhóm và dòng tổng; hạng mục con, chi tiết để trống cho gọn
  const sumCells = (t, cls = '', showPct = true) => `
      <td class="num ${cls}">${dvm(t.gia_tri)}</td>
      <td class="num ${cls}">${dvm(t.sau_vat)}</td>
      <td class="num">${showPct ? pct(t.sau_vat) : ''}</td>`;
  const toggle = (key, n) => (n ? `<button class="grp-toggle" data-cgrp="${key}">${costOpen.has(key) ? '▾' : '▸'}</button>` : '<span class="grp-toggle-sp"></span>');
  const addBtn = (nhom, sub) => (edit ? `<button class="sm" data-cadd="${nhom}" data-csub="${sub || ''}" title="Thêm chi phí vào mục này">+</button>` : '');
  const ngoaiCp = (r) => Boolean(NHOM().find((n) => n.code === r.nhom)?.sub.find((sc) => sc.code === r.nhom_con)?.khong_tinh_cp);
  const detail = (r, no, indent, gc = '') => `
    <tr class="c-row ${gc}${ngoaiCp(r) ? ' ngoai-cp' : ''}" data-cid="${r.id}" title="${esc(r.nguoi_cap_nhat ? 'Cập nhật bởi ' + r.nguoi_cap_nhat : '')}">
      <td class="num muted">${no}</td>
      <td class="indent-${indent}"><span class="tree">└</span>${daTag(r)}${esc(r.noi_dung)}</td>
      <td class="c-dt">${esc(r.doi_tac)}${r.so_ct ? `<div class="muted small">${esc(r.so_ct)}</div>` : ''}</td><td>${dmy(r.ngay)}</td>
      <td class="num">${dvm(r.gia_tri)}</td>
      <td class="num strong">${dvm(r.sau_vat)}<div class="c-vat">${r.vat ? `VAT ${r.vat}%` : r.khong_vat ? 'Không VAT' : vatBadge(0)}</div></td>
      <td></td>
      <td class="c-note" title="${esc(r.ghi_chu)}">${esc(r.ghi_chu)}</td>
      <td class="row-actions">${edit ? `<button class="sm" data-cedit="${r.id}">Sửa</button><button class="danger sm" data-cdel="${r.id}">Xóa</button>` : ''}</td>
    </tr>`;

  // Bảng cây cho 1 khối: Nhóm -> Hạng mục -> Chi tiết
  const blockRows = (k) => {
    let html = '';
    nhomOf(k.code).forEach((n, i) => {
      const no = stt(k, i);
      const g = tong.theo_nhom[n.code];
      const rows = items.filter((r) => r.nhom === n.code);
      const tps = HDV.includes(n.code) ? costData.thau_phu.filter((c) => (c.nhom || 'thau_phu') === n.code) : [];
      const open = costOpen.has(n.code), gc = `c-gc${i % 6}`; // màu nền riêng cho từng nhóm (nhóm, hạng mục, chi tiết cùng tông)
      html += `<tr class="c-g1 ${gc}${open ? ' c-open' : ''}${(g.so_dong || tps.length) ? '' : ' c-empty'}"><td class="num">${no}</td>
        <td colspan="3">${toggle(n.code, rows.length || n.sub.length || tps.length)}<b>${esc(n.ten)}</b> <span class="muted small">(${tps.length ? `${new Set(tps.map((c) => c.hd_cdt_id || 0)).size} HĐ CĐT · ${tps.length} HĐ` + (rows.length ? ' + ' + rows.length + ' dòng lẻ' : '') : g.so_dong + ' dòng'})</span>${g.tam_tinh ? ' <span class="st st-tam-tinh">Có tạm tính</span>' : ''}</td>
        ${sumCells(g, 'strong')}<td></td><td class="row-actions">${addBtn(n.code, n.sub[0]?.code)}</td></tr>`;
      if (!open) return;
      // Hợp đồng đầu vào (thầu phụ, vật tư, MMTB, nhân công): gộp theo HĐ chủ đầu tư (cấp 2), từng HĐ là cấp 3
      const tpGs = tps.length ? tpGroups(tps) : [];
      tpGs.forEach((tg, j) => {
        const key = `${n.code}:hd${tg.k}`;
        const st = tg.rows.reduce((a, c) => ({ gia_tri: a.gia_tri + c.qt_gia_tri, tien_vat: a.tien_vat + c.qt_tien_vat, sau_vat: a.sau_vat + c.qt_sau_vat }), { gia_tri: 0, tien_vat: 0, sau_vat: 0 });
        html += `<tr class="c-g2 ${gc}${tg.k ? '' : ' tv-sub-warn'}"><td class="num muted">${no}.${j + 1}</td>
          <td colspan="3" class="indent-1">${toggle(key, tg.rows.length)}${tg.k ? `<span class="kind-tag kind-hd">HĐ CĐT</span> ${esc(hdCdtName(tg.k).replace(/^HĐ\s+/, ''))}` : '<span class="st st-tam-tinh">Chưa gắn HĐ CĐT</span>'}
            <span class="muted small">(${tg.rows.length} HĐ)</span></td>
          ${sumCells(st, '', false)}<td></td><td></td></tr>`;
        if (!costOpen.has(key)) return;
        tg.rows.forEach((c, x) => {
          html += `<tr class="c-row ${gc}">
            <td class="num muted">${no}.${j + 1}.${x + 1}</td>
            <td class="indent-2"><span class="tree">└</span><b class="tp-open" data-tp="${c.id}" title="Nhấp đúp để mở chi tiết">${esc(c.so_ma)}</b>${c.so_pl ? ` <span class="muted small">(+${c.so_pl} PL)</span>` : ''}</td>
            <td class="c-dt">${esc(c.doi_tac)}</td><td></td>
            <td class="num">${dvm(c.qt_gia_tri)}</td>
            <td class="num strong">${dvm(c.qt_sau_vat)}<div class="c-vat">HT/QT</div></td>
            <td></td><td class="c-note" title="${esc([c.hang_muc, c.ghi_chu].filter(Boolean).join(' · '))}">${esc(c.hang_muc || c.ghi_chu)}</td>
            <td class="row-actions"><button class="sm" data-tpopen="${c.id}">Chi tiết</button></td>
          </tr>`;
        });
      });
      if (!n.sub.length) {
        rows.forEach((r, x) => { html += detail(r, `${no}.${tpGs.length + x + 1}`, 1, gc); });
        return;
      }
      n.sub.forEach((sc, j) => {
        const key = `${n.code}:${sc.code}`;
        const sr = rows.filter((r) => r.nhom_con === sc.code);
        const st = g.sub[sc.code];
        html += `<tr class="c-g2 ${gc}${sc.khong_tinh_cp ? ' ngoai-cp' : ''}${st.so_dong ? '' : ' c-empty'}"><td class="num muted">${no}.${tpGs.length + j + 1}</td>
          <td colspan="3" class="indent-1">${toggle(key, sr.length)}${esc(sc.ten)} <span class="muted small">(${st.so_dong} dòng)</span></td>
          ${sumCells(st, '', false)}<td></td><td class="row-actions">${addBtn(n.code, sc.code)}</td></tr>`;
        if (costOpen.has(key)) sr.forEach((r, x) => { html += detail(r, `${no}.${tpGs.length + j + 1}.${x + 1}`, 2, gc); });
      });
      // Dòng cũ chưa chọn hạng mục (vd: Trả nợ vay nhập trước khi tách gốc/lãi) -> cần Sửa để phân loại
      const orphan = rows.filter((r) => !n.sub.some((sc) => sc.code === r.nhom_con));
      if (orphan.length) {
        const key = `${n.code}:_`;
        html += `<tr class="c-g2 ${gc}"><td class="num muted">${no}.${n.sub.length + 1}</td>
          <td colspan="3" class="indent-1">${toggle(key, orphan.length)}<span class="warn-text">Chưa phân loại hạng mục – bấm Sửa để chọn</span> <span class="muted small">(${orphan.length} dòng)</span></td>
          <td colspan="3"></td><td></td><td></td></tr>`;
        if (costOpen.has(key)) orphan.forEach((r, x) => { html += detail(r, `${no}.${n.sub.length + 1}.${x + 1}`, 2, gc); });
      }
    });
    return html;
  };

  const wrap = $('#c-blocks');
  if (!wrap.dataset.built) {
    wrap.dataset.built = '1';
    wrap.innerHTML = KHOI().map((k) => `
      <div class="card c-block" data-khoi="${k.code}">
        <div class="toolbar tv-head">
          <h2 class="c-khoi-h" data-ckhoi="${k.code}" role="button" tabindex="0" title="Bấm để mở / thu gọn"><span class="c-khoi-car">▸</span>${esc(k.ten)}</h2>
          <button type="button" class="sm" data-ctoggle="${k.code}">Mở tất cả</button>
          <div class="tv-total">Tổng: <b data-ktotal>0</b></div>
        </div>
        <div class="table-wrap">
          <table class="cost-table">
            <thead><tr>
              <th class="num">#</th><th>Nội dung</th><th>Đối tác / Số HĐ-CT</th><th>Ngày</th>
              <th class="num">Trước VAT</th><th class="num">Sau VAT</th><th class="num">Tỷ trọng</th><th>Ghi chú</th><th></th>
            </tr></thead>
            <tbody></tbody><tfoot></tfoot>
          </table>
        </div>
      </div>`).join('');
  }
  for (const k of KHOI()) {
    const card = $(`.c-block[data-khoi="${k.code}"]`);
    card.classList.toggle('c-thu', !cKhoiMo.has(k.code));
    cBlocksShow(cBlocksOn);
    if ($('#c-blocks-sum')) $('#c-blocks-sum').textContent = `Trực tiếp · Gián tiếp · Tài chính – ${tong.so_dong} dòng chi phí`;
    const t = tong.theo_khoi[k.code];
    $('[data-ktotal]', card).textContent = dvT(t.sau_vat);
    $('tbody', card).innerHTML = blockRows(k);
    $('tfoot', card).innerHTML = `<tr><td></td><td colspan="3">TỔNG ${esc(k.ten)}${t.tam_tinh ? ' <span class="st st-tam-tinh">Có tạm tính</span>' : ''}</td>${sumCells(t)}<td colspan="2"></td></tr>`;
    $('[data-ctoggle]', card).textContent = blockKeys(k.code).every((x) => costOpen.has(x)) ? 'Thu gọn tất cả' : 'Mở tất cả';
  }
  renderTpCard();
  if (tpDlgId) renderTpDlg();
}
const blockKeys = (khoi) => nhomOf(khoi).flatMap((n) => [n.code, ...n.sub.map((sc) => `${n.code}:${sc.code}`),
  ...(HDV.includes(n.code) && costData ? [...new Set(costData.thau_phu.filter((c) => (c.nhom || 'thau_phu') === n.code).map((c) => c.hd_cdt_id || 0))].map((k) => `${n.code}:hd${k}`) : [])]);

$('#tab-cost').addEventListener('dblclick', (e) => {
  const el = e.target.closest('.tp-open');
  if (el) { window.getSelection?.().removeAllRanges(); openTp(Number(el.dataset.tp)); }
});

$('#tab-cost').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-ckhoi]')) { e.preventDefault(); e.target.click(); } });
$('#tab-cost').addEventListener('click', async (e) => {
  if (e.target.closest('#c-blocks-toggle')) return cBlocksShow(!cBlocksOn);
  const kh = e.target.closest('[data-ckhoi]');
  if (kh) { const k = kh.dataset.ckhoi; cKhoiMo.has(k) ? cKhoiMo.delete(k) : cKhoiMo.add(k); kh.closest('.c-block').classList.toggle('c-thu', !cKhoiMo.has(k)); return; }
  const { cgrp, cadd, csub, cedit, cdel, tpopen, tpdel } = e.target.dataset;
  if (tpopen) return openTp(Number(tpopen));
  if (tpdel) return deleteTp(Number(tpdel));
  if (cgrp) { costOpen.has(cgrp) ? costOpen.delete(cgrp) : costOpen.add(cgrp); return renderCost(); }
  if (e.target.dataset.ctoggle) {
    const keys = blockKeys(e.target.dataset.ctoggle);
    const close = keys.every((k) => costOpen.has(k));
    keys.forEach((k) => (close ? costOpen.delete(k) : costOpen.add(k)));
    return renderCost();
  }
  if (cadd) {
    costOpen.add(cadd);
    resetCostForm(cadd, csub);
    showMsg($('#c-msg'), `Thêm vào: ${NHOM().find((n) => n.code === cadd).ten}${csub ? ' › ' + NHOM().find((n) => n.code === cadd).sub.find((s) => s.code === csub).ten : ''}`);
    cForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
    cForm.elements.noi_dung.focus({ preventScroll: true });
  }
  if (cedit) {
    const r = costData.items.find((x) => x.id === Number(cedit));
    if (!r) return;
    const el = cForm.elements;
    el.id.value = r.id;
    el.nhom.value = r.nhom;
    fillSubOptions(r.nhom, r.nhom_con);
    el.noi_dung.value = r.noi_dung; el.doi_tac.value = r.doi_tac || ''; el.so_ct.value = r.so_ct || '';
    el.ngay.value = isoToDmy(r.ngay); el.gia_tri.value = money(r.gia_tri); el.vat.value = r.vat; el.ghi_chu.value = r.ghi_chu || '';
    $('#c-form-title').textContent = 'Sửa chi phí';
    setCostMode();
    showMsg($('#c-msg'), 'Đang sửa: ' + r.noi_dung);
    updateCostPreview();
    cForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (cdel) {
    const r = costData.items.find((x) => x.id === Number(cdel));
    if (!r || !confirm(`Xóa chi phí "${r.noi_dung}" (${money(r.sau_vat)} đ)?`)) return;
    try {
      await api(`/api/chi-phi/${r.id}`, { method: 'DELETE' });
      await loadCost();
    } catch (err) { alert(err.message); }
  }
});

// ---------------------------------------------------------------------
// 1. THẦU PHỤ theo hợp đồng
// ---------------------------------------------------------------------
// Bộ lọc bảng thầu phụ: từ khóa + trạng thái quyết toán
const tpFilter = { q: '', loc: '', nhom: '' };
// Tình trạng quyết toán HĐ đầu vào: chua = chưa QT (đang thực hiện) · con = đã QT, còn phải trả (giữ bảo hành, chưa trả hết)
// · du = đã QT/đã trả đủ (còn lại = 0, khóa số) · vuot = trả vượt giá trị HT/QT
const tpTT = (c) => (c.con_lai < 0 ? 'vuot' : !(c.khoa || c.da_qt) ? 'chua' : c.con_lai === 0 ? 'du' : 'con');
const TP_TT = {
  chua: ['tp-st-chua', 'Chưa QT', 'Chưa quyết toán – đang thực hiện'],
  con: ['tp-st-con', 'Đã QT · còn phải trả', 'Đã quyết toán, còn tiền chưa trả (giữ bảo hành / chưa thanh toán hết)'],
  du: ['tp-st-lock', '🔒 Đã QT · trả đủ', 'Đã quyết toán và trả đủ (còn lại = 0) – khóa số'],
  vuot: ['tp-st-vuot', 'Trả vượt', 'Đã trả nhiều hơn giá trị HT/QT – cần kiểm tra'],
};
const tpDaQt = (c) => c.khoa || c.da_qt;
// Nhóm theo HĐ chủ đầu tư (0 = chưa gắn); mặc định thu gọn, đang lọc/tìm thì tự mở
const tpOpen = new Set();
const hdCdtName = (id) => costData?.hd_cdt?.find((h) => h.id === id)?.so_hieu || '';
function hdCdtOptions(sel) {
  return `<option value="">— Chưa gắn HĐ CĐT —</option>` +
    (costData?.hd_cdt || []).map((h) => `<option value="${h.id}" ${h.id === sel ? 'selected' : ''}>${esc(h.so_hieu)}</option>`).join('');
}
function tpGroups(list) {
  const order = new Map((costData.hd_cdt || []).map((h, i) => [h.id, i]));
  const map = new Map();
  for (const c of list) {
    const k = c.hd_cdt_id && order.has(c.hd_cdt_id) ? c.hd_cdt_id : 0;
    if (!map.has(k)) map.set(k, { k, rows: [] });
    map.get(k).rows.push(c);
  }
  return [...map.values()].sort((a, b) => (a.k ? order.get(a.k) : 1e6) - (b.k ? order.get(b.k) : 1e6));
}
// Ô loại HĐ trên từng dòng: người được sửa HĐ chọn đổi loại ngay tại bảng; người khác chỉ thấy nhãn
function tpKindCell(c, edit) {
  const k = c.nhom || 'thau_phu';
  if (!edit) return `<span class="tp-kind tp-k-${k}" title="${esc(TPN()[k])}">${TP_TAG[k]}</span>`;
  return `<select class="tp-kind tp-kind-sel tp-k-${k}" data-tpkind="${c.id}" title="Loại hợp đồng: ${esc(TPN()[k])} – chọn để chuyển loại" aria-label="Loại hợp đồng ${esc(c.so_ma)}">${HDV.map((x) =>
    `<option value="${x}" ${x === k ? 'selected' : ''}>${TP_NGAN[x]}</option>`).join('')}</select>`;
}
// Bảng HĐ đầu vào: số gọn theo triệu đồng (giữ phần lẻ nghìn nếu có), rê chuột xem số đồng đầy đủ
const mtr = (n) => `<span title="${money(n)} đồng">${dvNum(n, 'trieu', [0, 3])}</span>`;
// 4 thẻ tổng trên cùng: khi lọc Hợp đồng đầu vào (Loại / Quyết toán) -> hiện số của nhóm đang lọc (số chạy);
// bỏ lọc (Tất cả) -> trở về 4 thẻ chi phí trực tiếp / gián tiếp / tài chính / tổng
const C_KPI_GOC = {};
function kpiCount(el, to, fmt) {
  const from = Number(el.dataset.v || 0); el.dataset.v = to;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || from === to) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 550;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - (1 - k) ** 3; el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1 && el.dataset.v == to) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function costKpiByTp(list, leSv) {
  const box = $('#c-k-sau')?.closest('.kpis'); if (!box) return;
  const cards = [...box.querySelectorAll('.kpi')];
  if (!C_KPI_GOC.lab) C_KPI_GOC.lab = cards.map((k) => k.querySelector('.label').textContent);
  const on = Boolean(tpFilter.nhom || tpFilter.loc), was = box.classList.contains('kpi-tp');
  box.classList.toggle('kpi-tp', on);
  box.dataset.tk = tpFilter.nhom || 'all';
  if (!on) { // trả lại thẻ gốc: nhãn + số chi phí (vẽ lại 1 lần khi vừa bỏ lọc)
    cards.forEach((k, i) => { k.querySelector('.label').textContent = C_KPI_GOC.lab[i]; const v = k.querySelector('.value'); v.dataset.v = 0; v.classList.remove('neg'); });
    box.querySelector('.kpi-tp-tag')?.remove();
    if (was) renderCost();
    return;
  }
  const S = (f) => list.reduce((a, c) => a + c[f], 0);
  const ten = tpFilter.nhom ? TP_NGAN[tpFilter.nhom] : 'HĐ đầu vào';
  const loc = { chua: 'chưa QT', con: 'đã QT · còn phải trả', du: 'đã QT · trả đủ' }[tpFilter.loc];
  const nQt = list.filter((c) => c.khoa || c.da_qt).length, nPl = list.reduce((a, c) => a + (c.so_pl || 0), 0);
  const data = [
    [`Giá trị HĐ · ${ten}`, S('hd_sau_vat') + leSv, `${list.length} HĐ · ${nPl} PL${leSv ? ` + mua lẻ ${dvT(leSv)}` : ''} · sau VAT`],
    ['Giá trị HT/QT', S('qt_sau_vat') + leSv, `${nQt}/${list.length} HĐ đã quyết toán${leSv ? ' · gồm mua lẻ' : ''}`],
    ['Đã thanh toán', S('da_tt') + leSv, leSv ? `gồm mua lẻ ${dvT(leSv)}` : `${list.reduce((a, c) => a + c.pays.length, 0)} lần thanh toán`],
    ['Còn lại phải trả', S('con_lai'), '= HT/QT − đã thanh toán'],
  ];
  cards.forEach((k, i) => {
    k.querySelector('.label').textContent = data[i][0];
    const v = k.querySelector('.value'); v.classList.toggle('neg', data[i][1] < 0);
    kpiCount(v, data[i][1], (x) => dvT(x));
    k.querySelector('.sub').textContent = data[i][2];
  });
  let tag = box.querySelector('.kpi-tp-tag');
  if (!tag) { tag = document.createElement('button'); tag.type = 'button'; tag.className = 'kpi-tp-tag'; box.prepend(tag); }
  tag.innerHTML = `Đang xem: <b>${esc(ten)}</b>${loc ? ` · ${loc}` : ''} <span>× Xem tất cả chi phí</span>`;
}

function renderTpCard() {
  const tatCa = costData.thau_phu;
  const daTag = (c) => (costAll && c.ma_du_an ? `<span class="c-da">${esc(c.ma_du_an)}</span>` : '');
  // Lọc theo loại HĐ: luôn hiện đủ 4 loại (kèm số lượng) để người dùng biết có thể tạo / chuyển loại
  const nhoms = HDV;
  const dem = (k) => (k ? tatCa.filter((c) => (c.nhom || 'thau_phu') === k).length : tatCa.length);
  // Chi phí mua lẻ (không HĐ) của vật tư / MMTB / nhân công – hiện kèm để bảng trên khớp cây chi phí bên dưới
  const leOf = (k) => (costData.items || []).filter((r) => r.nhom === k);
  const coLe = (k) => (k ? leOf(k).length : LE_NHOM.some((x) => leOf(x).length));
  $('#tp-nhom').innerHTML = ['', ...nhoms].map((k) => `<button type="button" data-v="${k}" class="${tpFilter.nhom === k ? 'on' : ''} ${dem(k) || coLe(k) ? '' : 'zero'}" title="${k ? esc(TPN()[k]) : 'Tất cả loại'}${k && leOf(k).length ? ` · ${dem(k)} HĐ + ${leOf(k).length} dòng mua lẻ` : ''}">${k ? TP_NGAN[k] : 'Tất cả'} <span class="cnt">${dem(k)}${k && leOf(k).length ? '<i>+lẻ</i>' : ''}</span></button>`).join('');
  const all = tpFilter.nhom ? tatCa.filter((c) => (c.nhom || 'thau_phu') === tpFilter.nhom) : tatCa;
  const edit = can('hd') && !costAll;
  const nTT = (k) => all.filter((c) => (k === 'con' ? ['con', 'vuot'].includes(tpTT(c)) : tpTT(c) === k)).length;
  $$('#tp-loc button').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === tpFilter.loc);
    b.innerHTML = { '': `Tất cả <span class="cnt">${all.length}</span>`, chua: `<i class="tp-dot d-chua"></i>Chưa QT <span class="cnt">${nTT('chua')}</span>`,
      con: `<i class="tp-dot d-con"></i>Đã QT · còn phải trả <span class="cnt">${nTT('con')}</span>`, du: `<i class="tp-dot d-du"></i>Đã QT · trả đủ <span class="cnt">${nTT('du')}</span>` }[b.dataset.v];
  });
  const q = normVn(tpFilter.q);
  const list = all.filter((c) =>
    (!tpFilter.loc || (tpFilter.loc === 'con' ? ['con', 'vuot'].includes(tpTT(c)) : tpTT(c) === tpFilter.loc)) &&
    (!q || normVn(`${c.so_ma} ${c.doi_tac} ${c.hang_muc || ''} ${c.ghi_chu} ${hdCdtName(c.hd_cdt_id)}`).includes(q)));
  const filtered = list.length !== tatCa.length;
  const sumOf = (rows, f) => rows.reduce((s, c) => s + c[f], 0);
  const T = filtered ? { so_hd: list.length, hd_sau_vat: sumOf(list, 'hd_sau_vat'), qt_sau_vat: sumOf(list, 'qt_sau_vat'), da_tt: sumOf(list, 'da_tt'), con_lai: sumOf(list, 'con_lai') } : costData.tong_tp;
  $('#tp-total').innerHTML = `${mtr(costData.tong_tp.con_lai)} <small>${dvKey('trieu') === 'trieu' ? 'triệu' : dvU('trieu').ngan}</small>`;
  if ($('#tp-unit')) $('#tp-unit').textContent = `Đơn vị: ${dvU('trieu').ten} · sau VAT`;

  const groups = tpGroups(list);
  const autoOpen = Boolean(q) || Boolean(tpFilter.loc) || groups.length === 1;
  costKpiByTp(list, !tpFilter.loc && tpFilter.nhom && LE_NHOM.includes(tpFilter.nhom) ? leOf(tpFilter.nhom).reduce((a, r) => a + r.sau_vat, 0) : 0);
  // Nhóm "Mua lẻ – không HĐ": theo bộ lọc loại; ẩn khi đang lọc quyết toán / tìm kiếm (chỉ áp dụng cho HĐ)
  const leNhoms = q || tpFilter.loc ? [] : LE_NHOM.filter((k) => (!tpFilter.nhom || tpFilter.nhom === k) && leOf(k).length);
  const leSv = (k) => leOf(k).reduce((a, r) => a + r.sau_vat, 0);
  const leTot = leNhoms.reduce((a, k) => a + leSv(k), 0);
  const leHtml = !leNhoms.length ? '' : `<tr class="tv-head-row tp-le-head">
      <td class="num">${groups.length + 1}</td>
      <td colspan="2"><button class="grp-toggle" data-tpgrp="le" title="${tpOpen.has('le') ? 'Thu gọn' : 'Mở chi tiết'}">${tpOpen.has('le') ? '▾' : '▸'}</button>
        <span class="kind-tag tp-le-tag">Mua lẻ</span> <b>Không có hợp đồng</b> <span class="muted small">(${leNhoms.reduce((a, k) => a + leOf(k).length, 0)} dòng chi phí)</span></td>
      <td class="num strong">${mtr(leTot)}</td><td class="num strong">${mtr(leTot)}</td><td class="num strong">${mtr(leTot)}</td>
      <td class="num tv-head-sum">${mtr(0)}</td><td colspan="2" class="muted small">Nhập ở bảng chi phí bên dưới</td></tr>` +
    (!tpOpen.has('le') ? [] : leNhoms).map((k, i) => `<tr class="tv-child tp-le-row">
      <td class="num muted">${groups.length + 1}.${i + 1}</td>
      <td class="indent tp-hd"><div class="tp-l1"><span class="tp-kind tp-k-${k}">${TP_NGAN[k]}</span><b>Mua lẻ</b></div><div class="tp-l2"><span>${leOf(k).length} dòng chứng từ</span></div></td>
      <td class="c-dt tp-dt muted">Nhiều đối tác</td>
      <td class="num">${mtr(leSv(k))}</td><td class="num">${mtr(leSv(k))}</td><td class="num">${mtr(leSv(k))}</td><td class="num muted">${mtr(0)}</td>
      <td class="c-note tp-note">Đã chi theo chứng từ</td>
      <td class="row-actions tp-act"><button class="sm" data-leopen="${k}">Xem dòng</button></td></tr>`).join('');
  const childRow = (c, stt) => `
    <tr class="tv-child" data-tpid="${c.id}">
      <td class="num muted">${stt}</td>
      <td class="indent tp-hd"><div class="tp-l1">${daTag(c)}${tpKindCell(c, edit)}<b class="tp-open so-ma-pick" data-tp="${c.id}" title="Nhấp đúp để mở bảng nhập chi tiết">${esc(c.so_ma)}</b></div>
        <div class="tp-l2">${(([cls, lab, tip]) => `<span class="tp-st ${cls}" title="${tip}">${lab}</span>`)(TP_TT[tpTT(c)])}${c.so_pl ? `<span>${c.so_pl} phụ lục</span>` : '<span>Không phụ lục</span>'}</div></td>
      <td class="c-dt tp-dt">${esc(c.doi_tac)}</td>
      <td class="num">${mtr(c.hd_sau_vat)}</td>
      <td class="num">${mtr(c.qt_sau_vat)}</td>
      <td class="num">${mtr(c.da_tt)}</td>
      <td class="num strong ${c.con_lai < 0 ? 'neg' : ''}">${mtr(c.con_lai)}</td>
      <td class="c-note tp-note" title="${esc([c.hang_muc, c.ghi_chu].filter(Boolean).join(' · '))}">${c.hang_muc ? `<span class="tp-hm">${esc(c.hang_muc)}</span>` : ''}${c.ghi_chu ? `<small class="muted">${esc(c.ghi_chu)}</small>` : ''}</td>
      <td class="row-actions tp-act"><button class="sm" data-tpopen="${c.id}">Chi tiết</button>${edit ? `<button class="danger sm" data-tpdel="${c.id}" title="Xóa hợp đồng">Xóa</button>` : ''}</td>
    </tr>`;
  // Trong mỗi HĐ CĐT: gom theo loại HĐ đầu vào (Thầu phụ · Vật tư · MMTB · Nhân công), mỗi loại 1 dòng cộng, bấm để mở các HĐ
  const tpLoaiRows = (g, n) => HDV.map((k) => [k, g.rows.filter((c) => (c.nhom || 'thau_phu') === k)]).filter(([, r]) => r.length).map(([k, rows], li) => {
    const key = `${g.k}:${k}`, mo = Boolean(q) || tpOpen.has(key), cl = sumOf(rows, 'con_lai'); // nhóm loại mặc định thu gọn (chỉ tự mở khi đang tìm kiếm)
    return `<tr class="tv-sub-row tp-loai-row">
      <td class="num muted">${n}.${li + 1}</td>
      <td colspan="2" class="indent"><button class="grp-toggle" data-tpsub="${esc(key)}" title="${mo ? 'Thu gọn' : 'Mở các hợp đồng'}">${mo ? '▾' : '▸'}</button>
        <span class="tp-kind tp-k-${k}">${TP_NGAN[k]}</span> <span class="muted small">(${rows.length} HĐ · ${rows.filter(tpDaQt).length} đã QT)</span></td>
      <td class="num">${mtr(sumOf(rows, 'hd_sau_vat'))}</td><td class="num">${mtr(sumOf(rows, 'qt_sau_vat'))}</td><td class="num">${mtr(sumOf(rows, 'da_tt'))}</td>
      <td class="num strong ${cl < 0 ? 'neg' : ''}">${mtr(cl)}</td><td colspan="2"></td>
    </tr>` + (mo ? rows.map((c, i) => childRow(c, `${n}.${li + 1}.${i + 1}`)).join('') : '');
  }).join('');
  $('#tp-tbody').innerHTML = list.length ? groups.map((g, gi) => {
    const n = gi + 1;
    const open = autoOpen || tpOpen.has(g.k);
    const nQt = g.rows.filter(tpDaQt).length;
    const cl = sumOf(g.rows, 'con_lai');
    return `<tr class="tv-head-row ${g.k ? '' : 'tv-sub-warn'}">
      <td class="num">${n}</td>
      <td colspan="2"><button class="grp-toggle" data-tpgrp="${g.k}" title="${open ? 'Thu gọn' : 'Mở chi tiết'}">${open ? '▾' : '▸'}</button>
        ${g.k ? `<span class="kind-tag kind-hd">HĐ CĐT</span> <b>${esc(hdCdtName(g.k).replace(/^HĐ\s+/, ''))}</b>` : '<span class="st st-tam-tinh">Chưa gắn HĐ CĐT</span>'}
        <span class="muted small">(${g.rows.length} HĐ · ${nQt} đã QT)</span></td>
      <td class="num strong">${mtr(sumOf(g.rows, 'hd_sau_vat'))}</td>
      <td class="num strong">${mtr(sumOf(g.rows, 'qt_sau_vat'))}</td>
      <td class="num strong">${mtr(sumOf(g.rows, 'da_tt'))}</td>
      <td class="num tv-head-sum ${cl < 0 ? 'neg' : ''}">${mtr(cl)}</td>
      <td colspan="2" class="muted small">${g.k ? '' : 'Mở chi tiết HĐ để gắn'}</td>
    </tr>` + (open ? tpLoaiRows(g, n) : '');
  }).join('') + leHtml : leHtml || `<tr><td colspan="9" class="empty">${all.length ? 'Không có hợp đồng phù hợp bộ lọc' : `Chưa có hợp đồng. ${edit ? 'Ở form trên chọn nhóm Thầu phụ, hoặc Vật tư / MMTB / Nhân công với Hình thức = Hợp đồng để tạo.' : ''}`}</td></tr>`;
  $('#tp-tfoot').innerHTML = `<tr><td></td><td colspan="2">${filtered ? `TỔNG ĐANG LỌC (${T.so_hd}/${tatCa.length} HĐ)` : `TỔNG HĐ ĐẦU VÀO (${T.so_hd} HĐ)`}</td>
    <td class="num">${mtr(T.hd_sau_vat)}</td><td class="num">${mtr(T.qt_sau_vat)}</td><td class="num">${mtr(T.da_tt)}</td>
    <td class="num ${T.con_lai < 0 ? 'neg' : ''}">${mtr(T.con_lai)}</td><td colspan="2"></td></tr>` + (leTot ? `<tr class="tp-grand"><td></td><td colspan="2">TỔNG GỒM MUA LẺ <span class="muted small">(khớp bảng chi phí bên dưới)</span></td>
    <td class="num">${mtr(T.hd_sau_vat + leTot)}</td><td class="num">${mtr(T.qt_sau_vat + leTot)}</td><td class="num">${mtr(T.da_tt + leTot)}</td>
    <td class="num ${T.con_lai < 0 ? 'neg' : ''}">${mtr(T.con_lai)}</td><td colspan="2"></td></tr>` : '');
  const btn = $('#tp-toggle-all');
  btn.hidden = autoOpen || !list.length;
  btn.textContent = groups.some((g) => !tpOpen.has(g.k) || HDV.some((k) => g.rows.some((c) => (c.nhom || 'thau_phu') === k) && !tpOpen.has(`${g.k}:${k}`))) ? 'Mở tất cả' : 'Thu gọn tất cả';
  // Ô chọn HĐ CĐT ở form tạo HĐTP
  const sel = cForm?.elements.hd_cdt;
  if (sel) { const keep = Number(sel.value) || null; sel.innerHTML = hdCdtOptions(keep); }
}

$('#tp-toggle-all').addEventListener('click', () => {
  const G = tpGroups(costData.thau_phu);
  const ks = [...G.map((g) => g.k), ...G.flatMap((g) => HDV.map((k) => `${g.k}:${k}`)), 'le']; // gồm nhóm loại HĐ và nhóm Mua lẻ
  const close = ks.every((k) => tpOpen.has(k));
  ks.forEach((k) => (close ? tpOpen.delete(k) : tpOpen.add(k)));
  renderTpCard();
});
$('#tp-tbody').addEventListener('click', (e) => {
  const le = e.target.closest('[data-leopen]')?.dataset.leopen;
  if (le) { // mở nhóm chi phí tương ứng ở cây chi phí và cuộn tới
    moKhoiCua(le); costOpen.add(le); NHOM().find((n) => n.code === le)?.sub.forEach((sc) => costOpen.add(`${le}:${sc.code}`));
    renderCost();
    return $(`[data-cgrp="${le}"]`)?.closest('tr')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const sub = e.target.dataset.tpsub;
  if (sub) { tpOpen.has(sub) ? tpOpen.delete(sub) : tpOpen.add(sub); return renderTpCard(); }
  const k = e.target.dataset.tpgrp;
  if (k === undefined) return;
  const n = k === 'le' ? 'le' : Number(k); // 'le' = nhóm Mua lẻ (không HĐ)
  tpOpen.has(n) ? tpOpen.delete(n) : tpOpen.add(n);
  renderTpCard();
});
$('#tp-q').addEventListener('input', (e) => { tpFilter.q = e.target.value; if (costData) renderTpCard(); });
// Đổi loại HĐ ngay trên bảng
$('#tp-tbody').addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-tpkind]');
  if (!sel) return;
  const c = costData.thau_phu.find((x) => x.id === Number(sel.dataset.tpkind));
  if (!c) return;
  const cu = c.nhom || 'thau_phu';
  sel.disabled = true;
  try {
    await api(`/api/thau-phu/${c.id}`, { method: 'PUT', body: JSON.stringify({ nhom: sel.value, so_ma: c.so_ma, doi_tac: c.doi_tac, hang_muc: c.hang_muc || '', ghi_chu: c.ghi_chu, hd_cdt_id: c.hd_cdt_id ?? '' }) });
    showMsg($('#c-msg'), `Đã chuyển HĐ ${c.so_ma} từ ${TPN()[cu]} sang ${TPN()[sel.value]}.`);
    costOpen.add(sel.value); moKhoiCua(sel.value);
    await loadCost();
  } catch (err) { sel.value = cu; sel.disabled = false; alert(err.message); }
});
// Bấm nhãn "Đang xem ..." trên thẻ tổng: bỏ lọc, trở về số chi phí
document.addEventListener('click', (e) => {
  if (!e.target.closest('.kpi-tp-tag')) return;
  tpFilter.nhom = ''; tpFilter.loc = '';
  if (costData) renderTpCard();
});
$('#tp-nhom').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tpFilter.nhom = b.dataset.v;
  if (costData) renderTpCard();
});
$('#tp-loc').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tpFilter.loc = b.dataset.v;
  if (costData) renderTpCard();
});

async function deleteTp(id) {
  const c = costData.thau_phu.find((x) => x.id === id);
  if (!c) return;
  const pc = await askPasscode(`Xóa hợp đồng ${tpTen(c)} "${c.so_ma}"?`,
    `Sẽ xóa tất cả dữ liệu sau:\n• ${c.lines.length} dòng HĐ/PL – giá trị HĐ ${money(c.hd_sau_vat)} đ, HT/QT ${money(c.qt_sau_vat)} đ\n• ${c.pays.length} dòng thanh toán – ${money(c.da_tt)} đ\nThao tác này không hoàn tác được.`);
  if (pc === null) return;
  try {
    await api(`/api/thau-phu/${id}`, { method: 'DELETE', body: JSON.stringify({ passcode: pc }) });
    if (tpDlgId === id) closeTp();
    await loadCost();
  } catch (err) { alert(err.message); }
}

// ---------- Bảng nhập chi tiết 1 HĐ thầu phụ (hộp thoại) ----------
let tpDlgId = null;
let tpDrafts = { lines: [], pays: [] };
let tpSeq = 0;
const TT_LABEL = { tam_ung: 'Tạm ứng', dot: 'TT Đợt', quyet_toan: 'QT Đợt' };
const tpMoKhoa = new Set(); // HĐ đầu vào đang mở khóa tạm (đã nhập Passcode) – khóa lại khi đóng bảng chi tiết

function openTp(id) {
  if (!costData.thau_phu.some((c) => c.id === id)) return;
  tpDlgId = id;
  tpDrafts = { lines: [], pays: [] };
  if ($('#tp-dlg')) $('#tp-dlg').dataset.tp = ''; // mở mới: không giữ số nhập dở của lần trước
  let dlg = $('#tp-dlg');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'tp-dlg';
    dlg.className = 'tp-dlg';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', onTpDlgClick);
    dlg.addEventListener('input', onTpDlgInput);
    dlg.addEventListener('keydown', (e) => {
      const tr = e.target.closest('tr[data-k]');
      if (e.key === 'Enter' && tr) { e.preventDefault(); $('[data-save]', tr)?.click(); }
    });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeTp(); });
  }
  renderTpDlg();
  if (!dlg.open) dlg.showModal();
}
function closeTp() {
  if (tpDlgId && tpMoKhoa.has(tpDlgId)) { // khóa lại: nếu Còn lại vẫn = 0 thì HĐ tự khóa như cũ
    const id = tpDlgId; tpMoKhoa.delete(id);
    api(`/api/thau-phu/${id}/khoa`, { method: 'POST' }).then(() => loadCost()).catch(() => {});
  }
  tpDlgId = null;
  const dlg = $('#tp-dlg');
  if (dlg?.open) dlg.close();
}

// Tính sau VAT ngay trên trình duyệt (cùng công thức máy chủ)
const tpCalc = (gt, vat) => { const g = Number(parseMoney(gt)) || 0; const v = Number(vat) || 0; return g + calcVat(g, v); };

function renderTpDlg() {
  const c = costData.thau_phu.find((x) => x.id === tpDlgId);
  const dlg = $('#tp-dlg');
  if (!c) return closeTp();
  // Giữ số đang nhập dở: dòng đã gõ mà chưa Lưu (kể cả dòng mới) -> ghi nhớ trước khi vẽ lại, điền lại sau khi vẽ
  const keep = new Map();
  if (dlg.dataset.tp === String(c.id)) $$('[data-k][data-dirty]', dlg).forEach((tr) => keep.set(tr.dataset.k, $$('[data-f]', tr).map((x) => [x.dataset.f, x.value])));
  dlg.dataset.tp = String(c.id);
  const canInfo = can('hd') && !costAll, canPay = can('tien') && !costAll; // xem tổng hợp tất cả dự án: chỉ xem
  const moKhoa = c.khoa && tpMoKhoa.has(c.id); // đã thanh toán đủ nhưng đang mở khóa tạm để sửa
  const locked = c.khoa && !moKhoa;
  const editL = canInfo && !locked, editP = canPay && !locked; // Còn lại = 0 -> khóa số; HĐ/PL: QS · thanh toán: Kế toán
  const edit = editL || editP;
  const inp = (name, val, attrs = '', ok = edit) => `<input data-f="${name}" value="${esc(val ?? '')}" ${attrs} ${ok ? '' : 'disabled'}>`;
  const nextPl = 'PL' + String(Math.max(0, ...c.lines.map((l) => (l.ma_loai === 'HĐ' ? 0 : Number(l.ma_loai.slice(2)))), ...tpDrafts.lines.map((d) => Number(d.ma_loai.slice(2)))) + 1).padStart(2, '0');

  // Tổng TĐ1 / TĐ2 / TĐ3 (trước VAT): TĐ1 ký · TĐ2 = TĐ1 + đợt điều chỉnh · TĐ3 = HT/QT (trống = TĐ2) – cùng cách tính với Báo cáo
  const tpTdTong = (lines) => lines.reduce((a, l) => {
    const t1 = Number(l.gia_tri_ky ?? l.gia_tri) || 0, t2 = Number(l.gia_tri) || 0, q = nnV(l.gia_tri_qt);
    return [a[0] + t1, a[1] + t2, a[2] + (q ?? t2)];
  }, [0, 0, 0]);
  const lineRow = (l, draft) => {
    const qtStr = l.gia_tri_qt === null || l.gia_tri_qt === undefined ? '' : money(l.gia_tri_qt);
    const gtStr = draft ? '' : money(l.gia_tri_ky ?? l.gia_tri); // giá trị KÝ (TĐ1)
    const hdSau = draft ? 0 : l.sau_vat;
    const qtSau = draft ? 0 : l.qt_sau_vat;
    const t1 = Number(l.gia_tri_ky ?? l.gia_tri) || 0, t2 = Number(l.gia_tri) || 0;
    const md = tdDangChon(), lk = !draft && nnV(l.gia_tri_qt) !== null; // có số quyết toán = khoá dòng
    const ok1 = editL && md === 1 && !lk, ok3 = editL && md === 3 && !lk;
    return `<tr data-k="${draft ? 'dl' + l.key : 'l' + l.id}" data-dc="${draft ? 0 : t2 - t1}" class="${draft ? 'tv-draft' : l.ma_loai === 'HĐ' ? 'tp-hd-row' : 'tp-pl-row'}">
      <td>${l.ma_loai === 'HĐ' ? '' : '<span class="tree">└</span>'}<span class="kind-tag ${l.ma_loai === 'HĐ' ? 'kind-hd' : ''}">${l.ma_loai}</span> <b>${esc(c.so_ma)}</b>${draft ? ' <span class="st st-tam-tinh">Chưa lưu</span>' : ''}</td>
      <td>${inp('ngay', draft ? '' : isoToDmy(l.ngay), 'class="date-dmy"', ok1 || draft)}</td>
      <td>${inp('gia_tri', gtStr, 'class="money num" placeholder="0 · giảm: số âm"', ok1 || draft)}</td>
      <td class="num">${draft ? '<span class="muted small">lưu dòng trước</span>' : `${editL && md === 2 && !lk ? `<button type="button" class="link-btn" data-tpdot="${l.id}" title="Xem / thêm điều chỉnh">${dvm(t2)}</button>` : dvm(t2)}${tdDelta(t2, t1)}${(l.dot || []).length ? `<div class="td-note muted">${l.dot.length} đợt</div>` : ''}${editL && md === 2 && !lk ? `<div><button type="button" class="sm" data-tpdot="${l.id}">± Điều chỉnh</button></div>` : ''}`}</td>
      <td>${inp('vat', draft ? '' : l.vat || '', 'type="number" min="0" max="100" step="1" class="vat-in" placeholder="0"', ok1 || draft)}</td>
      <td class="num strong" data-calc="hd">${dvm(hdSau)}</td>
      <td>${lk ? `<span class="num-lk" title="Đã có số quyết toán – dòng đang khoá">🔒 ${dvm(l.gia_tri_qt)}</span>` : inp('gia_tri_qt', qtStr, 'class="money num" placeholder="= TĐ2"', ok3)}</td>
      <td class="num strong" data-calc="qt">${dvm(qtSau) + (!draft && !l.da_qt ? '<div class="muted small">chưa QT</div>' : '')}</td>
      <td>${inp('ghi_chu', draft ? '' : l.ghi_chu, 'maxlength="500"', ok1 || draft)}</td>
      <td class="row-actions">${!editL ? '' : lk ? (md === 3 ? '<button class="sm" data-tpmoqt>🔓 Mở khoá</button>' : '<span class="muted small">🔒 Khoá</span>')
        : draft || md === 1 ? `<button class="primary sm" data-save ${draft ? '' : 'hidden'}>Lưu</button>${l.ma_loai === 'HĐ' ? '' : `<button class="danger sm" data-del>${draft ? 'Bỏ' : 'Xóa'}</button>`}`
          : md === 3 ? '<button class="primary sm" data-save hidden>Lưu QT</button>' : ''}</td>
    </tr>`;
  };
  const payLabel = (p, draft) => (p.loai === 'dot' || p.loai === 'quyet_toan'
    ? `${TT_LABEL[p.loai]} ${editP ? `<input data-f="dot" type="number" min="1" max="999" class="tv-dot" value="${esc(p.dot ?? '')}">` : esc(p.dot ?? '')}`
    : TT_LABEL[p.loai]) + (draft ? ' <span class="st st-tam-tinh">Chưa lưu</span>' : '');
  const payRow = (p, draft) => `<tr data-k="${draft ? 'dp' + p.key : 'p' + p.id}" class="${draft ? 'tv-draft' : ''} ${p.loai === 'quyet_toan' ? 'tp-qt-row' : ''}">
      <td><b>${payLabel(p, draft)}</b></td>
      <td>${inp('ngay', draft ? '' : isoToDmy(p.ngay), 'class="date-dmy"', editP)}</td>
      <td>${inp('so_tien', draft ? '' : money(p.so_tien), 'class="money num" placeholder="Nhập giá trị"', editP)}</td>
      <td>${inp('ghi_chu', draft ? '' : p.ghi_chu, 'maxlength="500"', editP)}</td>
      <td class="row-actions">${editP ? `<button class="primary sm" data-save ${draft ? '' : 'hidden'}>Lưu</button><button class="danger sm" data-del>${draft ? 'Bỏ' : 'Xóa'}</button>`
        : ''}</td>
    </tr>`;
  const payCls = (p) => (p.loai === 'quyet_toan' ? 'tp-qt-row' : '');

  dlg.innerHTML = `
    <div class="tp-dlg-head">
      <div>
        <div class="muted small">Hợp đồng ${tpTen(c)} · ${esc(c.ma_du_an || costData.du_an.ma_du_an)}</div>
        <h3>${esc(c.so_ma)} ${locked ? '<span class="st st-lock">🔒 Thanh toán đủ · Khóa số</span>' : moKhoa ? '<span class="st st-tam-tinh">🔓 Đang mở khóa</span>' : c.da_qt ? '<span class="st st-hoan-thanh">Đã QT</span>' : '<span class="st">Chưa QT</span>'}</h3>
      </div>
      <button class="ghost-dark" data-close title="Đóng (Esc)">✕</button>
    </div>
    ${locked ? `<div class="lock-bar">🔒 Hợp đồng đã thanh toán đủ – <b>Giá trị còn lại = 0</b>, đã <b>khóa chỉnh sửa</b>. Muốn điều chỉnh, bấm <b>Mở khóa</b> (cần Passcode); số liệu giữ nguyên.${canInfo || canPay ? ' <button type="button" class="sm" data-tpmokhoa>🔓 Mở khóa</button>' : ''}</div>` : ''}${moKhoa ? '<div class="lock-bar unlock-bar">🔓 Đang mở khóa để điều chỉnh. Đóng bảng chi tiết sẽ tự khóa lại nếu Giá trị còn lại vẫn = 0.</div>' : ''}
    ${canInfo ? `<div class="grid-form tp-info" data-k="info">
      <label>Loại hợp đồng<select data-f="nhom">${HDV.map((k) => `<option value="${k}" ${k === (c.nhom || 'thau_phu') ? 'selected' : ''}>${esc(TPN()[k])}</option>`).join('')}</select></label>
      <label>Số HĐ *<input data-f="so_ma" value="${esc(c.so_ma)}" maxlength="120"></label>
      <label>${TP_DT[c.nhom || 'thau_phu']}<input data-f="doi_tac" value="${esc(c.doi_tac)}" maxlength="200"></label>
      <label class="span-2">Hạng mục thi công<input data-f="hang_muc" value="${esc(c.hang_muc || '')}" maxlength="300" placeholder="VD: Móng, kết cấu BTCT"></label>
      <label>Thuộc HĐ chủ đầu tư<select data-f="hd_cdt_id">${hdCdtOptions(c.hd_cdt_id)}</select></label>
      <label class="span-2">Ghi chú<input data-f="ghi_chu" value="${esc(c.ghi_chu)}" maxlength="500"></label>
      <div class="actions"><button class="primary sm" data-save hidden>Lưu thông tin</button></div>
    </div>` : `<p class="muted">${esc(TPN()[c.nhom || 'thau_phu'])} · ${TP_DT[c.nhom || 'thau_phu']}: <b>${esc(c.doi_tac || '—')}</b> · Thuộc HĐ CĐT: <b>${esc(hdCdtName(c.hd_cdt_id) || 'chưa gắn')}</b>${c.ghi_chu ? ' · ' + esc(c.ghi_chu) : ''}</p>`}
    <div class="kpis tp-kpis">
      <div class="kpi"><div class="label">Tổng giá trị HĐ</div><div class="value">${dvm(c.hd_sau_vat)}</div><div class="sub">HĐ + ${c.so_pl} PL, sau VAT</div></div>
      <div class="kpi"><div class="label">Tổng giá trị HT/QT</div><div class="value">${dvm(c.qt_sau_vat)}</div><div class="sub">${c.da_qt ? 'Theo giá trị HT/QT đã nhập' : 'Chưa QT = theo giá trị HĐ/PL'}</div></div>
      <div class="kpi"><div class="label">Giá trị thanh toán</div><div class="value">${dvm(c.da_tt)}</div><div class="sub">${c.pays.length} lần</div></div>
      <div class="kpi"><div class="label">Giá trị còn lại</div><div class="value ${c.con_lai < 0 ? 'neg' : ''}">${dvm(c.con_lai)}</div><div class="sub">= HT/QT − Thanh toán</div></div>
    </div>

    <h4>Giá trị HĐ / PL</h4>
    <div data-td-mode class="td-mode"></div>
    <div class="table-wrap"><table class="tp-dtl">
      <thead><tr><th>Số HĐ/PL</th><th>Ngày ký</th><th class="num" title="Ký – giá trị lúc ký">TĐ1<br><span class="muted small">trước VAT</span></th><th class="num" title="Điều chỉnh – TĐ1 + các đợt tăng / giảm">TĐ2<br><span class="muted small">trước VAT</span></th><th>VAT %</th><th class="num">TĐ2<br><span class="muted small">sau VAT</span></th>
        <th class="num" title="Quyết toán – giá trị HT/QT. Trống = TĐ2">TĐ3<br><span class="muted small">trước VAT</span></th><th class="num">HT/QT<br><span class="muted small">sau VAT</span></th><th>Ghi chú</th><th></th></tr></thead>
      <tbody>${c.lines.map((l) => lineRow(l, false)).join('')}${tpDrafts.lines.map((d) => lineRow(d, true)).join('')}</tbody>
      <tfoot><tr><td colspan="2">TỔNG</td>${(() => { const [a, b] = tpTdTong(c.lines); return `<td class="num tp-sum-mo" title="Tổng TĐ1 – giá trị ký, trước VAT">${dvm(a)}</td><td class="num tp-sum-mo" title="Tổng TĐ2 – sau điều chỉnh, trước VAT">${dvm(b)}${tdDelta(b, a)}</td>`; })()}<td></td>
        <td class="num">${dvm(c.hd_sau_vat)}</td><td class="num tp-sum-mo" title="Tổng giá trị HT/QT trước VAT">${dvm(c.qt_gia_tri)}</td>
        <td class="num">${dvm(c.qt_sau_vat)}</td><td colspan="2"></td></tr></tfoot>
    </table></div>
    ${editL && tdDangChon() === 1 && !(c.lines.length && c.lines.every((l) => nnV(l.gia_tri_qt) !== null)) ? `<div class="tv-tools"><button class="sm" data-addpl="${nextPl}">+ Thêm ${nextPl}</button>
      <span class="muted small">TĐ1 = giá trị ký · tăng / giảm sau ký: bấm <b>± Đợt</b> · ô HT/QT (TĐ3) để trống = chưa quyết toán (lấy bằng TĐ2)</span></div>` : ''}

    <h4 class="tp-sep">Giá trị thanh toán</h4>
    <div class="table-wrap"><table class="tp-dtl">
      <thead><tr><th>Nội dung</th><th>Ngày</th><th class="num">Số tiền</th><th>Ghi chú</th><th></th></tr></thead>
      <tbody>${c.pays.map((p) => payRow(p, false)).join('')}${tpDrafts.pays.map((p) => payRow(p, true)).join('')}
        ${!c.pays.length && !tpDrafts.pays.length ? '<tr><td colspan="5" class="empty">Chưa có thanh toán</td></tr>' : ''}</tbody>
      <tfoot><tr><td colspan="2">TỔNG THANH TOÁN</td><td class="num">${dvm(c.da_tt)}</td><td colspan="2"></td></tr></tfoot>
    </table></div>
    ${edit ? `<div class="tv-tools">
      ${editP ? `<button class="sm" data-addpay="tam_ung">+ Tạm ứng</button>
      <button class="sm" data-addpay="dot">+ Đợt thanh toán</button>
      <button class="sm" data-addpay="quyet_toan">+ Quyết toán</button>` : ''}
      <span class="spacer"></span>
      ${editL ? '<button class="danger sm" data-deltp>Xóa hợp đồng</button>' : ''}
    </div>` : locked && canInfo ? '<div class="tv-tools"><span class="spacer"></span><button class="danger sm" data-deltp>Xóa hợp đồng</button></div>' : ''}
    <div class="msg" id="tp-msg" role="alert"></div>`;
  if (edit) {
    $$('input.money', dlg).forEach(attachMoneyInput);
    $$('input.date-dmy', dlg).forEach(attachDateInput);
  }
  renderTdMode();
  // Ô nhà thầu / hạng mục trong bảng chi tiết: danh sách gợi ý từ bộ nhớ
  const fDt = $('[data-k="info"] [data-f="doi_tac"]', dlg), fHm = $('[data-k="info"] [data-f="hang_muc"]', dlg);
  if (fDt && fHm) {
    tpGoiYLoad();
    attachCombo(fDt, () => (tpGoiY || []).map((x) => ({ v: x.doi_tac, sub: `${x.so_hd} HĐ` })));
    attachCombo(fHm, () => tpHmItems(fDt.value), () => fHm.dispatchEvent(new Event('input', { bubbles: true })));
  }
  // Điền lại số đang nhập dở, hiện nút Lưu, tính lại sau VAT
  keep.forEach((vals, k) => {
    const tr = dlg.querySelector(`[data-k="${CSS.escape(k)}"]`); if (!tr) return;
    let el = null;
    vals.forEach(([f, val]) => { const x = $(`[data-f="${f}"]`, tr); if (x && !x.disabled) { x.value = val; el = x; } });
    if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function onTpDlgInput(e) {
  const tr = e.target.closest('[data-k]');
  if (!tr) return;
  tr.dataset.dirty = '1'; // đang nhập dở – giữ lại khi bảng vẽ lại (thêm dòng, lưu dòng khác)
  const btn = $('[data-save]', tr);
  if (btn) btn.hidden = false;
  if (tr.dataset.k.startsWith('l') || tr.dataset.k.startsWith('dl')) {
    // cập nhật sau VAT ngay khi gõ
    const v = (f) => $(`[data-f="${f}"]`, tr)?.value ?? '';
    const dc = Number(tr.dataset.dc) || 0, g2 = String((Number(parseMoney(v('gia_tri'))) || 0) + dc); // TĐ2 = giá trị ký + các đợt
    $('[data-calc="hd"]', tr).innerHTML = dvm(tpCalc(g2, v('vat')));
    $('[data-calc="qt"]', tr).innerHTML = dvm(tpCalc(v('gia_tri_qt') || g2, v('vat')));
  }
}

async function onTpDlgClick(e) {
  const t = e.target;
  const c = costData.thau_phu.find((x) => x.id === tpDlgId);
  if (!c) return;
  const msg = () => $('#tp-msg');
  if (t.dataset.close !== undefined) return closeTp();
  if (t.dataset.deltp !== undefined) return deleteTp(c.id);
  if (t.dataset.tpmokhoa !== undefined) {
    const pc = await askPasscode(`Mở khóa hợp đồng ${c.so_ma}?`, 'Hợp đồng đã thanh toán đủ (còn lại = 0) nên đang khóa số. Mở khóa để điều chỉnh – số liệu giữ nguyên; đóng bảng chi tiết sẽ tự khóa lại nếu còn lại vẫn = 0.');
    if (pc === null) return;
    try { await api(`/api/thau-phu/${c.id}/mo-khoa`, { method: 'POST', body: JSON.stringify({ passcode: pc }) }); }
    catch (err) { return showMsg(msg(), err.message, 'err'); }
    tpMoKhoa.add(c.id); renderTpDlg(); return showMsg(msg(), 'Đã mở khóa – có thể điều chỉnh. Đóng bảng chi tiết sẽ khóa lại.');
  }
  if (t.dataset.tpdot) return openDc('tp', Number(t.dataset.tpdot));
  if (t.dataset.tpmoqt !== undefined) {
    const l = c.lines.find((x) => 'l' + x.id === t.closest('[data-k]')?.dataset.k); if (!l) return;
    const pc = await askPasscode(`Mở khoá quyết toán ${l.ma_loai} ${c.so_ma}?`, 'Bỏ số quyết toán của dòng này để sửa lại (có ghi nhật ký).', '🔓 Mở khoá');
    if (pc === null) return;
    try { await api(`/api/tp-hd-pl/${l.id}/qt`, { method: 'DELETE', body: JSON.stringify({ passcode: pc }) }); await loadCost(); showMsg($('#tp-msg'), `Đã mở khoá ${l.ma_loai}`); }
    catch (err) { showMsg($('#tp-msg'), err.message, 'err'); }
    return;
  }
  if (t.dataset.addpl) { tpDrafts.lines.push({ key: ++tpSeq, ma_loai: t.dataset.addpl }); return renderTpDlg(); }
  if (t.dataset.addpay) {
    const loai = t.dataset.addpay;
    const d = { key: ++tpSeq, loai };
    if (loai === 'dot' || loai === 'quyet_toan') d.dot = Math.max(0, ...c.pays.filter((p) => p.loai === loai).map((p) => p.dot || 0), ...tpDrafts.pays.filter((p) => p.loai === loai).map((p) => p.dot || 0)) + 1;
    tpDrafts.pays.push(d);
    return renderTpDlg();
  }
  const tr = t.closest('[data-k]');
  if (!tr) return;
  const k = tr.dataset.k;
  const v = (f) => $(`[data-f="${f}"]`, tr)?.value ?? '';
  const call = async (url, method, body) => {
    try {
      await api(url, { method, body: body ? JSON.stringify(body) : undefined });
      return true;
    } catch (err) { showMsg(msg(), err.message, 'err'); return false; }
  };
  const after = async (text) => { await loadCost(); showMsg(msg(), text); };

  if (t.dataset.save !== undefined) {
    delete tr.dataset.dirty; // dòng đang lưu: vẽ lại theo số trên máy chủ
    if (k === 'info') {
      if (await call(`/api/thau-phu/${c.id}`, 'PUT', { nhom: v('nhom'), so_ma: v('so_ma'), doi_tac: v('doi_tac'), hang_muc: v('hang_muc'), ghi_chu: v('ghi_chu'), hd_cdt_id: v('hd_cdt_id') })) {
        tpGoiYAt = 0;
        tpOpen.add(Number(v('hd_cdt_id')) || 0);
        await after('Đã lưu thông tin hợp đồng');
      }
      return;
    }
    const ngay = dmyToIso(v('ngay'));
    if (ngay === null) return showMsg(msg(), 'Ngày không hợp lệ, nhập dd/mm/yyyy', 'err');
    if (k.startsWith('l') || k.startsWith('dl')) {
      const draft = k.startsWith('dl');
      const cur = draft ? tpDrafts.lines.find((d) => 'dl' + d.key === k) : c.lines.find((l) => 'l' + l.id === k);
      if (!draft && tdDangChon() === 3) { // TĐ3: lưu số quyết toán -> khoá dòng
        const q = parseMoney(v('gia_tri_qt'));
        if (q === '' || q === '-' || Number(q) < 0) return showMsg(msg(), 'Nhập số quyết toán', 'err');
        if (!confirm(`Lưu số quyết toán ${money(q)} đ cho ${cur.ma_loai} ${c.so_ma}? Dòng sẽ bị KHOÁ (muốn sửa phải mở khoá bằng Passcode).`)) return;
        if (await call(`/api/tp-hd-pl/${cur.id}/qt`, 'PUT', { gt_qt: q })) await after(`Đã lưu số quyết toán ${cur.ma_loai} – dòng đã khoá`);
        return;
      }
      const body = { ma_loai: cur.ma_loai, ngay, gia_tri: parseMoney(v('gia_tri')), vat: v('vat'), gia_tri_qt: parseMoney(v('gia_tri_qt')), ghi_chu: v('ghi_chu'), giu_qt: true };
      if (await call(draft ? `/api/thau-phu/${c.id}/hd-pl` : `/api/tp-hd-pl/${cur.id}`, draft ? 'POST' : 'PUT', body)) {
        if (draft) tpDrafts.lines = tpDrafts.lines.filter((d) => d !== cur);
        await after(`Đã lưu ${cur.ma_loai}`);
      }
    } else {
      const draft = k.startsWith('dp');
      const cur = draft ? tpDrafts.pays.find((d) => 'dp' + d.key === k) : c.pays.find((p) => 'p' + p.id === k);
      const body = { loai: cur.loai, dot: cur.loai === 'dot' || cur.loai === 'quyet_toan' ? v('dot') : null, ngay, so_tien: parseMoney(v('so_tien')), ghi_chu: v('ghi_chu') };
      if (await call(draft ? `/api/thau-phu/${c.id}/thanh-toan` : `/api/tp-thanh-toan/${cur.id}`, draft ? 'POST' : 'PUT', body)) {
        if (draft) tpDrafts.pays = tpDrafts.pays.filter((d) => d !== cur);
        await after(`Đã lưu ${TT_LABEL[cur.loai]}${body.dot ? ' ' + body.dot : ''}`);
      }
    }
    return;
  }
  if (t.dataset.del !== undefined) {
    if (k.startsWith('dl')) { tpDrafts.lines = tpDrafts.lines.filter((d) => 'dl' + d.key !== k); return renderTpDlg(); }
    if (k.startsWith('dp')) { tpDrafts.pays = tpDrafts.pays.filter((d) => 'dp' + d.key !== k); return renderTpDlg(); }
    if (k.startsWith('l')) {
      const l = c.lines.find((x) => 'l' + x.id === k);
      const pc = await askPasscode(`Xóa "${l.so_hieu}"?`, `Giá trị sau VAT: ${money(l.sau_vat)} đ. Thao tác này không hoàn tác được.`);
      if (pc === null) return;
      if (await call(`/api/tp-hd-pl/${l.id}`, 'DELETE', { passcode: pc })) await after(`Đã xóa ${l.ma_loai}`);
    } else {
      const p = c.pays.find((x) => 'p' + x.id === k);
      if (!confirm(`Xóa dòng ${TT_LABEL[p.loai]}${p.dot ? ' ' + p.dot : ''} (${money(p.so_tien)} đ)?`)) return;
      if (await call(`/api/tp-thanh-toan/${p.id}`, 'DELETE')) await after('Đã xóa dòng thanh toán');
    }
  }
}

// =====================================================================
// TÀI KHOẢN (Quản trị)
// =====================================================================
const uForm = $('#u-form');
attachPwChecklist(uForm?.elements.password);

// ---------- Nhật ký hoạt động (quản trị) ----------
// Chuyển trang theo số (1, 2, 3...); total = tổng số dòng (chỉ biết khi không lọc), max_page = giới hạn độ sâu của máy chủ
const NK = { items: [], more: false, hd: [], page: 1, total: null, maxPage: 1 };
const NK_CLS = { 'Đăng nhập': 'in', 'Đăng xuất': 'out', 'Hết phiên': 'out', 'Đăng nhập sai': 'bad', 'Thêm': 'add', 'Sửa': 'edit', 'Cập nhật': 'edit', 'Xóa': 'del', 'Xuất báo cáo': 'exp' };
function nkParams(extra = {}) {
  const f = $('#nk-filter');
  const p = new URLSearchParams();
  for (const k of ['user_id', 'hanh_dong', 'tu', 'den', 'q', 'limit']) { const v = f.elements[k].value.trim(); if (v) p.set(k, v); }
  for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
  return p;
}
function nkFillSelects() {
  const f = $('#nk-filter');
  const su = f.elements.user_id, sh = f.elements.hanh_dong;
  const keepU = su.value, keepH = sh.value;
  su.innerHTML = '<option value="">Tất cả</option>' + (users.length ? users : NK.tk || []).map((u) => `<option value="${u.id}">${esc(u.username)} – ${esc(u.full_name)}</option>`).join('');
  sh.innerHTML = '<option value="">Tất cả</option>' + NK.hd.map((h) => `<option>${esc(h)}</option>`).join('');
  su.value = keepU; sh.value = keepH;
}
// page: trang cần xem (đổi lọc / tự làm mới -> trang 1)
async function loadLogs(auto = false, page = 1) {
  if (!$('#nk-card')) return;
  if (auto && NK.page > 1) return; // đang xem các trang sau -> không tự làm mới để khỏi mất chỗ đang đọc
  const r = await api('/api/nhat-ky?' + nkParams({ page: page > 1 ? page : 0 }), auto ? AUTO : {});
  if (r.tai_khoan) NK.tk = r.tai_khoan;
  if (!NK.hd.length || !auto) { NK.hd = r.hanh_dong; nkFillSelects(); }
  NK.items = r.items;
  NK.more = r.more;
  NK.page = r.page;
  NK.maxPage = r.max_page;
  if (r.thong_ke) {
    // Tổng số dòng chỉ biết chắc khi không lọc (đếm khi lọc phải giải nén toàn bộ lưu trữ)
    const noFilter = [...nkParams().keys()].every((k) => k === 'limit');
    NK.total = noFilter ? r.thong_ke.hot.n + r.thong_ke.arch.n : null;
  }
  $('#nk-tbody').innerHTML = NK.items.length ? NK.items.map((l) => {
    const [main, change] = String(l.noi_dung).split(' | ');
    return `<tr>
      <td class="nk-time">${dt(l.at)}${l.luu_tru ? '<div class="nk-arch" title="Dòng này lấy từ kho lưu trữ nén">lưu trữ nén</div>' : ''}</td>
      <td><b>${esc(l.username || '—')}</b>${l.ho_ten ? `<div class="muted small">${esc(l.ho_ten)}</div>` : ''}</td>
      <td><span class="nk-act nk-${NK_CLS[l.hanh_dong] || 'edit'}">${esc(l.hanh_dong)}</span></td>
      <td>${esc(l.doi_tuong)}</td>
      <td>${l.du_an ? `<b class="p-ma">${esc(l.du_an)}</b>` : '<span class="muted">—</span>'}</td>
      <td class="nk-nd">${esc(main)}${change ? `<div class="nk-diff">${esc(String(l.noi_dung).split(' | ').slice(1).join(' · '))}</div>` : ''}</td>
      <td class="muted small">${esc(l.ip)}</td></tr>`;
  }).join('') : '<tr><td colspan="7" class="empty">Chưa có hoạt động phù hợp</td></tr>';
  const lim = Number($('#nk-filter').elements.limit.value), p = NK.page, from = (p - 1) * lim + 1;
  // Trang cuối: biết tổng -> chính xác; đang lọc -> chỉ biết còn trang sau hay không
  const last = Math.min(NK.maxPage, NK.total ? Math.max(1, Math.ceil(NK.total / lim)) : NK.more ? p + 1 : p);
  const nums = [...new Set([1, p - 2, p - 1, p, p + 1, p + 2, last])].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  const btn = (n, label, on = true) => `<button type="button" class="sm${n === p && label === n ? ' primary' : ''}" data-nkpage="${n}" ${on ? '' : 'disabled'}${n === p && label === n ? ' aria-current="page"' : ''}>${label}</button>`;
  $('#nk-pager').innerHTML = btn(p - 1, '‹', p > 1)
    + nums.map((n, i) => (i && n - nums[i - 1] > 1 ? '<span class="nk-gap">…</span>' : '') + btn(n, n)).join('')
    + (!NK.total && NK.more ? '<span class="nk-gap">…</span>' : '')
    + btn(p + 1, '›', p < last);
  $('#nk-pager').hidden = last <= 1;
  $('#nk-count').textContent = NK.items.length
    ? `Trang ${fmt.format(p)}${NK.total ? ' / ' + fmt.format(last) : ''} · dòng ${fmt.format(from)}–${fmt.format(from + NK.items.length - 1)}`
      + (NK.total ? ` trong ${fmt.format(NK.total)} dòng` : NK.more ? '' : ' (hết)')
      + (NK.more && p >= NK.maxPage ? ` · xem sâu hơn: lọc theo ngày hoặc Xuất CSV` : '')
    : '';
  if (r.thong_ke) {
    const s = r.thong_ke, kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
    const giam = s.arch.goc ? Math.round((1 - s.arch.nen / s.arch.goc) * 100) : 0;
    $('#nk-stat').innerHTML = `Gần đây (${s.hot_days} ngày): <b>${fmt.format(s.hot.n)}</b> dòng · ${kb(s.hot.bytes)}`
      + (s.arch.n ? ` &nbsp;|&nbsp; Lưu trữ nén: <b>${fmt.format(s.arch.ngay)}</b> ngày, <b>${fmt.format(s.arch.n)}</b> dòng · <b>${kb(s.arch.nen)}</b> (gốc ${kb(s.arch.goc)}, giảm <b>${giam}%</b>)` : ' &nbsp;|&nbsp; Chưa có nhật ký cũ cần nén');
  }
}
let nkTimer;
$('#nk-filter')?.addEventListener('input', () => { clearTimeout(nkTimer); nkTimer = setTimeout(() => loadLogs().catch((e) => alert(e.message)), 300); });
$('#nk-filter')?.addEventListener('submit', (e) => e.preventDefault());
$('#nk-reset')?.addEventListener('click', () => {
  const f = $('#nk-filter'), lim = f.elements.limit.value; // xóa lọc nhưng giữ số dòng hiển thị đã chọn
  f.reset(); f.elements.limit.value = lim;
  loadLogs().catch((e) => alert(e.message));
});
$('#nk-pager')?.addEventListener('click', (e) => {
  const b = e.target.closest('[data-nkpage]');
  if (!b || b.disabled) return;
  loadLogs(false, Number(b.dataset.nkpage))
    .then(() => $('#nk-card').scrollIntoView({ block: 'start', behavior: 'smooth' }))
    .catch((err) => alert(err.message));
});
$('#nk-csv')?.addEventListener('click', async (e) => {
  const btn = e.target; btn.disabled = true; btn.textContent = 'Đang xuất...';
  try {
    let all = [], before = 0, more = true;
    while (more && all.length < 20000) {
      const r = await api('/api/nhat-ky?' + nkParams({ limit: 500, before }));
      all = all.concat(r.items); more = r.more; before = all.at(-1)?.id;
    }
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Thời gian', 'Tên đăng nhập', 'Họ tên', 'Hành động', 'Đối tượng', 'Dự án', 'Nội dung', 'IP'];
    const csv = [head.map(q).join(','), ...all.map((l) => [dt(l.at), l.username, l.ho_ten, l.hanh_dong, l.doi_tuong, l.du_an, l.noi_dung, l.ip].map(q).join(','))].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `nhat-ky_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    logEvent('xuat_csv', `Nhật ký hoạt động (${all.length} dòng)`);
  } catch (err) { alert(err.message); } finally { btn.disabled = false; btn.textContent = 'Xuất CSV'; }
});

// Truy cập gần nhất: trạng thái trực tuyến do máy chủ tính (còn phiên đăng nhập và trang đang mở); kèm thời gian tương đối
function seenTxt(t, online) {
  const on = '<span class="st st-hoan-thanh">● Đang trực tuyến</span>';
  if (!t) return online ? on : '<span class="muted">—</span>';
  const m = Math.max(0, Math.floor((Date.now() - new Date(t)) / 60000));
  const rel = online ? on : m < 1 ? '<span class="muted small">Ngoại tuyến · vừa xong</span>'
    : `<span class="muted small">Ngoại tuyến · ${m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.floor(m / 60)} giờ trước` : `${Math.floor(m / 1440)} ngày trước`}</span>`;
  return `<span class="muted">${dt(t)}</span><br>${rel}`;
}

// Phiên đăng nhập của 1 tài khoản (quản trị): thiết bị · IP · thời gian · trạng thái; buộc đăng xuất 1 phiên hoặc tất cả
async function sessionDialog(u) {
  if (!u) return;
  const dlg = document.createElement('dialog');
  dlg.className = 'pass-dlg sess-dlg';
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); dlg.remove(); loadUsers(true).catch(() => {}); };
  const st = (r) => (r.online ? '<span class="st st-hoan-thanh">Trực tuyến</span>' : '<span class="st st-tam-dung">Đang đăng nhập (tab ẩn / im lặng)</span>');
  const render = async (msg = '') => {
    let rows = [];
    try { rows = await api(`/api/users/${u.id}/sessions`); } catch (err) { msg = err.message; }
    const others = rows.filter((r) => !r.hien_tai).length;
    dlg.innerHTML = `<div class="stack">
      <h3>Phiên đăng nhập · ${esc(u.username)} <span class="muted small">(${esc(u.full_name)})</span></h3>
      <p class="muted small">Các phiên còn hiệu lực (chưa đăng xuất, chưa quá ${Number(META?.idle_phut) || 60} phút không thao tác). Buộc đăng xuất: máy đó phải đăng nhập lại; thao tác được ghi nhật ký.</p>
      <div class="table-wrap"><table class="no-mcard sess-tbl"><thead><tr><th>Thiết bị</th><th>IP</th><th>Đăng nhập lúc</th><th>Thao tác cuối</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.thiet_bi)}${r.hien_tai ? ' <span class="badge light">Phiên của bạn</span>' : ''}</td><td>${esc(r.ip || '—')}</td>
          <td class="muted">${dt(r.created_at)}</td><td class="muted">${dt(r.last_active_at)}</td><td>${st(r)}</td>
          <td>${r.hien_tai ? '' : `<button class="danger sm" data-sid="${esc(r.id)}">Đăng xuất</button>`}</td></tr>`).join('')
          || '<tr><td colspan="6" class="muted">Không có phiên nào đang đăng nhập</td></tr>'}</tbody></table></div>
      <div class="msg" role="alert"></div>
      <div class="actions">${others ? `<button class="danger" data-sall>Đăng xuất tất cả (${others} phiên)</button>` : ''}<button data-x>Đóng</button></div>
    </div>`;
    if (msg) showMsg($('.msg', dlg), msg, msg.startsWith('Đã') ? 'ok' : 'err');
  };
  dlg.addEventListener('click', async (e) => {
    if (e.target.closest('[data-x]')) return close();
    const b = e.target.closest('[data-sid], [data-sall]');
    if (!b) return;
    const all = b.hasAttribute('data-sall');
    if (!confirm(all ? `Đăng xuất tất cả phiên của ${u.username}?` : `Đăng xuất phiên này của ${u.username}?`)) return;
    try {
      const r = await api(`/api/users/${u.id}/sessions${all ? '' : '/' + encodeURIComponent(b.dataset.sid)}`, { method: 'DELETE' });
      await render(`Đã đăng xuất ${r.so_phien} phiên`);
    } catch (err) { await render(err.message); }
  });
  await render();
  dlg.showModal();
}

// Bảng giải thích vai trò (nút i cạnh ô Vai trò): được làm / không được làm – khớp bảng QUYEN ở máy chủ
const ROLE_GUIDE = {
  admin: ['Toàn quyền: mọi dữ liệu, tài khoản, cài đặt, passcode xóa, phiên đăng nhập, nhật ký', '—'],
  it: ['Tạo / khóa tài khoản, đặt lại mật khẩu, xem & buộc đăng xuất phiên, xem nhật ký, sửa thông tin liên hệ', 'Không xem số liệu dự án, báo cáo tài chính; không tạo / sửa / cấp quyền Quản trị; không xóa tài khoản'],
  lanh_dao: ['Xem toàn bộ báo cáo và Dữ liệu (dự án, doanh thu, chi phí); chốt TĐ1–TĐ3; nhập DT-CP dự kiến; xuất file', 'Không nhập, sửa chứng từ, hợp đồng, tiền về, chi phí'],
  bks: ['Xem toàn bộ báo cáo và Dữ liệu; xem nhật ký hoạt động (ai sửa gì, trước → sau); xuất file', 'Không sửa bất kỳ số liệu nào (kiểm soát độc lập)'],
  qs: ['Nhập dự án, HĐ / phụ lục, nghiệm thu – quyết toán với CĐT, HĐ đầu vào (thầu phụ, vật tư, MMTB, nhân công) và phụ lục, ngày, ảnh công trình', 'Không nhập tiền về, thanh toán thầu phụ, chi phí; không xóa dự án'],
  ke_toan: ['Nhập tiền về, thanh toán HĐ đầu vào (thầu phụ, vật tư…), chi phí, vay – trả nợ, BH/Khác', 'Không sửa HĐ, phụ lục, nghiệm thu, HĐ đầu vào; không xóa dự án'],
  editor: ['Nhập toàn bộ (giá trị + tiền), chốt TĐ, DT-CP dự kiến, xóa dự án (cần Passcode) – vai trò cũ, nên chuyển dần sang QS / Kế toán', 'Không quản lý tài khoản, cài đặt, nhật ký'],
  viewer: ['Chỉ xem báo cáo; đổi đơn vị tiền hiển thị; tự đổi mật khẩu', 'Không xuất (In / PDF, Excel, PowerPoint), không thêm / sửa / xóa số liệu; không vào trang Dữ liệu, nhật ký'],
};
function renderRoleGuide() {
  const box = $('#role-guide');
  if (!box) return;
  box.innerHTML = `<div class="rg-head"><b>Quyền của từng vai trò</b><button type="button" class="ghost-x" data-rg-close aria-label="Đóng">✕</button></div>
    <div class="table-wrap"><table class="rg-table no-mcard"><thead><tr><th>Vai trò</th><th>Được làm</th><th>Không được làm</th></tr></thead>
    <tbody>${Object.entries(META.roles).filter(([k]) => ME.role === 'admin' || k !== 'admin').map(([k, v]) => `<tr><td><span class="st role-${k}">${esc(v)}</span></td>
      <td>${esc(ROLE_GUIDE[k]?.[0] || '')}</td><td class="muted">${esc(ROLE_GUIDE[k]?.[1] || '')}</td></tr>`).join('')}</tbody></table></div>
    <p class="muted small">Mọi vai trò đều xem được báo cáo (trừ IT). Quyền được kiểm tra ở máy chủ, ẩn nút chỉ để giao diện gọn.</p>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('#role-help, [data-rg-close]');
  if (!b) return;
  const box = $('#role-guide'), help = $('#role-help');
  const open = b.id === 'role-help' ? box.hidden : false;
  if (open) renderRoleGuide();
  box.hidden = !open; help.setAttribute('aria-expanded', String(open));
  if (open) box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

async function loadUsers(auto = false) {
  users = await api('/api/users', auto === true ? AUTO : {});
  $('#u-tbody').innerHTML = users.map((u) => `
    <tr>
      <td>${esc(u.username)}${u.id === ME.id ? ' <span class="badge light">Bạn</span>' : ''}</td>
      <td>${esc(u.full_name)}</td>
      <td><span class="st role-${u.role}">${esc(META.roles[u.role] || u.role)}</span></td>
      <td>${u.active ? '<span class="st st-hoan-thanh">Hoạt động</span>' : '<span class="st st-tam-dung">Đã khóa</span>'}${u.khach ? ` <span class="st st-chuan-bi" title="Tài khoản khách dùng 1 lần">${khachTxt(u)}</span>` : ''}</td>
      <td class="muted">${dt(u.last_login_at)}</td>
      <td>${seenTxt(u.last_seen_at, u.online)}</td>
      <td class="row-actions">
        ${ME.role === 'it' && u.role === 'admin' ? '<span class="muted small">Chỉ Quản trị</span>' : `<button data-usess="${u.id}" title="Xem các phiên đang đăng nhập, buộc đăng xuất">Phiên${u.so_phien ? ` (${u.so_phien})` : ''}</button>
        ${u.khach ? '' : `<button data-uedit="${u.id}">Sửa</button>`}`}
        ${u.id === ME.id || ME.role !== 'admin' ? '' : `<button class="danger" data-udel="${u.id}">Xóa</button>`}
      </td>
    </tr>`).join('');
}

function resetUserForm() {
  uForm.reset();
  uForm.elements.id.value = '';
  uForm.elements.username.disabled = false;
  uForm.elements.password.required = true;
  uForm.elements.password.dispatchEvent(new Event('input'));
  $('#u-pass-label').textContent = 'Mật khẩu *';
  $('#u-form-title').textContent = 'Thêm tài khoản';
}

uForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = uForm.elements.id.value;
  const body = {
    username: uForm.elements.username.value,
    full_name: uForm.elements.full_name.value,
    role: uForm.elements.role.value,
    active: uForm.elements.active.checked,
  };
  if (uForm.elements.password.value) body.password = uForm.elements.password.value;
  try {
    await api(id ? `/api/users/${id}` : '/api/users', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
    showMsg($('#u-msg'), id ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản');
    resetUserForm();
    await loadUsers();
  } catch (err) {
    showMsg($('#u-msg'), err.message, 'err');
  }
});
$('#u-cancel')?.addEventListener('click', () => { resetUserForm(); showMsg($('#u-msg'), ''); });

$('#u-tbody')?.addEventListener('click', async (e) => {
  const { uedit, udel, usess } = e.target.dataset;
  if (usess) return sessionDialog(users.find((x) => x.id === Number(usess)));
  if (uedit) {
    const u = users.find((x) => x.id === Number(uedit));
    if (!u) return;
    uForm.elements.id.value = u.id;
    uForm.elements.username.value = u.username;
    uForm.elements.username.disabled = true;
    uForm.elements.full_name.value = u.full_name;
    uForm.elements.role.value = u.role;
    uForm.elements.active.checked = u.active;
    uForm.elements.password.value = '';
    uForm.elements.password.required = false;
    uForm.elements.password.dispatchEvent(new Event('input'));
    $('#u-pass-label').textContent = 'Mật khẩu mới (để trống nếu không đổi)';
    $('#u-form-title').textContent = 'Sửa tài khoản ' + u.username;
    uForm.scrollIntoView({ behavior: 'smooth' });
  }
  if (udel) {
    const u = users.find((x) => x.id === Number(udel));
    if (!u || !confirm(`Xóa tài khoản "${u.username}"?`)) return;
    try {
      await api(`/api/users/${udel}`, { method: 'DELETE' });
      await loadUsers();
    } catch (err) {
      alert(err.message);
    }
  }
});

// =====================================================================
// CÀI ĐẶT (Quản trị)
// =====================================================================
const sForm = $('#s-form');

// =====================================================================
// LIÊN HỆ – Thông tin hệ thống & hỗ trợ (mọi tài khoản xem; Quản trị sửa)
// Phiên bản tự động theo version.json; Quản trị ghi đè được đến lần phát hành kế tiếp
// =====================================================================
let LH = null;
async function loadContact() {
  LH = await api('/api/lien-he');
  renderContact();
}
function renderContact() {
  const row = (k, v) => `<dt>${k}</dt><dd>${v || '<span class="muted">—</span>'}</dd>`;
  const pb = LH.phien_ban;
  const pbNote = pb.ghi_de
    ? `Quản trị đặt thủ công (số tự động: ${esc(pb.tu_dong)})`
    : pb.lan ? `Cập nhật lần ${pb.lan} trong ngày ${esc(pb.ngay)}` : '';
  $('#sys-info').innerHTML =
    row('Tên hệ thống/Website', esc(LH.ten)) +
    row('Đơn vị sở hữu', esc(LH.so_huu)) +
    row('Đơn vị phát triển', esc(LH.phat_trien)) +
    row('Phiên bản hiện tại', `${esc(pb.ma)}${pbNote ? `<div class="muted small">${pbNote}</div>` : ''}`);
  $('#sys-contact').innerHTML =
    row('SĐT', LH.sdt ? `<a href="tel:${esc(LH.sdt.replace(/[^0-9+]/g, ''))}">${esc(LH.sdt)}</a>` : '') +
    row('Mail', LH.mail ? `<a href="mailto:${esc(LH.mail)}">${esc(LH.mail)}</a>` : '');
  $('#lh-view').hidden = false;
  const f = $('#lh-form');
  if (f) f.hidden = true;
}
const lhForm = $('#lh-form');
$('#lh-edit')?.addEventListener('click', () => {
  for (const k of ['ten', 'so_huu', 'phat_trien', 'sdt', 'mail']) lhForm.elements[k].value = LH[k] || '';
  const pb = LH.phien_ban;
  lhForm.elements.phien_ban.value = pb.ghi_de ? pb.ma : '';
  lhForm.elements.phien_ban.placeholder = `Để trống = tự động (${pb.ghi_de ? pb.tu_dong : pb.ma})`;
  $('#lh-pb-note').textContent = 'Phiên bản dạng V[lần cập nhật trong ngày].[dd].[mm].[yy], vd V02.16.10.26. Hệ thống tự tăng mỗi lần phát hành; số nhập tay chỉ áp dụng đến lần phát hành kế tiếp.';
  showMsg($('#lh-msg'), '');
  $('#lh-view').hidden = true;
  lhForm.hidden = false;
});
$('#lh-cancel')?.addEventListener('click', renderContact);
lhForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    LH = await api('/api/lien-he', { method: 'PUT', body: JSON.stringify(formData(lhForm)) });
    renderContact();
  } catch (err) {
    showMsg($('#lh-msg'), err.message, 'err');
  }
});

async function loadDemoStatus() {
  const { count } = await api('/api/demo');
  $('#demo-status').textContent = count ? `Đang có ${count} dự án mẫu (DEMO-...).` : 'Chưa có dữ liệu mẫu.';
  $('#demo-seed').disabled = count > 0;
  $('#demo-del').disabled = count === 0;
}
$('#demo-seed')?.addEventListener('click', async (e) => {
  if (!confirm('Tạo 12 dự án mẫu DEMO-01…12 để chạy thử?')) return;
  e.target.disabled = true;
  showMsg($('#demo-msg'), 'Đang tạo dữ liệu mẫu, vui lòng chờ...');
  try {
    const r = await api('/api/demo', { method: 'POST', body: '{}' });
    const c = r.count;
    showMsg($('#demo-msg'), `Đã tạo ${c.du_an} dự án · ${c.hd} HĐ CĐT · ${c.pl} PL · ${c.ht_qt} dòng HT/QT · ${c.tien_ve} dòng tiền về · ${c.thau_phu} HĐ thầu phụ · ${c.tp_thanh_toan} lần thanh toán TP · ${c.chi_phi} dòng chi phí · ${c.thoi_diem || 0} thời điểm TĐ (${(r.ms / 1000).toFixed(1)} giây). Xem ở tab Dự án.`);
  } catch (err) {
    showMsg($('#demo-msg'), err.message, 'err');
  }
  loadDemoStatus().catch(() => {});
});
$('#demo-del')?.addEventListener('click', async () => {
  const passcode = await askPasscode('Xóa toàn bộ dữ liệu mẫu', 'Xóa các dự án DEMO-... cùng toàn bộ doanh thu, chi phí, thầu phụ của chúng. Dữ liệu thật không bị ảnh hưởng.');
  if (!passcode) return;
  try {
    const r = await api('/api/demo', { method: 'DELETE', body: JSON.stringify({ passcode }) });
    showMsg($('#demo-msg'), `Đã xóa ${r.deleted} dự án mẫu.`);
  } catch (err) {
    showMsg($('#demo-msg'), err.message, 'err');
  }
  loadDemoStatus().catch(() => {});
});

async function loadSettings() {
  loadDemoStatus().catch(() => {});
  const s = await api('/api/settings');
  sForm.elements.ten_cong_ty.value = s.ten_cong_ty || '';
  sForm.elements.ten_he_thong.value = s.ten_he_thong || '';
  $('#pc-status').innerHTML = s.passcode_set
    ? '<span class="st st-hoan-thanh">Đã đặt</span> Nhân viên Nhập liệu / Quản trị phải nhập passcode khi xóa Số HĐ/PL.'
    : '<span class="st st-tam-dung">Chưa đặt</span> Hiện chưa ai xóa được Số HĐ/PL cho đến khi đặt passcode.';
  $('#pc-submit').textContent = s.passcode_set ? 'Đổi passcode' : 'Đặt passcode';
  $('#sys-tech').innerHTML = `Cơ sở dữ liệu: <b>${META.db === 'postgres' ? 'PostgreSQL' : 'Bộ nhớ tạm (chưa kết nối CSDL)'}</b><br>
    Mã khởi tạo (SETUP_TOKEN): ${META.setup_token_required ? 'đã đặt' : 'không đặt'}`;
}

sForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const s = await api('/api/settings', { method: 'PUT', body: JSON.stringify(formData(sForm)) });
    applyBranding(s);
    showMsg($('#s-msg'), 'Đã lưu cài đặt');
  } catch (err) {
    showMsg($('#s-msg'), err.message, 'err');
  }
});

$('#pc-form')?.querySelectorAll('input[inputmode=numeric]').forEach((i) =>
  i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 8); }));
$('#pc-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formData(e.target);
  if (!/^\d{8}$/.test(d.passcode)) return showMsg($('#pc-msg'), 'Passcode phải gồm đúng 8 chữ số', 'err');
  if (d.passcode !== d.passcode2) return showMsg($('#pc-msg'), 'Passcode nhập lại không khớp', 'err');
  try {
    await api('/api/settings/passcode', { method: 'PUT', body: JSON.stringify(d) });
    e.target.reset();
    showMsg($('#pc-msg'), 'Đã lưu Passcode xóa HĐ/PL');
    await loadSettings();
  } catch (err) {
    showMsg($('#pc-msg'), err.message, 'err');
  }
});

// =====================================================================
// CÁ NHÂN – đổi mật khẩu
// =====================================================================
attachPwChecklist($('#pw-form [name=new_password]'));

$('#pw-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = formData(e.target);
  if (d.new_password !== d.new_password2) return showMsg($('#pw-msg'), 'Mật khẩu nhập lại không khớp', 'err');
  try {
    await api('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: d.current_password, new_password: d.new_password }),
    });
    e.target.reset();
    showMsg($('#pw-msg'), 'Đã đổi mật khẩu');
  } catch (err) {
    showMsg($('#pw-msg'), err.message, 'err');
  }
});

// ---------- Tài khoản khách (Chỉ xem, dùng 30 phút từ lần đăng nhập đầu – máy chủ tự xóa khi hết hạn) ----------
function khachTxt(u) {
  if (!u.het_han) return 'Khách · chưa đăng nhập';
  const m = Math.ceil((new Date(u.het_han) - Date.now()) / 60e3);
  return m > 0 ? `Khách · còn ${m} phút` : 'Khách · hết hạn';
}
$('#kh-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, out = $('#kh-out'), btn = $('button[type=submit]', f);
  btn.disabled = true;
  try {
    const r = await api('/api/users/khach', { method: 'POST', body: JSON.stringify({ ghi_chu: f.elements.ghi_chu.value }) });
    const txt = `Địa chỉ: ${location.origin}/login\nTên đăng nhập: ${r.username}\nMật khẩu: ${r.password}\nDùng ${r.phut} phút tính từ lần đăng nhập đầu, chỉ trên 1 thiết bị (thiết bị đăng nhập đầu tiên).`;
    out.hidden = false;
    out.innerHTML = `<div class="kh-cred"><div><span>Tên đăng nhập</span><b>${esc(r.username)}</b></div><div><span>Mật khẩu</span><b>${esc(r.password)}</b></div></div>
      <p class="small"><b>Mật khẩu chỉ hiện 1 lần</b> – hãy sao chép gửi khách ngay. Dùng ${r.phut} phút từ lần đăng nhập đầu, chỉ trên 1 thiết bị; quá ${r.chua_dung_gio} giờ chưa đăng nhập thì tự xóa.</p>
      <button type="button" class="sm" id="kh-copy">Sao chép thông tin gửi khách</button>`;
    $('#kh-copy').onclick = async () => { try { await navigator.clipboard.writeText(txt); $('#kh-copy').textContent = 'Đã sao chép ✓'; } catch { prompt('Sao chép thông tin dưới đây:', txt.replace(/\n/g, ' · ')); } };
    f.reset();
    await loadUsers();
  } catch (err) { alert(err.message); } finally { btn.disabled = false; }
});
// Khách đang đăng nhập: thanh đếm ngược, hết giờ tự về trang đăng nhập
function khachInit() {
  $('.topbar [data-tab="profile"]')?.remove();
  const bar = document.createElement('div');
  bar.className = 'warn-bar kh-bar';
  document.body.prepend(bar);
  const het = ME.het_han ? new Date(ME.het_han).getTime() : Date.now() + 30 * 60e3;
  const tick = () => {
    const s = Math.max(0, Math.round((het - Date.now()) / 1000));
    bar.textContent = `Tài khoản khách – chỉ xem báo cáo · còn ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')} · hết giờ tự đăng xuất và xóa tài khoản`;
    if (s <= 0) { clearInterval(t); location.href = '/login'; }
  };
  const t = setInterval(tick, 1000); tick();
}

// =====================================================================
// PHÊ DUYỆT – Quản trị / Lãnh đạo duyệt mọi lần thêm / sửa / xóa số liệu; người nhập xem hồ sơ của mình
// Số trên tab + chuông: người duyệt = số chờ duyệt; người nhập = số bị từ chối (7 ngày). Kiểm tra mỗi 30 giây.
// =====================================================================
const DY = { tt: 'cho', q: '', trang: 0, mine: false, rows: [], la: false, dem: null, nhan: new Map() };
const DY_TT = { cho: ['Chờ duyệt', 'st-chuan-bi'], duyet: ['Đã duyệt', 'st-hoan-thanh'], tu_choi: ['Bị từ chối', 'st-tam-dung'], huy: ['Đã hủy', 'st-tam-tinh'] };
function duyetInit() {
  DY.la = can('duyet');
  $('#dy-tab-txt').textContent = DY.la ? 'Duyệt' : 'Hồ sơ của tôi';
  if (!DY.la) {
    $('#dy-title').textContent = 'Hồ sơ số liệu của tôi';
    $('#dy-sub').textContent = 'Các lần thêm / sửa / xóa số liệu bạn đã gửi và kết quả duyệt. Số chờ duyệt CHƯA tính vào tổng. Nhập sai khi chưa duyệt: bấm Hủy (không cần duyệt, có ghi nhật ký). Bị từ chối: nhập lại.';
    $('#dy-act').hidden = true; $('#dy-mine-wrap').hidden = true; $('#dy-all').hidden = true;
  }
  dyPoll(); setInterval(dyPoll, 15000); // dự phòng khi kênh tức thì bị chặn
  dyKenhMo();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { DY.nhanLuc = 0; dyPoll(); dyPanel(); } });
  new MutationObserver(() => { clearTimeout(DY.t); DY.t = setTimeout(dyGanNhan, 120); }).observe($('main'), { childList: true, subtree: true });
}
async function dyPoll() {
  try {
    const d = await api('/api/duyet/dem', AUTO);
    const so = DY.la ? d.cho : d.cua_toi_tu_choi, cu = DY.dem;
    const b = $('#dy-dem');
    b.hidden = !so; b.textContent = so > 99 ? '99+' : so;
    b.title = DY.la ? `${so} hồ sơ chờ duyệt` : `${so} hồ sơ của bạn bị từ chối (7 ngày)`;
    if ($('#dy-n-cho')) $('#dy-n-cho').textContent = DY.la ? (d.cho ? `(${d.cho})` : '') : (d.cua_toi_cho ? `(${d.cua_toi_cho})` : '');
    document.title = document.title.replace(/^\(\d+\+?\) /, '') ;
    if (so) document.title = `(${so}) ` + document.title;
    const note = $('#dy-bc-note');
    if (note) { const n = DY.la ? d.cho : d.cua_toi_cho; note.hidden = !n;
      note.innerHTML = n ? `⏳ Có <b>${n}</b> thay đổi số liệu ${DY.la ? '' : 'của bạn '}đang chờ duyệt – CHƯA tính vào báo cáo. <button type="button" class="sm" data-tab-go="duyet">Mở tab ${DY.la ? 'Duyệt' : 'Hồ sơ của tôi'}</button>` : ''; }
    if (cu !== null && so > cu) dyToast(DY.la ? `🔔 Có ${so - cu} hồ sơ mới chờ duyệt (tổng ${so})` : `⚠ Có ${so - cu} hồ sơ của bạn bị từ chối – mở "Hồ sơ của tôi" xem lý do`);
    if (cu !== so) { DY.nhanLuc = 0; if (!$('#tab-duyet').hidden) loadDuyet(true); dyPanel(); }
    DY.dem = so;
    if (Date.now() - (DY.nhanLuc || 0) > 25000) { DY.nhanLuc = Date.now(); DY.nhan = new Map((await api('/api/duyet/nhan', AUTO)).map((x) => [x.loai + ':' + x.ban_ghi_id, x])); dyGanNhan(true); }
  } catch {}
}
// Nhận thông báo tức thì từ máy chủ: có hồ sơ mới / được duyệt / từ chối / hủy -> cập nhật số, mục Chờ duyệt, số liệu trang đang mở
function dyKenhMo() {
  if (!window.EventSource) return;
  let t = 0;
  const es = new EventSource('/api/duyet/su-kien');
  es.addEventListener('duyet', (e) => {
    let d = {}; try { d = JSON.parse(e.data); } catch { /* bỏ qua */ }
    clearTimeout(t);
    t = setTimeout(() => { // gộp nhiều thông báo liền nhau
      DY.nhanLuc = 0; dyPoll(); dyPanel();
      if (!$('#tab-duyet').hidden) loadDuyet(true);
      if (d.ghi || d.loai === 'ghi') { // số liệu vừa thay đổi (máy này hoặc máy khác, kể cả cùng tài khoản) -> tải lại trang đang mở
        const tab = ['revenue', 'cost'].find((x) => !$('#tab-' + x).hidden && !document.querySelector('#tab-' + x + ' [data-dirty]'));
        if (tab && loaders[tab]) loaders[tab]();
        if (!$('#tab-report').hidden && !document.querySelector('dialog[open]')) { // Báo cáo đang mở: tải lại số, giữ vị trí cuộn
          const y = scrollY; Promise.resolve(loadReport()).then(() => scrollTo(0, y)).catch(() => {});
        }
      }
    }, 250);
  });
}
function dyToast(msg) {
  document.querySelectorAll('.dy-toast').forEach((x) => x.remove()); // chỉ giữ thông báo mới nhất, không chồng nhau
  const t = document.createElement('div');
  t.className = 'dy-toast'; t.innerHTML = `${esc(msg)} <button type="button" class="sm" data-tab-go="duyet">Xem</button>`;
  document.body.appendChild(t); setTimeout(() => t.classList.add('on'), 20); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 9000);
}
document.addEventListener('click', (e) => { const g = e.target.closest('[data-tab-go]'); if (g) { e.preventDefault(); g.closest('.dy-toast')?.remove(); showTab(g.dataset.tabGo); } });
// Nhãn "Chờ duyệt" / "Bị từ chối" trên dòng doanh thu, chi phí, HĐ thầu phụ ở trang nhập liệu
const DY_SEL = [['tr[data-rid]', 'doanh_thu', 'rid'], ['tr[data-cid]', 'chi_phi', 'cid'], ['tr[data-tpid]', 'thau_phu', 'tpid']];
function dyGanNhan(lai = false) {
  if (!DY.nhan) return;
  for (const [sel, loai, k] of DY_SEL) {
    document.querySelectorAll(`main ${sel}`).forEach((tr) => {
      const x0 = DY.nhan.get(loai + ':' + tr.dataset[k]), x = x0 && x0.trang_thai === 'cho' ? x0 : null; // chỉ gắn nhãn khi đang chờ
      const old = tr.querySelector('.dy-nhan');
      if (old && (lai || !x || old.dataset.tt !== x.trang_thai)) old.remove();
      if (!x || tr.querySelector('.dy-nhan')) return;
      const td = tr.cells[1] || tr.cells[0]; if (!td) return;
      const sp = document.createElement('span');
      sp.className = `dy-nhan ${x.trang_thai}`; sp.dataset.tt = x.trang_thai;
      sp.textContent = x.hanh_dong === 'Xóa' ? 'Chờ duyệt xóa' : x.hanh_dong === 'Thêm' ? 'Chờ duyệt' : 'Chờ duyệt sửa';
      sp.title = x.hanh_dong === 'Thêm' ? '' : 'Bản sửa / xóa đang chờ duyệt – số hiện tại (đã duyệt) vẫn được tính';

      td.appendChild(sp);
    });
  }
}
async function loadDuyet(giu = false) {
  if (!giu) DY.trang = DY.trang || 0;
  const qs = new URLSearchParams({ tt: DY.tt, q: DY.q, trang: DY.trang, ...(DY.mine ? { cua_toi: '1' } : {}) });
  const r = await api('/api/duyet?' + qs, giu ? AUTO : {});
  DY.rows = r.rows; DY.tong = r.tong;
  const chon = DY.la && r.rows.some((x) => x.trang_thai === 'cho');
  $('#dy-all').checked = false; $('#dy-all').disabled = !chon;
  const tg = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
  $('#dy-tbody').innerHTML = r.rows.length ? r.rows.map((x) => {
    const [ten, cls] = DY_TT[x.trang_thai] || [x.trang_thai, ''];
    const nd = String(x.noi_dung || '').split(' | ');
    return `<tr data-dy="${x.id}" class="dy-${x.trang_thai}">
      <td class="dy-ck">${DY.la && x.trang_thai === 'cho' ? `<input type="checkbox" data-dyck="${x.id}" aria-label="Chọn hồ sơ">` : ''}</td>
      <td class="muted small dy-tg">${tg(x.at)}</td>
      <td><b>${esc(x.ho_ten_nhap || x.nguoi_nhap)}</b><div class="muted small">${esc(x.nguoi_nhap)}</div></td>
      <td><span class="dy-hd dy-hd-${x.hanh_dong === 'Xóa' ? 'xoa' : x.hanh_dong === 'Thêm' ? 'them' : 'sua'}">${esc(x.hanh_dong)}</span></td>
      <td>${esc(x.doi_tuong)}${x.du_an ? `<div><b>${esc(x.du_an)}</b></div>` : ''}</td>
      <td class="dy-nd"><div>${esc(nd[0])}</div>${nd.slice(1).map((d) => `<div class="dy-diff">${esc(d)}</div>`).join('')}${x.loi && x.trang_thai === 'cho' ? `<div class="small dy-loi">⚠ Lần duyệt trước không ghi được: ${esc(x.loi)}</div>` : ''}</td>
      <td><span class="st ${cls}">${ten}</span>${x.trang_thai !== 'cho' ? `<div class="muted small">${esc(x.nguoi_duyet)}${x.duyet_luc ? ' · ' + tg(x.duyet_luc) : ''}</div>` : ''}${x.ly_do ? `<div class="small dy-lydo">${esc(x.ly_do)}</div>` : ''}</td>
      <td class="dy-btns">${dyNut(x)}</td>
    </tr>`; }).join('') : `<tr><td colspan="8" class="empty">${DY.tt === 'cho' ? (DY.la ? 'Không có hồ sơ chờ duyệt 🎉' : 'Bạn không có hồ sơ đang chờ duyệt') : 'Không có hồ sơ'}</td></tr>`;
  const so = Math.max(1, Math.ceil(r.tong / r.moi_trang));
  $('#dy-page').textContent = `${r.tong} hồ sơ · trang ${DY.trang + 1}/${so}`;
  $('#dy-prev').disabled = DY.trang <= 0; $('#dy-next').disabled = DY.trang + 1 >= so;
  dyChon();
}
function dyChon() {
  const n = $$('#dy-tbody [data-dyck]:checked').length;
  $('#dy-ok').disabled = !n; $('#dy-no').disabled = !n;
  $('#dy-ok').textContent = n ? `✓ Duyệt ${n} mục đã chọn` : '✓ Duyệt mục đã chọn';
  $('#dy-no').textContent = n ? `✕ Từ chối ${n} mục đã chọn` : '✕ Từ chối mục đã chọn';
}
async function dyXuLy(ids, hd) {
  let ly_do = '';
  if (hd === 'tu_choi') {
    ly_do = prompt(`Lý do từ chối ${ids.length} hồ sơ (người nhập sẽ thấy lý do này):`, '');
    if (ly_do === null) return;
    if (!ly_do.trim()) return alert('Từ chối cần ghi lý do');
  }
  try {
    const r = await api('/api/duyet/xu-ly', { method: 'POST', body: JSON.stringify({ ids, hanh_dong: hd, ly_do }) });
    dyToast(`${hd === 'duyet' ? '✓ Đã duyệt' : '✕ Đã từ chối'} ${r.so} hồ sơ`);
    if (r.loi?.length) alert(`Không ghi được ${r.loi.length} hồ sơ (vẫn ở Chờ duyệt):\n- ${r.loi.join('\n- ')}`);
    await dyLamMoi();
  } catch (err) { alert(err.message); }
}
// Nút trên 1 hồ sơ: người duyệt Duyệt / Từ chối; người nhập (hoặc người duyệt) Hủy khi còn chờ
function dyNut(x) {
  if (x.trang_thai !== 'cho') return '';
  return (DY.la ? `<button type="button" class="sm primary" data-dyok="${x.id}">Duyệt</button><button type="button" class="sm danger" data-dyno="${x.id}">Từ chối</button>` : '')
    + (DY.la || x.nguoi_nhap_id === ME?.id ? `<button type="button" class="sm" data-dyhuy="${x.id}" title="Hủy nội dung chưa duyệt (nhập sai) – không ghi vào số liệu, có ghi nhật ký">Hủy</button>` : '');
}
async function dyHuy(ids) {
  if (!confirm(`Hủy ${ids.length} nội dung chưa duyệt? Số liệu này chưa được ghi nên hủy không ảnh hưởng tổng; việc hủy được ghi nhật ký.`)) return;
  try { const r = await api('/api/duyet/huy', { method: 'POST', body: JSON.stringify({ ids }) }); dyToast(`Đã hủy ${r.so} nội dung chưa duyệt`); await dyLamMoi(); }
  catch (err) { alert(err.message); }
}
// Sau duyệt / từ chối / hủy: vẽ lại danh sách, mục Chờ duyệt, nhãn, số trên tab và số liệu trang đang mở
async function dyLamMoi() {
  DY.nhanLuc = 0;
  if (!$('#tab-duyet').hidden) await loadDuyet();
  dyPoll(); dyPanel();
  const tab = ['revenue', 'cost'].find((t) => !$('#tab-' + t).hidden);
  if (tab && loaders[tab]) loaders[tab]();
}
// Mục "Chờ duyệt" trong Nhập liệu (Doanh thu / Chi phí): nội dung chờ của dự án đang chọn – CHƯA tính vào tổng
const DY_NHOM = { revenue: ['doanh_thu', 'tien_ve', 'td', 'bh'], cost: ['chi_phi', 'thau_phu', 'tp_hd_pl', 'tp_thanh_toan'] };
async function dyPanel() {
  if (!can('nop')) return;
  for (const el of $$('.dy-panel[data-dy-nhom]')) {
    const tab = el.closest('.tab-panel');
    if (!tab || tab.hidden || !revProjectId) { el.hidden = true; continue; }
    let r;
    try { r = await api(`/api/duyet?tt=cho&du_an=${revProjectId}`, AUTO); } catch { continue; }
    const rows = r.rows.filter((x) => DY_NHOM[el.dataset.dyNhom].includes(x.loai));
    el.hidden = !rows.length;
    if (!rows.length) { el.innerHTML = ''; continue; }
    const tong = rows.reduce((a, x) => a + (x.hanh_dong === 'Xóa' ? 0 : Number(x.so_tien) || 0), 0);
    const tg = (d) => new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    const mo = el.querySelector('details')?.open ?? true;
    el.innerHTML = `<details ${mo ? 'open' : ''}><summary><span class="dy-p-ic">⏳</span> <b>${rows.length}</b> nội dung chờ duyệt${tong ? ` · ${dvT(tong)}${dvKey('dong') === 'dong' ? ' đ' : ''}` : ''}
        <span class="dy-p-note">CHƯA tính vào tổng – chỉ ghi vào số liệu khi Quản trị / Lãnh đạo duyệt</span></summary>
      <div class="table-wrap"><table class="dy-p-table"><thead><tr><th>Thời gian</th><th>Người nhập</th><th>Thao tác</th><th>Nội dung</th><th class="num">Số tiền</th><th></th></tr></thead>
      <tbody>${rows.map((x) => `<tr><td class="muted small">${tg(x.at)}</td><td>${esc(x.ho_ten_nhap || x.nguoi_nhap)}</td>
        <td><span class="dy-hd dy-hd-${x.hanh_dong === 'Xóa' ? 'xoa' : x.hanh_dong === 'Thêm' ? 'them' : 'sua'}">${esc(x.hanh_dong)}</span></td>
        <td class="dy-nd">${String(x.noi_dung || '').split(' | ').map((d, i) => `<div class="${i ? 'dy-diff' : ''}">${esc(d)}</div>`).join('')}${x.loi ? `<div class="small dy-loi">⚠ ${esc(x.loi)}</div>` : ''}</td>
        <td class="num">${x.so_tien == null ? '' : dvm(x.so_tien)}</td><td class="dy-btns">${dyNut(x)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }
}
window.addEventListener('bks-cho-duyet', (e) => { dyToast('⏳ ' + (e.detail?.thong_bao || 'Đã gửi duyệt')); DY.nhanLuc = 0; setTimeout(() => { dyPanel(); dyPoll(); }, 300); });
document.addEventListener('click', (e) => {
  const h = e.target.closest('[data-dyhuy]'); if (h) { e.preventDefault(); return dyHuy([Number(h.dataset.dyhuy)]); }
  if (e.target.closest('#tab-duyet')) return;
  const ok = e.target.closest('.dy-panel [data-dyok]'); if (ok) return dyXuLy([Number(ok.dataset.dyok)], 'duyet');
  const no = e.target.closest('.dy-panel [data-dyno]'); if (no) return dyXuLy([Number(no.dataset.dyno)], 'tu_choi');
});
$('#tab-duyet')?.addEventListener('click', (e) => {
  const t = e.target.closest('#dy-tt button[data-tt]');
  if (t) { DY.tt = t.dataset.tt; DY.trang = 0; $$('#dy-tt button').forEach((b) => b.classList.toggle('on', b === t)); return loadDuyet(); }
  if (e.target.id === 'dy-prev') { DY.trang = Math.max(0, DY.trang - 1); return loadDuyet(); }
  if (e.target.id === 'dy-next') { DY.trang++; return loadDuyet(); }
  const ok = e.target.closest('[data-dyok]'); if (ok) return dyXuLy([Number(ok.dataset.dyok)], 'duyet');
  const no = e.target.closest('[data-dyno]'); if (no) return dyXuLy([Number(no.dataset.dyno)], 'tu_choi');
  if (e.target.id === 'dy-ok' || e.target.id === 'dy-no') {
    const ids = $$('#dy-tbody [data-dyck]:checked').map((x) => Number(x.dataset.dyck));
    if (ids.length) dyXuLy(ids, e.target.id === 'dy-ok' ? 'duyet' : 'tu_choi');
  }
});
$('#tab-duyet')?.addEventListener('change', (e) => {
  if (e.target.id === 'dy-all') { $$('#dy-tbody [data-dyck]').forEach((x) => { x.checked = e.target.checked; }); return dyChon(); }
  if (e.target.id === 'dy-mine') { DY.mine = e.target.checked; DY.trang = 0; return loadDuyet(); }
  if (e.target.matches('[data-dyck]')) dyChon();
});
$('#dy-q')?.addEventListener('input', (e) => { clearTimeout(DY.tq); DY.tq = setTimeout(() => { DY.q = e.target.value.trim(); DY.trang = 0; loadDuyet(); }, 300); });
// Mục "Chờ duyệt" cập nhật mỗi khi tải lại số liệu Doanh thu / Chi phí (đổi dự án, lưu, xóa…)
{ const lr = loadRevenue, lc = loadCost;
  loadRevenue = async function (...a) { const r = await lr.apply(this, a); dyPanel(); return r; };
  loadCost = async function (...a) { const r = await lc.apply(this, a); dyPanel(); renderTdPick(); if (cForm?.elements.td && !cForm.elements.id.value) cForm.elements.td.value = String(tdDangChon()); return r; }; }

// ---------- Đợt A: đợt điều chỉnh TĐ2 (nhiều đợt tăng / giảm cho 1 văn bản HĐ / PL) ----------
let dcCur = null; // { loai: 'dt' | 'tp', id }
function dcVanBan() {
  if (!dcCur) return null;
  if (dcCur.loai === 'dt') {
    const r = revData.items.find((x) => x.id === dcCur.id);
    return r && { ten: `${r.ma_loai} ${r.so_ma || r.so_hieu}`, sub: 'Doanh thu · HĐ chủ đầu tư' + (hdKhoa(r) ? ' · 🔒 đã chốt quyết toán' : ''), t1: Number(r.gia_tri_ky ?? r.gia_tri) || 0, t2: Number(r.gia_tri) || 0, dot: r.dot || [], ok: canRv('hd') && !hdKhoa(r) && !vbTd(r).coQt };
  }
  for (const c of costData.thau_phu || []) {
    const l = c.lines.find((x) => x.id === dcCur.id);
    if (l) return { ten: `${l.ma_loai} ${c.so_ma}`, sub: `HĐ đầu vào · ${tpTen(c)}`, t1: Number(l.gia_tri_ky ?? l.gia_tri) || 0, t2: Number(l.gia_tri) || 0, dot: l.dot || [], ok: can('hd') && !(c.khoa && !tpMoKhoa.has(c.id)) && nnV(l.gia_tri_qt) === null };
  }
  return null;
}
function dlgShell(id, onClick) {
  let dlg = $('#' + id);
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.id = id; dlg.className = 'tp-dlg dc-dlg';
    document.body.appendChild(dlg);
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('input', (e) => { const tr = e.target.closest('tr[data-k]'); if (tr) { const b = $('[data-save]', tr); if (b) b.hidden = false; } });
    dlg.addEventListener('change', (e) => { if (e.target.dataset.f === 'kieu') { const i = $('[data-f="so_tien"]', e.target.closest('tr')); if (i) i.placeholder = e.target.value === 'chot' ? 'Giá trị mới (VD 1.050tr)' : '+ tăng · − giảm (số âm)'; } });
    dlg.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-k]'); if (e.key === 'Enter' && tr) { e.preventDefault(); $('[data-save]', tr)?.click(); } });
  }
  return dlg;
}
function openDc(loai, id) {
  dcCur = { loai, id };
  const dlg = dlgShell('dc-dlg', onDcClick);
  renderDc();
  if (!dlg.open) dlg.showModal();
  setTimeout(() => $('tr[data-k="new"] [data-f="so_tien"]', dlg)?.focus(), 50);
}
function renderDc() {
  const dlg = $('#dc-dlg'); const v = dcVanBan();
  if (!dlg || !v) return;
  const ok = v.ok;
  const inp = (f, val, attrs = '') => `<input data-f="${f}" value="${esc(val ?? '')}" ${attrs} ${ok ? '' : 'disabled'}>`;
  const row = (d, k) => `<tr data-k="${d ? d.id : 'new'}" class="${d ? '' : 'tv-draft'}">
      <td><b>${d ? 'Đợt ' + (k + 1) : 'Đợt ' + (v.dot.length + 1)}</b>${d ? '' : ` <span class="st st-tam-tinh">Mới</span><select data-f="kieu" class="dc-kieu" title="Tăng / giảm: gõ phần chênh (+/−) · Chốt: gõ giá trị mới, hệ thống tự tính phần chênh so với TĐ2 hiện tại"><option value="dc">Tăng / giảm (±)</option><option value="chot">Chốt giá trị mới</option></select>`}</td>
      <td>${inp('ngay', d ? isoToDmy(d.ngay) : '', 'class="date-dmy"')}</td>
      <td>${inp('noi_dung', d ? d.noi_dung : '', 'maxlength="500" placeholder="VD: Phát sinh tăng khối lượng móng"')}</td>
      <td>${inp('so_tien', d ? money(d.so_tien) : '', 'class="money num" placeholder="+ tăng · − giảm (số âm)"')}</td>
      <td class="row-actions">${ok ? `<button class="primary sm" data-save ${d ? 'hidden' : ''}>${d ? 'Lưu' : 'Thêm đợt'}</button>${d ? '<button class="danger sm" data-del>Xóa</button>' : ''}` : ''}</td>
    </tr>`;
  let lk = v.t1;
  dlg.innerHTML = `
    <div class="tp-dlg-head">
      <div><div class="muted small">${esc(v.sub)} · Đợt điều chỉnh (TĐ2)</div><h3>${esc(v.ten)}</h3></div>
      <button class="ghost-dark" data-close title="Đóng (Esc)">✕</button>
    </div>
    <div class="kpis tp-kpis">
      <div class="kpi"><div class="label">TĐ1 · Giá trị ký</div><div class="value">${dvm(v.t1)}</div><div class="sub">trước VAT</div></div>
      <div class="kpi"><div class="label">Tổng điều chỉnh</div><div class="value ${v.t2 - v.t1 < 0 ? 'neg' : ''}">${v.t2 - v.t1 > 0 ? '+' : ''}${dvm(v.t2 - v.t1)}</div><div class="sub">${v.dot.length} đợt</div></div>
      <div class="kpi"><div class="label">TĐ2 · Sau điều chỉnh</div><div class="value">${dvm(v.t2)}</div><div class="sub">= TĐ1 + các đợt</div></div>
    </div>
    <div class="table-wrap"><table class="tp-dtl">
      <thead><tr><th>Đợt</th><th>Ngày</th><th>Nội dung</th><th class="num">Số tiền tăng (+) / giảm (−) <br><span class="muted small">trước VAT</span></th><th></th></tr></thead>
      <tbody>${v.dot.map((d, k) => row(d, k)).join('')}${ok ? row(null) : ''}${!v.dot.length && !ok ? '<tr><td colspan="5" class="empty">Chưa có đợt điều chỉnh</td></tr>' : ''}</tbody>
      <tfoot><tr><td colspan="3">TĐ2 lũy kế: ${[`TĐ1 ${dvm(v.t1)}`, ...v.dot.map((d, k) => { lk += Number(d.so_tien) || 0; return `Đợt ${k + 1} → ${dvm(lk)}`; })].join(' · ')}</td><td class="num">${dvm(v.t2)}</td><td></td></tr></tfoot>
    </table></div>
    <div class="msg" id="dc-msg" role="alert"></div>`;
  if (ok) { $$('input.money', dlg).forEach(attachMoneyInput); $$('input.date-dmy', dlg).forEach(attachDateInput); }
}
async function dcReload() {
  if (dcCur.loai === 'dt') await loadRevenue();
  else { await loadCost(); if ($('#tp-dlg')?.open) renderTpDlg(); }
  renderDc();
}
async function onDcClick(e) {
  const t = e.target, dlg = $('#dc-dlg');
  if (t.dataset.close !== undefined) return dlg.close();
  const tr = t.closest('tr[data-k]'); if (!tr) return;
  const msg = () => $('#dc-msg');
  const v = (f) => $(`[data-f="${f}"]`, tr)?.value ?? '';
  const k = tr.dataset.k;
  try {
    if (t.dataset.save !== undefined) {
      const ngay = dmyToIso(v('ngay'));
      if (ngay === null) return showMsg(msg(), 'Ngày không hợp lệ, nhập dd/mm/yyyy', 'err');
      let so_tien = parseMoney(v('so_tien')), noi_dung = v('noi_dung');
      if (k === 'new' && v('kieu') === 'chot') { // chốt giá trị mới -> phần chênh so với TĐ2 hiện tại
        if (so_tien === '' || so_tien === '-') return showMsg(msg(), 'Nhập giá trị chốt mới', 'err');
        const vb = dcVanBan(), moi = Number(so_tien);
        so_tien = String(moi - vb.t2);
        if (!noi_dung) noi_dung = `Chốt giá trị mới ${money(moi)}`;
        if (!Number(so_tien)) return showMsg(msg(), 'Giá trị chốt bằng TĐ2 hiện tại – không có thay đổi', 'err');
      }
      if (!Number(so_tien)) return showMsg(msg(), 'Nhập số tiền tăng (+) hoặc giảm (số âm)', 'err');
      const body = { loai: dcCur.loai, vb_id: dcCur.id, ngay, noi_dung, so_tien };
      await api(k === 'new' ? '/api/dieu-chinh' : `/api/dieu-chinh/${k}`, { method: k === 'new' ? 'POST' : 'PUT', body: JSON.stringify(body) });
      await dcReload(); showMsg(msg(), k === 'new' ? 'Đã thêm đợt điều chỉnh' : 'Đã lưu đợt điều chỉnh');
    }
    if (t.dataset.del !== undefined) {
      if (!confirm('Xóa đợt điều chỉnh này? TĐ2 sẽ tính lại.')) return;
      await api(`/api/dieu-chinh/${k}`, { method: 'DELETE' });
      await dcReload(); showMsg(msg(), 'Đã xóa đợt điều chỉnh');
    }
  } catch (err) { showMsg(msg(), err.message, 'err'); }
}

// ---------- Đợt A: quyết toán HĐ doanh thu (TĐ3) – nhập số QT từng văn bản, đóng quyết toán cả HĐ ----------
let qtDtHead = null;
function openQtDt(id) {
  qtDtHead = id;
  const dlg = dlgShell('qtdt-dlg', onQtDtClick);
  renderQtDt();
  if (!dlg.open) dlg.showModal();
}
function renderQtDt() {
  const dlg = $('#qtdt-dlg'), h = revData.items.find((x) => x.id === qtDtHead);
  if (!dlg || !h) return;
  const ms = [h, ...revData.items.filter((x) => x.loai === 'hd' && x.id !== h.id && hdKey(x) === hdKey(h))];
  const khoa = Boolean(h.qt_dong), ok = canRv('hd') && !khoa;
  dlg.innerHTML = `
    <div class="tp-dlg-head">
      <div><div class="muted small">Doanh thu · Quyết toán (TĐ3)</div><h3>HĐ ${esc(h.so_ma || h.so_hieu)} ${khoa ? '<span class="st st-hoan-thanh">🔒 Đã chốt quyết toán</span>' : '<span class="st">Chưa QT</span>'}</h3></div>
      <button class="ghost-dark" data-close title="Đóng (Esc)">✕</button>
    </div>
    <div class="grid-form qt-head">
      <label>Ngày quyết toán<input data-f="ngay_qt" class="date-dmy" value="${esc(isoToDmy(h.ngay_qt))}" ${ok ? '' : 'disabled'}></label>
      <label class="chk span-2"><input type="checkbox" data-f="dong" ${khoa ? 'checked' : ''} ${ok ? '' : 'disabled'}> Chốt quyết toán & khoá toàn bộ HĐ (HĐ + ${ms.length - 1} PL) – cần đủ số quyết toán cho HĐ và tất cả phụ lục</label>
    </div>
    ${khoa ? `<div class="lock-bar">🔒 Đã chốt quyết toán${h.ngay_qt ? ' ngày ' + dmy(h.ngay_qt) : ''} – <b>khoá toàn bộ HĐ</b> (sửa / xóa HĐ, PL, đợt điều chỉnh, thêm PL mới).${canRv('hd') ? ' <button type="button" class="sm" data-qtmokhoa>🔓 Mở khoá</button>' : ''}</div>` : ''}
    <div class="table-wrap"><table class="tp-dtl">
      <thead><tr><th>Văn bản</th><th class="num" title="Ký">TĐ1</th><th class="num" title="Điều chỉnh">TĐ2</th><th class="num" title="Quyết toán – trước VAT, trống = TĐ2">TĐ3<br><span class="muted small">nhập số quyết toán</span></th></tr></thead>
      <tbody>${ms.map((r) => { const x = vbTd(r); return `<tr data-id="${r.id}">
        <td><span class="kind-tag ${r.ma_loai === 'HĐ' ? 'kind-hd' : ''}">${esc(r.ma_loai)}</span> <b>${esc(r.so_ma || r.so_hieu)}</b></td>
        <td class="num">${dvm(x.t1)}</td><td class="num">${dvm(x.t2)}${tdDelta(x.t2, x.t1)}</td>
        <td><input data-f="gt_qt" class="money num" value="${x.coQt ? money(r.gt_qt) : ''}" placeholder="${money(x.t2)}" ${ok ? '' : 'disabled'}></td></tr>`; }).join('')}</tbody>
    </table></div>
    ${ok ? '<div class="tv-tools"><span class="muted small">Chưa chốt: lưu số quyết toán từng phần (văn bản trống tạm lấy TĐ2). Chốt: cần đủ số cho HĐ + mọi PL. Hồ sơ HT/QT ở mục 2 vẫn giữ để theo dõi thanh toán.</span><span class="spacer"></span><button class="primary sm" data-save>Lưu quyết toán</button></div>' : ''}
    <div class="msg" id="qtdt-msg" role="alert"></div>`;
  if (ok) { $$('input.money', dlg).forEach(attachMoneyInput); $$('input.date-dmy', dlg).forEach(attachDateInput); }
}
async function onQtDtClick(e) {
  const t = e.target, dlg = $('#qtdt-dlg'), msg = () => $('#qtdt-msg');
  if (t.dataset.close !== undefined) return dlg.close();
  const itemsOf = () => $$('tbody tr[data-id]', dlg).map((tr) => ({ id: Number(tr.dataset.id), gt_qt: parseMoney($('[data-f="gt_qt"]', tr).value) }));
  if (t.dataset.qtmokhoa !== undefined) { // mở khoá quyết toán: cần Passcode
    const h = revData.items.find((x) => x.id === qtDtHead);
    const pc = await askPasscode(`Mở khoá quyết toán HĐ ${h?.so_ma || ''}?`, 'Bỏ chốt quyết toán để sửa HĐ / PL / đợt điều chỉnh. Số quyết toán đã nhập vẫn giữ.');
    if (pc === null) return;
    try {
      await api(`/api/doanh-thu/${qtDtHead}/quyet-toan`, { method: 'PUT', body: JSON.stringify({ ngay_qt: h?.ngay_qt || null, dong: false, items: itemsOf(), passcode: pc }) });
      await loadRevenue(); renderQtDt(); showMsg(msg(), 'Đã mở khoá quyết toán');
    } catch (err) { showMsg(msg(), err.message, 'err'); }
    return;
  }
  if (t.dataset.save === undefined) return;
  const ngay_qt = dmyToIso($('[data-f="ngay_qt"]', dlg).value);
  if (ngay_qt === null) return showMsg(msg(), 'Ngày không hợp lệ, nhập dd/mm/yyyy', 'err');
  const dong = $('[data-f="dong"]', dlg).checked;
  if (dong && !ngay_qt) return showMsg(msg(), 'Chốt quyết toán: nhập Ngày quyết toán', 'err');
  const items = itemsOf();
  if (dong) { // chốt: HĐ + mọi PL phải có số quyết toán
    const thieu = $$('tbody tr[data-id]', dlg).filter((tr) => !String($('[data-f="gt_qt"]', tr).value).trim()).map((tr) => tr.querySelector('.kind-tag')?.textContent || '');
    $$('tbody tr[data-id]', dlg).forEach((tr) => $('[data-f="gt_qt"]', tr).classList.toggle('invalid', !String($('[data-f="gt_qt"]', tr).value).trim()));
    if (thieu.length) return showMsg(msg(), `Chưa chốt quyết toán: ${thieu.join(', ')} chưa có số quyết toán. Nhập đủ cho HĐ và tất cả phụ lục rồi chốt lại.`, 'err');
  }
  try {
    await api(`/api/doanh-thu/${qtDtHead}/quyet-toan`, { method: 'PUT', body: JSON.stringify({ ngay_qt, dong, items }) });
    await loadRevenue(); renderQtDt(); showMsg(msg(), dong ? 'Đã chốt quyết toán – khoá toàn bộ HĐ' : 'Đã lưu quyết toán');
  } catch (err) { showMsg(msg(), err.message, 'err'); }
}

// ---------- Đợt B: dự trù chi phí theo nhóm ----------
const DTR_LOAI = { ky: 'TĐ1 · Dự trù', dc: 'TĐ2 · Đợt điều chỉnh', qt: 'TĐ3 · Quyết toán' };
// Dự trù 1 nhóm tại TĐ1 / TĐ2 / TĐ3 (trước VAT) – cùng cách tính với Báo cáo
function dtrTd(rows) {
  const S = (k) => rows.filter((r) => r.loai === k).reduce((a, r) => a + (Number(r.so_tien) || 0), 0);
  const t1 = S('ky'), t2 = t1 + S('dc'), coQt = rows.some((r) => r.loai === 'qt');
  return { t1, t2, t3: coQt ? S('qt') : t2, coQt, ngoai: t1 === 0 && t2 !== 0 };
}
// Chi tiết đã có của nhóm (trước VAT): HĐ đầu vào theo TĐ2 + chi phí đã ghi (không gồm vay / trả gốc)
function dtrChiTiet(code) {
  const n = NHOM().find((x) => x.code === code);
  const tpC = (costData.thau_phu || []).filter((c) => (c.nhom || 'thau_phu') === code);
  const tpV = tpC.reduce((a, c) => a + c.lines.reduce((b, l) => b + (Number(l.gia_tri) || 0), 0), 0);
  const le = (costData.items || []).filter((r) => r.nhom === code && !n?.sub.find((x) => x.code === r.nhom_con)?.khong_tinh_cp);
  const leV = le.reduce((a, r) => a + (Number(r.gia_tri) || 0), 0);
  return { v: tpV + leV, nguon: [tpC.length && 'HĐ đầu vào', leV && 'mua lẻ'].filter(Boolean) };
}
function renderDuTru() {
  const card = $('#dtr-card');
  if (!card) return;
  const rows = costData.du_tru;
  card.hidden = costAll || !Array.isArray(rows);
  if (card.hidden) return;
  const ok = can('hd');
  $('.dtr-table').dataset.tdOn = tdDangChon();
  const codes = [...new Set(rows.map((r) => r.nhom))].sort((a, b) => NHOM().findIndex((x) => x.code === a) - NHOM().findIndex((x) => x.code === b));
  const tot = [0, 0, 0];
  $('#dtr-tbody').innerHTML = codes.length ? codes.map((code) => {
    const n = NHOM().find((x) => x.code === code), x = dtrTd(rows.filter((r) => r.nhom === code)), ct = dtrChiTiet(code);
    tot[0] += x.t1; tot[1] += x.t2; tot[2] += x.t3;
    const note = [x.ngoai ? '<span class="st st-tam-tinh" title="Chưa có dự trù TĐ1 – phát sinh ở TĐ2">Ngoài dự trù</span>' : '',
      ct.nguon.length ? `<span class="warn-text" title="Nhóm có cả ${ct.nguon.join(' + ')} và dự trù – đang cộng dồn, kiểm tra tránh tính trùng">⚠ cộng dồn</span>` : ''].filter(Boolean).join(' ');
    return `<tr data-dtr="${esc(code)}">
      <td><b>${esc(n?.ten || code)}</b></td>
      <td class="num">${dvm(x.t1)}</td>
      <td class="num">${dvm(x.t2)}${tdDelta(x.t2, x.t1)}</td>
      <td class="num ${x.coQt ? '' : 'muted'}">${dvm(x.t3)}${tdDelta(x.t3, x.t2)}</td>
      <td class="num">${ct.v ? dvm(ct.v) : '<span class="muted">–</span>'}</td>
      <td>${note}</td>
      <td class="row-actions"><button type="button" class="sm" data-dtropen="${esc(code)}">${ok ? 'Nhập / sửa' : 'Xem'}</button></td>
    </tr>`;
  }).join('') : `<tr><td colspan="7" class="empty">Chưa có dự trù. ${ok ? 'Chọn nhóm bên dưới rồi bấm <b>+ Dự trù</b>.' : ''}</td></tr>`;
  $('#dtr-tfoot').innerHTML = codes.length ? `<tr><td>TỔNG DỰ TRÙ</td><td class="num">${dvm(tot[0])}</td><td class="num">${dvm(tot[1])}${tdDelta(tot[1], tot[0])}</td><td class="num">${dvm(tot[2])}${tdDelta(tot[2], tot[1])}</td><td colspan="3"></td></tr>` : '';
  $('#dtr-total').innerHTML = dvm(tot[1]);
  const tools = $('#dtr-tools');
  tools.innerHTML = ok ? `<label class="tv-hd-pick">Nhóm <select id="dtr-pick">${NHOM().map((n) => `<option value="${n.code}">${esc(n.ten)}</option>`).join('')}</select></label>
    <button type="button" class="sm" data-dtrnew>+ Dự trù</button>` : '';
  if (!card.dataset.bound) {
    card.dataset.bound = '1';
    card.addEventListener('click', (e) => {
      const t = e.target;
      if (t.dataset.dtropen) return openDtr(t.dataset.dtropen);
      if (t.dataset.dtrnew !== undefined) return openDtr($('#dtr-pick').value, true);
    });
  }
}
let dtrNhom = null, dtrDraft = null;
function openDtr(code, moi = false) {
  dtrNhom = code;
  const rows = (costData.du_tru || []).filter((r) => r.nhom === code);
  const md = tdDangChon(), khoaN = rows.some((r) => r.loai === 'qt');
  dtrDraft = (moi || !rows.length) && !khoaN ? ({ 1: 'ky', 2: 'dc', 3: 'qt' })[md] : null; // mở sẵn dòng mới theo TĐ đang chọn
  const dlg = dlgShell('dtr-dlg', onDtrClick);
  renderDtr();
  if (!dlg.open) dlg.showModal();
  if (dtrDraft) setTimeout(() => $('#dtr-dlg tr[data-k="new"] [data-f="so_tien"]')?.focus(), 50);
}
function renderDtr() {
  const dlg = $('#dtr-dlg'); if (!dlg) return;
  const n = NHOM().find((x) => x.code === dtrNhom), ok = can('hd');
  const rows = (costData.du_tru || []).filter((r) => r.nhom === dtrNhom);
  const x = dtrTd(rows), ct = dtrChiTiet(dtrNhom);
  const vat0 = n?.khong_vat ? 0 : (rows.find((r) => r.loai === 'ky')?.vat ?? 10);
  const inp = (f, val, attrs = '') => `<input data-f="${f}" value="${esc(val ?? '')}" ${attrs} ${ok ? '' : 'disabled'}>`;
  let dot = 0;
  const md = tdDangChon(), khoaN = rows.some((y) => y.loai === 'qt'); // nhóm đã có quyết toán = khoá
  const row = (r) => {
    const loai = r ? r.loai : dtrDraft, ten = loai === 'dc' ? `TĐ2 · Đợt ${r ? ++dot : rows.filter((y) => y.loai === 'dc').length + 1}` : DTR_LOAI[loai];
    const vat = r ? r.vat : vat0, gt = r ? Number(r.so_tien) || 0 : 0;
    return `<tr data-k="${r ? r.id : 'new'}" class="${r ? '' : 'tv-draft'} dtr-${loai}">
      <td><b>${ten}</b>${r ? '' : ' <span class="st st-tam-tinh">Mới</span>'}</td>
      <td>${inp('ngay', r ? isoToDmy(r.ngay) : '', 'class="date-dmy"')}</td>
      <td>${inp('noi_dung', r ? r.noi_dung : '', `maxlength="300" placeholder="${loai === 'ky' ? 'VD: Dự trù thép, bê tông' : loai === 'dc' ? 'VD: Phát sinh tăng khối lượng' : 'VD: Quyết toán nhóm'}"`)}</td>
      <td>${inp('so_tien', r ? money(r.so_tien) : '', `class="money num" placeholder="${loai === 'dc' ? '+ tăng · − giảm (số âm)' : '0'}"`)}</td>
      <td>${inp('vat', vat, `type="number" min="0" max="100" step="1" class="vat-in" ${n?.khong_vat ? 'disabled' : ''}`)}</td>
      <td class="num">${r ? dvm(gt + Math.round((gt * (Number(vat) || 0)) / 100)) : ''}</td>
      <td class="row-actions">${!ok ? '' : r && khoaN ? (r.loai === 'qt' && md === 3 ? '<button class="sm" data-del title="Xóa số quyết toán để mở khoá nhóm (cần Passcode)">🔓 Mở khoá</button>' : '<span class="muted small">🔒 Khoá</span>')
        : r && { ky: 1, dc: 2, qt: 3 }[r.loai] !== md ? '<span class="muted small" title="Sửa ở tab TĐ tương ứng">–</span>'
          : `<button class="primary sm" data-save ${r ? 'hidden' : ''}>${r ? 'Lưu' : 'Thêm'}</button>${r ? '<button class="danger sm" data-del>Xóa</button>' : '<button class="sm" data-bo>Bỏ</button>'}`}</td>
    </tr>`;
  };
  const ord = { ky: 0, dc: 1, qt: 2 };
  const sorted = [...rows].sort((a, b) => ord[a.loai] - ord[b.loai] || String(a.ngay || '').localeCompare(String(b.ngay || '')) || a.id - b.id);
  dlg.innerHTML = `
    <div class="tp-dlg-head">
      <div><div class="muted small">Chi phí · Dự trù theo nhóm · ${esc(costData.du_an?.ma_du_an || '')}</div><h3>${esc(n?.ten || dtrNhom)} ${x.ngoai ? '<span class="st st-tam-tinh">Ngoài dự trù</span>' : ''}</h3></div>
      <button class="ghost-dark" data-close title="Đóng (Esc)">✕</button>
    </div>
    <div class="kpis tp-kpis">
      <div class="kpi"><div class="label">TĐ1 · Dự trù</div><div class="value">${dvm(x.t1)}</div><div class="sub">trước VAT</div></div>
      <div class="kpi"><div class="label">TĐ2 · Điều chỉnh</div><div class="value">${dvm(x.t2)}</div><div class="sub">${x.t2 - x.t1 ? `${x.t2 > x.t1 ? '+' : ''}${dvm(x.t2 - x.t1)} so với TĐ1` : '= TĐ1 + các đợt'}</div></div>
      <div class="kpi"><div class="label">TĐ3 · Quyết toán</div><div class="value">${dvm(x.t3)}</div><div class="sub">${x.coQt ? 'theo số quyết toán' : 'chưa có = TĐ2'}</div></div>
      <div class="kpi"><div class="label">Chi tiết đã có</div><div class="value">${dvm(ct.v)}</div><div class="sub">${ct.nguon.length ? ct.nguon.join(' + ') + ' · <span class="warn-text">cộng dồn</span>' : 'chưa có HĐ / chứng từ'}</div></div>
    </div>
    <div class="table-wrap"><table class="tp-dtl">
      <thead><tr><th>Thời điểm</th><th>Ngày</th><th>Nội dung</th><th class="num">Số tiền <br><span class="muted small">trước VAT</span></th><th>VAT %</th><th class="num">Sau VAT</th><th></th></tr></thead>
      <tbody>${sorted.map(row).join('')}${ok && dtrDraft ? row(null) : ''}${!rows.length && !dtrDraft ? '<tr><td colspan="7" class="empty">Chưa có dự trù</td></tr>' : ''}</tbody>
    </table></div>
    <div data-td-mode class="td-mode"></div>
    ${ok && !khoaN ? `<div class="tv-tools">${md === 1 ? '<button class="sm" data-dtradd="ky">+ Dự trù (TĐ1)</button>' : md === 2 ? '<button class="sm" data-dtradd="dc">+ Điều chỉnh (TĐ2)</button>' : '<button class="sm" data-dtradd="qt">+ Quyết toán (TĐ3) – nhập xong sẽ khoá nhóm</button>'}
      <span class="muted small">${md === 2 ? 'Chưa có dự trù TĐ1 mà điều chỉnh ở TĐ2 = chi phí ngoài dự trù' : ''}</span></div>` : ''}
    <div class="msg" id="dtr-msg" role="alert"></div>`;
  if (ok) { $$('input.money', dlg).forEach(attachMoneyInput); $$('input.date-dmy', dlg).forEach(attachDateInput); }
  renderTdMode();
}
async function onDtrClick(e) {
  const t = e.target, dlg = $('#dtr-dlg'), msg = () => $('#dtr-msg');
  if (t.dataset.close !== undefined) return dlg.close();
  if (t.dataset.dtradd) { dtrDraft = t.dataset.dtradd; renderDtr(); return setTimeout(() => $('#dtr-dlg tr[data-k="new"] [data-f="so_tien"]')?.focus(), 30); }
  const tr = t.closest('tr[data-k]'); if (!tr) return;
  if (t.dataset.bo !== undefined) { dtrDraft = null; return renderDtr(); }
  const v = (f) => $(`[data-f="${f}"]`, tr)?.value ?? '';
  const k = tr.dataset.k;
  try {
    if (t.dataset.save !== undefined) {
      const ngay = dmyToIso(v('ngay'));
      if (ngay === null) return showMsg(msg(), 'Ngày không hợp lệ, nhập dd/mm/yyyy', 'err');
      if (k === 'new' && dtrDraft === 'qt' && !confirm('Lưu số quyết toán? Nhóm sẽ bị KHOÁ (muốn sửa phải mở khoá bằng Passcode).')) return;
      const body = { nhom: dtrNhom, loai: k === 'new' ? dtrDraft : undefined, ngay, noi_dung: v('noi_dung'), so_tien: parseMoney(v('so_tien')), vat: v('vat') || 0 };
      await api(k === 'new' ? `/api/du-an/${revProjectId}/du-tru` : `/api/du-tru/${k}`, { method: k === 'new' ? 'POST' : 'PUT', body: JSON.stringify(body) });
      if (k === 'new') dtrDraft = null;
      await loadCost(); renderDtr(); showMsg(msg(), k === 'new' ? 'Đã thêm dự trù' : 'Đã lưu dự trù');
    }
    if (t.dataset.del !== undefined) {
      const r0 = (costData.du_tru || []).find((x) => x.id === Number(k));
      let pc = null;
      if (r0?.loai === 'qt') { pc = await askPasscode('Mở khoá nhóm dự trù?', 'Xóa số quyết toán của nhóm để sửa lại (có ghi nhật ký).', '🔓 Mở khoá'); if (pc === null) return; }
      else if (!confirm('Xóa dòng dự trù này?')) return;
      await api(`/api/du-tru/${k}`, { method: 'DELETE', body: pc ? JSON.stringify({ passcode: pc }) : undefined });
      await loadCost(); renderDtr(); showMsg(msg(), 'Đã xóa dự trù');
    }
  } catch (err) { showMsg(msg(), err.message, 'err'); }
}
