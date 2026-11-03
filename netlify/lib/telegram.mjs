// Общие функции для бота и мини-аппа Pyexdg (Netlify Functions).
// Ключи хранятся в Netlify → Project configuration → Environment variables.
import crypto from "node:crypto";
import vm from "node:vm";

export const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];

const clean = (value) => String(value || "").trim().replace(/^["']+|["']+$/g, "");

// Токен бота: убираем пробелы, кавычки и лишнее «bot» в начале — частые ошибки при копировании
export const botToken = () => clean(env("BOT_TOKEN")).replace(/^bot(?=\d)/i, "");
export const adminChatId = () => clean(env("ADMIN_CHAT_ID"));
export const webhookSecret = () => clean(env("WEBHOOK_SECRET"));

export const json = (data, status = 200) => Response.json(data, { status });

export const esc = (value) =>
  String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const nf = new Intl.NumberFormat("ru-RU");
export const money = (n, currency = "₽") => nf.format(Number(n) || 0) + " " + currency;

// Проверка подписи initData по документации Telegram Mini Apps
export function isValidInitData(initData, token, maxAgeSec = 24 * 60 * 60) {
  if (!initData || !token) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (calculated.length !== hash.length) return false;

  const authDate = Number(params.get("auth_date") || 0);
  const isFresh = Date.now() / 1000 - authDate < maxAgeSec;
  return isFresh && crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
}

export function parseInitUser(initData) {
  try {
    const user = JSON.parse(new URLSearchParams(initData).get("user") || "null");
    return user && Number.isSafeInteger(Number(user.id)) ? user : null;
  } catch {
    return null;
  }
}

// Вызов Bot API. Ошибки не бросаем, а возвращаем ответ Telegram ({ ok, description })
export async function tg(method, payload = {}) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
    if (!data.ok) console.error("Telegram", method, data.error_code, data.description);
    return data;
  } catch (err) {
    console.error("Telegram", method, err);
    return { ok: false, description: String(err?.message || err) };
  }
}

// Адрес сайта для кнопки мини-аппа: SITE_URL, иначе адрес, который даёт сам Netlify
export function siteUrl(req) {
  const fromEnv = clean(env("SITE_URL") || env("URL")).replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  try {
    return new URL(req.url).origin;
  } catch {
    return "";
  }
}

// Товары, цены и ссылки берём из того же файла, что и сайт: public/js/config.js
let cache = { at: 0, origin: "", shop: null };
export async function loadShop(origin) {
  if (cache.shop && cache.origin === origin && Date.now() - cache.at < 60_000) return cache.shop;
  const res = await fetch(`${origin}/js/config.js`, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) throw new Error(`config.js: HTTP ${res.status}`);
  const sandbox = { window: {} };
  vm.runInNewContext(await res.text(), sandbox, { timeout: 1000 });
  const shop = sandbox.window.SHOP;
  if (!shop || !Array.isArray(shop.products)) throw new Error("config.js: нет window.SHOP");
  cache = { at: Date.now(), origin, shop };
  return shop;
}

export function telegramUsername(value) {
  let v = String(value || "").trim();
  if (!v) return "";
  v = v.replace(/^https?:\/\//i, "").replace(/^(www\.)?(t\.me|telegram\.me)\//i, "").replace(/^@/, "");
  return v.split(/[/?#]/)[0];
}

const asUrl = (value) => {
  const v = String(value || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, "");
};

// Кнопки соцсетей из SHOP.contacts (только заполненные)
export function socialButtons(shop) {
  const c = shop?.contacts || {};
  const items = [
    { text: "📢 Telegram-канал", url: asUrl(c.channel) },
    { text: "🏷 Авито", url: asUrl(c.avito) },
    { text: "🎵 TikTok", url: asUrl(c.tiktok) },
    { text: "▶️ YouTube", url: asUrl(c.youtube) },
  ].filter((b) => b.url);
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

// Метка, по которой бот понимает, кому переслать ответ владельца
export const userTag = (id) => `#u${id}`;
export const readUserTag = (text) => {
  const m = /#u(\d{3,})/.exec(String(text || ""));
  return m ? m[1] : "";
};

export function buyerHtml(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Покупатель";
  const parts = [`👤 <a href="tg://user?id=${user.id}">${esc(name)}</a>`];
  if (user.username) parts.push("@" + esc(user.username));
  return parts.join(" ") + "\n" + userTag(user.id);
}
