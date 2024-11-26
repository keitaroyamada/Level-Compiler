// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("PlotterApi", {
  //rederer <-> main
  //renderer name: (main name)
  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),

  askdialog: (args1, args2) => ipcRenderer.invoke("askdialog", args1, args2),
  inputdialog: (args1) => ipcRenderer.invoke("inputdialog", args1),

  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),

  getPlotData: (args1) => ipcRenderer.invoke("PlotterGetData", args1),
  initiariseLCPlot_data_collection: () => ipcRenderer.invoke("InitiarisePlotDataCollection"),
  sendPlotOptions:(args1,args2) => ipcRenderer.invoke("sendPlotOptions",args1,args2),

  
  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
