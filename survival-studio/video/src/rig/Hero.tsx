import React from "react";
import { HERO } from "../style/palette";
import { Capsule, shade } from "./shared";

/*
 * Артём — SVG-риг в профиль (лицом вправо; влево — flip).
 * Начало координат — точка таза (hip). y вниз. Рост ~340 при scale 1, голова ~1/3.
 *
 * Иерархия групп (точки вращения):
 *   root(hip) ── torso(rot @hip) ── neck ── head(rot @neck) ── глаза / брови / рот
 *            │                    └─ shoulderL/R(rot) ── elbow(rot) ── wrist/hand(rot)
 *            └─ hipL/R(rot) ── knee(rot) ── ankle/foot(абсолютный угол стопы)
 * Ближняя сторона — левая (L): рука с браслетом, нога спереди.
 */

export const DIM = {
  thigh: 58, shin: 54, ankleH: 11,
  torso: 90, shoulder: { x: 4, y: -84 }, neck: { x: 6, y: -92 },
  headR: 56, headC: { x: 8, y: -60 }, // центр головы относительно шеи
  upperArm: 44, foreArm: 40, handR: 10,
};

export type LegPose = { hip: number; knee: number; foot: number }; // foot — абсолютный угол стопы
export type ArmPose = { sh: number; el: number; wr: number };
export type Expr = {
  brow: number; // -1 хмурые/грустные ... +1 удивлённые (высота)
  browTilt: number; // + внутренний край вверх (грусть), − вниз (решимость)
  mouth: "flat" | "smile" | "sad" | "open" | "o";
  blink: number; // 0 открыт ... 1 закрыт
};
export type Hold = "phone" | "pen" | "leash" | "lace" | "notebook" | null;
export type HeroPose = {
  x: number; y: number; // таз относительно земли (y < 0)
  torso: number; head: number;
  armL: ArmPose; armR: ArmPose; legL: LegPose; legR: LegPose;
  expr: Expr;
  /** что держит ближняя рука */
  holdL?: Hold;
  holdR?: Hold;
  phoneGlow?: number; // 0..1 — холодный свет экрана на лице
};

export const NEUTRAL: HeroPose = {
  x: 0, y: -(DIM.thigh + DIM.shin + DIM.ankleH) + 3,
  torso: 2, head: 0,
  armL: { sh: 8, el: -14, wr: 0 }, armR: { sh: -6, el: -12, wr: 0 },
  legL: { hip: -4, knee: 6, foot: 0 }, legR: { hip: 5, knee: 4, foot: 0 },
  expr: { brow: 0, browTilt: 0, mouth: "flat", blink: 0 },
};

type Outfit = "casual" | "sport";

/* ---------- Внешность: Артём по умолчанию; другие персонажи — через look ---------- */
export type Look = { [K in keyof typeof HERO]: string } & {
  head: "cap" | "scarf" | "hair" | "bald";
  hairColor?: string; longHair?: boolean; scarfColor?: string;
  glasses?: boolean; beard?: string; bristle?: boolean; bracelet?: boolean; facemask?: string; gloves?: string; hood?: boolean; strings?: boolean; skirt?: string;
};
export const ARTYOM: Look = { ...HERO, head: "cap", bristle: true, bracelet: true, hood: true, strings: true };
const LookCtx = React.createContext<Look>(ARTYOM);
const useLook = () => React.useContext(LookCtx);


const Boot: React.FC<{ outfit: Outfit; far?: boolean }> = ({ outfit, far }) => {
  const L = useLook();
  const upper = outfit === "sport" ? L.sneakers : L.boots;
  const sole = outfit === "sport" ? L.sneakerAccent : L.sole;
  const f = far ? shade(upper, -0.18) : upper;
  return (
    <g>
      <path
        d="M -11 -9 Q -14 2 -12 8 L 27 8 Q 32 7 30 0 Q 27 -5 12 -7 L 8 -13 L -9 -13 Z"
        fill={f} stroke={shade(upper, -0.5)} strokeWidth={1.6} strokeLinejoin="round"
      />
      <path d="M -12 8 L 28 8 Q 31 8 31 11 L -12 11 Q -14 10 -12 8 Z" fill={far ? shade(sole, -0.2) : sole} />
      {outfit === "sport" && <path d="M 2 -4 L 18 -3" stroke={L.sneakerAccent} strokeWidth={2.4} strokeLinecap="round" />}
    </g>
  );
};

