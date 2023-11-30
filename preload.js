// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("LCapi", {
  //rederer <-> main
  Test: (args1, args2) => ipcRenderer.invoke("test", args1, args2),
  //lcfnc: () => ipcRenderer.invoke("lcfnc"),

  //initiarise
  InitiariseCorrelationModel: () =>
    ipcRenderer.invoke("InitiariseCorrelationModel"),
  InitiariseAgeModel: () => ipcRenderer.invoke("InitiariseAgeModel"),

  //register nad load models
  RegisterModelFromCsv: (args) =>
    ipcRenderer.invoke("RegisterModelFromCsv", args),
  LoadModelFromLCCore: (args) =>
    ipcRenderer.invoke("LoadModelFromLCCore", args),
  RegisterAgeFromCsv: (args) => ipcRenderer.invoke("RegistertAgeFromCsv", args),
  LoadAgeFromLCAge: (args) => ipcRenderer.invoke("LoadAgeFromLCAge", args),

  //calcs
  CalcCompositeDepth: () => ipcRenderer.invoke("CalcCompositeDepth"),
  CalcEventFreeDepth: (args) => ipcRenderer.invoke("CalcEventFreeDepth", args),

  GetAgeFromEFD: (args1, args2, args3) =>
    ipcRenderer.invoke("GetAgeFromEFD", args1, args2, args3),
  GetAgeFromCD: (args1, args2, args3) =>
    ipcRenderer.invoke("GetAgeFromCD", args1, args2, args3),

  FileChoseDialog: (args1, args2) =>
    ipcRenderer.invoke("FileChoseDialog", args1, args2),
  OpenFinder: () => ipcRenderer.invoke("OpenFinder"),
  CloseFinder: () => ipcRenderer.invoke("CloseFinder"),

  SendDepthToFinder: (args) => ipcRenderer.invoke("SendDepthToFinder", args),

  depthConvert: (args1, args2, args3) =>
    ipcRenderer.invoke("finderConvert", args1, args2, args3),

  Confirm: (args1, args2) => ipcRenderer.invoke("Confirm", args1, args2),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
