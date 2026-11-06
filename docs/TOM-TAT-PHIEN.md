# Tóm tắt phiên làm việc

> Mục mới nhất ở trên cùng. Phần "PROJECT PROFIT" bên dưới là tóm tắt gốc đi kèm gói bàn giao (repo cũ `TuLee116/...`), giữ để tham khảo.

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
