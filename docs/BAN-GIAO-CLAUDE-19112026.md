# BÀN GIAO PHIÊN LÀM VIỆC – Hệ thống "Quản trị tài chính – MYMONEY" (mã nội bộ: BKS)

> Dành cho Claude (tài khoản mới) đọc **trước tiên** để tiếp tục làm việc liền mạch.
> Lập ngày **19/11/2026**, bản mã đang chạy: **V01.19.11.26** (commit `01c29ea`, lần lưu tài liệu sau đó `64b2d55`).
> Đọc kèm: `CLAUDE.md` (quy ước bắt buộc), `docs/TOM-TAT-PHIEN.md` (nhật ký từng phiên bản, mới nhất trên cùng),
> `docs/PHIEN-BAN-LUU.md` (các bản lưu để quay lại), `README.md`, `ban-giao/HUONG-DAN-BUILD.md`.

---

## 1. Người dùng & cách làm việc

- Vai trò: Quản lý dự án xây dựng (PMP), Ban Kiểm soát, Kỹ sư kinh tế xây dựng (QS), quản lý tài chính / đầu tư xây dựng.
  **Không biết lập trình**, biết Excel, Power BI, Canva, rất mạnh về số liệu.
- Luôn trả lời **tiếng Việt**, ngắn gọn, thẳng vấn đề, **không dùng thuật ngữ IT** khi báo cáo.
- Kết thúc mỗi yêu cầu bằng **3 ý**: *Đã làm gì* / *Đã kiểm tra gì* / *Việc cần tôi quyết*.
- Ưu tiên số liệu chính xác, đúng ý người dùng; đề xuất phương án tối ưu, tiết kiệm.
- **Lỗi lớn** (công thức tiền, dữ liệu, phân quyền, cấu trúc kho dữ liệu): **dừng lại, báo trước, chờ đồng ý** rồi mới sửa.
  Lỗi nhỏ: tự sửa, báo lại.
- Người dùng hay gửi **ảnh chụp màn hình khoanh đỏ** + 1 câu ngắn. Đọc kỹ ảnh, làm đúng chỗ khoanh.
- Hai vai ghi ở đầu tin nhắn: `Dev:` (sửa mã) · `Revi:` (chỉ rà soát, không sửa, không lưu GitHub). Không ghi gì: coi như Dev.
- Không nhắc lại việc đổi mật khẩu tài khoản thử. Không tự lấy ảnh từ Internet.
- Hỏi lại (tối đa vài câu, có phương án đề xuất) khi yêu cầu có nhiều cách hiểu ảnh hưởng tới công thức tiền.

## 2. Hệ thống

- Web quản lý hiệu quả tài chính dự án xây dựng: Dự án · Doanh thu (HĐ/PL với chủ đầu tư, HT/QT, tiền về) · Chi phí
  (HĐ đầu vào: thầu phụ / vật tư / MMTB / nhân công; gói chi phí; chi phí mua lẻ; khối B1 trực tiếp, B2 gián tiếp, B3 tài chính)
  · Báo cáo (mục I–IV, Dashboard, xuất Excel/PowerPoint/PDF) · Duyệt số liệu · Quản trị (tài khoản, nhật ký, cài đặt) · Hướng dẫn · Trợ lý.
- Tên hiển thị: **"Quản trị tài chính – MYMONEY"**; "BKS" chỉ là tên mã nội bộ.
- Công nghệ: Node.js ≥ 18, Express 4, PostgreSQL (`pg`), ExcelJS; giao diện HTML/CSS/JS thuần (`views/`, `public/`).
  - `server.js` API · `lib/db.js` lưu trữ (PostgreSQL + bộ nhớ tạm khi không có DATABASE_URL) · `lib/report.js` công thức báo cáo
  - `lib/validate.js` kiểm tra dữ liệu · `lib/audit.js` nhật ký · `lib/revenue.js`, `lib/subcontract.js`, `lib/cost.js`, `lib/dashboard.js`
  - `lib/demo.js` dữ liệu mẫu DEMO-01…12 · `lib/security.js` (CSP, giới hạn 120 lệnh ghi/phút/IP, quá thì chặn 10 phút)
  - `public/app.js` (nhập liệu), `public/report.js` (báo cáo), `public/common.js` (ô tiền, ngày, Passcode…), `public/style.css`,
    `public/i18n-en.js` (từ điển tiếng Anh – **thêm chữ giao diện mới phải thêm câu dịch**, thuật ngữ xem CLAUDE.md).
