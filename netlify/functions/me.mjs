// /api/me — статус подписки текущего пользователя и доступные способы оплаты
import { json, telegramUser, getSubscription, yookassaReady, botToken, PRICE_RUB, PRICE_STARS } from "../lib/shared.mjs";

export default async (req) => {
  const user = telegramUser(req);
  if (!user) return json({ error: "Откройте приложение из Telegram" }, 401);

  const methods = [];
  if (yookassaReady()) methods.push("yookassa");
  if (botToken()) methods.push("stars");

  try {
    const sub = await getSubscription(user.id);
    return json({ ...sub, methods, priceRub: PRICE_RUB(), priceStars: PRICE_STARS() });
  } catch (err) {
    console.error(err);
    return json({ error: "Хранилище подписок недоступно" }, 500);
  }
};

export const config = { path: "/api/me", method: "GET" };
