import React from "react";
import { shade } from "../rig/shared";
import { Face, Outfit, P, STAND_Y } from "./Person";

/** Анфас (turn 0) и 3/4 (turn 1) для рига серии. Пропорции как у профиля. Начало — земля под ногами. */
export const Frontal2: React.FC<{ o: Outfit; turn?: number; face?: Face }> = ({ o, turn = 0, face = { brow: 0, tilt: 0, mouth: "line", blink: 0 } }) => {
  const k = turn, fx = 12 * k, R = P.headR, W = P.torsoW + 14 - 6 * k;
  const legLen = P.thigh + P.shin;
  const lid = Math.max(0.12, 1 - face.blink);
  return (
    <g transform={`translate(0 ${STAND_Y})`}>
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${s * (10 - 2 * k) + 2 * k} 0)`}>
          <line x1={0} y1={0} x2={0} y2={legLen} stroke={k && s < 0 ? shade(o.pants, -0.2) : o.pants} strokeWidth={P.limb + 2} strokeLinecap="round" />
          <ellipse cx={4 * k} cy={legLen + 6} rx={11 + 4 * k} ry={6} fill={o.shoes} />
        </g>
      ))}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${s * (W / 2 + 4)} ${-P.torsoH + 14}) rotate(${-s * 6})`}>
          <line x1={0} y1={0} x2={0} y2={P.upper + P.fore - 4} stroke={k && s < 0 ? o.topShade : o.top} strokeWidth={P.limb} strokeLinecap="round" />
          {s > 0 && o.detail && <rect x={-9} y={P.upper + P.fore - 12} width={18} height={6} rx={2} fill={o.detail} />}
          <ellipse cy={P.upper + P.fore + 2} rx={P.mitten} ry={P.mitten * 1.1} fill={o.skin} />
        </g>
      ))}
      <rect x={-W / 2} y={-P.torsoH} width={W} height={P.torsoH + 8} rx={12} fill={o.top} />
      <rect x={-W / 2} y={-P.torsoH} width={W * 0.28} height={P.torsoH + 8} rx={10} fill={o.topShade} />
      <g transform={`translate(${4 * k} ${P.neck.y + P.headC.y})`}>
        <circle r={R} fill={o.skin} />
        <path d={`M ${-R * 0.4} ${-R * 0.92} A ${R} ${R} 0 0 0 ${-R * 0.4} ${R * 0.92} Q ${-R} 0 ${-R * 0.4} ${-R * 0.92}`} fill={shade(o.skin, -0.12)} />
        {o.beard && <path d={`M ${-20 + fx} 12 Q ${fx} ${R + 10} ${20 + fx} 12 Q ${fx} 20 ${-20 + fx} 12 Z`} fill={o.beard} />}
        <ellipse cx={fx + 10 - 2 * k} cy={-2} rx={2.8} ry={3.4 * lid} fill="#292628" />
        <ellipse cx={fx - 10 + 3 * k} cy={-2} rx={2.8 * (1 - 0.2 * k)} ry={3.4 * lid} fill="#292628" />
        <path d={`M ${fx + 4} -10 L ${fx + 15} ${-10 - face.tilt * 2} M ${fx - 4} -10 L ${fx - 15 + 3 * k} ${-10 - face.tilt * 2}`} stroke="#292628" strokeWidth={3} strokeLinecap="round" />
        {face.mouth === "smile" ? <path d={`M ${fx - 6} 13 Q ${fx} 18 ${fx + 6} 13`} stroke="#292628" strokeWidth={2.6} fill="none" strokeLinecap="round" />
          : <path d={`M ${fx - 5} 14 L ${fx + 5} 14`} stroke="#292628" strokeWidth={2.6} strokeLinecap="round" />}
        {o.hat === "cap" && <>
          <path d={`M ${-R} -4 Q ${-R} ${-R - 4} 0 ${-R - 4} Q ${R} ${-R - 4} ${R} -4 Z`} fill={o.hatColor} />
          <path d={`M ${-22 + 10 * k} -6 Q ${fx + 4 * k} 2 ${22 + 14 * k} -6 Q ${fx} -12 ${-22 + 10 * k} -6 Z`} fill={shade(o.hatColor, -0.25)} />
        </>}
        {o.hat === "knit" && <>
          <path d={`M ${-R - 1} -2 Q ${-R} ${-R - 10} 0 ${-R - 12} Q ${R} ${-R - 10} ${R + 1} -2 Z`} fill={o.hatColor} />
          <rect x={-R - 2} y={-9} width={2 * R + 4} height={9} rx={4} fill={shade(o.hatColor, -0.18)} />
          <circle cy={-R - 14} r={7} fill={shade(o.hatColor, 0.15)} />
        </>}
      </g>
    </g>
  );
};
