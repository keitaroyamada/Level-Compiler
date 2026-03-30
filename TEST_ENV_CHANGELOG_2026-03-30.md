# Test Environment Change Log

Date: 2026-03-30

## Purpose

Record the test-environment changes added in this session so the current setup and follow-up work are easy to track.

## Added

- Playwright-based Electron E2E environment
- Renderer-side E2E hook
- Finder-side E2E hook
- Direct path-based preload APIs for test-driven loading
- Combined `npm test` entry point with readable summary output

## Updated Commands

- `npm test`
  - Runs CLI regression first
  - Runs Electron E2E second
  - Prints suite summary and suite descriptions at the end
- `npm run test:cli`
  - Runs existing CLI/core regression tests
- `npm run test:e2e`
  - Runs Playwright Electron E2E tests

## Files Added

- [playwright.config.js](C:/Users/slinn/source/repos/Level-Compiler/playwright.config.js)
- [tests/e2e/app-startup.spec.js](C:/Users/slinn/source/repos/Level-Compiler/tests/e2e/app-startup.spec.js)
- [scripts/run-project-tests.js](C:/Users/slinn/source/repos/Level-Compiler/scripts/run-project-tests.js)
- [scripts/test-suites.js](C:/Users/slinn/source/repos/Level-Compiler/scripts/test-suites.js)
- [TEST_ENV_CHANGELOG_2026-03-30.md](C:/Users/slinn/source/repos/Level-Compiler/TEST_ENV_CHANGELOG_2026-03-30.md)

## Files Updated

- [package.json](C:/Users/slinn/source/repos/Level-Compiler/package.json)
  - Added `test:e2e`
  - Renamed CLI entry to `test:cli`
  - Changed `test` to the combined summary runner
  - Added Playwright devDependencies
- [preload/preload.js](C:/Users/slinn/source/repos/Level-Compiler/preload/preload.js)
  - Added direct-path APIs for model and age loading
- [renderer/js/renderer.js](C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer.js)
  - Added `window.__LC_E2E__`
  - Reset `age_model_list` in `setAgeList()` to avoid duplicated entries across repeated E2E runs
- [renderer/js/renderer_finder.js](C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer_finder.js)
  - Added `window.__LC_FINDER_E2E__`
- [main.js](C:/Users/slinn/source/repos/Level-Compiler/main.js)
  - Disabled updater flow when `LC_E2E=1`
  - Moved Finder initialization signal to a load-safe timing for stable E2E execution

## E2E Coverage Added

- App startup
- Renderer hook readiness
- `lcmodel` fixture loading
- `age csv` fixture loading
- Finder verification for:
  - `CD`
  - `EFD`
  - `age`

## Current Summary Output

`npm test` now prints:

- per-suite pass/fail
- elapsed time for each suite
- overall pass/fail
- explanation of what each suite covers

## Known Notes

- CLI regression logs still include domain-specific warnings and expected invalid-input messages.
- One recurring message is `LCCore:E001: There is no identifier for model in the file name.`
- That message is emitted by an existing negative test and is not itself a failure when the suite passes.

## How To Extend

When adding a new test suite later:

1. add the npm script in [package.json](C:/Users/slinn/source/repos/Level-Compiler/package.json)
2. add the suite metadata in [scripts/test-suites.js](C:/Users/slinn/source/repos/Level-Compiler/scripts/test-suites.js)
3. ensure the suite exits non-zero on failure
4. `npm test` summary will include it automatically

When extending Electron E2E:

1. add or update specs in [tests/e2e/app-startup.spec.js](C:/Users/slinn/source/repos/Level-Compiler/tests/e2e/app-startup.spec.js)
2. add test-only hooks only when necessary
3. prefer exposing minimal state readers instead of large test-only behavior

## Validation Status At Time Of Record

- `npm run test:cli`: pass
- `npm run test:e2e`: pass
- `npm test`: pass