- Phiên bản: `node scripts/bump-version.js` -> `Vlần.dd.mm.yy` (giờ VN) ghi vào `version.json`; mỗi lần lưu ghi mã này đầu dòng mô tả.

## 3. GitHub

- Kho mã: **`ducptclaude/Quanlytaichinh`** (GitHub báo đã chuyển sang `https://github.com/ducptclaude/quanlytaichinh.git`).
- **`staging`** = nhánh làm việc duy nhất; Railway tự cập nhật khi lưu lên đây.
- **`main`: hiện CHƯA tồn tại trên GitHub.** Chỉ khi người dùng nói **"chuyển qua chính"** mới tạo / đưa lên `main`
  (hỏi người dùng service Railway nào theo dõi `main` trước khi làm).
- Các nhánh lưu **KHÔNG được xóa**:
  - `quanlytaichinh19112026` -> bản V01.19.11.26 (bản lưu theo yêu cầu để quay lại; có thêm tệp zip mã nguồn người dùng đã tải).
  - `quanlytaichinh06112026`, `quanlytaichinh06112026.ver1` (bản lưu của sếp), `qltc-tu061126`, `qltc-tu061126-rv1`, `nentoi1`,
    `backup-qltc-V3.06.11.2026` (mã hệ thống cũ), `xemtruoc-12.11.26`.
  - `chot-dd.mm.yy` (chốt cuối mỗi ngày; mới nhất `chot-19.11.26`), `phien-dd.mm.yy-HHhMM` (điểm khôi phục đầu mỗi phiên).
- Nhãn (tag) bị chặn trong môi trường này -> dùng nhánh.
- Lời ghi cuối mỗi lần lưu (commit) theo hướng dẫn hệ thống của phiên đó (Co-Authored-By …).
- **CẢNH BÁO – nhiều phiên song song:** người dùng từng mở 2 phiên Claude cùng sửa `staging` (phiên kia làm "gói chi phí",
  báo cáo theo HĐ, tab Hướng dẫn, phóng to màn hình V14.17…). Luôn `git fetch` + kiểm tra `HEAD..origin/staging` trước khi sửa và
  trước khi lưu; nếu bị từ chối thì gộp (rebase) chứ **không** đẩy đè. Không `push -f` lên `staging`. Đẩy nhánh `chot-*` bằng `-f`
  chỉ khi chắc đó là bản mới nhất trong ngày (đã từng lỡ ghi đè `chot-12.11.26` của phiên kia rồi phải trả lại).

## 4. Railway

- Bản đang dùng: **https://quanlytaichinh.up.railway.app** (theo dõi nhánh `staging`). Kiểm tra phiên bản: `GET /api/meta` -> `phien_ban.ma`.
  Sau mỗi lần lưu, chờ đến khi `/api/meta` trả đúng mã mới (thường 1–5 phút).
- Các tên miền khác thấy trong tài liệu (có thể là bản cũ / thử): `bks.up.railway.app`, `bks-staging.up.railway.app`, `bks-tmn-report.up.railway.app`.
- Biến môi trường mã đọc: `DATABASE_URL`, `DB_SCHEMA` (mặc định `bks`), `SETUP_TOKEN`, `APP_ENV` (`staging` hiện nhãn thử nghiệm),
  `PORT`, `RAILWAY_ENVIRONMENT`, `SESSION_IDLE_MIN`, `KHACH_PHUT`, `LOG_HOT_DAYS`. **Không ghi giá trị bí mật vào tệp.**
- **Kho dữ liệu Railway dùng chung với hệ thống cũ**: BKS chỉ dùng ngăn (schema) **`bks`**. Ngăn `public` (users, sessions, settings,
  projects, revenues, costs, daily_entries) là dữ liệu hệ thống cũ – **KHÔNG đụng, KHÔNG xóa**.
