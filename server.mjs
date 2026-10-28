import { createReadStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { clearCookie, hashPassword, parseCookies, sessionCookie, tokensEqual, verifyPassword } from "./lib/auth.mjs";
import { belongsTo, canEnter, isCeo, isNotchdayMember, sharesCompany, teamLabel } from "./lib/access.mjs";
import { JOIN_RULES, publicName, SEED, SIMS, TIP_URL } from "./lib/copy.mjs";
import {
  activityScore,
  addBugReport,
  addCheckin,
  addComplaint,
  addIdeaNote,
  saveApplication,
  saveContestEntry,
  addInterviewNote,
  addMeetingNote,
  addMessage,
  addOpeningInterviewNote,
  addRoomMessage,
  addSharedFile,
  addTeamMember,
  claimInterview,
  clearGroupRequest,
  announceRivalryWinner,
  clearRivalry,
  castVote,
  completeInterview,
  createContest,
  createGroup,
  createGroupTask,
  createIdea,
  createInterview,
  createMission,
  createMeeting,
  createOpening,
  createOpeningInterview,
  createReport,
  createSession,
  createTask,
  createTeam,
  createUser,
  deleteSession,
  findUser,
  findUserByEmail,
  getApplication,
  getContest,
  getGroup,
  getOpening,
  getOpeningInterview,
  getGroupTask,
  groupMembers,
  getIdea,
  getInterview,
  getMission,
  getMeeting,
  getReport,
  getSharedFile,
  getTask,
  getTeam,
  ideaNotes,
  interviewNotes,
  isGroupMember,
  isTeamMember,
  hasGroupRequest,
  joinGroup,
  joinMeeting,
  latestCheckins,
  leaveGroup,
  leaveTeam,
  listApplications,
  listBugReports,
  listContestEntries,
  listContests,
  listContestsFor,
  listChatPeers,
  listCompany,
  listComplaints,
  listFiles,
  listGroupRequests,
  listGroupTasks,
  listMissions,
  listOpeningsForGroup,
  listVisibleGroups,
  listVisibleOpenings,
  listIdeas,
  listInterviews,
  listJoinedOtherMeetings,
  listMeetingsForMonth,
  listMessages,
  listRivalries,
  listRoomMessages,
  listTasksForTeam,
  listTasksForUser,
  listTeamsFor,
  listStudioMembers,
  listUsers,
  listVisibleReports,
  meetingMembers,
  meetingMembership,
  meetingNotes,
  openingInterviewNotes,
  openDb,
  openPunch,
  practiceMillis,
  punchIn,
  punchOut,
  requestGroupJoin,
  readSession,
  setAvatarType,
  setMembership,
  setReportShared,
  setRivalry,
  setRivalryAssignment,
  setGroupTaskStatus,
  setSimulation,
  setTaskStatus,
  teamMembers,
  upcomingMeetings,
  updatePractice,
} from "./lib/db.mjs";
import { cleanLine, cleanText, cleanZoomLink, validEmail, validStamp, wallStamp } from "./lib/format.mjs";
import { commentsHtml, notesHtml, noticeText } from "./lib/html.mjs";
import { sendOwnerNotice, veilHtml } from "./lib/mail.mjs";
import {
  authPage,
  calendarPage,
  chatPage,
  contestPage,
  contestsPage,
  chatsPage,
  chatThread,
  deskPage,
  enterSimPage,
  floorPage,
  groupPage,
  groupsPage,
  openingInterviewPage,
  openingPage,
  openingsPage,
  bugPage,
  homePage,
  ideaPage,
  ideasPage,
  interviewPage,
  interviewsPage,
  meetingPage,
  memberPage,
  membersPage,
  membershipPage,
  messagePage,
  profilePage,
  quarryPage,
  reportPage,
  roomPage,
  roomThreadFragment,
  scoreboardPage,
  simPage,
  supportPage,
  teamPage,
  teamsPage,
} from "./lib/pages.mjs";
import { barChart, cityById, isDataset, loadDataset } from "./lib/quarry.mjs";
import { attachSignal, notifyUser } from "./lib/signal.mjs";

const ROOT = import.meta.dirname;
const PUBLIC_DIR = join(ROOT, "public");

function dataDir() {
  return process.env.DAYMARK_DATA || join(ROOT, "data");
}
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
  ["GET", "/yapmark", (ctx) => sendHtml(ctx, 200, simPage(ctx, "yapmark"))],
  ["GET", "/flinttable", (ctx) => sendHtml(ctx, 200, simPage(ctx, "flinttable"))],
  ["GET", "/chartslate", (ctx) => sendHtml(ctx, 200, simPage(ctx, "chartslate"))],
  ["GET", "/membership", membershipGet],
  ["POST", "/membership", membershipPost],
  ["POST", "/membership/invite", membershipInvite],
  ["GET", "/scoreboard", scoreboardGet],
  ["POST", "/rivalries", rivalryPost],
  ["POST", "/rivalries/clear", rivalryClear],
  ["POST", "/rivalries/assignment", rivalryAssignment],
  ["POST", "/rivalries/winner", rivalryWinner],
  ["POST", "/hr", hrPost],
  ["GET", "/support", supportGet],
  ["POST", "/support", supportPost],
  ["GET", "/bugs", bugGet],
  ["POST", "/bugs", bugPost],
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
  ["GET", "/openings", openingsGet],
  ["POST", "/openings", openingsPost],
  ["GET", "/openings/:id", openingGet],
  ["POST", "/openings/:id/apply", openingApply],
  ["POST", "/openings/:id/interview", openingInterviewPost],
  ["GET", "/opening-interviews/:id", openingInterviewGet],
  ["POST", "/opening-interviews/:id/notes", openingInterviewNote],
  ["POST", "/opening-interviews/:id/group", openingInterviewGroup],
  ["POST", "/opening-interviews/:id/team", openingInterviewTeam],
  ["GET", "/groups", groupsGet],
  ["POST", "/groups", groupsPost],
  ["GET", "/groups/:id", groupGet],
  ["POST", "/groups/:id/join", groupJoin],
  ["POST", "/groups/:id/leave", groupLeave],
  ["POST", "/groups/:id/requests/accept", groupRequestAccept],
  ["POST", "/groups/:id/requests/decline", groupRequestDecline],
  ["POST", "/groups/:id/requests/withdraw", groupRequestWithdraw],
  ["POST", "/groups/:id/missions", missionPost],
  ["POST", "/groups/:id/tasks", groupTaskPost],
  ["POST", "/group-tasks/:id", groupTaskStatus],
  ["GET", "/contests", contestsGet],
  ["POST", "/contests", contestsPost],
  ["GET", "/contests/:id", contestGet],
  ["POST", "/contests/:id/entries", contestEntry],
  ["GET", "/calendar", calendar],
  ["POST", "/meetings", meetingCreate],
  ["GET", "/meetings/:id", meetingGet],
  ["POST", "/meetings/:id/join", meetingJoin],
  ["POST", "/meetings/:id/notes", meetingNotePost],
  ["GET", "/meetings/:id/notes", meetingNoteGet],
  ["GET", "/yapmark/floor", floor],
  ["POST", "/yapmark/checkin", checkinPost],
  ["GET", "/flinttable/table", ideasGet],
  ["POST", "/flinttable/ideas", ideaCreate],
  ["GET", "/flinttable/ideas/:id", ideaGet],
  ["POST", "/flinttable/ideas/:id/vote", ideaVote],
  ["POST", "/flinttable/ideas/:id/comments", ideaCommentPost],
  ["GET", "/flinttable/ideas/:id/comments", ideaCommentGet],
  ["POST", "/flinttable/ideas/:id/notes", ideaCommentPost],
  ["GET", "/flinttable/ideas/:id/notes", ideaCommentGet],
  ["GET", "/chartslate/room", quarryGet],
  ["POST", "/chartslate/reports", reportCreate],
  ["GET", "/:sim/room/messages", roomMessages],
  ["GET", "/:sim/room", roomGet],
  ["POST", "/:sim/room", roomPost],
  ["POST", "/:sim/files", filePost],
  ["GET", "/files/:id", fileGet],
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
  openDb(dbFile || join(dataDir(), "daymark.sqlite"));
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
  ctx.res.end(veilHtml(html));
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
  if (door && !user.simulation) setSimulation(user.id, door);
  deleteSession(ctx.session.id);
  const session = createSession(user.id);
  const next = door ? "/desk" : safeNext(ctx.body.get("next"));
  redirect(ctx, next, { session });
}

