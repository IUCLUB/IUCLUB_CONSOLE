import { useContext, useState } from "react";
import { MeContext, api, useAction } from "../api.js";
import { fmtTime } from "../../shared.js";
import Message from "../components/Message.jsx";
import { Step, Steps } from "../components/Steps.jsx";
import CodeBox from "../components/CodeBox.jsx";

const STATE = {
  running: ["soon", "Đang triển khai"],
  ok: ["on", "Thành công"],
  fail: ["", "Lỗi"],
};
const SUB = { gridColumn: "1/-1", marginTop: 12 };

export default function Deploy({ data, reload }) {
  const { config } = useContext(MeContext);
  const { project: p } = data;
  const d = p.deploy,
    o = p.owner; // chỉ chủ dự án có
  const [cls, label] = STATE[d?.state] || ["", "Chưa triển khai"];
  const { msg, busy, run } = useAction();
  const [ref, setRef] = useState("");
  const [cfg, setCfg] = useState(() => ({
    repo: o?.repo || "",
    branch: o?.branch || "main",
    env: o?.env || "",
  }));
  const bind = (name) => ({
    name,
    value: cfg[name],
    onChange: (e) => setCfg({ ...cfg, [name]: e.target.value }),
  });
  // Triển khai ngay thì không báo "Đã lưu." (như trang cũ)
  const send = (body, ok) => (ev) => {
    ev.preventDefault();
    run(async () => {
      await api(`/api/projects/${p.slug}/deploy`, { method: "POST", body });
      reload();
    }, ok);
  };
  const gh = (path, text) =>
    o?.repo && (
      <a
        className="btn sm"
        href={`https://github.com/${o.repo}${path}`}
        target="_blank"
        rel="noopener"
      >
        {text} ↗
      </a>
    );
  const mono = (t) => <span className="mono">{t}</span>;
  const branch = o?.branch || "main";
  return (
    <div className="cols">
      <section className="card">
        <div className="head">
          <h2>Lần triển khai gần nhất</h2>
          <span className="sp"></span>
          <span className={`pill ${cls}`}>{label}</span>
        </div>
        {d ? (
          <>
            <ol className="rows">
              <li>
                <span className="t">Commit</span>
                <span className="n">{(d.commit || d.ref || "—").slice(0, 7)}</span>
                {d.subject && <span className="d">{d.subject}</span>}
              </li>
              <li>
                <span className="t">Lúc</span>
                <span className="n">{fmtTime(d.at)}</span>
                <span className="d">bởi {d.by}</span>
              </li>
            </ol>
            {d.log && (
              <details style={{ marginTop: 20 }} open={d.state === "fail" || undefined}>
                <summary>Nhật ký build</summary>
                <pre className="code" style={{ maxHeight: 420, overflow: "auto", marginTop: 12 }}>
                  <code>{d.log}</code>
                </pre>
              </details>
            )}
            {d.state === "running" && (
              <p className="muted" style={{ margin: "16px 0 0" }}>
                Trang tự tải lại khi có kết quả.
              </p>
            )}
          </>
        ) : (
          <p className="empty">Chưa có lần triển khai nào.</p>
        )}
        {p.can.owner && o.repo && o.pubkey && (
          <form className="f" style={{ marginTop: 28 }} onSubmit={send({ do: "run", ref })}>
            <label>
              Commit{" "}
              <small>
                để trống = mới nhất trên nhánh {branch}; điền mã commit cũ để quay lại bản trước
              </small>
              <input
                className="mono"
                name="ref"
                placeholder="vd. 1a2b3c4"
                autoComplete="off"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
            </label>
            <div>
              <button className="btn pri" disabled={busy || d?.state === "running"}>
                Triển khai ngay
              </button>
            </div>
          </form>
        )}
        {msg.err && (
          <div style={{ marginTop: 16 }}>
            <Message err={msg.err} />
          </div>
        )}
      </section>
      {p.can.owner && (
        <section className="card">
          <h2>Kết nối GitHub</h2>
          <p className="muted" style={{ margin: "-8px 0 20px" }}>
            Làm lần lượt 3 bước, mỗi bước xong sẽ có ✓. Các nút ↗ mở đúng trang cần làm trên GitHub.
          </p>
          <Steps>
            <Step
              n={1}
              done={!!o.repo}
              title="Repo và biến môi trường"
              desc={
                <>
                  Chưa có repo? Trên GitHub mở repo template IU CLUB → <b>Use this template</b> →{" "}
                  <b>Private</b>. Ghi tên dạng {mono("chu-so-huu/ten-repo")}. {gh("", "Mở repo")}
                </>
              }
            >
              <form className="f" style={SUB} onSubmit={send({ do: "save", ...cfg }, "Đã lưu.")}>
                <div className="two">
                  <label>
                    Repo
                    <input className="mono" placeholder={`iu-club/${p.slug}`} {...bind("repo")} />
                  </label>
                  <label>
                    Nhánh
                    <input className="mono" placeholder="main" {...bind("branch")} />
                  </label>
                </div>
                <label>
                  Biến môi trường{" "}
                  <small>
                    TEN=giá trị mỗi dòng, ghi vào .env khi triển khai. IU_SLUG, IU_KEY,
                    ADMIN_API_TOKEN do Console tự điền.
                  </small>
                  <textarea
                    className="mono"
                    spellCheck="false"
                    placeholder="GMAIL_USER=..."
                    {...bind("env")}
                  />
                </label>
                <div>
                  <button className="btn" disabled={busy}>
                    Lưu
                  </button>
                </div>
              </form>
            </Step>
            <Step
              n={2}
              done={!!o.pubkey}
              title="Deploy key (chỉ đọc)"
              desc={
                o.pubkey ? (
                  <>
                    Chép khoá bên dưới, bấm nút để mở trang thêm khoá trên GitHub, đặt tên tuỳ ý,
                    dán vào. <b>Không</b> tick “Allow write access”.{" "}
                    {gh("/settings/keys/new", "Mở trang Deploy keys")}
                  </>
                ) : (
                  "Deployer tạo một cặp khoá riêng cho dự án này. Khoá bí mật không rời deployer."
                )
              }
            >
              {o.pubkey ? (
                <CodeBox text={o.pubkey} />
              ) : (
                <form className="f" style={SUB} onSubmit={send({ do: "key" }, "Đã lưu.")}>
                  <div>
                    <button className="btn" disabled={busy}>
                      Tạo deploy key
                    </button>
                  </div>
                </form>
              )}
            </Step>
            <Step
              n={3}
              done={false}
              title="Webhook (tự triển khai khi push)"
              desc={
                config.local ? (
                  <>
                    <b>Bỏ qua khi chạy trên máy:</b> Console đang ở localhost nên GitHub không gọi
                    vào được. Push code xong thì bấm “Triển khai ngay” ở bên trái.
                  </>
                ) : o.hookSecret ? (
                  <>
                    Bấm nút để mở trang thêm webhook, dán Payload URL và Secret bên dưới, Content
                    type {mono("application/json")}, chọn “Just the push event”. Từ đó push lên
                    nhánh {mono(branch)} là tự triển khai.{" "}
                    {gh("/settings/hooks/new", "Mở trang Webhooks")}
                  </>
                ) : (
                  "Lưu repo ở bước 01 để Console sinh secret cho webhook. Không có webhook thì bấm “Triển khai ngay”."
                )
              }
            >
              {o.hookSecret && !config.local && (
                <>
                  <CodeBox text={o.hookUrl} />
                  <CodeBox text={o.hookSecret} />
                </>
              )}
            </Step>
          </Steps>
          <Message ok={msg.ok} />
        </section>
      )}
    </div>
  );
}
