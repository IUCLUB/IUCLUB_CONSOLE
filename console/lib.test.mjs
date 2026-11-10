import test from "node:test";
import assert from "node:assert/strict";
import {
  sign,
  verify,
  parseUsers,
  hashPassword,
  verifyPassword,
  can,
  roleOf,
  gate,
  pickStats,
  isProtected,
  slugOf,
  stateOf,
  uptime,
  fromLocal,
  toLocal,
  fmtTime,
} from "./lib.js";

const S = "x".repeat(32);
const P = {
  slug: "2011",
  enabled: true,
  upstream: "p-2011:3000",
  protect: ["/admin", "/api/admin"],
};
const g = (o) =>
  gate({
    project: P,
    uri: "/",
    user: null,
    method: "GET",
    origin: "http://2011.localhost",
    consoleUrl: "http://admin.localhost",
    ...o,
  });

test("ký và xác minh phiên", () => {
  const t = sign(S, "s", { email: "a@b.vn" }, 60);
  assert.equal(verify(S, "s", t).email, "a@b.vn");
  assert.equal(verify(S, "h", t), null, "vé loại khác không dùng thay được");
  assert.equal(verify("y".repeat(32), "s", t), null, "sai secret");
  assert.equal(verify(S, "s", t.slice(0, -2) + "AA"), null, "sửa chữ ký");
  assert.equal(verify(S, "s", sign(S, "s", {}, -1)), null, "hết hạn");
});

test("cổng: bật/tắt, đường dẫn bảo vệ, không có dự án", () => {
  assert.deepEqual(g({}), { status: 200, upstream: "p-2011:3000", user: null });
  assert.equal(g({ project: null }).status, 404);
  assert.equal(g({ project: { ...P, enabled: false } }).status, 503);
  assert.equal(
    g({ project: { ...P, enabled: false }, user: "a@b.vn" }).status,
    200,
    "admin xem trước khi tắt",
  );
  const r = g({ uri: "/admin?x=1" });
  assert.equal(r.status, 302);
  assert.ok(
    r.location.startsWith(
      "http://admin.localhost/login?next=" + encodeURIComponent("http://2011.localhost/admin?x=1"),
    ),
  );
  assert.equal(g({ uri: "/api/admin/stats", method: "POST" }).status, 401);
  assert.equal(g({ uri: "/administrator" }).status, 200, "chỉ khớp theo đoạn đường dẫn");
  assert.equal(g({ uri: "/admin", user: "a@b.vn" }).user, "a@b.vn");
});

test("tiện ích", () => {
  assert.deepEqual(parseUsers("a@b.vn:pw1; C@D.vn:p:w; hỏng"), [
    { email: "a@b.vn", password: "pw1" },
    { email: "c@d.vn", password: "p:w" },
  ]);
  assert.equal(slugOf("2011.localhost:8088"), "2011");
  assert.equal(isProtected(["/admin"], "/admin"), true);
  assert.deepEqual(pickStats({ ok: true, data: { a: 1, b: "x", c: 3 } }, "c:Cờ, b:B"), [
    { label: "Cờ", value: 3 },
  ]);
  assert.deepEqual(pickStats({ a: 1, b: "x" }, ""), [{ label: "a", value: 1 }]);
});

test("lịch hẹn giờ", () => {
  const now = Date.parse("2026-11-20T00:00:00Z");
  assert.equal(stateOf({ enabled: false }, now).key, "off");
  assert.equal(stateOf({ enabled: true }, now).key, "on");
  assert.equal(stateOf({ enabled: true, openAt: "2026-11-20T01:00:00Z" }, now).key, "soon");
  assert.equal(stateOf({ enabled: true, closeAt: "2026-11-19T23:00:00Z" }, now).key, "ended");
  assert.equal(
    stateOf({ enabled: true, openAt: "2026-11-19T00:00:00Z", closeAt: "2026-11-21T00:00:00Z" }, now)
      .key,
    "on",
  );
  assert.equal(
    g({ project: { ...P, openAt: "2999-01-01T00:00:00Z" } }).status,
    503,
    "chưa tới giờ mở thì khách thấy trang tạm đóng",
  );
  assert.equal(
    g({ project: { ...P, openAt: "2999-01-01T00:00:00Z" }, user: "a@b.vn" }).status,
    200,
  );
  assert.equal(fromLocal("2026-11-20T07:00"), "2026-11-20T00:00:00.000Z", "giờ VN = UTC+7");
  assert.equal(toLocal("2026-11-20T00:00:00.000Z"), "2026-11-20T07:00");
  assert.equal(fromLocal("bậy"), "");
  assert.equal(fmtTime("2026-11-20T00:00:00Z"), "20/11/2026 07:00");
});

test("uptime", () => {
  assert.deepEqual(uptime([]), { pct: null, avg: null, n: 0 });
  assert.deepEqual(
    uptime([
      { ok: true, ms: 10 },
      { ok: true, ms: 30 },
      { ok: false, ms: 2000 },
      { ok: true, ms: 20 },
    ]),
    { pct: 75, avg: 20, n: 4 },
  );
});

test("mật khẩu", () => {
  const h = hashPassword("mật khẩu 1");
  assert.ok(verifyPassword("mật khẩu 1", h));
  assert.ok(!verifyPassword("mật khẩu 2", h));
  assert.ok(!verifyPassword("x", "rác"));
  assert.notEqual(hashPassword("a"), hashPassword("a"), "muối khác nhau");
});

test("phân quyền theo dự án", () => {
  const sup = { super: true },
    ed = { projects: { a: "editor", b: "viewer" } };
  assert.ok(can(sup, "x", "owner") && can(sup, "x", "super"));
  assert.ok(can(ed, "a", "viewer") && can(ed, "a", "editor"));
  assert.ok(!can(ed, "a", "owner"), "điều hành không sửa cài đặt");
  assert.ok(can(ed, "b", "viewer") && !can(ed, "b", "editor"));
  assert.ok(!can(ed, "c", "viewer"), "không thuộc dự án thì không thấy");
  assert.ok(!can({ projects: { a: "owner" } }, "a", "super"), "chủ dự án không phải quản trị viên");
  assert.ok(!can({ ...sup, disabled: true }, "a", "viewer"), "tài khoản bị khoá");
  assert.equal(roleOf(null, "a"), null);
});

test("exportExt: lấy đuôi từ tên file, rồi content-type, không cho ký tự lạ", async () => {
  const { exportExt } = await import("./lib.js");
  assert.equal(exportExt('attachment; filename="demo-2026-11-09.sqlite"', ""), ".sqlite");
  assert.equal(exportExt("attachment; filename=data.CSV", ""), ".csv");
  assert.equal(exportExt('attachment; filename="../../x.sh/../"', "text/csv"), ".csv");
  assert.equal(exportExt("", "application/json; charset=utf-8"), ".json");
  assert.equal(exportExt(null, null), ".bin");
});
