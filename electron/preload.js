// Сообщаем странице, что она открыта в настольном приложении RITM, а не в браузере или Telegram —
// App.jsx читает window.RITM_ELECTRON, чтобы включить тот же «отдельный» режим, что и в iOS-приложении
// (данные только на этом компьютере, Pro включён сразу, без завязки на Telegram-аккаунт).
const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("RITM_ELECTRON", true);
