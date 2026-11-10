import assert from "node:assert/strict";
import fs from "node:fs";
import { after, before, describe, it } from "node:test";
import { hashPassword } from "../lib.js";
import { login, req, start } from "./helpers.mjs";

const demo = {
  slug: "demo",
  name: "Demo",
  enabled: true,
  upstream: "127.0.0.1:1",
  health: "/",
  summary: "",
  fields: "",
  protect: [],
  adminUrl: "/admin",
  token: "T0K",
};
const bare = { ...demo, slug: "bare", name: "Bare", token: "" };
const user = (email, projects) => ({
  email,
  name: email.split("@")[0],
  hash: hashPassword("password123"),
  projects,
});

let srv;
const c = {};
before(async () => {
  srv = await start({
    projects: [demo, bare],
    users: [
      user("v@x.co", { demo: "viewer" }),
      user("ed@x.co", { demo: "editor" }),
      user("own@x.co", { demo: "owner", bare: "owner" }),
      user("acc@x.co", {}),
      user("del@x.co", {}),
      // "ghost" không còn dự án: /api/me phải bỏ đi
      user("mem@x.co", { bare: "viewer", ghost: "owner" }),
    ],
  });
  for (const e of ["v@x.co", "ed@x.co", "own@x.co", "acc@x.co", "del@x.co", "mem@x.co"])
    c[e] = await login(srv, e, "password123");
  c.root = await login(srv, "root@x.co", "password123");
});
after(() => srv?.stop());

const post = (p, who, json, method = "POST") => req(srv, p, { cookie: c[who], json, method });
const data = () => JSON.parse(fs.readFileSync(srv.dataFile, "utf8"));
const proj = (slug) => data().projects.find((p) => p.slug === slug);
const bad = (r, status, error) => {
  assert.equal(r.status, status, r.text);
  assert.deepEqual(r.json, { error });
};

