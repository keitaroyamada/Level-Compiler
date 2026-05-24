//    "electron": "^27.0.3",
//npm start
//npx electronmon .
//npm cache verify --force
//build: https://program-life.com/2041
//installer: npx electron-builder --mac --x64
//portable: npx electron-builder --mac --x64 --dir
//installer: npx electron-builder --win --x64
//portable: npx electron-builder --win --x64 --dir
//npm run build:win
//npm version prerelease --preid=beta
//npm version prerelease --preid=alpha
//npm version patch  ：1.0.0 → 1.0.1
//npm version minor  ：1.0.0 → 1.1.0
//npm version major  ：1.0.0 → 2.0.0

const path = require("path");
const fs = require("fs");
const os = require("os");
const sharp = require("sharp");
//const { mode } = require("simple-statistics");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const ProgressBar = require("electron-progressbar");
const prompt = require("electron-prompt");
const JSZip = require('jszip');
const zlib = require('zlib');
const { PassThrough } = require('stream');
const https = require('https');
const { autoUpdater} = require('electron-updater');

const { app, BrowserWindow, Menu, ipcMain, dialog, shell, screen, session, protocol } = require("electron");
const { LevelCompilerCore } = require("./LC_modules/LevelCompilerCore.js");
const { Project } = require("./LC_modules/Project.js");
const lcfnc  = require("./LC_modules/lcfnc.js");
const { LevelCompilerAge } = require("./LC_modules/LevelCompilerAge.js");
const { LevelCompilerPlot } = require("./LC_modules/LevelCompilerPlot.js");
const { UndoManager } = require("./LC_modules/UndoManager.js");
const { Trinity } = require("./LC_modules/Trinity.js");
const { Section } = require("./LC_modules/Section.js");
const { Marker } = require("./LC_modules/Marker.js");
const {
  WINDOW_TYPES,
  clearWindow,
  createWindow,
  getAllWindows,
  getWindow,
  hasWindow,
  setWindow,
} = require("./main/windows.js");
const { send, availableMemory, contextIsolated } = require("process");
const { Worker } = require('worker_threads');
const { isString } = require("util");
const { resolve } = require("dns");
const { rejects } = require("assert");
const { resolveObjectURL } = require("buffer");
const { encode, decode } = require("@msgpack/msgpack");


//mode properties
const isMac = process.platform === "darwin";
const isDev = false;//process.env.NODE_ENV !== "development"; //const isDev = false;
let isEditMode = false;
const isShowMinorError = false;
let isPlotterClose = true; //because plotter is hide by close button

//main properties
let LCCore = new LevelCompilerCore();
let LCAge  = new LevelCompilerAge();;
let LCPlot = new LevelCompilerPlot();
const history = new UndoManager();
history.setInitialState(LCCore.exportSerialisedModel());
let labelerHistory = null;
let tempCore = null; //for labeler
let viewerCore = null; //for floating viewer
let globalPath = {
  saveModelPath:null,
  dataPaths:[], //{type:[lcmodel, csvmodel, csvage, csvplot], path:""}
};
let mainSettings = {isAutoUpdateDownload: true};
let globalTempData = null;
let sendBuffer = null;
let e2eCloseDialogResponse = null;
let e2eDialogResponses = [];
let e2eDialogLog = [];
let e2eOpenDialogResponse = {
  file: null,
  folder: null,
};
let isMainWindowClosing = false;
let suppressCoreAlertRenderer = false;

function withSuppressedCoreAlertRenderer(action) {
  const previousValue = suppressCoreAlertRenderer;
  suppressCoreAlertRenderer = true;
  try {
    return action();
  } finally {
    suppressCoreAlertRenderer = previousValue;
  }
}

function closeProgress(progress) {
  if (!progress) {
    return null;
  }
  try {
    if (typeof progress.isCompleted === "function" && !progress.isCompleted()) {
      progress.setCompleted();
    }
  } catch (_) {}
  try {
    if (typeof progress.close === "function") {
      progress.close();
    }
  } catch (_) {}
  return null;
}

function closeGlobalProgressBar() {
  progressBar = closeProgress(progressBar);
  return true;
}

function getRendererDeveloperMode() {
  const rendererSettings = getSettings("settingsRenderer");
  return rendererSettings?.developer?.mode ?? "user";
}

function isRootDeveloperMode() {
  return getRendererDeveloperMode() === "root";
}

function resetTransientAppState() {
  globalTempData = null;
  sendBuffer = null;
  tempCore = null;
  viewerCore = null;
  labelerHistory = null;
}

function recordE2EDialog(options) {
  if (process.env.LC_E2E !== "1") {
    return;
  }
  e2eDialogLog.push({
    title: options?.title ?? null,
    message: options?.message ?? null,
    buttons: Array.isArray(options?.buttons) ? [...options.buttons] : [],
  });
}

async function showMessageBoxWithE2E(window, options) {
  recordE2EDialog(options);

  if (process.env.LC_E2E === "1" && e2eDialogResponses.length > 0) {
    return { response: e2eDialogResponses.shift() };
  }

  return dialog.showMessageBox(window, options);
}

//windows
let mainWindow = null;
let finderWindow = null;
let dividerWindow = null;
let converterWindow = null;
let labelerWindow = null;
let settingsWindow = null;
let imageViewerWindow = null;
let plotWindow = null;
let progressBar = null;

// Stage 2 of the main-process refactor introduces a shared window store.
// Existing local variables remain in place temporarily, and later steps
// will switch callers over incrementally.
void WINDOW_TYPES;
void getAllWindows;
function syncLegacyWindowRef(type, windowRef) {
  switch (type) {
    case WINDOW_TYPES.MAIN:
      mainWindow = windowRef;
      break;
    case WINDOW_TYPES.FINDER:
      finderWindow = windowRef;
      break;
    case WINDOW_TYPES.DIVIDER:
      dividerWindow = windowRef;
      break;
    case WINDOW_TYPES.CONVERTER:
      converterWindow = windowRef;
      break;
    case WINDOW_TYPES.LABELER:
      labelerWindow = windowRef;
      break;
    case WINDOW_TYPES.SETTINGS:
      settingsWindow = windowRef;
      break;
    case WINDOW_TYPES.IMAGE_VIEWER:
      imageViewerWindow = windowRef;
      break;
    case WINDOW_TYPES.PLOTTER:
      plotWindow = windowRef;
      break;
    default:
      break;
  }
}

function getManagedWindow(type) {
  return getWindow(type);
}

function setManagedWindow(type, windowRef) {
  const storedWindow = setWindow(type, windowRef);
  syncLegacyWindowRef(type, storedWindow);
  return storedWindow;
}

function clearManagedWindow(type) {
  syncLegacyWindowRef(type, null);
  clearWindow(type);
}

function hasManagedWindow(type) {
  return hasWindow(type);
}

function sendToManagedWindow(type, channel, payload = null) {
  const currentWindow = getManagedWindow(type);
  if (!currentWindow || currentWindow.isDestroyed()) {
    return false;
  }

  const { webContents } = currentWindow;
  if (!webContents || webContents.isDestroyed()) {
    return false;
  }

  webContents.send(channel, payload);
  return true;
}

function getMainWindow() {
  return getManagedWindow(WINDOW_TYPES.MAIN);
}

function setMainWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.MAIN, windowRef);
}

function clearMainWindow() {
  clearManagedWindow(WINDOW_TYPES.MAIN);
}

function hasMainWindow() {
  return hasManagedWindow(WINDOW_TYPES.MAIN);
}

function getFinderWindow() {
  return getManagedWindow(WINDOW_TYPES.FINDER);
}

function setFinderWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.FINDER, windowRef);
}

function clearFinderWindow() {
  clearManagedWindow(WINDOW_TYPES.FINDER);
}

function hasFinderWindow() {
  return hasManagedWindow(WINDOW_TYPES.FINDER);
}

function getDividerWindow() {
  return getManagedWindow(WINDOW_TYPES.DIVIDER);
}

function setDividerWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.DIVIDER, windowRef);
}

function clearDividerWindow() {
  clearManagedWindow(WINDOW_TYPES.DIVIDER);
}

function hasDividerWindow() {
  return hasManagedWindow(WINDOW_TYPES.DIVIDER);
}

function getConverterWindow() {
  return getManagedWindow(WINDOW_TYPES.CONVERTER);
}

function setConverterWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.CONVERTER, windowRef);
}

function clearConverterWindow() {
  clearManagedWindow(WINDOW_TYPES.CONVERTER);
}

function hasConverterWindow() {
  return hasManagedWindow(WINDOW_TYPES.CONVERTER);
}

function getLabelerWindow() {
  return getManagedWindow(WINDOW_TYPES.LABELER);
}

function setLabelerWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.LABELER, windowRef);
}

function clearLabelerWindow() {
  clearManagedWindow(WINDOW_TYPES.LABELER);
}

function hasLabelerWindow() {
  return hasManagedWindow(WINDOW_TYPES.LABELER);
}

function getSettingsWindow() {
  return getManagedWindow(WINDOW_TYPES.SETTINGS);
}

function setSettingsWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.SETTINGS, windowRef);
}

function clearSettingsWindow() {
  clearManagedWindow(WINDOW_TYPES.SETTINGS);
}

function hasSettingsWindow() {
  return hasManagedWindow(WINDOW_TYPES.SETTINGS);
}

function getImageViewerWindow() {
  return getManagedWindow(WINDOW_TYPES.IMAGE_VIEWER);
}

function setImageViewerWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.IMAGE_VIEWER, windowRef);
}

function clearImageViewerWindow() {
  clearManagedWindow(WINDOW_TYPES.IMAGE_VIEWER);
}

function hasImageViewerWindow() {
  return hasManagedWindow(WINDOW_TYPES.IMAGE_VIEWER);
}

function getPlotterWindow() {
  return getManagedWindow(WINDOW_TYPES.PLOTTER);
}

function setPlotterWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.PLOTTER, windowRef);
}

function clearPlotterWindow() {
  clearManagedWindow(WINDOW_TYPES.PLOTTER);
}

function hasPlotterWindow() {
  return hasManagedWindow(WINDOW_TYPES.PLOTTER);
}

function getAboutWindow() {
  return getManagedWindow(WINDOW_TYPES.ABOUT);
}

function setAboutWindow(windowRef) {
  return setManagedWindow(WINDOW_TYPES.ABOUT, windowRef);
}

function clearAboutWindow() {
  clearManagedWindow(WINDOW_TYPES.ABOUT);
}

function hasAboutWindow() {
  return hasManagedWindow(WINDOW_TYPES.ABOUT);
}

function closeConverterWindow() {
  if (!hasConverterWindow()) {
    return false;
  }

  const currentConverterWindow = getConverterWindow();
  currentConverterWindow.removeAllListeners("close");
  currentConverterWindow.close();
  clearConverterWindow();
  return true;
}

function closePlotterWindow() {
  if (!hasPlotterWindow()) {
    return false;
  }

  const currentPlotterWindow = getPlotterWindow();
  currentPlotterWindow.removeAllListeners("close");
  currentPlotterWindow.close();
  clearPlotterWindow();
  return true;
}

function closeDividerWindow() {
  if (!hasDividerWindow()) {
    return false;
  }

  const currentDividerWindow = getDividerWindow();
  currentDividerWindow.removeAllListeners("close");
  currentDividerWindow.close();
  clearDividerWindow();
  return true;
}

function closeFinderWindow() {
  if (!hasFinderWindow()) {
    return false;
  }

  const currentFinderWindow = getFinderWindow();
  currentFinderWindow.removeAllListeners("close");
  currentFinderWindow.close();
  clearFinderWindow();
  return true;
}

function openSettingsWindow({
  browserWindowOptions = {},
  onExisting = null,
  onReadyToShow = null,
} = {}) {
  if (hasSettingsWindow()) {
    const settingsWindow = getSettingsWindow();
    settingsWindow.focus();
    if (typeof onExisting === "function") {
      onExisting(settingsWindow);
    }
    return settingsWindow;
  }

  const settingsWindow = setSettingsWindow(createWindow(WINDOW_TYPES.SETTINGS, {
    browserWindowOptions,
  }));

  settingsWindow.on("closed", () => {
    clearSettingsWindow();
    sendToMainWindow("SettingsClosed", "");
  });
  settingsWindow.once("ready-to-show", () => {
    settingsWindow.show();
    settingsWindow.setAlwaysOnTop(true, "floating");
    if (typeof onReadyToShow === "function") {
      onReadyToShow(settingsWindow);
    }
  });

  return settingsWindow;
}

function openConverterWindow({
  browserWindowOptions = {},
  onExisting = null,
  onReadyToShow = null,
  onDidFinishLoad = null,
} = {}) {
  if (hasConverterWindow()) {
    const converterWindow = getConverterWindow();
    converterWindow.focus();
    if (typeof onExisting === "function") {
      onExisting(converterWindow);
    }
    return converterWindow;
  }

  const converterWindow = setConverterWindow(createWindow(WINDOW_TYPES.CONVERTER, {
    browserWindowOptions,
  }));

  converterWindow.on("closed", () => {
    clearConverterWindow();
    sendToMainWindow("ConverterClosed", "");
  });
  converterWindow.once("ready-to-show", () => {
    converterWindow.show();
    if (typeof onReadyToShow === "function") {
      onReadyToShow(converterWindow);
    }
  });
  converterWindow.webContents.once("did-finish-load", () => {
    if (typeof onDidFinishLoad === "function") {
      onDidFinishLoad(converterWindow);
    }
  });

  return converterWindow;
}

function sendToMainWindow(channel, payload = null) {
  return sendToManagedWindow(WINDOW_TYPES.MAIN, channel, payload);
}

function sendToFinderWindow(channel, payload = null) {
  return sendToManagedWindow(WINDOW_TYPES.FINDER, channel, payload);
}

function sendToConverterWindow(channel, payload = null) {
  return sendToManagedWindow(WINDOW_TYPES.CONVERTER, channel, payload);
}

function sendToSettingsWindow(channel, payload = null) {
  return sendToManagedWindow(WINDOW_TYPES.SETTINGS, channel, payload);
}

function sendToImageViewerWindow(channel, payload = null) {
  return sendToManagedWindow(WINDOW_TYPES.IMAGE_VIEWER, channel, payload);
}

function sendToLabelerWindow(channel, payload = null) {
  return sendToManagedWindow(WINDOW_TYPES.LABELER, channel, payload);
}

function sendToPlotterWindow(channel, payload = null) {
  return sendToManagedWindow(WINDOW_TYPES.PLOTTER, channel, payload);
}

function closeChildWindows() {
  if (hasFinderWindow()) {
    getFinderWindow().close();
  }
  if (hasDividerWindow()) {
    getDividerWindow().close();
  }
  if (hasConverterWindow()) {
    getConverterWindow().close();
  }
  if (hasLabelerWindow()) {
    getLabelerWindow().close();
  }
  if (hasImageViewerWindow()) {
    getImageViewerWindow().close();
  }
  if (hasSettingsWindow()) {
    getSettingsWindow().close();
  }
  if (hasPlotterWindow()) {
    getPlotterWindow().close();
  }
}

