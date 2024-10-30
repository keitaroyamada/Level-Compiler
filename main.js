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

const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { mode } = require("simple-statistics");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const ProgressBar = require("electron-progressbar");

const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const { LevelCompilerCore } = require("./LC_modules/LevelCompilerCore.js");
const { Project } = require("./LC_modules/Project.js");
const { lcfnc } = require("./LC_modules/lcfnc.js");
const { LevelCompilerAge } = require("./LC_modules/LevelCompilerAge.js");
const { LevelCompilerPlot } = require("./LC_modules/LevelCompilerPlot.js");
const { Trinity } = require("./LC_modules/Trinity.js");
const { send } = require("process");

//properties
const isMac = process.platform === "darwin";
const isDev = false;//process.env.NODE_ENV !== "development"; //const isDev = false;
const LCCore = new LevelCompilerCore();
const LCAge = new LevelCompilerAge();
const LCPlot = new LevelCompilerPlot();

//
let finderWindow = null;
let dividerWindow = null;
let converterWindow = null;
let importerWindow = null;
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
  });
  //===================================================================================================================================
  //make Menu
  const lcmenu = [
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
          label: "Load Correlation Model",
          accelerator: "CmdOrCtrl+M",
          click: () => {
            mainWindow.webContents.send("LoadCorrelationModelMenuClicked");
          },
        },
        {
          label: "Load Age model",
          accelerator: "CmdOrCtrl+T",
          click: () => {
            mainWindow.webContents.send("LoadAgeModelMenuClicked");
          },
        },
        { type: "separator" },
        {
          label: "Load Core Images",
          accelerator: "CmdOrCtrl+I",
          click: () => {
            mainWindow.webContents.send("LoadCoreImagesMenuClicked");
          },
        },
        {
          label: "Load Plot Data",
          accelerator: "CmdOrCtrl+P",
          click: () => {
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
              converterWindow.webContents.send("ConverterMenuClicked", "import");
            });

            /*
            const win = createNewWindow("Converter", "./renderer/converter.html", "preload_converter.js");

            win.once("ready-to-show", () => {
              win.show();
              //win.webContents.openDevTools();
              win.setMenu(null);
              win.setAlwaysOnTop(true, "normal");
              win.webContents.send("ConverterMenuClicked", "");
            });
            */
          },
        },
        { type: "separator" },
        {
          label: "Unload all models",
          accelerator: "CmdOrCtrl+U",
          click: () => {
            mainWindow.webContents.send("UnLoadModelsMenuClicked");
          },
        },
        // for Windows--------------------
        ...(!isMac
          ? [
              {
                label: "Exit",
                role: "quit",
                accelerator: "CmdOrCtrl+W",
              },
            ]
          : []),
      ],
    },

    {
      label: "Tools",
      submenu: [
        {
          label: "Converter",
          click: () => {
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
              converterWindow.webContents.send("ConverterMenuClicked", "export");
            });

            /*
            const win = createNewWindow("Converter", "./renderer/converter.html", "preload_converter.js");

            win.once("ready-to-show", () => {
              win.show();
              //win.webContents.openDevTools();
              win.setMenu(null);
              win.setAlwaysOnTop(true, "normal");
              win.webContents.send("ConverterMenuClicked", "");
            });
            */
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
    /*
    {
      label: "Mode",
      submenu: [
        {
          label: "Vector mode",
          type: "checkbox",
          checked: true,
          click: () => {
            lcmenu.forEach((m1) => {
              if (m1.label == "Mode") {
                m1.submenu[0].checked = false;
                m1.submenu[1].checked = true;
                menuRebuild();
              }
            });
            mainWindow.webContents.send("CanvasModeChanged", "vector");
          },
        },
        {
          label: "Raster mode",
          type: "checkbox",
          checked: false,
          click: () => {
            lcmenu.forEach((m1) => {
              if (m1.label == "Mode") {
                m1.submenu[0].checked = true;
                m1.submenu[1].checked = false;
                menuRebuild();
              }
            });
            mainWindow.webContents.send("CanvasModeChanged", "raster");
          },
        },
      ],
    },
    */
    // for windows ----------------------------------------------------------------------------------
    ...(!isMac
      ? [
          {
            label: "Help",
            submenu: [
              { label: "About", click: createAboutWindow },
            ],
          },
        ]
      : []),
    // others
  ];

  //Implement menu
  menuRebuild();
  //===================================================================================================================================
  function menuRebuild() {
    let mainMenu = Menu.buildFromTemplate(lcmenu);
    Menu.setApplicationMenu(mainMenu);
  }
  //===================================================================================================================================
  //IPC from renderer
  ipcMain.handle("test", async (_e, _arg1, _arg2) => {
    console.log("test handle called");
    console.log(_arg1 + _arg2);
  });
  ipcMain.on('getResourcePath', (_e) => {
    
    let resourcePath;
    if(app.isPackaged){
      //after build
      resourcePath = path.join(process.resourcesPath);
    }else{
      //dev env
      resourcePath = path.join(__dirname);

    }
    
    let plot_icons = {
      terrestrial: [
        path.join(resourcePath, "resources","plot","terrestrial.png"),
        "Green",
      ],
      marine: [
        path.join(resourcePath, "resources","plot","marine.png"),
        "Blue",
      ],
      tephra: [
        path.join(resourcePath, "resources","plot","tephra.png"),
        "Red",
      ],
      climate: [path.join(resourcePath, "resources","plot","climate.png"),
        "Yellow",
      ],
      orbital: [
        path.join(resourcePath, "resources","plot","orbital.png"),
        "Orange",
      ],
      general: [
        path.join(resourcePath, "resources","plot","general.png"),
        "Gray",
      ],
      historical: [
        path.join(resourcePath, "resources","plot","historical.png"),
        "Black"
      ],
      interpolation: [
        path.join(resourcePath, "resources","plot","interpolation.png"),
        "Gray"
      ]
    };

    let tool_icons ={
      bt_reload:path.join(resourcePath, "resources","tool","reload.png"),
      bt_finder:path.join(resourcePath, "resources","tool","finder.png"),
      bt_zoomin:path.join(resourcePath, "resources","tool","zoomin.png"),
      bt_zoom0:path.join(resourcePath, "resources","tool","zoom0.png"),
      bt_zoomout:path.join(resourcePath, "resources","tool","zoomout.png"),
      bt_measure:path.join(resourcePath, "resources","tool","measure.png"),
      bt_snapshot:path.join(resourcePath, "resources","tool","snapshot.png"),
      bt_pen:path.join(resourcePath, "resources","tool","pen.png"),
      bt_divider:path.join(resourcePath, "resources","tool","divider.png"),
      bt_grid:path.join(resourcePath, "resources","tool","grid.png"),
      bt_rank:path.join(resourcePath, "resources","tool","rank.png"),
      bt_target:path.join(resourcePath, "resources","tool","target.png"),
      bt_event_layer:path.join(resourcePath, "resources","tool","event.png"),
      bt_core_photo:path.join(resourcePath, "resources","tool","core_photo.png"),
      bt_connection:path.join(resourcePath, "resources","tool","connection.png"),
      bt_chart:path.join(resourcePath, "resources","tool","chart.png"),
    };
    
    let finder_icons ={
      fixed:path.join(resourcePath, "resources","tool","fixed.png"),
      linked:path.join(resourcePath, "resources","tool","linked.png"),
      fix:path.join(resourcePath, "resources","tool","fix.png"),
      link:path.join(resourcePath, "resources","tool","link.png"),
    };
  
    _e.returnValue = {plot:plot_icons, tool:tool_icons, finder:finder_icons};
  });
  //============================================================================================
  ipcMain.handle("InitiariseCorrelationModel", async (_e) => {
    //import modeln
    console.log("MAIN: Initiarise correlation model");
    LCCore.projects = [];
    LCCore.search_idx_list = {};
    LCCore.selected_id = null;
    LCCore.reserved_project_ids = [0];

    console.log("MAIN: Project correlation data is initiarised.");
    return LCCore;
  });

  ipcMain.handle("InitiariseAgeModel", async (_e) => {
    //import modeln
    console.log("MAIN: Initiarise age model");
    LCAge.AgeModels = [];
    LCAge.selected_id = null;
    console.log("MAIN: Project age data is initiarised.");
    return;
  });
  ipcMain.handle("InitiarisePlot", async (_e) => {
    //import modeln
    console.log("MAIN: Initiarise plot data");
    LCPlot.age_collections = [];
    LCPlot.data_collections = [];
    LCPlot.age_selected_id = null;
    LCPlot.data_selected_id = null;
    console.log("MAIN: Project plot data is initiarised.");
    return;
  });
  ipcMain.handle("getFilePath", async (_e, pathData) => {
    //import modeln
    let results = path.parse(pathData);
    results.fullpath = path.join(results.dir, results.base);
    return results;
  });
  ipcMain.handle("RegisterModelFromCsv", async (_e, model_path) => {
    try {
      //register model
      const isLoad = LCCore.loadModelFromCsv(model_path);
      if(isLoad){
        console.log('MAIN: Registered correlation model from "' + model_path + '"' );
        return {
          id: LCCore.projects[LCCore.projects.length - 1].id,
          name: LCCore.projects[LCCore.projects.length - 1].name,
          path: model_path,
        };
      }else{
        return null;
      }
      
    } catch (error) {
      console.log(error);
      console.error("MAIN: Correlation model register error.");
      return null;
    }
  });

  ipcMain.handle("LoadModelFromLCCore", async (_e) => {
    //import model
    console.log("MAIN: Load correlation model.");
    return LCCore;
  });

  ipcMain.handle("LoadRasterImage", async (_e, im_path, Resize) => {
    try {
      //path.join(__dirname.replace(/\\/g, "/"), im_path)
      const imageBuffer = fs.readFileSync(im_path);

      if (Resize != 0) {
        const metadata = await sharp(imageBuffer).metadata();
        const new_size = { height: Resize, width: 1 };

        if (metadata.height > new_size.height) {
          const resizedBuffer = await sharp(imageBuffer)
            .resize({ height: new_size.height })
            .toBuffer();

          //console.log("resized");
          return resizedBuffer.toString("base64");
        } else {
          //console.log("original");
          return imageBuffer.toString("base64");
        }
      } else {
        return imageBuffer.toString("base64");
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        //case there is no such a file.
      } else {
        throw error;
      }
    }
  });

  ipcMain.handle("progressbar", async (_e, tit, txt) => {
    progressBar = new ProgressBar({
      title: tit,
      icon: "./icon/levelcompiler.png",
      indeterminate: false,
      text: txt,
      detail: "Please wait...(0%)",
      browserWindow: {
        parent: mainWindow,
        modal: true,
        resizable: false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
      },
    });

    progressBar
      .on("completed", () => {
        //console.info("Task completed.");
        progressBar.detail = "Task completed. Exiting...";
      })
      .on("aborted", (value) => {
        console.info(`Task aborted... ${value}`);
      });
  });

  ipcMain.handle("makeModelImage", async (_e, imPath, sectionData, imHeight, depthScale) => {
    try {
      //path.join(__dirname.replace(/\\/g, "/"), im_path)
      let imageBuffer = fs.readFileSync(imPath);
      if (imHeight != 0) {
        const metadata = await sharp(imageBuffer).metadata();
        const new_size = { height: imHeight, width: 1 };

        imageBuffer = await sharp(imageBuffer)
            .resize({ height: new_size.height })
            .toBuffer();
      }

      //check
      const undifBuffer = Buffer.from([0xba, 0x77, 0x5e, 0x7e, 0x29, 0xde]);
      if (imageBuffer.equals(undifBuffer)) {
        //if no image data
        return undefined;
      }

      //get image info
      const im = sharp(imageBuffer);
      const metadata = await im.metadata();
      const pixPerCm = imHeight / (sectionData.markers[sectionData.markers.length - 1].distance - sectionData.markers[0].distance);
      //const pixPerCm = metadata.height / (sectionData.markers[sectionData.markers.length - 1].distance - sectionData.markers[0].distance);//original size

      //get operations
      let newHeight = 0;
      let operations = [];
      const d0 = sectionData.markers[0].distance;
      const m0 = sectionData.markers[0][depthScale];
      for (let i = 0; i < sectionData.markers.length - 1; i++) {
        const dTop = sectionData.markers[i].distance;
        const dBottom = sectionData.markers[i + 1].distance;
        const mTop = sectionData.markers[i][depthScale];
        const mBottom = sectionData.markers[i + 1][depthScale];

        const fromP0 = (dTop - d0) * pixPerCm;
        const fromP1 = (dBottom - d0) * pixPerCm;
        const toP0 = (mTop - m0) * pixPerCm;
        const toP1 = (mBottom - m0) * pixPerCm;

        operations.push({
          fromTop: fromP0,
          fromBottom: fromP1,
          toTop: toP0,
          toBottom: toP1,
        });
        newHeight += toP1 - toP0;
      }

      //make blank base
      if (newHeight < 0.5) return [];
      let newIm = sharp({
        create: {
          width: metadata.width,
          height: round(newHeight, 0),
          channels: 3,
          background: { r: 0, g: 0, b: 0 },
        },
      }).jpeg();

      //extract and resize
      let compositeOperations = [];
      for (const ope of operations) {
        if (
          round(ope.fromBottom - ope.fromTop, 0) === 0 ||
          round(ope.toBottom - ope.toTop, 0) === 0
        )
          continue; // if 0cm thick(event layer), skip
        const baseIm = sharp(imageBuffer);
        const currSection = await baseIm
          .extract({
            left: 0,
            top: round(ope.fromTop, 0),
            width: metadata.width,
            height: round(ope.fromBottom - ope.fromTop, 0),
          })
          .resize({
            width: metadata.width,
            height: round(ope.toBottom - ope.toTop, 0),
            fit: "fill",
          })
          .toBuffer();

        compositeOperations.push({
          input: currSection,
          top: round(ope.toTop, 0),
          left: 0,
        });
      }

      if (compositeOperations.length > 0) {
        newIm = await newIm.composite(compositeOperations).toBuffer();
      }

      //to base64
      return newIm.toString("base64");

      //-------------------------------------------------------
      
    } catch (error) {
      if (error.code === "ENOENT") {
        //case there is no such a file.
      } else {
        throw error;
      }
    }

  });

  ipcMain.handle("updateProgressbar", (_e, n, N) => {
    if (progressBar) {
      progressBar.value = (n / N) * 100;
      progressBar.detail =
        "Please wait..." + n + "/" + N + "  (" + round((n / N) * 100, 2) + "%)";

      if (n / N >= 1) {
        progressBar.setCompleted();
      }
    }
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

  ipcMain.handle("RegistertAgeFromCsv", async (_e, age_path) => {
    try {
      //import model
      LCAge.loadAgeFromCsv(LCCore, age_path);
      LCAge.selected_id; //latest version is automatucally selected in loadAgeFromCsv

      //apply latest age model to the depth model
      let model_name = null;
      LCAge.AgeModels.forEach((model) => {
        if (model.id == LCAge.selected_id) {
          model_name = model.name;
        }
      });

      console.log("MAIN: Registered age model from " + age_path);
      return { id: LCAge.selected_id, name: model_name, path: age_path };
    } catch (error) {
      console.error("MAINE: Age model register error.");
      console.log(error);
      return null;
    }
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
    LCAge.checkAges();

    console.log("MAIN: Load age model into LCCore. id: " +  LCAge.selected_id + " name:" +  model_name);
    LCCore.checkModel();

    return LCCore;
  });
  ipcMain.handle("RegisterAgePlotFromLCAge", async (_e) => {
    LCPlot.initiariseAgeCollection();
    try {
      //register all LCAge models
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

        console.log(
          "MAIN: Registered age plot data from " + LCAge.AgeModels[age_idx].name
        );
      }
    } catch (error) {
      console.error("ERROR: Plot data register from LCAge error.");
      console.log(error);
    }
  });
  ipcMain.handle("RegisterDataPlot", async (_e, data) => {
    LCPlot.addDataset(data);
    console.log("MAIN: Registered plot data.");
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
    LCPlot.calcAgeCollectionPosition(LCCore, LCAge);
    LCPlot.calcDataCollectionPosition(LCCore, LCAge);

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
    return LCCore;
  });

  ipcMain.handle("CalcEventFreeDepth", async (_e) => {
    //import model
    console.log("MAIN: Calc event free depth");
    LCCore.calcEventFreeDepth(LCCore.base_project_id);
    //LCCore.getModelSummary();
    return LCCore;
  });

  ipcMain.handle("FileChoseDialog", async (_e, title, ext) => {
    const result = await getfile(mainWindow, title, ext);
    return result;
  });
  ipcMain.handle("FolderChoseDialog", async (_e, title) => {
    const result = await getDirectory(mainWindow, title);
    return result;
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
      
      //initiarise
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
      const ageUpper = LCAge.getAgeFromEFD(result.definition_efd_upper,"linear");
      const ageLower = LCAge.getAgeFromEFD(result.definition_efd_lower,"linear");
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
    putcsvfile(mainWindow, data);    
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
      finderWindow.setAlwaysOnTop(true, "normal");
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
    } else if(data == "importer"){
      if (importerWindow.webContents.isDevToolsOpened()) {
        importerWindow.webContents.closeDevTools();
      } else {
        importerWindow.webContents.openDevTools();
      }
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

  ipcMain.handle("cvtLoadCsv", async (_e, title, ext) => {
    const result = await getfile(mainWindow, title, ext);

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
    putcsvfile(mainWindow, data);
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
    mainWindow.webContents.send("importedData", data);
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

  //--------------------------------------------------------------------------------------------------
  //--------------------------------------------------------------------------------------------------
}
//===================================================================================================================================

//--------------------------------------------------------------------------------------------------
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
//--------------------------------------------------------------------------------------------------
async function putcsvfile(mainWindow, data) {
  dialog
    .showSaveDialog({
      title: "Please select save path",
      defaultPath: app.getPath("desktop"),
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
  const aboutWindow = new BrowserWindow({
    title: "About Level Compiler",
    width: 300,
    height: 300,
  });
  aboutWindow.setMenu(null);
  aboutWindow.loadFile(path.join(__dirname, "./renderer/about.html"));
}

//--------------------------------------------------------------------------------------------------
app.whenReady().then(() => {
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
