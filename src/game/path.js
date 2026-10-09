// A* по сетке с 8 направлениями. Без срезания углов у стен.
// mode: 0 — колонист (двери открываются), 1 — враг (двери дорогие: их придётся ломать), 2 — дикое животное (двери закрыты)
const SQ2 = Math.SQRT2;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export class PathFinder {
  constructor(w) {
    this.w = w;
    const N = w.N;
    this.g = new Float32Array(N);
    this.came = new Int32Array(N);
    this.seen = new Uint32Array(N);
    this.closed = new Uint32Array(N);
    this.gen = 0;
    this.cap = N * 8;
    this.hi = new Int32Array(this.cap);
    this.hf = new Float32Array(this.cap);
    this.hs = 0;
  }

  push(i, f) {
    let k = this.hs++;
    const hi = this.hi, hf = this.hf;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hf[p] <= f) break;
      hi[k] = hi[p];
      hf[k] = hf[p];
      k = p;
    }
    hi[k] = i;
    hf[k] = f;
  }

  pop() {
    const hi = this.hi, hf = this.hf;
    const top = hi[0];
    const n = --this.hs;
    if (n > 0) {
      const li = hi[n], lf = hf[n];
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= n) break;
        if (c + 1 < n && hf[c + 1] < hf[c]) c++;
        if (hf[c] >= lf) break;
        hi[k] = hi[c];
        hf[k] = hf[c];
        k = c;
      }
      hi[k] = li;
      hf[k] = lf;
    }
    return top;
  }

  find(sx, sy, tx, ty, goal = "on", mode = 0, maxNodes = Infinity) {
    const w = this.w, W = w.W, H = w.H, cost = w.cost, door = w.doorMask;
    const start = sy * W + sx;
    const goalR = goal === "on" ? 0 : 1;
    const isGoal = (x, y) => {
      const d = Math.max(Math.abs(x - tx), Math.abs(y - ty));
      return goal === "on" ? d === 0 : goal === "adj" ? d === 1 : d <= 1;
    };
    if (isGoal(sx, sy)) return [];
    const h = (x, y) => {
      const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
      const d = dx + dy + (SQ2 - 2) * Math.min(dx, dy) - goalR;
      return d > 0 ? d * 0.8 : 0;
    };
    const gen = ++this.gen;
    const g = this.g, came = this.came, seen = this.seen, closed = this.closed;
    this.hs = 0;
    g[start] = 0;
    seen[start] = gen;
    came[start] = -1;
    this.push(start, h(sx, sy));
    let expanded = 0;
    while (this.hs > 0) {
      const i = this.pop();
      if (closed[i] === gen) continue;
      closed[i] = gen;
      const x = i % W, y = (i / W) | 0;
      if (isGoal(x, y)) {
        const out = [];
        let c = i;
        while (c !== start && c !== -1) {
          out.push(c);
          c = came[c];
        }
        out.reverse();
        return out;
      }
      if (++expanded > maxNodes) return null;
      const gi = g[i];
      for (let d = 0; d < 8; d++) {
        const nx = x + DX[d], ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (closed[j] === gen) continue;
        let c = cost[j];
        if (c <= 0) continue;
        if (door[j]) {
          if (mode === 2) continue;
          if (mode === 1) c += 6;
        }
        if (d >= 4) {
          // диагональ: обе соседние ортогональные клетки должны быть проходимы
          const a = y * W + nx, b = ny * W + x;
          if (cost[a] <= 0 || cost[b] <= 0) continue;
          if (mode === 2 && (door[a] || door[b])) continue;
          c *= SQ2;
        }
        const ng = gi + c;
        if (seen[j] !== gen || ng < g[j]) {
          seen[j] = gen;
          g[j] = ng;
          came[j] = i;
          if (this.hs < this.cap) this.push(j, ng + h(nx, ny));
        }
      }
    }
    return null;
  }
}
