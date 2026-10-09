// Рассказчик: налёты, гости, торговцы, погодные и прочие события
import { TPH, TPD, ITEMS, ANIMALS, COLONIST_CAP, PLANTS, CROPS, PLANT } from "./defs.js";
import { makeColonist, makeRaider, makeAnimal, makeTrader, placePawn } from "./pawn.js";
import { addThought, displayName } from "./pawnutil.js";

export function storyTick(w) {
  const s = w.story;
  if (w.tick % 30 === 0) updateRaids(w);
  if (s.trader && w.tick % 60 === 0) updateTrader(w);
  if (w.tick % TPH !== 50) return;
  if (!s.nextMinor) s.nextMinor = w.tick + TPD * 0.9;
  if (!s.nextThreat) s.nextThreat = w.diff.grace * TPD + w.rng.range(0, TPD);
  if (w.tick >= s.nextMinor) {
    fireMinor(w);
    s.nextMinor = w.tick + w.rng.range(1.1, 2.4) * TPD;
  }
  if (w.tick >= s.nextThreat) {
    fireThreat(w);
    s.nextThreat = w.tick + w.rng.range(w.diff.threatMin, w.diff.threatMax) * TPD;
  }
}

export function threatPoints(w) {
  const cols = w.colonists().length;
  return Math.max(35, (w.wealth() / 130 + w.day * 2.2 + cols * 8) * w.diff.points);
}

function fireThreat(w) {
  if (!w.colonists().length) return;
  const pts = threatPoints(w);
  if (w.day >= 3 && w.rng.chance(0.3)) manhunters(w, pts);
  else raid(w, pts);
}

// ---------- налёт ----------
export function raid(w, points) {
  const s = w.story;
  const kinds = [["club", 30], ["knife", 32], ["bow", 40], ["spear", 42], ["pistol", 48]];
  if (w.day >= 14) kinds.push(["rifle", 62]);
  if (w.day >= 24) kinds.push(["smg", 72]);
  const edge = w.edgeCell();
  if (!edge) return;
  const raidObj = { id: s.nextRaidId++, members: [], state: "gather", start: w.tick, initial: 0 };
  let budget = points;
  const rs = w.regionsAround(edge.x, edge.y);
  while (raidObj.members.length < 14) {
    let afford = kinds.filter((k) => k[1] <= budget);
    if (!afford.length) {
      if (raidObj.members.length) break;
      afford = [kinds[0]];
    }
    const [weapon, cost] = w.rng.pick(afford);
    budget -= cost;
    const p = makeRaider(w, w.rng, weapon);
    p.raidId = raidObj.id;
    const c = spawnNear(w, edge.x, edge.y, rs);
    placePawn(w, p, c.x, c.y);
    raidObj.members.push(p.id);
  }
  raidObj.initial = raidObj.members.length;
  s.raids.push(raidObj);
  w.stats.raids++;
  const n = raidObj.initial;
  w.letter("threat", "Налёт!", `${n} ${plural(n, "налётчик", "налётчика", "налётчиков")} собираются у края карты и скоро нападут. Призовите колонистов (кнопка «В бой») и займите оборону.`, edge.x, edge.y);
  w.emit("raid", raidObj);
}

function spawnNear(w, x, y, rs) {
  for (let t = 0; t < 20; t++) {
    const nx = x + w.rng.int(-3, 3), ny = y + w.rng.int(-3, 3);
    if (!w.inB(nx, ny)) continue;
    const i = w.idx(nx, ny);
    if (w.standable(i) && rs.includes(w.region[i])) return { x: nx, y: ny };
  }
  return { x, y };
}

