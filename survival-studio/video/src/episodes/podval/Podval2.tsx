import React from "react";
import { AbsoluteFill, Audio, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { Karaoke, Word } from "../../captions/Karaoke";
import data from "../../captions/podval2.words.json";
import { Grain } from "../../ui/Grain";
import { Icon, IconName } from "../../ui/Icons";
import { useFonts } from "../../useFonts";
import { SRYV } from "../../style/palette";
import { ALL_IN, Bubble, Cam, lerpCam, NameTag, PodvalState, PodvalWorld, toScreen, W_CEIL, W_FLOOR, W_GROUND } from "../../scenes/Podval";

/*
 * «Подвал на восьмерых». Серия 2 — «Закрыто» (решение зрителей). Удар, свет гаснет, правила первых часов,
 * ночью за стеной — соседка с детьми без воды. Финал — выбор «делимся / нет».
 * Время событий — по словам (n-е вхождение), чтобы смена голоса не ломала монтаж.
 */
export const FPS = 30;
const WORDS = (data as { words: Word[] }).words;
const VOICE_END = WORDS[WORDS.length - 1].end, TAIL = 1.6;
export const PODVAL2_FRAMES = Math.round((VOICE_END + TAIL) * FPS);
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9-]/g, "");
/** Начало n-го вхождения слова (n с 1). */
const W = (w: string, n = 1) => {
  let k = 0;
  for (const x of WORDS) if (norm(x.word) === norm(w) && ++k === n) return x.start;
  throw new Error(`Слово «${w}» #${n} не найдено`);
};
const idxOf = (w: string, n = 1) => {
  let k = 0;
  for (let i = 0; i < WORDS.length; i++) if (norm(WORDS[i].word) === norm(w) && ++k === n) return i;
  throw new Error(`Слово «${w}» #${n} не найдено`);
};
const REPL: [string, number, string][] = [["три", 1, "3"], ["шестьдесят", 1, "60"], ["два", 1, "2"], ["четыре", 1, "4"], ["семь", 1, "7"], ["десять", 1, "10"], ["сто.", 1, "100."]];
const CW = (() => {
  const out = WORDS.map((w) => ({ ...w }));
  for (const [w, n, t] of REPL) { try { out[idxOf(w, n)].word = t; } catch { /* слово может отличаться в черновом голосе */ } }
  return out;
})();
const ACC: [string, number, "yellow" | "red"][] = [
  ["«закрыто».", 1, "red"], ["молчит.", 1, "yellow"], ["ноль.", 1, "red"], ["сутки.", 1, "yellow"], ["пыль.", 1, "red"],
  ["очереди.", 1, "yellow"], ["тряпкой.", 1, "yellow"], ["жив.", 1, "yellow"], ["воды.", 1, "red"], ["пыль.", 2, "red"], ["«нет».", 2, "red"],
];
const ACCENTS = Object.fromEntries(ACC.flatMap(([w, n, c]) => { try { return [[idxOf(w, n), c]]; } catch { return []; } })) as Record<number, "yellow" | "red">;

const ramp = (t: number, a: number, len = 0.35) => Math.min(1, Math.max(0, (t - a) / len));
const safe = (f: () => number, d: number) => { try { return f(); } catch { return d; } };

/* ---------- Ключевые моменты ---------- */
const tThree = safe(() => W("три"), 3), tZero = W("ноль."), tLamp = safe(() => W("лампа"), tZero + 1), tTorch = W("включаем");
const tR1 = W("правило", 1), tOut = W("снаружи"), tR2 = W("правило", 2), tR3 = W("правило", 3), tVit = W("витя");
const tR4 = W("правило", 4), tVoice = W("оставайтесь"), tSeven = safe(() => W("семь"), tVoice + 3), tTwo = safe(() => W("двое"), tSeven + 2);
const tNight = W("ночь."), tWall = W("стены"), tSveta = W("тётя", 2), tNoWater = safe(() => W("воды.", 1), tSveta + 1.5);
const tPipe = W("между"), tOpen = W("откроешь"), tChoice = W("делимся", 1), tWrite = W("пиши:"), tNext = W("серия");

