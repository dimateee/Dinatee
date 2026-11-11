import React from "react";
import { Hero, HeroHead, NEUTRAL, Expr } from "../rig/Hero";
import { Dog, DOG_WALK_MATCH, dogLie, dogSit, dogWalk, DogPose } from "../rig/Dog";
import { heroGait, RUN, WALK } from "../rig/gait";
import { GroundShadow, RimDefs, shade } from "../rig/shared";
import { HERO, REGIME, SRYV } from "../style/palette";

const W = 1080, H = 1920;

/* ================= Улица: утро / ночь, камера ведёт героя ================= */
export const STREET_GROUND = 1040;
export const Street: React.FC<{
  frame: number; night?: boolean; mode?: "run" | "walk" | "empty"; dog?: boolean; scale?: number; heroX?: number;
}> = ({ frame, night = false, mode = "walk", dog = false, scale = 1.5, heroX = 400 }) => {
  const G = STREET_GROUND;
  const spec = mode === "run" ? RUN : WALK;
  const hero = mode === "empty" ? null : heroGait(frame, spec, { expr: { brow: 0.1, browTilt: mode === "run" ? -0.3 : 0, mouth: mode === "run" ? "flat" : "smile", blink: frame % 80 < 4 ? 1 : 0 } });
  // камера: смещение мира = путь таза героя (в пикселях кадра); пустая улица — медленный дрейф
  const camX = hero ? hero.x * scale : frame * 2;
  const pal = night
    ? { sky: SRYV.bg1, far: "#1A2130", mid: "#141A26", walk: "#202838", joint: "#2B3446", grass: "#121822", win: SRYV.lamp, ink: "#0A0D13" }
    : { sky: REGIME.sky, far: REGIME.fog, mid: shade(REGIME.sage, 0.1), walk: "#E6DCC4", joint: "#CFC4A8", grass: REGIME.sage, win: REGIME.paper, ink: REGIME.olive };
  const wrap = (x: number, period: number) => ((x % period) + period) % period;
  const dpose = dog ? dogWalk(frame, 3, true, DOG_WALK_MATCH) : null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimS" side={-1} color={night ? SRYV.lamp : "#FFD7A0"} strength={night ? 0.7 : 0.9} />
      <defs><filter id="fgBlurS" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={14} /></filter></defs>
      <rect width={W} height={H} fill={pal.sky} />
      {!night && <circle cx={820} cy={430} r={70} fill={REGIME.dawn} />}
      {/* FAR 0.2: дома в дымке */}
      <g transform={`translate(${-wrap(camX * 0.2, 1400)} 0)`}>
        {[0, 1400].map((o) => (
          <g key={o} transform={`translate(${o} 0)`}>
            {[[0, 520, 260], [300, 420, 220], [560, 560, 300], [900, 470, 240], [1180, 600, 220]].map(([x, top, w], i) => (
              <g key={i}>
                <rect x={x} y={top} width={w} height={G - top} fill={pal.far} />
                {Array.from({ length: 8 }, (_, r) => Array.from({ length: 3 }, (_, c) => {
                  const lit = night ? (i * 7 + r * 3 + c) % 5 === 0 : false;
                  return <rect key={`${r}${c}`} x={x + 30 + c * ((w - 60) / 3)} y={top + 40 + r * 60} width={34} height={36}
                    fill={lit ? pal.win : night ? "#141A26" : REGIME.paper} opacity={night ? (lit ? 0.85 : 1) : 0.55} />;
                }))}
              </g>
            ))}
          </g>
        ))}
        <rect x={0} y={0} width={2800} height={G} fill={night ? "#000" : REGIME.paper} opacity={night ? 0.25 : 0.32} />{/* дымка */}
      </g>
      {/* MID 0.6: деревья и фонари */}
      <g transform={`translate(${-wrap(camX * 0.6, 900)} 0)`}>
        {[0, 900, 1800].map((o) => (
          <g key={o} transform={`translate(${o} 0)`}>
            {[120, 560].map((x, i) => (
              <g key={i}>
                <rect x={x - 8} y={G - 240} width={16} height={240} fill={night ? "#0E121B" : "#6B4E36"} />
                <ellipse cx={x} cy={G - 300} rx={110} ry={130} fill={night ? "#121A24" : i ? REGIME.sage : "#6F7F51"} />
              </g>
            ))}
            <rect x={340} y={G - 330} width={10} height={330} fill={pal.ink} />
            <circle cx={345} cy={G - 336} r={18} fill={night ? SRYV.lamp : REGIME.paper} />
            {night && <ellipse cx={345} cy={G + 10} rx={170} ry={26} fill={SRYV.lamp} opacity={0.14} />}
          </g>
        ))}
      </g>
      {/* GROUND 1.0: тротуар с плиткой — едет ровно со скоростью шага */}
      <rect x={0} y={G - 8} width={W} height={H - G + 8} fill={pal.grass} />
      <rect x={0} y={G - 8} width={W} height={150} fill={pal.walk} />
      <g transform={`translate(${-wrap(camX, 160)} 0)`}>
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={i * 160} x2={i * 160 - 40} y1={G - 8} y2={G + 142} stroke={pal.joint} strokeWidth={4} />)}
      </g>
      <rect x={0} y={G + 142} width={W} height={12} fill={pal.joint} />
      {/* персонажи */}
      {dpose && (
        <g transform={`translate(${heroX + 280} ${G + 40}) scale(${scale})`}>
          <GroundShadow w={150} opacity={0.22} />
          <g transform={`translate(${-dpose.x} 0)`}><Dog pose={dpose} rimFilter="rimS" /></g>
        </g>
      )}
      {hero && (
        <g transform={`translate(${heroX} ${G + 40}) scale(${scale})`}>
          <GroundShadow w={130} opacity={0.22} />
          <g transform={`translate(${-hero.x} 0)`}><Hero pose={{ ...hero, holdL: dog ? "leash" : null }} outfit={mode === "run" ? "sport" : "casual"} rimFilter="rimS" /></g>
        </g>
      )}
      {night && <rect width={W} height={H} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.45} />}
      {/* FG 1.4: размытые кусты у камеры (ниже зоны субтитров) */}
      <g transform={`translate(${-wrap(camX * 1.4, 1200)} 0)`} filter="url(#fgBlurS)">
        {[0, 1200].map((o) => (
          <g key={o} transform={`translate(${o} 0)`}>
            <ellipse cx={200} cy={1860} rx={260} ry={170} fill={night ? "#0A0E16" : REGIME.olive} />
            <ellipse cx={820} cy={1900} rx={300} ry={160} fill={night ? "#0C111A" : "#505D36"} />
          </g>
        ))}
      </g>
      {night && (
        <g opacity={0.6}>
          {Array.from({ length: 50 }, (_, i) => {
            const x = (i * 211) % W, y = ((i * 389 + frame * 34) % (H + 200)) - 100;
            return <line key={i} x1={x} y1={y} x2={x - 8} y2={y + 44} stroke="#8FA3C2" strokeWidth={3} strokeLinecap="round" />;
          })}
        </g>
      )}
    </svg>
  );
};

