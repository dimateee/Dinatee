import confetti from "canvas-confetti";

// Конфетти рисуются в отдельном потоке (useWorker), чтобы не тормозить интерфейс;
// частиц немного — на телефоне этого хватает для праздника
const fire = confetti.create(undefined, { resize: true, useWorker: true });

export function celebrate(power = 1) {
  const colors = ["#3d6bff", "#6d4dff", "#ffb020", "#1fbf75", "#ff5468"];
  fire({ particleCount: Math.round(60 * power), spread: 70, origin: { y: 0.65 }, colors, ticks: 150, disableForReducedMotion: true });
  if (power > 1) {
    setTimeout(() => fire({ particleCount: 35, angle: 60, spread: 55, origin: { x: 0 }, colors, ticks: 150, disableForReducedMotion: true }), 200);
    setTimeout(() => fire({ particleCount: 35, angle: 120, spread: 55, origin: { x: 1 }, colors, ticks: 150, disableForReducedMotion: true }), 350);
  }
}
