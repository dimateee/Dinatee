import React from "react";
import { Hero, NEUTRAL } from "../rig/Hero";
import { Dog, DogPose, dogLie, dogSit } from "../rig/Dog";
import { POSES } from "../rig/poses";
import { Bed } from "../rig/props";
import { GroundShadow, RimDefs, shade } from "../rig/shared";
import { REGIME, SRYV } from "../style/palette";

/*
 * Сцены серии в кадре 1080×1920. Пол — y = FLOOR. Слои для параллакса:
 *   far (окно, дымка) · mid (стены, мебель) · chars · fg (размытый передний план).
 * cam: { zoom, x, y } — «живая» камера; слои сдвигаются с разными коэффициентами.
 */
export const FLOOR = 1150;
export type Cam = { zoom: number; x: number; y: number };
const NO_CAM: Cam = { zoom: 1, x: 0, y: 0 };
const S = 1.8; // масштаб персонажей в комнате
const DOOR_TOP = FLOOR - 720;

const layer = (cam: Cam, depth: number) =>
  `translate(540 ${FLOOR}) scale(${1 + (cam.zoom - 1) * depth}) translate(-540 ${-FLOOR}) translate(${cam.x * depth} ${cam.y * depth})`;

const Planks: React.FC<{ color: string; from?: number }> = ({ color, from = FLOOR }) => (
  <g stroke={color} strokeWidth={3} opacity={0.5}>
    {[60, 150, 270, 420, 610].map((d, i) => <line key={i} x1={0} x2={1080} y1={from + d} y2={from + d} />)}
  </g>
);

/* Часы без цифр — только метки. */
const WallClock: React.FC<{ x: number; y: number; h: number; m: number; face: string; ink: string }> = ({ x, y, h, m, face, ink }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={62} fill={face} stroke={ink} strokeWidth={8} />
    {Array.from({ length: 12 }, (_, i) => (
      <line key={i} x1={0} y1={-48} x2={0} y2={i % 3 ? -42 : -38} stroke={ink} strokeWidth={i % 3 ? 3 : 5} transform={`rotate(${i * 30})`} />
    ))}
    <line x1={0} y1={0} x2={0} y2={-28} stroke={ink} strokeWidth={7} strokeLinecap="round" transform={`rotate(${(h % 12) * 30 + m * 0.5})`} />
    <line x1={0} y1={0} x2={0} y2={-44} stroke={ink} strokeWidth={4} strokeLinecap="round" transform={`rotate(${m * 6})`} />
    <circle r={6} fill={ink} />
  </g>
);

const Sneakers: React.FC<{ x: number; tint?: string }> = ({ x, tint }) => (
  <g transform={`translate(${x} ${FLOOR}) scale(${S})`}>
    {[0, 34].map((dx) => (
      <g key={dx} transform={`translate(${dx} 0)`}>
        <path d="M -12 -2 L -12 -16 L 0 -18 L 6 -10 L 26 -6 Q 32 -4 30 -2 Z" fill={tint ?? "#EDE6D6"} stroke={shade(tint ?? "#EDE6D6", -0.5)} strokeWidth={1.6} />
        <rect x={-12} y={-3} width={42} height={3.5} rx={1.5} fill="#E8833A" />
      </g>
    ))}
  </g>
);

