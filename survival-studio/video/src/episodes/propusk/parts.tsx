import React from "react";
import { Easing, interpolate, random } from "remotion";
import { REGIME, SRYV } from "../../style/palette";
import { Icon, IconName } from "../../ui/Icons";
import { HeroHead, NEUTRAL } from "../../rig/Hero";

/* ===================== общие помощники ===================== */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
/** 0→1 с ease-out, начиная с кадра start, длительность dur кадров. */
export const ap = (f: number, start: number, dur = 6) =>
  interpolate(f, [start, start + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
export const px = (v: number) => Math.round(v);

export const INK = { R: REGIME.olive, S: "#C9D2E0" } as const;
export const FLOOR_Y = 1040;

/** Фон схем: «Режим» — бумага сверху и шалфей внизу (под субтитрами), «Срыв» — тёмный. */
export const SchemaBg: React.FC<{ pal: "R" | "S" }> = ({ pal }) => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    {pal === "R" ? (
      <>
        <rect width={1080} height={1920} fill={REGIME.paper} />
        <rect y={FLOOR_Y} width={1080} height={1920 - FLOOR_Y} fill={REGIME.sage} />
        <rect y={FLOOR_Y - 14} width={1080} height={14} fill={REGIME.olive} opacity={0.85} />
        <rect y={1520} width={1080} height={400} fill={REGIME.olive} opacity={0.18} />
      </>
    ) : (
      <>
        <rect width={1080} height={1920} fill={SRYV.bg1} />
        <rect y={FLOOR_Y} width={1080} height={1920 - FLOOR_Y} fill={SRYV.bg0} />
        {[70, 170, 300, 470, 680].map((d) => <line key={d} x1={0} x2={1080} y1={FLOOR_Y + d} y2={FLOOR_Y + d} stroke="#1C2331" strokeWidth={3} />)}
        {/* тот же мир: полоска тёплого света из-под двери у правого края */}
        <rect x={760} y={FLOOR_Y - 8} width={320} height={8} fill={SRYV.lamp} opacity={0.8} />
        <path d={`M 760 ${FLOOR_Y} L 1080 ${FLOOR_Y} L 1080 ${FLOOR_Y + 150} L 560 ${FLOOR_Y + 150} Z`} fill={SRYV.lamp} opacity={0.07} />
        <rect y={1520} width={1080} height={400} fill="#000" opacity={0.25} />
      </>
    )}
  </svg>
);

/** Живая камера для слоя: наезд на `amount` за `dur` кадров. */
export const Push: React.FC<{ f: number; dur: number; amount?: number; origin?: string; base?: number; children: React.ReactNode }> = ({
  f, dur, amount = 0.03, origin = "50% 40%", base = 1, children,
}) => (
  <div style={{ position: "absolute", inset: 0, transform: `scale(${base * (1 + amount * Math.min(1, f / Math.max(1, dur)))})`, transformOrigin: origin }}>
    {children}
  </div>
);

const T: React.CSSProperties = { fontFamily: "JetBrains Mono", fontWeight: 700, lineHeight: 1 };
const H: React.CSSProperties = { fontFamily: "Inter Display", fontWeight: 900, lineHeight: 1, textTransform: "uppercase" };

/** Подпись схемы (центр по x). */
export const Caption: React.FC<{ x: number; y: number; text: string; color: string; size?: number; font?: "mono" | "head" | "hand"; opacity?: number; w?: number }> = ({
  x, y, text, color, size = 40, font = "mono", opacity = 1, w = 700,
}) => (
  <div style={{
    position: "absolute", left: px(x - w / 2), top: px(y - size / 2), width: w, height: size,
    display: "flex", alignItems: "center", justifyContent: "center", opacity, color,
    ...(font === "mono" ? T : font === "head" ? H : { fontFamily: "Caveat", fontWeight: 700, lineHeight: 1 }), fontSize: size,
  }}>{text}</div>
);

/* ===================== красная диагональная лента ===================== */
export const Ribbon: React.FC<{ f: number; start: number; text: string; y?: number }> = ({ f, start, text, y = 770 }) => {
  const k = ap(f, start, 7);
  if (k <= 0) return null;
  return (
    <div style={{
      position: "absolute", left: -120, width: 1320, top: px(y - 62), height: 124,
      transform: `translateX(${px((1 - k) * -1320)}px) rotate(-7deg)`, transformOrigin: "50% 50%",
      background: SRYV.fail, boxShadow: "0 10px 30px rgba(0,0,0,.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ ...H, fontSize: 70, color: "#FFFFFF", letterSpacing: 1 }}>{text}</div>
    </div>
  );
};

/* ===================== календарь-трекер ===================== */
export type Cell = "empty" | "green" | "miss" | "paw" | "lock" | "pulse";
export const Calendar: React.FC<{
  f: number; pal: "R" | "S"; cells: { state: Cell; at: number }[]; dim?: number; y?: number; chainUpTo?: number; labels?: boolean; size?: number;
}> = ({ f, pal, cells, dim = 0, y = 680, chainUpTo = -1, labels = true, size = 124 }) => {
  const n = cells.length, gap = 18, W = n * size + (n - 1) * gap, x0 = (1080 - W) / 2;
  const ink = INK[pal], empty = pal === "R" ? "#E4DCC8" : "#1F2636";
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 1 - dim * 0.65 }}>
        {chainUpTo > 0 && (
          <line x1={x0 + size / 2} x2={x0 + size / 2 + (chainUpTo - 1) * (size + gap)} y1={y} y2={y}
            stroke={SRYV.progress} strokeWidth={8} strokeLinecap="round" opacity={0.6} />
        )}
        {cells.map((c, i) => {
          const k = ap(f, c.at, 6);
          const x = x0 + i * (size + gap);
          const s = 0.8 + 0.2 * k;
          const fill = c.state === "green" || c.state === "paw" ? SRYV.progress : empty;
          const stroke = c.state === "miss" ? SRYV.fail : c.state === "pulse" ? SUBY : pal === "R" ? REGIME.olive : "#3A4560";
          const pulse = c.state === "pulse" ? 0.5 + 0.5 * Math.sin((f - c.at) / 5) : 0;
          return (
            <g key={i} transform={`translate(${px(x + size / 2)} ${y}) scale(${s})`} opacity={Math.max(0.15, k)}>
              <rect x={-size / 2} y={-size / 2} width={size} height={size} rx={18} fill={fill}
                stroke={stroke} strokeWidth={c.state === "miss" || c.state === "pulse" ? 7 + pulse * 3 : 4} />
              {c.state === "green" && <path d="M -24 2 l 16 16 l 32 -36" stroke="#0E1118" strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />}
              {c.state === "paw" && (
                <g fill="#0E1118" opacity={0.85}>
                  <ellipse cx={0} cy={12} rx={20} ry={16} /><circle cx={-24} cy={-12} r={8} /><circle cx={-9} cy={-26} r={8} /><circle cx={9} cy={-26} r={8} /><circle cx={24} cy={-12} r={8} />
                </g>
              )}
              {c.state === "lock" && (
                <g stroke={ink} strokeWidth={6} fill="none">
                  <rect x={-22} y={-6} width={44} height={34} rx={6} fill={ink} />
                  <path d="M -13 -6 v -12 a 13 13 0 0 1 26 0 v 12" />
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {labels && cells.map((c, i) => (
        <Caption key={i} x={x0 + i * (size + gap) + size / 2} y={y + size / 2 + 40} w={size + gap} text={String(i + 1)} color={ink} size={36} opacity={ap(f, c.at, 6) * (1 - dim * 0.6)} />
      ))}
    </>
  );
};
const SUBY = "#F5C518";

/* ===================== шкала дней ===================== */
export const RULER = { x0: 80, x1: 1000, y: 700, max: 270 };
export const dayX = (d: number) => RULER.x0 + (d / RULER.max) * (RULER.x1 - RULER.x0);

export const Ruler: React.FC<{ f: number; drawAt: number; pal: "R" | "S" }> = ({ f, drawAt, pal }) => {
  const k = ap(f, drawAt, 18);
  const ink = INK[pal];
  const ticks = Array.from({ length: 28 }, (_, i) => i * 10);
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={RULER.x0} x2={RULER.x0 + (RULER.x1 - RULER.x0) * k} y1={RULER.y} y2={RULER.y} stroke={ink} strokeWidth={5} strokeLinecap="round" />
        {ticks.map((d, i) => {
          const kk = ap(f, drawAt + i * 0.6, 5);
          const big = d % 50 === 0;
          return <line key={d} x1={px(dayX(d))} x2={px(dayX(d))} y1={RULER.y} y2={RULER.y + (big ? 30 : 16) * kk} stroke={ink} strokeWidth={big ? 4 : 2.5} opacity={kk} />;
        })}
      </svg>
      {[0, 50, 100, 150, 200, 250].map((d, i) => (
        <Caption key={d} x={dayX(d)} y={RULER.y + 66} w={120} text={String(d)} color={ink} size={34} opacity={ap(f, drawAt + 4 + i * 2, 6) * 0.8} />
      ))}
    </>
  );
};

/** Отметка на шкале: вертикальная черта + подпись над ней; crossAt — перечеркнуть. */
export const Marker: React.FC<{ f: number; day: number; at: number; label: string; color: string; crossAt?: number; roll?: boolean }> = ({
  f, day, at, label, color, crossAt, roll,
}) => {
  const k = ap(f, at, 7);
  if (k <= 0) return null;
  const x = px(dayX(day));
  const shown = roll ? String(Math.round(interpolate(f, [at, at + 14], [0, day], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }))) + label.replace(/^\d+/, "") : label;
  const c = crossAt !== undefined ? ap(f, crossAt, 6) : 0;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={x} x2={x} y1={RULER.y - 150 * k} y2={RULER.y + 6} stroke={color} strokeWidth={8} strokeLinecap="round" />
        <circle cx={x} cy={RULER.y} r={14 * k} fill={color} />
      </svg>
      <Caption x={x} y={RULER.y - 200} w={360} text={shown} color={color} size={64} font="head" opacity={k} />
      {c > 0 && (
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
          <line x1={x - 120} y1={RULER.y - 170} x2={x - 120 + 240 * c} y2={RULER.y - 230 + 60 * (1 - c)} stroke={SRYV.fail} strokeWidth={12} strokeLinecap="round" />
        </svg>
      )}
    </>
  );
};

/** Полоса диапазона — появляется целиком сразу (правило для диапазонов). */
export const RangeBand: React.FC<{ f: number; from: number; to: number; at: number; label: string; color: string }> = ({ f, from, to, at, label, color }) => {
  const k = ap(f, at, 6);
  if (k <= 0) return null;
  const x0 = px(dayX(from)), x1 = px(dayX(to));
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: k }}>
        <rect x={x0} y={RULER.y - 26} width={x1 - x0} height={52} rx={26} fill={color} opacity={0.35} />
        <rect x={x0} y={RULER.y - 26} width={x1 - x0} height={52} rx={26} fill="none" stroke={color} strokeWidth={4} />
      </svg>
      <Caption x={540} y={RULER.y - 300} w={900} text={label} color={color} size={80} font="head" opacity={k} />
    </>
  );
};

