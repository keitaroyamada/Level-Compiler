// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("ConverterApi", {

  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),
  //rederer <-> main
  cvtGetAgeModelList: () => ipcRenderer.invoke("cvtGetAgeModelList"),
  cvtGetCorrelationModelList: () => ipcRenderer.invoke("cvtGetCorrelationModelList"),
  cvtLoadCsv: (payload) => ipcRenderer.invoke("cvtLoadCsv", payload),
  depthConverter: (payload) => ipcRenderer.invoke("depthConverter", payload),
  cvtConverter: (payload) => ipcRenderer.invoke("cvtConverter", payload),
  cvtExport: (args1) => ipcRenderer.invoke("cvtExport", args1),
  dataImport: (args1) => ipcRenderer.invoke("dataImport", args1),
  toggleDevTools: (target) => ipcRenderer.send("toggle-devtools", { target }),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),

  progressbar: (payload) => ipcRenderer.invoke("progressbar", payload),
  updateProgressbar: (payload) => ipcRenderer.invoke("updateProgressbar", payload),
  clearProgressbar: () => ipcRenderer.invoke("clearProgressbar"),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
