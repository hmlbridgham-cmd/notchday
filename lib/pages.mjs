import { INTERVIEW_SCRIPT, SIMS, STUDIO_PHONE, STUDIO_PHONE_TEL } from "./copy.mjs";
import { esc, formatStamp, paragraphs } from "./format.mjs";
import { csrf, layout, logo, notesHtml, person, simName, simulationChoices } from "./html.mjs";
import { CITIES } from "./quarry.mjs";

export function homePage(ctx) {
  const cards = Object.entries(SIMS)
    .map(
      ([id, sim]) => `<a class="sim-card sim-${id}" href="/${id}">
        ${logo(id, sim.name, "lg")}
        <div>
          <p class="tag">${esc(sim.line)}</p>
          <h2>${esc(sim.name)}</h2>
          <p>${esc(sim.summary)}</p>
        </div>
      </a>`,
    )
    .join("");
  return layout(ctx, {
    title: "Studio",
    section: "home",
    body: `<section class="hero">
      ${logo("daymark", "Daymark", "lg")}
      <div>
        <p class="eyebrow">Simulation studio</p>
        <h1>Daymark</h1>
        <p class="lede">Hanna Bridgham, CEO of Daymark.</p>
        <p>Studio contact <a href="tel:${STUDIO_PHONE_TEL}">${esc(STUDIO_PHONE)}</a></p>
        <p>A studio for practicing a remote-work day. Create a member account, pick one simulation, a practice job title, and a practice role, then practice with other members.</p>
        <p class="actions">${ctx.user ? '<a class="button" href="/desk">Your desk</a>' : '<a class="button" href="/signup">Create account</a><a class="button secondary" href="/support">Support the studio</a>'}</p>
      </div>
    </section>
    <section class="stack-lg">${cards}</section>
    <section class="panel">
      <h2>A practice day</h2>
      <ol class="steps">
        <li>Create an account. It costs nothing.</li>
        <li>Pick Copperline, Kindling, or Quarry. Change it anytime.</li>
        <li>Form a practice team and assign practice tasks.</li>
        <li>Put a simulation meeting on the calendar and join it.</li>
        <li>Request a simulation interview, or run one for another member.</li>
      </ol>
      <p>Support is an optional donation. There is no subscription and no paywall.</p>
    </section>`,
  });
}

export function simPage(ctx, id) {
  const sim = SIMS[id];
  const enter = enterLink(ctx, id);
  return layout(ctx, {
    title: sim.name,
    section: id,
    body: `<article class="sim-hero sim-${id}">
      ${logo(id, sim.name, "lg")}
      <div>
        <p class="tag">${esc(sim.line)}</p>
        <h1>${esc(sim.name)}</h1>
        <p class="lede">${esc(sim.summary)}</p>
        ${simBody(id)}
        <p class="actions">${enter}</p>
      </div>
    </article>`,
  });
}

function simBody(id) {
  if (id === "copperline") {
    return `<p>On the call floor, members place practice phone calls and practice video calls with each other. A simulation meeting on this floor can include a group practice call.</p>`;
  }
  if (id === "kindling") {
    return `<p>The ideas table is a shared board. Members add a practice idea and other members build on it with notes.</p>`;
  }
  return `<p>The data room pulls public figures from the World Bank, the USGS earthquake feed, and Open-Meteo. Members chart them, write a short practice report, and can share that report with other members.</p>`;
}

function enterLink(ctx, id) {
  if (!ctx.user) return `<a class="button" href="/signup">Create account</a>`;
  if (ctx.user.simulation === id) {
    const href = id === "copperline" ? "/copperline/floor" : id === "kindling" ? "/kindling/table" : "/quarry/room";
    return `<a class="button" href="${href}">Enter ${esc(SIMS[id].name)}</a>`;
  }
  return `<a class="button secondary" href="/profile">Pick ${esc(SIMS[id].name)} on your profile</a>`;
}

