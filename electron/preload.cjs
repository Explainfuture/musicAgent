const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("musicAgentShell", {
  platform: process.platform,
  isElectron: true,

  // QQ Music login
  loginQQMusic: () => ipcRenderer.invoke("qqmusic:login"),
  getQQMusicCookieStatus: () => ipcRenderer.invoke("qqmusic:cookie-status"),
});
