import { useContext } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { MeContext, api } from "../api.js";
import SlideNav from "./SlideNav.jsx";
import Logo from "./Logo.jsx";
import { initials } from "./Mark.jsx";

const NAV = [
  ["/", "Dự án"],
  ["/monitor", "Giám sát"],
  ["/schedule", "Lịch"],
  ["/activity", "Nhật ký"],
  ["/guide", "Hướng dẫn"],
];

// Khung chung: thanh điều hướng giữ nguyên khi đổi trang (để chỉ báo trượt), trang con ở <Outlet>
export default function Layout() {
  const { user } = useContext(MeContext);
  const path = useLocation().pathname;
  const items = [...NAV, ...(user.super ? [["/users", "Thành viên"]] : [])];
  // Như layout() cũ: trang dự án, dự án mới, không tìm thấy → sáng "Dự án"; trang Tài khoản → không mục nào
  const current = items.some(([h]) => h === path) ? path : path === "/account" ? "" : "/";
  const logout = async () => {
    await api("/api/logout", { method: "POST" });
    location.href = "/login";
  };
  return (
    <>
      <a className="skip" href="#main">
        Bỏ qua điều hướng
      </a>
      <header className="nav">
        {/* Thương hiệu tách khỏi các tab bằng vạch dọc, để không bị nhầm là một tab */}
        <Link className="logo" to="/" title="IU CLUB Console">
          <Logo />
          IU CLUB
        </Link>
        <span className="nav-sep" aria-hidden="true"></span>
        <SlideNav name="nav" label="Phân hệ" items={items} current={current} />
        <div className="who">
          {/* Tài khoản: viên thuốc có chữ viết tắt + tên, giống nút ghost trong DESIGN.md */}
          <Link
            className="me"
            to="/account"
            aria-current={path === "/account" ? "page" : undefined}
            title={`Tài khoản: ${user.email}`}
          >
            <i aria-hidden="true">{initials(user.name || user.email)}</i>
            <span>{user.name || user.email}</span>
          </Link>
          <button type="button" className="btn sm" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
    </>
  );
}
