import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ARTYOM_AUTUMN, Person } from "../rig2/Person";
import { gait2, WALK2 } from "../rig2/gait2";
import { Collie, DOG_WALK2 } from "../rig2/Collie";
import { dogWalk } from "../rig/Dog";
import { YARD } from "./style";

// Циклы ходьбы человека и собаки: камера ведёт персонажа, по земле метки — видно, что стопы не скользят.
export const Cycles66: React.FC<{ who: "man" | "dog" }> = ({ who }) => {
  const f = useCurrentFrame();
  const p = who === "man" ? gait2(f, WALK2, { face: { blink: f % 70 < 3 ? 1 : 0 } }) : dogWalk(f, 0, true, DOG_WALK2);
  const S = 2;
  return (
    <AbsoluteFill style={{ background: YARD.sky }}>
      <svg width={1080} height={720}>
        <rect y={560} width={1080} height={160} fill={YARD.olive} />
        <g transform={`translate(${-((p.x * S) % 120)} 0)`}>{Array.from({ length: 11 }, (_, i) => <rect key={i} x={i * 120} y={566} width={50} height={8} rx={4} fill={YARD.shadow} opacity={0.5} />)}</g>
        <g transform={`translate(${540 - p.x * S} 560) scale(${S})`}>
          {who === "man" ? <Person pose={p as ReturnType<typeof gait2>} o={ARTYOM_AUTUMN} /> : <Collie pose={p as ReturnType<typeof dogWalk>} />}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
