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
    this.selected_id = null;
  }

  loadAgeFromCsv(LCCore, age_path) {
    //check dataset
    const num_age_dataset = this.AgeModels.length;
    //console.log("Load age model :" + age_path);

    //check correlation model
    if (LCCore.checkModel()) {
    } else {
      console.log("There is any error in model interpolation.");
      return;
    }
    LCCore.sortModel();

    //load age model
    const csv_data = lcfnc.readcsv(age_path);
    if (csv_data == null) {
      return null;
    }

    var fileName = age_path.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // /^(.*?)\((.*?)\)\.csv$/)

    var match = fileName.match(patern);

    let model = {};

    if (match) {
      //check model type
      if (!match[1].toLowerCase().includes("age")) {
        console.error("Mounted file is not age model.");
        this.model_data = null;
        return;
      } else if (match[1] !== "") {
        console.log("There is no identifier for age model.");
      }

      model.name = match[2];
      model.version = match[3];
    } else {
      model.name = fileName.replace(".csv", "");
      model.version = "";
    }

    //reconstruct age model
    let ageDataSet = new AgeSet();
    ageDataSet.id = num_age_dataset + 1;
    ageDataSet.name = model.name;
    ageDataSet.version = model.version;
    this.selected_id = num_age_dataset + 1;

    for (let r = 1; r < csv_data.length; r++) {
      //get age data
      const ageData = new Age();
      ageData.name = csv_data[r][0];
      ageData.age_mid = parseFloat(csv_data[r][7]);
      ageData.age_upper_1std = parseFloat(csv_data[r][6]);
      ageData.age_lower_1std = parseFloat(csv_data[r][8]);
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
      ageDataSet.reserved_age_ids.push(r);
      ageData.id = r;
      ageData.order = r;

      //get position
      if (
        csv_data[r][1] !== "" ||
        csv_data[r][2] !== "" ||
        csv_data[r][3] !== ""
      ) {
        //case defined by trinity--------------------------------------------------------
        ageData.trinityData.name = csv_data[r][0];
        ageData.trinityData.hole_name = lcfnc.zeroPadding(csv_data[r][1]); //hole
        ageData.trinityData.section_name = lcfnc.zeroPadding(csv_data[r][2]); //section
        ageData.trinityData.distance = parseFloat(csv_data[r][3]); //distance

        //calc EFD
        const [[sectionId, efd]] = LCCore.getDepthFromTrinity(
          [ageData.trinityData],
          "event_free_depth"
        );

        if (isNaN(efd)) {
          console.log(
            csv_data[r][0] +
              ":" +
              csv_data[r][1] +
              "-" +
              csv_data[r][2] +
              "-" +
              csv_data[r][3] +
              "cm EFD:" +
              efd
          );
        }

        if (sectionId == null) {
          console.log(
            "[" +
              r +
              "]: Could not determine the position of " +
              ageData.trinityData.name
          );
          continue;
        } else {
          ageData.event_free_depth = efd;
          ageData.section_id = sectionId;
        }
      } else if (csv_data[r][4] !== "") {
        //defined by CD-----------------------------------------------------------------
        //check model version
        if (ageDataSet.version == LCCore.projectData.correlation_version) {
          ageData.composite_depth = csv_data[r][4]; //cd

          //convert CD => EFD
        } else {
          console.log(
            "Correlation Model Versions do not match between Core model and Age model."
          );
          //Scheduled to be deleted in the future
          ageData.composite_depth = csv_data[r][4];
          //convert CD => EFD
          const efdval = LCCore.getEFDfromCD(ageData.composite_depth);
          if (efdval !== NaN) {
            ageData.event_free_depth = efdval;
          } else {
            console.log(
              "Comsposite depth is out of model definition. :" + csv_data[r][0]
            );
          }
          //
        }
      } else if (csv_data[r][5] !== "") {
        //defined by EFD---------------------------------------------------------------
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
  sortAges() {
    //sort age model by efd
    for (let m = 0; m < this.AgeModels.length; m++) {
      this.AgeModels[m].ages.sort((a, b) =>
        a.event_free_depth < b.event_free_depth ? -1 : 1
      );

      for (let a = 0; a < this.AgeModels[m].ages.length; a++) {
        console.log(this.AgeModels[m].ages[a].event_free_depth);
        this.AgeModels[m].ages[a].order = a;
      }
    }
    console.log("Age model sorted.");
  }
  checkAges() {
    if (this.AgeModels.length == 0) {
      console.log("There is no age model.");
    }
    this.AgeModels.forEach((model) => {
      let num_error_ages = 0;
      let num_error_ages_u = 0;
      let num_error_ages_l = 0;
      let num_error_efds = 0;
      model.ages.forEach((ageData) => {
        if (
          isNaN(ageData.event_free_depth) ||
          ageData.event_free_depth == null
        ) {
          num_error_efds += 1;
        }
        if (isNaN(ageData.age_mid) || ageData.age_mid == null) {
          num_error_ages += 1;
        }
        if (isNaN(ageData.age_upper_1std) || ageData.age_upper_1std == null) {
          num_error_ages_u += 1;
        }
        if (isNaN(ageData.age_lower_1std) || ageData.age_lower_1std == null) {
          num_error_ages_l += 1;
        }
      });

      console.log(
        "Total Age Model Error: EFD:" +
          num_error_efds +
          ", Age: [" +
          num_error_ages +
          "," +
          num_error_ages_u +
          "," +
          num_error_ages_l +
          "]"
      );
    });
  }
  addAge(ageData) {
    const targetAgeModelId = this.selected_id;
    //get access index
    let targetAgeModelIdx = null;
    this.AgeModels.forEach((a, n) => {
      if (targetAgeModelId == a.id) {
        targetAgeModelIdx = n;
      }
    });

    //update unique id
    const newId = lcfnc.getUniqueId(
      this.AgeModels[targetAgeModelIdx].reserved_age_ids
    );
    ageData.id = newId;

    //add
    this.AgeModels[targetAgeModelIdx].ages.push(ageData);
  }
  removeAge(targetAgeDataId) {
    const targetAgeModelId = this.selected_id;
    //get access index
    let targetAgeModelIdx = null;
    this.AgeModels.forEach((a, n) => {
      if (targetAgeModelId == a.id) {
        targetAgeModelIdx = n;
      }
    });

    //remove
    this.AgeModels[targetAgeModelIdx].ages = this.AgeModels[
      targetAgeModelIdx
    ].ages.filter((item) => item.id !== targetAgeDataId);
  }
  getAgeFromEFD(efd, method) {
    const targetAgeModelId = this.selected_id;
    //get access index
    let targetAgeModelIdx = null;
    this.AgeModels.forEach((a, n) => {
      if (targetAgeModelId == a.id) {
        targetAgeModelIdx = n;
      }
    });
    if (targetAgeModelIdx == null) {
      return null;
    }

    if (efd == null) {
      return { type: null, mid: null, upper: null, lower: null };
    }

    //console.log(targetAgeModelIdx + ":" + this.AgeModels[targetAgeModelIdx]);
    //get upper/lower age data
    let upperData = this.AgeModels[targetAgeModelIdx].ages[0];
    let lowerData =
      this.AgeModels[targetAgeModelIdx].ages[
        this.AgeModels[targetAgeModelIdx].ages.length - 1
      ];

    this.AgeModels[targetAgeModelIdx].ages.forEach((ageData, a) => {
      if (
        ageData.event_free_depth <= efd &&
        upperData.event_free_depth < ageData.event_free_depth
      ) {
        //if above
        upperData = ageData;
      }
      if (
        ageData.event_free_depth >= efd &&
        lowerData.event_free_depth > ageData.event_free_depth
      ) {
        //if below
        lowerData = ageData;
      }
    });

    //apply interpolation
    const interpolatedAge = this.interpolate(
      upperData,
      lowerData,
      "age",
      efd,
      method
    );

    return interpolatedAge;
  }
  //sub functions
  interpolate(upperAgeData, lowerAgeData, target, efd, method) {
    if (method == "linear") {
      //simply interpolate by linear method
      //make function
      const interp = ([d1, d3], [a1, a3], d2) => {
        let a2 = null;
        if (d3 - d1 == 0) {
          a2 = a1;
        } else {
          a2 = a1 + ((d2 - d1) / (d3 - d1)) * (a3 - a1);
        }
        return a2;
      };

      //get data
      const u_efd = parseFloat(upperAgeData.event_free_depth);
      const u_age = parseFloat(upperAgeData.age_mid);
      const u_age_u = u_age - parseFloat(upperAgeData.age_upper_1std);
      const u_age_l = u_age + parseFloat(upperAgeData.age_lower_1std);

      const l_efd = parseFloat(lowerAgeData.event_free_depth);
      const l_age = parseFloat(lowerAgeData.age_mid);
      const l_age_u = l_age - parseFloat(lowerAgeData.age_upper_1std);
      const l_age_l = l_age + parseFloat(lowerAgeData.age_lower_1std);

      //console.log(u_efd + "/" + l_efd + "/" + u_age + "/" + l_age + "/" + efd);
      //calc
      let interp_mid = null;
      let interp_upper = null;
      let interp_lower = null;
      if (target == "age") {
        interp_mid = interp([u_efd, l_efd], [u_age, l_age], efd);
        interp_upper = interp([u_efd, l_efd], [u_age_u, l_age_u], efd);
        interp_lower = interp([u_efd, l_efd], [u_age_l, l_age_l], efd);
      } else if (target == "efd") {
        interp_mid = interp([u_age, l_age], [u_efd, l_efd], efd);
        interp_upper = interp([u_age_u, l_age_u], [u_efd, l_efd], efd);
        interp_lower = interp([u_age_l, l_age_l], [u_efd, l_efd], efd);
      }

      return {
        type: target,
        mid: interp_mid,
        upper: interp_upper,
        lower: interp_lower,
      };
    } else if (method == "MC") {
      console.log("under construction");
      return {
        type: target,
        mid: null,
        upper: null,
        lower: null,
      };
    }
  }
  getEFDFromAge(age, method) {
    const targetAgeModelId = this.selected_id;
    //get access index
    let targetAgeModelIdx = null;
    this.AgeModels.forEach((a, n) => {
      if (targetAgeModelId == a.id) {
        targetAgeModelIdx = n;
      }
    });

    if (targetAgeModelIdx == null) {
      return {
        type: null,
        mid: null,
        upper: null,
        lower: null,
      };
    }
    if (age == null) {
      return {
        type: target,
        mid: null,
        upper: null,
        lower: null,
      };
    }

    //console.log(targetAgeModelIdx + ":" + this.AgeModels[targetAgeModelIdx]);
    //get upper/lower age data
    let upperData = this.AgeModels[targetAgeModelIdx].ages[0];
    let lowerData =
      this.AgeModels[targetAgeModelIdx].ages[
        this.AgeModels[targetAgeModelIdx].ages.length - 1
      ];

    this.AgeModels[targetAgeModelIdx].ages.forEach((ageData, a) => {
      if (ageData.age_mid <= age && upperData.age_mid < ageData.age_mid) {
        //if above
        upperData = ageData;
      }
      if (ageData.age_mid >= age && lowerData.age_mid > ageData.age_mid) {
        //if below
        lowerData = ageData;
      }
    });

    //apply interpolation
    const interpolatedEFD = this.interpolate(
      upperData,
      lowerData,
      "efd",
      age,
      method
    );
    return interpolatedEFD;
  }
}

module.exports = { LevelCompilerAge };
