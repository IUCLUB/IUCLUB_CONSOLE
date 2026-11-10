import { useContext } from "react";
import { Link } from "react-router-dom";
import { MeContext, useApi, useTitle } from "../api.js";
import Mark from "../components/Mark.jsx";
import { HealthBadge, RoleBadge, StateBadge } from "../components/Badges.jsx";
import Bars from "../components/Bars.jsx";
import Stats, { pct } from "../components/Stats.jsx";
import LogRows from "../components/LogRows.jsx";
import { Pending } from "../components/Message.jsx";

const MODULES = [
  ["/monitor", "Giám sát", "Kiểm tra từng dự án mỗi phút, báo sự cố vào nhật ký."],
  ["/schedule", "Lịch mở/đóng", "Hẹn giờ dự án tự mở và tự đóng theo sự kiện."],
  ["/activity", "Nhật ký hoạt động", "Ai bật, tắt, sửa, xuất dữ liệu, lúc nào."],
  ["/guide", "Hướng dẫn dựng dự án", "Hợp đồng với gateway và quy trình làm việc chung."],
];
// Chỉ quản trị viên thấy
const SUPER_MODULES = [
  ["/users", "Thành viên", "Tạo tài khoản, đặt lại mật khẩu, trao quyền quản trị."],
  ["/new", "Dự án mới", "Tạo dự án, Console hướng dẫn từng bước kết nối."],
];

function Card({ p, isSuper }) {
  return (
    <Link className="card pc" to={`/p/${p.slug}`}>
      <div className="who-row">
        <Mark slug={p.slug} name={p.name} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3>{p.name}</h3>
          <span className="mono muted">{p.host}</span>
        </div>
        {!isSuper && <RoleBadge role={p.role} />}
      </div>
      <div className="row">
        <StateBadge state={p.state} />
        <HealthBadge up={p.up} />
      </div>
      <div>
        <Bars checks={p.checks} n={40} small />
        <div className="meta">
          <span>40 phút gần nhất</span>
          <span>{pct(p.uptime)} hoạt động</span>
        </div>
      </div>
      <Stats items={p.stats} />
    </Link>
  );
}

export default function Home() {
  useTitle("Tổng quan");
  const { user: me } = useContext(MeContext);
  const { data, error } = useApi("/api/home");
  if (!data) return <Pending error={error} />;
  const { projects: list, kpis, log } = data;
  const modules = [...MODULES, ...(me.super ? SUPER_MODULES : [])];
  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          IU CLUB Console · {me.super ? "Quản trị viên" : `${list.length} dự án của bạn`}
        </p>
        <h1>Mọi dự án của câu lạc bộ, một nơi.</h1>
        <p className="lede">
          Bật tắt, hẹn giờ, theo dõi và xuất dữ liệu cho từng dự án mà không phải đụng vào server.
        </p>
        <div className="row">
          {me.super && (
            <Link className="btn pri" to="/new">
              + Dự án mới
            </Link>
          )}
          <Link className="btn" to="/guide">
            Hướng dẫn dựng dự án
          </Link>
        </div>
      </section>
      <section className="sec kpis" aria-label="Tổng quan">
        <div className="kpi">
          <b>{kpis.count}</b>
          <span>{me.super ? "Dự án" : "Dự án bạn tham gia"}</span>
        </div>
        <div className="kpi">
          <b>{kpis.open}</b>
          <span>Đang mở cho khách</span>
        </div>
        <div className="kpi">
          <b>{pct({ pct: kpis.avgUptime })}</b>
          <span>Hoạt động trung bình</span>
          <small>từ khi Console khởi động</small>
        </div>
        <div className="kpi">
          <b>{kpis.incidents}</b>
          <span>Sự cố 24 giờ qua</span>
        </div>
      </section>
      <section className="sec">
        <div className="head">
          <h2>Dự án</h2>
          <span className="sp"></span>
          <Link className="btn link" to="/monitor">
            Xem giám sát →
          </Link>
        </div>
        {list.length ? (
          <div className="grid">
            {list.map((p) => (
              <Card key={p.slug} p={p} isSuper={me.super} />
            ))}
          </div>
        ) : (
          <div className="card">
            <p className="empty">
              {me.super
                ? "Chưa có dự án nào. Bấm “Dự án mới” để bắt đầu."
                : "Bạn chưa được thêm vào dự án nào. Nhờ chủ dự án hoặc quản trị viên thêm bạn."}
            </p>
          </div>
        )}
      </section>
      <div className="wash sec"></div>
      <section className="sec cols">
        <div className="card">
          <div className="head">
            <h2>Hoạt động gần đây</h2>
            <span className="sp"></span>
            <Link className="btn link" to="/activity">
              Tất cả →
            </Link>
          </div>
          <LogRows log={log} />
        </div>
        <div className="card">
          <h2>Phân hệ</h2>
          <ol className="rows">
            {modules.map(([h, t, d], i) => (
              <li key={h}>
                <Link className="t" to={h}>
                  {t}
                </Link>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <span className="d">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
