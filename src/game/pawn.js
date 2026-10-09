// Создание поселенцев, их нужды, здоровье, настроение и главный тик
import {
  TPH, TPD, SKILLS, TRAITS, THOUGHTS, WORK, NAMES_M, NAMES_F, SURNAMES, RAIDER_NAMES,
  BACKSTORIES, SKIN, HAIR, SHIRTS, ANIMALS,
} from "./defs.js";
import { traitMul, addThought, moveSpeed, clearJob, cheb, displayName } from "./pawnutil.js";
import { attack, isEnemy, kill, nearestEnemy } from "./combat.js";
import { runJob, findJobFor, fleeJob } from "./jobs.js";
import { draftedAI, raiderAI, animalAI, traderAI, prisonerAI, mentalAI } from "./ai.js";

const FOOD_RATE = 1 / (TPD * 1.25);

export function newPawn(w, kind, faction) {
  return {
    id: w.nextId++, kind, faction, name: "", short: "",
    x: 0, y: 0, path: null, pathI: 0, moveT: 0, facing: 1,
    hp: 100, maxHp: 100, bleed: 0, downed: false, dead: false,
    food: 0.85, rest: 0.9, mood: 60, thoughts: [], job: null, carry: null, cd: 0,
  };
}

export function makeHuman(w, rng, kind, opts = {}) {
  const faction = kind === "colonist" ? "player" : kind === "raider" ? "hostile" : "neutral";
  const p = newPawn(w, kind, faction);
  const gender = opts.gender || (rng.chance(0.5) ? "m" : "f");
  p.gender = gender;
  const used = new Set(w.pawns.map((q) => q.short).concat(opts.usedNames || []));
  let first = "";
  for (let t = 0; t < 30; t++) {
    first = rng.pick(gender === "m" ? NAMES_M : NAMES_F);
    if (!used.has(first)) break;
  }
  let sur = rng.pick(SURNAMES);
  if (gender === "f") sur += "а";
  p.short = first;
  p.name = first + " " + sur;
  p.age = rng.int(18, 58);
  const bs = rng.pick(BACKSTORIES);
  p.title = bs.title;
  p.skills = {};
  for (const k in SKILLS) {
    const l = rng.int(0, 4) + (bs.skills[k] || 0) + (rng.chance(0.2) ? rng.int(1, 3) : 0);
    p.skills[k] = { lvl: Math.min(16, l), xp: 0 };
  }
  p.traits = [];
  const keys = rng.shuffle(Object.keys(TRAITS));
  const n = rng.chance(0.45) ? 2 : 1;
  for (const k of keys) {
    if (p.traits.length >= n) break;
    if (p.traits.some((t) => TRAITS[t].conflict === k || TRAITS[k].conflict === t)) continue;
    p.traits.push(k);
  }
  p.maxHp = Math.round(100 * traitMul(p, "hp"));
  p.hp = p.maxHp;
  p.look = {
    skin: rng.pick(SKIN),
    hair: rng.pick(HAIR),
    hairStyle: gender === "f" ? rng.int(2, 4) : rng.int(0, 2),
    shirt: rng.pick(SHIRTS),
  };
  p.work = defaultWork(p);
  p.weapon = opts.weapon || "fists";
  p.bed = null;
  return p;
}

// Приоритеты по умолчанию: две лучшие работы по навыкам — приоритет 2, остальное 3
export function defaultWork(p) {
  const work = {};
  const ranked = WORK.filter((wt) => wt.skill).sort((a, b) => p.skills[b.skill].lvl - p.skills[a.skill].lvl);
  const top = ranked.filter((wt) => p.skills[wt.skill].lvl >= 5).slice(0, 2).map((wt) => wt.id);
  for (const wt of WORK) work[wt.id] = top.includes(wt.id) ? 2 : 3;
  // спасать раненых важнее всего
  work.doctor = top[0] === "doctor" ? 1 : 2;
  return work;
}

export function makeColonist(w, rng, opts = {}) {
  const p = makeHuman(w, rng, "colonist", opts);
  p.weapon = opts.weapon || rng.pick(["pistol", "rifle", "knife", "bow", "pistol"]);
  return p;
}

export function makeRaider(w, rng, weapon) {
  const p = makeHuman(w, rng, "raider");
  const nick = rng.pick(RAIDER_NAMES);
  const [first, sur] = p.name.split(" ");
  p.name = `${first} «${nick}» ${sur}`;
  p.short = nick;
  p.weapon = weapon;
  p.look.shirt = rng.pick(["#8c3b2e", "#6e2a22", "#7a4a2a", "#5a3a3a", "#704030"]);
  const vet = Math.min(4, Math.floor(w.day / 10));
  p.skills.shooting.lvl = Math.max(p.skills.shooting.lvl, rng.int(1, 5) + vet);
  p.skills.melee.lvl = Math.max(p.skills.melee.lvl, rng.int(1, 5) + vet);
  p.food = 0.8;
  return p;
}

