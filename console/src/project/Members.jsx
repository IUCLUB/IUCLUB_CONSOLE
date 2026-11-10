import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { MeContext, api, useAction } from "../api.js";
import Message from "../components/Message.jsx";
import { RoleBadge } from "../components/Badges.jsx";
import RoleSelect from "../components/RoleSelect.jsx";
import RoleHelp from "../components/RoleHelp.jsx";

function MemberRow({ x, send, busy }) {
  const [role, setRole] = useState(x.role);
  const submit = (d) => (ev) => {
    ev.preventDefault();
    send({ do: d, email: x.email, role });
  };
  return (
    <tr>
      <td>
        {x.name}
        {x.self && (
          <>
            {" "}
            <span className="muted">(bạn)</span>
          </>
        )}
        {x.disabled && (
          <>
            {" "}
            <span className="pill">Đã khoá</span>
          </>
        )}
        <br />
        <span className="mono muted">{x.email}</span>
      </td>
      <td className="act">
        {x.self ? (
          <RoleBadge role={x.role} />
        ) : (
          <>
            <form onSubmit={submit("set")}>
              <RoleSelect value={role} onChange={setRole} small />
              <button className="btn sm" disabled={busy}>
                Lưu
              </button>
            </form>
            <form onSubmit={submit("remove")}>
              <button className="btn sm bad" disabled={busy}>
                Gỡ
              </button>
            </form>
          </>
        )}
      </td>
    </tr>
  );
}

// Chỉ chủ dự án thấy tab này nên luôn có data.members
export default function Members({ data, reload }) {
  const { user: me } = useContext(MeContext);
  const { project: p, members } = data;
  const { list, supers, candidates } = members;
  const { msg, busy, run } = useAction();
  const [pick, setPick] = useState("");
  const [role, setRole] = useState("editor");
  // Người vừa thêm biến khỏi danh sách chọn thì quay về người đầu tiên
  const email = candidates.some((c) => c.email === pick) ? pick : candidates[0]?.email || "";
  const send = (body) =>
    run(async () => {
      await api(`/api/projects/${p.slug}/members`, { method: "POST", body });
      reload();
    }, "Đã lưu.");
  return (
    <div className="cols">
      <section className="card scroll">
        <h2>Thành viên dự án</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th style={{ textAlign: "right" }}>Vai trò</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map((x) => (
                <MemberRow key={`${x.email}:${x.role}`} x={x} send={send} busy={busy} />
              ))
            ) : (
              <tr>
                <td colSpan="2" className="empty">
                  Chưa có thành viên riêng.
                </td>
              </tr>
            )}
            {supers.map((x) => (
              <tr key={x.email}>
                <td>
                  {x.name}
                  <br />
                  <span className="mono muted">{x.email}</span>
                </td>
                <td className="act">
                  <RoleBadge role="super" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(msg.err || msg.ok) && (
          <div style={{ marginTop: 16 }}>
            <Message err={msg.err} ok={msg.ok} />
          </div>
        )}
      </section>
      <section className="card">
        <h2>Thêm thành viên</h2>
        {candidates.length ? (
          <form
            className="f"
            onSubmit={(ev) => {
              ev.preventDefault();
              send({ do: "add", email, role });
            }}
          >
            <label>
              Tài khoản
              <select name="email" value={email} onChange={(e) => setPick(e.target.value)}>
                {candidates.map((x) => (
                  <option key={x.email} value={x.email}>
                    {x.name} · {x.email}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Vai trò
              <RoleSelect value={role} onChange={setRole} />
            </label>
            <div>
              <button className="btn pri" disabled={busy}>
                Thêm vào dự án
              </button>
            </div>
          </form>
        ) : (
          <p className="empty">Mọi tài khoản đều đã có trong dự án.</p>
        )}
        <p className="muted" style={{ margin: "20px 0 0" }}>
          {me.super ? (
            <>
              Người chưa có tài khoản? Tạo ở trang <Link to="/users">Thành viên</Link>.
            </>
          ) : (
            "Người chưa có tài khoản? Nhờ quản trị viên tạo."
          )}
        </p>
        <div className="wash" style={{ margin: "28px 0" }}></div>
        <RoleHelp />
      </section>
    </div>
  );
}
