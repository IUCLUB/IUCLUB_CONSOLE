import { Link } from "react-router-dom";
import { Step, Steps } from "../components/Steps.jsx";
import CodeBox from "../components/CodeBox.jsx";

// Chỉ chủ dự án thấy tab này nên luôn có p.owner
export default function Connect({ data }) {
  const { project: p, live } = data;
  const repo = p.owner.repo || `iu-club/${p.slug}`;
  const mono = (t) => <span className="mono">{t}</span>;
  return (
    <div className="stack">
      <section className="card">
        <h2>Đưa dự án lên server</h2>
        <p className="muted" style={{ margin: "0 0 20px" }}>
          Làm lần lượt. Console tự đánh dấu ✓ khi từng bước xong.
        </p>
        <Steps>
          <Step
            n={1}
            done={!!p.owner.repo}
            title="Tạo repo private từ template"
            desc={
              <>
                GitHub → repo template IU CLUB → <b>Use this template</b> → <b>Private</b>, trong
                Organization của câu lạc bộ. Nhập tên repo ở tab{" "}
                <Link to="?tab=deploy">Triển khai</Link>.
              </>
            }
          />
          <Step
            n={2}
            done={p.deploy?.state === "ok"}
            title="Nối GitHub và triển khai"
            desc={
              <>
                Tab <Link to="?tab=deploy">Triển khai</Link>: tạo deploy key, thêm webhook, bấm
                “Triển khai ngay”. Console tự điền {mono("IU_SLUG")}, {mono("IU_KEY")},{" "}
                {mono("ADMIN_API_TOKEN")}.
              </>
            }
          />
          <Step
            n={3}
            done={live.up}
            title="Dự án phản hồi"
            desc={
              <>
                Console gọi {mono(p.upstream + (p.health || "/"))}:{" "}
                {live.up ? "đã phản hồi." : "chưa phản hồi. Triển khai xong rồi tải lại trang này."}
              </>
            }
          />
          <Step
            n={4}
            done={!p.summary || live.summaryOk}
            title="Số liệu hiện trên Console"
            desc={
              p.summary ? (
                <>
                  {mono(p.summary)}{" "}
                  {live.summaryOk
                    ? "trả dữ liệu."
                    : "chưa trả dữ liệu. Template mặc định đã có sẵn, chỉ cần container chạy."}
                </>
              ) : (
                "Không cấu hình, bỏ qua."
              )
            }
          />
          <Step
            n={5}
            done={p.state.key === "on"}
            title="Mở cho khách"
            desc={
              <>
                Bấm <b>Bật dự án</b> ở đầu trang, hoặc hẹn giờ ở tab{" "}
                <Link to="?tab=access">Lịch & truy cập</Link>. Trước đó chỉ thành viên xem được ở{" "}
                <a href={p.url} target="_blank" rel="noopener">
                  {p.url}
                </a>
                .
              </>
            }
          />
        </Steps>
      </section>
      <section className="card">
        <h2>Làm trên máy</h2>
        <p className="muted" style={{ margin: "0 0 20px" }}>
          Cần Node 22, không cần Docker. {mono("DEV_USER")} cho vào thử {mono("/admin")} mà không
          qua gateway; trên server nó luôn bị bỏ qua.
        </p>
        <CodeBox
          text={`git clone git@github.com:${repo}.git && cd ${repo.split("/").pop()}\nnpm install\ncp .env.example .env   # điền DEV_USER=email-cua-ban\nnpm run dev:api        # terminal 1: API + SQLite, cổng 3000\nnpm run dev            # terminal 2: http://localhost:5173`}
        />
      </section>
    </div>
  );
}