function createMainWIndow() {
  const mainWindow = setMainWindow(createWindow(WINDOW_TYPES.MAIN, { isDev }));

  //open devtools if in dev env
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.on('close', (event) => {
    if (isMainWindowClosing) {
      closeChildWindows();
      return;
    }

    const historyList = history.getHistory();
    const lastAction = historyList[historyList.length-1];

    if(historyList.length>0 && !lastAction.name.includes("export lcmodel")){
      event.preventDefault();
      void (async () => {
        const options = {
          type: "question",
          buttons: ["No", "Yes"],
          defaultId: 0,
          title: "Unsaved Changes",
          message: "Unsaved changes to the model. Do you really want to exit?",
        };
        recordE2EDialog(options);
        const response =
          process.env.LC_E2E === "1" && e2eCloseDialogResponse !== null
            ? { response: e2eCloseDialogResponse }
            : await showMessageBoxWithE2E(null, options);
        e2eCloseDialogResponse = null;
        console.log(response)
        if(response.response === 0){
          return;
        }

        isMainWindowClosing = true;
        closeChildWindows();
        if (hasMainWindow()) {
          getMainWindow().close();
        }
      })();
      return;
    }

    isMainWindowClosing = true;
    closeChildWindows();
  });
  mainWindow.on("closed", () => {
    clearMainWindow();
    isMainWindowClosing = false;
  });

  //initialise
  LCCore = initialiseLCCore();
    
  //Implement menu
  menuRebuild();
  //===================================================================================================================================
  //===================================================================================================================================
  //IPC from renderer
  
  //============================================================================================
  //Initialise and load model data
  ipcMain.handle("InitialiseCorrelationModel", async (_e) => {
    //initialise
    LCCore = initialiseLCCore();
    history.setInitialState(LCCore.exportSerialisedModel());
    resetTransientAppState();
    const zipped = await zipData(LCCore.exportSerialisedModel());

    console.log("MAIN: Project correlation data is initialised.");
    return zipped;
  });
  ipcMain.handle("InitialiseAgeModel", async (_e) => {
    //initialise
    LCAge = new LevelCompilerAge();
    LCCore.calcMarkerAges(LCAge);
    resetTransientAppState();
    console.log("MAIN: Project age data is initialised.");
    return;
  });

  ipcMain.handle("initialisePlotDataCollection", async (_e) => {
    //import modeln
    LCPlot = initialiseLCPlotData();
    
    //for mainwindow
    getMainWindow().webContents.send("initialiseLCPlotData");
    console.log("MAIN: Renderer LCPlot is initialised.");

    //for plotter
    const zipped = await zipData(LCPlot);

    if (zipped && hasPlotterWindow()) {
      sendToPlotterWindow("importedData", zipped);      
      
      console.log("MAIN: Plotter LCPlot is initialised.");
    }

    console.log("MAIN: ALL LCPlot is initialised.")
  
  });
  ipcMain.handle("InitialisePaths", async (_e) => {
    //import modeln
    initialiseGlobalPath();
    resetTransientAppState();
    console.log("MAIN: Paths are initialised.");
    return;
  });
  //============================================================================================
  //register and load model data
  ipcMain.handle("RegisterModelFromCsv", async (_e, payload) => {
    const { modelPath: model_path } = payload;
    //get file path
    let results = path.parse(model_path);
    const fullpath = path.join(results.dir, results.base);
    
    const result = registerModelFromCsv(fullpath);
    return result
  });
  ipcMain.handle("RegistertAgeFromCsv", async (_e, payload) => {
    const { agePath: age_path } = payload;
    try {
      //get file path
      let results = path.parse(age_path);
      const fullpath = path.join(results.dir, results.base);      
      
      //register
      const res = registerAgeFromCsv(fullpath);

      if(res==true){
        //apply latest age model to the depth model
        let model_name = null;
        LCAge.AgeModels.forEach((model) => {
          if (model.id == LCAge.selected_id) {
            model_name = model.name;
          }
        });

        return { id: LCAge.selected_id, name: model_name};
      }
    } catch (error) {
      console.error("MAINE: Age model register error.");
      console.log(error);
      return null;
    }
  });
  ipcMain.handle("RegisterLCmodel", async (_e, payload) => {
    const { modelPath: model_path } = payload;
    try {
      //get file path
      let results = path.parse(model_path);
      const fullpath = path.join(results.dir, results.base);

      const registeredAgeList = await registerLCModel(fullpath);

      return  registeredAgeList;
    }catch(err){
      console.log("MAIN: Failed to load LC model.",err);
      return false
    }
  });
  ipcMain.handle("LoadModelFromLCCore", async (_e) => {
    //import model
    try{
      const zipped = await zipData(LCCore.exportSerialisedModel());

      console.log("MAIN: Load correlation model.");
      return zipped;
    }catch(err){
      console.error("MAIN: Failed to zip: ", err);
      return null;
    }
  });
  ipcMain.handle("LoadAgeFromLCAge", async (_e, payload) => {
    const { ageId: age_id } = payload;
    //apply latest age model to the depth model
    let model_name = null;

    //set new id
    LCAge.selected_id = age_id;

    //get model name
    const ageModel = LCAge.getModelData(); 
    if (ageModel == null) {
      return null;
    }

    //load
    model_name = ageModel.name;

    //load ages into LCCore
    LCCore.calcMarkerAges(LCAge);
    //if(LCPlot.data_collections.length>0){
    //const res = LCPlot.calcDataCollectionPosition(LCCore, LCAge);
    //}

    //LCAge.checkAges();
    if(LCAge.unreliable_ids.length>0){
      let txt = "Age model contains inverted chronological order.";
      if(LCAge.use_unreliable_data==true){
        txt +=" The Ages were forcibly calculated including inverted data.";
      }else{
        txt +=" The ages were calculated excluding inverted data.";        
      }
      const err = {
        status: 'Infomation',
        statusDetails: txt,      
        hasError: false,    
        errorDetails: null, 
      }
      getMainWindow().webContents.send("AlertRenderer", err);
    }

    //send data
    try{
      const zipped = await zipData(LCCore.exportSerialisedModel());
      if(LCPlot.data_collections.length>0){
        //initialise view
        sendToPlotterWindow("initialiseSendData");
      }
      console.log("MAIN: Load age model into LCCore. id: " +  LCAge.selected_id + " name:" +  model_name);
      return zipped;
    }catch(err){
      console.error("MAIN: Failed to zip: ", err);
      return null;
    }
    
  });
  ipcMain.handle("MirrorAgeList", async (_e) => {
    let registeredAgeList = []; 
    for (let i = 0; i < LCAge.AgeModels.length; i++) {
      //make new collection
      const model_name = LCAge.AgeModels[i].name;
      const model_id = LCAge.AgeModels[i].id;
      registeredAgeList.push({ id: model_id, name: model_name});
    }
    console.log("MAIN: Mirrored age list");
    
    return registeredAgeList;
    
  });
  ipcMain.handle("Reregister", async (_e) => {    
    const tempPath = JSON.parse(JSON.stringify(globalPath));
    initialiseGlobalPath();

    //re register LCModel
    let targetList = tempPath.dataPaths.filter(item=>item.type=="lcmodel");
    for(const data of targetList){
      const fullpath = data.path;
      if(fullpath !== undefined){
        await registerLCModel(fullpath);
      }
    }

    //re register CSV model
    targetList = tempPath.dataPaths.filter(item=>item.type=="csvmodel");
    for(const data of targetList){
      const fullpath = data.path;
      if(fullpath !== undefined){
        const result = registerModelFromCsv(fullpath);
      }
    }

    //calc
    LCCore.calcCompositeDepth();
    LCCore.calcEventFreeDepth();

    //re register CsvAge
    targetList = tempPath.dataPaths.filter(item=>item.type=="csvage");
    for(const data of targetList){
      const fullpath = data.path;
      console.log(fullpath)
      if(fullpath !== undefined){
        const result = registerAgeFromCsv(fullpath);
      }
    }

    //re register Images
    targetList = tempPath.dataPaths.filter(item=>item.type=="core_images" || item.type=="image_source");
    for(const data of targetList){
      const fullpath = data.path;
      if(fullpath !== undefined){
        registerCoreImage(fullpath, data.type, null, {
          sourceId: data.sourceId ?? "source_1",
          label: data.label ?? "Image 1",
        });
      }
    }

    console.log("MAIN: Reload all model data.")
    return ;
  });
  
  //============================================================================================
  //file process
  ipcMain.handle("getFilePath", async (_e, pathData) => {
    //import modeln
    let results = path.parse(pathData);
    console.log(results)
    results.fullpath = path.join(results.dir, results.base);
    results.imagepath = path.join(results.dir, results.name+".jpg");//force to rename for labeler
    return results;
  });
  ipcMain.handle("CheckImagesInDir", async (_e, payload) => {
    const { fileName: name, projectName = null, sourceId = null } = payload;
    let targetList = getRegisteredImageSources("core_images", sourceId);
    //mainWindow.webContents.send("rendererLog", targetList);

    let result = false;
    for(const target of targetList){
      const projectRoot = projectName ? path.join(target.path, projectName) : null;
      const searchRoot = projectRoot && fs.existsSync(projectRoot) ? projectRoot : target.path;
      const res = await findFileInDir(searchRoot, name, "check");
      if(res==true){
        result = true;
        break;
      }
    }
    return result;
  });
  ipcMain.handle("FileChoseDialog", async (_e, payload) => {
    const result = await getfile(getMainWindow(), payload.title, payload.ext);
    
    return result;
  });
  ipcMain.handle("FolderChoseDialog", async (_e, payload) => {
    const result = await getDirectory(getMainWindow(), payload.title);
    return result;
  });

 //============================================================================================
 //image process
  ipcMain.handle('RegisterCoreImage', (_e, payload) => {
    const {
      dirHandle: dir_handle,
      type,
      sourceId = "source_1",
      label = "Image 1",
    } = payload;
    try{
      //get file path
      const pathData = path.parse(dir_handle);
      if(pathData.dir==""){
        console.log("MAIN: Failed to register core images.")
        return false
      }

      let dirPath = null; 
      if (pathData.ext === ".zip") {
        // if zip
        dirPath = path.join(pathData.dir, pathData.base);
        registerCoreImage(dirPath, type, null, { sourceId, label });
      } else if(pathData.ext==""){
        //case folder
        dirPath = path.join(pathData.dir, pathData.name);
        //register path
        registerCoreImage(dirPath, type, null, { sourceId, label });
      }else if(pathData.ext==".jpg"|| pathData.ext === ".jpeg"|| pathData.ext === ".tif"|| pathData.ext === ".tiff"|| pathData.ext === ".png"){
        dirPath = pathData.dir;
        //register path
        registerCoreImage(dirPath, type, pathData.base, { sourceId, label });
      }else if(pathData.ext==".lcsection"){
        //lcsection from labeler
        dirPath = pathData.dir;
        //register path
        registerCoreImage(dirPath, type, null, { sourceId, label });
      }else{
        return false
      }
      
      return true      
    }catch(err){
      return false
    } 
  });
  ipcMain.handle("LoadCoreImage", async (_e, payload) => {
    const { loadOptions, type } = payload;
    //type: "core_images", "labeler"    
    const coreImages = await loadCoreImages(loadOptions, type);
    return coreImages;
  });
  ipcMain.handle("UnregisterCoreImageSource", (_e, payload) => {
    const sourceId = payload?.sourceId ?? "source_1";
    const before = globalPath.dataPaths.length;
    globalPath.dataPaths = globalPath.dataPaths.filter((item) => {
      if (item.type !== "image_source" && item.type !== "core_images") {
        return true;
      }
      const itemSourceId = item.sourceId ?? "source_1";
      return itemSourceId !== sourceId;
    });
    return {
      ok: true,
      removed: before - globalPath.dataPaths.length,
      sourceId,
    };
  });
  async function loadCoreImages(loadOptions, type){
    const isShowMemory = false;
    const silentProgress = loadOptions.silentProgress === true;
    if (!silentProgress) {
      progressBar = progressDialog(getMainWindow(), "Load modeled section images", "Now converting...", false);
      //await new Promise(r => progressBar.on('ready', r));
      await new Promise(r => progressBar.once('ready', r));
    }

    //console.log("   Load core image called")
    let releasedWorkers = 0;
    let numTotalTasks = 0;
    try {
      if(loadOptions.targetIds.length==0){
        return null
      }

      //initialise
      
      let coreImages = {
        sourceId: loadOptions.sourceId ?? "source_1",
        tier: loadOptions.tier ?? "standard",
        label: loadOptions.label ?? null,
        load_target_ids: [],
        operations:[],
        image_resolution: {},
        drilling_depth: {},
        composite_depth: {},
        event_free_depth: {},
        age:{},
      };
      const hasSelectedAgeModel = LCAge?.AgeModels?.length > 0 && LCAge?.selected_id != null;
      const effectiveOperations = (loadOptions.operations ?? []).filter((operation) => {
        return operation !== "age" || hasSelectedAgeModel;
      });
      coreImages.operations = effectiveOperations;

      //get registered image folder path
      let targetList = getRegisteredImageSources(type, loadOptions.sourceId);

      if(targetList.length < 1){
        console.log("MAIN: There is no registered image folders.")
        if (!silentProgress) {
          progressBar = await updateProgress(progressBar, 1, 1);
        }
        progressBar = null;
        return null
      }
      console.log("MAIN: Load images: N = "+loadOptions.targetIds.length+"; Operations: ["+effectiveOperations+"]");

      //make tasks
      const tasks = []; // Task queue
      const idleWorkers = []; // Idle worker list

      for(const target of targetList){
        for(const id of loadOptions.targetIds){          
          let idx = null;
          let targetHoleData = null;
          let targetSectionData = null;
          if(type=="core_images" || type=="image_source"){
            idx = LCCore.search_idx_list[id.toString()];
            targetHoleData = LCCore.projects[idx[0]].holes[idx[1]];
            targetSectionData = JSON.parse(JSON.stringify(targetHoleData.sections[idx[2]]));
          }else if(type=="labeler"){
            targetHoleData = tempCore.projects[0].holes[0];
            targetSectionData = targetHoleData.sections[0];
          }
          
          const imFileBaseName = targetHoleData.name +"-"+targetSectionData.name;
          const targetProjectData = idx ? LCCore.projects[idx[0]] : null;
          const imBaseName = targetProjectData ? targetProjectData.name +"-"+imFileBaseName : imFileBaseName;
          const projectImageRoot = targetProjectData ? path.join(target.path, targetProjectData.name) : null;
          const imageSearchRoot = projectImageRoot && fs.existsSync(projectImageRoot) ? projectImageRoot : target.path;

          //get image path
          let fullpath;
          if(imFileBaseName.includes(".jpg")||imFileBaseName.includes(".jpeg")||imFileBaseName.includes(".tif")||imFileBaseName.includes(".tiff")||imFileBaseName.includes(".png")){
            fullpath = await findFileInDir(imageSearchRoot, imFileBaseName, "get");
          }else{
            const exts = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];

            for (const ext of exts) {
              fullpath = await findFileInDir(imageSearchRoot, imFileBaseName + ext, "get");
              if (fullpath) break;
            }
          }

          if(fullpath == false){
            continue
          }
  
          //calc new image size
          const coreLength = targetSectionData.markers[targetSectionData.markers.length-1].distance - targetSectionData.markers[0].distance;
          let new_height = Math.round(200 * 100); //max
          const requestedDpcm = getTierDpcm(loadOptions, imBaseName);
          const dpcm = requestedDpcm[imBaseName] ? requestedDpcm[imBaseName] : requestedDpcm;
          if(new_height > dpcm * coreLength){
            new_height = Math.round(dpcm * coreLength);
          }
          //calc resize        
          const new_size = { height: new_height, width: 1 };

          //console.log(imBaseName, loadOptions.dpcm, Math.round(coreLength,1), new_size)
  
          tasks.push({
            type:"continue",
            imageName:imBaseName,
            imagePath:fullpath,            
            imageSize:new_size,
            operations:effectiveOperations,
            sectionData:targetSectionData,
          })  
        }
      }      

      if(tasks.length==0){
        console.log("MAIN: Failed to get tasks", targetList, loadOptions);
        if (!silentProgress) {
          progressBar = await updateProgress(progressBar, 1, 1);
        }
        progressBar = null;
        return null
      }
      //submit
      //make worker
      numTotalTasks = tasks.length;
      const NUM_WORKERS = Math.max(1, Math.min(Math.round(os.cpus().length / 2), numTotalTasks));
      
      if (!silentProgress) {
        progressBar = await updateProgress(progressBar, 0, numTotalTasks);
      }
      const workers = await initialiseWorkerPool(NUM_WORKERS, tasks, idleWorkers, coreImages);

      while (tasks.length > 0 && idleWorkers.length > 0) {
        processNextTask(tasks, idleWorkers);
      }

      // Wait for all workers to finish
      await new Promise((resolve, reject) => {
        workers.forEach((worker) => {
          worker.on("exit", (code) => {
            if (isShowMemory) setImmediate(() => console.log('after exit (code=' + code + ')', process.memoryUsage()));

            releasedWorkers += 1;

            if(releasedWorkers >= NUM_WORKERS){ 
              console.log("MAIN: All workers have been successfully closed and resources are released.");
              resolve();
            }
          });

          /*
          worker.on("exit", (code) => {
            if (isShowMemory) setImmediate(() => console.log('after exit (code=' + code + ')', process.memoryUsage()));

            //count num releases
            releasedWorkers +=1;

            //console.log(releasedWorkers,NUM_WORKERS)
            if(releasedWorkers==NUM_WORKERS){
              console.log("MAIN: All workers have been successfully closed and resources are released.");
              resolve();
            }else{
              processNextTask([{type:"exit"}], idleWorkers); // next close task
            }
          });
          */
        });
      });

      if(progressBar!==null){
        if (!silentProgress) {
          progressBar = await updateProgress(progressBar, numTotalTasks, numTotalTasks);
        }
        progressBar = null;
      }
      return coreImages;
    }catch(err){
      console.log(err)
      return null;
    } finally {
      if (!silentProgress && progressBar) {
        closeGlobalProgressBar();
      }
    }
      //-----------------------------------------------------------
      
      async function initialiseWorkerPool(numWorkers, tasks, idleWorkers, taskResults) {
        const workers = [];  
        let n = 0;

        if (isShowMemory) console.log('baseline(before spawn)', process.memoryUsage());
        for (let i = 0; i < numWorkers; i++) {
          const worker = new Worker(path.join(__dirname, './LC_modules/makeModelImageWorker.js'));
          workers.push(worker);
          idleWorkers.push(worker);
          
          if (isShowMemory) console.log('baseline(after spawn #' + i + ')', process.memoryUsage());

          // when completed//errored
          /*
          worker.on("message", async(result) => {
            if(isShowMemory) console.log('recv', process.memoryUsage());
            //console.log("MAIN: Worker finished task.");
            n +=1;
            progressBar = await updateProgress(progressBar, n, numTotalTasks);
            // if get result
            mergeMissingKeys(taskResults, result);

            if (isShowMemory) console.log('after release', process.memoryUsage());
            if (isShowMemory) setImmediate(() => console.log('next tick after recv', process.memoryUsage()));
      
            if (tasks.length > 0) {
              idleWorkers.push(worker); // reuse worker
              processNextTask(tasks, idleWorkers); // next task
            } else{
              // all tasks are finished
              //console.log("MAIN: Exit worker1 (idle workers: "+idleWorkers.length+")")
              if(idleWorkers.length == 0){
                idleWorkers.push(worker); // reuse worker
                processNextTask([{type:"exit"}], idleWorkers);
              }else{
                releasedWorkers +=1;
                processNextTask([{type:"exit"}], idleWorkers);
              }                        
            }
          });
      
          //if error
          worker.on("error", async(err) => {
            if (isShowMemory) console.log('error recv', process.memoryUsage());

            n+=1;
            progressBar = await updateProgress(progressBar, n, numTotalTasks);
            console.error("Worker error:", err);
            idleWorkers.push(worker);
            if (tasks.length > 0) {
              idleWorkers.push(worker); // reuse worker
              processNextTask(tasks, idleWorkers); // next task
            } else{
              // all tasks are finished
              //console.log("MAIN: Exit worker2 (idle workers: "+idleWorkers.length+")")  
              if(idleWorkers.length == 0){
                idleWorkers.push(worker); // reuse worker
                processNextTask([{type:"exit"}], idleWorkers);
              }else{
                releasedWorkers +=1;
                processNextTask([{type:"exit"}], idleWorkers);
              }                       
            }
          });
          */
          worker.on("message", async(result) => {
            if(isShowMemory) console.log('recv', process.memoryUsage());

            n += 1;
            if (!silentProgress) {
              progressBar = await updateProgress(progressBar, n, numTotalTasks);
            }

            mergeMissingKeys(taskResults, result);

            if (tasks.length > 0) {
              if(!idleWorkers.includes(worker)) idleWorkers.push(worker); 
              processNextTask(tasks, idleWorkers);
            } else {
              if(!worker._exitSent){
                worker._exitSent = true;
                //worker.postMessage({type:"exit"});
                worker.terminate();
              }
              while(idleWorkers.length > 0){
                const w = idleWorkers.pop();
                if(w && !w._exitSent){
                  w._exitSent = true;
                  //w.postMessage({type:"exit"});
                  w.terminate();
                }
              }
            }
          });
          worker.on("error", async(err) => {
            if (isShowMemory) console.log('error recv', process.memoryUsage());

            n += 1;
            if (!silentProgress) {
              progressBar = await updateProgress(progressBar, n, numTotalTasks);
            }
            console.error("Worker error:", err);

            if (tasks.length > 0) {
              if(!idleWorkers.includes(worker)) idleWorkers.push(worker);
              processNextTask(tasks, idleWorkers);
            } else {
              if(!worker._exitSent){
                worker._exitSent = true;
                worker.postMessage({type:"exit"});
              }
              while(idleWorkers.length > 0){
                const w = idleWorkers.pop();
                if(w && !w._exitSent){
                  w._exitSent = true;
                  w.postMessage({type:"exit"});
                }
              }
            }
          });
          

    
        }
        return workers;
      }
      function processNextTask(tasks, idleWorkers) {    
        if ((tasks.length > 0 && idleWorkers.length > 0)) {
          const worker = idleWorkers.pop();
          const task = tasks.shift();
          if (worker && task) {
            if(task.type=='continue'){
              //console.log(`MAIN: Assigning task to worker: ${task.imageName}`);
            }        
            worker.postMessage(task);
          }
        }
      }
      function mergeMissingKeys(objA, objB) {
        for (const key in objB) {
          if (!objA.hasOwnProperty(key)) {
            if(!objA[key]){
              objA[key] = objB[key];
            }
          } else if (typeof objB[key] === 'object' && typeof objA[key] === 'object') {
            mergeMissingKeys(objA[key], objB[key]);
          }
        }
      }
  };
  ipcMain.on('GetResources', (_e) => {
    
    let resourcePath;
    if(app.isPackaged){
      //after build
      resourcePath = path.join(process.resourcesPath);
    }else{
      //dev env
      resourcePath = path.join(__dirname);
    }
    
    //set path
    let plot_paths = {
      terrestrial: path.join(resourcePath, "resources","plot","terrestrial.png"),
      terrestrial_unreliable: path.join(resourcePath, "resources","plot","terrestrial_unreliable.png"),
      terrestrial_disable: path.join(resourcePath, "resources","plot","terrestrial_disable.png"),
      marine: path.join(resourcePath, "resources","plot","marine.png"),
      marine_unreliable: path.join(resourcePath, "resources","plot","marine_unreliable.png"),
      marine_disable: path.join(resourcePath, "resources","plot","marine_disable.png"),
      tephra: path.join(resourcePath, "resources","plot","tephra.png"),
      tephra_unreliable: path.join(resourcePath, "resources","plot","tephra_unreliable.png"),
      tephra_disable: path.join(resourcePath, "resources","plot","tephra_disable.png"),
      orbital: path.join(resourcePath, "resources","plot","orbital.png"),
      orbital_unreliable: path.join(resourcePath, "resources","plot","orbital_unreliable.png"),
      orbital_disable: path.join(resourcePath, "resources","plot","orbital_disable.png"),
      general: path.join(resourcePath, "resources","plot","general.png"),
      general_unreliable: path.join(resourcePath, "resources","plot","general_unreliable.png"),
      general_disable: path.join(resourcePath, "resources","plot","general_disable.png"),
      historical: path.join(resourcePath, "resources","plot","historical.png"),
      historical_unreliable: path.join(resourcePath, "resources","plot","historical_unreliable.png"),
      historical_disable: path.join(resourcePath, "resources","plot","historical_disable.png"),
      interpolation: path.join(resourcePath, "resources","plot","interpolation.png"),
      interpolation_unreliable: path.join(resourcePath, "resources","plot","interpolation_unreliable.png"),
      interpolation_disable: path.join(resourcePath, "resources","plot","interpolation_disable.png"),
    };

    let tool_paths ={
      bt_reload:      path.join(resourcePath, "resources","tool","reload.png"),
      bt_finder:      path.join(resourcePath, "resources","tool","finder.png"),
      bt_zoomin:      path.join(resourcePath, "resources","tool","zoomin.png"),
      bt_zoom0:       path.join(resourcePath, "resources","tool","zoom0.png"),
      bt_zoomactual:  path.join(resourcePath, "resources","tool","zoomactual.png"),
      bt_zoomout:     path.join(resourcePath, "resources","tool","zoomout.png"),
      bt_measure:     path.join(resourcePath, "resources","tool","measure.png"),
      bt_snapshot:    path.join(resourcePath, "resources","tool","snapshot.png"),
      bt_pen:         path.join(resourcePath, "resources","tool","pen.png"),
      bt_divider:     path.join(resourcePath, "resources","tool","divider.png"),
      bt_grid:        path.join(resourcePath, "resources","tool","grid.png"),
      bt_source:      path.join(resourcePath, "resources","tool","source.png"),
      bt_rank:        path.join(resourcePath, "resources","tool","rank.png"),
      bt_target:      path.join(resourcePath, "resources","tool","target.png"),
      bt_event_layer: path.join(resourcePath, "resources","tool","event.png"),
      bt_core_photo:  path.join(resourcePath, "resources","tool","core_photo.png"),
      bt_connection:  path.join(resourcePath, "resources","tool","connection.png"),
      bt_chart:       path.join(resourcePath, "resources","tool","chart.png"),
      bt_show_labels: path.join(resourcePath, "resources","tool","label.png"),
      bt_core_model:  path.join(resourcePath, "resources","tool","core_model.png"),
    };
    
    let finder_paths ={
      fixed:  path.join(resourcePath, "resources","tool","fixed.png"),
      linked: path.join(resourcePath, "resources","tool","linked.png"),
      fix:    path.join(resourcePath, "resources","tool","fix.png"),
      link:   path.join(resourcePath, "resources","tool","link.png"),
    };

    let labeler_paths = {
      bt_change_distance: path.join(resourcePath, "resources","tool","edit_distance.png"),
      bt_change_dd:       path.join(resourcePath, "resources","tool","edit_dd.png"),
      bt_change_name:     path.join(resourcePath, "resources","tool","edit_name.png"),
      bt_add_marker:      path.join(resourcePath, "resources","tool","add_marker.png"),
      bt_delete_marker:   path.join(resourcePath, "resources","tool","delete_marker.png"),
      bt_zoom0:           path.join(resourcePath, "resources","tool","zoom0.png"),
      bt_zoomactual:      path.join(resourcePath, "resources","tool","zoomactual.png"),
    };
  
    //make fuction
    const loadIcon = ((paths)=>{
      let icons = {};
      for(const key in paths){
        try{
        const imBuffer = fs.readFileSync(paths[key]).toString("base64");
        const imData = `data:image/png;base64,${imBuffer}`;
        icons[key] = imData;
        }catch(err){
          console.log("MAIN: Failed to load icon: "+key);
        }
      }
      return icons;
    })

    //load images
    let plot_icons   = loadIcon(plot_paths);
    let tool_icons   = loadIcon(tool_paths);
    let finder_icons = loadIcon(finder_paths);
    let labeler_icons= loadIcon(labeler_paths);

    
    _e.returnValue = {plot:plot_icons, tool:tool_icons, finder:finder_icons, labeler:labeler_icons};
  });
  ipcMain.handle("isExistFile",(_e, payload)=>{
    const { dirHandle, fileName } = payload;
    try{
      //get file path
      const pathData = path.parse(dirHandle);
      let dirPath = null; 
      if(pathData.ext==""){
        //case folder
        dirPath = path.join(pathData.dir, pathData.name);
      }else{
        dirPath = pathData.dir;
        //register path
      }

      //check
      const fullpath = path.join(dirPath, fileName);
      if(fs.existsSync(fullpath)){
        return true
      }else{
        return false
      }
    }catch(err){
      return false
    } 
  });
  ipcMain.handle("floatingImageViewer", async (_e, payload) => {
    const { targetId, sourceId = "source_1" } = payload;
    try{
      const loadOptions = {
        targetIds: [targetId], 
        operations: ["drilling_depth"],
        dpcm: 100,
        sourceId,
        tier: "highres",
      };
      const sectionImage = await loadCoreImages(loadOptions, "core_images");

      const key = Object.keys(sectionImage?.drilling_depth || {})[0];
      const buf = sectionImage?.drilling_depth?.[key];
      //const metadata = await sharp(buf).metadata();
      const metadata = await sharp(sectionImage["drilling_depth"][Object.keys(sectionImage["drilling_depth"])[0]]).metadata();

      if (hasImageViewerWindow()) {
        getImageViewerWindow().focus();
        return;
      }

      //create finder window
      const imageViewerWindow = setImageViewerWindow(createWindow(WINDOW_TYPES.IMAGE_VIEWER, {
        browserWindowOptions: {
          parent: getMainWindow(),
          width: 300,
          height: 800,
        },
      }));
      
      //converterWindow.setAlwaysOnTop(true, "normal");
      imageViewerWindow.on("closed", () => {
        clearImageViewerWindow();
        sendToMainWindow("ImageViewerClosed", "");
      });
      imageViewerWindow.once("ready-to-show", () => {
        imageViewerWindow.show();
        //imageViewerWindow.setAlwaysOnTop(true, "floating");
        //imageViewerWindow.webContents.openDevTools();
        //converterWindow.setAlwaysOnTop(true, "normal");
      });
      imageViewerWindow.webContents.once("did-finish-load", () => {
        sendToImageViewerWindow("ImageViewerMenuClicked", sectionImage);
      });

      return true;
    }catch(err){
      console.error("MAIN:floatingImageViewer failed", err);
      throw err;
    }     
  });
 //============================================================================================
  ipcMain.handle("addSectionFromLcsection", async (_e,pathHandle) => {
    try {
      //get file path
      let pathData = path.parse(pathHandle);
      pathData.fullpath = path.join(pathData.dir, pathData.base);

      //load
      let sectionData = null;
      if (pathData.fullpath !== null) {
        const fileContent = fs.readFileSync(pathData.fullpath, 'utf8');
        sectionData = JSON.parse(fileContent);
      }else{
        return "There is no such a file.";
      }

      //search target section
      const holeName = pathData.name.split("-")[0];
      const sectionName = pathData.name.split("-")[1];

      let targetHoleIds = [];
      for(let p=0;p<LCCore.projects.length;p++){

        for(let h=0;h<LCCore.projects[p].holes.length;h++){
          if(LCCore.projects[p].holes[h].name == holeName){
            targetHoleIds.push(LCCore.projects[p].holes[h].id);

            for(let s=0; s<LCCore.projects[p].holes[h].sections.length;s++){
              if(LCCore.projects[p].holes[h].sections[s].name == sectionName){
                //case duplicate section
                return "Duplicate section exist.";
              }
            }
          }
        }  
      }

      //check duplicate hole
      if(targetHoleIds.length>1){
        return "Duplicate hole exist."
      }else if(targetHoleIds.length==0){
        return "There is no hole with a matching name."
      }

      //add blank section
      const result = LCCore.addSectionModel(targetHoleIds[0], sectionData);

      //return result
      if(result == true){
        console.log("MAIN: Add new section from lcsection.");
        return true
      }else{
        return "fail_to_add";
      }
    }catch(err){
      console.log("MAIN: Failed to add LC model.",err);
      return "fail_to_add"
    }
  });
  ipcMain.handle("progressbar", async (_e, progressbarPayload) => {
    const { title, text, indeterminate, targetWindow: requestedWindow = "mainWindow" } = progressbarPayload;
    closeGlobalProgressBar();
    let targetWindow = getMainWindow();
    if(requestedWindow == "converterWindow"){
      targetWindow = getConverterWindow();
    }
    progressBar = progressDialog(targetWindow, title, text, indeterminate);
    //await new Promise(resolve => setTimeout(resolve, 100));
    if (progressBar && typeof progressBar.once === 'function') {
      await new Promise(resolve => progressBar.once('ready', resolve));
    }

    if(progressBar){      
      progressBar.on('ready', () => {
        if(progressBar._window && !progressBar._window.isDestroyed()){
          progressBar.detail = 'Processing...';
        }
      });
      return true
    }    
  });
  ipcMain.handle("updateProgressbar", async (_e, progressPayload) => {
    progressBar = await updateProgress(progressBar, progressPayload.current, progressPayload.total);
    return true
  });
  ipcMain.handle("clearProgressbar", async (_e) => {
    return closeGlobalProgressBar();
  });
  ipcMain.handle("askdialog", (_e, dialogPayload) => {
    const { opts } = dialogPayload;
    const options = {
      type: "question",
      buttons: ["No", "Yes"],
      defaultId: 0,
      title: opts.title,
      message: opts.message,
    };

    let targetWindow = null;
    if(opts.parent == "main"){
      targetWindow = getMainWindow();
    }else if(opts.parent == "settings"){
      targetWindow = getSettingsWindow();
    }else if(opts.parent == "labeler"){
      targetWindow = getLabelerWindow();
    }else if(opts.parent == "finder"){
      targetWindow = getFinderWindow();
    }

    const response = dialog.showMessageBox(targetWindow, options);
    return response;
  });
  ipcMain.handle("inputdialog", async (_e, payload) => {
    const data = payload ?? {};
    //type:text, password, email, number, url, date, time, color, range
    try {
      const result = await prompt({
          title: data.title,
          label: data.label,
          value: data.value,
          height:data.type === "textarea" ? 300 : 200,
          width:500,
          alwaysOnTop:true,
          inputAttrs: {
              type: data.type,
              required: true,
              step: '0.0001',
          },
      });

      return result

    } catch (error) {
        console.error("Prompt error:", error);
        return null;
    }
  });
  ipcMain.handle('showContextMenu', (event, payload) => {
    const { type } = payload;
    return new Promise((resolve) => {
      let template;
      if(type == "editContextMenu"){
        template = [
          {
            label:"Connection",
            submenu:[
              { 
                label: 'Set master', 
                click: () => {
                  console.log('MAIN: Edit master'); 
                  resolve("addMaster");                      
                } 
              },
              { 
                label: 'Remove master', 
                click: () => {
                  console.log('MAIN: Edit master'); 
                  resolve("deleteMaster");                      
                } 
              },
              { type: 'separator' },
              { 
                label: 'Connect markers', 
                click: () => {
                  console.log('MAIN: Connect markers'); 
                  resolve("connectMarkers"); 
                 
                } 
              },
              { 
                label: 'Disconnect markers', 
                click: () => { 
                  console.log('MAIN: Disconnect markers'); 
                  resolve("disconnectMarkers"); 
                } 
              },
              { type: 'separator' },
              { 
                label: 'Connect sections', 
                click: () => {
                  console.log('MAIN: Connect sections'); 
                  resolve("connectSections"); 
                 
                } 
              },
              { 
                label: 'Disconnect sections', 
                click: () => { 
                  console.log('MAIN: Disconnect sections'); 
                  resolve("disconnectSections"); 
                } 
              },
              { type: 'separator' },
              { 
                label: 'Add event', 
                click: () => {
                  console.log('MAIN: Add event'); 
                  resolve("addEvent");                      
                } 
              },
              { 
                label: 'Delete event', 
                click: () => {
                  console.log('MAIN: Delete event'); 
                  resolve("deleteEvent");                      
                } 
              },
              { type: 'separator' },
              { 
                label: 'Set Zero Horizon', 
                click: () => {
                  console.log('MAIN: Edit zero point'); 
                  resolve("setZeroPoint");                      
                } 
              },
              
            ]
          },
          { type: 'separator' },
          {
            label:"Workspace",
            submenu:[
              { 
                label: 'Edit name', 
                click: () => {
                  console.log('MAIN: Edit workspace name'); 
                  resolve("editWorkspaceName"); 
                } 
              },
              { 
                label: 'Edit descriptions', 
                click: () => {
                  console.log('MAIN: Edit workspace descriptions'); 
                  resolve("editWorkspaceDescriptions"); 
                } 
              },
            ]
          },
          {
            label:"Project",
            submenu:[
              { 
                label: 'Add new Project', 
                click: () => {
                  console.log('MAIN: Add new Project'); 
                  resolve("addProject"); 
                } 
              },
              { type: 'separator' },
              { 
                label: 'Edit name', 
                click: () => {
                  console.log('MAIN: Change Project name'); 
                  resolve("changeProjectName"); 
                } 
              },
              { 
                label: 'Edit descriptions', 
                click: () => {
                  console.log('MAIN: Change Project descriptions'); 
                  resolve("changeProjectDescriptions"); 
                } 
              },
              { 
                label: 'Merge projects', 
                click: () => {
                  console.log('MAIN: Merge Projects'); 
                  resolve("mergeProjects"); 
                } 
              },
              { 
                label: 'Change project type', 
                click: () => {
                  console.log('MAIN: Change Project Type'); 
                  resolve("changeProjectType"); 
                } 
              },
              { type: 'separator' },
              { 
                label: 'Delete project', 
                click: () => {
                  console.log('MAIN: Delete Project'); 
                  resolve("deleteProject"); 
                } 
              },
            ]
          },
          {
            label:"Hole",
            submenu:[
              { 
                label: 'Add new Hole', 
                click: () => {
                  console.log('MAIN: Add new Hole'); 
                  resolve("addHole"); 
                } 
              },
              { type: 'separator' },
              { 
                label: 'Edit name', 
                click: () => {
                  console.log('MAIN: Edit Hole name'); 
                  resolve("changeHoleName"); 
                 
                } 
              },
              { 
                label: 'Edit descriptions', 
                click: () => {
                  console.log('MAIN: Edit Hole descriptions'); 
                  resolve("changeHoleDescriptions"); 
                 
                } 
              },
              { 
                label: 'Move to right', 
                click: () => {
                  resolve("holeMoveToRight");                      
                } 
              },
              { 
                label: 'Move to left', 
                click: () => {
                  resolve("holeMoveToLeft");                      
                } 
              },
              { 
                label: 'Move to other project', 
                click: () => {
                  resolve("holeMoveToOtherProject");                      
                } 
              },
              { type: 'separator' },
              { 
                label: 'Delete Hole', 
                click: () => {
                  console.log('MAIN: Delete target Hole'); 
                  resolve("deleteHole"); 
                } 
              },
            ]
          }, 
          {
            label:"Section",
            submenu:[
              { 
                label: 'Add new section', 
                click: () => {
                  console.log('MAIN: Add new section'); 
                  resolve("addSection");                  
                } 
              },
              { type: 'separator' },
              { 
                label: 'Properties', 
                click: () => {
                  resolve("showSectionProperties");                      
                } 
              },
              { 
                label: 'Edit name', 
                click: () => {
                  console.log('MAIN: Edit section name'); 
                  resolve("changeSectionName"); 
                } 
              },
              { 
                label: 'Edit descriptions', 
                click: () => {
                  console.log('MAIN: Edit section descriptions'); 
                  resolve("changeSectionDescriptions"); 
                } 
              },
              { type: 'separator' },
              { 
                label: 'Delete section', 
                click: () => {
                  console.log('MAIN: Delete section'); 
                  resolve("deleteSection");                  
                } 
              },
            ]
          },
          {
            label:"Marker",
            submenu:[
              { 
                label: 'Add new marker', 
                click: () => {
                  console.log('MAIN: Add new marker'); 
                  resolve("addMarker"); 
                 
                } 
              },
              { type: 'separator' },
              { 
                label: 'Edit name', 
                click: () => {
                  console.log('MAIN: Edit marker name'); 
                  resolve("changeMarkerName"); 
                 
                } 
              },
              { 
                label: 'Edit descriptions', 
                click: () => {
                  console.log('MAIN: Edit marker descriptions'); 
                  resolve("changeMarkerDescriptions"); 
                 
                } 
              },
              { 
                label: 'Edit position', 
                click: () => {
                  console.log('MAIN: Edit marker distance'); 
                  resolve("changeMarkerDistance");                      
                } 
              },
              { type: 'separator' },
              { 
                label: 'Delete marker', 
                click: () => {
                  console.log('MAIN: Delete marker'); 
                  resolve("deleteMarker"); 
                 
                } 
              },
            ]
          }, 
          {
            label:"Calc",
            submenu:[
              { 
                label: 'Calc Composite Depth', 
                click: () => {
                  console.log('MAIN: Recalc composite depth'); 
                  resolve("calcCD"); 
                 
                } 
              },
            ]
          },
          { type: 'separator' },
          {
            label:"Image",
            submenu:[
              {
                label: 'Load high-resolution image', 
                click: () => {
                  console.log('MAIN: Load high-resolution image'); 
                  resolve("loadHighResolutionImage");                      
                } 
              },
              { 
                label: 'Load low-resolution image', 
                click: () => {
                  console.log('MAIN: Load low-resolution image'); 
                  resolve("reloadImage");                      
                } 
              },
              {
                label: 'Show floating image', 
                click: () => {
                  console.log('MAIN: Open floating image viewer'); 
                  resolve("showFloatingImage");                      
                } 
              },
              {
                label: 'Plot image brightness', 
                click: () => {
                  console.log('MAIN: Plot image brightness'); 
                  resolve("plotImageBrightness");                      
                } 
              },
              { type: 'separator' },
              {
                label: 'Unload current ImageSet',
                click: () => {
                  console.log('MAIN: Unload current ImageSet');
                  resolve("unloadImageSet");
                }
              },
            ]
          },          
          {
            label:"LC",
            submenu:[
              { 
                label: 'Finder', 
                click: () => {
                  resolve("finder");                      
                } 
              },
              { 
                label: 'Zoom in', 
                click: () => {
                  resolve("zoomin");                      
                } 
              },
              { 
                label: 'Zoom out', 
                click: () => {
                  resolve("zoomout");                      
                } 
              },
              { 
                label: 'Zoom default', 
                click: () => {
                  resolve("zoom0");                      
                } 
              },
              { 
                label: 'Zoom actual size', 
                click: () => {
                  resolve("zoomactual");                      
                } 
              }
            ]
          },
          {
            label:"Cancel",
            click: () => {
              resolve("cancel"); 
            }
          },
        ];
        
      }else if(type=="normalContextMenu"){
        template = [
          {
            label:"LC",
            submenu:[
              { 
                label: 'Reload', 
                click: () => {
                  resolve("reload");                      
                } 
              },
              { 
                label: 'Finder', 
                click: () => {
                  resolve("finder");                      
                } 
              },
              { 
                label: 'Zoom in', 
                click: () => {
                  resolve("zoomin");                      
                } 
              },
              { 
                label: 'Zoom out', 
                click: () => {
                  resolve("zoomout");                      
                } 
              },
              { 
                label: 'Zoom default', 
                click: () => {
                  resolve("zoom0");                      
                } 
              },
              { 
                label: 'Zoom actual size', 
                click: () => {
                  resolve("zoomactual");                      
                } 
              }
            ]
          }
        ]
      }else if(type=="sectionContextMenu"){
        template = [
          {
            label:"Hole",
            submenu:[
              { 
                label: 'Move to right', 
                visible: false,
                click: () => {
                  resolve("holeMoveToRight");                      
                } 
              },
              { 
                label: 'Move to left', 
                visible: false,
                click: () => {
                  resolve("holeMoveToLeft");                      
                } 
              },
            ]
          },
          {
            label:"Section",
            submenu:[
              { 
                label: 'Properties', 
                click: () => {
                  resolve("showSectionProperties");                      
                } 
              },
            ]
          },
          {
            label:"Image",
            submenu:[
              { 
                label: 'Load high-resolution image', 
                click: () => {
                  console.log('MAIN: Load high-resolution image'); 
                  resolve("loadHighResolutionImage");                      
                } 
              },
              { 
                label: 'Reload image', 
                click: () => {
                  console.log('MAIN: reload image'); 
                  resolve("reloadImage");                      
                } 
              },
              { type: 'separator' },
              {
                label: 'Unload current ImageSet',
                click: () => {
                  console.log('MAIN: Unload current ImageSet');
                  resolve("unloadImageSet");
                }
              }
            ]
          },
          {
            label:"LC",
            submenu:[
              { 
                label: 'Reload', 
                click: () => {
                  resolve("reload");                      
                } 
              },
              { 
                label: 'Finder', 
                click: () => {
                  resolve("finder");                      
                } 
              },
              { 
                label: 'Zoom in', 
                click: () => {
                  resolve("zoomin");                      
                } 
              },
              { 
                label: 'Zoom out', 
                click: () => {
                  resolve("zoomout");                      
                } 
              },
              { 
                label: 'Zoom default', 
                click: () => {
                  resolve("zoom0");                      
                } 
              },
              { 
                label: 'Zoom actual size', 
                click: () => {
                  resolve("zoomactual");                      
                } 
              }
            ]
          }
        ] 
      }else if(type=="holeContextMenu"){
        template = [
          {
            label:"Hole",
            submenu:[
              { 
                label: 'Move to right', 
                click: () => {
                  resolve("holeMoveToRight");                      
                } 
              },
              { 
                label: 'Move to left', 
                click: () => {
                  resolve("holeMoveToLeft");                      
                } 
              },
            ]
          },
          {
            label:"LC",
            submenu:[
              { 
                label: 'Reload', 
                click: () => {
                  resolve("reload");                      
                } 
              },
              { 
                label: 'Finder', 
                click: () => {
                  resolve("finder");                      
                } 
              },
              { 
                label: 'Zoom in', 
                click: () => {
                  resolve("zoomin");                      
                } 
              },
              { 
                label: 'Zoom out', 
                click: () => {
                  resolve("zoomout");                      
                } 
              },
              { 
                label: 'Zoom default', 
                click: () => {
                  resolve("zoom0");                      
                } 
              },
              { 
                label: 'Zoom actual size', 
                click: () => {
                  resolve("zoomactual");                      
                } 
              }
            ]
          }
        ] 
      }else if(type=="imageViewerContextMenu"){
        template = [
          {
            label:"Close",
            click: () => {
              if (hasImageViewerWindow()) {
                getImageViewerWindow().close();
              }                  
            } 
          }
        ] 
      }
       
      const menu = Menu.buildFromTemplate(template);
      menu.popup({ 
        window:BrowserWindow.fromWebContents(event.sender),
        callback: () => resolve(null)
      });
    });
  });
  ipcMain.handle("ExportCorrelationAsCsvFromRenderer", async (_e) => {
    console.log("MAIN: Start contructing CSV data.");
    LCCore.updateVersionInfo();
    const MD = LCCore.exportSerialisedModel();
    let exportLCCore = initialiseLCCore();
    
    //exportLCCore <- MD
    exportLCCore.loadModelFromLcmodel(MD);

    //check
    const results = exportLCCore.checkModel();
    let dist_error = 0;
    results.forEach(r=>{
      dist_error += r.distance_confliction_counts;
    })

    if(dist_error>0){
      const options = {
        type: "question",
        buttons: ["No", "Yes"],
        defaultId: 0,
        title: "Export",
        message: "Duplicate marker positions were found (N="+dist_error+") in the correlation model. This may result in incorrect data or processing errors.Do you want to continue exporting anyway?",
      };

      const { response } = await dialog.showMessageBox(getMainWindow(), options);

      if(response===0){
        return null
      }
    }

    //make export array
    let dataMap = exportLCCore.constructModelMap()
    for(let i=0; i<exportLCCore.projects.length;i++){
      const exportProjectId = exportLCCore.projects[i].id;
      let outputArray = exportLCCore.constructCSVforLC(dataMap, exportProjectId); 
      const idx = exportLCCore.search_idx_list[exportProjectId.toString()];
      const version = exportLCCore.projects[0].correlation_version.replace(/\(\d{2}:\d{2}:\d{2}\)/, "");
      let saveName = "";
      const targetIdx = LCCore.search_idx_list[exportLCCore.projects[i].id.toString()];

      if(LCCore.projects[targetIdx[0]].model_type==="correlation"){
        saveName = "[correlation]";
      }else{
        saveName = "[duo]";
      }
      saveName += exportLCCore.projects[idx[0]].name+"("+version+").csv"; 
      
      await putcsvfile(getMainWindow(), saveName, outputArray);
      console.log("MAIN: Export ", saveName);
    }
    history.saveState(LCCore.exportSerialisedModel(), "export csvmodel");
        
  });
  ipcMain.handle("ExportCorrelationAsLFFromRenderer", async (_e) => {
    console.log("MAIN: Start contructing Legacy LF data.");
    LCCore.updateVersionInfo();
    const MD = LCCore.exportSerialisedModel();
    let exportLCCore = initialiseLCCore();
    
    //exportLCCore <- MD
    exportLCCore.loadModelFromLcmodel(MD);

    //check
    const results = exportLCCore.checkModel();
    let dist_error = 0;
    results.forEach(r=>{
      dist_error += r.distance_confliction_counts;
    })
    
    if(dist_error>0){
      const options = {
        type: "question",
        buttons: ["No", "Yes"],
        defaultId: 0,
        title: "Export",
        message: "Duplicate marker positions were found (N="+dist_error+"). This may result in incorrect data or processing errors.Do you want to continue exporting anyway?",
      };

      const { response } = await dialog.showMessageBox(getMainWindow(), options);

      if(response===0){
        return
      }
    }

    //make export array
    let dataMap = exportLCCore.constructModelMap()
    for(let i=0; i<exportLCCore.projects.length;i++){
      const exportProjectId = exportLCCore.projects[i].id;
      let outputArray = exportLCCore.constructCSVforLF(dataMap, exportProjectId);
      if(outputArray === false){
        return false;
      };
      const idx = exportLCCore.search_idx_list[exportProjectId.toString()];
      const version = exportLCCore.projects[0].correlation_version.replace(/\(\d{2}:\d{2}:\d{2}\)/, "");
      const saveModelName = exportLCCore.projects[idx[0]].name+" Correlation model ("+version+").csv"; 
      const saveEventName = exportLCCore.projects[idx[0]].name+" List of Event Layers ("+version+").csv"; 

      putcsvfile(getMainWindow(), saveModelName, outputArray.model);
      putcsvfile(getMainWindow(), saveEventName, outputArray.event);
      console.log("MAIN: Export ", saveModelName, saveEventName);
    }
    history.saveState(LCCore.exportSerialisedModel(), "export csvmodel");
  });
  ipcMain.handle("InitialiseTempCore", async (_e) => {
    //import modeln 
    tempCore = initialiseLCCore();
    tempCore.addProject("correlation","temp");
    tempCore.addHole(tempCore.projects[0].id, "temp");

    labelerHistory = new UndoManager();
    labelerHistory.start = 1;
    labelerHistory.setInitialState(tempCore.exportSerialisedModel());

    globalPath.dataPaths = globalPath.dataPaths.filter(data => data.type !== "labeler");

    console.log("MAIN: Labeler Project data is initialised.");

    return tempCore.exportSerialisedModel();
  });
  ipcMain.handle("getDisplayInfo", async (_e) => {
    //get data
    const results = getDisplayInfo(screen);

    return results;
  });
  ipcMain.handle("LabelerAddSectionData", async (_e, payload) => {
    const { holeName, sectionName } = payload;
    //create new section
    //change temp hole name
    //const result = LCCore.addSectionModel(targetHoleIds[0], sectionData);

    tempCore.changeName(tempCore.projects[0].holes[0].id, holeName);

    //add section
    let inData = {
      name:null,
      distance_top:null,
      distance_bottom:null,
      dd_top:null,
      dd_bottom:null,
    };
    inData.name = sectionName;
    inData.distance_top = 0;
    inData.distance_bottom = 100;
    inData.dd_top = 0;
    inData.dd_bottom = 100;
    tempCore.addSection(tempCore.projects[0].holes[0].id, inData);

    return tempCore.exportSerialisedModel();
  });
  ipcMain.handle("LabelerAddMarkerData", async (_e, payload) => {
    const { name, depth, relativeX } = payload;
    //add marker
    const result = tempCore.addMarker(tempCore.projects[0].holes[0].sections[0].id, depth, "distance", relativeX);
    
    if(result==true){
      const nearMarkers = tempCore.getMarkerIdsByDistance(tempCore.projects[0].holes[0].sections[0].id, depth);

      let result2;
      if(nearMarkers[2]==0){
        //if lower marker is as same as target marker
        result2 = tempCore.changeName(nearMarkers[0], name);
      }else if(nearMarkers[3]==0){
        //if upper marker is as same as target marker
        result2 = tempCore.changeName(nearMarkers[1], name);
      }

      if(result2==true){
        tempCore.sortModel();
        return tempCore.exportSerialisedModel();
      }else if(result2=="used"){
        //name is same, but add without name
        tempCore.sortModel();
        return tempCore.exportSerialisedModel();
      }else{
        return false;
      }
    }else{
      return false;
    }    
  });
  ipcMain.handle("LabelerChangeMarker", (_e, payload) => {
    const { markerId, type, value } = payload;
    //
    const idx = tempCore.search_idx_list[markerId.toString()];
    
    if(type == "distance"){
      //value:distance
      const result = tempCore.changeDistance(markerId, parseFloat(value));
      if(result == true){
        return tempCore.exportSerialisedModel();
      }else{
        console.log("LABELER: "+result)
        return false;
      }
    }else if(type=="name"){
      const result = tempCore.changeName(markerId, value)
      if(result == true){
        return tempCore.exportSerialisedModel();
      }else{
        console.log("LABELER: "+result)
        return false;
      }
    }else if(type == "drilling_depth"){
      //value:distance
      const result = tempCore.changeDrillingDepth(markerId, parseFloat(value));
      if(result == true){
        return tempCore.exportSerialisedModel();
      }else{
        console.log("LABELER: "+result)
        return false;
      }
    }
  });
  ipcMain.handle("LabelerDeleteMarker", (_e, payload) => {
    const markerId =
      payload && typeof payload === "object" && Array.isArray(payload) === false
        ? payload.markerId
        : payload;
    //console.log(markerId)
    const result = tempCore.deleteMarker(markerId);
    if(result == true){
      return tempCore.exportSerialisedModel();
    }else{
      console.log("LABELER: "+result)
      return false;
    }
  });
  ipcMain.handle("LabelerSaveData", async(_e, data) => {
    /*
    let data = {
        hole_name: holeName,
        section_name: sectionName,
        section_data: tempCore.projects[0].holes[0].sections[0],
        image_labeled:base64Data,
        image_original:
      }
    */

    //make outdata
    const labeledImage  = Buffer.from(data.image_labeled.split(",")[1], "base64"); //remove header
    const originalImage = Buffer.from(data.image_original.split(",")[1], "base64"); //remove header
    const annotationData = JSON.stringify(data.section_data,null,2);

    const dataName  = data.hole_name +"-"+ data.section_name;

   
      try{
        const result = await dialog.showOpenDialog(getLabelerWindow(), {
          title: "Please select a folder to save",
          defaultPath: app.getPath("desktop"),
          buttonLabel: "Save",
          properties: ["openDirectory", "createDirectory"],
        });

        if (!result.canceled && result.filePaths[0]) {
          fs.writeFileSync(path.join(result.filePaths[0], dataName+".jpg"), originalImage);
          fs.writeFileSync(path.join(result.filePaths[0], dataName+"_definition.jpg"), labeledImage);
          fs.writeFileSync(path.join(result.filePaths[0], dataName+".lcsection"), annotationData);
          console.log("MAIN: Save "+dataName+" at "+path.join(result.filePaths[0]));
          return true;
        }
      }catch(err){
        console.log(err);
        return err;
      };
      

  });
  ipcMain.handle("LabelerLoadSectionModel", (_e, payload) => {
    const { dirHandle, fileName } = payload;
    //register lcsection model
    try{
      //get file path
      const pathData = path.parse(dirHandle);
      let fullpath = null;
      if(pathData.ext==""){
        //case folder
        const dirPath = path.join(pathData.dir, pathData.name);
        fullpath = path.join(dirPath, fileName);
      }else if(pathData.ext==".jpg"||pathData.ext==".jpeg"||pathData.ext==".tif"||pathData.ext==".tiff"||pathData.ext==".png"){
        const dirPath = pathData.dir;
        const baseName = fileName.split(".")[0];
        fullpath = path.join(dirPath, baseName+".lcsection");
        //register path
      }else{
        const dirPath = pathData.dir;
        fullpath = path.join(dirPath, fileName);
        //register path
      }

      //check
      if(fs.existsSync(fullpath)){
        //load section data
        const fileContent = fs.readFileSync(fullpath, 'utf8');
        const sectionData = JSON.parse(fileContent);

        //register to model
        const name = fileName;
        const holeName = name.split(/[-.]+/)[0];
        const sectionName = name.split(/[-.]+/)[1];
        console.log("MAIN: Load "+holeName+"-"+sectionName+" data from: ",fullpath)

        tempCore.changeName(tempCore.projects[0].holes[0].id, holeName);
        const result = tempCore.addSectionModel(tempCore.projects[0].holes[0].id, sectionData);
        if(result){
          return tempCore.exportSerialisedModel();
        }else{
          return false
        }
        
      }else{
        
        return false
      }
    }catch(err){
      console.error('Error loading file:', err);
      return false
    } 

  });
  ipcMain.handle("LabelerLoadModel", (_e) => {
    return tempCore.exportSerialisedModel();
  });
  ipcMain.handle("ChangeDepthScale", async (_e, payload) => {
    const { newId } = payload;
    LCCore.changeBaseProject(newId);
  });
  ipcMain.handle("PlotterGetData", (_e, payload) => {
    const { data } = payload;
    openConverterWindow({
      browserWindowOptions: {
        parent: hasPlotterWindow() ? getPlotterWindow() : getMainWindow(),
        width: 750,
        height: 800,
      },
      onDidFinishLoad: () => {
        sendToConverterWindow("ConverterMenuClicked", data);
      },
    });
  });
  ipcMain.handle("ConverterClose", (_e, data) => {
    if(hasConverterWindow()){
      console.log("Converter Close called.")
      getConverterWindow().removeAllListeners("close");
      getConverterWindow().close();
      clearConverterWindow();
    }    
  });
  ipcMain.handle("PlotterClose", (_e, data) => {
    if (!hasPlotterWindow()) {
      return false;
    }

    const plotterWindow = getPlotterWindow();
    if (!plotterWindow) {
      return false;
    }

    isPlotterClose = true;
    if (typeof plotterWindow.removeAllListeners === "function") {
      plotterWindow.removeAllListeners("close");
    }
    plotterWindow.close();

    return true;
  });
  ipcMain.on("windowCloseButton", (_e) => {
    if (!hasPlotterWindow()) {
      return;
    }

    const plotterWindow = getPlotterWindow();
    if (!plotterWindow) {
      return;
    }

    isPlotterClose = true;
    if (typeof plotterWindow.removeAllListeners === "function") {
      plotterWindow.removeAllListeners("close");
    }
    plotterWindow.close();
  });
  ipcMain.handle("LoadPlotData", async (_e, payload) => {
    const { type } = payload;
    //calc latest age and depth
    //LC plot age_collection id is as same as LCAge id

    if(type == "age"){
      //age plot point data
      const ageModel = LCAge.getModelData(); //get current sellected model data

      if (ageModel) {
        try{
          const zipped = await zipData(ageModel);
          console.log("MAIN: Send age point data to renderer.")
          return {type: "age", protocol: "direct",data: zipped};
        }catch(err){
          console.error("MAIN: Failed to zip: ", err);
          return null;
        }
      }
    }else if(type == "data"){
      try{       
        const res = LCPlot.calcDataCollectionPosition(LCCore, LCAge);

        if(res.ok){          
          console.log("MAIN: Send data points to renderer.")
          //sendBuffer = await zipData(LCPlot);
          //sendBuffer = encode(LCPlot);
          //return {type: "data", protocol: "buffer", data: true};

          const data = await zipData(LCPlot);
          return {type: "data", protocol: "direct", data: data};
        }else{
          if(res.type == 1){
            //if target data is notexist.
            return {type: "data", protocol: "direct", data: null};
          }else{
            console.log("MAIN: Faild to recalc plot position")
            return {type: "data", protocol: "direct",data: null};
          }          
        }
        
      }catch(err){
        console.error("MAIN: Failed to calc LCPlot: ", err);
        return null;
      }
    }
    
    return null;
  });
  ipcMain.handle("CalcCompositeDepth", async (_e) => {
    //import model
    console.log("MAIN: Calc composite depth.");
   
    LCCore.calcCompositeDepth(LCCore.base_project_id);
    const zipped = await zipData(LCCore.exportSerialisedModel());

    return zipped;
  });
  ipcMain.handle("CalcEventFreeDepth", async (_e) => {
    //import model
    console.log("MAIN: Calc event free depth");
    LCCore.calcEventFreeDepth(LCCore.base_project_id);
    const zipped = await zipData(LCCore.exportSerialisedModel());
    //LCCore.getModelSummary();
    return zipped;
  });
  ipcMain.handle("GetAgeFromEFD", async (_e, payload) => {
    const { efd, method } = payload;
    //calc age
    const age = LCAge.getAgeFromEFD(efd, method);
    if (age == null) {
      return NaN;
    } else {
      return age.mid;
    }
  });
  ipcMain.handle("GetAgeFromCD", async (_e, payload) => {
    const { cd, method } = payload;
    //calc efd
    if (LCCore.base_project_id == null) {
      return NaN;
    }

    const efd = LCCore.getEFDfromCD(cd);
    if (efd == null) {
      return NaN;
    }

    //calc age
    const age = LCAge.getAgeFromEFD(efd, method);
    if (age.age.mid == null) {
      return "";
    } else {
      return age.age.mid;
    }
  });
  ipcMain.handle("dividerConverter", async (_e, payload) => {
    const { depthData, targetData, direction } = payload;
    //calc 
    console.log("MAIN: Calc divider ["+direction+"]")
    //depthData: [holeId, secId, depthData], targetData
    //targetData: [[name, actural lower, definition upper, definition lower, age upper, age lower, polation type],...]

    
    if (!LCCore || targetData.length==0) {
      console.log("MAIN: There is no LCCore.")
      return null;
    }

    let result = {};

    //All hole id/section id are the same.
    const crId = depthData[1]//get section id 

    let output = [];

    //sort data
    targetData.sort((item1, item2) => {
      return parseFloat(item1[1]) - parseFloat(item2[1]);
    });
    depthData[2].sort((item1, item2) => {
      return parseFloat(item1[2]) - parseFloat(item2[2]);
    });

    //make correlation list
    let depthList = [];
    for(let c=0; c<depthData[2].length;c++){
      const defDist= parseFloat(depthData[2][c][2]); //correlation definition distance
      const actDist= parseFloat(depthData[2][c][3]); //correlation actural distance 

      let td_cr = new Trinity();
      td_cr.name         = depthData[2][0];
      td_cr.project_name = LCCore.getDataByIdx(LCCore.search_idx_list[[crId[0], null,    null,    null].toString()]).name;
      td_cr.hole_name    = LCCore.getDataByIdx(LCCore.search_idx_list[[crId[0], crId[1], null,    null].toString()]).name;
      td_cr.section_name = LCCore.getDataByIdx(LCCore.search_idx_list[[crId[0], crId[1], crId[2], null].toString()]).name;
      td_cr.distance     = defDist;

      if(!isNaN(defDist) && !isNaN(actDist)){
        depthList.push({
          correlation_name:    depthData[2][c][1],
          section_id:          depthData[1],
          project_name:        td_cr.project_name,
          hole_name:           td_cr.hole_name,
          section_name:        td_cr.section_name,
          definition_distance: defDist,
          actural_distance:    actDist,
        });
      }
    }

    //main calc
    let resultList = [];
    for(let t=0; t<targetData.length;t++){
      //D1 <- d1
      //D2    d2
      //D3    d4
      
      //initialise
      //each row data
      const targetRowData = targetData[t];

      //calc upper/lower
      let uIdx = null;
      let lIdx   = null; 
      if(direction == "act->def"){
        uIdx = 2;
        lIdx = 3;
      }else if(direction == "def->act"){
        uIdx = 4;
        lIdx = 5;
      }
      //results contains sampling point of upper/lower info
      result = {
        direction: direction,
        name:    targetRowData[1],
        project: depthList[0].project_name,
        hole:    depthList[0].hole_name,
        section: depthList[0].section_name,        
        definition_distance_upper: direction=="def->act" ? parseFloat(targetRowData[uIdx]) : null,
        definition_distance_lower: direction=="def->act" ? parseFloat(targetRowData[lIdx]) : null,
        definition_cd_upper:  null,
        definition_cd_lower:  null,
        definition_efd_upper: null,
        definition_efd_lower: null,
        actual_distance_upper: direction=="act->def" ? parseFloat(targetRowData[uIdx]) : null,
        actual_distance_lower: direction=="act->def" ? parseFloat(targetRowData[lIdx]) : null,
        age_mid_upper:   null,
        age_mid_lower:   null,
        age_upper_upper: null,
        age_upper_lower: null,
        age_lower_upper: null,
        age_lower_lower: null,
        calc_type_upper: null,
        calc_type_lower: null,
        descriptions:""
      }

      if(targetRowData[0]==false){
        //not checked
        resultList.push(result);
        continue
      }

      for(let ul=uIdx; ul<lIdx+1; ul++){
        //search nearest index
        const targetDist = parseFloat(targetRowData[ul]);//uppder/lower actural
        let upperIdx = -Infinity;
        let lowerIdx = Infinity;
        for(let i=0;i<depthList.length;i++){
          const distCorrelation = (direction=="act->def") ? depthList[i].actural_distance : depthList[i].definition_distance;
          if(distCorrelation - targetDist <= 0 && i > upperIdx ){
            upperIdx = i;
          }
          if(distCorrelation - targetDist >= 0 && i < lowerIdx){
            lowerIdx = i;
          }
        }

        if(upperIdx == -Infinity){
          upperIdx = null;
        }

        if(lowerIdx == Infinity){
          lowerIdx = null;
        }

        //check inter or extra polation using cd, because of out of section data
        if(upperIdx == null || lowerIdx == null){
          //case extra polation--------------------------------------
          let D2Idx = null;
          let D3Idx = null;
          if(upperIdx == null && lowerIdx == null){
            //case no polation base
            output.push(result);
            break;
          } else if (upperIdx == null ){
            //case extrapolate to upward
            D2Idx = lowerIdx;
            D3Idx = lowerIdx + 1;
          } else if (lowerIdx == null){
            //case extrapolate downward
            D2Idx = upperIdx;
            D3Idx = upperIdx - 1;
          }

          if(D3Idx > depthList.length || D3Idx < 0){
            //if out of section
            output.push(result);
            break;
          }

          //extrapolation
          let D2     = (direction == "act->def") ? depthList[D2Idx].definition_distance : depthList[D2Idx].actural_distance;
          let D3     = (direction == "act->def") ? depthList[D3Idx].definition_distance : depthList[D3Idx].actural_distance;
          const d1   = targetDist;
          const d2   = (direction == "act->def") ? depthList[D2Idx].actural_distance : depthList[D2Idx].definition_distance;
          const d3   = (direction == "act->def") ? depthList[D3Idx].actural_distance : depthList[D3Idx].definition_distance;
          const d3d2 = d3 - d2;
          const d3d1 = d3 - d1;
          const D1   = LCCore.linearExtrap(D2, D3, d3d2, d3d1, "nearest");

          //calc cd
          let td_cr = new Trinity();
          td_cr.name         = targetRowData[1];
          td_cr.project_name = depthList[0].project_name;
          td_cr.hole_name    = depthList[0].hole_name;
          td_cr.section_name = depthList[0].section_name;
          td_cr.distance     = (direction == "act->def") ? D1 : d1;

          const cd_list = LCCore.getDepthFromTrinity(depthList[0].section_id, [td_cr], "composite_depth", true, true); //output:[sec id, cd, rank] fource calc extrapolation
          const D1cd = cd_list[0][1];

          const idx2 = LCCore.getIdxFromTrinity(depthList[0].section_id, [depthList[0].hole_name, depthList[0].section_name, (direction == "act->def") ? D2 : d2]);
          const depthSource2 = LCCore.projects[idx2[0]].holes[idx2[1]].sections[idx2[2]].markers[idx2[3]].depth_source;

          if(ul == uIdx){
            //case upper data
            result.definition_distance_upper = (direction == "act->def") ? D1 : d1;
            result.actual_distance_upper     = (direction == "act->def") ? d1 : D1;
            result.definition_cd_upper       = D1cd
            result.calc_type_upper           = "extrapolation["+depthSource2[0]+"]";
          }else{
            //case lower data
            result.definition_distance_lower = (direction == "act->def") ? D1 : d1;
            result.actual_distance_lower     = (direction == "act->def") ? d1 : D1;
            result.definition_cd_lower       = D1cd
            result.calc_type_lower           = "extrapolation["+depthSource2[0]+"]";
          }
          //----------------------------------------------------------
        } else {
          //case inter polation---------------------------------------
          let D1   = (direction == "act->def") ? depthList[upperIdx].definition_distance : depthList[upperIdx].actural_distance;
          let D3   = (direction == "act->def") ? depthList[lowerIdx].definition_distance : depthList[lowerIdx].actural_distance;
          const d1 = (direction == "act->def") ? depthList[upperIdx].actural_distance : depthList[upperIdx].definition_distance;
          const d2 = targetDist;
          const d3 = (direction == "act->def") ? depthList[lowerIdx].actural_distance : depthList[lowerIdx].definition_distance;
          const d2d1 = d2 - d1;
          const d3d1 = d3 - d1;
          const D2   = LCCore.linearInterp(D1, D3, d2d1, d3d1);

          //calc cd
          let td_cr = new Trinity();
          td_cr.name         = targetRowData[1];
          td_cr.project_name = depthList[0].project_name;
          td_cr.hole_name    = depthList[0].hole_name;
          td_cr.section_name = depthList[0].section_name;
          td_cr.distance     = (direction == "act->def") ? D2 : d2;

          const cd_list = LCCore.getDepthFromTrinity(depthList[0].section_id, [td_cr], "composite_depth", true, true); //output:[sec id, cd, rank]
          const D2cd = cd_list[0][1];
          
          const idx1 = LCCore.getIdxFromTrinity(depthList[0].section_id, [depthList[0].hole_name, depthList[0].section_name, (direction == "act->def") ? D1 : d1]);
          const idx3 = LCCore.getIdxFromTrinity(depthList[0].section_id, [depthList[0].hole_name, depthList[0].section_name, (direction == "act->def") ? D3 : d3]);
          const depthSource1 = LCCore.projects[idx1[0]].holes[idx1[1]].sections[idx1[2]].markers[idx1[3]].depth_source;
          const depthSource3 = LCCore.projects[idx3[0]].holes[idx3[1]].sections[idx3[2]].markers[idx3[3]].depth_source;

          if(ul == uIdx){
            result.definition_distance_upper = (direction == "act->def") ? D2 : d2;
            result.actual_distance_upper     = (direction == "act->def") ? d2 : D2;
            result.definition_cd_upper       = D2cd;
            result.calc_type_upper           = "interpolation["+depthSource1[0]+"/"+depthSource3[0]+"]";
          }else{
            result.definition_distance_lower = (direction == "act->def") ? D2 : d2;
            result.actual_distance_lower     = (direction == "act->def") ? d2 : D2;
            result.definition_cd_lower       = D2cd;
            result.calc_type_lower           = "interpolation["+depthSource1[0]+"/"+depthSource3[0]+"]";
          }

          //----------------------------------------------------------
        }
      }

      //check markers
      let descriptions="";
      for(let c=0; c<depthData[2].length;c++){
        const defDist= parseFloat(depthData[2][c][2]); //correlation definition distance
        const actDist= parseFloat(depthData[2][c][3]); //correlation actural distance 

        if(defDist >= result.definition_distance_upper && defDist <= result.definition_distance_lower){
          const diffDefUpper = lcfnc.round((defDist - result.definition_distance_upper),1);
          const diffActUpper = lcfnc.round((actDist - result.actual_distance_upper),1);
          const diffDefLower = lcfnc.round((result.definition_distance_lower - defDist),1);
          const diffActLower = lcfnc.round((result.actual_distance_lower - actDist),1);

          descriptions += depthData[2][c][1] + " is " + diffDefUpper +" cm[definition] (" + diffActUpper + " cm[actual]) below the sample upper.";
        }
      }

      //calc age, efd
      result.definition_efd_upper = LCCore.getEFDfromCD(result.definition_cd_upper);
      result.definition_efd_lower = LCCore.getEFDfromCD(result.definition_cd_lower);
      const ageUpper = LCAge.getAgeFromEFD(result.definition_efd_upper, "linear");
      const ageLower = LCAge.getAgeFromEFD(result.definition_efd_lower, "linear");
      result.age_mid_upper   = ageUpper.age.mid;
      result.age_upper_upper = ageUpper.age.upper;
      result.age_upper_lower = ageUpper.age.lower;
      result.age_mid_lower   = ageLower.age.mid;
      result.age_lower_upper = ageLower.age.upper;
      result.age_lower_lower = ageLower.age.lower;
      result.descriptions    = descriptions;

      //
      //console.log(result)
      resultList.push(result);
    }

    return resultList;
  });
  ipcMain.handle("OpenDivider", async (_e) => {
    if (hasDividerWindow()) {
      getDividerWindow().focus();

      if (getDividerWindow().webContents.getURL()) {
        getDividerWindow().webContents.send("DividerToolClicked", "");
      } else {
        getDividerWindow().webContents.once("did-finish-load", () => {
          getDividerWindow().webContents.send("DividerToolClicked", "");
        });
      }

      return;
    }

    //initial construction
    const dividerWindow = setDividerWindow(createWindow(WINDOW_TYPES.DIVIDER, {
      browserWindowOptions: {
        parent: getMainWindow(),
      },
    }));

    dividerWindow.on("closed", () => {
      sendToMainWindow("DividerClosed", "");
      clearDividerWindow();
      
    });

    dividerWindow.webContents.once("did-finish-load", () => {
      dividerWindow.show();
      dividerWindow.webContents.send("DividerToolClicked", "");
    });
  });

  ipcMain.handle("CloseDivider", async (_e) => {
    closeDividerWindow();
    return;
  });
  ipcMain.handle("dividerReflow", async (_e) => {
    if (hasDividerWindow()) {
      getDividerWindow().blur();
      setTimeout(() => getDividerWindow().focus(), 1); 
      return true;
    }
    return false
  });
  ipcMain.on("dividerExport", async (_e, data) => {
    putcsvfile(getDividerWindow(), null, data);    
    console.log("MAIN: Exported Divided data.");
  });
  ipcMain.handle("OpenFinder", async (_e) => {
    if (hasFinderWindow()) {
      getFinderWindow().focus();
      sendToFinderWindow("FinderToolClicked", "");
      return;
    }

    //create finder window
    const finderWindow = setFinderWindow(createWindow(WINDOW_TYPES.FINDER, {
      browserWindowOptions: {
        parent: getMainWindow(),
      },
    }));

    finderWindow.on("closed", () => {
      clearFinderWindow();
      sendToMainWindow("FinderClosed", "");
    });


    const finderPrecision = {
      position: 1,
      cd: 1,
      efd: 1,
      age: 0,
    };
    const buildFinderPrecisionMenu = (label, key) => ({
      label,
      submenu: [0, 1, 2, 3].map((precision) => ({
        label: precision === 0 ? "Integer" : `${precision} decimal${precision === 1 ? "" : "s"}`,
        type: "radio",
        checked: finderPrecision[key] === precision,
        click: () => {
          finderPrecision[key] = precision;
          if (hasFinderWindow()) {
            sendToFinderWindow("FinderPrecisionChanged", { key, precision });
          }
        },
      })),
    });

    const customMenu = Menu.buildFromTemplate([
      {
        label: "Settings",
        submenu: [
          {
            label: "Real-time update",
            type: "checkbox",
            checked: false,
            click: (menuItem) => {
              if (hasFinderWindow()) {
                sendToFinderWindow("updateModeChanged", menuItem.checked);
              }
            }
          },
          { type: "separator" },
          buildFinderPrecisionMenu("Position digits", "position"),
          buildFinderPrecisionMenu("CD digits", "cd"),
          buildFinderPrecisionMenu("EFD digits", "efd"),
          buildFinderPrecisionMenu("Age digits", "age"),
        ]
      }
    ]);

    finderWindow.webContents.on('context-menu', (_event, params) => {
      customMenu.popup({ window: finderWindow, x: params.x, y: params.y });
    });
  
    finderWindow.once("ready-to-show", () => {
      finderWindow.show();
      //finderWindow.webContents.openDevTools();
      //finderWindow.setAlwaysOnTop(true, "floating");
    });
    finderWindow.webContents.once("did-finish-load", () => {
      sendToFinderWindow("FinderToolClicked", "");

      const LCBookmarkSet= getSettings("bookmarks");
      let LCBookmarkData = null;
      if(LCBookmarkSet!==null){
        LCBookmarkData = LCBookmarkSet[LCCore.name];
      }
      
      sendToFinderWindow("Bookmarks", LCBookmarkData);
    });
  });
  ipcMain.handle("CloseFinder", async (_e) => {
    closeFinderWindow();
    return;
  });
  ipcMain.handle("Confirm", async (event, confirmPayload) => {
    const { opts } = confirmPayload;
    const options = {
      type: "question",
      buttons: ["Yes", "No"],
      title: opts.title,
      message: opts.message,
    };

    let targetWindow = null;
    if(opts.parent == "main"){
      targetWindow = getMainWindow();
    }else if(opts.parent == "divider"){
      targetWindow = getDividerWindow();
    }

    const result = await showMessageBoxWithE2E(targetWindow, options);
    return result.response === 0;
  });
  ipcMain.handle("SendDepthToFinder", async (_e, payload) => {
    const { data } = payload;
    return sendToFinderWindow("SendDepthFromMain", data);
  });
  ipcMain.on("request-mainprocess-info", (event) => {
    const info = "";
    event.sender.send("mainprocess-info", info);
  });
  ipcMain.on("toggle-devtools", async(_e, payload) => {
    const { target } = payload;
    if(target == "divider"){
      if (getDividerWindow().webContents.isDevToolsOpened()) {
        getDividerWindow().webContents.closeDevTools();
      } else {
        getDividerWindow().webContents.openDevTools();
      }
    } else if(target == "finder"){
      if (getFinderWindow().webContents.isDevToolsOpened()) {
        getFinderWindow().webContents.closeDevTools();
      } else {
        getFinderWindow().webContents.openDevTools();
      }
    } else if(target == "main"){
      if (getMainWindow().webContents.isDevToolsOpened()) {
        getMainWindow().webContents.closeDevTools();
      } else {
        getMainWindow().webContents.openDevTools();
      }
    } else if(target == "converter"){
      if (getConverterWindow().webContents.isDevToolsOpened()) {
        getConverterWindow().webContents.closeDevTools();
      } else {
        getConverterWindow().webContents.openDevTools();
      }
    } else if(target == "labeler"){
      if (getLabelerWindow().webContents.isDevToolsOpened()) {
        getLabelerWindow().webContents.closeDevTools();
      } else {
        getLabelerWindow().webContents.openDevTools();
      }
    }else if(target == "viewer"){
      if (getImageViewerWindow().webContents.isDevToolsOpened()) {
        getImageViewerWindow().webContents.closeDevTools();
      } else {
        getImageViewerWindow().webContents.openDevTools();
      }
    }else if(target == "plotter"){
      if (getPlotterWindow().webContents.isDevToolsOpened()) {
        getPlotterWindow().webContents.closeDevTools();
      } else {
        getPlotterWindow().webContents.openDevTools();
      }
    }else if(target == "settings"){
      if (getSettingsWindow().webContents.isDevToolsOpened()) {
        getSettingsWindow().webContents.closeDevTools();
      } else {
        getSettingsWindow().webContents.openDevTools();
      }
    }
    
  });
  ipcMain.handle("sendUndo", async (_e, payload) => {
    const { type } = payload;
    if(type=="main"){
      const result = history.undo();   
      if(result !== null){
        //mainWindow.webContents.send("rendererLog", result);

        //Undo
        LCCore = initialiseLCCore();
        Object.assign(LCCore, result.state);
        LCCore.updateSearchIdx();

        //get changed sections that still exist after undo
        let changedIds = getExistingChangedSectionIds(LCCore, result.delta);

        //Undo image
        //set image resolution
        let dpcms = {};
        for (let i=0;i<changedIds.length;i++){
          const idx = LCCore.search_idx_list[changedIds[i]];
          const holeData = LCCore.projects[idx[0]].holes[idx[1]];
          const sectionData = LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
          dpcms[holeData.name+"-"+sectionData.name] = 30;
        }

        //Undo images
        let imagePaths = getRegisteredImageSources("core_images");
        if(imagePaths.length>0 && changedIds.length>0){
          const coreImages = await loadCoreImages({
            targetIds:changedIds,
            operations:["drilling_depth","composite_depth","event_free_depth","age"],
            dpcm:30, //e.g. 30 or [DPCM<im name> = 30]
          },"core_images");

          if(coreImages!==null){
            getMainWindow().webContents.send("LoadCoreImagesMenuClicked", coreImages);
          }
        }

        console.log("MAIN: Undo loaded.");
        return true;
      }else{
        return false;
      }
    }else if(type=="labeler"){
      const result = labelerHistory.undo();   
      if(result !== null){
        //Undo deep copy
        tempCore = initialiseLCCore();
        Object.assign(tempCore, result.state);
        tempCore.updateSearchIdx();

        //assignObject(tempCore, result.state);
        console.log("MAIN: Undo loaded.");
        return true;
      }else{
        return false;
      }
    }
    
  });
  ipcMain.handle("sendRedo", async (_e, payload) => {
    const { type } = payload;
    if(type=="main"){
      const result = history.redo();      
      if(result !== null){
        //redo
        LCCore = initialiseLCCore();
        Object.assign(LCCore, result.state);
        LCCore.calcCompositeDepth();
        LCCore.calcEventFreeDepth();
        LCCore.updateSearchIdx();

        //get changed sections that still exist after redo
        let changedIds = getExistingChangedSectionIds(LCCore, result.delta);

        //Undo image
        //set image resolution
        let dpcms = {};
        for (let i=0;i<changedIds.length;i++){
          const idx = LCCore.search_idx_list[changedIds[i]];
          const holeData = LCCore.projects[idx[0]].holes[idx[1]];
          const sectionData = LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
          dpcms[holeData.name+"-"+sectionData.name] = 30;
        }

        //Undo images
        let imagePaths = getRegisteredImageSources("core_images");
        if(imagePaths.length>0 && changedIds.length>0){
          const coreImages = await loadCoreImages({
            targetIds:changedIds,
            operations:["drilling_depth","composite_depth","event_free_depth","age"],
            dpcm:30,
          },"core_images");

          if(coreImages!==null){
            getMainWindow().webContents.send("LoadCoreImagesMenuClicked", coreImages);
          }
        }

        console.log("MAIN: Redo loaded.");
        return true;
      }else{
        return false;
      }
    }else if(type=="labeler"){
      const result = labelerHistory.redo();   
      if(result !== null){
        tempCore = initialiseLCCore();
        Object.assign(tempCore, result.state);

        console.log("MAIN: Labeler redo loaded.");
        return true;
      }else{
        return false;
      }
    }
  });
  ipcMain.handle("sendSaveState", async (_e, payload) => {
    const { type, name = "unnamed" } = payload;
    if(type=="main"){
      history.saveState(LCCore.exportSerialisedModel(), name);
      console.log("MAIN: State saved. Num of history is " + history.undoStack.length);    
      return true;
    }else if(type=="labeler"){
      labelerHistory.saveState(tempCore.exportSerialisedModel(), name);
      console.log("MAIN: State saved. Num of history is " + labelerHistory.undoStack.length);    
      return true;
    }
  });
  ipcMain.handle("getChangedSectionIds", async (_e, payload) => {
    const { type, numPrevious } = payload;
    if(type=="main"){
      const result = history.getDelta(numPrevious);
      const ids = getChangedSectionIds(history.lastState, result);

      console.log("MAIN: Get state differences.");    
      return ids;
    }
  });
  function getChangedSections(delta) {
    if (!delta?.projects) {
        return [];
    }

    const changed = new Set();
    const projectsDelta = delta.projects;

    for (const pk in projectsDelta) {
        if (pk === '_t') continue;
        const pDelta = projectsDelta[pk];
        const pi = +pk.replace(/^_/, '');

        const holesDelta = pDelta.holes;
        if (!holesDelta) continue;

        for (const hk in holesDelta) {
            if (hk === '_t') continue;
            const hDelta = holesDelta[hk];
            const hi = +hk.replace(/^_/, '');

            const sectionsDelta = hDelta.sections;
            if (!sectionsDelta) continue;

            for (const sk in sectionsDelta) {
                if (sk === '_t') continue;
                const sDelta = sectionsDelta[sk];
                const si = +sk.replace(/^_/, '');

                if (sk.startsWith('_')) {
                    changed.add(JSON.stringify({ 
                      project: pi, 
                      hole: hi, 
                      section: si, 
                      change: 'deleted', 
                      details: ["distance", "age", "composite_depth", "event_free_depth", "drilling_depth"]
                    }));
                } else if (Array.isArray(sDelta) && sDelta.length === 1 && typeof sDelta[0] === 'object') {
                  const details = new Set();
                  if (sDelta[0].markers) {
                    for (const marker of sDelta[0].markers) {
                      if ("distance" in marker)        details.add("distance");
                      if ("age" in marker)             details.add("age");
                      if ("composite_depth" in marker) details.add("composite_depth");
                      if ("event_free_depth" in marker) details.add("event_free_depth");
                      if ("drilling_depth" in marker)  details.add("drilling_depth");
                    }
                  }

                  changed.add(JSON.stringify({
                    project: pi, 
                    hole: hi, 
                    section: si, 
                    change: 'added',
                    details:Array.from(details)
                  }));
                } else if (sDelta && Object.keys(sDelta).length > 0) {
                  const details = new Set();
                  if (sDelta.markers) {
                    const markersDelta = sDelta.markers;
                    for (const mk in markersDelta) {
                      if (mk === "_t") continue;
                      const mDelta = markersDelta[mk];
                      if (mDelta?.distance)        details.add("distance");
                      if (mDelta?.age)             details.add("age");
                      if (mDelta?.composite_depth) details.add("composite_depth");
                      if (mDelta?.event_free_depth) details.add("event_free_depth");
                      if (mDelta?.drilling_depth)  details.add("drilling_depth");
                    }
                  }
                  changed.add(JSON.stringify({
                    project: pi, 
                    hole: hi, 
                    section: si, 
                    change: 'updated',
                    details:Array.from(details)
                  }));
                }
            }
        }
    }
    return Array.from(changed).map(item => JSON.parse(item));
  }
  function getExistingChangedSectionIds(core, delta) {
    const changedSections = getChangedSections(delta);
    const ids = [];

    changedSections.forEach((i) => {
      const sectionData = core.projects?.[i.project]?.holes?.[i.hole]?.sections?.[i.section];
      if (!sectionData?.id) {
        return;
      }
      if (!core.search_idx_list?.[sectionData.id.toString()]) {
        return;
      }
      ids.push(sectionData.id);
    });

    return ids;
  }
  function getChangedSectionIds(lastState, delta) {
    const changes = getChangedSections(delta);
    const ids = [];

    for (const c of changes) {
      if (c.change === "updated" || c.change === "added") {
        const sec = lastState
          ?.projects?.[c.project]
          ?.holes?.[c.hole]
          ?.sections?.[c.section];
        if (sec?.id) ids.push({ id: sec.id, change: c.change, details:c.details });
      } else if (c.change === "deleted") {
        const deleted = delta.projects?.[c.project]
          ?.holes?.[c.hole]
          ?.sections?.[`_${c.section}`]?.[0];
        if (deleted?.id) ids.push({ id: deleted.id, change: c.change, details:c.details });
      }
    }

    return ids;
  }
  //------------------------------------------------------------------------------------------------
  //for converter
  ipcMain.handle("cvtGetAgeModelList", async (_e) => {
    //get data
    let data = [];

    LCAge.AgeModels.forEach((age) => {
      data.push([age.id, age.name]);
    });
    return data;
  });
  ipcMain.handle("cvtGetCorrelationModelList", async (_e) => {
    //get data
    let data = [];
    let idx = null;
    LCCore.projects.forEach((project, p) => {
      [project.id, project.name];
      if (project.id[0] == LCCore.base_project_id[0]) {
        idx = p;
      }
    });

    data.push([LCCore.projects[idx].id, LCCore.projects[idx].name]);
    return data;
  });
  ipcMain.handle("cvtLoadCsv", async (_e, payload) => {
    const { title, ext, pathData } = payload;
    try{
      //progress bar
      progressBar   = progressDialog(getConverterWindow(), "Depth Converter", "Now checking...", true);

      await new Promise((resolve) => {
        progressBar.on("ready", resolve);
      });

      //main
      //for converter
      let result = null;
      if(pathData==null){
        result = await getfile(getMainWindow(), title, ext);
      }else{
        result = pathData;
      }

      if (result !== null) {
        try {
          //convert string to cell
          const csvData = parse(fs.readFileSync(result, "utf8"), {
            columns: false,
            delimiter: ",",
          });

          //preserve into global temp data
          const id   = lcfnc.getUniqueId();
          const name = path.basename(result, path.extname(result));
          globalTempData = {from: "converter", data: csvData, name:name, id: id};

          //return 10 rows from top
          const outData = {
            data: csvData.slice(0,10),
            path: result,
            counts: csvData.length,
            id:id
          };

          if(progressBar!==null){
            progressBar.close();
            progressBar = null;
          }
          return await zipData(outData);
        } catch (error) {
          console.log(error);
          console.error(
            "Fail to read csv file. There is no such a file named: " + result
          );

          if(progressBar!==null){
            progressBar.close();
            progressBar = null;
          }
          return [null, null];
        }
      } else {
        if(progressBar!==null){
          progressBar.close();
          progressBar = null;
        }
        return [null, null];
      }

    }catch(error){
      console.error(error)
    }
  });
  function getConverterDepthOutputMask(sourceType, outType = "export") {
    const exportMasks = {
      trinity: {
        project: true,
        hole: true,
        section: true,
        distance: true,
        dd: true,
        cd: true,
        efd: true,
        age: true,
      },
      composite_depth: {
        project: false,
        hole: false,
        section: false,
        distance: false,
        dd: false,
        cd: true,
        efd: true,
        age: true,
        // project: true, // Enable only if pseudo trinity output is allowed.
        // hole: true,
        // section: true,
        // distance: true,
        // dd: true,
      },
      event_free_depth: {
        project: false,
        hole: false,
        section: false,
        distance: false,
        dd: false,
        cd: false,
        efd: true,
        age: true,
        // cd: true, // Enable only if incomplete EFD-to-CD output is allowed.
        // project: true, // Enable only if pseudo trinity output is allowed.
        // hole: true,
        // section: true,
        // distance: true,
        // dd: true,
      },
      age: {
        project: false,
        hole: false,
        section: false,
        distance: false,
        dd: false,
        cd: false,
        efd: true,
        age: true,
        // cd: true, // Enable only if incomplete Age-to-EFD-to-CD output is allowed.
        // project: true, // Enable only if pseudo trinity output is allowed.
        // hole: true,
        // section: true,
        // distance: true,
        // dd: true,
      },
      drilling_depth: {
        project: false,
        hole: false,
        section: false,
        distance: false,
        dd: false,
        cd: false,
        efd: false,
        age: false,
        // dd: true, // Enable only with an explicit target section contract.
        // cd: true,
        // efd: true,
        // age: true,
      },
    };

    const importMasks = structuredClone(exportMasks);
    importMasks.event_free_depth.cd = true;
    importMasks.age.cd = true;
    // importMasks.composite_depth.project = true; // Enable only if pseudo trinity display is allowed.
    // importMasks.composite_depth.hole = true;
    // importMasks.composite_depth.section = true;
    // importMasks.composite_depth.distance = true;
    // importMasks.composite_depth.dd = true;
    // importMasks.event_free_depth.project = true;
    // importMasks.event_free_depth.hole = true;
    // importMasks.event_free_depth.section = true;
    // importMasks.event_free_depth.distance = true;
    // importMasks.event_free_depth.dd = true;
    // importMasks.age.project = true;
    // importMasks.age.hole = true;
    // importMasks.age.section = true;
    // importMasks.age.distance = true;
    // importMasks.age.dd = true;

    const masks = outType === "import" ? importMasks : exportMasks;
    return masks[sourceType] ?? masks.trinity;
  }

  function formatConverterNumber(value, precision) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "";
    }

    return numericValue.toFixed(precision);
  }

  function applyConverterDepthOutputMask(calcedData, sourceType, outType = "export") {
    const mask = getConverterDepthOutputMask(sourceType, outType);
    const maskedData = { ...calcedData };

    if (!mask.project) maskedData.project = null;
    if (!mask.hole) maskedData.hole = null;
    if (!mask.section) maskedData.section = null;
    if (!mask.distance) maskedData.distance = null;
    if (!mask.dd) maskedData.dd = null;
    if (!mask.cd) maskedData.cd = null;
    if (!mask.efd) maskedData.efd = null;
    if (!mask.age) {
      maskedData.age_mid = null;
      maskedData.age_upper = null;
      maskedData.age_lower = null;
      maskedData.age_source = null;
    }

    return maskedData;
  }

  ipcMain.handle("cvtConverter", async (_e, payload) => {
    let { options } = payload;
    options = await unzipData(options);
    if(!globalTempData || globalTempData.from !== "converter" || globalTempData.id !== options.id){
      return {ok:false, reason: "No converter source data found. Please load a CSV file again."}
    }
    if(options.sourceType === "drilling_depth"){
      return {ok:false, reason: "Drilling depth is not supported as a converter input."}
    }
    if(options.sourceType === "age" && (LCAge.AgeModels.length == 0 || !LCAge.selected_id)){
      return {ok:false, reason: "No age model found. Please load an age model first."}
    }
    if(globalTempData.from == "converter" && globalTempData.id == options.id){
      //mage submit indata for depthconverter
      let indataList = [];
      let dataStartFromIdx = 0;
      if (options.sourceType == "trinity") {
        const nameIdx     = options.nameIdx;
        const holeIdx     = options.holeIdx;
        const sectionIdx  = options.sectionIdx;
        const distanceIdx = options.distanceIdx;
        dataStartFromIdx  = options.dataStartFrom;

        //skip header
        for (let i = options.headerLines; i < globalTempData.data.length; i++) {
          const datumName   =  globalTempData.data[i][nameIdx];//data name
          const projectName = null;
          let holeName      = globalTempData.data[i][holeIdx];
          if (/^\d+$/.test(holeName.toString()) == true) {
            //case number
            holeName = holeName.toString().padStart(2, "0");
          }
          let sectionName = globalTempData.data[i][sectionIdx];
          if (/^\d+$/.test(sectionName.toString()) == true) {
            //case number
            sectionName = sectionName.toString().padStart(2, "0");
          }
          const distance = parseFloat(globalTempData.data[i][distanceIdx]);

          indataList.push([
            datumName,
            [projectName, holeName, sectionName, distance],//position trinity name
            [null,null,null,null],//search range
          ]);
        }
      } else if (options.sourceType == "composite_depth") {
        const nameIdx = options.nameIdx;
        const cdIdx   = options.cdIdx;
        dataStartFromIdx  = options.dataStartFrom;
        for (let i = options.headerLines; i < globalTempData.data.length; i++) {
          const datumName = (nameIdx === cdIdx) ? "" : globalTempData.data[i][nameIdx];//data name
          const val       = parseFloat(globalTempData.data[i][cdIdx]);
          indataList.push([
            datumName,
            val,
            [null,null,null,null], 
          ]);
        }
      } else if (options.sourceType == "event_free_depth") {
        const nameIdx     = options.nameIdx;
        const efdIdx      = options.efdIdx;
        dataStartFromIdx  = options.dataStartFrom;
        for (let i = options.headerLines; i < globalTempData.data.length; i++) {
          const datumName = (nameIdx === efdIdx) ? "" : globalTempData.data[i][nameIdx];//data name
          const val       = parseFloat(globalTempData.data[i][efdIdx]);
          indataList.push([
            datumName, 
            val,
            [null,null,null,null],
          ]);
        }
      } else if (options.sourceType == "drilling_depth") {
        const nameIdx     = options.nameIdx;
        const ddIdx       = options.ddIdx;
        dataStartFromIdx  = options.dataStartFrom;
        for (let i = options.headerLines; i < globalTempData.data.length; i++) {
          const datumName = (nameIdx === ddIdx) ? "" : globalTempData.data[i][nameIdx];//data name
          const val       = parseFloat(globalTempData.data[i][ddIdx]);
          indataList.push([
            datumName, 
            val,
            [null,null,null,null],
          ]);
        }
      } else if (options.sourceType == "age") {
        const nameIdx     = options.nameIdx;
        const ageIdx      = options.ageIdx;
        dataStartFromIdx  = options.dataStartFrom;
        for (let i = options.headerLines; i < globalTempData.data.length; i++) {
          const datumName = (nameIdx === ageIdx) ? "" : globalTempData.data[i][nameIdx];//data name
          const val       = parseFloat(globalTempData.data[i][ageIdx]);
          indataList.push([
            datumName,
            val,
            [null,null,null,null],
          ]);
        }
      }

      console.log("MAIN: Make imported data list.")

      //submit data into depthConverter
      const calcedDataList = await depthConverter(indataList, options);

      if(calcedDataList===null){
        return {ok:false, reason: "Usear cancelled."}
      }

      //
      if(options.outType == "export"){
        progressBar = progressDialog(getConverterWindow(), "Depth Converter", "Now exporting...", true);
        await new Promise((resolve) => {
          progressBar.on("ready", resolve);
        });
        //EXPORT as CSV
        //make export format
        //header
        let convertedData = [];
        let header = [
          "Name",
          "Project",
          "Hole",
          "Section",
          "Position (cm)",
          "Drilling depth (cm)",
          "Source Type",
          " ",
          "Depth basis",
          "Composite depth (cm)",
          "Eventfree depth (cm)",
          "Age mid (calBP)",
          "Age upper (calBP)",
          "Age lower (calBP)",
          " ",          
          "Connection Rank",
          "Section type",
          "Age calc type",          
          //"Calc Type",
          " ",
          "Correlation Model Version",
          //"Event Model Version",
          "Age Model Version",
          "Description",
          " ",
        ];
        if(globalTempData.data[0].length>dataStartFromIdx +1){
          for(let d=dataStartFromIdx +1; d<globalTempData.data[0].length; d++){
            header.push(globalTempData.data[0][d]);
          }
        }
        convertedData.push(header);

        //main
        if (globalTempData.data === null || calcedDataList === null) {
          globalTempData = null;
          if (hasConverterWindow()) {
            console.log("Converter Close called.")
            closeConverterWindow();
          }
          return {ok:false, reason: "There is no valid data for convertion."}
        }

        //main data
        for(let i=0; i<calcedDataList.length; i++){
          //calc depth
          const calcedData = calcedDataList[i];
          
          if(!calcedData){
            console.log("[MAIN]: Conversion was skipped at line: "+i+".");
            continue
          }

          const outputMask = getConverterDepthOutputMask(options.sourceType, options.outType);
          const outputData = applyConverterDepthOutputMask(calcedData, options.sourceType, options.outType);

          let correlationType = "";                  
          if(outputMask.project && calcedData.project_type === "correlation"){
            correlationType = "Main " + calcedData.section_type;            
          }else if(outputMask.project && calcedData.project_type === "duo"){
            correlationType = "Duo " + calcedData.section_type;
          }          

          let basis = null;
          const baseIdx = LCCore.search_idx_list[LCCore.base_project_id.toString()];

          if(outputMask.project && calcedData.is_main_model_connected===false){
            basis = calcedData.project;
          }else{
            basis = LCCore.projects[baseIdx[0]].name;
          }

          //make output array
          let rowData = [
            outputData.name, //data name
            outputData.project ?? "", //project name
            outputData.hole ?? "", //hole name
            outputData.section ?? "", //section name
            formatConverterNumber(outputData.distance, options.precision), //distance
            formatConverterNumber(outputData.dd, options.precision), //drilling depth
            calcedData.source_type,
            "",
            basis,
            formatConverterNumber(outputData.cd, options.precision), //composite depth
            formatConverterNumber(outputData.efd, options.precision), //event free depth            
            formatConverterNumber(outputData.age_mid, options.precision), //age mid
            formatConverterNumber(outputData.age_upper, options.precision), //age upper
            formatConverterNumber(outputData.age_lower, options.precision), //age lower
            "",//separator            
            outputMask.project ? calcedData.correlation_rank : "",  //connection rank    
            correlationType,//calcedData.is_main_model_connected ? "MAIN " + calcedData.section_type : "DUO " + calcedData.section_type, // MAIN master section/parallel section                    
            outputData.age_source ? outputData.age_source.type+"("+outputData.age_source.upper+"/"+outputData.age_source.lower+")" : "", //age inter/extrapolation
            //calcedData.calc_type,
            "",
            calcedData.correlation_model_version,
            calcedData.age_model_version,
            calcedData.description, 
            "",
          ];

          //add data
          if(globalTempData.data[0].length>dataStartFromIdx+1){
            for(let d=dataStartFromIdx+1; d<globalTempData.data[0].length; d++){
              rowData.push(globalTempData.data[i+1][d]);//remove header
            }
          }
                    
          convertedData.push(rowData);
        }
        
        //export
        const res = await putcsvfile(getConverterWindow(), null, convertedData);
        if(res.ok){
          console.log("[MAIN]: Converted data is exported successfully.");
        }else{          
          console.log("[MAIN]: Failed to export.",res.reason);
        }

        if(progressBar!==null){
          progressBar.close();
          progressBar = null;
        }
        globalTempData = null;
        if (hasConverterWindow()) {
          console.log("Converter Close called.")
          closeConverterWindow();
        }
        return res
      }else if(options.outType == "import"){
        progressBar = progressDialog(getConverterWindow(), "Depth Converter", "Now importing...", true);
        await new Promise((resolve) => {
          progressBar.on("ready", resolve);
        });
        //main convertion
        if (globalTempData.data === null || calcedDataList === null) {
          globalTempData = null;
          if (hasConverterWindow()) {
            console.log("Converter Close called.")
            closeConverterWindow();
          }
          return {ok:false, reason: "There is no valid data for convertion."}
        }

        //main calc
        let output = [];
        for(let i=0; i<calcedDataList.length; i++){
          //calc depth
          const calcedData = calcedDataList[i];
          
          if(!calcedData){
            console.log("[MAIN]: Conversion was skipped at line: "+i+".");
            continue
          }

          let header = [];
          let units  = [];
          for(let d=dataStartFromIdx+1; d<globalTempData.data[0].length; d++){
            const m = globalTempData.data[0][d].match(/^(.+?)(?:\[(.+)\])?$/) || [];
            const name = m[1] || "";
            const unit = m[2] || "";

            header.push(name); //remove header
            units.push(unit);
          }
          let values = [];
          for(let d=dataStartFromIdx+1; d<globalTempData.data[0].length; d++){
            values.push(parseFloat(globalTempData.data[i+1][d])); //remove header
          }
          
          calcedData.data_header = header;
          calcedData.data_values = values;
          calcedData.data_units  = units;

          output.push(applyConverterDepthOutputMask(calcedData, options.sourceType, options.outType));
        }

        //convert to flat       
        const cvtData = cvt2flat(output);
        cvtData.id   = globalTempData.id;
        cvtData.name = globalTempData.name;

        //set LCPlot
        LCPlot.addDataset(cvtData);
        
        //send data
        if(options.callFrom == "plotter"){
          //make zip data
          let zipped;
          if(options.returnType == "full"){
            zipped = await zipData(LCPlot);
          }else if(options.returnType == "min"){
            const tempLCPlot = structuredClone(LCPlot);
            tempLCPlot.data_collections.forEach(dataset=>{
              dataset.rows = [structuredClone(dataset.rows[0])];
            })

            zipped = await zipData(tempLCPlot);
          }

          //send => plotter
          try {
            sendToPlotterWindow("importedData", zipped);
            getMainWindow().webContents.send("importedData", true); // -> call loadplotdata(PlotterGetData)
            console.log("MAIN: Plot Data is imported into Plotter & renderer.");
          } catch (err) {
            console.error("MAIN: Failed to zip:", err);
            dialog.showMessageBox(getMainWindow(), {
              type: "info",
              title: "Failed to load",
              message: "Failed to load data",
              detail: String(err),
            });

            globalTempData = null;
            if (hasConverterWindow()) {
              console.log("Converter Close called.")
              closeConverterWindow();
            }
            return {ok: false, reason: err}
          }

        }else if(options.callFrom == "converter"){    
          globalTempData = null;
          return {ok: false, reason: "There is no actions."}
        }
        
        //finish
        if(progressBar!==null){
          progressBar.close();
          progressBar = null;
        }
        globalTempData = null;
        if (hasConverterWindow()) {
          console.log("Converter Close called.")
          closeConverterWindow();
        }
        return {ok: true}        
      } else {
        console.log("[MAIN]: Unkown convertion type detected.")

        if(progressBar!==null){
          progressBar.close();
          progressBar = null;
        }
        globalTempData = null;
        if (hasConverterWindow()) {
          console.log("Converter Close called.")
          closeConverterWindow();
        }
        return {ok: false, reason:"Unkown convertion type detected"} 
      } 
    }
  });
  //--------------------------------------------------------------------------------------------------
 
  //--------------------------------------------------------------------------------------------------
  //for finder
  ipcMain.handle("finderGetCoreList", async (_e) => {
    //get data
    let projectList = [];
    let holeList = [];
    let sectionList = [];

    nh = -1;
    for (let p = 0; p < LCCore.projects.length; p++) {
      const project = LCCore.projects[p];
      projectList.push([p, project.id, project.name]);
      for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
        nh += 1;
        const hole = LCCore.projects[p].holes[h];
        holeList.push([nh, hole.id, hole.name]);
        let secTmep = [];
        for (let s = 0; s < hole.sections.length; s++) {
          const section = hole.sections[s];
          secTmep.push([
            s,
            section.id,
            section.name,
            section.markers[0].distance,
            section.markers[section.markers.length - 1].distance,
            section.markers,
          ]);
        }
        sectionList.push(secTmep);
      }
    }

    return [projectList, holeList, sectionList];
  });
  ipcMain.handle("changeFix", async (_e, payload) => {
    const { isFix } = payload;
    if (!hasFinderWindow()) {
      return;
    }
    if (isFix) {
      getFinderWindow().setParentWindow(getMainWindow());
      getFinderWindow().setAlwaysOnTop(true, "floating");
    } else {
      getFinderWindow().setParentWindow(null);
      getFinderWindow().setAlwaysOnTop(false);
      
    }
  });
  ipcMain.handle("getSectionLimit", async (_e, payload) => {
    const { projectId, holeName, sectionName } = payload;
    const idx = LCCore.getIdxFromTrinity(projectId, [holeName, sectionName, ""]);

    const sectionData = LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
    const dist_upper = sectionData.markers[0].distance;
    const dist_lower = sectionData.markers[sectionData.markers.length - 1].distance;
    return [dist_upper, dist_lower];
  });
  ipcMain.handle("MoveToHorizon", async (_e, payload) => {
    const { data } = payload;
    getMainWindow().webContents.send("MoveToHorizonFromFinder", data);
  });
  ipcMain.handle("terminalLog", async (_e, data) => {
    console.log(data);
  });
  ipcMain.handle("rendererLog", async (_e, data) => {
    getMainWindow().webContents.send("rendererLog", data);
  });
  ipcMain.handle("sendPlotOptions", (_e, payload) => {
    const { sendData, to } = payload;
    if(to=="renderer"){
      getMainWindow().webContents.send("PlotDataOptions", sendData);
    }    
  });
  ipcMain.handle("depthConverter", async (_e, payload) => {
    const { dataList, options } = payload;
    
    //convert
    const resultList = await depthConverter(dataList, options);

    //postprocess for return
    if(resultList.length>1){
      if(options.returnType == "full"){
        if(options.isZip){
          return  await zipData(resultList);
        }else{
          return  resultList;
        }
      }else{
        //
        const extractedList = resultList.slice(0,10); 
        if(options.isZip){
          return  await zipData(extractedList);
        }else{
          return  extractedList;
        }
      }      
    }else{
      return resultList[0];
    }
  });  
  ipcMain.handle("changeEditMode", (_e, payload) => {
    const { mode } = payload;
    isEditMode = mode;
    menuRebuild();
  });
  ipcMain.handle("sendSettings", (_e, payload) => {
    const { sendData, to } = payload;
    if(to=="settings"){
      if(!hasSettingsWindow()){
        openSettingsWindow({
          browserWindowOptions: {
            parent: getMainWindow(),
            model: true,
          },
          onReadyToShow: () => {
            sendToSettingsWindow("SettingsData", sendData);
          },
        });
      }else{
        openSettingsWindow({
          onExisting: () => {
            sendToSettingsWindow("SettingsData", sendData);
          },
        });
      }

    }else if(to=="settings_sync"){
      if(hasSettingsWindow()){
        sendToSettingsWindow("SettingsData", sendData);
      }

    }else if(to=="renderer"){
      getMainWindow().webContents.send("SettingsData", sendData.data);
      if(sendData){
        setSettings("settingsRenderer", sendData.data);
        menuRebuild();
      }      
    }else if(to=="save"){
      setSettings("settingsRenderer", sendData.data)
      menuRebuild();
    }    
  });
  ipcMain.handle("openSettingsFolder", async () => {
    const settingsFolder = app.getPath("userData");
    const result = await shell.openPath(settingsFolder);
    return {
      ok: result === "",
      path: settingsFolder,
      error: result || null,
    };
  });
  ipcMain.handle("saveBookmarks", (_e, payload) => {
    const { bookmarks: data } = payload;
    let LCBookmarkSet= getSettings("bookmarks");
    if(LCBookmarkSet==null){
      LCBookmarkSet = {};
    }
    LCBookmarkSet[LCCore.name] = data;
    setSettings("bookmarks", LCBookmarkSet);
  });
  ipcMain.handle("requestCurrentPosition", (_e) => {
    getMainWindow().webContents.send("FinderRequestCurrentPosition");    
  });
  ipcMain.handle("e2eSetCloseDialogResponse", (_e, response) => {
    if (process.env.LC_E2E !== "1") {
      return false;
    }
    e2eCloseDialogResponse = response;
    return true;
  });
  ipcMain.handle("e2ePushDialogResponse", (_e, response) => {
    if (process.env.LC_E2E !== "1") {
      return false;
    }
    e2eDialogResponses.push(response);
    return true;
  });
  ipcMain.handle("e2eGetAndClearDialogLog", () => {
    if (process.env.LC_E2E !== "1") {
      return [];
    }
    const log = [...e2eDialogLog];
    e2eDialogLog = [];
    return log;
  });
  ipcMain.handle("e2eSetOpenDialogResponse", (_e, payload) => {
    if (process.env.LC_E2E !== "1") {
      return false;
    }
    if (!payload || typeof payload !== "object") {
      e2eOpenDialogResponse = { file: null, folder: null };
      return true;
    }
    e2eOpenDialogResponse = {
      file: Object.prototype.hasOwnProperty.call(payload, "file")
        ? payload.file
        : e2eOpenDialogResponse.file,
      folder: Object.prototype.hasOwnProperty.call(payload, "folder")
        ? payload.folder
        : e2eOpenDialogResponse.folder,
    };
    return true;
  });
  ipcMain.handle("e2eGetOpenDialogResponse", () => {
    if (process.env.LC_E2E !== "1") {
      return null;
    }
    return { ...e2eOpenDialogResponse };
  });

  ipcMain.handle("openExtarnalLink", (_e, payload) => {
    const { url } = payload;
    if(url){
      shell.openExternal(url);
    }
  });
  //--------------------------------------------------------------------------------------------------
  //-----workspace-----
  ipcMain.handle("changeWorkspace", (_e, payload) => {
    const { type, value } = payload;
    if(type=="name"){
      LCCore.name = value;
      return true;
    }else if(type=="descriptions"){
      LCCore.descriptions = value;
      return true;
    }
  });
  //-----project-----
  ipcMain.handle("addProject", async(_e, payload) => {
    const { type, name } = payload;
    
    const result = withSuppressedCoreAlertRenderer(() => LCCore.addProject(type, name));

    if (result == true) {
      console.log("MAIN: Add project completed.");
      return result;
    } else {
      console.log("MAIN: Failed to add a new project.");
      return result
    }
  });
  ipcMain.handle("deleteProject", async(_e, payload) => {
    const { projectId } = payload;
    const options = {
      type: "question",
      buttons: ["No", "Yes"],
      defaultId: 0,
      title: "Dlete Project",
      message: "Do you aslo want to delete the connections between projects?",
    };

    const { response } = await showMessageBoxWithE2E(getMainWindow(), options);

    const result = LCCore.deleteProject(projectId, response);

    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Delete project completed.");
      return result;
    } else {
      console.log("MAIN: Failed to delete project.");
      return result
    }
    
  });
  ipcMain.handle("changeProject", (_e, payload) => {
    const { projectId, type, value } = payload;
    console.log(projectId, type, value)
    if(type=="name"){
      const result = withSuppressedCoreAlertRenderer(() => LCCore.changeName(projectId, value));
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(projectId, value);
      return result;
    }else if(type==="model_type"){
      const result = withSuppressedCoreAlertRenderer(() => LCCore.changeProjectType(projectId, value));
      return result;
    }
  });
  ipcMain.handle("mergeProjects", (_e) => {
    const result = LCCore.mergeProjects();

    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Merge projects completed.");
      return result;
    } else {
      console.log("MAIN: Failed to merge projects.");
      return result
    }
  }); 
  //-----hole-----
  ipcMain.handle("addHole", async(_e, payload) => {
    const { projectId, name } = payload;
    
    const result = withSuppressedCoreAlertRenderer(() => LCCore.addHole(projectId, name));

    if (result == true) {
      console.log("MAIN: Add hole completed.");
      return result;
    } else {
      console.log("MAIN: Failed to add a new hole.");
      return result
    }
  });
  ipcMain.handle("deleteHole", async(_e, payload) => {
    const { holeId } = payload;
    
    const result = LCCore.deleteHole(holeId);

    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Delete hole completed.");
      return result;
    } else {
      console.log("MAIN: Failed to delete hole.");
      return result
    }

    
  });
  ipcMain.handle("changeHole", (_e, payload) => {
    const { holeId, type, value } = payload;
    
    if(type=="name"){
      const result = withSuppressedCoreAlertRenderer(() => LCCore.changeName(holeId, value));
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(holeId, value);
      return result;
    }else if(type=="order"){
      const result = withSuppressedCoreAlertRenderer(() => LCCore.changeHoleOrder(holeId, value));
      return result;
    }
  });
  ipcMain.handle("moveHoleToProject", async(_e, payload) => {
    const { holeId, projectId } = payload;
    
    const result = withSuppressedCoreAlertRenderer(() => LCCore.moveHoleToProject(holeId, projectId));

    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Move hole completed.");
      return result;
    } else {
      console.log("MAIN: Failed to move this hole.");
      return result
    }
  });
  //-----section-----
  ipcMain.handle("addSection", (_e, payload) => {
    const { sectionId, data } = payload;
    //    
    const result = withSuppressedCoreAlertRenderer(() => LCCore.addSection(sectionId,data));//LCCore.deleteSection(sectionId);
    if(result == true){
      console.log("MAIN: Add section.")
      return result;  
    }else{
      console.log("MAIN: Failed to add section.")
      return result;  
    }
    
  });
  ipcMain.handle("deleteSection", (_e, payload) => {
    const { sectionId } = payload;
    //    
    const result = LCCore.deleteSection(sectionId);//LCCore.deleteSection(sectionId);
    if(result == true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Delete section.")
      return result;  
    }else{
      console.log("MAIN: Failed to delete section.")
      return result;  
    }
    
  });
  ipcMain.handle("changeSection", (_e, payload) => {    
    const { sectionId, type, value } = payload;
    if(type=="name"){
      const result = withSuppressedCoreAlertRenderer(() => LCCore.changeName(sectionId, value));
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(sectionId, value);
      return result;
    }
  });
  //-----marker-----
  ipcMain.handle("addMarker", (_e, payload) => {
    let { sectionId, depth, depthScale, relativeX } = payload;

    if (depthScale === "age") {
      const converted = LCAge.getEFDFromAge(Number(depth), "linear");
      const efd = converted?.efd?.mid;

      if (!Number.isFinite(Number(efd))) {
        return "invalid_age";
      }

      depth = Number(efd);
      depthScale = "event_free_depth";
    }

    const result = withSuppressedCoreAlertRenderer(() =>
      LCCore.addMarker(sectionId, depth, depthScale, relativeX)
    );
    if(result==true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Add a new marker on the section: " + sectionId +" of " + depth +" cm "+depthScale);
      return true
    }else{
      return result
    }   
  });
  ipcMain.handle("deleteMarker", (_e, payload) => {
    const { markerId } = payload;
    const result = LCCore.deleteMarker(markerId);
    if(result==true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Delete target marker.");
      return true
    }else{
      return false
    }    
  });
  ipcMain.handle("changeMarker", (_e, payload) => {    
    const { markerId, type, value } = payload;
    if(type == "distance"){
      //value:distance
      const result = withSuppressedCoreAlertRenderer(() => LCCore.changeDistance(markerId, value));
      if(result == true){
        LCCore.calcCompositeDepth();
        LCCore.calcEventFreeDepth();
        console.log("MAIN: Change marker distance.");
      }else{
        console.log("MAIN: Failed to change marker distance.")
      }
      return result;
    }else if(type=="name"){
      const result = withSuppressedCoreAlertRenderer(() => LCCore.changeName(markerId, value))
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(markerId, value)
      return result;
    }
  });
  //-----event-----
  ipcMain.handle("AddEvent", async(_e, payload) => {
    const { upperId, lowerId, depositionType, value } = payload;
    let result = LCCore.addEvent(upperId, lowerId, depositionType, value);

    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Add event layer.");
      return result;
    } else {
      console.log("MAIN: Failed to add event layer.");
      return result
    }
  });
  ipcMain.handle("DeleteEvent", async(_e, payload) => {
    const { upperId, lowerId, type } = payload;
    
    const result = LCCore.deleteEvent(upperId, lowerId, type);

    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Delete event layer.");
      return result;
    } else {
      console.log("MAIN: Failed to delete event layer.");
      return result
    }
  });
  //-----action----- 
  ipcMain.handle("connectMarkers", (_e, payload) => {
    const { fromId, toId, direction } = payload;
    const res = LCCore.connectMarkers(fromId, toId, direction);

    if(res == true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      return true
    }else{
      return false
    }    
  });
  ipcMain.handle("disconnectMarkers", (_e, payload) => {
    const { fromId, toId, direction } = payload;
    const res = LCCore.disconnectMarkers(fromId, toId, direction);
    if(res==true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      return true
    }else{
      return false
    }    
  });
  ipcMain.handle("disconnectAllConnections", (_e, payload) => {
    const { fromId, direction } = payload;
    const fromIdx = LCCore.search_idx_list[fromId.toString()];
    
    let connections = [];
    if (direction == "horizontal"){
      connections = JSON.parse(JSON.stringify(LCCore.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection));
    }else{
      connections = LCCore.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].v_connection;
    }

    let results = {success: 0,failure: 0};
    if (connections.length==0){
      console.log("MAIN: There is no connections at "+LCCore.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].name+"-"+LCCore.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].name)
      return false;
    }else{
      for (let i=0; i<connections.length; i++){
        const toId = connections[i];

        const res = LCCore.disconnectMarkers(fromId, toId, direction);
        if(res){
          results.success += 1;
        }else{
          results.failure += 1;
        }
      }
    }

    if(results.success>0){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
    }
    return results
  });
  ipcMain.handle("SetZeroPoint", async(_e, payload) => {
    const { markerId, value } = payload;
    
    const result = LCCore.setZeroPoint(markerId, value);
    
    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Add hole completed.");
      return result;
    } else {
      console.log("MAIN: Failed to add a new hole.");
      return result
    }
  });
  ipcMain.handle("SetMaster", async(_e, payload) => {
    const { markerId, type } = payload;
    
    const result = LCCore.setMaster(markerId, type);

    if (result == true) {
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Change master flag.");
      return result;
    } else {
      console.log("MAIN: Failed to chnage master flag.");
      return result
    }
  });  
  ipcMain.handle("changeEnable", async(_e, payload) => {
    const { targetId, isEnable } = payload;
    const result = LCCore.changeEnable(targetId, isEnable);

    if (result == true) {
      console.log("MAIN: Change model enables.");
      return result;
    } else {
      console.log("MAIN: Failed to change model enables.");
      return result
    }
  });
  
  //--------------------------------------------------------------------------------------------------  
  //--------------------------------------------------------------------------------------------------
  async function depthConverter(dataList, options){
    //main
    //data: ["name","depth_data","target_id"] e.g. ["name",[projectName(no use),holeName, sectionName, distance],[null, null, null, null]]
    //type: "trinity", "composite_depth", "event_free_depth","age"
    //method(age): "linear"
    try{

    }catch(err){

    }

    const type = options.sourceType
    const method = options.polationType;
    const allowExtrapolation = options.allowOutside;

    dataList = await unzipData(dataList);//check&unzip

    let callWindow;
    let showProgress = false;
    let distance_duplicate = 0;

    if (options.callFrom === "converter" || options.callFrom === "plotter") {
      callWindow = getConverterWindow();
      showProgress = true;
      const cm = LCCore.checkModel();
      cm.forEach(r=>{
        distance_duplicate += r.distance_confliction_counts;
      })
      if(distance_duplicate>0){
        const options = {
          type: "question",
          buttons: ["No", "Yes"],
          defaultId: 0,
          title: "Export",
          message: "Duplicate marker positions were found (N="+distance_duplicate+"). This may result in incorrect data or processing errors.Do you want to continue exporting anyway?",
        };

        const { response } = await showMessageBoxWithE2E(callWindow, options);

        if(response===0){
          return null;
        }
      }
    } else {
      callWindow = getMainWindow();
    }
    
    let resultList = [];
    if(showProgress){
      if(progressBar!==null){
        //new
        progressBar.close();
        progressBar=null;
      }

      progressBar   = progressDialog(callWindow, "Depth Converter", "Now converting...", false);        
      await new Promise(resolve => progressBar.on('ready', resolve));
    }    

    function applyPseudoTrinityToResult(results, pseudoTrinity) {
      const idx = pseudoTrinity?.index ?? [null, null, null, null];
      const project = idx[0] !== null ? LCCore.projects[idx[0]] : null;
      const hole = project && idx[1] !== null ? project.holes[idx[1]] : null;
      const section = hole && idx[2] !== null ? hole.sections[idx[2]] : null;

      results.project = pseudoTrinity?.project != null ? pseudoTrinity.project : NaN;
      results.hole = pseudoTrinity?.hole != null ? pseudoTrinity.hole : NaN;
      results.section = pseudoTrinity?.section != null ? pseudoTrinity.section : NaN;
      results.distance = pseudoTrinity?.distance != null ? pseudoTrinity.distance : NaN;

      results.project_id = project ? project.id : [null, null, null, null];
      results.hole_id = hole ? hole.id : [null, null, null, null];
      results.section_id = section ? section.id : [null, null, null, null];
      results.section_type = pseudoTrinity?.section_type != null ? pseudoTrinity.section_type : "";
    }

    let last = performance.now();
    for(let i=0; i<dataList.length; i++){
      const now = performance.now();
      if (showProgress && now - last > 50) {  // 50ms each
        progressBar   = await updateProgress(progressBar, i, dataList.length);
        last = now;        
      }
      
      //initialise
      let results = {
        name: null,
        project: null,
        hole: null,
        section: null,
        distance: null,
        cd: null,
        efd: null,
        dd:null,
        age_mid: null,
        age_upper: null,
        age_lower: null,
        age_source: null,
        project_id: null,
        hole_id: null,
        section_id: null,
        marker_id: null,

        project_type:null,
        section_type: null,
        correlation_rank: null,
        correlation_model_version: null,
        event_model_version: null,
        age_model_version: null,
        description: null,

        source_type:null,
        is_main_model_connected: false,
        model_type:null,
        distance_confrictionduplicate: false
      };

      //main
      const data = dataList[i];

      if (type == "trinity") {
        //calc each depth 
        let send_data = [];
        let td = new Trinity();
        td.name         = String(data[0]).trim();
        td.project_name = String(data[1][0]).trim();
        td.hole_name    = String(data[1][1]).trim();
        td.section_name = String(data[1][2]).trim();
        td.distance     = parseFloat(data[1][3]);
        if(td.hole_name==null||td.section_name==null||td.distance==null){
          continue
        }
        send_data.push(td);
        let targetId  = data[2];

        //convert depth (listed for function)
        const cd_list = LCCore.getDepthFromTrinity(targetId, send_data, "composite_depth", allowExtrapolation, options.isForceCalculation); //output:[sec id, cd, rank]

        const cd = [];
        cd.push(cd_list[0][1]);
        let calcedId = cd_list[0][0];
        
        //
        const efd_list = LCCore.getDepthFromTrinity(targetId, send_data, "event_free_depth", allowExtrapolation, options.isForceCalculation); //output:[sec id, efd, rank]
        const efd = efd_list[0][1];
        const new_rank = efd_list[0][2];

        const dd_list = LCCore.getDepthFromTrinity(targetId, send_data, "drilling_depth", allowExtrapolation, options.isForceCalculation); //output:[sec id, efd, rank]
        const dd = dd_list[0][1];

        //calc age
        const age = LCAge.getAgeFromEFD(efd, method);

        //get age model idx
        let ageIdx = null;
        LCAge.AgeModels.forEach((a, s) => {
          if (a.id == LCAge.selected_id) {
            ageIdx = s;
          }
        });

        //get idex
        let calcedIdx;
        if(calcedId == null){
          calcedIdx = null;
          console.log("MAIN: "+ send_data[0].hole_name +"-"+send_data[0].section_name+"-"+send_data[0].distance+"cm is out of section.");
        } else {
          calcedIdx = LCCore.search_idx_list[calcedId.toString()];
        } 
        
        //check model connection
        if(calcedIdx){
          results.is_main_model_connected = 
          LCCore.projects[calcedIdx[0]].holes.some(h=>(
            h.sections.some(s=>(
              s.markers.some(m=>(
                m.h_connection.some(hc=> hc[0]===LCCore.base_project_id[0])
              ))
            ))
          )) ?? false;
        }

        let modelVersion = null;
        if(calcedIdx){
          if(results.is_main_model_connected){
            const masterIdx = LCCore.search_idx_list[LCCore.base_project_id.toString()];
            if(masterIdx[0] === calcedIdx[0]){
              modelVersion = " [MAIN] "+LCCore.projects[masterIdx[0]].correlation_version;
            }else{
              modelVersion = "[MAIN] "+LCCore.projects[masterIdx[0]].correlation_version + 
                " / [DUO] " +
                LCCore.projects[calcedIdx[0]].correlation_version;
            }            
          }else{
            const masterIdx = LCCore.search_idx_list[LCCore.base_project_id.toString()];
            modelVersion = "[DUO] " + LCCore.projects[calcedIdx[0]].correlation_version;
          }
          }else{
          modelVersion = "";
        }

        //stack
        results.name        = send_data[0] !== undefined ? send_data[0].name : NaN;
        results.project     = calcedIdx !== null && calcedIdx !== undefined ? LCCore.projects[calcedIdx[0]].name : NaN;
        results.hole        = send_data[0] !== undefined ? send_data[0].hole_name : NaN;
        results.section     = send_data[0] !== undefined ? send_data[0].section_name : NaN;
        results.distance    = send_data[0] !== undefined ? send_data[0].distance : NaN;
        results.cd          = cd[0] !== null ? cd[0] : NaN;
        results.efd         = efd !== null ? efd : NaN;
        results.dd          = dd !== null ? dd : NaN;
        results.age_mid     = age.age.mid   !== null ? age.age.mid   : NaN;
        results.age_upper   = age.age.upper !== null ? age.age.upper : NaN;
        results.age_lower   = age.age.lower !== null ? age.age.lower : NaN;
        results.age_source  = age.age.source!== null ? age.age.source: NaN;
        results.project_id  = calcedIdx !== null ?  [cd_list[0][0][0], null, null, null] : [null, null, null, null];
        results.hole_id     = calcedIdx !== null ?  [cd_list[0][0][0], cd_list[0][0][1], null, null] : [null, null, null, null];
        results.section_id  = calcedIdx !== null ?  [cd_list[0][0][0], cd_list[0][0][1], cd_list[0][0][2], null] : [null, null, null, null];
        results.project_type= cd_list[0][5] !== null ? cd_list[0][5] : "";
        results.section_type= cd_list[0][4] !== null ? cd_list[0][4] : "";
        results.correlation_rank          = new_rank !== null ? new_rank : NaN;
        results.correlation_model_version = calcedIdx !== null ? modelVersion  : NaN;
        results.event_model_version       = calcedIdx !== null ? modelVersion  : NaN;
        results.age_model_version         = calcedIdx !== null ? (LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN) : NaN;
        results.description               = "";
        results.source_type = type; //calcedIdx !== null ? type: NaN;
        results.calc_type   = cd_list[0][3];
      } else if (type == "composite_depth") {
        //get cd
        const name     = data[0];
        const cd       = parseFloat(data[1]);
        const targetId = data[2];

        //get nearest trinity return: [index: , project: , hole: , section: , distance: ]
        const pseudoTrinity = LCCore.getNearestTrinity(targetId, cd, "composite_depth");

        //calc efd
        const efd = LCCore.getEFDfromCD(cd);

        //const dd  = LCCore.getDepthFromTrinity(targetId, send_data, "drilling_depth", allowExtrapolation, options.isForceCalculation); //output:[sec id, efd, rank]

        //calc age
        const ageData = LCAge.getAgeFromEFD(efd, method);
        const age = ageData.age;
        const ageIdx = ageData.age_idx;

        //stack
        results.name = name;
        applyPseudoTrinityToResult(results, pseudoTrinity);
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = NaN;
        results.age_mid = age.mid !== null ? age.mid : NaN;
        results.age_upper = age.upper !== null ? age.upper : NaN;
        results.age_lower = age.lower !== null ? age.lower : NaN;
        results.age_source  = age.source!== null ? age.source: NaN;
        results.correlation_rank = 3;
        results.correlation_model_version = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "Converted from Composite Depth. The trinity is pseudo data.";
        results.source_type = type;
        results.calc_type = "pseudo-depth";
      } else if (type == "event_free_depth") {
        //get efd
        const name = data[0];
        const efd = parseFloat(data[1]);
        const targetId = data[2];

        //get nearest trinity
        const pseudoTrinity = LCCore.getNearestTrinity(targetId, efd, "event_free_depth");

        //get pseudo cd
        const cd = LCCore.getCDfromEFD(efd);

        //calc age
        const ageData = LCAge.getAgeFromEFD(efd, method);
        const age = ageData.age;
        const ageIdx = ageData.age_idx;

        //stack
        results.name = name;
        applyPseudoTrinityToResult(results, pseudoTrinity);
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = NaN;
        results.age_mid = age.mid !== null ? age.mid : NaN;
        results.age_upper = age.upper !== null ? age.upper : NaN;
        results.age_lower = age.lower !== null ? age.lower : NaN;
        results.age_source  = age.source!== null ? age.source: NaN;
        results.correlation_rank = 3;
        results.correlation_model_version = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "Converted from Event Free Depth. The trinity and CD are pseudo data.";
        results.source_type = type;
        results.calc_type = "pseudo-depth";
      } else if (type == "drilling_depth") {
        //NOT RECOMMENDED!!
        //get cd
        const name = data[0];
        const dd = parseFloat(data[1]);
        const targetId = data[2];

        //convertion from drilling depth must be targetId.
        if (targetId[0] == null || targetId[1] == null || targetId[2] == null){
          continue;
        }

        //get nearest trinity
        const pseudoTrinity = LCCore.getNearestTrinity(targetId, dd, "drilling_depth");
        let send_data = [];
        let td = new Trinity();
        td.name         = name;
        td.project_name = pseudoTrinity.project;
        td.hole_name    = pseudoTrinity.hole;
        td.section_name = pseudoTrinity.section;
        td.distance     = pseudoTrinity.distance;
        send_data.push(td);

        //calc cd
        const cd_list = LCCore.getDepthFromTrinity(targetId, send_data, "composite_depth", allowExtrapolation, options.isForceCalculation); //output:[sec id, cd]
        const cd = cd_list[0][1];

        //calc efd
        const efd_list = LCCore.getDepthFromTrinity(targetId, send_data, "event_free_depth", allowExtrapolation, options.isForceCalculation); //output:[sec id, efd]
        const efd = efd_list[0][1];
        const new_rank = efd_list[0][2];

        //calc age
        const ageData = LCAge.getAgeFromEFD(efd, method);
        const age = ageData.age;
        const ageIdx = ageData.age_idx;

        //stack
        results.name = name;
        applyPseudoTrinityToResult(results, pseudoTrinity);
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = dd !== null ? dd : NaN;
        results.age_mid = age.mid !== null ? age.mid : NaN;
        results.age_upper = age.upper !== null ? age.upper : NaN;
        results.age_lower = age.lower !== null ? age.lower : NaN;
        results.age_source  = age.source!== null ? age.source: NaN;
        results.correlation_rank = 3;
        results.correlation_model_version = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "NOT RECOMMENDED! Converted from Drilling Depth. The trinity, CD, EFD amd Age are pseudo data.";
        results.source_type = type;
        results.calc_type = "pseudo-depth";
      } else if (type == "age") {
        //get efd
        const name = data[0];
        const age = parseFloat(data[1]);
        const targetId = data[2];

        //calc efd
        const efdData = LCAge.getEFDFromAge(age, method);
        const efd = efdData.efd.mid;

        if (!Number.isFinite(efd)) {
          results.name = name;
          results.cd = NaN;
          results.efd = NaN;
          results.age_mid = age;
          results.description = "Age could not be converted to EFD.";
          results.source_type = type;
          results.calc_type = "invalid-age";
          resultList.push(results);
          continue;
        }

        //get pseudo cd
        const cd = LCCore.getCDfromEFD(efd);

        //re-calc age
        const rage = LCAge.getAgeFromEFD(efd, method);

        //get nearest trinity
        const pseudoTrinity = LCCore.getNearestTrinity(targetId, efd, "event_free_depth");

        //get age model idx
        let ageIdx = null;
        LCAge.AgeModels.forEach((a, s) => {
          if (a.id == LCAge.selected_id) {
            ageIdx = s;
          }
        });

        //stack
        results.name = name;
        applyPseudoTrinityToResult(results, pseudoTrinity);
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = NaN;
        results.age_mid = rage.age.mid !== null ? rage.age.mid : NaN;
        results.age_upper = rage.age.upper !== null ? rage.age.upper : NaN;
        results.age_lower = rage.age.lower !== null ? rage.age.lower : NaN;
        results.age_source  = rage.age.source!== null ? rage.age.source: NaN;
        results.correlation_rank = 3;
        results.correlation_model_version = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = pseudoTrinity.index[0] !== null ? LCCore.projects[pseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "Converted from Age. The trinity and CD are pseudo data.";
        results.source_type = type;
        results.calc_type = "pseudo-depth";
      } else {
        results = null;
      }

      resultList.push(results);
    }

    if(showProgress && progressBar!==null){
      progressBar.close();
      progressBar = null;
    }

    return resultList;
  }
  
  function checkChanges(currentLCCore, beforeLCCore){
    let changedIds = [];
    beforeLCCore.projects.forEach((project,p)=>{
      project.holes.forEach((hole,h)=>{
        hole.sections.forEach((section,s)=>{
          const beforeId = section.id;
          const aidx = currentLCCore.search_idx_list[beforeId.toString()];
          if(aidx){
            const beforeHash  = JSON.stringify(section);
            const currentHash = JSON.stringify(currentLCCore.projects[aidx[0]].holes[aidx[1]].sections[aidx[2]]);
            if(beforeHash !== currentHash){
              changedIds.push(beforeId);
            }
          }else{
            //if undo delete
            changedIds.push(beforeId);
          }
        })
      })
    })
    
    return changedIds;
  }
  function initialiseLCCore(){
    let newLCCore = new LevelCompilerCore();

    //minor error
    newLCCore.on('error_minor', (err) => {   
      if(isShowMinorError){
        console.error('LCCore => '+ err.statusDetails);
        //window.webContents.send("AlertRenderer", err);
      }       
    });

    //alert error
    newLCCore.on('error_alert', (err) => {
      console.error('LCCore => '+ err.statusDetails);
      if (!suppressCoreAlertRenderer) {
        getMainWindow().webContents.send("AlertRenderer", err);
      }
    });

    //fatal error
    newLCCore.on('error_fatal', (err) => {
      console.error('LCCore => '+ err.statusDetails);
      getMainWindow().webContents.send("AlertRenderer", err);
      throw new Error('LCCore fatal error: ' + err.statusDetails); 
    });

    //depth update event
    newLCCore.on('update_depth', () => {
      LCAge.updateAgeDepth(newLCCore);
      newLCCore.calcMarkerAges(LCAge);
      LCPlot.calcDataCollectionPosition(newLCCore, LCAge);
    });  

    return newLCCore;
  }
  function initialiseDataPath(type){
    globalPath.dataPaths.filter(data => data.type !== type);
  }
  function initialiseLCPlotData(){
    let newLCPlot = new LevelCompilerPlot();
    newLCPlot.initialiseDataCollection();
    return newLCPlot;
  }
  function registerModelFromCsv(fullpath, type="forLC"){
    try {
      //register model
      const isLoad = LCCore.loadModelFromCsv(fullpath, type);
      if (isLoad !== true) {
        const modelState = LCCore?.getState?.();
        if (modelState?.status !== "error_alert") {
          notifyImportFormatError("correlation model", fullpath, modelState?.statusDetails);
        }
        return null;
      }
      history.setInitialState(LCCore.exportSerialisedModel());

      //register path
      globalPath.dataPaths.push({type:"csvmodel", path:fullpath});

      console.log('MAIN: Registered correlation model from "' + fullpath + '"' );
      return true
      
    } catch (error) {
      console.log(error);
      console.error("MAIN: Correlation model register error.");
      notifyImportFormatError("correlation model", fullpath, error);
      return null;
    }
  }
  function registerAgeFromCsv(fullpath, type="LC"){
    try{
      // loadAgeFromCsv
      const res = LCAge.loadAgeFromCsv(LCCore, fullpath, type);
      //apply latest age model to the depth model
      if(res===true){
        //register        
        globalPath.dataPaths.push({type:"csvage",path:fullpath});
        console.log("MAIN: Registered age model from " + fullpath);

        return true
      }else{
        notifyImportFormatError("age model", fullpath, res);
        console.error("MAIN: ",res);
      }
      
    }catch(err){
      console.log(err);
      notifyImportFormatError("age model", fullpath, err);
    }
  }
  function notifyImportFormatError(importType, fullpath, details = null) {
    const detailMessage = details instanceof Error
      ? details.message
      : typeof details === "string" && details.trim() !== ""
        ? details.trim()
        : null;
    const fileName = fullpath ? path.basename(fullpath) : "selected file";
    const article = /^[aeiou]/i.test(importType) ? "an" : "a";
    const expectedFormat = importType === "age model"
      ? "a Level-Compiler age model CSV with age columns such as age upper, age mid, and age lower"
      : "a Level-Compiler correlation model CSV";
    const messageLines = [
      `The selected file could not be loaded as ${article} ${importType}.`,
      `File: ${fileName}`,
      `Expected format: ${expectedFormat}.`,
      "Please choose a file with the correct format.",
    ];

    if (detailMessage) {
      messageLines.push(`Details: ${detailMessage}`);
    }

    getMainWindow().webContents.send("AlertRenderer", {
      status: "Unsupported File Format",
      statusDetails: messageLines.join("\n"),
    });
  }
  async function registerLCModel(fullpath){
    globalPath.dataPaths.push({type:"lcmodel",path:fullpath});

    //import data
    const inData = await loadmodelfile(getMainWindow(), fullpath);

    //register
    if(inData!==null){
      //register
      if(inData.LCCore!==null){
        LCCore.loadModelFromLcmodel(inData.LCCore);
        history.setInitialState(LCCore.exportSerialisedModel());
      } 
      if(inData.LCAge!==null){
        assignObject(LCAge, inData.LCAge);
      }

      //get age list
      let registeredAgeList = []; 
      for (let i = 0; i < LCAge.AgeModels.length; i++) {
        //make new collection
        const model_name = LCAge.AgeModels[i].name;
        const model_id = LCAge.AgeModels[i].id;
        registeredAgeList.push({ id: model_id, name: model_name});
      }

      console.log("MAIN: Registered correlation model from: "+ fullpath);
      return  registeredAgeList;
    }else{
      console.log("MAIN: Failed to register correlation model. There is no such a file.")
      return false
    }
  }

  function initialiseGlobalPath(){
    globalPath = {
      saveModelPath:null,
      dataPaths:[], //{type:[lcmodel, csvmodel, csvage, csvplot], path:""}
    };
  }
  function registerCoreImage(fullpath, type, name, metadata = {}){
    try{
      const sourceType = type === "core_images" ? "image_source" : type;
      const sourceId = metadata.sourceId ?? "source_1";
      const label = metadata.label ?? "Image 1";
      globalPath.dataPaths = globalPath.dataPaths.filter((item) => {
        if (item.type !== sourceType) {
          return true;
        }
        if (sourceType !== "image_source") {
          return !(item.path === fullpath && item.name === name);
        }
        return item.sourceId !== sourceId;
      });
      globalPath.dataPaths.push({
        type: sourceType,
        path: fullpath,
        name: name,
        sourceId,
        label,
      });
      console.log("MAIN: Core images in the folder is registered.")
      return true
    }catch(err){
      return false
    } 
  }
  function getRegisteredImageSources(type = "core_images", sourceId = null) {
    const acceptedTypes = new Set([type]);
    if (type === "core_images") {
      acceptedTypes.add("image_source");
    }
    return globalPath.dataPaths.filter((item) => {
      if (!acceptedTypes.has(item.type)) {
        return false;
      }
      if (sourceId == null) {
        return true;
      }
      const itemSourceId = item.sourceId ?? "source_1";
      return itemSourceId === sourceId;
    });
  }
  function getTierDpcm(loadOptions, imageBaseName) {
    const baseDpcm = loadOptions.dpcm;
    if (baseDpcm && typeof baseDpcm === "object" && !Array.isArray(baseDpcm)) {
      return baseDpcm;
    }

    const fallbackValue =
      typeof baseDpcm === "number"
        ? baseDpcm
        : loadOptions.tier === "thumb"
          ? 4
          : loadOptions.tier === "highres"
            ? 100
            : 24;

    return {
      [imageBaseName]: fallbackValue,
    };
  }
  //--------------------------------------------------------------------------------------------------
  getMainWindow().webContents.once("did-finish-load", () => {    
    const rendererSettings = getSettings("settingsRenderer");
      
    const tempMainSettings = getSettings("settingsMain");

    //check & apply main settings
    if(tempMainSettings){
      mainSettings = tempMainSettings;
      if("isAutoUpdateDownload" in mainSettings){
        const menu = Menu.getApplicationMenu();
        const item = menu.getMenuItemById("autoUpdateDownload");

        item.checked = mainSettings.isAutoUpdateDownload
      }
    }
    
    if (rendererSettings) {
      getMainWindow().webContents.send("SettingsData", rendererSettings);
    }
  });
  function buildMainMenu(){
    return [
      // for Mac ---------------------------------------------------------------------------------------
      ...(isMac
        ? [
            {
              label: app.name,
              submenu: [
                { label: "About", click: createAboutWindow },
                { type: "separator" },
                { role: "hide" },
                { role: "hideOthers" },
                { role: "unhide" },
                { type: "separator" },
                { label: "Preferences",
                  click: () => {
                    openSettingsWindow({
                      onReadyToShow: () => {
                        const data = {
                          output_type:"export",
                          called_from:"main",
                          path:null,
                        };
                        sendToMainWindow("SettingsMenuClicked", data);
                      },
                    });
                  },
                },
                { type: "separator" },
                { role: "quit" },
              ],
            },
          ]
        : []),
      // for common -----------------------------------------------------------------------------------
      {
        label: "File",
        submenu: [
          {
            label:"Load",
            submenu:[
              {
                label: "Load Correlation Model from lcmodel",
                accelerator: "CmdOrCtrl+M",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  const fullpath = await getfile(getMainWindow(), "Please chose Correlation model file", [{name: "LCmodel file", extensions: ["lcmodel"]}]);
                  await registerLCModel(fullpath);
                  getMainWindow().webContents.send("UpdateViewFromMain");                },
              },
              {
                label: "Load Correlation Model from csv",              
                click: async() => {
                  const fullpath = await getfile(getMainWindow(), "Please chose Correlation model CSV file", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    registerModelFromCsv(fullpath);
                    //calc
                    LCCore.calcCompositeDepth();
                    LCCore.calcEventFreeDepth();
                    getMainWindow().webContents.send("UpdateViewFromMain");
                  }
                },
              },
              { type: "separator" },
              {
                label: "Load Age model",
                click: async() => {
                  const fullpath = await getfile(getMainWindow(), "Please chose Age model CSV file", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log(fullpath)
                    //register
                    registerAgeFromCsv(fullpath);
                    getMainWindow().webContents.send("UpdateViewFromMain");
                  }
                },
              },
              {
                label: "Load Core Images",
                click: async() => {
                  const imageDir = await getDirectory(getMainWindow(), "Please select image root directory.")
                  if(imageDir!==false){
                    //register path
                    registerCoreImage(imageDir, "core_images", null, {
                      sourceId: "source_1",
                      label: "Image 1",
                    });

                    //load
                    let targetIds = [];                    
                    LCCore.projects.forEach(p=>{
                      p.holes.forEach(h=>{
                        h.sections.forEach(s=>{
                          targetIds.push(s.id);
                        })
                      })
                    });
                    const coreImages = await loadCoreImages({
                      targetIds:targetIds,
                      operations:["composite_depth","event_free_depth","age"],
                      dpcm:40,
                    },"core_images");

                    getMainWindow().webContents.send("LoadCoreImagesMenuClicked", coreImages);
                    //mainWindow.webContents.send("UpdateViewFromMain"); 
                  }
                },
              },
              { type: "separator" },      
              {
                label:"Reload",
                accelerator: "CmdOrCtrl+R",
                click: () =>{
                  if (isDev == false){
                    if(LCCore.base_project_id==null){
                      return
                    }
                  }

                  getMainWindow().webContents.send("ReloadMenuClicked", null);
                }
              },      
            ],
          },
          {
            label:"Import",
            submenu:[              
              {
                label: "Import Correlation Model for Level Finder",
                click: async() => {
                  const fullpath = await getfile(getMainWindow(), "Please Chose Correlation Model (fro LF)", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log("MAIN: Import correlation model for Level Finder from", fullpath)
                    registerModelFromCsv(fullpath, "forLF");
                    //calc
                    LCCore.calcCompositeDepth();
                    LCCore.calcEventFreeDepth();
                    getMainWindow().webContents.send("UpdateViewFromMain");
                    
                    //mainWindow.webContents.send("ImportCorrelationModelForLFMenuClicked");
                  }
                },
              },
              {
                label: "Import Event List for Level Finder",
                click: async() => {
                  const fullpath = await getfile(getMainWindow(), "Please Chose Event List (for LF))", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log("MAIN: Import event list for Level Finder from", fullpath)
                    LCCore.loadEventListFromCsv(fullpath);
                    getMainWindow().webContents.send("UpdateViewFromMain");                    
                    //mainWindow.webContents.send("ImportEventListForLFMenuClicked");
                  }
                },
              },
              {
                label: "Import Age Model for Level Finder",
                click: async() => {
                  const fullpath = await getfile(getMainWindow(), "Please chose Age model CSV file", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log(fullpath)
                    //register
                    registerAgeFromCsv(fullpath, "LF");
                    getMainWindow().webContents.send("UpdateViewFromMain");
                  }
                },
              },
            ]
          },
          {
            label:"Save",
            visible:isEditMode,
            submenu:[
              {
                label: "Save correlation model",
                accelerator: "CmdOrCtrl+S",
                click: async () => {
                  if(isEditMode){
                    //remove plot data
                    let outLCCore   = new LevelCompilerCore();
                    Object.assign(outLCCore, LCCore.exportSerialisedModel());
                    outLCCore.updateVersionInfo();

                    const outLCAge  = new LevelCompilerAge();
                    const outLCPlot = new LevelCompilerPlot();
                    
                    outLCCore.calcMarkerAges(outLCAge);//remove ages
  
                    const outData = {LCCore:outLCCore, LCAge:outLCAge, LCPlotAge:outLCPlot};
  
                    if(globalPath.saveModelPath == null){
                      //save as new file
                      const result = await putmodelfile(getMainWindow(), outData, null);
                      if(result){
                        globalPath.saveModelPath = result;
                        LCCore.updateVersionInfo();
                        history.saveState(LCCore.exportSerialisedModel(), "export lcmodel");
                      }                      
                    }else{
                      //save orverwrite
                      const result = await putmodelfile(getMainWindow(), outData, globalPath.saveModelPath);
                      if(result){
                        globalPath.saveModelPath = result;
                        LCCore.updateVersionInfo();
                        history.saveState(LCCore.exportSerialisedModel(), "export lcmodel");
                      }
                      
                    }
                  }                
                },
              },
              {
                label: "Save correlation model with ages",
                click: async () => {
                  if(isEditMode){
                    //remove plot data
                    let out_LCPlot = JSON.parse(JSON.stringify(LCPlot));
                    out_LCPlot.data_collections = [];
                    out_LCPlot.data_selected_id = null;

                    LCCore.updateVersionInfo();
                    let outLCCore   = new LevelCompilerCore();
                    Object.assign(outLCCore, LCCore.exportSerialisedModel());
  
                    const outData = {LCCore:outLCCore, LCAge:LCAge, LCPlotAge:out_LCPlot};
  
                    if(globalPath.saveModelPath == null){
                      //save as new file
                      globalPath.saveModelPath = await putmodelfile(getMainWindow(), outData, null);
                    }else{
                      //save orverwrite
                      globalPath.saveModelPath = await putmodelfile(getMainWindow(), outData, globalPath.saveModelPath);
                    }
                    history.saveState(LCCore.exportSerialisedModel(), "export lcmodel");
                  }                
                },
              },
              {
                label:"Save correlation As...",
                click: async () => {
                  if(isEditMode){
                    //remove plot data
                    let out_LCPlot = JSON.parse(JSON.stringify(LCPlot));
                    out_LCPlot.data_collections = [];
                    out_LCPlot.data_selected_id = null;

                    LCCore.updateVersionInfo();
                    let outLCCore   = new LevelCompilerCore();
                    Object.assign(outLCCore, LCCore.exportSerialisedModel());
  
                    const outData = {LCCore:outLCCore, LCAge:LCAge, LCPlotAge:out_LCPlot};
  
                    //save as new file
                    globalPath.saveModelPath = await putmodelfile(getMainWindow(), outData, null);
                    history.saveState(LCCore.exportSerialisedModel(), "export lcmodel");
                    
                  }                
                },              
              }
            ],
          },
          {
            label:"Export",
            visible:isEditMode,
            submenu:[
              {
                label: "Export csv model for Level Compiler",
                click: () => {
                  getMainWindow().webContents.send("ExportCorrelationAsLCMenuClicked");
                },
              },
              {
                label: "Export csv model for Level Finder",
                click: () => {
                  getMainWindow().webContents.send("ExportCorrelationAsLFMenuClicked");
                },
              },
              {
                label: "Export master section list",
                visible: true,
                click: async () => {
                  if(LCCore.projects.length > 0){
                    const targetProjects = LCCore.projects;
                    for(const project of targetProjects){
                      const msList = LCCore.getMasterPositionList(project.id);
                      const output = [
                        ["Master section", "Section top", "Section bottom", "Master top", "Master bottom"],
                        ...msList,
                      ];
                      console.log("LCCore: Export master section list", output)

                      const listName = project.name+" master section list("+project.correlation_version+").csv";
                      let safeName = String(listName)
                        .replace(/[\\/:*?"<>|]/g, "_")
                        .replace(/[\x00-\x1F\x7F]/g, "_")
                        .trim()
                        .replace(/[. ]+$/g, "");

                      await putcsvfile(getMainWindow(), safeName, output);
                    }
                    
                  }
                }
              },
            ],
          },                    
          // for Windows--------------------
          ...(!isMac
            ? [
                {
                  label: "Exit",
                  click: (menuItem, browserWindow, event) => {
                    const options = {
                      type: "question",
                      buttons: ["No", "Yes"],
                      defaultId: 0,
                      title: "Confirm",
                      message: "Are you sure you want to exit?",
                    };
  
                    const response = dialog.showMessageBoxSync(getMainWindow(), options);
  
                    if (response === 1) {
                      app.quit(); 
                    }
                  },
                },              
              ]
            : []),
        ],
      },
      ...(!isMac
        ? [
            {
              label:"Edit",
              submenu:[
                {
                  label: "Edit mode",
                  accelerator: "CmdOrCtrl+E",
                  click: () =>{
                      getMainWindow().webContents.send("EditCorrelation");
                  },
                },
                { type: "separator" },
                {
                  label: "Preferences",
                  click: () => {
                    openSettingsWindow({
                      onReadyToShow: () => {
                        const data = {
                          output_type:"export",
                          called_from:"main",
                          path:null,
                        };
                        sendToMainWindow("SettingsMenuClicked", data);
                      },
                    });
                  },
                },
                
              ],
            }
          ]
        : [
           {
              label:"Edit",
              submenu:[
                {
                  label: "Edit mode",
                  accelerator: "CmdOrCtrl+E",
                  click: () =>{
                    getMainWindow().webContents.send("EditCorrelation");
                  },
                },
              ]
            }
          ]
      ),
      {
        label: "Model",
        submenu:[
          {
            label: "Model info",
            click: () => {
              let text = null;
              if(LCCore !== null){
                text ="<Workspace>\n";
                text += "  [Name]:  " + LCCore.name + "\n" +
                        "  [Format]: " + LCCore.model_format_version + "\n" +
                        "  [Descriptions]:  " + LCCore.descriptions + "\n\n";

                LCCore.projects.forEach(project=>{
                  text += "<Correlation model>\n" +
                          "  [Name]: " + project.name + "\n" +
                          "    -[Version]: " + project.correlation_version + "\n" +
                          "    -[Type]: " + project.model_type + "\n" +
                          "    -[Descriptions]: " + project.descriptions + "\n\n"
                })
              };
              if(LCAge !== null){
                if(text == null){
                  text = "  <Age model>\n";
                }else{
                  text += "  <Age model>\n";
                }
                
                const ageModelId = LCAge.selected_id;
                LCAge.AgeModels.forEach(am=>{
                  if(am.id.toString() == ageModelId.toString()){
                    text += "    -[Name]: " + am.name + "\n" +
                            "    -[Version]: " + am.version + "\n";
                  }
                })
              }
               
              if(text !== null){
                dialog.showMessageBox(
                  getMainWindow(),
                  {
                  type: 'info',
                  title: 'Model versions',
                  message: text,
                  buttons: ['OK']
                });
              }              
            }
          },
          {
            label: "Model statistics",
            click: () => {
              if(LCCore !== null && LCCore.projects.length>0){
                results = LCCore.checkModel();

                const text = results.map((item, i) => {
                  const cdMean = item.cd_confliction.length ? mean(item.cd_confliction).toFixed(1) : NaN;
                  const cdMax  = item.cd_confliction.length ? Math.abs(item.cd_confliction.reduce((a, b) => Math.abs(a) > Math.abs(b) ? a : b)).toFixed(1) : NaN;
                  const cdMin  = item.cd_confliction.length ? Math.abs(item.cd_confliction.reduce((a, b) => Math.abs(a) < Math.abs(b) ? a : b)).toFixed(1) : NaN;
                  const efdMean = item.efd_confliction.length ? mean(item.efd_confliction).toFixed(1) : NaN;
                  const efdMax  = item.efd_confliction.length ? Math.abs(item.efd_confliction.reduce((a, b) => Math.abs(a) > Math.abs(b) ? a : b)).toFixed(1) : NaN;
                  const efdMin  = item.efd_confliction.length ? Math.abs(item.efd_confliction.reduce((a, b) => Math.abs(a) < Math.abs(b) ? a : b)).toFixed(1) : NaN;

                  const conn = Object.entries(item.connection_counts)
                    .map(([key, val]) => `  ${"     "+item.name +"->"+key}: ${val}`)
                    .join('\n');

                  return `<Name>: ${item.name}\n` +
                         `  -[Type]: ${item.type}\n` +
                         `  -[Master connection]: ${item.is_connected_master}\n` +
                         `  -[Hole]: ${item.hole_counts}\n` +
                         `  -[Section]: ${item.section_counts}\n` +
                         `  -[Marker]: ${item.marker_counts}\n` +
                         `  -[Connection]: \n${conn}\n` +

                         `  -[Distance errors (duplicate)]: ${item.distance_confliction_counts}\n` +
                         `  -[CD errors (failed)]: ${item.cd_error_incompleted_counts}\n` +
                         `  -[CD errors (floating)]: ${item.cd_error_floating_counts}\n` +
                         `  -[CD conflictions]: ${item.cd_confliction_counts}\n` +
                         `  -[CD conflictions (mean[abs])]: ${Number.isNaN(cdMean) ? '-' : `${cdMean} [ ${cdMax} - ${cdMin} ] cm`}\n` +
                         `  -[EFD errors (failed)]: ${item.efd_error_incompleted_counts}\n` +
                         `  -[EFD errors (floating)]: ${item.efd_error_floating_counts}\n` +
                         `  -[EFD conflictions (mean[abs])]: ${Number.isNaN(efdMean) ? '-' : `${efdMean} [ ${efdMax} - ${efdMin} ] cm`}\n` +
                         `  -[Age errors]: ${item.age_error_counts}\n` +
                         `  -[Age conflictions]: ${item.age_confliction_counts}\n` +
                         `  -[Max Rank]: ${item.max_rank}\n`+

                         `For more details, please check the log in the developer tools (F12).`
                }).join('\n');

                dialog.showMessageBox(
                  getMainWindow(),
                  {
                  type: 'info',
                  title: 'Model statistics',
                  detail:text,
                  buttons: ['OK']
                });
                getMainWindow().webContents.send("rendererLog", "Check results:");
                getMainWindow().webContents.send("rendererLog", results);
              }
            }
          },
          {
            label: "Leave-one-out evaluation",
            visible: isRootDeveloperMode(),
            click: async () => {
              if (!isRootDeveloperMode()) {
                dialog.showMessageBoxSync(getMainWindow(), {
                  type: "warning",
                  title: "Leave-one-out evaluation",
                  message: "Leave-one-out evaluation is available only in root mode.",
                  buttons: ["OK"],
                });
                return;
              }

              if(LCCore !== null && LCCore.projects.length>0){
                closeGlobalProgressBar();
                progressBar = progressDialog(getMainWindow(), "Leave-one-out evaluation", "Now evaluating...", false);
                if (progressBar && typeof progressBar.once === "function") {
                  await new Promise(resolve => progressBar.once("ready", resolve));
                }

                try {
                  const startedAt = Date.now();
                  let lastProgressUpdate = 0;
                  const results = await runLeaveOneOutInWorker("project", ({ done, total }) => {
                    const now = Date.now();
                    if (done >= total || now - lastProgressUpdate >= 100) {
                      progressBar = updateProgressWithEta(progressBar, done, total, startedAt, "Evaluating");
                      lastProgressUpdate = now;
                    }
                  });

                  progressBar = updateProgressWithEta(progressBar, 1, 1, startedAt, "Evaluating");
                  closeGlobalProgressBar();
                  
                  getMainWindow().webContents.send("rendererLog", results);
                  await putcsvfile(getMainWindow(), "leave-one-out-results.csv", results);
                } catch (err) {
                  closeGlobalProgressBar();
                  console.error("MAIN: Leave-one-out evaluation failed.", err);
                  dialog.showMessageBoxSync(getMainWindow(), {
                    type: "error",
                    title: "Leave-one-out evaluation",
                    message: "Leave-one-out evaluation failed.",
                    detail: err?.message ?? String(err),
                    buttons: ["OK"],
                  });
                }                
              }
            }
          },   
          { type: "separator" },   
          {
            label:"Zoom",
            submenu:[
              {
                label: "Zoomin",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  getMainWindow().webContents.send("ZoominMenuClicked");
                }
              },
              {
                label: "Zoom default",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  getMainWindow().webContents.send("ZoomdefaultMenuClicked");
                }
              },
              {
                label: "Zoomout",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  getMainWindow().webContents.send("ZoomoutMenuClicked");
                }
              },
              {
                label: "Zoom actual scale",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  getMainWindow().webContents.send("ZoomactualMenuClicked");
                }
              },
            ]
          },            
          { type: "separator" },
          {
            label: "Unload all models",
            accelerator: "CmdOrCtrl+W",
            click: () => {
              getMainWindow().webContents.send("UnLoadModelsMenuClicked");
            },
          }
        ],
      },      
      {
        label: "Tools",
        submenu: [
          {
            label: "Converter",
            accelerator: "CmdOrCtrl+K",
            click: () => {
              if (isDev == false){
                if(LCCore.base_project_id==null){
                  return
                }
              }
              openConverterWindow({
                onReadyToShow: (converterWindow) => {
                  converterWindow.focus();
                },
                onDidFinishLoad: () => {
                  const data = {
                    output_type:"export",
                    called_from:"main",
                    path:null,
                  };
                  sendToConverterWindow("ConverterMenuClicked", data);
                },
              });
            },
          },
          {
            label:"Divider",
            accelerator: "CmdOrCtrl+D",
            click: () =>{
              if (isDev == false){
                if(LCCore.base_project_id==null){
                  return
                }
              }
              if (dividerWindow) {
                dividerWindow.focus();
                return;
              }

              getMainWindow().webContents.send("DividerMenuClicked", null);
            }
          },
          {
            label: "Labeler",
            accelerator: "CmdOrCtrl+L",
            click: () => {
              if (hasLabelerWindow()) {
                getLabelerWindow().focus();
                return;
              }
          
              tempCore = initialiseLCCore();
              tempCore.addProject("correlation","temp");
              tempCore.addHole(tempCore.projects[0].id,"temp");
  
              //create finder window
              const labelerWindow = setLabelerWindow(createWindow(WINDOW_TYPES.LABELER));
              
              //converterWindow.setAlwaysOnTop(true, "normal");
              labelerWindow.on("closed", () => {
                clearLabelerWindow();
                tempCore = null;
                sendToMainWindow("LabelerClosed", "");
              });
              labelerWindow.once("ready-to-show", () => {
                labelerWindow.show();
                //labelerWindow.setAlwaysOnTop(true, "normal");
                //labelerWindow.webContents.openDevTools();
                //converterWindow.setAlwaysOnTop(true, "normal");
                sendToLabelerWindow("LabelerMenuClicked");
              });
            },
          },
          {
            label: "Plotter",
            accelerator: "CmdOrCtrl+P",
            click: () => {
              if (isDev == false){
                if(LCCore.base_project_id==null){
                  return
                }
              }
              if (hasPlotterWindow()) {
                getPlotterWindow().show();
                getPlotterWindow().focus();
                return;
              }
          
              isPlotterClose = false;

              //create finder window
              const plotWindow = setPlotterWindow(createWindow(WINDOW_TYPES.PLOTTER, {
                browserWindowOptions: {
                  parent: getMainWindow(),
                },
              }));
              
              plotWindow.on("close", (e) => {
                if(isPlotterClose){
                  return;
                }
                
                e.preventDefault(); 
                
                plotWindow.hide();
                //plotWindow = null;
                sendToMainWindow("PlotterHide", ""); 
              });
              plotWindow.on("closed", () => {
                clearPlotterWindow(); 
                sendToMainWindow("PlotterClosed", "");
              });

              const customMenu = Menu.buildFromTemplate([
                  {
                    label: "Release loaded data",
                    click: () => {
                      sendToPlotterWindow("PlotterCleared", "");  
                    },
                  }
                  /*,
                  { type: "separator" },
                  {
                    label:"Export",
                    click: ()=>{
                      plotWindow.webContents.send("PlotterExport", "");
                    }
                  }
                  */
                ]);

              //plotWindow.setMenu(customMenu);
              plotWindow.setMenu(null);
              plotWindow.webContents.on('context-menu', (_event, params) => {
                customMenu.popup({ window: plotWindow, x: params.x, y: params.y });
              });
          
              let isData = false;
              if(LCPlot.data_collections.length>0){
                //plot data exost
                isData = true;
              }
          
              plotWindow.once("ready-to-show", () => {
                plotWindow.show();
                //plotWindow.setAlwaysOnTop(true, "floating");
                //plotWindow.webContents.openDevTools();
                sendToPlotterWindow("PlotterMenuClicked", isData);
              });
            },
          },
          { type: "separator" },   
          {
            label:"Sub-tools",
            submenu:[
              {
                label: "Snapshot(Shift: Full)",
                click: async (menuItem, browserWindow, event) => {

                  const isShift = event.shiftKey;

                  getMainWindow().webContents.send("SnapshotMenuClicked", {
                    isShift: isShift
                  });
                }
              },
              {
                label: "Measure",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  getMainWindow().webContents.send("MeasureMenuClicked");
                }
              }
            ]
          },          
          { type: "separator" },
          {
            label: "Developer tool",
            click: () => {
              if (getMainWindow().webContents.isDevToolsOpened()) {
                getMainWindow().webContents.closeDevTools();
              } else {
                getMainWindow().webContents.openDevTools();
              }
              //mainWindow.webContents.openDevTools();
            },
          },
        ],
      },
      // for windows ----------------------------------------------------------------------------------
      ...(!isMac
        ? [
            {
              label: "Help",
              submenu: [
                { label: "About", click: createAboutWindow },
                { label: "Check update", click: async()=>{await checkUpdate(getMainWindow(), "button")}},
                { 
                  id: "autoUpdateDownload",
                  label: "Auto update download",
                  type: "checkbox",
                  checked: true,
                  click: (menuItem) => {
                    mainSettings.isAutoUpdateDownload = menuItem.checked;
                    setSettings("settingsMain", mainSettings);
                  }
                },
                { label: "Usage", click: ()=>{shell.openExternal('https://www.youtube.com/playlist?list=PLraahvJ2B_L7ClUMTZNnz7Fs3swqovV4y')} },
              ],
            },
          ]
        : [
            {
              label: "Help",
              submenu: [
                { label: "Check update", click: async()=>{await checkUpdate(getMainWindow(), "button")}},
                { 
                  id: "autoUpdateDownload",
                  label: "Auto update download",
                  type: "checkbox",
                  checked: true,
                  click: (menuItem) => {
                    mainSettings.isAutoUpdateDownload = menuItem.checked;
                    setSettings("settingsMain", mainSettings);
                  }
                },
                { label: "Usage", click: ()=>{shell.openExternal('https://www.youtube.com/playlist?list=PLraahvJ2B_L7ClUMTZNnz7Fs3swqovV4y')} },
              ],
            },
          ]),
      // others
    ];
  }
  function menuRebuild() {
    const lcmenu = buildMainMenu();
    let mainMenu = Menu.buildFromTemplate(lcmenu);
    Menu.setApplicationMenu(mainMenu);
  }
}
//===================================================================================================================================
//===================================================================================================================================