- Thay đổi cấu trúc **chỉ THÊM** (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), không DROP / đổi tên cột.
- Ghi qua API cần header `X-Requested-With: fetch` + `Origin`.

## 5. Dữ liệu hiện có trên hệ thống

- **Toàn bộ dữ liệu người dùng đã nhập nằm trong PostgreSQL trên Railway (ngăn `bks`).** Đổi tài khoản Claude **không làm mất dữ liệu**:
  Claude mới chỉ cần quyền vào cùng kho GitHub; Railway vẫn chạy với kho dữ liệu cũ.
- Phiên Claude trên đám mây **không vào được** kho dữ liệu thật (không có mật khẩu, mạng bị giới hạn) -> không sao chép được số liệu thật vào tệp này.
- Hệ thống **chưa có chức năng sao lưu toàn bộ dữ liệu** (chỉ có xuất Excel báo cáo `/api/bao-cao/dtcp.xlsx`).
  Cách giữ một bản dữ liệu (người dùng tự làm hoặc yêu cầu Claude mới làm):
  1. Railway → service **Postgres** → tab **Backups** → tạo bản sao lưu (nếu gói Railway hỗ trợ), hoặc
  2. Dùng `pg_dump` với `DATABASE_URL` (lấy ở Railway → Postgres → Variables), chỉ ngăn `bks`: `pg_dump "$DATABASE_URL" -n bks -Fc -f bks.dump`, hoặc
  3. Đề xuất làm thêm nút **Quản trị → Sao lưu dữ liệu** (xuất toàn bộ ngăn `bks` ra Excel/JSON) – **chưa làm, chờ người dùng đồng ý**.
- Quay về bản mã cũ chỉ đổi MÃ; **dữ liệu đã nhập không quay lại**.

## 6. Quy trình mỗi yêu cầu (vai Dev) – tóm tắt CLAUDE.md

1. Đầu phiên, trước lần sửa đầu tiên: `git push origin HEAD:refs/heads/phien-dd.mm.yy-HHhMM` + 1 dòng ở `docs/PHIEN-BAN-LUU.md`.
2. Sửa mã. 3. `node scripts/bump-version.js`.
4. Chạy thử: `npm start` (không DATABASE_URL = bộ nhớ tạm) -> tạo dữ liệu mẫu -> `node scripts/tester.js <url> <tài khoản> <mật khẩu>`
   (~4.500–4.600 kiểm tra, phải **0 LỖI**). Thay đổi gói / HĐ đầu vào / khóa: thêm `node scripts/kiem-tra-goi.js …` (211 kiểm tra, 0 LỖI).
   Chụp màn hình 1366px + iPhone 13, không tràn ngang.
5. Lưu `staging` -> chờ Railway chạy bản mới. 6. Cập nhật `docs/TOM-TAT-PHIEN.md` (thêm mục mới **trên cùng**).
7. Lần lưu cuối ngày: nhánh `chot-dd.mm.yy` + cập nhật dòng chốt ở `docs/PHIEN-BAN-LUU.md`. 8. Báo 3 ý.
- "Quay về bản X": đẩy điểm khôi phục hiện tại -> `git checkout X -- . && git commit` (1 lần lưu MỚI) -> tăng phiên bản -> lưu `staging`.

### Bài kiểm tra bổ sung (đã chép vào `scripts/kiem-tra-them/`)
Chạy với máy thử bộ nhớ tạm `PORT=3002 node server.js` (cần `npm install`; Playwright có sẵn trong môi trường Claude đám mây).
Mật khẩu KHÔNG nằm trong tệp: đặt biến trước khi chạy `export BKS_PASS='<mật khẩu admin máy thử>' BKS_PC='<Passcode 8 số máy thử>'`.
`seed.js` tạo admin + dữ liệu mẫu trên máy thử MỚI (dùng BKS_PASS). Chạy từng bài trên máy thử vừa khởi động lại để tránh giới hạn 120 lệnh ghi/phút.

