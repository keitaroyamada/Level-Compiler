var { LevelCompilerCore } = require("./LevelCompilerCore.js");
var { LevelCompilerAge } = require("./LevelCompilerAge.js");
const lcfnc = require("./lcfnc.js");

let model_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/0. LC test model with event.csv";
const event_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/2. LC test event.csv";

const age_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv";

model_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/SG Correlation model for LC (24 Nov. 2023).csv";

const p = new LevelCompilerCore();
p.loadModelFromCsv(model_path);
p.calcCompositeDepth();
p.calcEventFreeDepth();
//p.testShow();
//var costs = p.dfs([1, 3, 1, "marker", 1]);
//console.log(costs);
//p.calcCompositeDepth();
//
//p.getModelSummary();
//if (p.checkModel(p.getDepthFromName("event_free_depth", "D", "03", 15.6))) {}
//console.log(p.getDepthFromName("event_free_depth", "D", "03", 15.6));
const a = new LevelCompilerAge();
a.loadAgeFromCsv(p, age_path);

/*
const serialized = JSON.parse(
  JSON.stringify(p, (key, value) => {
    // 関数は除外
    if (typeof value === "function") {
      return undefined;
    }
    return value;
  })
);

console.log(serialized.projectData);
*/
//p.initiariseProject();

//p.projectData.name = "test";

//
//console.log(data[1].findIndex((e) => e.includes("top")));
//console.log(lcfnc.findCsvIdx(data, "-top", null, 1));

/*
testCore = new Core();
m1 = new Marker();
m1.distance = 10.0;
m2 = new Marker();
m2.distance = 9.0;

testCore.addMarker(m1);
testCore.addMarker(m2);

//console.log(testCore.markers);
testCore.markers[0].isMaster = true;
*/

/*

    */
