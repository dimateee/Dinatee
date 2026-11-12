import React from "react";

/* Иконки HUD: 48×48, линия 3.5, без букв. */
const P = { fill: "none", strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
export type IconName = "alarm" | "sneaker" | "phone" | "check" | "warn" | "paw" | "calendar" | "hourglass" | "dumbbell" | "book" | "lang" | "run"
  | "siren" | "radio" | "tv" | "eye" | "car" | "house" | "bag" | "shirt" | "soap" | "bottle" | "door" | "stairs";
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
      {name === "siren" && <><path d="M14 30a10 10 0 0 1 20 0v6H14z M10 40h28M24 12v4M10 18l3 3M38 18l-3 3" /></>}
      {name === "radio" && <><rect x={6} y={16} width={36} height={24} rx={4} /><circle cx={16} cy={28} r={6} /><path d="M28 24h8M28 30h8M12 16l20-9" /></>}
      {name === "tv" && <><rect x={6} y={10} width={36} height={26} rx={3} /><path d="M18 42h12M24 36v6" /></>}
      {name === "eye" && <><path d="M4 24c6-10 14-14 20-14s14 4 20 14c-6 10-14 14-20 14S10 34 4 24z" /><circle cx={24} cy={24} r={6} /><path d="M8 40L40 8" /></>}
      {name === "car" && <><path d="M6 32v-6l5-9h22l7 9h2v6z" /><circle cx={14} cy={33} r={4} /><circle cx={35} cy={33} r={4} /><path d="M14 18l-2 8h26l-5-8" /></>}
      {name === "house" && <><path d="M8 42V18h32v24z M8 18l16-12 16 12" /><path d="M14 24h6v6h-6zM28 24h6v6h-6zM20 42v-8h8v8" /></>}
      {name === "bag" && <><path d="M10 16h28l-3 26H13z" /><path d="M18 16c0-6 12-6 12 0" /></>}
      {name === "shirt" && <path d="M16 8l-10 6 4 9 5-3v20h18V20l5 3 4-9-10-6c-2 4-14 4-16 0z" />}
      {name === "soap" && <><rect x={8} y={20} width={32} height={18} rx={8} /><circle cx={16} cy={12} r={3} /><circle cx={26} cy={9} r={2.5} /><circle cx={34} cy={13} r={2} /></>}
      {name === "bottle" && <><path d="M19 6h10v8l5 6v22H14V20l5-6z" /><path d="M14 26h20" /></>}
      {name === "door" && <><path d="M12 42V6h22v36" /><path d="M6 42h36M28 24v2" /></>}
      {name === "stairs" && <path d="M6 42h10v-9h9v-9h9v-9h9" />}
      {name === "hourglass" && <path d="M14 6h20M14 42h20M16 6c0 10 16 12 16 18S16 32 16 42M32 6c0 10-16 12-16 18s16 8 16 18" />}
    </g>
  </svg>
);
