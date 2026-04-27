const { test, expect } = require("@playwright/test");
const { launchApp, closeApp, loadMainFixtureState } = require("./helpers/app");

test("image source state is registered under source_1 after image import", async () => {
  const app = await launchApp();

  try {
    await loadMainFixtureState(app.firstWindow);

    await app.firstWindow.waitForFunction(() => {
      const state = window.__LC_E2E__.getRendererState();
      return state.imageSourceIds.includes("source_1") && state.standardLoadedSectionCount > 0;
    });

    const state = await app.firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(state.activeImageSourceId).toBe("source_1");
    expect(state.imageSourceIds).toContain("source_1");

    const switched = await app.firstWindow.evaluate(() => window.__LC_E2E__.setActiveImageSource("source_1"));
    expect(switched).toEqual({ ok: true, sourceId: "source_1" });
  } finally {
    await closeApp(app);
  }
});
