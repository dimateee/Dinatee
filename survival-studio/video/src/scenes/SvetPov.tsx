import React from "react";
import { Dog, dogLie } from "../rig/Dog";
import { RimDefs } from "../rig/shared";
import { HERO } from "../style/palette";

/*
 * «Оно идёт на свет» — вид от первого лица (замечание владельца: дом в разрезе скучен, LESSONS Б19).
 * Руки героя (рукава худи Артёма, зелёный браслет на левом запястье), телефон, фонарик, шторы, дверь, глазок.
 * Все координаты — кадр 1080×1920. Субтитры живут в полосе y≈1140–1320: ключевые предметы — выше или ниже.
 */

/* ---------------- Рука от первого лица ---------------- */
export type HandPose = "grip" | "flat" | "point" | "fist";
const Cap: React.FC<{ x1: number; y1: number; x2: number; y2: number; w: number; fill: string }> = ({ x1, y1, x2, y2, w, fill }) => (
  <>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={HERO.line} strokeWidth={w + 8} strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={fill} strokeWidth={w} strokeLinecap="round" />
  </>
);
/** wrist — точка запястья; angle — 0 = кисть смотрит вверх; side L — большой палец справа (тыльная сторона левой). */
export const PovArm: React.FC<{
  x: number; y: number; angle?: number; side: "L" | "R"; pose?: HandPose; scale?: number;
  light?: number; part?: "all" | "back" | "thumb"; curl?: number;
}> = ({ x, y, angle = 0, side, pose = "grip", scale = 1, light = 0.4, part = "all", curl = 0 }) => {
  const skin = HERO.skin, shade = HERO.skinShade;
  const b = Math.round(Math.max(0.15, Math.min(1, light)) * 20) / 20;
  const fid = `dim${Math.round(b * 100)}`;
  const thumbEnd = pose === "flat" ? [112, -118] : pose === "point" ? [96, -108] : [80, -168];
  const thumb = <Cap x1={50} y1={-46} x2={thumbEnd[0]} y2={thumbEnd[1]} w={36} fill={skin} />;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${side === "R" ? -scale : scale} ${scale})`} filter={`url(#${fid})`}>
      <defs>
        <filter id={fid}><feComponentTransfer>
          <feFuncR type="linear" slope={b} /><feFuncG type="linear" slope={b} /><feFuncB type="linear" slope={Math.min(1, b * 1.15)} />
        </feComponentTransfer></filter>
      </defs>
      {part !== "thumb" && (<>
        {/* рукав */}
        <path d="M -86 30 L 86 30 L 128 980 L -128 980 Z" fill={HERO.hoodie} stroke={HERO.line} strokeWidth={6} />
        <path d="M 30 60 L 86 30 L 128 980 L 70 980 Z" fill={HERO.hoodieShade} opacity={0.8} />
        <rect x={-84} y={8} width={168} height={62} rx={22} fill={HERO.hoodieShade} stroke={HERO.line} strokeWidth={6} />
        {side === "L" && <rect x={-60} y={-8} width={120} height={18} rx={6} fill={HERO.band} stroke={HERO.line} strokeWidth={4} />}
        {/* пальцы */}
        {pose === "flat" && [[-46, -262], [-15, -282], [16, -276], [46, -250]].map(([fx, fy], i) => <Cap key={i} x1={fx} y1={-130} x2={fx + (fx * 0.12)} y2={fy} w={30} fill={skin} />)}
        {pose === "point" && (<>
          {[[-46, -176], [-15, -184], [16, -182]].map(([fx, fy], i) => <Cap key={i} x1={fx} y1={-130} x2={fx} y2={fy} w={30} fill={shade} />)}
          <Cap x1={46} y1={-130} x2={50} y2={-300} w={30} fill={skin} />
        </>)}
        {(pose === "grip" || pose === "fist") && [-46, -15, 16, 46].map((fx, i) => (
          <Cap key={i} x1={fx} y1={-130} x2={fx} y2={-130 - (pose === "fist" ? 34 : 60 - 26 * curl) + (i === 3 ? 8 : 0)} w={30} fill={pose === "fist" ? shade : skin} />
        ))}
        {/* тыльная сторона кисти */}
        <path d="M -64 0 C -76 -54 -74 -112 -64 -150 L 64 -150 C 74 -108 74 -52 62 0 Z" fill={skin} stroke={HERO.line} strokeWidth={6} />
        <path d="M 20 -150 L 64 -150 C 74 -108 74 -52 62 0 L 36 0 Z" fill={shade} opacity={0.45} />
        {[-46, -15, 16, 46].map((fx) => <path key={fx} d={`M ${fx - 10} -140 q 10 -8 20 0`} stroke={shade} strokeWidth={4} fill="none" />)}
      </>)}
      {part !== "back" && thumb}
    </g>
  );
};

