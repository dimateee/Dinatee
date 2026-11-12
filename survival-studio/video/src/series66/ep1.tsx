import React from "react";
import { interpolate } from "remotion";
import { EpisodeDef, Hero, Luna, push } from "./engine";
const IN = 1.35; // интерьеры крупнее: меньше пустой стены
import { G, Interior, RIVER_PATH_Y, RiverWide, Yard } from "./Scenes";
import { DaysPage, HowTo1, NotebookMap, RitmInsert } from "./Inserts";
import { ARTYOM_AUTUMN, P, Pose2, STAND } from "../rig2/Person";
import { gait2, WALK2 } from "../rig2/gait2";
import { POSES2 } from "../rig2/poses2";
import { DOG_WALK2 } from "../rig2/Collie";
import { dogLie, dogSit, dogWalk } from "../rig/Dog";

const SIT_Y = -(P.shin + P.ankle) + 2;
/** Сидит на краю кровати, голова опущена, руки на коленях; дышит. */
export const sitSad = (frame: number, head = 22): Pose2 => ({
  ...STAND, y: SIT_Y - 6, torso: 22 + 1.2 * Math.sin(frame / 18), head: head + Math.sin(frame / 25),
  legN: { hip: -84, knee: 92, foot: 0 }, legF: { hip: -80, knee: 88, foot: 0 },
  armN: { sh: -38, el: -52, wr: 0 }, armF: { sh: -32, el: -56, wr: 0 },
  face: { brow: -0.2, tilt: 1, mouth: "line", blink: frame % 90 < 4 ? 1 : 0 },
});
/** Стоит, дышит, моргает. */
export const idle = (frame: number, extra: Partial<Pose2> = {}): Pose2 => ({
  ...STAND, torso: 1 + Math.sin(frame / 18), head: Math.sin(frame / 27) * 1.5,
  face: { ...STAND.face, blink: frame % 80 < 3 ? 1 : 0 }, ...extra,
});
const PhoneTime: React.FC<{ text: string; x: number; y: number; o?: number }> = ({ text, x, y, o = 1 }) => (
  <div style={{ position: "absolute", left: x, top: y, opacity: o, fontFamily: "Oswald", fontWeight: 600, fontSize: 54, color: "#9CC6F5", letterSpacing: 2, lineHeight: 1 }}>{text}</div>
);
const S = 1.9;

