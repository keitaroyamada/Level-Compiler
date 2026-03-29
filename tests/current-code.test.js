const assert = require("node:assert/strict");

const {
  buildCoreFromFixture,
  loadAnswer,
} = require("./helpers/load-fixtures.js");
const { compareAnswerData } = require("./helpers/compare-answers.js");
const { registerTest } = require("./helpers/test-harness.js");

registerTest("current code matches saved LC csv answer", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  const actual = core.exportTestAnswer(null, { roundDigits: 3, trinityStepCm: 1, includeTrinitySweep: true });
  const expected = loadAnswer("lc-csv");
  compareAnswerData(actual, expected, { tolerance: 0.001 });
  assert.equal(core.getState().hasError, false);
});

registerTest("current code matches saved LF csv answer", async () => {
  const core = await buildCoreFromFixture("lf-csv");
  const actual = core.exportTestAnswer(null, { roundDigits: 3, trinityStepCm: 1, includeTrinitySweep: true });
  const expected = loadAnswer("lf-csv");
  compareAnswerData(actual, expected, { tolerance: 0.001 });
});

registerTest("current code matches saved lcmodel answer", async () => {
  const core = await buildCoreFromFixture("lcmodel");
  const actual = core.exportTestAnswer(null, { roundDigits: 3, trinityStepCm: 1, includeTrinitySweep: true });
  const expected = loadAnswer("lcmodel");
  compareAnswerData(actual, expected, { tolerance: 0.001 });
});
