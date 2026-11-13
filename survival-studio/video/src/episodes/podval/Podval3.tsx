import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/podval3.words.json";
import { Grain } from "../../ui/Grain";
import { Icon, IconName } from "../../ui/Icons";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { ALL_IN, Bubble, Cam, lerpCam, NameTag, PodvalState, PodvalWorld, toScreen, W_CEIL, W_FLOOR } from "../../scenes/Podval";

/*
 * «Подвал на восьмерых». Серия 3 — «Делимся» (решение зрителей). Передача воды через трубу без пыли:
 * мокрая тряпка, закрытые рот и нос, перчатка/пакет, 30 секунд, пломба, мыть руки и лицо.
 * Записка: спасатели идут к тем, кто подаст сигнал. Финал — «сейчас / ждём сутки».
 * Время событий — по словам (n-е вхождение).
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const PODVAL3_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
const idxOf = (w: string, n = 1) => {
  let k = 0;
  for (let i = 0; i < WORDS.length; i++) if (norm(WORDS[i].word) === norm(w) && ++k === n) return i;
  throw new Error(`Слово «${w}» #${n} не найдено`);
};
const W = (w: string, n = 1) => WORDS[idxOf(w, n)].start;
const REPL: [string, number, string][] = [["тридцать", 1, "30"], ["пятьдесят", 1, "50"], ["три", 1, "3,5"], ["сто", 1, "100"], ["четыре", 1, "4"]];
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  for (const [w, n, t] of REPL) out[idxOf(w, n)].word = t;
  // «три с половиной» → «3,5»: убираем «с половиной»
  const i = idxOf("три", 1);
  if (norm(out[i + 1]?.word ?? "") === "с" && norm(out[i + 2]?.word ?? "") === "половиной") { out[i].end = out[i + 2].end; out.splice(i + 1, 2); }
  return out;
})();
const accIdx = (w: string, n = 1) => CW.findIndex((x, k) => norm(x.word) === norm(w) && CW.slice(0, k + 1).filter((y) => norm(y.word) === norm(w)).length === n);
const ACC: [string, number, "yellow" | "red" | "green"][] = [
  ["«делимся».", 1, "yellow"], ["тряпка.", 1, "yellow"], ["пакет.", 1, "yellow"], ["30", 1, "red"], ["лицо.", 1, "yellow"],
  ["«детям».", 1, "yellow"], ["сигнал».", 1, "yellow"], ["безопаснее.", 1, "yellow"], ["«ждём».", 1, "yellow"],
];
const ACCENTS = Object.fromEntries(ACC.map(([w, n, c]) => [accIdx(w, n), c === "green" ? "yellow" : c]).filter(([i]) => (i as number) >= 0)) as Record<number, "yellow" | "red">;

const ramp = (t: number, a: number, len = 0.35) => Math.min(1, Math.max(0, (t - a) / len));

/* ---------- Моменты ---------- */
const tVit = W("витя", 1), tRag = W("мокрая"), tMouth = W("рот"), tR2 = W("правило", 2), tGlove = W("перчатка");
const t30 = W("тридцать"), tOpen = W("открыта."), tBottle = W("бутылка"), tBack = W("заглушку", 2), tFilm = W("плёнка");
const tR3 = W("правило", 3), tWash = W("моет"), tRagBag = W("тряпку"), tWater = W("воды"), tVit2 = W("витя", 2), tZina = W("баба");
const tDet = W("«детям».") , tKnock = W("стука."), tNote = W("бумажка."), tNoteText = W("записка"), tSignal = W("сигнал", 2);
const tTwo = W("две"), tPassed = W("прошло"), tSafer = W("ещё"), tChoice = W("идём"), tWrite = W("пиши:"), tNext = W("серия");

/* ---------- Камера ---------- */
const PIPE_CAM: Cam = { x: 345, y: 880, z: 1.45 };
const CAM: [number, Cam][] = [
  [0, { x: 420, y: 820, z: 0.95 }], [tVit, PIPE_CAM], [tR3 + 2.4, { x: 400, y: 880, z: 1.2 }], [tWater, { x: 700, y: 860, z: 1.1 }],
  [tZina, { x: 560, y: 840, z: 1.25 }], [tKnock, PIPE_CAM], [tSignal, { x: 1655, y: 420, z: 1.3 }],
  [tPassed, { x: 1300, y: 300, z: 0.75 }], [tChoice, { x: 900, y: 600, z: 0.8 }],
];
const MOVE = 1.3;
const camAt = (t: number): Cam => {
  let cur = CAM[0][1];
  for (let i = 1; i < CAM.length; i++) { const [ta, c] = CAM[i]; if (t < ta) break; cur = lerpCam(cur, c, (t - ta) / MOVE); }
  return cur;
};

