// Báo cáo tổng quan: gom toàn bộ số liệu đã liên kết (Doanh thu – HĐ CĐT – Thầu phụ – Chi phí – Tiền về)
// Dùng lại đúng công thức Dashboard (lib/dashboard.js) để số liệu khớp mọi nơi.
const { summarizeProject } = require('./dashboard');
const { summarizeCost, NHOM_CHI_PHI, KHOI_CHI_PHI, findNhom, isNgoaiCp, isTienVao } = require('./cost');
const { TP_NHOM } = require('./validate');
const { calcLine } = require('./revenue');
const nn = (x) => (x === null || x === undefined || x === '' ? null : Number(x));
const svOf = (gt, vat) => calcLine({ gia_tri: gt, vat }).sau_vat;
// Sau VAT của 1 văn bản tại TĐ2 (giá trị ký + đợt, đợt có thể có VAT riêng)
const sv2Of = (l) => { const t2 = Number(l.gia_tri) || 0; return t2 + require('./revenue').tienVatTd2(l, t2, Number(l.vat) || 0); };
// Đợt A – mỗi văn bản HĐ / PL có 3 thời điểm ĐỘC LẬP (trước VAT):
//  TĐ1 = giá trị ký (gia_tri_ky) · TĐ2 = TĐ1 + các đợt điều chỉnh (gia_tri, đã cộng đợt khi đọc) · TĐ3 = giá trị quyết toán của văn bản (null = chưa có -> = TĐ2)
function tdLine(l) {
  const t1 = Number(l.gia_tri_ky ?? l.gia_tri) || 0, t2 = Number(l.gia_tri) || 0;
  const t3 = nn(l.gt_qt ?? (l.ma_loai !== undefined && l.gia_tri_qt !== undefined ? l.gia_tri_qt : null));
  return { t1, t2, t3, t3d: t2 };
}

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
const monthOf = (ngay) => (ngay ? String(ngay).slice(0, 7) : null);

