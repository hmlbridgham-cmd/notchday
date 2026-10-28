import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canChangeCompany, memberSims, sharesCompany } from "./access.mjs";
import { hashPassword, newId } from "./auth.mjs";
import { SEED } from "./copy.mjs";

const USER_FIELDS =
  "id, name, email, studio_role, simulation, practice_title, practice_role, avatar_type, address_local, membership, created_at";

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
    CREATE TABLE IF NOT EXISTS room_messages (
      id INTEGER PRIMARY KEY,
      simulation TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS room_messages_sim ON room_messages (simulation, id);
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      simulation TEXT NOT NULL,
      working INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS idea_votes (
      idea_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (idea_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS shared_files (
      id INTEGER PRIMARY KEY,
      simulation TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY,
      from_user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      about_user_id INTEGER,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rivalries (
      left_sim TEXT NOT NULL,
      right_sim TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (left_sim, right_sim)
    );
    CREATE TABLE IF NOT EXISTS sim_groups (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      simulation TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sim_group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY (group_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY,
      group_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      brief TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_tasks (
      id INTEGER PRIMARY KEY,
      group_id INTEGER NOT NULL,
      mission_id INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contests (
      id INTEGER PRIMARY KEY,
      simulation TEXT NOT NULL,
      title TEXT NOT NULL,
      brief TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS contest_entries (
      id INTEGER PRIMARY KEY,
      contest_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (contest_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS openings (
      id INTEGER PRIMARY KEY,
      group_id INTEGER NOT NULL,
      poster_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      ask TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS opening_applications (
      id INTEGER PRIMARY KEY,
      opening_id INTEGER NOT NULL,
      applicant_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (opening_id, applicant_id)
    );
    CREATE TABLE IF NOT EXISTS opening_interviews (
      id INTEGER PRIMARY KEY,
      opening_id INTEGER NOT NULL,
      applicant_id INTEGER NOT NULL,
      poster_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      created_at TEXT NOT NULL,
      UNIQUE (opening_id, applicant_id)
    );
    CREATE TABLE IF NOT EXISTS opening_interview_notes (
      id INTEGER PRIMARY KEY,
      interview_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  ensureColumn(database, "users", "avatar_type", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(database, "users", "address_local", "TEXT");
  ensureColumn(database, "users", "membership", "TEXT NOT NULL DEFAULT 'one'");
  ensureColumn(database, "meetings", "zoom_link", "TEXT NOT NULL DEFAULT ''");
  database.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_address_local ON users (address_local) WHERE address_local IS NOT NULL",
  );
  renameCompanies(database);
}

function renameCompanies(database) {
  const pairs = [
    ["copperline", "yapmark"],
    ["kindling", "flinttable"],
    ["quarry", "chartslate"],
  ];
  const tables = ["users", "teams", "meetings", "interviews", "messages", "punches"];
  for (const table of tables) {
    for (const [from, to] of pairs) {
      database.prepare(`UPDATE ${table} SET simulation = ? WHERE simulation = ?`).run(to, from);
    }
  }
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
  database.prepare("UPDATE users SET studio_role = NULL WHERE studio_role = 'CEO' AND email != ?").run(SEED.email);
  database.prepare("UPDATE users SET studio_role = 'CEO' WHERE email = ?").run(SEED.email);
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
  if (!current) return null;
  const nextSim = canChangeCompany(current) ? simulation : current.simulation;
  if (current.simulation !== nextSim) closeOpenPunch(id);
  getDb()
    .prepare("UPDATE users SET simulation = ?, practice_title = ?, practice_role = ? WHERE id = ?")
    .run(nextSim, practiceTitle, practiceRole, id);
  dropOtherTeams(id, nextSim);
  return findUser(id);
}

export function setSimulation(id, simulation) {
  const current = findUser(id);
  if (!current || current.simulation === simulation || !canChangeCompany(current)) return current;
  closeOpenPunch(id);
  getDb().prepare("UPDATE users SET simulation = ? WHERE id = ?").run(simulation, id);
  dropOtherTeams(id, simulation);
  return findUser(id);
}

export function setMembership(id, membership) {
  if (membership !== "all" && membership !== "one") return findUser(id);
  getDb().prepare("UPDATE users SET membership = ? WHERE id = ?").run(membership, id);
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

export function listCompany(simulation) {
  return getDb()
    .prepare(
      `SELECT ${USER_FIELDS} FROM users
       WHERE simulation = ? OR membership = 'all' OR email = ?
       ORDER BY name COLLATE NOCASE`,
    )
    .all(simulation, SEED.email);
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
              (SELECT COUNT(*) FROM idea_notes WHERE idea_notes.idea_id = ideas.id) AS note_count,
              (SELECT COUNT(*) FROM idea_votes WHERE idea_votes.idea_id = ideas.id) AS vote_count
       FROM ideas JOIN users ON users.id = ideas.author_id
       ORDER BY vote_count DESC, ideas.id DESC
       LIMIT 100`,
    )
    .all();
}

export function getIdea(id) {
  return (
    getDb()
      .prepare(
        `SELECT ideas.*, users.name AS author_name, users.practice_title AS author_title,
                (SELECT COUNT(*) FROM idea_votes WHERE idea_votes.idea_id = ideas.id) AS vote_count
         FROM ideas JOIN users ON users.id = ideas.author_id
         WHERE ideas.id = ?`,
      )
      .get(id) || null
  );
}

export function userVoted(ideaId, userId) {
  return Boolean(
    getDb().prepare("SELECT 1 AS ok FROM idea_votes WHERE idea_id = ? AND user_id = ?").get(ideaId, userId),
  );
}

export function toggleVote(ideaId, userId) {
  const database = getDb();
  const existing = database.prepare("SELECT 1 AS ok FROM idea_votes WHERE idea_id = ? AND user_id = ?").get(ideaId, userId);
  if (existing) {
    database.prepare("DELETE FROM idea_votes WHERE idea_id = ? AND user_id = ?").run(ideaId, userId);
    return false;
  }
  database.prepare("INSERT INTO idea_votes (idea_id, user_id, created_at) VALUES (?, ?, ?)").run(ideaId, userId, nowIso());
  return true;
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

export function listMessages(userId, otherId) {
  return getDb()
    .prepare(
      `SELECT messages.id, messages.sender_id, messages.recipient_id, messages.body, messages.created_at,
              users.name AS sender_name
       FROM messages
       JOIN users ON users.id = messages.sender_id
       WHERE (messages.sender_id = ? AND messages.recipient_id = ?)
          OR (messages.sender_id = ? AND messages.recipient_id = ?)
       ORDER BY messages.id DESC
       LIMIT 80`,
    )
    .all(userId, otherId, otherId, userId)
    .reverse();
}

export function listChatPeers(userId) {
  const me = findUser(userId);
  if (!me) return [];
  const lastBody = getDb().prepare(
    `SELECT body, id FROM messages
     WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
     ORDER BY id DESC LIMIT 1`,
  );
  return listUsers()
    .filter((person) => sharesCompany(me, person))
    .map((person) => {
      const last = lastBody.get(userId, person.id, person.id, userId);
      return { ...person, last_body: last?.body || "", last_id: last?.id || 0 };
    })
    .sort((a, b) => b.last_id - a.last_id || a.name.localeCompare(b.name));
}

export function practiceCallAllowed(a, b) {
  const left = findUser(a);
  const right = findUser(b);
  if (!left || !right) return false;
  if (sharesCompany(left, right)) return true;
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

export function addRoomMessage({ simulation, userId, body }) {
  const info = getDb()
    .prepare("INSERT INTO room_messages (simulation, user_id, body, created_at) VALUES (?, ?, ?, ?)")
    .run(simulation, userId, body, nowIso());
  return Number(info.lastInsertRowid);
}

export function listRoomMessages(simulation) {
  return getDb()
    .prepare(
      `SELECT room_messages.*, users.name AS sender_name
       FROM room_messages JOIN users ON users.id = room_messages.user_id
       WHERE room_messages.simulation = ?
       ORDER BY room_messages.id DESC
       LIMIT 80`,
    )
    .all(simulation)
    .reverse();
}

export function addCheckin({ userId, simulation, working, body }) {
  const info = getDb()
    .prepare("INSERT INTO checkins (user_id, simulation, working, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(userId, simulation, working ? 1 : 0, body, nowIso());
  return Number(info.lastInsertRowid);
}

export function latestCheckins(simulation) {
  return getDb()
    .prepare(
      `SELECT checkins.*, users.name AS author_name
       FROM checkins JOIN users ON users.id = checkins.user_id
       WHERE checkins.simulation = ?
         AND checkins.id IN (SELECT MAX(id) FROM checkins WHERE simulation = ? GROUP BY user_id)
       ORDER BY checkins.id DESC`,
    )
    .all(simulation, simulation);
}

export function addSharedFile({ simulation, userId, name, mime, bytes }) {
  const info = getDb()
    .prepare(
      "INSERT INTO shared_files (simulation, user_id, name, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(simulation, userId, name, mime, bytes, nowIso());
  return Number(info.lastInsertRowid);
}

export function listFiles(simulation) {
  return getDb()
    .prepare(
      `SELECT shared_files.*, users.name AS author_name
       FROM shared_files JOIN users ON users.id = shared_files.user_id
       WHERE shared_files.simulation = ?
       ORDER BY shared_files.id DESC
       LIMIT 40`,
    )
    .all(simulation);
}

export function getSharedFile(id) {
  return getDb().prepare("SELECT * FROM shared_files WHERE id = ?").get(id) || null;
}

export function addComplaint({ fromUserId, kind, aboutUserId, body }) {
  const info = getDb()
    .prepare(
      "INSERT INTO complaints (from_user_id, kind, about_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(fromUserId, kind, aboutUserId || 0, body, nowIso());
  return Number(info.lastInsertRowid);
}

export function listComplaints() {
  return getDb()
    .prepare(
      `SELECT complaints.*, users.name AS from_name, about.name AS about_name
       FROM complaints
       JOIN users ON users.id = complaints.from_user_id
       LEFT JOIN users about ON about.id = complaints.about_user_id
       ORDER BY complaints.id DESC
       LIMIT 100`,
    )
    .all();
}

export function setRivalry(left, right) {
  const pair = [left, right].sort();
  if (pair[0] === pair[1]) return false;
  getDb()
    .prepare(
      `INSERT INTO rivalries (left_sim, right_sim, created_at) VALUES (?, ?, ?)
       ON CONFLICT(left_sim, right_sim) DO NOTHING`,
    )
    .run(pair[0], pair[1], nowIso());
  return true;
}

export function clearRivalry(left, right) {
  const pair = [left, right].sort();
  getDb().prepare("DELETE FROM rivalries WHERE left_sim = ? AND right_sim = ?").run(pair[0], pair[1]);
}

export function listRivalries() {
  return getDb().prepare("SELECT * FROM rivalries ORDER BY left_sim, right_sim").all();
}

export function activityScore(simulation) {
  const database = getDb();
  const room = database.prepare("SELECT COUNT(*) AS n FROM room_messages WHERE simulation = ?").get(simulation).n;
  const files = database.prepare("SELECT COUNT(*) AS n FROM shared_files WHERE simulation = ?").get(simulation).n;
  const checks = database.prepare("SELECT COUNT(*) AS n FROM checkins WHERE simulation = ?").get(simulation).n;
  let extra = 0;
  if (simulation === "flinttable") {
    extra += database.prepare("SELECT COUNT(*) AS n FROM ideas").get().n;
    extra += database.prepare("SELECT COUNT(*) AS n FROM idea_votes").get().n;
  }
  if (simulation === "chartslate") {
    extra += database.prepare("SELECT COUNT(*) AS n FROM reports WHERE shared = 1").get().n;
  }
  return room + files + checks + extra;
}

export function createGroup({ name, simulation, createdBy }) {
  const database = getDb();
  database.exec("BEGIN");
  try {
    const info = database
      .prepare("INSERT INTO sim_groups (name, simulation, created_by, created_at) VALUES (?, ?, ?, ?)")
      .run(name, simulation, createdBy, nowIso());
    const id = Number(info.lastInsertRowid);
    database.prepare("INSERT INTO sim_group_members (group_id, user_id) VALUES (?, ?)").run(id, createdBy);
    database.exec("COMMIT");
    return id;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function listVisibleGroups(user) {
  const sims = memberSims(user);
  if (!sims.length) return [];
  const marks = sims.map(() => "?").join(", ");
  return getDb()
    .prepare(
      `SELECT sim_groups.*,
              (SELECT COUNT(*) FROM sim_group_members m WHERE m.group_id = sim_groups.id) AS member_count,
              EXISTS(SELECT 1 FROM sim_group_members mine WHERE mine.group_id = sim_groups.id AND mine.user_id = ?) AS joined
       FROM sim_groups
       WHERE simulation IN (${marks})
       ORDER BY sim_groups.simulation, sim_groups.id DESC`,
    )
    .all(user.id, ...sims);
}

export function getGroup(id) {
  return getDb().prepare("SELECT * FROM sim_groups WHERE id = ?").get(id) || null;
}

export function groupMembers(groupId) {
  return getDb()
    .prepare(
      `SELECT ${USER_FIELDS.split(", ").map((field) => `users.${field}`).join(", ")}
       FROM sim_group_members
       JOIN users ON users.id = sim_group_members.user_id
       WHERE sim_group_members.group_id = ?
       ORDER BY users.name COLLATE NOCASE`,
    )
    .all(groupId);
}

export function isGroupMember(groupId, userId) {
  return Boolean(
    getDb().prepare("SELECT 1 AS ok FROM sim_group_members WHERE group_id = ? AND user_id = ?").get(groupId, userId),
  );
}

export function joinGroup(groupId, userId) {
  getDb().prepare("INSERT OR IGNORE INTO sim_group_members (group_id, user_id) VALUES (?, ?)").run(groupId, userId);
}

export function leaveGroup(groupId, userId) {
  getDb().prepare("DELETE FROM sim_group_members WHERE group_id = ? AND user_id = ?").run(groupId, userId);
}

export function createMission({ groupId, title, brief, createdBy }) {
  const info = getDb()
    .prepare("INSERT INTO missions (group_id, title, brief, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(groupId, title, brief, createdBy, nowIso());
  return Number(info.lastInsertRowid);
}

export function getMission(id) {
  return getDb().prepare("SELECT * FROM missions WHERE id = ?").get(id) || null;
}

export function listMissions(groupId) {
  return getDb()
    .prepare(
      `SELECT missions.*, users.name AS sender_name
       FROM missions JOIN users ON users.id = missions.created_by
       WHERE missions.group_id = ?
       ORDER BY missions.id DESC`,
    )
    .all(groupId);
}

export function createGroupTask({ groupId, missionId, title, detail, createdBy }) {
  const info = getDb()
    .prepare(
      `INSERT INTO group_tasks (group_id, mission_id, title, detail, created_by, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    )
    .run(groupId, missionId || 0, title, detail, createdBy, nowIso());
  return Number(info.lastInsertRowid);
}

export function getGroupTask(id) {
  return (
    getDb()
      .prepare(
        `SELECT group_tasks.*, sim_groups.simulation, sim_groups.name AS group_name
         FROM group_tasks JOIN sim_groups ON sim_groups.id = group_tasks.group_id
         WHERE group_tasks.id = ?`,
      )
      .get(id) || null
  );
}

export function setGroupTaskStatus(id, status) {
  getDb().prepare("UPDATE group_tasks SET status = ? WHERE id = ?").run(status, id);
}

export function listGroupTasks(groupId) {
  return getDb()
    .prepare(
      `SELECT group_tasks.*, missions.title AS mission_title, users.name AS sender_name
       FROM group_tasks
       LEFT JOIN missions ON missions.id = group_tasks.mission_id
       LEFT JOIN users ON users.id = group_tasks.created_by
       WHERE group_tasks.group_id = ?
       ORDER BY group_tasks.status = 'done', group_tasks.id DESC`,
    )
    .all(groupId);
}

export function createContest({ simulation, title, brief, createdBy }) {
  const info = getDb()
    .prepare("INSERT INTO contests (simulation, title, brief, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(simulation, title, brief, createdBy, nowIso());
  return Number(info.lastInsertRowid);
}

export function listContests(simulation) {
  return getDb()
    .prepare(
      `SELECT contests.*, users.name AS sender_name,
              (SELECT COUNT(*) FROM contest_entries e WHERE e.contest_id = contests.id) AS entry_count
       FROM contests JOIN users ON users.id = contests.created_by
       WHERE contests.simulation = ?
       ORDER BY contests.id DESC`,
    )
    .all(simulation);
}

export function listContestsFor(user) {
  const sims = memberSims(user);
  if (!sims.length) return [];
  const marks = sims.map(() => "?").join(", ");
  return getDb()
    .prepare(
      `SELECT contests.*, users.name AS sender_name,
              (SELECT COUNT(*) FROM contest_entries e WHERE e.contest_id = contests.id) AS entry_count
       FROM contests JOIN users ON users.id = contests.created_by
       WHERE contests.simulation IN (${marks})
       ORDER BY contests.id DESC`,
    )
    .all(...sims);
}

export function getContest(id) {
  return (
    getDb()
      .prepare(
        `SELECT contests.*, users.name AS sender_name
         FROM contests JOIN users ON users.id = contests.created_by
         WHERE contests.id = ?`,
      )
      .get(id) || null
  );
}

export function listContestEntries(contestId) {
  return getDb()
    .prepare(
      `SELECT contest_entries.*, users.name AS author_name
       FROM contest_entries JOIN users ON users.id = contest_entries.user_id
       WHERE contest_id = ?
       ORDER BY contest_entries.id`,
    )
    .all(contestId);
}

export function saveContestEntry({ contestId, userId, body }) {
  getDb()
    .prepare(
      `INSERT INTO contest_entries (contest_id, user_id, body, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(contest_id, user_id) DO UPDATE SET body = excluded.body, created_at = excluded.created_at`,
    )
    .run(contestId, userId, body, nowIso());
}

export function createOpening({ groupId, posterId, title, description, ask }) {
  const info = getDb()
    .prepare(
      `INSERT INTO openings (group_id, poster_id, title, description, ask, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(groupId, posterId, title, description, ask, nowIso());
  return Number(info.lastInsertRowid);
}

export function listVisibleOpenings(user) {
  const sims = memberSims(user);
  if (!sims.length) return [];
  const marks = sims.map(() => "?").join(", ");
  return getDb()
    .prepare(
      `SELECT openings.*, sim_groups.name AS group_name, sim_groups.simulation,
              users.name AS poster_name
       FROM openings
       JOIN sim_groups ON sim_groups.id = openings.group_id
       JOIN users ON users.id = openings.poster_id
       WHERE sim_groups.simulation IN (${marks})
       ORDER BY openings.id DESC`,
    )
    .all(...sims);
}

export function listOpeningsForGroup(groupId) {
  return getDb()
    .prepare(
      `SELECT openings.*, users.name AS poster_name
       FROM openings JOIN users ON users.id = openings.poster_id
       WHERE openings.group_id = ?
       ORDER BY openings.id DESC`,
    )
    .all(groupId);
}

export function getOpening(id) {
  return (
    getDb()
      .prepare(
        `SELECT openings.*, sim_groups.name AS group_name, sim_groups.simulation,
                users.name AS poster_name, users.email AS poster_email, users.studio_role,
                users.practice_title, users.practice_role, users.avatar_type, users.membership,
                users.simulation AS poster_simulation
         FROM openings
         JOIN sim_groups ON sim_groups.id = openings.group_id
         JOIN users ON users.id = openings.poster_id
         WHERE openings.id = ?`,
      )
      .get(id) || null
  );
}

export function saveApplication({ openingId, applicantId, body }) {
  getDb()
    .prepare(
      `INSERT INTO opening_applications (opening_id, applicant_id, body, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(opening_id, applicant_id) DO UPDATE SET body = excluded.body, created_at = excluded.created_at`,
    )
    .run(openingId, applicantId, body, nowIso());
}

export function listApplications(openingId) {
  return getDb()
    .prepare(
      `SELECT opening_applications.*, users.name AS applicant_name,
              opening_interviews.id AS interview_id
       FROM opening_applications
       JOIN users ON users.id = opening_applications.applicant_id
       LEFT JOIN opening_interviews
         ON opening_interviews.opening_id = opening_applications.opening_id
        AND opening_interviews.applicant_id = opening_applications.applicant_id
       WHERE opening_applications.opening_id = ?
       ORDER BY opening_applications.id`,
    )
    .all(openingId);
}

export function getApplication(openingId, applicantId) {
  return (
    getDb()
      .prepare("SELECT * FROM opening_applications WHERE opening_id = ? AND applicant_id = ?")
      .get(openingId, applicantId) || null
  );
}

export function createOpeningInterview({ openingId, applicantId, posterId }) {
  const existing = getDb()
    .prepare("SELECT id FROM opening_interviews WHERE opening_id = ? AND applicant_id = ?")
    .get(openingId, applicantId);
  if (existing) return Number(existing.id);
  const info = getDb()
    .prepare(
      `INSERT INTO opening_interviews (opening_id, applicant_id, poster_id, status, created_at)
       VALUES (?, ?, ?, 'running', ?)`,
    )
    .run(openingId, applicantId, posterId, nowIso());
  return Number(info.lastInsertRowid);
}

export function getOpeningInterview(id) {
  return getDb().prepare("SELECT * FROM opening_interviews WHERE id = ?").get(id) || null;
}

export function addOpeningInterviewNote(interviewId, authorId, body) {
  getDb()
    .prepare(
      "INSERT INTO opening_interview_notes (interview_id, author_id, body, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(interviewId, authorId, body, nowIso());
}

export function openingInterviewNotes(interviewId) {
  return getDb()
    .prepare(
      `SELECT opening_interview_notes.*, users.name AS author_name
       FROM opening_interview_notes JOIN users ON users.id = opening_interview_notes.author_id
       WHERE interview_id = ?
       ORDER BY opening_interview_notes.id`,
    )
    .all(interviewId);
}
