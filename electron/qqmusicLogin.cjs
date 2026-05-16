/**
 * QQ Music login helper for Electron.
 * Opens a BrowserWindow to y.qq.com, lets the user scan QR code to log in,
 * then extracts cookies for use in API calls.
 */

const { app, BrowserWindow, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

const QQ_MUSIC_URL = "https://y.qq.com";
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function getWindowIcon() {
  const iconPath = path.join(app.getAppPath(), "build", "icon.ico");
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

/**
 * Extract the uin cookie value (QQ number) — the key indicator of login success.
 */
function extractUin(cookies) {
  const uinCookie = cookies.find((c) => c.name === "uin");
  return uinCookie?.value || null;
}

/**
 * Build a cookie header string from Electron cookies.
 */
function buildCookieString(cookies) {
  return cookies
    .filter((c) => c.domain.includes("qq.com") || c.domain.includes("y.qq.com"))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function loginQQMusic(parentWindow) {
  return new Promise((resolve) => {
    const loginWindow = new BrowserWindow({
      width: 800,
      height: 700,
      ...(parentWindow ? { parent: parentWindow } : {}),
      modal: false,
      title: "登录 QQ 音乐 — 请扫码",
      icon: getWindowIcon(),
      backgroundColor: "#fff5f7",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    loginWindow.show();
    loginWindow.focus();
    loginWindow.moveTop();
    loginWindow.setAlwaysOnTop(true);
    setTimeout(() => {
      if (!loginWindow.isDestroyed()) loginWindow.setAlwaysOnTop(false);
    }, 1500);

    let resolved = false;

    const finish = (cookie) => {
      if (resolved) return;
      resolved = true;
      if (!loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      resolve(cookie);
    };

    // Poll for login cookies every 2 seconds
    const pollInterval = setInterval(async () => {
      if (resolved || loginWindow.isDestroyed()) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const cookies = await session.defaultSession.cookies.get({
          domain: ".qq.com",
        });
        const uin = extractUin(cookies);
        if (uin && uin !== "0" && uin !== "") {
          const cookieStr = buildCookieString(cookies);
          clearInterval(pollInterval);
          finish(cookieStr);
        }
      } catch {
        // Keep polling
      }
    }, 2000);

    // Also watch for navigation to catch the OAuth redirect
    loginWindow.webContents.on("did-navigate", async (_event, url) => {
      if (resolved) return;

      // After successful OAuth, redirect back to y.qq.com
      if (url.includes("y.qq.com") && !url.includes("login")) {
        try {
          const cookies = await session.defaultSession.cookies.get({
            domain: ".qq.com",
          });
          const uin = extractUin(cookies);
          if (uin && uin !== "0" && uin !== "") {
            const cookieStr = buildCookieString(cookies);
            clearInterval(pollInterval);
            finish(cookieStr);
          }
        } catch {
          // Keep waiting
        }
      }
    });

    loginWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      if (resolved || errorCode === -3) return;
      const message = `QQ 音乐登录页加载失败：${errorDescription} (${errorCode})`;
      const target = validatedURL || QQ_MUSIC_URL;
      loginWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          `<body style="font-family: sans-serif; padding: 24px; color: #3a2f35;">
            <h2>QQ 音乐登录页没有加载成功</h2>
            <p>${message}</p>
            <p>目标地址：${target}</p>
          </body>`,
        )}`,
      ).catch(() => {});
    });

    loginWindow.on("closed", () => {
      clearInterval(pollInterval);
      finish(null);
    });

    // Load QQ Music home page; user clicks "登录" to show QR code.
    // Do not resolve/close on loadURL rejection: QQ's redirect chain can abort
    // intermediate loads, and closing here makes the login window flash away.
    loginWindow.loadURL(QQ_MUSIC_URL, { userAgent: DESKTOP_USER_AGENT }).catch(() => {});

    // Stop polling after 5 minutes (timeout)
    setTimeout(() => {
      clearInterval(pollInterval);
      finish(null);
    }, 300_000);
  });
}

module.exports = { loginQQMusic };
