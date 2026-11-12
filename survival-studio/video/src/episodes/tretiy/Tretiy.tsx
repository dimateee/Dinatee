import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/tretiy.words.json";
import { Grain } from "../../ui/Grain";
import { Leader, Plate, ServiceLabel } from "../../ui/Hud";
import { useFonts } from "../../useFonts";
import { REGIME, SRYV } from "../../style/palette";
import { RoomMorning, RoomNight } from "../../scenes/Rooms";
import { Street } from "../../scenes/Extra";
import { NEUTRAL } from "../../rig/Hero";
import { POSES } from "../../rig/poses";
import { RitmInsert } from "../../series66/Inserts";
import {
  ap, Calendar, EASE, px, FiveToOne, Marker, MotivationBar, Push, RangeBand, Ribbon, Ruler, SchemaBg, StudyCard, TimerCard, TwoCurves,
} from "../propusk/parts";

/*
 * «Третий день» — TikTok, 1080×1920. Стиль первого промпта («Пропуск»), голос George.
 * TikTok: правая колонка кнопок (x > 930, y 900–1550) и низ (y > 1560) — без важных элементов.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = 66.24, TAIL = 1.0;
export const TRETIY_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const at = (w: string, after = 0) => {
  const h = WORDS.find((x) => x.start >= after - 0.05 && norm(x.word) === norm(w));
  if (!h) throw new Error(`Слово «${w}» после ${after} не найдено`);
  return h.start;
};

/* Субтитры: числа цифрами, караоке по словам. */
const MERGES: { words: string[]; after: number; text: string }[] = [
  { words: ["шесть", "тридцать."], after: 5, text: "06:30." },
  { words: ["шестьдесят", "шесть"], after: 26, text: "66" },
  { words: ["восемнадцати"], after: 29, text: "18" },
  { words: ["двухсот", "пятидесяти", "четырёх."], after: 30, text: "254." },
  { words: ["десять"], after: 43.5, text: "10" },
  { words: ["шестьдесят", "шестой."], after: 57.5, text: "66-й." },
];
const captionWords = (): Word[] => {
  const out: Word[] = []; const used = new Set<number>(); const starts = new Map<number, { len: number; text: string }>();
  for (const m of MERGES) {
    const i = WORDS.findIndex((x, k) => x.start >= m.after - 0.05 && m.words.every((w, j) => WORDS[k + j] && norm(WORDS[k + j].word) === norm(w)));
    if (i < 0) throw new Error(`Слияние не найдено: ${m.words.join(" ")}`);
    starts.set(i, { len: m.words.length, text: m.text });
  }
  WORDS.forEach((w, i) => {
    if (used.has(i)) return;
    const m = starts.get(i);
    if (m) { for (let j = 0; j < m.len; j++) used.add(i + j); out.push({ word: m.text, start: w.start, end: WORDS[i + m.len - 1].end, part: w.part }); }
    else out.push(w);
  });
  return out;
};
const CW = captionWords();
const ACC: { word: string; after: number; color: "yellow" | "red" }[] = [
  { word: "третий", after: 1, color: "red" }, { word: "сразу.", after: 9, color: "yellow" }, { word: "мотивация.", after: 15, color: "red" },
  { word: "привычка.", after: 21, color: "yellow" }, { word: "66", after: 26, color: "yellow" }, { word: "ничего", after: 33, color: "yellow" },
  { word: "система.", after: 37, color: "yellow" }, { word: "пять.", after: 40, color: "red" }, { word: "шаг.", after: 42, color: "yellow" },
  { word: "место.", after: 46, color: "yellow" }, { word: "дни.", after: 50, color: "yellow" }, { word: "дважды.", after: 56.8, color: "red" },
  { word: "telegram,", after: 64, color: "yellow" },
];
const ACCENTS = Object.fromEntries(ACC.map((a) => {
  const i = CW.findIndex((w) => w.start >= a.after - 0.05 && norm(w.word) === norm(a.word));
  if (i < 0) throw new Error(`Акцент не найден: ${a.word}`);
  return [i, a.color];
})) as Record<number, "yellow" | "red">;

type ShotP = { f: number; dur: number; lf: (s: number) => number };
type Shot = { from: number; to: number; enter?: "cut" | "scale" | "wipe" | "lightOn"; C: React.FC<ShotP> };
const LL = { color: REGIME.olive, bg: "rgba(246,242,231,0.92)" } as const;
const kIn = (f: number, s: number) => ap(f, s, 6);

