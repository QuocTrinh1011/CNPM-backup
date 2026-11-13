const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopConfig', Object.freeze({
  load: () => ipcRenderer.invoke('desktop-config:load'),
  saveApiBaseUrl: apiBaseUrl => ipcRenderer.invoke('desktop-config:save-api-base-url', apiBaseUrl),
}));
