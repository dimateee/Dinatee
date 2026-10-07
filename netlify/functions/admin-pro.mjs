// Netlify: /api/admin-pro — поддержка: найти человека и вернуть ему Pro.
// Доступно только тем, чей Telegram ID указан в ADMIN_TG_IDS (как /api/admin-promo и /api/admin-stats).
//
// GET  ?q=@username | <Telegram ID>   — кто это, его Pro (до какого числа, история выдач) и все платежи.
// POST { action: "reconcile", userId } — перепроверить все его платежи в Platega: оплаченные, но не
//                                        засчитанные, включат Pro автоматически (правильный путь,
//                                        если человек платил, а Pro «слетела» или не включилась).
// POST { action: "grant", userId, days, note } — выдать N дней вручную (если платежа в Platega нет,
//                                        например, оплата была другим способом). Записывается в историю.
// После выдачи бот пишет человеку в Telegram, что Pro восстановлена.
import { env, botToken } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { getUser, findUserByUsername } from "../lib/user-store.mjs";
import { getPro, grantDays, reconcileUser, paymentHistory } from "../lib/pro-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const adminIds = () => String(env("ADMIN_TG_IDS") || "").split(",").map((x) => x.trim()).filter(Boolean);
const dateRu = (ms) => new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });

async function notify(userId, text) {
  if (!botToken()) return;
  await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: userId, text }),
  }).catch(() => {});
}

async function resolveUser(q) {
  const raw = String(q || "").trim().replace(/^@/, "");
  if (!raw) return null;
  if (/^\d{3,15}$/.test(raw)) return (await getUser(raw)) || { id: Number(raw), firstName: "", username: "" };
  return findUserByUsername(raw);
}

async function view(userId) {
  const [u, pro, payments] = await Promise.all([getUser(userId), getPro(userId), paymentHistory(userId)]);
  return {
    user: { id: Number(userId), firstName: u?.firstName || "", username: u?.username || "", firstSeenAt: u?.firstSeenAt || null, lastSeenAt: u?.lastSeenAt || null },
    pro: { active: pro.active, until: pro.until || 0, plan: pro.plan || null, history: (pro.history || []).slice(0, 20) },
    payments,
  };
}

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  if (!adminIds().length) return json({ error: "admin_not_configured" }, 500);
  if (!adminIds().includes(String(auth.user.id))) return json({ error: "not_admin" }, 403);

  if (req.method === "GET") {
    const u = await resolveUser(new URL(req.url).searchParams.get("q"));
    if (!u?.id) return json({ error: "user_not_found" }, 404);
    return json(await view(u.id));
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body.userId);
  if (!userId) return json({ error: "user_not_found" }, 400);

  if (body.action === "reconcile") {
    const before = await getPro(userId);
    const r = await reconcileUser(userId, { deep: true });
    if (r.granted > 0) await notify(userId, `✅ Мы нашли твою оплату и восстановили RITM Pro — она активна до ${dateRu(r.pro.until)}.\n\nИзвини за неудобство 🙏`);
    return json({ ...(await view(userId)), reconcile: { checked: r.checked, granted: r.granted, wasActive: before.active } });
  }

  if (body.action === "grant") {
    const days = Math.round(Number(body.days));
    if (!Number.isFinite(days) || days < 1 || days > 730) return json({ error: "bad_days" }, 400);
    const pro = await grantDays(userId, days, { plan: "admin", source: "admin", code: `admin:${auth.user.id}`, note: String(body.note || "").slice(0, 200) || null });
    await notify(userId, `✅ RITM Pro восстановлена — она активна до ${dateRu(pro.until)}.\n\nИзвини за неудобство 🙏`);
    return json(await view(userId));
  }

  return json({ error: "bad_action" }, 400);
};

export const config = { path: "/api/admin-pro", method: ["GET", "POST"] };
