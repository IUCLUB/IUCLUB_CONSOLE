import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MeContext, api, useAction, useTitle } from "../api.js";
import PageHead from "../components/PageHead.jsx";
import Message from "../components/Message.jsx";
import { AdvFields, NameField, binder, fieldsOf } from "../components/ProjectFields.jsx";

// Điền sẵn theo template IU CLUB, như newPage cũ (upstream và token để server tự đặt)
const TEMPLATE = {
  slug: "",
  ...fieldsOf({
    health: "/api/health",
    summary: "/api/admin/stats",
    protect: ["/admin", "/api/admin"],
    adminUrl: "/admin",
    exportPath: "/api/admin/export",
  }),
};

export default function NewProject() {
  useTitle("Dự án mới");
  const { config } = useContext(MeContext);
  const navigate = useNavigate();
  const [f, setF] = useState(TEMPLATE);
  const bind = binder(f, setF);
  const { msg, busy, run } = useAction();
  const submit = async (ev) => {
    ev.preventDefault();
    const r = await run(() => api("/api/projects", { method: "POST", body: f }));
    if (r) navigate(`/p/${r.slug}?tab=connect`);
  };
  return (
    <>
      <Link className="btn link" to="/">
        ← Tổng quan
      </Link>
      <div style={{ marginTop: 12 }}>
        <PageHead
          title="Dự án mới"
          lede="Chỉ cần slug và tên. Các thông số khác đã điền sẵn theo template của IU CLUB."
        />
      </div>
      <form className="sec card f" onSubmit={submit}>
        <div className="two">
          <label>
            Slug <small>thành địa chỉ {config.projectUrl.replace("{slug}", "slug")}</small>
            <input
              className="mono"
              required
              pattern="[a-z0-9-]{1,30}"
              placeholder="vd. hoi-trai-2027"
              {...bind("slug")}
            />
          </label>
          <NameField bind={bind} />
        </div>
        <details>
          <summary>Thông số nâng cao</summary>
          <div className="f">
            <AdvFields bind={bind} />
          </div>
        </details>
        <Message err={msg.err} />
        <div className="row">
          <button className="btn pri" disabled={busy}>
            Tạo dự án
          </button>
          <span className="muted">
            Dự án mới ở trạng thái tắt. Sau đó thêm chủ dự án ở tab Thành viên.
          </span>
        </div>
      </form>
    </>
  );
}
