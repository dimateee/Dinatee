// Процедурные спрайты: всё рисуется кодом, без файлов картинок
import { PLANTS, ITEMS, BUILDINGS, ANIMALS } from "../game/defs.js";

export const S = 64; // разрешение спрайта на клетку
const cache = new Map();

function mk(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
export function cached(key, w, h, draw) {
  let c = cache.get(key);
  if (!c) {
    c = mk(w, h);
    const g = c.getContext("2d");
    g.lineJoin = "round";
    g.lineCap = "round";
    draw(g, w, h);
    cache.set(key, c);
  }
  return c;
}

const OUT = "#1e1a16";
function blob(g, x, y, r, fill, stroke = OUT, lw = 3) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.lineWidth = lw;
    g.strokeStyle = stroke;
    g.stroke();
  }
}
function rrect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function shape(g, fill, stroke = OUT, lw = 3) {
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.lineWidth = lw;
    g.strokeStyle = stroke;
    g.stroke();
  }
}
// детерминированный «рандом» для украшений
function hr(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------- Растения ----------------
// холст 64×96: низ спрайта совпадает с низом клетки
export function plantSprite(id, stage, snow) {
  const d = PLANTS[id];
  const tall = d.tree;
  return cached(`pl${id}_${stage}_${snow ? 1 : 0}`, S, tall ? S * 1.6 : S, (g, w, h) => {
    const k = [0.45, 0.65, 0.85, 1][stage];
    g.translate(w / 2, h - 6);
    switch (d.id) {
      case "tree": drawOak(g, k, snow); break;
      case "pine": drawPine(g, k, snow); break;
      case "bush": drawBush(g, k, stage === 3); break;
      case "grass": drawGrass(g, k); break;
      case "rice": drawRice(g, k, stage === 3); break;
      case "potato": drawPotato(g, k, stage === 3); break;
      case "corn": drawCorn(g, k, stage === 3); break;
      case "healroot": drawHealroot(g, k, stage === 3); break;
    }
  });
}
function drawOak(g, k, snow) {
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(0, -2, 22 * k, 7 * k, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-5 * k, 0);
  g.lineTo(-4 * k, -34 * k);
  g.lineTo(4 * k, -34 * k);
  g.lineTo(5 * k, 0);
  g.closePath();
  shape(g, "#6b4426");
  const c = [[-14, -48, 16], [13, -50, 16], [0, -64, 19], [-6, -42, 14], [8, -40, 14]];
  for (const [x, y, r] of c) blob(g, x * k, y * k, r * k, "#3d6b2c", OUT, 3);
  for (const [x, y, r] of c) blob(g, x * k, y * k, r * k - 2, "#4b8233", null);
  for (const [x, y, r] of c) blob(g, x * k - 3 * k, y * k - 4 * k, r * k * 0.45, "#64a043", null);
  if (snow) for (const [x, y, r] of c) {
    g.beginPath();
    g.ellipse(x * k, y * k - r * k * 0.55, r * k * 0.7, r * k * 0.35, 0, Math.PI, 0);
    g.fillStyle = "#eef3f6";
    g.fill();
  }
}
function drawPine(g, k, snow) {
  g.fillStyle = "rgba(0,0,0,0.22)";
  g.beginPath();
  g.ellipse(0, -2, 16 * k, 6 * k, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5a3a22";
  g.fillRect(-4 * k, -16 * k, 8 * k, 16 * k);
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.strokeRect(-4 * k, -16 * k, 8 * k, 16 * k);
  const tiers = [[-12, 24, 26], [-32, 20, 24], [-50, 15, 22]];
  for (const [y, half, ht] of tiers) {
    g.beginPath();
    g.moveTo(-half * k, y * k);
    g.lineTo(0, (y - ht) * k);
    g.lineTo(half * k, y * k);
    g.closePath();
    shape(g, "#2f5b3b");
    g.beginPath();
    g.moveTo(-half * k * 0.55, (y - 3) * k);
    g.lineTo(-2 * k, (y - ht + 6) * k);
    g.lineTo(-half * k * 0.1, (y - 3) * k);
    g.closePath();
    g.fillStyle = "#417a4f";
    g.fill();
    if (snow) {
      g.beginPath();
      g.moveTo(-half * k * 0.5, (y - ht * 0.5) * k);
      g.lineTo(0, (y - ht) * k);
      g.lineTo(half * k * 0.5, (y - ht * 0.5) * k);
      g.closePath();
      g.fillStyle = "#eef3f6";
      g.fill();
    }
  }
}
function drawBush(g, k, ripe) {
  const c = [[-10, -12, 12], [9, -13, 12], [0, -22, 13]];
  for (const [x, y, r] of c) blob(g, x * k, y * k, r * k, "#3f6e2e");
  for (const [x, y, r] of c) blob(g, x * k - 2, y * k - 3, r * k * 0.5, "#568f3c", null);
  if (ripe) for (let i = 0; i < 9; i++) blob(g, (hr(i) * 30 - 15) * k, (-6 - hr(i + 9) * 22) * k, 3.2, "#c8344a", "#5a1020", 1.5);
}
function drawGrass(g, k) {
  g.strokeStyle = "#5e8a34";
  g.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const x = (hr(i) * 36 - 18) * k;
    g.beginPath();
    g.moveTo(x, 0);
    g.quadraticCurveTo(x + (hr(i + 3) - 0.5) * 10, -10 * k, x + (hr(i + 7) - 0.5) * 14, (-14 - hr(i + 1) * 10) * k);
    g.stroke();
  }
  g.strokeStyle = "#7eae49";
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const x = (hr(i + 20) * 30 - 15) * k;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (hr(i + 30) - 0.5) * 8, (-12 - hr(i + 40) * 8) * k);
    g.stroke();
  }
}
function drawRice(g, k, ripe) {
  for (let i = 0; i < 9; i++) {
    const x = ((i % 3) - 1) * 15 + (hr(i) - 0.5) * 4;
    const y = -Math.floor(i / 3) * 14;
    g.strokeStyle = ripe ? "#9a8a3a" : "#4f8a34";
    g.lineWidth = 2.5;
    for (let s = -1; s <= 1; s++) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + s * 3, y - 10 * k, x + s * 6 + 2, y - 20 * k);
      g.stroke();
      if (ripe) blob(g, x + s * 6 + 2, y - 20 * k, 2.6, "#e5cf72", null);
    }
  }
}
function drawPotato(g, k, ripe) {
  for (let i = 0; i < 4; i++) {
    const x = ((i % 2) - 0.5) * 26, y = -6 - Math.floor(i / 2) * 22;
    for (let l = 0; l < 5; l++) {
      const a = (l / 5) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 6 * k, y + Math.sin(a) * 4 * k - 4, 6 * k, 3.5 * k, a, 0, Math.PI * 2);
      shape(g, ripe ? "#3e6b2a" : "#5a9a3a", OUT, 1.5);
    }
    if (ripe) blob(g, x, y - 5, 2.6, "#e9e2f5", null);
  }
}
function drawCorn(g, k, ripe) {
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 16;
    g.strokeStyle = OUT;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, -46 * k);
    g.stroke();
    g.strokeStyle = "#5f9a3a";
    g.lineWidth = 3;
    g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(x, -18 * k);
      g.quadraticCurveTo(x + s * 10, -24 * k, x + s * 14, -16 * k);
      g.strokeStyle = "#4e8a32";
      g.stroke();
    }
    if (ripe) {
      g.beginPath();
      g.ellipse(x + 4, -30 * k, 3.5, 8, 0.3, 0, Math.PI * 2);
      shape(g, "#e8c440", OUT, 1.5);
    }
  }
}
function drawHealroot(g, k, ripe) {
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 16, y = -8 - (i % 2) * 14;
    for (let l = 0; l < 6; l++) {
      const a = (l / 6) * Math.PI * 2;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 5 * k, y + Math.sin(a) * 3 * k, 5 * k, 2.5 * k, a, 0, Math.PI * 2);
      shape(g, "#4a8a5a", OUT, 1.3);
    }
    if (ripe) blob(g, x, y - 4, 3.4, "#7a7ae8", "#2a2a6a", 1.5);
  }
}

