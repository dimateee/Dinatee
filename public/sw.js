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

// Если сеть не ответила за NAV_TIMEOUT_MS (мобильный интернет «висит»), показываем сохранённую копию,
// а не пустой экран. Ответ, пришедший позже, всё равно кладём в кеш — в следующий раз откроется свежая версия.
const NAV_TIMEOUT_MS = 7000;
async function networkFirstPage(req) {
  const network = fetch(req).then((res) => {
    // Ответ-редирект нельзя потом отдать на переход по странице — такие не кладём
    if (res.ok && res.type === "basic" && !res.redirected) {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(PAGE, copy)).catch(() => {});
    }
    return res;
  });
  network.catch(() => {}); // если отдали копию, а сеть потом упала — не шумим в консоли
  try {
    return await Promise.race([
      network,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAV_TIMEOUT_MS)),
    ]);
  } catch (e) {
    const cached = await caches.match(PAGE);
    if (cached) return cached;
    // Копии нет, но запрос ещё идёт — даём ему шанс, вдруг сеть просто медленная
    if (e?.message === "timeout") {
      try { return await network; } catch (e2) { /* сети нет совсем */ }
    }
    return offlinePage();
  }
}

// Понятный экран вместо «Нет связи»: что случилось, что попробовать, и сам обновится, когда сеть вернётся
function offlinePage() {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#050607"><title>RITM — нет соединения</title>
<style>
html,body{margin:0;height:100%;background:#050607;color:#F5F7F2;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{min-height:100%;display:flex;flex-direction:column;justify-content:center;padding:32px 22px;max-width:520px;margin:0 auto;box-sizing:border-box}
.mark{display:flex;align-items:flex-end;gap:4px;height:34px;margin-bottom:26px}.mark span{width:7px;border-radius:7px;background:linear-gradient(135deg,#D4FF5C,#38E0C8)}
h1{font-size:30px;line-height:1.1;margin:0 0 12px;letter-spacing:-.01em}p{color:#A1A7A0;margin:0 0 10px}
ul{color:#A1A7A0;padding-left:20px;margin:6px 0 22px}li{margin:4px 0}
button{appearance:none;border:0;border-radius:999px;background:#C6FF3D;color:#0A0B0D;font:600 16px system-ui,sans-serif;min-height:52px;padding:0 26px;cursor:pointer;align-self:flex-start}
small{display:block;margin-top:16px;color:#6f756e}
</style></head><body><main>
<div class="mark" aria-hidden="true"><span style="height:55%"></span><span style="height:100%"></span><span style="height:72%"></span><span style="height:38%"></span></div>
<h1>Не удаётся связаться с RITM</h1>
<p>Телефон не получил ответ от сервера. Обычно дело в соединении:</p>
<ul><li>проверь, что интернет включён;</li><li>если ты на мобильном интернете — попробуй Wi‑Fi: некоторые операторы сейчас ограничивают доступ к сайтам;</li><li>подожди минуту и нажми «Попробовать снова».</li></ul>
<button type="button" onclick="location.reload()">Попробовать снова</button>
<small>Страница обновится сама, как только связь появится.</small>
</main><script>addEventListener("online",function(){location.reload()});setInterval(function(){fetch("/?ping="+Date.now(),{method:"HEAD",cache:"no-store"}).then(function(r){if(r.ok)location.reload()}).catch(function(){})},15000);</script></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
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
