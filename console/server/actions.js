// Các thao tác ghi của JSON API (api.js gọi). Mỗi hàm trả {status, error?, ...}; nơi gọi đổi sang JSON.
// Ô kiểu checkbox (super, clear) nhận boolean.
import crypto from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  ROLES,
  can,
  fromLocal,
  fmtTime,
  exportExt,
  SLUG,
  UPSTREAM,
  RESERVED,
} from "../lib.js";
import { db, save, find, findUser, log } from "./store.js";
import { mon, check } from "./monitor.js";
import { fetchExport } from "./backup.js";
import { callDeployer, parseEnv, startDeploy, REPO, BRANCH, SHA } from "./deploy.js";

const ok = (x = {}) => ({ status: 200, ...x });
const fail = (status, error) => ({ status, error });
const newPassword = () => crypto.randomBytes(9).toString("base64url");

function readForm(f, old = {}) {
  const p = {
    ...old,
    name: String(f.name || "")
      .trim()
      .slice(0, 60),
    upstream: String(f.upstream || "").trim(),
    health: String(f.health || "").trim(),
    summary: String(f.summary || "").trim(),
    fields: String(f.fields || "").trim(),
    protect: String(f.protect || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.startsWith("/")),
    adminUrl: String(f.adminUrl || "").trim(),
    exportPath: String(f.exportPath || "").trim(),
    token: f.token ? String(f.token) : old.token || "",
  };
  const bad = !p.name
    ? "Thiếu tên."
    : !UPSTREAM.test(p.upstream)
      ? "Upstream phải có dạng ten-container:cong."
      : [p.health, p.summary, p.adminUrl, p.exportPath].some((x) => x && !x.startsWith("/"))
        ? "Các đường dẫn phải bắt đầu bằng /."
        : null;
  return { p, bad };
}

// Tài khoản của chính mình: đổi mật khẩu
export function changePassword(me, f) {
  if (!verifyPassword(f.current, me.hash)) return fail(400, "Mật khẩu hiện tại không đúng.");
  if (String(f.next || "").length < 10) return fail(400, "Mật khẩu mới cần ít nhất 10 ký tự.");
  if (f.next !== f.confirm) return fail(400, "Hai lần nhập mật khẩu mới không khớp.");
  me.hash = hashPassword(f.next);
  log(me.email, "", "password");
  return ok();
}

// Quản lý tài khoản (chỉ quản trị viên). Không có pw/confirmDelete/deleted = trang cũ chuyển hướng.
export function manageUsers(me, f) {
  if (!me.super) return fail(403, "Chỉ quản trị viên quản lý tài khoản.");
  const email = String(f.email || "")
      .trim()
      .toLowerCase(),
    u = findUser(email);
  const supers = () => db.users.filter((x) => x.super && !x.disabled).length;
  if (f.do === "create") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, "Email không hợp lệ.");
    if (u) return fail(400, "Email này đã có tài khoản.");
    const pw = newPassword();
    db.users.push({
      email,
      name:
        String(f.name || "")
          .trim()
          .slice(0, 60) || email.split("@")[0],
      hash: hashPassword(pw),
      super: f.super === true,
      projects: {},
    });
    log(me.email, "", "user_create", email + (f.super === true ? " · quản trị viên" : ""));
    return ok({ pw: { email, pw } });
  }
  if (!u) return fail(404, "Không có tài khoản này.");
  if (f.do === "reset") {
    const pw = newPassword();
    u.hash = hashPassword(pw);
    log(me.email, "", "user_reset", email);
    return ok({ pw: { email, pw } });
  }
  if (u === me) return fail(400, "Không tự khoá, tự xoá hay tự bỏ quyền quản trị của chính mình.");
  if (f.do === "delete") {
    if (u.super && !u.disabled && supers() <= 1)
      return fail(400, "Phải còn ít nhất một quản trị viên.");
    if (f.confirm !== "1") return ok({ confirmDelete: { email: u.email, name: u.name } }); // bước 1: hỏi lại
    db.users = db.users.filter((x) => x !== u); // phiên của người này hết hiệu lực ngay vì không còn tài khoản
    log(me.email, "", "user_delete", email);
    return ok({ deleted: email });
  }
  if (f.do === "lock") {
    if (!u.disabled && u.super && supers() <= 1)
      return fail(400, "Phải còn ít nhất một quản trị viên.");
    u.disabled = !u.disabled;
    log(me.email, "", u.disabled ? "user_lock" : "user_unlock", email);
  }
  if (f.do === "super") {
    if (u.super && supers() <= 1) return fail(400, "Phải còn ít nhất một quản trị viên.");
    u.super = !u.super;
    log(
      me.email,
      "",
      "user_super",
      `${email} · ${u.super ? "thành quản trị viên" : "bỏ quyền quản trị"}`,
    );
  }
  return ok();
}

