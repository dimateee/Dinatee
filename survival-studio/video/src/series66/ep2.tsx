import { interpolate } from "remotion";
import { Breath, EpisodeDef, Hero, Luna, push, Stool } from "./engine";
import { G, Interior, RIVER_PATH_Y, RiverWide, Yard } from "./Scenes";
import { DaysPage, HowTo2, NoteCard, RitmInsert } from "./Inserts";
import { ARTYOM_WINTER, NEIGHBOR, Person, STAND } from "../rig2/Person";
import { gait2, RUN2, WALK2 } from "../rig2/gait2";
import { DOG_WALK2 } from "../rig2/Collie";
import { dogLie, dogSit, dogWalk } from "../rig/Dog";
import { idle, sitSad } from "./ep1";

const S = 1.9, W = ARTYOM_WINTER;

/** Идёт, потом бежит — с непрерывным положением. */
const walkThenRun = (f: number, switchAt: number) => {
  if (f < switchAt) return gait2(f, WALK2, { face: { blink: f % 80 < 3 ? 1 : 0 } });
  const w = gait2(switchAt, WALK2);
  const r = gait2(f - switchAt, RUN2, { face: { brow: 0.1, tilt: -0.3, mouth: "line", blink: 0 } });
  return { ...r, x: w.x + r.x };
};

