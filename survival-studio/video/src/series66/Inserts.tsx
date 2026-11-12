import React from "react";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { HOWTO, RED_LINE } from "./style";
import { ARTYOM_WINTER, Person, STAND } from "../rig2/Person";

export const EASE66 = Easing.bezier(0.16, 1, 0.3, 1);
export const ap66 = (f: number, s: number, d = 8) => interpolate(f, [s, s + d], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE66 });
const OS: React.CSSProperties = { fontFamily: "Oswald", fontWeight: 600, lineHeight: 1, textTransform: "uppercase" };
const r = Math.round;

/* ---------- титул серии: чёрный, слово белым, тонкая красная черта, красный подзаголовок ---------- */
export const SeriesTitle: React.FC<{ f: number; dur: number; title: string; sub: string }> = ({ f, dur, title, sub }) => {
  const o = Math.min(ap66(f, 0, 12), 1 - ap66(f, dur - 12, 12));
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center", opacity: 1 }}>
      <div style={{ opacity: o, display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        <div style={{ ...OS, fontSize: 150, color: "#FFFFFF", letterSpacing: 6 }}>{title}</div>
        <div style={{ width: r(420 * ap66(f, 6, 14)), height: 4, background: RED_LINE }} />
        <div style={{ ...OS, fontSize: 46, color: RED_LINE, letterSpacing: 4 }}>{sub}</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- титр главы: внизу слева, белый капс, короткая красная черта ---------- */
export const ChapterTitle: React.FC<{ f: number; text: string; hold?: number }> = ({ f, text, hold = 105 }) => {
  const o = Math.min(ap66(f, 0, 10), 1 - ap66(f, hold - 10, 10));
  if (o <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 72, top: 1640, opacity: o, transform: `translateY(${r((1 - ap66(f, 0, 10)) * 20)}px)` }}>
      <div style={{ ...OS, fontSize: 78, color: "#FFFFFF", letterSpacing: 3, textShadow: "0 2px 14px rgba(0,0,0,.55)" }}>{text}</div>
      <div style={{ marginTop: 14, width: r(150 * ap66(f, 4, 10)), height: 6, background: RED_LINE }} />
    </div>
  );
};

/* ---------- финал ---------- */
export const ToBeContinued: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill>
    <AbsoluteFill style={{ background: "#000", opacity: 0.25 + 0.6 * ap66(f, 0, 20) }} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 1560, display: "flex", justifyContent: "center", opacity: ap66(f, 10, 14) }}>
      <div style={{ ...OS, fontSize: 64, color: "#FFFFFF", letterSpacing: 5 }}>Продолжение следует</div>
    </div>
  </AbsoluteFill>
);

/* ---------- иконки вставок (без букв) ---------- */
export type HowIcon = "sneakers" | "alarm" | "walk" | "twoMiss" | "layers" | "reflector" | "shortRoute" | "warmup";
const HIcon: React.FC<{ k: HowIcon; c: string }> = ({ k, c }) => {
  const s = { stroke: c, strokeWidth: 9, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg width={200} height={200} viewBox="0 0 200 200">
      {k === "sneakers" && <><path d="M 30 130 L 30 90 L 62 86 L 80 108 L 150 120 Q 172 126 170 140 L 30 140 Z" {...s} /><path d="M 30 152 L 172 152" {...s} /></>}
      {k === "alarm" && <><circle cx={100} cy={108} r={58} {...s} /><path d="M 100 76 L 100 108 L 124 122 M 46 54 L 66 38 M 154 54 L 134 38" {...s} /></>}
      {k === "walk" && <><ellipse cx={74} cy={64} rx={16} ry={24} {...s} /><ellipse cx={126} cy={124} rx={16} ry={24} {...s} /><path d="M 74 100 L 74 108 M 126 160 L 126 168" {...s} /></>}
      {k === "twoMiss" && <><rect x={30} y={70} width={60} height={60} rx={10} {...s} /><rect x={110} y={70} width={60} height={60} rx={10} {...s} /></>}
      {k === "layers" && <><path d="M 60 50 L 140 50 L 160 80 L 140 90 L 140 160 L 60 160 L 60 90 L 40 80 Z" {...s} /><path d="M 70 70 L 130 70 M 70 100 L 130 100" {...s} /></>}
      {k === "reflector" && <><path d="M 60 40 L 140 40 L 150 160 L 50 160 Z" {...s} /><path d="M 56 100 L 144 100 M 54 124 L 146 124" stroke={HOWTO.gold} strokeWidth={10} strokeLinecap="round" /></>}
      {k === "shortRoute" && <><circle cx={50} cy={140} r={14} {...s} /><circle cx={150} cy={60} r={14} {...s} /><path d="M 62 132 Q 100 120 100 100 Q 100 76 138 68" {...s} strokeDasharray="14 14" /></>}
      {k === "warmup" && <><circle cx={100} cy={46} r={18} {...s} /><path d="M 100 64 L 100 120 M 100 80 L 50 60 M 100 80 L 150 60 M 100 120 L 70 168 M 100 120 L 130 168" {...s} /></>}
    </svg>
  );
};

