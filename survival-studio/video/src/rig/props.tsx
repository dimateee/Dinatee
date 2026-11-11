import React from "react";
import { REGIME } from "../style/palette";
import { shade } from "./shared";

/* Реквизит серии. Начало — пол (y = 0), x — центр предмета. Без текста. */
const S = (c: string) => ({ fill: c, stroke: shade(c, -0.45), strokeWidth: 2, strokeLinejoin: "round" as const });
const WOOD = "#B98A5E", FABRIC = "#8A9A6B", SHEET = "#F6F2E7", METAL_MATTE = "#6E6A5E";

export const Chair: React.FC = () => (
  <g>
    <rect x={-30} y={-58} width={60} height={10} rx={4} {...S(WOOD)} />
    <rect x={-30} y={-150} width={10} height={100} rx={4} {...S(shade(WOOD, -0.1))} />
    <rect x={-26} y={-50} width={7} height={50} {...S(shade(WOOD, -0.15))} />
    <rect x={20} y={-50} width={7} height={50} {...S(shade(WOOD, -0.15))} />
  </g>
);

export const Desk: React.FC<{ lamp?: boolean; laptop?: boolean; laptopX?: number; w?: number }> = ({ lamp = true, laptop = true, laptopX = 20, w = 180 }) => (
  <g>
    <rect x={-w / 2} y={-122} width={w} height={12} rx={3} {...S(WOOD)} />
    <rect x={-w / 2 + 6} y={-110} width={10} height={110} {...S(shade(WOOD, -0.15))} />
    <rect x={w / 2 - 16} y={-110} width={10} height={110} {...S(shade(WOOD, -0.15))} />
    {laptop && (
      <g transform={`translate(${laptopX} -122)`}>
        <rect x={-34} y={-4} width={64} height={5} rx={2} {...S(METAL_MATTE)} />
        <path d="M 24 -4 L 34 -50 L -14 -50 L -24 -4 Z" {...S(shade(METAL_MATTE, -0.2))} />
      </g>
    )}
    {lamp && (
      <g transform="translate(-62 -122)">
        <rect x={-12} y={-5} width={24} height={5} rx={2} {...S(REGIME.olive)} />
        <path d="M 0 -5 L 8 -48 L 26 -58" stroke={REGIME.olive} strokeWidth={4} fill="none" strokeLinecap="round" />
        <path d="M 18 -66 L 38 -52 L 28 -44 Z" {...S(REGIME.dawn)} />
      </g>
    )}
  </g>
);

export const Bed: React.FC<{ w?: number }> = ({ w = 260 }) => (
  <g>
    <rect x={-w / 2} y={-70} width={w} height={44} rx={8} {...S(SHEET)} />
    <path d={`M ${-w / 2 + 40} -70 L ${w / 2} -70 L ${w / 2} -40 Q ${w / 4} -34 ${-w / 2 + 40} -44 Z`} {...S(REGIME.fog)} />
    <rect x={-w / 2 + 6} y={-90} width={56} height={22} rx={10} {...S("#FFFFFF")} />
    <rect x={-w / 2 - 12} y={-130} width={14} height={130} rx={4} {...S(WOOD)} />
    <rect x={-w / 2} y={-28} width={w} height={14} rx={3} {...S(shade(WOOD, -0.1))} />
    <rect x={-w / 2 + 4} y={-14} width={10} height={14} {...S(shade(WOOD, -0.2))} />
    <rect x={w / 2 - 14} y={-14} width={10} height={14} {...S(shade(WOOD, -0.2))} />
  </g>
);

export const Sofa: React.FC<{ w?: number }> = ({ w = 300 }) => (
  <g>
    <rect x={-w / 2} y={-130} width={w} height={70} rx={18} {...S(shade(FABRIC, -0.12))} />
    <rect x={-w / 2} y={-72} width={w} height={40} rx={10} {...S(FABRIC)} />
    <rect x={-w / 2 - 22} y={-100} width={36} height={72} rx={14} {...S(shade(FABRIC, -0.05))} />
    <rect x={w / 2 - 14} y={-100} width={36} height={72} rx={14} {...S(shade(FABRIC, -0.05))} />
    <rect x={-w / 2 + 8} y={-34} width={10} height={34} {...S(REGIME.olive)} />
    <rect x={w / 2 - 18} y={-34} width={10} height={34} {...S(REGIME.olive)} />
  </g>
);
