// Đầu trang: tiêu đề, lời dẫn, nút phụ bên phải (như pageHead() cũ)
export default function PageHead({ title, lede, children }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      <span className="sp"></span>
      {children}
    </div>
  );
}
