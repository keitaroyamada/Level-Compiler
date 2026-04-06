// preload.js
const { contextBridge, ipcRenderer } = require("electron");
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

contextBridge.exposeInMainWorld("FinderApi", {
  //rederer <-> main
  finderGetCoreList: () => ipcRenderer.invoke("finderGetCoreList"),
  changeFix: (payload) => ipcRenderer.invoke("changeFix", payload),

  depthConverter: (payload) => ipcRenderer.invoke("depthConverter", payload),

  getSectionLimit: (payload) => ipcRenderer.invoke("getSectionLimit", payload),

  MoveToHorizon: (payload) => ipcRenderer.invoke("MoveToHorizon", payload),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),
  GetResources: () => ipcRenderer.sendSync("GetResources"),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),

  inputdialog: (args1) => ipcRenderer.invoke("inputdialog", args1),
  askdialog: (payload) => ipcRenderer.invoke(IPC_CHANNELS.ASK_DIALOG, normaliseDialogPayload(payload)),
  saveBookmarks: (payload) => ipcRenderer.invoke("saveBookmarks", payload),

  requestCurrentPosition: () => ipcRenderer.invoke("requestCurrentPosition"),
  

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