/* ---------------- Комната: тёмная стена, пол в перспективе ---------------- */
export const RoomDark: React.FC<{ horizon?: number; glow?: { x: number; y: number; r: number; k: number; color?: string } }> = ({ horizon = 1080, glow }) => (
  <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    <defs>
      <radialGradient id="rdGlow"><stop offset="0" stopColor={glow?.color ?? "#9CC2FF"} stopOpacity={0.55} /><stop offset="1" stopColor={glow?.color ?? "#9CC2FF"} stopOpacity={0} /></radialGradient>
      <linearGradient id="rdFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0B0D12" /><stop offset="1" stopColor="#1A1712" /></linearGradient>
    </defs>
    <rect x={0} y={0} width={1080} height={horizon} fill="#0A0C11" />
    <rect x={0} y={horizon} width={1080} height={1920 - horizon} fill="url(#rdFloor)" />
    {Array.from({ length: 9 }, (_, i) => {
      const xb = -600 + i * 285;
      return <line key={i} x1={540 + (xb - 540) * 0.18} y1={horizon} x2={xb} y2={1920} stroke="#0A0B0E" strokeWidth={5} />;
    })}
    <rect x={0} y={horizon - 10} width={1080} height={14} fill="#07080B" />
    {glow && glow.k > 0 && <circle cx={glow.x} cy={glow.y} r={glow.r} fill="url(#rdGlow)" opacity={glow.k} />}
  </svg>
);

/* ---------------- Пол сверху: запасы ---------------- */
export const Supplies: React.FC<{ frame: number; hi: number[]; jack: number }> = ({ frame, hi, jack }) => {
  const ring = (cx: number, cy: number, rx: number, ry: number, k: number) => k > 0 &&
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="#E8C547" strokeWidth={8} opacity={k} style={{ filter: "drop-shadow(0 0 14px #E8C547)" }} />;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimSup" side={-1} color="#9CC2FF" strength={0.6} width={4} />
      {/* Джек ложится рядом (выезжает справа) */}
      <g transform={`translate(${1340 - 420 * jack} 1080) scale(-2.3 2.3)`}>
        <Dog pose={{ ...dogLie(frame, 3), head: -8 + 3 * Math.sin(frame / 20), earL: -8, earR: -8 }} rimFilter="rimSup" />
      </g>
      {/* фонарик */}
      <g transform="translate(250 1560) rotate(-12)">
        {ring(0, 0, 190, 90, hi[0])}
        <rect x={-150} y={-34} width={210} height={68} rx={18} fill="#2E3440" stroke="#0A0D13" strokeWidth={6} />
        <path d="M 60 -48 L 130 -60 L 130 60 L 60 48 Z" fill="#3A4252" stroke="#0A0D13" strokeWidth={6} />
        <ellipse cx={130} cy={0} rx={14} ry={60} fill="#7F8A9C" />
        <rect x={-60} y={-46} width={34} height={14} rx={5} fill="#E8C547" />
        {[0, 1, 2].map((i) => <rect key={i} x={-130 + i * 40} y={-12} width={30} height={24} rx={4} fill="#E8C547" opacity={hi[0] > 0 ? 1 : 0.6} />)}
      </g>
      {/* свеча (не горит) */}
      <g transform="translate(560 1520)">
        {ring(0, 40, 110, 50, hi[2])}
        <ellipse cx={0} cy={40} rx={60} ry={18} fill="#2B2F38" />
        <rect x={-26} y={-150} width={52} height={190} rx={10} fill="#EDE6D6" stroke="#0A0D13" strokeWidth={5} />
        <ellipse cx={0} cy={-150} rx={26} ry={8} fill="#F6F0E2" />
        <line x1={0} y1={-158} x2={2} y2={-182} stroke="#2A2A2A" strokeWidth={5} strokeLinecap="round" />
      </g>
      {/* телефон в правой руке: 54% */}
      <g transform="translate(860 1620) rotate(8)">
        {ring(0, -40, 170, 220, hi[1])}
        <rect x={-110} y={-230} width={220} height={400} rx={30} fill="#0B0D12" stroke="#1E222B" strokeWidth={10} />
        <rect x={-96} y={-216} width={192} height={372} rx={22} fill="#141A26" />
        <rect x={-60} y={-120} width={110} height={56} rx={10} fill="none" stroke="#C9D2E0" strokeWidth={6} />
        <rect x={-54} y={-114} width={54} height={44} rx={5} fill="#E8C547" />
        <rect x={52} y={-104} width={8} height={24} rx={3} fill="#C9D2E0" />
        <text x={0} y={10} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={64} fill="#FFFFFF">54%</text>
      </g>
      <PovArm x={900} y={1950} angle={-6} side="R" pose="grip" scale={1.1} light={0.5} />
    </svg>
  );
};

