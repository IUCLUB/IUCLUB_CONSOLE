import { useEffect, useState } from "react";

// Khối mã + nút "Chép" (đổi thành "Đã chép" 1,2 giây)
export default function CodeBox({ text }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1200);
    return () => clearTimeout(t);
  }, [done]);
  const copy = () => navigator.clipboard?.writeText(text).then(() => setDone(true));
  return (
    <div className="code">
      <code>{text}</code>
      <button type="button" className="btn link" onClick={copy}>
        {done ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}
