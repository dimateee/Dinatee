// Netlify: POST /api/product-submit — пользователь сохраняет КБЖУ товара (после фото этикетки
// или ручного ввода) для штрихкода, которого ещё не было в базе. Запись уходит не только на
// телефон самого человека (st.products в App.jsx), но и в общую базу RITM (product-store.mjs),
// чтобы в следующий раз этот же товар — например, собственная марка Пятёрочки или Чижика —
// сразу нашёлся у любого другого пользователя приложения, без повторного фотографирования
// этикетки. Авторизация та же, что и у /api/claude: initData из Telegram или секрет отдельного
// iOS-приложения — присылать можно только из самого RITM, а не откуда угодно.
import { env, checkStandaloneSecret, CORS_HEADERS, corsPreflight } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { saveProduct } from "../lib/product-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: CORS_HEADERS });
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
const round1 = (v) => Math.round(v * 10) / 10;

// Не доверяем клиенту вслепую: проверяем форму, обрезаем длину строк, отсекаем заведомо
// бессмысленные значения (пустой КБЖУ, калорийность за пределами реальных продуктов).
function sanitizeProduct(p) {
  if (!p || typeof p !== "object") return null;
  const name = String(p.name || "").trim().slice(0, 120);
  if (!name) return null;
  const per100 = {
    kcal: Math.round(num(p.per100?.kcal)),
    p: round1(num(p.per100?.p)),
    f: round1(num(p.per100?.f)),
    c: round1(num(p.per100?.c)),
  };
  if (per100.kcal <= 0 && per100.p + per100.f + per100.c <= 0) return null;
  if (per100.kcal > 950) return null; // выше нет обычных продуктов (чистый жир/масло — предел)
  return {
    name,
    brand: String(p.brand || "").trim().slice(0, 80),
    per100,
    unit: p.unit === "ml" ? "ml" : "g",
    servingG: Math.max(0, Math.round(num(p.servingG))),
    packageG: Math.max(0, Math.round(num(p.packageG))),
    allergens: Array.isArray(p.allergens) ? p.allergens.filter((a) => typeof a === "string").slice(0, 10) : [],
  };
}

export default async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  const browserTesting = env("ALLOW_BROWSER_TESTING") === "1";
  let userId = null;
  if (!browserTesting && !checkStandaloneSecret(req)) {
    // Mini App (подпись Telegram) или сайт (токен сессии) — гостям сайта без входа запись в общую базу закрыта
    const auth = authUser(req);
    if (!auth.ok) return json({ error: auth.code }, auth.status);
    userId = auth.user.id ?? null;
  }

  const body = await req.json().catch(() => null);
  const code = String(body?.barcode || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return json({ error: "bad_code" }, 400);
  const product = sanitizeProduct(body?.product);
  if (!product) return json({ error: "bad_product" }, 400);

  const result = await saveProduct(code, product, userId);
  return json({ ok: true, ...result });
};

export const config = { path: "/api/product-submit", method: ["POST", "OPTIONS"] };
