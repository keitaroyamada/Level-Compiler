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

contextBridge.exposeInMainWorld("SettingsApi", {
  //rederer <-> main
  //renderer name: (main name)
  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),
  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),

  askdialog: (payload) => ipcRenderer.invoke(IPC_CHANNELS.ASK_DIALOG, normaliseDialogPayload(payload)),
  inputdialog: (payload) => ipcRenderer.invoke("inputdialog", payload),

  toggleDevTools: (target) => ipcRenderer.send("toggle-devtools", { target }),

  sendSettings:(payload) => ipcRenderer.invoke("sendSettings", payload),
  openSettingsFolder: () => ipcRenderer.invoke("openSettingsFolder"),
  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
