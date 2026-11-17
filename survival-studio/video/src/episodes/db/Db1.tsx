import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/db1.words.json";
import { Grain } from "../../ui/Grain";
import { useFonts } from "../../useFonts";
import { NEUTRAL } from "../../rig/Hero";
import { ANYA, Creature, DbMeter, Faucet, Fortress, Library, ME, Person, Pocket, Rings, sitPose, STRANGER, walkPose } from "../../scenes/Db";
import { idxIn, merge, ramp, sm, Stamp, wordAt } from "../svet/shared";

/*
 * «40 дБ». Серия 1 «Будильник». Формула LESSONS А6, под TikTok (А7). Фишка — звук видно: кольца с децибелами, шумомер.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const DB1_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const W = wordAt(WORDS);
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  merge(out, "пять", 3, "05:59.");
  merge(out, "шесть", 3, "06:00.");
  merge(out, "семьдесят", 2, "75", 2);
  return out;
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["дыхание.", 1, "red"], ["децибел.", 1, "red"], ["сорока.", 1, "yellow"], ["ошибку.", 1, "red"], ["уха.", 1, "yellow"],
  ["бутылок.", 1, "yellow"], ["жесты.", 1, "yellow"], ["проблема.", 1, "red"], ["будильник.", 1, "red"], ["слышит.", 1, "red"], ["голову.", 1, "red"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [idxIn(CW, w, n), c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

/* ---------- Ключевые моменты ---------- */
const tInhale = W("вдох."), tThey = W("они", 2), tSafe = W("сами"), tMistake = W("ошибку."), tMe = W("я"), tAnya = W("аня"), tMan = W("мужчина,"),
  tEars = W("перевязаны"), tPhone = W("он"), tSleep = W("засыпает."), tR1 = W("правило"), tWalk = W("ходим"), tR2 = W("второе."), tPipe = W("труба"),
  tDrink = W("пьём"), tR3 = W("третье."), tCough = W("кашель"), tPillow = W("подушку:"), tR4 = W("четвёртое."), tPaper = W("бумаге"), tFort = W("крепость."),
  tProblem = W("была"), t559 = W("пять"), tGlow = W("у", 2), tAlarm = W("шесть"), tWake = W("все"), tExcept = W("кроме"), tWall = W("стеной"),
  tTurn = W("поворачивает"), tChoice = W("что", 2), tA = W("накрыл"), tB = W("или"), tWrite = W("пиши."), tNext = W("следующая");

type Scene = "hook" | "ear" | "lib" | "chars" | "rule1" | "rule2" | "rule3" | "rule4" | "fort" | "problem" | "pocket" | "alarm" | "wall" | "choice";
const SCENES: [number, Scene][] = [
  [0, "hook"], [tThey - 0.1, "ear"], [tSafe - 0.1, "lib"], [W("нас") - 0.1, "chars"], [tR1 - 0.1, "rule1"], [tR2 - 0.1, "rule2"], [tR3 - 0.1, "rule3"],
  [tR4 - 0.1, "rule4"], [tPaper - 0.3, "fort"], [tProblem - 0.1, "problem"], [t559 - 0.1, "pocket"], [tAlarm - 0.1, "alarm"], [W("а", 2) - 0.1, "wall"],
  [tChoice - 0.1, "choice"],
];
const sceneAt = (t: number) => { let cur: Scene = "hook", start = 0; for (const [a, s] of SCENES) if (t >= a) { cur = s; start = a; } return { s: cur, f: t - start }; };

type Cam = { x: number; y: number; z: number };
const lerpCam = (a: Cam, b: Cam, k: number): Cam => { const q = sm(Math.min(1, Math.max(0, k))); return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q, z: a.z + (b.z - a.z) * q }; };
const camT = (c: Cam) => `translate(540 900) scale(${c.z}) translate(${-c.x} ${-c.y})`;

/* Позиции в библиотеке */
const MEX = 250, ANX = 400, STX = 1000, GY = 1450, S = 1.5;
const POCKET = { x: STX - 120 * S, y: GY - 20 };
const WIDE: Cam = { x: 620, y: 1080, z: 0.92 };

