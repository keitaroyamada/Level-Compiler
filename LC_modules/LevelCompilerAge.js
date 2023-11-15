const lcfnc = require("./lcfnc.js");

const { Project } = require("./Project.js");
const { Hole } = require("./Hole.js");
const { Section } = require("./Section.js");
const { Marker } = require("./Marker.js");
const { Event } = require("./Event.js");
const { Age } = require("./Age.js");
const { AgeSet } = require("./AgeSet.js");
var ss = require("simple-statistics");

class LevelCompilerAge {
  //private properties
  constructor() {
    this.AgeModels = [];
  }

  loadAgeFromCsv(LCCore, age_path) {
    //check dataset
    const num_age_dataset = this.AgeModels.length;
    console.log(age_path);

    //load age model
    const csv_data = lcfnc.readcsv(age_path);
    var fileName = age_path.split(/[/\\]/).pop();
    var match = fileName.match(/^(.*?)\((.*?)\)\.csv$/);

    let model = {};

    if (match) {
      model.name = match[1];
      model.version = match[2];
    } else {
      model.name = fileName.replace(".csv", "");
      model.version = "";
    }

    //reconstruct age model
    const ageDataSet = new AgeSet();
    ageDataSet.name = model.name;
    ageDataSet.version = model.version;

    for (let r = 1; r < csv_data.length; r++) {
      //get age data
      const ageData = new Age();
      ageData.name = csv_data[r][0];
      ageData.age_mid = csv_data[r][7];
      ageData.age_upper_1std = csv_data[r][6];
      ageData.age_lower_1std = csv_data[r][8];
      ageData.gae_raw = null;

      if (csv_data[r][9] == "") {
        ageData.source_type = csv_data[r][9];
      } else {
        ageData.source_type = "general"; //"general", "terrestrial", "marine", "tephra", "orbital", "climate"
      }
      ageData.source_code = csv_data[r][10];
      ageData.unit = csv_data[r][11];
      ageData.note = csv_data[r][12];

      //ids
      ageDataSet.reserved_age_ids.add(r);
      ageData.id = [null, null, null, null, r];
      ageData.order = r;

      //get position
      if (
        csv_data[r][1] !== "" ||
        csv_data[r][2] !== "" ||
        csv_data[r][3] !== ""
      ) {
        //case defined by trinity
        ageData.hole_name = csv_data[r][1]; //hole
        ageData.section_name = lcfnc.zeroPadding(csv_data[r][2]); //section
        ageData.distance = parseFloat(csv_data[r][3]); //distance

        //calc EFD
        if (LCCore.checkModel) {
          const [sectionId, efd] = LCCore.getDepthFromName(
            "event_free_depth",
            ageData.hole_name,
            ageData.section_name,
            ageData.distance
          );
          if (sectionId == null) {
            console.log(
              ageData.hole_name +
                "-" +
                ageData.section_name +
                "-" +
                ageData.distance
            );

            console.log(
              "[" + r + "]: Could not determine the position of " + ageData.name
            );
            continue;
          } else {
            ageData.event_free_depth = efd;
            ageData.section_id = sectionId;
          }
        } else {
          console.log("There is any error in model interpolation.");
        }
      } else if (csv_data[r][4] !== "") {
        //defined by CD
        //check model version
        if (ageDataSet.version == LCCore.projectData.correlation_version) {
          ageData.composite_depth = csv_data[r][4]; //cd
        } else {
          console.log(
            "Correlation Model Versions do not match between Core model and Age model."
          );
          ageData.composite_depth = csv_data[r][4]; //Scheduled to be deleted in the future
        }
      } else if (csv_data[r][5] !== "") {
        //defined by EFD
        //check model version
        if (ageDataSet.version == LCCore.projectData.correlation_version) {
          ageData.event_free_depth = csv_data[r][5]; //efd
        } else {
          console.log(
            "Correlation Model Versions do not match between Core model and Age model."
          );
          ageData.event_free_depth = csv_data[r][5]; //Scheduled to be deleted in the future
        }
      }
      ageDataSet.ages.push(ageData);
    }

    this.AgeModels.push(ageDataSet);
  }
}

module.exports = { LevelCompilerAge };