// p: dự án; rev (calcLine), tienVe, cost (costLine), tp (buildContracts)
function projectReport0(p, { rev, tienVe, cost, tp, duTru = [] }) {
  for (const c of tp) for (const l of c.lines || []) l._ko1 = Boolean(c.goi_id || c.phat_sinh); // gói chi phí: TĐ1 của HĐ này = 0 (xem tpLine)
  const s = summarizeProject({ rev, tienVe, cost, tp });
  const hdRows = rev.filter((r) => r.loai === 'hd');
  const qtRows = rev.filter((r) => r.loai === 'qt');
  const masters = hdRows.filter((r) => r.ma_loai === 'HĐ');
  const sameHd = (m) => (r) => String(r.so_ma).toLowerCase() === String(m.so_ma).toLowerCase();
  const sum = (arr, f) => arr.reduce((a, x) => a + (typeof f === 'function' ? f(x) : x[f]), 0);

  // ---- Từng HĐ chủ đầu tư ----
  const tpOf = (id) => tp.filter((c) => (c.hd_cdt_id || 0) === id);
  const tpSum = (list) => ({
    n: list.length, n_qt: list.filter((c) => c.da_qt).length,
    hd_sv: sum(list, 'hd_sau_vat'), qt_gt: sum(list, 'qt_gia_tri'), qt_sv: sum(list, 'qt_sau_vat'),
    da_tt: sum(list, 'da_tt'), con_lai: sum(list, 'con_lai'),
  });
  const leGoi = goiLeOf(cost);
  const ganGoi = new Set(tp.map((c) => c.goi_id).filter(Boolean)), qtNhom = new Set(duTru.filter((r) => r.loai === 'qt').map((r) => r.nhom));
  const svDt = (r, f) => (f === 'sv' ? svOf(Number(r.so_tien) || 0, r.vat) : Number(r.so_tien) || 0);
  // V27.12: 1 gói tại TĐ k – TĐ1 = gói; TĐ2/3 = mua lẻ gắn gói + phần gói chưa chi hết (gói mở, chưa gắn HĐ, nhóm chưa QT ở TĐ3)
  const goiV = (r, f, k) => { const m = leGoi(r.id, f); if (k === 1) return svDt(r, f);
    const mo = !ganGoi.has(r.id) && r.tinh_trang !== 'dong' && !(k === 3 && qtNhom.has(r.nhom)); return m + (mo ? Math.max(0, svDt(r, f) - m) : 0); };
  const cpHd = (id) => { // V12.12: phần chi phí xác định được theo HĐ chủ đầu tư (phần còn lại = chi phí chung, tính ở giao diện = dự án − tổng các HĐ)
    const list = tpOf(id), ky = duTru.filter((r) => r.loai === 'ky' && (r.hd_cdt_id || 0) === id);
    const goi = (f, k) => ky.reduce((a, r) => a + goiV(r, f, k), 0);
    return { gt: [1, 2, 3].map((k) => tpTd(list, k, 'gt') + goi('gt', k)), sv: [1, 2, 3].map((k) => tpTd(list, k, 'sv') + goi('sv', k)), da_chi: sum(list, 'da_tt'), qt: list.length > 0 && list.every((c) => c.da_qt) };
  };
  const hds = masters.map((m) => {
    const lines = hdRows.filter(sameHd(m));
    const qts = qtRows.filter((q) => q.hd_id === m.id);
    const tvs = tienVe.filter((t) => t.hd_id === m.id);
    const qtDong = Boolean(m.qt_dong); // đóng quyết toán ở dòng HĐ gốc (Đợt A) -> đóng cả các PL
    const qtCu = tvs.some((t) => t.loai === 'quyet_toan') || qts.some((q) => norm(q.so_hieu).includes('quyet toan')); // cách nhận biết cũ
    const daQt = qtDong || qtCu;
    const hd = { gt: sum(lines, 'gia_tri'), sv: sum(lines, 'sau_vat') };
    const nt = { gt: sum(qts, 'gia_tri'), sv: sum(qts, 'sau_vat') };
    const L = lines.map((l) => ({ l, ...tdLine(l) }));
    const tay3 = L.some((x) => x.t3 !== null);
    // TĐ3 của HĐ: đã đóng QT (hoặc có số QT từng văn bản) -> cộng số QT từng văn bản, văn bản chưa có số = TĐ2 (lưu ý)
    //  dữ liệu cũ (QT nhận biết qua hồ sơ "Quyết toán" ở mục 2, chưa có số QT từng văn bản) -> tổng hồ sơ HT/QT như trước
    const td3 = qtDong || tay3 || !(qtCu && qts.length)
      ? { gt: sum(L, (x) => x.t3 ?? x.t3d), sv: sum(L, (x) => (x.t3 !== null ? svOf(x.t3, x.l.vat) : sv2Of(x.l))) } : nt;
    const qtThieu = qtDong ? L.filter((x) => x.t3 === null).length : 0; // số văn bản đã đóng QT nhưng chưa có số QT (tạm = TĐ2)
    const dk = qtDong ? td3 : daQt && qts.length ? nt : hd;
    const tv = sum(tvs, 'so_tien');
    const t = tpSum(tpOf(m.id));
    return {
      id: m.id, so_hieu: m.so_hieu, so_ma: m.so_ma, ngay: m.ngay, vat: m.vat, tam_tinh: !daQt, vat0: lines.some((l) => Number(l.vat) === 0),
      so_pl: lines.length - 1, hd, so_dot: qts.length, nt, da_qt: daQt, dk,
      pct_ht: hd.sv ? nt.sv / hd.sv : 0,
      tien_ve: tv, phai_thu: nt.sv - tv, con_lai_hd: dk.sv - tv,
      tp: t, lai_gop_dk: dk.gt - t.qt_gt, td3, qt_dong: qtDong, qt_thieu: qtThieu, ngay_qt: m.ngay_qt || null,
      // V11.12: TĐ1 / TĐ2 của riêng HĐ này (cùng cách tính mục IV) + điều chỉnh theo văn bản – để báo cáo hiện HĐ dưới dự án
      td1: { gt: sum(L, (x) => x.t1), sv: sum(L, (x) => svOf(x.t1, x.l.vat)) }, td2: { gt: sum(L, (x) => x.t2), sv: sum(L, (x) => sv2Of(x.l)) }, cp_td: cpHd(m.id),
      pl: L.filter((x) => x.t2 !== x.t1).map((x) => ({ ma: x.l.ma_loai === 'HĐ' ? 'HĐ' : x.l.ma_loai, gt: x.t2 - x.t1, sv: sv2Of(x.l) - svOf(x.t1, x.l.vat) })),
    };
  });
  const tpChuaGan = tpSum(tpOf(0));

  // ---- Chi phí theo khối / nhóm (Dự kiến = tab Chi phí) ----
  const tpAsCost = tp.map((c) => ({ nhom: c.nhom || 'thau_phu', gia_tri: c.qt_gia_tri, tien_vat: c.qt_tien_vat, sau_vat: c.qt_sau_vat, tam_tinh: c.tam_tinh }));
  const tong = summarizeCost([...cost, ...tpAsCost]);
  const khoi = KHOI_CHI_PHI.map((k) => ({ code: k.code, ten: k.ten, gt: tong.theo_khoi[k.code].gia_tri, sv: tong.theo_khoi[k.code].sau_vat }));
  const nhom = NHOM_CHI_PHI.map((n) => ({ code: n.code, khoi: n.khoi, ten: n.ten, gt: tong.theo_nhom[n.code].gia_tri, sv: tong.theo_nhom[n.code].sau_vat, so_dong: tong.theo_nhom[n.code].so_dong }));

  // ---- Dòng tiền thực tế theo tháng (sau VAT): Thu = tiền về + nhận tiền vay; Chi = chi phí + thanh toán thầu phụ (gồm tạm ứng) + trả nợ gốc ----
  const dong_tien = {};
  const flow = { thu_chua_ngay: 0, chi_chua_ngay: 0 };
  const add = (ngay, k, v) => {
    const m = monthOf(ngay);
    if (!m) { flow[k + '_chua_ngay'] += v; return; }
    (dong_tien[m] ||= { thu: 0, chi: 0 })[k] += v;
  };
  tienVe.forEach((t) => add(t.ngay, 'thu', t.so_tien));
  cost.forEach((r) => add(r.ngay, isTienVao(r) ? 'thu' : 'chi', r.sau_vat));
  tp.forEach((c) => c.pays.forEach((x) => add(x.ngay, 'chi', x.so_tien)));

  // ---- Tiền thực tế theo tháng (sau VAT): thu = tiền về; chi phí đã chi; trả thầu phụ (gồm tạm ứng); nhận tiền vay; trả nợ gốc vay ----
  const tt = {}, ttNo = { thu: 0, cp: 0, tp: 0, goc: 0, vay: 0 };
  const ttNgay = {}; // theo ngày: để tính tiền thật đến đúng ngày chốt TĐ
  const put = (ngay, k, v) => {
    const m = monthOf(ngay);
    (m ? (tt[m] ||= { thu: 0, cp: 0, tp: 0, goc: 0, vay: 0 }) : ttNo)[k] += v;
    if (m) (ttNgay[String(ngay).slice(0, 10)] ||= { thu: 0, cp: 0, tp: 0, goc: 0, vay: 0 })[k] += v;
  };
  tienVe.forEach((t) => put(t.ngay, 'thu', t.so_tien));
  cost.forEach((r) => put(r.ngay, isTienVao(r) ? 'vay' : isNgoaiCp(r) ? 'goc' : 'cp', r.sau_vat));
  tp.forEach((c) => c.pays.forEach((x) => put(x.ngay, 'tp', x.so_tien)));

  // ---- Tiền thực tế theo giai đoạn thanh toán (sau VAT) – dùng cho ma trận TĐ:
  //  GĐ1 tạm ứng · GĐ2 các đợt thanh toán · GĐ3 quyết toán. Thu và trả thầu phụ theo loại thanh toán;
  //  chi phí khác theo ngày: trước ngày CĐT thanh toán đợt đầu -> GĐ1, trước ngày CĐT thanh toán quyết toán -> GĐ2, sau đó -> GĐ3 (chưa có ngày -> GĐ2)
  const gd = { thu: [0, 0, 0], tp: [0, 0, 0], cp: [0, 0, 0] };
  const GD = { tam_ung: 0, dot: 1, quyet_toan: 2 };
  tienVe.forEach((t) => { gd.thu[GD[t.loai] ?? 1] += t.so_tien; });
  tp.forEach((c) => c.pays.forEach((x) => { gd.tp[GD[x.loai] ?? 1] += x.so_tien; }));
  const firstDay = (loai) => tienVe.filter((t) => t.loai === loai && t.ngay).map((t) => String(t.ngay).slice(0, 10)).sort()[0] || null;
  const b2 = firstDay('quyet_toan'), b1 = firstDay('dot') || b2;
  cost.filter((r) => !isTienVao(r) && !isNgoaiCp(r)).forEach((r) => {
    const n = r.ngay ? String(r.ngay).slice(0, 10) : null;
    gd.cp[!n ? 1 : b1 && n < b1 ? 0 : !b1 ? 0 : b2 && n >= b2 ? 2 : 1] += r.sau_vat;
  });
  gd.moc = { dot: b1, quyet_toan: b2 };

  // ---- Cảnh báo nghiệp vụ (kèm liên kết tới đúng vị trí: tab + dòng) ----
  const warn = [];
  const W = (muc, noi_dung, link) => warn.push({ muc, noi_dung, link });
  const lnDk = s.du_kien.doanh_thu.gt - s.du_kien.chi_phi.gt;
  if (lnDk < 0) W('cao', `Dự án lỗ dự kiến ${fmt(lnDk)} đ (trước VAT)`, { go: 'card' });
  for (const h of hds) {
    if (h.vat0) W('tb', `${h.so_hieu}: VAT 0% (chưa có VAT)`, { tab: 'revenue', rid: h.id });
    if (h.tien_ve > h.dk.sv) W('cao', `${h.so_hieu}: tiền về ${fmt(h.tien_ve)} vượt giá trị HĐ ${fmt(h.dk.sv)}`, { tab: 'revenue', tv: h.id });
    if (h.nt.sv > h.hd.sv * 1.1 && !h.da_qt) W('tb', `${h.so_hieu}: nghiệm thu vượt 110% giá trị HĐ + PL`, { tab: 'revenue', qt: h.id });
    if (h.lai_gop_dk < 0) W('cao', `${h.so_hieu}: thầu phụ (${fmt(h.tp.qt_gt)}) vượt doanh thu dự kiến (${fmt(h.dk.gt)})`, { tab: 'cost', tpgrp: h.id });
  }
  for (const c of tp) if (c.da_tt > c.qt_sau_vat) W('cao', `HĐTP ${c.so_ma}: thanh toán ${fmt(c.da_tt)} vượt HT/QT ${fmt(c.qt_sau_vat)}`, { tab: 'cost', tp: c.id });
  if (tpChuaGan.n) W('tb', `${tpChuaGan.n} HĐ thầu phụ chưa gắn HĐ chủ đầu tư`, { tab: 'cost', tpgrp: 0 });
  const legacy = cost.filter((r) => findNhom(r.nhom)?.sub.length && !findNhom(r.nhom).sub.some((x) => x.code === r.nhom_con));
  for (const code of [...new Set(legacy.map((r) => r.nhom))]) {
    const n = legacy.filter((r) => r.nhom === code).length;
    W('tb', `${findNhom(code).ten}: ${n} dòng chi phí chưa chọn hạng mục`, { tab: 'cost', nhom: code });
  }
  // Dòng thiếu ngày: chỉ rõ từng vị trí
  const hdName = (id) => masters.find((m) => m.id === id)?.so_hieu || 'HĐ (không xác định)';
  for (const r of hdRows.filter((x) => !x.ngay)) W('thap', `${r.so_hieu}: thiếu ngày ký`, { tab: 'revenue', rid: r.id });
  const qtNoDate = new Map();
  for (const q of qtRows.filter((x) => !x.ngay)) (qtNoDate.get(q.hd_id) || qtNoDate.set(q.hd_id, []).get(q.hd_id)).push(q);
  for (const [hid, rows] of qtNoDate) W('thap', `${hdName(hid)}: ${rows.map((q) => q.so_hieu).join(', ')} (HT/QT) thiếu ngày`, { tab: 'revenue', qt: hid, rid: rows[0].id });
  const tvNoDate = new Map();
  for (const t of tienVe.filter((x) => !x.ngay)) tvNoDate.set(t.hd_id, (tvNoDate.get(t.hd_id) || 0) + 1);
  for (const [hid, n] of tvNoDate) W('thap', `${hdName(hid)}: ${n} dòng tiền về thiếu ngày`, { tab: 'revenue', tv: hid });
  for (const r of cost.filter((x) => !x.ngay)) W('thap', `Chi phí "${r.noi_dung}" (${findNhom(r.nhom)?.ten || r.nhom}) thiếu ngày`, { tab: 'cost', cid: r.id, nhom: r.nhom, sub: r.nhom_con || '' });
  for (const c of tp) {
    const nl = c.lines.filter((l) => !l.ngay).length, np = c.pays.filter((x) => !x.ngay).length;
    if (nl || np) W('thap', `HĐTP ${c.so_ma}: ${[nl ? `${nl} dòng HĐ/PL` : '', np ? `${np} lần thanh toán` : ''].filter(Boolean).join(', ')} thiếu ngày`, { tab: 'cost', tp: c.id });
  }

  // ---- Dòng chi tiết để xuất Excel ----
  const tpName = (id) => masters.find((m) => m.id === id)?.so_hieu || 'Chưa gắn HĐ CĐT';
  const chi_tiet = {
    doanh_thu: rev.map((r) => ({ loai: r.loai === 'hd' ? 'HĐ/PL' : 'HT/QT', so_hieu: r.so_hieu, thuoc_hd: r.loai === 'qt' ? (masters.find((m) => m.id === r.hd_id)?.so_hieu || '') : r.so_hieu,
      ngay: r.ngay, gia_tri: r.gia_tri, vat: r.vat, tien_vat: r.tien_vat, sau_vat: r.sau_vat, ghi_chu: r.ghi_chu || '' })),
    tien_ve: tienVe.map((t) => ({ hd: masters.find((m) => m.id === t.hd_id)?.so_hieu || '', loai: t.loai === 'dot' ? `TT Đợt ${t.dot}` : t.loai === 'tam_ung' ? 'Tạm ứng' : 'Quyết toán',
      ngay: t.ngay, so_tien: t.so_tien, ghi_chu: t.ghi_chu || '' })),
    thau_phu: tp.map((c) => ({ loai: TP_NHOM[c.nhom] || 'Thầu phụ', hd_cdt: tpName(c.hd_cdt_id || 0), so_ma: c.so_ma, doi_tac: c.doi_tac, so_pl: c.so_pl, hd_sv: c.hd_sau_vat, qt_gt: c.qt_gia_tri, qt_sv: c.qt_sau_vat,
      da_tt: c.da_tt, con_lai: c.con_lai, trang_thai: c.khoa_so ? 'Đã quyết toán (khóa)' : c.da_qt ? 'Đã QT' : c.khoa ? 'Chưa QT (đã trả đủ)' : 'Chưa QT', ghi_chu: [c.hang_muc, c.ghi_chu].filter(Boolean).join(' · '), hang_muc: c.hang_muc || '',
      // cho Trợ lý: loại (mã), tổng tạm ứng, số lần thanh toán đợt / quyết toán, lần trả gần nhất
      nhom: c.nhom || 'thau_phu', da_qt: Boolean(c.da_qt), tam_ung: sum(c.pays.filter((x) => x.loai === 'tam_ung'), 'so_tien'),
      n_tt: c.pays.filter((x) => x.loai !== 'tam_ung').length, ngay_tt: c.pays.map((x) => x.ngay).filter(Boolean).sort().pop() || null })),
    chi_phi: cost.map((r) => {
      const n = findNhom(r.nhom);
      return { khoi: KHOI_CHI_PHI.find((k) => k.code === n?.khoi)?.ten || '', nhom: n?.ten || r.nhom, hang_muc: n?.sub.find((x) => x.code === r.nhom_con)?.ten || '',
        noi_dung: r.noi_dung, doi_tac: r.doi_tac, so_ct: r.so_ct, ngay: r.ngay, gia_tri: r.gia_tri, vat: r.vat, tien_vat: r.tien_vat, sau_vat: r.sau_vat,
        tinh_cp: isTienVao(r) ? 'Không (tiền vay nhận về)' : isNgoaiCp(r) ? 'Không (trả nợ gốc)' : 'Có', ghi_chu: r.ghi_chu || '', nhom_ma: r.nhom, hm_ma: r.nhom_con || '' };
    }),
  };

  return {
    id: p.id, ma_du_an: p.ma_du_an, ten_du_an: p.ten_du_an, chu_dau_tu: p.chu_dau_tu, trang_thai: p.trang_thai, tien_do: Number(p.tien_do) || 0,
    bh_khac: Number(p.bh_khac) || 0, ghi_chu_bh: p.ghi_chu_bh || '', ns_cp: Number(p.ns_cp) || 0,
    ngay_bat_dau: p.ngay_bat_dau, ngay_ket_thuc: p.ngay_ket_thuc,
    // Mốc tự động: bắt đầu = ngày ký HĐ CĐT sớm nhất;
    // kết thúc = ngày HT/QT cuối cùng khi mọi HĐ đã quyết toán, hoặc khi công trình ở trạng thái Hoàn thành (dù còn HĐ chưa ghi quyết toán)
    ngay_ky_hd: masters.map((m) => m.ngay).filter(Boolean).sort()[0] || null,
    ...(() => {
      const allQt = hds.length > 0 && hds.every((h) => h.da_qt);
      const last = qtRows.map((q) => q.ngay).filter(Boolean).sort().pop() || null;
      return allQt || p.trang_thai === 'Hoàn thành' ? { ngay_qt: last, ngay_qt_loai: allQt ? 'ngày quyết toán' : 'nghiệm thu cuối' } : { ngay_qt: null, ngay_qt_loai: '' };
    })(),
    loai_cong_trinh: p.loai_cong_trinh || '', dia_diem: p.dia_diem || '', khu_vuc: p.khu_vuc || '',
    vi_do: p.vi_do == null ? null : Number(p.vi_do), kinh_do: p.kinh_do == null ? null : Number(p.kinh_do), co_anh: Boolean(p.co_anh), anh_v: Number(p.anh_v) || 0,
    so_hd: s.so_hd, so_hd_qt: s.so_hd_qt, so_tp: s.so_tp, so_tp_qt: s.so_tp_qt,
    du_kien: { doanh_thu: s.du_kien.doanh_thu, chi_phi: s.du_kien.chi_phi, con_lai: s.du_kien.con_lai, thang: s.du_kien.thang },
    thuc_hien: { doanh_thu: s.thuc_hien.doanh_thu, chi_phi: s.thuc_hien.chi_phi, con_lai: s.thuc_hien.con_lai, thang: s.thuc_hien.thang, ngay: s.thuc_hien.ngay, chua_ngay: s.thuc_hien.chua_ngay },
    tien_ve: s.tien_ve, tra_goc: s.tra_goc, vay_nhan: s.vay_nhan,
    tp: { ...tpSum(tp), chua_gan: tpChuaGan },
    // HĐ đầu vào tách theo loại: thầu phụ / vật tư / máy móc thiết bị / nhân công giao khoán
    tp_nhom: Object.fromEntries(Object.keys(TP_NHOM).map((k) => [k, tpSum(tp.filter((c) => (c.nhom || 'thau_phu') === k))])),
    khoi, nhom, hds, cp_chung: (() => { // V28.12: phần chi phí KHÔNG gắn HĐ CĐT, tách theo nguồn (gt / sv × TĐ1–3) – hiện khi rê chuột dòng "Chi phí chung"
      const hdSet = new Set(masters.map((m) => m.id)), goiCo = new Set(duTru.filter((g) => g.loai === 'ky' && hdSet.has(g.hd_cdt_id)).map((g) => g.id));
      const kyId = new Set(duTru.filter((g) => g.loai === 'ky').map((g) => g.id)), out = [];
      const add = (ten, fn) => { const o = { ten, gt: [1, 2, 3].map((k) => fn('gt', k)), sv: [1, 2, 3].map((k) => fn('sv', k)) }; if ([...o.gt, ...o.sv].some((x) => Math.abs(x) >= 1)) out.push(o); };
      const nhomLe = [...new Set(cost.filter((r) => !isNgoaiCp(r) && !(r.goi_id && kyId.has(r.goi_id))).map((r) => r.nhom))];
      for (const code of nhomLe) { const rs = cost.filter((r) => r.nhom === code && !isNgoaiCp(r) && !(r.goi_id && kyId.has(r.goi_id)));
        add(code === 'tc_tra_no' ? 'Lãi vay' : findNhom(code)?.ten || code, (f) => sum(rs, f === 'sv' ? 'sau_vat' : 'gia_tri')); } // vay – trả nợ: chỉ lãi tính chi phí
      const goiKo = duTru.filter((g) => g.loai === 'ky' && !goiCo.has(g.id));
      if (goiKo.length) add(`Gói chưa gắn HĐ CĐT (${goiKo.length})`, (f, k) => goiKo.reduce((a, r) => a + goiV(r, f, k), 0));
      const tpKo = tp.filter((c) => !hdSet.has(c.hd_cdt_id));
      if (tpKo.length) add(`HĐ đầu vào chưa gắn HĐ CĐT (${tpKo.length})`, (f, k) => tpTd(tpKo, k, f));
      return out;
    })(),
    tien_chung: (() => { // V29.12: dòng tiền thật (sau VAT) KHÔNG gắn HĐ CĐT – để tách dòng "Chi phí chung" ở mục II
      const hdSet = new Set(masters.map((m) => m.id)), chi = [];
      for (const code of [...new Set(cost.filter((r) => !isNgoaiCp(r)).map((r) => r.nhom))]) {
        const x = sum(cost.filter((r) => r.nhom === code && !isNgoaiCp(r)), 'sau_vat'); if (Math.abs(x) >= 1) chi.push([code === 'tc_tra_no' ? 'Lãi vay' : findNhom(code)?.ten || code, x]); }
      const tpKo = tp.filter((c) => !hdSet.has(c.hd_cdt_id)), daTra = sum(tpKo, 'da_tt');
      if (daTra) chi.push([`Đã trả HĐ đầu vào chưa gắn HĐ CĐT (${tpKo.length})`, daTra]);
      return { thu: sum(tienVe.filter((t) => !hdSet.has(t.hd_id)), 'so_tien'), chi };
    })(), dong_tien, flow, canh_bao: warn, chi_tiet,
    tien_thuc: { thang: tt, chua_ngay: ttNo, ngay: ttNgay, gd },
    // Mốc giá trị (trước VAT) để đối chiếu 3 thời điểm: Ban đầu (HĐ gốc) · Có phát sinh (HĐ + PL) · Quyết toán
    moc: {
      dt_goc: sum(hdRows, (r) => tdLine(r).t1), dt_ps: sum(hdRows, (r) => tdLine(r).t2), dt_qt: sum(hds, (h) => h.td3.gt),
      // Tách HĐ / PL tại từng TĐ (trước + sau VAT): TĐ3 của nhóm HĐ dùng cách cũ (tổng hồ sơ HT/QT) thì phần chênh tính vào HĐ
      chia: (() => {
        const o = { hd: [0, 0, 0], pl: [0, 0, 0], hd_sv: [0, 0, 0], pl_sv: [0, 0, 0] };
        for (const r of hdRows) {
          const x = tdLine(r), k = r.ma_loai === 'HĐ' ? 'hd' : 'pl';
          [x.t1, x.t2, x.t3 ?? x.t2].forEach((v, i) => { o[k][i] += v; o[k + '_sv'][i] += i === 0 || (i === 2 && x.t3 !== null) ? svOf(v, r.vat) : sv2Of(r); });
        }
        const dl = sum(hds, (h) => h.td3.gt) - (o.hd[2] + o.pl[2]), dlsv = sum(hds, (h) => h.td3.sv) - (o.hd_sv[2] + o.pl_sv[2]);
        o.hd[2] += dl; o.hd_sv[2] += dlsv;
        return o;
      })(),
      qt_thieu: sum(hds, (h) => h.qt_thieu || 0),
      tp_goc: tpTd(tp, 1, 'gt'), tp_ps: tpTd(tp, 2, 'gt'), tp_qt: tpTd(tp, 3, 'gt'),
      cp_khac: sum(cost.filter((r) => !isNgoaiCp(r)), 'gia_tri'),
      // Chi phí khác theo ngày chứng từ (trước VAT): số HT của TĐ chỉ cộng các dòng có ngày ≤ ngày chốt
      cp_khac_ngay: cost.filter((r) => !isNgoaiCp(r) && r.ngay).reduce((o, r) => { const k = String(r.ngay).slice(0, 10); o[k] = (o[k] || 0) + r.gia_tri; return o; }, {}),
      da_qt: hds.length > 0 && hds.every((h) => h.da_qt),
      // Bảng thời điểm (mục I-A báo cáo), trước + sau VAT: TĐ1 HĐ gốc · TĐ2 = TĐ1 + từng phụ lục (PL01, PL02… cộng các HĐ) · TĐ3 quyết toán
      dt: {
        // Theo 3 ô giá trị TĐ của từng dòng HĐ / PL (dòng cũ: HĐ gốc = TĐ1, PL = từ TĐ2) · TĐ3 theo từng HĐ: nhập tay -> quyết toán -> TĐ2
        goc: { gt: sum(hdRows, (r) => tdLine(r).t1), sv: sum(hdRows, (r) => svOf(tdLine(r).t1, r.vat)) },
        // Phần tăng / giảm TĐ1 -> TĐ2 (các đợt điều chỉnh) theo từng văn bản: HĐ, PL01, PL02…
        pl: Object.values(hdRows.reduce((o, r) => {
          const x = tdLine(r), gt = x.t2 - x.t1; if (!gt) return o;
          const k = r.ma_loai === 'HĐ' ? 'HĐ' : r.ma_loai; (o[k] ||= { ma: k, gt: 0, sv: 0 }); o[k].gt += gt; o[k].sv += sv2Of(r) - svOf(x.t1, r.vat); return o;
        }, {})).sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true })),
        ps: { gt: sum(hdRows, (r) => tdLine(r).t2), sv: sum(hdRows, (r) => sv2Of(r)) },
        qt: { gt: sum(hds, (h) => h.td3.gt), sv: sum(hds, (h) => h.td3.sv) },
        da_nhan: sum(tienVe, 'so_tien'),
      },
      cp: { // chi phí: thầu phụ cùng mốc + toàn bộ chi phí khác đã ghi nhận (không gồm vay / trả gốc)
        // Theo ô "Thuộc TĐ" của từng dòng HĐ / PL: TĐ1 = dòng thuộc TĐ1 · TĐ2 = dòng thuộc TĐ1 + TĐ2 (dòng thuộc TĐ3 chỉ tính ở quyết toán)
        tp_goc: { gt: tpTd(tp, 1, 'gt'), sv: tpTd(tp, 1, 'sv') },
        tp_ps: { gt: tpTd(tp, 2, 'gt'), sv: tpTd(tp, 2, 'sv') },
        // Phần tăng / giảm TĐ1 -> TĐ2 (các đợt điều chỉnh) của HĐ đầu vào theo văn bản: HĐ, PL01, PL02…
        tp_pl: Object.values(tp.flatMap((c) => c.lines).reduce((o, l) => {
          const x = tpLine(l), gt = x.t2 - x.t1; if (!gt) return o;
          const k = l.ma_loai === 'HĐ' ? 'HĐ' : l.ma_loai; (o[k] ||= { ma: k, gt: 0, sv: 0 }); o[k].gt += gt; o[k].sv += svOf(x.t2, l.vat) - svOf(x.t1, l.vat); return o;
        }, {})).sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true })),
        tp_qt: { gt: tpTd(tp, 3, 'gt'), sv: tpTd(tp, 3, 'sv') },
        tp_chia: (() => { const o = { hd: [0, 0, 0], pl: [0, 0, 0], hd_sv: [0, 0, 0], pl_sv: [0, 0, 0] }; for (const l of tp.flatMap((c) => c.lines)) { const x = tpLine(l), k = l.ma_loai === 'HĐ' ? 'hd' : 'pl'; [x.t1, x.t2, x.t3].forEach((v, i) => { o[k][i] += v; o[k + '_sv'][i] += svOf(v, l.vat); }); } return o; })(),
        // HĐ đầu vào đã quyết toán nhưng còn văn bản chưa có giá trị HT/QT (tạm = TĐ2)
        tp_qt_thieu: tp.filter((c) => c.da_qt).reduce((a, c) => a + c.lines.filter((l) => nn(l.gia_tri_qt) === null).length, 0),
        khac: { gt: sum(cost.filter((r) => !isNgoaiCp(r)), 'gia_tri'), sv: sum(cost.filter((r) => !isNgoaiCp(r)), 'sau_vat') },
        // Đợt B – dự trù chi phí theo nhóm, cộng dồn với chi tiết (HĐ đầu vào + chi phí đã ghi) tại TĐ1 / TĐ2 / TĐ3
        ...duTruMoc(duTru, tp, cost),
        // Chi phí khác thuộc khối B1 (trực tiếp: vật tư, nhân công, máy, tổ chức thi công, khác) – cùng thầu phụ là giá vốn để tính LN gộp
        khac_b1: { gt: sum(cost.filter((r) => findNhom(r.nhom)?.khoi === 'B1'), 'gia_tri'), sv: sum(cost.filter((r) => findNhom(r.nhom)?.khoi === 'B1'), 'sau_vat') },
      },
    },
  };
}

