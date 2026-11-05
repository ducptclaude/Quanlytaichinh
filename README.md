# Hệ thống quản lý (khung ban đầu)

Công nghệ: Node.js + Express + PostgreSQL (chỉ 2 thư viện ngoài: `express`, `pg`).

## Chức năng hiện có
- **/setup**: khởi tạo lần đầu (tên công ty, tên hệ thống, dòng bản quyền, tài khoản Quản trị). Xong tự khóa.
- **/login**: đăng nhập. Sai 5 lần / 15 phút → tạm khóa 15 phút (một địa chỉ máy sai 20 lần cũng bị khóa).
- **/health**: kiểm tra tình trạng (phiên bản, kết nối kho dữ liệu).
- Mật khẩu: ≥ 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt.
- Chưa có kho dữ liệu → vẫn chạy tạm trong bộ nhớ, hiện **thanh cảnh báo vàng**.

## Biến cấu hình (đặt trên Railway → Variables)
| Tên | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | Có (khi dùng thật) | Railway tự điền khi gắn PostgreSQL |
| `SETUP_TOKEN` | Khuyến nghị | Mã phải nhập ở trang khởi tạo, tránh người lạ khởi tạo trước |
| `LOGO_URL` | Không | Đường dẫn logo, VD `/logo.png` (đặt file vào thư mục `public/`) |

## Cấu trúc
- `server.js` – các trang và luồng đăng nhập
- `src/db.js` – lưu trữ (PostgreSQL / bộ nhớ tạm). Chỉ tạo bảng nếu chưa có, không xóa dữ liệu
- `src/auth.js` – mã hóa mật khẩu, chặn tạm khi sai nhiều lần
- `src/views.js` – giao diện
- `public/style.css` – màu sắc, font (đổi màu ở đầu file)

## Chạy trên máy
```
npm install
npm start
```
