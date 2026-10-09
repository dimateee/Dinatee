// Касания и мышь: один палец — карта (или рисование инструментом), два пальца — зум и сдвиг
export class Input {
  constructor(game) {
    this.game = game;
    this.cv = game.canvas;
    this.ptrs = new Map();
    this.mode = null;
    this.hist = [];
    const cv = this.cv;
    cv.addEventListener("pointerdown", (e) => this.down(e));
    cv.addEventListener("pointermove", (e) => this.move(e));
    cv.addEventListener("pointerup", (e) => this.up(e));
    cv.addEventListener("pointercancel", (e) => this.up(e, true));
    cv.addEventListener("wheel", (e) => this.wheel(e), { passive: false });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  active() {
    return this.ptrs.size > 0;
  }

  pos(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  down(e) {
    const g = this.game;
    if (!g.w) return;
    try {
      this.cv.setPointerCapture(e.pointerId);
    } catch (err) {}
    const p = this.pos(e);
    this.ptrs.set(e.pointerId, { ...p, sx: p.x, sy: p.y });
    g.camTarget = null;
    g.cam.vx = g.cam.vy = 0;
    if (this.ptrs.size === 1) {
      this.t0 = performance.now();
      this.moved = false;
      this.start = p;
      this.hist = [{ ...p, t: this.t0 }];
      const panButton = e.pointerType === "mouse" && e.button !== 0;
      if (g.tool && g.mode === "play" && !panButton) {
        this.mode = "tool";
        g.dragStart(p.x, p.y);
      } else this.mode = "pan";
      if (e.pointerType === "mouse" && e.button === 2) this.rightClick = true;
    } else if (this.ptrs.size === 2) {
      if (this.mode === "tool") g.dragCancel();
      this.mode = "pinch";
      const [a, b] = [...this.ptrs.values()];
      this.pinch = {
        d: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        z: g.cam.z,
        world: g.renderer.screenToWorld(g.cam, (a.x + b.x) / 2, (a.y + b.y) / 2),
      };
    }
  }

  move(e) {
    const g = this.game;
    const rec = this.ptrs.get(e.pointerId);
    if (!rec || !g.w) return;
    const p = this.pos(e);
    const dx = p.x - rec.x, dy = p.y - rec.y;
    rec.x = p.x;
    rec.y = p.y;
    if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > 8) this.moved = true;
    if (this.mode === "pan") {
      if (!this.moved) return;
      g.cam.x -= dx / g.cam.z;
      g.cam.y -= dy / g.cam.z;
      const now = performance.now();
      this.hist.push({ ...p, t: now });
      while (this.hist.length > 2 && now - this.hist[0].t > 100) this.hist.shift();
      g.clampCam();
    } else if (this.mode === "tool") {
      g.dragMove(p.x, p.y);
    } else if (this.mode === "pinch" && this.ptrs.size >= 2) {
      const [a, b] = [...this.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const pz = this.pinch;
      g.cam.z = pz.z * (d / pz.d);
      g.clampCam();
      // точка мира под пальцами остаётся под пальцами
      g.cam.x = pz.world.x - (cx - g.renderer.cssW / 2) / g.cam.z;
      g.cam.y = pz.world.y - (cy - g.renderer.cssH / 2) / g.cam.z;
      g.clampCam();
    }
  }

  up(e, cancelled) {
    const g = this.game;
    if (!this.ptrs.has(e.pointerId)) return;
    this.ptrs.delete(e.pointerId);
    if (this.mode === "pan" && this.ptrs.size === 0) {
      const dt = performance.now() - this.t0;
      if (!this.moved && !cancelled && dt < 450) {
        if (this.rightClick) {
          if (g.tool) g.setTool(null);
          else g.select(null);
        } else g.tap(this.start.x, this.start.y);
      } else if (this.moved && this.hist.length >= 2) {
        const a = this.hist[0], b = this.hist[this.hist.length - 1];
        const t = Math.max(16, b.t - a.t) / 1000;
        g.cam.vx = -((b.x - a.x) / t) / g.cam.z;
        g.cam.vy = -((b.y - a.y) / t) / g.cam.z;
      }
    } else if (this.mode === "tool" && this.ptrs.size === 0) {
      if (cancelled) g.dragCancel();
      else g.dragEnd();
    }
    if (this.mode === "pinch" && this.ptrs.size === 1) {
      // второй палец ещё на экране — продолжаем просто двигать карту без тапа
      const [r] = [...this.ptrs.values()];
      this.mode = "pan";
      this.moved = true;
      this.start = { x: r.x, y: r.y };
      this.hist = [{ x: r.x, y: r.y, t: performance.now() }];
    }
    if (this.ptrs.size === 0) {
      this.mode = null;
      this.rightClick = false;
    }
  }

  wheel(e) {
    e.preventDefault();
    const g = this.game;
    if (!g.w) return;
    const p = this.pos(e);
    const before = g.renderer.screenToWorld(g.cam, p.x, p.y);
    g.cam.z *= Math.exp(-e.deltaY * 0.0015);
    g.clampCam();
    g.cam.x = before.x - (p.x - g.renderer.cssW / 2) / g.cam.z;
    g.cam.y = before.y - (p.y - g.renderer.cssH / 2) / g.cam.z;
    g.clampCam();
  }
}