// Dự trù 1 nhóm tại TĐ1 / TĐ2 / TĐ3: TĐ1 = Σ dự trù ban đầu · TĐ2 = TĐ1 + Σ đợt điều chỉnh (nhóm chưa có TĐ1 = ngoài dự trù, phát sinh ở TĐ2)
//  · TĐ3 = Σ quyết toán (chưa có = TĐ2). Trả về trước VAT (gt) và sau VAT (sv)
//  Gói chi phí: dòng TĐ1 đã gắn HĐ đầu vào (thay = HĐ) hoặc đã đóng -> chỉ tính ở TĐ1, không vào TĐ2 / TĐ3
//  V27.12 – mua lẻ gắn gói (le(id, f) = tổng dòng mua lẻ gắn gói, đã nằm trong "chi phí đã ghi"): TĐ1 trừ ra để TĐ1 = đúng giá trị gói;
//  TĐ2 / TĐ3: gói còn mở chỉ tính phần CHƯA chi hết (gói − mua lẻ, không âm); gói đóng / đã gắn HĐ -> chỉ còn mua lẻ thực
function duTruNhom(rows, ganHd = new Set(), le = () => 0) {
  const v = (r, f) => (f === 'sv' ? svOf(Number(r.so_tien) || 0, r.vat) : Number(r.so_tien) || 0);
  const S = (f, k, loc = () => true) => rows.filter((r) => r.loai === k && loc(r)).reduce((a, r) => a + v(r, f), 0);
  const conTinh = (r) => !ganHd.has(r.id) && r.tinh_trang !== 'dong';
  const ky = rows.filter((r) => r.loai === 'ky');
  const coQt = rows.some((r) => r.loai === 'qt');
  const o = {};
  for (const f of ['gt', 'sv']) {
    const t1 = S(f, 'ky') - ky.reduce((a, r) => a + le(r.id, f), 0);
    const t2 = ky.reduce((a, r) => a + (conTinh(r) ? Math.max(0, v(r, f) - le(r.id, f)) : 0), 0) + S(f, 'dc');
    o[f] = [t1, t2, coQt ? S(f, 'qt') : t2];
  }
  return o;
}
// Tổng mua lẻ (chi phí đã ghi, tính vào chi phí) gắn từng gói: le(goiId, 'gt' | 'sv')
function goiLeOf(cost) {
  const m = new Map();
  for (const r of cost) if (r.goi_id && !isNgoaiCp(r)) { const x = m.get(r.goi_id) || { gt: 0, sv: 0 }; x.gt += Number(r.gia_tri) || 0; x.sv += Number(r.sau_vat) || 0; m.set(r.goi_id, x); }
  return (id, f) => m.get(id)?.[f] || 0;
}
// Mốc dự trù của dự án: dtru = {gt:[3], sv:[3]} · dtru_b1 = phần thuộc khối B1 (giá vốn) · dtru_trung = nhóm có từ 2 nguồn trở lên (cộng dồn, cần lưu ý)
function duTruMoc(duTru, tp, cost) {
  const z = () => ({ gt: [0, 0, 0], sv: [0, 0, 0] });
  const dtru = z(), dtru_b1 = z(), dtru_nhom = [];
  const codes = [...new Set(duTru.map((r) => r.nhom))];
  const ganHd = new Set(tp.map((c) => c.goi_id).filter(Boolean)), le = goiLeOf(cost);
  for (const code of codes) {
    const x = duTruNhom(duTru.filter((r) => r.nhom === code), ganHd, le), n = findNhom(code);
    for (const f of ['gt', 'sv']) for (let i = 0; i < 3; i++) { dtru[f][i] += x[f][i]; if (n?.khoi === 'B1') dtru_b1[f][i] += x[f][i]; }
    dtru_nhom.push({ nhom: code, ten: n?.ten || code, ...x, ngoai: x.gt[0] === 0 && x.gt[1] !== 0 });
  }
  // Nguồn chi phí theo nhóm: HĐ đầu vào · chi phí mua lẻ (dòng chi phí) · dự trù – có từ 2 nguồn -> cộng dồn + lưu ý
  const trung = [];
  for (const n of NHOM_CHI_PHI) {
    const src = [];
    if (tp.some((c) => (c.nhom || 'thau_phu') === n.code && !c.goi_id && !c.phat_sinh)) src.push('HĐ đầu vào'); // HĐ gắn gói / phát sinh: không trùng với gói
    if (cost.some((r) => r.nhom === n.code && !r.goi_id && !isNgoaiCp(r) && Number(r.gia_tri))) src.push('mua lẻ'); // mua lẻ gắn gói: không trùng
    if (codes.includes(n.code)) src.push('dự trù');
    if (src.length > 1) trung.push({ nhom: n.code, ten: n.ten, nguon: src });
  }
  return { dtru, dtru_b1, dtru_nhom, dtru_trung: trung };
}
// Giá trị 1 văn bản HĐ / PL đầu vào tại TĐ1 / TĐ2 / TĐ3: TĐ1 ký · TĐ2 = TĐ1 + đợt điều chỉnh · TĐ3 = giá trị HT/QT của văn bản (trống = TĐ2)
//  Gói chi phí: HĐ gắn vào gói (goi_id) hoặc phát sinh ngoài TĐ1 (phat_sinh) -> TĐ1 = 0 (TĐ1 lấy giá trị gói / không có ở TĐ1)
function tpLine(l) {
  const t1 = l._ko1 ? 0 : Number(l.gia_tri_ky ?? l.gia_tri) || 0, t2 = Number(l.gia_tri) || 0, qt = nn(l.gia_tri_qt);
  return { t1, t2, t3: qt !== null ? qt : t2 };
}
// Cộng HĐ đầu vào tại TĐ k ('gt' trước VAT / 'sv' sau VAT)
function tpTd(tp, k, f) {
  return tp.reduce((a, c) => a + c.lines.reduce((b, l) => { const v = tpLine(l)['t' + k]; return b + (f === 'sv' ? svOf(v, l.vat) : v); }, 0), 0);
}
function fmt(n) { return new Intl.NumberFormat('vi-VN').format(n); }

