# IU CLUB

Một domain, nhiều dự án. Mỗi dự án chạy ở `<slug>.<domain>`, có thể bật/tắt trên Console tại `admin.<domain>`.

```
                 *.<domain>  →  gateway (Caddy)
                                   │  hỏi Console /gate cho mỗi request:
                                   │  dự án có không? đang bật? đường dẫn cần đăng nhập?
        ┌──────────────────────────┼───────────────────────────┐
  admin.<domain>            <slug-a>.<domain>           <slug-b>.<domain> …
  console/                  repo dự án A (p-slug-a)     repo dự án B (p-slug-b)
```

| Thư mục              | Là gì                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| `gateway/`           | Caddyfile. Không cần sửa khi thêm dự án.                                                        |
| `console/`           | Console: dự án, bật/tắt, đăng nhập và các phân hệ bên dưới. Giao diện theo `console/DESIGN.md`. |
| `deployer/`          | Kéo repo dự án từ GitHub và chạy compose. Service duy nhất giữ `docker.sock`.                   |
| `templates/starter/` | Nội dung repo template (React + Vite + SQLite), đã đáp ứng đủ hợp đồng với gateway.             |

## Chạy trên máy

```bash
cp .env.example .env                 # điền SECRET, GATE_SECRET, CONSOLE_USERS
docker compose up -d --build         # gateway + console + deployer, tạo mạng "iuclub"
```

Repo này chỉ có nền tảng. Mỗi dự án là một repo riêng, được triển khai qua tab Triển khai của Console.

Mở http://admin.localhost:8088 (Chrome/Edge/Firefox tự hiểu `*.localhost`).

Phát triển Console (React + Vite):

```bash
cd console && npm install
CONSOLE_URL=http://localhost:5173 npm run dev:api   # terminal 1: API và gateway
npm run dev                                         # terminal 2: Vite, mở http://localhost:5173
npm test                                            # chạy bộ kiểm thử
```

## Phân hệ của Console

| Phân hệ      | Làm gì                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giám sát     | Gọi `health` của từng dự án mỗi phút, hiện % hoạt động, thời gian phản hồi; đổi trạng thái thì ghi sự cố vào nhật ký. Lịch sử giữ 24 giờ trong RAM. |
| Lịch mở/đóng | Hẹn giờ mở/đóng (giờ VN) và lời nhắn trên trang tạm đóng. Gateway áp dụng ngay, không cần cron.                                                     |
| Nhật ký      | 500 sự kiện gần nhất: tạo, sửa, bật/tắt, đặt lịch, xuất dữ liệu, sự cố.                                                                             |
| Xuất dữ liệu | Tab “Dữ liệu” của dự án gọi `exportPath` bằng token và tải file về.                                                                                 |
| Hướng dẫn    | Các bước dựng dự án và hợp đồng với gateway, ngay trong Console.                                                                                    |

Mỗi dự án có các tab: Tổng quan, Kết nối, Lịch & truy cập, Dữ liệu, Nhật ký, Cài đặt.

## Làm dự án mới

Mục tiêu: nhóm mới đưa dự án lên subdomain trong dưới 1 giờ, không cần nhóm lõi ngoài bước 1.

1. **Console → Dự án mới** (nhóm lõi): nhập slug và tên, thêm chủ dự án ở tab Thành viên. Dự án được tạo ở trạng thái tắt.
2. Nhóm dự án tạo repo private từ repo template trong GitHub Organization của câu lạc bộ (**Use this template**).
3. Tab **Kết nối** của dự án liệt kê các bước còn lại và tự tick khi xong: nối repo ở tab Triển khai, deploy key, webhook, triển khai.
4. Làm trên máy: Node 22, `npm run dev:api` + `npm run dev`, `DEV_USER` để thử `/admin` (xem README của template). Không cần Docker.
5. Khi đang tắt, khách thấy trang "tạm đóng", người đăng nhập Console vẫn xem trước được. Sẵn sàng thì bấm **Bật dự án**.

