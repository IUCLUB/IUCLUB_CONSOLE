import assert from "node:assert/strict";
import http from "node:http";
import { after, before, it } from "node:test";
import { baseProject, login, req, start } from "./helpers.mjs";

// Deployer giả: trả tiến độ đang chạy cho /status/<slug>
let fake, srv, cookie;
const hang = [];
const progress = {
  running: true,
  steps: [
    { key: "fetch", title: "Kéo mã", state: "ok", startedAt: 1, endedAt: 2, extra: "bỏ" },
    { key: "prepare", title: "Chuẩn bị môi trường", state: "run", startedAt: 2 },
  ],
  log: "$ git fetch main\nCommit abc1234 · Initial commit\n$ docker pull docker:29-cli\n",
};
before(async () => {
  fake = http.createServer((rq, rs) => {
    // /deploy treo tới khi test xong: Console coi như đang triển khai
    if (rq.url.startsWith("/deploy/")) return hang.push(rs);
    rs.writeHead(rq.url === `/status/${baseProject.slug}` ? 200 : 404, {
      "content-type": "application/json",
    });
    rs.end(JSON.stringify(progress));
  });
  await new Promise((ok) => fake.listen(0, "127.0.0.1", ok));
  srv = await start({
    projects: [{ ...baseProject, repo: "o/r", pubkey: "ssh-ed25519 X" }],
    env: { DEPLOYER_URL: `http://127.0.0.1:${fake.address().port}` },
  });
  cookie = await login(srv, "root@x.co", "password123");
  const run = await req(srv, `/api/projects/${baseProject.slug}/deploy`, {
    cookie,
    json: { do: "run" },
  });
  assert.equal(run.status, 200);
});
after(async () => {
  hang.forEach((rs) => rs.destroy());
  await srv?.stop();
  fake?.close();
});

it("đang triển khai: trang dự án có bước và log trực tiếp từ deployer", async () => {
  const r = await req(srv, `/api/projects/${baseProject.slug}`, { cookie });
  assert.equal(r.status, 200);
  const d = r.json.project.deploy;
  assert.equal(d.state, "running");
  assert.deepEqual(
    d.steps.map((s) => [s.key, s.state]),
    [
      ["fetch", "ok"],
      ["prepare", "run"],
    ],
  );
  assert.equal(d.steps[0].extra, undefined); // chỉ trường đã biết
  assert.match(d.log, /docker pull docker:29-cli/);
});
