import { AbsoluteFill } from "remotion";
import { ARTYOM_AUTUMN, ARTYOM_WINTER, NEIGHBOR, Person, STAND } from "../rig2/Person";
import { gait2, WALK2 } from "../rig2/gait2";
import { Collie, DOG_WALK2 } from "../rig2/Collie";
import { DOG_STAND, dogSit, dogWalk } from "../rig/Dog";

export const RigTest2: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#E1D4BD" }}>
    <svg viewBox="-60 -420 1600 900" width="100%" height="100%">
      {[0, 440].map((y) => <rect key={y} x={-60} y={y} width={1600} height={6} fill="#7F8275" opacity={0.5} />)}
      <Person pose={STAND} o={ARTYOM_AUTUMN} />
      <g transform="translate(150 0)"><Person pose={{ ...STAND, face: { ...STAND.face, mouth: "smile" } }} o={ARTYOM_WINTER} /></g>
      <g transform="translate(300 0)"><Person pose={STAND} o={NEIGHBOR} /></g>
      {[0, 6, 12, 18].map((f, i) => { const p = gait2(f, WALK2); return <g key={f} transform={`translate(${520 + i * 150 - p.x} 0)`}><Person pose={p} o={ARTYOM_AUTUMN} /></g>; })}
      <g transform="translate(1250 0) scale(-1 1)"><Person pose={gait2(8, WALK2, { holdN: "bucket" })} o={ARTYOM_AUTUMN} /></g>
      <g transform="translate(80 440)"><Collie pose={DOG_STAND} /></g>
      {[0, 6, 12, 18].map((f, i) => { const p = dogWalk(f, 0, true, DOG_WALK2); return <g key={f} transform={`translate(${320 + i * 190 - p.x} 440)`}><Collie pose={p} /></g>; })}
      <g transform="translate(1150 440)"><Collie pose={dogSit(0)} /></g>
    </svg>
  </AbsoluteFill>
);
