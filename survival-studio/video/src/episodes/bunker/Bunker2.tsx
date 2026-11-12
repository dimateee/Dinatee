import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/bunker2.words.json";
import { Grain } from "../../ui/Grain";
import { Plate, ServiceLabel } from "../../ui/Hud";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { DecayBars, GROUND, lerpCam, Shelter, ShelterCam, ShelterClock } from "../../scenes/Bunker";
import { ap, EASE, SchemaBg } from "../propusk/parts";

/*
 * «Бункер. Серия 2 — Две недели в подвале». TikTok 1080×1920, голос George.
 * Факты: правило 7–10 (Glasstone & Dolan), ready.gov (вода ~4 л/чел/день, вентиляция, туалет, фонарик), CDC (еда в упаковке).
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = 66.25, TAIL = 1.0;
export const BUNKER2_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const at = (w: string, after = 0) => {
  const h = WORDS.find((x) => x.start >= after - 0.05 && norm(x.word) === norm(w));
  if (!h) throw new Error(`Слово «${w}» после ${after} не найдено`);
  return h.start;
};
const MERGES: { words: string[]; after: number; text: string }[] = [
  { words: ["семь"], after: 15, text: "7" },
  { words: ["десять"], after: 18.4, text: "10" },
  { words: ["сто"], after: 20.5, text: "100" },
  { words: ["четырёх"], after: 32.3, text: "4" },
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
  { word: "выйти»", after: 4.8, color: "red" }, { word: "кончилось.", after: 11.7, color: "red" }, { word: "10", after: 18.5, color: "yellow" },
  { word: "100", after: 20.6, color: "yellow" }, { word: "вентиляцию.", after: 27.3, color: "yellow" }, { word: "4", after: 32.4, color: "yellow" },
  { word: "протри.", after: 43.5, color: "yellow" }, { word: "крепко.", after: 50.3, color: "yellow" }, { word: "фонарик.", after: 52.9, color: "yellow" },
  { word: "угарный", after: 55.9, color: "red" }, { word: "часам.", after: 59.9, color: "yellow" },
];
const ACCENTS = Object.fromEntries(ACC.map((a) => {
  const i = CW.findIndex((w) => w.start >= a.after - 0.05 && norm(w.word) === norm(a.word));
  if (i < 0) throw new Error(`Акцент не найден: ${a.word}`);
  return [i, a.color];
})) as Record<number, "yellow" | "red">;

/* Время в укрытии: часы → дни (сюжетное, растягивается к финалу). */
const HOURS: [number, number][] = [[0, 0.5], [5.7, 1], [12.9, 6], [24.3, 24], [30.5, 30], [39.3, 50], [44.3, 72], [51.1, 120], [56.7, 192], [62.6, 312], [67.3, 336]];
const hoursAt = (t: number) => interpolate(t, HOURS.map((h) => h[0]), HOURS.map((h) => h[1]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

type ShotP = { f: number; dur: number; lf: (s: number) => number; t: (f: number) => number };
type Shot = { from: number; to: number; enter?: "cut" | "dissolve"; clock?: boolean; C: React.FC<ShotP> };
const DISSOLVE = 10;
const kIn = (f: number, s: number) => ap(f, s, 6);
const Rule: React.FC<{ n: number }> = ({ n }) => <ServiceLabel x={64} y={200} text={`ПРАВИЛО ${n}`} color={SRYV.fail} />;
/** Наезд камеры от a к b на отрезке кадров [s, s+len]. */
const camMove = (f: number, a: ShelterCam, b: ShelterCam, s: number, len: number) => lerpCam(a, b, Math.min(1, Math.max(0, (f - s) / len)));
const PY = [290, 440, 590]; // ряды плашек

const SHOTS: Shot[] = [
  // 1. Крючок: крупно лампа, с потолка сыплется пыль, отъезд — Артём и Луна; «УЖЕ МОЖНО ВЫЙТИ?» → «НЕТ»
  { from: 0, to: 5.7, C: ({ f, dur, lf }) => {
    const cam = camMove(f, { x: 520, y: 380, z: 2.1 }, { x: 470, y: 800, z: 1.12 }, 0, Math.round(3.4 * FPS));
    const q = lf(at("уже", 4.2)), no = lf(at("выйти»", 4.8)) + 6;
    const kq = kIn(f, q), kn = ap(f, no, 4);
    return (<>
      <Shelter frame={f} cam={cam} dustFall={interpolate(f, [0, 60], [1, 0.25], { extrapolateRight: "clamp" })} radio={0} />
      <div style={{ position: "absolute", inset: 0, background: "rgba(7,9,13,0.5)", opacity: kq }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 480, display: "flex", flexDirection: "column", alignItems: "center", opacity: kq }}>
        <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 104, lineHeight: 1, color: "#FFFFFF", textAlign: "center", textShadow: "0 6px 24px rgba(0,0,0,.8)",
          transform: `scale(${0.92 + 0.08 * kq})` }}>УЖЕ МОЖНО<br />ВЫЙТИ?</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 720, display: "flex", justifyContent: "center", opacity: kn }}>
        <div style={{ transform: `rotate(-8deg) scale(${1.6 - 0.6 * kn})`, border: `10px solid ${SRYV.fail}`, borderRadius: 18, padding: "8px 40px",
          fontFamily: "Inter Display", fontWeight: 900, fontSize: 130, lineHeight: 1, color: SRYV.fail, textShadow: "0 0 24px rgba(229,57,53,.7)", boxShadow: "0 0 30px rgba(229,57,53,.5)" }}>НЕТ</div>
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: interpolate(f, [dur - 12, dur - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <ServiceLabel x={64} y={110} text="БУНКЕР · СЕРИЯ 2" color={SRYV.fail} />
      </div>
    </>);
  } },
  // 2. Первая ночь: радио шипит, телефон без сети
  { from: 5.7, to: 12.92, clock: true, C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 171} cam={camMove(f, { x: 470, y: 800, z: 1.12 }, { x: 430, y: 820, z: 1.24 }, 0, dur)} static_={f >= lf(at("радио", 8.6)) ? 1 : 0} />
    <ServiceLabel x={64} y={200} text="НОЧЬ 1 · 02:14" />
    <Plate x={64} y={PY[0]} kind="bad" icon="radio" title="Тишина в эфире" opacity={kIn(f, lf(at("радио", 8.6)))} />
    <Plate x={64} y={PY[1]} kind="bad" icon="phone" title="Нет сети" opacity={kIn(f, lf(at("телефон", 9.7)))} />
  </>) },
  // 3. Правило 7–10: полосы излучения
  { from: 12.92, to: 24.28, enter: "dissolve", C: ({ f, lf }) => (<>
    <SchemaBg pal="S" />
    <ServiceLabel x={64} y={170} text="ПРАВИЛО 7 И 10" color={SRYV.lamp} />
    <DecayBars f={f} at={[lf(at("правило", 13.2)), lf(at("семь", 15.3)), lf(at("двое", 19.7))]} y={290} />
    <Plate x={64} y={900} kind="good" icon="hourglass" title="Каждый час — на тебя" opacity={kIn(f, lf(at("каждый", 21.3)))} />
  </>) },
  // 4. Правило 1: закрыть, вентиляцию выключить и заклеить
  { from: 24.28, to: 30.56, enter: "dissolve", clock: true, C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 730} cam={camMove(f, { x: 260, y: 820, z: 1.35 }, { x: 200, y: 790, z: 1.55 }, 0, dur)} vent={1}
      taped={interpolate(f, [lf(at("выключи", 27)), lf(at("выключи", 27)) + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    <Rule n={1} />
    <Plate x={520} y={PY[0]} kind="good" icon="door" title="Окна и двери" sub="закрыть" opacity={kIn(f, lf(at("закрой", 25.5)))} />
    <Plate x={520} y={PY[1]} kind="bad" icon="warn" title="Вентиляция" sub="выключить" opacity={kIn(f, lf(at("выключи", 27)))} />
  </>) },
  // 5. Правило 2: вода — полка с бутылками, потом миска Луны
  { from: 30.56, to: 39.32, enter: "dissolve", clock: true, C: ({ f, lf }) => (<>
    <Shelter frame={f + 920} cam={camMove(f, { x: 1000, y: 600, z: 1.5 }, { x: 760, y: 980, z: 1.5 }, lf(at("запас", 36)) - 6, 30)} jugs={1} />
    <Rule n={2} />
    <Plate x={440} y={PY[0]} kind="resource" icon="bottle" title="≈ 4 л в день" sub="на человека" opacity={kIn(f, lf(at("четырёх", 32.3)))} />
    <Plate x={440} y={PY[1]} kind="resource" icon="paw" title="Запас для Луны" opacity={kIn(f, lf(at("запас", 36)))} />
    <Plate x={440} y={PY[2]} kind="good" icon="check" title="Закрытые бутылки" opacity={kIn(f, lf(at("пей", 37.3)))} />
  </>) },
  // 6. Правило 3: банки и упаковки — протри
  { from: 39.32, to: 44.3, enter: "dissolve", clock: true, C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 1180} cam={camMove(f, { x: 860, y: 720, z: 1.5 }, { x: 870, y: 700, z: 1.65 }, 0, dur)} jugs={1} cansMark={ap(f, lf(at("еда", 40.3)), 6)} />
    <Rule n={3} />
    <Plate x={64} y={PY[0]} kind="good" icon="check" title="Банки, упаковки" opacity={kIn(f, lf(at("еда", 40.3)))} />
    <Plate x={64} y={PY[1]} kind="resource" icon="soap" title="Протри" sub="перед тем, как открыть" opacity={kIn(f, lf(at("протри.", 43.4)))} />
  </>) },
  // 7. Правило 4: туалет — ведро, мешок, песок
  { from: 44.3, to: 51.1, enter: "dissolve", clock: true, C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 1330} cam={camMove(f, { x: 240, y: 940, z: 1.4 }, { x: 220, y: 960, z: 1.55 }, 0, dur)} bucket={1} />
    <Rule n={4} />
    <Plate x={64} y={PY[0]} kind="resource" icon="bag" title="Ведро + мешок" opacity={kIn(f, lf(at("ведро,", 47.5)))} />
    <Plate x={64} y={PY[1]} kind="resource" icon="check" title="Песок" sub="или наполнитель" opacity={kIn(f, lf(at("песок.", 48.8)))} />
    <Plate x={64} y={PY[2]} kind="good" icon="check" title="Завязывай крепко" opacity={kIn(f, lf(at("завязывай", 49.8)))} />
  </>) },
  // 8. Правило 5: фонарик — да, свеча — нет
  { from: 51.1, to: 56.68, enter: "dissolve", clock: true, C: ({ f, dur, lf }) => {
    const cam = camMove(f, { x: 580, y: 900, z: 1.4 }, { x: 560, y: 910, z: 1.55 }, 0, dur);
    const ks = ap(f, lf(at("свеча", 53.7)), 6), kx = ap(f, lf(at("пожар", 55.4)), 6);
    const cx = 540 + (516 - cam.x) * cam.z, cy = 760 + (GROUND - 170 - cam.y) * cam.z;
    return (<>
      <Shelter frame={f + 1530} cam={cam} torch={ap(f, lf(at("фонарик.", 52.9)), 3)} candle={ks} lamp={0.8} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g opacity={kx}>
          <circle cx={cx} cy={cy} r={95} fill="none" stroke={SRYV.fail} strokeWidth={14} />
          <line x1={cx - 67} y1={cy + 67} x2={cx + 67} y2={cy - 67} stroke={SRYV.fail} strokeWidth={14} strokeLinecap="round" />
        </g>
      </svg>
      <Rule n={5} />
      <Plate x={520} y={PY[0]} kind="good" icon="check" title="Фонарик" opacity={kIn(f, lf(at("фонарик.", 52.9)))} />
      <Plate x={520} y={PY[1]} kind="bad" icon="warn" title="Свеча" sub="пожар, угарный газ" opacity={kIn(f, lf(at("свеча", 53.7)))} />
    </>);
  } },
  // 9. Режим: сон, еда, радио — по часам; Луна спокойна
  { from: 56.68, to: 62.62, enter: "dissolve", clock: true, C: ({ f, lf }) => {
    const toLuna = lf(at("луна", 60.5));
    return (<>
      <Shelter frame={f + 1700} radio={ap(f, lf(at("радио", 59.2)), 6)} cam={camMove(f, { x: 540, y: 780, z: 1.05 }, { x: 720, y: 980, z: 1.6 }, toLuna, 36)} />
      <ServiceLabel x={64} y={200} text="РЕЖИМ" color={SRYV.progress} />
      <Plate x={64} y={PY[0]} kind="good" icon="alarm" title="Сон" opacity={kIn(f, lf(at("сон,", 57.9)))} />
      <Plate x={330} y={PY[0]} kind="good" icon="alarm" title="Еда" opacity={kIn(f, lf(at("еда,", 58.5)))} />
      <Plate x={596} y={PY[0]} kind="good" icon="radio" title="Радио" opacity={kIn(f, lf(at("радио", 59.2)))} />
    </>);
  } },
  // 10. Финал: дверь, свет из щели — серия 3
  { from: 62.62, to: VOICE_END + TAIL, enter: "dissolve", clock: true, C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 1880} radio={1} lamp={interpolate(f, [0, dur], [1, 0.6])} cam={camMove(f, { x: 300, y: 860, z: 1.25 }, { x: 160, y: 860, z: 1.5 }, 0, dur)} />
    <Plate x={500} y={PY[0]} kind="resource" icon="door" title="Серия 3" sub="когда выходить" opacity={kIn(f, lf(at("последней", 65)))} />
  </>) },
];