### Hợp đồng mỗi dự án phải giữ

1. Container `p-<slug>` nối mạng `iuclub`, **không mở cổng ra host**.
2. `GET /api/health` trả 200.
3. `GET /api/admin/stats` trả JSON số liệu, nhận `Authorization: Bearer $ADMIN_API_TOKEN`.
4. Trang quản trị dưới `/admin`: không tự làm đăng nhập. Gateway chỉ cho thành viên dự án qua và gửi kèm
   `X-Iu-User`, `X-Iu-Role`, `X-Iu-Key`; **chỉ tin `X-Iu-User`/`X-Iu-Role` khi `X-Iu-Key` khớp `IU_KEY`**.
5. `exportPath` (template: `GET /api/admin/export`) trả 200 kèm một file, nhận `Authorization: Bearer $ADMIN_API_TOKEN`.
   Định dạng tuỳ dự án, nên là file DB gốc. Console dùng cho nút "Tải dữ liệu" và sao lưu hằng đêm.

Dự án có sẵn hệ thống đăng nhập riêng thì để trống ô
"Cần đăng nhập Console" và giữ đăng nhập của mình.

## Triển khai từ GitHub

Mỗi dự án là **một repo private riêng**, tạo từ repo template (nội dung `templates/starter/`, bật “Template repository” trên GitHub).
Phân quyền theo repo trên GitHub: người làm dự án này không đọc, không sửa được repo dự án khác.

1. Console → dự án → tab **Triển khai**: nhập repo `chu-so-huu/ten-repo`, nhánh, biến môi trường riêng.
2. **Tạo deploy key**, dán vào GitHub → repo → Settings → Deploy keys (chỉ đọc).
3. Thêm webhook với URL và secret Console đưa ra. Mỗi lần push lên nhánh chính, Console tự build và chạy lại;
   cũng có thể bấm **Triển khai ngay**, hoặc nhập mã commit cũ để quay lại bản trước.

`deployer/` là service duy nhất giữ `docker.sock` (tương đương root trên server), chỉ nằm trong mạng riêng với Console.
Mỗi lệnh `docker compose` chạy trong một container sandbox chỉ thấy mã nguồn của đúng dự án đó, và file compose
phải qua kiểm tra (`deployer/check.js`) trước khi `up`: không bind mount, không `privileged`, không mở cổng,
không mạng/volume ngoài, container phải tên `p-<slug>`. Vi phạm thì build bị chặn và lý do hiện trong nhật ký build.

## Các dự án tách biệt nhau thế nào

- **Mã nguồn**: mỗi dự án một repo riêng, quyền đọc/sửa theo repo trên GitHub.
- **Triển khai**: deployer chỉ đụng container của đúng dự án đó. Build lỗi thì container cũ vẫn chạy.
- **Dữ liệu**: mỗi dự án có DB/volume riêng, không mở cổng DB ra ngoài.
- **Gateway**: tự tìm dự án theo subdomain, thêm/xoá dự án không phải sửa hay khởi động lại gateway.
- **Quyền quản trị**: `IU_KEY` khác nhau theo từng dự án. Chỉ gateway (có `GATE_SECRET`) hỏi được `/gate` để lấy khoá, nên container dự án khác trong mạng không lấy được khoá và không giả được danh tính quản trị.
- **Tài nguyên**: template đặt sẵn `mem_limit`/`cpus` để một dự án không làm chậm cả server.

Chưa có (làm khi cần): mạng riêng cho từng dự án, đăng nhập Console bằng SSO PTIT.

## Phân quyền