const SHOTS: Shot[] = [
  // 1. Крючок: календарь трескается на третьем дне
  { from: 0, to: 2.52, C: ({ f, dur, lf }) => (<>
    <SchemaBg pal="S" />
    <Push f={f} dur={dur} amount={0.04} origin="50% 36%">
      <Calendar f={f} pal="S" chainUpTo={2} cells={[
        { state: "green", at: 0 }, { state: "green", at: 2 }, { state: f >= lf(at("третий", 1)) ? "miss" : "empty", at: 4 },
        { state: "empty", at: 6 }, { state: "empty", at: 8 }, { state: "empty", at: 10 }, { state: "empty", at: 12 },
      ]} dim={ap(f, lf(at("день?", 1.5)), 8) * 0.6} size={128} />
    </Push>
    <Plate x={330} y={380} kind="bad" icon="warn" title="День 3" sub="и всё бросил" opacity={kIn(f, lf(at("третий", 1)))} scale={0.9 + 0.1 * kIn(f, lf(at("третий", 1)))} />
  </>) },
  // 2. Дело не в лени. Это Артём.
  { from: 2.52, to: 4.64, enter: "lightOn", C: ({ f, lf }) => {
    const k1 = kIn(f, 0), k2 = kIn(f, lf(at("артём.", 3.5)));
    const hero = { ...NEUTRAL, holdL: "leash" as const, expr: { ...NEUTRAL.expr, mouth: "smile" as const, blink: f % 60 < 3 ? 1 : 0 } };
    return (<>
      <RoomMorning frame={f + 200} heroPose={hero} heroOutfit="casual" heroX={340} />
      {f < lf(at("артём.", 3.5)) ? (<>
        <Plate x={330} y={240} kind="bad" icon="warn" title="Лень?" dark={false} opacity={k1} />
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}><line x1={330} y1={350} x2={330 + 330 * ap(f, 10, 6)} y2={260} stroke={SRYV.fail} strokeWidth={12} strokeLinecap="round" /></svg>
      </>) : (<>
        <Leader from={[260, 360]} to={[420, 520]} kind="resource" progress={k2} />
        <Plate x={64} y={220} kind="resource" icon="sneaker" title="Артём" sub="всё и сразу" dark={false} opacity={k2} />
      </>)}
    </>);
  } },
  // 3. День 1, 06:30 — зал, книги, английский. Всё сразу.
  { from: 4.64, to: 10.42, enter: "scale", C: ({ f, dur, lf }) => {
    const hero = { ...NEUTRAL, armL: { sh: -150, el: -20, wr: 0 }, expr: { ...NEUTRAL.expr, mouth: "smile" as const, brow: 0.6, blink: f % 70 < 3 ? 1 : 0 } };
    const items: [string, "dumbbell" | "book" | "lang", string][] = [["Зал", "dumbbell", "зал,"], ["Книги", "book", "книги,"], ["Английский", "lang", "английский."]];
    return (<>
      <RoomMorning frame={f + 260} heroPose={hero} heroOutfit="casual" heroX={340} showDog={false} cam={{ zoom: 1 + 0.03 * f / dur, x: 0, y: 0 }} />
      <ServiceLabel x={64} y={110} text="ДЕНЬ 1 — 06:30" {...LL} />
      {items.map(([t, ic, w], i) => { const k = kIn(f, lf(at(w, 7))); return <Plate key={t} x={460} y={410 + i * 140} kind="good" icon={ic} title={t} dark={false} opacity={k} scale={0.94 + 0.06 * k} />; })}
      <Ribbon f={f} start={lf(at("сразу.", 9))} text="Всё и сразу" y={830} />
    </>);
  } },
  // 4. День 3 — срыв: ночь, телефон
  { from: 10.42, to: 13.82, enter: "lightOn", C: ({ f, dur, lf }) => {
    const k = kIn(f, lf(at("сил", 11.5)));
    return (<>
      <RoomNight frame={f + 30} cam={{ zoom: 1 + 0.04 * f / dur, x: 0, y: 0 }} />
      <ServiceLabel x={64} y={110} text="ДЕНЬ 3 — СРЫВ" color={SRYV.fail} />
      <Leader from={[200, 380]} to={[200, 860]} kind="bad" progress={k} />
      <Plate x={64} y={240} kind="bad" icon="warn" title="Сил нет" sub="настроения нет" opacity={k} />
    </>);
  } },
  // 5. Ждёт мотивацию — шкала падает
  { from: 13.82, to: 16.34, enter: "scale", C: ({ f, lf }) => (<><SchemaBg pal="S" /><MotivationBar f={f} dropAt={lf(at("вернётся", 14.5))} dropDur={22} /></>) },
  // 6. Мотивация как погода, держит привычка
  { from: 16.34, to: 22.14, enter: "wipe", C: ({ f, lf }) => (<><SchemaBg pal="S" /><TwoCurves f={f} habitAt={lf(at("привычка.", 21))} /></>) },
  // 7. Исследование: 66 дней
  { from: 22.14, to: 28.18, enter: "scale", C: ({ f, lf }) => (<>
    <SchemaBg pal="S" />
    <div style={{ position: "absolute", inset: 0, opacity: 1 - ap(f, lf(at("привычка", 24.5)), 8), transform: `translateY(${px(-60 * ap(f, lf(at("привычка", 24.5)), 8))}px)` }}><StudyCard f={f} at={0} /></div>
    <Ruler f={f} drawAt={lf(at("привычка", 24.5))} pal="S" />
    <Marker f={f} day={66} at={lf(at("шестьдесят", 26.5))} label="66 ДНЕЙ" color={SRYV.progress} roll />
  </>) },
  // 8. У разных людей 18–254
  { from: 28.18, to: 32.26, C: ({ f, lf }) => (<>
    <SchemaBg pal="S" />
    <Ruler f={f + 200} drawAt={0} pal="S" />
    <Marker f={f + 200} day={66} at={0} label="66 ДНЕЙ" color={SRYV.progress} />
    <RangeBand f={f} from={18} to={254} at={lf(at("восемнадцати", 29))} label="18–254 ДНЯ" color={SRYV.lamp} />
  </>) },
  // 9. Один пропуск почти ничего не ломал
  { from: 32.26, to: 34.6, enter: "lightOn", C: ({ f, lf }) => { const k = kIn(f, lf(at("ничего", 33))); return (<>
    <SchemaBg pal="R" />
    <Calendar f={f} pal="R" chainUpTo={7} cells={[
      { state: "green", at: 0 }, { state: "green", at: 1 }, { state: "green", at: 2 }, { state: "empty", at: 3 },
      { state: "green", at: 8 }, { state: "green", at: 12 }, { state: "green", at: 16 },
    ]} />
    <Plate x={250} y={240} kind="good" icon="check" title="1 пропуск ≠ провал" dark={false} opacity={k} />
  </>); } },
  // 10. Мотивация помогает начать, продолжать — система
  { from: 34.6, to: 38.32, enter: "scale", C: ({ f, lf }) => (<>
    <Street frame={f + 20} mode="walk" dog heroX={360} />
    <Ribbon f={f} start={lf(at("система.", 37))} text="Держит система" y={300} />
  </>) },
  // 11. Первое: одно дело, а не пять
  { from: 38.32, to: 41.22, enter: "wipe", C: ({ f, lf }) => (<>
    <SchemaBg pal="R" />
    <ServiceLabel x={64} y={96} text="ЧТО ДЕЛАТЬ · 1" {...LL} />
    <FiveToOne f={f} at={lf(at("одно", 39.5))} keep={0} items={[
      { icon: "run", title: "Бег" }, { icon: "dumbbell", title: "Зал" }, { icon: "book", title: "Книги" }, { icon: "lang", title: "Английский" }, { icon: "alarm", title: "Подъём в 6" },
    ]} />
  </>) },
  // 12. Маленький шаг: не час, а 10 минут
  { from: 41.22, to: 44.74, enter: "scale", C: ({ f, lf }) => (<>
    <SchemaBg pal="R" />
    <ServiceLabel x={64} y={96} text="ЧТО ДЕЛАТЬ · 2" {...LL} />
    <TimerCard f={f} at={lf(at("десять", 43.5))} text="10:00" color={SRYV.progress} strike={{ text: "1 ЧАС", at: lf(at("а", 43.5)) - 2 }} y={720} />
  </>) },
  // 13. Одно время и место; кроссовки у двери
  { from: 44.74, to: 48.9, enter: "wipe", C: ({ f, dur, lf }) => { const k1 = kIn(f, lf(at("время", 45.3))), k2 = kIn(f, lf(at("кроссовки", 46.8))); return (<>
    <RoomMorning frame={f + 400} heroPose={POSES.laces.pose} cam={{ zoom: 1 + 0.03 * f / dur, x: 0, y: 0 }} />
    <ServiceLabel x={64} y={96} text="ЧТО ДЕЛАТЬ · 3" {...LL} />
    <Plate x={64} y={200} kind="resource" icon="alarm" title="07:00" sub="каждый день" dark={false} opacity={k1} />
    <Plate x={500} y={200} kind="good" icon="sneaker" title="Кроссовки" sub="у двери" dark={false} opacity={k2} />
  </>); } },
  // 14. Отмечай дни — RITM
  { from: 48.9, to: 54.04, enter: "scale", C: ({ f, lf }) => (
    <RitmInsert f={f} frame={f + 100} done={12} total={20} counter={[3, 12, lf(at("серия", 52))]} />) },
  // 15. Пропустил? Не пропускай дважды
  { from: 54.04, to: 57.92, enter: "scale", C: ({ f, lf }) => (<>
    <SchemaBg pal="R" />
    <Calendar f={f} pal="R" chainUpTo={7} cells={[
      { state: "green", at: -20 }, { state: "green", at: -20 }, { state: "green", at: -20 }, { state: "empty", at: -20 },
      { state: f >= lf(at("страшно.", 55)) ? "green" : "empty", at: 0 }, { state: f >= lf(at("дважды.", 56.8)) ? "lock" : "empty", at: 4 }, { state: "green", at: 10 },
    ]} />
    <Plate x={200} y={330} kind="bad" icon="warn" title="Не 2 пропуска подряд" dark={false} opacity={kIn(f, lf(at("главное", 55.5)))} />
  </>) },
  // 16. День 66 — не ждёт настроения
  { from: 57.92, to: 61.64, enter: "lightOn", C: ({ f }) => (<>
    <Street frame={f + 60} mode="walk" dog heroX={360} />
    <ServiceLabel x={64} y={110} text="ДЕНЬ 66" {...LL} />
  </>) },
  // 17. Вопрос + призыв RITM
  { from: 61.64, to: VOICE_END + TAIL, enter: "scale", C: ({ f, dur, lf }) => { const k = kIn(f, lf(at("ritm", 63.5))); return (<>
    <SchemaBg pal="R" />
    <Push f={f} dur={dur} amount={0.04}><Calendar f={f} pal="R" size={260} labels={false} cells={[{ state: "pulse", at: 0 }]} y={560} /></Push>
    <div style={{ position: "absolute", left: 140, top: 780, width: 800, opacity: k, transform: `scale(${0.94 + 0.06 * k})`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "26px 0", borderRadius: 26,
      background: "#0E1118", border: "4px solid #FF2D55", boxShadow: "0 0 28px #FF2D5566" }}>
      <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 84, lineHeight: 1, color: "#FFFFFF", letterSpacing: 6 }}>RITM</div>
      <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 44, lineHeight: 1, color: "#F5C518", textTransform: "uppercase" }}>Открой в Telegram</div>
      <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, lineHeight: 1, color: "#C9D2E0" }}>ссылка в описании</div>
    </div>
  </>); } },
];

