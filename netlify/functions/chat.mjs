// Netlify: /api/chat — переписка с друзьями. Только между подтверждёнными друзьями (проверяем
// через getRelations из friends-store.mjs на каждый запрос, не доверяя одному факту, что
// человек прислал чей-то id).
//
// GET ?action=list           — список друзей с последним сообщением и счётчиком непрочитанных
//                               (для экрана «Чат» — с кем есть разговор).
// GET ?with=<id>&sinceAt=<ts> — сообщения с конкретным другом (sinceAt — только новые, для
//                               поллинга); попутно отмечает их прочитанными.
// POST { to, text }           — отправить сообщение другу.
import { CORS_HEADERS, corsPreflight } from "../lib/telegram-auth.mjs";
import { authUser } from "../lib/auth.mjs";
import { getUser, touchUser } from "../lib/user-store.mjs";
import { getRelations } from "../lib/friends-store.mjs";
import { getMessages, sendMessage, markRead, getLastReadAt } from "../lib/chat-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: CORS_HEADERS });
const MAX_TEXT = 2000;

async function isFriend(selfId, otherId) {
  const rel = await getRelations(selfId);
  return rel.friends.some((x) => String(x) === String(otherId));
}

export default async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();

  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const me = auth.user;
  await touchUser(me.id, { firstName: me.first_name, username: me.username });

  const url = new URL(req.url);

  if (req.method === "GET" && url.searchParams.get("action") === "list") {
    const rel = await getRelations(me.id);
    const convos = await Promise.all(rel.friends.map(async (fid) => {
      const [u, msgs, lastReadAt] = await Promise.all([getUser(fid), getMessages(me.id, fid), getLastReadAt(me.id, fid, me.id)]);
      const last = msgs[msgs.length - 1] || null;
      const unread = msgs.filter((m) => m.from !== me.id && m.at > lastReadAt).length;
      return { id: fid, firstName: u?.firstName || "", username: u?.username || "", lastMessage: last, unread };
    }));
    return json({ conversations: convos });
  }

  if (req.method === "GET") {
    const withId = url.searchParams.get("with");
    if (!withId) return json({ error: "with_required" }, 400);
    if (!(await isFriend(me.id, withId))) return json({ error: "not_friends" }, 403);
    const sinceAt = Number(url.searchParams.get("sinceAt")) || 0;
    const messages = await getMessages(me.id, withId, sinceAt);
    await markRead(me.id, withId, me.id);
    return json({ messages });
  }

  const body = await req.json().catch(() => ({}));
  const to = body.to;
  const text = String(body.text || "").trim().slice(0, MAX_TEXT);
  if (!to) return json({ error: "to_required" }, 400);
  if (!text) return json({ error: "text_empty" }, 400);
  if (!(await isFriend(me.id, to))) return json({ error: "not_friends" }, 403);
  const msg = await sendMessage(me.id, to, me.id, text);
  return json({ ok: true, message: msg });
};

export const config = { path: "/api/chat", method: ["GET", "POST", "OPTIONS"] };
