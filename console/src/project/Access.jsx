import { Fragment, useState } from "react";
import { api, useAction } from "../api.js";
import { fmtTime, toLocal } from "../../shared.js";
import Message from "../components/Message.jsx";

// Hẹn giờ: gửi nguyên chuỗi datetime-local (giờ VN), server tự đổi bằng fromLocal
function ScheduleForm({ p, reload }) {
  const [f, setF] = useState({
    openAt: toLocal(p.openAt),
    closeAt: toLocal(p.closeAt),
    closedMsg: p.closedMsg || "",
  });
  const bind = (name) => ({
    name,
    value: f[name],
    onChange: (e) => setF({ ...f, [name]: e.target.value }),
  });
  const { msg, busy, run } = useAction();
  const send = (body) =>
    run(async () => {
      await api(`/api/projects/${p.slug}/schedule`, { method: "POST", body });
      if (body.clear) setF({ ...f, openAt: "", closeAt: "" });
      reload();
    }, "Đã lưu.");
  return (
    <form
      className="f"
      onSubmit={(ev) => {
        ev.preventDefault();
        send(f);
      }}
    >
      <p className="muted" style={{ margin: 0 }}>
        Áp dụng khi dự án đang bật. Giờ Việt Nam. Để trống một ô nếu không cần.
      </p>
      <div className="two">
        <label>
          Mở lúc
          <input type="datetime-local" {...bind("openAt")} />
        </label>
        <label>
          Đóng lúc
          <input type="datetime-local" {...bind("closeAt")} />
        </label>
      </div>
      <label>
        Lời nhắn trên trang tạm đóng <small>để trống = tự ghi giờ mở/đóng</small>
        <textarea
          maxLength="300"
          placeholder="Ví dụ: Cổng gửi lời chúc mở lúc 7:00 ngày 13/11."
          {...bind("closedMsg")}
        />
      </label>
      <Message err={msg.err} ok={msg.ok} />
      <div className="row">
        <button className="btn pri" disabled={busy}>
          Lưu lịch
        </button>
        {(p.openAt || p.closeAt) && (
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => send({ clear: true })}
          >
            Bỏ hẹn giờ
          </button>
        )}
      </div>
    </form>
  );
}

export default function Access({ data, reload }) {
  const { project: p, memberCount } = data;
  const open = p.state.key === "on";
  const protect = p.protect;
  return (
    <div className="cols">
      <section className="card">
        <h2>Hẹn giờ mở/đóng</h2>
        {p.can.editor ? (
          <ScheduleForm p={p} reload={reload} />
        ) : (
          <>
            <ol className="rows">
              <li>
                <span className="t">Mở lúc</span>
                <span className="n">{fmtTime(p.openAt) || "—"}</span>
              </li>
              <li>
                <span className="t">Đóng lúc</span>
                <span className="n">{fmtTime(p.closeAt) || "—"}</span>
              </li>
            </ol>
            <p className="muted" style={{ margin: "16px 0 0" }}>
              Cần vai trò Điều hành để đổi lịch.
            </p>
          </>
        )}
      </section>
      <section className="card">
        <h2>Ai được vào</h2>
        <ol className="rows">
          <li>
            <span className="t">Khách</span>
            <span className="n">{open ? "Được" : "Chặn"}</span>
            <span className="d">{open ? "Dự án đang mở." : "Thấy trang tạm đóng."}</span>
          </li>
          <li>
            <span className="t">Thành viên dự án</span>
            <span className="n">{memberCount}</span>
            <span className="d">Xem trước được cả khi dự án tắt (gồm quản trị viên).</span>
          </li>
          <li>
            <span className="t">Đường dẫn chỉ thành viên vào được</span>
            <span className="n">{protect.length}</span>
            <span className="d">
              {protect.length
                ? protect.map((x, i) => (
                    <Fragment key={x}>
                      {i > 0 && ", "}
                      <span className="mono">{x}</span>
                    </Fragment>
                  ))
                : "Không có."}
              {p.can.owner && " Sửa ở tab Cài đặt."}
            </span>
          </li>
        </ol>
      </section>
    </div>
  );
}