//--------------------------------------------------------------------------------------------------
/*
function progressDialog(window, tit, txt, indeterminate){
  let progress = new ProgressBar({
    title: tit,
    icon: "./icon/levelcompiler.png",
    indeterminate: indeterminate,
    text: txt,
    detail: "Please wait...",
    browserWindow: {
      parent: window,
      modal: false,
      resizable: true,
      sandbox: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    },
    closeOnComplete:true,
  });
  
  return progress;
}
*/
function progressDialog(window, tit, txt, indeterminate){
  let progress = new ProgressBar({
    title: tit,
    icon: "./icon/levelcompiler.png",
    indeterminate: indeterminate,
    text: txt,
    detail: "Please wait...",
    browserWindow: {
      parent: window,
      modal: false,
      resizable: true,
      closable: false,
      sandbox: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    },
    closeOnComplete:true,
  });

  // ---- normalize event API (on/once/off) ----
  if (typeof progress.off !== "function") {
    if (typeof progress.removeListener === "function") {
      progress.off = progress.removeListener.bind(progress);
    } else if (typeof progress.removeEventListener === "function") {
      progress.off = progress.removeEventListener.bind(progress);
    }
  }

  if (typeof progress.once !== "function" && typeof progress.on === "function") {
    progress.once = function (event, listener) {
      const wrapped = (...args) => {
        if (typeof this.off === "function") this.off(event, wrapped);
        listener(...args);
      };
      this.on(event, wrapped);
      
      return this;
    };
  }
  // ------------------------------------------
  //for debug
  /*
  progress.on("completed", () => console.log("ProgressBar: completed"));
  progress.on("aborted",   () => console.log("ProgressBar: aborted"));
  
  if (typeof progress.close === "function") {
    const _close = progress.close.bind(progress);
    progress.close = (...args) => {
      console.trace("ProgressBar.close() called");
      return _close(...args);
    };
  }
    */
  return progress;
}

