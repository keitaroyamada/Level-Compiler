var { LevelCompilerCore } = require("./LevelCompilerCore.js");
var { LevelCompilerAge } = require("./LevelCompilerAge.js");
var { Trinity } = require("./Trinity.js");
const lcfnc = require("./lcfnc.js");
const { Age } = require("./Age.js");
const { LevelCompilerPlot } = require("./LevelCompilerPlot.js");

let model_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG14 LC test model with event(temp).csv";

const age_path =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv";

let model_path1 =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG Correlation model for LC (24 Nov. 2023).csv";

let model_path2 =
  "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[duo]SG14 LC test model with event(temp).csv";

const core = new LevelCompilerCore();
core.loadModelFromCsv(model_path1);
core.loadModelFromCsv(model_path2);
//core.getModelSummary();
//core.connectDuoModel();
//console.log("-----------------h connections ------------------");
//console.log(core.projects[0].holes[3].sections[0].markers[9].h_connection);
//console.log(core.projects[1].holes[0].sections[2].markers[6].h_connection);

core.calcCompositeDepth();
core.calcEventFreeDepth();
//core.checkModel();
console.log("-----------------------");
console.log(core.getDataByIdx(core.search_idx_list[[2, 1, 19, 5]]));

//console.log(core.projects[1].duo_connection);
//console.log(core.projects[0].holes[0].sections[2].markers[15]);
//console.log(core.projects[0].holes[3].sections[2].markers[8]);
//console.log(core.projects[1].holes[0].sections[6].markers[2]);

//core.getModelSummary();
//const age = new LevelCompilerAge();
//age.loadAgeFromCsv(core, age_path);
//console.log(age.AgeModels[0].ages[10]);

//console.log(core.getDepthFromTrinity([t], "drilling_depth"));
/*

const t = new Trinity();
t.hole_name = "E";
t.section_name = "01";
t.distance = 20;


const plot = new LevelCompilerPlot();
plot.addNewAgeCollection(age.AgeModels[0].name);
plot.addDatasetFromLCAgeModel(plot.age_collections[0].id, age.AgeModels[0]);
plot.calcPosition(core, age);
*/
//console.log(plot.age_collections[0].datasets[0].data_series[1]);
