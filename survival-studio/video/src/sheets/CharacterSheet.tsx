import { AbsoluteFill } from "remotion";
import { Hero, NEUTRAL } from "../rig/Hero";
import { HeroFrontal } from "../rig/HeroViews";
import { Dog, DOG_STAND, dogLie, dogSit } from "../rig/Dog";
import { POSES } from "../rig/poses";
import { Bed, Chair, Desk, Sofa } from "../rig/props";
import { GroundShadow, RimDefs } from "../rig/shared";
import { REGIME } from "../style/palette";
import { useFonts } from "../useFonts";

const Label: React.FC<{ x: number; y: number; children: string }> = ({ x, y, children }) => (
  <div style={{
    position: "absolute", left: x - 105, top: y, width: 210, textAlign: "center",
    fontFamily: "JetBrains Mono", fontWeight: 700, fontSize: 20, lineHeight: 1.25, color: REGIME.olive, textTransform: "uppercase",
  }}>{children}</div>
);

// Лист 2400×1500: верх — разворот героя и собака, низ — 8 поз.
export const CharacterSheet: React.FC = () => {
  useFonts();
  const top = [
    { x: 160, el: <HeroFrontal rimFilter="rim" />, l: "анфас" },
    { x: 440, el: <HeroFrontal turn={1} rimFilter="rim" expr={{ ...NEUTRAL.expr, mouth: "smile" }} />, l: "3/4" },
    { x: 720, el: <Hero pose={NEUTRAL} rimFilter="rim" />, l: "профиль" },
    { x: 1000, el: <Hero pose={NEUTRAL} outfit="sport" rimFilter="rim" />, l: "профиль · спорт" },
    { x: 1400, el: <Dog pose={DOG_STAND} rimFilter="rim" />, l: "Луна · профиль" },
    { x: 1760, el: <Dog pose={dogSit(0)} rimFilter="rim" />, l: "Луна · ждёт у двери" },
    { x: 2120, el: <Dog pose={dogLie(0)} rimFilter="rim" />, l: "Луна · лежит" },
  ];
  const P = POSES;
  const bottom: { k: keyof typeof P; x: number; prop?: React.ReactNode; dx?: number; dy?: number }[] = [
    { k: "sitDesk", x: 120, prop: <><g transform="translate(-14 0)"><Chair /></g><g transform="translate(165 0)"><Desk lamp={false} laptopX={-30} w={150} /></g></> },
    { k: "getUp", x: 545, prop: <g transform="translate(-90 0)"><Bed w={180} /></g> },
    { k: "phone", x: 820 }, { k: "watch", x: 1040 }, { k: "tick", x: 1260 },
    { k: "laces", x: 1480 },
    { k: "sofa", x: 1880, prop: <g transform="translate(-20 0)"><Sofa w={350} /></g>, dx: 60, dy: -86 },
    { k: "run", x: 2250 },
  ];
  const GY1 = 640, GY2 = 1360;
  return (
    <AbsoluteFill style={{ backgroundColor: REGIME.paper }}>
      <svg viewBox="0 0 2400 1500" width={2400} height={1500} style={{ position: "absolute" }}>
        <RimDefs id="rim" side={-1} />
        {[GY1, GY2].map((y) => <line key={y} x1={40} x2={2360} y1={y} y2={y} stroke={REGIME.olive} strokeWidth={2} opacity={0.25} />)}
        <line x1={1220} x2={1220} y1={180} y2={GY1} stroke={REGIME.olive} strokeWidth={2} opacity={0.15} />
        {top.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${GY1})`}><GroundShadow w={i < 4 ? 110 : 150} />{t.el}</g>
        ))}
        {bottom.map((b) => {
          const d = P[b.k];
          return (
            <g key={b.k} transform={`translate(${b.x} ${GY2})`}>
              <GroundShadow w={130} />
              {b.prop}
              <g transform={`translate(${b.dx ?? 0} ${b.dy ?? 0}) rotate(${d.rotate ?? 0})`}>
                <Hero pose={d.pose} outfit={d.outfit} rimFilter="rim" />
              </g>
            </g>
          );
        })}
      </svg>
      {top.map((t, i) => <Label key={i} x={t.x} y={GY1 + 30}>{t.l}</Label>)}
      {bottom.map((b) => <Label key={b.k} x={b.x} y={GY2 + 30}>{P[b.k].label}</Label>)}
    </AbsoluteFill>
  );
};
