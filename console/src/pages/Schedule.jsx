import { Link } from "react-router-dom";
import { useApi, useTitle } from "../api.js";
import { fmtTime } from "../../shared.js";
import PageHead from "../components/PageHead.jsx";
import { StateBadge } from "../components/Badges.jsx";
import { Pending } from "../components/Message.jsx";

export default function Schedule() {
  useTitle("Lịch mở/đóng");
  const { data, error } = useApi("/api/schedule");
  return (
    <>
      <PageHead
        title="Lịch mở/đóng"
        lede="Dự án đang bật sẽ tự mở và tự đóng theo giờ hẹn (giờ Việt Nam). Ngoài khung giờ, khách thấy trang tạm đóng, còn thành viên dự án vẫn xem trước được."
      />
      {!data ? (
        <Pending error={error} />
      ) : (
        <section className="sec card scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Dự án</th>
                <th>Trạng thái</th>
                <th>Mở lúc</th>
                <th>Đóng lúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.projects.length ? (
                data.projects.map((p) => (
                  <tr key={p.slug}>
                    <td>
                      <Link to={`/p/${p.slug}?tab=access`}>{p.name}</Link>
                    </td>
                    <td>
                      <StateBadge state={p.state} />
                    </td>
                    <td className="num">{fmtTime(p.openAt) || "—"}</td>
                    <td className="num">{fmtTime(p.closeAt) || "—"}</td>
                    <td className="act">
                      {p.canEdit && (
                        <Link className="btn sm" to={`/p/${p.slug}?tab=access`}>
                          Đặt lịch
                        </Link>
                      )}
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