describe("POST /api/account/password", () => {
  const pw = (json) => post("/api/account/password", "acc@x.co", json);
  it("sai mật khẩu hiện tại → 400", async () =>
    bad(
      await pw({ current: "nope", next: "newpassword1", confirm: "newpassword1" }),
      400,
      "Mật khẩu hiện tại không đúng.",
    ));
  it("mật khẩu mới ngắn → 400", async () =>
    bad(
      await pw({ current: "password123", next: "short", confirm: "short" }),
      400,
      "Mật khẩu mới cần ít nhất 10 ký tự.",
    ));
  it("hai lần nhập không khớp → 400", async () =>
    bad(
      await pw({ current: "password123", next: "newpassword1", confirm: "newpassword2" }),
      400,
      "Hai lần nhập mật khẩu mới không khớp.",
    ));
  it("đúng → 200, đăng nhập bằng mật khẩu mới được", async () => {
    const r = await pw({ current: "password123", next: "newpassword1", confirm: "newpassword1" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, {});
    assert.ok(await login(srv, "acc@x.co", "newpassword1"));
  });
});

describe("POST /api/users", () => {
  const u = (json, who = "root") => post("/api/users", who, json);
  it("không phải quản trị viên → 403", async () =>
    bad(
      await u({ do: "create", email: "z@x.co" }, "own@x.co"),
      403,
      "Chỉ quản trị viên quản lý tài khoản.",
    ));
  it("tạo → 200, mật khẩu tạm 12 ký tự, users không lộ hash", async () => {
    const r = await u({ do: "create", email: "New@X.co", name: "Mới", super: true });
    assert.equal(r.status, 200);
    assert.equal(r.json.pw.email, "new@x.co");
    assert.equal(r.json.pw.pw.length, 12);
    const n = r.json.users.find((x) => x.email === "new@x.co");
    assert.equal(n.super, true);
    assert.equal(n.name, "Mới");
    assert.ok(!r.text.includes('"hash"'));
  });
  it("trùng email → 400", async () =>
    bad(await u({ do: "create", email: "v@x.co" }), 400, "Email này đã có tài khoản."));
  it("xoá chưa xác nhận → confirmDelete", async () => {
    const r = await u({ do: "delete", email: "del@x.co" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json.confirmDelete, { email: "del@x.co", name: "del" });
    assert.ok(r.json.users.some((x) => x.email === "del@x.co"));
  });
  it('xoá với confirm "1" → deleted, phiên người đó hết hiệu lực', async () => {
    const r = await u({ do: "delete", email: "del@x.co", confirm: "1" });
    assert.equal(r.status, 200);
    assert.equal(r.json.deleted, "del@x.co");
    assert.ok(!r.json.users.some((x) => x.email === "del@x.co"));
    assert.equal((await req(srv, "/api/me", { cookie: c["del@x.co"] })).status, 401);
  });
  it("tự khoá mình → 400", async () =>
    bad(
      await u({ do: "lock", email: "root@x.co" }),
      400,
      "Không tự khoá, tự xoá hay tự bỏ quyền quản trị của chính mình.",
    ));
  it("khoá người khác → 200, users đánh dấu disabled", async () => {
    const r = await u({ do: "lock", email: "new@x.co" });
    assert.equal(r.status, 200);
    assert.equal(r.json.users.find((x) => x.email === "new@x.co").disabled, true);
  });
});

describe("POST /api/projects", () => {
  it("slug sai → 400", async () =>
    bad(
      await post("/api/projects", "root", { slug: "Bad Slug!", name: "X" }),
      400,
      "Slug chỉ gồm a-z, 0-9, dấu gạch ngang và không trùng tên dành riêng.",
    ));
  it("không phải quản trị viên → 403", async () =>
    bad(
      await post("/api/projects", "own@x.co", { slug: "neo2", name: "X" }),
      403,
      "Chỉ quản trị viên tạo dự án mới. Nhờ quản trị viên tạo và thêm bạn làm chủ dự án.",
    ));
  it("tạo → {slug}, tắt sẵn, upstream mặc định, có token", async () => {
    const r = await post("/api/projects", "root", {
      slug: "neo",
      name: "Neo",
      exportPath: "/api/admin/export",
    });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { slug: "neo" });
    const p = proj("neo");
    assert.equal(p.enabled, false);
    assert.equal(p.upstream, "p-neo:3000");
    assert.equal(p.exportPath, "/api/admin/export");
    assert.ok(p.token.length > 10);
  });
});

describe("toggle / schedule", () => {
  it("viewer bật/tắt → 403", async () =>
    bad(
      await post("/api/projects/demo/toggle", "v@x.co", {}),
      403,
      "Cần vai trò Điều hành trở lên để bật/tắt dự án.",
    ));
  it("editor bật/tắt → enabled đảo", async () => {
    const r = await post("/api/projects/demo/toggle", "ed@x.co", {});
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, {});
    assert.equal(proj("demo").enabled, false);
    await post("/api/projects/demo/toggle", "ed@x.co", {});
    assert.equal(proj("demo").enabled, true);
  });
  it("người ngoài → 404", async () =>
    bad(
      await post("/api/projects/demo/toggle", "acc@x.co", {}),
      404,
      "Không có dự án này, hoặc bạn chưa được thêm vào.",
    ));
  it("giờ đóng <= giờ mở → 400", async () =>
    bad(
      await post("/api/projects/demo/schedule", "ed@x.co", {
        openAt: "2026-12-01T10:00",
        closeAt: "2026-12-01T09:00",
      }),
      400,
      "Giờ đóng phải sau giờ mở.",
    ));
  it("ngày giờ sai (tháng 13) → 400", async () =>
    bad(
      await post("/api/projects/demo/schedule", "ed@x.co", { openAt: "2026-13-45T10:00" }),
      400,
      "Giờ không hợp lệ.",
    ));
  it("body quá lớn → 413", async () =>
    bad(
      await post("/api/projects/demo/schedule", "ed@x.co", { closedMsg: "x".repeat(70_000) }),
      413,
      "body quá lớn",
    ));
  it("đặt lịch rồi clear → bỏ hẹn giờ, giữ lời nhắn", async () => {
    let r = await post("/api/projects/demo/schedule", "ed@x.co", {
      openAt: "2026-12-01T10:00",
      closeAt: "2026-12-01T11:00",
      closedMsg: "Hẹn mai",
    });
    assert.equal(r.status, 200);
    assert.equal(proj("demo").openAt, "2026-12-01T03:00:00.000Z");
    r = await post("/api/projects/demo/schedule", "ed@x.co", { clear: true });
    assert.equal(r.status, 200);
    assert.equal(proj("demo").openAt, "");
    assert.equal(proj("demo").closedMsg, "Hẹn mai");
  });
});

describe("members", () => {
  it("editor → 403", async () =>
    bad(
      await post("/api/projects/demo/members", "ed@x.co", { do: "add", email: "acc@x.co" }),
      403,
      "Chỉ chủ dự án quản lý thành viên.",
    ));
  it("vai trò sai → 400", async () =>
    bad(
      await post("/api/projects/demo/members", "own@x.co", {
        do: "add",
        email: "acc@x.co",
        role: "god",
      }),
      400,
      "Vai trò không hợp lệ.",
    ));
  it("thêm rồi gỡ", async () => {
    let r = await post("/api/projects/demo/members", "own@x.co", {
      do: "add",
      email: "acc@x.co",
      role: "editor",
    });
    assert.equal(r.status, 200);
    assert.equal(data().users.find((u) => u.email === "acc@x.co").projects.demo, "editor");
    r = await post("/api/projects/demo/members", "own@x.co", { do: "remove", email: "acc@x.co" });
    assert.equal(r.status, 200);
    assert.equal(data().users.find((u) => u.email === "acc@x.co").projects.demo, undefined);
  });
});

