import React from "react";
import { random } from "remotion";
import { Hero, HeroPose, NEUTRAL } from "../rig/Hero";
import { Dog, dogLie } from "../rig/Dog";
import { GroundShadow, RimDefs, shade } from "../rig/shared";
import { SRYV } from "../style/palette";

/*
 * Сцены серии «Бункер». Кадр 1080×1920, земля — y = GROUND. Субтитры 1075–1421 — без плашек.
 * Палитра — «Срыв» (ночь) + оранжевое зарево и красный сигнал.
 */
export const GROUND = 1150;
const S = 1.8;
const GLOW = "#FF8A3D";

/* ============================ НОЧНОЙ ГОРОД ============================ */
type CityProps = {
  frame: number;
  flash?: number;  // 0..1 — белая вспышка на весь кадр
  glow?: number;   // 0..1 — зарево над горизонтом
  shake?: number;  // 0..1 — тряска (ударная волна)
  dust?: number;   // 0..1 — оседающая пыль
  wave?: number;   // 0..1 — пыльный вал проходит справа налево
  hero?: React.ReactNode;
  zoom?: number;
  lift?: number;   // поднять мир (чтобы лежащий герой был выше субтитров)
};
const FAR = [[0, 640, 150], [140, 560, 120], [250, 700, 170], [410, 520, 110], [510, 610, 160], [660, 470, 130], [780, 650, 150], [920, 560, 170]];
const NEAR = [[-20, 760, 230], [200, 840, 180], [690, 800, 200], [880, 720, 230]];