/* ---------- Камера ---------- */
const WIDE: Cam = { x: 1000, y: 760, z: 0.72 };
const CAM: [number, Cam][] = [
  [0, { x: 1620, y: 860, z: 1.15 }], [W("близнецы"), { x: 1450, y: 860, z: 1.1 }], [W("зина"), { x: 450, y: 860, z: 1.1 }],
  [tZero, WIDE], [tR1, { x: 800, y: 600, z: 0.8 }], [tR2, { x: 1150, y: 860, z: 1.1 }], [tR3, { x: 800, y: 880, z: 1.15 }],
  [tR4, { x: 1010, y: 880, z: 1.3 }], [tSeven, { x: 900, y: 800, z: 0.95 }], [tNight, { x: 60, y: 820, z: 0.95 }],
  [tPipe, { x: 120, y: 760, z: 1.15 }], [tChoice, { x: 40, y: 820, z: 0.9 }],
];
const MOVE = 1.3;
const camAt = (t: number): Cam => {
  let cur = CAM[0][1];
  for (let i = 1; i < CAM.length; i++) { const [ta, c] = CAM[i]; if (t < ta) break; cur = lerpCam(cur, c, (t - ta) / MOVE); }
  // тряска от удара
  if (t >= tZero && t < tZero + 1.6) {
    const k = 1 - (t - tZero) / 1.6, f = Math.round(t * FPS);
    cur = { ...cur, x: cur.x + (random(`sx${f}`) - 0.5) * 40 * k, y: cur.y + (random(`sy${f}`) - 0.5) * 30 * k };
  }
  return cur;
};

