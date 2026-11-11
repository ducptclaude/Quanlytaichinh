# Tóm tắt phiên làm việc

> Mục mới nhất ở trên cùng. Phần "PROJECT PROFIT" bên dưới là tóm tắt gốc đi kèm gói bàn giao (repo cũ `TuLee116/...`), giữ để tham khảo.

## V07.11.11.26 – Hộp nhập liệu hiện số bằng đồng (khớp ô nhập); gõ "+" đầu số; sửa đợt điều chỉnh dễ thấy
- Hộp điều chỉnh, quyết toán, dự trù, chi tiết HĐ đầu vào: mọi số (thẻ, lũy kế, sau VAT, mũi tên) hiện bằng ĐỒNG đầy đủ, ghi "Đơn vị: đồng" ở đầu hộp
  (trước đây theo ô Đơn vị -> lệch với ô nhập). Bảng ngoài trang vẫn theo ô Đơn vị.
- Ô tiền: "+3500000" = số dương, tự định dạng "+3.500.000" (trước đây bị hiểu là công thức, không định dạng).
- Đợt điều chỉnh / dòng dự trù đã nhập: nút Lưu luôn hiện (đậm lên khi có thay đổi) + dòng hướng dẫn sửa trực tiếp ngày, nội dung, số tiền.

## V06.11.11.26 – Chi phí: HĐ đầu vào mới chỉ tạo ở tab TĐ1
- TĐ2 / TĐ3: nhóm Thầu phụ ẩn ô nhập + nút, hiện hướng dẫn (tạo mới ở TĐ1; điều chỉnh / quyết toán HĐ đã có: nhấp đúp Số HĐ ở bảng 1).
  Vật tư / MMTB / Nhân công: ẩn ô Hình thức, chỉ thêm dòng chi phí mua lẻ. Bấm lưu kiểu HĐ ở TĐ2/3 bị chặn ("chỉ tạo ở tab TĐ1").

## V05.11.11.26 – Form Thêm HĐ/PL: chọn văn bản đã có -> ghi điều chỉnh TĐ2, tự chuyển tab TĐ2
- Ở tab TĐ1, chọn Loại "(đã có)" của Số mã (VD PL01 đã có): báo "đã có – số nhập ghi thành điều chỉnh TĐ2", nút đổi thành "Ghi điều chỉnh → TĐ2".
  Bấm -> tạo 1 đợt điều chỉnh (+ tăng / − giảm, Ghi chú = nội dung) cho văn bản đó, tự chuyển sang tab TĐ2. Văn bản đã khoá (có số QT) -> báo khoá.

## V04.11.11.26 – Nhập liệu theo tab TĐ1 / TĐ2 / TĐ3 (Doanh thu, HĐ đầu vào, Dự trù)
- Nút TĐ1 / TĐ2 / TĐ3 ở trang Doanh thu, Chi phí = chế độ nhập (dùng chung với Báo cáo), có thanh hướng dẫn, cột TĐ đang chọn được tô màu.
  - TĐ1: thêm / sửa / xóa HĐ, PL với giá trị ký (form "Thêm HĐ/PL" chỉ hiện ở TĐ1; thêm PL HĐ đầu vào chỉ ở TĐ1).
  - TĐ2: nút ± Điều chỉnh – mỗi lần 1 đợt, chọn "Tăng / giảm (±)" hoặc "Chốt giá trị mới" (tự tính phần chênh so với TĐ2 hiện tại).
  - TĐ3: nhập số quyết toán từng văn bản (Lưu QT) -> văn bản KHOÁ cả TĐ1, TĐ2; HĐ và mọi PL có số -> HĐ ĐÓNG (không thêm PL).
    Mở khoá: nút 🔓 ở tab TĐ3, cần Passcode -> bỏ số quyết toán của văn bản (ghi nhật ký), HĐ mở lại.
- Dự trù: TĐ1 + Dự trù · TĐ2 + Điều chỉnh · TĐ3 + Quyết toán (nhập xong khoá nhóm; mở khoá = xóa số quyết toán, cần Passcode).
- Máy chủ: PUT/DELETE `/api/doanh-thu/:id/qt`, `/api/tp-hd-pl/:id/qt` (qua duyệt, nhật ký); chặn sửa văn bản / dòng / nhóm đã có số quyết toán (báo trước bước duyệt).
  Sửa dòng HĐ đầu vào ở TĐ1 giữ nguyên số quyết toán (`giu_qt`).
- Hộp Passcode: chữ trên nút theo việc (Mở khoá / Xác nhận xóa).

## V03.11.11.26 – SỬA LỖI LỚN ô nhập tiền (gõ quá 4 chữ số bị cắt số) + đơn vị hiển thị trong hộp chi tiết
- Lỗi (từ V21.10.11.26): gõ từng phím, ô đang "5.000" gõ thêm 0 thành "5.0000" -> bị đọc là số thập phân 5,0 -> còn 5. Mọi ô tiền gõ tay > 4 chữ số bị cắt
  (dán số / gõ công thức không bị). Sửa `parseMoney`: chỉ có chữ số + dấu chấm thì dấu chấm luôn là dấu nghìn.
- Gõ theo đơn vị: 1,5 tỷ · 180tr · 180 triệu · 500k · 2 tỷ + 300tr (đổi ra đồng khi rời ô). Ô có chữ / dấu phẩy giữ nguyên lúc đang gõ.
- Số > 1 triệu tỷ: viền đỏ + ghi chú ngay khi gõ (máy chủ vẫn chặn như cũ).
- Hộp chi tiết HĐ đầu vào: số (không phải ô nhập) theo đơn vị đang chọn; đổi đơn vị -> vẽ lại cả hộp đang mở (HĐ đầu vào, đợt điều chỉnh, quyết toán, dự trù).
- Khung Dự trù: tổng TĐ2 hiện mã thay vì số -> sửa. Bảng chờ duyệt trong Doanh thu / Chi phí theo đơn vị.
- Kiểm tra: gõ từng phím vào mọi ô tiền (36/36), quét 5 trang × 5 đơn vị + 3 hộp chi tiết (0 lỗi hiển thị, 0 lỗi trang).

## V02.11.11.26 – Chốt quyết toán HĐ CĐT: đủ số mới chốt, chốt rồi khoá toàn bộ HĐ
- Chốt (đánh dấu ở hộp Quyết toán): HĐ hoặc bất kỳ PL nào chưa có số quyết toán -> KHÔNG chốt, thông báo rõ văn bản thiếu (ô thiếu viền đỏ).
  Chưa chốt vẫn lưu được số quyết toán từng phần (văn bản trống tạm lấy TĐ2).
- Đã chốt -> khoá toàn bộ HĐ: chặn sửa / xóa HĐ, PL, đợt điều chỉnh, thêm PL mới (báo "đã chốt quyết toán"); bảng mục 1 hiện 🔒.
  Tiền về và hồ sơ HT/QT mục 2 vẫn nhập được. Mở khoá: nút 🔓 Mở khoá trong hộp Quyết toán, cần Passcode; số QT đã nhập giữ nguyên.
- Kiểm tra chạy TRƯỚC bước duyệt (người nhập được báo ngay; bản ghi khi duyệt cũng bị chặn như nhau).

## V01.11.11.26 – Đợt B: dự trù chi phí theo nhóm; tiêu đề cột chỉ ghi TĐ1 / TĐ2 / TĐ3
- Kho dữ liệu (chỉ THÊM): bảng `du_tru` (dự án, nhóm, loai ky = TĐ1 dự trù · dc = TĐ2 đợt điều chỉnh ± · qt = TĐ3 quyết toán, ngày, nội dung, số tiền, VAT).
- Mỗi nhóm: TĐ1 = Σ dự trù · TĐ2 = TĐ1 + Σ đợt (chưa có TĐ1 = "Ngoài dự trù") · TĐ3 = Σ quyết toán (chưa có = TĐ2). Nhóm không VAT (lương, ngoại giao, tài chính) tự VAT 0.
- Chi phí dự án tại mỗi TĐ = HĐ đầu vào + chi phí đã ghi + dự trù (cộng dồn). Nhóm có từ 2 nguồn (HĐ đầu vào / mua lẻ / dự trù) -> lưu ý "⚠ cộng dồn".
  Dự trù khối B1 trừ vào LN gộp. Áp dụng ở Báo cáo mục I, IV và số TĐ1 tự tính (dự án chưa chốt TĐ1).
- API: POST `/api/du-an/:id/du-tru`, PUT/DELETE `/api/du-tru/:id` (qua duyệt, có nhật ký); GET chi phí trả thêm `du_tru`.
- Trang Chi phí: khung "2. Dự trù chi phí theo nhóm" (TĐ1/TĐ2/TĐ3, chi tiết đã có, lưu ý) + hộp nhập theo nhóm (+ Dự trù / + Đợt / + Quyết toán).
- Tiêu đề cột bảng Doanh thu, HĐ đầu vào, Dự trù: chỉ ghi TĐ1 · TĐ2 · TĐ3; rê chuột hiện Ký / Điều chỉnh / Quyết toán.

## V25.10.11.26 — Điện thoại: giữ nguyên dạng bảng (bỏ đổi bảng thành thẻ)
- Người dùng: dạng thẻ khó đọc → `public/common.js` `mcardInit` TẮT (bật lại: `window.BANG_THE = true`). CSS thẻ cũ còn trong `style.css` nhưng không dùng (bảng không còn lớp `m-card`).
- ≤ 900px: bảng vuốt ngang trong khung bảng (trang không kéo ngang), chữ bảng 12px, ô gọn, bóng mờ mép phải báo còn cột.
- Kiểm tra: 18 thiết bị × 9 trang – 0 tràn ngang trang, 0 lỗi; iPhone 15: bảng Báo cáo mục I / II, Doanh thu, Chi phí, Tài khoản hiện đúng dạng bảng. Điểm khôi phục: `phien-10.11.26-20h07`.

## V24.10.11.26 — Giao diện khớp điện thoại & máy tính bảng (iPhone, Galaxy, Z Fold / Z Flip, iPad, Galaxy Tab)
- Rà 18 khung máy × 9 trang (Báo cáo, Dashboard, Dự án, Doanh thu, Chi phí, Duyệt, Tài khoản, Cài đặt, Cá nhân), dọc + ngang.
- Sửa: cụm nút đầu trang ≤ 600px xuống dòng gọn (ẩn nhãn vai trò, rút gọn tên, ô ngôn ngữ hẹp); ≤ 380px thu nhỏ thêm;
  khung Đánh giá hoàn thành – thu tiền không rộng quá màn hình (Z Fold mở, iPad ngang); nút TĐ1/2/3 ≤ 400px chia đều 3 ô.
- Kiểm tra: 18 thiết bị (iPhone SE / 13 Mini / 15 / 15 Pro Max, Galaxy S8 / S9+ / S24 / A55, Z Fold 7 gập + mở, Z Flip 7, iPad Mini / gen 11 / Pro 11, Galaxy Tab S9, iPhone 15 + iPad ngang)
  – 0 tràn ngang, 0 lỗi trang. Điểm khôi phục: `phien-10.11.26-19h38`.

## V23.10.11.26 – Đợt A: mỗi HĐ / PL có 3 thời điểm độc lập (Doanh thu + HĐ đầu vào)
- Quy tắc: TĐ1 = giá trị KÝ của từng văn bản (HĐ và PL đều tính, kể cả PL ký sau) · TĐ2 = TĐ1 + nhiều đợt điều chỉnh tăng / giảm · TĐ3 = giá trị quyết toán (chưa có = TĐ2).
- Kho dữ liệu (chỉ THÊM): bảng `dieu_chinh` (loai dt/tp, vb_id, ngày, nội dung, số tiền ±); `doanh_thu` thêm `gt_qt`, `qt_dong`, `ngay_qt`.
  Khi đọc: `gia_tri` = TĐ2 (đã cộng đợt), `gia_tri_ky` = TĐ1, `dot` = danh sách đợt.
- API: POST/PUT/DELETE `/api/dieu-chinh` (qua duyệt như các nhập liệu khác), PUT `/api/doanh-thu/:id/quyet-toan` (số QT từng văn bản + đóng QT cả HĐ). Có nhật ký.
- Doanh thu mục 1: cột TĐ1 Ký · TĐ2 Điều chỉnh (mũi tên ▲▼ so TĐ1, số đợt) · TĐ3 Quyết toán; các đợt hiện dưới từng văn bản; nút ± Đợt, Quyết toán. Bỏ ô "Thuộc thời điểm".
  Đóng QT: văn bản chưa có số QT tạm lấy TĐ2 + lưu ý ⚠. Dữ liệu cũ (QT nhận biết qua hồ sơ "Quyết toán" ở mục 2) giữ cách tính cũ.
