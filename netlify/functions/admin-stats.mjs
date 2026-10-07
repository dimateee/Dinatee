// Netlify: GET /api/admin-stats — сколько человек всего открывали RITM и сколько активны
// сейчас. Доступно только тем, чей Telegram ID перечислен в ADMIN_TG_IDS (тот же список,
// что и у /api/admin-promo — см. его же комментарий).
import { env } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { getStats } from "../lib/user-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const adminIds = () => String(env("ADMIN_TG_IDS") || "").split(",").map((x) => x.trim()).filter(Boolean);
const isAdmin = (id) => adminIds().includes(String(id));

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const user = auth.user;
  if (!adminIds().length) return json({ error: "admin_not_configured" }, 500);
  if (!isAdmin(user.id)) return json({ error: "not_admin" }, 403);

  const stats = await getStats();
  return json({ stats });
};

export const config = { path: "/api/admin-stats", method: "GET" };
