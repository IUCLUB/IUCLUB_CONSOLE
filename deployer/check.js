// Kiểm tra cấu hình compose (output của `docker compose config --format json`, đã chạy trong sandbox chỉ thấy /w)
// trước khi `up`. Danh sách cho phép: thiếu khoá nào ở đây thì khoá đó bị chặn.
// Mục tiêu: dự án không thoát ra host (bind mount, privileged, mạng host...) và không đụng tài nguyên dự án khác.

const SERVICE_KEYS = new Set([
  "build",
  "image",
  "command",
  "entrypoint",
  "environment",
  "networks",
  "volumes",
  "container_name",
  "restart",
  "depends_on",
  "healthcheck",
  "mem_limit",
  "mem_reservation",
  "cpus",
  "working_dir",
  "user",
  "labels",
  "expose",
  "stop_grace_period",
  "stop_signal",
  "init",
  "tty",
  "stdin_open",
  "read_only",
  "tmpfs",
  "shm_size",
  "pull_policy",
  "platform",
  "hostname",
  "deploy",
  "ulimits",
]);
const BUILD_KEYS = new Set([
  "context",
  "dockerfile",
  "dockerfile_inline",
  "args",
  "target",
  "labels",
]);
const TOP_KEYS = new Set(["name", "services", "networks", "volumes"]);
const DEPLOY_KEYS = new Set(["resources", "restart_policy"]);
const inW = (p) =>
  typeof p === "string" && (p === "/w" || p.startsWith("/w/")) && !p.split("/").includes("..");
const relOk = (p) =>
  typeof p === "string" && !p.startsWith("/") && !p.split(/[\\/]/).includes("..");
const emptyObj = (v) => v == null || (typeof v === "object" && !Object.keys(v).length);

/** → danh sách lỗi (rỗng = được phép chạy) */
export function checkCompose(slug, cfg) {
  const errs = [],
    own = `${slug}_`;
  if (!cfg || typeof cfg !== "object") return ["Không đọc được cấu hình compose."];
  for (const k of Object.keys(cfg))
    if (!TOP_KEYS.has(k)) errs.push(`Không cho phép khoá gốc "${k}".`);

  const nets = cfg.networks || {};
  for (const [k, n] of Object.entries(nets)) {
    if (k === "iuclub") {
      if (n?.external !== true || (n.name && n.name !== "iuclub"))
        errs.push(`Mạng iuclub phải là external.`);
      continue;
    }
    if (n?.external) errs.push(`Mạng "${k}": chỉ được nối mạng external "iuclub".`);
    if (!String(n?.name || "").startsWith(own)) errs.push(`Mạng "${k}" không được đặt tên riêng.`);
    for (const x of Object.keys(n || {}))
      if (
        !["name", "ipam", "internal", "labels"].includes(x) ||
        (x === "ipam" && !emptyObj(n.ipam))
      )
        errs.push(`Mạng "${k}": không cho phép "${x}".`);
  }
  const vols = cfg.volumes || {};
  for (const [k, v] of Object.entries(vols)) {
    if (!String(v?.name || "").startsWith(own))
      errs.push(`Volume "${k}" không được đặt tên riêng hoặc dùng volume ngoài.`);
    for (const x of Object.keys(v || {}))
      if (!["name", "labels"].includes(x)) errs.push(`Volume "${k}": không cho phép "${x}".`);
  }

  const services = cfg.services || {};
  if (!Object.keys(services).length) errs.push("Không có service nào.");
  let gatewayHit = false;
  for (const [name, s] of Object.entries(services)) {
    const at = `Service "${name}"`;
    for (const k of Object.keys(s || {}))
      if (!SERVICE_KEYS.has(k) && s[k] != null) errs.push(`${at}: không cho phép "${k}".`);
    if (s.build) {
      for (const k of Object.keys(s.build))
        if (!BUILD_KEYS.has(k)) errs.push(`${at}: build không cho phép "${k}".`);
      if (!inW(s.build.context)) errs.push(`${at}: build context phải nằm trong repo.`);
      if (s.build.dockerfile && !relOk(s.build.dockerfile))
        errs.push(`${at}: dockerfile phải nằm trong repo.`);
    }
    for (const v of s.volumes || []) {
      if (v.type === "tmpfs") continue;
      if (v.type !== "volume" || !(v.source in vols))
        errs.push(`${at}: chỉ được dùng named volume khai báo trong file (không bind mount).`);
    }
    for (const n of Object.keys(s.networks || {}))
      if (!(n in nets)) errs.push(`${at}: mạng "${n}" không khai báo.`);
    if (s.container_name != null) {
      if (s.container_name !== `p-${slug}` && !s.container_name.startsWith(`p-${slug}-`))
        errs.push(`${at}: container_name phải là p-${slug} (hoặc p-${slug}-...).`);
      if (s.container_name === `p-${slug}`) gatewayHit = "iuclub" in (s.networks || {});
    }
    if (s.deploy)
      for (const k of Object.keys(s.deploy))
        if (!DEPLOY_KEYS.has(k)) errs.push(`${at}: deploy không cho phép "${k}".`);
  }
  if (!gatewayHit)
    errs.push(
      `Cần một service có container_name: p-${slug} nối mạng iuclub (để gateway tìm thấy).`,
    );
  return errs;
}

export const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;
export const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
export const BRANCH = /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]{1,100}$/;
export const SHA = /^[0-9a-f]{7,40}$/;
export const ENV_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** {K: V} → nội dung .env. Giá trị lạ được bọc nháy đơn (compose đọc nguyên văn). */
export function envFile(env) {
  return (
    Object.entries(env)
      .map(([k, v]) => {
        v = String(v ?? "");
        if (!ENV_KEY.test(k)) throw new Error(`Tên biến không hợp lệ: ${k}`);
        if (/[\r\n]/.test(v)) throw new Error(`Biến ${k} không được xuống dòng.`);
        if (/^[\w@%+=:,./-]*$/.test(v)) return `${k}=${v}`;
        if (v.includes("'"))
          throw new Error(`Biến ${k} có ký tự ' và ký tự đặc biệt, không ghi an toàn được.`);
        return `${k}='${v}'`;
      })
      .join("\n") + "\n"
  );
}
