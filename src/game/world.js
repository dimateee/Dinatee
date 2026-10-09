import {
  MAP_SIZE, TPH, TPD, START_HOUR, DAYS_PER_SEASON, DAYS_PER_YEAR, SEASONS,
  TERRAIN, FLOORS, ROCKS, PLANTS, PLANT, ITEMS, BUILDINGS, RESEARCH, DIFFICULTY, SPIRAL, DESIG,
} from "./defs.js";
import { Rng } from "./rng.js";
import { PathFinder } from "./path.js";
import { pawnTick } from "./pawn.js";
import { storyTick } from "./story.js";
import { turretTick } from "./combat.js";

export { SPIRAL, DESIG };

export class World {
  constructor(opts = {}) {
    const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
    this.version = 1;
    this.W = MAP_SIZE;
    this.H = MAP_SIZE;
    const N = (this.N = this.W * this.H);
    this.seed = seed;
    this.rng = new Rng(seed ^ 0x9e3779b9);
    this.tick = 0;
    this.difficulty = opts.difficulty || "classic";
    this.colonyName = opts.colonyName || "Колония";

    this.terrain = new Uint8Array(N);
    this.floor = new Uint8Array(N);
    this.rock = new Uint8Array(N);
    this.plant = new Uint8Array(N);
    this.growth = new Float32Array(N);
    this.zone = new Uint16Array(N);
    this.desig = new Uint8Array(N);
    this.bgrid = new Int32Array(N);
    this.fgrid = new Int32Array(N);
    this.igrid = new Int32Array(N);
    this.cost = new Float32Array(N);
    this.doorMask = new Uint8Array(N);
    this.region = new Int32Array(N);
    this.room = new Int32Array(N).fill(-1);
    this.rooms = [];

    this.ents = new Map();
    this.pawns = [];
    this.items = new Map();
    this.buildings = new Map();
    this.zones = new Map();
    this.nextId = 1;
    this.nextZone = 1;
    this.res = new Map();
    this.desigSet = new Set();
    this.research = { current: null, progress: {}, done: {} };
    this.letters = [];
    this.listeners = [];
    this.fx = [];

    this.pathDirty = true;
    this.roomsDirty = true;
    this.zonesDirty = true;
    this.dirtyCells = new Set();
    this.allDirty = true;

    this.story = { nextThreat: 0, nextMinor: 0, raids: [], trader: null, nextRaidId: 1, lastFrost: -1 };
    this.weather = { kind: "clear", until: 0 };
    this.snow = 0;
    this.tempMods = [];
    this.stats = { raids: 0, kills: 0, deaths: 0, built: 0, joined: 0 };
    this.home = { x: this.W >> 1, y: this.H >> 1 };
    this.gameOver = false;
    this.outT = 10;
    this.stockCells = [];
    this.pf = new PathFinder(this);
    this._counts = null;
    this._stack = new Int32Array(N);
  }

  // ---------- время ----------
  get day() {
    return Math.floor((this.tick + START_HOUR * TPH) / TPD);
  }
  get hourF() {
    return ((this.tick + START_HOUR * TPH) % TPD) / TPH;
  }
  get hour() {
    return Math.floor(this.hourF);
  }
  get seasonIdx() {
    return Math.floor(((this.day + 5) % DAYS_PER_YEAR) / DAYS_PER_SEASON);
  }
  get seasonName() {
    return SEASONS[this.seasonIdx];
  }
  get year() {
    return Math.floor(this.day / DAYS_PER_YEAR) + 1;
  }
  get diff() {
    return DIFFICULTY[this.difficulty] || DIFFICULTY.classic;
  }
  seasonalTemp(dayF) {
    return 7 + 17 * Math.sin((2 * Math.PI * dayF) / DAYS_PER_YEAR);
  }
  computeOutdoorTemp() {
    const dayF = (this.tick + START_HOUR * TPH) / TPD;
    let t = this.seasonalTemp(dayF) - 5 * Math.cos((2 * Math.PI * (this.hourF - 4)) / 24);
    for (const m of this.tempMods) if (this.tick < m.until) t += m.delta;
    return t;
  }
  daylight() {
    const h = this.hourF;
    if (h >= 6 && h < 18) return 1;
    if (h >= 18 && h < 21) return 1 - (h - 18) / 3;
    if (h >= 5 && h < 6) return h - 5;
    return 0;
  }
  isNight() {
    const h = this.hourF;
    return h >= 22 || h < 6;
  }

