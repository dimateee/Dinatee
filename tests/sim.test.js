// Автотесты симуляции: запуск — npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, startColony } from "../src/game/mapgen.js";
import { makeColonist, makeRaider, placePawn, setDrafted } from "../src/game/pawn.js";
import { TPD, DESIG, PLANTS, BUILDINGS } from "../src/game/defs.js";
import { serialize, deserialize } from "../src/game/save.js";
import { raid, executeTrade, EVENTS, traderPresent } from "../src/game/story.js";
import { startPath } from "../src/game/pawnutil.js";
import { down } from "../src/game/combat.js";

function newColony(seed, difficulty = "classic") {
  const w = createWorld({ seed, difficulty });
  startColony(w, [0, 1, 2].map(() => makeColonist(w, w.rng)));
  return w;
}

function buildBase(w) {
  const { x: hx, y: hy } = w.home;
  const stock = [];
  for (let y = hy + 2; y < hy + 6; y++) for (let x = hx - 4; x < hx + 3; x++) stock.push(w.idx(x, y));
  w.paintZone(stock, "stock");
  for (let x = hx - 5; x <= hx + 3; x++) {
    w.placeBlueprint("wall_wood", x, hy - 7);
    w.placeBlueprint("wall_wood", x, hy - 1);
  }
  for (let y = hy - 6; y <= hy - 2; y++) {
    w.placeBlueprint("wall_wood", hx - 5, y);
    w.placeBlueprint("wall_wood", hx + 3, y);
  }
  w.removeBuilding(w.bAt(w.idx(hx - 1, hy - 1)));
  w.placeBlueprint("door", hx - 1, hy - 1);
  for (let k = 0; k < 3; k++) w.placeBlueprint("bed", hx - 4 + k * 2, hy - 6);
  w.placeBlueprint("campfire", hx - 1, hy - 3);
  w.placeBlueprint("table", hx + 1, hy - 3);
  const grow = [];
  for (let y = hy + 7; y < hy + 12; y++) for (let x = hx - 5; x < hx + 5; x++) grow.push(w.idx(x, y));
  w.paintZone(grow, "grow");
  let n = 0;
  for (let i = 0; i < w.N && n < 12; i++) {
    const x = i % w.W, y = (i / w.W) | 0;
    if (w.plant[i] && PLANTS[w.plant[i]].tree && Math.hypot(x - hx, y - hy) < 20) {
      w.setDesig(i, DESIG.CUT, true);
      n++;
    }
  }
}

test("карта детерминирована и пригодна для высадки", () => {
  const a = createWorld({ seed: 42 });
  const b = createWorld({ seed: 42 });
  assert.deepEqual(a.terrain, b.terrain);
  assert.deepEqual(a.rock, b.rock);
  let rock = 0, steel = 0;
  for (let i = 0; i < a.N; i++) {
    if (a.rock[i]) rock++;
    if (a.rock[i] === 2) steel++;
  }
  assert.ok(rock > a.N * 0.08 && rock < a.N * 0.4, `доля гор ${rock / a.N}`);
  assert.ok(steel > 5, "на карте есть сталь");
  const { x, y } = a.home;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) assert.ok(a.standable(a.idx(x + dx, y + dy)), "вокруг высадки можно стоять");
});

test("поиск пути обходит препятствия", () => {
  const w = createWorld({ seed: 7 });
  const { x, y } = w.home;
  for (let k = -3; k <= 3; k++) w.instantBuild("wall_wood", x + 2, y + k);
  w.ensureRegions();
  const path = w.pf.find(x, y, x + 4, y, "on", 0);
  assert.ok(path && path.length >= 4, "путь найден");
  for (const i of path) assert.ok(w.cost[i] > 0, "путь не проходит сквозь стену");
});

