import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/bunker1.words.json";
import { Grain } from "../../ui/Grain";
import { Plate, ServiceLabel } from "../../ui/Hud";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { BuildingSection, Countdown, HomeRoom, NightCity, Shelter, SirenPulse, Yard } from "../../scenes/Bunker";
import { ap, Caption, EASE, Push, SchemaBg, TimerCard } from "../propusk/parts";

/*
 * «Бункер. Серия 1 — Первые 15 минут». TikTok 1080×1920, голос George.
 * Факты: ready.gov «Nuclear Explosion», CDC «Get inside, stay inside, stay tuned», МЧС — сигнал «Внимание всем».
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = 71.43, TAIL = 1.0;
export const BUNKER1_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const at = (w: string, after = 0) => {
  const h = WORDS.find((x) => x.start >= after - 0.05 && norm(x.word) === norm(w));
  if (!h) throw new Error(`Слово «${w}» после ${after} не найдено`);
  return h.start;
};

const MERGES: { words: string[]; after: number; text: string }[] = [
  { words: ["пятнадцать"], after: 1.5, text: "15" },
  { words: ["десять", "двадцать."], after: 27, text: "10–20." },
  { words: ["девяноста", "процентов"], after: 52, text: "90%" },
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
  { word: "15", after: 1.5, color: "yellow" }, { word: "сирена.", after: 6.5, color: "red" }, { word: "смотри", after: 14.5, color: "red" },
  { word: "окон.", after: 22, color: "red" }, { word: "пыль.", after: 25, color: "red" }, { word: "машине:", after: 30, color: "red" },
  { word: "подвал", after: 37, color: "yellow" }, { word: "доза.", after: 44, color: "yellow" }, { word: "пакет.", after: 50.5, color: "yellow" },
  { word: "нельзя.", after: 56.5, color: "red" }, { word: "сутки", after: 60.5, color: "yellow" }, { word: "внутри.", after: 65, color: "yellow" },
];
const ACCENTS = Object.fromEntries(ACC.map((a) => {
  const i = CW.findIndex((w) => w.start >= a.after - 0.05 && norm(w.word) === norm(a.word));
  if (i < 0) throw new Error(`Акцент не найден: ${a.word}`);
  return [i, a.color];
})) as Record<number, "yellow" | "red">;

/* Обратный отсчёт: с вспышки (13,96 с), ускорен ×14 — «пока Артём действует, время уходит». */
const T_FLASH = 13.96, T_SAFE = 45.84, SPEED = 14;
const secLeft = (t: number) => 900 - Math.max(0, t - T_FLASH) * SPEED;

