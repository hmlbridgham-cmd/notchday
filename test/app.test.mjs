import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, test } from "node:test";
import WebSocket from "ws";
import { DISCLAIMER, SEED } from "../lib/copy.mjs";
import { barChart } from "../lib/quarry.mjs";
import { start } from "../server.mjs";

const dir = mkdtempSync(join(tmpdir(), "daymark-"));
const server = await start({ port: 0, host: "127.0.0.1", dbFile: join(dir, "daymark.sqlite") });
const base = `http://127.0.0.1:${server.address().port}`;
after(() => new Promise((resolve) => server.close(resolve)));

const pages = ["/", "/copperline", "/kindling", "/quarry", "/support", "/login", "/signup"];
const banned = ["you were hired", "you're hired", "you are hired", "free trial", "free for 2 months", "subscribe now"];

describe("daymark", { concurrency: 1 }, () => {
  test("public pages state the simulation disclaimer and leave logo slots", async () => {
    for (const path of pages) {
      const { html, res } = await read(client(), path);
      assert.equal(res.status, 200, path);
      assert.ok(html.includes(DISCLAIMER), path);
      for (const phrase of banned) assert.equal(html.toLowerCase().includes(phrase), false, `${path} ${phrase}`);
    }
    const home = await read(client(), "/");
    for (const id of ["daymark", "copperline", "kindling", "quarry"]) {
      assert.match(home.html, new RegExp(`data-logo="${id}"`));
    }
    assert.match(home.html, /Hanna Bridgham, CEO of Daymark/);
    assert.match(home.html, /Studio contact/);
    assert.match(home.html, /253-241-7270/);
    assert.match(home.html, /tel:\+12532417270/);
    assert.match(home.html, /fake-company simulation, not a real employer/);
    assert.equal(home.html.includes('id="call-app"'), false);
    const copper = await read(client(), "/copperline");
    assert.match(copper.html, /data-world="copperline"/);
    assert.match(copper.html, /href="\/copperline\/login"/);
    assert.match(copper.html, /href="\/copperline\/signup"/);
    assert.equal(copper.html.toLowerCase().includes("video"), false);
    const support = await read(client(), "/support");
    assert.match(support.html, /no subscription/i);
    assert.match(support.html, /no paywall/i);
    assert.match(support.html, /does not charge a card/i);
    assert.equal(support.html.includes('name="card"'), false);
  });

  test("chart renders public rows", () => {
    const svg = barChart({
      title: "Population",
      source: "World Bank",
      rows: [{ label: "Japan", value: 120000000 }],
    });
    assert.match(svg, /<svg/);
    assert.match(svg, /Japan/);
    assert.match(svg, /World Bank/);
  });

  test("Hanna can log in as Daymark CEO and log out", async () => {
    const hanna = client();
    const desk = await submit(hanna, "/login", {
      email: SEED.email,
      password: SEED.password,
      next: "/desk",
    });
    assert.equal(desk.res.status, 200);
    assert.match(desk.html, /CEO of Daymark/);
    assert.match(desk.html, /Hanna Bridgham/);
    assert.ok(desk.html.includes(DISCLAIMER));
    const gone = await post(hanna, "/logout", { csrf: csrfOf(desk.html) });
    assert.equal(gone.status, 303);
    const locked = await hanna.fetch("/desk");
    assert.equal(locked.status, 303);
    assert.match(locked.headers.get("location"), /^\/login/);
  });

  test("members can practice teams, meetings, interviews, ideas, reports, and donations", async () => {
    const ada = client();
    const bea = client();
    const adaDesk = await signup(ada, "Ada North", "ada@example.com", "copperline", "Floor listener", "Caller");
    assert.match(adaDesk.html, /Practice profile/);
    assert.match(adaDesk.html, /Floor listener/);
    const beaDesk = await signup(bea, "Bea South", "bea@example.com", "copperline", "Floor note taker", "Listener");
    assert.equal(beaDesk.res.status, 200);

    const adaId = Number(adaDesk.html.match(/data-user-id="(\d+)"/)[1]);
    const beaId = Number(beaDesk.html.match(/data-user-id="(\d+)"/)[1]);
    assert.notEqual(adaId, beaId);

    const teams = await read(ada, "/teams");
    const made = await post(ada, "/teams", { csrf: csrfOf(teams.html), name: "Line <practice>" });
    assert.equal(made.status, 303);
    const teamUrl = pathOnly(made.headers.get("location"));
    const team = await read(ada, teamUrl);
    assert.match(team.html, /Practice team/);
    assert.match(team.html, /Line &lt;practice&gt;/);
    const added = await post(ada, `${teamUrl}/members`, { csrf: csrfOf(team.html), user_id: String(beaId) });
    assert.equal(added.status, 303);
    const withBea = await read(ada, teamUrl);
    assert.match(withBea.html, /Bea South/);
    const tasked = await post(ada, `${teamUrl}/tasks`, {
      csrf: csrfOf(withBea.html),
      title: "Open the practice line",
      detail: "Say hello on a practice call.",
      assignee_id: String(beaId),
    });
    assert.equal(tasked.status, 303);
    const taskedPage = await read(ada, teamUrl);
    assert.match(taskedPage.html, /Practice task · simulation/);
    assert.match(taskedPage.html, /Open the practice line/);

    const starts = stamp(10);
    const ends = stamp(11);
    const calendar = await read(ada, "/calendar");
    const meeting = await post(ada, "/meetings", {
      csrf: csrfOf(calendar.html),
      title: "Morning practice",
      agenda: "A practice conversation.",
      starts_at: starts,
      ends_at: ends,
      with: String(beaId),
    });
    assert.equal(meeting.status, 303);
    const meetingUrl = pathOnly(meeting.headers.get("location"));
    const room = await read(bea, meetingUrl);
    assert.match(room.html, /Simulation meeting · practice/);
    assert.match(room.html, /Morning practice/);
    const joined = await post(bea, `${meetingUrl}/join`, { csrf: csrfOf(room.html) });
    assert.equal(joined.status, 303);
    const joinedPage = await read(bea, meetingUrl);
    assert.match(joinedPage.html, /You joined this simulation meeting|Joined/);

    const interviews = await read(bea, "/interviews");
    const requested = await post(bea, "/interviews", {
      csrf: csrfOf(interviews.html),
      simulation: "copperline",
      practice_role: "Floor listener",
      note: "I want to practice the call floor.",
    });
    assert.equal(requested.status, 303);
    const interviewUrl = pathOnly(requested.headers.get("location"));
    const open = await read(ada, interviewUrl);
    assert.match(open.html, /Simulation interview · practice/);
    const claimed = await post(ada, `${interviewUrl}/claim`, { csrf: csrfOf(open.html) });
    assert.equal(claimed.status, 303);
    const running = await read(ada, interviewUrl);
    const noted = await post(ada, `${interviewUrl}/notes`, {
      csrf: csrfOf(running.html),
      body: "Practice question one went fine.",
    });
    assert.equal(noted.status, 303);
    const withNote = await read(ada, interviewUrl);
    assert.match(withNote.html, /Practice note/);
    const done = await post(ada, `${interviewUrl}/complete`, {
      csrf: csrfOf(withNote.html),
      feedback: "Practice complete. Clear voice and a calm pace on the floor.",
    });
    assert.equal(done.status, 303);
    const finished = await read(bea, interviewUrl);
    assert.match(finished.html, /Practice complete/);
    assert.equal(finished.html.toLowerCase().includes("hired"), false);

    const switched = await post(ada, "/profile", {
      csrf: csrfOf((await read(ada, "/profile")).html),
      simulation: "kindling",
      practice_title: "Idea scriber",
      practice_role: "Table host",
    });
    assert.equal(switched.status, 303);
    const denied = await ada.fetch(teamUrl);
    assert.equal(denied.status, 403);

    const table = await read(ada, "/kindling/table");
    const idea = await post(ada, "/kindling/ideas", {
      csrf: csrfOf(table.html),
      title: "A quieter morning floor",
      pitch: "Practice a slower start to the call floor so new members can listen first.",
    });
    assert.equal(idea.status, 303);
    const ideaPage = await read(ada, pathOnly(idea.headers.get("location")));
    assert.match(ideaPage.html, /Practice idea/);

    const quarryProfile = await post(ada, "/profile", {
      csrf: csrfOf((await read(ada, "/profile")).html),
      simulation: "quarry",
      practice_title: "Chart maker",
      practice_role: "Report writer",
    });
    assert.equal(quarryProfile.status, 303);
    const roomPage = await read(ada, "/quarry/room?dataset=population");
    assert.equal(roomPage.res.status, 200);
    assert.match(roomPage.html, /<svg/);
    assert.match(roomPage.html, /World Bank/);
    const report = await post(ada, "/quarry/reports", {
      csrf: csrfOf(roomPage.html),
      dataset: "population",
      city: "",
      title: "Population practice note",
      body: "These public population figures are a practice chart for the data room, not a client deliverable.",
    });
    assert.equal(report.status, 303);
    const reportUrl = pathOnly(report.headers.get("location"));
    const reportPage = await read(ada, reportUrl);
    assert.match(reportPage.html, /Practice report/);
    const shared = await post(ada, `${reportUrl}/share`, { csrf: csrfOf(reportPage.html) });
    assert.equal(shared.status, 303);
    const seen = await read(bea, reportUrl);
    assert.equal(seen.res.status, 200);
    assert.match(seen.html, /Population practice note/);

    const guest = client();
    const support = await read(guest, "/support");
    assert.match(support.html, /253-241-7270/);
    const donated = await post(guest, "/support", {
      csrf: csrfOf(support.html),
      amount: "15",
      note: "For the studio.",
    });
    assert.equal(donated.status, 303);
    const thanks = await read(guest, donated.headers.get("location"));
    assert.match(thanks.html, /No card was charged/);
    assert.match(thanks.html, /\$15\.00/);
  });

  test("call signaling rings another member", async () => {
    const one = client();
    const two = client();
    const first = await signup(one, "Call One", "call-one@example.com", "copperline", "Caller", "Host");
    const second = await signup(two, "Call Two", "call-two@example.com", "copperline", "Caller", "Guest");
    const firstId = Number(first.html.match(/data-user-id="(\d+)"/)[1]);
    const secondId = Number(second.html.match(/data-user-id="(\d+)"/)[1]);
    const left = openSocket(one.cookies.get("dm"));
    const right = openSocket(two.cookies.get("dm"));
    await left.ready;
    await right.ready;
    await left.until("online");
    await right.until("online");
    left.ws.send(JSON.stringify({ t: "ring", to: secondId, callId: "practice-1", mode: "video" }));
    const ring = await right.until("ring");
    assert.equal(ring.from, firstId);
    assert.equal(ring.mode, "audio");
    assert.equal(ring.callId, "practice-1");
    right.ws.send(JSON.stringify({ t: "accept", to: firstId, callId: "practice-1", mode: "video" }));
    const accepted = await left.until("accept");
    assert.equal(accepted.from, secondId);
    left.ws.close();
    right.ws.close();
  });

  test("members chat and schedule a practice meeting inside one simulation", async () => {
    const cam = client();
    const dee = client();
    const eli = client();
    const camDesk = await signup(cam, "Cam Lane", "cam-lane@example.com", "kindling", "Idea host", "Table voice");
    const deeDesk = await signup(dee, "Dee Brook", "dee-brook@example.com", "kindling", "Idea guest", "Listener");
    await signup(eli, "Eli West", "eli-west@example.com", "copperline", "Floor host", "Caller");
    const camId = Number(camDesk.html.match(/data-user-id="(\d+)"/)[1]);
    const deeId = Number(deeDesk.html.match(/data-user-id="(\d+)"/)[1]);
    const eliId = Number((await read(eli, "/desk")).html.match(/data-user-id="(\d+)"/)[1]);

    assert.match(camDesk.html, /Practice chat/);
    assert.equal(camDesk.html.includes('id="call-app"'), false);
    assert.equal(camDesk.html.toLowerCase().includes("hired"), false);

    const members = await read(cam, "/members");
    assert.match(members.html, new RegExp(`href="/chats/${deeId}"`));
    assert.match(members.html, new RegExp(`href="/members/${deeId}"`));
    assert.match(members.html, /Practice chat and practice meetings/);

    const self = await cam.fetch(`/chats/${camId}`);
    assert.equal(self.status, 404);
    const blocked = await eli.fetch(`/chats/${camId}`);
    assert.equal(blocked.status, 403);
    assert.ok((await blocked.text()).includes(DISCLAIMER));

    const empty = await post(cam, `/chats/${deeId}`, { csrf: csrfOf(camDesk.html), body: "   " });
    assert.equal(empty.status, 400);

    const thread = await read(cam, `/chats/${deeId}`);
    assert.match(thread.html, /Practice chat · simulation/);
    assert.match(thread.html, /Schedule a practice meeting with Dee Brook/);
    assert.equal(thread.html.includes('id="call-app"'), false);
    assert.equal(thread.html.toLowerCase().includes("video"), false);
    assert.equal(thread.html.toLowerCase().includes("hired"), false);
    assert.ok(thread.html.includes(DISCLAIMER));

    const deeSock = openSocket(dee.cookies.get("dm"));
    const eliSock = openSocket(eli.cookies.get("dm"));
    await deeSock.ready;
    await eliSock.ready;
    await deeSock.until("online");
    await eliSock.until("online");

    const sent = await post(cam, `/chats/${deeId}`, {
      csrf: csrfOf(thread.html),
      body: "Hello <practice>\nSee you on the simulation line.",
    });
    assert.equal(sent.status, 303);
    assert.equal(pathOnly(sent.headers.get("location")), `/chats/${deeId}`);
    const ping = await deeSock.until("chat");
    assert.equal(ping.with, camId);
    assert.equal(ping.fromName, "Cam Lane");
    assert.equal(ping.body, undefined);

    cam.ws = openSocket(cam.cookies.get("dm"));
    await cam.ws.ready;
    cam.ws.ws.send(JSON.stringify({ t: "ring", to: eliId, callId: "cross-sim", mode: "video" }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(eliSock.messages.some((msg) => msg.t === "ring"), false);

    const seen = await read(dee, `/chats/${camId}`);
    assert.match(seen.html, /Hello &lt;practice&gt;/);
    assert.match(seen.html, /See you on the simulation line/);
    assert.match(seen.html, /Practice chat · simulation/);
    const reply = await post(dee, `/chats/${camId}`, {
      csrf: csrfOf(seen.html),
      body: "Practice reply received.",
    });
    assert.equal(reply.status, 303);
    const fragment = await read(cam, `/chats/${deeId}/messages?fragment=1`);
    assert.match(fragment.html, /Practice reply received/);
    assert.equal(fragment.html.includes("<!DOCTYPE"), false);

    const deniedPost = await post(eli, `/chats/${camId}`, {
      csrf: csrfOf((await read(eli, "/desk")).html),
      body: "This should stay out of the simulation.",
    });
    assert.equal(deniedPost.status, 403);
    const still = await read(cam, `/chats/${deeId}/messages?fragment=1`);
    assert.equal(still.html.includes("stay out"), false);

    const form = await read(cam, `/members/${deeId}`);
    assert.match(form.html, /Schedule a practice meeting with Dee Brook/);
    assert.match(form.html, /Schedule practice meeting/);
    const bad = await post(cam, `/members/${deeId}/meeting`, {
      csrf: csrfOf(form.html),
      title: "Too short",
      starts_at: stamp(16),
      ends_at: stamp(16),
      agenda: "",
    });
    assert.equal(bad.status, 400);
    assert.match(await bad.text(), /end after it starts/);
    const badZoom = await post(cam, `/members/${deeId}/meeting`, {
      csrf: csrfOf(form.html),
      title: "Outside link",
      agenda: "This link is not Zoom.",
      starts_at: stamp(14),
      ends_at: stamp(15),
      zoom_link: "https://example.com/meet",
    });
    assert.equal(badZoom.status, 400);
    assert.match(await badZoom.text(), /https Zoom link/);
    const scheduled = await post(cam, `/members/${deeId}/meeting`, {
      csrf: csrfOf(form.html),
      title: "Sync <practice>",
      agenda: "A practice meeting between two members.",
      starts_at: stamp(14),
      ends_at: stamp(15),
      zoom_link: "https://zoom.us/j/123456789",
    });
    assert.equal(scheduled.status, 303);
    const scheduledPage = await read(cam, scheduled.headers.get("location"));
    assert.match(scheduledPage.html, /Simulation meeting scheduled/);
    assert.match(scheduledPage.html, /https:\/\/zoom\.us\/j\/123456789/);
    const meetingUrl = pathOnly(scheduled.headers.get("location"));
    const invited = await read(dee, meetingUrl);
    assert.match(invited.html, /Simulation meeting · practice/);
    assert.match(invited.html, /Sync &lt;practice&gt;/);
    assert.match(invited.html, /Invited/);
    assert.match(invited.html, /Zoom link for this practice meeting/);
    const joined = await post(dee, `${meetingUrl}/join`, { csrf: csrfOf(invited.html) });
    assert.equal(joined.status, 303);
    const joinedPage = await read(dee, meetingUrl);
    assert.match(joinedPage.html, /Joined/);
    const outsider = await eli.fetch(meetingUrl);
    assert.equal(outsider.status, 403);
    const outsiderMeet = await post(eli, `/members/${camId}/meeting`, {
      csrf: csrfOf((await read(eli, "/calendar")).html),
      title: "Cross simulation",
      starts_at: stamp(18),
      ends_at: stamp(19),
    });
    assert.equal(outsiderMeet.status, 403);

    const interviews = await read(dee, "/interviews");
    const requested = await post(dee, "/interviews", {
      csrf: csrfOf(interviews.html),
      simulation: "kindling",
      practice_role: "Table host",
      note: "Practice with a member who is in another simulation.",
    });
    const interviewUrl = pathOnly(requested.headers.get("location"));
    const open = await read(eli, interviewUrl);
    const claimed = await post(eli, `${interviewUrl}/claim`, { csrf: csrfOf(open.html) });
    assert.equal(claimed.status, 303);
    eliSock.ws.send(JSON.stringify({ t: "ring", to: deeId, callId: "interview-practice", mode: "video" }));
    const ring = await deeSock.until("ring");
    assert.equal(ring.from, eliId);
    assert.equal(ring.mode, "audio");
    assert.equal(ring.callId, "interview-practice");

    deeSock.ws.close();
    eliSock.ws.close();
    cam.ws.ws.close();
  });

  test("simulation doors keep practice addresses, photos, and punch time inside the app", async () => {
    const door = await read(client(), "/kindling/signup");
    assert.match(door.html, /data-world="kindling"/);
    assert.match(door.html, /Join Kindling/);
    assert.match(door.html, /name="simulation" value="kindling"/);
    assert.equal(door.html.includes("mailto:"), false);

    const nia = client();
    const joined = await submit(nia, "/kindling/signup", {
      name: "Nia Stone",
      email: "nia-stone@example.com",
      password: "practice-pass",
      simulation: "copperline",
      practice_title: "Table scribe",
      practice_role: "Note taker",
    });
    assert.match(joined.html, /Kindling/);
    assert.match(joined.html, /Practice time\. Not employment\./);
    assert.match(joined.html, /Punched out/);
    assert.match(joined.html, /0s in Kindling/);

    const profile = await read(nia, "/profile");
    assert.match(profile.html, /Simulation address/);
    assert.match(profile.html, /nia\.stone@kindling\.daymark\.simulation/);
    assert.match(profile.html, /only works inside the simulation/);
    assert.equal(profile.html.includes("mailto:"), false);

    const punched = await post(nia, "/punch/in", { csrf: csrfOf(profile.html) });
    assert.equal(punched.status, 303);
    const onClock = await read(nia, punched.headers.get("location"));
    assert.match(onClock.html, /Punched in/);
    assert.match(onClock.html, /Practice time\. Not employment\./);

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const saved = await postMultipart(nia, "/profile/photo", csrfOf(profile.html), {
      name: "photo",
      filename: "dot.png",
      type: "image/png",
      buffer: png,
    });
    assert.equal(saved.status, 303);
    const withPhoto = await read(nia, "/profile");
    assert.match(withPhoto.html, /src="\/avatars\/\d+"/);
    const avatarPath = withPhoto.html.match(/src="(\/avatars\/\d+)"/)[1];
    const avatar = await nia.fetch(avatarPath);
    assert.equal(avatar.status, 200);
    assert.equal(avatar.headers.get("content-type"), "image/png");
    const bytes = Buffer.from(await avatar.arrayBuffer());
    assert.equal(bytes[0], 0x89);
    assert.equal(bytes[1], 0x50);
    const guest = await client().fetch(avatarPath);
    assert.equal(guest.status, 303);
    const rejected = await postMultipart(nia, "/profile/photo", csrfOf(withPhoto.html), {
      name: "photo",
      filename: "notes.txt",
      type: "text/plain",
      buffer: Buffer.from("not a photo"),
    });
    assert.equal(rejected.status, 400);
    assert.match(await rejected.text(), /PNG, JPEG, or WebP/);

    const moved = await post(nia, "/quarry/login", { csrf: csrfOf(withPhoto.html) });
    assert.equal(moved.status, 303);
    const quarryDesk = await read(nia, moved.headers.get("location"));
    assert.match(quarryDesk.html, /This practice is now in that simulation/);
    assert.match(quarryDesk.html, /Punched out/);
    assert.match(quarryDesk.html, /0s in Quarry/);
    const quarryProfile = await read(nia, "/profile");
    assert.match(quarryProfile.html, /nia\.stone@quarry\.daymark\.simulation/);
    assert.equal(quarryProfile.html.includes("nia.stone@kindling.daymark.simulation"), false);
    assert.equal(quarryProfile.html.includes("mailto:"), false);

    const hanna = client();
    const hannaProfile = await submit(hanna, "/login", {
      email: SEED.email,
      password: SEED.password,
      next: "/profile",
    });
    assert.equal(hannaProfile.html.includes("@daymark.simulation"), false);
  });
});

function client() {
  const cookies = new Map();
  return {
    cookies,
    async fetch(path, options = {}) {
      const headers = new Headers(options.headers || {});
      if (cookies.size) headers.set("cookie", [...cookies].map(([key, value]) => `${key}=${value}`).join("; "));
      const response = await fetch(new URL(path, base), { ...options, headers, redirect: "manual" });
      const many = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
      const lines = many.length ? many : [response.headers.get("set-cookie")].filter(Boolean);
      for (const line of lines) {
        const [pair] = line.split(";");
        const index = pair.indexOf("=");
        const key = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (!value || /max-age=0/i.test(line)) cookies.delete(key);
        else cookies.set(key, value);
      }
      return response;
    },
  };
}

async function read(person, path) {
  let current = path;
  for (let hop = 0; hop < 6; hop += 1) {
    const res = await person.fetch(current);
    if (res.status >= 300 && res.status < 400) {
      current = res.headers.get("location");
      continue;
    }
    return { res, html: await res.text(), url: current };
  }
  throw new Error(`too many redirects for ${path}`);
}

async function post(person, path, fields) {
  return person.fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
}

async function postMultipart(person, path, csrf, file) {
  const boundary = "----daymarktest";
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="csrf"\r\n\r\n${csrf}\r\n`),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    ),
    file.buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return person.fetch(path, {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body,
  });
}

async function submit(person, path, fields) {
  const form = await read(person, path);
  const res = await post(person, path, { csrf: csrfOf(form.html), ...fields });
  if (res.status >= 300 && res.status < 400) return read(person, res.headers.get("location"));
  return { res, html: await res.text() };
}

async function signup(person, name, email, simulation, title, role) {
  return submit(person, "/signup", {
    name,
    email,
    password: "practice-pass",
    simulation,
    practice_title: title,
    practice_role: role,
  });
}

function csrfOf(html) {
  const match = html.match(/name="csrf" value="([^"]+)"/);
  if (!match) throw new Error("csrf missing");
  return match[1];
}

function stamp(hour) {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${now.getFullYear()}-${month}-15T${String(hour).padStart(2, "0")}:00`;
}

function pathOnly(location) {
  return String(location || "").split("?")[0];
}

function openSocket(cookie) {
  const ws = new WebSocket(`${base.replace("http", "ws")}/ws`, { headers: { Cookie: `dm=${cookie}` } });
  const messages = [];
  let waiter = null;
  ws.on("message", (buf) => {
    const msg = JSON.parse(buf.toString());
    if (waiter) {
      const next = waiter;
      waiter = null;
      next(msg);
    } else messages.push(msg);
  });
  return {
    ws,
    messages,
    ready: new Promise((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    }),
    until(type) {
      const start = Date.now();
      return new Promise((resolve, reject) => {
        const take = (msg) => {
          if (!msg) {
            reject(new Error(`missing ${type}`));
            return;
          }
          if (msg.t === type) resolve(msg);
          else if (Date.now() - start > 4000) reject(new Error(`missing ${type}`));
          else pull();
        };
        const pull = () => {
          if (messages.length) take(messages.shift());
          else {
            const timer = setTimeout(() => {
              waiter = null;
              reject(new Error(`missing ${type}`));
            }, 4000);
            waiter = (msg) => {
              clearTimeout(timer);
              take(msg);
            };
          }
        };
        pull();
      });
    },
  };
}
