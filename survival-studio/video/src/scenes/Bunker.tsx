import React from "react";
import { random } from "remotion";
import { Hero, HeroPose, NEUTRAL } from "../rig/Hero";
import { Dog, dogLie } from "../rig/Dog";
import { heroGait, RUN } from "../rig/gait";
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
  boom?: number;   // секунды после взрыва — ядерный гриб над городом
};
const FAR = [[0, 640, 150], [140, 560, 120], [250, 700, 170], [410, 520, 110], [510, 610, 160], [660, 470, 130], [780, 650, 150], [920, 560, 170]];
const NEAR = [[-20, 760, 230], [200, 840, 180], [690, 800, 200], [880, 720, 230]];

export const NightCity: React.FC<CityProps> = ({ frame, flash = 0, glow = 0, shake = 0, dust = 0, wave = 0, hero, zoom = 1, lift = 0, boom }) => {
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
        {boom !== undefined && <Mushroom t={boom} />}
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
      {/* искры и пепел, летящие вверх от взрыва */}
      {boom !== undefined && (
        <g>
          {Array.from({ length: 70 }, (_, i) => {
            const sp = 60 + random(`es${i}`) * 140;
            const y = GROUND + 200 - ((random(`ey${i}`) * 1400 + boom * sp) % 1500);
            const x = 360 + random(`ex${i}`) * 720 + Math.sin(boom * 2 + i) * 14;
            const hot = i % 3 === 0;
            return <circle key={i} cx={Math.round(x)} cy={Math.round(y)} r={hot ? 3.5 : 2.5} fill={hot ? "#FFD08A" : GLOW} opacity={hot ? 0.9 : 0.6} />;
          })}
        </g>
      )}
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
/**
 * Бетонный подвал, одна лампа, полки с водой и консервами, радио на ящике. Артём сидит на ящике, Луна лежит рядом.
 * cam: точка мира (x, y) ставится в точку экрана (540, 760) с увеличением z — наезд на предмет правила.
 * Предметы (0..1): vent — решётка вентиляции (taped — заклеена плёнкой и скотчем), jugs — канистры и миска Луны,
 * bucket — ведро с мешком, torch — фонарик со светом, candle — свеча, dustFall — пыль с потолка.
 */
export type ShelterCam = { x: number; y: number; z: number };
export const SHELTER_HOME: ShelterCam = { x: 540, y: 760, z: 1 };
export const lerpCam = (a: ShelterCam, b: ShelterCam, k: number): ShelterCam => {
  const e = k * k * (3 - 2 * k);
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, z: a.z + (b.z - a.z) * e };
};
export const Shelter: React.FC<{
  frame: number; radio?: number; lamp?: number; zoom?: number; hero?: boolean; dog?: boolean; enter?: number; cam?: ShelterCam;
  vent?: number; taped?: number; jugs?: number; bucket?: number; torch?: number; candle?: number; dustFall?: number; static_?: number; cansMark?: number;
}> = ({
  frame, radio = 0, lamp = 1, zoom = 1, hero = true, dog = true, enter = 1, cam,
  vent = 0, taped = 0, jugs = 0, bucket = 0, torch = 0, candle = 0, dustFall = 0, static_ = 0, cansMark = 0,
}) => {
  const swing = Math.sin(frame / 40) * 3 + (dustFall > 0 ? Math.sin(frame / 9) * 3 * dustFall : 0);
  const flick = lamp * (random(`fl${Math.floor(frame / 3)}`) < (dustFall > 0 ? 0.18 : 0.04) ? 0.55 : 1);
  const sit: HeroPose = {
    ...NEUTRAL, y: -66, torso: 18 + 1 * Math.sin(frame / 18), head: 10 + Math.sin(frame / 25),
    legL: { hip: -84, knee: 92, foot: 0 }, legR: { hip: -80, knee: 88, foot: 0 },
    armL: { sh: -38, el: -52, wr: 0 }, armR: { sh: -32, el: -56, wr: 0 },
    expr: { brow: -0.3, browTilt: 0.8, mouth: "flat", blink: frame % 90 < 4 ? 1 : 0 },
  };
  const lx = 520, ly = 300;
  const c = cam ?? { x: 540, y: GROUND - (GROUND - 760) / zoom, z: zoom };
  const T = `translate(540 760) scale(${c.z}) translate(${-c.x} ${-c.y})`;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimLamp" side={-1} color={SRYV.lamp} strength={0.9} width={6} />
      <defs>
        <radialGradient id="lampGlow"><stop offset="0" stopColor={SRYV.lamp} stopOpacity={0.55} /><stop offset="1" stopColor={SRYV.lamp} stopOpacity={0} /></radialGradient>
        <radialGradient id="radioGlow"><stop offset="0" stopColor={SRYV.progress} stopOpacity={0.5} /><stop offset="1" stopColor={SRYV.progress} stopOpacity={0} /></radialGradient>
        <radialGradient id="candleGlow"><stop offset="0" stopColor="#FFC46B" stopOpacity={0.7} /><stop offset="1" stopColor="#FFC46B" stopOpacity={0} /></radialGradient>
        <linearGradient id="torchBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFF3D0" stopOpacity={0.55} /><stop offset="1" stopColor="#FFF3D0" stopOpacity={0} /></linearGradient>
      </defs>
      <g transform={T}>
        {/* стены из блоков */}
        <rect x={-600} y={-300} width={2280} height={GROUND + 300} fill="#1A1F28" />
        {Array.from({ length: 16 }, (_, r) => Array.from({ length: 10 }, (_, cc) => (
          <rect key={`${r}-${cc}`} x={-300 + cc * 180 + (r % 2) * 90} y={140 + r * 64} width={174} height={58} fill="none" stroke="#232A36" strokeWidth={4} />
        )))}
        {/* труба под потолком */}
        <rect x={-600} y={200} width={2280} height={34} fill="#2B3241" />
        {[120, 600, 980].map((x) => <rect key={x} x={x} y={192} width={22} height={50} fill="#353D4E" />)}
        {/* железная дверь слева */}
        <g>
          <rect x={-10} y={GROUND - 430} width={190} height={430} fill="#2B3241" stroke="#0A0D13" strokeWidth={8} />
          {[0, 1, 2].map((i) => <rect key={i} x={10} y={GROUND - 410 + i * 140} width={150} height={120} fill="none" stroke="#3A4560" strokeWidth={4} />)}
          <rect x={150} y={GROUND - 240} width={14} height={50} rx={4} fill="#4E5868" />
          <rect x={-10} y={GROUND - 8} width={190} height={6} fill={SRYV.lamp} opacity={0.35} />
        </g>
        {/* решётка вентиляции над дверью */}
        {vent > 0 && (
          <g opacity={vent}>
            <rect x={20} y={GROUND - 600} width={130} height={90} fill="#0E1118" stroke="#4E5868" strokeWidth={6} />
            {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={28} x2={142} y1={GROUND - 588 + i * 16} y2={GROUND - 588 + i * 16} stroke="#4E5868" strokeWidth={5} />)}
            {taped > 0 && (
              <g opacity={taped}>
                <rect x={10} y={GROUND - 610} width={150} height={110} fill="#C9D6E6" opacity={0.35} />
                <line x1={6} y1={GROUND - 612} x2={6 + 158 * Math.min(1, taped * 2)} y2={GROUND - 612 + 114 * Math.min(1, taped * 2)} stroke="#E8C547" strokeWidth={16} strokeLinecap="round" />
                <line x1={164} y1={GROUND - 612} x2={164 - 158 * Math.max(0, taped * 2 - 1)} y2={GROUND - 612 + 114 * Math.max(0, taped * 2 - 1)} stroke="#E8C547" strokeWidth={16} strokeLinecap="round" />
              </g>
            )}
            {taped < 1 && Array.from({ length: 16 }, (_, i) => {
              const k = ((frame * 0.03 + random(`vd${i}`)) % 1);
              return <circle key={i} cx={85 + (random(`vx${i}`) - 0.5) * 100 + k * 60} cy={GROUND - 500 + k * 220} r={4} fill="#B9B2A6" opacity={(1 - k) * (1 - taped) * 0.8} />;
            })}
          </g>
        )}
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
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={716 + i * 62} y={620} width={50} height={60} rx={6} fill="#7B8798" stroke="#4E5868" strokeWidth={3} />
              <rect x={716 + i * 62} y={636} width={50} height={22} fill="#B85A30" opacity={0.8} />
            </g>
          ))}
          {cansMark > 0 && <rect x={706} y={608} width={322} height={84} rx={12} fill="none" stroke={SRYV.progress} strokeWidth={6} opacity={cansMark * (0.6 + 0.4 * Math.sin(frame / 5))} />}
          {[0, 1, 2].map((i) => <rect key={i} x={720 + i * 100} y={770} width={88} height={70} rx={4} fill="#8A6B47" stroke="#5E4830" strokeWidth={3} />)}
        </g>
        {/* пол */}
        <rect x={-600} y={GROUND} width={2280} height={900} fill="#11151C" />
        <rect x={-600} y={GROUND - 16} width={2280} height={16} fill="#0A0D13" />
        {/* канистры с водой у полок */}
        {jugs > 0 && (
          <g opacity={jugs}>
            {[870, 960].map((x) => (
              <g key={x}>
                <rect x={x - 38} y={GROUND - 120} width={76} height={120} rx={10} fill="#5AA9FF" opacity={0.45} stroke="#8FBCEB" strokeWidth={4} />
                <rect x={x - 14} y={GROUND - 138} width={28} height={20} rx={4} fill="#3A6EA8" />
                <rect x={x - 38} y={GROUND - 70} width={76} height={70} rx={8} fill="#5AA9FF" opacity={0.35} />
              </g>
            ))}
          </g>
        )}
        {/* ведро с мешком у двери */}
        {bucket > 0 && (
          <g opacity={bucket} transform={`translate(130 ${GROUND})`}>
            <path d="M -50 -110 L 50 -110 L 40 0 L -40 0 Z" fill="#5E6B7E" stroke="#2B3241" strokeWidth={4} />
            <path d="M -56 -110 Q -40 -128 -20 -112 Q 0 -130 20 -112 Q 40 -128 56 -110" fill="#1A1F28" stroke="#0A0D13" strokeWidth={3} />
            <path d="M -50 -104 Q 0 -150 50 -104" fill="none" stroke="#2B3241" strokeWidth={4} />
            <g transform="translate(-95 0)">
              <path d="M -30 0 L -26 -60 L 26 -60 L 30 0 Z" fill="#C9B48A" stroke="#8A7650" strokeWidth={3} />
              <path d="M -26 -60 Q 0 -74 26 -60" fill="#E2CFA0" />
            </g>
          </g>
        )}
        {/* ящик с радио */}
        <g transform={`translate(560 ${GROUND})`}>
          <rect x={-70} y={-110} width={140} height={110} fill="#5E4830" stroke="#3E2F20" strokeWidth={4} />
          <g transform="translate(0 -110)">
            <rect x={-56} y={-62} width={112} height={62} rx={8} fill="#2B3241" stroke="#0A0D13" strokeWidth={4} />
            <circle cx={-26} cy={-31} r={18} fill="#1A1F28" stroke="#4E5868" strokeWidth={3} />
            <rect x={6} y={-44} width={38} height={14} rx={3} fill={SRYV.progress} opacity={0.25 + 0.75 * radio} />
            {static_ > 0 && Array.from({ length: 5 }, (_, i) => <line key={i} x1={6} x2={44} y1={-41 + i * 2} y2={-41 + i * 2} stroke="#C9D6E6" strokeWidth={1.4} opacity={random(`st${frame}-${i}`) * static_} />)}
            <line x1={30} y1={-62} x2={60} y2={-120} stroke="#4E5868" strokeWidth={4} />
          </g>
          {/* свеча (пример: так нельзя) */}
          {candle > 0 && (
            <g opacity={candle} transform="translate(-44 -110)">
              <rect x={-9} y={-56} width={18} height={56} rx={3} fill="#EDE6D6" />
              <path d={`M 0 -58 Q ${-8 + Math.sin(frame / 3) * 2} -72 0 ${-92 + Math.sin(frame / 4) * 3} Q 8 -72 0 -58 Z`} fill="#FFC46B" />
            </g>
          )}
          {/* фонарик */}
          {torch > 0 && (
            <g transform="translate(40 -122)">
              <path d="M 0 -8 L 40 -12 L 40 12 L 0 8 Z" fill="#2B3241" stroke="#0A0D13" strokeWidth={3} />
              <rect x={40} y={-15} width={12} height={30} rx={3} fill="#4E5868" />
            </g>
          )}
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
        {/* миска Луны */}
        {jugs > 0 && (
          <g opacity={jugs} transform={`translate(660 ${GROUND})`}>
            <path d="M -40 -30 L 40 -30 L 30 0 L -30 0 Z" fill="#B85A30" stroke="#6E3B26" strokeWidth={3} />
            <ellipse cx={0} cy={-30} rx={40} ry={8} fill="#5AA9FF" opacity={0.7} />
          </g>
        )}
      </g>
      {/* тонировка */}
      <rect width={1080} height={1920} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.5} />
      <g transform={T}>
        {/* лампа */}
        <g transform={`rotate(${swing} ${lx} 120)`}>
          <line x1={lx} y1={120} x2={lx} y2={ly - 20} stroke="#0A0D13" strokeWidth={4} />
          <path d={`M ${lx - 40} ${ly - 10} L ${lx + 40} ${ly - 10} L ${lx + 24} ${ly - 34} L ${lx - 24} ${ly - 34} Z`} fill="#2B3241" />
          <circle cx={lx} cy={ly + 6} r={16} fill="#FFE2A8" opacity={flick} />
          <circle cx={lx} cy={ly + 150} r={560} fill="url(#lampGlow)" opacity={flick} style={{ mixBlendMode: "screen" }} />
        </g>
        {radio > 0 && <circle cx={580} cy={GROUND - 150} r={200} fill="url(#radioGlow)" opacity={radio} style={{ mixBlendMode: "screen" }} />}
        {candle > 0 && <circle cx={516} cy={GROUND - 190} r={220} fill="url(#candleGlow)" opacity={candle * (0.85 + 0.15 * Math.sin(frame / 3))} style={{ mixBlendMode: "screen" }} />}
        {torch > 0 && <path d={`M 652 ${GROUND - 122} L 1100 ${GROUND - 330} L 1100 ${GROUND + 60} Z`} fill="url(#torchBeam)" opacity={torch} style={{ mixBlendMode: "screen" }} />}
        {/* пыль, сыплющаяся с потолка */}
        {dustFall > 0 && Array.from({ length: 50 }, (_, i) => {
          const x = random(`cf${i}`) * 1080;
          const y = 240 + ((random(`cy${i}`) * 900 + frame * (2 + random(`cs${i}`) * 3)) % 900);
          return <circle key={i} cx={x} cy={y} r={2 + random(`cr${i}`) * 2} fill="#C9C0B0" opacity={0.6 * dustFall} />;
        })}
      </g>
    </svg>
  );
};

