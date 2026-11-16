import React from "react";
import { random } from "remotion";
import { Hero, HeroPose, NEUTRAL } from "../rig/Hero";
import { heroGait, RUN } from "../rig/gait";
import { Look } from "../rig/Hero";
import { Cat, LOOKS } from "./Podval";

/*
 * «CAM 04» — экран пульта дежурного бункера: сетка камер видеонаблюдения, тепловизор, пульт с руками.
 * Каждая камера — свой SVG 540×500, вписывается в окно ленты (CamFeed).
 */
export const FW = 540, FH = 500;
export type CamMode = "day" | "night" | "thermal";
export type Rect = { x: number; y: number; w: number; h: number };
export const GRID: Rect[] = [
  { x: 14, y: 124, w: 520, h: 500 }, { x: 546, y: 124, w: 520, h: 500 },
  { x: 14, y: 636, w: 520, h: 500 }, { x: 546, y: 636, w: 520, h: 500 },
];
export const FULL: Rect = { x: 14, y: 124, w: 1052, h: 1012 };
export const lerpRect = (a: Rect, b: Rect, k: number): Rect => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k });

const MODE_FILTER: Record<CamMode, string> = {
  day: "saturate(0.55) contrast(1.1)",
  night: "grayscale(1) sepia(1) hue-rotate(50deg) saturate(2.6) brightness(0.95) contrast(1.15)",
  thermal: "none",
};

/* ---------- Окно камеры: рамка, подпись, таймкод, REC, развёртка, шум, сбой ---------- */
export const CamFeed: React.FC<{
  frame: number; rect: Rect; id: string; label: string; mode?: CamMode; time: string; glitch?: number; talk?: string; hi?: number;
  dead?: number; children: React.ReactNode;
}> = ({ frame, rect, id, label, mode = "night", time, glitch = 0, talk, hi = 0, dead = 0, children }) => {
  const big = rect.w > 700;
  const fs = big ? 34 : 24;
  const shift = glitch > 0 ? (random(`g${id}${Math.floor(frame / 2)}`) - 0.5) * 40 * glitch : 0;
  return (
    <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: "hidden", background: "#020403",
      outline: `${hi > 0 ? 6 : 3}px solid ${hi > 0 ? `rgba(255,107,94,${0.5 + 0.5 * hi})` : "#1E2620"}` }}>
      <div style={{ position: "absolute", inset: 0, filter: MODE_FILTER[mode], transform: `translateX(${shift}px)` }}>
        <svg viewBox={`0 0 ${FW} ${FH}`} width={rect.w} height={rect.h} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>{children}</svg>
      </div>
      {/* сбой: смещённые полосы */}
      {glitch > 0 && [0, 1, 2].map((i) => {
        const y = random(`gy${id}${i}${Math.floor(frame / 3)}`) * rect.h, h = 8 + random(`gh${id}${i}${Math.floor(frame / 3)}`) * 40;
        return <div key={i} style={{ position: "absolute", left: 0, right: 0, top: y, height: h, background: "rgba(200,255,220,0.12)", transform: `translateX(${(random(`gx${id}${i}${frame}`) - 0.5) * 80 * glitch}px)` }} />;
      })}
      {/* развёртка и виньетка */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0px, rgba(0,0,0,.22) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 5px)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,.6) 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: ((frame * 9) % (rect.h + 80)) - 40, height: 40, background: "linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.05), rgba(255,255,255,0))" }} />
      {/* подписи */}
      <div style={{ position: "absolute", left: 12, top: 10, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: fs, color: "#E6F5EA", textShadow: "0 0 6px #000, 0 0 2px #000" }}>
        {id} · {label}{mode === "thermal" ? " · ТЕПЛО" : ""}
      </div>
      <div style={{ position: "absolute", right: 14, top: 10, display: "flex", alignItems: "center", gap: 8, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: fs, color: "#FF4D4D" }}>
        <div style={{ width: fs * 0.6, height: fs * 0.6, borderRadius: fs, background: "#FF3B30", opacity: Math.floor(frame / 15) % 2 ? 1 : 0.2 }} />REC
      </div>
      <div style={{ position: "absolute", right: 14, bottom: 10, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: fs * 0.85, color: "#C9E6D2", textShadow: "0 0 6px #000" }}>{time}</div>
      {talk && (
        <div style={{ position: "absolute", left: 12, bottom: 10, display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", borderRadius: 8, background: "rgba(229,57,53,.85)",
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: fs * 0.85, color: "#FFFFFF" }}>🔊 {talk}</div>
      )}
      {dead > 0 && (
        <div style={{ position: "absolute", inset: 0, background: `rgba(10,10,10,${dead})`, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: fs * 1.3, color: "#9AA6BA" }}>НЕТ СИГНАЛА</div>
      )}
    </div>
  );
};

