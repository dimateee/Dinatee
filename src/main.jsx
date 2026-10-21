import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { initTelegram, tg } from "./lib/telegram.js";

initTelegram();

// Тема: следуем за Telegram, а в браузере — за системной
const applyTheme = () => {
  const dark = tg?.colorScheme ? tg.colorScheme === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
};
applyTheme();
tg?.onEvent?.("themeChanged", applyTheme);

createRoot(document.getElementById("root")).render(<App />);