/* ================= Дверь ночью: Луна смотрит на дверь ================= */
export const DoorNight: React.FC<{ frame: number }> = ({ frame }) => {
  const G = 1040;
  const luna: DogPose = { ...dogLie(frame, 4), head: -6, earL: -16, earR: -16 };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimD" side={1} color={SRYV.lamp} strength={0.95} width={6} />
      <defs><filter id="blurD" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation={24} /></filter></defs>
      <rect width={W} height={G} fill={SRYV.bg1} />
      <rect y={G} width={W} height={H - G} fill={SRYV.bg0} />
      <rect x={560} y={260} width={420} height={G - 260} fill="#121722" stroke="#0A0D13" strokeWidth={8} />
      <rect x={600} y={300} width={340} height={300} rx={10} fill="none" stroke="#1C2333" strokeWidth={6} />
      <rect x={600} y={640} width={340} height={340} rx={10} fill="none" stroke="#1C2333" strokeWidth={6} />
      <circle cx={600} cy={660} r={16} fill="#3A4560" />
      <path d="M 520 520 q 0 26 -18 26" stroke="#3A4560" strokeWidth={8} fill="none" strokeLinecap="round" />
      {/* кроссовки у двери — нетронуты */}
      {[0, 60].map((dx) => (
        <g key={dx} transform={`translate(${640 + dx} ${G}) scale(2)`}>
          <path d="M -12 -2 L -12 -16 L 0 -18 L 6 -10 L 26 -6 Q 32 -4 30 -2 Z" fill="#8E97A8" stroke="#3A4560" strokeWidth={1.4} />
          <rect x={-12} y={-3} width={42} height={3.5} rx={1.5} fill={REGIME.dawn} opacity={0.7} />
        </g>
      ))}
      <g transform={`translate(330 ${G + 30}) scale(2.3)`}>
        <GroundShadow w={170} opacity={0.5} color="#000" />
        <Dog pose={luna} rimFilter="rimD" />
      </g>
      <rect width={W} height={H} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.5} />
      {/* тёплая полоса из-под двери — поверх тонировки */}
      <rect x={566} y={G - 10} width={408} height={10} fill={SRYV.lamp} />
      <path d={`M 566 ${G} L 974 ${G} L 1080 ${G + 160} L 300 ${G + 160} Z`} fill={SRYV.lamp} opacity={0.18} filter="url(#blurD)" />
    </svg>
  );
};

