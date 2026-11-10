import { ROLES, fmtTime } from "../../shared.js";

// state = stateOf(p) do server gửi: {key, label, at}
export function StateBadge({ state: s }) {
  const when =
    s.key === "soon"
      ? ` · ${fmtTime(s.at)}`
      : s.key === "on" && s.at
        ? ` · đến ${fmtTime(s.at)}`
        : s.key === "ended"
          ? ` · ${fmtTime(s.at)}`
          : "";
  return (
    <span className={`pill ${s.key}`}>
      {s.label}
      {when}
    </span>
  );
}

// up không có (chưa kiểm tra lần nào) thì coi như không phản hồi, như cũ
export function HealthBadge({ up }) {
  return (
    <span className="pill">
      <span className={`dot ${up ? "up" : "down"}`}></span>
      {up ? "Hoạt động" : "Không phản hồi"}
    </span>
  );
}

export const roleName = (r) => (r === "super" ? "Quản trị viên" : ROLES[r] || "");

export function RoleBadge({ role }) {
  return role ? <span className={`pill role ${role}`}>{roleName(role)}</span> : null;
}
