// preload.js
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("LCapi", {

  getFilePath: (args) => ipcRenderer.invoke("getFilePath", webUtils.getPathForFile(args)),
  CheckImagesInDir: (args2) => ipcRenderer.invoke("CheckImagesInDir", args2),
  FileChoseDialog: (args1, args2) => ipcRenderer.invoke("FileChoseDialog", args1, args2),
  FolderChoseDialog: (args1) => ipcRenderer.invoke("FolderChoseDialog", args1),


  //initialise
  InitialiseCorrelationModel: () => ipcRenderer.invoke("InitialiseCorrelationModel"),
  InitialiseAgeModel: () => ipcRenderer.invoke("InitialiseAgeModel"),
  InitialiseAgePlot: () => ipcRenderer.invoke("InitialisePlotAgeCollection"),
  InitialiseDataPlot: () => ipcRenderer.invoke("InitialisePlotDataCollection"),
  InitialisePaths: () => ipcRenderer.invoke("InitialisePaths"),

  //register and load models
  RegisterModelFromCsv: (args) => ipcRenderer.invoke("RegisterModelFromCsv",  webUtils.getPathForFile(args)),
  RegisterAgeFromCsv: (args) => ipcRenderer.invoke("RegistertAgeFromCsv", webUtils.getPathForFile(args)),
  RegisterLCmodel:(args1) => ipcRenderer.invoke("RegisterLCmodel", webUtils.getPathForFile(args1)),
  LoadModelFromLCCore: () => ipcRenderer.invoke("LoadModelFromLCCore"),
  LoadAgeFromLCAge: (args) => ipcRenderer.invoke("LoadAgeFromLCAge", args),
  LoadPlotFromLCPlot: () => ipcRenderer.invoke("LoadPlotFromLCPlot"),
  MirrorAgeList: () => ipcRenderer.invoke("MirrorAgeList"),
  Reregister: () => ipcRenderer.invoke("Reregister"),

  //export
  ExportCorrelationAsCsv: (args) => ipcRenderer.invoke("ExportCorrelationAsCsvFromRenderer",args),
  ExportCorrelationAsLF: (args) => ipcRenderer.invoke("ExportCorrelationAsLFFromRenderer",args),


  //calcs
  CalcCompositeDepth: () => ipcRenderer.invoke("CalcCompositeDepth"),
  CalcEventFreeDepth: () => ipcRenderer.invoke("CalcEventFreeDepth"),
  GetAgeFromEFD: (args0, args1) => ipcRenderer.invoke("GetAgeFromEFD", args0, args1),
  GetAgeFromCD: (args0, args1) => ipcRenderer.invoke("GetAgeFromCD", args0, args1),

  //tools
  OpenFinder: () => ipcRenderer.invoke("OpenFinder"),
  CloseFinder: () => ipcRenderer.invoke("CloseFinder"),
  depthConverter: (args0, args1, args2) =>  ipcRenderer.invoke("depthConverter", args0, args1, args2),
  SendDepthToFinder: (args) => ipcRenderer.invoke("SendDepthToFinder", args),
  OpenDivider: () => ipcRenderer.invoke("OpenDivider"),
  CloseDivider: () => ipcRenderer.invoke("CloseDivider"),
  OpenImporter: () => ipcRenderer.invoke("OpenImporter"),
  CloseImporter: () => ipcRenderer.invoke("CloseImporter"),

  //image
  RegisterCoreImage: (args1,args2) =>  ipcRenderer.invoke("RegisterCoreImage", webUtils.getPathForFile(args1),args2),
  LoadCoreImage: (args1, args2) =>  ipcRenderer.invoke("LoadCoreImage", args1, args2),
  GetResources: () => ipcRenderer.sendSync("GetResources"),


  //others
  Confirm: (args1, args2) => ipcRenderer.invoke("Confirm", args1, args2),
  progressbar: (args1, args2) => ipcRenderer.invoke("progressbar", args1, args2),
  updateProgressbar: (args1, args2) => ipcRenderer.invoke("updateProgressbar", args1, args2),
  clearProgressbar: () => ipcRenderer.invoke("clearProgressbar"),
  askdialog: (args1, args2) => ipcRenderer.invoke("askdialog", args1, args2),
  inputdialog: (args1) => ipcRenderer.invoke("inputdialog", args1),
  toggleDevTools: (args1) => ipcRenderer.send('toggle-devtools',args1),
  showContextMenu: (args1) => ipcRenderer.invoke("showContextMenu", args1),
  connectMarkers: (args1,args2,args3) => ipcRenderer.invoke("connectMarkers", args1,args2,args3),
  disconnectMarkers: (args1,args2,args3) => ipcRenderer.invoke("disconnectMarkers", args1,args2,args3),
  deleteMarker: (args1) => ipcRenderer.invoke("deleteMarker", args1),
  addMarker: (args1,args2,args3,args4) => ipcRenderer.invoke("addMarker", args1,args2,args3,args4),
  changeMarker: (args1,args2,args3) => ipcRenderer.invoke("changeMarker", args1,args2,args3),
  changeSection: (args1,args2,args3) => ipcRenderer.invoke("changeSection", args1,args2,args3),
  deleteSection: (args1,args2) => ipcRenderer.invoke("deleteSection", args1,args2),
  addSection: (args1,args2) => ipcRenderer.invoke("addSection", args1,args2),
  changeHole: (args1,args2,args3) => ipcRenderer.invoke("changeHole", args1,args2,args3),
  deleteHole: (args1) => ipcRenderer.invoke("deleteHole", args1),
  addHole: (args1,args2) => ipcRenderer.invoke("addHole", args1,args2),
  addProject: (args1,args2) => ipcRenderer.invoke("addProject", args1,args2),
  deleteProject: (args1) => ipcRenderer.invoke("deleteProject", args1),
  changeProject: (args1,args2,args3) => ipcRenderer.invoke("changeProject", args1,args2,args3),
  mergeProjects: () => ipcRenderer.invoke("mergeProjects"),
  RegisterAgeFromLCAge: () => ipcRenderer.invoke('RegisterAgeFromLCAge'),
  SetZeroPoint: (args1,args2) => ipcRenderer.invoke("SetZeroPoint", args1,args2),
  SetMaster: (args1,args2) => ipcRenderer.invoke("SetMaster", args1,args2),
  AddEvent: (args1,args2,args3,args4) => ipcRenderer.invoke("AddEvent", args1,args2,args3,args4),
  DeleteEvent: (args1,args2,args3) => ipcRenderer.invoke("DeleteEvent", args1,args2,args3),
  addSectionFromLcsection:(args1) => ipcRenderer.invoke("addSectionFromLcsection", webUtils.getPathForFile(args1)),
  changeEditMode:(args1) => ipcRenderer.invoke("changeEditMode",args1),
  sendSettings:(args1,args2) => ipcRenderer.invoke("sendSettings",args1,args2),

  
  
  sendUndo: (args1) => ipcRenderer.invoke('sendUndo',args1),
  sendRedo: (args1) => ipcRenderer.invoke('sendRedo',args1),
  sendSaveState: (args1) => ipcRenderer.invoke('sendSaveState',args1),  
 
  //main -> renderer
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
});
