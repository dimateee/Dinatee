import React from "react";
import { DOG } from "../style/palette";
import { Capsule, shade } from "./shared";
import { clamp, easeInOut, ik2, lerp, onTwos } from "./geom";

/*
 * Луна — бордер-колли, SVG-риг в профиль (лицом вправо).
 * Начало координат — центр корпуса. y вниз. Холка ~ 100 px над землёй при scale 1
 * (герою ~340 px), т.е. собака примерно по пояс герою.
 *
 *   root ── body(rot, дыхание scaleY) ── neck ── head(rot) ── earL / earR(rot), глаз(blink), рот
 *        │                             └─ tail(rot, wag)
 *        └─ legs: FL / FR (плечо) и HL / HR (таз): upper(rot) ── lower(rot) ── paw
 */

export const DD = {
  frontAt: { x: 46, y: 14 }, hindAt: { x: -46, y: 10 },
  upper: 36, lower: 34, pawH: 6,
  neck: { x: 58, y: -16 }, headC: { x: 22, y: -26 }, headR: 25,
  tailAt: { x: -64, y: -12 },
};

export type DogLeg = { up: number; low: number; paw: number };
export type DogPose = {
  x: number; y: number; body: number; head: number;
  earL: number; earR: number; tail: number; breath: number; blink: number;
  FL: DogLeg; FR: DogLeg; HL: DogLeg; HR: DogLeg;
  mouth: "closed" | "open" | "leash";
  sit?: number; // 0..1 — посадка (задняя часть опускается)
};

const STAND_Y = -(DD.frontAt.y + DD.upper + DD.lower + DD.pawH) + 4;
export const DOG_STAND: DogPose = {
  x: 0, y: STAND_Y, body: 0, head: 0, earL: 0, earR: 0, tail: 0, breath: 0, blink: 0,
  FL: { up: -4, low: 6, paw: 0 }, FR: { up: 4, low: 2, paw: 0 },
  HL: { up: 8, low: -10, paw: 0 }, HR: { up: -2, low: -8, paw: 0 },
  mouth: "closed",
};

const Leg: React.FC<{ p: DogLeg; far?: boolean; sock?: boolean }> = ({ p, far, sock = true }) => {
  const c = far ? shade(DOG.black, 0.12) : DOG.black;
  return (
    <g transform={`rotate(${p.up})`}>
      <Capsule y2={DD.upper} w={17} fill={c} line={DOG.line} />
      <g transform={`translate(0 ${DD.upper}) rotate(${p.low})`}>
        <Capsule y2={DD.lower} w={12} fill={sock ? (far ? DOG.whiteShade : DOG.white) : c} line={DOG.line} />
        <g transform={`translate(0 ${DD.lower}) rotate(${-(p.up + p.low) + p.paw})`}>
          <ellipse cx={5} cy={2} rx={10} ry={6} fill={far ? DOG.whiteShade : DOG.white} stroke={DOG.line} strokeWidth={1.6} />
        </g>
      </g>
    </g>
  );
};

const Head: React.FC<{ p: DogPose }> = ({ p }) => {
  const R = DD.headR;
  const lid = Math.max(0.1, 1 - p.blink);
  return (
    <g>
      {/* дальнее ухо */}
      <g transform={`translate(-10 ${-R + 6}) rotate(${p.earR - 8})`}>
        <path d="M -9 4 L 2 -28 L 11 4 Z" fill={shade(DOG.black, 0.1)} stroke={DOG.line} strokeWidth={1.6} strokeLinejoin="round" />
      </g>
      <circle r={R} fill={DOG.black} stroke={DOG.line} strokeWidth={1.8} />
      {/* морда: белая проточина и нос */}
      <path d={`M 4 ${-R + 2} Q 10 -6 16 2 L 46 6 Q 52 10 46 16 L 14 20 Q 0 16 2 4 Q 0 -10 4 ${-R + 2} Z`}
        fill={DOG.white} stroke={DOG.line} strokeWidth={1.6} strokeLinejoin="round" />
      <ellipse cx={47} cy={9} rx={6} ry={5} fill={DOG.nose} />
      {p.mouth === "open" && <path d="M 28 17 Q 36 26 44 16 Z" fill="#C44A4A" stroke={DOG.line} strokeWidth={1.4} />}
      {p.mouth === "leash" && (
        <g>
          <rect x={18} y={12} width={30} height={7} rx={3.5} fill={DOG.leash} stroke={shade(DOG.leash, -0.45)} strokeWidth={1.4} />
          <path d="M 22 18 q -6 40 -30 60" stroke={DOG.leash} strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      )}
      {/* глаз и бровь-«пятнышко» */}
      <ellipse cx={14} cy={-6} rx={3.6} ry={4.2 * lid} fill="#0B0B0E" />
      <circle cx={15.2} cy={-7.5} r={1} fill="#FFFFFF" opacity={lid > 0.5 ? 0.9 : 0} />
      {/* ближнее ухо */}
      <g transform={`translate(-2 ${-R + 4}) rotate(${p.earL})`}>
        <path d="M -10 4 L 1 -30 L 12 4 Z" fill={DOG.black} stroke={DOG.line} strokeWidth={1.6} strokeLinejoin="round" />
        <path d="M -4 2 L 1 -18 L 6 2 Z" fill={DOG.blackLight} />
      </g>
    </g>
  );
};

