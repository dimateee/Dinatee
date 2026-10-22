// Netlify: /api/create-invoice
// Оплата по СБП. Для реального эквайринга укажите готовые платёжные ссылки
// провайдера в переменных окружения SBP_PAYMENT_URL_MONTH и SBP_PAYMENT_URL_YEAR.
import crypto from "node:crypto";

const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];
const botToken = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");
const json = (data, status = 200) => Response.json(data, { status });

function isValidInitData(initData, token) {
  if (!initData || !token) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (calculated.length !== hash.length) return false;
  const authDate = Number(params.get("auth_date") || 0);
  return Date.now() / 1000 - authDate < 24 * 60 * 60 && crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
}

const PLANS = {
  month: { label: "FORMA Pro — 1 месяц", rub: 150, urlEnv: "SBP_PAYMENT_URL_MONTH" },
  year: { label: "FORMA Pro — 12 месяцев", rub: 1200, urlEnv: "SBP_PAYMENT_URL_YEAR" },
};

export default async (req) => {
  const browserTesting = env("ALLOW_BROWSER_TESTING") === "1";
  const initData = req.headers.get("x-telegram-init-data");
  if (!browserTesting && !isValidInitData(initData, botToken())) return json({ error: "Откройте приложение из Telegram" }, 401);

  const body = await req.json().catch(() => null);
  const plan = PLANS[body?.plan];
  if (!plan) return json({ error: "Неизвестный тариф" }, 400);

  const link = String(env(plan.urlEnv) || "").trim();
  if (!link) return json({ error: `Не настроена ссылка СБП для тарифа «${plan.label}». Добавьте ${plan.urlEnv} в Netlify.` }, 503);

  return json({ link, amount: plan.rub, currency: "RUB", payment_method: "SBP" });
};

export const config = { path: "/api/create-invoice", method: "POST" };
