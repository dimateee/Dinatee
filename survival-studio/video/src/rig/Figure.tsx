import React from "react";
import type { HeroPose } from "./Hero";

/*
 * Figure — «красивый» риг с нормальными пропорциями (LESSONS Б29): голова ~1/7 роста, лицо в 3/4 профиль (смотрит вправо),
 * глаза с радужкой и бликом, веки, брови, нос, губы; волосы прядями; одежда с объёмом, складками и контровым светом.
 * Принимает те же позы, что Hero (HeroPose), — сцены переводятся без переделки поз.
 * Начало координат — таз; y вниз. Рост взрослого ~350 при scale 1.
 */
export type FigureLook = {
  id: string; kid?: boolean;
  skin: string; skinShade: string; blush?: string;
  hair: string; hairHi: string; hairStyle: "messy" | "braid" | "receding";
  iris: string; lashes?: boolean; stubble?: boolean;
  top: string; topShade: string; topStyle: "jacket" | "raincoat" | "coat";
  inner?: string; scarf?: string;
  pants: string; pantsShade: string; shoes: string;
  bandage?: boolean; plush?: boolean;
};

export const F_ME: FigureLook = {
  id: "me", skin: "#D9A78A", skinShade: "#A8735C", hair: "#1E1A18", hairHi: "#4A3F38", hairStyle: "messy", iris: "#5A6E4A",
  top: "#3E4A36", topShade: "#2A3326", topStyle: "jacket", inner: "#6E747C", pants: "#2E3644", pantsShade: "#222833", shoes: "#2A221C",
};
export const F_ANYA: FigureLook = {
  id: "anya", kid: true, skin: "#E8BCA0", skinShade: "#B88468", blush: "#E08A80", hair: "#5A3A26", hairHi: "#8A6040", hairStyle: "braid", iris: "#4A6A8A", lashes: true,
  top: "#C9A23A", topShade: "#9A7A26", topStyle: "raincoat", pants: "#4A3A5A", pantsShade: "#3A2C48", shoes: "#3A2A2E", plush: true,
};
export const F_STRANGER: FigureLook = {
  id: "stranger", skin: "#C99A80", skinShade: "#946650", hair: "#4A443E", hairHi: "#7A726A", hairStyle: "receding", iris: "#6A5A4A", stubble: true,
  top: "#5A4636", topShade: "#3E3024", topStyle: "coat", scarf: "#6A2A2A", pants: "#2E3038", pantsShade: "#22242A", shoes: "#1E1A16", bandage: true,
};

const dims = (kid?: boolean) => kid
  ? { thigh: 54, shin: 50, ankle: 8, torso: 84, neck: 12, upper: 42, fore: 38, sh: { x: 4, y: -74 }, headS: 0.92 }
  : { thigh: 78, shin: 72, ankle: 10, torso: 118, neck: 16, upper: 62, fore: 56, sh: { x: 4, y: -106 }, headS: 1 };

/* сужающийся сегмент от (0,0) вниз на len */
const Taper: React.FC<{ len: number; w1: number; w2: number; fill: string; hi?: string; fold?: boolean }> = ({ len, w1, w2, fill, hi, fold }) => (
  <g>
    <path d={`M ${-w1 / 2} 0 Q ${-w1 / 2 - 1} ${len * 0.5} ${-w2 / 2} ${len} L ${w2 / 2} ${len} Q ${w1 / 2 + 2} ${len * 0.5} ${w1 / 2} 0 Z`} fill={fill} />
    <ellipse cx={0} cy={0} rx={w1 / 2} ry={w1 / 2.4} fill={fill} />
    {hi && <path d={`M ${w1 / 2 - 2} 2 Q ${w1 / 2} ${len * 0.5} ${w2 / 2 - 1} ${len - 2}`} stroke={hi} strokeWidth={2.2} fill="none" opacity={0.55} strokeLinecap="round" />}
    {fold && <path d={`M ${-w1 / 3} ${len * 0.55} q ${w1 / 3} 4 ${w1 / 1.6} -2 M ${-w1 / 3} ${len * 0.75} q ${w1 / 3} 3 ${w1 / 1.8} -1`} stroke="#000" strokeWidth={1} opacity={0.1} fill="none" />}
  </g>
);

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  return `#${((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1)}`;
};

