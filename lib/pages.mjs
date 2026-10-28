import { canEnter, hasAllAccess, isCeo, memberSims, sharesCompany } from "./access.mjs";
import { INTERVIEW_SCRIPT, SEED, SIMS, STUDIO } from "./copy.mjs";
import { esc, formatPracticeTime, formatStamp, paragraphs, simulationAddresses } from "./format.mjs";
import { avatarHtml, csrf, layout, logo, notesHtml, person, simName, simulationChoices } from "./html.mjs";
import { CITIES } from "./quarry.mjs";

const FEATURE_HREF = {
  yapmark: "/yapmark/floor",
  flinttable: "/flinttable/table",
  chartslate: "/chartslate/room",
};

export function homePage(ctx) {
  const cards = Object.entries(SIMS)
    .map(
      ([id, sim]) => `<a class="sim-card sim-${id}" href="/${id}">
        ${logo(id, sim.name, "lg")}
        <div>
          <p class="tag">${esc(sim.line)}</p>
          <h2>${esc(sim.name)}</h2>
          <p class="slogan">${esc(sim.slogan)}</p>
          <p>${esc(sim.summary)}</p>
        </div>
      </a>`,
    )
    .join("");
  return layout(ctx, {
    title: "Simulations",
    section: "home",
    world: "",
    body: `<section>
      <p class="eyebrow">Three simulations</p>
      <h1>Yapmark, Flinttable, and Chartslate</h1>
      <p class="lede">${esc(STUDIO.slogan)}</p>
      <p class="lede">You are joining a fake-company simulation, not a real employer.</p>
      <div class="stack-lg">${cards}</div>
    </section>
    <aside class="panel quiet">
      ${logo(STUDIO.id, STUDIO.name, "sm")}
      <div>
        <p>${esc(STUDIO.name)} is the studio behind these simulations. Hanna Bridgham, CEO of ${esc(STUDIO.name)}.</p>
        <p class="actions">${ctx.user ? '<a class="button" href="/desk">Your desk</a>' : '<a class="button" href="/signup">Create account</a><a class="button secondary" href="/membership">Notchday employee membership</a>'}</p>
      </div>
    </aside>
    <section class="panel">
      <h2>A simulated day</h2>
      <ol class="steps">
        <li>Create an account and pick one company. That signup email stays with that company.</li>
        <li>Say hello to someone on the team, even if you know nobody outside this simulation.</li>
        <li>Check the company room. Yapmark wants a check-in. Flinttable wants a pitch and a vote. Chartslate wants a graph.</li>
        <li>A Notchday employee membership includes all three. It is a paid simulation membership, not employment.</li>
      </ol>
      <p>Support is an optional donation. The membership gate does not charge a card.</p>
    </section>`,
  });
}

export function simPage(ctx, id) {
  const sim = SIMS[id];
  return layout(ctx, {
    title: sim.name,
    section: id,
    world: id,
    body: `<article class="sim-hero sim-${id}">
      ${logo(id, sim.name, "lg")}
      <div>
        <p class="tag">${esc(sim.line)}</p>
        <h1>${esc(sim.name)}</h1>
        <p class="slogan">${esc(sim.slogan)}</p>
        <p class="lede">${esc(sim.summary)}</p>
        <p>You are joining a fake-company simulation, not a real employer.</p>
        ${simBody(id)}
        <p class="actions">${enterLink(ctx, id)}</p>
      </div>
    </article>`,
  });
}

function simBody(id) {
  if (id === "yapmark") {
    return `<p>The floor is office talk online. Check in about what you are working on, or what you are not working on. Members can place simulation phone calls. A simulation meeting can include a Zoom link a member pastes in.</p>`;
  }
  if (id === "flinttable") {
    return `<p>The table wants a pitch, then votes. Notes can sharpen it. The argument is the product.</p>`;
  }
  return `<p>The room is for graphs. Public figures from the World Bank, the USGS earthquake feed, and Open-Meteo get charted, written up, and pinned for this company.</p>`;
}

function enterLink(ctx, id) {
  const name = esc(SIMS[id].name);
  if (!ctx.user) {
    return `<a class="button" href="/${id}/signup">Join ${name}</a><a class="button secondary" href="/${id}/login">Log in to ${name}</a>`;
  }
  if (canEnter(ctx.user, id)) {
    return `<a class="button" href="${FEATURE_HREF[id]}">Enter ${name}</a><a class="button secondary" href="/${id}/room">Company room</a>`;
  }
  return `<a class="button secondary" href="/membership">Notchday employee membership</a>`;
}

export function authPage(ctx, { mode, error, values, next, door = "" }) {
  const login = mode === "login";
  const sim = SIMS[door];
  const title = login ? (sim ? `Log in to ${sim.name}` : "Log in") : sim ? `Join ${sim.name}` : "Create account";
  const action = door ? `/${door}/${login ? "login" : "signup"}` : login ? "/login" : "/signup";
  const simulationField = sim
    ? `<input type="hidden" name="simulation" value="${esc(door)}"><p class="hint">This door is the ${esc(sim.name)} simulation. You are joining a fake-company simulation, not a real employer. One signup email stays with one company.</p>`
    : `<fieldset><legend>Simulation</legend>${simulationChoices(values.simulation)}</fieldset><p class="hint">Pick one company. That email stays there unless you take a Notchday employee membership.</p>`;
  const extra = login
    ? `<input type="hidden" name="next" value="${esc(next || "/desk")}">
       <label>Email <input name="email" type="email" autocomplete="username" required value="${esc(values.email || "")}"></label>
       <label>Password <input name="password" type="password" autocomplete="current-password" required></label>`
    : `<p class="hint">A simulation title is for the company you pick. It is not employment.</p>
       <label>Name <input name="name" required maxlength="80" value="${esc(values.name || "")}"></label>
       <label>Email <input name="email" type="email" autocomplete="username" required value="${esc(values.email || "")}"></label>
       <label>Password <input name="password" type="password" autocomplete="new-password" required minlength="8"> <small>At least 8 characters.</small></label>
       ${simulationField}
       <label>Simulation title <input name="practice_title" required maxlength="80" value="${esc(values.practice_title || "")}"></label>
       <label>Simulation role <input name="practice_role" required maxlength="80" value="${esc(values.practice_role || "")}"></label>`;
  return layout(ctx, {
    title,
    section: mode,
    world: door,
    body: `<section class="narrow">
      <h1>${title}</h1>
      ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
      <form class="stack" method="post" action="${action}">
        ${csrf(ctx)}
        ${extra}
        <button type="submit">${title}</button>
      </form>
      <p>${login ? `No account yet? <a href="${door ? `/${door}/signup` : "/signup"}">Create one</a>.` : `Already a member? <a href="${door ? `/${door}/login` : "/login"}">Log in</a>.`}</p>
    </section>`,
  });
}

