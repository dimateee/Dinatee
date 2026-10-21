/* Обёртка над Telegram.WebApp: в обычном браузере всё тихо работает без Telegram */
export const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
export const inTelegram = Boolean(tg?.initData);

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  try { tg.disableVerticalSwipes?.(); } catch {}
  try { tg.setHeaderColor?.("secondary_bg_color"); } catch {}
}

export const tgUser = () => tg?.initDataUnsafe?.user || null;

export const haptic = {
  tap: () => tg?.HapticFeedback?.impactOccurred?.("light"),
  ok: () => tg?.HapticFeedback?.notificationOccurred?.("success"),
  error: () => tg?.HapticFeedback?.notificationOccurred?.("error"),
  select: () => tg?.HapticFeedback?.selectionChanged?.(),
};

export function openLink(url) {
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener");
}

// Кнопка «Назад» в шапке Telegram
export function setBackButton(onBack) {
  const bb = tg?.BackButton;
  if (!bb) return () => {};
  if (!onBack) { bb.hide(); return () => {}; }
  bb.onClick(onBack);
  bb.show();
  return () => { bb.offClick(onBack); bb.hide(); };
}

/* Облачное хранилище Telegram: прогресс доступен на всех устройствах ребёнка.
   Лимит — 4096 символов на ключ, поэтому храним компактно. */
export const cloud = {
  get(key) {
    return new Promise((resolve) => {
      const cs = tg?.CloudStorage;
      if (!cs || !inTelegram) return resolve(null);
      try { cs.getItem(key, (err, value) => resolve(err ? null : value || null)); } catch { resolve(null); }
    });
  },
  set(key, value) {
    const cs = tg?.CloudStorage;
    if (!cs || !inTelegram || value.length > 4096) return;
    try { cs.setItem(key, value, () => {}); } catch {}
  },
};

export function confirmDialog(text) {
  return new Promise((resolve) => {
    if (tg?.showConfirm && inTelegram) tg.showConfirm(text, (ok) => resolve(Boolean(ok)));
    else resolve(window.confirm(text));
  });
}
