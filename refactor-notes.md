# Main Process Refactor Notes

## Step List

1. 命名規則を固定する
2. `windows.js` に window 参照管理だけ切り出す
3. `mainWindow` を `getWindow("main")` 経由に置換する
4. 補助 window を1種類ずつ参照管理へ移す
5. `createWindow(type)` を導入して生成処理を段階移行する
6. IPC 登録を `ipc.js` へ移す
7. IPC 名は新旧併用期間を設ける
8. 多引数 IPC を1件ずつ `payload` 化する
9. `preload` / renderer を切り替えて最後に旧形式を削除する

## Current Status

- `1` 完了
- `2` 完了
- `3` 完了
- `4` 完了
- `5` 完了
- `6` 未着手
- `7` 未着手
- `8` 未着手
- `9` 未着手

## What Was Done

- [`main/conventions.js`](/C:/Users/slinn/source/repos/Level-Compiler/main/conventions.js) を追加
- [`main/windows.js`](/C:/Users/slinn/source/repos/Level-Compiler/main/windows.js) を追加
- [`main.js`](/C:/Users/slinn/source/repos/Level-Compiler/main.js) に window store 用 helper を追加
- window ごとの thin wrapper を store 経由へ統一
- `sendToManagedWindow()` を導入し、安全送信を共通化
- `mainWindow`, `finder`, `divider`, `converter`, `settings`, `labeler`, `plotter`, `imageViewer` を参照管理へ移行
- `createWindow(type)` を [`main/windows.js`](/C:/Users/slinn/source/repos/Level-Compiler/main/windows.js) に導入し、window 定義と `loadFile` を集約
- `settings` / `converter` の open 処理を [`main.js`](/C:/Users/slinn/source/repos/Level-Compiler/main.js) の helper に統合
- `about` window を factory 管理へ移行し、`ABOUT` type を追加
- 未使用の `createNewWindow()` を削除
- `converter` と `imageViewer` の初期イベント送信を `did-finish-load` 基準へ調整
- `about` の version 送信を renderer 初期化 race を避ける形へ調整
- `importer` は未使用の残骸と判断して削除

## Removed Importer

