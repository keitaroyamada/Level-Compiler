const assert = require("node:assert/strict");

const {
  buildCoreFromFixture,
  loadAnswer,
} = require("./helpers/load-fixtures.js");
const { registerTest } = require("./helpers/test-harness.js");

registerTest("getDepthFromTrinity sweep matches saved LC csv answer at 1 cm intervals", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  const actual = core.exportTestAnswer(null, { roundDigits: 3, trinityStepCm: 1, includeTrinitySweep: true });
  const expected = loadAnswer("lc-csv");

  assert.equal(actual.trinity_sweep.length, expected.trinity_sweep.length);
  for (let i = 0; i < expected.trinity_sweep.length; i++) {
    const a = actual.trinity_sweep[i];
    const e = expected.trinity_sweep[i];
    assert.equal(a.project_name, e.project_name);
    assert.equal(a.hole_name, e.hole_name);
    assert.equal(a.section_name, e.section_name);
    assert.ok(Math.abs(a.distance_cm - e.distance_cm) <= 0.001);
    assert.ok(Math.abs((a.composite_depth_cm ?? 0) - (e.composite_depth_cm ?? 0)) <= 0.001);
    assert.ok(Math.abs((a.event_free_depth_cm ?? 0) - (e.event_free_depth_cm ?? 0)) <= 0.001);
    assert.deepEqual(a.composite_depth_source, e.composite_depth_source);
    assert.deepEqual(a.event_free_depth_source, e.event_free_depth_source);
  }
});

registerTest("getEFDfromCD reproduces marker event free depth on master markers", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  let checkedCount = 0;

  core.projects.forEach((project) => {
    project.holes.forEach((hole) => {
      hole.sections.forEach((section) => {
        section.markers.forEach((marker) => {
          if (
            marker.depth_source &&
            marker.depth_source[0] === "master" &&
            Number.isFinite(marker.composite_depth) &&
            Number.isFinite(marker.event_free_depth)
          ) {
            const converted = core.getEFDfromCD(marker.composite_depth);
            assert.ok(Math.abs(converted - marker.event_free_depth) <= 0.001);
            checkedCount += 1;
          }
        });
      });
    });
  });

  assert.ok(checkedCount > 0);
});

registerTest("getDepthFromTrinity rejects out of section lookup when extrapolation is disabled", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  const project = core.projects[0];
  const hole = project.holes[0];
  const section = hole.sections[0];
  const distance = section.markers[section.markers.length - 1].distance + 1;
  const trinity = {
    name: "test-outside",
    hole_name: hole.name,
    section_name: section.name,
    distance,
  };

  const [result] = core.getDepthFromTrinity(project.id, [trinity], "composite_depth", false, false);
  assert.equal(result[0], null);
  assert.equal(result[1], null);
});

registerTest("getDepthFromTrinity extrapolates outside section when extrapolation is enabled", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  const project = core.projects[0];
  const hole = project.holes[0];
  const section = hole.sections[0];
  const distance = section.markers[section.markers.length - 1].distance + 1;
  const trinity = {
    name: "test-outside",
    hole_name: hole.name,
    section_name: section.name,
    distance,
  };

  const [result] = core.getDepthFromTrinity(project.id, [trinity], "composite_depth", true, false);
  assert.notEqual(result[0], null);
  assert.notEqual(result[1], null);
  assert.equal(result[3], "extrapolation");
});

registerTest("getCDfromEFD preserves EFD when converted back through getEFDfromCD", async () => {
  const core = await buildCoreFromFixture("lc-csv");
  let checkedCount = 0;

  core.projects.forEach((project) => {
    project.holes.forEach((hole) => {
      hole.sections.forEach((section) => {
        section.markers.forEach((marker) => {
          if (
            marker.depth_source &&
            marker.depth_source[0] === "master" &&
            Number.isFinite(marker.composite_depth) &&
            Number.isFinite(marker.event_free_depth)
          ) {
            const convertedCd = core.getCDfromEFD(marker.event_free_depth);
            const convertedEfd = core.getEFDfromCD(convertedCd);
            assert.ok(Number.isFinite(convertedCd));
            assert.ok(Math.abs(convertedEfd - marker.event_free_depth) <= 0.001);
            checkedCount += 1;
          }
        });
      });
    });
  });

  assert.ok(checkedCount > 0);
});
