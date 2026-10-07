// Главный процесс Electron-обёртки RITM для Windows/macOS/Linux.
// Загружает уже собранный веб-код (dist/) в обычное окно — то же приложение,
// что работает в Telegram, просто без Telegram вокруг (см. isStandalone() в src/App.jsx).
// CommonJS (не import/export) — так задано в electron/package.json ("type": "commonjs"),
// это нужно сандбоксированному preload.js, а main.js должен быть в той же системе модулей.
const { app, BrowserWindow, shell, Menu, session } = require("electron");
const path = require("node:path");

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 880,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: "#000000",
    title: "RITM",
    icon: path.join(__dirname, "..", "resources", "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Ссылки, которые приложение открывает через window.open (поддержка, политика и т.д.),
  // должны уходить в обычный браузер, а не открывать ещё одно Electron-окно.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  // Камера нужна для фото еды и сканера штрихкода, микрофон — для голосового помощника.
  // По умолчанию Electron отказывает во всех запросах разрешений — разрешаем только эти два.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === "media" || permission === "camera" || permission === "microphone");
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
