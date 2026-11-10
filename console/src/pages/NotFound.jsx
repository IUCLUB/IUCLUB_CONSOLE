import { useTitle } from "../api.js";

export default function NotFound() {
  useTitle("Không tìm thấy");
  return (
    <div className="card">
      <p className="empty">Không có dự án này, hoặc bạn chưa được thêm vào.</p>
    </div>
  );
}
