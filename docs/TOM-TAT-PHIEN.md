# Tóm tắt phiên làm việc

> Tệp này ghi lại tình trạng dự án sau mỗi phiên, để phiên sau (dev / revi) nắm nhanh. Mục mới nhất ở trên cùng.

## Tình trạng hiện tại
- **Phiên bản:** V3.05.11.2026 — nhánh `staging` (bản thử). Nhánh `main` (bản chính) **chưa tạo**.
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

Vai trò hiện có: **Quản trị**, **Người dùng**.

## Việc đang chờ người dùng quyết
- Nói **"chuyển qua chính"** để tạo nhánh `main`, rồi tách Railway thành 2 môi trường: `production` ← `main`, `staging` ← `staging`.
- Logo (file PNG), có cần thêm vai trò khác (VD: Chỉ xem, Kế toán, Duyệt) không.
- Tên chức năng nghiệp vụ tiếp theo (dự án, hợp đồng, thu chi, ...).

## Nhật ký
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
