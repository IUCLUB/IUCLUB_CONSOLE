// ---------- Phân hệ: giám sát ----------
// ponytail: lịch sử kiểm tra nằm trong RAM (24 giờ, 1 lần/phút), mất khi Console khởi động lại. Cần lâu hơn thì ghi ra file.
import { pickStats } from "../lib.js";
import { db, log } from "./store.js";

export const mon = new Map();
export async function check(p) {
  const t0 = Date.now();
  let ok = false;
  try {
    ok = (
      await fetch(`http://${p.upstream}${p.health || "/"}`, { signal: AbortSignal.timeout(3000) })
    ).ok;
  } catch {}
  const list = mon.get(p.slug) || [],
    prev = list.at(-1);
  list.push({ t: t0, ok, ms: Date.now() - t0 });
  if (list.length > 1440) list.shift();
  mon.set(p.slug, list);
  if (prev && prev.ok !== ok)
    log(
      "Giám sát",
      p.slug,
      ok ? "recover" : "down",
      ok ? "Phản hồi trở lại" : `Không phản hồi ở ${p.upstream}${p.health || "/"}`,
    );
}
export const monitor = () => Promise.all(db.projects.map(check)).catch(() => {});
setInterval(monitor, 60_000);
monitor();

export async function probe(p) {
  const get = (u, auth) =>
    fetch(`http://${p.upstream}${u}`, {
      headers: auth && p.token ? { authorization: `Bearer ${p.token}` } : {},
      signal: AbortSignal.timeout(2000),
    });
  const [h, s] = await Promise.allSettled([
    get(p.health || "/"),
    p.summary ? get(p.summary, true).then((r) => (r.ok ? r.json() : null)) : null,
  ]);
  const data = s.status === "fulfilled" ? s.value : null;
  return {
    up: h.status === "fulfilled" && h.value.ok,
    summaryOk: data != null,
    data,
    stats: pickStats(data, p.fields),
  };
}
