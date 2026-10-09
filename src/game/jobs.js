// Работа колонистов: поиск задач по приоритетам и пошаговое выполнение
import {
  TPH, TPD, ITEMS, BUILDINGS, PLANTS, PLANT, ROCKS, RECIPES, WORK, CARRY_CAP, WEAPONS, TR, DESIG,
} from "./defs.js";
import {
  workSpeed, gainXp, addThought, goTo, startPath, clearJob, skillLvl, cheb, dist, displayName,
} from "./pawnutil.js";
import { attack, canSee, isEnemy } from "./combat.js";
import { defaultWork } from "./pawn.js";

const DONE = 1, FAIL = -1, CONT = 0;

// ---------- общий цикл ----------
export function endJob(w, p, ok) {
  const j = p.job;
  if (j && j.type === "sleep" && j.slept > 150) sleepThoughts(w, p, j);
  clearJob(w, p);
  return j;
}

export function runJob(w, p) {
  const j = p.job;
  j.t = (j.t || 0) + 1;
  if (j.t > (j.max || 2400)) {
    endJob(w, p, false);
    return;
  }
  // Срочные нужды прерывают обычную работу
  if (!j.forced && j.type !== "eat" && j.type !== "sleep" && j.t % 60 === 0 && (p.food < 0.12 || p.rest < 0.05)) {
    const nj = needJob(w, p);
    if (nj) {
      endJob(w, p, false);
      p.job = nj;
      return;
    }
  }
  const fn = RUN[j.type];
  const r = fn ? fn(w, p, j) : FAIL;
  if (r === DONE) endJob(w, p, true);
  else if (r === FAIL) {
    endJob(w, p, false);
    p.thinkAt = w.tick + 25;
  }
}

export function findJobFor(w, p) {
  if (p.forced) {
    const j = p.forced;
    p.forced = null;
    return j;
  }
  const nj = needJob(w, p);
  if (nj) return nj;
  for (let prio = 1; prio <= 4; prio++) {
    for (const wt of WORK) {
      if (p.work[wt.id] !== prio) continue;
      const j = GIVERS[wt.id](w, p);
      if (j) {
        j.wt = wt.id;
        return j;
      }
    }
  }
  return wanderJob(w, p, 5);
}

function needJob(w, p) {
  if (p.food < 0.3) {
    const j = eatJob(w, p, false);
    if (j) return j;
  }
  if (p.rest < 0.28 || (w.isNight() && p.rest < 0.85)) {
    const j = sleepJob(w, p, false);
    if (j) return j;
  }
  if (p.hp < p.maxHp * 0.55 && p.bleed === 0) {
    const j = sleepJob(w, p, true);
    if (j) return j;
  }
  return null;
}

// ---------- помощники ----------
function sortByDist(p, arr, gx, gy) {
  const out = [];
  for (const c of arr) {
    const x = gx(c), y = gy(c);
    out.push([c, (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y), x, y]);
  }
  out.sort((a, b) => a[1] - b[1]);
  return out;
}

function nearestItem(w, p, rs, filter, limit = 25) {
  const cands = [];
  for (const it of w.items.values()) {
    if (!filter(it) || w.isRes("i" + it.id, p.id)) continue;
    cands.push(it);
  }
  const sorted = sortByDist(p, cands, (c) => c.x, (c) => c.y);
  for (let k = 0; k < sorted.length && k < limit; k++) {
    const [c, , x, y] = sorted[k];
    if (w.reachFrom(rs, x, y, "on")) return c;
  }
  return null;
}

function needOf(b, res) {
  const d = BUILDINGS[b.def];
  return (d.cost[res] || 0) - ((b.delivered && b.delivered[res]) || 0);
}
function needs(b) {
  const d = BUILDINGS[b.def];
  for (const k in d.cost) {
    const m = d.cost[k] - (b.delivered[k] || 0);
    if (m > 0) return { res: k, count: m };
  }
  return null;
}
function bedOccupant(w, b) {
  for (const q of w.pawns) if (q.inBed === b.id && !q.dead) return q;
  return null;
}
function touchGoal(b) {
  const d = BUILDINGS[b.def];
  return d.solid || d.door || d.wall ? "adj" : "touch";
}

// ---------- еда ----------
function eatJob(w, p, binge) {
  const rs = w.regionsAround(p.x, p.y);
  let best = null, bestS = Infinity;
  for (const it of w.items.values()) {
    const d = ITEMS[it.def];
    if (!d.nut || w.isRes("i" + it.id, p.id)) continue;
    const s = dist(p.x, p.y, it.x, it.y) + (d.cat === "raw" ? 30 : 0) - (d.fine ? 4 : 0);
    if (s >= bestS) continue;
    if (!w.reachFrom(rs, it.x, it.y, "on")) continue;
    best = it;
    bestS = s;
  }
  if (!best) return null;
  w.reserve("i" + best.id, p.id);
  const d = ITEMS[best.def];
  const want = binge ? 1.5 : 1 - p.food;
  const count = d.cat === "raw" ? Math.max(1, Math.min(best.count, Math.ceil(want / d.nut), 20)) : 1;
  return { type: "eat", item: best.id, count, step: 0 };
}

function findTable(w, p) {
  let best = null, bd = 18;
  for (const b of w.buildings.values()) {
    if (!b.complete || !BUILDINGS[b.def].table) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < bd && w.canReach(p.x, p.y, b.x, b.y, "adj")) {
      best = b;
      bd = d;
    }
  }
  return best;
}