export function makeTrader(w, rng, role) {
  const p = makeHuman(w, rng, "trader");
  p.weapon = role === "guard" ? "rifle" : "pistol";
  p.title = role === "guard" ? "Охрана каравана" : "Торговец";
  p.look.shirt = role === "guard" ? "#3b5568" : "#2f6f8f";
  p.role = role;
  return p;
}

export function makeAnimal(w, rng, type) {
  const d = ANIMALS[type];
  const p = newPawn(w, "animal", "wild");
  p.animal = type;
  p.name = p.short = d.name;
  p.maxHp = p.hp = d.hp;
  p.facing = rng.chance(0.5) ? 1 : -1;
  p.thoughts = null;
  return p;
}

export function placePawn(w, p, x, y) {
  p.x = x;
  p.y = y;
  w.pawns.push(p);
  w.ents.set(p.id, p);
  w.emit("pawns");
  return p;
}

// ---------- настроение ----------
export function moodParts(w, p) {
  const parts = [];
  if (w.diff.mood) parts.push(["Рассказчик", w.diff.mood]);
  for (const t of p.traits || []) if (TRAITS[t].mood) parts.push([TRAITS[t].name, TRAITS[t].mood]);
  for (const t of p.thoughts || []) if (t.until > w.tick) parts.push([THOUGHTS[t.id].label, THOUGHTS[t.id].mood]);
  if (p.food < 0.05) parts.push(["Истощение", -18]);
  else if (p.food < 0.25) parts.push(["Голод", -6]);
  if (p.rest < 0.05) parts.push(["Изнеможение", -12]);
  else if (p.rest < 0.2) parts.push(["Усталость", -5]);
  const t = w.tempAt(w.idx(p.x, p.y));
  if (t < -14) parts.push(["Мороз", -14]);
  else if (t < -1) parts.push(["Холодно", -6]);
  else if (t > 34) parts.push(["Жара", -6]);
  if (p.hp < p.maxHp * 0.4) parts.push(["Сильная боль", -14]);
  else if (p.hp < p.maxHp * 0.8) parts.push(["Боль", -5]);
  return parts;
}
export function moodTarget(w, p) {
  let v = 50;
  for (const [, m] of moodParts(w, p)) v += m;
  return Math.max(0, Math.min(100, v));
}
function updateMood(w, p) {
  p.thoughts = p.thoughts.filter((t) => t.until > w.tick);
  const target = moodTarget(w, p);
  const d = target - p.mood;
  p.mood += Math.max(-1, Math.min(1, d));
}

const BREAKS = {
  wander: "бродит в оцепенении",
  binge: "заедает стресс и ест всё подряд",
  sad: "впадает в хандру и не выходит из кровати",
};
function hourlyColonist(w, p) {
  if (p.mental || p.drafted || p.downed) return;
  if (p.mood >= 22) return;
  const chance = (p.mood < 10 ? 0.14 : 0.06) * traitMul(p, "breaks");
  if (w.rng.next() >= chance) return;
  const type = w.rng.pick(Object.keys(BREAKS));
  clearJob(w, p);
  p.mental = { type, until: w.tick + w.rng.int(5, 9) * TPH };
  w.letter("bad", "Нервный срыв", `${displayName(p)} ${BREAKS[type]}. Поднимите настроение: еда, кровати, уют.`, p.x, p.y);
}
function endBreak(w, p) {
  p.mental = null;
  clearJob(w, p);
  addThought(w, p, "catharsis");
}
export function breakLabel(type) {
  return BREAKS[type];
}

// ---------- нужды и здоровье ----------
function vitals(w, p) {
  const human = p.kind === "colonist" || p.kind === "prisoner";
  if (human) {
    p.food -= FOOD_RATE * traitMul(p, "hunger") * (p.sleeping || p.downed ? 0.5 : 1);
    if (p.food < 0) p.food = 0;
    if (p.sleeping) p.rest = Math.min(1, p.rest + (p.inBed ? 1 / 650 : 1 / 950));
    else if (p.downed) p.rest = Math.min(1, p.rest + (p.inBed ? 1 / 1200 : 0));
    else p.rest = Math.max(0, p.rest - 1 / 1650);
    if (p.food <= 0) p.hp -= 0.004;
  }
  if (p.bleed > 0) {
    p.hp -= p.downed ? p.bleed * 0.5 : p.bleed;
    p.bleed *= 0.9985;
    if (p.bleed < 0.0006) p.bleed = 0;
  } else if (p.hp < p.maxHp && (!human || p.food > 0)) {
    let r = p.maxHp / (TPD * 4);
    if (p.inBed || p.sleeping) r *= 2;
    if (p.tendUntil > w.tick) r *= 1 + (p.tendQ || 0.3);
    p.hp = Math.min(p.maxHp, p.hp + r);
  }
  if (p.kind !== "animal" && (w.tick + p.id) % 10 === 0) {
    const t = w.tempAt(w.idx(p.x, p.y));
    if (t < -12 || t > 44) p.hp -= 0.05;
  }
  if (p.hp <= 0) {
    kill(w, p, null);
    return;
  }
  if (!p.downed && p.hp < p.maxHp * 0.25) {
    if (p.kind === "animal") {
      kill(w, p, null);
      return;
    }
    p.downed = true;
    clearJob(w, p);
    p.drafted = false;
    p.mental = null;
    w.emit("pawns");
  } else if (p.downed && p.hp >= p.maxHp * 0.4 && p.bleed === 0) {
    p.downed = false;
    if (p.faction === "hostile" && p.kind === "raider") p.fleeing = true;
    w.emit("pawns");
  }
}

