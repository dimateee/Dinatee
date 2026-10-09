import "./styles.css";
import { BASE_TPS, SPEEDS, BUILDINGS, PLANTS, DESIG, SPIRAL, TPD } from "./game/defs.js";
import { createWorld, startColony } from "./game/mapgen.js";
import { setDrafted } from "./game/pawn.js";
import { startPath } from "./game/pawnutil.js";
import { isEnemy } from "./game/combat.js";
import { raid, EVENTS } from "./game/story.js";
import { Renderer } from "./render/renderer.js";
import { UI } from "./ui/ui.js";
import { Input } from "./ui/input.js";
import { TG } from "./telegram.js";
import { saveGame, loadBest, cloudDue, loadSettings, saveSettings, deleteSave } from "./storage.js";

const MAX_AREA = 45;

class Game {
  constructor() {
    this.canvas = document.getElementById("game");
    this.renderer = new Renderer(this.canvas);
    this.settings = loadSettings();
    this.w = null;
    this.mode = "menu"; // menu | play
    this.speed = 1;
    this.cam = { x: 40, y: 40, z: 30, vx: 0, vy: 0 };
    this.camTarget = null;
    this.tool = null;
    this.drag = null;
    this.preview = null;
    this.sel = null;
    this.acc = 0;
    this.last = performance.now();
    this.lastUi = 0;
    this.lastDay = -1;
    this.ui = new UI(this);
    this.input = new Input(this);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    if (TG.raw) {
      try {
        TG.raw.onEvent("viewportChanged", () => this.resize());
      } catch (e) {}
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.autosave(true);
    });
    window.addEventListener("pagehide", () => this.autosave(true));
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.renderer.resize(Math.max(1, r.width), Math.max(1, r.height));
    this.ui.layout();
    if (this.w) this.clampCam();
  }

  // ---------- запуск ----------
  showDemo() {
    const w = createWorld({ seed: Math.floor(Math.random() * 1e9) });
    this.w = w;
    this.mode = "menu";
    this.renderer.attach(w);
    this.cam = { x: w.home.x, y: w.home.y, z: Math.max(18, Math.min(30, this.renderer.cssW / 16)), vx: 0.25, vy: 0.1 };
    this.ui.showMenu();
  }

  startWorld(w, fresh) {
    this.w = w;
    this.mode = "play";
    this.renderer.attach(w);
    const c = w.colonists()[0];
    const fx = c ? c.x : w.home.x, fy = c ? c.y : w.home.y;
    this.cam = { x: fx + 0.5, y: fy + 0.5, z: Math.max(26, Math.min(40, this.renderer.cssW / 12)), vx: 0, vy: 0 };
    this.sel = null;
    this.tool = null;
    this.speed = 1;
    this.lastDay = w.day;
    w.on((type, d) => this.onWorldEvent(type, d));
    this.ui.enterGame();
    if (fresh) {
      this.autosave(true);
      const l = w.letters[w.letters.length - 1];
      if (l) this.ui.toast(l, 12000);
    }
  }

  async continueGame() {
    this.ui.showLoading("Загрузка колонии…");
    try {
      const w = await loadBest();
      if (!w) {
        this.ui.showMenu();
        this.ui.toast({ kind: "bad", title: "Нет сохранения", text: "Начните новую колонию." });
        return;
      }
      if (w.gameOver) {
        this.ui.showMenu();
        return;
      }
      this.startWorld(w, false);
    } catch (e) {
      console.error(e);
      this.ui.showMenu();
      this.ui.toast({ kind: "bad", title: "Не удалось загрузить", text: String(e.message || e) });
    }
  }

  newColony(world, colonists) {
    startColony(world, colonists);
    this.startWorld(world, true);
  }

  async autosave(cloud) {
    if (this.mode !== "play" || !this.w || this.w.gameOver) return;
    try {
      await saveGame(this.w, { cloud });
    } catch (e) {
      console.warn(e);
    }
  }

  toMenu() {
    this.autosave(true);
    this.showDemo();
  }

  // ---------- события мира ----------
  onWorldEvent(type, d) {
    if (type === "letter") {
      this.ui.toast(d);
      if (d.kind === "threat") {
        TG.haptic("warning");
        if (this.settings.autoPause) this.setSpeed(0);
      } else if (d.kind === "death") TG.haptic("error");
      else if (d.kind === "good") TG.haptic("success");
    } else if (type === "gameover") {
      TG.haptic("error");
      deleteSave();
      this.ui.showGameOver();
    }
  }

  setSpeed(s) {
    this.speed = s;
    this.ui.refreshSpeeds();
  }

  // ---------- цикл ----------
  loop(ts) {
    const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    const w = this.w;
    if (w) {
      let rate = 0;
      if (this.mode === "play" && !this.ui.pausesGame()) rate = BASE_TPS * SPEEDS[this.speed];
      if (this.mode === "menu") rate = BASE_TPS;
      this.acc += dt * rate;
      let n = 0;
      while (this.acc >= 1 && n < 50) {
        w.step();
        this.acc -= 1;
        n++;
      }
      if (n >= 50) this.acc = 0;
      if (this.mode === "play" && w.day !== this.lastDay) {
        this.lastDay = w.day;
        this.autosave(cloudDue(180000));
      }
      this.updateCam(dt);
      this.renderer.frame(this.cam, { sel: this.selState(), preview: this.preview, rect: this.drag && this.tool && this.tool.kind !== "build" ? this.drag : null }, dt);
    }
    if (ts - this.lastUi > 250) {
      this.lastUi = ts;
      if (this.mode === "play") this.ui.update();
    }
    requestAnimationFrame((t) => this.loop(t));
  }

  updateCam(dt) {
    const c = this.cam;
    if (this.mode === "menu") {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const w = this.w;
      if (c.x < 15 || c.x > w.W - 15) c.vx *= -1;
      if (c.y < 15 || c.y > w.H - 15) c.vy *= -1;
      return;
    }
    if (this.camTarget) {
      const k = Math.min(1, dt * 7);
      c.x += (this.camTarget.x - c.x) * k;
      c.y += (this.camTarget.y - c.y) * k;
      if (Math.abs(this.camTarget.x - c.x) + Math.abs(this.camTarget.y - c.y) < 0.05) this.camTarget = null;
    } else if (!this.input.active() && (Math.abs(c.vx) > 0.01 || Math.abs(c.vy) > 0.01)) {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      const f = Math.pow(0.04, dt);
      c.vx *= f;
      c.vy *= f;
    }
    this.clampCam();
  }

  clampCam() {
    const c = this.cam, w = this.w;
    if (!w) return;
    const minZ = Math.max(6, Math.min(this.renderer.cssW, this.renderer.cssH) / w.W * 0.9);
    c.z = Math.max(minZ, Math.min(80, c.z));
    c.x = Math.max(0, Math.min(w.W, c.x));
    c.y = Math.max(0, Math.min(w.H, c.y));
  }

  // Центрируем объект в видимой части экрана (между верхней панелью и нижней карточкой)
  centerOn(x, y) {
    const r = this.ui.visibleArea();
    const dy = (r.top + r.bottom) / 2 - this.renderer.cssH / 2;
    this.camTarget = { x: x + 0.5, y: y + 0.5 - dy / this.cam.z };
  }

  // ---------- выбор ----------
  selState() {
    const s = this.sel;
    if (!s) return null;
    return { pawn: s.pawn, cell: s.cell, zone: s.zone };
  }

  select(sel) {
    this.sel = sel;
    this.ui.onSelect();
  }

  candidatesAt(wx, wy) {
    const w = this.w;
    const tx = Math.floor(wx), ty = Math.floor(wy);
    const out = [];
    const pawns = [];
    for (const p of w.pawns) {
      if (p.despawned) continue;
      const v = this.renderer.vis.get(p.id) || p;
      const d = Math.hypot(v.x + 0.5 - wx, v.y + 0.5 - wy);
      if (d < 0.75) pawns.push([p, d + (p.dead ? 1 : 0)]);
    }
    pawns.sort((a, b) => a[1] - b[1]);
    for (const [p] of pawns) out.push({ pawn: p.id });
    if (!w.inB(tx, ty)) return out;
    const i = w.idx(tx, ty);
    if (w.bgrid[i]) out.push({ building: w.bgrid[i], cell: i });
    if (w.fgrid[i]) out.push({ building: w.fgrid[i], cell: i });
    if (w.igrid[i]) out.push({ item: w.igrid[i], cell: i });
    if (w.plant[i]) out.push({ plant: true, cell: i });
    if (w.rock[i]) out.push({ rock: true, cell: i });
    if (w.zone[i]) out.push({ zone: w.zone[i], cell: i });
    out.push({ terrain: true, cell: i });
    return out;
  }

  tap(sx, sy) {
    const w = this.w;
    if (!w || this.mode !== "play") return;
    const p = this.renderer.screenToWorld(this.cam, sx, sy);
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    // приказы призванным
    const group = this.draftedSelection();
    if (group.length && w.inB(tx, ty)) {
      const cands = this.candidatesAt(p.x, p.y);
      const enemy = cands.map((c) => c.pawn && w.get(c.pawn)).find((q) => q && !q.downed && isEnemy(group[0], q));
      if (enemy) {
        for (const c of group) {
          c.forceTarget = enemy.id;
          c.path = null;
        }
        TG.haptic("medium");
        this.ui.flash(`Атаковать: ${enemy.short || enemy.name}`);
        return;
      }
      const own = cands.find((c) => c.pawn && w.get(c.pawn) && w.get(c.pawn).kind === "colonist");
      if (!own) {
        this.moveGroup(group, tx, ty);
        return;
      }
    }
    const cands = this.candidatesAt(p.x, p.y);
    if (!cands.length) {
      this.select(null);
      return;
    }
    let k = 0;
    if (this.sel) {
      const cur = cands.findIndex((c) => sameSel(c, this.sel));
      if (cur >= 0) k = (cur + 1) % cands.length;
    }
    this.select(cands[k]);
    TG.haptic("select");
  }

  draftedSelection() {
    const w = this.w;
    if (!this.sel) return [];
    if (this.sel.group) return this.sel.group.map((id) => w.get(id)).filter((p) => p && p.drafted && !p.dead && !p.downed);
    if (this.sel.pawn) {
      const p = w.get(this.sel.pawn);
      if (p && p.drafted && !p.dead && !p.downed) return [p];
    }
    return [];
  }

  moveGroup(group, tx, ty) {
    const w = this.w;
    const used = new Set();
    let moved = 0;
    for (const c of group) {
      c.forceTarget = null;
      for (const [dx, dy] of SPIRAL) {
        const x = tx + dx, y = ty + dy;
        if (!w.inB(x, y)) continue;
        const i = w.idx(x, y);
        if (used.has(i) || !w.standable(i)) continue;
        if (!w.canReach(c.x, c.y, x, y, "on")) continue;
        used.add(i);
        if (startPath(w, c, x, y, "on", 0)) moved++;
        break;
      }
    }
    if (moved) {
      TG.haptic("light");
      this.renderer.marker = { x: tx, y: ty, t: 0.6 };
    } else this.ui.flash("Туда не пройти");
  }

  draftAll(on) {
    const w = this.w;
    const ids = [];
    for (const c of w.colonists()) {
      if (c.downed) continue;
      setDrafted(w, c, on);
      if (on) ids.push(c.id);
    }
    TG.haptic(on ? "heavy" : "light");
    if (on && ids.length) this.select({ group: ids });
    else if (this.sel && this.sel.group) this.select(null);
  }

  // ---------- инструменты ----------
  setTool(tool) {
    this.tool = tool;
    this.drag = null;
    this.preview = null;
    if (tool) this.select(null);
    this.ui.onTool();
  }

  dragStart(sx, sy) {
    const p = this.renderer.screenToWorld(this.cam, sx, sy);
    const x = Math.floor(p.x), y = Math.floor(p.y);
    this.drag = { x0: x, y0: y, x1: x, y1: y };
    this.updatePreview();
  }
  dragMove(sx, sy) {
    if (!this.drag) return;
    const p = this.renderer.screenToWorld(this.cam, sx, sy);
    const x = Math.floor(p.x), y = Math.floor(p.y);
    if (x === this.drag.x1 && y === this.drag.y1) return;
    this.drag.x1 = Math.max(this.drag.x0 - MAX_AREA, Math.min(this.drag.x0 + MAX_AREA, x));
    this.drag.y1 = Math.max(this.drag.y0 - MAX_AREA, Math.min(this.drag.y0 + MAX_AREA, y));
    TG.haptic("select");
    this.updatePreview();
  }
  dragCancel() {
    this.drag = null;
    this.preview = null;
  }
  dragEnd() {
    if (!this.drag || !this.tool) return;
    const cells = this.toolCells();
    this.applyTool(cells);
    this.drag = null;
    this.preview = null;
  }

  toolCells() {
    const w = this.w, t = this.tool, d = this.drag;
    const ax = Math.min(d.x0, d.x1), bx = Math.max(d.x0, d.x1);
    const ay = Math.min(d.y0, d.y1), by = Math.max(d.y0, d.y1);
    const out = [];
    const add = (x, y) => {
      if (w.inB(x, y)) out.push([x, y]);
    };
    let mode = "fill";
    if (t.kind === "build") mode = BUILDINGS[t.def].drag;
    if (mode === "single") add(d.x1, d.y1);
    else if (mode === "line") {
      if (Math.abs(d.x1 - d.x0) >= Math.abs(d.y1 - d.y0)) for (let x = ax; x <= bx; x++) add(x, d.y0);
      else for (let y = ay; y <= by; y++) add(d.x0, y);
    } else if (mode === "outline") {
      for (let x = ax; x <= bx; x++) {
        add(x, ay);
        if (by !== ay) add(x, by);
      }
      for (let y = ay + 1; y < by; y++) {
        add(ax, y);
        if (bx !== ax) add(bx, y);
      }
    } else for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) add(x, y);
    return out;
  }

  updatePreview() {
    const t = this.tool;
    if (!t || !this.drag) {
      this.preview = null;
      return;
    }
    if (t.kind !== "build") {
      this.preview = null;
      return;
    }
    const w = this.w;
    const cells = this.toolCells().map(([x, y]) => ({ x, y, ok: w.canPlace(t.def, x, y) }));
    this.preview = { def: t.def, cells };
    this.ui.updateHint(cells.filter((c) => c.ok).length);
  }

  applyTool(cells) {
    const w = this.w, t = this.tool;
    let n = 0;
    if (t.kind === "build") {
      for (const [x, y] of cells) if (w.placeBlueprint(t.def, x, y)) n++;
      if (!n) this.ui.flash("Здесь нельзя строить");
    } else if (t.kind === "zone") {
      const z = w.paintZone(cells.map(([x, y]) => w.idx(x, y)), t.type);
      if (z) {
        n = 1;
        w.ensureZones();
        if (t.type === "grow" && !this.ui.seenCropHint) {
          this.ui.seenCropHint = true;
          this.ui.flash("Нажмите на поле, чтобы выбрать культуру");
        }
      } else this.ui.flash(t.type === "grow" ? "Нужна плодородная земля" : "Здесь нельзя");
    } else if (t.kind === "erase") {
      w.clearZone(cells.map(([x, y]) => w.idx(x, y)));
      n = 1;
    } else if (t.kind === "desig") n = this.applyDesig(t.mode, cells);
    if (n) TG.haptic("light");
    else TG.haptic("error");
  }

  applyDesig(mode, cells) {
    const w = this.w;
    let n = 0;
    const set = new Set(cells.map(([x, y]) => w.idx(x, y)));
    for (const i of set) {
      const pl = w.plant[i];
      if (mode === "mine" && w.rock[i]) {
        w.setDesig(i, DESIG.MINE, true);
        n++;
      } else if (mode === "cut" && pl && PLANTS[pl].tree) {
        w.setDesig(i, DESIG.CUT, true);
        n++;
      } else if (mode === "harvest" && pl && (PLANTS[pl].harvest || PLANTS[pl].yield)) {
        w.setDesig(i, PLANTS[pl].tree ? DESIG.CUT : DESIG.HARVEST, true);
        n++;
      } else if (mode === "decon") {
        const b = w.bAt(i);
        if (b) {
          if (b.complete) b.deconstruct = true;
          else w.removeBuilding(b);
          n++;
        }
        const f = w.fAt(i);
        if (f) {
          w.removeBuilding(f);
          n++;
        }
      } else if (mode === "cancel") {
        if (w.desig[i]) {
          w.setDesig(i, 0xff, false);
          n++;
        }
        const b = w.bAt(i);
        if (b) {
          if (!b.complete) w.removeBuilding(b);
          else b.deconstruct = false;
          n++;
        }
        const f = w.fAt(i);
        if (f) {
          w.removeBuilding(f);
          n++;
        }
      }
    }
    if (mode === "hunt" || mode === "cancel") {
      for (const p of w.pawns) {
        if (p.kind !== "animal" || p.dead || !set.has(w.idx(p.x, p.y))) continue;
        p.huntDesig = mode === "hunt";
        n++;
      }
    }
    if (!n) this.ui.flash("Здесь нечего отметить");
    return n;
  }

  saveSettings() {
    saveSettings(this.settings);
  }
}

function sameSel(a, b) {
  if (!a || !b) return false;
  for (const k of ["pawn", "building", "item", "zone"]) if (a[k] != null || b[k] != null) return a[k] === b[k] && a.cell === b.cell;
  for (const k of ["plant", "rock", "terrain"]) if (a[k] || b[k]) return !!a[k] === !!b[k] && a.cell === b.cell;
  return false;
}

TG.init();
const game = new Game();
window.__game = game;
game.debug = { raid, EVENTS };
game.showDemo();

export { TPD };
