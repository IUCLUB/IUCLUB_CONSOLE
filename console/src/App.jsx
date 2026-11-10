import { Route, Routes } from "react-router-dom";
import { MeContext, useApi } from "./api.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import Home from "./pages/Home.jsx";
import Monitor from "./pages/Monitor.jsx";
import Schedule from "./pages/Schedule.jsx";
import Activity from "./pages/Activity.jsx";
import Guide from "./pages/Guide.jsx";
import Account from "./pages/Account.jsx";
import Users from "./pages/Users.jsx";
import NewProject from "./pages/NewProject.jsx";
import Project from "./project/Project.jsx";

// Các trang cần đăng nhập: nạp /api/me một lần (401 thì api() tự chuyển sang /login)
function Signed() {
  const { data, error } = useApi("/api/me");
  if (error) return <p className="err">{error.message}</p>;
  if (!data) return null;
  return (
    <MeContext.Provider value={data}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/account" element={<Account />} />
          <Route path="/users" element={<Users />} />
          <Route path="/new" element={<NewProject />} />
          <Route path="/p/:slug" element={<Project />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </MeContext.Provider>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Signed />} />
    </Routes>
  );
}
