"use strict";

const path = require("path");
const { WINDOW_TYPES } = require("./conventions");

const windows = {
  [WINDOW_TYPES.MAIN]: null,
  [WINDOW_TYPES.FINDER]: null,
  [WINDOW_TYPES.DIVIDER]: null,
  [WINDOW_TYPES.CONVERTER]: null,
  [WINDOW_TYPES.LABELER]: null,
  [WINDOW_TYPES.SETTINGS]: null,
  [WINDOW_TYPES.IMAGE_VIEWER]: null,
  [WINDOW_TYPES.PLOTTER]: null,
  [WINDOW_TYPES.PROGRESS]: null,
  [WINDOW_TYPES.ABOUT]: null,
};

const projectRoot = path.join(__dirname, "..");

const windowDefinitions = Object.freeze({
  [WINDOW_TYPES.MAIN]: {
    browserWindowOptions: ({ isDev = false } = {}) => ({
      title: "Level Compiler",
      width: isDev ? 2000 : 1000,
      height: 800,
      icon: path.join(projectRoot, "icon", "levelcompiler.png"),
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "index.html"),
  },
  [WINDOW_TYPES.FINDER]: {
    browserWindowOptions: () => ({
      title: "LC Finder",
      width: 230,
      height: 580,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_finder.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "finder.html"),
    useNullMenu: true,
  },
  [WINDOW_TYPES.DIVIDER]: {
    browserWindowOptions: () => ({
      title: "LC Divider",
      width: 1300,
      height: 800,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_divider.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "divider.html"),
    useNullMenu: true,
  },
  [WINDOW_TYPES.CONVERTER]: {
    browserWindowOptions: () => ({
      title: "LC Converter",
      width: 700,
      height: 700,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_converter.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "converter.html"),
    useNullMenu: true,
  },
  [WINDOW_TYPES.LABELER]: {
    browserWindowOptions: () => ({
      title: "LC Labeler",
      width: 800,
      height: 800,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_labeler.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "labeler.html"),
    useNullMenu: true,
  },
  [WINDOW_TYPES.SETTINGS]: {
    browserWindowOptions: () => ({
      title: "LC Settings",
      width: 700,
      height: 700,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_settings.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "settings.html"),
    useNullMenu: true,
  },
  [WINDOW_TYPES.IMAGE_VIEWER]: {
    browserWindowOptions: () => ({
      title: "LC Viewer",
      frame: false,
      width: 300,
      height: 800,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_image_viewer.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "image_viewer.html"),
    useNullMenu: true,
  },
  [WINDOW_TYPES.PLOTTER]: {
    browserWindowOptions: () => ({
      title: "LC Plotter",
      width: 800,
      height: 600,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_plotter.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "plotter.html"),
    useNullMenu: true,
  },
  [WINDOW_TYPES.ABOUT]: {
    browserWindowOptions: () => ({
      title: "LC About",
      width: 500,
      height: 300,
      webPreferences: {
        preload: path.join(projectRoot, "preload", "preload_about.js"),
      },
    }),
    htmlPath: path.join(projectRoot, "renderer", "about.html"),
    useNullMenu: true,
  },
});

function mergeWindowOptions(baseOptions, overrides = {}) {
  const mergedOptions = {
    ...baseOptions,
    ...overrides,
  };

  mergedOptions.webPreferences = {
    ...(baseOptions.webPreferences || {}),
    ...(overrides.webPreferences || {}),
  };

  return mergedOptions;
}

function getWindowDefinition(type, options = {}) {
  const definition = windowDefinitions[type];
  if (!definition) {
    throw new Error(`Unknown window type: ${type}`);
  }

  const baseOptions = definition.browserWindowOptions(options);
  const browserWindowOverrides = options.browserWindowOptions || {};
  const browserWindowOptions = mergeWindowOptions(baseOptions, browserWindowOverrides);

  return {
    browserWindowOptions,
    htmlPath: definition.htmlPath,
    useNullMenu: definition.useNullMenu === true,
  };
}

function createWindow(type, options = {}) {
  const {
    BrowserWindowClass,
  } = options;
  const windowClass = BrowserWindowClass || require("electron").BrowserWindow;
  const definition = getWindowDefinition(type, options);
  const windowRef = new windowClass(definition.browserWindowOptions);

  if (definition.useNullMenu && typeof windowRef.setMenu === "function") {
    windowRef.setMenu(null);
  }

  if (definition.htmlPath && typeof windowRef.loadFile === "function") {
    windowRef.loadFile(definition.htmlPath);
  }

  return windowRef;
}

function getWindow(type) {
  return Object.prototype.hasOwnProperty.call(windows, type) ? windows[type] : null;
}

function setWindow(type, windowRef) {
  windows[type] = windowRef ?? null;
  return windows[type];
}

function clearWindow(type) {
  windows[type] = null;
  return windows[type];
}

function hasWindow(type) {
  const windowRef = getWindow(type);
  if (!windowRef) {
    return false;
  }

  if (typeof windowRef.isDestroyed === "function") {
    return !windowRef.isDestroyed();
  }

  return true;
}

function getAllWindows() {
  return { ...windows };
}

module.exports = {
  WINDOW_TYPES,
  clearWindow,
  createWindow,
  getAllWindows,
  getWindowDefinition,
  getWindow,
  hasWindow,
  setWindow,
};
