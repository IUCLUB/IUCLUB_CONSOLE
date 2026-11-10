# Dự án IU CLUB

Khung dự án mới: React + Vite (giao diện), `server.js` (API, không thư viện), SQLite (dữ liệu).
Chạy ở `<slug>.<domain>` qua gateway. Khi triển khai, Console tự điền `IU_SLUG`, `IU_KEY`, `ADMIN_API_TOKEN`.

## Hợp đồng với gateway + Console

Đổi công nghệ thoải mái (Next, Express, Postgres…), chỉ cần giữ 5 điểm:

1. **Container `p-${IU_SLUG}`**, nghe cổng `3000`, nối mạng `iuclub`, không mở cổng ra host.
2. **`GET /api/health`** trả 200 khi dự án sống.
3. **`GET /api/admin/stats`** trả JSON các con số (vd. `{ "visits": 12 }`), chấp nhận `Authorization: Bearer $ADMIN_API_TOKEN`.
4. **Trang quản trị dưới `/admin`**: không cần tự làm đăng nhập. Gateway bắt đăng nhập Console rồi gửi kèm
   `X-Iu-User` (email), `X-Iu-Role` (viewer | editor | owner | super) và `X-Iu-Key`.
   Chỉ tin `X-Iu-User`/`X-Iu-Role` khi `X-Iu-Key` khớp biến `IU_KEY`. Chỉ thành viên dự án mới qua được gateway.
5. **API xuất dữ liệu** (khung này: `GET /api/admin/export`): trả 200 kèm một file, chấp nhận `Authorization: Bearer $ADMIN_API_TOKEN`.
   Console dùng nó cho nút "Xuất dữ liệu" và sao lưu hằng đêm. Định dạng tuỳ dự án; nên trả file DB gốc để khôi phục được ngay.
   Nhập đường dẫn này ở Console → dự án → Cài đặt → "API xuất dữ liệu".

## Phát triển trên máy

Cần Node 22 trở lên. Mở 2 terminal:

```bash
npm install
cp .env.example .env   # điền DEV_USER=email-cua-ban để vào thử /admin
npm run dev:api        # server.js ở cổng 3000 (API + SQLite)
npm run dev            # giao diện ở http://localhost:5173, /api được chuyển sang cổng 3000
```

- Trang khách: `src/App.jsx`. Trang quản trị: `src/Admin.jsx`.
- File tĩnh (ảnh, favicon…) bỏ vào `public/`.
- `DEV_USER` chỉ có tác dụng trên máy. Trên server (`NODE_ENV=production`) nó luôn bị bỏ qua.
- `npm run build && npm start` để thử bản production ở http://localhost:3000.

## Dữ liệu

SQLite có sẵn trong Node 22 (`node:sqlite`), không cần cài thêm. File DB ở `data/app.db` khi chạy trên máy,
ở volume `data` (`/data`) khi chạy trên server, nên build lại không mất dữ liệu.
Thêm bảng trong `server.js` ở chỗ `CREATE TABLE`.

Cần Postgres hoặc Mongo? Xem công thức trong Console → Hướng dẫn.

## Triển khai

Push lên nhánh chính, Console tự build và chạy lại (cấu hình ở Console → dự án → Triển khai).
