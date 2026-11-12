import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { SUB } from "../style/palette";

export type Word = { word: string; start: number; end: number; part?: number };
export type Phrase = { lines: number[][]; from: number; to: number }; // индексы слов по строкам; кадры

const MAX_WORDS = 4, MAX_CHARS = 16;
const endsSentence = (w: string) => /[.!?…]$|[.!?…]»$/.test(w);

/** Режет слова на фразы: ≤ 2 строки, в строке 2–4 слова и ≤ 16 знаков; граница предложения — всегда разрыв. */
export const chunk = (words: Word[], fps: number): Phrase[] => {
  const phrases: number[][][] = [];
  let lines: number[][] = [[]];
  const flush = () => {
    const l = lines.filter((x) => x.length);
    if (l.length) phrases.push(l);
    lines = [[]];
  };
  words.forEach((w, i) => {
    let cur = lines[lines.length - 1];
    const text = [...cur.map((j) => words[j].word), w.word].join(" ");
    if (cur.length && (cur.length >= MAX_WORDS || text.length > MAX_CHARS)) {
      if (lines.length >= 2) flush(); else lines.push([]);
      cur = lines[lines.length - 1];
    }
    cur.push(i);
    if (endsSentence(w.word) || i === words.length - 1) flush();
  });
  // фразу из одного короткого слова приклеиваем к следующей, если там есть место
  const merged: number[][][] = [];
  for (const ph of phrases) {
    const prev = merged[merged.length - 1];
    const flat = ph.flat();
    if (prev && flat.length === 1 && prev.length === 1 && prev[0].length < MAX_WORDS &&
      [...prev[0], ...flat].map((j) => words[j].word).join(" ").length <= MAX_CHARS && !endsSentence(words[prev[0][prev[0].length - 1]].word)) {
      prev[0].push(...flat);
    } else merged.push(ph);
  }
  return merged.map((lines, k, all) => {
    const first = words[lines[0][0]], last = words[lines[lines.length - 1].slice(-1)[0]];
    const next = all[k + 1] ? words[all[k + 1][0][0]] : null;
    const from = Math.round(first.start * fps);
    const hold = Math.round((last.end + 0.45) * fps);
    const to = next ? Math.min(Math.round(next.start * fps), Math.max(hold, Math.round(next.start * fps) - 6)) : hold;
    return { lines, from, to };
  });
};

const SHADOW = [
  "0 3px 14px rgba(0,0,0,.7)",
  "1.5px 0 0 rgba(10,12,18,.55)", "-1.5px 0 0 rgba(10,12,18,.55)", "0 1.5px 0 rgba(10,12,18,.55)", "0 -1.5px 0 rgba(10,12,18,.55)",
].join(", ");

/**
 * Караоке-субтитры: фраза целиком, несказанные слова — белый 50%, слово белеет в кадр своего начала.
 * accents: индекс слова → "yellow" | "red" (не больше одного на фразу — проверяется).
 */
export const Karaoke: React.FC<{ words: Word[]; accents?: Record<number, "yellow" | "red">; centerY?: number; fontSize?: number; pendingColor?: string }> = ({
  words, accents = {}, centerY = 1229, fontSize = 84, pendingColor = "rgba(255,255,255,0.5)",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phrases = React.useMemo(() => chunk(words, fps), [words, fps]);
  const ph = phrases.find((p) => frame >= p.from && frame < p.to);
  if (!ph) return null;
  const nAcc = ph.lines.flat().filter((i) => accents[i]).length;
  if (nAcc > 1) throw new Error(`Во фразе больше одного цветного слова: ${ph.lines.flat().map((i) => words[i].word).join(" ")}`);
  const scale = interpolate(frame - ph.from, [0, 4], [0.94, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  return (
    <div style={{
      position: "absolute", left: 40, right: 40, top: Math.round(centerY - fontSize * 1.1), height: Math.round(fontSize * 2.2),
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: Math.round(fontSize * 0.08),
      transform: `scale(${scale})`, transformOrigin: "50% 50%",
    }}>
      {ph.lines.map((line, li) => (
        <div key={li} style={{ display: "flex", gap: Math.round(fontSize * 0.28), lineHeight: 1, whiteSpace: "nowrap" }}>
          {line.map((i) => {
            const spoken = frame >= Math.round(words[i].start * fps);
            const acc = accents[i];
            const color = !spoken ? pendingColor : acc ? SUB[acc] : "#FFFFFF";
            return (
              <span key={i} style={{
                fontFamily: "Inter Display", fontWeight: 900, fontSize, color, textTransform: "uppercase",
                textShadow: SHADOW, letterSpacing: 0.5,
              }}>{words[i].word}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
