import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, describe, it } from "node:test";
import { hashPassword } from "../lib.js";
import { baseProject, req, start } from "./helpers.mjs";

const repoProject = {
  ...baseProject,
  slug: "hk",
  repo: "o/r",
  hookSecret: "s3cret",
  branch: "main",
};
const closed = { ...baseProject, slug: "shut", enabled: false, upstream: "p-shut:3000" };
const member = {
  email: "m@x.co",
  name: "m",
  hash: hashPassword("memberpass1"),
  projects: { shut: "editor" },
};

let srv;
before(async () => {
  srv = await start({ projects: [baseProject, closed, repoProject], users: [member] });
});
after(() => srv?.stop());

// Caddy gửi kèm X-Iu-Gate (= GATE_SECRET) khi gọi /gate
const GATE = "g".repeat(32);
// key = null: không gửi header (như container gọi thẳng)
const gate = (host, cookie, key = GATE) =>
  req(srv, "/gate", {
    host,
    cookie,
    headers: { "x-forwarded-uri": "/", ...(key === null ? {} : { "x-iu-gate": key }) },
  });

// Lấy cookie iu_s của domain dự án qua vé handoff.
async function projectCookie(email, password, host) {
  const h = await req(srv, "/api/login", { json: { email, password, next: `http://${host}/` } });
  assert.equal(h.status, 200);
  const to = new URL(h.json.to);
  assert.equal(to.host, host);
  const a = await req(srv, to.pathname + to.search, { host });
  assert.equal(a.status, 302);
  return a.headers["set-cookie"][0].split(";")[0];
}

describe("gate", () => {
  // Container dự án khác trong mạng iuclub gọi thẳng /gate thì không lấy được x-iu-key
  it("thiếu hoặc sai X-Iu-Gate → 403, không lộ x-iu-key", async () => {
    for (const key of [null, "", "sai"]) {
      const r = await gate(`${baseProject.slug}.test`, undefined, key);
      assert.equal(r.status, 403);
      assert.equal(r.headers["x-iu-key"], undefined);
    }
  });

  it("unknown subdomain → 404", async () => {
    assert.equal((await gate("nope.test")).status, 404);
  });
  it("disabled project, anonymous → 503 and body contains Tạm đóng", async () => {
    const r = await gate("shut.test");
    assert.equal(r.status, 503);
    assert.match(r.text, /Tạm đóng/);
  });
  it("enabled project → 200 with x-iu-upstream and x-iu-key", async () => {
    const r = await gate("demo.test");
    assert.equal(r.status, 200);
    assert.equal(r.headers["x-iu-upstream"], "p-demo:3000");
    assert.ok(r.headers["x-iu-key"]);
  });
  it("member cookie on disabled project → 200 with x-iu-user and x-iu-role", async () => {
    const cookie = await projectCookie(member.email, "memberpass1", "shut.test");
    const r = await gate("shut.test", cookie);
    assert.equal(r.status, 200);
    assert.equal(r.headers["x-iu-user"], member.email);
    assert.equal(r.headers["x-iu-role"], "editor");
  });
});

it("tls-ask: admin host 200, project host 200, other 404", async () => {
  const ask = (d) => req(srv, `/tls-ask?domain=${d}`, { host: "anything.test" });
  assert.equal((await ask("admin.test")).status, 200);
  assert.equal((await ask("demo.test")).status, 200);
  assert.equal((await ask("evil.com")).status, 404);
});

describe("hook", () => {
  const post = (body, sig, event) =>
    req(srv, "/hook/hk", {
      method: "POST",
      body,
      headers: { "x-hub-signature-256": sig, "x-github-event": event },
    });
  const sign = (b) => "sha256=" + crypto.createHmac("sha256", "s3cret").update(b).digest("hex");

  it("bad signature → 401 bad signature", async () => {
    const r = await post("{}", "sha256=00", "ping");
    assert.equal(r.status, 401);
    assert.equal(r.text, "bad signature");
  });
  it("ping with valid HMAC → 200 pong", async () => {
    const r = await post("{}", sign("{}"), "ping");
    assert.equal(r.status, 200);
    assert.equal(r.text, "pong");
  });
  it("push to other branch → 202 bỏ qua", async () => {
    const b = JSON.stringify({ ref: "refs/heads/dev" });
    const r = await post(b, sign(b), "push");
    assert.equal(r.status, 202);
    assert.equal(r.text, "bỏ qua");
  });
});

it("non-admin host for console paths → 404", async () => {
  assert.equal((await req(srv, "/", { host: "demo.test" })).status, 404);
});
