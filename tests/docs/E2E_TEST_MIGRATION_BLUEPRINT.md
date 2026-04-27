# E2E Test Migration Blueprint

## Goal

Apply only the GUI and E2E test environment from the current baseline to another backup baseline.

This blueprint excludes:

- `main` refactor structure itself
- message/i18n refactor
- non-test-oriented feature changes

This blueprint includes:

- Playwright-based Electron E2E setup
- renderer-side test hooks
- finder-side test hooks
- preload APIs required for direct path-based loading

---

## Target Outcome

After migration, the target baseline should support:

1. `npm run test:e2e`
2. app startup verification
3. `lcmodel` loading verification
4. `age csv` loading verification
5. Finder verification for `CD`, `EFD`, and `age`

---

## Required Files

Add these files:

- `tests/playwright.config.js`
- `tests/e2e/app-startup.spec.js`

---

## package.json Changes

Add this script:

```json
"test:e2e": "playwright test --config tests/playwright.config.js"
```

Add these devDependencies:

```json
"@playwright/test": "^1.58.2",
"playwright": "^1.58.2"
```

---

## tests/playwright.config.js

Create:

```js
const path = require("path");

module.exports = {
  testDir: path.join(__dirname, "e2e"),
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
};
```

---

## Main Process Requirements

The target baseline must already support these IPC channels:

- `RegisterLCmodel`
- `RegistertAgeFromCsv`
- `MirrorAgeList`
- `OpenFinder`
- `depthConverter`

The app must be launchable through:

```js
require("./app/bootstrap/main-process");
```

or equivalent Electron entrypoint behavior.

If updater or similar background behavior interferes with E2E, guard it with:

- environment variable: `LC_E2E=1`

---

## preload.js Requirements

Add direct-path APIs so tests do not depend on native file dialogs.

Required additions:

```js
RegisterModelFromPath: (args) => ipcRenderer.invoke("RegisterModelFromCsv", args),
RegisterAgeFromPath: (args) => ipcRenderer.invoke("RegistertAgeFromCsv", args),
RegisterLCmodelFromPath: (args) => ipcRenderer.invoke("RegisterLCmodel", args),
OpenFinder: () => ipcRenderer.invoke("OpenFinder"),
depthConverter: (args0, args1) => ipcRenderer.invoke("depthConverter", args0, args1),
MirrorAgeList: () => ipcRenderer.invoke("MirrorAgeList"),
```

These are in addition to the normal `webUtils.getPathForFile(...)` APIs.

---

## renderer.js Test Hook

Add a minimal E2E hook near startup:

```js
window.__LC_E2E__ = {
  isReady: () => true,
  getRendererState: () => ({
    isLoadedLCModel,
    projectCount: LCCore?.projects?.length ?? 0,
    holeCount: LCCore?.projects?.reduce((sum, project) => sum + project.holes.length, 0) ?? 0,
    ageModelCount: document.getElementById("AgeModelSelect").options.length,
    holeListCount: document.querySelectorAll("#hole_list input[type='checkbox']").length,
    yAxisScale: document.getElementById("YAxisSelect").value,
  }),
  loadLcModelFromPath: async (inputPath) => {
    await initialiseCanvas();
    isLoadedLCModel = true;

    const loaded = await window.LCapi.RegisterLCmodelFromPath(inputPath);
    if (loaded === false) {
      isLoadedLCModel = false;
      return { ok: false, error: "register_failed" };
    }

    setAgeList(loaded);
    await loadModel(true, true);

    const selectedAgeModelId = document.getElementById("AgeModelSelect").value;
    if (selectedAgeModelId) {
      await loadAge(selectedAgeModelId);
      await loadPlotData("age");
      await loadPlotData("data");
    }

    return {
      ok: true,
      ...window.__LC_E2E__.getRendererState(),
    };
  },
  loadAgeModelFromPath: async (inputPath) => {
    const loadedAge = await window.LCapi.RegisterAgeFromPath(inputPath);
    if (!loadedAge) {
      return { ok: false, error: "register_age_failed" };
    }

    age_model_list = await window.LCapi.MirrorAgeList();
    setAgeList(age_model_list);
    const selectedAgeModelId = loadedAge.id ?? document.getElementById("AgeModelSelect").value;
    if (selectedAgeModelId) {
      document.getElementById("AgeModelSelect").value = selectedAgeModelId;
    }

    return {
      ok: true,
      loadedAge,
      ...window.__LC_E2E__.getRendererState(),
    };
  },
};
```

