// Phần thuần dùng được cả ở trình duyệt (không import node:*): vai trò, trạng thái, giờ VN, số liệu.

// Phân quyền theo dự án. Quản trị viên (super) có mọi quyền ở mọi dự án.
export const ROLES = { viewer: "Xem", editor: "Điều hành", owner: "Chủ dự án" };

/** Lấy các ô số liệu từ JSON của dự án. fields = "key:Nhãn, key2:Nhãn 2"; để trống = mọi trường số. */
export function pickStats(json, fields) {
  const d =
    json && typeof json === "object" && json.data && typeof json.data === "object"
      ? json.data
      : json;
  if (!d || typeof d !== "object") return [];
  const list = String(fields || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf(":");
      return i < 0 ? [s, s] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
    });
  const pairs = list.length ? list : Object.keys(d).map((k) => [k, k]);
  return pairs
    .filter(([k]) => typeof d[k] === "number")
    .map(([k, label]) => ({ label, value: d[k] }));
}

/**
 * Trạng thái thật của dự án: công tắc + khung giờ hẹn (openAt/closeAt, ISO).
 * on = đang mở, off = tắt tay, soon = chờ tới giờ mở, ended = đã qua giờ đóng.
 */
export function stateOf(p, now = Date.now()) {
  if (!p.enabled) return { key: "off", label: "Đã tắt" };
  const open = p.openAt ? Date.parse(p.openAt) : NaN,
    close = p.closeAt ? Date.parse(p.closeAt) : NaN;
  if (open > now) return { key: "soon", label: "Chờ mở", at: open };
  if (close <= now) return { key: "ended", label: "Đã đóng theo lịch", at: close };
  return { key: "on", label: "Đang mở", at: Number.isNaN(close) ? null : close };
}

/** Tóm tắt các lần kiểm tra sống [{t, ok, ms}] → % hoạt động, thời gian phản hồi TB */
export function uptime(checks = []) {
  if (!checks.length) return { pct: null, avg: null, n: 0 };
  const ok = checks.filter((c) => c.ok);
  return {
    pct: (ok.length / checks.length) * 100,
    avg: ok.length ? Math.round(ok.reduce((a, c) => a + c.ms, 0) / ok.length) : null,
    n: checks.length,
  };
}

// Giờ Việt Nam cố định UTC+7 (không có giờ mùa hè). ponytail: đổi nếu câu lạc bộ dùng múi giờ khác.
const VN = 7 * 3600e3;
/** "2026-11-20T07:30" (giờ VN, từ <input type=datetime-local>) ↔ ISO */
export const fromLocal = (v) =>
  v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)
    ? new Date(Date.parse(v + ":00Z") - VN).toISOString()
    : "";
export const toLocal = (iso) =>
  iso ? new Date(Date.parse(iso) + VN).toISOString().slice(0, 16) : "";
export const fmtTime = (t) =>
  t == null || Number.isNaN(+new Date(t))
    ? ""
    : new Date(+new Date(t) + VN)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ")
        .replace(/^(\d{4})-(\d{2})-(\d{2})/, "$3/$2/$1");