/* ---------- Люди в камерах ---------- */
const Person: React.FC<{ x: number; y: number; s: number; look: Look; pose: HeroPose; flip?: boolean; pot?: boolean; potHit?: number }> = ({ x, y, s, look, pose, flip, pot, potHit = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
    <ellipse cx={0} cy={2} rx={46} ry={8} fill="#000" opacity={0.35} />
    <Hero pose={pose} look={look} />
    {pot && (
      <g transform={`translate(${14 + pose.x} ${pose.y - 205}) rotate(${pose.torso + pose.head + potHit * 14})`}>
        <rect x={-50} y={-40} width={100} height={46} rx={8} fill="#9AA3AE" stroke="#3A4250" strokeWidth={5} />
        <rect x={-66} y={-30} width={18} height={10} rx={4} fill="#6E7A8E" /><rect x={48} y={-30} width={18} height={10} rx={4} fill="#6E7A8E" />
        <rect x={-54} y={-48} width={108} height={12} rx={6} fill="#B9C1CB" />
      </g>
    )}
  </g>
);
const run = (frame: number, seed: number, expr?: Partial<HeroPose["expr"]>): HeroPose =>
  ({ ...heroGait(frame + seed * 5, RUN, { expr: { brow: 0.4, browTilt: 0.6, mouth: "open", blink: 0, ...expr } }), x: 0 });
const stand = (frame: number, extra: Partial<HeroPose> = {}): HeroPose =>
  ({ ...NEUTRAL, torso: 2 + Math.sin(frame / 14), expr: { brow: 0.3, browTilt: 0.6, mouth: "flat", blink: frame % 90 < 3 ? 1 : 0 }, ...extra });

/* ---------- CAM 01: гермодверь, жильцы сбегают по лестнице ---------- */
export type Runner = { look: Look; t0: number; dur: number; seed: number; cart?: boolean; pot?: boolean };
export const GateInside: React.FC<{ frame: number; t: number; runners: Runner[]; doorOpen?: number; bonk?: number }> = ({ frame, t, runners, doorOpen = 1, bonk = -1 }) => (
  <>
    <rect x={0} y={0} width={FW} height={FH} fill="#3A3E3A" />
    <rect x={0} y={400} width={FW} height={100} fill="#2A2D2A" />
    {/* лестница сверху слева */}
    <path d="M 0 60 L 150 60 L 330 400 L 0 400 Z" fill="#2F332F" />
    {Array.from({ length: 11 }, (_, i) => <line key={i} x1={0} x2={160 + i * 16.5} y1={60 + i * 31} y2={60 + i * 31} stroke="#4A4F4A" strokeWidth={4} />)}
    <path d="M 150 60 L 330 400" stroke="#C9A82F" strokeWidth={6} />
    {/* гермодверь справа: круглая, открыта */}
    <rect x={420} y={180} width={120} height={230} fill="#1C1F1C" />
    {Array.from({ length: 7 }, (_, i) => <rect key={i} x={404} y={170 + i * 34} width={14} height={18} fill={i % 2 ? "#1A1A1A" : "#E8C547"} />)}
    <g transform={`translate(420 295) scale(${1 - 0.75 * doorOpen} 1)`}>
      <ellipse cx={60} cy={0} rx={70} ry={118} fill="#5A6058" stroke="#2A2D2A" strokeWidth={8} />
      <circle cx={60} cy={0} r={34} fill="none" stroke="#C9A82F" strokeWidth={8} />
      {[0, 60, 120].map((a) => <line key={a} x1={60 - 34 * Math.cos((a * Math.PI) / 180)} y1={-34 * Math.sin((a * Math.PI) / 180)} x2={60 + 34 * Math.cos((a * Math.PI) / 180)} y2={34 * Math.sin((a * Math.PI) / 180)} stroke="#C9A82F" strokeWidth={6} />)}
    </g>
    <circle cx={270} cy={30} r={14} fill="#FFE2A8" opacity={0.9} />
    {runners.map((r, i) => {
      const k = (t - r.t0) / r.dur;
      if (k < 0 || k > 1) return null;
      // вниз по лестнице, потом вправо в дверь
      const a = Math.min(1, k / 0.6), b = Math.max(0, (k - 0.6) / 0.4);
      const x = 20 + 300 * a + 160 * b, y = 60 + 340 * a;
      const hit = bonk >= 0 && r.pot && t > bonk && t < bonk + 0.6 ? Math.sin((t - bonk) * 40) * (1 - (t - bonk) / 0.6) : 0;
      return (
        <g key={i}>
          <Person x={x - hit * 6} y={y} s={0.42} look={r.look} pose={run(frame, r.seed)} pot={r.pot} potHit={hit} />
          {r.cart && (
            <g transform={`translate(${x + 40} ${y - 46})`}>
              <rect x={0} y={0} width={70} height={40} rx={4} fill="#6E7A8E" stroke="#2A2D2A" strokeWidth={3} />
              {[0, 1, 2, 3].map((j) => <rect key={j} x={6 + j * 16} y={-22 + Math.sin(frame / 2 + j) * 2} width={13} height={24} rx={4} fill="#7FB069" stroke="#E8E2CF" strokeWidth={2} />)}
              <circle cx={12} cy={44} r={7} fill="#1A1A1A" /><circle cx={58} cy={44} r={7} fill="#1A1A1A" />
            </g>
          )}
        </g>
      );
    })}
    {bonk >= 0 && t > bonk && t < bonk + 0.9 && (
      <text x={420} y={150} fontFamily="Inter Display" fontWeight={900} fontSize={54} fill="#FFFFFF" stroke="#000" strokeWidth={3} transform={`rotate(-8 420 150)`}>БОНК!</text>
    )}
  </>
);

/* ---------- CAM 04: поверхность у ворот ---------- */
export const Surface: React.FC<{ frame: number; t: number; knock?: number; approach?: number; thermal?: number; baby?: number }> = ({ frame, knock = 0, approach = 0, thermal = 0, baby = 0 }) => {
  const s = 0.55 + 0.5 * approach;
  const mx = 230, my = 430 + 40 * approach;
  if (thermal > 0) {
    const pulse = 0.85 + 0.15 * Math.sin(frame / 4);
    return (
      <>
        <defs>
          <radialGradient id="thHot"><stop offset="0" stopColor="#FFFBD0" /><stop offset="0.35" stopColor="#FFC93C" /><stop offset="0.7" stopColor="#FF4D2E" /><stop offset="1" stopColor="#7A1FA2" stopOpacity={0} /></radialGradient>
          <radialGradient id="thBaby"><stop offset="0" stopColor="#FFFFFF" /><stop offset="0.4" stopColor="#FFE066" /><stop offset="1" stopColor="#FF4D2E" stopOpacity={0} /></radialGradient>
        </defs>
        <rect x={0} y={0} width={FW} height={FH} fill="#140A3A" />
        <rect x={0} y={330} width={FW} height={170} fill="#1E1050" />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={30 + i * 60} y={150} width={10} height={260} fill="#2A1A6A" />)}
        <rect x={0} y={160} width={FW} height={8} fill="#2A1A6A" />
        {/* мужчина */}
        <g transform={`translate(${mx} ${my}) scale(${s})`}>
          <ellipse cx={0} cy={-150} rx={70} ry={150} fill="url(#thHot)" />
          <ellipse cx={4} cy={-330} rx={42} ry={50} fill="url(#thHot)" />
          {baby > 0 && <><ellipse cx={14} cy={-200} rx={34 * pulse} ry={28 * pulse} fill="url(#thBaby)" opacity={baby} />
            <circle cx={14} cy={-200} r={70} fill="none" stroke="#FFFFFF" strokeWidth={4} strokeDasharray="10 8" opacity={baby} /></>}
        </g>
        {/* девочка */}
        <g transform={`translate(${mx + 120 * s} ${my}) scale(${s})`}>
          <ellipse cx={0} cy={-90} rx={44} ry={92} fill="url(#thHot)" />
          <ellipse cx={0} cy={-200} rx={30} ry={34} fill="url(#thHot)" />
        </g>
      </>
    );
  }
  return (
    <>
      <defs><linearGradient id="skyR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0A0D12" /><stop offset="1" stopColor="#4A1A14" /></linearGradient></defs>
      <rect x={0} y={0} width={FW} height={340} fill="url(#skyR)" />
      <path d="M 0 300 L 60 270 L 120 290 L 200 250 L 260 280 L 340 240 L 420 285 L 540 260 L 540 340 L 0 340 Z" fill="#0E1014" />
      <circle cx={420} cy={250} r={70} fill="#FF7A3C" opacity={0.18 + 0.05 * Math.sin(frame / 7)} />
      <rect x={0} y={330} width={FW} height={170} fill="#1E211E" />
      {/* забор и ворота */}
      {Array.from({ length: 9 }, (_, i) => <rect key={i} x={30 + i * 60} y={150} width={10} height={260} fill="#2A2E2A" />)}
      <rect x={0} y={160} width={FW} height={8} fill="#2A2E2A" />
      <rect x={0} y={250} width={FW} height={6} fill="#2A2E2A" />
      {/* пепел */}
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={(random(`ax${i}`) * FW + frame * (0.6 + random(`av${i}`))) % FW} cy={(random(`ay${i}`) * FH + frame * (1.2 + random(`aw${i}`))) % FH} r={1.6} fill="#C9C2B5" opacity={0.6} />)}
      {/* мужчина с девочкой */}
      <Person x={mx} y={my} s={s} look={LOOKS.petrov} pose={stand(frame, { armR: { sh: knock > 0 ? -150 : -40, el: knock > 0 ? -20 : -50, wr: 0 }, expr: { brow: 0.6, browTilt: 1, mouth: "open", blink: 0 } })} />
      <Person x={mx + 120 * s} y={my} s={s * 0.62} look={LOOKS.kidB} pose={stand(frame + 20, { expr: { brow: 0.6, browTilt: 1, mouth: "sad", blink: 0 } })} />
      {/* ладонь по объективу */}
      {knock > 0 && (
        <g transform={`translate(270 250) scale(${0.6 + 2.2 * knock})`} opacity={Math.min(1, knock * 2)}>
          <path d="M -60 120 L -70 -10 Q -72 -40 -52 -40 Q -36 -40 -36 -12 L -34 -90 Q -34 -112 -16 -112 Q 2 -112 2 -90 L 4 -100 Q 6 -122 24 -120 Q 42 -118 40 -96 L 40 -80 Q 44 -100 60 -96 Q 76 -92 72 -70 L 64 60 Q 60 120 20 130 Z" fill="#C98F6C" stroke="#3A2A20" strokeWidth={4} />
        </g>
      )}
    </>
  );
};