Important:

- `setAgeList()` should reset its source list before rebuilding UI
- otherwise age models may duplicate during E2E runs

Recommended reset behavior:

```js
age_model_list = [];
```

---

## renderer_finder.js Test Hook

Add a minimal finder hook:

```js
window.__LC_FINDER_E2E__ = {
  isReady: () => true,
  getState: () => ({
    hole: document.getElementById("holeOptions").value,
    section: document.getElementById("sectionOptions").value,
    distance: document.getElementById("distanceInput").value,
    cd: document.getElementById("cdInput").value,
    efd: document.getElementById("efdInput").value,
    age: document.getElementById("ageInput").value,
    holeCount: document.getElementById("holeOptions").options.length,
    sectionCount: document.getElementById("sectionOptions").options.length,
  }),
};
```

---

## E2E Spec Structure

Create `tests/e2e/app-startup.spec.js`.

### Launch Helper

```js
const path = require("path");
const { test, expect, _electron: electron } = require("@playwright/test");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const FIXTURE_PATHS = {
  lcmodel: path.join(ROOT_DIR, "test_data_private", "SG06-SG14-.lcmodel"),
  ageCsv: path.join(ROOT_DIR, "test_data_private", "[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv"),
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
```

### Required Tests

1. app starts and renderer test hook is available
2. app loads `lcmodel` fixture into renderer
3. app loads `age csv` fixture into renderer after `lcmodel`
4. finder coordinate search computes `CD`, `EFD`, and `age` consistently after loading age model

### Finder Verification Strategy

The finder test should:

1. load `lcmodel`
2. load `age csv`
3. open Finder via `window.LCapi.OpenFinder()`
4. wait for finder test hook readiness
5. choose the current hole/section
6. compute a safe midpoint distance from `distanceInput.min/max`
7. call `window.FinderApi.depthConverter(...)` directly for expected values
8. write the same distance to Finder UI
9. assert UI values match:
   - `#cdInput`
   - `#efdInput`
   - `#ageInput`

---

## Minimal E2E Test Cases

### Startup

Expected:

- title matches app name
- renderer hook exists
- initial model state is unloaded

### lcmodel Load

Expected:

- `ok === true`
- model loaded state becomes true
- project count > 0
- hole count > 0
- hole list UI count matches returned state

### age csv Load

Expected:

- `ok === true`
- returned `loadedAge` exists
- `AgeModelSelect` matches loaded age id

### Finder Validation

Expected:

- `CD` matches calculated value
- `EFD` matches calculated value
- `age` matches calculated value

---

## Dependency on Existing Application Structure

The target baseline must already have:

- renderer methods:
  - `initialiseCanvas()`
  - `loadModel(...)`
  - `loadAge(...)`
  - `loadPlotData(...)`
  - `setAgeList(...)`
- finder inputs:
  - `#holeOptions`
  - `#sectionOptions`
  - `#distanceInput`
  - `#cdInput`
  - `#efdInput`
  - `#ageInput`
- finder preload API:
  - `FinderApi.depthConverter(...)`

This migration is not intended to redesign the application.
It only creates stable automation entrypoints.

---

## Recommended Migration Order

1. add Playwright dependencies
2. add `tests/playwright.config.js`
3. add `tests/e2e/app-startup.spec.js`
4. add preload direct-path APIs
5. add `window.__LC_E2E__` in renderer
6. add `window.__LC_FINDER_E2E__` in finder
7. ensure `LC_E2E=1` startup is stable
8. run:

```powershell
npm.cmd run test:e2e
```

---

## Recommended Constraint for the New Session

Use this instruction in the new session:

1. Apply only the Playwright/E2E test environment to the backup baseline.
2. Do not refactor `main`.
3. Do not touch `LCC/LCA/LCP` core logic.
4. Add only the minimum preload and renderer test hooks required.
5. Make `npm run test:e2e` pass.

---

## Current Reference Scope

This blueprint reflects the current working implementation in this repository:

- startup E2E
- `lcmodel` load E2E
- `age csv` load E2E
- Finder `CD / EFD / age` consistency E2E
