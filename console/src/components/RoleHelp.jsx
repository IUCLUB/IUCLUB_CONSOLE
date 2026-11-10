// Bảng giải thích các vai trò
const HELP = [
  [
    "Xem",
    "Số liệu, giám sát, nhật ký; xem trước khi dự án tắt; vào trang quản trị riêng của dự án.",
  ],
  ["Điều hành", "Như Xem, cộng bật/tắt, hẹn giờ, xuất dữ liệu."],
  ["Chủ dự án", "Như Điều hành, cộng cài đặt, kết nối (token) và thành viên dự án."],
  ["Quản trị viên", "Mọi dự án, tạo/xoá dự án, quản lý tài khoản."],
];

export default function RoleHelp() {
  return (
    <ol className="rows">
      {HELP.map(([t, d], i) => (
        <li key={t}>
          <span className="t">{t}</span>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <span className="d">{d}</span>
        </li>
      ))}
    </ol>
  );
}
