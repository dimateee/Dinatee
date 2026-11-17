import React from "react";
import { random } from "remotion";
import { ARTYOM, Hero, HeroPose, Look, NEUTRAL } from "../rig/Hero";
import { heroGait, WALK } from "../rig/gait";
import { LOOKS } from "./Podval";

/*
 * «40 дБ» v2 (LESSONS Б26): объём, фактура, живой свет, слои глубины, микродвижения.
 * Мир серо-синий, цветной только ЗВУК: кольца с подписью децибел. Твари слепые, с веером перепонок.
 */
export const THRESH = 40;
export const ringColor = (db: number) => (db >= THRESH ? "#FF3B30" : "#F2C94C");

/* ---------- Общие фильтры (один раз в каждом SVG) ---------- */
export const DbDefs: React.FC<{ frame: number }> = ({ frame }) => (
  <defs>
    <filter id="dbNoise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} />
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.1" />
    </filter>
    <filter id="dbSkin" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.045 0.09" numOctaves={3} seed={3} result="n" />
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.05  0 0 0 0 0.06  0 0 0 0 0.07  0 0 0 0.9 -0.25" result="m" />
      <feComposite in="m" in2="SourceAlpha" operator="in" result="mm" />
      <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="mm" /></feMerge>
    </filter>
    {/* «кипящий» контур — живая дрожь формы */}
    <filter id="dbBoil" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves={2} seed={Math.floor(frame / 3) % 50} result="t" />
      <feDisplacementMap in="SourceGraphic" in2="t" scale={5} xChannelSelector="R" yChannelSelector="G" />
    </filter>
    <filter id="dbGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
    <filter id="dbBlur6"><feGaussianBlur stdDeviation="6" /></filter>
    <filter id="dbBlur14"><feGaussianBlur stdDeviation="14" /></filter>
    <filter id="dbShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.75 0" /><feGaussianBlur stdDeviation="7" />
    </filter>
    <linearGradient id="crSkin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3A4046" /><stop offset="0.45" stopColor="#1C2024" /><stop offset="1" stopColor="#08090B" /></linearGradient>
    <linearGradient id="crLimb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2E3338" /><stop offset="1" stopColor="#0C0E10" /></linearGradient>
    <radialGradient id="crFin" cx="0.5" cy="1" r="1"><stop offset="0" stopColor="#120A0C" /><stop offset="0.6" stopColor="#2E1418" stopOpacity={0.95} /><stop offset="1" stopColor="#6A3036" stopOpacity={0.7} /></radialGradient>
    <radialGradient id="crFinHot" cx="0.5" cy="1" r="1"><stop offset="0" stopColor="#5A0F14" /><stop offset="0.6" stopColor="#E0453A" stopOpacity={0.9} /><stop offset="1" stopColor="#FFB0A0" stopOpacity={0.7} /></radialGradient>
    <radialGradient id="dbCandle"><stop offset="0" stopColor="#FFD9A0" stopOpacity={0.55} /><stop offset="0.5" stopColor="#FFB45A" stopOpacity={0.18} /><stop offset="1" stopColor="#FFB45A" stopOpacity={0} /></radialGradient>
    <radialGradient id="dbVig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.85} /></radialGradient>
  </defs>
);