test("колония строится, готовит и складирует за 6 дней", () => {
  const w = newColony(12345);
  buildBase(w);
  w.story.nextThreat = 1e9;
  for (let t = 0; t < TPD * 6; t++) w.step();
  const done = [...w.buildings.values()].filter((b) => b.complete);
  assert.ok(done.filter((b) => b.def === "bed").length === 3, "кровати построены");
  assert.ok(done.some((b) => b.def === "campfire"), "костёр построен");
  assert.ok(w.rooms.length >= 1, "появилась закрытая комната");
  const stored = [...w.items.values()].filter((it) => w.isStored(it)).length;
  assert.ok(stored > 3, "вещи перенесены на склад");
  assert.ok(w.countDef("meal") > 0, "приготовлена еда");
  assert.equal(w.colonists().length, 3);
  for (const c of w.colonists()) assert.ok(c.food > 0.05, "колонисты не голодают");
});

test("сохранение и загрузка сохраняют состояние", () => {
  const w = newColony(99);
  buildBase(w);
  for (let t = 0; t < TPD * 2; t++) w.step();
  const json = JSON.stringify(serialize(w));
  const w2 = deserialize(JSON.parse(json));
  assert.equal(w2.tick, w.tick);
  assert.equal(w2.colonists().length, w.colonists().length);
  assert.equal(w2.buildings.size, w.buildings.size);
  assert.deepEqual(w2.terrain, w.terrain);
  for (let t = 0; t < 600; t++) w2.step();
  assert.equal(w2.tick, w.tick + 600);
});

test("собранный отряд отбивает небольшой налёт", () => {
  let wins = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const w = newColony(seed);
    for (let t = 0; t < 300; t++) w.step();
    raid(w, 100);
    w.story.nextThreat = w.story.nextMinor = 1e9;
    w.colonists().forEach((c, k) => {
      setDrafted(w, c, true);
      startPath(w, c, w.home.x + k, w.home.y, "on", 0);
    });
    for (let t = 0; t < TPD; t++) w.step();
    if (w.colonists().length >= 2 && !w.story.raids.length) wins++;
  }
  assert.ok(wins >= 6, `побед ${wins} из 8`);
});

test("торговля и плен", () => {
  const w = newColony(5);
  buildBase(w);
  w.story.nextThreat = w.story.nextMinor = 1e9;
  EVENTS.trader(w);
  for (let t = 0; t < TPD * 0.5 && !traderPresent(w); t++) w.step();
  assert.ok(traderPresent(w), "караван дошёл");
  const silver = w.countDef("silver");
  const stockDef = Object.keys(w.story.trader.stock)[0];
  const err = executeTrade(w, { buy: { [stockDef]: 1 }, sell: {} });
  assert.equal(err, null);
  assert.ok(w.countDef("silver") < silver, "серебро потрачено");

  const pb = w.instantBuild("bed", w.home.x + 4, w.home.y - 4);
  pb.forPrisoner = true;
  for (let t = 0; t < TPD * 2; t++) w.step();
  const r = makeRaider(w, w.rng, "club");
  placePawn(w, r, w.home.x + 2, w.home.y + 1);
  r.hp = r.maxHp * 0.2;
  down(w, r);
  r.bleed = 0;
  r.captureDesig = true;
  for (let t = 0; t < TPD && r.kind !== "prisoner"; t++) w.step();
  assert.equal(r.kind, "prisoner", "раненого врага взяли в плен");
  r.resistance = 0;
  for (let t = 0; t < TPD * 3 && r.kind !== "colonist"; t++) {
    if (t % 300 === 0) r.lastChat = -TPD;
    w.step();
  }
  assert.equal(r.kind, "colonist", "пленник завербован");
});

test("год жизни колонии без ошибок", () => {
  const w = newColony(3, "calm");
  buildBase(w);
  for (let t = 0; t < TPD * 40 && !w.gameOver; t++) {
    w.step();
    if (t % 500 === 0) for (const p of w.pawns) if (p.kind === "raider" && p.downed) p.captureDesig = true;
  }
  assert.ok(w.day >= 1);
  // все ссылки на сущности целы
  for (const p of w.pawns) assert.ok(w.ents.get(p.id) === p);
  for (const it of w.items.values()) assert.equal(w.igrid[w.idx(it.x, it.y)], it.id);
  for (const b of w.buildings.values()) {
    const i = w.idx(b.x, b.y);
    assert.equal(BUILDINGS[b.def].floor ? w.fgrid[i] : w.bgrid[i], b.id);
  }
});
