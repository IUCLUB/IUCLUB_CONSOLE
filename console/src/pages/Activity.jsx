import { useContext } from "react";
import { MeContext, useApi, useTitle } from "../api.js";
import PageHead from "../components/PageHead.jsx";
import LogRows from "../components/LogRows.jsx";
import { Pending } from "../components/Message.jsx";

export default function Activity() {
  useTitle("Nhật ký");
  const { user: me } = useContext(MeContext);
  const { data, error } = useApi("/api/activity");
  return (
    <>
      <PageHead
        title="Nhật ký hoạt động"
        lede={
          me.super
            ? "500 sự kiện gần nhất: thao tác của thành viên, thay đổi tài khoản và sự cố do Giám sát phát hiện."
            : "Sự kiện ở các dự án bạn tham gia."
        }
      />
      {!data ? (
        <Pending error={error} />
      ) : (
        <section className="sec card">
          <LogRows log={data.log} />
        </section>
      )}
    </>
  );
}
