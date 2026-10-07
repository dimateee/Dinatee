// Netlify: /api/create-payment — создаёт платёж Platega по СБП.
// Работает и для Mini App (подпись Telegram), и для сайта (токен сессии после входа через бота):
// в обоих случаях Pro включается на Telegram ID человека и видна везде.
import { env } from "../lib/telegram-auth.mjs";
import { authUser, botUsername } from "../lib/auth.mjs";
import { PLANS, plategaCreds, createPayment } from "../lib/platega.mjs";
import { rememberPending } from "../lib/pro-store.mjs";
import { checkDiscountCode } from "../lib/promo-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

// Куда вернуть человека после оплаты: из Mini App — обратно в бота, с сайта — обратно на сайт
async function returnUrl(origin, via) {
  if (via === "web") return env("WEB_PAYMENT_RETURN_URL") || `${origin}/app?payment=return`;
  if (env("PAYMENT_RETURN_URL")) return env("PAYMENT_RETURN_URL");
  const bot = await botUsername();
  return bot ? `https://t.me/${bot}` : origin;
}

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const user = auth.user;

  const body = await req.json().catch(() => null);
  const plan = body?.plan;
  if (!PLANS[plan]) return json({ error: "bad_plan" }, 400);

  const { merchantId, secret } = plategaCreds();
  if (!merchantId || !secret) return json({ error: "platega_not_configured" }, 503);

  // Промокод на скидку перепроверяется заново прямо здесь — проценту из записи кода доверяем,
  // а не тому, что клиент мог прислать сам (клиент присылает только сам код).
  let promo = null;
  if (body?.promoCode) {
    const check = await checkDiscountCode(body.promoCode, user.id);
    if (!check.ok) return json({ error: check.reason }, 400);
    promo = check;
  }
  const amount = promo ? Math.max(1, Math.round(PLANS[plan].rub * (1 - promo.percent / 100))) : PLANS[plan].rub;

  try {
    const back = await returnUrl(new URL(req.url).origin, auth.via);
    const tx = await createPayment({ plan, userId: user.id, returnUrl: back, amount, promoCode: promo?.code });
    if (!tx?.redirect || !tx?.transactionId) return json({ error: "platega_bad_response" }, 502);
    await rememberPending(tx.transactionId, user.id, plan, { promoCode: promo?.code || null, amount, via: auth.via });
    return json({ url: tx.redirect, transactionId: tx.transactionId, amount });
  } catch (err) {
    console.error("platega create failed", err.status, err.body || err);
    return json({ error: err.status === 401 ? "platega_auth" : "platega_error" }, 502);
  }
};

export const config = { path: "/api/create-payment", method: "POST" };
