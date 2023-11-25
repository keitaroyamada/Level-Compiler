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

  //open devtools if in dev env
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  mainWindow.loadFile(path.join(__dirname, "./renderer/index.html"));

  //===================================================================================================================================
  //IPC from renderer
  ipcMain.handle("test", async (_e, _arg1, _arg2) => {
    console.log("test handle called");
    console.log(_arg1 + _arg2);
  });

  ipcMain.handle("Initiarise", async (_e) => {
    //import modeln
    console.log("MAIN: Initiarise");
    LCCore.projectData = new Project();
    LCCore.projectData.id = [1, null, null, null];
    LCCore.model_data = null;
    LCCore.event_data = null;
    LCCore.reserved_project_ids = [1];
    console.log("MAIN: Project data is initiarised.");
    return LCCore;
  });

  ipcMain.handle("LoadModelFromCsv", async (_e, model_path) => {
    //import model
    console.log('MAIN: Load model from "' + model_path + '"');
    LCCore.loadModelFromCsv(model_path);
    return LCCore.projectData;
  });

  ipcMain.handle("LoadEventFromCsv", async (_e, event_path) => {
    //import model
    LCCore.loadEventFromCsv(event_path);
    LCCore.getModelSummary();
    console.log('MAIN: Load event list from "' + event_path + '"');
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

  ipcMain.handle("open-dialog", async (_e, _arg) => {
    return dialog
      .showOpenDialog(mainWindow, {
        properties: ["openFile"],
      })
      .then((result) => {
        if (result.canceled) return "";
        return result.filePaths[0];
      });
  });

  ipcMain.handle("OpenFinder", async (_e) => {
    //create finder window
    createFinderWindow();
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
  const aboutWindow = new BrowserWindow({
    title: "Finder",
    width: 300,
    height: 300,
  });
  aboutWindow.loadFile(path.join(__dirname, "./renderer/finder.html"));
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

  //Implement menu
  const mainMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(mainMenu);

  app.on("activate", (I) => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWIndow();
    }
  });
});
//--------------------------------------------------------------------------------------------------
//Menu template
const menu = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),
  {
    role: "fileMenu",
  },
  ...(!isMac
    ? [
        {
          label: "Help",
          submenu: [
            {
              label: "About",
              click: createAboutWindow,
            },
          ],
        },
      ]
    : []),
];

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});
