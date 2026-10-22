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
  nominatimSearchUrl, nominatimReverseUrl, photonSearchUrl, parseNominatim, parsePhoton, reverseLabel,
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

async function geocode(q) {
  try {
    const found = parseNominatim(await getJson(nominatimSearchUrl(q), 4500));
    if (found.length) return found;
  } catch (e) { /* попробуем запасной */ }
  try {
    return parsePhoton(await getJson(photonSearchUrl(q), 3500));
  } catch (e) { return []; }
}

export default async (req) => {
  const sp = new URL(req.url).searchParams;
  try {
    const q = (sp.get("q") || "").trim().slice(0, 160);
    if (q) {
      if (q.length < 3) return json({ ok: false, error: "short" }, 400);
      const key = `geo:${q.toLowerCase().replace(/\s+/g, " ")}`;
      const results = await cached(key, GEO_TTL, async () => { const found = await geocode(q); return found.length ? found : null; });
      return json({ ok: true, results: results || [] }, 200, { "Cache-Control": "public, max-age=3600" });
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
      const elements = await overpassRace(OVERPASS_SERVER, buildQuery(kind, gl, gn, r, 8), { timeoutMs: 8800, headers: { "User-Agent": UA, Accept: "application/json" } });
      return kind === "run" ? shapeRun(elements) : shapeGym(elements);
    });
    return json({ ok: true, kind, r, items: nearestFirst(items, { lat, lon }, r) }, 200, { "Cache-Control": "public, max-age=600" });
  } catch (e) {
    console.error("places:", e?.message || e);
    return json({ ok: false, error: "upstream", detail: String(e?.message || "").slice(0, 80) }, 502);
  }
};

export const config = { path: "/api/places", method: "GET" };
