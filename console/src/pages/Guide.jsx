import { useContext } from "react";
import { Link } from "react-router-dom";
import { MeContext, useTitle } from "../api.js";
import PageHead from "../components/PageHead.jsx";
import CodeBox from "../components/CodeBox.jsx";

const DEV = `npm install
cp .env.example .env   # điền DEV_USER=email-cua-ban
npm run dev:api        # terminal 1: API + SQLite, cổng 3000
npm run dev            # terminal 2: http://localhost:5173`;

const POSTGRES = `services:
  app:
    # ... giữ nguyên, thêm:
    environment:
      DATABASE_URL: postgres://postgres:\${POSTGRES_PASSWORD}@db:5432/app
    depends_on: [db]
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:?thiếu POSTGRES_PASSWORD}
      POSTGRES_DB: app
    volumes: [pg:/var/lib/postgresql/data]
    mem_limit: 256m

volumes:
  data:
  pg:`;

const MONGO = `services:
  app:
    # ... giữ nguyên, thêm:
    environment:
      MONGO_URL: mongodb://db:27017/app
    depends_on: [db]
  db:
    image: mongo:7
    restart: unless-stopped
    volumes: [mongo:/data/db]
    mem_limit: 512m

volumes:
  data:
  mongo:`;

const M = ({ children }) => <span className="mono">{children}</span>;

// Một dòng trong danh sách đánh số: tiêu đề, số thứ tự, mô tả
function Row({ n, t, mono, children }) {
  return (
    <li>
      <span className={mono ? "t mono" : "t"}>{t}</span>
      <span className="n">{String(n).padStart(2, "0")}</span>
      <span className="d">{children}</span>
    </li>
  );
}