/* ---------- Кисть ---------- */
const Hand: React.FC<{ L: FigureLook; far?: boolean; hold?: HeroPose["holdL"]; glow?: number; s: number }> = ({ L, far, hold, glow = 0, s }) => {
  const c = far ? L.skinShade : L.skin;
  return (
    <g transform={`scale(${s})`}>
      <path d="M -6 -2 Q -8 8 -5 16 Q 0 22 6 18 Q 9 10 7 -2 Z" fill={c} />
      <path d="M 5 2 Q 12 6 11 13" stroke={c} strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M -3 15 L -3 19 M 0 16 L 0 21 M 3 15 L 3 20" stroke={shade(c, -0.3)} strokeWidth={1.2} opacity={0.6} />
      {hold === "phone" && <g transform="translate(2 12) rotate(-20)">
        <rect x={-6} y={-12} width={13} height={24} rx={3} fill="#111" />
        <rect x={-5} y={-11} width={11} height={22} rx={2} fill="#9CC2FF" opacity={0.4 + 0.6 * glow} />
      </g>}
    </g>
  );
};

/* ---------- Голова (центр головы — начало) ---------- */
const Head: React.FC<{ L: FigureLook; expr: HeroPose["expr"]; frame: number; glow?: number }> = ({ L, expr, frame, glow = 0 }) => {
  const id = L.id;
  const lid = Math.max(0, Math.min(1, expr.blink));
  const by = -11 - expr.brow * 3;
  const eyeOpen = 1 + Math.max(0, expr.brow) * 0.25;
  const look = Math.sin(frame / 47) * 0.8;
  return (
    <g>
      <defs>
        <linearGradient id={`fsk-${id}`} x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor={L.skin} /><stop offset="0.6" stopColor={L.skin} /><stop offset="1" stopColor={L.skinShade} /></linearGradient>
        <linearGradient id={`fhr-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={L.hairHi} /><stop offset="0.5" stopColor={L.hair} /><stop offset="1" stopColor={shade(L.hair, -0.4)} /></linearGradient>
      </defs>
      {/* волосы сзади (длинные / коса) */}
      {L.hairStyle === "braid" && (<>
        <path d="M -20 -10 Q -30 20 -22 54 Q -14 60 -10 50 Q -14 20 -6 -4 Z" fill={`url(#fhr-${id})`} />
        {Array.from({ length: 5 }, (_, i) => <ellipse key={i} cx={-20 + Math.sin(frame / 20) * 1.5} cy={60 + i * 11} rx={6 - i * 0.4} ry={7} fill={i % 2 ? L.hair : L.hairHi} />)}
        <rect x={-24} y={112} width={8} height={5} rx={2} fill="#B23A48" />
      </>)}
      {/* шея */}
      <path d="M -8 18 L -6 34 L 10 34 L 10 20 Z" fill={L.skinShade} />
      {/* лицо и череп в 3/4 профиль */}
      <path d="M -22 -2 C -24 -24 -8 -32 6 -31 C 18 -30 25 -22 26 -12 L 26 -6 L 29 4 Q 31 7 27 8 L 26 11 L 27.5 13 L 26 15.5 L 25.5 18 C 23 25 15 28 7 27 C -3 26 -13 18 -18 10 C -21 6 -22 2 -22 -2 Z"
        fill={`url(#fsk-${id})`} stroke={shade(L.skinShade, -0.3)} strokeWidth={1.2} />
      {/* дальняя скула/глаз — намёк 3/4 */}
      <path d="M 24 -6 Q 22 -3 23 0" stroke={shade(L.skinShade, -0.2)} strokeWidth={1.4} fill="none" opacity={0.6} />
      {L.stubble && <path d="M 6 27 C 15 28 23 25 25.5 18 L 25 12 Q 18 18 10 16 Q 0 14 -10 14 C -6 20 0 25 6 27 Z" fill={L.hair} opacity={0.35} />}
      {L.blush && <ellipse cx={16} cy={9} rx={6} ry={3.5} fill={L.blush} opacity={0.35} />}
      {/* ухо */}
      <ellipse cx={-6} cy={2} rx={4.5} ry={7.5} fill={L.skin} stroke={shade(L.skinShade, -0.25)} strokeWidth={1.2} />
      <path d="M -6 -2 q 2 3 0 6" stroke={L.skinShade} strokeWidth={1.4} fill="none" />
      {/* нос: тень */}
      <path d="M 24 -4 Q 25 3 26 6" stroke={L.skinShade} strokeWidth={1.4} fill="none" opacity={0.7} />
      <path d="M 24 8 q 2 1 3 0" stroke={shade(L.skinShade, -0.2)} strokeWidth={1.2} fill="none" />
      {/* глаз */}
      <g transform={`translate(15 -3) scale(1 ${eyeOpen})`}>
        <path d="M -5 0 Q 0 -4.5 5.5 -0.5 Q 0 3.5 -5 0 Z" fill="#F2EEE6" />
        <circle cx={1.2 + look} cy={0} r={2.6} fill={L.iris} /><circle cx={1.4 + look} cy={0} r={1.3} fill="#0A0A0A" /><circle cx={2.2 + look} cy={-0.9} r={0.7} fill="#FFFFFF" />
        <path d={`M -5 0 Q 0 ${-4.5 + 9 * lid} 5.5 -0.5 L 5.5 -3 Q 0 -7 -5 -3 Z`} fill={L.skin} />
        <path d={`M -5.2 0 Q 0 ${-4.8 + 9 * lid} 5.8 -0.6`} stroke="#1A1210" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        {L.lashes && <path d={`M 4.5 ${-1.5 + 2 * lid} l 2 -2 M 3 ${-2.6 + 3 * lid} l 1.5 -2.4`} stroke="#1A1210" strokeWidth={1} />}
        <path d="M -3 3.4 Q 1 4.6 4.5 2.6" stroke={L.skinShade} strokeWidth={0.9} fill="none" opacity={0.6} />
      </g>
      {/* бровь */}
      <path d={`M 9 ${by + expr.browTilt * 1.8} Q 15 ${by - 2.5} 22 ${by - expr.browTilt * 1.5}`} stroke={shade(L.hair, -0.2)} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {/* губы / рот */}
      {expr.mouth === "open" || expr.mouth === "o"
        ? <ellipse cx={22.5} cy={14} rx={expr.mouth === "o" ? 2.4 : 3.4} ry={expr.mouth === "o" ? 2.6 : 3.6} fill="#3A1A18" />
        : <>
          <path d={expr.mouth === "sad" ? "M 18 15.5 Q 22.5 13.2 26.5 13.8" : expr.mouth === "smile" ? "M 18 13 Q 22 16 26.5 13" : "M 18 14 Q 22.5 13.4 26.5 13.6"} stroke="#6A3A34" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <path d="M 20 15.5 Q 23 17 26 15.6" stroke={shade(L.skin, 0.25)} strokeWidth={1.2} fill="none" opacity={0.7} />
        </>}
      {/* волосы спереди */}
      {L.hairStyle === "messy" && (
        <g>
          <path d="M -23 2 C -28 -18 -16 -36 4 -36 C 20 -36 30 -26 27 -14 L 22 -18 L 23 -11 L 16 -19 L 14 -12 L 8 -20 L 4 -14 C -4 -18 -12 -14 -14 -4 L -16 8 Z" fill={`url(#fhr-${id})`} />
          {[[-14, -24, 10, -32], [-6, -30, 16, -30], [0, -22, 20, -22], [-18, -10, -8, -26]].map(([a, b, c, d], i) =>
            <path key={i} d={`M ${a} ${b} Q ${(a + c) / 2} ${b - 6} ${c} ${d}`} stroke={L.hairHi} strokeWidth={1.4} fill="none" opacity={0.6} />)}
        </g>
      )}
      {L.hairStyle === "braid" && (
        <g>
          <path d="M -22 4 C -28 -20 -14 -36 6 -35 C 22 -34 29 -24 27 -10 Q 22 -16 14 -14 Q 6 -22 -2 -20 Q -12 -14 -14 0 Z" fill={`url(#fhr-${id})`} />
          <path d="M 12 -32 Q 22 -26 26 -12 M 4 -33 Q 14 -24 16 -14" stroke={L.hairHi} strokeWidth={1.4} fill="none" opacity={0.6} />
        </g>
      )}
      {L.hairStyle === "receding" && (
        <g>
          <path d="M -23 4 C -27 -14 -20 -30 -6 -32 Q 2 -28 0 -22 Q -10 -20 -14 -6 L -16 10 Z" fill={`url(#fhr-${id})`} />
          <path d="M -20 -14 Q -14 -24 -4 -28" stroke={L.hairHi} strokeWidth={1.2} fill="none" opacity={0.6} />
        </g>
      )}
      {/* бинт: через макушку и ухо, под подбородок; кровь на ухе */}
      {L.bandage && (
        <g>
          <path d="M -18 -30 Q -6 -36 4 -31 L 1 -22 Q -2 0 0 20 Q 4 28 12 27 L 8 33 Q -8 33 -12 18 Q -18 -4 -18 -30 Z" fill="#E6E1D6" stroke="#9A958A" strokeWidth={1.2} />
          {[-24, -14, -4, 6, 16].map((y, i) => <path key={i} d={`M -16 ${y} Q -8 ${y - 3} 0 ${y + 1}`} stroke="#B9B4A8" strokeWidth={1} fill="none" />)}
          <ellipse cx={-6} cy={2} rx={6} ry={8} fill="#8E2A22" opacity={0.55} />
          <ellipse cx={-5} cy={0} rx={3} ry={4} fill="#6A1A16" opacity={0.5} />
        </g>
      )}
      {glow > 0 && <path d="M 26 -12 L 29 4 Q 31 7 27 8 L 26 18 C 23 25 15 28 7 27" stroke="#BFD8FF" strokeWidth={2.5} fill="none" opacity={0.5 * glow} />}
    </g>
  );
};

