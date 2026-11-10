// ---------- Phân hệ: triển khai từ GitHub (gọi deployer qua mạng "deploy" riêng) ----------
import crypto from "node:crypto";
import { projectKey } from "../lib.js";
import { SECRET, DEPLOYER_URL } from "./config.js";
import { save, find, log } from "./store.js";
import { check } from "./monitor.js";

const DEPLOY_AUTH = crypto.createHmac("sha256", SECRET).update("deployer").digest("base64url");
export const callDeployer = (pathname, payload = {}) =>
  fetch(DEPLOYER_URL + pathname, {
    method: "POST",
    headers: { authorization: `Bearer ${DEPLOY_AUTH}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20 * 60e3),
  }).then((r) => r.json());
// Tiến độ đang chạy (bước + log) để tab Triển khai xem trực tiếp. Lỗi thì trả null, trang vẫn hiện.
export const deployStatus = (slug) =>
  fetch(`${DEPLOYER_URL}/status/${slug}`, {
    method: "POST",
    headers: { authorization: `Bearer ${DEPLOY_AUTH}` },
    signal: AbortSignal.timeout(2000),
  })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
export const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
  BRANCH = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]{1,100}$/,
  SHA = /^[0-9a-f]{7,40}$/;
const ENV_RESERVED = new Set(["IU_SLUG", "IU_KEY", "ADMIN_API_TOKEN"]); // Console tự điền
/** "A=1\n# ghi chú\nB=x" → { env: { A: "1", B: "x" } } hoặc { err } */
export function parseEnv(text) {
  const env = {};
  for (const [i, line] of String(text || "")
    .split(/\r?\n/)
    .entries()) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const j = line.indexOf("="),
      k = line.slice(0, j).trim();
    if (j < 1 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))
      return { err: `Dòng ${i + 1}: cần dạng TEN_BIEN=giá trị.` };
    if (ENV_RESERVED.has(k)) return { err: `${k} do Console tự điền, bỏ dòng này đi.` };
    env[k] = line.slice(j + 1);
  }
  return { env };
}
export function startDeploy(p, who, ref = "") {
  if (p.deploy?.state === "running") return false;
  p.deploy = { state: "running", at: Date.now(), by: who, ref };
  save();
  const env = {
    ...parseEnv(p.env).env,
    IU_SLUG: p.slug,
    IU_KEY: projectKey(SECRET, p.slug),
    ADMIN_API_TOKEN: p.token || "",
  };
  callDeployer(`/deploy/${p.slug}`, { repo: p.repo, branch: p.branch || "main", ref, env })
    .catch((err) => ({ ok: false, log: "Không gọi được deployer: " + err.message }))
    .then((r) => {
      const q = find(p.slug);
      if (!q) return;
      const startedAt = q.deploy?.at;
      q.deploy = {
        startedAt,
        steps: Array.isArray(r.steps) ? r.steps : [],
        state: r.ok ? "ok" : "fail",
        at: Date.now(),
        by: who,
        commit: r.commit || "",
        subject: r.subject || "",
        log: String(r.log || ""),
      };
      log(
        who,
        q.slug,
        r.ok ? "deploy" : "deploy_fail",
        r.commit ? `${r.commit.slice(0, 7)} · ${r.subject || ""}` : "",
      );
      if (r.ok) setTimeout(() => check(q), 5000);
    });
  return true;
}
