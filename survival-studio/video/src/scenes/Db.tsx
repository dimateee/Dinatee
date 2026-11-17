import React from "react";
import { random } from "remotion";
import { ARTYOM, Hero, HeroPose, Look, NEUTRAL } from "../rig/Hero";
import { heroGait, WALK } from "../rig/gait";
import { LOOKS } from "./Podval";

/*
 * «40 дБ» — мир серо-синий, цветной только ЗВУК: кольца с подписью децибел. Твари слепые, с веером перепонок вместо глаз.
 */
export const THRESH = 40;
export const ringColor = (db: number) => (db >= THRESH ? "#FF3B30" : "#F2C94C");

/* ---------- Шумомер (экранный HUD) ---------- */
export const DbMeter: React.FC<{ db: number; frame: number; dist?: number; time?: string }> = ({ db, frame, dist, time }) => {
  const W = 760, X = 160, Y = 170;
  const k = Math.min(1, db / 100), hot = db >= THRESH;
  const jitter = db > 5 ? Math.sin(frame * 1.7) * 1.2 : 0;
  return (
    <div style={{ position: "absolute", left: X, top: Y, width: W }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "JetBrains Mono", fontWeight: 700 }}>
        <span style={{ fontSize: 30, color: "#9AA6BA" }}>{time ?? ""}</span>
        <span style={{ fontSize: 76, color: hot ? "#FF3B30" : "#E6ECF5", textShadow: hot ? "0 0 24px rgba(255,59,48,.8)" : "none" }}>{Math.round(db + jitter)} дБ</span>
        <span style={{ fontSize: 30, color: dist !== undefined && dist < 10 ? "#FF6B5E" : "#9AA6BA" }}>{dist !== undefined ? `ДО НИХ ${Math.round(dist)} м` : ""}</span>
      </div>
      <div style={{ position: "relative", height: 26, marginTop: 8, borderRadius: 13, background: "#1A1F28", overflow: "hidden", border: "2px solid #2B3241" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${100 * k}%`, background: hot ? "linear-gradient(90deg,#F2C94C,#FF3B30)" : "#F2C94C" }} />
        <div style={{ position: "absolute", left: `${THRESH}%`, top: -4, bottom: -4, width: 5, background: "#FF3B30" }} />
      </div>
      <div style={{ position: "relative", height: 34, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 24, color: "#FF6B5E" }}>
        <span style={{ position: "absolute", left: `${THRESH}%`, transform: "translateX(-50%)", top: 6, whiteSpace: "nowrap" }}>▲ 40 — СЛЫШАТ</span>
      </div>
    </div>
  );
};

/* ---------- Звуковые кольца (в мировых координатах) ---------- */
export const Rings: React.FC<{ x: number; y: number; db: number; age: number; label?: boolean; scale?: number }> = ({ x, y, db, age, label = true, scale = 1 }) => {
  if (age < 0) return null;
  const c = ringColor(db), n = db >= THRESH ? 4 : 2, life = 1.6;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const p = ((age / life + i / n) % 1);
        const r = (20 + p * (db * 4.5)) * scale;
        return <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={c} strokeWidth={(db >= THRESH ? 7 : 4) * scale} opacity={(1 - p) * 0.9} />;
      })}
      {label && <text x={x} y={y - (36 + Math.min(1, age * 3) * 40) * scale} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={40 * scale}
        fill={c} stroke="#000" strokeWidth={4 * scale} paintOrder="stroke" opacity={Math.min(1, age * 4)}>{Math.round(db)} дБ</text>}
    </g>
  );
};

/* ---------- Тварь: слепая, вытянутая, веер перепонок вместо лица ---------- */
export const Creature: React.FC<{ x: number; y: number; s: number; frame: number; turn?: number; flare?: number; step?: number; dark?: boolean }> = ({ x, y, s, frame, turn = 0, flare = 0, step = 0, dark = false }) => {
  const breathe = Math.sin(frame / 18) * 4;
  const sw = Math.sin(step * Math.PI * 2);
  const body = dark ? "#020203" : "#14171C", rim = "#7F95B8";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* ноги */}
      <path d={`M -30 -360 L ${-50 + 30 * sw} -160 L ${-40 + 40 * sw} 0`} stroke={body} strokeWidth={26} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M 30 -360 L ${50 - 30 * sw} -160 L ${40 - 40 * sw} 0`} stroke={body} strokeWidth={26} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* тело, сутулое */}
      <path d={`M -60 -360 Q -80 -560 -20 -660 Q 40 -700 70 -640 Q 90 -520 60 -360 Z`} fill={body} stroke={rim} strokeWidth={dark ? 0 : 3} strokeOpacity={0.5} />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M ${-40 + i * 4} ${-420 - i * 45} Q 10 ${-430 - i * 45} 50 ${-415 - i * 45}`} stroke="#2A2F38" strokeWidth={4} fill="none" opacity={dark ? 0 : 0.8} />)}
      {/* руки до колен, длинные пальцы */}
      <path d={`M -40 -620 Q -110 -480 -100 ${-260 + breathe} L -120 ${-200 + breathe} M -100 ${-260 + breathe} L -95 ${-190 + breathe} M -100 ${-260 + breathe} L -78 ${-200 + breathe}`}
        stroke={body} strokeWidth={18} fill="none" strokeLinecap="round" />
      <path d={`M 60 -620 Q 130 -480 120 ${-260 - breathe} L 140 ${-200 - breathe} M 120 ${-260 - breathe} L 116 ${-190 - breathe} M 120 ${-260 - breathe} L 98 ${-200 - breathe}`}
        stroke={body} strokeWidth={18} fill="none" strokeLinecap="round" />
      {/* голова поворачивается: turn -1..1 */}
      <g transform={`translate(${20 + 30 * turn} -700) rotate(${turn * 28})`}>
        <ellipse cx={0} cy={0} rx={46} ry={64} fill={body} stroke={rim} strokeWidth={dark ? 0 : 3} strokeOpacity={0.6} />
        {/* перепонки веером */}
        {Array.from({ length: 7 }, (_, i) => {
          const a = -70 + i * 23, len = 70 + 70 * flare + (i % 2) * 18;
          return <path key={i} transform={`rotate(${a + (flare > 0 ? Math.sin(frame / 2 + i) * 6 * flare : 0)})`} d={`M -10 -30 Q 0 ${-30 - len} 10 -30 Z`}
            fill={flare > 0.3 ? "#5A1E22" : "#1E2228"} stroke={flare > 0.3 ? "#FF6B5E" : rim} strokeWidth={3} opacity={0.95} />;
        })}
        {/* рот-щель */}
        <path d="M -20 30 Q 0 40 20 30" stroke="#000" strokeWidth={5} fill="none" />
      </g>
    </g>
  );
};

/* ---------- Библиотека изнутри ---------- */
export const Library: React.FC<{ frame: number; candle?: number; children?: React.ReactNode }> = ({ frame, candle = 1, children }) => {
  const fl = 0.85 + 0.1 * Math.sin(frame / 3) + 0.05 * Math.sin(frame * 1.3);
  return (
    <g>
      <defs>
        <radialGradient id="lbC"><stop offset="0" stopColor="#FFCF8A" stopOpacity={0.5} /><stop offset="1" stopColor="#FFCF8A" stopOpacity={0} /></radialGradient>
        <linearGradient id="lbW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B0E14" /><stop offset="1" stopColor="#151A22" /></linearGradient>
      </defs>
      <rect x={-600} y={-200} width={2400} height={1800} fill="url(#lbW)" />
      {/* стеллажи */}
      {[-420, -60, 700, 1060].map((x, j) => (
        <g key={j}>
          <rect x={x} y={500} width={320} height={950} fill="#1A1612" stroke="#0A0806" strokeWidth={8} />
          {Array.from({ length: 6 }, (_, r) => (
            <g key={r}>
              <rect x={x} y={560 + r * 150} width={320} height={12} fill="#0E0B08" />
              {Array.from({ length: 11 }, (_, b) => <rect key={b} x={x + 10 + b * 28} y={560 + r * 150 - 100 + ((b * 7 + r * 3) % 4) * 8} width={22} height={100 - ((b * 7 + r * 3) % 4) * 8}
                fill={["#2A3242", "#3A2A26", "#2A3A2E", "#3A3428"][(b + r + j) % 4]} />)}
            </g>
          ))}
        </g>
      ))}
      {/* табличка «ТИШИНА» */}
      <g transform="translate(540 600)">
        <rect x={-150} y={-46} width={300} height={92} rx={8} fill="#2B2620" stroke="#5A4E3A" strokeWidth={5} />
        <text x={0} y={18} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={52} fill="#BFB39A">ТИШИНА</text>
      </g>
      {/* пол и ковровая дорожка */}
      <rect x={-600} y={1450} width={2400} height={400} fill="#100D0A" />
      <path d="M 120 1450 L 960 1450 L 1180 1800 L -100 1800 Z" fill="#4A1E1E" />
      <path d="M 150 1462 L 930 1462 M 160 1480 L 920 1480" stroke="#7A3A2A" strokeWidth={6} />
      {/* свеча */}
      <circle cx={540} cy={1380} r={520} fill="url(#lbC)" opacity={candle * fl} />
      <rect x={530} y={1390} width={20} height={60} rx={4} fill="#EDE6D6" />
      <path d={`M 540 1390 Q ${532 + Math.sin(frame / 2) * 3} 1366 540 ${1352 - Math.sin(frame / 3) * 4} Q 548 1366 540 1390`} fill="#FFB45A" opacity={candle} />
      {children}
    </g>
  );
};

/* ---------- Люди ---------- */
export const STRANGER: Look = { ...LOOKS.petrov, earBandage: true };
export const ANYA: Look = LOOKS.kidB;
export const ME: Look = ARTYOM;
export const sitPose = (frame: number, ex: Partial<HeroPose> = {}): HeroPose => ({
  ...NEUTRAL, y: NEUTRAL.y + 70, torso: 14 + Math.sin(frame / 22) * 1.5, head: 4,
  legL: { hip: -95, knee: 120, foot: 0 }, legR: { hip: -85, knee: 115, foot: 0 },
  armL: { sh: -60, el: -70, wr: 0 }, armR: { sh: -55, el: -75, wr: 0 },
  expr: { brow: 0.3, browTilt: 0.8, mouth: "flat", blink: frame % 110 < 3 ? 1 : 0 }, ...ex,
});
export const walkPose = (frame: number): HeroPose => ({ ...heroGait(frame, WALK, { expr: { brow: 0.3, browTilt: 0.8, mouth: "flat", blink: 0 } }), x: 0 });
export const Person: React.FC<{ x: number; y: number; s: number; look: Look; pose: HeroPose; flip?: boolean; lie?: boolean }> = ({ x, y, s, look, pose, flip, lie }) => (
  <g transform={`translate(${x} ${y}) ${lie ? "rotate(-90)" : ""} scale(${flip ? -s : s} ${s})`}>
    {!lie && <ellipse cx={0} cy={2} rx={46} ry={8} fill="#000" opacity={0.4} />}
    <Hero pose={pose} look={look} />
  </g>
);

/* ---------- Снаружи: библиотека в разрезе, улица с тварями ---------- */
export const Fortress: React.FC<{ frame: number; t: number }> = ({ frame, t }) => (
  <g>
    <rect x={-600} y={-200} width={2400} height={2400} fill="#06080C" />
    {Array.from({ length: 50 }, (_, i) => <circle key={i} cx={random(`fs${i}`) * 1080} cy={random(`fy${i}`) * 500} r={1.5} fill="#9AA6BA" opacity={0.4} />)}
    <rect x={-600} y={1300} width={2400} height={700} fill="#0C0F14" />
    {/* здание: толстые стены, без окон */}
    <rect x={240} y={560} width={600} height={740} fill="#1E232C" stroke="#2E3440" strokeWidth={10} />
    <rect x={290} y={610} width={500} height={690} fill="#0A0C10" />
    <rect x={240} y={500} width={600} height={70} fill="#2E3440" />
    <text x={540} y={548} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={44} fill="#5A6578">БИБЛИОТЕКА</text>
    <circle cx={540} cy={1200} r={120} fill="#FFCF8A" opacity={0.18} />
    <text x={540} y={1050} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={30} fill="#9AA6BA">стены 60 см</text>
    {/* твари бродят */}
    {[[-80, 0.5, 0.0], [980, 0.45, 0.4], [1180, 0.4, 0.8]].map(([x0, sc, ph], i) => (
      <Creature key={i} x={(x0 as number) + Math.sin(t * 0.3 + (ph as number) * 6) * 80} y={1300} s={sc as number} frame={frame + i * 40} step={(t * 0.6 + (ph as number)) % 1} turn={Math.sin(t * 0.5 + i)} />
    ))}
  </g>
);

/* ---------- Кран и труба ---------- */
export const Faucet: React.FC<{ frame: number; t: number; hum: number; drink: number }> = ({ frame, t, hum, drink }) => (
  <g>
    <rect x={-600} y={-200} width={2400} height={2400} fill="#0E1116" />
    {/* труба по стене */}
    <rect x={120} y={300} width={40} height={1100} fill="#3A404A" /><rect x={120} y={700} width={420} height={40} fill="#3A404A" />
    <path d="M 540 720 L 540 820 Q 540 860 580 860 L 640 860" stroke="#6E7A8E" strokeWidth={36} fill="none" strokeLinecap="round" />
    <rect x={500} y={680} width={80} height={44} rx={10} fill="#8A929E" />
    <rect x={360} y={1000} width={500} height={120} rx={20} fill="#2B3241" />
    {/* перечёркнуто */}
    <g opacity={0.95}><circle cx={600} cy={800} r={180} fill="none" stroke="#FF3B30" strokeWidth={18} /><line x1={473} y1={927} x2={727} y2={673} stroke="#FF3B30" strokeWidth={18} /></g>
    {hum > 0 && <Rings x={140} y={720} db={60} age={t % 1.6} />}
    {/* бутылка */}
    <g transform={`translate(820 ${1360 - 120 * drink}) rotate(${-50 * drink})`}>
      <rect x={-40} y={-200} width={80} height={200} rx={20} fill="#5AA9FF" opacity={0.35} stroke="#9CC2FF" strokeWidth={4} />
      <rect x={-18} y={-240} width={36} height={44} rx={6} fill="#2E6FB0" />
    </g>
  </g>
);

/* ---------- Карман: экран светится сквозь ткань ---------- */
export const Pocket: React.FC<{ frame: number; on: number; time: string; ring: number }> = ({ frame, on, time, ring }) => {
  const sh = ring > 0 ? Math.sin(frame * 2.9) * 6 : 0;
  return (
    <g>
      <rect x={-600} y={-200} width={2400} height={2400} fill="#1E2A22" />
      {Array.from({ length: 40 }, (_, i) => <line key={i} x1={-100} y1={i * 50} x2={1200} y2={i * 50 + 30} stroke="#18221C" strokeWidth={10} />)}
      <path d="M 220 520 L 860 520 L 900 1500 L 180 1500 Z" fill="#26342A" stroke="#121A14" strokeWidth={10} />
      <path d="M 220 520 Q 540 600 860 520" stroke="#121A14" strokeWidth={10} fill="none" />
      <g transform={`translate(${540 + sh} 1000)`}>
        <rect x={-180} y={-330} width={360} height={660} rx={46} fill="#E6F0FF" opacity={0.12 + 0.6 * on} style={{ filter: "blur(18px)" }} />
        <text x={0} y={-60} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={130} fill="#FFFFFF" opacity={0.25 + 0.6 * on} style={{ filter: "blur(2px)" }}>{time}</text>
        <text x={0} y={60} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={48} fill="#FFFFFF" opacity={0.2 + 0.5 * on} style={{ filter: "blur(1.5px)" }}>⏰ БУДИЛЬНИК</text>
        <text x={0} y={130} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={700} fontSize={40} fill="#FFFFFF" opacity={0.2 + 0.4 * on} style={{ filter: "blur(1.5px)" }}>🔕 без звука</text>
      </g>
    </g>
  );
};
