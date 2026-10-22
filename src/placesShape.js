// Общая часть поиска мест «Рядом» — её используют и сервер (netlify/functions/places.mjs), и само приложение
// (src/places.js), когда сервер не ответил и телефон спрашивает карту напрямую. Здесь только чистые функции:
// запрос к Overpass API (OpenStreetMap), гонка зеркал и превращение ответа в список мест.

// Публичные серверы Overpass. Разные машины — разная загрузка: спрашиваем сразу несколько и берём первый ответ.
// maps.mail.ru — зеркало VK в России: с телефона в России оно обычно доступно лучше зарубежных.
export const OVERPASS_SERVER = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
export const OVERPASS_DEVICE = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const toRad = (d) => (d * Math.PI) / 180;
export function distanceM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// Прямоугольник вокруг точки: поиск по прямоугольнику у Overpass в разы быстрее поиска по радиусу (around),
// лишнее по углам потом отсекаем по расстоянию.
export function bboxAround(lat, lon, r) {
  const dLat = r / 110540;
  const dLon = r / (111320 * Math.cos(toRad(lat)));
  const f = (x) => x.toFixed(5);
  return `${f(lat - dLat)},${f(lon - dLon)},${f(lat + dLat)},${f(lon + dLon)}`;
}

export function buildQuery(kind, lat, lon, r, timeout = 8) {
  const bb = bboxAround(lat, lon, r);
  const parts = kind === "run" ? [
    `way["leisure"="park"](${bb});`,
    `relation["leisure"="park"](${bb});`,
    `nwr["leisure"="stadium"](${bb});`,
    `nwr["leisure"="track"]["sport"~"running|athletics|jogging"](${bb});`,
    `way["leisure"="nature_reserve"](${bb});`,
    `relation["leisure"="nature_reserve"](${bb});`,
    `way["landuse"="forest"]["name"](${bb});`,
    `relation["landuse"="forest"]["name"](${bb});`,
    `way["natural"="wood"]["name"](${bb});`,
  ] : [
    `nwr["leisure"="fitness_centre"](${bb});`,
    `nwr["amenity"="gym"](${bb});`,
    `nwr["leisure"="sports_centre"]["sport"~"fitness|gym|bodybuilding|crossfit|weightlifting|powerlifting|multi|boxing|martial_arts|swimming"](${bb});`,
    `nwr["leisure"="fitness_station"](${bb});`,
    `nwr["leisure"="pitch"]["sport"~"fitness|workout|calisthenics|gymnastics"](${bb});`,
  ];
  return `[out:json][timeout:${timeout}];\n(\n  ${parts.join("\n  ")}\n)->.a;\nnode.a;out body;\nway.a;out tags bb;\nrelation.a;out tags bb;`;
}

// Спрашиваем несколько зеркал одновременно, первый нормальный ответ побеждает, остальные запросы отменяем.
// Если первые оба не ответили — пробуем следующие, пока не кончится время.
export async function overpassRace(urls, query, { timeoutMs = 8000, batchMs = timeoutMs, headers = {}, parallel = 2 } = {}) {
  const deadline = Date.now() + timeoutMs;
  const body = `data=${encodeURIComponent(query)}`;
  let lastError = "no_mirror";
  for (let i = 0; i < urls.length; i += parallel) {
    const left = deadline - Date.now();
    if (left < 1200) break;
    const ctrls = [];
    const attempts = urls.slice(i, i + parallel).map(async (url) => {
      const ctrl = new AbortController();
      ctrls.push(ctrl);
      const timer = setTimeout(() => ctrl.abort(), Math.min(left, batchMs));
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, body, signal: ctrl.signal });
        if (!r.ok) throw new Error(`http_${r.status}`);
        const data = await r.json();
        if (!Array.isArray(data.elements)) throw new Error("bad_json");
        // Overpass при перегрузке иногда отвечает 200 с пустым списком и пометкой remark — это не «ничего нет»
        if (!data.elements.length && /runtime error|timed out|out of memory|rate_limited/i.test(data.remark || "")) throw new Error("overloaded");
        return data.elements;
      } finally {
        clearTimeout(timer);
      }
    });
    try {
      const elements = await Promise.any(attempts);
      ctrls.forEach((c) => c.abort());
      return elements;
    } catch (e) {
      const errs = e?.errors || [e];
      lastError = errs.map((x) => (x?.name === "AbortError" ? "timeout" : x?.message || "network")).join(",");
    }
  }
  throw new Error(lastError);
}

