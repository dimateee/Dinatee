import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { RoomMorning, RoomNight } from "../../scenes/Rooms";
import { DoorNight, FaceClose, LunaClose, Street } from "../../scenes/Extra";
import { Hero, HeroHead, NEUTRAL } from "../../rig/Hero";
import { Dog, dogLie, DOG_WALK_MATCH, dogWalk } from "../../rig/Dog";
import { heroGait, WALK } from "../../rig/gait";
import { POSES } from "../../rig/poses";
import { GroundShadow, RimDefs } from "../../rig/shared";
import { Leader, Plate, ServiceLabel } from "../../ui/Hud";
import { REGIME, SRYV } from "../../style/palette";
import { at, FPS, Shot } from "./timeline";
import aptPts from "./apartment_points.json";
import yard from "./courtyard_info.json";
import {
  AlarmClock, ap, Calendar, Caption, Chain, HabitCurve, HabitLoop, Marker, NotebookCard, PeopleDots, Push,
  RangeBand, Ribbon, Ruler, SchemaBg, Stairs, StudyCard, TimerCard,
} from "./parts";

export type ShotProps = { f: number; dur: number; shot: Shot };
/** Локальный кадр для глобального времени (с). */
const lf = (shot: Shot, sec: number) => Math.round((sec - shot.from) * FPS);
const LIGHT_LABEL = { color: REGIME.olive, bg: "rgba(246,242,231,0.92)" } as const;

const S01: React.FC<ShotProps> = ({ f, dur }) => (
  <>
    <RoomNight frame={f} cam={{ zoom: 1 + 0.03 * f / dur, x: 0, y: 0 }} />
    <ServiceLabel x={64} y={110} text="ДЕНЬ 4 — 01:47" />
  </>
);

const S02: React.FC<ShotProps> = ({ f, dur, shot }) => {
  const miss = lf(shot, at("пропуск", 2)), end = lf(shot, at("конец.", 2.5));
  return (
    <>
      <SchemaBg pal="S" />
      <Push f={f} dur={dur} amount={0.03} origin="50% 36%">
        <Calendar f={f} pal="S" chainUpTo={3} dim={ap(f, end, 8)} cells={[
          { state: "green", at: 0 }, { state: "green", at: 2 }, { state: "green", at: 4 },
          { state: f >= miss ? "miss" : "empty", at: 6 }, { state: "empty", at: 8 }, { state: "empty", at: 10 }, { state: "empty", at: 12 },
        ]} />
      </Push>
    </>
  );
};

const S03: React.FC<ShotProps> = ({ f, dur, shot }) => {
  const hero = { ...NEUTRAL, holdL: "leash" as const, expr: { ...NEUTRAL.expr, mouth: "smile" as const, blink: f % 60 < 3 ? 1 : 0 } };
  const k = ap(f, lf(shot, at("артём.", 3.8)) - 2, 6);
  return (
    <>
      <RoomMorning frame={f + 200} heroPose={hero} heroOutfit="casual" heroX={340} cam={{ zoom: 1, x: interpolate(f, [0, dur], [0, 14]), y: 0 }} />
      <Leader from={[260, 360]} to={[420, 520]} kind="resource" progress={k} />
      <Plate x={64} y={220} kind="resource" icon="sneaker" title="Артём" sub="новичок в беге" dark={false} opacity={k} scale={0.94 + 0.06 * k} />
    </>
  );
};

const S04: React.FC<ShotProps> = ({ f, dur }) => (
  <>
    <SchemaBg pal="R" />
    <Push f={f} dur={dur} amount={0.05} origin="50% 30%"><AlarmClock f={f} h={6} m={30} ringAt={2} /></Push>
    <ServiceLabel x={64} y={110} text="ДЕНЬ 1 — 06:30" {...LIGHT_LABEL} />
  </>
);

const S05: React.FC<ShotProps> = ({ f, shot }) => (
  <>
    <SchemaBg pal="R" />
    <NotebookCard f={f} at={0} route lines={[
      { text: "План:", at: lf(shot, at("план:", 6.7)) },
      { text: "5 км", at: lf(shot, at("пять", 7)) },
    ]} />
  </>
);

