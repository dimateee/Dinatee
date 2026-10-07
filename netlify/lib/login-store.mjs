// Вход на сайт через Telegram-бота.
//
// 1. Сайт просит /api/auth-start — сервер создаёт одноразовую заявку на вход: публичный token
//    (уходит в ссылку t.me/<бот>?start=login_<token>) и секрет, который знает только этот браузер.
// 2. Человек открывает ссылку, жмёт «Старт», бот присылает кнопку «Подтвердить вход».
//    Подтверждение — отдельным нажатием, чтобы чужая ссылка не залогинила кого-то случайно.
// 3. Сайт опрашивает /api/auth-poll с token и секретом; после подтверждения получает токен сессии.
//    Заявка одноразовая и живёт 10 минут.
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const TTL = 10 * 60 * 1000;
const store = () => globalThis.__ritmAuthStore || getStore({ name: "ritm-auth", consistency: "strong" });
const hash = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const validToken = (t) => typeof t === "string" && /^[A-Za-z0-9_-]{20,40}$/.test(t);
const expired = (rec) => !rec || Date.now() - (rec.createdAt || 0) > TTL;

export async function createLogin() {
  const token = crypto.randomBytes(18).toString("base64url");
  const secret = crypto.randomBytes(24).toString("base64url");
  const createdAt = Date.now();
  await store().setJSON(`login:${token}`, { secretHash: hash(secret), createdAt, status: "pending" });
  return { token, secret, expiresAt: createdAt + TTL };
}

export async function getLogin(token) {
  if (!validToken(token)) return null;
  const rec = await store().get(`login:${token}`, { type: "json" }).catch(() => null);
  return expired(rec) ? null : rec;
}

// Нажатие «Подтвердить вход» в боте
export async function confirmLogin(token, from) {
  const rec = await getLogin(token);
  if (!rec) return { ok: false, reason: "expired" };
  if (rec.status === "confirmed") return { ok: String(rec.user?.id) === String(from.id), reason: "already" };
  await store().setJSON(`login:${token}`, {
    ...rec,
    status: "confirmed",
    confirmedAt: Date.now(),
    user: { id: Number(from.id), first_name: String(from.first_name || ""), username: String(from.username || "") },
  });
  return { ok: true };
}

// Опрос со стороны сайта. После успешного входа заявка удаляется — второй раз ей не войти.
export async function consumeLogin(token, secret) {
  if (!validToken(token) || typeof secret !== "string") return { status: "expired" };
  const s = store();
  const rec = await s.get(`login:${token}`, { type: "json" }).catch(() => null);
  if (!rec) return { status: "expired" };
  const a = Buffer.from(rec.secretHash || ""), b = Buffer.from(hash(secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { status: "expired" };
  if (expired(rec)) {
    await s.delete(`login:${token}`).catch(() => {});
    return { status: "expired" };
  }
  if (rec.status !== "confirmed" || !rec.user?.id) return { status: "pending" };
  await s.delete(`login:${token}`).catch(() => {});
  return { status: "ok", user: rec.user };
}
