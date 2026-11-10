import test from "node:test";
import assert from "node:assert/strict";
import { checkCompose, envFile, BRANCH, REPO } from "./check.js";

// Hình dạng thật của `docker compose -p demo config --format json` với template starter
const ok = () => ({
  name: "demo",
  networks: {
    default: { name: "demo_default", ipam: {} },
    iuclub: { name: "iuclub", ipam: {}, external: true },
  },
  services: {
    app: {
      build: { context: "/w", dockerfile: "Dockerfile" },
      command: null,
      entrypoint: null,
      container_name: "p-demo",
      environment: { A: "1" },
      networks: { default: null, iuclub: null },
      mem_limit: "512m",
      restart: "unless-stopped",
      volumes: [{ type: "volume", source: "data", target: "/d", volume: {} }],
    },
    db: { image: "mongo:7", networks: { default: null } },
  },
  volumes: { data: { name: "demo_data" } },
});
const errsOf = (mut) => {
  const c = ok();
  mut(c);
  return checkCompose("demo", c);
};

test("template hợp lệ thì không lỗi", () => assert.deepEqual(checkCompose("demo", ok()), []));

test("chặn đường thoát ra host và sang dự án khác", () => {
  const bad = {
    "bind mount": (c) =>
      c.services.app.volumes.push({ type: "bind", source: "/", target: "/host" }),
    privileged: (c) => (c.services.app.privileged = true),
    "network_mode host": (c) => (c.services.app.network_mode = "host"),
    "pid host": (c) => (c.services.app.pid = "host"),
    "mở cổng": (c) => (c.services.app.ports = [{ target: 3000, published: "80" }]),
    cap_add: (c) => (c.services.app.cap_add = ["SYS_ADMIN"]),
    devices: (c) => (c.services.app.devices = ["/dev/sda"]),
    "volume của dự án khác": (c) =>
      (c.volumes.data = { name: "checkin_mongo-data", external: true }),
    "volume bind qua driver_opts": (c) =>
      (c.volumes.data.driver_opts = { type: "none", o: "bind", device: "/" }),
    "mạng nội bộ dự án khác": (c) => (c.networks.x = { name: "checkin_default", external: true }),
    "giả container dự án khác": (c) => (c.services.db.container_name = "p-checkin"),
    "build context ngoài repo": (c) => (c.services.app.build.context = "/"),
    "build context ..": (c) => (c.services.app.build.context = "/w/../keys"),
    additional_contexts: (c) => (c.services.app.build.additional_contexts = { a: "/" }),
    "build network host": (c) => (c.services.app.build.network = "host"),
    secrets: (c) => (c.secrets = { s: { file: "/etc/shadow" } }),
    volumes_from: (c) => (c.services.app.volumes_from = ["container:p-checkin"]),
    "không nối iuclub": (c) => (c.services.app.networks = { default: null }),
  };
  for (const [name, mut] of Object.entries(bad))
    assert.ok(errsOf(mut).length, `phải chặn: ${name}`);
});

test("ghi .env an toàn", () => {
  assert.equal(envFile({ A: "x/y:1", B: "có dấu cách #" }), "A=x/y:1\nB='có dấu cách #'\n");
  assert.throws(() => envFile({ A: "x\nB=1" }));
  assert.throws(() => envFile({ "A-B": "1" }));
  assert.throws(() => envFile({ A: "it's $x" }));
});

test("repo, nhánh", () => {
  assert.ok(REPO.test("iu-club/tri-an") && !REPO.test("a/b/c") && !REPO.test("-x/y y"));
  assert.ok(
    BRANCH.test("main") &&
      BRANCH.test("release/v1") &&
      !BRANCH.test("-x") &&
      !BRANCH.test("a..b") &&
      !BRANCH.test("a b"),
  );
});
