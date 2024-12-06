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
const https = require('https');
const { autoUpdater} = require('electron-updater');

const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require("electron");
const { LevelCompilerCore } = require("./LC_modules/LevelCompilerCore.js");
const { Project } = require("./LC_modules/Project.js");
const { lcfnc } = require("./LC_modules/lcfnc.js");
const { LevelCompilerAge } = require("./LC_modules/LevelCompilerAge.js");
const { LevelCompilerPlot } = require("./LC_modules/LevelCompilerPlot.js");
const { UndoManager } = require("./LC_modules/UndoManager.js");
const { Trinity } = require("./LC_modules/Trinity.js");
const { Section } = require("./LC_modules/Section.js");
const { Marker } = require("./LC_modules/Marker.js");
const { send, availableMemory } = require("process");
const { Worker } = require('worker_threads');
const { isString } = require("util");
const { resolve } = require("dns");
const { rejects } = require("assert");

//mode properties
const isMac = process.platform === "darwin";
const isDev = false;//process.env.NODE_ENV !== "development"; //const isDev = false;
let isEditMode = false;

//main properties
let LCCore = new LevelCompilerCore();
let LCAge  = new LevelCompilerAge();;
let LCPlot = new LevelCompilerPlot();
const history = new UndoManager();
let labelerHistory = new UndoManager();
let tempCore = null; //for labeler
let globalPath = {
  saveModelPath:null,
  dataPaths:[], //{type:[lcmodel, csvmodel, csvage, csvplot], path:""}
};

//windows
let finderWindow = null;
let dividerWindow = null;
let converterWindow = null;
let importerWindow = null;
let labelerWindow = null;
let settingsWindow = null;
let plotWindow = null;
let progressBar = null;

