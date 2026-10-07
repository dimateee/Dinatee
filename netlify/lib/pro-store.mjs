// Статус подписки Pro хранится на сервере (Netlify Blobs): ключ — Telegram ID пользователя.
// Так Pro видно на всех устройствах и его нельзя «включить» на телефоне без оплаты.
//
// Защита от «слетевшей» Pro:
//  - каждый платёж запоминается за человеком (utx:<id>), чтобы его можно было найти и перепроверить;
//  - reconcileUser() заново спрашивает Platega обо всех его неподтверждённых платежах — так Pro
//    включается, даже если уведомление от Platega не дошло, а человек закрыл окно оплаты;
//  - каждая выдача дней пишется в историю (history) — видно, когда и откуда пришли дни;
//  - сумма платежа без поля amount больше не считается «неверной суммой».
import { getStore } from "@netlify/blobs";
import { PLANS, getTransaction } from "./platega.mjs";
import { consumeDiscountCode } from "./promo-store.mjs";

const DAY = 24 * 60 * 60 * 1000;
const store = () => globalThis.__ritmProStore || getStore({ name: "ritm-pro", consistency: "strong" });
const HISTORY_MAX = 40;
const USER_TX_MAX = 60;

export async function getPro(userId) {
  const pro = await store().get(`user:${userId}`, { type: "json" }).catch(() => null);
  return pro ? { ...pro, active: (pro.until || 0) > Date.now() } : { active: false, until: 0 };
}

// Записать новый срок Pro, сохранив историю выдач
async function saveUntil(userId, until, entry) {
  const s = store();
  const cur = (await s.get(`user:${userId}`, { type: "json" }).catch(() => null)) || {};
  const history = [{ at: Date.now(), until, ...entry }, ...(cur.history || [])].slice(0, HISTORY_MAX);
  const rec = { ...cur, until, plan: entry.plan || cur.plan || null, updatedAt: Date.now(), history };
  if (entry.tx) rec.lastTx = entry.tx;
  if (entry.code) rec.lastPromo = entry.code;
  delete rec.active;
  await s.setJSON(`user:${userId}`, rec);
  return { ...rec, active: until > Date.now() };
}

// Платежи человека — список id транзакций, новые первыми
async function addUserTx(userId, txId) {
  const s = store();
  const list = (await s.get(`utx:${userId}`, { type: "json" }).catch(() => null)) || [];
  if (list.includes(txId)) return;
  await s.setJSON(`utx:${userId}`, [txId, ...list].slice(0, USER_TX_MAX));
}
export const getUserTxIds = async (userId) => (await store().get(`utx:${userId}`, { type: "json" }).catch(() => null)) || [];

// extra — доп. данные, которые нужно вспомнить, когда придёт подтверждение оплаты:
// promoCode (если применили код на скидку) и amount (реальная сумма к оплате с учётом скидки).
export async function rememberPending(txId, userId, plan, extra = {}) {
  await store().setJSON(`pending:${txId}`, { userId, plan, at: Date.now(), ...extra });
  await addUserTx(userId, txId).catch(() => {});
}
export const getPending = (txId) => store().get(`pending:${txId}`, { type: "json" }).catch(() => null);
export const getTxRecord = (txId) => store().get(`tx:${txId}`, { type: "json" }).catch(() => null);

// Выдать Pro на N дней в обход оплаты — промокоды на дни (promo-store.mjs) и выдача админом
// (admin-pro.mjs). Дни добавляются к уже оставшимся, как и при обычной оплате.
export async function grantDays(userId, days, meta = {}) {
  const cur = await getPro(userId);
  const until = Math.max(Date.now(), cur.until || 0) + days * DAY;
  await saveUntil(userId, until, { days, plan: meta.plan || "promo", source: meta.source || "promo", code: meta.code || null, note: meta.note || null });
  return { active: true, until };
}

