// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("FinderApi", {
  //rederer <-> main
  finderGetCoreList: () => ipcRenderer.invoke("finderGetCoreList"),
  changeFix: (args) => ipcRenderer.invoke("changeFix", args),

  finderConvert: (args1, args2, args3, args4) =>
    ipcRenderer.invoke("finderConvert", args1, args2, args3, args4),

  getSectionLimit: (args1, args2, args3) =>
    ipcRenderer.invoke("getSectionLimit", args1, args2, args3),

  MoveToHorizon: (args1) => ipcRenderer.invoke("MoveToHorizon", args1),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
