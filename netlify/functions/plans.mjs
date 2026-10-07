// Netlify: /api/plans — общий календарь тренировок с другом (какие дни недели тренируетесь
// вместе). Кто что уже отметил на этой неделе подтягивается из опубликованного снимка
// прогресса в friends-store (snap:<id>) — см. комментарий в plan-store.mjs.
//
// GET  — список моих планов, с участниками (имя, username) и их статусом на эту неделю.
// POST { action: "create",   friendId, days }        — создать план с другом (нужна дружба).
// POST { action: "setDays",  planId, days }           — изменить дни (любой участник).
// POST { action: "leave",    planId }                 — выйти из плана.
import { CORS_HEADERS, corsPreflight } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { getUser, touchUser } from "../lib/user-store.mjs";
import { getRelations, getSnapshot } from "../lib/friends-store.mjs";
import { listPlansFor, createPlan, setPlanDays, leavePlan } from "../lib/plan-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: CORS_HEADERS });
const cleanDays = (days) => (Array.isArray(days) ? [...new Set(days.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : []);

async function enrichParticipants(ids, selfId) {
  return Promise.all(ids.map(async (id) => {
    const [u, snap] = await Promise.all([getUser(id), getSnapshot(id)]);
    return {
      id,
      firstName: u?.firstName || "",
      username: u?.username || "",
      isSelf: String(id) === String(selfId),
      thisWeekDone: snap?.thisWeekDone || null,
      thisWeekRun: snap?.thisWeekRun || null,
    };
  }));
}

export default async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const me = auth.user;
  await touchUser(me.id, { firstName: me.first_name, username: me.username });

  if (req.method === "GET") {
    const plans = await listPlansFor(me.id);
    const out = await Promise.all(plans.map(async (p) => ({ id: p.id, days: p.days, participants: await enrichParticipants(p.participants, me.id) })));
    return json({ plans: out });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "create") {
    const friendId = body.friendId;
    if (!friendId) return json({ error: "friendId_required" }, 400);
    const rel = await getRelations(me.id);
    if (!rel.friends.some((x) => String(x) === String(friendId))) return json({ error: "not_friends" }, 403);
    const plan = await createPlan([me.id, friendId], cleanDays(body.days), me.id);
    return json({ ok: true, plan: { id: plan.id, days: plan.days, participants: await enrichParticipants(plan.participants, me.id) } });
  }

  if (action === "setDays") {
    const r = await setPlanDays(body.planId, me.id, cleanDays(body.days));
    if (!r.ok) return json({ error: r.code }, 409);
    return json({ ok: true, plan: { id: r.plan.id, days: r.plan.days, participants: await enrichParticipants(r.plan.participants, me.id) } });
  }

  if (action === "leave") {
    await leavePlan(body.planId, me.id);
    return json({ ok: true });
  }

  return json({ error: "bad_action" }, 400);
};

export const config = { path: "/api/plans", method: ["GET", "POST", "OPTIONS"] };
