export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}

export function paragraphs(text) {
  return String(text || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${esc(part)}</p>`)
    .join("");
}

export function formatStamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value || ""));
  if (!match) return String(value || "");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let hour = Number(match[4]);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  const utc = /Z$/.test(String(value)) ? " UTC" : "";
  return `${months[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]} · ${hour}:${match[5]} ${suffix}${utc}`;
}

export function wallStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function validStamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return false;
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function cleanLine(value, max) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

export function cleanText(value, max) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}
