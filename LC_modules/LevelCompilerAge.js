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
    //target
    LCCore.sortModelByOrder();
    const targetProjectId = LCCore.base_project_id;
    let targetProjectIdx = null;
    LCCore.projects.forEach((project, p) => {
      if (project.id[0] == targetProjectId[0]) {
        targetProjectIdx = [p, null, null, null];
      }
    });
    if (targetProjectId == null) {
      console.log("LCAge: [ERROR] There is no such a project.");
      return;
    }

    if(LCCore.projects[targetProjectIdx[0]].model_type == "duo"){
      console.log("LCAge: [ERROR] There is only duo model. Please load base correlation model.");
      return;
    }

    //check dataset
    const num_age_dataset = this.AgeModels.length;
    //console.log("Load age model :" + age_path);

    //check correlation model
    if (LCCore.checkModel()[targetProjectIdx[0]]) {
    } else {
      console.log("LCAge: [ERROR] There is any error in model interpolation.");
      return;
    }

    //load age model
    const csv_data = lcfnc.readcsv(age_path);
    if (csv_data == null) {
      return null;
    }

    var fileName = age_path.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // /^(.*?)\((.*?)\)\.csv$/)

    var match = fileName.match(patern);

    let model = {}; //tempdata

    if (match) {
      //check model type
      if (!match[1].toLowerCase().includes("age")) {
        console.error("LCAge: Registered file is not age model.");
        return;
      }

      if (!match[1].toLowerCase().includes("age") && match[1] !== "") {
        console.log("LCAge: There is no identifier for age model, but continue.");
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

      if (csv_data[r][9] == "") {
        ageData.source_type = "general"; //"general", "terrestrial", "marine", "tephra", "orbital", "climate"
      } else {
        ageData.source_type = csv_data[r][9];
      }
      ageData.source_code = csv_data[r][10];
      ageData.unit = csv_data[r][11];
      ageData.note = csv_data[r][12];

      //ids
      ageDataSet.reserved_age_ids.push(r);
      ageData.id = r;
      ageData.order = r;

      //get position
      if (csv_data[r][1] !== "" || csv_data[r][2] !== "" || csv_data[r][3] !== "") {
        //case defined by trinity--------------------------------------------------------
        ageData.original_depth_type = "trinity";
        ageData.trinityData.name = csv_data[r][0];
        ageData.trinityData.hole_name = lcfnc.zeroPadding(csv_data[r][1]); //hole
        ageData.trinityData.section_name = lcfnc.zeroPadding(csv_data[r][2]); //section
        ageData.trinityData.distance = parseFloat(csv_data[r][3]); //distance

        //calc EFD
        const [[sectionId, efd, rank]] = LCCore.getDepthFromTrinity(targetProjectId, [ageData.trinityData],"event_free_depth");

        if (isNaN(efd)) {
          console.log(csv_data[r][0] + ":" + csv_data[r][1] + "-" + csv_data[r][2] + "-" + csv_data[r][3] + "cm EFD:" + efd);
        }

        if (sectionId == null) {
          console.log("[" + r + "]: Could not determine the position of " + ageData.trinityData.name);
          continue;
        } else {
          ageData.event_free_depth = efd;
          ageData.section_id = sectionId;
        }
      } else if (csv_data[r][4] !== "") {
        //defined by CD-----------------------------------------------------------------
        //check model version
        //console.log(ageData.name + ": The age data is defined by composite depth.");
        ageData.original_depth_type = "composite_depth";
        if (ageDataSet.version == LCCore.projects[targetProjectIdx[0]].correlation_version) {
          ageData.composite_depth = csv_data[r][4]; //cd

          //convert CD => EFD
        } else {
          //console.log("Correlation Model Versions do not match between Core model and Age model.");
          //Scheduled to be deleted in the future
          ageData.composite_depth = parseFloat(csv_data[r][4]);
          //convert CD => EFD
          const efdval = LCCore.getEFDfromCD(ageData.composite_depth);
          if (efdval !== NaN) {
            ageData.event_free_depth = efdval;
          } else {
            console.log("Comsposite depth is out of model definition. :" + csv_data[r][0]);
          }
          //
        }
      } else if (csv_data[r][5] !== "") {
        //defined by EFD---------------------------------------------------------------
        //check model version
        //console.log();
        ageData.original_depth_type = "event_free_depth";
        if (ageDataSet.version == LCCore.projects[targetProjectIdx[0]].correlation_version) {
          ageData.event_free_depth = csv_data[r][5]; //efd
        } else {
          //console.log("Correlation Model Versions do not match between Core model and Age model." );
          ageData.event_free_depth = csv_data[r][5]; //Scheduled to be deleted in the future
        }
      }else{
        console.log("LCAge: [" + model.name +"] '"+ ageData.name + "' is not defined any depth.");
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
      let name = model.name;
      let num_error_ages = 0;
      let num_error_ages_u = 0;
      let num_error_ages_l = 0;
      let num_error_efds = 0;
      model.ages.forEach((ageData) => {
        if (isNaN(ageData.event_free_depth) || ageData.event_free_depth == null || ageData.event_free_depth == undefined) {
          num_error_efds += 1;
          //console.log(ageData);
        }
        if (isNaN(ageData.age_mid) || ageData.age_mid == null || ageData.age_mid == undefined) {
          num_error_ages += 1;
        }
        if (isNaN(ageData.age_upper_1std) || ageData.age_upper_1std == null || ageData.age_upper_1std == undefined) {
          num_error_ages_u += 1;
        }
        if (isNaN(ageData.age_lower_1std) || ageData.age_lower_1std == null || ageData.age_lower_1std == undefined) {
          num_error_ages_l += 1;
        }
      });

      console.log("LCAge: [" + name + "] Total Age Model Error: EFD:" + num_error_efds + ", Age: [" +  num_error_ages + "," +  num_error_ages_u +  "," + num_error_ages_l + "]" );
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
    let output = {age: { type: null, mid: null, upper: null, lower: null }, age_idx:null};
    let interpolatedAge = null;

    if(method == "linear"){
      //get access index
      let targetAgeModelIdx = null;
      this.AgeModels.forEach((a, n) => {
        if (targetAgeModelId == a.id) {
          targetAgeModelIdx = n;
        }
      });
      if (targetAgeModelIdx == null) {
        return output;
      }else{
        output.age_idx = targetAgeModelIdx;
      }

      if (efd == null) {
        return output;
      }

      //get upper/lower age data
      let upperData = this.AgeModels[targetAgeModelIdx].ages[0];
      let lowerData = this.AgeModels[targetAgeModelIdx].ages[this.AgeModels[targetAgeModelIdx].ages.length - 1];

      this.AgeModels[targetAgeModelIdx].ages.forEach((ageData, a) => {
        if (ageData.event_free_depth <= efd && upperData.event_free_depth < ageData.event_free_depth) {
          //if above
          upperData = ageData;
        }
        if (ageData.event_free_depth >= efd && lowerData.event_free_depth > ageData.event_free_depth) {
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
      output.age = interpolatedAge;
    }

    return output;
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
    let output = {efd: {type: null, mid: null, upper: null, lower: null}, age_idx:null};
    const targetAgeModelId = this.selected_id;
    //get access index
    let targetAgeModelIdx = null;
    this.AgeModels.forEach((a, n) => {
      if (targetAgeModelId == a.id) {
        targetAgeModelIdx = n;
      }
    });

    if (targetAgeModelIdx == null) {
      return output;
    }else{
      output.age_idx = targetAgeModelIdx;
    }
    if (age == null) {
      return output;
    }

    //get upper/lower age data
    let upperData = this.AgeModels[targetAgeModelIdx].ages[0];
    let lowerData = this.AgeModels[targetAgeModelIdx].ages[this.AgeModels[targetAgeModelIdx].ages.length - 1];

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
    output.efd = interpolatedEFD;
    return output;
  }
}

module.exports = { LevelCompilerAge };
