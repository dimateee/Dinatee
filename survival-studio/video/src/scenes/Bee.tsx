import React from "react";
import { random } from "remotion";

/*
 * «Пчёлки» — ярко-мультяшный мир: круглые пчёлы с огромными глазами, соты, цветы, солнце (LESSONS Б30).
 */

/* ---------- Пчела ---------- */
export type BeeLook = {
  id: string; body: string; stripe: string; size: number; head?: number;
  goggles?: boolean; nightcap?: boolean; cap?: string; crown?: boolean; belt?: string; scarf?: string; lashes?: boolean;
};
export const ZHUZH: BeeLook = { id: "zh", body: "#FFC83D", stripe: "#2A1E14", size: 0.82, head: 1.05, goggles: true, scarf: "#E5484D" };
export const GRISHA: BeeLook = { id: "gr", body: "#FFB627", stripe: "#3A2A1A", size: 1.35, head: 1.0, belt: "#7A4A2A" };
export const SONYA: BeeLook = { id: "so", body: "#FFD86B", stripe: "#3A2A3A", size: 0.95, head: 1.0, nightcap: true, lashes: true };
export const BZZ: BeeLook = { id: "bz", body: "#FFC94A", stripe: "#1E2A3A", size: 0.95, head: 1.0, cap: "#2E7DD7" };
export const QUEEN: BeeLook = { id: "qu", body: "#FFB31A", stripe: "#4A1E3A", size: 1.4, head: 1.1, crown: true, lashes: true };
export const WORKER: BeeLook = { id: "wk", body: "#FFCC4D", stripe: "#2A1E14", size: 0.8 };