function geometryOf(el) {
  if (el.type === "node" && Number.isFinite(el.lat)) return { lat: el.lat, lon: el.lon, w: 0, h: 0, b: null };
  const b = el.bounds;
  if (b && Number.isFinite(b.minlat)) {
    const lat = (b.minlat + b.maxlat) / 2;
    return {
      lat, lon: (b.minlon + b.maxlon) / 2,
      w: (b.maxlon - b.minlon) * 111320 * Math.cos(toRad(lat)),
      h: (b.maxlat - b.minlat) * 110540,
      b: [b.minlat, b.minlon, b.maxlat, b.maxlon].map((x) => Number(x.toFixed(6))),
    };
  }
  if (el.center) return { lat: el.center.lat, lon: el.center.lon, w: 0, h: 0, b: null };
  return null;
}

// Ценовой уровень по названию сети — ориентир, точная цена у клуба
const CHAINS = [
  [/ddx/i, "low"], [/spirit/i, "low"], [/alex fitness|алекс фитнес/i, "low"], [/fitness house|фитнес хаус/i, "low"],
  [/зебра|zebra/i, "mid"], [/x-?fit|икс-?фит/i, "mid"], [/территория фитнеса/i, "mid"], [/gold'?s gym/i, "mid"],
  [/физкульт|fizkult/i, "mid"], [/sportlife|спортлайф/i, "mid"], [/orange fitness/i, "mid"],
  [/world class|ворлд класс/i, "high"], [/crocus fitness|крокус фитнес/i, "high"], [/encore/i, "high"], [/ultra ?fitness/i, "high"],
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

function pickTags(t) {
  const out = {};
  const hours = t.opening_hours; if (hours) out.hours = String(hours).slice(0, 120);
  const site = t.website || t["contact:website"] || t.url; if (site && /^https?:\/\//i.test(site)) out.website = String(site).slice(0, 200);
  const phone = t.phone || t["contact:phone"]; if (phone) out.phone = String(phone).split(";")[0].trim().slice(0, 40);
  const street = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(", "); if (street) out.address = street;
  if (t.lit) out.lit = t.lit === "yes";
  if (t.surface) out.surface = t.surface;
  if (t.access && t.access !== "yes" && t.access !== "public" && t.access !== "permissive") out.access = t.access;
  return out;
}

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
  // Уличные тренажёры часто нанесены по одному — оставляем одну точку на ~60 м;
  // один клуб бывает нанесён и точкой, и зданием — оставляем одну запись
  const out = [];
  for (const it of items) {
    if (it.kind === "outdoor" && out.some((o) => o.kind === "outdoor" && distanceM(o, it) < 60)) continue;
    if (it.named && out.some((o) => o.named && o.name === it.name && distanceM(o, it) < 150)) continue;
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
    else if (t.landuse === "forest" || t.natural === "wood") kind = "forest";
    if (t.access === "private" || t.access === "no") continue;
    // Примерная длина круга по границам: периметр рамки, срезанный до реальной дорожки внутри
    const loop = g.w && g.h ? Math.round((2 * (g.w + g.h) * 0.75) / 50) * 50 : 0;
    const area = g.w * g.h * 0.65;
    // Скверы и дворовые «парки» меньше ~2 га для бега не годятся
    if ((kind === "park" || kind === "forest") && area && area < 20000) continue;
    if (kind === "park" && !t.name && area < 60000) continue;
    items.push({ id: `${el.type[0]}${el.id}`, kind, name: t.name || RUN_NAMES[kind], named: !!t.name, lat: g.lat, lon: g.lon, b: g.b, loop: kind === "track" || kind === "stadium" ? 400 : loop, ...pickTags(t) });
  }
  // Один и тот же парк бывает нанесён несколькими частями — оставляем самую большую
  items.sort((a, b) => (b.loop || 0) - (a.loop || 0));
  const out = [];
  for (const it of items) {
    if (it.named && out.some((o) => o.named && o.name === it.name && distanceM(o, it) < 3000)) continue;
    out.push(it);
  }
  return out;
}

// Расстояние и точка маршрута. Для парка или леса — до ближайшего края его границ, а не до центра:
// у большого леса центр может быть в нескольких километрах, хотя опушка — в соседнем дворе.
export function placeFor(item, here) {
  if (!item.b) return { ...item, dist: distanceM(here, item) };
  const [minlat, minlon, maxlat, maxlon] = item.b;
  const inside = here.lat >= minlat && here.lat <= maxlat && here.lon >= minlon && here.lon <= maxlon;
  if (inside) return { ...item, dist: Math.min(distanceM(here, item), 50) };
  const to = { lat: Math.min(maxlat, Math.max(minlat, here.lat)), lon: Math.min(maxlon, Math.max(minlon, here.lon)) };
  const big = item.loop > 2500;
  return { ...item, ...(big ? { lat: to.lat, lon: to.lon } : {}), dist: big ? distanceM(here, to) : Math.min(distanceM(here, item), distanceM(here, to) + 150) };
}

export function nearestFirst(items, here, r, limit = 50) {
  return (items || [])
    .map((it) => placeFor(it, here))
    .filter((it) => it.dist <= r * 1.1)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit);
}

/* ============ Адреса (Nominatim, запасной — Photon) ============ */
export const nominatimSearchUrl = (q) => `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ru&accept-language=ru&addressdetails=1&q=${encodeURIComponent(q)}`;
export const nominatimReverseUrl = (lat, lon) => `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=ru&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`;
export const photonSearchUrl = (q) => `https://photon.komoot.io/api/?limit=5&q=${encodeURIComponent(q)}`;
export const nominatimStructuredUrl = (street, city) => `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ru&accept-language=ru&addressdetails=1&street=${encodeURIComponent(street)}${city ? `&city=${encodeURIComponent(city)}` : ""}`;

const shortLabel = (parts) => [...new Set(parts.filter(Boolean))].slice(0, 4).join(", ");
const streetOf = (a) => [a.road || a.pedestrian || a.footway || a.square, a.house_number].filter(Boolean).join(", ");

export function parseNominatim(list) {
  return (Array.isArray(list) ? list : []).map((x) => {
    const a = x.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.state;
    const label = shortLabel([x.name && x.name !== a.road ? x.name : "", streetOf(a), a.suburb || a.city_district, city]) || x.display_name;
    return { label, lat: Number(x.lat), lon: Number(x.lon), house: a.house_number || "" };
  }).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}
export function parsePhoton(data) {
  return (data?.features || []).map((f) => {
    const p = f.properties || {};
    const [lon, lat] = f.geometry?.coordinates || [];
    const street = [p.street, p.housenumber].filter(Boolean).join(", ");
    return { label: shortLabel([p.name !== p.street ? p.name : "", street, p.district, p.city || p.state]), lat, lon, house: p.housenumber || "" };
  }).filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
}
// Короткая подпись для «Где я сейчас»: «Тверская улица, 7» или район
export function reverseLabel(x) {
  const a = x?.address || {};
  return streetOf(a) || a.suburb || a.city_district || a.neighbourhood || "";
}

// Как пишут адреса в России и как они записаны на карте: «18к1», «18 корп. 1», «д. 18, корпус 1» → «18 к1»;
// «стр. 2» → «с2»; «ул.», «пр-т», «пер.» → полные слова. На OpenStreetMap московские дома записаны как «18 к1»,
// и запрос «18к1» без пробела поиск не узнаёт — находит только улицу, причём кусок улицы в случайном районе.
const ABBR = [
  [/(^|[\s,])ул\.?(?=[\s,]|$)/gi, "$1улица"], [/(^|[\s,])(?:пр-т|просп)\.?(?=[\s,]|$)/gi, "$1проспект"], [/(^|[\s,])пер\.?(?=[\s,]|$)/gi, "$1переулок"],
  [/(^|[\s,])ш\.(?=[\s,]|$)/gi, "$1шоссе"], [/(^|[\s,])наб\.?(?=[\s,]|$)/gi, "$1набережная"], [/(^|[\s,])(?:б-р|бул)\.?(?=[\s,]|$)/gi, "$1бульвар"],
  [/(^|[\s,])пл\.(?=[\s,]|$)/gi, "$1площадь"], [/(^|[\s,])(?:мкр|мкрн)\.?(?=[\s,]|$)/gi, "$1микрорайон"], [/(^|[\s,])г\.\s*/gi, "$1"],
  [/(^|[\s,])(?:д|дом)\.?\s*(?=\d)/gi, "$1"],
];
const CITIES = /^(москва|санкт-петербург|спб|питер|новосибирск|екатеринбург|казань|нижний новгород|челябинск|самара|омск|ростов-на-дону|уфа|красноярск|воронеж|пермь|волгоград|краснодар|тюмень|саратов|тольятти|ижевск|барнаул|ярославль|иркутск|хабаровск|владивосток|махачкала|томск|оренбург|кемерово|рязань|астрахань|пенза|липецк|тула|киров|калининград|сочи|химки|балашиха|подольск|мытищи|королев|люберцы|красногорск|одинцово)\s+/i;
const HOUSE_RE = /(\d+)\s*([а-яё]?)(?:\s*(?:к|корп|корпус)\.?\s*(\d+))?(?:\s*(?:с|стр|строение)\.?\s*(\d+))?(?:\s*\/\s*(\d+))?\s*$/i;

export function parseAddress(raw) {
  let q = String(raw || "").replace(/ё/g, "е").replace(/\s+/g, " ").trim();
  q = q.replace(/,\s*(к|корп|корпус|с|стр|строение)\.?\s*(?=\d)/gi, " $1 ");
  for (const [re, to] of ABBR) q = q.replace(re, to);
  q = q.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/^,\s*|,\s*$/g, "").trim();
  const m = HOUSE_RE.exec(q);
  if (!m) return { text: q, street: q, city: "", house: null };
  const [all, num, lit, k, st, frac] = m;
  const before = q.slice(0, q.length - all.length).replace(/[\s,]+$/, "");
  let parts = before.split(",").map((x) => x.trim()).filter(Boolean);
  // «москва никулинская 18» без запятых: крупный город в начале отделяем сами
  if (parts.length === 1) {
    const c = CITIES.exec(parts[0]);
    if (c && parts[0].length > c[0].length) parts = [c[1], parts[0].slice(c[0].length).trim()];
  }
  const city = parts.length > 1 && !/\d/.test(parts[0]) ? parts[0] : "";
  const street = (city ? parts.slice(1) : parts).join(", ");
  const osm = `${num}${lit.toLowerCase()}${frac ? `/${frac}` : ""}${k ? ` к${k}` : ""}${st ? ` с${st}` : ""}`;
  const text = [city, street, osm].filter(Boolean).join(", ");
  return { text, street, city, house: { num, lit: lit.toLowerCase(), k: k || "", s: st || "", osm, plain: `${num}${lit.toLowerCase()}` } };
}
const houseKey = (h) => String(h || "").toLowerCase().replace(/ё/g, "е").replace(/корпус|корп\.?/g, "к").replace(/строение|стр\.?/g, "с").replace(/[\s.]/g, "");

