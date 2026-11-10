// Cổng cho gateway Caddy (forward_auth), vé chuyển tiếp, /tls-ask, webhook GitHub.
// Kèm trang HTML của cổng (closedPage, simplePage); CSS đọc từ src/style.css một lần lúc khởi động.
import crypto from "node:crypto";
import fs from "node:fs";
import {
  projectKey,
  sign,
  verify,
  roleOf,
  can,
  cookie,
  slugOf,
  gate,
  stateOf,
  fmtTime,
} from "../lib.js";
import { SECRET, GATE_SECRET, CONSOLE_URL, projectUrl } from "./config.js";
import { find, activeUser } from "./store.js";
import { startDeploy } from "./deploy.js";
import { rawBody, sameStr, send, redirect, setCookie } from "./http.js";

const e = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// ---------- Giao diện (console/DESIGN.md) cho trang cổng; CSS dùng chung với giao diện React ở src/style.css ----------
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500&family=Geist:wght@500;600&family=Geist+Mono:wght@400&display=swap" rel="stylesheet">`;
const CSS = fs.readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const head = (title) =>
  `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${e(title)} · IU CLUB Console</title>${FONTS}<style>${CSS}</style></head><body>`;

// Mỗi dự án lệch sắc độ gradient một chút (−36°…+36°) để nhận ra nhau, vẫn trong dải amber → cobalt
const hueOf = (slug) => (([...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 7) - 3) * 12;
const initials = (name) =>
  String(name)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
const mark = (p) =>
  `<span class="mark" style="--h:${hueOf(p.slug)}deg" aria-hidden="true">${e(initials(p.name))}</span>`;

function closedPage(p, login) {
  const s = stateOf(p);
  const when =
    s.key === "soon"
      ? `Mở lúc ${fmtTime(s.at)}.`
      : s.key === "ended"
        ? `Đã đóng lúc ${fmtTime(s.at)}.`
        : "Dự án đang tạm đóng.";
  return `${head(p.name + " · Tạm đóng")}<div class="center"><div class="card" style="text-align:center;justify-items:center">${mark(p)}
  <h1 style="font-size:32px">${e(p.name)}</h1><p class="lede" style="margin:0 auto">${e(p.closedMsg || when + " Bạn quay lại sau nhé.")}</p>
  <a class="btn link" href="${e(login)}">Thành viên dự án đăng nhập để xem trước</a></div></div></body></html>`;
}
export const simplePage = (t, msg) => `${head(t)}
<div class="center"><div class="card" style="text-align:center;max-width:520px;margin:0 auto"><h1 style="font-size:32px">${e(t)}</h1><p class="lede" style="margin:12px auto 0">${e(msg)}</p></div></div>
</body></html>`;

// ---------- Định tuyến cổng (chạy trước khi kiểm tra domain admin) ----------
/** Trả true nếu đã xử lý request. */
export async function handleGateway(req, res, url, host, proto) {
  const secure = proto === "https";

  // 1. Cổng cho gateway (forward_auth): quyết định từng request vào dự án.
  // Quyền được tra lại ở mỗi request nên gỡ thành viên là có hiệu lực ngay.
  if (url.pathname === "/gate") {
    // Chỉ Caddy (gửi kèm X-Iu-Gate) được hỏi cổng; container khác trong mạng gọi thẳng thì chặn
    if (!sameStr(String(req.headers["x-iu-gate"] || ""), GATE_SECRET)) {
      res.writeHead(403);
      res.end();
      return true;
    }
    const project = find(slugOf(host));
    const u = activeUser(verify(SECRET, "s", cookie(req.headers.cookie, "iu_s"))?.email);
    const member = project && can(u, project.slug, "viewer") ? u : null;
    const d = gate({
      project,
      uri: String(req.headers["x-forwarded-uri"] || "/"),
      user: member?.email || null,
      method: String(req.headers["x-forwarded-method"] || "GET"),
      origin: `${proto}://${host}`,
      consoleUrl: CONSOLE_URL,
    });
    if (d.status === 200) {
      res.writeHead(200, {
        "x-iu-upstream": d.upstream,
        "x-iu-key": projectKey(SECRET, project.slug),
        ...(member ? { "x-iu-user": member.email, "x-iu-role": roleOf(member, project.slug) } : {}),
      });
      res.end();
    } else if (d.status === 302) redirect(res, d.location);
    else if (d.page === "closed")
      send(res, 503, closedPage(project, d.login), { "cache-control": "no-store" });
    else
      send(
        res,
        d.status,
        d.page === "notfound"
          ? simplePage("Không có dự án này", "Kiểm tra lại địa chỉ.")
          : simplePage("Cần đăng nhập", "Hãy đăng nhập Console bằng tài khoản thuộc dự án này."),
      );
    return true;
  }
  // 2. Nhận vé từ Console, đặt phiên trên chính domain của dự án
  if (url.pathname === "/__iu/auth") {
    const t = verify(SECRET, "h", url.searchParams.get("t"));
    let ok = false;
    try {
      ok = t && new URL(t.next).host === host;
    } catch {}
    if (!ok) send(res, 400, simplePage("Liên kết hết hạn", "Hãy đăng nhập lại."));
    else
      redirect(res, t.next, {
        "set-cookie": setCookie(
          "iu_s",
          sign(SECRET, "s", { email: t.email }, 12 * 3600),
          12 * 3600,
          secure,
        ),
      });
    return true;
  }
  if (url.pathname === "/__iu/logout") {
    redirect(res, "/", { "set-cookie": setCookie("iu_s", "", 0, secure) });
    return true;
  }
  // Caddy on_demand_tls hỏi trước khi xin chứng chỉ cho một subdomain (dùng khi chạy thật)
  if (url.pathname === "/tls-ask") {
    const d = String(url.searchParams.get("domain") || "");
    res.writeHead(
      d === new URL(CONSOLE_URL).hostname ||
        (find(slugOf(d)) && new URL(projectUrl(slugOf(d))).hostname === d)
        ? 200
        : 404,
    );
    res.end();
    return true;
  }
  return false;
}

// Webhook GitHub: push lên đúng nhánh thì triển khai. Xác thực bằng chữ ký HMAC riêng của từng dự án.
// Chạy sau khi kiểm tra domain admin (giữ thứ tự cũ). Trả true nếu đã xử lý request.
export async function handleHook(req, res, url) {
  const hook = req.method === "POST" && url.pathname.match(/^\/hook\/([a-z0-9-]+)$/);
  if (!hook) return false;
  const p = find(hook[1]),
    text = (status, msg) => {
      res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
      res.end(msg);
      return true;
    };
  let raw;
  try {
    raw = await rawBody(req, 5 << 20);
  } catch {
    return text(413, "too large");
  }
  const sig = String(req.headers["x-hub-signature-256"] || "");
  if (
    !p?.repo ||
    !p.hookSecret ||
    !sameStr(sig, "sha256=" + crypto.createHmac("sha256", p.hookSecret).update(raw).digest("hex"))
  )
    return text(401, "bad signature");
  const ev = req.headers["x-github-event"];
  if (ev === "ping") return text(200, "pong");
  let b = {};
  try {
    b = JSON.parse(raw);
  } catch {
    return text(400, "cần Content type application/json");
  }
  if (ev !== "push" || b.deleted || b.ref !== `refs/heads/${p.branch || "main"}`)
    return text(202, "bỏ qua");
  return text(
    202,
    startDeploy(p, `GitHub · ${String(b.pusher?.name || "push").slice(0, 40)}`)
      ? "đang triển khai"
      : "đang có lần triển khai khác",
  );
}
