// u = uptime(checks) hoặc {pct}: "99.5%", "100%", "—"
export const pct = (u) => (u.pct == null ? "—" : `${u.pct >= 99.95 ? 100 : u.pct.toFixed(1)}%`);

// Các ô số liệu [{label, value}] lấy từ dự án
export default function Stats({ items }) {
  if (!items.length) return null;
  return (
    <div className="stats">
      {items.map((s, i) => (
        <div className="stat" key={i}>
          <b>{s.value.toLocaleString("vi-VN")}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
