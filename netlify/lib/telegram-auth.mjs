// Общая проверка запроса из Telegram для серверных функций.
// Возвращает { ok: true } или { ok: false, code, status } с точной причиной отказа.
import crypto from "node:crypto";

export const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];

// Токен бота: убираем пробелы, кавычки и лишнее «bot» в начале — частые ошибки при копировании
export const botToken = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");
export const tokenProblem = (token) => (!token ? "telegram_token_missing" : /^\d+:[A-Za-z0-9_-]{30,}$/.test(token) ? null : "telegram_token_format");

export function checkInitData(initData, token, maxAgeSec = 24 * 60 * 60) {
  const problem = tokenProblem(token);
  if (problem) return { ok: false, code: problem, status: 500 };
  if (!initData) return { ok: false, code: "telegram_no_init_data", status: 401 };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, code: "telegram_no_init_data", status: 401 };
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const calculated = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  const same = calculated.length === hash.length && crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
  // Подпись не сошлась — значит, BOT_TOKEN на сервере не от того бота, из которого открыто приложение
  if (!same) return { ok: false, code: "telegram_bad_signature", status: 401 };
  const authDate = Number(params.get("auth_date") || 0);
  if (Date.now() / 1000 - authDate > maxAgeSec) return { ok: false, code: "telegram_expired", status: 401 };
  return { ok: true };
}

// Пользователь Telegram из подписанных данных запуска (вызывать только после успешной checkInitData)
export function initDataUser(initData) {
  try { return JSON.parse(new URLSearchParams(initData || "").get("user") || "null"); } catch (e) { return null; }
}

// Отдельное iOS-приложение (Capacitor) не открывается из Telegram — подписанных initData у него
// нет и быть не может. Вместо этого оно шлёт общий секрет, зашитый в сборку на этапе билда
// (переменная VITE_APP_STANDALONE_SECRET), и сервер сверяет его с STANDALONE_APP_SECRET на Netlify.
// Это не настоящая аутентификация пользователя (секрет один на все установки приложения) —
// подходит для личного использования, но не для публичного распространения без доработки.
export function checkStandaloneSecret(req) {
  const expected = String(env("STANDALONE_APP_SECRET") || "").trim();
  if (!expected) return false;
  const got = String(req.headers.get("x-app-secret") || "").trim();
  if (!got || got.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected)); } catch { return false; }
}

// CORS: бандл отдельного приложения выполняется в WebView с происхождением capacitor://localhost,
// а не с домена Netlify — без этих заголовков браузер молча блокирует чтение ответа.
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Telegram-Init-Data, X-App-Secret, Authorization",
};
export const corsPreflight = () => new Response(null, { status: 204, headers: CORS_HEADERS });
