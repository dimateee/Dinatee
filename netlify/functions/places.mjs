// Netlify: /api/places — залы, площадки и места для бега рядом с точкой, поиск адреса.
//
//   GET /api/places?q=Москва, Тверская 7          → { ok, results: [{ label, lat, lon }] }  (поиск адреса)
//   GET /api/places?kind=gym&lat=55.75&lon=37.61&r=2000 → { ok, items: [...] }        (залы и уличные площадки)
//   GET /api/places?kind=run&lat=…&lon=…&r=3000         → { ok, items: [...] }        (парки, стадионы, дорожки, лес)
//
// Данные — OpenStreetMap: адреса через Nominatim (запасной — Photon), места через Overpass API
// (три зеркала, в том числе VK maps.mail.ru — оно ближе к российским пользователям). Ключи не нужны.
// Правила этих сервисов просят не нагружать их зря и представляться — поэтому ответы кешируются в
// Netlify Blobs (места — неделю на сетке ~110 м, адреса — месяц), а в запросах стоит User-Agent RITM.
// Цены у OSM почти никогда нет, поэтому для известных сетей фитнес-клубов показываем ценовой уровень
// (ориентир), а для остальных — «уточняй»; в приложении рядом кнопка карточки в Яндекс Картах.
import { getStore } from "@netlify/blobs";

const UA = "RITM/1.0 (ritmru.ru; Telegram Mini App; contact: @doltiii)";
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extra } });
const cache = () => globalThis.__ritmPlacesStore || getStore("ritm-places");
const DAY = 86400000;
const PLACES_TTL = 7 * DAY;
const GEO_TTL = 30 * DAY;

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Обычная функция Netlify живёт до 10 секунд — укладываемся с запасом, пробуя зеркала по очереди
async function fetchWithDeadline(url, opts, deadline, maxMs) {
  const left = deadline - Date.now();
  if (left < 1200) throw new Error("deadline");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.min(maxMs, left));
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cached(key, ttl, produce) {
  const store = cache();
  const hit = await store.get(key, { type: "json" }).catch(() => null);
  if (hit && Date.now() - (hit.at || 0) < ttl) return hit.data;
  const data = await produce();
  if (data) await store.setJSON(key, { at: Date.now(), data }).catch(() => {});
  return data;
}

/* ============ Адрес → координаты ============ */
const shortLabel = (parts) => parts.filter(Boolean).slice(0, 4).join(", ");

