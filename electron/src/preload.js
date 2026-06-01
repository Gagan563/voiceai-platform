const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("voiceaiSecureStore", {
  get: (key) => ipcRenderer.invoke("secure-store:get", key),
  set: (key, value) => ipcRenderer.invoke("secure-store:set", key, value),
});

contextBridge.exposeInMainWorld("voiceaiDesktop", {
  onNavigate: (callback) => {
    const handler = (event, route) => callback(route);
    ipcRenderer.on("desktop:navigate", handler);
    return () => ipcRenderer.removeListener("desktop:navigate", handler);
  },
});
