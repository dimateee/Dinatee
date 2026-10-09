// Генерация карты: горы с рудами, озёра, река, леса, животные
import { TR, PLANT, TPD } from "./defs.js";
import { Rng, makeNoise, fbm } from "./rng.js";
import { World } from "./world.js";
import { makeAnimal, placePawn } from "./pawn.js";

export function generateMap(w) {
  const rng = new Rng(w.seed);
  const W = w.W, H = w.H, N = w.N;
  const nE = makeNoise(rng.int(1, 1e9));
  const nM = makeNoise(rng.int(1, 1e9));
  const nO = makeNoise(rng.int(1, 1e9));
  const nS = makeNoise(rng.int(1, 1e9));
  const nT = makeNoise(rng.int(1, 1e9));
  const nW = makeNoise(rng.int(1, 1e9));
  const ang = rng.next() * Math.PI * 2;
  const bx = Math.cos(ang), by = Math.sin(ang);

  const elev = new Float32Array(N);
  const moist = new Float32Array(N);
  const wet = new Float32Array(N);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const nx = x / W, ny = y / H;
      let e = fbm(nE, nx * 3.4, ny * 3.4, 5);
      const side = (nx - 0.5) * bx + (ny - 0.5) * by;
      e = e * 0.75 + side * 0.55;
      const dc = Math.hypot(nx - 0.5, ny - 0.5);
      e -= Math.max(0, 0.2 - dc) * 1.5;
      elev[i] = e;
      moist[i] = fbm(nM, nx * 3 + 7, ny * 3 + 7, 4);
      wet[i] = fbm(nW, nx * 2.6 + 3, ny * 2.6 + 3, 4) - Math.max(0, 0.25 - dc) * 1.2;
    }
  const q = (arr, f) => Float32Array.from(arr).sort()[Math.floor(N * f)];
  const mountainT = q(elev, 0.79);
  const gravelT = q(elev, 0.72);
  const lakeT = q(wet, 0.965);
  const deepT = q(wet, 0.988);
  const mT = [q(moist, 0.12), q(moist, 0.3), q(moist, 0.82)];

  for (let i = 0; i < N; i++) {
    const e = elev[i];
    if (e > mountainT) {
      w.rock[i] = 1;
      w.terrain[i] = TR.ROCKFLOOR;
    } else if (wet[i] > lakeT) {
      w.terrain[i] = wet[i] > deepT ? TR.DEEP : TR.SHALLOW;
    } else if (e > gravelT) {
      w.terrain[i] = moist[i] > mT[1] ? TR.SOIL : TR.GRAVEL;
    } else {
      const m = moist[i];
      w.terrain[i] = m < mT[0] ? TR.SAND : m < mT[1] ? TR.SOIL : m > mT[2] ? TR.RICH : TR.GRASS;
    }
  }

  // река
  if (rng.chance(0.45)) {
    const vertical = rng.chance(0.5);
    const len = vertical ? H : W;
    let pos = rng.int(Math.floor(len * 0.15), Math.floor(len * 0.3));
    if (rng.chance(0.5)) pos = len - pos;
    const wid = rng.int(2, 3);
    for (let t = 0; t < len; t++) {
      const off = Math.round((nS(t * 0.06, 5.5) - 0.5) * 16);
      const c = pos + off;
      for (let k = -wid; k <= wid; k++) {
        const x = vertical ? c + k : t, y = vertical ? t : c + k;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x;
        w.rock[i] = 0;
        const core = Math.abs(k) <= wid - 2 && nS(t * 0.2, 9.1) > 0.55;
        w.terrain[i] = core ? TR.DEEP : TR.SHALLOW;
      }
    }
  }

  // берега
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const t = w.terrain[i];
      if (w.rock[i] || t === TR.SHALLOW || t === TR.DEEP) continue;
      let nearWater = false;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const tt = w.terrain[ny * W + nx];
          if (tt === TR.SHALLOW || tt === TR.DEEP) nearWater = true;
        }
      if (nearWater) w.terrain[i] = rng.chance(0.6) ? TR.SAND : TR.MUD;
    }

  // руды
  const rockCells = [];
  for (let i = 0; i < N; i++) if (w.rock[i]) rockCells.push(i);
  for (const i of rockCells) {
    const x = i % W, y = (i / W) | 0;
    const o = fbm(nO, x * 0.16, y * 0.16, 2);
    if (o > 0.71) w.rock[i] = 2;
    else if (o < 0.2 && rng.chance(0.6)) w.rock[i] = 3;
  }
  let steel = 0;
  for (const i of rockCells) if (w.rock[i] === 2) steel++;
  const veins = [[2, Math.max(0, 4 - Math.floor(steel / 12)), 4], [4, 3, 2], [3, 1, 3]];
  for (const [type, count, size] of veins) {
    for (let v = 0; v < count && rockCells.length; v++) {
      let c = rng.pick(rockCells);
      for (let s = 0; s < size + rng.int(0, 3); s++) {
        if (w.rock[c]) w.rock[c] = type;
        const x = (c % W) + rng.int(-1, 1), y = ((c / W) | 0) + rng.int(-1, 1);
        if (x >= 0 && y >= 0 && x < W && y < H) c = y * W + x;
      }
    }
  }

  // точка высадки
  let home = { x: W >> 1, y: H >> 1 };
  outer: for (let r = 0; r < 30; r++) {
    for (let t = 0; t < 40; t++) {
      const x = (W >> 1) + rng.int(-r, r), y = (H >> 1) + rng.int(-r, r);
      if (clearArea(w, x, y, 5)) {
        home = { x, y };
        break outer;
      }
    }
  }
  w.home = home;

  // растения
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (w.rock[i]) continue;
      const t = w.terrain[i];
      const r = rng.next();
      const forest = fbm(nT, x * 0.07, y * 0.07, 3) > 0.57;
      const nearHome = Math.abs(x - home.x) <= 4 && Math.abs(y - home.y) <= 4;
      let pl = 0, g = 1;
      if (t === TR.GRASS || t === TR.SOIL || t === TR.RICH) {
        if (!nearHome && forest && r < 0.36) pl = rng.chance(0.35) ? PLANT.pine : PLANT.tree;
        else if (!nearHome && r < 0.04) pl = rng.chance(0.4) ? PLANT.pine : PLANT.tree;
        else if (r < 0.062) pl = PLANT.bush;
        else if (r < (t === TR.GRASS ? 0.55 : 0.2)) pl = PLANT.grass;
        if (pl === PLANT.tree || pl === PLANT.pine) g = rng.range(0.35, 1);
        if (pl === PLANT.bush) g = rng.range(0.4, 1);
      } else if (t === TR.GRAVEL) {
        if (!nearHome && r < 0.03) {
          pl = PLANT.pine;
          g = rng.range(0.4, 1);
        } else if (r < 0.15) pl = PLANT.grass;
      } else if (t === TR.MUD && r < 0.15) pl = PLANT.grass;
      else if (t === TR.SAND && r < 0.02) pl = PLANT.grass;
      if (pl) {
        w.plant[i] = pl;
        w.growth[i] = g;
      }
    }
  w.recalcAllCosts();
  w.ensureRegions();

  // животные
  const kinds = ["hare", "hare", "hare", "deer", "deer", "deer", "boar", rng.chance(0.5) ? "boar" : "deer", "hare"];
  for (const k of kinds) {
    for (let t = 0; t < 40; t++) {
      const x = rng.int(0, W - 1), y = rng.int(0, H - 1);
      if (Math.hypot(x - home.x, y - home.y) < 14) continue;
      const i = y * W + x;
      if (!w.standable(i)) continue;
      placePawn(w, makeAnimal(w, rng, k), x, y);
      break;
    }
  }
  return w;
}

