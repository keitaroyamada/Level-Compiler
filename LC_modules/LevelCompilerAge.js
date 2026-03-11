const lcfnc = require("./lcfnc.js");

const { Project } = require("./Project.js");
const { Hole } = require("./Hole.js");
const { Section } = require("./Section.js");
const { Marker } = require("./Marker.js");
const { Event } = require("./Event.js");
const { Age } = require("./Age.js");
const { AgeSet } = require("./AgeSet.js");

class LevelCompilerAge {
  //private properties
  constructor() {
    this.AgeModels = [];
    this.selected_id = null;
    this.use_unreliable_data = false;
    this.unreliable_ids=[];
  }

  loadAgeFromCsv(LCCore, age_path, type="LC") {
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
      return "There is any error in model interpolation.";
    }

    //load age model
    const csv_data = lcfnc.readcsv(age_path);
    if (csv_data == null) {
      return "There is no age model csv.";
    }

    var fileName = age_path.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // /^(.*?)\((.*?)\)\.csv$/)

    var match = fileName.match(patern);

    let model = {}; //tempdata

    if (match) {
      //check model type
      if (type == "LC"){

        if (!match[1].toLowerCase().includes("age")) {
          console.error("LCAge: Registered file is not age model.");
          return "LCAge: Registered file is not age model.";
        }
      }else{
         if (!match[1].toLowerCase().includes("age") && match[1] !== "") {
          console.log("LCAge: There is no identifier for age model, but continue.");
        }
      }

      model.name = match[2];
      model.version = match[3];
    } else {
      model.name = fileName.replace(".csv", "");
      model.version = "";
    }

    //reconstruct age model
    let ageDataSet     = new AgeSet();
    ageDataSet.id      = num_age_dataset + 1;
    ageDataSet.name    = model.name;    
    ageDataSet.version = model.version;
    this.selected_id   = num_age_dataset + 1;

    //get index
    let idxAgeName = 0;
    let idxHoleName = 1;
    let idxSectionName = 2;
    let idxDistance = 3;
    let idxCD = 4;
    let idxEFD= 5;
    let idxAgeUpper1st = 6;
    let idxAgeMid = 7;
    let idxAgeLower1st = 8;
    let idxSourceType = 9;
    let idxSourceCode = 10;
    let idxUnit = 11;
    let idxNote = 12;
    
    if(type == "LF"){
      idxAgeName = 0;
      idxHoleName = 1;
      idxSectionName = 2;
      idxDistance = 3;
      idxCD = 4;
      idxEFD= null;
      idxAgeUpper1st = 5;
      idxAgeMid = 6;
      idxAgeLower1st = 7;
      idxSourceType = null;
      idxSourceCode = 8;
      idxUnit = 9;
      idxNote = 10;
    }

    //set unit
    const modelUnit = csv_data[0][idxAgeMid].slice(csv_data[0][idxAgeMid].indexOf("(")+1, csv_data[0][idxAgeMid].lastIndexOf(")"));   

