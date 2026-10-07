import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "./index.css";
import { inTelegram, isStandaloneDisplay, readSession, registerServiceWorker } from "./web.js";
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

const root = createRoot(document.getElementById("root"));
if (showApp) {
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
  import("./Landing.jsx").then(({ default: Landing }) => root.render(<Landing />));
}

registerServiceWorker();
initAnalytics();
