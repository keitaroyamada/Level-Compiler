const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

function readCsvRows(filepath) {
  return parse(fs.readFileSync(filepath, "utf8"), {
    relax_column_count: true,
    bom: true,
  });
}

function writeCsvRows(filepath, rows) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  const output = stringify(rows);
  fs.writeFileSync(filepath, output, "utf8");
  return filepath;
}

function copyFileWithNewName(sourcePath, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
  return outputPath;
}

function mutateCsvFile(sourcePath, outputPath, mutator) {
  const rows = readCsvRows(sourcePath);
  mutator(rows);
  return writeCsvRows(outputPath, rows);
}

function replaceFirstCellMatching(rows, predicate, replacer) {
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const value = rows[r][c];
      if (predicate(value, r, c, rows)) {
        rows[r][c] = replacer(value, r, c, rows);
        return { row: r, col: c, previousValue: value, nextValue: rows[r][c] };
      }
    }
  }
  throw new Error("No matching CSV cell was found for mutation.");
}

module.exports = {
  readCsvRows,
  writeCsvRows,
  copyFileWithNewName,
  mutateCsvFile,
  replaceFirstCellMatching,
};
