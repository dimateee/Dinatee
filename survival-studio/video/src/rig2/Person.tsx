import React from "react";
import { shade } from "../rig/shared";

/*
 * Серия «66 ДНЕЙ»: риг человека в стиле «плоский вектор без обводки».
 * Голова ≈ 1/5 роста, корпус — узкий прямоугольник, руки и ноги — трубки одной толщины, кисти — варежки.
 * Объём — одна тень (тон темнее) и иногда один блик. Начало координат — таз; y вниз; лицом вправо.
 *
 *   root(hip) ── torso(rot) ── neck ── head(rot): глаз, бровь, рот (отдельно), головной убор
 *            │              └─ shoulderN/F(rot) ── elbow(rot) ── mitten(rot) [+ предмет в руке]
 *            └─ hipN/F(rot) ── knee(rot) ── foot(абсолютный угол)
 */
export const P = {
  thigh: 66, shin: 62, ankle: 9, limb: 17,
  torsoH: 112, torsoW: 40, shoulder: { x: 2, y: -100 },
  neck: { x: 4, y: -112 }, headR: 33, headC: { x: 6, y: -34 },
  upper: 50, fore: 46, mitten: 10,
};
export const STAND_Y = -(P.thigh + P.shin + P.ankle) + 3;

export type Leg2 = { hip: number; knee: number; foot: number };
export type Arm2 = { sh: number; el: number; wr: number };
export type Face = { brow: number; tilt: number; mouth: "line" | "smile" | "o" | "down"; blink: number };
export type Hold = null | "leash" | "bucket" | "pen" | "phone" | "binoculars" | "rope";
export type Pose2 = {
  x: number; y: number; torso: number; head: number;
  armN: Arm2; armF: Arm2; legN: Leg2; legF: Leg2; face: Face; holdN?: Hold; holdF?: Hold;
};
export type Outfit = {
  skin: string; top: string; topShade: string; pants: string; shoes: string;
  hat: "cap" | "knit" | "none"; hatColor: string; beard?: string; scarf?: string; detail?: string; hood?: boolean;
};

export const ARTYOM_AUTUMN: Outfit = {
  skin: "#D9A786", top: "#B8582F", topShade: "#8F4224", pants: "#3F4A55", shoes: "#D8D2C2",
  hat: "cap", hatColor: "#4A4F3A", detail: "#5E9E6E", hood: true, // своя деталь — зелёный браслет
};
export const ARTYOM_WINTER: Outfit = {
  ...ARTYOM_AUTUMN, top: "#A9512C", topShade: "#7E3B20", hat: "knit", hatColor: "#C9A24E", pants: "#343D47",
};
export const NEIGHBOR: Outfit = {
  skin: "#CF9E7E", top: "#5B6B4C", topShade: "#46543A", pants: "#55504A", shoes: "#3B2D28",
  hat: "none", hatColor: "#000", beard: "#B9B2A6",
};

export const STAND: Pose2 = {
  x: 0, y: STAND_Y, torso: 1, head: 0,
  armN: { sh: 6, el: -10, wr: 0 }, armF: { sh: -5, el: -8, wr: 0 },
  legN: { hip: -3, knee: 5, foot: 0 }, legF: { hip: 4, knee: 3, foot: 0 },
  face: { brow: 0, tilt: 0, mouth: "line", blink: 0 },
};

const Tube: React.FC<{ len: number; w?: number; c: string }> = ({ len, w = P.limb, c }) => (
  <line x1={0} y1={0} x2={0} y2={len} stroke={c} strokeWidth={w} strokeLinecap="round" />
);

const Shoe: React.FC<{ c: string; far?: boolean }> = ({ c, far }) => (
  <path d="M -9 -4 Q -11 7 -6 8 L 22 8 Q 27 7 25 2 Q 20 -3 8 -4 Z" fill={far ? shade(c, -0.2) : c} />
);

const Item: React.FC<{ kind: Hold }> = ({ kind }) => {
  switch (kind) {
    case "bucket": return (
      <g transform="translate(0 6)">
        <path d="M -14 10 L 14 10 L 11 38 L -11 38 Z" fill="#7F8275" /><path d="M -14 10 L 14 10 L 13 16 L -13 16 Z" fill="#9A9D90" />
        <path d="M -13 11 Q 0 -6 13 11" stroke="#3B2D28" strokeWidth={2} fill="none" />
      </g>);
    case "pen": return <path d="M 2 4 L 16 20" stroke="#3B2D28" strokeWidth={3} strokeLinecap="round" />;
    case "phone": return <rect x={-6} y={-4} width={12} height={21} rx={2.5} fill="#1D2835" transform="rotate(-18)" />;
    case "binoculars": return <g transform="translate(-2 -6)"><rect x={0} y={-8} width={18} height={10} rx={4} fill="#292628" /><rect x={0} y={4} width={18} height={10} rx={4} fill="#292628" /></g>;
    case "leash": return <path d="M 0 6 q 34 30 80 26" stroke="#C1622D" strokeWidth={3} fill="none" strokeLinecap="round" />;
    case "rope": return <path d="M 0 6 q -40 20 -90 14" stroke="#B99B65" strokeWidth={3} fill="none" strokeLinecap="round" />;
    default: return null;
  }
};

