import { createRoot, hydrateRoot } from "react-dom/client";
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import "./fonts.css";
import "./index.css";
import { inTelegram, isStandaloneDisplay, readSession, registerServiceWorker, watchTelegramInsets } from "./web.js";
import { initAnalytics } from "./analytics.js";

// Что показать по этому адресу:
// - само приложение — внутри Telegram (Mini App), в нативных сборках (iOS, Windows), в приложении,
//   установленном с сайта, по адресу /app, а также тем, кто уже вошёл на сайте;
// - лендинг — всем остальным на главной странице сайта.
// И приложение, и лендинг подгружаются отдельными файлами, чтобы Mini App не качал лендинг и наоборот.
const isNative = () => {
  try { if (Capacitor.isNativePlatform()) return true; } catch (e) { /* не Capacitor */ }
  return !!window.RITM_ELECTRON || !/^https?:$/.test(window.location.protocol);
};
const path = window.location.pathname.replace(/\/+$/, "");
const showApp = inTelegram()
  || window.location.hash.includes("tgWebAppData")
  || isNative()
  || isStandaloneDisplay()
  || path === "/app" || path.startsWith("/app/")
  || !!readSession();

// Флаг «сейчас React оживляет готовый HTML»: счётчики чисел (src/motion.jsx) по нему понимают,
// что число уже было видно на экране и мигать в 0 не нужно. Снимается сразу после оживления.
function Hydrated({ children }) {
  useEffect(() => { window.__ritmHydrating = false; }, []);
  return children;
}

if (showApp) {
  // Отступы под кнопки Telegram в полноэкранном режиме — до первой отрисовки, чтобы шапка не прыгала
  watchTelegramInsets();
  const root = createRoot(document.getElementById("root"));
  import("./App.jsx").then(({ default: App, ErrorBoundary, installGlobalErrorLogging }) => {
    // Ловит ошибки вне React (необработанные исключения, отклонённые промисы без catch) —
    // раньше такие падения были не видны нигде, кроме как «бот подвис/вылетел» со слов человека.
    installGlobalErrorLogging();
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>,
    );
  });
} else {
  import("./Landing.jsx").then(({ default: Landing }) => {
    // Лендинг уже пришёл готовым HTML (scripts/prerender.mjs) — React его «оживляет» (hydrateRoot), а не
    // рисует заново поверх: раньше страница перерисовывалась целиком, блоки сдвигались, а главный
    // блок «появлялся» второй раз — это и было медленное LCP и сдвиг макета в Lighthouse.
    const pre = document.getElementById("prerender");
    if (pre && pre.firstElementChild) {
      document.querySelector("#root > .boot")?.remove();
      window.__ritmHydrating = true;
      hydrateRoot(pre, <Hydrated><Landing /></Hydrated>, {
        onRecoverableError: (e) => console.warn("prerender: не совпало с готовым HTML, лендинг перерисован", e?.message || e),
      });
    } else {
      createRoot(document.getElementById("root")).render(<Landing />);
    }
  });
}

registerServiceWorker();
initAnalytics();
