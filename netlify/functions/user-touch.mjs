// Netlify: POST /api/user-touch — лёгкий "пинг" при открытии приложения.
// Два назначения сразу: (1) статистика для админа (сколько всего открывали, сколько активны
// сейчас — admin-stats.mjs) и (2) индекс username→id, без которого друга по @username найти
// нельзя (friends.mjs). Mini App и сайт после входа через Telegram-бота — у отдельного
// iOS/Windows-приложения нет постоянного Telegram ID, который можно было бы с кем-то сверить,
// поэтому для него эта функция не вызывается вовсе (см. вызов на клиенте).
import { CORS_HEADERS, corsPreflight } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { touchUser } from "../lib/user-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: CORS_HEADERS });

export default async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const user = auth.user;

  const body = await req.json().catch(() => ({}));
  await touchUser(user.id, { firstName: user.first_name, username: user.username, pro: !!body.pro });
  return json({ ok: true });
};

export const config = { path: "/api/user-touch", method: ["POST", "OPTIONS"] };