// ---------- сон ----------
function freeBed(w, p, forPrisoner) {
  let best = null, bd = Infinity;
  const rs = w.regionsAround(p.x, p.y);
  for (const b of w.buildings.values()) {
    if (!b.complete || !BUILDINGS[b.def].bed) continue;
    if (!!b.forPrisoner !== !!forPrisoner) continue;
    if (b.owner) {
      const o = w.get(b.owner);
      if (o && !o.dead && o.bed === b.id) continue;
      b.owner = null;
    }
    if (bedOccupant(w, b)) continue;
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < bd && w.reachFrom(rs, b.x, b.y, "on")) {
      best = b;
      bd = d;
    }
  }
  return best;
}

function sleepJob(w, p, medical) {
  let bed = p.bed ? w.buildings.get(p.bed) : null;
  if (bed && (!bed.complete || bed.forPrisoner || bed.owner !== p.id)) {
    p.bed = null;
    bed = null;
  }
  if (bed) {
    const occ = bedOccupant(w, bed);
    if ((occ && occ !== p) || !w.canReach(p.x, p.y, bed.x, bed.y, "on")) bed = null;
  }
  if (!bed && !p.bed) {
    bed = freeBed(w, p, false);
    if (bed) {
      bed.owner = p.id;
      p.bed = bed.id;
    }
  }
  if (!bed && medical) return null;
  let x = p.x, y = p.y;
  if (bed) {
    x = bed.x;
    y = bed.y;
  } else {
    const i = w.idx(p.x, p.y);
    if (w.bgrid[i] || !w.standable(i) || w.doorMask[i]) {
      const c = w.nearestStandable(p.x, p.y);
      if (c) { x = c.x; y = c.y; }
    }
  }
  return { type: "sleep", bed: bed ? bed.id : null, x, y, medical, step: 0, max: TPD, slept: 0 };
}

function sleepThoughts(w, p, j) {
  const i = w.idx(p.x, p.y);
  if (!j.bed) addThought(w, p, "groundSleep");
  if (w.tempAt(i) < 0) addThought(w, p, "coldSleep");
  const room = w.roomAt(i);
  if (j.bed && room) {
    if (room.beds > 1) addThought(w, p, "barracks");
    else if (room.floor >= room.size * 0.6 && room.size >= 6) addThought(w, p, "cozyBedroom");
  }
}

// ---------- безделье ----------
export function wanderJob(w, p, r) {
  const rng = w.rng;
  const c = w.colonyCenter();
  const far = p.kind === "colonist" && dist(p.x, p.y, c.x, c.y) > 18;
  for (let t = 0; t < 10; t++) {
    const bx = far ? c.x : p.x, by = far ? c.y : p.y;
    const x = bx + rng.int(-r, r), y = by + rng.int(-r, r);
    if (!w.inB(x, y)) continue;
    const i = w.idx(x, y);
    if (!w.standable(i) || w.doorMask[i]) continue;
    if (!w.canReach(p.x, p.y, x, y, "on")) continue;
    return { type: "wander", x, y, wait: rng.int(30, 110), step: 0, max: 600 };
  }
  return { type: "wait", wait: 50, step: 0 };
}

// ---------- бегство ----------
export function fleeJob(w, p, e) {
  const base = Math.atan2(p.y - e.y, p.x - e.x);
  for (let t = 0; t < 14; t++) {
    const a = base + w.rng.range(-1, 1);
    const r = w.rng.range(9, 15);
    const x = Math.max(1, Math.min(w.W - 2, Math.round(p.x + Math.cos(a) * r)));
    const y = Math.max(1, Math.min(w.H - 2, Math.round(p.y + Math.sin(a) * r)));
    const i = w.idx(x, y);
    if (!w.standable(i) || w.doorMask[i] || !w.canReach(p.x, p.y, x, y, "on")) continue;
    return { type: "flee", x, y, from: e.id, step: 0, max: 500, forced: true };
  }
  return null;
}

// ---------- переноска ----------
function findStorage(w, def, fx, fy, p, rs) {
  const cat = ITEMS[def].cat, stack = ITEMS[def].stack;
  let best = -1, bd = Infinity;
  const W = w.W;
  for (const i of w.stockCells) {
    const z = w.zoneAt(i);
    if (!z || !z.filter[cat]) continue;
    if (w.isRes("c" + i, p.id) || !w.canHoldItem(i)) continue;
    const o = w.iAt(i);
    if (o && (o.def !== def || o.count >= stack)) continue;
    const x = i % W, y = (i / W) | 0;
    const d = (x - fx) * (x - fx) + (y - fy) * (y - fy) - (o ? 40 : 0);
    if (d >= bd) continue;
    if (!w.reachFrom(rs, x, y, "on")) continue;
    best = i;
    bd = d;
  }
  return best;
}

function haulGiver(w, p) {
  const rj = refuelGiver(w, p);
  if (rj) return rj;
  w.ensureZones();
  if (!w.stockCells.length) return null;
  const rs = w.regionsAround(p.x, p.y);
  const cands = [];
  for (const it of w.items.values()) {
    if (w.isRes("i" + it.id, p.id) || w.isStored(it)) continue;
    cands.push(it);
  }
  if (!cands.length) return null;
  const sorted = sortByDist(p, cands, (c) => c.x, (c) => c.y);
  for (let k = 0; k < sorted.length && k < 20; k++) {
    const it = sorted[k][0];
    if (!w.reachFrom(rs, it.x, it.y, "on")) continue;
    const dest = findStorage(w, it.def, it.x, it.y, p, rs);
    if (dest < 0) continue;
    w.reserve("i" + it.id, p.id);
    w.reserve("c" + dest, p.id);
    return { type: "haul", item: it.id, dest, step: 0 };
  }
  return null;
}

