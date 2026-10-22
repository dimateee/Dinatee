// «Рядом»: залы, уличные площадки и места для бега около дома. Данные — /api/places (OpenStreetMap),
// маршрут и карточка места — в Яндекс Картах.

import {
  OVERPASS_DEVICE, buildQuery, overpassRace, shapeGym, shapeRun, nearestFirst,
  nominatimSearchUrl, nominatimReverseUrl, photonSearchUrl, parseNominatim, parsePhoton, reverseLabel,
} from "./placesShape.js";

export const NEAR_RADII = [1000, 2000, 3000, 5000];

async function timedJson(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    const data = await r.json().catch(() => null);
    if (!r.ok && !data) throw new Error(`http_${r.status}`);
    return data;
  } catch (e) {
    throw new Error(e?.name === "AbortError" ? "timeout" : e?.message || "network");
  } finally {
    clearTimeout(timer);
  }
}

// Места рядом. Сначала свой сервер — у него кеш, и для уже искавшегося района ответ мгновенный.
// Если сервер за 4 секунды не ответил (или ответил ошибкой), телефон параллельно спрашивает карту
// напрямую — у телефона свой адрес в интернете, его не ограничивают из-за чужих запросов, и нет
// 10-секундного лимита серверной функции. Берём то, что пришло первым.
export function loadPlaces(apiUrl, { kind, lat, lon, r }, onStage) {
  let startDevice;
  const gate = new Promise((res) => { startDevice = res; });
  const timer = setTimeout(() => startDevice(), 4000);
  let settled = false;
  const server = timedJson(apiUrl(`/api/places?kind=${kind}&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&r=${r}`), 11000)
    .then((d) => { if (!d?.ok) throw new Error(d?.detail || d?.error || "upstream"); return { items: d.items || [], via: "server" }; })
    .catch((e) => { startDevice(); throw new Error(`server:${e.message}`); });
  const device = gate.then(async () => {
    if (settled) throw new Error("not_needed");
    onStage?.("device");
    try {
      const elements = await overpassRace(OVERPASS_DEVICE, buildQuery(kind, lat, lon, r, 15), { timeoutMs: 16000 });
      const shaped = kind === "run" ? shapeRun(elements) : shapeGym(elements);
      return { items: nearestFirst(shaped, { lat, lon }, r), via: "device" };
    } catch (e) { throw new Error(`device:${e.message}`); }
  });
  return Promise.any([server, device])
    .then((res) => { settled = true; clearTimeout(timer); return res; })
    .catch((e) => { clearTimeout(timer); throw new Error((e?.errors || [e]).map((x) => x?.message).join(" ")); });
}

// Адрес → точка: свой сервер, потом карта напрямую с телефона
export async function findAddress(apiUrl, q) {
  try {
    const d = await timedJson(apiUrl(`/api/places?q=${encodeURIComponent(q)}`), 9000);
    if (d?.ok && d.results?.length) return d.results;
  } catch (e) { /* дальше напрямую */ }
  try {
    const found = parseNominatim(await timedJson(nominatimSearchUrl(q), 7000));
    if (found.length) return found;
  } catch (e) { /* запасной */ }
  try { return parsePhoton(await timedJson(photonSearchUrl(q), 6000)); } catch (e) { return []; }
}

// Точка → короткий адрес для подписи «Где я сейчас»; не получилось — пустая строка
export async function addressOf(apiUrl, lat, lon) {
  try {
    const d = await timedJson(apiUrl(`/api/places?rlat=${lat.toFixed(5)}&rlon=${lon.toFixed(5)}`), 6000);
    if (d?.ok && d.label) return d.label;
  } catch (e) { /* дальше напрямую */ }
  try { return reverseLabel(await timedJson(nominatimReverseUrl(lat, lon), 6000)); } catch (e) { return ""; }
}

// Карта Яндекса без ключа (виджет для сайтов): ты — красная метка, места — с номерами, как в списке
const PIN = { gym: "bl", sport: "or", outdoor: "gn", park: "gn", forest: "dg", reserve: "dg", stadium: "or", track: "or" };
export function yandexMapWidget(here, items, r) {
  const z = r <= 1000 ? 15 : r <= 2000 ? 14 : r <= 3000 ? 13 : 12;
  const f = (x) => x.toFixed(6);
  const pts = items.slice(0, 30).map((it, i) => `${f(it.lon)},${f(it.lat)},pm2${PIN[it.kind] || "bl"}m${i + 1}`);
  pts.push(`${f(here.lon)},${f(here.lat)},pm2rdm`);
  return `https://yandex.ru/map-widget/v1/?ll=${f(here.lon)},${f(here.lat)}&z=${z}&pt=${pts.join("~")}`;
}
const LOC_KEY = "ritm-near-location";

// Координаты дома храним только на этом устройстве — в синхронизацию (сервер, облако Telegram) не уходят
export function readSavedLocation() {
  try {
    const v = JSON.parse(localStorage.getItem(LOC_KEY) || "null");
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lon) ? v : null;
  } catch (e) { return null; }
}
export function saveLocation(loc) {
  try { localStorage.setItem(LOC_KEY, JSON.stringify({ lat: loc.lat, lon: loc.lon, label: loc.label || "", at: Date.now() })); } catch (e) { /* приватный режим */ }
}

