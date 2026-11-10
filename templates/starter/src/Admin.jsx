import { useEffect, useState } from "react";

// Trang quản trị. Gateway đã bắt đăng nhập Console, server cho biết ai đang xem qua /api/admin/me.
export default function Admin() {
  const [me, setMe] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const get = (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
    Promise.all([get("/api/admin/me"), get("/api/admin/stats")])
      .then(([m, s]) => (setMe(m), setStats(s)))
      .catch(() =>
        setError("Không đọc được dữ liệu. Hãy mở trang này qua gateway và đăng nhập Console."),
      );
  }, []);

  if (error)
    return (
      <main className="center">
        <p>{error}</p>
      </main>
    );
  if (!me)
    return (
      <main className="center">
        <p>Đang tải…</p>
      </main>
    );
  return (
    <main className="center">
      <h1>Quản trị</h1>
      <p>
        Xin chào {me.user} (vai trò: {me.role}).
      </p>
      <p>Lượt xem trang chủ: {stats.visits}</p>
      <p>
        <a href="/api/admin/export">Tải dữ liệu (.sqlite)</a>
      </p>
    </main>
  );
}
