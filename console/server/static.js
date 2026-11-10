// Giao diện React: phục vụ file trong dist/ (vite build), đường dẫn khác trả index.html để React Router lo.
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
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

// File tĩnh trong dist/, chặn thoát ra ngoài dist/ (như templates/starter/server.js)
function sendStatic(res, urlPath) {
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
}

/** GET/HEAD ngoài /api/ trên domain admin. Trả true nếu đã xử lý request. */
export function serveApp(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (sendStatic(res, url.pathname)) return true;
  // Đọc mỗi lần: build lại khi server đang chạy vẫn nhận bản mới
  const index = path.join(DIST, "index.html");
  if (!fs.existsSync(index)) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end("Chưa có dist/. Chạy `npm run build` (hoặc `npm run dev` khi phát triển).");
    return true;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
  res.end(fs.readFileSync(index));
  return true;
}