function simLoginGet(ctx, params) {
  const simulation = simOf(params.sim);
  if (!simulation) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (ctx.user) {
    if (canEnter(ctx.user, simulation)) return redirect(ctx, "/desk");
    return sendHtml(ctx, 200, enterSimPage(ctx, simulation));
  }
  sendHtml(ctx, 200, authPage(ctx, { mode: "login", values: {}, next: "/desk", door: simulation }));
}

function simLoginPost(ctx, params) {
  const simulation = simOf(params.sim);
  if (!simulation) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (ctx.user) {
    if (!requireCsrf(ctx)) return;
    if (canEnter(ctx.user, simulation)) return redirect(ctx, "/desk");
    return redirect(ctx, "/membership?m=locked");
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
  if (!values.simulation) return "Pledge to one public team: Yapmark Corp., Flinttable Inc., or Chartslate Ltd. Notchday is invite-only or for subscribers.";
  if (!values.practice_title) return "Enter a job title.";
  if (!values.practice_role) return "Enter a job role.";
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
  const hanna = findUserByEmail(SEED.email);
  sendHtml(ctx, 200, deskPage(ctx, {
    tasks,
    meetings: mine,
    hannaId: hanna?.id,
    peers: listChatPeers(ctx.user.id),
    ...practiceClock(ctx.user),
  }));
}

function profileGet(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, profilePage(ctx, { values: ctx.user, ...profileExtras(ctx) }));
}

function profilePhoto(ctx) {
  if (!requireUser(ctx)) return;
  if (ctx.body.get("__too_large") === "1") {
    sendHtml(ctx, 413, profilePage(ctx, {
      error: "That photo is too large. Use a PNG, JPEG, or WebP under 2 MB.",
      values: ctx.user,
      ...profileExtras(ctx),
    }));
    return;
  }
  if (!requireCsrf(ctx)) return;
  const avatar = join(dataDir(), "avatars", String(ctx.user.id));
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
      ...profileExtras(ctx),
    }));
    return;
  }
  mkdirSync(join(dataDir(), "avatars"), { recursive: true });
  writeFileSync(avatar, upload.bytes);
  setAvatarType(ctx.user.id, type);
  redirect(ctx, "/profile?m=photo-saved");
}

function avatarGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const id = idOf(params);
  const member = id ? findUser(id) : null;
  const type = member ? AVATAR_TYPES[member.avatar_type] : "";
  const file = id ? join(dataDir(), "avatars", String(id)) : "";
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

function profileExtras(ctx) {
  return {
    complaints: isCeo(ctx.user) ? listComplaints() : null,
    bugReports: isCeo(ctx.user) ? listBugReports() : null,
    ...practiceClock(ctx.user),
  };
}