/** Точки-участники: сетка → по шкале. scatter 0..1. */
export const PeopleDots: React.FC<{ f: number; at: number; scatter: number; pal: "R" | "S" }> = ({ f, at, scatter, pal }) => {
  const n = 96;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: n }, (_, i) => {
        const k = ap(f, at + i * 0.25, 5);
        const gx = 180 + (i % 12) * 66, gy = 790 + Math.floor(i / 12) * 26;
        // лог-нормальное распределение вокруг медианы 66, в пределах 18–254
        const u = random(`d${i}`), v = random(`e${i}`);
        const z = Math.sqrt(-2 * Math.log(u + 1e-6)) * Math.cos(2 * Math.PI * v);
        const day = Math.min(254, Math.max(18, Math.exp(Math.log(66) + 0.55 * z)));
        const tx = dayX(day), ty = RULER.y + 110 + random(`h${i}`) * 200;
        const x = gx + (tx - gx) * scatter, y = gy + (ty - gy) * scatter;
        return <circle key={i} cx={px(x)} cy={px(y)} r={9} fill={pal === "S" ? "#8FA3C2" : REGIME.olive} opacity={0.85 * k} />;
      })}
    </svg>
  );
};

/* ===================== цепочка ===================== */
export const Chain: React.FC<{ f: number; at: number; breakAt: number }> = ({ f, at, breakAt }) => {
  const b = ap(f, breakAt, 8);
  const shake = f >= breakAt && f < breakAt + 2 ? (f - breakAt === 0 ? 6 : -4) : 0;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(${shake} 0)`}>
        {[0, 1, 2, 3].map((i) => {
          const k = ap(f, at + i * 3, 6);
          const x = 210 + i * 220, y = 680;
          const isLast = i === 3;
          const col = isLast ? (b > 0 ? SRYV.fail : SRYV.progress) : SRYV.progress;
          if (isLast && b > 0) {
            return (
              <g key={i} opacity={k}>
                <path d={`M ${x - 10} ${y - 60} A 110 60 0 0 0 ${x - 10} ${y + 60}`} transform={`translate(${-30 * b} ${40 * b}) rotate(${-25 * b} ${x} ${y})`}
                  stroke={col} strokeWidth={26} fill="none" strokeLinecap="round" />
                <path d={`M ${x + 10} ${y - 60} A 110 60 0 0 1 ${x + 10} ${y + 60}`} transform={`translate(${60 * b} ${90 * b}) rotate(${35 * b} ${x} ${y})`}
                  stroke={col} strokeWidth={26} fill="none" strokeLinecap="round" opacity={1 - 0.3 * b} />
              </g>
            );
          }
          return <ellipse key={i} cx={x} cy={y} rx={120} ry={62} stroke={col} strokeWidth={26} fill="none" opacity={k} transform={`scale(${0.85 + 0.15 * k})`} style={{ transformOrigin: `${x}px ${y}px` }} />;
        })}
      </g>
    </svg>
  );
};

/* ===================== кривая привычки ===================== */
export const HabitCurve: React.FC<{ f: number; at: number; dipAt: number; dur: number }> = ({ f, at, dipAt, dur }) => {
  const k = interpolate(f, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const X0 = 120, X1 = 960, Y0 = 900, Y1 = 330;
  const dipT = 0.42;
  const yAt = (t: number) => {
    let v = 1 - Math.exp(-t * 3.2);
    if (t > dipT) v -= 0.035 * Math.exp(-(t - dipT) * 18); // крошечная ступенька — пропуск
    return Y0 - (Y0 - Y1) * v;
  };
  const pts = Array.from({ length: 121 }, (_, i) => i / 120).filter((t) => t <= k);
  const d = pts.map((t, i) => `${i ? "L" : "M"} ${px(X0 + (X1 - X0) * t)} ${px(yAt(t))}`).join(" ");
  const dipShown = k >= dipT && f >= dipAt;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <line x1={X0} x2={X1} y1={Y0} y2={Y0} stroke={REGIME.olive} strokeWidth={4} />
        <line x1={X0} x2={X0} y1={Y0} y2={Y1 - 40} stroke={REGIME.olive} strokeWidth={4} />
        <path d={d} stroke={SRYV.progress} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {dipShown && <circle cx={px(X0 + (X1 - X0) * dipT)} cy={px(yAt(dipT + 0.01))} r={26} fill="none" stroke={SRYV.fail} strokeWidth={6} opacity={ap(f, dipAt, 6)} />}
      </svg>
      <Caption x={X0 + 150} y={Y1 - 90} w={360} text="АВТОМАТИЗМ" color={REGIME.olive} size={36} opacity={ap(f, at, 8)} />
      <Caption x={X1 - 80} y={Y0 + 50} w={240} text="ДНИ →" color={REGIME.olive} size={36} opacity={ap(f, at, 8)} />
      {dipShown && <Caption x={X0 + (X1 - X0) * dipT} y={yAt(dipT) + 90} w={380} text="ПРОПУСК" color={SRYV.fail} size={40} font="head" opacity={ap(f, dipAt + 3, 6)} />}
    </>
  );
};

/* ===================== лестница маленьких шагов ===================== */
export const Stairs: React.FC<{ f: number; at: number; stepAt: number }> = ({ f, at, stepAt }) => {
  const steps = 6, w = 110, h = 70, x0 = 400, base = 960;
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {/* обрыв «сразу всё» */}
        <path d={`M 60 ${base} L 60 420 L 300 420 L 330 ${base} Z`} fill={REGIME.fog} opacity={ap(f, at, 8)} />
        <path d={`M 330 ${base} L 300 420`} stroke={SRYV.fail} strokeWidth={6} strokeDasharray="14 12" opacity={ap(f, at + 4, 8)} />
        {Array.from({ length: steps }, (_, i) => {
          const k = ap(f, at + 6 + i * 3, 6);
          return <rect key={i} x={x0 + i * w} y={px(base - (i + 1) * h * k)} width={w - 6} height={px((i + 1) * h * k)} fill={i === 0 && f >= stepAt ? SRYV.progress : REGIME.sage} stroke={REGIME.olive} strokeWidth={3} />;
        })}
        {/* герой маленьким силуэтом-головой на первой ступени */}
        {f >= stepAt && (
          <g transform={`translate(${x0 + 52} ${base - h - 58}) scale(0.9)`} opacity={ap(f, stepAt, 6)}>
            <HeroHead expr={{ ...NEUTRAL.expr, mouth: "smile", brow: 0.4 }} />
          </g>
        )}
      </svg>
      <Caption x={180} y={370} w={300} text="СРАЗУ ВСЁ" color={SRYV.fail} size={42} font="head" opacity={ap(f, at + 4, 8)} />
    </>
  );
};

/* ===================== таймер / большая цифра ===================== */
export const TimerCard: React.FC<{ f: number; at: number; text: string; color: string; strike?: { text: string; at: number }; y?: number }> = ({ f, at, text, color, strike, y = 620 }) => {
  const k = ap(f, at, 6);
  return (
    <>
      {strike && (
        <>
          <Caption x={540} y={y - 250} w={700} text={strike.text} color={REGIME.olive} size={120} font="head" opacity={1 - 0.5 * ap(f, strike.at, 6)} />
          <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
            <line x1={300} y1={y - 220} x2={300 + 480 * ap(f, strike.at, 6)} y2={y - 280} stroke={SRYV.fail} strokeWidth={14} strokeLinecap="round" />
          </svg>
        </>
      )}
      <div style={{
        position: "absolute", left: 190, width: 700, top: px(y - 120), height: 240, borderRadius: 40,
        border: `8px solid ${color}`, boxShadow: `0 0 30px ${color}66`, background: "rgba(14,17,24,0.9)",
        display: "flex", alignItems: "center", justifyContent: "center", opacity: k, transform: `scale(${0.94 + 0.06 * k})`,
      }}>
        <div style={{ fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 170, lineHeight: 1, color: "#FFFFFF", letterSpacing: 4 }}>{text}</div>
      </div>
    </>
  );
};

/* ===================== будильник крупно ===================== */
export const AlarmClock: React.FC<{ f: number; h: number; m: number; ringAt?: number; y?: number }> = ({ f, h, m, ringAt = 0, y = 560 }) => {
  const ringing = f >= ringAt && f < ringAt + 30;
  const shake = ringing ? Math.sin((f - ringAt) * 2.4) * 4 : 0;
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <g transform={`translate(540 ${y}) rotate(${shake})`}>
        {[-1, 1].map((s) => (
          <g key={s} transform={`rotate(${s * 38})`}>
            <path d="M -70 -250 a 70 46 0 0 1 140 0 Z" fill={REGIME.dawn} stroke={REGIME.olive} strokeWidth={8} />
          </g>
        ))}
        <path d="M -150 230 L -190 290 M 150 230 L 190 290" stroke={REGIME.olive} strokeWidth={18} strokeLinecap="round" />
        <circle r={250} fill={REGIME.dawn} stroke={REGIME.olive} strokeWidth={10} />
        <circle r={210} fill={REGIME.paper} stroke={REGIME.olive} strokeWidth={6} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={0} y1={-180} x2={0} y2={i % 3 ? -164 : -148} stroke={REGIME.olive} strokeWidth={i % 3 ? 6 : 10} strokeLinecap="round" transform={`rotate(${i * 30})`} />
        ))}
        <line x1={0} y1={0} x2={0} y2={-105} stroke={REGIME.olive} strokeWidth={18} strokeLinecap="round" transform={`rotate(${(h % 12) * 30 + m * 0.5})`} />
        <line x1={0} y1={0} x2={0} y2={-160} stroke={REGIME.olive} strokeWidth={10} strokeLinecap="round" transform={`rotate(${m * 6})`} />
        <circle r={20} fill={REGIME.olive} />
        {ringing && [0, 1, 2].map((i) => (
          <path key={i} d={`M ${280 + i * 28} -120 q 30 ${-20} 20 ${-60}`} stroke={REGIME.dawn} strokeWidth={8} fill="none" strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin((f - ringAt) / 2 + i)} />
        ))}
      </g>
    </svg>
  );
};

/* ===================== лист блокнота ===================== */
export const NotebookCard: React.FC<{ f: number; at: number; lines: { text: string; at: number; underlineAt?: number }[]; route?: boolean }> = ({ f, at, lines, route }) => {
  const k = ap(f, at, 8);
  return (
    <div style={{ position: "absolute", left: 110, top: px(170 + (1 - k) * 60), width: 860, height: 820, opacity: k, transform: "rotate(-2deg)" }}>
      <svg width={860} height={820} style={{ position: "absolute", inset: 0 }}>
        <rect x={6} y={10} width={850} height={806} rx={14} fill="#00000022" />
        <rect width={850} height={806} rx={14} fill="#FFFDF6" stroke="#CFC4A8" strokeWidth={3} />
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={40} x2={810} y1={140 + i * 76} y2={140 + i * 76} stroke={REGIME.fog} strokeWidth={3} />)}
        <line x1={110} x2={110} y1={0} y2={806} stroke={REGIME.dawn} strokeWidth={4} opacity={0.6} />
        {route && (
          <path d="M 520 620 C 420 520 520 420 640 460 S 820 640 700 700 S 560 700 520 620" stroke={REGIME.dawn} strokeWidth={7} fill="none" strokeDasharray="18 14"
            strokeDashoffset={px((1 - ap(f, at + 6, 20)) * 900)} pathLength={900} />
        )}
      </svg>
      {lines.map((l, i) => {
        const kk = ap(f, l.at, 6);
        return (
          <div key={i} style={{ position: "absolute", left: 140, top: 60 + i * 152, height: 120, display: "flex", alignItems: "center", opacity: kk }}>
            <div style={{ fontFamily: "Caveat", fontWeight: 700, fontSize: 104, lineHeight: 1, color: REGIME.olive }}>{l.text}</div>
            {l.underlineAt !== undefined && (
              <div style={{ position: "absolute", left: 0, bottom: 6, height: 10, borderRadius: 5, background: SRYV.fail, width: `${100 * ap(f, l.underlineAt, 8)}%` }} />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ===================== петля привычки ===================== */
export const HabitLoop: React.FC<{ f: number; at: number; nodes: { icon: IconName; label: string; at: number }[] }> = ({ f, at, nodes }) => {
  const C = { x: 540, y: 620 }, R = 300;
  const pos = nodes.map((_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return { x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) };
  });
  return (
    <>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <circle cx={C.x} cy={C.y} r={R} fill="none" stroke={REGIME.olive} strokeWidth={6} strokeDasharray="16 16" opacity={ap(f, at, 10) * 0.6} />
        {pos.map((p, i) => {
          const on = ap(f, nodes[i].at, 6);
          return (
            <g key={i}>
              <circle cx={px(p.x)} cy={px(p.y)} r={108} fill={on > 0 ? REGIME.paper : "#E4DCC8"} stroke={on > 0 ? SRYV.progress : REGIME.olive} strokeWidth={6 + 4 * on} />
              {on > 0 && <circle cx={px(p.x)} cy={px(p.y)} r={124} fill="none" stroke={SRYV.progress} strokeWidth={3} opacity={0.5 * on} />}
            </g>
          );
        })}
      </svg>
      {pos.map((p, i) => (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: px(p.x - 50), top: px(p.y - 62), opacity: 0.35 + 0.65 * ap(f, nodes[i].at, 6) }}>
            <Icon name={nodes[i].icon} color={REGIME.olive} size={100} />
          </div>
          <Caption x={p.x} y={p.y + (i === 0 ? -150 : 150)} w={360} text={nodes[i].label} color={REGIME.olive} size={38} opacity={ap(f, at + i * 3, 6)} />
        </React.Fragment>
      ))}
    </>
  );
};

/* ===================== карточка исследования ===================== */
export const StudyCard: React.FC<{ f: number; at: number }> = ({ f, at }) => {
  const k = ap(f, at, 8);
  return (
    <div style={{
      position: "absolute", left: 120, top: px(230 + (1 - k) * 40), width: 840, height: 300, opacity: k, borderRadius: 26,
      background: "#1B2232", border: "3px solid #F5C518", boxShadow: "0 0 24px #F5C51844",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 36,
    }}>
      <svg width={150} height={150} viewBox="0 0 150 150">
        <rect x={8} y={8} width={134} height={134} rx={16} fill="none" stroke="#F5C518" strokeWidth={6} />
        <path d="M 28 112 L 58 82 L 82 96 L 122 44" stroke="#3DDC84" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
        <div style={{ ...H, fontSize: 60, color: "#FFFFFF" }}>Исследование</div>
        <div style={{ ...T, fontSize: 40, color: "#C9D2E0" }}>2010 · Лондон · 96 человек</div>
      </div>
    </div>
  );
};