/* ------------------------------ УТРО · «РЕЖИМ» ------------------------------ */
export const RoomMorning: React.FC<{
  frame: number; cam?: Cam; heroPose?: typeof NEUTRAL; showHero?: boolean;
  heroOutfit?: "casual" | "sport"; heroX?: number; heroY?: number; heroRotate?: number; dogPose?: DogPose; dogX?: number; dogFlip?: boolean;
  bed?: boolean; showDog?: boolean;
}> = ({
  frame, cam = NO_CAM, heroPose, showHero = true, heroOutfit = "sport", heroX = 300, heroY = 0, heroRotate = 0,
  dogPose, dogX = 850, dogFlip = true, bed = false, showDog = true,
}) => {
  const hero = heroPose ?? POSES.laces.pose;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <RimDefs id="rimM" side={-1} color="#FFD7A0" strength={0.9} />
      <defs>
        <filter id="fgBlurM" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={16} /></filter>
        <filter id="softM" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation={30} /></filter>
      </defs>
      {/* FAR: стена и окно с рассветом */}
      <g transform={layer(cam, 0.5)}>
        <rect x={-200} y={-200} width={1480} height={FLOOR + 200} fill={REGIME.sky} />
        <g>
          <rect x={70} y={250} width={370} height={520} fill={REGIME.paper} />
          <circle cx={300} cy={640} r={54} fill={REGIME.dawn} />
          <path d="M 70 660 Q 180 600 300 650 T 440 640 L 440 770 L 70 770 Z" fill={REGIME.fog} />
          <path d="M 70 700 Q 200 670 320 710 T 440 700 L 440 770 L 70 770 Z" fill={shade(REGIME.sage, 0.15)} />
          <rect x={70} y={250} width={370} height={520} fill={REGIME.paper} opacity={0.28} />{/* дымка */}
          <rect x={70} y={250} width={370} height={520} fill="none" stroke={REGIME.olive} strokeWidth={16} />
          <line x1={255} x2={255} y1={250} y2={770} stroke={REGIME.olive} strokeWidth={10} />
          <line x1={70} x2={440} y1={500} y2={500} stroke={REGIME.olive} strokeWidth={10} />
          <rect x={56} y={770} width={398} height={18} rx={4} fill={shade(REGIME.olive, 0.2)} />
        </g>
      </g>
      {/* MID: пол, свет из окна, дверь, часы */}
      <g transform={layer(cam, 1)}>
        <rect x={-200} y={FLOOR} width={1480} height={1100} fill={REGIME.sage} />
        <Planks color={shade(REGIME.sage, -0.25)} />
        <rect x={-200} y={FLOOR - 22} width={1480} height={22} fill={REGIME.olive} />
        {/* солнечный «зайчик» на полу — мягкий направленный свет */}
        <path d="M 70 1170 L 460 1170 L 760 1520 L 230 1520 Z" fill={REGIME.paper} opacity={0.3} filter="url(#softM)" />
        <path d="M 440 300 L 560 300 L 560 760 L 440 770 Z" fill={REGIME.paper} opacity={0.25} filter="url(#softM)" />
        <WallClock x={565} y={330} h={6} m={30} face={REGIME.paper} ink={REGIME.olive} />
        <g>
          <rect x={740} y={DOOR_TOP} width={320} height={FLOOR - DOOR_TOP} fill={shade(REGIME.sage, -0.15)} stroke={REGIME.olive} strokeWidth={6} />
          <rect x={780} y={DOOR_TOP + 40} width={240} height={290} rx={8} fill="none" stroke={shade(REGIME.sage, -0.35)} strokeWidth={5} />
          <rect x={780} y={DOOR_TOP + 370} width={240} height={290} rx={8} fill="none" stroke={shade(REGIME.sage, -0.35)} strokeWidth={5} />
          <circle cx={770} cy={DOOR_TOP + 380} r={13} fill={REGIME.dawn} />
          {/* крючок у двери (пустой — поводок у Луны) */}
          <path d={`M 712 ${DOOR_TOP + 200} q 0 22 -16 22`} stroke={REGIME.olive} strokeWidth={7} fill="none" strokeLinecap="round" />
        </g>
      </g>
      {/* CHARS */}
      <g transform={layer(cam, 1)}>
        {bed && <g transform={`translate(${heroX - 150} ${FLOOR}) scale(${S})`}><Bed w={200} /></g>}
        {showHero && (
          <g transform={`translate(${heroX} ${FLOOR + heroY}) scale(${S})`}>
            {heroRotate === 0 && <GroundShadow w={150} opacity={0.25} />}
            <g transform={`rotate(${heroRotate})`}><Hero pose={hero} outfit={heroOutfit} rimFilter="rimM" /></g>
          </g>
        )}
        {showDog && (
          <g transform={`translate(${dogX} ${FLOOR}) scale(${dogFlip ? -S : S} ${S})`}>
            <GroundShadow w={150} opacity={0.25} />
            <Dog pose={dogPose ?? dogSit(frame, 1)} rimFilter="rimM" />
          </g>
        )}
      </g>
      {/* FG: размытый передний план — лист растения и край корзины */}
      <g transform={layer(cam, 1.6)} filter="url(#fgBlurM)">
        <path d="M -60 1920 Q -20 1660 120 1560 Q 200 1700 140 1920 Z" fill={REGIME.olive} />
        <path d="M 40 1920 Q 160 1640 330 1600 Q 300 1760 200 1920 Z" fill={shade(REGIME.olive, 0.15)} />
        <rect x={880} y={1680} width={320} height={300} rx={30} fill={shade(REGIME.dawn, -0.35)} />
      </g>
    </svg>
  );
};