export const EP2: EpisodeDef = {
  id: "66days-2", title: "66 ДНЕЙ", sub: "Дневник Артёма", coldEnd: 7.91, voiceEnd: 78.64, audio: "audio/66days-2_mix.wav",
  shots: [
    // ХОЛОДНОЕ ОТКРЫТИЕ: минус восемь, темно, один у калитки
    { from: 0.00, to: 7.91, render: (c) => (<>
      <Yard frame={c.frame} season={1} mode="night" cam={push(c, 0.06)}>
        <Hero x={720} y={G} s={S} pose={idle(c.frame, { head: -4 })} o={W} />
      </Yard>
      <Breath x={790} y={G - 545 + Math.round(-50 * c.f / Math.max(1, c.dur))} frame={c.frame} />
    </>) },
    // ЛАПА: Луна у печки с бинтом
    { from: 7.91, to: 10.46, chapter: "Лапа", enter: "black", render: (c) => (
      <Interior frame={c.frame} dim={0.15} table={false} cam={push(c, 0.04, 0, 1.3)}>
        <Luna x={170} y={G} s={S * 0.95} pose={{ ...dogLie(c.frame, 5), head: 2 }} bandage collar={false} />
        <Stool x={560} y={G} s={S} />
        <Hero x={560} y={G} s={S} pose={sitSad(c.frame, 14)} o={W} />
      </Interior>) },
    // Записка ветеринара
    { from: 10.46, to: 13.68, enter: "dissolve", render: (c) => <NoteCard f={c.f} lines={["Луна", "покой — 7 дней"]} at={0} stamp /> },
    // По утрам у печки
    { from: 13.68, to: 17.03, enter: "dissolve", exitBlack: true, render: (c) => (
      <Interior frame={c.frame} dim={0.05} cam={{ zoom: 1.25 + 0.03 * c.f / c.dur, x: 300 }}>
        <Luna x={170} y={G} s={S * 0.95} pose={{ ...dogLie(c.frame, 6), head: 6 }} bandage collar={false} />
      </Interior>) },
    // ОДИН: сидит с кроссовками, не хочется
    { from: 17.03, to: 24.04, chapter: "Один", enter: "black", render: (c) => (
      <Interior frame={c.frame} table={false} dim={0.3} cam={push(c, 0.05, 0, 1.3)}>
        <Luna x={150} y={G} s={S * 0.95} pose={{ ...dogLie(c.frame, 7), head: -2 }} bandage collar={false} />
        <Stool x={640} y={G} s={S} />
        <Hero x={640} y={G} s={S} pose={sitSad(c.frame, 20)} o={W} />
        <g transform={`translate(700 ${G - 6}) scale(1.6)`}><path d="M -12 -2 L -12 -16 L 0 -18 L 6 -10 L 26 -6 Q 32 -4 30 -2 Z" fill="#D8D2C2" /></g>
      </Interior>) },
    // В семь у калитки — один
    { from: 24.04, to: 29.24, enter: "dissolve", exitBlack: true, render: (c) => (
      <Yard frame={c.frame} season={1} cam={push(c, 0.05)}>
        <Hero x={480} y={G} s={S} pose={idle(c.frame)} o={W} />
      </Yard>) },
    // RITM: 15 → 16
    { from: 29.24, to: 35.71, enter: "black", exitBlack: true, render: (c) => (
      <RitmInsert f={c.f} frame={c.frame} done={c.f >= c.lf(32.87) ? 16 : 15} total={20} counter={[15, 16, c.lf(32.87)]} />) },
    // КАК НЕ БРОСИТЬ ЗИМОЙ
    { from: 35.71, to: 49.03, enter: "black", exitBlack: true, render: (c) => (
      <HowTo2 f={c.f} frame={c.frame} title="Зимой" items={[
        { icon: "layers", label: "Слои", at: c.lf(38.04) }, { icon: "reflector", label: "Свет", at: c.lf(40.23) },
        { icon: "shortRoute", label: "Короче", at: c.lf(44.80) }, { icon: "warmup", label: "Разминка", at: c.lf(46.72) },
      ]} />) },
    // МОСТ: неделю один — то шагом, то бегом
    { from: 49.03, to: 54.94, chapter: "Мост", enter: "black", render: (c) => (
      <RiverWide frame={c.frame} season={1}>
        <Hero x={-40} y={RIVER_PATH_Y} s={1.1} pose={walkThenRun(c.f, c.lf(51.96))} o={W} />
      </RiverWide>) },
    // Девятнадцатый день: Луна снова у калитки
    { from: 54.94, to: 60.20, enter: "dissolve", exitBlack: true, render: (c) => (
      <Yard frame={c.frame} season={1} cam={push(c, 0.05)}>
        <Luna x={760} y={G} s={S * 0.95} pose={dogSit(c.frame, 8)} flip leash />
      </Yard>) },
    // ДЕНЬ 66: январь, февраль в тетради
    { from: 60.20, to: 65.77, chapter: "День 66", enter: "black", render: (c) => (
      <DaysPage f={c.f} header={[{ text: "январь", at: 0 }, { text: "февраль", at: c.lf(63.02) }]} entries={
        Array.from({ length: 12 }, (_, i) => ({ label: String(i < 6 ? 36 + i * 4 : 56 + (i - 6) * 2), at: (i < 6 ? 4 : c.lf(63.02) + 4) + (i % 6) * 6 }))} />) },
    // Вместе по снегу
    { from: 65.77, to: 71.89, enter: "dissolve", render: (c) => (
      <RiverWide frame={c.frame} season={1}>
        <Hero x={-40} y={RIVER_PATH_Y} s={1.15} pose={gait2(c.f, WALK2, { holdN: "leash", face: { mouth: "smile", blink: c.frame % 80 < 3 ? 1 : 0 } })} o={W} />
        <Luna x={150} y={RIVER_PATH_Y} s={1.1} pose={dogWalk(c.f, 2, true, DOG_WALK2)} />
      </RiverWide>) },
    // Сосед через забор
    { from: 71.89, to: 78.64, enter: "dissolve", render: (c) => {
      const k = interpolate(c.f, [c.lf(77.12), c.lf(77.12) + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
      return (<>
        <Yard frame={c.frame} season={1} cam={push(c, 0.04)} behind={
          <g transform={`translate(880 ${G - 40}) scale(${S}) scale(-1 1)`}><Person pose={idle(c.frame + 30, { face: { brow: 0.4, tilt: 0, mouth: "smile", blink: (c.frame + 30) % 80 < 3 ? 1 : 0 } })} o={NEIGHBOR} /></g>}>
          <Hero x={320} y={G} s={S} pose={idle(c.frame, { head: -2 })} o={W} />
          <Luna x={540} y={G} s={S * 0.95} pose={dogSit(c.frame, 9)} />
        </Yard>
        <div style={{ position: "absolute", left: 470, top: 640, opacity: k, padding: "22px 30px", background: "#EFE8D6", borderRadius: 10, transform: "rotate(-2deg)",
          boxShadow: "0 8px 20px rgba(0,0,0,.35)", fontFamily: "Caveat", fontWeight: 700, fontSize: 60, color: "#292628", lineHeight: 1 }}>Возьмёте меня завтра?</div>
      </>);
    } },
  ],
};
export { STAND };
