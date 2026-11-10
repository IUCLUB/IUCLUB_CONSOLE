import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";

// Chỉ báo trượt dưới mục hiện tại (menu "nav" hoặc "tabs"). Lần đầu đặt thẳng chỗ, đổi mục thì trượt.
// CSS: .ind + .slide-on; prefers-reduced-motion thì .ind không có transition.
export default function SlideNav({ name, items, current, label }) {
  const box = useRef(null),
    ind = useRef(null),
    placed = useRef(false);
  const has = items.some(([to]) => to === current);

  useLayoutEffect(() => {
    const el = box.current.querySelector("a[aria-current]"),
      i = ind.current;
    if (!el) return;
    const put = (anim) => {
      if (!anim) i.style.transition = "none";
      i.style.width = el.offsetWidth + "px";
      i.style.height = el.offsetHeight + "px";
      i.style.transform = `translate(${el.offsetLeft}px,${el.offsetTop}px)`;
      if (!anim) {
        void i.offsetWidth; // ép trình duyệt áp vị trí trước khi bật lại transition
        i.style.transition = "";
      }
    };
    put(placed.current);
    placed.current = true;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const onResize = () => put(false);
    addEventListener("resize", onResize);
    document.fonts?.ready.then(() => el.isConnected && put(true)); // font tải xong thì chữ đổi rộng: đo lại
    return () => removeEventListener("resize", onResize);
  }, [current, items.length]);

  return (
    <nav
      ref={box}
      className={(name === "nav" ? "links" : "tabs") + (has ? " slide-on" : "")}
      aria-label={label}
    >
      <span className="ind" ref={ind} />
      {items.map(([to, text]) => (
        <Link key={to} to={to} aria-current={to === current ? "page" : undefined}>
          {text}
        </Link>
      ))}
    </nav>
  );
}