const Arm: React.FC<{ a: Arm2; o: Outfit; far?: boolean; hold?: Hold; band?: boolean }> = ({ a, o, far, hold, band }) => {
  const c = far ? o.topShade : o.top;
  return (
    <g transform={`rotate(${a.sh})`}>
      <Tube len={P.upper} c={c} />
      <g transform={`translate(0 ${P.upper}) rotate(${a.el})`}>
        <Tube len={P.fore} c={c} />
        <g transform={`translate(0 ${P.fore}) rotate(${a.wr})`}>
          {band && o.detail && <rect x={-9} y={-5} width={18} height={6} rx={2} fill={o.detail} />}
          <ellipse cx={1} cy={5} rx={P.mitten} ry={P.mitten * 1.1} fill={far ? shade(o.skin, -0.15) : o.skin} />
          <Item kind={hold ?? null} />
        </g>
      </g>
    </g>
  );
};

const Leg: React.FC<{ l: Leg2; o: Outfit; far?: boolean }> = ({ l, o, far }) => {
  const c = far ? shade(o.pants, -0.22) : o.pants;
  return (
    <g transform={`rotate(${l.hip})`}>
      <Tube len={P.thigh} c={c} w={P.limb + 2} />
      <g transform={`translate(0 ${P.thigh}) rotate(${l.knee})`}>
        <Tube len={P.shin} c={c} w={P.limb + 1} />
        <g transform={`translate(0 ${P.shin}) rotate(${-(l.hip + l.knee) + l.foot})`}><Shoe c={o.shoes} far={far} /></g>
      </g>
    </g>
  );
};

export const Head2: React.FC<{ f: Face; o: Outfit }> = ({ f, o }) => {
  const R = P.headR, lid = Math.max(0.12, 1 - f.blink);
  const by = -10 - f.brow * 3;
  return (
    <g>
      <circle r={R} fill={o.skin} />
      <path d={`M ${-R * 0.25} ${-R * 0.97} A ${R} ${R} 0 0 0 ${-R * 0.25} ${R * 0.97} Q ${-R} 0 ${-R * 0.25} ${-R * 0.97}`} fill={shade(o.skin, -0.12)} />
      {o.beard && <path d={`M 2 10 Q 10 ${R + 8} ${R - 2} 8 L ${R - 1} 4 Q 16 16 2 10 Z`} fill={o.beard} />}
      <ellipse cx={18} cy={-2} rx={2.8} ry={3.4 * lid} fill="#292628" />
      <path d={`M 12 ${by + f.tilt * 2} L 24 ${by - f.tilt * 2}`} stroke="#292628" strokeWidth={3} strokeLinecap="round" />
      {f.mouth === "o" ? <ellipse cx={22} cy={14} rx={3} ry={4} fill="#292628" />
        : f.mouth === "smile" ? <path d="M 17 13 Q 22 17 27 12" stroke="#292628" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        : f.mouth === "down" ? <path d="M 17 16 Q 22 12 27 15" stroke="#292628" strokeWidth={2.6} fill="none" strokeLinecap="round" />
        : <path d="M 18 14 L 27 13" stroke="#292628" strokeWidth={2.6} strokeLinecap="round" />}
      {o.hat === "cap" && <>
        <path d={`M ${-R} -4 Q ${-R} ${-R - 4} 2 ${-R - 4} Q ${R} ${-R - 3} ${R} -8 Z`} fill={o.hatColor} />
        <path d={`M ${R - 10} -9 Q ${R + 10} -12 ${R + 18} -6 Q ${R + 6} -3 ${R - 8} -5 Z`} fill={shade(o.hatColor, -0.25)} />
      </>}
      {o.hat === "knit" && <>
        <path d={`M ${-R - 1} -2 Q ${-R} ${-R - 10} 0 ${-R - 12} Q ${R} ${-R - 10} ${R + 1} -4 Z`} fill={o.hatColor} />
        <rect x={-R - 2} y={-9} width={2 * R + 4} height={9} rx={4} fill={shade(o.hatColor, -0.18)} />
        <circle cx={-2} cy={-R - 14} r={7} fill={shade(o.hatColor, 0.15)} />
      </>}
    </g>
  );
};

export const Person: React.FC<{ pose: Pose2; o: Outfit }> = ({ pose: p, o }) => (
  <g transform={`translate(${p.x} ${p.y})`}>
    <g transform={`rotate(${p.torso})`}><g transform={`translate(${P.shoulder.x - 4} ${P.shoulder.y + 2})`}><Arm a={p.armF} o={o} far hold={p.holdF} /></g></g>
    <g transform="translate(-3 0)"><Leg l={p.legF} o={o} far /></g>
    <g transform={`rotate(${p.torso})`}>
      {o.hood && <path d={`M -18 ${-P.torsoH + 2} Q -30 ${-P.torsoH - 16} -10 ${-P.torsoH - 14} L 0 ${-P.torsoH + 4} Z`} fill={o.topShade} />}
      <rect x={-P.torsoW / 2} y={-P.torsoH} width={P.torsoW} height={P.torsoH + 8} rx={10} fill={o.top} />
      <rect x={-P.torsoW / 2} y={-P.torsoH} width={P.torsoW * 0.32} height={P.torsoH + 8} rx={8} fill={o.topShade} />
      <g transform={`translate(${P.neck.x} ${P.neck.y}) rotate(${p.head}) translate(${P.headC.x} ${P.headC.y})`}><Head2 f={p.face} o={o} /></g>
    </g>
    <g transform="translate(3 0)"><Leg l={p.legN} o={o} /></g>
    <g transform={`rotate(${p.torso})`}><g transform={`translate(${P.shoulder.x + 4} ${P.shoulder.y + 4})`}><Arm a={p.armN} o={o} hold={p.holdN} band /></g></g>
  </g>
);
