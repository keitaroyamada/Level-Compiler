const fs = require("fs");
const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const electronAppErrorLogPaths = new WeakMap();
const FIXTURE_PATHS = {
  lcmodel: path.join(ROOT_DIR, "test_data_private", "SG06-SG14-.lcmodel"),
  ageCsv: path.join(
    ROOT_DIR,
    "test_data_private",
    "[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv"
  ),
  coreImagesDir: path.join(ROOT_DIR, "test_data_private", "SG06"),
};

function createRuntimeIssueMonitor() {
  return {
    attachedPages: new WeakSet(),
    issues: [],
  };
}

function formatRuntimeIssue(issue) {
  const title = issue.title ? `[${issue.title}] ` : "";
  return `${issue.kind}: ${title}${issue.message}`;
}

function attachRuntimeIssueMonitor(page, runtimeIssueMonitor) {
  if (!page || runtimeIssueMonitor.attachedPages.has(page)) {
    return;
  }

  runtimeIssueMonitor.attachedPages.add(page);

  page.on("pageerror", async (error) => {
    let title = "";
    try {
      title = await page.title();
    } catch (_error) {
      title = "";
    }

    runtimeIssueMonitor.issues.push({
      kind: "pageerror",
      title,
      message: error && error.stack ? error.stack : String(error),
    });
  });

  page.on("console", async (message) => {
    if (message.type() !== "error") {
      return;
    }

    let title = "";
    try {
      title = await page.title();
    } catch (_error) {
      title = "";
    }

    runtimeIssueMonitor.issues.push({
      kind: "console",
      title,
      message: message.text(),
    });
  });
}

async function assertNoRuntimeIssues(runtimeIssueMonitor) {
  if (!runtimeIssueMonitor || runtimeIssueMonitor.issues.length === 0) {
    return;
  }

  const details = runtimeIssueMonitor.issues.map(formatRuntimeIssue).join("\n\n");
  throw new Error(`Unexpected runtime issues were emitted during the E2E test.\n\n${details}`);
}

async function launchApp() {
  const runtimeIssueMonitor = createRuntimeIssueMonitor();
  const tempDir = path.join(ROOT_DIR, "tests", "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const errorLogPath = path.join(
    tempDir,
    `main-process-errors-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonl`
  );
  const electronApp = await electron.launch({
    args: [path.join(ROOT_DIR, "main.js")],
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      LC_E2E: "1",
      LC_E2E_MAIN_PROCESS_ERROR_LOG: errorLogPath,
    },
  });

  electronApp.on("window", (page) => {
    attachRuntimeIssueMonitor(page, runtimeIssueMonitor);
  });
  electronAppErrorLogPaths.set(electronApp, errorLogPath);

  const firstWindow = await electronApp.firstWindow();
  attachRuntimeIssueMonitor(firstWindow, runtimeIssueMonitor);
  await firstWindow.waitForLoadState("domcontentloaded");
  await firstWindow.waitForFunction(() => Boolean(window.__LC_E2E__ && window.__LC_E2E__.isReady()));
  await electronApp.evaluate(() => {
    global.__LC_E2E_MAIN_PROCESS_ERRORS__ = [];

    if (global.__LC_E2E_MAIN_PROCESS_ERROR_MONITOR_INSTALLED__) {
      return;
    }

    const recordError = (type, error) => {
      const message =
        error && typeof error.stack === "string"
          ? error.stack
          : error && typeof error.message === "string"
            ? error.message
            : String(error);

      global.__LC_E2E_MAIN_PROCESS_ERRORS__.push({
        type,
        message,
      });
    };

    process.on("uncaughtException", (error) => {
      recordError("uncaughtException", error);
    });

    process.on("unhandledRejection", (error) => {
      recordError("unhandledRejection", error);
    });

    global.__LC_E2E_MAIN_PROCESS_ERROR_MONITOR_INSTALLED__ = true;
  });

  return { electronApp, firstWindow, runtimeIssueMonitor };
}

