# Tóm tắt phiên làm việc

> Tệp này ghi lại tình trạng dự án sau mỗi phiên, để phiên sau (dev / revi) nắm nhanh. Mục mới nhất ở trên cùng.

## Tình trạng hiện tại
- **Phiên bản:** V5.05.11.2026 — nhánh `staging` (bản thử). Nhánh `main` (bản chính) **chưa tạo**.
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
| Doanh thu (`/doanh-thu`) | Số CT*, Dự án*, Ngày*, Nội dung*, Hình thức, Số tiền*, Ghi chú |
| Chi phí (`/chi-phi`) | Số CT*, Dự án*, Ngày*, Nội dung*, Loại chi phí, Nhà cung cấp, Số tiền*, Ghi chú |
| Báo cáo (`/bao-cao`) | DT, CP, LN, Tỷ suất LN, % Thu/HĐ theo dự án; lọc trạng thái, khoảng ngày |
| Nhập hằng ngày (`/nhap-hang-ngay`) | Theo từng Dự án; mỗi dòng: Ngày* (dd/mm/yyyy), Số CT, Nội dung*, ĐVT, Số lượng*, Đơn giá*, Thành tiền (= SL × ĐG, tự tính), Ghi chú; sửa trực tiếp trên bảng, Enter để lưu, gợi ý nội dung (tự điền ĐVT + đơn giá gần nhất), dòng tổng, xuất Excel |
| Chung cho danh mục | Mã không trùng (không phân biệt hoa/thường), tìm không dấu, sắp xếp tự nhiên (DA-2 < DA-10), lọc, phân trang 50, xuất Excel (.xlsx), ghi người tạo / người cập nhật cuối |

Vai trò hiện có: **Quản trị**, **Người dùng**.

## Việc đang chờ người dùng quyết
- Nói **"chuyển qua chính"** để tạo nhánh `main`, rồi tách Railway thành 2 môi trường: `production` ← `main`, `staging` ← `staging`.
- Logo (file PNG), có cần thêm vai trò khác (VD: Chỉ xem, Kế toán, Duyệt) không.
- Danh sách ô chính thức cho Dự án / Doanh thu / Chi phí (hiện là bộ ô mặc định – sửa ở `src/entities.js`).
- Quyền: hiện mọi người xem/thêm/sửa, chỉ Quản trị xóa – có cần giới hạn thêm?
- Nhập hằng ngày: tên nghiệp vụ, danh sách ô, quy tắc ràng buộc chính thức; có cộng vào Chi phí / Báo cáo không (hiện: CHƯA cộng).

## Nhật ký
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
- Màn hình ≤ 1100px (laptop nhỏ, máy tính bảng, điện thoại): menu xuống dòng 2 nhưng vẫn trong thanh màu.
- Đã kiểm tra 1366 / 1180 / 1024 / 768px, iPhone 13, iPhone SE: đủ 4 tab, không tràn ngang.

### V2.05.11.2026 — Tài khoản, phiên bản, bản thử
- Thêm quản lý tài khoản, tab Cá nhân, tab Liên hệ, số phiên bản tự động, dải đỏ bản thử.
- Thêm cột `must_change_password`, `updated_at` vào bảng `users` (chỉ thêm, không mất dữ liệu cũ — đã thử nâng cấp kho cũ).
- Thêm bộ chạy thử tự động `npm test` (13 bài, đạt cả bộ nhớ tạm và PostgreSQL).
- Thêm `CLAUDE.md` + 2 vai `dev`, `revi` (`.claude/agents/`).

### V1.05.11.2026 (0.1.1) — Khởi tạo web
- Khung web, trang khởi tạo, đăng nhập, `/health`, chế độ chạy tạm, giao diện Navy → Teal, font Montserrat.
