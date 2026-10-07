// Единая проверка пользователя для серверных функций — и для Mini App, и для сайта.
//
// Mini App (внутри Telegram) присылает подписанные Telegram данные запуска в заголовке
// X-Telegram-Init-Data — как и раньше. Сайт и установленное с сайта приложение (PWA)
// открываются не из Telegram, поэтому человек один раз входит через бота (см. auth-start /
// auth-poll и telegram-webhook), а дальше присылает подписанный сервером токен сессии
// в заголовке Authorization: Bearer <токен>.
//
// В обоих случаях пользователь — это тот же Telegram-аккаунт с тем же числовым ID, поэтому
// Pro, промокоды и данные одинаковы и в Mini App, и на сайте.
import crypto from "node:crypto";
import { env, botToken, tokenProblem, checkInitData, initDataUser } from "./telegram-auth.mjs";

const SESSION_DAYS = 180;

// Секрет для подписи сессий. Можно задать свой (SESSION_SECRET на Netlify), иначе он выводится
// из BOT_TOKEN — тогда ничего дополнительно настраивать не нужно. Смена BOT_TOKEN или
// SESSION_SECRET разлогинивает всех на сайте (в Mini App ничего не меняется).
function sessionSecret() {
  const own = String(env("SESSION_SECRET") || "").trim();
  if (own) return own;
  const token = botToken();
  if (tokenProblem(token)) return "";
  return crypto.createHmac("sha256", "ritm-web-session").update(token).digest("hex");
}

const sign = (secret, data) => crypto.createHmac("sha256", secret).update(data).digest();

export function signSession(user) {
  const secret = sessionSecret();
  if (!secret) throw Object.assign(new Error("session_secret_missing"), { code: "telegram_token_missing" });
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    uid: Number(user.id),
    fn: String(user.first_name || "").slice(0, 64),
    un: String(user.username || "").slice(0, 64),
    iat: now,
    exp: now + SESSION_DAYS * 24 * 60 * 60,
  })).toString("base64url");
  return `v1.${payload}.${sign(secret, `v1.${payload}`).toString("base64url")}`;
}

export function verifySession(token) {
  const secret = sessionSecret();
  if (!secret || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const expected = sign(secret, `v1.${parts[1]}`);
  const got = Buffer.from(parts[2], "base64url");
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  let p = null;
  try { p = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); } catch (e) { return null; }
  if (!p?.uid || !p.exp || p.exp * 1000 < Date.now()) return null;
  return { id: p.uid, first_name: p.fn || "", username: p.un || "", exp: p.exp };
}

// Возвращает { ok: true, user, via: "telegram" | "web" } или { ok: false, code, status }.
// maxAgeSec — сколько живёт подпись Telegram (по умолчанию сутки). Для чтения своего статуса Pro
// её продлевают: Mini App может днями висеть свёрнутым в Telegram, и раньше в этом случае сервер
// отвечал «сессия устарела», а приложение показывало бесплатный план вместо оплаченной Pro.
export function authUser(req, { maxAgeSec } = {}) {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
  if (bearer) {
    const user = verifySession(bearer[1].trim());
    return user ? { ok: true, user, via: "web" } : { ok: false, code: "session_invalid", status: 401 };
  }
  const initData = req.headers.get("x-telegram-init-data");
  if (initData) {
    const auth = checkInitData(initData, botToken(), maxAgeSec);
    if (!auth.ok) return auth;
    const user = initDataUser(initData);
    if (!user?.id) return { ok: false, code: "telegram_no_init_data", status: 401 };
    return { ok: true, user, via: "telegram" };
  }
  const problem = tokenProblem(botToken());
  if (problem) return { ok: false, code: problem, status: 500 };
  return { ok: false, code: "auth_required", status: 401 };
}

// Username бота — нужен для ссылок t.me/<бот>. Берём из Telegram один раз на холодный старт функции.
let botUsernameCache = null;
export async function botUsername() {
  if (env("BOT_USERNAME")) return String(env("BOT_USERNAME")).replace(/^@/, "").trim();
  if (botUsernameCache) return botUsernameCache;
  try {
    const d = await (await fetch(`https://api.telegram.org/bot${botToken()}/getMe`)).json();
    botUsernameCache = d?.result?.username || null;
  } catch (e) { /* нет связи с Telegram — вернём null */ }
  return botUsernameCache;
}
