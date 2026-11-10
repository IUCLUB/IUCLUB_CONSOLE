// Danh sách bước có dấu ✓: <Steps><Step n done title desc>{phần thêm}</Step></Steps>
export function Steps({ children }) {
  return <ol className="rows steps">{children}</ol>;
}

export function Step({ n, done, title, desc, children }) {
  return (
    <li>
      <span className="t">
        <i className={done ? "done" : ""} aria-label={done ? "Đã xong" : "Chưa xong"}>
          {done ? "✓" : ""}
        </i>
        {title}
      </span>{" "}
      <span className="n">{String(n).padStart(2, "0")}</span>
      {desc && <span className="d">{desc}</span>}
      {children}
    </li>
  );
}
