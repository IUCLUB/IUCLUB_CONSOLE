import { Link } from "react-router-dom";
import { useApi, useTitle } from "../api.js";
import PageHead from "../components/PageHead.jsx";
import Mark from "../components/Mark.jsx";
import { HealthBadge } from "../components/Badges.jsx";
import Bars from "../components/Bars.jsx";
import { pct } from "../components/Stats.jsx";
import { Pending } from "../components/Message.jsx";

export default function Monitor() {
  useTitle("Giám sát");
  const { data, error } = useApi("/api/monitor");
  return (
    <>
      <PageHead
        title="Giám sát"
        lede="Console gọi đường dẫn kiểm tra sống của từng dự án mỗi phút. Dự án đổi trạng thái thì ghi vào nhật ký. Lịch sử giữ 24 giờ và mất khi Console khởi động lại."
      />
      {!data ? (
        <Pending error={error} />
      ) : (
        <section className="sec card scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Hiện tại</th>
                <th>Hoạt động</th>
                <th>Phản hồi TB</th>
                <th>60 phút gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.length ? (
                data.projects.map((p) => (
                  <tr key={p.slug}>
                    <td>
                      <div
                        className="who-row"
                        style={{ display: "flex", gap: 12, alignItems: "center" }}
                      >
                        <Mark slug={p.slug} name={p.name} />
                        <div>
                          <Link to={`/p/${p.slug}`}>{p.name}</Link>
                          <br />
                          <span className="mono muted">
                            {p.upstream}
                            {p.health || "/"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <HealthBadge up={p.up} />
                    </td>
                    <td className="num">{pct(p.uptime)}</td>
                    <td className="num">{p.uptime.avg == null ? "—" : p.uptime.avg + " ms"}</td>
                    <td style={{ minWidth: 240, width: "40%" }}>
                      <Bars checks={p.checks} n={60} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty">
                    Chưa có dự án.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