function readMainProcessErrorsFromLog(errorLogPath) {
  if (!errorLogPath || !fs.existsSync(errorLogPath)) {
    return [];
  }

  return fs
    .readFileSync(errorLogPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function assertNoMainProcessErrors(electronApp, errorLogPath) {
  if (electronApp) {
    await electronApp.evaluate(async () => {
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
    });
  }

  const liveErrors = electronApp
    ? await electronApp.evaluate(() => global.__LC_E2E_MAIN_PROCESS_ERRORS__ || [])
    : [];
  const loggedErrors = readMainProcessErrorsFromLog(errorLogPath);
  const errors = [...liveErrors, ...loggedErrors];
  expect(
    errors,
    `Unexpected main-process errors:\n${errors.map((error) => `[${error.type}] ${error.message}`).join("\n\n")}`
  ).toEqual([]);
}

async function findWindowByTitle(electronApp, expectedTitle, timeoutMs = 30000, runtimeIssueMonitor = null) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const page of electronApp.windows()) {
      if (runtimeIssueMonitor) {
        attachRuntimeIssueMonitor(page, runtimeIssueMonitor);
      }
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

async function getMenuItemVisibility(electronApp, targetLabel) {
  return electronApp.evaluate(({ Menu }, label) => {
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
    return item ? item.visible !== false : null;
  }, targetLabel);
}

async function closeWindowByTitle(electronApp, expectedTitle) {
  const page = await findWindowByTitle(electronApp, expectedTitle);
  await page.close();
}

async function closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor = null, errorLogPath = null) {
  const resolvedErrorLogPath = errorLogPath || electronAppErrorLogPaths.get(electronApp) || null;
  let capturedMainProcessError = null;

  try {
    if (firstWindow && !firstWindow.isClosed()) {
      await firstWindow.evaluate(() => window.LCapi.e2eSetCloseDialogResponse(1));
    }
  } catch (_error) {
    // The main window may already be closed in tests that explicitly end the app.
  }

  try {
    await assertNoMainProcessErrors(electronApp, resolvedErrorLogPath);
  } catch (error) {
    capturedMainProcessError = error;
  }

  await electronApp.close();
  if (!capturedMainProcessError) {
    try {
      await assertNoMainProcessErrors(null, resolvedErrorLogPath);
    } catch (error) {
      capturedMainProcessError = error;
    }
  }
  await assertNoRuntimeIssues(runtimeIssueMonitor);

  if (resolvedErrorLogPath && fs.existsSync(resolvedErrorLogPath)) {
    fs.rmSync(resolvedErrorLogPath, { force: true });
  }
  electronAppErrorLogPaths.delete(electronApp);

  if (capturedMainProcessError) {
    throw capturedMainProcessError;
  }
}

function toOneDecimal(value) {
  return Math.round(Number(value) * 10) / 10;
}

test("app starts and renderer test hook is available", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await expect(firstWindow).toHaveTitle("Level Compiler");

    const state = await firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(state.isLoadedLCModel).toBe(false);
    expect(state.projectCount).toBe(0);
    expect(state.holeCount).toBe(0);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("file and folder chooser payloads return mocked paths", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    const expectedFile = path.join(ROOT_DIR, "test_data_private", "chooser-mock.lcmodel");
    const expectedFolder = path.join(ROOT_DIR, "test_data_private", "SG06");

    await firstWindow.evaluate(
      async ({ file, folder }) => window.__LC_E2E__.setOpenDialogResponse({ file, folder }),
      { file: expectedFile, folder: expectedFolder }
    );

    const result = await firstWindow.evaluate(async () => {
      const file = await window.__LC_E2E__.chooseFile("Choose LC model", [
        { name: "LCmodel file", extensions: ["lcmodel"] },
      ]);
      const folder = await window.__LC_E2E__.chooseFolder("Choose image directory");
      const state = await window.__LC_E2E__.getOpenDialogResponse();
      return { file, folder, state };
    });

    expect(result.file).toBe(expectedFile);
    expect(result.folder).toBe(expectedFolder);
    expect(result.state.file).toBe(expectedFile);
    expect(result.state.folder).toBe(expectedFolder);
  } finally {
    try {
      await firstWindow.evaluate(() => window.__LC_E2E__.setOpenDialogResponse({ file: null, folder: null }));
    } catch (_error) {
      // Ignore reset failures while shutting down.
    }
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("changeEditMode payload enables the Save menu visibility", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    expect(await getMenuItemVisibility(electronApp, "Save")).toBe(false);

    await firstWindow.evaluate(() => window.LCapi.changeEditMode({ mode: true }));
    await expect.poll(() => getMenuItemVisibility(electronApp, "Save")).toBe(true);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("app loads lcmodel fixture into renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("app loads lcmodel fixture by drop into an empty renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    const before = await firstWindow.evaluate(() => window.__LC_E2E__.getRendererState());
    expect(before.isLoadedLCModel).toBe(false);
    expect(before.projectCount).toBe(0);
    expect(before.holeCount).toBe(0);

    const result = await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.dropLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    expect(result.ok).toBe(true);
    expect(result.isLoadedLCModel).toBe(true);
    expect(result.projectCount).toBeGreaterThan(0);
    expect(result.holeCount).toBeGreaterThan(0);
    expect(result.holeListCount).toBeGreaterThanOrEqual(result.holeCount);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("app loads age csv fixture into renderer after lcmodel", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("app loads age csv fixture by drop after lcmodel", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.dropLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    const result = await firstWindow.evaluate(
      async ({ ageCsv }) => window.__LC_E2E__.dropAgeModelFromPath(ageCsv),
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("app loads core images into the renderer after lcmodel", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("app loads core images by drop after lcmodel and age model", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel, ageCsv }) => {
        await window.__LC_E2E__.dropLcModelFromPath(lcmodel);
        await window.__LC_E2E__.dropAgeModelFromPath(ageCsv);
      },
      {
        lcmodel: FIXTURE_PATHS.lcmodel,
        ageCsv: FIXTURE_PATHS.ageCsv,
      }
    );

    const result = await firstWindow.evaluate(
      async ({ coreImagesDir }) => window.__LC_E2E__.dropCoreImagesFromPath(coreImagesDir),
      { coreImagesDir: FIXTURE_PATHS.coreImagesDir }
    );

    expect(result.ok).toBe(true);
    expect(result.loadedImageCount).toBeGreaterThan(0);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("app loads core images by drop when images are stored in a nested subfolder", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  const nestedRoot = path.join(ROOT_DIR, "tests", "temp", `e2e-nested-images-${Date.now()}`);
  const nestedDir = path.join(nestedRoot, "nested");
  try {
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.cpSync(FIXTURE_PATHS.coreImagesDir, nestedDir, { recursive: true });

    await firstWindow.evaluate(
      async ({ lcmodel, ageCsv }) => {
        await window.__LC_E2E__.dropLcModelFromPath(lcmodel);
        await window.__LC_E2E__.dropAgeModelFromPath(ageCsv);
      },
      {
        lcmodel: FIXTURE_PATHS.lcmodel,
        ageCsv: FIXTURE_PATHS.ageCsv,
      }
    );

    const result = await firstWindow.evaluate(
      async ({ nestedRootPath }) => window.__LC_E2E__.dropCoreImagesFromPath(nestedRootPath),
      { nestedRootPath: nestedRoot }
    );

    expect(result.ok).toBe(true);
    expect(result.loadedImageCount).toBeGreaterThan(0);
  } finally {
    try {
      fs.rmSync(nestedRoot, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup failures.
    }
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("LoadCoreImage payload returns image buffers for the first section after registration", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel, coreImagesDir }) => {
        await window.__LC_E2E__.loadLcModelFromPath(lcmodel);
        await window.__LC_E2E__.loadCoreImagesFromPath(coreImagesDir);
      },
      FIXTURE_PATHS
    );

    const result = await firstWindow.evaluate(
      async () => window.__LC_E2E__.loadCoreImageBuffersForFirstSection()
    );

    expect(result.ok).toBe(true);
    expect(Number(result.datasetCount)).toBeGreaterThan(0);
    expect(Number(result.totalBufferCount)).toBeGreaterThan(0);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("image viewer opens after core images load and notifies on close", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("finder coordinate search computes CD, EFD, and age consistently after loading age model", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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

      const calcedData = await window.FinderApi.depthConverter({
        dataList: [["", ["", holeName, sectionName, midpoint], [null, null, null, null]]],
        options,
      });

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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("finder getSectionLimit payload returns the current section bounds", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
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

    const result = await finderWindow.evaluate(() => window.__LC_FINDER_E2E__.getCurrentSectionLimit());
    expect(result.holeName).toBeTruthy();
    expect(result.sectionName).toBeTruthy();
    expect(Array.isArray(result.sectionLimit)).toBe(true);
    expect(result.sectionLimit).toHaveLength(2);
    expect(Number.isFinite(Number(result.sectionLimit[0]))).toBe(true);
    expect(Number.isFinite(Number(result.sectionLimit[1]))).toBe(true);
    expect(Number(result.sectionLimit[0])).toBeLessThanOrEqual(Number(result.sectionLimit[1]));
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("finder close notifies the main renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("converter window opens from the menu and notifies on close", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("converter cvtLoadCsv payload loads preview rows from a csv path", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    await clickMenuItemByLabel(electronApp, "Converter");
    const converterWindow = await findWindowByTitle(electronApp, "LC Converter");
    await converterWindow.waitForLoadState("domcontentloaded");
    await converterWindow.waitForFunction(
      () => Boolean(window.__LC_CONVERTER_E2E__ && window.__LC_CONVERTER_E2E__.isReady())
    );

    const result = await converterWindow.evaluate(
      async ({ ageCsv }) => window.__LC_CONVERTER_E2E__.loadCsvFromPath(ageCsv),
      { ageCsv: FIXTURE_PATHS.ageCsv }
    );

    expect(result.path).toBe(FIXTURE_PATHS.ageCsv);
    expect(Number(result.counts)).toBeGreaterThan(0);
    expect(Number(result.previewRows)).toBeGreaterThan(0);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("converter cvtConverter payload runs through import flow without dialogs", async () => {
  test.setTimeout(30000);
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel, ageCsv }) => {
        await window.__LC_E2E__.loadLcModelFromPath(lcmodel);
        await window.__LC_E2E__.loadAgeModelFromPath(ageCsv);
      },
      FIXTURE_PATHS
    );

    await clickMenuItemByLabel(electronApp, "Converter");
    const converterWindow = await findWindowByTitle(electronApp, "LC Converter");
    await converterWindow.waitForLoadState("domcontentloaded");
    await converterWindow.waitForFunction(
      () => Boolean(window.__LC_CONVERTER_E2E__ && window.__LC_CONVERTER_E2E__.isReady())
    );

    await converterWindow.evaluate(
      async ({ ageCsv }) => window.__LC_CONVERTER_E2E__.loadCsvFromPath(ageCsv),
      { ageCsv: FIXTURE_PATHS.ageCsv }
    );
    await firstWindow.evaluate(() => window.__LC_E2E__.pushDialogResponse(1));

    const result = await converterWindow.evaluate(() => window.__LC_CONVERTER_E2E__.runConverterPayload());
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("There is no actions.");
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("menu click forwards a main-window event to the renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());

    await clickMenuItemByLabel(electronApp, "Zoomin");

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "ZoominMenuClicked")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "ZoominMenuClicked")).toBe(true);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("divider window opens and receives initial data from the main process", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("dividerConverter uses async IPC and returns calculated rows", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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

    const result = await dividerWindow.evaluate(() => window.__LC_DIVIDER_E2E__.runDividerConverter());
    expect(result.ok).toBe(true);
    expect(Number(result.resultCount)).toBeGreaterThan(0);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("divider close notifies the main renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("settings window opens from the menu and notifies on close", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("settings change round-trips back to the main renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await clickMenuItemByLabel(electronApp, "Preferences");

    const settingsWindow = await findWindowByTitle(electronApp, "LC Settings");
    await settingsWindow.waitForLoadState("domcontentloaded");
    await settingsWindow.waitForFunction(
      () =>
        Boolean(window.__LC_SETTINGS_E2E__ && window.__LC_SETTINGS_E2E__.isReady()) &&
        window.__LC_SETTINGS_E2E__.getState().itemCount > 0
    );

    const beforeColour = await firstWindow.evaluate(
      () => window.__LC_E2E__.getRendererState().canvasBackgroundColour
    );
    const nextColour = beforeColour === "#123456" ? "#654321" : "#123456";

    await settingsWindow.evaluate((colour) => {
      window.__LC_SETTINGS_E2E__.applySettingsPatch({
        canvas: {
          background_colour: colour,
        },
      });
    }, nextColour);

    await firstWindow.waitForFunction(
      (expectedColour) => window.__LC_E2E__.getRendererState().canvasBackgroundColour === expectedColour,
      nextColour
    );

    const afterColour = await firstWindow.evaluate(
      () => window.__LC_E2E__.getRendererState().canvasBackgroundColour
    );
    expect(afterColour).toBe(nextColour);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("about window opens from the menu and shows the current app version", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("depthConverter supports composite depth and event free depth payloads", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel, ageCsv }) => {
        await window.__LC_E2E__.loadLcModelFromPath(lcmodel);
        await window.__LC_E2E__.loadAgeModelFromPath(ageCsv);
      },
      FIXTURE_PATHS
    );

    const result = await firstWindow.evaluate(async () => {
      const reference = window.__LC_E2E__.getFirstSectionReference();
      const trinity = await window.__LC_E2E__.depthConvert({
        dataList: [["", ["", reference.holeName, reference.sectionName, reference.midpoint], reference.sectionId]],
        options: {
          sourceType: "trinity",
          polationType: "linear",
          allowOutside: true,
        },
      });

      const fromCd = await window.__LC_E2E__.depthConvert({
        dataList: [["", trinity.cd, reference.sectionId]],
        options: {
          sourceType: "composite_depth",
          polationType: "linear",
          allowOutside: true,
        },
      });

      const fromEfd = await window.__LC_E2E__.depthConvert({
        dataList: [["", trinity.efd, reference.sectionId]],
        options: {
          sourceType: "event_free_depth",
          polationType: "linear",
          allowOutside: true,
        },
      });

      return { trinity, fromCd, fromEfd };
    });

    expect(Number(result.fromCd.cd)).toBeCloseTo(Number(result.trinity.cd), 1);
    expect(Number(result.fromCd.efd)).toBeCloseTo(Number(result.trinity.efd), 1);
    expect(Number(result.fromEfd.cd)).toBeCloseTo(Number(result.trinity.cd), 1);
    expect(Number(result.fromEfd.efd)).toBeCloseTo(Number(result.trinity.efd), 1);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("event add and delete payloads update the main renderer state", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    const added = await firstWindow.evaluate(() => window.__LC_E2E__.addEventToFirstAvailablePair());
    expect(added.ok).toBe(true);
    expect(added.afterCount).toBeGreaterThan(added.beforeCount);

    const removed = await firstWindow.evaluate(
      ({ upperId, lowerId }) => window.__LC_E2E__.deleteEventBetween(upperId, lowerId),
      { upperId: added.upperId, lowerId: added.lowerId }
    );
    expect(removed.ok).toBe(true);
    expect(removed.afterCount).toBeLessThan(removed.beforeCount);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("deleteSection payload updates the main renderer state", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    const deleted = await firstWindow.evaluate(() => window.__LC_E2E__.deleteFirstSection());
    expect(deleted.ok).toBe(true);
    expect(deleted.afterSectionCount).toBeLessThan(deleted.beforeSectionCount);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("sendSaveState and getChangedSectionIds payloads report a changed section", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    const result = await firstWindow.evaluate(() =>
      window.__LC_E2E__.saveStateAndGetChangedSectionsAfterEvent()
    );

    expect(result.ok).toBe(true);
    expect(Array.isArray(result.changed.ids)).toBe(true);
    expect(result.changed.ids.length).toBeGreaterThan(0);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("main window close shows unsaved dialog and can discard changes", async () => {
  test.setTimeout(120000);
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  let closed = false;
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    const added = await firstWindow.evaluate(() => window.__LC_E2E__.addEventToFirstAvailablePair());
    expect(added.ok).toBe(true);

    const saved = await firstWindow.evaluate(() =>
      window.LCapi.sendSaveState({ type: "main", name: "e2e-unsaved-close" })
    );
    expect(saved).toBe(true);

    await firstWindow.evaluate(() => window.__LC_E2E__.getAndClearDialogLog());

    const cancelConfigured = await firstWindow.evaluate(() => window.__LC_E2E__.keepWindowOpenOnUnsavedClose());
    expect(cancelConfigured).toBe(true);

    await electronApp.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.close();
      }
    });

    await firstWindow.waitForTimeout(300);

    const dialogLog = await firstWindow.evaluate(() => window.__LC_E2E__.getAndClearDialogLog());
    expect(dialogLog.some((entry) => entry.title === "Unsaved Changes")).toBe(true);
    await expect(firstWindow).toHaveTitle("Level Compiler");

    const discardConfigured = await firstWindow.evaluate(() => window.__LC_E2E__.allowCloseWithoutSaving());
    expect(discardConfigured).toBe(true);

    const closePromise = electronApp.waitForEvent("close");
    await electronApp.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.close();
      }
    });
    await closePromise;
    closed = true;
  } finally {
    if (!closed) {
      await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
    }
  }
});

test("labeler window opens from the menu and notifies on close", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("labeler sendSaveState payload saves successfully", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(() => window.__LC_E2E__.clearEvents());

    await clickMenuItemByLabel(electronApp, "Labeler");

    const labelerWindow = await findWindowByTitle(electronApp, "LC Labeler");
    await labelerWindow.waitForLoadState("domcontentloaded");
    await labelerWindow.waitForFunction(
      () => Boolean(window.__LC_LABELER_E2E__ && window.__LC_LABELER_E2E__.isReady())
    );

    const saved = await labelerWindow.evaluate(() =>
      window.__LC_LABELER_E2E__.saveState("e2e-labeler-payload")
    );
    expect(saved).toBe(true);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("labeler file lookup payloads report image presence and missing section model", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await clickMenuItemByLabel(electronApp, "Labeler");

    const labelerWindow = await findWindowByTitle(electronApp, "LC Labeler");
    await labelerWindow.waitForLoadState("domcontentloaded");
    await labelerWindow.waitForFunction(
      () => Boolean(window.__LC_LABELER_E2E__ && window.__LC_LABELER_E2E__.isReady())
    );

    const result = await labelerWindow.evaluate(
      async ({ dirHandle }) =>
        window.__LC_LABELER_E2E__.checkFixtureFiles(dirHandle, "A-01.lcsection", "A-01.jpg"),
      { dirHandle: FIXTURE_PATHS.coreImagesDir }
    );

    expect(result.imageExists).toBe(true);
    expect(result.modelExists).toBe(false);
    expect(result.loadedModel).toBe(false);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("labeler marker payloads update labeler state", async () => {
  test.setTimeout(120000);
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await clickMenuItemByLabel(electronApp, "Labeler");

    const labelerWindow = await findWindowByTitle(electronApp, "LC Labeler");
    await labelerWindow.waitForLoadState("domcontentloaded");
    await labelerWindow.waitForFunction(
      () => Boolean(window.__LC_LABELER_E2E__ && window.__LC_LABELER_E2E__.isReady())
    );

    const result = await labelerWindow.evaluate(() =>
      window.__LC_LABELER_E2E__.exerciseMarkerPayloadFlow()
    );

    expect(result.ok).toBe(true);
    expect(result.afterCount).toBe(result.beforeCount);
    expect(result.markerRemoved).toBe(true);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("plotter window opens from the menu and notifies on explicit close", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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

    await Promise.all([
      plotterWindow.waitForEvent("close"),
      plotterWindow.evaluate(() => window.PlotterApi.PlotterClose()).catch((error) => {
        if (String(error).includes("Target page, context or browser has been closed")) {
          return null;
        }
        throw error;
      }),
    ]);

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "PlotterClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "PlotterClosed")).toBe(true);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("plotter close button IPC notifies the main renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
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

    await plotterWindow.evaluate(() => window.PlotterApi.windowCloseButton());

    await firstWindow.waitForFunction(() =>
      window.__LC_E2E__.getEvents().some((entry) => entry.name === "PlotterClosed")
    );

    const events = await firstWindow.evaluate(() => window.__LC_E2E__.getEvents());
    expect(events.some((entry) => entry.name === "PlotterClosed")).toBe(true);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});

test("plotter sendPlotOptions payload reaches the main renderer", async () => {
  const { electronApp, firstWindow, runtimeIssueMonitor } = await launchApp();
  try {
    await firstWindow.evaluate(
      async ({ lcmodel }) => window.__LC_E2E__.loadLcModelFromPath(lcmodel),
      { lcmodel: FIXTURE_PATHS.lcmodel }
    );

    await clickMenuItemByLabel(electronApp, "Plotter");

    const plotterWindow = await findWindowByTitle(electronApp, "LC Plotter");
    await plotterWindow.waitForLoadState("domcontentloaded");
    await plotterWindow.waitForFunction(
      () => Boolean(window.__LC_PLOTTER_E2E__ && window.__LC_PLOTTER_E2E__.isReady())
    );

    const payload = {
      sendData: {
        data: [],
        emitType: "updateSetting",
      },
      to: "renderer",
    };

    await plotterWindow.evaluate(
      (nextPayload) => window.__LC_PLOTTER_E2E__.sendPlotPayload(nextPayload),
      payload
    );

    await firstWindow.waitForFunction(
      (expectedEmitType) =>
        window.__LC_E2E__.getRendererState().lastPlotPayload?.emitType === expectedEmitType,
      payload.sendData.emitType
    );

    const lastPlotPayload = await firstWindow.evaluate(
      () => window.__LC_E2E__.getRendererState().lastPlotPayload
    );
    expect(lastPlotPayload.emitType).toBe(payload.sendData.emitType);
    expect(Array.isArray(lastPlotPayload.data)).toBe(true);
  } finally {
    await closeElectronApp(electronApp, firstWindow, runtimeIssueMonitor);
  }
});
