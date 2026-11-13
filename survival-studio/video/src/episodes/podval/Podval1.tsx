import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/podval1.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { Bubble, Cam, lerpCam, moverAt, MOVERS, NameTag, PodHud, PodvalState, PodvalWorld, toScreen, W_CEIL, W_FLOOR } from "../../scenes/Podval";

/*
 * «Подвал на восьмерых». Серия 1. Один непрерывный мир (пятиэтажка в разрезе + подвал), камера ездит внутри.
 * Рефрен — таймер «ДО ПЫЛИ», бюджет воды, жильцы с характерами, в конце — выбор зрителя.
 * Уроки: survival-studio/channel/LESSONS.md.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = 88.09, TAIL = 1.6;
export const PODVAL1_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const at = (w: string, after = 0) => {
  const h = WORDS.find((x) => x.start >= after - 0.05 && norm(x.word) === norm(w));
  if (!h) throw new Error(`Слово «${w}» после ${after} не найдено`);
  return h.start;
};
const MERGES: { words: string[]; after: number; text: string }[] = [
  { words: ["пятнадцать"], after: 1.4, text: "15" }, { words: ["пятнадцать"], after: 8.1, text: "15" },
  { words: ["четырнадцать"], after: 20.5, text: "14" }, { words: ["одиннадцать"], after: 35.5, text: "11" },
  { words: ["восемь"], after: 51.3, text: "8" }, { words: ["шесть"], after: 60.5, text: "6" }, { words: ["четыре"], after: 68.3, text: "4" },
  { words: ["три"], after: 73.9, text: "3" }, { words: ["четырёх"], after: 44.7, text: "4" },
];
const CW = (() => {
  const out: Word[] = []; const rep = new Map<number, string>();
  for (const m of MERGES) {
    const i = WORDS.findIndex((x) => x.start >= m.after - 0.05 && norm(x.word) === norm(m.words[0]));
    if (i < 0) throw new Error(`Слияние не найдено: ${m.words.join(" ")}`);
    rep.set(i, m.text + (WORDS[i].word.match(/[.,:!?—]+$/)?.[0] ?? ""));
  }
  WORDS.forEach((w, i) => out.push(rep.has(i) ? { ...w, word: rep.get(i)! } : w));
  return out;
})();
const ACC: { word: string; after: number; color: "yellow" | "red" }[] = [
  { word: "15", after: 1.4, color: "red" }, { word: "ошибиться.", after: 8.9, color: "red" }, { word: "хвоста.", after: 19.8, color: "yellow" },
  { word: "14", after: 20.5, color: "red" }, { word: "пыль.", after: 28.7, color: "red" }, { word: "клеёнку", after: 34.2, color: "yellow" },
  { word: "11", after: 35.5, color: "red" }, { word: "хватит.", after: 48.7, color: "red" }, { word: "8", after: 51.3, color: "red" },
  { word: "угарный", after: 56.8, color: "red" }, { word: "6", after: 60.5, color: "red" }, { word: "полезен.", after: 67.5, color: "yellow" },
  { word: "4", after: 68.3, color: "red" }, { word: "3", after: 73.9, color: "red" }, { word: "впритык.", after: 78.8, color: "red" },
  { word: "«закрыто».", after: 84.3, color: "red" },
];
const ACCENTS = Object.fromEntries(ACC.map((a) => {
  const i = CW.findIndex((w) => w.start >= a.after - 0.05 && norm(w.word) === norm(a.word));
  if (i < 0) throw new Error(`Акцент не найден: ${a.word}`);
  return [i, a.color];
})) as Record<number, "yellow" | "red">;

/* ---------- Время ---------- */
const T = (w: string, after: number) => at(w, after);
const MIN_AT: [number, number][] = [[0, 900], [T("пятнадцать", 1.4), 900], [T("четырнадцать", 20.5), 840], [T("одиннадцать", 35.5), 660],
  [T("восемь", 51.3), 480], [T("шесть", 60.5), 360], [T("четыре", 68.3), 240], [T("три", 73.9), 180], [VOICE_END + TAIL, 150]];
