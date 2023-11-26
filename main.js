//npm start
//npx electronmon .
//npm cache verify --force

const path = require("path");
const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const { LevelCompilerCore } = require("./LC_modules/LevelCompilerCore.js");
const { Project } = require("./LC_modules/Project.js");
const { lcfnc } = require("./LC_modules/lcfnc.js");
const { LevelCompilerAge } = require("./LC_modules/LevelCompilerAge.js");

//properties
const isMac = process.platform === "darwin";
const isDev = process.env.NODE_ENV !== "development";
//const isDev = false;
const LCCore = new LevelCompilerCore();
const LCAge = new LevelCompilerAge();

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
        // for Windows
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
    // for windows ----------------------------------------------------------------------------------
    ...(!isMac
      ? [
          {
            label: "Help",
            submenu: [{ label: "About", click: createAboutWindow }],
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
    console.log("MAIN: Project correlation data is initiarised.");
    return LCCore;
  });

  ipcMain.handle("InitiariseAgeModel", async (_e) => {
    //import modeln
    console.log("MAIN: Initiarise age model");
    LCAge.AgeModels = [];
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
  });

  ipcMain.handle("GetAgeFromEFD", async (_e, modelId, efd, method) => {
    //calc age
    const age = LCAge.getAgeFromEFD(modelId, efd, method);
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
    const age = LCAge.getAgeFromEFD(modelId, efd, method);
    if (age == null) {
      return "";
    } else {
      return age.mid;
    }
  });

  ipcMain.handle("OpenFinder", async (_e) => {
    //create finder window
    createFinderWindow();
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
  //===================================================================================================================================
}

//--------------------------------------------------------------------------------------------------
//create finder window
function createFinderWindow() {
  const finderWindow = new BrowserWindow({
    title: "Finder",
    width: 300,
    height: 300,
  });
  finderWindow.loadFile(path.join(__dirname, "./renderer/finder.html"));
}

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