/* ---------------- Низ двери: полотенце в щель ---------------- */
export const DoorBottom: React.FC<{ frame: number; push: number }> = ({ frame, push }) => {
  const ty = 1700 - 300 * push;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <rect x={0} y={0} width={1080} height={1920} fill="#0A0C11" />
      <rect x={120} y={-40} width={840} height={1420} fill="#2B3241" stroke="#0A0D13" strokeWidth={12} />
      <rect x={180} y={420} width={720} height={860} fill="none" stroke="#3A4560" strokeWidth={8} />
      <rect x={90} y={-40} width={36} height={1430} fill="#232A36" /><rect x={954} y={-40} width={36} height={1430} fill="#232A36" />
      {/* щель: холодная полоска с площадки */}
      <rect x={120} y={1380} width={840} height={16} fill="#5C7194" opacity={0.55 * (1 - push) + 0.06} />
      <rect x={0} y={1396} width={1080} height={524} fill="#141210" />
      {Array.from({ length: 5 }, (_, i) => <line key={i} x1={0} y1={1460 + i * 100} x2={1080} y2={1460 + i * 100 + 6} stroke="#0B0A08" strokeWidth={5} />)}
      {/* свёрнутое полотенце */}
      <g transform={`translate(540 ${ty})`}>
        <rect x={-400} y={-46} width={800} height={92} rx={46} fill="#C0567A" stroke="#5A2238" strokeWidth={6} />
        {[-300, -150, 0, 150, 300].map((x) => <path key={x} d={`M ${x} -40 q 22 40 0 80`} stroke="#9A3E5E" strokeWidth={6} fill="none" />)}
      </g>
      <PovArm x={330} y={ty + 330} angle={6} side="L" pose="flat" light={0.45} scale={1.05} />
      <PovArm x={760} y={ty + 330} angle={-6} side="R" pose="flat" light={0.45} scale={1.05} />
    </svg>
  );
};

