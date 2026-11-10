import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { hashPassword } from "../lib.js";
import { login, req, start } from "./helpers.mjs";

// Cổng 1 đóng: kiểm tra sống thất bại ngay (up: false).
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
  hookSecret: "H00K",
  pubkey: "ssh-ed25519 X",
  env: "A=1",
  repo: "o/r",
};
const other = { ...demo, slug: "other", name: "Other", token: "", hookSecret: "", pubkey: "" };
const user = (email, projects) => ({
  email,
  name: email.split("@")[0],
  hash: hashPassword("password123"),
  projects,
});
const log = [
  { t: 5, who: "own@x.co", slug: "demo", action: "edit", detail: "" },
  { t: 4, who: "root@x.co", slug: "other", action: "on", detail: "" },
  { t: 3, who: "v@x.co", slug: "", action: "password", detail: "" },
  { t: 2, who: "ed@x.co", slug: "", action: "password", detail: "" },
  { t: 1, who: "root@x.co", slug: "gone", action: "delete", detail: "" },
];

let srv;
const c = {};
before(async () => {
  srv = await start({
    projects: [demo, other],
    users: [
      user("v@x.co", { demo: "viewer" }),
      user("ed@x.co", { demo: "editor" }),
      user("own@x.co", { demo: "owner" }),
      user("out@x.co", {}),
    ],
    log,
  });
  for (const e of ["v@x.co", "ed@x.co", "own@x.co", "out@x.co"])
    c[e] = await login(srv, e, "password123");
  c.root = await login(srv, "root@x.co", "password123");
});
after(() => srv?.stop());

const get = (p, who) => req(srv, p, { cookie: c[who] });
const NOT_FOUND = { error: "Không có dự án này, hoặc bạn chưa được thêm vào." };

describe("GET /api/projects/:slug", () => {
  it("viewer: không có bí mật, không có owner/members, tab đúng", async () => {
    const r = await get("/api/projects/demo", "v@x.co");
    assert.equal(r.status, 200);
    const s = JSON.stringify(r.json);
    for (const x of ["T0K", "H00K", "ssh-ed25519", "A=1"]) assert.ok(!s.includes(x), x);
    assert.equal(r.json.members, undefined);
    assert.equal(r.json.project.owner, undefined);
    assert.equal(r.json.project.repo, undefined);
    assert.deepEqual(
      r.json.tabs.map(([k]) => k),
      ["overview", "deploy", "access", "data", "activity"],
    );
    assert.equal(r.json.project.role, "viewer");
    assert.deepEqual(r.json.project.can, { editor: false, owner: false, super: false });
    assert.equal(r.json.live.up, false);
    assert.equal(r.json.memberCount, 4); // v, ed, own + root (quản trị viên)
  });
  it("owner: có owner block, hasToken, không lộ token", async () => {
    const r = await get("/api/projects/demo", "own@x.co");
    assert.equal(r.status, 200);
    const o = r.json.project.owner;
    assert.equal(o.hookSecret, "H00K");
    assert.equal(o.hookUrl, "http://admin.test/hook/demo");
    assert.equal(o.pubkey, "ssh-ed25519 X");
    assert.equal(o.env, "A=1");
    assert.equal(o.repo, "o/r");
    assert.equal(r.json.project.hasToken, true);
    assert.ok(!r.text.includes("T0K"));
    assert.ok(!r.text.includes('"hash"'));
    const keys = r.json.tabs.map(([k]) => k);
    for (const k of ["connect", "members", "settings"]) assert.ok(keys.includes(k), k);
    const m = r.json.members;
    assert.deepEqual(m.list.map((x) => x.email).sort(), ["ed@x.co", "own@x.co", "v@x.co"]);
    assert.equal(m.list.find((x) => x.email === "own@x.co").self, true);
    assert.deepEqual(
      m.supers.map((x) => x.email),
      ["root@x.co"],
    );
    assert.deepEqual(
      m.candidates.map((x) => x.email),
      ["out@x.co"],
    );
  });
  it("log của dự án có label và projectName", async () => {
    const r = await get("/api/projects/demo", "v@x.co");
    assert.deepEqual(
      r.json.log.map((l) => [l.action, l.label, l.projectName]),
      [["edit", "Sửa cài đặt", "Demo"]],
    );
  });
  it("người ngoài → 404", async () => {
    const r = await get("/api/projects/demo", "out@x.co");
    assert.equal(r.status, 404);
    assert.deepEqual(r.json, NOT_FOUND);
  });
  it("dự án không tồn tại → 404", async () => {
    const r = await get("/api/projects/nope", "root");
    assert.equal(r.status, 404);
    assert.deepEqual(r.json, NOT_FOUND);
  });
  it("chưa đăng nhập → 401", async () => {
    const r = await req(srv, "/api/projects/demo");
    assert.equal(r.status, 401);
  });
  it("owner gỡ v@x.co → v nhận 404", async () => {
    const members = (json) =>
      req(srv, "/api/projects/demo/members", { cookie: c["own@x.co"], json });
    const r = await members({ do: "remove", email: "v@x.co" });
    assert.equal(r.status, 200);
    assert.equal((await get("/api/projects/demo", "v@x.co")).status, 404);
    // Thêm lại để các test sau vẫn thấy v là viewer
    assert.equal((await members({ do: "add", email: "v@x.co", role: "viewer" })).status, 200);
    assert.equal((await get("/api/projects/demo", "v@x.co")).status, 200);
  });
});

