// Корзина: выбираешь магазин — RITM собирает продукты на приём пищи, день или неделю под твою норму КБЖУ
// и бюджет, считает цену и сколько упаковок купить.
//
// Цены и ассортимент — ориентировочные: у сетей нет открытого API с ценами, поэтому здесь типичный набор
// продуктов, который есть почти в любом магазине сети, и средняя цена упаковки по Москве. Человек может
// поправить цену или убрать продукт, которого нет в его магазине, — приложение это запоминает (state.basket).
// КБЖУ — на 100 г продукта в том виде, в каком его взвешивают дома: крупы и макароны — сухими, мясо и рыба — сырыми.

export const BASKET_PRICES_NOTE = "Цены примерные, по Москве. Если в твоём магазине другая — нажми на цену и поправь, RITM запомнит.";

// k — во сколько раз цены сети отличаются от средних; limited — у сети небольшой ассортимент (дискаунтер)
export const STORES = [
  { id: "pyaterochka", name: "Пятёрочка", k: 1.0, color: "#E31E24" },
  { id: "magnit", name: "Магнит", k: 0.98, color: "#E2001A" },
  { id: "perekrestok", name: "Перекрёсток", k: 1.12, color: "#0B7A3E" },
  { id: "lenta", name: "Лента", k: 0.96, color: "#1F3D8A" },
  { id: "auchan", name: "Ашан", k: 0.95, color: "#E30613" },
  { id: "vkusvill", name: "ВкусВилл", k: 1.22, color: "#4CAF50" },
  { id: "chizhik", name: "Чижик", k: 0.86, color: "#F5C400", limited: true },
];

