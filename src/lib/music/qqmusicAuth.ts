/**
 * QQ Music cookie-based auth management.
 *
 * How to get your QQ Music cookie:
 * 1. Open https://y.qq.com in Chrome/Edge
 * 2. Log in with your QQ/WeChat account (VIP member)
 * 3. Open DevTools (F12) → Application → Cookies → y.qq.com
 * 4. Copy the full cookie string (all name=value pairs joined with "; ")
 * 5. Set it as QQMUSIC_COOKIE in .env.local, or write it to .qqmusic-cookie
 *
 * In Electron, the app can open a login window and extract cookies automatically.
 * See electron/qqmusicLogin.cjs for the Electron-side helper.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const COOKIE_FILE = ".qqmusic-cookie";

function getProjectRoot(): string {
  // In Next.js API routes, process.cwd() is the project root
  return process.cwd();
}

function loadCookieFromFile(): string | null {
  try {
    const filePath = join(getProjectRoot(), COOKIE_FILE);
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, "utf-8").trim();
    if (!content) return null;

    const parsed = JSON.parse(content) as { cookie: string; savedAt: string };
    return parsed.cookie || null;
  } catch {
    return null;
  }
}

function saveCookieToFile(cookie: string): void {
  const filePath = join(getProjectRoot(), COOKIE_FILE);
  writeFileSync(
    filePath,
    JSON.stringify({ cookie, savedAt: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

export function getQQMusicCookie(): string {
  // Priority: env var > local cookie file
  const envCookie = process.env.QQMUSIC_COOKIE;
  if (envCookie && envCookie.trim()) {
    return envCookie.trim();
  }
  return loadCookieFromFile() || "";
}

export function setQQMusicCookie(cookie: string): void {
  saveCookieToFile(cookie.trim());
}

export function hasQQMusicCookie(): boolean {
  return getQQMusicCookie().length > 0;
}

// Validate the cookie by making a test request
export async function validateQQMusicCookie(
  cookie: string,
): Promise<{ valid: boolean; nickname?: string }> {
  if (!cookie.trim()) {
    return { valid: false };
  }

  try {
    const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://y.qq.com",
        Cookie: cookie.trim(),
      },
      body: JSON.stringify({
        comm: { uin: 0, format: "json", ct: 24, cv: 0 },
        req_0: {
          module: "music.vkey.GetVkeyServer",
          method: "CgiGetVkey",
          param: {
            guid: String(Math.floor(Math.random() * 1000000000)),
            songmid: ["001J5QJL1pRQYB"],
            songtype: [0],
            uin: "0",
            loginflag: 1,
            platform: "20",
          },
        },
      }),
    });

    if (!response.ok) return { valid: false };

    const data = await response.json();
    const vkeyData = (data as Record<string, unknown>)?.req_0 as
      | { code: number }
      | undefined;

    // code 0 means the cookie works
    return { valid: vkeyData?.code === 0 };
  } catch {
    return { valid: false };
  }
}
