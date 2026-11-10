import { fmtTime } from "../../shared.js";

// n vạch kiểm tra gần nhất; thiếu thì đệm vạch trống ở đầu
export default function Bars({ checks = [], n = 60, small }) {
  const list = checks.slice(-n);
  const okN = list.filter((c) => c.ok).length;
  const cells = [...Array(n - list.length).fill(null), ...list];
  return (
    <div
      className={small ? "bars sm" : "bars"}
      role="img"
      aria-label={`${okN}/${list.length} lần kiểm tra gần nhất thành công`}
    >
      {cells.map((c, i) =>
        c ? (
          <i
            key={i}
            className={c.ok ? "ok" : "bad"}
            title={`${fmtTime(c.t)} · ${c.ok ? c.ms + " ms" : "lỗi"}`}
          ></i>
        ) : (
          <i key={i}></i>
        ),
      )}
    </div>
  );
}