  // ---------- клетки ----------
  idx(x, y) {
    return y * this.W + x;
  }
  inB(x, y) {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }
  bAt(i) {
    const id = this.bgrid[i];
    return id ? this.buildings.get(id) : null;
  }
  fAt(i) {
    const id = this.fgrid[i];
    return id ? this.buildings.get(id) : null;
  }
  iAt(i) {
    const id = this.igrid[i];
    return id ? this.items.get(id) : null;
  }
  get(id) {
    return this.ents.get(id);
  }

  recalcCost(i) {
    let c;
    if (this.rock[i]) c = 0;
    else {
      const t = TERRAIN[this.terrain[i]];
      c = t.cost === 0 ? 0 : this.floor[i] ? FLOORS[this.floor[i]].cost : t.cost;
    }
    let door = 0;
    if (c > 0) {
      const b = this.bAt(i);
      if (b && b.complete) {
        const d = BUILDINGS[b.def];
        if (d.solid) c = 0;
        else if (d.door) {
          door = 1;
          c = 1;
        } else if (d.passCost) c *= d.passCost;
      }
      const p = this.plant[i];
      if (c > 0 && p && PLANTS[p].tree) c *= 1.4;
    }
    this.cost[i] = c;
    this.doorMask[i] = door;
  }
  recalcAllCosts() {
    for (let i = 0; i < this.N; i++) this.recalcCost(i);
    this.pathDirty = true;
    this.roomsDirty = true;
  }
  passable(i) {
    return this.cost[i] > 0;
  }
  standable(i) {
    return this.cost[i] > 0 && !TERRAIN[this.terrain[i]].water;
  }

  // ---------- предметы ----------
  canHoldItem(i) {
    if (this.cost[i] <= 0 || this.doorMask[i]) return false;
    if (TERRAIN[this.terrain[i]].water) return false;
    const b = this.bAt(i);
    if (b && (b.complete || BUILDINGS[b.def].solid)) return false;
    return true;
  }
  spawnItem(def, count, x, y, maxR = 12) {
    if (!ITEMS[def] || count <= 0) return 0;
    const stack = ITEMS[def].stack;
    let rem = Math.floor(count);
    const r2 = maxR * maxR;
    for (const [dx, dy, d] of SPIRAL) {
      if (d > r2) break;
      const nx = x + dx, ny = y + dy;
      if (!this.inB(nx, ny)) continue;
      const i = ny * this.W + nx;
      if (!this.canHoldItem(i)) continue;
      const it = this.iAt(i);
      if (it) {
        if (it.def === def && it.count < stack) {
          const add = Math.min(stack - it.count, rem);
          it.count += add;
          rem -= add;
        }
      } else {
        const add = Math.min(stack, rem);
        const item = { id: this.nextId++, kind: "item", def, count: add, x: nx, y: ny };
        this.items.set(item.id, item);
        this.ents.set(item.id, item);
        this.igrid[i] = item.id;
        rem -= add;
      }
      if (rem <= 0) break;
    }
    this._counts = null;
    return rem;
  }
  removeItem(it) {
    this.items.delete(it.id);
    this.ents.delete(it.id);
    const i = this.idx(it.x, it.y);
    if (this.igrid[i] === it.id) this.igrid[i] = 0;
    this._counts = null;
  }
  takeItem(it, n) {
    const t = Math.min(n, it.count);
    it.count -= t;
    if (it.count <= 0) this.removeItem(it);
    this._counts = null;
    return t;
  }
  counts() {
    if (this._counts) return this._counts;
    const c = {};
    for (const it of this.items.values()) c[it.def] = (c[it.def] || 0) + it.count;
    this._counts = c;
    return c;
  }
  countDef(def) {
    return this.counts()[def] || 0;
  }
  countCat(cat) {
    const c = this.counts();
    let n = 0;
    for (const k in c) if (ITEMS[k].cat === cat) n += c[k];
    return n;
  }
  totalNutrition() {
    let n = 0;
    for (const it of this.items.values()) {
      const d = ITEMS[it.def];
      if (d.nut) n += d.nut * it.count;
    }
    return n;
  }
  wealth() {
    let v = 0;
    for (const it of this.items.values()) v += ITEMS[it.def].value * it.count;
    for (const b of this.buildings.values()) {
      if (!b.complete) continue;
      const d = BUILDINGS[b.def];
      for (const k in d.cost) v += ITEMS[k].value * d.cost[k];
    }
    return v;
  }