| Tệp | Kiểm tra |
|---|---|
| `dcA.js` | Đợt A: 3 thời điểm độc lập mỗi HĐ/PL, đợt điều chỉnh, quyết toán (22) – tạo dự án DA-A cần cho `sweep.js` |
| `tdk.js` | Tab TĐ: TĐ3 có số = khoá văn bản, đủ hết = đóng HĐ, mở khoá Passcode, HĐ đầu vào, dự trù, duyệt (31) |
| `tdps.js` | Phụ lục HĐ đầu vào phát sinh tại TĐ1/2/3 (8) – tạo DA-PS |
| `cpps.js` | Chi phí không gắn HĐ phát sinh theo TĐ (5) |
| `cpk.js` | Chi phí khác nhập từ hộp HĐ (bản V03.18, nay thay bằng phụ lục "Chi phí khác") (7) |
| `dcvat.js` | VAT riêng từng đợt điều chỉnh (6) |
| `duyet.js` | Quy trình duyệt số liệu (28) |
| `sweep.js` | Quét 5 trang × 5 đơn vị tiền + hộp chi tiết: không lộ mã, không NaN, đổi đơn vị có cập nhật |
| `goall.js` | Gõ từng phím vào mọi ô tiền (lỗi cắt số V21.10 đã sửa) |
| `uiScreens.js` | Giao diện 24", 27", Mac 14"/16", Windows 125%, laptop 1366, iPhone 13 |
| `uiTD.js`, `uiDcForm.js` | Thao tác 3 tab TĐ, form điều chỉnh TĐ2 |
| `lamtron.js` | Ghi số tiền thật quy đổi trước VAT (so trước / sau) |

PostgreSQL thử trong môi trường đám mây: `pg_ctlcluster 16 main start` rồi
`DATABASE_URL=postgres://postgres:<mk>@127.0.0.1:5432/bkstest PORT=3002 node server.js` (tạo lại database `bkstest` trước khi thử).

## 7. Quy tắc nghiệp vụ đang chạy (quan trọng – không làm trái khi chưa hỏi)

### 7.1 Ba thời điểm (TĐ1 / TĐ2 / TĐ3)
- **Mỗi văn bản HĐ / PL có 3 TĐ độc lập**: TĐ1 = giá trị **ký** (`gia_tri` lưu, đọc ra `gia_tri_ky`) · TĐ2 = TĐ1 + các **đợt điều chỉnh**
  (bảng `dieu_chinh`, loại `dt` doanh thu / `tp` HĐ đầu vào; mỗi đợt có ngày, nội dung, số ±, **VAT riêng** cột `vat` – trống = VAT văn bản)
  · TĐ3 = **số quyết toán** (`doanh_thu.gt_qt`, `tp_hd_pl.gia_tri_qt`; trống = TĐ2).
- TĐ1 của dự án gồm cả PL ký sau (người dùng đã đồng ý). Báo cáo tách rõ HĐ bao nhiêu / PL bao nhiêu ở từng TĐ.
- **Nhập theo tab TĐ** (nút TĐ1/TĐ2/TĐ3 ở Doanh thu, Chi phí – dùng chung `BST.i_td` với Báo cáo):
  - TĐ1: thêm / sửa HĐ, PL (giá trị ký). Chọn văn bản **đã có** ở form TĐ1 -> ghi thành điều chỉnh TĐ2 và tự chuyển sang tab TĐ2.
  - TĐ2: **form điều chỉnh** ngay trên bảng (Văn bản · Tăng/giảm ± hoặc **Chốt giá trị mới** · Số tiền · VAT % · Sau VAT · Ngày · Nội dung);
    bấm số TĐ2 của dòng -> hộp xem / sửa / xóa các đợt.
  - TĐ3: nhập số quyết toán từng văn bản (Lưu QT) -> văn bản **khoá cả TĐ1, TĐ2, TĐ3**; HĐ + mọi PL có số -> HĐ **đóng** (không thêm PL).
    Mở khoá: nút 🔓 ở tab TĐ3, **Passcode**, bỏ số QT của văn bản (ghi nhật ký). Chặn ở máy chủ trước bước duyệt (báo ngay).