/* ---------- Корпус ---------- */
const Torso: React.FC<{ L: FigureLook; len: number; frame: number }> = ({ L, len, frame }) => {
  const br = Math.sin(frame / 22) * 1.6;
  const id = L.id;
  const T = -len;
  return (
    <g>
      <defs><linearGradient id={`ftp-${id}`} x1="1" y1="0" x2="0" y2="0"><stop offset="0" stopColor={shade(L.top, 0.12)} /><stop offset="0.55" stopColor={L.top} /><stop offset="1" stopColor={L.topShade} /></linearGradient></defs>
      {/* капюшон/ворот сзади */}
      {L.topStyle === "jacket" && <path d={`M -18 ${T + 4} Q -30 ${T - 6} -16 ${T - 14} Q 0 ${T - 14} 4 ${T + 2} Z`} fill={L.inner} />}
      {L.topStyle === "raincoat" && <path d={`M -16 ${T + 6} Q -32 ${T - 4} -18 ${T - 16} Q 0 ${T - 18} 4 ${T + 2} Z`} fill={L.topShade} />}
      <path d={`M -20 4 Q -24 ${T * 0.5} -18 ${T + 6} Q -10 ${T - 2} 6 ${T - 2} Q ${20 + br} ${T + 4} ${22 + br} ${T * 0.62} Q ${24 + br} ${T * 0.3} 20 4 Q 0 10 -20 4 Z`}
        fill={`url(#ftp-${id})`} stroke={shade(L.topShade, -0.3)} strokeWidth={1.2} />
      {/* складки */}
      <path d={`M -10 ${T * 0.3} q 10 -4 22 2 M -12 ${T * 0.55} q 12 -3 20 4 M 8 -6 q 4 -12 2 -24`} stroke="#000" strokeWidth={1.4} opacity={0.22} fill="none" />
      {/* контровой свет по переду */}
      <path d={`M ${6} ${T - 1} Q ${20 + br} ${T + 4} ${22 + br} ${T * 0.62} Q ${24 + br} ${T * 0.3} 20 4`} stroke={shade(L.top, 0.45)} strokeWidth={2} fill="none" opacity={0.5} />
      {L.topStyle === "jacket" && (<>
        <path d={`M 14 ${T + 2} L 16 0`} stroke={shade(L.topShade, -0.3)} strokeWidth={1.6} />
        <rect x={4} y={T * 0.62} width={12} height={10} rx={2} fill={L.topShade} />
        <path d={`M 6 ${T - 2} L 14 ${T + 12} L 18 ${T}`} fill={L.inner} />
      </>)}
      {L.topStyle === "raincoat" && [0.3, 0.5, 0.7].map((k, i) => <circle key={i} cx={18} cy={T * k} r={2.2} fill={shade(L.topShade, -0.3)} />)}
      {L.topStyle === "coat" && (<>
        <path d={`M 4 ${T - 1} L 16 ${T + 22} L 20 ${T * 0.5}`} stroke={shade(L.topShade, -0.35)} strokeWidth={2} fill="none" />
        {[0.45, 0.25].map((k, i) => <circle key={i} cx={17} cy={T * k} r={2.4} fill="#1A140E" />)}
      </>)}
      {L.scarf && <path d={`M -10 ${T - 2} Q 4 ${T + 8} 20 ${T} L 18 ${T + 10} Q 4 ${T + 16} -8 ${T + 8} Z M 10 ${T + 8} L 14 ${T + 34} L 6 ${T + 34} Z`} fill={L.scarf} />}
    </g>
  );
};