const S06: React.FC<ShotProps> = ({ f, shot }) => {
  const k = ap(f, 2, 6), u = ap(f, lf(shot, at("без", 9.2)), 8);
  return (
    <>
      <Street frame={f} mode="run" heroX={430} />
      <div style={{ position: "absolute", left: 64, top: 220 }}>
        <Plate x={0} y={0} kind="resource" icon="calendar" title="План" sub="5 км каждый день" dark={false} opacity={k} scale={0.94 + 0.06 * k} />
      </div>
      <div style={{ position: "absolute", left: 92, top: 368, height: 10, width: Math.round(420 * u), borderRadius: 5, background: SRYV.fail }} />
    </>
  );
};

const S07: React.FC<ShotProps> = ({ f }) => (
  <>
    <Street frame={f + 40} night mode="empty" />
    <ServiceLabel x={64} y={110} text="ДЕНЬ 4 — СРЫВ" color={SRYV.fail} />
  </>
);

const S08: React.FC<ShotProps> = ({ f, dur, shot }) => {
  const k = ap(f, lf(shot, at("пропустил.", 13)), 6);
  return (
    <>
      <RoomNight frame={f + 30} rain cam={{ zoom: 1 + 0.04 * f / dur, x: 0, y: 0 }} />
      <ServiceLabel x={64} y={110} text="ДЕНЬ 4 — 01:47" />
      <Leader from={[200, 380]} to={[200, 860]} kind="bad" progress={k} />
      <Plate x={64} y={240} kind="bad" icon="warn" title="Срыв" sub="день 4" opacity={k} scale={0.94 + 0.06 * k} />
    </>
  );
};

