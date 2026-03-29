const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

async function readLcmodelObject(filepath) {
  const fileBuffer = fs.readFileSync(filepath);
  const isZip =
    fileBuffer[0] === 0x50 &&
    fileBuffer[1] === 0x4b &&
    fileBuffer[2] === 0x03 &&
    fileBuffer[3] === 0x04;

  if (!isZip) {
    return {
      isZip: false,
      data: JSON.parse(fileBuffer.toString("utf8")),
    };
  }

  const zip = await JSZip.loadAsync(fileBuffer);
  const file = zip.file("lcmodel.json");
  if (!file) {
    throw new Error("lcmodel.json was not found in lcmodel archive.");
  }

  const content = await file.async("string");
  return {
    isZip: true,
    zip,
    data: JSON.parse(content),
  };
}

async function writeLcmodelObject(outputPath, payload) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (!payload.isZip) {
    fs.writeFileSync(outputPath, JSON.stringify(payload.data, null, 2), "utf8");
    return outputPath;
  }

  payload.zip.file("lcmodel.json", JSON.stringify(payload.data, null, 2));
  const buffer = await payload.zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function mutateLcmodelFile(sourcePath, outputPath, mutator) {
  const payload = await readLcmodelObject(sourcePath);
  mutator(payload.data);
  return writeLcmodelObject(outputPath, payload);
}

module.exports = {
  readLcmodelObject,
  writeLcmodelObject,
  mutateLcmodelFile,
};