    for (let r = 1; r < csv_data.length; r++) {
      //get age data
      const ageData = new Age();
      ageData.name = csv_data[r][idxAgeName];
      ageData.age_mid = parseFloat(csv_data[r][idxAgeMid]);
      ageData.age_upper_1std = parseFloat(csv_data[r][idxAgeUpper1st]);
      ageData.age_lower_1std = parseFloat(csv_data[r][idxAgeLower1st]);      

      if (csv_data[r][9] == "") {
        ageData.source_type = "general"; //"general", "terrestrial", "marine", "tephra", "orbital", "climate"
      } else {
        ageData.source_type = idxSourceType ? csv_data[r][idxSourceType] : null;
      }
      ageData.source_code = csv_data[r][idxSourceCode];
      ageData.unit = csv_data[r][idxUnit];
      ageData.note = csv_data[r][idxNote];

      //ids
      ageDataSet.reserved_age_ids.push(r);
      ageData.id = r;
      ageData.order = r;

      //get position
      if (
        (type=="LC" && csv_data[r][idxHoleName] !== "" )   || (type=="LF" && csv_data[r][idxHoleName] !== "9999") &&
        (type=="LC" && csv_data[r][idxSectionName] !== "") || (type=="LF" && csv_data[r][idxSectionName] !== "9999") && 
        (type=="LC" && csv_data[r][idxDistance] !== "")    || (type=="LF" && csv_data[r][idxDistance] !== "9999")
      ) {
        //case defined by trinity--------------------------------------------------------
        ageData.original_depth_type      = "trinity";
        ageData.trinityData.name         = csv_data[r][idxAgeName];
        ageData.trinityData.hole_name    = lcfnc.zeroPadding(csv_data[r][idxHoleName]); //hole
        ageData.trinityData.section_name = lcfnc.zeroPadding(csv_data[r][idxSectionName]); //section
        ageData.trinityData.distance     = parseFloat(csv_data[r][idxDistance]); //distance

        //calc idex
        let ageDataIdx = LCCore.getIdxFromTrinity(targetProjectId, [ageData.trinityData.hole_name, ageData.trinityData.section_name, ageData.trinityData.distance]);
        ageData.pidx = ageDataIdx[0];
        ageData.hidx = ageDataIdx[1];
        ageData.sidx = ageDataIdx[2];

        //calc EFD
        const [[sectionId, efd, rank]] = LCCore.getDepthFromTrinity(targetProjectId, [ageData.trinityData],"event_free_depth");
        if (isNaN(efd)) {
          console.log(csv_data[r][idxAgeName] + ":" + csv_data[r][idxHoleName] + "-" + csv_data[r][idxSectionName] + "-" + csv_data[r][idxDistance] + "cm EFD:" + efd);
        }

        if (sectionId == null) {
          console.log("[" + r + "]: Could not determine the position of " + ageData.trinityData.name);
          continue;
        } else {
          ageData.event_free_depth = efd;
          ageData.section_id = sectionId;
        }
      } else if ((type=="LC" && csv_data[r][idxCD] !== "") || (type=="LF" && csv_data[r][idxCD] !== "9999")) {
        //defined by CD-----------------------------------------------------------------
        //check model version
        //console.log(ageData.name + ": The age data is defined by composite depth.");
        ageData.original_depth_type = "composite_depth";
        if (ageDataSet.version == LCCore.projects[targetProjectIdx[0]].correlation_version) {
          ageData.composite_depth = csv_data[r][idxCD]; //cd

          //convert CD => EFD
        } else {
          //console.log("Correlation Model Versions do not match between Core model and Age model.");
          //Scheduled to be deleted in the future
          ageData.composite_depth = parseFloat(csv_data[r][idxCD]);
          //convert CD => EFD
          const efdval = LCCore.getEFDfromCD(ageData.composite_depth);
          if (efdval !== NaN) {
            ageData.event_free_depth = efdval;
          } else {
            console.log("Comsposite depth is out of model definition. :" + csv_data[r][idxAgeName]);
          }
          //
        }
      } else if ((type=="LC" && idxEFD && csv_data[r][idxEFD] !== "")) {
        //defined by EFD---------------------------------------------------------------
        //check model version
        //console.log();
        ageData.original_depth_type = "event_free_depth";
        if (ageDataSet.version == LCCore.projects[targetProjectIdx[0]].correlation_version) {
          ageData.event_free_depth = csv_data[r][idxEFD]; //efd
        } else {
          //console.log("Correlation Model Versions do not match between Core model and Age model." );
          ageData.event_free_depth = csv_data[r][idxEFD]; //Scheduled to be deleted in the future
        }
      }else{
        console.log("LCAge: [" + model.name +"] '"+ ageData.name + "' is not defined any depth.");
      }

      //===== age convert ==============================================
      // Check if the unit requires conversion
      const dataUnit = ageData.unit;
      if (dataUnit === "calBP") {
        // pass-through
      } else if (dataUnit === "AD") {
        ageData.age_mid = 1950 - ageData.age_mid;
      } else if (dataUnit === "BC") {
        ageData.age_mid = 1950 - (1 - ageData.age_mid);
      }

      //===== age convert ==============================================

      //submit
      ageDataSet.ages.push(ageData);
    }

    if(ageDataSet.ages.length<2){
      return "A model requires at least two ages."
    }