/* Уровень шума */
const dbAt = (t: number) => {
  let v = 16 + 2 * Math.sin(t * 3);
  if (t >= tInhale && t < tInhale + 0.8) v = 50;
  if (t >= tWalk && t < tR2) v = 20 + 2 * Math.abs(Math.sin(t * 5));
  if (t >= tPipe && t < tPipe + 1.8) v = 60;
  if (t >= tCough && t < tCough + 0.8) v = 70;
  if (t >= tPillow && t < tPillow + 0.8) v = 40;
  if (t >= tAlarm + 0.2) v = 75;
  return v;
};
const distAt = (t: number) => interpolate(t, [0, tAlarm, tWall, VOICE_END + TAIL], [30, 30, 14, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const timeAt = (t: number) => (t < t559 ? "05:41" : t < tAlarm ? "05:59" : "06:00");

export const Db1: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { s, f } = sceneAt(t);
  const db = dbAt(t);
  const dip = Math.max(0, 1 - f / 0.15) * (s === "hook" ? 0 : 0.85);
  const shake = db >= 70 ? Math.sin(frame * 3.1) * 4 : 0;
  const breathHold = t < tInhale ? 1 : 0;

  /* ---- камера в библиотеке ---- */
  const libCam = (): Cam => {
    if (s === "hook") return lerpCam({ x: MEX + 60, y: 1150, z: 2.6 }, { x: MEX + 60, y: 1150, z: 3.0 }, t / tThey);
    if (s === "lib") return lerpCam({ x: 540, y: 1000, z: 0.8 }, WIDE, f / 3);
    if (s === "chars") {
      if (t < tAnya - 0.1) return lerpCam(WIDE, { x: MEX + 40, y: 1200, z: 2.0 }, (t - tMe + 0.3) / 0.8);
      if (t < tMan - 0.1) return lerpCam({ x: MEX + 40, y: 1200, z: 2.0 }, { x: ANX + 30, y: 1250, z: 2.2 }, (t - tAnya + 0.2) / 0.8);
      if (t < tEars - 0.1) return lerpCam({ x: ANX + 30, y: 1250, z: 2.2 }, { x: STX - 80, y: 1150, z: 1.6 }, (t - tMan + 0.2) / 0.9);
      if (t < tPhone - 0.1) return lerpCam({ x: STX - 80, y: 1150, z: 1.6 }, { x: STX + 10, y: 1110, z: 3.4 }, (t - tEars + 0.1) / 0.9);
      return lerpCam({ x: STX + 10, y: 1110, z: 3.4 }, { x: STX - 120, y: 1250, z: 1.5 }, (t - tPhone) / 1.0);
    }
    if (s === "rule1") { const wx = interpolate(t, [tWalk, tR2], [150, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); return { x: wx, y: 1250, z: 1.4 }; }
    if (s === "rule3") return { x: ANX + 30, y: 1220, z: 2.8 };
    if (s === "rule4") return { x: (MEX + ANX) / 2 + 20, y: 1200, z: 2.0 };
    if (s === "alarm") {
      if (t < tExcept - 0.1) return lerpCam({ x: POCKET.x, y: 1300, z: 1.8 }, WIDE, (t - tAlarm) / 1.2);
      return lerpCam(WIDE, { x: STX - 330, y: 1400, z: 3.2 }, (t - tExcept + 0.2) / 0.9);
    }
    return WIDE;
  };
  const cam = libCam();
  const inLib = ["hook", "lib", "chars", "rule1", "rule3", "rule4", "alarm"].includes(s);
  const strangerLie = t >= tSleep || s === "alarm" || s === "rule1" || s === "rule3" || s === "rule4";
  const woke = s === "alarm" && t >= tWake;
  const mouthHead = { x: MEX + 70, y: GY - 205 * S };

  return (
    <AbsoluteFill style={{ backgroundColor: "#05070B", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${shake}px, 0)`, filter: "saturate(0.55)" }}>
        <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          {inLib && (
            <g transform={camT(cam)}>
              <Library frame={frame} candle={s === "alarm" ? 0.7 : 1}>
                {/* я */}
                {s !== "rule1" && <Person x={MEX} y={GY} s={S} look={ME} pose={sitPose(frame, {
                  expr: breathHold ? { brow: 0.6, browTilt: 1, mouth: "flat", blink: 0 } : woke ? { brow: 1, browTilt: 1, mouth: "o", blink: 0 } : { brow: 0.3, browTilt: 0.8, mouth: t >= tInhale && t < tInhale + 0.8 ? "o" : "flat", blink: frame % 110 < 3 ? 1 : 0 },
                  ...(s === "rule4" ? { armL: { sh: -120 + 30 * Math.sin(frame / 6), el: -60, wr: 0 }, armR: { sh: -100 + 30 * Math.cos(frame / 5), el: -90, wr: 0 } } : {}),
                  ...(woke ? { torso: 4, head: -6 } : {}) })} />}
                {s === "rule1" && <Person x={interpolate(t, [tWalk, tR2], [150, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} y={GY + 40} s={S} look={ME} pose={walkPose(frame)} />}
                {/* Аня */}
                <Person x={ANX} y={GY} s={S * 0.72} look={ANYA} pose={sitPose(frame + 30, {
                  expr: woke ? { brow: 1, browTilt: 1, mouth: "o", blink: 0 } : s === "rule3" && t >= tCough && t < tPillow + 1 ? { brow: -0.3, browTilt: 1, mouth: "open", blink: 1 } : { brow: 0.4, browTilt: 1, mouth: "sad", blink: frame % 95 < 3 ? 1 : 0 },
                  ...(s === "rule3" && t >= tPillow - 0.3 ? { armL: { sh: -130, el: -80, wr: 0 }, armR: { sh: -125, el: -85, wr: 0 } } : {}),
                  ...(s === "rule4" ? { armL: { sh: -140 + 25 * Math.sin(frame / 5 + 1), el: -50, wr: 0 }, armR: { sh: -110 + 25 * Math.cos(frame / 4), el: -80, wr: 0 } } : {}) })} />
                {s === "rule3" && t >= tPillow - 0.3 && <rect x={ANX + 20} y={GY - 300 * S * 0.72} width={110} height={80} rx={30} fill="#C9C2B0" stroke="#6E6A60" strokeWidth={5} />}
                {/* чужак */}
                {strangerLie
                  ? <Person x={STX} y={GY - 8} s={S} look={STRANGER} lie pose={{ ...NEUTRAL, expr: { brow: 0, browTilt: 0, mouth: "flat", blink: 1 }, armL: { sh: 20, el: -10, wr: 0 }, armR: { sh: 10, el: -20, wr: 0 } }} />
                  : <Person x={STX - 80} y={GY} s={S} look={STRANGER} flip pose={sitPose(frame + 60, { armR: { sh: -60, el: -80, wr: 0 }, holdL: "phone", phoneGlow: 0.5,
                      expr: { brow: -0.2, browTilt: 0.3, mouth: "flat", blink: frame % 80 < 3 ? 1 : 0 } })} />}
                {/* звук */}
                {s === "hook" && <Rings x={mouthHead.x} y={mouthHead.y} db={50} age={t - tInhale} scale={0.6} />}
                {s === "rule1" && [0, 1, 2, 3, 4, 5, 6].map((i) => {
                  const ts = tWalk + 0.3 + i * 0.6;
                  const x = interpolate(ts, [tWalk, tR2], [150, 900], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
                  return t >= ts && t < ts + 1.2 ? <Rings key={i} x={x} y={GY + 40} db={20} age={t - ts} scale={0.5} /> : null;
                })}
                {s === "rule3" && t >= tCough && t < tPillow && <Rings x={ANX + 50} y={GY - 260 * S * 0.72} db={70} age={t - tCough} scale={0.6} />}
                {s === "rule3" && t >= tPillow && <Rings x={ANX + 70} y={GY - 270 * S * 0.72} db={39.9} age={t - tPillow} scale={0.6} />}
                {s === "alarm" && <Rings x={POCKET.x} y={POCKET.y} db={75} age={(t - tAlarm) % 1.6} />}
              </Library>
            </g>
          )}
          {/* ухом твари: темнота, видно только звук */}
          {s === "ear" && (<>
            <rect x={0} y={0} width={1080} height={1920} fill="#010102" />
            <Creature x={560} y={1900} s={1.9} frame={frame} turn={-0.4} flare={sm(ramp(t, tThey, 0.6))} />
            <Rings x={120} y={700} db={50} age={(t - tThey) % 1.6} />
            <Rings x={900} y={500} db={30} age={((t - tThey) * 0.8) % 1.6} label={false} />
          </>)}
          {s === "rule2" && <Faucet frame={frame} t={t} hum={t >= tPipe && t < tPipe + 1.8 ? 1 : 0} drink={sm(ramp(t, tDrink, 0.8))} />}
          {s === "fort" && <g transform={`translate(540 960) scale(${0.95 + 0.04 * f}) translate(-540 -960)`}><Fortress frame={frame} t={t} /></g>}
          {s === "problem" && <rect x={0} y={0} width={1080} height={1920} fill="#000" />}
          {s === "pocket" && <g transform={`translate(540 960) scale(${1 + 0.03 * f}) translate(-540 -960)`}><Pocket frame={frame} on={sm(ramp(t, tGlow, 0.5))} time={timeAt(t)} ring={0} /></g>}
          {(s === "wall" || s === "choice") && (<>
            <rect x={0} y={0} width={1080} height={1920} fill="#06080C" />
            <rect x={0} y={1500} width={1080} height={420} fill="#0C0F14" />
            <rect x={0} y={300} width={260} height={1300} fill="#1E232C" stroke="#2E3440" strokeWidth={8} />
            <Rings x={130} y={1100} db={75} age={(t - tAlarm) % 1.6} />
            <Creature x={720} y={1600} s={1.45} frame={frame} turn={-sm(ramp(t, tTurn - 0.3, 1.6))} flare={sm(ramp(t, tWall, 1.2))} />
          </>)}
        </svg>
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, background: "#000", opacity: dip }} />

      {/* TikTok: хук текстом с первого кадра */}
      {s === "hook" && t < tInhale - 0.2 && (
        <div style={{ position: "absolute", left: 60, right: 150, top: 420, fontFamily: "Inter Display", fontWeight: 900, lineHeight: 1.02, textShadow: "0 0 24px #000" }}>
          <div style={{ fontSize: 50, color: "#C9D2E0" }}>ЕСЛИ ОНИ ОХОТЯТСЯ НА ЗВУК —</div>
          <div style={{ fontSize: 92, color: "#FF3B30", marginTop: 10 }}>НЕ ЗАДЕРЖИВАЙ ДЫХАНИЕ</div>
        </div>
      )}
      {s === "ear" && <Stamp k={ramp(t, W("громче") - 0.2, 0.25)} top={420} size={52}>СЛЫШАТ ВСЁ, ЧТО ГРОМЧЕ 40</Stamp>}
      {s === "lib" && <Stamp k={ramp(t, tMistake - 0.2, 0.25)} top={420} size={52}>…ЕСЛИ НЕ ОДНА ОШИБКА</Stamp>}
      {s === "rule1" && <Stamp k={ramp(t, tR1, 0.25)} color="#F2C94C" top={420} size={44}>1 · БОСИКОМ ПО КОВРУ −20 дБ</Stamp>}
      {s === "rule2" && <Stamp k={ramp(t, tR2, 0.25)} color="#F2C94C" top={420} size={44}>2 · КРАН НЕ ОТКРЫВАТЬ</Stamp>}
      {s === "rule3" && <Stamp k={ramp(t, tR3, 0.25)} color="#F2C94C" top={420} size={44}>3 · КАШЕЛЬ — В ПОДУШКУ −30</Stamp>}
      {s === "rule4" && <Stamp k={ramp(t, tR4, 0.25)} color="#F2C94C" top={420} size={44}>4 · НИ СЛОВА. ЖЕСТЫ</Stamp>}
      {s === "fort" && <Stamp k={ramp(t, tFort - 0.2, 0.25)} color="#9AA6BA" top={420} size={64}>КРЕПОСТЬ</Stamp>}
      {s === "problem" && <Stamp k={ramp(t, tProblem, 0.3)} size={56} top={800}>БЫЛА ЛИШЬ ОДНА ПРОБЛЕМА</Stamp>}
      {s === "alarm" && t >= tExcept && <Stamp k={ramp(t, tExcept, 0.25)} top={420} size={56}>ОН НЕ СЛЫШИТ</Stamp>}
      {s === "choice" && (
        <div style={{ position: "absolute", left: 100, width: 820, top: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
          background: "rgba(3,4,8,.55)", padding: "20px 0", borderRadius: 24 }}>
          {([["НАКРЫТЬ ПОДУШКАМИ", "−30 дБ… хватит ли?", "#F2C94C", tA], ["ШВЫРНУТЬ В ДАЛЬНИЙ КОНЕЦ", "увести их на звук", "#FF3B30", tB]] as const).map(([txt, sub, c, at], i) => {
            const k = ramp(t, at - 0.3, 0.3);
            return (
              <React.Fragment key={txt}>
                {i === 1 && <div style={{ opacity: k, fontFamily: "Inter Display", fontWeight: 900, fontSize: 42, color: "#C9D2E0" }}>ИЛИ</div>}
                <div style={{ transform: `scale(${0.88 + 0.12 * k})`, opacity: 0.25 + 0.75 * k, width: 780, textAlign: "center", padding: "20px 16px", borderRadius: 22,
                  border: `6px solid ${c}`, background: "rgba(10,12,18,.92)", boxShadow: `0 0 30px ${c}55` }}>
                  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 52, color: "#FFFFFF", lineHeight: 1 }}>{txt}</div>
                  <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 28, color: "#9AA6BA", marginTop: 8 }}>{sub}</div>
                </div>
              </React.Fragment>
            );
          })}
          <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, color: "#F2C94C" }}>ЧТО БЫ ТЫ СДЕЛАЛ? ↓</div>
          <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#C9D2E0" }}>СЕРИЯ 2 — С ТВОЕГО ОТВЕТА</div>
        </div>
      )}
      <DbMeter db={db} frame={frame} dist={distAt(t)} time={timeAt(t)} />
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/db1_mix.wav")} />}
    </AbsoluteFill>
  );
};