  // ---------- постройки ----------
  canPlace(defId, x, y) {
    const d = BUILDINGS[defId];
    if (!d || !this.inB(x, y)) return false;
    if (d.research && !this.research.done[d.research]) return false;
    const i = this.idx(x, y);
    if (this.rock[i]) return false;
    if (TERRAIN[this.terrain[i]].water) return false;
    if (d.floor) return !this.fgrid[i] && this.floor[i] !== d.floor;
    const old = this.bAt(i);
    if (old) return this.canReplace(old, defId);
    return true;
  }
  // Чертёж можно заменить другим, а готовую стену — дверью (как в RimWorld)
  canReplace(old, defId) {
    if (old.def === defId) return false;
    if (!old.complete) return true;
    return !!(BUILDINGS[defId].door && BUILDINGS[old.def].wall);
  }
  placeBlueprint(defId, x, y) {
    if (!this.canPlace(defId, x, y)) return null;
    const d = BUILDINGS[defId];
    const i = this.idx(x, y);
    const old = d.floor ? null : this.bAt(i);
    if (old) this.removeBuilding(old, 1);
    const b = { id: this.nextId++, kind: "building", def: defId, x, y, complete: false, work: 0, delivered: {}, hp: d.hp || 50 };
    for (const k in d.cost) b.delivered[k] = 0;
    this.buildings.set(b.id, b);
    this.ents.set(b.id, b);
    if (d.floor) this.fgrid[i] = b.id;
    else this.bgrid[i] = b.id;
    const p = this.plant[i];
    if (p && !PLANTS[p].small) this.setDesig(i, DESIG.CUT, true);
    this.recalcCost(i);
    this.dirtyCells.add(i);
    return b;
  }
  instantBuild(defId, x, y) {
    const d = BUILDINGS[defId];
    const i = this.idx(x, y);
    if (!d.floor && this.bgrid[i]) return null;
    if (this.plant[i]) {
      this.plant[i] = 0;
      this.growth[i] = 0;
    }
    const b = this.placeBlueprint(defId, x, y);
    if (b) this.completeBuilding(b);
    return b;
  }
  completeBuilding(b) {
    const d = BUILDINGS[b.def];
    const i = this.idx(b.x, b.y);
    this.stats.built++;
    if (d.floor) {
      if (this.fgrid[i] === b.id) this.fgrid[i] = 0;
      this.buildings.delete(b.id);
      this.ents.delete(b.id);
      this.floor[i] = d.floor;
      this.recalcCost(i);
      this.roomsDirty = true;
      this.dirtyCells.add(i);
      this.emit("built", b);
      return;
    }
    b.complete = true;
    b.work = 0;
    b.hp = d.hp;
    b.delivered = null;
    if (d.fuel) {
      b.fuel = d.fuel.max * 0.5;
      b.on = true;
    }
    if (d.bench === "cook") b.bills = d.recipes.map((r) => ({ recipe: r, on: r === "meal", target: r === "meal" ? 10 : 6 }));
    if (this.plant[i]) {
      this.plant[i] = 0;
      this.growth[i] = 0;
      this.setDesig(i, DESIG.CUT | DESIG.HARVEST, false);
    }
    this.recalcCost(i);
    if (d.solid || d.door) {
      const it = this.iAt(i);
      if (it && d.solid) {
        this.removeItem(it);
        this.spawnItem(it.def, it.count, b.x, b.y);
      }
      if (d.solid) {
        for (const p of this.pawns) {
          if (p.x === b.x && p.y === b.y && !p.dead) {
            const c = this.nearestStandable(b.x, b.y);
            if (c) {
              p.x = c.x;
              p.y = c.y;
              p.path = null;
            }
          }
        }
      }
      this.pathDirty = true;
    }
    this.roomsDirty = true;
    this.dirtyCells.add(i);
    this.emit("built", b);
  }
  removeBuilding(b, refundFrac = 0) {
    const d = BUILDINGS[b.def];
    const i = this.idx(b.x, b.y);
    this.buildings.delete(b.id);
    this.ents.delete(b.id);
    if (d.floor) {
      if (this.fgrid[i] === b.id) this.fgrid[i] = 0;
    } else if (this.bgrid[i] === b.id) this.bgrid[i] = 0;
    this.recalcCost(i);
    if (!b.complete) {
      for (const k in b.delivered) if (b.delivered[k] > 0) this.spawnItem(k, b.delivered[k], b.x, b.y);
    } else if (refundFrac > 0) {
      for (const k in d.cost) {
        const n = Math.floor(d.cost[k] * refundFrac);
        if (n > 0) this.spawnItem(k, n, b.x, b.y);
      }
    }
    for (const p of this.pawns) {
      if (p.bed === b.id) p.bed = null;
      if (p.inBed === b.id) p.inBed = null;
    }
    this.pathDirty = true;
    this.roomsDirty = true;
    this.dirtyCells.add(i);
    this.emit("removed", b);
  }
  // Пол под клеткой можно разобрать — вернуть естественную поверхность
  removeFloor(i) {
    if (!this.floor[i]) return;
    this.floor[i] = 0;
    this.recalcCost(i);
    this.roomsDirty = true;
    this.dirtyCells.add(i);
  }
  nearestStandable(x, y, needRegion = -1) {
    this.ensureRegions();
    for (const [dx, dy] of SPIRAL) {
      const nx = x + dx, ny = y + dy;
      if (!this.inB(nx, ny)) continue;
      const i = this.idx(nx, ny);
      if (!this.standable(i) || this.doorMask[i]) continue;
      if (needRegion >= 0 && this.region[i] !== needRegion) continue;
      return { x: nx, y: ny };
    }
    return null;
  }

