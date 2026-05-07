const { app, BrowserWindow, session, shell, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { loginQQMusic } = require("./qqmusicLogin.cjs");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const isDev = !app.isPackaged;
const APP_URL = process.env.ELECTRON_RENDERER_URL || "http://localhost:3000";

const COOKIE_FILE = path.join(__dirname, "..", ".qqmusic-cookie");

function readSavedCookie() {
  try {
    if (!fs.existsSync(COOKIE_FILE)) return null;
    const raw = fs.readFileSync(COOKIE_FILE, "utf-8").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.cookie || null;
  } catch {
    return null;
  }
}

function saveCookie(cookie) {
  fs.writeFileSync(
    COOKIE_FILE,
    JSON.stringify({ cookie, savedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

function createWindow() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(["media", "microphone"].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return ["media", "microphone"].includes(permission);
  });

  const mainWindow = new BrowserWindow({
    width: 980,
    height: 740,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#fff5f7",
    title: "MoodPlayer Agent",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  void mainWindow.loadURL(APP_URL);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

// ── IPC handlers ────────────────────────────────────────

function setupIPC() {
  // QQ Music login flow
  ipcMain.handle("qqmusic:login", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const cookie = await loginQQMusic(win);
    if (cookie) {
      saveCookie(cookie);
      return { success: true, cookie };
    }
    return { success: false };
  });

  // Check if cookie is already saved
  ipcMain.handle("qqmusic:cookie-status", () => {
    const cookie = readSavedCookie();
    return { loggedIn: Boolean(cookie), cookie: cookie || "" };
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