/* ------------------------------ НОЧЬ · «СРЫВ» ------------------------------ */
export const RoomNight: React.FC<{ frame: number; cam?: Cam; glow?: number; rain?: boolean }> = ({ frame, cam = NO_CAM, glow = 1, rain = false }) => {
  // Артём лежит на кровати на спине, телефон над лицом
  const lying = {
    ...NEUTRAL, x: 0, y: 0, torso: 0, head: 8,
    legL: { hip: -2, knee: 10, foot: -70 }, legR: { hip: 3, knee: 8, foot: -72 },
    armL: { sh: -72, el: -64, wr: 0 }, armR: { sh: -40, el: -70, wr: 0 },
    holdL: "phone" as const, phoneGlow: glow,
    expr: { brow: -0.3, browTilt: 0.6, mouth: "flat" as const, blink: 0 },
  };
  const bedX = 380, bedTop = FLOOR - 70 * S;
  const phone = { x: bedX + 70, y: bedTop - 150 }; // экран телефона в кадре (подобрано по рендеру)
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      <RimDefs id="rimN" side={1} color={SRYV.screen} strength={0.75} />
      <RimDefs id="rimWarm" side={1} color={SRYV.lamp} strength={0.9} width={6} />
      <defs>
        <filter id="fgBlurN" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={16} /></filter>
        <filter id="lightBlurN" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation={22} /></filter>
        <clipPath id="winClipN"><rect x={70} y={250} width={340} height={480} /></clipPath>
        <radialGradient id="screenGlow">
          <stop offset="0" stopColor={SRYV.screen} stopOpacity={0.55} />
          <stop offset="1" stopColor={SRYV.screen} stopOpacity={0} />
        </radialGradient>
      </defs>
      {/* FAR */}
      <g transform={layer(cam, 0.5)}>
        <rect x={-200} y={-200} width={1480} height={FLOOR + 200} fill={SRYV.bg1} />
        <rect x={70} y={250} width={340} height={480} fill={SRYV.bg0} />
        <path d="M 70 520 L 150 520 L 150 460 L 240 460 L 240 560 L 330 560 L 330 500 L 410 500 L 410 730 L 70 730 Z" fill="#1E2535" />
        {[[100, 560], [190, 500], [200, 590], [270, 600], [360, 540], [370, 640]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={18} height={24} fill={SRYV.lamp} opacity={i % 2 ? 0.55 : 0.85} />
        ))}
        {rain && (
          <g clipPath="url(#winClipN)">
            {Array.from({ length: 34 }, (_, i) => {
              const x = 74 + ((i * 97) % 336);
              const y = 250 + (((i * 173) + frame * 26) % 520) - 40;
              return <line key={i} x1={x} y1={y} x2={x - 6} y2={y + 34} stroke="#8FA3C2" strokeWidth={3} strokeLinecap="round" opacity={0.55} />;
            })}
          </g>
        )}
        <rect x={70} y={250} width={340} height={480} fill="none" stroke="#0A0D13" strokeWidth={16} />
        <line x1={240} x2={240} y1={250} y2={730} stroke="#0A0D13" strokeWidth={10} />
      </g>
      {/* MID */}
      <g transform={layer(cam, 1)}>
        <rect x={-200} y={FLOOR} width={1480} height={1100} fill={SRYV.bg0} />
        <Planks color="#1C2331" />
        <rect x={-200} y={FLOOR - 22} width={1480} height={22} fill="#0A0D13" />
        <WallClock x={560} y={330} h={1} m={47} face="#1E2535" ink="#3A4560" />
        <rect x={780} y={DOOR_TOP} width={300} height={FLOOR - DOOR_TOP} fill="#121722" stroke="#0A0D13" strokeWidth={6} />
        <circle cx={808} cy={DOOR_TOP + 380} r={13} fill="#3A4560" />
        <Sneakers x={840} tint="#8E97A8" />
        <g transform={`translate(${bedX} ${FLOOR}) scale(${S})`}><Bed w={330} /></g>
      </g>
      {/* CHARS */}
      <g transform={layer(cam, 1)}>
        <g transform={`translate(${bedX + 140} ${bedTop - 20}) scale(${S}) rotate(-90)`}>
          <Hero pose={lying} rimFilter="rimN" />
        </g>
        {/* Луна ближе к камере: лежит на полу и смотрит на дверь */}
        <g transform={`translate(600 ${FLOOR + 520}) scale(2.6)`}>
          <GroundShadow w={170} opacity={0.45} color="#000" />
          <Dog pose={{ ...dogLie(frame, 2), head: 0, earL: -14, earR: -14 }} rimFilter="rimWarm" />
        </g>
      </g>
      {/* Ночная тонировка всей сцены, кроме экрана */}
      <rect x={0} y={0} width={1080} height={1920} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.55} />
      {/* Тёплая полоса света из коридора под дверью — поверх тонировки */}
      <g transform={layer(cam, 1)}>
        <rect x={786} y={FLOOR - 8} width={288} height={8} fill={SRYV.lamp} opacity={0.9} />
        <path d={`M 786 ${FLOOR} L 1074 ${FLOOR} L 1100 ${FLOOR + 110} L 690 ${FLOOR + 110} Z`} fill={SRYV.lamp} opacity={0.16} filter="url(#lightBlurN)" />
      </g>
      {/* Холодный свет экрана — поверх тонировки */}
      <g transform={layer(cam, 1)}>
        <circle cx={phone.x} cy={phone.y} r={260} fill="url(#screenGlow)" opacity={glow} style={{ mixBlendMode: "screen" }} />
      </g>
      {/* FG */}
      <g transform={layer(cam, 1.6)} filter="url(#fgBlurN)">
        <rect x={-40} y={1640} width={360} height={320} rx={30} fill="#0A0D13" />
        <path d="M 860 1920 Q 900 1680 1040 1620 Q 1120 1760 1080 1920 Z" fill="#0F1420" />
      </g>
    </svg>
  );
};