/* Счётчик «в укрытии»: часы, затем дни. */
export const ShelterClock: React.FC<{ hours: number; opacity?: number }> = ({ hours, opacity = 1 }) => {
  const txt = hours < 48 ? `${Math.max(1, Math.floor(hours))} Ч` : `ДЕНЬ ${Math.floor(hours / 24)}`;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 96, display: "flex", justifyContent: "center", opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "14px 30px", borderRadius: 16, background: "rgba(14,17,24,0.85)",
        border: `3px solid ${SRYV.progress}`, boxShadow: `0 0 20px ${SRYV.progress}55` }}>
        <div style={{ width: 18, height: 18, borderRadius: 9, background: SRYV.progress }} />
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 52, lineHeight: 1, color: "#FFFFFF", letterSpacing: 2 }}>В УКРЫТИИ · {txt}</div>
      </div>
    </div>
  );
};

/* Правило 7–10: три полосы излучения, длина — доля от исходного (в логарифмическом виде, чтобы 1% был виден). */
export const DecayBars: React.FC<{ f: number; at: [number, number, number]; y?: number }> = ({ f, at, y = 330 }) => {
  const rows = [
    { t: "1 ЧАС", p: "100%", w: 1, c: SRYV.fail },
    { t: "7 ЧАСОВ", p: "10%", w: 0.62, c: SRYV.lamp },
    { t: "2 СУТОК", p: "1%", w: 0.26, c: SRYV.progress },
  ];
  return (
    <div style={{ position: "absolute", left: 90, top: y, width: 900, display: "flex", flexDirection: "column", gap: 44 }}>
      <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 36, color: "#C9D2E0", letterSpacing: 4 }}>ИЗЛУЧЕНИЕ ОТ ПЫЛИ</div>
      {rows.map((r, i) => {
        const k = Math.min(1, Math.max(0, (f - at[i]) / 12));
        const e = k * k * (3 - 2 * k);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12, opacity: Math.min(1, k * 3) }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "Inter Display", fontWeight: 900, fontSize: 48, lineHeight: 1, color: "#FFFFFF" }}>
              <span>{r.t}</span><span style={{ color: r.c }}>{r.p}</span>
            </div>
            <div style={{ height: 54, borderRadius: 14, background: "#1C2331", overflow: "hidden" }}>
              <div style={{ width: `${Math.round(100 * r.w * e)}%`, height: "100%", borderRadius: 14, background: r.c, boxShadow: `0 0 20px ${r.c}88` }} />
            </div>
          </div>
        );
      })}
    </div>
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
export const HomeRoom: React.FC<{ frame: number; flash?: number; glow?: number; shake?: number; crack?: number; hero?: "phone" | "stand" | "prone"; eyesShut?: boolean; zoom?: number; siren?: number; radio?: number }> = ({
  frame, flash = 0, glow = 0, shake = 0, crack = 0, hero = "stand", eyesShut = false, zoom = 1, siren = 0, radio = 0,
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
  const phone: HeroPose = {
    ...stand, head: 16 + Math.sin(frame / 27), armL: { sh: -58, el: -84, wr: 6 * Math.sin(frame / 13) }, holdL: "phone", phoneGlow: 0.95,
    expr: { brow: 0, browTilt: 0, mouth: "flat", blink: frame % 80 < 3 ? 1 : 0 },
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
          {siren > 0 && flash < 0.05 && (
            <g opacity={siren}>
              <rect x={296} y={430} width={10} height={320} fill="#2B3241" />
              <g transform="translate(301 420)">
                <path d="M -4 -12 L -56 -34 L -56 18 L -4 -2 Z" fill="#3A4560" />
                <path d="M 4 -12 L 56 -34 L 56 18 L 4 -2 Z" fill="#3A4560" />
                {[0, 1, 2].map((i) => {
                  const ph = (frame / 18 + i / 3) % 1;
                  return (
                    <g key={i} opacity={1 - ph}>
                      <path d={`M ${-64 - ph * 70} ${-44 - ph * 26} Q ${-90 - ph * 90} -8 ${-64 - ph * 70} ${28 + ph * 26}`} stroke={SRYV.fail} strokeWidth={5} fill="none" strokeLinecap="round" />
                      <path d={`M ${64 + ph * 70} ${-44 - ph * 26} Q ${90 + ph * 90} -8 ${64 + ph * 70} ${28 + ph * 26}`} stroke={SRYV.fail} strokeWidth={5} fill="none" strokeLinecap="round" />
                    </g>
                  );
                })}
              </g>
            </g>
          )}
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
        {/* столик с радио */}
        <g transform={`translate(470 ${FL})`}>
          <rect x={-4} y={-150} width={110} height={14} fill="#2B3241" />
          <rect x={6} y={-136} width={10} height={136} fill="#1E2535" /><rect x={86} y={-136} width={10} height={136} fill="#1E2535" />
          <g transform="translate(50 -150)">
            <rect x={-42} y={-46} width={84} height={46} rx={6} fill="#2B3241" stroke="#0A0D13" strokeWidth={3} />
            <circle cx={-18} cy={-23} r={13} fill="#1A1F28" stroke="#4E5868" strokeWidth={2} />
            <rect x={4} y={-34} width={28} height={10} rx={2} fill={SRYV.progress} opacity={0.2 + 0.8 * radio} />
            <line x1={22} y1={-46} x2={44} y2={-90} stroke="#4E5868" strokeWidth={3} />
          </g>
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
        {hero !== "prone" ? (
          <g transform={`translate(660 ${FL}) scale(${-S} ${S})`}>
            <GroundShadow w={130} opacity={0.4} color="#000" />
            <Hero pose={hero === "phone" ? phone : stand} outfit="casual" rimFilter="rimWin" />
          </g>
        ) : (
          <g transform={`translate(330 ${FL - 34}) scale(${S}) rotate(90)`}>
            <Hero pose={{ ...PRONE, torso: 0.6 * Math.sin(frame / 9) }} outfit="casual" rimFilter="rimWin" />
          </g>
        )}
      </g>
      {/* ночная тонировка; свет окна — поверх */}
      <rect width={1080} height={1920} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.5} />
      {radio > 0 && <circle cx={520} cy={FL - 190} r={80} fill={SRYV.progress} opacity={0.14 * radio} style={{ mixBlendMode: "screen" }} filter="url(#beamBlur)" />}
      {siren > 0 && <rect x={W0} y={T0} width={W1 - W0} height={T1 - T0} fill={SRYV.fail} opacity={siren * (0.12 + 0.1 * Math.sin(frame / 4.5))} style={{ mixBlendMode: "screen" }} />}
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

/* ============================ ДВОР: машина и кирпичный дом ============================ */
/** Ночь после вспышки: зарево, оседает пыль. Слева машина, справа кирпичная пятиэтажка с подъездом. Земля y=930. */
export const Yard: React.FC<{ frame: number; carMark?: number; doorLit?: number; runAt?: number; zoom?: number }> = ({
  frame, carMark = 0, doorLit = 0, runAt = 1e9, zoom = 1,
}) => {
  const FL = 930, DOOR = 800;
  // Артём: стоит у машины, потом бежит к подъезду и скрывается в двери
  const running = frame >= runAt;
  const p0 = heroGait(0, RUN);
  const g = running ? heroGait(frame - runAt, RUN, { expr: { brow: 0.2, browTilt: -0.4, mouth: "flat", blink: 0 } }) : null;
  const dx = g ? Math.min(DOOR - 170, (g.x - p0.x) * 1.7) : 0;
  const inDoor = dx >= DOOR - 170 - 1;
  const heroOp = inDoor ? Math.max(0, 1 - (frame - runAt - Math.ceil((DOOR - 170) / (17.5 * 1.7))) / 6) : 1;
  const standPose: HeroPose = { ...NEUTRAL, torso: 2 + Math.sin(frame / 18), head: -4, expr: { brow: -0.3, browTilt: 0.8, mouth: "flat", blink: frame % 80 < 3 ? 1 : 0 } };
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimYard" side={-1} color={GLOW} strength={0.8} width={5} />
      <defs>
        <radialGradient id="yardGlow"><stop offset="0" stopColor={GLOW} stopOpacity={0.7} /><stop offset="1" stopColor={GLOW} stopOpacity={0} /></radialGradient>
        <filter id="doorBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={20} /></filter>
      </defs>
      <g transform={`translate(540 ${FL}) scale(${zoom}) translate(-540 ${-FL})`}>
        <rect x={-300} y={-300} width={1680} height={FL + 300} fill={SRYV.bg0} />
        <ellipse cx={160} cy={560} rx={560} ry={380} fill="url(#yardGlow)" />
        {/* дальние дома без света */}
        {[[-40, 520, 180], [150, 600, 160], [300, 470, 150]].map(([x, top, w], i) => <rect key={i} x={x} y={top} width={w} height={FL - top} fill="#10141D" />)}
        {/* кирпичная пятиэтажка */}
        <rect x={600} y={240} width={520} height={FL - 240} fill="#4A2E27" />
        {Array.from({ length: 34 }, (_, r) => (
          <line key={r} x1={600} x2={1120} y1={252 + r * 20} y2={252 + r * 20} stroke="#3A231E" strokeWidth={3} />
        ))}
        {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={640 + c * 150} y={280 + r * 130} width={80} height={80} fill="#0E1118" stroke="#2A1A16" strokeWidth={6} />
        )))}
        {/* подъезд */}
        <rect x={DOOR - 70} y={FL - 210} width={140} height={210} fill={doorLit > 0 ? "#3A2E1E" : "#0E1118"} stroke="#2A1A16" strokeWidth={8} />
        <rect x={DOOR - 90} y={FL - 230} width={180} height={20} fill="#2A1A16" />
        {doorLit > 0 && <rect x={DOOR - 62} y={FL - 202} width={124} height={202} fill={SRYV.lamp} opacity={0.35 * doorLit} />}
        {/* земля */}
        <rect x={-300} y={FL} width={1680} height={1200} fill="#07090D" />
        <rect x={-300} y={FL} width={1680} height={8} fill="#1C2331" />
        {/* машина */}
        <g transform={`translate(300 ${FL})`}>
          <path d="M -170 -24 L -170 -70 Q -166 -86 -140 -90 L -90 -96 L -50 -140 L 70 -140 L 120 -96 L 160 -90 Q 176 -84 176 -64 L 176 -24 Z" fill="#232A36" stroke="#0A0D13" strokeWidth={5} />
          <path d="M -40 -132 L 64 -132 L 104 -98 L -76 -98 Z" fill="#141924" />
          <circle cx={-100} cy={-22} r={30} fill="#0A0D13" stroke="#3A4560" strokeWidth={5} />
          <circle cx={110} cy={-22} r={30} fill="#0A0D13" stroke="#3A4560" strokeWidth={5} />
          {/* пыль на крыше и капоте */}
          <path d="M -50 -142 L 70 -142" stroke="#B9B2A6" strokeWidth={5} opacity={0.7} />
          <path d="M -168 -72 L -96 -94 M 124 -94 L 172 -88" stroke="#B9B2A6" strokeWidth={4} opacity={0.7} />
          {carMark > 0 && (
            <g opacity={carMark} stroke={SRYV.fail} strokeWidth={14} strokeLinecap="round">
              <line x1={-150} y1={-170} x2={150} y2={0} /><line x1={150} y1={-170} x2={-150} y2={0} />
            </g>
          )}
        </g>
        {/* Артём */}
        <g opacity={heroOp}>
          <g transform={`translate(${120 + dx} ${FL}) scale(1.7)`}>
            <GroundShadow w={120} opacity={0.4} color="#000" />
            <g transform={`translate(${g ? -g.x : 0} 0)`}><Hero pose={g ?? standPose} outfit="casual" rimFilter="rimYard" /></g>
          </g>
        </g>
      </g>
      <rect width={1080} height={1920} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.35} />
      {doorLit > 0 && <rect x={720} y={FL - 220} width={160} height={260} fill={SRYV.lamp} opacity={0.25 * doorLit} filter="url(#doorBlur)" style={{ mixBlendMode: "screen" }} />}
      {/* оседающая пыль */}
      <g>
        {Array.from({ length: 110 }, (_, i) => {
          const near = i % 4 === 0;
          const x = random(`yx${i}`) * 1080 + Math.sin(frame / 30 + i) * 10;
          const y = ((random(`yy${i}`) * 2100 + frame * (near ? 2.6 : 1.4)) % 2100) - 120;
          return <circle key={i} cx={Math.round(x)} cy={Math.round(y)} r={near ? 6 : 3} fill="#B9B2A6" opacity={near ? 0.45 : 0.7} />;
        })}
      </g>
    </svg>
  );
};

