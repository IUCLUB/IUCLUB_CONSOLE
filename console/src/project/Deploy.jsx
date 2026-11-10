import { useContext, useEffect, useRef, useState } from "react";
import { MeContext, api, useAction } from "../api.js";
import { fmtTime } from "../../shared.js";
import Message from "../components/Message.jsx";
import { Step, Steps } from "../components/Steps.jsx";
import CodeBox from "../components/CodeBox.jsx";

const STATE = {
  running: ["tone-run", "Đang triển khai"],
  ok: ["tone-ok", "Thành công"],
  fail: ["tone-fail", "Lỗi"],
};
const STEP_TEXT = { wait: "Chờ", run: "Đang chạy", ok: "Xong", fail: "Lỗi" };

/** 75000 → "1 phút 15 giây" */
const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} giây` : `${Math.floor(s / 60)} phút${s % 60 ? ` ${s % 60} giây` : ""}`;
};
const stepText = (s) => {
  if (!s.startedAt || s.state === "wait") return STEP_TEXT.wait;
  return `${STEP_TEXT[s.state] || s.state} · ${fmtDur((s.endedAt || Date.now()) - s.startedAt)}`;
};

// Log build: tô màu dòng lệnh, dòng commit và dòng lỗi; đang chạy thì tự cuộn xuống cuối
function Log({ text, running, failed }) {
  const ref = useRef(null);
  const atEnd = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && running && atEnd.current) el.scrollTop = el.scrollHeight;
  }, [text, running]);
  const lines = text.replace(/\n+$/, "").split("\n");
  const last = lines.length - 1;
  return (
    <pre
      ref={ref}
      className="term"
      aria-live={running ? "polite" : undefined}
      onScroll={(e) => {
        const el = e.currentTarget;
        atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
    >
      {lines.map((l, i) => (
        <span
          key={i}
          className={
            l.startsWith("$ ")
              ? "cmd"
              : l.startsWith("Commit ")
                ? "commit"
                : (failed && i === last) || /\b(error|failed|denied)\b|lỗi|không /i.test(l)
                  ? "bad"
                  : undefined
          }
        >
          {l}
          {"\n"}
        </span>
      ))}
      {running && <span className="cursor" aria-hidden="true"></span>}
    </pre>
  );
}
const SUB = { gridColumn: "1/-1", marginTop: 12 };

export default function Deploy({ data, reload }) {
  const { config } = useContext(MeContext);
  const { project: p } = data;
  const d = p.deploy,
    o = p.owner; // chỉ chủ dự án có
  const [tone, label] = STATE[d?.state] || ["tone-wait", "Chưa triển khai"];
  const total = d?.startedAt && d.state !== "running" ? d.at - d.startedAt : null;
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
    <div className="stack">
      <section className="card run">
        <div className="run-head">
          <div className="what">
            <span className={`run-state ${tone}`}>
              <i aria-hidden="true"></i>
              {label}
            </span>
            {d ? (
              <span className="run-meta">
                {(d.commit || d.ref) && (
                  <span className="mono">{(d.commit || d.ref).slice(0, 7)}</span>
                )}
                {d.subject && <> {d.subject}</>}
                <br />
                {d.state === "running" ? "Bắt đầu" : "Xong"} {fmtTime(d.at)}, bởi {d.by}
                {total != null && <>, {fmtDur(total)}</>}
              </span>
            ) : (
              <span className="run-meta">Chưa có lần triển khai nào.</span>
            )}
          </div>
          {p.can.owner && o.repo && o.pubkey && (
            <form className="run-actions" onSubmit={send({ do: "run", ref })}>
              <input
                className="mono"
                name="ref"
                aria-label={`Commit cũ để quay lại (để trống = mới nhất trên nhánh ${branch})`}
                title={`Để trống = mới nhất trên nhánh ${branch}; điền mã commit cũ để quay lại bản trước`}
                placeholder="commit cũ"
                autoComplete="off"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
              <button className="btn pri" disabled={busy || d?.state === "running"}>
                {d?.state === "running" ? "Đang triển khai…" : "Triển khai ngay"}
              </button>
            </form>
          )}
        </div>
        {d?.steps?.length > 0 && (
          <ol className="pipe" aria-label="Các bước triển khai">
            {d.steps.map((s) => (
              <li key={s.key} data-state={s.state}>
                <b>{s.title}</b>
                <span>{stepText(s)}</span>
              </li>
            ))}
          </ol>
        )}
        {d?.log && <Log text={d.log} running={d.state === "running"} failed={d.state === "fail"} />}
        {msg.err && <Message err={msg.err} />}
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
                    <input className="mono" placeholder={`IUCLUB/${p.slug}`} {...bind("repo")} />
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
