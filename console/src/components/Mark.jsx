// Mỗi dự án lệch sắc độ gradient một chút (−36°…+36°) để nhận ra nhau, vẫn trong dải amber → cobalt
export const hueOf = (slug) => (([...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % 7) - 3) * 12;
export const initials = (name) =>
  String(name)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";

// Ô chữ viết tắt của dự án
export default function Mark({ slug, name }) {
  return (
    <span className="mark" style={{ "--h": `${hueOf(slug)}deg` }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