export function authPage(ctx, { mode, error, values, next }) {
  const login = mode === "login";
  const title = login ? "Log in" : "Create account";
  const action = login ? "/login" : "/signup";
  const extra = login
    ? `<input type="hidden" name="next" value="${esc(next || "/desk")}">
       <label>Email <input name="email" type="email" autocomplete="username" required value="${esc(values.email || "")}"></label>
       <label>Password <input name="password" type="password" autocomplete="current-password" required></label>`
    : `<p class="hint">A practice job title is for the simulation you pick. It is not employment.</p>
       <label>Name <input name="name" required maxlength="80" value="${esc(values.name || "")}"></label>
       <label>Email <input name="email" type="email" autocomplete="username" required value="${esc(values.email || "")}"></label>
       <label>Password <input name="password" type="password" autocomplete="new-password" required minlength="8"> <small>At least 8 characters.</small></label>
       <fieldset><legend>Simulation</legend>${simulationChoices(values.simulation)}</fieldset>
       <label>Practice job title <input name="practice_title" required maxlength="80" value="${esc(values.practice_title || "")}"></label>
       <label>Practice role <input name="practice_role" required maxlength="80" value="${esc(values.practice_role || "")}"></label>`;
  return layout(ctx, {
    title,
    section: mode,
    body: `<section class="narrow">
      <h1>${title}</h1>
      ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
      <form class="stack" method="post" action="${action}">
        ${csrf(ctx)}
        ${extra}
        <button type="submit">${title}</button>
      </form>
      <p>${login ? 'No account yet? <a href="/signup">Create one</a>.' : 'Already a member? <a href="/login">Log in</a>.'}</p>
    </section>`,
  });
}

export function deskPage(ctx, { tasks, meetings }) {
  const user = ctx.user;
  const sim = user.simulation ? SIMS[user.simulation] : null;
  const enter = sim ? enterLink(ctx, user.simulation) : `<a class="button" href="/profile">Set your practice profile</a>`;
  return layout(ctx, {
    title: "Desk",
    section: "desk",
    body: `<section class="split">
      <div>
        <p class="eyebrow">Member desk</p>
        <h1>${esc(user.name)}</h1>
        ${user.studio_role === "CEO" ? "<p class=\"lede\">CEO of Daymark.</p>" : ""}
        ${person(user)}
        <p class="actions">${enter}<a class="button secondary" href="/profile">Change practice profile</a></p>
      </div>
      <div class="panel">
        <h2>From here</h2>
        <ul class="link-list">
          <li><a href="/teams">Practice teams and tasks</a></li>
          <li><a href="/calendar">Simulation calendar</a></li>
          <li><a href="/interviews">Simulation interviews</a></li>
          <li><a href="/members">Members</a></li>
          <li><a href="/support">Optional donation</a></li>
        </ul>
      </div>
    </section>
    <section>
      <h2>Your simulation meetings</h2>
      ${meetingList(meetings)}
    </section>
    <section>
      <h2>Practice tasks on your teams</h2>
      ${taskList(tasks)}
    </section>`,
  });
}

export function profilePage(ctx, { error, values }) {
  const user = ctx.user;
  const current = values || user;
  return layout(ctx, {
    title: "Practice profile",
    section: "profile",
    body: `<section class="narrow">
      <h1>Practice profile</h1>
      ${user.studio_role === "CEO" ? `<p class="lede">Studio role: CEO of Daymark.</p><p>That studio role stays put. The fields below are the simulation you are practicing.</p>` : ""}
      <p class="hint">Pick one simulation, a practice job title, and a practice role. You can change them anytime. Switching simulations removes you from practice teams on the previous floor.</p>
      ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
      <form class="stack" method="post" action="/profile">
        ${csrf(ctx)}
        <fieldset><legend>Simulation</legend>${simulationChoices(current.simulation)}</fieldset>
        <label>Practice job title <input name="practice_title" required maxlength="80" value="${esc(current.practice_title || "")}"></label>
        <label>Practice role <input name="practice_role" required maxlength="80" value="${esc(current.practice_role || "")}"></label>
        <button type="submit">Save practice profile</button>
      </form>
    </section>`,
  });
}

export function membersPage(ctx, users) {
  const groups = ["copperline", "kindling", "quarry"]
    .map((id) => {
      const people = users.filter((user) => user.simulation === id);
      const cards = people.length ? people.map(person).join("") : '<p class="empty">No members in this simulation yet.</p>';
      return `<section><h2>${esc(SIMS[id].name)}</h2><div class="people">${cards}</div></section>`;
    })
    .join("");
  const unset = users.filter((user) => !user.simulation);
  const waiting = unset.length
    ? `<section><h2>No simulation yet</h2><div class="people">${unset.map(person).join("")}</div></section>`
    : "";
  return layout(ctx, {
    title: "Members",
    section: "members",
    body: `<h1>Members</h1>
      <p>Practice profiles inside Daymark. A name here is a member of the studio, not a hire.</p>
      ${groups}${waiting}`,
  });
}

