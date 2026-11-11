import { AbsoluteFill } from "remotion";
import { Hero, NEUTRAL } from "../rig/Hero";
import { Dog, DOG_STAND, dogLie, dogSit, dogWalk } from "../rig/Dog";
import { heroGait, RUN, WALK } from "../rig/gait";
import { GroundShadow, RimDefs } from "../rig/shared";
import { REGIME } from "../style/palette";

export const RigTest: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: REGIME.paper }}>
    <svg viewBox="-60 -420 1500 900" width="100%" height="100%">
      <RimDefs id="rim" side={-1} />
      {[0, 440].map((gy) => <line key={gy} x1={-60} x2={1440} y1={gy} y2={gy} stroke={REGIME.olive} strokeWidth={2} opacity={0.3} />)}
      <g><GroundShadow w={110} /><Hero pose={NEUTRAL} rimFilter="rim" /></g>
      {[0, 6, 12, 18].map((f, i) => {
        const p = heroGait(f, WALK); return <g key={f} transform={`translate(${220 + i * 150 - p.x} 0)`}><Hero pose={p} rimFilter="rim" /></g>;
      })}
      {[0, 4, 8, 12].map((f, i) => {
        const p = heroGait(f, RUN); return <g key={f} transform={`translate(${860 + i * 150 - p.x} 0)`}><Hero pose={p} outfit="sport" rimFilter="rim" /></g>;
      })}
      <g transform="translate(80 440)"><Dog pose={DOG_STAND} rimFilter="rim" /></g>
      {[0, 6, 12, 18].map((f, i) => {
        const p = dogWalk(f); return <g key={f} transform={`translate(${300 + i * 190 - p.x} 440)`}><Dog pose={p} rimFilter="rim" /></g>;
      })}
      <g transform="translate(1100 440)"><Dog pose={dogSit(0)} rimFilter="rim" /></g>
      <g transform="translate(1320 440)"><Dog pose={dogLie(0)} rimFilter="rim" /></g>
    </svg>
  </AbsoluteFill>
);
