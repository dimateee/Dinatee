/* ============ Расчёт калорий и БЖУ ============ */
// По методике «Расчёт калорий и БЖУ»:
// 1) основной обмен (BMR) — Миффлин–Сан Жеор, или Кэтч–Макардл, если известен процент жира;
// 2) суточный расход (TDEE) = BMR × коэффициент активности;
// 3) целевая калорийность = TDEE с поправкой под цель (0%, −10…−20%, +5…+15%);
// 4) белок и жиры — от массы тела, углеводы — остатком калорийности.

// Энергетические коэффициенты Атвотера (те же закреплены в ТР ТС 022/2011), ккал на 1 г
export const ATWATER = { protein: 4, carbs: 4, fat: 9, alcohol: 7, fiber: 2, polyols: 2.4, acids: 3 };

export const ACTIVITY = [
  { k: 1.2, label: "Сидячая работа, без тренировок" },
  { k: 1.375, label: "Лёгкая активность, 1–3 тренировки в неделю" },
  { k: 1.55, label: "Умеренная активность, 3–5 тренировок в неделю" },
  { k: 1.725, label: "Высокая активность, 6–7 тренировок в неделю" },
  { k: 1.9, label: "Физический труд плюс тренировки, профессиональный спорт" },
];

// Белок, г на кг: при силовых и/или дефиците — 1,6–2,2 (плато около 1,6, практический потолок 2,2);
// при регулярной активности без силовых акцентов — 1,2–1,6
export const PROTEIN_PER_KG = { mass: 1.8, strength: 1.8, fat: 1.8, endurance: 1.4 };
// Жиры 0,8–1,0 г/кг, это примерно 20–35% калорийности; ниже 0,5–0,6 г/кг опускаться нельзя
export const FAT_PER_KG = 0.9;
const FAT_MIN_PER_KG = 0.6;
const FAT_SHARE = [0.2, 0.35];
export const KCAL_PER_KG_FAT = 7700; // ориентир «1 кг жира ≈ 7700 ккал», работает лишь приблизительно

// Поправка под цель в процентах от TDEE для вариантов темпа в анкете
export const GOAL_PCT = {
  fat: [[10, "Медленно и бережно, дефицит 10%"], [15, "Стандартный темп, дефицит 15%"], [20, "Быстрее, дефицит 20%"]],
  mass: [[5, "Медленно, почти без жира, профицит 5%"], [10, "Стандартный темп, профицит 10%"], [15, "Быстрее, профицит 15%"]],
};
// Старые анкеты хранили темп в % массы тела в неделю — переводим в ближайший вариант
const LEGACY_RATE = { fat: { 0.3: 10, 0.6: 15, 1: 20 }, mass: { 0.25: 5, 0.4: 10, 0.6: 15 } };

/* ---------- основной обмен ---------- */
// Миффлин–Сан Жеор (1990): вес в кг, рост в см, возраст в годах
export const bmrMifflin = ({ sex, weight, height, age }) => 10 * weight + 6.25 * height - 5 * age + (sex === "f" ? -161 : 5);
// Кэтч–Макардл: через безжировую массу
export const leanMass = (weight, bodyFat) => weight * (1 - bodyFat / 100);
export const bmrKatch = (weight, bodyFat) => 370 + 21.6 * leanMass(weight, bodyFat);
// Харрис–Бенедикт (редакция 1984 г.) — для сравнения, у современного населения обычно немного завышает
export const bmrHarris = ({ sex, weight, height, age }) => (sex === "f"
  ? 447.59 + 9.25 * weight + 3.1 * height - 4.33 * age
  : 88.36 + 13.4 * weight + 4.8 * height - 5.68 * age);

export const hasBodyFat = (p) => Number(p.bodyFat) >= 3 && Number(p.bodyFat) <= 60;

/* ---------- параметры анкеты ---------- */
// Коэффициент активности: из анкеты, а для старых анкет — по числу силовых в неделю
export function activityOf(p) {
  if (ACTIVITY.some((a) => a.k === p.activity)) return p.activity;
  return p.days >= 3 ? 1.55 : 1.375;
}
export const activityLabel = (k) => (ACTIVITY.find((a) => a.k === k) || ACTIVITY[1]).label;

// Поправка под цель со знаком: −10…−20% для снижения, +5…+15% для набора, 0 для остальных целей.
// До 18 лет держим поправку мягкой — не больше 10%
export function goalPctOf(p) {
  if (p.goal !== "fat" && p.goal !== "mass") return 0;
  let pct = Number(p.goalPct) || LEGACY_RATE[p.goal][p.rate] || (p.goal === "fat" ? 15 : 10);
  const max = p.age < 18 ? 10 : p.goal === "fat" ? 20 : 15;
  pct = Math.min(Math.max(pct, p.goal === "fat" ? 10 : 5), max);
  return p.goal === "fat" ? -pct : pct;
}
export function goalPctOptions(goal, age) {
  const opts = GOAL_PCT[goal] || [];
  return age < 18 ? opts.filter(([v]) => v <= 10) : opts;
}

