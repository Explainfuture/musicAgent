/**
 * QQ Music login helper for Electron.
 * Opens a BrowserWindow to y.qq.com, lets the user scan QR code to log in,
 * then extracts cookies for use in API calls.
 */

const { BrowserWindow, session } = require("electron");

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
      parent: parentWindow,
      modal: false,
      title: "登录 QQ 音乐 — 请扫码",
      backgroundColor: "#fff5f7",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

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

    loginWindow.on("closed", () => {
      clearInterval(pollInterval);
      finish(null);
    });

    // Load QQ Music home page — user clicks "登录" to show QR code
    void loginWindow.loadURL("https://y.qq.com");

    // Stop polling after 5 minutes (timeout)
    setTimeout(() => {
      clearInterval(pollInterval);
      finish(null);
    }, 300_000);
  });
}

module.exports = { loginQQMusic };