/* ---------- «КАК НЕ БРОСИТЬ», вариант 1: тёмный фон, золотой заголовок, иконки по одной ---------- */
export const HowTo1: React.FC<{ f: number; title?: string; items: { icon: HowIcon; label: string; at: number; no?: boolean }[] }> = ({ f, title = "Как не бросить", items }) => (
  <AbsoluteFill style={{ background: HOWTO.bg }}>
    <div style={{ position: "absolute", top: 360, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: ap66(f, 0, 10) }}>
      <div style={{ ...OS, fontSize: 92, color: HOWTO.gold, letterSpacing: 4 }}>{title}</div>
    </div>
    <div style={{ position: "absolute", top: 640, left: 90, right: 90, display: "flex", flexWrap: "wrap", justifyContent: "center", rowGap: 110, columnGap: 80 }}>
      {items.map((it, i) => {
        const k = ap66(f, it.at, 8);
        return (
          <div key={i} style={{ width: 360, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, opacity: k, transform: `scale(${0.92 + 0.08 * k})` }}>
            <div style={{ position: "relative", width: 200, height: 200 }}>
              <HIcon k={it.icon} c={HOWTO.text} />
              {it.no && (
                <svg width={240} height={240} style={{ position: "absolute", left: -20, top: -20 }}>
                  <circle cx={120} cy={120} r={104} stroke={HOWTO.no} strokeWidth={14} fill="none" />
                  <line x1={48} y1={192} x2={192} y2={48} stroke={HOWTO.no} strokeWidth={14} strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div style={{ ...OS, fontSize: 52, color: HOWTO.text, letterSpacing: 3, textAlign: "center", width: 360 }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  </AbsoluteFill>
);

/* ---------- «КАК НЕ БРОСИТЬ», вариант 2: бумажная карточка, персонаж и плитки в золотой рамке ---------- */
export const HowTo2: React.FC<{ f: number; frame: number; title: string; items: { icon: HowIcon; label: string; at: number }[] }> = ({ f, frame, title, items }) => (
  <AbsoluteFill style={{ background: "#2A2724" }}>
    <div style={{ position: "absolute", top: 150, left: 120, right: 120, padding: "34px 40px 40px", background: "#E9DFC9", borderRadius: 16, opacity: ap66(f, 0, 10),
      display: "flex", flexDirection: "column", alignItems: "center", gap: 18, boxShadow: "0 12px 40px rgba(0,0,0,.4)" }}>
      <div style={{ ...OS, fontSize: 34, color: "#FFFFFF", background: HOWTO.no, padding: "8px 18px", borderRadius: 6, letterSpacing: 3 }}>Как не бросить</div>
      <div style={{ ...OS, fontSize: 110, color: "#292628", letterSpacing: 4 }}>{title}</div>
      <div style={{ width: 160, height: 6, background: HOWTO.no }} />
    </div>
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      <g transform="translate(250 1180) scale(1.6)"><Person pose={{ ...STAND, torso: 1 + Math.sin(frame / 18), face: { ...STAND.face, blink: frame % 80 < 3 ? 1 : 0 } }} o={ARTYOM_WINTER} /></g>
    </svg>
    <div style={{ position: "absolute", top: 640, left: 470, width: 540, display: "flex", flexDirection: "column", gap: 34 }}>
      {items.map((it, i) => {
        const k = ap66(f, it.at, 8);
        return (
          <div key={i} style={{ height: 150, display: "flex", alignItems: "center", gap: 26, padding: "0 26px", border: `3px solid ${HOWTO.gold}`, borderRadius: 22,
            background: "rgba(23,22,27,.6)", opacity: k, transform: `translateX(${r((1 - k) * 40)}px)` }}>
            <div style={{ width: 110, height: 110 }}><div style={{ transform: "scale(0.55)", transformOrigin: "0 0" }}><HIcon k={it.icon} c={HOWTO.text} /></div></div>
            <div style={{ ...OS, fontSize: 56, color: HOWTO.text, letterSpacing: 3 }}>{it.label}</div>
          </div>
        );
      })}
    </div>
  </AbsoluteFill>
);

/* ---------- вставка RITM: рука держит телефон с приложением ---------- */
export const RitmInsert: React.FC<{ f: number; frame: number; done: number; total?: number; nextPulse?: boolean; missAt?: number; counter?: [number, number, number] }> = ({
  f, frame, done, total = 21, missAt = -1, counter,
}) => {
  const ACC = "#FF2D55"; // акцент из приложения
  const shown = counter ? Math.round(interpolate(f, [counter[2], counter[2] + 14], [counter[0], counter[1]], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE66 })) : done;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {/* рука-варежка держит телефон снизу */}
        <g transform={`translate(0 ${r(140 + Math.sin(frame / 24) * 6)})`}>
          <rect x={300} y={330} width={480} height={940} rx={64} fill="#141416" />
          <rect x={322} y={352} width={436} height={896} rx={48} fill="#0A0A0B" />
          {/* ладонь-варежка держит телефон снизу, большой палец сбоку; рукав худи */}
          <path d="M 330 1500 L 750 1500 L 820 1920 L 260 1920 Z" fill="#B8582F" />
          <path d="M 330 1500 L 420 1500 L 400 1920 L 260 1920 Z" fill="#8F4224" />
          <path d="M 300 1290 Q 300 1180 540 1180 Q 780 1180 780 1290 L 760 1520 L 320 1520 Z" fill="#D9A786" />
          <ellipse cx={300} cy={1150} rx={46} ry={90} fill="#D9A786" transform="rotate(-12 300 1150)" />
        </g>
      </svg>
      {/* экран приложения: серия дней (без обещаний — только трекер) */}
      <div style={{ position: "absolute", left: 360, top: r(560 + Math.sin(frame / 24) * 6), width: 360 }}>
        <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 56, color: "#FFFFFF", letterSpacing: 4, lineHeight: 1 }}>RITM</div>
        <div style={{ marginTop: 26, fontFamily: "Inter Display", fontWeight: 800, fontSize: 34, color: "#B4B4BC", lineHeight: 1 }}>БЕГ · СЕРИЯ</div>
        <div style={{ marginTop: 14, fontFamily: "Inter Display", fontWeight: 900, fontSize: 120, color: ACC, lineHeight: 1 }}>{shown}</div>
        <div style={{ marginTop: 34, display: "grid", gridTemplateColumns: "repeat(5, 56px)", gap: 14 }}>
          {Array.from({ length: total }, (_, i) => {
            const isDone = i < done && i !== missAt;
            const isNext = i === done;
            const pulse = isNext ? 0.5 + 0.5 * Math.sin(frame / 6) : 0;
            return <div key={i} style={{ width: 56, height: 56, borderRadius: 12, background: isDone ? ACC : "#1C1C20", border: isNext ? `3px solid rgba(255,255,255,${0.4 + 0.6 * pulse})` : i === missAt ? "3px solid #3A3A40" : "3px solid transparent", opacity: ap66(f, i * 0.6, 6) }} />;
          })}
        </div>
      </div>
      {/* название и призыв */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, opacity: ap66(f, 10, 10) }}>
        <div style={{ ...OS, fontSize: 96, color: "#FFFFFF", letterSpacing: 8 }}>RITM</div>
        <div style={{ ...OS, fontSize: 52, color: "#F5C518", letterSpacing: 4 }}>Открой в Telegram</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- тетрадь в клетку крупно: маршрут красным пунктиром, рука с карандашом ---------- */
export const NotebookMap: React.FC<{ f: number; frame: number; drawAt: number; labels?: boolean; ticks?: { day: number; at: number }[] }> = ({ f, frame, drawAt, labels = true, ticks = [] }) => {
  const k = interpolate(f, [drawAt, drawAt + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE66 });
  const route = "M 260 1180 C 340 980 300 860 460 780 S 700 620 780 460";
  const pen = { x: 260 + (780 - 260) * k, y: 1180 + (460 - 1180) * k };
  return (
    <AbsoluteFill style={{ background: "#2A2724" }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform="rotate(-3 540 900)">
          <rect x={110} y={220} width={860} height={1260} rx={12} fill="#E9E4D6" />
          {Array.from({ length: 34 }, (_, i) => <line key={`h${i}`} x1={110} x2={970} y1={220 + i * 38} y2={220 + i * 38} stroke="#B8C3CC" strokeWidth={1.6} />)}
          {Array.from({ length: 23 }, (_, i) => <line key={`v${i}`} x1={110 + i * 38} x2={110 + i * 38} y1={220} y2={1480} stroke="#B8C3CC" strokeWidth={1.6} />)}
          {/* река и мост условными линиями */}
          <path d="M 560 220 C 640 500 720 640 970 700" stroke="#6F8CA0" strokeWidth={6} fill="none" opacity={0.7} />
          <rect x={746} y={440} width={70} height={18} fill="#3B2D28" transform="rotate(-30 780 450)" />
          <rect x={232} y={1180} width={56} height={46} fill="#3B2D28" /><path d="M 224 1180 L 260 1150 L 296 1180 Z" fill="#3B2D28" />
          <path d={route} stroke="#B93F3B" strokeWidth={7} fill="none" strokeDasharray="20 16" pathLength={1000} strokeDashoffset={0} style={{ clipPath: `inset(${r((1 - k) * 100)}% 0 0 0)` }} />
          {ticks.map((t, i) => {
            const kk = ap66(f, t.at, 6);
            const x = 170 + (i % 6) * 76, y = 1350;
            return <g key={i} opacity={kk}><rect x={x} y={y} width={60} height={60} fill="none" stroke="#3B2D28" strokeWidth={3} /><path d={`M ${x + 12} ${y + 32} l 12 12 l 26 -30`} stroke="#3B2D28" strokeWidth={6} fill="none" strokeLinecap="round" /></g>;
          })}
        </g>
        {/* рука с карандашом ведёт по маршруту */}
        {k > 0 && k < 1 && (
          <g transform={`translate(${r(pen.x)} ${r(pen.y)})`}>
            <path d="M 0 0 L 70 90" stroke="#C0A16C" strokeWidth={14} strokeLinecap="round" />
            <path d="M 0 0 L 10 14" stroke="#292628" strokeWidth={8} strokeLinecap="round" />
            <ellipse cx={90} cy={116} rx={46} ry={40} fill="#D9A786" />
            <rect x={96} y={130} width={160} height={90} rx={30} fill="#B8582F" transform="rotate(38 96 130)" />
          </g>
        )}
      </svg>
      {labels && (
        <>
          <div style={{ position: "absolute", left: 200, top: 1250, fontFamily: "Caveat", fontWeight: 700, fontSize: 64, color: "#292628", opacity: ap66(f, drawAt, 8), lineHeight: 1 }}>дом</div>
          <div style={{ position: "absolute", left: 800, top: 380, fontFamily: "Caveat", fontWeight: 700, fontSize: 64, color: "#292628", opacity: ap66(f, drawAt + 36, 8), lineHeight: 1 }}>мост</div>
          <div style={{ position: "absolute", left: 470, top: 860, fontFamily: "Caveat", fontWeight: 700, fontSize: 72, color: "#B93F3B", opacity: ap66(f, drawAt + 20, 8), lineHeight: 1, transform: "rotate(-8deg)" }}>2 км</div>
        </>
      )}
    </AbsoluteFill>
  );
};
