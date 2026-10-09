// Поведение: призванные колонисты, налётчики, животные, торговцы, пленные, срывы
import { TPD, ANIMALS } from "./defs.js";
import { startPath, cheb, dist, clearJob } from "./pawnutil.js";
import { attack, isEnemy, nearestEnemy, weaponOf } from "./combat.js";
import { runJob, wanderJob, eatJob, startSadJob } from "./jobs.js";

// ---------- призванные колонисты ----------
export function draftedAI(w, p) {
  let t = p.forceTarget ? w.get(p.forceTarget) : null;
  if (t && (t.dead || t.despawned || t.downed || !isEnemy(p, t))) {
    p.forceTarget = null;
    t = null;
  }
  if (t) {
    if (attack(w, p, t)) {
      p.path = null;
      return;
    }
    if (!p.path || (w.tick + p.id) % 30 === 0) {
      if (!startPath(w, p, t.x, t.y, "touch", 0)) p.forceTarget = null;
    }
    return;
  }
  if (p.path || p.cd > 0) return;
  const wp = weaponOf(p);
  const e = nearestEnemy(w, p, wp.melee ? 1.5 : wp.range);
  if (e) {
    attack(w, p, e);
    return;
  }
  // по нам стреляют, а ответить нечем — идём на обидчика
  if (p.lastHitTick && w.tick - p.lastHitTick < 90) {
    const a = w.get(p.lastAttacker);
    if (a && a.kind !== "building" && isEnemy(p, a) && !a.downed) p.forceTarget = a.id;
  }
}

// ---------- уход с карты ----------
export function leaveMap(w, p, mode = 1) {
  if (p.x === 0 || p.y === 0 || p.x === w.W - 1 || p.y === w.H - 1) {
    despawn(w, p);
    return;
  }
  if (p.path) return;
  p.leaveTries = (p.leaveTries || 0) + 1;
  if (p.leaveTries > 6) {
    despawn(w, p);
    return;
  }
  const opts = [
    [0, p.y, p.x],
    [w.W - 1, p.y, w.W - 1 - p.x],
    [p.x, 0, p.y],
    [p.x, w.H - 1, w.H - 1 - p.y],
  ].sort((a, b) => a[2] - b[2]);
  const rs = w.regionsAround(p.x, p.y);
  for (const [ex, ey] of opts) {
    const c = edgeNear(w, ex, ey, rs);
    if (c && startPath(w, p, c.x, c.y, "on", mode)) return;
  }
}
function edgeNear(w, ex, ey, rs) {
  w.ensureRegions();
  for (let k = 0; k < w.W; k++) {
    for (const s of [k, -k]) {
      const x = ex === 0 || ex === w.W - 1 ? ex : ex + s;
      const y = ex === 0 || ex === w.W - 1 ? ey + s : ey;
      if (!w.inB(x, y)) continue;
      const i = w.idx(x, y);
      if (w.standable(i) && rs.includes(w.region[i])) return { x, y };
    }
  }
  return null;
}
export function despawn(w, p) {
  clearJob(w, p);
  p.despawned = true;
  p.path = null;
}

// ---------- налётчики ----------
function pickRaidTarget(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  let best = null, bd = Infinity;
  for (const q of w.pawns) {
    if (q.faction !== "player" || q.dead || q.downed) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < bd && w.reachFrom(rs, q.x, q.y, "touch")) {
      best = q;
      bd = d;
    }
  }
  if (best) return best;
  for (const b of w.buildings.values()) {
    if (!b.complete) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < bd && w.reachFrom(rs, b.x, b.y, "touch")) {
      best = b;
      bd = d;
    }
  }
  return best;
}

function validTarget(w, t) {
  if (!t) return false;
  if (t.kind === "building") return w.buildings.has(t.id);
  return !t.dead && !t.downed && !t.despawned;
}

function assault(w, p, mode) {
  let t = p.target ? w.get(p.target) : null;
  if (!validTarget(w, t) || (w.tick + p.id) % 60 === 0) {
    const nt = pickRaidTarget(w, p);
    if (nt) t = nt;
    else if (!validTarget(w, t)) t = null;
    p.target = t ? t.id : null;
  }
  if (!t) return false;
  if (attack(w, p, t)) {
    p.path = null;
    return true;
  }
  if (p.blockedDoor != null) {
    const door = w.bAt(p.blockedDoor);
    if (door && door.complete) {
      if (attack(w, p, door)) return true;
    }
    p.blockedDoor = null;
  }
  if (!p.path || (w.tick + p.id) % 45 === 0) startPath(w, p, t.x, t.y, "touch", mode);
  return true;
}

