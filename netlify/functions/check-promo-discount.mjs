// Netlify: /api/check-promo-discount — проверяет промокод на скидку ДО оплаты, чтобы показать
// человеку новую цену на экране оплаты. Ничего не меняет и не списывает код — реальное
// списание происходит только после подтверждённой оплаты (см. applyTransaction в pro-store.mjs).
import { authUser } from "../lib/auth.mjs";
import { checkDiscountCode } from "../lib/promo-store.mjs";

const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req) => {
  const auth = authUser(req);
  if (!auth.ok) return json({ error: auth.code }, auth.status);
  const user = auth.user;

  const body = await req.json().catch(() => ({}));
  const result = await checkDiscountCode(body.code, user.id);
  if (!result.ok) return json({ error: result.reason }, 400);
  return json({ code: result.code, percent: result.percent });
};

export const config = { path: "/api/check-promo-discount", method: "POST" };
