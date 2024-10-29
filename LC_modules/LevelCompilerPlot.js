const lcfnc = require("./lcfnc.js");

const { Project } = require("./Project.js");
const { Hole } = require("./Hole.js");
const { Section } = require("./Section.js");
const { Marker } = require("./Marker.js");
const { Trinity } = require("./Trinity.js");
const { PlotCollection } = require("./PlotCollection.js");
const { PlotDataset } = require("./PlotDataset.js");
const { PlotData } = require("./PlotData.js");

var ss = require("simple-statistics");

class LevelCompilerPlot {
  constructor() {
    this.age_collections = []; //dataRepository > dataCollection > dataset > data  [LCplot.age_collections[age_plot_idx].datasets[0].data_series;]
    this.age_selected_id = null;

    this.data_collections = []; //dataRepository > dataCollection > dataset > data
    this.data_selected_id = null;
  }

  //from new csv

  //methods
  addNewAgeCollection(name, age_id) {
    const newCollection = new PlotCollection();
    newCollection.id = age_id;
    newCollection.name = name;
    this.age_collections.push(newCollection);
    this.age_selected_id = age_id;
  }

  addAgesetFromLCAgeModel(age_collectionId, LCAgeModel) {
    //get collection idx
    let targetIdx = null;
    this.age_collections.forEach((col, c) => {
      if (col.id == age_collectionId) {
        targetIdx = c;
      }
    });

    //add age dataset
    const newDataset = new PlotDataset();

    for (let a = 0; a < LCAgeModel.ages.length; a++) {
      //make new dataset
      const newData = new PlotData();

      //input data
      newData.id                  = LCAgeModel.ages[a].id;
      newData.name                = LCAgeModel.ages[a].name;
      newData.original_depth_type = LCAgeModel.ages[a].original_depth_type;
      newData.trinity             = LCAgeModel.ages[a].trinityData;
      newData.drilling_depth      = null;
      newData.composite_depth     = LCAgeModel.ages[a].composite_depth;
      newData.event_free_depth    = LCAgeModel.ages[a].event_free_depth;
      newData.age                 = LCAgeModel.ages[a].age_mid;
      newData.data                = LCAgeModel.ages[a].age_mid;
      newData.source_type         = LCAgeModel.ages[a].source_type;
      newData.source_code         = LCAgeModel.ages[a].source_code;
      newData.unit                = LCAgeModel.ages[a].unit;
      newData.description         = LCAgeModel.ages[a].note;

      //add

      newDataset.data_series.push(newData);
    }

    this.age_collections[targetIdx].datasets.push(newDataset);
  }
  addDatasetFromLCAgeModel(age_collectionId, LCCore, LCAge) {
    //get collection idx
    let targetIdx = null;
    this.age_collections.forEach((col, c) => {
      if (col.id == age_collectionId) {
        targetIdx = c;
      }
    });

    //add age dataset
    const newDataset = new PlotDataset();

    for (let a = 0; a < LCAgeModel.ages.length; a++) {
      //make new dataset
      const newData = new PlotData();

      //input data
      newData.id                  = LCAgeModel.ages[a].id;
      newData.name                = LCAgeModel.ages[a].name;
      newData.original_depth_type = LCAgeModel.ages[a].original_depth_type;
      newData.trinity             = LCAgeModel.ages[a].trinityData;
      newData.drilling_depth      = null;
      newData.composite_depth     = LCAgeModel.ages[a].composite_depth;
      newData.event_free_depth    = LCAgeModel.ages[a].event_free_depth;
      newData.age                 = LCAgeModel.ages[a].age_mid;
      newData.data                = LCAgeModel.ages[a].age_mid;
      newData.source_type         = LCAgeModel.ages[a].source_type;
      newData.source_code         = LCAgeModel.ages[a].source_code;
      newData.unit                = LCAgeModel.ages[a].unit;
      newData.description         = LCAgeModel.ages[a].note;

      //add

      newDataset.data_series.push(newData);
    }

    this.age_collections[targetIdx].datasets.push(newDataset);
  }
  calcAgeCollectionPosition(LCCore, LCAge) {
    const targetProjectId = LCCore.base_project_id;

    for (let c = 0; c < this.age_collections.length; c++) {
      const collection = this.age_collections[c];
      for (let d = 0; d < collection.datasets.length; d++) {
        const dataset = collection.datasets[d];
        for (let s = 0; s < dataset.data_series.length; s++) {
          const data = dataset.data_series[s];
          const calcType = data.original_depth_type;

          if (calcType == "trinity") {
            //calc
            const cd = LCCore.getDepthFromTrinity(
              targetProjectId,
              [data.trinity],
              "composite_depth"
            );
            const efd = LCCore.getDepthFromTrinity(
              targetProjectId,
              [data.trinity],
              "event_free_depth"
            );
            const dd = LCCore.getDepthFromTrinity(
              targetProjectId,
              [data.trinity],
              "drilling_depth"
            );
            const age = LCAge.getAgeFromEFD(efd[0][1], "linear");

            //add
            this.age_collections[c].datasets[d].data_series[s].drilling_depth =
              dd[0][1];
            this.age_collections[c].datasets[d].data_series[s].composite_depth =
              cd[0][1];
            this.age_collections[c].datasets[d].data_series[
              s
            ].event_free_depth = efd[0][1];
            this.age_collections[c].datasets[d].data_series[s].age = age.mid;
          } else if (calcType == "composite_depth") {
            //calc
            const efd = LCCore.getEFDfromCD(
              targetProjectId,
              data.composite_depth
            );
            const age = LCAge.getAgeFromEFD(efd, "linear");

            //add
            this.age_collections[c].datasets[d].data_series[
              s
            ].event_free_depth = efd;
            this.age_collections[c].datasets[d].data_series[s].age = age.mid;
          } else if (calcType == "event_free_depth") {
            //calc
            const efd =
              this.age_collections[c].datasets[d].data_series[s]
                .event_free_depth;
            const cd = LCCore.getCDfromEFD(targetProjectId, efd); //paseudo
            const age = LCAge.getAgefromEFD(efd);

            //add
            this.age_collections[c].datasets[d].data_series[s].composite_depth =
              cd;
            this.age_collections[c].datasets[d].data_series[s].age = age.mid;
          } else if (calcType == "age") {
            //calc
            const age = this.age_collections[c].datasets[d].data_series[s].age;
            const efd = LCAge.getEFDFromAge(age, "linear");
            const cd = LCCore.getCDfromEFD(targetProjectId, efd.mid); //paseudo

            //add
            this.age_collections[c].datasets[d].data_series[
              s
            ].event_free_depth = efd.mid;
            this.age_collections[c].datasets[d].data_series[s].composite_depth =
              cd;
          } else {
            continue;
          }
        }
      }
    }
  }
}

module.exports = { LevelCompilerPlot };
