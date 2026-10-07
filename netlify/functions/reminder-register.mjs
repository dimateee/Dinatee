import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { verifySession } from "../lib/auth.mjs";

const env = (key) => globalThis.Netlify?.env?.get(key) ?? process.env[key];
const token = () => String(env("BOT_TOKEN") || "").trim().replace(/^["']+|["']+$/g, "").replace(/^bot(?=\d)/i, "");

function validateInitData(initData) {
  if (!initData || !token()) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token()).digest();
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (expected.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.abs(Date.now()/1000 - authDate) > 86400 * 7) return null;
  try { return JSON.parse(params.get("user") || "{}"); } catch { return null; }
}

export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  try {
    const body = await req.json();
    // Сайт присылает токен сессии (вход через бота), Mini App — подписанные данные запуска в теле
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.get("authorization") || "");
    const user = bearer ? verifySession(bearer[1].trim()) : validateInitData(body.initData);
    if (!user?.id) return Response.json({ ok:false, error:"invalid_telegram_init_data" }, { status: 401 });

    const payload = body.reminderData || {};
    const store = getStore("ritm-reminders");
    await store.set(`user:${user.id}`, JSON.stringify({
      userId: Number(user.id),
      chatId: Number(user.id),
      firstName: String(user.first_name || ""),
      username: String(user.username || ""),
      timezone: String(payload.timezone || "Europe/Moscow"),
      reminders: payload.reminders || {},
      tasks: Array.isArray(payload.tasks) ? payload.tasks.slice(0, 500) : [],
      trainingByDay: payload.trainingByDay || {},
      updatedAt: Date.now(),
    }));
    return Response.json({ ok:true });
  } catch (e) {
    console.error(e);
    return Response.json({ ok:false, error:"server_error" }, { status: 500 });
  }
};

export const config = { path: "/api/reminder-register", method: "POST" };
