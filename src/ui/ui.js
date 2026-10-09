// Интерфейс поверх карты: панели, карточки объектов, окна и меню
import {
  BUILDINGS, BUILD_CATS, ITEMS, ITEM_CATS, RESEARCH, WORK, SKILLS, TRAITS, PLANTS, PLANT, CROPS, ROCKS,
  TERRAIN, FLOORS, RECIPES, WEAPONS, DIFFICULTY, ANIMALS, TPD, TPH, DESIG, COLONIST_CAP,
} from "../game/defs.js";
import { moodParts, setDrafted, makeColonist, BREAKS } from "../game/pawn.js";
import { gx } from "../game/pawnutil.js";
import { buyPrice, sellPrice, traderPresent, executeTrade, plural } from "../game/story.js";
import { orderEquip } from "../game/jobs.js";
import { createWorld } from "../game/mapgen.js";
import { itemSprite, buildingSprite, wallTexture, drawHuman, drawAnimal, plantSprite } from "../render/sprites.js";
import { TG } from "../telegram.js";
import { localSaveInfo, cloudInfo } from "../storage.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (v) => Math.round(Math.max(0, Math.min(1, v)) * 100);

// ---------- иконки (data URL из процедурных спрайтов) ----------
const icons = new Map();
function cv(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}
function url(key, make) {
  let u = icons.get(key);
  if (!u) {
    u = make().toDataURL();
    icons.set(key, u);
  }
  return u;
}
export function itemIcon(def) {
  return url("i" + def, () => itemSprite(def));
}
function buildIcon(def) {
  return url("b" + def, () => {
    const d = BUILDINGS[def];
    const c = cv(64, 64);
    const g = c.getContext("2d");
    if (d.wall) {
      g.drawImage(wallTexture(def), 8, 8, 48, 48);
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.fillRect(8, 42, 48, 14);
      g.strokeStyle = "#1e1a16";
      g.lineWidth = 2;
      g.strokeRect(8, 8, 48, 48);
    } else if (d.floor) {
      g.fillStyle = d.floor === 1 ? "#9a6a40" : "#a8a49c";
      g.fillRect(8, 8, 48, 48);
      g.strokeStyle = d.floor === 1 ? "#6a4426" : "#6a6862";
      g.lineWidth = 2;
      for (let k = 8; k < 56; k += d.floor === 1 ? 8 : 12) {
        g.beginPath();
        g.moveTo(8, k);
        g.lineTo(56, k);
        g.stroke();
        if (d.floor === 2) {
          g.beginPath();
          g.moveTo(k, 8);
          g.lineTo(k, 56);
          g.stroke();
        }
      }
    } else g.drawImage(buildingSprite(def), 0, 0, 64, 64);
    return c;
  });
}
function portrait(p) {
  const shirt = p.kind === "prisoner" ? "#d8822a" : "";
  return url(`p${p.id}_${p.kind}_${shirt}_${p.dead ? 1 : 0}`, () => {
    const c = cv(72, 72);
    const g = c.getContext("2d");
    if (p.kind === "animal") drawAnimal(g, p, 34, 38, 60, false);
    else drawHuman(g, p, 36, 44, 64, { shirt: shirt || null, sleeping: p.dead });
    return c;
  });
}
const img = (src, s = 20, extra = "") => `<img src="${src}" width="${s}" height="${s}" alt="" ${extra}>`;

function moodColor(m) {
  return m >= 50 ? "#6fcf6a" : m >= 25 ? "#e8c040" : "#ef6a5a";
}

const TASKS = [
  { text: "Создайте склад: «Зоны» → «Склад», затем проведите пальцем по земле.", done: (w) => [...w.zones.values()].some((z) => z.type === "stock") },
  { text: "Постройте кровати для всех: «Строить» → «Мебель» → «Кровать».", done: (w) => [...w.buildings.values()].filter((b) => b.def === "bed").length >= w.colonists().length },
  { text: "Поставьте костёр — на нём повар готовит еду: «Строить» → «Производство».", done: (w) => [...w.buildings.values()].some((b) => b.def === "campfire" || b.def === "stove") },
  { text: "Отметьте поле: «Зоны» → «Поле». Нажмите на поле, чтобы выбрать культуру.", done: (w) => [...w.zones.values()].some((z) => z.type === "grow") },
  { text: "Окружите кровати стенами с дверью — получится тёплая спальня.", done: (w) => w.rooms.some((r) => r.beds > 0) },
  { text: "Поставьте стол учёного и выберите исследование («Наука»).", done: (w) => [...w.buildings.values()].some((b) => b.def === "research") && (w.research.current || Object.keys(w.research.done).length) },
  { text: "Готовьтесь к зиме: запас еды и дров, тёплые комнаты. Зима начинается на 26-й день.", done: (w) => w.day >= 26 },
];

