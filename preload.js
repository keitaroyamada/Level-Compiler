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
  InitiarisePlot: () => ipcRenderer.invoke("InitiarisePlot"),

  //register and load models
  RegisterModelFromCsv: (args) =>
    ipcRenderer.invoke("RegisterModelFromCsv", args),
  LoadModelFromLCCore: () => ipcRenderer.invoke("LoadModelFromLCCore"),
  RegisterAgeFromCsv: (args) => ipcRenderer.invoke("RegistertAgeFromCsv", args),
  LoadAgeFromLCAge: (args) => ipcRenderer.invoke("LoadAgeFromLCAge", args),
  RegisterPlotFromLCAge: () => ipcRenderer.invoke("RegisterPlotFromLCAge"),
  LoadPlotFromLCPlot: () => ipcRenderer.invoke("LoadPlotFromLCPlot"),

  //calcs
  CalcCompositeDepth: () => ipcRenderer.invoke("CalcCompositeDepth"),
  CalcEventFreeDepth: () => ipcRenderer.invoke("CalcEventFreeDepth"),
  GetAgeFromEFD: (args0, args1) =>
    ipcRenderer.invoke("GetAgeFromEFD", args0, args1),
  GetAgeFromCD: (args0, args1) =>
    ipcRenderer.invoke("GetAgeFromCD", args0, args1),

  //tools
  OpenFinder: () => ipcRenderer.invoke("OpenFinder"),
  CloseFinder: () => ipcRenderer.invoke("CloseFinder"),
  depthConvert: (args0, args1, args2, args3) =>
    ipcRenderer.invoke("finderConvert", args0, args1, args2, args3),
  SendDepthToFinder: (args) => ipcRenderer.invoke("SendDepthToFinder", args),
  OpenDivider: () => ipcRenderer.invoke("OpenDivider"),
  CloseDivider: () => ipcRenderer.invoke("CloseDivider"),

  //others
  FileChoseDialog: (args1, args2) =>
    ipcRenderer.invoke("FileChoseDialog", args1, args2),
  Confirm: (args1, args2) => ipcRenderer.invoke("Confirm", args1, args2),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