/* ---------- CAM 02: склад ---------- */
export const Storage: React.FC<{ frame: number }> = ({ frame }) => {
  const cx = 60 + ((frame * 1.6) % 520);
  return (
    <>
      <rect x={0} y={0} width={FW} height={FH} fill="#3A3E3A" />
      <rect x={0} y={420} width={FW} height={80} fill="#2A2D2A" />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <rect x={20} y={120 + r * 110} width={500} height={10} fill="#5A6058" />
          {Array.from({ length: 14 }, (_, i) => <rect key={i} x={30 + i * 35} y={120 + r * 110 - (r === 1 ? 52 : 40)} width={26} height={r === 1 ? 52 : 40} rx={4}
            fill={r === 1 ? "#6FA8DC" : "#9AA3AE"} opacity={0.9} />)}
        </g>
      ))}
      <g transform={`translate(${cx} 120) scale(0.7)`}><Cat frame={frame} /></g>
    </>
  );
};

/* ---------- CAM 03: жилой отсек ---------- */
export const Bunks: React.FC<{ frame: number; zinaShake?: number; people?: number }> = ({ frame, zinaShake = 0, people = 1 }) => (
  <>
    <rect x={0} y={0} width={FW} height={FH} fill="#3A3E3A" />
    <rect x={0} y={420} width={FW} height={80} fill="#2A2D2A" />
    {[40, 300].map((x) => (
      <g key={x}>
        <rect x={x} y={150} width={200} height={14} fill="#5A6058" /><rect x={x} y={300} width={200} height={14} fill="#5A6058" />
        <rect x={x} y={130} width={8} height={290} fill="#4A4F4A" /><rect x={x + 192} y={130} width={8} height={290} fill="#4A4F4A" />
        <rect x={x + 10} y={136} width={180} height={16} rx={6} fill="#8A8F7E" /><rect x={x + 10} y={286} width={180} height={16} rx={6} fill="#8A8F7E" />
      </g>
    ))}
    {people > 0 && <Person x={140} y={420} s={0.42} look={LOOKS.twinA} pose={stand(frame + 40)} />}
    <Person x={400} y={420} s={0.46} look={LOOKS.zina} flip
      pose={stand(frame, { armR: { sh: zinaShake > 0 ? -150 + Math.sin(frame / 2) * 18 : -10, el: zinaShake > 0 ? -30 : -20, wr: 0 },
        expr: { brow: zinaShake > 0 ? -0.8 : 0, browTilt: zinaShake > 0 ? -1 : 0.3, mouth: zinaShake > 0 ? "open" : "flat", blink: 0 } })} />
    {[0, 1, 2].map((j) => <rect key={j} x={330 + j * 20} y={270} width={16} height={26} rx={4} fill="#7FB069" stroke="#E8E2CF" strokeWidth={2} />)}
  </>
);