const Leg: React.FC<{ p: LegPose; outfit: Outfit; far?: boolean }> = ({ p, outfit, far }) => {
  const L = useLook();
  const cloth = outfit === "sport" ? L.joggers : L.jeans;
  const c = far ? shade(cloth, -0.2) : cloth;
  const shinAbs = p.hip + p.knee;
  return (
    <g transform={`rotate(${p.hip})`}>
      <Capsule y2={DIM.thigh} w={30} fill={c} />
      <g transform={`translate(0 ${DIM.thigh}) rotate(${p.knee})`}>
        <Capsule y2={DIM.shin} w={25} fill={c} />
        <g transform={`translate(0 ${DIM.shin}) rotate(${-shinAbs + p.foot})`}>
          <Boot outfit={outfit} far={far} />
        </g>
      </g>
    </g>
  );
};

const Phone: React.FC<{ glow?: number }> = ({ glow = 0 }) => (
  <g transform="translate(4 6) rotate(-20)">
    <rect x={-6} y={-13} width={13} height={24} rx={3} fill="#1B1E26" stroke="#0B0C10" strokeWidth={1.2} />
    <rect x={-4} y={-10} width={9} height={17} rx={1.5} fill="#5AA9FF" opacity={0.35 + 0.65 * glow} />
  </g>
);

const Hand: React.FC<{ hold?: HeroPose["holdL"]; glow?: number; band?: boolean; far?: boolean }> = ({ hold, glow, band, far }) => {
  const L = useLook();
  return (
  <g>
    {band && L.bracelet && <rect x={-9} y={-6} width={18} height={6} rx={2.5} fill={L.band} stroke={shade(L.band, -0.45)} strokeWidth={1.2} />}
    <circle r={DIM.handR + (L.gloves ? 1.5 : 0)} cy={5} fill={L.gloves ?? (far ? L.skinShade : L.skin)} stroke={shade(L.gloves ?? L.skin, -0.45)} strokeWidth={1.6} />
    {hold === "phone" && <Phone glow={glow} />}
    {hold === "pen" && <path d="M 2 4 L 20 22" stroke="#2B2B33" strokeWidth={3} strokeLinecap="round" />}
    {hold === "leash" && <path d="M 0 8 q 30 40 70 30" stroke="#E8833A" strokeWidth={3.2} fill="none" strokeLinecap="round" />}
    {hold === "lace" && <path d="M 2 10 q 6 8 -2 14" stroke="#EDE6D6" strokeWidth={2.2} fill="none" strokeLinecap="round" />}
    {hold === "notebook" && (
      <g transform="translate(6 -4) rotate(-70)">
        <rect x={-4} y={-22} width={34} height={44} rx={2} fill="#F6F2E7" stroke="#8A7E66" strokeWidth={1.4} />
        {[-10, -2, 6, 14].map((y) => <line key={y} x1={2} x2={26} y1={y} y2={y} stroke="#ADC0C2" strokeWidth={1.4} />)}
        <path d="M 6 -14 l 4 4 l 8 -9" stroke="#3DDC84" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x={-6} y={-22} width={4} height={44} fill="#E8833A" />
      </g>
    )}
  </g>
  );
};

