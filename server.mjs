import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { clearCookie, hashPassword, parseCookies, sessionCookie, tokensEqual, verifyPassword } from "./lib/auth.mjs";
import { SIMS } from "./lib/copy.mjs";
import {
  addIdeaNote,
  addInterviewNote,
  addMeetingNote,
  addMessage,
  addSupport,
  addTeamMember,
  claimInterview,
  completeInterview,
  createIdea,
  createInterview,
  createMeeting,
  createReport,
  createSession,
  createTask,
  createTeam,
  createUser,
  deleteSession,
  findUser,
  findUserByEmail,
  getIdea,
  getInterview,
  getMeeting,
  getReport,
  getTask,
  getTeam,
  ideaNotes,
  interviewNotes,
  isTeamMember,
  joinMeeting,
  leaveTeam,
  listBySimulation,
  listChatPeers,
  listIdeas,
  listInterviews,
  listJoinedOtherMeetings,
  listMeetingsForMonth,
  listMessages,
  listSupport,
  listTasksForTeam,
  listTasksForUser,
  listTeamsFor,
  listUsers,
  listVisibleReports,
  meetingMembers,
  meetingMembership,
  meetingNotes,
  openDb,
  openPunch,
  practiceMillis,
  punchIn,
  punchOut,
  readSession,
  setAvatarType,
  setReportShared,
  setSimulation,
  setTaskStatus,
  teamMembers,
  upcomingMeetings,
  updatePractice,
} from "./lib/db.mjs";
import { cleanLine, cleanText, cleanZoomLink, validEmail, validStamp, wallStamp } from "./lib/format.mjs";
import { notesHtml, noticeText } from "./lib/html.mjs";
import {
  authPage,
  calendarPage,
  chatPage,
  chatsPage,
  chatThread,
  deskPage,
  enterSimPage,
  floorPage,
  homePage,
  ideaPage,
  ideasPage,
  interviewPage,
  interviewsPage,
  meetingPage,
  memberPage,
  membersPage,
  messagePage,
  profilePage,
  quarryPage,
  reportPage,
  simPage,
  supportPage,
  teamPage,
  teamsPage,
} from "./lib/pages.mjs";
import { barChart, cityById, isDataset, loadDataset } from "./lib/quarry.mjs";
import { attachSignal, notifyUser } from "./lib/signal.mjs";

const ROOT = import.meta.dirname;
const PUBLIC_DIR = join(ROOT, "public");
const DUMMY_HASH = hashPassword("not-a-real-password");
const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const CSP = [
  "default-src 'self'",
  "img-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const routes = [
  ["GET", "/", (ctx) => sendHtml(ctx, 200, homePage(ctx))],
  ["GET", "/copperline", (ctx) => sendHtml(ctx, 200, simPage(ctx, "copperline"))],
  ["GET", "/kindling", (ctx) => sendHtml(ctx, 200, simPage(ctx, "kindling"))],
  ["GET", "/quarry", (ctx) => sendHtml(ctx, 200, simPage(ctx, "quarry"))],
  ["GET", "/support", supportGet],
  ["POST", "/support", supportPost],
  ["GET", "/login", loginGet],
  ["POST", "/login", loginPost],
  ["GET", "/signup", signupGet],
  ["POST", "/signup", signupPost],
  ["GET", "/:sim/login", simLoginGet],
  ["POST", "/:sim/login", simLoginPost],
  ["GET", "/:sim/signup", simSignupGet],
  ["POST", "/:sim/signup", simSignupPost],
  ["POST", "/logout", logout],
  ["GET", "/desk", desk],
  ["GET", "/profile", profileGet],
  ["POST", "/profile", profilePost],
  ["POST", "/profile/photo", profilePhoto],
  ["GET", "/avatars/:id", avatarGet],
  ["POST", "/punch/in", punchInPost],
  ["POST", "/punch/out", punchOutPost],
  ["GET", "/members", members],
  ["GET", "/members/:id", memberGet],
  ["POST", "/members/:id/meeting", memberMeeting],
  ["GET", "/chats", chatsGet],
  ["GET", "/chats/:id/messages", chatMessages],
  ["GET", "/chats/:id", chatGet],
  ["POST", "/chats/:id", chatPost],
  ["GET", "/teams", teamsGet],
  ["POST", "/teams", teamsPost],
  ["GET", "/teams/:id", teamGet],
  ["POST", "/teams/:id/members", teamAdd],
  ["POST", "/teams/:id/leave", teamLeave],
  ["POST", "/teams/:id/tasks", taskCreate],
  ["POST", "/tasks/:id", taskStatus],
  ["GET", "/calendar", calendar],
  ["POST", "/meetings", meetingCreate],
  ["GET", "/meetings/:id", meetingGet],
  ["POST", "/meetings/:id/join", meetingJoin],
  ["POST", "/meetings/:id/notes", meetingNotePost],
  ["GET", "/meetings/:id/notes", meetingNoteGet],
  ["GET", "/copperline/floor", floor],
  ["GET", "/kindling/table", ideasGet],
  ["POST", "/kindling/ideas", ideaCreate],
  ["GET", "/kindling/ideas/:id", ideaGet],
  ["POST", "/kindling/ideas/:id/notes", ideaNotePost],
  ["GET", "/kindling/ideas/:id/notes", ideaNoteGet],
  ["GET", "/quarry/room", quarryGet],
  ["POST", "/quarry/reports", reportCreate],
  ["GET", "/reports/:id", reportGet],
  ["POST", "/reports/:id/share", reportShare],
  ["GET", "/interviews", interviewsGet],
  ["POST", "/interviews", interviewCreate],
  ["GET", "/interviews/:id", interviewGet],
  ["POST", "/interviews/:id/claim", interviewClaim],
  ["POST", "/interviews/:id/notes", interviewNotePost],
  ["GET", "/interviews/:id/notes", interviewNoteGet],
  ["POST", "/interviews/:id/complete", interviewComplete],
];

