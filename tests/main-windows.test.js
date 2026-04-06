const { registerTest } = require("./helpers/test-harness.js");
const {
  WINDOW_TYPES,
  clearWindow,
  createWindow,
  getAllWindows,
  getWindowDefinition,
  getWindow,
  hasWindow,
  setWindow,
} = require("../main/windows.js");

registerTest("window store keeps and clears the main window reference", () => {
  clearWindow(WINDOW_TYPES.MAIN);

  const fakeWindow = {
    isDestroyed: () => false,
  };

  setWindow(WINDOW_TYPES.MAIN, fakeWindow);

  if (getWindow(WINDOW_TYPES.MAIN) !== fakeWindow) {
    throw new Error("Expected main window reference to be returned as stored.");
  }

  if (!hasWindow(WINDOW_TYPES.MAIN)) {
    throw new Error("Expected hasWindow(main) to be true for a live window.");
  }

  clearWindow(WINDOW_TYPES.MAIN);

  if (getWindow(WINDOW_TYPES.MAIN) !== null) {
    throw new Error("Expected clearWindow(main) to reset the stored reference.");
  }
});

registerTest("window store reports destroyed windows as unavailable", () => {
  clearWindow(WINDOW_TYPES.MAIN);

  setWindow(WINDOW_TYPES.MAIN, {
    isDestroyed: () => true,
  });

  if (hasWindow(WINDOW_TYPES.MAIN)) {
    throw new Error("Expected destroyed main window to be treated as unavailable.");
  }

  const snapshot = getAllWindows();
  if (!Object.prototype.hasOwnProperty.call(snapshot, WINDOW_TYPES.MAIN)) {
    throw new Error("Expected main window key to exist in window store snapshot.");
  }

  clearWindow(WINDOW_TYPES.MAIN);
});

registerTest("createWindow applies managed defaults for helper windows", () => {
  const calls = [];

  class FakeBrowserWindow {
    constructor(options) {
      this.options = options;
    }

    setMenu(value) {
      calls.push({ type: "setMenu", value });
    }

    loadFile(filePath) {
      calls.push({ type: "loadFile", filePath });
    }
  }

  const windowRef = createWindow(WINDOW_TYPES.FINDER, {
    BrowserWindowClass: FakeBrowserWindow,
    browserWindowOptions: {
      parent: { id: "main" },
    },
  });

  if (!(windowRef instanceof FakeBrowserWindow)) {
    throw new Error("Expected createWindow to construct the supplied BrowserWindow class.");
  }

  if (windowRef.options.title !== "LC Finder") {
    throw new Error("Expected finder window title to come from the window definition.");
  }

  if (windowRef.options.parent?.id !== "main") {
    throw new Error("Expected createWindow overrides to merge into BrowserWindow options.");
  }

  if (!calls.some((call) => call.type === "setMenu" && call.value === null)) {
    throw new Error("Expected helper windows to clear their menu by default.");
  }

  if (!calls.some((call) => call.type === "loadFile" && call.filePath.endsWith("renderer\\finder.html"))) {
    throw new Error("Expected helper windows to load their renderer entry file.");
  }
});

registerTest("getWindowDefinition resolves main window defaults with dev sizing", () => {
  const definition = getWindowDefinition(WINDOW_TYPES.MAIN, { isDev: true });

  if (definition.browserWindowOptions.width !== 2000) {
    throw new Error("Expected dev main window width to expand to 2000.");
  }

  if (!definition.browserWindowOptions.webPreferences.preload.endsWith("preload\\preload.js")) {
    throw new Error("Expected main window preload path to be resolved by the factory.");
  }
});