| Quyền                                                                                  | Xem | Điều hành | Chủ dự án | Quản trị viên |
| -------------------------------------------------------------------------------------- | --- | --------- | --------- | ------------- |
| Tổng quan, số liệu, giám sát, nhật ký; xem trước khi dự án tắt; vào `/admin` của dự án | ✓   | ✓         | ✓         | ✓             |
| Bật/tắt, hẹn giờ, xuất dữ liệu                                                         |     | ✓         | ✓         | ✓             |
| Cài đặt, Kết nối (token), thành viên dự án                                             |     |           | ✓         | ✓             |
| Tạo/xoá dự án, tài khoản (trang Thành viên)                                            |     |           |           | ✓             |

- Người không thuộc dự án không thấy dự án đó trên Console và bị gateway chặn ở các đường dẫn bảo vệ.
- Quyền được tra lại ở mỗi request: gỡ thành viên là mất quyền ngay, kể cả phiên đang mở.
- Quản trị viên tạo tài khoản → Console sinh mật khẩu tạm (hiện một lần) → người dùng đổi ở trang Tài khoản.
- Xoá tài khoản (trang Thành viên) cần bấm xác nhận lần hai; người bị xoá bị đăng xuất ngay, nhật ký cũ vẫn giữ email. Không tự xoá mình, luôn còn ít nhất một quản trị viên.
- `CONSOLE_USERS` chỉ tạo quản trị viên đầu tiên. Mất quyền truy cập: đặt `CONSOLE_RESET=email:matkhaumoi`, khởi động lại console, rồi xoá biến.

## Quy trình làm việc của câu lạc bộ

**Vai trò**

- _Nhóm lõi_ (1 đến 2 người): giữ `gateway/`, `console/`, `templates/`, duyệt dự án mới, quản lý server.
- _Nhóm dự án_: mỗi dự án một nhóm, một repo riêng trong GitHub Organization. Tự triển khai qua Console, không cần nhóm lõi.
- _Ban chủ nhiệm_: chỉ xem Tổng quan trên Console.

**Git (repo này: Console, gateway, deployer, template)**

- `main` là bản đang chạy trên server. Không push thẳng.
- Nhánh `core/<việc>`, ví dụ `core/console-phan-quyen`. PR vào `main` cần một người nhóm lõi duyệt.
- Merge xong, trên server: `git pull && docker compose up -d --build`. Dự án không bị khởi động lại.
- Sửa `templates/starter/` thì nhớ cập nhật repo template trên GitHub (dự án tạo sau mới nhận bản mới).

**Vòng đời một dự án**

1. _Ý tưởng_: nhóm lõi tạo dự án trên Console (tắt) và thêm chủ dự án; nhóm dự án tạo repo từ template.
2. _Phát triển_: chạy local; push lên nhánh chính là Console tự triển khai. Đang tắt nên chỉ thành viên đã đăng nhập Console xem được.
3. _Sự kiện_: bật dự án. Theo dõi số liệu trên Console.
4. _Kết thúc_: tắt dự án, xuất dữ liệu, `docker compose down` để giải phóng tài nguyên. Repo vẫn giữ để làm lại năm sau.

## Bàn giao giữa các khoá

Mỗi khoá dưới đây do **ít nhất 2 người thuộc 2 khoá khác nhau** giữ, lưu trong Bitwarden Organization của câu lạc bộ.
Một người ra trường thì không mất gì.

| Khoá                                 | Dùng để                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| SSH / tài khoản nhà cung cấp server  | Vào server, khởi động lại, nâng cấp.                                                                     |
| Tài khoản tên miền + DNS             | Gia hạn tên miền, sửa bản ghi `A`.                                                                       |
| Owner GitHub Organization            | Thêm/bớt thành viên, repo template, repo dự án.                                                          |
| Quản trị viên Console                | Tạo dự án, tài khoản. Mỗi người một tài khoản riêng.                                                     |
| `SECRET` trong `.env` ở server       | Ký phiên đăng nhập, sinh `IU_KEY`. Mất là phải đặt lại khoá mọi dự án.                                   |
| `GATE_SECRET` trong `.env` ở server  | Chứng minh với Console request `/gate` đến từ gateway. Lộ thì đổi ngay, khởi động lại gateway + console. |
| Google Drive sao lưu (rclone config) | Khôi phục dữ liệu.                                                                                       |

