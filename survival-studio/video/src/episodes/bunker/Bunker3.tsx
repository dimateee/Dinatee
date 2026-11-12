import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/bunker3.words.json";
import { Grain } from "../../ui/Grain";
import { Plate, ServiceLabel } from "../../ui/Hud";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { lerpCam, Shelter, ShelterCam, ShelterClock, SirenPulse } from "../../scenes/Bunker";
import { DayYard, IodineCard, RouteMap } from "../../scenes/Bunker3";
import { BunkerEndCard } from "./BunkerCover";
import { ap, Caption, EASE, SchemaBg } from "../propusk/parts";

/*
 * «Бункер. Серия 3 — Когда можно выйти». TikTok 1080×1920, голос George. Голос 55,5 с + финальная заставка 5 с (> 60 с).
 * Факты: ready.gov (выходить по указанию властей), CDC (йодистый калий — только щитовидка и только по указанию;
 * йодную настойку не пить; питомцев мыть водой и вычёсывать).
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = 55.54, TAIL = 5.0;
export const BUNKER3_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const at = (w: string, after = 0) => {
  const h = WORDS.find((x) => x.start >= after - 0.05 && norm(x.word) === norm(w));
  if (!h) throw new Error(`Слово «${w}» после ${after} не найдено`);
  return h.start;
};
const MERGES: { words: string[]; after: number; text: string }[] = [{ words: ["четырнадцатый."], after: 0, text: "14-й." }];
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
  { word: "зря.", after: 5.9, color: "red" }, { word: "радио.", after: 9.3, color: "yellow" }, { word: "перчатки.", after: 16.9, color: "yellow" },
  { word: "трогай.", after: 23, color: "red" }, { word: "ожог", after: 31.8, color: "red" }, { word: "врачи.", after: 37, color: "yellow" },
  { word: "соседей.", after: 43.9, color: "yellow" }, { word: "сигналу.", after: 52.2, color: "yellow" },
];
const ACCENTS = Object.fromEntries(ACC.map((a) => {
  const i = CW.findIndex((w) => w.start >= a.after - 0.05 && norm(w.word) === norm(a.word));
  if (i < 0) throw new Error(`Акцент не найден: ${a.word}`);
  return [i, a.color];
})) as Record<number, "yellow" | "red">;

type ShotP = { f: number; dur: number; lf: (s: number) => number };
type Shot = { from: number; to: number; enter?: "cut" | "dissolve"; C: React.FC<ShotP> };
const DISSOLVE = 10;
const kIn = (f: number, s: number) => ap(f, s, 6);
const Rule: React.FC<{ n: number }> = ({ n }) => <ServiceLabel x={64} y={200} text={`ПРАВИЛО ${n}`} color={SRYV.fail} />;
const camMove = (f: number, a: ShelterCam, b: ShelterCam, s: number, len: number) => lerpCam(a, b, Math.min(1, Math.max(0, (f - s) / len)));
const PY = [290, 420, 550, 680];

const SHOTS: Shot[] = [
  // 1. Крючок: день 14, радио «можно выходить», дверь подвала открывается — внутрь бьёт дневной свет
  { from: 0, to: 6.7, C: ({ f, dur, lf }) => {
    const open = interpolate(f, [lf(at("выходить.", 2.2)), lf(at("выходить.", 2.2)) + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
    return (<>
      <Shelter frame={f} hero={false} standAtDoor radio={ap(f, lf(at("радио:", 1.4)), 6)} doorOpen={open}
        cam={camMove(f, { x: 320, y: 820, z: 1.55 }, { x: 300, y: 840, z: 1.3 }, 0, dur)} lamp={0.85} />
      <Plate x={64} y={PY[0]} kind="good" icon="radio" title="Можно выходить" opacity={kIn(f, lf(at("можно", 1.9)))} />
      <SirenPulse f={f} from={lf(at("ошибка", 3.5))} amount={0.45} />
      <ShelterClock hours={336} />
      <div style={{ position: "absolute", inset: 0, opacity: interpolate(f, [dur - 12, dur - 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <ServiceLabel x={64} y={200} text="БУНКЕР · СЕРИЯ 3" color={SRYV.fail} />
      </div>
    </>);
  } },
  // 2. Правило 1: только по радио; маршрут
  { from: 6.7, to: 13.12, enter: "dissolve", C: ({ f, dur, lf }) => {
    const map = lf(at("иди", 10.9));
    return (<>
      <Shelter frame={f + 200} hero={false} dog={false} radio={1} cam={camMove(f, { x: 560, y: 990, z: 1.9 }, { x: 560, y: 990, z: 2.1 }, 0, dur)} />
      <Rule n={1} />
      <Plate x={64} y={PY[0]} kind="good" icon="radio" title="Только по радио" sub="не раньше" opacity={kIn(f, lf(at("выходи,", 7.7))) * (1 - ap(f, map, 6))} />
      <RouteMap f={f} at={map} y={290} />
    </>);
  } },
  // 3. Правило 2: закрой кожу
  { from: 13.12, to: 20.04, enter: "dissolve", C: ({ f, dur, lf }) => (<>
    <DayYard frame={f} mode="exit" zoom={1 + 0.04 * f / dur} />
    <Rule n={2} />
    <Plate x={64} y={PY[0]} kind="resource" icon="shirt" title="Длинные рукава" opacity={kIn(f, lf(at("длинные", 15.3)))} />
    <Plate x={64} y={PY[1]} kind="resource" icon="hat" title="Шапка" opacity={kIn(f, lf(at("шапка,", 16.4)))} />
    <Plate x={64} y={PY[2]} kind="resource" icon="glove" title="Перчатки" opacity={kIn(f, lf(at("перчатки.", 16.8)))} />
    <Plate x={64} y={PY[3]} kind="resource" icon="mask" title="Маска или ткань" opacity={kIn(f, lf(at("маской", 18.5)))} />
  </>) },
  // 4. Правило 3: обходи пыль и обломки; огород и открытая вода — нельзя
  { from: 20.04, to: 28.04, enter: "dissolve", C: ({ f, dur, lf }) => (<>
    <DayYard frame={f + 200} mode="look" zoom={1.02 + 0.04 * f / dur} debrisMark={ap(f, lf(at("обходи", 21)), 8)} gardenMark={ap(f, lf(at("нельзя,", 26.3)), 8)} />
    <Rule n={3} />
    <Plate x={500} y={PY[0]} kind="bad" icon="warn" title="Не трогай" sub="пыль и обломки" opacity={kIn(f, lf(at("ничего", 22.4)))} />
    <Plate x={500} y={PY[1]} kind="bad" icon="warn" title="Огород, бочка" sub="пока не проверят" opacity={kIn(f, lf(at("овощи", 23.6)))} />
  </>) },
  // 5. Правило 4: миф про йод
  { from: 28.04, to: 37.84, enter: "dissolve", C: ({ f, lf }) => (<>
    <SchemaBg pal="S" />
    <ServiceLabel x={64} y={150} text="ПРАВИЛО 4 · МИФ ПРО ЙОД" color={SRYV.fail} />
    <IodineCard f={f} xAt={lf(at("нельзя:", 31))} kiAt={lf(at("таблетки", 32.9))} thyAt={lf(at("щитовидку", 35.1))} />
    <Plate x={64} y={800} kind="bad" icon="warn" title="Не пить" sub="ожог горла" opacity={kIn(f, lf(at("ожог", 31.8)))} />
    <Plate x={520} y={230} kind="good" icon="check" title="Йодистый калий" sub="только щитовидка" opacity={kIn(f, lf(at("таблетки", 32.9)))} />
    <Caption x={780} y={1010} w={540} text="ТОЛЬКО ПО УКАЗАНИЮ ВРАЧЕЙ" color={SRYV.progress} size={34} opacity={kIn(f, lf(at("врачи.", 37)))} />
  </>) },
  // 6. Правило 5: одежду в пакет, душ; Луну помыть и вычесать
  { from: 37.84, to: 43.6, enter: "dissolve", C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 400} cam={camMove(f, { x: 600, y: 900, z: 1.15 }, { x: 740, y: 990, z: 1.6 }, lf(at("луну", 41.1)) - 6, 30)} wash={ap(f, lf(at("помыть", 41.4)), 8)} radio={1} />
    <Rule n={5} />
    <Plate x={64} y={PY[0]} kind="resource" icon="bag" title="Одежду в пакет" opacity={kIn(f, lf(at("одежду", 39.3)))} />
    <Plate x={64} y={PY[1]} kind="resource" icon="soap" title="Душ" opacity={kIn(f, lf(at("душ.", 40.5)))} />
    <Plate x={64} y={PY[2]} kind="good" icon="paw" title="Луну — помыть" sub="и вычесать шерсть" opacity={kIn(f, lf(at("помыть", 41.4)))} />
  </>) },
  // 7. Проверь соседей
  { from: 43.6, to: 46.94, enter: "dissolve", C: ({ f, dur, lf }) => (<>
    <DayYard frame={f + 400} mode="knock" zoom={1.08 + 0.04 * f / dur} />
    <Plate x={64} y={PY[0]} kind="good" icon="door" title="Проверь соседей" opacity={kIn(f, lf(at("проверь", 43.7)))} />
  </>) },
  // 8. Итог трёх серий
  { from: 46.94, to: 53.28, enter: "dissolve", C: ({ f, lf }) => (<>
    <SchemaBg pal="S" />
    <ServiceLabel x={64} y={170} text="ИТОГ ТРЁХ СЕРИЙ" color={SRYV.lamp} />
    <Plate x={140} y={300} kind="good" icon="door" title="Зайди внутрь" opacity={kIn(f, lf(at("зайди", 48.2)))} />
    <Plate x={140} y={450} kind="good" icon="house" title="Останься внутри" opacity={kIn(f, lf(at("останься", 49.1)))} />
    <Plate x={140} y={600} kind="good" icon="radio" title="Слушай новости" opacity={kIn(f, lf(at("слушай", 50)))} />
    <Caption x={540} y={850} w={980} text="ВЫХОДИ — ТОЛЬКО ПО СИГНАЛУ" color={SRYV.progress} size={64} font="head" opacity={kIn(f, lf(at("выходи", 51.3)))} />
  </>) },
  // 9. Отправь другу
  { from: 53.28, to: VOICE_END + 0.3, enter: "dissolve", C: ({ f, dur, lf }) => (<>
    <Shelter frame={f + 600} hero={false} standAtDoor doorOpen={1} radio={1} cam={camMove(f, { x: 300, y: 860, z: 1.3 }, { x: 300, y: 860, z: 1.4 }, 0, dur)} />
    <Plate x={500} y={PY[0]} kind="resource" icon="share" title="Отправь другу" opacity={kIn(f, lf(at("отправь", 53.2)))} />
  </>) },
  // 10. Финальная заставка
  { from: VOICE_END + 0.3, to: VOICE_END + TAIL, enter: "dissolve", C: ({ f }) => <BunkerEndCard f={f} /> },
];

const Enter: React.FC<{ type?: Shot["enter"]; children: React.ReactNode }> = ({ type, children }) => {
  const f = useCurrentFrame();
  if (type === "dissolve") return <AbsoluteFill style={{ opacity: interpolate(f, [0, DISSOLVE], [0, 1], { extrapolateRight: "clamp", easing: EASE }) }}>{children}</AbsoluteFill>;
  return <AbsoluteFill>{children}</AbsoluteFill>;
};
const ShotView: React.FC<{ s: Shot; start: number; dur: number }> = ({ s, start, dur }) => {
  const f = useCurrentFrame();
  const lf = (sec: number) => Math.round(sec * FPS) - start;
  return <Enter type={s.enter}><s.C f={f} dur={dur} lf={lf} /></Enter>;
};

export const Bunker3: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      {SHOTS.map((s, i) => {
        const a = Math.round(s.from * FPS) - (s.enter === "dissolve" ? DISSOLVE : 0), b = Math.round(s.to * FPS);
        return <Sequence key={i} from={a} durationInFrames={b - a} name={`План ${i + 1}`}><ShotView s={s} start={a} dur={b - a} /></Sequence>;
      })}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/bunker3_mix.wav")} />}
    </AbsoluteFill>
  );
};
