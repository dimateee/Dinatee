// Общие помощники для поселенцев, врагов и животных
import { TPD, THOUGHTS, TRAITS, ANIMALS } from "./defs.js";

export function skillLvl(p, s) {
  const k = p.skills && p.skills[s];
  return k ? k.lvl : 4;
}
export function skillFactor(p, s) {
  return 0.45 + skillLvl(p, s) * 0.055;
}
export function traitMul(p, key) {
  let m = 1;
  if (!p.traits) return m;
  for (const t of p.traits) {
    const d = TRAITS[t];
    if (d && typeof d[key] === "number") m *= d[key];
  }
  return m;
}
export function hasTrait(p, key) {
  return !!(p.traits && p.traits.some((t) => TRAITS[t] && TRAITS[t][key]));
}
export function workSpeed(w, p, skill) {
  let s = skill ? skillFactor(p, skill) : 1;
  s *= traitMul(p, "work");
  if (p.hp < p.maxHp * 0.6) s *= 0.75;
  if (p.rest < 0.1) s *= 0.8;
  return s;
}
export function gainXp(p, skill, amt) {
  const s = p.skills && p.skills[skill];
  if (!s) return;
  s.xp += amt;
  const need = 600 + s.lvl * 160;
  if (s.xp >= need && s.lvl < 20) {
    s.xp -= need;
    s.lvl++;
  }
}
export function moveSpeed(p) {
  let s;
  if (p.kind === "animal") s = ANIMALS[p.animal].speed;
  else if (p.kind === "raider") s = 0.19;
  else if (p.kind === "trader") s = 0.17;
  else s = 0.2;
  s *= traitMul(p, "move");
  if (p.hp < p.maxHp * 0.5) s *= 0.7;
  if (p.carrying) s *= 0.75;
  return s;
}
export function addThought(w, p, id) {
  const d = THOUGHTS[id];
  if (!d || !p.thoughts) return;
  if (d.ascetic && hasTrait(p, "ascetic")) return;
  p.thoughts = p.thoughts.filter((t) => t.id !== id);
  p.thoughts.push({ id, until: w.tick + d.days * TPD });
}
export function cheb(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}
export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
export function isAt(p, tx, ty, goal) {
  const d = cheb(p.x, p.y, tx, ty);
  return goal === "on" ? d === 0 : goal === "adj" ? d === 1 : d <= 1;
}
export function startPath(w, p, tx, ty, goal = "on", mode = 0) {
  if (isAt(p, tx, ty, goal)) {
    p.path = null;
    return true;
  }
  if (!w.canReach(p.x, p.y, tx, ty, goal)) return false;
  const path = w.pf.find(p.x, p.y, tx, ty, goal, mode);
  if (!path) return false;
  p.path = path.length ? path : null;
  p.pathI = 0;
  p.moveT = 0;
  return true;
}
// 1 — на месте, 0 — в пути, -1 — не дойти
export function goTo(w, p, j, tx, ty, goal = "on", mode = 0) {
  if (isAt(p, tx, ty, goal)) {
    p.path = null;
    p.moveT = 0;
    return 1;
  }
  if (p.path) return 0;
  j.repaths = (j.repaths || 0) + 1;
  if (j.repaths > 8) return -1;
  return startPath(w, p, tx, ty, goal, mode) ? 0 : -1;
}

// Сбросить текущую работу: отпустить брони, выложить переносимое
export function clearJob(w, p) {
  const j = p.job;
  p.job = null;
  p.path = null;
  p.moveT = 0;
  p.working = null;
  if (p.sleeping) p.sleeping = false;
  if (j && j.type === "sleep" && !p.downed) p.inBed = null;
  w.releaseAll(p.id);
  if (j && j.patient) {
    const q = w.get(j.patient);
    if (q && q.waitFor === p.id) q.waitFor = null;
  }
  if (j && j.ingredients && j.ingredients.length) {
    for (const g of j.ingredients) w.spawnItem(g.def, g.count, p.x, p.y);
    j.ingredients = [];
    p.carry = null;
  }
  if (p.carry) {
    w.spawnItem(p.carry.def, p.carry.count, p.x, p.y);
    p.carry = null;
  }
  if (p.carrying) {
    const q = w.get(p.carrying);
    if (q) {
      q.carriedBy = null;
      q.x = p.x;
      q.y = p.y;
    }
    p.carrying = null;
  }
  return j;
}

// Окончание по полу персонажа: gx(p, "ранен", "ранена")
export function gx(p, m, f) {
  return p && p.gender === "f" ? f : m;
}

export function displayName(p) {
  return p.short || p.name;
}