export function deskPage(ctx, { tasks, meetings, punch, practiceMs, hannaId, peers }) {
  const user = ctx.user;
  const sims = memberSims(user);
  const rooms = sims
    .map((id) => `<li><a href="/${id}/room">${esc(SIMS[id].name)} room</a></li><li><a href="${FEATURE_HREF[id]}">${esc(SIMS[id].feature)}</a></li>`)
    .join("");
  const box = isCeo(user) ? "/profile#hr-inbox" : hannaId ? `/members/${hannaId}#complaint-box` : "";
  const hello = (peers || []).slice(0, 6);
  const reach = hello.length
    ? `<ul class="link-list">${hello.map((peer) => `<li><a href="/chats/${peer.id}">Say hello to ${esc(peer.name)}</a></li>`).join("")}</ul>`
    : `<p class="empty">Know nobody in real life? Nobody else is on your company team yet. When a member joins, say hello from the members list.</p>`;
  return layout(ctx, {
    title: "Desk",
    section: "desk",
    body: `<section class="split">
      <div>
        <p class="eyebrow">Member desk</p>
        <h1>${esc(user.name)}</h1>
        ${isCeo(user) ? `<p class="lede">CEO of ${esc(STUDIO.name)}.</p>` : ""}
        ${user.membership === "all" ? `<p class="tag">Notchday employee membership. Paid simulation membership, not employment.</p>` : ""}
        ${person(user)}
        <p class="actions">${user.simulation ? enterLink(ctx, user.simulation) : ""}<a class="button secondary" href="/profile">Simulation profile</a></p>
      </div>
      <div class="panel">
        <h2>From here</h2>
        <ul class="link-list">
          ${rooms}
          <li><a href="/chats">Simulation chat</a></li>
          <li><a href="/teams">Simulation teams and tasks</a></li>
          <li><a href="/calendar">Simulation calendar</a></li>
          <li><a href="/interviews">Simulation interviews</a></li>
          <li><a href="/members">Company team</a></li>
          ${box ? `<li><a href="${box}">Complaint box</a></li>` : ""}
          <li><a href="/membership">Notchday employee membership</a></li>
          <li><a href="/support">Optional donation</a></li>
        </ul>
      </div>
    </section>
    <section>
      <h2>Say hello</h2>
      <p>Direct connection to people on your company team.</p>
      ${reach}
    </section>
    ${punchPanel(ctx, { punch, practiceMs })}
    <section>
      <h2>Your simulation meetings</h2>
      ${meetingList(meetings)}
    </section>
    <section>
      <h2>Simulation tasks on your teams</h2>
      ${taskList(tasks)}
    </section>`,
  });
}

export function enterSimPage(ctx, simulation) {
  const sim = SIMS[simulation];
  const open = canEnter(ctx.user, simulation);
  const body = open
    ? `<p class="actions"><a class="button" href="${FEATURE_HREF[simulation]}">Enter ${esc(sim.name)}</a></p>`
    : `<p>Your signup email is locked to ${esc(simName(ctx.user.simulation) || "one company")}. Each company simulation stays separate.</p>
       <p>A Notchday employee membership is a paid simulation membership, not employment. It includes Yapmark, Flinttable, and Chartslate. This gate does not charge a card.</p>
       <p class="actions"><a class="button" href="/membership">See the Notchday employee membership</a></p>`;
  return layout(ctx, {
    title: sim.name,
    section: simulation,
    world: simulation,
    body: `<section class="narrow">
      <p class="tag">${esc(sim.line)}</p>
      <h1>${esc(sim.name)}</h1>
      <p>You are joining a fake-company simulation, not a real employer.</p>
      ${body}
    </section>`,
  });
}

function punchPanel(ctx, { punch, practiceMs }) {
  if (!ctx.user?.simulation) {
    return `<section class="panel" id="simulation-time"><h2>Simulation time</h2><p class="tag">Simulation time. Not employment.</p><p>Pick a company simulation before punching in.</p></section>`;
  }
  const open = punch && punch.simulation === ctx.user.simulation;
  return `<section class="panel" id="simulation-time">
    <h2>Simulation time</h2>
    <p class="tag">Simulation time. Not employment.</p>
    <p>${esc(formatPracticeTime(practiceMs || 0))} in ${esc(simName(ctx.user.simulation))}</p>
    <p>${open ? "Punched in" : "Punched out"}</p>
    <form method="post" action="${open ? "/punch/out" : "/punch/in"}">${csrf(ctx)}<button type="submit">${open ? "Punch out" : "Punch in"}</button></form>
  </section>`;
}

export function profilePage(ctx, { error, values, punch, practiceMs, complaints }) {
  const user = ctx.user;
  const current = values || user;
  const addresses = simulationAddresses(user);
  const locked = Boolean(user.simulation) && !hasAllAccess(user);
  const simField = locked
    ? `<input type="hidden" name="simulation" value="${esc(user.simulation)}"><p>This signup email is locked to ${esc(simName(user.simulation))}.</p>`
    : `<fieldset><legend>Desk company</legend>${simulationChoices(current.simulation || user.simulation, hasAllAccess(user) || !user.simulation ? null : memberSims(user))}</fieldset>`;
  const addressHtml = addresses.length
    ? `<p class="tag">Simulation address</p>${addresses.map((address) => `<p class="sim-address"><code>${esc(address)}</code></p>`).join("")}<p class="hint">This address only works inside the simulation.</p>`
    : "";
  return layout(ctx, {
    title: "Simulation profile",
    section: "profile",
    body: `<section class="narrow">
      <h1>Simulation profile</h1>
      <div class="profile-photo">${avatarHtml(user, "avatar-lg")}</div>
      ${addressHtml}
      ${punchPanel(ctx, { punch, practiceMs })}
      <form class="stack" method="post" action="/profile/photo" enctype="multipart/form-data">
        <h2>Profile photo</h2>
        ${csrf(ctx)}
        <label>Photo <input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>
        <p class="actions"><button type="submit">Save profile photo</button>${user.avatar_type ? `<button class="secondary" type="submit" name="remove" value="1">Remove photo</button>` : ""}</p>
      </form>
      ${isCeo(user) ? `<p class="lede">Studio role: CEO of ${esc(STUDIO.name)}.</p><p>Hanna Bridgham is the only CEO. That title stays put.</p>` : ""}
      ${hasAllAccess(user) ? `<p>A Notchday employee membership includes all three companies. The desk company below is where simulation time is counted.</p>` : `<p class="hint">One signup email stays with one company. A Notchday employee membership includes all three. It is not employment.</p>`}
      ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
      <form class="stack" method="post" action="/profile">
        ${csrf(ctx)}
        ${simField}
        <label>Simulation title <input name="practice_title" required maxlength="80" value="${esc(current.practice_title || "")}"></label>
        <label>Simulation role <input name="practice_role" required maxlength="80" value="${esc(current.practice_role || "")}"></label>
        <button type="submit">Save simulation profile</button>
      </form>
      ${Array.isArray(complaints) ? complaintInbox(complaints) : ""}
    </section>`,
  });
}