// role: protein | carb | veg | fruit | dairy | fat — для разнообразия корзины.
// meals: в какие приёмы пищи продукт уместен (0 завтрак, 1 обед, 2 ужин, 3 перекус).
// min/max — разумная порция за день в граммах, step — шаг подбора. piece — вес одной штуки (яйцо, банан).
// pack — граммов в упаковке, price — средняя цена упаковки, ₽. al — аллергены (ключи ALLERGENS в App.jsx).
// premium — нет в дискаунтерах (Чижик).
export const BASKET_PRODUCTS = [
  // Белок
  { id: "chicken", pref: 1.2, name: "Куриное филе", role: "protein", meals: [1, 2], kcal: 113, p: 23.6, f: 1.9, c: 0.4, pack: 800, packLabel: "800 г", price: 429, min: 120, max: 400, step: 40, raw: true },
  { id: "thigh", name: "Филе куриного бедра", role: "protein", meals: [1, 2], kcal: 160, p: 19, f: 9.5, c: 0, pack: 700, packLabel: "700 г", price: 379, min: 120, max: 350, step: 40, raw: true },
  { id: "turkey", name: "Фарш индейки", role: "protein", meals: [1, 2], kcal: 161, p: 17.5, f: 10, c: 0, pack: 400, packLabel: "400 г", price: 269, min: 100, max: 300, step: 50, raw: true },
  { id: "beef", name: "Говядина для тушения", role: "protein", meals: [1, 2], kcal: 187, p: 18.9, f: 12.4, c: 0, pack: 500, packLabel: "500 г", price: 529, min: 100, max: 300, step: 50, raw: true },
  { id: "liver", pref: 0.5, name: "Куриная печень", role: "protein", meals: [1, 2], kcal: 137, p: 20.4, f: 5.9, c: 0.7, pack: 500, packLabel: "500 г", price: 189, min: 100, max: 150, step: 50, raw: true },
  { id: "pollock", pref: 1.05, name: "Минтай, филе замороженное", role: "protein", meals: [1, 2], kcal: 72, p: 16, f: 0.9, c: 0, pack: 800, packLabel: "800 г", price: 379, min: 150, max: 400, step: 50, raw: true, al: ["fish"] },
  { id: "salmon", name: "Горбуша, филе", role: "protein", meals: [1, 2], kcal: 140, p: 20.5, f: 6.5, c: 0, pack: 500, packLabel: "500 г", price: 449, min: 120, max: 300, step: 40, raw: true, al: ["fish"], premium: true },
  { id: "tuna", grp: "canfish", name: "Тунец в собственном соку", role: "protein", meals: [1, 2, 3], kcal: 96, p: 22, f: 1, c: 0, pack: 185, packLabel: "банка 185 г", price: 169, min: 90, max: 185, step: 45, al: ["fish"] },
  { id: "mackerel", grp: "canfish", name: "Скумбрия в собственном соку", role: "protein", meals: [1, 2], kcal: 191, p: 18, f: 13.2, c: 0, pack: 250, packLabel: "банка 250 г", price: 179, min: 100, max: 250, step: 50, al: ["fish"] },
  { id: "eggs", pref: 1.05, name: "Яйца С1", role: "protein", meals: [0, 1, 2], kcal: 157, p: 12.7, f: 11.5, c: 0.7, pack: 550, packLabel: "10 шт", price: 119, min: 110, max: 220, step: 55, piece: 55, pieceWord: ["яйцо", "яйца", "яиц"], al: ["eggs"] },
  { id: "cottage", pref: 1.05, grp: "cottage", name: "Творог 5%", role: "dairy", meals: [0, 2, 3], kcal: 121, p: 17, f: 5, c: 1.8, pack: 350, packLabel: "350 г", price: 189, min: 100, max: 350, step: 50, al: ["milk"] },
  { id: "cottage2", pref: 1.05, grp: "cottage", name: "Творог 2%", role: "dairy", meals: [0, 2, 3], kcal: 103, p: 18, f: 2, c: 3.3, pack: 200, packLabel: "200 г", price: 109, min: 100, max: 400, step: 50, al: ["milk"] },
  { id: "greek", name: "Йогурт греческий 2%", role: "dairy", meals: [0, 3], kcal: 66, p: 8, f: 2, c: 3.5, pack: 140, packLabel: "140 г", price: 79, min: 140, max: 420, step: 140, al: ["milk"], premium: true },
  { id: "kefir", grp: "drink", name: "Кефир 1%", role: "dairy", meals: [0, 3], kcal: 40, p: 3, f: 1, c: 4, pack: 900, packLabel: "900 мл", price: 95, min: 200, max: 500, step: 100, ml: true, al: ["milk"] },
  { id: "milk", grp: "drink", name: "Молоко 2,5%", role: "dairy", meals: [0, 3], kcal: 53, p: 2.9, f: 2.5, c: 4.7, pack: 900, packLabel: "900 мл", price: 89, min: 150, max: 500, step: 50, ml: true, al: ["milk"] },
  { id: "cheese", name: "Сыр Российский", role: "dairy", meals: [0, 3], kcal: 363, p: 24.1, f: 29.5, c: 0.3, pack: 200, packLabel: "200 г", price: 229, min: 20, max: 60, step: 10, al: ["milk"] },
  { id: "tofu", pref: 0.8, name: "Тофу", role: "protein", meals: [1, 2], kcal: 121, p: 12.5, f: 7, c: 2, pack: 300, packLabel: "300 г", price: 219, min: 100, max: 300, step: 50, al: ["soy"], premium: true },
  { id: "lentils", grp: "legume", name: "Чечевица красная", role: "carb", meals: [1, 2], kcal: 314, p: 24, f: 1.5, c: 48, pack: 450, packLabel: "450 г", price: 119, min: 50, max: 120, step: 10 },
  { id: "chickpeas", grp: "legume", name: "Нут", role: "carb", meals: [1, 2], kcal: 364, p: 19, f: 6, c: 61, pack: 450, packLabel: "450 г", price: 129, min: 50, max: 120, step: 10 },
  { id: "beans", pref: 0.85, grp: "legume", name: "Фасоль красная консервированная", role: "carb", meals: [1, 2], kcal: 99, p: 6.7, f: 0.3, c: 17.4, pack: 400, packLabel: "банка 400 г", price: 109, min: 100, max: 300, step: 50 },
  // Углеводы
  { id: "buckwheat", pref: 1.1, name: "Гречка", role: "carb", meals: [0, 1, 2], kcal: 313, p: 12.6, f: 3.3, c: 62.1, pack: 900, packLabel: "900 г", price: 109, min: 50, max: 150, step: 10 },
  { id: "rice", name: "Рис", role: "carb", meals: [1, 2], kcal: 333, p: 7, f: 1, c: 74, pack: 900, packLabel: "900 г", price: 119, min: 50, max: 150, step: 10 },
  { id: "oats", name: "Овсяные хлопья", role: "carb", meals: [0, 3], kcal: 352, p: 12.3, f: 6.2, c: 61.8, pack: 400, packLabel: "400 г", price: 75, min: 40, max: 120, step: 10, al: ["gluten"] },
  { id: "pasta", name: "Макароны из твёрдых сортов", role: "carb", meals: [1, 2], kcal: 344, p: 12, f: 1.5, c: 70, pack: 450, packLabel: "450 г", price: 89, min: 60, max: 150, step: 10, al: ["gluten"] },
  { id: "bulgur", name: "Булгур", role: "carb", meals: [1, 2], kcal: 342, p: 12.3, f: 1.3, c: 57.6, pack: 400, packLabel: "400 г", price: 109, min: 50, max: 130, step: 10, al: ["gluten"], premium: true },
  { id: "bread", name: "Хлеб цельнозерновой", role: "carb", meals: [0, 1, 2, 3], kcal: 235, p: 8, f: 3, c: 43, pack: 300, packLabel: "300 г", price: 69, min: 30, max: 150, step: 30, al: ["gluten"] },
  { id: "potato", name: "Картофель", role: "carb", meals: [1, 2], kcal: 77, p: 2, f: 0.4, c: 16.3, pack: 1500, packLabel: "1,5 кг", price: 89, min: 150, max: 500, step: 50 },
  // Фрукты
  { id: "banana", name: "Бананы", role: "fruit", meals: [0, 3], kcal: 96, p: 1.5, f: 0.5, c: 21, pack: 1000, packLabel: "1 кг", price: 139, min: 120, max: 240, step: 120, piece: 120, pieceWord: ["банан", "банана", "бананов"] },
  { id: "apple", name: "Яблоки", role: "fruit", meals: [0, 3], kcal: 47, p: 0.4, f: 0.4, c: 9.8, pack: 1000, packLabel: "1 кг", price: 129, min: 180, max: 360, step: 180, piece: 180, pieceWord: ["яблоко", "яблока", "яблок"] },
  { id: "orange", name: "Апельсины", role: "fruit", meals: [0, 3], kcal: 43, p: 0.9, f: 0.2, c: 8.1, pack: 1000, packLabel: "1 кг", price: 159, min: 200, max: 400, step: 200, piece: 200, pieceWord: ["апельсин", "апельсина", "апельсинов"] },
  { id: "berries", name: "Ягоды замороженные", role: "fruit", meals: [0, 3], kcal: 50, p: 1, f: 0.3, c: 10, pack: 300, packLabel: "300 г", price: 189, min: 100, max: 200, step: 50, premium: true },
  // Овощи
  { id: "cucumber", pref: 1.1, name: "Огурцы", role: "veg", meals: [0, 1, 2], kcal: 15, p: 0.8, f: 0.1, c: 2.8, pack: 450, packLabel: "450 г", price: 129, min: 100, max: 300, step: 50 },
  { id: "tomato", pref: 1.1, name: "Помидоры", role: "veg", meals: [0, 1, 2], kcal: 20, p: 1.1, f: 0.2, c: 3.7, pack: 500, packLabel: "500 г", price: 159, min: 100, max: 300, step: 50 },
  { id: "cabbage", pref: 0.9, name: "Капуста белокочанная", role: "veg", meals: [1, 2], kcal: 28, p: 1.8, f: 0.1, c: 4.7, pack: 1000, packLabel: "≈1 кг", price: 45, min: 100, max: 300, step: 50 },
  { id: "carrot", name: "Морковь", role: "veg", meals: [1, 2, 3], kcal: 35, p: 1.3, f: 0.1, c: 6.9, pack: 1000, packLabel: "1 кг", price: 59, min: 100, max: 250, step: 50 },
  { id: "broccoli", name: "Брокколи замороженная", role: "veg", meals: [1, 2], kcal: 28, p: 3, f: 0.4, c: 5.2, pack: 400, packLabel: "400 г", price: 149, min: 100, max: 300, step: 50 },
  { id: "vegmix", name: "Овощная смесь замороженная", role: "veg", meals: [1, 2], kcal: 35, p: 1.8, f: 0.3, c: 6, pack: 400, packLabel: "400 г", price: 119, min: 100, max: 300, step: 50 },
  // Жиры
  { id: "oil", pref: 0.8, name: "Масло подсолнечное", role: "fat", meals: [1, 2], kcal: 899, p: 0, f: 99.9, c: 0, pack: 830, packLabel: "0,9 л", price: 139, min: 5, max: 20, step: 5, ml: true },
  { id: "walnuts", name: "Грецкие орехи", role: "fat", meals: [0, 3], kcal: 654, p: 15, f: 65, c: 7, pack: 150, packLabel: "150 г", price: 229, min: 15, max: 40, step: 5, al: ["nuts"] },
  { id: "peanuts", pref: 0.85, grp: "peanut", name: "Арахис", role: "fat", meals: [3], kcal: 610, p: 26, f: 52, c: 10, pack: 200, packLabel: "200 г", price: 129, min: 20, max: 40, step: 10, al: ["peanut"] },
  { id: "pbutter", grp: "peanut", name: "Арахисовая паста", role: "fat", meals: [0, 3], kcal: 588, p: 25, f: 50, c: 20, pack: 340, packLabel: "340 г", price: 259, min: 15, max: 40, step: 5, al: ["peanut"] },
  { id: "avocado", name: "Авокадо", role: "fat", meals: [0, 1, 2], kcal: 160, p: 2, f: 14.7, c: 1.8, pack: 170, packLabel: "1 шт", price: 129, min: 85, max: 170, step: 85, piece: 170, pieceWord: ["авокадо", "авокадо", "авокадо"], premium: true },
];

