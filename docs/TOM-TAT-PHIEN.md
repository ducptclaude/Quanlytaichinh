# Tóm tắt phiên làm việc

> Tệp này ghi lại tình trạng dự án sau mỗi phiên, để phiên sau (dev / revi) nắm nhanh. Mục mới nhất ở trên cùng.

## Tình trạng hiện tại
- **Phiên bản:** V1.06.11.2026 — nhánh `staging` (bản thử). Nhánh `main` (bản chính) **chưa tạo**.
- **Mã nguồn:** https://github.com/ducptclaude/Quanlytaichinh (nhánh `staging`).
- **Chạy tại:** Railway, dự án `lavish-essence`, môi trường `production`, đang lấy mã từ nhánh `staging`
  → địa chỉ https://quanlytaichinh-production.up.railway.app (đang hiện dải đỏ THỬ NGHIỆM vì chạy mã nhánh staging).
- **Kho dữ liệu:** PostgreSQL trên Railway (đã Online).

## Chức năng đã có
| Chức năng | Ghi chú |
|---|---|
| Khởi tạo lần đầu (`/setup`) | Tên công ty, tên hệ thống, dòng bản quyền, tài khoản Quản trị; xong tự khóa; có mã `SETUP_TOKEN` |
| Đăng nhập / Đăng xuất | Sai 5 lần / 15 phút → tạm khóa 15 phút; một máy sai 20 lần cũng bị khóa |
| Mật khẩu mạnh | ≥ 8 ký tự, hoa, thường, số, ký tự đặc biệt |
| Quản lý tài khoản (`/tai-khoan`, chỉ Quản trị) | Tạo / sửa / khóa / mở khóa / xóa / đặt lại mật khẩu; luôn còn ≥ 1 Quản trị; không tự khóa, tự xóa, tự hạ quyền |
| Cá nhân (`/ca-nhan`) | Xem thông tin, đổi mật khẩu; bắt buộc đổi nếu Quản trị vừa đặt lại |
| Liên hệ (`/lien-he`) | SĐT, email, người phụ trách hỗ trợ (Quản trị sửa); hiện số phiên bản |
| Kiểm tra (`/health`) | Phiên bản, môi trường (staging/production), kết nối kho dữ liệu |
| Chạy tạm khi chưa có kho dữ liệu | Thanh vàng cảnh báo |
| Bản thử | Dải đỏ "HỆ THỐNG THỬ NGHIỆM" |
| Dự án (`/du-an`) | Mã*, Tên*, Chủ đầu tư, Địa điểm, Nhóm, Giá trị HĐ, Ngày khởi công/hoàn thành, Trạng thái*, Ghi chú |
| Doanh thu (`/doanh-thu`) | Số CT* (tự đề xuất DT-0001), Dự án*, Ngày*, Số hóa đơn, Nội dung*, Hình thức, Tiền chưa VAT*, Tiền VAT (nhập tay), Tổng sau VAT (tự tính), Ghi chú |
| Chi phí (`/chi-phi`) | Số phiếu chi* (tự đề xuất CP-0001), Dự án*, Ngày*, **Khoản mục*** (3 nhóm, 12 khoản), Nội dung*, Nhà cung cấp, Số hóa đơn, Tiền chưa VAT*, Tiền VAT, Tổng sau VAT, Ghi chú |
| Báo cáo (`/bao-cao`) | Theo dự án, tiền chưa VAT: DT, (1) CP trực tiếp, Lãi gộp, (2) CP gián tiếp, (3) CP tài chính, Lợi nhuận, tỷ suất, % Thu/HĐ; bảng chi phí theo khoản mục |
| Chung cho danh mục | Mã không trùng (không phân biệt hoa/thường), tìm không dấu, sắp xếp tự nhiên (DA-2 < DA-10), lọc, phân trang 50, xuất Excel (.xlsx), ghi người tạo / người cập nhật cuối |

Vai trò hiện có: **Quản trị**, **Người dùng**.

## Việc đang chờ người dùng quyết
1. Nói **"chuyển qua chính"** để tạo nhánh `main`, rồi tách Railway thành 2 môi trường: `production` ← `main`, `staging` ← `staging` (hướng dẫn đã gửi trong phiên 05/11).
2. Logo (file PNG); có cần thêm vai trò khác (VD: Chỉ xem, Kế toán, Duyệt) không.
3. Danh sách ô chính thức cho Dự án / Doanh thu (Chi phí đã chốt 3 nhóm / 12 khoản mục).
4. Quyền: hiện mọi người xem/thêm/sửa, chỉ Quản trị xóa – có cần giới hạn thêm?
5. Giữ hay bỏ quy tắc chặn **Tiền VAT ≤ 10% tiền chưa VAT**.
6. Doanh thu nhập trước V6 được coi là **chưa VAT** (VAT = 0) – nếu từng nhập số có VAT thì cần sửa lại.
7. Chi phí cũ "Chưa phân loại" (từ loại "Chi phí chung"/"Khác") – vào Báo cáo → "Xem và phân loại lại".

