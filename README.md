# Hệ thống quản lý (khung ban đầu)

Công nghệ: Node.js + Express + PostgreSQL (chỉ 2 thư viện ngoài: `express`, `pg`).

## Chức năng hiện có
- **/setup**: khởi tạo lần đầu (tên công ty, tên hệ thống, dòng bản quyền, tài khoản Quản trị). Xong tự khóa.
- **/login**: đăng nhập. Sai 5 lần / 15 phút → tạm khóa 15 phút (một địa chỉ máy sai 20 lần cũng bị khóa).
- **/health**: kiểm tra tình trạng (phiên bản, kết nối kho dữ liệu).
- Mật khẩu: ≥ 8 ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt.
- Chưa có kho dữ liệu → vẫn chạy tạm trong bộ nhớ, hiện **thanh cảnh báo vàng**.
- **/tai-khoan** (Quản trị): tạo / sửa / khóa / xóa tài khoản, đặt lại mật khẩu. Luôn còn ≥ 1 Quản trị.
- **/ca-nhan**: đổi mật khẩu. **/lien-he**: thông tin hỗ trợ + số phiên bản.
- Bản thử nghiệm hiện **dải đỏ "HỆ THỐNG THỬ NGHIỆM"**.
- Phiên bản dạng `V[lần trong ngày].[ngày].[tháng].[năm]` — tăng bằng `npm run bump`.

- **Dự án / Doanh thu / Chi phí**: thêm / sửa / xóa, tìm không dấu, sắp xếp mã tự nhiên, lọc, xuất Excel, ghi người cập nhật cuối.
  Muốn thêm/bớt ô: sửa `src/entities.js`.
- **Nhập hằng ngày** theo dự án: bảng nhập trực tiếp, Enter để lưu, gợi ý nội dung, dòng tổng, xuất Excel.
- **Báo cáo**: doanh thu, chi phí, lợi nhuận, tỷ suất theo dự án; xuất Excel.

Tình trạng & nhật ký: xem `docs/TOM-TAT-PHIEN.md`. Quy ước làm việc: `CLAUDE.md`.

## Biến cấu hình (đặt trên Railway → Variables)
| Tên | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | Có (khi dùng thật) | Railway tự điền khi gắn PostgreSQL |
| `SETUP_TOKEN` | Khuyến nghị | Mã phải nhập ở trang khởi tạo, tránh người lạ khởi tạo trước |
| `APP_ENV` | Không | `staging` = bản thử (dải đỏ), `production` = bản chính. Không đặt thì tự nhận theo môi trường/nhánh Railway |
| `LOGO_URL` | Không | Đường dẫn logo, VD `/logo.png` (đặt file vào thư mục `public/`) |

## Cấu trúc
- `server.js` – các trang và luồng đăng nhập
- `src/db.js` – lưu trữ (PostgreSQL / bộ nhớ tạm). Chỉ tạo bảng nếu chưa có, không xóa dữ liệu
- `src/auth.js` – mã hóa mật khẩu, chặn tạm khi sai nhiều lần
- `src/routes/` – Quản lý tài khoản, Cá nhân, Liên hệ
- `src/views/` – giao diện
- `test/` – chạy thử tự động (`npm test`)
- `public/style.css` – màu sắc, font (đổi màu ở đầu file)

## Chạy trên máy
```
npm install
npm start
```
