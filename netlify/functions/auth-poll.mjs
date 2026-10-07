// Netlify: /api/auth-poll — сайт спрашивает, подтвердил ли человек вход в боте.
// Ответ: { status: "pending" } | { status: "expired" } | { status: "ok", session, user }.
import { signSession } from "../lib/auth.mjs";
import { consumeLogin } from "../lib/login-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req) => {
  const body = await req.json().catch(() => ({}));
  const result = await consumeLogin(body.token, body.secret);
  if (result.status !== "ok") return json({ status: result.status });
  try {
    const session = signSession(result.user);
    return json({ status: "ok", session, user: result.user });
  } catch (e) {
    return json({ error: e.code || "session_error" }, 500);
  }
};

export const config = { path: "/api/auth-poll", method: "POST" };