// ---------------- Предметы ----------------
export function itemSprite(def) {
  return cached("it_" + def, S, S, (g, w) => {
    g.translate(w / 2, w / 2);
    const d = ITEMS[def];
    if (d && d.weapon) return drawWeapon(g, d.weapon);
    (ITEM_DRAW[def] || drawCrate)(g);
  });
}
function drawCrate(g) {
  rrect(g, -16, -14, 32, 28, 3);
  shape(g, "#8a6a40");
}
const ITEM_DRAW = {
  wood(g) {
    for (const [x, y] of [[-8, 8], [8, 8], [0, -4]]) {
      rrect(g, x - 15, y - 6, 30, 12, 5);
      shape(g, "#8a5a32");
      blob(g, x + 13, y, 6, "#c79a62", OUT, 2);
      blob(g, x + 13, y, 2.5, "#9a6a3a", null);
    }
  },
  stone(g) {
    const pts = [[[-18, 10], [-14, -6], [-2, -10], [4, 4], [-6, 14]], [[2, 12], [6, -4], [18, -6], [20, 10]], [[-8, -6], [-4, -18], [10, -16], [8, -4]]];
    for (const p of pts) {
      g.beginPath();
      p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
      shape(g, "#8f8b85");
    }
  },
  steel(g) {
    for (const [x, y] of [[-9, 6], [9, 6], [0, -6]]) {
      g.beginPath();
      g.moveTo(x - 12, y + 6);
      g.lineTo(x - 8, y - 6);
      g.lineTo(x + 8, y - 6);
      g.lineTo(x + 12, y + 6);
      g.closePath();
      shape(g, "#8a98a8");
      g.fillStyle = "#c2ccd6";
      g.fillRect(x - 6, y - 4, 10, 2);
    }
  },
  components(g) {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 13 : 17;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    shape(g, "#c9a43a");
    blob(g, 0, 0, 5, "#5a5040");
  },
  silver(g) {
    for (const [x, y] of [[-8, 6], [6, 8], [0, -4], [10, -6]]) {
      g.beginPath();
      g.ellipse(x, y, 9, 6, 0, 0, Math.PI * 2);
      shape(g, "#d8dde4", OUT, 2);
      g.beginPath();
      g.ellipse(x, y - 1, 5, 3, 0, 0, Math.PI * 2);
      g.strokeStyle = "#a8b0bb";
      g.lineWidth = 1.5;
      g.stroke();
    }
  },
  berries(g) {
    for (let i = 0; i < 10; i++) blob(g, (hr(i) - 0.5) * 26, (hr(i + 5) - 0.5) * 22, 5, i % 3 ? "#c8344a" : "#7a3aa8", OUT, 1.5);
  },
  meat(g) {
    g.beginPath();
    g.moveTo(-16, 4);
    g.quadraticCurveTo(-14, -14, 6, -12);
    g.quadraticCurveTo(20, -8, 16, 8);
    g.quadraticCurveTo(4, 16, -16, 4);
    g.closePath();
    shape(g, "#b8434a");
    g.beginPath();
    g.ellipse(2, -2, 7, 4, 0.3, 0, Math.PI * 2);
    g.fillStyle = "#e88a8a";
    g.fill();
  },
  rice(g) {
    g.beginPath();
    g.ellipse(0, 6, 18, 9, 0, 0, Math.PI * 2);
    shape(g, "#f2ead0");
    for (let i = 0; i < 12; i++) blob(g, (hr(i) - 0.5) * 26, 2 + (hr(i + 9) - 0.5) * 10, 1.8, "#ffffff", null);
  },
  potato(g) {
    for (const [x, y, r] of [[-8, 4, 9], [8, 6, 8], [0, -6, 8]]) {
      g.beginPath();
      g.ellipse(x, y, r * 1.2, r, 0.4, 0, Math.PI * 2);
      shape(g, "#b08a50");
      blob(g, x - 2, y - 2, 1.5, "#7a5a30", null);
    }
  },
  corn(g) {
    for (const [x, a] of [[-6, -0.3], [6, 0.3]]) {
      g.save();
      g.translate(x, 0);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, 7, 17, 0, 0, Math.PI * 2);
      shape(g, "#e8c440");
      g.beginPath();
      g.moveTo(-6, 10);
      g.quadraticCurveTo(-12, -4, -2, -14);
      g.strokeStyle = "#6a9a3a";
      g.lineWidth = 3;
      g.stroke();
      g.restore();
    }
  },
  ration(g) {
    rrect(g, -16, -12, 32, 24, 3);
    shape(g, "#7a7a4a");
    g.fillStyle = "#c8c890";
    g.fillRect(-10, -4, 20, 8);
  },
  meal(g) {
    g.beginPath();
    g.ellipse(0, 4, 19, 11, 0, 0, Math.PI * 2);
    shape(g, "#e8e4da");
    g.beginPath();
    g.ellipse(0, 2, 12, 6, 0, 0, Math.PI * 2);
    g.fillStyle = "#c08040";
    g.fill();
    blob(g, -4, 0, 3, "#6aa043", null);
  },
  finemeal(g) {
    g.beginPath();
    g.ellipse(0, 4, 19, 11, 0, 0, Math.PI * 2);
    shape(g, "#f4f0e6");
    g.beginPath();
    g.ellipse(0, 2, 12, 6, 0, 0, Math.PI * 2);
    g.fillStyle = "#b85a3a";
    g.fill();
    blob(g, -5, -1, 3, "#5aa043", null);
    blob(g, 4, 0, 2.5, "#f0d040", null);
    blob(g, 1, 3, 2.2, "#e84a4a", null);
  },
  medicine(g) {
    rrect(g, -14, -12, 28, 24, 4);
    shape(g, "#f2f2ee");
    g.fillStyle = "#d83a3a";
    g.fillRect(-3, -8, 6, 16);
    g.fillRect(-8, -3, 16, 6);
  },
};
function drawWeapon(g, id) {
  g.rotate(-0.5);
  g.lineCap = "round";
  const line = (x0, y0, x1, y1, w, c) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokeStyle = OUT;
    g.lineWidth = w + 3;
    g.stroke();
    g.strokeStyle = c;
    g.lineWidth = w;
    g.stroke();
  };
  switch (id) {
    case "knife": line(-12, 0, 2, 0, 4, "#5a3a22"); line(2, 0, 16, 0, 5, "#c8ccd0"); break;
    case "club": line(-16, 0, 14, 0, 7, "#7a5030"); blob(g, 14, 0, 6, "#6a4428"); break;
    case "spear": line(-20, 0, 12, 0, 3, "#8a6038"); g.beginPath(); g.moveTo(12, -5); g.lineTo(22, 0); g.lineTo(12, 5); g.closePath(); shape(g, "#c8ccd0", OUT, 2); break;
    case "bow":
      g.beginPath();
      g.arc(-4, 0, 18, -1.2, 1.2);
      g.strokeStyle = OUT;
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = "#9a6a3a";
      g.lineWidth = 3.5;
      g.stroke();
      line(2.5, -16.8, 2.5, 16.8, 1, "#e8e0d0");
      break;
    case "pistol": line(-6, 0, 12, 0, 6, "#4a4e54"); line(-6, 0, -10, 9, 6, "#5a3a22"); break;
    case "rifle": line(-20, 2, 20, -1, 5, "#3e4248"); line(-20, 2, -8, 2, 7, "#6a4428"); break;
    case "smg": line(-12, 0, 16, 0, 7, "#2e3238"); line(0, 0, 0, 10, 5, "#2e3238"); line(-12, 0, -16, 7, 5, "#2e3238"); break;
  }
}

