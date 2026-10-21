// /api/telegram-webhook — сообщения боту и платежи Telegram Stars.
// Обязательно: ответить на pre_checkout_query в течение 10 секунд, иначе платёж отклоняется.
import { env, appUrl, bot, grantPremium, PRICE_STARS } from "../lib/shared.mjs";

const parsePayload = (s) => { try { return JSON.parse(s); } catch { return {}; } };

export default async (req) => {
  const secret = env("TELEGRAM_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("forbidden", { status: 403 });

  const update = await req.json().catch(() => ({}));
  try {
    const q = update.pre_checkout_query;
    if (q) {
      const payload = parsePayload(q.invoice_payload);
      const valid = q.currency === "XTR" && q.total_amount >= PRICE_STARS() && String(payload.u) === String(q.from.id);
      await bot("answerPreCheckoutQuery", valid
        ? { pre_checkout_query_id: q.id, ok: true }
        : { pre_checkout_query_id: q.id, ok: false, error_message: "Счёт устарел. Откройте оплату заново из приложения." });
    }

    const msg = update.message;
    const paid = msg?.successful_payment;
    if (paid && paid.currency === "XTR") {
      const until = paid.subscription_expiration_date ? new Date(paid.subscription_expiration_date * 1000) : null;
      const granted = await grantPremium({ userId: msg.from.id, paymentId: `tg:${paid.telegram_payment_charge_id}`, source: "stars", until });
      if (granted) await bot("sendMessage", { chat_id: msg.chat.id, text: "Спасибо! ОГЭ Квест PRO активен 🎉 Возвращайся в приложение." });
    }

    const text = String(msg?.text || "").trim().toLowerCase();
    if (text.startsWith("/start")) {
      await bot("sendMessage", {
        chat_id: msg.chat.id,
        text: [
          "Привет! Я Огуша 🦉",
          "",
          "Помогу подготовиться к ОГЭ по математике простыми шагами:",
          "⚡ разминка с лёгкими примерами",
          "🗺️ все задания первой части с теорией и разбором",
          "📝 пробные варианты с оценкой по шкале ФИПИ",
          "🧠 вторая часть с решениями",
          "",
          "Нажми кнопку ниже, чтобы начать!",
        ].join("\n"),
        reply_markup: appUrl() ? { inline_keyboard: [[{ text: "🚀 Открыть ОГЭ Квест", web_app: { url: appUrl() } }]] } : undefined,
      });
    } else if (text.startsWith("/paysupport") || text.startsWith("/support")) {
      // Telegram требует от ботов с оплатой в Stars команду /paysupport
      const contact = env("SUPPORT_CONTACT") || "администратору бота";
      await bot("sendMessage", { chat_id: msg.chat.id, text: `По вопросам оплаты напишите ${contact}. Укажите дату платежа и ваш Telegram ID: ${msg.from.id}.` });
    }
  } catch (err) {
    console.error(err);
  }
  return new Response("ok");
};

export const config = { path: "/api/telegram-webhook", method: "POST" };