export const EP1: EpisodeDef = {
  id: "66days-1", title: "66 ДНЕЙ", sub: "Дневник Артёма", coldEnd: 6.25, voiceEnd: 82.72, audio: "audio/66days-1_mix.wav",
  shots: [
    // ХОЛОДНОЕ ОТКРЫТИЕ: дождь, утро, он проспал
    { from: 0, to: 6.25, render: (c) => (<>
      <Interior frame={c.frame} rain bed table={false} dim={0.2} cam={push(c, 0.06, 0, IN)}>
        <Hero x={560} y={G} s={S} pose={sitSad(c.frame)} />
      </Interior>
      <PhoneTime text="07:40" x={905} y={1235} o={interpolate(c.f, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
    </>) },
    // ОКТЯБРЬ: у реки, мост вдали
    { from: 6.25, to: 12.04, chapter: "Октябрь", enter: "black", render: (c) => (
      <RiverWide frame={c.frame} season={0} cam={push(c, 0.05, -c.f * 0.4)}>
        <Hero x={240} y={RIVER_PATH_Y} s={1.5} pose={idle(c.frame, { head: -4 })} />
        <Luna x={420} y={RIVER_PATH_Y} s={1.4} pose={dogSit(c.frame, 1)} />
      </RiverWide>) },
    // Тетрадь: маршрут дом → мост, три галочки
    { from: 12.04, to: 18.9, enter: "dissolve", render: (c) => (
      <NotebookMap f={c.f} frame={c.frame} drawAt={6} ticks={[{ day: 1, at: c.lf(15.44) }, { day: 2, at: c.lf(16.4) }, { day: 3, at: c.lf(17.3) }]} />) },
    // Луна ждёт у ворот (туман, рассвет)
    { from: 18.9, to: 22.01, enter: "dissolve", exitBlack: true, render: (c) => (
      <Yard frame={c.frame} season={0.1} mode="fog" cam={push(c, 0.05)}>
        <Luna x={760} y={G} s={S * 0.95} pose={dogSit(c.frame, 2)} flip />
      </Yard>) },
    // ДОЖДЬ: ночь, спит, будильник гудит впустую
    { from: 22.01, to: 29.15, chapter: "Дождь", enter: "black", render: (c) => {
      const buzz = c.f >= c.lf(24.59) && c.f < c.lf(24.59) + 70 ? 0.5 + 0.5 * Math.sin(c.f * 1.3) : 0;
      return (
        <Interior frame={c.frame} rain bed table={false} dim={0.45} phoneBuzz={buzz} cam={push(c, 0.04, 0, IN)}>
          <g transform={`translate(560 ${G - 186}) scale(${S}) rotate(-90)`}>
            <g transform="translate(0 0)"><Hero x={0} y={0} s={1} pose={{ ...POSES2.lie.pose, torso: Math.sin(c.frame / 20), face: { ...POSES2.lie.pose.face, blink: 1 } }} /></g>
          </g>
        </Interior>);
    } },
    // Проснулся в 07:40, сидит на кровати
    { from: 29.15, to: 34.85, enter: "dissolve", exitBlack: true, render: (c) => (<>
      <Interior frame={c.frame} rain bed table={false} dim={0.1} cam={push(c, 0.05, 0, IN)}>
        <Hero x={560} y={G} s={S} pose={sitSad(c.frame, 26)} />
      </Interior>
      <PhoneTime text="07:40" x={905} y={1235} />
    </>) },
    // Вставка RITM
    { from: 34.85, to: 42.78, enter: "black", exitBlack: true, render: (c) => <RitmInsert f={c.f} frame={c.frame} done={4} missAt={3} total={20} streak={3} /> },
    // КАЛИТКА: утро, калитка скрипит, Луна с поводком в зубах
    { from: 42.78, to: 50.35, chapter: "Калитка", enter: "black", render: (c) => {
      const open = interpolate(c.f, [c.lf(43.2), c.lf(43.2) + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return (
        <Yard frame={c.frame} season={0.15} gateOpen={open} cam={push(c, 0.05)}>
          <Hero x={250} y={G} s={S} pose={idle(c.frame, { face: { brow: 0.3, tilt: 0, mouth: c.f > c.lf(47.6) ? "smile" : "line", blink: c.frame % 80 < 3 ? 1 : 0 } })} />
          <Luna x={790} y={G} s={S * 0.95} pose={dogSit(c.frame, 3)} flip leash />
        </Yard>);
    } },
    // Просто дошёл до моста: проходят через общий план
    { from: 50.35, to: 55.16, enter: "dissolve", exitBlack: true, render: (c) => {
      const h = gait2(c.f, WALK2, { holdN: "leash", face: { mouth: "smile", blink: c.frame % 80 < 3 ? 1 : 0 } });
      const d = dogWalk(c.f, 1, true, DOG_WALK2);
      return (
        <RiverWide frame={c.frame} season={0.2}>
          <Hero x={-40} y={RIVER_PATH_Y} s={1.15} pose={h} />
          <Luna x={150} y={RIVER_PATH_Y} s={1.1} pose={d} />
        </RiverWide>);
    } },
    // КАК НЕ БРОСИТЬ
    { from: 55.16, to: 68.39, enter: "black", exitBlack: true, render: (c) => (
      <HowTo1 f={c.f} items={[
        { icon: "sneakers", label: "Дверь", at: c.lf(57.56) }, { icon: "alarm", label: "07:00", at: c.lf(60.4) },
        { icon: "walk", label: "Шагом", at: c.lf(62.49) }, { icon: "twoMiss", label: "Два пропуска", at: c.lf(65.04), no: true },
      ]} />) },
    // СНЕГ: дни в тетради
    { from: 68.39, to: 74.87, chapter: "Снег", enter: "black", render: (c) => (
      <DaysPage f={c.f} entries={[
        { label: "1", at: -20 }, { label: "2", at: -20 }, { label: "3", at: -20 }, { label: "4", at: -20, tick: false },
        { label: "5", at: c.lf(68.39) }, { label: "8", at: c.lf(69.91) }, { label: "12", at: c.lf(71.3) },
      ]} header={[{ text: "октябрь", at: 0 }]} />) },
    // Смена сезона: двор желтеет, опадает, выпадает снег
    { from: 74.87, to: 77.95, enter: "dissolve", render: (c) => (
      <Yard frame={c.frame} season={interpolate(c.f, [0, 100], [0.15, 1], { extrapolateRight: "clamp" })} cam={push(c, 0.04)} />) },
    // Луна впервые не встала: лежит у печки, Артём у двери
    { from: 77.95, to: 82.72, enter: "dissolve", render: (c) => (
      <Interior frame={c.frame} table={false} dim={0.15} cam={push(c, 0.05, 0, 1.2)}>
        <Luna x={160} y={G} s={S * 0.95} pose={{ ...dogLie(c.frame, 4), head: -4, earL: -10, earR: -10 }} collar={false} />
        <Hero x={780} y={G} s={S} pose={idle(c.frame, { head: 14, holdN: "leash", armN: { sh: 4, el: -10, wr: 0 }, face: { brow: -0.3, tilt: 0.8, mouth: "line", blink: c.frame % 80 < 3 ? 1 : 0 } })} flip />
      </Interior>) },
  ],
};
export { ARTYOM_AUTUMN };
