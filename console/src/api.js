// Gọi JSON API của Console + hook đọc dữ liệu. Không dùng thư viện state.
import { createContext, useCallback, useEffect, useState } from "react";

// { user, config } của người đang đăng nhập, App nạp một lần
export const MeContext = createContext(null);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Mọi request ghi đều gửi JSON (server chặn content-type khác: chống CSRF)
export async function api(path, { method = "GET", body } = {}) {
  const r = await fetch(path, {
    method,
    ...(method === "GET"
      ? {}
      : { headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== "/api/login")
    location.href = "/login?next=" + encodeURIComponent(location.href);
  if (!r.ok) throw new ApiError(r.status, data.error || "Có lỗi xảy ra.");
  return data;
}

// Đọc `path`; đổi path thì đọc lại. poll (ms): đọc lại định kỳ, chỉ truyền khi cần.
export function useApi(path, { poll } = {}) {
  const [s, set] = useState({});
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true,
      busy = false;
    // Lần đọc trước chưa xong thì bỏ qua nhịp poll này (mạng chậm không chồng request)
    const run = () => {
      if (busy) return;
      busy = true;
      api(path)
        .then(
          (data) => live && set({ path, data }),
          (error) =>
            live && set((o) => ({ path, data: o.path === path ? o.data : undefined, error })),
        )
        .finally(() => (busy = false));
    };
    run();
    const t = poll && setInterval(run, poll);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [path, poll, n]);
  const reload = useCallback(() => setN((x) => x + 1), []);
  // Kết quả của path cũ thì coi như chưa có
  const mine = s.path === path;
  const data = mine ? s.data : undefined,
    error = mine ? s.error : undefined;
  return { data, error, loading: !data && !error, reload };
}

// <title> của từng trang, như head() cũ
export function useTitle(title) {
  useEffect(() => {
    document.title = `${title} · IU CLUB Console`;
  }, [title]);
}

// Thao tác ghi dưới form: msg = {ok} | {err}; busy khi đang gửi (khoá nút). Bắt đầu thao tác mới thì xoá thông báo cũ.
export function useAction() {
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const run = async (fn, ok) => {
    setMsg({});
    setBusy(true);
    try {
      const r = await fn();
      if (ok) setMsg({ ok });
      return r;
    } catch (e) {
      setMsg({ err: e.message });
    } finally {
      setBusy(false);
    }
  };
  return { msg, setMsg, busy, run };
}
