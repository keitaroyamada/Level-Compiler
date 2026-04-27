const { test, expect } = require("@playwright/test");
const {
  FIXTURE_PATHS,
  launchApp,
  closeElectronApp,
  findWindowByTitle,
  clickMenuItemByLabel,
} = require("./helpers/app");

test("plot draw collections are reapplied after reselecting the current age model", async () => {
  test.setTimeout(60000);
  const { electronApp, firstWindow, runtimeIssueMonitor, errorLogPath } = await launchApp();
  try {
    firstWindow.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await firstWindow.evaluate(
      async ({ lcmodel, ageCsv }) => {
        await window.__LC_E2E__.loadLcModelFromPath(lcmodel);
        await window.__LC_E2E__.loadAgeModelFromPath(ageCsv);
      },
      FIXTURE_PATHS
    );

    await clickMenuItemByLabel(electronApp, "Plotter");
    const plotterWindow = await findWindowByTitle(electronApp, "LC Plotter", 30000, runtimeIssueMonitor);
    await plotterWindow.waitForLoadState("domcontentloaded");
    plotterWindow.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await plotterWindow.waitForFunction(
      () => Boolean(window.__LC_PLOTTER_E2E__ && window.__LC_PLOTTER_E2E__.isReady())
    );

    await plotterWindow.evaluate(
      async ({ ageCsv }) => window.__LC_PLOTTER_E2E__.importCsvFromPath(ageCsv),
      { ageCsv: FIXTURE_PATHS.ageCsv }
    );

    const converterWindow = await findWindowByTitle(electronApp, "LC Converter", 30000, runtimeIssueMonitor);
    await converterWindow.waitForLoadState("domcontentloaded");
    converterWindow.on("dialog", async (dialog) => {
      await dialog.accept();
    });
    await converterWindow.waitForFunction(
      () => Boolean(window.__LC_CONVERTER_E2E__ && window.__LC_CONVERTER_E2E__.isReady())
    );

    const converterState = await converterWindow.evaluate(() => window.__LC_CONVERTER_E2E__.getState());
    expect(converterState.calledFrom).toBe("plotter");

    await firstWindow.evaluate(() => window.__LC_E2E__.pushDialogResponse(1));
    const converterRun = converterWindow
      .evaluate(() => window.__LC_CONVERTER_E2E__.runCurrentPayload())
      .catch((error) => {
        if (String(error).includes("Target page, context or browser has been closed")) {
          return null;
        }
        throw error;
      });
    await Promise.allSettled([
      converterWindow.waitForEvent("close").catch(() => null),
      converterRun,
    ]);

    await plotterWindow.waitForFunction(
      () => window.__LC_PLOTTER_E2E__.getState().collectionCount > 0
    );

    const added = await plotterWindow.evaluate(() => window.__LC_PLOTTER_E2E__.addFirstCollectionToPlotList());
    expect(added.ok).toBe(true);
    expect(added.plotListCount).toBeGreaterThan(0);

    await plotterWindow.evaluate(() => window.__LC_PLOTTER_E2E__.sendCurrentSelection("new"));

    await firstWindow.waitForFunction(() => {
      const state = window.__LC_E2E__.getRendererState();
      return (
        state.plotApplyCount > 0 &&
        state.plotDataCollectionCount > 0 &&
        state.plotDrawCollectionCount > 0 &&
        state.selectedPlotOptionCount > 0
      );
    });

    const before = await firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());

    const reselection = await firstWindow.evaluate(() => window.__LC_E2E__.reselectCurrentAgeModel());
    expect(reselection.ok).toBe(true);

    await firstWindow.waitForFunction((previousApplyCount) => {
      const state = window.__LC_E2E__.getRendererState();
      return (
        state.plotApplyCount > previousApplyCount &&
        state.plotDataCollectionCount > 0 &&
        state.plotDrawCollectionCount > 0 &&
        state.selectedPlotOptionCount > 0
      );
    }, before.plotApplyCount);

    const after = await firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(after.plotApplyCount).toBeGreaterThan(before.plotApplyCount);
    expect(after.plotDataCollectionCount).toBeGreaterThan(0);
    expect(after.plotDrawCollectionCount).toBeGreaterThan(0);
    expect(after.selectedPlotOptionCount).toBe(before.selectedPlotOptionCount);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor, errorLogPath);
  }
});
