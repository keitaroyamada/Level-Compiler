// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ConverterApi", {
  //rederer <-> main
  cvtGetAgeModelList: () => ipcRenderer.invoke("cvtGetAgeModelList"),
  cvtGetCorrelationModelList: () =>
    ipcRenderer.invoke("cvtGetCorrelationModelList"),
  cvtLoadCsv: (args1, args2) => ipcRenderer.invoke("cvtLoadCsv", args1, args2),
  cvtConvert: (args1, args2, args3, args4) =>
    ipcRenderer.invoke("cvtConvert", args1, args2, args3, args4),
  cvtExport: (args1) => ipcRenderer.invoke("cvtExport", args1),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
