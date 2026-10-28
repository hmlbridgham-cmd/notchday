import { SEED, SIMS, STUDIO } from "./copy.mjs";

export function isCeo(user) {
  return Boolean(user && user.email === SEED.email && user.studio_role === "CEO");
}

export function isNotchdayMember(user) {
  return Boolean(user && (user.membership === "all" || isCeo(user)));
}

export function hasPledge(user) {
  return Boolean(user && SIMS[user.simulation]);
}

export function isStudioMember(user) {
  return Boolean(user && (hasPledge(user) || isNotchdayMember(user)));
}

export function hasAllAccess(user) {
  return isNotchdayMember(user);
}

export function pledgedTeam(user) {
  if (!hasPledge(user)) return null;
  return { id: user.simulation, name: SIMS[user.simulation].name };
}

export function notchdayTeam() {
  return { id: STUDIO.id, name: STUDIO.name };
}

export function teamsOf(user) {
  if (!user) return [];
  const teams = [];
  const pledge = pledgedTeam(user);
  if (pledge) teams.push(pledge);
  if (isNotchdayMember(user)) teams.push(notchdayTeam());
  return teams;
}

export function teamLabel(user) {
  return teamsOf(user)
    .map((team) => team.name)
    .join(" · ");
}

export function memberSims(user) {
  if (!isStudioMember(user)) return [];
  return Object.keys(SIMS);
}

export function canEnter(user, sim) {
  return memberSims(user).includes(sim);
}

export function belongsTo(user, sim) {
  return canEnter(user, sim);
}

export function sharesCompany(a, b) {
  if (!a || !b || a.id === b.id) return false;
  return isStudioMember(a) && isStudioMember(b);
}

export function canChangeCompany() {
  return false;
}