const Arm: React.FC<{ p: ArmPose; outfit: Outfit; far?: boolean; hold?: HeroPose["holdL"]; glow?: number; band?: boolean }> = ({
  p, outfit, far, hold, glow, band,
}) => {
  const L = useLook();
  const sleeve = outfit === "sport" ? L.tee : L.hoodie;
  const c = far ? shade(sleeve, -0.22) : sleeve;
  return (
    <g transform={`rotate(${p.sh})`}>
      <Capsule y2={DIM.upperArm} w={22} fill={c} />
      <g transform={`translate(0 ${DIM.upperArm}) rotate(${p.el})`}>
        {outfit === "sport" ? (
          <Capsule y2={DIM.foreArm} w={17} fill={far ? L.skinShade : L.skin} />
        ) : (
          <Capsule y2={DIM.foreArm} w={20} fill={c} />
        )}
        <g transform={`translate(0 ${DIM.foreArm}) rotate(${p.wr})`}>
          <Hand hold={hold} glow={glow} band={band} far={far} />
        </g>
      </g>
    </g>
  );
};

const Mouth: React.FC<{ m: Expr["mouth"] }> = ({ m }) => {
  const L = useLook();
  const s = { stroke: L.line, strokeWidth: 3, strokeLinecap: "round" as const, fill: "none" };
  switch (m) {
    case "smile": return <path d="M 30 22 Q 38 28 46 21" {...s} />;
    case "sad": return <path d="M 31 26 Q 38 20 45 25" {...s} />;
    case "open": return <ellipse cx={39} cy={24} rx={5} ry={4} fill={L.line} />;
    case "o": return <circle cx={40} cy={24} r={3.2} fill={L.line} />;
    default: return <path d="M 32 24 L 45 23" {...s} />;
  }
};

