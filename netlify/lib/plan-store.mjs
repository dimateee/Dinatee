// Общий календарь тренировок с другом — Netlify Blobs, хранилище "ritm-plans".
// Сам план — только список дней недели, которые два друга выбрали тренироваться вместе
// (0=Пн … 6=Вс, та же нумерация, что у wdOf/WD в src/App.jsx). Кто из них в какой день ЭТОЙ
// недели уже отметил тренировку — не хранится здесь отдельно: это часть обычного снимка
// прогресса из friends-store (snap:<id>.thisWeekDone/thisWeekRun), который и так публикует
// каждый участник — так план не превращается во второй канал синхронизации личных данных.
import { getStore } from "@netlify/blobs";

const store = () => globalThis.__ritmPlanStore || getStore({ name: "ritm-plans", consistency: "strong" });
const planKey = (id) => `plan:${id}`;
const userPlansKey = (userId) => `userplans:${userId}`;

async function getUserPlanIds(s, userId) {
  const r = await s.get(userPlansKey(userId), { type: "json" }).catch(() => null);
  return Array.isArray(r?.ids) ? r.ids : [];
}
async function addUserPlanId(s, userId, planId) {
  const ids = await getUserPlanIds(s, userId);
  if (!ids.includes(planId)) await s.setJSON(userPlansKey(userId), { ids: [...ids, planId] });
}
async function removeUserPlanId(s, userId, planId) {
  const ids = await getUserPlanIds(s, userId);
  await s.setJSON(userPlansKey(userId), { ids: ids.filter((x) => x !== planId) });
}

export async function getPlan(id) {
  return (await store().get(planKey(id), { type: "json" }).catch(() => null)) || null;
}

export async function listPlansFor(userId) {
  const s = store();
  const ids = await getUserPlanIds(s, userId);
  const plans = await Promise.all(ids.map((id) => s.get(planKey(id), { type: "json" }).catch(() => null)));
  return plans.filter(Boolean);
}

export async function createPlan(participants, days, createdBy) {
  const s = store();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const plan = { id, participants, days: Array.isArray(days) ? days.filter((d) => d >= 0 && d <= 6) : [], createdBy, createdAt: Date.now(), updatedAt: Date.now() };
  await s.setJSON(planKey(id), plan);
  await Promise.all(participants.map((uid) => addUserPlanId(s, uid, id)));
  return plan;
}

export async function setPlanDays(id, userId, days) {
  const s = store();
  const plan = await getPlan(id);
  if (!plan) return { ok: false, code: "not_found" };
  if (!plan.participants.some((x) => String(x) === String(userId))) return { ok: false, code: "not_participant" };
  plan.days = Array.isArray(days) ? days.filter((d) => d >= 0 && d <= 6) : [];
  plan.updatedAt = Date.now();
  await s.setJSON(planKey(id), plan);
  return { ok: true, plan };
}

export async function leavePlan(id, userId) {
  const s = store();
  const plan = await getPlan(id);
  if (!plan) return { ok: true };
  await removeUserPlanId(s, userId, id);
  const remaining = plan.participants.filter((x) => String(x) !== String(userId));
  if (remaining.length < 2) {
    // Общий план с одним участником не имеет смысла — убираем и у оставшегося, удаляем запись.
    await Promise.all(remaining.map((uid) => removeUserPlanId(s, uid, id)));
    await s.delete(planKey(id)).catch(() => {});
  } else {
    plan.participants = remaining;
    await s.setJSON(planKey(id), plan);
  }
  return { ok: true };
}
