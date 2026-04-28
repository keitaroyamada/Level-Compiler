const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { FIXTURE_PATHS, ROOT_DIR, launchApp, closeApp } = require("./helpers/app");

test("ImageSet selector exposes GUI slots and updates the active source", async () => {
  const app = await launchApp();

  try {
    const options = await app.firstWindow.locator("#ImageSetSelect option").evaluateAll((nodes) =>
      nodes.map((node) => ({
        value: node.value,
        text: node.textContent,
      }))
    );

    expect(options).toEqual([
      { value: "source_1", text: "ImageSet 1" },
      { value: "source_2", text: "ImageSet 2" },
      { value: "source_3", text: "ImageSet 3" },
    ]);

    await app.firstWindow.locator("#ImageSetSelect").selectOption("source_3");

    const state = await app.firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(state.activeImageSourceId).toBe("source_3");
    expect(state.imageSetSelectValue).toBe("source_3");

    expect(state.loadedImageSetIds).toEqual([]);
    expect(state.imageSetOptionStyles).toEqual([
      { value: "source_1", color: "rgb(136, 136, 136)", fontWeight: "" },
      { value: "source_2", color: "rgb(136, 136, 136)", fontWeight: "" },
      { value: "source_3", color: "rgb(136, 136, 136)", fontWeight: "" },
    ]);

    await app.firstWindow.locator("#ImageSetSelect").selectOption("source_1");
    await app.firstWindow.evaluate(
      async ({ fixturePaths }) => {
        await window.__LC_E2E__.loadLcModelFromPath(fixturePaths.lcmodel);
        await window.__LC_E2E__.loadCoreImagesFromPath(fixturePaths.coreImagesDir);
      },
      { fixturePaths: FIXTURE_PATHS }
    );

    const loadedState = await app.firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(loadedState.loadedImageSetIds).toContain("source_1");
    expect(loadedState.imageSetOptionStyles).toEqual([
      { value: "source_1", color: "rgb(0, 0, 0)", fontWeight: "700" },
      { value: "source_2", color: "rgb(136, 136, 136)", fontWeight: "" },
      { value: "source_3", color: "rgb(136, 136, 136)", fontWeight: "" },
    ]);

    await app.firstWindow.locator("#ImageSetSelect").selectOption("source_2");
    await app.firstWindow.waitForFunction(() => {
      const state = window.__LC_E2E__.getRendererState();
      return state.activeImageSourceId === "source_2" && state.footerLeftText === "";
    });

    const emptySourceState = await app.firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(emptySourceState.loadedImageSetIds).not.toContain("source_2");

    const emptyImageDir = path.join(ROOT_DIR, "tests", "temp", "empty-imageset");
    fs.mkdirSync(emptyImageDir, { recursive: true });
    await app.firstWindow.evaluate(
      async ({ emptyImageDir }) => {
        await window.__LC_E2E__.loadCoreImagesFromPath(emptyImageDir);
      },
      { emptyImageDir }
    );

    const emptyLoadState = await app.firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(emptyLoadState.loadedImageSetIds).not.toContain("source_2");
    expect(emptyLoadState.footerLeftText).toBe("");

    await app.firstWindow.locator("#ImageSetSelect").selectOption("source_1");

    await app.firstWindow.evaluate(async () => {
      await window.__LC_E2E__.pushDialogResponse(0);
      await window.__LC_E2E__.unloadActiveImageSet();
    });

    const unloadedState = await app.firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(unloadedState.loadedImageSetIds).not.toContain("source_1");
    expect(unloadedState.imageSetOptionStyles).toEqual([
      { value: "source_1", color: "rgb(136, 136, 136)", fontWeight: "" },
      { value: "source_2", color: "rgb(136, 136, 136)", fontWeight: "" },
      { value: "source_3", color: "rgb(136, 136, 136)", fontWeight: "" },
    ]);
  } finally {
    await closeApp(app);
  }
});