export const NightCity: React.FC<CityProps> = ({ frame, flash = 0, glow = 0, shake = 0, dust = 0, wave = 0, hero, zoom = 1, lift = 0 }) => {
  const sx = shake ? Math.round((random(`sx${frame}`) - 0.5) * 26 * shake) : 0;
  const sy = shake ? Math.round((random(`sy${frame}`) - 0.5) * 18 * shake) : 0;
  const hz = 760; // линия горизонта дальних домов
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="cityGlow">
          <stop offset="0" stopColor="#FFE9C2" stopOpacity={1} />
          <stop offset="0.35" stopColor={GLOW} stopOpacity={0.75} />
          <stop offset="1" stopColor={GLOW} stopOpacity={0} />
        </radialGradient>
        <filter id="waveBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={40} /></filter>
      </defs>
      <g transform={`translate(${540 + sx} ${GROUND + sy - lift}) scale(${zoom}) translate(-540 ${-GROUND})`}>
        <rect x={-300} y={-300} width={1680} height={2600} fill={SRYV.bg0} />
        {/* зарево за домами */}
        {glow > 0 && <ellipse cx={720} cy={hz - 40} rx={620} ry={420} fill="url(#cityGlow)" opacity={glow} />}
        {/* дальние дома */}
        {FAR.map(([x, top, w], i) => (
          <g key={i}>
            <rect x={x} y={top} width={w} height={GROUND - top} fill={glow > 0.2 ? "#10141D" : "#161B26"} />
            {Array.from({ length: 10 }, (_, r) => Array.from({ length: 3 }, (_, c) => {
              const on = random(`w${i}-${r}-${c}`) < 0.28 && glow < 0.5;
              return on ? <rect key={`${r}${c}`} x={x + 18 + c * ((w - 36) / 3)} y={top + 30 + r * 52} width={18} height={24} fill={SRYV.lamp} opacity={0.7} /> : null;
            }))}
          </g>
        ))}
        {/* ближние дома */}
        {NEAR.map(([x, top, w], i) => (
          <g key={i}>
            <rect x={x} y={top} width={w} height={GROUND - top} fill="#0A0D13" />
            {Array.from({ length: 6 }, (_, r) => Array.from({ length: 2 }, (_, c) => {
              const on = random(`n${i}-${r}-${c}`) < 0.3 && glow < 0.5;
              return <rect key={`${r}${c}`} x={x + 34 + c * (w / 2 - 10)} y={top + 50 + r * 60} width={40} height={36}
                fill={on ? SRYV.lamp : "#121722"} opacity={on ? 0.75 : 1} />;
            }))}
          </g>
        ))}
        {/* земля */}
        <rect x={-300} y={GROUND} width={1680} height={900} fill="#07090D" />
        <rect x={-300} y={GROUND} width={1680} height={10} fill="#1C2331" />
        {/* отсвет зарева на земле */}
        {glow > 0 && <rect x={-300} y={GROUND} width={1680} height={140} fill={GLOW} opacity={0.08 * glow} />}
        {hero}
        {/* пыльный вал */}
        {wave > 0 && wave < 1 && (
          <g>
            <g filter="url(#waveBlur)" opacity={0.8 * Math.sin(Math.PI * wave)}>
              <ellipse cx={1500 - wave * 2400} cy={GROUND - 150} rx={900} ry={420} fill="#5C5048" opacity={0.6} />
              <ellipse cx={1700 - wave * 2400} cy={GROUND - 60} rx={700} ry={200} fill="#7A6A5C" opacity={0.6} />
            </g>
            {Array.from({ length: 26 }, (_, i) => {
              const x = 1300 - wave * (2200 + random(`wv${i}`) * 900) + random(`wx${i}`) * 400;
              const y = 520 + random(`wy${i}`) * (GROUND - 560);
              return <line key={i} x1={x} y1={y} x2={x + 40 + random(`wl${i}`) * 60} y2={y + 4} stroke="#9A8C7E" strokeWidth={4} strokeLinecap="round" opacity={0.7} />;
            })}
          </g>
        )}
      </g>
      {/* оседающая пыль — поверх всего, медленно и крупно ближе к камере */}
      {dust > 0 && (
        <g opacity={dust}>
          {Array.from({ length: 140 }, (_, i) => {
            const near = i % 4 === 0;
            const speed = near ? 2.6 : 1.2 + random(`ds${i}`) * 0.8;
            const x = random(`dx${i}`) * 1080 + Math.sin(frame / 30 + i) * 10;
            const y = ((random(`dy${i}`) * 2100 + frame * speed) % 2100) - 120;
            return <circle key={i} cx={Math.round(x)} cy={Math.round(y)} r={near ? 6 : 2.5 + random(`dr${i}`) * 2} fill="#B9B2A6" opacity={near ? 0.45 : 0.7} />;
          })}
        </g>
      )}
      {/* вспышка */}
      {flash > 0 && <rect width={1080} height={1920} fill="#FFF8EA" opacity={flash} />}
    </svg>
  );
};

/* Артём лежит лицом вниз, руки под собой (поза «укрыться от вспышки»). Голова — вправо, от взрыва. */
export const PRONE: HeroPose = {
  ...NEUTRAL, x: 0, y: 0, torso: 0, head: 6,
  legL: { hip: 0, knee: 4, foot: -78 }, legR: { hip: 2, knee: 4, foot: -80 },
  armL: { sh: -150, el: 120, wr: 0 }, armR: { sh: -150, el: 120, wr: 0 },
  expr: { brow: -0.5, browTilt: 1, mouth: "flat", blink: 1 },
};
export const ProneHero: React.FC<{ x: number; frame: number }> = ({ x, frame }) => (
  <g transform={`translate(${x} ${GROUND - 34}) scale(${S}) rotate(90)`}>
    <Hero pose={{ ...PRONE, torso: 0.6 * Math.sin(frame / 9) }} outfit="casual" />
  </g>
);

/* ============================ РАЗРЕЗ ДОМА ============================ */
/**
 * Пятиэтажка в разрезе: пыль на крыше и вокруг, подвал под землёй.
 * Подсветка: basement — подвал, center — середина средних этажей, edges — крыша и наружные стены (опасно).
 * Всё выше зоны субтитров: земля y=880, подвал 880–1040.
 */
