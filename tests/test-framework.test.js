const { loadAnswer } = require("./helpers/load-fixtures.js");
const {
  assertComparatorDetectsMismatch,
  assertComparatorRespectsTolerance,
} = require("./helpers/assert-test-framework.js");
const { registerTest } = require("./helpers/test-harness.js");

registerTest("answer comparator fails when a marker value is intentionally changed", () => {
  assertComparatorDetectsMismatch(loadAnswer("lc-csv"));
});

registerTest("answer comparator accepts differences within tolerance", () => {
  assertComparatorRespectsTolerance(loadAnswer("lc-csv"));
});
