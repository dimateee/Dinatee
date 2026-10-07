// Реестр пользователей RITM — Netlify Blobs, хранилище "ritm-users".
// Нужен для двух вещей:
//  1. Статистика для админа (сколько всего регистраций, сколько активны сейчас) — admin-stats.mjs.
//  2. Поиск человека по Telegram-username при добавлении в друзья (friends.mjs) — Telegram не даёт
//     способа узнать numeric ID по @username без того, чтобы человек хотя бы раз открыл само
//     приложение, поэтому индекс username→id строим сами, по факту открытия RITM.
// Пишется на каждое открытие приложения (см. touchUser, вызывается из user-touch.mjs) — это
// единственная функция, которая "трогает" эту базу, остального трогать не нужно.
import { getStore } from "@netlify/blobs";

const store = () => globalThis.__ritmUserStore || getStore({ name: "ritm-users", consistency: "strong" });
const DAY = 24 * 60 * 60 * 1000;

const usernameKey = (u) => `username:${String(u).toLowerCase()}`;

export async function getUser(id) {
  return (await store().get(`user:${id}`, { type: "json" }).catch(() => null)) || null;
}

export async function findUserByUsername(username) {
  const s = store();
  const idx = await s.get(usernameKey(username), { type: "json" }).catch(() => null);
  if (!idx?.id) return null;
  return getUser(idx.id);
}

// firstSeenAt пишется только один раз и никогда не перезатирается — остальное обновляется
// на каждый вызов. Если юзернейм сменился (или человек его убрал/завёл) — старый индекс
// username→id удаляется, чтобы по старому @нику больше не находился не тот человек.
export async function touchUser(id, info = {}) {
  const s = store();
  const key = `user:${id}`;
  const now = Date.now();
  const existing = await s.get(key, { type: "json" }).catch(() => null);
  const username = info.username ? String(info.username).trim() : "";
  const rec = {
    id,
    firstName: String(info.firstName || existing?.firstName || "").slice(0, 80),
    username,
    // friends/chat/plans/goals вызывают touchUser без pro — тогда сохраняем прежнее значение,
    // иначе любой заход в «Друзья» сбрасывал Pro в статистике админа
    pro: info.pro === undefined ? !!existing?.pro : !!info.pro,
    firstSeenAt: existing?.firstSeenAt || now,
    lastSeenAt: now,
  };
  const oldUsername = existing?.username || "";
  if (oldUsername && oldUsername.toLowerCase() !== username.toLowerCase()) {
    await s.delete(usernameKey(oldUsername)).catch(() => {});
  }
  await s.setJSON(key, rec);
  if (username) await s.setJSON(usernameKey(username), { id });
  return rec;
}

// Полный скан "user:*" — для личного/небольшого приложения это нормально (так же устроен
// reminder-scheduler.mjs, который на каждый тик читает store.list() без постраничной загрузки).
// Если база пользователей когда-нибудь вырастет до десятков тысяч — стоит класть lastSeenAt/pro
// в metadata записи, чтобы list() отдавал их без отдельного get() на каждого.
export async function getStats() {
  const s = store();
  const { blobs = [] } = await s.list({ prefix: "user:" }).catch(() => ({ blobs: [] }));
  const now = Date.now();
  let total = 0, dau = 0, wau = 0, mau = 0, pro = 0, newToday = 0, newWeek = 0;
  for (const b of blobs) {
    const rec = await s.get(b.key, { type: "json" }).catch(() => null);
    if (!rec) continue;
    total++;
    if (rec.pro) pro++;
    const sinceSeen = now - (rec.lastSeenAt || 0);
    const sinceFirst = now - (rec.firstSeenAt || 0);
    if (sinceSeen <= DAY) dau++;
    if (sinceSeen <= 7 * DAY) wau++;
    if (sinceSeen <= 30 * DAY) mau++;
    if (sinceFirst <= DAY) newToday++;
    if (sinceFirst <= 7 * DAY) newWeek++;
  }
  return { total, dau, wau, mau, pro, newToday, newWeek };
}
