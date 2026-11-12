import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ARTYOM_AUTUMN, ARTYOM_WINTER, NEIGHBOR, Person, STAND } from "../rig2/Person";
import { Frontal2 } from "../rig2/Frontal2";
import { POSES2 } from "../rig2/poses2";
import { gait2, WALK2 } from "../rig2/gait2";
import { Collie, DOG_WALK2 } from "../rig2/Collie";
import { DOG_STAND, dogLie, dogSit, dogWalk, dogLife } from "../rig/Dog";
import { Film } from "./Film";
import { G, Interior, Yard } from "./Scenes";
import { ChapterTitle, HowTo1, HowTo2, NotebookMap, RitmInsert, SeriesTitle } from "./Inserts";
import { useFonts } from "../useFonts";
import { YARD } from "./style";

const Lbl: React.FC<{ x: number; y: number; t: string }> = ({ x, y, t }) => (
  <div style={{ position: "absolute", left: x - 140, top: y, width: 280, textAlign: "center", fontFamily: "Oswald", fontWeight: 600, fontSize: 30, color: YARD.shadow, textTransform: "uppercase", lineHeight: 1.2 }}>{t}</div>
);

// кисть «везёт санки» в координатах позы (для верёвки к санкам)
const SLED_HAND = { x: -31, y: -163 };
// раскладка поз: 5 в третьем ряду и 3 широких в четвёртом
const POS2: [number, number][] = [[220, 1300], [640, 1300], [1060, 1300], [1480, 1300], [1900, 1300], [380, 1900], [1120, 1900], [1820, 1900]];

/** Лист персонажей серии (2400×2000). */
export const CastSheet: React.FC = () => {
  useFonts();
  const top: [number, React.ReactNode, string][] = [
    [120, <g transform="scale(-1 1)"><Person pose={STAND} o={ARTYOM_AUTUMN} /></g>, "влево"],
    [340, <Person pose={STAND} o={ARTYOM_AUTUMN} />, "вправо"],
    [520, <Frontal2 o={ARTYOM_AUTUMN} />, "анфас"],
    [710, <Frontal2 o={ARTYOM_AUTUMN} turn={1} face={{ ...STAND.face, mouth: "smile" }} />, "3/4"],
    [900, <Frontal2 o={ARTYOM_WINTER} turn={1} />, "зима · 3/4"],
    [1100, <Person pose={{ ...STAND, face: { ...STAND.face, mouth: "smile" } }} o={NEIGHBOR} />, "сосед Пётр"],
    [1300, <Frontal2 o={NEIGHBOR} />, "сосед · анфас"],
    [1560, <Collie pose={DOG_STAND} />, "Луна · профиль"],
    [1860, <Collie pose={dogSit(0)} />, "Луна · ждёт"],
    [2160, <Collie pose={dogLie(0)} collar={false} />, "Луна · лежит"],
  ];
  const keys = Object.keys(POSES2);
  return (
    <AbsoluteFill style={{ backgroundColor: YARD.sky }}>
      <svg width={2400} height={2000} style={{ position: "absolute", inset: 0 }}>
        {[640, 1300, 1900].map((y) => <rect key={y} x={40} y={y} width={2320} height={4} fill={YARD.olive} opacity={0.5} />)}
        {top.map(([x, el], i) => <g key={i} transform={`translate(${x} 640) scale(1.3)`}>{el}</g>)}
        {keys.map((k, i) => {
          const d = POSES2[k];
          const [x, y] = POS2[i];
          return (
            <g key={k} transform={`translate(${x} ${d.rotate ? y - 40 : y}) scale(1.3)`}>
              {k === "sitTable" || k === "write" ? <rect x={-30} y={-62} width={50} height={62} fill={YARD.boards} /> : null}
              <g transform={`rotate(${d.rotate ?? 0})`}><Person pose={k === "leash" ? { ...d.pose, holdN: null } : d.pose} o={k === "sled" ? ARTYOM_WINTER : ARTYOM_AUTUMN} /></g>
              {k === "leash" && <>
                <g transform="translate(150 0) scale(0.8)"><Collie pose={dogWalk(12, 0, true, DOG_WALK2)} /></g>
                <path d="M 140 -148 Q 200 -96 250 -86" stroke="#C1622D" strokeWidth={3} fill="none" strokeLinecap="round" />
              </>}
              {k === "sled" && <>
                <g transform="translate(-150 0)"><rect x={-60} y={-26} width={110} height={14} rx={6} fill={YARD.boards} /><path d="M -70 -6 L 60 -6 Q 74 -6 70 -18" stroke={YARD.shadow} strokeWidth={4} fill="none" /></g>
                <path d={`M ${SLED_HAND.x} ${SLED_HAND.y} Q -60 -40 -96 -22`} stroke="#B99B65" strokeWidth={3} fill="none" strokeLinecap="round" />
              </>}
            </g>
          );
        })}
      </svg>
      {top.map(([x, , l], i) => <Lbl key={i} x={x} y={672} t={l} />)}
      {keys.map((k, i) => <Lbl key={k} x={POS2[i][0] + (k === "lie" ? 60 : k === "leash" ? 90 : k === "sled" ? -60 : 0)} y={POS2[i][1] + 32} t={POSES2[k].label} />)}
    </AbsoluteFill>
  );
};

