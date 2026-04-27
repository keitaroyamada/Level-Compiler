// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");
const IPC_CHANNELS = {
  ASK_DIALOG: "askdialog",
  REGISTER_CORE_IMAGE: "RegisterCoreImage",
};

function resolveFileInputPath(input) {
  return webUtils.getPathForFile(input);
}

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

function createCoreImageRegistrationPayload(input) {
  if (!input) {
    return null;
  }

  const dirHandle =
    typeof input.dirHandle === "string"
      ? input.dirHandle
      : resolveFileInputPath(input.dirHandle);
  if (!dirHandle || !input.type) {
    return null;
  }

  return {
    dirHandle,
    type: input.type,
    sourceId: input.sourceId ?? null,
    label: input.label ?? null,
  };
}

function invokeWithPayload(channel, payload) {
  if (payload == null) {
    return Promise.resolve(null);
  }
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("ViewerApi", {
  //rederer <-> main
  //renderer name: (main name)
  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),

  InitialiseTempCore: () => ipcRenderer.invoke("InitialiseTempCore"),

  terminalLog: (args1) => ipcRenderer.invoke("terminalLog", args1),
  rendererLog: (args1) => ipcRenderer.invoke("rendererLog", args1),

  RegisterCoreImage: (payload) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_CORE_IMAGE,
    createCoreImageRegistrationPayload(payload)
  ),
  LoadCoreImage: (payload) => ipcRenderer.invoke("LoadCoreImage", payload),
  CheckImagesInDir: (payload) => ipcRenderer.invoke("CheckImagesInDir", payload),
  isExistFile: (payload) => ipcRenderer.invoke("isExistFile", payload),
  LoadSectionModel: (payload) => ipcRenderer.invoke("LabelerLoadSectionModel", payload),

  askdialog: (payload) => ipcRenderer.invoke(IPC_CHANNELS.ASK_DIALOG, normaliseDialogPayload(payload)),
  inputdialog: (payload) => ipcRenderer.invoke("inputdialog", payload),
  GetResources: () => ipcRenderer.sendSync("GetResources"),
  toggleDevTools: (target) => ipcRenderer.send("toggle-devtools", { target }),
  saveLabelerData: (args1) => ipcRenderer.invoke("LabelerSaveData", args1),


  showContextMenu: (payload) => ipcRenderer.invoke("showContextMenu", payload),
  
  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