export function membershipPage(ctx) {
  const active = hasAllAccess(ctx.user);
  const form = ctx.user
    ? `<form class="stack" method="post" action="/membership">
        ${csrf(ctx)}
        <button type="submit">${active ? "Membership already includes all three" : "Take the Notchday employee membership"}</button>
      </form>`
    : `<p class="actions"><a class="button" href="/signup">Create an account</a><a class="button secondary" href="/login">Log in</a></p>`;
  return layout(ctx, {
    title: "Notchday employee membership",
    section: "membership",
    body: `<section class="narrow">
      <p class="tag">Paid simulation membership. Not employment.</p>
      <h1>Notchday employee</h1>
      <p class="lede">This is a paid simulation membership. It is not employment, not a job, and not a hire.</p>
      <p>Paying members belong to Yapmark, Flinttable, and Chartslate. Everyone else stays in the one company on their signup email. Each company keeps its own features and its own members.</p>
      <p>This gate does not charge a card.</p>
      ${active ? "<p>This account already includes all three company simulations.</p>" : ""}
      ${form}
    </section>`,
  });
}

export function membersPage(ctx, users) {
  const groups = Object.keys(SIMS)
    .map((id) => {
      const people = users.filter((user) => user.simulation === id || user.membership === "all" || user.email === SEED.email);
      const cards = people.length ? people.map((user) => memberCard(ctx, user)).join("") : '<p class="empty">No members in this simulation yet.</p>';
      return `<section><h2>${esc(SIMS[id].name)}</h2><div class="people">${cards}</div></section>`;
    })
    .join("");
  const unset = users.filter((user) => !user.simulation && user.membership !== "all" && user.email !== SEED.email);
  const waiting = unset.length
    ? `<section><h2>No simulation yet</h2><div class="people">${unset.map((user) => memberCard(ctx, user)).join("")}</div></section>`
    : "";
  const mine = users.filter((user) => sharesCompany(ctx.user, user));
  const reach = mine.length
    ? ""
    : `<p class="empty">Know nobody in real life? Nobody else is on your company team yet. When a member joins, say hello.</p>`;
  return layout(ctx, {
    title: "Members",
    section: "members",
    body: `<h1>Company teams</h1>
      <p>Simulation profiles inside ${esc(STUDIO.name)}. A name here is a member of a simulation, not a hire.</p>
      <p>Know nobody in real life? Say hello to someone on your company team. Simulation chat stays with people who share a company.</p>
      ${reach}
      ${groups}${waiting}`,
  });
}

function memberCard(ctx, user) {
  return `<div class="person-card">${person(user)}${memberActions(ctx, user)}</div>`;
}

function memberActions(ctx, user) {
  if (!ctx.user || user.id === ctx.user.id) return "";
  const hello = sharesCompany(ctx.user, user)
    ? `<a href="/chats/${user.id}">Say hello</a><a href="/members/${user.id}">Schedule a simulation meeting</a>`
    : "";
  const hr = user.email === SEED.email ? `<a href="/members/${user.id}#complaint-box">Complaint box</a>` : "";
  if (!hello && !hr) return "";
  return `<p class="actions">${hello}${hr}</p>`;
}

export function chatsPage(ctx, peers) {
  const items = peers.length
    ? `<ul class="cards">${peers
        .map((peer) => {
          const preview = peer.last_body
            ? esc(String(peer.last_body).replace(/\s+/g, " ").slice(0, 140))
            : "No simulation messages yet";
          return `<li><a href="/chats/${peer.id}">
            <p class="tag">Simulation chat</p>
            <strong>${esc(peer.name)}</strong>
            <span>${esc(peer.practice_title || "Simulation profile")}</span>
            <span>${preview}</span>
          </a></li>`;
        })
        .join("")}</ul>`
    : `<p class="empty">Know nobody in real life? Nobody else is on your company team yet. When a member joins, say hello from this list.</p>`;
  return layout(ctx, {
    title: "Simulation chat",
    section: "chats",
    body: `<h1>Simulation chat</h1>
      <p class="tag">Simulation chat</p>
      <p>Messages stay with members who share a company. Say hello, or schedule a simulation meeting.</p>
      ${items}`,
  });
}

export function chatPage(ctx, { peer, messages, error }) {
  return layout(ctx, {
    title: `Simulation chat with ${peer.name}`,
    section: "chats",
    body: `<p class="tag">Simulation chat · ${esc(simName(peer.simulation))}</p>
      <h1>Simulation chat with ${esc(peer.name)}</h1>
      <p>This conversation stays inside the simulation.</p>
      <div id="chat-thread" data-live="/chats/${peer.id}/messages?fragment=1" data-with="${peer.id}">${chatThread(ctx, messages)}</div>
      <form class="stack" method="post" action="/chats/${peer.id}">
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Simulation message <textarea name="body" required maxlength="2000"></textarea></label>
        <button type="submit">Send simulation message</button>
      </form>
      <p class="actions"><a href="/members/${peer.id}">Schedule a simulation meeting with ${esc(peer.name)}</a></p>`,
  });
}

export function chatThread(ctx, messages) {
  if (!messages.length) return '<p class="empty">No simulation messages yet.</p>';
  return `<div class="chat-log">${messages
    .map(
      (message) => `<article class="chat-line ${message.sender_id === ctx.user.id ? "mine" : "theirs"}">
        <p class="tag">Simulation chat</p>
        <header><strong>${esc(message.sender_name)}</strong> <time datetime="${esc(message.created_at)}">${esc(formatStamp(message.created_at))}</time></header>
        ${paragraphs(message.body)}
      </article>`,
    )
    .join("")}</div>`;
}

export function memberPage(ctx, { member, error, values, people, complaints }) {
  const preset = values || {};
  const hanna = member.email === SEED.email;
  return layout(ctx, {
    title: member.name,
    section: "members",
    body: `<p class="tag">Simulation profile · ${esc(member.membership === "all" ? `${STUDIO.name} membership` : simName(member.simulation))}</p>
      <h1>${esc(member.name)}</h1>
      ${person(member)}
      ${sharesCompany(ctx.user, member) ? `<p class="actions"><a class="button" href="/chats/${member.id}">Say hello</a></p>` : ""}
      ${hanna ? complaintForms(ctx, people || []) : ""}
      ${hanna && Array.isArray(complaints) ? complaintInbox(complaints) : ""}
      ${sharesCompany(ctx.user, member) ? `<form class="panel stack" method="post" action="/members/${member.id}/meeting">
        <h2>Schedule a simulation meeting with ${esc(member.name)}</h2>
        <p class="hint">This meeting is inside ${esc(simName(ctx.user.simulation))}. ${esc(member.name)} is invited. A Zoom link is optional.</p>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Title <input name="title" required maxlength="120" value="${esc(preset.title || "")}"></label>
        <label>Starts <input name="starts_at" type="datetime-local" required value="${esc(preset.starts_at || "")}"></label>
        <label>Ends <input name="ends_at" type="datetime-local" required value="${esc(preset.ends_at || "")}"></label>
        <label>Agenda <textarea name="agenda" maxlength="2000">${esc(preset.agenda || "")}</textarea></label>
        <label>Zoom link, optional <input name="zoom_link" type="url" maxlength="300" placeholder="https://zoom.us/j/..." value="${esc(preset.zoom_link || "")}"></label>
        <button type="submit">Schedule simulation meeting</button>
      </form>` : ""}`,
  });
}