    this.AgeModels.push(ageDataSet);
    this.sortAges();
    //this.checkAges();
    return true
  }
  getModelData(){
    let model = null;
    this.AgeModels.forEach(ml=>{
      if(ml.id == this.selected_id){
        model = ml;
      }
    })
    return model
  }
  sortAges() {
    //sort age model by efd
    for (let m = 0; m < this.AgeModels.length; m++) {
      this.AgeModels[m].ages.sort((a, b) =>
        a.event_free_depth < b.event_free_depth ? -1 : 1
      );

      for (let a = 0; a < this.AgeModels[m].ages.length; a++) {
        //console.log(this.AgeModels[m].ages[a].event_free_depth);
        this.AgeModels[m].ages[a].order = a;
      }
    }
    console.log("LCAge: Age model sorted.");
  }
  checkAges() {
    if (this.AgeModels.length == 0) {
      console.log("There is no age model.");
    }

    this.unreliable_ids=[];
    let total_errors = 0;
    let total_contradiction = 0;
    this.AgeModels.forEach((model) => {
      let name              = model.name;
      let num_total_ages    = 0;
      let num_error_ages    = 0;
      let num_error_ages_u  = 0;
      let num_error_ages_l  = 0;
      let num_error_efds    = 0;
      let num_contradiction = 0;

      for(let i=0; i<model.ages.length; i++){
        const ageData = model.ages[i];
        num_total_ages ++;
        
        if (!Number.isFinite(ageData.event_free_depth)) {
          num_error_efds += 1;
          //console.log(ageData);
        }

        if (!Number.isFinite(ageData.age_mid)) {
          num_error_ages += 1;
        }
        
        //check Contradiction
        if(i<model.ages.length-1 && Number.isFinite(ageData.event_free_depth) && Number.isFinite(ageData.age_mid) && Number.isFinite(model.ages[i+1].age_mid)){
          if(ageData.age_mid > model.ages[i+1].age_mid){
            num_contradiction += 1;
            model.ages[i+1].reliable = false;
            this.unreliable_ids.push(model.ages[i+1].id);

            if(this.use_unreliable_data===true){
              model.ages[i+1].enable = true;
            }else{
              model.ages[i+1].enable = false;
            }
            //console.log("LCAge: Contradiction is detected between: ",model.ages[i+1].enable,"==", model.ages[i+1].reliable);
            console.log("LCAge: Contradiction is detected between: ",ageData.name,"(",ageData.age_mid,")==", model.ages[i+1].name,"(",model.ages[i+1].age_mid,")");
          }else{
            model.ages[i+1].enable = true;
            model.ages[i+1].reliable = true;
          }
        }
        
        if (isNaN(ageData.age_upper_1std) || ageData.age_upper_1std == null || ageData.age_upper_1std == undefined) {
          num_error_ages_u += 1;
        }
        if (isNaN(ageData.age_lower_1std) || ageData.age_lower_1std == null || ageData.age_lower_1std == undefined) {
          num_error_ages_l += 1;
        }
      }

      total_errors += num_error_ages; 
      total_contradiction += num_contradiction;
      console.log("LCAge: [" , name , "(N=",num_total_ages,")] Total Age Model Error: EFD:" , num_error_efds , ", Age: [" ,  num_error_ages , ",(" ,  num_error_ages_u ,  "/" , num_error_ages_l , "), Contradiction:",num_contradiction,"]" );
    });

    if(total_errors>0){
      console.log("LCAge: Age model contains ",total_errors," of incorrect values.")
    }
    if(total_contradiction>0){
      console.log("LCAge: Age model contains ",total_contradiction," of contradictions.")
    }
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
    const newId = Math.max.apply(null, this.AgeModels[targetAgeModelIdx].reserved_age_ids) + 1

    ageData.id = newId;

    //add
    this.AgeModels[targetAgeModelIdx].ages.push(ageData);
    this.sortAges();
    this.checkAges();
  }
  
  updateAgeDepth(LCCore){
    //update CD/EFD of age points
    if(this.AgeModels.length==0){
      return;
    }
    let errorCounts = 0;
    for(let m=0; m<this.AgeModels.length; m++){
      for(let a=0;a<this.AgeModels[m].ages.length;a++){
        const ageData = this.AgeModels[m].ages[a];
        if(ageData.original_depth_type == "trinity"){
          //calc idex
          let ageDataIdx = LCCore.getIdxFromTrinity(LCCore.base_project_id, [ageData.trinityData.hole_name, ageData.trinityData.section_name, ageData.trinityData.distance]);
          ageData.pidx = ageDataIdx[0];
          ageData.hidx = ageDataIdx[1];
          ageData.sidx = ageDataIdx[2];
          
          //case trinity data
          const efdData = LCCore.getDepthFromTrinity([null,null,null,null], [ageData.trinityData], "event_free_depth");
          const cdData  = LCCore.getDepthFromTrinity([null,null,null,null], [ageData.trinityData], "composite_depth");

          const [sectionId, efd, rank, polationType, sectionType]  = efdData[0];
          const [sectionId2,cd,  rank2,polationType2,sectionType2] = cdData[0];

          if (sectionId == null) {
            errorCounts++;
            if(errorCounts==1){  
              console.log("LCCAge: Could not determine the position: CD:",cd,"EFD:",efd);
            }
            
            if(errorCounts<4){  
              console.log("      > "+ageData.trinityData.name);
            }else if(m == this.AgeModels.length-1 && a ==this.AgeModels[m].ages.length-1){
              console.log("        ...and more " + errorCounts);
            }
            
            ageData.event_free_depth = null;
            ageData.composite_depth  = null;
            ageData.section_id = null;
            continue;
          } else {
            ageData.event_free_depth = efd;
            ageData.composite_depth  = cd;
            ageData.section_id = sectionId;
          }
        }else if(ageData.original_depth_type == "composite_depth"){
          //case composite depth
          const efdval = LCCore.getEFDfromCD(ageData.composite_depth);
          if (efdval !== NaN) {
            ageData.event_free_depth = efdval;
            //calc idex
            let pidx = null;
            for(let p=0; p<LCCore.projects.length;p++){
              if(LCCore.projects[p].name == LCCore.base_project_id){
                pidx = p;
              }
            }
            ageData.pidx = pidx;
            ageData.hidx = null;
            ageData.sidx = null;
          } else {
            console.log("Comsposite depth is out of model definition. :" + csv_data[r][0]);
          }
        }else if(ageData.original_depth_type == "event_free_depth"){
          //case event free depth
          console.log("LCAge: Unsuspected depth type depetected",ageData.name, ageData.original_depth_type)
        }else{
          console.log("LCAge: Unsuspected depth type depetected",ageData.name, ageData.original_depth_type)
        }    
      }
    }

    console.log("--> LCAge: Finished update depth.")
    this.sortAges();
    this.checkAges();
    //this.checkAges();
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
    this.sortAges();
    this.checkAges();
  }  
  getAgeFromEFD(efd, method) {
    const targetAgeModelId = this.selected_id;
    let output = { age: { type: null, source:null, mid: null, upper: null, lower: null }, age_idx: null };

    if (method == "linear") {
      // 1. Identify the target age model index
      let targetAgeModelIdx = null;
      this.AgeModels.forEach((a, n) => {
        if (targetAgeModelId == a.id) targetAgeModelIdx = n;
      });

      if (targetAgeModelIdx == null || efd == null) return output;
      output.age_idx = targetAgeModelIdx;

      // 2. Prepare valid data: filter enabled points and sort by depth (shallow to deep)
      // "Upper" data (shallower) will now always come first in the array.
      const validAges = this.AgeModels[targetAgeModelIdx].ages
        .filter(a => a.enable === true)
        .sort((a, b) => a.event_free_depth - b.event_free_depth);

      // Safety check: Linear calculation requires at least two points
      if (validAges.length < 2) return output;

      let upperData = null; // Shallower point
      let lowerData = null; // Deeper point

      // 3. Determine the data pair for calculation
      const firstPoint = validAges[0];
      const lastPoint = validAges[validAges.length - 1];

      if (efd < firstPoint.event_free_depth) {
        // Extrapolation (Above/Shallow): Use the first two shallowest points
        upperData = validAges[0];
        lowerData = validAges[1];
      } else if (efd > lastPoint.event_free_depth) {
        // Extrapolation (Below/Deep): Use the last two deepest points
        upperData = validAges[validAges.length - 2];
        lowerData = validAges[validAges.length - 1];
      } else {
        // Interpolation (In-range): Find the interval containing the efd
        for (let i = 0; i < validAges.length - 1; i++) {
          if (validAges[i].event_free_depth <= efd && efd <= validAges[i + 1].event_free_depth) {
            upperData = validAges[i];
            lowerData = validAges[i + 1];
            break;
          }
        }
      }

      // 4. Execute calculation (ensure upperData is passed as the first argument)
      output.age = this.interpolate(upperData, lowerData, "age", efd, method);
    }

    return output;
  }
  
  //sub functions
  linearInterp(D1, D3, d2d1, d3d1){
    //D1:   upper marker depth (e.g. CD/EFD) parseFloat(upperMarkerData[calcType]);
    //D3:   lower marker depth (e.g. CD/EFD) parseFloat(lowerMarkerData[calcType]);
    //d2d1: distance between target-upper (e.g. distance) -1 * parseFloat(this.calcCDistance(upperMarkerData, targetMarkerData));
    //d3d1: distance between target-lower (e.g. distance) parseFloat(this.calcCDistance(lowerMarkerData, targetMarkerData)) - parseFloat(this.calcCDistance(upperMarkerData, targetMarkerData));
    //output(D2): target marker depth(e.g.CD/EFD)

    let output = null;
    d2d1 = Math.abs(d2d1);
    d3d1 = Math.abs(d3d1);
    let D2 = null;
    if (d3d1 == 0) {
      //case defined markers on the duplicated same distance marker(e.g. core top)
      D2 = D1;
    } else {
      D2 = D1 + (d2d1 / d3d1) * (D3 - D1);
    }
    if (!isNaN(D2) && D2 !== null) {
      output = D2;
    }
    return output;
  }
  
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

      //get type
      let mode;
      let side = null;

      const x1 = (target == "age") ? u_efd : u_age;
      const x2 = (target == "age") ? l_efd : l_age;
      const v  = efd;

      const xmin = Math.min(x1, x2);
      const xmax = Math.max(x1, x2);

      if (v >= xmin && v <= xmax) {
        mode = "interpolation";
      } else {
        mode = "extrapolation";
        side = (v < xmin) ? "upper" : "lower";
      }

      //calc
      let interp_mid = null;
      let interp_upper = null;
      let interp_lower = null;
      if (target == "age") {
        interp_mid   = interp([u_efd, l_efd], [u_age, l_age], efd);
        interp_upper = interp([u_efd, l_efd], [u_age_u, l_age_u], efd);
        interp_lower = interp([u_efd, l_efd], [u_age_l, l_age_l], efd);
      } else if (target == "efd") {
        interp_mid   = interp([u_age, l_age], [u_efd, l_efd], efd);
        interp_upper = interp([u_age_u, l_age_u], [u_efd, l_efd], efd);
        interp_lower = interp([u_age_l, l_age_l], [u_efd, l_efd], efd);
      }

      return {
        type: target,
        source: {type:mode,upper:upperAgeData.name,lower:lowerAgeData.name},
        mid: interp_mid,
        upper: interp_upper,
        lower: interp_lower,
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
    let upperData = null;
      for(let i=0; i<this.AgeModels[targetAgeModelIdx].ages.length;i++){
        //if above
        const ageData = this.AgeModels[targetAgeModelIdx].ages[i];
        if (upperData == null || (ageData.age_mid <= age && upperData.age_mid < ageData.age_mid)) {
          if(ageData.enable==true){
            upperData = ageData;
          }      
        }
      }

      let lowerData = null;
      for(let i=this.AgeModels[targetAgeModelIdx].ages.length-1; i>=0;i--){
        //if below
        const ageData = this.AgeModels[targetAgeModelIdx].ages[i];
        if (lowerData == null ||(ageData.age_mid >= age && lowerData.age_mid > ageData.age_mid)) {          
          if(ageData.enable==true){
            lowerData = ageData;
          }
        }
      }

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
  equalName(a, b) {
    const isNumLike = v =>
      typeof v === "number" ||
      (typeof v === "string" && /^[0-9]+$/.test(v));

    if (isNumLike(a) && isNumLike(b)) {
      return Number(a) === Number(b);
    }
    return String(a) === String(b);
  }

}

module.exports = { LevelCompilerAge };
