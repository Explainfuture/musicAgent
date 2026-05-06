const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("musicAgentShell", {
  platform: process.platform,
  isElectron: true,
});