function formatEta(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    return "--:--";
  }

  const totalSeconds = Math.ceil(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function updateProgressWithEta(progress, n, N, startedAt, label = "Please wait") {
  if (!progress) {
    return null;
  }

  const total = Math.max(Number(N) || 0, 1);
  const current = Math.min(Math.max(Number(n) || 0, 0), total);
  const pct = (current / total) * 100;
  const elapsed = Date.now() - startedAt;
  const eta = current > 0 && current < total
    ? formatEta((elapsed / current) * (total - current))
    : "0:00";

  try {
    const winOk = progress._window && progress._window.webContents && !progress._window.isDestroyed();
    if (!winOk || progress.isCompleted()) {
      return null;
    }

    progress.value = pct;
    progress.detail = `${label} ${current}/${total} (${lcfnc.round(pct, 2)}%)  ETA ${eta}`;
    return progress;
  } catch (err) {
    console.error("MAIN: Failed to update ETA progressbar.", err);
    return null;
  }
}

function runLeaveOneOutInWorker(target, onProgress) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "main", "leave-one-out-worker.js"), {
      workerData: {
        model: LCCore.exportSerialisedModel(),
        target,
      },
    });

    worker.on("message", (message) => {
      if (message?.type === "progress") {
        if (typeof onProgress === "function") {
          onProgress({
            done: message.done,
            total: message.total,
          });
        }
        return;
      }

      if (message?.type === "done") {
        resolve(message.results);
        return;
      }

      if (message?.type === "error") {
        const err = new Error(message.message);
        err.stack = message.stack ?? err.stack;
        reject(err);
      }
    });

    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Leave-one-out worker exited with code ${code}.`));
      }
    });
  });
}

async function updateProgress(progress, n, N){
  if (!progress) return null;

  const now = Date.now();
  if (n < N && progress._lastUpdate && now - progress._lastUpdate < 100) {
    return progress;
  }
  progress._lastUpdate = now;

  try{
    const w = progress._window;
    if (w && !w.isDestroyed()){
      if (w.isMinimized && w.isMinimized()) w.restore();
      if (w.isVisible  && !w.isVisible())  w.show();
    }
  }catch(e){}

  const winOk = progress._window && progress._window.webContents && !progress._window.isDestroyed();

  if (!winOk || progress.isCompleted()) {
    return null;
  }

  try {
    const pct = (n / N) * 100;
    progress.value = pct;
    progress.detail = "Please wait..." + n + "/" + N + "  (" + lcfnc.round(pct, 2) + "%)";

    await new Promise(resolve => setTimeout(resolve, 0));

    if (n >= N) {
      return closeProgress(progress);
    }

    return progress;
  } catch (err) {
    console.error("MAIN: In progressbar", err);
    try {
      if (progress && progress._window && !progress._window.isDestroyed()) {
        progress.close();
      }
    } catch (e) { /* ignore */ }
    return null;
  }
}

async function getfile(window=null, title, ext) {
  const options = {
    title: title,
    filters: ext,
    properties: ["openFile"],
  };

  if (process.env.LC_E2E === "1" && e2eOpenDialogResponse.file !== null) {
    return e2eOpenDialogResponse.file;
  }

  try {
    const result = await dialog.showOpenDialog(window, options);
    if (!result.canceled) {
      return result.filePaths[0];
    }
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function zipData(data) {
  try {
    const v = new Uint8Array(data);
    if (v[0] === 0x1f && v[1] === 0x8b && v[2] === 0x08) {
      return data; // if gzip
    }
  } catch {}

  return new Promise((resolve, reject) => {
    console.time("zipped");

    let inputData;
    try {
      // MessagePack encode
      console.time("encode");
      inputData = encode(data); // Uint8Array
      console.timeEnd("encode");
    } catch (serializeError) {
      console.error("[zipData] msgpack encoding failed:", serializeError);
      getMainWindow().webContents.send("AlertRenderer", serializeError);
      reject(serializeError);
      return;
    }

    //const buf = Buffer.from(inputData); // Uint8Array → Buffer
    const buf = Buffer.from(
      inputData.buffer,
      inputData.byteOffset,
      inputData.byteLength
    );

    const gzipOptions = { 
      level: zlib.constants.Z_BEST_SPEED,//Z_BEST_COMPRESSION, 
      strategy: zlib.constants.Z_RLE,
      memLevel: 9 
    };

    console.time("gzip");
    zlib.gzip(buf, gzipOptions, (err, buffer) => {
    //zlib.gzip(buf, (err, buffer) => {
      if (err) {
        console.error("[zipData] Gzip compression failed:", err);
        getMainWindow().webContents.send("AlertRenderer", err);
        reject(err);
      } else {
        console.timeEnd("zipped");
        resolve(buffer);
      }
    });
    console.timeEnd("gzip");
  });
}

async function unzipData(buffer) {
  // Guard: Return null if buffer is empty
  if (!buffer || buffer.length === 0) return null;

  if (!Buffer.isBuffer(buffer) && !(buffer instanceof Uint8Array)) {
    if (typeof buffer !== 'string') {
      return buffer; 
    }
  }

  console.time("unzipped");

  const v = new Uint8Array(buffer);
  // Check Gzip magic numbers (1F 8B 08) to detect if it is compressed
  const isGzip = v[0] === 0x1f && v[1] === 0x8b && v[2] === 0x08;

  let buf;
  if (isGzip) {
    // 1. Decompress Gzip
    try {
      buf = await new Promise((resolve, reject) => {
        // console.time("unzipped");
        zlib.gunzip(buffer, (err, decompressed) => {
          if (err) {
            console.error("[unzipData] Gzip decompression failed:", err);
            reject(err);
          } else {
            // console.timeEnd("unzipped");
            resolve(decompressed);
          }
        });
      });
    } catch (e) {
      // Return original buffer or null on decompression failure
      console.timeEnd("unzipped");
      return buffer; 
    }
  } else {
    // Use the buffer as is if not compressed
    buf = Buffer.from(buffer);
  }

  // 2. Try decoding as MessagePack
  try {
    const u8 = new Uint8Array(buf);
    console.timeEnd("unzipped");
    return decode(u8);
  } catch (e) {
    // Failed to decode as MessagePack; proceed to fallback
  }

  // 3. Try parsing as JSON (Fallback)
  const str = buf.toString('utf-8');
  try {
    console.timeEnd("unzipped");
    return JSON.parse(str);
  } catch (e) {
    // Failed to parse as JSON
  }

  // 4. Return as plain string (Final fallback)
  console.timeEnd("unzipped");
  return str;
}

/*
async function zipData(data) {
  console.time("zipped");
  return new Promise((resolve, reject) => {
    const gz = zlib.createGzip({ level: 1, chunkSize: 1<<20, memLevel: 9 });
    const out = [];
    gz.on('data', c => out.push(c));
    gz.on('end', () => { console.timeEnd("zipped"); resolve(Buffer.concat(out)); });
    gz.on('error', reject);

    // 直接圧縮できる型は即終了
    if (Buffer.isBuffer(data)) { gz.end(data); return; }
    if (typeof data === 'string') { gz.end(Buffer.from(data, 'utf8')); return; }

    const FLUSH = 256 * 1024; // 256KB
    let sb = '';
    const flush = () => { if (sb.length) { gz.write(Buffer.from(sb, 'utf8')); sb = ''; } };
    const write = (s) => { sb += s; if (sb.length >= FLUSH) flush(); };

    // 循環検出（不要ならコメントアウト）
    const seen = new WeakSet();

    const dump = (v) => {
      if (v === null || typeof v !== 'object') { write(JSON.stringify(v)); return; }
      if (seen.has(v)) { write(JSON.stringify('[Circular]')); return; }
      seen.add(v);

      if (Array.isArray(v)) {
        write('[');
        for (let i=0;i<v.length;i++){ if(i) write(','); dump(v[i]); }
        write(']');
      } else {
        write('{');
        const keys = Object.keys(v);
        for (let i=0;i<keys.length;i++){
          if(i) write(',');
          const k = keys[i];
          write(JSON.stringify(k)+':');
          dump(v[k]);
        }
        write('}');
      }
    };

    try { dump(data); flush(); gz.end(); } catch (e) { reject(e); }
  });
}
*/

function cvt2flat(depthConverterDataList){
  const flatData = {
    id: null,
    name: null,
    correlation_model_version:null,
    age_model_version: null,
    descriptions: null,
    
    header: [],
    units: [],
    rows: [],
  };

  //initialise
  flatData.id   = null;
  flatData.name = null;
  flatData.correlation_model_version = depthConverterDataList[0].correlation_model_version;
  flatData.age_model_version         = depthConverterDataList[0].age_model_version;
  flatData.descriptions              = "";
  
  const dataHeader = depthConverterDataList[0].data_header;
  flatData.header  = ["id","name","project","hole","section","position","composite_depth","event_free_depth","drilling_depth","age","age_upper","age_lower", "source_depth_type",...dataHeader];
  const dataUnits  = depthConverterDataList[0].data_units;
  flatData.units   = ["","","","","","","","","","","","","",...dataUnits];

  //data
  for(let r=0; r<depthConverterDataList.length; r++){
    const dt = depthConverterDataList[r];
    const row = [
      r,
      dt.name,
      dt.project,
      dt.hole,
      dt.section,
      dt.distance,
      dt.cd,
      dt.efd,
      dt.dd,
      dt.age_mid,
      dt.age_upper,
      dt.age_lower,
      dt.source_type,
      ...dt.data_values//spread
    ];

    flatData.rows.push(row);
  }

  //unit

  return flatData;
}

//--------------------------------------------------------------------------------------------------
async function getDirectory(window=null, title) {
  const options = {
    title: title,
    properties: ["openDirectory"], 
  };

  if (process.env.LC_E2E === "1" && e2eOpenDialogResponse.folder !== null) {
    return e2eOpenDialogResponse.folder;
  }

  try {
    const result = await dialog.showOpenDialog(window, options);
    if (!result.canceled) {
      return result.filePaths[0]; 
    }
    return null; 
  } catch (err) {
    console.log(err);
    return null;
  }
}
// Search a file inside a directory or zip (supports nested zip)
// type: "check" -> return boolean, "get" -> return path info
async function findFileInDir(in_path, fileName, type) {

  // Internal cache stored on the function object to avoid global variables
  if (!findFileInDir._cache) {
    findFileInDir._cache = {
      zipIndex: new Map(), // cache for zip file indexes
      result: new Map()    // cache for search results
    };
  }

  // Unique cache key for the search
  const cacheKey = `${String(in_path)}::${fileName}`;
  let found = null;

  // If result already cached, reuse it
  if (findFileInDir._cache.result.has(cacheKey)) {
    found = findFileInDir._cache.result.get(cacheKey);
  } else {

    // ------------------------------------------------------------
    // Recursive search inside a zip object (supports nested zips)
    // ------------------------------------------------------------
    async function searchZip(zipObj, rootZipPath, parentInnerPath) {

      // Unique key representing this zip layer
      const zipKey = `${rootZipPath}::${parentInnerPath || ""}`;
      let zipIndex = findFileInDir._cache.zipIndex.get(zipKey);

      // Build index (basename -> full inner path) if not cached
      if (!zipIndex) {
        zipIndex = new Map();

        for (const name in zipObj.files) {
          const entry = zipObj.files[name];
          if (entry.dir) continue; // ignore directories

          const base = path.basename(name);
          if (!zipIndex.has(base)) {
            zipIndex.set(base, name);
          }
        }

        findFileInDir._cache.zipIndex.set(zipKey, zipIndex);
      }

      // Fast lookup using basename index
      if (zipIndex.has(fileName)) {
        const innerPath = zipIndex.get(fileName);

        return {
          zipPath: rootZipPath,
          innerPath: parentInnerPath
            ? `${parentInnerPath}::${innerPath}`
            : innerPath
        };
      }

      // Scan for nested zip files
      for (const name in zipObj.files) {
        const entry = zipObj.files[name];
        if (entry.dir) continue;

        // Only process nested zip files
        if (path.extname(name).toLowerCase() !== ".zip") continue;

        const nestedPath = parentInnerPath
          ? `${parentInnerPath}::${name}`
          : name;

        const nestedKey = `${rootZipPath}::${nestedPath}`;

        // Cache nested zip object to avoid repeated decompression
        let nestedZip = findFileInDir._cache.zipIndex.get(`${nestedKey}::__zipobj__`);

        if (!nestedZip) {
          const nestedBuffer = await entry.async("nodebuffer");
          nestedZip = await JSZip.loadAsync(nestedBuffer);

          findFileInDir._cache.zipIndex.set(`${nestedKey}::__zipobj__`, nestedZip);
        }

        // Recursive search inside nested zip
        const res = await searchZip(nestedZip, rootZipPath, nestedPath);
        if (res) return res;
      }

      return null;
    }

    // ------------------------------------------------------------
    // Case 1: input path is a zip file
    // ------------------------------------------------------------
    if (typeof in_path === "string" && in_path.endsWith(".zip")) {

      // Cache the root zip object
      let rootZip = findFileInDir._cache.zipIndex.get(`${in_path}::__rootzip__`);

      if (!rootZip) {
        const zipBuffer = await fs.promises.readFile(in_path);
        rootZip = await JSZip.loadAsync(zipBuffer);

        findFileInDir._cache.zipIndex.set(`${in_path}::__rootzip__`, rootZip);
      }

      // Search inside the zip (including nested zips)
      found = await searchZip(rootZip, in_path, "");

    } else {

      // ------------------------------------------------------------
      // Case 2: input path is a directory
      // ------------------------------------------------------------

      let dir = "";

      // Normalize path input
      if (typeof in_path === "string") {
        dir = in_path;
      } else {
        const pathData = path.parse(in_path);
        dir = path.join(pathData.dir, pathData.name);
      }

      // Read directory entries (Dirent avoids extra stat calls)
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      // First pass: search direct files
      for (const entry of entries) {

        if (entry.isFile()) {

          // Direct file match
          if (entry.name === fileName) {
            found = path.join(dir, entry.name);
            break;
          }

          // If a zip file is found, search inside it
          if (path.extname(entry.name).toLowerCase() === ".zip") {

            const zipPath = path.join(dir, entry.name);

            const res = await findFileInDir(zipPath, fileName, "get");

            if (res) {
              found = res;
              break;
            }
          }
        }
      }

      // Second pass: search subdirectories recursively
      if (!found) {

        for (const entry of entries) {

          if (!entry.isDirectory()) continue;

          const filePath = path.join(dir, entry.name);

          const res = await findFileInDir(filePath, fileName, "get");

          if (res) {
            found = res;
            break;
          }
        }
      }
    }

    // Store search result in cache
    findFileInDir._cache.result.set(cacheKey, found);
  }

  // Return according to requested type
  if (type === "check") {
    return found !== null;
  }

  if (type === "get") {
    return found;
  }

  return false;
}


//--------------------------------------------------------------------------------------------------
async function putcsvfile(window = null, filePath, data) {
  try {
    const { canceled, filePath: savePath } = await dialog.showSaveDialog(
      window,
      {
        title: "Please select save path",
        defaultPath: filePath !== null ? filePath : app.getPath("desktop"),
        buttonLabel: "Save",
        filters: [{ name: "Csv Files", extensions: ["csv"] }],
      }
    );

    if (canceled || !savePath) {
      return { ok: false, reason: "canceled" };
    }

    const overwritten = fs.existsSync(savePath); // 上書きか新規かを判定
    const csv = stringify(data, { record_delimiter: "\r\n" });
    fs.writeFileSync(savePath, csv);

    return { ok: true, filePath: savePath, overwritten };
  } catch (err) {
    dialog.showMessageBoxSync(window, {
      type: "error",
      buttons: ["OK"],
      title: "Info",
      message: "Failed to save file.",
      detail: err.message,
    });
    console.error(err);
    return { ok: false, reason: "error", error: err };
  }
}

//--------------------------------------------------------------------------------------------------
async function putmodelfile(window, data, path) {
  try{
    //get save path
    let filePath = null;
    if(path == null){
      const file = await dialog.showSaveDialog(
        window,
        {
        title: "Please select save path",
        defaultPath: app.getPath("desktop"),
        buttonLabel: "Save",
        filters: [{ name: "Level Compiler model", extensions: ["lcmodel"] }],
      })

      if (!file.canceled && file.filePath) {
        filePath = file.filePath;
      }else{
        return false
      }
    }else{
      filePath = path;
    }

    //save main
    if(filePath !== null){
      const saveAsZip = true;
      if(saveAsZip == true){
        const zip = new JSZip();
          zip.file('lcmodel.json', JSON.stringify(data, null, 2), { compression: 'DEFLATE' });
          const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

          fs.writeFileSync(filePath, zipContent);

          console.log('MAIN: LC model is saved.');

      }else{
        //convert array --> csv
        const saveData = JSON.stringify(data);
        fs.writeFileSync(filePath,saveData);
      }
    }   
    
    dialog.showMessageBox(
      window,
      {
      type: 'info',
      title: 'Saved',
      message: `The correlation model was saved successfully.`,
      buttons: ['OK']
    }).catch((err) => {
      console.error('Error displaying message box:', err);
      dialog.showMessageBox(
        window,
        {
      type: 'info',
      title: 'No Saved',
      message: 'Error displaying message box:', err,
      });
    });
    return filePath;
  }catch(err) {
      console.log(err);
      dialog.showMessageBox(
        window,
        {
      type: 'info',
      title: 'Saved',
      message: `Failed to save the correlation model.` + err,
      buttons: ['OK']
    }).catch((err) => {
      console.error('Error displaying message box:', err);
      dialog.showMessageBox(
        window,
        {
      type: 'info',
      title: 'No Saved',
      message: 'Error displaying message box:', err,
      });
    });
  };
}
//--------------------------------------------------------------------------------------------------
async function loadmodelfile(window, ...args) {
  try{
    //get file path
    let filepath = null;
    if(args.length == 0){
      //cane no path
      const file = await dialog.showOpenDialog(
        window,
        {
        title: "Please select file to load",
        defaultPath: app.getPath("desktop"),
        buttonLabel: "Load",
        filters: [{ name: "Level Compiler model", extensions: ["lcmodel"] }],
        properties: ['openFile']
      });
      if (!file.canceled && file.filePaths[0]) {
        filepath = file.filePaths[0];
      }
    }else if(args.length == 1){
      //case input path
      filepath = args[0];
    }
    
    //load from file
    if (filepath !== null) {
      if(isZipFile(filepath)){
        //if Zip compressed
        const zipData = fs.readFileSync(filepath);
        const zip = await JSZip.loadAsync(zipData);
        const file = zip.file("lcmodel.json");//get file in zip
        if (!file) {
          console.log("MAIN: There is no LC model data in the file.");
          return null
        }
        const content = await file.async('string');
        const loadedData = JSON.parse(content);
        console.log('File loaded successfully:');//, loadedData);
        return loadedData;
      }else{
        const fileContent = fs.readFileSync(filepath, 'utf8');
        const loadedData = JSON.parse(fileContent);
        console.log('File loaded successfully:');//, loadedData);
        return loadedData;
      }
    }
  }catch(err){
    console.error('Error loading file:', err);
    return null;
  }

}
function isZipFile(filepath) {
  const fileBuffer = fs.readFileSync(filepath);
  return (
      fileBuffer[0] === 0x50 &&
      fileBuffer[1] === 0x4B &&
      fileBuffer[2] === 0x03 &&
      fileBuffer[3] === 0x04
  );
}

function mean(arr, useAbs = false) {
  return arr.reduce((a, b) => a + (useAbs ? Math.abs(b) : b), 0) / arr.length;
}
//--------------------------------------------------------------------------------------------------
//create about window
function createAboutWindow() {
  if (hasAboutWindow()) {
    const aboutWindow = getAboutWindow();
    aboutWindow.focus();
    return aboutWindow;
  }

  const aboutWindow = setAboutWindow(createWindow(WINDOW_TYPES.ABOUT, {
    browserWindowOptions: {
      parent: getMainWindow(),
    },
  }));
  const sendVersion = () => {
    aboutWindow.webContents.send("Version", app.getVersion());
  };

  aboutWindow.on("closed", () => {
    clearAboutWindow();
  });

  aboutWindow.once("ready-to-show", () => {
    aboutWindow.show();
    //aboutWindow.setAlwaysOnTop(true, "floating");
    //aboutWindow.webContents.openDevTools();
    //converterWindow.setAlwaysOnTop(true, "normal");
  });

  if (aboutWindow.webContents.isLoadingMainFrame()) {
    aboutWindow.webContents.once("did-finish-load", sendVersion);
  } else {
    sendVersion();
  }

  return aboutWindow;
}
function assignObject (obj,data){
  //assign without event listener
  Object.keys(data || {}).forEach(key => {
    if (!key.startsWith('_')) {
        obj[key] = data[key];
    }
  });
}
async function checkUpdate(window, from){
  if (process.env.LC_E2E === "1") {
    return;
  }
  //this process does not work in MSI app.
  //check update in the github
  autoUpdater.allowPrerelease = false;
  autoUpdater.autoDownload = false
  autoUpdater.forceDevUpdateConfig = true;
  let currentDownload = "";
  
  window.webContents.send("footerLeft", "Checking the latest version...");  

  autoUpdater.on('update-available', async(info) => {
    if(mainSettings.isAutoUpdateDownload === true){
      console.log("MAIN: Auto updater is running.")
      //auto download
      try {
        currentDownload = info.version;

        await autoUpdater.downloadUpdate();
        
        window.webContents.send("footerLeft", `A new version is available.`);
      } catch (err) {
        console.error("Full download failed:", err);
        dialog.showMessageBox(window, {
          type: "error",
          title: "Download Failed",
          message: "Could not download the full update. Would you like to get it manually?",
          buttons: ["Download", "Cancel"],
          defaultId: 1, 
          cancelId: 1,
        }).then((result) => {
          if (result.response === 0) {
            shell.openExternal("https://github.com/keitaroyamada/Level-Compiler/releases/latest");
          }
        });
      } 
    }else{
      console.log("MAIN: Manual updater is running.")
      //manually
      dialog.showMessageBox(
        window,
        {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available. Would you like to get the new version?`,
        buttons: ['Get', 'Cancel']
      }).then((result) => {
        if (result.response === 0) {
          shell.openExternal('https://github.com/keitaroyamada/Level-Compiler/releases');
        } else {
          console.log('User canceled.');
        }
      }).catch((err) => {
        console.error('Error displaying message box:', err);
        dialog.showMessageBox(
          window,
          {
        type: 'info',
        title: 'No Updates',
        message: 'Error displaying message box:', err,
      });
      });
    }
       
  }); 

  autoUpdater.on("update-downloaded", (info) => {
    window.webContents.send("footerLeft", `Version ${info.version} has been downloaded.`);
    dialog.showMessageBox(window, {
      type: "info",
      title: "Update Ready",
      message: `Version ${info.version} has been downloaded. Install and restart now?`,
      buttons: ["Install", "Later"],
      defaultId: 1,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
      window.webContents.send("footerLeft", "");
    }).catch((err) => {
      console.error("Error displaying install dialog:", err);
      window.webContents.send("footerLeft", "Error displaying install dialog.");
    });
  });

  autoUpdater.on("download-progress", (progressObj) => {
    const logMsg = `New downloading version ${currentDownload} - ${Math.round(progressObj.percent)}%`;
    console.log(logMsg);
    window.webContents.send("footerLeft", logMsg);
  });


  autoUpdater.on("error", (err) => {
    getMainWindow().webContents.send("rendererLog", err);
    if (from === "button") {
      dialog.showMessageBox(window, {
        type: "error",
        title: "Update Error",
        message: `An error occurred: ${err.message}`,
      });
      window.webContents.send("footerLeft", "An error occured in auto updater.");
    }
    
  });

  autoUpdater.on('update-not-available', () => {
    if (from == "button"){
      dialog.showMessageBox(
        window,
        {
      type: 'info',
      title: 'No Updates Available',
      message: 'You are already using the latest version.',
    });
    }  
    window.webContents.send("footerLeft", "The latest version is already installed.");  
  });
  
  await autoUpdater.checkForUpdates();
}
//--------------------------------------------------------------------------------------------------
function getSettings(type){
  let LCSettingData = null;
  let settingPath ;
  if(type == "settingsRenderer"){
    if(fs.existsSync(path.join(app.getPath('userData'), "mainsettings.json"))){
      //new version
      settingPath = path.join(app.getPath('userData'), "viewsettings.json");
    }else{
      //legacy version (<1.1.1)
      settingPath = path.join(app.getPath('userData'), "lcsettings.json");
      console.log("MAIN: Restore v1.1.1 settings")

      /*
      //must be use async
      dialog.showMessageBox(mainWindow, {
        type: "question",
        title: "Enable Auto Update",
        message: "A new version now supports automatic updates.\nYou can change this setting anytime from the Help menu.\n\nWould you like to enable auto update? (Recommended)",
        buttons: ["Enable", "Not Now"],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      }).then((result) => {
        if (result.response === 0) {
          mainSettings.isAutoUpdateDownload = true;
          console.log("Auto update enabled.");
        } else {
          mainSettings.isAutoUpdateDownload = false;
          console.log("Auto update not enabled.");
        }
        setSettings("settingsMain", mainSettings);
      });
      */
    }
  }if(type == "settingsMain"){
    settingPath = path.join(app.getPath('userData'), "mainsettings.json");
  }else if(type == "bookmarks"){
    settingPath = path.join(app.getPath('userData'), "lcbookmarks.json");
  }

  if(fs.existsSync(settingPath)){
    const settingsData = JSON.parse(fs.readFileSync(settingPath, 'utf-8'));
    LCSettingData = settingsData;
       
    console.log("MAIN: Restore settings")
  }else{
    console.log("MAIN: There is no setting data.")
  }

  return LCSettingData;
}
function setSettings(type, data){
  let settingPath ;
  if(type == "settingsRenderer"){
    settingPath = path.join(app.getPath('userData'), "viewsettings.json");
  }if(type == "settingsMain"){
    settingPath = path.join(app.getPath('userData'), "mainsettings.json");
  }else if(type == "bookmarks"){
    settingPath = path.join(app.getPath('userData'), "lcbookmarks.json");
  }
  
  try {
    fs.writeFileSync(settingPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('MAIN: Settings are saved.');
  } catch (error) {
    console.error('MAIN: Failed to save settings.', error);
  }
}
function getDisplayInfo(screen){
  try {
    const primaryDisplay = screen.getPrimaryDisplay();

    const resolution = primaryDisplay.size;  
    const scaleFactor = primaryDisplay.scaleFactor; 
    const results = {width: resolution.width, height: resolution.height, scaleFactor:scaleFactor};

    console.log('MAIN: Get display Settings: ', rejects);

    return results
  } catch (error) {
    console.error('MAIN: Failed to get display settings.', error);
  }
}
//--------------------------------------------------------------------------------------------------
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,        // treat as a normal URL scheme like http/https
      secure: true,          // treat as a secure scheme (same as https)
      supportFetchAPI: true, // allow usage with fetch() and XHR
      corsEnabled: true,     // enable CORS behavior
    },
  },
]);

app.whenReady().then(async() => {
  await session.defaultSession.clearCache();  //clear cache
  
  // protocol handler
  protocol.handle("app", async (_request) => {
    const u8 = sendBuffer;
    sendBuffer = null; // clear after sending

    return new Response(
      new Blob([u8], { type: "application/octet-stream" })
    );
  });
  //if call from renderer
  //const res = await fetch("app://data");

  //create main window
  createMainWIndow();

  //check update
  getMainWindow().once("ready-to-show", () => {
    if (process.env.LC_E2E !== "1") {
      checkUpdate(getMainWindow(), "startup");
    }
  });

  app.on("activate", (I) => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWIndow();
    }
  });
  

});



//================================================================================================
//subfunc
//-------------------------------------------------------------------------------------------------

/*
app.on("window-all-closed", (event) => {
  event.preventDefault();
  const options = {
    type: "question",
    buttons: ["Yes", "No"],
    defaultId: 2,
    title: "Confirm",
    message: "Do you wanto to close Level Compiler?",
  };

  dialog.showMessageBox(options).then((response) => {
    if (response.response === 0) {
      if (!isMac) {
        app.quit();
      }
    }
  });
});
*/