/* ---------- Рука и нога ---------- */
const Arm: React.FC<{ L: FigureLook; p: HeroPose["armL"]; far?: boolean; d: ReturnType<typeof dims>; hold?: HeroPose["holdL"]; glow?: number }> = ({ L, p, far, d, hold, glow }) => {
  const c = far ? L.topShade : L.top;
  const k = L.kid ? 0.78 : 1;
  return (
    <g transform={`rotate(${p.sh})`}>
      <Taper len={d.upper} w1={17 * k} w2={13 * k} fill={c} hi={far ? undefined : shade(L.top, 0.4)} fold />
      <g transform={`translate(0 ${d.upper}) rotate(${p.el})`}>
        <Taper len={d.fore} w1={13 * k} w2={11 * k} fill={c} hi={far ? undefined : shade(L.top, 0.4)} fold />
        <ellipse cx={0} cy={d.fore} rx={6.5 * k} ry={3} fill={shade(c, -0.25)} />
        <g transform={`translate(0 ${d.fore}) rotate(${p.wr})`}><Hand L={L} far={far} hold={hold} glow={glow} s={k} /></g>
      </g>
    </g>
  );
};
const Leg: React.FC<{ L: FigureLook; p: HeroPose["legL"]; far?: boolean; d: ReturnType<typeof dims> }> = ({ L, p, far, d }) => {
  const c = far ? L.pantsShade : L.pants;
  const k = L.kid ? 0.78 : 1;
  return (
    <g transform={`rotate(${p.hip})`}>
      <Taper len={d.thigh} w1={24 * k} w2={16 * k} fill={c} hi={far ? undefined : shade(L.pants, 0.35)} fold />
      <g transform={`translate(0 ${d.thigh}) rotate(${p.knee})`}>
        <Taper len={d.shin} w1={16 * k} w2={12 * k} fill={c} hi={far ? undefined : shade(L.pants, 0.35)} />
        <g transform={`translate(0 ${d.shin}) rotate(${-(p.hip + p.knee) + p.foot})`}>
          <path d={`M ${-7 * k} ${-4} Q ${-8 * k} ${d.ankle} ${-6 * k} ${d.ankle + 2} L ${22 * k} ${d.ankle + 2} Q ${24 * k} ${d.ankle - 6} ${12 * k} ${-1} Z`} fill={far ? shade(L.shoes, -0.2) : L.shoes} />
          <rect x={-7 * k} y={d.ankle} width={30 * k} height={3} rx={1.5} fill="#0A0806" />
        </g>
      </g>
    </g>
  );
};