export const HeroHead: React.FC<{ expr: Expr; glow?: number }> = ({ expr, glow = 0 }) => {
  const L = useLook();
  const R = DIM.headR;
  const eyeY = -4 - expr.brow * 0;
  const browY = -20 - expr.brow * 5;
  const lid = Math.max(0.12, 1 - expr.blink);
  return (
    <g>
      {/* ухо и затылок */}
      <circle r={R} fill={L.skin} stroke={shade(L.skin, -0.45)} strokeWidth={2} />
      <path d={`M ${-R * 0.2} ${-R * 0.98} A ${R} ${R} 0 0 0 ${-R * 0.55} ${R * 0.84} Q ${-R * 0.9} ${0} ${-R * 0.2} ${-R * 0.98}`}
        fill={L.skinShade} opacity={0.35} />
      <ellipse cx={-6} cy={6} rx={9} ry={12} fill={L.skinShade} stroke={shade(L.skin, -0.45)} strokeWidth={1.6} />
      {/* щетина точками */}
      {L.bristle && [[22, 30], [30, 34], [38, 35], [46, 31], [18, 24], [26, 39], [34, 40], [42, 38], [50, 26]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.4} fill={L.stubble} opacity={0.75} />
      ))}
      {L.beard && <path d={`M ${-6} 18 Q 4 52 30 50 Q 52 46 ${R - 4} 22 Q 40 36 30 32 Q 14 30 ${-6} 18 Z`} fill={L.beard} stroke={shade(L.beard, -0.4)} strokeWidth={1.4} />}
      {/* глаз, бровь, рот — отдельные элементы */}
      <ellipse cx={34} cy={eyeY} rx={4.2} ry={5.2 * lid} fill={L.line} />
      <path d={`M 26 ${browY + expr.browTilt * 3} L 42 ${browY - expr.browTilt * 3}`} stroke={L.line} strokeWidth={4} strokeLinecap="round" />
      <Mouth m={expr.mouth} />
      {/* нос — маленький выступ профиля */}
      <path d={`M ${R - 1} 2 Q ${R + 7} 9 ${R - 2} 13`} fill={L.skin} stroke={shade(L.skin, -0.45)} strokeWidth={1.6} />
      {L.glasses && (
        <g fill="none" stroke="#23262E" strokeWidth={2.6}>
          <circle cx={34} cy={-4} r={10} /><path d={`M 44 -6 L ${R - 2} -2 M 24 -6 L 2 -10`} />
        </g>
      )}
      {L.facemask && <path d={`M 4 4 Q 30 -2 ${R + 8} 6 L ${R + 4} 34 Q 30 46 8 38 Z`} fill={L.facemask} stroke={shade(L.facemask, -0.4)} strokeWidth={2} strokeLinejoin="round" />}
      {L.head === "cap" && (<>
        {/* кепка */}
        <path d={`M ${-R - 1} -6 Q ${-R} ${-R - 6} 4 ${-R - 6} Q ${R + 2} ${-R - 4} ${R + 1} -14 L ${-R - 1} -6 Z`}
          fill={L.cap} stroke={shade(L.cap, -0.5)} strokeWidth={2} strokeLinejoin="round" />
        <path d={`M ${R - 14} -16 Q ${R + 16} -20 ${R + 30} -10 Q ${R + 12} -6 ${R - 10} -8 Z`} fill={L.capBrim} />
        <circle cx={2} cy={-R - 4} r={4} fill="#E8833A" />
      </>)}
      {L.head === "scarf" && (
        <g>
          <path d={`M ${-R - 6} 20 Q ${-R - 10} ${-R - 4} 6 ${-R - 8} Q ${R + 4} ${-R - 4} ${R - 2} -18 Q 30 -26 10 -22 Q -10 -14 -16 30 Q -30 46 ${-R - 6} 20 Z`}
            fill={L.scarfColor} stroke={shade(L.scarfColor ?? "#B23A48", -0.45)} strokeWidth={2} strokeLinejoin="round" />
          {[[-30, -30], [-8, -44], [14, -46], [-36, 0], [-20, -12]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.2} fill="#F6F2E7" opacity={0.85} />)}
          <path d="M -16 30 Q -22 46 -12 52 M -16 30 Q -4 44 -2 52" stroke={L.scarfColor} strokeWidth={7} strokeLinecap="round" fill="none" />
        </g>
      )}
      {L.head === "hair" && (
        <g fill={L.hairColor} stroke={shade(L.hairColor ?? "#3A2A20", -0.4)} strokeWidth={1.6} strokeLinejoin="round">
          <path d={`M ${-R - 3} 4 Q ${-R - 8} ${-R - 2} 0 ${-R - 6} Q ${R} ${-R - 6} ${R + 2} -18 Q ${R - 10} -30 ${R - 24} -28 Q 34 -40 20 -30 Q 10 -40 -4 -30 Q -14 -26 -18 -6 Q -30 8 ${-R - 3} 4 Z`} />
          {L.longHair && <path d={`M ${-R - 2} 0 Q ${-R - 14} 50 ${-R + 4} 92 Q -24 96 -16 60 Q -20 30 -18 -2 Z`} />}
        </g>
      )}
      {glow > 0 && <ellipse cx={30} cy={14} rx={30} ry={30} fill="#5AA9FF" opacity={0.2 * glow} style={{ mixBlendMode: "screen" }} />}
    </g>
  );
};

const Torso: React.FC<{ outfit: Outfit }> = ({ outfit }) => {
  const L = useLook();
  const c = outfit === "sport" ? L.tee : L.hoodie;
  return (
    <g>
      {outfit === "casual" && L.hood && (
        // капюшон за шеей
        <path d="M -30 -84 Q -42 -104 -18 -108 Q 2 -100 -4 -86 Z" fill={L.hoodieShade} stroke={shade(c, -0.5)} strokeWidth={1.8} />
      )}
      <path
        d="M -26 6 Q -32 -40 -28 -78 Q -22 -96 4 -96 Q 30 -96 34 -76 Q 38 -40 32 6 Q 4 14 -26 6 Z"
        fill={c} stroke={shade(c, -0.5)} strokeWidth={2} strokeLinejoin="round"
      />
      {/* мягкая собственная тень по спине */}
      <path d="M -26 6 Q -32 -40 -28 -78 Q -22 -94 -10 -95 Q -20 -40 -12 8 Z" fill={shade(c, -0.25)} opacity={0.55} />
      {outfit === "casual" ? (
        <>
          <path d="M 8 -30 L 32 -30 L 33 -4 L 10 -4 Z" fill={shade(c, -0.12)} stroke={shade(c, -0.45)} strokeWidth={1.4} />
          {L.strings && <path d="M 22 -86 L 24 -62 M 28 -84 L 29 -64" stroke="#EDE6D6" strokeWidth={2} strokeLinecap="round" />}
          <path d="M -26 0 Q 4 8 32 0 L 32 6 Q 4 14 -26 6 Z" fill={L.hoodieShade} />
        </>
      ) : (
        <path d="M 6 -94 Q 16 -86 24 -94" stroke={shade(c, -0.4)} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      )}
    </g>
  );
};