function createMainWIndow() {
  const mainWindow = new BrowserWindow({
    title: "Level Compiler",
    width: isDev ? 2000 : 1000,
    height: 800,
    webPreferences: {
      //nodeIntegration: false, //Do not change for security reason
      //contextIsolation: true, //Do not change for security reason
      preload: path.join(__dirname, "preload.js"),
    },
    icon: "./icon/levelcompiler.png",
  });

  //open devtools if in dev env
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.loadFile(path.join(__dirname, "./renderer/index.html"));
  mainWindow.on('close', () => {
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
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
    if (plotWindow && !plotWindow.isDestroyed()) {
      plotWindow.close();
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

    console.log("MAIN: Project correlation data is initialised.");
    return JSON.parse(JSON.stringify(LCCore));
  });
  ipcMain.handle("InitialiseAgeModel", async (_e) => {
    //initialise
    LCAge = new LevelCompilerAge();
    LCCore.calcMarkerAges(LCAge);
    console.log("MAIN: Project age data is initialised.");
    return;
  });
  ipcMain.handle("InitialisePlotAgeCollection", async (_e) => {
    //import modeln
    LCPlot.age_collections = [];
    LCPlot.age_selected_id = null;
    console.log("MAIN: Project age plot data is initialised.");
    return;
  });
  ipcMain.handle("InitialisePlotDataCollection", async (_e) => {
    //import modeln
    LCPlot.data_collections = [];
    LCPlot.data_selected_id = null;
    console.log("MAIN: Project plot data collection is initialised.");
    return;
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
    console.log("MAIN: Load correlation model.");
    return JSON.parse(JSON.stringify(LCCore));
  });
  ipcMain.handle("LoadAgeFromLCAge", async (_e, age_id) => {
    //apply latest age model to the depth model
    let model_name = null;

    //set new id
    LCAge.selected_id = age_id;

    //get model name
    LCAge.AgeModels.forEach((model) => {
      if (model.id == LCAge.selected_id) {
        model_name = model.name;
      }
    });

    if (model_name == null) {
      return null;
    }

    //load ages into LCCore
    LCCore.calcMarkerAges(LCAge);
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

    console.log("MAIN: Load age model into LCCore. id: " +  LCAge.selected_id + " name:" +  model_name);

    return JSON.parse(JSON.stringify(LCCore));
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
      console.log(fullpath)
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
    let result = false;
    for(const target of targetList){
      const res = findFileInDir(target.path, name, "check");
      if(res[0]==true){
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
      if(pathData.ext==""){
        //case folder
        dirPath = path.join(pathData.dir, pathData.name);
        //register path
        registerCoreImage(dirPath, type, null);
      }else if(pathData.ext==".jpg"){
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
        return null
      }
      console.log("MAIN: Load images: N = "+loadOptions.targetIds.length+"; Operations: "+loadOptions.operations);

      //make tasks
      const NUM_WORKERS = Math.min(Math.round(os.cpus().length/2,0), loadOptions.targetIds.length);
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
            targetSectionData = targetHoleData.sections[idx[2]];
          }else if(type=="labeler"){
            targetHoleData = tempCore.projects[0].holes[0];
            targetSectionData = targetHoleData.sections[0];
          }
          
          let imBaseName = targetHoleData.name +"-"+targetSectionData.name;
         

          //get image path
          let fullpath;
          if(imBaseName.includes(".jpg")){
            fullpath = findFileInDir(target.path, imBaseName, "get");
          }else{
            fullpath = findFileInDir(target.path, imBaseName+".jpg", "get");
          }

          if(fullpath.length==0){
            continue
          }
  
          //calc new image size
          let new_height = Math.round(loadOptions.dpcm * (targetSectionData.markers[targetSectionData.markers.length - 1].distance - targetSectionData.markers[0].distance), 0);
          if(new_height > loadOptions.dpcm * 120){
            new_height = loadOptions.dpcm * 120;
          }
          //calc resize        
          const new_size = { height: new_height, width: 1 };
  
          tasks.push({
            type:"continue",
            imageName:imBaseName,
            imagePath:fullpath[0],
            imageSize:new_size,
            operations:loadOptions.operations,
            sectionData:targetSectionData,
          })  
        }
      }      

      if(tasks.length==0){
        console.log("MAIN: Failed to get tasks", targetList, loadOptions);
        return null
      }
      //submit
      //make worker
      numTotalTasks =tasks.length;
      progressBar = progressDialog(mainWindow, "Load modeled section images", "Now converting...");
      progressBar = await updateProgress(progressBar, 0, numTotalTasks);
      const workers = await initialiseWorkerPool(NUM_WORKERS, tasks, idleWorkers, coreImages);

      while (tasks.length > 0 && idleWorkers.length > 0) {
        processNextTask(tasks, idleWorkers);
      }

      // Wait for all workers to finish
      await new Promise((resolve, reject) => {
        workers.forEach((worker) => {
          worker.on("exit", (code) => {
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
        });
      });

      if(progressBar!==null){
        progressBar = await updateProgress(progressBar, numTotalTasks, numTotalTasks);
        progressBar = null;
      }
      return coreImages;
    }catch(err){
      return null;
    }
      //-----------------------------------------------------------
      
      async function initialiseWorkerPool(numWorkers, tasks, idleWorkers, taskResults) {
        const workers = [];  
        let n = 0;
        for (let i = 0; i < numWorkers; i++) {
          const worker = new Worker(path.join(__dirname, './LC_modules/makeModelImageWorker.js'));
          workers.push(worker);
          idleWorkers.push(worker);
      
          // when completed//errored
          worker.on("message", async(result) => {
            //console.log("MAIN: Worker finished task.");
            n +=1;
            progressBar = await updateProgress(progressBar, n, numTotalTasks);
            // if get result
            mergeMissingKeys(taskResults, result);
      
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
      bt_zoomout:     path.join(resourcePath, "resources","tool","zoomout.png"),
      bt_measure:     path.join(resourcePath, "resources","tool","measure.png"),
      bt_snapshot:    path.join(resourcePath, "resources","tool","snapshot.png"),
      bt_pen:         path.join(resourcePath, "resources","tool","pen.png"),
      bt_divider:     path.join(resourcePath, "resources","tool","divider.png"),
      bt_grid:        path.join(resourcePath, "resources","tool","grid.png"),
      bt_rank:        path.join(resourcePath, "resources","tool","rank.png"),
      bt_target:      path.join(resourcePath, "resources","tool","target.png"),
      bt_event_layer: path.join(resourcePath, "resources","tool","event.png"),
      bt_core_photo:  path.join(resourcePath, "resources","tool","core_photo.png"),
      bt_connection:  path.join(resourcePath, "resources","tool","connection.png"),
      bt_chart:       path.join(resourcePath, "resources","tool","chart.png"),
      bt_show_labels: path.join(resourcePath, "resources","tool","label.png"),
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
  




  ipcMain.handle("progressbar", async (_e, tit, txt) => {
    progressBar = null;
    progressBar = progressDialog(mainWindow, tit, txt);

    await new Promise(resolve => setTimeout(resolve, 100));
    progressBar.detail = "Processing...";
  });
  ipcMain.handle("updateProgressbar", async (_e, n, N) => {
    progressBar = await updateProgress(progressBar, n, N);
  });
  ipcMain.handle("clearProgressbar", async (_e, n, N) => {
      progressBar = null;    
  });
  

  ipcMain.handle("askdialog", (_e, tit, txt) => {
    const options = {
      type: "question",
      buttons: ["No", "Yes"],
      defaultId: 0,
      title: tit,
      message: txt,
    };

    const response = dialog.showMessageBox(null, options);
    return response;
  });
  ipcMain.handle("inputdialog", async (_e, data,) => {
    //type:text, password, email, number, url, date, time, color, range
    try {
      const result = await prompt({
          title: data.title,
          label: data.label,
          value: data.value,
          height:200,
          width:500,
          alwaysOnTop:true,
          inputAttrs: {
              type: data.type,
              required: true,
              step: '0.0001' ,
          },
          type: "input"
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
                label: 'Merge projects', 
                click: () => {
                  console.log('MAIN: Merge Projects'); 
                  resolve("mergeProjects"); 
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
                label: 'Edit name', 
                click: () => {
                  console.log('MAIN: Edit section name'); 
                  resolve("changeSectionName"); 
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
                label: 'Edit distance', 
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
          { type: 'separator' },
          {
            label: 'Load high-resolution image', 
            click: () => {
              console.log('MAIN: Load high-resolution image'); 
              resolve("loadHighResolutionImage");                      
            } 
          },
          {
            label:"Cancel",
            click: () => {
              resolve("cancel"); 
            }
          },
        ];
        
      }else if(type=="normalContextMenu"){
        //template = [  ] 
        return
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
            label:"Image",
            submenu:[
              { 
                label: 'Load high-resolution image', 
                click: () => {
                  console.log('MAIN: Load high-resolution image'); 
                  resolve("loadHighResolutionImage");                      
                } 
              },
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
          }
        ] 
      }
       
      const menu = Menu.buildFromTemplate(template);
      menu.popup(BrowserWindow.fromWebContents(event.sender));
    });
  });
  

  ipcMain.handle("ExportCorrelationAsCsvFromRenderer", async (_e, MD) => {
    let exportLCCore = initialiseLCCore();
    
    //exportLCCore <- MD
    assignObject(exportLCCore, MD);

    //make export array
    let outputArray = exportLCCore.constructCSVModel();
    const saveName = "[correlation]"+exportLCCore.projects[0].name+"("+exportLCCore.projects[0].correlation_version+").csv"; 

    putcsvfile(mainWindow, saveName, outputArray);
    
  });
  ipcMain.handle("InitialiseTempCore", async (_e) => {
    //import modeln
    labelerHistory = new UndoManager();
    tempCore = initialiseLCCore();
    tempCore.addProject("correlation","temp");
    tempCore.addHole([1,null,null,null],"temp");

    globalPath.dataPaths = globalPath.dataPaths.filter(data => data.type !== "labeler");

    console.log("MAIN: Labeler Project data is initialised.");
    return JSON.parse(JSON.stringify(tempCore));
  });
  
  ipcMain.handle("LabelerAddSectionData", async (_e, holeName, sectionName) => {
    //change temp hole name
    tempCore.changeName([1,1,null,null],holeName);

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
    tempCore.addSection([1,1,null,null], inData);

    return JSON.parse(JSON.stringify(tempCore));
  });
  ipcMain.handle("LabelerAddMarkerData", async (_e, name, depth, relative_x) => {
    //add marker
    tempCore.addMarker([1,1,1,null],depth,"distance",relative_x);
    const nearMarkers = tempCore.getMarkerIdsByDistance([1,1,1,null],depth);

    if(nearMarkers[2]==0){
      tempCore.changeName(nearMarkers[0], name);
    }else if(nearMarkers[3]==0){
      tempCore.changeName(nearMarkers[1], name);
    }
    tempCore.sortModel();

    return JSON.parse(JSON.stringify(tempCore));
  });
  ipcMain.handle("LabelerChangeMarker", (_e, markerId, type, value) => {
    //
    const idx = tempCore.search_idx_list[markerId.toString()];
    
    if(type == "distance"){
      //value:distance
      const result = tempCore.changeDistance(markerId, parseFloat(value));
      if(result == true){
        return JSON.parse(JSON.stringify(tempCore));
      }else{
        console.log("LABELER: "+result)
        return JSON.parse(JSON.stringify(tempCore));
      }
    }else if(type=="name"){
      const result = tempCore.changeName(markerId, value)
      if(result == true){
        return JSON.parse(JSON.stringify(tempCore));
      }else{
        console.log("LABELER: "+result)
        return JSON.parse(JSON.stringify(tempCore));
      }
    }else if(type == "drilling_depth"){
      //value:distance
      const result = tempCore.changeDrillingDepth(markerId, parseFloat(value));
      if(result == true){
        return JSON.parse(JSON.stringify(tempCore));
      }else{
        console.log("LABELER: "+result)
        return JSON.parse(JSON.stringify(tempCore));
      }
    }
  });
  ipcMain.handle("LabelerDeleteMarker", (_e, markerId) => {
    //console.log(markerId)
    const result = tempCore.deleteMarker(markerId);
    if(result == true){
      return JSON.parse(JSON.stringify(tempCore));
    }else{
      console.log("LABELER: "+result)
      return JSON.parse(JSON.stringify(tempCore));
    }

  });
  ipcMain.handle("LabelerSaveData", (_e, data) => {
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


      dialog
      .showOpenDialog({
        title: "Please select a folder to save",
        defaultPath: app.getPath("desktop"),
        buttonLabel: "Save",
        properties: ["openDirectory", "createDirectory"],
      })
      .then((result) => {
        if (!result.canceled && result.filePaths[0]) {
          //save original image
          fs.writeFileSync(path.join(result.filePaths[0], dataName+".jpg"), originalImage);
          //save labeled image
          fs.writeFileSync(path.join(result.filePaths[0], dataName+"_definition.jpg"), labeledImage);
          //save annotation
          fs.writeFileSync(path.join(result.filePaths[0], dataName+".lcsection"), annotationData);
          console.log("MAIN: Save "+dataName+" at "+path.join(result.filePaths[0]))
          return true
        }
      })
      .catch((err) => {
        console.log(err);
        return err;
      });
      

  });
  ipcMain.handle("LabelerLoadSectionModel", (_e, dirHandle, fileName) => {
    try{
      //get file path
      const pathData = path.parse(dirHandle);
      let fullpath = null;
      if(pathData.ext==""){
        //case folder
        const dirPath = path.join(pathData.dir, pathData.name);
        fullpath = path.join(dirPath, fileName);
      }else if(pathData.ext==".jpg"){
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
        console.log(fullpath)
        const fileContent = fs.readFileSync(fullpath, 'utf8');
        const sectionData = JSON.parse(fileContent);

        //register to model
        const name = fileName;
        const holeName = name.split(/[-.]+/)[0];
        const sectionName = name.split(/[-.]+/)[1];
        Object.assign(tempCore.projects[0].holes[0].sections[0], sectionData);

        return JSON.parse(JSON.stringify(tempCore));
      }else{
        
        return false
      }
    }catch(err){
      console.error('Error loading file:', err);
      return false
    } 

  });
  ipcMain.handle("LabelerLoadModel", (_e) => {
    return JSON.parse(JSON.stringify(tempCore));
  });
  ipcMain.handle("PlotterGetData", (_e, data) => {
    if (converterWindow) {
      converterWindow.focus();
      return;
    }

    //create finder window
    converterWindow = new BrowserWindow({
      title: "Converter",
      width: 700,
      height: 800,
      webPreferences: {preload: path.join(__dirname, "preload_converter.js"),},
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
      converterWindow.setAlwaysOnTop(true, "normal");
      //converterWindow.webContents.openDevTools();
      //converterWindow.setAlwaysOnTop(true, "normal");
      converterWindow.webContents.send("ConverterMenuClicked", data);
    });   
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
      width: 700,
      height: 700,
      webPreferences: {
        preload: path.join(__dirname, "preload_converter.js"),
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
      //importerWindow.setAlwaysOnTop(true, "normal");
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

  ipcMain.handle("LoadPlotFromLCPlot", async (_e) => {
    //calc latest age and depth
    //LCPlot.calcAgeCollectionPosition(LCCore, LCAge);
    //LCPlot.calcDataCollectionPosition(LCCore, LCAge);

    //LC plot age_collection id is as same as LCAge id
    LCPlot.age_selected_id = LCAge.selected_id;


    if (LCPlot) {
      console.log("MAIN: Load plot data from LCPlot");
      return LCPlot;
    }
  });

  ipcMain.handle("CalcCompositeDepth", async (_e) => {
    //import model
    console.log("MAIN: Calc composite depth.");
   
    LCCore.calcCompositeDepth(LCCore.base_project_id);

    return JSON.parse(JSON.stringify(LCCore));
  });

  ipcMain.handle("CalcEventFreeDepth", async (_e) => {
    //import model
    console.log("MAIN: Calc event free depth");
    LCCore.calcEventFreeDepth(LCCore.base_project_id);
    //LCCore.getModelSummary();
    return JSON.parse(JSON.stringify(LCCore));
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
  ipcMain.on("dividerDefinitionFromActural", async (_e, depthData, targetData) => {
    //calc 
    //depthData: [holeId, secId, depthData], targetData
    //targetData: [[name, data1...],[name, data2...]]
    if (!LCCore) {
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
      return parseFloat(item1[1]) - parseFloat(item2[1]);
    });

    //make correlation list
    let depthList = [];
    for(let c=0; c<depthData[2].length;c++){
      const defDist= parseFloat(depthData[2][c][1]); //correlation definition distance
      const actDist= parseFloat(depthData[2][c][2]); //correlation actural distance 

      let td_cr = new Trinity();
      td_cr.name         = depthData[2][0];
      td_cr.project_name = LCCore.getDataByIdx(LCCore.search_idx_list[[crId[0], null,    null,    null].toString()]).name;
      td_cr.hole_name    = LCCore.getDataByIdx(LCCore.search_idx_list[[crId[0], crId[1], null,    null].toString()]).name;
      td_cr.section_name = LCCore.getDataByIdx(LCCore.search_idx_list[[crId[0], crId[1], crId[2], null].toString()]).name;
      td_cr.distance     = defDist;

      //convert depth (listed for function)
      const cd_list = LCCore.getDepthFromTrinity(crId, [td_cr], "composite_depth"); //output:[sec id, cd, rank]
      const defCD = cd_list[0][1];

      if(!isNaN(defDist) && !isNaN(actDist)){
        depthList.push({
          correlation_name: depthData[2][c][0],
          section_id: depthData[1],
          project_name: td_cr.project_name,
          hole_name: td_cr.hole_name,
          section_name: td_cr.section_name,
          definition_distance: defDist,
          actural_distance: actDist,
          definition_cd: defCD,
        });
      }
    }

    //console.log(depthList);
    let resultList = [];
    for(let t=0; t<targetData.length;t++){
      //D1 <- d1
      //D2    d2
      //D3    d4
      
      //initialise
      //each row data
      const targetRowData = targetData[t];
      //results contains sampling point of upper/lower info
      result = {
        name:    targetRowData[0],
        project: depthList[0].project_name,
        hole:    depthList[0].hole_name,
        section: depthList[0].section_name,
        definition_distance_lower:null,
        definition_distance_upper:null,
        definition_cd_upper: null,
        definition_cd_lower: null,
        definition_efd_upper: null,
        definition_efd_lower: null,
        target_distance_lower: parseFloat(targetRowData[2]),
        target_distance_upper: parseFloat(targetRowData[1]),
        age_mid_lower:null,
        age_mid_upper:null,
        age_upper_lower:null,
        age_upper_upper:null,
        age_lower_lower:null,
        age_lower_upper:null,
        calc_type_upper: null,
        calc_type_lower: null
      }

      //calc upper/lower
      for(let ul=1;ul<3;ul++){
        //search nearest index
        const targetActuralDist = parseFloat(targetRowData[ul]);//uppder/lower actural
        let upperIdx = -Infinity;
        let lowerIdx = Infinity;
        for(let i=0;i<depthList.length;i++){
          if(depthList[i].actural_distance - targetActuralDist <= 0 && i > upperIdx ){
            upperIdx = i;
          }
          if(depthList[i].actural_distance - targetActuralDist >= 0 && i < lowerIdx){
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

          if(D3Idx > depthList.length && D3Idx < 0){
            output.push(result);
            break;
          }

          let D2     = depthList[D2Idx].definition_cd;
          let D3     = depthList[D3Idx].definition_cd;
          const d1   = targetActuralDist;
          const d2   = depthList[D2Idx].actural_distance;
          const d3   = depthList[D3Idx].actural_distance;
          const d3d2 = d3 - d2;
          const d3d1 = d3 - d1;
          const D1cd = LCCore.linearExtrap(D2, D3, d3d2, d3d1, "nearest");

          D2 = depthList[D2Idx].definition_distance;
          D3 = depthList[D3Idx].definition_distance;
          const D1dist = LCCore.linearExtrap(D2, D3, d3d2, d3d1, "nearest");


          if(ul == 1){
            result.definition_distance_upper = D1dist;
            result.definition_cd_upper       = D1cd
            result.calc_type_upper           = "extrapolation";
          }else{
            result.definition_distance_lower = D1dist;
            result.definition_cd_lower       = D1cd
            result.calc_type_lower           = "extrapolation";
          }
        } else {
          //case inter polation---------------------------------------
          let D1 = depthList[upperIdx].definition_cd;
          let D3 = depthList[lowerIdx].definition_cd;
          const d1 = depthList[upperIdx].actural_distance;
          const d2 = targetActuralDist;
          const d3 = depthList[lowerIdx].actural_distance;
          const d2d1 = d2 - d1;
          const d3d1 = d3 - d1;

          const D2cd = LCCore.linearInterp(D1, D3, d2d1, d3d1);

          D1 = depthList[upperIdx].definition_distance;
          D3 = depthList[lowerIdx].definition_distance;
          const D2dist = LCCore.linearInterp(D1, D3, d2d1, d3d1);

          if(ul == 1){
            result.definition_distance_upper = D2dist;
            result.definition_cd_upper       = D2cd;
            result.calc_type_upper           = "interpolation";
          }else{
            result.definition_distance_lower = D2dist;
            result.definition_cd_lower       = D2cd;
            result.calc_type_lower           = "interpolation";
          }
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

      //
      resultList.push(result);
    }

    _e.returnValue = resultList;    
  });

  ipcMain.handle("OpenDivider", async (_e) => {
    if (dividerWindow) {
      dividerWindow.focus();
      dividerWindow.webContents.send("DividerToolClicked", "");
      return;
    }

    //create finder window
    dividerWindow = new BrowserWindow({
      title: "Divider",
      width: 1500,
      height: 800,
      webPreferences: {
        preload: path.join(__dirname, "preload_divider.js"),
      },
    });

    dividerWindow.on("closed", () => {
      dividerWindow = null;
      mainWindow.webContents.send("DividerClosed", "");
    });
    dividerWindow.setMenu(null);

    dividerWindow.loadFile(path.join(__dirname, "./renderer/divider.html"));

    dividerWindow.once("ready-to-show", () => {
      dividerWindow.show();
      //dividerWindow.webContents.openDevTools();
      // /dividerWindow.setAlwaysOnTop(true, "normal");
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

  ipcMain.on("dividerExport", async (_e, data) => {
    putcsvfile(mainWindow, null, data);    
    console.log("MAIN: Exported Divided data.");
  });
  ipcMain.handle("OpenFinder", async (_e) => {
    if (finderWindow) {
      finderWindow.focus();
      finderWindow.webContents.send("FinderToolClicked", "");
      return;
    }

    //create finder window
    finderWindow = new BrowserWindow({
      title: "Finder",
      width: 230,
      height: 550,
      webPreferences: {
        preload: path.join(__dirname, "preload_finder.js"),
      },
    });

    finderWindow.on("closed", () => {
      finderWindow = null;
      mainWindow.webContents.send("FinderClosed", "");
    });
    finderWindow.setMenu(null);

    finderWindow.loadFile(path.join(__dirname, "./renderer/finder.html"));

    finderWindow.once("ready-to-show", () => {
      finderWindow.show();
      //finderWindow.webContents.openDevTools();
      finderWindow.setAlwaysOnTop(true, "floating");
      finderWindow.webContents.send("FinderToolClicked", "");
    });
  });
  ipcMain.handle("CloseFinder", async (_e) => {
    if (finderWindow) {
      finderWindow.close();
      finderWindow = null;
      return;
    }
  });
  ipcMain.handle("Confirm", async (event, title, message) => {
    const options = {
      type: "question",
      buttons: ["Yes", "No"],
      title: title,
      message: message,
    };
    const result = await dialog.showMessageBox(options);
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
      const result = await history.undo({LCCore:LCCore, LCAge:LCAge, LCPlot:LCPlot});   
      if(result !== null){
        //Undo deep copy
        assignObject(LCCore, result.LCCore);
        assignObject(LCAge, result.LCAge);
        assignObject(LCPlot, result.LCPlot);
        console.log("MAIN: Undo loaded.");
        return true;
      }else{
        return false;
      }
    }else if(type=="labeler"){
      const result = await labelerHistory.undo({tempCore:tempCore});   
      if(result !== null){
        //Undo deep copy
        assignObject(tempCore, result.tempCore);
        console.log("MAIN: Undo loaded.");
        return true;
      }else{
        return false;
      }
    }
    
  });
  ipcMain.handle("sendRedo", async (_e, type) => {
    if(type=="main"){
      const result = await history.redo({LCCore:LCCore, LCAge:LCAge, LCPlot:LCPlot});
      
      if(result !== null){
        assignObject(LCCore, result.LCCore);
        assignObject(LCAge,  result.LCAge);
        assignObject(LCPlot, result.LCPlot);
        console.log("MAIN: Redo loaded.");
        return true;
      }else{
        return false;
      }
    }else if(type=="labeler"){
      const result = await labelerHistory.redo({tempCore:tempCore});   
      if(result !== null){
        //Undo deep copy
        assignObject(tempCore, result.tempCore);
        console.log("MAIN: Redo loaded.");
        return true;
      }else{
        return false;
      }
    }
  });
  ipcMain.handle("sendSaveState", async (_e, type) => {
    if(type=="main"){
      history.saveState({LCCore:LCCore, LCAge:LCAge, LCPlot:LCPlot});
      console.log("MAIN: State saved. Num of history is " + history.undoStack.length);    
      return true;
    }else if(type=="labeler"){
      labelerHistory.saveState({tempCore:tempCore});
      console.log("MAIN: State saved. Num of history is " + labelerHistory.undoStack.length);    
      return true;
    }
  });
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

  ipcMain.handle("cvtLoadCsv", async (_e, title, ext, path) => {
    let result = null;
    if(path==null){
      result = await getfile(mainWindow, title, ext);
    }else{
      result = path;
    }

    if (result !== null) {
      try {
        const csvData = parse(fs.readFileSync(result, "utf8"), {
          columns: false,
          delimiter: ",",
        });
        return [csvData, result];
      } catch (error) {
        console.log(error);
        console.error(
          "Fail to read csv file. There is no such a file named: " + result
        );
        return [null, null];
      }
    } else {
      return [null, null];
    }
  });
  ipcMain.handle("cvtExport", async (_e, data) => {
    //console.log(data);
    putcsvfile(mainWindow, null, data);
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
    if (isFix) {
      finderWindow.setAlwaysOnTop(true, "normal");
    } else {
      finderWindow.setAlwaysOnTop(false);
    }
  });
  ipcMain.handle("getSectionLimit", async (_e, projectId, holeName, sectionName) => {
      const idx = LCCore.getIdxFromTrinity(projectId, [holeName, sectionName, ""]);

      const sectionData = LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
      const dist_upper = sectionData.markers[0].distance;
      const dist_lower = sectionData.markers[sectionData.markers.length - 1].distance;
      return [dist_upper, dist_lower];
    }
  );
  ipcMain.handle("MoveToHorizon", async (_e, data) => {
    mainWindow.webContents.send("MoveToHorizonFromFinder", data);
  });
  ipcMain.handle("terminalLog", async (_e, data) => {
    console.log(data);
  });
  ipcMain.handle("rendererLog", async (_e, data) => {
    mainWindow.webContents.send("rendererLog", data);
  });
  ipcMain.handle("sendImportedData", async (_e, data) => {
    data.name = path.basename(data.path);
    if(data.send_to == "main"){
      LCPlot.addDataset(data.name, data.data);
      mainWindow.webContents.send("importedData", LCPlot);
    }else if(data.send_to == "plotter"){      
      LCPlot.addDataset(data.name, data.data);
      LCPlot.sortDataBy("composite_depth")
      plotWindow.webContents.send("importedData", LCPlot);
      console.log("MAIN: Plot Data is imported into Plotter.")
    }
    
  });
  ipcMain.handle("depthConverter", async (_e, data, type, method) => {
    //data: ["name","depth_data","target_id"] e.g. ["name",[projectName(no use),holeName, sectionName, distance],[null, null, null, null]]
    //type: "trinity", "composite_depth", "event_free_depth","age"
    //method(age): "linear"
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
      correlation_rank: null,
      correlation_model_version: null,
      event_model_version: null,
      age_model_version: null,
      description: null,
      source_type:null
    };

    if (type == "trinity") {
      //calc each depth 
      let send_data = [];
      let td = new Trinity();
      td.name         = data[0];
      td.project_name = data[1][0];
      td.hole_name    = data[1][1];
      td.section_name = data[1][2];
      td.distance     = parseFloat(data[1][3]);
      send_data.push(td);
      let targetId    = data[2];

      //convert depth (listed for function)
      const cd_list = LCCore.getDepthFromTrinity(targetId, send_data, "composite_depth"); //output:[sec id, cd, rank]
      const cd = [];
      cd.push(cd_list[0][1]);
      let calcedId = cd_list[0][0];
      
      //
      const efd_list = LCCore.getDepthFromTrinity(targetId, send_data, "event_free_depth"); //output:[sec id, efd, rank]
      const efd = efd_list[0][1];
      const new_rank = efd_list[0][2];

      const dd_list = LCCore.getDepthFromTrinity(targetId, send_data, "drilling_depth"); //output:[sec id, efd, rank]
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

      //stack
      results.name     = send_data[0] !== undefined ? send_data[0].name : NaN;
      results.project  = calcedIdx !== null && calcedIdx !== undefined ? LCCore.projects[calcedIdx[0]].name : NaN;
      results.hole     = send_data[0] !== undefined ? send_data[0].hole_name : NaN;
      results.section  = send_data[0] !== undefined ? send_data[0].section_name : NaN;
      results.distance = send_data[0] !== undefined ? send_data[0].distance : NaN;
      results.cd  = cd !== null ? cd[0] : NaN;
      results.efd = efd !== null ? efd : NaN;
      results.dd  = dd !== null ? dd : NaN;
      results.age_mid   = age.age.mid   !== null ? age.age.mid   : NaN;
      results.age_upper = age.age.upper !== null ? age.age.upper : NaN;
      results.age_lower = age.age.lower !== null ? age.age.lower : NaN;
      results.correlation_rank = new_rank !== null ? new_rank : NaN;
      results.correlation_model_version = calcedIdx !== null ? LCCore.projects[calcedIdx[0]].correlation_version : NaN;
      results.event_model_version       = calcedIdx !== null ? LCCore.projects[calcedIdx[0]].correlation_version : NaN;
      results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
      results.description               = "Converted from trinity.";
      results.source_type = type;
    } else if (type == "composite_depth") {
      //get cd
      const name     = data[0];
      const cd       = data[1];
      const targetId = data[2];

      //get nearest trinity return: [index: , project: , hole: , section: , distance: ]
      const paseudoTrinity = LCCore.getNearestTrinity(targetId, cd, "composite_depth");

      //calc efd
      const efd = LCCore.getEFDfromCD(cd);

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
      results.correlation_rank = 3;
      results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
      results.description               = "Converted from Composite depth. The trinity is paseudo data.";
      results.source_type = type;
    } else if (type == "event_free_depth") {
      //get efd
      const name = data[0];
      const efd = data[1];
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
      results.correlation_rank = 3;
      results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
      results.description               = "Converted from Event Free Depth. The trinity and CD are paseudo data.";
      results.source_type = type;
    } else if (type == "drilling_depth") {
      //NOT RECOMMENDED!!
      //get cd
      const name = data[0];
      const dd = data[1];
      const targetId = data[2];

      //convertion from drilling depth must be targetId.
      if (targetId[0] == null || targetId[1] == null || targetId[2] == null){
        return results;
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
      const cd_list = LCCore.getDepthFromTrinity(targetId, send_data, "composite_depth"); //output:[sec id, cd]
      const cd = cd_list[0][1];

      //calc efd
      const efd_list = LCCore.getDepthFromTrinity(targetId, send_data, "event_free_depth"); //output:[sec id, efd]
      const efd = efd_list[0][1];
      const new_rank = efd_list[0][2];

      //calc age
      const ageData = LCAge.getAgeFromEFD(efd, method);
      const age = ageData.age;
      const ageIdx = ageData.age_idx;

      //stack
      results.name = name;
      results.hole = paseudoTrinity[0] !== null ? paseudoTrinity[0] : NaN;
      results.section = paseudoTrinity[1] !== null ? paseudoTrinity[1] : NaN;
      results.distance = paseudoTrinity[2] !== null ? paseudoTrinity[2] : NaN;
      results.cd = cd !== null ? cd : NaN;
      results.efd = efd !== null ? efd : NaN;
      results.dd  = dd !== null ? dd : NaN;
      results.age_mid = age.mid !== null ? age.mid : NaN;
      results.age_upper = age.upper !== null ? age.upper : NaN;
      results.age_lower = age.lower !== null ? age.lower : NaN;
      results.correlation_rank = 3;
      results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
      results.description               = "NOT RECOMMENDED! Converted from Drilling Depth. The trinity, CD, EFD amd Age are paseudo data.";
      results.source_type = type;
    } else if (type == "age") {
      //get efd
      const name = data[0];
      const age = data[1];
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
      results.correlation_rank = 3;
      results.correlation_model_version = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.event_model_version       = paseudoTrinity.index[0] !== null ? LCCore.projects[paseudoTrinity.index[0]].correlation_version : NaN;
      results.age_model_version         = LCAge.AgeModels[ageIdx] !== undefined ? LCAge.AgeModels[ageIdx].version : NaN;
      results.description               = "Converted from Age. The trinity and CD are paseudo data.";
      results.source_type = type;
    } else {
      return null;
    }

    return results;
  });
  ipcMain.handle("connectMarkers", (_e, fromId, toId, direction) => {
    const res = LCCore.connectMarkers(fromId, toId, direction);
    console.log(res)
    if(res == true){
      return true
    }else{
      return false
    }    
  });
  ipcMain.handle("disconnectMarkers", (_e, fromId, toId, direction) => {
    const res = LCCore.disconnectMarkers(fromId, toId, direction);
    if(res==true){
      return true
    }else{
      return false
    }
    
  });
  ipcMain.handle("deleteMarker", (_e, targetId) => {
    LCCore.deleteMarker(targetId);
    console.log("MAIN: Delete target marker.");
  });
  ipcMain.handle("addMarker", (_e, sectionId, depth, depthScale,relativeX) => {
    //add
    LCCore.addMarker(sectionId, depth, depthScale, relativeX);

    console.log("MAIN: Add a new marker on the section: " + sectionId +" of " + depth +" cm "+depthScale);
  });
  ipcMain.handle("SetZeroPoint", async(_e, markerId, value) => {
    
    const result = LCCore.setZeroPoint(markerId, value);

    if (result == true) {
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
      console.log("MAIN: Change master flag.");
      return result;
    } else {
      console.log("MAIN: Failed to chnage master flag.");
      return result
    }
  });
  ipcMain.handle("AddEvent", async(_e, upperId, lowerId, depositionType, value) => {
    let result = LCCore.addEvent(upperId, lowerId, depositionType, value);

    if (result == true) {
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
      console.log("MAIN: Delete event layer.");
      return result;
    } else {
      console.log("MAIN: Failed to delete event layer.");
      return result
    }
  });
  ipcMain.handle("changeMarker", (_e, markerId, type, value) => {
    //
    const idx = LCCore.search_idx_list[markerId.toString()];
    
    if(type == "distance"){
      //value:distance
      const result = LCCore.changeDistance(markerId, value);
      if(result == true){
        console.log("MAIN: Change marker distance.");
      }else{
        console.log("MAIN: Failed to change marker distance.")
      }
      return result;
    }else if(type=="name"){
      const result = LCCore.changeName(markerId, value)
      return result;
    }
  });
  ipcMain.handle("changeSection", (_e, sectionId, type, value) => {
    //
    const idx = LCCore.search_idx_list[sectionId.toString()];
    
    if(type=="name"){
      const result = LCCore.changeName(sectionId, value);
      return result;
    }
  });
  ipcMain.handle("deleteSection", (_e, sectionId) => {
    //    
    const result = LCCore.deleteSection(sectionId);//LCCore.deleteSection(sectionId);
    if(result == true){
      console.log("MAIN: Delete section.")
      return result;  
    }else{
      console.log("MAIN: Failed to delete section.")
      return result;  
    }
    
  });
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
      console.log("MAIN: Delete hole completed.");
      return result;
    } else {
      console.log("MAIN: Failed to delete hole.");
      return result
    }

    
  });
  ipcMain.handle("changeHole", (_e, holeId, type, value) => {
    //
    const idx = LCCore.search_idx_list[holeId.toString()];
    
    if(type=="name"){
      const result = LCCore.changeName(holeId, value);
      return result;
    }
  });
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
    
    const result = LCCore.deleteProject(projectId);

    if (result == true) {
      console.log("MAIN: Delete project completed.");
      return result;
    } else {
      console.log("MAIN: Failed to delete project.");
      return result
    }

    
  });
  ipcMain.handle("changeProject", (_e, projectId, type, value) => {
    if(type=="name"){
      const result = LCCore.changeName(projectId, value);
      return result;
    }
  });
  ipcMain.handle("mergeProjects", (_e) => {
    const result = LCCore.mergeProjects();

    if (result == true) {
      console.log("MAIN: Merge projects completed.");
      return result;
    } else {
      console.log("MAIN: Failed to merge projects.");
      return result
    }
  });
  ipcMain.handle("changeEditMode", (_e,mode) => {
    
    isEditMode = mode;
    menuRebuild();
    
  });
  ipcMain.handle("sendSettings", (_e,data, to) => {
    if(to=="settings"){
      settingsWindow.webContents.send("SettingsData", data);
    }else if(to=="renderer"){
      mainWindow.webContents.send("SettingsData", data);
      setSettings(data);
    }    
  });
  ipcMain.handle("sendPlotOptions", (_e,data, to) => {
    if(to=="renderer"){
      mainWindow.webContents.send("PlotDataOptions", data);
    }    
  });
  ipcMain.handle("openExtarnalLink", (_e,url) => {
    if(url){
      shell.openExternal(url);
    }
  });
  
  //--------------------------------------------------------------------------------------------------
  function initialiseLCCore(){
    LCCore = new LevelCompilerCore();

    //minor error
    LCCore.on('error', (err) => {      
      console.error('LCCore => '+ err.statusDetails);
      //window.webContents.send("AlertRenderer", err);
    });

    //alert error
    LCCore.on('error_alert', (err) => {
      console.error('LCCore => '+ err.statusDetails);
      mainWindow.webContents.send("AlertRenderer", err);
    });

    //depth update event
    LCCore.on('update_depth', () => {
      LCAge.updateAgeDepth(LCCore);
      LCCore.calcMarkerAges(LCAge);
      LCPlot.calcAgeCollectionPosition(LCCore, LCAge);
      LCPlot.calcDataCollectionPosition(LCCore,LCAge);
    });  

    return LCCore;
  }
  function initialiseDataPath(type){
    globalPath.dataPaths.filter(data => data.type !== type);
  }
  function registerModelFromCsv(fullpath){
    try {
      //register model
      const isLoad = LCCore.loadModelFromCsv(fullpath);
      if(isLoad == true){
        //register path
        globalPath.dataPaths.push({type:"csvmodel", path:fullpath});

        console.log('MAIN: Registered correlation model from "' + fullpath + '"' );
        return true
      }else{
        return null;
      }
      
    } catch (error) {
      console.log(error);
      console.error("MAIN: Correlation model register error.");
      return null;
    }
  }
  function registerAgeFromCsv(fullpath){
    try{
      // loadAgeFromCsv
      LCAge.loadAgeFromCsv(LCCore, fullpath);
      //apply latest age model to the depth model

      //register        
      globalPath.dataPaths.push({type:"csvage",path:fullpath});
      console.log("MAIN: Registered age model from " + fullpath);

      //register all LCAge models
      LCPlot.initialiseAgeCollection();
      //register dage data from LCAge
      registerLCPlot();

      
      return true
    }catch(err){
      console.log(err)
    }
  }
  async function registerLCModel(fullpath){
    globalPath.dataPaths.push({type:"lcmodel",path:fullpath});

    //import data
    const inData = await loadmodelfile(fullpath);

    //register
    if(inData!==null){
        //initialise
        LCCore = initialiseLCCore(mainWindow);
        LCAge  = new LevelCompilerAge(); 
        LCPlot.initialiseAgeCollection();

      //register
      assignObject(LCCore, inData.LCCore);
      assignObject(LCAge, inData.LCAge);

      //register all LCAge models     
      registerLCPlot();

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
  function registerLCPlot(){
    for (let i = 0; i < LCAge.AgeModels.length; i++) {
      //make new collection
      const model_name = LCAge.AgeModels[i].name;
      const model_id = LCAge.AgeModels[i].id;
      LCPlot.addNewAgeCollection(model_name, model_id);

      //get idx
      let age_idx = null;
      LCAge.AgeModels.forEach((a, idx) => {
        if (a.id == model_id) {
          age_idx = idx;
        }
      });

      //register dage data from LCAge
      LCPlot.addAgesetFromLCAgeModel(
        LCPlot.age_selected_id, //new made lotdata id
        LCAge.AgeModels[age_idx]
      );
      LCPlot.calcAgeCollectionPosition(LCCore, LCAge);
      console.log("MAIN: Registered age plot data from " + LCAge.AgeModels[age_idx].name);
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

      console.log("MAIN: Folder of Core images is registered.")
      return true
    }catch(err){
      return false
    } 
  }
  //--------------------------------------------------------------------------------------------------
  mainWindow.webContents.once("did-finish-load", () => {
    const LCSettingData = getSettings();
    if (LCSettingData !== null) {
      mainWindow.webContents.send("SettingsData", LCSettingData);
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
                label: "Load LC model",
                accelerator: "CmdOrCtrl+M",
                //accelerator: "CmdOrCtrl+S",
                click: async () => {
                  const fullpath = await getfile(mainWindow, "Please chose Correlation model file", [{name: "LCmodel file", extensions: ["lcmodel"]}]);
                  await registerLCModel(fullpath);
                  mainWindow.webContents.send("UpdateViewFromMain");                },
              },
              { type: "separator" },
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
                      operations:["drilling_depth","composite_depth","event_free_depth","age"],
                      dpcm:40,
                    },"core_images")

                    mainWindow.webContents.send("LoadCoreImagesMenuClicked", coreImages);
                    //mainWindow.webContents.send("UpdateViewFromMain"); 
                  }
                },
              },            
            ],
          },
          {
            label:"Import",
            submenu:[
              {
                label: "Load Correlation Model",              
                click: async() => {
                  const fullpath = await getfile(mainWindow, "Please chose Correlation model CSV file", [{name: "CSV file", extensions: ["csv"]}]);
                  if(fullpath){
                    registerModelFromCsv(fullpath);
                    mainWindow.webContents.send("UpdateViewFromMain");
                  }
                },
              },
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
            ]
          },
          {
            label:"Save",
            visible:isEditMode,
            submenu:[
              {
                label: "Save",
                accelerator: "CmdOrCtrl+S",
                click: async () => {
                  if(isEditMode){
                    //remove plot data
                    let out_LCPlot = JSON.parse(JSON.stringify(LCPlot));
                    out_LCPlot.data_collections = [];
                    out_LCPlot.data_selected_id = null;
  
                    const outData = {LCCore:LCCore, LCAge:LCAge, LCPlotAge:out_LCPlot};
  
                    if(globalPath.saveModelPath == null){
                      //save as new file
                      globalPath.saveModelPath = await putmodelfile(outData, null);
                    }else{
                      //save orverwrite
                      globalPath.saveModelPath = await putmodelfile(outData, globalPath.saveModelPath);
                    }
                  }                
                },
              },
              {
                label:"Save As...",
                click: async () => {
                  if(isEditMode){
                    //remove plot data
                    let out_LCPlot = JSON.parse(JSON.stringify(LCPlot));
                    out_LCPlot.data_collections = [];
                    out_LCPlot.data_selected_id = null;
  
                    const outData = {LCCore:LCCore, LCAge:LCAge, LCPlotAge:out_LCPlot};
  
                    //save as new file
                    globalPath.saveModelPath = await putmodelfile(outData, null);
                    
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
                label: "Export model as csv",
                click: () => {
                  mainWindow.webContents.send("ExportCorrelationAsCsvMenuClicked");
                },
              },
            ],
          },
          { type: "separator" },
          {
            label: "Unload all models",
            accelerator: "CmdOrCtrl+U",
            click: () => {
              mainWindow.webContents.send("UnLoadModelsMenuClicked");
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
                webPreferences: {preload: path.join(__dirname, "preload_settings.js"),},
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
  
                    const response = dialog.showMessageBoxSync(null, options);
  
                    if (response === 1) {
                      app.quit(); 
                    }
                  },
                },              
              ]
            : []),
        ],
      },
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
          
        ],
      },
      {
        label: "Tools",
        submenu: [
          {
            label: "Converter",
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
                webPreferences: {preload: path.join(__dirname, "preload_converter.js"),},
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
               // converterWindow.setAlwaysOnTop(true, "normal");
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
            label: "Plotter",
            accelerator: "CmdOrCtrl+P",
            click: () => {
              if (isDev == false){
                if(LCCore.base_project_id==null){
                  return
                }
              }
              if (plotWindow) {
                plotWindow.focus();
                return;
              }
          
              //create finder window
              plotWindow = new BrowserWindow({
                title: "Converter",
                width: 280,//full: 900
                height: 600,
                webPreferences: {preload: path.join(__dirname, "preload_plotter.js"),},
              });
              
              //converterWindow.setAlwaysOnTop(true, "normal");
              plotWindow.on("closed", () => {
                plotWindow = null;
                mainWindow.webContents.send("PlotterClosed", "");
              });
              plotWindow.setMenu(null);
          
              plotWindow.loadFile(path.join(__dirname, "./renderer/plotter.html"));
          
              plotWindow.once("ready-to-show", () => {
                plotWindow.show();
                // plotWindow.setAlwaysOnTop(true, "normal");
                //plotWindow.webContents.openDevTools();
                plotWindow.webContents.send("PlotterMenuClicked");
              });
            },
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
              tempCore.addHole([1,null,null,null],"temp");
  
              //create finder window
              labelerWindow = new BrowserWindow({
                title: "labeler",
                width: 800,
                height: 800,
                webPreferences: {preload: path.join(__dirname, "preload_labeler.js"),},
              });
              
              //converterWindow.setAlwaysOnTop(true, "normal");
              labelerWindow.on("closed", () => {
                labelerWindow = null;
                tempCore = null;
                mainWindow.webContents.send("LabelerClosed", "");
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
                { label: "Check update", click: async()=>{await checkUpdate()}},
              ],
            },
          ]
        : []),
      // others
    ];
  }
  function menuRebuild() {
    const lcmenu = buildMainMenu(mainWindow);
    let mainMenu = Menu.buildFromTemplate(lcmenu);
    Menu.setApplicationMenu(mainMenu);
  }
}
//===================================================================================================================================
//===================================================================================================================================

//--------------------------------------------------------------------------------------------------
function progressDialog(window, tit, txt){
  let progress = new ProgressBar({
    title: tit,
    icon: "./icon/levelcompiler.png",
    indeterminate: false,
    text: txt,
    detail: "Please wait...(0%)",
    browserWindow: {
      parent: window,
      modal: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    },
    closeOnComplete:true,
  });
  
  return progress;
}
async function updateProgress(progress, n, N){
  try{
    if (progress) {
      progress.value = (n / N) * 100;
      progress.detail ="Please wait..." + n + "/" + N + "  (" + round((n / N) * 100, 2) + "%)";

      if (n / N >= 1) {
        progress.setCompleted();
        progress.close();
        progress = null;
      }
    }
    return progress;
  }catch(err){
    progress.on("aborted");
    console.error("MAIN: In progressbar", err);
    progress.close();
    return progress;
  }
}
async function getfile(mainWindow, title, ext) {
  const options = {
    title: title,
    filters: ext,
    properties: ["openFile"],
  };

  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    if (!result.canceled) {
      return result.filePaths[0];
    }
    return null;
  } catch (err) {
    console.log(err);
    return null;
  }
}
//--------------------------------------------------------------------------------------------------
async function getDirectory(mainWindow, title) {
  const options = {
    title: title,
    properties: ["openDirectory"], 
  };

  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    if (!result.canceled) {
      return result.filePaths[0]; 
    }
    return null; 
  } catch (err) {
    console.log(err);
    return null;
  }
}
function findFileInDir(in_path, fileName, type) {
  let results = [];
  let dir = "";
  if(typeof in_path === "string"){
    dir = in_path;
  }else{
    const pathData = path.parse(in_path);
    dir = path.join(pathData.dir, pathData.name);
  }

  const files = fs.readdirSync(dir);
  for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if(type == "get"){
          results = results.concat(findFileInDir(filePath, fileName, type));
        }else if(type == "check"){
          results.push(true);
        }
      } else if (file === fileName) {
        if(type == "get"){
          results.push(filePath);
        }else if(type =="check"){
          results.push(true);
        }
      }
  }

  return results;
}
//--------------------------------------------------------------------------------------------------
async function putcsvfile(mainWindow, filePath, data) {
  dialog
    .showSaveDialog({
      title: "Please select save path",
      defaultPath: filePath !== null? filePath:app.getPath("desktop"),
      buttonLabel: "Save",
      filters: [{ name: "Csv Files", extensions: ["csv"] }],
    })
    .then((file) => {
      if (!file.canceled && file.filePath) {
        //convert array --> csv
        const csv = stringify(data);
        fs.writeFileSync(file.filePath, csv);
      }
    })
    .catch((err) => {
      console.log(err);
    });
}
//--------------------------------------------------------------------------------------------------
async function putmodelfile(data, path) {
  try{
    //get save path
    let filePath = null;
    if(path == null){
      const file = await dialog.showSaveDialog({
        title: "Please select save path",
        defaultPath: app.getPath("desktop"),
        buttonLabel: "Save",
        filters: [{ name: "Level Compiler model", extensions: ["lcmodel"] }],
      })
      if (!file.canceled && file.filePath) {
        filePath = file.filePath;
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
    
    return filePath;
  }catch(err) {
      console.log(err);
  };
}
//--------------------------------------------------------------------------------------------------
async function loadmodelfile(...args) {
  try{
    //get file path
    let filepath = null;
    if(args.length == 0){
      //cane no path
      const file = await dialog.showOpenDialog({
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
function round(num, digits) {
  const multiplier = Math.pow(10, digits);
  return Math.round(num * multiplier) / multiplier;
}
//--------------------------------------------------------------------------------------------------
//create about window
function createAboutWindow() {
  // make window
  const aboutWindow = new BrowserWindow({
    title: "About Level Compiler",
    width: 500,
    height: 300,
    webPreferences: {preload: path.join(__dirname, "preload_about.js"),},
  });
  aboutWindow.setMenu(null);
  aboutWindow.loadFile(path.join(__dirname, "./renderer/about.html"));

  aboutWindow.once("ready-to-show", () => {
    aboutWindow.show();
   // converterWindow.setAlwaysOnTop(true, "normal");
   //aboutWindow.webContents.openDevTools();
    //converterWindow.setAlwaysOnTop(true, "normal");
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
async function checkUpdate(){
  //check update in the github
  autoUpdater.allowPrerelease = true;
  autoUpdater.autoDownload = false;
  autoUpdater.forceDevUpdateConfig = false; 
  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
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
    });

  });

  autoUpdater.on('update-not-available', () => {
    /*
    dialog.showMessageBox({
      type: 'info',
      title: 'No Updates',
      message: 'You are using the latest version.',
    });
    */
  });

  autoUpdater.on('error', (err) => {
    /*
    dialog.showMessageBox({
      type: 'error',
      title: 'Update Error',
      message: `An error occurred: ${err.message}`,
    });
    */
  });

  autoUpdater.checkForUpdates();
}
//--------------------------------------------------------------------------------------------------
function getSettings(){
  let LCSettingData = null;
  const settingPath = path.join(app.getPath('userData'), "lcsettings.json");
  if(fs.existsSync(settingPath)){
    const settingsData = fs.readFileSync(settingPath, 'utf-8');
    LCSettingData = JSON.parse(settingsData);   
    console.log("MAIN: Restore settings")
  }else{
    console.log("MAIN: There is no setting data.")
  }
  return LCSettingData;
}
function setSettings(data){
  const settingPath = path.join(app.getPath('userData'), "lcsettings.json");
  try {
    fs.writeFileSync(settingPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log('MAIN: Settings are saved.');
  } catch (error) {
    console.error('MAIN: Failed to save settings.', error);
  }
}
//--------------------------------------------------------------------------------------------------
app.whenReady().then(() => {
  //check update
  checkUpdate();

  //create main window
  createMainWIndow();

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
