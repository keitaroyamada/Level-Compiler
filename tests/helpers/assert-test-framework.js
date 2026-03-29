const assert = require("node:assert/strict");
const { compareAnswerData } = require("./compare-answers.js");

function assertComparatorDetectsMismatch(answer) {
  const mutated = JSON.parse(JSON.stringify(answer));
  if (!mutated.markers || mutated.markers.length === 0) {
    throw new Error("The supplied answer does not contain markers.");
  }

  mutated.markers[0].composite_depth_cm =
    mutated.markers[0].composite_depth_cm == null
      ? 0.123
      : mutated.markers[0].composite_depth_cm + 0.1;

  assert.throws(() => {
    compareAnswerData(mutated, answer, { tolerance: 0.001 });
  });
}

function assertComparatorRespectsTolerance(answer) {
  const mutated = JSON.parse(JSON.stringify(answer));
  if (!mutated.markers || mutated.markers.length === 0) {
    throw new Error("The supplied answer does not contain markers.");
  }

  const original = mutated.markers[0].composite_depth_cm;
  if (original == null) {
    mutated.markers[0].composite_depth_cm = 0;
  } else {
    mutated.markers[0].composite_depth_cm = original + 0.0005;
  }

  compareAnswerData(mutated, answer, { tolerance: 0.001 });
}

module.exports = {
  assertComparatorDetectsMismatch,
  assertComparatorRespectsTolerance,
};