export const BASKET_MODES = [
  { id: "meal", label: "Приём пищи", days: 1 },
  { id: "day", label: "День", days: 1 },
  { id: "week", label: "Неделя", days: 7 },
];

// Сколько продуктов каждого вида брать в корзину: на день — разнообразно, на один приём — коротко
const ROLE_CAPS = {
  day: { protein: 2, dairy: 2, carb: 3, veg: 2, fruit: 2, fat: 1 },
  meal: { protein: 1, dairy: 1, carb: 1, veg: 2, fruit: 1, fat: 1 },
};
const MAX_ITEMS = { day: 10, meal: 4 };
// Порции крупы, мяса и молочного растут вместе с нормой: на 3000 ккал гречки нужно больше, чем на 1800
const REF_KCAL = { day: 2200, meal: [550, 660, 660, 330] };
const SCALED_ROLES = new Set(["protein", "carb", "dairy"]);
// Ориентир по овощам и фруктам: ВОЗ советует от 400 г в день — из них 250 г овощей и 150 г фруктов.
// На приём пищи: к обеду и ужину — овощи, к завтраку — фрукт.
const VEG_TARGET = { day: { veg: 250, fruit: 150 }, meal: [{ veg: 0, fruit: 100 }, { veg: 150, fruit: 0 }, { veg: 150, fruit: 0 }, { veg: 0, fruit: 0 }] };

