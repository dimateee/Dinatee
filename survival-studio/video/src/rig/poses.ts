// 8 поз листа персонажей (серия «Дисциплина»). Значения — углы рига Hero.
import { DIM, HeroPose, NEUTRAL } from "./Hero";
import { ik2 } from "./geom";
import { heroGait, RUN } from "./gait";

const E = NEUTRAL.expr;
const SEAT_HIP = -(DIM.shin + DIM.ankleH);

export const POSES: Record<string, { pose: HeroPose; outfit?: "casual" | "sport"; rotate?: number; label: string }> = {
  sitDesk: {
    label: "сидит за столом",
    pose: {
      ...NEUTRAL, y: SEAT_HIP, torso: 16, head: 4,
      legL: { hip: -88, knee: 92, foot: 0 }, legR: { hip: -84, knee: 88, foot: 0 },
      armL: { sh: -76, el: -6, wr: 10 }, armR: { sh: -70, el: -10, wr: 0 },
      expr: { ...E, brow: -0.2, browTilt: -0.4, mouth: "flat" },
    },
  },
  getUp: {
    label: "встаёт с кровати",
    pose: {
      ...NEUTRAL, y: -68, torso: 22, head: 10,
      legL: { hip: -70, knee: 104, foot: 0 }, legR: { hip: -64, knee: 100, foot: 0 },
      armL: { sh: 32, el: -6, wr: 0 }, armR: { sh: 24, el: -10, wr: 0 },
      expr: { ...E, blink: 0.55, browTilt: 0.8, mouth: "flat" },
    },
  },
  phone: {
    label: "держит телефон",
    pose: {
      ...NEUTRAL, head: 16, torso: 4,
      armL: { sh: -36, el: -104, wr: 20 }, armR: { sh: 4, el: -10, wr: 0 }, holdL: "phone", phoneGlow: 0.8,
      expr: { ...E, brow: -0.1, browTilt: 0.2, mouth: "flat" },
    },
  },
  watch: {
    label: "смотрит на часы",
    pose: {
      ...NEUTRAL, head: 20, torso: 3,
      armL: { sh: -18, el: -112, wr: -10 }, armR: { sh: 6, el: -12, wr: 0 },
      expr: { ...E, brow: 0.6, browTilt: 0.3, mouth: "o" },
    },
  },
  tick: {
    label: "ставит галочку в тетради",
    pose: {
      ...NEUTRAL, head: 14, torso: 4,
      armR: { sh: -58, el: -56, wr: 0 }, holdR: "notebook",
      armL: { sh: -48, el: -62, wr: 20 }, holdL: "pen",
      expr: { ...E, brow: 0.2, mouth: "smile" },
    },
  },
  laces: (() => {
    const hipY = 69;
    const R = ik2(60, hipY - DIM.ankleH, DIM.thigh, DIM.shin, 1);
    return {
      label: "завязывает шнурки",
      pose: {
        ...NEUTRAL, y: -hipY, torso: 46, head: 18,
        legL: { hip: -8, knee: 100, foot: 62 },
        legR: { hip: R.upper, knee: R.lower, foot: 0 },
        armL: { sh: -66, el: -10, wr: 0 }, armR: { sh: -58, el: -18, wr: 0 }, holdL: "lace" as const,
        expr: { ...E, brow: -0.2, browTilt: -0.6, mouth: "flat" },
      },
    };
  })(),
  sofa: {
    label: "лежит без сил на диване",
    rotate: -90,
    pose: {
      ...NEUTRAL, x: 0, y: 0, torso: 0, head: -4,
      legL: { hip: -4, knee: 8, foot: -70 }, legR: { hip: 2, knee: 6, foot: -74 },
      armL: { sh: 92, el: 0, wr: 0 }, armR: { sh: -34, el: -70, wr: 0 },
      expr: { ...E, blink: 0.7, browTilt: 1, mouth: "flat" },
    },
  },
  run: { label: "бежит", outfit: "sport", pose: heroGait(0, RUN, { expr: { mouth: "flat", brow: 0, browTilt: -0.3, blink: 0 } }) },
};
