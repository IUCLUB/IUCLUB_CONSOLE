import { useState } from "react";
import { api, useTitle } from "../api.js";
import Logo from "../components/Logo.jsx";

const CHECK = (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
    <path
      d="M2 5.2 4.1 7.3 8 2.8"
      fill="none"
      stroke="#000"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const FEATURES = [
  "Bật, tắt và hẹn giờ mở từng dự án",
  "Theo dõi dự án sống hay chết mỗi phút",
  "Phân quyền theo dự án: Xem, Điều hành, Chủ dự án",
  "Xuất dữ liệu và nhật ký mọi thao tác",
];

export default function Login() {
  useTitle("Đăng nhập");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (ev) => {
    ev.preventDefault();
    const f = Object.fromEntries(new FormData(ev.currentTarget));
    const next = new URLSearchParams(location.search).get("next") || "";
    setBusy(true);
    try {
      const { to } = await api("/api/login", { method: "POST", body: { ...f, next } });
      location.href = to; // tải hẳn trang: `to` có thể là domain của dự án
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="auth">
      <section className="hero">
        <div className="logo">
          <Logo />
          IU CLUB <span style={{ color: "rgba(255,255,255,.75)" }}>Console</span>
        </div>
        <div>
          <h1>Mọi dự án của câu lạc bộ, một nơi.</h1>
          <p className="lede">Đăng nhập để quản lý những dự án bạn tham gia.</p>
        </div>
        <ul className="feat">
          {FEATURES.map((t) => (
            <li key={t}>
              <i>{CHECK}</i>
              {t}
            </li>
          ))}
        </ul>
      </section>
      <div className="side">
        <form className="f" onSubmit={submit}>
          <div>
            <h2>Đăng nhập</h2>
            <p className="lede" style={{ fontSize: 15 }}>
              Dùng tài khoản do quản trị viên cấp cho bạn.
            </p>
          </div>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required autoFocus />
          </label>
          <label>
            Mật khẩu
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {err && (
            <p className="err" role="alert">
              {err}
            </p>
          )}
          <button className="btn pri" disabled={busy}>
            Đăng nhập
          </button>
          <p className="muted" style={{ margin: 0 }}>
            Chưa có tài khoản? Nhờ quản trị viên của câu lạc bộ tạo cho bạn.
          </p>
        </form>
      </div>
    </div>
  );
}
