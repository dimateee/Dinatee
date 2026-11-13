import React from "react";
import { random } from "remotion";
import { ARTYOM, Hero, heroHandL, HeroPose, Look, NEUTRAL } from "../rig/Hero";
import { Dog, dogSit, dogWalk, DOG_WALK_MATCH } from "../rig/Dog";
import { heroGait, RUN, WALK } from "../rig/gait";
import { GroundShadow, RimDefs, shade } from "../rig/shared";
import { HERO, SRYV } from "../style/palette";
import { Icon, IconName } from "../ui/Icons";

/*
 * «Подвал на восьмерых»: пятиэтажка в разрезе, под ней подвал. Мир шире кадра, камера ездит внутри.
 * Мировые координаты: земля y=560, перекрытие 560–600, пол подвала y=1060, подвал по x 60…1700, лестница 1700…1960.
 * cam: точка мира (x, y) ставится в точку экрана (540, 760) с увеличением z.
 */
export const W_GROUND = 560, W_CEIL = 600, W_FLOOR = 1060;
export type Cam = { x: number; y: number; z: number };
export const lerpCam = (a: Cam, b: Cam, k: number): Cam => {
  const e = Math.min(1, Math.max(0, k)); const s = e * e * (3 - 2 * e);
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, z: a.z + (b.z - a.z) * s };
};
export const toScreen = (cam: Cam, x: number, y: number) => ({ x: 540 + (x - cam.x) * cam.z, y: 760 + (y - cam.y) * cam.z });
const S = 1.2, KID = 0.72;

/* ---------- Жильцы ---------- */
export const LOOKS: Record<string, Look> = {
  artyom: ARTYOM,
  zina: { ...HERO, head: "scarf", scarfColor: "#B23A48", hoodie: "#6E5E7E", hoodieShade: "#594B66", jeans: "#5A4A40", jeansShade: "#4A3C33",
    boots: "#2E2622", skin: "#E7B898", skirt: "#3F4A5C" },
  vitya: { ...HERO, head: "hair", hairColor: "#2E2620", glasses: true, hoodie: "#3E6E8E", hoodieShade: "#2F5670", jeans: "#3A3F48", jeansShade: "#2E333B", hood: true },
  petrov: { ...HERO, head: "hair", hairColor: "#6B4A2E", beard: "#6B4A2E", hoodie: "#5E7A4A", hoodieShade: "#4B6239", jeans: "#2F3A4A", jeansShade: "#262F3C" },
  petrova: { ...HERO, head: "hair", hairColor: "#8A4A2A", longHair: true, hoodie: "#C0567A", hoodieShade: "#9E4463", jeans: "#3C4658", jeansShade: "#2F3747", skin: "#EDBE9C" },
  twinA: { ...HERO, head: "hair", hairColor: "#C08A50", hoodie: "#E8C547", hoodieShade: "#C9A82F", jeans: "#4C5A6B", jeansShade: "#3B4756" },
  twinB: { ...HERO, head: "hair", hairColor: "#C08A50", hoodie: "#4AA8A0", hoodieShade: "#378A83", jeans: "#4C5A6B", jeansShade: "#3B4756" },
  guest: { ...HERO, head: "hair", hairColor: "#3A2A20", longHair: true, hoodie: "#8A7A66", hoodieShade: "#6E6150", jeans: "#3A3F48", jeansShade: "#2E333B", skin: "#E9B48F" },
  kidA: { ...HERO, head: "hair", hairColor: "#3A2A20", hoodie: "#D9643A", hoodieShade: "#B44E2B", jeans: "#3A3F48", jeansShade: "#2E333B" },
  kidB: { ...HERO, head: "hair", hairColor: "#3A2A20", longHair: true, hoodie: "#7A6EC0", hoodieShade: "#6156A0", jeans: "#3A3F48", jeansShade: "#2E333B" },
};
const idle = (frame: number, seed: number, extra: Partial<HeroPose> = {}): HeroPose => ({
  ...NEUTRAL, torso: 2 + Math.sin((frame + seed * 13) / 18), head: Math.sin((frame + seed * 7) / 27) * 2,
  expr: { brow: 0, browTilt: 0.2, mouth: "flat", blink: (frame + seed * 23) % 90 < 3 ? 1 : 0 }, ...extra,
});

