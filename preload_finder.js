// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("FinderApi", {
  //rederer <-> main
  finderGetCoreList: () => ipcRenderer.invoke("finderGetCoreList"),
  changeFix: (args) => ipcRenderer.invoke("changeFix", args),

  finderConvert: (args1, args2, args3, args4) => ipcRenderer.invoke("depthConverter", args1, args2, args3, args4),

  getSectionLimit: (args1, args2, args3) => ipcRenderer.invoke("getSectionLimit", args1, args2, args3),

  MoveToHorizon: (args1) => ipcRenderer.invoke("MoveToHorizon", args1),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),
  GetResources: () => ipcRenderer.sendSync("GetResources"),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
