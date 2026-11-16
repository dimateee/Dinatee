import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/cam1.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { Bunks, Cat, CamFeed, Console, FULL, GateInside, GRID, lerpRect, Rect, Runner, Storage, Surface } from "../../scenes/Cam";
import { LOOKS } from "../../scenes/Podval";
import { PovArm } from "../../scenes/SvetPov";
import { idxIn, Layer, merge, pointWrist, ramp, sm, Stamp, wordAt } from "../svet/shared";

/*
 * «CAM 04». Серия 1 «Одно место» — весь ролик на экране пульта дежурного: 4 камеры, тепловизор, пульт и руки (LESSONS Б23).
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const CAM1_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  merge(out, "двадцать", 4, "29 из 30.");
  merge(out, "тридцать", 2, "32", 2);
  return out.map((w) => ({ ...w, word: w.word.replace(/[.!?] —$/, (m) => m[0]) }));
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["одно.", 1, "red"], ["двое.", 1, "red"], ["первыми.", 1, "yellow"], ["осколков.", 1, "yellow"], ["29 из 30.", 1, "red"],
  ["объектив.", 1, "yellow"], ["трое.", 1, "red"], ["трещать.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

/* ---------- Ключевые моменты ---------- */
const tOne = W("одно."), tTwo = W("а"), tYou = W("ты"), t60 = W("шестьдесят"), tCam1 = W("камера"), tZina = W("баба"),
  tBonk = W("голове.") + 0.7, tCount = W("счётчик:"), tCam4 = W("камера", 2), tKnock = W("стучит"), tCat = W("барсик"), tBtn = W("кнопку"),
  tMan = W("пустите"), tVit = W("закрывай!"), tZin = W("ребёнка"), t30 = W("тридцать"), tPress = W("включаешь"), tTherm = W("тепловизор."),
  tGirl = W("девочка"), tCoat = W("под"), tThree = W("их"), tDose = W("дозиметр"), t10 = W("десять"), tChoice = W("что"),
  tOpen = W("открываешь"), tOr = W("или"), tWrite = W("пиши."), tNext = W("следующая");

