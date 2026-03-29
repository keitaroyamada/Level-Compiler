const assert = require("node:assert/strict");

const { buildAgeModelFromFixture } = require("./helpers/load-fixtures.js");
const { registerTest } = require("./helpers/test-harness.js");

registerTest("loads age csv and builds a valid age model", async () => {
  const { age, loadResult } = await buildAgeModelFromFixture("LC");
  assert.equal(loadResult, true);
  assert.ok(age.AgeModels.length > 0);
  assert.ok(age.AgeModels[0].ages.length >= 2);
});

registerTest("age tie points round trip between EFD and age", async () => {
  const { age } = await buildAgeModelFromFixture("LC");
  const enabledAges = age.AgeModels[0].ages.filter((ageData) =>
    ageData.enable === true &&
    Number.isFinite(ageData.event_free_depth) &&
    Number.isFinite(ageData.age_mid)
  );

  assert.ok(enabledAges.length > 0);

  for (const ageData of enabledAges.slice(0, 50)) {
    const fromEfd = age.getAgeFromEFD(ageData.event_free_depth, "linear");
    const fromAge = age.getEFDFromAge(ageData.age_mid, "linear");

    assert.ok(Math.abs(fromEfd.age.mid - ageData.age_mid) <= 0.001);
    assert.ok(Math.abs(fromAge.efd.mid - ageData.event_free_depth) <= 0.001);
  }
});

registerTest("updateAgeDepth preserves finite depths for valid age points", async () => {
  const { core, age } = await buildAgeModelFromFixture("LC");
  age.updateAgeDepth(core);

  const finiteCount = age.AgeModels[0].ages.filter((ageData) => Number.isFinite(ageData.event_free_depth)).length;
  assert.ok(finiteCount >= 2);
});

registerTest("age contradiction counts match expected current model state", async () => {
  const { age } = await buildAgeModelFromFixture("LC");
  const model = age.AgeModels[0];

  const contradictionCount = model.ages.filter((ageData) => ageData.reliable === false).length;
  const disabledCount = model.ages.filter((ageData) => ageData.enable === false).length;
  const enabledCount = model.ages.filter((ageData) => ageData.enable === true).length;

  assert.equal(model.ages.length, 751);
  assert.equal(contradictionCount, 8);
  assert.equal(disabledCount, 8);
  assert.equal(enabledCount, 743);
});

registerTest("age extrapolation is explicitly reported outside tie point range", async () => {
  const { age } = await buildAgeModelFromFixture("LC");
  const model = age.AgeModels[0];
  const enabledAges = model.ages.filter((ageData) => ageData.enable === true);
  const shallowest = enabledAges[0];
  const deepest = enabledAges[enabledAges.length - 1];

  const upper = age.getAgeFromEFD(shallowest.event_free_depth - 1, "linear");
  const lower = age.getAgeFromEFD(deepest.event_free_depth + 1, "linear");

  assert.equal(upper.age.source.type, "extrapolation");
  assert.equal(lower.age.source.type, "extrapolation");
});
