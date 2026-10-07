// Netlify: /api/admin-promo — создание и список промокодов на Pro.
// Доступно только тем, чей Telegram ID перечислен в ADMIN_TG_IDS на Netlify (через запятую).
// Два типа кода: "days" — сразу выдаёт дни Pro; "discount" — скидка в процентах на оплату.
import { env } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { createPromoCodes, listPromoCodes } from "../lib/promo-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const adminIds = () => String(env("ADMIN_TG_IDS") || "").split(",").map((x) => x.trim()).filter(Boolean);
const isAdmin = (id) => adminIds().includes(String(id));

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const user = auth.user;
  if (!adminIds().length) return json({ error: "admin_not_configured" }, 500);
  if (!isAdmin(user.id)) return json({ error: "not_admin" }, 403);

  if (req.method === "GET") {
    const codes = await listPromoCodes(user.id);
    return json({ codes });
  }

  const body = await req.json().catch(() => ({}));
  const type = body.type === "discount" ? "discount" : "days";
  // Сколько РАЗНЫХ кодов создать за один запрос — раздать сразу пачку одноразовых кодов
  // (например, 50 штук на розыгрыш разным людям).
  const count = Math.max(1, Math.min(200, Math.round(Number(body.count)) || 1));
  // Сколько раз можно использовать КАЖДЫЙ из этих кодов — 1 (по умолчанию) означает обычный
  // одноразовый код; 10/50/100 — один и тот же код срабатывает у стольких разных людей.
  const maxUses = Math.max(1, Math.min(100000, Math.round(Number(body.maxUses)) || 1));

  if (type === "discount") {
    const percent = Math.round(Number(body.percent));
    if (!Number.isFinite(percent) || percent < 1 || percent > 90) return json({ error: "bad_percent" }, 400);
    const records = await createPromoCodes({ type: "discount", percent }, user.id, count, maxUses);
    return json({ codes: records.map((r) => ({ code: r.code, type: r.type, percent: r.percent, createdAt: r.createdAt, maxUses: r.maxUses, uses: 0 })) });
  }

  const days = Math.round(Number(body.days));
  if (!Number.isFinite(days) || days < 1 || days > 365) return json({ error: "bad_days" }, 400);
  const records = await createPromoCodes({ type: "days", days }, user.id, count, maxUses);
  return json({ codes: records.map((r) => ({ code: r.code, type: r.type, days: r.days, createdAt: r.createdAt, maxUses: r.maxUses, uses: 0 })) });
};

export const config = { path: "/api/admin-promo", method: ["GET", "POST"] };
