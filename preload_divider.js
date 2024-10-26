// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("DividerApi", {
  //rederer <-> main
  //renderer name: (main name)
  dividerGetCoreList: () => ipcRenderer.invoke("finderGetCoreList"),

  changeFix: (args) => ipcRenderer.invoke("changeFix", args),

  finderConvert: (args1, args2, args3) =>
    ipcRenderer.invoke("finderConvert", args1, args2, args3),

  getSectionLimit: (args1, args2) =>
    ipcRenderer.invoke("getSectionLimit", args1, args2),

  MoveToHorizon: (args1) => ipcRenderer.invoke("MoveToHorizon", args1),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),
  writeCsv: (args1) => ipcRenderer.send('dividerExport',args1),

  dividerDefinitionFromActural: (args1,args2) => ipcRenderer.sendSync("dividerDefinitionFromActural", args1,args2),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
