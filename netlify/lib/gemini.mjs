// Google Gemini — вариант для тех, у кого уже есть рабочий ключ (обычно его получают через VPN,
// доступ по IP из России ограничен, но сам ключ, once получен, работает с любого сервера —
// наш Netlify-сервер физически не в России, так что дальше VPN не нужен).
import { env } from "./telegram-auth.mjs";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// content — те же блоки [{type:"text",text}] / [{type:"image", source:{data, media_type}}],
// что и для Anthropic и GigaChat. Ответ приводим к тому же виду {content:[{type:"text",text}]}.
export async function geminiChat(content) {
  const apiKey = String(env("GEMINI_API_KEY") || "").trim();
  if (!apiKey) throw Object.assign(new Error("gemini_key_missing"), { code: "key_missing" });
  const model = env("GEMINI_MODEL") || "gemini-2.5-flash";

  const parts = content.map((b) => {
    if (b.type === "text") return { text: b.text };
    if (b.type === "image") return { inline_data: { mime_type: b.source.media_type, data: b.source.data } };
    return null;
  }).filter(Boolean);

  let response;
  try {
    response = await fetch(`${API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      // Температура снижена с 0.3 до 0.2 — оценка калорий и веса порции это не творческая задача,
      // а числовая прикидка, и меньшая температура даёт более стабильный результат между повторами.
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: Number(env("GEMINI_MAX_TOKENS")) || 4000 } }),
    });
  } catch (e) {
    throw Object.assign(new Error("gemini_network"), { code: "network" });
  }

  const text = await response.text();
  if (!response.ok) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch (e) { /* не JSON */ }
    const status = response.status;
    const code = status === 401 || status === 403 ? "auth" : status === 429 ? "rate" : status === 400 ? "bad_request" : "upstream";
    throw Object.assign(new Error("gemini_" + status), { code, status, body: parsed?.error?.message || text.slice(0, 200) });
  }
  const data = JSON.parse(text);
  const answer = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n");
  return { content: [{ type: "text", text: answer }] };
}
