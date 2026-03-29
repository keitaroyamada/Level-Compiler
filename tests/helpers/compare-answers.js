const assert = require("node:assert/strict");

function isNumericKey(key) {
  return /(_cm|_depth|_rank|^age$|unreliability|is_zero_point)/.test(key);
}

function sortAnswer(answer) {
  const cloned = {
    ...answer,
    markers: [...(answer.markers || [])],
    trinity_sweep: [...(answer.trinity_sweep || [])],
  };

  cloned.markers.sort((a, b) => {
    return (
      a.project_order - b.project_order ||
      a.hole_order - b.hole_order ||
      a.section_order - b.section_order ||
      a.marker_order - b.marker_order
    );
  });

  cloned.trinity_sweep.sort((a, b) => {
    return (
      a.project_order - b.project_order ||
      a.hole_order - b.hole_order ||
      a.section_order - b.section_order ||
      a.distance_cm - b.distance_cm
    );
  });

  return cloned;
}

function compareValue(actual, expected, tolerance, pathLabel) {
  if (expected === null || actual === null) {
    assert.equal(actual, expected, `${pathLabel}: null mismatch`);
    return;
  }

  if (typeof expected === "number" && typeof actual === "number") {
    const diff = Math.abs(actual - expected);
    assert.ok(
      diff <= tolerance,
      `${pathLabel}: expected ${expected}, got ${actual}, diff ${diff} > tolerance ${tolerance}`
    );
    return;
  }

  assert.deepEqual(actual, expected, `${pathLabel}: value mismatch`);
}

function compareRecordArrays(actualRows, expectedRows, label, tolerance) {
  assert.equal(actualRows.length, expectedRows.length, `${label}: row count mismatch`);

  for (let i = 0; i < expectedRows.length; i++) {
    const actual = actualRows[i];
    const expected = expectedRows[i];
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);

    for (const key of keys) {
      const pathLabel = `${label}[${i}].${key}`;
      if (typeof expected[key] === "number" && typeof actual[key] === "number") {
        compareValue(actual[key], expected[key], tolerance, pathLabel);
      } else if (isNumericKey(key) && (expected[key] == null || actual[key] == null)) {
        compareValue(actual[key], expected[key], tolerance, pathLabel);
      } else {
        assert.deepEqual(actual[key], expected[key], `${pathLabel}: value mismatch`);
      }
    }
  }
}

function compareAnswerData(actualAnswer, expectedAnswer, options = {}) {
  const tolerance = options.tolerance ?? 0.001;
  const actual = sortAnswer(actualAnswer);
  const expected = sortAnswer(expectedAnswer);

  assert.equal(actual.version, expected.version, "version mismatch");
  assert.equal(actual.project_count, expected.project_count, "project_count mismatch");
  assert.equal(actual.marker_count, expected.marker_count, "marker_count mismatch");
  assert.equal(actual.trinity_sweep_count, expected.trinity_sweep_count, "trinity_sweep_count mismatch");

  compareRecordArrays(actual.markers, expected.markers, "markers", tolerance);
  compareRecordArrays(actual.trinity_sweep, expected.trinity_sweep, "trinity_sweep", tolerance);
}

module.exports = {
  compareAnswerData,
};
