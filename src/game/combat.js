// Бой: стрельба, ближний бой, урон, смерть, турели
import { WEAPONS, ANIMALS, BUILDINGS, PLANTS, TPD } from "./defs.js";
import { skillLvl, traitMul, gainXp, addThought, clearJob, cheb, dist, displayName, gx } from "./pawnutil.js";

export function blocksSight(w, i) {
  if (w.rock[i]) return true;
  const b = w.bAt(i);
  if (!b || !b.complete) return false;
  const d = BUILDINGS[b.def];
  return !!(d.wall || d.door);
}

export function canSee(w, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (let guard = 0; guard < 200; guard++) {
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (x === x1 && y === y1) return true;
    if (blocksSight(w, y * w.W + x)) return false;
  }
  return true;
}

export function isEnemy(a, b) {
  if (!b || a === b || a.dead || b.dead || b.despawned) return false;
  if (a.faction === "player") return b.faction === "hostile";
  if (a.faction === "hostile") return b.faction === "player";
  return false;
}

export function weaponOf(p) {
  if (p.kind === "animal") {
    const d = ANIMALS[p.animal];
    return { melee: true, dmg: d.dmg, cd: 36 };
  }
  return WEAPONS[p.weapon || "fists"] || WEAPONS.fists;
}

export function inRange(w, a, tx, ty) {
  const wp = weaponOf(a);
  if (wp.melee) return cheb(a.x, a.y, tx, ty) <= 1;
  return dist(a.x, a.y, tx, ty) <= wp.range && canSee(w, a.x, a.y, tx, ty);
}

function coverFor(w, t, a) {
  const sx = Math.sign(a.x - t.x), sy = Math.sign(a.y - t.y);
  let best = 0;
  const cells = [[t.x + sx, t.y + sy], [t.x + sx, t.y], [t.x, t.y + sy]];
  for (const [x, y] of cells) {
    if ((x === t.x && y === t.y) || !w.inB(x, y)) continue;
    const i = w.idx(x, y);
    const b = w.bAt(i);
    let c = 0;
    if (b && b.complete) {
      const d = BUILDINGS[b.def];
      c = d.cover || (d.wall ? 0.75 : d.solid ? 0.4 : 0);
    }
    if (w.rock[i]) c = 0.75;
    const pl = w.plant[i];
    if (pl && PLANTS[pl].tree) c = Math.max(c, 0.25);
    if (c > best) best = c;
  }
  // укрытие работает, только если стрелок не вплотную
  return dist(a.x, a.y, t.x, t.y) < 2 ? 0 : best;
}

// Атака цели (поселенец или постройка). true — цель в зоне поражения (атака сделана или идёт перезарядка)
export function attack(w, a, t) {
  const wp = weaponOf(a);
  const tx = t.x, ty = t.y;
  if (wp.melee) {
    if (cheb(a.x, a.y, tx, ty) > 1) return false;
  } else {
    if (dist(a.x, a.y, tx, ty) > wp.range) return false;
    if (!canSee(w, a.x, a.y, tx, ty)) return false;
  }
  if (tx !== a.x) a.facing = tx < a.x ? -1 : 1;
  a.aim = { x: tx, y: ty, until: w.tick + 25 };
  if (a.cd > 0) return true;
  a.cd = wp.cd;
  const rng = w.rng;
  let hit;
  if (wp.melee) {
    const sk = a.kind === "animal" ? 8 : skillLvl(a, "melee");
    hit = rng.next() < Math.min(0.95, 0.6 + sk * 0.02);
    gainXp(a, "melee", 25);
    w.addFx({ k: "swing", x: a.x, y: a.y, x1: tx, y1: ty, t: 6 });
  } else {
    const d = dist(a.x, a.y, tx, ty);
    let acc = wp.acc * (0.55 + skillLvl(a, "shooting") * 0.035) * traitMul(a, "aim");
    acc *= 1 - (d / wp.range) * 0.25;
    if (t.kind !== "building") acc *= 1 - coverFor(w, t, a);
    if (t.downed) acc = Math.max(acc, 0.8);
    hit = rng.next() < Math.max(0.05, Math.min(0.95, acc));
    gainXp(a, "shooting", 18);
    const jx = hit ? 0 : rng.range(-1.2, 1.2), jy = hit ? 0 : rng.range(-1.2, 1.2);
    w.addFx({ k: "shot", x0: a.x, y0: a.y, x1: tx + jx, y1: ty + jy, t: 5, hit });
  }
  if (hit) {
    const dmg = wp.dmg * rng.range(0.75, 1.25);
    if (t.kind === "building") damageBuilding(w, t, dmg);
    else hurt(w, t, dmg, a);
  }
  return true;
}

export function hurt(w, t, dmg, a) {
  if (t.dead) return;
  t.hp -= dmg;
  t.bleed += dmg * (t.kind === "animal" ? 0.0008 : 0.0006);
  if (a) {
    t.lastAttacker = a.id;
    t.lastHitTick = w.tick;
  }
  if (w.fx.length < 250) w.addFx({ k: "blood", x: t.x + w.rng.range(-0.3, 0.3), y: t.y + w.rng.range(-0.3, 0.3), t: 400 });
  if (t.sleeping) t.wake = true;
  if (t.kind === "animal") animalReact(w, t, a);
  if (t.hp <= 0 || (t.kind === "animal" && t.hp < t.maxHp * 0.2)) kill(w, t, a);
  else if (!t.downed && t.hp < t.maxHp * 0.25) down(w, t);
}

