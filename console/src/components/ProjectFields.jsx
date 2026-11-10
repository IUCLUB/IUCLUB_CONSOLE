// Các ô cài đặt dự án (nameField + advFields cũ), điều khiển bằng state của form cha.
// bind(name) → {name, value, onChange}

export const fieldsOf = (p = {}) => ({
  name: p.name || "",
  upstream: p.upstream || "",
  health: p.health || "",
  summary: p.summary || "",
  fields: p.fields || "",
  protect: (p.protect || []).join(", "),
  adminUrl: p.adminUrl || "",
  exportPath: p.exportPath || "",
  token: "",
});

export function NameField({ bind }) {
  return (
    <label>
      Tên hiển thị
      <input required maxLength="60" {...bind("name")} />
    </label>
  );
}

export function AdvFields({ bind, hasToken }) {
  return (
    <>
      <div className="two">
        <label>
          Upstream <small>container:cổng trong mạng iuclub</small>
          <input className="mono" placeholder="p-ten-du-an:3000" {...bind("upstream")} />
        </label>
        <label>
          Kiểm tra sống <small>trả 200 là sống</small>
          <input className="mono" placeholder="/api/health" {...bind("health")} />
        </label>
      </div>
      <div className="two">
        <label>
          API số liệu <small>JSON, gọi kèm Bearer token</small>
          <input className="mono" placeholder="/api/admin/stats" {...bind("summary")} />
        </label>
        <label>
          Trường hiển thị <small>key:Nhãn, cách nhau dấu phẩy; trống = mọi số</small>
          <input placeholder="visits:Lượt xem" {...bind("fields")} />
        </label>
      </div>
      <div className="two">
        <label>
          Cần đăng nhập Console <small>đường dẫn, cách nhau dấu phẩy</small>
          <input className="mono" placeholder="/admin, /api/admin" {...bind("protect")} />
        </label>
        <label>
          Trang quản trị riêng <small>nút “Trang quản trị” trên Console</small>
          <input className="mono" placeholder="/admin" {...bind("adminUrl")} />
        </label>
      </div>
      <div className="two">
        <label>
          API xuất dữ liệu <small>file tải về, gọi kèm Bearer token</small>
          <input className="mono" placeholder="/api/admin/export" {...bind("exportPath")} />
        </label>
        <label>
          Token API quản trị{" "}
          <small>{hasToken ? "đã lưu, để trống = giữ nguyên" : "để trống = Console tự sinh"}</small>
          <input type="password" autoComplete="off" {...bind("token")} />
        </label>
      </div>
    </>
  );
}

// Ô nhập điều khiển cho object state f
export const binder = (f, setF) => (name) => ({
  name,
  value: f[name],
  onChange: (e) => setF((o) => ({ ...o, [name]: e.target.value })),
});