export async function start({ port, host, dbFile } = {}) {
  openDb(dbFile || join(ROOT, "data", "daymark.sqlite"));
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Something went wrong.");
      }
    });
  });
  attachSignal(server);
  const listenPort = port ?? Number(process.env.PORT || 3000);
  const listenHost = host ?? process.env.HOST ?? "0.0.0.0";
  await new Promise((resolve) => server.listen(listenPort, listenHost, resolve));
  return server;
}

async function handle(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    res.writeHead(308, { Location: pathname.slice(0, -1) + url.search });
    res.end();
    return;
  }
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("ok");
    return;
  }
  if (req.method === "GET" && serveStatic(req, res, pathname)) return;

  const body = await readBody(req);
  const cookies = parseCookies(req.headers.cookie || "");
  let session = readSession(cookies.dm);
  let setCookie = null;
  if (!session && req.method === "GET") {
    session = createSession(null);
    setCookie = sessionCookie(session.id);
  }
  const user = session?.user_id ? findUser(session.user_id) : null;
  const ctx = {
    req,
    res,
    url,
    path: pathname,
    query: url.searchParams,
    body,
    session,
    user,
    setCookie,
    notice: noticeText(url.searchParams.get("m")),
  };
  const match = matchRoute(req.method || "GET", pathname);
  if (!match) {
    sendHtml(ctx, 404, messagePage(ctx, { title: "Not found", statusText: "That page is not in the studio." }));
    return;
  }
  await match.handler(ctx, match.params);
}

function matchRoute(method, pathname) {
  const parts = pathname.split("/").filter(Boolean);
  for (const [routeMethod, routePath, handler] of routes) {
    if (routeMethod !== method) continue;
    const routeParts = routePath.split("/").filter(Boolean);
    if (routeParts.length !== parts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < routeParts.length; i += 1) {
      if (routeParts[i].startsWith(":")) params[routeParts[i].slice(1)] = parts[i];
      else if (routeParts[i] !== parts[i]) ok = false;
    }
    if (ok) return { handler, params };
  }
  return null;
}

