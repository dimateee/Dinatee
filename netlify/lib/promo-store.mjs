// Промокоды на Pro: создаёт админ прямо в приложении, активирует/применяет любой человек.
// Каждый код по умолчанию одноразовый, но можно задать лимит использований (maxUses) —
// тогда ОДИН и тот же код срабатывает у разных людей, пока лимит не исчерпан (например,
// один код на раздачу 100 новым подписчикам). Один человек может использовать конкретный
// код только один раз — повторный ввод тем же человеком не даёт выдать себе Pro дважды.
// Два типа кода:
//  - "days"     — сразу выдаёт дни Pro (как и раньше), через общий grantDays из pro-store.mjs.
//  - "discount" — не даёт Pro сам, а даёт скидку в процентах на обычную оплату; списывается
//                 использованным только после подтверждённой оплаты (см. applyTransaction
//                 в pro-store.mjs), а не в момент ввода кода — иначе человек мог бы «сжечь»
//                 код, не оплатив.
import { getStore } from "@netlify/blobs";
import { grantDays } from "./pro-store.mjs";

const store = () => globalThis.__ritmPromoStore || getStore({ name: "ritm-promo", consistency: "strong" });

// Без символов, которые легко перепутать при ручном вводе: 0/O, 1/I/L
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

// Список использований кода — старые записи (до появления лимита использований) хранили
// только used/usedBy/usedAt на одного человека; здесь приводим их к единому виду, чтобы
// код, созданный раньше, продолжил корректно работать и после этого обновления.
function redemptionsOf(record) {
  if (Array.isArray(record.redemptions)) return record.redemptions;
  if (record.used && record.usedBy != null) return [{ userId: record.usedBy, at: record.usedAt || Date.now() }];
  return [];
}
const maxUsesOf = (record) => Math.max(1, Number(record.maxUses) || 1);

// opts: { type: "days", days } или { type: "discount", percent }. count — сколько РАЗНЫХ
// кодов выдать сразу одним нажатием (например, 50 разных кодов разным людям). maxUses —
// сколько раз можно использовать КАЖДЫЙ из этих кодов (1 — обычный одноразовый код; 10/50/100 —
// один и тот же код работает у стольких разных людей, пока не наберётся столько активаций).
export async function createPromoCodes(opts, createdBy, count = 1, maxUses = 1) {
  const type = opts?.type === "discount" ? "discount" : "days";
  const s = store();
  const n = Math.max(1, Math.min(200, Math.round(count) || 1));
  const uses = Math.max(1, Math.min(100000, Math.round(maxUses) || 1));

  const seenInBatch = new Set();
  const codes = [];
  for (let i = 0; i < n; i++) {
    let code = randomCode();
    // Коллизии крайне маловероятны (32^8 вариантов), но на всякий случай перегенерируем —
    // и с уже существующими кодами, и с теми, что только что сгенерировали в этой же партии
    for (let tries = 0; tries < 8 && (seenInBatch.has(code) || (await s.get(`code:${code}`, { type: "json" }).catch(() => null))); tries++) code = randomCode();
    seenInBatch.add(code);
    codes.push(code);
  }

  const records = codes.map((code) => ({
    code,
    type,
    days: type === "days" ? opts.days : null,
    percent: type === "discount" ? opts.percent : null,
    createdBy: createdBy ?? null,
    createdAt: Date.now(),
    maxUses: uses,
    redemptions: [], // [{ userId, at }] — кто уже использовал этот код
    // used/usedBy/usedAt оставлены только для обратной совместимости со старыми записями;
    // источник правды теперь redemptions.length vs maxUses
    used: false,
    usedBy: null,
    usedAt: null,
  }));
  await Promise.all(records.map((r) => s.setJSON(`code:${r.code}`, r)));

  if (createdBy != null) {
    const listKey = `by:${createdBy}`;
    const list = (await s.get(listKey, { type: "json" }).catch(() => null)) || [];
    await s.setJSON(listKey, [...codes, ...list].slice(0, 300));
  }
  return records;
}

// Старый одноразовый вызов — оставлен как короткая обёртка вокруг createPromoCodes(..., 1, 1)
export async function createPromoCode(opts, createdBy) {
  const [record] = await createPromoCodes(opts, createdBy, 1, 1);
  return record;
}

