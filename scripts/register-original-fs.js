const Module = require("module");

const originalLoad = Module._load;

Module._load = function patchedOriginalFs(request, parent, isMain) {
  if (request === "original-fs") {
    return require("fs");
  }
  return originalLoad.call(this, request, parent, isMain);
};
