import React from "react";
import { useCurrentFrame } from "remotion";

/** Лёгкое плёночное зерно 2–3%: сид меняется каждые 2 кадра (детерминированно). */
export const Grain: React.FC<{ opacity?: number; w?: number; h?: number }> = ({ opacity = 0.025, w = 1080, h = 1920 }) => {
  const seed = Math.floor(useCurrentFrame() / 2) % 97;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", opacity: opacity * 5, mixBlendMode: "overlay" }}>
      <filter id={`grain${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} seed={seed} />
        <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 1" />
      </filter>
      <rect width={w} height={h} filter={`url(#grain${seed})`} />
    </svg>
  );
};
