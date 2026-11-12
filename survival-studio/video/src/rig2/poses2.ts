// Позы листа персонажей серии «66 ДНЕЙ».
import { P, Pose2, STAND } from "./Person";
import { gait2, WALK2 } from "./gait2";
import { ik2 } from "../rig/geom";

const F = STAND.face;
const SIT_Y = -(P.shin + P.ankle) + 2;

export const POSES2: Record<string, { pose: Pose2; label: string; rotate?: number }> = {
  walk: { label: "идёт", pose: gait2(0, WALK2) },
  bucket: { label: "несёт ведро", pose: { ...gait2(6, WALK2, { holdN: "bucket" }), armN: { sh: 4, el: -4, wr: 0 }, torso: -3 } },
  sitTable: {
    label: "сидит за столом", pose: {
      ...STAND, y: SIT_Y, torso: 10, head: 8,
      legN: { hip: -88, knee: 90, foot: 0 }, legF: { hip: -84, knee: 86, foot: 0 },
      armN: { sh: -72, el: -14, wr: 0 }, armF: { sh: -64, el: -20, wr: 0 }, holdN: "phone",
      face: { ...F, brow: -0.2, tilt: 0.4 },
    },
  },
  write: {
    label: "пишет в тетради", pose: {
      ...STAND, y: SIT_Y, torso: 18, head: 18,
      legN: { hip: -88, knee: 90, foot: 0 }, legF: { hip: -84, knee: 86, foot: 0 },
      armN: { sh: -40, el: -46, wr: 20 }, armF: { sh: -34, el: -50, wr: 0 }, holdN: "pen",
      face: { ...F, brow: 0.2, mouth: "line" },
    },
  },
  binoculars: (() => {
    // кисти у глаз: цель — точка перед лицом относительно плеча (IK, локоть вниз)
    const eye = { x: P.neck.x + P.headC.x + 30 - P.shoulder.x, y: P.neck.y + P.headC.y - 2 - P.shoulder.y };
    const n = ik2(eye.x - 4, eye.y - 4 + 10, P.upper, P.fore, -1), fa = ik2(eye.x, eye.y + 8, P.upper, P.fore, -1);
    return { label: "смотрит в бинокль", pose: {
      ...STAND, head: -4, armN: { sh: n.upper, el: n.lower, wr: -n.upper - n.lower - 90 }, armF: { sh: fa.upper, el: fa.lower, wr: 0 }, holdN: "binoculars" as const,
      face: { ...F, brow: 0.4 },
    } };
  })(),
  leash: { label: "ведёт собаку", pose: { ...gait2(12, WALK2, { holdN: "leash", face: { mouth: "smile" } }), armN: { sh: -30, el: -20, wr: 0 } } },
  sled: { label: "везёт санки", pose: { ...gait2(4, WALK2), torso: 14, armF: { sh: 40, el: -10, wr: 0 } } },
  lie: {
    label: "лежит без сил", rotate: -90, pose: {
      ...STAND, x: 0, y: 0, torso: 0, head: -6,
      legN: { hip: -2, knee: 6, foot: -70 }, legF: { hip: 4, knee: 4, foot: -74 },
      armN: { sh: 8, el: 4, wr: 0 }, armF: { sh: -26, el: -60, wr: 0 },
      face: { brow: -0.2, tilt: 1, mouth: "line", blink: 0.7 },
    },
  },
};

/** Присед (завязать шнурки) — дополнительная поза для сюжета. */
export const crouch2 = (): Pose2 => {
  const hipY = 74, R = ik2(56, hipY - P.ankle, P.thigh, P.shin, 1);
  return {
    ...STAND, y: -hipY, torso: 42, head: 16,
    legN: { hip: -6, knee: 100, foot: 60 }, legF: { hip: R.upper, knee: R.lower, foot: 0 },
    armN: { sh: -60, el: -8, wr: 0 }, armF: { sh: -52, el: -14, wr: 0 }, face: { ...F, brow: -0.1 },
  };
};
