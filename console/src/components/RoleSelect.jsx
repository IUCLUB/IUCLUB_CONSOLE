import { ROLES } from "../../shared.js";

// Chọn vai trò trong dự án. Có onChange thì điều khiển, không thì để form tự đọc (name)
export default function RoleSelect({ value = "viewer", onChange, small, name = "role" }) {
  return (
    <select
      name={name}
      className={small ? "sm" : ""}
      aria-label="Vai trò"
      {...(onChange
        ? { value, onChange: (e) => onChange(e.target.value) }
        : { defaultValue: value })}
    >
      {Object.entries(ROLES).map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
}