  // ---------- зоны ----------
  canZone(i, type) {
    if (this.rock[i] || TERRAIN[this.terrain[i]].water) return false;
    if (this.bgrid[i]) return false;
    if (type === "grow") {
      if (this.floor[i]) return false;
      if (TERRAIN[this.terrain[i]].fert < 0.7) return false;
    }
    return true;
  }
  paintZone(cells, type) {
    let target = null;
    const W = this.W;
    outer: for (const i of cells) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.inB(nx, ny)) continue;
        const z = this.zones.get(this.zone[ny * W + nx]);
        if (z && z.type === type) {
          target = z;
          break outer;
        }
      }
    }
    let created = false;
    if (!target) {
      const num = [...this.zones.values()].filter((z) => z.type === type).length + 1;
      target = {
        id: this.nextZone++,
        type,
        name: (type === "stock" ? "Склад " : "Поле ") + num,
        crop: "rice",
        filter: { mat: true, raw: true, meal: true, med: true, weapon: true, misc: true },
      };
      this.zones.set(target.id, target);
      created = true;
    }
    let n = 0;
    for (const i of cells) {
      if (!this.canZone(i, type)) continue;
      if (this.zone[i] === target.id) continue;
      this.zone[i] = target.id;
      n++;
    }
    if (created && n === 0) {
      this.zones.delete(target.id);
      this.nextZone--;
      return null;
    }
    this.zonesDirty = true;
    return target;
  }
  clearZone(cells) {
    for (const i of cells) this.zone[i] = 0;
    this.zonesDirty = true;
  }
  ensureZones() {
    if (!this.zonesDirty) return;
    this.zonesDirty = false;
    for (const z of this.zones.values()) z.cells = [];
    const stock = [];
    for (let i = 0; i < this.N; i++) {
      const id = this.zone[i];
      if (!id) continue;
      const z = this.zones.get(id);
      if (!z) {
        this.zone[i] = 0;
        continue;
      }
      z.cells.push(i);
      if (z.type === "stock") stock.push(i);
    }
    for (const [id, z] of this.zones) if (!z.cells.length) this.zones.delete(id);
    this.stockCells = stock;
  }
  zoneAt(i) {
    const id = this.zone[i];
    return id ? this.zones.get(id) : null;
  }
  // Лежит ли предмет там, где ему место (на подходящем складе)
  isStored(it) {
    const z = this.zoneAt(this.idx(it.x, it.y));
    return !!(z && z.type === "stock" && z.filter[ITEMS[it.def].cat]);
  }

  // ---------- приказы ----------
  setDesig(i, flag, on) {
    if (on) this.desig[i] |= flag;
    else this.desig[i] &= ~flag;
    if (this.desig[i]) this.desigSet.add(i);
    else this.desigSet.delete(i);
  }

  // ---------- резервирование ----------
  reserve(key, pid) {
    const r = this.res.get(key);
    if (r !== undefined && r !== pid) return false;
    this.res.set(key, pid);
    return true;
  }
  isRes(key, pid) {
    const r = this.res.get(key);
    return r !== undefined && r !== pid;
  }
  unreserve(key, pid) {
    if (this.res.get(key) === pid) this.res.delete(key);
  }
  releaseAll(pid) {
    for (const [k, v] of this.res) if (v === pid) this.res.delete(k);
  }

  // ---------- связность ----------
  ensureRegions() {
    if (!this.pathDirty) return;
    this.pathDirty = false;
    const R = this.region, W = this.W, H = this.H, cost = this.cost, st = this._stack;
    R.fill(-1);
    let id = 0;
    for (let s = 0; s < this.N; s++) {
      if (R[s] !== -1 || cost[s] <= 0) continue;
      let sp = 0;
      st[sp++] = s;
      R[s] = id;
      while (sp) {
        const i = st[--sp];
        const x = i % W, y = (i / W) | 0;
        if (x > 0 && R[i - 1] === -1 && cost[i - 1] > 0) { R[i - 1] = id; st[sp++] = i - 1; }
        if (x < W - 1 && R[i + 1] === -1 && cost[i + 1] > 0) { R[i + 1] = id; st[sp++] = i + 1; }
        if (y > 0 && R[i - W] === -1 && cost[i - W] > 0) { R[i - W] = id; st[sp++] = i - W; }
        if (y < H - 1 && R[i + W] === -1 && cost[i + W] > 0) { R[i + W] = id; st[sp++] = i + W; }
      }
      id++;
    }
  }
  regionsAround(x, y) {
    this.ensureRegions();
    const r = this.region[this.idx(x, y)];
    if (r >= 0) return [r];
    const out = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!this.inB(x + dx, y + dy)) continue;
        const q = this.region[this.idx(x + dx, y + dy)];
        if (q >= 0 && !out.includes(q)) out.push(q);
      }
    return out;
  }
  canReach(fx, fy, tx, ty, goal = "on") {
    return this.reachFrom(this.regionsAround(fx, fy), tx, ty, goal);
  }
  // rs — заранее посчитанные регионы стартовой клетки (быстрее при переборе многих целей)
  reachFrom(rs, tx, ty, goal = "on") {
    if (!rs.length) return false;
    this.ensureRegions();
    const R = this.region;
    if (goal === "on") return rs.includes(R[this.idx(tx, ty)]);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (goal === "adj" && dx === 0 && dy === 0) continue;
        const nx = tx + dx, ny = ty + dy;
        if (!this.inB(nx, ny)) continue;
        if (rs.includes(R[this.idx(nx, ny)])) return true;
      }
    return false;
  }

  // ---------- комнаты и температура ----------
  isBoundary(i) {
    if (this.rock[i]) return true;
    const b = this.bAt(i);
    if (!b || !b.complete) return false;
    const d = BUILDINGS[b.def];
    return !!(d.wall || d.door);
  }
  ensureRooms() {
    if (!this.roomsDirty) return;
    this.roomsDirty = false;
    const oldRoom = this.room.slice();
    const oldRooms = this.rooms;
    const R = this.room, W = this.W, H = this.H, N = this.N;
    R.fill(-1);
    const seen = new Uint8Array(N);
    const rooms = [];
    const st = this._stack;
    for (let s = 0; s < N; s++) {
      if (seen[s] || this.isBoundary(s)) continue;
      const cells = [];
      let edge = false, sp = 0;
      st[sp++] = s;
      seen[s] = 1;
      while (sp) {
        const i = st[--sp];
        cells.push(i);
        const x = i % W, y = (i / W) | 0;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
        for (const j of nb) {
          if (j < 0 || seen[j] || this.isBoundary(j)) continue;
          seen[j] = 1;
          st[sp++] = j;
        }
      }
      if (edge || cells.length > 900) continue;
      const id = rooms.length;
      const room = { id, size: cells.length, temp: null, floor: 0, beds: 0, cx: 0, cy: 0 };
      const tally = new Map();
      for (const c of cells) {
        R[c] = id;
        if (this.floor[c]) room.floor++;
        room.cx += c % W;
        room.cy += (c / W) | 0;
        const o = oldRoom[c];
        if (o >= 0) tally.set(o, (tally.get(o) || 0) + 1);
      }
      room.cx /= cells.length;
      room.cy /= cells.length;
      let best = -1, bestN = 0;
      for (const [o, n] of tally) if (n > bestN) { best = o; bestN = n; }
      room.temp = best >= 0 && oldRooms[best] ? oldRooms[best].temp : this.outT * 0.6 + 14 * 0.4;
      rooms.push(room);
    }
    for (const b of this.buildings.values()) {
      if (!b.complete || !BUILDINGS[b.def].bed) continue;
      const r = R[this.idx(b.x, b.y)];
      if (r >= 0) rooms[r].beds++;
    }
    this.rooms = rooms;
  }
  roomAt(i) {
    this.ensureRooms();
    const r = this.room[i];
    return r >= 0 ? this.rooms[r] : null;
  }
  tempAt(i) {
    const r = this.roomAt(i);
    return r ? r.temp : this.outT;
  }
  isOutdoors(i) {
    return !this.roomAt(i);
  }
  heatActive(b) {
    const d = BUILDINGS[b.def];
    return b.complete && (!d.fuel || (b.on && b.fuel > 0));
  }
  updateTemps() {
    this.ensureRooms();
    const out = this.outT;
    const heat = new Float32Array(this.rooms.length);
    for (const b of this.buildings.values()) {
      const d = BUILDINGS[b.def];
      if (!d.heat || !this.heatActive(b)) continue;
      const r = this.room[this.idx(b.x, b.y)];
      if (r >= 0) heat[r] += d.heat;
    }
    for (const room of this.rooms) {
      const base = out * 0.6 + 14 * 0.4;
      let target = base + (heat[room.id] * 12) / Math.max(room.size, 6);
      const cap = Math.max(base, 26);
      if (target > cap) target = cap;
      room.temp += (target - room.temp) * 0.08;
    }
  }

  // ---------- исследования ----------
  canResearch(id) {
    const r = RESEARCH[id];
    if (!r || this.research.done[id]) return false;
    return !(r.req || []).some((q) => !this.research.done[q]);
  }
  addResearch(amount) {
    const cur = this.research.current;
    if (!cur) return;
    const p = (this.research.progress[cur] = (this.research.progress[cur] || 0) + amount);
    if (p >= RESEARCH[cur].cost) {
      this.research.done[cur] = true;
      this.research.current = null;
      this.letter("good", "Исследование завершено", `«${RESEARCH[cur].name}»: ${RESEARCH[cur].desc}`);
    }
  }
  cropAllowed(crop) {
    const d = PLANTS[PLANT[crop]];
    return !d.research || !!this.research.done[d.research];
  }

  // ---------- выборки ----------
  colonists() {
    return this.pawns.filter((p) => p.kind === "colonist" && !p.dead);
  }
  hostiles() {
    return this.pawns.filter((p) => p.faction === "hostile" && !p.dead && !p.downed);
  }
  pawnAt(x, y) {
    return this.pawns.filter((p) => p.x === x && p.y === y);
  }
  homeRegion() {
    this.ensureRegions();
    const c = this.nearestStandable(this.home.x, this.home.y);
    return c ? this.region[this.idx(c.x, c.y)] : -1;
  }
  edgeCell(rng = this.rng, reachHome = true) {
    this.ensureRegions();
    const hr = reachHome ? this.homeRegion() : -1;
    const side = rng.int(0, 3);
    for (let t = 0; t < 80; t++) {
      const s = t < 40 ? side : rng.int(0, 3);
      const k = rng.int(0, this.W - 1);
      const x = s === 0 ? k : s === 1 ? k : s === 2 ? 0 : this.W - 1;
      const y = s === 0 ? 0 : s === 1 ? this.H - 1 : k;
      const i = this.idx(x, y);
      if (!this.standable(i)) continue;
      if (hr >= 0 && this.region[i] !== hr) continue;
      return { x, y };
    }
    return this.nearestStandable(0, 0);
  }
  colonyCenter() {
    let sx = 0, sy = 0, n = 0;
    for (const b of this.buildings.values()) {
      if (!b.complete || BUILDINGS[b.def].wall) continue;
      sx += b.x;
      sy += b.y;
      n++;
    }
    if (n < 3) return { x: this.home.x, y: this.home.y };
    return { x: Math.round(sx / n), y: Math.round(sy / n) };
  }

  // ---------- события для интерфейса ----------
  on(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((f) => f !== fn));
  }
  emit(type, data) {
    for (const fn of this.listeners) {
      try {
        fn(type, data);
      } catch (e) {
        console.error(e);
      }
    }
  }
  letter(kind, title, text, x, y) {
    const l = { id: this.nextId++, tick: this.tick, day: this.day, kind, title, text, x, y };
    this.letters.push(l);
    if (this.letters.length > 60) this.letters.shift();
    this.emit("letter", l);
    return l;
  }
  addFx(f) {
    if (this.fx.length < 300) this.fx.push(f);
  }

  // ---------- главный тик ----------
  step() {
    if (this.gameOver) return;
    this.tick++;
    this.outT = this.computeOutdoorTemp();
    if (this.tick % 30 === 0) this.updateTemps();
    if (this.tick % TPH === 0) this.hourly();

    const pawns = this.pawns;
    for (let k = 0; k < pawns.length; k++) pawnTick(this, pawns[k]);

    for (const b of this.buildings.values()) {
      if (!b.complete) continue;
      const d = BUILDINGS[b.def];
      if (d.fuel && b.on && b.fuel > 0) b.fuel = Math.max(0, b.fuel - d.fuel.perHour / TPH);
      if (d.turret) turretTick(this, b);
    }
    storyTick(this);

    if (this.fx.length) {
      for (const f of this.fx) f.t--;
      this.fx = this.fx.filter((f) => f.t > 0);
    }
    if (this.tick % 50 === 0) {
      // убираем давно погибших
      const before = this.pawns.length;
      this.pawns = this.pawns.filter((p) => {
        const gone = (p.dead && this.tick - p.deadTick > TPD) || p.despawned;
        if (gone) {
          this.ents.delete(p.id);
          this.releaseAll(p.id);
        }
        return !gone;
      });
      if (before !== this.pawns.length) this.emit("pawns");
      if (!this.colonists().length && !this.gameOver) {
        this.gameOver = true;
        this.emit("gameover");
      }
    }
  }

  hourly() {
    this.growPlants();
    this.spawnWild();
    this.updateWeather();
    this.tempMods = this.tempMods.filter((m) => this.tick < m.until);
  }

  growPlants() {
    const N = this.N;
    this.ensureRooms();
    let frost = 0;
    for (let i = 0; i < N; i++) {
      const p = this.plant[i];
      if (!p) continue;
      const d = PLANTS[p];
      const r = this.room[i];
      const t = r >= 0 ? this.rooms[r].temp : this.outT;
      if (d.crop && t < -3 && this.rng.chance(0.15)) {
        this.plant[i] = 0;
        this.growth[i] = 0;
        frost++;
        continue;
      }
      if (this.growth[i] >= 1) continue;
      const tf = t <= 0 ? 0 : t < 10 ? t / 10 : t > 42 ? 0 : t > 35 ? (42 - t) / 7 : 1;
      if (tf <= 0) continue;
      const fert = this.floor[i] ? 0.3 : Math.max(0.3, TERRAIN[this.terrain[i]].fert);
      this.growth[i] = Math.min(1, this.growth[i] + (tf * fert) / (d.grow * 24));
    }
    if (frost > 0 && this.story.lastFrost !== this.day) {
      this.story.lastFrost = this.day;
      this.letter("bad", "Мороз погубил посевы", "Растения на полях замёрзли. Сажать снова стоит, когда потеплеет.");
    }
  }

  spawnWild() {
    if (this.outT < 4) return;
    const rng = this.rng;
    for (let k = 0; k < 5; k++) {
      const i = rng.int(0, this.N - 1);
      if (this.plant[i] || this.rock[i] || this.bgrid[i] || this.fgrid[i] || this.igrid[i] || this.zone[i] || this.floor[i]) continue;
      if (TERRAIN[this.terrain[i]].fert < 0.5 || this.room[i] >= 0) continue;
      const r = rng.next();
      let type = r < 0.62 ? "grass" : r < 0.86 ? (rng.chance(0.5) ? "tree" : "pine") : "bush";
      if (type !== "grass") {
        const x = i % this.W, y = (i / this.W) | 0;
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            if (!this.inB(x + dx, y + dy)) continue;
            const j = this.idx(x + dx, y + dy);
            if (this.bgrid[j] || this.zone[j]) { near = true; break; }
          }
        if (near) type = "grass";
      }
      this.plant[i] = PLANT[type];
      this.growth[i] = 0.05;
      this.recalcCost(i);
    }
  }

  updateWeather() {
    const w = this.weather;
    if (this.tick >= w.until) {
      const r = this.rng.next();
      w.kind = r < 0.58 ? "clear" : r < 0.85 ? "rain" : "fog";
      w.until = this.tick + this.rng.int(4, 14) * TPH;
    }
    if (w.kind === "rain" && this.outT < 0) w.kind = "snow";
    if (w.kind === "snow" && this.outT > 2) w.kind = "rain";
    if (w.kind === "snow") this.snow = Math.min(1, this.snow + 0.07);
    else if (this.outT > 0) this.snow = Math.max(0, this.snow - 0.01 * Math.min(5, this.outT));
  }
}

export { TPH, TPD, ROCKS, PLANTS, ITEMS, BUILDINGS };