function profilePost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const values = {
    simulation: ctx.user.simulation,
    practice_title: cleanLine(ctx.body.get("practice_title"), 80),
    practice_role: cleanLine(ctx.body.get("practice_role"), 80),
  };
  if (!values.practice_title || !values.practice_role) {
    sendHtml(ctx, 400, profilePage(ctx, {
      error: "Enter a job title and a job role. The team pledge stays put.",
      values,
      ...profileExtras(ctx),
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

function requireCompany(ctx) {
  if ((ctx.user.simulation && SIMS[ctx.user.simulation]) || isCeo(ctx.user) || ctx.user.membership === "all") return true;
  redirect(ctx, "/profile?m=need-simulation");
  return false;
}

function chatsGet(ctx) {
  if (!requireUser(ctx) || !requireCompany(ctx)) return;
  sendHtml(ctx, 200, chatsPage(ctx, listChatPeers(ctx.user.id)));
}

function chatGet(ctx, params) {
  if (!requireUser(ctx) || !requireCompany(ctx)) return;
  const peer = loadChatPeer(ctx, params);
  if (!peer) return;
  sendHtml(ctx, 200, chatPage(ctx, { peer, messages: listMessages(ctx.user.id, peer.id) }));
}

function chatPost(ctx, params) {
  if (!requireUser(ctx) || !requireCompany(ctx) || !requireCsrf(ctx)) return;
  const peer = loadChatPeer(ctx, params);
  if (!peer) return;
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    sendHtml(ctx, 400, chatPage(ctx, {
      peer,
      messages: listMessages(ctx.user.id, peer.id),
      error: "Write a simulation message.",
    }));
    return;
  }
  addMessage({
    simulation: ctx.user.simulation || peer.simulation || "yapmark",
    senderId: ctx.user.id,
    recipientId: peer.id,
    body,
  });
  notifyUser(peer.id, { t: "chat", with: ctx.user.id, fromName: publicName(ctx.user), fromTeam: teamLabel(ctx.user) });
  notifyUser(ctx.user.id, { t: "chat", with: peer.id, fromName: publicName(peer), fromTeam: teamLabel(peer) });
  redirect(ctx, `/chats/${peer.id}?m=chat-sent`);
}

function chatMessages(ctx, params) {
  if (!requireUser(ctx) || !requireCompany(ctx)) return;
  const peer = loadChatPeer(ctx, params);
  if (!peer) return;
  if (ctx.query.get("fragment") === "1") {
    return sendFragment(ctx, chatThread(ctx, listMessages(ctx.user.id, peer.id)));
  }
  redirect(ctx, `/chats/${peer.id}`);
}

function loadChatPeer(ctx, params) {
  const peer = findUser(idOf(params));
  if (!peer || peer.id === ctx.user.id) {
    gate(ctx, 404, "Not found", "That member is not here.");
    return null;
  }
  if (!sharesCompany(ctx.user, peer)) {
    gate(ctx, 403, "Simulation chat", "Simulation chat and meetings stay with members who share a company.");
    return null;
  }
  return peer;
}

function memberGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const member = findUser(idOf(params));
  if (!member || member.id === ctx.user.id) {
    return gate(ctx, 404, "Not found", "That member is not here.");
  }
  const hanna = member.email === SEED.email;
  if (!hanna && !sharesCompany(ctx.user, member)) {
    return gate(ctx, 403, "Simulation chat", "Say hello stays with members who share a company.");
  }
  sendHtml(ctx, 200, memberPage(ctx, {
    member,
    people: listUsers(),
    complaints: hanna && isCeo(ctx.user) ? listComplaints() : null,
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
    sendHtml(ctx, 400, teamsPage(ctx, { teams: listTeamsFor(ctx.user.id), error: "Name the simulation team." }));
    return;
  }
  const id = createTeam({ name, simulation: ctx.user.simulation, createdBy: ctx.user.id });
  redirect(ctx, `/teams/${id}?m=team-made`);
}

function loadTeam(ctx, params) {
  const id = idOf(params);
  const team = id ? getTeam(id) : null;
  if (!team) {
    gate(ctx, 404, "Not found", "That simulation team is not here.");
    return null;
  }
  if (!isTeamMember(team.id, ctx.user.id)) {
    gate(ctx, 403, "Simulation team", "You are not on this simulation team.");
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
  const others = listStudioMembers().filter((user) => !members.some((member) => member.id === user.id) && user.id !== ctx.user.id);
  return teamPage(ctx, { team, members, others, tasks: listTasksForTeam(team.id), error });
}

function teamAdd(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const team = loadTeam(ctx, params);
  if (!team) return;
  const userId = Number(ctx.body.get("user_id"));
  const person = findUser(userId);
  if (!person || !belongsTo(person, team.simulation)) {
    sendHtml(ctx, 400, teamView(ctx, team, "Pick a member who is in this company simulation."));
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
    sendHtml(ctx, 400, teamView(ctx, team, "Name the simulation task and assign it to someone on the team."));
    return;
  }
  createTask({ teamId: team.id, title, detail, assigneeId, createdBy: ctx.user.id });
  redirect(ctx, `/teams/${team.id}?m=task-made`);
}

function taskStatus(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const task = getTask(idOf(params));
  if (!task) return gate(ctx, 404, "Not found", "That simulation task is not here.");
  if (!isTeamMember(task.team_id, ctx.user.id)) {
    return gate(ctx, 403, "Simulation task", "You are not on that simulation team.");
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
  const members = listStudioMembers().filter((member) => member.id !== ctx.user.id);
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
  const allowed = new Set(listStudioMembers().map((member) => member.id));
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
    members: listStudioMembers().filter((member) => member.id !== ctx.user.id),
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
    return gate(ctx, 403, "Simulation meeting", "Join the simulation meeting before adding a simulation note.");
  }
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    const members = meetingMembers(loaded.meeting.id);
    sendHtml(ctx, 400, meetingPage(ctx, {
      meeting: loaded.meeting,
      members,
      notes: meetingNotes(loaded.meeting.id),
      joined: true,
      error: "Write a simulation note.",
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
  if (ctx.user.simulation !== meeting.simulation && !membership && !canEnter(ctx.user, meeting.simulation)) {
    gate(ctx, 403, "Simulation meeting", `This simulation meeting is for members in ${SIMS[meeting.simulation].name}.`);
    return null;
  }
  return { meeting };
}

function floor(ctx) {
  if (!requireUser(ctx)) return;
  if (!canEnter(ctx.user, "yapmark")) {
    sendHtml(ctx, 200, enterSimPage(ctx, "yapmark"));
    return;
  }
  sendHtml(ctx, 200, floorPage(ctx, listCompany("yapmark"), latestCheckins("yapmark")));
}

function ideasGet(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, ideasPage(ctx, { ideas: listIdeas(ctx.user.id), canWrite: canEnter(ctx.user, "flinttable") }));
}

function ideaCreate(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!canEnter(ctx.user, "flinttable")) return redirect(ctx, "/membership?m=locked");
  const title = cleanLine(ctx.body.get("title"), 120);
  const pitch = cleanText(ctx.body.get("pitch"), 2000);
  if (!title || !pitch) {
    sendHtml(ctx, 400, ideasPage(ctx, {
      ideas: listIdeas(ctx.user.id),
      canWrite: true,
      error: "Add a title and the idea.",
    }));
    return;
  }
  const id = createIdea({ authorId: ctx.user.id, title, pitch });
  redirect(ctx, `/flinttable/ideas/${id}?m=idea-saved`);
}

function ideaGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const idea = getIdea(idOf(params), ctx.user.id);
  if (!idea) return gate(ctx, 404, "Not found", "That pitch is not on the table.");
  const writer = canEnter(ctx.user, "flinttable");
  sendHtml(ctx, 200, ideaPage(ctx, {
    idea,
    notes: ideaNotes(idea.id),
    canWrite: writer,
  }));
}

function ideaCommentPost(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const idea = getIdea(idOf(params), ctx.user.id);
  if (!idea) return gate(ctx, 404, "Not found", "That pitch is not on the table.");
  if (!canEnter(ctx.user, "flinttable")) return redirect(ctx, "/membership?m=locked");
  const body = cleanText(ctx.body.get("body"), 2000);
  const back = String(ctx.body.get("back") || "");
  if (!body) {
    if (back === "gallery") {
      sendHtml(ctx, 400, ideasPage(ctx, {
        ideas: listIdeas(ctx.user.id),
        canWrite: true,
        error: "Write a comment.",
      }));
      return;
    }
    if (back === "room") {
      sendHtml(ctx, 400, roomPage(ctx, roomBundle(ctx, "flinttable", { error: "Write a comment." })));
      return;
    }
    sendHtml(ctx, 400, ideaPage(ctx, {
      idea,
      notes: ideaNotes(idea.id),
      canWrite: true,
      error: "Write a comment.",
    }));
    return;
  }
  addIdeaNote(idea.id, ctx.user.id, body);
  if (back === "gallery") return redirect(ctx, `/flinttable/table?m=comment-saved#pitch-${idea.id}`);
  if (back === "room") return redirect(ctx, `/flinttable/room?m=comment-saved#pitch-${idea.id}`);
  redirect(ctx, `/flinttable/ideas/${idea.id}?m=comment-saved`);
}

function ideaCommentGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const idea = getIdea(idOf(params));
  if (!idea) return gate(ctx, 404, "Not found", "That pitch is not on the table.");
  if (ctx.query.get("fragment") === "1") return sendFragment(ctx, commentsHtml(ideaNotes(idea.id)));
  redirect(ctx, `/flinttable/ideas/${idea.id}`);
}

function ideaVote(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!canEnter(ctx.user, "flinttable")) return redirect(ctx, "/membership?m=locked");
  const idea = getIdea(idOf(params), ctx.user.id);
  if (!idea) return gate(ctx, 404, "Not found", "That pitch is not on the table.");
  const raw = String(ctx.body.get("direction") || "1");
  const direction = raw === "-1" || raw === "down" ? -1 : 1;
  castVote(idea.id, ctx.user.id, direction);
  const back = String(ctx.body.get("back") || "");
  if (back === "gallery") return redirect(ctx, `/flinttable/table?m=vote-saved#pitch-${idea.id}`);
  if (back === "room") return redirect(ctx, `/flinttable/room?m=vote-saved#pitch-${idea.id}`);
  redirect(ctx, `/flinttable/ideas/${idea.id}?m=vote-saved`);
}

async function quarryGet(ctx) {
  if (!requireUser(ctx)) return;
  if (!canEnter(ctx.user, "chartslate")) return sendHtml(ctx, 200, enterSimPage(ctx, "chartslate"));
  const dataset = String(ctx.query.get("dataset") || "");
  const city = String(ctx.query.get("city") || "tokyo");
  let chartHtml = "";
  let error = "";
  if (dataset) {
    try {
      chartHtml = barChart(await loadDataset(dataset, city));
    } catch (err) {
      error = err.message || "Public data did not load.";
    }
  }
  sendHtml(ctx, 200, quarryPage(ctx, chartRoom(ctx, { dataset, city, chartHtml, error })));
}

async function reportCreate(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!canEnter(ctx.user, "chartslate")) return redirect(ctx, "/membership?m=locked");
  const dataset = String(ctx.body.get("dataset") || "");
  const city = String(ctx.body.get("city") || "");
  const title = cleanLine(ctx.body.get("title"), 120);
  const body = cleanText(ctx.body.get("body"), 5000);
  let chart;
  let error = "";
  if (!isDataset(dataset)) error = "Pick a public dataset.";
  else if (!title) error = "Title the simulation report.";
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
    sendHtml(ctx, 400, quarryPage(ctx, chartRoom(ctx, {
      dataset,
      city,
      chartHtml: chart ? barChart(chart) : "",
      error,
    })));
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
  if (!report) return gate(ctx, 404, "Not found", "That simulation report is not here.");
  const visible = report.author_id === ctx.user.id || (report.shared && canEnter(ctx.user, "chartslate"));
  if (!visible) {
    return gate(ctx, 403, "Simulation report", "This simulation report is not shared with your company.");
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
  if (!report) return gate(ctx, 404, "Not found", "That simulation report is not here.");
  if (report.author_id !== ctx.user.id) return gate(ctx, 403, "Simulation report", "Only the member who wrote it can share it.");
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
  if (!simulation || !practiceRole || !canEnter(ctx.user, simulation)) {
    sendHtml(ctx, 400, interviewsPage(ctx, {
      interviews: listInterviews(),
      error: "Pick a company you belong to and name the job role.",
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
    return gate(ctx, 400, "Simulation interview", "That simulation interview is no longer open, or you requested it yourself.");
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
  if (!allowed) return gate(ctx, 403, "Simulation interview", "Simulation notes are for the two members in this interview.");
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    sendHtml(ctx, 400, interviewPage(ctx, {
      interview,
      notes: interviewNotes(interview.id),
      error: "Write a simulation note.",
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
      error: "Write a little simulation feedback before you close it.",
    }));
    return;
  }
  if (!completeInterview(interview.id, ctx.user.id, feedback)) {
    return gate(ctx, 403, "Simulation interview", "The member running the interview closes it.");
  }
  redirect(ctx, `/interviews/${interview.id}?m=interview-complete`);
}

function notchdayRoster() {
  return listUsers().filter((user) => isNotchdayMember(user));
}

function membershipGet(ctx) {
  sendHtml(ctx, 200, membershipPage(ctx, { members: notchdayRoster() }));
}

function membershipPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!ctx.user.simulation && !isCeo(ctx.user)) return redirect(ctx, "/signup");
  setMembership(ctx.user.id, "all");
  redirect(ctx, "/desk?m=membership");
}

function membershipInvite(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!isNotchdayMember(ctx.user)) {
    return gate(ctx, 403, "Notchday team", "Only the Notchday team can invite someone.");
  }
  const email = cleanLine(ctx.body.get("email"), 120).toLowerCase();
  const person = findUserByEmail(email);
  if (!person || person.id === ctx.user.id || !person.simulation) {
    sendHtml(ctx, 400, membershipPage(ctx, {
      members: notchdayRoster(),
      error: "Invite a member who already pledged to a public team.",
    }));
    return;
  }
  setMembership(person.id, "all");
  redirect(ctx, "/membership?m=invited");
}

function renderScoreboard(ctx, error = "") {
  const rivalries = listRivalries();
  const scores = Object.fromEntries(Object.keys(SIMS).map((id) => [id, activityScore(id)]));
  return scoreboardPage(ctx, { rivalries, scores, error });
}

function scoreboardGet(ctx) {
  sendHtml(ctx, 200, renderScoreboard(ctx));
}

function rivalrySides(ctx) {
  const left = simOf(ctx.body.get("left"));
  const right = simOf(ctx.body.get("right"));
  if (!left || !right || left === right) return null;
  return [left, right];
}

function rivalryPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!isCeo(ctx.user)) return gate(ctx, 403, "Scoreboard", "The CEO, the mysterious leader, sets which companies compete.");
  const pair = rivalrySides(ctx);
  if (pair) setRivalry(pair[0], pair[1]);
  redirect(ctx, "/scoreboard?m=rivalry-set");
}

function rivalryClear(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!isCeo(ctx.user)) return gate(ctx, 403, "Scoreboard", "The CEO, the mysterious leader, sets which companies compete.");
  const pair = rivalrySides(ctx);
  if (pair) clearRivalry(pair[0], pair[1]);
  redirect(ctx, "/scoreboard?m=rivalry-cleared");
}

