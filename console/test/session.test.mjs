import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { hashPassword } from "../lib.js";
import { baseProject, login, req, start } from "./helpers.mjs";

const member = {
  email: "m@x.co",
  name: "m",
  hash: hashPassword("memberpass1"),
  projects: { demo: "viewer" },
};
const outsider = { email: "o@x.co", name: "o", hash: hashPassword("outsider-pw1"), projects: {} };

let srv;
before(async () => {
  // "broken": protect không phải mảng, để GET chi tiết dự án ném lỗi thật (kiểm tra JSON 500)
  srv = await start({
    projects: [baseProject, { ...baseProject, slug: "broken", name: "Broken", protect: 5 }],
    users: [member, outsider],
  });
});
after(() => srv?.stop());

const post = (p, json, opts = {}) => req(srv, p, { json, ...opts });
const root = { email: "root@x.co", password: "password123" };

describe("POST /api/login", () => {
  it("wrong password → 401", async () => {
    const r = await post("/api/login", { ...root, password: "nope" });
    assert.equal(r.status, 401);
    assert.deepEqual(r.json, { error: "Email hoặc mật khẩu không đúng." });
  });
  it("ok → 200 {to:'/'} and iu_c cookie HttpOnly SameSite=Lax", async () => {
    const r = await post("/api/login", root);
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { to: "/" });
    const c = r.headers["set-cookie"][0];
    assert.match(c, /^iu_c=/);
    assert.match(c, /HttpOnly/);
    assert.match(c, /SameSite=Lax/);
  });
  it("next on the console host → local path", async () => {
    const r = await post("/api/login", {
      ...root,
      next: "http://admin.test/p/demo?tab=deploy",
    });
    assert.equal(r.json.to, "/p/demo?tab=deploy");
  });
  it("next //evil.com/ on the console host → to '/'", async () => {
    const r = await post("/api/login", { ...root, next: "http://admin.test//evil.com/" });
    assert.equal(r.json.to, "/");
  });
  it("next to a project: member gets a ticket, non-member 403 + cookie", async () => {
    const next = "http://demo.test/admin";
    const ok = await post("/api/login", { email: member.email, password: "memberpass1", next });
    assert.equal(ok.status, 200);
    assert.ok(ok.json.to.startsWith("http://demo.test/__iu/auth?t="));
    const no = await post("/api/login", { email: outsider.email, password: "outsider-pw1", next });
    assert.equal(no.status, 403);
    assert.equal(
      no.json.error,
      "Bạn chưa được thêm vào dự án “Demo”. Nhờ chủ dự án thêm bạn ở tab Thành viên.",
    );
    assert.ok(no.headers["set-cookie"][0].startsWith("iu_c="));
  });
  it("11th failed login from one IP → 429", async () => {
    const h = { "x-forwarded-for": "9.9.9.9" };
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await post("/api/login", { ...root, password: "x" }, { headers: h })).status,
        401,
      );
    const r = await post("/api/login", { ...root, password: "x" }, { headers: h });
    assert.equal(r.status, 429);
    assert.deepEqual(r.json, { error: "Sai quá nhiều lần. Thử lại sau 15 phút." });
  });
});

describe("GET /api/me", () => {
  it("no cookie → 401", async () => {
    const r = await req(srv, "/api/me");
    assert.equal(r.status, 401);
    assert.deepEqual(r.json, { error: "Cần đăng nhập." });
  });
  it("with cookie → user without hash, config.local false", async () => {
    const l = await post("/api/login", root);
    const r = await req(srv, "/api/me", { cookie: l.headers["set-cookie"][0].split(";")[0] });
    assert.equal(r.status, 200);
    assert.equal(r.json.user.email, root.email);
    assert.equal("hash" in r.json.user, false);
    assert.equal(r.json.config.local, false);
  });
  it("unknown /api path: logged out 401, logged in 404", async () => {
    assert.equal((await req(srv, "/api/zzz")).status, 401);
    const l = await post("/api/login", root);
    const r = await req(srv, "/api/zzz", { cookie: l.headers["set-cookie"][0].split(";")[0] });
    assert.equal(r.status, 404);
    assert.deepEqual(r.json, { error: "Không tìm thấy." });
  });
});

describe("CSRF on mutating /api", () => {
  it("logout with text/plain → 403", async () => {
    const r = await req(srv, "/api/logout", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    assert.equal(r.status, 403);
    assert.deepEqual(r.json, { error: "Sai nguồn gửi." });
  });
  it("logout with foreign Origin → 403", async () => {
    const r = await post("/api/logout", {}, { headers: { origin: "http://evil" } });
    assert.equal(r.status, 403);
  });
  it("logout ok → 200 {} and clears cookie", async () => {
    const r = await post("/api/logout", {}, { headers: { origin: "http://admin.test" } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, {});
    assert.match(r.headers["set-cookie"][0], /Max-Age=0/);
  });
});

describe("GET /login khi đã đăng nhập (vé chuyển tiếp)", () => {
  const next = encodeURIComponent("http://demo.test/");
  it("thành viên → 302 sang vé của dự án", async () => {
    const c = await login(srv, member.email, "memberpass1");
    const r = await req(srv, `/login?next=${next}`, { cookie: c });
    assert.equal(r.status, 302);
    assert.ok(r.headers.location.startsWith("http://demo.test/__iu/auth?t="), r.headers.location);
  });
  it("không phải thành viên → 403 Chưa có quyền", async () => {
    const c = await login(srv, outsider.email, "outsider-pw1");
    const r = await req(srv, `/login?next=${next}`, { cookie: c });
    assert.equal(r.status, 403);
    assert.match(r.text, /Chưa có quyền/);
    assert.match(r.text, /Bạn chưa được thêm vào dự án “Demo”/);
  });
  it("không có next → 302 /", async () => {
    const c = await login(srv, root.email, root.password);
    const r = await req(srv, "/login", { cookie: c });
    assert.equal(r.status, 302);
    assert.equal(r.headers.location, "/");
  });
  it("chưa đăng nhập → 200 text/html (giao diện)", async () => {
    const r = await req(srv, `/login?next=${next}`);
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /^text\/html/);
  });
});

it("lỗi không lường trước ở /api/* → JSON 500", async () => {
  const c = await login(srv, root.email, root.password);
  const r = await req(srv, "/api/projects/broken", { cookie: c });
  assert.equal(r.status, 500);
  assert.match(r.headers["content-type"], /^application\/json/);
  assert.deepEqual(r.json, { error: "Có lỗi xảy ra." });
});
