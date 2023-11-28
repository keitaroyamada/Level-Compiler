//npm start
//npx electronmon .
//npm cache verify --force

const path = require("path");
const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const { LevelCompilerCore } = require("./LC_modules/LevelCompilerCore.js");
const { Project } = require("./LC_modules/Project.js");
const { lcfnc } = require("./LC_modules/lcfnc.js");
const { LevelCompilerAge } = require("./LC_modules/LevelCompilerAge.js");
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const { Trinity } = require("./LC_modules/Trinity.js");

//properties
const isMac = process.platform === "darwin";
const isDev = process.env.NODE_ENV !== "development";
//const isDev = false;
const LCCore = new LevelCompilerCore();
const LCAge = new LevelCompilerAge();

//
let finderWindow = null;

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
  });

  //when close
  /*
  mainWindow.on("close", (e) => {
    if (!e.ctrlKey) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: "question",
        buttons: ["Yes", "No"],
        title: "Confirm",
        message: "Are you sure you want to close Level Compiler?",
      });

      if (choice === 1) {
        e.preventDefault();
      }
    }
  });
  */

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
              //win.webContents.openDevTools();
              win.setMenu(null);
              win.webContents.send("ConverterMenuClicked", "");
            });
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
  const mainMenu = Menu.buildFromTemplate(lcmenu);
  Menu.setApplicationMenu(mainMenu);

  //===================================================================================================================================
  //IPC from renderer
  ipcMain.handle("test", async (_e, _arg1, _arg2) => {
    console.log("test handle called");
    console.log(_arg1 + _arg2);
  });

  ipcMain.handle("InitiariseCorrelationModel", async (_e) => {
    //import modeln
    console.log("MAIN: Initiarise correlation model");
    LCCore.projectData = new Project();
    LCCore.projectData.id = [1, null, null, null];
    LCCore.model_data = null;
    LCCore.event_data = null;
    LCCore.reserved_project_ids = [1];
    LCCore.selected_id = null;
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

  ipcMain.handle("MountModelFromCsv", async (_e, model_path) => {
    try {
      //import model
      console.log('MAIN: Import correlation model from "' + model_path + '"');
      LCCore.loadModelFromCsv(model_path);
      return LCCore.projectData.name;
    } catch (error) {
      return null;
      console.error("Correlation model load error.");
    }
  });

  ipcMain.handle("LoadModelFromLCCore", async (_e, model_id) => {
    //import model
    console.log('MAIN: Load correlation model id: "' + model_id + '"');
    return LCCore.projectData;
  });
  ipcMain.handle("UpdateModelSelection", async (_e, model_id) => {
    //import model
    LCCore.selected_id = model_id.correlation;
    LCAge.selected_id = model_id.age;
    console.log(
      "MAIN: Update model selection: Correlation: " +
        model_id.correlation +
        ", Age: " +
        model_id.age
    );
  });

  ipcMain.handle("CalcCompositeDepth", async (_e) => {
    //import model
    console.log("MAIN: Calc composite depth.");
    LCCore.calcCompositeDepth();
    return LCCore.projectData;
  });

  ipcMain.handle("CalcEventFreeDepth", async (_e) => {
    //import model
    console.log("MAIN: Calc event free depth");
    LCCore.calcEventFreeDepth();
    //LCCore.getModelSummary();
    return LCCore.projectData;
  });

  ipcMain.handle("MountAgeFromCsv", async (_e, age_path) => {
    try {
      //import model
      //console.log('MAIN: Import age model from "' + age_path + '"');
      LCAge.loadAgeFromCsv(LCCore, age_path);

      //apply latest age model to the depth model
      const model_id = LCAge.AgeModels.length;
      let model_name = "";
      LCAge.AgeModels.forEach((model) => {
        model_name = model.name;
      });

      console.log("MAIN: Imported age model");
      return [model_id, model_name];
    } catch (error) {
      console.error("Age model load error.");
    }
  });

  ipcMain.handle("LoadAgeFromLCAge", async (_e, age_id) => {
    //apply latest age model to the depth model
    console.log("MAIN: Load age model id: " + age_id);
    let model_name = null;
    LCAge.AgeModels.forEach((model) => {
      if (model.id == age_id) {
        model_name = model.name;
      }
    });

    if (model_name == null) {
      return null;
    }

    console.log(age_id + ":" + model_name);
    //load ages into LCCore
    LCCore.clacMarkerAges(LCAge, age_id);
    return LCCore.projectData;
  });

  ipcMain.handle("FileChoseDialog", async (_e, title, ext) => {
    const result = await getfile(mainWindow, title, ext);
    return result;
  });

  ipcMain.handle("GetAgeFromEFD", async (_e, modelId, efd, method) => {
    //calc age
    LCAge.selected_id = modelId;
    const age = LCAge.getAgeFromEFD(efd, method);
    if (age == null) {
      return "";
    } else {
      return age.mid;
    }
  });

  ipcMain.handle("GetAgeFromCD", async (_e, modelId, cd, method) => {
    //calc efd
    const efd = LCCore.getEFDfromCD(cd);
    if (efd == null) {
      return "";
    }

    //calc age
    LCAge.selected_id = modelId;
    const age = LCAge.getAgeFromEFD(efd, method);
    if (age == null) {
      return "";
    } else {
      return age.mid;
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
    data.push([LCCore.projectData.id, LCCore.projectData.name]);
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
    console.log(data);
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
          send_data,
          "composite_depth"
        ); //output:[sec id, cd]
        const cd = [];
        cd.push(cd_list[0][1]);

        //
        const efd_list = LCCore.getDepthFromTrinity(
          send_data,
          "event_free_depth"
        ); //output:[sec id, efd]
        const efd = efd_list[0][1];
        const new_rank = efd_list[0][2];

        //calc age
        LCAge.selected_id = modelIds.age;
        const age = LCAge.getAgeFromEFD(efd, method);

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
          age.mid !== null ? age.mid : NaN,
          age.upper !== null ? age.upper : NaN,
          age.lower !== null ? age.lower : NaN,
          new_rank !== null ? new_rank : NaN,
          LCCore.projectData.id !== null
            ? LCCore.projectData.correlation_version
            : NaN,
          LCCore.projectData.id !== null
            ? LCCore.projectData.correlation_version
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
        const efd = LCCore.getEFDfromCD(cd);

        //calc age
        LCAge.selected_id = modelIds.age;
        const age = LCAge.getAgeFromEFD(efd, method);

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
          age.mid !== null ? age.mid : NaN,
          age.upper !== null ? age.upper : NaN,
          age.lower !== null ? age.lower : NaN,
          3,
          "Converted from composite depth",
          LCCore.projectData.id !== null
            ? LCCore.projectData.correlation_version
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
          age.mid !== null ? age.mid : NaN,
          age.upper !== null ? age.upper : NaN,
          age.lower !== null ? age.lower : NaN,
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

    for (let h = 0; h < LCCore.projectData.holes.length; h++) {
      const hole = LCCore.projectData.holes[h];
      holeList.push([h, hole.id, hole.name]);
      let secTmep = [];
      for (let s = 0; s < hole.sections.length; s++) {
        const section = hole.sections[s];
        secTmep.push([
          s,
          section.id,
          section.name,
          section.markers[0].distance,
          section.markers[section.markers.length - 1].distance,
        ]);
      }
      sectionList.push(secTmep);
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
  ipcMain.handle("getSectionLimit", async (_e, holeName, sectionName) => {
    const idx = LCCore.getIdxFromTrinity([holeName, sectionName, ""]);
    const sectionData = LCCore.projectData.holes[idx[1]].sections[idx[2]];
    const dist_upper = sectionData.markers[0].distance;
    const dist_lower =
      sectionData.markers[sectionData.markers.length - 1].distance;
    return [dist_upper, dist_lower];
  });
  ipcMain.handle("MoveToHorizon", async (_e, data) => {
    mainWindow.webContents.send("MoveToHorizonFromFinder", data);
  });

  ipcMain.handle("finderConvert", async (_e, data, type, method) => {
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
      const cd_list = LCCore.getDepthFromTrinity(send_data, "composite_depth"); //output:[sec id, cd]
      const cd = [];
      cd.push(cd_list[0][1]);

      //
      const efd_list = LCCore.getDepthFromTrinity(
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
        LCCore.projectData.id !== null
          ? LCCore.projectData.correlation_version
          : NaN;
      results.event_model_version =
        LCCore.projectData.id !== null
          ? LCCore.projectData.correlation_version
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
      const paseudoTrinity = LCCore.getNearestTrinity(cd, "composite_depth");

      //calc efd
      const efd = LCCore.getEFDfromCD(cd);

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
        LCCore.projectData.id !== null
          ? LCCore.projectData.correlation_version
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
      const cd = LCCore.getEFDfromCD(efd);

      //get nearest trinity
      const paseudoTrinity = LCCore.getNearestTrinity(efd, "event_free_depth");

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
      const cd = LCCore.getCDfromEFD(efd);

      //re-calc age
      const rage = LCAge.getAgeFromEFD(efd, method);

      //get nearest trinity
      const paseudoTrinity = LCCore.getNearestTrinity(efd, "composite_depth");

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

//--------------------------------------------------------------------------------------------------
//create about window
function createAboutWindow() {
  const aboutWindow = new BrowserWindow({
    title: "About Level Compiler",
    width: 300,
    height: 300,
  });
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
