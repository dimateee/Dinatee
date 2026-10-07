// Общая база товаров по штрихкоду, которую наполняют сами пользователи RITM.
// Готовой открытой базы Пятёрочки/Перекрёстка/Чижика и подобных сетей не существует — у них нет
// публичного API, а легально скачать такую базу неоткуда. Вместо этого — тот же принцип, что уже
// работал для одного пользователя (st.products на телефоне после фото этикетки), только теперь
// общий: как только ЛЮБОЙ человек один раз фотографирует этикетку товара, которого нет в открытой
// Open Food Facts (а для собственных марок сетевых магазинов так почти всегда и есть), результат
// попадает сюда и находится по тому же штрихкоду у ЛЮБОГО другого пользователя — без повторного
// сканирования. База растёт органически от реального использования приложения, а не от разовой
// закачки чужих данных.
import { getStore } from "@netlify/blobs";

const store = () => globalThis.__ritmProductStore || getStore({ name: "ritm-products", consistency: "strong" });

export async function getProduct(barcode) {
  const s = store();
  return (await s.get(`code:${barcode}`, { type: "json" }).catch(() => null)) || null;
}

// Насколько новое значение калорий близко к уже сохранённому — ±20% считаем тем же товаром
// (расхождение могло быть из-за того, что кто-то сфотографировал другую грань упаковки или
// округлил иначе), и это независимое подтверждение, а не правка.
function closeEnough(a, b) {
  if (!(a > 0) || !(b > 0)) return false;
  return Math.abs(a - b) / Math.max(a, 1) <= 0.2;
}

// Сознательно простая политика записи: первая осмысленная запись по штрихкоду становится
// каноничной и дальше не перезаписывается молча. Если бы любой следующий скан тихо перетирал
// предыдущий, один случайный плохой кадр (смазанное фото, не та сторона коробки) мог бы
// испортить уже верную общую запись, которой пользуются все. Совпадающие по калорийности
// повторы просто увеличивают confirmations (сигнал доверия); расходящиеся — откладываются
// в alternatives, ничего не ломая, на будущее (ручная сверка, более умная модерация и т.п.).
export async function saveProduct(barcode, product, addedBy) {
  const s = store();
  const key = `code:${barcode}`;
  const existing = await s.get(key, { type: "json" }).catch(() => null);
  const now = Date.now();

  if (!existing) {
    await s.setJSON(key, { barcode, ...product, confirmations: 1, addedBy: addedBy ?? null, addedAt: now, updatedAt: now });
    return { created: true };
  }
  if (closeEnough(existing.per100?.kcal, product.per100?.kcal)) {
    await s.setJSON(key, { ...existing, confirmations: (existing.confirmations || 1) + 1, updatedAt: now });
    return { created: false, confirmed: true };
  }
  const alternatives = Array.isArray(existing.alternatives) ? existing.alternatives : [];
  await s.setJSON(key, { ...existing, alternatives: [...alternatives, { ...product, addedBy: addedBy ?? null, at: now }].slice(-5), updatedAt: now });
  return { created: false, confirmed: false, conflicting: true };
}
