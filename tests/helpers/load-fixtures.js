const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const { LevelCompilerCore } = require("../../LC_modules/LevelCompilerCore.js");
const { LevelCompilerAge } = require("../../LC_modules/LevelCompilerAge.js");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const PUBLIC_TEST_DATA_DIR = path.join(ROOT_DIR, "test_data");
const PRIVATE_TEST_DATA_DIR = path.join(ROOT_DIR, "test_data_private");
const ANSWERS_DIR = path.join(ROOT_DIR, "tests", "answers");
const TEMP_DIR = path.join(ROOT_DIR, "tests", "temp");

const FIXTURE_PATHS = {
  lcCsv: path.join(PRIVATE_TEST_DATA_DIR, "[correlation]SG06(24 Nov. 2023).csv"),
  lfModelCsv: path.join(PRIVATE_TEST_DATA_DIR, "1. SG06 Correlation model plus SG93 as D11-36 (06 Apr. 2020).csv"),
  lfEventCsv: path.join(PRIVATE_TEST_DATA_DIR, "2. SG06  list of event layers (13 Feb. 2017).csv"),
  lcmodel: path.join(PRIVATE_TEST_DATA_DIR, "SG06-SG14-.lcmodel"),
  ageCsv: path.join(PRIVATE_TEST_DATA_DIR, "[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv"),
};

const ANSWER_PATHS = {
  lcCsv: path.join(ANSWERS_DIR, "lc-csv.json"),
  lfCsv: path.join(ANSWERS_DIR, "lf-csv.json"),
  lcmodel: path.join(ANSWERS_DIR, "lcmodel.json"),
};

function ensureFixtureFilesExist() {
  Object.values(FIXTURE_PATHS).forEach((filepath) => {
    if (!fs.existsSync(filepath)) {
      throw new Error(`Fixture file does not exist: ${filepath}`);
    }
  });
  Object.values(ANSWER_PATHS).forEach((filepath) => {
    if (!fs.existsSync(filepath)) {
      throw new Error(`Answer file does not exist: ${filepath}`);
    }
  });
}

async function loadLcModelFile(filepath) {
  const fileBuffer = fs.readFileSync(filepath);
  const isZip =
    fileBuffer[0] === 0x50 &&
    fileBuffer[1] === 0x4b &&
    fileBuffer[2] === 0x03 &&
    fileBuffer[3] === 0x04;

  if (!isZip) {
    return JSON.parse(fileBuffer.toString("utf8"));
  }

  const zip = await JSZip.loadAsync(fileBuffer);
  const file = zip.file("lcmodel.json");
  if (!file) {
    throw new Error("lcmodel.json was not found in lcmodel archive.");
  }

  const content = await file.async("string");
  return JSON.parse(content);
}

async function buildCoreFromFixture(type, overrides = {}) {
  ensureFixtureFilesExist();

  const core = new LevelCompilerCore();

  if (type === "lc-csv") {
    core.loadModelFromCsv(overrides.inputPath || FIXTURE_PATHS.lcCsv, "forLC");
  } else if (type === "lf-csv") {
    core.loadModelFromCsv(overrides.inputPath || FIXTURE_PATHS.lfModelCsv, "forLF");
    core.loadEventListFromCsv(overrides.eventPath || FIXTURE_PATHS.lfEventCsv);
  } else if (type === "lcmodel") {
    const rawLcmodelData = await loadLcModelFile(overrides.inputPath || FIXTURE_PATHS.lcmodel);
    const lcmodelData = rawLcmodelData && rawLcmodelData.LCCore ? rawLcmodelData.LCCore : rawLcmodelData;
    core.loadModelFromLcmodel(lcmodelData);
  } else {
    throw new Error(`Unsupported fixture type: ${type}`);
  }

  core.calcCompositeDepth();
  core.calcEventFreeDepth(false);

  return core;
}

async function buildAgeModelFromFixture(type = "LC", options = {}) {
  const core = options.core || await buildCoreFromFixture("lc-csv");
  const age = new LevelCompilerAge();
  const agePath = options.agePath || FIXTURE_PATHS.ageCsv;
  const loadResult = age.loadAgeFromCsv(core, agePath, type);
  age.checkAges();
  return { core, age, loadResult };
}

function loadAnswer(type) {
  let filepath = null;
  if (type === "lc-csv") {
    filepath = ANSWER_PATHS.lcCsv;
  } else if (type === "lf-csv") {
    filepath = ANSWER_PATHS.lfCsv;
  } else if (type === "lcmodel") {
    filepath = ANSWER_PATHS.lcmodel;
  } else {
    throw new Error(`Unsupported answer type: ${type}`);
  }

  return JSON.parse(fs.readFileSync(filepath, "utf8"));
}

function createTempDir(prefix) {
  const dirname = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const dirpath = path.join(TEMP_DIR, dirname);
  fs.mkdirSync(dirpath, { recursive: true });
  return dirpath;
}

module.exports = {
  ROOT_DIR,
  PUBLIC_TEST_DATA_DIR,
  PRIVATE_TEST_DATA_DIR,
  ANSWERS_DIR,
  TEMP_DIR,
  FIXTURE_PATHS,
  ANSWER_PATHS,
  ensureFixtureFilesExist,
  loadLcModelFile,
  buildCoreFromFixture,
  buildAgeModelFromFixture,
  loadAnswer,
  createTempDir,
};
