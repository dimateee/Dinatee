// Сервис-воркер сайта RITM: быстрый запуск установленного приложения и открытие без интернета.
// Регистрируется только на сайте (см. registerServiceWorker в src/web.js) — не в Telegram и не в нативных сборках.
//
// - Страницы (/ и /app): сначала сеть, без сети — сохранённая копия. Так после деплоя всегда открывается
//   свежая версия, а без интернета приложение всё равно запускается с данными с устройства.
// - /assets/*: у файлов хеш в имени, они не меняются — берём из кеша, при промахе качаем и кладём.
// - Шрифты и иконки: из кеша, в фоне обновляем. Фото упражнений: из кеша после первого показа.
// - /api/* не трогаем вообще: оплата, вход, ИИ и синхронизация всегда идут в сеть.
const SHELL = "ritm-shell-v4";
const ASSETS = "ritm-assets-v4";
const STATIC = "ritm-static-v4";
// Страницу храним под ключом "/": /, /app и /index.html — одна и та же index.html
const PAGE = "/";
const KEEP = [SHELL, ASSETS, STATIC];
const MAX_ASSETS = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll([PAGE, "/manifest.webmanifest", "/icons/icon-192.png"]))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("ritm-") && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirstPage(req) {
  try {
    const res = await fetch(req);
    // Ответ-редирект нельзя потом отдать на переход по странице — такие не кладём
    if (res.ok && res.type === "basic" && !res.redirected) {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(PAGE, copy)).catch(() => {});
    }
    return res;
  } catch (e) {
    const cached = await caches.match(PAGE);
    return cached || new Response("<h1>Нет связи</h1><p>Подключись к интернету и открой RITM снова.</p>", { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(req, cacheName, max) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const copy = res.clone();
    caches.open(cacheName).then((c) => c.put(req, copy)).then(() => max && trim(cacheName, max)).catch(() => {});
  }
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cached = await caches.match(req);
  const update = fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") {
      const copy = res.clone();
      caches.open(cacheName).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  }).catch(() => cached);
  return cached || update;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    const p = url.pathname;
    if (p === "/" || p === "/index.html" || p === "/app" || p.startsWith("/app/")) event.respondWith(networkFirstPage(req));
    return;
  }
  if (sameOrigin && url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(req, ASSETS, MAX_ASSETS));
    return;
  }
  // Фото техники упражнений (public/exercises) и шрифты (public/fonts) не меняются —
  // после первого показа доступны и без сети
  if (sameOrigin && (url.pathname.startsWith("/exercises/") || url.pathname.startsWith("/fonts/"))) {
    event.respondWith(cacheFirst(req, STATIC, 0));
    return;
  }
  if (sameOrigin && (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest")) {
    event.respondWith(staleWhileRevalidate(req, STATIC));
  }
});