export const BuildingSection: React.FC<{ f: number; dust: number; basement: number; center: number; edges: number; dose: number }> = ({
  f, dust, basement, center, edges, dose,
}) => {
  const L = 250, R = 830, top = 300, gy = 880, fl = (gy - top) / 5, bb = 1040;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {/* грунт */}
      <rect x={0} y={gy} width={1080} height={bb - gy + 30} fill="#2A2420" />
      {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={random(`g${i}`) * 1080} cy={gy + 20 + random(`gy${i}`) * 140} r={3} fill="#3A322C" />)}
      <rect x={0} y={gy - 6} width={1080} height={8} fill="#4A4038" />
      {/* дом */}
      <rect x={L} y={top} width={R - L} height={gy - top} fill="#1E2535" stroke="#3A4560" strokeWidth={10} />
      {Array.from({ length: 4 }, (_, i) => <line key={i} x1={L} x2={R} y1={top + fl * (i + 1)} y2={top + fl * (i + 1)} stroke="#3A4560" strokeWidth={8} />)}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={L + 10} y={top + fl * i + 30} width={44} height={50} fill="#0E1118" />
          <rect x={R - 54} y={top + fl * i + 30} width={44} height={50} fill="#0E1118" />
        </g>
      ))}
      <path d={`M ${L - 20} ${top} L ${R + 20} ${top}`} stroke="#3A4560" strokeWidth={14} />
      {/* подвал */}
      <rect x={L} y={gy} width={R - L} height={bb - gy} fill="#151A24" stroke="#3A4560" strokeWidth={10} />
      {/* опасные края */}
      <g opacity={edges}>
        <rect x={L} y={top} width={R - L} height={fl} fill={SRYV.fail} opacity={0.35} />
        <rect x={L} y={top} width={70} height={gy - top} fill={SRYV.fail} opacity={0.3} />
        <rect x={R - 70} y={top} width={70} height={gy - top} fill={SRYV.fail} opacity={0.3} />
      </g>
      {/* безопасные зоны */}
      <rect x={L + 90} y={top + fl * 2 + 10} width={R - L - 180} height={fl * 2 - 20} rx={14} fill={SRYV.progress} opacity={0.4 * center} />
      <rect x={L + 10} y={gy + 10} width={R - L - 20} height={bb - gy - 20} rx={14} fill={SRYV.progress} opacity={0.55 * basement} />
      {/* шкала дозы справа */}
      <g opacity={dose}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const y = top + i * ((bb - top) / 6) + 10;
          const w = 90 - i * 15;
          return <rect key={i} x={R + 40} y={y} width={Math.max(8, w)} height={(bb - top) / 6 - 20} rx={6} fill={i < 2 ? SRYV.fail : i < 4 ? SRYV.lamp : SRYV.progress} />;
        })}
      </g>
      {/* пыль: падает на крышу и вокруг дома */}
      <g opacity={dust}>
        {Array.from({ length: 70 }, (_, i) => {
          const x = random(`bx${i}`) * 1080;
          const y = ((random(`by${i}`) * 900 + f * 2.2) % 900) - 60;
          const yy = x > L - 20 && x < R + 20 ? Math.min(y, top - 8) : Math.min(y, gy - 8);
          return <circle key={i} cx={Math.round(x)} cy={Math.round(yy)} r={4} fill="#B9B2A6" opacity={0.75} />;
        })}
        <rect x={L - 20} y={top - 10} width={R - L + 40} height={6} fill="#B9B2A6" opacity={0.6} />
        <rect x={0} y={gy - 10} width={L - 20} height={6} fill="#B9B2A6" opacity={0.6} />
        <rect x={R + 20} y={gy - 10} width={1080 - R - 20} height={6} fill="#B9B2A6" opacity={0.6} />
      </g>
    </svg>
  );
};

