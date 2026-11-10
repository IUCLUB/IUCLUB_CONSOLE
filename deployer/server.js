// Deployer IU CLUB: kéo repo private của dự án từ GitHub rồi `docker compose up`.
// Chỉ Console gọi được (mạng "deploy" riêng + khoá ký từ SECRET). Đây là service duy nhất giữ docker.sock.
// Mỗi lệnh compose chạy trong container sandbox chỉ thấy mã nguồn của đúng dự án đó (volume-subpath),
// nên file compose không đọc trộm được .env, khoá SSH hay mã nguồn của dự án khác.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { checkCompose, envFile, SLUG, REPO, BRANCH, SHA } from "./check.js";

const {
  SECRET,
  PORT = 4000,
  SRC = "/src",
  KEYS = "/keys",
  SRC_VOLUME = "iuclub-deploy-src",
  CLI_IMAGE = "docker:29-cli",
} = process.env;
if (!SECRET || SECRET.length < 24) throw new Error("Thiếu SECRET");
const AUTH = crypto.createHmac("sha256", SECRET).update("deployer").digest("base64url");
const authed = (req) => {
  const a = crypto
    .createHash("sha256")
    .update(String(req.headers.authorization || ""))
    .digest();
  return crypto.timingSafeEqual(a, crypto.createHash("sha256").update(`Bearer ${AUTH}`).digest());
};

// Tiến trình con chỉ nhận PATH/HOME: không lộ SECRET qua biến môi trường.
// onData nhận từng đoạn output để Console xem log trực tiếp.
const MAX_OUT = 2 << 20;
const run = (cmd, args, extraEnv = {}, onData) =>
  new Promise((resolve) => {
    let out = "";
    const child = spawn(cmd, args, { env: { PATH: process.env.PATH, HOME: "/tmp", ...extraEnv } });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15 * 60e3);
    const add = (b) => {
      const s = b.toString();
      out = (out + s).slice(-MAX_OUT);
      onData?.(s);
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    child.on("error", (err) => add(err.message));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, out: out.trim() });
    });
  });

// Image sandbox chỉ tải một lần. Mạng tới Docker Hub hay chập chờn nên thử lại vài lần.
async function ensureImage(onData) {
  if ((await run("docker", ["image", "inspect", CLI_IMAGE])).ok)
    return { ok: true, out: "(đã có sẵn)" };
  let r;
  for (let i = 1; i <= 3; i++) {
    r = await run("docker", ["pull", "-q", CLI_IMAGE], {}, onData);
    if (r.ok) return r;
    onData?.(`\nThử lại (${i}/3)…\n`);
    await new Promise((ok) => setTimeout(ok, 3000 * i));
  }
  return r;
}

const sandbox = (slug, args, onData) =>
  run(
    "docker",
    [
      "run",
      "--rm",
      "-v",
      "/var/run/docker.sock:/var/run/docker.sock",
      "--mount",
      `type=volume,src=${SRC_VOLUME},dst=/w,volume-subpath=${slug}`,
      "-w",
      "/w",
      CLI_IMAGE,
      "docker",
      "compose",
      "-p",
      slug,
      ...args,
    ],
    {},
    onData,
  );

async function key(slug) {
  const f = `${KEYS}/${slug}`;
  if (!fs.existsSync(f)) {
    fs.mkdirSync(KEYS, { recursive: true, mode: 0o700 });
    const r = await run("ssh-keygen", [
      "-q",
      "-t",
      "ed25519",
      "-N",
      "",
      "-C",
      `iuclub-${slug}`,
      "-f",
      f,
    ]);
    if (!r.ok) throw new Error(r.out);
  }
  return fs.readFileSync(f + ".pub", "utf8").trim();
}

const busy = new Set();
// Tiến độ lần triển khai gần nhất của từng dự án, cho Console xem trực tiếp
const live = new Map();
const STEPS = [
  ["fetch", "Kéo mã"],
  ["prepare", "Chuẩn bị môi trường"],
  ["check", "Kiểm tra cấu hình"],
  ["up", "Build và chạy"],
];