function updateRaids(w) {
  const s = w.story;
  for (const r of s.raids) {
    const members = r.members.map((id) => w.get(id)).filter(Boolean);
    const active = members.filter((m) => !m.dead && !m.downed && !m.despawned && m.faction === "hostile");
    if (r.state === "gather" && w.tick - r.start > 300) r.state = "assault";
    const lost = members.filter((m) => m.dead || m.downed || m.faction !== "hostile").length + (r.initial - members.length);
    if (r.state === "assault" && (lost >= Math.ceil(r.initial * 0.5) || w.tick - r.start > TPD * 1.5)) {
      r.state = "flee";
      if (active.length) w.letter("good", "Враги отступают", "Налётчики понесли потери и бегут.");
    }
    if (!active.length) {
      r.done = true;
      if (lost > 0) {
        w.letter("good", "Налёт отбит", "Колония выстояла! Раненых врагов можно взять в плен через их карточку.");
        for (const c of w.colonists()) addThought(w, c, "victory");
      }
    }
  }
  s.raids = s.raids.filter((r) => !r.done);
  // угроза миновала — призванные колонисты возвращаются к работе
  const threat = s.raids.length > 0 || w.hostiles().length > 0;
  const ended = s.threat && !threat;
  s.threat = threat;
  if (ended) {
    let any = false;
    for (const c of w.colonists()) {
      if (c.drafted) {
        c.drafted = false;
        c.forceTarget = null;
        c.path = null;
        any = true;
      }
    }
    if (any) w.emit("pawns");
  }
}

function manhunters(w, points) {
  const opts = [["wolf", 34], ["boar", 40]];
  if (points > 150) opts.push(["bear", 95]);
  const [type, cost] = w.rng.pick(opts);
  const n = Math.max(2, Math.min(12, Math.round(points / cost)));
  const edge = w.edgeCell();
  if (!edge) return;
  const rs = w.regionsAround(edge.x, edge.y);
  for (let k = 0; k < n; k++) {
    const a = makeAnimal(w, w.rng, type);
    a.faction = "hostile";
    a.manhunterUntil = w.tick + TPD * 1.1;
    a.leaveAfter = true;
    const c = spawnNear(w, edge.x, edge.y, rs);
    placePawn(w, a, c.x, c.y);
  }
  w.letter("threat", "Стая в ярости!", `${n} × ${ANIMALS[type].name.toLowerCase()} в бешенстве идут на колонию. Укройтесь за дверями или дайте бой.`, edge.x, edge.y);
  w.emit("raid");
}

// ---------- мирные события ----------
function fireMinor(w) {
  const s = w.story;
  const season = w.seasonIdx;
  const cols = w.colonists().length;
  const hasCrops = [...w.zones.values()].some((z) => z.type === "grow");
  const wild = w.pawns.filter((p) => p.kind === "animal" && p.faction === "wild" && !p.dead);
  const opts = [
    ["cargo", 24],
    ["wanderer", cols < COLONIST_CAP ? (cols < 4 ? 14 : 8) : 0],
    ["trader", s.trader ? 0 : 16],
    ["meteor", 9],
    ["blight", hasCrops && w.day > 4 ? 6 : 0],
    ["coldsnap", season === 2 || season === 3 ? 7 : 0],
    ["heatwave", season === 1 ? 6 : 0],
    ["madanimal", wild.length && w.day > 2 ? 6 : 0],
    ["herd", 11],
  ].filter((o) => o[1] > 0);
  const ev = w.rng.weighted(opts);
  EVENTS[ev](w);
}

const CARGO = [
  ["steel", 40, 90], ["wood", 50, 110], ["ration", 5, 10], ["medicine", 4, 9],
  ["components", 2, 6], ["silver", 80, 220], ["rice", 30, 60], ["w_rifle", 1, 1], ["w_smg", 1, 1],
];

