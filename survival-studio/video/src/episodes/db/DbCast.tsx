import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Figure, F_ANYA, F_ME, F_STRANGER } from "../../rig/Figure";
import { NEUTRAL } from "../../rig/Hero";
import { sitPose } from "../../scenes/Db";

/* Лист персонажей «40 дБ» для проверки рига Figure. */
export const DbCast: React.FC = () => {
  const frame = useCurrentFrame();
  const stand = { ...NEUTRAL, expr: { brow: 0.3, browTilt: 0.6, mouth: "flat" as const, blink: 0 } };
  return (
    <AbsoluteFill style={{ background: "#2A2F38" }}>
      <svg viewBox="0 0 1080 1920" width={1080} height={1920}>
        {frame < 30 ? <><g transform="translate(200 900) scale(2)"><Figure pose={stand} look={F_ME} frame={frame} /></g>
        <g transform="translate(520 900) scale(2)"><Figure pose={{ ...stand, expr: { brow: 0.8, browTilt: 1, mouth: "sad", blink: 0 } }} look={F_ANYA} frame={frame} /></g>
        <g transform="translate(850 900) scale(2)"><Figure pose={{ ...stand, holdL: "phone", phoneGlow: 0.6, armL: { sh: -50, el: -80, wr: 0 } }} look={F_STRANGER} frame={frame} /></g>
        <g transform="translate(160 1800) scale(1.7)"><Figure pose={sitPose(frame)} look={F_ME} frame={frame} /></g>
        <g transform="translate(470 1800) scale(1.7)"><Figure pose={sitPose(frame + 30, { expr: { brow: 1, browTilt: 1, mouth: "o", blink: 0 } })} look={F_ANYA} frame={frame} /></g>
        <g transform="translate(980 1760) rotate(-90) scale(1.7)"><Figure pose={{ ...NEUTRAL, expr: { brow: 0, browTilt: 0, mouth: "flat", blink: 1 } }} look={F_STRANGER} frame={frame} /></g>
        </> : <><g transform="translate(160 2400) scale(7)"><Figure pose={{ ...stand, expr: { brow: 0.6, browTilt: 1, mouth: "flat", blink: 0 } }} look={F_ME} frame={frame} /></g>
        <g transform="translate(560 2300) scale(8)"><Figure pose={{ ...stand, expr: { brow: 0.8, browTilt: 1, mouth: "sad", blink: 0 } }} look={F_ANYA} frame={frame} /></g>
        <g transform="translate(900 2400) scale(7)"><Figure pose={{ ...stand, expr: { brow: -0.2, browTilt: 0.3, mouth: "flat", blink: 0 } }} look={F_STRANGER} frame={frame} /></g>
      </>}</svg>
    </AbsoluteFill>
  );
};
