const { test, expect } = require("@playwright/test");
const { launchApp, closeApp, loadMainFixtureState } = require("./helpers/app");

test("thumb and standard image tiers are both populated for the active source", async () => {
  const app = await launchApp();

  try {
    await loadMainFixtureState(app.firstWindow);

    await app.firstWindow.waitForFunction(() => {
      const state = window.__LC_E2E__.getRendererState();
      return state.thumbLoadedSectionCount > 0 && state.standardLoadedSectionCount > 0;
    });

    const state = await app.firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(state.thumbLoadedSectionCount).toBeGreaterThan(0);
    expect(state.standardLoadedSectionCount).toBeGreaterThan(0);
    expect(state.standardLoadedSectionCount).toBeLessThanOrEqual(state.thumbLoadedSectionCount);
    expect(["thumb", "standard"]).toContain(state.visibleImageTier);
  } finally {
    await closeApp(app);
  }
});
