// Серверная функция Netlify: /api/telegram-webhook — сюда Telegram присылает всё, что пишут боту.
// Обязательно: ответить на pre_checkout_query в течение 10 секунд, иначе платёж отклоняется.
//
// Вебхук сайт ставит сам (см. netlify/lib/telegram-bot.mjs) — вручную по ссылке больше не нужно.
// Каждый запрос проверяется по секрету: подтверждение входа на сайт и восстановление покупки
// выполняются только для запросов, которые точно пришли от Telegram.
//
// Команды: /start (приветствие, статус Pro, кнопки), /app, /pro (подписка и «Восстановить покупку»),
// /help, /legal. Плюс вход на сайт: /start login_<код> → кнопка «Подтвердить вход».
import { env, botToken } from "../lib/telegram-auth.mjs";
import { tg, checkWebhookSecret, repairWebhook, siteBase } from "../lib/telegram-bot.mjs";
import { getLogin, confirmLogin } from "../lib/login-store.mjs";
import { getPro, restoreForUser } from "../lib/pro-store.mjs";

// Документы — страницы сайта (public/legal). Адрес сайта берём так же, как для остальных ссылок бота (siteBase).
const LEGAL_FALLBACK_SITE = "https://ritmru.ru";
const SUPPORT_URL = "https://t.me/doltiii";
const COMMANDS = [
  { command: "start", description: "Открыть RITM и начать" },
  { command: "app", description: "Открыть приложение" },
  { command: "pro", description: "Подписка Pro и восстановление покупки" },
  { command: "help", description: "Что умеет RITM" },
  { command: "legal", description: "Документы и поддержка" },
];
const esc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dateRu = (ms) => new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });

export default async (req) => {
  const update = await req.json().catch(() => ({}));
  if (!botToken()) return new Response("ok");
  const origin = new URL(req.url).origin;
  // Запрос без нашего секрета: либо вебхук ставили вручную (без секрета) — тогда сразу
  // переставляем его с секретом, либо это подделка. В обоих случаях опасные действия не выполняем.
  const verified = checkWebhookSecret(req);
  if (!verified) await repairWebhook(origin).catch(() => {});

  const appUrl = env("WEB_APP_URL") || siteBase(origin);
  const siteUrl = siteBase(origin);
  const openButton = { text: "🚀 Открыть RITM", web_app: { url: appUrl } };
  const siteButton = { text: "🌐 Сайт и приложение на телефон", url: siteUrl };
  const proButton = { text: "💎 Подписка Pro", callback_data: "pro" };
  const supportButton = { text: "💬 Поддержка", url: SUPPORT_URL };
  const send = (chatId, text, keyboard) => tg("sendMessage", {
    chat_id: chatId, text, parse_mode: "HTML", link_preview_options: { is_disabled: true },
    reply_markup: keyboard ? { inline_keyboard: keyboard } : undefined,
  });
  const answer = (cq, text) => tg("answerCallbackQuery", { callback_query_id: cq.id, text }).catch(() => {});

  // Статус Pro одной строкой — в приветствии и в /pro
  const proLine = async (userId) => {
    const p = await getPro(userId).catch(() => null);
    if (p?.active) return `💎 Pro активна до <b>${dateRu(p.until)}</b>`;
    if (p?.until) return `Pro закончилась ${dateRu(p.until)}. Продлить можно в приложении.`;
    return "Сейчас бесплатный план. Pro снимает лимиты на ИИ и открывает полную статистику — от 150 ₽.";
  };
  const sendPro = async (chatId, userId) => send(chatId, [
    "<b>Подписка RITM Pro</b>",
    "",
    await proLine(userId),
    "",
    "Платил, а Pro не видна? Нажми «Восстановить покупку» — я перепроверю твои платежи. Если не найдётся — напиши в поддержку и приложи чек.",
  ].join("\n"), [
    [{ text: "🔄 Восстановить покупку", callback_data: "restore" }],
    [openButton],
    [supportButton],
  ]);

  try {
    if (update.pre_checkout_query) {
      await tg("answerPreCheckoutQuery", { pre_checkout_query_id: update.pre_checkout_query.id, ok: true });
    }

    // ---------- Нажатия кнопок ----------
    const cq = update.callback_query;
    if (cq) {
      const data = String(cq.data || "");
      if (data.startsWith("login:")) {
        if (!verified) {
          await answer(cq, "Бот обновляет подключение — нажми «Подтвердить вход» ещё раз через пару секунд");
        } else {
          const result = await confirmLogin(data.slice(6), cq.from);
          await answer(cq, result.ok ? "Готово! Возвращайся в RITM" : "Ссылка устарела — начни вход на сайте заново");
          if (cq.message?.chat?.id) {
            await tg("editMessageText", {
              chat_id: cq.message.chat.id,
              message_id: cq.message.message_id,
              text: result.ok
                ? "✅ Вход подтверждён.\n\nВозвращайся в браузер или приложение RITM — вход завершится сам через пару секунд."
                : "⌛ Эта ссылка для входа устарела. Вернись на сайт и нажми «Войти через Telegram» ещё раз.",
            }).catch(() => {});
          }
        }
      } else if (data === "pro") {
        await answer(cq);
        await sendPro(cq.message?.chat?.id || cq.from.id, cq.from.id);
      } else if (data === "restore") {
        if (!verified) {
          await answer(cq, "Попробуй ещё раз через пару секунд");
        } else {
          await answer(cq, "Проверяю платежи…");
          const r = await restoreForUser(cq.from.id).catch(() => null);
          const chatId = cq.message?.chat?.id || cq.from.id;
          if (!r) await send(chatId, "Не получилось связаться с платёжным сервисом. Попробуй через пару минут.");
          else if (r.tooOften) await send(chatId, "Я только что проверял — подожди минуту и нажми ещё раз.");
          else if (r.granted > 0) await send(chatId, `✅ Нашёл оплату и восстановил Pro — она активна до <b>${dateRu(r.pro.until)}</b>.\n\nИзвини за неудобство 🙏`, [[openButton]]);
          else if (r.pro?.active) await send(chatId, `Всё в порядке: Pro активна до <b>${dateRu(r.pro.until)}</b>. Если в приложении она не видна — закрой и открой его заново.`, [[openButton]]);
          else await send(chatId, "Оплаченных платежей за твоим аккаунтом не нашлось. Если ты платил — напиши в поддержку и приложи чек из банка, вернём Pro вручную.", [[supportButton]]);
        }
      } else {
        await answer(cq);
      }
      return new Response("ok");
    }

    const msg = update.message;
    if (msg?.successful_payment) console.log("Оплачено через Telegram:", msg.from?.id, msg.successful_payment);
    const text = String(msg?.text || "").trim();
    if (!msg?.chat?.id || !text) return new Response("ok");
    // «/start@ИмяБота …» в группах — то же самое, что «/start …»
    const cmdText = text.replace(/^(\/\w+)@\w+/, "$1");
    const lower = cmdText.toLowerCase();
    const chatId = msg.chat.id;
    const from = msg.from || {};

    // ---------- Вход на сайт: /start login_<код> ----------
    const loginMatch = /^\/start\s+login_([A-Za-z0-9_-]{20,40})$/.exec(cmdText);
    if (loginMatch) {
      const login = await getLogin(loginMatch[1]);
      if (!login) {
        await send(chatId, "⌛ Ссылка для входа устарела. Вернись на сайт RITM и нажми «Войти через Telegram» ещё раз.", [[siteButton]]);
      } else {
        await send(chatId, [
          "🔐 <b>Вход в RITM на сайте</b>",
          "",
          "Нажми «Подтвердить вход», чтобы открыть веб-версию RITM под этим аккаунтом Telegram. Pro, друзья и все данные будут те же, что и в Mini App.",
          "",
          "Если ты сейчас не входил на сайт — просто проигнорируй это сообщение.",
        ].join("\n"), [[{ text: "✅ Подтвердить вход", callback_data: `login:${loginMatch[1]}` }]]);
      }
      return new Response("ok");
    }

    // ---------- Команды ----------
    if (lower === "/start" || lower.startsWith("/start ")) {
      const hello = from.first_name ? `👋 Привет, <b>${esc(from.first_name)}</b>!` : "👋 Привет!";
      await send(chatId, [
        `${hello} Я <b>RITM</b> — тренировки, питание и привычки в одном ритме.`,
        "",
        "🏋️ Программа силовых под твою цель — вес и повторы растут сами",
        "🏃 Беговой план с пульсовыми зонами",
        "📸 Калории и БЖУ по фото еды, штрихкоду или тексту",
        "📅 Задачи, привычки и календарь",
        "👥 Друзья, чат и совместные тренировки",
        "🌅 Зарядка, дыхание, дневник и книги",
        "",
        await proLine(from.id),
        "",
        "Жми <b>«Открыть RITM»</b> — анкета на минуту, и программа с нормой калорий готовы. RITM есть и на сайте, и приложением на телефоне — аккаунт и Pro те же.",
      ].join("\n"), [[openButton], [siteButton], [proButton, supportButton]]);
      await tg("setMyCommands", { commands: COMMANDS }).catch(() => {});
    } else if (lower === "/app" || lower === "/open") {
      await send(chatId, "Открывай RITM и продолжай 💪", [[openButton], [siteButton]]);
    } else if (lower === "/pro" || lower === "/restore" || lower === "подписка") {
      await sendPro(chatId, from.id);
    } else if (lower === "/help" || lower === "помощь") {
      await send(chatId, [
        "<b>Что умеет RITM</b>",
        "",
        "🏋️ Силовые — фулбади под цель, гид по подходам с таймером отдыха и фото техники",
        "🏃 Бег — 3–4 пробежки в неделю: кроссы, длительная и интервалы",
        "🍎 Питание — норма КБЖУ, дневник по фото, тексту и штрихкоду, вода, рецепты",
        "📅 Календарь — задачи, повторы и привычки",
        "👥 Друзья — чат, совместные тренировки и общие цели",
        "🌅 Зарядка, дыхание, дневник, книги и челленджи",
        "",
        "Данные одинаковые в Telegram, на сайте и в приложении на телефоне.",
        "",
        "Команды: /app — открыть, /pro — подписка, /legal — документы.",
      ].join("\n"), [[openButton], [supportButton]]);
    } else if (lower === "/legal" || lower === "документы") {
      const legalBase = siteUrl || LEGAL_FALLBACK_SITE;
      await send(chatId, "Документы RITM, тарифы и поддержка — ниже.", [
        [{ text: "Тарифы и оплата (оферта)", url: `${legalBase}/offer` }],
        [{ text: "Политика конфиденциальности", url: `${legalBase}/privacy` }],
        [{ text: "Пользовательское соглашение", url: `${legalBase}/terms` }],
        [supportButton],
      ]);
    } else if (text.startsWith("/")) {
      await send(chatId, "Не знаю такой команды 🙂 Вот что есть: /start, /app, /pro, /help, /legal", [[openButton]]);
    } else {
      // Бот не должен молчать на обычные сообщения
      await send(chatId, "Я не переписываюсь, зато считаю калории и веду тренировки 🙂\nВсё это — в приложении:", [[openButton], [supportButton]]);
    }
  } catch (err) {
    console.error("telegram-webhook", err);
  }
  return new Response("ok", { status: 200 });
};

export const config = { path: "/api/telegram-webhook", method: "POST" };