/* ---------- Кот Барсик (сидит) ---------- */
export const Cat: React.FC<{ frame: number; happy?: number }> = ({ frame, happy = 0 }) => {
  const tail = Math.sin(frame / 10) * 12;
  const blink = frame % 100 < 4;
  const c = "#E08A3C", d = "#B8682A";
  return (
    <g>
      <ellipse cx={0} cy={2} rx={34} ry={6} fill="#000" opacity={0.3} />
      <g transform={`translate(-22 -12) rotate(${tail})`}><path d="M 0 0 Q -30 -8 -34 -40 Q -30 -48 -24 -40 Q -22 -14 4 -6 Z" fill={c} stroke={d} strokeWidth={2} /></g>
      <path d="M -26 0 Q -30 -44 0 -52 Q 26 -48 24 0 Z" fill={c} stroke={d} strokeWidth={2} />
      {[-14, 0, 12].map((x) => <path key={x} d={`M ${x - 6} -30 q 6 -6 12 0`} stroke={d} strokeWidth={3} fill="none" />)}
      <g transform="translate(6 -62)">
        <circle r={24} fill={c} stroke={d} strokeWidth={2} />
        <path d="M -20 -10 L -16 -34 L -4 -20 Z M 20 -10 L 16 -34 L 4 -20 Z" fill={c} stroke={d} strokeWidth={2} strokeLinejoin="round" />
        {blink ? <><path d="M -12 -2 h 8 M 4 -2 h 8" stroke="#2A1E14" strokeWidth={3} /></>
          : <><ellipse cx={-8} cy={-2} rx={3.4} ry={happy > 0.5 ? 1.5 : 5} fill="#2A1E14" /><ellipse cx={8} cy={-2} rx={3.4} ry={happy > 0.5 ? 1.5 : 5} fill="#2A1E14" /></>}
        <path d="M -3 6 L 3 6 L 0 9 Z" fill="#C2507A" />
        <path d="M -16 8 L -30 6 M -16 11 L -30 13 M 16 8 L 30 6 M 16 11 L 30 13" stroke="#F6F2E7" strokeWidth={1.4} />
      </g>
    </g>
  );
};

/* ---------- Вход по лестнице ---------- */
const STAIR_TOP = { x: 1950, y: W_FLOOR - 52 * 9 }, STAIR_BOT = { x: 1715, y: W_FLOOR };
const SEG_A = Math.hypot(STAIR_TOP.x - STAIR_BOT.x, STAIR_TOP.y - STAIR_BOT.y);
/** Позиция на пути «верх лестницы → низ → по полу к месту» через dt секунд при скорости speed (px/с). */
export const moverAt = (dt: number, speed: number, target: number) => {
  const d = Math.max(0, dt) * speed, segB = STAIR_BOT.x - target;
  if (d < SEG_A) { const k = d / SEG_A; return { x: STAIR_TOP.x + (STAIR_BOT.x - STAIR_TOP.x) * k, y: STAIR_TOP.y + (STAIR_BOT.y - STAIR_TOP.y) * k, moving: true }; }
  if (d < SEG_A + segB) return { x: STAIR_BOT.x - (d - SEG_A), y: W_FLOOR, moving: true };
  return { x: target, y: W_FLOOR, moving: false };
};
type Mover = { key: string; look: string; kind: "hero" | "dog" | "cat"; target: number; faceEnd: 1 | -1; speed: number; scale: number; run?: boolean; kid?: boolean; seed: number };
export const MOVERS: Mover[] = [
  { key: "artyom", look: "artyom", kind: "hero", target: 1150, faceEnd: 1, speed: 640, scale: S, run: true, seed: 3 },
  { key: "luna", look: "", kind: "dog", target: 1265, faceEnd: -1, speed: 700, scale: 1.25, seed: 4 },
  { key: "zina", look: "zina", kind: "hero", target: 330, faceEnd: 1, speed: 430, scale: S, seed: 1 },
  { key: "barsik", look: "", kind: "cat", target: 470, faceEnd: 1, speed: 520, scale: 1.3, seed: 8 },
  { key: "vitya", look: "vitya", kind: "hero", target: 620, faceEnd: 1, speed: 640, scale: S, run: true, seed: 2 },
  { key: "petrov", look: "petrov", kind: "hero", target: 1420, faceEnd: -1, speed: 600, scale: S, run: true, seed: 4 },
  { key: "twinA", look: "twinA", kind: "hero", target: 1510, faceEnd: -1, speed: 600, scale: S * KID, run: true, kid: true, seed: 6 },
  { key: "twinB", look: "twinB", kind: "hero", target: 1570, faceEnd: -1, speed: 600, scale: S * KID, run: true, kid: true, seed: 7 },
  { key: "petrova", look: "petrova", kind: "hero", target: 1640, faceEnd: -1, speed: 600, scale: S, run: true, seed: 5 },
];
/** Все уже на местах (для обложек). */
export const ALL_IN: Record<string, number> = Object.fromEntries(MOVERS.map((m) => [m.key, -100]));

