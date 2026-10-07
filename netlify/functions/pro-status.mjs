// Netlify: /api/pro-status — статус Pro текущего пользователя.
// ?tx=<id>     — дополнительно спрашивает Platega о конкретном платеже: Pro включится,
//                даже если уведомление от Platega ещё не пришло или Callback URL не настроен.
// ?restore=1   — «Восстановить покупку»: перепроверить в Platega все платежи человека, включая старые.
// Без параметров — сам тихо перепроверяет недавние неподтверждённые платежи (не чаще раза в 2 минуты),
// чтобы оплаченная Pro не терялась, если человек закрыл окно оплаты раньше подтверждения.
import { authUser } from "../lib/auth.mjs";
import { getPro, getPending, applyTransaction, restoreForUser, maybeReconcile } from "../lib/pro-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const LONG_INIT_DATA = 30 * 24 * 60 * 60; // для чтения своего статуса подпись Telegram годна 30 дней

export default async (req) => {
  // Mini App (подпись Telegram) или сайт (токен сессии после входа через бота)
  const auth = authUser(req, { maxAgeSec: LONG_INIT_DATA });
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const user = auth.user;
  const url = new URL(req.url);

  const tx = url.searchParams.get("tx");
  let paymentStatus = null;
  let restored = null;
  if (tx) {
    const pending = await getPending(tx);
    if (pending && String(pending.userId) === String(user.id)) {
      try {
        const r = await applyTransaction(tx);
        paymentStatus = r.granted || (r.duplicate && r.pro) ? "CONFIRMED" : r.revoked ? "CHARGEBACKED" : r.status || r.reason || null;
      } catch (e) { paymentStatus = "UNKNOWN"; }
    }
  } else if (url.searchParams.get("restore") === "1") {
    // Ручное восстановление — не чаще раза в минуту, чтобы не долбить Platega
    try {
      const r = await restoreForUser(user.id);
      if (r.tooOften) return json({ error: "restore_too_often" }, 429);
      restored = { checked: r.checked.length, granted: r.granted };
    } catch (e) {
      return json({ error: "restore_failed" }, 502);
    }
  } else {
    await maybeReconcile(user.id).catch(() => null);
  }
  const pro = await getPro(user.id);
  return json({ active: pro.active, until: pro.until || 0, plan: pro.plan || null, paymentStatus, restored });
};

export const config = { path: "/api/pro-status", method: "GET" };