// ---------------- Постройки ----------------
export function buildingSprite(def, variant = "") {
  return cached(`b_${def}_${variant}`, S, S, (g, w) => {
    (B_DRAW[def] || drawCrateB)(g, w, variant);
  });
}
function drawCrateB(g, w) {
  rrect(g, 6, 6, w - 12, w - 12, 4);
  shape(g, "#7a6a50");
}
const B_DRAW = {
  bed(g, w, v) {
    rrect(g, 8, 4, w - 16, w - 8, 5);
    shape(g, "#6b4426");
    rrect(g, 12, 8, w - 24, w - 16, 4);
    shape(g, "#e9e4d8", OUT, 2);
    rrect(g, 15, 11, w - 30, 13, 5);
    shape(g, "#ffffff", OUT, 1.5);
    rrect(g, 12, 28, w - 24, w - 36, 4);
    shape(g, v || "#4a6e9a", OUT, 2);
    g.strokeStyle = "rgba(255,255,255,0.25)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(14, 34);
    g.lineTo(w - 14, 34);
    g.stroke();
  },
  table(g, w) {
    rrect(g, 6, 8, w - 12, w - 16, 4);
    shape(g, "#8a5a32");
    g.strokeStyle = "#6a4022";
    g.lineWidth = 2;
    for (let y = 18; y < w - 10; y += 10) {
      g.beginPath();
      g.moveTo(9, y);
      g.lineTo(w - 9, y);
      g.stroke();
    }
  },
  campfire(g, w) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      blob(g, w / 2 + Math.cos(a) * 20, w / 2 + Math.sin(a) * 18, 6, "#7d7a74", OUT, 2);
    }
    g.save();
    g.translate(w / 2, w / 2);
    for (const a of [0.6, -0.6, 1.6]) {
      g.save();
      g.rotate(a);
      rrect(g, -15, -4, 30, 8, 3);
      shape(g, "#5a3a22", OUT, 2);
      g.restore();
    }
    g.restore();
    blob(g, w / 2, w / 2, 7, "#2a2018", null);
  },
  torch(g, w) {
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(w / 2, w - 12, 10, 4, 0, 0, Math.PI * 2);
    g.fill();
    rrect(g, w / 2 - 4, 22, 8, w - 34, 2);
    shape(g, "#6b4426", OUT, 2);
    rrect(g, w / 2 - 6, 18, 12, 8, 2);
    shape(g, "#3a2a1a", OUT, 2);
  },
  stove(g, w) {
    rrect(g, 5, 7, w - 10, w - 14, 4);
    shape(g, "#5a6068");
    for (const [x, y] of [[20, 24], [44, 24], [20, 44], [44, 44]]) {
      blob(g, x, y, 8, "#2a2e33", OUT, 2);
      blob(g, x, y, 4, "#40454c", null);
    }
  },
  heater(g, w) {
    rrect(g, 7, 6, w - 14, w - 12, 6);
    shape(g, "#8a857e");
    g.strokeStyle = "#6d6a65";
    g.lineWidth = 2;
    for (let y = 16; y < w - 8; y += 10) {
      g.beginPath();
      g.moveTo(9, y);
      g.lineTo(w - 9, y);
      g.stroke();
    }
    rrect(g, 20, 26, w - 40, 22, 4);
    shape(g, "#241a14", OUT, 2);
  },
  research(g, w) {
    rrect(g, 4, 10, w - 8, w - 20, 4);
    shape(g, "#7a5a3a");
    rrect(g, 10, 16, 20, 14, 2);
    shape(g, "#f2eedf", OUT, 1.5);
    g.strokeStyle = "#8a8a8a";
    g.lineWidth = 1;
    for (let y = 20; y < 28; y += 3) {
      g.beginPath();
      g.moveTo(13, y);
      g.lineTo(27, y);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(44, 18);
    g.lineTo(40, 36);
    g.lineTo(54, 36);
    g.lineTo(50, 18);
    g.closePath();
    shape(g, "#9ad0e0", OUT, 2);
    g.fillStyle = "#4ac08a";
    g.fillRect(42, 28, 10, 7);
    rrect(g, 34, 40, 18, 8, 2);
    shape(g, "#5a6068", OUT, 1.5);
  },
  sandbags(g, w) {
    for (const [x, y] of [[16, 24], [32, 24], [48, 24], [24, 40], [40, 40]]) {
      g.beginPath();
      g.ellipse(x, y, 10, 7, 0, 0, Math.PI * 2);
      shape(g, "#b8a070", OUT, 2);
    }
  },
  turret(g, w) {
    blob(g, w / 2, w / 2, 22, "#5a6068");
    blob(g, w / 2, w / 2, 14, "#70777f", OUT, 2);
  },
  door(g, w, v) {
    if (v === "open") {
      g.fillStyle = "#3a2a1c";
      g.fillRect(0, 0, w, w);
      g.fillStyle = "#7a5230";
      g.fillRect(0, 0, 8, w);
      g.fillRect(w - 8, 0, 8, w);
      return;
    }
    g.fillStyle = "#6b4426";
    g.fillRect(0, 0, w, w);
    g.fillStyle = "#8a5a32";
    g.fillRect(6, 4, w - 12, w - 8);
    g.strokeStyle = "#5a3a20";
    g.lineWidth = 2;
    for (let x = 14; x < w - 6; x += 9) {
      g.beginPath();
      g.moveTo(x, 6);
      g.lineTo(x, w - 6);
      g.stroke();
    }
    blob(g, w - 16, w / 2, 3, "#d8c070", OUT, 1.5);
  },
};

