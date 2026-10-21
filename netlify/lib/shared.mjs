// Общий код серверных функций: ключи, проверка подписи Telegram, хранение подписок.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];
// Токен бота: убираем пробелы, кавычки и лишнее «bot» в начале — частые ошибки при копировании
export const botToken = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");
export const json = (data, status = 200) => Response.json(data, { status });
export const appUrl = () => String(env("APP_URL") || env("URL") || "").replace(/\/$/, "");

export const PRICE_RUB = () => Number(env("PRICE_RUB")) || 150;
export const PRICE_STARS = () => Number(env("PRICE_STARS")) || 100;
export const PERIOD_DAYS = 30;

// Проверка подписи initData по документации Telegram Mini Apps. Возвращает пользователя или null
export function telegramUser(req) {
  const initData = req.headers.get("x-telegram-init-data");
  const token = botToken();
  if (initData && token) {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (hash) {
      params.delete("hash");
      const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
      const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
      const fresh = Date.now() / 1000 - Number(params.get("auth_date") || 0) < 24 * 60 * 60;
      if (fresh && calculated.length === hash.length && crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash))) {
        try { return JSON.parse(params.get("user")); } catch { return null; }
      }
    }
  }
  // Режим проверки в обычном браузере: один общий тестовый пользователь
  if (env("ALLOW_BROWSER_TESTING") === "1") return { id: "browser-test", first_name: "Тест" };
  return null;
}

/* ---------- Подписки в Netlify Blobs ---------- */
const subs = () => getStore({ name: "subscriptions", consistency: "strong" });
const payments = () => getStore({ name: "payments", consistency: "strong" });

export async function getSubscription(userId) {
  const sub = await subs().get(String(userId), { type: "json" });
  const active = Boolean(sub?.until && new Date(sub.until) > new Date());
  return { premium: active, until: sub?.until || null, source: sub?.source || null };
}

// Продлеваем подписку. paymentId защищает от двойного зачисления, если вебхук пришёл повторно
export async function grantPremium({ userId, paymentId, source, until }) {
  const seen = await payments().get(paymentId);
  if (seen) return false;
  const current = await subs().get(String(userId), { type: "json" });
  const base = current?.until && new Date(current.until) > new Date() ? new Date(current.until) : new Date();
  const next = until ? new Date(Math.max(until.getTime(), base.getTime())) : new Date(base.getTime() + PERIOD_DAYS * 864e5);
  await subs().setJSON(String(userId), { until: next.toISOString(), source, updated: new Date().toISOString() });
  await payments().set(paymentId, JSON.stringify({ userId, source, at: new Date().toISOString() }));
  return true;
}

/* ---------- Telegram Bot API ---------- */
export async function bot(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) console.error(`Telegram ${method}:`, data);
  return data;
}

/* ---------- ЮKassa ---------- */
export const yookassaReady = () => Boolean(env("YOOKASSA_SHOP_ID") && env("YOOKASSA_SECRET_KEY"));
export async function yookassa(path, { method = "GET", body } = {}) {
  const auth = Buffer.from(`${env("YOOKASSA_SHOP_ID")}:${env("YOOKASSA_SECRET_KEY")}`).toString("base64");
  const res = await fetch(`https://api.yookassa.ru/v3/${path}`, {
    method,
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/json",
      ...(method === "POST" ? { "idempotence-key": crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error(`ЮKassa ${path}:`, res.status, data);
  return { ok: res.ok, data };
}
