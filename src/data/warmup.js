/* Разминка: лёгкие примеры, с которых ребёнок начинает каждый день.
   Каждый генератор возвращает { q, answer, steps } — формулы внутри $...$ */
import { rnd, pick, m, fmt, frac, fAdd, fSub, tex, gcd } from "../lib/math.js";

const add = () => {
  const a = rnd(12, 89), b = rnd(12, 89);
  const op = pick(["+", "-"]);
  const [x, y] = op === "-" && a < b ? [b, a] : [a, b];
  const r = op === "+" ? x + y : x - y;
  return {
    q: `$${x} ${op} ${y}$`,
    answer: fmt(r),
    steps: op === "+"
      ? [`Сначала десятки: $${Math.floor(x / 10) * 10} + ${Math.floor(y / 10) * 10} = ${(Math.floor(x / 10) + Math.floor(y / 10)) * 10}$`, `Потом единицы: $${x % 10} + ${y % 10} = ${(x % 10) + (y % 10)}$`, `Итого: $${r}$`]
      : [`Удобно вычитать по частям: $${x} - ${Math.floor(y / 10) * 10} = ${x - Math.floor(y / 10) * 10}$`, `$${x - Math.floor(y / 10) * 10} - ${y % 10} = ${r}$`],
  };
};

const mult = () => {
  const a = rnd(2, 9), b = rnd(2, 9);
  if (Math.random() < 0.35) {
    return { q: `$${a * b} : ${a}$`, answer: fmt(b), steps: [`Деление — обратное умножению: $${a} \\cdot ${b} = ${a * b}$, значит $${a * b} : ${a} = ${b}$`] };
  }
  return { q: `$${a} \\cdot ${b}$`, answer: fmt(a * b), steps: [`Таблица умножения: $${a} \\cdot ${b} = ${a * b}$`] };
};

const negatives = () => {
  const a = rnd(-15, 15) || 7, b = rnd(-15, 15) || -4;
  const op = pick(["+", "-", "\\cdot"]);
  const r = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const bTxt = b < 0 ? `(${b})` : b;
  const steps = op === "\\cdot"
    ? [`Знаки: «минус на минус — плюс», «минус на плюс — минус»`, `$${a} \\cdot ${bTxt} = ${r}$`]
    : op === "-"
      ? [`Вычесть число — то же, что прибавить противоположное: $${a} - ${bTxt} = ${a} + ${b < 0 ? -b : `(${-b})`}$`, `Ответ: $${r}$`]
      : [`Складываем с учётом знаков: $${a} + ${bTxt} = ${r}$`];
  return { q: `$${a} ${op} ${bTxt}$`, answer: fmt(r), steps };
};

const fractions = () => {
  const d = pick([2, 4, 5, 8, 10]);
  const d2 = pick([2, 4, 5, 10].filter((x) => x !== d || Math.random() < 0.3));
  const a = frac(rnd(1, d - 1), d), b = frac(rnd(1, d2 - 1), d2);
  const op = pick(["+", "-"]);
  const r = op === "+" ? fAdd(a, b) : fSub(a, b);
  const L = (a.d * b.d) / gcd(a.d, b.d);
  return {
    q: `$${tex(a)} ${op} ${tex(b)}$`,
    answer: fmt(r.n / r.d),
    hint: "Ответ запиши десятичной дробью",
    steps: [
      `Общий знаменатель: $${L}$`,
      `$${tex(a)} ${op} ${tex(b)} = \\frac{${a.n * (L / a.d)}}{${L}} ${op} \\frac{${b.n * (L / b.d)}}{${L}} = ${tex(r)}$`,
      `В десятичном виде: $${m(r.n / r.d)}$`,
    ],
  };
};

const decimals = () => {
  const kind = pick(["add", "mul"]);
  if (kind === "add") {
    const a = rnd(11, 99) / 10, b = rnd(11, 99) / 10;
    return { q: `$${m(a)} + ${m(b)}$`, answer: fmt(a + b), steps: ["Пишем запятую под запятой и складываем как обычные числа", `$${m(a)} + ${m(b)} = ${m(a + b)}$`] };
  }
  const a = rnd(2, 9) / 10, b = rnd(2, 9);
  return { q: `$${m(a)} \\cdot ${b}$`, answer: fmt(a * b), steps: [`Умножаем без запятой: $${a * 10} \\cdot ${b} = ${a * 10 * b}$`, `В множителе одна цифра после запятой — отделяем одну: $${m(a * b)}$`] };
};

const percents = () => {
  const p = pick([10, 20, 25, 50, 5, 30, 40, 75]);
  const base = pick([40, 60, 80, 120, 200, 240, 300, 400, 500, 800]);
  const r = (base * p) / 100;
  return { q: `$${p}\\%$ от $${base}$`, answer: fmt(r), steps: [`$1\\% = ${m(base / 100)}$`, `$${p}\\% = ${m(base / 100)} \\cdot ${p} = ${m(r)}$`] };
};

const powers = () => {
  if (Math.random() < 0.5) {
    const a = rnd(2, 15);
    return { q: `$${a}^2$`, answer: fmt(a * a), steps: [`$${a}^2 = ${a} \\cdot ${a} = ${a * a}$`] };
  }
  const a = rnd(2, 15);
  return { q: `$\\sqrt{${a * a}}$`, answer: fmt(a), steps: [`Ищем число, квадрат которого равен $${a * a}$: $${a}^2 = ${a * a}$`] };
};

const equations = () => {
  const x = rnd(-9, 12) || 3, a = rnd(2, 9), b = rnd(-20, 20);
  const c = a * x + b;
  return {
    q: `$${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)} = ${c}$`,
    answer: fmt(x),
    hint: "Найди $x$",
    steps: [`Переносим число вправо: $${a}x = ${c} ${b < 0 ? "+" : "-"} ${Math.abs(b)} = ${a * x}$`, `Делим на $${a}$: $x = ${x}$`],
  };
};

export const WARMUPS = [
  { id: "add", title: "Сложение и вычитание", emoji: "➕", color: "#4F7CFF", gen: add },
  { id: "mult", title: "Таблица умножения", emoji: "✖️", color: "#FF8A3D", gen: mult },
  { id: "neg", title: "Отрицательные числа", emoji: "🧊", color: "#22B8CF", gen: negatives },
  { id: "frac", title: "Дроби", emoji: "🍕", color: "#F06595", gen: fractions },
  { id: "dec", title: "Десятичные дроби", emoji: "🔢", color: "#7950F2", gen: decimals },
  { id: "pct", title: "Проценты", emoji: "💯", color: "#12B886", gen: percents },
  { id: "pow", title: "Квадраты и корни", emoji: "🟪", color: "#FAB005", gen: powers },
  { id: "eq", title: "Уравнения в два шага", emoji: "⚖️", color: "#E8590C", gen: equations },
];

export const blitzTask = () => pick(WARMUPS).gen();
