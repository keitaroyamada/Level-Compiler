const fs = require("fs");
const path = require("path");
const { expect, _electron: electron } = require("@playwright/test");

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
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

  return { electronApp, firstWindow, runtimeIssueMonitor, errorLogPath };
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
  if (typeof timeoutMs === "object" && timeoutMs !== null) {
    runtimeIssueMonitor = timeoutMs;
    timeoutMs = 30000;
  }

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

async function closeApp(appContext) {
  if (!appContext) {
    return;
  }
  await closeElectronApp(
    appContext.electronApp,
    appContext.firstWindow,
    appContext.runtimeIssueMonitor,
    appContext.errorLogPath
  );
}

async function loadMainFixtureState(firstWindow, options = {}) {
  const { includeAge = false } = options;
  await firstWindow.evaluate(
    async ({ fixturePaths, includeAge }) => {
      await window.__LC_E2E__.loadLcModelFromPath(fixturePaths.lcmodel);
      if (includeAge) {
        await window.__LC_E2E__.loadAgeModelFromPath(fixturePaths.ageCsv);
      }
      await window.__LC_E2E__.loadCoreImagesFromPath(fixturePaths.coreImagesDir);
    },
    { fixturePaths: FIXTURE_PATHS, includeAge }
  );
}

module.exports = {
  ROOT_DIR,
  FIXTURE_PATHS,
  launchApp,
  closeApp,
  closeElectronApp,
  findWindowByTitle,
  closeWindowByTitle,
  clickMenuItemByLabel,
  getMenuItemVisibility,
  loadMainFixtureState,
};