// Текстура стены (тайлится)
export function wallTexture(def) {
  return cached("wall_" + def, S, S, (g, w) => {
    if (def === "wall_stone") {
      g.fillStyle = "#8c8882";
      g.fillRect(0, 0, w, w);
      g.strokeStyle = "#6a6762";
      g.lineWidth = 2;
      for (let r = 0; r < 4; r++) {
        const y = r * 16;
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
        for (let x = (r % 2) * 16; x < w; x += 32) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x, y + 16);
          g.stroke();
        }
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(255,255,255,${hr(i) * 0.08})`;
        g.fillRect(hr(i + 1) * w, hr(i + 2) * w, 3, 3);
      }
    } else {
      g.fillStyle = "#7a5230";
      g.fillRect(0, 0, w, w);
      g.strokeStyle = "#5a3a1f";
      g.lineWidth = 2;
      for (let y = 0; y < w; y += 13) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y);
        g.stroke();
      }
      for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(40,20,10,${0.1 + hr(i) * 0.15})`;
        g.fillRect(hr(i + 3) * w, hr(i + 5) * w, 6, 1.5);
      }
    }
  });
}

// ---------------- Иконки приказов ----------------
export function iconSprite(kind) {
  return cached("ic_" + kind, S, S, (g, w) => {
    g.translate(w / 2, w / 2);
    blob(g, 0, 0, 22, "rgba(20,20,20,0.6)", "rgba(255,255,255,0.8)", 2.5);
    g.strokeStyle = "#fff";
    g.lineWidth = 4;
    g.lineCap = "round";
    if (kind === "mine") {
      g.beginPath();
      g.moveTo(-9, 11);
      g.lineTo(8, -8);
      g.stroke();
      g.beginPath();
      g.arc(4, -4, 12, -2.6, -0.3);
      g.stroke();
    } else if (kind === "cut") {
      g.beginPath();
      g.moveTo(-8, 12);
      g.lineTo(6, -6);
      g.stroke();
      g.beginPath();
      g.moveTo(2, -12);
      g.quadraticCurveTo(14, -10, 12, 0);
      g.lineTo(4, -4);
      g.closePath();
      g.fillStyle = "#fff";
      g.fill();
    } else if (kind === "harvest") {
      g.beginPath();
      g.moveTo(-10, 6);
      g.quadraticCurveTo(0, -16, 10, 6);
      g.stroke();
      blob(g, 0, 8, 4, "#fff", null);
    } else if (kind === "hunt") {
      g.strokeStyle = "#ff6a5a";
      g.beginPath();
      g.arc(0, 0, 10, 0, Math.PI * 2);
      g.stroke();
      for (const [a, b, c, d] of [[0, -16, 0, -6], [0, 16, 0, 6], [-16, 0, -6, 0], [16, 0, 6, 0]]) {
        g.beginPath();
        g.moveTo(a, b);
        g.lineTo(c, d);
        g.stroke();
      }
    } else if (kind === "decon" || kind === "cancel") {
      g.strokeStyle = kind === "decon" ? "#ff7a5a" : "#fff";
      g.beginPath();
      g.moveTo(-9, -9);
      g.lineTo(9, 9);
      g.moveTo(9, -9);
      g.lineTo(-9, 9);
      g.stroke();
    } else if (kind === "capture") {
      g.strokeStyle = "#ffd25a";
      g.beginPath();
      g.arc(-5, 0, 7, 0, Math.PI * 2);
      g.arc(7, 0, 7, Math.PI, Math.PI * 3);
      g.stroke();
    }
  });
}

