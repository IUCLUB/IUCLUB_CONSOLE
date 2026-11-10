// Dòng báo lỗi / báo đã lưu dưới form
export default function Message({ err, ok }) {
  if (err)
    return (
      <p className="err" role="alert">
        {err}
      </p>
    );
  if (ok)
    return (
      <p className="ok-msg" role="status">
        {ok}
      </p>
    );
  return null;
}

// Trang đang chờ dữ liệu lần đầu, hoặc báo lỗi khi đọc không được
export function Pending({ error }) {
  return error ? <Message err={error.message} /> : <p className="empty">Đang tải…</p>;
}
