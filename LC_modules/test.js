var { LevelCompilerCore } = require("./LevelCompilerCore.js");
var { LevelCompilerAge } = require("./LevelCompilerAge.js");
var { Trinity } = require("./Trinity.js");
const lcfnc = require("./lcfnc.js");
const { Age } = require("./Age.js");

let model_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/0. LC test model with event.csv";
const event_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/2. LC test event.csv";

const age_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv";

model_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG Correlation model for LC (24 Nov. 2023).csv";

const p = new LevelCompilerCore();
p.loadModelFromCsv(model_path);
p.calcCompositeDepth();
p.calcEventFreeDepth();

const a = new LevelCompilerAge();

a.loadAgeFromCsv(p, age_path);
console.log(a.getAgeFromEFD("100", "linear"));

//a.checkAges();

//const age = a.getAgeFromEFD(0, 100, "linear");
//const efd = a.getEFDFromAge(1, 150, "linear");
//console.log(efd);

//p.clacMarkerAges(a, 1);
//console.log(p.projectData.holes[0].sections[0].markers[0].age);

//p.testShow();
//var costs = p.dfs([1, 3, 1, "marker", 1]);
//console.log(costs);
//p.calcCompositeDepth();
//
//p.getModelSummary();
//if (p.checkModel(p.getDepthFromName("event_free_depth", "D", "03", 15.6))) {}
//console.log(p.getDepthFromName("event_free_depth", "D", "03", 15.6));
/*
let trinityList = [];
let data1 = new Trinity();
data1.name = "test1";
data1.hole_name = "SG93";
data1.section_name = "15";
data1.distance = 49;
let data2 = new Trinity();
data2.name = "test2";
data2.hole_name = "A";
data2.section_name = "1";
data2.distance = 250;

trinityList.push(data1);
trinityList.push(data2);

console.log("-------------------------------------------------------------");
const output = p.getDepthFromTrinity(trinityList, "event_free_depth");
output.forEach((o) => {
  console.log(o[0] + ":" + o[1]);
});
*/

/*
let data = new Age();
data.name = "tttttttttttttttttttttttttttttttttttttttttttttttttttttttttt";
data.event_free_depth = -10;
a.addAge(1, data);
//a.removeAge(1, 751);
a.sortAges();
a.AgeModels[0].ages.forEach((element) => {
  console.log(element.name + "/" + element.id + "/" + element.order);
});
*/

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
