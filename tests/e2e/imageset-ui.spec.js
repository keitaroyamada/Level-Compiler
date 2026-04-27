const { test, expect } = require("@playwright/test");
const { launchApp, closeApp } = require("./helpers/app");

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
  } finally {
    await closeApp(app);
  }
});
