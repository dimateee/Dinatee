// Netlify: POST /api/order
// Мини-апп присылает сюда заказ из корзины или заявку «Под заказ».
// Функция проверяет, что запрос пришёл из Telegram, пересчитывает цены по config.js,
// присылает уведомление владельцу (ADMIN_CHAT_ID) и подтверждение покупателю.
import {
  adminChatId, botToken, buyerHtml, esc, isValidInitData, json, loadShop, money, parseInitUser, tg,
} from "../lib/telegram.mjs";

const clip = (value, max) => String(value ?? "").trim().slice(0, max);

function buildOrder(body, shop) {
  const currency = shop.currency || "₽";
  const byId = new Map(shop.products.map((p) => [String(p.id), p]));
  const seen = new Set();
  const lines = [];
  let total = 0;

  for (const item of Array.isArray(body.items) ? body.items.slice(0, 50) : []) {
    const p = byId.get(String(item?.id));
    if (!p || p.soldOut || seen.has(p.id) || !(Number(p.price) >= 0)) continue;
    const qty = Math.min(99, Math.max(1, parseInt(item.qty, 10) || 1));
    seen.add(p.id);
    total += qty * Number(p.price);
    lines.push({ p, qty });
  }
  if (!lines.length) return { error: "Корзина пуста" };

  const list = lines.map(({ p, qty }, i) =>
    `${i + 1}. ${esc(p.name)} — ${qty} шт. × ${esc(money(p.price, currency))} = <b>${esc(money(qty * p.price, currency))}</b>`);
  const totalLine = `Итого: <b>${esc(money(total, currency))}</b>`;

  return {
    admin: ["🛍 <b>Новый заказ</b>", "", ...list, "", totalLine],
    buyer: [
      "✅ <b>Заказ принят!</b>",
      "",
      ...lines.map(({ p, qty }, i) => `${i + 1}. ${esc(p.name)} — ${qty} шт.`),
      "",
      totalLine,
      "",
      "Скоро напишем вам здесь, чтобы уточнить детали и доставку.",
    ],
  };
}

function buildRequest(body, shop) {
  const currency = shop.currency || "₽";
  const f = body.fields || {};
  const d = {
    item: clip(f.item, 80),
    brand: clip(f.brand, 80),
    size: clip(f.size, 40),
    color: clip(f.color, 40),
    budget: String(f.budget ?? "").replace(/\D/g, "").slice(0, 9),
    link: clip(f.link, 300),
    details: clip(f.details, 1000),
    name: clip(f.name, 40),
  };
  if (d.item.length < 2) return { error: "Напишите, какая вещь нужна" };

  const rows = [
    ["Что нужно", d.item],
    ["Бренд / модель", d.brand],
    ["Размер", d.size],
    ["Цвет", d.color],
    ["Бюджет", d.budget ? "до " + money(d.budget, currency) : ""],
    ["Пример", d.link],
    ["Подробности", d.details],
    ["Имя", d.name],
  ].filter(([, v]) => v);

  return {
    admin: ["🔎 <b>Заявка под заказ</b>", "", ...rows.map(([k, v]) => `${k}: ${esc(v)}`)],
    buyer: [
      "✅ <b>Заявка принята!</b>",
      "",
      `Ищем: ${esc(d.item)}`,
      "",
      "Подберём вариант, посчитаем цену и напишем вам здесь.",
    ],
  };
}

export default async (req) => {
  const initData = req.headers.get("x-telegram-init-data") || "";
  if (!isValidInitData(initData, botToken())) return json({ error: "Откройте магазин из Telegram" }, 401);

  const admin = adminChatId();
  if (!admin) return json({ error: "Не настроен ADMIN_CHAT_ID" }, 503);

  const user = parseInitUser(initData);
  if (!user) return json({ error: "Нет данных покупателя" }, 400);

  const body = await req.json().catch(() => null);
  if (!body || (body.type !== "order" && body.type !== "request")) return json({ error: "Bad request" }, 400);

  let shop;
  try {
    shop = await loadShop(new URL(req.url).origin);
  } catch (err) {
    console.error(err);
    return json({ error: "Не удалось загрузить каталог" }, 502);
  }

  const built = body.type === "order" ? buildOrder(body, shop) : buildRequest(body, shop);
  if (built.error) return json({ error: built.error }, 400);

  const adminText = [...built.admin, "", buyerHtml(user), "", "<i>Ответьте на это сообщение, и бот перешлёт ответ покупателю.</i>"].join("\n");
  const sent = await tg("sendMessage", {
    chat_id: admin,
    text: adminText,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
  if (!sent.ok) return json({ error: "Не удалось отправить уведомление" }, 502);

  const toBuyer = await tg("sendMessage", { chat_id: user.id, text: built.buyer.join("\n"), parse_mode: "HTML" });
  return json({ ok: true, buyerNotified: Boolean(toBuyer.ok) });
};

export const config = { path: "/api/order", method: "POST" };
