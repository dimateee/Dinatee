// Обёртка над Telegram Mini Apps API. Вне Telegram всё тихо работает как обычный сайт.
const tg = typeof window !== "undefined" ? window.Telegram && window.Telegram.WebApp : null;
const at = (v) => !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast(v));

export const TG = {
  raw: tg,
  inside: !!(tg && tg.initData),

  init() {
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      if (at("7.7") && tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if (at("6.1")) {
        tg.setHeaderColor("#14171b");
        tg.setBackgroundColor("#0b0d10");
      }
      if (at("7.10") && tg.setBottomBarColor) tg.setBottomBarColor("#0b0d10");
    } catch (e) {
      console.warn(e);
    }
    const apply = () => this.applySafeArea();
    apply();
    for (const ev of ["viewportChanged", "safeAreaChanged", "contentSafeAreaChanged", "fullscreenChanged"]) {
      try {
        tg.onEvent(ev, apply);
      } catch (e) {}
    }
  },

  // Отступы от вырезов экрана и кнопок Telegram в полноэкранном режиме
  applySafeArea() {
    if (!tg) return;
    const s = tg.safeAreaInset || {};
    const c = tg.contentSafeAreaInset || {};
    const root = document.documentElement.style;
    root.setProperty("--tg-sat", (s.top || 0) + (c.top || 0) + "px");
    root.setProperty("--tg-sab", (s.bottom || 0) + (c.bottom || 0) + "px");
    root.setProperty("--tg-sal", (s.left || 0) + (c.left || 0) + "px");
    root.setProperty("--tg-sar", (s.right || 0) + (c.right || 0) + "px");
  },

  userName() {
    const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    return u ? u.first_name || u.username || "" : "";
  },

  haptic(kind = "light") {
    if (!at("6.1")) return;
    try {
      if (kind === "success" || kind === "warning" || kind === "error") tg.HapticFeedback.notificationOccurred(kind);
      else if (kind === "select") tg.HapticFeedback.selectionChanged();
      else tg.HapticFeedback.impactOccurred(kind);
    } catch (e) {}
  },

  // Кнопка «Назад» в шапке Telegram
  _back: null,
  setBack(handler) {
    if (!at("6.1")) return;
    try {
      if (this._back) tg.BackButton.offClick(this._back);
      this._back = handler;
      if (handler) {
        tg.BackButton.onClick(handler);
        tg.BackButton.show();
      } else tg.BackButton.hide();
    } catch (e) {}
  },

  closingConfirmation(on) {
    if (!at("6.2")) return;
    try {
      if (on) tg.enableClosingConfirmation();
      else tg.disableClosingConfirmation();
    } catch (e) {}
  },

  canFullscreen() {
    return at("8.0") && typeof tg.requestFullscreen === "function";
  },
  isFullscreen() {
    return !!(tg && tg.isFullscreen);
  },
  toggleFullscreen() {
    if (!this.canFullscreen()) return;
    try {
      if (tg.isFullscreen) tg.exitFullscreen();
      else tg.requestFullscreen();
    } catch (e) {}
  },

  // ---------- облачное хранилище Telegram (до 1024 ключей по 4096 символов) ----------
  hasCloud() {
    return this.inside && at("6.9") && !!tg.CloudStorage;
  },
  cloudSet(key, value) {
    return new Promise((res) => {
      try {
        tg.CloudStorage.setItem(key, value, (err, ok) => res(!err && ok));
      } catch (e) {
        res(false);
      }
    });
  },
  cloudGet(keys) {
    return new Promise((res) => {
      try {
        tg.CloudStorage.getItems(keys, (err, vals) => res(err ? null : vals));
      } catch (e) {
        res(null);
      }
    });
  },
  cloudRemove(keys) {
    return new Promise((res) => {
      try {
        tg.CloudStorage.removeItems(keys, () => res(true));
      } catch (e) {
        res(false);
      }
    });
  },
};
