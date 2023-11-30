const lcfnc = require("./lcfnc.js");

const { Project } = require("./Project.js");
const { Hole } = require("./Hole.js");
const { Section } = require("./Section.js");
const { Marker } = require("./Marker.js");
const { Trinity } = require("./Trinity.js");
const { PlotDataGroup } = require("./PlotDataGroup.js");
const { PlotDataSeries } = require("./PlotCollection.js");
const { PlotDataum } = require("./PlotDataset.js");
var ss = require("simple-statistics");

class LevelCompilerPlot {
  constructor() {
    this.collections = []; //dataRepository > dataCollection > data
  }

  //from new csv

  //methods
  addCollection(
    collectionName,
    nameList,
    depthDataSet, //{type, data}
    depthTypeList,
    trimedDataList,
    interpolateMethod
  ) {
    //check input
    if (!LCCore || !LCAge) {
      return;
    }

    //make new data group
    const newDataGroup = new PlotDataGroup();
    newDataGroup.id = this.dataGroups.length + 1;
    newDataGroup.name = groupName;

    //make data series
    for (let r = 0; r < depthDataList.length; r++) {
      let output = [];
      if (depthTypeList[r] == "trinity") {
        const dd = LCCore.getDepthFromTrinity(
          depthDataList[r],
          "drilling_depth"
        );
        const cd = LCCore.getDepthFromTrinity(
          depthDataList[r],
          "composite_depth"
        );
        const efd = LCCore.getDepthFromTrinity(
          depthDataList[r],
          "event_free_depth"
        );
        const age = LCAge.getAgeFromEFD(efd, interpolateMethod);

        const newDataSeries = new PlotDataSeries();
        newDataSeries.id = newDataGroup.seriesSet.length + 1;
        newDataSeries.name = trimedDataList[r][0];

        for (let c = 1; c < trimedDataList[r].length; c++) {
          newDataSeries.dataSet.push({
            name: nameList[r],
            age: age,
            composite_depth: cd,
            event_free_depth: efd,
            drilling_depth: dd,
            value: trimedDataList[r][c],
          });
        }

        [nameList[r], dd, cd, efd, age];

        for (let i = 0; i < data.length; i++) {
          output.push([data[i].name]);
        }
      } else if (depthTypeList[r] == "composite_depth") {
      } else if (depthTypeList[r] == "event_free_depth") {
      }
    }
  }

  makeSampleFormat(depthData, position, calcType) {
    //data, [trinity, data1, ] or [name, data1, data2]
    //position, []
    //calcType: [trinity composite_depth event_free_depth age]
  }
}

module.exports = { LevelCompilerPlot };