// Dự án mới → {status, error?, slug}
export function createProject(me, f) {
  if (!me.super)
    return fail(
      403,
      "Chỉ quản trị viên tạo dự án mới. Nhờ quản trị viên tạo và thêm bạn làm chủ dự án.",
    );
  const slug = String(f.slug || "")
    .trim()
    .toLowerCase();
  f.upstream ||= `p-${slug}:3000`; // mặc định theo template
  f.token ||= crypto.randomBytes(24).toString("base64url");
  const { p, bad } = readForm(f);
  const err =
    !SLUG.test(slug) || RESERVED.has(slug)
      ? "Slug chỉ gồm a-z, 0-9, dấu gạch ngang và không trùng tên dành riêng."
      : find(slug)
        ? "Slug đã tồn tại."
        : bad;
  if (err) return { ...fail(400, err), slug };
  db.projects.push({ slug, enabled: false, ...p });
  log(me.email, slug, "create");
  check(find(slug));
  return ok({ slug });
}

// ---------- Thao tác trên một dự án (đã kiểm tra thấy được dự án) ----------
export function toggleProject(p, me) {
  if (!can(me, p.slug, "editor"))
    return fail(403, "Cần vai trò Điều hành trở lên để bật/tắt dự án.");
  p.enabled = !p.enabled;
  log(me.email, p.slug, p.enabled ? "on" : "off");
  return ok();
}

export function setSchedule(p, me, f) {
  if (!can(me, p.slug, "editor")) return fail(403, "Cần vai trò Điều hành trở lên để đặt lịch.");
  const clear = f.clear === true;
  let openAt, closeAt;
  try {
    openAt = clear ? "" : fromLocal(f.openAt);
    closeAt = clear ? "" : fromLocal(f.closeAt);
  } catch (err) {
    // Đúng dạng nhưng sai ngày giờ (vd. tháng 13) thì toISOString ném RangeError
    if (err instanceof RangeError) return fail(400, "Giờ không hợp lệ.");
    throw err;
  }
  if (openAt && closeAt && openAt >= closeAt) return fail(400, "Giờ đóng phải sau giờ mở.");
  Object.assign(p, {
    openAt,
    closeAt,
    closedMsg: clear
      ? p.closedMsg
      : String(f.closedMsg || "")
          .trim()
          .slice(0, 300),
  });
  log(
    me.email,
    p.slug,
    "schedule",
    openAt || closeAt
      ? `${openAt ? "Mở " + fmtTime(openAt) : ""}${openAt && closeAt ? " · " : ""}${closeAt ? "Đóng " + fmtTime(closeAt) : ""}`
      : "Bỏ hẹn giờ",
  );
  return ok();
}

// f.do: "remove" gỡ; còn lại ("add"/"set") đặt vai trò
export function setMember(p, me, f) {
  if (!can(me, p.slug, "owner")) return fail(403, "Chỉ chủ dự án quản lý thành viên.");
  const u = findUser(f.email),
    role = String(f.role || "");
  if (!u)
    return fail(400, "Không có tài khoản này. Quản trị viên tạo tài khoản ở trang Thành viên.");
  if (u.super) return fail(400, "Quản trị viên đã có toàn quyền ở mọi dự án.");
  if (u === me) return fail(400, "Không tự đổi vai trò của chính mình.");
  u.projects ||= {};
  if (f.do === "remove") {
    delete u.projects[p.slug];
    log(me.email, p.slug, "member_remove", u.email);
  } else {
    if (!Object.hasOwn(ROLES, role)) return fail(400, "Vai trò không hợp lệ.");
    const had = u.projects[p.slug];
    u.projects[p.slug] = role;
    log(me.email, p.slug, had ? "member_role" : "member_add", `${u.email} · ${ROLES[role]}`);
  }
  return ok();
}

