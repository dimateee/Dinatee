// /api/subscribe — создаёт платёж на 30 дней подписки.
// method: "yookassa" — карта или СБП в рублях, "stars" — Telegram Stars с автопродлением.
import { json, telegramUser, env, appUrl, bot, yookassa, yookassaReady, PRICE_RUB, PRICE_STARS, PERIOD_DAYS } from "../lib/shared.mjs";

const TITLE = "ОГЭ Квест PRO";
const DESCRIPTION = "Все темы ОГЭ по математике, безлимитные пробные варианты и разборы второй части на 30 дней";

export default async (req) => {
  const user = telegramUser(req);
  if (!user) return json({ error: "Откройте приложение из Telegram" }, 401);
  const body = await req.json().catch(() => ({}));

  if (body.method === "stars") {
    const res = await bot("createInvoiceLink", {
      title: TITLE,
      description: DESCRIPTION,
      payload: JSON.stringify({ u: user.id, plan: "month" }),
      currency: "XTR",
      prices: [{ label: "Подписка на 30 дней", amount: PRICE_STARS() }],
      subscription_period: PERIOD_DAYS * 24 * 60 * 60,
    });
    if (!res.ok) return json({ error: "Не удалось создать счёт в Telegram. Проверьте BOT_TOKEN." }, 502);
    return json({ invoice: res.result });
  }

  if (body.method === "yookassa") {
    if (!yookassaReady()) return json({ error: "Оплата картой пока не настроена" }, 503);
    const value = PRICE_RUB().toFixed(2);
    const email = String(env("RECEIPT_EMAIL") || "").trim();
    const { ok, data } = await yookassa("payments", {
      method: "POST",
      body: {
        amount: { value, currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: appUrl() || "https://t.me" },
        description: `${TITLE} — 30 дней`,
        metadata: { tg_user_id: String(user.id) },
        // Чек по 54-ФЗ — только если в ЮKassa подключены чеки
        ...(email ? {
          receipt: {
            customer: { email },
            items: [{ description: `${TITLE} — 30 дней`, quantity: "1.00", amount: { value, currency: "RUB" }, vat_code: 1, payment_mode: "full_payment", payment_subject: "service" }],
          },
        } : {}),
      },
    });
    const url = data?.confirmation?.confirmation_url;
    if (!ok || !url) return json({ error: "ЮKassa не создала платёж. Проверьте ключи магазина." }, 502);
    return json({ url });
  }

  return json({ error: "Неизвестный способ оплаты" }, 400);
};

export const config = { path: "/api/subscribe", method: "POST" };
