// Отрисовка мира на canvas: статичный слой местности, объекты, поселенцы, свет и погода
import { ROCKS, PLANTS, ITEMS, BUILDINGS, DESIG, TR } from "../game/defs.js";
import { hash2 } from "../game/rng.js";
import {
  plantSprite, itemSprite, buildingSprite, wallTexture, iconSprite, drawHuman, drawAnimal, drawWeaponHeld,
} from "./sprites.js";

const TEX = 16;
// цвета местности по индексу TR
const TCOL = [
  [92, 120, 58], [124, 98, 66], [84, 64, 44], [200, 182, 134], [138, 130, 116],
  [100, 84, 64], [70, 130, 150], [38, 78, 122], [108, 104, 100],
];
const ROCKCOL = [null, [100, 96, 92], [96, 98, 104], [104, 100, 98], [100, 90, 82]];

function mk(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
const sm = (t) => {
  t = Math.max(0, Math.min(1, (t - 0.15) / 0.7));
  return t * t * (3 - 2 * t);
};

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext("2d", { alpha: false });
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.light = mk(4, 4);
    this.lg = this.light.getContext("2d");
    this.vis = new Map();
    this.particles = [];
    this.time = 0;
    this.cssW = 1;
    this.cssH = 1;
  }

  attach(w) {
    this.w = w;
    this.static = mk(w.W * TEX, w.H * TEX);
    this.sg = this.static.getContext("2d");
    this.snowMask = mk(w.W, w.H);
    this.snowG = this.snowMask.getContext("2d");
    this.snowRoomsKey = null;
    this.vis.clear();
    this.redrawStatic(0, 0, w.W - 1, w.H - 1);
    w.allDirty = false;
    w.dirtyCells.clear();
  }

  resize(cssW, cssH) {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cssW = cssW;
    this.cssH = cssH;
    this.cv.width = Math.round(cssW * this.dpr);
    this.cv.height = Math.round(cssH * this.dpr);
    this.light.width = Math.max(1, Math.ceil(cssW / 4));
    this.light.height = Math.max(1, Math.ceil(cssH / 4));
  }

  // ---------- статичный слой ----------
  redrawStatic(x0, y0, x1, y1) {
    const w = this.w, W = w.W, H = w.H;
    x0 = Math.max(0, x0);
    y0 = Math.max(0, y0);
    x1 = Math.min(W - 1, x1);
    y1 = Math.min(H - 1, y1);
    const pw = (x1 - x0 + 1) * TEX, ph = (y1 - y0 + 1) * TEX;
    const img = this.sg.createImageData(pw, ph);
    const d = img.data;
    let o = 0;
    const isRock = (x, y) => x < 0 || y < 0 || x >= W || y >= H || w.rock[y * W + x] > 0;
    for (let py = y0 * TEX; py < (y1 + 1) * TEX; py++) {
      const cy = (py / TEX) | 0;
      const fy = py / TEX - 0.5;
      const iy = Math.floor(fy);
      const ty = sm(fy - iy);
      const iy0 = Math.max(0, iy), iy1 = Math.min(H - 1, iy + 1);
      for (let px = x0 * TEX; px < (x1 + 1) * TEX; px++) {
        const cx = (px / TEX) | 0;
        const ci = cy * W + cx;
        let r, g, b;
        const n1 = hash2(px, py, 7) - 0.5;
        const rk = w.rock[ci];
        if (rk) {
          const base = ROCKCOL[rk];
          const lx = px - cx * TEX, ly = py - cy * TEX;
          let v = n1 * 16 + (hash2(px >> 2, py >> 2, 9) - 0.5) * 14;
          if (!isRock(cx, cy - 1) && ly < 3) v += 32;
          if (!isRock(cx, cy + 1) && ly >= TEX - 4) v -= 42;
          if (!isRock(cx - 1, cy) && lx < 2) v -= 12;
          if (!isRock(cx + 1, cy) && lx >= TEX - 2) v -= 20;
          r = base[0] + v;
          g = base[1] + v;
          b = base[2] + v;
          if (rk > 1 && hash2(px >> 1, py >> 1, 21 + rk) > 0.84) {
            const c = rk === 2 ? [168, 184, 206] : rk === 3 ? [236, 238, 244] : [176, 112, 60];
            r = c[0] + v * 0.5;
            g = c[1] + v * 0.5;
            b = c[2] + v * 0.5;
          }
        } else if (w.floor[ci]) {
          if (w.floor[ci] === 1) {
            const plank = py >> 2;
            const seam = (py & 3) === 0 || (px + plank * 7) % 16 === 0;
            const v = (hash2(plank, (px + plank * 7) >> 4, 13) - 0.5) * 26 + n1 * 8;
            r = 154 + v - (seam ? 40 : 0);
            g = 110 + v - (seam ? 32 : 0);
            b = 66 + v * 0.6 - (seam ? 24 : 0);
          } else {
            const gap = px % 8 === 0 || py % 8 === 0;
            const v = (hash2(px >> 3, py >> 3, 17) - 0.5) * 18 + n1 * 6;
            r = gap ? 92 : 170 + v;
            g = gap ? 90 : 166 + v;
            b = gap ? 86 : 158 + v;
          }
        } else {
          const fx = px / TEX - 0.5;
          const ix = Math.floor(fx);
          const tx = sm(fx - ix);
          const ix0 = Math.max(0, ix), ix1 = Math.min(W - 1, ix + 1);
          const c00 = TCOL[w.terrain[iy0 * W + ix0]], c10 = TCOL[w.terrain[iy0 * W + ix1]];
          const c01 = TCOL[w.terrain[iy1 * W + ix0]], c11 = TCOL[w.terrain[iy1 * W + ix1]];
          const t = w.terrain[ci];
          let v = n1 * 14 + (hash2(cx, cy, 3) - 0.5) * 8 + (hash2(px >> 2, py >> 2, 11) - 0.5) * 10;
          if (t === TR.SHALLOW || t === TR.DEEP) v = n1 * 4 + Math.sin((px + py * 0.6) * 0.35) * 5;
          r = (c00[0] * (1 - tx) + c10[0] * tx) * (1 - ty) + (c01[0] * (1 - tx) + c11[0] * tx) * ty + v;
          g = (c00[1] * (1 - tx) + c10[1] * tx) * (1 - ty) + (c01[1] * (1 - tx) + c11[1] * tx) * ty + v;
          b = (c00[2] * (1 - tx) + c10[2] * tx) * (1 - ty) + (c01[2] * (1 - tx) + c11[2] * tx) * ty + v * 0.8;
        }
        d[o++] = r;
        d[o++] = g;
        d[o++] = b;
        d[o++] = 255;
      }
    }
    this.sg.putImageData(img, x0 * TEX, y0 * TEX);
  }

  flushDirty() {
    const w = this.w;
    if (w.allDirty) {
      this.redrawStatic(0, 0, w.W - 1, w.H - 1);
      w.allDirty = false;
      w.dirtyCells.clear();
      return;
    }
    if (!w.dirtyCells.size) return;
    // объединяем в один прямоугольник, если клеток много
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    const cells = [...w.dirtyCells];
    w.dirtyCells.clear();
    if (cells.length > 6) {
      for (const i of cells) {
        const x = i % w.W, y = (i / w.W) | 0;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
      this.redrawStatic(x0 - 1, y0 - 1, x1 + 1, y1 + 1);
    } else {
      for (const i of cells) {
        const x = i % w.W, y = (i / w.W) | 0;
        this.redrawStatic(x - 1, y - 1, x + 1, y + 1);
      }
    }
  }

  updateSnowMask() {
    const w = this.w;
    const key = w.rooms.length + ":" + w.stats.built + ":" + w.tick / 600 | 0;
    if (key === this.snowRoomsKey) return;
    this.snowRoomsKey = key;
    const img = this.snowG.createImageData(w.W, w.H);
    for (let i = 0; i < w.N; i++) {
      const t = w.terrain[i];
      const out = w.room[i] < 0 && t !== TR.SHALLOW && t !== TR.DEEP;
      img.data[i * 4] = 238;
      img.data[i * 4 + 1] = 243;
      img.data[i * 4 + 2] = 248;
      img.data[i * 4 + 3] = out ? 150 + hash2(i, 0, 5) * 105 : 0;
    }
    this.snowG.putImageData(img, 0, 0);
  }

  screenToWorld(cam, sx, sy) {
    return { x: (sx - this.cssW / 2) / cam.z + cam.x, y: (sy - this.cssH / 2) / cam.z + cam.y };
  }

  pawnPos(p, dt) {
    let tx = p.x, ty = p.y;
    if (p.path && p.pathI < p.path.length) {
      const n = p.path[p.pathI];
      const nx = n % this.w.W, ny = (n / this.w.W) | 0;
      tx += (nx - p.x) * p.moveT;
      ty += (ny - p.y) * p.moveT;
    }
    if (p.carriedBy) {
      const c = this.vis.get(p.carriedBy);
      if (c) return { x: c.x + 0.25, y: c.y - 0.1 };
    }
    let v = this.vis.get(p.id);
    if (!v || Math.abs(v.x - tx) + Math.abs(v.y - ty) > 3) {
      v = { x: tx, y: ty };
      this.vis.set(p.id, v);
    } else {
      const k = Math.min(1, dt * 16);
      v.x += (tx - v.x) * k;
      v.y += (ty - v.y) * k;
    }
    return v;
  }

  // ---------- кадр ----------
  frame(cam, st, dt) {
    const w = this.w, g = this.g;
    this.time += dt;
    w.ensureRooms();
    w.ensureZones();
    this.flushDirty();
    const z = cam.z, W = w.W;
    const cw = this.cssW, ch = this.cssH;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.fillStyle = "#0b0d10";
    g.fillRect(0, 0, cw, ch);
    const ox = cw / 2 - cam.x * z, oy = ch / 2 - cam.y * z;
    const vx0 = Math.max(0, Math.floor(-ox / z) - 1), vy0 = Math.max(0, Math.floor(-oy / z) - 1);
    const vx1 = Math.min(W - 1, Math.ceil((cw - ox) / z) + 1), vy1 = Math.min(w.H - 1, Math.ceil((ch - oy) / z) + 2);
    const sx = (x) => ox + x * z, sy = (y) => oy + y * z;

    // местность
    g.imageSmoothingEnabled = z < TEX * 1.4;
    g.drawImage(this.static, vx0 * TEX, vy0 * TEX, (vx1 - vx0 + 1) * TEX, (vy1 - vy0 + 1) * TEX, sx(vx0), sy(vy0), (vx1 - vx0 + 1) * z, (vy1 - vy0 + 1) * z);
    g.imageSmoothingEnabled = true;

    // снег
    if (w.snow > 0.03) {
      this.updateSnowMask();
      g.globalAlpha = Math.min(0.85, w.snow * 0.85);
      g.drawImage(this.snowMask, vx0, vy0, vx1 - vx0 + 1, vy1 - vy0 + 1, sx(vx0), sy(vy0), (vx1 - vx0 + 1) * z, (vy1 - vy0 + 1) * z);
      g.globalAlpha = 1;
    }

    // зоны
    for (let y = vy0; y <= vy1; y++)
      for (let x = vx0; x <= vx1; x++) {
        const i = y * W + x;
        const zid = w.zone[i];
        if (!zid) continue;
        const zz = w.zones.get(zid);
        if (!zz) continue;
        const stock = zz.type === "stock";
        const sel = st.sel && st.sel.zone === zid;
        g.fillStyle = stock ? (sel ? "rgba(240,210,90,0.32)" : "rgba(230,200,90,0.16)") : sel ? "rgba(110,220,110,0.32)" : "rgba(110,210,100,0.14)";
        g.fillRect(sx(x), sy(y), z, z);
        g.fillStyle = stock ? "rgba(240,210,90,0.75)" : "rgba(120,230,110,0.7)";
        const bw = Math.max(1, z * 0.06);
        if (y === 0 || w.zone[i - W] !== zid) g.fillRect(sx(x), sy(y), z, bw);
        if (y === w.H - 1 || w.zone[i + W] !== zid) g.fillRect(sx(x), sy(y + 1) - bw, z, bw);
        if (x === 0 || w.zone[i - 1] !== zid) g.fillRect(sx(x), sy(y), bw, z);
        if (x === W - 1 || w.zone[i + 1] !== zid) g.fillRect(sx(x + 1) - bw, sy(y), bw, z);
      }

    // кровь
    for (const f of w.fx) {
      if (f.k !== "blood") continue;
      if (f.x < vx0 - 1 || f.x > vx1 + 1 || f.y < vy0 - 1 || f.y > vy1 + 1) continue;
      g.fillStyle = `rgba(110,10,14,${Math.min(0.7, f.t / 300)})`;
      g.beginPath();
      g.ellipse(sx(f.x + 0.5), sy(f.y + 0.75), z * 0.16, z * 0.08, 0, 0, Math.PI * 2);
      g.fill();
    }

    // объекты построчно (высокие деревья перекрывают ряд выше)
    const tick = w.tick;
    const pawnCells = new Set();
    for (const p of w.pawns) if (!p.dead && !p.despawned) pawnCells.add(p.y * W + p.x);
    const snowy = w.snow > 0.35;
    for (let y = vy0; y <= vy1; y++) {
      for (let x = vx0; x <= vx1; x++) {
        const i = y * W + x;
        const X = sx(x), Y = sy(y);
        const fb = w.fgrid[i] ? w.buildings.get(w.fgrid[i]) : null;
        if (fb) {
          g.fillStyle = "rgba(90,160,255,0.28)";
          g.fillRect(X + 1, Y + 1, z - 2, z - 2);
          g.strokeStyle = "rgba(150,200,255,0.7)";
          g.lineWidth = 1;
          g.strokeRect(X + 1.5, Y + 1.5, z - 3, z - 3);
        }
        const b = w.bgrid[i] ? w.buildings.get(w.bgrid[i]) : null;
        if (b) this.drawBuilding(b, X, Y, z, i, pawnCells);
        let pl = w.plant[i];
        const it = w.igrid[i] ? w.items.get(w.igrid[i]) : null;
        // при сильном отдалении мелкую траву не рисуем — экономим кадр
        if (pl && z < 12 && PLANTS[pl].small) pl = 0;
        if (pl) {
          const gr = w.growth[i];
          const stage = gr >= 1 ? 3 : gr >= 0.65 ? 2 : gr >= 0.3 ? 1 : 0;
          const spr = plantSprite(pl, stage, snowy && w.room[i] < 0);
          const h = (spr.height / spr.width) * z;
          if (it && !PLANTS[pl].tree) g.globalAlpha = 0.55;
          g.drawImage(spr, X, Y + z - h, z, h);
          g.globalAlpha = 1;
        }
        if (it) {
          g.drawImage(itemSprite(it.def), X + z * 0.12, Y + z * 0.12, z * 0.76, z * 0.76);
          if (it.count > 1 && z >= 20) this.label(String(it.count), X + z * 0.96, Y + z * 0.95, z * 0.3, "right");
        }
        const ds = w.desig[i];
        if (ds && z >= 10) {
          const k = ds & DESIG.MINE ? "mine" : ds & DESIG.CUT ? "cut" : "harvest";
          g.globalAlpha = 0.85;
          g.drawImage(iconSprite(k), X + z * 0.3, Y + z * 0.3, z * 0.4, z * 0.4);
          g.globalAlpha = 1;
        }
      }
    }

    // поселенцы
    const order = w.pawns.filter((p) => !p.despawned && p.x >= vx0 - 2 && p.x <= vx1 + 2 && p.y >= vy0 - 2 && p.y <= vy1 + 2);
    order.sort((a, b) => (a.dead ? -1 : 0) - (b.dead ? -1 : 0) || a.y - b.y);
    for (const p of order) this.drawPawn(p, sx, sy, z, dt, st);

    // выстрелы и эффекты
    for (const f of w.fx) {
      if (f.k === "shot") {
        const a = Math.min(1, f.t / 4);
        g.strokeStyle = `rgba(255,236,170,${a})`;
        g.lineWidth = Math.max(1.5, z * 0.05);
        g.beginPath();
        g.moveTo(sx(f.x0 + 0.5), sy(f.y0 + 0.4));
        g.lineTo(sx(f.x1 + 0.5), sy(f.y1 + 0.4));
        g.stroke();
        if (f.t >= 4) {
          g.fillStyle = "rgba(255,220,120,0.9)";
          g.beginPath();
          g.arc(sx(f.x0 + 0.5), sy(f.y0 + 0.4), z * 0.14, 0, Math.PI * 2);
          g.fill();
        }
      } else if (f.k === "swing") {
        g.strokeStyle = `rgba(255,255,255,${f.t / 6})`;
        g.lineWidth = Math.max(1.5, z * 0.06);
        const ang = Math.atan2(f.y1 - f.y, f.x1 - f.x);
        g.beginPath();
        g.arc(sx(f.x + 0.5), sy(f.y + 0.5), z * 0.6, ang - 0.7, ang + 0.7);
        g.stroke();
      } else if (f.k === "pod") {
        const X = sx(f.x + 0.5), Y = sy(f.y + 0.5);
        if (f.t > 30) {
          const h = (f.t - 30) * 0.35 * z;
          g.strokeStyle = "rgba(255,170,60,0.6)";
          g.lineWidth = z * 0.25;
          g.beginPath();
          g.moveTo(X + h * 0.5, Y - h - z * 2);
          g.lineTo(X + h * 0.5 - z * 0.3, Y - h);
          g.stroke();
          g.fillStyle = "#ffd27a";
          g.beginPath();
          g.arc(X + h * 0.5 - z * 0.3, Y - h, z * 0.3, 0, Math.PI * 2);
          g.fill();
        } else {
          g.strokeStyle = `rgba(255,220,160,${f.t / 30})`;
          g.lineWidth = z * 0.12;
          g.beginPath();
          g.arc(X, Y, (30 - f.t) * z * 0.08, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }

    this.drawLighting(sx, sy, z, vx0, vy0, vx1, vy1);
    this.drawWeather(dt);
    this.drawOverlay(st, sx, sy, z);
  }

  drawBuilding(b, X, Y, z, i, pawnCells) {
    const w = this.w, g = this.g, W = w.W;
    const d = BUILDINGS[b.def];
    if (!b.complete) {
      g.globalAlpha = 0.5;
      if (d.wall) {
        g.fillStyle = "rgba(90,160,255,0.45)";
        g.fillRect(X + 1, Y + 1, z - 2, z - 2);
      } else g.drawImage(buildingSprite(b.def), X, Y, z, z);
      g.globalAlpha = 1;
      g.strokeStyle = "rgba(150,200,255,0.9)";
      g.lineWidth = 1;
      g.setLineDash([z * 0.15, z * 0.1]);
      g.strokeRect(X + 1.5, Y + 1.5, z - 3, z - 3);
      g.setLineDash([]);
      if (b.work > 0) this.bar(X + z * 0.1, Y + z * 0.82, z * 0.8, b.work / d.work, "#7ac0ff");
      return;
    }
    if (d.wall) {
      const same = (j) => {
        const o = w.bgrid[j] ? w.buildings.get(w.bgrid[j]) : null;
        return (o && o.complete && BUILDINGS[o.def].wall) || w.rock[j];
      };
      const y = (i / W) | 0, x = i % W;
      g.drawImage(wallTexture(b.def), X, Y, z, z);
      const up = y > 0 && same(i - W), down = y < w.H - 1 && same(i + W);
      const left = x > 0 && same(i - 1), right = x < W - 1 && same(i + 1);
      if (!up) {
        g.fillStyle = "rgba(255,255,255,0.18)";
        g.fillRect(X, Y, z, z * 0.12);
      }
      if (!down) {
        g.fillStyle = "rgba(0,0,0,0.38)";
        g.fillRect(X, Y + z * 0.72, z, z * 0.28);
      }
      g.fillStyle = "rgba(20,14,10,0.85)";
      const lw = Math.max(1, z * 0.04);
      if (!up) g.fillRect(X, Y, z, lw);
      if (!down) g.fillRect(X, Y + z - lw, z, lw);
      if (!left) g.fillRect(X, Y, lw, z);
      if (!right) g.fillRect(X + z - lw, Y, lw, z);
    } else if (d.door) {
      g.drawImage(buildingSprite("door", pawnCells.has(i) ? "open" : ""), X, Y, z, z);
    } else if (d.bed) {
      g.drawImage(buildingSprite("bed", b.forPrisoner ? "#c8782a" : ""), X, Y, z, z);
    } else {
      g.drawImage(buildingSprite(b.def), X, Y, z, z);
    }
    if (d.fuel && b.fuel > 0 && b.on) this.flame(X + z / 2, Y + z * (b.def === "torch" ? 0.28 : b.def === "campfire" ? 0.5 : 0.62), z * (b.def === "heater" ? 0.22 : b.def === "stove" ? 0.12 : 0.3), b.id);
    if (b.def === "torch") this.flame(X + z / 2, Y + z * 0.28, z * 0.22, b.id);
    if (d.turret) {
      const a = b.aim ? Math.atan2(b.aim.y - b.y, b.aim.x - b.x) : this.time * 0.5 + b.id;
      g.save();
      g.translate(X + z / 2, Y + z / 2);
      g.rotate(a);
      g.fillStyle = "#3a3f45";
      g.strokeStyle = "#1e1a16";
      g.lineWidth = Math.max(1, z * 0.04);
      g.fillRect(0, -z * 0.07, z * 0.48, z * 0.14);
      g.strokeRect(0, -z * 0.07, z * 0.48, z * 0.14);
      g.restore();
    }
    if (b.hp < d.hp && d.hp) this.bar(X + z * 0.1, Y + z * 0.86, z * 0.8, b.hp / d.hp, "#e05a4a");
    if (b.deconstruct) {
      g.globalAlpha = 0.9;
      g.drawImage(iconSprite("decon"), X + z * 0.3, Y + z * 0.3, z * 0.4, z * 0.4);
      g.globalAlpha = 1;
    }
  }

  flame(x, y, r, seed) {
    const g = this.g, t = this.time * 9 + seed;
    const f = 1 + Math.sin(t) * 0.08 + Math.sin(t * 2.3) * 0.06;
    g.fillStyle = "rgba(255,120,30,0.85)";
    g.beginPath();
    g.ellipse(x, y - r * 0.3, r * 0.6, r * 0.9 * f, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,210,80,0.95)";
    g.beginPath();
    g.ellipse(x, y - r * 0.15, r * 0.35, r * 0.55 * f, 0, 0, Math.PI * 2);
    g.fill();
  }

  bar(x, y, wdt, frac, color) {
    const g = this.g;
    const h = Math.max(2, wdt * 0.09);
    g.fillStyle = "rgba(0,0,0,0.6)";
    g.fillRect(x - 1, y - 1, wdt + 2, h + 2);
    g.fillStyle = color;
    g.fillRect(x, y, wdt * Math.max(0, Math.min(1, frac)), h);
  }

  label(text, x, y, size, align = "center", color = "#fff") {
    const g = this.g;
    g.font = `600 ${Math.max(9, Math.min(15, size))}px system-ui, sans-serif`;
    g.textAlign = align;
    g.textBaseline = "alphabetic";
    g.lineWidth = 3;
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.strokeText(text, x, y);
    g.fillStyle = color;
    g.fillText(text, x, y);
  }

  drawPawn(p, sx, sy, z, dt, st) {
    const g = this.g, w = this.w;
    const v = this.pawnPos(p, dt);
    const cx = sx(v.x + 0.5), cy = sy(v.y + 0.5);
    const selected = st.sel && st.sel.pawn === p.id;
    const human = p.kind !== "animal";
    if (selected) {
      g.strokeStyle = "#ffd84a";
      g.lineWidth = Math.max(1.5, z * 0.06);
      g.beginPath();
      g.ellipse(cx, cy + z * 0.32, z * 0.42, z * 0.16, 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (p.drafted) {
      g.strokeStyle = "rgba(255,140,60,0.9)";
      g.lineWidth = Math.max(1, z * 0.04);
      g.beginPath();
      g.ellipse(cx, cy + z * 0.32, z * 0.34, z * 0.12, 0, 0, Math.PI * 2);
      g.stroke();
    }
    if (p.huntDesig && !p.dead) g.drawImage(iconSprite("hunt"), cx - z * 0.2, cy - z * 0.95, z * 0.4, z * 0.4);
    if (p.captureDesig && !p.dead) g.drawImage(iconSprite("capture"), cx - z * 0.2, cy - z * 0.95, z * 0.4, z * 0.4);
    if (p.dead) g.globalAlpha = 0.75;
    const lying = p.downed || p.dead;
    const inBed = p.inBed && (p.sleeping || p.downed) && !p.carriedBy;
    if (!human) drawAnimal(g, p, cx, cy, z, lying);
    else if (inBed) {
      const b = w.buildings.get(p.inBed);
      const bx = b ? sx(b.x + 0.5) : cx, by = b ? sy(b.y + 0.5) : cy;
      drawHuman(g, p, bx, by - z * 0.05, z * 0.85, { headOnly: true, sleeping: p.sleeping || p.downed });
    } else {
      const shirt = p.kind === "prisoner" ? "#d8822a" : null;
      drawHuman(g, p, cx, cy, z, { lying, sleeping: p.sleeping || lying, shirt, hat: p.kind === "trader" && p.role === "trader" ? "#5a4030" : p.kind === "raider" ? null : null });
      const showWeapon = !lying && p.weapon && p.weapon !== "fists" && (p.drafted || p.kind === "raider" || p.role === "guard" || (p.aim && p.aim.until > w.tick) || (p.job && p.job.type === "hunt"));
      if (showWeapon) {
        const ang = p.aim && p.aim.until > w.tick ? Math.atan2(p.aim.y - p.y, p.aim.x - p.x) : p.facing > 0 ? 0.3 : Math.PI - 0.3;
        drawWeaponHeld(g, p.weapon, cx + Math.cos(ang) * z * 0.22, cy + z * 0.12 + Math.sin(ang) * z * 0.12, z, ang);
      }
      if (p.carry) g.drawImage(itemSprite(p.carry.def), cx + (p.facing || 1) * z * 0.12 - z * 0.2, cy - z * 0.02, z * 0.4, z * 0.4);
    }
    g.globalAlpha = 1;
    if (p.dead) return;
    // полоски и подписи
    if (p.hp < p.maxHp - 0.5) this.bar(cx - z * 0.3, cy - z * 0.62, z * 0.6, p.hp / p.maxHp, p.bleed > 0 ? "#e05a4a" : "#7ad06a");
    if (p.job && p.working && z >= 14) {
      const j = p.job;
      let frac = null;
      const b = p.working > 0 ? w.buildings.get(p.working) : null;
      if (j.type === "build" && b) frac = b.work / BUILDINGS[b.def].work;
      else if (j.work != null && j.type === "mine") frac = j.work / ROCKS[w.rock[j.cell]]?.work;
      if (frac != null && isFinite(frac)) this.bar(cx - z * 0.3, cy - z * 0.72, z * 0.6, frac, "#e8d070");
    }
    if (p.sleeping && !p.downed) this.label("z", cx + z * 0.3, cy - z * 0.45 - (this.time * 6 % 6), z * 0.35, "center", "#cfe0ff");
    if (p.mental) this.label("?!", cx, cy - z * 0.62, z * 0.4, "center", "#ff8a6a");
    if (z >= 22 && (human || selected)) {
      const col = p.faction === "hostile" ? "#ff8a7a" : p.kind === "prisoner" ? "#ffb05a" : p.kind === "trader" ? "#8ad0ff" : p.kind === "animal" ? "#d8d0c0" : "#ffffff";
      this.label(p.short || p.name, cx, cy + z * 0.62, z * 0.3, "center", col);
    }
  }

  drawLighting(sx, sy, z, vx0, vy0, vx1, vy1) {
    const w = this.w;
    let dark = (1 - w.daylight()) * 0.6;
    if (w.weather.kind === "rain" || w.weather.kind === "snow") dark += 0.06;
    if (dark < 0.02) return;
    const lg = this.lg, L = this.light;
    const k = L.width / this.cssW;
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, L.width, L.height);
    lg.fillStyle = `rgba(6,10,30,${dark})`;
    lg.fillRect(0, 0, L.width, L.height);
    lg.globalCompositeOperation = "destination-out";
    const lights = [];
    for (const b of w.buildings.values()) {
      const d = BUILDINGS[b.def];
      if (!d.light || !b.complete) continue;
      if (d.fuel && (!b.on || b.fuel <= 0)) continue;
      if (b.x < vx0 - 8 || b.x > vx1 + 8 || b.y < vy0 - 8 || b.y > vy1 + 8) continue;
      const fl = 1 + Math.sin(this.time * 11 + b.id) * 0.03;
      const r = d.light * z * fl;
      const x = sx(b.x + 0.5), y = sy(b.y + 0.5);
      lights.push([x, y, r]);
      const grd = lg.createRadialGradient(x * k, y * k, 0, x * k, y * k, r * k);
      grd.addColorStop(0, "rgba(0,0,0,1)");
      grd.addColorStop(0.55, "rgba(0,0,0,0.8)");
      grd.addColorStop(1, "rgba(0,0,0,0)");
      lg.fillStyle = grd;
      lg.beginPath();
      lg.arc(x * k, y * k, r * k, 0, Math.PI * 2);
      lg.fill();
    }
    const g = this.g;
    g.drawImage(L, 0, 0, this.cssW, this.cssH);
    g.globalCompositeOperation = "lighter";
    for (const [x, y, r] of lights) {
      const grd = g.createRadialGradient(x, y, 0, x, y, r * 0.8);
      grd.addColorStop(0, `rgba(255,150,60,${0.22 * dark})`);
      grd.addColorStop(1, "rgba(255,150,60,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = "source-over";
  }

  drawWeather(dt) {
    const w = this.w, g = this.g;
    const kind = w.weather.kind;
    const cw = this.cssW, ch = this.cssH;
    if (kind === "fog") {
      g.fillStyle = "rgba(200,206,212,0.2)";
      g.fillRect(0, 0, cw, ch);
    }
    const want = kind === "rain" ? 110 : kind === "snow" ? 90 : 0;
    const ps = this.particles;
    while (ps.length < want) ps.push({ x: Math.random() * cw, y: Math.random() * ch, s: 0.6 + Math.random() * 0.8 });
    if (ps.length > want) ps.length = want;
    if (!want) return;
    if (kind === "rain") {
      g.strokeStyle = "rgba(180,200,230,0.45)";
      g.lineWidth = 1;
      g.beginPath();
      for (const p of ps) {
        p.x += -120 * dt * p.s;
        p.y += 620 * dt * p.s;
        if (p.y > ch) { p.y -= ch + 20; p.x = Math.random() * (cw + 100); }
        if (p.x < -20) p.x += cw + 40;
        g.moveTo(p.x, p.y);
        g.lineTo(p.x + 3, p.y - 12 * p.s);
      }
      g.stroke();
    } else {
      g.fillStyle = "rgba(255,255,255,0.85)";
      for (const p of ps) {
        p.x += Math.sin(this.time * 2 + p.s * 10) * 20 * dt;
        p.y += 45 * dt * p.s;
        if (p.y > ch) { p.y -= ch + 10; p.x = Math.random() * cw; }
        g.fillRect(p.x, p.y, 2.2 * p.s, 2.2 * p.s);
      }
    }
  }

  drawOverlay(st, sx, sy, z) {
    const g = this.g, w = this.w;
    const m = this.marker;
    if (m && m.t > 0) {
      m.t -= 1 / 60;
      const k = Math.max(0, m.t / 0.6);
      g.strokeStyle = `rgba(255,216,74,${k})`;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx(m.x + 0.5), sy(m.y + 0.5), z * (0.2 + (1 - k) * 0.4), 0, Math.PI * 2);
      g.stroke();
    }
    if (st.preview) {
      for (const c of st.preview.cells) {
        const X = sx(c.x), Y = sy(c.y);
        g.fillStyle = c.ok ? "rgba(90,230,130,0.32)" : "rgba(240,80,70,0.38)";
        g.fillRect(X, Y, z, z);
        if (c.ok && st.preview.def && !BUILDINGS[st.preview.def].wall && !BUILDINGS[st.preview.def].floor) {
          g.globalAlpha = 0.55;
          g.drawImage(buildingSprite(st.preview.def), X, Y, z, z);
          g.globalAlpha = 1;
        }
      }
    }
    if (st.rect) {
      const { x0, y0, x1, y1 } = st.rect;
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = 1.5;
      g.setLineDash([6, 4]);
      g.strokeRect(sx(Math.min(x0, x1)), sy(Math.min(y0, y1)), (Math.abs(x1 - x0) + 1) * z, (Math.abs(y1 - y0) + 1) * z);
      g.setLineDash([]);
    }
    const sel = st.sel;
    if (sel && sel.cell != null && sel.pawn == null) {
      const x = sel.cell % w.W, y = (sel.cell / w.W) | 0;
      const X = sx(x), Y = sy(y), k = z * 0.28;
      g.strokeStyle = "#ffd84a";
      g.lineWidth = Math.max(1.5, z * 0.06);
      g.beginPath();
      for (const [ax, ay, dx, dy] of [[X, Y, 1, 1], [X + z, Y, -1, 1], [X, Y + z, 1, -1], [X + z, Y + z, -1, -1]]) {
        g.moveTo(ax + dx * k, ay);
        g.lineTo(ax, ay);
        g.lineTo(ax, ay + dy * k);
      }
      g.stroke();
    }
  }
}

export { TEX, ITEMS, PLANTS };