function animalReact(w, t, a) {
  if (!a || a.kind === "animal" || t.dead) return;
  const d = ANIMALS[t.animal];
  if (t.faction === "hostile") {
    t.target = a.id;
    return;
  }
  if (w.rng.next() < d.retaliate) {
    t.faction = "hostile";
    t.manhunterUntil = w.tick + TPD * 0.35;
    t.target = a.id;
    t.path = null;
    w.letter("threat", "Животное в ярости", `${d.name} нападает: ${displayName(a)} в опасности!`, t.x, t.y);
  } else {
    t.fleeUntil = w.tick + 160;
    t.fleeFrom = { x: a.x, y: a.y };
    t.path = null;
  }
}

export function down(w, t) {
  t.downed = true;
  clearJob(w, t);
  t.drafted = false;
  t.forceTarget = null;
  t.mental = null;
  if (t.kind === "colonist") w.letter("bad", "Колонист без сознания", `${displayName(t)} ${gx(t, "тяжело ранен", "тяжело ранена")} и не может двигаться. Врач отнесёт в кровать.`, t.x, t.y);
  w.emit("pawns");
}

export function kill(w, t, killer) {
  if (t.dead) return;
  clearJob(w, t);
  t.dead = true;
  t.downed = true;
  t.deadTick = w.tick;
  t.hp = 0;
  t.bleed = 0;
  t.drafted = false;
  t.sleeping = false;
  t.inBed = null;
  if (t.carriedBy) {
    const c = w.get(t.carriedBy);
    if (c && c.carrying === t.id) c.carrying = null;
    t.carriedBy = null;
  }
  if (t.kind !== "animal" && t.weapon && t.weapon !== "fists") {
    w.spawnItem("w_" + t.weapon, 1, t.x, t.y);
    t.weapon = "fists";
  }
  if (t.kind === "animal") {
    const d = ANIMALS[t.animal];
    w.spawnItem("meat", Math.max(3, Math.round(d.meat * w.rng.range(0.7, 1))), t.x, t.y);
    t.huntDesig = false;
  }
  if (t.bed) {
    const b = w.get(t.bed);
    if (b && b.owner === t.id) b.owner = null;
    t.bed = null;
  }
  if (t.kind === "colonist") {
    w.stats.deaths++;
    w.letter("death", "Потеря", `${t.name} больше нет с нами.`, t.x, t.y);
    for (const c of w.colonists()) addThought(w, c, "friendDied");
  } else if (t.kind === "prisoner") {
    w.letter("bad", "Смерть пленника", `Пленник ${displayName(t)} умер.`, t.x, t.y);
  }
  if (t.faction === "hostile" && killer && killer.faction === "player") w.stats.kills++;
  w.emit("pawns");
}

export function damageBuilding(w, b, dmg) {
  if (!w.buildings.has(b.id)) return;
  b.hp -= dmg;
  if (b.hp <= 0) {
    const d = BUILDINGS[b.def];
    if (b.complete) w.letter("bad", "Разрушено", `${d.name} разрушена врагами.`, b.x, b.y);
    w.removeBuilding(b, b.complete ? 0.25 : 0);
  }
}

export function nearestEnemy(w, p, range, needSight = true) {
  let best = null, bd = range + 0.01;
  for (const q of w.pawns) {
    if (q.downed || !isEnemy(p, q)) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d > bd) continue;
    if (needSight && d > 1.5 && !canSee(w, p.x, p.y, q.x, q.y)) continue;
    best = q;
    bd = d;
  }
  return best;
}

export function turretTick(w, b) {
  if (b.cd > 0) {
    b.cd--;
    return;
  }
  const t = BUILDINGS[b.def].turret;
  let best = null, bd = t.range;
  for (const q of w.pawns) {
    if (q.faction !== "hostile" || q.dead || q.downed) continue;
    const d = dist(b.x, b.y, q.x, q.y);
    if (d > bd || !canSee(w, b.x, b.y, q.x, q.y)) continue;
    best = q;
    bd = d;
  }
  if (!best) {
    b.cd = 10;
    return;
  }
  b.cd = t.cd;
  b.aim = { x: best.x, y: best.y };
  let acc = t.acc * (1 - (bd / t.range) * 0.25) * (1 - coverFor(w, best, b));
  const hit = w.rng.next() < Math.max(0.05, acc);
  const jx = hit ? 0 : w.rng.range(-1, 1), jy = hit ? 0 : w.rng.range(-1, 1);
  w.addFx({ k: "shot", x0: b.x, y0: b.y, x1: best.x + jx, y1: best.y + jy, t: 5, hit });
  if (hit) hurt(w, best, t.dmg * w.rng.range(0.8, 1.2), { id: b.id, faction: "player", kind: "building", x: b.x, y: b.y });
}