export type BeeExpr = "smile" | "o" | "wow" | "sleep" | "grin" | "worry" | "proud";
export const Bee: React.FC<{
  x: number; y: number; s?: number; look: BeeLook; frame: number; expr?: BeeExpr; flip?: boolean; tilt?: number;
  armL?: number; armR?: number; hold?: "basket" | "megaphone" | "medal" | null; fill?: number; bob?: boolean; wings?: number; squash?: number;
}> = ({ x, y, s = 1, look: L, frame, expr = "smile", flip, tilt = 0, armL = 20, armR = -20, hold = null, fill = 0, bob = true, wings = 1, squash = 0 }) => {
  const k = L.size, hk = L.head ?? 1;
  const by = bob ? Math.sin(frame / 7 + x * 0.01) * 6 : 0;
  const flap = Math.sin(frame * 2.2) * 26 * wings;
  const blink = frame % 97 < 4 && expr !== "sleep";
  const gid = `bg-${L.id}`;
  const eyes = (ex: number) => {
    if (expr === "sleep" || blink) return <path d={`M ${ex - 13} 2 Q ${ex} 12 ${ex + 13} 2`} stroke="#2A1E14" strokeWidth={5} fill="none" strokeLinecap="round" />;
    const big = expr === "wow" || expr === "o" ? 1.15 : 1;
    return (
      <g transform={`translate(${ex} 0) scale(${big})`}>
        <ellipse cx={0} cy={0} rx={15} ry={19} fill="#FFFFFF" stroke="#2A1E14" strokeWidth={3} />
        <ellipse cx={2} cy={3} rx={9} ry={12} fill="#1A120C" />
        <circle cx={5} cy={-3} r={4} fill="#FFFFFF" /><circle cx={-1} cy={8} r={2} fill="#FFFFFF" />
        {L.lashes && <path d="M -12 -14 l -6 -6 M -6 -18 l -3 -8 M 2 -19 l 0 -8" stroke="#2A1E14" strokeWidth={3} strokeLinecap="round" />}
      </g>
    );
  };
  const mouth = (() => {
    switch (expr) {
      case "o": return <ellipse cx={4} cy={30} rx={9} ry={11} fill="#7A1E2A" stroke="#2A1E14" strokeWidth={3} />;
      case "wow": return <path d="M -12 24 Q 4 50 20 24 Z" fill="#7A1E2A" stroke="#2A1E14" strokeWidth={3} />;
      case "grin": return <path d="M -14 22 Q 4 44 22 22 Z" fill="#FFFFFF" stroke="#2A1E14" strokeWidth={3} />;
      case "worry": return <path d="M -8 32 Q 4 24 16 32" stroke="#2A1E14" strokeWidth={4} fill="none" strokeLinecap="round" />;
      case "sleep": return <ellipse cx={4} cy={30} rx={5} ry={4} fill="#7A1E2A" />;
      default: return <path d="M -10 24 Q 4 38 18 24" stroke="#2A1E14" strokeWidth={4.5} fill="none" strokeLinecap="round" />;
    }
  })();
  return (
    <g transform={`translate(${x} ${y + by}) scale(${flip ? -s : s} ${s}) rotate(${tilt})`}>
      <defs>
        <radialGradient id={gid} cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#FFF4C2" /><stop offset="0.45" stopColor={L.body} /><stop offset="1" stopColor="#D98A0B" /></radialGradient>
        <clipPath id={`cl-${L.id}`}><ellipse cx={-38 * k} cy={20 * k} rx={58 * k} ry={46 * k * (1 - squash * 0.3)} /></clipPath>
      </defs>
      <ellipse cx={-10} cy={78 * k} rx={50 * k} ry={9} fill="#000" opacity={0.15} />
      {/* крылья */}
      {[[-30, -30, -flap - 20], [-6, -40, flap + 10]].map(([wx, wy, a], i) => (
        <g key={i} transform={`translate(${wx * k} ${wy * k}) rotate(${a})`}>
          <ellipse cx={-10} cy={-42 * k} rx={24 * k} ry={46 * k} fill="#E6F6FF" opacity={0.55} stroke="#9CD3F0" strokeWidth={3} />
          <path d={`M -10 ${-10 * k} Q -16 ${-40 * k} -12 ${-74 * k}`} stroke="#9CD3F0" strokeWidth={2} fill="none" />
        </g>
      ))}
      {/* брюшко с полосками */}
      <ellipse cx={-38 * k} cy={20 * k} rx={58 * k} ry={46 * k * (1 - squash * 0.3)} fill={`url(#${gid})`} stroke="#2A1E14" strokeWidth={4} />
      <g clipPath={`url(#cl-${L.id})`}>
        {[-70, -44, -18].map((sx, i) => <rect key={i} x={sx * k} y={-40 * k} width={13 * k} height={120 * k} fill={L.stripe} transform={`rotate(-12 ${sx * k} 20)`} />)}
      </g>
      <path d={`M ${-96 * k} ${22 * k} l ${-16 * k} 4 l ${16 * k} 6 Z`} fill="#2A1E14" />
      <ellipse cx={-52 * k} cy={0} rx={14 * k} ry={8 * k} fill="#FFFFFF" opacity={0.45} />
      {L.belt && <rect x={-70 * k} y={34 * k} width={72 * k} height={12 * k} rx={5} fill={L.belt} stroke="#2A1E14" strokeWidth={3} transform={`rotate(-8 ${-34 * k} 40)`} />}
      {/* ножки */}
      {[-50, -30, -10].map((lx, i) => <path key={i} d={`M ${lx * k} ${58 * k} q ${-4} ${14 + Math.sin(frame / 4 + i) * 3} ${-10} ${18}`} stroke="#2A1E14" strokeWidth={5} fill="none" strokeLinecap="round" />)}
      {/* голова */}
      <g transform={`translate(${16 * k} ${-14 * k}) scale(${hk * (0.9 + 0.1 * k)})`}>
        {/* усики */}
        {[[-14, -1], [16, 1]].map(([ax, d], i) => {
          const sw = Math.sin(frame / 6 + i) * 6;
          return <g key={i}><path d={`M ${ax} -40 Q ${ax + d * 10 + sw} -70 ${ax + d * 18 + sw} -82`} stroke="#2A1E14" strokeWidth={4} fill="none" strokeLinecap="round" />
            <circle cx={ax + d * 18 + sw} cy={-84} r={7} fill="#2A1E14" /></g>;
        })}
        <circle cx={0} cy={0} r={48} fill={`url(#${gid})`} stroke="#2A1E14" strokeWidth={4} />
        {Array.from({ length: 9 }, (_, i) => { const a = -2.6 + i * 0.32; return <circle key={i} cx={Math.cos(a) * 46} cy={Math.sin(a) * 46} r={5} fill={L.body} />; })}
        {eyes(-14)}{eyes(20)}
        {L.goggles && <g><rect x={-36} y={-30} width={72} height={12} rx={6} fill="#5A3A1E" />
          <circle cx={-14} cy={-28} r={12} fill="#9CD3F0" stroke="#5A3A1E" strokeWidth={4} opacity={0.9} /><circle cx={20} cy={-28} r={12} fill="#9CD3F0" stroke="#5A3A1E" strokeWidth={4} opacity={0.9} /></g>}
        <ellipse cx={-30} cy={18} rx={9} ry={6} fill="#FF7A8A" opacity={0.55} /><ellipse cx={36} cy={18} rx={9} ry={6} fill="#FF7A8A" opacity={0.55} />
        {mouth}
        {L.nightcap && <g transform="rotate(-18)"><path d="M -40 -30 Q -10 -86 50 -96 Q 30 -60 34 -30 Z" fill="#7A6EC0" stroke="#2A1E14" strokeWidth={3} />
          <circle cx={52} cy={-96} r={10} fill="#FFFFFF" /><rect x={-42} y={-36} width={80} height={12} rx={6} fill="#FFFFFF" /></g>}
        {L.cap && <g><path d="M -40 -26 Q 0 -66 40 -26 Z" fill={L.cap} stroke="#2A1E14" strokeWidth={3} /><path d="M 30 -28 L 70 -22 L 34 -18 Z" fill={L.cap} stroke="#2A1E14" strokeWidth={3} /></g>}
        {L.crown && <path d="M -32 -42 L -26 -76 L -12 -54 L 2 -84 L 16 -54 L 30 -76 L 34 -42 Z" fill="#FFD23F" stroke="#B07A0A" strokeWidth={4} />}
        {L.crown && [-18, 2, 22].map((cx, i) => <circle key={i} cx={cx} cy={-48} r={4} fill={["#E5484D", "#2E7DD7", "#3DDC84"][i]} />)}
        {L.scarf && <path d={`M -30 40 Q 4 54 34 38 L 30 52 Q 4 64 -26 52 Z M 26 48 L ${42 + Math.sin(frame / 3) * 6} 76 L 30 74 Z`} fill={L.scarf} stroke="#2A1E14" strokeWidth={2.5} />}
      </g>
      {/* ручки */}
      <g transform={`translate(${2 * k} ${36 * k})`}>
        <g transform={`rotate(${armL})`}><path d="M 0 0 L 0 26" stroke="#2A1E14" strokeWidth={6} strokeLinecap="round" /><circle cx={0} cy={28} r={7} fill="#2A1E14" /></g>
        <g transform={`translate(${30 * k} 0) rotate(${armR})`}>
          <path d="M 0 0 L 0 26" stroke="#2A1E14" strokeWidth={6} strokeLinecap="round" /><circle cx={0} cy={28} r={7} fill="#2A1E14" />
          {hold === "basket" && <g transform="translate(0 40)">
            <path d="M -22 0 L 22 0 L 16 26 L -16 26 Z" fill="#C98A3E" stroke="#6A4214" strokeWidth={3} />
            <path d="M -18 0 Q 0 -26 18 0" stroke="#6A4214" strokeWidth={3} fill="none" />
            {fill > 0 && <ellipse cx={0} cy={2} rx={20 * fill} ry={7 * fill} fill="#FFB81A" stroke="#D98A0B" strokeWidth={2} />}
          </g>}
          {hold === "megaphone" && <g transform="translate(0 32) rotate(-60)"><path d="M 0 -8 L 46 -26 L 46 26 L 0 8 Z" fill="#E5484D" stroke="#2A1E14" strokeWidth={3} /><rect x={-10} y={-8} width={12} height={16} fill="#2A1E14" /></g>}
          {hold === "medal" && <g transform="translate(0 40)"><polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" fill="#FFD23F" stroke="#B07A0A" strokeWidth={4} /><polygon points="0,-10 9,-5 9,5 0,10 -9,5 -9,-5" fill="#FFB31A" /></g>}
        </g>
      </g>
    </g>
  );
};

/* ---------- Небо, солнце, холмы ---------- */
export const Sky: React.FC<{ frame: number; tone?: "dawn" | "day" | "sunset" }> = ({ frame, tone = "day" }) => {
  const c = tone === "dawn" ? ["#FFB88A", "#FFE3B0"] : tone === "sunset" ? ["#FF7A5A", "#FFC27A"] : ["#6EC6FF", "#C9F0FF"];
  return (
    <g>
      <linearGradient id={`sky-${tone}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c[0]} /><stop offset="1" stopColor={c[1]} /></linearGradient>
      <rect x={-200} y={-200} width={1480} height={2400} fill={`url(#sky-${tone})`} />
      <g transform={`translate(860 ${tone === "sunset" ? 760 : 300}) rotate(${frame * 0.6})`}>
        {Array.from({ length: 12 }, (_, i) => <rect key={i} x={-8} y={-190} width={16} height={60} rx={8} fill="#FFE066" opacity={0.7} transform={`rotate(${i * 30})`} />)}
        <circle r={110} fill="#FFD23F" stroke="#FFB31A" strokeWidth={8} />
        <circle cx={-34} cy={-10} r={9} fill="#7A4A10" /><circle cx={30} cy={-10} r={9} fill="#7A4A10" /><path d="M -30 26 Q 0 50 30 26" stroke="#7A4A10" strokeWidth={8} fill="none" strokeLinecap="round" />
      </g>
      {[0, 1, 2].map((i) => { const cx = ((frame * (0.5 + i * 0.2) + i * 420) % 1500) - 200;
        return <g key={i} transform={`translate(${cx} ${180 + i * 140})`}><ellipse cx={0} cy={0} rx={90} ry={40} fill="#FFFFFF" opacity={0.9} /><ellipse cx={60} cy={-20} rx={60} ry={40} fill="#FFFFFF" opacity={0.9} /><ellipse cx={-60} cy={-6} rx={50} ry={32} fill="#FFFFFF" opacity={0.9} /></g>; })}
      <path d="M -200 1300 Q 300 1080 700 1240 T 1300 1180 L 1300 2200 L -200 2200 Z" fill="#7ED957" />
      <path d="M -200 1420 Q 400 1260 900 1400 T 1400 1360 L 1400 2200 L -200 2200 Z" fill="#5CC23E" />
      {Array.from({ length: 40 }, (_, i) => <path key={i} d={`M ${random(`gx${i}`) * 1080} ${1500 + random(`gy${i}`) * 400} q ${4 + Math.sin(frame / 10 + i) * 4} -30 ${8} -46`} stroke="#3FA52A" strokeWidth={6} fill="none" strokeLinecap="round" />)}
    </g>
  );
};

/* ---------- Соты (внутри улья) ---------- */
export const Honeycomb: React.FC<{ frame: number; dark?: number; glow?: number }> = ({ frame, dark = 0, glow = 1 }) => {
  const R = 64, w = R * Math.sqrt(3);
  return (
    <g>
      <rect x={-200} y={-200} width={1480} height={2400} fill="#E0951A" />
      {Array.from({ length: 22 }, (_, r) => Array.from({ length: 9 }, (_, c) => {
        const x = c * w + (r % 2) * w / 2 - 60, y = r * R * 1.5 - 60;
        const full = random(`hc${r}${c}`) > 0.55;
        const pts = Array.from({ length: 6 }, (_, i) => { const a = Math.PI / 6 + i * Math.PI / 3; return `${x + Math.cos(a) * (R - 5)},${y + Math.sin(a) * (R - 5)}`; }).join(" ");
        return <g key={`${r}${c}`}>
          <polygon points={pts} fill={full ? "#FFB81A" : "#B86E0A"} stroke="#FFD86B" strokeWidth={8} />
          {full && <ellipse cx={x - 12} cy={y - 14} rx={14} ry={8} fill="#FFF4C2" opacity={0.6 * glow * (0.8 + 0.2 * Math.sin(frame / 9 + r + c))} />}
        </g>;
      }))}
      {dark > 0 && <rect x={-200} y={-200} width={1480} height={2400} fill="#2A1A0A" opacity={dark} />}
    </g>
  );
};

/* ---------- Цветы ---------- */
export const Dandelion: React.FC<{ x: number; y: number; s?: number; frame: number; blow?: number }> = ({ x, y, s = 1, frame, blow = 0 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d={`M 0 0 Q ${Math.sin(frame / 15) * 10} -200 0 -380`} stroke="#4CAF2E" strokeWidth={14} fill="none" />
    <circle cx={0} cy={-400} r={70} fill="#FFFFFF" opacity={0.85 * (1 - blow)} stroke="#E6E6E6" strokeWidth={3} />
    {Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2; const d = blow * (200 + i * 12);
      return <g key={i} transform={`translate(${Math.cos(a) * (60 + d) + blow * 140} ${-400 + Math.sin(a) * (60 + d) - blow * 120})`} opacity={1 - blow * 0.6}>
        <line x1={0} y1={0} x2={0} y2={18} stroke="#C9C9C9" strokeWidth={2} /><circle cx={0} cy={0} r={6} fill="#FFFFFF" /></g>; })}
  </g>
);
export const Tulip: React.FC<{ x: number; y: number; s?: number; frame: number; snore?: number }> = ({ x, y, s = 1, frame, snore = 0 }) => {
  const b = 1 + 0.05 * Math.sin(frame / 8) * snore;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 0 L 0 -360" stroke="#4CAF2E" strokeWidth={16} />
      <path d="M 0 -120 Q -110 -170 -90 -260 Q -30 -190 0 -150 Z" fill="#5CC23E" />
      <g transform={`translate(0 -420) scale(${b})`}>
        {/* жук внутри */}
        {snore > 0 && <g><ellipse cx={0} cy={-30} rx={56} ry={40} fill="#3A6E2E" stroke="#1A2E14" strokeWidth={4} />
          <circle cx={-30} cy={-50} r={22} fill="#2A2E1A" /><path d="M -40 -54 q 6 4 12 0" stroke="#FFF" strokeWidth={3} fill="none" />
          <line x1={0} y1={-68} x2={0} y2={10} stroke="#1A2E14" strokeWidth={4} /></g>}
        <path d="M -110 -60 Q -120 60 0 80 Q 120 60 110 -60 Q 70 -10 40 -80 Q 0 -20 -40 -80 Q -70 -10 -110 -60 Z" fill="#E5484D" stroke="#9A1E2A" strokeWidth={5} />
        <path d="M -60 -20 Q -50 40 -10 60" stroke="#FF8A90" strokeWidth={8} fill="none" opacity={0.6} />
      </g>
      {snore > 0 && [0, 1, 2].map((i) => { const p = ((frame / 40 + i / 3) % 1);
        return <text key={i} x={80 + p * 80} y={-520 - p * 160} fontFamily="Inter Display" fontWeight={900} fontSize={40 + p * 30} fill="#FFFFFF" stroke="#2A1E14" strokeWidth={3} paintOrder="stroke" opacity={1 - p}>Z</text>; })}
    </g>
  );
};
export const Bluebell: React.FC<{ x: number; y: number; s?: number; frame: number; wiggle?: number; stuck?: boolean }> = ({ x, y, s = 1, frame, wiggle = 0, stuck }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M 0 0 L 0 -520 Q 0 -600 80 -620" stroke="#4CAF2E" strokeWidth={14} fill="none" />
    <g transform={`translate(80 -600) rotate(${wiggle * Math.sin(frame / 2) * 10})`}>
      {stuck && <g transform="translate(0 150)">
        <ellipse cx={0} cy={0} rx={70} ry={56} fill="#FFB627" stroke="#2A1E14" strokeWidth={5} />
        {[-40, -10, 20].map((sx, i) => <rect key={i} x={sx} y={-50} width={16} height={100} fill="#3A2A1A" />)}
        <path d="M 0 56 l -8 22 l 16 0 Z" fill="#2A1E14" />
        {[-30, 0, 30].map((lx, i) => <path key={i} d={`M ${lx} 40 l ${Math.sin(frame / 2 + i) * 14} 34`} stroke="#2A1E14" strokeWidth={7} strokeLinecap="round" />)}
      </g>}
      <path d="M -90 0 Q -100 120 -70 150 L 70 150 Q 100 120 90 0 Q 0 -60 -90 0 Z" fill="#6E7BE0" stroke="#2E3A9A" strokeWidth={5} />
      <path d="M -70 150 Q -50 130 -30 150 Q -10 130 10 150 Q 30 130 50 150 Q 60 135 70 150" stroke="#2E3A9A" strokeWidth={5} fill="#8A96F0" />
    </g>
  </g>
);
export const Clover: React.FC<{ frame: number; n?: number }> = ({ frame, n = 40 }) => (
  <g>
    {Array.from({ length: n }, (_, i) => {
      const x = random(`cx${i}`) * 1180 - 50, y = 1350 + random(`cy${i}`) * 520, sc = 0.6 + random(`cs${i}`) * 0.7;
      return <g key={i} transform={`translate(${x} ${y}) scale(${sc}) rotate(${Math.sin(frame / 12 + i) * 4})`}>
        <path d="M 0 0 L 0 -90" stroke="#3FA52A" strokeWidth={8} />
        <circle cx={0} cy={-110} r={34} fill="#F07AB8" stroke="#B83A80" strokeWidth={4} />
        {Array.from({ length: 6 }, (_, j) => <circle key={j} cx={Math.cos(j) * 18} cy={-110 + Math.sin(j) * 18} r={9} fill="#FFA6D6" />)}
      </g>;
    })}
  </g>
);

/* ---------- Банки, лужа нектара, ложка, лайк ---------- */
export const Jar: React.FC<{ x: number; y: number; s?: number; fill?: number; shake?: number; frame: number }> = ({ x, y, s = 1, fill = 0, shake = 0, frame }) => (
  <g transform={`translate(${x + Math.sin(frame * 2.5) * 6 * shake} ${y}) scale(${s}) rotate(${Math.sin(frame * 2.1) * 6 * shake})`}>
    <rect x={-60} y={-150} width={120} height={150} rx={22} fill="#E6F6FF" opacity={0.75} stroke="#9CD3F0" strokeWidth={5} />
    {fill > 0 && <rect x={-54} y={-150 * fill + 6} width={108} height={150 * fill - 12} rx={18} fill="#FFB81A" />}
    <rect x={-66} y={-172} width={132} height={26} rx={8} fill="#E5484D" stroke="#9A1E2A" strokeWidth={4} />
    <rect x={-44} y={-100} width={88} height={44} rx={6} fill="#FFFFFF" stroke="#C9A23A" strokeWidth={3} />
    <text x={0} y={-68} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={30} fill="#B07A0A">МЁД</text>
  </g>
);
export const Puddle: React.FC<{ x: number; y: number; k: number; frame: number }> = ({ x, y, k, frame }) => (
  <g transform={`translate(${x} ${y})`}>
    <ellipse cx={0} cy={0} rx={220 * k} ry={60 * k} fill="#FFB81A" stroke="#D98A0B" strokeWidth={5} />
    <ellipse cx={-60 * k} cy={-14 * k} rx={50 * k} ry={12 * k} fill="#FFF4C2" opacity={0.7} />
    {k > 0.5 && Array.from({ length: 8 }, (_, i) => { const a = -Math.PI + (i / 7) * Math.PI; const p = Math.min(1, (frame % 40) / 40);
      return <circle key={i} cx={Math.cos(a) * 160 * k} cy={-60 - Math.sin(-a) * 120 * p} r={10} fill="#FFB81A" opacity={1 - p} />; })}
  </g>
);
export const Burst: React.FC<{ x: number; y: number; k: number; text: string; color?: string }> = ({ x, y, k, text, color = "#FFE066" }) => k > 0 ? (
  <g transform={`translate(${x} ${y}) scale(${0.4 + 0.8 * Math.min(1, k * 2)}) rotate(-8)`} opacity={Math.min(1, (1 - k) * 4)}>
    <polygon points={Array.from({ length: 24 }, (_, i) => { const r = i % 2 ? 110 : 190; const a = (i / 24) * Math.PI * 2; return `${Math.cos(a) * r},${Math.sin(a) * r * 0.7}`; }).join(" ")} fill={color} stroke="#2A1E14" strokeWidth={8} />
    <text x={0} y={22} textAnchor="middle" fontFamily="Inter Display" fontWeight={900} fontSize={84} fill="#E5484D" stroke="#2A1E14" strokeWidth={4} paintOrder="stroke">{text}</text>
  </g>
) : null;