/* ---------- Пульт: таймер двери, кнопки, дозиметр, рычаг ---------- */
export const Console: React.FC<{ frame: number; timer: string; timerHot?: number; talk?: number; thermal?: number; dose?: number; lever?: number }> = ({ frame, timer, timerHot = 0, talk = 0, thermal = 0, dose = 0, lever = 0 }) => {
  const needle = -70 + 140 * Math.min(1, dose) + (dose > 0.3 ? Math.sin(frame * 1.3) * 6 * dose : 0);
  const Btn = ({ x, label, on, color }: { x: number; label: string; on: number; color: string }) => (
    <g transform={`translate(${x} 1420)`}>
      <rect x={-70} y={-44} width={140} height={88} rx={14} fill="#1A1D22" stroke="#3A404A" strokeWidth={4} />
      <circle cx={0} cy={-6} r={26} fill={on > 0 ? color : "#2E333B"} style={{ filter: on > 0 ? `drop-shadow(0 0 14px ${color})` : "none" }} />
      <text x={0} y={36} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={20} fill="#C9D2E0">{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2A2F36" /><stop offset="1" stopColor="#14171B" /></linearGradient></defs>
      <rect x={0} y={1150} width={1080} height={770} fill="url(#desk)" />
      <rect x={0} y={1150} width={1080} height={10} fill="#3A404A" />
      {/* таймер гермодвери */}
      <g transform="translate(40 1350)">
        <rect x={0} y={0} width={330} height={140} rx={14} fill="#0A0B0D" stroke={timerHot > 0 ? "#FF3B30" : "#3A404A"} strokeWidth={5} />
        <text x={14} y={30} fontFamily="JetBrains Mono" fontWeight={700} fontSize={22} fill="#9AA6BA">ГЕРМОДВЕРЬ</text>
        <text x={165} y={118} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={88} fill="#FF3B30"
          opacity={timerHot > 0 && Math.floor(frame / 8) % 2 ? 0.5 : 1} style={{ filter: "drop-shadow(0 0 10px #FF3B30)" }}>{timer}</text>
      </g>
      <Btn x={480} label="СВЯЗЬ" on={talk} color="#3DDC84" />
      <Btn x={650} label="ТЕПЛО" on={thermal} color="#FF8A3C" />
      {/* рычаг */}
      <g transform="translate(900 1560)">
        <rect x={-80} y={-20} width={160} height={50} rx={12} fill="#1A1D22" stroke="#3A404A" strokeWidth={4} />
        <g transform={`rotate(${-35 + 70 * lever})`}>
          <rect x={-12} y={-190} width={24} height={190} rx={10} fill="#8A929E" />
          <circle cx={0} cy={-200} r={34} fill="#E53935" stroke="#7A1B1B" strokeWidth={5} />
        </g>
        <text x={0} y={70} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={22} fill="#C9D2E0">ЗАКРЫТЬ</text>
      </g>
      {/* дозиметр */}
      <g transform="translate(250 1700)">
        <rect x={-190} y={-130} width={380} height={190} rx={18} fill="#1A1D22" stroke={dose > 0.5 ? "#E8C547" : "#3A404A"} strokeWidth={4} />
        <path d="M -130 20 A 130 130 0 0 1 130 20" fill="none" stroke="#3A404A" strokeWidth={14} />
        <path d="M 60 -95 A 130 130 0 0 1 130 20" fill="none" stroke="#E53935" strokeWidth={14} />
        <g transform={`translate(0 20) rotate(${needle})`}><rect x={-4} y={-120} width={8} height={120} rx={4} fill="#F6F2E7" /></g>
        <circle cx={0} cy={20} r={12} fill="#8A929E" />
        <text x={0} y={-60} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={26} fill={dose > 0.5 ? "#E8C547" : "#9AA6BA"}>
          {(0.12 + 9 * dose * dose).toFixed(2)} мкЗв/ч
        </text>
        <text x={-170} y={48} fontFamily="JetBrains Mono" fontWeight={700} fontSize={20} fill="#9AA6BA">ДОЗИМЕТР · ВХОД</text>
      </g>
      {/* микрофон */}
      <path d="M 640 1920 Q 640 1700 700 1640" stroke="#3A404A" strokeWidth={10} fill="none" />
      <rect x={684} y={1600} width={44} height={60} rx={18} fill="#2E333B" stroke={talk > 0 ? "#3DDC84" : "#4A505A"} strokeWidth={4} />
    </svg>
  );
};
export { Cat };
