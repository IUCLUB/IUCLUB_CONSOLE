import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, useAction } from "../api.js";
import Message from "../components/Message.jsx";
import { AdvFields, NameField, binder, fieldsOf } from "../components/ProjectFields.jsx";

// Lỗi của cả hai form (lưu, xoá) hiện ở form Cài đặt như trang cũ
export default function Settings({ data, reload }) {
  const { project: p } = data;
  const navigate = useNavigate();
  const [f, setF] = useState(() => fieldsOf(p));
  const [confirm, setConfirm] = useState("");
  const { msg, busy, run } = useAction();
  const save = (ev) => {
    ev.preventDefault();
    // Token trống = giữ token cũ (server bỏ qua)
    const { token, ...rest } = f;
    run(async () => {
      await api(`/api/projects/${p.slug}`, { method: "PUT", body: token ? f : rest });
      setF((o) => ({ ...o, token: "" }));
      reload(); // tên mới → tiêu đề trang đổi theo (useTitle ở Project)
    }, "Đã lưu.");
  };
  const remove = async (ev) => {
    ev.preventDefault();
    const r = await run(() =>
      api(`/api/projects/${p.slug}/delete`, { method: "POST", body: { confirm } }),
    );
    if (r) navigate("/");
  };
  return (
    <div className="stack">
      <section className="card">
        <h2>Cài đặt</h2>
        <form className="f" onSubmit={save}>
          <NameField bind={binder(f, setF)} />
          <AdvFields bind={binder(f, setF)} hasToken={p.hasToken} />
          <Message err={msg.err} ok={msg.ok} />
          <div>
            <button className="btn pri" disabled={busy}>
              Lưu thay đổi
            </button>
          </div>
        </form>
      </section>
      {p.can.super && (
        <section className="card">
          <h2>Xoá khỏi Console</h2>
          <form className="f" onSubmit={remove}>
            <p className="muted" style={{ margin: 0 }}>
              Chỉ gỡ khỏi Console và gateway (kèm quyền thành viên), không đụng tới container hay dữ
              liệu của dự án.
            </p>
            <label>
              <span>
                Gõ <span className="mono">{p.slug}</span> để xác nhận
              </span>
              <input
                className="mono"
                name="confirm"
                autoComplete="off"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <div>
              <button className="btn bad" disabled={busy}>
                Xoá dự án
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
