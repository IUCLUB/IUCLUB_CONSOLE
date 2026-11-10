import { useState } from "react";
import { Link } from "react-router-dom";
import { api, useAction, useApi, useTitle } from "../api.js";
import PageHead from "../components/PageHead.jsx";
import Message, { Pending } from "../components/Message.jsx";
import { RoleBadge, roleName } from "../components/Badges.jsx";
import CodeBox from "../components/CodeBox.jsx";
import RoleHelp from "../components/RoleHelp.jsx";

const NEW = { email: "", name: "", super: false };

export default function Users() {
  useTitle("Thành viên");
  const { data, error } = useApi("/api/users");
  const home = useApi("/api/home"); // tên dự án cho các pill
  // Sau mỗi thao tác, server trả danh sách mới: dùng nó thay cho lần đọc đầu
  const [fresh, setUsers] = useState();
  const users = fresh || data?.users;
  // Thông báo của lần thao tác gần nhất: {pw} | {confirmDelete} | {deleted}
  const [note, setNote] = useState({});
  const [f, setF] = useState(NEW);
  const { msg, busy, run } = useAction();

  const send = (body) =>
    run(async () => {
      setNote({});
      const r = await api("/api/users", { method: "POST", body });
      setUsers(r.users);
      setNote({ pw: r.pw, confirmDelete: r.confirmDelete, deleted: r.deleted });
      return r;
    });
  const create = async (ev) => {
    ev.preventDefault();
    if (await send({ do: "create", ...f })) setF(NEW);
  };
  const nameOf = (s) => home.data?.projects.find((p) => p.slug === s)?.name || s;

  if (!users) return <Pending error={error} />;
  const { pw, confirmDelete: cd, deleted } = note;
  return (
    <>
      <PageHead
        title="Thành viên"
        lede="Tài khoản đăng nhập Console. Gán người vào từng dự án ở tab Thành viên của dự án đó."
      />
      {cd && (
        <section className="sec card notice" role="alert">
          <span className="pill">Xác nhận xoá</span>
          <p>
            Xoá tài khoản <b>{cd.name}</b> (<span className="mono">{cd.email}</span>)? Người này mất
            quyền ở mọi dự án và bị đăng xuất ngay. Không hoàn tác được; nhật ký cũ vẫn giữ email.
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={() => setNote({})}>
              Huỷ
            </button>
            <button
              type="button"
              className="btn bad"
              disabled={busy}
              onClick={() => send({ do: "delete", email: cd.email, confirm: "1" })}
            >
              Xác nhận xoá
            </button>
          </div>
        </section>
      )}
      {deleted && (
        <section className="sec card notice" role="status">
          <span className="pill on">Đã xoá</span>
          <p>
            Đã xoá tài khoản <span className="mono">{deleted}</span>.
          </p>
        </section>
      )}
      {pw && (
        <section className="sec card notice" role="status">
          <span className="pill on">Mật khẩu tạm</span>
          <p>
            Gửi cho <b>{pw.email}</b> qua kênh riêng. Mật khẩu chỉ hiện một lần; người dùng nên đổi
            ngay ở trang Tài khoản.
          </p>
          <CodeBox text={pw.pw} />
        </section>
      )}
      <section className="sec card scroll">
        <h2>Tài khoản</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Người dùng</th>
              <th>Vai trò hệ thống</th>
              <th>Dự án</th>
              <th>Trạng thái</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const ps = Object.entries(u.projects);
              const buttons = [
                ["reset", "Đặt lại mật khẩu"],
                ...(u.self
                  ? []
                  : [
                      ["super", u.super ? "Bỏ quản trị" : "Làm quản trị"],
                      ["lock", u.disabled ? "Mở khoá" : "Khoá"],
                      ["delete", "Xoá"],
                    ]),
              ];
              return (
                <tr key={u.email}>
                  <td>
                    {u.name}
                    {u.self && (
                      <>
                        {" "}
                        <span className="muted">(bạn)</span>
                      </>
                    )}
                    <br />
                    <span className="mono muted">{u.email}</span>
                  </td>
                  <td>
                    {u.super ? (
                      <RoleBadge role="super" />
                    ) : (
                      <span className="muted">Thành viên</span>
                    )}
                  </td>
                  <td>
                    {u.super ? (
                      <span className="muted">Mọi dự án</span>
                    ) : ps.length ? (
                      <div className="row">
                        {ps.map(([s, r]) => (
                          <Link key={s} className="pill" to={`/p/${s}?tab=members`}>
                            {nameOf(s)} · {roleName(r)}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {u.disabled ? (
                      <span className="pill">Đã khoá</span>
                    ) : (
                      <span className="pill on">Hoạt động</span>
                    )}
                  </td>
                  <td className="act">
                    {buttons.map(([d, l]) => (
                      <button
                        key={d}
                        type="button"
                        className={`btn sm${(d === "lock" && !u.disabled) || d === "delete" ? " bad" : ""}`}
                        disabled={busy}
                        aria-label={d === "delete" ? `Xoá tài khoản ${u.email}` : undefined}
                        onClick={() => send({ do: d, email: u.email })}
                      >
                        {l}
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="sec cols">
        <div className="card">
          <h2>Thêm tài khoản</h2>
          <form className="f" onSubmit={create}>
            <div className="two">
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="off"
                  value={f.email}
                  onChange={(e) => setF({ ...f, email: e.target.value })}
                />
              </label>
              <label>
                Tên hiển thị
                <input
                  name="name"
                  maxLength="60"
                  autoComplete="off"
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                />
              </label>
            </div>
            <label className="check">
              <input
                type="checkbox"
                name="super"
                checked={f.super}
                onChange={(e) => setF({ ...f, super: e.target.checked })}
              />{" "}
              Quản trị viên (toàn quyền)
            </label>
            <Message err={msg.err} />
            <div className="row">
              <button className="btn pri" disabled={busy}>
                Tạo tài khoản
              </button>
              <span className="muted">Console sinh mật khẩu tạm và hiện một lần.</span>
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Các vai trò</h2>
          <RoleHelp />
        </div>
      </section>
    </>
  );
}