function rivalryAssignment(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!isCeo(ctx.user)) return gate(ctx, 403, "Scoreboard", "The CEO, the mysterious leader, sends the competition assignment.");
  const pair = rivalrySides(ctx);
  const assignment = cleanText(ctx.body.get("assignment"), 500);
  if (!pair || !assignment || !setRivalryAssignment(pair[0], pair[1], assignment)) {
    sendHtml(ctx, 400, renderScoreboard(ctx, "Set two companies competing, then write the simulation assignment."));
    return;
  }
  redirect(ctx, "/scoreboard?m=assignment-sent");
}

function rivalryWinner(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!isCeo(ctx.user)) return gate(ctx, 403, "Scoreboard", "The CEO, the mysterious leader, announces the winner.");
  const pair = rivalrySides(ctx);
  const winner = simOf(ctx.body.get("winner"));
  const note = cleanText(ctx.body.get("note"), 500);
  if (!pair || !announceRivalryWinner(pair[0], pair[1], winner, note)) {
    sendHtml(ctx, 400, renderScoreboard(ctx, "Pick one of the competing companies as the winner."));
    return;
  }
  redirect(ctx, "/scoreboard?m=winner-announced");
}

function hrPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const kind = ctx.body.get("kind") === "report" ? "report" : "bug";
  const body = cleanText(ctx.body.get("body"), 2000);
  const hanna = findUserByEmail(SEED.email);
  let aboutId = 0;
  if (kind === "report") {
    const about = findUser(Number(ctx.body.get("about_user_id")));
    if (!about || about.id === ctx.user.id || about.email === SEED.email) {
      return gate(ctx, 400, "Complaint box", "Pick another member to report.");
    }
    aboutId = about.id;
  }
  if (!body) return gate(ctx, 400, "Complaint box", "Write the bug, issue, or report.");
  addComplaint({ fromUserId: ctx.user.id, kind, aboutUserId: aboutId || null, body });
  redirect(ctx, `/members/${hanna.id}?m=hr-sent`);
}

function checkinPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!canEnter(ctx.user, "yapmark")) return redirect(ctx, "/membership?m=locked");
  const body = cleanText(ctx.body.get("body"), 280);
  if (!body) return redirect(ctx, "/yapmark/floor");
  addCheckin({ userId: ctx.user.id, simulation: "yapmark", working: ctx.body.get("working") === "1", body });
  redirect(ctx, "/yapmark/floor?m=checkin-saved");
}

function groupsGet(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, groupsPage(ctx, { groups: listVisibleGroups(ctx.user) }));
}

function joinRuleOf(value) {
  return Object.hasOwn(JOIN_RULES, value) ? value : "";
}

function groupsPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const name = cleanLine(ctx.body.get("name"), 80);
  const simulation = simOf(ctx.body.get("simulation"));
  const joinRule = joinRuleOf(ctx.body.get("join_rule"));
  if (!name || !simulation || !canEnter(ctx.user, simulation) || !joinRule) {
    sendHtml(ctx, 400, groupsPage(ctx, {
      groups: listVisibleGroups(ctx.user),
      error: "Name the group, pick a company you belong to, and choose a join rule.",
    }));
    return;
  }
  const id = createGroup({ name, simulation, createdBy: ctx.user.id, joinRule });
  redirect(ctx, `/groups/${id}?m=group-made`);
}

function loadGroup(ctx, params) {
  const group = getGroup(idOf(params));
  if (!group) {
    gate(ctx, 404, "Not found", "That simulation group is not here.");
    return null;
  }
  if (!canEnter(ctx.user, group.simulation)) {
    gate(ctx, 403, "Simulation group", "This group is for members of that company simulation.");
    return null;
  }
  return group;
}

function groupView(ctx, group, error = "") {
  return groupPage(ctx, {
    group,
    members: groupMembers(group.id),
    missions: listMissions(group.id),
    tasks: listGroupTasks(group.id),
    joined: isGroupMember(group.id, ctx.user.id),
    openings: listOpeningsForGroup(group.id),
    lead: findUser(group.created_by),
    requests: listGroupRequests(group.id),
    asked: hasGroupRequest(group.id, ctx.user.id),
    error,
  });
}

function joinedGroups(user) {
  return listVisibleGroups(user).filter((group) => group.joined);
}

function openingsGet(ctx) {
  if (!requireUser(ctx)) return;
  const selected = String(ctx.query.get("group") || "");
  sendHtml(ctx, 200, openingsPage(ctx, {
    openings: listVisibleOpenings(ctx.user),
    groups: joinedGroups(ctx.user),
    selectedGroup: selected,
  }));
}

function openingsPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const groups = joinedGroups(ctx.user);
  const title = cleanLine(ctx.body.get("title"), 120);
  const description = cleanText(ctx.body.get("description"), 2000);
  const ask = cleanText(ctx.body.get("ask"), 2000);
  const group = getGroup(Number(ctx.body.get("group_id")));
  const member = group && isGroupMember(group.id, ctx.user.id) && canEnter(ctx.user, group.simulation);
  if (!member) {
    return sendHtml(ctx, 403, openingsPage(ctx, {
      openings: listVisibleOpenings(ctx.user),
      groups,
      error: "Post a simulation opening only for a group you belong to.",
    }));
  }
  if (!title || !description || !ask) {
    return sendHtml(ctx, 400, openingsPage(ctx, {
      openings: listVisibleOpenings(ctx.user),
      groups,
      selectedGroup: String(group.id),
      error: "Add a position title, a description, and what the simulation message should include.",
    }));
  }
  const id = createOpening({ groupId: group.id, posterId: ctx.user.id, title, description, ask });
  redirect(ctx, `/openings/${id}?m=opening-posted`);
}

function loadOpening(ctx, params) {
  const opening = getOpening(idOf(params));
  if (!opening) {
    gate(ctx, 404, "Not found", "That simulation opening is not here.");
    return null;
  }
  if (!canEnter(ctx.user, opening.simulation)) {
    gate(ctx, 403, "Simulation opening", "This simulation opening is for members of that company.");
    return null;
  }
  return opening;
}

