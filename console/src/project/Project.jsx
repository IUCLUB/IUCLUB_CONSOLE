import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, useAction, useApi, useTitle } from "../api.js";
import { hueOf } from "../components/Mark.jsx";
import { HealthBadge, RoleBadge, StateBadge } from "../components/Badges.jsx";
import SlideNav from "../components/SlideNav.jsx";
import { Pending } from "../components/Message.jsx";
import NotFound from "../pages/NotFound.jsx";
import Overview from "./Overview.jsx";
import Connect from "./Connect.jsx";
import Deploy from "./Deploy.jsx";
import Access from "./Access.jsx";
import Data from "./Data.jsx";
import Members from "./Members.jsx";
import Activity from "./Activity.jsx";
import Settings from "./Settings.jsx";

const TAB = {
  overview: Overview,
  connect: Connect,
  deploy: Deploy,
  access: Access,
  data: Data,
  members: Members,
  activity: Activity,
  settings: Settings,
};

// Đầu trang dự án: tên, trạng thái, nút mở trang / trang quản trị / bật-tắt
function Hero({ data, reload }) {
  const { project: p, live } = data;
  const { msg, busy, run } = useAction();
  const toggle = async () => {
    await run(() => api(`/api/projects/${p.slug}/toggle`, { method: "POST" }));
    reload();
  };
  return (
    <section className="phero" style={{ "--h": `${hueOf(p.slug)}deg` }}>
      <Link className="back" to="/">
        ← Tổng quan
      </Link>
      <div className="top">
        <div>
          <p className="eyebrow">
            Dự án · <span className="mono">{p.host}</span>
          </p>
          <h1>{p.name}</h1>
          <div className="row" style={{ marginTop: 16 }}>
            <StateBadge state={p.state} />
            <HealthBadge up={live.up} />
            <RoleBadge role={p.role} />
          </div>
        </div>
        <div className="row">
          <a className="btn" href={p.url} target="_blank" rel="noopener">
            Mở trang ↗
          </a>
          {p.adminUrl && (
            <a className="btn" href={p.url + p.adminUrl} target="_blank" rel="noopener">
              Trang quản trị ↗
            </a>
          )}
          {p.can.editor && (
            <button
              type="button"
              className={`btn ${p.enabled ? "bad" : "pri"}`}
              disabled={busy}
              onClick={toggle}
            >
              {p.enabled ? "Tắt dự án" : "Bật dự án"}
            </button>
          )}
        </div>
      </div>
      {msg.err && (
        <p className="err" role="alert">
          {msg.err}
        </p>
      )}
    </section>
  );
}

export default function Project() {
  const { slug } = useParams();
  const [q] = useSearchParams();
  // Đang triển khai và mở tab Triển khai thì đọc lại mỗi 5 giây (thay cho tự tải lại trang cũ)
  const [running, setRunning] = useState(false);
  const want = q.get("tab");
  const { data, error, reload } = useApi(`/api/projects/${slug}`, {
    poll: running && want === "deploy" ? 1500 : undefined, // log build gần như trực tiếp
  });
  const isRunning = data?.project.deploy?.state === "running";
  if (isRunning !== running) setRunning(isRunning);
  useTitle(data ? data.project.name : error?.status === 404 ? "Không tìm thấy" : slug);

  if (error?.status === 404) return <NotFound />;
  if (!data) return <Pending error={error} />;
  const tab = data.tabs.some(([k]) => k === want) ? want : "overview";
  const Tab = TAB[tab];
  return (
    <div className="detail">
      <Hero data={data} reload={reload} />
      <SlideNav
        name="tabs"
        label="Phân hệ của dự án"
        items={data.tabs.map(([k, l]) => [`?tab=${k}`, l])}
        current={`?tab=${tab}`}
      />
      <Tab data={data} reload={reload} />
    </div>
  );
}