// f.do: "save" | "key" | "run"
export async function deployAction(p, me, f) {
  if (!can(me, p.slug, "owner"))
    return fail(403, "Chỉ chủ dự án triển khai và cấu hình triển khai.");
  if (f.do === "save") {
    const repo = String(f.repo || "")
        .trim()
        .replace(/^https:\/\/github\.com\//, "")
        .replace(/\.git$/, ""),
      branch = String(f.branch || "").trim() || "main";
    if (repo && !REPO.test(repo)) return fail(400, "Repo phải có dạng chu-so-huu/ten-repo.");
    if (!BRANCH.test(branch)) return fail(400, "Tên nhánh không hợp lệ.");
    const pe = parseEnv(f.env);
    if (pe.err) return fail(400, pe.err);
    Object.assign(p, { repo, branch, env: String(f.env || "").slice(0, 20_000) });
    p.hookSecret ||= crypto.randomBytes(24).toString("base64url");
    log(me.email, p.slug, "deploy_cfg", repo ? `${repo} · ${branch}` : "Bỏ repo");
  } else if (f.do === "key") {
    let r;
    try {
      r = await callDeployer(`/key/${p.slug}`);
    } catch (e2) {
      return fail(400, "Không gọi được deployer: " + e2.message);
    }
    if (!r.publicKey) return fail(400, "Deployer không tạo được key.");
    p.pubkey = r.publicKey;
    log(me.email, p.slug, "deploy_key");
  } else if (f.do === "run") {
    const ref = String(f.ref || "")
      .trim()
      .toLowerCase();
    if (!p.repo || !p.pubkey) return fail(400, "Cần lưu repo và tạo deploy key trước.");
    if (ref && !SHA.test(ref)) return fail(400, "Commit phải là mã SHA (7–40 ký tự hex).");
    if (!startDeploy(p, me.email, ref))
      return fail(400, "Đang có lần triển khai khác, chờ xong đã.");
  }
  save();
  return ok();
}

export function deleteProject(p, me, f) {
  if (!me.super) return fail(403, "Chỉ quản trị viên xoá dự án.");
  if (f.confirm !== p.slug) return fail(400, "Gõ đúng slug để xác nhận xoá.");
  db.projects = db.projects.filter((x) => x !== p);
  mon.delete(p.slug);
  db.users.forEach((u) => delete u.projects?.[p.slug]);
  log(me.email, p.slug, "delete", p.name);
  return ok();
}

// Token trống = giữ token cũ (readForm)
export function editProject(p, me, f) {
  if (!can(me, p.slug, "owner")) return fail(403, "Chỉ chủ dự án sửa cài đặt.");
  const { p: np, bad } = readForm(f, p);
  if (bad) return fail(400, bad);
  Object.assign(p, np);
  log(me.email, p.slug, "edit");
  return ok();
}

// Xuất dữ liệu → {status, error?, send?}; send(res) ghi file tải về.
export async function exportData(p, me) {
  if (!can(me, p.slug, "editor"))
    return fail(403, "Cần vai trò Điều hành trở lên để xuất dữ liệu.");
  if (!p.exportPath) return fail(404, "Dự án chưa cấu hình API xuất dữ liệu.");
  let r, buf;
  try {
    ({ r, buf } = await fetchExport(p, 60_000));
  } catch (err) {
    return fail(
      502,
      `Dự án không trả dữ liệu (${err.name === "Error" ? err.message : "không kết nối được"}).`,
    );
  }
  log(me.email, p.slug, "export", `${(buf.length / 1024).toFixed(1)} KB`);
  const ext = exportExt(r.headers.get("content-disposition"), r.headers.get("content-type"));
  return ok({
    send(res) {
      res.writeHead(200, {
        "content-type": r.headers.get("content-type") || "application/octet-stream",
        // Không chuyển tiếp Content-Disposition của dự án: tự đặt tên file an toàn
        "content-disposition": `attachment; filename="${p.slug}-${new Date().toISOString().slice(0, 10)}${ext}"`,
      });
      res.end(buf);
    },
  });
}
