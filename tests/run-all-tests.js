const path = require("path");
const { getRegisteredTests } = require("./helpers/test-harness.js");

/*
現在実装されているテスト機能 / Implemented test coverage

日本語:
- 現行コードと正答ファイルの一致確認
  - LC(csv)
  - LF(csv + event csv)
  - LC(lcmodel)
- CD/EFD 回帰確認
  - 全 marker の composite_depth
  - 全 marker の event_free_depth
  - depth_source
  - connection_rank
  - unreliability
- 水平相関整合性確認
  - h_connection 先で CD 一致
  - h_connection 先で EFD 一致
- depth_source 分類件数の固定確認
  - LC(csv) の分類件数
  - LF(csv) の分類件数
- 深度変換関数群の確認
  - getDepthFromTrinity() の全 marker 間 1 cm スイープ比較
  - getDepthFromTrinity() の section 外参照
    - 外挿禁止時は失敗
    - 外挿許可時は extrapolation
  - getEFDfromCD() の確認
  - getCDfromEFD() と getEFDfromCD() の往復確認
- Age 検証
  - age CSV 読込
  - getAgeFromEFD() の往復確認
  - getEFDFromAge() の往復確認
  - updateAgeDepth() 後の有限値保持
  - contradiction 件数の固定確認
  - enable / reliable 状態件数の固定確認
  - tie point 範囲外での age 外挿確認
- 入力破損検証
  - LC(csv) ファイル名識別子欠落
  - LC(csv) top/bottom 不整合
  - LF(event csv) 範囲外 distance
  - age(csv) 存在しない trinity
  - LC(lcmodel) zero point 欠損
- テスト機構自身の検証
  - 比較器が差分を検出できること
  - 許容差 0.001 cm 以内なら通ること

English:
- Current-code vs saved-answer consistency checks
  - LC(csv)
  - LF(csv + event csv)
  - LC(lcmodel)
- CD/EFD regression checks
  - composite_depth for all markers
  - event_free_depth for all markers
  - depth_source
  - connection_rank
  - unreliability
- Horizontal-correlation consistency checks
  - CD equality across h_connection targets
  - EFD equality across h_connection targets
- Fixed depth_source classification counts
  - classification counts for LC(csv)
  - classification counts for LF(csv)
- Depth-conversion function checks
  - getDepthFromTrinity() 1 cm sweep between all marker intervals
  - out-of-section getDepthFromTrinity() lookups
    - fail when extrapolation is disabled
    - return extrapolation when extrapolation is enabled
  - getEFDfromCD() validation
  - round-trip validation through getCDfromEFD() and getEFDfromCD()
- Age checks
  - age CSV loading
  - getAgeFromEFD() round-trip checks
  - getEFDFromAge() round-trip checks
  - finite depth preservation after updateAgeDepth()
  - fixed contradiction-count checks
  - fixed enable / reliable state-count checks
  - age extrapolation outside tie-point range
- Corrupted-input checks
  - missing LC(csv) filename identifier
  - mismatched LC(csv) top/bottom markers
  - out-of-range LF(event csv) distance values
  - nonexistent trinity in age(csv)
  - missing zero points in LC(lcmodel)
- Test-framework self-checks
  - comparator must detect intentional mismatches
  - comparator must pass values within 0.001 cm tolerance
*/

const testFiles = [
  "current-code.test.js",
  "input-validation.test.js",
  "cd-efd-regression.test.js",
  "depth-conversion.test.js",
  "age-regression.test.js",
  "test-framework.test.js",
].map((file) => path.join(__dirname, file));

for (const file of testFiles) {
  require(file);
}

(async () => {
  const tests = getRegisteredTests();
  let passCount = 0;
  let failCount = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      passCount += 1;
      console.log(`PASS ${name}`);
    } catch (error) {
      failCount += 1;
      console.error(`FAIL ${name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  console.log(`TOTAL ${tests.length}`);
  console.log(`PASS ${passCount}`);
  console.log(`FAIL ${failCount}`);
  process.exitCode = failCount > 0 ? 1 : 0;
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
