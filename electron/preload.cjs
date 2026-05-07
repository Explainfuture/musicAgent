const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("musicAgentShell", {
  platform: process.platform,
  isElectron: true,

  loginQQMusic: () => ipcRenderer.invoke("qqmusic:login"),
  getQQMusicCookieStatus: () => ipcRenderer.invoke("qqmusic:cookie-status"),
  getQQMusicPlayUrl: (songmid) => ipcRenderer.invoke("qqmusic:vkey", songmid),
});
