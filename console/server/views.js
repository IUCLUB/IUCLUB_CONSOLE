// Bộ chuyển dữ liệu ra JSON cho API: không bao giờ gửi hash/token.
// Mọi object dựng từ danh sách trường rõ ràng, không bao giờ {...p} / {...u}.
import { can, roleOf, stateOf, uptime } from "../lib.js";
import { CONSOLE_URL, PROJECT_URL, projectUrl } from "./config.js";
import { ACTIONS, find } from "./store.js";
import { mon } from "./monitor.js";

export const userView = (u) => ({
  email: u.email,
  name: u.name,
  super: !!u.super,
  // Bỏ slug của dự án đã xoá, như trang cũ
  projects: Object.fromEntries(Object.entries(u.projects || {}).filter(([s]) => find(s))),
});
export const configView = () => ({
  consoleUrl: CONSOLE_URL,
  projectUrl: PROJECT_URL,
  local: /localhost/.test(CONSOLE_URL),
});

// [tab, nhãn, vai trò tối thiểu để thấy]
export const TABS = [
  ["overview", "Tổng quan", "viewer"],
  ["connect", "Kết nối", "owner"],
  ["deploy", "Triển khai", "viewer"],
  ["access", "Lịch & truy cập", "viewer"],
  ["data", "Dữ liệu", "viewer"],
  ["members", "Thành viên", "owner"],
  ["activity", "Nhật ký", "viewer"],
  ["settings", "Cài đặt", "owner"],
];

// n lần kiểm tra gần nhất của dự án: [{t, ok, ms}]
export const checksOf = (slug, n) =>
  (mon.get(slug) || []).slice(-n).map(({ t, ok, ms }) => ({ t, ok, ms }));

export const logView = (l) => ({
  t: l.t,
  who: l.who,
  slug: l.slug,
  action: l.action,
  label: ACTIONS[l.action] || l.action,
  detail: l.detail,
  projectName: (l.slug && find(l.slug)?.name) || null,
});

// Thẻ dự án ở trang Tổng quan; live = kết quả probe(p)
export const projectCard = (p, me, live) => ({
  slug: p.slug,
  name: p.name,
  host: new URL(projectUrl(p.slug)).host,
  state: stateOf(p),
  role: roleOf(me, p.slug),
  up: live.up,
  stats: live.stats.slice(0, 3),
  checks: checksOf(p.slug, 40),
  uptime: uptime(mon.get(p.slug)),
});

const deployView = (d) =>
  d
    ? {
        state: d.state,
        at: d.at,
        by: d.by,
        commit: d.commit,
        subject: d.subject,
        ref: d.ref,
        log: d.log,
      }
    : null;

export function projectDetail(p, me) {
  const site = projectUrl(p.slug);
  const v = {
    slug: p.slug,
    name: p.name,
    url: site,
    host: new URL(site).host,
    upstream: p.upstream,
    health: p.health,
    summary: p.summary,
    fields: p.fields,
    protect: [...(p.protect || [])],
    adminUrl: p.adminUrl,
    exportPath: p.exportPath,
    enabled: !!p.enabled,
    openAt: p.openAt || null,
    closeAt: p.closeAt || null,
    closedMsg: p.closedMsg,
    state: stateOf(p),
    role: roleOf(me, p.slug),
    can: {
      editor: can(me, p.slug, "editor"),
      owner: can(me, p.slug, "owner"),
      super: can(me, p.slug, "super"),
    },
    hasToken: !!p.token,
    deploy: deployView(p.deploy),
  };
  // Chỉ chủ dự án thấy cấu hình triển khai; chạy localhost thì không có webhook.
  if (v.can.owner) {
    v.owner = { repo: p.repo, branch: p.branch, env: p.env, pubkey: p.pubkey };
    if (!configView().local)
      Object.assign(v.owner, {
        hookUrl: `${CONSOLE_URL}/hook/${p.slug}`,
        hookSecret: p.hookSecret,
      });
  }
  return v;
}