async function geocode(q, deadline) {
  const results = [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ru&accept-language=ru&addressdetails=1&q=${encodeURIComponent(q)}`;
    const r = await fetchWithDeadline(url, { headers: { "User-Agent": UA, Accept: "application/json" } }, deadline, 5000);
    if (r.ok) {
      for (const x of await r.json()) {
        const a = x.address || {};
        const street = [a.road || a.pedestrian || a.square, a.house_number].filter(Boolean).join(", ");
        const city = a.city || a.town || a.village || a.municipality || a.state;
        const label = shortLabel([x.name && x.name !== a.road ? x.name : "", street, a.suburb || a.city_district, city]) || x.display_name;
        results.push({ label, lat: Number(x.lat), lon: Number(x.lon) });
      }
    }
  } catch (e) { /* попробуем запасной */ }
  if (results.length) return results;
  try {
    const url = `https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(q)}`;
    const r = await fetchWithDeadline(url, { headers: { "User-Agent": UA, Accept: "application/json" } }, deadline, 4000);
    if (r.ok) {
      const data = await r.json();
      for (const f of data.features || []) {
        const p = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const street = [p.street, p.housenumber].filter(Boolean).join(", ");
        results.push({ label: shortLabel([p.name !== p.street ? p.name : "", street, p.district, p.city || p.state]), lat, lon });
      }
    }
  } catch (e) { /* нет ответа */ }
  return results;
}

/* ============ Места рядом ============ */
const QUERY = {
  gym: (lat, lon, r) => `[out:json][timeout:8];
(
  nwr["leisure"="fitness_centre"](around:${r},${lat},${lon});
  nwr["amenity"="gym"](around:${r},${lat},${lon});
  nwr["leisure"="sports_centre"]["sport"~"fitness|gym|bodybuilding|crossfit|weightlifting|powerlifting|multi|boxing|martial_arts|swimming"](around:${r},${lat},${lon});
  nwr["leisure"="fitness_station"](around:${r},${lat},${lon});
  nwr["leisure"="pitch"]["sport"~"fitness|workout|calisthenics|gymnastics"](around:${r},${lat},${lon});
)->.a;
node.a;out body;
way.a;out tags bb;
relation.a;out tags bb;`,
  run: (lat, lon, r) => `[out:json][timeout:8];
(
  way["leisure"="park"](around:${r},${lat},${lon});
  relation["leisure"="park"](around:${r},${lat},${lon});
  nwr["leisure"="stadium"](around:${r},${lat},${lon});
  nwr["leisure"="track"]["sport"~"running|athletics|jogging"](around:${r},${lat},${lon});
  way["leisure"="nature_reserve"](around:${r},${lat},${lon});
  relation["leisure"="nature_reserve"](around:${r},${lat},${lon});
  way["landuse"="forest"]["name"](around:${r},${lat},${lon});
  relation["landuse"="forest"]["name"](around:${r},${lat},${lon});
)->.a;
node.a;out body;
way.a;out tags bb;
relation.a;out tags bb;`,
};

async function overpass(query, deadline) {
  let lastError = "no_mirror";
  for (const url of OVERPASS) {
    try {
      const r = await fetchWithDeadline(url, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: `data=${encodeURIComponent(query)}`,
      }, deadline, 7000);
      if (!r.ok) { lastError = `http_${r.status}`; continue; }
      const data = await r.json();
      if (Array.isArray(data.elements)) return data.elements;
      lastError = "bad_json";
    } catch (e) {
      lastError = e?.message === "deadline" ? "deadline" : "network";
      if (lastError === "deadline") break;
    }
  }
  throw new Error(lastError);
}

const toRad = (d) => (d * Math.PI) / 180;
export function distanceM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function geometryOf(el) {
  if (el.type === "node" && Number.isFinite(el.lat)) return { lat: el.lat, lon: el.lon, w: 0, h: 0 };
  const b = el.bounds;
  if (b && Number.isFinite(b.minlat)) {
    const lat = (b.minlat + b.maxlat) / 2;
    return {
      lat, lon: (b.minlon + b.maxlon) / 2,
      w: (b.maxlon - b.minlon) * 111320 * Math.cos(toRad(lat)),
      h: (b.maxlat - b.minlat) * 110540,
    };
  }
  if (el.center) return { lat: el.center.lat, lon: el.center.lon, w: 0, h: 0 };
  return null;
}

// Ценовой уровень по названию сети — ориентир, точная цена у клуба
const CHAINS = [
  [/ddx/i, "low", "DDX Fitness"],
  [/spirit/i, "low", "Spirit. Fitness"],
  [/alex fitness|алекс фитнес/i, "low", "Alex Fitness"],
  [/fitness house|фитнес хаус/i, "low", "Fitness House"],
  [/зебра|zebra/i, "mid", "Зебра"],
  [/x-?fit|икс-?фит/i, "mid", "X-Fit"],
  [/территория фитнеса/i, "mid", "Территория фитнеса"],
  [/gold'?s gym/i, "mid", "Gold's Gym"],
  [/физкульт|fizkult/i, "mid", "Физкульт"],
  [/sportlife|спортлайф/i, "mid", "Sportlife"],
  [/orange fitness/i, "mid", "Orange Fitness"],
  [/world class|ворлд класс/i, "high", "World Class"],
  [/crocus fitness|крокус фитнес/i, "high", "Crocus Fitness"],
  [/encore/i, "high", "Encore Fitness"],
  [/ultra ?fitness/i, "high", "Ultra Fitness"],
];
const CITY = /мосспорт|гбу|гау|гку|муниципал|спортивная школа|спортшкола|сшор|дюсш|фок|физкультурно-оздоровительн|центр спорта/i;

function priceOf(tags, kind) {
  if (kind === "outdoor") return "free";
  if (tags.fee === "no") return "free";
  const text = [tags.brand, tags.name, tags.operator].filter(Boolean).join(" ");
  for (const [re, tier] of CHAINS) if (re.test(text)) return tier;
  if (CITY.test(text)) return "city";
  return "unknown";
}

const pickTags = (t) => {
  const out = {};
  const hours = t.opening_hours; if (hours) out.hours = String(hours).slice(0, 120);
  const site = t.website || t["contact:website"] || t.url; if (site && /^https?:\/\//i.test(site)) out.website = String(site).slice(0, 200);
  const phone = t.phone || t["contact:phone"]; if (phone) out.phone = String(phone).split(";")[0].trim().slice(0, 40);
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", "); if (street) out.address = street;
  if (t.lit) out.lit = t.lit === "yes";
  if (t.surface) out.surface = t.surface;
  if (t.access && t.access !== "yes" && t.access !== "public" && t.access !== "permissive") out.access = t.access;
  return out;
};

const GYM_NAMES = { gym: "Фитнес-клуб", sport: "Спорткомплекс", outdoor: "Уличная площадка" };
const RUN_NAMES = { park: "Парк", stadium: "Стадион", track: "Беговая дорожка", reserve: "Природный парк", forest: "Лес" };

export function shapeGym(elements) {
  const items = [];
  for (const el of elements) {
    const t = el.tags || {};
    const g = geometryOf(el);
    if (!g) continue;
    let kind = "gym";
    if (t.leisure === "fitness_station" || (t.leisure === "pitch" && /fitness|workout|calisthenics|gymnastics/.test(t.sport || ""))) kind = "outdoor";
    else if (t.leisure === "sports_centre") kind = "sport";
    if (t.access === "private" && kind !== "gym") continue;
    items.push({ id: `${el.type[0]}${el.id}`, kind, name: t.name || GYM_NAMES[kind], named: !!t.name, lat: g.lat, lon: g.lon, price: priceOf(t, kind), sport: t.sport || "", ...pickTags(t) });
  }
  // Уличные тренажёры часто нанесены по одному — оставляем одну точку на ~60 м
  const out = [];
  for (const it of items) {
    if (it.kind === "outdoor" && out.some((o) => o.kind === "outdoor" && distanceM(o, it) < 60)) continue;
    out.push(it);
  }
  return out;
}

export function shapeRun(elements) {
  const items = [];
  for (const el of elements) {
    const t = el.tags || {};
    const g = geometryOf(el);
    if (!g) continue;
    let kind = "park";
    if (t.leisure === "stadium") kind = "stadium";
    else if (t.leisure === "track") kind = "track";
    else if (t.leisure === "nature_reserve") kind = "reserve";
    else if (t.landuse === "forest") kind = "forest";
    if (t.access === "private" || t.access === "no") continue;
    // Примерная длина круга по границам: периметр рамки, срезанный до реальной дорожки внутри
    const loop = g.w && g.h ? Math.round((2 * (g.w + g.h) * 0.75) / 50) * 50 : 0;
    const area = g.w * g.h * 0.65;
    // Скверы и дворовые «парки» меньше ~2 га для бега не годятся
    if ((kind === "park" || kind === "forest") && area && area < 20000) continue;
    if (kind === "park" && !t.name && area < 60000) continue;
    items.push({ id: `${el.type[0]}${el.id}`, kind, name: t.name || RUN_NAMES[kind], named: !!t.name, lat: g.lat, lon: g.lon, loop: kind === "track" || kind === "stadium" ? 400 : loop, ...pickTags(t) });
  }
  // Один и тот же парк бывает нанесён несколькими частями — оставляем самую большую
  items.sort((a, b) => (b.loop || 0) - (a.loop || 0));
  const out = [];
  for (const it of items) {
    if (it.named && out.some((o) => o.named && o.name === it.name && distanceM(o, it) < 2500)) continue;
    out.push(it);
  }
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const sp = url.searchParams;
  const deadline = Date.now() + 9000;
  try {
    const q = (sp.get("q") || "").trim().slice(0, 160);
    if (q) {
      if (q.length < 3) return json({ ok: false, error: "short" }, 400);
      const key = `geo:${q.toLowerCase().replace(/\s+/g, " ")}`;
      // Пустой ответ не кешируем: это может быть и временный сбой сервиса, а не «адреса нет»
      const results = await cached(key, GEO_TTL, async () => { const found = await geocode(q, deadline); return found.length ? found : null; });
      return json({ ok: true, results: results || [] }, 200, { "Cache-Control": "public, max-age=3600" });
    }

    const kind = sp.get("kind") === "run" ? "run" : "gym";
    const lat = Number(sp.get("lat"));
    const lon = Number(sp.get("lon"));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ ok: false, error: "coords" }, 400);
    const r = Math.max(500, Math.min(5000, Math.round(Number(sp.get("r")) || 2000)));
    // Сетка ~110 м: соседи по дому получают один и тот же ответ из кеша
    const gl = Number(lat.toFixed(3));
    const gn = Number(lon.toFixed(3));
    const items = await cached(`v1:${kind}:${gl}:${gn}:${r}`, PLACES_TTL, async () => {
      const elements = await overpass(QUERY[kind](gl, gn, r), deadline);
      return kind === "run" ? shapeRun(elements) : shapeGym(elements);
    });
    const here = { lat, lon };
    const list = (items || [])
      .map((it) => ({ ...it, dist: distanceM(here, it) }))
      .filter((it) => it.dist <= r * 1.15)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 50);
    return json({ ok: true, kind, r, items: list }, 200, { "Cache-Control": "public, max-age=600" });
  } catch (e) {
    console.error("places:", e?.message || e);
    return json({ ok: false, error: "upstream" }, 502);
  }
};

export const config = { path: "/api/places", method: "GET" };