const secLeft = (t: number) => interpolate(t, MIN_AT.map((m) => m[0]), MIN_AT.map((m) => m[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const urgentAt = (t: number) => Math.max(0, ...MIN_AT.slice(2, 8).map(([a]) => (t >= a && t < a + 0.7 ? 1 - (t - a) / 0.7 : 0)));
const ramp = (t: number, a: number, len = 0.35) => Math.min(1, Math.max(0, (t - a) / len));

/* ---------- Камера: ключевые точки во времени ---------- */
const WIDE: Cam = { x: 1000, y: 760, z: 0.72 };
/* Вход жильцов по лестнице (секунды) — каждый вбегает, когда его называет голос. */
export const ENTRIES: Record<string, number> = {
  artyom: 0.5, luna: 0.62, zina: 12.0, barsik: 12.3, vitya: 13.4, petrov: 16.6, twinA: 16.85, twinB: 17.05, petrova: 17.3,
};
const CAM: [number, Cam][] = [
  [0, { x: 1800, y: 800, z: 1.1 }], [1.5, { x: 1350, y: 840, z: 1.0 }],
  [T("бетон", 4.2), { x: 1250, y: 700, z: 0.85 }], [T("но", 7.3), { x: 1300, y: 800, z: 0.9 }],
  [T("весь", 9.9), { x: 1480, y: 800, z: 0.92 }], [13.3, { x: 1300, y: 820, z: 0.95 }], [T("витя", 15.1), { x: 950, y: 820, z: 0.95 }],
  [16.8, { x: 1450, y: 820, z: 0.95 }], [T("семеро", 19), WIDE],
  [T("витя", 21.9), { x: 760, y: 780, z: 1.0 }], [T("продухи", 23.6), { x: 800, y: 760, z: 1.4 }], [T("закрываем", 29.4), { x: 800, y: 760, z: 1.25 }],
  [T("баба", 33.3), { x: 600, y: 800, z: 1.05 }],
  [T("вода.", 36.9), { x: 800, y: 880, z: 1.15 }], [T("витя", 46.9), { x: 720, y: 880, z: 1.1 }], [T("огурцы", 49.4), { x: 420, y: 860, z: 1.2 }],
  [T("свет", 52.6), { x: 760, y: 820, z: 0.9 }], [T("баба", 57.6), { x: 420, y: 860, z: 1.25 }],
  [T("туалет.", 61.8), { x: 260, y: 900, z: 1.4 }], [T("четыре", 68.3), { x: 1080, y: 860, z: 1.15 }], [T("закрываем", 72.8), { x: 1620, y: 860, z: 1.15 }],
  [T("соседка", 75.9), { x: 1790, y: 800, z: 1.05 }], [T("впускаешь", 79.9), { x: 1700, y: 800, z: 0.95 }],
];
const MOVE = 1.3; // секунд на переезд — спокойнее
const camAt = (t: number): Cam => {
  let cur = CAM[0][1];
  for (let i = 1; i < CAM.length; i++) {
    const [ta, c] = CAM[i];
    if (t < ta) break;
    cur = lerpCam(cur, c, (t - ta) / MOVE);
  }
  return cur;
};

/* ---------- Состояние мира во времени ---------- */
const stateAt = (t: number): PodvalState => ({
  siren: t < 11 ? 1 : t < T("закрываем", 72.8) ? 0.3 : 0,
  outDust: 0, // пыли ещё нет — удар не случился
  film: ramp(t, T("плёнка,", 30.5), 0.4), tape: ramp(t, T("скотч,", 31.3), 0.5), bags: ramp(t, T("мешки", 32), 0.5),
  oilcloth: ramp(t, T("клеёнку", 34.2), 0.4),
  buckets: ramp(t, T("вёдра,", 41.3)), pots: ramp(t, T("кастрюли,", 41.9)), bath: ramp(t, T("ванночку", 42.7)),
  torches: ramp(t, T("фонарики.", 53.3), 0.2), candle: ramp(t, T("свеча", 54.4), 0.2), candleHidden: ramp(t, T("прячет", 58.4), 0.5),
  toilet: ramp(t, T("угол", 62.7), 0.4), catOnLitter: ramp(t, T("полезен.", 67.5), 0.2),
  radio: ramp(t, T("радио", 69.5), 0.3), doorClosed: ramp(t, T("дверь.", 73.3), 0.25),
  knock: t >= T("стук.", 75.1) && t < T("стук.", 75.1) + 2.2 ? 1 : 0, guests: ramp(t, T("соседка", 75.9), 0.4),
  vityaPhone: t >= T("витя", 15.1) && t < T("витя", 21.9) || t >= T("витя", 46.9) && t < T("свет", 52.6),
  zinaJar: t >= T("огурцы", 49.4) && t < T("свет", 52.6) || t < T("витя", 21.9),
});
const waterAt = (t: number) => 20 * ramp(t, T("вёдра,", 41.3)) + 15 * ramp(t, T("кастрюли,", 41.9)) + 25 * ramp(t, T("ванночку", 42.7));
const posOf = (key: string, t: number) => {
  const m = MOVERS.find((x) => x.key === key)!;
  return moverAt(t - ENTRIES[key], m.speed, m.target);
};

/* ---------- Экранные карточки ---------- */
const Card: React.FC<{ k: number; y: number; children: React.ReactNode; color?: string }> = ({ k, y, children, color = "#5AA9FF" }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: y, opacity: k, transform: `scale(${0.92 + 0.08 * k})`, padding: "22px 30px", borderRadius: 24,
    background: "rgba(14,17,24,0.92)", border: `4px solid ${color}`, boxShadow: `0 0 30px ${color}55`, display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
    {children}
  </div>
);
const Big: React.FC<{ c?: string; s?: number; children: React.ReactNode }> = ({ c = "#FFFFFF", s = 56, children }) => (
  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: s, lineHeight: 1.05, color: c, textAlign: "center" }}>{children}</div>
);
const Stamp: React.FC<{ k: number; text: string; color: string; x: number; y: number; rot?: number; size?: number }> = ({ k, text, color, x, y, rot = -8, size = 70 }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: k, transform: `translateX(${x - 540}px)` }}>
    <div style={{ transform: `rotate(${rot}deg) scale(${1.5 - 0.5 * k})`, border: `8px solid ${color}`, borderRadius: 16, padding: "6px 28px", background: "rgba(14,17,24,0.6)",
      fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 1, color, textShadow: `0 0 20px ${color}88`, whiteSpace: "nowrap" }}>{text}</div>
  </div>
);

