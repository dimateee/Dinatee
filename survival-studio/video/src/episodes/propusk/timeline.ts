// Хронометраж «Пропуска»: планы из shotlist.md и поиск моментов слов в words.json.
import data from "../../captions/propusk.words.json";
import type { Word } from "../../captions/Karaoke";

export const FPS = 30;
export const WORDS = (data as { words: Word[] }).words;
export const TOTAL_SEC = 80;

const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");

/** Время (с) первого слова `w`, начинающегося не раньше `after` секунд. */
export const at = (w: string, after = 0): number => {
  const hit = WORDS.find((x) => x.start >= after - 0.05 && norm(x.word) === norm(w));
  if (!hit) throw new Error(`Слово «${w}» после ${after} с не найдено`);
  return hit.start;
};

export type Pal = "R" | "S";
export type Shot = { id: number; from: number; to: number; pal: Pal; enter?: "cut" | "wipe" | "lightOn" | "darkOut" | "scale" };

// 36 планов (секунды). Границы — по началу фраз, см. shotlist.md.
export const SHOTS: Shot[] = [
  { id: 1, from: 0.0, to: 1.1, pal: "S" },
  { id: 2, from: 1.1, to: 3.78, pal: "S", enter: "scale" },
  { id: 3, from: 3.78, to: 4.86, pal: "R", enter: "lightOn" },
  { id: 4, from: 4.86, to: 6.78, pal: "R" },
  { id: 5, from: 6.78, to: 8.3, pal: "R", enter: "wipe" },
  { id: 6, from: 8.3, to: 10.44, pal: "R" },
  { id: 7, from: 10.44, to: 11.74, pal: "S", enter: "darkOut" },
  { id: 8, from: 11.74, to: 14.22, pal: "S", enter: "scale" },
  { id: 9, from: 14.22, to: 16.94, pal: "S", enter: "scale" },
  { id: 10, from: 16.94, to: 19.0, pal: "S" },
  { id: 11, from: 19.0, to: 20.72, pal: "S", enter: "scale" },
  { id: 12, from: 20.72, to: 24.54, pal: "S", enter: "wipe" },
  { id: 13, from: 24.54, to: 25.4, pal: "S" },
  { id: 14, from: 25.4, to: 28.3, pal: "S", enter: "scale" },
  { id: 15, from: 28.3, to: 30.78, pal: "S" },
  { id: 16, from: 30.78, to: 35.06, pal: "S" },
  { id: 17, from: 35.06, to: 38.56, pal: "R", enter: "lightOn" },
  { id: 18, from: 38.56, to: 40.9, pal: "R", enter: "scale" },
  { id: 19, from: 40.9, to: 43.5, pal: "R" },
  { id: 20, from: 43.5, to: 46.24, pal: "R", enter: "wipe" },
  { id: 21, from: 46.24, to: 47.8, pal: "R", enter: "scale" },
  { id: 22, from: 47.8, to: 49.5, pal: "R" },
  { id: 23, from: 49.5, to: 51.56, pal: "R" },
  { id: 24, from: 51.56, to: 54.06, pal: "R", enter: "scale" },
  { id: 25, from: 54.06, to: 56.52, pal: "R", enter: "wipe" },
  { id: 26, from: 56.52, to: 58.84, pal: "R", enter: "scale" },
  { id: 27, from: 58.84, to: 60.2, pal: "R", enter: "scale" },
  { id: 28, from: 60.2, to: 63.62, pal: "R" },
  { id: 30, from: 63.62, to: 66.14, pal: "R", enter: "wipe" },
  { id: 31, from: 66.14, to: 67.5, pal: "R", enter: "scale" },
  { id: 32, from: 67.5, to: 69.44, pal: "R" },
  { id: 33, from: 69.44, to: 72.9, pal: "R" },
  { id: 34, from: 72.9, to: 75.04, pal: "R", enter: "scale" },
  { id: 35, from: 75.04, to: 76.76, pal: "R" },
  { id: 36, from: 76.76, to: 80.0, pal: "R", enter: "scale" },
];
// План 29 (плашки «время / место») идёт внутри плана 28 — тот же кадр, см. shotlist.md.

/** Слияния для субтитров: числа показываем цифрами, караоке сохраняет тайминг. */
export const CAPTION_MERGES: { words: string[]; after: number; text: string }[] = [
  { words: ["шесть", "тридцать"], after: 5, text: "06:30" },
  { words: ["пять", "километров."], after: 6.5, text: "5 км." },
  { words: ["четыре"], after: 17, text: "4" },
  { words: ["двадцать", "один"], after: 23, text: "21" },
  { words: ["шестьдесят", "шесть"], after: 29, text: "66" },
  { words: ["восемнадцати"], after: 31.5, text: "18" },
  { words: ["двухсот", "пятидесяти", "четырёх."], after: 32.5, text: "254." },
  { words: ["пять", "километров,"], after: 46, text: "5 км," },
  { words: ["десять"], after: 47, text: "10" },
  { words: ["семь"], after: 51.5, text: "7" },
  { words: ["две"], after: 66, text: "2" },
  { words: ["шестьдесят", "шестой."], after: 69.5, text: "66-й." },
];

export const captionWords = (): Word[] => {
  const out: Word[] = [];
  const used = new Set<number>();
  const starts = new Map<number, { len: number; text: string }>();
  for (const m of CAPTION_MERGES) {
    const i = WORDS.findIndex((x, k) => x.start >= m.after - 0.05 &&
      m.words.every((w, j) => WORDS[k + j] && norm(WORDS[k + j].word) === norm(w)));
    if (i < 0) throw new Error(`Слияние не найдено: ${m.words.join(" ")}`);
    starts.set(i, { len: m.words.length, text: m.text });
  }
  WORDS.forEach((w, i) => {
    if (used.has(i)) return;
    const m = starts.get(i);
    if (m) {
      for (let j = 0; j < m.len; j++) used.add(i + j);
      out.push({ word: m.text, start: w.start, end: WORDS[i + m.len - 1].end, part: w.part });
    } else out.push(w);
  });
  return out;
};

/** Цветные слова субтитров (по одному на фразу максимум — проверяет Karaoke). */
export const CAPTION_ACCENTS: { word: string; after: number; color: "yellow" | "red" }[] = [
  { word: "конец.", after: 2.5, color: "red" },
  { word: "сломал.", after: 15.5, color: "red" },
  { word: "миф.", after: 24.5, color: "red" },
  { word: "66", after: 29, color: "yellow" },
  { word: "ничего", after: 36.5, color: "yellow" },
  { word: "проиграл.", after: 42, color: "red" },
  { word: "шаг.", after: 45.5, color: "yellow" },
  { word: "когда.", after: 50.5, color: "yellow" },
  { word: "двери.", after: 56, color: "yellow" },
  { word: "мотивация.", after: 60.5, color: "red" },
  { word: "дважды.", after: 68.5, color: "yellow" },
  { word: "концом.", after: 75.5, color: "yellow" },
];
