// Netlify: POST /api/telegram-webhook
// Telegram присылает сюда сообщения боту. Адрес прописывается один раз ссылкой
// /api/telegram-setup?key=… (см. README).
//
// Что умеет бот:
// • /start, /shop — приветствие, кнопка «Открыть магазин» и кнопки соцсетей;
// • /contacts — все ссылки; /myid — показать chat id (для ADMIN_CHAT_ID);
// • сообщение покупателя → приходит владельцу с меткой #u<id>;
// • владелец отвечает (Reply) на сообщение с меткой → бот пересылает ответ покупателю.
import {
  adminChatId, esc, loadShop, readUserTag, siteUrl, socialButtons, tg, userTag, webhookSecret,
} from "../lib/telegram.mjs";

const ok = () => new Response("ok", { status: 200 });
const MEDIA_WITH_CAPTION = ["photo", "video", "document", "audio", "voice", "animation"];

function shopButton(site) {
  return /^https:\/\//i.test(site)
    ? { text: "🛍 Открыть магазин", web_app: { url: site } }
    : { text: "🛍 Открыть магазин", url: site || "https://t.me" };
}

async function sendWelcome(chatId, from, shop, site) {
  const name = shop?.name || "Pyexdg";
  const email = String(shop?.contacts?.email || "").trim();
  const hello = from?.first_name ? `Привет, ${esc(from.first_name)}!` : "Привет!";
  const lines = [`${hello} Это <b>${esc(name)}</b> 🌈`];
  if (shop?.tagline) lines.push(`<i>${esc(shop.tagline)}</i>`);
  lines.push(
    "",
    "🛍 Откройте магазин кнопкой ниже: каталог, корзина и заказ в пару нажатий.",
    "🔎 Не нашли нужное? В магазине есть заявка «Под заказ».",
    "💬 Есть вопрос? Пишите прямо сюда, ответим.",
  );
  if (email) lines.push(`✉️ Почта: ${esc(email)}`);
  const text = lines.join("\n");

  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[shopButton(site)], ...socialButtons(shop)] },
  });
}

async function sendContacts(chatId, shop, site) {
  const email = String(shop?.contacts?.email || "").trim();
  const rows = socialButtons(shop);
  const text = ["<b>Мы на связи</b> 💫", "", "Подписывайтесь, чтобы не пропустить новинки."];
  if (email) text.push(`✉️ Почта: ${esc(email)}`);
  return tg("sendMessage", {
    chat_id: chatId,
    text: text.join("\n"),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [...rows, [shopButton(site)]] },
  });
}

function whoHtml(from) {
  const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "Покупатель";
  const parts = [`👤 <a href="tg://user?id=${from.id}">${esc(name)}</a>`];
  if (from?.username) parts.push("@" + esc(from.username));
  return parts.join(" ") + "\n" + userTag(from.id);
}

// Сообщение покупателя → владельцу
async function relayToAdmin(msg, admin) {
  const who = whoHtml(msg.from);
  if (msg.text) {
    return tg("sendMessage", {
      chat_id: admin,
      text: `💬 <b>Сообщение от покупателя</b>\n\n${esc(msg.text.slice(0, 3500))}\n\n${who}`,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  }
  const kind = MEDIA_WITH_CAPTION.find((k) => msg[k]);
  if (kind) {
    const caption = [msg.caption ? esc(msg.caption.slice(0, 800)) : "", "💬 Сообщение от покупателя", who].filter(Boolean).join("\n\n");
    return tg("copyMessage", { chat_id: admin, from_chat_id: msg.chat.id, message_id: msg.message_id, caption, parse_mode: "HTML" });
  }
  // стикеры, кружки и прочее без подписи: сначала заголовок с меткой, потом само сообщение
  await tg("sendMessage", { chat_id: admin, text: `💬 <b>Сообщение от покупателя</b> (ниже)\n\n${who}`, parse_mode: "HTML" });
  return tg("copyMessage", { chat_id: admin, from_chat_id: msg.chat.id, message_id: msg.message_id });
}

async function handleMessage(msg, req) {
  const chatId = msg.chat.id;
  const admin = adminChatId();
  const isAdmin = Boolean(admin) && String(chatId) === admin;
  const text = String(msg.text || "").trim();
  const cmd = text.startsWith("/") ? text.split(/\s+/)[0].split("@")[0].toLowerCase() : "";

  if (cmd === "/myid") {
    return tg("sendMessage", {
      chat_id: chatId,
      text: `Ваш chat id: <code>${chatId}</code>\n\nЧтобы получать заказы, впишите это число в переменную <b>ADMIN_CHAT_ID</b> на Netlify и нажмите Redeploy.`,
      parse_mode: "HTML",
    });
  }

  if (cmd === "/start" || cmd === "/shop" || cmd === "/contacts" || cmd === "/help") {
    const site = siteUrl(req);
    const shop = await loadShop(new URL(req.url).origin).catch((err) => { console.error(err); return null; });
    if (cmd === "/contacts") return sendContacts(chatId, shop, site);
    await sendWelcome(chatId, msg.from, shop, site);
    if (isAdmin && (cmd === "/start" || cmd === "/help")) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "👑 Вы владелец магазина. Сюда будут приходить заказы, заявки и сообщения покупателей.\n\nЧтобы ответить покупателю, нажмите «Ответить» на его заказе или сообщении и напишите текст: бот перешлёт его покупателю.",
      });
    }
    return;
  }

  if (isAdmin) {
    const reply = msg.reply_to_message;
    const target = reply ? readUserTag(reply.text || reply.caption) : "";
    if (target) {
      const r = await tg("copyMessage", { chat_id: target, from_chat_id: chatId, message_id: msg.message_id });
      return tg("sendMessage", {
        chat_id: chatId,
        text: r.ok ? "✓ Отправлено покупателю" : `Не получилось отправить: ${r.description || "ошибка"}. Возможно, покупатель остановил бота.`,
        reply_parameters: { message_id: msg.message_id, allow_sending_without_reply: true },
      });
    }
    if (!cmd) {
      return tg("sendMessage", {
        chat_id: chatId,
        text: "Чтобы ответить покупателю, нажмите «Ответить» на его заказе или сообщении (там есть метка #u…) и напишите текст.",
      });
    }
    return;
  }

  if (cmd || !admin) return; // неизвестные команды покупателей не пересылаем
  return relayToAdmin(msg, admin);
}

export default async (req) => {
  const secret = webhookSecret();
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await req.json().catch(() => ({}));
  const msg = update.message;
  if (msg?.chat?.type === "private" && msg.from && !msg.from.is_bot) {
    try {
      await handleMessage(msg, req);
    } catch (err) {
      console.error(err);
    }
  }
  return ok(); // Telegram должен получить 200, иначе будет повторять запрос
};

export const config = { path: "/api/telegram-webhook", method: "POST" };
