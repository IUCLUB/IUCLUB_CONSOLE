// Phần logic thuần (không I/O) của Console: ký phiên, quyết định ở cổng, đọc số liệu.
import crypto from "node:crypto";
import { stateOf } from "./shared.js";

export * from "./shared.js";

const b64 = (s) => Buffer.from(s).toString("base64url");
const hmac = (secret, s) => crypto.createHmac("sha256", secret).update(s).digest("base64url");
const same = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest(),
    y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

/** Chuỗi ký HMAC, không cần lưu phiên ở server. `kind` tách vé chuyển tiếp với phiên đăng nhập. */
export function sign(secret, kind, data, ttlSec) {
  const body = b64(JSON.stringify({ ...data, k: kind, exp: Date.now() + ttlSec * 1000 }));
  return `${body}.${hmac(secret, body)}`;
}
export function verify(secret, kind, token) {
  if (!token || typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac || !same(mac, hmac(secret, body))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, "base64url").toString());
    return d.k === kind && d.exp > Date.now() ? d : null;
  } catch {
    return null;
  }
}

/** "a@x.vn:matkhau; b@y.vn:matkhau2" → [{ email, password }] (tài khoản khởi tạo từ .env) */
export function parseUsers(spec) {
  return String(spec || "")
    .split(";")
    .map((part) => {
      const i = part.indexOf(":");
      return i < 1
        ? null
        : { email: part.slice(0, i).trim().toLowerCase(), password: part.slice(i + 1).trim() };
    })
    .filter((u) => u && u.email && u.password);
}

// Mật khẩu: scrypt + muối ngẫu nhiên, so sánh hằng thời gian
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(String(pw), salt, 32).toString("hex")}`;
}
export function verifyPassword(pw, stored) {
  const [kind, salt, hash] = String(stored || "").split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const a = crypto.scryptSync(String(pw ?? ""), salt, 32),
    b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Phân quyền theo dự án. Quản trị viên (super) có mọi quyền ở mọi dự án (ROLES ở shared.js).
const RANK = { viewer: 1, editor: 2, owner: 3 };
export const roleOf = (user, slug) =>
  !user || user.disabled ? null : user.super ? "super" : user.projects?.[slug] || null;
/** need: "viewer" | "editor" | "owner" | "super" */
export function can(user, slug, need) {
  const r = roleOf(user, slug);
  if (!r) return false;
  if (r === "super") return true;
  return need !== "super" && (RANK[r] || 0) >= RANK[need];
}

export const cookie = (header, name) => {
  for (const c of String(header || "").split(";")) {
    const [k, ...v] = c.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
};

/** Khóa riêng của từng dự án: gateway gửi kèm, dự án so với biến IU_KEY. Dự án khác trong mạng không giả được. */
export const projectKey = (secret, slug) => hmac(secret, "project:" + slug);

export const slugOf = (host) =>
  String(host || "")
    .split(":")[0]
    .split(".")[0]
    .toLowerCase();

export const isProtected = (protect, path) =>
  (protect || []).some(
    (pre) => pre && (path === pre || path.startsWith(pre.endsWith("/") ? pre : pre + "/")),
  );

/**
 * Cổng quyết định cho mỗi request vào một dự án.
 * → { status: 200, upstream, user } | { status: 302, location } | { status: 401|404|503, page }
 */
export function gate({ project, uri, user, method, origin, consoleUrl, now = Date.now() }) {
  if (!project) return { status: 404, page: "notfound" };
  const path = uri.split("?")[0];
  const login = `${consoleUrl}/login?next=${encodeURIComponent(origin + uri)}`;
  if (stateOf(project, now).key !== "on" && !user) return { status: 503, page: "closed", login };
  if (isProtected(project.protect, path) && !user) {
    return method === "GET" ? { status: 302, location: login } : { status: 401, page: "denied" };
  }
  return { status: 200, upstream: project.upstream, user };
}

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;
export const UPSTREAM = /^[a-z0-9][a-z0-9._-]*:\d{1,5}$/i;
export const RESERVED = new Set(["admin", "www", "api"]);

/** Đuôi file sao lưu: theo tên file dự án gửi (Content-Disposition), không có thì theo Content-Type */
export function exportExt(disposition, type) {
  const name = /filename="?([^";]+)/i.exec(disposition || "")?.[1] || "";
  const ext = /\.([a-z0-9]{1,10})$/i.exec(name)?.[1];
  if (ext) return "." + ext.toLowerCase();
  const t = String(type || "");
  for (const [k, v] of [
    ["sqlite", ".sqlite"],
    ["json", ".json"],
    ["csv", ".csv"],
    ["zip", ".zip"],
    ["gzip", ".gz"],
  ])
    if (t.includes(k)) return v;
  return ".bin";
}