function sendHtml(ctx, status, html) {
  const headers = securityHeaders({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  if (ctx.setCookie) headers["Set-Cookie"] = ctx.setCookie;
  ctx.res.writeHead(status, headers);
  ctx.res.end(html);
}

function redirect(ctx, location, { session, clear } = {}) {
  const headers = { Location: location, "Cache-Control": "no-store" };
  if (clear) headers["Set-Cookie"] = clearCookie();
  else if (session) headers["Set-Cookie"] = sessionCookie(session.id);
  else if (ctx.setCookie) headers["Set-Cookie"] = ctx.setCookie;
  ctx.res.writeHead(303, headers);
  ctx.res.end();
}

function requireUser(ctx) {
  if (ctx.user) return true;
  const next = safeNext(`${ctx.path}${ctx.url.search}`);
  redirect(ctx, `/login?next=${encodeURIComponent(next)}`);
  return false;
}

function requireCsrf(ctx) {
  if (ctx.session && tokensEqual(ctx.session.csrf, ctx.body.get("csrf"))) return true;
  sendHtml(ctx, 403, messagePage(ctx, { title: "Form expired", statusText: "Go back and try that again." }));
  return false;
}

function requireSimulation(ctx) {
  if (ctx.user?.simulation && SIMS[ctx.user.simulation]) return true;
  redirect(ctx, "/profile?m=need-simulation");
  return false;
}

function gate(ctx, status, title, statusText) {
  sendHtml(ctx, status, messagePage(ctx, { title, statusText }));
}

function idOf(params, key = "id") {
  if (!/^\d+$/.test(String(params[key] || ""))) return null;
  const value = Number(params[key]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function simOf(value) {
  return Object.hasOwn(SIMS, value) ? value : "";
}

function doorOf(value) {
  if (typeof value === "string") return simOf(value);
  if (value && typeof value === "object") return simOf(value.sim);
  return "";
}

function safeNext(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) {
    return "/desk";
  }
  return value;
}

function loginGet(ctx) {
  if (ctx.user) return redirect(ctx, "/desk");
  sendHtml(ctx, 200, authPage(ctx, { mode: "login", values: {}, next: safeNext(ctx.query.get("next")) }));
}

function loginPost(ctx, params) {
  const door = doorOf(params);
  if (!requireCsrf(ctx)) return;
  const email = cleanLine(ctx.body.get("email"), 120).toLowerCase();
  const password = String(ctx.body.get("password") || "");
  const user = findUserByEmail(email);
  const ok = verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !ok) {
    sendHtml(ctx, 401, authPage(ctx, {
      mode: "login",
      error: "That email and password do not match.",
      values: { email },
      next: safeNext(ctx.body.get("next")),
      door,
    }));
    return;
  }
  if (door) setSimulation(user.id, door);
  deleteSession(ctx.session.id);
  const session = createSession(user.id);
  const next = door ? "/desk" : safeNext(ctx.body.get("next"));
  redirect(ctx, next, { session });
}

function simLoginGet(ctx, params) {
  const simulation = simOf(params.sim);
  if (!simulation) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (ctx.user) {
    if (ctx.user.simulation === simulation) return redirect(ctx, "/desk");
    return sendHtml(ctx, 200, enterSimPage(ctx, simulation));
  }
  sendHtml(ctx, 200, authPage(ctx, { mode: "login", values: {}, next: "/desk", door: simulation }));
}

function simLoginPost(ctx, params) {
  const simulation = simOf(params.sim);
  if (!simulation) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (ctx.user) {
    if (!requireCsrf(ctx)) return;
    setSimulation(ctx.user.id, simulation);
    return redirect(ctx, "/desk?m=simulation");
  }
  return loginPost(ctx, simulation);
}

function simSignupGet(ctx, params) {
  const simulation = simOf(params.sim);
  if (!simulation) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (ctx.user) return redirect(ctx, "/desk");
  sendHtml(ctx, 200, authPage(ctx, { mode: "signup", values: { simulation }, door: simulation }));
}

function simSignupPost(ctx, params) {
  const simulation = simOf(params.sim);
  if (!simulation) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  return signupPost(ctx, simulation);
}

function signupGet(ctx) {
  if (ctx.user) return redirect(ctx, "/desk");
  sendHtml(ctx, 200, authPage(ctx, { mode: "signup", values: {} }));
}

function signupPost(ctx, params) {
  const door = doorOf(params);
  if (!requireCsrf(ctx)) return;
  const values = {
    name: cleanLine(ctx.body.get("name"), 80),
    email: cleanLine(ctx.body.get("email"), 120).toLowerCase(),
    simulation: door || simOf(ctx.body.get("simulation")),
    practice_title: cleanLine(ctx.body.get("practice_title"), 80),
    practice_role: cleanLine(ctx.body.get("practice_role"), 80),
  };
  const password = String(ctx.body.get("password") || "");
  const error = accountError(values, password);
  if (error) {
    sendHtml(ctx, 400, authPage(ctx, { mode: "signup", error, values, door }));
    return;
  }
  if (findUserByEmail(values.email)) {
    sendHtml(ctx, 400, authPage(ctx, { mode: "signup", error: "That email is already a member.", values, door }));
    return;
  }
  const user = createUser({
    name: values.name,
    email: values.email,
    passwordHash: hashPassword(password),
    simulation: values.simulation,
    practiceTitle: values.practice_title,
    practiceRole: values.practice_role,
  });
  deleteSession(ctx.session.id);
  redirect(ctx, "/desk", { session: createSession(user.id) });
}

function accountError(values, password) {
  if (!values.name) return "Enter your name.";
  if (!validEmail(values.email)) return "Enter a valid email.";
  if (password.length < 8) return "Use at least 8 characters for the password.";
  if (password.length > 200) return "That password is too long.";
  if (!values.simulation) return "Pick a simulation.";
  if (!values.practice_title) return "Enter a practice job title.";
  if (!values.practice_role) return "Enter a practice role.";
  return "";
}

function logout(ctx) {
  if (!requireCsrf(ctx)) return;
  if (ctx.session) deleteSession(ctx.session.id);
  redirect(ctx, "/", { clear: true });
}

function desk(ctx) {
  if (!requireUser(ctx)) return;
  const tasks = listTasksForUser(ctx.user.id);
  const { mine } = upcomingMeetings(ctx.user.id, ctx.user.simulation, wallStamp());
  sendHtml(ctx, 200, deskPage(ctx, { tasks, meetings: mine, ...practiceClock(ctx.user) }));
}

function profileGet(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, profilePage(ctx, { values: ctx.user, ...practiceClock(ctx.user) }));
}

function profilePhoto(ctx) {
  if (!requireUser(ctx)) return;
  if (ctx.body.get("__too_large") === "1") {
    sendHtml(ctx, 413, profilePage(ctx, {
      error: "That photo is too large. Use a PNG, JPEG, or WebP under 2 MB.",
      values: ctx.user,
      ...practiceClock(ctx.user),
    }));
    return;
  }
  if (!requireCsrf(ctx)) return;
  const avatar = join(ROOT, "data", "avatars", String(ctx.user.id));
  if (ctx.body.get("remove") === "1") {
    if (existsSync(avatar)) unlinkSync(avatar);
    setAvatarType(ctx.user.id, "");
    redirect(ctx, "/profile?m=photo-removed");
    return;
  }
  const upload = typeof ctx.body.file === "function" ? ctx.body.file("photo") : null;
  const type = imageType(upload?.bytes);
  if (!type) {
    sendHtml(ctx, 400, profilePage(ctx, {
      error: "Choose a PNG, JPEG, or WebP photo.",
      values: ctx.user,
      ...practiceClock(ctx.user),
    }));
    return;
  }
  mkdirSync(join(ROOT, "data", "avatars"), { recursive: true });
  writeFileSync(avatar, upload.bytes);
  setAvatarType(ctx.user.id, type);
  redirect(ctx, "/profile?m=photo-saved");
}

function avatarGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const id = idOf(params);
  const member = id ? findUser(id) : null;
  const type = member ? AVATAR_TYPES[member.avatar_type] : "";
  const file = id ? join(ROOT, "data", "avatars", String(id)) : "";
  if (!type || !file || !existsSync(file)) {
    const headers = securityHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    ctx.res.writeHead(404, headers);
    ctx.res.end("No profile photo.");
    return;
  }
  ctx.res.writeHead(200, securityHeaders({
    "Content-Type": type,
    "Cache-Control": "private, no-store",
    "Content-Length": statSync(file).size,
    "X-Content-Type-Options": "nosniff",
  }));
  createReadStream(file).pipe(ctx.res);
}

