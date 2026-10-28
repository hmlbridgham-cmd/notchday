const root = document.querySelector("#call-app");
if (root) startCall(root);

function startCall(root) {
  const me = Number(root.dataset.me);
  const kind = root.dataset.kind;
  const meetingId = Number(root.dataset.meeting || 0);
  const names = readNames();
  const status = document.querySelector("#call-status");
  const stage = document.querySelector("#call-stage");
  const incoming = document.querySelector("#incoming");
  const localVideo = document.querySelector("#local-video");
  const remoteVideo = document.querySelector("#remote-video");
  const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

  let socket;
  let state = "idle";
  let callId = "";
  let partner = 0;
  let partnerName = "";
  let mode = "audio";
  let pc = null;
  let localStream = null;
  let pendingIce = [];
  let queuedOffer = null;
  const peers = new Map();

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener("message", (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    handle(msg);
  });
  socket.addEventListener("close", () => setStatus("The simulation line disconnected."));

  root.addEventListener("click", (event) => {
    const ring = event.target.closest("[data-ring]");
    if (ring && !ring.disabled) beginRing(ring.dataset.ring, Number(ring.closest("[data-user]")?.dataset.user || root.dataset.user));
  });
  document.querySelector("#accept")?.addEventListener("click", acceptIncoming);
  document.querySelector("#decline")?.addEventListener("click", declineIncoming);
  document.querySelector("#hangup")?.addEventListener("click", hangup);
  document.querySelector("#join-room")?.addEventListener("click", joinRoom);

  function beginRing(_nextMode, userId) {
    if (!userId || state !== "idle") return;
    mode = "audio";
    partner = userId;
    callId = crypto.randomUUID();
    state = "outgoing";
    setStatus(`Ringing ${nameOf(userId)} for a simulation phone call.`);
    send({ t: "ring", to: partner, callId, mode });
  }

  async function acceptIncoming() {
    if (state !== "incoming") return;
    state = "connecting";
    send({ t: "accept", to: partner, callId, mode });
    incoming.hidden = true;
    try {
      await ensureMedia();
    } catch (error) {
      send({ t: "hangup", to: partner, callId });
      failMedia(error);
      return;
    }
    if (queuedOffer) {
      const offer = queuedOffer;
      queuedOffer = null;
      await takeOffer(offer);
    }
  }

  function declineIncoming() {
    if (state !== "incoming") return;
    send({ t: "decline", to: partner, callId });
    reset();
    setStatus("You declined the simulation call.");
  }

  function hangup() {
    if (kind === "room") {
      send({ t: "room-leave", meetingId });
      closeRoom();
      setStatus("You left the simulation call.");
      return;
    }
    if (partner && callId) send({ t: "hangup", to: partner, callId });
    reset();
    setStatus("Practice call ended.");
  }

  async function joinRoom() {
    try {
      await ensureMedia();
    } catch (error) {
      failMedia(error);
      return;
    }
    stage.hidden = false;
    stage.classList.add("is-audio");
    send({ t: "room-join", meetingId });
    setStatus("Joining the simulation call.");
  }

  async function handle(msg) {
    if (msg.t === "online") return applyOnline(msg.ids || []);
    if (msg.t === "replaced") return setStatus("This simulation line is open in another tab.");
    if (msg.t === "chat") return onChat(msg);
    if (kind === "room") return handleRoom(msg);
    if (msg.t === "ring") return onRing(msg);
    if (msg.t === "accept" && msg.callId === callId) return onAccepted();
    if (msg.t === "decline" && msg.callId === callId) {
      reset();
      setStatus(`${msg.fromName || "The other member"} declined the simulation call.`);
      return;
    }
    if (msg.t === "offer" && msg.callId === callId) return takeOffer(msg);
    if (msg.t === "answer" && msg.callId === callId && pc) {
      await pc.setRemoteDescription(msg.sdp);
      await flushIce(pc);
      return;
    }
    if (msg.t === "ice" && msg.callId === callId) return addIce(pc, msg.candidate);
    if (msg.t === "hangup" && msg.callId === callId) {
      reset();
      setStatus("The other member ended the simulation call.");
    }
  }

  function onRing(msg) {
    if (state !== "idle") {
      send({ t: "decline", to: msg.from, callId: msg.callId });
      return;
    }
    state = "incoming";
    partner = msg.from;
    partnerName = msg.fromName || "";
    callId = msg.callId;
    mode = "audio";
    const label = document.querySelector("#incoming-label");
    if (label) label.textContent = `Practice phone call from ${msg.fromName || nameOf(msg.from)}.`;
    if (incoming) incoming.hidden = false;
    openDock();
    setStatus("Incoming simulation call.");
  }

  function onChat(msg) {
    const thread = document.querySelector("#chat-thread");
    if (thread && Number(thread.dataset.with) === Number(msg.with)) {
      refreshThread(thread);
      return;
    }
    const ping = document.querySelector("#chat-ping");
    if (!ping) return;
    const link = document.createElement("a");
    link.href = `/chats/${Number(msg.with) || ""}`;
    link.textContent = `New simulation message from ${msg.fromName || "a member"}.`;
    ping.replaceChildren(link);
    ping.hidden = false;
    openDock();
  }

  async function refreshThread(node) {
    try {
      const response = await fetch(node.getAttribute("data-live"), { headers: { Accept: "text/html" } });
      if (!response.ok) return;
      const html = await response.text();
      if (html && html !== node.innerHTML) node.innerHTML = html;
    } catch {
      // The next poll can try again.
    }
  }

  async function onAccepted() {
    if (state !== "outgoing") return;
    state = "connecting";
    try {
      await ensureMedia();
    } catch (error) {
      send({ t: "hangup", to: partner, callId });
      failMedia(error);
      return;
    }
    pc = makePc(partner);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ t: "offer", to: partner, callId, sdp: pc.localDescription });
    showStage();
  }

  async function takeOffer(msg) {
    if (!localStream) {
      queuedOffer = msg;
      return;
    }
    pc = makePc(msg.from);
    await pc.setRemoteDescription(msg.sdp);
    await flushIce(pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ t: "answer", to: msg.from, callId, sdp: pc.localDescription });
    showStage();
  }

  async function handleRoom(msg) {
    if (msg.meetingId && Number(msg.meetingId) !== meetingId) return;
    if (msg.t === "room-peers") {
      for (const id of msg.peers || []) await offerTo(id);
      setStatus("Practice call open.");
    }
    if (msg.t === "offer") await answerRoom(msg);
    if (msg.t === "answer") {
      const conn = peers.get(msg.from);
      if (!conn) return;
      await conn.setRemoteDescription(msg.sdp);
    }
    if (msg.t === "ice") {
      const conn = peers.get(msg.from);
      if (conn && msg.candidate) await conn.addIceCandidate(msg.candidate).catch(() => {});
    }
    if (msg.t === "room-peer-left") dropPeer(msg.userId);
  }

  async function offerTo(id) {
    const conn = roomPeer(id);
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    send({ t: "offer", to: id, meetingId, callId: roomKey(id), sdp: conn.localDescription });
  }

  async function answerRoom(msg) {
    const conn = roomPeer(msg.from);
    await conn.setRemoteDescription(msg.sdp);
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);
    send({ t: "answer", to: msg.from, meetingId, callId: msg.callId, sdp: conn.localDescription });
  }

  function roomPeer(id) {
    if (peers.has(id)) return peers.get(id);
    const conn = new RTCPeerConnection({ iceServers });
    peers.set(id, conn);
    for (const track of localStream.getTracks()) conn.addTrack(track, localStream);
    conn.onicecandidate = (event) => {
      if (event.candidate) send({ t: "ice", to: id, meetingId, callId: roomKey(id), candidate: event.candidate });
    };
    conn.ontrack = (event) => {
      const video = videoFor(id);
      video.srcObject = event.streams[0];
    };
    return conn;
  }

  function videoFor(id) {
    let video = document.querySelector(`video[data-peer="${id}"]`);
    if (video) return video;
    const wrap = document.createElement("div");
    wrap.className = "peer";
    wrap.innerHTML = `<video data-peer="${id}" autoplay playsinline></video><p></p>`;
    wrap.querySelector("p").textContent = nameOf(id);
    document.querySelector("#peer-videos").appendChild(wrap);
    return wrap.querySelector("video");
  }

  function dropPeer(id) {
    const conn = peers.get(id);
    if (conn) conn.close();
    peers.delete(id);
    document.querySelector(`video[data-peer="${id}"]`)?.closest(".peer")?.remove();
  }

  function closeRoom() {
    for (const id of [...peers.keys()]) dropPeer(id);
    stopMedia();
    if (stage) stage.hidden = true;
  }

  function makePc(otherId) {
    const conn = new RTCPeerConnection({ iceServers });
    for (const track of localStream.getTracks()) conn.addTrack(track, localStream);
    conn.onicecandidate = (event) => {
      if (event.candidate) send({ t: "ice", to: otherId, callId, candidate: event.candidate });
    };
    conn.ontrack = (event) => {
      if (remoteVideo) remoteVideo.srcObject = event.streams[0];
      const label = document.querySelector("#remote-label");
      if (label) label.textContent = nameOf(otherId);
    };
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === "connected") setStatus("Connected. This is a simulation call.");
      if (conn.connectionState === "failed") setStatus("The simulation call could not connect.");
    };
    return conn;
  }

  async function ensureMedia() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    if (localVideo) localVideo.srcObject = localStream;
    return localStream;
  }

  function showStage() {
    if (!stage) return;
    stage.hidden = false;
    stage.classList.add("is-audio");
    if (incoming) incoming.hidden = true;
    openDock();
  }

  function addIce(conn, candidate) {
    if (!candidate) return;
    if (!conn || !conn.remoteDescription) pendingIce.push(candidate);
    else conn.addIceCandidate(candidate).catch(() => {});
  }

  async function flushIce(conn) {
    const waiting = pendingIce;
    pendingIce = [];
    for (const candidate of waiting) {
      try { await conn.addIceCandidate(candidate); } catch { /* ignore late candidates */ }
    }
  }

  function reset() {
    state = "idle";
    callId = "";
    partner = 0;
    queuedOffer = null;
    pendingIce = [];
    if (pc) {
      pc.close();
      pc = null;
    }
    stopMedia();
    if (stage) stage.hidden = true;
    if (incoming) incoming.hidden = true;
    if (remoteVideo) remoteVideo.srcObject = null;
    syncDock();
  }

  function openDock() {
    if (root.classList.contains("call-dock")) root.classList.add("is-open");
  }

  function syncDock() {
    if (!root.classList.contains("call-dock")) return;
    const ping = document.querySelector("#chat-ping");
    const open = (incoming && !incoming.hidden) || (stage && !stage.hidden) || (ping && !ping.hidden);
    root.classList.toggle("is-open", Boolean(open));
  }

  function stopMedia() {
    if (!localStream) return;
    for (const track of localStream.getTracks()) track.stop();
    localStream = null;
    if (localVideo) localVideo.srcObject = null;
  }

  function failMedia(error) {
    reset();
    if (error && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError")) {
      setStatus("The browser blocked the microphone or camera. Allow them to place a simulation call.");
      return;
    }
    if (error && error.name === "NotFoundError") {
      setStatus("No microphone or camera was found for this simulation call.");
      return;
    }
    setStatus("The simulation call could not use the microphone or camera.");
  }

  function applyOnline(ids) {
    const online = new Set(ids.map(Number));
    for (const item of document.querySelectorAll(".roster-item")) {
      const on = online.has(Number(item.dataset.user));
      const presence = item.querySelector(".presence");
      if (presence) {
        presence.dataset.on = on ? "yes" : "no";
        presence.textContent = on ? "On the line" : "Not on the line right now";
      }
      for (const button of item.querySelectorAll("[data-ring]")) button.disabled = !on;
    }
    if (kind === "direct") {
      const on = online.has(Number(root.dataset.user));
      const presence = document.querySelector("#direct-presence");
      if (presence) {
        presence.dataset.on = on ? "yes" : "no";
        presence.textContent = on ? "On the line" : "Not on the line right now";
      }
      for (const button of root.querySelectorAll("[data-ring]")) button.disabled = !on;
    }
  }

  function nameOf(id) {
    return names[id] || names[String(id)] || (Number(id) === partner ? partnerName : "") || "Member";
  }

  function roomKey(id) {
    const low = Math.min(me, Number(id));
    const high = Math.max(me, Number(id));
    return `room-${meetingId}-${low}-${high}`;
  }

  function send(payload) {
    if (socket.readyState === 1) socket.send(JSON.stringify(payload));
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function readNames() {
    const node = document.querySelector("#member-names");
    if (!node) return {};
    try { return JSON.parse(node.textContent); } catch { return {}; }
  }
}
