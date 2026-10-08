// Веб-версия RITM: сайт и приложение, установленное с сайта (PWA) — Android через «Установить»,
// iPhone через «На экран „Домой“». Здесь всё, что нужно только вне Telegram:
// вход через бота, сессия, установка приложения, сервис-воркер и ожидающий платёж.
import { useEffect, useLayoutEffect, useState } from "react";

/* ============ Где запущено ============ */
// Внутри Telegram скрипт telegram-web-app.js отдаёт подписанные initData. На обычном сайте
// window.Telegram.WebApp тоже существует (скрипт подключён в index.html), но initData пустой —
// поэтому «мы в Telegram» определяем именно по initData, а не по наличию объекта.
export const inTelegram = () => typeof window !== "undefined" && !!window.Telegram?.WebApp?.initData;
export const tgApp = () => (inTelegram() ? window.Telegram.WebApp : null);

export const isStandaloneDisplay = () => {
  if (typeof window === "undefined") return false;
  try { if (window.matchMedia("(display-mode: standalone)").matches) return true; } catch (e) { /* старый браузер */ }
  return window.navigator.standalone === true; // Safari на iPhone
};
export const isIOS = () => typeof navigator !== "undefined"
  && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const isAndroid = () => typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
// На iPhone добавить на экран «Домой» можно из Safari (и с iOS 16.4 — из Chrome/Edge через «Поделиться»).
// Во встроенных браузерах (Telegram, Instagram, VK) пункта нет — подсказываем открыть в Safari.
export const isInAppBrowser = () => typeof navigator !== "undefined" && /(FBAN|FBAV|Instagram|Telegram|VKClient|Line\/|MicroMessenger)/i.test(navigator.userAgent);

// Ссылка на APK для Android (по желанию). Собирается из сайта через pwabuilder.com — см. README,
// раздел «Сайт и приложение». Пока пусто — на Android предлагается обычная установка из браузера.
export const ANDROID_APK_URL = import.meta.env.VITE_ANDROID_APK_URL || "";

/* ============ Сессия сайта ============ */
const SESSION_KEY = "ritm-web-session";
const GUEST_KEY = "ritm-web-guest";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* приватный режим */ } },
};

export function readSession() {
  try {
    const s = JSON.parse(store.get(SESSION_KEY) || "null");
    if (!s?.token || !s?.user?.id) return null;
    return s;
  } catch (e) { return null; }
}
export function saveSession(token, user) {
  store.set(SESSION_KEY, JSON.stringify({ token, user: { id: user.id, first_name: user.first_name || "", username: user.username || "" }, at: Date.now() }));
  store.del(GUEST_KEY);
}
export const clearSession = () => store.del(SESSION_KEY);
export const isGuest = () => store.get(GUEST_KEY) === "1";
export const setGuest = (on) => (on ? store.set(GUEST_KEY, "1") : store.del(GUEST_KEY));

/* ============ Вход через Telegram-бота ============ */
// Сервер создаёт одноразовую заявку и ссылку t.me/<бот>?start=login_<код>. Человек жмёт «Старт»
// и «Подтвердить вход» в боте, сайт тем временем опрашивает сервер и получает сессию.
// Заявку создаём заранее, чтобы кнопка «Войти» была обычной ссылкой — так её не заблокирует
// ни один браузер (window.open после await часто блокируется как всплывающее окно).
export async function startTelegramLogin() {
  const r = await fetch("/api/auth-start", { method: "POST" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.botUrl) throw new Error(d.error || "auth_start_failed");
  return d; // { token, secret, botUrl, bot, expiresAt }
}
export async function pollTelegramLogin(token, secret) {
  const r = await fetch("/api/auth-poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, secret }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "auth_poll_failed");
  return d; // { status, session?, user? }
}

/* ============ Платёж, который ещё не подтвердился ============ */
// После оплаты по СБП человек может вернуться на сайт уже после перезагрузки страницы
// (или вообще из другого окна) — запоминаем платёж и проверяем его при следующем запуске.
const PENDING_TX_KEY = "ritm-pending-tx";
export const savePendingTx = (id) => store.set(PENDING_TX_KEY, JSON.stringify({ id, at: Date.now() }));
export const clearPendingTx = () => store.del(PENDING_TX_KEY);
export function readPendingTx() {
  try {
    const p = JSON.parse(store.get(PENDING_TX_KEY) || "null");
    if (!p?.id || Date.now() - p.at > 24 * 60 * 60 * 1000) return null;
    return p.id;
  } catch (e) { return null; }
}

/* ============ Установка приложения ============ */
// Chrome/Edge/Samsung Internet на Android и компьютере присылают beforeinstallprompt — его
// нужно перехватить как можно раньше (этот модуль подключается в main.jsx до всего остального).
let deferredPrompt = null;
let installed = false;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; notify(); });
  window.addEventListener("appinstalled", () => { installed = true; deferredPrompt = null; notify(); });
}

// До первого кадра в браузере возвращает нейтральные значения — такие же, как при отрисовке
// лендинга на сервере, чтобы готовый HTML совпал и React «оживил» страницу без перерисовки.
// Сразу после этого (ещё до показа кадра) подставляются настоящие значения устройства.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
export function useInstall() {
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);
  useIsoLayoutEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const fn = () => force((x) => x + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  const standalone = mounted && isStandaloneDisplay();
  return {
    standalone,
    installed: mounted && (installed || standalone),
    canPrompt: mounted && !!deferredPrompt && !standalone,
    ios: mounted && isIOS(),
    android: mounted && isAndroid(),
    inApp: mounted && isInAppBrowser(),
    async prompt() {
      if (!deferredPrompt) return "unavailable";
      const e = deferredPrompt;
      deferredPrompt = null;
      notify();
      try {
        await e.prompt();
        const choice = await e.userChoice;
        return choice?.outcome || "dismissed";
      } catch (err) { return "dismissed"; }
    },
  };
}

/* ============ Сервис-воркер ============ */
// Только на сайте: внутри Telegram и в нативных сборках кеширование не нужно и может мешать обновлениям.
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (inTelegram() || window.RITM_ELECTRON || window.Capacitor?.isNativePlatform?.()) return;
  if (location.hostname === "localhost" && !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* без офлайна — сайт всё равно работает */ });
  });
}