- HĐ đầu vào: ô giá trị = giá trị ký (TĐ1), cột TĐ2 + nút ± Đợt; TĐ3 = ô HT/QT (trống = TĐ2). Bỏ ô "Thuộc TĐ" ở form tạo và hộp chi tiết.
- Báo cáo mục I: thẻ Doanh thu / Chi phí ghi tách HĐ · PL tại TĐ đang chọn; TĐ3 có lưu ý số văn bản chưa có số QT. Mục IV đổi chú thích TĐ.
- Ảnh hưởng dữ liệu mẫu: TĐ1 tăng (đã cộng PL ký), TĐ2 / TĐ3 không đổi.

## V22.10.11.26 – Nhập liệu Doanh thu / Chi phí: nút chọn TĐ1 / TĐ2 / TĐ3, liên kết Báo cáo
- Thanh TĐ1 Ký HĐ · TĐ2 Điều chỉnh · TĐ3 Quyết toán cạnh tiêu đề trang Doanh thu và Chi phí; dùng chung `BST.i_td` với Báo cáo (chọn ở đâu, nơi khác nhảy theo).
- Dòng HĐ / PL mới (form Doanh thu, form tạo HĐ đầu vào, phụ lục mới trong hộp HĐ thầu phụ): ô "Thuộc thời điểm" tự lấy TĐ đang chọn (thay cho gợi ý HĐ→TĐ1, PL→TĐ2); dòng đang sửa không bị đổi.

## V21.10.11.26 – Ô tiền nhận công thức / số dán từ Excel, Word; ô VAT hiện %
- `common.js`: `docSo` đọc số dán (1.234.567 · 1,234,567.89 · 1.234.567,89 · 1 234 567 đ · (1.234) = âm), `tinhCongThuc` tính + − × ÷ ( ) % không dùng eval
  (VD =1.250.000*12, 2.500.000+350.000, =1000000*10%). Đang gõ công thức: ô nền xanh nhạt; rời ô / Enter: thay bằng kết quả; sai: viền đỏ, không lưu số bừa.
  Áp dụng mọi ô tiền dùng `attachMoneyInput` (Doanh thu, Chi phí, tiền về, hộp HĐ thầu phụ, số dư đầu kỳ, chốt TĐ).
- Ô VAT (name="vat" / data-f="vat"): có giá trị thì hiện ký tự % bên phải (`attachVatInput`, tự gắn kể cả bảng vẽ lại); giá trị lưu vẫn là số.

## V20.10.11.26 – Doanh thu mục 2: tên đợt kế tiếp theo tên hồ sơ đã có
- "+ Đợt" (từng HĐ) và "+ Đợt tiếp theo" (thanh Thêm cho HĐ): tên = tên hồ sơ có số nhập sau cùng + 1 (VD "Hoàn thành đợt 2" -> "Hoàn thành đợt 3"); chưa có đợt -> "Hoàn thành đợt 1" (`tenDotKeTiep`).

## V19.10.11.26 – Mục I: tiêu đề cố định
- Bỏ chữ đổi theo TĐ (Dự kiến / Điều chỉnh / Quyết toán) ở tiêu đề mục I -> luôn "Doanh thu – Chi phí – Lợi nhuận"; dòng mô tả dưới vẫn ghi TĐ đang xem.

## V18.10.11.26 – Mục III: sắp xếp theo Tên dự án / Tình trạng
- Bấm tiêu đề "Tên dự án" hoặc "Tình trạng" (⇅): lần 1 tăng dần ▲, lần 2 giảm dần ▼, lần 3 bỏ (về thứ tự mã dự án). Tình trạng theo thứ tự Đang thi công → Chuẩn bị → Tạm dừng → Hoàn thành. Ghi nhớ lựa chọn (`BST.t3_sort`).

## V17.10.11.26 – Báo cáo xem 1 dự án: chỉ ẩn bảng mục III
- Sửa lại V12: mục I và II luôn hiện bảng; chỉ bảng mục III tự ẩn khi chọn 1 dự án (hiện lại khi chọn Tất cả).

## V16.10.11.26 – Thẻ công trình: nút Tiền thực tế ở đầu thẻ, bảng chi phí I – II – III
- Nút "💵 Tiền thực tế ▾/▴" ở góc phải đầu thẻ (thay nút "So với thực tế"): bảng tiền thực tế mặc định ẨN, bấm mở hiện giữa ma trận TĐ và bảng chi phí (bấm từ tab khác tự về Tổng quan).
- Tổng quan thêm bảng "Chi phí kế hoạch" theo khối I. Trực tiếp · II. Gián tiếp · III. Tài chính (kèm nhóm), giá trị + tỷ trọng + thanh tỷ lệ, theo nút VAT (`bPcCpKhoi`).

## V15.10.11.26 – Báo cáo theo công trình: xem 1 dự án thẻ trải full chiều ngang
- `.pc-grid.one` bỏ giới hạn 640px -> thẻ công trình rộng bằng khung; cơ cấu chi phí: biểu đồ 120px, chú giải chữ 12px, % đứng sát tên mục.

## V14.10.11.26 – HĐ đầu vào: nhóm loại mặc định thu gọn
- Nhóm Thầu phụ / Vật tư / Nhân công / MMTB luôn thu gọn khi mở trang (kể cả dự án chỉ có 1 HĐ CĐT); chỉ tự mở khi đang tìm kiếm; bấm ▸ để mở.

## V13.10.11.26 – Chi phí: HĐ đầu vào gom theo loại; đầu Báo cáo gọn
- Bảng "1. Hợp đồng đầu vào": trong mỗi HĐ CĐT thêm cấp nhóm theo loại (Thầu phụ · Vật tư · Nhân công · MMTB) có dòng cộng, bấm ▸ để mở các HĐ (số thứ tự n.m.k); "Mở / Thu gọn tất cả" gồm cả cấp loại.
- Đầu Báo cáo: ẩn nhãn Lập lúc / Người lập / phiên bản trên màn hình (vẫn in khi In / PDF), chỉ còn Phạm vi · Đơn vị – không xuống dòng.

## V12.10.11.26 – Báo cáo: xem 1 dự án thì ẩn bảng danh sách ở mục I–III
- Chọn 1 dự án ở Phạm vi: ẩn bảng dự án của mục I, II, III (3 thẻ số đã thể hiện) – class `th-mot`; chọn Tất cả dự án: hiện lại. Mục IV, Đánh giá hoàn thành giữ nguyên.

