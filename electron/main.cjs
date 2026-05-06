const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

const isDev = !app.isPackaged;
const APP_URL = process.env.ELECTRON_RENDERER_URL || "http://localhost:3000";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 460,
    height: 720,
    minWidth: 420,
    minHeight: 620,
    backgroundColor: "#0d1117",
    title: "MoodPlayer Terminal",
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

app.whenReady().then(() => {
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
