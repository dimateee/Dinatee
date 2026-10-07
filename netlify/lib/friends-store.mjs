// Друзья в RITM — Netlify Blobs, хранилище "ritm-friends".
// Две сущности на каждого пользователя:
//  - rel:<id>  — его граф: друзья, входящие заявки, исходящие заявки.
//  - snap:<id> — "публичный" снимок прогресса, который сам человек решил показывать друзьям
//                (считается на клиенте из его же статистики, с учётом его настроек приватности —
//                сервер просто хранит то, что ему прислали, уже отфильтрованное).
// Дружба — всегда по заявке с подтверждением (см. запрос пользователя): добавление в друзья
// не делает профили видимыми друг другу само по себе, сначала обе стороны должны согласиться.
import { getStore } from "@netlify/blobs";

const store = () => globalThis.__ritmFriendsStore || getStore({ name: "ritm-friends", consistency: "strong" });
const relKey = (id) => `rel:${id}`;
const snapKey = (id) => `snap:${id}`;
const emptyRel = () => ({ friends: [], incoming: [], outgoing: [] });

async function getRel(s, id) {
  const r = await s.get(relKey(id), { type: "json" }).catch(() => null);
  return r || emptyRel();
}
const saveRel = (s, id, rel) => s.setJSON(relKey(id), rel);

export async function getRelations(id) {
  return getRel(store(), id);
}

export async function getSnapshot(id) {
  return (await store().get(snapKey(id), { type: "json" }).catch(() => null)) || null;
}

export async function publishSnapshot(id, snapshot) {
  await store().setJSON(snapKey(id), { ...snapshot, updatedAt: Date.now() });
  return { ok: true };
}

// fromInfo/toInfo — { firstName, username }, только для отображения в списке заявок до того,
// как обе стороны подтвердят; при показе самого списка друзей/заявок клиенту сервер всё равно
// заново подтягивает актуальное имя через user-store (см. friends.mjs), так что устаревшее
// имя тут — не проблема, долго не живёт.
export async function sendRequest(fromId, fromInfo, toId, toInfo) {
  if (String(fromId) === String(toId)) return { ok: false, code: "self" };
  const s = store();
  const fromRel = await getRel(s, fromId);
  const toRel = await getRel(s, toId);
  if (fromRel.friends.some((x) => String(x) === String(toId))) return { ok: false, code: "already_friends" };
  if (fromRel.outgoing.some((x) => String(x.id) === String(toId))) return { ok: false, code: "already_pending" };
  if (fromRel.incoming.some((x) => String(x.id) === String(toId))) return { ok: false, code: "incoming_exists" };
  const now = Date.now();
  fromRel.outgoing.push({ id: toId, firstName: toInfo?.firstName || "", username: toInfo?.username || "", at: now });
  toRel.incoming.push({ id: fromId, firstName: fromInfo?.firstName || "", username: fromInfo?.username || "", at: now });
  await Promise.all([saveRel(s, fromId, fromRel), saveRel(s, toId, toRel)]);
  return { ok: true };
}

export async function acceptRequest(selfId, fromId) {
  const s = store();
  const selfRel = await getRel(s, selfId);
  const fromRel = await getRel(s, fromId);
  if (!selfRel.incoming.some((x) => String(x.id) === String(fromId))) return { ok: false, code: "no_such_request" };
  selfRel.incoming = selfRel.incoming.filter((x) => String(x.id) !== String(fromId));
  fromRel.outgoing = fromRel.outgoing.filter((x) => String(x.id) !== String(selfId));
  if (!selfRel.friends.some((x) => String(x) === String(fromId))) selfRel.friends.push(fromId);
  if (!fromRel.friends.some((x) => String(x) === String(selfId))) fromRel.friends.push(selfId);
  await Promise.all([saveRel(s, selfId, selfRel), saveRel(s, fromId, fromRel)]);
  return { ok: true };
}

// Отклонить входящую заявку ИЛИ отозвать свою исходящую — симметричная операция,
// разница только в том, с какой стороны её вызвали.
export async function declineRequest(selfId, otherId) {
  const s = store();
  const selfRel = await getRel(s, selfId);
  const otherRel = await getRel(s, otherId);
  selfRel.incoming = selfRel.incoming.filter((x) => String(x.id) !== String(otherId));
  selfRel.outgoing = selfRel.outgoing.filter((x) => String(x.id) !== String(otherId));
  otherRel.incoming = otherRel.incoming.filter((x) => String(x.id) !== String(selfId));
  otherRel.outgoing = otherRel.outgoing.filter((x) => String(x.id) !== String(selfId));
  await Promise.all([saveRel(s, selfId, selfRel), saveRel(s, otherId, otherRel)]);
  return { ok: true };
}

export async function removeFriend(selfId, otherId) {
  const s = store();
  const selfRel = await getRel(s, selfId);
  const otherRel = await getRel(s, otherId);
  selfRel.friends = selfRel.friends.filter((x) => String(x) !== String(otherId));
  otherRel.friends = otherRel.friends.filter((x) => String(x) !== String(selfId));
  await Promise.all([saveRel(s, selfId, selfRel), saveRel(s, otherId, otherRel)]);
  return { ok: true };
}
