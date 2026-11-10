// Deployer IU CLUB: kéo repo private của dự án từ GitHub rồi `docker compose up`.
// Chỉ Console gọi được (mạng "deploy" riêng + khoá ký từ SECRET). Đây là service duy nhất giữ docker.sock.
// Mỗi lệnh compose chạy trong container sandbox chỉ thấy mã nguồn của đúng dự án đó (volume-subpath),
// nên file compose không đọc trộm được .env, khoá SSH hay mã nguồn của dự án khác.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import { execFile } from "node:child_process";
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

// Tiến trình con chỉ nhận PATH/HOME: không lộ SECRET qua biến môi trường
const run = (cmd, args, extraEnv = {}) =>
  new Promise((resolve) =>
    execFile(
      cmd,
      args,
      {
        timeout: 15 * 60e3,
        maxBuffer: 32 << 20,
        env: { PATH: process.env.PATH, HOME: "/tmp", ...extraEnv },
      },
      (err, stdout, stderr) => resolve({ ok: !err, out: `${stdout}${stderr}`.trim() }),
    ),
  );

const sandbox = (slug, args) =>
  run("docker", [
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
  ]);

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
async function deploy(slug, { repo, branch = "main", ref = "", env = {} }) {
  if (!REPO.test(repo) || !BRANCH.test(branch) || (ref && !SHA.test(ref)))
    return { ok: false, log: "Repo, nhánh hoặc commit không hợp lệ." };
  if (!fs.existsSync(`${KEYS}/${slug}`)) return { ok: false, log: "Chưa tạo deploy key." };
  const dir = `${SRC}/${slug}`,
    log = [];
  const step = async (title, p) => {
    const r = await p;
    log.push(`$ ${title}\n${r.out}`);
    return r;
  };
  const git = (...a) =>
    run("git", ["-C", dir, ...a], {
      GIT_SSH_COMMAND: `ssh -i ${KEYS}/${slug} -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/app/known_hosts`,
    });
  const fail = (msg) => ({ ok: false, log: [...log, msg].join("\n\n") });

  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(`${dir}/.git`)) await git("init", "-q");
  await git("config", "core.symlinks", "false"); // symlink thành file thường: không trỏ ra ngoài repo được
  await git("remote", "remove", "origin");
  await git("remote", "add", "origin", `git@github.com:${repo}.git`);
  if (
    !(
      await step(
        `git fetch ${ref || branch}`,
        git("fetch", "-q", "--depth", "1", "origin", ref || branch),
      )
    ).ok
  )
    return fail("Không kéo được repo: kiểm tra deploy key đã thêm vào repo chưa.");
  if (!(await step("git checkout", git("checkout", "-q", "-f", "--detach", "FETCH_HEAD"))).ok)
    return fail("Checkout lỗi.");
  await git("clean", "-q", "-ffdx");
  const commit = (await git("rev-parse", "HEAD")).out,
    subject = (await git("log", "-1", "--format=%s")).out;
  log.push(`Commit ${commit.slice(0, 7)} · ${subject}`);

  try {
    fs.writeFileSync(`${dir}/.env`, envFile(env));
  } catch (err) {
    return fail(err.message);
  }

  const cfg = await step("docker compose config", sandbox(slug, ["config", "--format", "json"]));
  if (!cfg.ok) return { ...fail("File compose lỗi."), commit };
  let errs;
  try {
    errs = checkCompose(slug, JSON.parse(cfg.out));
  } catch {
    errs = ["Không đọc được output của compose config."];
  }
  log[log.length - 1] = "$ docker compose config\n(ok)"; // không đưa giá trị biến môi trường vào nhật ký
  if (errs.length)
    return { ...fail("Bị chặn vì vi phạm hợp đồng:\n- " + errs.join("\n- ")), commit };

  const up = await step(
    "docker compose up -d --build",
    sandbox(slug, ["up", "-d", "--build", "--remove-orphans"]),
  );
  return { ok: up.ok, commit, subject, log: log.join("\n\n").slice(-20_000) };
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