export const Podval1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cam = camAt(t);
  const st = stateAt(t);
  const water = waterAt(t);
  const scr = (x: number, y: number) => toScreen(cam, x, y);
  const win = (a: number, b: number, len = 0.3) => Math.min(ramp(t, a, len), 1 - ramp(t, b - len, len));
  const headY = W_FLOOR - 470; // над головами взрослых
  const tCast = T("артём", 11.7), tZina = T("баба", 12.8), tVit = T("витя", 15.1), tPet = T("петровы", 17.5), tAll = T("семеро", 19);
  const tChoice = T("впускаешь", 79.9);
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      <PodvalWorld frame={frame} cam={cam} st={st} entries={ENTRIES} />
      {/* титул крючка */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        opacity: interpolate(t, [0, 0.15, 3.0, 3.5], [1, 1, 1, 0], { extrapolateRight: "clamp" }) }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 36, letterSpacing: 10, color: "#FF8A80" }}>СЕРИЯ 1</div>
        <Big s={110}>ПОДВАЛ</Big>
        <Big s={110} c={SRYV.fail}>НА ВОСЬМЕРЫХ</Big>
      </div>
      {(() => { const p = scr(1250, W_CEIL - 20); return <NameTag x={p.x} y={p.y + 30} text="БЕТОН · ЗЕМЛЯ ВОКРУГ" k={win(T("бетон", 4.2), T("он", 5.4) + 1.2)} color="#C9D2E0" />; })()}
      {/* знакомство */}
      {(() => { const p = scr(posOf("artyom", t).x + 40, headY); return <NameTag x={p.x} y={p.y} text="АРТЁМ + ЛУНА" k={win(tCast, tZina)} />; })()}
      {(() => { const q = posOf("zina", t); const p = scr(q.x + 30, q.y - 470); return <NameTag x={p.x} y={p.y} text="БАБА ЗИНА + БАРСИК" k={win(tZina, tVit)} />; })()}
      {(() => { const q = posOf("vitya", t); const p = scr(q.x + 20, q.y - 470); return <NameTag x={p.x} y={p.y} text="ВИТЯ, 3-Й ЭТАЖ" k={win(tVit, tPet)} />; })()}
      {(() => { const q = posOf("petrov", t); const p = scr(q.x + 110, q.y - 470); return <NameTag x={p.x} y={p.y} text="ПЕТРОВЫ + БЛИЗНЕЦЫ" k={win(tPet, tAll)} />; })()}
      {/* реплики бабы Зины */}
      {(() => { const p = scr(390, W_FLOOR - 420); return <Bubble x={p.x} y={p.y} text="Клеёнку берите, мне не жалко!" k={win(T("клеёнку", 34.2), T("одиннадцать", 35.5))} />; })()}
      {(() => { const p = scr(390, W_FLOOR - 420); return <Bubble x={p.x} y={p.y} text="Огурцы не отдам!" k={win(T("огурцы", 49.4), T("восемь", 51.3))} />; })()}
      {(() => { const p = scr(390, W_FLOOR - 420); return <Bubble x={p.x} y={p.y} text="Я так… на всякий." k={win(T("прячет", 58.4), T("шесть", 60.5))} />; })()}
      {(() => { const p = scr(300, W_FLOOR - 190); return <Bubble x={p.x} y={p.y} text="Мур." k={win(T("полезен.", 67.5), T("четыре", 68.3))} />; })()}
      {/* расчёт воды */}
      <Card k={win(T("около", 44.3), T("витя", 46.9))} y={300}>
        <Big s={44} c="#C9D2E0">НОРМА</Big><Big s={64}>4 л × 7 = <span style={{ color: "#5AA9FF" }}>28 л</span> в день</Big>
      </Card>
      <Card k={win(T("витя", 46.9), T("огурцы", 49.4))} y={300} color={SRYV.fail}>
        <Big s={44} c="#C9D2E0">ВИТЯ СЧИТАЕТ</Big><Big s={64}>60 л ÷ 28 = <span style={{ color: SRYV.fail }}>2 дня</span></Big><Big s={40} c="#C9D2E0">а нужно минимум 3</Big>
      </Card>
      <Stamp k={win(T("хватит.", 48.7), T("огурцы", 49.4) + 0.6, 0.15)} text="НЕ ХВАТИТ" color={SRYV.fail} x={540} y={560} />
      {/* свеча */}
      {(() => { const p = scr(420, W_FLOOR - 330); const k = win(T("пожар", 56), T("баба", 57.6) + 0.4, 0.15); return (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: k }}>
          <circle cx={p.x} cy={p.y} r={90} fill="none" stroke={SRYV.fail} strokeWidth={14} />
          <line x1={p.x - 64} y1={p.y + 64} x2={p.x + 64} y2={p.y - 64} stroke={SRYV.fail} strokeWidth={14} strokeLinecap="round" />
        </svg>); })()}
      <Stamp k={win(T("пожар", 56), T("баба", 57.6) + 0.4, 0.15)} text="ПОЖАР + УГАРНЫЙ ГАЗ" color={SRYV.fail} x={540} y={330} size={52} rot={-4} />
      {/* туалет — «КОТ ПОЛЕЗЕН» */}
      <Stamp k={win(T("полезен.", 67.5), T("четыре", 68.3), 0.15)} text="+1 К ПОЛЬЗЕ" color={SRYV.progress} x={560} y={330} size={56} rot={-5} />
      {/* радио */}
      <Stamp k={win(T("радио", 69.5), T("закрываем", 72.8), 0.2)} text="РАДИО — КАЖДЫЙ ЧАС" color={SRYV.progress} x={540} y={330} size={50} rot={-3} />
      {/* гости */}
      {(() => { const p = scr(1860, W_FLOOR - 52 * 6 - 360); return <NameTag x={p.x} y={p.y} text="+3 · СОСЕДКА С 5-ГО" k={win(T("соседка", 75.9), tChoice)} color={SRYV.fail} />; })()}
      {/* HUD */}
      <PodHud secLeft={secLeft(t)} people={7} tails={2} water={water} waterBad={t >= T("витя", 46.9)}
        opacity={ramp(t, 3.3, 0.3) * (1 - ramp(t, tChoice + 0.2, 0.4))} urgent={urgentAt(t)} />
      {/* выбор зрителя */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(7,9,13,0.6)", opacity: ramp(t, tChoice, 0.5) }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, opacity: ramp(t, tChoice, 0.4) }}>
        <Big s={64}>ДВЕРЬ</Big>
        <div style={{ display: "flex", gap: 30 }}>
          {[["ВПУСКАЕМ", SRYV.progress, T("пиши:", 82.4)], ["ЗАКРЫТО", SRYV.fail, T("или", 83.8)]].map(([txt, c, a]) => {
            const k = ramp(t, (a as number) - 1.2, 0.3);
            return (
              <div key={txt as string} style={{ transform: `scale(${0.85 + 0.15 * k})`, opacity: 0.4 + 0.6 * k, padding: "26px 34px", borderRadius: 22,
                border: `6px solid ${c}`, background: `${c}22`, boxShadow: `0 0 30px ${c}66`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 58, color: "#FFFFFF" }}>{txt}</div>
            );
          })}
        </div>
        <div style={{ opacity: ramp(t, T("пиши:", 82.4), 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, color: "#E8C547", letterSpacing: 2 }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
        <div style={{ opacity: ramp(t, T("следующая", 84.9), 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 2 — С ВАШЕГО ОТВЕТА</div>
      </div>
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/podval1_mix.wav")} />}
    </AbsoluteFill>
  );
};
