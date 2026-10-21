/* Банки вопросов для предметов, где важнее знания, чем вычисления.
   Запись вопроса:
   - [вопрос, [верный, неверный, неверный, ...], пояснение] — выбор ответа, варианты перемешиваются;
   - { q, answer, kind?, why } — ответ вводится с клавиатуры. */
import { shuffle } from "../lib/math.js";

function toTask(item) {
  if (Array.isArray(item)) {
    const [q, options, why] = item;
    const order = shuffle(options.map((_, i) => i));
    return {
      q,
      kind: "choice",
      options: order.map((i) => options[i]),
      answer: String(order.indexOf(0) + 1),
      steps: [`Верно: ${options[0]}`, why],
    };
  }
  return { kind: "number", ...item, steps: item.steps || [item.why] };
}

// Генератор, который не повторяет недавние вопросы
export function fromBank(items) {
  let recent = [];
  return () => {
    const memory = Math.min(items.length - 1, 10);
    let idx;
    do { idx = Math.floor(Math.random() * items.length); } while (recent.includes(idx));
    recent = [idx, ...recent].slice(0, memory);
    return toTask(items[idx]);
  };
}

// Генератор, который случайно выбирает один из нескольких генераторов
export const mix = (...gens) => () => gens[Math.floor(Math.random() * gens.length)]();

// Химическая формула для KaTeX: «H2SO4» → H₂SO₄, «Ca(OH)2» → Ca(OH)₂
export const chem = (f) => `$\\mathrm{${f.replace(/(\d+)/g, "_{$1}")}}$`;