export class UI {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById("ui");
    this.tab = null;
    this.buildCat = "struct";
    this.modalKind = null;
    this.open = new Set();
    this.deal = { buy: {}, sell: {} };
    this.ng = null;
    this.root.innerHTML = `
      <div id="top" class="hidden">
        <div class="bar1">
          <button class="iconbtn" data-a="menu" aria-label="Меню">☰</button>
          <div class="clock" data-a="log"><b id="clk1"></b><span id="clk2"></span></div>
          <div class="speeds" id="speeds"></div>
        </div>
        <div class="res live" id="res"></div>
        <div class="cols live" id="cols"></div>
      </div>
      <div id="toasts"></div>
      <div class="tip hidden" id="tip"></div>
      <div id="toolbar-hint" class="hidden"></div>
      <div id="sheet" class="hidden live"></div>
      <div id="tabs" class="hidden">
        <button data-a="tab" data-v="build"><span class="e">🔨</span>Строить</button>
        <button data-a="tab" data-v="orders"><span class="e">⛏</span>Приказы</button>
        <button data-a="tab" data-v="zones"><span class="e">▦</span>Зоны</button>
        <button data-a="modal" data-v="work"><span class="e">👥</span>Работы</button>
        <button data-a="modal" data-v="research"><span class="e">🔬</span>Наука</button>
        <button data-a="modal" data-v="log"><span class="e">📜</span>Журнал</button>
      </div>
      <div id="modal" class="hidden live"></div>
      <div id="menu" class="hidden"></div>`;
    const $ = (id) => document.getElementById(id);
    this.el = {
      top: $("top"), clk1: $("clk1"), clk2: $("clk2"), speeds: $("speeds"), res: $("res"), cols: $("cols"),
      toasts: $("toasts"), tip: $("tip"), hint: $("toolbar-hint"), sheet: $("sheet"), tabs: $("tabs"),
      modal: $("modal"), menu: $("menu"),
    };
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("input", (e) => {
      if (e.target.id === "cname" && this.ng) this.ng.name = e.target.value;
    });
    // пока палец на панели — не перерисовываем её, чтобы нажатие не потерялось
    const press = (e) => {
      const live = e.target.closest && e.target.closest(".live");
      if (live) live._pressing = true;
    };
    const release = () => setTimeout(() => this.root.querySelectorAll(".live").forEach((n) => (n._pressing = false)), 150);
    this.root.addEventListener("pointerdown", press, true);
    this.root.addEventListener("pointerup", release, true);
    this.root.addEventListener("pointercancel", release, true);
    this.el.modal.addEventListener("click", (e) => {
      if (e.target === this.el.modal && this.modalKind !== "gameover") this.closeModal();
    });
    this.refreshSpeeds();
  }

  set(el, html) {
    if (el._h === html || el._pressing) return;
    el.innerHTML = html;
    el._h = html;
  }

  // ---------- раскладка ----------
  layout() {
    const top = this.el.top.classList.contains("hidden") ? 0 : this.el.top.getBoundingClientRect().bottom;
    const t = Math.max(top, 8) + 6;
    this.el.toasts.style.top = t + (this.el.tip.classList.contains("hidden") ? 0 : this.el.tip.offsetHeight + 6) + "px";
    this.el.tip.style.top = t + "px";
    this.el.hint.style.top = t + "px";
    const tabsH = this.el.tabs.classList.contains("hidden") ? 0 : this.el.tabs.offsetHeight;
    this.el.sheet.style.bottom = tabsH + 4 + "px";
  }

  pausesGame() {
    return ["menu", "help", "trade", "gameover"].includes(this.modalKind);
  }

  // ---------- главное меню ----------
  showMenu() {
    this.modalKind = null;
    this.el.modal.classList.add("hidden");
    for (const k of ["top", "tabs", "sheet", "tip", "hint"]) this.el[k].classList.add("hidden");
    this.el.toasts.innerHTML = "";
    this.ng = null;
    const info = localSaveInfo();
    const m = this.el.menu;
    m.classList.remove("hidden");
    const render = (inf) => {
      m.innerHTML = `
        <div class="logo">ОКРАИНА</div>
        <div class="tagline">Колония на краю мира</div>
        ${inf ? `<button class="primary" data-a="continue">▶ Продолжить<br><small>${inf.cloud ? "сохранение из облака Telegram" : `${esc(inf.name || "Колония")} · день ${inf.day + 1}`}</small></button>` : ""}
        <button class="${inf ? "" : "primary"}" data-a="newgame">Новая колония</button>
        <button data-a="help">Как играть</button>
        <div class="sub" style="text-align:center;margin-top:8px">${TG.hasCloud() ? "☁ Прогресс сохраняется в облаке Telegram" : "Прогресс сохраняется на этом устройстве"}</div>`;
    };
    render(info);
    if (!info && TG.hasCloud()) {
      cloudInfo().then((ci) => {
        if (ci && !this.ng && this.g.mode === "menu") render({ cloud: true });
      });
    }
    TG.setBack(null);
  }

  showLoading(text) {
    const m = this.el.menu;
    m.classList.remove("hidden");
    m.innerHTML = `<div class="spinner"></div><div class="sub">${esc(text)}</div>`;
  }

  newGameStep(step) {
    const m = this.el.menu;
    if (!this.ng) {
      const nm = TG.userName();
      this.ng = { step: "story", diff: "classic", name: nm ? `Колония ${nm}` : "Новая надежда" };
    }
    const ng = this.ng;
    ng.step = step || ng.step;
    TG.setBack(() => this.onBack());
    if (ng.step === "story") {
      m.innerHTML = `
        <div class="newgame">
          <h2>Новая колония</h2>
          <div class="sub">Название</div>
          <input type="text" id="cname" maxlength="28" value="${esc(ng.name)}">
          <div class="sub" style="margin:12px 0 6px">Рассказчик — от него зависят угрозы</div>
          <div class="pick">
            ${Object.entries(DIFFICULTY).map(([k, d]) => `<div class="card ${ng.diff === k ? "on" : ""}" data-a="diff" data-v="${k}"><b>${d.name}</b><div class="sub">${d.desc}</div></div>`).join("")}
          </div>
          ${localSaveInfo() ? '<div class="sub" style="color:#ffb0a0;margin-top:10px">Текущая колония будет заменена новой.</div>' : ""}
          <div class="btns"><button data-a="menuback">Назад</button><button class="primary" data-a="ng-next">Далее →</button></div>
        </div>`;
    } else {
      if (!ng.world) {
        ng.world = createWorld({ seed: Math.floor(Math.random() * 2 ** 31), difficulty: ng.diff, colonyName: ng.name.trim() || "Колония" });
        ng.cols = [];
        for (let k = 0; k < 3; k++) ng.cols.push(makeColonist(ng.world, ng.world.rng, { usedNames: ng.cols.map((c) => c.short) }));
      }
      m.innerHTML = `
        <div class="newgame">
          <h2>Колонисты</h2>
          <div class="sub" style="text-align:center">Нажмите 🎲, чтобы заменить колониста</div>
          ${ng.cols.map((p, k) => this.colonistCard(p, k)).join("")}
          <div class="btns"><button data-a="ng-back">← Назад</button><button class="primary" data-a="ng-start">Высадиться!</button></div>
        </div>`;
    }
  }

  colonistCard(p, k) {
    const top = Object.entries(p.skills).sort((a, b) => b[1].lvl - a[1].lvl);
    return `<div class="card"><div class="colcard">
      ${img(portrait(p), 64)}
      <div>
        <div class="row" style="margin:0"><b class="grow">${esc(p.name)}</b><button data-a="reroll" data-v="${k}" style="min-height:32px;padding:2px 10px">🎲</button></div>
        <div class="sub">${esc(p.title)}, ${p.age} лет · ${esc(WEAPONS[p.weapon].name)}</div>
        <div class="tags">${p.traits.map((t) => `<span class="tag">${TRAITS[t].name}</span>`).join("")}</div>
      </div></div>
      <div class="skills">${top.map(([s, v]) => `<div class="${v.lvl >= 8 ? "hi" : ""}"><span>${SKILLS[s]}</span><span>${v.lvl}</span></div>`).join("")}</div>
    </div>`;
  }

  enterGame() {
    this.el.menu.classList.add("hidden");
    this.el.menu.innerHTML = "";
    for (const k of ["top", "tabs"]) this.el[k].classList.remove("hidden");
    this.tab = null;
    this.modalKind = null;
    this.el.modal.classList.add("hidden");
    this.el.sheet.classList.add("hidden");
    this.el.toasts.innerHTML = "";
    for (const k of ["res", "cols", "sheet", "modal"]) this.el[k]._h = null;
    this.update();
    this.layout();
    this.updateBack();
  }

  // ---------- верх ----------
  refreshSpeeds() {
    const labels = ["⏸", "▶", "▶▶", "▶▶▶"];
    this.el.speeds.innerHTML = labels.map((l, k) => `<button class="${this.g.speed === k ? "on" : ""}" data-a="speed" data-v="${k}">${l}</button>`).join("");
  }

  update() {
    const w = this.g.w;
    if (!w || this.g.mode !== "play") return;
    const h = w.hourF;
    const hh = String(Math.floor(h)).padStart(2, "0"), mm = String(Math.floor((h % 1) * 6) * 10).padStart(2, "0");
    const wx = { clear: w.daylight() > 0.3 ? "☀️" : "🌙", rain: "🌧", snow: "❄️", fog: "🌫" }[w.weather.kind];
    this.el.clk1.textContent = `День ${w.day + 1} · ${w.seasonName}`;
    this.el.clk2.textContent = `${hh}:${mm} · ${Math.round(w.outT)}°C ${wx} · ${esc(w.colonyName)}`;
    this.renderRes();
    this.renderCols();
    this.renderSheet();
    this.renderTip();
    if (this.modalKind && ["work", "research", "trade", "log"].includes(this.modalKind)) this.renderModal();
  }

  renderRes() {
    const w = this.g.w;
    const c = w.counts();
    const meals = (c.meal || 0) + (c.finemeal || 0) + (c.ration || 0);
    const raw = w.countCat("raw");
    const cols = w.colonists().length;
    const lowFood = w.totalNutrition() < cols * 1.2;
    const chip = (icon, n, low, title) => `<div class="chip ${low ? "low" : ""}" title="${title}">${img(icon, 20)}${n}</div>`;
    this.set(this.el.res, [
      chip(itemIcon("wood"), c.wood || 0, (c.wood || 0) < 20, "Дерево"),
      chip(itemIcon("stone"), c.stone || 0, false, "Камень"),
      chip(itemIcon("steel"), c.steel || 0, false, "Сталь"),
      chip(itemIcon("meal"), meals, lowFood, "Готовая еда"),
      chip(itemIcon("rice"), raw, lowFood && !raw, "Сырая еда"),
      chip(itemIcon("medicine"), c.medicine || 0, false, "Лекарства"),
      chip(itemIcon("components"), c.components || 0, false, "Компоненты"),
      chip(itemIcon("silver"), c.silver || 0, false, "Серебро"),
    ].join(""));
  }

  renderCols() {
    const w = this.g.w;
    const cols = w.colonists();
    const hostile = w.hostiles().length;
    const drafted = cols.some((c) => c.drafted);
    const sel = this.g.sel;
    let html = `<button class="drafbtn ${hostile && !drafted ? "hot" : ""}" data-a="draftall">${drafted ? "🏳<br>Отбой" : "⚔<br>В бой"}${hostile ? `<br><small>врагов: ${hostile}</small>` : ""}</button>`;
    for (const p of cols) {
      const badges = [];
      if (p.drafted) badges.push("⚔");
      if (p.downed) badges.push("✚");
      else if (p.bleed > 0) badges.push("🩸");
      if (p.mental) badges.push("⚡");
      if (p.food < 0.12) badges.push("🍗");
      if (p.rest < 0.08) badges.push("💤");
      const cls = ["col", sel && (sel.pawn === p.id || (sel.group && sel.group.includes(p.id))) ? "sel" : "", p.drafted ? "drafted" : "", p.downed ? "down" : ""].join(" ");
      html += `<div class="${cls}" data-a="col" data-v="${p.id}">${img(portrait(p), 36)}<div class="nm">${esc(p.short)}</div><div class="mbar"><i style="width:${p.mood}%;background:${moodColor(p.mood)}"></i></div>${badges.length ? `<span class="badge">${badges.slice(0, 2).join("")}</span>` : ""}</div>`;
    }
    this.set(this.el.cols, html);
  }

  // Тревоги важнее обучающих задач
  alert() {
    const w = this.g.w;
    const cols = w.colonists();
    if (!cols.length) return null;
    const food = w.totalNutrition();
    const hunt = w.pawns.some((p) => p.huntDesig && !p.dead);
    if (food < cols.length * 1.5 && !hunt) return { kind: "bad", text: "Мало еды! Охотьтесь («Приказы» → «Охота»), собирайте ягоды, сажайте рис." };
    let cut = 0;
    for (const i of w.desigSet) if (w.desig[i] & DESIG.CUT) cut++;
    if (w.countDef("wood") < 25 && cut < 3) return { kind: "bad", text: "Мало дерева! «Приказы» → «Рубить» и проведите по деревьям." };
    const unfed = cols.find((p) => p.food < 0.1 && !p.downed);
    if (unfed) return { kind: "bad", text: `${unfed.short} голодает — нужна еда на складе или в поле.` };
    const cold = w.outT < 2 && !w.rooms.some((r) => r.beds > 0);
    if (cold) return { kind: "bad", text: "Холодно! Нужна закрытая комната: стены, дверь и костёр внутри." };
    return null;
  }

  visibleArea() {
    const top = this.el.top.classList.contains("hidden") ? 0 : this.el.top.getBoundingClientRect().bottom;
    const sh = this.el.sheet;
    const bottom = !sh.classList.contains("hidden") ? sh.getBoundingClientRect().top : this.el.tabs.getBoundingClientRect().top || this.g.renderer.cssH;
    return { top, bottom: Math.max(top + 60, bottom) };
  }

  renderTip() {
    const g = this.g, w = g.w;
    let task = null;
    if (!g.tool) task = this.alert();
    if (!task && !g.settings.hideTips && !g.tool) task = TASKS.find((t) => !t.done(w));
    const tip = this.el.tip;
    const was = !tip.classList.contains("hidden");
    if (!task) {
      tip.classList.add("hidden");
      if (was) this.layout();
      return;
    }
    tip.classList.remove("hidden");
    tip.classList.toggle("warn", task.kind === "bad");
    this.set(tip, `${task.kind === "bad" ? "⚠️" : "💡"} ${esc(task.text)}${task.kind === "bad" ? "" : '<button class="x" data-a="hidetips" aria-label="Скрыть">✕</button>'}`);
    if (!was) this.layout();
  }

  // ---------- нижние панели ----------
  renderSheet() {
    const g = this.g;
    let html = "";
    if (g.tool) html = "";
    else if (g.sel) html = this.inspector();
    else if (this.tab === "build") html = this.buildMenu();
    else if (this.tab === "orders") html = this.ordersMenu();
    else if (this.tab === "zones") html = this.zonesMenu();
    const sh = this.el.sheet;
    if (!html) {
      sh.classList.add("hidden");
      sh._h = null;
    } else {
      sh.classList.remove("hidden");
      this.set(sh, html);
    }
    for (const b of this.el.tabs.querySelectorAll("button[data-a=tab]")) b.classList.toggle("on", !g.sel && b.dataset.v === this.tab);
  }

  head(title, icon = "", sub = "") {
    return `<div class="sh-head">${icon}<h3>${esc(title)}</h3>${sub}<button class="x" data-a="closesheet" aria-label="Закрыть">✕</button></div>`;
  }

  buildMenu() {
    const w = this.g.w;
    const cats = BUILD_CATS.map((c) => `<button class="${this.buildCat === c.id ? "on" : ""}" data-a="bcat" data-v="${c.id}">${c.name}</button>`).join("");
    const tiles = Object.entries(BUILDINGS)
      .filter(([, d]) => d.cat === this.buildCat)
      .map(([id, d]) => {
        const locked = d.research && !w.research.done[d.research];
        const cost = Object.entries(d.cost).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join(", ");
        return `<button class="tile ${locked ? "locked" : ""}" data-a="${locked ? "lockedb" : "tool-build"}" data-v="${id}">${locked ? '<span class="lock">🔒</span>' : ""}${img(buildIcon(id), 40)}<span>${d.name}</span><small>${locked ? "Нужно: " + RESEARCH[d.research].name : cost}</small></button>`;
      })
      .join("");
    return this.head("Строительство") + `<div class="catrow">${cats}</div><div class="grid">${tiles}</div>`;
  }

  ordersMenu() {
    const t = [
      ["mine", "⛏", "Добыть", "камень и руду"],
      ["cut", "🪓", "Рубить", "деревья на дрова"],
      ["harvest", "🧺", "Собрать", "ягоды и урожай"],
      ["hunt", "🎯", "Охота", "мясо животных"],
      ["decon", "🔧", "Разобрать", "постройки"],
      ["cancel", "✖", "Отменить", "любые приказы"],
    ];
    return this.head("Приказы") + `<div class="grid">${t.map(([m, e, n, s]) => `<button class="tile" data-a="tool-desig" data-v="${m}"><span class="e">${e}</span><span>${n}</span><small>${s}</small></button>`).join("")}</div>`;
  }

  zonesMenu() {
    const t = [
      ["stock", "📦", "Склад", "сюда носят вещи"],
      ["grow", "🌱", "Поле", "посадки"],
      ["erase", "🧽", "Стереть", "убрать зону"],
    ];
    return this.head("Зоны") + `<div class="grid">${t.map(([m, e, n, s]) => `<button class="tile" data-a="tool-zone" data-v="${m}"><span class="e">${e}</span><span>${n}</span><small>${s}</small></button>`).join("")}</div>`;
  }

  // ---------- карточки объектов ----------
  inspector() {
    const g = this.g, w = g.w, s = g.sel;
    if (s.group) {
      const n = s.group.map((id) => w.get(id)).filter((p) => p && p.drafted && !p.dead).length;
      if (!n) {
        g.sel = null;
        return "";
      }
      return this.head(`Отряд: ${n}`) + `<div class="sub">Нажмите на землю — отряд пойдёт туда. Нажмите на врага — все атакуют его. Стрелки сами стреляют по врагам в радиусе.</div><div class="btns"><button data-a="draftall">🏳 Отбой</button></div>`;
    }
    if (s.pawn != null) {
      const p = w.get(s.pawn);
      if (!p || p.despawned || p.kind === undefined) {
        g.sel = null;
        return "";
      }
      return this.pawnCard(p);
    }
    if (s.building != null) {
      const b = w.buildings.get(s.building);
      if (!b) {
        g.sel = null;
        return "";
      }
      return this.buildingCard(b);
    }
    if (s.item != null) {
      const it = w.items.get(s.item);
      if (!it) {
        g.sel = null;
        return "";
      }
      return this.itemCard(it);
    }
    if (s.zone != null) {
      const z = w.zones.get(s.zone);
      if (!z) {
        g.sel = null;
        return "";
      }
      return this.zoneCard(z);
    }
    if (s.plant) {
      if (!w.plant[s.cell]) {
        g.sel = null;
        return "";
      }
      return this.plantCard(s.cell);
    }
    if (s.rock) {
      if (!w.rock[s.cell]) {
        g.sel = null;
        return "";
      }
      return this.rockCard(s.cell);
    }
    return this.terrainCard(s.cell);
  }

  kv(label, frac, color, val) {
    return `<span>${label}</span><div class="pbar"><i style="width:${pct(frac)}%;background:${color}"></i></div><span>${val}</span>`;
  }

  describe(p) {
    const w = this.g.w;
    if (p.dead) return gx(p, "Погиб", "Погибла");
    if (p.downed) return p.inBed ? "Лежит в кровати, лечится" : "Без сознания";
    if (p.carriedBy) return "Его несут";
    if (p.drafted) return p.forceTarget ? "В бою: атакует" : p.path ? "В бою: идёт" : "В бою: держит позицию";
    if (p.mental) return "Срыв: " + BREAKS[p.mental.type];
    const j = p.job;
    if (!j) return "Думает, чем заняться";
    const name = (id) => {
      const o = w.get(id);
      return o ? esc(o.short || o.name || "") : "";
    };
    const bname = (id) => {
      const b = w.buildings.get(id);
      return b ? BUILDINGS[b.def].name.toLowerCase() : "";
    };
    switch (j.type) {
      case "eat": return "Ест";
      case "sleep": return j.medical ? "Отлёживается в кровати" : j.sad ? "Хандрит в кровати" : "Спит";
      case "haul": { const it = w.items.get(j.item); return "Переносит" + (it ? ": " + ITEMS[it.def].name.toLowerCase() : p.carry ? ": " + ITEMS[p.carry.def].name.toLowerCase() : ""); }
      case "deliver": return `Несёт материалы: ${ITEMS[j.res].name.toLowerCase()}`;
      case "build": return "Строит: " + bname(j.b);
      case "decon": return "Разбирает: " + bname(j.b);
      case "mine": return "Добывает: " + (ROCKS[w.rock[j.cell]]?.name.toLowerCase() || "камень");
      case "cut": return (j.harvest ? "Собирает: " : "Рубит: ") + (PLANTS[w.plant[j.cell]]?.name.toLowerCase() || "");
      case "grow": return j.mode === "sow" ? `Сеет: ${PLANTS[j.crop].name.toLowerCase()}` : j.mode === "harvest" ? "Собирает урожай" : "Расчищает поле";
      case "cook": return "Готовит: " + RECIPES[j.recipe].name.toLowerCase();
      case "research": return "Исследует: " + (w.research.current ? RESEARCH[w.research.current].name : "");
      case "rescue": return (j.capture ? "Берёт в плен: " : "Спасает: ") + name(j.patient);
      case "tend": return "Лечит: " + name(j.patient);
      case "feed": return "Кормит: " + name(j.patient);
      case "chat": return "Уговаривает пленника: " + name(j.patient);
      case "hunt": return "Охотится: " + name(j.target).toLowerCase();
      case "refuel": return "Подкидывает дрова: " + bname(j.b);
      case "flee": return "Убегает от опасности";
      case "equip": return "Идёт за оружием";
      case "wander":
      case "wait": return "Отдыхает";
    }
    return "";
  }

  pawnCard(p) {
    const w = this.g.w;
    const icon = img(portrait(p), 40);
    if (p.kind === "animal") {
      const d = ANIMALS[p.animal];
      const st = p.dead ? "Мёртв" : p.faction === "hostile" ? "В ярости! Нападает на людей" : p.huntDesig ? "Отмечен для охоты" : "Дикое животное";
      return this.head(d.name, icon) + `<div class="sub">${st}</div><div class="kv">${this.kv("Здоровье", p.hp / p.maxHp, "#6fcf6a", Math.round(p.hp))}</div>
        ${p.dead ? "" : `<div class="btns"><button class="${p.huntDesig ? "on" : ""}" data-a="hunt1">${p.huntDesig ? "✖ Не охотиться" : "🎯 Охотиться"}</button></div>`}
        <div class="sub" style="margin-top:6px">Мясо: ~${d.meat}. ${d.retaliate > 0.4 ? "⚠ Опасно: может дать отпор." : ""}</div>`;
    }
    let html = this.head(p.name, icon);
    if (p.kind === "raider") {
      html += `<div class="sub">${p.dead ? gx(p, "Мёртв", "Мертва") : p.downed ? "Без сознания" : p.fleeing ? "Бежит" : "Налётчик"} · ${WEAPONS[p.weapon || "fists"].name}</div><div class="kv">${this.kv("Здоровье", p.hp / p.maxHp, "#ef6a5a", Math.round(p.hp))}</div>`;
      if (p.downed && !p.dead) {
        html += `<div class="btns"><button class="${p.captureDesig ? "on" : ""}" data-a="capture">${p.captureDesig ? "✖ Не брать в плен" : "⛓ Взять в плен"}</button></div><div class="sub">Нужна свободная кровать. Надзиратель отнесёт пленника и будет уговаривать присоединиться.</div>`;
      }
      return html;
    }
    if (p.kind === "trader") {
      const t = w.story.trader;
      const here = traderPresent(w);
      return html + `<div class="sub">${esc(p.title)} · ${WEAPONS[p.weapon].name}</div>
        ${t && !t.leaving ? `<div class="sub">Уйдут примерно через ${Math.max(1, Math.round((t.until - w.tick) / TPH))} ч.</div>` : '<div class="sub">Караван уходит.</div>'}
        <div class="btns"><button class="primary" data-a="trade" ${here ? "" : "disabled"}>💰 Торговать</button></div>${here ? "" : '<div class="sub">Караван ещё не дошёл до колонии.</div>'}`;
    }
    if (p.kind === "prisoner") {
      return html + `<div class="sub">Пленник · ${p.dead ? gx(p, "мёртв", "мертва") : p.downed ? "ранен" : "в кровати"}</div>
        <div class="kv">${this.kv("Сытость", p.food, "#e8a040", pct(p.food))}${this.kv("Здоровье", p.hp / p.maxHp, "#6fcf6a", Math.round(p.hp))}${this.kv("Упрямство", (p.resistance || 0) / 12, "#9a8ae8", (p.resistance || 0).toFixed(1))}</div>
        <div class="sub" style="margin-top:6px">Надзиратели (работа «Надзор») кормят пленника и уговаривают. Когда упрямство дойдёт до нуля — может присоединиться.</div>
        ${p.dead ? "" : `<div class="btns"><button data-a="release">🕊 Отпустить</button></div>`}`;
    }
    // колонист
    const parts = moodParts(w, p);
    html += `<div class="sub">${esc(p.title)}, ${p.age} лет · ${esc(this.describe(p))}</div>`;
    html += `<div class="kv" style="margin-top:6px">
      ${this.kv("Настроение", p.mood / 100, moodColor(p.mood), Math.round(p.mood))}
      ${this.kv("Сытость", p.food, p.food < 0.25 ? "#ef6a5a" : "#e8a040", pct(p.food))}
      ${this.kv("Бодрость", p.rest, p.rest < 0.2 ? "#ef6a5a" : "#6ab0ef", pct(p.rest))}
      ${this.kv("Здоровье", p.hp / p.maxHp, p.bleed > 0 ? "#ef6a5a" : "#6fcf6a", Math.round(p.hp))}
    </div>`;
    const tags = p.traits.map((t) => `<span class="tag">${TRAITS[t].name}</span>`);
    if (p.bleed > 0) tags.push(`<span class="tag bad">Кровотечение</span>`);
    if (p.tendUntil > w.tick) tags.push(`<span class="tag good">Перевязан</span>`);
    tags.push(`<span class="tag">${WEAPONS[p.weapon || "fists"].name}</span>`);
    html += `<div class="tags">${tags.join("")}</div>`;
    if (!p.dead) {
      html += `<div class="btns">
        ${p.downed ? "" : `<button class="${p.drafted ? "on" : ""}" data-a="draft1">${p.drafted ? "🏳 Отбой" : "⚔ В бой"}</button>`}
        <button data-a="equip">🔫 Оружие</button>
        <button data-a="modal" data-v="work">⚙ Работы</button>
      </div>`;
    }
    const sk = this.open.has("skills");
    html += `<button class="${sk ? "on" : ""}" style="width:100%;margin-top:8px" data-a="toggle" data-v="skills">Навыки ${sk ? "▲" : "▼"}</button>`;
    if (sk) html += `<div class="kv" style="margin-top:6px">${Object.entries(SKILLS).map(([k, n]) => this.kv(n, p.skills[k].lvl / 20, p.skills[k].lvl >= 8 ? "#e2b43a" : "#8a96a8", p.skills[k].lvl)).join("")}</div>`;
    const mo = this.open.has("mood");
    html += `<button class="${mo ? "on" : ""}" style="width:100%;margin-top:6px" data-a="toggle" data-v="mood">Что влияет на настроение ${mo ? "▲" : "▼"}</button>`;
    if (mo) html += `<div style="margin-top:6px">${parts.length ? parts.map(([l, v]) => `<div class="thought"><span>${esc(l)}</span><span class="${v >= 0 ? "pos" : "neg"}">${v > 0 ? "+" : ""}${v}</span></div>`).join("") : '<div class="sub">Ничего особенного</div>'}<div class="sub" style="margin-top:4px">При настроении ниже 22 возможны нервные срывы.</div></div>`;
    return html;
  }

  buildingCard(b) {
    const w = this.g.w;
    const d = BUILDINGS[b.def];
    let html = this.head(d.name, img(buildIcon(b.def), 36)) + `<div class="sub">${esc(d.desc || "")}</div>`;
    if (!b.complete) {
      html += `<div class="sub" style="margin-top:6px">Чертёж. Колонисты с работой «Стройка» принесут материалы и построят.</div><div class="kv" style="margin-top:6px">`;
      for (const [k, n] of Object.entries(d.cost)) html += this.kv(ITEMS[k].name, (b.delivered[k] || 0) / n, "#7ac0ff", `${b.delivered[k] || 0}/${n}`);
      html += this.kv("Работа", b.work / d.work, "#e8d070", pct(b.work / d.work) + "%") + "</div>";
      const missing = Object.entries(d.cost).filter(([k, n]) => w.countDef(k) < n - (b.delivered[k] || 0));
      if (missing.length) html += `<div class="sub" style="color:#ffb0a0;margin-top:4px">Не хватает: ${missing.map(([k]) => ITEMS[k].name.toLowerCase()).join(", ")}</div>`;
      const pl = w.plant[w.idx(b.x, b.y)];
      if (pl && !PLANTS[pl].small && !d.floor) html += `<div class="sub" style="margin-top:4px">Сначала срубят: ${PLANTS[pl].name.toLowerCase()}</div>`;
      return html + `<div class="btns"><button class="danger" data-a="cancelbp">✖ Отменить</button></div>`;
    }
    html += `<div class="kv" style="margin-top:6px">${this.kv("Прочность", b.hp / d.hp, "#6fcf6a", Math.round(b.hp))}`;
    if (d.fuel) html += this.kv("Дрова", b.fuel / d.fuel.max, b.fuel < 5 ? "#ef6a5a" : "#e8a040", Math.floor(b.fuel));
    html += "</div>";
    const room = w.roomAt(w.idx(b.x, b.y));
    if (room) html += `<div class="sub" style="margin-top:4px">Комната: ${room.size} кл. · ${Math.round(room.temp)}°C</div>`;
    else if (d.heat) html += `<div class="sub" style="margin-top:4px">Стоит на улице — греть будет только в закрытой комнате.</div>`;
    const btns = [];
    if (d.fuel) btns.push(`<button class="${b.on ? "on" : ""}" data-a="toggleOn">${b.on ? "🔥 Горит" : "Потушено"}</button>`);
    if (d.bench === "cook") {
      html += `<div style="margin-top:8px"><b>Что готовить</b></div>`;
      b.bills.forEach((bill, k) => {
        const r = RECIPES[bill.recipe];
        html += `<div class="row"><button class="${bill.on ? "on" : ""}" data-a="bill" data-v="${k}:toggle" style="min-width:42px">${bill.on ? "✓" : "✗"}</button>
          <div class="grow">${r.name}<div class="sub">${r.raw} сырой еды · пока не будет ${bill.target} (есть ${w.countDef(r.out)})</div></div>
          <div class="stepper"><button data-a="bill" data-v="${k}:-">−</button><b>${bill.target}</b><button data-a="bill" data-v="${k}:+">+</button></div></div>`;
      });
      if (d.fuel && b.fuel <= 0) html += `<div class="sub" style="color:#ffb0a0">Нет дров — не горит. Колонисты подбросят, если есть дерево.</div>`;
    }
    if (d.bench === "research") {
      const cur = w.research.current;
      html += `<div class="sub" style="margin-top:6px">${cur ? `Изучается: <b>${RESEARCH[cur].name}</b> — ${pct((w.research.progress[cur] || 0) / RESEARCH[cur].cost)}%` : "Исследование не выбрано"}</div>`;
      btns.push(`<button class="primary" data-a="modal" data-v="research">🔬 Выбрать исследование</button>`);
    }
    if (d.bed) {
      const o = b.owner ? w.get(b.owner) : null;
      html += `<div class="sub" style="margin-top:6px">${b.forPrisoner ? "Кровать для пленника" : "Владелец"}: ${o && !o.dead ? esc(o.short) : "свободна"}</div>`;
      btns.push(`<button class="${b.forPrisoner ? "on" : ""}" data-a="prisonbed">⛓ Для пленников</button>`);
    }
    if (d.turret) html += `<div class="sub" style="margin-top:4px">Стреляет по врагам в радиусе ${d.turret.range} клеток.</div>`;
    btns.push(`<button class="${b.deconstruct ? "on" : ""}" data-a="decon">${b.deconstruct ? "✖ Не разбирать" : "🔧 Разобрать"}</button>`);
    return html + `<div class="btns">${btns.join("")}</div>`;
  }

  itemCard(it) {
    const w = this.g.w;
    const d = ITEMS[it.def];
    let html = this.head(`${d.name} ×${it.count}`, img(itemIcon(it.def), 36)) + `<div class="sub">${ITEM_CATS[d.cat]} · ${w.isStored(it) ? "на складе" : "лежит вне склада"} · цена ~${Math.round(d.value * it.count)}</div>`;
    if (d.nut) html += `<div class="sub">Сытность: ${d.nut} за единицу${d.cat === "raw" ? " (сырое настроение портит — лучше приготовить)" : ""}</div>`;
    if (d.weapon) {
      const wp = WEAPONS[d.weapon];
      html += `<div class="sub">${wp.melee ? "Ближний бой" : `Дальность ${wp.range}`} · урон ${wp.dmg} · ${Math.round((60 / wp.cd) * 10) / 10} уд/сек</div><div class="btns"><button class="primary" data-a="equipItem">🔫 Выдать колонисту</button></div>`;
    }
    return html;
  }

  zoneCard(z) {
    const w = this.g.w;
    let html = this.head(z.name) + `<div class="sub">${z.type === "stock" ? "Склад: колонисты с работой «Переноска» сносят сюда вещи." : "Поле: колонисты с работой «Растения» сеют и собирают урожай."} ${z.cells ? z.cells.length : 0} кл.</div>`;
    if (z.type === "grow") {
      html += `<div style="margin-top:8px"><b>Культура</b></div><div class="grid" style="margin-top:6px">`;
      for (const c of CROPS) {
        const p = PLANTS[PLANT[c]];
        const ok = w.cropAllowed(c);
        const y = Object.entries(p.harvest).map(([k, n]) => `${n} ${ITEMS[k].name.toLowerCase()}`).join("");
        html += `<button class="tile ${z.crop === c ? "on" : ""} ${ok ? "" : "locked"}" data-a="${ok ? "crop" : "lockedc"}" data-v="${c}">${img(plantIcon(PLANT[c]), 36)}<span>${p.name}</span><small>${ok ? `${p.grow} дн. · ${y}` : "Нужно: " + RESEARCH[p.research].name}</small></button>`;
      }
      html += `</div>`;
      if (w.outT <= 3) html += `<div class="sub" style="color:#ffb0a0;margin-top:6px">Сейчас холодно — посев начнётся, когда потеплеет.</div>`;
    } else {
      html += `<div style="margin-top:8px"><b>Что хранить</b></div><div class="btns">`;
      for (const [k, n] of Object.entries(ITEM_CATS)) html += `<button class="${z.filter[k] ? "on" : ""}" data-a="filter" data-v="${k}">${z.filter[k] ? "✓ " : ""}${n}</button>`;
      html += `</div>`;
    }
    return html + `<div class="btns"><button class="danger" data-a="delzone">🗑 Удалить зону</button></div>`;
  }

  plantCard(i) {
    const w = this.g.w;
    const d = PLANTS[w.plant[i]];
    const gr = w.growth[i];
    const t = w.tempAt(i);
    let html = this.head(d.name, img(plantIcon(w.plant[i]), 36)) + `<div class="kv">${this.kv("Рост", gr, gr >= 1 ? "#6fcf6a" : "#a8d070", pct(gr) + "%")}</div>`;
    html += `<div class="sub" style="margin-top:4px">${gr >= 1 ? "Созрело" : t <= 0 ? "Не растёт: слишком холодно" : "Растёт"}${d.yield ? ` · даст ~${Math.round(d.yield.wood * gr)} дерева` : ""}</div>`;
    const ds = w.desig[i];
    const btns = [];
    if (d.tree) btns.push(`<button class="${ds & DESIG.CUT ? "on" : ""}" data-a="pdesig" data-v="cut">${ds & DESIG.CUT ? "✖ Не рубить" : "🪓 Срубить"}</button>`);
    else if (d.harvest) btns.push(`<button class="${ds & DESIG.HARVEST ? "on" : ""}" data-a="pdesig" data-v="harvest">${ds & DESIG.HARVEST ? "✖ Не собирать" : "🧺 Собрать"}</button>`);
    if (!d.tree) btns.push(`<button class="${ds & DESIG.CUT ? "on" : ""}" data-a="pdesig" data-v="cut">${ds & DESIG.CUT ? "✖ Не убирать" : "✂ Убрать"}</button>`);
    return html + `<div class="btns">${btns.join("")}</div>`;
  }

  rockCard(i) {
    const w = this.g.w;
    const r = ROCKS[w.rock[i]];
    const on = w.desig[i] & DESIG.MINE;
    return this.head(r.name) + `<div class="sub">При добыче: ${ITEMS[r.drop].name.toLowerCase()} ×${r.amount}</div><div class="btns"><button class="${on ? "on" : ""}" data-a="mine1">${on ? "✖ Не добывать" : "⛏ Добыть"}</button></div>`;
  }

  terrainCard(i) {
    const w = this.g.w;
    const t = TERRAIN[w.terrain[i]];
    const fl = w.floor[i] ? FLOORS[w.floor[i]] : null;
    const room = w.roomAt(i);
    return this.head(fl ? fl.name : t.name) + `<div class="sub">${fl ? "" : `Плодородие: ${pct(t.fert)}% · `}${Math.round(w.tempAt(i))}°C${room ? ` · в комнате (${room.size} кл.)` : " · на улице"}</div>`;
  }

  // ---------- подсказка инструмента ----------
  onTool() {
    const g = this.g, t = g.tool, h = this.el.hint;
    if (!t) {
      h.classList.add("hidden");
      this.renderSheet();
      this.updateBack();
      return;
    }
    h.classList.remove("hidden");
    this.el.sheet.classList.add("hidden");
    this.updateHint(null);
    this.updateBack();
    this.renderTip();
  }
  updateHint(count) {
    const g = this.g, t = g.tool, w = g.w;
    if (!t) return;
    let title = "", sub = "";
    if (t.kind === "build") {
      const d = BUILDINGS[t.def];
      title = d.name;
      const mode = { outline: "Проведите пальцем — получится контур комнаты", fill: "Проведите пальцем — заполнить область", line: "Проведите пальцем — линия", single: "Нажмите, куда поставить" }[d.drag];
      const cost = Object.entries(d.cost).map(([k, n]) => `${n * (count || 1)} ${ITEMS[k].name.toLowerCase()} (есть ${w.countDef(k)})`).join(", ");
      sub = `${mode}. ${count ? `Будет: ${count} шт. · ` : ""}${cost}`;
    } else if (t.kind === "zone") {
      title = t.type === "stock" ? "Склад" : "Поле";
      sub = "Проведите пальцем по земле, чтобы отметить зону";
    } else if (t.kind === "erase") {
      title = "Стереть зону";
      sub = "Проведите пальцем по зоне";
    } else {
      title = { mine: "Добыть", cut: "Рубить деревья", harvest: "Собрать урожай", hunt: "Охота", decon: "Разобрать", cancel: "Отменить приказы" }[t.mode];
      sub = "Проведите пальцем, чтобы отметить область";
    }
    this.el.hint.innerHTML = `<div class="t"><b>${esc(title)}</b><small>${esc(sub)} · Двумя пальцами — двигать карту</small></div><button data-a="toolcancel">✕ Готово</button>`;
  }

  flash(text) {
    this.toast({ kind: "neutral", title: "", text }, 2200);
  }

  toast(l, ms) {
    const box = this.el.toasts;
    const el = document.createElement("div");
    el.className = "toast " + (l.kind || "");
    el.innerHTML = `${l.title ? `<b>${esc(l.title)}</b>` : ""}${esc(l.text || "")}`;
    if (l.x != null) {
      el.style.cursor = "pointer";
      el.addEventListener("click", () => {
        this.g.centerOn(l.x, l.y);
        el.remove();
      });
    }
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    const life = ms || (l.kind === "threat" || l.kind === "death" ? 9000 : 5500);
    setTimeout(() => {
      el.classList.add("out");
      setTimeout(() => el.remove(), 450);
    }, life);
  }

  onSelect() {
    if (this.g.sel) this.open.delete("trade");
    this.el.sheet._h = null;
    this.renderSheet();
    this.renderCols();
    this.updateBack();
  }

  // ---------- модальные окна ----------
  openModal(kind) {
    this.modalKind = kind;
    this.el.modal.classList.remove("hidden");
    this.el.modal._h = null;
    if (kind === "trade") this.deal = { buy: {}, sell: {} };
    this.renderModal();
    this.updateBack();
  }
  closeModal() {
    this.modalKind = null;
    this.el.modal.classList.add("hidden");
    this.el.modal.innerHTML = "";
    this.el.modal._h = null;
    this.updateBack();
  }

  renderModal() {
    const k = this.modalKind;
    if (!k) return;
    const fn = {
      work: () => this.workModal(),
      research: () => this.researchModal(),
      trade: () => this.tradeModal(),
      log: () => this.logModal(),
      menu: () => this.menuModal(),
      help: () => this.helpModal(),
      gameover: () => this.gameOverModal(),
      equip: () => this.equipModal(),
      equipItem: () => this.equipItemModal(),
    }[k];
    this.set(this.el.modal, `<div class="mbox">${fn()}</div>`);
  }

  workModal() {
    const w = this.g.w;
    const cols = w.colonists();
    let html = `<h2>Работы</h2><div class="sub">Нажмите на клетку, чтобы поменять: 1 — в первую очередь, 4 — в последнюю, «–» — не делать. Зелёная черта — колонист в этом хорош.</div><div class="wtable" style="margin-top:8px"><table><tr><th></th>`;
    for (const wt of WORK) html += `<th><span class="e">${wt.icon}</span>${wt.name}</th>`;
    html += `</tr>`;
    for (const p of cols) {
      html += `<tr><td class="nm">${esc(p.short)}</td>`;
      for (const wt of WORK) {
        const v = p.work[wt.id] || 0;
        const best = wt.skill && p.skills[wt.skill].lvl >= 8;
        html += `<td><button class="p${v} ${best ? "best" : ""}" data-a="prio" data-v="${p.id}:${wt.id}">${v || "–"}</button></td>`;
      }
      html += `</tr>`;
    }
    return html + `</table></div><div class="btns"><button class="primary" data-a="closemodal">Готово</button></div>`;
  }

  researchModal() {
    const w = this.g.w;
    const bench = [...w.buildings.values()].some((b) => b.complete && b.def === "research");
    let html = `<h2>Наука</h2>${bench ? "" : '<div class="sub" style="color:#ffb0a0">Постройте «Стол учёного» (Строить → Производство), иначе исследовать некому и негде.</div>'}<div class="sub">Выберите проект. Колонисты с работой «Наука» будут работать за столом.</div>`;
    for (const [id, r] of Object.entries(RESEARCH)) {
      const done = w.research.done[id];
      const prog = (w.research.progress[id] || 0) / r.cost;
      const can = w.canResearch(id);
      const cur = w.research.current === id;
      const req = (r.req || []).filter((q) => !w.research.done[q]).map((q) => RESEARCH[q].name);
      html += `<div class="card ${cur ? "on" : ""} ${done ? "done" : ""}" ${can ? `data-a="research" data-v="${id}"` : ""}>
        <div class="row" style="margin:0"><b class="grow">${done ? "✓ " : cur ? "▶ " : ""}${r.name}</b><span class="sub">${r.cost} очков</span></div>
        <div class="sub">${r.desc}</div>
        ${done ? "" : `<div class="pbar" style="margin-top:6px"><i style="width:${pct(prog)}%;background:#6ab0ef"></i></div>`}
        ${req.length ? `<div class="sub" style="color:#ffb0a0">Сначала: ${req.join(", ")}</div>` : ""}
      </div>`;
    }
    return html + `<div class="btns"><button class="primary" data-a="closemodal">Готово</button></div>`;
  }

  tradeModal() {
    const w = this.g.w, t = w.story.trader;
    if (!t || !traderPresent(w)) return `<h2>Торговля</h2><div class="sub">Караван ушёл.</div><div class="btns"><button data-a="closemodal">Закрыть</button></div>`;
    const deal = this.deal;
    const counts = w.counts();
    let bal = 0;
    for (const [d, n] of Object.entries(deal.buy)) bal -= buyPrice(d) * n;
    for (const [d, n] of Object.entries(deal.sell)) bal += sellPrice(d) * n;
    bal = Math.round(bal);
    const silver = counts.silver || 0;
    const step = (d) => (ITEMS[d].stack >= 75 ? 10 : 1);
    const row = (side, d, avail, price) => {
      const n = deal[side][d] || 0;
      return `<div class="trade-row">${img(itemIcon(d), 26)}<div><div>${ITEMS[d].name}</div><div class="sub">${side === "buy" ? "у торговца" : "у вас"}: ${avail} · ${price} сер.</div></div>
        <div class="stepper"><button data-a="tb" data-v="${side}:${d}:-${step(d)}">−</button><b data-a="tmax" data-v="${side}:${d}">${n}</b><button data-a="tb" data-v="${side}:${d}:${step(d)}">+</button></div></div>`;
    };
    let html = `<h2>Торговля</h2><div class="sub">Серебро колонии: ${silver} · у торговца: ${t.silver}. Нажмите на число — взять всё.</div>`;
    html += `<div style="margin-top:8px"><b>Купить</b></div>`;
    for (const [d, n] of Object.entries(t.stock)) if (d !== "silver") html += row("buy", d, n, buyPrice(d));
    html += `<div style="margin-top:10px"><b>Продать</b></div>`;
    const sellable = Object.entries(counts).filter(([d, n]) => d !== "silver" && n > 0);
    if (!sellable.length) html += `<div class="sub">Нечего продать</div>`;
    for (const [d, n] of sellable) html += row("sell", d, n, sellPrice(d));
    const after = silver + bal;
    const bad = after < 0 || (bal > 0 && t.silver < bal);
    const empty = !Object.values(deal.buy).some((n) => n > 0) && !Object.values(deal.sell).some((n) => n > 0);
    html += `<div class="card" style="margin-top:10px">Итог сделки: <b class="${bal >= 0 ? "pos" : "neg"}">${bal >= 0 ? "+" : ""}${bal}</b> серебра → станет ${after}${bad ? `<div class="sub" style="color:#ffb0a0">${after < 0 ? "Не хватает серебра" : "У торговца не хватит серебра"}</div>` : ""}</div>`;
    html += `<div class="btns"><button data-a="closemodal">Закрыть</button><button class="primary" data-a="dotrade" ${bad || empty ? "disabled" : ""}>🤝 Обменять</button></div>`;
    return html;
  }

  logModal() {
    const w = this.g.w;
    const st = w.stats;
    let html = `<h2>${esc(w.colonyName)}</h2><div class="sub">День ${w.day + 1}, ${w.seasonName.toLowerCase()}, год ${w.year} · ${w.diff.name} рассказчик</div>`;
    html += `<div class="card"><div class="kv" style="grid-template-columns:1fr auto">
      <span>Колонистов</span><span>${w.colonists().length}</span>
      <span>Пленников</span><span>${w.pawns.filter((p) => p.kind === "prisoner" && !p.dead).length}</span>
      <span>Богатство</span><span>${Math.round(w.wealth())}</span>
      <span>Налётов</span><span>${st.raids}</span>
      <span>Врагов повержено</span><span>${st.kills}</span>
      <span>Потери</span><span>${st.deaths}</span>
      <span>Еды хватит на</span><span>~${Math.floor(w.totalNutrition() / Math.max(1, w.colonists().length * 0.8))} дн.</span>
    </div></div>`;
    html += `<div><b>Задачи</b></div>`;
    for (const t of TASKS) html += `<div class="thought"><span>${t.done(w) ? "✅" : "⬜"} ${esc(t.text)}</span></div>`;
    html += `<div style="margin-top:10px"><b>События</b></div>`;
    const ls = w.letters.slice().reverse();
    if (!ls.length) html += `<div class="sub">Пока тихо</div>`;
    for (const l of ls) html += `<div class="letter ${l.kind}" ${l.x != null ? `data-a="jump" data-v="${l.x}:${l.y}"` : ""}><b>${esc(l.title)}</b> <span class="sub">день ${l.day + 1}</span><div>${esc(l.text)}</div></div>`;
    return html + `<div class="btns"><button class="primary" data-a="closemodal">Закрыть</button></div>`;
  }

  menuModal() {
    const g = this.g;
    return `<h2>Меню</h2><div class="sub">${esc(g.w.colonyName)} · день ${g.w.day + 1}</div>
      <div class="btns" style="flex-direction:column">
        <button class="primary" data-a="closemodal">▶ Продолжить</button>
        <button data-a="save">💾 Сохранить${TG.hasCloud() ? " в облако" : ""}</button>
        ${TG.canFullscreen() ? `<button data-a="fullscreen">⛶ ${TG.isFullscreen() ? "Выйти из полноэкранного" : "Полный экран"}</button>` : ""}
        <button data-a="modal" data-v="help">❓ Как играть</button>
        <button class="${g.settings.autoPause ? "on" : ""}" data-a="set" data-v="autoPause">⏸ Пауза при угрозе: ${g.settings.autoPause ? "вкл" : "выкл"}</button>
        <button class="${!g.settings.hideTips ? "on" : ""}" data-a="set" data-v="hideTips">💡 Подсказки: ${g.settings.hideTips ? "выкл" : "вкл"}</button>
        <button data-a="tomenu">🏠 Главное меню</button>
      </div>`;
  }

  helpModal() {
    return `<h2>Как играть</h2>
      <div class="sub" style="font-size:13px;line-height:1.45">
      <p><b>Цель</b> — выжить и вырастить колонию: колонисты сами работают, вы отдаёте приказы и строите.</p>
      <p><b>Управление.</b> Один палец двигает карту, двумя — масштаб. Нажмите на колониста, постройку или клетку — внизу появится карточка с кнопками.</p>
      <p><b>Строительство.</b> «Строить» → выберите постройку и проведите пальцем: стены рисуются контуром комнаты, полы — заливкой. Колонисты принесут материалы и построят.</p>
      <p><b>Зоны.</b> «Склад» — куда сносят вещи. «Поле» — посадки (нажмите на поле, чтобы выбрать культуру).</p>
      <p><b>Приказы.</b> Добыча камня и руды в горах, рубка деревьев, сбор урожая, охота, разбор построек.</p>
      <p><b>Нужды.</b> Еда (костёр + повар превращают сырьё в еду), сон в кроватях, тепло зимой (закрытая комната со стенами и дверью + костёр или печь), настроение.</p>
      <p><b>Угрозы.</b> При налёте нажмите «⚔ В бой». Нажмите на землю — отряд пойдёт туда, на врага — атакует. Стены и мешки с песком дают укрытие. Раненых врачи отнесут в кровати.</p>
      <p><b>Пленные.</b> Раненого врага можно взять в плен (нужна свободная кровать). Надзиратели уговорят его присоединиться.</p>
      <p><b>Работы.</b> Во вкладке «Работы» задайте, кто чем занимается: 1 — самое важное.</p>
      <p><b>Зима</b> наступает на 26-й день: урожай погибает, поэтому заранее запасите еду и дрова.</p>
      <p><b>Сохранение</b> — автоматическое: каждый игровой день и при сворачивании Telegram.</p>
      </div><div class="btns"><button class="primary" data-a="closemodal">Понятно</button></div>`;
  }

  gameOverModal() {
    const w = this.g.w;
    return `<h2>Колония пала</h2><div class="sub">«${esc(w.colonyName)}» продержалась ${w.day + 1} ${plural(w.day + 1, "день", "дня", "дней")}.</div>
      <div class="card"><div class="kv" style="grid-template-columns:1fr auto"><span>Налётов пережито</span><span>${w.stats.raids}</span><span>Врагов повержено</span><span>${w.stats.kills}</span><span>Присоединилось</span><span>${w.stats.joined}</span><span>Построено</span><span>${w.stats.built}</span></div></div>
      <div class="sub">Так бывает на Окраине. Следующая колония будет крепче.</div>
      <div class="btns"><button class="primary" data-a="tomenu">Новая попытка</button></div>`;
  }

  equipModal() {
    const w = this.g.w;
    const p = w.get(this.g.sel && this.g.sel.pawn);
    if (!p) return `<div class="btns"><button data-a="closemodal">Закрыть</button></div>`;
    const ws = [...w.items.values()].filter((it) => ITEMS[it.def].weapon);
    let html = `<h2>Оружие: ${esc(p.short)}</h2><div class="sub">Сейчас: ${WEAPONS[p.weapon || "fists"].name}. Выберите оружие на карте — колонист сходит за ним.</div>`;
    if (!ws.length) html += `<div class="sub" style="margin-top:8px">На карте нет оружия. Его можно купить у торговцев или подобрать за налётчиками.</div>`;
    for (const it of ws) {
      const wp = WEAPONS[ITEMS[it.def].weapon];
      html += `<div class="card" data-a="pickweapon" data-v="${it.id}"><div class="row" style="margin:0">${img(itemIcon(it.def), 30)}<div class="grow"><b>${wp.name}</b><div class="sub">${wp.melee ? "ближний бой" : "дальность " + wp.range} · урон ${wp.dmg}</div></div></div></div>`;
    }
    return html + `<div class="btns"><button data-a="closemodal">Закрыть</button></div>`;
  }

  equipItemModal() {
    const w = this.g.w;
    const it = w.items.get(this.g.sel && this.g.sel.item);
    if (!it) return `<div class="btns"><button data-a="closemodal">Закрыть</button></div>`;
    let html = `<h2>Кому выдать: ${ITEMS[it.def].name}</h2>`;
    for (const p of w.colonists().filter((c) => !c.downed)) html += `<div class="card" data-a="giveweapon" data-v="${p.id}"><div class="row" style="margin:0">${img(portrait(p), 34)}<div class="grow"><b>${esc(p.short)}</b><div class="sub">сейчас: ${WEAPONS[p.weapon || "fists"].name} · стрельба ${p.skills.shooting.lvl}, ближний бой ${p.skills.melee.lvl}</div></div></div></div>`;
    return html + `<div class="btns"><button data-a="closemodal">Закрыть</button></div>`;
  }

  showGameOver() {
    this.openModal("gameover");
  }

  // ---------- кнопка «Назад» Telegram ----------
  updateBack() {
    const g = this.g;
    const need = g.mode === "play" && (this.modalKind || g.tool || g.sel || this.tab);
    TG.setBack(need ? () => this.onBack() : null);
  }
  onBack() {
    const g = this.g;
    if (this.ng) {
      if (this.ng.step === "colonists") this.newGameStep("story");
      else this.showMenu();
      return;
    }
    if (this.modalKind && this.modalKind !== "gameover") this.closeModal();
    else if (g.tool) g.setTool(null);
    else if (g.sel) g.select(null);
    else if (this.tab) {
      this.tab = null;
      this.renderSheet();
    }
    this.updateBack();
  }

  // ---------- нажатия ----------
  onClick(e) {
    const t = e.target.closest("[data-a]");
    if (!t || t.disabled) return;
    const a = t.dataset.a, v = t.dataset.v;
    const g = this.g, w = g.w;
    const sel = g.sel;
    const pawn = sel && sel.pawn != null ? w.get(sel.pawn) : null;
    const bld = sel && sel.building != null ? w.buildings.get(sel.building) : null;
    TG.haptic("select");
    switch (a) {
      // меню
      case "continue": g.continueGame(); break;
      case "newgame": this.ng = null; this.newGameStep("story"); break;
      case "help": this.openModal("help"); break;
      case "menuback": this.showMenu(); break;
      case "diff": this.ng.diff = v; this.newGameStep("story"); break;
      case "ng-next": this.ng.world = null; this.newGameStep("colonists"); break;
      case "ng-back": this.newGameStep("story"); break;
      case "reroll": {
        const ng = this.ng;
        const k = +v;
        const others = ng.cols.filter((_, i) => i !== k).map((c) => c.short);
        ng.cols[k] = makeColonist(ng.world, ng.world.rng, { usedNames: others });
        this.newGameStep("colonists");
        break;
      }
      case "ng-start": {
        const ng = this.ng;
        this.ng = null;
        TG.haptic("success");
        g.newColony(ng.world, ng.cols);
        break;
      }
      // верх
      case "menu": this.openModal("menu"); break;
      case "speed": g.setSpeed(g.speed === +v && +v !== 0 ? 0 : +v); break;
      case "log": this.openModal("log"); break;
      case "col": {
        const p = w.get(+v);
        if (!p) break;
        if (sel && sel.pawn === p.id) g.centerOn(p.x, p.y);
        else {
          g.select({ pawn: p.id });
          g.centerOn(p.x, p.y);
        }
        break;
      }
      case "draftall": {
        const any = w.colonists().some((c) => c.drafted);
        g.draftAll(!any);
        break;
      }
      case "hidetips": g.settings.hideTips = true; g.saveSettings(); this.renderTip(); this.layout(); break;
      // вкладки
      case "tab":
        g.setTool(null);
        g.sel = null;
        this.tab = this.tab === v ? null : v;
        this.el.sheet._h = null;
        this.renderSheet();
        this.updateBack();
        break;
      case "closesheet": g.select(null); this.tab = null; this.renderSheet(); this.updateBack(); break;
      case "bcat": this.buildCat = v; this.renderSheet(); break;
      case "tool-build": g.setTool({ kind: "build", def: v }); break;
      case "tool-desig": g.setTool({ kind: "desig", mode: v }); break;
      case "tool-zone": g.setTool(v === "erase" ? { kind: "erase" } : { kind: "zone", type: v }); break;
      case "toolcancel": g.setTool(null); break;
      case "lockedb": this.flash(`Сначала изучите «${RESEARCH[BUILDINGS[v].research].name}» (вкладка «Наука»)`); break;
      case "lockedc": this.flash(`Сначала изучите «${RESEARCH[PLANTS[PLANT[v]].research].name}»`); break;
      // модалки
      case "modal": this.openModal(v); break;
      case "closemodal": this.closeModal(); break;
      case "prio": {
        const [pid, wt] = v.split(":");
        const p = w.get(+pid);
        if (!p) break;
        const cur = p.work[wt] || 0;
        p.work[wt] = cur === 0 ? 1 : cur >= 4 ? 0 : cur + 1;
        this.renderModal();
        break;
      }
      case "research":
        w.research.current = w.research.current === v ? null : v;
        this.renderModal();
        break;
      case "jump": {
        const [x, y] = v.split(":").map(Number);
        g.centerOn(x, y);
        this.closeModal();
        break;
      }
      case "save":
        g.autosave(true).then(() => this.flash(TG.hasCloud() ? "Сохранено в облако Telegram" : "Сохранено"));
        break;
      case "fullscreen": TG.toggleFullscreen(); this.closeModal(); break;
      case "set":
        g.settings[v] = !g.settings[v];
        g.saveSettings();
        this.renderModal();
        this.renderTip();
        this.layout();
        break;
      case "tomenu": this.closeModal(); g.toMenu(); break;
      // торговля
      case "trade": this.openModal("trade"); break;
      case "tb": {
        const [side, d, delta] = v.split(":");
        const t = w.story.trader;
        const max = side === "buy" ? t.stock[d] || 0 : w.countDef(d);
        this.deal[side][d] = Math.max(0, Math.min(max, (this.deal[side][d] || 0) + +delta));
        this.renderModal();
        break;
      }
      case "tmax": {
        const [side, d] = v.split(":");
        const t = w.story.trader;
        const max = side === "buy" ? t.stock[d] || 0 : w.countDef(d);
        this.deal[side][d] = (this.deal[side][d] || 0) === max ? 0 : max;
        this.renderModal();
        break;
      }
      case "dotrade": {
        const err = executeTrade(w, this.deal);
        if (err) this.flash(err);
        else {
          TG.haptic("success");
          this.flash("Сделка совершена");
          this.deal = { buy: {}, sell: {} };
        }
        this.renderModal();
        break;
      }
      // колонист
      case "draft1": if (pawn) setDrafted(w, pawn, !pawn.drafted); break;
      case "equip": this.openModal("equip"); break;
      case "pickweapon": {
        const it = w.items.get(+v);
        if (pawn && it) {
          orderEquip(w, pawn, it);
          this.flash(`${pawn.short} идёт за оружием`);
        }
        this.closeModal();
        break;
      }
      case "equipItem": this.openModal("equipItem"); break;
      case "giveweapon": {
        const p = w.get(+v);
        const it = sel && w.items.get(sel.item);
        if (p && it) {
          if (p.drafted) setDrafted(w, p, false);
          orderEquip(w, p, it);
          this.flash(`${p.short} идёт за оружием`);
        }
        this.closeModal();
        break;
      }
      case "toggle":
        if (this.open.has(v)) this.open.delete(v);
        else this.open.add(v);
        break;
      case "hunt1": if (pawn) pawn.huntDesig = !pawn.huntDesig; break;
      case "capture": if (pawn) pawn.captureDesig = !pawn.captureDesig; break;
      case "release":
        if (pawn) {
          pawn.release = true;
          pawn.faction = "neutral";
          const b = pawn.bed ? w.buildings.get(pawn.bed) : null;
          if (b && b.owner === pawn.id) b.owner = null;
          pawn.bed = null;
          this.flash(`${pawn.short} уходит на свободу`);
        }
        break;
      // постройки
      case "cancelbp": if (bld) { w.removeBuilding(bld); g.select(null); } break;
      case "decon": if (bld) bld.deconstruct = !bld.deconstruct; break;
      case "toggleOn": if (bld) bld.on = !bld.on; break;
      case "prisonbed": if (bld) { bld.forPrisoner = !bld.forPrisoner; if (bld.owner) { const o = w.get(bld.owner); if (o && o.kind === "colonist") { o.bed = null; bld.owner = null; } } } break;
      case "bill": {
        if (!bld) break;
        const [k, op] = v.split(":");
        const bill = bld.bills[+k];
        if (op === "toggle") bill.on = !bill.on;
        else bill.target = Math.max(1, Math.min(99, bill.target + (op === "+" ? 2 : -2)));
        break;
      }
      // зоны и клетки
      case "crop": {
        const z = w.zones.get(sel.zone);
        if (z) z.crop = v;
        break;
      }
      case "filter": {
        const z = w.zones.get(sel.zone);
        if (z) z.filter[v] = !z.filter[v];
        break;
      }
      case "delzone": {
        const z = w.zones.get(sel.zone);
        if (z) {
          w.ensureZones();
          w.clearZone(z.cells || []);
          w.ensureZones();
        }
        g.select(null);
        break;
      }
      case "pdesig": {
        const f = v === "cut" ? DESIG.CUT : DESIG.HARVEST;
        w.setDesig(sel.cell, f, !(w.desig[sel.cell] & f));
        break;
      }
      case "mine1": w.setDesig(sel.cell, DESIG.MINE, !(w.desig[sel.cell] & DESIG.MINE)); break;
    }
    if (g.mode === "play") {
      this.el.sheet._h = null;
      this.renderSheet();
      this.renderCols();
    }
  }
}

function plantIcon(id) {
  return url("pl" + id, () => {
    const c = cv(64, 64);
    const g = c.getContext("2d");
    const s = plantSprite(id, 3, false);
    const h = (s.height / s.width) * 64;
    const k = Math.min(1, 64 / h);
    g.drawImage(s, (64 - 64 * k) / 2, 64 - h * k, 64 * k, h * k);
    return c;
  });
}

export { COLONIST_CAP, TPD };
