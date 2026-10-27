import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const got = Buffer.from(hash, "hex");
  if (got.length !== next.length) return false;
  return timingSafeEqual(got, next);
}

export function tokensEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export function sessionCookie(id) {
  const parts = [
    `dm=${encodeURIComponent(id)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=1209600",
  ];
  if (process.env.DAYMARK_SECURE === "1") parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie() {
  const parts = ["dm=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.DAYMARK_SECURE === "1") parts.push("Secure");
  return parts.join("; ");
}

export function newId() {
  return randomBytes(24).toString("base64url");
}
