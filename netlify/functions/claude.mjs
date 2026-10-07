// Серверная функция Netlify, адрес: /api/claude
// Проверяет, что запрос пришёл из Telegram или от вошедшего на сайт человека, и пересылает его в один из провайдеров ИИ.
// Провайдер выбирается переменной AI_PROVIDER: "gigachat" (по умолчанию, без VPN, рубли),
// "gemini" (бесплатно, но регистрация ключа обычно через VPN), "openrouter" (бесплатно,
// регистрация без VPN — см. .env.example) или "anthropic".
// Формат запроса и ответа одинаковый для всех четырёх — клиентский код (src/App.jsx) их не различает.
// При ошибке возвращаем { error: "<код>", detail } — приложение показывает по коду точную причину.
import { env, checkStandaloneSecret, CORS_HEADERS, corsPreflight } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { gigachatChat } from "../lib/gigachat.mjs";
import { geminiChat } from "../lib/gemini.mjs";
import { openrouterChat } from "../lib/openrouter.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: CORS_HEADERS });

// Пропускаем только текст и фото разумного размера
function isValidContent(content) {
  if (!Array.isArray(content) || content.length === 0 || content.length > 2) return false;
  return content.every((block) => {
    // Лимит поднят с 6000: промпт распознавания еды теперь несёт таблицу-якорь точных БЖУ
    // по частым продуктам (FOOD_REFERENCE_TABLE в src/App.jsx) плюс память по ранее исправленным
    // блюдам пользователя — вместе с инструкциями это уже ~5.5к символов без запаса на память.
    if (block?.type === "text") return typeof block.text === "string" && block.text.length < 9000;
    if (block?.type === "image") {
      const s = block.source || {};
      return s.type === "base64" && s.media_type === "image/jpeg" && typeof s.data === "string" && s.data.length < 3_000_000;
    }
    return false;
  });
}

// Ответ Anthropic с ошибкой → наш код
function anthropicErrorCode(status, body) {
  const type = body?.error?.type || "";
  const message = String(body?.error?.message || "");
  if (status === 401 || type === "authentication_error") return "ai_auth";
  if (status === 403 || type === "permission_error") return "ai_permission";
  if (status === 404 || type === "not_found_error") return "ai_model";
  if (status === 429 || type === "rate_limit_error") return "ai_rate";
  if (status === 529 || type === "overloaded_error") return "ai_overloaded";
  if (/credit balance|billing/i.test(message)) return "ai_credit";
  if (status === 400) return "ai_bad_request";
  return "ai_upstream";
}

async function callAnthropic(content) {
  const apiKey = String(env("ANTHROPIC_API_KEY") || "").trim();
  if (!apiKey) return { error: "ai_key_missing", status: 500 };
  let response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: env("CLAUDE_MODEL") || "claude-sonnet-5",
        max_tokens: Number(env("CLAUDE_MAX_TOKENS")) || 4000,
        // Температура снижена до 0.2 (API по умолчанию даёт 1.0) — распознавание еды это
        // числовая оценка, а не творческий текст, и нам нужен стабильный, воспроизводимый результат.
        temperature: 0.2,
        messages: [{ role: "user", content }],
      }),
    });
  } catch (err) {
    console.error("anthropic fetch failed", err);
    return { error: "ai_network", status: 502 };
  }
  const text = await response.text();
  if (response.ok) return { ok: true, body: text };
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { /* не JSON */ }
  const code = anthropicErrorCode(response.status, parsed);
  console.error("anthropic error", response.status, text.slice(0, 500));
  return { error: code, detail: String(parsed?.error?.message || "").slice(0, 200), status: code === "ai_rate" || code === "ai_overloaded" ? 503 : 502 };
}

// Коды ошибок GigaChat/Gemini/OpenRouter приводим к тем же ai_*, что уже понимает клиент (AI_ERRORS в src/App.jsx)
const GIGA_CODE = { key_missing: "ai_key_missing", cert: "gigachat_cert", auth: "gigachat_auth", credit: "ai_credit", rate: "ai_rate", network: "ai_network", upstream: "ai_upstream" };
const GEMINI_CODE = { key_missing: "ai_key_missing", auth: "gemini_auth", rate: "ai_rate", network: "ai_network", bad_request: "ai_bad_request", upstream: "ai_upstream" };
const OPENROUTER_CODE = { key_missing: "ai_key_missing", auth: "openrouter_auth", rate: "ai_rate", network: "ai_network", bad_request: "ai_bad_request", upstream: "ai_upstream" };
const PROVIDER_FN = { gemini: geminiChat, openrouter: openrouterChat, gigachat: gigachatChat };
const PROVIDER_CODE = { gemini: GEMINI_CODE, openrouter: OPENROUTER_CODE, gigachat: GIGA_CODE };

async function callProvider(provider, content) {
  const fn = PROVIDER_FN[provider] || gigachatChat;
  try {
    const result = await fn(content);
    return { ok: true, body: JSON.stringify(result) };
  } catch (err) {
    const map = PROVIDER_CODE[provider] || GIGA_CODE;
    const code = map[err.code] || "ai_upstream";
    console.error(provider, "error", err.status || "", err.body || err.message);
    return { error: code, detail: String(err.body || err.message || "").slice(0, 200), status: err.code === "rate" ? 503 : 502 };
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const browserTesting = env("ALLOW_BROWSER_TESTING") === "1";
  if (!browserTesting && !checkStandaloneSecret(req)) {
    // Mini App (подпись Telegram) или сайт (токен сессии) — гостям без входа ИИ недоступен
    const auth = authUser(req);
    if (!auth.ok) return json({ error: auth.code }, auth.status);
  }

  const body = await req.json().catch(() => null);
  const content = body?.content;
  if (!isValidContent(content)) return json({ error: "bad_request" }, 400);

  const provider = String(env("AI_PROVIDER") || "gigachat").toLowerCase();
  const result = provider === "anthropic" ? await callAnthropic(content) : await callProvider(provider, content);

  if (result.ok) return new Response(result.body, { status: 200, headers: { "content-type": "application/json", ...CORS_HEADERS } });
  return json({ error: result.error, detail: result.detail }, result.status || 502);
};

export const config = { path: "/api/claude" };