function complaintForms(ctx, people) {
  const options = people
    .filter((person) => person.id !== ctx.user.id && person.email !== SEED.email)
    .map((person) => `<option value="${person.id}">${esc(person.name)}</option>`)
    .join("");
  return `<section class="panel stack" id="complaint-box">
    <h2>Complaint box</h2>
    <p>Hanna Bridgham reads this box. Send a bug or an issue. If a member is harmful, report them to HR. HR is Hanna. This is a simulation report.</p>
    <form class="stack" method="post" action="/hr">
      ${csrf(ctx)}
      <input type="hidden" name="kind" value="bug">
      <label>Bug or issue <textarea name="body" required maxlength="2000"></textarea></label>
      <button type="submit">Send to Hanna</button>
    </form>
    <form class="stack" method="post" action="/hr">
      ${csrf(ctx)}
      <input type="hidden" name="kind" value="report">
      ${options ? `<label>Member <select name="about_user_id" required>${options}</select></label>` : "<p>No other member to report yet.</p>"}
      <label>What happened <textarea name="body" required maxlength="2000"></textarea></label>
      <button type="submit">Report to HR</button>
    </form>
  </section>`;
}

function complaintInbox(complaints) {
  const rows = complaints.length
    ? complaints
        .map(
          (item) => `<article class="note">
            <p class="tag">${item.kind === "report" ? "Member report" : "Bug or issue"}</p>
            <header><strong>${esc(item.from_name)}</strong>${item.about_name ? ` · about ${esc(item.about_name)}` : ""} <time datetime="${esc(item.created_at)}">${esc(formatStamp(item.created_at))}</time></header>
            ${paragraphs(item.body)}
          </article>`,
        )
        .join("")
    : '<p class="empty">The complaint box is empty.</p>';
  return `<section id="hr-inbox"><h2>HR inbox</h2><p>Only Hanna can see this inbox.</p>${rows}</section>`;
}

export function teamsPage(ctx, { teams, error }) {
  const sim = ctx.user.simulation;
  return layout(ctx, {
    title: "Simulation teams",
    section: "teams",
    body: `<section class="split">
      <div>
        <h1>Simulation teams</h1>
        <p>Form a team with other members in ${esc(simName(sim))} and assign simulation tasks.</p>
        ${teams.length ? teamCards(teams) : '<p class="empty">You are not on a simulation team yet.</p>'}
      </div>
      <form class="panel stack" method="post" action="/teams">
        <h2>New simulation team</h2>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Team name <input name="name" required maxlength="80"></label>
        <p class="hint">This team stays in ${esc(simName(sim))}.</p>
        <button type="submit">Form team</button>
      </form>
    </section>`,
  });
}

function teamCards(teams) {
  return `<ul class="cards">${teams
    .map(
      (team) => `<li><a href="/teams/${team.id}"><strong>${esc(team.name)}</strong><span>${esc(simName(team.simulation))}</span><span>${team.member_count} members</span></a></li>`,
    )
    .join("")}</ul>`;
}

export function teamPage(ctx, { team, members, others, tasks, error }) {
  return layout(ctx, {
    title: team.name,
    section: "teams",
    body: `<p class="tag">Simulation team · ${esc(simName(team.simulation))}</p>
      <h1>${esc(team.name)}</h1>
      <div class="split">
        <section>
          <h2>Members</h2>
          <div class="people">${members.map(person).join("")}</div>
          <form method="post" action="/teams/${team.id}/leave">${csrf(ctx)}<button class="secondary" type="submit">Leave team</button></form>
        </section>
        <form class="panel stack" method="post" action="/teams/${team.id}/members">
          <h2>Add a member</h2>
          ${csrf(ctx)}
          ${others.length ? `<label>Member <select name="user_id" required>${others.map((user) => `<option value="${user.id}">${esc(user.name)}</option>`).join("")}</select></label><button type="submit">Add to team</button>` : '<p class="empty">Every member already in this company is on the team, or no one else has joined it yet.</p>'}
        </form>
      </div>
      <section>
        <h2>Simulation tasks</h2>
        ${taskList(tasks, { actions: true, csrfToken: ctx.session?.csrf || "" })}
        <form class="panel stack" method="post" action="/teams/${team.id}/tasks">
          <h3>Assign a simulation task</h3>
          ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
          ${csrf(ctx)}
          <label>Task <input name="title" required maxlength="120"></label>
          <label>Detail <textarea name="detail" maxlength="2000"></textarea></label>
          <label>Assign to <select name="assignee_id" required>${members.map((user) => `<option value="${user.id}">${esc(user.name)}</option>`).join("")}</select></label>
          <button type="submit">Assign simulation task</button>
        </form>
      </section>`,
  });
}

export function taskList(tasks, { actions = false, csrfToken = "" } = {}) {
  if (!tasks.length) return '<p class="empty">No simulation tasks yet.</p>';
  return `<ul class="tasks">${tasks
    .map((task) => {
      const state = task.status === "done" ? "Marked finished" : "Open";
      const toggle = actions
        ? `<form method="post" action="/tasks/${task.id}"><input type="hidden" name="csrf" value="${esc(csrfToken)}"><input type="hidden" name="status" value="${task.status === "done" ? "open" : "done"}"><button class="secondary" type="submit">${task.status === "done" ? "Reopen" : "Mark finished"}</button></form>`
        : "";
      return `<li>
        <p class="tag">Simulation task</p>
        <strong>${esc(task.title)}</strong>
        <span>${esc(state)}${task.assignee_name ? ` · ${esc(task.assignee_name)}` : ""}</span>
        ${task.team_name ? `<span>${esc(task.team_name)} · ${esc(simName(task.simulation))}</span>` : ""}
        ${task.detail ? paragraphs(task.detail) : ""}
        ${toggle}
      </li>`;
    })
    .join("")}</ul>`;
}

