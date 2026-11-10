// Logo câu lạc bộ: đổi logo bằng cách thay file console/public/logo.svg
export default function Logo({ size = 24 }) {
  return <img className="logo-mark" src="/logo.svg" width={size} height={size} alt="" />;
}