function openingView(ctx, opening, error = "") {
  return openingPage(ctx, {
    opening,
    applications: ctx.user.id === opening.poster_id ? listApplications(opening.id) : [],
    application: getApplication(opening.id, ctx.user.id),
    error,
  });
}

function openingGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const opening = loadOpening(ctx, params);
  if (!opening) return;
  sendHtml(ctx, 200, openingView(ctx, opening));
}

function openingApply(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const opening = loadOpening(ctx, params);
  if (!opening) return;
  if (opening.poster_id === ctx.user.id) {
    return sendHtml(ctx, 400, openingView(ctx, opening, "The poster does not apply to their own simulation opening."));
  }
  const poster = findUser(opening.poster_id);
  if (!poster || !sharesCompany(ctx.user, poster)) {
    return gate(ctx, 403, "Simulation opening", "Simulation messages stay with members who share a company.");
  }
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) return sendHtml(ctx, 400, openingView(ctx, opening, "Include a simulation resume or another note."));
  const message = `Simulation application for "${opening.title}" in ${opening.group_name}.\nThis is a simulation opening inside the work LARP. It is not real hiring and not a resume.\n\n${body}`;
  saveApplication({ openingId: opening.id, applicantId: ctx.user.id, body });
  addMessage({
    simulation: opening.simulation,
    senderId: ctx.user.id,
    recipientId: poster.id,
    body: message,
  });
  notifyUser(poster.id, { t: "chat", with: ctx.user.id, fromName: publicName(ctx.user), fromTeam: teamLabel(ctx.user) });
  redirect(ctx, `/openings/${opening.id}?m=opening-applied`);
}

function openingInterviewPost(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const opening = loadOpening(ctx, params);
  if (!opening) return;
  if (opening.poster_id !== ctx.user.id) {
    return gate(ctx, 403, "Simulation opening", "The poster interviews applicants for this simulation opening.");
  }
  const applicant = findUser(Number(ctx.body.get("applicant_id")));
  const application = applicant ? getApplication(opening.id, applicant.id) : null;
  if (!applicant || !application || !sharesCompany(ctx.user, applicant)) {
    return sendHtml(ctx, 400, openingView(ctx, opening, "Pick a member who sent a simulation message."));
  }
  const id = createOpeningInterview({ openingId: opening.id, applicantId: applicant.id, posterId: ctx.user.id });
  addMessage({
    simulation: opening.simulation,
    senderId: ctx.user.id,
    recipientId: applicant.id,
    body: `Simulation interview for "${opening.title}" in ${opening.group_name}.\nThis is inside the work LARP. It is not a hire.`,
  });
  notifyUser(applicant.id, { t: "chat", with: ctx.user.id, fromName: publicName(ctx.user), fromTeam: teamLabel(ctx.user) });
  redirect(ctx, `/opening-interviews/${id}?m=opening-interview`);
}

function loadOpeningInterview(ctx, params) {
  const interview = getOpeningInterview(idOf(params));
  if (!interview) {
    gate(ctx, 404, "Not found", "That simulation interview is not here.");
    return null;
  }
  if (interview.poster_id !== ctx.user.id && interview.applicant_id !== ctx.user.id) {
    gate(ctx, 403, "Simulation opening", "This simulation interview is for the poster and the applicant.");
    return null;
  }
  const opening = getOpening(interview.opening_id);
  if (!opening) {
    gate(ctx, 404, "Not found", "That simulation opening is not here.");
    return null;
  }
  return { interview, opening };
}

function openingInterviewView(ctx, interview, opening, error = "") {
  const poster = findUser(interview.poster_id);
  const applicant = findUser(interview.applicant_id);
  const teams = listTeamsFor(ctx.user.id).filter((team) => team.simulation === opening.simulation);
  return openingInterviewPage(ctx, {
    interview,
    opening,
    poster,
    applicant,
    application: getApplication(opening.id, interview.applicant_id),
    notes: openingInterviewNotes(interview.id),
    teams: ctx.user.id === interview.poster_id ? teams : [],
    inGroup: isGroupMember(opening.group_id, interview.applicant_id),
    error,
  });
}

function openingInterviewGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const loaded = loadOpeningInterview(ctx, params);
  if (!loaded) return;
  sendHtml(ctx, 200, openingInterviewView(ctx, loaded.interview, loaded.opening));
}

function openingInterviewNote(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const loaded = loadOpeningInterview(ctx, params);
  if (!loaded) return;
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    return sendHtml(ctx, 400, openingInterviewView(ctx, loaded.interview, loaded.opening, "Write a simulation note."));
  }
  addOpeningInterviewNote(loaded.interview.id, ctx.user.id, body);
  redirect(ctx, `/opening-interviews/${loaded.interview.id}?m=note-saved`);
}

function openingInterviewGroup(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const loaded = loadOpeningInterview(ctx, params);
  if (!loaded) return;
  if (loaded.interview.poster_id !== ctx.user.id) {
    return gate(ctx, 403, "Simulation opening", "The poster adds someone to the simulation group.");
  }
  const applicant = findUser(loaded.interview.applicant_id);
  if (!applicant || !canEnter(applicant, loaded.opening.simulation)) {
    return gate(ctx, 403, "Simulation opening", "That member is not in this company simulation.");
  }
  joinGroup(loaded.opening.group_id, applicant.id);
  redirect(ctx, `/opening-interviews/${loaded.interview.id}?m=opening-joined`);
}

function openingInterviewTeam(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const loaded = loadOpeningInterview(ctx, params);
  if (!loaded) return;
  if (loaded.interview.poster_id !== ctx.user.id) {
    return gate(ctx, 403, "Simulation opening", "The poster adds someone to a simulation team.");
  }
  const team = getTeam(Number(ctx.body.get("team_id")));
  const applicant = findUser(loaded.interview.applicant_id);
  if (!team || team.simulation !== loaded.opening.simulation || !isTeamMember(team.id, ctx.user.id) || !applicant || !canEnter(applicant, team.simulation)) {
    return sendHtml(ctx, 400, openingInterviewView(ctx, loaded.interview, loaded.opening, "Pick a simulation team you belong to in this company."));
  }
  addTeamMember(team.id, applicant.id);
  redirect(ctx, `/opening-interviews/${loaded.interview.id}?m=opening-teamed`);
}

function groupGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  sendHtml(ctx, 200, groupView(ctx, group));
}

function canReviewRequest(user, group) {
  if (group.join_rule === "members") return isGroupMember(group.id, user.id);
  if (group.join_rule === "lead") return user.id === group.created_by;
  return false;
}

