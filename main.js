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

//windows
let mainWindow = null;
let finderWindow = null;
let dividerWindow = null;
let converterWindow = null;
let importerWindow = null;
let labelerWindow = null;
let settingsWindow = null;
let imageViewerWindow = null;
let plotWindow = null;
let progressBar = null;

function createMainWIndow() {
  mainWindow = new BrowserWindow({
    title: "Level Compiler",
    width: isDev ? 2000 : 1000,
    height: 800,
    webPreferences: {
      //nodeIntegration: false, //Do not change for security reason
      //contextIsolation: true, //Do not change for security reason
      preload: path.join(__dirname, "preload", "preload.js"),
    },
    icon: "./icon/levelcompiler.png",
  });

  //open devtools if in dev env
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.loadFile(path.join(__dirname, "./renderer/index.html"));
  mainWindow.on('close', async(event) => {
    const historyList = history.getHistory();
    const lastAction = historyList[historyList.length-1];

    if(historyList.length>0 && !lastAction.name.includes("export lcmodel")){
      event.preventDefault();

      const options = {
        type: "question",
        buttons: ["No", "Yes"],
        defaultId: 0,
        title: "Unsaved Changes",
        message: "Unsaved changes to the model. Do you really want to exit?",
      };

      const response = await dialog.showMessageBox(null, options);
      console.log(response)
      if(response.response === 0){
        return
      }
    }

    if (finderWindow && !finderWindow.isDestroyed()) {
      finderWindow.close();
    }
    if (dividerWindow && !dividerWindow.isDestroyed()) {
      dividerWindow.close();
    }
    if (converterWindow && !converterWindow.isDestroyed()) {
      converterWindow.close();
    }
    if (importerWindow && !importerWindow.isDestroyed()) {
      importerWindow.close();
    }
    if (labelerWindow && !labelerWindow.isDestroyed()) {
      labelerWindow.close();
    }
    if (imageViewerWindow && !imageViewerWindow.isDestroyed()) {
      imageViewerWindow.close();
    }
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
    if (plotWindow && !plotWindow.isDestroyed()) {
      plotWindow.close();
    }

    if(mainWindow && !mainWindow.isDestroyed()){
      mainWindow.destroy();
    }
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
    const zipped = await zipData(LCCore.exportSerialisedModel());

    console.log("MAIN: Project correlation data is initialised.");
    return zipped;
  });
  ipcMain.handle("InitialiseAgeModel", async (_e) => {
    //initialise
    LCAge = new LevelCompilerAge();
    LCCore.calcMarkerAges(LCAge);
    console.log("MAIN: Project age data is initialised.");
    return;
  });

  ipcMain.handle("initialisePlotDataCollection", async (_e) => {
    //import modeln
    LCPlot = initialiseLCPlotData();
    
    //for mainwindow
    mainWindow.webContents.send("initialiseLCPlotData");
    console.log("MAIN: Renderer LCPlot is initialised.");

    //for plotter
    const zipped = await zipData(LCPlot);

    if(zipped &&plotWindow){
      plotWindow.webContents.send("importedData", zipped);      
      
      console.log("MAIN: Plotter LCPlot is initialised.");
    }

    console.log("MAIN: ALL LCPlot is initialised.")
  
  });
  ipcMain.handle("InitialisePaths", async (_e) => {
    //import modeln
    initialiseGlobalPath();
    console.log("MAIN: Paths are initialised.");
    return;
  });
  //============================================================================================
  //register and load model data
  ipcMain.handle("RegisterModelFromCsv", async (_e, model_path) => {
    //get file path
    let results = path.parse(model_path);
    const fullpath = path.join(results.dir, results.base);
    
    const result = registerModelFromCsv(fullpath);
    return result
  });
  ipcMain.handle("RegistertAgeFromCsv", async (_e, age_path) => {
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
  ipcMain.handle("RegisterLCmodel", async (_e, model_path) => {
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
  ipcMain.handle("LoadAgeFromLCAge", async (_e, age_id) => {
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
      mainWindow.webContents.send("AlertRenderer", err);
    }

    //send data
    try{
      const zipped = await zipData(LCCore.exportSerialisedModel());
      if(LCPlot.data_collections.length>0){
        //initialise view
        plotWindow.webContents.send("initialiseSendData");
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
    targetList = tempPath.dataPaths.filter(item=>item.type=="core_images");
    for(const data of targetList){
      const fullpath = data.path;
      if(fullpath !== undefined){
        registerCoreImage(fullpath,"core_images",null);
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
  ipcMain.handle("CheckImagesInDir", async (_e, name) => {
    let targetList = globalPath.dataPaths.filter(item=>item.type=="core_images");
    //mainWindow.webContents.send("rendererLog", targetList);

    let result = false;
    for(const target of targetList){
      const res = await findFileInDir(target.path, name, "check");
      if(res==true){
        result = true;
        break;
      }
    }
    return result;
  });
  ipcMain.handle("FileChoseDialog", async (_e, title, ext) => {
    const result = await getfile(mainWindow, title, ext);
    
    return result;
  });
  ipcMain.handle("FolderChoseDialog", async (_e, title) => {
    const result = await getDirectory(mainWindow, title);
    return result;
  });

 //============================================================================================
 //image process
  ipcMain.handle('RegisterCoreImage', (_e, dir_handle, type) => {
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
        registerCoreImage(dirPath, type, null);
      } else if(pathData.ext==""){
        //case folder
        dirPath = path.join(pathData.dir, pathData.name);
        //register path
        registerCoreImage(dirPath, type, null);
      }else if(pathData.ext==".jpg"|| pathData.ext === ".jpeg"|| pathData.ext === ".tif"|| pathData.ext === ".tiff"|| pathData.ext === ".png"){
        dirPath = pathData.dir;
        //register path
        registerCoreImage(dirPath, type, pathData.base);
      }else if(pathData.ext==".lcsection"){
        //lcsection from labeler
        dirPath = pathData.dir;
        //register path
        registerCoreImage(dirPath, type, null);
      }else{
        return false
      }
      
      return true      
    }catch(err){
      return false
    } 
  });
  ipcMain.handle("LoadCoreImage", async (_e, loadOptions, type) => {
    //type: "core_images", "labeler"    
    const coreImages = await loadCoreImages(loadOptions, type);
    return coreImages;
  });
  async function loadCoreImages(loadOptions, type){
    const isShowMemory = false;
    progressBar   = progressDialog(mainWindow, "Load modeled section images", "Now converting...", false);    
    //await new Promise(r => progressBar.on('ready', r));
    await new Promise(r => progressBar.once('ready', r));

    //console.log("   Load core image called")
    let releasedWorkers = 0;
    let numTotalTasks = 0;
    try {
      if(loadOptions.targetIds.length==0){
        return null
      }

      //initialise
      
      let coreImages = {
        load_target_ids: [],
        operations:[],
        image_resolution: {},
        drilling_depth: {},
        composite_depth: {},
        event_free_depth: {},
        age:{},
      };

      //get registered image folder path
      let targetList = globalPath.dataPaths.filter(item=>item.type==type);

      if(targetList.length < 1){
        console.log("MAIN: There is no registered image folders.")
        progressBar   = await updateProgress(progressBar, 1, 1);
        progressBar = null;
        return null
      }
      console.log("MAIN: Load images: N = "+loadOptions.targetIds.length+"; Operations: ["+loadOptions.operations+"]");

      //make tasks
      const NUM_WORKERS = Math.min(Math.round(os.cpus().length/2), loadOptions.targetIds.length);
      const tasks = []; // Task queue
      const idleWorkers = []; // Idle worker list

      for(const target of targetList){
        for(const id of loadOptions.targetIds){          
          let idx = null;
          let targetHoleData = null;
          let targetSectionData = null;
          if(type=="core_images"){
            idx = LCCore.search_idx_list[id.toString()];
            targetHoleData = LCCore.projects[idx[0]].holes[idx[1]];
            targetSectionData = JSON.parse(JSON.stringify(targetHoleData.sections[idx[2]]));
          }else if(type=="labeler"){
            targetHoleData = tempCore.projects[0].holes[0];
            targetSectionData = targetHoleData.sections[0];
          }
          
          let imBaseName = targetHoleData.name +"-"+targetSectionData.name;

          //get image path
          let fullpath;
          if(imBaseName.includes(".jpg")||imBaseName.includes(".jpeg")||imBaseName.includes(".tif")||imBaseName.includes(".tiff")||imBaseName.includes(".png")){
            fullpath = await findFileInDir(target.path, imBaseName, "get");
          }else{
            const exts = [".jpg", ".jpeg", ".png", ".tif", ".tiff"];

            for (const ext of exts) {
              fullpath = await findFileInDir(target.path, imBaseName + ext, "get");
              if (fullpath) break;
            }
          }

          if(fullpath == false){
            continue
          }
  
          //calc new image size
          const coreLength = targetSectionData.markers[targetSectionData.markers.length-1].distance - targetSectionData.markers[0].distance;
          let new_height = Math.round(200 * 100); //max
          const dpcm = loadOptions.dpcm[imBaseName] ? loadOptions.dpcm[imBaseName] : loadOptions.dpcm;
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
            operations:loadOptions.operations,
            sectionData:targetSectionData,
          })  
        }
      }      

      if(tasks.length==0){
        console.log("MAIN: Failed to get tasks", targetList, loadOptions);
        progressBar   = await updateProgress(progressBar, 1, 1);
        progressBar = null;
        return null
      }
      //submit
      //make worker
      numTotalTasks = tasks.length;
      
      progressBar   = await updateProgress(progressBar, 0, numTotalTasks);
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
        progressBar = await updateProgress(progressBar, numTotalTasks, numTotalTasks);
        progressBar = null;
      }
      return coreImages;
    }catch(err){
      console.log(err)
      return null;
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
            progressBar = await updateProgress(progressBar, n, numTotalTasks);

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
                  worker.terminate();
                }
              }
            }
          });
          worker.on("error", async(err) => {
            if (isShowMemory) console.log('error recv', process.memoryUsage());

            n += 1;
            progressBar = await updateProgress(progressBar, n, numTotalTasks);
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
  ipcMain.handle("isExistFile",(_e, dirHandle, fileName)=>{
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
  ipcMain.handle("floatingImageViewer", async (_e, targetId) => {
    try{
      const loadOptions = {
        targetIds: [targetId], 
        operations: ["drilling_depth"],
        dpcm: 100,
      };
      const sectionImage = await loadCoreImages(loadOptions, "core_images");

      const key = Object.keys(sectionImage?.drilling_depth || {})[0];
      const buf = sectionImage?.drilling_depth?.[key];
      //const metadata = await sharp(buf).metadata();
      const metadata = await sharp(sectionImage["drilling_depth"][Object.keys(sectionImage["drilling_depth"])[0]]).metadata();

      if (imageViewerWindow) {
        imageViewerWindow.focus();
        return;
      }

      //create finder window
      imageViewerWindow = new BrowserWindow({
        title: "imageViewer",
        parent: mainWindow,
        frame: false,
        width: 300,//metadata.width,
        height: 800,
        webPreferences: {preload: path.join(__dirname, "preload", "preload_image_viewer.js"),},
      });
      
      //converterWindow.setAlwaysOnTop(true, "normal");
      imageViewerWindow.on("closed", () => {
        imageViewerWindow = null;
        mainWindow.webContents.send("ImageViewerClosed", "");
      });
      imageViewerWindow.setMenu(null);

      imageViewerWindow.loadFile(path.join(__dirname, "./renderer/image_viewer.html"));

      imageViewerWindow.once("ready-to-show", () => {
        imageViewerWindow.show();
        //imageViewerWindow.setAlwaysOnTop(true, "floating");
        //imageViewerWindow.webContents.openDevTools();
        //converterWindow.setAlwaysOnTop(true, "normal");
        imageViewerWindow.webContents.send("ImageViewerMenuClicked", sectionImage);
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
  ipcMain.handle("progressbar", async (_e, tit, txt, indeterminate, window="mainWindow") => {
    progressBar = null;
    let targetWindow = mainWindow;
    if(window == "converterWindow"){
      targetWindow = converterWindow;
    }
    progressBar = progressDialog(targetWindow, tit, txt, indeterminate);
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
  ipcMain.handle("updateProgressbar", async (_e, n, N) => {
    progressBar = await updateProgress(progressBar, n, N);
    return true
  });
  ipcMain.handle("clearProgressbar", async (_e) => {
    if(progressBar){
      progressBar.close();
      progressBar = null; 
      return true
    }         
  });
  ipcMain.handle("askdialog", (_e, opts, txt) => {
    const options = {
      type: "question",
      buttons: ["No", "Yes"],
      defaultId: 0,
      title: opts.title,
      message: opts.message,
    };

    let targetWindow = null;
    if(opts.parent == "main"){
      targetWindow = mainWindow;
    }else if(opts.parent == "settings"){
      targetWindow = settingsWindow;
    }else if(opts.parent == "labeler"){
      targetWindow = labelerWindow;
    }else if(opts.parent == "finder"){
      targetWindow = finderWindow;
    }

    const response = dialog.showMessageBox(targetWindow, options);
    return response;
  });
  ipcMain.handle("inputdialog", async (_e, data,) => {
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
  ipcMain.handle('showContextMenu', (event, type) => {
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
              if (imageViewerWindow && !imageViewerWindow.isDestroyed()) {
                imageViewerWindow.close();
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

      const { response } = await dialog.showMessageBox(mainWindow, options);

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
      
      await putcsvfile(mainWindow, saveName, outputArray);
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

      const { response } = await dialog.showMessageBox(mainWindow, options);

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

      putcsvfile(mainWindow, saveModelName, outputArray.model);
      putcsvfile(mainWindow, saveEventName, outputArray.event);
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
  ipcMain.handle("LabelerAddSectionData", async (_e, holeName, sectionName) => {
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
  ipcMain.handle("LabelerAddMarkerData", async (_e, name, depth, relative_x) => {
    //add marker
    const result = tempCore.addMarker(tempCore.projects[0].holes[0].sections[0].id, depth, "distance", relative_x);
    
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
  ipcMain.handle("LabelerChangeMarker", (_e, markerId, type, value) => {
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
  ipcMain.handle("LabelerDeleteMarker", (_e, markerId) => {
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
        const result = await dialog.showOpenDialog(labelerWindow, {
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
  ipcMain.handle("LabelerLoadSectionModel", (_e, dirHandle, fileName) => {
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
  ipcMain.handle("ChangeDepthScale", async (_e, newId) => {
    LCCore.changeBaseProject(newId);
  });
  ipcMain.handle("PlotterGetData", (_e, data) => {
    if (converterWindow) {
      converterWindow.focus();
      return;
    }

    //create finder window
    converterWindow = new BrowserWindow({
      parent: plotWindow ? plotWindow : mainWindow, 
      title: "Converter",
      width: 750,
      height: 800,
      webPreferences: {preload: path.join(__dirname, "preload", "preload_converter.js"),},
    });
    
    //converterWindow.setAlwaysOnTop(true, "normal");
    converterWindow.on("closed", () => {
      converterWindow = null;
      mainWindow.webContents.send("ConverterClosed", "");
    });
    converterWindow.setMenu(null);

    converterWindow.loadFile(path.join(__dirname, "./renderer/converter.html"));

    converterWindow.once("ready-to-show", () => {
      converterWindow.show();
      //converterWindow.setAlwaysOnTop(true, "floating");
      //converterWindow.webContents.openDevTools();
      //converterWindow.setAlwaysOnTop(true, "normal");
      converterWindow.webContents.send("ConverterMenuClicked", data);
    });   
  });
  ipcMain.handle("ConverterClose", (_e, data) => {
    if(converterWindow){
      console.log("Converter Close called.")
      converterWindow.removeAllListeners("close");
      converterWindow.close();
      converterWindow = null;
    }    
  });
  ipcMain.handle("PlotterClose", (_e, data) => {
    isPlotterClose = true;
    plotWindow.removeAllListeners("close");
    plotWindow.close();
    plotWindow = null;
    mainWindow.webContents.send("PlotterClosed", "");
  });
  ipcMain.on("windowCloseButton", (_e) => {
    isPlotterClose = false;
    plotWindow.removeAllListeners("close");
    plotWindow.close();
    plotWindow = null;
    mainWindow.webContents.send("PlotterClosed", "");
    isPlotterClose = false;
  });
  ipcMain.handle("OpenImporter", async (_e) => {
    if (importerWindow) {
      importerWindow.focus();
      importerWindow.webContents.send("ImporterToolClicked", "");
      return;
    }

    //create finder window
    importerWindow = new BrowserWindow({
      title: "Finder",
      parent: mainWindow,
      width: 700,
      height: 700,
      webPreferences: {
        preload: path.join(__dirname, "preload", "preload_converter.js"),
      },
    });

    importerWindow.on("closed", () => {
      importerWindow = null;
      mainWindow.webContents.send("ImporterClosed", "");
    });

    importerWindow.setMenu(null);
    importerWindow.loadFile(path.join(__dirname, "./renderer/importer.html"));

    importerWindow.once("ready-to-show", () => {
      importerWindow.show();
      //importerWindow.webContents.openDevTools();
      //importerWindow.setAlwaysOnTop(true, "floating");
      importerWindow.webContents.send("ImporterToolClicked", "");
    });
  });
  ipcMain.handle("CloseImporter", async (_e) => {
    if (importerWindow) {
      importerWindow.close();
      importerWindow = null;
      return;
    }
  });
  ipcMain.handle("LoadPlotData", async (_e, type) => {
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
  ipcMain.handle("GetAgeFromEFD", async (_e, efd, method) => {
    //calc age
    const age = LCAge.getAgeFromEFD(efd, method);
    if (age == null) {
      return NaN;
    } else {
      return age.mid;
    }
  });
  ipcMain.handle("GetAgeFromCD", async (_e, cd, method) => {
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
  ipcMain.on("dividerConverter", async (_e, depthData, targetData, direction) => {
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

    _e.returnValue = resultList;    
  });
  ipcMain.handle("OpenDivider", async (_e) => {
    if (dividerWindow) {
      dividerWindow.focus();

      if (dividerWindow.webContents.getURL()) {
        dividerWindow.webContents.send("DividerToolClicked", "");
      } else {
        dividerWindow.webContents.once("did-finish-load", () => {
          dividerWindow.webContents.send("DividerToolClicked", "");
        });
      }

      return;
    }

    //initial construction
    dividerWindow = new BrowserWindow({
      title: "Divider",
      parent: mainWindow,
      width: 1300,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "preload", "preload_divider.js"),
      },
    });

    dividerWindow.on("closed", () => {
      
      if(mainWindow && !mainWindow.isDestroyed){
        mainWindow.webContents.send("DividerClosed", "");
        dividerWindow = null;
      }
      
    });

    dividerWindow.setMenu(null);

    dividerWindow.loadFile(path.join(__dirname, "./renderer/divider.html"));

    dividerWindow.webContents.once("did-finish-load", () => {
      dividerWindow.show();
      dividerWindow.webContents.send("DividerToolClicked", "");
    });
  });

  ipcMain.handle("CloseDivider", async (_e) => {
    if (dividerWindow) {
      dividerWindow.close();
      dividerWindow = null;
      return;
    }
  });
  ipcMain.handle("dividerReflow", async (_e) => {
    if (dividerWindow) {
      dividerWindow.blur();
      setTimeout(() => dividerWindow.focus(), 1); 
      return true;
    }
    return false
  });
  ipcMain.on("dividerExport", async (_e, data) => {
    putcsvfile(dividerWindow, null, data);    
    console.log("MAIN: Exported Divided data.");
  });
  ipcMain.handle("OpenFinder", async (_e) => {
    if (finderWindow && !finderWindow.isDestroyed()) {
      finderWindow.focus();
      finderWindow.webContents.send("FinderToolClicked", "");
      return;
    }

    //create finder window
    finderWindow = new BrowserWindow({
      title: "Finder",
      parent:mainWindow,
      width: 230,
      height: 580,
      webPreferences: {
        preload: path.join(__dirname, "preload", "preload_finder.js"),
      },
    });

    finderWindow.on("closed", () => {
      finderWindow = null;
      const { webContents } = mainWindow;
      if (webContents && !webContents.isDestroyed()) {
        try {
          webContents.send("FinderClosed", "");
        } catch (e) {
        }
      }
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
              if (finderWindow && !finderWindow.isDestroyed()) {
                finderWindow.webContents.send("updateModeChanged", menuItem.checked);
              }
            }
          },
        ]
      }
    ]);

    finderWindow.webContents.on('context-menu', (_event, params) => {
      customMenu.popup({ window: finderWindow, x: params.x, y: params.y });
    });
  
    finderWindow.setMenu(null);

    finderWindow.loadFile(path.join(__dirname, "./renderer/finder.html"));

    finderWindow.once("ready-to-show", () => {
      finderWindow.show();
      //finderWindow.webContents.openDevTools();
      //finderWindow.setAlwaysOnTop(true, "floating");
      finderWindow.webContents.send("FinderToolClicked", "");

      const LCBookmarkSet= getSettings("bookmarks");
      let LCBookmarkData = null;
      if(LCBookmarkSet!==null){
        LCBookmarkData = LCBookmarkSet[LCCore.name];
      }
      
      finderWindow.webContents.send("Bookmarks", LCBookmarkData);
    });
  });
  ipcMain.handle("CloseFinder", async (_e) => {
    if (finderWindow && !finderWindow.isDestroyed()) {
      finderWindow.close();
      finderWindow = null;
      return;
    }
  });
  ipcMain.handle("Confirm", async (event, opts, message) => {
    const options = {
      type: "question",
      buttons: ["Yes", "No"],
      title: opts.title,
      message: opts.message,
    };

    let targetWindow = null;
    if(opts.parent == "main"){
      targetWindow = mainWindow;
    }else if(opts.parent == "divider"){
      targetWindow = dividerWindow;
    }

    const result = await dialog.showMessageBox(targetWindow, options);
    return result.response === 0;
  });
  ipcMain.handle("SendDepthToFinder", async (_e, data) => {
    finderWindow.webContents.send("SendDepthFromMain", data);
  });
  ipcMain.on("request-mainprocess-info", (event) => {
    const info = "";
    event.sender.send("mainprocess-info", info);
  });
  ipcMain.on("toggle-devtools", async(_e, data) => {
    if(data == "divider"){
      if (dividerWindow.webContents.isDevToolsOpened()) {
        dividerWindow.webContents.closeDevTools();
      } else {
        dividerWindow.webContents.openDevTools();
      }
    } else if(data == "finder"){
      if (finderWindow.webContents.isDevToolsOpened()) {
        finderWindow.webContents.closeDevTools();
      } else {
        finderWindow.webContents.openDevTools();
      }
    } else if(data == "main"){
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    } else if(data == "converter"){
      if (converterWindow.webContents.isDevToolsOpened()) {
        converterWindow.webContents.closeDevTools();
      } else {
        converterWindow.webContents.openDevTools();
      }
    } else if(data == "labeler"){
      if (labelerWindow.webContents.isDevToolsOpened()) {
        labelerWindow.webContents.closeDevTools();
      } else {
        labelerWindow.webContents.openDevTools();
      }
    }else if(data == "viewer"){
      if (imageViewerWindow.webContents.isDevToolsOpened()) {
        imageViewerWindow.webContents.closeDevTools();
      } else {
        imageViewerWindow.webContents.openDevTools();
      }
    }else if(data == "importer"){
      if (importerWindow.webContents.isDevToolsOpened()) {
        importerWindow.webContents.closeDevTools();
      } else {
        importerWindow.webContents.openDevTools();
      }
    }else if(data == "plotter"){
      if (plotWindow.webContents.isDevToolsOpened()) {
        plotWindow.webContents.closeDevTools();
      } else {
        plotWindow.webContents.openDevTools();
      }
    }else if(data == "settings"){
      if (settingsWindow.webContents.isDevToolsOpened()) {
        settingsWindow.webContents.closeDevTools();
      } else {
        settingsWindow.webContents.openDevTools();
      }
    }
    
  });
  ipcMain.handle("sendUndo", async (_e, type) => { 
    if(type=="main"){
      const result = history.undo();   
      if(result !== null){
        //mainWindow.webContents.send("rendererLog", result);

        //Undo
        LCCore = initialiseLCCore();
        Object.assign(LCCore, result.state);
        LCCore.updateSearchIdx();

        //get changed sections
        const changedSections = getChangedSections(result.delta);
        let changedIds = [];
        changedSections.forEach(i=>{          
          changedIds.push(LCCore.projects[i.project].holes[i.hole].sections[i.section].id);
          
          //LCCore.projects[i.project].holes[i.hole].sections[i.section].markers.forEach(m=>{          })
        })       

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
        let imagePaths = globalPath.dataPaths.filter(item=>item.type=="core_images");
        if(imagePaths.length>0 && changedIds.length>0){
          const coreImages = await loadCoreImages({
            targetIds:changedIds,
            operations:["drilling_depth","composite_depth","event_free_depth","age"],
            dpcm:30, //e.g. 30 or [DPCM<im name> = 30]
          },"core_images");

          if(coreImages!==null){
            mainWindow.webContents.send("LoadCoreImagesMenuClicked", coreImages);
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
  ipcMain.handle("sendRedo", async (_e, type) => {
    if(type=="main"){
      const result = history.redo();      
      if(result !== null){
        //redo
        LCCore = initialiseLCCore();
        Object.assign(LCCore, result.state);
        LCCore.calcCompositeDepth();
        LCCore.calcEventFreeDepth();
        LCCore.updateSearchIdx();

        //get changed sections
        const changedSections = getChangedSections(result.delta);

        let changedIds = [];
        changedSections.forEach(i=>{          
          changedIds.push(LCCore.projects[i.project].holes[i.hole].sections[i.section].id);
        })

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
        let imagePaths = globalPath.dataPaths.filter(item=>item.type=="core_images");
        if(imagePaths.length>0 && changedIds.length>0){
          const coreImages = await loadCoreImages({
            targetIds:changedIds,
            operations:["drilling_depth","composite_depth","event_free_depth","age"],
            dpcm:30,
          },"core_images");

          if(coreImages!==null){
            mainWindow.webContents.send("LoadCoreImagesMenuClicked", coreImages);
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
  ipcMain.handle("sendSaveState", async (_e, type, name="unnamed") => {
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
  ipcMain.handle("getChangedSectionIds", async (_e, type, numPrevious) => {
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
  ipcMain.handle("cvtLoadCsv", async (_e, title, ext, pathData) => {
    try{
      //progress bar
      progressBar   = progressDialog(converterWindow, "Depth Converter", "Now checking...", true);

      await new Promise((resolve) => {
        progressBar.on("ready", resolve);
      });

      //main
      //for converter
      let result = null;
      if(pathData==null){
        result = await getfile(mainWindow, title, ext);
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
  ipcMain.handle("cvtConverter", async (_e, options) => {
    options = await unzipData(options);
    if(!globalTempData){

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
        progressBar = progressDialog(converterWindow, "Depth Converter", "Now exporting...", true);
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
          if(converterWindow){
            console.log("Converter Close called.")
            converterWindow.removeAllListeners("close");
            converterWindow.close();
            converterWindow = null;
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

          //update header
          if(i==0){
            if(options.sourceType !== "trinity"){
              header[1] += " [PASEUDO]";
              header[2] += " [PASEUDO]";
              header[3] += " [PASEUDO]";
              header[4] += " [PASEUDO]";   
              if(options.sourceType ==="event_free_depth" || options.sourceType ==="age"){
                header[9] += " [PASEUDO]";
              }else if(options.sourceType ==="drilling_depth"){
                header[9] += " [PASEUDO]";
                header[10] += " [PASEUDO]";
                header[11] += " [PASEUDO]";
                header[12] += " [PASEUDO]";
                header[13] += " [PASEUDO]";
              }           
            }
          }

          let correlationType = "";                  
          if(calcedData.project_type === "correlation"){
            correlationType = "Main " + calcedData.section_type;            
          }else if(calcedData.project_type === "duo"){
            correlationType = "Duo " + calcedData.section_type;
          }          

          let basis = null;
          const baseIdx = LCCore.search_idx_list[LCCore.base_project_id.toString()];

          if(calcedData.is_main_model_connected===false){
            basis = calcedData.project;
          }else{
            basis = LCCore.projects[baseIdx[0]].name;
          }

          //make output array
          const allowPaseudoTrinity = false;
          let rowData = [
            calcedData.name, //data name
            options.sourceType==="trinity"||allowPaseudoTrinity ? calcedData.project : "", //project name
            options.sourceType==="trinity"||allowPaseudoTrinity ? calcedData.hole : "", //hole name
            options.sourceType==="trinity"||allowPaseudoTrinity ? calcedData.section : "", //section name
            options.sourceType==="trinity"||allowPaseudoTrinity ? parseFloat(calcedData.distance).toFixed(options.precision) : "", //distance
            options.sourceType==="trinity"||allowPaseudoTrinity ? parseFloat(calcedData.dd).toFixed(options.precision) : "", //drilling depth
            calcedData.source_type,
            "",
            basis,
            parseFloat(calcedData.cd).toFixed(options.precision), //composite depth
            parseFloat(calcedData.efd).toFixed(options.precision), //event free depth            
            parseFloat(calcedData.age_mid).toFixed(options.precision), //age mid
            parseFloat(calcedData.age_upper).toFixed(options.precision), //age upper
            parseFloat(calcedData.age_lower).toFixed(options.precision), //age lower
            "",//separator            
            calcedData.correlation_rank,  //connection rank    
            correlationType,//calcedData.is_main_model_connected ? "MAIN " + calcedData.section_type : "DUO " + calcedData.section_type, // MAIN master section/parallel section                    
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
        const res = await putcsvfile(converterWindow, null, convertedData);
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
        if(converterWindow){
          console.log("Converter Close called.")
          converterWindow.removeAllListeners("close");
          converterWindow.close();
          converterWindow = null;
        } 
        return res
      }else if(options.outType == "import"){
        if (options.sourceType == "age"){
          //check age model exist
          if(LCAge.AgeModels.length == 0 || !LCAge.selected_id){
            //there is no selected age model
            return {ok:false, reason: "No age model found. Please load an age model first."}
          }          
        }
        
        progressBar = progressDialog(converterWindow, "Depth Converter", "Now importing...", true);
        await new Promise((resolve) => {
          progressBar.on("ready", resolve);
        });
        //main convertion
        if (globalTempData.data === null || calcedDataList === null) {
          globalTempData = null;
          if(converterWindow){
            console.log("Converter Close called.")
            converterWindow.removeAllListeners("close");
            converterWindow.close();
            converterWindow = null;
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

          if(calcedData.source_type !== "trinity"){
            calcedData.project  = null;
            calcedData.hole     = null;
            calcedData.section  = null;
            calcedData.distance = null;
          }

          output.push(calcedData);
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
            plotWindow.webContents.send("importedData", zipped);
            mainWindow.webContents.send("importedData", true); // -> call loadplotdata(PlotterGetData)
            console.log("MAIN: Plot Data is imported into Plotter & renderer.");
          } catch (err) {
            console.error("MAIN: Failed to zip:", err);
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "Failed to load",
              message: "Failed to load data",
              detail: String(err),
            });

            globalTempData = null;
            if(converterWindow){
              console.log("Converter Close called.")
              converterWindow.removeAllListeners("close");
              converterWindow.close();
              converterWindow = null;
            } 
            return {ok: false, reason: err}
          }

        }else if(options.callFrom == "converter"){    
          globalTempData = null; 
          if(converterWindow){
            console.log("Converter Close called.")
            converterWindow.removeAllListeners("close");
            converterWindow.close();
            converterWindow = null;
          } 
          return {ok: false, reason: "There is no actions."}     
        }
        
        //finish
        if(progressBar!==null){
          //progressBar.close();
          //progressBar = null;
        }
        globalTempData = null;
        if(converterWindow){
          console.log("Converter Close called.")
          converterWindow.removeAllListeners("close");
          converterWindow.close();
          converterWindow = null;
        } 
        return {ok: true}        
      } else {
        console.log("[MAIN]: Unkown convertion type detected.")

        if(progressBar!==null){
          progressBar.close();
          progressBar = null;
        }
        globalTempData = null;
        if(converterWindow){
          console.log("Converter Close called.")
          converterWindow.removeAllListeners("close");
          converterWindow.close();
          converterWindow = null;
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
  ipcMain.handle("changeFix", async (_e, isFix) => {
    if (!finderWindow || finderWindow.isDestroyed()) {
      return;
    }
    if (isFix) {
      finderWindow.setParentWindow(mainWindow);
      finderWindow.setAlwaysOnTop(true, "floating");
    } else {
      finderWindow.setParentWindow(null);
      finderWindow.setAlwaysOnTop(false);
      
    }
  });
  ipcMain.handle("getSectionLimit", async (_e, projectId, holeName, sectionName) => {
    const idx = LCCore.getIdxFromTrinity(projectId, [holeName, sectionName, ""]);

    const sectionData = LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
    const dist_upper = sectionData.markers[0].distance;
    const dist_lower = sectionData.markers[sectionData.markers.length - 1].distance;
    return [dist_upper, dist_lower];
  });
  ipcMain.handle("MoveToHorizon", async (_e, data) => {
    mainWindow.webContents.send("MoveToHorizonFromFinder", data);
  });
  ipcMain.handle("terminalLog", async (_e, data) => {
    console.log(data);
  });
  ipcMain.handle("rendererLog", async (_e, data) => {
    mainWindow.webContents.send("rendererLog", data);
  });
  ipcMain.handle("sendPlotOptions", (_e,data, to) => {
    if(to=="renderer"){
      mainWindow.webContents.send("PlotDataOptions", data);
    }    
  });
  ipcMain.handle("depthConverter", async (_e, dataList, options) => {
    
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
  ipcMain.handle("changeEditMode", (_e,mode) => {
    
    isEditMode = mode;
    menuRebuild();
    
  });
  ipcMain.handle("sendSettings", (_e,sendData, to) => {
    if(to=="settings"){
      if(settingsWindow==null){
        //case of call properties
        if (settingsWindow) {
          settingsWindow.focus();
          return;
        }
    
        //create finder window
        settingsWindow = new BrowserWindow({
          title: "Settings",
          width: 700,
          height: 700,
          webPreferences: {preload: path.join(__dirname, "preload", "preload_settings.js"),},
          parent: mainWindow,
          model: true,
        });
        
        //converterWindow.setAlwaysOnTop(true, "normal");
        settingsWindow.on("closed", () => {
          settingsWindow = null;
          mainWindow.webContents.send("SettingsClosed", "");
        });
        settingsWindow.setMenu(null);
    
        settingsWindow.loadFile(path.join(__dirname, "./renderer/settings.html"));
    
        settingsWindow.once("ready-to-show", () => {
          settingsWindow.show();
         // converterWindow.setAlwaysOnTop(true, "normal");
         //settingsWindow.webContents.openDevTools();
          settingsWindow.setAlwaysOnTop(true, "floating");
          settingsWindow.webContents.send("SettingsData", sendData);
        });
      }else{
        settingsWindow.webContents.send("SettingsData", sendData);
      }

    }else if(to=="renderer"){
      mainWindow.webContents.send("SettingsData", sendData.data);
      if(sendData){
        setSettings("settingsRenderer", sendData.data);
      }      
    }else if(to=="save"){
      setSettings("settingsRenderer", sendData.data)
    }    
  });
  ipcMain.handle("saveBookmarks", (_e, data) => {
    let LCBookmarkSet= getSettings("bookmarks");
    if(LCBookmarkSet==null){
      LCBookmarkSet = {};
    }
    LCBookmarkSet[LCCore.name] = data;
    setSettings("bookmarks", LCBookmarkSet);
  });
  ipcMain.handle("requestCurrentPosition", (_e) => {
    mainWindow.webContents.send("FinderRequestCurrentPosition");    
  });

  ipcMain.handle("openExtarnalLink", (_e,url) => {
    if(url){
      shell.openExternal(url);
    }
  });
  //--------------------------------------------------------------------------------------------------
  //-----workspace-----
  ipcMain.handle("changeWorkspace", (_e, type, value) => {
    if(type=="name"){
      LCCore.name = value;
      return true;
    }else if(type=="descriptions"){
      LCCore.descriptions = value;
      return true;
    }
  });
  //-----project-----
  ipcMain.handle("addProject", async(_e, type, name) => {
    
    const result = LCCore.addProject(type, name);

    if (result == true) {
      console.log("MAIN: Add project completed.");
      return result;
    } else {
      console.log("MAIN: Failed to add a new project.");
      return result
    }
  });
  ipcMain.handle("deleteProject", async(_e, projectId) => {
    const options = {
      type: "question",
      buttons: ["No", "Yes"],
      defaultId: 0,
      title: "Dlete Project",
      message: "Do you aslo want to delete the connections between projects?",
    };

    const { response } = await dialog.showMessageBox(mainWindow, options);

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
  ipcMain.handle("changeProject", (_e, projectId, type, value) => {
    console.log(projectId, type, value)
    if(type=="name"){
      const result = LCCore.changeName(projectId, value);
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(projectId, value);
      return result;
    }else if(type==="model_type"){
      const result = LCCore.changeProjectType(projectId, value);
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
  ipcMain.handle("addHole", async(_e, projectId, name) => {
    
    const result = LCCore.addHole(projectId, name);

    if (result == true) {
      console.log("MAIN: Add hole completed.");
      return result;
    } else {
      console.log("MAIN: Failed to add a new hole.");
      return result
    }
  });
  ipcMain.handle("deleteHole", async(_e, holeId) => {
    
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
  ipcMain.handle("changeHole", (_e, holeId, type, value) => {
    
    if(type=="name"){
      const result = LCCore.changeName(holeId, value);
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(holeId, value);
      return result;
    }else if(type=="order"){
      const result = LCCore.changeHoleOrder(holeId, value);
      return result;
    }
  });
  ipcMain.handle("moveHoleToProject", async(_e, holeId, projectId) => {
    
    const result = LCCore.moveHoleToProject(holeId, projectId);

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
  ipcMain.handle("addSection", (_e, sectionId, data) => {
    //    
    const result = LCCore.addSection(sectionId,data);//LCCore.deleteSection(sectionId);
    if(result == true){
      console.log("MAIN: Add section.")
      return result;  
    }else{
      console.log("MAIN: Failed to add section.")
      return result;  
    }
    
  });
  ipcMain.handle("deleteSection", (_e, sectionId) => {
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
  ipcMain.handle("changeSection", (_e, sectionId, type, value) => {    
    if(type=="name"){
      const result = LCCore.changeName(sectionId, value);
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(sectionId, value);
      return result;
    }
  });
  //-----marker-----
  ipcMain.handle("addMarker", (_e, sectionId, depth, depthScale,relativeX) => {
    //add
    const result = LCCore.addMarker(sectionId, depth, depthScale, relativeX);
    if(result==true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Add a new marker on the section: " + sectionId +" of " + depth +" cm "+depthScale);
      return true
    }else{
      return result
    }   
  });
  ipcMain.handle("deleteMarker", (_e, targetId) => {
    const result = LCCore.deleteMarker(targetId);
    if(result==true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      console.log("MAIN: Delete target marker.");
      return true
    }else{
      return false
    }    
  });
  ipcMain.handle("changeMarker", (_e, markerId, type, value) => {    
    if(type == "distance"){
      //value:distance
      const result = LCCore.changeDistance(markerId, value);
      if(result == true){
        LCCore.calcCompositeDepth();
        LCCore.calcEventFreeDepth();
        console.log("MAIN: Change marker distance.");
      }else{
        console.log("MAIN: Failed to change marker distance.")
      }
      return result;
    }else if(type=="name"){
      const result = LCCore.changeName(markerId, value)
      return result;
    }else if(type=="descriptions"){
      const result = LCCore.changeDescriptions(markerId, value)
      return result;
    }
  });
  //-----event-----
  ipcMain.handle("AddEvent", async(_e, upperId, lowerId, depositionType, value) => {
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
  ipcMain.handle("DeleteEvent", async(_e, upperId, lowerId, type) => {
    
    const result = LCCore.deleteEvent(upperId, lowerId, []);

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
  ipcMain.handle("connectMarkers", (_e, fromId, toId, direction) => {
    const res = LCCore.connectMarkers(fromId, toId, direction);

    if(res == true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      return true
    }else{
      return false
    }    
  });
  ipcMain.handle("disconnectMarkers", (_e, fromId, toId, direction) => {
    const res = LCCore.disconnectMarkers(fromId, toId, direction);
    if(res==true){
      LCCore.calcCompositeDepth();
      LCCore.calcEventFreeDepth();
      return true
    }else{
      return false
    }    
  });
  ipcMain.handle("disconnectAllConnections", (_e, fromId, direction) => {
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
  ipcMain.handle("SetZeroPoint", async(_e, markerId, value) => {
    
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
  ipcMain.handle("SetMaster", async(_e, markerId, type) => {
    
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
  ipcMain.handle("changeEnable", async(_e, targetId, isEnable) => {
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
      callWindow = converterWindow;
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

        const { response } = await dialog.showMessageBox(callWindow, options);

        if(response===0){
          return null;
        }
      }
    } else {
      callWindow = mainWindow;
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
        results.source_type = calcedIdx !== null ? type: NaN;
        results.calc_type   = cd_list[0][3];
      } else if (type == "composite_depth") {
        //get cd
        const name     = data[0];
        const cd       = parseFloat(data[1]);
        const targetId = data[2];

        //get nearest trinity return: [index: , project: , hole: , section: , distance: ]
        const paseudoTrinity = LCCore.getNearestTrinity(targetId, cd, "composite_depth");

        //calc efd
        const efd = LCCore.getEFDfromCD(cd);

        //const dd  = LCCore.getDepthFromTrinity(targetId, send_data, "drilling_depth", allowExtrapolation, options.isForceCalculation); //output:[sec id, efd, rank]

        //calc age
        const ageData = LCAge.getAgeFromEFD(efd, method);
        const age = ageData.age;
        const ageIdx = ageData.age_idx;

        //stack
        results.name = name;
        results.project = paseudoTrinity.project !== null ? paseudoTrinity.project : NaN;
        results.hole = paseudoTrinity.hole !== null ? paseudoTrinity.hole : NaN;
        results.section = paseudoTrinity.section !== null ? paseudoTrinity.section : NaN;
        results.distance = paseudoTrinity.distance !== null ? paseudoTrinity.distance : NaN;
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = NaN;
        results.age_mid = age.mid !== null ? age.mid : NaN;
        results.age_upper = age.upper !== null ? age.upper : NaN;
        results.age_lower = age.lower !== null ? age.lower : NaN;
        results.section_type = paseudoTrinity.section_type !== null ? paseudoTrinity.section_type : "";
        results.correlation_rank = 3;
        results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "Converted from Composite Depth. The trinity is paseudo data.";
        results.source_type = type;
        results.calc_type = "paseudo-depth";
      } else if (type == "event_free_depth") {
        //get efd
        const name = data[0];
        const efd = parseFloat(data[1]);
        const targetId = data[2];

        //get nearest trinity
        const paseudoTrinity = LCCore.getNearestTrinity(targetId, efd, "event_free_depth");

        //get paseudo cd
        const cd = LCCore.getCDfromEFD(efd);

        //calc age
        const ageData = LCAge.getAgeFromEFD(efd, method);
        const age = ageData.age;
        const ageIdx = ageData.age_idx;

        //stack
        results.name = name;
        results.project = paseudoTrinity.project !== null ? paseudoTrinity.project : NaN;
        results.hole = paseudoTrinity.hole !== null ? paseudoTrinity.hole : NaN;
        results.section = paseudoTrinity.section !== null ? paseudoTrinity.section : NaN;
        results.distance = paseudoTrinity.distance !== null ? paseudoTrinity.distance : NaN;
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = NaN;
        results.age_mid = age.mid !== null ? age.mid : NaN;
        results.age_upper = age.upper !== null ? age.upper : NaN;
        results.age_lower = age.lower !== null ? age.lower : NaN;
        results.section_type = paseudoTrinity.section_type !== null ? paseudoTrinity.section_type : "";
        results.correlation_rank = 3;
        results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "Converted from Event Free Depth. The trinity and CD are paseudo data.";
        results.source_type = type;
        results.calc_type = "paseudo-depth";
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
        const paseudoTrinity = LCCore.getNearestTrinity(targetId, dd, "drilling_depth");
        let send_data = [];
        let td = new Trinity();
        td.name         = name;
        td.project_name = paseudoTrinity.project;
        td.hole_name    = paseudoTrinity.hole;
        td.section_name = paseudoTrinity.section;
        td.distance     = paseudoTrinity.distance;
        send_data.push(td);

        //calc cd
        const cd_list = LCCore.getDepthFromTrinity(targetId, send_data, "composite_depth", options.isForceCalculation); //output:[sec id, cd]
        const cd = cd_list[0][1];

        //calc efd
        const efd_list = LCCore.getDepthFromTrinity(targetId, send_data, "event_free_depth", options.isForceCalculation); //output:[sec id, efd]
        const efd = efd_list[0][1];
        const new_rank = efd_list[0][2];

        //calc age
        const ageData = LCAge.getAgeFromEFD(efd, method);
        const age = ageData.age;
        const ageIdx = ageData.age_idx;

        //stack
        results.name = name;
        results.hole = paseudoTrinity.hole !== null ? paseudoTrinity.hole : NaN;
        results.section = paseudoTrinity.section !== null ? paseudoTrinity.section : NaN;
        results.distance = paseudoTrinity.distance !== null ? paseudoTrinity.distance : NaN;
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = dd !== null ? dd : NaN;
        results.age_mid = age.mid !== null ? age.mid : NaN;
        results.age_upper = age.upper !== null ? age.upper : NaN;
        results.age_lower = age.lower !== null ? age.lower : NaN;
        results.section_type = paseudoTrinity.section_type !== null ? paseudoTrinity.section_type : "";
        results.correlation_rank = 3;
        results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "NOT RECOMMENDED! Converted from Drilling Depth. The trinity, CD, EFD amd Age are paseudo data.";
        results.source_type = type;
        results.calc_type = "paseudo-depth";
      } else if (type == "age") {
        //get efd
        const name = data[0];
        const age = parseFloat(data[1]);
        const targetId = data[2];

        //calc efd
        const efdData = LCAge.getEFDFromAge(age, method);
        const efd = efdData.efd.mid;

        //get paseudo cd
        const cd = LCCore.getCDfromEFD(efd);

        //re-calc age
        const rage = LCAge.getAgeFromEFD(efd, method);

        //get nearest trinity
        const paseudoTrinity = LCCore.getNearestTrinity(targetId, efd, "composite_depth");

        //get age model idx
        let ageIdx = null;
        LCAge.AgeModels.forEach((a, s) => {
          if (a.id == LCAge.selected_id) {
            ageIdx = s;
          }
        });

        //stack
        results.name = name;
        results.project = paseudoTrinity.project !== null ? paseudoTrinity.project : NaN;
        results.hole = paseudoTrinity.hole !== null ? paseudoTrinity.hole : NaN;
        results.section = paseudoTrinity.section !== null ? paseudoTrinity.section : NaN;
        results.distance = paseudoTrinity.distance !== null ? paseudoTrinity.distance : NaN;
        results.cd = cd !== null ? cd : NaN;
        results.efd = efd !== null ? efd : NaN;
        results.dd  = NaN;
        results.age_mid = rage.age.mid !== null ? rage.age.mid : NaN;
        results.age_upper = rage.age.upper !== null ? rage.age.upper : NaN;
        results.age_lower = rage.age.lower !== null ? rage.age.lower : NaN;
        results.section_type = paseudoTrinity.section_type !== null ? paseudoTrinity.section_type : "";
        results.correlation_rank = 3;
        results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
        results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
        results.description               = "Converted from Age. The trinity and CD are paseudo data.";
        results.source_type = type;
        results.calc_type = "paseudo-depth";
      } else {
        results = null;
      }

      resultList.push(results);
    }

    if(progressBar!==null){
      //progressBar   = await updateProgress(progressBar, 1, 1);
      //progressBar.close();
      //progressBar = null;
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
      mainWindow.webContents.send("AlertRenderer", err);
    });

    //fatal error
    newLCCore.on('error_fatal', (err) => {
      console.error('LCCore => '+ err.statusDetails);
      mainWindow.webContents.send("AlertRenderer", err);
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
      history.setInitialState(LCCore.exportSerialisedModel());

      //register path
      globalPath.dataPaths.push({type:"csvmodel", path:fullpath});

      console.log('MAIN: Registered correlation model from "' + fullpath + '"' );
      return true
      
    } catch (error) {
      console.log(error);
      console.error("MAIN: Correlation model register error.");
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
        const result={};
        result.statusDetails = res;

        mainWindow.webContents.send("AlertRenderer", result);
        console.error("MAIN: ",res);
      }
      
    }catch(err){
      console.log(err)
    }
  }
  async function registerLCModel(fullpath){
    globalPath.dataPaths.push({type:"lcmodel",path:fullpath});

    //import data
    const inData = await loadmodelfile(mainWindow, fullpath);

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
  function registerCoreImage(fullpath, type, name){
    try{
      globalPath.dataPaths.push({type:type, path:fullpath, name:name});
      console.log("MAIN: Core images in the folder is registered.")
      return true
    }catch(err){
      return false
    } 
  }
  //--------------------------------------------------------------------------------------------------
  mainWindow.webContents.once("did-finish-load", () => {    
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
      mainWindow.webContents.send("SettingsData", rendererSettings);
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
                    if (settingsWindow) {
                      settingsWindow.focus();
                      return;
                    }
                
                    //create finder window
                    settingsWindow = new BrowserWindow({
                      title: "Settings",
                      width: 700,
                      height: 700,
                      webPreferences: {preload: path.join(__dirname, "preload", "preload_settings.js"),},
                    });
                    
                    //converterWindow.setAlwaysOnTop(true, "normal");
                    settingsWindow.on("closed", () => {
                      settingsWindow = null;
                      if (mainWindow && !mainWindow.isDestroyed()){
                        mainWindow.webContents.send("SettingsClosed", "");
                      }
                    });
                    settingsWindow.setMenu(null);
                
                    settingsWindow.loadFile(path.join(__dirname, "./renderer/settings.html"));
                
                    settingsWindow.once("ready-to-show", () => {
                      settingsWindow.show();
                      settingsWindow.setAlwaysOnTop(true, "floating");
                    //settingsWindow.webContents.openDevTools();
                      //converterWindow.setAlwaysOnTop(true, "normal");
                      const data = {
                        output_type:"export",
                        called_from:"main",
                        path:null,
                      }; 
                      mainWindow.webContents.send("SettingsMenuClicked", data);
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
                  const fullpath = await getfile(mainWindow, "Please chose Correlation model file", [{name: "LCmodel file", extensions: ["lcmodel"]}]);
                  await registerLCModel(fullpath);
                  mainWindow.webContents.send("UpdateViewFromMain");                },
              },
              {
                label: "Load Correlation Model from csv",              
                click: async() => {
                  const fullpath = await getfile(mainWindow, "Please chose Correlation model CSV file", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    registerModelFromCsv(fullpath);
                    //calc
                    LCCore.calcCompositeDepth();
                    LCCore.calcEventFreeDepth();
                    mainWindow.webContents.send("UpdateViewFromMain");
                  }
                },
              },
              { type: "separator" },
              {
                label: "Load Age model",
                click: async() => {
                  const fullpath = await getfile(mainWindow, "Please chose Age model CSV file", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log(fullpath)
                    //register
                    registerAgeFromCsv(fullpath);
                    mainWindow.webContents.send("UpdateViewFromMain");
                  }
                },
              },
              {
                label: "Load Core Images",
                click: async() => {
                  const imageDir = await getDirectory(mainWindow, "Please select image root directory.")
                  if(imageDir!==false){
                    //register path
                    globalPath.dataPaths.push({type:"core_images", path:imageDir});

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

                    mainWindow.webContents.send("LoadCoreImagesMenuClicked", coreImages);
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

                  mainWindow.webContents.send("ReloadMenuClicked", null);
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
                  const fullpath = await getfile(mainWindow, "Please Chose Correlation Model (fro LF)", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log("MAIN: Import correlation model for Level Finder from", fullpath)
                    registerModelFromCsv(fullpath, "forLF");
                    //calc
                    LCCore.calcCompositeDepth();
                    LCCore.calcEventFreeDepth();
                    mainWindow.webContents.send("UpdateViewFromMain");
                    
                    //mainWindow.webContents.send("ImportCorrelationModelForLFMenuClicked");
                  }
                },
              },
              {
                label: "Import Event List for Level Finder",
                click: async() => {
                  const fullpath = await getfile(mainWindow, "Please Chose Event List (for LF))", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log("MAIN: Import event list for Level Finder from", fullpath)
                    LCCore.loadEventListFromCsv(fullpath);
                    mainWindow.webContents.send("UpdateViewFromMain");                    
                    //mainWindow.webContents.send("ImportEventListForLFMenuClicked");
                  }
                },
              },
              {
                label: "Import Age Model for Level Finder",
                click: async() => {
                  const fullpath = await getfile(mainWindow, "Please chose Age model CSV file", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    console.log(fullpath)
                    //register
                    registerAgeFromCsv(fullpath, "LF");
                    mainWindow.webContents.send("UpdateViewFromMain");
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
                      const result = await putmodelfile(mainWindow, outData, null);
                      if(result){
                        globalPath.saveModelPath = result;
                        LCCore.updateVersionInfo();
                        history.saveState(LCCore.exportSerialisedModel(), "export lcmodel");
                      }                      
                    }else{
                      //save orverwrite
                      const result = await putmodelfile(mainWindow, outData, globalPath.saveModelPath);
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
                      globalPath.saveModelPath = await putmodelfile(mainWindow, outData, null);
                    }else{
                      //save orverwrite
                      globalPath.saveModelPath = await putmodelfile(mainWindow, outData, globalPath.saveModelPath);
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
                    globalPath.saveModelPath = await putmodelfile(mainWindow, outData, null);
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
                  mainWindow.webContents.send("ExportCorrelationAsLCMenuClicked");
                },
              },
              {
                label: "Export csv model for Level Finder",
                click: () => {
                  mainWindow.webContents.send("ExportCorrelationAsLFMenuClicked");
                },
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
  
                    const response = dialog.showMessageBoxSync(mainWindow, options);
  
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
                    mainWindow.webContents.send("EditCorrelation");
                  },
                },
                { type: "separator" },
                {
                  label: "Preferences",
                  click: () => {
                    if (settingsWindow) {
                      settingsWindow.focus();
                      return;
                    }
                
                    //create finder window
                    settingsWindow = new BrowserWindow({
                      title: "Settings",
                      width: 700,
                      height: 700,
                      webPreferences: {preload: path.join(__dirname, "preload", "preload_settings.js"),},
                    });
                    
                    //converterWindow.setAlwaysOnTop(true, "normal");
                    settingsWindow.on("closed", () => {
                      settingsWindow = null;
                      if (mainWindow && !mainWindow.isDestroyed()){
                        mainWindow.webContents.send("SettingsClosed", "");
                      }
                    });
                    settingsWindow.setMenu(null);
                
                    settingsWindow.loadFile(path.join(__dirname, "./renderer/settings.html"));
                
                    settingsWindow.once("ready-to-show", () => {
                      settingsWindow.show();
                      settingsWindow.setAlwaysOnTop(true, "floating");
                    //settingsWindow.webContents.openDevTools();
                      //converterWindow.setAlwaysOnTop(true, "normal");
                      const data = {
                        output_type:"export",
                        called_from:"main",
                        path:null,
                      }; 
                      mainWindow.webContents.send("SettingsMenuClicked", data);
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
                    mainWindow.webContents.send("EditCorrelation");
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
                  mainWindow,
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
                  mainWindow,
                  {
                  type: 'info',
                  title: 'Model statistics',
                  detail:text,
                  buttons: ['OK']
                });
                mainWindow.webContents.send("rendererLog", "Check results:");
                mainWindow.webContents.send("rendererLog", results);
              }
            }
          },
          {
            label: "Model evaluation",
            visible: false,
            click: () => {
              if(LCCore !== null && LCCore.projects.length>0){
                const results = LCCore.leaveOneOut("in");
                
                mainWindow.webContents.send("rendererLog", results);
                putcsvfile(mainWindow, "results.csv", results);                
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
                  mainWindow.webContents.send("ZoominMenuClicked");
                }
              },
              {
                label: "Zoom default",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  mainWindow.webContents.send("ZoomdefaultMenuClicked");
                }
              },
              {
                label: "Zoomout",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  mainWindow.webContents.send("ZoomoutMenuClicked");
                }
              },
              {
                label: "Zoom actual scale",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  mainWindow.webContents.send("ZoomactualMenuClicked");
                }
              },
            ]
          },            
          { type: "separator" },
          {
            label: "Unload all models",
            accelerator: "CmdOrCtrl+W",
            click: () => {
              mainWindow.webContents.send("UnLoadModelsMenuClicked");
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
              if (converterWindow) {
                converterWindow.focus();
                return;
              }
          
              //create finder window
              converterWindow = new BrowserWindow({
                title: "Converter",
                width: 700,
                height: 700,
                webPreferences: {preload: path.join(__dirname, "preload", "preload_converter.js"),},
              });
              
              //converterWindow.setAlwaysOnTop(true, "normal");
              converterWindow.on("closed", () => {
                converterWindow = null;
                if (mainWindow && !mainWindow.isDestroyed()){
                  mainWindow.webContents.send("ConverterClosed", "");
                }
              });

              converterWindow.setMenu(null);
          
              converterWindow.loadFile(path.join(__dirname, "./renderer/converter.html"));
          
              converterWindow.once("ready-to-show", () => {                
                //converterWindow.setAlwaysOnTop(true, "floating");
                converterWindow.show();
                converterWindow.focus();
                //converterWindow.webContents.openDevTools();
                //converterWindow.setAlwaysOnTop(true, "normal");
                const data = {
                  output_type:"export",
                  called_from:"main",
                  path:null,
                }; 
                converterWindow.webContents.send("ConverterMenuClicked", data);
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

              mainWindow.webContents.send("DividerMenuClicked", null);
            }
          },
          {
            label: "Labeler",
            accelerator: "CmdOrCtrl+L",
            click: () => {
              if (labelerWindow) {
                labelerWindow.focus();
                return;
              }
          
              tempCore = initialiseLCCore();
              tempCore.addProject("correlation","temp");
              tempCore.addHole(tempCore.projects[0].id,"temp");
  
              //create finder window
              labelerWindow = new BrowserWindow({
                title: "labeler",
                width: 800,
                height: 800,
                webPreferences: {preload: path.join(__dirname, "preload", "preload_labeler.js"),},
              });
              
              //converterWindow.setAlwaysOnTop(true, "normal");
              labelerWindow.on("closed", () => {
                labelerWindow = null;
                tempCore = null;
                if (mainWindow && !mainWindow.isDestroyed()){
                  mainWindow.webContents.send("LabelerClosed", "");
                }
              });
              labelerWindow.setMenu(null);
          
              labelerWindow.loadFile(path.join(__dirname, "./renderer/labeler.html"));
          
              labelerWindow.once("ready-to-show", () => {
                labelerWindow.show();
                //labelerWindow.setAlwaysOnTop(true, "normal");
                //labelerWindow.webContents.openDevTools();
                //converterWindow.setAlwaysOnTop(true, "normal");
                labelerWindow.webContents.send("LabelerMenuClicked");
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
              if (plotWindow) {
                plotWindow.show();
                plotWindow.focus();
                return;
              }
          
              isPlotterClose = false;

              //create finder window
              plotWindow = new BrowserWindow({
                title: "Plotter",
                parent:mainWindow,
                //resizable: false,
                width: 800,//full: 900
                height: 600,
                webPreferences: {preload: path.join(__dirname, "preload", "preload_plotter.js"),},
              });
              
              plotWindow.on("close", (e) => {
                if(isPlotterClose){
                  return;
                }
                
                e.preventDefault(); 
                
                plotWindow.hide();
                //plotWindow = null;
                if(mainWindow && !mainWindow.isDestroyed()){
                  mainWindow.webContents.send("PlotterHide", ""); 
                }
              });
              plotWindow.on("closed", () => {
                plotWindow = null; 
                if (mainWindow && !mainWindow.isDestroyed()){
                  if(mainWindow.webContents){
                    mainWindow.webContents.send("LabelerClosed", "");
                  }                  
                }
              });

              const customMenu = Menu.buildFromTemplate([
                  {
                    label: "Release loaded data",
                    click: () => {
                      plotWindow.webContents.send("PlotterCleared", "");  
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
          
              plotWindow.loadFile(path.join(__dirname, "./renderer/plotter.html"));

              let isData = false;
              if(LCPlot.data_collections.length>0){
                //plot data exost
                isData = true;
              }
          
              plotWindow.once("ready-to-show", () => {
                plotWindow.show();
                //plotWindow.setAlwaysOnTop(true, "floating");
                //plotWindow.webContents.openDevTools();
                plotWindow.webContents.send("PlotterMenuClicked", isData);
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

                  mainWindow.webContents.send("SnapshotMenuClicked", {
                    isShift: isShift
                  });
                }
              },
              {
                label: "Measure",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  mainWindow.webContents.send("MeasureMenuClicked");
                }
              }
            ]
          },          
          { type: "separator" },
          {
            label: "Developer tool",
            click: () => {
              if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
              } else {
                mainWindow.webContents.openDevTools();
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
                { label: "Check update", click: async()=>{await checkUpdate(mainWindow, "button")}},
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
                { label: "Check update", click: async()=>{await checkUpdate(mainWindow, "button")}},
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
      if (!progress.isCompleted()) {
        progress.setCompleted();
      }
      return null;
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
      mainWindow.webContents.send("AlertRenderer", serializeError);
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
        mainWindow.webContents.send("AlertRenderer", err);
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

//--------------------------------------------------------------------------------------------------
//create sub window
function createNewWindow(title, htmlPath, preloadPath) {
  const newWindow = new BrowserWindow({
    title: title,
    width: 630,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, preloadPath),
    },
  });
  newWindow.loadFile(path.join(__dirname, htmlPath));
  return newWindow;
}
//--------------------------------------------------------------------------------------------------
function mean(arr, useAbs = false) {
  return arr.reduce((a, b) => a + (useAbs ? Math.abs(b) : b), 0) / arr.length;
}
//--------------------------------------------------------------------------------------------------
//create about window
function createAboutWindow() {
  // make window
  const aboutWindow = new BrowserWindow({
    title: "About Level Compiler",
    parent: mainWindow,
    width: 500,
    height: 300,
    webPreferences: {preload: path.join(__dirname, "preload", "preload_about.js"),},
  });
  aboutWindow.setMenu(null);
  aboutWindow.loadFile(path.join(__dirname, "./renderer/about.html"));

  

  aboutWindow.once("ready-to-show", () => {
    aboutWindow.show();
    //aboutWindow.setAlwaysOnTop(true, "floating");
    //aboutWindow.webContents.openDevTools();
    //converterWindow.setAlwaysOnTop(true, "normal");
    aboutWindow.webContents.send("Version", app.getVersion());
  });
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
    mainWindow.webContents.send("rendererLog", err);
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
  mainWindow.once("ready-to-show", () => {
    checkUpdate(mainWindow, "startup");
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