## V11.10.11.26 – Mục III: giữ tông cafe, bỏ nền đậm, phân biệt bằng màu chữ
- Đầu bảng + dòng tổng nền kem như các bảng khác (bỏ nền xám / navy của phương án 5); giữ lưới mảnh màu kem.
- Màu chữ: nhóm Thu navy (#1f3b73), nhóm Chi nâu đồng (#8a4f1c), Còn lại teal; số âm đỏ. Các bảng khác giữ tông cafe.

## V10.10.11.26 – Mục III: phương án 5 "bảng tài chính" (người dùng chọn trong 5 phương án)
- Lưới mảnh đầy đủ (#e6ebf2), đầu bảng xám xanh #eef2f7, tên nhóm THU navy (vạch #3462a3) / CHI nâu đồng (vạch #c27a3e), cột kết quả chữ đậm, dòng Tổng cộng nền navy chữ trắng (số âm hồng nhạt, dương teal nhạt). Giao diện tối giữ nguyên. In / PDF giữ màu.

## V09.10.11.26 – Mục III: phối màu bảng Thu / Chi đồng bộ các bảng khác
- Đầu bảng cùng nền kem; nhóm THU navy / CHI nâu đồng phân biệt bằng chữ + vạch mảnh dưới tên nhóm; thân bảng nền trắng (bỏ nền xanh / cam cả cột);
  chỉ cột Còn phải thu / Còn phải chi (`c-kq`) và Còn lại có nền rất nhạt; đường chia nhóm mảnh màu kem. Giao diện tối giữ nguyên.

## V08.10.11.26 – Đầu Báo cáo: thiết kế lại tông navy – teal
- Vạch dọc trái navy → teal; tên công ty dạng nhãn teal; tiêu đề navy đậm 25px, "TÀI CHÍNH DỰ ÁN" chuyển màu navy → teal; dòng thông tin tách thành nhãn (Phạm vi · Đơn vị · Lập lúc · Người lập · phiên bản).
- Khung Số dư – Thực thu – Thực chi nền trắng viền mảnh; dòng "Còn lại" nổi bật nền teal nhạt. Điện thoại: logo lên trên. Giao diện tối giữ tông xanh đêm (chỉ thêm nhãn).

## V07.10.11.26 – Kỳ báo cáo: đến HÔM NAY
- "Toàn bộ thời gian" = từ tháng đầu có số liệu đến hôm nay (trước: đến tháng cuối có số liệu, ghi ngày cuối tháng). Mọi kỳ kết thúc ở tháng hiện tại (Tháng này, 6 tháng, Lũy kế, Toàn bộ) ghi đến ngày hôm nay thay cho ngày cuối tháng.

## V06.10.11.26 – Mục I: dòng so sánh TĐ dễ hiểu
- Thẻ Doanh thu / Chi phí / Lợi nhuận: bằng TĐ trước -> chỉ ghi "= TĐx" (bỏ "so với TĐx" lặp); chênh lệch -> "▲/▼ số (±%) so với TĐx".

## V05.10.11.26 – Báo cáo: bỏ nguyên nhóm "Phân tích chi tiết" (I → V)
- Bỏ thanh "Phân tích chi tiết / Hiện chi tiết" và toàn bộ nội dung bên trong (tổng quan theo HĐ, biểu đồ, tổng hợp dự án, chi tiết từng dự án, bảng cảnh báo); bỏ nút "Xem chi tiết công trình" ở thẻ công trình.
- Các mục còn lại giữ nguyên: Bảng tổng hợp I–IV, Đánh giá hoàn thành, Báo cáo theo công trình. Xuất Excel / In không đổi.

## V04.10.11.26 – Đánh giá hoàn thành: bỏ ghi chú nguồn dưới GTHT
- Bỏ "theo TT/QT"; dự án có HĐ tạm tính chỉ ghi "tạm tính" (rê chuột xem cách tính).

## V03.10.11.26 – Tình trạng tự động tính ở máy chủ, dùng chung mọi trang; ô chọn tay chỉ còn Tạm dừng
- `lib/report.js` `tinhTrangTuDong` (lũy kế đến nay, trước VAT; cùng quy tắc GTHT theo từng HĐ) -> `trang_thai_tu_dong` trong số liệu báo cáo; API mới `GET /api/du-an-tinh-trang` (chỉ mã + tình trạng, không số tiền) cho trang Dự án.
- Báo cáo / Dashboard / Trợ lý / Nhập liệu › Dự án hiện cùng tình trạng tự động (kể cả vai nhập liệu không xem Báo cáo). Form dự án: ô Trạng thái chỉ còn "Tự động (theo số liệu)" / "Tạm dừng".
- Kiểm tra: 15 dự án – Báo cáo, trang Dự án (Quản trị) và trang Dự án (QS) trùng khớp; duyệt 28/28; tester 0 LỖI.

## V02.10.11.26 – Tình trạng dự án tự chạy theo số liệu (Báo cáo, Dashboard, Trợ lý)
- `bTinhTrangTuDong` (report.js, chạy sau khi tải số liệu báo cáo): Tạm dừng (nhập tay) giữ nguyên · mọi HĐ CĐT đã quyết toán hoặc % hoàn thành (GTHT ÷ DT TĐ3) ≥ 100% -> Hoàn thành ·
  chưa có HĐ CĐT và chưa chi -> Chuẩn bị · còn lại -> Đang thi công. Trạng thái nhập tay giữ ở `trang_thai_nhap` (rê chuột ô Tình trạng xem). Trang Nhập liệu › Dự án vẫn hiện trạng thái nhập tay.
- Kiểm tra: 15 dự án thử (DEMO-03/07/12 đã QT -> Hoàn thành; DEMO-05 nhập Chuẩn bị nhưng đã thi công 37,8% -> Đang thi công; dự án mới -> Chuẩn bị; Tạm dừng giữ); tester 0 LỖI.

## V01.10.11.26 – Mục I: cột Hoàn thành = % giá trị hoàn thành (như Đánh giá hoàn thành)
- Cột Hoàn thành mục I (mọi TĐ) = GTHT ÷ Doanh thu TĐ3: HĐ có đợt thanh toán / quyết toán -> lũy kế; HĐ chưa có đợt -> tạm tính cost to cost (thay cho Thực chi ÷ Chi phí dự kiến).
- Gộp công thức GTHT vào 1 hàm dùng chung `bGthtMap` (mục I + Đánh giá hoàn thành) – hai nơi luôn cùng số. Rê chuột ô % xem GTHT, DT TĐ3 và nguồn tính.
- Kiểm tra: 14/14 dự án khớp giữa mục I và Đánh giá hoàn thành ở cả TĐ1/2/3 (tổng 68,9%); tester 0 LỖI. Điểm khôi phục đầu phiên: `phien-10.11.26-13h43`.

## V11.09.11.26 – GTHT theo từng HĐ; "Tạm tính" = HĐ chưa quyết toán (không theo VAT)
- Đánh giá hoàn thành: GTHT tính theo TỪNG HĐ CĐT: có đợt thanh toán / quyết toán -> lũy kế các đợt; chưa có đợt mà đã QT -> giá trị TĐ3; chưa QT, chưa có đợt -> TẠM TÍNH
  cost to cost = (Thực chi ÷ CP TĐ3, tính trên số TRƯỚC VAT nên bấm Trước/Sau VAT không đổi tỷ lệ) × DT TĐ3 của HĐ. Nhãn nguồn: "theo TT/QT" / "tạm tính (cost to cost)" / "TT/QT + tạm tính".
- Nhãn "Tạm tính" toàn hệ thống = HĐ chưa quyết toán (doanh thu: `markTamTinh` – có hồ sơ "Quyết toán" ở mục 2 hoặc tiền về loại quyết toán là đã QT; HĐ đầu vào: `!da_qt`).
  Chi phí lẻ không còn "tạm tính". VAT 0% chỉ ghi "0%" / "Chưa có VAT"; cảnh báo báo cáo đổi thành "VAT 0% (chưa có VAT)". Dòng HĐ chưa QT ở Doanh thu mục 1 có nhãn "Tạm tính".
- Kiểm tra: kịch bản trộn MIX-01 (HĐ có đợt 50 + HĐ tạm tính 40% × 100 + HĐ đã QT 82 = 172 tr; sau VAT 185 tr, tỷ lệ 40% giữ nguyên); mốc TĐ dữ liệu cũ không đổi;
  duyệt 28/28; TĐ 15/15 + 12/12; tester 0 LỖI (bộ nhớ tạm + PostgreSQL).

## V10.09.11.26 – Doanh thu mục 2: thêm Đợt thanh toán / Quyết toán; GTHT theo lũy kế TT/QT, chưa có thì cost to cost
- Doanh thu mục 2 (Giá trị Hoàn thành / Quyết toán): thanh "Thêm cho HĐ [chọn HĐ] · + Đợt thanh toán · + Quyết toán" -> điền sẵn form (tên "Đợt thanh toán n" kế tiếp / "Quyết toán", Số HĐ).
- Báo cáo › Đánh giá hoàn thành: GTHT của dự án = tổng lũy kế các đợt thanh toán / quyết toán (mục 2) khi đã có; chưa có -> cost to cost (Thực chi ÷ CP TĐ3 × DT TĐ3).
  TL % HT = GTHT ÷ DT TĐ3. Ô GTHT ghi nguồn "theo TT/QT" / "cost to cost". Theo nút VAT trước / sau.
- Kiểm tra: dự án có đợt (DOT-01) theo TT/QT, thêm đợt 40 tr -> GTHT tăng đúng; dự án chưa có đợt (C2C-01) = 40% × 200 tr = 0,08 tỷ; tester 0 LỖI; không tràn, không lỗi trang.

## V09.09.11.26 – Đồng bộ dự án giữa Báo cáo và Nhập liệu
- Báo cáo chọn 1 dự án ở Phạm vi -> Nhập liệu › Doanh thu / Chi phí chuyển sang đúng dự án đó (`dongBoDuAn`); bấm vào báo cáo công trình cũng vậy.
- Nhập liệu chọn dự án (Doanh thu hoặc Chi phí) -> trang kia + Báo cáo (vai được xem) cũng theo dự án đó (`baoCaoTheoDuAn`, mục I nhảy TĐ mới nhất).
- Chọn "Tất cả dự án" (chỉ xem tổng hợp) không đổi dự án đang nhập.
- Kiểm tra: đồng bộ 2 chiều đúng, không lỗi trang; tester 0 LỖI.

## V08.09.11.26 – Nhập theo dòng thời gian: TĐ2 nhiều đợt (mỗi phụ lục 1 đợt), thay 3 ô TĐ của V07
- Người dùng: "TĐ2 điều chỉnh có nhiều đợt, sắp xếp nhập khoa học, logic". Mỗi dòng HĐ / PL (doanh thu CĐT và HĐ đầu vào) chỉ nhập: Loại · **Thuộc TĐ**
  (tự gợi ý HĐ -> TĐ1, PL -> TĐ2; sửa tay: PL ký cùng HĐ -> TĐ1, HĐ ký thêm -> TĐ2, phát sinh quyết toán -> TĐ3) · Ngày · Giá trị phát sinh (+/−) · VAT.
- Công thức: TĐk = tổng các dòng thuộc TĐ1..k; TĐ3: HĐ đã có hồ sơ quyết toán -> giá trị quyết toán (doanh thu) / HT/QT (HĐ đầu vào), chưa có -> tổng mọi dòng.
  Mục IV cột TĐ2 = từng đợt (PL01, PL02…) + "HĐ mới". Dòng nhập theo 3 ô TĐ ở V07 vẫn đọc đúng (tương thích), sửa lại thì chuyển sang cách mới.
- Kho dữ liệu: THÊM cột `td` vào `doanh_thu` (HĐ đầu vào đã có `td`). Cột `gt_td1..3` giữ lại (không dùng cho dòng mới).
- Bảng Doanh thu mục 1: trong mỗi HĐ xếp theo TĐ -> ngày -> số PL; nhãn "TĐ1 · Ký HĐ" / "TĐ2 · Đợt 1, 2…" / "TĐ2 · HĐ ký thêm" / "TĐ3 · Quyết toán";
  giá trị đợt có dấu +/− và lũy kế "→" sau mỗi đợt; dòng Cộng ghi "TĐ1 → TĐ2 → TĐ3" (TĐ3 = hồ sơ quyết toán nếu có). Hộp HĐ thầu phụ: cột Thuộc TĐ + Giá trị, TỔNG có "TĐ1 → TĐ2 → TĐ3".
- Kiểm tra: kịch bản nhiều đợt 12/12 ĐẠT; tương thích 3 ô TĐ 15/15; duyệt 28/28; tester 4.635 ĐẠT 0 LỖI (bộ nhớ tạm + PostgreSQL); dữ liệu cũ giống hệt bản gốc; máy tính + iPhone 13 không tràn.

## V07.09.11.26 – Doanh thu + HĐ đầu vào: 3 ô giá trị TĐ1 / TĐ2 / TĐ3 nhập tay (thay cho HĐ = TĐ1, PL = TĐ2)
- Mỗi dòng HĐ / PL (doanh thu với CĐT và HĐ đầu vào: thầu phụ, vật tư, nhân công, MMTB) có 3 ô (trước VAT): TĐ1 (trống = 0) · TĐ2 (trống = TĐ1) ·
  TĐ3 (trống = quyết toán: doanh thu theo hồ sơ QT của HĐ, HĐ đầu vào theo giá trị HT/QT; chưa có thì = TĐ2). Nhập tay TĐ3 được ưu tiên.
- Giá trị HĐ/PL (còn phải thu, đã thanh toán…) = TĐ mới nhất có số. Dòng cũ (chưa nhập ô nào) giữ cách tính cũ -> số cũ KHÔNG đổi
  (so sánh toàn bộ mốc TĐ của 12 dự án mẫu trước / sau: 0 chỗ khác).
- Kho dữ liệu: THÊM cột `gt_td1`, `gt_td2`, `gt_td3` vào `doanh_thu` và `tp_hd_pl`. Công thức: `lib/report.js` `tdLine`, `tpLine`, `tpTd`; mục IV cột TĐ2 = phần tăng TĐ1 -> TĐ2 theo PL ("HĐ điều chỉnh" / "HĐ mới").
- Giao diện: form Doanh thu mục 1 có 3 ô TĐ + giá trị hiện hành; bảng ghi chú "TĐ1 · TĐ2 · TĐ3" dưới số tiền; hộp HĐ thầu phụ thay ô "Thuộc TĐ" + "Giá trị" bằng 3 ô TĐ, dòng TỔNG theo 3 TĐ;
  form tạo HĐ đầu vào giữ ô "Thuộc thời điểm" (giá trị đưa vào ô TĐ đó). Nhật ký ghi trước → sau của TĐ1/2/3.
- Kiểm tra: 15 tình huống TĐ (doanh thu + chi phí, có QT, nhập tay TĐ3) 0 lỗi; 28 tình huống duyệt 0 lỗi; tester 4.590 ĐẠT 0 LỖI (bộ nhớ tạm + PostgreSQL); máy tính + iPhone 13 không tràn.

## V06.09.11.26 – Phân quyền: tab Báo cáo chỉ Quản trị, Lãnh đạo, Ban Kiểm soát (+ Chỉ xem / Khách)
- `QUYEN.bao_cao` = admin, lanh_dao, bks, viewer (người dùng chọn giữ quyền xem cho Chỉ xem / Khách). Biên tập, QS, Kế toán: không thấy tab Báo cáo (gồm Dashboard),
  không có Trợ lý số liệu, máy chủ chặn `/api/bao-cao` (403). `QUYEN.xuat` = admin, lanh_dao, bks.
- Vai nhập liệu đăng nhập vào thẳng Nhập liệu › Doanh thu; bấm mã / tên dự án ở danh sách Dự án mở Doanh thu của dự án (thay cho báo cáo công trình).
- Kiểm tra 7 vai (Quản trị, Lãnh đạo, BKS, Chỉ xem, Biên tập, QS, Kế toán): đúng nút, đúng trang mở, đúng 200 / 403, Trợ lý / Xuất đúng; 28 tình huống duyệt 0 lỗi; tester 0 LỖI.

## V05.09.11.26 – Điều hướng: dự án mới -> Doanh thu; Báo cáo chọn dự án -> TĐ mới nhất
- Nhập liệu › Dự án: thêm dự án mới xong (người có quyền HĐ) tự chuyển sang Nhập liệu › Doanh thu, chọn sẵn dự án vừa tạo, báo "✓ Đã thêm dự án … – nhập HĐ / phụ lục…" (12 giây).
- Báo cáo: chọn 1 dự án ở Phạm vi -> mục I tự nhảy sang TĐ mới nhất của dự án (`bTdMoiNhat`): lớn nhất của số TĐ đã chốt và theo hệ thống
  (đã quyết toán -> TĐ3; có phụ lục / phát sinh -> TĐ2; còn lại TĐ1). Chọn "Tất cả dự án" giữ TĐ đang chọn.
- Kiểm tra: 12 dự án mẫu nhảy đúng TĐ (3 dự án đã QT -> TĐ3, còn lại TĐ2); tester 4.545 ĐẠT 0 LỖI; máy tính + iPhone 13 không tràn, không lỗi trang.

## V03 + V04.09.11.26 – Duyệt: đồng bộ tức thì cả Báo cáo, cùng tài khoản nhiều máy
- V03: kênh báo tức thì có đệm 2 KB (đẩy qua máy chủ trung gian ngay); đo trên Railway: nhịp đến đúng từng giây (không bị giữ). Điểm thử công khai `/su-kien-thu` (3 nhịp rồi đóng, không có số liệu).
  Báo cáo đang mở tự tải lại số khi có số liệu được duyệt / ghi (giữ vị trí cuộn).
- V04: sửa lỗi máy cùng tài khoản (hoặc người duyệt tự bấm duyệt) bỏ qua việc tải lại số liệu -> nay mọi máy đang mở đều tải lại. Đo: duyệt ở máy khác -> Báo cáo cập nhật ~0,5 giây.
- Kiểm tra: 28 tình huống duyệt 0 lỗi; tester 4.545 ĐẠT 0 LỖI; máy tính + iPhone 13 không tràn, không lỗi trang.

## V02.09.11.26 – Duyệt: thông báo + đồng bộ tức thì
- Máy chủ đẩy thông báo tức thì (Server-Sent Events, `GET /api/duyet/su-kien`, hàm `dyBao`): gửi duyệt / duyệt / từ chối / hủy / người duyệt ghi số liệu -> mọi máy đang mở cập nhật ngay
  (số trên tab, thông báo nổi, mục Chờ duyệt, danh sách Duyệt; trang Doanh thu / Chi phí đang mở tự tải lại số liệu nếu không có dòng đang nhập dở). Dự phòng: kiểm tra lại mỗi 15 giây (trước 30) + khi quay lại cửa sổ.
- Đo trên máy: người nhập gửi -> máy người duyệt hiện số sau ~0,3 giây; duyệt -> máy người nhập cập nhật số liệu sau ~0,3 giây.
- Câu báo sau khi gửi (VD "Đã tạo HĐ thầu phụ…") đổi thành "⏳ Đã gửi duyệt: … – CHƯA tính vào tổng…" (khung vàng) khi nội dung đang chờ duyệt.
- Kiểm tra: 28 tình huống duyệt 0 lỗi; tester 4.545 ĐẠT 0 LỖI.

## V01.09.11.26 – Duyệt TRƯỚC khi ghi: số chờ duyệt không tính vào tổng, tự hủy khi nhập sai
- Người dùng chốt: phạm vi = Tiền (tiền về, thanh toán HĐ đầu vào, chi phí) + Giá trị HĐ (HĐ/PL/NT-QT CĐT, HĐ đầu vào + PL) + Chốt TĐ + Số dư đầu kỳ (+ DT-CP dự kiến/BH);
  người duyệt = Quản trị + Lãnh đạo (tự nhập = tự duyệt); sửa đã duyệt -> chờ duyệt, số cũ vẫn tính, lưu lịch sử.
- Máy chủ (`server.js` khối PHÊ DUYỆT, bảng `DUYET_TRUOC`): người nhập không có quyền duyệt -> kiểm tra quyền + dữ liệu + Passcode (xóa HĐ/PL, HĐ thầu phụ) NGAY lúc gửi,
  lưu yêu cầu gốc vào hồ sơ (trả 202 `cho_duyet`), KHÔNG ghi vào số liệu. Duyệt -> máy chủ tự gửi lại yêu cầu gốc tới chính nó (mã nội bộ ngẫu nhiên, chỉ từ 127.0.0.1) dưới tên người nhập;
  lỗi khi ghi -> hồ sơ vẫn chờ, ghi lý do lỗi. Từ chối / Hủy -> không ghi gì. API mới `POST /api/duyet/huy` (người nhập hoặc người duyệt; ghi nhật ký "Hủy gửi duyệt").
- Kho dữ liệu: bảng `duyet` THÊM cột `yeu_cau` (JSONB), `so_tien`, `du_an_id`, `loi`; trạng thái mới `huy`. Hồ sơ cũ (trước bản này) cùng người tự thêm rồi tự xóa khi còn chờ -> tự đóng "Đã hủy".
- Giao diện: thông báo "Đã gửi duyệt"; mục **Chờ duyệt** (khung vàng) trong Nhập liệu → Doanh thu / Chi phí theo dự án: số lượng, tổng tiền, nội dung, nút Hủy (người nhập) / Duyệt – Từ chối (người duyệt);
  tab Duyệt / Hồ sơ của tôi thêm lọc "Đã hủy", nút Hủy, hiện lỗi ghi; nhãn trên dòng: "Chờ duyệt sửa / xóa". Nhật ký: Gửi duyệt / Duyệt / Từ chối / Hủy gửi duyệt.
- Kiểm tra: 28 tình huống duyệt (bộ nhớ tạm + PostgreSQL) 0 lỗi; tester 4.545 ĐẠT 0 LỖI (cả hai kho); máy tính + iPhone 13 không tràn, không lỗi trang. Điểm khôi phục: `phien-09.11.26-08h50`.
- Lần lưu `b51b343` thiếu mã phiên bản ở dòng mô tả (lỗi lệnh lấy mã) – mã đúng là V01.09.11.26.

## V01.08.11.26 — Tab Duyệt: phê duyệt số liệu nhập (Quản trị + Lãnh đạo), thông báo, lịch sử
- Người dùng chọn: số liệu chưa duyệt VẪN tính vào báo cáo (gắn nhãn) · duyệt cả Thêm / Sửa / Xóa · từ chối = giữ dòng + lý do · Quản trị / Lãnh đạo nhập = tự duyệt.
- Kho dữ liệu: THÊM bảng `duyet` (hồ sơ: thao tác, đối tượng, dự án, nội dung trước → sau, người nhập, trạng thái cho / duyet / tu_choi, người duyệt, lúc, lý do).
- Tạo hồ sơ tự động từ nhật ký (`lib/audit.js` `onGhi`) cho: dự án, doanh thu, tiền về, chi phí, thầu phụ, HĐ/PL thầu phụ, thanh toán thầu phụ,
  số liệu TĐ (chốt / xóa – mới ghi nhật ký), DT-CP dự kiến · BH/Khác (mới ghi nhật ký). Không tạo cho tài khoản, cài đặt, ảnh, dữ liệu mẫu.
- Quyền (`QUYEN.duyet` = admin, lanh_dao; `QUYEN.nop` = admin, lanh_dao, editor, qs, ke_toan). API: `GET /api/duyet/dem`, `GET /api/duyet`, `GET /api/duyet/nhan`, `POST /api/duyet/xu-ly`.
- Giao diện: tab **Duyệt** (người duyệt) / **Hồ sơ của tôi** (người nhập) – lọc Chờ / Đã duyệt / Từ chối / Tất cả, tìm kiếm, chọn nhiều duyệt / từ chối (bắt buộc lý do), trang 50 dòng.
  Số đỏ trên tab + (N) trên tên cửa sổ + thông báo nổi khi có hồ sơ mới (kiểm tra 30 giây); dòng nhắc ở Báo cáo; nhãn "Chờ duyệt" / "Bị từ chối" (rê chuột xem lý do) trên dòng doanh thu, chi phí, HĐ thầu phụ.
  Mỗi lần duyệt / từ chối ghi Nhật ký hoạt động (hành động "Duyệt" / "Từ chối").
- Kiểm tra: bộ nhớ tạm + PostgreSQL (nâng cấp từ kho cũ): QS / KT sửa → chờ; QS không tự duyệt được (403); từ chối thiếu lý do bị chặn; duyệt / từ chối, số đếm, nhãn, nhật ký đúng;
  Chỉ xem không vào được; máy tính + iPhone 13 không tràn; tester 4.518 ĐẠT, 0 LỖI. Điểm khôi phục: `phien-08.11.26-12h27`.

## V42.07.11.26 – Chi phí: ô "Thuộc thời điểm" cho HĐ / PL đầu vào
- Kho dữ liệu: thêm cột `td` (1/2/3, trống = mặc định) vào `tp_hd_pl` (chỉ THÊM cột).
- Nhập liệu: bảng HĐ/PL trong hộp HĐ thầu phụ có cột "Thuộc TĐ"; form tạo HĐ đầu vào mới có ô "Thuộc thời điểm" (mặc định TĐ1).
- Công thức (lib/report.js `tdOf`, `sumTd`): TĐ1 = dòng thuộc TĐ1 · TĐ2 = dòng thuộc TĐ1 + TĐ2 · TĐ3 giữ nguyên (QT / chưa QT lấy giá trị HĐ). Mặc định: HĐ gốc → TĐ1, PL → TĐ2 (số cũ không đổi).
- Mục IV cột TĐ2 thêm nhóm "HĐ mới" (HĐ đầu vào ký thêm ở TĐ2). Doanh thu (HĐ CĐT) chưa áp dụng – chờ người dùng quyết.
- Kiểm tra: kịch bản 1 TP ở TĐ1 → +3 TP & PL01 ở TĐ2 → +TP & PL02 ở TĐ3 cho TĐ1 100 / TĐ2 260 / TĐ3 305 (đúng); tester 4.575 kiểm tra 0 lỗi.

## V41.07.11.26 – Báo cáo giao diện tối: bỏ nền khung lớn bao ngoài
- Sửa lại V40: bỏ nền + viền của khung lớn "Bảng tổng hợp" phía sau các mục; từng mục I–IV giữ khung riêng có nền xanh đêm.

## V40.07.11.26 – Báo cáo giao diện tối: khung mục I–IV bỏ nền
- Khung từng mục I–IV giữ viền mảnh + vạch màu, bỏ nền (trong suốt, lộ nền khung lớn).

## V39.07.11.26 – Báo cáo giao diện tối: mục I–IV thành khung riêng
- Mỗi mục I–IV có khung riêng (nền #121a37, viền mảnh ánh tím, vạch màu mục bên trái), cách nhau 26px.

## V38.07.11.26 – Báo cáo giao diện tối: tông xanh đêm theo mẫu
- Khung ngoài #0f1631, khối trong #151d3e, viền mảnh rất mờ, bóng phẳng (không phát sáng); rê chuột viền ánh tím nhẹ. Giữ vạch màu đầu 3 thẻ số.

## V37.07.11.26 – Báo cáo giao diện tối: bỏ viền ngoài từng mục
- Bỏ khung viền bao ngoài từng mục I–IV (chỉ giữ khung lớn "Bảng tổng hợp" + các khối bên trong); giãn cách giữa các mục 34px. Giao diện sáng giữ nguyên.

## V36.07.11.26 – Báo cáo giao diện tối: nền khung xanh than đậm
- Nền khung đổi từ xám khói sang xanh than đậm (#1e2a3a; khung ngoài trầm hơn), giữ viền trắng mờ.

## V35.07.11.26 – Báo cáo giao diện tối: viền khung dịu
- Viền khung đổi từ xanh neon phát sáng (chói) sang trắng mờ + bóng tối nhẹ → khung nổi khối, không chói. Giữ vạch màu trên đầu 3 thẻ số.

## V34.07.11.26 – Báo cáo giao diện tối: nền khung xám khói
- Nền các khung Báo cáo (đầu báo cáo, mục lớn, tiêu đề mục, thẻ số, bảng, khung tổng hợp) đổi từ xanh navy sang xám khói; giữ viền neon + bóng. Giao diện sáng không đổi.

## V33.07.11.26 – Đánh giá hoàn thành: bỏ khoảng trống trên tiêu đề
- Tiêu đề khung sát lề trên như các mục khác (bỏ khoảng cách 30px thừa).

## V32.07.11.26 – Đánh giá hoàn thành: tách khung tổng hợp
- Tách thành 2 khung riêng, đối xứng, cao bằng nhau: "Tổng hợp đánh giá" | "Cơ cấu đánh giá" (điện thoại: xếp dọc).

## V31.07.11.26 – Đánh giá hoàn thành: sửa cột theo đúng định nghĩa
- Cột: STT | Mã DA | Tên | DT TĐ3 | GTHT | TL % HT | Tiền về | % Tiền về | Tiêu chuẩn | Xếp loại | Giải pháp.
- TL % HT = Thực chi ÷ CP TĐ3 · GTHT = TL % HT × DT TĐ3 · % Tiền về = Tiền về ÷ GTHT · Xếp loại theo % tiền về.
- Khung tổng hợp thêm TL % hoàn thành; màn hình < 1500px chuyển xuống dưới bảng.

## V30.07.11.26 – Đánh giá hoàn thành: thông báo dự án Chưa đạt
- Bảng giữ thứ tự A–Z theo mã dự án; dự án **Chưa đạt** hiện thành khung thông báo đỏ phía trên bảng (thấp nhất trước), kèm số cần thu thêm + nút "Đi tới HĐ".
- Hơn 8 dự án → bảng thành trang cuộn (giữ tiêu đề / tổng cộng).

## V29.07.11.26 — Đánh giá hoàn thành: ưu tiên Chưa đạt, cuộn khi nhiều dự án
- Thứ tự: Chưa đạt → Đạt → Tốt → Rất tốt → chưa đủ số liệu; cùng loại thì % HT thấp đứng trước. STT đánh lại theo thứ tự này.
- > 8 dự án: bảng trái cuộn trong khung (cao 520px), dòng tiêu đề + Tổng cộng đứng yên (sticky). In / PDF: in đủ, không cuộn.

## Quyết định người dùng 07/11/2026 – Đánh giá hoàn thành
- Mốc: đúng 90% = **Tốt**, đúng 70% = **Chưa đạt** (xác nhận). "GTGT" trong yêu cầu = **GTHT** (Giá trị hoàn thành).
- **Giữ** công thức hiện tại: % hoàn thành mục I = Thực chi ÷ Chi phí dự kiến (cost to cost); khung Đánh giá hoàn thành:
  GTHT = Dòng chi ÷ CP TĐ3 × DT TĐ3, % HT = Dòng thu ÷ GTHT.

## V28.07.11.26 — Đổi tên khung thành "Đánh giá hoàn thành" (bỏ chữ "thu tiền")

## V27.07.11.26 — Thay Bản đồ bằng "Đánh giá hoàn thành – thu tiền"
- Bỏ bản đồ (khung `bMapSection` không còn gọi; `public/map.js` giữ nguyên, không dùng). Khung mới `bHtSection` (report.js):
  - **GTHT** = Dòng chi ÷ Chi phí TĐ3 × Doanh thu TĐ3 (TĐ3 theo mục I/IV; chưa QT = TĐ2). **% HT** = Dòng thu ÷ GTHT. Dòng thu/chi như mục II.
  - Xếp loại (người dùng chốt): ≥120% Rất tốt · ≥90% Tốt · >70% Đạt · ≤70% Chưa đạt (`HT_XL`).
  - Trái: STT | Mã DA | Tên | DT TĐ3 | GTHT | TL % HT | Tiêu chuẩn đánh giá | Xếp loại | Khắc phục.
    Chưa đạt: "⚠ Cần thu tiền về thêm X (để đạt 70%) từ <2 HĐ CĐT còn phải thu lớn nhất>" + nút **Đi tới HĐ ›** (mở tab Doanh thu của dự án);
    Đạt: "Theo dõi, đẩy nhanh thu tiền"; Tốt / Rất tốt: trống.
  - Phải: Giá trị hoàn thành, Tiền về, % Hoàn thành, Xếp loại (tổng) + bảng cơ cấu đánh giá kèm số dự án mỗi loại.
- Kiểm tra: DEMO-01 GTHT 72,27 = 52,20 ÷ 76,74 × 106,25; 85,8% Đạt. Giả lập 1 dự án thu thấp → Chưa đạt, cảnh báo + nút mở đúng dự án.
- Người dùng báo sẽ đổi % hoàn thành sau. Điểm khôi phục: `phien-07.11.26-13h51`.

## V26.07.11.26 — Báo cáo: cân lề, cân dòng mọi bảng
- Mọi ô tiêu đề / dữ liệu trong Báo cáo căn giữa theo chiều dọc (ô tiêu đề cao 2 tầng ở mục III, "Chỉ tiêu" mục IV không còn dồn đáy).
- Phân tích chi tiết (`.b-detail`, bảng số đồng đầy đủ 11–14 cột): chữ 11,5px, khoảng cách gọn, tiêu đề dài được xuống dòng,
  tên dự án xuống dòng → không còn phải kéo ngang. Máy kiểm tra 30 bảng (1366px): 0 lệch dọc, 0 tràn.

## V25.07.11.26 — Mục III: tách nhóm Thu / Chi
- Bảng mục III (`.th-t3`) có dòng tiêu đề nhóm: **Thu (tiền về)** = Doanh thu TĐ – Dòng thu – Còn phải thu (nền xanh nhạt),
  **Chi (tiền ra)** = Chi phí TĐ – Dòng chi – Còn phải chi (nền cam nhạt), **Còn lại (thu − chi)** riêng; vạch đậm ngăn giữa các nhóm.
- Tiêu đề 1 dòng; màu nhóm có cả giao diện sáng / tối. Số liệu không đổi.

## V24.07.11.26 — Báo cáo: mọi bảng theo dự án tự co cột
- Máy tính: mọi bảng `#b-report .th-table` (mục I, II, III…) chuyển từ chia cột cố định sang tự co theo nội dung; tiêu đề 1 dòng
  (VD "Còn lại (thu − chi)"), cột số / STT / Mã / Tình trạng gọn, Tên dự án giãn. Đã thử: 3 bảng không còn tiêu đề 2 dòng, không tràn.

## V23.07.11.26 — Mục I: cột Hoàn thành (cost to cost), thứ tự cột, bảng gọn
- Thứ tự: STT | Mã DA | Tên dự án | Tình trạng | **Hoàn thành** | Doanh thu | Chi phí | Lợi nhuận | ± LN so TĐ trước | Tỷ lệ LN.
- **Hoàn thành (tạm, người dùng chốt 07/11)** = cost to cost = Thực chi (như mục II, cùng cơ sở VAT, lũy kế đến kỳ) ÷ Chi phí dự kiến của TĐ đang chọn;
  thanh + số %, > 100% đỏ; dòng tổng = Σ thực chi ÷ Σ chi phí. (Trước đây thanh = tỷ suất LN so với 30%.) Người dùng báo sẽ đổi cách tính sau.
- Bảng `.th-t1` tự co cột theo nội dung (bỏ chia cột cố định ở màn hình lớn), Tên dự án hiện đủ, cột Hoàn thành 190px. Điểm khôi phục: `phien-07.11.26-13h16`.

## V22.07.11.26 — Mục III: tên ô gọn
- "Dòng thu còn lại phải thu" → **Còn lại phải thu**; "Dòng chi còn lại phải chi" → **Còn lại phải chi** (bỏ lặp chữ).

## V21.07.11.26 — Khung tóm tắt: Thực thu / Thực chi không dẫn số
- Bỏ liên kết (bấm mở bảng chi tiết) ở Thực thu, Thực chi trong khung tóm tắt cạnh tiêu đề báo cáo; chỉ Số dư đầu kỳ bấm được để nhập.
  Bảng chi tiết vẫn mở được từ mục II Dòng tiền thực tế.

## V20.07.11.26 — Bảng nhập Số dư: ô nhập chuẩn
- Ô nhập cỡ chữ 14px như phần Nhập liệu (trước đó bị kế thừa chữ to → số bị cắt), cột 240px, hiện đủ 1.000.000.000.000.
- Cửa sổ rộng tới 720px (điện thoại: gần hết màn hình), tiêu đề màu xanh hệ thống (không dùng màu đỏ của hộp passcode).

## V19.07.11.26 — Bảng nhập Số dư đầu kỳ; khung tóm tắt gọn
- Bấm Số dư đầu kỳ → bảng nhập riêng (`bSddkDlg`): dòng Số dư chung (công ty) + từng dự án trong phạm vi đang xem (xem 1 dự án → chỉ dự án đó + chung);
  ô nhập tự thêm dấu chấm, được âm; dòng Tổng cộng cập nhật khi gõ; Lưu chỉ gửi dòng thay đổi. Thay hộp nhập mặc định của trình duyệt.
- Khung tóm tắt: bỏ chú thích cách tính, chỉ còn "đơn vị · trước/sau VAT"; bỏ đường kẻ dưới dòng Số dư cho gọn như ban đầu.

## V18.07.11.26 — Báo cáo: Số dư đầu kỳ
- Khung tóm tắt cạnh tiêu đề báo cáo: **Số dư đầu kỳ** (nhập tay) → **Thực thu**, **Thực chi** (bấm mở bảng chi tiết như mục II)
  → **Còn lại = (Thực thu − Thực chi) + Số dư đầu kỳ**.
- 2 loại số dư (người dùng chốt): **chung (công ty)** + **từng dự án**. Xem 1 dự án = số dư dự án đó; xem nhiều / tất cả = chung + tổng số dư các dự án.
  Bấm số dư: phạm vi tất cả → nhập số chung; phạm vi 1 dự án → nhập số của dự án. Đơn vị nhập: đồng, được âm, trống = 0.
- Lưu ở Cài đặt, khóa `so_du_dau_ky` = JSON {chung, du_an: {id: số}} (KHÔNG đổi cấu trúc kho dữ liệu). API `PUT /api/so-du-dau-ky`
  (Quản trị + Kế toán; Chỉ xem bị chặn), ghi nhật ký trước → sau; `/api/bao-cao` trả `so_du_dau_ky`.
- Số dư là tiền thật, không quy đổi VAT. Dashboard chưa có số dư (chỉ khung tiêu đề báo cáo). Điểm khôi phục: `phien-07.11.26-10h44`.

## V17.07.11.26 — Danh sách dự án: cân đối cột
- Máy tính (>900px): cột Mã, Trạng thái, Tiến độ (ngày, căn giữa), Thời gian, Cập nhật, nút co vừa nội dung (width 1%, không xuống dòng);
  Tên dự án 34%, Chủ đầu tư 26%. Bỏ dòng chú thích loại công trình · địa điểm dưới tên.
- Sửa lỗi: ô nút Sửa / Xóa dùng `display: grid` nên tách khỏi cột, đè lên cột Cập nhật → trả về `table-cell`. Điện thoại giữ dạng thẻ.

## V16.07.11.26 — Danh sách dự án: cột mới
- Cột: Mã dự án | Tên dự án | Chủ đầu tư | Trạng thái | Tiến độ (ngày) | Thời gian | Cập nhật | Sửa / Xóa.
- Bỏ cột Doanh thu, Chi phí, Lợi nhuận, Tiến độ %; bỏ nút "Doanh thu", "Chi phí" trên từng dòng. Bấm mã / tên dự án → báo cáo công trình.
- Tiến độ (ngày) = ngày kết thúc − ngày bắt đầu (trống 1 trong 2 ngày → "—"). Xuất CSV giữ nguyên các cột cũ.

## V15.07.11.26 — Biểu mẫu Thêm dự án: 9 ô, Tiến độ (ngày)
- Thứ tự ô: Mã dự án · Tên dự án · Chủ đầu tư · Loại công trình · Địa điểm · Trạng thái · **Tiến độ (ngày)** · Ngày bắt đầu · Ngày kết thúc.
- Tiến độ (ngày) = ngày kết thúc − ngày bắt đầu, tự tính khi nhập (`pDays` trong `public/app.js`), chỉ hiện, không lưu; âm thì đỏ.
- Ẩn khỏi biểu mẫu nhưng GIỮ giá trị khi sửa (ô ẩn vẫn gửi đi): Khu vực, Vị trí (tọa độ), Tiến độ (%) – vẫn dùng cho bản đồ, doanh thu theo khu vực,
  tiến độ bình quân. Đã thử: sửa DEMO-01 → tọa độ 11.0632, 106.7952 / khu vực / tiến độ 58% giữ nguyên.
- Lưu ý: dự án mới không nhập được tọa độ / tiến độ % → không hiện trên bản đồ, tiến độ % = 0. Điểm khôi phục: `phien-07.11.26-10h30`.

## V14.07.11.26 — Cửa sổ chi tiết: thống nhất đơn vị
- Mọi bảng trong cửa sổ Thực thu / Dòng chi (bảng tóm tắt, các lần tiền về, HĐ đầu vào, khối → nhóm, CP kế hoạch) dùng cùng 1 đơn vị
  theo ô "Đơn vị" (`mtr` – mặc định triệu đồng như tab Chi phí; rê chuột xem số đồng). Ghi chú đầu cửa sổ ghi tên đơn vị đang dùng.

## V13.07.11.26 — Cửa sổ Thực thu: Doanh thu – Thực thu – Còn lại; tiền về gộp theo HĐ, có tổng
- Bảng trên (cửa sổ "thu"): **Doanh thu dự kiến (TĐ1 – ban đầu)** | Thực thu | **Còn lại phải thu** = DT − thực thu.
  DT TĐ1 như mục I: đã chốt lấy số chốt, chưa chốt `bSysMoc(d,1)`; Sau VAT quy đổi theo VAT HĐ gốc, làm tròn 0,1 tỷ. DEMO-01: 103,233 / 113,60 tỷ = mục I.
- Bảng "Các lần tiền về": gộp theo công trình + hợp đồng, mặc định thu gọn (▸ / Mở tất cả), mỗi HĐ có tổng; dòng **Tổng cộng (n lần)**.
  Bảng vay / trả nợ gốc cũng có dòng Tổng cộng.
- Lưu ý: xem Trước VAT, Thực thu bảng trên làm tròn 0,1 tỷ (như mục II), tổng bảng dưới là số quy đổi chưa làm tròn → chênh vài chục triệu.

## V12.07.11.26 — Cửa sổ Dòng chi: luôn thu gọn nhóm
- Bảng HĐ đầu vào luôn thu gọn theo nhóm HĐ CĐT, kể cả khi chỉ có 1 nhóm (trước đây 1 nhóm thì tự mở dòng con 1.1).

## V11.07.11.26 — Cửa sổ Dòng chi: Chi phí dự kiến – Thực chi – Còn lại phải chi
- Bảng tóm tắt theo công trình (cửa sổ "chi") đổi 3 cột: **Chi phí dự kiến (TĐ1 – ban đầu)** | Thực chi | **Còn lại phải chi** = dự kiến − thực chi.
- Chi phí dự kiến = chi phí TĐ1 như mục I: đã chốt TĐ1 lấy số chốt, chưa chốt `bSysMoc(d, 1)`; Trước VAT giữ nguyên,
  Sau VAT quy đổi tỷ lệ CP sau/trước VAT, làm tròn 0,1 tỷ (như mục I). Kiểm tra DEMO-01: 61,415 tỷ / 67,00 tỷ = mục I.

## V10.07.11.26 — Cửa sổ Dòng chi: tự gộp nhóm, thu gọn, tổng luôn hiện
- Bảng HĐ đầu vào: tự gộp theo HĐ CĐT + Mua lẻ, mặc định thu gọn (chỉ 1 nhóm thì mở sẵn); nút ▸/▾ từng nhóm + "Mở tất cả".
- Bảng khối → nhóm: chỉ hiện dòng khối (kèm số nhóm), bấm ▸ mở nhóm + hạng mục; "Mở tất cả".
- Bỏ giới hạn chiều cao bảng trong cửa sổ → TỔNG HĐ ĐẦU VÀO / TỔNG GỒM MUA LẺ / Tổng chi phí luôn thấy.

## V09.07.11.26 — Cửa sổ Dòng chi dùng đúng bảng tab Nhập liệu → Chi phí
- Bấm Dòng chi (mục II, thẻ công trình…) → `bCostLive` lấy dữ liệu đúng nguồn tab Chi phí (`/api/du-an/:id/chi-phi` hoặc `/api/chi-phi-tong`)
  và hiện 2 bảng chỉ xem: 1. Hợp đồng đầu vào (gộp theo HĐ CĐT, Mua lẻ, TỔNG HĐ ĐẦU VÀO / TỔNG GỒM MUA LẺ) · 2. Chi phí theo khối → nhóm → hạng mục.
- Hai bảng này: sau VAT, lũy kế đến hiện tại (như tab Chi phí). Bảng tóm tắt theo công trình phía trên vẫn theo nút Trước / Sau VAT và kỳ báo cáo.
- Kiểm tra: DEMO-01 47 HĐ, tổng CP sau VAT 83.703.146.260 = tab Chi phí. Điểm khôi phục: `phien-07.11.26-08h51`.

## V08.07.11.26 — Giảm sáng khối tóm tắt
- Người dùng: sáng quá, chói → dịu màu số (#8fb0e8 / #e3ab76 / #6fd6c4), ánh sáng quanh chữ giảm còn ~0,2, Còn lại 21px.

## V07.07.11.26 — Báo cáo tối: tóm tắt Dòng thu / Thực chi / Còn lại nổi bật
- Khối `.b-cash` (bên phải tiêu đề báo cáo), chỉ giao diện tối: khung kính viền neon; số to hơn, sáng theo màu dòng
  (Dòng thu xanh dương, Thực chi cam, Còn lại xanh ngọc 23px) có ánh sáng nhẹ; số âm đỏ. Phải gắn `#b-report` vì quy tắc gốc có `#b-report`.

## V06.07.11.26 — Báo cáo tối: cùng kiểu Dashboard
- Vùng bao ngoài (`#b-report .card.b-sec`, `.th-sec`): nền trong suốt + viền xanh ngọc ánh neon nhẹ.
- Khối bên trong (`.b-head`, `.th-head`, `.f-card`, `.tt-k`, `.table-wrap`, `.pc-tile`): nền kính, nổi 3px, viền + bóng neon theo màu khối.
- Chỉ giao diện tối; giao diện sáng và in / PDF không đổi.

## V05.07.11.26 — Dashboard tối: viền vùng có ánh neon
- Viền ngoài `.db-flow`, `.db-kg`: xanh ngọc mảnh + ánh neon nhẹ (ngoài + trong), đồng bộ với các khối; nền vùng vẫn trong suốt.

## V04.07.11.26 — Dashboard tối: giữ viền ngoài từng vùng
- Người dùng yêu cầu giữ outline ngoài của từng vùng: `.db-flow`, `.db-kg` có lại viền mảnh `rgba(255,255,255,.12)`, nền vẫn trong suốt; khối bên trong giữ neon.

## V03.07.11.26 — Dashboard tối: nền khung trong suốt, khối nổi neon
- Chỉ giao diện tối: khung `.db-flow` (4 khối I–IV) và `.db-kg` (2 cụm trên cùng) nền trong suốt 100%, bỏ viền/bóng.
- Các khối `.db-blk`, `.db-kpi`, `.db-card`, bảng Kế hoạch – Thực – Còn lại: nền kính, nổi lên 3px, viền + bóng neon nhẹ theo màu khối
  (rê chuột nổi thêm); khối II đổi màu nhấn sang xanh dương sáng cho rõ trên nền tối. Giao diện sáng, in / PDF không đổi.
- Điểm khôi phục trước khi sửa: `phien-07.11.26-08h09`.

## V02.07.11.26 — Bảng chi tiết mục II theo nút Trước / Sau VAT
- Mở từ mục II (`data-tts="1"`): cùng kỳ "lũy kế đến" với mục II (kể cả bấm 1 dự án) và cùng cơ sở VAT.
- Trước VAT: Dòng thu × tỷ lệ DT trước/sau VAT, Dòng chi × tỷ lệ CP trước/sau VAT của từng dự án (`bVatR`), số tổng mỗi dự án làm tròn 0,1 tỷ (`bQ01`)
  như ô mục II; từng dòng tiền về / chi phí / HĐ đầu vào quy đổi cùng tỷ lệ. Mở từ thẻ công trình: giữ như cũ (sau VAT, đến hiện tại).
- Kiểm tra: 12/12 trường hợp (thu, chi, còn lại × tổng / 1 dự án × trước / sau VAT) số bảng chi tiết khớp số trên ô.

## V01.07.11.26 — Mục II Dòng tiền thực tế: bấm số xem bảng chi tiết
- Ô lớn Dòng thu / Dòng chi / Còn lại và từng ô trong bảng dự án (cả dòng Tổng cộng) bấm được → mở bảng chi tiết sẵn có (`bThucDrill`):
  Dòng thu = từng lần tiền về; Dòng chi = chi phí theo nhóm + đã trả từng HĐ đầu vào; Còn lại = thu − chi theo công trình.
  Bấm ô của 1 dự án → chỉ dự án đó. Nút "Mở" trong bảng chi tiết tới tab nhập liệu của công trình.
- Lưu ý: bảng chi tiết hiện số đồng, sau VAT (mục II có thể đang xem trước VAT). Có câu hướng dẫn dưới bảng; thêm câu dịch English.
- Điểm khôi phục trước khi sửa: `phien-07.11.26-08h01` (V30.06.11.26).

## V30.06.11.26 — Dashboard PDF cân đối: căn giữa, kín bề ngang, Danh mục + Bản đồ cạnh nhau
- `dpPrint()`: bố cục in cố định (không theo màn hình): 2 nhóm chỉ số / hàng, 4 khối I–IV một hàng, biểu đồ 3 cột, Danh mục (3 phần) + Bản đồ (1 phần) cạnh nhau,
  bản đồ cao bằng bảng; bỏ giới hạn bề rộng, căn giữa; thử bề rộng 1300 / 1450 / 1600 / 1800px × A4 dọc / ngang, chọn cách chữ to nhất mà vừa 1 trang.
- Kiểm tra: 12 dự án và 1 dự án → 1 trang A4 dọc, đủ cột bảng, không lệch trái. Điểm khôi phục: `phien-06.11.26-16h44`.

## V29.06.11.26 — Dashboard PDF = in nguyên cụm Dashboard như màn hình, vừa 1 trang A4
- `public/dash-pdf.js` `dpPrint()`: đang ở Báo cáo thì tạm chuyển sang Dashboard (in xong trả lại); chụp kiểu dáng đang thấy của từng phần tử
  (lưới, cột, cỡ chữ, chiều cao biểu đồ / bản đồ) gắn tạm lên phần tử để khổ giấy hẹp không đổi sang kiểu xếp điện thoại;
  tự chọn A4 dọc / ngang theo tỷ lệ, thu nhỏ (zoom) vừa đúng 1 trang, lề 7mm; in xong trả lại nguyên trạng.
- Bản 1 trang dựng riêng cũ `dpHtml()` giữ lại trong tệp, không dùng.
- Kiểm tra: 12 dự án và 1 dự án → đúng 1 trang A4, bố cục như màn hình; sau in quay lại chế độ Báo cáo. Điểm khôi phục: `phien-06.11.26-16h41`.

## V28.06.11.26 — In / PDF: phân trang gọn, tránh ngắt
- Khối `@media print` cuối `style.css`: tiêu đề mục (I, II, III…) + ô số liệu luôn đi cùng nhau (không để tiêu đề trơ trọi cuối trang);
  ô số liệu, bảng nhỏ (ma trận TĐ mục IV, bảng Kế hoạch – Thực – Còn lại), biểu đồ không bị cắt; dòng bảng không bị cắt ngang;
  bảng dài sang trang mới lặp lại dòng tiêu đề cột, dòng tổng chỉ in 1 lần ở cuối; biểu đồ chi tiết 2 cái / hàng, cao ≤ 80mm.
- Kiểm tra: xuất PDF dữ liệu mẫu 12 dự án – 34 → 30 trang; trang 1 = đầu báo cáo + mục I, trang 2 = mục II + III, không còn tiêu đề lẻ.
  Điểm khôi phục: `phien-06.11.26-16h36`.

## V27.06.11.26 — In / PDF: khung Dòng thu / Thực chi / Còn lại nằm bên phải tiêu đề như màn hình
- Lỗi: khổ in hẹp (≤ 760px) dính quy tắc điện thoại `.b-cash { width:100% }` → khung số rớt xuống dưới, kéo hết bề ngang.
- Sửa: `@media print` giữ `.b-head` 1 hàng (`nowrap`), `.b-cash` rộng tự nhiên. Kiểm tra: xuất PDF A4 – đúng bố cục.

## V26.06.11.26 — Giao diện tối: nền bề mặt còn 35% độ phủ
- Khối ghi đè cuối `style.css`: 114 biến `--bg-*` của giao diện tối = 35% độ phủ gốc (trước 45%).

## V25.06.11.26 — Giao diện tối trong suốt hơn
- Nền thẻ `--card` .035 → .015; toàn bộ 114 biến nền bề mặt `--bg-*` của giao diện tối giảm còn ~45% độ phủ (khối ghi đè cuối `style.css`).
  Chữ, số giữ nguyên màu. Menu / hộp thoại vẫn nền đặc.

## V24.06.11.26 — Giao diện tối (bản trước nentoi1): thẻ trong suốt, bỏ làm mờ phía sau
- Giữ giao diện tối V21 (nền xanh đen + cực quang). Thẻ: bỏ `backdrop-filter: blur` → trong suốt hẳn; nền thẻ `--card` .055 → .035.
  Menu / hộp thoại vẫn nền đặc để dễ đọc. Điểm khôi phục: `phien-06.11.26-16h14`.

## V23.06.11.26 — Quay lại giao diện tối kính trong suốt (bản V21); lưu bản HUD thành nhánh `nentoi1`
- Người dùng: lưu tạm bản V22 (vi mạch + HUD) thành **`nentoi1`**, quay lại bản cũ – nền / thẻ kính trong suốt.
- Làm: `git checkout 1714bf6 -- public/style.css` (chỉ mã giao diện; sổ ghi chép giữ nguyên) + tăng phiên bản. Điểm khôi phục bản HUD: `phien-06.11.26-16h13` = `nentoi1`.
- Muốn dùng lại nền HUD: "quay về bản nentoi1".

## V22.06.11.26 — Giao diện tối: nền vi mạch + phong cách HUD hologram
- Chỉ đổi `public/style.css` (cuối tệp), chỉ áp khi giao diện tối. Giao diện sáng, In / PDF, Excel không đổi.
- Nền: đen sâu #010308 + mạch in xanh lơ rất mờ trôi chậm (120 giây / vòng, mờ dần ra rìa) + cực quang xanh lơ / xanh dương thở 40 giây.
  Chỉ chuyển động bằng transform / opacity; thẻ bỏ làm mờ kính (nhẹ máy). Máy bật "giảm chuyển động" → đứng yên.
- HUD: thanh đầu trang đen + vạch sáng neon chạy; thẻ kính đen viền xanh lơ, vạch sáng mép trên, rê chuột nổi + quầng; số liệu trắng xanh phát sáng;
  tiêu đề bảng ánh xanh lơ; nút đang chọn xanh lơ → xanh dương. Màu số liệu DT / CP / LN giữ nguyên.
- Người dùng chọn kiểu B (HUD) sau 2 vòng xem trước (Revi). Điểm khôi phục: `phien-06.11.26-16h04`.

## V21.06.11.26 — Bỏ tên riêng TMN / Tân Minh Nhân khỏi hệ thống – lấy theo Cài đặt
- Tên đơn vị lấy từ **Quản trị → Cài đặt → Tên công ty** (sếp đặt, VD "MYMONEY"): đầu trang, báo cáo, Excel, PowerPoint, dòng cuối trang.
- Excel mẫu trình ký (`lib/export-dtcp.js` `congTy(ten)`): khung đầu trang + cột ký hiệu = Tên công ty; bỏ địa chỉ / điện thoại / web TMN.
- Dòng cuối trang: "Produced by the Supervisory Board of <Tên công ty>" (`applyFoot` – common.js). Nút "Excel mẫu TMN" → "Excel mẫu trình ký",
  tên file `BaoCao_DTCP_yyyymmdd.xlsx`. Ảnh logo Excel đổi tên `logo-bao-cao.png`. Liên hệ mặc định: "Ban Kiểm soát".
- Kiểm tra: tên công ty MYMONEY → cuối trang, trang đăng nhập, 2 file Excel đúng tên, 0 chữ TMN, có logo. Điểm khôi phục: `phien-06.11.26-15h51`.

## V20.06.11.26 — Logo MyMoney thay toàn bộ logo cũ
- Tạo từ ảnh người dùng gửi (nền bỏ trong suốt): `public/img/logo-icon.png` (biểu tượng M, 256px), `favicon.png` (64px),
  `logo-full.png` (M + chữ MyMoney – trang Đăng nhập / Khởi tạo), `tmn-logo.png` + `lib/assets/tmn-logo.png` (Excel mẫu TMN, Excel báo cáo).
- Hiện lại logo ở thanh đầu trang (trước để trống). Thêm `?v=mm1` sau đường dẫn ảnh để trình duyệt không dùng ảnh cũ đã lưu.
- Giao diện tối: ô logo giữ nền trắng (chữ M xanh đậm không bị chìm).
- Kiểm tra: đầu trang, báo cáo, Dashboard, giao diện tối, trang Khởi tạo; Excel mẫu TMN nhúng đúng logo mới. Điểm khôi phục: `phien-06.11.26-15h47`.

## V19.06.11.26 — Tài khoản khách: chỉ trên 1 thiết bị, đăng nhập không giới hạn số lần trong 30 phút
- Lần đăng nhập đầu gắn thiết bị (cookie `tb` ngẫu nhiên, lưu 2 ngày; kho lưu bản băm ở cột MỚI `users.thiet_bi`). Thiết bị khác → từ chối + ghi nhật ký "Đăng nhập từ thiết bị khác".
- Cùng thiết bị: đăng nhập / đăng xuất bao nhiêu lần cũng được trong 30 phút (tính từ lần đăng nhập đầu). Mốc tự xóa khi 24 giờ chưa đăng nhập: người dùng đồng ý.
- Lưu ý: khách xóa cookie / đổi trình duyệt = coi như thiết bị khác → cần tạo tài khoản khách mới.
- Kiểm tra (bộ nhớ tạm + PostgreSQL): máy A đăng nhập 3 lần OK, máy B bị từ chối, nhật ký đủ; tester 4.518 ĐẠT, 0 LỖI.

## V18.06.11.26 — Tài khoản khách dùng 1 lần (Chỉ xem, 30 phút từ lần đăng nhập đầu, tự xóa, có nhật ký)
- Quản trị / IT: Tài khoản → "Tài khoản khách (dùng 1 lần)" → nhập ghi chú → tạo. Tên `khach-xxxxxx` + mật khẩu tự sinh (chỉ hiện 1 lần, nút sao chép gửi khách).
- Khách = vai Chỉ xem + không đổi mật khẩu, không có mục Cá nhân; thanh đếm ngược trên đầu trang, hết giờ tự về trang đăng nhập.
- Máy chủ (`server.js`): lần đăng nhập đầu đặt `het_han` = +30 phút; hết hạn → chặn mọi yêu cầu, chặn đăng nhập; mỗi phút `donKhach()` tự xóa khách hết hạn
  và khách tạo quá 24 giờ chưa đăng nhập. Tài khoản khách không sửa được (chỉ xóa). Biến môi trường `KHACH_PHUT` (mặc định 30) chỉ để chạy thử.
- Kho dữ liệu: `users` THÊM cột `khach`, `het_han` (`ADD COLUMN IF NOT EXISTS`) – không đụng dữ liệu cũ.
- Nhật ký (đối tượng "Tài khoản khách"): Thêm (người tạo) · Đăng nhập lần đầu – hạn lúc … · Xóa (Hệ thống tự xóa, lý do) · đăng nhập sau hạn.
- Kiểm tra: bộ nhớ tạm + PostgreSQL 16 (nâng cấp từ cấu trúc cũ) với hạn 1 phút: tạo → đăng nhập → hết hạn bị đăng xuất, API 401 → tự xóa → đăng nhập lại bị từ chối; nhật ký đủ 4 bước; tester 4.518 ĐẠT, 0 LỖI. Điểm khôi phục: `phien-06.11.26-15h24`.

## V17.06.11.26 — Chỉ xem: ẩn Phân tích chi tiết, không có đường sang trang nhập liệu
- `public/report.js`: vai viewer không dựng khối "Phân tích chi tiết" (I → V, cảnh báo, liên kết Mở Doanh thu / Chi phí).
- `public/app.js` `showTab`: viewer chỉ mở được trang có trên menu của mình (Báo cáo, Cá nhân, Liên hệ) – mọi liên kết khác bị bỏ qua.
- `style.css` `body.chi-xem`: ẩn nút "Mở" (`data-tgo`) / liên kết `data-bgo`, tắt bấm cảnh báo.
- Kiểm tra: viewer – không có chữ "Phân tích chi tiết", 0 liên kết, gọi mở Dự án / Doanh thu / Chi phí vẫn ở Báo cáo; Quản trị vẫn đủ; tester 4.518 ĐẠT, 0 LỖI. Điểm khôi phục: `phien-06.11.26-15h16`.

## V16.06.11.26 — Quay lại bản phien-06.11.26-15h01 (mã của V14.06.11.26)
- Người dùng yêu cầu "quay về bản phien-06.11.26-15h01" → lấy lại mã V11 → V14 (mục III theo TĐ, nút TĐ mục III, Dashboard / Dashboard PDF bảng Kế hoạch – Thực – Còn lại).
- Điểm khôi phục trước khi quay: `phien-06.11.26-15h09` (= V15, mã V10). Dữ liệu đã nhập không đổi.

## V15.06.11.26 — Quay về bản quanlytaichinh06112026 (mã của V10.06.11.26)
- Người dùng yêu cầu "quay về bản quanlytaichinh06112026". Bỏ phần mã V11 → V14 (mục III Còn phải thu/chi theo TĐ, nút TĐ mục III,
  Dashboard / Dashboard PDF bảng Kế hoạch – Thực – Còn lại). Ghi chép (docs, CLAUDE.md) giữ bản mới nhất.
- Điểm khôi phục trước khi quay về: `phien-06.11.26-15h01` (= V14.06.11.26) – muốn lấy lại V14 thì "quay về bản phien-06.11.26-15h01".
- Dữ liệu đã nhập không đổi (chỉ đổi mã).

## V14.06.11.26 — Dashboard PDF: đầu trang như Dashboard
- `public/dash-pdf.js`: bỏ 6 chỉ số cũ → 3 chỉ số DT – CP – LN theo TĐ đang chọn trên Dashboard (`BST.db_td`) + bảng Kế hoạch (mục I) – Thực (mục II) – Còn lại (mục III) (`bMuc3Data`).
  Phần dưới (biểu đồ 3 TĐ, cơ cấu, dự án, bảng dự án, điểm nhấn) giữ nguyên theo TĐ3. Vẫn 1 trang A4 ngang.
- Kiểm tra: TĐ3, TĐ2 – 9 ô bảng + 3 chỉ số PDF khớp Dashboard; xuất thử PDF 1 trang. Điểm khôi phục: `phien-06.11.26-14h49`.

## V13.06.11.26 — Dashboard: bảng Kế hoạch – Thực – Còn lại (thay nhóm "Dòng tiền thực tế")
- Bảng 3×3 (`public/dash-tong.js`, `.db-mx`): hàng Doanh thu / Chi phí / Lợi nhuận × cột Kế hoạch (mục I, TĐ đang chọn) · Thực (mục II: dòng thu, dòng chi, thu − chi) · Còn lại (mục III = Kế hoạch − Thực).
  Số lấy đúng hàm `bMuc3Data` của mục III nên khớp báo cáo. Đổi TĐ ở nhóm bên trái thì bảng đổi theo.
- Kiểm tra: TĐ3 và TĐ1 – 9 ô khớp dòng tổng mục I, II, III; sáng / tối, điện thoại không tràn. Điểm khôi phục: `phien-06.11.26-14h45`.

## V12.06.11.26 — Mục III có nút chọn TĐ1 / TĐ2 / TĐ3 (đồng bộ mục I)
- Thêm nút chọn TĐ ngay trong mục III (`data-itd3`), dùng chung lựa chọn `BST.i_td` với mục I: đổi ở mục nào thì cả hai cùng đổi.
- Nút chọn TĐ (mục I, III) gọn lại trên điện thoại ≤ 480px – hết tràn ngang ở dòng nút này.
- Kiểm tra: bấm TĐ2 ở mục III → mục I cùng TĐ2, số mục III đổi đúng; bấm TĐ3 ở mục I → mục III theo TĐ3.

## V11.06.11.26 — Mục III: Dòng tiền còn lại phải thu – chi (công thức mới)
- **Còn phải thu** = Doanh thu TĐk (mục I) − Dòng thu (mục II) · **Còn phải chi** = Chi phí TĐk (mục I) − Dòng chi (mục II) · **Còn lại** = phải thu − phải chi.
  TĐk = thời điểm đang chọn ở mục I (TĐ1 / TĐ2 / TĐ3) – đổi TĐ thì mục III tự lấy theo. Dòng thu, dòng chi: lũy kế đến kỳ đang chọn, theo nút VAT.
- Hàm mới `bMuc3Data` (`public/report.js`); bảng mục III hiện đủ thành phần: DT TĐk, dòng thu, còn phải thu, CP TĐk, dòng chi, còn phải chi, còn lại.
- Dashboard khối III + chỉ số "Còn phải thu" dùng cùng công thức theo TĐ đang chọn của dashboard. Thêm câu dịch English.
- Kiểm tra: đối chiếu dòng tổng mục III với mục I, II ở cả TĐ1/2/3 – khớp; tester 4.518 ĐẠT, 0 LỖI. Điểm khôi phục: `phien-06.11.26-14h36`.

## V10.06.11.26 — Thu = Tiền về = Collections
- Người dùng chốt: gộp "Thu" và "Tiền về" cùng dịch **Collections** (bỏ Receipts). 31 câu đổi theo:
  Thực thu = Actual collections; Còn lại thực = Net actual cash (collections − expenditure); Kế hoạch thu = Planned collections.

## V09.06.11.26 — Thuật ngữ tài chính Thu / Chi
- Người dùng chốt: Thu = dòng tiền về (Receipts), Chi = chi phí mình chi ra (Expenditure) – không dùng In / Out, Cash in / Cash out.
- Đổi 51 câu: Thực thu / Thực chi = Actual receipts / Actual expenditure; Dòng thu / chi = Receipts / Expenditure;
  Còn lại thực = Net actual cash; Kế hoạch thu / chi = Planned receipts / expenditure; THU (tiền về) = RECEIPTS (collections).

## V08.06.11.26 — Sửa dịch chữ không dấu
- Lỗi: "Doanh thu" (chữ Việt không dấu) không được dịch vì bộ dịch chỉ xét chữ có dấu → nay tra cả chữ không dấu (nguyên câu) + câu chứa "Doanh thu".
- Tên hệ thống "Quản trị tài chính" (dữ liệu Quản trị đặt) → thêm vào từ điển: Financial Management. Đổi tên hệ thống thì phải thêm câu dịch mới.
- Thêm "Thu" → In, "Chi" → Out, "Xem" → View. Chống lặp: mọi chữ đã dịch đều ghi nhớ, không dịch lại.

## V07.06.11.26 — Chuyển ngôn ngữ Việt Nam / English
- Ô chọn 🇻🇳 Việt Nam / 🇬🇧 English trên thanh đầu trang (trang Đăng nhập / Khởi tạo: góc phải). Ghi nhớ trên máy (`bks-lang`).
- English: `public/i18n.js` dịch chữ hiển thị (cả phần hiện ra sau, hộp thông báo/xác nhận, tiêu đề tab); về Việt Nam = tải lại trang.
  Từ điển `public/i18n-en.js`: ~1.180 câu + ~280 mẫu có số liệu; đơn vị trong số liệu tự đổi (tỷ → bn, triệu → mn, đồng → VND).
- Revi rà soát thuật ngữ (máy so với bảng thuật ngữ chuẩn): sửa "HĐ đầu vào" → Procurement contracts; "Đợt / Hồ sơ HT/QT" →
  Instalment / Certified–Final account doc.; chặn dịch ghép dở (mẫu ngắn chỉ áp dụng khi phần thay vào là số liệu).
- Kiểm tra: 9 trang ở English, ngoài dữ liệu (tên dự án, đối tác, địa danh, số HĐ) chỉ còn 4 câu dài ghép nhiều mảnh; 0 lỗi trang;
  Việt Nam giữ nguyên; máy tính + iPhone 13 không tràn ngang. Lỗi gặp và đã sửa: lặp vô hạn khi tiêu đề tab chứa tên riêng.
- Chưa dịch (đợt sau nếu cần): Trợ lý 40 câu, nhật ký hoạt động, file Excel / PowerPoint / Excel mẫu TMN, dữ liệu mẫu. Số giữ kiểu VN (1.234,5).
- Điểm khôi phục trước khi sửa: `phien-06.11.26-11h32`.

## V06.06.11.26 — Giao diện tối kiểu kính trong suốt
- Người dùng phản hồi: tối quá, chữ khó thấy → đổi sang kiểu kính mờ: nền xanh đêm có quầng sáng (teal / chàm), thẻ trong suốt
  `rgba(255,255,255,.055)` + làm mờ nền sau, viền sáng mảnh; nền kem/be không còn bị nâu đục; chữ sáng hơn.
- Menu xổ, hộp thoại, trợ lý, nhãn bản đồ, cột cố định bảng: nền đặc `#131f33` để không lẫn chữ.
- Bộ chuyển màu: `scratchpad` không lưu – quy tắc nằm trong phần cuối `public/style.css` (khối `:root[data-theme="dark"]`).
- Kiểm tra: quét tương phản 9 trang → chỉ còn số "III" (thiết kế gốc); 1366px + iPhone 13 không tràn ngang. Giao diện sáng không đổi.
- Điểm khôi phục trước khi sửa: `phien-06.11.26-11h20` (V05.06.11.26).

## V02.06.11.26 — Giao diện Sáng / Tối
- Nút ☀️/🌙 trên thanh đầu trang (cạnh tên người dùng); trang Đăng nhập / Khởi tạo có nút nổi góc phải.
- Lần đầu theo cài đặt của máy (Windows / điện thoại để tối thì hiện tối); bấm nút thì ghi nhớ trên máy đó (`localStorage bks-theme`).
- **In / PDF / Dashboard PDF luôn dùng giao diện sáng** (tự chuyển khi in, in xong trả lại). Excel / PowerPoint không ảnh hưởng.
- Cách làm (`public/style.css`): mọi mã màu cố định → biến theo ngữ cảnh `--bg-xxxxxx` (nền), `--fg-xxxxxx` (chữ), `--bd-xxxxxx` (viền),
  `--mx-xxxxxx` (vừa nền vừa chữ). Giao diện sáng: biến = đúng màu gốc (đã so từng điểm ảnh: không đổi, trừ nút mới).
  Giao diện tối: màu tự tính (nền sáng → xanh đậm, chữ tối → chữ sáng), cuối tệp có phần chỉnh tay. Màu biểu đồ / thương hiệu giữ nguyên.
  Bản đồ: lớp nền bản đồ đảo màu tối. Tệp mới `public/theme.js` (nạp trong `<head>` của 3 trang).
- **Lưu ý khi sửa giao diện:** thêm màu mới thì dùng biến (`var(--card)`, `var(--text)`, `var(--muted)`, `var(--border)`) để tự đổi theo giao diện.
- Kiểm tra: máy quét độ tương phản chữ/nền 9 trang ở giao diện tối → chỉ còn 1 chỗ giống thiết kế gốc (số "III" trắng trên cam);
  máy tính 1366px + iPhone 13 không tràn ngang, không lỗi trang; nút đổi + nhớ sau khi tải lại hoạt động.

## Phiên 06/11/2026 — Thay hệ thống: Quản lý tài chính → BKS (V01.06.11.26)
- Người dùng chọn **thay** web Quản lý tài chính bằng hệ thống BKS từ gói `BKS-staging-V30.04.11.26.zip` (bản staging, commit gốc `e3b1199`).
- Kho mã: `ducptclaude/Quanlytaichinh`, nhánh `staging` → Railway dự án `lavish-essence`, địa chỉ https://quanlytaichinh.up.railway.app
- **Mã cũ** (Quản lý tài chính V3.06.11.2026) lưu ở nhánh `backup-qltc-V3.06.11.2026` – quay lại được.
- **Dữ liệu cũ GIỮ NGUYÊN** ở ngăn `public` của kho dữ liệu Railway. BKS dùng ngăn riêng `bks` (thêm biến `DB_SCHEMA`, `lib/db.js`)
  vì 2 hệ thống trùng tên bảng `users`, `sessions`, `settings`.
- Thay đổi so với gói gốc: chỉ `lib/db.js` (ngăn riêng + kiểm tra cột theo đúng ngăn), thêm `CLAUDE.md`, tóm tắt này, phiên bản.
- Kiểm tra trước khi đưa lên: chạy bộ nhớ tạm + PostgreSQL dùng chung có sẵn dữ liệu cũ → tester **4.518 ĐẠT / 0 LỖI**;
  dữ liệu cũ trước/sau giống hệt (đối chiếu mã kiểm tra); máy tính 1366px + iPhone 13 không tràn ngang.
- Sau khi đưa lên: BKS mới chưa có tài khoản → người dùng vào `/setup` tạo Quản trị (cần SETUP_TOKEN nếu Railway có đặt).
  Nên đặt `APP_ENV=staging` trên Railway để hiện nhãn thử nghiệm.

---

# Tóm tắt phiên làm việc – PROJECT PROFIT (Ban Kiểm soát TMN)

Cập nhật: 22/10/2026. Đọc file này đầu phiên mới; chi tiết kỹ thuật xem code và `git log`.

## 1. Hệ thống
| | Repo / nhánh | Địa chỉ |
|---|---|---|
| Bản chính | `TuLee116/Project-Profit-BKS-TMN` · `main` | https://bks.up.railway.app |
| Thử nghiệm | cùng repo · `staging` | https://bks-staging.up.railway.app (APP_ENV=staging, Postgres riêng) |
| Hệ thống khác | `TuLee116/Bao-Cao-DT-CP-BKS-TMN` (T&T Helio, điện mặt trời, đơn vị triệu đồng) | https://bks-tmn-report.up.railway.app |

- Stack: Node/Express + PostgreSQL (`lib/db.js`), giao diện JS thuần (`public/app.js`, `public/report.js`, `public/common.js`, `public/style.css`, `views/index.html`).
- Quy trình: sửa trên `staging` → người dùng nói **"chuyển qua chính" / "sync staging → main"** thì fast-forward `main`. Giữ 2 nhánh đồng bộ.
- Phiên bản: `node scripts/bump-version.js` trước mỗi lần phát hành (dạng `Vlần.dd.mm.yy`, giờ VN).
- Kiểm thử: `node scripts/tester.js <url> <user> <pass>` (~4.500 kiểm tra).
- Commit kết thúc bằng dòng `Co-Authored-By` theo hướng dẫn phiên.

## 2. Người dùng & cách làm việc
- PMP / QS / Ban Kiểm soát, không lập trình. Trả lời **tiếng Việt, ngắn, đúng số liệu**.
- **Tiết kiệm credit**: không rà soát/chụp màn hình thừa, không theo dõi chạy nền, báo kết quả ngắn. Chỉ chạy khi người dùng bảo.
- **Không tự lấy ảnh từ Internet** (đã có sự cố ảnh không phù hợp – người dùng cấm).
- Tài khoản dùng để thao tác: `claude` (quyền Nhập liệu) và `test1` – mật khẩu người dùng cung cấp trong chat, **không ghi vào file**. Đã khuyên khóa/đổi sau khi dùng.

## 3. Tính năng đã có (tóm tắt)
- Bảo mật: header CSP/HSTS, giới hạn tần suất **600 yêu cầu/phút, 120 lệnh ghi/phút → chặn IP 10 phút**, khóa đăng nhập sai, kiểm tra Origin (`lib/security.js`).
- Trực tuyến theo phiên, tự đăng xuất khi không thao tác 60 phút.
- Nhật ký hoạt động cho quản trị (trước → sau), nén Brotli nhật ký > 7 ngày (`lib/audit.js`).
- Doanh thu / Chi phí: nhóm **"Vay và trả nợ ngân hàng"** có *Nhận tiền vay – giải ngân* (tiền vào), *Trả nợ gốc* (không tính CP), *Lãi vay*. Nhóm lương, ngoại giao, phí tài chính, phạt: không chịu VAT.
- Báo cáo: lưới ô công trình kèm ảnh; khung tổng quan nhanh 6 tab. Tab DT/CP/LN chỉ 2 lớp **Kế hoạch (theo HĐ)** và **Thực (tiền thật, sau VAT)**; số "thực hiện" ẩn sau nút *Thực hiện đến hiện tại*.
- Mục **Thực thu – Thực chi – Còn lại thực**: Còn lại thực = thực thu − thực chi (không gồm vay / trả gốc); bấm số xem chi tiết.
- **TĐ1–TĐ3** (ban đầu / có phát sinh / quyết toán): số kế hoạch nhập tay, đối chiếu HT (DT theo HĐ gốc / HĐ+PL / QT; CP = thầu phụ cùng mốc + chi phí khác có ngày ≤ ngày chốt). Nút *So với thực tế* hiện tiền thật đến ngày chốt.
- Ngày bắt đầu / kết thúc công trình: trống = tự lấy ngày ký HĐ đầu tiên / ngày quyết toán (công trình Hoàn thành mà còn HĐ chưa QT → "nghiệm thu cuối"); 1 nút **✎ Sửa ngày** (`PUT /api/du-an/:id/ngay`).
- Xuất: **Excel** (11 trang, định dạng mẫu TMN qua ExcelJS phía trình duyệt), **Excel mẫu TMN** (bảng DT–CP trình ký, `lib/export-dtcp.js`, `GET /api/bao-cao/dtcp.xlsx`), PowerPoint, In/PDF.
- Dữ liệu mẫu 12 dự án DEMO (`lib/demo.js`, seed mặc định 22): 0 cảnh báo, 12/12 có lãi, VAT 10% (nhân công 8%), ảnh minh họa tự vẽ `lib/assets/demo/`.
- **Giao diện điện thoại** (commit `3401ea3`, V01.22.10.26): bảng → thẻ (≤ 900px), menu lưới 4×2, danh sách trước form; máy tính và bản in giữ nguyên.

## 4. Trạng thái hiện tại (23/10/2026)
- GitHub: `staging` = `main` (V01.23.10.26, có giao diện điện thoại) – đã sync 23/10/2026.
- Railway: sự cố đã cho build lại mọi gói. Việc người dùng tự làm trên Railway: đổi mật khẩu Postgres (production + staging), xóa `SETUP_TOKEN`, kiểm tra kết nối GitHub (Settings → Source), Redeploy nếu site không tự lên bản mới.
  - Tài khoản Railway là **Trial** → cần nâng gói Hobby trước khi chạy số liệu thật.
- **Nhập liệu thật trên bản chính (tài khoản `claude`) – ĐÃ XONG 3 dự án** (23/10/2026):
  - DA-2026-01 (id 27) đủ. Lỗi còn lại: tạm ứng TP-02…TP-05 ngày 20/03/2025 trước ngày ký HĐTP (HĐ đã quyết toán, bị khóa).
  - DA-2026-02 (id 28): nhập bổ sung (không xóa) điện nước T8–13, lương T9–13, vay BIDV; sửa ngày tạm ứng TP-07/08/09.
  - DA-2026-03 (id 29): nhập mới đủ theo mục 5 (tên đối tác/ngày do Claude đặt – chờ người dùng xác nhận).
  - Quy tắc: số tròn, mỗi HĐ thầu phụ ≤ 5 tỷ, mỗi dự án ≤ 30 tỷ; ghi chậm (~0,8 s/lệnh, < 120 lệnh/phút). API cần header `X-Requested-With: fetch` + `Origin`.

## 5. Số liệu 3 dự án (để nhập lại nếu cần), đơn vị triệu đồng
- **DA-2026-02** – CĐT Ban QLDA ĐTXD quận Cẩm Lệ, HĐ `05/2025/HĐTC-TMN` 18.000 (05/09/2025), PL01 +1.500 (10/02/2026); NT đợt 1–3 mỗi đợt 4.000 (20/12/2025, 20/04/2026, 20/08/2026); tiền về TƯ 2.000, đợt 1 3.500, đợt 2 3.500, đợt 3 3.000. Thầu phụ: Phần thô 4.000 (XD Hòa Khánh), Cửa – nhôm kính 3.000 (Nhôm kính Đà Thành), Điện nước 2.500 (ME Miền Trung), Sân trường 1.500 (Cảnh quan Xanh); trả TƯ 10% + 1 đợt 40% (sau VAT). Chi phí vật tư (Hợp Nhân 900…), nhân công, máy, lán trại, bảo lãnh 40; lương BCH 50/tháng; vay 2.000, trả gốc 1.000 + lãi 20.
- **DA-2026-03** – CĐT Cty CP Đầu tư Biển Mỹ Khê, HĐ `03/2026/HĐTC-TMN` 28.000 (10/05/2026); NT đợt 1 3.000 (25/08/2026); tiền về TƯ 4.000, đợt 1 2.500. Thầu phụ: Cọc – móng 5.000, BTCT thân 5.000, MEP 3.500, Mặt dựng kính 2.500; trả TƯ 10% (+ đợt 20% cho 2 HĐ đầu). Chi phí vật tư (Hợp Nhân 600), thí nghiệm cọc 60, cẩu tháp 250, lán trại 200, bảo lãnh 60; lương BCH 70/tháng; vay 3.000.
- VAT: HĐ và thầu phụ 10%, vật tư 10%, nhân công 8%; TĐ nhập theo số HT tại ngày chốt.
