// Netlify: /api/goals — общая цель (челлендж) с друзьями, со своим прогрессом у каждого.
//
// GET  — список моих общих целей, с участниками (имя, username) и прогрессом каждого.
// POST { action: "create",          friendId, title, target, metric, deadline } — создать
//        цель с другом (нужна дружба); metric: "workouts" | "runs".
// POST { action: "publishProgress", goalId, value }   — обновить СВОЙ прогресс (считает клиент).
// POST { action: "leave",           goalId }           — выйти из цели.
import { CORS_HEADERS, corsPreflight } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { getUser, touchUser } from "../lib/user-store.mjs";
import { getRelations } from "../lib/friends-store.mjs";
import { listGoalsFor, createGoal, publishProgress, leaveGoal } from "../lib/goal-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: CORS_HEADERS });

async function enrichParticipants(ids, progress, selfId) {
  return Promise.all(ids.map(async (id) => {
    const u = await getUser(id);
    return { id, firstName: u?.firstName || "", username: u?.username || "", isSelf: String(id) === String(selfId), progress: progress?.[id] || 0 };
  }));
}

export default async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const me = auth.user;
  await touchUser(me.id, { firstName: me.first_name, username: me.username });

  if (req.method === "GET") {
    const goals = await listGoalsFor(me.id);
    const out = await Promise.all(goals.map(async (g) => ({
      id: g.id, title: g.title, target: g.target, metric: g.metric, deadline: g.deadline, createdAt: g.createdAt,
      participants: await enrichParticipants(g.participants, g.progress, me.id),
    })));
    return json({ goals: out });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "create") {
    const friendId = body.friendId;
    if (!friendId) return json({ error: "friendId_required" }, 400);
    const title = String(body.title || "").trim();
    if (!title) return json({ error: "title_empty" }, 400);
    const target = Number(body.target);
    if (!Number.isFinite(target) || target < 1 || target > 100000) return json({ error: "bad_target" }, 400);
    const rel = await getRelations(me.id);
    if (!rel.friends.some((x) => String(x) === String(friendId))) return json({ error: "not_friends" }, 403);
    const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(body.deadline || "")) ? body.deadline : null;
    const goal = await createGoal({ title, target, metric: body.metric, deadline }, [me.id, friendId], me.id);
    return json({ ok: true, goal: { id: goal.id, title: goal.title, target: goal.target, metric: goal.metric, deadline: goal.deadline, createdAt: goal.createdAt, participants: await enrichParticipants(goal.participants, goal.progress, me.id) } });
  }

  if (action === "publishProgress") {
    const r = await publishProgress(body.goalId, me.id, body.value);
    if (!r.ok) return json({ error: r.code }, 409);
    return json({ ok: true });
  }

  if (action === "leave") {
    await leaveGoal(body.goalId, me.id);
    return json({ ok: true });
  }

  return json({ error: "bad_action" }, 400);
};

export const config = { path: "/api/goals", method: ["GET", "POST", "OPTIONS"] };