// Tình trạng dự án tự chạy theo số liệu (lũy kế đến nay, trước VAT) – dùng chung cho Báo cáo, Dashboard, Nhập liệu › Dự án
//  Tạm dừng (nhập tay) giữ · mọi HĐ CĐT đã quyết toán hoặc % hoàn thành (GTHT ÷ DT TĐ3) ≥ 100% -> Hoàn thành
//  chưa có HĐ CĐT và chưa chi -> Chuẩn bị · còn lại -> Đang thi công
//  GTHT theo từng HĐ: có đợt TT/QT -> lũy kế · chưa có đợt, đã QT -> TĐ3 · còn lại tạm tính cost to cost (thực chi ÷ CP TĐ3, trước VAT) × TĐ3 của HĐ
function tinhTrangTuDong(r, nhap) {
  if (nhap === 'Tạm dừng') return { tt: 'Tạm dừng', ht: null };
  const now = new Date().toISOString().slice(0, 7);
  const T = r.tien_thuc || { thang: {}, chua_ngay: {} };
  let chiSv = (T.chua_ngay.cp || 0) + (T.chua_ngay.tp || 0);
  for (const [m, t] of Object.entries(T.thang)) if (m <= now) chiSv += (t.cp || 0) + (t.tp || 0);
  const cp = r.moc.cp, cGt = cp.tp_qt.gt + cp.khac.gt, cSv = cp.tp_qt.sv + cp.khac.sv;
  const chiGt = cSv ? chiSv * (cGt / cSv) : chiSv;
  const tl = cGt > 0 ? chiGt / cGt : null, dt3 = r.moc.dt.qt.gt, hds = r.hds || [];
  let gtht = 0;
  for (const h of hds) gtht += h.so_dot > 0 ? h.nt.gt : h.da_qt ? h.td3.gt : tl != null ? tl * h.td3.gt : 0;
  const ht = dt3 > 0 ? gtht / dt3 : null;
  let tt = 'Đang thi công';
  if ((hds.length && hds.every((h) => h.da_qt)) || (ht != null && ht >= 0.9995)) tt = 'Hoàn thành';
  else if (!hds.length && chiSv <= 0) tt = 'Chuẩn bị';
  return { tt, ht };
}
function projectReport(p, data) {
  const r = projectReport0(p, data);
  const x = tinhTrangTuDong(r, p.trang_thai);
  r.trang_thai_nhap = p.trang_thai; r.trang_thai_tu_dong = x.tt; r.ht_tu_dong = x.ht;
  return r;
}
module.exports = { projectReport };
