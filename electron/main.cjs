const { app, BrowserWindow, session, shell, ipcMain, net } = require("electron");
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
    return JSON.parse(raw).cookie || null;
  } catch { return null; }
}

function saveCookie(cookie) {
  fs.writeFileSync(
    COOKIE_FILE,
    JSON.stringify({ cookie, savedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

function clearSavedCookie() {
  try {
    if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE);
  } catch {}
}

function createWindow() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(["media", "microphone"].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => {
    return ["media", "microphone"].includes(permission);
  });

  const mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 1000,
    minHeight: 620,
    backgroundColor: "#faf8f7",
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

  // Check if cookie is saved
  ipcMain.handle("qqmusic:cookie-status", () => {
    const cookie = readSavedCookie();
    return { loggedIn: Boolean(cookie), cookie: cookie || "" };
  });


  ipcMain.handle("qqmusic:logout", async () => {
    clearSavedCookie();
    try {
      await session.defaultSession.cookies.remove("https://y.qq.com", "uin");
      await session.defaultSession.cookies.remove("https://y.qq.com", "qqmusic_key");
      await session.defaultSession.cookies.remove("https://y.qq.com", "wxuin");
    } catch {}
    return { success: true };
  });

  // Get play URL using Electron's Chromium net.fetch (bypasses API signing)
  ipcMain.handle("qqmusic:vkey", async (_event, songmid) => {
    const cookie = readSavedCookie();
    if (!cookie) return { url: null, error: "No QQ Music cookie" };

    const uinMatch = cookie.match(/(?:^|;\s*)uin=([^;]+)/);
    const uin = uinMatch ? uinMatch[1].replace(/\D/g, "") : "0";

    try {
      const response = await net.fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Referer: "https://y.qq.com",
          Origin: "https://y.qq.com",
          Cookie: cookie,
        },
        body: JSON.stringify({
          comm: { uin: Number(uin) || 0, format: "json", ct: 24, cv: 0 },
          req_0: {
            module: "vkey.GetVkeyServer",
            method: "CgiGetVkey",
            param: {
              guid: String(Math.floor(Math.random() * 10000000000)),
              songmid: [songmid],
              songtype: [0],
              uin: String(uin),
              loginflag: 1,
              platform: "20",
            },
          },
        }),
      });

      if (!response.ok) return { url: null, error: `HTTP ${response.status}` };

      const data = await response.json();
      const vkeyData = data?.req_0;
      if (!vkeyData || vkeyData.code !== 0) {
        const code = vkeyData?.code ?? "null";
        const msg = vkeyData?.msg || "";
        return { url: null, error: `vkey code ${code}${msg ? ` (${msg})` : ""}` };
      }

      const info = vkeyData.data?.midurlinfo?.[0];
      const sip = vkeyData.data?.sip?.[0];

      if (info?.purl && sip) {
        const playUrl = info.purl.startsWith("http") ? info.purl : `${sip}${info.purl}`;
        return { url: playUrl, error: null };
      }

      return { url: null, error: "purl empty" };
    } catch (err) {
      return { url: null, error: err instanceof Error ? err.message : String(err) };
    }
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