function refuelGiver(w, p, only) {
  const rs = w.regionsAround(p.x, p.y);
  const list = [];
  for (const b of only ? [only] : w.buildings.values()) {
    const d = BUILDINGS[b.def];
    if (!b.complete || !d.fuel || !b.on) continue;
    if (b.fuel > d.fuel.max * (only ? 0.9 : 0.5)) continue;
    if (w.isRes("f" + b.id, p.id)) continue;
    list.push(b);
  }
  if (!list.length) return null;
  const sorted = sortByDist(p, list, (c) => c.x, (c) => c.y);
  for (const [b] of sorted) {
    if (!w.reachFrom(rs, b.x, b.y, "touch")) continue;
    const wood = nearestItem(w, p, rs, (it) => it.def === "wood");
    if (!wood) return null;
    w.reserve("f" + b.id, p.id);
    w.reserve("i" + wood.id, p.id);
    return { type: "refuel", b: b.id, item: wood.id, amount: Math.ceil(BUILDINGS[b.def].fuel.max - b.fuel), step: 0 };
  }
  return null;
}

// ---------- стройка ----------
function constructGiver(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  const cands = [];
  for (const b of w.buildings.values()) {
    if (w.isRes("b" + b.id, p.id)) continue;
    if (b.complete) {
      if (b.deconstruct) cands.push(b);
      continue;
    }
    cands.push(b);
  }
  if (!cands.length) return null;
  const sorted = sortByDist(p, cands, (c) => c.x, (c) => c.y);
  let tries = 0;
  for (const [b] of sorted) {
    if (++tries > 40) break;
    const goal = touchGoal(b);
    if (!w.reachFrom(rs, b.x, b.y, goal)) continue;
    if (b.complete) {
      w.reserve("b" + b.id, p.id);
      return { type: "decon", b: b.id, step: 0, work: 0 };
    }
    const i = w.idx(b.x, b.y);
    const pl = w.plant[i];
    if (pl && !PLANTS[pl].small && !BUILDINGS[b.def].floor) {
      if (w.isRes("c" + i, p.id)) continue;
      w.reserve("c" + i, p.id);
      return { type: "cut", cell: i, step: 0, work: 0 };
    }
    const need = needs(b);
    if (!need) {
      w.reserve("b" + b.id, p.id);
      return { type: "build", b: b.id, step: 0 };
    }
    const item = nearestItem(w, p, rs, (it) => it.def === need.res);
    if (!item) continue;
    // Захватываем соседние чертежи с тем же материалом, чтобы нести за один раз
    let amount = need.count;
    const targets = [b.id];
    w.reserve("b" + b.id, p.id);
    const cap = Math.min(item.count, CARRY_CAP);
    if (amount < cap) {
      const near = [];
      for (const o of w.buildings.values()) {
        if (o === b || o.complete || w.isRes("b" + o.id, p.id)) continue;
        if (cheb(o.x, o.y, b.x, b.y) > 6) continue;
        const m = needOf(o, need.res);
        if (m > 0) near.push([o, m, dist(o.x, o.y, b.x, b.y)]);
      }
      near.sort((a, b2) => a[2] - b2[2]);
      for (const [o, m] of near) {
        if (amount >= cap) break;
        targets.push(o.id);
        w.reserve("b" + o.id, p.id);
        amount += m;
      }
    }
    w.reserve("i" + item.id, p.id);
    return { type: "deliver", item: item.id, res: need.res, amount: Math.min(amount, cap), targets, step: 0 };
  }
  return null;
}

// ---------- шахта ----------
function mineGiver(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  const cands = [];
  for (const i of w.desigSet) {
    if (!(w.desig[i] & DESIG.MINE)) continue;
    if (!w.rock[i]) {
      w.setDesig(i, DESIG.MINE, false);
      continue;
    }
    if (w.isRes("c" + i, p.id)) continue;
    cands.push(i);
  }
  if (!cands.length) return null;
  const W = w.W;
  const sorted = sortByDist(p, cands, (i) => i % W, (i) => (i / W) | 0);
  for (let k = 0; k < sorted.length && k < 40; k++) {
    const [i, , x, y] = sorted[k];
    if (!w.reachFrom(rs, x, y, "adj")) continue;
    w.reserve("c" + i, p.id);
    return { type: "mine", cell: i, step: 0, work: 0 };
  }
  return null;
}

export function mineCell(w, i, p) {
  const r = ROCKS[w.rock[i]];
  if (!r) return;
  w.rock[i] = 0;
  w.terrain[i] = TR.ROCKFLOOR;
  w.setDesig(i, DESIG.MINE, false);
  w.recalcCost(i);
  w.pathDirty = true;
  w.roomsDirty = true;
  w.dirtyCells.add(i);
  const yieldK = p ? 0.8 + skillLvl(p, "mining") * 0.02 : 1;
  const x = i % w.W, y = (i / w.W) | 0;
  w.spawnItem(r.drop, Math.max(1, Math.round(r.amount * yieldK)), x, y);
}

// ---------- рубка ----------
function cutGiver(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  const cands = [];
  for (const i of w.desigSet) {
    const f = w.desig[i];
    if (!(f & (DESIG.CUT | DESIG.HARVEST))) continue;
    const pl = w.plant[i];
    if (!pl) {
      w.setDesig(i, DESIG.CUT | DESIG.HARVEST, false);
      continue;
    }
    if (!(f & DESIG.CUT) && w.growth[i] < 0.95) continue;
    if (w.isRes("c" + i, p.id)) continue;
    cands.push(i);
  }
  if (!cands.length) return null;
  const W = w.W;
  const sorted = sortByDist(p, cands, (i) => i % W, (i) => (i / W) | 0);
  for (let k = 0; k < sorted.length && k < 40; k++) {
    const [i, , x, y] = sorted[k];
    if (!w.reachFrom(rs, x, y, "touch")) continue;
    w.reserve("c" + i, p.id);
    return { type: "cut", cell: i, harvest: !(w.desig[i] & DESIG.CUT), step: 0, work: 0 };
  }
  return null;
}

