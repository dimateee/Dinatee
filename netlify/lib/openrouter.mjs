// OpenRouter — бесплатный вариант без VPN на этапе регистрации (в отличие от Gemini).
// Один аккаунт даёт доступ к пачке моделей разных компаний, среди них есть бесплатные
// (с суффиксом ":free" в названии модели) и с поддержкой фото. Без привязки карты, пока
// используешь только бесплатные модели — лимит в районе 20 запросов в минуту / 200 в день
// на бесплatную модель, этого достаточно для личного использования.
// API — тот же формат, что и у OpenAI (Chat Completions), поэтому код проще, чем у Gemini.
import { env } from "./telegram-auth.mjs";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// content — те же блоки [{type:"text",text}] / [{type:"image", source:{data, media_type}}],
// что и для остальных провайдеров. Ответ приводим к тому же виду {content:[{type:"text",text}]}.
export async function openrouterChat(content) {
  const apiKey = String(env("OPENROUTER_API_KEY") || "").trim();
  if (!apiKey) throw Object.assign(new Error("openrouter_key_missing"), { code: "key_missing" });
  // Бесплатная модель с поддержкой фото по умолчанию — можно сменить на другую с суффиксом
  // ":free" из каталога openrouter.ai/models, если эта станет недоступна или перегружена.
  const model = env("OPENROUTER_MODEL") || "google/gemma-3-27b-it:free";

  const parts = content.map((b) => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "image") return { type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } };
    return null;
  }).filter(Boolean);

  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // Необязательно, но OpenRouter просит это указывать у вызывающих приложений
        "HTTP-Referer": env("WEB_APP_URL") || "https://ritm.app",
        "X-Title": "RITM",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: parts }],
        // Температура снижена с 0.3 до 0.2 — числовая оценка КБЖУ, не творческий текст,
        // меньше температура значит стабильнее результат между повторными запросами.
        temperature: 0.2,
        max_tokens: Number(env("OPENROUTER_MAX_TOKENS")) || 4000,
      }),
    });
  } catch (e) {
    throw Object.assign(new Error("openrouter_network"), { code: "network" });
  }

  const text = await response.text();
  if (!response.ok) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* не JSON */ }
    const status = response.status;
    const code = status === 401 || status === 403 ? "auth" : status === 429 ? "rate" : status === 400 ? "bad_request" : "upstream";
    throw Object.assign(new Error("openrouter_" + status), { code, status, body: parsed?.error?.message || text.slice(0, 200) });
  }
  const data = JSON.parse(text);
  const answer = data?.choices?.[0]?.message?.content || "";
  return { content: [{ type: "text", text: answer }] };
}