export function calendarPage(ctx, { year, month, cells, meetings, others, members, error, values }) {
  const label = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const prev = shift(year, month, -1);
  const next = shift(year, month, 1);
  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => `<div class="cal-head">${day}</div>`).join("");
  const days = cells
    .map((cell) => {
      if (!cell) return '<div class="day is-out"></div>';
      const pills = cell.meetings
        .map((meeting) => `<a class="meet-pill" href="/meetings/${meeting.id}">${esc(meeting.title)}</a>`)
        .join("");
      return `<div class="day"><span>${cell.day}</span>${pills}</div>`;
    })
    .join("");
  const form = ctx.user.simulation
    ? `<form class="panel stack" method="post" action="/meetings">
        <h2>New simulation meeting</h2>
        <p class="hint">This meeting is inside ${esc(simName(ctx.user.simulation))}. Members who share that company can be invited.</p>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Title <input name="title" required maxlength="120" value="${esc(values.title || "")}"></label>
        <label>Starts <input name="starts_at" type="datetime-local" required value="${esc(values.starts_at || "")}"></label>
        <label>Ends <input name="ends_at" type="datetime-local" required value="${esc(values.ends_at || "")}"></label>
        <label>Agenda <textarea name="agenda" maxlength="2000">${esc(values.agenda || "")}</textarea></label>
        <label>Zoom link, optional <input name="zoom_link" type="url" maxlength="300" placeholder="https://zoom.us/j/..." value="${esc(values.zoom_link || "")}"></label>
        ${members.length ? `<fieldset><legend>Invite members</legend>${members.map((member) => `<label class="choice"><input type="checkbox" name="with" value="${member.id}"><span>${esc(member.name)}</span></label>`).join("")}</fieldset>` : '<p class="empty">No other members are in this company yet. You can still put a meeting on the calendar.</p>'}
        <button type="submit">Create simulation meeting</button>
      </form>`
    : `<div class="panel"><h2>New simulation meeting</h2><p>Pick a company simulation before you schedule one.</p><a class="button" href="/profile">Simulation profile</a></div>`;
  return layout(ctx, {
    title: "Calendar",
    section: "calendar",
    body: `<div class="cal-top">
        <h1>Calendar</h1>
        <p>Simulation meetings between members. Times are saved as you enter them.</p>
        <p class="month-nav"><a href="/calendar?y=${prev.y}&m=${prev.m}">Previous</a> <strong>${label}</strong> <a href="/calendar?y=${next.y}&m=${next.m}">Next</a></p>
      </div>
      <div class="cal-wrap"><div class="cal">${heads}${days}</div></div>
      <h2>This month</h2>
      ${agenda(meetings)}
      ${others.length ? `<h2>Meetings you joined in another simulation</h2>${agenda(others)}` : ""}
      ${form}`,
  });
}

function agenda(meetings) {
  if (!meetings.length) return '<p class="empty">No simulation meetings in this month.</p>';
  return `<ul class="agenda">${meetings
    .map(
      (meeting) => `<li>
        <p class="tag">Simulation meeting</p>
        <a href="/meetings/${meeting.id}"><strong>${esc(meeting.title)}</strong></a>
        <span>${esc(simName(meeting.simulation))}</span>
        <time datetime="${esc(meeting.starts_at)}">${esc(formatStamp(meeting.starts_at))}</time>
        <span>to</span>
        <time datetime="${esc(meeting.ends_at)}">${esc(formatStamp(meeting.ends_at))}</time>
      </li>`,
    )
    .join("")}</ul>`;
}

function shift(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
}

export function meetingList(meetings) {
  return agenda(meetings);
}

export function meetingPage(ctx, { meeting, members, notes, joined, error }) {
  const call = meeting.simulation === "yapmark" && joined;
  const names = Object.fromEntries(members.map((member) => [member.id, member.name]));
  return layout(ctx, {
    title: meeting.title,
    section: "calendar",
    call,
    body: `<p class="tag">Simulation meeting · ${esc(simName(meeting.simulation))}</p>
      <h1>${esc(meeting.title)}</h1>
      <p><time datetime="${esc(meeting.starts_at)}">${esc(formatStamp(meeting.starts_at))}</time> to <time datetime="${esc(meeting.ends_at)}">${esc(formatStamp(meeting.ends_at))}</time></p>
      ${meeting.zoom_link ? `<p><a href="${esc(meeting.zoom_link)}" rel="noopener noreferrer">Zoom link for this simulation meeting</a></p>` : ""}
      ${meeting.agenda ? `<section><h2>Agenda</h2>${paragraphs(meeting.agenda)}</section>` : ""}
      <section><h2>Members</h2><ul class="plain">${members
        .map((member) => `<li>${esc(member.name)} · ${member.state === "joined" ? "Joined" : "Invited"} · simulation profile</li>`)
        .join("")}</ul></section>
      ${joined ? "" : `<form method="post" action="/meetings/${meeting.id}/join">${csrf(ctx)}<button type="submit">Join simulation meeting</button></form>`}
      ${call ? roomCall(ctx, meeting, names) : ""}
      <section>
        <h2>Simulation notes</h2>
        <div id="note-list" data-live="/meetings/${meeting.id}/notes?fragment=1">${notesHtml(notes)}</div>
        ${joined ? noteForm(ctx, `/meetings/${meeting.id}/notes`, error) : '<p class="hint">Join the meeting to add a simulation note.</p>'}
      </section>`,
  });
}

function roomCall(ctx, meeting, names) {
  return `<section class="panel">
    <h2>Simulation phone</h2>
    <p>A simulation phone call for members who have joined this Yapmark meeting. The product is the conversation.</p>
    <div id="call-app" data-kind="room" data-me="${ctx.user.id}" data-meeting="${meeting.id}">
      <p id="call-status" role="status"></p>
      <button type="button" id="join-room">Join simulation call</button>
      <div id="call-stage" hidden>
        <div class="videos">
          <div class="peer"><video id="local-video" autoplay playsinline muted></video><p>You</p></div>
          <div id="peer-videos"></div>
        </div>
        <button type="button" id="hangup" class="warn">Leave simulation call</button>
      </div>
    </div>
    <script type="application/json" id="member-names">${jsonScript(names)}</script>
  </section>`;
}

function jsonScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function noteForm(ctx, action, error) {
  return `<form class="stack" method="post" action="${action}">
    ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
    ${csrf(ctx)}
    <label>Simulation note <textarea name="body" required maxlength="2000"></textarea></label>
    <button type="submit">Add simulation note</button>
  </form>`;
}

export function floorPage(ctx, members, checkins = []) {
  const others = members.filter((member) => member.id !== ctx.user.id);
  const names = Object.fromEntries(members.map((member) => [member.id, member.name]));
  const roster = others.length
    ? `<ul class="roster">${others
        .map(
          (member) => `<li class="roster-item" data-user="${member.id}">
            ${person(member)}
            <p class="presence" data-presence="${member.id}">Not on the line right now</p>
            <p class="actions"><a href="/chats/${member.id}">Say hello</a><a href="/members/${member.id}">Schedule a simulation meeting</a></p>
            <button type="button" data-ring="audio" disabled>Phone</button>
          </li>`,
        )
        .join("")}</ul>`
    : `<p class="empty">You are the only member in Yapmark right now. Know nobody in real life? When another member joins this company, say hello or start a simulation phone call.</p>`;
  return layout(ctx, {
    title: "Yapmark floor",
    section: "yapmark",
    world: "yapmark",
    call: true,
    body: `<p class="tag">${esc(SIMS.yapmark.feature)}</p>
      <h1>Yapmark</h1>
      <p class="slogan">${esc(SIMS.yapmark.slogan)}</p>
      <p class="lede">${esc(SIMS.yapmark.summary)}</p>
      ${checkinForm(ctx, checkins)}
      <div id="call-app" data-kind="floor" data-me="${ctx.user.id}">
        <p id="call-status" role="status"></p>
        ${roster}
        <div id="incoming" class="incoming" hidden>
          <p id="incoming-label"></p>
          <button type="button" id="accept">Join simulation call</button>
          <button type="button" id="decline" class="secondary">Decline</button>
        </div>
        <div id="call-stage" hidden>
          <div class="videos">
            <div class="peer"><video id="local-video" autoplay playsinline muted></video><p>You</p></div>
            <div class="peer"><video id="remote-video" autoplay playsinline></video><p id="remote-label">Member</p></div>
          </div>
          <button type="button" id="hangup" class="warn">End simulation call</button>
        </div>
      </div>
      <script type="application/json" id="member-names">${jsonScript(names)}</script>`,
  });
}

