import { Link } from "react-router-dom";
import { fmtTime } from "../../shared.js";
import { HealthBadge } from "../components/Badges.jsx";
import Bars from "../components/Bars.jsx";
import Stats, { pct } from "../components/Stats.jsx";
import LogRows from "../components/LogRows.jsx";

export default function Overview({ data }) {
  const { project: p, live, uptime: u, checks, log } = data;
  const ready = live.up && (!p.summary || live.summaryOk);
  const last = checks.at(-1);
  return (
    <div className="stack">
      {!ready && p.can.owner && (
        <div className="card notice">
          <span className="pill soon">Chưa kết nối xong</span>
          <p>Console chưa nhận được phản hồi đầy đủ từ dự án.</p>
          <Link className="btn" to="?tab=connect">
            Xem các bước →
          </Link>
        </div>
      )}
      <div className="cols">
        <div className="stack">
          <section className="card">
            <h2>Số liệu</h2>
            {live.stats.length ? (
              <Stats items={live.stats} />
            ) : (
              <p className="empty">
                {p.summary ? "Dự án chưa trả số liệu." : "Chưa cấu hình API số liệu."}
              </p>
            )}
          </section>
          <section className="card">
            <div className="head">
              <h2>Giám sát</h2>
              <span className="sp"></span>
              <HealthBadge up={live.up} />
            </div>
            <div className="stats" style={{ marginBottom: 28 }}>
              <div className="stat">
                <b>{pct(u)}</b>
                <span>Hoạt động</span>
              </div>
              <div className="stat">
                <b>{u.avg == null ? "—" : u.avg}</b>
                <span>ms phản hồi TB</span>
              </div>
              <div className="stat">
                <b>{u.n}</b>
                <span>lần kiểm tra</span>
              </div>
            </div>
            <Bars checks={checks} n={60} />
            <div className="meta">
              <span>60 phút gần nhất</span>
              <span>{last ? "Lần cuối " + fmtTime(last.t) : "Chưa kiểm tra"}</span>
            </div>
          </section>
        </div>
        <section className="card">
          <div className="head">
            <h2>Hoạt động</h2>
            <span className="sp"></span>
            <Link className="btn link" to="?tab=activity">
              Tất cả →
            </Link>
          </div>
          <LogRows log={log.slice(0, 6)} withProject={false} />
        </section>
      </div>
    </div>
  );
}