## Việc dở dang (chuyển sang phiên sau)
- **Revi nhập dữ liệu thử 4 dự án (< 10 tỷ/dự án, ~30 lần lưu) trên web Railway** bằng tài khoản `revi`: CHƯA làm được
  vì môi trường làm việc chặn truy cập `quanlytaichinh-production.up.railway.app`.
  → Người dùng thêm tên miền này vào **Allowed domains** của môi trường (Edit → Network access), mở **phiên mới**, gửi lại yêu cầu
  kèm mật khẩu. KHÔNG ghi mật khẩu vào tệp. Sau khi nhập xong: đổi mật khẩu tài khoản `revi` (đã lộ trong khung chat).
- Kế hoạch nhập: 4 dự án đủ 3 trạng thái, giá trị HĐ 3 – 9,5 tỷ; 1–2 khoản doanh thu/dự án (VAT 8% và 10%);
  4–6 khoản chi phí/dự án phủ đủ 3 nhóm (có 1 khoản lãi vay, 1 khoản phạt); đăng nhập 1 lần; xong thì đối chiếu báo cáo với tính tay.

## Khoản mục chi phí (mã lưu trong kho – KHÔNG đổi mã đã dùng)
| Nhóm | Mã – Khoản mục |
|---|---|
| 1. Trực tiếp | TT01 Vật tư chính · TT02 Vật tư phụ · TT03 Máy móc thiết bị · TT04 Nhân công (thợ trực tiếp) · TT05 Thầu phụ |
| 2. Gián tiếp | GT01 Tiện ích phục vụ thi công · GT02 Lương (BCH, gián tiếp) · GT03 Thưởng · GT04 Ngoại giao |
| 3. Tài chính | TC01 Chi phí tài chính · TC02 Lãi vay ngân hàng (chỉ phần lãi) · TC03 Đóng phạt chủ đầu tư |

## Nhật ký
### Phiên 05–06/11/2026 — tổng hợp
- Từ kho GitHub trống → hệ thống chạy trên Railway (PostgreSQL), 6 lần cập nhật V1 → V6.05.11.2026, tất cả trên nhánh `staging`.
- Người dùng chốt: menu nằm trên thanh màu; Chi phí 3 nhóm / 12 khoản mục; 3 cột tiền (chưa VAT / VAT nhập tay / sau VAT);
  lãi vay chỉ nhập phần lãi; chi phí bắt buộc gắn dự án; bỏ tab Nhập hằng ngày (giữ dữ liệu cũ); báo cáo tính trên tiền chưa VAT.
- Rà soát (Revi) mục Chi phí: phát hiện trùng số chứng từ giữa nhà cung cấp, nguy cơ tính trùng, thiếu VAT → đã xử lý ở V6.
- Kiểm tra cuối phiên: 22/22 bài thử tự động đạt (bộ nhớ tạm + PostgreSQL); đã thử nâng cấp từ dữ liệu bản cũ, không mất dữ liệu.
- Lỗi gặp và đã xử lý: menu che tab ở màn hình hẹp; bảng báo cáo che cột; tên kiểu bảng nhập trùng ô thống kê trang chủ;
  ô ngày hiện mm/dd/yyyy trên máy tiếng Anh (chuyển hết sang dd/mm/yyyy); lời nhắc xóa dự án sai sau khi bỏ tab.
- Lưu ý kỹ thuật cho phiên sau: Railway tự cập nhật khi đẩy lên `staging`; bảng `daily_entries` và cột `costs.cost_type` là dữ liệu cũ, KHÔNG xóa.

### V6.05.11.2026 — Chi phí 3 nhóm, VAT, bỏ tab Nhập hằng ngày
- Quyết định của người dùng: lãi vay chỉ nhập phần lãi (có lời nhắc); 3 cột tiền chưa VAT / VAT nhập tay / sau VAT;
  chi phí bắt buộc gắn dự án; bỏ tab Nhập hằng ngày; Lương/Thưởng nhóm Gián tiếp chỉ cho bộ máy gián tiếp.
