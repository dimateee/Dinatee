// Серверная функция Netlify: /api/telegram-webhook
// Telegram шлёт сюда апдейты бота. Обязательно: ответить на pre_checkout_query
// в течение 10 секунд, иначе платёж автоматически отклоняется.
// Один раз после деплоя пропиши этот адрес в setWebhook (см. README).
const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];
// Токен бота: убираем пробелы, кавычки и лишнее «bot» в начале — частые ошибки при копировании
const botToken = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");

export default async (req) => {
  const update = await req.json().catch(() => ({}));
  const token = botToken();
  const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

  try {
    if (update.pre_checkout_query) {
      await fetch(api("answerPreCheckoutQuery"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
      });
    }
    if (update.message?.successful_payment) {
      // Здесь стоит сохранить update.message.successful_payment.telegram_payment_charge_id
      // и update.message.from.id в базу, чтобы подтверждать Pro-статус на сервере, а не только в localStorage телефона.
      console.log("Оплачено:", update.message.from?.id, update.message.successful_payment);
    }

    // Информация, необходимая пользователю и банку при согласовании.
    // Не публикуем ИП/ООО/ИНН и другие персональные данные.
    const text = String(update.message?.text || "").trim().toLowerCase();
    if (text === "/start" || text === "/legal" || text === "документы") {
      const message = [
        "ASCEND — документы и информация о сервисе",
        "",
        "Тарифы FORMA Pro:",
        "• 1 месяц — 150 ₽",
        "• 12 месяцев — 1200 ₽, разовый платёж",
        "",
        "Поддержка: @doltiii",
        "Политика конфиденциальности: кнопка ниже",
        "Пользовательское соглашение: кнопка ниже",
        "Кодовое слово для проверки: Plaтега",
      ].join("\n");

      await fetch(api("sendMessage"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: update.message.chat.id,
          text: message,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "Политика конфиденциальности", url: "https://telegra.ph/Politika-konfidencialnosti-08-01-83" },
              ],
              [
                { text: "Пользовательское соглашение", url: "https://telegra.ph/Polzovatelskoe-soglashenie-08-01-39" },
              ],
              [
                { text: "Поддержка", url: "https://t.me/doltiii" },
              ],
            ],
          },
        }),
      });
    }
  } catch (err) {
    console.error(err);
  }
  return new Response("ok", { status: 200 });
};

export const config = { path: "/api/telegram-webhook", method: "POST" };