- [`main.js`](/C:/Users/slinn/source/repos/Level-Compiler/main.js) の `OpenImporter` / `CloseImporter` を削除
- [`preload/preload.js`](/C:/Users/slinn/source/repos/Level-Compiler/preload/preload.js) の importer API を削除
- [`main/conventions.js`](/C:/Users/slinn/source/repos/Level-Compiler/main/conventions.js) から `IMPORTER` を削除
- [`main/windows.js`](/C:/Users/slinn/source/repos/Level-Compiler/main/windows.js) から importer slot を削除
- [`renderer/js/renderer.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer.js) の `ImporterClosed` event log を削除

## Tests Added

- [`tests/main-windows.test.js`](/C:/Users/slinn/source/repos/Level-Compiler/tests/main-windows.test.js)
- [`tests/e2e/app-startup.spec.js`](/C:/Users/slinn/source/repos/Level-Compiler/tests/e2e/app-startup.spec.js)
- `main-windows` に factory default / dev 定義のテストを追加
- E2E に `about` window の open / version 表示確認を追加

## E2E Coverage

- app 起動
- `lcmodel` 読込
- age csv 読込
- core image 読込
- `imageViewer` open/close
- finder 起動、座標変換、close 通知
- divider 起動、初期データ、close 通知
- converter 起動、close 通知
- settings 起動、close 通知
- about 起動、version 表示
- labeler 起動、close 通知
- plotter 起動、explicit close 通知
- main menu event 到達

## Current Verification

- `npm.cmd test`: CLI regression `29/29 PASS`
- sandbox 上の `npm.cmd test` 内 `test:e2e` は `spawn EPERM`
- 権限付き `npm.cmd run test:e2e`: `15/15 PASS`
- E2E の標準実行手順は `npm.cmd run test:e2e`
- Codex からの E2E 実行は sandbox 制約を避けるため、必要に応じて権限付きで行う

## Constraints

- `LCC / LCA / LCP` と関連コアロジックには未着手
- 一括変更は避け、段階ごとに起動可能を維持
- 変更ごとに `npm.cmd test` を実行
- E2E は `npm.cmd run test:e2e` をデフォルト手順として実行する
- Codex 実行時に sandbox 上で `spawn EPERM` が出る場合は、権限付き `npm.cmd run test:e2e` で確認する
- 事前に申告していないファイルや層へ変更が波及する場合は、実施前にユーザー許可を取る
- IPC refactor では、`main` だけでなく `preload` / `renderer` への波及有無を事前に明示する
- payload 化で既存 E2E では踏まない IPC 経路が増えた場合は、必要な E2E を追加してから完了とする

## Next Step

- ステップ `6`
- IPC 登録を `ipc.js` へ移し、`main.js` から段階的に分離する
## 2026-04 Payload Refactor Summary

### Completed

- window helper / window store 整理は完了
- importer 関連コード削除は完了
- 引数あり IPC の payload 化は完了
- preload の旧形式互換 wrapper 削除は完了
- `dividerConverter` は `ipcMain.on` / `sendSync` から `ipcMain.handle` / `invoke` へ移行済み

### Payloadized IPC

- main editor 系
  `changeWorkspace`
  `addProject`
  `changeProject`
  `deleteProject`
  `addHole`
  `changeHole`
  `deleteHole`
  `moveHoleToProject`
  `addSection`
  `changeSection`
  `deleteSection`
  `addMarker`
  `changeMarker`
  `deleteMarker`
  `connectMarkers`
  `disconnectMarkers`
  `disconnectAllConnections`
  `SetZeroPoint`
  `SetMaster`
  `changeEnable`
  `AddEvent`
  `DeleteEvent`
- state / settings / calculation 系
  `sendSettings`
  `sendSaveState`
  `getChangedSectionIds`
  `sendPlotOptions`
  `depthConverter`
  `GetAgeFromEFD`
  `GetAgeFromCD`
- tool / dialog / utility 系
  `FileChoseDialog`
  `FolderChoseDialog`
  `progressbar`
  `updateProgressbar`
  `Confirm`
  `askdialog`
  `floatingImageViewer`
  `showContextMenu`
  `openExtarnalLink`
  `SendDepthToFinder`
  `sendUndo`
  `sendRedo`
  `saveBookmarks`
  `changeFix`
  `MoveToHorizon`
  `getSectionLimit`
- model / file / image 系
  `RegisterModelFromCsv`
  `RegistertAgeFromCsv`
  `RegisterLCmodel`
  `LoadAgeFromLCAge`
  `CheckImagesInDir`
  `RegisterCoreImage`
  `LoadCoreImage`
  `isExistFile`
  `LabelerLoadSectionModel`
  `LoadPlotData`
  `PlotterGetData`
  `cvtLoadCsv`
  `cvtConverter`
- labeler 系
  `LabelerAddSectionData`
  `LabelerAddMarkerData`
  `LabelerChangeMarker`
  `LabelerDeleteMarker`

### Removed Or Cleaned Up

- preload の旧形式互換分岐を削除
- 未使用の `isPlainObject` helper を削除
- 未使用の `ConverterApi.cvtConvert` を削除

### E2E Added During Payload Work

- file / folder chooser payload
- `LoadCoreImage` payload
- finder `getSectionLimit`
- converter `cvtLoadCsv`
- converter `cvtConverter`
- divider `dividerConverter`
- settings round-trip
- `depthConverter` payload
- `AddEvent` / `DeleteEvent`
- `deleteSection`
- `sendSaveState` / `getChangedSectionIds`
- unsaved changes close dialog
- labeler `sendSaveState`
- labeler file lookup payload
- labeler marker payload
- plotter `sendPlotOptions`

### Current Verification Baseline

- `npm.cmd test`
  CLI regression `29/29 PASS`
- `npm.cmd test` 内の E2E は Codex sandbox 制約で `spawn EPERM`
- `npm.cmd run test:e2e`
  `31/31 PASS`

### Working Rules

- 変更ごとに `npm.cmd test` を実行する
- 毎回 `npm.cmd run test:e2e` も実行する
- Codex 上で E2E が sandbox 制約に当たる場合は、権限付きで `npm.cmd run test:e2e` を使う
- 事前申告した範囲を超えて `main` / `preload` / `renderer` の別層へ波及する場合は、実施前に許可を取る
- payload 化で新しい IPC 経路を触った場合は、必要な E2E を追加してから完了扱いにする

### Suggested Next Step

- Step 6 に戻る
- IPC 登録を [`main.js`](/C:/Users/slinn/source/repos/Level-Compiler/main.js) から `ipc.js` へ段階的に分離する
## 2026-04 Drop Fix Follow-up

### Summary

- Fixed real drag-and-drop regressions introduced during the payload refactor.
- Restored `askdialog` compatibility, then migrated renderer callers to the new `{ opts: ... }` shape.
- Fixed drop loading for `.lcmodel`, age csv, and core images.

### Root Causes

- `askdialog` in the main process had been changed to require `payload.opts`, while renderer drop flows still sent the legacy direct payload shape.
- Renderer model drop helpers passed wrapped objects like `{ modelPath: file }` and `{ agePath: file }` into preload APIs that expected the raw `File` object.
- Renderer core-image drop passed a dropped `File` object into `RegisterCoreImage`, while the main process expected a resolved filesystem path string.

### Code Changes

- [`main.js`](/C:/Users/slinn/source/repos/Level-Compiler/main.js)
  `askdialog` now accepts both `payload.opts` and the legacy direct shape for backward compatibility.
- [`renderer/js/renderer.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer.js)
  Updated all `askdialog` callers to use `{ opts: { ... } }`.
