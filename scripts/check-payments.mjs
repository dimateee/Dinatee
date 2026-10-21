// Проверка серверной логики оплаты на локальном хранилище Netlify Blobs.
// Telegram и ЮKassa подменяются заглушками, поэтому тест не ходит в интернет.
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { BlobsServer } from "@netlify/blobs/server";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blobs-"));
const server = new BlobsServer({ directory: dir, token: "test-token", port: 0 });
const { port } = await server.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ siteID: "site", token: "test-token", edgeURL: `http://localhost:${port}`, uncachedEdgeURL: `http://localhost:${port}` })).toString("base64");
Object.assign(process.env, {
  BOT_TOKEN: "123:ABC", APP_URL: "https://app.example", PRICE_RUB: "150", PRICE_STARS: "100",
  YOOKASSA_SHOP_ID: "shop", YOOKASSA_SECRET_KEY: "key", YOOKASSA_WEBHOOK_SECRET: "yk-secret", TELEGRAM_WEBHOOK_SECRET: "tg-secret",
});

// Заглушки внешних API
const calls = [];
const payments = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  if (url.startsWith("https://api.telegram.org/")) {
    const method = url.split("/").pop();
    const body = JSON.parse(init.body || "{}");
    calls.push({ method, body });
    if (method === "getMe") return Response.json({ ok: true, result: { username: "oge_quest_bot" } });
    if (method === "createInvoiceLink") return Response.json({ ok: true, result: "https://t.me/$invoice" });
    return Response.json({ ok: true, result: true });
  }
  if (url.startsWith("https://api.yookassa.ru/v3/payments")) {
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      calls.push({ method: "yk:create", body });
      return Response.json({ id: "p-new", status: "pending", confirmation: { confirmation_url: "https://yoomoney.ru/pay/p-new" } });
    }
    const id = decodeURIComponent(url.split("/").pop());
    return payments[id] ? Response.json(payments[id]) : Response.json({ type: "error" }, { status: 404 });
  }
  return realFetch(url, init);
};

const { default: me } = await import("../netlify/functions/me.mjs");
const { default: subscribe } = await import("../netlify/functions/subscribe.mjs");
const { default: tgHook } = await import("../netlify/functions/telegram-webhook.mjs");
const { default: ykHook } = await import("../netlify/functions/yookassa-webhook.mjs");

