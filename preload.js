// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("LCapi", {
  Test: (args1, args2) => ipcRenderer.invoke("test", args1, args2),
  lcfnc: () => ipcRenderer.invoke("lcfnc"),
  Initiarise: () => ipcRenderer.invoke("Initiarise"),
  LoadModelFromCsv: (args) => ipcRenderer.invoke("LoadModelFromCsv", args),
  LoadEventFromCsv: (args) => ipcRenderer.invoke("LoadEventFromCsv", args),
  CalcCompositeDepth: () => ipcRenderer.invoke("CalcCompositeDepth"),
  CalcEventFreeDepth: (args) => ipcRenderer.invoke("CalcEventFreeDepth", args),
  OpenFinder: (args) => ipcRenderer.invoke("OpenFinder", args),
});