export function raiderAI(w, p) {
  const raid = p.raidId ? w.story.raids.find((r) => r.id === p.raidId) : null;
  if (p.fleeing || (raid && raid.state === "flee")) {
    leaveMap(w, p);
    return;
  }
  if (raid && raid.state === "gather") {
    if (!p.path && w.rng.chance(0.015)) {
      const x = p.x + w.rng.int(-3, 3), y = p.y + w.rng.int(-3, 3);
      if (w.inB(x, y) && w.standable(w.idx(x, y))) startPath(w, p, x, y, "on", 1);
    }
    return;
  }
  if (p.hp < p.maxHp * 0.45 && !p.fleeChecked) {
    p.fleeChecked = true;
    if (w.rng.chance(0.45)) {
      p.fleeing = true;
      p.path = null;
      return;
    }
  }
  if (!assault(w, p, 1)) leaveMap(w, p);
}

// ---------- животные ----------
export function animalAI(w, p) {
  if (p.faction === "hostile") {
    if (p.manhunterUntil && w.tick > p.manhunterUntil) {
      p.faction = "wild";
      p.target = null;
      p.manhunterUntil = 0;
      p.path = null;
      if (p.leaveAfter) p.leaving = true;
    } else {
      if (!assault(w, p, 1) && !p.path) wander(w, p, 6);
      return;
    }
  }
  if (p.leaving) {
    leaveMap(w, p, 2);
    return;
  }
  if (p.fleeUntil && w.tick < p.fleeUntil) {
    if (!p.path) {
      const f = p.fleeFrom || { x: p.x, y: p.y };
      const dx = p.x - f.x, dy = p.y - f.y;
      const l = Math.hypot(dx, dy) || 1;
      const tx = Math.round(p.x + (dx / l) * 8), ty = Math.round(p.y + (dy / l) * 8);
      const c = w.nearestStandable(Math.max(0, Math.min(w.W - 1, tx)), Math.max(0, Math.min(w.H - 1, ty)));
      if (c) startPath(w, p, c.x, c.y, "on", 2);
    }
    return;
  }
  if (!p.path && w.tick >= (p.idleUntil || 0)) {
    wander(w, p, 7);
    p.idleUntil = w.tick + w.rng.int(120, 480);
  }
}

function wander(w, p, r) {
  for (let t = 0; t < 6; t++) {
    const x = p.x + w.rng.int(-r, r), y = p.y + w.rng.int(-r, r);
    if (!w.inB(x, y)) continue;
    const i = w.idx(x, y);
    if (!w.standable(i) || w.doorMask[i]) continue;
    if (startPath(w, p, x, y, "on", p.faction === "hostile" ? 1 : 2)) return;
  }
}

// ---------- торговцы ----------
export function traderAI(w, p) {
  const tr = w.story.trader;
  if (!tr || tr.leaving || p.fleeing) {
    leaveMap(w, p, 0);
    return;
  }
  if (!p.arrived) {
    const c = w.colonyCenter();
    if (cheb(p.x, p.y, c.x, c.y) <= 5) p.arrived = true;
    else if (!p.path) {
      const s = w.nearestStandable(c.x + w.rng.int(-3, 3), c.y + w.rng.int(-3, 3));
      if (!s || !startPath(w, p, s.x, s.y, "touch", 0)) p.arrived = true;
    }
    return;
  }
  if (!p.path && w.rng.chance(0.01)) wander(w, p, 3);
}

// ---------- пленные ----------
export function prisonerAI(w, p) {
  if (p.release) {
    leaveMap(w, p, 0);
    return;
  }
  const bed = p.bed ? w.buildings.get(p.bed) : null;
  if (!bed) {
    p.inBed = null;
    p.sleeping = w.isNight();
    return;
  }
  if (p.x !== bed.x || p.y !== bed.y) {
    p.inBed = null;
    if (!p.path && !startPath(w, p, bed.x, bed.y, "on", 0)) p.bed = null;
    return;
  }
  p.inBed = bed.id;
  if (p.sleeping) {
    if (p.rest >= 1 || (!w.isNight() && p.rest > 0.9)) p.sleeping = false;
  } else if (p.rest < 0.3 || (w.isNight() && p.rest < 0.85)) p.sleeping = true;
}

// ---------- нервные срывы ----------
export function mentalAI(w, p) {
  const m = p.mental;
  if (!p.job) {
    if (m.type === "binge" && w.tick - (p.lastBinge || 0) > 80) {
      p.lastBinge = w.tick;
      p.job = eatJob(w, p, true) || wanderJob(w, p, 6);
    } else if (m.type === "sad") p.job = startSadJob(w, p);
    else p.job = wanderJob(w, p, 8);
  }
  runJob(w, p);
}

export { TPD, ANIMALS };