export const EVENTS = {
  cargo(w) {
    const c = w.colonyCenter();
    const [def, a, b] = w.rng.pick(CARGO);
    const n = w.rng.int(a, b);
    const x = Math.max(2, Math.min(w.W - 3, c.x + w.rng.int(-9, 9)));
    const y = Math.max(2, Math.min(w.H - 3, c.y + w.rng.int(-9, 9)));
    const spot = w.nearestStandable(x, y) || { x, y };
    w.spawnItem(def, n, spot.x, spot.y);
    w.addFx({ k: "pod", x: spot.x, y: spot.y, t: 60 });
    w.letter("good", "Грузовая капсула", `С неба упала капсула: ${ITEMS[def].name.toLowerCase()} × ${n}.`, spot.x, spot.y);
  },
  wanderer(w) {
    const p = makeColonist(w, w.rng);
    const e = w.edgeCell();
    if (!e) return;
    placePawn(w, p, e.x, e.y);
    w.stats.joined++;
    for (const c of w.colonists()) if (c !== p) addThought(w, c, "newColonist");
    w.letter("good", "Новый колонист", `${p.name} (${p.title.toLowerCase()}, ${p.age} лет) просит приюта и присоединяется к колонии.`, e.x, e.y);
  },
  trader(w) {
    const e = w.edgeCell();
    if (!e) return;
    const rs = w.regionsAround(e.x, e.y);
    const ids = [];
    for (const role of ["trader", "guard"]) {
      const p = makeTrader(w, w.rng, role);
      const c = spawnNear(w, e.x, e.y, rs);
      placePawn(w, p, c.x, c.y);
      ids.push(p.id);
    }
    w.story.trader = { pawns: ids, until: w.tick + TPD * 1.3, stock: traderStock(w), silver: w.rng.int(350, 900), leaving: false };
    w.letter("neutral", "Торговый караван", "Караван идёт к колонии и пробудет около суток. Нажмите на торговца, чтобы торговать.", e.x, e.y);
  },
  meteor(w) {
    const c = w.colonyCenter();
    for (let t = 0; t < 30; t++) {
      const x = c.x + w.rng.int(-16, 16), y = c.y + w.rng.int(-16, 16);
      if (!w.inB(x, y) || x < 2 || y < 2 || x > w.W - 3 || y > w.H - 3) continue;
      const cells = [];
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const i = w.idx(x + dx, y + dy);
          if (w.bgrid[i] || w.fgrid[i] || w.zone[i] || w.rock[i] || !w.standable(i)) { ok = false; break; }
          if (w.pawns.some((p) => p.x === x + dx && p.y === y + dy)) { ok = false; break; }
          if (Math.abs(dx) + Math.abs(dy) < 2 || w.rng.chance(0.5)) cells.push(i);
        }
      if (!ok) continue;
      const ore = w.rng.weighted([[2, 70], [3, 20], [4, 10]]);
      for (const i of cells) {
        const it = w.iAt(i);
        if (it) {
          w.removeItem(it);
          w.spawnItem(it.def, it.count, x, y + 3);
        }
        w.rock[i] = ore;
        w.plant[i] = 0;
        w.recalcCost(i);
        w.dirtyCells.add(i);
      }
      w.pathDirty = true;
      w.roomsDirty = true;
      w.addFx({ k: "pod", x, y, t: 80 });
      const names = { 2: "сталь", 3: "серебро", 4: "компоненты" };
      w.letter("neutral", "Метеорит", `Упал метеорит. Внутри — ${names[ore]}. Отметьте его для добычи (Приказы → Добыть).`, x, y);
      return;
    }
  },
  blight(w) {
    const zones = [...w.zones.values()].filter((z) => z.type === "grow" && z.cells && z.cells.some((i) => w.plant[i]));
    if (!zones.length) return;
    const z = w.rng.pick(zones);
    let n = 0;
    for (const i of z.cells) {
      if (w.plant[i] && PLANTS[w.plant[i]].crop && w.rng.chance(0.6)) {
        w.plant[i] = 0;
        w.growth[i] = 0;
        n++;
      }
    }
    if (n) w.letter("bad", "Болезнь растений", `На поле «${z.name}» погибло ${n} растений.`);
  },
  coldsnap(w) {
    w.tempMods.push({ delta: -18, until: w.tick + TPD * 2 });
    w.letter("bad", "Похолодание", "Два дня будет очень холодно. Нужны тёплые комнаты: стены, двери и костёр или печь.");
  },
  heatwave(w) {
    w.tempMods.push({ delta: 15, until: w.tick + TPD * 2 });
    w.letter("bad", "Жара", "Два дня будет очень жарко.");
  },
  madanimal(w) {
    const wild = w.pawns.filter((p) => p.kind === "animal" && p.faction === "wild" && !p.dead);
    if (!wild.length) return;
    const a = w.rng.pick(wild);
    a.faction = "hostile";
    a.manhunterUntil = w.tick + TPD * 0.6;
    w.letter("threat", "Бешеное животное", `${a.name} обезумел и нападает на людей!`, a.x, a.y);
    w.emit("raid");
  },
  herd(w) {
    const type = w.rng.weighted([["deer", 40], ["hare", 30], ["boar", 20], ["wolf", 6], ["bear", 4]]);
    const n = type === "bear" ? 1 : w.rng.int(3, 6);
    const e = w.edgeCell();
    if (!e) return;
    const rs = w.regionsAround(e.x, e.y);
    for (let k = 0; k < n; k++) {
      const a = makeAnimal(w, w.rng, type);
      const c = spawnNear(w, e.x, e.y, rs);
      placePawn(w, a, c.x, c.y);
    }
    w.letter("neutral", "Животные", `На карту пришли животные: ${ANIMALS[type].name.toLowerCase()} × ${n}. Можно охотиться (Приказы → Охота).`, e.x, e.y);
  },
};

