const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const FIXTURE_PATHS = {
  lcmodel: path.join(ROOT_DIR, "test_data_private", "SG06-SG14-.lcmodel"),
  ageCsv: path.join(
    ROOT_DIR,
    "test_data_private",
    "[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv"
  ),
  coreImagesDir: path.join(ROOT_DIR, "test_data_private", "SG06"),
};

async function launchApp() {
  const electronApp = await electron.launch({
    args: [path.join(ROOT_DIR, "main.js")],
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      LC_E2E: "1",
    },
  });

  const firstWindow = await electronApp.firstWindow();
  await firstWindow.waitForLoadState("domcontentloaded");
  await firstWindow.waitForFunction(() => Boolean(window.__LC_E2E__ && window.__LC_E2E__.isReady()));

  return { electronApp, firstWindow };
}

async function findWindowByTitle(electronApp, expectedTitle, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const page of electronApp.windows()) {
      if ((await page.title()) === expectedTitle) {
        return page;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Window with title "${expectedTitle}" was not found.`);
}

async function clickMenuItemByLabel(electronApp, targetLabel) {
  const clicked = await electronApp.evaluate(({ Menu }, label) => {
    function findMenuItem(items) {
      for (const item of items) {
        if (item.label === label) {
          return item;
        }
        if (item.submenu) {
          const nested = findMenuItem(item.submenu.items);
          if (nested) {
            return nested;
          }
        }
      }
      return null;
    }

    const menu = Menu.getApplicationMenu();
    const item = menu ? findMenuItem(menu.items) : null;
    if (!item || typeof item.click !== "function") {
      return false;
    }

    item.click();
    return true;
  }, targetLabel);

  expect(clicked).toBe(true);
}

async function closeWindowByTitle(electronApp, expectedTitle) {
  const page = await findWindowByTitle(electronApp, expectedTitle);
  await page.close();
}

function toOneDecimal(value) {
  return Math.round(Number(value) * 10) / 10;
}

test("app starts and renderer test hook is available", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await expect(firstWindow).toHaveTitle("Level Compiler");

    const state = await firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(state.isLoadedLCModel).toBe(false);
    expect(state.projectCount).toBe(0);
    expect(state.holeCount).toBe(0);
  } finally {
    await electronApp.close();
  }
});

test("app loads lcmodel fixture into renderer", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    const result = await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    expect(result.ok).toBe(true);
    expect(result.isLoadedLCModel).toBe(true);
    expect(result.projectCount).toBeGreaterThan(0);
    expect(result.holeCount).toBeGreaterThan(0);
    expect(result.holeListCount).toBeGreaterThanOrEqual(result.holeCount);
  } finally {
    await electronApp.close();
  }
});

test("app loads age csv fixture into renderer after lcmodel", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    const result = await firstWindow.evaluate(
      async ({ ageCsv }) => window.__LC_E2E__.loadAgeModelFromPath(ageCsv),
      { ageCsv: FIXTURE_PATHS.ageCsv }
    );

    expect(result.ok).toBe(true);
    expect(result.loadedAge).toBeTruthy();
    expect(String(result.loadedAge.id)).toBeTruthy();

    const selectedAgeModelId = await firstWindow.evaluate(
      () => document.getElementById("AgeModelSelect").value
    );
    expect(selectedAgeModelId).toBe(String(result.loadedAge.id));
  } finally {
    await electronApp.close();
  }
});

test("app loads core images into the renderer after lcmodel", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    const result = await firstWindow.evaluate(
      async ({ coreImagesDir }) => window.__LC_E2E__.loadCoreImagesFromPath(coreImagesDir),
      { coreImagesDir: FIXTURE_PATHS.coreImagesDir }
    );

    expect(result.ok).toBe(true);
    expect(result.loadedImageCount).toBeGreaterThan(0);
  } finally {
    await electronApp.close();
  }
});

test("image viewer opens after core images load and notifies on close", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel, coreImagesDir }) => {
        await window.__LC_E2E__.loadLcModelFromPath(lcmodel);
        await window.__LC_E2E__.loadCoreImagesFromPath(coreImagesDir);
      },
      {
        lcmodel: FIXTURE_PATHS.lcmodel,
        coreImagesDir: FIXTURE_PATHS.coreImagesDir,
      }
    );

    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());

    const result = await firstWindow.evaluate(
      async () => window.__LC_E2E__.openFloatingImageViewerForFirstSection()
    );
    expect(result.ok).toBe(true);

    const viewerWindow = await findWindowByTitle(electronApp, "LC Viewer");
    await viewerWindow.waitForLoadState("domcontentloaded");
    await viewerWindow.waitForFunction(
      () =>
        Boolean(window.__LC_VIEWER_E2E__ && window.__LC_VIEWER_E2E__.isReady()) &&
        window.__LC_VIEWER_E2E__.getState().loadedImageCount > 0
    );

    await closeWindowByTitle(electronApp, "LC Viewer");

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "ImageViewerClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "ImageViewerClosed")).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("finder coordinate search computes CD, EFD, and age consistently after loading age model", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel, ageCsv }) => {
        await window.__LC_E2E__.loadLcModelFromPath(lcmodel);
        await window.__LC_E2E__.loadAgeModelFromPath(ageCsv);
      },
      FIXTURE_PATHS
    );

    await firstWindow.evaluate(() => window.LCapi.OpenFinder());
    const finderWindow = await findWindowByTitle(electronApp, "LC Finder");
    await finderWindow.waitForLoadState("domcontentloaded");
    await finderWindow.waitForFunction(
      () =>
        Boolean(window.__LC_FINDER_E2E__ && window.__LC_FINDER_E2E__.isReady()) &&
        document.getElementById("holeOptions").options.length > 0 &&
        document.getElementById("sectionOptions").options.length > 0
    );

    const expected = await finderWindow.evaluate(async () => {
      const holeSelect = document.getElementById("holeOptions");
      const sectionSelect = document.getElementById("sectionOptions");
      const [, holeList, sectionList] = await window.FinderApi.finderGetCoreList();
      const holeIndex = Number(holeSelect.value);
      const sectionIndex = Number(sectionSelect.value);
      const holeName = holeSelect.options[holeSelect.selectedIndex].textContent;
      const sectionName = sectionSelect.options[sectionSelect.selectedIndex].textContent;
      const currentSection = sectionList[holeIndex].find((section) => Number(section[0]) === sectionIndex);
      const midpoint = (Number(currentSection[3]) + Number(currentSection[4])) / 2;
      const options = {
        sourceType: "trinity",
        polationType: "linear",
        allowOutside: true,
      };

      const calcedData = await window.FinderApi.depthConverter(
        [["", ["", holeName, sectionName, midpoint], [null, null, null, null]]],
        options
      );

      return {
        midpoint,
        cd: calcedData.cd,
        efd: calcedData.efd,
        age: calcedData.age_mid,
      };
    });

    await finderWindow.locator("#distanceInput").fill(String(expected.midpoint));
    await finderWindow.locator("#distanceInput").press("Tab");

    await finderWindow.waitForFunction(
      () => {
        const currentCd = document.getElementById("cdInput").value;
        const currentEfd = document.getElementById("efdInput").value;
        const currentAge = document.getElementById("ageInput").value;
        return (
          currentCd !== "" &&
          currentEfd !== "" &&
          currentAge !== ""
        );
      }
    );

    const finderState = await finderWindow.evaluate(() => window.__LC_FINDER_E2E__.getState());
    expect(Number(finderState.holeCount)).toBeGreaterThan(0);
    expect(Number(finderState.sectionCount)).toBeGreaterThan(0);
    expect(Number(finderState.cd)).toBeCloseTo(toOneDecimal(expected.cd), 1);
    expect(Number(finderState.efd)).toBeCloseTo(toOneDecimal(expected.efd), 1);
    expect(Number(finderState.age)).toBeCloseTo(toOneDecimal(expected.age), 1);
  } finally {
    await electronApp.close();
  }
});

test("finder close notifies the main renderer", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());
    await firstWindow.evaluate(() => window.LCapi.OpenFinder());

    const finderWindow = await findWindowByTitle(electronApp, "LC Finder");
    await finderWindow.waitForLoadState("domcontentloaded");
    await finderWindow.waitForFunction(
      () => Boolean(window.__LC_FINDER_E2E__ && window.__LC_FINDER_E2E__.isReady())
    );

    await finderWindow.close();

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "FinderClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "FinderClosed")).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("converter window opens from the menu and notifies on close", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());
    await clickMenuItemByLabel(electronApp, "Converter");

    const converterWindow = await findWindowByTitle(electronApp, "LC Converter");
    await converterWindow.waitForLoadState("domcontentloaded");
    await converterWindow.waitForFunction(
      () => Boolean(window.__LC_CONVERTER_E2E__ && window.__LC_CONVERTER_E2E__.isReady())
    );

    const state = await converterWindow.evaluate(() => window.__LC_CONVERTER_E2E__.getState());
    expect(state.outputType).toBe("export");

    await closeWindowByTitle(electronApp, "LC Converter");

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "ConverterClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "ConverterClosed")).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("menu click forwards a main-window event to the renderer", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());

    await clickMenuItemByLabel(electronApp, "Zoomin");

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "ZoominMenuClicked")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "ZoominMenuClicked")).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("divider window opens and receives initial data from the main process", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    await firstWindow.evaluate(() => window.LCapi.OpenDivider());
    const dividerWindow = await findWindowByTitle(electronApp, "LC Divider");
    await dividerWindow.waitForLoadState("domcontentloaded");
    await dividerWindow.waitForFunction(
      () =>
        Boolean(window.__LC_DIVIDER_E2E__ && window.__LC_DIVIDER_E2E__.isReady()) &&
        document.getElementById("holeOptions").options.length > 0 &&
        document.getElementById("sectionOptions").options.length > 0
    );

    const state = await dividerWindow.evaluate(() => window.__LC_DIVIDER_E2E__.getState());
    expect(Number(state.holeCount)).toBeGreaterThan(0);
    expect(Number(state.sectionCount)).toBeGreaterThan(0);
    expect(state.calcDirection).toBe("actual2definition");
  } finally {
    await electronApp.close();
  }
});

test("divider close notifies the main renderer", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());
    await firstWindow.evaluate(() => window.LCapi.OpenDivider());

    const dividerWindow = await findWindowByTitle(electronApp, "LC Divider");
    await dividerWindow.waitForLoadState("domcontentloaded");
    await dividerWindow.waitForFunction(
      () => Boolean(window.__LC_DIVIDER_E2E__ && window.__LC_DIVIDER_E2E__.isReady())
    );

    await dividerWindow.close();

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "DividerClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "DividerClosed")).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("settings window opens from the menu and notifies on close", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());

    await clickMenuItemByLabel(electronApp, "Preferences");

    const settingsWindow = await findWindowByTitle(electronApp, "LC Settings");
    await settingsWindow.waitForLoadState("domcontentloaded");
    await settingsWindow.waitForFunction(
      () =>
        Boolean(window.__LC_SETTINGS_E2E__ && window.__LC_SETTINGS_E2E__.isReady()) &&
        window.__LC_SETTINGS_E2E__.getState().itemCount > 0
    );

    await closeWindowByTitle(electronApp, "LC Settings");

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "SettingsClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "SettingsClosed")).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("about window opens from the menu and shows the current app version", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    const expectedVersion = await electronApp.evaluate(({ app }) => app.getVersion());
    await clickMenuItemByLabel(electronApp, "About");

    const aboutWindow = await findWindowByTitle(electronApp, "LC About");
    await aboutWindow.waitForLoadState("domcontentloaded");
    await aboutWindow.waitForFunction(
      (expectedVersion) => document.getElementById("app_version")?.textContent === `Version: ${expectedVersion}`,
      expectedVersion
    );

    const versionText = await aboutWindow.locator("#app_version").textContent();
    expect(versionText).toBe(`Version: ${expectedVersion}`);

    await closeWindowByTitle(electronApp, "LC About");
  } finally {
    await electronApp.close();
  }
});

test("labeler window opens from the menu and notifies on close", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());

    await clickMenuItemByLabel(electronApp, "Labeler");

    const labelerWindow = await findWindowByTitle(electronApp, "LC Labeler");
    await labelerWindow.waitForLoadState("domcontentloaded");
    await labelerWindow.waitForFunction(
      () => Boolean(window.__LC_LABELER_E2E__ && window.__LC_LABELER_E2E__.isReady())
    );

    await closeWindowByTitle(electronApp, "LC Labeler");

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "LabelerClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "LabelerClosed")).toBe(true);
  } finally {
    await electronApp.close();
  }
});

test("plotter window opens from the menu and notifies on explicit close", async () => {
  const { electronApp, firstWindow } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());
    await clickMenuItemByLabel(electronApp, "Plotter");

    const plotterWindow = await findWindowByTitle(electronApp, "LC Plotter");
    await plotterWindow.waitForLoadState("domcontentloaded");
    await plotterWindow.waitForFunction(
      () => Boolean(window.__LC_PLOTTER_E2E__ && window.__LC_PLOTTER_E2E__.isReady())
    );

    await plotterWindow.evaluate(() => window.PlotterApi.PlotterClose());

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "PlotterClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "PlotterClosed")).toBe(true);
  } finally {
    await electronApp.close();
  }
});
