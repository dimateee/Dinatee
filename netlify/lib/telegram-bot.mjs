// Подключение бота к сайту без ручных шагов.
//
// Раньше вебхук (адрес, куда Telegram присылает сообщения боту) нужно было один раз задать
// вручную по ссылке из README. Если этого не сделать, или сайт переехал на новый адрес, бот
// молча не отвечал на /start и не видел нажатие «Подтвердить вход» при входе на сайт.
// Теперь сайт сам проверяет вебхук и ставит его на свой адрес — при открытии сайта
// (/api/config), при начале входа (/api/auth-start) и в /api/health.
//
// Вебхук ставится с секретом (secret_token): Telegram присылает его в заголовке каждого запроса,
// и telegram-webhook.mjs сверяет его — так никто, кроме Telegram, не может прислать боту поддельное
// «нажатие кнопки» (например, подтвердить вход на сайт от чужого имени).
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { env, botToken, tokenProblem } from "./telegram-auth.mjs";

const store = () => globalThis.__ritmAuthStore || getStore({ name: "ritm-auth", consistency: "strong" });
const ALLOWED_UPDATES = ["message", "callback_query", "pre_checkout_query"];
let confirmedUrl = null; // в пределах одного запуска функции не проверяем повторно

export const webhookSecret = () => crypto.createHmac("sha256", "ritm-webhook").update(botToken()).digest("hex").slice(0, 48);

export function checkWebhookSecret(req) {
  const got = String(req.headers.get("x-telegram-bot-api-secret-token") || "");
  const expected = webhookSecret();
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
}

// Адрес сайта для вебхука: SITE_URL, если задан, иначе адрес, с которого пришёл запрос.
// Превью и ветки Netlify (deploy-preview-1--site.netlify.app, branch--site.netlify.app) не трогают
// вебхук — иначе бот «переехал» бы на временный адрес.
export function siteBase(origin) {
  return String(env("SITE_URL") || origin || "").replace(/\/+$/, "");
}
const isPreviewHost = (url) => { try { return new URL(url).hostname.includes("--"); } catch { return true; } };

// Пришёл запрос без нашего секрета — вебхук, скорее всего, переставили вручную старой ссылкой
// (без секрета). Переставляем его заново, но не чаще раза в 10 минут: если это поток подделок,
// бот не начнёт без конца дёргать setWebhook.
export async function repairWebhook(origin) {
  const last = await store().get("webhook-repair", { type: "json" }).catch(() => null);
  if (last?.at && Date.now() - last.at < 10 * 60 * 1000) return { ok: false, skipped: "recent" };
  await store().setJSON("webhook-repair", { at: Date.now() }).catch(() => {});
  return ensureWebhook(origin, { force: true });
}

export async function ensureWebhook(origin, { force = false } = {}) {
  const problem = tokenProblem(botToken());
  if (problem) return { ok: false, error: problem };
  const base = siteBase(origin);
  if (!/^https:\/\//.test(base)) return { ok: false, error: "not_https" };
  if (isPreviewHost(base) && !env("SITE_URL")) return { ok: true, skipped: "preview" };
  const url = `${base}/api/telegram-webhook`;
  if (!force && confirmedUrl === url) return { ok: true, url, cached: true };

  const info = await tg("getWebhookInfo").catch(() => null);
  const cur = info?.result || {};
  const marker = await store().get("webhook-config", { type: "json" }).catch(() => null);
  const allowed = cur.allowed_updates;
  const sameUrl = cur.url === url;
  const allowsCallbacks = !allowed || !allowed.length || allowed.includes("callback_query");
  // marker — вебхук ставили мы и с секретом (по getWebhookInfo секрет не виден)
  if (!force && sameUrl && allowsCallbacks && marker?.url === url && marker?.secret === webhookSecret().slice(0, 6)) {
    confirmedUrl = url;
    return { ok: true, url, lastError: cur.last_error_message || null };
  }
  const r = await tg("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ALLOWED_UPDATES, drop_pending_updates: false });
  if (!r?.ok) return { ok: false, error: r?.description || "set_webhook_failed", url };
  await store().setJSON("webhook-config", { url, secret: webhookSecret().slice(0, 6), at: Date.now() }).catch(() => {});
  confirmedUrl = url;
  return { ok: true, url, set: true, previousUrl: cur.url || null };
}
