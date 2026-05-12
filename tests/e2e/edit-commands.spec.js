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

test("project add modal remains editable after duplicate correlation error", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(async () => {
      window.__LC_E2E_ALERTS__ = [];
      window.alert = (message) => {
        window.__LC_E2E_ALERTS__.push(String(message));
      };
      await window.LCapi.InitialiseCorrelationModel();
      await window.LCapi.InitialiseAgeModel();
      await window.LCapi.addProject({ type: "correlation", name: "P1" });
      await window.__LC_E2E__.reloadModelFromMain(false);
      await window.LCapi.addHole({ projectId: [0, null, null, null], name: "A" });
      await window.__LC_E2E__.reloadModelFromMain(false);
    });

    await firstWindow.evaluate(() => {
      window.__LC_E2E_PROJECT_ADD_PROMISE__ = window.__LC_E2E__.openProjectAddDialog();
    });
    await firstWindow.locator("#lcModalDialog select[name='type']").selectOption("correlation");
    await firstWindow.locator("#lcModalDialog input[name='name']").click();
    await firstWindow.keyboard.type("P2");
    await firstWindow.locator("#lcModalDialog button[type='submit']").click();
    await expect(firstWindow.locator("#lcModalDialog .lc-dialog-message")).toContainText(
      "A base correlation model already exists"
    );
    await expect.poll(() => firstWindow.evaluate(() => window.__LC_E2E_ALERTS__)).toEqual([]);
    await firstWindow.locator("#lcModalDialog button[type='submit']").click();
    await firstWindow.evaluate(() => window.__LC_E2E_PROJECT_ADD_PROMISE__);

    await firstWindow.evaluate(() => {
      window.__LC_E2E_PROJECT_ADD_PROMISE__ = window.__LC_E2E__.openProjectAddDialog();
    });
    await expect(firstWindow.locator("#lcModalDialog select[name='type']")).toHaveValue("duo");
    const nameField = firstWindow.locator("#lcModalDialog input[name='name']");
    await nameField.click();
    await firstWindow.keyboard.type("P2");
    await expect(nameField).toHaveValue("P2");
    await firstWindow.locator("#lcModalDialog button[type='submit']").click();
    await firstWindow.evaluate(() => window.__LC_E2E_PROJECT_ADD_PROMISE__);

    const state = await firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(state.projectCount).toBe(2);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});
