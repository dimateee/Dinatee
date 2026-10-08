// Netlify: /api/admin-migrate — перенос серверных данных со старого сайта Netlify на этот.
//
// Зачем: Netlify хранит данные (Netlify Blobs) внутри конкретного сайта. При переезде на новый аккаунт
// или новый сайт код приезжает из GitHub, а данные — нет: Pro у тех, кто платил, данные аккаунтов сайта,
// промокоды, друзья, чат и статистика остаются на старом сайте. Эта функция читает их со старого сайта
// через API Netlify и записывает сюда.
//
// Нужны две переменные на НОВОМ сайте (Site configuration → Environment variables), потом деплой:
//   MIGRATE_FROM_SITE_ID — ID старого сайта (старый аккаунт → сайт → Site configuration → Site details → Site ID);
//   MIGRATE_FROM_TOKEN   — токен старого аккаунта (User settings → Applications → Personal access tokens → New).
// После переноса обе переменные можно удалить (а токен — отозвать в старом аккаунте).
//
// Только для админов (ADMIN_TG_IDS). Запускается из приложения: Настройки → «Перенос со старого сайта».
// GET  — проверка доступа и сколько записей в каждом хранилище старого сайта.
// POST { store, offset } — переносит следующую пачку записей одного хранилища; приложение вызывает
//      по кругу, пока не придёт done. Повторный запуск безопасен: данные не затираются, а объединяются.
import { getStore } from "@netlify/blobs";
import { env } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";

// Все хранилища приложения, кроме служебного ritm-auth (одноразовые ссылки входа и настройки вебхука —
// у нового сайта они свои). ritm-pro первым: важнее всего вернуть оплаченную Pro.
export const MIGRATE_STORES = ["ritm-pro", "ritm-data", "ritm-users", "ritm-promo", "ritm-friends", "ritm-chat", "ritm-plans", "ritm-goals", "ritm-products", "ritm-reminders"];
const BATCH = 25;

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const adminIds = () => String(env("ADMIN_TG_IDS") || "").split(",").map((x) => x.trim()).filter(Boolean);
const creds = () => ({ siteID: String(env("MIGRATE_FROM_SITE_ID") || "").trim(), token: String(env("MIGRATE_FROM_TOKEN") || "").trim() });

const oldStore = (name) => globalThis.__ritmOldStores?.[name] || getStore({ name, ...creds() });
const newStore = (name) => globalThis.__ritmNewStores?.[name] || getStore({ name, consistency: "strong" });
const parse = (s) => { try { return JSON.parse(s); } catch (e) { return undefined; } };