async function deploy(slug, { repo, branch = "main", ref = "", env = {} }) {
  const L = {
    running: true,
    steps: STEPS.map(([key, title]) => ({ key, title, state: "wait" })),
    log: "",
  };
  live.set(slug, L);
  const append = (t) => (L.log = (L.log + t).slice(-200_000));
  const begin = (key, cmd) => {
    Object.assign(
      L.steps.find((x) => x.key === key),
      { state: "run", startedAt: Date.now() },
    );
    append(`${L.log ? "\n" : ""}$ ${cmd}\n`);
  };
  const end = (key, ok) =>
    Object.assign(
      L.steps.find((x) => x.key === key),
      { state: ok ? "ok" : "fail", endedAt: Date.now() },
    );
  const result = (ok, extra = {}) => {
    L.running = false;
    return { ok, steps: L.steps, log: L.log.slice(-20_000), ...extra };
  };
  const fail = (key, msg, extra) => {
    if (key) end(key, false);
    append(`\n${msg}\n`);
    return result(false, extra);
  };

  if (!REPO.test(repo) || !BRANCH.test(branch) || (ref && !SHA.test(ref)))
    return fail(null, "Repo, nhánh hoặc commit không hợp lệ.");
  if (!fs.existsSync(`${KEYS}/${slug}`)) return fail(null, "Chưa tạo deploy key.");
  const dir = `${SRC}/${slug}`;
  const git = (a, onData) =>
    run(
      "git",
      ["-C", dir, ...a],
      {
        GIT_SSH_COMMAND: `ssh -i ${KEYS}/${slug} -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/app/known_hosts`,
      },
      onData,
    );

  // 1. Kéo mã
  begin("fetch", `git fetch ${ref || branch}`);
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(`${dir}/.git`)) await git(["init", "-q"]);
  await git(["config", "core.symlinks", "false"]); // symlink thành file thường: không trỏ ra ngoài repo được
  await git(["remote", "remove", "origin"]);
  await git(["remote", "add", "origin", `git@github.com:${repo}.git`]);
  if (!(await git(["fetch", "-q", "--depth", "1", "origin", ref || branch], append)).ok)
    return fail("fetch", "Không kéo được repo: kiểm tra deploy key đã thêm vào repo chưa.");
  if (!(await git(["checkout", "-q", "-f", "--detach", "FETCH_HEAD"], append)).ok)
    return fail("fetch", "Checkout lỗi.");
  await git(["clean", "-q", "-ffdx"]);
  const commit = (await git(["rev-parse", "HEAD"])).out,
    subject = (await git(["log", "-1", "--format=%s"])).out;
  append(`Commit ${commit.slice(0, 7)} · ${subject}\n`);
  end("fetch", true);

  // 2. Chuẩn bị: .env + image sandbox
  begin("prepare", `docker pull ${CLI_IMAGE}`);
  try {
    fs.writeFileSync(`${dir}/.env`, envFile(env));
  } catch (err) {
    return fail("prepare", err.message, { commit, subject });
  }
  const img = await ensureImage(append);
  if (!img.ok)
    return fail(
      "prepare",
      `Không tải được image ${CLI_IMAGE} (mạng tới Docker Hub có vấn đề). Bấm triển khai lại sau ít phút.`,
      { commit, subject },
    );
  if (img.out === "(đã có sẵn)") append("(đã có sẵn)\n");
  end("prepare", true);

  // 3. Kiểm tra cấu hình. Không stream: output có giá trị biến môi trường.
  begin("check", "docker compose config");
  const cfg = await sandbox(slug, ["config", "--format", "json"]);
  if (!cfg.ok) {
    append(cfg.out + "\n");
    return fail("check", "File docker-compose.yml lỗi, xem dòng phía trên.", { commit, subject });
  }
  let errs;
  try {
    errs = checkCompose(slug, JSON.parse(cfg.out));
  } catch {
    errs = ["Không đọc được output của compose config."];
  }
  if (errs.length)
    return fail("check", "Bị chặn vì vi phạm hợp đồng:\n- " + errs.join("\n- "), {
      commit,
      subject,
    });
  append("(ok)\n");
  end("check", true);

  // 4. Build và chạy
  begin("up", "docker compose up -d --build");
  const up = await sandbox(slug, ["up", "-d", "--build", "--remove-orphans"], append);
  end("up", up.ok);
  if (!up.ok)
    append(
      "\nBuild hoặc khởi động lỗi, xem log phía trên. Bản đang chạy (nếu có) vẫn giữ nguyên.\n",
    );
  return result(up.ok, { commit, subject });
}

async function readJson(req) {
  let s = "";
  for await (const c of req) {
    s += c;
    if (s.length > 256_000) throw new Error("quá lớn");
  }
  return s ? JSON.parse(s) : {};
}
const reply = (res, status, obj) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
};

http
  .createServer(async (req, res) => {
    try {
      if (!authed(req)) return reply(res, 401, { error: "unauthorized" });
      const m = req.method === "POST" && req.url.match(/^\/(key|deploy)\/([a-z0-9-]+)$/);
      if (!m || !SLUG.test(m[2])) return reply(res, 404, { error: "not found" });
      const slug = m[2];
      if (m[1] === "key") return reply(res, 200, { publicKey: await key(slug) });
      if (m[1] === "status") {
        const L = live.get(slug);
        return reply(
          res,
          200,
          L
            ? { running: L.running, steps: L.steps, log: L.log.slice(-20_000) }
            : { running: false },
        );
      }
      if (busy.has(slug))
        return reply(res, 409, { ok: false, log: "Đang triển khai, chờ lần trước xong." });
      busy.add(slug);
      try {
        return reply(res, 200, await deploy(slug, await readJson(req)));
      } finally {
        busy.delete(slug);
      }
    } catch (err) {
      console.error(err);
      reply(res, 500, { ok: false, log: "Lỗi deployer: " + err.message });
    }
  })
  .listen(PORT, () => console.log(`deployer :${PORT}`));