function checkinForm(ctx, checkins) {
  return `<section class="panel" id="checkins">
    <h2>Check-in board</h2>
    <p>Tell the floor what you are working on, or what you are not working on.</p>
    ${checkinList(checkins)}
    <form class="stack" method="post" action="/yapmark/checkin">
      ${csrf(ctx)}
      <label class="choice"><input type="radio" name="working" value="0" checked> <span>Not working on it</span></label>
      <label class="choice"><input type="radio" name="working" value="1"> <span>Working on it</span></label>
      <label>Check-in <textarea name="body" required maxlength="280"></textarea></label>
      <button type="submit">Check in</button>
    </form>
  </section>`;
}

function checkinList(checkins) {
  if (!checkins.length) return '<p class="empty">No check-ins yet. The floor is mostly talk.</p>';
  return `<ul class="cards">${checkins
    .map(
      (item) => `<li>
        <p class="tag">${item.working ? "Working on it" : "Not working on it"}</p>
        <strong>${esc(item.author_name)}</strong>
        <span>${esc(item.body)}</span>
      </li>`,
    )
    .join("")}</ul>`;
}

export function ideasPage(ctx, { ideas, error, canWrite }) {
  const list = ideas.length
    ? `<ul class="cards">${ideas
        .map(
          (idea) => `<li><a href="/flinttable/ideas/${idea.id}">
            <p class="tag">Pitch · ${idea.vote_count} votes</p>
            <strong>${esc(idea.title)}</strong>
            <span>${esc(idea.author_name)}</span>
            <span>${idea.note_count} simulation notes</span>
          </a></li>`,
        )
        .join("")}</ul>`
    : '<p class="empty">The pitch table is empty.</p>';
  const form = canWrite
    ? `<form class="panel stack" method="post" action="/flinttable/ideas">
        <h2>Pitch something</h2>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Title <input name="title" required maxlength="120"></label>
        <label>Pitch <textarea name="pitch" required maxlength="2000"></textarea></label>
        <button type="submit">Put the pitch on the table</button>
      </form>`
    : `<div class="panel"><p>A Flinttable membership is required to pitch.</p><a class="button" href="/membership">Notchday employee membership</a></div>`;
  return layout(ctx, {
    title: "Flinttable table",
    section: "flinttable",
    world: "flinttable",
    body: `<p class="tag">${esc(SIMS.flinttable.feature)}</p>
      <h1>Flinttable</h1>
      <p class="slogan">${esc(SIMS.flinttable.slogan)}</p>
      <p class="lede">${esc(SIMS.flinttable.summary)}</p>
      <div class="split"><div>${list}</div>${form}</div>`,
  });
}

export function ideaPage(ctx, { idea, notes, error, canWrite, voted }) {
  const votes = Number(idea.vote_count || 0);
  const vote = canWrite
    ? `<form method="post" action="/flinttable/ideas/${idea.id}/vote">${csrf(ctx)}<button type="submit">${voted ? "Take vote back" : "Vote for this pitch"}</button></form><p>${votes} ${votes === 1 ? "vote" : "votes"}</p>`
    : `<p>${votes} ${votes === 1 ? "vote" : "votes"}</p>`;
  return layout(ctx, {
    title: idea.title,
    section: "flinttable",
    world: "flinttable",
    body: `<p class="tag">Pitch · Flinttable</p>
      <h1>${esc(idea.title)}</h1>
      <p>${esc(idea.author_name)}${idea.author_title ? ` · ${esc(idea.author_title)}` : ""}</p>
      ${paragraphs(idea.pitch)}
      ${vote}
      <section>
        <h2>Sharpen it</h2>
        <div id="note-list" data-live="/flinttable/ideas/${idea.id}/notes?fragment=1">${notesHtml(notes)}</div>
        ${canWrite ? noteForm(ctx, `/flinttable/ideas/${idea.id}/notes`, error) : "<p class=\"hint\">Join Flinttable to add a simulation note.</p>"}
      </section>`,
  });
}

export function roomPage(ctx, { sim, messages, files, error, fileError, checkins, pitches, extra }) {
  const company = SIMS[sim];
  const feature = extra || (sim === "yapmark" ? checkinList(checkins || []) : sim === "flinttable" ? pitchPeek(pitches || []) : "");
  return layout(ctx, {
    title: `${company.name} room`,
    section: sim,
    world: sim,
    body: companyRoom(ctx, { sim, messages, files, error, fileError, extra: feature }),
  });
}

function pitchPeek(pitches) {
  if (!pitches.length) return '<p class="empty">No pitches on the table yet.</p>';
  return `<ul class="cards">${pitches
    .slice(0, 5)
    .map(
      (idea) => `<li><a href="/flinttable/ideas/${idea.id}"><p class="tag">Pitch · ${idea.vote_count} votes</p><strong>${esc(idea.title)}</strong></a></li>`,
    )
    .join("")}</ul><p><a href="/flinttable/table">Open the pitch table</a></p>`;
}

export function quarryPage(ctx, data) {
  return roomPage(ctx, {
    sim: "chartslate",
    messages: data.messages || [],
    files: data.files || [],
    error: data.roomError || "",
    fileError: data.fileError || "",
    extra: chartBlock(ctx, data),
  });
}

