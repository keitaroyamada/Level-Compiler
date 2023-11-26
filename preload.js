// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("LCapi", {
  //rederer <-> main
  Test: (args1, args2) => ipcRenderer.invoke("test", args1, args2),
  //lcfnc: () => ipcRenderer.invoke("lcfnc"),

  InitiariseCorrelationModel: () =>
    ipcRenderer.invoke("InitiariseCorrelationModel"),
  InitiariseAgeModel: () => ipcRenderer.invoke("InitiariseAgeModel"),

  MountModelFromCsv: (args) => ipcRenderer.invoke("MountModelFromCsv", args),
  LoadModelFromLCCore: (args) =>
    ipcRenderer.invoke("LoadModelFromLCCore", args),

  CalcCompositeDepth: () => ipcRenderer.invoke("CalcCompositeDepth"),
  CalcEventFreeDepth: (args) => ipcRenderer.invoke("CalcEventFreeDepth", args),

  MountAgeFromCsv: (args) => ipcRenderer.invoke("MountAgeFromCsv", args),
  LoadAgeFromLCAge: (args) => ipcRenderer.invoke("LoadAgeFromLCAge", args),

  GetAgeFromEFD: (args1, args2, args3) =>
    ipcRenderer.invoke("GetAgeFromEFD", args1, args2, args3),
  GetAgeFromCD: (args1, args2, args3) =>
    ipcRenderer.invoke("GetAgeFromCD", args1, args2, args3),

  FileChoseDialog: (args1, args2) =>
    ipcRenderer.invoke("FileChoseDialog", args1, args2),
  OpenFinder: (args) => ipcRenderer.invoke("OpenFinder", args),

  Confirm: (args1, args2) => ipcRenderer.invoke("Confirm", args1, args2),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