// Сумму из ответа Platega ищем в нескольких полях. 0 — значит, поля нет (а не «заплатили 0 ₽»).
function paidAmount(tx) {
  for (const v of [tx?.paymentDetails?.amount, tx?.amount, tx?.paymentAmount, tx?.details?.amount]) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

// Обработка статуса платежа. Вызывается из уведомления Platega, из проверки статуса в приложении
// и из восстановления покупок. Статус и сумму всегда перепроверяем запросом к Platega,
// повторы одного платежа игнорируем.
export async function applyTransaction(txId) {
  const s = store();
  const tx = await getTransaction(txId);
  const status = String(tx?.status || "").toUpperCase();
  let meta = null;
  try { meta = JSON.parse(tx?.payload || "null"); } catch (e) { /* payload не наш */ }
  const pending = await getPending(txId);
  // payload от Platega — основной источник; pending (который мы сами запомнили при создании
  // платежа) — запасной, на случай если Platega его обрежет или не вернёт.
  if (!meta?.u && pending) meta = { u: pending.userId, p: pending.plan, c: pending.promoCode || undefined, a: pending.amount };
  const plan = PLANS[meta?.p];
  if (!meta?.u || !plan) return { ok: false, reason: "unknown_payment" };
  await addUserTx(meta.u, txId).catch(() => {});
  const done = await s.get(`tx:${txId}`, { type: "json" }).catch(() => null);
  // Ожидаемая сумма — обычная цена тарифа, либо сниженная промокодом. Процент скидки и саму
  // сумму всегда считает сервер в create-payment.mjs в момент создания платежа — здесь мы
  // только сверяем, что реально оплаченная сумма ей соответствует, а не доверяем клиенту.
  const expectedRaw = meta?.a ?? pending?.amount;
  const expected = Number(expectedRaw) > 0 ? Number(expectedRaw) : plan.rub;

  if (status === "CONFIRMED") {
    if (done?.status === "CONFIRMED" || done?.status === "CHARGEBACKED") return { ok: true, duplicate: true, userId: meta.u, pro: await getPro(meta.u) };
    const amount = paidAmount(tx);
    // Сумма есть и она меньше ожидаемой — не выдаём. Суммы нет в ответе — не считаем это
    // недоплатой: раньше из-за этого оплаченный платёж мог навсегда остаться без Pro.
    if (amount > 0 && amount + 0.01 < expected) {
      console.error("amount mismatch", txId, amount, expected);
      return { ok: false, reason: "amount_mismatch", amount };
    }
    const cur = await getPro(meta.u);
    const until = Math.max(Date.now(), cur.until || 0) + plan.days * DAY;
    await s.setJSON(`tx:${txId}`, { userId: meta.u, plan: meta.p, days: plan.days, status: "CONFIRMED", promoCode: meta.c || null, amount: amount || expected, at: Date.now() });
    await saveUntil(meta.u, until, { days: plan.days, plan: meta.p, source: "payment", tx: txId });
    // Код на скидку списывается именно здесь — только когда оплата реально подтверждена,
    // а не в момент, когда человек его ввёл на экране оплаты.
    if (meta.c) await consumeDiscountCode(meta.c, meta.u).catch(() => {});
    return { ok: true, granted: true, userId: meta.u, pro: { active: true, until, plan: meta.p } };
  }

  if (status === "CHARGEBACKED" || status === "CHARGEBACK") {
    // Возврат денег — забираем оплаченные дни
    if (!done || done.status === "CHARGEBACKED") return { ok: true, duplicate: true, userId: meta.u };
    const cur = await getPro(meta.u);
    const until = Math.max(Date.now(), (cur.until || 0) - done.days * DAY);
    await saveUntil(meta.u, until, { days: -done.days, plan: cur.plan, source: "chargeback", tx: txId });
    await s.setJSON(`tx:${txId}`, { ...done, status: "CHARGEBACKED", refundedAt: Date.now() });
    return { ok: true, revoked: true, userId: meta.u };
  }

  // Отменённый платёж запоминаем, чтобы не спрашивать Platega о нём снова при каждой проверке
  if (status === "CANCELED" && !done) await s.setJSON(`final:${txId}`, { status, at: Date.now() }).catch(() => {});
  return { ok: true, status, userId: meta.u }; // PENDING или CANCELED — ничего не меняем
}

// Платежи, по которым ещё нет окончательного ответа (не подтверждён, не отменён)
async function unresolvedTx(userId, maxAgeDays) {
  const s = store();
  const out = [];
  for (const id of await getUserTxIds(userId)) {
    if (await s.get(`tx:${id}`, { type: "json" }).catch(() => null)) continue;
    if (await s.get(`final:${id}`, { type: "json" }).catch(() => null)) continue;
    const p = await getPending(id);
    if (maxAgeDays && p?.at && Date.now() - p.at > maxAgeDays * DAY) continue;
    out.push(id);
  }
  return out;
}

// Платежи, созданные до появления списка utx:<id>, — ищем по всем pending-записям (один раз на человека)
async function adoptLegacyPayments(userId) {
  const s = store();
  if (await s.get(`legacy:${userId}`, { type: "json" }).catch(() => null)) return;
  const { blobs = [] } = await s.list({ prefix: "pending:" }).catch(() => ({ blobs: [] }));
  for (const b of blobs) {
    const p = await s.get(b.key, { type: "json" }).catch(() => null);
    if (p && String(p.userId) === String(userId)) await addUserTx(userId, b.key.slice("pending:".length)).catch(() => {});
  }
  await s.setJSON(`legacy:${userId}`, { at: Date.now() });
}

// Перепроверить в Platega все неподтверждённые платежи человека и включить Pro по оплаченным.
// deep — ещё и найти старые платежи (до появления списка) и не ограничивать их возраст.
export async function reconcileUser(userId, { deep = false } = {}) {
  if (deep) await adoptLegacyPayments(userId);
  const ids = await unresolvedTx(userId, deep ? 0 : 7);
  let granted = 0;
  const checked = [];
  for (const id of ids.slice(0, 20)) {
    try {
      const r = await applyTransaction(id);
      if (r.granted) granted++;
      checked.push({ id, status: r.granted ? "CONFIRMED" : r.status || r.reason || null });
    } catch (e) {
      checked.push({ id, status: "ERROR" });
    }
  }
  return { checked, granted, pro: await getPro(userId) };
}

// «Восстановить покупку» (из приложения и из бота): не чаще раза в минуту, со старыми платежами
export async function restoreForUser(userId) {
  const s = store();
  const last = await s.get(`restore:${userId}`, { type: "json" }).catch(() => null);
  if (last?.at && Date.now() - last.at < 60 * 1000) return { tooOften: true };
  await s.setJSON(`restore:${userId}`, { at: Date.now() });
  return reconcileUser(userId, { deep: true });
}

// Автопроверка из /api/pro-status: не чаще раза в 2 минуты и только если есть что проверять
export async function maybeReconcile(userId) {
  const s = store();
  const last = await s.get(`recon:${userId}`, { type: "json" }).catch(() => null);
  if (last?.at && Date.now() - last.at < 2 * 60 * 1000) return null;
  const ids = await unresolvedTx(userId, 7);
  if (!ids.length) return null;
  await s.setJSON(`recon:${userId}`, { at: Date.now() });
  return reconcileUser(userId);
}

// Платежи человека для админа: что, когда, на сколько и в каком статусе
export async function paymentHistory(userId) {
  const out = [];
  for (const id of await getUserTxIds(userId)) {
    const [p, t, f] = await Promise.all([getPending(id), getTxRecord(id), store().get(`final:${id}`, { type: "json" }).catch(() => null)]);
    out.push({ id, plan: t?.plan || p?.plan || null, amount: t?.amount || p?.amount || null, at: p?.at || t?.at || null, status: t?.status || f?.status || "PENDING", via: p?.via || null });
  }
  return out;
}