function chartBlock(ctx, { reports, dataset, city, chartHtml, error, canWrite }) {
  const cityOptions = CITIES.map(
    (item) => `<option value="${item.id}"${item.id === city ? " selected" : ""}>${esc(item.name)}</option>`,
  ).join("");
  const builder = canWrite
    ? `<form class="panel stack" method="get" action="/chartslate/room">
        <h2>Public data</h2>
        <label>Dataset
          <select name="dataset">
            <option value="population"${dataset === "population" ? " selected" : ""}>World Bank population</option>
            <option value="quakes"${dataset === "quakes" ? " selected" : ""}>USGS earthquakes</option>
            <option value="weather"${dataset === "weather" ? " selected" : ""}>Open-Meteo daily high</option>
          </select>
        </label>
        <label>City for the weather set <select name="city">${cityOptions}</select></label>
        <button type="submit">Load public data</button>
      </form>`
    : `<div class="panel"><p>Join Chartslate to chart public data and pin a graph.</p><a href="/membership">Notchday employee membership</a></div>`;
  const writer =
    canWrite && chartHtml
      ? `<form class="stack" method="post" action="/chartslate/reports">
          <h2>Pin a graph</h2>
          ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
          ${csrf(ctx)}
          <input type="hidden" name="dataset" value="${esc(dataset)}">
          <input type="hidden" name="city" value="${esc(city || "")}">
          <label>Title <input name="title" required maxlength="120"></label>
          <label>Report <textarea name="body" required minlength="40" maxlength="5000"></textarea></label>
          <button type="submit">Save simulation report</button>
        </form>`
      : "";
  return `<section>
    <h2>Graph wall</h2>
    <p>${esc(SIMS.chartslate.slogan)}</p>
    ${builder}
    ${chartHtml || ""}
    ${writer}
    <h3>Shared graphs</h3>
    ${reportList(reports || [])}
  </section>`;
}

function companyRoom(ctx, { sim, messages, files, error, fileError, extra }) {
  const company = SIMS[sim];
  return `<p class="tag">${esc(company.feature)}</p>
    <h1>${esc(company.name)} room</h1>
    <p class="slogan">${esc(company.slogan)}</p>
    <p>This company room is separate. Members who are not in ${esc(company.name)} stay outside, unless they hold a Notchday employee membership.</p>
    ${extra || ""}
    <section>
      <h2>Company chat</h2>
      <div id="room-thread" data-live="/${sim}/room/messages?fragment=1">${roomThread(ctx, messages || [])}</div>
      <form class="stack" method="post" action="/${sim}/room">
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Room message <textarea name="body" required maxlength="2000"></textarea></label>
        <button type="submit">Send to the room</button>
      </form>
    </section>
    ${fileShare(ctx, sim, files || [], fileError)}`;
}

function roomThread(ctx, messages) {
  if (!messages.length) return '<p class="empty">The company room is quiet.</p>';
  return `<div class="chat-log">${messages
    .map(
      (message) => `<article class="chat-line ${message.user_id === ctx.user.id ? "mine" : "theirs"}">
        <p class="tag">Company room</p>
        <header><strong>${esc(message.sender_name)}</strong> <time datetime="${esc(message.created_at)}">${esc(formatStamp(message.created_at))}</time></header>
        ${paragraphs(message.body)}
      </article>`,
    )
    .join("")}</div>`;
}

export function roomThreadFragment(ctx, messages) {
  return roomThread(ctx, messages);
}

function fileShare(ctx, sim, files, fileError) {
  const rows = files.length
    ? `<ul class="cards">${files
        .map(
          (file) => `<li><a href="/files/${file.id}">${esc(file.name)}</a> <span>${esc(file.author_name)}</span></li>`,
        )
        .join("")}</ul>`
    : '<p class="empty">No files in this company room yet.</p>';
  return `<section>
    <h2>File share</h2>
    <p>PNG, JPEG, WebP, PDF, TXT, or CSV. Files stay inside this company simulation.</p>
    ${fileError ? `<p class="form-error" role="alert">${esc(fileError)}</p>` : ""}
    <form class="stack" method="post" action="/${sim}/files" enctype="multipart/form-data">
      ${csrf(ctx)}
      <label>File <input name="upload" type="file" required></label>
      <button type="submit">Share file</button>
    </form>
    ${rows}
  </section>`;
}

function reportList(reports) {
  if (!reports.length) return '<p class="empty">No shared graphs yet.</p>';
  return `<ul class="cards">${reports
    .map(
      (report) => `<li><a href="/reports/${report.id}">
        <p class="tag">Simulation report${report.shared ? " · shared" : ""}</p>
        <strong>${esc(report.title)}</strong>
        <span>${esc(report.author_name)}</span>
        <span>${esc(report.source_label)}</span>
      </a></li>`,
    )
    .join("")}</ul>`;
}

export function reportPage(ctx, { report, chartHtml }) {
  const mine = ctx.user && ctx.user.id === report.author_id;
  return layout(ctx, {
    title: report.title,
    section: "chartslate",
    world: "chartslate",
    body: `<p class="tag">Simulation report · Chartslate${report.shared ? " · shared" : ""}</p>
      <h1>${esc(report.title)}</h1>
      <p>${esc(report.author_name)} · ${esc(report.source_label)}</p>
      ${chartHtml}
      ${paragraphs(report.body)}
      ${mine ? `<form method="post" action="/reports/${report.id}/share">${csrf(ctx)}<button class="secondary" type="submit">${report.shared ? "Stop sharing" : "Share with the company room"}</button></form>` : ""}`,
  });
}

export function interviewsPage(ctx, { interviews, error }) {
  const rows = interviews.length
    ? `<ul class="cards">${interviews
        .map(
          (item) => `<li><a href="/interviews/${item.id}">
            <p class="tag">Simulation interview · ${esc(item.status)}</p>
            <strong>${esc(item.practice_role)}</strong>
            <span>${esc(simName(item.simulation))}</span>
            <span>Requested by ${esc(item.requester_name)}</span>
          </a></li>`,
        )
        .join("")}</ul>`
    : '<p class="empty">No simulation interviews yet.</p>';
  const allowed = memberSims(ctx.user);
  return layout(ctx, {
    title: "Simulation interviews",
    section: "interviews",
    body: `<div class="split">
      <div>
        <h1>Simulation interviews</h1>
        <p>Request a simulation interview for a role in a company you belong to. Another member can run it. It is not a hire.</p>
        ${rows}
      </div>
      <form class="panel stack" method="post" action="/interviews">
        <h2>Request one</h2>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <fieldset><legend>Simulation</legend>${simulationChoices(ctx.user.simulation, allowed)}</fieldset>
        <label>Simulation role <input name="practice_role" required maxlength="80"></label>
        <label>What you want to try <textarea name="note" maxlength="2000"></textarea></label>
        <button type="submit">Request simulation interview</button>
      </form>
    </div>`,
  });
}