/* ============================ ПОДВАЛ-УБЕЖИЩЕ ============================ */
/** Бетонный подвал, одна лампа, полки с водой, радио на ящике. Артём сидит на ящике, Луна лежит рядом. */
export const Shelter: React.FC<{ frame: number; radio?: number; lamp?: number; zoom?: number; hero?: boolean; dog?: boolean; enter?: number }> = ({
  frame, radio = 0, lamp = 1, zoom = 1, hero = true, dog = true, enter = 1,
}) => {
  const swing = Math.sin(frame / 40) * 3;
  const flick = lamp * (random(`fl${Math.floor(frame / 3)}`) < 0.04 ? 0.6 : 1);
  const sit: HeroPose = {
    ...NEUTRAL, y: -66, torso: 18 + 1 * Math.sin(frame / 18), head: 10 + Math.sin(frame / 25),
    legL: { hip: -84, knee: 92, foot: 0 }, legR: { hip: -80, knee: 88, foot: 0 },
    armL: { sh: -38, el: -52, wr: 0 }, armR: { sh: -32, el: -56, wr: 0 },
    expr: { brow: -0.3, browTilt: 0.8, mouth: "flat", blink: frame % 90 < 4 ? 1 : 0 },
  };
  const lx = 520, ly = 300 + 0;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimLamp" side={-1} color={SRYV.lamp} strength={0.9} width={6} />
      <defs>
        <radialGradient id="lampGlow">
          <stop offset="0" stopColor={SRYV.lamp} stopOpacity={0.55} />
          <stop offset="1" stopColor={SRYV.lamp} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="radioGlow">
          <stop offset="0" stopColor={SRYV.progress} stopOpacity={0.5} />
          <stop offset="1" stopColor={SRYV.progress} stopOpacity={0} />
        </radialGradient>
      </defs>
      <g transform={`translate(540 ${GROUND}) scale(${zoom}) translate(-540 ${-GROUND})`}>
        {/* стены из блоков */}
        <rect x={-300} y={-300} width={1680} height={GROUND + 300} fill="#1A1F28" />
        {Array.from({ length: 16 }, (_, r) => Array.from({ length: 8 }, (_, c) => (
          <rect key={`${r}-${c}`} x={-120 + c * 180 + (r % 2) * 90} y={140 + r * 64} width={174} height={58} fill="none" stroke="#232A36" strokeWidth={4} />
        )))}
        {/* труба под потолком */}
        <rect x={-300} y={200} width={1680} height={34} fill="#2B3241" />
        {[120, 600, 980].map((x) => <rect key={x} x={x} y={192} width={22} height={50} fill="#353D4E" />)}
        {/* полки с водой и консервами */}
        <g>
          {[520, 680, 840].map((y) => <rect key={y} x={700} y={y} width={340} height={14} fill="#3A3128" />)}
          <rect x={700} y={500} width={12} height={650} fill="#3A3128" /><rect x={1028} y={500} width={12} height={650} fill="#3A3128" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <rect x={716 + i * 52} y={430} width={38} height={90} rx={8} fill="#5AA9FF" opacity={0.35} stroke="#8FBCEB" strokeWidth={3} />
              <rect x={727 + i * 52} y={418} width={16} height={14} fill="#8FBCEB" opacity={0.6} />
            </g>
          ))}
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={716 + i * 62} y={620} width={50} height={60} rx={6} fill="#7B8798" stroke="#4E5868" strokeWidth={3} />)}
          {[0, 1, 2].map((i) => <rect key={i} x={720 + i * 100} y={770} width={88} height={70} rx={4} fill="#8A6B47" stroke="#5E4830" strokeWidth={3} />)}
        </g>
        {/* пол */}
        <rect x={-300} y={GROUND} width={1680} height={900} fill="#11151C" />
        <rect x={-300} y={GROUND - 16} width={1680} height={16} fill="#0A0D13" />
        {/* ящик с радио */}
        <g transform={`translate(560 ${GROUND})`}>
          <rect x={-70} y={-110} width={140} height={110} fill="#5E4830" stroke="#3E2F20" strokeWidth={4} />
          <g transform="translate(0 -110)">
            <rect x={-56} y={-62} width={112} height={62} rx={8} fill="#2B3241" stroke="#0A0D13" strokeWidth={4} />
            <circle cx={-26} cy={-31} r={18} fill="#1A1F28" stroke="#4E5868" strokeWidth={3} />
            <rect x={6} y={-44} width={38} height={14} rx={3} fill={SRYV.progress} opacity={0.25 + 0.75 * radio} />
            <line x1={30} y1={-62} x2={60} y2={-120} stroke="#4E5868" strokeWidth={4} />
          </g>
        </g>
        {/* Артём на ящике */}
        {hero && (
          <g opacity={enter}>
            <g transform={`translate(300 ${GROUND})`}>
              <rect x={-60} y={-120} width={120} height={120} fill="#5E4830" stroke="#3E2F20" strokeWidth={4} />
            </g>
            <g transform={`translate(300 ${GROUND}) scale(${S})`}>
              <GroundShadow w={130} opacity={0.4} color="#000" />
              <Hero pose={sit} outfit="casual" rimFilter="rimLamp" />
            </g>
          </g>
        )}
        {dog && (
          <g transform={`translate(740 ${GROUND}) scale(1.9)`} opacity={enter}>
            <GroundShadow w={170} opacity={0.45} color="#000" />
            <Dog pose={{ ...dogLie(frame, 5), head: 4 }} rimFilter="rimLamp" />
          </g>
        )}
      </g>
      {/* тонировка, лампа и радио поверх */}
      <rect width={1080} height={1920} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.5} />
      <g transform={`rotate(${swing} ${lx} 120)`}>
        <line x1={lx} y1={120} x2={lx} y2={ly - 20} stroke="#0A0D13" strokeWidth={4} />
        <path d={`M ${lx - 40} ${ly - 10} L ${lx + 40} ${ly - 10} L ${lx + 24} ${ly - 34} L ${lx - 24} ${ly - 34} Z`} fill="#2B3241" />
        <circle cx={lx} cy={ly + 6} r={16} fill="#FFE2A8" opacity={flick} />
        <circle cx={lx} cy={ly + 150} r={560} fill="url(#lampGlow)" opacity={flick} style={{ mixBlendMode: "screen" }} />
      </g>
      {radio > 0 && <circle cx={580} cy={GROUND - 150} r={200} fill="url(#radioGlow)" opacity={radio} style={{ mixBlendMode: "screen" }} />}
    </svg>
  );
};

