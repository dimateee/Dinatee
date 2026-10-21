/* Небольшие помощники для генерации заданий: случайные числа, дроби, форматирование */

export const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const sign = () => (Math.random() < 0.5 ? -1 : 1);
export const gcd = (a, b) => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
};
export const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);

// Убираем «хвосты» плавающей точки: 0.1 + 0.2 → 0.3
export const clean = (x) => Number(Number(x).toFixed(8));

// Число для ответа и обычного текста: 1.25 → «1,25»
export const fmt = (x) => String(clean(x)).replace(".", ",");
// Число внутри формулы KaTeX: 1.25 → «1{,}25», чтобы после запятой не было пробела
export const m = (x) => String(clean(x)).replace(".", "{,}");

/* ---------- Обыкновенные дроби ---------- */
export const frac = (n, d = 1) => {
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
};
export const fAdd = (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fSub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fMul = (a, b) => frac(a.n * b.n, a.d * b.d);
export const fDiv = (a, b) => frac(a.n * b.d, a.d * b.n);
export const fVal = (f) => f.n / f.d;
// Дробь записывается конечной десятичной, только если в знаменателе одни двойки и пятёрки
export const isFiniteDec = (f) => {
  let d = f.d;
  while (d % 2 === 0) d /= 2;
  while (d % 5 === 0) d /= 5;
  return d === 1;
};
export const tex = (f) => (f.d === 1 ? m(f.n) : `${f.n < 0 ? "-" : ""}\\frac{${Math.abs(f.n)}}{${f.d}}`);

/* ---------- Многочлены и знаки ---------- */
// term(3, "x", true) → «+ 3x», term(-1, "x") → «- x», term(5, "") → «+ 5»
export const term = (c, v = "", first = false) => {
  if (c === 0) return "";
  const abs = Math.abs(c);
  const body = v && abs === 1 ? v : `${m(abs)}${v}`;
  if (first) return `${c < 0 ? "-" : ""}${body}`;
  return ` ${c < 0 ? "-" : "+"} ${body}`;
};
// poly([[1,"x^2"],[-5,"x"],[6,""]]) → «x^2 - 5x + 6»
export const poly = (terms) => {
  let out = "";
  for (const [c, v] of terms) {
    if (c === 0) continue;
    out += term(c, v, out === "");
  }
  return out || "0";
};
// Число в скобках, если отрицательное: (-3)
export const par = (x) => (x < 0 ? `(${m(x)})` : m(x));

/* ---------- Проверка ответа ---------- */
const norm = (s) => String(s ?? "").trim().replace(/\s+/g, "").replace(/−/g, "-").replace(/,/g, ".").replace(/^\+/, "");

export function checkAnswer(task, input) {
  const a = norm(input);
  const b = norm(task.answer);
  if (!a) return false;
  // Для заданий «запишите номера верных утверждений» порядок цифр не важен
  if (task.kind === "set") return [...a].sort().join("") === [...b].sort().join("");
  if (task.kind === "choice" || task.kind === "digits") return a === b;
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-9;
  return a.toLowerCase() === b.toLowerCase();
}
