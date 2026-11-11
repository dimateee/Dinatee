import React from "react";
import { RIM } from "../style/palette";

/** Затемняет/осветляет HEX-цвет: k < 0 — темнее, k > 0 — светлее. */
export const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
};

/** Конечность-капсула с тонкой тёмной линией в тон. */
export const Capsule: React.FC<{
  x1?: number; y1?: number; x2?: number; y2: number; w: number; fill: string; line?: string;
}> = ({ x1 = 0, y1 = 0, x2 = 0, y2, w, fill, line }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={line ?? shade(fill, -0.45)} strokeWidth={w + 3.2} strokeLinecap="round" />
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={fill} strokeWidth={w} strokeLinecap="round" />
  </g>
);

/**
 * Фильтр контрового света: светлая полоса по краю силуэта со стороны side
 * (-1 — свет слева, +1 — справа). Подключается один раз на SVG.
 */
export const RimDefs: React.FC<{ id: string; side?: number; width?: number; strength?: number; color?: string }> = ({
  id, side = -1, width = 5, strength = 0.85, color = RIM,
}) => (
  <defs>
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
      <feOffset in="SourceAlpha" dx={-side * width} dy={width * 0.4} result="off" />
      <feComposite in="SourceAlpha" in2="off" operator="out" result="band" />
      <feGaussianBlur in="band" stdDeviation={0.9} result="bandSoft" />
      <feFlood floodColor={color} floodOpacity={strength} />
      <feComposite in2="bandSoft" operator="in" result="rim" />
      <feComposite in="rim" in2="SourceAlpha" operator="in" result="rimClip" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="rimClip" />
      </feMerge>
    </filter>
  </defs>
);

/** Мягкая тень на земле. */
export const GroundShadow: React.FC<{ x?: number; w: number; color?: string; opacity?: number }> = ({
  x = 0, w, color = "#3B3D24", opacity = 0.22,
}) => <ellipse cx={x} cy={2} rx={w / 2} ry={w * 0.09} fill={color} opacity={opacity} />;