const Enter: React.FC<{ type?: Shot["enter"]; children: React.ReactNode }> = ({ type, children }) => {
  const f = useCurrentFrame();
  if (type === "dissolve") return <AbsoluteFill style={{ opacity: interpolate(f, [0, DISSOLVE], [0, 1], { extrapolateRight: "clamp", easing: EASE }) }}>{children}</AbsoluteFill>;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};
const ShotView: React.FC<{ s: Shot; start: number; dur: number }> = ({ s, start, dur }) => {
  const f = useCurrentFrame();
  const lf = (sec: number) => Math.round(sec * FPS) - start;
  const t = (fr: number) => (fr + start) / FPS;
  return (
    <Enter type={s.enter}>
      <s.C f={f} dur={dur} lf={lf} t={t} />
      {s.clock && <ShelterClock hours={hoursAt(t(f))} />}
    </Enter>
  );
};

export const Bunker2: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      {SHOTS.map((s, i) => {
        const a = Math.round(s.from * FPS) - (s.enter === "dissolve" ? DISSOLVE : 0), b = Math.round(s.to * FPS);
        return <Sequence key={i} from={a} durationInFrames={b - a} name={`План ${i + 1}`}><ShotView s={s} start={a} dur={b - a} /></Sequence>;
      })}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/bunker2_mix.wav")} />}
    </AbsoluteFill>
  );
};