describe("GET /api/home", () => {
  it("người ngoài: không có dự án", async () => {
    const r = await get("/api/home", "out@x.co");
    assert.equal(r.status, 200);
    assert.equal(r.json.projects.length, 0);
    assert.deepEqual(r.json.kpis, { count: 0, open: 0, avgUptime: null, incidents: 0 });
  });
  it("viewer: thẻ dự án không lộ bí mật", async () => {
    const r = await get("/api/home", "v@x.co");
    assert.deepEqual(
      r.json.projects.map((p) => p.slug),
      ["demo"],
    );
    const p = r.json.projects[0];
    assert.equal(p.host, "demo.test");
    assert.equal(p.role, "viewer");
    assert.equal(p.state.key, "on");
    assert.ok(Array.isArray(p.checks));
    assert.equal(r.json.kpis.count, 1);
    assert.equal(r.json.kpis.open, 1);
    for (const x of ["T0K", "H00K", "ssh-ed25519", "A=1"]) assert.ok(!r.text.includes(x), x);
    assert.ok(r.json.log.length <= 6);
  });
});

describe("GET /api/monitor, /api/schedule", () => {
  it("monitor: chỉ dự án thấy được", async () => {
    const r = await get("/api/monitor", "v@x.co");
    assert.deepEqual(
      r.json.projects.map((p) => [p.slug, p.upstream, p.health]),
      [["demo", "127.0.0.1:1", "/"]],
    );
  });
  it("schedule: canEdit theo vai trò", async () => {
    assert.equal((await get("/api/schedule", "v@x.co")).json.projects[0].canEdit, false);
    const r = await get("/api/schedule", "ed@x.co");
    assert.deepEqual(Object.keys(r.json.projects[0]).sort(), [
      "canEdit",
      "closeAt",
      "name",
      "openAt",
      "slug",
      "state",
    ]);
    assert.equal(r.json.projects[0].canEdit, true);
  });
});

describe("GET /api/activity", () => {
  it("viewer: chỉ thấy log của demo hoặc của chính mình", async () => {
    const r = await get("/api/activity", "v@x.co");
    assert.equal(r.status, 200);
    assert.ok(r.json.log.length > 0);
    for (const l of r.json.log) {
      assert.ok(l.slug === "demo" || l.who === "v@x.co", JSON.stringify(l));
      assert.ok("label" in l && "projectName" in l);
    }
  });
  it("super: dự án đã xoá → projectName null", async () => {
    const r = await get("/api/activity", "root");
    const gone = r.json.log.find((l) => l.slug === "gone");
    assert.equal(gone.projectName, null);
    assert.equal(gone.label, "Xoá dự án");
  });
});

describe("GET /api/users", () => {
  it("owner → 403", async () => {
    const r = await get("/api/users", "own@x.co");
    assert.equal(r.status, 403);
    assert.deepEqual(r.json, { error: "Chỉ quản trị viên quản lý tài khoản." });
  });
  it("super: không có hash, có disabled/self", async () => {
    const r = await get("/api/users", "root");
    assert.equal(r.status, 200);
    assert.ok(r.json.users.length >= 5);
    for (const u of r.json.users) assert.ok(!("hash" in u));
    assert.equal(r.json.users.find((u) => u.email === "root@x.co").self, true);
    assert.equal(r.json.users.find((u) => u.email === "v@x.co").disabled, false);
  });
});
