// Dự án mẫu IU CLUB: đáp ứng đủ "hợp đồng" với gateway + Console, không phụ thuộc thư viện.
// Giao diện React (src/) được `vite build` ra dist/, file này phục vụ dist/ + API.
// Thay bằng Next/Express tuỳ ý, miễn giữ đủ 5 điểm trong README.md.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const { PORT = 3000, IU_KEY, ADMIN_API_TOKEN, NODE_ENV } = process.env;
// Chỉ khi chạy trên máy: coi như đã đăng nhập Console để thử /admin. Trên server (production) luôn tắt.
const DEV_USER = NODE_ENV !== "production" && process.env.DEV_USER;
const same = (a, b) => {
  const h = (s) => crypto.createHash("sha256").update(String(s)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};
// Người đang đăng nhập Console (gateway gắn kèm + khóa riêng của dự án), hoặc null.
const consoleUser = (req) =>
  DEV_USER ||
  (IU_KEY && req.headers["x-iu-user"] && same(req.headers["x-iu-key"] || "", IU_KEY)
    ? req.headers["x-iu-user"]
    : null);
const ROLES = ["viewer", "editor", "owner", "super"];
const consoleRole = (req) => {
  if (DEV_USER) return "owner";
  return ROLES.includes(req.headers["x-iu-role"]) ? req.headers["x-iu-role"] : "viewer";
};
// Console gọi API số liệu bằng Bearer token
const isAdmin = (req) =>
  consoleUser(req) ||
  (ADMIN_API_TOKEN && same(req.headers.authorization || "", `Bearer ${ADMIN_API_TOKEN}`));

// SQLite có sẵn trong Node 22. File DB nằm ở DATA_DIR (volume trong docker-compose.yml).
const DATA_DIR = process.env.DATA_DIR || path.resolve(import.meta.dirname, "data");
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "app.db"));
db.exec(`PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);`);
const countVisit = db.prepare(
  "INSERT INTO counters VALUES ('visits', 1) ON CONFLICT(name) DO UPDATE SET value = value + 1",
);
const visits = () =>
  db.prepare("SELECT value FROM counters WHERE name = 'visits'").get()?.value ?? 0;
// Bản sao nhất quán của cả DB (kể cả khi đang ghi), dùng cho "Xuất dữ liệu" và sao lưu hằng đêm của Console
const exportDb = () => {
  const tmp = path.join(os.tmpdir(), `export-${crypto.randomUUID()}.sqlite`);
  db.prepare("VACUUM INTO ?").run(tmp);
  const buf = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  return buf;
};

const json = (res, status, data) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

const DIST = path.resolve(import.meta.dirname, "dist");
const page = fs.existsSync(path.join(DIST, "index.html"))
  ? fs.readFileSync(path.join(DIST, "index.html"))
  : "Chưa có dist/. Chạy `npm run build` (hoặc `npm run dev` khi phát triển).";
const sendPage = (res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page);
};
const TYPES = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};
// File tĩnh trong dist/ (assets của Vite + nội dung public/), chặn thoát ra ngoài dist/
const sendStatic = (res, urlPath) => {
  let file;
  try {
    file = path.join(DIST, decodeURIComponent(urlPath));
  } catch {
    return false;
  }
  if (!file.startsWith(DIST + path.sep) || !fs.statSync(file, { throwIfNoEntry: false })?.isFile())
    return false;
  const immutable = urlPath.startsWith("/assets/"); // tên file có hash, cache lâu được
  res.writeHead(200, {
    "content-type": TYPES[path.extname(file)] || "application/octet-stream",
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
  });
  fs.createReadStream(file).pipe(res);
  return true;
};

http
  .createServer((req, res) => {
    const urlPath = req.url.split("?")[0];
    if (urlPath === "/api/health") return json(res, 200, { ok: true });
    if (urlPath === "/api/admin/stats")
      return isAdmin(req)
        ? json(res, 200, { visits: visits() })
        : json(res, 401, { error: "unauthorized" });
    if (urlPath === "/api/admin/export") {
      if (!isAdmin(req)) return json(res, 401, { error: "unauthorized" });
      res.writeHead(200, {
        "content-type": "application/vnd.sqlite3",
        "content-disposition": `attachment; filename="${process.env.IU_SLUG || "app"}-${new Date().toISOString().slice(0, 10)}.sqlite"`,
      });
      return res.end(exportDb());
    }
    if (urlPath === "/api/admin/me") {
      const user = consoleUser(req);
      return user
        ? json(res, 200, { user, role: consoleRole(req) })
        : json(res, 401, { error: "unauthorized" });
    }
    if (urlPath === "/admin" || urlPath.startsWith("/admin/")) {
      // Gateway đã bắt đăng nhập Console trước khi tới đây
      return consoleUser(req) ? sendPage(res) : json(res, 401, { error: "unauthorized" });
    }
    if (urlPath === "/" || urlPath === "/index.html") {
      countVisit.run();
      return sendPage(res);
    }
    if (!urlPath.startsWith("/api/") && sendStatic(res, urlPath)) return;
    json(res, 404, { error: "not found" });
  })
  .listen(PORT, () => console.log(`IU CLUB project :${PORT}`));
