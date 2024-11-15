// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("LabelerApi", {
  //rederer <-> main
  //renderer name: (main name)
  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),

  InitiariseTempCore: () => ipcRenderer.invoke("InitiariseTempCore"),

  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),
  LoadRasterImage: (args1, args2) =>  ipcRenderer.invoke("LoadRasterImage", args1, args2),
  addSectionData: (args1,args2) => ipcRenderer.invoke("LabelerAddSectionData",args1,args2),
  addMarkerData: (args1,args2,args3) => ipcRenderer.invoke("LabelerAddMarkerData",args1,args2,args3),
  changeMarker: (args1,args2,args3) => ipcRenderer.invoke("LabelerChangeMarker", args1,args2,args3),
  deleteMarker: (args1) => ipcRenderer.invoke("LabelerDeleteMarker", args1),

  askdialog: (args1, args2) => ipcRenderer.invoke("askdialog", args1, args2),
  inputdialog: (args1) => ipcRenderer.invoke("inputdialog", args1),
  getResourcePath: () => ipcRenderer.sendSync("getResourcePath"),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),
  
  
  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