type Scene = "hook" | "door4" | "grid" | "cam1" | "count" | "cam4" | "cat" | "man" | "vitya" | "zina" | "therm" | "dose" | "ten" | "choice";
const SCENES: [number, Scene][] = [
  [0, "hook"], [tTwo - 0.1, "door4"], [tYou - 0.1, "grid"], [tCam1 - 0.1, "cam1"], [tCount - 0.1, "count"], [tCam4 - 0.1, "cam4"],
  [tCat - 0.1, "cat"], [tMan - 0.15, "man"], [tVit - 0.1, "vitya"], [tZin - 0.1, "zina"], [t30 - 0.1, "therm"], [tDose - 0.1, "dose"],
  [t10 - 0.1, "ten"], [tChoice - 0.1, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "hook", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };
/* какая камера на весь экран: 0..3 или -1 (сетка) */
const FOCUS: Record<Scene, number> = { hook: -1, door4: 3, grid: -1, cam1: 0, count: -1, cam4: 3, cat: -1, man: 3, vitya: 0, zina: 2, therm: 3, dose: 3, ten: -1, choice: -1 };

const RUNNERS: Runner[] = [
  { look: LOOKS.twinA, t0: tCam1 + 0.1, dur: 2.6, seed: 1 },
  { look: LOOKS.twinB, t0: tCam1 + 0.9, dur: 2.6, seed: 2 },
  { look: LOOKS.zina, t0: tZina - 0.3, dur: 3.4, seed: 3, cart: true },
  { look: LOOKS.petrova, t0: tZina + 1.2, dur: 2.6, seed: 4 },
  { look: LOOKS.vityaMask, t0: tBonk - 3.0, dur: 3.5, seed: 5, pot: true },
];
const seatsAt = (t: number) => 24 + RUNNERS.filter((r) => t >= r.t0 + r.dur * 0.92).length;
const timerAt = (t: number) => {
  if (t < t60) return "--:--";
  const v = Math.ceil(interpolate(t, [t60, t30, t10, VOICE_END + TAIL], [60, 30, 10, 4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return v >= 60 ? "01:00" : `00:${String(v).padStart(2, "0")}`;
};
const clock = (t: number) => { const s = 12 * 60 + 44 + Math.floor(t); return `03:${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

export const Cam1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const focus = FOCUS[s];
  // плавное раскрытие камеры на весь экран
  const prevFocus = (() => { let p = -1; for (const [a, sc] of SCENES) { if (a > t - f - 0.001) break; p = FOCUS[sc]; } return p; })();
  const grow = sm(ramp(f, 0, 0.3));
  const rectOf = (i: number): Rect => {
    if (focus === i) return prevFocus === i ? FULL : lerpRect(GRID[i], FULL, grow);
    if (prevFocus === i && focus !== i) return lerpRect(FULL, GRID[i], grow);
    return GRID[i];
  };
  const order = [0, 1, 2, 3].sort((a, b) => (a === focus ? 1 : 0) - (b === focus ? 1 : 0));
  const siren = t < tCam4 ? 0.5 + 0.5 * Math.sin(t * 5) : 0;
  const knock = s === "cam4" && t >= tKnock + 0.6 ? Math.min(1, (t - tKnock - 0.6) / 0.25) : 0;
  const hit = knock >= 1 && t < tKnock + 1.6 ? Math.sin(frame * 3) * 10 * (1 - (t - tKnock - 0.85) / 0.75) : 0;
  const thermal = t >= tTherm && t < tDose ? 1 : 0;
  const dose = ramp(t, tDose, 3.5);
  const seats = seatsAt(t);
  const time = clock(t);
  const talk = t >= tBtn ? 1 : 0;

  /* руки дежурного */
  const pressK = sm(ramp(t, tPress - 0.4, 0.4)) * (1 - sm(ramp(t, tTherm + 0.6, 0.4)));
  const wr = pointWrist(650, 1410, -18);
  const lever = sm(ramp(t, t10 + 0.2, 0.6));

  const feeds = [
    (rect: Rect) => <CamFeed key="c1" frame={frame} rect={rect} id="CAM 01" label="ГЕРМОДВЕРЬ" time={time} glitch={s === "dose" ? 0.3 : 0}
      talk={s === "vitya" ? "ВИТЯ" : undefined} hi={s === "vitya" ? 1 : 0}>
      {s === "vitya" || t > tVit
        ? <GateInside frame={frame} t={t} runners={[]} />
        : <GateInside frame={frame} t={t} runners={RUNNERS} bonk={tBonk} />}
      {(s === "vitya" || (t > tVit && t < t30)) && <VityaShout frame={frame} />}
    </CamFeed>,
    (rect: Rect) => <CamFeed key="c2" frame={frame} rect={rect} id="CAM 02" label="СКЛАД" time={time}><Storage frame={frame} /></CamFeed>,
    (rect: Rect) => <CamFeed key="c3" frame={frame} rect={rect} id="CAM 03" label="ОТСЕК" time={time} talk={s === "zina" ? "ЗИНА" : undefined} hi={s === "zina" ? 1 : 0}>
      <Bunks frame={frame} zinaShake={s === "zina" ? 1 : 0} />
    </CamFeed>,
    (rect: Rect) => <CamFeed key="c4" frame={frame} rect={rect} id="CAM 04" label="ПОВЕРХНОСТЬ" time={time} mode={thermal ? "thermal" : "night"}
      glitch={knock > 0 && t < tKnock + 1.6 ? 0.6 : s === "dose" ? 0.5 : 0} talk={s === "man" ? "МУЖЧИНА" : undefined} hi={s === "man" ? 1 : 0}>
      <Surface frame={frame} t={t} approach={s === "cam4" ? sm(ramp(t, tKnock - 0.6, 1.4)) : s === "man" ? 0.8 : 0} knock={s === "cam4" ? knock : 0}
        thermal={thermal} baby={sm(ramp(t, tCoat, 0.8))} />
    </CamFeed>,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#07090B", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${hit}px, ${hit * 0.4}px)` }}>
        {/* верхняя строка пульта */}
        <div style={{ position: "absolute", left: 14, right: 14, top: 40, height: 70, display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#C9E6D2", borderBottom: "3px solid #1E2620" }}>
          <span>УБЕЖИЩЕ №7</span>
          <span>КАМЕР 4/4</span>
          <span style={{ color: seats >= 29 ? "#FF6B5E" : "#C9E6D2", transform: `scale(${s === "count" ? 1.15 : 1})` }}>МЕСТ {t < tCam1 ? "··" : seats}/30</span>
        </div>
        {order.map((i) => feeds[i](rectOf(i)))}
        {/* сирена: красный пульс по мониторам */}
        {siren > 0 && <div style={{ position: "absolute", left: 14, top: 124, width: 1052, height: 1012, background: "#FF2A1A", opacity: 0.16 * siren, mixBlendMode: "screen" }} />}
        <Console frame={frame} timer={timerAt(t)} timerHot={(t >= t30 && t < t30 + 1.5) || t >= t10 ? 1 : 0} talk={talk} thermal={thermal} dose={dose} lever={lever} />
        {/* Барсик идёт по пульту и наступает на «СВЯЗЬ» */}
        {t >= tCat - 0.2 && t < tMan + 3 && (
          <Layer>
            <g transform={`translate(${interpolate(t, [tCat - 0.2, tBtn, tMan + 3], [-120, 470, 1240])} 1440) scale(1.6)`}><Cat frame={frame} /></g>
          </Layer>
        )}
        <Layer>
          <PovArm x={500} y={1960} angle={4} side="L" pose="flat" light={0.45} />
          {lever > 0
            ? <PovArm x={785} y={1546 + 60 * (1 - lever)} angle={-4} side="R" pose="fist" light={0.5} />
            : pressK > 0
              ? <PovArm x={wr.x + (1 - pressK) * 200} y={wr.y + (1 - pressK) * 500} angle={-18} side="R" pose="point" light={0.5} />
              : <PovArm x={900} y={1900} angle={-16} side="R" pose="flat" light={0.45} />}
        </Layer>
      </AbsoluteFill>

      {/* штампы */}
      {s === "hook" && <Stamp k={ramp(t, tOne - 0.2, 0.2)} top={480} size={96}>МЕСТ: 1</Stamp>}
      {s === "door4" && <Stamp k={ramp(t, W("двое.") - 0.2, 0.2)} top={480} size={96}>У ДВЕРИ: 2</Stamp>}
      {s === "count" && <Stamp k={ramp(t, tCount + 0.3, 0.25)} top={480} size={110}>29 / 30</Stamp>}
      {s === "cat" && t >= tBtn && <Stamp k={ramp(t, tBtn, 0.2)} color="#3DDC84" top={500} size={56}>СВЯЗЬ ВКЛ</Stamp>}
      {s === "therm" && t >= tGirl && t < tCoat && <Stamp k={ramp(t, tGirl, 0.2)} color="#FFC93C" top={260} size={44}>ДЕВОЧКА · 36,6°</Stamp>}
      {s === "therm" && t >= tThree - 0.1 && <Stamp k={ramp(t, tThree - 0.1, 0.25)} top={260} size={80}>ИХ ТРОЕ</Stamp>}
      {s === "dose" && <Stamp k={ramp(t, W("трещать.") - 0.3, 0.25)} color="#E8C547" top={480} size={60}>☢ ФОН РАСТЁТ</Stamp>}
      {s === "choice" && (
        <div style={{ position: "absolute", left: 14, top: 124, width: 1052, height: 1012, background: "rgba(4,6,8,.78)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
          {([["ОТКРЫТЬ ВСЕМ ТРОИМ", "32 человека на 30 мест", "#3DDC84", tOpen], ["НЕ ОТКРЫВАТЬ НИКОМУ", "дверь закроется сама", SRYV.fail, tOr]] as const).map(([txt, sub, c, at], i) => {
            const k = ramp(t, at - 0.3, 0.3);
            return (
              <React.Fragment key={txt}>
                {i === 1 && <div style={{ opacity: k, fontFamily: "Inter Display", fontWeight: 900, fontSize: 46, color: "#C9D2E0" }}>ИЛИ</div>}
                <div style={{ transform: `scale(${0.88 + 0.12 * k})`, opacity: 0.25 + 0.75 * k, width: 900, textAlign: "center", padding: "24px 20px",
                  borderRadius: 24, border: `6px solid ${c}`, background: "rgba(10,12,18,.92)", boxShadow: `0 0 34px ${c}55` }}>
                  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 64, color: "#FFFFFF", lineHeight: 1 }}>{txt}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#9AA6BA", marginTop: 8 }}>{sub}</div>
                </div>
              </React.Fragment>
            );
          })}
          <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, color: "#E8C547", marginTop: 6 }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
          <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 2 — С ТВОЕГО ОТВЕТА</div>
        </div>
      )}
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/cam1_mix.wav")} />}
    </AbsoluteFill>
  );
};

/* Витя в противогазе и кастрюле орёт прямо в камеру */
const VityaShout: React.FC<{ frame: number }> = ({ frame }) => (
  <g transform="translate(270 470) scale(1.05)">
    <ellipse cx={0} cy={0} rx={140} ry={20} fill="#000" opacity={0.35} />
    <g transform={`translate(0 0) rotate(${Math.sin(frame / 3) * 3})`}>
      <path d="M -120 0 Q -130 -200 -60 -250 L 60 -250 Q 130 -200 120 0 Z" fill="#3E6E8E" />
      <circle cx={0} cy={-330} r={110} fill="#E9B48F" />
      <ellipse cx={0} cy={-300} rx={92} ry={78} fill="#D8D2C2" stroke="#3A2A20" strokeWidth={6} />
      <circle cx={-38} cy={-330} r={26} fill="#1A1D22" stroke="#8A929E" strokeWidth={6} /><circle cx={38} cy={-330} r={26} fill="#1A1D22" stroke="#8A929E" strokeWidth={6} />
      <circle cx={0} cy={-262} r={30} fill="#6E7A8E" stroke="#3A4250" strokeWidth={6} />
      <rect x={-118} y={-470} width={236} height={96} rx={14} fill="#9AA3AE" stroke="#3A4250" strokeWidth={8} />
      <rect x={-126} y={-482} width={252} height={22} rx={10} fill="#B9C1CB" />
      <rect x={-150} y={-450} width={34} height={18} rx={6} fill="#6E7A8E" /><rect x={116} y={-450} width={34} height={18} rx={6} fill="#6E7A8E" />
      <path d={`M -120 -200 L -200 ${-300 + Math.sin(frame / 2) * 30}`} stroke="#3E6E8E" strokeWidth={40} strokeLinecap="round" />
      <path d={`M 120 -200 L 200 ${-310 + Math.cos(frame / 2) * 30}`} stroke="#3E6E8E" strokeWidth={40} strokeLinecap="round" />
    </g>
  </g>
);