export const storeById = (id) => STORES.find((s) => s.id === id) || STORES[0];

// Цена упаковки в этой сети: своя цена человека, если он её поправил, иначе средняя × коэффициент сети
export function packPrice(product, store, prices = {}) {
  const own = prices?.[store.id]?.[product.id];
  if (Number(own) > 0) return Number(own);
  return Math.round(product.price * store.k);
}

export function availableProducts(store, { allergies = [], skip = [], missing = {} } = {}) {
  const gone = new Set([...(skip || []), ...((missing && missing[store.id]) || [])]);
  return BASKET_PRODUCTS.filter((p) => !gone.has(p.id)
    && !(store.limited && p.premium)
    && !(p.al || []).some((a) => allergies.includes(a)));
}

// Простой генератор случайных чисел с зерном — «Пересобрать» даёт другой набор, а одно и то же зерно — тот же
function rng(seed) {
  let x = (seed >>> 0) || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

const macroOf = (p, g) => ({ kcal: (p.kcal * g) / 100, p: (p.p * g) / 100, f: (p.f * g) / 100, c: (p.c * g) / 100 });

// Насколько набор далёк от цели: относительные отклонения по калориям и БЖУ (белок и калории важнее),
// перебор калорий наказывается сильнее недобора, плюс недобор овощей и фруктов.
function errorOf(tot, target, plant, plantTarget) {
  const rel = (a, b) => (b > 0 ? (a - b) / b : 0);
  const k = rel(tot.kcal, target.kcal);
  const pr = rel(tot.p, target.p);
  const fa = rel(tot.f, target.f);
  const ca = rel(tot.c, target.c);
  let e = 3 * k * k * (k > 0 ? 2.2 : 1) + 2.4 * pr * pr * (pr > 0.25 ? 1.5 : 1) + 0.9 * fa * fa * (fa > 0 ? 1.6 : 1) + 0.9 * ca * ca;
  for (const key of ["veg", "fruit"]) {
    const need = plantTarget[key];
    if (need > 0 && plant[key] < need) { const v = (need - plant[key]) / need; e += 0.45 * v * v; }
  }
  return e;
}

/**
 * Собирает корзину.
 * target — КБЖУ на один день или на один приём: { kcal, p, f, c }
 * mode — "meal" | "day" | "week"; meal — индекс приёма пищи для режима "meal"
 * budget — бюджет на один день (или один приём), ₽; 0 или null — без ограничений
 * Возвращает { items: [{ product, grams, cost }], total, cost, buyCost, packs, limitedByBudget, fullCost }
 */
export function buildBasket({ store, target, mode = "day", meal = 1, budget = 0, allergies = [], skip = [], missing = {}, prices = {}, seed = 1 }) {
  const days = mode === "week" ? 7 : 1;
  const kind = mode === "meal" ? "meal" : "day";
  const pool = availableProducts(store, { allergies, skip, missing })
    .filter((p) => kind === "day" || p.meals.includes(meal));
  const plantTarget = kind === "day" ? VEG_TARGET.day : VEG_TARGET.meal[meal] || { veg: 0, fruit: 0 };
  const rand = rng(seed * 7919 + 17);
  // У каждого продукта своя «симпатия» на этот запуск — так разные зёрна дают разные наборы
  const like = new Map(pool.map((p) => [p.id, (p.pref || 1) * (seed === 1 ? 1 : 0.65 + rand() * 0.7)]));
  const pricePerG = new Map(pool.map((p) => [p.id, packPrice(p, store, prices) / p.pack]));
  const ref = kind === "day" ? REF_KCAL.day : REF_KCAL.meal[meal] || 600;
  const scale = Math.min(1.8, Math.max(0.8, (target.kcal || ref) / ref));
  const maxG = (p) => {
    const base = kind === "meal" ? p.max * 0.7 : p.max;
    const m = SCALED_ROLES.has(p.role) ? base * scale : base;
    return Math.max(p.min, Math.floor(m / p.step) * p.step);
  };

  const run = (budgetLimit, perRuble) => {
    const grams = new Map();
    const tot = { kcal: 0, p: 0, f: 0, c: 0 };
    let cost = 0;
    let plant = { veg: 0, fruit: 0 };
    const roleCount = {};
    const groups = new Set();
    const caps = ROLE_CAPS[kind];
    for (let guard = 0; guard < 400; guard++) {
      const cur = errorOf(tot, target, plant, plantTarget);
      let best = null;
      for (const p of pool) {
        const g0 = grams.get(p.id) || 0;
        const isNew = g0 === 0;
        if (isNew) {
          if (grams.size >= MAX_ITEMS[kind]) continue;
          if ((roleCount[p.role] || 0) >= (caps[p.role] ?? 1)) continue;
          if (p.grp && groups.has(p.grp)) continue;
        }
        const add = isNew ? p.min : p.step;
        if (g0 + add > maxG(p)) continue;
        const dCost = add * pricePerG.get(p.id);
        if (budgetLimit > 0 && cost + dCost > budgetLimit + 0.5) continue;
        const m = macroOf(p, add);
        const next = { kcal: tot.kcal + m.kcal, p: tot.p + m.p, f: tot.f + m.f, c: tot.c + m.c };
        // Калории сверх нормы больше чем на 6% не набираем даже ради белка или овощей
        if (target.kcal > 0 && next.kcal > target.kcal * 1.06) continue;
        const nextPlant = p.role === "veg" || p.role === "fruit" ? { ...plant, [p.role]: plant[p.role] + add } : plant;
        const gain = cur - errorOf(next, target, nextPlant, plantTarget);
        if (gain <= 1e-6) continue;
        // Новый продукт берём чуть неохотнее, чем добавить к уже выбранному — меньше мелочи в корзине
        // Даже без лимита предпочитаем то, что выгоднее по цене; при упоре в бюджет — пользу на рубль
        let score = gain * like.get(p.id) * (isNew ? 0.92 : 1);
        score /= perRuble ? Math.max(1, dCost) : 1 + dCost / 45;
        if (!best || score > best.score) best = { p, add, dCost, m, nextPlant, score };
      }
      if (!best) break;
      const { p, add, dCost, m } = best;
      if (!grams.has(p.id)) { roleCount[p.role] = (roleCount[p.role] || 0) + 1; if (p.grp) groups.add(p.grp); }
      grams.set(p.id, (grams.get(p.id) || 0) + add);
      tot.kcal += m.kcal; tot.p += m.p; tot.f += m.f; tot.c += m.c;
      cost += dCost;
      plant = best.nextPlant;
    }
    return { grams, tot, cost };
  };

  let res = run(0, false);
  const fullCost = res.cost;
  let limitedByBudget = false;
  if (budget > 0 && res.cost > budget) {
    limitedByBudget = true;
    res = run(budget, true);
  }

  const roleOrder = ["protein", "dairy", "carb", "veg", "fruit", "fat"];
  const items = [...res.grams.entries()]
    .map(([id, g]) => {
      const product = pool.find((p) => p.id === id);
      const totalG = g * days;
      const packs = Math.max(1, Math.ceil(totalG / product.pack - 0.02));
      const pp = packPrice(product, store, prices);
      return { product, grams: g, totalGrams: totalG, cost: g * pricePerG.get(id) * days, packs, packPrice: pp, buyCost: packs * pp };
    })
    .sort((a, b) => roleOrder.indexOf(a.product.role) - roleOrder.indexOf(b.product.role) || b.grams - a.grams);
  const round = (x) => Math.round(x);
  return {
    items,
    days,
    total: { kcal: round(res.tot.kcal), p: round(res.tot.p), f: round(res.tot.f), c: round(res.tot.c) },
    cost: round(res.cost * days),
    buyCost: items.reduce((s, it) => s + it.buyCost, 0),
    fullCost: round(fullCost * days),
    limitedByBudget,
  };
}

// «2 яйца», «1 банан», «120 г», «300 мл»; для круп и мяса — пометка про вес
export function amountLabel(product, grams) {
  if (product.piece) {
    const n = Math.round(grams / product.piece);
    if (n >= 1 && Math.abs(n * product.piece - grams) < 1) return `${n}\u00a0${plural(n, product.pieceWord)}`;
  }
  const unit = product.ml ? "мл" : "г";
  if (grams >= 1000 && grams % 100 === 0) return `${(grams / 1000).toLocaleString("ru-RU")}\u00a0${product.ml ? "л" : "кг"}`;
  return `${grams}\u00a0${unit}`;
}
export const weightHint = (product) => (product.role === "carb" && /гречк|рис|овсян|макарон|булгур|чечевиц|нут/i.test(product.name) ? "вес сухим" : product.raw ? "вес сырым" : "");

function plural(n, [one, few, many]) {
  const m = n % 100;
  if (m >= 11 && m <= 14) return many;
  const l = n % 10;
  return l === 1 ? one : l >= 2 && l <= 4 ? few : many;
}
export const packsWord = (n) => plural(n, ["упаковка", "упаковки", "упаковок"]);
