import React from "react";
import { Icon, IconName } from "./Icons";

export const HUD_COLORS = { good: "#3DDC84", resource: "#F5C518", bad: "#E53935" } as const;
export type HudKind = keyof typeof HUD_COLORS;

/**
 * Единственный компонент плашек: иконка + заголовок капсом + подпись.
 * flex, центр по обеим осям, line-height 1; координаты округляются до целых px.
 */
export const Plate: React.FC<{
  x: number; y: number; kind: HudKind; icon?: IconName; title: string; sub?: string;
  opacity?: number; scale?: number; dark?: boolean;
}> = ({ x, y, kind, icon, title, sub, opacity = 1, scale = 1, dark = true }) => {
  const c = HUD_COLORS[kind];
  return (
    <div style={{
      position: "absolute", left: Math.round(x), top: Math.round(y), opacity,
      transform: `scale(${scale})`, transformOrigin: "0 50%",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 18,
      padding: "18px 26px", borderRadius: 18,
      background: dark ? "rgba(14,17,24,0.82)" : "rgba(246,242,231,0.92)",
      border: `3px solid ${c}`, boxShadow: `0 0 18px ${c}55, inset 0 0 10px ${c}22`,
    }}>
      {icon && <Icon name={icon} color={c} size={56} />}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 10 }}>
        <div style={{ fontFamily: "Inter Display", fontWeight: 900, fontSize: 44, lineHeight: 1, color: dark ? "#FFFFFF" : "#3B3D24", textTransform: "uppercase", letterSpacing: 1 }}>{title}</div>
        {sub && <div style={{ fontFamily: "JetBrains Mono", fontWeight: 400, fontSize: 34, lineHeight: 1, color: dark ? "#C9D2E0" : "#3B3D24" }}>{sub}</div>}
      </div>
    </div>
  );
};

/** Пунктирная выноска от плашки к объекту (координаты кадра). */
export const Leader: React.FC<{ from: [number, number]; to: [number, number]; kind: HudKind; progress?: number }> = ({ from, to, kind, progress = 1 }) => {
  const [x1, y1] = from.map(Math.round), [x2, y2] = to.map(Math.round);
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * progress} y2={y1 + (y2 - y1) * progress}
        stroke={HUD_COLORS[kind]} strokeWidth={3} strokeDasharray="10 9" strokeLinecap="round" opacity={0.95} />
      {progress >= 1 && <circle cx={x2} cy={y2} r={7} fill={HUD_COLORS[kind]} />}
    </svg>
  );
};

/** Служебная надпись: «ДЕНЬ 1 — 06:30». */
export const ServiceLabel: React.FC<{ x: number; y: number; text: string; color?: string; bg?: string }> = ({
  x, y, text, color = "#FFFFFF", bg = "rgba(14,17,24,0.72)",
}) => (
  <div style={{
    position: "absolute", left: Math.round(x), top: Math.round(y), display: "flex", alignItems: "center", justifyContent: "center",
    padding: "14px 22px", borderRadius: 12, background: bg,
    fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 46, lineHeight: 1, color, letterSpacing: 2,
  }}>{text}</div>
);
