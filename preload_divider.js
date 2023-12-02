// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("DividerApi", {
  //rederer <-> main
  changeFix: (args) => ipcRenderer.invoke("changeFix", args),

  dividerGetCoreList: () => ipcRenderer.invoke("dividerGetCoreList"),

  finderConvert: (args1, args2, args3) =>
    ipcRenderer.invoke("finderConvert", args1, args2, args3),

  getSectionLimit: (args1, args2) =>
    ipcRenderer.invoke("getSectionLimit", args1, args2),

  MoveToHorizon: (args1) => ipcRenderer.invoke("MoveToHorizon", args1),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