export async function listPromoCodes(createdBy) {
  const s = store();
  const codes = (await s.get(`by:${createdBy}`, { type: "json" }).catch(() => null)) || [];
  const records = await Promise.all(codes.map((c) => s.get(`code:${c}`, { type: "json" }).catch(() => null)));
  // Добавляем uses/maxUses в явном виде, чтобы клиенту не нужно было знать про старый формат
  return records.filter(Boolean).map((r) => ({ ...r, uses: redemptionsOf(r).length, maxUses: maxUsesOf(r) }));
}

// Приводим ввод к тому же виду, в котором код хранится (XXXX-XXXX) — неважно, ввели
// код с дефисом, без него или с пробелами вместо дефиса.
function normalizeCode(raw) {
  const clean = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

// Активация кода на дни — сразу выдаёт Pro. Код на скидку сюда не подходит: про него
// отдельно объясняем, что его нужно вводить при оплате, а не здесь.
export async function redeemPromoCode(rawCode, userId) {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "promo_empty" };
  const s = store();
  const record = await s.get(`code:${code}`, { type: "json" }).catch(() => null);
  if (!record) return { ok: false, reason: "promo_not_found" };
  if (record.type === "discount") return { ok: false, reason: "promo_is_discount" };

  const redemptions = redemptionsOf(record);
  if (redemptions.some((r) => String(r.userId) === String(userId))) return { ok: false, reason: "promo_already_used" };
  if (redemptions.length >= maxUsesOf(record)) return { ok: false, reason: "promo_used" };

  const pro = await grantDays(userId, record.days, { plan: "promo", code });
  const updated = [...redemptions, { userId, at: Date.now() }];
  await s.setJSON(`code:${code}`, { ...record, redemptions: updated, used: updated.length >= maxUsesOf(record), usedBy: userId, usedAt: Date.now() });
  return { ok: true, days: record.days, pro };
}

// Проверка кода на скидку — НИЧЕГО не меняет и не списывает использование. Вызывается и для
// показа скидки до оплаты (чтобы показать человеку новую цену), и ещё раз сервером прямо перед
// созданием платежа (решение о реальной скидке всегда считает сервер по проценту из записи
// кода, а не то, что мог бы подделать клиент). userId — чтобы проверить, не использовал ли уже
// именно этот человек именно этот код (у кода может быть лимит на много разных людей).
export async function checkDiscountCode(rawCode, userId) {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: "promo_empty" };
  const s = store();
  const record = await s.get(`code:${code}`, { type: "json" }).catch(() => null);
  if (!record) return { ok: false, reason: "promo_not_found" };
  if (record.type !== "discount") return { ok: false, reason: "promo_is_days" };

  const redemptions = redemptionsOf(record);
  if (userId != null && redemptions.some((r) => String(r.userId) === String(userId))) return { ok: false, reason: "promo_already_used" };
  if (redemptions.length >= maxUsesOf(record)) return { ok: false, reason: "promo_used" };
  return { ok: true, code, percent: record.percent };
}

// Записывает одно использование кода на скидку конкретным человеком. Вызывается только из
// applyTransaction в pro-store.mjs, после того как Platega подтвердила оплату — то есть ровно
// тогда, когда скидка реально сработала, а не раньше. Возвращает false, если лимит уже
// исчерпан или этот человек уже использовал этот код (гонка между двумя одновременными
// оплатами одним кодом — применится только та, что успела первой).
export async function consumeDiscountCode(rawCode, userId) {
  const code = normalizeCode(rawCode);
  if (!code) return false;
  const s = store();
  const record = await s.get(`code:${code}`, { type: "json" }).catch(() => null);
  if (!record) return false;
  const redemptions = redemptionsOf(record);
  if (redemptions.some((r) => String(r.userId) === String(userId))) return false;
  if (redemptions.length >= maxUsesOf(record)) return false;
  const updated = [...redemptions, { userId, at: Date.now() }];
  await s.setJSON(`code:${code}`, { ...record, redemptions: updated, used: updated.length >= maxUsesOf(record), usedBy: userId, usedAt: Date.now() });
  return true;
}