/* ---------- Руки Вити (локальные углы, лицом влево) ---------- */
type Arm = { sh: number; el: number; wr: number };
const REST: Arm = { sh: 8, el: -14, wr: 0 }, REACH: Arm = { sh: -2, el: -100, wr: 0 }, RAG: Arm = { sh: 8, el: -88, wr: 0 },
  FACE: Arm = { sh: -60, el: -120, wr: 0 }, WASH: Arm = { sh: -30, el: -70, wr: 0 };
const mix = (a: Arm, b: Arm, k: number): Arm => { const e = Math.min(1, Math.max(0, k)); const q = e * e * (3 - 2 * e); return { sh: a.sh + (b.sh - a.sh) * q, el: a.el + (b.el - a.el) * q, wr: a.wr + (b.wr - a.wr) * q }; };
/** Ключевые позы руки во времени: [время, поза]; между ними — плавный переход 0,4 с. */
const tCapBack = tBack, tTape = W("скотч.");
const ARM_KEYS: [number, Arm][] = [
  [0, REST], [tVit, REACH], [W("но"), REST], [tRag, RAG], [tMouth - 0.2, FACE], [tMouth + 0.5, REST],
  [t30, REACH], [tOpen + 0.6, REST], [tBottle - 0.2, REACH], [tBottle + 1.2, REST], [tCapBack - 0.3, REACH], [tTape + 0.8, REST],
  [tWash - 0.2, WASH], [tRagBag - 0.1, RAG], [tRagBag + 0.8, REST], [tNote + 0.4, REACH], [tNoteText, REST],
];
const armAt = (t: number, f: number): Arm => {
  let cur = ARM_KEYS[0][1];
  for (let i = 1; i < ARM_KEYS.length; i++) { const [ta, a] = ARM_KEYS[i]; if (t < ta) break; cur = mix(cur, a, (t - ta) / 0.4); }
  const twisting = (t >= t30 + 0.3 && t < tOpen) || (t >= tCapBack && t < tCapBack + 0.7);
  if (twisting) cur = { ...cur, wr: 28 * Math.sin(f / 2.2), el: cur.el + 6 * Math.sin(f / 2.2) };
  if (t >= tWash && t < tWash + 1.2) cur = { ...cur, sh: cur.sh + 10 * Math.sin(f / 2.5), wr: 20 * Math.sin(f / 2) };
  return cur;
};

