// Chống CSRF trên các thao tác ghi thật (không chỉ /api/logout).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { baseProject, login, req, start } from "./helpers.mjs";

let srv, cookie;
before(async () => {
  srv = await start();
  cookie = await login(srv, "root@x.co", "password123");
});
after(() => srv?.stop());

const enabled = async () => (await req(srv, "/api/projects/demo", { cookie })).json.project.enabled;
const sai = { error: "Sai nguồn gửi." };

describe("CSRF trên thao tác ghi thật", () => {
  it("toggle: form-urlencoded + Origin lạ → 403, không đổi", async () => {
    const before = await enabled();
    const r = await req(srv, "/api/projects/demo/toggle", {
      method: "POST",
      cookie,
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "http://evil" },
      body: "x=1",
    });
    assert.equal(r.status, 403);
    assert.deepEqual(r.json, sai);
    assert.equal(await enabled(), before);
  });
  it("toggle: JSON đúng nhưng Origin lạ → 403, không đổi", async () => {
    const before = await enabled();
    const r = await req(srv, "/api/projects/demo/toggle", {
      cookie,
      json: {},
      headers: { origin: "http://evil" },
    });
    assert.equal(r.status, 403);
    assert.deepEqual(r.json, sai);
    assert.equal(await enabled(), before);
  });
  it("PUT dự án với text/plain → 403, không đổi", async () => {
    const r = await req(srv, "/api/projects/demo", {
      method: "PUT",
      cookie,
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ ...baseProject, name: "Hacked" }),
    });
    assert.equal(r.status, 403);
    assert.deepEqual(r.json, sai);
    const p = (await req(srv, "/api/projects/demo", { cookie })).json.project;
    assert.equal(p.name, baseProject.name);
  });
  it("đối chứng: toggle JSON, không Origin → 200 và đảo enabled", async () => {
    const before = await enabled();
    const r = await req(srv, "/api/projects/demo/toggle", { cookie, json: {} });
    assert.equal(r.status, 200);
    assert.equal(await enabled(), !before);
  });
});
