# Quy ước làm việc của dự án

Người dùng là quản lý dự án xây dựng / tài chính, **không biết lập trình**.

## Giao tiếp
- Luôn trả lời **tiếng Việt**, ngắn gọn, thẳng vấn đề, **không dùng thuật ngữ IT** khi báo cáo.
- Cuối mỗi yêu cầu báo **3 ý**: *Đã làm gì* / *Đã kiểm tra gì* / *Việc cần tôi quyết*.

## Hai vai (người dùng ghi ở đầu tin nhắn)
- **`Dev:`** → vai **dev**: được sửa mã, làm theo quy trình bên dưới. Chi tiết: `.claude/agents/dev.md`.
- **`Revi:`** → vai **revi**: chỉ **rà soát**, **không sửa** bất kỳ tệp nào, không lưu lên GitHub. Chi tiết: `.claude/agents/revi.md`.

## Nhánh
- Chỉ làm trên **`staging`** (bản thử).
- Chỉ khi người dùng nói **"chuyển qua chính"** mới đưa lên **`main`** (bản chính).

## Quy trình mỗi yêu cầu (vai dev)
1. Làm thay đổi.
2. Tăng phiên bản: `npm run bump` (dạng `V[lần trong ngày].[ngày].[tháng].[năm]`, giờ Việt Nam, lưu ở `version.json`).
3. Tự chạy thử: `npm test` (chế độ bộ nhớ tạm) và, nếu có PostgreSQL, `TEST_DATABASE_URL=... npm test`.
   Chụp màn hình máy tính (1366px) + điện thoại (iPhone 13) các trang bị ảnh hưởng, kiểm tra không tràn ngang.
4. Lưu lên GitHub nhánh `staging`.
5. Cập nhật `docs/TOM-TAT-PHIEN.md`.
6. Báo 3 ý.

## Lỗi
- **Lỗi lớn** (ảnh hưởng dữ liệu, công thức tiền, phân quyền): **dừng lại, báo người dùng trước**.
- **Lỗi nhỏ**: tự sửa và báo lại.

## An toàn
- Không lưu mật khẩu / khóa bí mật vào tệp (dùng biến môi trường trên Railway).
- Không xóa dữ liệu thật khi thay đổi cấu trúc: chỉ `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`; không `DROP`, không đổi tên cột đang dùng.

## Kỹ thuật (tóm tắt)
- Node.js ≥ 20 + Express 4 + PostgreSQL (`pg`). Ít thư viện, không khung giao diện.
- `server.js` (luồng chính) · `src/db.js` (lưu trữ: PostgreSQL hoặc bộ nhớ tạm) · `src/auth.js` (mật khẩu, chặn đăng nhập sai)
  · `src/routes/*` (tài khoản, cá nhân, liên hệ) · `src/views/*` (giao diện HTML) · `public/` (CSS, JS trình duyệt)
- Danh mục (Dự án / Doanh thu / Chi phí): cấu hình ô ở `src/entities.js`, xử lý chung `src/routes/entities.js`,
  lưu trữ `src/db-entities.js`. Đổi KIỂU của ô đã có dữ liệu = thay đổi lớn → báo người dùng trước.
- Tiền: số nguyên đồng (BIGINT), không dùng số thập phân. Công thức báo cáo ở `src/routes/reports.js` (đầu tệp).
- Xuất Excel: `src/xlsx.js` (tự viết, không thư viện).
- Router dùng `src/router.js` (bắt lỗi async). Mọi nội dung đưa vào HTML phải qua `esc()`.
- Bản thử: `APP_ENV=staging` hoặc Railway tự nhận theo tên môi trường / nhánh → hiện dải đỏ "HỆ THỐNG THỬ NGHIỆM".