function punchInPost(ctx) {
  if (!requireUser(ctx) || !requireSimulation(ctx) || !requireCsrf(ctx)) return;
  punchIn(ctx.user.id, ctx.user.simulation);
  redirect(ctx, "/desk?m=punched-in");
}

function punchOutPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  punchOut(ctx.user.id);
  redirect(ctx, "/desk?m=punched-out");
}

function practiceClock(user) {
  return {
    punch: openPunch(user.id),
    practiceMs: practiceMillis(user.id, user.simulation),
  };
}

function profilePost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const values = {
    simulation: simOf(ctx.body.get("simulation")),
    practice_title: cleanLine(ctx.body.get("practice_title"), 80),
    practice_role: cleanLine(ctx.body.get("practice_role"), 80),
  };
  if (!values.simulation || !values.practice_title || !values.practice_role) {
    sendHtml(ctx, 400, profilePage(ctx, {
      error: "Pick a simulation, a practice job title, and a practice role.",
      values,
      ...practiceClock(ctx.user),
    }));
    return;
  }
  updatePractice(ctx.user.id, {
    simulation: values.simulation,
    practiceTitle: values.practice_title,
    practiceRole: values.practice_role,
  });
  redirect(ctx, "/profile?m=saved");
}

function members(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, membersPage(ctx, listUsers()));
}

function chatsGet(ctx) {
  if (!requireUser(ctx) || !requireSimulation(ctx)) return;
  sendHtml(ctx, 200, chatsPage(ctx, listChatPeers(ctx.user.id, ctx.user.simulation)));
}

function chatGet(ctx, params) {
  if (!requireUser(ctx) || !requireSimulation(ctx)) return;
  const peer = loadChatPeer(ctx, params);
  if (!peer) return;
  sendHtml(ctx, 200, chatPage(ctx, { peer, messages: listMessages(ctx.user.simulation, ctx.user.id, peer.id) }));
}

function chatPost(ctx, params) {
  if (!requireUser(ctx) || !requireSimulation(ctx) || !requireCsrf(ctx)) return;
  const peer = loadChatPeer(ctx, params);
  if (!peer) return;
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    sendHtml(ctx, 400, chatPage(ctx, {
      peer,
      messages: listMessages(ctx.user.simulation, ctx.user.id, peer.id),
      error: "Write a practice message.",
    }));
    return;
  }
  addMessage({
    simulation: ctx.user.simulation,
    senderId: ctx.user.id,
    recipientId: peer.id,
    body,
  });
  notifyUser(peer.id, { t: "chat", with: ctx.user.id, fromName: ctx.user.name });
  notifyUser(ctx.user.id, { t: "chat", with: peer.id, fromName: peer.name });
  redirect(ctx, `/chats/${peer.id}?m=chat-sent`);
}

function chatMessages(ctx, params) {
  if (!requireUser(ctx) || !requireSimulation(ctx)) return;
  const peer = loadChatPeer(ctx, params);
  if (!peer) return;
  if (ctx.query.get("fragment") === "1") {
    return sendFragment(ctx, chatThread(ctx, listMessages(ctx.user.simulation, ctx.user.id, peer.id)));
  }
  redirect(ctx, `/chats/${peer.id}`);
}

function loadChatPeer(ctx, params) {
  const peer = findUser(idOf(params));
  if (!peer || peer.id === ctx.user.id) {
    gate(ctx, 404, "Not found", "That member is not here.");
    return null;
  }
  if (peer.simulation !== ctx.user.simulation) {
    gate(ctx, 403, "Practice chat", "Practice chat and meetings stay with members in the same simulation.");
    return null;
  }
  return peer;
}

function memberGet(ctx, params) {
  if (!requireUser(ctx) || !requireSimulation(ctx)) return;
  const member = loadChatPeer(ctx, params);
  if (!member) return;
  sendHtml(ctx, 200, memberPage(ctx, {
    member,
    values: { starts_at: hoursFromNow(1), ends_at: hoursFromNow(2) },
  }));
}

function memberMeeting(ctx, params) {
  if (!requireUser(ctx) || !requireSimulation(ctx) || !requireCsrf(ctx)) return;
  const member = loadChatPeer(ctx, params);
  if (!member) return;
  const values = {
    title: cleanLine(ctx.body.get("title"), 120),
    agenda: cleanText(ctx.body.get("agenda"), 2000),
    starts_at: String(ctx.body.get("starts_at") || ""),
    ends_at: String(ctx.body.get("ends_at") || ""),
  };
  const zoom = cleanZoomLink(ctx.body.get("zoom_link"));
  const error = meetingError(values) || (zoom === null ? "Paste an https Zoom link, or leave it blank." : "");
  if (error) {
    return sendHtml(ctx, 400, memberPage(ctx, { member, error, values: { ...values, zoom_link: String(ctx.body.get("zoom_link") || "") } }));
  }
  const id = createMeeting({
    simulation: ctx.user.simulation,
    title: values.title,
    agenda: values.agenda,
    zoomLink: zoom,
    startsAt: values.starts_at,
    endsAt: values.ends_at,
    createdBy: ctx.user.id,
    inviteIds: [member.id],
  });
  redirect(ctx, `/meetings/${id}?m=meeting-set`);
}

function teamsGet(ctx) {
  if (!requireUser(ctx) || !requireSimulation(ctx)) return;
  sendHtml(ctx, 200, teamsPage(ctx, { teams: listTeamsFor(ctx.user.id) }));
}