Khi bàn giao (mỗi đầu năm học):

- [ ] Người mới được thêm vào Bitwarden Organization, người cũ vẫn giữ đến hết năm.
- [ ] Người mới đăng nhập thử được: server (SSH), DNS, GitHub Org (Owner), Console (Quản trị viên), Drive.
- [ ] Gia hạn tên miền và server còn ít nhất 6 tháng.
- [ ] Gỡ quyền những người không còn hoạt động (GitHub Org, Console, Bitwarden).
- [ ] Người mới tự làm một lần khôi phục thử từ bản sao lưu (xem mục Sao lưu).

## Lên server thật

1. DNS: bản ghi `A` cho `<domain>` và `*.<domain>` trỏ về server.
2. `.env`: `DOMAIN=<domain>`, `HTTP_PORT=80`, `CONSOLE_URL=https://admin.<domain>`, `PROJECT_URL=https://{slug}.<domain>`.
3. Caddyfile: bỏ `auto_https off` và tiền tố `http://`, thêm cấp chứng chỉ theo yêu cầu (Console đã có sẵn `/tls-ask`):
   ```
   { on_demand_tls { ask http://console:3000/tls-ask } }
   admin.{$DOMAIN} { reverse_proxy console:3000 }
   *.{$DOMAIN} { tls { on_demand } … giữ nguyên phần handle … }
   ```
   và mở thêm cổng `443:443` cho gateway.
4. Dự án có đăng nhập riêng (OAuth, SSO): đăng ký lại Redirect URI theo `https://<slug>.<domain>`.
5. Bật sao lưu (mục dưới).

## Sao lưu

Mỗi đêm sau 2 giờ sáng (giờ VN), Console gọi `exportPath` của từng dự án và chép `console.json` vào volume `backups`:

```
daily/<ngày>/<slug>.<đuôi>, console.json   giữ 14 ngày gần nhất
final/<slug>/<ngày đóng>.<đuôi>             bản cuối khi dự án qua giờ đóng, không bao giờ xoá
```

Dự án không trả được dữ liệu thì nhật ký Console có dòng "Sao lưu lỗi". Service `backup` (rclone) đẩy volume lên Google Drive mỗi giờ.

Cài trên server (một lần):

```bash
echo "COMPOSE_PROFILES=backup" >> .env
docker compose run --rm -it --entrypoint rclone backup config   # n → tên "drive" → Google Drive, đăng nhập Drive câu lạc bộ
docker compose up -d
docker compose logs backup        # thấy "Copied" là xong
```

Server không có trình duyệt thì ở bước đăng nhập rclone in lệnh `rclone authorize "drive"` để chạy trên máy mình rồi dán kết quả vào.

**Khôi phục thử mỗi học kỳ** (người mới trong nhóm lõi tự làm):

1. Tải một bản `daily/<ngày>/` từ Drive.
2. Console: chép `console.json` vào volume rồi khởi động lại:
   `docker compose cp console.json console:/data/console.json && docker compose restart console`.
3. Dự án dùng template (SQLite): dừng dự án, thay `app.db` trong volume `<slug>_data` (xoá luôn file `-wal`/`-shm` cũ), chạy lại:
   ```bash
   docker stop p-<slug>
   docker run --rm -v <slug>_data:/data -v "$PWD":/b alpine sh -c \
     'rm -f /data/app.db-wal /data/app.db-shm && cp /b/<slug>.sqlite /data/app.db && chown 1000:1000 /data/app.db'
   docker start p-<slug>
   ```
   Mở trang quản trị, số liệu phải khớp.
4. Ghi ngày khôi phục thử và người làm vào nhật ký bàn giao.

## Lưu ý

- Console lưu dữ liệu ở volume `console-data` (file JSON), được sao lưu hằng đêm cùng các dự án.
