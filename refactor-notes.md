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

## Constraints

- `LCC / LCA / LCP` と関連コアロジックには未着手
- 一括変更は避け、段階ごとに起動可能を維持
- 変更ごとに `npm.cmd test` を実行
- E2E は権限付きで `npm.cmd run test:e2e` を実行

## Next Step

- ステップ `6`
- IPC 登録を `ipc.js` へ移し、`main.js` から段階的に分離する
