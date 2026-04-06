// preload.js
const { contextBridge, ipcRenderer } = require("electron");
const IPC_CHANNELS = {
  CONFIRM: "Confirm",
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

contextBridge.exposeInMainWorld("DividerApi", {
  //rederer <-> main
  //renderer name: (main name)
  dividerGetCoreList: () => ipcRenderer.invoke("finderGetCoreList"),

  changeFix: (payload) => ipcRenderer.invoke("changeFix", payload),

  depthConverter: (payload) => ipcRenderer.invoke("depthConverter", payload),

  getSectionLimit: (payload) => ipcRenderer.invoke("getSectionLimit", payload),

  MoveToHorizon: (payload) => ipcRenderer.invoke("MoveToHorizon", payload),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),
  writeCsv: (args1) => ipcRenderer.send('dividerExport',args1),

  inputdialog: (args1) => ipcRenderer.invoke("inputdialog", args1),

  dividerConverter: (payload) => ipcRenderer.invoke("dividerConverter", payload),

  dividerReflow: () => ipcRenderer.invoke("dividerReflow", ),

   Confirm: (payload) => ipcRenderer.invoke(IPC_CHANNELS.CONFIRM, normaliseDialogPayload(payload)),

  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