const Enter: React.FC<{ type?: Shot["enter"]; children: React.ReactNode }> = ({ type, children }) => {
  const f = useCurrentFrame();
  if (type === "scale") return <AbsoluteFill style={{ transform: `scale(${interpolate(f, [0, 6], [1.06, 1], { extrapolateRight: "clamp", easing: EASE })})` }}>{children}</AbsoluteFill>;
  if (type === "wipe") { const k = interpolate(f, [0, 7], [25, 100], { extrapolateRight: "clamp", easing: EASE }); return <AbsoluteFill style={{ backgroundColor: "#F6F2E7" }}><AbsoluteFill style={{ clipPath: `inset(0 0 ${Math.round(100 - k)}% 0)` }}>{children}</AbsoluteFill></AbsoluteFill>; }
  if (type === "lightOn") return <AbsoluteFill>{children}<AbsoluteFill style={{ backgroundColor: "#07090D", opacity: interpolate(f, [0, 8], [0.9, 0], { extrapolateRight: "clamp" }) }} /></AbsoluteFill>;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};
const ShotView: React.FC<{ s: Shot; start: number; dur: number }> = ({ s, start, dur }) => {
  const f = useCurrentFrame();
  const lf = (sec: number) => Math.round(sec * FPS) - start;
  return <Enter type={s.enter}><s.C f={f} dur={dur} lf={lf} /></Enter>;
};

export const Tretiy: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0E1118" }}>
      {SHOTS.map((s, i) => {
        const a = Math.round(s.from * FPS), b = Math.round(s.to * FPS);
        return <Sequence key={i} from={a} durationInFrames={b - a} name={`План ${i + 1}`}><ShotView s={s} start={a} dur={b - a} /></Sequence>;
      })}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/tretiy_mix.wav")} />}
    </AbsoluteFill>
  );
};
