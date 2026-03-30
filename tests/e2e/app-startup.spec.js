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
