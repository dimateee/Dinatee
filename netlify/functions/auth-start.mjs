// Netlify: /api/auth-start — начало входа на сайт через Telegram-бота (см. netlify/lib/login-store.mjs).
// Возвращает ссылку на бота с одноразовым кодом и секрет, по которому сайт потом заберёт сессию.
// Перед этим проверяет, что бот подключён к сайту (вебхук), и при необходимости подключает его сам —
// иначе бот не увидит ни «Старт», ни нажатие «Подтвердить вход».
import { botToken, tokenProblem } from "../lib/telegram-auth.mjs";
import { botUsername } from "../lib/auth.mjs";
import { ensureWebhook } from "../lib/telegram-bot.mjs";
import { createLogin } from "../lib/login-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req) => {
  const problem = tokenProblem(botToken());
  if (problem) return json({ error: problem }, 500);
  const bot = await botUsername();
  if (!bot) return json({ error: "telegram_unreachable" }, 502);
  const hook = await ensureWebhook(new URL(req.url).origin).catch((e) => ({ ok: false, error: String(e?.message || e) }));
  const { token, secret, expiresAt } = await createLogin();
  return json({
    token, secret, expiresAt, bot,
    botUrl: `https://t.me/${bot}?start=login_${token}`,
    botReady: !!hook.ok,
    botError: hook.ok ? null : hook.error || "webhook",
  });
};

export const config = { path: "/api/auth-start", method: "POST" };
