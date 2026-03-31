"use strict";

const { WINDOW_TYPES } = require("./conventions");

const windows = {
  [WINDOW_TYPES.MAIN]: null,
  [WINDOW_TYPES.FINDER]: null,
  [WINDOW_TYPES.DIVIDER]: null,
  [WINDOW_TYPES.CONVERTER]: null,
  [WINDOW_TYPES.IMPORTER]: null,
  [WINDOW_TYPES.LABELER]: null,
  [WINDOW_TYPES.SETTINGS]: null,
  [WINDOW_TYPES.IMAGE_VIEWER]: null,
  [WINDOW_TYPES.PLOTTER]: null,
  [WINDOW_TYPES.PROGRESS]: null,
};

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
  getAllWindows,
  getWindow,
  hasWindow,
  setWindow,
};
