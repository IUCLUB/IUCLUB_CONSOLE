// Đăng nhập/đăng xuất/phiên qua JSON API.
import { sign, verifyPassword, can, slugOf } from "../lib.js";
import { SECRET, CONSOLE_URL, CONSOLE_HOST, projectUrl } from "./config.js";
import { find, activeUser } from "./store.js";
import { json, readJson, setCookie, ipOf } from "./http.js";
import { userView, configView } from "./views.js";

// Chống dò mật khẩu: 10 lần sai / 15 phút / IP. ponytail: trong RAM.
const fails = new Map();

export const noAccess = (p) =>
  `Bạn chưa được thêm vào dự án “${p.name}”. Nhờ chủ dự án thêm bạn ở tab Thành viên.`;

// Sau khi đăng nhập: nếu đang đi tới một dự án (và có quyền) thì cấp vé 60 giây sang domain đó
export const handoff = (next, u) => {
  try {
    const x = new URL(next);
    if (x.host === CONSOLE_HOST) {
      // Chặn đường dẫn bắt đầu bằng hai dấu gạch chéo: trình duyệt hiểu là domain khác (open redirect).
      if (x.pathname.startsWith("//") || x.pathname.startsWith("/\\")) return { to: "/" };
      return { to: x.pathname + x.search };
    }
    const p = find(slugOf(x.host));
    if (p && new URL(projectUrl(p.slug)).host === x.host) {
      if (!can(u, p.slug, "viewer")) return { deny: p };
      return {
        to: `${x.origin}/__iu/auth?t=${sign(SECRET, "h", { email: u.email, next: x.href }, 60)}`,
      };
    }
  } catch {}
  return { to: "/" };
};

// → {status, error?, to?, cookie?, user?}; cookie là giá trị set-cookie.
function login(req, { email, password, next }) {
  const ip = ipOf(req),
    now = Date.now();
  const list = (fails.get(ip) || []).filter((t) => now - t < 15 * 60_000);
  if (list.length >= 10) return { status: 429, error: "Sai quá nhiều lần. Thử lại sau 15 phút." };
  const u = activeUser(email);
  if (!u || !verifyPassword(password, u.hash)) {
    fails.set(ip, [...list, now]);
    return { status: 401, error: "Email hoặc mật khẩu không đúng." };
  }
  fails.delete(ip);
  const h = handoff(next || "", u);
  const cookie = setCookie(
    "iu_c",
    sign(SECRET, "c", { email: u.email }, 12 * 3600),
    12 * 3600,
    req.headers["x-forwarded-proto"] === "https",
  );
  return h.deny
    ? { status: 403, error: noAccess(h.deny), cookie, user: u }
    : { status: 200, to: h.to, cookie, user: u };
}

// CSRF cho mọi /api/* không phải GET: chỉ nhận JSON và đúng nguồn.
export function guardMutation(req) {
  const ct = String(req.headers["content-type"] || "");
  if (!/^application\/json\s*(;|$)/i.test(ct)) return "Sai nguồn gửi.";
  const o = req.headers.origin;
  return o && o !== new URL(CONSOLE_URL).origin ? "Sai nguồn gửi." : null;
}

export async function handleSession(req, res, url, { me, secure }) {
  const path = url.pathname;
  if (path === "/api/login" && req.method === "POST") {
    let f;
    try {
      f = await readJson(req);
    } catch (err) {
      json(res, err.status || 400, { error: err.message });
      return true;
    }
    const r = login(req, f);
    json(
      res,
      r.status,
      r.error ? { error: r.error } : { to: r.to },
      r.cookie && { "set-cookie": r.cookie },
    );
    return true;
  }
  if (path === "/api/logout" && req.method === "POST") {
    json(res, 200, {}, { "set-cookie": setCookie("iu_c", "", 0, secure) });
    return true;
  }
  if (path === "/api/me" && req.method === "GET") {
    if (!me) json(res, 401, { error: "Cần đăng nhập." });
    else json(res, 200, { user: userView(me), config: configView() });
    return true;
  }
  return false;
}