// ---------------- Поселенцы ----------------
export function drawHuman(g, p, x, y, s, opts = {}) {
  const look = p.look || { skin: "#e6b896", hair: "#4a3020", hairStyle: 0, shirt: "#777" };
  const f = p.facing || 1;
  g.save();
  g.translate(x, y);
  if (opts.lying) g.rotate(-Math.PI / 2 * f);
  const lw = Math.max(1, s * 0.035);
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  if (!opts.lying && !opts.headOnly) {
    g.fillStyle = "rgba(0,0,0,0.25)";
    g.beginPath();
    g.ellipse(0, s * 0.33, s * 0.26, s * 0.09, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (!opts.headOnly) {
    // тело
    g.beginPath();
    g.ellipse(0, s * 0.12, s * 0.22, s * 0.22, 0, 0, Math.PI * 2);
    g.fillStyle = opts.shirt || look.shirt;
    g.fill();
    g.stroke();
    // руки
    g.beginPath();
    g.arc(-s * 0.2, s * 0.14, s * 0.07, 0, Math.PI * 2);
    g.arc(s * 0.2, s * 0.14, s * 0.07, 0, Math.PI * 2);
    g.fillStyle = look.skin;
    g.fill();
  }
  // голова
  const hy = -s * 0.16;
  g.beginPath();
  g.arc(0, hy, s * 0.19, 0, Math.PI * 2);
  g.fillStyle = look.skin;
  g.fill();
  g.stroke();
  // волосы
  g.fillStyle = look.hair;
  const r = s * 0.19;
  g.beginPath();
  switch (look.hairStyle) {
    case 1:
      g.arc(0, hy, r, Math.PI * 1.1, Math.PI * 1.9);
      g.closePath();
      break;
    case 2:
      g.arc(0, hy, r * 1.06, Math.PI * 0.85, Math.PI * 2.15);
      g.lineTo(r * 1.0, hy + r * 0.9);
      g.lineTo(r * 0.7, hy + r * 0.2);
      g.lineTo(-r * 0.7, hy + r * 0.2);
      g.lineTo(-r * 1.0, hy + r * 0.9);
      g.closePath();
      break;
    case 3:
      g.arc(0, hy, r * 1.05, Math.PI * 0.95, Math.PI * 2.05);
      g.closePath();
      g.moveTo(r * 0.4, hy - r * 1.1);
      g.arc(0, hy - r * 1.05, r * 0.4, 0, Math.PI * 2);
      break;
    case 4:
      g.arc(0, hy, r * 1.05, Math.PI * 0.95, Math.PI * 2.05);
      g.closePath();
      g.moveTo(-f * r * 0.9, hy);
      g.ellipse(-f * r * 1.15, hy + r * 0.4, r * 0.28, r * 0.6, 0, 0, Math.PI * 2);
      break;
    default:
      g.arc(0, hy, r * 1.04, Math.PI * 1.0, Math.PI * 2.0);
      g.lineTo(r * 1.04, hy - r * 0.1);
      g.quadraticCurveTo(0, hy - r * 0.55, -r * 1.04, hy - r * 0.1);
      g.closePath();
  }
  g.fill();
  if (look.hairStyle !== 3 || true) {
    g.lineWidth = lw * 0.8;
    g.stroke();
  }
  // глаза
  if (!opts.sleeping) {
    g.fillStyle = "#1a1410";
    const ex = f * s * 0.06;
    g.beginPath();
    g.arc(ex - s * 0.055, hy + s * 0.03, s * 0.022, 0, Math.PI * 2);
    g.arc(ex + s * 0.055, hy + s * 0.03, s * 0.022, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = "#1a1410";
    g.lineWidth = lw * 0.7;
    g.beginPath();
    g.moveTo(-s * 0.08, hy + s * 0.04);
    g.lineTo(-s * 0.02, hy + s * 0.04);
    g.moveTo(s * 0.02, hy + s * 0.04);
    g.lineTo(s * 0.08, hy + s * 0.04);
    g.stroke();
  }
  if (opts.hat) {
    g.fillStyle = opts.hat;
    g.strokeStyle = OUT;
    g.lineWidth = lw;
    g.beginPath();
    g.ellipse(0, hy - r * 0.55, r * 1.35, r * 0.32, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(0, hy - r * 0.85, r * 0.75, r * 0.5, 0, Math.PI, 0);
    g.fill();
    g.stroke();
  }
  g.restore();
}

export function drawAnimal(g, p, x, y, s, lying) {
  const d = ANIMALS[p.animal];
  const k = d.size;
  const f = p.facing || 1;
  g.save();
  g.translate(x, y + s * 0.08);
  if (lying) g.rotate(Math.PI / 2);
  g.scale(f, 1);
  const lw = Math.max(1, s * 0.035);
  g.lineWidth = lw;
  g.strokeStyle = OUT;
  if (!lying) {
    g.fillStyle = "rgba(0,0,0,0.22)";
    g.beginPath();
    g.ellipse(0, s * 0.26 * k + s * 0.04, s * 0.36 * k, s * 0.08 * k, 0, 0, Math.PI * 2);
    g.fill();
    // лапы
    g.strokeStyle = OUT;
    g.lineWidth = lw * 2.2;
    for (const lx of [-0.24, -0.1, 0.12, 0.24]) {
      g.beginPath();
      g.moveTo(lx * s * k, s * 0.05 * k);
      g.lineTo(lx * s * k, s * 0.26 * k);
      g.stroke();
    }
    g.lineWidth = lw;
  }
  // тело
  g.beginPath();
  g.ellipse(0, 0, s * 0.34 * k, s * 0.2 * k, 0, 0, Math.PI * 2);
  g.fillStyle = d.color;
  g.fill();
  g.stroke();
  // хвост
  if (p.animal === "wolf" || p.animal === "hare") {
    g.beginPath();
    if (p.animal === "wolf") g.ellipse(-s * 0.36 * k, -s * 0.04 * k, s * 0.14 * k, s * 0.06 * k, -0.4, 0, Math.PI * 2);
    else g.arc(-s * 0.33 * k, -s * 0.04 * k, s * 0.07 * k, 0, Math.PI * 2);
    g.fillStyle = p.animal === "hare" ? "#e8e2d6" : d.color;
    g.fill();
    g.stroke();
  }
  // голова
  const hx = s * 0.32 * k, hy = -s * 0.14 * k;
  g.beginPath();
  g.ellipse(hx, hy, s * 0.15 * k, s * 0.12 * k, 0.2, 0, Math.PI * 2);
  g.fillStyle = d.color;
  g.fill();
  g.stroke();
  // уши / рога / клыки
  g.fillStyle = d.color;
  if (p.animal === "hare") {
    for (const o of [-0.05, 0.05]) {
      g.beginPath();
      g.ellipse(hx + o * s - s * 0.04, hy - s * 0.22 * k, s * 0.04, s * 0.13 * k, -0.2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  } else if (p.animal === "deer") {
    g.strokeStyle = "#e0d0b0";
    g.lineWidth = lw * 1.6;
    g.beginPath();
    g.moveTo(hx - s * 0.02, hy - s * 0.1 * k);
    g.lineTo(hx - s * 0.08, hy - s * 0.32 * k);
    g.moveTo(hx - s * 0.06, hy - s * 0.22 * k);
    g.lineTo(hx - s * 0.16, hy - s * 0.28 * k);
    g.moveTo(hx + s * 0.04, hy - s * 0.1 * k);
    g.lineTo(hx + s * 0.08, hy - s * 0.3 * k);
    g.stroke();
  } else if (p.animal === "boar") {
    g.strokeStyle = "#f0ead8";
    g.lineWidth = lw * 1.4;
    g.beginPath();
    g.moveTo(hx + s * 0.1 * k, hy + s * 0.04);
    g.lineTo(hx + s * 0.16 * k, hy - s * 0.04);
    g.stroke();
  } else {
    for (const o of [-0.06, 0.04]) {
      g.beginPath();
      g.moveTo(hx + o * s - s * 0.04, hy - s * 0.06 * k);
      g.lineTo(hx + o * s, hy - s * 0.2 * k);
      g.lineTo(hx + o * s + s * 0.04, hy - s * 0.06 * k);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }
  g.fillStyle = "#111";
  g.beginPath();
  g.arc(hx + s * 0.06 * k, hy - s * 0.02 * k, s * 0.02, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export function drawWeaponHeld(g, id, x, y, s, angle) {
  const spr = itemSprite("w_" + id);
  g.save();
  g.translate(x, y);
  g.rotate(angle + 0.5);
  if (Math.cos(angle) < 0) g.scale(1, -1);
  g.drawImage(spr, -s * 0.38, -s * 0.38, s * 0.76, s * 0.76);
  g.restore();
}
