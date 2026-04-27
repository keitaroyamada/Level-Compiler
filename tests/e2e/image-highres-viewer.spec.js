const { test, expect } = require("@playwright/test");
const {
  launchApp,
  closeApp,
  findWindowByTitle,
  loadMainFixtureState,
} = require("./helpers/app");

test("image viewer loads the first section as highres for the active image source", async () => {
  const app = await launchApp();

  try {
    await loadMainFixtureState(app.firstWindow);

    const openResult = await app.firstWindow.evaluate(
      async () => window.__LC_E2E__.openFloatingImageViewerForFirstSection()
    );
    expect(openResult.ok).toBe(true);

    const viewerWindow = await findWindowByTitle(app.electronApp, "LC Viewer", app.runtimeIssueMonitor);
    await viewerWindow.waitForFunction(() => {
      const api = window.__LC_VIEWER_E2E__;
      if (!api || !api.isReady()) {
        return false;
      }
      const state = api.getState();
      return state.viewerImageTier === "highres" && state.loadedHighresSectionCount > 0;
    });

    const viewerState = await viewerWindow.evaluate(() => window.__LC_VIEWER_E2E__.getState());
    expect(viewerState.activeImageSourceId).toBe("source_1");
    expect(viewerState.viewerImageTier).toBe("highres");
    expect(viewerState.loadedHighresSectionCount).toBeGreaterThan(0);
  } finally {
    await closeApp(app);
  }
});