function harvestPlant(w, i, p, keepIfRegrow) {
  const pl = w.plant[i];
  if (!pl) return;
  const d = PLANTS[pl];
  const g = w.growth[i];
  const x = i % w.W, y = (i / w.W) | 0;
  const k = p ? 0.75 + skillLvl(p, "plants") * 0.025 : 1;
  if (d.yield && g >= 0.2) for (const r in d.yield) w.spawnItem(r, Math.max(1, Math.round(d.yield[r] * g)), x, y);
  if (d.harvest && g >= 0.95) for (const r in d.harvest) w.spawnItem(r, Math.max(1, Math.round(d.harvest[r] * k)), x, y);
  if (keepIfRegrow && d.regrow && g >= 0.95) {
    w.growth[i] = d.regrow;
  } else {
    w.plant[i] = 0;
    w.growth[i] = 0;
  }
  w.setDesig(i, DESIG.CUT | DESIG.HARVEST, false);
  w.recalcCost(i);
}

// ---------- растения ----------
function growGiver(w, p) {
  w.ensureZones();
  const rs = w.regionsAround(p.x, p.y);
  const canSow = w.outT > 3;
  const cands = [];
  for (const z of w.zones.values()) {
    if (z.type !== "grow" || !z.cells) continue;
    const crop = PLANT[z.crop];
    const allowed = w.cropAllowed(z.crop);
    for (const i of z.cells) {
      const pl = w.plant[i];
      if (pl === crop) {
        if (w.growth[i] >= 1) cands.push([i, "harvest"]);
      } else if (pl) {
        cands.push([i, "clear"]);
      } else if (allowed && canSow && !w.bgrid[i] && !w.fgrid[i]) {
        cands.push([i, "sow", crop]);
      }
    }
  }
  if (!cands.length) return null;
  const W = w.W;
  const sorted = sortByDist(p, cands, (c) => c[0] % W, (c) => (c[0] / W) | 0);
  let tries = 0;
  for (const [c, , x, y] of sorted) {
    if (w.isRes("c" + c[0], p.id)) continue;
    if (++tries > 30) break;
    if (!w.reachFrom(rs, x, y, "on")) continue;
    w.reserve("c" + c[0], p.id);
    return { type: "grow", cell: c[0], mode: c[1], crop: c[2] || 0, step: 0, work: 0 };
  }
  return null;
}

// ---------- готовка ----------
function rawAvailable(w, p, rs) {
  let n = 0;
  for (const it of w.items.values()) {
    if (ITEMS[it.def].cat !== "raw" || w.isRes("i" + it.id, p.id)) continue;
    if (!w.reachFrom(rs, it.x, it.y, "on")) continue;
    n += it.count;
  }
  return n;
}

function cookGiver(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  let raw = -1;
  for (const b of w.buildings.values()) {
    if (!b.complete || BUILDINGS[b.def].bench !== "cook") continue;
    if (w.isRes("b" + b.id, p.id)) continue;
    if (!w.reachFrom(rs, b.x, b.y, "touch")) continue;
    const d = BUILDINGS[b.def];
    for (const bill of b.bills || []) {
      if (!bill.on) continue;
      const rec = RECIPES[bill.recipe];
      if (w.countDef(rec.out) >= bill.target) continue;
      if (raw < 0) raw = rawAvailable(w, p, rs);
      if (raw < rec.raw) continue;
      if (d.fuel && b.fuel < 1) {
        const rj = refuelGiver(w, p, b);
        if (rj) return rj;
        continue;
      }
      w.reserve("b" + b.id, p.id);
      return { type: "cook", b: b.id, recipe: bill.recipe, need: rec.raw, got: 0, ingredients: [], step: 0, work: 0, max: 1500 };
    }
  }
  return null;
}

// ---------- наука ----------
function researchGiver(w, p) {
  if (!w.research.current) return null;
  const rs = w.regionsAround(p.x, p.y);
  for (const b of w.buildings.values()) {
    if (!b.complete || BUILDINGS[b.def].bench !== "research") continue;
    if (w.isRes("b" + b.id, p.id)) continue;
    if (!w.reachFrom(rs, b.x, b.y, "touch")) continue;
    w.reserve("b" + b.id, p.id);
    return { type: "research", b: b.id, step: 0, max: 700 };
  }
  return null;
}

// ---------- медицина ----------
function findBedFor(w, q, p, capture) {
  if (!capture && q.bed) {
    const b = w.buildings.get(q.bed);
    if (b && b.complete && !bedOccupant(w, b) && w.canReach(p.x, p.y, b.x, b.y, "on")) return b;
  }
  const b = freeBed(w, p, capture);
  if (b) return b;
  if (capture) {
    const nb = freeBed(w, p, false);
    if (nb) return nb;
  }
  // любая свободная кровать подойдёт раненому
  if (!capture) {
    for (const b2 of w.buildings.values()) {
      if (!b2.complete || !BUILDINGS[b2.def].bed || b2.forPrisoner || bedOccupant(w, b2)) continue;
      if (w.canReach(p.x, p.y, b2.x, b2.y, "on")) return b2;
    }
  }
  return null;
}

