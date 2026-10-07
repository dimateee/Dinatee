// Netlify: /api/config — публичные настройки для сайта: имя бота (кнопка «Открыть в Telegram»)
// и цены (берутся из того же PLANS, по которому реально создаётся платёж).
// Заодно проверяет, что бот подключён к сайту (вебхук), и подключает его, если нет —
// так бот начинает отвечать на /start, как только кто-то открыл сайт после деплоя.
import { botUsername } from "../lib/auth.mjs";
import { ensureWebhook } from "../lib/telegram-bot.mjs";
import { PLANS } from "../lib/platega.mjs";

export default async (req) => {
  const [bot] = await Promise.all([
    botUsername().catch(() => null),
    ensureWebhook(new URL(req.url).origin).catch(() => null),
  ]);
  return Response.json(
    { bot, prices: { month: PLANS.month.rub, year: PLANS.year.rub } },
    { headers: { "Cache-Control": "public, max-age=600" } },
  );
};

export const config = { path: "/api/config", method: "GET" };