function groupJoin(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  if (isGroupMember(group.id, ctx.user.id)) {
    redirect(ctx, `/groups/${group.id}?m=group-joined`);
    return;
  }
  if ((group.join_rule || "open") === "open" || (group.join_rule === "lead" && ctx.user.id === group.created_by)) {
    joinGroup(group.id, ctx.user.id);
    clearGroupRequest(group.id, ctx.user.id);
    redirect(ctx, `/groups/${group.id}?m=group-joined`);
    return;
  }
  requestGroupJoin(group.id, ctx.user.id);
  redirect(ctx, `/groups/${group.id}?m=group-asked`);
}

function groupRequestAccept(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  const person = findUser(Number(ctx.body.get("user_id")));
  if (!person || person.id === ctx.user.id || !canEnter(person, group.simulation) || !hasGroupRequest(group.id, person.id)) {
    return sendHtml(ctx, 400, groupView(ctx, group, "Pick a member who asked to join this simulation group."));
  }
  if (!canReviewRequest(ctx.user, group)) {
    return gate(ctx, 403, "Simulation group", "You cannot accept a join request for this simulation group.");
  }
  joinGroup(group.id, person.id);
  clearGroupRequest(group.id, person.id);
  redirect(ctx, `/groups/${group.id}?m=group-accepted`);
}

function groupRequestDecline(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  const person = findUser(Number(ctx.body.get("user_id")));
  if (!person || !hasGroupRequest(group.id, person.id)) {
    return sendHtml(ctx, 400, groupView(ctx, group, "That join request is not here."));
  }
  if (!canReviewRequest(ctx.user, group)) {
    return gate(ctx, 403, "Simulation group", "You cannot decline a join request for this simulation group.");
  }
  clearGroupRequest(group.id, person.id);
  redirect(ctx, `/groups/${group.id}?m=group-declined`);
}

function groupRequestWithdraw(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  clearGroupRequest(group.id, ctx.user.id);
  redirect(ctx, `/groups/${group.id}?m=group-withdrawn`);
}

function groupLeave(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  leaveGroup(group.id, ctx.user.id);
  redirect(ctx, `/groups/${group.id}?m=group-left`);
}

function missionPost(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  if (!isCeo(ctx.user)) return gate(ctx, 403, "Simulation mission", "The CEO, the mysterious leader, sends simulation missions to groups.");
  const title = cleanLine(ctx.body.get("title"), 120);
  const brief = cleanText(ctx.body.get("brief"), 2000);
  if (!title) return sendHtml(ctx, 400, groupView(ctx, group, "Name the simulation mission."));
  createMission({ groupId: group.id, title, brief, createdBy: ctx.user.id });
  redirect(ctx, `/groups/${group.id}?m=mission-sent`);
}

function groupTaskPost(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const group = loadGroup(ctx, params);
  if (!group) return;
  if (!isCeo(ctx.user)) return gate(ctx, 403, "Simulation task", "The CEO, the mysterious leader, sends simulation tasks to groups.");
  const title = cleanLine(ctx.body.get("title"), 120);
  const detail = cleanText(ctx.body.get("detail"), 2000);
  const missionId = Number(ctx.body.get("mission_id")) || 0;
  const mission = missionId ? getMission(missionId) : null;
  if (!title || (missionId && (!mission || mission.group_id !== group.id))) {
    return sendHtml(ctx, 400, groupView(ctx, group, "Name the simulation task for this group."));
  }
  createGroupTask({
    groupId: group.id,
    missionId: mission ? mission.id : 0,
    title,
    detail,
    createdBy: ctx.user.id,
  });
  redirect(ctx, `/groups/${group.id}?m=group-task`);
}

function groupTaskStatus(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const task = getGroupTask(idOf(params));
  if (!task) return gate(ctx, 404, "Not found", "That simulation task is not here.");
  if (!canEnter(ctx.user, task.simulation)) {
    return gate(ctx, 403, "Simulation task", "This task belongs to another company simulation.");
  }
  if (!isGroupMember(task.group_id, ctx.user.id) && !isCeo(ctx.user)) {
    return gate(ctx, 403, "Simulation task", "Join the group before you mark a task.");
  }
  setGroupTaskStatus(task.id, ctx.body.get("status") === "done" ? "done" : "open");
  redirect(ctx, `/groups/${task.group_id}?m=group-task-updated`);
}

function contestsGet(ctx) {
  if (!requireUser(ctx)) return;
  sendHtml(ctx, 200, contestsPage(ctx, { contests: listContestsFor(ctx.user) }));
}

function contestsPost(ctx) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!isCeo(ctx.user)) return gate(ctx, 403, "Company contest", "The CEO, the mysterious leader, sends company-wide simulation contests.");
  const simulation = simOf(ctx.body.get("simulation"));
  const title = cleanLine(ctx.body.get("title"), 120);
  const brief = cleanText(ctx.body.get("brief"), 2000);
  if (!simulation || !title) {
    return sendHtml(ctx, 400, contestsPage(ctx, {
      contests: listContestsFor(ctx.user),
      error: "Name the contest and pick a company.",
    }));
  }
  const id = createContest({ simulation, title, brief, createdBy: ctx.user.id });
  redirect(ctx, `/contests/${id}?m=contest-sent`);
}

function contestGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const contest = getContest(idOf(params));
  if (!contest) return gate(ctx, 404, "Not found", "That simulation contest is not here.");
  if (!canEnter(ctx.user, contest.simulation)) {
    return gate(ctx, 403, "Company contest", "This contest is for members of that company simulation.");
  }
  sendHtml(ctx, 200, contestPage(ctx, {
    contest,
    entries: listContestEntries(contest.id),
    writer: true,
  }));
}

function contestEntry(ctx, params) {
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  const contest = getContest(idOf(params));
  if (!contest) return gate(ctx, 404, "Not found", "That simulation contest is not here.");
  if (!canEnter(ctx.user, contest.simulation)) return redirect(ctx, "/membership?m=locked");
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    return sendHtml(ctx, 400, contestPage(ctx, {
      contest,
      entries: listContestEntries(contest.id),
      writer: true,
      error: "Write an entry.",
    }));
  }
  saveContestEntry({ contestId: contest.id, userId: ctx.user.id, body });
  redirect(ctx, `/contests/${contest.id}?m=contest-entered`);
}

function roomBundle(ctx, sim, extra = {}) {
  return {
    sim,
    messages: listRoomMessages(sim),
    files: listFiles(sim),
    checkins: sim === "yapmark" ? latestCheckins(sim) : [],
    pitches: sim === "flinttable" ? listIdeas(ctx.user?.id) : [],
    contests: listContests(sim),
    ...extra,
  };
}