describe("deploy", () => {
  const d = (slug, json) => post(`/api/projects/${slug}/deploy`, "own@x.co", json);
  it("editor → 403", async () =>
    bad(
      await post("/api/projects/demo/deploy", "ed@x.co", { do: "save" }),
      403,
      "Chỉ chủ dự án triển khai và cấu hình triển khai.",
    ));
  it("repo sai → 400", async () =>
    bad(
      await d("demo", { do: "save", repo: "not a repo" }),
      400,
      "Repo phải có dạng chu-so-huu/ten-repo.",
    ));
  it("env có IU_KEY → 400", async () =>
    bad(
      await d("demo", { do: "save", repo: "o/r", env: "IU_KEY=1" }),
      400,
      "IU_KEY do Console tự điền, bỏ dòng này đi.",
    ));
  it("lưu đúng → 200, có hookSecret", async () => {
    const r = await d("demo", { do: "save", repo: "https://github.com/o/r.git", env: "A=1" });
    assert.equal(r.status, 200);
    assert.equal(proj("demo").repo, "o/r");
    assert.equal(proj("demo").branch, "main");
    assert.ok(proj("demo").hookSecret);
  });
  it("chạy khi chưa có pubkey → 400", async () =>
    bad(await d("bare", { do: "run" }), 400, "Cần lưu repo và tạo deploy key trước."));
});

describe("PUT /api/projects/:slug", () => {
  const fields = { name: "Demo 2", upstream: "p-demo:3000", health: "/", adminUrl: "/admin" };
  it("editor → 403", async () =>
    bad(
      await post("/api/projects/demo", "ed@x.co", fields, "PUT"),
      403,
      "Chỉ chủ dự án sửa cài đặt.",
    ));
  it("upstream sai → 400", async () =>
    bad(
      await post("/api/projects/demo", "own@x.co", { ...fields, upstream: "nope" }, "PUT"),
      400,
      "Upstream phải có dạng ten-container:cong.",
    ));
  it("token trống → giữ token cũ", async () => {
    const r = await post("/api/projects/demo", "own@x.co", { ...fields, token: "" }, "PUT");
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, {});
    assert.equal(proj("demo").name, "Demo 2");
    assert.equal(proj("demo").token, "T0K");
  });
});

describe("export", () => {
  it("viewer → 403", async () =>
    bad(
      await req(srv, "/api/projects/demo/export", { cookie: c["v@x.co"] }),
      403,
      "Cần vai trò Điều hành trở lên để xuất dữ liệu.",
    ));
  it("chưa cấu hình exportPath → 404", async () =>
    bad(
      await req(srv, "/api/projects/demo/export", { cookie: c["ed@x.co"] }),
      404,
      "Dự án chưa cấu hình API xuất dữ liệu.",
    ));
});

describe("delete + userView", () => {
  it("/api/me bỏ dự án không còn tồn tại", async () => {
    const r = await req(srv, "/api/me", { cookie: c["mem@x.co"] });
    assert.deepEqual(r.json.user.projects, { bare: "viewer" });
  });
  it("chủ dự án xoá → 403", async () =>
    bad(
      await post("/api/projects/bare/delete", "own@x.co", { confirm: "bare" }),
      403,
      "Chỉ quản trị viên xoá dự án.",
    ));
  it("gõ sai slug → 400", async () =>
    bad(
      await post("/api/projects/bare/delete", "root", { confirm: "nope" }),
      400,
      "Gõ đúng slug để xác nhận xoá.",
    ));
  it("xoá → dự án mất, thành viên không còn thấy", async () => {
    const r = await post("/api/projects/bare/delete", "root", { confirm: "bare" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, {});
    assert.equal(proj("bare"), undefined);
    const me = await req(srv, "/api/me", { cookie: c["mem@x.co"] });
    assert.deepEqual(me.json.user.projects, {});
  });
  it("JSON hỏng → 400", async () => {
    const r = await req(srv, "/api/projects/demo/toggle", {
      cookie: c["ed@x.co"],
      method: "POST",
      body: "{",
      headers: { "content-type": "application/json" },
    });
    bad(r, 400, "JSON không hợp lệ.");
  });
});
