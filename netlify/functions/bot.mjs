// Серверная функция Netlify по адресу /api/bot (необязательная).
// Отвечает на /start в чате с ботом кнопкой «Играть», которая открывает игру внутри Telegram.
// Подключение описано в README (раздел «Кнопка «Играть» по команде /start»).
const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];
// Токен бота: убираем пробелы, кавычки и лишнее «bot» в начале — частые ошибки при копировании
const botToken = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");

export default async (req) => {
  // Если задан WEBHOOK_SECRET, принимаем запросы только от Telegram
  const secret = env("WEBHOOK_SECRET");
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await req.json().catch(() => ({}));
  const msg = update.message;
  const token = botToken();
  // URL сайта Netlify подставляет сам; WEBAPP_URL — если адрес игры другой
  const appUrl = env("WEBAPP_URL") || env("URL");
  if (msg && token && appUrl && /^\/(start|play|game)/i.test(msg.text || "")) {
    const text = [
      "🏕 «Окраина» — колония на краю мира.",
      "",
      "Ваши колонисты потерпели крушение на дикой планете. Стройте дома, выращивайте еду, отбивайтесь от налётчиков и переживите зиму.",
      "",
      "Прогресс сохраняется в облаке Telegram.",
    ].join("\n");
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: msg.chat.id,
        text,
        reply_markup: { inline_keyboard: [[{ text: "🎮 Играть", web_app: { url: appUrl } }]] },
      }),
    }).catch((e) => console.error("sendMessage failed", e));
  }
  return new Response("ok");
};

export const config = { path: "/api/bot" };
