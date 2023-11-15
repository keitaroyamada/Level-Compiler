const { parse } = require("csv-parse/sync");
const fs = require("fs");

function readcsv(data_path) {
  const csvData = parse(fs.readFileSync(data_path, "utf8"), {
    columns: false,
    delimiter: ",",
  });
  return csvData;
}

function uuidv4() {
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function findCsvIdx(data, txt, rn, cn) {
  let results = [];
  for (let r = 1; r < data.length; r++) {
    const row_data = data[r];
    for (let c = 1; c < row_data.length; c++) {
      let tf = row_data[c].includes(txt);
      if (tf === true) {
        results.push([r, c]);
      }
    }
  }

  //extract
  let output = [];

  if (rn == null && cn == null) {
    let output = results;
    return output;
  } else if (rn != null && cn == null) {
    for (let i = 0; i < results.length; i++) {
      if (results[i][0] == rn) {
        output.push(results[i]);
      }
    }
  } else if (rn == null && cn != null) {
    for (let i = 0; i < results.length; i++) {
      if (results[i][1] == cn) {
        output.push(results[i]);
      }
    }
  } else {
    for (let i = 0; i < results.length; i++) {
      if (results[i][0] == rn && results[i][1] == cn) {
        output.push(results[i]);
      }
    }
  }

  return output;
}

function makeUniqeIdList(rn, cn) {
  let output = [];
  for (let r = 0; r < rn; r++) {
    let output_r = [];
    for (let c = 0; c < cn; c++) {
      output_r.push(this.uuidv4());
    }
    output.push(output_r);
  }
  return output;
}

function validateName(name, keywords) {
  //const keywords = ["top", "bottom"];
  if (keywords.includes(name)) {
    name = "__" + name;
    //throw new Error(name +' is the reserved word.');
    console.log(
      name + " is reserved word. Therefore, name is renamed to __",
      +name + "."
    );
  }
  return name;
}

function makeMarkerIdBase(rn, cn) {
  let output = [];
  for (let r = 0; r < rn; r++) {
    let output_r = [];
    for (let c = 0; c < cn; c++) {
      output_r.push(null);
    }
    output.push(output_r);
  }
  return output;
}
function getUniqueId(reserved_idxs) {
  return Math.max.apply(null, reserved_idxs) + 1;
}
function zeroPadding(str) {
  if (/^\d+$/.test(str.toString()) == true) {
    //case number
    str = str.toString().padStart(2, "0");
  }
  return str;
}
function randNormal(mean, std, n) {
  let output = [];
  for (let i = 0; i < n; i++) {
    //Box–Muller's method
    var x = Math.random();
    var y = Math.random();

    var z1 = Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y);
    //var z2 = Math.sqrt(-2 * Math.log(x)) * Math.sin(2 * Math.PI * y);

    const val = z1 * std + mean;
    //std + z1 * mean, z2: std + z2 * mean
    output.push(val);
  }

  return output;
}

module.exports = {
  readcsv,
  uuidv4,
  makeUniqeIdList,
  findCsvIdx,
  validateName,
  getUniqueId,
  makeMarkerIdBase,
  zeroPadding,
  randNormal,
};