/* ============================ СИРЕНА: красная пульсация по краям ============================ */
export const SirenPulse: React.FC<{ f: number; from: number; amount?: number }> = ({ f, from, amount = 1 }) => {
  if (f < from) return null;
  const k = Math.min(1, (f - from) / 6) * amount;
  const p = 0.5 + 0.5 * Math.sin(((f - from) / 30) * 2 * Math.PI * 1.1);
  return <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${Math.round(160 + 120 * p)}px rgba(229,57,53,${(0.55 * k * (0.4 + 0.6 * p)).toFixed(3)})` }} />;
};

/* Громкоговоритель на столбе с волнами звука. */
export const SirenPole: React.FC<{ f: number; y?: number }> = ({ f, y = 760 }) => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    <rect x={530} y={y - 380} width={20} height={380} fill="#2B3241" />
    <g transform={`translate(540 ${y - 400})`}>
      <path d="M -10 -30 L -130 -80 L -130 40 L -10 -10 Z" fill="#3A4560" stroke="#0A0D13" strokeWidth={5} />
      <path d="M 10 -30 L 130 -80 L 130 40 L 10 -10 Z" fill="#3A4560" stroke="#0A0D13" strokeWidth={5} />
      <rect x={-16} y={-40} width={32} height={40} rx={6} fill="#4E5868" />
      {[0, 1, 2].map((i) => {
        const ph = ((f / 18 + i / 3) % 1);
        return (
          <g key={i} opacity={1 - ph}>
            <path d={`M ${-150 - ph * 160} ${-110 - ph * 60} Q ${-210 - ph * 200} -20 ${-150 - ph * 160} ${70 + ph * 60}`} stroke={SRYV.fail} strokeWidth={8} fill="none" strokeLinecap="round" />
            <path d={`M ${150 + ph * 160} ${-110 - ph * 60} Q ${210 + ph * 200} -20 ${150 + ph * 160} ${70 + ph * 60}`} stroke={SRYV.fail} strokeWidth={8} fill="none" strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  </svg>
);

/* Обратный отсчёт до пыли — HUD сверху по центру. */
export const Countdown: React.FC<{ secLeft: number; safe?: number; opacity?: number }> = ({ secLeft, safe = 0, opacity = 1 }) => {
  const s = Math.max(0, Math.round(secLeft));
  const txt = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const c = safe > 0.5 ? SRYV.progress : SRYV.fail;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", justifyContent: "center", opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 30px", borderRadius: 16, background: "rgba(14,17,24,0.85)",
        border: `3px solid ${c}`, boxShadow: `0 0 20px ${c}66` }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 60, lineHeight: 1, color: "#FFFFFF", letterSpacing: 2 }}>{safe > 0.5 ? "В УКРЫТИИ" : txt}</div>
      </div>
    </div>
  );
};
export { shade };

/* ============================ ДОМА: вспышка в окне ============================ */
/**
 * Комната Артёма ночью. Окно слева — в нём город; вспышка заливает окно и пол белым,
 * потом зарево. Ударная волна: тряска, трещины, осколки у окна. Пол поднят до y=920 (выше субтитров).
 * hero: "stand" — стоит у кровати лицом к окну; "prone" — лежит на полу лицом вниз, ногами к окну.
 */
export const HomeRoom: React.FC<{ frame: number; flash?: number; glow?: number; shake?: number; crack?: number; hero?: "stand" | "prone"; eyesShut?: boolean; zoom?: number }> = ({
  frame, flash = 0, glow = 0, shake = 0, crack = 0, hero = "stand", eyesShut = false, zoom = 1,
}) => {
  const FL = 920;
  const sx = shake ? Math.round((random(`hx${frame}`) - 0.5) * 26 * shake) : 0;
  const sy = shake ? Math.round((random(`hy${frame}`) - 0.5) * 18 * shake) : 0;
  const W0 = 70, W1 = 430, T0 = 300, T1 = 740; // окно
  const stand: HeroPose = {
    ...NEUTRAL, torso: 1 + Math.sin(frame / 18), head: Math.sin(frame / 27) * 1.5,
    armL: { sh: 8, el: -14, wr: 0 }, armR: { sh: -6, el: -12, wr: 0 },
    expr: { brow: eyesShut ? -0.6 : 0.2, browTilt: eyesShut ? 1 : 0, mouth: "flat", blink: eyesShut ? 1 : frame % 80 < 3 ? 1 : 0 },
  };
  const windowFill = flash > 0.05 ? "#FFF8EA" : SRYV.bg0;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimWin" side={-1} color={GLOW} strength={0.9} width={6} />
      <defs>
        <clipPath id="winClipH"><rect x={W0} y={T0} width={W1 - W0} height={T1 - T0} /></clipPath>
        <filter id="beamBlur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={18} /></filter>
      </defs>
      <g transform={`translate(${540 + sx} ${FL + sy}) scale(${zoom}) translate(-540 ${-FL})`}>
        {/* стена */}
        <rect x={-300} y={-300} width={1680} height={FL + 300} fill={SRYV.bg1} />
        {/* окно: город за стеклом */}
        <rect x={W0} y={T0} width={W1 - W0} height={T1 - T0} fill={windowFill} />
        <g clipPath="url(#winClipH)">
          {glow > 0 && <ellipse cx={330} cy={610} rx={300} ry={220} fill={GLOW} opacity={0.75 * glow} />}
          <path d={`M ${W0} 590 L 140 590 L 140 530 L 220 530 L 220 620 L 300 620 L 300 550 L ${W1} 550 L ${W1} ${T1} L ${W0} ${T1} Z`} fill={flash > 0.05 ? "#D9CFC0" : "#0B0E14"} />
          {glow < 0.3 && flash < 0.05 && [[100, 620], [180, 560], [250, 650], [340, 590], [390, 670]].map(([x, y], i) => <rect key={i} x={x} y={y} width={16} height={22} fill={SRYV.lamp} opacity={0.8} />)}
        </g>
        {/* трещины по стеклу */}
        {crack > 0 && (
          <g stroke="#DDE6F2" strokeWidth={4} fill="none" opacity={crack} strokeLinecap="round">
            <g transform="translate(0 50)"><path d="M 250 420 L 170 330 L 120 300 M 250 420 L 360 340 L 410 300 M 250 420 L 300 560 L 330 680 M 250 420 L 150 520 L 80 560 M 250 420 L 390 470" />
            <path d="M 170 330 L 200 280 M 300 560 L 380 590 M 150 520 L 160 620" /></g>
          </g>
        )}
        <rect x={W0} y={T0} width={W1 - W0} height={T1 - T0} fill="none" stroke="#0A0D13" strokeWidth={16} />
        <line x1={(W0 + W1) / 2} x2={(W0 + W1) / 2} y1={T0} y2={T1} stroke="#0A0D13" strokeWidth={10} />
        <rect x={W0 - 20} y={T1} width={W1 - W0 + 40} height={16} fill="#0A0D13" />
        {/* дверь и кровать */}
        <rect x={800} y={FL - 640} width={280} height={640} fill="#121722" stroke="#0A0D13" strokeWidth={6} />
        <circle cx={826} cy={FL - 300} r={12} fill="#3A4560" />
        <g transform={`translate(560 ${FL})`}>
          <rect x={-10} y={-120} width={230} height={70} rx={10} fill="#2B3241" />
          <rect x={-10} y={-60} width={230} height={60} fill="#1E2535" />
          <rect x={-22} y={-160} width={22} height={160} fill="#1E2535" />
        </g>
        {/* пол */}
        <rect x={-300} y={FL} width={1680} height={1300} fill={SRYV.bg0} />
        {[50, 130, 240, 380, 560].map((d) => <line key={d} x1={-300} x2={1380} y1={FL + d} y2={FL + d} stroke="#1C2331" strokeWidth={3} />)}
        <rect x={-300} y={FL - 18} width={1680} height={18} fill="#0A0D13" />
        {/* осколки у окна */}
        {crack > 0 && Array.from({ length: 14 }, (_, i) => {
          const x = 90 + random(`sh${i}`) * 380, y = FL + 10 + random(`shy${i}`) * 90, r = random(`shr${i}`) * 180;
          return <path key={i} d="M 0 0 L 18 -6 L 10 10 Z" transform={`translate(${x} ${y}) rotate(${r})`} fill="#C9D6E6" opacity={0.8 * crack} />;
        })}
        {/* герой */}
        {hero === "stand" ? (
          <g transform={`translate(640 ${FL}) scale(${-S} ${S})`}>
            <GroundShadow w={130} opacity={0.4} color="#000" />
            <Hero pose={stand} outfit="casual" rimFilter="rimWin" />
          </g>
        ) : (
          <g transform={`translate(330 ${FL - 34}) scale(${S}) rotate(90)`}>
            <Hero pose={{ ...PRONE, torso: 0.6 * Math.sin(frame / 9) }} outfit="casual" rimFilter="rimWin" />
          </g>
        )}
      </g>
      {/* ночная тонировка; свет окна — поверх */}
      <rect width={1080} height={1920} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.5} />
      {(flash > 0 || glow > 0) && (
        <g transform={`translate(${sx} ${sy})`} style={{ mixBlendMode: "screen" }}>
          <path d={`M ${W0} ${T0} L ${W1} ${T0} L 980 ${FL + 260} L 300 ${FL + 260} Z`} fill={flash > 0.05 ? "#FFF3D6" : GLOW}
            opacity={flash > 0.05 ? 0.55 * flash : 0.12 * glow} filter="url(#beamBlur)" />
        </g>
      )}
      {flash > 0 && <rect width={1080} height={1920} fill="#FFF8EA" opacity={0.5 * flash} />}
    </svg>
  );
};
