import { Link } from "react-router-dom";
import { fmtTime } from "../../shared.js";

// Danh sách nhật ký (LogView[]). Dự án đã xoá (projectName null) thì chỉ hiện slug, không có link.
export default function LogRows({ log, withProject = true }) {
  if (!log.length) return <p className="empty">Chưa có hoạt động nào.</p>;
  return (
    <ol className="rows log">
      {log.map((l, i) => (
        <li key={i}>
          <time dateTime={new Date(l.t).toISOString()}>{fmtTime(l.t)}</time>{" "}
          <span className="act">
            <b className={l.action === "down" ? "bad" : undefined}>{l.label}</b>
            {withProject && l.slug && (
              <>
                {" · "}
                {l.projectName ? <Link to={`/p/${l.slug}`}>{l.projectName}</Link> : l.slug}
              </>
            )}{" "}
            <span className="muted"> · {l.who}</span>
            {l.detail && (
              <>
                <br />
                <span className="muted">{l.detail}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
