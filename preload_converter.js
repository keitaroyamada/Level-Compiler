// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ConverterApi", {
  //rederer <-> main
  cvtGetAgeModelList: () => ipcRenderer.invoke("cvtGetAgeModelList"),
  cvtGetCorrelationModelList: () => ipcRenderer.invoke("cvtGetCorrelationModelList"),
  cvtLoadCsv: (args1, args2, args3) => ipcRenderer.invoke("cvtLoadCsv", args1, args2, args3),
  cvtConvert: (args1, args2, args3, args4) => ipcRenderer.invoke("cvtConvert", args1, args2, args3, args4),
  depthConverter: (args1, args2, args3) => ipcRenderer.invoke("depthConverter", args1, args2, args3),
  cvtExport: (args1) => ipcRenderer.invoke("cvtExport", args1),
  dataImport: (args1) => ipcRenderer.invoke("dataImport", args1),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),
  sendImportedData: (args1) => ipcRenderer.invoke('sendImportedData',args1),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
