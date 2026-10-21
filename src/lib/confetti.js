import confetti from "canvas-confetti";

export function celebrate(power = 1) {
  const colors = ["#3d6bff", "#6d4dff", "#ffb020", "#1fbf75", "#ff5468"];
  confetti({ particleCount: Math.round(90 * power), spread: 75, origin: { y: 0.65 }, colors, disableForReducedMotion: true });
  if (power > 1) {
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors }), 200);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors }), 350);
  }
}