// Если запись уже есть на новом сайте — объединяем, а не затираем (кто-то мог успеть заплатить или
// потренироваться уже на новом). null — оставить как есть на новом сайте.
function mergeValue(storeName, key, oldVal, curVal) {
  if (curVal === undefined) return oldVal; // на новом сайте записи нет — просто переносим
  if (oldVal === undefined) return null;
  if (storeName === "ritm-pro" && key.startsWith("user:")) {
    const best = (Number(oldVal.until) || 0) > (Number(curVal.until) || 0) ? oldVal : curVal;
    const seen = new Set();
    const history = [...(curVal.history || []), ...(oldVal.history || [])]
      .filter((h) => { const k = `${h.at}:${h.source}:${h.days}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 40);
    return { ...best, history };
  }
  if (storeName === "ritm-pro" && key.startsWith("utx:")) return [...new Set([...(curVal || []), ...(oldVal || [])])].slice(0, 60);
  if (storeName === "ritm-data" && key.startsWith("user:")) {
    // Человек мог уже зайти на новый сайт и пройти анкету заново — тогда здесь свежая, почти пустая запись,
    // и по одной дате она «новее» старой. Берём старую, если она новее ИЛИ заметно богаче данными, и делаем
    // её версию самой свежей — приложение при следующей синхронизации подтянет её (а если на устройстве
    // есть несохранённые изменения, объединит их со старыми данными, ничего не теряя).
    const size = (v) => JSON.stringify(v?.state || {}).length;
    const oldNewer = (Number(oldVal.updatedAt) || 0) > (Number(curVal.updatedAt) || 0);
    if (!oldNewer && size(oldVal) <= size(curVal) * 1.5) return null;
    const updatedAt = Math.max(Number(oldVal.updatedAt) || 0, Number(curVal.updatedAt) || 0) + 1;
    return { ...oldVal, updatedAt, state: { ...(oldVal.state || {}), updatedAt }, migratedAt: Date.now() };
  }
  if (storeName === "ritm-users" && key.startsWith("user:")) {
    const newer = (oldVal.lastSeenAt || 0) > (curVal.lastSeenAt || 0) ? oldVal : curVal;
    return { ...newer, firstSeenAt: Math.min(oldVal.firstSeenAt || Infinity, curVal.firstSeenAt || Infinity), pro: !!(oldVal.pro || curVal.pro) };
  }
  if (storeName === "ritm-promo" && key.startsWith("code:")) {
    const byUser = new Map();
    for (const r of [...(oldVal.redemptions || []), ...(curVal.redemptions || [])]) if (!byUser.has(String(r.userId))) byUser.set(String(r.userId), r);
    const redemptions = [...byUser.values()];
    return { ...curVal, redemptions, used: redemptions.length >= Math.max(1, Number(curVal.maxUses) || 1) };
  }
  if (storeName === "ritm-friends" && key.startsWith("rel:")) {
    const uniq = (arr, idOf) => { const m = new Map(); for (const x of arr) if (!m.has(String(idOf(x)))) m.set(String(idOf(x)), x); return [...m.values()]; };
    const friends = uniq([...(curVal.friends || []), ...(oldVal.friends || [])], (x) => x);
    const isFriend = (id) => friends.some((f) => String(f) === String(id));
    return {
      friends,
      incoming: uniq([...(curVal.incoming || []), ...(oldVal.incoming || [])], (r) => r.id).filter((r) => !isFriend(r.id)),
      outgoing: uniq([...(curVal.outgoing || []), ...(oldVal.outgoing || [])], (r) => r.id).filter((r) => !isFriend(r.id)),
    };
  }
  return null; // остальное: на новом сайте уже есть своя запись — не трогаем
}

async function listKeys(store) {
  const { blobs = [] } = await store.list();
  return blobs.map((b) => b.key).sort();
}

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  if (!adminIds().length) return json({ error: "admin_not_configured" }, 500);
  if (!adminIds().includes(String(auth.user.id))) return json({ error: "not_admin" }, 403);
  const { siteID, token } = creds();
  if (!globalThis.__ritmOldStores && (!siteID || !token)) return json({ error: "migrate_not_configured" }, 400);

  if (req.method === "GET") {
    const counts = {};
    try {
      for (const name of MIGRATE_STORES) counts[name] = (await listKeys(oldStore(name))).length;
    } catch (e) {
      console.error("migrate check failed", e?.message || e);
      return json({ error: "migrate_no_access", detail: String(e?.message || e).slice(0, 200) }, 502);
    }
    return json({ ok: true, stores: MIGRATE_STORES, counts });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.store || "");
  if (!MIGRATE_STORES.includes(name)) return json({ error: "bad_store" }, 400);
  const offset = Math.max(0, Math.round(Number(body.offset)) || 0);
  const from = oldStore(name);
  const to = newStore(name);
  let keys;
  try { keys = await listKeys(from); } catch (e) { return json({ error: "migrate_no_access", detail: String(e?.message || e).slice(0, 200) }, 502); }

  let copied = 0, merged = 0, skipped = 0;
  for (const key of keys.slice(offset, offset + BATCH)) {
    const rawOld = await from.get(key).catch(() => null);
    if (rawOld === null) { skipped++; continue; }
    const rawCur = await to.get(key).catch(() => null);
    const oldVal = parse(rawOld);
    // Не JSON (на всякий случай) — переносим как есть, только если на новом сайте записи нет
    if (oldVal === undefined) { if (rawCur === null) { await to.set(key, rawOld); copied++; } else skipped++; continue; }
    const result = mergeValue(name, key, oldVal, rawCur === null ? undefined : parse(rawCur));
    if (result === null) { skipped++; continue; }
    await to.set(key, JSON.stringify(result));
    if (rawCur === null) copied++; else merged++;
  }
  const nextOffset = Math.min(keys.length, offset + BATCH);
  return json({ store: name, total: keys.length, copied, merged, skipped, nextOffset, done: nextOffset >= keys.length });
};

export const config = { path: "/api/admin-migrate", method: ["GET", "POST"] };
