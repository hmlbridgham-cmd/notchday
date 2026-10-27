import { WebSocketServer } from "ws";
import { parseCookies } from "./auth.mjs";
import { findUser, getMeeting, meetingMembership, practiceCallAllowed, readSession, userName } from "./db.mjs";

const sockets = new Map();
const rooms = new Map();
const userRooms = new Map();

export function attachSignal(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws, req) => {
    const cookies = parseCookies(req.headers.cookie || "");
    const session = readSession(cookies.dm);
    if (!session?.user_id) {
      ws.close(4001, "Sign in required");
      return;
    }
    const userId = session.user_id;
    const previous = sockets.get(userId);
    if (previous && previous !== ws) {
      safeSend(previous, { t: "replaced" });
      previous.close();
    }
    sockets.set(userId, ws);
    ws.userId = userId;
    broadcastOnline();

    ws.on("message", (buf) => {
      if (buf.length > 200_000) return;
      let msg;
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      handle(ws, msg);
    });

    ws.on("close", () => {
      if (sockets.get(userId) === ws) sockets.delete(userId);
      for (const meetingId of userRooms.get(userId) || []) leaveRoom(userId, meetingId);
      userRooms.delete(userId);
      broadcastOnline();
    });
  });
  return wss;
}

function handle(ws, msg) {
  const type = msg.t;
  if (type === "room-join") return joinRoom(ws, Number(msg.meetingId));
  if (type === "room-leave") return leaveRoom(ws.userId, Number(msg.meetingId));
  if (["ring", "accept", "decline", "offer", "answer", "ice", "hangup"].includes(type)) {
    relay(ws, msg, type);
  }
}

export function notifyUser(userId, payload) {
  safeSend(sockets.get(userId), payload);
}

function relay(ws, msg, type) {
  const to = Number(msg.to);
  if (!Number.isInteger(to) || to < 1 || to === ws.userId) return;
  if (!sockets.has(to)) return;
  const meetingId = Number(msg.meetingId);
  if (Number.isInteger(meetingId) && meetingId > 0) {
    if (!canEnter(ws.userId, meetingId) || !canEnter(to, meetingId)) return;
  } else if (!practiceCallAllowed(ws.userId, to)) {
    return;
  }
  const payload = {
    t: type,
    from: ws.userId,
    fromName: userName(ws.userId),
    callId: String(msg.callId || "").slice(0, 80),
  };
  if (type === "ring" || type === "accept") payload.mode = "audio";
  if (msg.meetingId) payload.meetingId = Number(msg.meetingId);
  if (type === "offer" || type === "answer") {
    if (!msg.sdp || typeof msg.sdp.sdp !== "string" || typeof msg.sdp.type !== "string") return;
    if (msg.sdp.sdp.length > 100_000) return;
    payload.sdp = { type: msg.sdp.type, sdp: msg.sdp.sdp };
  }
  if (type === "ice") payload.candidate = msg.candidate ?? null;
  safeSend(sockets.get(to), payload);
}

function joinRoom(ws, meetingId) {
  if (!Number.isInteger(meetingId) || meetingId < 1) return;
  if (!canEnter(ws.userId, meetingId)) return;
  if (!rooms.has(meetingId)) rooms.set(meetingId, new Set());
  const room = rooms.get(meetingId);
  const existing = [...room].filter((id) => id !== ws.userId);
  room.add(ws.userId);
  const mine = userRooms.get(ws.userId) || new Set();
  mine.add(meetingId);
  userRooms.set(ws.userId, mine);
  safeSend(ws, { t: "room-peers", meetingId, peers: existing });
  for (const id of existing) {
    safeSend(sockets.get(id), {
      t: "room-peer-joined",
      meetingId,
      userId: ws.userId,
      name: userName(ws.userId),
    });
  }
}

function leaveRoom(userId, meetingId) {
  const room = rooms.get(meetingId);
  if (!room) return;
  room.delete(userId);
  userRooms.get(userId)?.delete(meetingId);
  for (const id of room) {
    safeSend(sockets.get(id), { t: "room-peer-left", meetingId, userId });
  }
  if (room.size === 0) rooms.delete(meetingId);
}

function canEnter(userId, meetingId) {
  const meeting = getMeeting(meetingId);
  if (!meeting) return false;
  const user = findUser(userId);
  if (!user) return false;
  if (user.simulation === meeting.simulation) return true;
  return Boolean(meetingMembership(meetingId, userId));
}

function broadcastOnline() {
  const ids = [...sockets.keys()];
  for (const socket of sockets.values()) safeSend(socket, { t: "online", ids });
}

function safeSend(socket, payload) {
  if (!socket || socket.readyState !== 1) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // The socket is already closing.
  }
}
