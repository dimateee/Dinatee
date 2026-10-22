// Netlify: /api/places — залы, площадки и места для бега рядом с точкой, поиск адреса.
//
//   GET /api/places?q=Москва, Тверская 7                → { ok, results: [{ label, lat, lon }] }  (адрес → точка)
//   GET /api/places?rlat=55.75&rlon=37.61               → { ok, label }                           (точка → адрес)
//   GET /api/places?kind=gym&lat=55.75&lon=37.61&r=2000 → { ok, items: [...] }   (залы и уличные площадки)
//   GET /api/places?kind=run&lat=…&lon=…&r=3000         → { ok, items: [...] }   (парки, стадионы, дорожки, лес)
//
// Данные — OpenStreetMap: адреса через Nominatim (запасной — Photon), места через Overpass API. Запрос и разбор
// ответа — в src/placesShape.js (тот же код использует приложение, если этот сервер не ответил).
// Публичные серверы карт часто перегружены, поэтому спрашиваем два зеркала сразу и берём первый ответ, а всё
// найденное кешируем в Netlify Blobs (места — неделю на сетке ~110 м, адреса — месяц) и представляемся User-Agent.
import { getStore } from "@netlify/blobs";
import {
  OVERPASS_SERVER, buildQuery, overpassRace, shapeGym, shapeRun, nearestFirst,
  nominatimReverseUrl, reverseLabel, geocodeSmart, parseAddress,
} from "../../src/placesShape.js";

const UA = "RITM/1.0 (ritmru.ru; Telegram Mini App; contact: @doltiii)";
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extra } });
const cache = () => globalThis.__ritmPlacesStore || getStore("ritm-places");
const DAY = 86400000;
const PLACES_TTL = 7 * DAY;
const GEO_TTL = 30 * DAY;

async function getJson(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal });
    if (!r.ok) throw new Error(`http_${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// Пустой результат не кешируем: это может быть и временный сбой сервиса
async function cached(key, ttl, produce) {
  const store = cache();
  const hit = await store.get(key, { type: "json" }).catch(() => null);
  if (hit && Date.now() - (hit.at || 0) < ttl) return hit.data;
  const data = await produce();
  if (data) await store.setJSON(key, { at: Date.now(), data }).catch(() => {});
  return data;
}


export default async (req) => {
  const sp = new URL(req.url).searchParams;
  try {
    const q = (sp.get("q") || "").trim().slice(0, 160);
    if (q) {
      if (q.length < 3) return json({ ok: false, error: "short" }, 400);
      // «18к1» → «18 к1», сокращения → полные слова, несколько вариантов запроса, дома выше улиц (src/placesShape.js).
      // В кеш кладём только удачный ответ: нашёлся дом или в запросе дома не было. Улица вместо дома может быть
      // временным сбоем Nominatim — такое не запоминаем на месяц.
      const key = `geo2:${q.toLowerCase().replace(/\s+/g, " ")}`;
      const store = cache();
      const hit = await store.get(key, { type: "json" }).catch(() => null);
      if (hit && Date.now() - (hit.at || 0) < GEO_TTL) return json({ ok: true, results: hit.data }, 200, { "Cache-Control": "public, max-age=3600" });
      const results = await geocodeSmart(q, (url) => getJson(url, 4000), { budgetMs: 8500 });
      const wantsHouse = !!parseAddress(q).house;
      if (results.length && (!wantsHouse || results.some((x) => x.house))) await store.setJSON(key, { at: Date.now(), data: results }).catch(() => {});
      return json({ ok: true, results }, 200, { "Cache-Control": "no-store" });
    }

    const rlat = Number(sp.get("rlat"));
    const rlon = Number(sp.get("rlon"));
    if (sp.has("rlat")) {
      if (!Number.isFinite(rlat) || !Number.isFinite(rlon)) return json({ ok: false, error: "coords" }, 400);
      const key = `rev:${rlat.toFixed(4)}:${rlon.toFixed(4)}`;
      const label = await cached(key, GEO_TTL, async () => reverseLabel(await getJson(nominatimReverseUrl(rlat, rlon), 4500).catch(() => null)) || null);
      return json({ ok: true, label: label || "" }, 200, { "Cache-Control": "public, max-age=86400" });
    }

    const kind = sp.get("kind") === "run" ? "run" : "gym";
    const lat = Number(sp.get("lat"));
    const lon = Number(sp.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ ok: false, error: "coords" }, 400);
    const r = Math.max(500, Math.min(5000, Math.round(Number(sp.get("r")) || 2000)));
    // Сетка ~110 м: соседи по дому получают один и тот же ответ из кеша
    const gl = Number(lat.toFixed(3));
    const gn = Number(lon.toFixed(3));
    const items = await cached(`v2:${kind}:${gl}:${gn}:${r}`, PLACES_TTL, async () => {
      const elements = await overpassRace(OVERPASS_SERVER, buildQuery(kind, gl, gn, r, 8), { timeoutMs: 8800, batchMs: 5200, headers: { "User-Agent": UA, Accept: "application/json" } });
      return kind === "run" ? shapeRun(elements) : shapeGym(elements);
    });
    return json({ ok: true, kind, r, items: nearestFirst(items, { lat, lon }, r) }, 200, { "Cache-Control": "public, max-age=600" });
  } catch (e) {
    console.error("places:", e?.message || e);
    return json({ ok: false, error: "upstream", detail: String(e?.message || "").slice(0, 80) }, 502);
  }
};

export const config = { path: "/api/places", method: "GET" };
