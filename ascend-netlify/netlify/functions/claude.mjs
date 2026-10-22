// Серверная функция Netlify, адрес: /api/claude
// Проверяет, что запрос пришёл из Telegram, и пересылает его в Claude API.
// Ключи хранятся в Netlify → Site configuration → Environment variables.
import crypto from "node:crypto";

const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];
// Токен бота: убираем пробелы, кавычки и лишнее «bot» в начале — частые ошибки при копировании
const botToken = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");
const json = (data, status = 200) => Response.json(data, { status });

// Проверка подписи initData по документации Telegram Mini Apps
function isValidInitData(initData, botToken) {
  if (!initData || !botToken) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (calculated.length !== hash.length) return false;

  const authDate = Number(params.get("auth_date") || 0);
  const isFresh = Date.now() / 1000 - authDate < 24 * 60 * 60;
  return isFresh && crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
}

// Пропускаем только текст и фото разумного размера
function isValidContent(content) {
  if (!Array.isArray(content) || content.length === 0 || content.length > 2) return false;
  return content.every((block) => {
    if (block?.type === "text") return typeof block.text === "string" && block.text.length < 6000;
    if (block?.type === "image") {
      const s = block.source || {};
      return s.type === "base64" && s.media_type === "image/jpeg" && typeof s.data === "string" && s.data.length < 3_000_000;
    }
    return false;
  });
}

export default async (req) => {
  const browserTesting = env("ALLOW_BROWSER_TESTING") === "1";
  const initData = req.headers.get("x-telegram-init-data");
  if (!browserTesting && !isValidInitData(initData, botToken())) {
    return json({ error: "Open the app from Telegram" }, 401);
  }

  const body = await req.json().catch(() => null);
  const content = body?.content;
  if (!isValidContent(content)) return json({ error: "Bad request" }, 400);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env("CLAUDE_MODEL") || "claude-sonnet-5",
        max_tokens: Number(env("CLAUDE_MAX_TOKENS")) || 4000,
        messages: [{ role: "user", content }],
      }),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return json({ error: "Upstream error" }, 502);
  }
};

export const config = {
  path: "/api/claude",
  method: "POST",
};
