// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("LabelerApi", {
  //rederer <-> main
  //renderer name: (main name)
  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),

  InitialiseTempCore: () => ipcRenderer.invoke("InitialiseTempCore"),

  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),

  RegisterCoreImage: (args1,args2) =>  ipcRenderer.invoke("RegisterCoreImage", webUtils.getPathForFile(args1),args2),
  LoadCoreImage: (args1,args2) =>  ipcRenderer.invoke("LoadCoreImage", args1,args2),
  CheckImagesInDir: (args2) => ipcRenderer.invoke("CheckImagesInDir", args2),
  isExistFile: (args1, args2) => ipcRenderer.invoke("isExistFile", webUtils.getPathForFile(args1), args2),
  LoadSectionModel: (args1, args2) => ipcRenderer.invoke("LabelerLoadSectionModel", webUtils.getPathForFile(args1), args2),


  addSectionData: (args1,args2) => ipcRenderer.invoke("LabelerAddSectionData",args1,args2),
  addMarkerData: (args1,args2,args3) => ipcRenderer.invoke("LabelerAddMarkerData",args1,args2,args3),
  changeMarker: (args1,args2,args3) => ipcRenderer.invoke("LabelerChangeMarker", args1,args2,args3),
  deleteMarker: (args1) => ipcRenderer.invoke("LabelerDeleteMarker", args1),

  askdialog: (args1, args2) => ipcRenderer.invoke("askdialog", args1, args2),
  inputdialog: (args1) => ipcRenderer.invoke("inputdialog", args1),
  GetResources: () => ipcRenderer.sendSync("GetResources"),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),
  saveLabelerData: (args1) => ipcRenderer.invoke("LabelerSaveData", args1),

  sendUndo: (args1) => ipcRenderer.invoke('sendUndo',args1),
  sendRedo: (args1) => ipcRenderer.invoke('sendRedo',args1),
  sendSaveState: (args1) => ipcRenderer.invoke('sendSaveState',args1),  
  loadModel: () => ipcRenderer.invoke("LabelerLoadModel"),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