/* ============================ ЯДЕРНЫЙ ГРИБ ============================ */
/** Стилизованный гриб: огненный шар поднимается и тускнеет, «шапка» из клубов катится, ствол тянется, у земли — вал.
 *  Ударное кольцо и кольцо конденсации — в первые секунды. t — секунды после взрыва. */
const lerpC = (a: string, b: string, k: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return "#" + pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.min(1, Math.max(0, k))).toString(16).padStart(2, "0")).join("");
};
export const Mushroom: React.FC<{ t: number; gx?: number; gy?: number }> = ({ t, gx = 640, gy = 780 }) => {
  const rise = 1 - Math.exp(-t / 1.8);
  const r = 80 + 190 * (1 - Math.exp(-t / 0.6));
  const cy = gy - 150 - 380 * rise;
  const heat = Math.min(1, t / 5.5);
  const core = lerpC("#FFF6E0", "#FF7A2E", heat);
  const PUFFS = 22;
  const stemTop = cy + r * 0.45, wTop = r * 0.22, wBot = r * 0.34 + 30 * rise;
  const surge = 140 + 520 * (1 - Math.exp(-t / 1.3));
  const shockK = Math.min(1, t / 1.1);
  return (
    <g>
      <defs>
        <radialGradient id="mushGlow"><stop offset="0" stopColor="#FFE2B0" stopOpacity={0.9} /><stop offset="0.4" stopColor={GLOW} stopOpacity={0.55} /><stop offset="1" stopColor={GLOW} stopOpacity={0} /></radialGradient>
        <filter id="mushSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={6} /></filter>
      </defs>
      {/* свечение неба вокруг */}
      <circle cx={gx} cy={cy} r={r * 3.2} fill="url(#mushGlow)" opacity={0.9 - 0.35 * heat} />
      {/* ударное кольцо по горизонту */}
      {t < 1.3 && <ellipse cx={gx} cy={gy - 20} rx={60 + 1100 * shockK} ry={(60 + 1100 * shockK) * 0.12} fill="none" stroke="#FFF1D6" strokeWidth={8 * (1 - shockK) + 2} opacity={1 - shockK} />}
      {/* вал пыли у земли */}
      <ellipse cx={gx} cy={gy} rx={surge} ry={surge * 0.2} fill="#6B3E2A" opacity={0.85} filter="url(#mushSoft)" />
      <ellipse cx={gx} cy={gy - 10} rx={surge * 0.7} ry={surge * 0.13} fill="#8E5536" opacity={0.8} filter="url(#mushSoft)" />
      {/* ствол */}
      <path d={`M ${gx - wBot} ${gy} C ${gx - wBot * 0.5} ${(gy + stemTop) / 2} ${gx - wTop * 1.4} ${stemTop + 40} ${gx - wTop} ${stemTop}
        L ${gx + wTop} ${stemTop} C ${gx + wTop * 1.4} ${stemTop + 40} ${gx + wBot * 0.5} ${(gy + stemTop) / 2} ${gx + wBot} ${gy} Z`} fill="#6E3B26" />
      <path d={`M ${gx - wTop * 0.45} ${gy} L ${gx - wTop * 0.35} ${stemTop} L ${gx + wTop * 0.35} ${stemTop} L ${gx + wTop * 0.45} ${gy} Z`} fill={lerpC("#FFD9A0", "#B25A2E", heat)} opacity={0.75} />
      {/* шапка: клубы по тору, катятся */}
      {Array.from({ length: PUFFS }, (_, i) => {
        const a = (i / PUFFS) * Math.PI * 2 + t * 0.35;
        const px = gx + Math.cos(a) * r * 0.95;
        const py = cy + Math.sin(a) * r * 0.42;
        const pr = r * (0.36 + 0.14 * random(`pr${i}`));
        const front = Math.sin(a) > 0;
        return <circle key={i} cx={px} cy={py} r={pr} fill={front ? lerpC("#F08A44", "#8A4A2C", heat) : lerpC("#C0602F", "#5E3324", heat)} />;
      })}
      <ellipse cx={gx} cy={cy - r * 0.15} rx={r * 0.95} ry={r * 0.7} fill={lerpC("#D8763C", "#6E3B26", heat)} />
      {/* огненное ядро и подсветка снизу */}
      <ellipse cx={gx} cy={cy + r * 0.12} rx={r * 0.62} ry={r * 0.46} fill={core} filter="url(#mushSoft)" />
      <ellipse cx={gx} cy={cy + r * 0.2} rx={r * 0.34} ry={r * 0.22} fill="#FFF8EA" opacity={1 - heat * 0.8} />
      {/* кольцо конденсации */}
      {t > 0.3 && t < 2.6 && <ellipse cx={gx} cy={cy + r * 0.1} rx={r * 1.9} ry={r * 0.42} fill="none" stroke="#E8ECF2" strokeWidth={10} opacity={0.55 * Math.sin(Math.PI * (t - 0.3) / 2.3)} filter="url(#mushSoft)" />}
    </g>
  );
};

