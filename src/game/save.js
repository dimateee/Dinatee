// Сохранение и загрузка мира в JSON
import { World } from "./world.js";

const SAVE_VERSION = 1;

function b64(u8) {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(s);
}
function unb64(str) {
  const s = atob(str);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
const bytes = (ta) => new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);

export function serialize(w) {
  const g16 = new Uint16Array(w.N);
  for (let i = 0; i < w.N; i++) g16[i] = Math.round(Math.min(1, w.growth[i]) * 65535);
  w.ensureRooms();
  const pawns = w.pawns
    .filter((p) => !p.despawned)
    .map((p) => {
      const o = { ...p };
      o.path = null;
      o.job = null;
      o.forced = null;
      return o;
    });
  return {
    v: SAVE_VERSION,
    savedAt: Date.now(),
    seed: w.seed,
    rngS: w.rng.s,
    tick: w.tick,
    difficulty: w.difficulty,
    colonyName: w.colonyName,
    nextId: w.nextId,
    nextZone: w.nextZone,
    terrain: b64(w.terrain),
    floor: b64(w.floor),
    rock: b64(w.rock),
    plant: b64(w.plant),
    growth: b64(bytes(g16)),
    zone: b64(bytes(w.zone)),
    desig: b64(w.desig),
    items: [...w.items.values()],
    buildings: [...w.buildings.values()],
    pawns,
    zones: [...w.zones.values()].map((z) => ({ id: z.id, type: z.type, name: z.name, crop: z.crop, filter: z.filter })),
    research: w.research,
    letters: w.letters.slice(-30),
    story: w.story,
    weather: w.weather,
    snow: w.snow,
    tempMods: w.tempMods,
    stats: w.stats,
    home: w.home,
    roomTemps: w.rooms.map((r) => [Math.round(r.cx), Math.round(r.cy), Math.round(r.temp * 10) / 10]),
    gameOver: w.gameOver,
  };
}

export function deserialize(o) {
  if (!o || !o.v) throw new Error("Повреждённое сохранение");
  const w = new World({ seed: o.seed, difficulty: o.difficulty, colonyName: o.colonyName });
  w.rng.s = o.rngS >>> 0;
  w.tick = o.tick;
  w.nextId = o.nextId;
  w.nextZone = o.nextZone;
  w.terrain.set(unb64(o.terrain));
  w.floor.set(unb64(o.floor));
  w.rock.set(unb64(o.rock));
  w.plant.set(unb64(o.plant));
  const g = unb64(o.growth);
  const g16 = new Uint16Array(g.buffer, g.byteOffset, g.byteLength / 2);
  for (let i = 0; i < w.N; i++) w.growth[i] = g16[i] / 65535;
  const z = unb64(o.zone);
  w.zone.set(new Uint16Array(z.buffer, z.byteOffset, z.byteLength / 2));
  w.desig.set(unb64(o.desig));
  for (let i = 0; i < w.N; i++) if (w.desig[i]) w.desigSet.add(i);
  for (const zz of o.zones) w.zones.set(zz.id, { ...zz });
  w.zonesDirty = true;
  for (const b of o.buildings) {
    w.buildings.set(b.id, b);
    w.ents.set(b.id, b);
    const i = w.idx(b.x, b.y);
    if (b.def.startsWith("floor_")) w.fgrid[i] = b.id;
    else w.bgrid[i] = b.id;
  }
  for (const it of o.items) {
    w.items.set(it.id, it);
    w.ents.set(it.id, it);
    w.igrid[w.idx(it.x, it.y)] = it.id;
  }
  w.research = o.research;
  w.letters = o.letters || [];
  w.story = o.story;
  w.weather = o.weather;
  w.snow = o.snow || 0;
  w.tempMods = o.tempMods || [];
  w.stats = o.stats;
  w.home = o.home;
  w.gameOver = !!o.gameOver;
  w.recalcAllCosts();
  w.outT = w.computeOutdoorTemp();
  for (const p of o.pawns) {
    w.pawns.push(p);
    w.ents.set(p.id, p);
  }
  // Незавершённые действия не сохраняются: всё, что несли, кладём на землю
  for (const p of w.pawns) {
    p.path = null;
    p.job = null;
    p.working = null;
    p.carriedBy = null;
    p.carrying = null;
    p.waitFor = null;
    p.wake = false;
    if (p.carry) {
      w.spawnItem(p.carry.def, p.carry.count, p.x, p.y);
      p.carry = null;
    }
    if (p.kind !== "prisoner") {
      p.sleeping = false;
      if (!p.downed) p.inBed = null;
    }
  }
  w.ensureRooms();
  for (const [cx, cy, t] of o.roomTemps || []) {
    const r = w.roomAt(w.idx(cx, cy));
    if (r) r.temp = t;
  }
  w.ensureZones();
  return w;
}
