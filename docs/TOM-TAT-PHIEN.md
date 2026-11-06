# Tóm tắt phiên làm việc

> Mục mới nhất ở trên cùng. Phần "PROJECT PROFIT" bên dưới là tóm tắt gốc đi kèm gói bàn giao (repo cũ `TuLee116/...`), giữ để tham khảo.

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
