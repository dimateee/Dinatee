// Netlify: /api/redeem-promo — активация одноразового промокода на Pro.
import { authUser } from "../lib/auth.mjs";
import { redeemPromoCode } from "../lib/promo-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const user = auth.user;

  const body = await req.json().catch(() => ({}));
  const result = await redeemPromoCode(body.code, user.id);
  if (!result.ok) return json({ error: result.reason }, 400);
  return json({ active: true, until: result.pro.until, days: result.days });
};

export const config = { path: "/api/redeem-promo", method: "POST" };