// Где я: в Telegram — его LocationManager (Bot API 8.0, сам спрашивает разрешение), иначе — браузерное API.
// Ошибки: denied (запрещено в браузере), denied_tg (запрещено в Telegram — можно открыть настройки), unavailable, timeout.
export function getLocation(tg) {
  return new Promise((resolve, reject) => {
    const viaBrowser = () => {
      if (typeof navigator === "undefined" || !navigator.geolocation) { reject(new Error("unavailable")); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => reject(new Error(err?.code === 1 ? "denied" : err?.code === 3 ? "timeout" : "unavailable")),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
      );
    };
    const lm = tg?.LocationManager;
    if (!lm || typeof lm.init !== "function" || typeof lm.getLocation !== "function") { viaBrowser(); return; }
    try {
      const ask = () => {
        if (!lm.isLocationAvailable) { viaBrowser(); return; }
        lm.getLocation((data) => {
          if (data && Number.isFinite(data.latitude)) resolve({ lat: data.latitude, lon: data.longitude });
          else if (lm.isAccessRequested && !lm.isAccessGranted) reject(new Error("denied_tg"));
          else viaBrowser();
        });
      };
      if (lm.isInited) ask(); else lm.init(ask);
    } catch (e) { viaBrowser(); }
  });
}
export function openLocationSettings(tg) {
  try { tg?.LocationManager?.openSettings?.(); return true; } catch (e) { return false; }
}

export const distLabel = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} м` : `${(m / 1000).toFixed(1).replace(".", ",")} км`);
export const walkLabel = (m) => {
  const min = Math.max(1, Math.round(m / 75)); // ~4,5 км/ч
  return min < 60 ? `${min} мин пешком` : `${Math.floor(min / 60)} ч ${min % 60} мин пешком`;
};
export const kmLabel = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} км` : `${m} м`);

// Яндекс Карты. rtext — маршрут «откуда~куда», rtt — пешком (pd), на транспорте (mt), на машине (auto).
// Без «откуда» Яндекс сам подставит текущее местоположение.
export function yandexRoute(to, from, mode = "pd") {
  const start = from ? `${from.lat.toFixed(6)},${from.lon.toFixed(6)}` : "";
  return `https://yandex.ru/maps/?rtext=${start}~${to.lat.toFixed(6)},${to.lon.toFixed(6)}&rtt=${mode}`;
}
// Карточка места: поиск по названию рядом с точкой — в ней у Яндекса цены, отзывы и фото
export function yandexPlace(item) {
  const text = item.named ? `${item.name}${item.address ? ", " + item.address : ""}` : item.name;
  return `https://yandex.ru/maps/?text=${encodeURIComponent(text)}&ll=${item.lon.toFixed(6)},${item.lat.toFixed(6)}&z=17`;
}
export function yandexSearch(text, at) {
  const ll = at ? `&ll=${at.lon.toFixed(6)},${at.lat.toFixed(6)}&z=14` : "";
  return `https://yandex.ru/maps/?text=${encodeURIComponent(text)}${ll}`;
}

export const PRICE_TIERS = {
  free: { label: "Бесплатно", tone: "good" },
  low: { label: "Эконом · ≈ 1,5–3 тыс. ₽/мес", tone: "good" },
  mid: { label: "Средний · ≈ 3–6 тыс. ₽/мес", tone: "mid" },
  high: { label: "Премиум · от 7 тыс. ₽/мес", tone: "high" },
  city: { label: "Городской — обычно дешевле сетевых", tone: "good" },
  unknown: { label: "Цену уточни в карточке", tone: "none" },
};

export const GYM_FILTERS = [["all", "Все"], ["gym", "Фитнес и залы"], ["outdoor", "Уличные площадки"], ["sport", "Спорткомплексы"]];
export const RUN_FILTERS = [["all", "Все"], ["green", "Парки и лес"], ["track", "Стадионы и дорожки"]];
export const matchesFilter = (item, filter) => filter === "all"
  || (filter === "green" ? ["park", "forest", "reserve"].includes(item.kind) : filter === "track" ? ["stadium", "track"].includes(item.kind) : item.kind === filter);

export const KIND_LABEL = {
  gym: "Фитнес-клуб, тренажёрный зал", sport: "Спорткомплекс", outdoor: "Уличная площадка",
  park: "Парк", stadium: "Стадион", track: "Беговая дорожка", reserve: "Природный парк", forest: "Лес",
};

const SURFACE = { asphalt: "асфальт", paved: "асфальт", tartan: "резиновое покрытие", rubber: "резиновое покрытие", grass: "трава", ground: "грунт", dirt: "грунт", gravel: "гравий", compacted: "утрамбованный грунт", artificial_turf: "искусственный газон", sand: "песок", concrete: "бетон" };
export const surfaceLabel = (s) => SURFACE[s] || "";

// Часы работы из OpenStreetMap («Mo-Fr 07:00-23:00; Sa,Su 09:00-22:00») — по-русски
const DAYS = { Mo: "Пн", Tu: "Вт", We: "Ср", Th: "Чт", Fr: "Пт", Sa: "Сб", Su: "Вс", PH: "праздники" };
export function hoursLabel(s) {
  if (!s) return "";
  if (/^24\/7$/.test(s.trim())) return "Круглосуточно";
  return s.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (d) => DAYS[d]).replace(/\boff\b/g, "выходной").replace(/;\s*/g, "; ").replace(/-/g, "–");
}

export const lapsWord = (n) => { const m = n % 100; if (m >= 11 && m <= 14) return "кругов"; const l = n % 10; return l === 1 ? "круг" : l >= 2 && l <= 4 ? "круга" : "кругов"; };
// Сколько кругов пробежать, чтобы набрать дистанцию
export function lapsFor(loopM, km) {
  if (!loopM || !km) return 0;
  return Math.max(1, Math.round((km * 1000) / loopM));
}