/* ---------- Фигура целиком ---------- */
export const Figure: React.FC<{ pose: HeroPose; look: FigureLook; frame?: number }> = ({ pose, look: L, frame = 0 }) => {
  const d = dims(L.kid);
  const heroHip = 120, myHip = d.thigh + d.shin + d.ankle;
  const y = pose.y * (myHip / heroHip);
  const sh = d.sh;
  const neck = { x: 6, y: -d.torso - 2 };
  return (
    <g transform={`translate(${pose.x} ${y})`}>
      <g transform={`rotate(${pose.torso})`}><g transform={`translate(${sh.x - 5} ${sh.y + 2})`}><Arm L={L} p={pose.armR} far d={d} hold={pose.holdR} glow={pose.phoneGlow} /></g></g>
      <g transform="translate(-4 0)"><Leg L={L} p={pose.legR} far d={d} /></g>
      <g transform={`rotate(${pose.torso})`}>
        <Torso L={L} len={d.torso} frame={frame} />
        <g transform={`translate(${neck.x} ${neck.y}) rotate(${pose.head}) translate(4 ${-d.neck - 18}) scale(${d.headS})`}>
          <Head L={L} expr={pose.expr} frame={frame} glow={pose.phoneGlow} />
        </g>
      </g>
      <g transform="translate(4 0)"><Leg L={L} p={pose.legL} d={d} /></g>
      <g transform={`rotate(${pose.torso})`}><g transform={`translate(${sh.x + 4} ${sh.y + 4})`}><Arm L={L} p={pose.armL} d={d} hold={pose.holdL} glow={pose.phoneGlow} /></g></g>
      {L.plush && (
        <g transform={`rotate(${pose.torso}) translate(20 ${-d.torso * 0.45})`}>
          <ellipse cx={0} cy={0} rx={10} ry={13} fill="#C9C2B8" /><circle cx={0} cy={-16} r={8} fill="#C9C2B8" />
          <ellipse cx={-4} cy={-30} rx={2.6} ry={9} fill="#C9C2B8" /><ellipse cx={4} cy={-29} rx={2.6} ry={9} fill="#B9B2A8" />
          <circle cx={3} cy={-17} r={1.2} fill="#1A1A1A" /><path d="M -2 4 q 3 2 6 0" stroke="#8A8278" strokeWidth={1.2} fill="none" />
        </g>
      )}
    </g>
  );
};