export const Dog: React.FC<{ pose: DogPose; rimFilter?: string }> = ({ pose: p, rimFilter }) => {
  const sit = p.sit ?? 0;
  return (
    <g transform={`translate(${p.x} ${p.y})`} filter={rimFilter ? `url(#${rimFilter})` : undefined}>
      <g transform={`rotate(${p.body})`}>
        {/* дальние лапы */}
        <g transform={`translate(${DD.hindAt.x + 6} ${DD.hindAt.y})`}><Leg p={p.HR} far /></g>
        <g transform={`translate(${DD.frontAt.x - 6} ${DD.frontAt.y})`}><Leg p={p.FR} far /></g>
        {/* хвост */}
        <g transform={`translate(${DD.tailAt.x} ${DD.tailAt.y}) rotate(${p.tail})`}>
          <path d="M 4 -4 Q -26 -6 -46 16 Q -54 30 -48 36 Q -40 26 -26 18 Q -8 10 6 8 Z" fill={DOG.black} stroke={DOG.line} strokeWidth={1.6} strokeLinejoin="round" />
          <path d="M -46 16 Q -54 30 -48 36 Q -44 28 -38 22 Z" fill={DOG.white} />
        </g>
        {/* корпус с дыханием */}
        <g transform={`translate(10 0) scale(1 ${1 + p.breath * 0.035}) translate(-10 0)`}>
          <path d="M -66 -4 Q -64 -30 -30 -30 L 30 -32 Q 64 -34 70 -8 Q 72 22 50 28 L -40 26 Q -70 24 -66 -4 Z"
            fill={DOG.black} stroke={DOG.line} strokeWidth={1.8} strokeLinejoin="round" />
          {/* белая грудь и воротник */}
          <path d="M 44 -30 Q 70 -30 72 -6 Q 74 20 52 28 L 38 26 Q 52 6 44 -30 Z" fill={DOG.white} stroke={DOG.line} strokeWidth={1.4} />
          <path d="M -60 18 Q -20 30 36 26" stroke={DOG.blackLight} strokeWidth={3} fill="none" opacity={0.6} />
        </g>
        {/* голова на шее */}
        <g transform={`translate(${DD.neck.x} ${DD.neck.y - sit * 6}) rotate(${p.head}) translate(${DD.headC.x} ${DD.headC.y})`}>
          <Head p={p} />
        </g>
        {/* ближние лапы */}
        <g transform={`translate(${DD.hindAt.x} ${DD.hindAt.y})`}><Leg p={p.HL} /></g>
        <g transform={`translate(${DD.frontAt.x} ${DD.frontAt.y})`}><Leg p={p.FL} /></g>
      </g>
    </g>
  );
};

/* ---------- «живость»: дыхание, хвост, моргание ---------- */
export const dogLife = (frame: number, fps = 30, seed = 0) => {
  const t = frame / fps;
  const breath = Math.sin(t * 2 * Math.PI * 0.45);
  const tail = 14 * Math.sin(t * 2 * Math.PI * 1.6 + seed);
  // моргание каждые ~3,3 с, длительность 5 кадров
  const cyc = (frame + seed * 37) % 100;
  const blink = cyc < 5 ? Math.sin((cyc / 5) * Math.PI) : 0;
  const ear = 3 * Math.sin(t * 2 * Math.PI * 0.3 + seed);
  return { breath, tail, blink, ear };
};

