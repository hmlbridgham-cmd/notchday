import { existsSync } from "node:fs";
import { join } from "node:path";
import { BANNER, NOTICES, SIMS, STUDIO_PHONE, STUDIO_PHONE_TEL } from "./copy.mjs";
import { esc, formatStamp, jsonForScript, paragraphs } from "./format.mjs";

export { esc, formatStamp, paragraphs, jsonForScript };

const ROOT = join(import.meta.dirname, "..");

export function logo(id, label, size = "md") {
  const file = join(ROOT, "public", "logos", `${id}.png`);
  if (existsSync(file)) {
    return `<img class="logo-img logo-${size}" data-logo="${esc(id)}" src="/logos/${esc(id)}.png" alt="${esc(label)} logo" width="128" height="128">`;
  }
  return `<div class="logo-slot logo-${size}" data-logo="${esc(id)}" role="img" aria-label="${esc(label)} logo"><span>${esc(label)}</span><small>Logo</small></div>`;
}

export function layout(ctx, { title, section, body, call = false, world = "" }) {
  const user = ctx.user;
  const tone = SIMS[world]
    ? world
    : section === "home"
      ? ""
      : SIMS[section]
        ? section
        : user?.simulation && SIMS[user.simulation]
          ? user.simulation
          : "";
  const notice = ctx.notice ? `<p class="notice" role="status">${esc(ctx.notice)}</p>` : "";
  const account = user
    ? `<div class="account">
        <a href="/profile">${esc(user.name)}</a>
        ${user.studio_role === "CEO" ? '<span class="ceo">CEO of Daymark</span>' : ""}
        <form method="post" action="/logout">${csrf(ctx)}<button class="textish" type="submit">Log out</button></form>
      </div>`
    : `<div class="account"><a href="/login">Log in</a><a class="button" href="/signup">Create account</a></div>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · Daymark</title>
  <meta name="description" content="Daymark is a simulation studio for practicing a remote-work day. Copperline, Kindling, and Quarry are simulations.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/app.css">
</head>
<body data-user-id="${user ? esc(user.id) : ""}" data-section="${esc(section || "")}" data-world="${esc(tone)}">
  <a class="skip" href="#content">Skip to content</a>
  <p class="banner">${esc(BANNER)}</p>
  <header class="top">
    <a class="brand" href="${user ? "/desk" : "/"}">${logo("daymark", "Daymark", "sm")}<span>Daymark</span></a>
    <nav>
      ${navLink("/desk", "Desk", section, Boolean(user))}
      ${navLink("/chats", "Chat", section, Boolean(user))}
      ${navLink("/copperline", "Copperline", section)}
      ${navLink("/kindling", "Kindling", section)}
      ${navLink("/quarry", "Quarry", section)}
      ${navLink("/calendar", "Calendar", section)}
      ${navLink("/support", "Support", section)}
    </nav>
    ${account}
  </header>
  <main id="content">
    ${notice}
    ${body}
  </main>
  <footer class="foot">
    <p>Daymark · Hanna Bridgham, CEO of Daymark</p>
    <p>Studio contact <a href="tel:${STUDIO_PHONE_TEL}">${esc(STUDIO_PHONE)}</a></p>
    <p>${esc(BANNER)}</p>
  </footer>
  <script src="/app.js"></script>
  ${call ? '<script src="/call.js"></script>' : ""}
</body>
</html>`;
}

function navLink(href, label, section, show = true) {
  if (!show) return "";
  const key = href.replace("/", "") || "home";
  const current = section === key ? ' aria-current="page"' : "";
  return `<a href="${href}"${current}>${label}</a>`;
}

export function csrf(ctx) {
  return `<input type="hidden" name="csrf" value="${esc(ctx.session?.csrf || "")}">`;
}

export function simName(id) {
  return SIMS[id]?.name || "Simulation";
}

export function avatarHtml(user, size = "") {
  const klass = size ? `avatar ${size}` : "avatar";
  if (user.avatar_type) {
    return `<img class="${klass}" src="/avatars/${esc(user.id)}" alt="">`;
  }
  const letter = esc(String(user.name || "?").trim().charAt(0).toUpperCase() || "?");
  return `<span class="${klass}" aria-hidden="true">${letter}</span>`;
}

export function person(user) {
  const ceo = user.studio_role === "CEO" ? '<span class="ceo">CEO of Daymark</span>' : "";
  const title = user.practice_title || "Practice job title not set";
  const role = user.practice_role || "Practice role not set";
  const sim = user.simulation ? simName(user.simulation) : "No simulation yet";
  return `<div class="person">
    ${avatarHtml(user)}
    <div class="who">
      <strong>${esc(user.name)}</strong>
      ${ceo}
      <span>${esc(sim)}</span>
      <span>${esc(title)}</span>
      <span>${esc(role)}</span>
      <small>Practice profile</small>
    </div>
  </div>`;
}

export function notesHtml(notes) {
  if (!notes.length) return '<p class="empty">No practice notes yet.</p>';
  return notes
    .map(
      (note) => `<article class="note">
        <p class="tag">Practice note</p>
        <header><strong>${esc(note.author_name)}</strong> <time datetime="${esc(note.created_at)}">${esc(formatStamp(note.created_at))}</time></header>
        ${paragraphs(note.body)}
      </article>`,
    )
    .join("");
}

export function noticeText(code) {
  return NOTICES[code] || "";
}

export function simulationChoices(selected) {
  return Object.entries(SIMS)
    .map(([id, sim]) => {
      const checked = selected === id ? " checked" : "";
      return `<label class="choice">
        <input type="radio" name="simulation" value="${id}"${checked} required>
        <span><strong>${esc(sim.name)}</strong><small>${esc(sim.line)}. ${esc(sim.summary)}</small></span>
      </label>`;
    })
    .join("");
}