// При выраженном избытке веса (ИМТ 30 и выше) белок и жиры считаем на целевой вес
export function macroWeight(p) {
  const h2 = (p.height / 100) ** 2;
  if (p.weight / h2 < 30) return { w: p.weight, reason: "" };
  if (p.goal === "fat" && p.targetKg > 0) {
    const w = Math.max(p.weight - p.targetKg, 25 * h2);
    return { w: Math.min(p.weight, w), reason: "target" };
  }
  return { w: 25 * h2, reason: "bmi" };
}

const round10 = (x) => Math.round(x / 10) * 10;
const roundHalfDown = (x) => Math.ceil(x - 0.5);

/* ---------- суточная норма ---------- */
export function calcNutrition(p) {
  const mifflin = bmrMifflin(p);
  const harris = bmrHarris(p);
  const bf = hasBodyFat(p) ? Number(p.bodyFat) : null;
  const katch = bf != null ? bmrKatch(p.weight, bf) : null;
  const bmr = katch ?? mifflin;
  const k = activityOf(p);
  const tdee = bmr * k;
  const pct = goalPctOf(p);
  let kcal = tdee * (1 + pct / 100);
  // Длительно держать калорийность ниже основного обмена не рекомендуется
  const floor = Math.max(bmr, p.sex === "f" ? 1200 : 1500);
  const floored = kcal < floor;
  kcal = round10(Math.max(kcal, floor));

  const mw = macroWeight(p);
  const proteinPerKg = PROTEIN_PER_KG[p.goal] || 1.6;
  const protein = Math.round(mw.w * proteinPerKg);
  let fat = roundHalfDown(mw.w * FAT_PER_KG);
  // держим жиры в пределах 20–35% калорийности, но не ниже 0,6 г/кг
  if (fat * ATWATER.fat < kcal * FAT_SHARE[0]) fat = Math.round((kcal * FAT_SHARE[0]) / ATWATER.fat);
  if (fat * ATWATER.fat > kcal * FAT_SHARE[1]) fat = Math.max(Math.round((kcal * FAT_SHARE[1]) / ATWATER.fat), Math.round(mw.w * FAT_MIN_PER_KG));
  const carbs = Math.max(0, Math.round((kcal - protein * ATWATER.protein - fat * ATWATER.fat) / ATWATER.carbs));

  const delta = Math.round(kcal - tdee);
  // Вода: 33 мл/кг веса плюс надбавка в тренировочный день на потери с потом
  const waterBase = Math.round((p.weight * 33) / 10) * 10;
  const waterTrain = Math.round((waterBase + 500) / 10) * 10;
  return {
    kcal, protein, fat, carbs, waterBase, waterTrain,
    bmr: Math.round(bmr), formula: katch != null ? "katch" : "mifflin",
    mifflin: Math.round(mifflin), harris: Math.round(harris), katch: katch != null ? Math.round(katch) : null,
    bodyFat: bf, lbm: bf != null ? leanMass(p.weight, bf) : null,
    k, tdee: Math.round(tdee), pct, delta, floored,
    macroWeight: mw.w, macroWeightReason: mw.reason, proteinPerKg, fatPerKg: FAT_PER_KG,
    kgPerWeek: (Math.abs(delta) * 7) / KCAL_PER_KG_FAT,
  };
}

/* ---------- продукты и блюда ---------- */
// Калорийность по составу на 100 г: Б × 4 + Ж × 9 + У × 4 (+ алкоголь × 7, если есть)
export const kcalFromMacros = (p = 0, f = 0, c = 0, alcohol = 0) =>
  p * ATWATER.protein + f * ATWATER.fat + c * ATWATER.carbs + alcohol * ATWATER.alcohol;
// Порция: значение на 100 г × масса порции / 100
export const forPortion = (per100, grams) => ({
  kcal: (per100.kcal * grams) / 100, p: (per100.p * grams) / 100, f: (per100.f * grams) / 100, c: (per100.c * grams) / 100,
});
// Готовое блюдо на 100 г: сумма КБЖУ сырых ингредиентов / масса готового блюда × 100
export function dishPer100(ingredients, cookedGrams) {
  const sum = ingredients.reduce((a, x) => {
    const part = forPortion(x, x.grams);
    return { kcal: a.kcal + part.kcal, p: a.p + part.p, f: a.f + part.f, c: a.c + part.c };
  }, { kcal: 0, p: 0, f: 0, c: 0 });
  const k = cookedGrams > 0 ? 100 / cookedGrams : 0;
  return { kcal: sum.kcal * k, p: sum.p * k, f: sum.f * k, c: sum.c * k };
}
