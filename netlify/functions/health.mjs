// Netlify: /api/health — проверка настроек сервера. Открой адрес в браузере.
// Секреты не показывает: только «ок» или что именно не так.
import { env, botToken, tokenProblem } from "../lib/telegram-auth.mjs";
import { plategaCreds } from "../lib/platega.mjs";
import { ensureWebhook } from "../lib/telegram-bot.mjs";

// Ключи Platega проверяем запросом несуществующего платежа: 404 — ключи верные, 401 — нет
async function checkPlatega() {
  const { merchantId, secret } = plategaCreds();
  if (!merchantId || !secret) return "ОШИБКА: не заданы PLATEGA_MERCHANT_ID и/или PLATEGA_SECRET";
  try {
    const r = await fetch("https://app.platega.io/transaction/00000000-0000-0000-0000-000000000000", {
      headers: { "X-MerchantId": merchantId, "X-Secret": secret },
    });
    if (r.status === 401 || r.status === 403) return "ОШИБКА: Platega не принял ключи — проверь PLATEGA_MERCHANT_ID и PLATEGA_SECRET";
    return "ок";
  } catch (e) {
    return "не удалось связаться с Platega";
  }
}

async function checkBot() {
  const token = botToken();
  const problem = tokenProblem(token);
  if (problem === "telegram_token_missing") return "ОШИБКА: переменная BOT_TOKEN не задана (или у неё не включена область Functions)";
  if (problem === "telegram_token_format") return "ОШИБКА: BOT_TOKEN записан неверно, нужен вид 1234567890:AAH…";
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const d = await r.json();
    return d.ok ? `ок, бот @${d.result.username}` : `ОШИБКА: Telegram не принял BOT_TOKEN (${d.description})`;
  } catch (e) {
    return "не удалось связаться с Telegram";
  }
}

// Бот отвечает и видит «Подтвердить вход» только если вебхук указывает на этот сайт.
// Проверка сама его и чинит (см. netlify/lib/telegram-bot.mjs) — вручную ничего делать не нужно.
async function checkWebhook(origin) {
  const token = botToken();
  if (tokenProblem(token)) return "нельзя проверить без BOT_TOKEN";
  try {
    const fixed = await ensureWebhook(origin);
    if (!fixed.ok && !fixed.skipped) return `ОШИБКА: не удалось подключить бота к сайту — ${fixed.error}`;
    const d = await (await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)).json();
    const info = d?.result || {};
    const prefix = fixed.set ? `подключил заново (раньше было: ${fixed.previousUrl || "не задан"}) → ` : "";
    if (fixed.skipped === "preview") return `это превью-адрес — вебхук не трогаю, сейчас: ${info.url || "не задан"}`;
    if (info.last_error_message && Date.now() / 1000 - (info.last_error_date || 0) < 3600) {
      return `${prefix}ок, но Telegram недавно получил ошибку: ${info.last_error_message}`;
    }
    return `${prefix}ок, ${info.url}${info.pending_update_count ? `, в очереди ${info.pending_update_count}` : ""}`;
  } catch (e) {
    return "не удалось связаться с Telegram";
  }
}

// Проверяем именно того провайдера ИИ, который включён переменной AI_PROVIDER —
// остальные два ключа при этом не трогаем, они могут быть не заданы
async function checkAi() {
  const provider = String(env("AI_PROVIDER") || "gigachat").toLowerCase();
  if (provider === "gemini") {
    const key = String(env("GEMINI_API_KEY") || "").trim();
    const model = env("GEMINI_MODEL") || "gemini-2.5-flash";
    if (!key) return { provider: "gemini", key: "ОШИБКА: переменная GEMINI_API_KEY не задана", model };
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${encodeURIComponent(key)}`);
      if (r.ok) return { provider: "gemini", key: "ок", model: `ок, ${model}` };
      const body = await r.json().catch(() => ({}));
      return { provider: "gemini", key: `ОШИБКА: ${body?.error?.message || r.status}. Если это отказ по региону — ключ обычно получают через VPN, дальше сервер работает без него`, model };
    } catch (e) {
      return { provider: "gemini", key: "не удалось связаться с Gemini", model };
    }
  }
  if (provider === "openrouter") {
    const key = String(env("OPENROUTER_API_KEY") || "").trim();
    const model = env("OPENROUTER_MODEL") || "google/gemma-3-27b-it:free";
    if (!key) return { provider: "openrouter", key: "ОШИБКА: переменная OPENROUTER_API_KEY не задана", model };
    try {
      const r = await fetch("https://openrouter.ai/api/v1/auth/key", { headers: { Authorization: `Bearer ${key}` } });
      if (r.ok) return { provider: "openrouter", key: "ок", model: `ок, ${model}` };
      const body = await r.json().catch(() => ({}));
      return { provider: "openrouter", key: `ОШИБКА: ${body?.error?.message || r.status}`, model };
    } catch (e) {
      return { provider: "openrouter", key: "не удалось связаться с OpenRouter", model };
    }
  }
  if (provider === "anthropic") {
    const key = String(env("ANTHROPIC_API_KEY") || "").trim();
    const model = env("CLAUDE_MODEL") || "claude-sonnet-5";
    if (!key) return { provider: "anthropic", key: "ОШИБКА: переменная ANTHROPIC_API_KEY не задана", model };
    try {
      const r = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`, { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
      if (r.ok) return { provider: "anthropic", key: "ок", model: `ок, ${model}` };
      const body = await r.json().catch(() => ({}));
      return { provider: "anthropic", key: `ОШИБКА: ${body?.error?.message || r.status}`, model };
    } catch (e) {
      return { provider: "anthropic", key: "не удалось связаться с Anthropic", model };
    }
  }
  // gigachat — по умолчанию
  const authKey = String(env("GIGACHAT_AUTH_KEY") || "").trim();
  const model = env("GIGACHAT_MODEL") || "GigaChat-2-Max";
  if (!authKey) return { provider: "gigachat", key: "ОШИБКА: переменная GIGACHAT_AUTH_KEY не задана", model };
  try {
    const { gigachatChat } = await import("../lib/gigachat.mjs");
    await gigachatChat([{ type: "text", text: "Ответь одним словом: привет" }]);
    return { provider: "gigachat", key: "ок", model: `ок, ${model}` };
  } catch (e) {
    const msg = { cert: "не удалось скачать сертификат Минцифры", auth: "ключ не принят — проверь GIGACHAT_AUTH_KEY", credit: "закончился баланс в личном кабинете Sber Studio", rate: "превышен лимит запросов, попробуй ещё раз" }[e.code] || String(e.body || e.message);
    return { provider: "gigachat", key: `ОШИБКА: ${msg}`, model };
  }
}

export default async (req) => {
  const origin = new URL(req.url).origin;
  const [bot, ai, pay, webhook] = await Promise.all([checkBot(), checkAi(), checkPlatega(), checkWebhook(origin)]);
  return Response.json(
    {
      bot_token: bot,
      telegram_webhook: webhook,
      ai_provider: ai.provider,
      ai_key: ai.key,
      ai_model: ai.model,
      platega: pay,
      platega_callback_url: new URL(req.url).origin + "/api/platega-callback",
      browser_testing: env("ALLOW_BROWSER_TESTING") === "1" ? "ВКЛЮЧЕНО — выключи после проверки" : "выключено",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
};

export const config = { path: "/api/health", method: "GET" };