/* ---------- Состояние мира ---------- */
export type PodvalState = {
  siren?: number; outDust?: number;
  film?: number; tape?: number; bags?: number; oilcloth?: number;
  buckets?: number; pots?: number; bath?: number;
  torches?: number; candle?: number; candleHidden?: number;
  toilet?: number; catOnLitter?: number;
  radio?: number; doorClosed?: number; knock?: number; guests?: number;
  vityaPhone?: boolean; zinaJar?: boolean;
};

export const PodvalWorld: React.FC<{ frame: number; cam: Cam; st: PodvalState; entries?: Record<string, number> }> = ({ frame, cam, st, entries = ALL_IN }) => {
  const s = (v?: number) => v ?? 0;
  const T = `translate(540 760) scale(${cam.z}) translate(${-cam.x} ${-cam.y})`;
  const sirenPulse = s(st.siren) * (0.5 + 0.5 * Math.sin(frame / 4.5));
  const knockShake = s(st.knock) > 0 ? Math.round(Math.sin(frame * 2.2) * 3 * s(st.knock)) : 0;
  const VENTS = [420, 800, 1240];
  const doorK = s(st.doorClosed);
  const zina = idle(frame, 1, { torso: 10 + Math.sin(frame / 18), head: 6 });
  const vitya: HeroPose = st.vityaPhone
    ? { ...idle(frame, 2), head: 14, armL: { sh: -58, el: -84, wr: 0 }, holdL: "phone", phoneGlow: 1 }
    : idle(frame, 2, { armL: { sh: -150, el: -10, wr: 0 } });
  const artyom = idle(frame, 3, s(st.torches) > 0 ? { armL: { sh: -78, el: -10, wr: 0 } } : {});
  return (
    <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <RimDefs id="rimPod" side={-1} color={SRYV.lamp} strength={0.8} width={5} />
      <defs>
        <radialGradient id="podLamp"><stop offset="0" stopColor={SRYV.lamp} stopOpacity={0.5} /><stop offset="1" stopColor={SRYV.lamp} stopOpacity={0} /></radialGradient>
        <linearGradient id="podBeam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FFF3D0" stopOpacity={0.5} /><stop offset="1" stopColor="#FFF3D0" stopOpacity={0} /></linearGradient>
        <radialGradient id="podCandle"><stop offset="0" stopColor="#FFC46B" stopOpacity={0.6} /><stop offset="1" stopColor="#FFC46B" stopOpacity={0} /></radialGradient>
      </defs>
      <g transform={T}>
        {/* ночное небо и пятиэтажка */}
        <rect x={-800} y={-2400} width={3200} height={2960} fill="#0E1118" />
        <rect x={-800} y={-2400} width={3200} height={2960} fill={SRYV.fail} opacity={0.12 * sirenPulse} />
        {[[-500, -300, 300], [1600, -200, 340], [-300, 0, 200]].map(([x, top, w], i) => <rect key={i} x={x} y={top} width={w} height={W_GROUND - top} fill="#141924" />)}
        <rect x={100} y={-740} width={1800} height={W_GROUND + 740} fill="#3A3E48" />
        {Array.from({ length: 5 }, (_, fl) => Array.from({ length: 10 }, (_, c) => {
          const lit = random(`pw${fl}${c}`) < 0.55;
          return <rect key={`${fl}-${c}`} x={170 + c * 180} y={-680 + fl * 255} width={90} height={120} fill={lit ? SRYV.lamp : "#1A1F28"} opacity={lit ? 0.75 : 1} stroke="#2A2E36" strokeWidth={6} />;
        }))}
        {Array.from({ length: 4 }, (_, i) => <rect key={i} x={100} y={-500 + i * 255} width={1800} height={8} fill="#2E323B" />)}
        <rect x={80} y={-760} width={1840} height={24} fill="#2A2E36" />
        {/* громкоговоритель на крыше */}
        <g transform="translate(1000 -760)">
          <rect x={-6} y={-140} width={12} height={140} fill="#2B3241" />
          <path d="M -6 -150 L -70 -176 L -70 -110 L -6 -128 Z M 6 -150 L 70 -176 L 70 -110 L 6 -128 Z" fill="#4E5868" />
          {s(st.siren) > 0 && [0, 1, 2].map((i) => {
            const ph = (frame / 16 + i / 3) % 1;
            return <g key={i} opacity={(1 - ph) * s(st.siren)} stroke={SRYV.fail} strokeWidth={8} fill="none" strokeLinecap="round">
              <path d={`M ${-84 - ph * 120} ${-200 - ph * 40} Q ${-120 - ph * 150} -140 ${-84 - ph * 120} ${-80 + ph * 40}`} />
              <path d={`M ${84 + ph * 120} ${-200 - ph * 40} Q ${120 + ph * 150} -140 ${84 + ph * 120} ${-80 + ph * 40}`} />
            </g>;
          })}
        </g>
        {/* подъезд */}
        <rect x={1780} y={W_GROUND - 210} width={120} height={210} fill="#1A1F28" stroke="#2A2E36" strokeWidth={6} />
        <rect x={1760} y={W_GROUND - 230} width={160} height={18} fill="#2A2E36" />
        {/* земля и перекрытие */}
        <rect x={-800} y={W_GROUND} width={3200} height={1200} fill="#2A2420" />
        {Array.from({ length: 60 }, (_, i) => <circle key={i} cx={-700 + random(`pg${i}`) * 3000} cy={W_GROUND + 10 + random(`pgy${i}`) * 700} r={4} fill="#3A322C" />)}
        <rect x={-800} y={W_GROUND - 6} width={3200} height={8} fill="#4A4038" />
        {/* подвал */}
        <rect x={60} y={W_CEIL} width={1640} height={W_FLOOR - W_CEIL} fill="#22272F" />
        {Array.from({ length: 7 }, (_, r) => Array.from({ length: 10 }, (_, c) => (
          <rect key={`${r}-${c}`} x={60 + c * 172 + (r % 2) * 86} y={W_CEIL + 10 + r * 64} width={168} height={58} fill="none" stroke="#2B313A" strokeWidth={4} />
        )))}
        <rect x={60} y={W_CEIL} width={1640} height={26} fill="#3A3F48" />
        <rect x={60} y={W_CEIL + 40} width={1640} height={20} fill="#3E4656" />
        <rect x={60} y={W_FLOOR} width={1640} height={20} fill="#1A1E25" />
        {/* продухи: окошки на улицу под потолком */}
        {VENTS.map((x, i) => (
          <g key={x}>
            <rect x={x - 70} y={W_CEIL + 70} width={140} height={80} fill="#0B0E14" stroke="#4E5868" strokeWidth={6} />
            {s(st.outDust) > 0 && s(st.film) < 1 && Array.from({ length: 16 }, (_, k) => {
              const ph = (frame * 0.025 + random(`vd${i}-${k}`)) % 1;
              return <circle key={k} cx={x - 50 + random(`vx${i}-${k}`) * 100 + ph * 50} cy={W_CEIL + 110 + ph * 260} r={5} fill="#B9B2A6" opacity={(1 - ph) * s(st.outDust) * (1 - s(st.film))} />;
            })}
            {s(st.film) > 0 && <rect x={x - 78} y={W_CEIL + 62} width={156} height={96 * Math.min(1, s(st.film) * 1.4)} fill={i === 1 && s(st.oilcloth) > 0 ? "#D9534F" : "#C9D6E6"} opacity={0.55} />}
            {i === 1 && s(st.oilcloth) > 0 && Array.from({ length: 4 }, (_, r) => Array.from({ length: 6 }, (_, c) => (r + c) % 2 === 0 ? (
              <rect key={`${r}${c}`} x={x - 78 + c * 26} y={W_CEIL + 62 + r * 24} width={26} height={24} fill="#F6F2E7" opacity={0.7 * s(st.oilcloth)} />) : null))}
            {s(st.tape) > 0 && (
              <g stroke="#E8C547" strokeWidth={12} strokeLinecap="round" opacity={Math.min(1, s(st.tape) * 1.5)}>
                <line x1={x - 80} y1={W_CEIL + 60} x2={x - 80 + 160 * Math.min(1, s(st.tape) * 2)} y2={W_CEIL + 60 + 100 * Math.min(1, s(st.tape) * 2)} />
                <line x1={x + 80} y1={W_CEIL + 60} x2={x + 80 - 160 * Math.max(0, s(st.tape) * 2 - 1)} y2={W_CEIL + 60 + 100 * Math.max(0, s(st.tape) * 2 - 1)} />
              </g>
            )}
            {s(st.bags) > 0 && [0, 1].map((b) => (
              <ellipse key={b} cx={x - 36 + b * 72} cy={W_CEIL + 178 - 30 * Math.min(1, s(st.bags) * 1.3)} rx={40} ry={20} fill="#8A7650" stroke="#5E4E34" strokeWidth={3}
                opacity={Math.min(1, s(st.bags) * 2)} />
            ))}
          </g>
        ))}
        {/* полки у задней стены */}
        <g>
          {[760, 880].map((y) => <rect key={y} x={1290} y={y} width={240} height={12} fill="#3A3128" />)}
          {[0, 1, 2, 3].map((i) => <rect key={i} x={1302 + i * 56} y={706} width={40} height={54} rx={6} fill="#7B8798" stroke="#4E5868" strokeWidth={3} />)}
          {[0, 1].map((i) => <rect key={i} x={1310 + i * 110} y={820} width={90} height={60} rx={4} fill="#8A6B47" stroke="#5E4830" strokeWidth={3} />)}
        </g>
        {/* лампа */}
        <line x1={600} y1={W_CEIL + 26} x2={600} y2={W_CEIL + 100} stroke="#0A0D13" strokeWidth={4} />
        <circle cx={600} cy={W_CEIL + 108} r={12} fill="#FFE2A8" />
        {/* туалетный угол: перегородка, шторка, ведро, наполнитель */}
        <g>
          <rect x={60} y={W_CEIL + 120} width={20} height={W_FLOOR - W_CEIL - 120} fill="#2B3241" />
          <rect x={210} y={W_CEIL + 150} width={16} height={W_FLOOR - W_CEIL - 150} fill="#5E4830" />
          {s(st.toilet) > 0 && (
            <g opacity={s(st.toilet)}>
              <path d={`M 90 ${W_CEIL + 150} Q 140 ${W_CEIL + 300} 100 ${W_FLOOR} L 200 ${W_FLOOR} Q 170 ${W_CEIL + 300} 200 ${W_CEIL + 150} Z`} fill="#4A7A9E" opacity={0.7} />
              <rect x={86} y={W_CEIL + 140} width={124} height={10} fill="#3A3F48" />
              <g transform={`translate(150 ${W_FLOOR})`}>
                <path d="M -34 -80 L 34 -80 L 28 0 L -28 0 Z" fill="#5E6B7E" stroke="#2B3241" strokeWidth={4} />
                <path d="M -38 -80 Q -20 -94 0 -82 Q 20 -94 38 -80" fill="#1A1F28" />
              </g>
            </g>
          )}
        </g>
        {/* кот и мешок наполнителя */}
        {s(st.toilet) > 0 && (
          <g transform={`translate(270 ${W_FLOOR})`} opacity={s(st.toilet)}>
            <path d="M -32 0 L -28 -70 L 28 -70 L 32 0 Z" fill="#7FA6BD" stroke="#4E6A7C" strokeWidth={3} />
            <text x={0} y={-30} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={16} fill="#1A2A36">КОТ</text>
          </g>
        )}

        {/* вода: вёдра, кастрюли, ванночка */}
        {s(st.buckets) > 0 && [0, 1].map((i) => (
          <g key={i} transform={`translate(${880 + i * 66} ${W_FLOOR}) scale(${Math.min(1, s(st.buckets) * 1.4)})`}>
            <path d="M -26 -60 L 26 -60 L 20 0 L -20 0 Z" fill="#5E7AA0" stroke="#2B3A50" strokeWidth={3} /><ellipse cx={0} cy={-60} rx={26} ry={6} fill="#8FC8FF" />
          </g>
        ))}
        {s(st.pots) > 0 && [0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${712 + i * 50} ${W_FLOOR + 6}) scale(${Math.min(1, s(st.pots) * 1.4)})`}>
            <rect x={-20} y={-30} width={40} height={30} rx={4} fill="#9AA3B2" stroke="#5E6B7E" strokeWidth={3} /><rect x={-26} y={-26} width={52} height={5} fill="#5E6B7E" />
            <ellipse cx={0} cy={-30} rx={20} ry={4} fill="#8FC8FF" />
          </g>
        ))}
        {s(st.bath) > 0 && (
          <g transform={`translate(780 ${W_FLOOR - 8}) scale(${Math.min(1, s(st.bath) * 1.4)})`}>
            <path d="M -70 -44 L 70 -44 Q 66 0 50 0 L -50 0 Q -66 0 -70 -44 Z" fill="#7FCFC4" stroke="#3F8A80" strokeWidth={3} />
            <ellipse cx={0} cy={-44} rx={70} ry={9} fill="#8FC8FF" />
          </g>
        )}
        {/* радио на ящике */}
        <g transform={`translate(1010 ${W_FLOOR})`}>
          <rect x={-50} y={-80} width={100} height={80} fill="#5E4830" stroke="#3E2F20" strokeWidth={4} />
          <g transform="translate(0 -80)">
            <rect x={-40} y={-44} width={80} height={44} rx={6} fill="#2B3241" stroke="#0A0D13" strokeWidth={3} />
            <circle cx={-18} cy={-22} r={12} fill="#1A1F28" stroke="#4E5868" strokeWidth={2} />
            <rect x={4} y={-32} width={28} height={10} rx={2} fill={SRYV.progress} opacity={0.2 + 0.8 * s(st.radio)} />
            <line x1={22} y1={-44} x2={44} y2={-90} stroke="#4E5868" strokeWidth={3} />
          </g>
        </g>
        {/* лестница и стальная дверь */}
        <g>
          <rect x={1700} y={W_GROUND} width={260} height={W_FLOOR - W_GROUND + 20} fill="#1E232B" />
          {Array.from({ length: 9 }, (_, i) => (
            <rect key={i} x={1710 + i * 26} y={W_FLOOR - 52 - i * 52} width={260 - i * 26} height={52} fill="#3A3F48" stroke="#2A2E36" strokeWidth={3} />
          ))}
          <g transform={`translate(${1700 + knockShake} 0)`}>
            <rect x={-26} y={W_FLOOR - 300} width={26} height={300} fill="#0A0D13" />
            <g transform={`translate(-26 0) scale(${0.2 + 0.8 * doorK} 1) translate(26 0)`}>
              <rect x={-26} y={W_FLOOR - 300} width={26} height={300} fill="#4E5868" stroke="#2B3241" strokeWidth={4} />
            </g>
          </g>
          {s(st.knock) > 0 && [0, 1, 2].map((i) => {
            const ph = (frame / 10 + i / 3) % 1;
            return <path key={i} d={`M ${1718 + ph * 20} ${W_FLOOR - 200 - i * 22} q 14 12 0 24`} stroke="#F6F2E7" strokeWidth={5} fill="none" strokeLinecap="round" opacity={(1 - ph) * s(st.knock)} />;
          })}
        </g>
        {/* жильцы: вбегают по лестнице в подвал и встают на свои места */}
        {MOVERS.map((m) => {
          const t0 = entries[m.key];
          if (t0 === undefined || frame / 30 < t0) return null;
          const p = moverAt(frame / 30 - t0, m.speed, m.target);
          const sc = m.scale;
          if (m.kind === "dog") {
            const pose = p.moving ? { ...dogWalk(frame, 4, true, DOG_WALK_MATCH), x: 0 } : dogSit(frame, 4, false);
            return (
              <g key={m.key} transform={`translate(${p.x} ${p.y}) scale(${-sc} ${sc})`}>
                <GroundShadow w={150} opacity={0.4} color="#000" /><Dog pose={pose} rimFilter="rimPod" />
              </g>);
          }
          if (m.kind === "cat") {
            const hop = p.moving ? -Math.abs(Math.sin(frame / 3)) * 10 : 0;
            const onLitter = s(st.catOnLitter) > 0;
            return (
              <g key={m.key} transform={`translate(${onLitter ? 270 : p.x} ${(onLitter ? W_FLOOR - 66 : p.y) + hop}) scale(${p.moving ? -1.3 : 1.3} 1.3)`}>
                <Cat frame={frame} happy={s(st.catOnLitter)} />
              </g>);
          }
          const base = m.key === "zina" ? zina : m.key === "vitya" ? vitya : m.key === "artyom" ? artyom
            : idle(frame, m.seed, m.kid ? { expr: { brow: 0.4, browTilt: 0, mouth: "o", blink: (frame + m.seed * 31) % 80 < 3 ? 1 : 0 } } : {});
          const pose: HeroPose = p.moving
            ? { ...heroGait(frame + m.seed * 5, m.run ? RUN : WALK, { expr: { brow: 0.3, browTilt: 0.6, mouth: m.kid ? "o" : "flat", blink: 0 } }), x: 0,
                holdL: base.holdL, phoneGlow: base.phoneGlow }
            : base;
          const face = p.moving ? -1 : m.faceEnd;
          const hand = heroHandL(pose);
          return (
            <g key={m.key}>
              <g transform={`translate(${p.x} ${p.y}) scale(${face * sc} ${sc})`}>
                <GroundShadow w={120} opacity={0.4} color="#000" />
                <Hero pose={pose} look={LOOKS[m.look]} rimFilter="rimPod" />
              </g>
              {m.key === "zina" && st.zinaJar && (
                <g transform={`translate(${p.x + face * hand.x * sc} ${p.y + hand.y * sc})`}>
                  <rect x={-14} y={-34} width={30} height={40} rx={6} fill="#9EC7A0" opacity={0.85} stroke="#5E8A60" strokeWidth={3} />
                  <rect x={-16} y={-40} width={34} height={8} rx={3} fill="#C9A82F" />
                  {[0, 1].map((k) => <ellipse key={k} cx={-2 + k * 8} cy={-14 + k * 6} rx={5} ry={10} fill="#4E7A3A" />)}
                </g>
              )}
              {m.key === "zina" && s(st.candle) > 0 && s(st.candleHidden) < 1 && (
                <g transform={`translate(${p.x + face * hand.x * sc} ${p.y + hand.y * sc - 6})`} opacity={1 - s(st.candleHidden)}>
                  <rect x={-6} y={-40} width={12} height={40} rx={2} fill="#EDE6D6" />
                  <path d={`M 0 -42 Q ${-6 + Math.sin(frame / 3) * 2} -52 0 -66 Q 6 -52 0 -42 Z`} fill="#FFC46B" />
                </g>
              )}
            </g>);
        })}
        {/* гости на лестнице (до удара — без пыли) */}
        {s(st.guests) > 0 && (
          <g opacity={s(st.guests)}>
            {[[1790, "guest", 1, 9], [1860, "kidA", KID, 10], [1910, "kidB", KID, 11]].map(([x, l, k, sd]) => {
              const stepY = W_FLOOR - 52 * Math.floor(((x as number) - 1710) / 26 + 1);
              const y = Math.max(W_FLOOR - 52 * 8, stepY);
              return (
                <g key={l as string} transform={`translate(${x} ${y}) scale(${-S * (k as number)} ${S * (k as number)})`}>
                  <Hero pose={idle(frame, sd as number, { expr: { brow: 0.5, browTilt: 1, mouth: "o", blink: 0 } })} look={LOOKS[l as string]} rimFilter="rimPod" />
                </g>
              );
            })}
          </g>
        )}
      </g>
      {/* тонировка подвала; свет поверх */}
      <rect width={1080} height={1920} fill="#26324D" style={{ mixBlendMode: "multiply" }} opacity={0.42} />
      <g transform={T}>
        <circle cx={600} cy={W_CEIL + 160} r={760} fill="url(#podLamp)" opacity={0.6} style={{ mixBlendMode: "screen" }} />
        {s(st.torches) > 0 && (<>
          <path d={`M 1210 ${W_FLOOR - 250} L 1700 ${W_FLOOR - 470} L 1700 ${W_FLOOR - 40} Z`} fill="url(#podBeam)" opacity={s(st.torches)} style={{ mixBlendMode: "screen" }} />
        </>)}
        {s(st.candle) > 0 && s(st.candleHidden) < 1 && <circle cx={330 + heroHandL(zina).x * S} cy={W_FLOOR + heroHandL(zina).y * S - 60} r={160} fill="url(#podCandle)" opacity={1 - s(st.candleHidden)} style={{ mixBlendMode: "screen" }} />}
        {s(st.radio) > 0 && <circle cx={1020} cy={W_FLOOR - 110} r={120} fill={SRYV.progress} opacity={0.14 * s(st.radio)} style={{ mixBlendMode: "screen" }} />}
      </g>
      {/* красная пульсация сирены по краям */}
      {s(st.siren) > 0 && <rect width={1080} height={1920} fill="none" stroke={SRYV.fail} strokeWidth={110} opacity={0.18 * sirenPulse} />}
    </svg>
  );
};

/* ---------- HUD ---------- */
export const PodHud: React.FC<{ secLeft: number; people: number; tails: number; water: number; waterBad?: boolean; opacity?: number; urgent?: number }> = ({
  secLeft, people, tails, water, waterBad, opacity = 1, urgent = 0,
}) => {
  const sx = Math.max(0, Math.round(secLeft));
  const txt = `${String(Math.floor(sx / 60)).padStart(2, "0")}:${String(sx % 60).padStart(2, "0")}`;
  const Pill: React.FC<{ icon: IconName; text: string; color: string }> = ({ icon, text, color }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderRadius: 14, background: "rgba(14,17,24,0.86)", border: `3px solid ${color}` }}>
      <Icon name={icon} color={color} size={38} />
      <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 40, lineHeight: 1, color: "#FFFFFF" }}>{text}</div>
    </div>
  );
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 80, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 30px", borderRadius: 16, background: "rgba(14,17,24,0.9)",
        border: `4px solid ${SRYV.fail}`, boxShadow: `0 0 ${20 + 20 * urgent}px rgba(229,57,53,${0.4 + 0.4 * urgent})`, transform: `scale(${1 + 0.06 * urgent})` }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 30, color: "#FF8A80", letterSpacing: 4 }}>ДО УДАРА</div>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 64, lineHeight: 1, color: "#FFFFFF", letterSpacing: 2 }}>{txt}</div>
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        <Pill icon="house" text={`${people}`} color="#C9D2E0" />
        <Pill icon="paw" text={`${tails}`} color="#C9D2E0" />
        <Pill icon="bottle" text={`${Math.round(water)} л`} color={waterBad ? SRYV.fail : "#5AA9FF"} />
      </div>
    </div>
  );
};

/* Пузырь реплики (экранные координаты: кончик хвоста в точке x, y). */
export const Bubble: React.FC<{ x: number; y: number; text: string; k: number; side?: 1 | -1 }> = ({ x, y, text, k, side = 1 }) => (
  <div style={{ position: "absolute", left: Math.round(x - (side > 0 ? 40 : 420)), top: Math.round(y - 150), width: 460, display: "flex",
    justifyContent: side > 0 ? "flex-start" : "flex-end", opacity: k, transform: `scale(${0.85 + 0.15 * k})`, transformOrigin: side > 0 ? "40px 150px" : "420px 150px" }}>
    <div style={{ position: "relative", padding: "16px 24px", borderRadius: 22, background: "#F6F2E7", border: "4px solid #23262E",
      fontFamily: "Inter Display", fontWeight: 900, fontSize: 38, lineHeight: 1.05, color: "#23262E", maxWidth: 440 }}>
      {text}
      <div style={{ position: "absolute", [side > 0 ? "left" : "right"]: 26, bottom: -22, width: 0, height: 0,
        borderLeft: "14px solid transparent", borderRight: "14px solid transparent", borderTop: "22px solid #23262E" }} />
    </div>
  </div>
);

/* Табличка-имя над персонажем. */
export const NameTag: React.FC<{ x: number; y: number; text: string; k: number; color?: string }> = ({ x, y, text, k, color = "#E8C547" }) => (
  <div style={{ position: "absolute", left: Math.round(x - 200), top: Math.round(y - 60), width: 400, display: "flex", justifyContent: "center", opacity: k,
    transform: `translateY(${Math.round((1 - k) * 16)}px)` }}>
    <div style={{ padding: "8px 18px", borderRadius: 12, background: "rgba(14,17,24,0.88)", border: `3px solid ${color}`,
      fontFamily: "Inter Display", fontWeight: 900, fontSize: 34, lineHeight: 1, color: "#FFFFFF", whiteSpace: "nowrap" }}>{text}</div>
  </div>
);
export { shade };