/** Точка хвата ближней (левой) руки в координатах героя — для поводка и предметов вне рига. */
const rotP = (p: { x: number; y: number }, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) };
};
export const heroHandL = (pose: HeroPose) => {
  const { sh, el, wr } = pose.armL;
  const hand = rotP({ x: 0, y: 8 }, wr);
  const fore = rotP({ x: hand.x, y: hand.y + DIM.foreArm }, el);
  const arm = rotP({ x: fore.x, y: fore.y + DIM.upperArm }, sh);
  const t = rotP({ x: arm.x + DIM.shoulder.x + 4, y: arm.y + DIM.shoulder.y + 4 }, pose.torso);
  return { x: pose.x + t.x, y: pose.y + t.y };
};

export const Hero: React.FC<{ pose: HeroPose; outfit?: Outfit; rimFilter?: string; look?: Look }> = ({
  pose, outfit = "casual", rimFilter, look = ARTYOM,
}) => (
  <LookCtx.Provider value={look}><HeroBody pose={pose} outfit={outfit} rimFilter={rimFilter} /></LookCtx.Provider>
);
const HeroBody: React.FC<{ pose: HeroPose; outfit: Outfit; rimFilter?: string }> = ({ pose, outfit, rimFilter }) => {
  const L = useLook();
  const { x, y } = pose;
  const sh = DIM.shoulder, nk = DIM.neck;
  return (
    <g transform={`translate(${x} ${y})`} filter={rimFilter ? `url(#${rimFilter})` : undefined}>
      {/* дальние рука и нога */}
      <g transform={`rotate(${pose.torso})`}>
        <g transform={`translate(${sh.x - 6} ${sh.y + 2})`}>
          <Arm p={pose.armR} outfit={outfit} far hold={pose.holdR} glow={pose.phoneGlow} />
        </g>
      </g>
      <g transform="translate(-4 0)">
        <Leg p={pose.legR} outfit={outfit} far />
      </g>
      {/* корпус и голова */}
      <g transform={`rotate(${pose.torso})`}>
        <Torso outfit={outfit} />
        <g transform={`translate(${nk.x} ${nk.y}) rotate(${pose.head}) translate(${DIM.headC.x} ${DIM.headC.y})`}>
          <HeroHead expr={pose.expr} glow={pose.phoneGlow} />
        </g>
      </g>
      {/* ближняя нога */}
      <g transform="translate(4 0)">
        <Leg p={pose.legL} outfit={outfit} />
      </g>
      {L.skirt && (
        <g transform={`rotate(${pose.torso})`}>
          <path d="M -30 -12 L 36 -12 L 48 64 Q 6 74 -38 64 Z" fill={L.skirt} stroke={shade(L.skirt, -0.45)} strokeWidth={2} strokeLinejoin="round" />
        </g>
      )}
      {/* ближняя рука с браслетом */}
      <g transform={`rotate(${pose.torso})`}>
        <g transform={`translate(${sh.x + 4} ${sh.y + 4})`}>
          <Arm p={pose.armL} outfit={outfit} hold={pose.holdL} glow={pose.phoneGlow} band />
        </g>
      </g>
    </g>
  );
};