function teamsPost(ctx) {
  if (!requireUser(ctx) || !requireSimulation(ctx) || !requireCsrf(ctx)) return;
  const name = cleanLine(ctx.body.get("name"), 80);
  if (!name) {
    sendHtml(ctx, 400, teamsPage(ctx, { teams: listTeamsFor(ctx.user.id), error: "Name the practice team." }));
    return;
  }
  const id = createTeam({ name, simulation: ctx.user.simulation, createdBy: ctx.user.id });
  redirect(ctx, `/teams/${id}?m=team-made`);
}

function loadTeam(ctx, params) {
  const id = idOf(params);
  const team = id ? getTeam(id) : null;
  if (!team) {
    gate(ctx, 404, "Not found", "That practice team is not here.");
    return null;
  }
  if (!isTeamMember(team.id, ctx.user.id)) {
    gate(ctx, 403, "Practice team", "You are not on this practice team.");
    return null;
  }
  return team;
}

function teamGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const team = loadTeam(ctx, params);
  if (!team) return;
  sendHtml(ctx, 200, teamView(ctx, team));
}

function teamView(ctx, team, error = "") {
  const members = teamMembers(team.id);
  const others = listBySimulation(team.simulation).filter((user) => !members.some((member) => member.id === user.id));
  return teamPage(ctx, { team, members, others, tasks: listTasksForTeam(team.id), error });
}

function teamAdd(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const team = loadTeam(ctx, params);
  if (!team) return;
  const userId = Number(ctx.body.get("user_id"));
  const person = findUser(userId);
  if (!person || person.simulation !== team.simulation) {
    sendHtml(ctx, 400, teamView(ctx, team, "Pick a member who is in this simulation."));
    return;
  }
  addTeamMember(team.id, person.id);
  redirect(ctx, `/teams/${team.id}?m=member-added`);
}

function teamLeave(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const team = loadTeam(ctx, params);
  if (!team) return;
  leaveTeam(team.id, ctx.user.id);
  redirect(ctx, "/teams?m=left-team");
}

function taskCreate(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const team = loadTeam(ctx, params);
  if (!team) return;
  const title = cleanLine(ctx.body.get("title"), 120);
  const detail = cleanText(ctx.body.get("detail"), 2000);
  const assigneeId = Number(ctx.body.get("assignee_id"));
  if (!title || !isTeamMember(team.id, assigneeId)) {
    sendHtml(ctx, 400, teamView(ctx, team, "Name the practice task and assign it to someone on the team."));
    return;
  }
  createTask({ teamId: team.id, title, detail, assigneeId, createdBy: ctx.user.id });
  redirect(ctx, `/teams/${team.id}?m=task-made`);
}

function taskStatus(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const task = getTask(idOf(params));
  if (!task) return gate(ctx, 404, "Not found", "That practice task is not here.");
  if (!isTeamMember(task.team_id, ctx.user.id)) {
    return gate(ctx, 403, "Practice task", "You are not on that practice team.");
  }
  const status = ctx.body.get("status") === "done" ? "done" : "open";
  setTaskStatus(task.id, status);
  redirect(ctx, `/teams/${task.team_id}?m=task-updated`);
}

function calendar(ctx) {
  if (!requireUser(ctx)) return;
  const now = new Date();
  let year = Number(ctx.query.get("y") || now.getFullYear());
  let month = Number(ctx.query.get("m") || now.getMonth() + 1);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) year = now.getFullYear();
  if (!Number.isInteger(month) || month < 1 || month > 12) month = now.getMonth() + 1;
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const meetings = listMeetingsForMonth(ctx.user.simulation, prefix);
  const others = listJoinedOtherMeetings(ctx.user.id, ctx.user.simulation, prefix);
  const members = ctx.user.simulation
    ? listBySimulation(ctx.user.simulation).filter((member) => member.id !== ctx.user.id)
    : [];
  sendHtml(ctx, 200, calendarPage(ctx, {
    year,
    month,
    cells: monthCells(year, month, meetings),
    meetings,
    others,
    members,
    values: { starts_at: hoursFromNow(1), ends_at: hoursFromNow(2) },
  }));
}

function meetingCreate(ctx) {
  if (!requireUser(ctx) || !requireSimulation(ctx) || !requireCsrf(ctx)) return;
  const values = {
    title: cleanLine(ctx.body.get("title"), 120),
    agenda: cleanText(ctx.body.get("agenda"), 2000),
    starts_at: String(ctx.body.get("starts_at") || ""),
    ends_at: String(ctx.body.get("ends_at") || ""),
  };
  const zoom = cleanZoomLink(ctx.body.get("zoom_link"));
  const error = meetingError(values) || (zoom === null ? "Paste an https Zoom link, or leave it blank." : "");
  if (error) return sendHtml(ctx, 400, calendarWith(ctx, error, { ...values, zoom_link: String(ctx.body.get("zoom_link") || "") }));
  const allowed = new Set(listBySimulation(ctx.user.simulation).map((member) => member.id));
  const inviteIds = ctx.body
    .getAll("with")
    .map(Number)
    .filter((id) => allowed.has(id) && id !== ctx.user.id);
  const id = createMeeting({
    simulation: ctx.user.simulation,
    title: values.title,
    agenda: values.agenda,
    zoomLink: zoom,
    startsAt: values.starts_at,
    endsAt: values.ends_at,
    createdBy: ctx.user.id,
    inviteIds,
  });
  redirect(ctx, `/meetings/${id}`);
}

function calendarWith(ctx, error, values) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const meetings = listMeetingsForMonth(ctx.user.simulation, prefix);
  return calendarPage(ctx, {
    year,
    month,
    cells: monthCells(year, month, meetings),
    meetings,
    others: [],
    members: listBySimulation(ctx.user.simulation).filter((member) => member.id !== ctx.user.id),
    error,
    values,
  });
}

