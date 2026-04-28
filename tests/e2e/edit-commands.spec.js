const { test, expect } = require("@playwright/test");
const { launchApp, closeElectronApp } = require("./helpers/app");

test("edit commands can build and modify a two-project model from scratch", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    const result = await firstWindow.evaluate(() => window.__LC_E2E__.exerciseEditCommandsOnNewModel());

    expect(result.ok, JSON.stringify(result.operations, null, 2)).toBe(true);
    expect(result.projectCount).toBeGreaterThanOrEqual(1);
    expect(result.holeCount).toBeGreaterThanOrEqual(1);
    expect(result.finalState.hasClickHandler).toBe(false);
    expect(result.finalState.hasMoveHandler).toBe(false);

    const operationNames = result.operations.map((operation) => operation.name);
    expect(operationNames).toEqual(
      expect.arrayContaining([
        "addProject:P1",
        "addProject:P2",
        "addHole:A",
        "addSection:A-01",
        "addMarker:P1",
        "connectMarkers:project-to-project",
        "disconnectMarkers:project-to-project",
        "connectSections:P1",
        "disconnectSections:P1",
        "holeMoveToOtherProject",
        "deleteMarker",
        "deleteSection",
        "deleteHole",
        "deleteProject",
        "mergeProjects",
        "editModeOffCleansPendingCommand",
      ])
    );
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});
