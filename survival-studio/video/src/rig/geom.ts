// Геометрия ригов: двухзвенная IK и плавности.
export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));

/**
 * Двухзвенная IK в координатах SVG (y вниз). Углы — от вертикали вниз, по часовой
 * стрелке положительные (как rotate() в SVG). bend = +1 — колено вперёд (+x),
 * -1 — назад (задние лапы собаки, локти).
 */
export const ik2 = (dx: number, dy: number, l1: number, l2: number, bend: 1 | -1 = 1) => {
  const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const base = Math.atan2(dx, dy); // угол цели от вертикали вниз (против часовой при dx>0)
  const a1 = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a2 = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  // В SVG rotate(+θ) поворачивает вектор (0,1) к -x, поэтому знак минус.
  const upper = -(base + bend * a1);
  const lower = bend * (Math.PI - a2); // относительный угол колена
  return { upper: deg(upper), lower: deg(lower) };
};

/** Ступенчатое время «на двойках»: анимация обновляется каждые `hold` кадров. */
export const onTwos = (frame: number, hold = 2) => Math.floor(frame / hold) * hold;
