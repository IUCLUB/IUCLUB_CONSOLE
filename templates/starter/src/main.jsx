import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Admin from "./Admin.jsx";
import "./style.css";

// ponytail: 2 trang nên chọn theo đường dẫn; cần nhiều trang hơn thì thêm react-router
const isAdmin = location.pathname === "/admin" || location.pathname.startsWith("/admin/");

createRoot(document.getElementById("root")).render(
  <StrictMode>{isAdmin ? <Admin /> : <App />}</StrictMode>,
);