/* Большой таймер крючка: появляется с «глитчем», каждый тик — пульс. */
export const HookTimer: React.FC<{ f: number; at: number; tickAt: number; fps?: number; y?: number }> = ({ f, at, tickAt, fps = 30, y = 900 }) => {
  if (f < at) return null;
  const k = Math.min(1, (f - at) / 5);
  const ticks = f >= tickAt ? Math.floor((f - tickAt) / 6) + 1 : 0;   // тик каждые 0,2 с — время побежало
  const s = 900 - ticks;
  const txt = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const sincTick = f >= tickAt ? (f - tickAt) % 6 : 99;
  const pulse = sincTick < 3 ? 1.04 - sincTick * 0.013 : 1;
  const glitch = f - at < 5 ? Math.round((random(`g${f}`) - 0.5) * 30) : 0;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y - 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 10, opacity: k }}>
      <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 38, letterSpacing: 10, color: "#FF6B5E", lineHeight: 1 }}>У ТЕБЯ ОСТАЛОСЬ</div>
      <div style={{ position: "relative", transform: `scale(${(0.9 + 0.1 * k) * pulse}) translateX(${glitch}px)`, padding: "10px 46px", borderRadius: 28,
        background: "rgba(10,6,6,0.78)", border: "6px solid #FF3B30", boxShadow: "0 0 40px rgba(255,59,48,.55), inset 0 0 30px rgba(255,59,48,.25)" }}>
        {glitch !== 0 && <div style={{ position: "absolute", left: 46 + 8, top: 10, fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 200, lineHeight: 1, color: "#3FD0FF", opacity: 0.6 }}>{txt}</div>}
        <div style={{ position: "relative", fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 200, lineHeight: 1, color: "#FFFFFF", letterSpacing: 4,
          textShadow: "0 0 24px rgba(255,59,48,.9), 0 0 6px rgba(255,255,255,.6)" }}>{txt}</div>
      </div>
    </div>
  );
};