// ---------- торговля ----------
function traderStock(w) {
  const pool = [
    ["wood", 80, 250], ["steel", 50, 180], ["stone", 60, 150], ["components", 3, 10], ["medicine", 5, 14],
    ["ration", 6, 16], ["rice", 40, 90], ["meat", 30, 70], ["w_rifle", 1, 2], ["w_pistol", 1, 2], ["w_smg", 1, 1], ["w_spear", 1, 1], ["silver", 0, 0],
  ];
  const stock = {};
  const picks = w.rng.shuffle(pool.slice()).slice(0, w.rng.int(6, 9));
  for (const [def, a, b] of picks) if (b > 0) stock[def] = w.rng.int(a, b);
  return stock;
}
export function buyPrice(def) {
  return Math.max(1, Math.ceil(ITEMS[def].value * 1.5 * 10) / 10);
}
export function sellPrice(def) {
  return Math.max(0.1, Math.floor(ITEMS[def].value * 0.6 * 10) / 10);
}
export function traderPresent(w) {
  const t = w.story.trader;
  if (!t || t.leaving) return false;
  return t.pawns.some((id) => {
    const p = w.get(id);
    return p && !p.dead && !p.despawned && p.arrived;
  });
}
// deal: { buy: {def: n}, sell: {def: n} } — возвращает текст ошибки или null
export function executeTrade(w, deal) {
  const t = w.story.trader;
  if (!traderPresent(w)) return "Торговец ушёл";
  let cost = 0, gain = 0;
  for (const [d, n] of Object.entries(deal.buy)) {
    if (n <= 0) continue;
    if ((t.stock[d] || 0) < n) return "У торговца столько нет";
    cost += buyPrice(d) * n;
  }
  for (const [d, n] of Object.entries(deal.sell)) {
    if (n <= 0) continue;
    if (d === "silver") return "Серебро не продаётся";
    if (w.countDef(d) < n) return "У колонии столько нет";
    gain += sellPrice(d) * n;
  }
  const balance = Math.round(gain - cost);
  if (balance < 0 && w.countDef("silver") < -balance) return "Не хватает серебра";
  if (balance > 0 && t.silver < balance) return "У торговца не хватает серебра";
  const trader = w.get(t.pawns[0]) || w.get(t.pawns[1]);
  const at = trader ? { x: trader.x, y: trader.y } : w.colonyCenter();
  for (const [d, n] of Object.entries(deal.sell)) if (n > 0) removeFromColony(w, d, n);
  if (balance < 0) removeFromColony(w, "silver", -balance);
  for (const [d, n] of Object.entries(deal.buy)) {
    if (n <= 0) continue;
    t.stock[d] -= n;
    if (!t.stock[d]) delete t.stock[d];
    w.spawnItem(d, n, at.x, at.y);
  }
  for (const [d, n] of Object.entries(deal.sell)) if (n > 0 && d !== "silver") t.stock[d] = (t.stock[d] || 0) + n;
  if (balance > 0) {
    w.spawnItem("silver", balance, at.x, at.y);
    t.silver -= balance;
  } else t.silver += -balance;
  return null;
}
function removeFromColony(w, def, n) {
  const stacks = [...w.items.values()].filter((it) => it.def === def).sort((a, b) => a.count - b.count);
  for (const it of stacks) {
    if (n <= 0) break;
    n -= w.takeItem(it, n);
  }
}
function updateTrader(w) {
  const t = w.story.trader;
  if (!t.leaving && w.tick > t.until) {
    t.leaving = true;
    w.letter("neutral", "Караван уходит", "Торговцы покидают колонию.");
  }
  const alive = t.pawns.map((id) => w.get(id)).filter((p) => p && !p.dead && !p.despawned);
  if (!alive.length) w.story.trader = null;
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export { plural, CROPS, PLANT, displayName };