const stateAt = (t: number, f: number): PodvalState => ({
  film: 1, tape: 1, bags: 1, oilcloth: 1, buckets: 1, pots: 1, bath: 1, toilet: 1, doorClosed: 1, power: 0, torches: 1,
  neighbor: 1, groundDust: 0.5, radio: 0.4,
  posOverride: { vitya: 380, zina: 600, barsik: 690 },
  vityaFace: -1, vityaArm: armAt(t, f),
  vityaGear: t >= tMouth + 0.1 && t < tWash + 1.2 ? (t >= tGlove ? 2 : 1) : 0,
  pipeGlow: t >= tVit && t < W("но") ? 1 : 0,
  rag: ramp(t, tRag - 0.6, 0.3) * (1 - ramp(t, tRagBag + 0.9, 0.3)), ragInHand: t < tRag + 0.6 ? 0.001 + 0.999 * ramp(t, tRag, 0.6) : 1,
  ragBag: ramp(t, tRagBag, 0.8),
  capOff: t < tCapBack ? ramp(t, t30 + 0.3, tOpen - t30 - 0.3) : 1 - ramp(t, tCapBack + 0.1, 0.6),
  capInHand: (t >= tOpen && t < tOpen + 0.6) || (t >= tCapBack - 0.3 && t < tCapBack + 0.1),
  bottleInHand: t >= tOpen + 0.7 && t < tBottle, bottle: interpolate(t, [tBottle, tBottle + 1.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  pipeSealed: ramp(t, tFilm, 0.4), tape1: ramp(t, tTape, 0.3), tape2: ramp(t, tTape + 0.35, 0.3),
  wash: t >= tWash && t < tWash + 1.2 ? 1 : 0,
  pipeKnock: t >= tKnock - 0.4 && t < tNote ? 1 : 0, note: ramp(t, tNote, 0.5) * (1 - ramp(t, tSignal, 0.3)), noteToHand: ramp(t, tNote + 0.6, 0.5),
  sheet: ramp(t, W("простыня"), 0.8),
  zinaJar: t >= tZina && t < tKnock,
});
const water = (t: number) => (t < tBottle + 1.2 ? 60 : 50);

const Card: React.FC<{ k: number; y: number; children: React.ReactNode; color?: string }> = ({ k, y, children, color = "#5AA9FF" }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: y, opacity: k, transform: `scale(${0.92 + 0.08 * k})`, padding: "22px 30px", borderRadius: 24,
    background: "rgba(14,17,24,0.92)", border: `4px solid ${color}`, boxShadow: `0 0 30px ${color}55`, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>{children}</div>
);
const Big: React.FC<{ c?: string; s?: number; children: React.ReactNode }> = ({ c = "#FFFFFF", s = 56, children }) => (
  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: s, lineHeight: 1.05, color: c, textAlign: "center" }}>{children}</div>
);
const Stamp: React.FC<{ k: number; text: string; color: string; y: number; rot?: number; size?: number }> = ({ k, text, color, y, rot = -5, size = 54 }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: k }}>
    <div style={{ transform: `rotate(${rot}deg) scale(${1.5 - 0.5 * k})`, border: `8px solid ${color}`, borderRadius: 16, padding: "6px 26px", background: "rgba(14,17,24,0.65)",
      fontFamily: "Inter Display", fontWeight: 900, fontSize: size, lineHeight: 1, color, textShadow: `0 0 20px ${color}88`, whiteSpace: "nowrap" }}>{text}</div>
  </div>
);
const Pill: React.FC<{ icon: IconName; text: string; color: string; hi?: number }> = ({ icon, text, color, hi = 0 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderRadius: 14, background: "rgba(14,17,24,0.86)", border: `3px solid ${color}`,
    transform: `scale(${1 + 0.12 * hi})`, boxShadow: hi > 0 ? `0 0 24px ${color}` : "none" }}>
    <Icon name={icon} color={color} size={38} />
    <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, lineHeight: 1, color: "#FFFFFF" }}>{text}</div>
  </div>
);

