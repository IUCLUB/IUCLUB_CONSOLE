import { useState } from "react";
import Message from "../components/Message.jsx";

// Tải file xuất qua fetch: lỗi thì server trả JSON {error}, hiện ngay dưới nút như trang cũ
function ExportLink({ slug }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const href = `/api/projects/${slug}/export`;
  const download = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(href);
      if (!r.ok) {
        setErr((await r.json().catch(() => ({}))).error || "Có lỗi xảy ra.");
        return;
      }
      const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") || "")?.[1];
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name || slug;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); // Safari cần thời gian bắt đầu tải
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <a className="btn pri" href={href} onClick={download} aria-disabled={busy || undefined}>
        Tải dữ liệu xuống
      </a>
      {err && (
        <div style={{ marginTop: 16 }}>
          <Message err={err} />
        </div>
      )}
    </>
  );
}

export default function Data({ data }) {
  const { project: p, live } = data;
  return (
    <div className="cols">
      <section className="card">
        <h2>Xuất dữ liệu</h2>
        {!p.exportPath ? (
          <p className="empty">
            Chưa cấu hình.{" "}
            {p.can.owner
              ? "Thêm “API xuất dữ liệu” ở tab Cài đặt, ví dụ "
              : "Chủ dự án cần cấu hình "}
            <span className="mono">/api/admin/export</span>.
          </p>
        ) : p.can.editor ? (
          <>
            <p className="muted" style={{ margin: "0 0 24px" }}>
              Console gọi <span className="mono">{p.exportPath}</span> của dự án bằng token và tải
              file về. Mỗi lần tải được ghi vào nhật ký.
            </p>
            <ExportLink slug={p.slug} />
          </>
        ) : (
          <p className="empty">Cần vai trò Điều hành để xuất dữ liệu.</p>
        )}
      </section>
      <section className="card">
        <h2>Mọi chỉ số</h2>
        {live.all.length ? (
          <ol className="rows">
            {live.all.map((s) => (
              <li key={s.label}>
                <span className="t mono">{s.label}</span>
                <span className="n">{s.value.toLocaleString("vi-VN")}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty">Không có số liệu.</p>
        )}
      </section>
    </div>
  );
}