function doctorGiver(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  // спасти лежащих без сознания
  for (const q of w.pawns) {
    if ((q.kind !== "colonist" && q.kind !== "prisoner") || !q.downed || q.dead || q.inBed || q.carriedBy || q === p) continue;
    if (w.isRes("p" + q.id, p.id) || !w.reachFrom(rs, q.x, q.y, "touch")) continue;
    const bed = findBedFor(w, q, p, q.kind === "prisoner");
    if (!bed || w.isRes("bed" + bed.id, p.id)) continue;
    w.reserve("p" + q.id, p.id);
    w.reserve("bed" + bed.id, p.id);
    return { type: "rescue", patient: q.id, bed: bed.id, step: 0 };
  }
  // накормить лежачих
  for (const q of w.pawns) {
    if (q.kind !== "colonist" || !q.downed || q.dead || q.carriedBy || q.food > 0.35) continue;
    if (w.isRes("feed" + q.id, p.id) || !w.reachFrom(rs, q.x, q.y, "touch")) continue;
    const food = nearestItem(w, p, rs, (it) => !!ITEMS[it.def].nut);
    if (!food) break;
    w.reserve("feed" + q.id, p.id);
    w.reserve("i" + food.id, p.id);
    return { type: "feed", patient: q.id, item: food.id, step: 0 };
  }
  // перевязать кровоточащих
  const pats = [];
  for (const q of w.pawns) {
    if ((q.kind !== "colonist" && q.kind !== "prisoner") || q.dead || q.bleed <= 0 || q.carriedBy) continue;
    if (w.isRes("p" + q.id, p.id)) continue;
    if (q === p && q.downed) continue;
    pats.push(q);
  }
  if (!pats.length) return null;
  const sorted = sortByDist(p, pats, (c) => c.x, (c) => c.y);
  for (const [q] of sorted) {
    if (q !== p && !w.reachFrom(rs, q.x, q.y, "touch")) continue;
    const med = nearestItem(w, p, rs, (it) => it.def === "medicine");
    w.reserve("p" + q.id, p.id);
    if (med) w.reserve("i" + med.id, p.id);
    return { type: "tend", patient: q.id, med: med ? med.id : null, step: med ? 0 : 1, work: 0 };
  }
  return null;
}

// ---------- надзор за пленными ----------
function wardenGiver(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  for (const q of w.pawns) {
    if (!q.captureDesig || !q.downed || q.dead || q.carriedBy || q.faction !== "hostile") continue;
    if (w.isRes("p" + q.id, p.id) || !w.reachFrom(rs, q.x, q.y, "touch")) continue;
    const bed = findBedFor(w, q, p, true);
    if (!bed || w.isRes("bed" + bed.id, p.id)) continue;
    w.reserve("p" + q.id, p.id);
    w.reserve("bed" + bed.id, p.id);
    return { type: "rescue", patient: q.id, bed: bed.id, capture: true, step: 0 };
  }
  for (const q of w.pawns) {
    if (q.kind !== "prisoner" || q.dead || q.carriedBy) continue;
    if (!w.reachFrom(rs, q.x, q.y, "touch")) continue;
    if (q.food < 0.35 && !w.isRes("feed" + q.id, p.id)) {
      const food = nearestItem(w, p, rs, (it) => !!ITEMS[it.def].nut);
      if (food) {
        w.reserve("feed" + q.id, p.id);
        w.reserve("i" + food.id, p.id);
        return { type: "feed", patient: q.id, item: food.id, step: 0 };
      }
    }
    if (!q.downed && w.tick - (q.lastChat || -TPD) > TPD * 0.5 && !w.isRes("chat" + q.id, p.id)) {
      w.reserve("chat" + q.id, p.id);
      return { type: "chat", patient: q.id, step: 0, work: 0 };
    }
  }
  return null;
}

// ---------- охота ----------
function huntGiver(w, p) {
  const rs = w.regionsAround(p.x, p.y);
  const cands = w.pawns.filter((a) => a.kind === "animal" && a.huntDesig && !a.dead && !w.isRes("h" + a.id, p.id));
  if (!cands.length) return null;
  const sorted = sortByDist(p, cands, (c) => c.x, (c) => c.y);
  for (const [a] of sorted) {
    if (!w.reachFrom(rs, a.x, a.y, "touch")) continue;
    w.reserve("h" + a.id, p.id);
    return { type: "hunt", target: a.id, step: 0, max: TPD * 0.6, fails: 0 };
  }
  return null;
}

const GIVERS = {
  doctor: doctorGiver,
  warden: wardenGiver,
  cook: cookGiver,
  hunt: huntGiver,
  construct: constructGiver,
  grow: growGiver,
  mine: mineGiver,
  cut: cutGiver,
  haul: haulGiver,
  research: researchGiver,
};

