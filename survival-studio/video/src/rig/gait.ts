// Циклы ходьбы и бега героя. Стопа в опоре стоит на месте в мировых координатах:
// её смещение относительно таза за фазу опоры равно пути таза за то же время.
import { DIM, HeroPose, NEUTRAL, LegPose, Expr } from "./Hero";
import { clamp, easeInOut, ik2, lerp, onTwos } from "./geom";

export type GaitSpec = {
  period: number; // кадров на полный цикл (2 шага)
  stride: number; // путь таза за цикл, px
  stance: number; // доля опоры
  hipAboveAnkle: number; bob: number; lift: number;
  lean: number; armSwing: number; elbow: number; elbowSwing: number;
};

export const WALK: GaitSpec = {
  period: 24, stride: 150, stance: 0.6, hipAboveAnkle: 104, bob: 2.5, lift: 16,
  lean: 3, armSwing: 22, elbow: -18, elbowSwing: 10,
};
export const RUN: GaitSpec = {
  period: 16, stride: 280, stance: 0.36, hipAboveAnkle: 97, bob: 6, lift: 34,
  lean: 10, armSwing: 38, elbow: -82, elbowSwing: 14,
};

const HEEL = { x: -11, y: DIM.ankleH }; // точки подошвы относительно лодыжки
const TOE = { x: 28, y: DIM.ankleH };

const rot = (p: { x: number; y: number }, a: number) => {
  const r = (a * Math.PI) / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
};

/** Опорная фаза: лодыжка и угол стопы относительно таза, u ∈ [0,1]. */
const stanceAt = (u: number, g: GaitSpec, hipY: number) => {
  const half = (g.stride * g.stance) / 2;
  const relX = lerp(half, -half, u); // пятка уезжает назад относительно таза
  let footAngle = 0; let pivotLocal = HEEL; let contactX = relX;
  if (u < 0.12) footAngle = lerp(-12, 0, easeInOut(u / 0.12)); // перекат с пятки
  else if (u > 0.78) {
    footAngle = lerp(0, 28, easeInOut((u - 0.78) / 0.22)); // отрыв с носка
    pivotLocal = TOE; contactX = relX + (TOE.x - HEEL.x);
  }
  const v = rot(pivotLocal, footAngle);
  return { ankle: { x: contactX - v.x, y: hipY - v.y }, footAngle, contactX };
};

/** Лодыжка и угол стопы относительно таза для фазы ноги q ∈ [0,1). */
export const footTrack = (q: number, g: GaitSpec, hipY: number) => {
  if (q < g.stance) return stanceAt(q / g.stance, g, hipY);
  const u = (q - g.stance) / (1 - g.stance);
  const e = easeInOut(u);
  const from = stanceAt(1, g, hipY), to = stanceAt(0, g, hipY);
  return {
    ankle: { x: lerp(from.ankle.x, to.ankle.x, e), y: lerp(from.ankle.y, to.ankle.y, e) - Math.sin(Math.PI * u) * g.lift },
    footAngle: lerp(from.footAngle, to.footAngle, e),
    contactX: NaN,
  };
};

const legFrom = (ank: { x: number; y: number }, footAngle: number, hipOffsetX: number): LegPose => {
  const { upper, lower } = ik2(ank.x - hipOffsetX, ank.y, DIM.thigh, DIM.shin, 1);
  return { hip: upper, knee: lower, foot: footAngle };
};

export type GaitOpts = { expr?: Partial<Expr>; holdL?: HeroPose["holdL"]; holdR?: HeroPose["holdR"]; twos?: boolean };

/** Поза героя в кадре frame. x — мировая координата таза (движение вправо). */
export const heroGait = (frame: number, g: GaitSpec, o: GaitOpts = {}): HeroPose => {
  const f = o.twos === false ? frame : onTwos(frame);
  const p = (f / g.period) % 1;
  const qL = p, qR = (p + 0.5) % 1;
  // таз выше всего в середине опоры (ходьба) / в полёте (бег)
  const peak = g === RUN ? g.stance + (0.5 - g.stance) / 2 : g.stance / 2;
  const bob = g.bob * Math.cos(2 * Math.PI * 2 * (p - peak));
  const hipAbove = g.hipAboveAnkle + bob;
  const hipY = hipAbove + DIM.ankleH; // таз над землёй
  const a = footTrack(qL, g, hipY), b = footTrack(qR, g, hipY);
  const swing = Math.cos(2 * Math.PI * qL); // +1 когда левая нога впереди (удар пяткой)
  return {
    ...NEUTRAL,
    x: (f / g.period) * g.stride,
    y: -hipY,
    torso: g.lean + bob * 0.2,
    head: -g.lean * 0.6 - bob * 0.3,
    legL: legFrom(a.ankle, a.footAngle, 4),
    legR: legFrom(b.ankle, b.footAngle, -4),
    armL: { sh: g.armSwing * swing - g.lean, el: g.elbow - g.elbowSwing * clamp(-swing, 0, 1), wr: 0 },
    armR: { sh: -g.armSwing * swing - g.lean, el: g.elbow - g.elbowSwing * clamp(swing, 0, 1), wr: 0 },
    expr: { ...NEUTRAL.expr, ...o.expr },
    holdL: o.holdL ?? null, holdR: o.holdR ?? null,
  };
};

/** Мировая позиция лодыжек — для проверки «стопы не скользят». */
export const debugFeet = (frame: number, g: GaitSpec) => {
  const p = (frame / g.period) % 1;
  const peak = g === RUN ? g.stance + (0.5 - g.stance) / 2 : g.stance / 2;
  const hipY = g.hipAboveAnkle + g.bob * Math.cos(2 * Math.PI * 2 * (p - peak)) + DIM.ankleH;
  const x = (frame / g.period) * g.stride;
  return [p, (p + 0.5) % 1].map((q, i) => {
    const t = footTrack(q, g, hipY);
    return { leg: i ? "R" : "L", stance: q < g.stance, contactX: x + t.contactX, ankleY: hipY - t.ankle.y, angle: t.footAngle };
  });
};
