# Quy ước làm việc của dự án – Hệ thống BKS (Quản lý hiệu quả dự án)

Người dùng là quản lý dự án xây dựng / tài chính / Ban Kiểm soát, **không biết lập trình**.

## Giao tiếp
- **Tiết kiệm token:** không đọc / chụp / quét thừa, báo ngắn; chỉ kiểm tra đủ phần bị ảnh hưởng.
- Luôn trả lời **tiếng Việt**, ngắn gọn, thẳng vấn đề, **không dùng thuật ngữ IT** khi báo cáo.
- Cuối mỗi yêu cầu báo **3 ý**: *Đã làm gì* / *Đã kiểm tra gì* / *Việc cần tôi quyết*.
- Không nhắc lại việc đổi mật khẩu tài khoản thử (người dùng đã yêu cầu).
- Không tự lấy ảnh từ Internet.

## Hai vai (người dùng ghi ở đầu tin nhắn)
- **`Dev:`** → sửa mã theo quy trình dưới. Chi tiết: `.claude/agents/dev.md`.
- **`Revi:`** → chỉ rà soát, không sửa tệp, không lưu GitHub. Chi tiết: `.claude/agents/revi.md`.

## Nhánh
- Chỉ làm trên **`staging`**. Chỉ khi người dùng nói **"chuyển qua chính"** mới đưa lên **`main`**.
- Nhánh `backup-qltc-V3.06.11.2026` = mã hệ thống cũ "Quản lý tài chính" (V3.06.11.2026). KHÔNG xóa.

## Quy trình mỗi yêu cầu (vai dev)
1. Làm thay đổi.
2. Tăng phiên bản: `node scripts/bump-version.js` (dạng `Vlần.dd.mm.yy`, giờ Việt Nam, lưu `version.json`).
3. Chạy thử: `npm start` (không có DATABASE_URL = bộ nhớ tạm), Quản trị → Cài đặt → Tạo dữ liệu mẫu,
   rồi đối chiếu số liệu: `node scripts/tester.js <url> <tài khoản> <mật khẩu>` (~4.500 kiểm tra, phải 0 LỖI).
   Chụp màn hình máy tính (1366px) + điện thoại (iPhone 13) các trang bị ảnh hưởng, kiểm tra không tràn ngang.
4. Lưu lên GitHub nhánh `staging` (Railway tự cập nhật).
5. Cập nhật `docs/TOM-TAT-PHIEN.md`.
   **Chốt ngày:** lần lưu cuối mỗi ngày (hoặc đầu phiên nếu ngày trước chưa chốt) đẩy thêm nhánh chốt
   `git push -f origin HEAD:refs/heads/chot-dd.mm.yy` (nhãn tag bị chặn trong môi trường này → dùng nhánh) và cập nhật 1 dòng ở `docs/PHIEN-BAN-LUU.md`.
   KHÔNG xóa nhánh `chot-*`.
6. Báo 3 ý.

## Điểm khôi phục & quay lại (người dùng có thể làm sai, cần quay về phiên trước)
- **Đầu mỗi phiên, TRƯỚC lần sửa đầu tiên:** đẩy điểm khôi phục `git push origin HEAD:refs/heads/phien-dd.mm.yy-HHhMM`
  (giờ VN, trỏ vào bản đang chạy) + thêm 1 dòng ở `docs/PHIEN-BAN-LUU.md`. Phiên chỉ hỏi/rà soát, không sửa thì không cần.
- Mỗi lần lưu đều có mã phiên bản (`Vlần.dd.mm.yy`) ở đầu dòng mô tả → quay về được từng lần sửa, không chỉ từng phiên.
- Người dùng nhắn **"quay về bản <tên điểm / mã phiên bản>"** → làm:
  1. Đẩy điểm khôi phục của bản hiện tại (`phien-...`) để có thể quay ngược lại nếu đổi ý.
  2. Đưa mã về đúng bản cũ bằng 1 lần lưu MỚI (`git checkout <bản> -- . && git commit`) – không xóa lịch sử, không `reset --hard`/`push -f` lên `staging`.
  3. Tăng phiên bản, lưu `staging` (Railway tự chạy lại), báo 3 ý.
- **Lưu ý báo người dùng:** quay về chỉ đổi MÃ (giao diện, công thức); **dữ liệu đã nhập không quay lại** (kho dữ liệu chỉ thêm, bản cũ vẫn đọc được).
  Nếu cần bỏ dữ liệu nhập sai → sửa / xóa trên web, hoặc báo để Claude hỗ trợ riêng.
- KHÔNG xóa nhánh `phien-*`, `chot-*`, `backup-*`.

## Lỗi
- **Lỗi lớn** (dữ liệu, công thức tiền, phân quyền, cấu trúc kho dữ liệu): **dừng lại, báo người dùng trước**.
- **Lỗi nhỏ**: tự sửa và báo lại.

## An toàn dữ liệu
- Không lưu mật khẩu / khóa bí mật vào tệp.
- **Kho dữ liệu Railway dùng chung với hệ thống cũ.** BKS chỉ dùng ngăn (schema) `bks` – biến `DB_SCHEMA`, mặc định `bks`
  (`lib/db.js`). Dữ liệu cũ nằm ở ngăn `public` (users, sessions, settings, projects, revenues, costs, daily_entries) – KHÔNG đụng, KHÔNG xóa.
- Thay đổi cấu trúc chỉ THÊM (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), không DROP / đổi tên cột đang dùng.
- Ghi qua API cần header `X-Requested-With: fetch` + `Origin`; giới hạn 120 lệnh ghi/phút (quá thì bị chặn IP 10 phút) → ghi chậm.

## Kỹ thuật (tóm tắt) – chi tiết xem `README.md`, `ban-giao/HUONG-DAN-BUILD.md`
- Node.js ≥ 18 + Express 4 + PostgreSQL (`pg`) + ExcelJS. Giao diện HTML/JS thuần (`views/`, `public/`).
- `server.js` (API) · `lib/db.js` (lưu trữ) · `lib/dashboard.js`, `lib/report.js` (công thức báo cáo) · `lib/demo.js` (dữ liệu mẫu DEMO-xx)
  · `lib/security.js` (CSP, giới hạn tần suất) · `lib/audit.js` (nhật ký).
- Bản thử: đặt biến `APP_ENV=staging` trên Railway để hiện nhãn thử nghiệm.
