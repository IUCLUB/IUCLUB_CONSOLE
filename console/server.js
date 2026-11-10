// IU CLUB Console: trang quản trị chung + "cổng" (forward_auth) cho gateway Caddy.
// Không phụ thuộc thư viện ngoài lúc chạy: node:http + file JSON. Giao diện React (src/) build ra dist/.
// Thứ tự: cổng → domain admin → webhook → /api/* → giao diện (static.js).
import http from "node:http";
import { verify, cookie } from "./lib.js";
import { PORT, SECRET, CONSOLE_HOST } from "./server/config.js";
import { activeUser } from "./server/store.js";
import { send, json, redirect } from "./server/http.js";
import { guardMutation, handleSession, handoff, noAccess } from "./server/session.js";
import { handleApi } from "./server/api.js";
import { simplePage, handleGateway, handleHook } from "./server/gateway.js";
import { serveApp } from "./server/static.js";
// Hai module này tự khởi chạy vòng nền khi được nạp: giám sát mỗi phút, kiểm tra sao lưu mỗi 10 phút.
import "./server/backup.js";
import "./server/monitor.js";

async function route(req, res) {
  const url = new URL(req.url, "http://x");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "");
  const proto = String(req.headers["x-forwarded-proto"] || "http");
  const secure = proto === "https";

  if (await handleGateway(req, res, url, host, proto)) return;

  // Console (chỉ trên domain admin)
  if (host !== CONSOLE_HOST) return send(res, 404, simplePage("Không tìm thấy", ""));

  if (await handleHook(req, res, url)) return;
  const me = activeUser(verify(SECRET, "c", cookie(req.headers.cookie, "iu_c"))?.email);

  if (url.pathname.startsWith("/api/")) {
    if (req.method !== "GET") {
      const bad = guardMutation(req);
      if (bad) return json(res, 403, { error: bad });
    }
    if (await handleSession(req, res, url, { me, secure })) return;
    if (await handleApi(req, res, url, me)) return;
    return me
      ? json(res, 404, { error: "Không tìm thấy." })
      : json(res, 401, { error: "Cần đăng nhập." });
  }
  // Đã đăng nhập mà vào /login (thường do cổng dự án chuyển tới): cấp vé ngay, không bắt gõ lại mật khẩu
  if (url.pathname === "/login" && req.method === "GET" && me) {
    const h = handoff(url.searchParams.get("next") || "", me);
    return h.deny
      ? send(res, 403, simplePage("Chưa có quyền", noAccess(h.deny)))
      : redirect(res, h.to);
  }
  // Chưa đăng nhập vẫn nhận giao diện; giao diện gặp 401 thì tự chuyển sang /login
  if (serveApp(req, res, url)) return;
  send(res, 404, simplePage("Không tìm thấy", ""));
}

http
  .createServer((req, res) =>
    route(req, res).catch((err) => {
      console.error(err);
      if (res.headersSent) return;
      if (req.url.startsWith("/api/")) json(res, 500, { error: "Có lỗi xảy ra." });
      else send(res, 500, simplePage("Lỗi", "Có lỗi xảy ra."));
    }),
  )
  .listen(PORT, () => console.log(`console :${PORT}`));