// Варианты запроса — от точного к общему. Запрашивать по очереди и остановиться на первом, где нашёлся дом.
export function addressQueries(raw) {
  const a = parseAddress(raw);
  const out = [{ kind: "free", q: a.text }];
  if (a.house && a.street) {
    out.push({ kind: "structured", street: `${a.house.osm} ${a.street}`, city: a.city });
    if (a.house.k || a.house.s) out.push({ kind: "free", q: [a.city, a.street, a.house.plain].filter(Boolean).join(", ") });
  }
  if (a.text !== String(raw || "").trim()) out.push({ kind: "free", q: String(raw).trim() });
  return { parsed: a, queries: out };
}

// Сортировка: сначала точное совпадение дома (с корпусом), потом тот же номер без корпуса, потом прочие дома,
// в конце — улицы целиком. Одинаковые подписи и точки ближе 40 м — один результат.
export function rankAddresses(list, parsed) {
  const want = parsed?.house ? houseKey(parsed.house.osm) : "";
  const wantPlain = parsed?.house ? houseKey(parsed.house.plain) : "";
  const score = (x) => {
    const h = houseKey(x.house);
    if (!h) return 0;
    if (want && h === want) return 30;
    if (wantPlain && (h === wantPlain || h.startsWith(wantPlain + "к") || h.startsWith(wantPlain + "с"))) return 20;
    return 10;
  };
  const out = [];
  for (const x of [...list].sort((a, b) => score(b) - score(a))) {
    if (out.some((o) => o.label === x.label || distanceM(o, x) < 40)) continue;
    out.push({ ...x, exact: score(x) === 30 });
  }
  const hasHouse = out.some((x) => x.house);
  return out.slice(0, 5).map((x) => (parsed?.house && !x.house ? { ...x, approx: true, label: `${x.label} — дом не найден` } : x)).filter((x) => !hasHouse || x.house);
}

// Весь поиск адреса. getJson(url) — загрузка JSON (на сервере с User-Agent, в приложении — обычный fetch).
// Nominatim просит не чаще запроса в секунду с одного адреса — между его запросами пауза; Photon спрашиваем параллельно.
export async function geocodeSmart(raw, getJson, { budgetMs = 8000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const { parsed, queries } = addressQueries(raw);
  const pool = [];
  const photon = getJson(photonSearchUrl(parsed.text || raw)).then(parsePhoton).catch(() => []);
  for (let i = 0; i < queries.length; i++) {
    if (Date.now() > deadline - 1500) break;
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    const v = queries[i];
    const url = v.kind === "structured" ? nominatimStructuredUrl(v.street, v.city) : nominatimSearchUrl(v.q);
    const found = await getJson(url).then(parseNominatim).catch(() => []);
    pool.push(...found);
    // Нашёлся дом с нужным номером — дальше не спрашиваем
    if (rankAddresses(found, parsed).some((x) => x.exact || (!parsed.house && x))) break;
  }
  pool.push(...(await photon));
  return rankAddresses(pool, parsed);
}