export function teamsPage(ctx, { teams, error }) {
  const sim = ctx.user.simulation;
  return layout(ctx, {
    title: "Practice teams",
    section: "teams",
    body: `<section class="split">
      <div>
        <h1>Practice teams</h1>
        <p>Form a team with other members in ${esc(simName(sim))} and assign practice tasks.</p>
        ${teams.length ? teamCards(teams) : '<p class="empty">You are not on a practice team yet.</p>'}
      </div>
      <form class="panel stack" method="post" action="/teams">
        <h2>New practice team</h2>
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
    body: `<p class="tag">Practice team · ${esc(simName(team.simulation))} simulation</p>
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
          ${others.length ? `<label>Member <select name="user_id" required>${others.map((user) => `<option value="${user.id}">${esc(user.name)}</option>`).join("")}</select></label><button type="submit">Add to team</button>` : '<p class="empty">Every member already in this simulation is on the team, or no one else has picked it yet.</p>'}
        </form>
      </div>
      <section>
        <h2>Practice tasks</h2>
        ${taskList(tasks, { actions: true, csrfToken: ctx.session?.csrf || "" })}
        <form class="panel stack" method="post" action="/teams/${team.id}/tasks">
          <h3>Assign a practice task</h3>
          ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
          ${csrf(ctx)}
          <label>Task <input name="title" required maxlength="120"></label>
          <label>Detail <textarea name="detail" maxlength="2000"></textarea></label>
          <label>Assign to <select name="assignee_id" required>${members.map((user) => `<option value="${user.id}">${esc(user.name)}</option>`).join("")}</select></label>
          <button type="submit">Assign practice task</button>
        </form>
      </section>`,
  });
}

export function taskList(tasks, { actions = false, csrfToken = "" } = {}) {
  if (!tasks.length) return '<p class="empty">No practice tasks yet.</p>';
  return `<ul class="tasks">${tasks
    .map((task) => {
      const state = task.status === "done" ? "Practice finished" : "Open practice";
      const toggle = actions
        ? `<form method="post" action="/tasks/${task.id}"><input type="hidden" name="csrf" value="${esc(csrfToken)}"><input type="hidden" name="status" value="${task.status === "done" ? "open" : "done"}"><button class="secondary" type="submit">${task.status === "done" ? "Reopen practice" : "Mark practice finished"}</button></form>`
        : "";
      return `<li>
        <p class="tag">Practice task · simulation</p>
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
  const heads = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map((day) => `<div class="cal-head">${day}</div>`)
    .join("");
  const days = cells
    .map((cell) => {
      if (!cell) return '<div class="day is-out"></div>';
      const pills = cell.meetings
        .map(
          (meeting) =>
            `<a class="meet-pill" href="/meetings/${meeting.id}">${esc(meeting.title)}</a>`,
        )
        .join("");
      return `<div class="day"><span>${cell.day}</span>${pills}</div>`;
    })
    .join("");
  const form = ctx.user.simulation
    ? `<form class="panel stack" method="post" action="/meetings">
        <h2>New simulation meeting</h2>
        <p class="hint">This meeting is inside ${esc(simName(ctx.user.simulation))}. Any member currently in that simulation can view it and join.</p>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Title <input name="title" required maxlength="120" value="${esc(values.title || "")}"></label>
        <label>Starts <input name="starts_at" type="datetime-local" required value="${esc(values.starts_at || "")}"></label>
        <label>Ends <input name="ends_at" type="datetime-local" required value="${esc(values.ends_at || "")}"></label>
        <label>Agenda <textarea name="agenda" maxlength="2000">${esc(values.agenda || "")}</textarea></label>
        ${members.length ? `<fieldset><legend>Invite members</legend>${members.map((member) => `<label class="choice"><input type="checkbox" name="with" value="${member.id}"><span>${esc(member.name)}</span></label>`).join("")}</fieldset>` : '<p class="empty">No other members are in this simulation yet. You can still put a meeting on the calendar.</p>'}
        <button type="submit">Create simulation meeting</button>
      </form>`
    : `<div class="panel"><h2>New simulation meeting</h2><p>Pick a simulation before you schedule one.</p><a class="button" href="/profile">Practice profile</a></div>`;
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
        <p class="tag">Simulation meeting · practice</p>
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
  const call = meeting.simulation === "copperline" && joined;
  const names = Object.fromEntries(members.map((member) => [member.id, member.name]));
  return layout(ctx, {
    title: meeting.title,
    section: "calendar",
    call,
    body: `<p class="tag">Simulation meeting · practice · ${esc(simName(meeting.simulation))}</p>
      <h1>${esc(meeting.title)}</h1>
      <p><time datetime="${esc(meeting.starts_at)}">${esc(formatStamp(meeting.starts_at))}</time> to <time datetime="${esc(meeting.ends_at)}">${esc(formatStamp(meeting.ends_at))}</time></p>
      ${meeting.agenda ? `<section><h2>Agenda</h2>${paragraphs(meeting.agenda)}</section>` : ""}
      <section><h2>Members</h2><ul class="plain">${members
        .map(
          (member) =>
            `<li>${esc(member.name)} · ${member.state === "joined" ? "Joined" : "Invited"} · practice profile</li>`,
        )
        .join("")}</ul></section>
      ${joined ? "" : `<form method="post" action="/meetings/${meeting.id}/join">${csrf(ctx)}<button type="submit">Join simulation meeting</button></form>`}
      ${call ? roomCall(ctx, meeting, names) : ""}
      <section>
        <h2>Practice notes</h2>
        <div id="note-list" data-live="/meetings/${meeting.id}/notes?fragment=1">${notesHtml(notes)}</div>
        ${joined ? noteForm(ctx, `/meetings/${meeting.id}/notes`, error) : "<p class=\"hint\">Join the meeting to add a practice note.</p>"}
      </section>`,
  });
}

function roomCall(ctx, meeting, names) {
  return `<section class="panel">
    <h2>Practice call</h2>
    <p>Phone and video for members who have joined this Copperline meeting. The product is the conversation.</p>
    <div id="call-app" data-kind="room" data-me="${ctx.user.id}" data-meeting="${meeting.id}">
      <p id="call-status" role="status"></p>
      <button type="button" id="join-room">Join practice call</button>
      <div id="call-stage" hidden>
        <div class="videos">
          <div class="peer"><video id="local-video" autoplay playsinline muted></video><p>You</p></div>
          <div id="peer-videos"></div>
        </div>
        <button type="button" id="hangup" class="warn">Leave practice call</button>
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
    <label>Practice note <textarea name="body" required maxlength="2000"></textarea></label>
    <button type="submit">Add practice note</button>
  </form>`;
}

export function floorPage(ctx, members) {
  const others = members.filter((member) => member.id !== ctx.user.id);
  const names = Object.fromEntries(members.map((member) => [member.id, member.name]));
  const roster = others.length
    ? `<ul class="roster">${others
        .map(
          (member) => `<li class="roster-item" data-user="${member.id}">
            ${person(member)}
            <p class="presence" data-presence="${member.id}">Not on the line right now</p>
            <button type="button" data-ring="audio" disabled>Phone</button>
            <button type="button" data-ring="video" disabled>Video</button>
          </li>`,
        )
        .join("")}</ul>`
    : '<p class="empty">You are the only member in Copperline right now. When another member picks this simulation, you can start a practice phone or video call.</p>';
  return layout(ctx, {
    title: "Copperline floor",
    section: "copperline",
    call: true,
    body: `<p class="tag">Call-floor simulation</p>
      <h1>Copperline</h1>
      <p class="lede">${esc(SIMS.copperline.summary)}</p>
      <div id="call-app" data-kind="floor" data-me="${ctx.user.id}">
        <p id="call-status" role="status"></p>
        ${roster}
        <div id="incoming" class="incoming" hidden>
          <p id="incoming-label"></p>
          <button type="button" id="accept">Join practice call</button>
          <button type="button" id="decline" class="secondary">Decline</button>
        </div>
        <div id="call-stage" hidden>
          <div class="videos">
            <div class="peer"><video id="local-video" autoplay playsinline muted></video><p>You</p></div>
            <div class="peer"><video id="remote-video" autoplay playsinline></video><p id="remote-label">Member</p></div>
          </div>
          <button type="button" id="hangup" class="warn">End practice call</button>
        </div>
      </div>
      <script type="application/json" id="member-names">${jsonScript(names)}</script>`,
  });
}

export function ideasPage(ctx, { ideas, error, canWrite }) {
  const list = ideas.length
    ? `<ul class="cards">${ideas
        .map(
          (idea) => `<li><a href="/kindling/ideas/${idea.id}">
            <p class="tag">Practice idea</p>
            <strong>${esc(idea.title)}</strong>
            <span>${esc(idea.author_name)}</span>
            <span>${idea.note_count} practice notes</span>
          </a></li>`,
        )
        .join("")}</ul>`
    : '<p class="empty">The ideas table is empty.</p>';
  const form = canWrite
    ? `<form class="panel stack" method="post" action="/kindling/ideas">
        <h2>Add a practice idea</h2>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <label>Title <input name="title" required maxlength="120"></label>
        <label>The idea <textarea name="pitch" required maxlength="2000"></textarea></label>
        <button type="submit">Put it on the table</button>
      </form>`
    : `<div class="panel"><p>Switch your simulation to Kindling to add a practice idea.</p><a class="button" href="/profile">Practice profile</a></div>`;
  return layout(ctx, {
    title: "Kindling table",
    section: "kindling",
    body: `<p class="tag">Ideas-table simulation</p>
      <h1>Kindling</h1>
      <p class="lede">${esc(SIMS.kindling.summary)}</p>
      <div class="split"><div>${list}</div>${form}</div>`,
  });
}

export function ideaPage(ctx, { idea, notes, error, canWrite }) {
  return layout(ctx, {
    title: idea.title,
    section: "kindling",
    body: `<p class="tag">Practice idea · Kindling simulation</p>
      <h1>${esc(idea.title)}</h1>
      <p>${esc(idea.author_name)}${idea.author_title ? ` · ${esc(idea.author_title)}` : ""}</p>
      ${paragraphs(idea.pitch)}
      <section>
        <h2>Build on it</h2>
        <div id="note-list" data-live="/kindling/ideas/${idea.id}/notes?fragment=1">${notesHtml(notes)}</div>
        ${canWrite ? noteForm(ctx, `/kindling/ideas/${idea.id}/notes`, error) : "<p class=\"hint\">Switch to Kindling to add a practice note.</p>"}
      </section>`,
  });
}

export function quarryPage(ctx, { reports, dataset, city, chartHtml, error, canWrite }) {
  const cityOptions = CITIES.map(
    (item) => `<option value="${item.id}"${item.id === city ? " selected" : ""}>${esc(item.name)}</option>`,
  ).join("");
  const builder = canWrite
    ? `<form class="panel stack" method="get" action="/quarry/room">
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
    : `<div class="panel"><p>Switch your simulation to Quarry to chart public data and write a practice report.</p><a href="/profile">Practice profile</a></div>`;
  const writer =
    canWrite && chartHtml
      ? `<form class="stack" method="post" action="/quarry/reports">
          <h2>Short practice report</h2>
          ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
          ${csrf(ctx)}
          <input type="hidden" name="dataset" value="${esc(dataset)}">
          <input type="hidden" name="city" value="${esc(city || "")}">
          <label>Title <input name="title" required maxlength="120"></label>
          <label>Report <textarea name="body" required minlength="40" maxlength="5000"></textarea></label>
          <button type="submit">Save practice report</button>
        </form>`
      : "";
  return layout(ctx, {
    title: "Quarry room",
    section: "quarry",
    body: `<p class="tag">Data-room simulation</p>
      <h1>Quarry</h1>
      <p class="lede">${esc(SIMS.quarry.summary)}</p>
      <div class="split">
        <div>
          ${builder}
          ${chartHtml || ""}
          ${writer}
        </div>
        <section>
          <h2>Shared practice reports</h2>
          ${reportList(reports)}
        </section>
      </div>`,
  });
}

function reportList(reports) {
  if (!reports.length) return '<p class="empty">No shared practice reports yet.</p>';
  return `<ul class="cards">${reports
    .map(
      (report) => `<li><a href="/reports/${report.id}">
        <p class="tag">Practice report${report.shared ? " · shared" : ""}</p>
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
    section: "quarry",
    body: `<p class="tag">Practice report · Quarry simulation${report.shared ? " · shared" : ""}</p>
      <h1>${esc(report.title)}</h1>
      <p>${esc(report.author_name)} · ${esc(report.source_label)}</p>
      ${chartHtml}
      ${paragraphs(report.body)}
      ${mine ? `<form method="post" action="/reports/${report.id}/share">${csrf(ctx)}<button class="secondary" type="submit">${report.shared ? "Stop sharing" : "Share with members"}</button></form>` : ""}`,
  });
}

export function interviewsPage(ctx, { interviews, error }) {
  const rows = interviews.length
    ? `<ul class="cards">${interviews
        .map(
          (item) => `<li><a href="/interviews/${item.id}">
            <p class="tag">Simulation interview · practice · ${esc(item.status)}</p>
            <strong>${esc(item.practice_role)}</strong>
            <span>${esc(simName(item.simulation))}</span>
            <span>Requested by ${esc(item.requester_name)}</span>
          </a></li>`,
        )
        .join("")}</ul>`
    : '<p class="empty">No simulation interviews yet.</p>';
  return layout(ctx, {
    title: "Simulation interviews",
    section: "interviews",
    body: `<div class="split">
      <div>
        <h1>Simulation interviews</h1>
        <p>Request a practice interview for a simulation role. Another member can run it inside Daymark.</p>
        ${rows}
      </div>
      <form class="panel stack" method="post" action="/interviews">
        <h2>Request one</h2>
        ${error ? `<p class="form-error" role="alert">${esc(error)}</p>` : ""}
        ${csrf(ctx)}
        <fieldset><legend>Simulation</legend>${simulationChoices(ctx.user.simulation)}</fieldset>
        <label>Practice role <input name="practice_role" required maxlength="80"></label>
        <label>What you want to practice <textarea name="note" maxlength="2000"></textarea></label>
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
      ? directCall(ctx, partner, partnerName || "Member")
      : "";
  const feedback = complete
    ? `<section class="panel"><h2>Practice feedback</h2><p class="tag">Practice complete</p>${paragraphs(interview.feedback)}</section>`
    : "";
  const finish =
    isInterviewer && running
      ? `<form class="stack" method="post" action="/interviews/${interview.id}/complete">
          <h2>Close the practice</h2>
          ${csrf(ctx)}
          <label>Practice feedback <textarea name="feedback" required minlength="20" maxlength="2000"></textarea></label>
          <button type="submit">Mark practice complete</button>
        </form>`
      : "";
  return layout(ctx, {
    title: "Simulation interview",
    section: "interviews",
    call: Boolean(call),
    body: `<p class="tag">Simulation interview · practice · ${esc(interview.status)}</p>
      <h1>${esc(interview.practice_role)}</h1>
      <p>${esc(simName(interview.simulation))} · requested by ${esc(interview.requester_name)}${interview.interviewer_name ? ` · running with ${esc(interview.interviewer_name)}` : ""}</p>
      ${interview.note ? paragraphs(interview.note) : ""}
      <section><h2>Practice script</h2>${script}</section>
      ${claim}
      ${call}
      ${feedback}
      <section>
        <h2>Practice notes</h2>
        <div id="note-list" data-live="/interviews/${interview.id}/notes?fragment=1">${notesHtml(notes)}</div>
        ${canNote ? noteForm(ctx, `/interviews/${interview.id}/notes`, error) : ""}
        ${finish}
      </section>`,
  });
}

function directCall(ctx, partnerId, partnerName) {
  return `<section class="panel">
    <h2>Practice call</h2>
    <p>Talk with ${esc(partnerName)} by phone or video while you run the simulation interview.</p>
    <div id="call-app" data-kind="direct" data-me="${ctx.user.id}" data-user="${partnerId}">
      <p id="call-status" role="status"></p>
      <p class="presence" id="direct-presence">Checking the line…</p>
      <button type="button" data-ring="audio" disabled>Phone</button>
      <button type="button" data-ring="video" disabled>Video</button>
      <div id="incoming" class="incoming" hidden>
        <p id="incoming-label"></p>
        <button type="button" id="accept">Join practice call</button>
        <button type="button" id="decline" class="secondary">Decline</button>
      </div>
      <div id="call-stage" hidden>
        <div class="videos">
          <div class="peer"><video id="local-video" autoplay playsinline muted></video><p>You</p></div>
          <div class="peer"><video id="remote-video" autoplay playsinline></video><p>${esc(partnerName)}</p></div>
        </div>
        <button type="button" id="hangup" class="warn">End practice call</button>
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
      <h1>Support Daymark</h1>
      <p class="lede">Optional donation.</p>
      <p>Studio contact <a href="tel:${STUDIO_PHONE_TEL}">${esc(STUDIO_PHONE)}</a></p>
      <p>Paying does not change what you can use. There is no subscription and no paywall. This form does not charge a card. It records that you want to support the studio.</p>
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