- Bảng nhập liệu chỉ hiện **cột TĐ đang chọn + cột "± so TĐ trước"** (▲▼, %). 3 thẻ trên cùng Doanh thu chạy theo TĐ (HĐ/PL tại TĐ;
  HT/QT và tiền về là số thực, ghi "đạt x% HĐ TĐk", "còn phải thu").
- Hộp nhập liệu (điều chỉnh, quyết toán, dự trù, chi tiết HĐ đầu vào) luôn hiện số **bằng đồng** (khớp ô nhập), ghi "Đơn vị: đồng".
- Báo cáo mục III **luôn lấy thời điểm mới nhất** (= TĐ3 của từng dự án), không có nút chọn TĐ. Dashboard vẫn theo TĐ riêng (chưa đổi).

### 7.2 Chi phí
- Chi phí dự án tại TĐk = HĐ đầu vào tại TĐk + dự trù / gói (phiên song song làm "gói chi phí": TĐ1 tạm tính gói, TĐ2 gắn HĐ thật…)
  + chi phí khác đã ghi **theo TĐ**.
- **Phát sinh theo TĐ** (V02.18): cột `td_ps` ở `tp_hd_pl` và `chi_phi` (trống = TĐ1). Thêm ở TĐ1 -> tính từ TĐ1; ở TĐ2 -> không tính TĐ1
  (TĐ2 tăng/giảm tiếp, TĐ3 = TĐ2); ở TĐ3 -> không tính TĐ1, TĐ2 (mục TĐ3 nhập ở cột TĐ3, giá trị = số QT, tự khoá).
  Báo cáo dùng `tpLine` (lib/report.js) và `khac_td`, `khac_b1_td`, `cp_khac_td`.
- Hộp chi tiết HĐ đầu vào có **2 nút**: **"+ Thêm PLxx"** (phụ lục) và **"+ Chi phí khác"** = phụ lục có nhãn "Chi phí khác"
  (cột `tp_hd_pl.la_cp`; ghi như phụ lục phát sinh – giá trị dự kiến, không phải dòng chi thực). Cả 2 có ở 3 tab, theo quy tắc phát sinh.
- Đã **bỏ** lựa chọn "➕ Phát sinh ngoài TĐ1 (TĐ1 = 0)" ở ô chọn gói khi tạo HĐ ở TĐ2 (HĐ cũ đã tạo theo cách đó vẫn tính như trước).
- Cột `chi_phi.tp_ref` (V03.18, chi phí khác nhập từ hộp HĐ) vẫn còn trong kho nhưng giao diện không dùng nữa.
- Nhóm Thầu phụ: dòng chi phí lẻ chỉ ghi được khi có `tp_ref` (nhập từ hộp HĐ) – chặn ở `validateCost`.
- Dự trù chi phí theo nhóm (bảng `du_tru`, loại ky/dc/qt) – phiên song song đã phát triển thành "gói chi phí".

### 7.3 Doanh thu, tiền, hiển thị
- Ô nhập tiền (`public/common.js`): dấu chấm luôn là dấu nghìn khi gõ (lỗi cắt số V21.10 đã sửa V03.11); gõ được `1,5 tỷ`, `180tr`, `500k`,
  công thức `=1.250.000*12`, dấu `+` đầu số; > 1 triệu tỷ báo đỏ. Ô tiền luôn tính bằng **đồng**.
- Đơn vị hiển thị (Đồng/Nghìn/Triệu/Tỷ/Tự động) chỉ đổi cách hiện; hộp đang mở tự vẽ lại khi đổi đơn vị.
- Tiền thật (tiền về, đã chi – sau VAT) quy về trước VAT theo tỷ lệ VAT dự án, **làm tròn tới đồng** (V01.19 bỏ làm tròn 0,1 tỷ).
- Giao diện màn hình: màn rời 22–27" (mật độ thường) không phóng chữ, nới vùng nội dung tới 1520 / 1680px; Mac Retina phóng như V14.17.
- Quy trình duyệt: người không có quyền duyệt (QS, Kế toán, Nhập liệu) gửi -> "Chờ duyệt", chưa tính vào tổng; Quản trị / Lãnh đạo duyệt
  thì máy chủ ghi đúng yêu cầu gốc.

