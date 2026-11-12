import React from "react";

/* Иконки HUD: 48×48, линия 3.5, без букв. */
const P = { fill: "none", strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export type IconName = "alarm" | "sneaker" | "phone" | "check" | "warn" | "paw" | "calendar" | "hourglass" | "dumbbell" | "book" | "lang" | "run";
export const Icon: React.FC<{ name: IconName; color: string; size?: number }> = ({ name, color, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: "block" }}>
    <g stroke={color} {...P}>
      {name === "alarm" && <><circle cx={24} cy={27} r={14} /><path d="M24 19v8l6 4M10 12l6-5M38 12l-6-5" /></>}
      {name === "sneaker" && <path d="M6 32v-12h8l4 6h8l14 4c3 1 3 6-1 6H6z M6 36h34" />}
      {name === "phone" && <><rect x={14} y={6} width={20} height={36} rx={4} /><path d="M21 36h6" /></>}
      {name === "check" && <><rect x={7} y={7} width={34} height={34} rx={6} /><path d="M15 25l6 6 12-14" /></>}
      {name === "warn" && <><path d="M24 7l19 33H5z" /><path d="M24 19v10M24 35v1" /></>}
      {name === "paw" && <><ellipse cx={24} cy={32} rx={9} ry={7} /><circle cx={13} cy={20} r={3.5} /><circle cx={20} cy={13} r={3.5} /><circle cx={28} cy={13} r={3.5} /><circle cx={35} cy={20} r={3.5} /></>}
      {name === "calendar" && <><rect x={7} y={10} width={34} height={31} rx={4} /><path d="M7 19h34M16 6v8M32 6v8" /></>}
      {name === "dumbbell" && <><path d="M8 24h32M12 16v16M36 16v16" /><rect x={4} y={19} width={4} height={10} rx={1} /><rect x={40} y={19} width={4} height={10} rx={1} /></>}
      {name === "book" && <><path d="M24 12c-5-4-12-4-17-2v28c5-2 12-2 17 2c5-4 12-4 17-2V10c-5-2-12-2-17 2zM24 12v28" /></>}
      {name === "lang" && <><circle cx={24} cy={24} r={17} /><path d="M7 24h34M24 7c6 6 6 28 0 34M24 7c-6 6-6 28 0 34" /></>}
      {name === "run" && <><circle cx={30} cy={9} r={4} /><path d="M18 22l8-6 6 6 6 2M26 16l-4 12 8 6v10M22 28l-8 6" /></>}
      {name === "hourglass" && <path d="M14 6h20M14 42h20M16 6c0 10 16 12 16 18S16 32 16 42M32 6c0 10-16 12-16 18s16 8 16 18" />}
    </g>
  </svg>
);