- [`renderer/js/renderer.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer.js)
  `registerModel`, `registerAge`, and `registerLCModel` now branch correctly between dropped `File` objects and direct path strings.
- [`renderer/js/renderer.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer.js)
  Core-image drop now resolves the dropped item to a real path via `window.LCapi.getFilePath(...)` before calling `RegisterCoreImageFromPath`.

### E2E Added

- [`tests/e2e/app-startup.spec.js`](/C:/Users/slinn/source/repos/Level-Compiler/tests/e2e/app-startup.spec.js)
  Added empty-state drop test for `.lcmodel`.
- [`tests/e2e/app-startup.spec.js`](/C:/Users/slinn/source/repos/Level-Compiler/tests/e2e/app-startup.spec.js)
  Added drop test for age csv after `.lcmodel`.
- [`tests/e2e/app-startup.spec.js`](/C:/Users/slinn/source/repos/Level-Compiler/tests/e2e/app-startup.spec.js)
  Added drop test for core images after `.lcmodel` and age csv.

### Verification

- `npm.cmd run test:cli`
  `29/29 PASS`
- `npx.cmd playwright test tests/e2e/app-startup.spec.js --grep "app loads lcmodel fixture by drop into an empty renderer"`
  `1 passed`
- `npx.cmd playwright test tests/e2e/app-startup.spec.js --grep "app loads core images into the renderer after lcmodel"`
  `1 passed`
- `npx.cmd playwright test tests/e2e/app-startup.spec.js --grep "app loads age csv fixture by drop after lcmodel|app loads core images by drop after lcmodel and age model"`
  `2 passed`

## 2026-04 IPC Contract Fix Follow-up

### What Broke

- Contract fixing for `askdialog`, `Confirm`, model registration, age registration, and core-image registration was attempted by introducing a shared contract module.
- Electron sandboxed preload scripts could not `require("../ipc/contracts.js")`.
- As a result, preload failed to load, `window.LCapi` was undefined, and renderer startup stopped before `GetResources()` completed.
- This made app resource icons such as the finder button appear broken, even though the actual icon resource paths in main were still correct.

### Resolution

- Removed the unapproved shared contract file approach.
- Restored preload compatibility by keeping the small normalisation helpers inside each preload file.
- Preserved the fixed payload contracts in preload for:
  - `askdialog`
  - `Confirm`
  - `RegisterModelFromCsv`
  - `RegistertAgeFromCsv`
  - `RegisterLCmodel`
  - `RegisterCoreImage`

### Verification

- `npm.cmd run test:cli`
  `32/32 PASS`
- `npx.cmd playwright test tests/e2e/app-startup.spec.js --grep "main window close shows unsaved dialog and can discard changes"`
  `1 passed`
- `npx.cmd playwright test tests/e2e/app-startup.spec.js --grep "app loads age csv fixture by drop after lcmodel|app loads core images by drop after lcmodel and age model|app loads core images by drop when images are stored in a nested subfolder"`
  `3 passed`

## 2026-04 Renderer Load Path Consolidation

### Summary

- Consolidated the main renderer load flows for correlation models, age models, lcmodel imports, and core images.
- Drop flows and E2E hooks now use the same higher-level orchestration functions.

### Code Changes

- [`renderer/js/renderer.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer.js)
  Added `importCorrelationModelSource`, `importAgeModelSource`, `importLcModelSource`, `importCoreImagesSource`, `syncAgeSelection`, and `getLatestAgeModelId`.
- [`renderer/js/renderer.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer.js)
  Updated drag-and-drop handlers and E2E hooks to call the shared import functions instead of rebuilding the flow inline.

### Verification

- `npm.cmd run test:cli`
  `29/29 PASS`
- `npm.cmd run test:e2e`
  `35/35 PASS`

## 2026-04 Plotter Cleanup

### Summary

- Fixed plotter API naming mismatch and plotter initialise event-name mismatch.
- Fixed a main-process crash when the plotter close-button IPC arrived after the plotter window reference was already cleared.

### Code Changes

- [`renderer/js/renderer_plotter.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer_plotter.js)
  Replaced `window.PlotterAPI` with `window.PlotterApi.windowCloseButton()`.
- [`renderer/js/renderer_plotter.js`](/C:/Users/slinn/source/repos/Level-Compiler/renderer/js/renderer_plotter.js)
  Renamed `initiariseSendData` listener to `initialiseSendData`.
- [`main.js`](/C:/Users/slinn/source/repos/Level-Compiler/main.js)
  Added guarded `closePlotterWindow`, `closeDividerWindow`, and `closeFinderWindow` helpers and routed close handlers through them.
- [`tests/e2e/app-startup.spec.js`](/C:/Users/slinn/source/repos/Level-Compiler/tests/e2e/app-startup.spec.js)
  Added `plotter close button IPC notifies the main renderer`.

### Verification

- `npx.cmd playwright test tests/e2e/app-startup.spec.js --grep "plotter window opens from the menu and notifies on explicit close|plotter close button IPC notifies the main renderer|plotter sendPlotOptions payload reaches the main renderer"`
  `3 passed`
- `npm.cmd run test:e2e`
  `35/35 PASS`
