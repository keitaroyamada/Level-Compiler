// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("LCapi", {
  //rederer <-> main
  Test: (args1, args2) => ipcRenderer.invoke("test", args1, args2),
  //lcfnc: () => ipcRenderer.invoke("lcfnc"),

  //initiarise
  InitiariseCorrelationModel: () => ipcRenderer.invoke("InitiariseCorrelationModel"),
  InitiariseAgeModel: () => ipcRenderer.invoke("InitiariseAgeModel"),
  InitiarisePlot: () => ipcRenderer.invoke("InitiarisePlot"),

  //register and load models
  RegisterModelFromCsv: (args) => ipcRenderer.invoke("RegisterModelFromCsv", args),
  LoadModelFromLCCore: () => ipcRenderer.invoke("LoadModelFromLCCore"),
  RegisterAgeFromCsv: (args) => ipcRenderer.invoke("RegistertAgeFromCsv", args),
  LoadAgeFromLCAge: (args) => ipcRenderer.invoke("LoadAgeFromLCAge", args),
  RegisterPlotFromLCAge: () => ipcRenderer.invoke("RegisterPlotFromLCAge"),
  LoadPlotFromLCPlot: () => ipcRenderer.invoke("LoadPlotFromLCPlot"),

  //calcs
  CalcCompositeDepth: () => ipcRenderer.invoke("CalcCompositeDepth"),
  CalcEventFreeDepth: () => ipcRenderer.invoke("CalcEventFreeDepth"),
  GetAgeFromEFD: (args0, args1) => ipcRenderer.invoke("GetAgeFromEFD", args0, args1),
  GetAgeFromCD: (args0, args1) => ipcRenderer.invoke("GetAgeFromCD", args0, args1),

  //tools
  OpenFinder: () => ipcRenderer.invoke("OpenFinder"),
  CloseFinder: () => ipcRenderer.invoke("CloseFinder"),
  depthConvert: (args0, args1, args2, args3) =>  ipcRenderer.invoke("finderConvert", args0, args1, args2, args3),
  SendDepthToFinder: (args) => ipcRenderer.invoke("SendDepthToFinder", args),
  OpenDivider: () => ipcRenderer.invoke("OpenDivider"),
  CloseDivider: () => ipcRenderer.invoke("CloseDivider"),

  //others
  FileChoseDialog: (args1, args2) => ipcRenderer.invoke("FileChoseDialog", args1, args2),
  FolderChoseDialog: (args1) => ipcRenderer.invoke("FolderChoseDialog", args1),
  Confirm: (args1, args2) => ipcRenderer.invoke("Confirm", args1, args2),
  LoadRasterImage: (args1, args2) =>  ipcRenderer.invoke("LoadRasterImage", args1, args2),
  progressbar: (args1, args2) => ipcRenderer.invoke("progressbar", args1, args2),
  updateProgressbar: (args1, args2) => ipcRenderer.invoke("updateProgressbar", args1, args2),
  askdialog: (args1, args2) => ipcRenderer.invoke("askdialog", args1, args2),
  makeModelImage: (args1, args2, args3, args4) =>  ipcRenderer.invoke("makeModelImage", args1, args2, args3, args4),
  getResourcePath: () => ipcRenderer.sendSync("getResourcePath"),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