/* ---------------- Фонарик в пол, стекло под ладонью ---------------- */
export const TorchFloor: React.FC<{ frame: number; on: number; cover: number }> = ({ frame, on, cover }) => {
  const flick = 0.92 + 0.08 * Math.sin(frame / 3.1);
  const leak = 1 - 0.75 * cover;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="tfSpot"><stop offset="0" stopColor="#FFF1CF" stopOpacity={0.85} /><stop offset="1" stopColor="#FFF1CF" stopOpacity={0} /></radialGradient>
        <linearGradient id="tfBeam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF1CF" stopOpacity={0.5} /><stop offset="1" stopColor="#FFF1CF" stopOpacity={0.05} /></linearGradient>
        <radialGradient id="tfRed"><stop offset="0" stopColor="#FF7A4A" stopOpacity={0.9} /><stop offset="1" stopColor="#FF7A4A" stopOpacity={0} /></radialGradient>
      </defs>
      <rect x={0} y={0} width={1080} height={1920} fill="#08090D" />
      <rect x={0} y={1380} width={1080} height={540} fill="#151310" />
      {Array.from({ length: 6 }, (_, i) => <line key={i} x1={-100 + i * 260} y1={1380} x2={-400 + i * 380} y2={1920} stroke="#0B0A08" strokeWidth={5} />)}
      {/* луч и пятно на полу */}
      {on > 0 && (<>
        <path d="M 520 1010 L 380 1660 L 720 1660 L 580 1010 Z" fill="url(#tfBeam)" opacity={on * leak * flick} />
        <ellipse cx={550} cy={1660} rx={250} ry={90} fill="url(#tfSpot)" opacity={on * leak * flick} />
      </>)}
      {/* фонарик: рукоять в правой руке снизу справа, головой вниз */}
      <g transform="translate(560 900) rotate(-8)">
        <rect x={-48} y={-360} width={96} height={330} rx={22} fill="#2E3440" stroke="#0A0D13" strokeWidth={6} />
        <path d="M -60 -40 L 60 -40 L 76 70 L -76 70 Z" fill="#3A4252" stroke="#0A0D13" strokeWidth={6} />
        <ellipse cx={0} cy={72} rx={76} ry={18} fill={on > 0 ? "#FFF1CF" : "#7F8A9C"} opacity={on > 0 ? 0.95 : 1} />
      </g>
      <PovArm x={630} y={780} angle={-70} side="R" pose="grip" light={0.35 + 0.35 * on * leak} scale={0.95} />
      {/* левая ладонь накрывает стекло — свет красный сквозь пальцы */}
      {cover > 0 && (<>
        <PovArm x={300 + 300 * cover} y={1350 - 275 * cover} angle={-40 + 15 * cover} side="L" pose="flat" light={0.5 + 0.4 * on} scale={0.9} />
        <circle cx={560} cy={1000} r={190} fill="url(#tfRed)" opacity={0.7 * cover * on * flick} />
      </>)}
    </svg>
  );
};

/* ---------------- Глазок: рыбий глаз на тёмную площадку ---------------- */
export const Peephole: React.FC<{ frame: number; k: number; figure: number }> = ({ frame, k, figure }) => {
  const jitter = Math.sin(frame / 7) * 2;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <clipPath id="phC"><circle cx={540} cy={860} r={430} /></clipPath>
        <radialGradient id="phV"><stop offset="0.6" stopColor="#000" stopOpacity={0} /><stop offset="1" stopColor="#000" stopOpacity={0.95} /></radialGradient>
      </defs>
      <rect x={0} y={0} width={1080} height={1920} fill="#020203" />
      <g clipPath="url(#phC)" opacity={k}>
        <g transform={`translate(540 860) scale(1.08) translate(-540 -860) translate(${jitter} 0)`}>
          <rect x={0} y={400} width={1080} height={940} fill="#161C28" />
          {/* стены площадки, изогнутые линзой */}
          <path d="M 110 430 Q 300 860 110 1290" stroke="#1E2532" strokeWidth={14} fill="none" />
          <path d="M 970 430 Q 780 860 970 1290" stroke="#1E2532" strokeWidth={14} fill="none" />
          <path d="M 110 1120 Q 540 1040 970 1120 L 970 1300 L 110 1300 Z" fill="#0A0D12" />
          {/* перила и номер этажа */}
          <path d="M 700 980 Q 820 940 930 1000" stroke="#2A3242" strokeWidth={10} fill="none" />
          <rect x={250} y={600} width={90} height={110} rx={10} fill="#1A2030" stroke="#3A4560" strokeWidth={5} />
          <text x={295} y={688} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={84} fill="#8FA0BC">5</text>
          {/* фигура — едва темнее темноты */}
          <g opacity={figure * (0.55 + 0.1 * Math.sin(frame / 11))}>
            <ellipse cx={560} cy={760} rx={70} ry={86} fill="#050608" />
            <path d="M 440 1180 Q 450 900 560 860 Q 670 900 680 1180 Z" fill="#050608" />
          </g>
        </g>
        <circle cx={540} cy={860} r={430} fill="url(#phV)" />
      </g>
      <circle cx={540} cy={860} r={434} fill="none" stroke="#1A1D24" strokeWidth={16} />
    </svg>
  );
};

