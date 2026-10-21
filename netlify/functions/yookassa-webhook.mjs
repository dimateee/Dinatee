// /api/yookassa-webhook — уведомления ЮKassa об оплате.
// Не доверяем телу запроса: заново запрашиваем платёж у ЮKassa по его id и только потом включаем подписку.
import { env, yookassa, grantPremium, bot, PRICE_RUB } from "../lib/shared.mjs";

export default async (req) => {
  const secret = env("YOOKASSA_WEBHOOK_SECRET");
  if (secret && new URL(req.url).searchParams.get("secret") !== secret) return new Response("forbidden", { status: 403 });

  const note = await req.json().catch(() => ({}));
  const id = note?.object?.id;
  if (note?.event !== "payment.succeeded" || !id) return new Response("ok");

  const { ok, data: payment } = await yookassa(`payments/${encodeURIComponent(id)}`);
  const userId = payment?.metadata?.tg_user_id;
  const paidEnough = Number(payment?.amount?.value) >= PRICE_RUB() && payment?.amount?.currency === "RUB";
  if (!ok || payment.status !== "succeeded" || !payment.paid || !userId || !paidEnough) {
    console.warn("Платёж не подтверждён:", id, payment?.status);
    return new Response("ok");
  }

  const granted = await grantPremium({ userId, paymentId: `yk:${id}`, source: "yookassa" });
  if (granted) await bot("sendMessage", { chat_id: userId, text: "Оплата получена! ОГЭ Квест PRO включён на 30 дней 🎉" });
  return new Response("ok");
};

export const config = { path: "/api/yookassa-webhook", method: "POST" };
