// Прогоняет каждый генератор тысячи раз и ловит сломанные задания:
// NaN, undefined, слишком длинные ответы, ответ не проходит собственную проверку.
import { TOPICS, makeVariant } from "../src/data/oge.js";
import { WARMUPS } from "../src/data/warmup.js";
import { checkAnswer } from "../src/lib/math.js";

const RUNS = 3000;
let errors = 0;
const bad = (where, task, why) => {
  if (errors++ < 30) console.error(`✗ ${where}: ${why}\n  ${JSON.stringify(task).slice(0, 400)}`);
};

function check(where, task) {
  const text = JSON.stringify(task);
  if (/NaN|undefined|Infinity|null/.test(text)) return bad(where, task, "NaN/undefined в тексте");
  if (!task.q || !task.answer || !Array.isArray(task.steps) || !task.steps.length) return bad(where, task, "нет полей");
  if (task.answer.length > 10) return bad(where, task, "слишком длинный ответ");
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

for (const t of TOPICS) for (let i = 0; i < RUNS; i++) check(`ОГЭ ${t.num}`, t.gen());
for (const w of WARMUPS) for (let i = 0; i < RUNS; i++) check(`Разминка ${w.id}`, w.gen());
for (let i = 0; i < 200; i++) {
  const v = makeVariant();
  if (v.length !== 19) bad("Вариант", v.length, "не 19 заданий");
}
console.log(errors ? `Ошибок: ${errors}` : "Все генераторы в порядке ✓");
process.exit(errors ? 1 : 0);
