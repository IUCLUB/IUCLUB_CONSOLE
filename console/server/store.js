// ---------- Lưu trữ ----------
// ponytail: 1 file JSON + 1 tiến trình, đủ cho vài chục dự án. Cần nhiều người sửa cùng lúc thì chuyển sang SQLite/Postgres.
import fs from "node:fs";
import path from "node:path";
import { parseUsers, hashPassword, can } from "../lib.js";
import { CONSOLE_USERS, CONSOLE_RESET, DATA_FILE, SEED_FILE } from "./config.js";

const envRef = (v) =>
  typeof v === "string" && v.startsWith("$") ? process.env[v.slice(1)] || "" : v;
function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {}
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  seed.projects.forEach((p) => (p.token = envRef(p.token)));
  return seed;
}
export const db = load();
db.log ||= [];
db.users ||= [];
// Console khởi động lại giữa lúc triển khai thì không biết kết quả: đánh dấu lỗi để bấm lại được
for (const p of db.projects)
  if (p.deploy?.state === "running")
    Object.assign(p.deploy, {
      state: "fail",
      log: "Console khởi động lại khi đang triển khai. Bấm triển khai lại.",
    });
export function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(db, null, 2));
  fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
}
export const find = (slug) => db.projects.find((p) => p.slug === slug);
export const findUser = (email) =>
  db.users.find(
    (u) =>
      u.email ===
      String(email || "")
        .trim()
        .toLowerCase(),
  );
export const activeUser = (email) => {
  const u = email && findUser(email);
  return u && !u.disabled ? u : null;
};

// Tài khoản: CONSOLE_USERS chỉ tạo quản trị viên đầu tiên (nếu chưa có).
// CONSOLE_RESET=email:matkhaumoi để cứu tài khoản (đặt lại mật khẩu, mở khoá, trao quyền quản trị) rồi xoá biến đó đi.
for (const { email, password } of parseUsers(CONSOLE_USERS)) {
  if (!findUser(email))
    db.users.push({
      email,
      name: email.split("@")[0],
      hash: hashPassword(password),
      super: true,
      projects: {},
    });
}
for (const { email, password } of parseUsers(CONSOLE_RESET)) {
  const u =
    findUser(email) ||
    (db.users.push({ email, name: email.split("@")[0], projects: {} }), findUser(email));
  Object.assign(u, { hash: hashPassword(password), super: true, disabled: false });
  console.log(`CONSOLE_RESET: đã đặt lại ${email}. Nhớ xoá biến này khỏi .env.`);
}
save();

// ---------- Phân hệ: nhật ký hoạt động ----------
export const ACTIONS = {
  create: "Tạo dự án",
  edit: "Sửa cài đặt",
  on: "Bật dự án",
  off: "Tắt dự án",
  schedule: "Đặt lịch",
  delete: "Xoá dự án",
  export: "Xuất dữ liệu",
  down: "Sự cố",
  recover: "Khôi phục",
  member_add: "Thêm thành viên",
  member_role: "Đổi vai trò",
  member_remove: "Gỡ thành viên",
  user_create: "Tạo tài khoản",
  user_reset: "Đặt lại mật khẩu",
  user_lock: "Khoá tài khoản",
  user_unlock: "Mở khoá tài khoản",
  user_super: "Đổi quyền quản trị",
  user_delete: "Xoá tài khoản",
  password: "Đổi mật khẩu",
  deploy: "Triển khai",
  deploy_fail: "Triển khai lỗi",
  deploy_cfg: "Sửa cấu hình triển khai",
  deploy_key: "Tạo deploy key",
  backup_final: "Sao lưu bản cuối",
  backup_fail: "Sao lưu lỗi",
};
export function log(who, slug, action, detail = "") {
  db.log.unshift({ t: Date.now(), who, slug, action, detail });
  db.log.length = Math.min(db.log.length, 500);
  save();
}

// Những gì một người được thấy
export const visible = (me) => db.projects.filter((p) => can(me, p.slug, "viewer"));
export const visibleLog = (me) =>
  db.log.filter((l) =>
    l.slug
      ? can(me, l.slug, "viewer") || (me.super && !find(l.slug))
      : me.super || l.who === me.email,
  );
