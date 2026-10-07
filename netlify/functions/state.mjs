// Netlify: /api/state — копия данных приложения на сервере (Netlify Blobs), привязанная к Telegram ID.
// Через неё синхронизируются сайт, установленное приложение и Mini App одного человека.
//
// GET  /api/state?known=<updatedAt>  → { empty: true } | { unchanged: true, updatedAt } | { updatedAt, state }
// PUT  /api/state  { state, base }   → { ok: true, updatedAt } | 409 { error: "conflict", updatedAt }
//
// base — версия, которую устройство видело последней. Если на сервере уже другая версия
// (успело записать другое устройство), запись отклоняется — устройство заберёт свежие данные,
// объединит их со своими (mergeStates в src/App.jsx) и попробует снова.
import { getStore } from "@netlify/blobs";
import { authUser } from "../lib/auth.mjs";

const MAX_BYTES = 4_500_000;
const store = () => globalThis.__ritmDataStore || getStore({ name: "ritm-data", consistency: "strong" });
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const key = `user:${auth.user.id}`;
  const s = store();

  if (req.method === "GET") {
    const known = Number(new URL(req.url).searchParams.get("known"));
    const rec = await s.get(key, { type: "json" }).catch(() => null);
    if (!rec?.state) return json({ empty: true });
    if (known && known === rec.updatedAt) return json({ unchanged: true, updatedAt: rec.updatedAt });
    return json({ updatedAt: rec.updatedAt, state: rec.state });
  }

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: "too_large" }, 413);
  let body = null;
  try { body = JSON.parse(raw); } catch (e) { return json({ error: "bad_json" }, 400); }
  const state = body?.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) return json({ error: "bad_state" }, 400);

  const cur = await s.get(key, { type: "json" }).catch(() => null);
  const base = body.base == null ? null : Number(body.base);
  if (cur?.state && cur.updatedAt !== base) return json({ error: "conflict", updatedAt: cur.updatedAt }, 409);

  const updatedAt = Number(state.updatedAt) || Date.now();
  await s.setJSON(key, { updatedAt, state: { ...state, updatedAt }, savedAt: Date.now(), via: auth.via });
  return json({ ok: true, updatedAt });
};

export const config = { path: "/api/state", method: ["GET", "PUT"] };
