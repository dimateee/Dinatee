// Прогоняет каждый генератор тысячи раз и ловит сломанные задания:
// NaN, undefined, слишком длинные ответы, ответ не проходит собственную проверку.
import { SUBJECTS } from "../src/data/subjects/index.js";
import { WARMUPS } from "../src/data/warmup.js";
import { checkAnswer } from "../src/lib/math.js";

const RUNS = 3000;
let errors = 0;
const bad = (where, task, why) => {
  if (errors++ < 30) console.error(`✗ ${where}: ${why}\n  ${JSON.stringify(task).slice(0, 400)}`);
};

function check(where, task) {
  const text = JSON.stringify(task);
  if (/\bNaN\b|undefined|Infinity|\bnull\b/.test(text)) return bad(where, task, "NaN/undefined в тексте");
  if (!task.q || !task.answer || !Array.isArray(task.steps) || !task.steps.length) return bad(where, task, "нет полей");
  if (task.answer.length > 10) return bad(where, task, "слишком длинный ответ");
  if (task.kind === "choice" && new Set(task.options).size < 2) return bad(where, task, "меньше двух вариантов");
  if (!checkAnswer(task, task.answer)) return bad(where, task, "ответ не проходит проверку");
  if (task.kind === "choice" && !(Number(task.answer) >= 1 && Number(task.answer) <= task.options.length)) return bad(where, task, "номер варианта вне списка");
  if (!task.kind || task.kind === "number") {
    const v = Number(task.answer.replace(",", "."));
    if (!Number.isFinite(v)) return bad(where, task, "ответ не число");
    const dec = (task.answer.split(",")[1] || "").length;
    if (dec > 3) return bad(where, task, "больше трёх знаков после запятой");
  }
  if (task.options && new Set(task.options).size !== task.options.length) return bad(where, task, "повторяются варианты");
}

for (const s of SUBJECTS) for (const t of s.topics) for (let i = 0; i < RUNS; i++) check(`${s.short} · ${t.title}`, t.gen());
for (const w of WARMUPS) for (let i = 0; i < RUNS; i++) check(`Разминка ${w.id}`, w.gen());
for (const s of SUBJECTS) for (let i = 0; i < 100; i++) {
  const v = s.makeTest();
  if (v.length !== (s.id === "math" ? 19 : 12)) bad(`Тест ${s.short}`, v.length, "неверное число заданий");
  const g = s.grade(v.map(() => true), v);
  // В математике только первая часть: максимум 19 баллов — это «4» по шкале ФИПИ
  if (g.grade !== (s.id === "math" ? 4 : 5)) bad(`Тест ${s.short}`, g, "неверная оценка за все верные ответы");
}
console.log(errors ? `Ошибок: ${errors}` : "Все генераторы в порядке ✓");
process.exit(errors ? 1 : 0);