- Báo cáo tính trên tiền CHƯA VAT; thêm Lãi gộp; bảng chi phí theo khoản mục.
- Tiền VAT không được vượt 10% tiền chưa VAT (chặn gõ thừa số 0).
- Số phiếu tự đề xuất; thêm ô Số hóa đơn (được trùng); gợi ý khi gõ Nội dung, Nhà cung cấp, Chủ đầu tư.
- Chuyển dữ liệu cũ: Vật tư→TT01, Máy thi công→TT03, Nhân công→TT04, Thầu phụ→TT05; "Chi phí chung"/"Khác"/trống
  → Chưa phân loại (báo cáo cảnh báo). VAT cũ = 0. Cột cũ `cost_type` và bảng `daily_entries` GIỮ NGUYÊN.
- Dự án còn dữ liệu Nhập hằng ngày cũ không xóa được.

### V5.05.11.2026 — Nhập hằng ngày
- Bảng nhập trực tiếp theo dự án (`src/routes/daily.js`, `public/grid.js`), cấu hình ở `src/entities.js` → `DAILY`.
- Bảng mới `daily_entries` (chỉ thêm). Số lượng NUMERIC(18,3), kiểu VN (dấu phẩy = số lẻ; "12.5" bị từ chối để tránh nhầm).
- Thành tiền = SL × ĐG tính bằng số nguyên lớn, làm tròn đến đồng (từ 0,5 lên).
- Quy tắc mặc định: ngày bắt buộc, không sau hôm nay, không trước 01/01/2000; nội dung, số lượng (> 0), đơn giá (≥ 0) bắt buộc.
- Chống ghi đè: 2 người sửa cùng 1 dòng → người lưu sau được báo, hiện số liệu mới nhất.
- Mọi ô ngày (cả Dự án / Doanh thu / Chi phí / Báo cáo) chuyển sang dd/mm/yyyy, gõ tắt "5" hoặc "5/3".
- Dự án đang có dòng nhập hằng ngày không xóa được.
- Bài thử: 29 bài, đạt cả bộ nhớ tạm và PostgreSQL; thử thao tác bàn phím thật trên máy tính + điện thoại.

### V4.05.11.2026 — Danh mục chính: Dự án, Doanh thu, Chi phí, Báo cáo
- Cấu hình ô tập trung ở `src/entities.js`; kho dữ liệu tự THÊM bảng/cột (không xóa). Đã thử nâng cấp kho cũ: giữ nguyên dữ liệu.
- Số tiền lưu số nguyên (đồng), ô nhập tự thêm dấu chấm; ngày lưu YYYY-MM-DD.
- Xóa: chỉ Quản trị; không xóa được dự án đang có doanh thu/chi phí.
- Báo cáo: LN = DT − CP; Tỷ suất = LN ÷ DT; % Thu/HĐ = DT ÷ Giá trị HĐ (làm tròn 1 chữ số thập phân khi hiển thị).
- Xuất Excel tự viết (không thư viện): số tiền là số thật, có hàng tổng, cố định dòng tiêu đề, bộ lọc, in A4 ngang.
- Bài thử: 22 bài, đạt cả bộ nhớ tạm và PostgreSQL (mỗi bộ thử dùng ngăn dữ liệu riêng, tự dọn).

### V3.05.11.2026 — Đưa menu lên thanh trên
- 4 tab (Trang chủ / Tài khoản / Cá nhân / Liên hệ) nằm trong thanh màu trên cùng, giữa tên hệ thống và tên người dùng.
- Màn hình hẹp: menu xuống dòng 2 nhưng vẫn trong thanh màu (V4 nâng ngưỡng lên ≤ 1440px khi menu có 8 mục).
- Đã kiểm tra 1366 / 1180 / 1024 / 768px, iPhone 13, iPhone SE: đủ 4 tab, không tràn ngang.

### V2.05.11.2026 — Tài khoản, phiên bản, bản thử
- Thêm quản lý tài khoản, tab Cá nhân, tab Liên hệ, số phiên bản tự động, dải đỏ bản thử.
- Thêm cột `must_change_password`, `updated_at` vào bảng `users` (chỉ thêm, không mất dữ liệu cũ — đã thử nâng cấp kho cũ).
- Thêm bộ chạy thử tự động `npm test` (13 bài, đạt cả bộ nhớ tạm và PostgreSQL).
- Thêm `CLAUDE.md` + 2 vai `dev`, `revi` (`.claude/agents/`).

### V1.05.11.2026 (0.1.1) — Khởi tạo web
- Khung web, trang khởi tạo, đăng nhập, `/health`, chế độ chạy tạm, giao diện Navy → Teal, font Montserrat.
