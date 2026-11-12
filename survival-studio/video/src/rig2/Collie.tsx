import React from "react";
import { DD, DogLeg, DogPose } from "../rig/Dog";

/*
 * Луна в стиле серии «66 ДНЕЙ»: реалистичные пропорции бордер-колли, плоская заливка без обводки,
 * одна тень и один блик. Ошейник и поводок — отдельные слои. Позы — те же генераторы, что у rig/Dog
 * (dogWalk/dogSit/dogLie/dogLife): точки крепления DD совпадают.
 */
export const COL = { black: "#262427", top: "#3A3739", white: "#ECE6DA", whiteSh: "#CFC6B6", nose: "#141214", collar: "#C1622D", tongue: "#B5585A" };

/** Шаг в темпе героя серии (WALK2: 140 px / 24 кадра). Полушаг 35 ≤ досягаемости лап. */
export const DOG_WALK2 = { period: 24, stride: 140, stance: 0.5, lift: 13 };

const Leg: React.FC<{ p: DogLeg; far?: boolean; front?: boolean }> = ({ p, far, front }) => {
  const k = far ? 0.82 : 1;
  const dark = far ? "#1B1A1C" : COL.black;
  return (
    <g transform={`rotate(${p.up})`} opacity={k < 1 ? 0.95 : 1}>
      <line x1={0} y1={0} x2={0} y2={DD.upper} stroke={dark} strokeWidth={front ? 15 : 18} strokeLinecap="round" />
      <g transform={`translate(0 ${DD.upper}) rotate(${p.low})`}>
        <line x1={0} y1={0} x2={0} y2={DD.lower} stroke={far ? COL.whiteSh : COL.white} strokeWidth={10} strokeLinecap="round" />
        <g transform={`translate(0 ${DD.lower}) rotate(${-(p.up + p.low) + p.paw})`}>
          <ellipse cx={5} cy={1} rx={9} ry={5} fill={far ? COL.whiteSh : COL.white} />
        </g>
      </g>
    </g>
  );
};

const Head: React.FC<{ p: DogPose; leash?: boolean }> = ({ p, leash }) => {
  const lid = Math.max(0.1, 1 - p.blink);
  return (
    <g>
      {/* дальнее ухо */}
      <g transform={`translate(-8 -18) rotate(${p.earR - 10})`}><path d="M -7 4 L 2 -22 Q 8 -14 9 4 Z" fill="#1B1A1C" /></g>
      {/* череп и морда (вытянутая, реалистичнее людей) */}
      <path d="M -20 4 Q -22 -20 2 -22 Q 20 -22 26 -8 L 44 -2 Q 50 2 46 8 L 24 14 Q 0 20 -20 4 Z" fill={COL.black} />
      {/* белая проточина и морда */}
      <path d="M 6 -22 Q 12 -10 22 -6 L 44 -2 Q 50 2 46 8 L 24 14 Q 14 10 12 2 Q 6 -10 6 -22 Z" fill={COL.white} />
      <ellipse cx={46} cy={2} rx={5} ry={4} fill={COL.nose} />
      {p.mouth === "open" && <path d="M 30 12 Q 36 22 42 11 Z" fill={COL.tongue} />}
      <ellipse cx={14} cy={-10} rx={3} ry={3.4 * lid} fill="#0E0D0E" />
      <circle cx={15} cy={-11} r={0.9} fill="#FFFFFF" opacity={lid > 0.5 ? 0.8 : 0} />
      {/* ближнее ухо: полустоячее, кончик надломлен */}
      <g transform={`translate(-2 -20) rotate(${p.earL})`}>
        <path d="M -8 4 L 0 -24 Q 9 -18 10 4 Z" fill={COL.black} />
        <path d="M 0 -24 Q 7 -20 8 -12 Q 3 -16 0 -24 Z" fill={COL.top} />
      </g>
      {leash && <path d="M 30 12 q -2 34 -30 54" stroke={COL.collar} strokeWidth={4} fill="none" strokeLinecap="round" />}
    </g>
  );
};

export const Collie: React.FC<{ pose: DogPose; leashInMouth?: boolean; collar?: boolean }> = ({ pose: p, leashInMouth, collar = true }) => (
  <g transform={`translate(${p.x} ${p.y})`}>
    <g transform={`rotate(${p.body})`}>
      <g transform={`translate(${DD.hindAt.x + 6} ${DD.hindAt.y})`}><Leg p={p.HR} far /></g>
      <g transform={`translate(${DD.frontAt.x - 6} ${DD.frontAt.y})`}><Leg p={p.FR} far front /></g>
      {/* хвост: длинный, с очёсом и белым кончиком */}
      <g transform={`translate(${DD.tailAt.x} ${DD.tailAt.y}) rotate(${p.tail})`}>
        <path d="M 4 -6 Q -24 -4 -44 18 Q -52 32 -46 40 Q -36 30 -24 22 Q -8 12 6 6 Z" fill={COL.black} />
        <path d="M -44 18 Q -52 32 -46 40 Q -42 32 -36 25 Z" fill={COL.white} />
      </g>
      {/* корпус: глубокая грудь, подтянутый живот; дыхание — масштаб по вертикали */}
      <g transform={`translate(10 0) scale(1 ${1 + p.breath * 0.03}) translate(-10 0)`}>
        <path d="M -64 -6 Q -60 -30 -30 -30 L 30 -32 Q 66 -34 70 -6 Q 72 22 50 30 Q 20 22 -10 22 Q -40 24 -56 18 Q -68 10 -64 -6 Z" fill={COL.black} />
        <path d="M -60 -14 Q -50 -30 -30 -30 L 30 -32 Q 50 -33 60 -24 Q 20 -24 -60 -14 Z" fill={COL.top} />
        {/* белый воротник и грудь */}
        <path d="M 42 -32 Q 70 -32 72 -6 Q 74 22 52 30 L 40 26 Q 54 6 42 -32 Z" fill={COL.white} />
        {collar && <path d="M 44 -30 Q 50 -12 46 0" stroke={COL.collar} strokeWidth={6} fill="none" strokeLinecap="round" />}
      </g>
      <g transform={`translate(${DD.neck.x} ${DD.neck.y - (p.sit ?? 0) * 6}) rotate(${p.head}) translate(${DD.headC.x} ${DD.headC.y})`}>
        <Head p={p} leash={leashInMouth ?? p.mouth === "leash"} />
      </g>
      <g transform={`translate(${DD.hindAt.x} ${DD.hindAt.y})`}><Leg p={p.HL} /></g>
      <g transform={`translate(${DD.frontAt.x} ${DD.frontAt.y})`}><Leg p={p.FL} front /></g>
    </g>
  </g>
);
