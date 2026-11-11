import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Hero } from "../rig/Hero";
import { Dog, dogWalk } from "../rig/Dog";
import { heroGait, RUN, WALK } from "../rig/gait";
import { GroundShadow, RimDefs } from "../rig/shared";
import { REGIME } from "../style/palette";

export type CycleKind = "heroWalk" | "heroRun" | "dogWalk";

// Камера следует за персонажем, земля размечена — видно, что стопы не скользят.
export const CycleTest: React.FC<{ kind: CycleKind }> = ({ kind }) => {
  const frame = useCurrentFrame();
  const hero = kind === "dogWalk" ? null : heroGait(frame, kind === "heroRun" ? RUN : WALK, { expr: { mouth: "flat", brow: 0, browTilt: kind === "heroRun" ? -0.3 : 0, blink: frame % 90 < 4 ? 1 : 0 } });
  const dog = kind === "dogWalk" ? dogWalk(frame) : null;
  const camX = hero ? hero.x : dog!.x;
  return (
    <AbsoluteFill style={{ backgroundColor: REGIME.paper }}>
      <svg viewBox="-540 -470 1080 600" width="100%" height="100%">
        <RimDefs id="rim" side={-1} />
        <rect x={-540} y={0} width={1080} height={130} fill={REGIME.sage} opacity={0.35} />
        <g transform={`translate(${-camX} 0)`}>
          {Array.from({ length: 60 }, (_, i) => i * 60 - 600).map((x) => (
            <rect key={x} x={x} y={4} width={24} height={6} rx={3} fill={REGIME.olive} opacity={0.35} />
          ))}
          {hero && <><GroundShadow x={hero.x} w={110} /><Hero pose={hero} outfit={kind === "heroRun" ? "sport" : "casual"} rimFilter="rim" /></>}
          {dog && <><GroundShadow x={dog.x} w={150} /><Dog pose={dog} rimFilter="rim" /></>}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
