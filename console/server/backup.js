// ---------- Phân hệ: sao lưu ----------
// Mỗi đêm sau 2 giờ (giờ VN): exportPath của từng dự án + console.json vào BACKUP_DIR/daily/<ngày>/, giữ 14 ngày.
// Dự án đã qua giờ đóng: thêm một bản vào final/<slug>/, không bao giờ xoá.
// Service "backup" trong docker-compose.yml (rclone) đẩy cả BACKUP_DIR lên Google Drive.
import fs from "node:fs";
import path from "node:path";
import { stateOf, toLocal, fmtTime, exportExt } from "../lib.js";
import { BACKUP_DIR } from "./config.js";
import { db, log } from "./store.js";

export async function fetchExport(p, ms) {
  const r = await fetch(`http://${p.upstream}${p.exportPath}`, {
    headers: p.token ? { authorization: `Bearer ${p.token}` } : {},
    signal: AbortSignal.timeout(ms),
  });
  if (!r.ok) throw new Error(`Dự án trả ${r.status}`);
  return { r, buf: Buffer.from(await r.arrayBuffer()) };
}
export async function backupTo(p, dir, name) {
  try {
    const { r, buf } = await fetchExport(p, 300_000);
    fs.mkdirSync(dir, { recursive: true });
    const ext = exportExt(r.headers.get("content-disposition"), r.headers.get("content-type"));
    fs.writeFileSync(path.join(dir, name + ext), buf);
    return true;
  } catch (err) {
    log("Sao lưu", p.slug, "backup_fail", err.cause?.code || err.message);
    return false;
  }
}
let backingUp = false;
export async function backup(now = Date.now()) {
  const [day, hour] = toLocal(new Date(now).toISOString()).split("T");
  const daily = path.join(BACKUP_DIR, "daily"),
    dir = path.join(daily, day);
  if (backingUp || hour < "02" || fs.existsSync(path.join(dir, "console.json"))) return;
  backingUp = true;
  try {
    for (const p of db.projects) {
      if (!p.exportPath) continue;
      await backupTo(p, dir, p.slug);
      if (stateOf(p, now).key === "ended" && p.finalBackup !== p.closeAt) {
        if (
          await backupTo(p, path.join(BACKUP_DIR, "final", p.slug), toLocal(p.closeAt).slice(0, 10))
        ) {
          p.finalBackup = p.closeAt;
          log("Sao lưu", p.slug, "backup_final", `Đóng lúc ${fmtTime(p.closeAt)}`);
        }
      }
    }
    // Ghi cuối cùng: có console.json nghĩa là đêm nay đã sao lưu xong
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "console.json"), JSON.stringify(db, null, 2));
    for (const d of fs.readdirSync(daily).sort().slice(0, -14))
      fs.rmSync(path.join(daily, d), { recursive: true, force: true });
  } catch (err) {
    log("Sao lưu", "", "backup_fail", err.message);
  } finally {
    backingUp = false;
  }
}
setInterval(backup, 10 * 60_000);
backup();