/* ---------- ходьба: латеральная последовательность HL, FL, HR, FR ---------- */
export const DOG_WALK = { period: 24, stride: 120, stance: 0.62, lift: 14 };
/** Шаг в темпе героя (WALK: 150 px / 24 кадра = 6,25 px/кадр): 125 / 20. Полушаг 33,75 ≤ досягаемости лап. */
export const DOG_WALK_MATCH = { period: 20, stride: 125, stance: 0.54, lift: 14 };
const legTrack = (q: number, g: typeof DOG_WALK, hipToGround: number) => {
  const half = (g.stride * g.stance) / 2;
  if (q < g.stance) {
    const u = q / g.stance;
    return { x: lerp(half, -half, u), y: hipToGround - DD.pawH, paw: 0 };
  }
  const u = (q - g.stance) / (1 - g.stance), e = easeInOut(u);
  return { x: lerp(-half, half, e), y: hipToGround - DD.pawH - Math.sin(Math.PI * u) * g.lift, paw: -20 * Math.sin(Math.PI * u) };
};

export const dogWalk = (frame: number, seed = 0, twos = true, g: typeof DOG_WALK = DOG_WALK): DogPose => {
  const f = twos ? onTwos(frame) : frame;
  const p = (f / g.period) % 1;
  const life = dogLife(frame, 30, seed);
  const bob = 1.5 * Math.cos(4 * Math.PI * p);
  const rootY = STAND_Y + 6 + bob; // чуть ниже стойки — лапы согнуты
  const mk = (q: number, at: { x: number; y: number }, bend: 1 | -1): DogLeg => {
    const t = legTrack(((q % 1) + 1) % 1, g, -rootY - at.y);
    const { upper, lower } = ik2(t.x, t.y, DD.upper, DD.lower, bend);
    return { up: upper, low: lower, paw: t.paw };
  };
  return {
    ...DOG_STAND,
    x: (f / g.period) * g.stride, y: rootY, body: -1,
    head: 2 * Math.sin(4 * Math.PI * p), earL: life.ear, earR: life.ear, tail: life.tail * 0.8 - 8,
    breath: life.breath * 0.5, blink: life.blink,
    HL: mk(p, DD.hindAt, -1), FL: mk(p + 0.75, DD.frontAt, 1),
    HR: mk(p + 0.5, DD.hindAt, -1), FR: mk(p + 0.25, DD.frontAt, 1),
  };
};

/** Сидит (у двери, с поводком): круп на земле, грудь поднята, передние лапы прямые. */
export const dogSit = (frame: number, seed = 0, leash = true): DogPose => {
  const life = dogLife(frame, 30, seed);
  const body = -50, rootY = -60;
  const r = (body * Math.PI) / 180;
  const toWorld = (a: { x: number; y: number }) => ({
    x: a.x * Math.cos(r) - a.y * Math.sin(r), y: a.x * Math.sin(r) + a.y * Math.cos(r) + rootY,
  });
  // передняя лапа: IK к земле прямо под плечом (в мировых осях), затем в систему корпуса
  const front = (at: { x: number; y: number }, dx: number): DogLeg => {
    const w = toWorld(at);
    const { upper, lower } = ik2(dx, -DD.pawH - w.y, DD.upper, DD.lower, 1);
    return { up: upper - body, low: lower, paw: 0 };
  };
  // задняя: бедро вперёд вдоль земли, плюсна назад — лапа поджата под круп
  const hind = (spread: number): DogLeg => ({ up: -78 - body + spread, low: 158, paw: 0 });
  return {
    ...DOG_STAND,
    x: 0, y: rootY, body, head: 44, sit: 1,
    earL: life.ear, earR: life.ear, tail: 74 + life.tail * 0.3, breath: life.breath, blink: life.blink,
    FL: front(DD.frontAt, 4), FR: front({ x: DD.frontAt.x - 6, y: DD.frontAt.y }, -2),
    HL: hind(0), HR: hind(-6),
    mouth: leash ? "leash" : "closed",
  };
};

/** Лежит. */
export const dogLie = (frame: number, seed = 0): DogPose => {
  const life = dogLife(frame, 30, seed);
  return {
    ...DOG_STAND,
    x: 0, y: -34, body: 0, head: 10,
    earL: life.ear - 6, earR: life.ear - 6, tail: 10 + life.tail * 0.3, breath: life.breath, blink: clamp(life.blink, 0, 1),
    FL: { up: -86, low: 0, paw: 0 }, FR: { up: -80, low: 0, paw: 0 },
    HL: { up: -70, low: 120, paw: 0 }, HR: { up: -64, low: 116, paw: 0 },
  };
};