export const Podval3: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cam = camAt(t);
  const st = stateAt(t, frame);
  const scr = (x: number, y: number) => toScreen(cam, x, y);
  const win = (a: number, b: number, len = 0.3) => Math.min(ramp(t, a, len), 1 - ramp(t, b - len, len));
  const sec30 = Math.max(0, Math.round(interpolate(t, [t30, tFilm + 0.6], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const hours = t < tPassed ? "ДЕНЬ 2" : "36 Ч";
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      <PodvalWorld frame={frame} cam={cam} st={st} entries={ALL_IN} />
      {/* титул */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        opacity: interpolate(t, [0, 0.15, 2.6, 3.1], [1, 1, 1, 0], { extrapolateRight: "clamp" }) }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 36, letterSpacing: 10, color: "#9FE8BE" }}>СЕРИЯ 3 · ВЫ РЕШИЛИ</div>
        <Big s={130} c={SRYV.progress}>«ДЕЛИМСЯ»</Big>
      </div>
      {/* правила и действия */}
      <Stamp k={win(tRag, tR2, 0.2)} text="МОКРАЯ ТРЯПКА ПОД ТРУБУ" color={SRYV.lamp} y={330} size={46} />
      {(() => { const p = scr(400, W_FLOOR - 470); return <NameTag x={p.x} y={p.y} text="РОТ И НОС ЗАКРЫТЫ" k={win(tMouth, W("пыль"))} color={SRYV.progress} />; })()}
      {(() => { const p = scr(300, 960); return <NameTag x={p.x} y={p.y} text="ПЫЛЬ ЛИПНЕТ К МОКРОМУ" k={win(W("пыль"), tR2)} color={SRYV.lamp} />; })()}
      <Stamp k={win(tGlove, t30, 0.2)} text="ПЕРЧАТКА ИЛИ ПАКЕТ" color={SRYV.lamp} y={330} size={50} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center", opacity: win(t30, tR3, 0.2) }}>
        <div style={{ padding: "14px 40px", borderRadius: 20, background: "rgba(14,17,24,0.9)", border: `6px solid ${SRYV.fail}`, boxShadow: `0 0 30px ${SRYV.fail}88`,
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 110, lineHeight: 1, color: "#FFFFFF" }}>00:{String(sec30).padStart(2, "0")}</div>
      </div>
      <Stamp k={win(tR3 + 0.5, tWater, 0.2)} text="РУКИ И ЛИЦО — ВЫМЫТЬ" color={SRYV.progress} y={330} size={50} />
      <Card k={win(tVit2, tZina)} y={300} color={SRYV.lamp}>
        <Big s={42} c="#C9D2E0">ВИТЯ ПЕРЕСЧИТЫВАЕТ</Big><Big s={60}>50 л ÷ (7 × 2 л) = <span style={{ color: SRYV.lamp }}>3,5 дня</span></Big>
      </Card>
      {(() => { const p = scr(600, W_FLOOR - 420); return <Bubble x={p.x} y={p.y} text="Детям." k={win(tDet - 0.3, tKnock)} />; })()}
      {/* записка */}
      <div style={{ position: "absolute", left: 120, right: 120, top: 280, opacity: win(tNoteText, tSignal), transform: `rotate(-2deg) scale(${0.92 + 0.08 * ramp(t, tNoteText, 0.4)})`,
        padding: "34px 40px", background: "#F2EBDA", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,.6)", fontFamily: "Caveat", fontWeight: 700, fontSize: 64, lineHeight: 1.1, color: "#2A2620" }}>
        Спасибо.<br />У нас рация.<br />Спасатели идут по району.<br /><span style={{ color: "#B23A48" }}>Первыми — к тем, кто подаст сигнал.</span>
      </div>
      {(() => { const p = scr(1655, 300); return <NameTag x={p.x} y={p.y} text="БЕЛАЯ ПРОСТЫНЯ = СИГНАЛ" k={win(W("простыня"), tTwo)} />; })()}
      <Stamp k={win(tTwo, tPassed, 0.2)} text="2 МИНУТЫ НАВЕРХУ" color={SRYV.fail} y={330} size={54} />
      <Card k={win(tPassed, tChoice)} y={300}>
        <Big s={42} c="#C9D2E0">РАДИАЦИЯ СНАРУЖИ</Big>
        <Big s={56}>1,5 дня → <span style={{ color: SRYV.lamp }}>почти в 100 раз</span> меньше</Big>
        <div style={{ opacity: ramp(t, tSafer, 0.3) }}><Big s={56}>+ сутки → <span style={{ color: SRYV.progress }}>ещё безопаснее</span></Big></div>
      </Card>
      {/* HUD */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        opacity: ramp(t, 3.1, 0.3) * (1 - ramp(t, tChoice + 0.2, 0.4)) * (1 - win(t30, tR3, 0.2)) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 30px", borderRadius: 16, background: "rgba(14,17,24,0.9)", border: `4px solid ${SRYV.progress}` }}>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#9FE8BE", letterSpacing: 4 }}>В ПОДВАЛЕ</div>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 60, lineHeight: 1, color: "#FFFFFF" }}>{hours}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <Pill icon="house" text="7" color="#C9D2E0" />
          <Pill icon="bottle" text={`${water(t)} л`} color={water(t) < 60 ? SRYV.lamp : "#5AA9FF"} hi={win(tWater, tZina)} />
          <Pill icon="alarm" text="2 дн" color={SRYV.lamp} />
        </div>
      </div>
      {/* выбор */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(7,9,13,0.6)", opacity: ramp(t, tChoice, 0.5) }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, opacity: ramp(t, tChoice, 0.4) }}>
        <Big s={60}>ВЕШАТЬ СИГНАЛ</Big>
        <div style={{ display: "flex", gap: 30 }}>
          {([["СЕЙЧАС", SRYV.fail], ["ЖДЁМ СУТКИ", SRYV.progress]] as const).map(([txt, c], i) => {
            const k = ramp(t, tWrite + i * 0.6, 0.3);
            return <div key={txt} style={{ transform: `scale(${0.85 + 0.15 * k})`, opacity: 0.4 + 0.6 * k, padding: "26px 34px", borderRadius: 22,
              border: `6px solid ${c}`, background: `${c}22`, boxShadow: `0 0 30px ${c}66`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 54, color: "#FFFFFF" }}>{txt}</div>;
          })}
        </div>
        <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, color: "#E8C547", letterSpacing: 2 }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
        <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 4 — С ВАШЕГО ОТВЕТА</div>
      </div>
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/podval3_mix.wav")} />}
    </AbsoluteFill>
  );
};
export { W_CEIL };