/* ================= Крупно: лицо Артёма в свете экрана ================= */
export const FaceClose: React.FC<{ frame: number; expr?: Expr }> = ({ frame, expr }) => {
  const blink = frame % 70 < 4 ? 1 : 0;
  const e: Expr = { ...(expr ?? { brow: -0.3, browTilt: 1, mouth: "flat", blink: 0 }), blink };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="faceGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={SRYV.screen} stopOpacity={0.5} /><stop offset="1" stopColor={SRYV.screen} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={SRYV.bg1} />
      <rect y={1040} width={W} height={H - 1040} fill={SRYV.bg0} />
      {/* плечи худи */}
      <path d="M 120 1180 Q 160 900 470 880 Q 800 900 860 1180 L 860 1920 L 120 1920 Z" fill={shade(HERO.hoodie, -0.45)} />
      <g transform="translate(470 620) scale(5)">
        <HeroHead expr={e} glow={1} />
      </g>
      <circle cx={760} cy={760} r={420} fill="url(#faceGlow)" style={{ mixBlendMode: "screen" }} />
      {/* край телефона снизу справа */}
      <g transform="translate(800 980) rotate(-18)">
        <rect x={-90} y={-160} width={180} height={320} rx={26} fill="#1B1E26" stroke="#0B0C10" strokeWidth={6} />
        <rect x={-74} y={-142} width={148} height={280} rx={14} fill={SRYV.screen} opacity={0.85} />
      </g>
    </svg>
  );
};

/* ================= Крупно: голова Луны с поводком ================= */
export const LunaClose: React.FC<{ frame: number; tilt?: number }> = ({ frame, tilt = 0 }) => {
  const p = dogSit(frame, 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimL" side={-1} color="#FFD7A0" strength={0.9} width={4} />
      <rect width={W} height={H} fill={shade(REGIME.sage, -0.15)} />
      <rect x={60} y={120} width={960} height={900} rx={16} fill="none" stroke={shade(REGIME.sage, -0.35)} strokeWidth={10} />
      <rect y={1040} width={W} height={H - 1040} fill={REGIME.sage} />
      <rect y={1026} width={W} height={14} fill={REGIME.olive} />
      <g transform="translate(520 1030) scale(-4.2 4.2)">
        <Dog pose={{ ...p, head: p.head + tilt }} rimFilter="rimL" />
      </g>
    </svg>
  );
};

export { NEUTRAL };