type ShotP = { f: number; dur: number; lf: (s: number) => number; t: (f: number) => number };
type Shot = { from: number; to: number; enter?: "cut" | "scale" | "wipe" | "lightOn" | "dissolve"; timer?: boolean; C: React.FC<ShotP> };
const DISSOLVE = 10; // кадров перекрытия
/** Непрерывный наезд камеры в комнате (планы 2–4 — одна сцена). */
const roomZoom = (t: number) => 1 + 0.1 * Math.min(1, Math.max(0, (t - 4.24) / (16.18 - 4.24)));
const kIn = (f: number, s: number) => ap(f, s, 6);
const Rule: React.FC<{ n: number }> = ({ n }) => <ServiceLabel x={64} y={226} text={`ПРАВИЛО ${n}`} color={SRYV.fail} />;
const decay = (f: number, s: number, len = 24) => interpolate(f, [s, s + 3, s + len], [0, 0.95, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const SHOTS: Shot[] = [
  // 1. Крючок: вспышка над городом, 15:00
  { from: 0, to: 4.24, C: ({ f, dur, lf }) => {
    return (<>
      <NightCity frame={f} flash={0.8 * decay(f, 0, 14)} glow={interpolate(f, [0, 20], [1, 0.8], { extrapolateRight: "clamp" })} zoom={1 + 0.05 * f / dur} />
      <TimerCard f={f} at={lf(at("пятнадцать", 1.5))} text="15:00" color={SRYV.fail} y={520} />
    </>);
  } },
  // 2–3. Одна комната: обычный вечер с телефоном → за окном воет сирена → включает радио
  { from: 4.24, to: 7.48, enter: "dissolve", C: ({ f, lf, t }) => {
    const sOn = interpolate(f, [lf(at("сирена.", 6.5)) - 4, lf(at("сирена.", 6.5)) + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (<>
      <HomeRoom frame={Math.round(t(f) * FPS)} hero={sOn > 0.5 ? "stand" : "phone"} siren={sOn} zoom={roomZoom(t(f))} />
      <ServiceLabel x={64} y={110} text="ОБЫЧНЫЙ ВЕЧЕР · 21:40" />
      <Plate x={440} y={224} kind="bad" icon="siren" title="Сирена" opacity={kIn(f, lf(at("сирена.", 6.5)))} />
      <SirenPulse f={f} from={lf(at("сирена.", 6.5))} amount={0.7} />
    </>);
  } },
  { from: 7.48, to: 12.02, C: ({ f, lf, t }) => {
    const kr = kIn(f, lf(at("включи", 9.9)));
    return (<>
      <HomeRoom frame={Math.round(t(f) * FPS)} hero="stand" siren={1} radio={ap(f, lf(at("радио", 10.3)), 6)} zoom={roomZoom(t(f))} />
      <Plate x={440} y={224} kind="bad" icon="warn" title="«Внимание всем!»" opacity={kIn(f, lf(at("внимание", 8.5))) * (1 - kr)} />
      <Plate x={440} y={224} kind="good" icon="radio" title="Радио · ТВ" sub="слушай сообщение" opacity={kr} />
      <SirenPulse f={f + 30} from={0} amount={0.5} />
    </>);
  } },
  // 4. Правило 1 — дома: вспышка в окне, не смотри
  { from: 12.02, to: 16.18, timer: true, C: ({ f, lf, t }) => {
    const fl = lf(at("вспышку", 13.8));
    return (<>
      <HomeRoom frame={Math.round(t(f) * FPS)} siren={f < fl ? 1 : 0} radio={1} flash={0.9 * decay(f, fl, 18)} glow={f >= fl ? 1 : 0} eyesShut={f >= fl} shake={f >= fl && f < fl + 8 ? 0.4 : 0} zoom={roomZoom(t(f))} />
      <Rule n={1} />
      <Plate x={440} y={224} kind="bad" icon="eye" title="Не смотри" sub="на вспышку" opacity={kIn(f, lf(at("не", 14.6)))} />
    </>);
  } },
  // 5. Ложись на пол лицом вниз
  { from: 16.18, to: 18.82, enter: "cut", timer: true, C: ({ f, dur }) => (<>
    <HomeRoom frame={f + 330} glow={0.9} radio={1} hero="prone" zoom={1.04 + 0.03 * f / dur} />
    <Rule n={1} />
    <Plate x={440} y={224} kind="good" icon="check" title="Лицом вниз" sub="руки под себя" opacity={kIn(f, 4)} />
  </>) },
  // 6. Ударная волна: стекло трескается — подальше от окон
  { from: 18.82, to: 23.36, enter: "cut", timer: true, C: ({ f, lf }) => {
    const w = lf(at("волна", 19));
    return (<>
      <HomeRoom frame={f + 410} glow={0.8} radio={1} hero="prone" zoom={1.07}
        shake={f >= w && f < w + 40 ? interpolate(f, [w, w + 40], [1, 0]) : 0} crack={ap(f, w, 3)} />
      <Rule n={1} />
      <Plate x={440} y={224} kind="bad" icon="warn" title="Подальше от окон" opacity={kIn(f, lf(at("держись", 21.3)))} />
    </>);
  } },
  // 7. Радиоактивная пыль: через 10–20 минут
  { from: 23.36, to: 28.64, enter: "dissolve", timer: true, C: ({ f, dur, lf }) => (<>
    <NightCity frame={f + 560} glow={0.55} zoom={1 + 0.04 * f / dur} dust={interpolate(f, [lf(at("радиоактивная", 24.5)) - 6, lf(at("радиоактивная", 24.5)) + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    <Plate x={64} y={240} kind="bad" icon="warn" title="Радиоактивная пыль" opacity={kIn(f, lf(at("радиоактивная", 24.5)))} />
    <Plate x={64} y={400} kind="resource" icon="hourglass" title="Через 10–20 мин" opacity={kIn(f, lf(at("минут", 27)))} />
  </>) },
  // 8. Правило 2 — двор: машина не защищает, бегом в кирпичный подъезд
  { from: 28.64, to: 35.72, enter: "dissolve", timer: true, C: ({ f, dur, lf }) => {
    const run = lf(at("заходи", 32.4));
    return (<>
      <Yard frame={f} carMark={ap(f, lf(at("машине:", 30.3)), 6)} runAt={run} doorLit={ap(f, run + 22, 8)} zoom={1 + 0.03 * f / dur} />
      <Rule n={2} />
      <Plate x={64} y={310} kind="bad" icon="car" title="Машина" sub="почти не защищает" opacity={kIn(f, lf(at("машине:", 30.3)))} />
      <Plate x={500} y={470} kind="good" icon="house" title="Кирпич · бетон" opacity={kIn(f, lf(at("кирпичное", 33.5)))} />
    </>);
  } },
  // 9. Правило 3: подвал или центр здания; чем больше бетона и земли — тем меньше доза
  { from: 35.72, to: 45.2, enter: "dissolve", timer: true, C: ({ f, lf }) => (<>
    <SchemaBg pal="S" />
    <BuildingSection f={f} dust={1} basement={ap(f, lf(at("подвал", 37.4)), 8)} center={ap(f, lf(at("центр", 38.2)), 8)}
      edges={ap(f, lf(at("подальше", 39.2)), 8)} dose={ap(f, lf(at("чем", 40.8)), 8)} />
    <Rule n={3} />
    <Caption x={900} y={262} w={240} text="ДОЗА" color="#C9D2E0" size={34} opacity={ap(f, lf(at("чем", 40.8)), 8)} />
  </>) },
  // 10. Луну — с собой: в укрытии
  { from: 45.2, to: 46.64, enter: "dissolve", timer: true, C: ({ f }) => (<>
    <Shelter frame={f} lamp={1} zoom={1.05} />
    <Plate x={64} y={240} kind="good" icon="paw" title="Луну — с собой" opacity={kIn(f, 4)} />
  </>) },
  // 11. Правило 4: одежду в пакет, −90% пыли
  { from: 46.64, to: 53.96, enter: "wipe", C: ({ f, dur, lf }) => {
    const k1 = kIn(f, lf(at("сними", 49))), k2 = kIn(f, lf(at("пакет.", 50.9))), k3 = kIn(f, lf(at("девяноста", 52)));
    return (<>
      <SchemaBg pal="S" />
      <Rule n={4} />
      <Push f={f} dur={dur} amount={0.03}>
        <Plate x={140} y={320} kind="bad" icon="warn" title="Был на улице?" opacity={kIn(f, lf(at("был", 48)))} />
        <Plate x={140} y={480} kind="resource" icon="shirt" title="Верхняя одежда" opacity={k1} />
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <path d={`M 300 600 L 300 ${600 + 70 * k2}`} stroke="#C9D2E0" strokeWidth={8} strokeLinecap="round" opacity={k2} />
          <path d="M 280 650 L 300 675 L 320 650" stroke="#C9D2E0" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={k2} />
        </svg>
        <Plate x={140} y={700} kind="good" icon="bag" title="В пакет" opacity={k2} />
        <Caption x={540} y={940} w={900} text="−90% ПЫЛИ" color={SRYV.progress} size={120} font="head" opacity={k3} />
      </Push>
    </>);
  } },
  // 12. Мыло и шампунь — да, кондиционер — нет
  { from: 53.96, to: 57.42, enter: "scale", C: ({ f, lf }) => {
    const kn = kIn(f, lf(at("кондиционер", 55.8)));
    return (<>
      <SchemaBg pal="S" />
      <Rule n={4} />
      <Plate x={140} y={340} kind="good" icon="soap" title="Мыло" opacity={kIn(f, lf(at("мылом", 54.4)))} />
      <Plate x={140} y={500} kind="good" icon="bottle" title="Шампунь" opacity={kIn(f, lf(at("шампунем.", 54.8)))} />
      <Plate x={140} y={660} kind="bad" icon="bottle" title="Кондиционер" sub="держит пыль в волосах" opacity={kn} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={232} y1={702} x2={232 + 370 * ap(f, lf(at("нельзя.", 56.5)), 7)} y2={696} stroke={SRYV.fail} strokeWidth={10} strokeLinecap="round" opacity={kn} />
      </svg>
    </>);
  } },
  // 13. Правило 5: радио на батарейках, минимум сутки
  { from: 57.42, to: 63.96, enter: "lightOn", C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 50} radio={ap(f, lf(at("радио", 58)), 8)} zoom={1 + 0.04 * f / dur} />
    <Rule n={5} />
    <TimerCard f={f} at={lf(at("минимум", 60.3))} text="24 Ч" color={SRYV.progress} y={430} />
  </>) },
  // 14. Зайди. Останься. Слушай.
  { from: 63.96, to: 67.5, enter: "wipe", C: ({ f, lf }) => (<>
    <SchemaBg pal="S" />
    <Plate x={140} y={300} kind="good" icon="door" title="Зайди внутрь" opacity={kIn(f, lf(at("зайди", 63.8)))} />
    <Plate x={140} y={460} kind="good" icon="house" title="Останься внутри" opacity={kIn(f, lf(at("останься", 64.8)))} />
    <Plate x={140} y={620} kind="good" icon="radio" title="Слушай новости" opacity={kIn(f, lf(at("слушай", 66)))} />
  </>) },
  // 15. Две недели? Серия 2
  { from: 67.5, to: VOICE_END + TAIL, enter: "lightOn", C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 120} radio={1} lamp={interpolate(f, [0, dur], [1, 0.55])} zoom={1.06 + 0.05 * f / dur} />
    <Plate x={64} y={240} kind="resource" icon="calendar" title="14 дней?" opacity={kIn(f, lf(at("две", 68.5)))} />
    <Plate x={64} y={420} kind="resource" icon="hourglass" title="Серия 2" sub="сутки в подвале" opacity={kIn(f, lf(at("об", 69.4)))} />
  </>) },
];

const Enter: React.FC<{ type?: Shot["enter"]; children: React.ReactNode }> = ({ type, children }) => {
  const f = useCurrentFrame();
  if (type === "scale") return <AbsoluteFill style={{ transform: `scale(${interpolate(f, [0, 6], [1.06, 1], { extrapolateRight: "clamp", easing: EASE })})` }}>{children}</AbsoluteFill>;
  if (type === "wipe") { const k = interpolate(f, [0, 7], [25, 100], { extrapolateRight: "clamp", easing: EASE }); return <AbsoluteFill style={{ backgroundColor: "#07090D" }}><AbsoluteFill style={{ clipPath: `inset(0 0 ${Math.round(100 - k)}% 0)` }}>{children}</AbsoluteFill></AbsoluteFill>; }
  if (type === "dissolve") return <AbsoluteFill style={{ opacity: interpolate(f, [0, DISSOLVE], [0, 1], { extrapolateRight: "clamp" }) }}>{children}</AbsoluteFill>;
  if (type === "lightOn") return <AbsoluteFill>{children}<AbsoluteFill style={{ backgroundColor: "#07090D", opacity: interpolate(f, [0, 8], [0.9, 0], { extrapolateRight: "clamp" }) }} /></AbsoluteFill>;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};
const ShotView: React.FC<{ s: Shot; start: number; dur: number }> = ({ s, start, dur }) => {
  const f = useCurrentFrame();
  const lf = (sec: number) => Math.round(sec * FPS) - start;
  const t = (fr: number) => (fr + start) / FPS;
  return (
    <Enter type={s.enter}>
      <s.C f={f} dur={dur} lf={lf} t={t} />
      {s.timer && <Countdown secLeft={secLeft(t(f))} safe={t(f) >= T_SAFE ? 1 : 0} />}
    </Enter>
  );
};

export const Bunker1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      {SHOTS.map((s, i) => {
        const a = Math.round(s.from * FPS) - (s.enter === "dissolve" && s.from > 0 ? DISSOLVE : 0), b = Math.round(s.to * FPS);
        return <Sequence key={i} from={a} durationInFrames={b - a} name={`План ${i + 1}`}><ShotView s={s} start={a} dur={b - a} /></Sequence>;
      })}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/bunker1_mix.wav")} />}
    </AbsoluteFill>
  );
};