## 8. Việc đang chờ người dùng quyết (hỏi lại khi phù hợp)

1. Form Chi phí ngoài trang (dòng chi phí lẻ thêm ở tab TĐ2 / TĐ3, có nhãn "Phát sinh TĐk"): giữ như hiện tại hay chỉ cho ghi qua hợp đồng?
2. Bảng chi tiết chi phí: có **ẩn** các dòng phát sinh TĐ2 / TĐ3 khi đang xem TĐ trước đó không (hiện vẫn hiện + nhãn; tổng đã đúng)?
3. Dashboard phần "Còn phải thu – chi": có đổi sang luôn lấy thời điểm mới nhất như mục III Báo cáo không?
4. Rà dữ liệu thật: (a) văn bản đã có số quyết toán sẽ tự khoá theo quy tắc tab TĐ3; (b) **số gõ tay từ 10/11 đến V03.11.11.26 có thể bị cắt**
   (lỗi ô tiền: gõ quá 4 chữ số bị đọc thành số nhỏ, VD 500.000.000 -> 5) – người dùng chọn "xem xét sau".
5. Có làm nút **Sao lưu dữ liệu** (xuất toàn bộ ngăn `bks`) không (mục 5)?
6. Có tạo nhánh `main` / "chuyển qua chính" không – chỉ khi người dùng yêu cầu.
7. Hộp HĐ đầu vào ở tab TĐ3: có làm form riêng phía trên bảng như TĐ2 không (chưa hỏi lại).

## 9. Lịch sử chính (chi tiết đầy đủ: `docs/TOM-TAT-PHIEN.md`)

| Phiên bản | Nội dung |
|---|---|
| V23.10.11.26 | Đợt A: 3 TĐ độc lập mỗi HĐ/PL, bảng `dieu_chinh`, quyết toán HĐ |
| V01.11.11.26 | Đợt B: dự trù chi phí theo nhóm; cột chỉ ghi TĐ1/TĐ2/TĐ3 |
| V02.11.11.26 | Chốt quyết toán đủ số mới chốt, chốt rồi khoá HĐ |
| V03.11.11.26 | **Sửa lỗi lớn ô tiền** (gõ > 4 chữ số bị cắt); gõ theo đơn vị; hộp chi tiết theo đơn vị |
| V04–V15.11.11.26 | Nhập liệu theo tab TĐ (khoá TĐ3, mở khoá Passcode), ẩn tạo HĐ ở TĐ2/3, số trong hộp bằng đồng, cột TĐ đang chọn + so sánh, form TĐ2, VAT từng đợt, canh nút form |
| V16.11 → V19.12.11.26 | (phiên song song) Gói chi phí, bảng HĐ đầu vào 3 tầng, báo cáo theo HĐ CĐT, tab Hướng dẫn… |
| V20.12.11.26 | Báo cáo mục III lấy thời điểm mới nhất |
| → V23.17.11.26 | (phiên song song) phóng to màn hình theo độ rộng (V14.17), Dashboard… |
| V01.18.11.26 | Màn hình rời 22–27" không bị quá to |
| V02–V04.18.11.26 | Mục chi phí phát sinh theo TĐ; 2 nút "+ Thêm PL" / "+ Chi phí khác" (ghi như phụ lục); bỏ "Phát sinh ngoài TĐ1" |
| **V01.19.11.26** | Sửa lỗi làm tròn 0,1 tỷ khi quy đổi tiền thật trước VAT (lệch tới ~50tr/dự án). **Bản lưu `quanlytaichinh19112026`** |

## 10. Câu mở đầu gợi ý cho Claude mới

> "Đọc `docs/BAN-GIAO-CLAUDE-19112026.md` và `CLAUDE.md` trong kho `ducptclaude/Quanlytaichinh`, nhánh `staging`. Bản đang chạy V01.19.11.26.
> Tiếp tục làm việc theo đúng quy ước, trả lời tiếng Việt, cuối mỗi yêu cầu báo 3 ý."