function clearArea(w, cx, cy, r) {
  if (cx - r < 2 || cy - r < 2 || cx + r >= w.W - 2 || cy + r >= w.H - 2) return false;
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const i = y * w.W + x;
      const t = w.terrain[i];
      if (w.rock[i] || t === TR.SHALLOW || t === TR.DEEP || t === TR.MUD) return false;
    }
  return true;
}

export function createWorld(opts) {
  const w = new World(opts);
  generateMap(w);
  return w;
}

// Высадка: колонисты и стартовые запасы
export function startColony(w, colonists) {
  const { x, y } = w.home;
  colonists.forEach((p, k) => {
    const c = w.nearestStandable(x - 1 + k, y) || { x, y };
    p.id = p.id || w.nextId++;
    placePawn(w, p, c.x, c.y);
  });
  const piles = [
    ["wood", 220, -3, 3], ["steel", 120, -1, 3], ["ration", 24, 1, 3], ["medicine", 12, 3, 3],
    ["silver", 300, -3, 5], ["components", 6, -1, 5],
  ];
  for (const [def, n, dx, dy] of piles) w.spawnItem(def, n, x + dx, y + dy);
  w.story.nextMinor = w.tick + TPD * 1.2;
  w.story.nextThreat = w.diff.grace * TPD + w.rng.range(0, TPD);
  w.letter(
    "good",
    "Высадка",
    "Колонисты на месте. Для начала: создайте склад (Зоны → Склад), постройте кровати и костёр, отметьте поле для риса. К зиме нужны тёплые комнаты и запас еды.",
    x,
    y,
  );
  return w;
}
