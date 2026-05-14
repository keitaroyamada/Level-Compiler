"use strict";

const { parentPort, workerData } = require("worker_threads");
const Module = require("module");

const originalLoad = Module._load;
Module._load = function patchedOriginalFsLoad(request, parent, isMain) {
  if (request === "original-fs") {
    try {
      return originalLoad.apply(this, arguments);
    } catch (err) {
      if (err?.code === "MODULE_NOT_FOUND") {
        return require("fs");
      }
      throw err;
    }
  }

  return originalLoad.apply(this, arguments);
};

const { LevelCompilerCore } = require("../LC_modules/LevelCompilerCore.js");

function postProgress(progress) {
  parentPort.postMessage({
    type: "progress",
    done: progress?.done ?? 0,
    total: progress?.total ?? 0,
  });
}

try {
  const core = new LevelCompilerCore();
  Object.assign(core, workerData.model);
  core.updateSearchIdx();

  const results = core.leaveOneOut(workerData.target ?? "project", postProgress);
  parentPort.postMessage({ type: "done", results });
} catch (err) {
  parentPort.postMessage({
    type: "error",
    message: err?.message ?? String(err),
    stack: err?.stack ?? null,
  });
}
