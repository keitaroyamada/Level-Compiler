// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");

const IPC_CHANNELS = {
  ASK_DIALOG: "askdialog",
  CONFIRM: "Confirm",
  REGISTER_MODEL_FROM_CSV: "RegisterModelFromCsv",
  REGISTER_AGE_FROM_CSV: "RegistertAgeFromCsv",
  REGISTER_LC_MODEL: "RegisterLCmodel",
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

function resolvePathInput(input) {
  if (typeof input === "string") {
    return input;
  }

  if (input == null) {
    return null;
  }

  return resolveFileInputPath(input);
}

function createModelRegistrationPayload(input) {
  const modelPath = resolvePathInput(input);
  return modelPath ? { modelPath } : null;
}

function createAgeRegistrationPayload(input) {
  const agePath = resolvePathInput(input);
  return agePath ? { agePath } : null;
}

function createLcModelRegistrationPayload(input) {
  const modelPath = resolvePathInput(input);
  return modelPath ? { modelPath } : null;
}

function createCoreImageRegistrationPayload(input) {
  if (!input) {
    return null;
  }

  const dirHandle = resolvePathInput(input.dirHandle);
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

contextBridge.exposeInMainWorld("LCapi", {

  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),
  CheckImagesInDir: (payload) => ipcRenderer.invoke("CheckImagesInDir", payload),
  FileChoseDialog: (payload) => ipcRenderer.invoke("FileChoseDialog", payload),
  FolderChoseDialog: (payload) => ipcRenderer.invoke("FolderChoseDialog", payload),


  //initialise
  InitialiseCorrelationModel: () => ipcRenderer.invoke("InitialiseCorrelationModel"),
  InitialiseAgeModel: () => ipcRenderer.invoke("InitialiseAgeModel"),
  InitialiseAgePlot: () => ipcRenderer.invoke("InitialisePlotAgeCollection"),
  InitialiseDataPlot: () => ipcRenderer.invoke("initialisePlotDataCollection"),
  InitialisePaths: () => ipcRenderer.invoke("InitialisePaths"),

  //register and load models
  RegisterModelFromCsv: (fileHandle) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_MODEL_FROM_CSV,
    createModelRegistrationPayload(fileHandle)
  ),
  RegisterModelFromPath: (modelPath) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_MODEL_FROM_CSV,
    createModelRegistrationPayload(modelPath)
  ),
  RegisterAgeFromCsv: (fileHandle) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_AGE_FROM_CSV,
    createAgeRegistrationPayload(fileHandle)
  ),
  RegisterAgeFromPath: (agePath) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_AGE_FROM_CSV,
    createAgeRegistrationPayload(agePath)
  ),
  RegisterLCmodel:(fileHandle) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_LC_MODEL,
    createLcModelRegistrationPayload(fileHandle)
  ),
  RegisterLCmodelFromPath: (modelPath) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_LC_MODEL,
    createLcModelRegistrationPayload(modelPath)
  ),
  LoadModelFromLCCore: () => ipcRenderer.invoke("LoadModelFromLCCore"),
  LoadAgeFromLCAge: (payload) => ipcRenderer.invoke("LoadAgeFromLCAge", payload),
  LoadPlotData: (payload) => ipcRenderer.invoke("LoadPlotData", payload),
  MirrorAgeList: () => ipcRenderer.invoke("MirrorAgeList"),
  Reregister: () => ipcRenderer.invoke("Reregister"),

  //export
  ExportCorrelationAsCsv: () => ipcRenderer.invoke("ExportCorrelationAsCsvFromRenderer"),
  ExportCorrelationAsLF: () => ipcRenderer.invoke("ExportCorrelationAsLFFromRenderer"),


  //calcs
  CalcCompositeDepth: () => ipcRenderer.invoke("CalcCompositeDepth"),
  CalcEventFreeDepth: () => ipcRenderer.invoke("CalcEventFreeDepth"),
  GetAgeFromEFD: (payload) => ipcRenderer.invoke("GetAgeFromEFD", payload),
  GetAgeFromCD: (payload) => ipcRenderer.invoke("GetAgeFromCD", payload),

  //tools
  OpenFinder: () => ipcRenderer.invoke("OpenFinder"),
  CloseFinder: () => ipcRenderer.invoke("CloseFinder"),
  depthConverter: (payload) =>  ipcRenderer.invoke("depthConverter", payload),
  SendDepthToFinder: (payload) => ipcRenderer.invoke("SendDepthToFinder", payload),
  OpenDivider: () => ipcRenderer.invoke("OpenDivider"),
  CloseDivider: () => ipcRenderer.invoke("CloseDivider"),
  floatingImageViewer: (payload) => ipcRenderer.invoke("floatingImageViewer", payload),
  

  //image
  RegisterCoreImage: (payload) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_CORE_IMAGE,
    createCoreImageRegistrationPayload(payload)
  ),
  RegisterCoreImageFromPath: (payload) => invokeWithPayload(
    IPC_CHANNELS.REGISTER_CORE_IMAGE,
    createCoreImageRegistrationPayload(payload)
  ),
  UnregisterCoreImageSource: (payload) => ipcRenderer.invoke("UnregisterCoreImageSource", payload),
  LoadCoreImage: (payload) => ipcRenderer.invoke("LoadCoreImage", payload),
  GetResources: () => ipcRenderer.sendSync("GetResources"),


  //others
  Confirm: (payload) => ipcRenderer.invoke(
    IPC_CHANNELS.CONFIRM,
    normaliseDialogPayload(payload)
  ),
  progressbar: (payload) => ipcRenderer.invoke("progressbar", payload),
  updateProgressbar: (payload) => ipcRenderer.invoke("updateProgressbar", payload),
  clearProgressbar: () => ipcRenderer.invoke("clearProgressbar"),
  askdialog: (payload) => ipcRenderer.invoke(
    IPC_CHANNELS.ASK_DIALOG,
    normaliseDialogPayload(payload)
  ),
  inputdialog: (payload) => ipcRenderer.invoke("inputdialog", payload),
  toggleDevTools: (target) => ipcRenderer.send("toggle-devtools", { target }),
  showContextMenu: (payload) => ipcRenderer.invoke("showContextMenu", payload),
  connectMarkers: (payload) => ipcRenderer.invoke("connectMarkers", payload),
  disconnectMarkers: (payload) => ipcRenderer.invoke("disconnectMarkers", payload),
  disconnectAllConnections: (payload) => ipcRenderer.invoke("disconnectAllConnections", payload),
  deleteMarker: (payload) => ipcRenderer.invoke("deleteMarker", payload),
  addMarker: (payload) => ipcRenderer.invoke("addMarker", payload),
  changeMarker: (payload) => ipcRenderer.invoke("changeMarker", payload),
  changeSection: (payload) => ipcRenderer.invoke("changeSection", payload),
  deleteSection: (payload) => ipcRenderer.invoke("deleteSection", payload),
  addSection: (payload) => ipcRenderer.invoke("addSection", payload),
  changeHole: (payload) => ipcRenderer.invoke("changeHole", payload),
  deleteHole: (payload) => ipcRenderer.invoke("deleteHole", payload),
  addHole: (payload) => ipcRenderer.invoke("addHole", payload),
  moveHoleToProject: (payload) => ipcRenderer.invoke("moveHoleToProject", payload),
  addProject: (payload) => ipcRenderer.invoke("addProject", payload),
  deleteProject: (payload) => ipcRenderer.invoke("deleteProject", payload),
  changeProject: (payload) => ipcRenderer.invoke("changeProject", payload),
  changeWorkspace: (payload) => ipcRenderer.invoke("changeWorkspace", payload),
  mergeProjects: () => ipcRenderer.invoke("mergeProjects"),
  RegisterAgeFromLCAge: () => ipcRenderer.invoke('RegisterAgeFromLCAge'),
  SetZeroPoint: (payload) => ipcRenderer.invoke("SetZeroPoint", payload),
  SetMaster: (payload) => ipcRenderer.invoke("SetMaster", payload),
  AddEvent: (payload) => ipcRenderer.invoke("AddEvent", payload),
  DeleteEvent: (payload) => ipcRenderer.invoke("DeleteEvent", payload),
  addSectionFromLcsection:(args1) => ipcRenderer.invoke("addSectionFromLcsection", webUtils.getPathForFile(args1)),
  changeEditMode:(mode) => ipcRenderer.invoke("changeEditMode", { mode }),
  sendSettings:(payload) => ipcRenderer.invoke("sendSettings", payload),
  getDisplayInfo:() => ipcRenderer.invoke("getDisplayInfo"),
  changeEnable:(payload) => ipcRenderer.invoke("changeEnable", payload),
  e2eSetCloseDialogResponse: (response) => ipcRenderer.invoke("e2eSetCloseDialogResponse", response),
  e2ePushDialogResponse: (response) => ipcRenderer.invoke("e2ePushDialogResponse", response),
  e2eGetAndClearDialogLog: () => ipcRenderer.invoke("e2eGetAndClearDialogLog"),
  e2eSetOpenDialogResponse: (payload) => ipcRenderer.invoke("e2eSetOpenDialogResponse", payload),
  e2eGetOpenDialogResponse: () => ipcRenderer.invoke("e2eGetOpenDialogResponse"),


  sendUndo: (payload) => ipcRenderer.invoke('sendUndo', payload),
  sendRedo: (payload) => ipcRenderer.invoke('sendRedo', payload),
  sendSaveState: (payload) => ipcRenderer.invoke("sendSaveState", payload),  
  getChangedSectionIds: (payload) => ipcRenderer.invoke("getChangedSectionIds", payload),
  
  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
