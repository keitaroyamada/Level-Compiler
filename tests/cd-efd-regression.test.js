const assert = require("node:assert/strict");

const {
  buildCoreFromFixture,
  loadAnswer,
} = require("./helpers/load-fixtures.js");
const { registerTest } = require("./helpers/test-harness.js");

function markerKey(row) {
  return [
    row.project_name,
    row.hole_name,
    row.section_name,
    row.marker_name,
    row.distance_cm,
  ].join("|");
}

registerTest("all marker CD and EFD values match saved LC csv answer", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  const actual = core.exportTestAnswer(null, { roundDigits: 3, trinityStepCm: 1, includeTrinitySweep: false });
  const expected = loadAnswer("lc-csv");

  assert.equal(actual.markers.length, expected.markers.length);
  for (let i = 0; i < expected.markers.length; i++) {
    const a = actual.markers[i];
    const e = expected.markers[i];
    assert.equal(markerKey(a), markerKey(e));
    assert.ok(Math.abs((a.composite_depth_cm ?? 0) - (e.composite_depth_cm ?? 0)) <= 0.001);
    assert.ok(Math.abs((a.event_free_depth_cm ?? 0) - (e.event_free_depth_cm ?? 0)) <= 0.001);
    assert.deepEqual(a.depth_source, e.depth_source);
    assert.deepEqual(a.connection_rank, e.connection_rank);
    assert.deepEqual(a.unreliability, e.unreliability);
  }
});

registerTest("horizontal correlations preserve CD and EFD on LC csv model", async () => {
  const core = await buildCoreFromFixture("lc-csv");

  core.projects.forEach((project) => {
    project.holes.forEach((hole) => {
      hole.sections.forEach((section) => {
        section.markers.forEach((marker) => {
          if (!Array.isArray(marker.h_connection)) {
            return;
          }

          marker.h_connection.forEach((connectionId) => {
            const idx = core.search_idx_list[connectionId.toString()];
            if (!idx) {
              return;
            }
            const connected = core.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]];
            if (marker.composite_depth != null && connected.composite_depth != null) {
              assert.ok(Math.abs(marker.composite_depth - connected.composite_depth) <= 0.001);
            }
            if (marker.event_free_depth != null && connected.event_free_depth != null) {
              assert.ok(Math.abs(marker.event_free_depth - connected.event_free_depth) <= 0.001);
            }
          });
        });
      });
    });
  });
});

registerTest("LF converted model marker values match saved answer", async () => {
  const core = await buildCoreFromFixture("lf-csv");
  const actual = core.exportTestAnswer(null, { roundDigits: 3, trinityStepCm: 1, includeTrinitySweep: false });
  const expected = loadAnswer("lf-csv");

  assert.equal(actual.markers.length, expected.markers.length);
  for (let i = 0; i < expected.markers.length; i++) {
    const a = actual.markers[i];
    const e = expected.markers[i];
    assert.equal(markerKey(a), markerKey(e));
    assert.ok(Math.abs((a.composite_depth_cm ?? 0) - (e.composite_depth_cm ?? 0)) <= 0.001);
    assert.ok(Math.abs((a.event_free_depth_cm ?? 0) - (e.event_free_depth_cm ?? 0)) <= 0.001);
  }
});

registerTest("depth source coverage matches expected LC csv classification counts", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  const counts = {};

  core.projects.forEach((project) => {
    project.holes.forEach((hole) => {
      hole.sections.forEach((section) => {
        section.markers.forEach((marker) => {
          const key = marker.depth_source && marker.depth_source[0] ? marker.depth_source[0] : "";
          counts[key] = (counts[key] || 0) + 1;
        });
      });
    });
  });

  assert.deepEqual(counts, {
    extrapolation: 322,
    interpolation: 164,
    master: 826,
    "master-transfer": 601,
    transfer: 7,
  });
});

registerTest("depth source coverage matches expected LF csv classification counts", async () => {
  const core = await buildCoreFromFixture("lf-csv");
  const counts = {};

  core.projects.forEach((project) => {
    project.holes.forEach((hole) => {
      hole.sections.forEach((section) => {
        section.markers.forEach((marker) => {
          const key = marker.depth_source && marker.depth_source[0] ? marker.depth_source[0] : "";
          counts[key] = (counts[key] || 0) + 1;
        });
      });
    });
  });

  assert.deepEqual(counts, {
    extrapolation: 411,
    interpolation: 154,
    master: 708,
    "master-transfer": 495,
    transfer: 12,
  });
});
