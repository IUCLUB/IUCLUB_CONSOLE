// Khởi động Console thật trên cổng ngẫu nhiên, dữ liệu tạm; test gọi qua HTTP (hộp đen).
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });

export const baseProject = {
  slug: "demo",
  name: "Demo",
  enabled: true,
  upstream: "p-demo:3000",
  health: "/",
  summary: "",
  fields: "",
  protect: [],
  adminUrl: "/admin",
  token: "tok",
};

export async function start({ projects = [baseProject], users = [], log = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iu-console-"));
  const dataFile = path.join(dir, "data", "console.json");
  const seedFile = path.join(dir, "seed.json");
  fs.writeFileSync(seedFile, JSON.stringify({ projects, users, log }));
  const port = await freePort();
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      SECRET: "x".repeat(32),
      GATE_SECRET: "g".repeat(32),
      CONSOLE_URL: "http://admin.test",
      PROJECT_URL: "http://{slug}.test",
      DATA_FILE: dataFile,
      BACKUP_DIR: path.join(dir, "backups"),
      SEED_FILE: seedFile,
      DEPLOYER_URL: "http://127.0.0.1:1",
      CONSOLE_USERS: "root@x.co:password123",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const exited = new Promise((r) => child.once("exit", r));
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
    fs.rmSync(dir, { recursive: true, force: true });
  };
  let out = "",
    err = "";
  child.stderr.on("data", (d) => (err += d));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(`server start timeout
stdout: ${out}
stderr: ${err}`),
          ),
        10_000,
      );
      const onExit = (c) =>
        reject(
          new Error(`server exited ${c}
stdout: ${out}
stderr: ${err}`),
        );
      child.once("exit", onExit);
      child.stdout.on("data", (d) => {
        out += d;
        if (out.includes("console :")) {
          clearTimeout(timer);
          child.off("exit", onExit);
          resolve();
        }
      });
    });
  } catch (e) {
    await stop();
    throw e;
  }
  return { url: `http://127.0.0.1:${port}`, dataFile, stop };
}

export async function req(
  srv,
  p,
  { host = "admin.test", method, json, headers = {}, cookie, body } = {},
) {
  const h = { host, ...headers };
  if (cookie) h.cookie = cookie;
  if (json !== undefined) h["content-type"] = "application/json";
  // node:http thay vì fetch: fetch (undici) bỏ qua header Host tự đặt.
  const payload = json !== undefined ? JSON.stringify(json) : body;
  const u = new URL(srv.url);
  const r = await new Promise((resolve, reject) => {
    const q = http.request(
      {
        host: u.hostname,
        port: u.port,
        path: p,
        headers: h,
        method: method || (payload !== undefined ? "POST" : "GET"),
      },
      (res) => {
        let t = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (t += d));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: t }));
      },
    );
    q.on("error", reject);
    q.end(payload);
  });
  const { text } = r;
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {}
  return { status: r.status, headers: r.headers, text, json: parsed };
}

export async function login(srv, email, password) {
  const r = await req(srv, "/api/login", { json: { email, password } });
  const c = r.headers["set-cookie"]?.[0];
  if (!c) throw new Error(`login failed: ${r.status}`);
  return c.split(";")[0];
}