export default function Guide() {
  useTitle("Hướng dẫn");
  const { user: me, config } = useContext(MeContext);
  const slugUrl = config.projectUrl.replace("{slug}", "slug");
  return (
    <>
      <PageHead
        title="Hướng dẫn dựng dự án"
        lede="Mỗi dự án một repo private tạo từ template. Push lên GitHub là Console tự build; dự án mới luôn ở trạng thái tắt, chỉ thành viên xem trước được."
      >
        {me.super && (
          <Link className="btn pri" to="/new">
            + Dự án mới
          </Link>
        )}
      </PageHead>
      <section className="sec cols even">
        <div className="card">
          <p className="eyebrow">Lên server · khoảng 30 phút</p>
          <h2>Triển khai bằng GitHub</h2>
          <p className="muted" style={{ margin: "8px 0 20px" }}>
            Không cần vào server gõ lệnh, không cần biết Docker.
          </p>
          <ol className="rows">
            <Row n={1} t="Bấm “+ Dự án mới”">
              Nhập slug (thành địa chỉ <M>{slugUrl}</M>) và tên. Nhóm lõi làm bước này rồi thêm chủ
              dự án ở tab “Thành viên”.
            </Row>
            <Row n={2} t="Tạo repo private từ template">
              GitHub → repo template IU CLUB → <b>Use this template</b> → chọn Organization câu lạc
              bộ, <b>Private</b>. Chưa có repo template? Xem mục bên dưới.
            </Row>
            <Row n={3} t="Nhập repo ở tab “Triển khai”">
              Ghi dạng <M>chu-so-huu/ten-repo</M>, nhánh <M>main</M>. Bấm “Lưu”.
            </Row>
            <Row n={4} t="Dán deploy key vào GitHub">
              Bấm “Tạo deploy key”, rồi nút “Mở trang Deploy keys” để dán. <b>Không</b> tick “Allow
              write access”.
            </Row>
            <Row n={5} t="Thêm webhook">
              Nút “Mở trang Webhooks”, dán URL và Secret, Content type <M>application/json</M>. Từ
              đây mỗi lần push là tự triển khai.
              {config.local && (
                <>
                  {" "}
                  <b>Console đang chạy ở localhost nên GitHub không gọi vào được:</b> bỏ qua bước
                  này, push xong bấm “Triển khai ngay”.
                </>
              )}
            </Row>
          </ol>
        </div>
        <div className="card">
          <p className="eyebrow">Làm trên máy · Node 22, không cần Docker</p>
          <h2>Phát triển</h2>
          <p className="muted" style={{ margin: "8px 0 20px" }}>
            Clone repo của dự án rồi chạy 2 terminal. Trang khách ở <M>src/App.jsx</M>, trang quản
            trị ở <M>src/Admin.jsx</M>, API và bảng SQLite ở <M>server.js</M>.
          </p>
          <CodeBox text={DEV} />
          <p className="muted" style={{ margin: "16px 0 0" }}>
            <M>DEV_USER</M> cho vào thử <M>/admin</M> như đã đăng nhập Console (vai trò owner). Trên
            server (<M>NODE_ENV=production</M>) nó luôn bị bỏ qua.
          </p>
        </div>
      </section>
      <section className="sec cols">
        <div className="card">
          <h2>Sau khi dự án chạy</h2>
          <ol className="rows">
            <Row n={1} t="Thêm người làm cùng">
              Tab “Thành viên” của dự án. Thành viên xem trước được cả khi dự án đang tắt.
            </Row>
            <Row n={2} t="Mở cho khách">
              Bấm “Bật dự án” ở đầu trang dự án, hoặc hẹn giờ ở tab “Lịch & truy cập”.
            </Row>
            <Row n={3} t="Kết thúc sự kiện">
              Tải dữ liệu ở tab “Dữ liệu”, rồi tắt dự án.
            </Row>
          </ol>
          <details style={{ marginTop: 24 }}>
            <summary>Chưa có repo template trên GitHub? (làm một lần)</summary>
            <ol className="rows" style={{ marginTop: 16 }}>
              <Row n={1} t="Tạo repo mới, private">
                Ví dụ <M>iuclub-starter</M>. Tải lên toàn bộ nội dung thư mục{" "}
                <M>templates/starter/</M>.
              </Row>
              <Row n={2} t="Bật Template repository">
                Repo đó → Settings → General → tick <b>Template repository</b>. Từ đây có nút “Use
                this template”.
              </Row>
            </ol>
          </details>
        </div>
        <div className="card">
          <h2>Hợp đồng của mỗi dự án</h2>
          <p className="muted" style={{ margin: "-8px 0 16px" }}>
            Template đã làm sẵn hết. Chỉ cần đọc khi tự viết dự án từ đầu.
          </p>
          <ol className="rows">
            <Row
              n={1}
              t={
                <>
                  Container <M>p-&lt;slug&gt;</M>
                </>
              }
            >
              Nối mạng <M>iuclub</M>, không mở cổng ra host.
            </Row>
            <Row n={2} t="GET /api/health" mono>
              Trả 200 khi dự án sống.
            </Row>
            <Row n={3} t="GET /api/admin/stats" mono>
              JSON các con số, nhận <M>Authorization: Bearer $ADMIN_API_TOKEN</M>.
            </Row>
            <Row
              n={4}
              t={
                <>
                  Trang quản trị dưới <M>/admin</M>
                </>
              }
            >
              Không tự làm đăng nhập. Tin <M>X-Iu-User</M> và <M>X-Iu-Role</M> (viewer, editor,
              owner, super) chỉ khi <M>X-Iu-Key</M> khớp <M>IU_KEY</M>.
            </Row>
            <Row n={5} t="GET /api/admin/export" mono>
              Trả 200 kèm một file, nhận <M>Authorization: Bearer $ADMIN_API_TOKEN</M>. Console dùng
              cho nút “Tải dữ liệu” và sao lưu hằng đêm. Định dạng tuỳ dự án; nên trả file DB gốc để
              khôi phục được ngay (template trả <M>.sqlite</M>).
            </Row>
          </ol>
        </div>
      </section>
      <section className="sec card">
        <h2>Cần Postgres hoặc Mongo?</h2>
        <p className="muted" style={{ margin: "-8px 0 20px" }}>
          Template dùng SQLite, đủ cho vài trăm người dùng cùng lúc. Cần DB khác thì thêm service
          vào <M>docker-compose.yml</M> của repo. Mật khẩu đặt ở tab “Triển khai” → Biến môi trường.
          Service DB không đặt <M>container_name</M>, không nối mạng <M>iuclub</M>, không mở cổng.
        </p>
        <details>
          <summary>Postgres</summary>
          <div style={{ marginTop: 16 }}>
            <CodeBox text={POSTGRES} />
            <p className="muted" style={{ margin: "16px 0 0" }}>
              API xuất dữ liệu: thêm <M>RUN apk add --no-cache postgresql16-client</M> vào
              Dockerfile, rồi trong <M>/api/admin/export</M> chạy <M>pg_dump -Fc "$DATABASE_URL"</M>{" "}
              và trả stdout về (file <M>.dump</M>, khôi phục bằng <M>pg_restore</M>).
            </p>
          </div>
        </details>
        <details style={{ marginTop: 12 }}>
          <summary>Mongo</summary>
          <div style={{ marginTop: 16 }}>
            <CodeBox text={MONGO} />
            <p className="muted" style={{ margin: "16px 0 0" }}>
              API xuất dữ liệu: thêm <M>RUN apk add --no-cache mongodb-tools</M> vào Dockerfile, rồi
              chạy <M>mongodump --uri="$MONGO_URL" --archive --gzip</M> và trả stdout về (file{" "}
              <M>.archive.gz</M>, khôi phục bằng <M>mongorestore --archive --gzip</M>).
            </p>
          </div>
        </details>
      </section>
    </>
  );
}
