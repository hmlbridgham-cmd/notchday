import { existsSync } from "node:fs";
import { join } from "node:path";
import { isCeo } from "./access.mjs";
import { BANNER, FOOT_SPLIT, NOTICES, SIMS, STUDIO, TIP_URL } from "./copy.mjs";
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
        ${isCeo(user) ? `<span class="ceo">CEO of ${esc(STUDIO.name)}</span>` : ""}
        <form method="post" action="/logout">${csrf(ctx)}<button class="textish" type="submit">Log out</button></form>
      </div>`
    : `<div class="account"><a href="/login">Log in</a><a class="button" href="/signup">Create account</a></div>`;
  const homeNote = section === "home" ? `<p>${esc(FOOT_SPLIT)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · ${esc(STUDIO.name)}</title>
  <meta name="description" content="${esc(STUDIO.name)} is a simulation studio. Yapmark, Flinttable, and Chartslate are fake-company simulations.">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/app.css">
</head>
<body data-user-id="${user ? esc(user.id) : ""}" data-section="${esc(section || "")}" data-world="${esc(tone)}">
  <a class="skip" href="#content">Skip to content</a>
  <p class="banner">${esc(BANNER)}</p>
  <header class="top">
    <a class="brand" href="${user ? "/desk" : "/"}">${logo(STUDIO.id, STUDIO.name, "sm")}<span>${esc(STUDIO.name)}</span></a>
    <nav>
      ${navLink("/desk", "Desk", section, Boolean(user))}
      ${navLink("/chats", "Chat", section, Boolean(user))}
      ${navLink("/yapmark", "Yapmark", section)}
      ${navLink("/flinttable", "Flinttable", section)}
      ${navLink("/chartslate", "Chartslate", section)}
      ${navLink("/calendar", "Calendar", section)}
      ${navLink("/membership", "Membership", section)}
      ${navLink("/scoreboard", "Scoreboard", section)}
      ${navLink(TIP_URL, "Support", section)}
    </nav>
    ${account}
  </header>
  <main id="content">
    ${notice}
    ${body}
  </main>
  <footer class="foot">
    <p>${esc(STUDIO.name)} · Hanna Bridgham, CEO of ${esc(STUDIO.name)}</p>
    ${homeNote}
    <p>${esc(BANNER)}</p>
  </footer>
  <script src="/app.js"></script>
  ${call ? '<script src="/call.js"></script>' : ""}
</body>
</html>`;
}

function navLink(href, label, section, show = true) {
  if (!show) return "";
  const external = /^https?:\/\//.test(href);
  const key = href.replace("/", "") || "home";
  const current = !external && section === key ? ' aria-current="page"' : "";
  const extra = external ? ' target="_blank" rel="noopener noreferrer"' : "";
  return `<a href="${esc(href)}"${current}${extra}>${label}</a>`;
}

export function tipLink(label, className = "") {
  const klass = className ? ` class="${esc(className)}"` : "";
  return `<a${klass} href="${esc(TIP_URL)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
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
  const ceo = isCeo(user) ? `<span class="ceo">CEO of ${esc(STUDIO.name)}</span>` : "";
  const title = user.practice_title || "Job title not set";
  const role = user.practice_role || "Job role not set";
  const sim = user.membership === "all" ? `${STUDIO.name} membership` : user.simulation ? simName(user.simulation) : "No simulation yet";
  return `<div class="person">
    ${avatarHtml(user)}
    <div class="who">
      <strong>${esc(user.name)}</strong>
      ${ceo}
      <span>${esc(sim)}</span>
      <span>${esc(title)}</span>
      <span>${esc(role)}</span>
      <small>Simulation profile</small>
    </div>
  </div>`;
}

export function commentsHtml(comments) {
  if (!comments.length) return '<p class="empty">No comments yet.</p>';
  return comments
    .map(
      (comment) => `<article class="note">
        <p class="tag">Comment</p>
        <header><strong>${esc(comment.author_name)}</strong> <time datetime="${esc(comment.created_at)}">${esc(formatStamp(comment.created_at))}</time></header>
        ${paragraphs(comment.body)}
      </article>`,
    )
    .join("");
}

export function notesHtml(notes) {
  if (!notes.length) return '<p class="empty">No simulation notes yet.</p>';
  return notes
    .map(
      (note) => `<article class="note">
        <p class="tag">Simulation note</p>
        <header><strong>${esc(note.author_name)}</strong> <time datetime="${esc(note.created_at)}">${esc(formatStamp(note.created_at))}</time></header>
        ${paragraphs(note.body)}
      </article>`,
    )
    .join("");
}

export function noticeText(code) {
  return NOTICES[code] || "";
}

export function simulationChoices(selected, allowed) {
  return Object.entries(SIMS)
    .filter(([id]) => !allowed || allowed.includes(id))
    .map(([id, sim]) => {
      const checked = selected === id ? " checked" : "";
      return `<label class="choice">
        <input type="radio" name="simulation" value="${id}"${checked} required>
        <span><strong>${esc(sim.name)}</strong><small>${esc(sim.line)}. ${esc(sim.slogan)}</small></span>
      </label>`;
    })
    .join("");
}