function chartRoom(ctx, extra = {}) {
  return {
    reports: listVisibleReports(ctx.user.id),
    messages: listRoomMessages("chartslate"),
    files: listFiles("chartslate"),
    contests: listContests("chartslate"),
    canWrite: true,
    ...extra,
  };
}

function roomGet(ctx, params) {
  const sim = simOf(params.sim);
  if (!sim) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (!requireUser(ctx)) return;
  if (sim === "chartslate") return quarryGet(ctx);
  if (!canEnter(ctx.user, sim)) return sendHtml(ctx, 200, enterSimPage(ctx, sim));
  sendHtml(ctx, 200, roomPage(ctx, roomBundle(ctx, sim)));
}

function roomPost(ctx, params) {
  const sim = simOf(params.sim);
  if (!sim) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (!requireUser(ctx) || !requireCsrf(ctx)) return;
  if (!canEnter(ctx.user, sim)) return redirect(ctx, "/membership?m=locked");
  const body = cleanText(ctx.body.get("body"), 2000);
  if (!body) {
    return sendHtml(ctx, 400, roomPage(ctx, roomBundle(ctx, sim, { error: "Write a room message." })));
  }
  addRoomMessage({ simulation: sim, userId: ctx.user.id, body });
  redirect(ctx, `/${sim}/room?m=room-sent`);
}

function roomMessages(ctx, params) {
  const sim = simOf(params.sim);
  if (!sim) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (!requireUser(ctx)) return;
  if (!canEnter(ctx.user, sim)) return gate(ctx, 403, "Company room", "This company room is for its own members.");
  if (ctx.query.get("fragment") === "1") return sendFragment(ctx, roomThreadFragment(ctx, listRoomMessages(sim)));
  redirect(ctx, `/${sim}/room`);
}

function filePost(ctx, params) {
  const sim = simOf(params.sim);
  if (!sim) return gate(ctx, 404, "Not found", "That page is not in the studio.");
  if (!requireUser(ctx)) return;
  if (ctx.body.get("__too_large") === "1") return gate(ctx, 413, "File share", "That file is too large.");
  if (!requireCsrf(ctx)) return;
  if (!canEnter(ctx.user, sim)) return redirect(ctx, "/membership?m=locked");
  const upload = typeof ctx.body.file === "function" ? ctx.body.file("upload") : null;
  const kind = sharedKind(upload);
  if (!kind) {
    return sendHtml(ctx, 400, roomPage(ctx, roomBundle(ctx, sim, {
      fileError: "Share a PNG, JPEG, WebP, PDF, TXT, or CSV under 2 MB.",
    })));
  }
  const id = addSharedFile({
    simulation: sim,
    userId: ctx.user.id,
    name: kind.name,
    mime: kind.mime,
    bytes: upload.bytes.length,
  });
  const dir = join(dataDir(), "files");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, String(id)), upload.bytes);
  redirect(ctx, `/${sim}/room?m=file-saved`);
}

function fileGet(ctx, params) {
  if (!requireUser(ctx)) return;
  const row = getSharedFile(idOf(params));
  const file = row ? join(dataDir(), "files", String(row.id)) : "";
  if (!row || !file || !existsSync(file) || !canEnter(ctx.user, row.simulation)) {
    const status = row && !canEnter(ctx.user, row.simulation) ? 403 : 404;
    const headers = securityHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" });
    ctx.res.writeHead(status, headers);
    ctx.res.end(status === 403 ? "That file is in another company." : "That file is not here.");
    return;
  }
  ctx.res.writeHead(200, securityHeaders({
    "Content-Type": row.mime,
    "Content-Length": statSync(file).size,
    "Content-Disposition": `attachment; filename="${row.name.replace(/["\r\n]/g, "")}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  }));
  createReadStream(file).pipe(ctx.res);
}

function sharedKind(upload) {
  if (!upload?.bytes || upload.bytes.length < 1 || upload.bytes.length > 2_000_000) return "";
  const name = safeUploadName(upload.filename);
  const lower = name.toLowerCase();
  const bytes = upload.bytes;
  if (lower.endsWith(".png") && imageType(bytes) === "image/png") return { mime: "image/png", name };
  if ((lower.endsWith(".jpg") || lower.endsWith(".jpeg")) && imageType(bytes) === "image/jpeg") return { mime: "image/jpeg", name };
  if (lower.endsWith(".webp") && imageType(bytes) === "image/webp") return { mime: "image/webp", name };
  if (lower.endsWith(".pdf") && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mime: "application/pdf", name };
  }
  if ((lower.endsWith(".txt") || lower.endsWith(".csv")) && textBytes(bytes)) {
    return { mime: lower.endsWith(".csv") ? "text/csv; charset=utf-8" : "text/plain; charset=utf-8", name };
  }
  return "";
}

function safeUploadName(filename) {
  const base = String(filename || "file").split(/[/\\]/).pop().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^\.+/, "").slice(0, 80);
  return base || "file";
}

function textBytes(bytes) {
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  for (const byte of sample) if (byte === 0) return false;
  return true;
}

function supportGet(ctx) {
  sendHtml(ctx, 200, supportPage(ctx));
}

function supportPost(ctx) {
  redirect(ctx, TIP_URL);
}

function bugGet(ctx) {
  sendHtml(ctx, 200, bugPage(ctx, { page: cleanLine(ctx.query.get("page"), 200) }));
}

async function bugPost(ctx) {
  if (!requireCsrf(ctx)) return;
  const body = cleanText(ctx.body.get("body"), 2000);
  const page = cleanLine(ctx.body.get("page"), 200);
  if (!body) return sendHtml(ctx, 400, bugPage(ctx, { error: "Write what went wrong.", page }));
  const who = ctx.user ? publicName(ctx.user) : "A visitor";
  const text = [`From: ${who}`, page ? `Page: ${page}` : "", "", body].filter((line) => line !== undefined).join("\n");
  const sent = await sendOwnerNotice({ subject: "Notchday bug report", text });
  addBugReport({ userId: ctx.user?.id || 0, page, body, mailed: sent.mailed });
  redirect(ctx, `/bugs?m=${sent.mailed ? "bug-sent" : "bug-stored"}`);
}

function sendFragment(ctx, html) {
  const headers = securityHeaders({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  ctx.res.writeHead(200, headers);
  ctx.res.end(veilHtml(html));
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
    console.log(`Notchday listening on http://${address.address}:${address.port}`);
  });
}