const S09: React.FC<ShotProps> = ({ f, shot }) => {
  const head = lf(shot, at("голове", 14.3)), brk = lf(shot, at("сломал.", 15.8));
  return (
    <>
      <SchemaBg pal="S" />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(540 ${330 + (1 - ap(f, head, 6)) * 30}) scale(2.6)`} opacity={ap(f, head, 6)}>
          <HeroHead expr={{ brow: -0.2, browTilt: f >= brk ? 1 : 0.4, mouth: f >= brk ? "sad" : "flat", blink: 0 }} glow={0.6} />
        </g>
      </svg>
      <Chain f={f} at={0} breakAt={brk} />
      <Ribbon f={f} start={lf(shot, at("всё,", 15.3))} text="Пропуск = конец?" y={880} />
    </>
  );
};

const S10: React.FC<ShotProps> = ({ f, dur }) => (
  <Push f={f} dur={dur} amount={0.03}><FaceClose frame={f} /></Push>
);

const S11: React.FC<ShotProps> = ({ f, dur }) => (
  <Push f={f} dur={dur} amount={0.03} origin="70% 55%"><DoorNight frame={f} /></Push>
);

const S12: React.FC<ShotProps> = ({ f, shot }) => (
  <>
    <SchemaBg pal="S" />
    <Ruler f={f} drawAt={0} pal="S" />
    <Caption x={540} y={300} w={900} text="ПРИВЫЧКА" color="#C9D2E0" size={64} font="head" opacity={ap(f, lf(shot, at("привычка", 22)), 6)} />
    <Marker f={f} day={21} at={lf(shot, at("двадцать", 23))} label="21 ДЕНЬ" color={SRYV.lamp} />
  </>
);

const S13: React.FC<ShotProps> = ({ f, shot }) => {
  const k = ap(f, lf(shot, at("миф.", 24.6)), 5);
  return (
    <>
      <SchemaBg pal="S" />
      <Ruler f={f + 200} drawAt={0} pal="S" />
      <Marker f={f + 200} day={21} at={0} label="21 ДЕНЬ" color={SRYV.lamp} crossAt={200} />
      <Plate x={640} y={180} kind="bad" icon="warn" title="Миф" opacity={k} scale={0.94 + 0.06 * k} />
    </>
  );
};

const S14: React.FC<ShotProps> = ({ f, dur, shot }) => (
  <>
    <SchemaBg pal="S" />
    <Push f={f} dur={dur} amount={0.03}>
      <StudyCard f={f} at={0} />
      <PeopleDots f={f} at={lf(shot, at("лондона", 27)) - 6} scatter={0} pal="S" />
    </Push>
  </>
);

const S15: React.FC<ShotProps> = ({ f, shot }) => {
  const scatter = interpolate(f, [0, 22], [0, 1], { extrapolateRight: "clamp" });
  return (
    <>
      <SchemaBg pal="S" />
      <Ruler f={f + 200} drawAt={0} pal="S" />
      <PeopleDots f={f + 400} at={0} scatter={scatter * 0.999} pal="S" />
      <Marker f={f} day={66} at={lf(shot, at("шестьдесят", 29))} label="66 ДНЕЙ" color={SRYV.progress} roll />
    </>
  );
};

const S16: React.FC<ShotProps> = ({ f, shot }) => (
  <>
    <SchemaBg pal="S" />
    <Ruler f={f + 200} drawAt={0} pal="S" />
    <PeopleDots f={f + 400} at={0} scatter={1} pal="S" />
    <Marker f={f + 200} day={66} at={0} label="66 ДНЕЙ" color={SRYV.progress} />
    <Caption x={540} y={300} w={900} text="У КАЖДОГО ПО-СВОЕМУ" color="#C9D2E0" size={48} font="head" opacity={ap(f, lf(shot, at("людей", 31)), 6)} />
    <RangeBand f={f} from={18} to={254} at={lf(shot, at("восемнадцати", 31.5))} label="18–254 ДНЯ" color={SRYV.lamp} />
  </>
);

const S17: React.FC<ShotProps> = ({ f, shot }) => (
  <>
    <SchemaBg pal="R" />
    <HabitCurve f={f} at={0} dur={lf(shot, 38.3)} dipAt={lf(shot, at("пропуск", 36))} />
  </>
);

const S18: React.FC<ShotProps> = ({ f, dur, shot }) => {
  const k = ap(f, lf(shot, at("день.", 40)) - 4, 6);
  return (
    <>
      <SchemaBg pal="R" />
      <Push f={f} dur={dur} amount={0.03}>
        <Calendar f={f} pal="R" chainUpTo={7} cells={[
          { state: "green", at: 0 }, { state: "green", at: 2 }, { state: "green", at: 4 }, { state: "empty", at: 6 },
          { state: "green", at: 10 }, { state: "green", at: 14 }, { state: "green", at: 18 },
        ]} />
      </Push>
      <Plate x={250} y={240} kind="good" icon="check" title="1 пропуск ≠ провал" dark={false} opacity={k} scale={0.94 + 0.06 * k} />
    </>
  );
};

const S19: React.FC<ShotProps> = ({ f, dur, shot }) => {
  const dec = f >= lf(shot, at("решение,", 41.3));
  const pose = { ...POSES.getUp.pose, head: dec ? 16 : 10, expr: { ...POSES.getUp.pose.expr, browTilt: dec ? 1 : 0.6, blink: dec ? 0.3 : 0.55 } };
  return <RoomMorning frame={f + 100} heroPose={pose} heroOutfit="casual" heroX={300} bed cam={{ zoom: 1 + 0.03 * f / dur, x: 0, y: 0 }} />;
};

const S20: React.FC<ShotProps> = ({ f, shot }) => (
  <>
    <SchemaBg pal="R" />
    <Stairs f={f} at={4} stepAt={lf(shot, at("шаг.", 45.5))} />
    <ServiceLabel x={64} y={110} text="ЧТО ДЕЛАТЬ · 1" {...LIGHT_LABEL} />
  </>
);

const S21: React.FC<ShotProps> = ({ f, shot }) => (
  <>
    <SchemaBg pal="R" />
    <TimerCard f={f} at={lf(shot, at("а", 47.2))} text="10:00" color={SRYV.progress} strike={{ text: "5 КМ", at: lf(shot, at("а", 47.2)) - 3 }} y={720} />
  </>
);

const S22: React.FC<ShotProps> = ({ f }) => <Street frame={f + 24} mode="walk" dog heroX={360} />;

const S23: React.FC<ShotProps> = ({ f, dur }) => {
  const k = ap(f, 6, 6);
  return (
    <>
      <SchemaBg pal="R" />
      <Push f={f} dur={dur} amount={0.04} origin="50% 30%"><AlarmClock f={f} h={7} m={0} ringAt={1} y={600} /></Push>
      <ServiceLabel x={64} y={110} text="ЧТО ДЕЛАТЬ · 2" {...LIGHT_LABEL} />
      <Plate x={500} y={96} kind="resource" icon="alarm" title="Сигнал" sub="будильник 07:00" dark={false} opacity={k} scale={0.94 + 0.06 * k} />
    </>
  );
};

const S24: React.FC<ShotProps> = ({ f, shot }) => (
  <>
    <SchemaBg pal="R" />
    <HabitLoop f={f} at={0} nodes={[
      { icon: "alarm", label: "СИГНАЛ", at: lf(shot, at("семь", 51.8)) },
      { icon: "sneaker", label: "ДЕЙСТВИЕ", at: lf(shot, at("кроссовки».", 53)) },
      { icon: "paw", label: "НАГРАДА", at: lf(shot, at("кроссовки».", 53)) + 14 },
    ]} />
  </>
);

const S25: React.FC<ShotProps> = ({ f, shot }) => {
  const pts = (aptPts as { points: Record<string, number[][]> }).points;
  const i = Math.min(pts.sneakers.length - 1, Math.max(0, f));
  const ks = ap(f, lf(shot, at("кроссовки", 54.5)), 6), kd = ap(f, lf(shot, at("двери.", 56)) - 8, 6);
  const sn = pts.sneakers[i], ph = pts.phone[i];
  return (
    <>
      <Img src={staticFile(`3d/apartment/f_${String(i + 1).padStart(4, "0")}.png`)} style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }} />
      <ServiceLabel x={64} y={110} text="ЧТО ДЕЛАТЬ · 3" {...LIGHT_LABEL} />
      <Leader from={[300, 330]} to={[sn[0], sn[1]]} kind="good" progress={ks} />
      <Plate x={64} y={250} kind="good" icon="sneaker" title="Кроссовки" sub="с вечера у двери" dark={false} opacity={ks} scale={0.94 + 0.06 * ks} />
      <Leader from={[820, 470]} to={[ph[0], ph[1]]} kind="resource" progress={kd} />
      <Plate x={620} y={400} kind="resource" icon="phone" title="Телефон" sub="в коридоре" dark={false} opacity={kd} scale={0.94 + 0.06 * kd} />
    </>
  );
};

const S26: React.FC<ShotProps> = ({ f, dur, shot }) => {
  const k = ap(f, lf(shot, at("луна.", 57.8)) - 6, 6);
  return (
    <>
      <RoomMorning frame={f + 300} showHero={false} cam={{ zoom: 1 + 0.03 * f / dur, x: 0, y: 0 }} />
      <Leader from={[840, 262]} to={[790, 800]} kind="good" progress={k} />
      <Plate x={560} y={150} kind="good" icon="paw" title="Луна" sub="07:00 каждый день" dark={false} opacity={k} scale={0.94 + 0.06 * k} />
    </>
  );
};

const S27: React.FC<ShotProps> = ({ f, dur }) => (
  <Push f={f} dur={dur} amount={0.05} origin="50% 30%"><LunaClose frame={f + 40} /></Push>
);

const S28: React.FC<ShotProps> = ({ f, shot }) => {
  const kt = ap(f, lf(shot, at("время", 62.1)), 6), km = ap(f, lf(shot, at("место.", 62.7)), 6);
  const tilt = interpolate(f, [10, 22], [0, 10], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ribbonOut = f >= lf(shot, at("у", 61.6)); // лента уходит до появления плашек
  return (
    <>
      <LunaClose frame={f + 80} tilt={tilt} />
      {!ribbonOut && <Ribbon f={f} start={lf(shot, at("мотивация.", 60.6))} text="Мотивация ≠ дисциплина" y={200} />}
      <Plate x={64} y={150} kind="good" icon="alarm" title="Время" sub="07:00" dark={false} opacity={kt} scale={0.94 + 0.06 * kt} />
      <Plate x={560} y={150} kind="good" icon="paw" title="Место" sub="у двери" dark={false} opacity={km} scale={0.94 + 0.06 * km} />
    </>
  );
};

const S30: React.FC<ShotProps> = ({ f, dur }) => (
  <>
    <RoomMorning frame={f + 400} cam={{ zoom: 1 + 0.03 * f / dur, x: 0, y: 0 }} />
    <ServiceLabel x={64} y={110} text="ДЕНЬ 5 — СНОВА" {...LIGHT_LABEL} />
    <ServiceLabel x={760} y={110} text="· 4 ·" {...LIGHT_LABEL} />
  </>
);

const S31: React.FC<ShotProps> = ({ f }) => {
  const s = Math.max(0, 120 - Math.floor(f / 30 * 1)); // одиночное число: 02:00 → 01:59 …
  const t = `0${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <>
      <SchemaBg pal="R" />
      <TimerCard f={f} at={0} text={t} color={SRYV.progress} y={600} />
    </>
  );
};

const S32: React.FC<ShotProps> = ({ f, dur, shot }) => (
  <>
    <SchemaBg pal="R" />
    <Push f={f} dur={dur} amount={0.03}>
      <Calendar f={f} pal="R" chainUpTo={7} cells={[
        { state: "green", at: -20 }, { state: "green", at: -20 }, { state: "green", at: -20 }, { state: "empty", at: -20 },
        { state: "green", at: 0 }, { state: f >= lf(shot, at("дважды.", 68.5)) ? "lock" : "empty", at: 4 }, { state: "green", at: 10 },
      ]} />
    </Push>
  </>
);

const S33: React.FC<ShotProps> = ({ f, shot }) => {
  const info = yard as { frames: number; walk_y: number; ground_px_per_frame: number };
  const scale = info.ground_px_per_frame / (WALK.stride / WALK.period); // шаг = скорость земли в 3D
  const i = Math.min(info.frames - 1, f);
  const hero = heroGait(f, WALK, { expr: { brow: 0.3, browTilt: -0.2, mouth: "smile", blink: f % 70 < 3 ? 1 : 0 }, holdL: "leash" });
  const dog = dogWalk(f, 6, true, DOG_WALK_MATCH);
  const k = ap(f, 2, 6);
  return (
    <>
      <Img src={staticFile(`3d/courtyard/f_${String(i + 1).padStart(4, "0")}.png`)} style={{ position: "absolute", inset: 0, width: 1080, height: 1920 }} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <RimDefs id="rimY" side={-1} color="#FFD7A0" strength={0.9} />
        <g transform={`translate(640 ${info.walk_y}) scale(${scale})`}>
          <GroundShadow w={150} opacity={0.22} />
          <g transform={`translate(${-dog.x} 0)`}><Dog pose={dog} rimFilter="rimY" /></g>
        </g>
        <g transform={`translate(380 ${info.walk_y}) scale(${scale})`}>
          <GroundShadow w={130} opacity={0.22} />
          <g transform={`translate(${-hero.x} 0)`}><Hero pose={hero} outfit="sport" rimFilter="rimY" /></g>
        </g>
      </svg>
      <ServiceLabel x={64} y={110} text="ДЕНЬ 66" {...LIGHT_LABEL} />
      <div style={{ opacity: k }}><Plate x={560} y={96} kind="good" icon="check" title="Серия" sub="без споров" dark={false} /></div>
    </>
  );
};

const S34: React.FC<ShotProps> = ({ f }) => {
  const hero = { ...NEUTRAL, head: 8, holdL: "leash" as const, expr: { brow: 0.4, browTilt: 0.2, mouth: "smile" as const, blink: f % 50 < 3 ? 1 : 0 } };
  return <RoomMorning frame={f + 500} heroPose={hero} heroOutfit="casual" heroX={320} dogPose={dogLie(f + 500, 7)} dogX={720} cam={{ zoom: 1, x: interpolate(f, [0, 60], [0, -12]), y: 0 }} />;
};

const S35: React.FC<ShotProps> = ({ f }) => (
  <>
    <SchemaBg pal="R" />
    <Calendar f={f} pal="R" chainUpTo={7} cells={[
      { state: "green", at: -20 }, { state: "green", at: -20 }, { state: "green", at: -20 }, { state: "paw", at: 6 },
      { state: "green", at: -20 }, { state: "green", at: -20 }, { state: "green", at: 14 },
    ]} />
  </>
);

const S36: React.FC<ShotProps> = ({ f, dur }) => (
  <>
    <SchemaBg pal="R" />
    <Push f={f} dur={dur} amount={0.04}>
      <Calendar f={f} pal="R" size={260} labels={false} cells={[{ state: "pulse", at: 0 }]} y={620} />
    </Push>
  </>
);

export const SHOT_COMPONENTS: Record<number, React.FC<ShotProps>> = {
  1: S01, 2: S02, 3: S03, 4: S04, 5: S05, 6: S06, 7: S07, 8: S08, 9: S09, 10: S10, 11: S11, 12: S12, 13: S13,
  14: S14, 15: S15, 16: S16, 17: S17, 18: S18, 19: S19, 20: S20, 21: S21, 22: S22, 23: S23, 24: S24, 25: S25,
  26: S26, 27: S27, 28: S28, 30: S30, 31: S31, 32: S32, 33: S33, 34: S34, 35: S35, 36: S36,
};

export { AbsoluteFill };