// ---------- выполнение ----------
const RUN = {
  wait(w, p, j) {
    return ++j.step >= j.wait ? DONE : CONT;
  },

  flee(w, p, j) {
    if (j.step === 0) {
      const r = goTo(w, p, j, j.x, j.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
      j.timer = 0;
    }
    if (++j.timer % 20 !== 0) return CONT;
    for (const q of w.pawns) if (isEnemy(p, q) && !q.downed && cheb(p.x, p.y, q.x, q.y) <= 10) return j.timer > 300 ? DONE : CONT;
    return DONE;
  },

  wander(w, p, j) {
    if (j.step === 0) {
      const r = goTo(w, p, j, j.x, j.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
      j.timer = 0;
    }
    return ++j.timer >= j.wait ? DONE : CONT;
  },

  eat(w, p, j) {
    if (j.step === 0) {
      const it = w.items.get(j.item);
      if (!it) return FAIL;
      const r = goTo(w, p, j, it.x, it.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      const n = w.takeItem(it, j.count);
      if (n <= 0) return FAIL;
      p.carry = { def: it.def, count: n };
      const t = findTable(w, p);
      j.table = t ? t.id : null;
      j.step = 1;
      j.repaths = 0;
    }
    if (j.step === 1) {
      if (j.table) {
        const t = w.buildings.get(j.table);
        if (t) {
          const r = goTo(w, p, j, t.x, t.y, "adj");
          if (r === 0) return CONT;
          if (r < 0) j.table = null;
        } else j.table = null;
      }
      j.step = 2;
      j.timer = 0;
    }
    if (++j.timer < 45 || !p.carry) return p.carry ? CONT : FAIL;
    const d = ITEMS[p.carry.def];
    p.food = Math.min(1, p.food + d.nut * p.carry.count);
    if (d.cat === "raw") addThought(w, p, "rawFood");
    if (d.fine) addThought(w, p, "fineMeal");
    if (!j.table) addThought(w, p, "noTable");
    else if (w.roomAt(w.idx(p.x, p.y))) addThought(w, p, "ateTogether");
    p.carry = null;
    return DONE;
  },

  sleep(w, p, j) {
    if (j.step === 0) {
      if (j.bed) {
        const b = w.buildings.get(j.bed);
        if (!b) return FAIL;
        j.x = b.x;
        j.y = b.y;
      }
      const r = goTo(w, p, j, j.x, j.y, "on");
      if (r < 0) {
        if (j.bed) return FAIL;
        j.x = p.x;
        j.y = p.y;
      }
      if (r === 0) return CONT;
      j.step = 1;
      p.sleeping = true;
      p.inBed = j.bed;
    }
    j.slept++;
    if (p.wake) {
      p.wake = false;
      return DONE;
    }
    if (j.sad) return p.mental ? CONT : DONE;
    if (j.medical) {
      if (p.hp >= p.maxHp * 0.92 || p.bleed > 0) return DONE;
      return CONT;
    }
    if (p.rest >= 1) return DONE;
    if (!w.isNight() && p.rest > 0.92) return DONE;
    if (p.food < 0.08 && j.slept % 50 === 0 && w.totalNutrition() > 0) return DONE;
    if (j.slept % 40 === 0) {
      for (const q of w.pawns) if (isEnemy(p, q) && !q.downed && cheb(p.x, p.y, q.x, q.y) <= 6) return DONE;
    }
    return CONT;
  },

  haul(w, p, j) {
    if (j.step === 0) {
      const it = w.items.get(j.item);
      if (!it) return FAIL;
      const r = goTo(w, p, j, it.x, it.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      const o = w.iAt(j.dest);
      const stack = ITEMS[it.def].stack;
      let space = w.canHoldItem(j.dest) ? (o ? (o.def === it.def ? stack - o.count : 0) : stack) : 0;
      if (space <= 0) return FAIL;
      const n = w.takeItem(it, Math.min(space, CARRY_CAP));
      p.carry = { def: it.def, count: n };
      j.step = 1;
      j.repaths = 0;
    }
    const x = j.dest % w.W, y = (j.dest / w.W) | 0;
    const r = goTo(w, p, j, x, y, "on");
    if (r < 0) return FAIL;
    if (r === 0) return CONT;
    const rem = w.spawnItem(p.carry.def, p.carry.count, x, y, 0);
    p.carry = rem > 0 ? { def: p.carry.def, count: rem } : null;
    return DONE;
  },

  refuel(w, p, j) {
    const b = w.buildings.get(j.b);
    if (!b) return FAIL;
    if (j.step === 0) {
      const it = w.items.get(j.item);
      if (!it || it.def !== "wood") return FAIL;
      const r = goTo(w, p, j, it.x, it.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      const n = w.takeItem(it, Math.max(1, Math.min(j.amount, CARRY_CAP)));
      p.carry = { def: "wood", count: n };
      j.step = 1;
      j.repaths = 0;
    }
    const r = goTo(w, p, j, b.x, b.y, touchGoal(b));
    if (r < 0) return FAIL;
    if (r === 0) return CONT;
    const max = BUILDINGS[b.def].fuel.max;
    const add = Math.min(p.carry.count, Math.ceil(max - b.fuel));
    b.fuel = Math.min(max, b.fuel + add);
    p.carry.count -= add;
    if (p.carry.count <= 0) p.carry = null;
    return DONE;
  },

  deliver(w, p, j) {
    if (j.step === 0) {
      const it = w.items.get(j.item);
      if (!it || it.def !== j.res) return FAIL;
      const r = goTo(w, p, j, it.x, it.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      const n = w.takeItem(it, Math.min(j.amount, CARRY_CAP));
      if (n <= 0) return FAIL;
      p.carry = { def: j.res, count: n };
      j.step = 1;
      j.repaths = 0;
    }
    while (j.targets.length) {
      const b = w.buildings.get(j.targets[0]);
      if (!b || b.complete || needOf(b, j.res) <= 0) {
        j.targets.shift();
        continue;
      }
      break;
    }
    if (!j.targets.length || !p.carry) return DONE;
    const b = w.buildings.get(j.targets[0]);
    const r = goTo(w, p, j, b.x, b.y, touchGoal(b));
    if (r < 0) {
      j.targets.shift();
      j.repaths = 0;
      return CONT;
    }
    if (r === 0) return CONT;
    const n = Math.min(needOf(b, j.res), p.carry.count);
    b.delivered[j.res] += n;
    p.carry.count -= n;
    j.targets.shift();
    j.repaths = 0;
    if (p.carry.count <= 0) {
      p.carry = null;
      return DONE;
    }
    return CONT;
  },

  build(w, p, j) {
    const b = w.buildings.get(j.b);
    if (!b || b.complete) return FAIL;
    if (needs(b)) return FAIL;
    if (j.step === 0) {
      const r = goTo(w, p, j, b.x, b.y, touchGoal(b));
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
    }
    p.working = b.id;
    face(p, b.x);
    b.work += workSpeed(w, p, "construction");
    gainXp(p, "construction", 0.8);
    if (b.work >= BUILDINGS[b.def].work) {
      w.completeBuilding(b);
      return DONE;
    }
    return CONT;
  },

  decon(w, p, j) {
    const b = w.buildings.get(j.b);
    if (!b || !b.deconstruct) return FAIL;
    if (j.step === 0) {
      const r = goTo(w, p, j, b.x, b.y, touchGoal(b));
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
    }
    face(p, b.x);
    j.work += workSpeed(w, p, "construction");
    if (j.work >= BUILDINGS[b.def].work * 0.5) {
      w.removeBuilding(b, 0.75);
      return DONE;
    }
    return CONT;
  },

  mine(w, p, j) {
    const i = j.cell;
    if (!w.rock[i] || !(w.desig[i] & DESIG.MINE)) return FAIL;
    const x = i % w.W, y = (i / w.W) | 0;
    if (j.step === 0) {
      const r = goTo(w, p, j, x, y, "adj");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
    }
    face(p, x);
    p.working = -1;
    j.work += workSpeed(w, p, "mining");
    gainXp(p, "mining", 0.8);
    if (j.work >= ROCKS[w.rock[i]].work) {
      mineCell(w, i, p);
      return DONE;
    }
    return CONT;
  },

  cut(w, p, j) {
    const i = j.cell;
    const pl = w.plant[i];
    if (!pl) return DONE;
    const x = i % w.W, y = (i / w.W) | 0;
    if (j.step === 0) {
      const r = goTo(w, p, j, x, y, "touch");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
    }
    face(p, x);
    p.working = -1;
    const d = PLANTS[pl];
    j.work += workSpeed(w, p, "plants");
    gainXp(p, "plants", 0.5);
    if (j.work >= d.cut * (j.harvest ? 0.7 : 1)) {
      harvestPlant(w, i, p, j.harvest);
      return DONE;
    }
    return CONT;
  },

  grow(w, p, j) {
    const i = j.cell;
    const x = i % w.W, y = (i / w.W) | 0;
    const z = w.zoneAt(i);
    if (!z || z.type !== "grow") return FAIL;
    const pl = w.plant[i];
    if (j.mode === "sow" && (pl || z.crop !== PLANTS[j.crop].id)) return FAIL;
    if (j.mode === "harvest" && (!pl || w.growth[i] < 1)) return FAIL;
    if (j.mode === "clear" && !pl) return DONE;
    if (j.step === 0) {
      const r = goTo(w, p, j, x, y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
    }
    p.working = -1;
    j.work += workSpeed(w, p, "plants");
    gainXp(p, "plants", 0.6);
    const need = j.mode === "sow" ? PLANTS[j.crop].sow : j.mode === "harvest" ? PLANTS[pl].cut : PLANTS[pl].cut * 0.6;
    if (j.work < need) return CONT;
    if (j.mode === "sow") {
      w.plant[i] = j.crop;
      w.growth[i] = 0.02;
      w.recalcCost(i);
    } else harvestPlant(w, i, p, false);
    return DONE;
  },

  cook(w, p, j) {
    const b = w.buildings.get(j.b);
    if (!b || !b.complete) return FAIL;
    const rec = RECIPES[j.recipe];
    if (j.step === 0) {
      if (j.got >= j.need) {
        j.step = 2;
        j.repaths = 0;
      } else {
        if ((j.tries = (j.tries || 0) + 1) > 8) return FAIL;
        const rs = w.regionsAround(p.x, p.y);
        const it = nearestItem(w, p, rs, (x) => ITEMS[x.def].cat === "raw");
        if (!it) return FAIL;
        w.reserve("i" + it.id, p.id);
        j.item = it.id;
        j.step = 1;
        j.repaths = 0;
      }
    }
    if (j.step === 1) {
      const it = w.items.get(j.item);
      if (!it) {
        j.step = 0;
        return CONT;
      }
      const r = goTo(w, p, j, it.x, it.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      const n = w.takeItem(it, j.need - j.got);
      w.unreserve("i" + it.id, p.id);
      j.ingredients.push({ def: it.def, count: n });
      j.got += n;
      p.carry = { def: j.ingredients[0].def, count: j.got };
      j.step = 0;
      return CONT;
    }
    if (j.step === 2) {
      const r = goTo(w, p, j, b.x, b.y, touchGoal(b));
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 3;
    }
    const d = BUILDINGS[b.def];
    if (d.fuel && b.fuel <= 0) return FAIL;
    face(p, b.x);
    p.working = b.id;
    j.work += workSpeed(w, p, "cooking") * (d.speed || 1);
    gainXp(p, "cooking", 0.8);
    if (j.work < rec.work) return CONT;
    j.ingredients = [];
    p.carry = null;
    w.spawnItem(rec.out, 1, b.x, b.y);
    return DONE;
  },

  research(w, p, j) {
    const b = w.buildings.get(j.b);
    if (!b || !b.complete || !w.research.current) return DONE;
    if (j.step === 0) {
      const r = goTo(w, p, j, b.x, b.y, touchGoal(b));
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
    }
    face(p, b.x);
    p.working = b.id;
    w.addResearch(0.24 * workSpeed(w, p, "intellect"));
    gainXp(p, "intellect", 0.6);
    return CONT;
  },

  rescue(w, p, j) {
    const q = w.get(j.patient);
    const bed = w.buildings.get(j.bed);
    if (!q || q.dead || !bed) return FAIL;
    if (j.step === 0) {
      if (!q.downed || q.carriedBy) return FAIL;
      const r = goTo(w, p, j, q.x, q.y, "touch");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      q.carriedBy = p.id;
      p.carrying = q.id;
      q.inBed = null;
      j.step = 1;
      j.repaths = 0;
    }
    const r = goTo(w, p, j, bed.x, bed.y, "on");
    if (r < 0) return FAIL;
    if (r === 0) return CONT;
    q.carriedBy = null;
    p.carrying = null;
    q.x = bed.x;
    q.y = bed.y;
    q.inBed = bed.id;
    if (j.capture) makePrisoner(w, q, bed);
    return DONE;
  },

  tend(w, p, j) {
    const q = w.get(j.patient);
    if (!q || q.dead || q.bleed <= 0) return FAIL;
    if (j.step === 0) {
      const it = w.items.get(j.med);
      if (!it) {
        j.step = 1;
        return CONT;
      }
      const r = goTo(w, p, j, it.x, it.y, "on");
      if (r < 0) {
        j.step = 1;
        j.repaths = 0;
        return CONT;
      }
      if (r === 0) return CONT;
      w.takeItem(it, 1);
      p.carry = { def: "medicine", count: 1 };
      j.step = 1;
      j.repaths = 0;
    }
    if (j.step === 1) {
      if (q !== p) {
        q.waitFor = p.id;
        const r = goTo(w, p, j, q.x, q.y, "touch");
        if (r < 0) return FAIL;
        if (r === 0) return CONT;
      }
      j.step = 2;
    }
    face(p, q.x);
    p.working = -1;
    j.work += workSpeed(w, p, "medicine") * (q === p ? 0.6 : 1);
    gainXp(p, "medicine", 1);
    if (j.work < 70) return CONT;
    const hasMed = p.carry && p.carry.def === "medicine";
    q.bleed = 0;
    q.tendQ = Math.max(0.1, Math.min(1, 0.25 + skillLvl(p, "medicine") * 0.035 + (hasMed ? 0.3 : 0) + (w.research.done.herbalism ? 0.1 : 0)));
    q.tendUntil = w.tick + TPD * 2;
    if (hasMed) p.carry = null;
    q.waitFor = null;
    return DONE;
  },

  feed(w, p, j) {
    const q = w.get(j.patient);
    if (!q || q.dead || (q.kind !== "prisoner" && !q.downed)) return FAIL;
    if (j.step === 0) {
      const it = w.items.get(j.item);
      if (!it) return FAIL;
      const r = goTo(w, p, j, it.x, it.y, "on");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      const d = ITEMS[it.def];
      const n = w.takeItem(it, d.cat === "raw" ? Math.min(it.count, 14) : 1);
      p.carry = { def: it.def, count: n };
      j.step = 1;
      j.repaths = 0;
    }
    const r = goTo(w, p, j, q.x, q.y, "touch");
    if (r < 0) return FAIL;
    if (r === 0) return CONT;
    q.food = Math.min(1, q.food + ITEMS[p.carry.def].nut * p.carry.count);
    p.carry = null;
    return DONE;
  },

  chat(w, p, j) {
    const q = w.get(j.patient);
    if (!q || q.dead || q.kind !== "prisoner") return FAIL;
    if (j.step === 0) {
      const r = goTo(w, p, j, q.x, q.y, "touch");
      if (r < 0) return FAIL;
      if (r === 0) return CONT;
      j.step = 1;
    }
    face(p, q.x);
    p.working = -1;
    if (++j.work < 70) return CONT;
    q.lastChat = w.tick;
    const soc = skillLvl(p, "social");
    gainXp(p, "social", 60);
    if (q.resistance > 0) {
      q.resistance = Math.max(0, q.resistance - (1 + soc * 0.22) * w.rng.range(0.7, 1.3));
      return DONE;
    }
    if (w.rng.next() < 0.35 + soc * 0.03) recruit(w, q);
    return DONE;
  },

  hunt(w, p, j) {
    const a = w.get(j.target);
    if (!a || a.dead) return DONE;
    if (!a.huntDesig) return FAIL;
    if (attack(w, p, a)) {
      p.path = null;
      return CONT;
    }
    if (!p.path || j.t % 35 === 0) {
      if (!startPath(w, p, a.x, a.y, "touch", 0)) {
        if (++j.fails > 6) return FAIL;
      }
    }
    return CONT;
  },

  equip(w, p, j) {
    const it = w.items.get(j.item);
    if (!it || !ITEMS[it.def].weapon) return FAIL;
    const r = goTo(w, p, j, it.x, it.y, "on");
    if (r < 0) return FAIL;
    if (r === 0) return CONT;
    const old = p.weapon;
    p.weapon = ITEMS[it.def].weapon;
    w.removeItem(it);
    if (old && old !== "fists") w.spawnItem("w_" + old, 1, p.x, p.y);
    w.letter("neutral", "Новое оружие", `${displayName(p)}: ${WEAPONS[p.weapon].name}.`);
    return DONE;
  },
};

function face(p, x) {
  if (x !== p.x) p.facing = x < p.x ? -1 : 1;
}

// ---------- пленные ----------
export function makePrisoner(w, q, bed) {
  q.kind = "prisoner";
  q.faction = "prisoner";
  q.captureDesig = false;
  q.raidId = null;
  q.resistance = w.rng.range(4, 12);
  q.food = Math.max(q.food ?? 0.5, 0.5);
  q.rest = q.rest ?? 0.6;
  q.thoughts = q.thoughts || [];
  q.lastChat = w.tick;
  bed.forPrisoner = true;
  bed.owner = q.id;
  q.bed = bed.id;
  w.letter("neutral", "Пленник", `${displayName(q)} теперь в плену. Надзиратели будут кормить и уговаривать присоединиться.`, q.x, q.y);
  w.emit("pawns");
}

export function recruit(w, q) {
  q.kind = "colonist";
  q.faction = "player";
  q.resistance = 0;
  if (q.bed) {
    const b = w.buildings.get(q.bed);
    if (b) {
      b.forPrisoner = false;
    }
  }
  q.work = defaultWork(q);
  q.mood = 55;
  w.stats.joined++;
  for (const c of w.colonists()) if (c !== q) addThought(w, c, "prisonerJoined");
  w.letter("good", "Новый колонист", `${q.name} соглашается присоединиться к колонии!`, q.x, q.y);
  w.emit("pawns");
}

export function orderEquip(w, p, item) {
  clearJob(w, p);
  p.forced = { type: "equip", item: item.id, step: 0, forced: true };
  p.thinkAt = 0;
}

export function startSadJob(w, p) {
  const j = sleepJob(w, p, false);
  j.sad = true;
  j.max = TPD;
  return j;
}

export { eatJob, sleepJob, TPH };
