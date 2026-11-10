import { useContext, useState } from "react";
import { Link } from "react-router-dom";
import { MeContext, api, useApi, useTitle } from "../api.js";
import PageHead from "../components/PageHead.jsx";
import Message from "../components/Message.jsx";
import { RoleBadge, roleName } from "../components/Badges.jsx";
import RoleHelp from "../components/RoleHelp.jsx";

const EMPTY = { current: "", next: "", confirm: "" };

function Password() {
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState({});
  const field = (name) => ({
    name,
    value: f[name],
    onChange: (e) => setF({ ...f, [name]: e.target.value }),
  });
  const submit = async (ev) => {
    ev.preventDefault();
    try {
      await api("/api/account/password", { method: "POST", body: f });
      setF(EMPTY);
      setMsg({ ok: "Đã đổi mật khẩu." });
    } catch (e) {
      setMsg({ err: e.message });
    }
  };
  return (
    <form className="f" onSubmit={submit}>
      <label>
        Mật khẩu hiện tại
        <input type="password" autoComplete="current-password" required {...field("current")} />
      </label>
      <div className="two">
        <label>
          Mật khẩu mới <small>ít nhất 10 ký tự</small>
          <input
            type="password"
            autoComplete="new-password"
            minLength="10"
            required
            {...field("next")}
          />
        </label>
        <label>
          Nhập lại
          <input
            type="password"
            autoComplete="new-password"
            minLength="10"
            required
            {...field("confirm")}
          />
        </label>
      </div>
      <Message err={msg.err} ok={msg.ok} />
      <div>
        <button className="btn pri">Đổi mật khẩu</button>
      </div>
    </form>
  );
}

// Dự án của người không phải quản trị viên; tên lấy từ /api/home, chưa có thì hiện slug
function Mine({ projects }) {
  const mine = Object.entries(projects);
  const { data, loading } = useApi("/api/home");
  if (!mine.length) return <p className="empty">Bạn chưa thuộc dự án nào.</p>;
  if (loading) return <p className="empty">Đang tải…</p>;
  const nameOf = (s) => data?.projects.find((p) => p.slug === s)?.name || s;
  return (
    <ol className="rows">
      {mine.map(([s, r]) => (
        <li key={s}>
          <Link className="t" to={`/p/${s}`}>
            {nameOf(s)}
          </Link>
          <span className="n">{roleName(r)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Account() {
  useTitle("Tài khoản");
  const { user: me } = useContext(MeContext);
  return (
    <>
      <PageHead title="Tài khoản" lede={me.email} />
      <section className="sec cols">
        <div className="card">
          <h2>Đổi mật khẩu</h2>
          <Password />
        </div>
        <div className="card">
          <h2>Quyền của bạn</h2>
          {me.super ? (
            <p className="empty" style={{ color: "var(--ash)" }}>
              <RoleBadge role="super" /> Toàn quyền ở mọi dự án và quản lý tài khoản.
            </p>
          ) : (
            <Mine projects={me.projects} />
          )}
          <div className="wash" style={{ margin: "24px 0" }}></div>
          <RoleHelp />
        </div>
      </section>
    </>
  );
}
