import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/db2.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { NEUTRAL } from "../../rig/Hero";
import { ANYA, Creature, DbDefs, DbMeter, ExitSign, Foreground, Library, ME, Person, Pocket, Rings, sitPose, STRANGER, TapBucket, Vent, walkPose } from "../../scenes/Db";
import { idxIn, merge, ramp, sm, Stamp, wordAt } from "../svet/shared";

/*
 * «40 дБ». Серия 2 «Капля» — ответ зрителей: швырнуть телефон. Формула А6, TikTok А7, хук-удар Б27, страшно Б25.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const DB2_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  merge(out, "шесть", 3, "06:00.");
  merge(out, "сорок", 2, "41.", 4);
  merge(out, "сорок.", 1, "40.", 3);
  merge(out, "тридцать", 2, "38.", 2);
  return out;
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["замирает.", 1, "red"], ["швырнуть.", 1, "yellow"], ["телефон.", 1, "red"], ["порога.", 1, "yellow"], ["метрах.", 1, "red"],
  ["носом:", 1, "yellow"], ["наши.", 1, "yellow"], ["сорока.", 1, "yellow"], ["трогать.", 1, "yellow"], ["ноль.", 2, "red"], ["проблема.", 1, "red"],
  ["41.", 1, "red"], ["аня.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

/* ---------- Ключевые моменты ---------- */
const tStop = W("не"), tRecap = W("шесть"), tChose = W("вы"), tFly = W("телефон"), tLand = W("удар") + 0.6, tFall = W("падает."),
  tDrop = W("тварь", 2), tStep = W("наступает"), tTap = W("только"), tInside = W("теперь"), tR1 = W("правило"), tR2 = W("второе."),
  tMove = W("двигается"), tR3 = W("третье."), tCount = W("считаем"), tR4 = W("четвёртое."), tBook = W("упавшая"),
  tStr = W("чужак"), tMeter = W("шумомер"), tZero = W("совсем"), tPlan = W("план"), tProblem = W("была"), tThat = W("тот"), tDrip = W("кап."),
  tFlow = W("вода"), t38 = W("тридцать", 2), t40 = W("сорок", 3), t41 = W("сорок", 4), tTurn = W("тварь", 3), tAnya = W("аня."), tChoice = W("что"),
  tA = W("закрыл"), tB = W("или"), tWrite = W("пиши."), tNext = W("следующая");

type Scene = "cold" | "recap" | "throw" | "vent" | "drip" | "inside" | "r1" | "r2" | "r3" | "r4" | "stranger" | "plan" | "problem" | "tap" | "turn" | "choice";
const SCENES: [number, Scene][] = [
  [0, "cold"], [tRecap - 0.1, "recap"], [tFly - 0.1, "throw"], [W("под") - 0.1, "vent"], [tTap - 0.1, "drip"], [tInside - 0.1, "inside"],
  [tR1 - 0.1, "r1"], [tR2 - 0.1, "r2"], [tR3 - 0.1, "r3"], [tR4 - 0.1, "r4"], [tStr - 0.1, "stranger"], [tPlan - 0.1, "plan"], [tProblem - 0.1, "problem"],
  [tThat - 0.1, "tap"], [tTurn - 0.1, "turn"], [tChoice - 0.1, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "cold", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };

type Cam = { x: number; y: number; z: number };
const lerpCam = (a: Cam, b: Cam, k: number): Cam => { const q = sm(Math.min(1, Math.max(0, k))); return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, z: a.z + (b.z - a.z) * q }; };
const camT = (c: Cam) => `translate(540 900) scale(${c.z}) translate(${-c.x} ${-c.y})`;

/* Мир: дальний конец зала слева (вентиляция), выход справа */
const MEX = 330, ANX = 200, STX = 1150, GY = 1450, S = 1.5;
const VENT = { x: -330, y: 330 }, PHONE_END = { x: -380, y: GY - 6 }, TAP = { x: 60, y: GY }, EXIT = { x: 1560, y: GY - 520 };
const HALL: Cam = { x: 560, y: 1000, z: 0.52 };
const FACE_ANYA = { x: ANX + 60, y: GY - 205 };