function initData(user) {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify(user) });
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update("123:ABC").digest();
  p.set("hash", crypto.createHmac("sha256", secret).update(dcs).digest("hex"));
  return p.toString();
}
const req = (url, { body, headers = {}, method = "POST" } = {}) =>
  new Request(`https://app.example${url}`, { method, headers: { "content-type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined });
const status = async (uid) => (await me(req("/api/me", { method: "GET", headers: { "x-telegram-init-data": initData({ id: uid }) } }))).json();

let fails = 0;
const ok = (cond, name) => { console.log(`${cond ? "✓" : "✗"} ${name}`); if (!cond) fails++; };
const days = (iso) => Math.round((new Date(iso) - Date.now()) / 864e5);

// --- Доступ без подписи Telegram
ok((await me(req("/api/me", { method: "GET" }))).status === 401, "без подписи Telegram — 401");
ok((await status(1)).premium === false, "новый пользователь без подписки");

// --- Telegram Stars
let r = await subscribe(req("/api/subscribe", { body: { method: "stars" }, headers: { "x-telegram-init-data": initData({ id: 1 }) } }));
const inv = calls.find((c) => c.method === "createInvoiceLink")?.body;
ok(r.status === 200 && inv.currency === "XTR" && inv.prices[0].amount === 100 && inv.subscription_period === 2592000, "счёт Stars: 100 ⭐, подписка на 30 дней");

ok((await tgHook(req("/api/telegram-webhook", { body: {}, headers: { "x-telegram-bot-api-secret-token": "wrong" } }))).status === 403, "вебхук Telegram с чужим секретом — 403");
const tg = (body) => tgHook(req("/api/telegram-webhook", { body, headers: { "x-telegram-bot-api-secret-token": "tg-secret" } }));

await tg({ pre_checkout_query: { id: "q1", from: { id: 1 }, currency: "XTR", total_amount: 100, invoice_payload: JSON.stringify({ u: 1 }) } });
ok(calls.at(-1).method === "answerPreCheckoutQuery" && calls.at(-1).body.ok === true, "pre_checkout для своего счёта — подтверждён");
await tg({ pre_checkout_query: { id: "q2", from: { id: 2 }, currency: "XTR", total_amount: 100, invoice_payload: JSON.stringify({ u: 1 }) } });
ok(calls.at(-1).body.ok === false, "pre_checkout чужого счёта — отклонён");

const exp = Math.floor(Date.now() / 1000) + 30 * 86400;
const paid = (charge, expiration) => tg({ message: { chat: { id: 1 }, from: { id: 1 }, successful_payment: { currency: "XTR", total_amount: 100, invoice_payload: JSON.stringify({ u: 1 }), telegram_payment_charge_id: charge, subscription_expiration_date: expiration } } });
await paid("charge-1", exp);
let s = await status(1);
ok(s.premium && days(s.until) === 30, "оплата Stars включила PRO на 30 дней");
await Promise.all([paid("charge-1", exp), paid("charge-1", exp)]);
ok(days((await status(1)).until) === 30, "повторный вебхук того же платежа не продлевает дважды");
await paid("charge-2", exp + 30 * 86400);
ok(days((await status(1)).until) === 60, "автопродление Stars сдвигает срок ещё на 30 дней");

// --- ЮKassa
r = await subscribe(req("/api/subscribe", { body: { method: "yookassa" }, headers: { "x-telegram-init-data": initData({ id: 5 }) } }));
const created = calls.find((c) => c.method === "yk:create").body;
ok((await r.json()).url === "https://yoomoney.ru/pay/p-new", "ЮKassa вернула ссылку на оплату");
ok(created.amount.value === "150.00" && created.amount.currency === "RUB" && created.metadata.tg_user_id === "5", "платёж ЮKassa: 150.00 RUB, привязан к пользователю");
ok(created.confirmation.return_url === "https://t.me/oge_quest_bot", "после оплаты возвращаем в бота");

const yk = (id, secret = "yk-secret") => ykHook(req(`/api/yookassa-webhook?secret=${secret}`, { body: { type: "notification", event: "payment.succeeded", object: { id } } }));
ok((await yk("p1", "wrong")).status === 403, "вебхук ЮKassa с неверным секретом — 403");

payments.p0 = { id: "p0", status: "pending", paid: false, amount: { value: "150.00", currency: "RUB" }, metadata: { tg_user_id: "5" } };
await yk("p0");
ok((await status(5)).premium === false, "поддельное уведомление (платёж не оплачен) — PRO не включается");
payments.pcheap = { id: "pcheap", status: "succeeded", paid: true, amount: { value: "1.00", currency: "RUB" }, metadata: { tg_user_id: "5" } };
await yk("pcheap");
ok((await status(5)).premium === false, "платёж на 1 ₽ — PRO не включается");
await yk("missing");
ok((await status(5)).premium === false, "несуществующий платёж — PRO не включается");

payments.p1 = { id: "p1", status: "succeeded", paid: true, amount: { value: "150.00", currency: "RUB" }, metadata: { tg_user_id: "5" } };
await yk("p1");
s = await status(5);
ok(s.premium && days(s.until) === 30, "оплата картой/СБП включила PRO на 30 дней");
await yk("p1");
ok(days((await status(5)).until) === 30, "повторное уведомление ЮKassa не продлевает дважды");
payments.p2 = { ...payments.p1, id: "p2" };
await yk("p2");
ok(days((await status(5)).until) === 60, "вторая оплата продлевает от конца текущего срока");

await server.stop();
fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? `Провалено: ${fails}` : "Оплата работает правильно ✓");
process.exit(fails ? 1 : 0);
