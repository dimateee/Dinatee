// Netlify: /api/platega-callback — сюда Platega присылает уведомления о статусе платежа.
// Этот адрес указывается в личном кабинете Platega: Настройки проекта → Callback URL.
import crypto from "node:crypto";
import { botToken } from "../lib/telegram-auth.mjs";
import { plategaCreds } from "../lib/platega.mjs";
import { applyTransaction } from "../lib/pro-store.mjs";

const same = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};
const dateRu = (ms) => new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });

export default async (req) => {
  const raw = await req.text();
  // При сохранении адреса в кабинете Platega присылает пустой запрос — нужно ответить 200
  if (!raw.trim()) return new Response("ok");

  const { merchantId, secret } = plategaCreds();
  if (!same(req.headers.get("x-merchantid"), merchantId) || !same(req.headers.get("x-secret"), secret)) {
    return new Response("unauthorized", { status: 401 });
  }
  let body = null;
  try { body = JSON.parse(raw); } catch (e) { return new Response("bad json", { status: 400 }); }
  const txId = body?.id || body?.Id || body?.transactionId;
  if (!txId) return new Response("no id", { status: 400 });

  let result;
  try {
    result = await applyTransaction(txId);
  } catch (err) {
    // Не смогли перепроверить платёж — отвечаем ошибкой, Platega повторит через 5 и 10 минут
    console.error("callback check failed", err.status, err.body || err);
    return new Response("retry later", { status: 502 });
  }

  if (result.granted) {
    await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: result.userId, text: `✅ Оплата прошла! RITM Pro активна до ${dateRu(result.pro.until)}.\n\nСпасибо, что с нами 💪` }),
    }).catch(() => {});
  }
  if (!result.ok) console.error("callback not applied", txId, result);
  return new Response("ok");
};

export const config = { path: "/api/platega-callback", method: "POST" };
