import React from "react";
import { random } from "remotion";
import { AUTUMN, FOG, INTERIOR, NIGHT, WINTER, YARD } from "./style";
import { shade } from "../rig/shared";

/*
 * Сцены серии «66 ДНЕЙ» для кадра 1080×1920. Театр сбоку: горизонт низко, герои на одной линии земли G.
 * Слои: far (лес, дома в дымке) · mid (дом, сарай, забор, берёза) · chars (children) · fg (столб, трава).
 * season: 0 — осень, 1 — зима; промежуточные значения — смена сезона (листва желтеет, опадает, ложится снег).
 * mode: "day" | "night" | "fog". cam: { zoom, x } — медленный наезд/панорама, слои с параллаксом.
 */
export const G = 1520;
export type Cam = { zoom: number; x: number };
const L = (cam: Cam, d: number) => `translate(540 ${G}) scale(${1 + (cam.zoom - 1) * d}) translate(-540 ${-G}) translate(${cam.x * d} 0)`;
const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, "0")).join("")}`;
};

export const Yard: React.FC<{
  frame: number; season?: number; mode?: "day" | "night" | "fog"; cam?: Cam; children?: React.ReactNode; gateOpen?: number; river?: boolean;
}> = ({ frame, season = 0, mode = "day", cam = { zoom: 1, x: 0 }, children, gateOpen = 0, river = false }) => {
  const w = Math.max(0, Math.min(1, season)); // 0 осень → 1 зима
  const night = mode === "night", fog = mode === "fog";
  const sky = night ? NIGHT.bg : fog ? FOG.c : mix(AUTUMN.sky, "#B9BCC4", w);
  const ground = night ? "#202A36" : mix(AUTUMN.earth, WINTER.snow, w);
  const leaf = mix(mix("#8A8A55", AUTUMN.ochre, Math.min(1, w * 2)), "#00000000".slice(0, 7), 0);
  const leafAmount = 1 - Math.max(0, Math.min(1, (w - 0.35) / 0.4)); // листва опадает на середине перехода
  const snowCover = Math.max(0, (w - 0.6) / 0.4);
  const forest = night ? "#141B24" : fog ? FOG.a : mix("#5C5A49", WINTER.forest, w);
  const houseWall = night ? NIGHT.build : YARD.wall;
  const boards = night ? "#2B2420" : YARD.boards;
  const winGlow = night || fog ? 1 : 0.35;
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <filter id="blurFg66"><feGaussianBlur stdDeviation={9} /></filter>
        <radialGradient id="winLight66"><stop offset="0" stopColor={INTERIOR.lamp} stopOpacity={0.55} /><stop offset="1" stopColor={INTERIOR.lamp} stopOpacity={0} /></radialGradient>
        <linearGradient id="cone66" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#E8D9A8" stopOpacity={0.45} /><stop offset="1" stopColor="#E8D9A8" stopOpacity={0} /></linearGradient>
      </defs>
      <rect width={1080} height={1920} fill={sky} />
      {/* FAR: лес и крыши посёлка в дымке */}
      <g transform={L(cam, 0.35)}>
        <path d={`M -300 ${G - 190} ${Array.from({ length: 30 }, (_, i) => `L ${-300 + i * 60} ${G - 230 - 70 * random(`t${i}`)} L ${-270 + i * 60} ${G - 200}`).join(" ")} L 1500 ${G} L -300 ${G} Z`} fill={forest} />
        {[[-120, 120], [760, 100], [980, 140]].map(([x, h], i) => (
          <g key={i}><rect x={x} y={G - 120 - h} width={150} height={h + 120} fill={shade(forest, 0.12)} /><path d={`M ${x - 12} ${G - 120 - h} L ${x + 75} ${G - 190 - h} L ${x + 162} ${G - 120 - h} Z`} fill={shade(forest, 0.05)} />
            <rect x={x + 55} y={G - 70 - h} width={30} height={34} fill={night ? NIGHT.window : shade(forest, 0.25)} opacity={night ? 0.9 : 1} /></g>
        ))}
        <rect x={-400} y={0} width={1900} height={G} fill={night ? "#000" : fog ? FOG.b : AUTUMN.sky} opacity={night ? 0.2 : fog ? 0.55 : 0.35} />
      </g>
      {/* MID: дом с окном, сарай, берёза, забор с калиткой */}
      <g transform={L(cam, 1)}>
        <rect x={-300} y={G} width={1700} height={700} fill={ground} />
        {snowCover > 0 && <rect x={-300} y={G} width={1700} height={30} fill={WINTER.snow2} opacity={snowCover} />}
        {river && (
          <g>
            <rect x={-300} y={G + 150} width={1700} height={120} fill={night ? "#18212C" : w > 0.8 ? "#C9D2DA" : "#6F7C80"} />
            {Array.from({ length: 7 }, (_, i) => <rect key={i} x={((i * 260 + frame * 1.2) % 1700) - 300} y={G + 190 + (i % 3) * 22} width={90} height={4} rx={2} fill="#FFFFFF" opacity={0.25} />)}
          </g>
        )}
        {/* дом */}
        <g transform="translate(60 0)">
          <rect x={0} y={G - 430} width={360} height={430} fill={houseWall} />
          <rect x={0} y={G - 430} width={90} height={430} fill={shade(houseWall, -0.12)} />
          <path d={`M -30 ${G - 430} L 180 ${G - 600} L 390 ${G - 430} Z`} fill={night ? "#2E2426" : "#5E4535"} />
          {snowCover > 0 && <path d={`M -30 ${G - 430} L 180 ${G - 600} L 390 ${G - 430} L 360 ${G - 440} L 180 ${G - 580} L 0 ${G - 440} Z`} fill={WINTER.snow} opacity={snowCover} />}
          <rect x={200} y={G - 330} width={110} height={130} fill={INTERIOR.lamp} opacity={0.35 + 0.6 * winGlow} />
          <path d={`M 200 ${G - 265} L 310 ${G - 265} M 255 ${G - 330} L 255 ${G - 200}`} stroke={boards} strokeWidth={8} />
          <circle cx={255} cy={G - 265} r={210} fill="url(#winLight66)" opacity={winGlow * (0.92 + 0.08 * Math.sin(frame / 9))} />
          <rect x={110} y={G - 210} width={70} height={210} fill={boards} />
          <rect x={90} y={G - 18} width={110} height={18} fill={shade(boards, -0.2)} />
        </g>
        {/* берёза */}
        <g transform="translate(560 0)">
          <rect x={-10} y={G - 640} width={20} height={640} fill="#E4DED2" />
          {[G - 560, G - 470, G - 380, G - 290].map((y, i) => <rect key={i} x={-10} y={y} width={i % 2 ? 12 : 20} height={6} fill="#3B2D28" />)}
          {leafAmount > 0 && [[-90, G - 650, 120], [60, G - 600, 110], [-40, G - 520, 100], [80, G - 480, 80]].map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.8} fill={leaf} opacity={leafAmount * (night ? 0.4 : 0.95)} />
          ))}
        </g>
        {/* забор и калитка */}
        <g>
          {Array.from({ length: 16 }, (_, i) => -100 + i * 74).map((x, i) => {
            const isGate = i === 9;
            return isGate ? (
              <g key={i} transform={`translate(${x} ${G}) skewY(${-gateOpen * 16}) scale(${1 - gateOpen * 0.45} 1)`}>
                <rect x={0} y={-200} width={64} height={200} fill={shade(boards, 0.08)} />
                <rect x={0} y={-150} width={64} height={12} fill={shade(boards, -0.2)} />
              </g>
            ) : <rect key={i} x={x} y={G - 190} width={56} height={190} fill={boards} />;
          })}
          <rect x={-120} y={G - 150} width={1300} height={12} fill={shade(boards, -0.2)} />
          {snowCover > 0 && Array.from({ length: 16 }, (_, i) => <rect key={i} x={-100 + i * 74} y={G - 196} width={56} height={8} rx={4} fill={WINTER.snow} opacity={snowCover} />)}
        </g>
        {/* фонарь — ночью бьёт конусом */}
        <g transform="translate(900 0)">
          <rect x={-5} y={G - 520} width={10} height={520} fill={night ? "#0F151D" : YARD.shadow} />
          <rect x={-5} y={G - 520} width={60} height={10} fill={night ? "#0F151D" : YARD.shadow} />
          {night && <path d={`M 40 ${G - 505} L -120 ${G} L 220 ${G} Z`} fill="url(#cone66)" />}
          <circle cx={48} cy={G - 504} r={10} fill={night ? "#F0E2B0" : "#BDB49A"} />
        </g>
      </g>
      {/* CHARS */}
      <g transform={L(cam, 1)}>{children}</g>
      {/* опадающие листья во время смены сезона */}
      {w > 0.15 && w < 0.85 && Array.from({ length: 22 }, (_, i) => {
        const x = 300 + random(`lx${i}`) * 600, y = G - 700 + ((frame * (3 + random(`ly${i}`) * 3) + i * 90) % 800);
        return <ellipse key={i} cx={x + 30 * Math.sin(frame / 10 + i)} cy={y} rx={9} ry={5} fill={AUTUMN.ochre} transform={`rotate(${frame * 6 + i * 40} ${x} ${y})`} opacity={0.9} />;
      })}
      {/* снег */}
      {w > 0.55 && Array.from({ length: 70 }, (_, i) => {
        const x = random(`sx${i}`) * 1080, sp = 1.5 + random(`ss${i}`) * 2.5;
        const y = ((frame * sp + random(`sy${i}`) * 1920) % 1980) - 30;
        return <circle key={i} cx={x + 14 * Math.sin(frame / 20 + i)} cy={y} r={2 + random(`sr${i}`) * 3} fill="#FFFFFF" opacity={Math.min(1, (w - 0.55) / 0.2) * 0.85} />;
      })}
      {/* туман: полосы дымки ползут, фигуры проступают и тают */}
      {fog && [0, 1, 2].map((i) => (
        <rect key={i} x={-200 + Math.sin(frame / 60 + i) * 120} y={G - 520 + i * 220} width={1500} height={340} fill={[FOG.a, FOG.b, FOG.c][i]} opacity={0.32 + 0.12 * Math.sin(frame / 45 + i * 2)} filter="url(#blurFg66)" />
      ))}
      {/* FG: столб и трава у камеры, размыты */}
      <g transform={L(cam, 1.5)} filter="url(#blurFg66)">
        <rect x={30} y={G - 40} width={42} height={700} fill={night ? "#0D1218" : YARD.shadow} />
        {Array.from({ length: 18 }, (_, i) => <path key={i} d={`M ${i * 70} 1920 q ${10 + (i % 3) * 6} -120 ${-8 + (i % 4) * 8} -${160 + (i % 5) * 30}`} stroke={night ? "#141B24" : snowCover > 0.5 ? WINTER.snowShadow : "#4F4A3A"} strokeWidth={14} fill="none" strokeLinecap="round" />)}
      </g>
    </svg>
  );
};

/** Интерьер с лампой: стол, тетрадь, печка; пятно тёплого света, вокруг темно. */
export const Interior: React.FC<{ frame: number; cam?: Cam; children?: React.ReactNode; stoveFire?: boolean }> = ({ frame, cam = { zoom: 1, x: 0 }, children, stoveFire = true }) => {
  const flicker = 0.9 + 0.1 * Math.sin(frame / 5) * Math.sin(frame / 13);
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <defs>
        <radialGradient id="lamp66"><stop offset="0" stopColor={INTERIOR.lamp} stopOpacity={0.75} /><stop offset="0.55" stopColor={INTERIOR.lamp} stopOpacity={0.18} /><stop offset="1" stopColor={INTERIOR.lamp} stopOpacity={0} /></radialGradient>
      </defs>
      <rect width={1080} height={1920} fill={INTERIOR.shadow} />
      <g transform={L(cam, 0.6)}>
        <rect x={-200} y={300} width={1500} height={G - 300} fill={INTERIOR.wood} />
        {Array.from({ length: 14 }, (_, i) => <rect key={i} x={-200 + i * 110} y={300} width={6} height={G - 300} fill={INTERIOR.wood2} />)}
        {/* окно с ночью */}
        <rect x={620} y={560} width={260} height={320} fill={NIGHT.bg} /><path d={`M 620 720 L 880 720 M 750 560 L 750 880`} stroke={INTERIOR.wood2} strokeWidth={12} />
      </g>
      <g transform={L(cam, 1)}>
        <rect x={-200} y={G} width={1500} height={700} fill={shade(INTERIOR.wood, -0.25)} />
        {/* печка */}
        <g transform="translate(60 0)">
          <rect x={0} y={G - 420} width={230} height={420} fill="#5B5550" /><rect x={0} y={G - 420} width={60} height={420} fill="#4A4541" />
          <rect x={70} y={G - 170} width={100} height={80} fill={stoveFire ? "#C1622D" : "#2B2626"} opacity={stoveFire ? flicker : 1} />
        </g>
        {/* стол с лампой и тетрадью */}
        <g transform="translate(640 0)">
          <rect x={0} y={G - 250} width={420} height={22} fill={INTERIOR.wood2} />
          <rect x={20} y={G - 228} width={18} height={228} fill={INTERIOR.wood2} /><rect x={382} y={G - 228} width={18} height={228} fill={INTERIOR.wood2} />
          <rect x={250} y={G - 262} width={110} height={12} fill="#DAD0BD" />
          <path d={`M 100 ${G - 250} L 120 ${G - 330} L 160 ${G - 330} L 180 ${G - 250} Z`} fill="#7F8275" />
          <ellipse cx={140} cy={G - 345} rx={22} ry={26} fill="#F0D99A" opacity={flicker} />
        </g>
      </g>
      <circle cx={780} cy={G - 345} r={620} fill="url(#lamp66)" opacity={flicker} style={{ mixBlendMode: "screen" }} />
      <g transform={L(cam, 1)}>{children}</g>
    </svg>
  );
};