export function interviewPage(ctx, { interview, notes, error }) {
  const me = ctx.user.id;
  const running = interview.status === "running";
  const open = interview.status === "open";
  const complete = interview.status === "complete";
  const isRequester = interview.requester_id === me;
  const isInterviewer = interview.interviewer_id === me;
  const canNote = (isRequester && (open || running)) || (isInterviewer && running);
  const partner = isRequester ? interview.interviewer_id : isInterviewer ? interview.requester_id : null;
  const partnerName = isRequester ? interview.interviewer_name : interview.requester_name;
  const script = `<ol class="steps">${INTERVIEW_SCRIPT.map((line) => `<li>${esc(line)}</li>`).join("")}</ol>`;
  const claim =
    open && !isRequester
      ? `<form method="post" action="/interviews/${interview.id}/claim">${csrf(ctx)}<button type="submit">Run this simulation interview</button></form>`
      : "";
  const call =
    partner && (running || complete)
      ? directCall(ctx, partner, partnerName || "Member", `Talk with ${partnerName || "Member"} by phone while you run the simulation interview.`)
      : "";
  const feedback = complete
    ? `<section class="panel"><h2>Simulation feedback</h2>${paragraphs(interview.feedback)}</section>`
    : "";
  const finish =
    isInterviewer && running
      ? `<form class="stack" method="post" action="/interviews/${interview.id}/complete">
          <h2>Close the simulation interview</h2>
          ${csrf(ctx)}
          <label>Simulation feedback <textarea name="feedback" required minlength="20" maxlength="2000"></textarea></label>
          <button type="submit">Mark the simulation interview closed</button>
        </form>`
      : "";
  return layout(ctx, {
    title: "Simulation interview",
    section: "interviews",
    call: Boolean(call),
    body: `<p class="tag">Simulation interview · ${esc(interview.status)}</p>
      <h1>${esc(interview.practice_role)}</h1>
      <p>${esc(simName(interview.simulation))} · requested by ${esc(interview.requester_name)}${interview.interviewer_name ? ` · running with ${esc(interview.interviewer_name)}` : ""}</p>
      ${interview.note ? paragraphs(interview.note) : ""}
      <section><h2>Simulation script</h2>${script}</section>
      ${claim}
      ${call}
      ${feedback}
      <section>
        <h2>Simulation notes</h2>
        <div id="note-list" data-live="/interviews/${interview.id}/notes?fragment=1">${notesHtml(notes)}</div>
        ${canNote ? noteForm(ctx, `/interviews/${interview.id}/notes`, error) : ""}
        ${finish}
      </section>`,
  });
}

function directCall(ctx, partnerId, partnerName, lead) {
  return `<section class="panel" id="simulation-call">
    <h2>Simulation phone</h2>
    <p class="tag">Simulation call</p>
    <p>${esc(lead)}</p>
    <div id="call-app" data-kind="direct" data-me="${ctx.user.id}" data-user="${partnerId}">
      <p id="call-status" role="status"></p>
      <p class="presence" id="direct-presence">Checking the line…</p>
      <button type="button" data-ring="audio" disabled>Phone</button>
      <div id="incoming" class="incoming" hidden>
        <p id="incoming-label"></p>
        <button type="button" id="accept">Join simulation call</button>
        <button type="button" id="decline" class="secondary">Decline</button>
      </div>
      <div id="call-stage" hidden>
        <div class="videos">
          <div class="peer"><video id="local-video" autoplay playsinline muted></video><p>You</p></div>
          <div class="peer"><video id="remote-video" autoplay playsinline></video><p>${esc(partnerName)}</p></div>
        </div>
        <button type="button" id="hangup" class="warn">End simulation call</button>
      </div>
    </div>
    <script type="application/json" id="member-names">${jsonScript({ [partnerId]: partnerName })}</script>
  </section>`;
}

export function supportPage(ctx, { notes, error }) {
  const rows = notes.length
    ? `<ul class="notes">${notes
        .map((note) => {
          const name = note.member_name || note.display_name || "Someone";
          const amount = note.amount_cents ? `$${(note.amount_cents / 100).toFixed(2)}` : "Amount not set";
          return `<li><strong>${esc(name)}</strong> <span>${amount}</span> ${note.note ? `<p>${esc(note.note)}</p>` : ""}<small>Recorded. No card was charged.</small></li>`;
        })
        .join("")}</ul>`
    : '<p class="empty">No support notes yet.</p>';
  return layout(ctx, {
    title: "Support",
    section: "support",
    body: `<section class="narrow">
      <h1>Support ${esc(STUDIO.name)}</h1>
      <p class="lede">Optional donation.</p>
      <p>This form does not charge a card. It records that you want to support the studio. The Notchday employee option is a separate simulation membership, and that gate does not charge a card either.</p>
      ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
      <form class="stack" method="post" action="/support">
        ${csrf(ctx)}
        <div class="hp" aria-hidden="true"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></div>
        ${ctx.user ? "" : '<label>Name <input name="display_name" maxlength="80"></label>'}
        <fieldset><legend>Amount, if you want to name one</legend>
          <label class="choice"><input type="radio" name="amount" value="5"> <span>$5</span></label>
          <label class="choice"><input type="radio" name="amount" value="15"> <span>$15</span></label>
          <label class="choice"><input type="radio" name="amount" value="40"> <span>$40</span></label>
          <label>Other amount <input name="custom_amount" inputmode="decimal" placeholder="25"></label>
        </fieldset>
        <label>Note <textarea name="note" maxlength="280"></textarea></label>
        <button type="submit">Record a donation</button>
      </form>
      <h2>Recent notes</h2>
      ${rows}
    </section>`,
  });
}

export function scoreboardPage(ctx, { rivalries, scores }) {
  const rows = rivalries.length
    ? `<ul class="cards">${rivalries
        .map((pair) => {
          const left = SIMS[pair.left_sim];
          const right = SIMS[pair.right_sim];
          return `<li>
            <strong>${esc(left.name)}</strong> <span>${scores[pair.left_sim]}</span>
            <span>versus</span>
            <strong>${esc(right.name)}</strong> <span>${scores[pair.right_sim]}</span>
            ${isCeo(ctx.user) ? `<form method="post" action="/rivalries/clear">${csrf(ctx)}<input type="hidden" name="left" value="${esc(pair.left_sim)}"><input type="hidden" name="right" value="${esc(pair.right_sim)}"><button class="secondary" type="submit">Clear</button></form>` : ""}
          </li>`;
        })
        .join("")}</ul>`
    : '<p class="empty">No companies are competing. The rooms are still separate.</p>';
  const form = isCeo(ctx.user)
    ? `<form class="panel stack" method="post" action="/rivalries">
        <h2>Set two companies competing</h2>
        ${csrf(ctx)}
        <label>Company <select name="left">${Object.entries(SIMS).map(([id, sim]) => `<option value="${id}">${esc(sim.name)}</option>`).join("")}</select></label>
        <label>Company <select name="right">${Object.entries(SIMS).map(([id, sim]) => `<option value="${id}">${esc(sim.name)}</option>`).join("")}</select></label>
        <button type="submit">Set them competing</button>
      </form>`
    : "<p>Hanna can set companies to compete. The tally is a joke score from rooms, check-ins, files, pitches, and shared graphs.</p>";
  return layout(ctx, {
    title: "Scoreboard",
    section: "scoreboard",
    body: `<section>
      <h1>Company scoreboard</h1>
      <p>Companies can be set to compete. The tally counts simulation chatter, check-ins, shared files, pitches, votes, and shared graphs. It is a joke score.</p>
      ${rows}
      ${form}
    </section>`,
  });
}

export function messagePage(ctx, { title, statusText, body }) {
  return layout(ctx, {
    title,
    section: "",
    body: `<section class="narrow"><h1>${esc(title)}</h1><p>${esc(statusText)}</p>${body || ""}</section>`,
  });
}

export function plainFragment(html) {
  return html;
}
