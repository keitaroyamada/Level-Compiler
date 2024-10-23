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

//properties
const isMac = process.platform === "darwin";
const isDev = process.env.NODE_ENV !== "development"; //const isDev = false;
//const isDev = false;
const LCCore = new LevelCompilerCore();
const LCAge = new LevelCompilerAge();
const LCPlot = new LevelCompilerPlot();

//
let finderWindow = null;
let dividerWindow = null;
let progressBar = null;

//const isDev = false;

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
          click: () => {
            mainWindow.webContents.send("LoadCorrelationModelMenuClicked");
          },
        },
        {
          label: "Load Age model",
          click: () => {
            mainWindow.webContents.send("LoadAgeModelMenuClicked");
          },
        },
        {
          label: "Load Core Images",
          click: () => {
            mainWindow.webContents.send("LoadCoreImagesMenuClicked");
          },
        },
        {
          label: "Unload all models",
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
      label: "Converter",
      submenu: [
        {
          label: "converter",
          click: () => {
            const win = createNewWindow(
              "Converter",
              "./renderer/converter.html",
              "preload_converter.js"
            );

            win.once("ready-to-show", () => {
              win.show();
              win.webContents.openDevTools();
              win.setMenu(null);
              //win.setAlwaysOnTop(true, "normal");
              win.webContents.send("ConverterMenuClicked", "");
            });
          },
        },
      ],
    },
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
    // for windows ----------------------------------------------------------------------------------
    ...(!isMac
      ? [
          {
            label: "Help",
            submenu: [
              { label: "About", click: createAboutWindow },
              {
                label: "Developer tool",
                click: () => {
                  mainWindow.webContents.openDevTools();
                },
              },
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
    
    let incon_list = {};
    incon_list = {
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
  
    _e.returnValue = incon_list;
  });
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

  ipcMain.handle("RegisterModelFromCsv", async (_e, model_path) => {
    try {
      //register model
      LCCore.loadModelFromCsv(model_path);
      console.log('MAIN: Registered correlation model from "' + model_path + '"' );
      return {
        id: LCCore.projects[LCCore.projects.length - 1].id,
        name: LCCore.projects[LCCore.projects.length - 1].name,
        path: model_path,
      };
    } catch (error) {
      console.log(error);
      console.error("Correlation model register error.");
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
      console.error("Age model register error.");
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

    console.log(
      "MAIN: Load age model into LCCore. id: " +
        LCAge.selected_id +
        " name:" +
        model_name
    );
    return LCCore;
  });
  ipcMain.handle("RegisterPlotFromLCAge", async (_e) => {
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
        LCPlot.addDatasetFromLCAgeModel(
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

  ipcMain.handle("LoadPlotFromLCPlot", async (_e) => {
    //calc latest age and depth
    LCPlot.calcAgeCollectionPosition(LCCore, LCAge);

    //LC plot age_collection id is as same as LCAge id
    LCPlot.age_selected_id = LCAge.selected_id;

    if (LCPlot) {
      console.log("Main: Load plot data from LCPlot");
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

    const efd = LCCore.getEFDfromCD(LCCore.base_project_id, cd);
    if (efd == null) {
      return NaN;
    }

    //calc age
    const age = LCAge.getAgeFromEFD(efd, method);
    if (age == null) {
      return "";
    } else {
      return age.mid;
    }
  });

  ipcMain.handle("OpenDivider", async (_e) => {
    console.log("called");
    if (dividerWindow) {
      dividerWindow.focus();
      dividerWindow.webContents.send("DividerToolClicked", "");
      return;
    }

    //create finder window
    dividerWindow = new BrowserWindow({
      title: "Divider",
      width: 1500,
      height: 1000,
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
      dividerWindow.webContents.openDevTools();
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

  ipcMain.handle("cvtConvert", async (_e, modelIds, data, type, method) => {
    //[name hole section distance cd efd age age_errorU age_errorL correlation_version event_version age_version connection_rank]
    let results = [
      [
        "Name",
        "Hole",
        "Section",
        "Distance (cm)",
        "Composite depth (cm)",
        "Eventfree depth (cm)",
        "Age mid (calBP)",
        "Age upper (calBP)",
        "Age lower (calBP)",
        "Correlation Rank",
        "Correlation Model Version",
        "Event Model Version",
        "Age Model Version",
      ],
    ];

    if (type == "trinity") {
      for (let i = 1; i < data.length; i++) {
        //calc each depth
        let send_data = [];
        let td = new Trinity();
        td.name = data[i][0];
        td.hole_name = data[i][1];
        td.section_name = data[i][2];
        td.distance = parseFloat(data[i][3]);
        send_data.push(td);

        //convert depth (listed for function)
        const cd_list = LCCore.getDepthFromTrinity(
          LCCore.base_project_id,
          send_data,
          "composite_depth"
        ); //output:[sec id, cd]
        const cd = [];
        cd.push(cd_list[0][1]);

        //
        const efd_list = LCCore.getDepthFromTrinity(
          LCCore.base_project_id,
          send_data,
          "event_free_depth"
        ); //output:[sec id, efd]
        const efd = efd_list[0][1];
        const new_rank = efd_list[0][2];

        let model_idx = null;
        LCCore.projects.forEach((project, p) => {
          if (project.id[0] == LCCore.base_project_id[0]) {
            model_idx = p;
          }
        });

        //calc age
        LCAge.selected_id = modelIds.age;
        const age = LCAge.getAgeFromEFD(efd, method);
        let age_mid;
        let age_upper;
        let age_lower;
        if (age) {
          age_mid = age.mid;
          age_upper = age.upper;
          age_lower = age.lower;
        }

        //get age model idx
        let ageIdx = null;
        LCAge.AgeModels.forEach((a, s) => {
          if (a.id == modelIds.age) {
            ageIdx = s;
          }
        });

        //stack
        results.push([
          send_data[0] !== undefined ? send_data[0].name : NaN,
          send_data[0] !== undefined ? send_data[0].hole_name : NaN,
          send_data[0] !== undefined ? send_data[0].section_name : NaN,
          send_data[0] !== undefined ? send_data[0].distance : NaN,
          cd !== null ? cd[0] : NaN,
          efd !== null ? efd : NaN,
          age_mid !== null ? age_mid : NaN,
          age_upper !== null ? age_upper : NaN,
          age_lower !== null ? age_lower : NaN,
          new_rank !== null ? new_rank : NaN,
          LCCore.projects[model_idx].id !== null
            ? LCCore.projects[model_idx].correlation_version
            : NaN,
          LCCore.projects[model_idx].id !== null
            ? LCCore.projects[model_idx].correlation_version
            : NaN,
          LCAge.AgeModels[ageIdx] !== undefined
            ? LCAge.AgeModels[ageIdx].version
            : NaN,
        ]);
      }
    } else if (type == "composite_depth") {
      for (let i = 1; i < data.length; i++) {
        //get cd
        const name = data[i][0];
        const cd = data[i][1];

        //calc efd
        const efd = LCCore.getEFDfromCD(LCCore.base_project_id, cd);

        let model_idx = null;
        LCCore.projects.forEach((project, p) => {
          if (project.id[0] == LCCore.base_project_id[0]) {
            model_idx = p;
          }
        });

        //calc age
        LCAge.selected_id = modelIds.age;
        const age = LCAge.getAgeFromEFD(efd, method);
        let age_mid;
        let age_upper;
        let age_lower;
        if (age) {
          age_mid = age_mid;
          age_upper = age_upper;
          age_lower = age_lower;
        }

        //get age model idx
        let ageIdx = null;
        LCAge.AgeModels.forEach((a, s) => {
          if (a.id == modelIds.age) {
            ageIdx = s;
          }
        });

        //stack
        results.push([
          name,
          NaN,
          NaN,
          NaN,
          cd !== null ? cd[0] : NaN,
          efd !== null ? efd : NaN,
          age_mid !== null ? age_mid : NaN,
          age_upper !== null ? age_upper : NaN,
          age_lower !== null ? age_lower : NaN,
          3,
          "Converted from composite depth",
          LCCore.projects[model_idx].id !== null
            ? LCCore.projects[model_idx].correlation_version
            : NaN,
          LCAge.AgeModels[ageIdx] !== undefined
            ? LCAge.AgeModels[ageIdx].version
            : NaN,
        ]);
      }
    } else if (type == "event_free_depth") {
      for (let i = 1; i < data.length; i++) {
        //get efd
        const name = data[i][0];
        const efd = data[i][1];

        //calc age
        LCAge.selected_id = modelIds.age;
        const age = LCAge.getAgeFromEFD(efd, method);
        let age_mid;
        let age_upper;
        let age_lower;
        if (age) {
          age_mid = age_mid;
          age_upper = age_upper;
          age_lower = age_lower;
        }

        //get age model idx
        let ageIdx = null;
        LCAge.AgeModels.forEach((a, s) => {
          if (a.id == modelIds.age) {
            ageIdx = s;
          }
        });

        //stack
        results.push([
          name,
          NaN,
          NaN,
          NaN,
          NaN,
          efd !== null ? efd : NaN,
          age_mid !== null ? age_mid : NaN,
          age_upper !== null ? age_upper : NaN,
          age_lower !== null ? age_lower : NaN,
          3,
          "Converted from event free depth",
          "Converted from event free depth",
          LCAge.AgeModels[ageIdx] !== undefined
            ? LCAge.AgeModels[ageIdx].version
            : NaN,
        ]);
      }
    } else if (type == "drilling_depth") {
    } else if (type == "age") {
      for (let i = 1; i < data.length; i++) {
        //get efd
        const name = data[i][0];
        const age = data[i][1];

        //calc efd
        LCAge.selected_id = modelIds.age;
        const efds = LCAge.getEFDFromAge(age, method);
        const efd = efds.mid;

        //get age model idx
        let ageIdx = null;
        LCAge.AgeModels.forEach((a, s) => {
          if (a.id == modelIds.age) {
            ageIdx = s;
          }
        });

        //stack
        results.push([
          name,
          NaN,
          NaN,
          NaN,
          NaN,
          efd !== null ? efd : NaN,
          age !== null ? age : NaN,
          NaN,
          NaN,
          3,
          "Converted from age",
          "Converted from age",
          LCAge.AgeModels[ageIdx] !== undefined
            ? LCAge.AgeModels[ageIdx].version
            : NaN,
        ]);
      }
    } else {
      return null;
    }

    return results;
  });
  //--------------------------------------------------------------------------------------------------
  //for finder
  ipcMain.handle("finderGetCoreList", async (_e) => {
    //get data
    let holeList = [];
    let sectionList = [];

    nh = -1;
    for (let p = 0; p < LCCore.projects.length; p++) {
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

    return [holeList, sectionList];
  });
  ipcMain.handle("changeFix", async (_e, isFix) => {
    if (isFix) {
      finderWindow.setAlwaysOnTop(false);
    } else {
      finderWindow.setAlwaysOnTop(true, "normal");
    }
  });
  ipcMain.handle("getSectionLimit", async (_e, projectId, holeName, sectionName) => {
      const idx = LCCore.getIdxFromTrinity(projectId, [
        holeName,
        sectionName,
        "",
      ]);

      const sectionData =
        LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
      const dist_upper = sectionData.markers[0].distance;
      const dist_lower =
        sectionData.markers[sectionData.markers.length - 1].distance;
      return [dist_upper, dist_lower];
    }
  );
  ipcMain.handle("MoveToHorizon", async (_e, data) => {
    mainWindow.webContents.send("MoveToHorizonFromFinder", data);
  });

  ipcMain.handle("finderConvert", async (_e, data, type, method) => {
    const projectId = LCCore.base_project_id;
    let projectIdx = null;
    LCCore.projects.forEach((project, p) => {
      if (project.id[0] == projectId[0]) {
        projectIdx = [p, null, null, null];
      }
    });

    if (projectIdx == null) {
      return null;
    }

    //[name hole section distance cd efd age age_errorU age_errorL correlation_version event_version age_version connection_rank]
    let results = {
      name: null,
      hole: null,
      section: null,
      distance: null,
      cd: null,
      efd: null,
      age_mid: null,
      age_upper: null,
      age_lower: null,
      correlation_rank: null,
      correlation_model_version: null,
      event_model_version: null,
      age_model_version: null,
    };

    if (type == "trinity") {
      //calc each depth
      let send_data = [];
      let td = new Trinity();
      td.name = data[0];
      td.hole_name = data[1];
      td.section_name = data[2];
      td.distance = parseFloat(data[3]);
      send_data.push(td);

      //convert depth (listed for function)
      const cd_list = LCCore.getDepthFromTrinity(
        projectId,
        send_data,
        "composite_depth"
      ); //output:[sec id, cd]
      const cd = [];
      cd.push(cd_list[0][1]);

      //
      const efd_list = LCCore.getDepthFromTrinity(
        projectId,
        send_data,
        "event_free_depth"
      ); //output:[sec id, efd]
      const efd = efd_list[0][1];
      const new_rank = efd_list[0][2];

      //calc age
      const age = LCAge.getAgeFromEFD(efd, method);

      //get age model idx
      let ageIdx = null;
      LCAge.AgeModels.forEach((a, s) => {
        if (a.id == LCAge.selected_id) {
          ageIdx = s;
        }
      });

      //stack
      results.name = send_data[0] !== undefined ? send_data[0].name : NaN;
      results.hole = send_data[0] !== undefined ? send_data[0].hole_name : NaN;
      results.section =
        send_data[0] !== undefined ? send_data[0].section_name : NaN;
      results.distance =
        send_data[0] !== undefined ? send_data[0].distance : NaN;
      results.cd = cd !== null ? cd[0] : NaN;
      results.efd = efd !== null ? efd : NaN;
      results.age_mid = age.mid !== null ? age.mid : NaN;
      results.age_upper = age.upper !== null ? age.upper : NaN;
      results.age_lower = age.lower !== null ? age.lower : NaN;
      results.correlation_rank = new_rank !== null ? new_rank : NaN;
      results.correlation_model_version =
        LCCore.projects[projectIdx[0]].id !== null
          ? LCCore.projects[projectIdx[0]].correlation_version
          : NaN;
      results.event_model_version =
        LCCore.projects[projectIdx[0]].id !== null
          ? LCCore.projects[projectIdx[0]].correlation_version
          : NaN;
      results.age_model_version =
        LCAge.AgeModels[ageIdx] !== undefined
          ? LCAge.AgeModels[ageIdx].version
          : NaN;
    } else if (type == "composite_depth") {
      //get cd
      const name = data[0];
      const cd = data[1];

      //get nearest trinity
      const paseudoTrinity = LCCore.getNearestTrinity(
        projectId,
        cd,
        "composite_depth"
      );

      //calc efd
      const efd = LCCore.getEFDfromCD(projectId, cd);

      //calc age
      const age = LCAge.getAgeFromEFD(efd, method);

      //get age model idx
      let ageIdx = null;
      LCAge.AgeModels.forEach((a, s) => {
        if (a.id == LCAge.selected_id) {
          ageIdx = s;
        }
      });

      //stack
      results.name = name;
      results.hole = paseudoTrinity[0] !== null ? paseudoTrinity[0] : NaN;
      results.section = paseudoTrinity[1] !== null ? paseudoTrinity[1] : NaN;
      results.distance = paseudoTrinity[2] !== null ? paseudoTrinity[2] : NaN;
      results.cd = cd !== null ? cd : NaN;
      results.efd = efd !== null ? efd : NaN;
      results.age_mid = age.mid !== null ? age.mid : NaN;
      results.age_upper = age.upper !== null ? age.upper : NaN;
      results.age_lower = age.lower !== null ? age.lower : NaN;
      results.correlation_rank = 3;
      results.correlation_model_version = "Converted from composite depth";
      results.event_model_version =
        LCCore.projects[projectIdx[0]].id !== null
          ? LCCore.projects[projectIdx[0]].correlation_version
          : NaN;
      results.age_model_version =
        LCAge.AgeModels[ageIdx] !== undefined
          ? LCAge.AgeModels[ageIdx].version
          : NaN;
    } else if (type == "event_free_depth") {
      //get efd
      const name = data[0];
      const efd = data[1];

      //get paseudo cd
      const cd = LCCore.getEFDfromCD(projectId, efd);

      //get nearest trinity
      const paseudoTrinity = LCCore.getNearestTrinity(
        projectId,
        efd,
        "event_free_depth"
      );

      //calc age
      const age = LCAge.getAgeFromEFD(efd, method);

      //get age model idx
      let ageIdx = null;
      LCAge.AgeModels.forEach((a, s) => {
        if (a.id == LCAge.selected_id) {
          ageIdx = s;
        }
      });

      //stack
      results.name = name;
      results.hole = paseudoTrinity[0] !== null ? paseudoTrinity[0] : NaN;
      results.section = paseudoTrinity[1] !== null ? paseudoTrinity[1] : NaN;
      results.distance = paseudoTrinity[2] !== null ? paseudoTrinity[2] : NaN;
      results.cd = cd !== null ? cd : NaN;
      results.efd = efd !== null ? efd : NaN;
      results.age_mid = age.mid !== null ? age.mid : NaN;
      results.age_upper = age.upper !== null ? age.upper : NaN;
      results.age_lower = age.lower !== null ? age.lower : NaN;
      results.correlation_rank = 3;
      results.correlation_model_version = "Converted from event free depth";
      results.event_model_version = "Converted from event free depth";
      results.age_model_version =
        LCAge.AgeModels[ageIdx] !== undefined
          ? LCAge.AgeModels[ageIdx].version
          : NaN;
    } else if (type == "drilling_depth") {
    } else if (type == "age") {
      //get efd
      const name = data[0];
      const age = data[1];

      //calc efd
      const efds = LCAge.getEFDFromAge(age, method);
      const efd = efds.mid;

      //get paseudo cd
      const cd = LCCore.getCDfromEFD(projectId, efd);

      //re-calc age
      const rage = LCAge.getAgeFromEFD(efd, method);

      //get nearest trinity
      const paseudoTrinity = LCCore.getNearestTrinity(
        projectId,
        efd,
        "composite_depth"
      );

      //get age model idx
      let ageIdx = null;
      LCAge.AgeModels.forEach((a, s) => {
        if (a.id == LCAge.selected_id) {
          ageIdx = s;
        }
      });

      //stack
      results.name = name;
      results.hole = paseudoTrinity[0] !== null ? paseudoTrinity[0] : NaN;
      results.section = paseudoTrinity[1] !== null ? paseudoTrinity[1] : NaN;
      results.distance = paseudoTrinity[2] !== null ? paseudoTrinity[2] : NaN;
      results.cd = cd !== null ? cd : NaN;
      results.efd = efd !== null ? efd : NaN;
      results.age_mid = rage.mid !== null ? rage.mid : NaN;
      results.age_upper = rage.upper !== null ? rage.upper : NaN;
      results.age_lower = rage.lower !== null ? rage.lower : NaN;
      results.correlation_rank = 3;
      results.correlation_model_version = "Converted from age";
      results.event_model_version = "Converted from age";
      results.age_model_version =
        LCAge.AgeModels[ageIdx] !== undefined
          ? LCAge.AgeModels[ageIdx].version
          : NaN;
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