const stateAt = (t: number): PodvalState => ({
  siren: 0, film: 1, tape: 1, bags: 1, oilcloth: 1, buckets: 1, pots: 1, bath: 1, toilet: 1, doorClosed: 1,
  power: t < tLamp ? 1 : 0, plaster: t >= tZero && t < tZero + 3 ? 1 - (t - tZero) / 3 : 0,
  torches: ramp(t, tTorch, 0.2), groundDust: ramp(t, tOut - 0.3, 1.2),
  radio: ramp(t, tVoice - 1.2, 0.4), neighbor: ramp(t, tWall, 0.8), pipeGlow: t >= tPipe && t < tChoice ? 1 : 0,
  vityaPhone: t >= tVit && t < tR4,
});
/* Время в подвале после удара: часы, ночь. */
const shelterLabel = (t: number) => {
  if (t < tZero) {
    const s = Math.max(0, Math.round(interpolate(t, [tThree, tZero], [180, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
    return { label: "ДО УДАРА", value: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`, red: true };
  }
  if (t >= tNight) return { label: "В ПОДВАЛЕ", value: "НОЧЬ 1", red: false };
  const h = Math.max(1, Math.round(interpolate(t, [tZero, tSeven, tNight], [1, 7, 12], { extrapolateRight: "clamp" })));
  return { label: "В ПОДВАЛЕ", value: `${h} Ч`, red: false };
};

const Card: React.FC<{ k: number; y: number; children: React.ReactNode; color?: string }> = ({ k, y, children, color = "#5AA9FF" }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top: y, opacity: k, transform: `scale(${0.92 + 0.08 * k})`, padding: "22px 30px", borderRadius: 24,
    background: "rgba(14,17,24,0.92)", border: `4px solid ${color}`, boxShadow: `0 0 30px ${color}55`, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>{children}</div>
);
const Big: React.FC<{ c?: string; s?: number; children: React.ReactNode }> = ({ c = "#FFFFFF", s = 56, children }) => (
  <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: s, lineHeight: 1.05, color: c, textAlign: "center" }}>{children}</div>
);
const Stamp: React.FC<{ k: number; text: string; color: string; y: number; rot?: number; size?: number }> = ({ k, text, color, y, rot = -6, size = 60 }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", opacity: k }}>
    <div style={{ transform: `rotate(${rot}deg) scale(${1.5 - 0.5 * k})`, border: `8px solid ${color}`, borderRadius: 16, padding: "6px 28px", background: "rgba(14,17,24,0.65)",
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

export const Podval2: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  useFonts();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const cam = camAt(t);
  const st = stateAt(t);
  const scr = (x: number, y: number) => toScreen(cam, x, y);
  const win = (a: number, b: number, len = 0.3) => Math.min(ramp(t, a, len), 1 - ramp(t, b - len, len));
  const lab = shelterLabel(t);
  const flash = t >= tZero && t < tZero + 0.5 ? 1 - (t - tZero) / 0.5 : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#07090D" }}>
      <PodvalWorld frame={frame} cam={cam} st={st} entries={ALL_IN} />
      {flash > 0 && <div style={{ position: "absolute", inset: 0, background: "#FFF3D6", opacity: 0.55 * flash }} />}
      {/* титул */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        opacity: interpolate(t, [0, 0.15, 2.4, 2.9], [1, 1, 1, 0], { extrapolateRight: "clamp" }) }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 36, letterSpacing: 10, color: "#FF8A80" }}>СЕРИЯ 2 · ВЫ РЕШИЛИ</div>
        <Big s={130} c={SRYV.fail}>«ЗАКРЫТО»</Big>
      </div>
      {/* реплики */}
      {(() => { const p = scr(1500, W_FLOOR - 330); return <Bubble x={p.x} y={p.y} text="А где тётя Света?" k={win(W("близнецы"), W("зина"))} side={-1} />; })()}
      {(() => { const p = scr(1020, W_FLOOR - 200); return <Bubble x={p.x} y={p.y} text="«Оставайтесь в укрытиях»" k={win(tVoice, tSeven)} />; })()}
      {(() => { const p = scr(60, W_FLOOR - 420); return <Bubble x={p.x} y={p.y} text="Мам, пить хочется…" k={win(tWall + 0.4, tSveta)} side={-1} />; })()}
      {(() => { const p = scr(-260, W_FLOOR - 470); return <NameTag x={Math.max(220, p.x)} y={p.y} text="ТЁТЯ СВЕТА + ДЕТИ" k={win(tSveta, tPipe)} color={SRYV.lamp} />; })()}
      {/* правила */}
      <Stamp k={win(tR1 + 0.6, tR2, 0.2)} text="НЕ ОТКРЫВАТЬ 24 Ч" color={SRYV.fail} y={330} />
      <Stamp k={win(tR2 + 0.6, tR3, 0.2)} text="1 ФОНАРИК НА ВСЕХ" color={SRYV.lamp} y={330} />
      <Card k={win(tVit, tR4)} y={300} color={SRYV.lamp}>
        <Big s={42} c="#C9D2E0">ВИТЯ СЧИТАЕТ</Big><Big s={60}>60 л ÷ (7 × 2 л) = <span style={{ color: SRYV.progress }}>4 дня</span></Big>
        <Big s={38} c="#C9D2E0">умываться — влажной тряпкой</Big>
      </Card>
      <Card k={win(tSeven, tNight)} y={300}>
        <Big s={42} c="#C9D2E0">РАДИАЦИЯ СНАРУЖИ</Big>
        <Big s={60}>7 часов → <span style={{ color: SRYV.lamp }}>в 10 раз</span> меньше</Big>
        <div style={{ opacity: ramp(t, tTwo, 0.3) }}><Big s={60}>2 суток → <span style={{ color: SRYV.progress }}>в 100 раз</span></Big></div>
      </Card>
      <Stamp k={win(tNoWater, tPipe, 0.2)} text="У НИХ НЕТ ВОДЫ" color={SRYV.fail} y={330} />
      <Stamp k={win(tOpen, tChoice, 0.2)} text="ОТКРОЕШЬ ТРУБУ — ЗАЙДЁТ ПЫЛЬ" color={SRYV.fail} y={330} size={46} />
      {(() => { const p = scr(800, W_GROUND - 120); return <NameTag x={p.x} y={p.y} text="СНАРУЖИ ОСЕДАЕТ ПЫЛЬ" k={win(tOut, tR2)} color={SRYV.fail} />; })()}
      {/* HUD */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        opacity: ramp(t, 2.9, 0.3) * (1 - ramp(t, tChoice + 0.2, 0.4)) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 30px", borderRadius: 16, background: "rgba(14,17,24,0.9)",
          border: `4px solid ${lab.red ? SRYV.fail : SRYV.progress}` }}>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: lab.red ? "#FF8A80" : "#9FE8BE", letterSpacing: 4 }}>{lab.label}</div>
          <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 60, lineHeight: 1, color: "#FFFFFF" }}>{lab.value}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <Pill icon="house" text="7" color="#C9D2E0" />
          <Pill icon="bottle" text="60 л" color="#5AA9FF" hi={win(tR3, tR4)} />
          <Pill icon="alarm" text="3 дн" color={SRYV.lamp} hi={win(tR2, tR3)} />
        </div>
      </div>
      {/* выбор */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(7,9,13,0.6)", opacity: ramp(t, tChoice, 0.5) }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", gap: 34, opacity: ramp(t, tChoice, 0.4) }}>
        <Big s={60}>ВОДА ЧЕРЕЗ ТРУБУ</Big>
        <div style={{ display: "flex", gap: 30 }}>
          {([["ДЕЛИМСЯ", SRYV.progress], ["НЕТ", SRYV.fail]] as const).map(([txt, c], i) => {
            const k = ramp(t, tWrite + i * 0.7, 0.3);
            return <div key={txt} style={{ transform: `scale(${0.85 + 0.15 * k})`, opacity: 0.4 + 0.6 * k, padding: "26px 40px", borderRadius: 22,
              border: `6px solid ${c}`, background: `${c}22`, boxShadow: `0 0 30px ${c}66`, fontFamily: "Inter Display", fontWeight: 900, fontSize: 60, color: "#FFFFFF" }}>{txt}</div>;
          })}
        </div>
        <div style={{ opacity: ramp(t, tWrite, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, color: "#E8C547", letterSpacing: 2 }}>ПИШИ В КОММЕНТАРИЯХ ↓</div>
        <div style={{ opacity: ramp(t, tNext, 0.3), fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 32, color: "#C9D2E0" }}>СЕРИЯ 3 — С ВАШЕГО ОТВЕТА</div>
      </div>
      <Karaoke words={CW} accents={ACCENTS} pendingColor="#C3C8D2" />
      <Grain />
      {withAudio && <Audio src={staticFile("audio/podval2_mix.wav")} />}
    </AbsoluteFill>
  );
};
export { W_CEIL };
