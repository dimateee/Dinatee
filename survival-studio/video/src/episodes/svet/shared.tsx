import React from "react";
import { Word } from "../../captions/Karaoke";
import { PovArm } from "../../scenes/SvetPov";

/* Общие куски серий «Оно идёт на свет»: поиск слов, телефон в руках, HUD. */
export const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
export const idxIn = (arr: Word[], w: string, n = 1) => {
  let k = 0;
  for (let i = 0; i < arr.length; i++) if (norm(arr[i].word) === norm(w) && ++k === n) return i;
  return -1;
};
export const wordAt = (words: Word[]) => (w: string, n = 1) => {
  const i = idxIn(words, w, n);
  if (i < 0) throw new Error(`Слово «${w}» #${n} не найдено`);
  return words[i].start;
};
/** Склеить k слов начиная с n-го вхождения w в одно (числа цифрами в субтитрах). */
export const merge = (arr: Word[], w: string, k: number, to: string, n = 1) => {
  const i = idxIn(arr, w, n);
  if (i < 0) return;
  arr[i] = { ...arr[i], word: to, end: arr[i + k - 1].end };
  arr.splice(i + 1, k - 1);
};
export const ramp = (t: number, a: number, len = 0.35) => Math.min(1, Math.max(0, (t - a) / len));
export const sm = (x: number) => x * x * (3 - 2 * x);

export const Layer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>{children}</svg>
);

export const PHONE_SCALE = 0.78;
/* Телефон в руках: руки сзади, большие пальцы поверх корпуса. */
export const PhoneInHands: React.FC<{ children: React.ReactNode; light: number; dy?: number; shake?: number; frame: number; leftOnly?: boolean }> = ({ children, light, dy = 0, shake = 0, frame, leftOnly }) => {
  const sx = shake * 7 * Math.sin(frame * 2.9);
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translate(${sx}px, ${dy}px)` }}>
      <Layer>
        <PovArm x={360} y={1150} angle={14} side="L" pose="grip" light={light} part="back" />
        {!leftOnly && <PovArm x={720} y={1150} angle={-14} side="R" pose="grip" light={light} part="back" />}
      </Layer>
      {children}
      <Layer>
        <PovArm x={360} y={1150} angle={14} side="L" pose="grip" light={light} part="thumb" />
        {!leftOnly && <PovArm x={720} y={1150} angle={-14} side="R" pose="grip" light={light} part="thumb" />}
      </Layer>
    </div>
  );
};
/* Кончик указательного пальца правой руки (поза point) → запястье. */
export const pointWrist = (tipX: number, tipY: number, angle: number, s = 1) => {
  const a = (angle * Math.PI) / 180, lx = -50 * s, ly = -300 * s;
  return { x: tipX - (lx * Math.cos(a) - ly * Math.sin(a)), y: tipY - (lx * Math.sin(a) + ly * Math.cos(a)) };
};

const Item: React.FC<{ label: string; hi: number; children: React.ReactNode }> = ({ label, hi, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 14, background: "rgba(10,12,18,0.85)",
    border: `3px solid ${hi > 0 ? "#E8C547" : "#2B3241"}`, boxShadow: hi > 0 ? "0 0 24px #E8C54788" : "none", transform: `scale(${1 + 0.12 * hi})` }}>
    {children}{label && <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, color: "#FFFFFF" }}>{label}</div>}
  </div>
);
/* HUD: часы, «до рассвета», фонарик (3 ячейки), заряд, свеча. */
export const SvetHud: React.FC<{ time: string; dawn?: string; cells: number[]; battery: number; candle?: number; hi?: number[] }> = ({ time, dawn, cells, battery, candle = 1, hi = [0, 0, 0] }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 22 }}>
      <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 72, lineHeight: 1, color: "#FF6B5E", textShadow: "0 0 20px rgba(229,57,53,.6)" }}>{time}</div>
      {dawn && <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#9AA6BA" }}>ДО РАССВЕТА {dawn}</div>}
    </div>
    <div style={{ display: "flex", gap: 12 }}>
      <Item label="" hi={hi[0]}>
        <div style={{ display: "flex", gap: 6 }}>{cells.map((c, i) => (
          <div key={i} style={{ width: 22, height: 40, borderRadius: 5, border: "3px solid #E8C547", display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", height: `${Math.round(100 * c)}%`, background: "#E8C547" }} /></div>))}</div>
      </Item>
      <Item label={`${battery}%`} hi={hi[1]}><div style={{ width: 24, height: 40, borderRadius: 6, border: "3px solid #C9D2E0" }} /></Item>
      <Item label={`×${candle}`} hi={hi[2]}><div style={{ width: 12, height: 34, borderRadius: 3, background: "#EDE6D6" }} /></Item>
    </div>
  </div>
);
/* Штамп поверх кадра. */
export const Stamp: React.FC<{ k: number; color?: string; top?: number; size?: number; children: React.ReactNode }> = ({ k, color = "#E53935", top = 300, size = 54, children }) => k > 0 ? (
  <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center", opacity: Math.min(1, k * 1.5), transform: `scale(${1.25 - 0.25 * k}) rotate(-3deg)` }}>
    <div style={{ padding: "12px 28px", borderRadius: 14, background: "rgba(10,12,18,.88)", border: `6px solid ${color}`, fontFamily: "Inter Display", fontWeight: 900, fontSize: size, color: "#FFFFFF", textAlign: "center", lineHeight: 1.05 }}>{children}</div>
  </div>
) : null;
