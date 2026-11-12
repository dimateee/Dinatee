// Ходьба для рига серии «66 ДНЕЙ»: 12 поз «на двойках» (24 кадра на 2 шага), стопы ведёт IK —
// в опоре точка контакта неподвижна в мире (перекат пятка → стопа → носок).
import { P, Pose2, STAND, Face, Hold } from "./Person";
import { easeInOut, ik2, lerp, onTwos } from "../rig/geom";

export type Gait2 = { period: number; stride: number; stance: number; hipAboveAnkle: number; bob: number; lift: number; lean: number; arm: number };
export const WALK2: Gait2 = { period: 24, stride: 140, stance: 0.6, hipAboveAnkle: 120, bob: 2.5, lift: 15, lean: 3, arm: 20 };
export const RUN2: Gait2 = { period: 16, stride: 250, stance: 0.36, hipAboveAnkle: 114, bob: 5, lift: 30, lean: 9, arm: 34 };

const HEEL = { x: -9, y: P.ankle }, TOE = { x: 25, y: P.ankle };
const rot = (p: { x: number; y: number }, a: number) => {
  const r = (a * Math.PI) / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
};
const stanceAt = (u: number, g: Gait2, hipY: number) => {
  const half = (g.stride * g.stance) / 2;
  const relX = lerp(half, -half, u);
  let ang = 0, piv = HEEL, cx = relX;
  if (u < 0.12) ang = lerp(-10, 0, easeInOut(u / 0.12));
  else if (u > 0.78) { ang = lerp(0, 26, easeInOut((u - 0.78) / 0.22)); piv = TOE; cx = relX + (TOE.x - HEEL.x); }
  const v = rot(piv, ang);
  return { ankle: { x: cx - v.x, y: hipY - v.y }, ang };
};
const track = (q: number, g: Gait2, hipY: number) => {
  if (q < g.stance) return stanceAt(q / g.stance, g, hipY);
  const u = (q - g.stance) / (1 - g.stance), e = easeInOut(u);
  const A = stanceAt(1, g, hipY), B = stanceAt(0, g, hipY);
  return { ankle: { x: lerp(A.ankle.x, B.ankle.x, e), y: lerp(A.ankle.y, B.ankle.y, e) - Math.sin(Math.PI * u) * g.lift }, ang: lerp(A.ang, B.ang, e) };
};

export const gait2 = (frame: number, g: Gait2, o: { face?: Partial<Face>; holdN?: Hold; holdF?: Hold; twos?: boolean } = {}): Pose2 => {
  const f = o.twos === false ? frame : onTwos(frame);
  const p = (f / g.period) % 1;
  const peak = g === RUN2 ? g.stance + (0.5 - g.stance) / 2 : g.stance / 2;
  const bob = g.bob * Math.cos(4 * Math.PI * (p - peak));
  const hipY = g.hipAboveAnkle + bob + P.ankle;
  const L = track(p, g, hipY), R = track((p + 0.5) % 1, g, hipY);
  const leg = (t: typeof L, dx: number) => { const k = ik2(t.ankle.x - dx, t.ankle.y, P.thigh, P.shin, 1); return { hip: k.upper, knee: k.lower, foot: t.ang }; };
  const sw = Math.cos(2 * Math.PI * p);
  const run = g === RUN2;
  return {
    ...STAND, x: (f / g.period) * g.stride, y: -hipY, torso: g.lean + bob * 0.2, head: -g.lean * 0.5,
    legN: leg(L, 3), legF: leg(R, -3),
    armN: { sh: g.arm * sw - g.lean, el: run ? -80 : -14, wr: 0 }, armF: { sh: -g.arm * sw - g.lean, el: run ? -80 : -12, wr: 0 },
    face: { ...STAND.face, ...o.face }, holdN: o.holdN ?? null, holdF: o.holdF ?? null,
  };
};
