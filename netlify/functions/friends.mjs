// Netlify: /api/friends — список друзей, заявки, добавление по @username, публикация своей
// карточки прогресса. Mini App и сайт после входа через Telegram-бота (см. user-touch.mjs — нужен
// постоянный Telegram ID: без него друга и не найти, и самого человека не с кем сверить).
//
// GET  — состояние: мои друзья (с их текущим именем и опубликованным снимком прогресса),
//        входящие и исходящие заявки.
// POST — действие в поле action:
//   "request" { username } — отправить заявку человеку по его @username;
//   "accept"  { fromId }   — принять входящую заявку;
//   "decline" { fromId }   — отклонить входящую ИЛИ отозвать свою исходящую заявку (fromId —
//                            id другой стороны в обоих случаях);
//   "remove"  { friendId } — удалить из друзей;
//   "publish" { snapshot } — опубликовать свою карточку прогресса (клиент уже отфильтровал её
//                            по своим настройкам приватности — сервер только дополнительно
//                            проверяет форму и диапазоны значений, на случай испорченного клиента).
import { CORS_HEADERS, corsPreflight } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { getUser, findUserByUsername, touchUser } from "../lib/user-store.mjs";
import { getRelations, getSnapshot, publishSnapshot, sendRequest, acceptRequest, declineRequest, removeFriend } from "../lib/friends-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: CORS_HEADERS });

const REQUEST_ERRORS = {
  self: "self",
  already_friends: "already_friends",
  already_pending: "already_pending",
  incoming_exists: "incoming_exists",
};

// Тот же список id, что в ACHIEVEMENTS на клиенте (src/App.jsx) — здесь нужен только чтобы
// отсечь мусор, если клиент пришлёт что-то кроме настоящих id достижений.
const ACHIEVEMENT_IDS = new Set([
  "first_workout", "workouts50", "first_run", "runs20", "streak7", "streak30", "pr5", "pr15",
  "habit30", "tasks100", "reader5", "weightlog", "challenge_done", "quit_30", "journal_first",
  "breath_week", "faith_week",
]);
const clampInt = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v)) || 0));

// Снимок приходит уже отфильтрованным по приватности на клиенте (ненужные поля там просто
// не кладутся в объект) — сервер не решает, что скрывать, а только обрезает диапазоны
// у того, что прислали, чтобы испорченный/самодельный клиент не записал что-то абсурдное
// (например, стрик в миллиард дней) в карточку, которую увидят другие люди.
function sanitizeSnapshot(s) {
  if (!s || typeof s !== "object") return {};
  const out = {};
  if ("trainStreak" in s) out.trainStreak = clampInt(s.trainStreak, 20000);
  if ("runStreak" in s) out.runStreak = clampInt(s.runStreak, 20000);
  if ("totalTrainings" in s) out.totalTrainings = clampInt(s.totalTrainings, 200000);
  if ("totalRuns" in s) out.totalRuns = clampInt(s.totalRuns, 200000);
  if ("prCount" in s) out.prCount = clampInt(s.prCount, 10000);
  if ("habitStreak" in s) out.habitStreak = clampInt(s.habitStreak, 20000);
  if ("achievementsUnlocked" in s) out.achievementsUnlocked = clampInt(s.achievementsUnlocked, ACHIEVEMENT_IDS.size);
  if (Array.isArray(s.achievementIds)) out.achievementIds = s.achievementIds.filter((id) => ACHIEVEMENT_IDS.has(id)).slice(0, ACHIEVEMENT_IDS.size);
  if ("weightCurrent" in s) { const n = Number(s.weightCurrent); if (Number.isFinite(n) && n > 0 && n < 500) out.weightCurrent = Math.round(n * 10) / 10; }
  if ("weightChange30d" in s) { const n = Number(s.weightChange30d); if (Number.isFinite(n) && Math.abs(n) < 200) out.weightChange30d = Math.round(n * 10) / 10; }
  // Статус текущей недели для общего календаря тренировок (plans.mjs) — только даты этой
  // недели, не вся история: { "2026-10-06": true, ... }.
  const sanitizeWeekMap = (m) => {
    if (!m || typeof m !== "object") return null;
    const clean = {};
    for (const [k, v] of Object.entries(m).slice(0, 7)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) clean[k] = !!v;
    }
    return Object.keys(clean).length ? clean : null;
  };
  if (s.thisWeekDone) { const m = sanitizeWeekMap(s.thisWeekDone); if (m) out.thisWeekDone = m; }
  if (s.thisWeekRun) { const m = sanitizeWeekMap(s.thisWeekRun); if (m) out.thisWeekRun = m; }
  return out;
}

async function publicView(id) {
  const u = await getUser(id);
  return { id, firstName: u?.firstName || "", username: u?.username || "" };
}

export default async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  // Mini App (подпись Telegram) или сайт (токен сессии после входа через бота) — тот же Telegram ID
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const me = auth.user;
  // На всякий случай обновляем и реестр пользователей тем же запросом — если у человека
  // открыты друзья, то приложение точно открыто, грех не посчитать это как "видели".
  await touchUser(me.id, { firstName: me.first_name, username: me.username });

  if (req.method === "GET") {
    const rel = await getRelations(me.id);
    const friends = await Promise.all(rel.friends.map(async (fid) => ({ ...(await publicView(fid)), stats: await getSnapshot(fid) })));
    const incoming = await Promise.all(rel.incoming.map(async (r) => ({ ...(await publicView(r.id)), at: r.at })));
    const outgoing = await Promise.all(rel.outgoing.map(async (r) => ({ ...(await publicView(r.id)), at: r.at })));
    return json({ friends, incoming, outgoing });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "request") {
    const username = String(body.username || "").replace(/^@/, "").trim();
    if (!username) return json({ error: "username_empty" }, 400);
    const target = await findUserByUsername(username);
    if (!target) return json({ error: "user_not_found" }, 404);
    const r = await sendRequest(me.id, { firstName: me.first_name, username: me.username }, target.id, { firstName: target.firstName, username: target.username });
    if (!r.ok) return json({ error: REQUEST_ERRORS[r.code] || r.code }, 409);
    return json({ ok: true });
  }

  if (action === "accept") {
    const r = await acceptRequest(me.id, body.fromId);
    if (!r.ok) return json({ error: r.code }, 409);
    return json({ ok: true });
  }

  if (action === "decline") {
    await declineRequest(me.id, body.fromId);
    return json({ ok: true });
  }

  if (action === "remove") {
    await removeFriend(me.id, body.friendId);
    return json({ ok: true });
  }

  if (action === "publish") {
    await publishSnapshot(me.id, sanitizeSnapshot(body.snapshot));
    return json({ ok: true });
  }

  return json({ error: "bad_action" }, 400);
};

export const config = { path: "/api/friends", method: ["GET", "POST", "OPTIONS"] };