function meetingError(values) {
  if (!values.title) return "Name the simulation meeting.";
  if (!validStamp(values.starts_at) || !validStamp(values.ends_at)) return "Enter a start and an end.";
  if (values.ends_at <= values.starts_at) return "The meeting has to end after it starts.";
  return "";
}

function meetingGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const loaded = loadMeeting(ctx, params);
  if (!loaded) return;
  const { meeting } = loaded;
  const members = meetingMembers(meeting.id);
  const membership = meetingMembership(meeting.id, ctx.user.id);
  sendHtml(ctx, 200, meetingPage(ctx, {
    meeting,
    members,
    notes: meetingNotes(meeting.id),
    joined: membership?.state === "joined",
  }));
}

function meetingJoin(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const loaded = loadMeeting(ctx, params);
  if (!loaded) return;
  joinMeeting(loaded.meeting.id, ctx.user.id);
  redirect(ctx, `/meetings/${loaded.meeting.id}?m=joined`);
}

function meetingNotePost(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const loaded = loadMeeting(ctx, params);
  if (!loaded) return;
  const membership = meetingMembership(loaded.meeting.id, ctx.user.id);
  if (membership?.state !== "joined") {
    return gate(ctx, 403, "Simulation meeting", "Join the simulation meeting before adding a practice note.");
  }
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    const members = meetingMembers(loaded.meeting.id);
    sendHtml(ctx, 400, meetingPage(ctx, {
      meeting: loaded.meeting,
      members,
      notes: meetingNotes(loaded.meeting.id),
      joined: true,
      error: "Write a practice note.",
    }));
    return;
  }
  addMeetingNote(loaded.meeting.id, ctx.user.id, body);
  redirect(ctx, `/meetings/${loaded.meeting.id}?m=note-saved`);
}

function meetingNoteGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const loaded = loadMeeting(ctx, params);
  if (!loaded) return;
  if (ctx.query.get("fragment") === "1") return sendFragment(ctx, notesHtml(meetingNotes(loaded.meeting.id)));
  redirect(ctx, `/meetings/${loaded.meeting.id}`);
}

function loadMeeting(ctx, params) {
  const meeting = getMeeting(idOf(params));
  if (!meeting) {
    gate(ctx, 404, "Not found", "That simulation meeting is not here.");
    return null;
  }
  const membership = meetingMembership(meeting.id, ctx.user.id);
  if (ctx.user.simulation !== meeting.simulation && !membership) {
    gate(ctx, 403, "Simulation meeting", `This practice meeting is for members in ${SIMS[meeting.simulation].name}.`);
    return null;
  }
  return { meeting };
}

function floor(ctx) {
  if (!requireUser(ctx)) return;
  if (ctx.user.simulation !== "copperline") {
    sendHtml(ctx, 200, messagePage(ctx, {
      title: "Copperline",
      statusText: "Pick Copperline on your practice profile to step onto the call floor.",
      body: '<p><a class="button" href="/profile">Practice profile</a></p>',
    }));
    return;
  }
  sendHtml(ctx, 200, floorPage(ctx, listBySimulation("copperline")));
}

function ideasGet(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, ideasPage(ctx, { ideas: listIdeas(), canWrite: ctx.user.simulation === "kindling" }));
}

function ideaCreate(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (ctx.user.simulation !== "kindling") return redirect(ctx, "/profile?m=need-simulation");
  const title = cleanLine(ctx.body.get("title"), 120);
  const pitch = cleanText(ctx.body.get("pitch"), 2000);
  if (!title || !pitch) {
    sendHtml(ctx, 400, ideasPage(ctx, {
      ideas: listIdeas(),
      canWrite: true,
      error: "Add a title and the idea.",
    }));
    return;
  }
  const id = createIdea({ authorId: ctx.user.id, title, pitch });
  redirect(ctx, `/kindling/ideas/${id}?m=idea-saved`);
}

function ideaGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const idea = getIdea(idOf(params));
  if (!idea) return gate(ctx, 404, "Not found", "That practice idea is not on the table.");
  sendHtml(ctx, 200, ideaPage(ctx, {
    idea,
    notes: ideaNotes(idea.id),
    canWrite: ctx.user.simulation === "kindling",
  }));
}

function ideaNotePost(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const idea = getIdea(idOf(params));
  if (!idea) return gate(ctx, 404, "Not found", "That practice idea is not on the table.");
  if (ctx.user.simulation !== "kindling") return redirect(ctx, "/profile?m=need-simulation");
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    sendHtml(ctx, 400, ideaPage(ctx, {
      idea,
      notes: ideaNotes(idea.id),
      canWrite: true,
      error: "Write a practice note.",
    }));
    return;
  }
  addIdeaNote(idea.id, ctx.user.id, body);
  redirect(ctx, `/kindling/ideas/${idea.id}?m=note-saved`);
}

function ideaNoteGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const idea = getIdea(idOf(params));
  if (!idea) return gate(ctx, 404, "Not found", "That practice idea is not on the table.");
  if (ctx.query.get("fragment") === "1") return sendFragment(ctx, notesHtml(ideaNotes(idea.id)));
  redirect(ctx, `/kindling/ideas/${idea.id}`);
}

async function quarryGet(ctx) {
  if (!requireUser(ctx)) return;
  const dataset = String(ctx.query.get("dataset") || "");
  const city = String(ctx.query.get("city") || "tokyo");
  let chartHtml = "";
  let error = "";
  if (dataset) {
    try {
      if (ctx.user.simulation !== "quarry") throw new Error("Pick Quarry on your practice profile to load public data.");
      chartHtml = barChart(await loadDataset(dataset, city));
    } catch (err) {
      error = err.message || "Public data did not load.";
    }
  }
  sendHtml(ctx, 200, quarryPage(ctx, {
    reports: listVisibleReports(ctx.user.id),
    dataset,
    city,
    chartHtml,
    error,
    canWrite: ctx.user.simulation === "quarry",
  }));
}