function moveTick(w, p) {
  if (!p.path) return;
  if (p.pathI >= p.path.length) {
    p.path = null;
    return;
  }
  const next = p.path[p.pathI];
  const c = w.cost[next];
  if (c <= 0) {
    p.path = null;
    p.moveT = 0;
    return;
  }
  if (w.doorMask[next] && (p.faction === "hostile" || p.faction === "wild")) {
    if (p.faction === "hostile") p.blockedDoor = next;
    p.path = null;
    p.moveT = 0;
    return;
  }
  const nx = next % w.W, ny = (next / w.W) | 0;
  const diag = nx !== p.x && ny !== p.y;
  p.moveT += moveSpeed(p) / (c * (diag ? 1.4142 : 1));
  if (p.moveT >= 1) {
    p.moveT = 0;
    if (nx !== p.x) p.facing = nx < p.x ? -1 : 1;
    p.x = nx;
    p.y = ny;
    p.pathI++;
    if (p.inBed && !p.downed) p.inBed = null;
    if (p.pathI >= p.path.length) p.path = null;
  }
}

function colonistAI(w, p) {
  if (p.drafted) {
    draftedAI(w, p);
    return;
  }
  if (p.waitFor) {
    const d = w.get(p.waitFor);
    if (d && !d.dead && d.job && d.job.type === "tend" && d.job.patient === p.id) {
      p.path = null;
      return;
    }
    p.waitFor = null;
  }
  if (p.mental) {
    if (w.tick >= p.mental.until) endBreak(w, p);
    else {
      mentalAI(w, p);
      return;
    }
  }
  // самооборона, если бьют вплотную
  if (p.lastHitTick && w.tick - p.lastHitTick < 60) {
    const a = w.get(p.lastAttacker);
    if (a && a.kind !== "building" && isEnemy(p, a) && !a.downed && cheb(p.x, p.y, a.x, a.y) <= 1) {
      if (attack(w, p, a)) {
        p.path = null;
        return;
      }
    }
  }
  // враги рядом — убегаем (призовите колонистов, чтобы они сражались)
  if ((w.tick + p.id) % 15 === 0 && !(p.job && p.job.type === "flee")) {
    const e = nearestEnemy(w, p, 8);
    if (e && !(p.job && p.job.type === "hunt" && p.job.target === e.id)) {
      const fj = fleeJob(w, p, e);
      if (fj) {
        clearJob(w, p);
        p.job = fj;
      }
    }
  }
  if (p.job) {
    runJob(w, p);
    return;
  }
  if (w.tick < (p.thinkAt || 0)) return;
  p.job = findJobFor(w, p);
  if (p.job) runJob(w, p);
}

export function pawnTick(w, p) {
  if (p.dead || p.despawned) return;
  if (p.carriedBy) {
    const c = w.get(p.carriedBy);
    if (!c || c.dead || c.carrying !== p.id) p.carriedBy = null;
    else {
      p.x = c.x;
      p.y = c.y;
    }
  }
  vitals(w, p);
  if (p.dead) return;
  if (p.cd > 0) p.cd--;
  if (p.downed || p.carriedBy) return;
  moveTick(w, p);
  if (p.thoughts && (w.tick + p.id) % 25 === 0) updateMood(w, p);
  if (p.kind === "colonist" && (w.tick + p.id * 13) % TPH === 0) hourlyColonist(w, p);
  switch (p.kind) {
    case "colonist":
      colonistAI(w, p);
      break;
    case "prisoner":
      prisonerAI(w, p);
      break;
    case "raider":
      raiderAI(w, p);
      break;
    case "animal":
      animalAI(w, p);
      break;
    case "trader":
      traderAI(w, p);
      break;
  }
}

// ---------- команды игрока ----------
export function setDrafted(w, p, on) {
  if (p.kind !== "colonist" || p.dead || p.downed) return;
  if (on) {
    clearJob(w, p);
    p.mental = null;
  } else {
    p.forceTarget = null;
    p.path = null;
  }
  p.drafted = on;
  w.emit("pawns");
}

export { BREAKS };
