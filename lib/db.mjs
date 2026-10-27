import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hashPassword, newId } from "./auth.mjs";
import { SEED } from "./copy.mjs";

const USER_FIELDS =
  "id, name, email, studio_role, simulation, practice_title, practice_role, avatar_type, address_local, created_at";

let db;

export function openDb(file) {
  if (db) db.close();
  mkdirSync(dirname(file), { recursive: true });
  db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;");
  migrate(db);
  seed(db);
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database is not open");
  return db;
}

function migrate(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      studio_role TEXT,
      simulation TEXT,
      practice_title TEXT NOT NULL DEFAULT '',
      practice_role TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      csrf TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      simulation TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (team_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      team_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      assignee_id INTEGER,
      created_by INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY,
      simulation TEXT NOT NULL,
      title TEXT NOT NULL,
      agenda TEXT NOT NULL DEFAULT '',
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meeting_members (
      meeting_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'invited',
      PRIMARY KEY (meeting_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS meeting_notes (
      id INTEGER PRIMARY KEY,
      meeting_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY,
      requester_id INTEGER NOT NULL,
      interviewer_id INTEGER,
      simulation TEXT NOT NULL,
      practice_role TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      feedback TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS interview_notes (
      id INTEGER PRIMARY KEY,
      interview_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY,
      author_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      pitch TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS idea_notes (
      id INTEGER PRIMARY KEY,
      idea_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY,
      author_id INTEGER NOT NULL,
      dataset TEXT NOT NULL,
      source_label TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data_json TEXT NOT NULL,
      shared INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS support_notes (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      display_name TEXT NOT NULL DEFAULT '',
      amount_cents INTEGER,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS data_cache (
      cache_key TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      simulation TEXT NOT NULL,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_thread ON messages (simulation, sender_id, recipient_id, id);
    CREATE TABLE IF NOT EXISTS punches (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      simulation TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE INDEX IF NOT EXISTS punches_user ON punches (user_id, simulation);
  `);
  ensureColumn(database, "users", "avatar_type", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "users", "address_local", "TEXT");
  ensureColumn(database, "meetings", "zoom_link", "TEXT NOT NULL DEFAULT ''");
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_address_local ON users (address_local) WHERE address_local IS NOT NULL",
  );
}

function ensureColumn(database, table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function seed(database) {
  const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(SEED.email);
  if (!existing) {
    database
      .prepare(
        `INSERT INTO users (name, email, password_hash, studio_role, simulation, practice_title, practice_role, avatar_type, address_local, created_at)
         VALUES (?, ?, ?, 'CEO', NULL, '', '', '', 'hanna.bridgham', ?)`,
      )
      .run(SEED.name, SEED.email, hashPassword(SEED.password), new Date().toISOString());
  }
  const missing = database
    .prepare("SELECT id, name, email FROM users WHERE address_local IS NULL OR address_local = ''")
    .all();
  for (const row of missing) {
    const preferred = row.email === SEED.email ? "hanna.bridgham" : slugPart(row.name);
    assignAddress(database, row.id, preferred);
  }
}

function slugPart(name) {
  const base = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".")
    .slice(0, 40);
  return base || "member";
}

function assignAddress(database, id, base) {
  let local = String(base || "member").slice(0, 64);
  const taken = database.prepare("SELECT id FROM users WHERE address_local = ? AND id != ?").get(local, id);
  if (taken) local = `${local}.${id}`.slice(0, 64);
  database.prepare("UPDATE users SET address_local = ? WHERE id = ?").run(local, id);
}

export function nowIso() {
  return new Date().toISOString();
}

export function createSession(userId) {
  const database = getDb();
  database.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
  const id = newId();
  const csrf = newId();
  const expires = Date.now() + 14 * 24 * 60 * 60 * 1000;
  database
    .prepare("INSERT INTO sessions (id, user_id, csrf, expires_at) VALUES (?, ?, ?, ?)")
    .run(id, userId ?? null, csrf, expires);
  return { id, user_id: userId ?? null, csrf, expires_at: expires };
}

export function readSession(sessionId) {
  if (!sessionId) return null;
  return (
    getDb()
      .prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > ?")
      .get(sessionId, Date.now()) || null
  );
}

export function deleteSession(sessionId) {
  if (!sessionId) return;
  getDb().prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
}

export function findUser(id) {
  return getDb().prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).get(id) || null;
}

export function findUserByEmail(email) {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) || null;
}

export function createUser({ name, email, passwordHash, simulation, practiceTitle, practiceRole }) {
  const database = getDb();
  const info = database
    .prepare(
      `INSERT INTO users (name, email, password_hash, studio_role, simulation, practice_title, practice_role, created_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
    )
    .run(name, email, passwordHash, simulation, practiceTitle, practiceRole, nowIso());
  const id = Number(info.lastInsertRowid);
  assignAddress(database, id, slugPart(name));
  return findUser(id);
}

function dropOtherTeams(id, simulation) {
  if (simulation) {
    getDb()
      .prepare(
        `DELETE FROM team_members
         WHERE user_id = ?
           AND team_id IN (SELECT id FROM teams WHERE simulation != ?)`,
      )
      .run(id, simulation);
    return;
  }
  getDb().prepare("DELETE FROM team_members WHERE user_id = ?").run(id);
}

export function updatePractice(id, { simulation, practiceTitle, practiceRole }) {
  const current = findUser(id);
  if (current && current.simulation !== simulation) closeOpenPunch(id);
  getDb()
    .prepare("UPDATE users SET simulation = ?, practice_title = ?, practice_role = ? WHERE id = ?")
    .run(simulation, practiceTitle, practiceRole, id);
  dropOtherTeams(id, simulation);
  return findUser(id);
}

export function setSimulation(id, simulation) {
  const current = findUser(id);
  if (!current || current.simulation === simulation) return current;
  closeOpenPunch(id);
  getDb().prepare("UPDATE users SET simulation = ? WHERE id = ?").run(simulation, id);
  dropOtherTeams(id, simulation);
  return findUser(id);
}

export function setAvatarType(userId, type) {
  getDb().prepare("UPDATE users SET avatar_type = ? WHERE id = ?").run(type, userId);
}

export function openPunch(userId) {
  return (
    getDb()
      .prepare("SELECT * FROM punches WHERE user_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1")
      .get(userId) || null
  );
}

export function closeOpenPunch(userId) {
  getDb()
    .prepare("UPDATE punches SET ended_at = ? WHERE user_id = ? AND ended_at IS NULL")
    .run(nowIso(), userId);
}

export function punchIn(userId, simulation) {
  const open = openPunch(userId);
  if (open?.simulation === simulation) return open;
  if (open) closeOpenPunch(userId);
  getDb()
    .prepare("INSERT INTO punches (user_id, simulation, started_at) VALUES (?, ?, ?)")
    .run(userId, simulation, nowIso());
  return openPunch(userId);
}

export function punchOut(userId) {
  closeOpenPunch(userId);
}

export function practiceMillis(userId, simulation) {
  if (!simulation) return 0;
  const rows = getDb()
    .prepare("SELECT started_at, ended_at FROM punches WHERE user_id = ? AND simulation = ?")
    .all(userId, simulation);
  const now = Date.now();
  let total = 0;
  for (const row of rows) {
    const start = Date.parse(row.started_at);
    const end = row.ended_at ? Date.parse(row.ended_at) : now;
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) total += end - start;
  }
  return total;
}

export function listUsers() {
  return getDb().prepare(`SELECT ${USER_FIELDS} FROM users ORDER BY name COLLATE NOCASE`).all();
}

export function listBySimulation(simulation) {
  return getDb()
    .prepare(`SELECT ${USER_FIELDS} FROM users WHERE simulation = ? ORDER BY name COLLATE NOCASE`)
    .all(simulation);
}

export function createTeam({ name, simulation, createdBy }) {
  const database = getDb();
  database.exec("BEGIN");
  try {
    const info = database
      .prepare("INSERT INTO teams (name, simulation, created_by, created_at) VALUES (?, ?, ?, ?)")
      .run(name, simulation, createdBy, nowIso());
    const id = Number(info.lastInsertRowid);
    database.prepare("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)").run(id, createdBy);
    database.exec("COMMIT");
    return id;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function listTeamsFor(userId) {
  return getDb()
    .prepare(
      `SELECT teams.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = teams.id) AS member_count
       FROM teams
       JOIN team_members mine ON mine.team_id = teams.id AND mine.user_id = ?
       ORDER BY teams.id DESC`,
    )
    .all(userId);
}

export function getTeam(id) {
  return getDb().prepare("SELECT * FROM teams WHERE id = ?").get(id) || null;
}

export function teamMembers(teamId) {
  return getDb()
    .prepare(
      `SELECT ${USER_FIELDS.split(", ").map((field) => `users.${field}`).join(", ")}
       FROM team_members
       JOIN users ON users.id = team_members.user_id
       WHERE team_members.team_id = ?
       ORDER BY users.name COLLATE NOCASE`,
    )
    .all(teamId);
}

export function isTeamMember(teamId, userId) {
  return Boolean(
    getDb().prepare("SELECT 1 AS ok FROM team_members WHERE team_id = ? AND user_id = ?").get(teamId, userId),
  );
}

export function addTeamMember(teamId, userId) {
  getDb()
    .prepare("INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)")
    .run(teamId, userId);
}

export function leaveTeam(teamId, userId) {
  const database = getDb();
  database.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(teamId, userId);
  const left = database.prepare("SELECT COUNT(*) AS n FROM team_members WHERE team_id = ?").get(teamId);
  if (left.n === 0) {
    database.prepare("DELETE FROM tasks WHERE team_id = ?").run(teamId);
    database.prepare("DELETE FROM teams WHERE id = ?").run(teamId);
  }
}

export function createTask({ teamId, title, detail, assigneeId, createdBy }) {
  const info = getDb()
    .prepare(
      `INSERT INTO tasks (team_id, title, detail, assignee_id, created_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(teamId, title, detail, assigneeId, createdBy, nowIso());
  return Number(info.lastInsertRowid);
}

export function getTask(id) {
  return (
    getDb()
      .prepare(
        `SELECT tasks.*, teams.simulation, teams.name AS team_name
         FROM tasks JOIN teams ON teams.id = tasks.team_id
         WHERE tasks.id = ?`,
      )
      .get(id) || null
  );
}

export function setTaskStatus(id, status) {
  getDb().prepare("UPDATE tasks SET status = ? WHERE id = ?").run(status, id);
}

export function listTasksForTeam(teamId) {
  return getDb()
    .prepare(
      `SELECT tasks.*, users.name AS assignee_name
       FROM tasks
       LEFT JOIN users ON users.id = tasks.assignee_id
       WHERE tasks.team_id = ?
       ORDER BY tasks.status = 'done', tasks.id DESC`,
    )
    .all(teamId);
}

export function listTasksForUser(userId) {
  return getDb()
    .prepare(
      `SELECT tasks.*, teams.name AS team_name, teams.simulation, users.name AS assignee_name
       FROM tasks
       JOIN teams ON teams.id = tasks.team_id
       JOIN team_members mine ON mine.team_id = teams.id AND mine.user_id = ?
       LEFT JOIN users ON users.id = tasks.assignee_id
       ORDER BY tasks.status = 'done', tasks.id DESC
       LIMIT 40`,
    )
    .all(userId);
}

export function createMeeting({ simulation, title, agenda, zoomLink, startsAt, endsAt, createdBy, inviteIds }) {
  const database = getDb();
  database.exec("BEGIN");
  try {
    const info = database
      .prepare(
        `INSERT INTO meetings (simulation, title, agenda, zoom_link, starts_at, ends_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(simulation, title, agenda, zoomLink || "", startsAt, endsAt, createdBy, nowIso());
    const id = Number(info.lastInsertRowid);
    database
      .prepare("INSERT INTO meeting_members (meeting_id, user_id, state) VALUES (?, ?, 'joined')")
      .run(id, createdBy);
    const invite = database.prepare(
      "INSERT OR IGNORE INTO meeting_members (meeting_id, user_id, state) VALUES (?, ?, 'invited')",
    );
    for (const memberId of inviteIds) {
      if (memberId !== createdBy) invite.run(id, memberId);
    }
    database.exec("COMMIT");
    return id;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getMeeting(id) {
  return getDb().prepare("SELECT * FROM meetings WHERE id = ?").get(id) || null;
}

export function listMeetingsForMonth(simulation, monthPrefix) {
  if (!simulation) return [];
  return getDb()
    .prepare(
      "SELECT * FROM meetings WHERE simulation = ? AND starts_at LIKE ? ORDER BY starts_at",
    )
    .all(simulation, `${monthPrefix}%`);
}

export function listJoinedOtherMeetings(userId, simulation, monthPrefix) {
  return getDb()
    .prepare(
      `SELECT meetings.* FROM meetings
       JOIN meeting_members mm ON mm.meeting_id = meetings.id AND mm.user_id = ?
       WHERE meetings.simulation != ? AND meetings.starts_at LIKE ?
       ORDER BY meetings.starts_at`,
    )
    .all(userId, simulation || "", `${monthPrefix}%`);
}

export function upcomingMeetings(userId, simulation, wallNow) {
  const mine = getDb()
    .prepare(
      `SELECT meetings.*, mm.state FROM meetings
       JOIN meeting_members mm ON mm.meeting_id = meetings.id AND mm.user_id = ?
       WHERE meetings.ends_at >= ?
       ORDER BY meetings.starts_at
       LIMIT 12`,
    )
    .all(userId, wallNow);
  const floor = simulation
    ? getDb()
        .prepare(
          `SELECT * FROM meetings
           WHERE simulation = ? AND ends_at >= ?
           ORDER BY starts_at
           LIMIT 12`,
        )
        .all(simulation, wallNow)
    : [];
  return { mine, floor };
}

export function meetingMembers(meetingId) {
  return getDb()
    .prepare(
      `SELECT users.id, users.name, users.practice_title, users.practice_role, users.studio_role, users.simulation, mm.state
       FROM meeting_members mm
       JOIN users ON users.id = mm.user_id
       WHERE mm.meeting_id = ?
       ORDER BY users.name COLLATE NOCASE`,
    )
    .all(meetingId);
}

export function meetingMembership(meetingId, userId) {
  return (
    getDb()
      .prepare("SELECT state FROM meeting_members WHERE meeting_id = ? AND user_id = ?")
      .get(meetingId, userId) || null
  );
}

export function joinMeeting(meetingId, userId) {
  getDb()
    .prepare(
      `INSERT INTO meeting_members (meeting_id, user_id, state) VALUES (?, ?, 'joined')
       ON CONFLICT(meeting_id, user_id) DO UPDATE SET state = 'joined'`,
    )
    .run(meetingId, userId);
}

export function addMeetingNote(meetingId, authorId, body) {
  getDb()
    .prepare("INSERT INTO meeting_notes (meeting_id, author_id, body, created_at) VALUES (?, ?, ?, ?)")
    .run(meetingId, authorId, body, nowIso());
}

export function meetingNotes(meetingId) {
  return getDb()
    .prepare(
      `SELECT meeting_notes.*, users.name AS author_name
       FROM meeting_notes JOIN users ON users.id = meeting_notes.author_id
       WHERE meeting_id = ?
       ORDER BY meeting_notes.id`,
    )
    .all(meetingId);
}

export function createInterview({ requesterId, simulation, practiceRole, note }) {
  const info = getDb()
    .prepare(
      `INSERT INTO interviews (requester_id, simulation, practice_role, note, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`,
    )
    .run(requesterId, simulation, practiceRole, note, nowIso());
  return Number(info.lastInsertRowid);
}

export function listInterviews() {
  return getDb()
    .prepare(
      `SELECT interviews.*, requester.name AS requester_name, interviewer.name AS interviewer_name
       FROM interviews
       JOIN users requester ON requester.id = interviews.requester_id
       LEFT JOIN users interviewer ON interviewer.id = interviews.interviewer_id
       ORDER BY interviews.id DESC
       LIMIT 100`,
    )
    .all();
}

export function getInterview(id) {
  return (
    getDb()
      .prepare(
        `SELECT interviews.*, requester.name AS requester_name, interviewer.name AS interviewer_name
         FROM interviews
         JOIN users requester ON requester.id = interviews.requester_id
         LEFT JOIN users interviewer ON interviewer.id = interviews.interviewer_id
         WHERE interviews.id = ?`,
      )
      .get(id) || null
  );
}

export function claimInterview(id, interviewerId) {
  const info = getDb()
    .prepare(
      `UPDATE interviews
       SET interviewer_id = ?, status = 'running'
       WHERE id = ? AND status = 'open' AND requester_id != ?`,
    )
    .run(interviewerId, id, interviewerId);
  return info.changes === 1;
}

export function addInterviewNote(interviewId, authorId, body) {
  getDb()
    .prepare(
      "INSERT INTO interview_notes (interview_id, author_id, body, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(interviewId, authorId, body, nowIso());
}

export function interviewNotes(interviewId) {
  return getDb()
    .prepare(
      `SELECT interview_notes.*, users.name AS author_name
       FROM interview_notes JOIN users ON users.id = interview_notes.author_id
       WHERE interview_id = ?
       ORDER BY interview_notes.id`,
    )
    .all(interviewId);
}

export function completeInterview(id, interviewerId, feedback) {
  const info = getDb()
    .prepare(
      `UPDATE interviews
       SET status = 'complete', feedback = ?, completed_at = ?
       WHERE id = ? AND status = 'running' AND interviewer_id = ?`,
    )
    .run(feedback, nowIso(), id, interviewerId);
  return info.changes === 1;
}

export function createIdea({ authorId, title, pitch }) {
  const info = getDb()
    .prepare("INSERT INTO ideas (author_id, title, pitch, created_at) VALUES (?, ?, ?, ?)")
    .run(authorId, title, pitch, nowIso());
  return Number(info.lastInsertRowid);
}

export function listIdeas() {
  return getDb()
    .prepare(
      `SELECT ideas.*, users.name AS author_name, users.practice_title AS author_title,
              (SELECT COUNT(*) FROM idea_notes WHERE idea_notes.idea_id = ideas.id) AS note_count
       FROM ideas JOIN users ON users.id = ideas.author_id
       ORDER BY ideas.id DESC
       LIMIT 100`,
    )
    .all();
}

export function getIdea(id) {
  return (
    getDb()
      .prepare(
        `SELECT ideas.*, users.name AS author_name, users.practice_title AS author_title
         FROM ideas JOIN users ON users.id = ideas.author_id
         WHERE ideas.id = ?`,
      )
      .get(id) || null
  );
}

export function addIdeaNote(ideaId, authorId, body) {
  getDb()
    .prepare("INSERT INTO idea_notes (idea_id, author_id, body, created_at) VALUES (?, ?, ?, ?)")
    .run(ideaId, authorId, body, nowIso());
}

export function ideaNotes(ideaId) {
  return getDb()
    .prepare(
      `SELECT idea_notes.*, users.name AS author_name
       FROM idea_notes JOIN users ON users.id = idea_notes.author_id
       WHERE idea_id = ?
       ORDER BY idea_notes.id`,
    )
    .all(ideaId);
}

export function createReport({ authorId, dataset, sourceLabel, title, body, dataJson }) {
  const info = getDb()
    .prepare(
      `INSERT INTO reports (author_id, dataset, source_label, title, body, data_json, shared, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(authorId, dataset, sourceLabel, title, body, dataJson, nowIso());
  return Number(info.lastInsertRowid);
}

export function listVisibleReports(userId) {
  return getDb()
    .prepare(
      `SELECT reports.id, reports.title, reports.dataset, reports.source_label, reports.shared, reports.created_at,
              users.name AS author_name
       FROM reports JOIN users ON users.id = reports.author_id
       WHERE reports.shared = 1 OR reports.author_id = ?
       ORDER BY reports.id DESC
       LIMIT 100`,
    )
    .all(userId);
}

export function getReport(id) {
  return (
    getDb()
      .prepare(
        `SELECT reports.*, users.name AS author_name
         FROM reports JOIN users ON users.id = reports.author_id
         WHERE reports.id = ?`,
      )
      .get(id) || null
  );
}

export function setReportShared(id, authorId, shared) {
  const info = getDb()
    .prepare("UPDATE reports SET shared = ? WHERE id = ? AND author_id = ?")
    .run(shared ? 1 : 0, id, authorId);
  return info.changes === 1;
}

export function addSupport({ userId, displayName, amountCents, note }) {
  getDb()
    .prepare(
      "INSERT INTO support_notes (user_id, display_name, amount_cents, note, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(userId ?? null, displayName, amountCents, note, nowIso());
}

export function listSupport() {
  return getDb()
    .prepare(
      `SELECT support_notes.*, users.name AS member_name
       FROM support_notes
       LEFT JOIN users ON users.id = support_notes.user_id
       ORDER BY support_notes.id DESC
       LIMIT 20`,
    )
    .all();
}

export function cacheGet(key, maxAgeMs) {
  const row = getDb().prepare("SELECT json, fetched_at FROM data_cache WHERE cache_key = ?").get(key);
  if (!row) return null;
  if (Date.now() - row.fetched_at > maxAgeMs) return null;
  return JSON.parse(row.json);
}

export function cacheSet(key, value) {
  getDb()
    .prepare(
      `INSERT INTO data_cache (cache_key, json, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET json = excluded.json, fetched_at = excluded.fetched_at`,
    )
    .run(key, JSON.stringify(value), Date.now());
}

export function userName(id) {
  const row = getDb().prepare("SELECT name FROM users WHERE id = ?").get(id);
  return row ? row.name : "A member";
}

export function addMessage({ simulation, senderId, recipientId, body }) {
  const info = getDb()
    .prepare(
      `INSERT INTO messages (simulation, sender_id, recipient_id, body, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(simulation, senderId, recipientId, body, nowIso());
  return Number(info.lastInsertRowid);
}

export function listMessages(simulation, userId, otherId) {
  return getDb()
    .prepare(
      `SELECT messages.id, messages.sender_id, messages.recipient_id, messages.body, messages.created_at,
              users.name AS sender_name
       FROM messages
       JOIN users ON users.id = messages.sender_id
       WHERE messages.simulation = ?
         AND ((messages.sender_id = ? AND messages.recipient_id = ?)
           OR (messages.sender_id = ? AND messages.recipient_id = ?))
       ORDER BY messages.id DESC
       LIMIT 80`,
    )
    .all(simulation, userId, otherId, otherId, userId)
    .reverse();
}

export function listChatPeers(userId, simulation) {
  if (!simulation) return [];
  return getDb()
    .prepare(
      `SELECT users.id, users.name, users.practice_title, users.practice_role, users.studio_role, users.simulation,
         (
           SELECT body FROM messages
           WHERE simulation = ?
             AND ((sender_id = ? AND recipient_id = users.id) OR (sender_id = users.id AND recipient_id = ?))
           ORDER BY id DESC
           LIMIT 1
         ) AS last_body
       FROM users
       WHERE users.simulation = ? AND users.id != ?
       ORDER BY (
         SELECT id FROM messages
         WHERE simulation = ?
           AND ((sender_id = ? AND recipient_id = users.id) OR (sender_id = users.id AND recipient_id = ?))
         ORDER BY id DESC
         LIMIT 1
       ) DESC,
       users.name COLLATE NOCASE`,
    )
    .all(simulation, userId, userId, simulation, userId, simulation, userId, userId);
}

export function practiceCallAllowed(a, b) {
  const left = findUser(a);
  const right = findUser(b);
  if (!left || !right) return false;
  if (left.simulation && left.simulation === right.simulation) return true;
  const interview = getDb()
    .prepare(
      `SELECT id FROM interviews
       WHERE status IN ('running', 'complete')
         AND ((requester_id = ? AND interviewer_id = ?) OR (requester_id = ? AND interviewer_id = ?))
       LIMIT 1`,
    )
    .get(a, b, b, a);
  return Boolean(interview);
}
