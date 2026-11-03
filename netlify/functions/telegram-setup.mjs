// Netlify: GET /api/telegram-setup?key=<WEBHOOK_SECRET>
// Откройте эту ссылку один раз после деплоя: функция подключит бота к сайту
// (вебхук, команды, кнопка «Магазин» внизу чата и описание бота).
import { adminChatId, botToken, esc, loadShop, siteUrl, tg, webhookSecret } from "../lib/telegram.mjs";

function page(title, rows = [], status = 200, hint = "") {
  const list = rows.map(([label, okay, note]) =>
    `<li class="${okay ? "ok" : "bad"}"><span>${okay ? "✓" : "✗"}</span><div><b>${esc(label)}</b>${note ? `<small>${esc(note)}</small>` : ""}</div></li>`).join("");
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0a14;color:#f5f3ff;font:16px/1.5 system-ui,sans-serif;padding:16px}
main{width:min(520px,100%);padding:28px;border-radius:24px;background:#16132a;border:1px solid rgba(255,255,255,.12)}
h1{margin:0 0 16px;font-size:22px} ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
li{display:flex;gap:12px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.05)}
li span{font-weight:800} li.ok span{color:#4fcb7a} li.bad span{color:#ff8a7a}
small{display:block;color:#a9a5c7;word-break:break-word} p{color:#a9a5c7;margin:16px 0 0}
.bar{height:4px;border-radius:4px;margin:-28px -28px 24px;background:linear-gradient(90deg,#ff8a7a,#ffa23a,#ffe14d,#b6e35a,#4fc3d9,#5b8cff,#8b6cff,#d46cf0)}
</style></head><body><main><div class="bar"></div><h1>${esc(title)}</h1><ul>${list}</ul>${hint ? `<p>${hint}</p>` : ""}</main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export default async (req) => {
  const secret = webhookSecret();
  if (!botToken()) return page("Не задан BOT_TOKEN", [["Добавьте BOT_TOKEN в Environment variables и сделайте Redeploy", false]], 500);
  if (!/^[A-Za-z0-9_-]{8,256}$/.test(secret)) {
    return page("Нужен WEBHOOK_SECRET", [["WEBHOOK_SECRET: от 8 символов, только латиница, цифры, _ и -", false]], 500);
  }
  if (new URL(req.url).searchParams.get("key") !== secret) return page("Неверный ключ", [["В ссылке должно быть ?key=ваш WEBHOOK_SECRET", false]], 403);

  const site = siteUrl(req);
  const shop = await loadShop(new URL(req.url).origin).catch(() => null);
  const name = shop?.name || "Pyexdg";
  const rows = [];

  const me = await tg("getMe");
  rows.push(["Бот найден", me.ok, me.ok ? "@" + me.result.username : me.description]);
  if (!me.ok) return page("Бот не подключён", rows, 502, "Проверьте BOT_TOKEN: его выдаёт @BotFather.");

  const hook = await tg("setWebhook", {
    url: `${site}/api/telegram-webhook`,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  rows.push(["Вебхук", hook.ok, hook.ok ? `${site}/api/telegram-webhook` : hook.description]);

  const commands = await tg("setMyCommands", {
    commands: [
      { command: "start", description: "Открыть магазин" },
      { command: "shop", description: "Каталог и корзина" },
      { command: "contacts", description: "Наши соцсети" },
    ],
  });
  rows.push(["Команды бота", commands.ok, commands.ok ? "/start, /shop, /contacts" : commands.description]);

  const menu = await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Магазин", web_app: { url: site } } });
  rows.push(["Кнопка «Магазин» в чате", menu.ok, menu.ok ? site : menu.description]);

  const tagline = shop?.tagline ? ` ${shop.tagline}.` : "";
  const desc = await tg("setMyDescription", {
    description: `${name} 🌈${tagline}\n\nКаталог, корзина и заказ прямо в Telegram. Ищете вещь под заказ? Оставьте заявку или просто напишите сюда.`.slice(0, 512),
  });
  const short = await tg("setMyShortDescription", { short_description: `${name}: каталог, заказ и связь прямо в Telegram`.slice(0, 120) });
  rows.push(["Описание бота", desc.ok && short.ok, desc.ok && short.ok ? "" : desc.description || short.description]);

  const admin = adminChatId();
  rows.push([
    "Получатель заказов (ADMIN_CHAT_ID)",
    Boolean(admin),
    admin ? admin : "Напишите боту /myid, впишите число в ADMIN_CHAT_ID и нажмите Redeploy",
  ]);

  const allOk = rows.every(([, okay]) => okay);
  return page(allOk ? `Бот @${me.result.username} подключён ✓` : "Почти готово", rows, 200,
    `Откройте <a style="color:#ffe14d" href="https://t.me/${esc(me.result.username)}">@${esc(me.result.username)}</a> и нажмите «Запустить».`);
};

export const config = { path: "/api/telegram-setup", method: "GET" };
