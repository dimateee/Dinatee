// Чат с друзьями — Netlify Blobs, хранилище "ritm-chat". Простой поллинг, а не настоящий
// real-time: клиент сам опрашивает GET раз в несколько секунд, пока открыт экран переписки
// (см. ChatSheet в src/App.jsx) — для личной переписки внутри приложения этого достаточно,
// а веб-сокетов в Netlify Functions нет.
// Переписка возможна только между подтверждёнными друзьями — это проверяет сама функция
// chat.mjs через friends-store, здесь это не проверяется.
import { getStore } from "@netlify/blobs";

const store = () => globalThis.__ritmChatStore || getStore({ name: "ritm-chat", consistency: "strong" });
const MAX_MESSAGES = 300; // храним только последние N сообщений диалога — личный чат, не архив

// Один ключ на пару людей, независимо от того, кто первый написал — так оба читают и пишут
// в одну и ту же запись.
const convoKey = (a, b) => `convo:${[String(a), String(b)].sort().join(":")}`;
const readKey = (convo, userId) => `read:${convo}:${userId}`;

export async function getMessages(aId, bId, sinceAt = 0) {
  const s = store();
  const key = convoKey(aId, bId);
  const convo = (await s.get(key, { type: "json" }).catch(() => null)) || { messages: [] };
  return sinceAt ? convo.messages.filter((m) => m.at > sinceAt) : convo.messages;
}

export async function sendMessage(aId, bId, fromId, text) {
  const s = store();
  const key = convoKey(aId, bId);
  const convo = (await s.get(key, { type: "json" }).catch(() => null)) || { messages: [] };
  const msg = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, from: fromId, text, at: Date.now() };
  convo.messages = [...convo.messages, msg].slice(-MAX_MESSAGES);
  await s.setJSON(key, convo);
  return msg;
}

export async function markRead(aId, bId, userId) {
  await store().setJSON(readKey(convoKey(aId, bId), userId), { at: Date.now() });
}

export async function getLastReadAt(aId, bId, userId) {
  const r = await store().get(readKey(convoKey(aId, bId), userId), { type: "json" }).catch(() => null);
  return r?.at || 0;
}
