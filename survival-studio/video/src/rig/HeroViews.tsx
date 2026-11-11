import React from "react";
import { HERO } from "../style/palette";
import { DIM, Expr } from "./Hero";
import { Capsule, shade } from "./shared";

/**
 * Артём анфас (turn = 0) и в 3/4 (turn = 1). Пропорции совпадают с ригом в профиль.
 * Начало — центр таза, y вниз.
 */
export const HeroFrontal: React.FC<{
  turn?: number; expr?: Expr; outfit?: "casual" | "sport"; rimFilter?: string;
  armL?: number; armR?: number; // разворот рук от корпуса, градусы
}> = ({ turn = 0, expr = { brow: 0, browTilt: 0, mouth: "flat", blink: 0 }, outfit = "casual", rimFilter, armL = 6, armR = 6 }) => {
  const k = turn; // 0..1
  const faceX = 18 * k; // смещение лица к зрителю
  const bodyW = 34 - 6 * k;
  const cloth = outfit === "sport" ? HERO.tee : HERO.hoodie;
  const legC = outfit === "sport" ? HERO.joggers : HERO.jeans;
  const shoe = outfit === "sport" ? HERO.sneakers : HERO.boots;
  const R = DIM.headR;
  const headY = DIM.neck.y + DIM.headC.y;
  const lid = Math.max(0.12, 1 - expr.blink);
  const eyeL = { x: faceX + 18 - 4 * k, r: 1 }, eyeR = { x: faceX - 18 + 6 * k, r: 1 - 0.18 * k };
  const browY = -20 - expr.brow * 5;
  const legX = 15 - 2 * k;
  const ankleY = DIM.thigh + DIM.shin;
  return (
    <g transform={`translate(0 ${-(DIM.thigh + DIM.shin + DIM.ankleH) + 3})`} filter={rimFilter ? `url(#${rimFilter})` : undefined}>
      {/* ноги */}
      {[-1, 1].map((s) => {
        const far = k > 0 && s < 0;
        const c = far ? shade(legC, -0.15) : legC;
        return (
          <g key={s} transform={`translate(${s * legX + 3 * k} 0)`}>
            <Capsule y2={ankleY - 4} w={28} fill={c} />
            <path d={`M -14 ${ankleY - 10} Q -16 ${ankleY + 6} -12 ${ankleY + 9} L ${14 + 8 * k} ${ankleY + 9} Q ${18 + 8 * k} ${ankleY + 4} 14 ${ankleY - 10} Z`}
              fill={far ? shade(shoe, -0.15) : shoe} stroke={shade(shoe, -0.5)} strokeWidth={1.6} />
            <rect x={-13} y={ankleY + 8} width={27 + 8 * k} height={4} rx={2} fill={outfit === "sport" ? HERO.sneakerAccent : HERO.sole} />
          </g>
        );
      })}
      {/* руки (за корпусом, если отведены) */}
      {[[-1, armR], [1, armL]].map(([s, a]) => {
        const sideX = s * (bodyW + 6) + (s > 0 ? 0 : 4 * k);
        const far = k > 0 && s < 0;
        const c = far ? shade(cloth, -0.18) : cloth;
        return (
          <g key={s} transform={`translate(${sideX} ${DIM.shoulder.y + 6}) rotate(${-s * a})`}>
            <Capsule y2={DIM.upperArm} w={21} fill={c} />
            <g transform={`translate(0 ${DIM.upperArm})`}>
              <Capsule y2={DIM.foreArm} w={outfit === "sport" ? 16 : 19} fill={outfit === "sport" ? HERO.skin : c} />
              <g transform={`translate(0 ${DIM.foreArm})`}>
                {s > 0 && <rect x={-9} y={-6} width={18} height={6} rx={2.5} fill={HERO.band} stroke={shade(HERO.band, -0.45)} strokeWidth={1.2} />}
                <circle cy={5} r={DIM.handR} fill={far ? HERO.skinShade : HERO.skin} stroke={shade(HERO.skin, -0.45)} strokeWidth={1.6} />
              </g>
            </g>
          </g>
        );
      })}
      {/* корпус */}
      <path d={`M ${-bodyW - 2} 6 Q ${-bodyW - 6} -40 ${-bodyW} -80 Q ${-bodyW + 6} -96 0 -97 Q ${bodyW - 6} -96 ${bodyW} -80 Q ${bodyW + 6} -40 ${bodyW + 2} 6 Q 0 14 ${-bodyW - 2} 6 Z`}
        fill={cloth} stroke={shade(cloth, -0.5)} strokeWidth={2} strokeLinejoin="round" />
      <path d={`M ${-bodyW - 2} 6 Q ${-bodyW - 6} -40 ${-bodyW} -80 Q ${-bodyW + 4} -92 ${-bodyW + 12} -94 Q ${-bodyW + 2} -40 ${-bodyW + 8} 9 Z`} fill={shade(cloth, -0.25)} opacity={0.5} />
      {outfit === "casual" ? (
        <>
          <path d={`M ${-20 + 8 * k} -30 L ${20 + 8 * k} -30 L ${24 + 8 * k} -4 L ${-24 + 8 * k} -4 Z`} fill={shade(cloth, -0.12)} stroke={shade(cloth, -0.45)} strokeWidth={1.4} />
          <path d={`M ${-7 + 10 * k} -90 L ${-8 + 10 * k} -64 M ${7 + 10 * k} -90 L ${8 + 10 * k} -64`} stroke="#EDE6D6" strokeWidth={2} strokeLinecap="round" />
          <path d={`M ${-bodyW - 2} 0 Q 0 8 ${bodyW + 2} 0 L ${bodyW + 2} 6 Q 0 14 ${-bodyW - 2} 6 Z`} fill={HERO.hoodieShade} />
          <path d={`M ${-22 + 8 * k} -96 Q ${8 * k} -84 ${22 + 8 * k} -96`} stroke={shade(cloth, -0.4)} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <path d={`M ${-12 + 8 * k} -96 Q ${8 * k} -86 ${12 + 8 * k} -96`} stroke={shade(cloth, -0.4)} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      )}
      {/* голова */}
      <g transform={`translate(${DIM.neck.x * k} ${headY})`}>
        {/* уши */}
        {k < 0.5 && <ellipse cx={R - 2} cy={6} rx={8} ry={12} fill={HERO.skinShade} stroke={shade(HERO.skin, -0.45)} strokeWidth={1.6} />}
        <ellipse cx={-R + 2 + 10 * k} cy={6} rx={8} ry={12} fill={HERO.skinShade} stroke={shade(HERO.skin, -0.45)} strokeWidth={1.6} />
        <circle r={R} fill={HERO.skin} stroke={shade(HERO.skin, -0.45)} strokeWidth={2} />
        <path d={`M ${-R * 0.35} ${-R * 0.94} A ${R} ${R} 0 0 0 ${-R * 0.35} ${R * 0.94} Q ${-R * 0.95} 0 ${-R * 0.35} ${-R * 0.94}`} fill={HERO.skinShade} opacity={0.3} />
        {/* щетина по линии челюсти */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI * (0.18 + 0.64 * (i / 10));
          return <circle key={i} cx={faxX(faceX, Math.cos(a) * 34)} cy={20 + Math.sin(a) * 16} r={1.4} fill={HERO.stubble} opacity={0.75} />;
        })}
        {/* глаза, брови, рот */}
        <ellipse cx={eyeL.x} cy={-4} rx={4.2 * eyeL.r} ry={5.2 * lid * eyeL.r} fill={HERO.line} />
        <ellipse cx={eyeR.x} cy={-4} rx={4.2 * eyeR.r} ry={5.2 * lid * eyeR.r} fill={HERO.line} />
        <path d={`M ${eyeL.x - 8} ${browY + expr.browTilt * 3} L ${eyeL.x + 8} ${browY - expr.browTilt * 1}`} stroke={HERO.line} strokeWidth={4} strokeLinecap="round" />
        <path d={`M ${eyeR.x - 8 * eyeR.r} ${browY - expr.browTilt * 1} L ${eyeR.x + 8 * eyeR.r} ${browY + expr.browTilt * 3}`} stroke={HERO.line} strokeWidth={4} strokeLinecap="round" />
        {expr.mouth === "smile"
          ? <path d={`M ${faceX - 8} 22 Q ${faceX} 29 ${faceX + 9} 22`} stroke={HERO.line} strokeWidth={3} fill="none" strokeLinecap="round" />
          : <path d={`M ${faceX - 7} 24 L ${faceX + 7} 24`} stroke={HERO.line} strokeWidth={3} strokeLinecap="round" />}
        {/* кепка */}
        <path d={`M ${-R - 1} -8 Q ${-R} ${-R - 6} 0 ${-R - 6} Q ${R} ${-R - 6} ${R + 1} -8 Q 0 -18 ${-R - 1} -8 Z`}
          fill={HERO.cap} stroke={shade(HERO.cap, -0.5)} strokeWidth={2} strokeLinejoin="round" />
        <path d={`M ${-38 + 26 * k} -14 Q ${faceX + 10 * k} ${-4 + 2 * k} ${38 + 22 * k} -14 Q ${faceX + 6 * k} -24 ${-38 + 26 * k} -14 Z`} fill={HERO.capBrim} />
        <circle cx={-4 * k} cy={-R - 5} r={4} fill="#E8833A" />
      </g>
    </g>
  );
};

const faxX = (faceX: number, dx: number) => faceX + dx;
