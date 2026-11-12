import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

/**
 * Общий «плёночный» слой поверх всего эпизода (не внутри ассетов):
 * размытие краёв (заранее размытая копия кадра под радиальной маской), виньетка 45–60% в углах,
 * лёгкое зерно и едва заметная бумажная фактура. Камера/сцены — в children.
 */
export const Film: React.FC<{ children: React.ReactNode; vignette?: number; paper?: number }> = ({ children, vignette = 0.55, paper = 0.03 }) => {
  const f = useCurrentFrame();
  const seed = Math.floor(f / 2) % 89;
  const mask = "radial-gradient(ellipse 62% 55% at 50% 48%, transparent 58%, black 100%)";
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill>{children}</AbsoluteFill>
      {/* размытие краёв: копия кадра, размытая заранее, видна только у краёв */}
      <AbsoluteFill style={{ filter: "blur(7px)", WebkitMaskImage: mask, maskImage: mask }}>{children}</AbsoluteFill>
      {/* виньетка */}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 65% at 50% 46%, rgba(0,0,0,0) 45%, rgba(10,8,8,${vignette}) 100%)` }} />
      {/* бумажная фактура (статичная) и зерно (сид меняется на двойках) */}
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: paper * 6 }}>
        <filter id="paper66"><feTurbulence type="fractalNoise" baseFrequency={0.035} numOctaves={3} seed={7} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#paper66)" />
      </svg>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity: 0.08 }}>
        <filter id={`grain66_${seed}`}><feTurbulence type="fractalNoise" baseFrequency={0.85} numOctaves={2} seed={seed} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter={`url(#grain66_${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