/* Тварь в зале: спуск из вентиляции, шаги, замирание */
const crX = (t: number) => interpolate(t, [tDrop, tStep, tMove, tR3], [VENT.x, PHONE_END.x + 20, PHONE_END.x + 20, -140], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const crY = (t: number) => interpolate(t, [tDrop, tDrop + 1.3], [GY - 600, GY], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const dbAt = (t: number) => {
  if (t < tStop - 0.1) return 78 - 30 * t;
  if (t < tRecap) return 18;
  if (t < tStep + 0.4) return t >= tLand && t < tLand + 0.5 ? 60 : 75;
  if (t >= tMeter + 0.3 && t < tPlan) return 0;
  if (t >= tTap && t < tInside) return ((t - tTap) % 3) < 0.4 ? 30 : 14;
  if (t >= tR1 && t < tR2) return ((t - tR1) % 1.6) < 0.8 ? 25 : 14;
  if (t >= tMove && t < tR3) return ((t - tMove) % 0.8) < 0.4 ? 45 : 22;
  if (t >= tThat) return interpolate(t, [tThat, tDrip, tFlow, t38, t40, t41, VOICE_END + TAIL], [14, 30, 34, 38, 40, 41, 43], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return 14 + Math.sin(t * 3);
};
const distAt = (t: number) => (t < tDrop ? 60 : interpolate(t, [tDrop, tMove, tR3, VOICE_END + TAIL], [30, 30, 26, 26], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

export const Db2: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const db = dbAt(t);
  const recap = s === "recap";
  const cuts = [0, tStop - 0.1, tRecap - 0.1, tFly - 0.1];
  const flash = cuts.reduce((m, c) => Math.max(m, t >= c && t < c + 0.1 ? 1 - (t - c) / 0.1 : 0), 0);
  const punch = cuts.reduce((m, c) => Math.max(m, t >= c && t < c + 0.35 ? 1 - (t - c) / 0.35 : 0), 0);
  const shake = (db >= 60 ? Math.sin(frame * 3.1) * 4 : 0) + (s === "cold" ? Math.sin(frame * 2.7) * 10 : 0) + (t >= tFall && t < tFall + 0.4 ? Math.sin(frame * 3) * 12 : 0)
    + (t >= tDrop + 1.2 && t < tDrop + 1.6 ? Math.sin(frame * 3) * 14 : 0);
  const dip = Math.max(0, 1 - f / 0.15) * (s === "cold" ? 0 : 0.85);

  /* камера */
  const cam = ((): Cam => {
    switch (s) {
      case "cold": return t < tStop - 0.1 ? { x: VENT.x + 160, y: GY - 760, z: 1.9 } : lerpCam({ x: FACE_ANYA.x, y: FACE_ANYA.y + 40, z: 5.2 }, { x: FACE_ANYA.x, y: FACE_ANYA.y + 40, z: 4.2 }, (t - tStop) / 2);
      case "throw": return lerpCam({ x: STX - 300, y: 1150, z: 0.9 }, { x: -150, y: 1100, z: 0.9 }, (t - tFly) / 2.6);
      case "vent": return t < tDrop - 0.2 ? lerpCam({ x: VENT.x + 120, y: 700, z: 1.6 }, { x: VENT.x + 80, y: 560, z: 2.0 }, f / 3) : lerpCam({ x: VENT.x + 120, y: 900, z: 1.1 }, { x: PHONE_END.x + 120, y: 1100, z: 1.3 }, (t - tDrop) / 2);
      case "drip": return { x: TAP.x + 60, y: GY - 260, z: 2.6 + 0.03 * f };
      case "inside": return lerpCam({ x: 300, y: 1100, z: 0.8 }, HALL, f / 2);
      case "r1": return { x: MEX + 92, y: GY - 225, z: 3.8 };
      case "r2": return { x: 120, y: 1080, z: 0.7 };
      case "r3": return lerpCam({ x: 20, y: 880, z: 1.3 }, { x: 10, y: 820, z: 1.8 }, f / 6);
      case "r4": return { x: 820, y: 900, z: 2.4 };
      case "stranger": return lerpCam({ x: 900, y: 1150, z: 0.9 }, { x: 700, y: 1150, z: 0.9 }, f / 6);
      case "plan": return lerpCam({ x: 700, y: 1100, z: 0.7 }, { x: 1000, y: 1100, z: 0.6 }, f / 3);
      case "tap": return lerpCam({ x: TAP.x + 60, y: GY - 260, z: 2.4 }, { x: TAP.x + 60, y: GY - 240, z: 3.0 }, f / 8);
      case "turn": return t < tAnya - 0.2 ? lerpCam({ x: -140 + 200, y: GY - 760, z: 1.5 }, { x: -140 + 200, y: GY - 780, z: 2.0 }, f / 3) : { x: FACE_ANYA.x, y: FACE_ANYA.y + 30, z: 4.6 };
      case "choice": return { x: TAP.x + 80, y: GY - 300, z: 1.8 };
      default: return HALL;
    }
  })();
  const inLib = s !== "recap" && s !== "problem" && !(s === "cold" && false);
  const crVisible = t >= tDrop || s === "cold" || s === "turn";
  const cx = s === "cold" || s === "turn" ? -140 : crX(t), cy = s === "cold" || s === "turn" ? GY : crY(t);
  const crFlare = s === "cold" ? 1 : s === "r3" ? 0.6 + 0.4 * Math.sin(frame / 6) : s === "turn" ? 1 : t >= tStep ? 0.3 : 0;
  const crTurn = s === "turn" ? -0.4 + 0.9 * sm(ramp(t, tTurn, 1.6)) : s === "cold" ? 0.4 : 0;
  const walking = (t >= tMove && t < tR3) || (t >= tStep - 0.4 && t < tStep + 0.4);
  const phoneArc = (() => { const k = ramp(t, tFly + 0.3, tLand - tFly - 0.3); return { x: STX - 240 + (PHONE_END.x - STX + 240) * k, y: GY - 120 - Math.sin(Math.PI * k) * 520 + 114 * k, r: k * 900 }; })();
  const strangerX = interpolate(t, [tStr + 1.2, tZero + 0.6], [STX - 80, 680], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const strangerUp = t >= tStr;
  const tapRate = s === "tap" ? interpolate(t, [tThat, tDrip, tDrip + 0.8], [0.34, 0.7, 2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0.34;
  const stream = t >= tFlow ? Math.min(1, (t - tFlow) / 2) : 0;
  const count = s === "r3" && t >= tCount ? Math.min(40, 1 + Math.floor((t - tCount) * 2)) : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070B", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${shake}px, 0)`, filter: recap ? "grayscale(0.85) contrast(1.1) brightness(0.85)" : "saturate(0.55)" }}>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <DbDefs frame={frame} />
          {inLib && (
            <g transform={camT(cam)}>
              <Library frame={frame} shadows={<>
                <Person x={MEX} y={GY} s={S} look={ME} pose={sitPose(frame)} />
                <Person x={ANX} y={GY} s={S * 0.95} look={ANYA} pose={sitPose(frame + 30)} />
              </>}>
                <Vent x={VENT.x} y={VENT.y} open={ramp(t, tFall, 1.0)} frame={frame} />
                <ExitSign x={EXIT.x} y={EXIT.y} glow={s === "plan" ? 0.6 + 0.4 * Math.sin(frame / 5) : 0.3} />
                <TapBucket x={TAP.x} y={TAP.y} frame={frame} t={t} rate={tapRate} stream={stream} />
                {/* я и Аня */}
                {s === "r2"
                  ? <Person x={interpolate(t, [tMove, tR3], [MEX, MEX + 90], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} y={GY + 30} s={S} look={ME} pose={walkPose(Math.floor(((t - tMove) % 0.8) < 0.4 ? frame : frame - (frame % 12)))} />
                  : <Person x={MEX} y={GY} s={S} look={ME} pose={sitPose(frame, { expr: { brow: 0.7, browTilt: 1, mouth: "flat", blink: frame % 120 < 3 ? 1 : 0 } })} />}
                <Person x={ANX} y={GY} s={S * 0.95} look={ANYA} tremble={s === "turn" || s === "tap" || s === "choice" ? 1 : 0.3}
                  pose={sitPose(frame + 30, { expr: s === "turn" || s === "cold" ? { brow: 1, browTilt: 1, mouth: "o", blink: 0 } : { brow: 0.5, browTilt: 1, mouth: "sad", blink: frame % 95 < 3 ? 1 : 0 } })} />
                {/* чужак: спит → идёт через зал бесшумно */}
                {strangerUp
                  ? <Person x={strangerX} y={GY} s={S} look={STRANGER} flip pose={t > tStr + 1.2 && t < tZero + 0.6 ? walkPose(frame) : { ...NEUTRAL, expr: { brow: -0.3, browTilt: 0.2, mouth: "flat", blink: 0 } }} />
                  : <Person x={STX} y={GY - 8} s={S} look={STRANGER} lie pose={{ ...NEUTRAL, expr: { brow: 0, browTilt: 0, mouth: "flat", blink: 1 }, armL: { sh: 20, el: -10, wr: 0 }, armR: { sh: 10, el: -20, wr: 0 } }} />}
                {/* телефон летит и звенит */}
                {t >= tFly && t < tStep + 0.4 && (
                  <g transform={`translate(${t < tLand ? phoneArc.x : PHONE_END.x} ${t < tLand ? phoneArc.y : PHONE_END.y}) rotate(${t < tLand ? phoneArc.r : 82})`}>
                    <rect x={-22} y={-40} width={44} height={80} rx={8} fill="#111" stroke="#2E3440" strokeWidth={3} />
                    <rect x={-18} y={-36} width={36} height={72} rx={6} fill="#E6F0FF" opacity={0.85} />
                  </g>
                )}
                {t >= tLand && t < tStep + 0.4 && <Rings x={PHONE_END.x} y={PHONE_END.y - 30} db={t < tLand + 0.6 ? 60 : 75} age={(t - tLand) % 1.6} scale={1.3} />}
                {t >= tStep + 0.4 && t < tR1 && <g transform={`translate(${PHONE_END.x} ${PHONE_END.y})`}><rect x={-40} y={-8} width={80} height={10} fill="#111" /><path d="M -30 -8 l 20 -6 l 14 6 l 20 -8" stroke="#E6F0FF" strokeWidth={2} fill="none" /></g>}
                {/* тварь */}
                {crVisible && <Creature x={cx} y={cy} s={0.78} frame={frame} step={walking ? (t * 0.7) % 1 : 0} flare={crFlare} turn={crTurn} mouth={s === "cold" ? 0.25 : s === "turn" ? sm(ramp(t, tTurn + 1.2, 0.8)) * 0.6 : 0} />}
                {s === "r2" && ((t - tMove) % 0.8) < 0.5 && <Rings x={cx + 20} y={GY} db={45} age={(t - tMove) % 0.8} scale={0.9} />}
                {/* капли */}
                {(s === "drip" || s === "tap" || s === "choice") && ((t - tTap) % (1 / tapRate)) < 0.6 && stream === 0 && <Rings x={TAP.x + 40} y={TAP.y - 30} db={30} age={(t - tTap) % (1 / tapRate)} scale={0.7} />}
                {(s === "tap" || s === "choice") && stream > 0 && <Rings x={TAP.x + 40} y={TAP.y - 30} db={dbAt(t)} age={(t - tFlow) % 1.6} scale={0.8} />}
                {s === "r1" && ((t - tR1) % 1.6) < 0.8 && <Rings x={MEX + 125} y={GY - 230} db={25} age={(t - tR1) % 1.6} scale={0.35} />}
                {/* книга торчит с полки */}
                {s === "r4" && <g transform={`translate(800 ${560 + 150 * 2 - 100}) rotate(${-8 + Math.sin(frame / 4) * 4})`}><rect x={0} y={0} width={26} height={100} fill="#6A3A2A" stroke="#2A1A12" strokeWidth={3} /></g>}
                {s === "r4" && t >= tBook && <g opacity={ramp(t, tBook, 0.3)}><Rings x={850} y={860} db={65} age={0.35} scale={0.6} /><line x1={770} y1={780} x2={930} y2={940} stroke="#FF3B30" strokeWidth={10} /></g>}
                {/* путь к выходу */}
                {s === "plan" && <path d={`M ${MEX + 60} ${GY - 40} L ${EXIT.x - 140} ${GY - 40}`} stroke="#3DDC84" strokeWidth={10} strokeDasharray="30 22" strokeDashoffset={-frame * 3} opacity={0.8} />}
              </Library>
            </g>
          )}
          {inLib && <Foreground frame={frame} />}
          {s === "recap" && <g><Pocket frame={frame} on={1} time="06:00" ring={1} /><Rings x={540} y={1010} db={75} age={(t - tRecap) % 1.6} /></g>}
          {s === "problem" && <rect x={0} y={0} width={1080} height={1920} fill="#000" />}
          <rect x={0} y={0} width={1080} height={1920} fill="url(#dbVig)" />
        </svg>
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dip }} />

      {/* хук-удар */}
      {s === "cold" && (
        <div style={{ position: "absolute", left: 50, right: 150, top: 430, fontFamily: "Inter Display", fontWeight: 900, lineHeight: 1.0, textShadow: "0 0 24px #000, 0 4px 0 #000",
          transform: `scale(${1 + 0.25 * punch}) rotate(${-2 * punch}deg)`, transformOrigin: "30% 50%" }}>
          <div style={{ fontSize: 66, color: "#FFFFFF" }}>ЕСЛИ ТВАРЬ<br />УЖЕ ВНУТРИ —</div>
          {t >= tStop - 0.1 && <div style={{ fontSize: 96, color: "#FF3B30", marginTop: 14, textShadow: "0 0 30px rgba(255,59,48,.8), 0 4px 0 #000" }}>НЕ ДВИГАЙСЯ,<br />КОГДА ОНА<br />ЗАМИРАЕТ</div>}
        </div>
      )}
      {recap && (<>
        <div style={{ position: "absolute", left: 60, top: 320, padding: "8px 20px", borderRadius: 10, background: "rgba(10,12,18,.85)", border: "4px solid #9AA6BA",
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 34, color: "#FFFFFF", letterSpacing: 4 }}>РАНЕЕ</div>
        <Stamp k={ramp(t, tChose, 0.25)} color="#FF3B30" top={420} size={50}>ВЫ ВЫБРАЛИ:<br />ШВЫРНУТЬ</Stamp>
      </>)}
      {s === "inside" && <Stamp k={ramp(t, tInside, 0.25)} top={420} size={58}>ОНА ВНУТРИ · 30 м</Stamp>}
      {s === "r1" && <Stamp k={ramp(t, tR1, 0.25)} color="#F2C94C" top={420} size={44}>1 · ДЫШИМ НОСОМ: 25 вместо 35</Stamp>}
      {s === "r2" && <Stamp k={ramp(t, tR2, 0.25)} color="#F2C94C" top={420} size={44}>2 · ИДЁМ ТОЛЬКО ПОД ЕЁ ШАГИ</Stamp>}
      {s === "r3" && <Stamp k={ramp(t, tR3, 0.25)} color="#F2C94C" top={420} size={44}>3 · ЗАМИРАЕТ КАЖДЫЕ 40 с</Stamp>}
      {s === "r3" && count > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 150, color: "#E6ECF5", textShadow: "0 0 30px #000" }}>{count}</div>
      )}
      {s === "r4" && <Stamp k={ramp(t, tR4, 0.25)} color="#F2C94C" top={420} size={44}>4 · ПОЛКИ НЕ ТРОГАТЬ</Stamp>}
      {s === "stranger" && t >= tZero && <Stamp k={ramp(t, tZero, 0.25)} top={420} size={60}>0 дБ ?!</Stamp>}
      {s === "plan" && <Stamp k={ramp(t, tPlan + 0.3, 0.25)} color="#3DDC84" top={420} size={50}>ДО ВЫХОДА — 25 м</Stamp>}
      {s === "problem" && <Stamp k={ramp(t, tProblem, 0.3)} size={56} top={800}>БЫЛА ЛИШЬ ОДНА ПРОБЛЕМА</Stamp>}
      {s === "choice" && (
        <div style={{ position: "absolute", left: 100, width: 820, top: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
          background: "rgba(3,4,8,.55)", padding: "20px 0", borderRadius: 24 }}>
          {([["ЗАКРЫТЬ ВЕНТИЛЬ", "но он скрипнет", "#F2C94C", tA], ["ЛАДОНЬ ПОД СТРУЮ", "и держать, пока не уйдёт", "#FF3B30", tB]] as const).map(([txt, sub, c, at], i) => {
            const k = ramp(t, at - 0.3, 0.3);
            return (
              <React.Fragment key={txt}>
                {i === 1 && <div style={{ opacity: k, fontFamily: "Inter Display", fontWeight: 900, fontSize: 42, color: "#C9D2E0" }}>ИЛИ</div>}
                <div style={{ transform: `scale(${0.88 + 0.12 * k})`, opacity: 0.25 + 0.75 * k, width: 780, textAlign: "center", padding: "20px 16px", borderRadius: 22,
                  border: `6px solid ${c}`, background: "rgba(10,12,18,.92)", boxShadow: `0 0 30px ${c}55` }}>
                  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 56, color: "#FFFFFF", lineHeight: 1 }}>{txt}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 28, color: "#9AA6BA", marginTop: 8 }}>{sub}</div>
                </div>
              </React.Fragment>
            );
          })}
          <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, color: "#F2C94C" }}>ЧТО БЫ ТЫ СДЕЛАЛ? ↓</div>
          <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#C9D2E0" }}>СЕРИЯ 3 — С ТВОЕГО ОТВЕТА</div>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "#FFFFFF", opacity: 0.8 * flash, pointerEvents: "none" }} />
      <DbMeter db={db} frame={frame} dist={distAt(t)} time={t < tRecap ? "06:00" : "06:01"} />
      {s !== "cold" && <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />}
      <Grain />
      {withAudio && <Audio src={staticFile("audio/db2_mix.wav")} />}
    </AbsoluteFill>
  );
};
