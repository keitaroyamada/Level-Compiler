const assert = require("node:assert/strict");
const path = require("path");

const { LevelCompilerCore } = require("../LC_modules/LevelCompilerCore.js");
const { LevelCompilerAge } = require("../LC_modules/LevelCompilerAge.js");
const {
  FIXTURE_PATHS,
  createTempDir,
  buildCoreFromFixture,
} = require("./helpers/load-fixtures.js");
const {
  copyFileWithNewName,
  mutateCsvFile,
  replaceFirstCellMatching,
} = require("./helpers/mutate-csv.js");
const { mutateLcmodelFile } = require("./helpers/mutate-lcmodel.js");
const { registerTest } = require("./helpers/test-harness.js");

function surfacedAsIssue(core, extraCheck = null) {
  const stateIssue = core.getState().hasError === true;
  const modelIssues = (() => {
    try {
      const results = core.checkModel();
      if (!Array.isArray(results)) {
        return false;
      }
      return results.some((result) =>
        result.evaluation === false ||
        result.cd_error_incompleted_counts > 0 ||
        result.efd_error_incompleted_counts > 0 ||
        result.distance_confliction_counts > 0
      );
    } catch {
      return true;
    }
  })();

  return stateIssue || modelIssues || (typeof extraCheck === "function" ? extraCheck() : false);
}

registerTest("rejects LC csv without model identifier", () => {
  const tempDir = createTempDir("bad-lc-filename");
  const mutatedPath = path.join(tempDir, "SG06-no-identifier.csv");
  copyFileWithNewName(FIXTURE_PATHS.lcCsv, mutatedPath);

  const core = new LevelCompilerCore();
  const result = core.loadModelFromCsv(mutatedPath, "forLC");

  assert.equal(result, null);
  assert.equal(core.getState().hasError, true);
});

registerTest("surfaces issue for LC csv with mismatched top and bottom markers", async () => {
  const tempDir = createTempDir("bad-top-bottom");
  const mutatedPath = path.join(tempDir, path.basename(FIXTURE_PATHS.lcCsv));

  mutateCsvFile(FIXTURE_PATHS.lcCsv, mutatedPath, (rows) => {
    replaceFirstCellMatching(
      rows,
      (value) => typeof value === "string" && value.toLowerCase().includes("-bottom"),
      (value) => `${value}-broken`
    );
  });

  const core = new LevelCompilerCore();
  core.loadModelFromCsv(mutatedPath, "forLC");
  core.calcCompositeDepth();
  core.calcEventFreeDepth(false);

  assert.equal(surfacedAsIssue(core), true);
});

registerTest("surfaces issue for LF event csv with out of section distances", () => {
  const tempDir = createTempDir("bad-lf-event");
  const mutatedEventPath = path.join(tempDir, path.basename(FIXTURE_PATHS.lfEventCsv));

  mutateCsvFile(FIXTURE_PATHS.lfEventCsv, mutatedEventPath, (rows) => {
    if (rows.length < 2 || rows[1].length < 4) {
      throw new Error("LF event csv is shorter than expected.");
    }
    rows[1][2] = "99999";
    rows[1][3] = "99999";
  });

  const core = new LevelCompilerCore();
  core.loadModelFromCsv(FIXTURE_PATHS.lfModelCsv, "forLF");
  core.loadEventListFromCsv(mutatedEventPath);
  core.calcCompositeDepth();
  core.calcEventFreeDepth(false);

  assert.equal(surfacedAsIssue(core), true);
});

registerTest("surfaces issue for age csv with nonexistent trinity", async () => {
  const tempDir = createTempDir("bad-age-trinity");
  const mutatedAgePath = path.join(tempDir, path.basename(FIXTURE_PATHS.ageCsv));

  mutateCsvFile(FIXTURE_PATHS.ageCsv, mutatedAgePath, (rows) => {
    if (rows.length < 2 || rows[1].length < 4) {
      throw new Error("Age csv is shorter than expected.");
    }
    rows[1][1] = "99";
    rows[1][2] = "99";
    rows[1][3] = "99999";
  });

  const core = await buildCoreFromFixture("lc-csv");

  const normalAge = new LevelCompilerAge();
  const normalResult = normalAge.loadAgeFromCsv(core, FIXTURE_PATHS.ageCsv, "LC");
  normalAge.checkAges();

  const mutatedAge = new LevelCompilerAge();
  const mutatedResult = mutatedAge.loadAgeFromCsv(core, mutatedAgePath, "LC");
  mutatedAge.checkAges();

  assert.equal(normalResult, true);
  assert.equal(mutatedResult, true);
  assert.ok(normalAge.AgeModels[0].ages.length > mutatedAge.AgeModels[0].ages.length);
});

registerTest("surfaces issue for lcmodel with missing zero points", async () => {
  const tempDir = createTempDir("bad-lcmodel-zero-point");
  const mutatedPath = path.join(tempDir, path.basename(FIXTURE_PATHS.lcmodel));

  await mutateLcmodelFile(FIXTURE_PATHS.lcmodel, mutatedPath, (rawModel) => {
    const model = rawModel && rawModel.LCCore ? rawModel.LCCore : rawModel;
    for (const project of model.projects || []) {
      for (const hole of project.holes || []) {
        for (const section of hole.sections || []) {
          for (const marker of section.markers || []) {
            marker.isZeroPoint = false;
          }
        }
      }
    }
  });

  const core = new LevelCompilerCore();
  const rawModel = require("./helpers/load-fixtures.js");
  const loaded = await rawModel.loadLcModelFile(mutatedPath);
  const lcmodelData = loaded && loaded.LCCore ? loaded.LCCore : loaded;
  core.loadModelFromLcmodel(lcmodelData);
  core.calcCompositeDepth();
  core.calcEventFreeDepth(false);

  assert.equal(surfacedAsIssue(core), true);
});
