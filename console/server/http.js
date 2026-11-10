// ---------- HTTP helpers ----------
import crypto from "node:crypto";

export async function rawBody(req, max) {
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > max) throw Object.assign(new Error("body quá lớn"), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
export const sameStr = (a, b) =>
  crypto.timingSafeEqual(
    crypto.createHash("sha256").update(a).digest(),
    crypto.createHash("sha256").update(b).digest(),
  );

export const send = (res, status, html, headers = {}) => {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
  res.end(html);
};
export const redirect = (res, to, headers = {}) => {
  res.writeHead(302, { location: to, ...headers });
  res.end();
};
export const setCookie = (name, value, maxAge, secure) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
export const json = (res, status, data, headers = {}) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(data));
};
// Đọc body JSON; JSON hỏng → lỗi có status 400 để nơi gọi trả {error}.
export async function readJson(req, max = 64_000) {
  const raw = (await rawBody(req, max)).toString("utf8");
  try {
    const v = raw ? JSON.parse(raw) : {};
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {}
  throw Object.assign(new Error("JSON không hợp lệ."), { status: 400 });
}
export const ipOf = (req) =>
  String(req.headers["x-forwarded-for"] || req.socket.remoteAddress)
    .split(",")[0]
    .trim();
