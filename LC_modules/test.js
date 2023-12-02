var { LevelCompilerCore } = require("./LevelCompilerCore.js");
var { LevelCompilerAge } = require("./LevelCompilerAge.js");
var { Trinity } = require("./Trinity.js");
const lcfnc = require("./lcfnc.js");
const { Age } = require("./Age.js");
const { LevelCompilerPlot } = require("./LevelCompilerPlot.js");

let model_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/0. LC test model with event.csv";
const event_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/2. LC test event.csv";

const age_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv";

model_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG Correlation model for LC (24 Nov. 2023).csv";

const core = new LevelCompilerCore();
core.loadModelFromCsv(model_path);
core.calcCompositeDepth();
core.calcEventFreeDepth();
const t = new Trinity();
t.hole_name = "A";
t.section_name = "01";
t.distance = 0;
//console.log(core.getDepthFromTrinity([t], "drilling_depth"));

const age = new LevelCompilerAge();
age.loadAgeFromCsv(core, age_path);
console.log(age.AgeModels[0].ages[10]);

const plot = new LevelCompilerPlot();
plot.addNewAgeCollection(age.AgeModels[0].name);
plot.addDatasetFromLCAgeModel(plot.age_collections[0].id, age.AgeModels[0]);
plot.calcPosition(core, age);

//console.log(plot.age_collections[0].datasets[0].data_series[1]);