async function reportCreate(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (ctx.user.simulation !== "quarry") return redirect(ctx, "/profile?m=need-simulation");
  const dataset = String(ctx.body.get("dataset") || "");
  const city = String(ctx.body.get("city") || "");
  const title = cleanLine(ctx.body.get("title"), 120);
  const body = cleanText(ctx.body.get("body"), 5000);
  let chart;
  let error = "";
  if (!isDataset(dataset)) error = "Pick a public dataset.";
  else if (!title) error = "Title the practice report.";
  else if (body.length < 40) error = "Write a short report, at least a few sentences.";
  else if (dataset === "weather" && !cityById(city)) error = "Pick a city from the list.";
  if (!error) {
    try {
      chart = await loadDataset(dataset, city);
    } catch (err) {
      error = err.message || "Public data did not load.";
    }
  }
  if (error) {
    sendHtml(ctx, 400, quarryPage(ctx, {
      reports: listVisibleReports(ctx.user.id),
      dataset,
      city,
      chartHtml: chart ? barChart(chart) : "",
      error,
      canWrite: true,
    }));
    return;
  }
  const id = createReport({
    authorId: ctx.user.id,
    dataset,
    sourceLabel: chart.source,
    title,
    body,
    dataJson: JSON.stringify(chart),
  });
  redirect(ctx, `/reports/${id}?m=report-saved`);
}

function reportGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const report = getReport(idOf(params));
  if (!report) return gate(ctx, 404, "Not found", "That practice report is not here.");
  if (!report.shared && report.author_id !== ctx.user.id) {
    return gate(ctx, 403, "Practice report", "This practice report is not shared.");
  }
  let chartHtml = '<p class="empty">The saved chart could not be read.</p>';
  try {
    chartHtml = barChart(JSON.parse(report.data_json));
  } catch {
    // Keep the empty chart message.
  }
  sendHtml(ctx, 200, reportPage(ctx, { report, chartHtml }));
}

function reportShare(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const report = getReport(idOf(params));
  if (!report) return gate(ctx, 404, "Not found", "That practice report is not here.");
  if (report.author_id !== ctx.user.id) return gate(ctx, 403, "Practice report", "Only the member who wrote it can share it.");
  const shared = !report.shared;
  setReportShared(report.id, ctx.user.id, shared);
  redirect(ctx, `/reports/${report.id}?m=${shared ? "report-shared" : "report-unshared"}`);
}

function interviewsGet(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, interviewsPage(ctx, { interviews: listInterviews() }));
}

function interviewCreate(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const simulation = simOf(ctx.body.get("simulation"));
  const practiceRole = cleanLine(ctx.body.get("practice_role"), 80);
  const note = cleanText(ctx.body.get("note"), 2000);
  if (!simulation || !practiceRole) {
    sendHtml(ctx, 400, interviewsPage(ctx, {
      interviews: listInterviews(),
      error: "Pick a simulation and name the practice role.",
    }));
    return;
  }
  const id = createInterview({ requesterId: ctx.user.id, simulation, practiceRole, note });
  redirect(ctx, `/interviews/${id}?m=interview-requested`);
}

function interviewGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const interview = getInterview(idOf(params));
  if (!interview) return gate(ctx, 404, "Not found", "That simulation interview is not here.");
  sendHtml(ctx, 200, interviewPage(ctx, { interview, notes: interviewNotes(interview.id) }));
}

function interviewClaim(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const id = idOf(params);
  if (!claimInterview(id, ctx.user.id)) {
    return gate(ctx, 400, "Simulation interview", "That practice interview is no longer open, or you requested it yourself.");
  }
  redirect(ctx, `/interviews/${id}?m=interview-running`);
}

function interviewNotePost(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const interview = getInterview(idOf(params));
  if (!interview) return gate(ctx, 404, "Not found", "That simulation interview is not here.");
  const allowed =
    (interview.requester_id === ctx.user.id && interview.status !== "complete") ||
    (interview.interviewer_id === ctx.user.id && interview.status === "running");
  if (!allowed) return gate(ctx, 403, "Simulation interview", "Practice notes are for the two members in this interview.");
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    sendHtml(ctx, 400, interviewPage(ctx, {
      interview,
      notes: interviewNotes(interview.id),
      error: "Write a practice note.",
    }));
    return;
  }
  addInterviewNote(interview.id, ctx.user.id, body);
  redirect(ctx, `/interviews/${interview.id}?m=note-saved`);
}

function interviewNoteGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const interview = getInterview(idOf(params));
  if (!interview) return gate(ctx, 404, "Not found", "That simulation interview is not here.");
  if (ctx.query.get("fragment") === "1") return sendFragment(ctx, notesHtml(interviewNotes(interview.id)));
  redirect(ctx, `/interviews/${interview.id}`);
}

function interviewComplete(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const interview = getInterview(idOf(params));
  if (!interview) return gate(ctx, 404, "Not found", "That simulation interview is not here.");
  const feedback = cleanText(ctx.body.get("feedback"), 2000);
  if (feedback.length < 20) {
    sendHtml(ctx, 400, interviewPage(ctx, {
      interview,
      notes: interviewNotes(interview.id),
      error: "Write a little practice feedback before you close it.",
    }));
    return;
  }
  if (!completeInterview(interview.id, ctx.user.id, feedback)) {
    return gate(ctx, 403, "Simulation interview", "The member running the interview closes it.");
  }
  redirect(ctx, `/interviews/${interview.id}?m=interview-complete`);
}

