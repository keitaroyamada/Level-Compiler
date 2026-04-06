// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");
const IPC_CHANNELS = {
  ASK_DIALOG: "askdialog",
};

function normaliseDialogPayload(input) {
  const opts = input?.opts ?? input ?? {};
  return {
    opts: {
      title: opts.title ?? "",
      message: opts.message ?? "",
      parent: opts.parent ?? "main",
    },
  };
}

contextBridge.exposeInMainWorld("PlotterApi", {
  //rederer <-> main
  //renderer name: (main name)
  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),

  askdialog: (payload) => ipcRenderer.invoke(IPC_CHANNELS.ASK_DIALOG, normaliseDialogPayload(payload)),
  inputdialog: (args1) => ipcRenderer.invoke("inputdialog", args1),

  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),

  getPlotData: (payload) => ipcRenderer.invoke("PlotterGetData", payload),
  initialisePlotDataCollection: () => ipcRenderer.invoke("initialisePlotDataCollection"),
  sendPlotOptions: (payload) => ipcRenderer.invoke("sendPlotOptions", payload),
  clearProgressbar:() => ipcRenderer.invoke("clearProgressbar"),
  PlotterClose:() => ipcRenderer.invoke("PlotterClose"),
  ConverterClose:() => ipcRenderer.invoke("ConverterClose"),
  windowCloseButton:() => ipcRenderer.send("windowCloseButton"),
  
  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
