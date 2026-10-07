// Яндекс Метрика: посещения и цели воронки «сайт → анкета → первая тренировка → Pro».
// Номер счётчика задаётся переменной VITE_YM_ID в Netlify (см. .env.example). Пока она пустая,
// здесь ничего не грузится и никуда не отправляется — сайт работает как раньше.
// Вебвизор (запись действий на экране) выключен намеренно: в тренировках и питании есть личные данные.
const YM_ID = Number(import.meta.env.VITE_YM_ID) || 0;
let started = false;

export function initAnalytics() {
  if (!YM_ID || started || typeof window === "undefined") return;
  started = true;
  try {
    window.ym = window.ym || function ymQueue() { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://mc.yandex.ru/metrika/tag.js";
    document.head.appendChild(s);
    window.ym(YM_ID, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  } catch (e) { /* аналитика никогда не должна ломать приложение */ }
}

// Цель в Метрике. Имена целей те же, что надо завести в интерфейсе Метрики: Настройки → Цели →
// «JavaScript-событие» (список — в README, раздел «Аналитика»).
export function goal(name, params) {
  if (!YM_ID) return;
  try { window.ym?.(YM_ID, "reachGoal", name, params); } catch (e) { /* без аналитики — так без аналитики */ }
}

// Цель, которая считается один раз на этом устройстве (например, «первая тренировка»)
export function goalOnce(name, params) {
  if (!YM_ID) return;
  const key = `ritm-goal-${name}`;
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) { /* приватный режим */ }
  goal(name, params);
}
