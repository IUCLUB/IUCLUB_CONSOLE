// JSON API (trừ đăng nhập/phiên ở session.js). Quyền kiểm tra lại ở mọi request.
import { can, uptime, stateOf, pickStats } from "../lib.js";
import { db, find, visible, visibleLog } from "./store.js";
import { mon, probe } from "./monitor.js";
import { json, readJson } from "./http.js";
import * as act from "./actions.js";
import { deployStatus } from "./deploy.js";
import { userView, projectCard, projectDetail, logView, checksOf, TABS } from "./views.js";

const NOT_FOUND = "Không có dự án này, hoặc bạn chưa được thêm vào.";

async function home(me) {
  const list = visible(me);
  const live = await Promise.all(list.map(probe));
  const all = list.map((p) => uptime(mon.get(p.slug))).filter((u) => u.pct != null);
  return {
    projects: list.map((p, i) => projectCard(p, me, live[i])),
    kpis: {
      count: list.length,
      open: list.filter((p) => stateOf(p).key === "on").length,
      avgUptime: all.length ? all.reduce((a, u) => a + u.pct, 0) / all.length : null,
      incidents: db.log.filter(
        (l) => l.action === "down" && Date.now() - l.t < 24 * 3600e3 && can(me, l.slug, "viewer"),
      ).length,
    },
    log: visibleLog(me).slice(0, 6).map(logView),
  };
}

async function detail(p, me) {
  const need = (r) => can(me, p.slug, r);
  // Đang triển khai: lấy tiến độ trực tiếp từ deployer cùng lúc với kiểm tra sống
  const [live, progress] = await Promise.all([
    probe(p),
    p.deploy?.state === "running" ? deployStatus(p.slug) : null,
  ]);
  const out = {
    project: projectDetail(p, me, progress),
    tabs: TABS.filter(([, , r]) => need(r)).map(([k, l]) => [k, l]),
    live: {
      up: live.up,
      summaryOk: live.summaryOk,
      stats: live.stats,
      all: pickStats(live.data, ""),
    },
    checks: checksOf(p.slug, 60),
    uptime: uptime(mon.get(p.slug)),
    log: db.log.filter((l) => l.slug === p.slug).map(logView),
    // Như tab "Lịch & truy cập" cũ: thành viên còn hoạt động + quản trị viên
    memberCount: db.users.filter((x) => !x.disabled && (x.super || x.projects?.[p.slug])).length,
  };
  if (need("owner")) {
    const brief = (x) => ({ email: x.email, name: x.name });
    out.members = {
      list: db.users
        .filter((x) => !x.super && x.projects?.[p.slug])
        .map((x) => ({
          ...brief(x),
          role: x.projects[p.slug],
          disabled: !!x.disabled,
          self: x === me,
        })),
      supers: db.users.filter((x) => x.super && !x.disabled).map(brief),
      candidates: db.users
        .filter((x) => !x.super && !x.disabled && !x.projects?.[p.slug])
        .map(brief),
    };
  }
  return out;
}

const monitorView = (me) => ({
  projects: visible(me).map((p) => ({
    slug: p.slug,
    name: p.name,
    upstream: p.upstream,
    health: p.health,
    up: (mon.get(p.slug) || []).at(-1)?.ok,
    uptime: uptime(mon.get(p.slug)),
    checks: checksOf(p.slug, 60),
  })),
});
const scheduleView = (me) => ({
  projects: visible(me).map((p) => ({
    slug: p.slug,
    name: p.name,
    state: stateOf(p),
    openAt: p.openAt || null,
    closeAt: p.closeAt || null,
    canEdit: can(me, p.slug, "editor"),
  })),
});

// Trả [status, body] cho các GET; null = không phải route ở đây.
async function get(path, me) {
  if (path === "/api/home") return [200, await home(me)];
  if (path === "/api/monitor") return [200, monitorView(me)];
  if (path === "/api/schedule") return [200, scheduleView(me)];
  if (path === "/api/activity") return [200, { log: visibleLog(me).map(logView) }];
  if (path === "/api/users")
    return me.super
      ? [200, { users: usersList(me) }]
      : [403, { error: "Chỉ quản trị viên quản lý tài khoản." }];
  return null;
}

const usersList = (me) =>
  db.users.map((u) => ({ ...userView(u), disabled: !!u.disabled, self: u === me }));
// Kết quả thao tác → [status, body]; lỗi luôn là {error}
const out = (r, body = {}) => (r.error ? [r.status, { error: r.error }] : [200, body]);

// Route ghi không theo dự án; null = không phải route ở đây.
async function write(req, path, me) {
  if (req.method !== "POST") return null;
  if (path === "/api/account/password") return out(act.changePassword(me, await readJson(req)));
  if (path === "/api/users") {
    const r = act.manageUsers(me, await readJson(req));
    const { pw, confirmDelete, deleted } = r;
    return out(r, { users: usersList(me), pw, confirmDelete, deleted });
  }
  if (path === "/api/projects") {
    const r = act.createProject(me, await readJson(req));
    return out(r, { slug: r.slug });
  }
  return null;
}

// [phương thức, đuôi đường dẫn] → thao tác trên dự án
const PROJECT_ROUTES = {
  "POST /toggle": act.toggleProject,
  "POST /schedule": act.setSchedule,
  "POST /members": act.setMember,
  "POST /deploy": act.deployAction,
  "POST /delete": act.deleteProject,
  "PUT ": act.editProject,
};

// /api/projects/:slug[/...]: trả [status, body] hoặc hàm ghi thẳng res (file xuất).
async function project(req, path, me) {
  const m = path.match(/^\/api\/projects\/([a-z0-9-]+)(\/[a-z]+)?$/);
  if (!m) return null;
  const sub = m[2] || "";
  const run = PROJECT_ROUTES[`${req.method} ${sub}`];
  const isGet = req.method === "GET" && (sub === "" || sub === "/export");
  if (!run && !isGet) return null;
  const p = find(m[1]);
  // Không thuộc dự án thì coi như không có dự án đó
  if (!p || !can(me, p.slug, "viewer")) return [404, { error: NOT_FOUND }];
  if (sub === "/export") {
    const r = await act.exportData(p, me);
    return r.error ? out(r) : r.send;
  }
  if (isGet) return [200, await detail(p, me)];
  return out(await run(p, me, await readJson(req)));
}

export async function handleApi(req, res, url, me) {
  if (!me) return false;
  let r;
  try {
    r =
      (req.method === "GET" ? await get(url.pathname, me) : await write(req, url.pathname, me)) ||
      (await project(req, url.pathname, me));
  } catch (err) {
    if (!err.status) throw err; // chỉ lỗi đọc body (400) thành {error}
    r = [err.status, { error: err.message }];
  }
  if (!r) return false;
  if (typeof r === "function") r(res);
  else json(res, ...r);
  return true;
}
