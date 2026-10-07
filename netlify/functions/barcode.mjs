// Netlify: /api/barcode?code=4600000000000
// Сначала проверяет общую базу RITM (её наполняют сами пользователи — см. product-store.mjs
// и /api/product-submit), потом открытую базу Open Food Facts, и возвращает КБЖУ на 100 г,
// размер порции и упаковки, аллергены и состав — как карточка продукта в Yazio.
import { getProduct } from "../lib/product-store.mjs";

const OFF_ALLERGENS = {
  "en:gluten": "gluten",
  "en:milk": "milk",
  "en:eggs": "eggs",
  "en:nuts": "nuts",
  "en:peanuts": "peanut",
  "en:fish": "fish",
  "en:crustaceans": "shellfish",
  "en:molluscs": "shellfish",
  "en:soybeans": "soy",
  "en:sesame-seeds": "sesame",
};

const FIELDS = [
  "product_name", "product_name_ru", "generic_name", "generic_name_ru", "brands", "nutriments",
  "serving_quantity", "product_quantity", "product_quantity_unit", "quantity",
  "allergens_tags", "ingredients_text_ru", "ingredients_text",
].join(",");

// "Access-Control-Allow-Origin: *" — отдельное iOS-приложение обращается сюда с origin
// capacitor://localhost, а не с домена Netlify; без заголовка браузер блокирует чтение ответа.
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", ...extra } });
const positive = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const round1 = (v) => Math.round(v * 10) / 10;

function normalize(x) {
  const n = x.nutriments || {};
  const kcalDirect = positive(n["energy-kcal_100g"]);
  const kj = positive(n["energy-kj_100g"]) || positive(n["energy_100g"]); // energy_100g в базе хранится в кДж
  const kcal = kcalDirect || (kj ? kj / 4.184 : 0);
  const p = positive(n.proteins_100g);
  const f = positive(n.fat_100g);
  const c = positive(n.carbohydrates_100g);
  const quantity = String(x.quantity || "");
  const liquid = String(x.product_quantity_unit || "").toLowerCase() === "ml"
    || /(^|[^а-яёa-z])(мл|ml|л|l)([^а-яёa-z]|$)/i.test(quantity);
  return {
    name: String(x.product_name_ru || x.product_name || x.generic_name_ru || x.generic_name || "").trim() || "Продукт без названия",
    brand: String(x.brands || "").split(",")[0].trim(),
    per100: { kcal: Math.round(kcal), p: round1(p), f: round1(f), c: round1(c) },
    hasNutrition: kcal > 0 || p + f + c > 0,
    servingG: Math.round(positive(x.serving_quantity)),
    packageG: Math.round(positive(x.product_quantity)),
    unit: liquid ? "ml" : "g",
    allergens: [...new Set((x.allergens_tags || []).map((t) => OFF_ALLERGENS[t]).filter(Boolean))],
    ingredients: String(x.ingredients_text_ru || x.ingredients_text || "").slice(0, 1500),
  };
}

export default async (req) => {
  const code = (new URL(req.url).searchParams.get("code") || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return json({ found: false, error: "barcode" }, 400);

  // Общая база RITM — быстрее и чаще точнее для российских СТМ (Пятёрочка, Перекрёсток,
  // Чижик и т. п.), которых почти нет в Open Food Facts. Если нашли что-то с реальным КБЖУ —
  // этого достаточно, дальше в OFF не идём.
  const own = await getProduct(code).catch(() => null);
  const ownHasNutrition = own && (own.per100?.kcal > 0 || (own.per100?.p || 0) + (own.per100?.f || 0) + (own.per100?.c || 0) > 0);
  if (ownHasNutrition) {
    const { alternatives, confirmations, addedBy, ...rest } = own;
    return json({ found: true, product: { ...rest, source: "ritm" } }, 200, { "Cache-Control": "no-store" });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, {
      headers: { Accept: "application/json", "User-Agent": "RITM/1.0 (Telegram Mini App; contact: @doltiii)" },
      signal: ctrl.signal,
    });
    // База отвечает 404, если продукта нет — это не ошибка сервера
    if (r.status === 404) return json({ found: false }, 404);
    if (!r.ok) return json({ found: false, error: "upstream" }, 502);
    const data = await r.json();
    if (data.status !== 1 || !data.product) return json({ found: false }, 404);
    return json({ found: true, product: { ...normalize(data.product), source: "off" } }, 200, { "Cache-Control": "public, max-age=3600" });
  } catch (err) {
    console.error("barcode lookup failed", err?.name || err);
    return json({ found: false, error: "network" }, 502);
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/barcode", method: "GET" };