/* ---------- Шумомер (экранный HUD) ---------- */
export const DbMeter: React.FC<{ db: number; frame: number; dist?: number; time?: string }> = ({ db, frame, dist, time }) => {
  const W = 760, X = 160, Y = 170;
  const k = Math.min(1, db / 100), hot = db >= THRESH;
  const jitter = db > 5 ? Math.sin(frame * 1.7) * 1.2 : 0;
  return (
    <div style={{ position: "absolute", left: X, top: Y, width: W }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "JetBrains Mono", fontWeight: 700 }}>
        <span style={{ fontSize: 30, color: "#9AA6BA" }}>{time ?? ""}</span>
        <span style={{ fontSize: 76, color: hot ? "#FF3B30" : "#E6ECF5", textShadow: hot ? "0 0 24px rgba(255,59,48,.8)" : "0 0 12px #000" }}>{Math.round(db + jitter)} дБ</span>
        <span style={{ fontSize: 30, color: dist !== undefined && dist < 10 ? "#FF6B5E" : "#9AA6BA" }}>{dist !== undefined ? `ДО НИХ ${Math.round(dist)} м` : ""}</span>
      </div>
      <div style={{ position: "relative", height: 26, marginTop: 8, borderRadius: 13, background: "rgba(20,24,32,.9)", overflow: "hidden", border: "2px solid #2B3241" }}>
        {Array.from({ length: 20 }, (_, i) => <div key={i} style={{ position: "absolute", left: `${i * 5}%`, top: 0, bottom: 0, width: 2, background: "rgba(255,255,255,.06)" }} />)}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${100 * k}%`, background: hot ? "linear-gradient(90deg,#F2C94C,#FF3B30)" : "#F2C94C",
          boxShadow: hot ? "0 0 18px #FF3B30" : "none" }} />
        <div style={{ position: "absolute", left: `${THRESH}%`, top: -4, bottom: -4, width: 5, background: "#FF3B30" }} />
      </div>
      <div style={{ position: "relative", height: 34, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 24, color: "#FF6B5E" }}>
        <span style={{ position: "absolute", left: `${THRESH}%`, transform: "translateX(-50%)", top: 6, whiteSpace: "nowrap" }}>▲ 40 — СЛЫШАТ</span>
      </div>
    </div>
  );
};

/* ---------- Звуковые кольца: свечение, частицы ---------- */
export const Rings: React.FC<{ x: number; y: number; db: number; age: number; label?: boolean; scale?: number }> = ({ x, y, db, age, label = true, scale = 1 }) => {
  if (age < 0) return null;
  const c = ringColor(db), n = db >= THRESH ? 5 : 3, life = 1.6;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const p = ((age / life + i / n) % 1);
        const r = (20 + p * (db * 4.8)) * scale;
        return (
          <g key={i} opacity={(1 - p) * 0.95}>
            <circle cx={x} cy={y} r={r} fill="none" stroke={c} strokeWidth={(db >= THRESH ? 16 : 10) * scale} opacity={0.25} filter="url(#dbBlur6)" />
            <circle cx={x} cy={y} r={r} fill="none" stroke={c} strokeWidth={(db >= THRESH ? 5 : 3) * scale} strokeDasharray={db >= THRESH ? `${18 * scale} ${7 * scale}` : undefined} />
            {Array.from({ length: 10 }, (_, j) => { const a = j * 0.63 + i; return <circle key={j} cx={x + Math.cos(a) * r} cy={y + Math.sin(a) * r} r={3 * scale} fill={c} opacity={0.8} />; })}
          </g>
        );
      })}
      {label && <text x={x} y={y - (36 + Math.min(1, age * 3) * 40) * scale} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={42 * scale}
        fill={c} stroke="#000" strokeWidth={5 * scale} paintOrder="stroke" opacity={Math.min(1, age * 4)} filter="url(#dbGlow)">{Math.round(db)} дБ</text>}
    </g>
  );
};

/* ---------- Тварь v2: анатомия, фактура, тики головы, слюна, перепонки с венами ---------- */
type P = [number, number];
const seg = (a: P, b: P, w: number, key: string, hl = true) => (
  <g key={key}>
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="url(#crLimb)" strokeWidth={w} strokeLinecap="round" />
    {hl && <line x1={a[0] - w * 0.18} y1={a[1] - w * 0.1} x2={b[0] - w * 0.18} y2={b[1] - w * 0.1} stroke="#7F95B8" strokeWidth={w * 0.12} strokeLinecap="round" opacity={0.35} />}
    <ellipse cx={b[0]} cy={b[1]} rx={w * 0.5} ry={w * 0.42} fill="#1A1D20" />
    <path d={`M ${b[0] - w * 0.4} ${b[1] - w * 0.2} q ${w * 0.4} ${-w * 0.35} ${w * 0.8} 0`} stroke="#7F95B8" strokeWidth={2} fill="none" opacity={0.3} />
  </g>
);
export const Creature: React.FC<{
  x: number; y: number; s: number; frame: number; turn?: number; flare?: number; step?: number; mouth?: number; flip?: boolean; lean?: number; boil?: boolean;
}> = ({ x, y, s, frame, turn = 0, flare = 0, step = 0, mouth = 0, flip = false, lean = 0, boil = true }) => {
  const br = Math.sin(frame / 16);
  // дёрганый тик головы: резкие повороты раз в ~0.6 с
  const tk = Math.floor(frame / 18), tf = (frame % 18) / 18;
  const tickA = (random(`tk${tk}`) - 0.5) * 22, tickB = (random(`tk${tk + 1}`) - 0.5) * 22;
  const tick = tf < 0.85 ? tickA : tickA + (tickB - tickA) * ((tf - 0.85) / 0.15);
  const ph = step * Math.PI * 2;
  const leg = (o: number): P[] => {
    const sw = Math.sin(ph + o), lift = Math.max(0, Math.cos(ph + o)) * 40;
    return [[-10 + 10 * o, -430], [50 + 40 * sw, -265 - lift * 0.4], [-25 + 55 * sw, -95 - lift], [25 + 60 * sw, -lift * 0.3]];
  };
  const shoulder: P = [70 + 30 * lean, -760 + 20 * lean];
  const arm = (o: number, sway: number): P[] => [shoulder, [10 + 20 * Math.sin(frame / 22 + o), -520 + sway], [80 + 30 * lean, -330 + sway * 1.2], [120 + 30 * lean, -190 + sway]];
  const fins = 9, hot = flare > 0.35;
  const jaw = mouth * 26;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <ellipse cx={20} cy={4} rx={190} ry={26} fill="#000" opacity={0.55} filter="url(#dbBlur6)" />
      <g filter={boil ? "url(#dbBoil)" : undefined}>
        {/* дальние нога и рука (темнее) */}
        <g opacity={0.75}>{leg(Math.PI).slice(0, -1).map((p, i, a) => seg(p, leg(Math.PI)[i + 1], [44, 34, 22][i], `bl${i}`, false))}
          {arm(2, -10 * br).slice(0, -1).map((p, i) => seg(p, arm(2, -10 * br)[i + 1], [30, 24, 14][i], `ba${i}`, false))}</g>
        {/* ближняя нога: бедро, голень назад, длинная стопа */}
        {leg(0).slice(0, -1).map((p, i) => seg(p, leg(0)[i + 1], [52, 40, 26][i], `fl${i}`))}
        {[[-14, 0], [0, 6], [14, 2]].map(([dx, dy], i) => { const t = leg(0)[3]; return <path key={i} d={`M ${t[0] + dx} ${t[1] - 6} q 18 ${4 + dy} 34 ${10 + dy}`} stroke="#C9C2B0" strokeWidth={5} fill="none" strokeLinecap="round" />; })}
        {/* туловище: сутулое, рёбра, позвоночник */}
        <g transform={`rotate(${8 * lean} 0 -430)`}>
          <path d={`M -40 -430 Q -110 -560 -60 -700 Q -10 -800 ${70} -790 Q 150 -760 140 -640 Q ${120 + 6 * br} -520 70 -430 Q 10 -400 -40 -430 Z`}
            fill="url(#crSkin)" stroke="#2A3036" strokeWidth={3} filter="url(#dbSkin)" />
          {Array.from({ length: 7 }, (_, i) => {
            const yy = -720 + i * 40, ex = 6 * br * (1 - i / 7);
            return <g key={i}>
              <path d={`M ${0 + i * 4} ${yy} Q ${60 + ex} ${yy - 18} ${126 - i * 6 + ex} ${yy + 14}`} stroke="#4A525A" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.55} />
              <path d={`M ${4 + i * 4} ${yy + 10} Q ${60 + ex} ${yy - 6} ${120 - i * 6 + ex} ${yy + 25}`} stroke="#050607" strokeWidth={5} fill="none" opacity={0.6} />
            </g>;
          })}
          {/* позвонки-шипы по спине */}
          {Array.from({ length: 9 }, (_, i) => { const tt = i / 8, px = -62 + 30 * Math.sin(tt * 2.6) - 10 * tt, py = -450 - tt * 320;
            return <path key={i} d={`M ${px} ${py} l -26 -10 l 18 -14 Z`} fill="#2A3036" stroke="#7F95B8" strokeWidth={2} strokeOpacity={0.4} />; })}
          {/* холодный контровой свет по спине */}
          <path d="M -40 -430 Q -110 -560 -60 -700 Q -10 -800 70 -790" stroke="#9CB4D8" strokeWidth={5} fill="none" opacity={0.45} />
          {/* мокрые блики */}
          {[[20, -680, 30], [60, -560, 22], [-10, -600, 16]].map(([bx, by, bw], i) => <path key={i} d={`M ${bx} ${by} q ${bw} -6 ${bw * 1.6} 4`} stroke="#E6F0FF" strokeWidth={3} fill="none" opacity={0.3 + 0.1 * Math.sin(frame / 7 + i)} />)}
        </g>
        {/* шея: сегменты */}
        {Array.from({ length: 4 }, (_, i) => <ellipse key={i} cx={95 + i * 22 + 20 * turn} cy={-790 - i * 10} rx={26} ry={20} fill="#1C2024" stroke="#3A4046" strokeWidth={2} />)}
        {/* голова */}
        <g transform={`translate(${180 + 40 * turn} -830) rotate(${turn * 24 + tick + 6 * lean})`}>
          {/* перепонки веером, с венами */}
          {Array.from({ length: fins }, (_, i) => {
            const a = -150 + i * (120 / (fins - 1)) - flare * (i - fins / 2) * 4;
            const len = 120 + 110 * flare + (i % 3) * 22;
            const q = flare > 0 ? Math.sin(frame / 1.7 + i * 1.3) * 7 * flare : Math.sin(frame / 9 + i) * 2;
            return (
              <g key={i} transform={`rotate(${a + q})`}>
                <path d={`M -16 -20 C -40 ${-20 - len * 0.5} -12 ${-20 - len} 4 ${-24 - len} C 18 ${-20 - len} 36 ${-20 - len * 0.5} 16 -20 Z`}
                  fill={hot ? "url(#crFinHot)" : "url(#crFin)"} stroke={hot ? "#FF8A7A" : "#3A2A2E"} strokeWidth={2.5} />
                {[-6, 4, 12].map((vx, j) => <path key={j} d={`M ${vx * 0.3} -26 Q ${vx} ${-20 - len * 0.5} ${vx * 0.6 + 2} ${-20 - len * 0.92}`} stroke={hot ? "#FFD0C0" : "#7A3A40"} strokeWidth={2} fill="none" opacity={hot ? 0.9 : 0.5} />)}
              </g>
            );
          })}
          {/* череп */}
          <path d="M -70 10 Q -80 -70 0 -86 Q 90 -92 130 -40 Q 150 -6 136 18 Q 80 30 20 34 Q -40 40 -70 10 Z" fill="url(#crSkin)" stroke="#3A4046" strokeWidth={3} filter="url(#dbSkin)" />
          {/* затянутые кожей глазницы */}
          <ellipse cx={60} cy={-34} rx={22} ry={13} fill="#08090B" opacity={0.8} /><path d="M 40 -42 Q 60 -50 80 -40" stroke="#5A6470" strokeWidth={2.5} fill="none" />
          <ellipse cx={98} cy={-30} rx={14} ry={9} fill="#08090B" opacity={0.7} />
          <path d="M -40 -70 Q 20 -96 110 -64" stroke="#9CB4D8" strokeWidth={4} fill="none" opacity={0.4} />
          {/* челюсть и зубы */}
          <g transform={`rotate(${jaw} 0 20)`}>
            <path d="M -40 22 Q 40 40 134 18 Q 120 52 50 60 Q -10 60 -40 22 Z" fill="#14171A" stroke="#3A4046" strokeWidth={3} />
            {mouth > 0.1 && Array.from({ length: 9 }, (_, i) => <path key={i} d={`M ${-10 + i * 15} ${30 + i * 0.3} l 5 -16 l 5 16 Z`} fill="#D8D2C0" />)}
          </g>
          {mouth > 0.1 && <path d="M -36 20 Q 50 26 132 16 L 120 30 Q 50 38 -30 30 Z" fill="#5A0F14" />}
          {mouth > 0.1 && Array.from({ length: 9 }, (_, i) => <path key={`u${i}`} d={`M ${-6 + i * 15} 18 l 5 14 l 5 -14 Z`} fill="#E6E0CE" />)}
          {/* слюна */}
          <path d={`M 120 30 Q ${126 + Math.sin(frame / 8) * 10} ${70 + mouth * 30} ${118 + Math.sin(frame / 8) * 14} ${110 + mouth * 50}`} stroke="#C9D8E8" strokeWidth={3} fill="none" opacity={0.55} />
          <circle cx={118 + Math.sin(frame / 8) * 14} cy={112 + mouth * 50} r={5} fill="#C9D8E8" opacity={0.6} />
        </g>
        {/* ближняя рука: длинная, пальцы-когти дёргаются */}
        {arm(0, 10 * br).slice(0, -1).map((p, i) => seg(p, arm(0, 10 * br)[i + 1], [34, 26, 16][i], `fa${i}`))}
        {Array.from({ length: 4 }, (_, i) => {
          const h = arm(0, 10 * br)[3], a = 60 + i * 14 + Math.sin(frame / 5 + i * 2) * 8;
          const L1 = 60 + i * 6, r = (a * Math.PI) / 180;
          const p1: P = [h[0] + Math.cos(r) * L1 * 0.5, h[1] + Math.sin(r) * L1], p2: P = [p1[0] + Math.cos(r + 0.4) * 50, p1[1] + Math.sin(r + 0.4) * 50];
          return <g key={i}>
            <path d={`M ${h[0]} ${h[1]} L ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]}`} stroke="#1C2024" strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d={`M ${p2[0]} ${p2[1]} l ${Math.cos(r + 0.7) * 26} ${Math.sin(r + 0.7) * 26}`} stroke="#D8D2C0" strokeWidth={5} strokeLinecap="round" />
          </g>;
        })}
      </g>
    </g>
  );
};

/* ---------- Библиотека v2: свет свечи, пыль, туман, слои глубины ---------- */
export const CANDLE = { x: 540, y: 1380 };
export const Library: React.FC<{ frame: number; candle?: number; children?: React.ReactNode; shadows?: React.ReactNode }> = ({ frame, candle = 1, children, shadows }) => {
  const fl = 0.85 + 0.1 * Math.sin(frame / 3) + 0.05 * Math.sin(frame * 1.3);
  const spines = ["#2A3242", "#3A2A26", "#2A3A2E", "#3A3428", "#2E2A3A", "#40302A"];
  return (
    <g>
      <linearGradient id="lbW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#090B10" /><stop offset="1" stopColor="#141820" /></linearGradient>
      <rect x={-700} y={-300} width={2600} height={1900} fill="url(#lbW)" />
      <rect x={-700} y={-300} width={2600} height={1900} filter="url(#dbNoise)" opacity={0.12} />
      {/* дальние стеллажи (глубина) */}
      {[-250, 230, 860].map((x, j) => <rect key={j} x={x} y={420} width={260} height={1000} fill="#0E1015" opacity={0.9} />)}
      {/* стеллажи */}
      {[-470, -100, 700, 1070].map((x, j) => (
        <g key={j}>
          <rect x={x} y={460} width={330} height={990} fill="#1C1713" stroke="#0A0806" strokeWidth={10} />
          <rect x={x + 6} y={466} width={12} height={980} fill="#2A231C" />
          {Array.from({ length: 6 }, (_, r) => (
            <g key={r}>
              <rect x={x} y={560 + r * 150} width={330} height={14} fill="#0E0B08" />
              <rect x={x} y={556 + r * 150} width={330} height={4} fill="#3A3026" />
              {Array.from({ length: 12 }, (_, b) => {
                const hgt = 104 - ((b * 7 + r * 3 + j) % 5) * 8, w = 20 + ((b + r) % 3) * 3, bx = x + 8 + b * 26.5;
                const tilt = (b * 13 + r * 7 + j) % 17 === 0 ? 14 : 0;
                return <g key={b} transform={`rotate(${tilt} ${bx} ${560 + r * 150})`}>
                  <rect x={bx} y={560 + r * 150 - hgt} width={w} height={hgt} fill={spines[(b + r + j) % 6]} />
                  <rect x={bx + 3} y={560 + r * 150 - hgt + 14} width={w - 6} height={4} fill="#8A7A5A" opacity={0.35} />
                  <rect x={bx} y={560 + r * 150 - hgt} width={3} height={hgt} fill="#000" opacity={0.35} />
                </g>;
              })}
            </g>
          ))}
          {/* паутина в углу */}
          <path d={`M ${x + 330} 466 L ${x + 270} 466 M ${x + 330} 466 L ${x + 330} 526 M ${x + 330} 466 L ${x + 285} 511 M ${x + 300} 466 Q ${x + 310} 490 ${x + 330} 496 M ${x + 280} 466 Q ${x + 300} 506 ${x + 330} 516`}
            stroke="#C9D2E0" strokeWidth={1.5} opacity={0.25} fill="none" />
        </g>
      ))}
      {/* табличка «ТИШИНА» */}
      <g transform="translate(540 600)">
        <rect x={-156} y={-50} width={312} height={100} rx={8} fill="#2B2620" stroke="#5A4E3A" strokeWidth={5} />
        <text x={0} y={18} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={54} fill="#BFB39A">ТИШИНА</text>
        <line x1={-156} y1={-50} x2={-120} y2={-140} stroke="#3A3026" strokeWidth={4} /><line x1={156} y1={-50} x2={120} y2={-140} stroke="#3A3026" strokeWidth={4} />
      </g>
      {/* тени героев на стеллажах — пляшут от свечи */}
      {shadows && <g filter="url(#dbShadow)" opacity={0.7 * candle} transform={`translate(0 ${-30 + 8 * Math.sin(frame / 3)}) translate(540 1450) scale(${1.35 + 0.04 * Math.sin(frame / 2.7)} 1.45) skewX(${3 * Math.sin(frame / 4)}) translate(-540 -1450)`}>{shadows}</g>}
      {/* пол, дорожка */}
      <rect x={-700} y={1450} width={2600} height={400} fill="#100D0A" />
      <path d="M 100 1450 L 980 1450 L 1220 1820 L -140 1820 Z" fill="#4A1E1E" />
      <path d="M 100 1450 L 980 1450 L 1220 1820 L -140 1820 Z" filter="url(#dbNoise)" opacity={0.25} />
      <path d="M 130 1464 L 950 1464 M 140 1482 L 940 1482" stroke="#7A3A2A" strokeWidth={6} />
      {children}
      {/* свеча и объёмный свет */}
      <circle cx={CANDLE.x} cy={CANDLE.y} r={640} fill="url(#dbCandle)" opacity={candle * fl} />
      {Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + (i - 2.5) * 0.35 + Math.sin(frame / 40 + i) * 0.05;
        return <path key={i} d={`M ${CANDLE.x} ${CANDLE.y - 30} L ${CANDLE.x + Math.cos(a - 0.05) * 900} ${CANDLE.y + Math.sin(a - 0.05) * 900} L ${CANDLE.x + Math.cos(a + 0.05) * 900} ${CANDLE.y + Math.sin(a + 0.05) * 900} Z`}
          fill="#FFD9A0" opacity={0.035 * candle * fl} />; })}
      <rect x={CANDLE.x - 12} y={CANDLE.y + 10} width={24} height={60} rx={4} fill="#EDE6D6" />
      <path d={`M ${CANDLE.x - 12} ${CANDLE.y + 20} q 4 14 0 26`} stroke="#D8CFB8" strokeWidth={4} fill="none" />
      <g filter="url(#dbGlow)">
        <path d={`M ${CANDLE.x} ${CANDLE.y + 10} Q ${CANDLE.x - 9 + Math.sin(frame / 2) * 3} ${CANDLE.y - 14} ${CANDLE.x} ${CANDLE.y - 34 - Math.sin(frame / 3) * 5} Q ${CANDLE.x + 9} ${CANDLE.y - 14} ${CANDLE.x} ${CANDLE.y + 10}`} fill="#FFB45A" opacity={candle} />
        <path d={`M ${CANDLE.x} ${CANDLE.y + 6} Q ${CANDLE.x - 4} ${CANDLE.y - 6} ${CANDLE.x} ${CANDLE.y - 16} Q ${CANDLE.x + 4} ${CANDLE.y - 6} ${CANDLE.x} ${CANDLE.y + 6}`} fill="#FFF3D6" opacity={candle} />
      </g>
      {/* пыль в свете */}
      {Array.from({ length: 46 }, (_, i) => {
        const px = CANDLE.x - 600 + ((random(`dx${i}`) * 1200 + frame * (0.2 + random(`dv${i}`) * 0.5)) % 1200);
        const py = 500 + ((random(`dy${i}`) * 1000 - frame * (0.15 + random(`dw${i}`) * 0.3) + 4000) % 1000);
        const near = Math.max(0, 1 - Math.hypot(px - CANDLE.x, py - CANDLE.y) / 700);
        return <circle key={i} cx={px} cy={py} r={1.6 + random(`dr${i}`) * 2} fill="#FFE3B8" opacity={(0.15 + 0.7 * near) * candle} />;
      })}
      {/* туман у пола */}
      {[0, 1, 2].map((i) => <ellipse key={i} cx={((frame * (0.6 + i * 0.3) + i * 500) % 1800) - 400} cy={1500 + i * 40} rx={520} ry={70} fill="#9AA6BA" opacity={0.05} filter="url(#dbBlur14)" />)}
    </g>
  );
};

/* ---------- Люди ---------- */
export const STRANGER: Look = { ...LOOKS.petrov, earBandage: true };
export const ANYA: Look = LOOKS.kidB;
export const ME: Look = ARTYOM;
export const sitPose = (frame: number, ex: Partial<HeroPose> = {}): HeroPose => ({
  ...NEUTRAL, y: NEUTRAL.y + 70, torso: 14 + Math.sin(frame / 22) * 2, head: 4 + Math.sin(frame / 37) * 3,
  legL: { hip: -95, knee: 120, foot: 0 }, legR: { hip: -85, knee: 115, foot: 0 },
  armL: { sh: -60 + Math.sin(frame / 22) * 2, el: -70, wr: 0 }, armR: { sh: -55, el: -75, wr: 0 },
  expr: { brow: 0.3, browTilt: 0.8, mouth: "flat", blink: frame % 110 < 3 ? 1 : 0 }, ...ex,
});
export const walkPose = (frame: number): HeroPose => ({ ...heroGait(frame, WALK, { expr: { brow: 0.3, browTilt: 0.8, mouth: "flat", blink: 0 } }), x: 0, torso: 10 });
export const Person: React.FC<{ x: number; y: number; s: number; look: Look; pose: HeroPose; flip?: boolean; lie?: boolean; tremble?: number; frame?: number }> = ({ x, y, s, look, pose, flip, lie, tremble = 0, frame = 0 }) => {
  const tr = tremble ? Math.sin(frame * 2.3) * 2.5 * tremble : 0;
  return (
    <g transform={`translate(${x + tr} ${y}) ${lie ? "rotate(-90)" : ""} scale(${flip ? -s : s} ${s})`}>
      {!lie && <ellipse cx={0} cy={2} rx={50} ry={9} fill="#000" opacity={0.5} />}
      <Hero pose={pose} look={look} />
    </g>
  );
};

/* ---------- Снаружи: библиотека-крепость, туман, бродят твари ---------- */
export const Fortress: React.FC<{ frame: number; t: number }> = ({ frame, t }) => (
  <g>
    <linearGradient id="ftSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#05070B" /><stop offset="1" stopColor="#141A24" /></linearGradient>
    <rect x={-700} y={-300} width={2600} height={2600} fill="url(#ftSky)" />
    {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={random(`fs${i}`) * 1080} cy={random(`fy${i}`) * 520} r={1.4} fill="#9AA6BA" opacity={0.3 + 0.3 * Math.sin(frame / 20 + i)} />)}
    <circle cx={860} cy={260} r={70} fill="#C9D2E0" opacity={0.18} filter="url(#dbBlur6)" />
    {/* мёртвый город на заднем плане */}
    {[[-60, 700, 180], [130, 620, 150], [820, 660, 170], [990, 590, 160]].map(([x, top, w], i) => (
      <g key={i}><rect x={x} y={top} width={w} height={1300 - top} fill="#0D1118" />
        {Array.from({ length: 10 }, (_, r) => Array.from({ length: 3 }, (_, c) => <rect key={`${r}${c}`} x={x + 20 + c * (w / 3.4)} y={top + 30 + r * 55} width={20} height={26} fill="#05070B" />))}</g>
    ))}
    <rect x={-700} y={1300} width={2600} height={700} fill="#0C0F14" />
    {/* здание: толстые стены, без окон */}
    <rect x={250} y={540} width={580} height={760} fill="#1E232C" stroke="#2E3440" strokeWidth={10} />
    <rect x={250} y={540} width={580} height={760} filter="url(#dbNoise)" opacity={0.3} />
    {Array.from({ length: 14 }, (_, r) => <line key={r} x1={250} x2={830} y1={590 + r * 50} y2={590 + r * 50} stroke="#171B22" strokeWidth={3} />)}
    <rect x={300} y={600} width={480} height={700} fill="#090B0F" />
    <rect x={240} y={480} width={600} height={74} fill="#2E3440" />
    <text x={540} y={532} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={44} fill="#5A6578">БИБЛИОТЕКА</text>
    <circle cx={540} cy={1230} r={140} fill="#FFCF8A" opacity={0.16} filter="url(#dbBlur14)" />
    <text x={540} y={1060} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={30} fill="#9AA6BA">стены 60 см · окон нет</text>
    {/* туман */}
    {[0, 1, 2, 3].map((i) => <ellipse key={i} cx={((frame * (0.8 + i * 0.25) + i * 420) % 2000) - 500} cy={1300 + (i % 2) * 30} rx={600} ry={90} fill="#9AA6BA" opacity={0.08} filter="url(#dbBlur14)" />)}
    {/* твари бродят */}
    <Creature x={60 + Math.sin(t * 0.25) * 60} y={1330} s={0.52} frame={frame} step={(t * 0.5) % 1} turn={Math.sin(t * 0.7)} boil={false} />
    <Creature x={1010 + Math.sin(t * 0.3 + 2) * 50} y={1310} s={0.42} frame={frame + 40} step={(t * 0.45 + 0.3) % 1} turn={-0.6} flip boil={false} />
  </g>
);

/* ---------- Кран и труба ---------- */
export const Faucet: React.FC<{ frame: number; t: number; hum: number; drink: number }> = ({ frame, t, hum, drink }) => {
  const vib = hum ? Math.sin(frame * 3.3) * 2 : 0;
  return (
    <g>
      <rect x={-700} y={-300} width={2600} height={2600} fill="#0E1116" />
      <rect x={-700} y={-300} width={2600} height={2600} filter="url(#dbNoise)" opacity={0.15} />
      {/* кафель */}
      {Array.from({ length: 12 }, (_, r) => Array.from({ length: 8 }, (_, c) => <rect key={`${r}${c}`} x={c * 140} y={240 + r * 100} width={136} height={96} fill="#141A22" stroke="#0A0D12" strokeWidth={4} />))}
      <g transform={`translate(${vib} 0)`}>
        <rect x={120} y={300} width={44} height={1100} fill="#4A525C" /><rect x={126} y={300} width={8} height={1100} fill="#8A94A0" opacity={0.4} />
        <rect x={120} y={700} width={420} height={44} fill="#4A525C" /><rect x={120} y={706} width={420} height={8} fill="#8A94A0" opacity={0.4} />
        <path d="M 540 722 L 540 820 Q 540 862 584 862 L 644 862" stroke="#7E8896" strokeWidth={38} fill="none" strokeLinecap="round" />
        <rect x={496} y={676} width={88} height={48} rx={12} fill="#9AA3AE" />
      </g>
      {/* капля */}
      <ellipse cx={644} cy={890 + ((frame * 6) % 120)} rx={7} ry={11} fill="#9CC2FF" opacity={0.7} />
      <rect x={360} y={1000} width={520} height={130} rx={24} fill="#2B3241" />
      <g opacity={0.95}><circle cx={600} cy={800} r={190} fill="none" stroke="#FF3B30" strokeWidth={20} filter="url(#dbGlow)" /><line x1={466} y1={934} x2={734} y2={666} stroke="#FF3B30" strokeWidth={20} /></g>
      {hum > 0 && <Rings x={142} y={722} db={60} age={t % 1.6} />}
      <g transform={`translate(840 ${1380 - 140 * drink}) rotate(${-55 * drink})`}>
        <rect x={-42} y={-210} width={84} height={210} rx={22} fill="#5AA9FF" opacity={0.3} stroke="#9CC2FF" strokeWidth={4} />
        <rect x={-38} y={-150 + 60 * drink} width={76} height={146 - 60 * drink} rx={18} fill="#5AA9FF" opacity={0.35} />
        <rect x={-18} y={-250} width={36} height={44} rx={6} fill="#2E6FB0" />
      </g>
    </g>
  );
};

/* ---------- Карман: экран светится сквозь ткань ---------- */
export const Pocket: React.FC<{ frame: number; on: number; time: string; ring: number }> = ({ frame, on, time, ring }) => {
  const sh = ring > 0 ? Math.sin(frame * 2.9) * 6 : 0;
  return (
    <g>
      <rect x={-700} y={-300} width={2600} height={2600} fill="#1E2A22" />
      {Array.from({ length: 60 }, (_, i) => <line key={i} x1={-200} y1={i * 36} x2={1300} y2={i * 36 + 30} stroke="#18221C" strokeWidth={8} />)}
      <rect x={-700} y={-300} width={2600} height={2600} filter="url(#dbNoise)" opacity={0.25} />
      <path d="M 210 520 L 870 520 L 910 1520 L 170 1520 Z" fill="#26342A" stroke="#121A14" strokeWidth={10} />
      <path d="M 210 520 Q 540 610 870 520" stroke="#121A14" strokeWidth={12} fill="none" />
      {Array.from({ length: 30 }, (_, i) => <line key={i} x1={210 + i * 22} y1={530} x2={210 + i * 22} y2={540} stroke="#3A4A3E" strokeWidth={3} />)}
      <g transform={`translate(${540 + sh} 1010)`}>
        <rect x={-190} y={-340} width={380} height={680} rx={46} fill="#E6F0FF" opacity={0.1 + 0.6 * on} filter="url(#dbBlur14)" />
        <text x={0} y={-60} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={130} fill="#FFFFFF" opacity={0.25 + 0.6 * on} style={{ filter: "blur(2px)" }}>{time}</text>
        <text x={0} y={60} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={48} fill="#FFFFFF" opacity={0.2 + 0.5 * on} style={{ filter: "blur(1.5px)" }}>⏰ БУДИЛЬНИК</text>
        <text x={0} y={130} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={40} fill="#FFFFFF" opacity={0.2 + 0.4 * on} style={{ filter: "blur(1.5px)" }}>🔕 без звука</text>
      </g>
    </g>
  );
};

/* ---------- Передний план: размытые силуэты (глубина) ---------- */
export const Foreground: React.FC<{ frame: number }> = ({ frame }) => (
  <g filter="url(#dbBlur14)" opacity={0.95}>
    <path d={`M -40 1920 L -40 1640 Q 60 1600 160 1660 L 220 1920 Z`} fill="#030405" />
    <rect x={-40} y={1560} width={180} height={60} rx={8} fill="#060708" transform={`rotate(-6 50 1590)`} />
    <path d={`M 1120 1920 L 1120 1600 Q 1000 1580 900 1700 L 860 1920 Z`} fill="#030405" />
    <ellipse cx={1000 + Math.sin(frame / 50) * 4} cy={1560} rx={120} ry={40} fill="#060708" />
  </g>
);
