import { useContext } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { MeContext, api } from "../api.js";
import SlideNav from "./SlideNav.jsx";

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
        <Link className="logo" to="/">
          <i>IU</i>IU CLUB <span>Console</span>
        </Link>
        <SlideNav name="nav" label="Phân hệ" items={items} current={current} />
        <div className="who">
          <Link
            to="/account"
            aria-current={path === "/account" ? "page" : undefined}
            title="Tài khoản"
          >
            {user.name || user.email}
          </Link>
          <button type="button" className="btn link" onClick={logout}>
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