/** Пробные кадры 1080×1920. */
export const Frame66: React.FC<{ v: "yard" | "interior" | "night" | "fog" | "winter" | "howto" | "ritm" | "notebook" }> = ({ v }) => {
  useFonts();
  const f = useCurrentFrame() + 120;
  const S = 2.3;
  const art = (o = ARTYOM_AUTUMN, x = 420, pose = STAND) => <g transform={`translate(${x} ${G}) scale(${S})`}><Person pose={pose} o={o} /></g>;
  const luna = (x = 760, flip = true, pose = dogSit(f, 1)) => <g transform={`translate(${x} ${G}) scale(${flip ? -S * 0.95 : S * 0.95} ${S * 0.95})`}><Collie pose={pose} /></g>;
  if (v === "howto") return <Film><HowTo1 f={60} items={[
    { icon: "sneakers", label: "Дверь", at: 0 }, { icon: "alarm", label: "07:00", at: 0 }, { icon: "walk", label: "Шагом", at: 0 }, { icon: "twoMiss", label: "Два пропуска", at: 0, no: true },
  ]} /></Film>;
  if (v === "ritm") return <Film vignette={0.4}><RitmInsert f={60} frame={f} done={3} total={20} missAt={3} /></Film>;
  if (v === "notebook") return <Film><NotebookMap f={30} frame={f} drawAt={0} ticks={[{ day: 1, at: 0 }, { day: 2, at: 0 }, { day: 3, at: 0 }]} /></Film>;
  return (
    <Film vignette={v === "night" || v === "interior" ? 0.6 : 0.5}>
      {v === "yard" && <Yard frame={f} season={0}>{art()}{luna()}</Yard>}
      {v === "night" && <Yard frame={f} season={0} mode="night">{art(ARTYOM_AUTUMN, 360, POSES2.binoculars.pose)}{luna(720, false, dogLie(f, 1))}</Yard>}
      {v === "fog" && <Yard frame={f} season={0.2} mode="fog">{art(ARTYOM_AUTUMN, 380, { ...gait2(f, WALK2), x: 0 })}{luna(760, false, { ...dogWalk(f, 0, true, DOG_WALK2), x: 0 })}</Yard>}
      {v === "winter" && <Yard frame={f} season={1}>{art(ARTYOM_WINTER, 420, { ...STAND, face: { ...STAND.face, mouth: "smile" } })}{luna(760)}</Yard>}
      {v === "interior" && <Interior frame={f}>
        <g transform={`translate(560 ${G}) scale(${S})`}>
          <rect x={-34} y={-70} width={56} height={10} rx={3} fill="#5E4535" /><rect x={-30} y={-60} width={8} height={60} fill="#5E4535" /><rect x={12} y={-60} width={8} height={60} fill="#5E4535" />
          <rect x={-36} y={-150} width={9} height={90} rx={3} fill="#5E4535" />
          <Person pose={POSES2.write.pose} o={ARTYOM_AUTUMN} />
        </g>
        <g transform={`translate(130 ${G}) scale(${S * 0.95})`}><Collie pose={{ ...dogLie(f, 2), ...{ breath: dogLife(f).breath } }} collar={false} /></g>
      </Interior>}
    </Film>
  );
};

/** 15-секундный тест: Артём идёт по двору с Луной, камера медленно наезжает, переход в новую главу, титр. */
export const Test15: React.FC = () => {
  useFonts();
  const f = useCurrentFrame();
  const S = 2.0;
  // два полных цикла шага (48 кадров = 280 px рига), потом стоит; Луна садится
  const wf = Math.max(0, Math.min(f - 20, 48));
  const walking = f >= 20 && f < 68;
  const face = { mouth: "smile" as const, blink: f % 80 < 3 ? 1 : 0 };
  const g = gait2(wf, WALK2, { holdN: "leash", face });
  const hero = walking ? g : { ...STAND, x: g.x, holdN: "leash" as const, torso: 1 + Math.sin(f / 18), face: { ...STAND.face, ...face } };
  const d = dogWalk(wf, 2, true, DOG_WALK2);
  const dog = walking || f < 20 ? d : { ...dogSit(f, 2), x: d.x };
  const startX = 80;
  const cam = { zoom: interpolate(f, [0, 300], [1, 1.06]), x: 0 };
  const fade = interpolate(f, [270, 300, 318, 345], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const chapter2 = f >= 309;
  return (
    <Film>
      {!chapter2 ? (
        <Yard frame={f} season={0} cam={cam}>
          <g transform={`translate(${startX} ${G}) scale(${S})`}><Person pose={hero} o={ARTYOM_AUTUMN} /></g>
          <g transform={`translate(${startX + 230} ${G}) scale(${S * 0.95})`}><Collie pose={dog} /></g>
        </Yard>
      ) : (
        <Yard frame={f} season={1} cam={{ zoom: 1 + 0.03 * (f - 309) / 141, x: 0 }}>
          <g transform={`translate(560 ${G}) scale(${S * 0.95})`}><Collie pose={dogSit(f, 3)} /></g>
        </Yard>
      )}
      {f < 120 && <ChapterTitle f={f - 20} text="Октябрь" />}
      {chapter2 && <ChapterTitle f={f - 330} text="Первый снег" />}
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />
    </Film>
  );
};

export { SeriesTitle, HowTo2, RitmInsert, NotebookMap, Interior };
