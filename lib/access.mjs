import { SEED, SIMS } from "./copy.mjs";

export function isCeo(user) {
  return Boolean(user && user.email === SEED.email && user.studio_role === "CEO");
}

export function hasAllAccess(user) {
  return Boolean(user && (user.membership === "all" || isCeo(user)));
}

export function memberSims(user) {
  if (!user) return [];
  if (hasAllAccess(user)) return Object.keys(SIMS);
  return user.simulation && SIMS[user.simulation] ? [user.simulation] : [];
}

export function canEnter(user, sim) {
  return memberSims(user).includes(sim);
}

export function belongsTo(user, sim) {
  return canEnter(user, sim);
}

export function sharesCompany(a, b) {
  if (!a || !b || a.id === b.id) return false;
  const left = new Set(memberSims(a));
  return memberSims(b).some((id) => left.has(id));
}

export function canChangeCompany(user) {
  if (!user) return false;
  if (!user.simulation) return true;
  return hasAllAccess(user);
}
