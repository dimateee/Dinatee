// Работа с API Platega: создание платежа по СБП и проверка его статуса.
// Документация: https://docs.platega.io/ — базовый адрес https://app.platega.io/
import { env } from "./telegram-auth.mjs";

// Тарифы. Цена берётся только отсюда (приложение передаёт лишь название тарифа).
// Если меняешь цены — поменяй и RUB_PRICE в src/App.jsx, чтобы в приложении показывалась та же сумма.
export const PLANS = {
  month: { title: "RITM Pro — 1 месяц", rub: 150, days: 30 },
  year: { title: "RITM Pro — 12 месяцев", rub: 1200, days: 365 },
};

const BASE = "https://app.platega.io";
export const plategaCreds = () => ({
  merchantId: String(env("PLATEGA_MERCHANT_ID") || "").trim(),
  secret: String(env("PLATEGA_SECRET") || "").trim(),
});

export async function platega(path, { method = "GET", body } = {}) {
  const { merchantId, secret } = plategaCreds();
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", "X-MerchantId": merchantId, "X-Secret": secret },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try { data = JSON.parse(text); } catch (e) { /* не JSON */ }
  if (!r.ok) {
    const err = new Error(`platega_${r.status}`);
    err.status = r.status;
    err.body = text.slice(0, 300);
    throw err;
  }
  return data;
}

// Способ оплаты: 2 — СБП (QR и оплата по ссылке из банковского приложения)
// amount — реальная сумма к оплате (если применён промокод на скидку, она ниже цены тарифа;
// её всегда считает сервер в create-payment.mjs). promoCode — код скидки, если применён,
// кладём его в payload, чтобы applyTransaction знал, какой код списать после подтверждения.
export const createPayment = ({ plan, userId, returnUrl, amount, promoCode }) => platega("/transaction/process", {
  method: "POST",
  body: {
    paymentMethod: Number(env("PLATEGA_METHOD") || 2),
    paymentDetails: { amount: amount ?? PLANS[plan].rub, currency: "RUB" },
    description: PLANS[plan].title + (promoCode ? ` (промокод ${promoCode})` : ""),
    return: returnUrl,
    failedUrl: returnUrl,
    // payload вернётся в уведомлении об оплате — по нему понимаем, кому включить Pro
    payload: JSON.stringify({ u: userId, p: plan, c: promoCode || undefined, a: amount ?? PLANS[plan].rub }),
  },
});

export const getTransaction = (id) => platega(`/transaction/${encodeURIComponent(id)}`);