/* ---------------- Пол: ладонь на досках, плач снизу ---------------- */
export const FloorListen: React.FC<{ frame: number; cry: number }> = ({ frame, cry }) => (
  <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    <rect x={0} y={0} width={1080} height={1920} fill="#14110E" />
    {Array.from({ length: 8 }, (_, i) => <rect key={i} x={i * 140 - 20} y={0} width={136} height={1920} fill={i % 2 ? "#17140F" : "#1A1611"} stroke="#0B0A08" strokeWidth={6} />)}
    {cry > 0 && [0, 1, 2].map((i) => {
      const ph = (frame / 40 + i / 3) % 1;
      return <ellipse key={i} cx={560} cy={760} rx={120 + 420 * ph} ry={50 + 170 * ph} fill="none" stroke="#C9D2E0" strokeWidth={5} opacity={0.35 * (1 - ph) * cry} />;
    })}
    <PovArm x={470} y={1080} angle={-8} side="L" pose="flat" light={0.4} scale={1.15} />
  </svg>
);

/* ---------------- Кровать: Джек пятится под неё ---------------- */
export const BedHide: React.FC<{ frame: number; hide: number }> = ({ frame, hide }) => {
  const eyes = hide >= 1 ? (frame % 70 < 4 ? 0 : 1) : 0;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimBed" side={1} color="#9CC2FF" strength={0.6} width={4} />
      <rect x={0} y={0} width={1080} height={1920} fill="#0A0C11" />
      <rect x={0} y={1300} width={1080} height={620} fill="#14120F" />
      {/* кровать */}
      <rect x={-40} y={760} width={980} height={130} rx={20} fill="#2B3241" />
      <rect x={-40} y={700} width={300} height={90} rx={30} fill="#3A4252" />
      <rect x={-40} y={880} width={980} height={420} fill="#020203" />
      <rect x={-40} y={880} width={980} height={60} fill="#232A36" />
      <rect x={900} y={880} width={40} height={430} fill="#232A36" />
      {/* Джек: задом под кровать */}
      <g transform={`translate(${760 - 520 * hide} ${1300 - 40 * hide}) scale(-2.2 2.2)`} opacity={1 - 0.85 * Math.max(0, hide - 0.6) / 0.4}>
        <Dog pose={{ ...dogLie(frame, 3), earL: -24, earR: -24, head: 12 }} rimFilter="rimBed" />
      </g>
      {/* передняя доска кровати прячет пса */}
      <rect x={-40} y={1240} width={980} height={70} fill="#232A36" />
      {eyes > 0 && [0, 1].map((i) => <circle key={i} cx={330 + i * 46} cy={1110} r={9} fill="#CFE3FF" opacity={0.9} style={{ filter: "drop-shadow(0 0 8px #CFE3FF)" }} />)}
    </svg>
  );
};

/* ---------------- Рука тянется к цепочке ---------------- */
export const ChainHand: React.FC<{ reach: number; tremble: number; frame: number }> = ({ reach, tremble, frame }) => (
  <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    <PovArm x={780 + Math.sin(frame / 2.3) * 4 * tremble} y={1920 - 900 * reach} angle={-22} side="R" pose="point" light={0.35} scale={1.05} />
  </svg>
);
