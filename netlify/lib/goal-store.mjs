// Общая цель (челлендж) с друзьями — Netlify Blobs, хранилище "ritm-goals".
// В отличие от плана тренировок, прогресс цели хранится прямо здесь (goal.progress[userId]):
// не идёт через снимок в friends-store, потому что одной и той же цели нужно отдельное число
// у каждого участника, а снимок — один на всех друзей сразу. Участник публикует свой прогресс
// сам (goals.mjs, action=publishProgress) — так же, как snap:<id> публикуется для друзей, но
// только своим числом в рамках одной цели, а не всей карточкой профиля.
import { getStore } from "@netlify/blobs";

const store = () => globalThis.__ritmGoalStore || getStore({ name: "ritm-goals", consistency: "strong" });
const goalKey = (id) => `goal:${id}`;
const userGoalsKey = (userId) => `usergoals:${userId}`;

async function getUserGoalIds(s, userId) {
  const r = await s.get(userGoalsKey(userId), { type: "json" }).catch(() => null);
  return Array.isArray(r?.ids) ? r.ids : [];
}
async function addUserGoalId(s, userId, goalId) {
  const ids = await getUserGoalIds(s, userId);
  if (!ids.includes(goalId)) await s.setJSON(userGoalsKey(userId), { ids: [...ids, goalId] });
}
async function removeUserGoalId(s, userId, goalId) {
  const ids = await getUserGoalIds(s, userId);
  await s.setJSON(userGoalsKey(userId), { ids: ids.filter((x) => x !== goalId) });
}

export async function getGoal(id) {
  return (await store().get(goalKey(id), { type: "json" }).catch(() => null)) || null;
}

export async function listGoalsFor(userId) {
  const s = store();
  const ids = await getUserGoalIds(s, userId);
  const goals = await Promise.all(ids.map((id) => s.get(goalKey(id), { type: "json" }).catch(() => null)));
  return goals.filter(Boolean);
}

// metric: "workouts" | "runs" — что считает каждый участник у себя (см. buildGoalProgress
// в src/App.jsx: количество отметок st.done/st.runDone с момента createdAt по deadline).
export async function createGoal(opts, participants, createdBy) {
  const s = store();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const goal = {
    id,
    title: String(opts.title || "Общая цель").slice(0, 80),
    target: Math.max(1, Math.min(100000, Math.round(Number(opts.target)) || 1)),
    metric: opts.metric === "runs" ? "runs" : "workouts",
    deadline: opts.deadline || null, // ISO-дата "YYYY-MM-DD" или null = без срока
    participants,
    progress: Object.fromEntries(participants.map((uid) => [uid, 0])),
    createdBy,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await s.setJSON(goalKey(id), goal);
  await Promise.all(participants.map((uid) => addUserGoalId(s, uid, id)));
  return goal;
}

export async function publishProgress(id, userId, value) {
  const s = store();
  const goal = await getGoal(id);
  if (!goal) return { ok: false, code: "not_found" };
  if (!goal.participants.some((x) => String(x) === String(userId))) return { ok: false, code: "not_participant" };
  goal.progress = { ...goal.progress, [userId]: Math.max(0, Math.min(1000000, Math.round(Number(value)) || 0)) };
  goal.updatedAt = Date.now();
  await s.setJSON(goalKey(id), goal);
  return { ok: true, goal };
}

export async function leaveGoal(id, userId) {
  const s = store();
  const goal = await getGoal(id);
  if (!goal) return { ok: true };
  await removeUserGoalId(s, userId, id);
  const remaining = goal.participants.filter((x) => String(x) !== String(userId));
  if (remaining.length < 2) {
    await Promise.all(remaining.map((uid) => removeUserGoalId(s, uid, id)));
    await s.delete(goalKey(id)).catch(() => {});
  } else {
    goal.participants = remaining;
    const { [userId]: _drop, ...restProgress } = goal.progress || {};
    goal.progress = restProgress;
    await s.setJSON(goalKey(id), goal);
  }
  return { ok: true };
}