function supportGet(ctx) {
  sendHtml(ctx, 200, supportPage(ctx, { notes: listSupport() }));
}

function supportPost(ctx) {
  if (!requireCsrf(ctx)) return;
  if (cleanLine(ctx.body.get("company"), 80)) {
    redirect(ctx, "/support?m=support");
    return;
  }
  const amount = parseAmount(ctx.body);
  const note = cleanLine(ctx.body.get("note"), 280);
  const displayName = ctx.user ? "" : cleanLine(ctx.body.get("display_name"), 80);
  if (amount.error || (!amount.cents && !note)) {
    sendHtml(ctx, 400, supportPage(ctx, {
      notes: listSupport(),
      error: amount.error || "Leave a note or an amount. Nothing is charged.",
    }));
    return;
  }
  addSupport({
    userId: ctx.user?.id,
    displayName: ctx.user ? ctx.user.name : displayName,
    amountCents: amount.cents,
    note,
  });
  redirect(ctx, "/support?m=support");
}

function parseAmount(body) {
  const raw = cleanLine(body.get("custom_amount"), 20) || cleanLine(body.get("amount"), 20);
  if (!raw) return { cents: null };
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(raw)) return { error: "Enter a dollar amount like 15 or 15.00." };
  const cents = Math.round(Number(raw) * 100);
  if (cents < 100 || cents > 1_000_000) return { error: "Amounts here are between $1 and $10,000." };
  return { cents };
}

function sendFragment(ctx, html) {
  const headers = securityHeaders({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  ctx.res.writeHead(200, headers);
  ctx.res.end(html);
}

function monthCells(year, month, meetings) {
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: lead }, () => null);
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  for (let day = 1; day <= count; day += 1) {
    const key = `${prefix}-${String(day).padStart(2, "0")}`;
    cells.push({ day, meetings: meetings.filter((meeting) => meeting.starts_at.startsWith(key)) });
  }
  return cells;
}

function hoursFromNow(hours) {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hours);
  return wallStamp(date);
}

function securityHeaders(extra) {
  return {
    ...extra,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": CSP,
  };
}

function serveStatic(req, res, pathname) {
  const file = staticPath(pathname);
  if (!file) return false;
  const type = TYPES[extname(file)];
  if (!type) return false;
  res.writeHead(200, securityHeaders({
    "Content-Type": type,
    "Cache-Control": extname(file) === ".woff2" ? "public, max-age=604800" : "public, max-age=300",
  }));
  createReadStream(file).pipe(res);
  return true;
}

function staticPath(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("..")) return null;
  const file = normalize(join(PUBLIC_DIR, decoded.replace(/^\/+/, "")));
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + sep)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

const AVATAR_TYPES = {
  "image/jpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
};

async function readBody(req) {
  if (req.method !== "POST") return new URLSearchParams();
  const type = String(req.headers["content-type"] || "");
  if (type.toLowerCase().includes("multipart/form-data")) return readMultipart(req, type);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      const error = new Error("Body too large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

async function readMultipart(req, type) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(type);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2_500_000) {
      req.destroy();
      const params = new URLSearchParams();
      params.set("__too_large", "1");
      return formData(params, null);
    }
    chunks.push(chunk);
  }
  if (!match) return formData(new URLSearchParams(), null);
  return parseMultipart(Buffer.concat(chunks), match[1] || match[2]);
}

function formData(params, file) {
  return {
    get(name) {
      return params.get(name);
    },
    getAll(name) {
      return params.getAll(name);
    },
    file(name) {
      return file && file.field === name ? file : null;
    },
  };
}

function parseMultipart(buffer, boundary) {
  const params = new URLSearchParams();
  let file = null;
  const delimiter = Buffer.from(`\r\n--${boundary}`);
  const preamble = Buffer.from(`--${boundary}`);
  let cursor = buffer.subarray(0, preamble.length).equals(preamble) ? preamble.length : buffer.indexOf(delimiter);
  if (cursor < 0) return formData(params, null);
  if (!buffer.subarray(0, preamble.length).equals(preamble)) cursor += delimiter.length;
  while (cursor < buffer.length) {
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;
    const headerEnd = buffer.indexOf("\r\n\r\n", cursor, "utf8");
    if (headerEnd < 0) break;
    const headerText = buffer.subarray(cursor, headerEnd).toString("utf8");
    const bodyStart = headerEnd + 4;
    const next = buffer.indexOf(delimiter, bodyStart);
    const bodyEnd = next < 0 ? buffer.length : next;
    const bytes = buffer.subarray(bodyStart, bodyEnd);
    const disposition = /content-disposition:[^\r\n]*/i.exec(headerText)?.[0] || "";
    const name = /name="([^"]*)"/.exec(disposition)?.[1] || "";
    const filename = /filename="([^"]*)"/.exec(disposition);
    if (name && filename) {
      if (!file && filename[1]) file = { field: name, filename: filename[1], bytes: Buffer.from(bytes) };
    } else if (name) {
      params.append(name, bytes.toString("utf8"));
    }
    if (next < 0) break;
    cursor = next + delimiter.length;
  }
  return formData(params, file);
}

function imageType(bytes) {
  if (!bytes || bytes.length < 12 || bytes.length > 2_000_000) return "";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return "";
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  start().then((server) => {
    const address = server.address();
    console.log(`Daymark listening on http://${address.address}:${address.port}`);
  });
}
