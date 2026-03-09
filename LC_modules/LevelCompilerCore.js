const lcfnc = require("./lcfnc.js");
const EventEmitter = require('events');

const { Project } = require("./Project.js");
const { Hole } = require("./Hole.js");
const { Section } = require("./Section.js");
const { Marker } = require("./Marker.js");
const { Trinity } = require("./Trinity.js");
const { copyFileSync } = require("original-fs");
const { setegid } = require("process");
const { Console } = require("console");
const { randomUUID: uuidv4 } = require("crypto");
const { unsubscribe } = require("diagnostics_channel");

class LevelCompilerCore extends EventEmitter{
  constructor() {
    super();
    this.name = "";
    this.id = lcfnc.getUniqueId();;
    this.model_format_version = "1.0.0";
    this.descriptions = "";
    this.projects = [];
    this.search_idx_list = {};
    this.base_project_id = null;

    //[_] properties are not exported.
    this._state = {
      status: 'Initialise',
      statusDetails: null,      
      hasError: false,    
      errorDetails: null,  
    };
    this._performance = {},
    this._pathCache = {};
    this._distanceCache = {};
    this._measurePerformance = false; //for developper
    this._graphSearchMethod = "bfs"; //[bfs, dfs]
    
    this.on('error', (err) => {
      console.error('LCCore:'+ err.statusDetails);
    });
    this.on('error_alert', (err) => {
      console.error('LCCore:'+ err.statusDetails);
    });
  }
  
  //status type: ["Initialise","running","completed","error","error_important"]
  setStatus(newStatus, statusDetails) {
    this._state.status = newStatus;
    this._state.statusDetails = statusDetails;
    this._state.hasError = false; 
    this._state.errorDetails = null;
    this.emit('change', this._state);
  }
  setError(errorMessage,statusDetails) {
    this._state.status = 'error';
    this._state.statusDetails = statusDetails;
    this._state.hasError = true; 
    this._state.errorDetails = errorMessage;
    this.emit('error_minor', this._state);
  }
  setErrorAlert(errorMessage,statusDetails) {
    this._state.status = 'error_alert';
    this._state.statusDetails = statusDetails;
    this._state.hasError = true; 
    this._state.errorDetails = errorMessage;
    this.emit('error_alert', this._state);
  }
  setErrorFatal(errorMessage,statusDetails) {
    this._state.status = 'error_fatal';
    this._state.statusDetails = statusDetails;
    this._state.hasError = true; 
    this._state.errorDetails = errorMessage;
    this.emit('error_fatal', this._state);
  }
  setUpdateDepth() {
    //set update event for LCAge, LCPlot
    this._state.status = 'update_depth';
    this._state.statusDetails = null;
    this._state.hasError = false; 
    this._state.errorDetails = null;
    this.emit('update_depth');
  }
  getState() {
    return this._state;
  }

  //methods
  loadModelFromCsv(model_path, type="forLC") {
    this.setStatus("running", "Start loadModelFromCsv");

    //Initialise
    const projectData = new Project();
    let model_info = {};
    let isDuo = false;

    if(type=="forLC"){
      //load model
      projectData._model_data = lcfnc.readcsv(model_path);
      projectData.descriptions = "The initial model is loaded from a csv model for Level Compiler.";
      var fileName = model_path.split(/[/\\]/).pop();
      const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // ^(.*?)\((.*?)\)\.csv$/)
      var match = fileName.match(patern);      
      
      if (match) {
        //check model type
        if (this.projects.length == 0) {
          if (match[1].toLowerCase().includes("correlation")) {
            model_info.name = match[2];
            model_info.version = match[3];
            projectData.model_type = "correlation";
            isDuo = false;

            this.setStatus("running", "Load correlation file.");
            console.log("LCCore: Load correlation file.");
          } else if (match[1].toLowerCase().includes("duo")) {
            model_info.name = match[2];
            model_info.version = match[3];
            projectData.model_type = "duo";
            isDuo = false;
            this.setStatus("running"," Load duo file.");
            console.log("LCCore: Load duo file.");
          } else if (match[1] == "" || match[1] == undefined) {
            this.setErrorAlert("","E001: There is no identifier for model in the file name.")
            console.log("LCCore: E001: There is no identifier for model in the file name.");
            return null;
          } else {
            this.setErrorAlert("","E002: The identifier is not correct. Please use 'correlation' or 'duo'.");
            console.log("LCCore: E002: The identifier is not correct. Please use 'correlation' or 'duo'."          );
            return null;
          }
        } else if (this.projects.length > 0) {
          if (match[1].toLowerCase().includes("correlation")) {
            if (this.projects[0].model_type == "duo"){
              //if duo, replace
              model_info.name = match[2];
              model_info.version = match[3];
              projectData.model_type = "correlation";
              isDuo = false;
              this.setStatus("running","Load correlation file after duo model.");
              console.log("LCCore: Load correlation file after duo model.");
            }else{
              this.setErrorAlert("","E003: Skipped load the model. Multiple correlation model is not supported. Please use Duo model.");
              console.log("LCCore: E003: Skipped load the model. Multiple correlation model is not supported. Please use Duo model.");
              return null;
            }          
          } else if (match[1].toLowerCase().includes("duo")) {
            model_info.name = match[2];
            model_info.version = match[3];
            projectData.model_type = "duo";
            isDuo = true;
            this.setStatus("running","Load duo file.");
            console.log("LCCore: Load duo file.");
          } else if (match[1] == "" || match[1] == undefined) {
            this.setErrorAlert("","E004: The identifier is not correct. Please use 'correlation' or 'duo'.");
            console.log("LCCore: E004: The identifier is not correct. Please use 'correlation' or 'duo'.");
            return null;
          } else {
            this.setErrorAlert("","E005: The identifier is not correct. Please use 'correlation' or 'duo'.");
            console.log("LCCore: E005: The identifier is not correct. Please use 'correlation' or 'duo'.");
            return null;
          }
        } else {
          return null;
        }
      } else {
        this.setError("","E051: This is no project data.");
        return null;
      }
    }else if(type=="forLF"){
      //convert
      const convertedData = this.convertLF2LC(model_path);
      projectData.descriptions = "The initial model is loaded from a csv model for Level Finder.";
      projectData._model_data = convertedData.model;

      model_info.name = convertedData.name;
      model_info.version = convertedData.version;

      projectData.model_type = convertedData.type;
      if(convertedData.type=="duo"){
        isDuo = true;
      }else{
        isDuo = false;
      }
      
    }    

    //add project data
    const newProjectId = lcfnc.getUniqueId();
    let p = this.projects.length;
    projectData.id = [newProjectId, null, null, null];
    projectData.name = model_info.name;
    projectData.correlation_version = model_info.version;
    projectData.order = this.projects.length;
    //make brank marker id list
    const markerIdList = lcfnc.makeMarkerIdBase(
      projectData._model_data.length,
      projectData._model_data[0].length
    );
    if (this.base_project_id == null) {
      this.base_project_id = projectData.id;
    }

    //get hole list
    const holeList = this.getHoleListFromCsv(projectData); //return:[holeidx, name]
    if (holeList.length == 0) {
      this.setErrorAlert("","E006: There are no holes.")
      console.log("LCCore: E006: There are no holes.");
      return null;
    }

    //add each hole
    for (let h = 0; h < holeList.length; h++) {
      //make instance
      let holeData = new Hole();

      //add info
      const newHoleId = lcfnc.getUniqueId();

      holeData.id = [newProjectId, newHoleId, null, null];
      holeData.name = lcfnc.zeroPadding(holeList[h][1]).trim();
      holeData.type = holeList[h][2];
      holeData.order = h;

      //get section list
      const sectionList = this.getSectionListFromCsv(projectData, holeList[h]); //return: [holeidx, [top secidx, bottom secidx], name]

      for (let s = 0; s < sectionList.length; s++) {
        //make instance
        let sectionData = new Section();

        //add info
        const newSectionId = lcfnc.getUniqueId();
        sectionData.id = [newProjectId, newHoleId, newSectionId, null];
        sectionData.name = lcfnc.zeroPadding(sectionList[s][2]).trim();
        sectionData.order = s;

        //get marker list
        const markerList = this.getMarkerListFromCsv(
          projectData,
          sectionList[s]
        ); //return: [holeIdx, [top secidx, bottom secidx], [markerIdxs]]

        //add marker
        for (let m = 0; m < markerList[2].length; m++) {
          //make instance
          let markerData = new Marker();

          //add marker info
          const newMarkerId = lcfnc.getUniqueId();
          markerData.id = [
            newProjectId,
            newHoleId,
            newSectionId,
            newMarkerId,
          ];
          markerData.order = m;

          const marker_r = markerList[2][m]; //id is deified at marker row
          const marker_c = markerList[0]; //id is defied at marker Name col

          markerIdList[marker_r][marker_c] = markerData.id; //add marker list

          markerData.name = lcfnc.zeroPadding(
            projectData._model_data[marker_r][marker_c].toString()
          );
          markerData.distance = parseFloat(
            projectData._model_data[marker_r][marker_c + 1]
          );
          markerData.drilling_depth = parseFloat(
            projectData._model_data[marker_r][marker_c + 2]
          );

          //check master section
          const masterHole = projectData._model_data[marker_r][0]
            .replace(/\([^)]*\)/, "") //replace (num)
            .split("/");

          for (let k = 0; k < masterHole.length; k++) {
            if (masterHole[k] == holeList[h][1]) {
              //chekc is master
              //if (isDuo == false) {
                markerData.isMaster = true;

                //if master, check is zero point
                //check zero point
                if (
                  projectData._model_data[marker_r][0].match( /\((-?\d+(\.\d+)?)\)/ ) !== null
                ) {
                  markerData.isZeroPoint = projectData._model_data[marker_r][0].match( /\((-?\d+(\.\d+)?)\)/ )[1];
                }
              //}
            }
          }

          //load event data
          const events =
            projectData._model_data[marker_r][marker_c + 3].split("/");
          let eventData = [];
          const split_pattern = /(\w+)-+(\w+)(?:\(([^)]*)\))?(?:\[(.*?)\])?/;
          for (let e = 0; e < events.length; e++) {
            if (events[e] == "") {
              continue;
            }
            let event = [];
            [, event[0], event[1], event[2], event[3]] = events[e]
              .toLowerCase()
              .match(split_pattern);

            //get event category(e.g. tephra)
            let eventCategory = "general";
            if (event[3] == undefined) {
              eventCategory = "general";
            } else {
              eventCategory = event[3];
            }

            if (event[0] == "deposition" || event[0] == "d" || event[0] == "D") {
              if (event[1] == "upper" || event[1] == "u" || event[1] == "U") {
                //add list
                eventData.push(["deposition", "downward", null, eventCategory, null]);
              } else if (event[1] == "lower" || event[1] == "l" || event[1] == "L") {
                //add list
                eventData.push(["deposition", "upward", null, eventCategory, null]);
              } else if (event[1] == "through" || event[1] == "t" || event[1] == "T") {
                //add 2 events for upward and downward
                eventData.push(["deposition", "through-up", null, eventCategory, null]);
                eventData.push(["deposition", "through-down", null, eventCategory, null]);
              } else if (event[1] == "upward") {
                let thickness = parseFloat(event[2]);
                if (!isNaN(thickness)) {
                  eventData.push(["deposition", "upward", -thickness, eventCategory, -thickness]);
                }
              } else if (event[1] == "downward") {
                let thickness = parseFloat(event[2]);
                if (!isNaN(thickness)) {
                  eventData.push(["deposition", "downward", thickness, eventCategory, thickness]);
                }
              } else {
                this.setError("","E007: Undifined deosition event data detected at ID:" + markerData.id)
                console.log("LCCore: E007: Undifined deosition event data detected at ID:" + markerData.id);
              }
            } else if (event[0] == "erosion" || event[0] == "e" || event[0] == "E") {
              let thickness = parseFloat(event[2]);
              if (!isNaN(thickness)) {
                thickness = Math.abs(thickness);
                
                if (event[1] == "upper" || event[1] == "u" || event[1] == "U") {
                  eventData.push(["erosion", "downward", null, "erosion", -thickness]);
                } else if (event[1] == "lower" || event[1] == "l" || event[1] == "L") {
                  eventData.push(["erosion", "upward", null, "erosion", thickness]);
                } else if (event[1] == "erosion" || event[1] == "e" || event[1] == "E") {
                  eventData.push(["erosion", "downward", -thickness, "erosion", -thickness]);
                }else {
                  console.error(
                    "LCCore: Undifined erosion event data detected at ID:" +
                      markerData.id
                  );
                  continue;
                }

              }
            } else if (event[0] == "markup" || event[0] == "m" || event[0] == "M") {
              let thickness = parseFloat(event[2]);
              if (event[1] == "upper" || event[1] == "u" || event[1] == "U") {
                eventData.push(["markup", "downward", null, eventCategory, null]);
              } else if (event[1] == "lower" || event[1] == "l"|| event[1] == "L") {
                eventData.push(["markup", "upward", null, eventCategory, null]);
              } else if (event[1] == "through" || event[1] == "t" || event[1] == "T") {
                eventData.push(["markup", "through-up", null, eventCategory, null]);
                eventData.push(["markup", "through-down", null, eventCategory, null]);
              } else if (event[1] == "upward") {
                eventData.push(["markup", "downward", thickness, eventCategory, thickness]);
              } else if (event[1] == "downward") {
                eventData.push(["markup", "upward", -thickness, eventCategory, -thickness]);
              } else {
                this.setError("","E008: Undifined markup data detected at ID:" + markerData.id);
                console.log("LCCore: E008: Undifined markup data detected at ID:" + markerData.id);
              }
            } else if (event[0] == "connection" || event[0] == "c" || event[0] == "C") {
              if (event[1] == "upper" || event[1] == "u" || event[1] == "U") {
                if(markerData.name.includes("-bottom")){
                  eventData.push(["connection", "downward", null, null, null]);
                }                
              } else if (event[1] == "lower" || event[1] == "l"|| event[1] == "L") {
                if(markerData.name.includes("-top")){
                  eventData.push(["connection", "upward", null, null, null]);
                }
              } else {
                this.setError("","E072: Undifined connect data detected at ID:" + markerData.id);
                console.log("LCCore: E072: Undifined connect data detected at ID:" + markerData.id);
              }
            }else if (event[0] == "") {
              //no event
            } else {
              this.setError("","E009: Undifined event type detected at " + markerData.id);
              console.log("LCCore: E009: Undifined event type detected at " + markerData.id);
              //this.getMarkerNameFromId(markerData.id)
              continue;
            }
          }

          markerData.event = eventData;

          //add marker
          sectionData.markers.push(markerData);
          this.search_idx_list[markerData.id.toString()] = [p, h, s, m];
        }
        //add section
        holeData.sections.push(sectionData);
        this.search_idx_list[sectionData.id.toString()] = [p, h, s, null];
      }
      //add hole
      projectData.holes.push(holeData);
      this.search_idx_list[holeData.id.toString()] = [p, h, null, null];
    }
    this.projects.push(projectData);
    this.search_idx_list[projectData.id.toString()] = [p, null, null, null];
    if (this.projects[0].model_type == "duo"){
      if(projectData.model_type== "correlation"){
        //if master is loaded after duo
        [this.projects[0], this.projects[this.projects.length-1]] = [this.projects[this.projects.length-1], this.projects[0]];//swap
        this.updateSearchIdx();
        this.base_project_id = projectData.id;
        [this.projects[0].order, this.projects[this.projects.length-1].order] = [this.projects[this.projects.length-1].order, this.projects[0].order];//swap
      }
    }
    

    //add unique id for each markers

    //--------------------------------------------------------
    //connect correlation
    //const holeList = this.getHoleList();
    //get loaded project idx
    const projectIdx = this.search_idx_list[projectData.id.toString()];

    for (let h = 0; h < holeList.length; h++) {
      const sectionList = this.getSectionListFromCsv(projectData, holeList[h]);

      let isContinuousSection = false;
      if (projectData.holes[h].type == "piston") {
        isContinuousSection = true;
      }

      for (let s = 0; s < sectionList.length; s++) {
        const markerList = this.getMarkerListFromCsv(
          projectData,
          sectionList[s]
        );
        for (let m = 0; m < markerList[2].length; m++) {
          const marker_r = markerList[2][m]; //id is deified at marker row
          const marker_c = markerList[0]; //id is defied at marker Name col

          //add horizontal correlation
          let row_data = projectData._model_data[marker_r];
          let start_k;
          if (projectData.model_type == "correlation") {
            start_k = 2;
            for (let k = start_k; k < row_data.length; k += 4) {
              //check distance data col
              const val = projectData._model_data[marker_r][k];
              if (val != "" && !isNaN(parseFloat(val))) {
                const correlated_marker_id = markerIdList[marker_r][k - 1];
                if(correlated_marker_id == null){
                  this.setErrorAlert("","E052: Correlation model contains error in cell (" +marker_r+", "+k+ ")");
                  console.error("E052: LCCore: Correlation model contains error in cell (" +marker_r+", "+k+ ")");
                  return null
                }

                if (correlated_marker_id.join("-") !== this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id.join("-")) {
                  //excluding own id
                  this.projects[projectIdx[0]].holes[h].sections[s].markers[m].h_connection.push(correlated_marker_id);
                }
              }
              //console.log( this.projects[projectIdx[0]].holes[h].sections[c].markers[m].h_connection);
            }
          } else if (projectData.model_type == "duo") {
            start_k = 2 + 4;
            for (let k = start_k; k < row_data.length; k += 4) {
              //check distance data col
              const val = projectData._model_data[marker_r][k];
              if (val != "" && !isNaN(parseFloat(val))) {
                const correlated_marker_id = markerIdList[marker_r][k - 1];

                //exclude own id
                if (correlated_marker_id.join("-") !== this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id.join("-")) {
                  this.projects[projectIdx[0]].holes[h].sections[s].markers[m].h_connection.push(correlated_marker_id);
                }

                //add duo connection object
                const model_r = projectData._model_data[marker_r];
                if (model_r[1] !== "") {
                  const duo_connected_hole = lcfnc.zeroPadding(model_r[1]);
                  const duo_connected_sec  = lcfnc.zeroPadding(model_r[2]);
                  const duo_connected_dist = lcfnc.round(parseFloat(model_r[3]), 1);
                  this.projects[projectIdx[0]]._duo_connection[correlated_marker_id.toString()] = [
                    duo_connected_hole,
                    duo_connected_sec,
                    duo_connected_dist,
                  ];
                }
              }
              //console.log( this.projects[projectIdx[0]].holes[h].sections[c].markers[m].h_connection);
            }
          }

          //add vertical connection (with case of piston core)
          if (m == 0) {
            //let previousMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m - 1];
            //let currentMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m];
            let nextMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m + 1];
            this.projects[projectIdx[0]].holes[h].sections[s].markers[m].v_connection.push(nextMarker.id);
            //case piston core
            if (isContinuousSection == true) {
              if (s > 0) {
                let previousMarker = this.projects[projectIdx[0]].holes[h].sections[s - 1].markers.slice(-1)[0];
                this.projects[projectIdx[0]].holes[h].sections[s].markers[m].v_connection.push(previousMarker.id);
              }
            }
          } else if (m == markerList[2].length - 1) {
            let previousMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m - 1];
            //let currentMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m];
            //let nextMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m] + 1;
            this.projects[projectIdx[0]].holes[h].sections[s].markers[
              m
            ].v_connection.push(previousMarker.id);
            //case piston core
            if (isContinuousSection == true) {
              if (s < sectionList.length - 1) {
                let nextMarker = this.projects[projectIdx[0]].holes[h].sections[s + 1].markers[0];
                this.projects[projectIdx[0]].holes[h].sections[s].markers[m].v_connection.push(nextMarker.id);
              }
            }
          } else {
            let previousMarker =
              this.projects[projectIdx[0]].holes[h].sections[s].markers[m - 1];
            //let currentMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m];
            let nextMarker = this.projects[projectIdx[0]].holes[h].sections[s].markers[m + 1];

            this.projects[projectIdx[0]].holes[h].sections[s].markers[
              m
            ].v_connection.push(previousMarker.id);
            this.projects[projectIdx[0]].holes[h].sections[s].markers[
              m
            ].v_connection.push(nextMarker.id);
          }
          if (s > 1 && s < sectionList.length) {
            //excluding very top and very bottom cores

            this.projects[projectIdx[0]].holes[h];
          }
        }
      }
    }

    //connect event
    const isMakeNewMarker = this.connectEventPairs(projectData.id);

    //connect duo
    if(this.projects.length>1){
      const baseIdx = this.search_idx_list[this.base_project_id];
      if(this.projects[baseIdx[0]].model_type == "correlation"){
        this.connectDuoModel();
      }
    }

    //this.sortModelByOrder();
    this.sortModel();

    console.log("LCCore: Model loaded from csv.");
    this.setStatus("completed","Model loaded from csv.")

    return true;

  }
  loadModelFromLcmodel(lcdata){
    //check load model type
    let isBaseInOld = false;
    let isBaseInNew = false;
    let loadedProjectIds = [];

    for(const project of this.projects){
      loadedProjectIds.push(project.id[0]);
      if(project.model_type == "correlation"){
        isBaseInOld = true;
      }
    }

    for(const project of lcdata.projects){
      if(project.model_type == "correlation"){        
        isBaseInNew = true;
      }
    }

    if(isBaseInOld && isBaseInNew){
      //duplication of base correlation models
      return false
    }

    //assign workspace data
    if(this.projects.length == 0 || isBaseInNew){
      //base model or first model
      this.name = lcdata.name;
      this.id = lcdata.id ?? this.id;
      this.descriptions = lcdata.descriptions;
    }

    //assign model data
    lcdata.projects.forEach(project=>{
      if(loadedProjectIds.includes(project.id[0])){
        return; //skip this loop
      }

      const newProject = new Project().load(project);
      newProject.order = this.projects.length+1;

      if(this.base_project_id == null || project.model_type=="correlation"){
        //update base id
        this.base_project_id = project.id;
      }

      if(project.model_type=="correlation"){
        //update order
        newProject.order = 0;
        this.projects.forEach((p,i)=>{
          p.order = i+1;
        })
      }

      //add
      this.projects.push(newProject);
      loadedProjectIds.push(project.id[0]);
    })


    //if old id, update to new id
    this.replaceNewId();
          
    this.updateSearchIdx();

    //connect duo
    if(this.projects.length>1){
      const baseIdx = this.search_idx_list[this.base_project_id];
      if(this.projects[baseIdx[0]].model_type == "correlation"){
        this.connectDuoModel();
      }
    }

  }
  loadEventListFromCsv(filepath){
    if(this.projects.length==0) return false;
    this.setStatus("running", "Start load Event List From Csv");

    //for import Level Finder format
    //load model
    const eventList = lcfnc.readcsv(filepath);
    var fileName = filepath.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // ^(.*?)\((.*?)\)\.csv$/)
    var match = fileName.match(patern);  
    const version = match[3];
    const name = match[2]; 

    //formatting
    for(let i=1; i< eventList.length; i++){
      const holeName      = eventList[i][0];    
      const sectionName   = eventList[i][1];        
      const upperDistance = parseFloat(eventList[i][2]);
      const lowerDistance = parseFloat(eventList[i][3]);
      const eventName     = eventList[i][4];

      //search target project
      let targetProjectId = null;
      let targetHoleId    = null;
      let targetSectionId = null;
      this.projects.forEach(p => {
        p.holes.forEach(h=>{
          const hole = /^\d$/.test(holeName) ? holeName.padStart(2,"0") : holeName;
          if(h.name == hole){
            targetProjectId = p.id;
            targetHoleId    = h.id;

            h.sections.forEach(s=>{
            const section = /^\d$/.test(sectionName) ? sectionName.padStart(2,"0") : sectionName;
            if(s.name == section){
              targetSectionId = s.id;
            }
          })
          }         
        })
      })

      if(!targetProjectId && !targetHoleId && !targetSectionId){
        //there is no target hole
        continue
      }

      //check marker exist
      let upperIdx = this.getIdxFromTrinity(targetProjectId, [holeName, sectionName, upperDistance]);
      let lowerIdx = this.getIdxFromTrinity(targetProjectId, [holeName, sectionName, lowerDistance]);
      let upperId = null;
      let lowerId = null;
      if(upperIdx[3] == null){
        //there is no marker
        let trinityData = new Trinity();
        trinityData.name = "";
        trinityData.project_name = this.projects[upperIdx[0]].name;
        trinityData.hole_name = holeName;
        trinityData.section_name = sectionName;
        trinityData.distance = upperDistance;

        const depthData = this.getDepthFromTrinity(targetSectionId, [trinityData], "composite_depth");
        
        this.addMarker(targetSectionId, depthData[0][1], "composite_depth");
        upperIdx = this.getIdxFromTrinity(targetProjectId, [holeName, sectionName, upperDistance]);
      }

      if(lowerIdx[3] == null){
        //there is no marker
        let trinityData = new Trinity();
        trinityData.name = "";
        trinityData.project_name = this.projects[lowerIdx[0]].name;
        trinityData.hole_name = holeName;
        trinityData.section_name = sectionName;
        trinityData.distance = lowerDistance;

        const depthData = this.getDepthFromTrinity(targetSectionId, [trinityData], "composite_depth");
        
        this.addMarker(targetSectionId, depthData[0][1], "composite_depth");
        lowerIdx = this.getIdxFromTrinity(targetProjectId, [holeName, sectionName, lowerDistance]);
      }

      //add event
      if(upperIdx[3] !== null && lowerIdx[3] !== null){
        const upperMarkerData = this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]];       
        const lowerMarkerData = this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]];

        let upperEventColour = "general";
        let lowerEventColour = "general";
        if(eventName.toLowerCase().includes("tephra")){
          upperEventColour = "tephra";
          lowerEventColour = "tephra";
        }else if(eventName.toLowerCase().includes("void")){
          upperEventColour = "void";
          lowerEventColour = "void";
        }else if(eventName.toLowerCase().includes("disturbed")){
          upperEventColour = "disturbed";
          lowerEventColour = "disturbed";
        }else if(eventName.toLowerCase().includes("earthquake")){
          upperEventColour = "earthquake";
          lowerEventColour = "earthquake";
        }          
        
        const upperEventData = ["deposition", "downward",lowerMarkerData.id, upperEventColour, null];
        const lowerEventData = ["deposition", "upward",  upperMarkerData.id, lowerEventColour, null];

        upperMarkerData.event.push(upperEventData);
        lowerMarkerData.event.push(lowerEventData);
      }
    }

    //connect duo
    if(this.projects.length>1){
      const baseIdx = this.search_idx_list[this.base_project_id];
      if(this.projects[baseIdx[0]].model_type == "correlation"){
        this.connectDuoModel();
      }
    }

    //this.sortModelByOrder();
    this.sortModel();

    console.log("LCCore: Event List is loaded from csv.");
    this.setStatus("completed","Event List is loaded from csv.");
    return true
  }
  replaceNewId(){
    //register
    let newIds = {};
    let hasError = false;
    this.projects.forEach(p => {
      if (p.id[0] != null){
        if(p.id[0].length == 22){
          newIds[p.id.toString()] = p.id;          
        }else{
          newIds[p.id.toString()] = [lcfnc.getUniqueId(), null, null, null];
        }        
      }
      
      p.holes.forEach(h=>{
        if (h.id[1] != null){
          if(h.id[0].length == 22 && h.id[1].length == 22){
            newIds[h.id.toString()] = h.id;            
          }else{
            const newParentId = newIds[[h.id[0], null, null, null].toString()];
            if (!newParentId) {
              this.setErrorAlert("error_alert", "LCCore: E071: Missing parent ID for hole", h);
              hasError = true;
              return;
            }
            newIds[h.id.toString()] = [newParentId[0], lcfnc.getUniqueId(), null, null];
          }
        }
        h.sections.forEach(s=>{
          if (s.id[2] != null){
            if(s.id[0].length == 22 && s.id[1].length == 22 && s.id[2].length == 22){
              newIds[s.id.toString()] = s.id;
            }else{
              const newParentId = newIds[[s.id[0], s.id[1], null, null].toString()];
              if (!newParentId) {
                this.setErrorAlert("error_alert", "LCCore: E071: Missing parent ID for section",s);
                hasError = true;
                return;
              }
              newIds[s.id.toString()] = [newParentId[0], newParentId[1], lcfnc.getUniqueId(), null];
            }
            
          }
          s.markers.forEach(m=>{
            if (m.id[3] != null){
              if(m.id[0].length == 22 && m.id[1].length == 22 && m.id[2].length == 22 && m.id[3].length == 22){
                newIds[m.id.toString()] = m.id;
              }else{
                const newParentId = newIds[[m.id[0], m.id[1], m.id[2], null].toString()];
                if (!newParentId) {
                  this.setErrorAlert("error_alert", "LCCore: E071: Missing parent ID for marker");
                  console.log("   "+h.name+"-"+s.name+": "+m.id[3])
                  hasError = true;
                  return;
                }
                newIds[m.id.toString()] = [newParentId[0], newParentId[1], newParentId[2], lcfnc.getUniqueId()];
              }
            }              
          })
        })
      })
    })
    if (hasError) return false;

    //apply
    this.base_project_id = newIds[this.base_project_id.toString()] || this.base_project_id;

    this.projects.forEach(p => {
      p.id = newIds[p.id.toString()] || p.id;
      p.holes.forEach(h=>{
        h.id = newIds[h.id.toString()] || h.id;
        h.sections.forEach(s=>{
          s.id = newIds[s.id.toString()] || s.id;
          s.markers.forEach(m=>{
            m.id = newIds[m.id.toString()] || m.id;
            
            // v_connection
            for (let i = 0; i < m.v_connection.length; i++) {
              const key = m.v_connection[i].toString();
              m.v_connection[i] = newIds[key] || m.v_connection[i];
            }

            // h_connection
            for (let i = 0; i < m.h_connection.length; i++) {
              const key = m.h_connection[i].toString();
              m.h_connection[i] = newIds[key] || m.h_connection[i];
            }

            // event
            for (let i = 0; i < m.event.length; i++) {
              const key = m.event[i][2].toString();
              m.event[i][2] = newIds[key] || m.event[i][2];
            }

            // depth_source
            if (m.depth_source[1]) {
              const key = m.depth_source[1].toString();
              m.depth_source[1] = newIds[key] || m.depth_source[1] ;
            }
            if (m.depth_source[2]) {
              const key = m.depth_source[2].toString();
              m.depth_source[2] = newIds[key] || m.depth_source[2] ;
            }
          })
        })
      })
    })

  }
  connectDuoModel() {
    //function for model loaded from csv 
    console.time("        Connect duo")
    this.setStatus("running","Start connectDuoModel")
    //if no connected markers in the master project, create a new marker.
    let isAllowAddMarker = true;

    if (this.projects.length < 1) {
      return;
    }

    //get base project idx
    let baseProjectIdx;
    this.projects.forEach((project, p)=>{
      if(this.equalName(project.id[0], this.base_project_id[0])){
        baseProjectIdx = p;
      }
    })
    
    for (let p = 0; p < this.projects.length; p++) {
      if (this.projects[p].model_type !== "duo") {
        continue;
      }

      //get duo connection
      for (let h = 0; h < this.projects[p].holes.length; h++) {
        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
          for (let m = 0; m < this.projects[p].holes[h].sections[s].markers.length; m++) {
            const markerData = this.projects[p].holes[h].sections[s].markers[m];
            //get master connection
            const masterTrinity = this.projects[p]._duo_connection[markerData.id.toString()];
            //console.log(masterTrinity)
            if (masterTrinity == undefined) {
              continue;
            }

            //search previously loaded model
            let connectedMarkerIdx = [];
            //search only in master
            //for (let i = 0; i < p; i++) {
            let tempIdx = this.getIdxFromTrinity(this.projects[baseProjectIdx].id, masterTrinity);

            if (tempIdx[3] == null) {
              this.setError("","E010: There is no correlated marker with :" + masterTrinity.join("-")+"cm");
              console.log("LCCore: E010: There is no correlated marker with :" + masterTrinity.join("-")+"cm");
              if(isAllowAddMarker == true){
                try{
                  let targetData = new Trinity();
                  targetData.name = "";
                  targetData.project_name = this.projects[tempIdx[0]].name;
                  targetData.hole_name = masterTrinity[0];
                  targetData.section_name = masterTrinity[1];
                  targetData.distance = masterTrinity[2];
                  
                  const targetId = this.projects[tempIdx[0]].holes[tempIdx[1]].sections[tempIdx[2]].id;
                  const depth = this.getDepthFromTrinity(targetId, [targetData], "composite_depth")
                  const result = this.addMarker(targetId, depth[0][1], "composite_depth");
                  if(result == true){
                    this.updateSearchIdx();
                    tempIdx = this.getIdxFromTrinity(this.projects[baseProjectIdx].id, masterTrinity);

                    this.projects[tempIdx[0]].holes[tempIdx[1]].sections[tempIdx[2]].markers[tempIdx[3]].name = "duo_connection";
                    this.setStatus("running","Add a new marker of "+masterTrinity.join("-")+"cm");
                    console.log("        -> Add a new marker of "+masterTrinity.join("-")+"cm");
                    connectedMarkerIdx.push(tempIdx);
                  }                  
                }catch(err){
                  this.setError(err,"E011: Failed to add a new connection.")
                  console.log("        -> E011: Failed to add a new connection.", err);
                  continue
                } 
              }
                              
            } else {
              connectedMarkerIdx.push(tempIdx);
            }

            //check connection
            if (connectedMarkerIdx.length == 0) {
              this.setError("","E012: There is no correlated marker in the previously loaded projects.");
              console.log( "LCCore: E012: There is no correlated marker in the previously loaded projects."  );
              continue;
            } else if (connectedMarkerIdx.length > 1) {
              this.setError("","E013: There are too many correlated marker in the previously loaded projects.")
              console.log("LCCore: E013: There are too many correlated marker in the previously loaded projects.");
              continue;
            }

            //get correlated master marker
            const msId = this.projects[connectedMarkerIdx[0][0]].holes[connectedMarkerIdx[0][1]].sections[connectedMarkerIdx[0][2]].markers[connectedMarkerIdx[0][3]].id;
            const duoId = this.projects[p].holes[h].sections[s].markers[m].id;

            //connect master and duo
            this.connectMarkers(duoId, msId, "horizontal", false);// [,,,alert disconnection]
            //this.projects[p].holes[h].sections[s].markers[m].h_connection
          }
        }
      }
    }
    this.setStatus("completed","Connected duo model.")
    console.timeEnd("        Connect duo")
  }
  calcCompositeDepth(emitUpdate=false) {
    console.time("        Calc CD")
    this.setStatus("running","start calcCompositeDepth");
    this.InitialiseCDEFD();
    //"all(not recommended)": All mode contains some problems in 2nd order interpolation and matchs between extrapolations.
    
    this.searchDepth("composite_depth");

    this.convertDepthDuo2Master("composite_depth");
    
    console.log("LCCore: Calced composite depth.");
    if(emitUpdate){
      this.setUpdateDepth();//LCAge, LCPlot
    }
    
    this.setStatus("completed","Calced composite depth.")
    console.timeEnd("        Calc CD")
  }
  calcEventFreeDepth(emitUpdate=true) {
    console.time("        Calc EFD")
    this.setStatus("running","start calcEventFreeDepth");
       
    this.searchDepth("event_free_depth");

    this.convertDepthDuo2Master("event_free_depth");
 
    console.log("LCCore: Calced event free depth.");
    if(emitUpdate){
      this.setUpdateDepth();//LCAge, LCPlot 
    }
    
    this.setStatus("completed","Calced Event Free Depth.")
    console.timeEnd("        Calc EFD")
  }
  searchDepth(calcType, applyInterpolation=true){
    this.setStatus("running","start seachDpeth")

    //check data
    if (this.projects.length == 0) {
      this.setErrorAlert("","E014: There is no correlation model.")
      console.log("E014: There is no correlation model.");
      return;
    }

    //Initialise
    this.sortModelByOrder();
    this.projects.forEach(project=>{
      project.holes.forEach(hole=>{
        hole.sections.forEach(section=>{
          section.markers.forEach(marker=>{
            marker.connection_rank = null;
            marker.depth_source = ["",null,null];
            marker[calcType] = null;
          })
        })
      })
    })

    //find zero point of each project
    const zeroPoints = this.findZeroPointId();

    //calc master section
    for (let p=0; p<this.projects.length; p++){
      //calc composite depth by limited DFS/BFS method
      if(zeroPoints[p] == null){
        //case no zero point in the project
        this.setError("","E015: There is no Zero point in the project: "+this.projects[p].name)
        console.log("LCCore: E015: There is no Zero point in the project: "+this.projects[p].name);
        continue;
      }

      const [id_zero_point, startVal, isBaseProject] = zeroPoints[p];
      
      //graph search
      const result = this.graphSearch(id_zero_point, startVal, calcType, this._graphSearchMethod);

      //apply master/master-transfer depth
      const depthDict  = result.depth;
      const searchDict = result.info;

      for (let markerIdStr of Object.keys(depthDict)){
        const depth = depthDict[markerIdStr];
        const info  = searchDict[markerIdStr];
        const midx = this.search_idx_list[markerIdStr];
        
        let currentMarkerData;
        if(midx){
          currentMarkerData = this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]];
        }

        //apply depth
        currentMarkerData[calcType] = depth;
        currentMarkerData.unreliability = 0;

        //apply depth source, rank
        const baseRank = 0;
        const duoBaseRank = 0;
        const transferAddRank = 0;
        if (currentMarkerData.isMaster == true) {
          //submit rank & depth_source
          if(currentMarkerData.id[0]==this.base_project_id[0]){
            //case base master project
            currentMarkerData.connection_rank = baseRank;
            if(info.fromDirection === "deeper"){
              currentMarkerData.depth_source    = ["master", null, info.parent]; 
            }else{
              currentMarkerData.depth_source    = ["master", info.parent, null]; 
            }               
          }else{
            //case duo master project
            currentMarkerData.connection_rank = duoBaseRank;
            if(info.fromDirection === "deeper"){
              currentMarkerData.depth_source    = ["duo-master", null, info.parent]; 
            }else{
              currentMarkerData.depth_source    = ["duo-master", info.parent, null]; 
            }   
          }
        }else{
          //case pallarel section in the base master section(transfer)
          if(currentMarkerData.id[0]==this.base_project_id[0]){
            //case base master project (depth is already transfered from master by graph search)
            currentMarkerData.connection_rank = baseRank+transferAddRank;
            currentMarkerData.depth_source    = ["master-transfer", info.parent, null];               
          }else{
            //case duo master project
            currentMarkerData.connection_rank = duoBaseRank+duoBaseRank;
            currentMarkerData.depth_source    = ["duo-master-transfer", info.parent, null];
          }
        } 
      }
      
    }
        
    //-------------------------------------------------------------------------------------
    //apply 1st order interpolation -> extrapolation 
    if(applyInterpolation){
      console.time("    interpolate")
      let NoCDmarkers = this.applyMarkerPolation(calcType);
      if (NoCDmarkers.length !== 0){
        this.setError("","E016: "+NoCDmarkers.length+" markers without " + calcType);
        console.log("LCCore: E016: "+NoCDmarkers.length+" markers without " + calcType);
        //console.log(NoCDmarkers);
      }
      console.timeEnd("    interpolate")
    }    

    //calc & submit project top/bottom
    if (calcType=="composite_depth"){
      for(let p=0;p<this.projects.length;p++){
        let CD_bottom = -Infinity;
        let CD_top = Infinity;
        this.projects[p].holes.forEach(h=>{
          h.sections.forEach(s=>{
            s.markers.forEach(m=>{
              if(m.composite_depth && m.composite_depth>CD_bottom){
                CD_bottom = m.composite_depth;
              }
              if(m.composite_depth && m.composite_depth<CD_top){
                CD_top = m.composite_depth;
              }
            })
          })
        })

        if(CD_bottom == -Infinity){
          CD_bottom = 1000;
        }
        if(CD_top == Infinity){
          CD_top = 0;
        }
        
        this.projects[p].composite_depth_top = CD_top;
        this.projects[p].composite_depth_bottom = CD_bottom;
      }
    }
    this.setStatus("completed","Calaced search depth.")
  }

  convertDepthDuo2Master(calcType){
    if(calcType !== "composite_depth" && calcType !=="event_free_depth"){
      this.setError("","E000: Unsupported calcType for convertDepthDuo2Master: "+calcType);
      this.setStatus("completed","convertDepthDuo2Master aborted (unsupported calcType).");
      return;
    }
    this.setStatus("running","start convertDepthDuo2Master");
    //get correlation CD/EFD list between base and duo
    let comparisonChart = [];
    for(let p=0;p<this.projects.length; p++){
      if(this.projects[p].id[0] == this.base_project_id[0]){
        //case base project
        comparisonChart.push([this.projects[p].id.toString(), null]);
        continue
      }

      //case duo project
      let visited = new Set();
      let comparisonData = [];

      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            const currentMarkerData = JSON.parse(JSON.stringify(this.projects[p].holes[h].sections[s].markers[m]));
            for(let c=0;c<this.projects[p].holes[h].sections[s].markers[m].h_connection.length;c++){
              const hConnectedId = this.projects[p].holes[h].sections[s].markers[m].h_connection[c];
              if(hConnectedId[0]==this.base_project_id[0]){
                if(!visited.has(hConnectedId.toString())){
                  for(let n=0;n<this.projects[p].holes[h].sections[s].markers[m].h_connection.length;n++){
                    //add all hconnection into visited
                    visited.add(this.projects[p].holes[h].sections[s].markers[m].h_connection[n].toString());
                  } 
                  const hConnectedMarkerData = JSON.parse(JSON.stringify(this.getDataByIdx(this.search_idx_list[hConnectedId.toString()])));
                  if(hConnectedMarkerData[calcType]!==null && currentMarkerData[calcType]!==null){
                    comparisonData.push([
                      hConnectedMarkerData.id,
                      hConnectedMarkerData.composite_depth,
                      hConnectedMarkerData.event_free_depth,
                      currentMarkerData.id,
                      currentMarkerData.composite_depth,
                      currentMarkerData.event_free_depth
                    ]);
                  }
                  /*                  
                  if(hConnectedMarkerData[calcType]!==null){
                    comparisonData.push([
                      hConnectedMarkerData.id,              //[0] base project
                      hConnectedMarkerData.composite_depth, //[1] base project
                      hConnectedMarkerData.event_free_depth,//[2] base project
                      currentMarkerData.id,                 //[3] duo project
                      currentMarkerData.composite_depth,    //[4] duo project
                      currentMarkerData.event_free_depth    //[5] duo project
                    ]);
                  }
                  */
                  
                }
              }
            }
          }
        }
      }

      //comparisonData.sort((a,b)=>a[1] - b[1]);//sort by base composite depth
      comparisonData.sort((a,b)=> (calcType=="event_free_depth" ? a[5]-b[5] : a[4]-b[4]));

      comparisonChart.push([this.projects[p].id.toString(), comparisonData]);      
    }

    //apply base CD/EFD
    for(let p=0;p<this.projects.length; p++){
      const [comparisonId, comparisonData] = comparisonChart[p];
      if(comparisonData == null){
        //if master project
        continue;
      }

      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            const currentMarkerData = this.projects[p].holes[h].sections[s].markers[m];
            if(calcType == "event_free_depth"){
              if(currentMarkerData.event_free_depth==null){
                continue;
              }
            }else{
              if(currentMarkerData.composite_depth==null){
                continue;
              }
            }
            
            //search upper and lower marker [base ID, base CD, base EFD, duo ID, duo CD, duo EFD]

            let upperIdx = -1;
            let lowerIdx = -1;
            let type = "none";

            const epsilon = 1e-3;
            for(let c=0;c<comparisonData.length;c++){ 
              if(calcType == "event_free_depth"){
                if (comparisonData[c][5] <= currentMarkerData.event_free_depth + epsilon) {
                  lowerIdx = c;
                }

                if (comparisonData[c][5] >= currentMarkerData.event_free_depth - epsilon) {
                  upperIdx = c;
                  break;
                }
              } else {
                if (comparisonData[c][4] <= currentMarkerData.composite_depth + epsilon) {
                  lowerIdx = c;
                }

                if (comparisonData[c][4] >= currentMarkerData.composite_depth - epsilon) {
                  upperIdx = c;
                  break;
                }
              }              
            }

            //check end of project
            if(lowerIdx !== -1){
              let val = null;
              if(calcType == "event_free_depth"){
                val = comparisonData[lowerIdx][2];//efd
              }else{
                val = comparisonData[lowerIdx][1];//cd
              }
              if(val==null){
                lowerIdx = -1;//extrapolate
              }
            }

            if(upperIdx !== -1){
              let val = null;
              if(calcType == "event_free_depth"){
                val = comparisonData[upperIdx][2];//efd
              }else{
                val = comparisonData[upperIdx][1];//cd
              }
              if(val==null){
                upperIdx = -1;//extrapolate
              }
            }

            if(upperIdx == -1 && lowerIdx == -1){
              this.setError("","E017: Undefined marker detected during connecinting duo model. " + this.getMarkerNameFromId(currentMarkerData.id));
              //console.log("LCCore: Undefiened marker detected during connecintg duo model. " + this.getMarkerNameFromId(currentMarkerData.id));
            }

            //case upward extrapolation(project top)
            if(upperIdx == -1 && lowerIdx !== -1){        
              let D1 = null;
              let D2 = null;
              let D3 = null;
              let d1 = null;
              let d2 = null;
              let d3 = null;
              if(calcType == "event_free_depth"){
                D3 = comparisonData[lowerIdx][2];
                d3 = comparisonData[lowerIdx][5];
                d2 = currentMarkerData.event_free_depth;
              } else {
                D3 = comparisonData[lowerIdx][1];
                d3 = comparisonData[lowerIdx][4];
                d2 = currentMarkerData.composite_depth;
              }

              if(D3 == null || d2 == null || d3 == null){
                //master model is null
                D2 = null;  
              }else{
                D2  = D3  - (d3 - d2);
              }
              this.projects[p].holes[h].sections[s].markers[m][calcType]  = D2;
            }

            //case downward extrapolation(project bottom)
            if(upperIdx !== -1 && lowerIdx == -1){              
              let D1 = null;
              let D2 = null;
              let D3 = null;
              let d1 = null;
              let d2 = null;
              let d3 = null;
              if(calcType == "event_free_depth"){
                D1 = comparisonData[upperIdx][2];
                d1 = comparisonData[upperIdx][5];
                d2 = currentMarkerData.event_free_depth;
              }else{
                D1 = comparisonData[upperIdx][1];
                d1 = comparisonData[upperIdx][4];
                d2 = currentMarkerData.composite_depth;
              }
              
              if(D1 == null || d2 == null || d1 == null){
                //master model is null
                D2 = null;
              }else{
                D2 = D1 + (d2 - d1);
              } 
              this.projects[p].holes[h].sections[s].markers[m][calcType] = D2;
            }

            //case interpolation
            if(upperIdx !== -1 && lowerIdx !== -1){
              let D1 = null;
              let D2 = null;
              let D3 = null;
              let d1 = null;
              let d2 = null;
              let d3 = null;

              if(calcType == "event_free_depth"){
                D1 = comparisonData[upperIdx][2]; //base project
                d1 = comparisonData[upperIdx][5]; //duo project
                D3 = comparisonData[lowerIdx][2]; //base project
                d3 = comparisonData[lowerIdx][5]; //duo project
                d2 = currentMarkerData.event_free_depth; //duo project
              }else{
                D1 = comparisonData[upperIdx][1];
                d1 = comparisonData[upperIdx][4];
                D3 = comparisonData[lowerIdx][1];
                d3 = comparisonData[lowerIdx][4];
                d2 = currentMarkerData.composite_depth;
              }
               
              if(D1 == null || D3 == null || d1 == null || d2 == null || d3 == null){
                //master model is null
                D2 = null;
              }else{
                const d2d1 = d2 - d1;
                const d3d1 = d3 - d1;
                
                D2 = this.linearInterp(D1, D3, d2d1, d3d1);                
              }
              //console.log(this.getMarkerNameFromId(comparisonData[lowerIdx][3])+"--"+this.getMarkerNameFromId(currentMarkerData.id)+"--"+this.getMarkerNameFromId(comparisonData[upperIdx][3]));
         

              this.projects[p].holes[h].sections[s].markers[m][calcType] = D2;
            }
            
          }
        }
      }
    }

    //get project top/bottom  
    for(let p=0;p<this.projects.length; p++){
      let projectCdTop = Infinity;
      let projectCdBottom = -Infinity;
      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            const cd = this.projects[p].holes[h].sections[s].markers[m].composite_depth;
            if(cd && cd > projectCdBottom){
              projectCdBottom = cd;;
            }
            if(cd && cd < projectCdTop){
              projectCdTop = cd;
            }
          }
        }
      }

      if(projectCdBottom  == -Infinity){
        projectCdBottom  = 1000;
      }
      if(projectCdTop == Infinity){
        projectCdTop = 0;
      }

      this.projects[p].composite_depth_top = projectCdTop;
      this.projects[p].composite_depth_bottom = projectCdBottom;
    }
   
    this.setStatus("completed","Converted duo depth to master depth.")
  }
  getModelSummary() {
    this.setStatus("running","start getModelSummary");
    console.log("==================================");
    console.log("           Model summary          ");
    console.log("----------------------------------");
    for (let p = 0; p < this.projects.length; p++) {
      console.log("==================================");
      console.log("Project ID: " + this.projects[p].id);
      console.log("Project name: " + this.projects[p].name);

      const num_holes = this.projects[p].holes.length;
      console.log("Holes: " + num_holes);

      for (let h = 0; h < num_holes; h++) {
        let hole_name = this.projects[p].holes[h].name;
        //console.log(this.projects[p].holes[h]);
        const num_sections = this.projects[p].holes[h].sections.length;
        console.log("Hole name: " + hole_name);

        let num_markers = 0;
        for (let s = 0; s < num_sections; s++) {
          const num_markers_temp =
            this.projects[p].holes[h].sections[s].markers.length;
          num_markers += num_markers_temp;
        }
        console.log("   Total sections: " + num_sections);
        console.log("   Total markers: " + num_markers);
        console.log("----------------------------------");
      }
    }

    console.log("==================================");
    this.setStatus("completed","Checked model summary");
  }
  checkModel(...args) {
    this.setStatus("running", "start checkModel");
    if (!this.projects || this.projects.length === 0) {
      this.setError("", "E018: There is no project data.");
      console.log("E018: There is no project data.");
      return;
    }

    this.updateSearchIdx();

    let results = [];

    this.projects.forEach((project) => {
      let result = {
        id: project.id,
        name: project.name,
        type: project.model_type,
        evaluation: false,
        is_connected_master: false,
        distance_confliction_counts: 0,
        distance_confliction: [],
        distance_confliction_name: [],

        cd_error_incompleted_counts: 0,
        cd_error_floating_counts: 0,
        cd_confliction_counts: 0,
        cd_confliction: [],
        cd_confliction_name: [],

        efd_error_incompleted_counts: 0,
        efd_error_floating_counts: 0,
        efd_confliction_counts: 0,
        efd_confliction: [],
        efd_confliction_name: [],

        rank_error_counts: 0,
        age_error_counts: 0,
        age_confliction_counts: 0,
        age_confliction: [],
        age_confliction_name: [],

        max_rank: -1,
        hole_counts: 0,
        section_counts: 0,
        marker_counts: 0,
        connection_counts: {},
        connection_duo_counts: 0,
      };

      // Initialise connection_counts
      this.projects.forEach((p) => {
        result.connection_counts[p.name] = 0;
      });

      if (project.model_type === "correlation") {
        result.is_connected_master = true;
      }

      project.holes.forEach((hole) => {
        result.hole_counts += 1;
        
        hole.sections.forEach((section) => {
          result.section_counts += 1;
          const epsilon = 1e-3;
          let inDuplicateGroup = false;

          section.markers.forEach((marker, index) => {
            result.marker_counts += 1;

            // --- 1. Distance Duplicates ---
            if (index > 0) {
              const prevMarker = section.markers[index - 1];
              if (Math.abs(marker.distance - prevMarker.distance) < epsilon) {
                if (!inDuplicateGroup) {
                  // Record the first marker of the duplicate group
                  result.distance_confliction_counts += 1;
                  result.distance_confliction.push(prevMarker.id);
                  result.distance_confliction_name.push(`${hole.name}-${section.name}-${prevMarker.distance}cm`);
                  inDuplicateGroup = true;
                }
                // Record the subsequent markers of the duplicate group
                result.distance_confliction_counts += 1;
                result.distance_confliction.push(marker.id);
                result.distance_confliction_name.push(`${hole.name}-${section.name}-${marker.distance}cm`);

                console.log(`LCCore: Duplicate distances detected at: ${hole.name}-${section.name}-${marker.distance}cm`);
              } else {
                inDuplicateGroup = false;
              }
            }

            // --- 2. Depth/Age/Rank Errors (Missing Data) ---
            // Prevent access errors to null or undefined properties
            const isFloating = marker.depth_source && marker.depth_source[0] === "floating";

            if (marker.composite_depth == null) {
              isFloating ? result.cd_error_floating_counts++ : result.cd_error_incompleted_counts++;
            }
            if (marker.event_free_depth == null) {
              isFloating ? result.efd_error_floating_counts++ : result.efd_error_incompleted_counts++;
            }
            if (marker.age == null) {
              result.age_error_counts++;
            }

            if (marker.connection_rank == null) {
              result.rank_error_counts++;
            } else if (marker.connection_rank > result.max_rank) {
              result.max_rank = marker.connection_rank;
            }

            // --- 3. Consolidated Connections & Conflictions Check ---
            // Consolidated four forEach loops into one to improve performance
            if (marker.h_connection && Array.isArray(marker.h_connection)) {
              marker.h_connection.forEach((hc) => {
                const hidx = this.search_idx_list[hc.toString()];
                if (!hidx) return;

                const connectedProject = this.projects[hidx[0]];
                const connectedMarker = connectedProject.holes[hidx[1]].sections[hidx[2]].markers[hidx[3]];

                // CD Confliction (Use != null so that 0 is not evaluated as false)
                if (marker.composite_depth != null && connectedMarker.composite_depth != null) {
                  if (marker.composite_depth !== connectedMarker.composite_depth) {
                    result.cd_confliction_counts += 1;
                    result.cd_confliction.push(marker.composite_depth - connectedMarker.composite_depth);
                    result.cd_confliction_name.push(`${hole.name}-${section.name}-${marker.distance}cm`);
                  }
                }

                // EFD Confliction
                if (marker.event_free_depth != null && connectedMarker.event_free_depth != null) {
                  if (marker.event_free_depth !== connectedMarker.event_free_depth) {
                    result.efd_confliction_counts += 1;
                    result.efd_confliction.push(marker.event_free_depth - connectedMarker.event_free_depth);
                    result.efd_confliction_name.push(`${hole.name}-${section.name}-${marker.distance}cm`);
                  }
                }

                // Age Confliction
                if (marker.age != null && connectedMarker.age != null) {
                  if (marker.age !== connectedMarker.age) {
                    result.age_confliction_counts += 1;
                    result.age_confliction.push(marker.age - connectedMarker.age);
                    result.age_confliction_name.push(`${hole.name}-${section.name}-${marker.distance}cm`);
                  }
                }

                // Connection checks (Bidirectional)
                connectedMarker.h_connection.forEach((hc2) => {
                  if (hc2.toString() === marker.id.toString()) {
                    // Safely evaluate while maintaining the logic of hc[0] == project.id[0]
                    const isOwnProject = Array.isArray(project.id) && hc[0] == project.id[0];

                    if (isOwnProject) {
                      result.connection_counts[connectedProject.name] += 0.5;
                    } else {
                      result.connection_counts[connectedProject.name] += 1;
                    }

                    if (connectedProject.model_type === "correlation") {
                      result.is_connected_master = true;
                    }
                  }
                });
              });
            }
          });
        });
      });

      // --- 4. Final Evaluation & Logging ---
      result.evaluation = (result.cd_error_incompleted_counts === 0 && result.efd_error_incompleted_counts === 0);

      const logMessage = `LCCore: [${project.model_type}]${project.name}: Total interpolation error: CD:${result.cd_error_incompleted_counts}, EFD:${result.efd_error_incompleted_counts}, Rank:${result.rank_error_counts}, Max rank:${result.max_rank}, Age:${result.age_error_counts}`;
      
      this.setStatus("info", logMessage);
      
      // Safely check for undefined args[0]
      if (args.length > 0 && args[0] === true) {
        console.log(logMessage);
      }

      results.push(result);
    });

    this.setStatus("completed", "Checked model.");
    return results;
  }
  upgradeToLatestMembers(){
    //add new properties for previous version model
    this.projects.forEach(p=>{
      //add
      const newProject = new Project;
      for(const key in newProject){
        if(!(key in p)){
          p[key] = newProject[key];
          console.log("LCCore: Add new project properties", key);
        }
      }
      //remove
      for (const key in p) {
        if (!(key in newProject)) {
          delete p[key];
          console.log("LCCore: Removed extra project property:", key);
        }
      }

      p.holes.forEach(h=>{
        //add
        const newHole    = new Hole;
        for(const key in newHole){
          if(!(key in h)){
            h[key] = newHole[key];
            console.log("LCCore: Add new hole properties", key);
          }
        }
        //remove
        for (const key in h) {
          if (!(key in newHole)) {
            delete h[key];
            console.log("LCCore: Removed extra hole property:", key);
          }
        }

        h.sections.forEach(s=>{
          //add
          const newSection = new Section;
          for(const key in newSection){
            if(!(key in s)){
              s[key] = newSection[key];
              console.log("LCCore: Fixed section properties", key);
            }
          }
          //remove
          for (const key in s) {
            if (!(key in newSection)) {
              delete s[key];
              console.log("LCCore: Removed extra section property:", key);
            }
          }

          s.markers.forEach(m=>{
            //add
            const newMarker  = new Marker;
            for(const key in newMarker){
              if(!(key in m)){
                m[key] = newMarker[key];
                console.log("LCCore: Fixed marker properties",key);
              }
            }
            //remove
            for (const key in m) {
              if (!(key in newMarker)) {
                delete m[key];
                console.log("LCCore: Removed extra marker property:", key);
              }
            }
          })
        })
      })
    })
    

  }
  getDepthFromTrinity(targetId, trinityList, calcType, allowExtrapolation=false, isForce=false) {
    this.setStatus("running","start getDepthFromTrinity");

    let output = [];
    
    for (let t = 0; t < trinityList.length; t++) {
      //Initialize
      let upperIdxs = [];
      let lowerIdxs = [];

      if(trinityList[t].hole_name==null || trinityList[t].section_name==null || trinityList[t].distance==null){
        output.push([null, null, null, null, null, null]);        
        continue;
      } 
      const holeName    = lcfnc.zeroPadding(trinityList[t].hole_name);
      const sectionName = lcfnc.zeroPadding(trinityList[t].section_name);
      const distance    = parseFloat(trinityList[t].distance);

      //search upper/lower idex
      for(let p=0;p<this.projects.length;p++){
        if(targetId[0] == null || targetId[0] == this.projects[p].id[0]){

          for (let h = 0; h < this.projects[p].holes.length; h++) {
            const holeData = this.projects[p].holes[h];

            if(targetId[1] == null || targetId[1] == holeData.id[1]){
              for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
                const sectionData = holeData.sections[s];

                if(targetId[2] == null || targetId[2] == sectionData.id[2]){

                  let tempUpperIdx = null;
                  let tempLowerIdx = null;

                  for (let m = 0; m < this.projects[p].holes[h].sections[s].markers.length - 1; m++) {

                    //check name and distance
                    if (this.equalName(holeData.name, holeName)) {
                      if (this.equalName(sectionData.name, sectionName)) {
                        if (allowExtrapolation){
                          if(m == 0){
                            tempLowerIdx = [p, h, s, m];
                          }
                          if(m == this.projects[p].holes[h].sections[s].markers.length -1){
                            tempUpperIdx = [p, h, s, m + 1];
                          }
                        }

                        if (distance >= sectionData.markers[m].distance && distance <= sectionData.markers[m + 1].distance) {
                          tempUpperIdx = [p, h, s, m];
                          tempLowerIdx = [p, h, s, m + 1];
                        }

                      }
                    }
                  }
                  if(tempUpperIdx){
                    upperIdxs.push(tempUpperIdx);
                  }
                  
                  if(tempLowerIdx){
                    lowerIdxs.push(tempLowerIdx);
                  }
                }
              }
            }           
          }
        }
      }
      //check num of detection
      if (upperIdxs.length > 1 || lowerIdxs.length > 1) {
        console.log(upperIdxs, lowerIdxs)
        this.setError(
          "",
          "E019: Multiple inter/extrapolation sources were detected. [" +
            trinityList[t].name +
            " : " +
            trinityList[t].hole_name +
            "-" +
            trinityList[t].section_name +
            "-" +
            trinityList[t].distance +
            " cm]"
        )
        console.log(
          "ERROR: Duplicate set detected. [" +
            trinityList[t].name +
            " : " +
            trinityList[t].hole_name +
            "-" +
            trinityList[t].section_name +
            "-" +
            trinityList[t].distance +
            " cm]"
        );
        output.push([null, null, null, null, null]);
      }

      //extrapolation case
      if(upperIdxs.length == 0 || lowerIdxs.length == 0){        
        if(!allowExtrapolation){
          //console.log(upperIdxs, lowerIdxs)
          this.setError(
            "",
            "E018: Nearest unique marker set does not exist. [" +
              trinityList[t].name +
              " : " +
              trinityList[t].hole_name +
              "-" +
              trinityList[t].section_name +
              "-" +
              trinityList[t].distance +
              " cm]. Point is probably out of section."
            )
          console.log(
            "LCCore: Nearest unique marker set does not exist. [" +
              trinityList[t].name +
              " : " +
              trinityList[t].hole_name +
              "-" +
              trinityList[t].section_name +
              "-" +
              trinityList[t].distance +
              " cm]. Point is probably out of section."
          );
          
          output.push([null, null, null, null, null]);
          continue;
        }else{
          //extrapolation
          let Idx = null;
          if(Idx == null && upperIdxs.length == 0){
            Idx = lowerIdxs[0];
          }else if(Idx == null && lowerIdxs.length == 0){
            Idx = upperIdxs[0];
          }

          if(Idx===null || Idx === undefined){
            output.push([null, null, null, null, null]);
            continue;
          }

          const sectionId = this.projects[Idx[0]].holes[Idx[1]].sections[Idx[2]].id;
          
          //calc
          const D3   = this.projects[Idx[0]].holes[Idx[1]].sections[Idx[2]].markers[Idx[3]][calcType];
          const d1   = distance;
          const d3   = this.projects[Idx[0]].holes[Idx[1]].sections[Idx[2]].markers[Idx[3]].distance;
          const d3d1 = d3 - d1;
          const D3_rank = this.projects[Idx[0]].holes[Idx[1]].sections[Idx[2]].markers[Idx[3]].connection_rank;
          const D1   = this.linearExtrap(null, D3, null, d3d1, "linear");

          const new_rank = D3_rank + 2;

          output.push([sectionId, D1, new_rank,"extrapolation", "Parallel (outside)", this.projects[Idx[0]].model_type]);
          continue;
        }

      }

      //get section data
      let sectionId = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].id;
      const masterIdx = this.search_idx_list[this.base_project_id.toString()];


      //check duo connection
      const isMasterExist = this.projects.some(p=>{return p.model_type=="correlation"});
      let isConnectedMaster = false;

      if(isMasterExist && this.projects[upperIdxs[0][0]].model_type == "duo"){
        isConnectedMaster =
        this.projects[upperIdxs[0][0]].holes.some(h =>
          h.sections.some(s =>
            s.markers.some(m =>
              m.h_connection.some(hc =>
                hc[0] === this.base_project_id[0]
              )
            )
          )
        ) ?? false;
         
      }else if(this.projects[upperIdxs[0][0]].model_type == "correlation"){
        isConnectedMaster = true;
      }

      //calc duo depth
      if(isForce || (isMasterExist && isConnectedMaster)){
        //calc depth
        //get nearest cd/efd data
        const D1      = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].markers[upperIdxs[0][3]][calcType];
        const D3      = this.projects[lowerIdxs[0][0]].holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]].markers[lowerIdxs[0][3]][calcType];
        const d1      = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].markers[upperIdxs[0][3]].distance;
        const d3      = this.projects[lowerIdxs[0][0]].holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]].markers[lowerIdxs[0][3]].distance;
        const D1_rank = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].markers[upperIdxs[0][3]].connection_rank;
        const D3_rank = this.projects[lowerIdxs[0][0]].holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]].markers[lowerIdxs[0][3]].connection_rank;

        //check master
        const D1_master = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].markers[upperIdxs[0][3]].isMaster;
        const D3_master = this.projects[lowerIdxs[0][0]].holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]].markers[lowerIdxs[0][3]].isMaster;

        if (D1 == null || D3 == null) {
          this.setError("","E020: "+ calcType + " is empty.");
          //console.log("ERROR: " + calcType + " of value is empty.");
          //console.log("D1:" + D1 + "/D3:" + D3 + "/d1:" + d1 + "/d3:" + d3);

          output.push([null, null, null, null, null, null]);
          continue;
        }

        //calc interpolated depth between markers
        const d2d1 = distance - d1;
        const d3d1 = d3 - d1;
        const interpolatedDepth = this.linearInterp(D1, D3, d2d1, d3d1);
        const new_rank = Math.max(...[D1_rank, D3_rank]) + 1;
        if(D1_master && D3_master){
          output.push([sectionId, interpolatedDepth, new_rank, "interpolation", "Master", this.projects[upperIdxs[0][0]].model_type ]);
        }else{
          output.push([sectionId, interpolatedDepth, new_rank, "interpolation", "Parallel", this.projects[upperIdxs[0][0]].model_type ]);
        }
        
      }else{
        //case not calc depth
        output.push([null, null, null, null, null, null]);
      }


      
    }
    this.setStatus("completed","");
    return output;
  }
  getEFDfromCD(targetCD) {
    this.setStatus("running","start getEFDfromCD");
    //Initialise   
    let upperData = {
      id: null,
      nearest_data: { event_free_depth: null, composite_depth: null },
      cumulate_distance: -Infinity,
    };
    let lowerData = {
      id: null,
      nearest_data: { event_free_depth: null, composite_depth: null },
      cumulate_distance: Infinity,
    };

    //search nearest markers
    this.projects.forEach((project)=>{
      project.holes.forEach((hole) => {
        hole.sections.forEach((section) => {
          section.markers.forEach((marker) => {
            if(marker.depth_source[0] =="master"){
              const temp = marker.composite_depth - targetCD;
              if (temp <= 0 && upperData.cumulate_distance < temp) {
                //console.log(this.getMarkerNameFromId(marker.id));
                upperData.id = marker.id;
                upperData.nearest_data.composite_depth = marker.composite_depth;
                upperData.nearest_data.event_free_depth = marker.event_free_depth;
                upperData.cumulate_distance = temp;
              }
              if (temp >= 0 && lowerData.cumulate_distance > temp) {
                lowerData.id = marker.id;
                lowerData.nearest_data.composite_depth = marker.composite_depth;
                lowerData.nearest_data.event_free_depth = marker.event_free_depth;
                lowerData.cumulate_distance = temp;
              }
            }
          });
        });
      });
    })

    //calc interpolated event free depth
    const D1 = parseFloat(upperData.nearest_data.event_free_depth);
    const D3 = parseFloat(lowerData.nearest_data.event_free_depth);
    const d1 = upperData.nearest_data.composite_depth;
    const d2 = targetCD;
    const d3 = lowerData.nearest_data.composite_depth;

    const d2d1 = d2 - d1;
    const d3d1 = d3 - d1;

    let interpolatedEFD = this.linearInterp(D1, D3, d2d1, d3d1);

    this.setStatus("completed","");
    return interpolatedEFD;
  }
  getCDfromEFD(targetEFD) {
    this.setStatus("running","start getCDfromEFD");
    //this method is return paseudo result because multiple CDs are match.
    //Initialise
    let upperData = {
      id: null,
      nearest_data: { event_free_depth: null, composite_depth: null },
      cumulate_distance: -Infinity,
    };
    let lowerData = {
      id: null,
      nearest_data: { event_free_depth: null, composite_depth: null },
      cumulate_distance: Infinity,
    };

    this.projects.forEach((project)=>{
      project.holes.forEach((hole) => {
        hole.sections.forEach((section) => {
          section.markers.forEach((marker) => {
            const temp = marker.event_free_depth - targetEFD;
            if (temp <= 0 && upperData.cumulate_distance < temp) {
              //console.log(this.getMarkerNameFromId(marker.id));
              upperData.id = marker.id;
              upperData.nearest_data.composite_depth = marker.composite_depth;
              upperData.nearest_data.event_free_depth = marker.event_free_depth;
              upperData.cumulate_distance = temp;
            }
            if (temp >= 0 && lowerData.cumulate_distance > temp) {
              lowerData.id = marker.id;
              lowerData.nearest_data.composite_depth = marker.composite_depth;
              lowerData.nearest_data.event_free_depth = marker.event_free_depth;
              lowerData.cumulate_distance = temp;
            }
          });
        });
      });
    })
    
    const D1 = upperData.nearest_data.composite_depth;
    const D3 = lowerData.nearest_data.composite_depth;
    const d1 = upperData.nearest_data.event_free_depth;
    const d2 = targetEFD;
    const d3 = lowerData.nearest_data.event_free_depth;
    const d2d1 = d2 - d1;
    const d3d1 = d3 - d1;

    const interpolatedEFD = this.linearInterp(D1, D3, d2d1, d3d1);

    this.setStatus("completed","");
    return interpolatedEFD;
  }
  InitialiseCDEFD(){
    this.setStatus("running","start InitialiseCDEFD");
    for(let p=0; p<this.projects.length;p++){
      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            //Initialise
            this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
            this.projects[p].holes[h].sections[s].markers[m].event_free_depth= null;
            this.projects[p].holes[h].sections[s].markers[m].connection_rank = null;
            this.projects[p].holes[h].sections[s].markers[m].unreliability   = null;
            this.projects[p].holes[h].sections[s].markers[m].depth_source    = ["", null, null]
          }
        }
      }
    }

    //initiarise cache
    this._pathCache = {};
    this._distanceCache = {};

    console.log("LCCore: Initiarised CD & EFD");
    this.setStatus("completed","Initialised");
  }
  calcMarkerAges(LCAge) {
    LCAge.updateAgeDepth(this);
    this.setStatus("running","start calcMarkerAges");
    if (this.projects.length == 0) {
      this.setError("E021: There is no correlation model.")
      console.log("","LCCore: E021: There is no correlation model.");
      return;
    }

    //if (LCAge.AgeModels.length == 0) {
    //  this.setError("","E022: There is no age model.")
    //  console.log("LCCore: E022: There is no age model.");
    //  return;
    //}

    //check mater model connection
    let isMasterModelConnected = false;
    let masterIdx = null
    this.projects.forEach((p,i)=>{
      if(p.id[0] === this.base_project_id[0] && p.model_type==="correlation"){
        isMasterModelConnected = true;
        masterIdx = i;
      }
    })

    if(!isMasterModelConnected){
      //initiarise
      this.projects.forEach(p=>{
        p.holes.forEach(h=>{
          h.sections.forEach(s=>{
            s.markers.forEach(m=>{
              m.age = null;
            })
          })
        })
      })
      return
    }

    //calc main
    for (let p = 0; p < this.projects.length; p++) {
      //check connection
      const isConnected = this.isConnectMasterProject(this.projects[p].id);
      console.log("LCCore: Master Project Connection: "+this.projects[p].name, isConnected)

      for (let h = 0; h < this.projects[p].holes.length; h++) {
        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
          for (let m = 0; m < this.projects[p].holes[h].sections[s].markers.length; m++) {
            const marker = this.projects[p].holes[h].sections[s].markers[m];

            if(LCAge.AgeModels.length == 0){
              //without age model (initialise)
              this.projects[p].holes[h].sections[s].markers[m].age = null;
            }else{
              if (marker.event_free_depth !== null) {
                if(isConnected){
                  const age = LCAge.getAgeFromEFD(marker.event_free_depth, "linear"); //{age: { type: null, mid: null, upper: null, lower: null }, age_idx:null};
                  this.projects[p].holes[h].sections[s].markers[m].age = age.age.mid;
                }else{
                  this.projects[p].holes[h].sections[s].markers[m].age = null;
                }                
              }
            }

          }
        }
      }
    }
    this.setStatus("completed","");    
  }
  findSectionIdByName(projectId, hole_name, section_name) {
    this.setStatus("running","start findSectionIdByName");
    let projectIdx = null;
    this.projects.forEach((project, p) => {
      if (project.id[0] == projectId[0]) {
        projectIdx = [p, null, null, null];
      }
    });
    //get section id
    let section_ids = [];

    const num_holes = this.projects[projectIdx[0]].holes.length;
    for (let h = 0; h < num_holes; h++) {
      if (this.projects[projectIdx[0]].holes[h].name === hole_name) {
        const num_sections =
          this.projects[projectIdx[0]].holes[h].sections.length;
        for (let s = 0; s < num_sections; s++) {
          if (
            this.projects[projectIdx[0]].holes[h].sections[s].name ===
            section_name
          ) {
            section_ids.push(
              this.projects[projectIdx[0]].holes[h].sections[s].id
            );
          }
        }
      }
    }

    if (section_ids.length == 1) {
      this.setStatus("completed","")
      return section_ids[0];
    } else if (section_ids.length == 0) {
      this.setError("","E023: There is no such a named section.:" + hole_name + "-" + section_name)
      console.log(
        "ERROR: E023: There is no such a named section.:" + hole_name + "-" + section_name
      );
    } else {
      this.setError("","E024: Duplicate ids exist.:" + hole_name + "-" + section_name+"/"+section_ids)
      console.log("ERROR: E024: Duplicate ids exist.");
      console.log(hole_name + "-" + section_name);
      console.log(section_ids);
      return null;
    }
    this.setStatus("completed","")
  }
  //subfunctions
  getHoleListFromCsv(projectData) {
    this.setStatus("running","start getHoleListFromCsv");
    //get model data
    const model_data = projectData._model_data;
    let start_col;
    if (projectData.model_type == "correlation") {
      start_col = 1;
    } else if (projectData.model_type == "duo") {
      start_col = 5;
    }

    //get hole list from csv
    let holeList = [];
    for (let i = start_col; i < model_data[0].length + 1; i += 4) {
      const str = model_data[0][i];
      if (str !== "" && str !== undefined) {
        let matches = str.match(/\(([^)]+)\)(?:\[(.*?)\])?/);

        let name = "";
        let type = "general";
        if (matches) {
          name = matches[1];
          if (
            matches[2] !== "" ||
            matches[2] == "general" ||
            matches[2] !== "piston"
          ) {
            type = matches[2];
          }

          holeList.push([i, name, type]);
        }
      }
    }
    this.setStatus("completed","")
    return holeList;
  }
  getSectionListFromCsv(projectData, holeIdx) {
    this.setStatus("running","start getSectionListFromCsv")
    //get model data
    const model_data = projectData._model_data;

    //holeIdx: retrurned from "getHoleListFromCsv"
    let sectionList = [];
    const topIndices = lcfnc.findCsvIdx(model_data, "top", null, holeIdx[0]);
    const bottomIndices = lcfnc.findCsvIdx(model_data, "bottom", null, holeIdx[0]);

    //check matches num of top and bottom
    if (topIndices.length === bottomIndices.length) {
      for (let i = 0; i < topIndices.length; i++) {
        const topStr = model_data[topIndices[i][0]][topIndices[i][1]];
        const bottomStr = model_data[bottomIndices[i][0]][bottomIndices[i][1]];
        const topSplitStr = topStr.split("-");
        const bottomSplitStr = bottomStr.split("-");
        //check name
        if (topSplitStr[0] == bottomSplitStr[0]) {
          if (topSplitStr[1] == bottomSplitStr[1]) {
            sectionList.push([
              holeIdx[0],
              [topIndices[i][0], bottomIndices[i][0]],
              topSplitStr[1],
            ]);
          } else {
            this.setErrorAlert(
              "",
              "E025: Section names between top and bottom does not matched.[Line: " +
                topIndices[i][0] +
                ", top name: " +
                topStr +
                ", bottom name: " +
                bottomStr +
                " ]"
              )
              console.log("L2275",topSplitStr , bottomSplitStr)
            console.log(
              "ERROR: E025: Section names between top and bottom does not matched.[Line: " +
                topIndices[i][0] +
                ", " +
                topStr +
                " != " +
                bottomStr +
                " ]"
            );
          }
        } else {
          this.setErrorAlert(
            "",
            "E026: Hole names does not matched.[Line: " +
              topIndices[i][0] +
              ", top name: " +
              topStr +
              ", bottom name: " +
              bottomStr +
              "]"
          )
          console.error(
            "LCCore: E026: Hole names does not matched.[Line: " +
              topIndices[i][0] +
              ", " +
              topStr +
              " != " +
              bottomStr +
              "]"
          );
        }
      }
    } else {
      if(topIndices.length > bottomIndices.length){
        this.setErrorAlert("","E027: There are fewr 'bottom' flags than 'top' flag.");
        console.log("ERROR: E027: There are fewr 'bottom' flags than 'top' flag.");
      }else{
        this.setErrorAlert("","E027: There are fewr 'top' flags than 'bottom' flag.");
        console.log("ERROR: E027: There are fewr 'top' flags than 'bottom' flag.");
      }
      
      return;
    }
    this.setStatus("completed","");
    return sectionList;
  }
  getMarkerListFromCsv(projectData, sectionIdx) {
    this.setStatus("running","start getMarkerListFromCsv")
    //get model data
    const model_data = projectData._model_data;

    //sectionIdx: returned from "getSectionListFromCsv"
    let markerList = [];
    for (let i = sectionIdx[1][0]; i < sectionIdx[1][1] + 1; i++) {
      const val = model_data[i][sectionIdx[0] + 1]; //check at distance col
      if (val !== "") {
        markerList.push(i);
      }
    }

    const output = [sectionIdx[0], sectionIdx[1], markerList];

    this.setStatus("completed","");
    return output;
  }
  connectEventPairs(projectId) {
    const projectIdx = this.search_idx_list[projectId.toString()];
    this.setStatus("running","start connectEventPairs")
    let isMakeNewMarker = false;
    const holeList = this.getHoleListFromCsv(this.projects[projectIdx[0]]);
    for (let h = 0; h < holeList.length; h++) {
      const sectionList = this.getSectionListFromCsv(this.projects[projectIdx[0]], holeList[h]
      );
      for (let s = 0; s < sectionList.length; s++) {
        const markerList = this.getMarkerListFromCsv( this.projects[projectIdx[0]], sectionList[s] );
        for (let m = 0; m < markerList[2].length; m++) {
          const num_e = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].event.length;
            isMakeNewMarker = false;
          for (let e = num_e - 1; e >= 0; e--) {
            const markerData = this.projects[projectIdx[0]].holes[h].sections[s].markers[m];
            const event = markerData.event[e];
            //================================================================================================
            if (event[0] == "deposition" || event[0] == "markup" || event[0] == "erosion") {
              if (event[2] == null) {
                //----------------------------------------------------------------------------------------------------
                //case defined by upper/lower/through, set connected event pair id
                if (event[1] == "downward" || event[1] == "through-down") {
                  //get lower marker
                  const currentIdx = this.search_idx_list[this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id.toString()];
                  let nextId = null;
                  this.projects[projectIdx[0]].holes[h].sections[s].markers[m].v_connection.forEach((vc) => {
                    const connectedIdx = this.search_idx_list[vc.toString()];
                    const diff = this.calcMarkerDistance(this.getDataByIdx(this.search_idx_list[vc]), this.projects[projectIdx[0]].holes[h].sections[s].markers[m], "composite_depth");
                    if (s==connectedIdx[2]){
                      if (diff >= 0) {
                        //if downward, same section
                        nextId = vc;
                      }
                    }
                  });

                  let nextIdx = this.search_idx_list[nextId];

                  //case out of section
                  if ( nextIdx[3] > this.projects[projectIdx[0]].holes[nextIdx[1]].sections[nextIdx[2]].markers.length ) {
                    continue;
                  }

                  //get lower next marker data
                  const nextMarkerData = this.getDataByIdx(nextIdx);
                  const events_next = nextMarkerData.event;

                  for (let i = 0; i < events_next.length; i++) {
                    const event_next = events_next[i];
                    if (event_next[0]=="deposition"||event_next[0]=="markup"||event_next[0]=="erosion") {
                      if (event_next[1] =="upward" || event_next[1] =="through-up") {
                        //connect current -> next
                        if (
                          this.projects[projectIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].event[e][2] == null
                        ) {
                          this.projects[projectIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].event[e][2] = nextMarkerData.id;
                        }

                        //connect next -> current
                        if (
                          this.projects[projectIdx[0]].holes[nextIdx[1]].sections[nextIdx[2]].markers[nextIdx[3]].event[i][2] == null
                        ) {
                          this.projects[projectIdx[0]].holes[nextIdx[1]].sections[nextIdx[2]].markers[nextIdx[3]].event[i][2] = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id;
                        }
                      }
                    }
                  }
                } else if (event[1] == "upward" || event[1] == "through-up") {
                  //----------------------------------------------------------------------------------------------------
                  //get upper marker
                  const currentIdx =
                    this.search_idx_list[
                      this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id.toString()
                    ];
                  let nextId = null;
                  this.projects[projectIdx[0]].holes[h].sections[s].markers[m].v_connection.forEach((vc) => {
                    const temopIdx = this.search_idx_list[vc];
                    const diff = this.calcMarkerDistance(vc, this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id, "composite_depth");
                    if (s == temopIdx[2]){
                      if (diff < 0) {
                        //if upward, same section
                        nextId = this.projects[projectIdx[0]].holes[temopIdx[1]].sections[temopIdx[2]].markers[temopIdx[3]].id;
                      }  
                    }
                  });

                  //check next is exist
                  if (nextId == null) {
                    continue;
                  }

                  let nextIdx = this.search_idx_list[nextId];

                  //get lower next marker data
                  const nextMarkerData = this.getDataByIdx(nextIdx);
                  const events_next = nextMarkerData.event;

                  for (let i = 0; i < events_next.length; i++) {
                    const event_next = events_next[i];
                    if (event_next[0]=="deposition"||event_next[0]=="markup"||event_next[0]=="erosion") {
                      if (event_next[1]=="downward" || event_next[1] == "through-down") {
                        //connect current -> next
                        if (
                          this.projects[projectIdx[0]].holes[currentIdx[1]]
                            .sections[currentIdx[2]].markers[currentIdx[3]]
                            .event[e][2] == null
                        ) {
                          this.projects[projectIdx[0]].holes[
                            currentIdx[1]
                          ].sections[currentIdx[2]].markers[
                            currentIdx[3]
                          ].event[e][2] = nextMarkerData.id;
                        }

                        //connect next -> current
                        if (
                          this.projects[projectIdx[0]].holes[nextIdx[1]].sections[nextIdx[2]].markers[nextIdx[3]].event[i][2] == null
                        ) {
                          this.projects[projectIdx[0]].holes[nextIdx[1]].sections[nextIdx[2]].markers[nextIdx[3]].event[i][2] = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id;
                        }
                      }
                    }
                  }
                } 
              }

              //if null, after set pair id
              if (event[2] == null) {
                this.setErrorAlert(
                  "",
                  "E028: There is no pair event maker at " +
                    this.getMarkerNameFromId(this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id)
                  );
                console.log(
                  "LCCore: E028: There is no pair event maker at " +
                    this.getMarkerNameFromId(this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id)
                );
                return;
              }

              //if num of set events are less than 2.
              if (event[2][2] === undefined) {
                //----------------------------------------------------------------------------------------------------
                //case defined by numerical thickness(upward/downward)
                //----------------------------------------------------------------------------------------------------
                const event_start_distance  = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].distance;
                let event_border_distance = null;
                let event_border_distance_for_check = null;
                let event_border_drilling_depth = null;

                if (event[0]=="erosion"){
                  event_border_drilling_depth = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].drilling_depth;
                  event_border_distance = event_start_distance;
                  event_border_distance_for_check = lcfnc.round(event_border_distance, 1);
                } else if (event[0]=="deposition" || event[0]=="markup"){
                  event_border_drilling_depth = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].drilling_depth + event[2];
                  event_border_distance = event_start_distance + event[2];
                  event_border_distance_for_check = lcfnc.round(event_border_distance,1);
                }
                const startIdx = this.search_idx_list[this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id.toString()];
                const targetSectionData = this.projects[projectIdx[0]].holes[startIdx[1]].sections[startIdx[2]];

                let previousIdx = startIdx;
                let previousMarkerData = targetSectionData.markers[previousIdx[3]];
                let currentIdx = [];
                let through_dir = [null, null];
                if (event[1] == "upward") {
                  for (let m2 = startIdx[3] - 1 ; m2 >=0; m2--) {
                    //get current data
                    const currentMarkerData = targetSectionData.markers[m2];
                    currentIdx = this.search_idx_list[currentMarkerData.id.toString()];
                    const current_distance = lcfnc.round(currentMarkerData.distance, 1);
                    if (current_distance > event_border_distance_for_check) {
                      //case through(layer exist between current and event border)
                      if (m2 == startIdx[3] - 1) {
                        //update event data of the defined marker(connected from)
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ];
                      } else {
                        //add through infomation into the through marker
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-up",
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ]);
                      }

                      //connect to
                      this.projects[projectIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].event.push([
                        event[0],
                        "through-down",
                        previousMarkerData.id,
                        event[3],
                        event[4],
                      ]);

                      //for next
                      previousIdx = currentIdx;
                      previousMarkerData = currentMarkerData;

                      //finish process
                      isMakeNewMarker = false;
                    } else if (current_distance == event_border_distance_for_check) {
                      ////, if match the distance
                      if (m2 == startIdx[3] -1) {
                        //update event data of the defined marker(connected from)
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ];
                      } else {
                        //add through infomation into the through marker
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-up",
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ]);
                      }

                      //connect to
                      this.projects[projectIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].event.push([
                        event[0],
                        "downward-down",
                        previousMarkerData.id,
                        event[3],
                        event[4],
                      ]);

                      isMakeNewMarker = false;
                      break;
                    } else if (current_distance < event_border_distance_for_check) {
                      through_dir = [m2 - (startIdx[3] - 1), "upward"];
                      isMakeNewMarker = true;
                      break;
                    }
                  }
                } else if (event[1] == "downward") {
                  for (let m2 = startIdx[3] + 1; m2 < targetSectionData.markers.length; m2++ ) {
                    //get current data
                    const currentMarkerData = targetSectionData.markers[m2];
                    currentIdx = this.search_idx_list[currentMarkerData.id.toString()];
                    const current_distance = lcfnc.round(currentMarkerData.distance,1);

                    if (current_distance < event_border_distance_for_check) {
                      //case through(layer exist between current and event border)

                      if (m2 == startIdx[3] + 1) {
                        //if first, update event

                        //connect from
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ];
                      } else {
                        //if not first

                        //connect from
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-down",
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ]);
                      }

                      //connect to
                      this.projects[projectIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].event.push([
                        event[0],
                        "through-up",
                        previousMarkerData.id,
                        event[3],
                        event[4],
                      ]);

                      //for next
                      previousIdx = currentIdx;
                      previousMarkerData = currentMarkerData;

                      isMakeNewMarker = false;
                    } else if ( current_distance == event_border_distance_for_check ) {
                      //if match the distance
                      if (m2 == startIdx[3] + 1) {
                        //if first

                        //connect from
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ];
                      } else {
                        //if not first
                        //connect from
                        this.projects[projectIdx[0]].holes[previousIdx[1]].sections[previousIdx[2]].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-down",
                          currentMarkerData.id,
                          event[3],
                          event[4],
                        ]);
                      }

                      //connect to
                      this.projects[projectIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].event.push([
                        event[0],
                        "downward-up",
                        previousMarkerData.id,
                        event[3],
                        event[4],
                      ]);

                      //finish process
                      isMakeNewMarker = false;
                      break;
                    } else if ( current_distance > event_border_distance_for_check ) {
                      through_dir = [m2 - (startIdx[3] + 1), "downward"];
                      isMakeNewMarker = true;
                      break;
                    }
                  }
                } 

                //----------------------------------------------------------------------------------------------------
                //defined and insert new marker
                //----------------------------------------------------------------------------------------------------
                if (isMakeNewMarker) {
                  let newDistance = null;
                  let upper_marker_id = null;
                  let lower_marker_id = null; 
                  let rate_upper = null;
                  let rate_lower = null;
                  let name = "";
                  if (event[0]=="deposition" || event[0]=="markup"){
                    [upper_marker_id, lower_marker_id, rate_upper, rate_lower] = this.getMarkerIdsByDistance(targetSectionData.id, event_border_distance);
                    newDistance = event_border_distance;     
                    //console.log(this.getMarkerNameFromId(upper_marker_id) +"=="+this.getMarkerNameFromId(lower_marker_id));                  
                  } else if (event[0]=="erosion"){
                    if (event[1] == "downward"){
                      [upper_marker_id, lower_marker_id, rate_upper, rate_lower] = this.getMarkerIdsByDistance(targetSectionData.id, event_border_distance+0.00001);
                      upper_marker_id = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id;
                      newDistance = event_start_distance;   
                      name = "erosion_bottom";
                    }    
                    //console.log(this.getMarkerNameFromId(upper_marker_id) +"=="+this.getMarkerNameFromId(lower_marker_id));      
                  }

                  const upper_marker_idx = this.search_idx_list[upper_marker_id];
                  const lower_marker_idx = this.search_idx_list[lower_marker_id];

                  //make new marker
                  //no marker at the event border
                  const newMarkerData = new Marker();
                  const newid = lcfnc.getUniqueId();
                  newMarkerData.id = [
                    targetSectionData.id[0],
                    targetSectionData.id[1],
                    targetSectionData.id[2],
                    newid,
                  ];

                  newMarkerData.distance = newDistance;
                  newMarkerData.name = name;
                  newMarkerData.drilling_depth = event_border_drilling_depth;
                  newMarkerData.event = [];
                  if (event[1] == "upward") {
                    newMarkerData.name = "";
                    newMarkerData.event.push([event[0], "downward", lower_marker_id, event[3], event[4]]);
                  } else if (event[1] == "downward") {
                    newMarkerData.name = "";
                    if(event[0]=="erosion"){
                      newMarkerData.event.push([event[0], "upward", upper_marker_id, event[3], -event[4]]);
                    }else{
                      newMarkerData.event.push([event[0], "upward", upper_marker_id, event[3], event[4]]);
                    }
                  }

                  newMarkerData.h_connection = [];
                  newMarkerData.v_connection = [];
                  const upperOrder = this.projects[projectIdx[0]].holes[upper_marker_idx[1]].sections[upper_marker_idx[2]].markers[upper_marker_idx[3]].order;
                  const lowerOrder = this.projects[projectIdx[0]].holes[lower_marker_idx[1]].sections[lower_marker_idx[2]].markers[lower_marker_idx[3]].order;
                  newMarkerData.order = (parseFloat(upperOrder)+parseFloat(lowerOrder)) / 2; //temp value
                  if (
                    this.projects[projectIdx[0]].holes[upper_marker_idx[1]].sections[upper_marker_idx[2]].markers[upper_marker_idx[3]].isMaster == true &&
                    this.projects[projectIdx[0]].holes[lower_marker_idx[1]].sections[lower_marker_idx[2]].markers[lower_marker_idx[3]].isMaster == true
                  ) {
                    newMarkerData.isMaster = true;
                  }

                  //add marker
                  this.projects[projectIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers.push(newMarkerData);
                  
                  //console.log(this.getDataByIdx(this.search_idx_list[upper_marker_id.toString()]));
                  //console.log(this.getDataByIdx(this.search_idx_list[lower_marker_id.toString()]));

                  //disconnect markers
                  this.disconnectMarkers(
                    upper_marker_id,
                    lower_marker_id,
                    "vertical"
                  );

                  //connect with new marker
                  this.connectMarkers(
                    upper_marker_id,
                    newMarkerData.id,
                    "vertical"
                  );
                  this.connectMarkers(
                    lower_marker_id,
                    newMarkerData.id,
                    "vertical"
                  );

                  //connect event
                  const connectedEventIdx = this.search_idx_list[newMarkerData.event[0][2]];
                  if (newMarkerData.event[0][1] == "upward") {
                    if (through_dir[0] == 0) {
                      //if first
                      //connect from
                      this.projects[projectIdx[0]].holes[connectedEventIdx[1]].sections[connectedEventIdx[2]].markers[connectedEventIdx[3]].event[e] = [
                        event[0],
                        event[1],
                        newMarkerData.id,
                        event[3],
                        event[4],
                      ];
                    } else {
                      //connect from
                      this.projects[projectIdx[0]].holes[connectedEventIdx[1]].sections[connectedEventIdx[2]].markers[connectedEventIdx[3]].event.push([
                        event[0],
                        "through-down",
                        newMarkerData.id,
                        event[3],
                        event[4],
                      ]);
                    }
                  } else if (newMarkerData.event[0][1] == "downward") {
                    if (through_dir[0] == 0) {
                      //if first
                      //connect from
                      this.projects[projectIdx[0]].holes[connectedEventIdx[1]].sections[connectedEventIdx[2]].markers[connectedEventIdx[3]].event[e] = [
                        event[0],
                        event[1],
                        newMarkerData.id,
                        event[3],
                        event[4],
                      ];
                    } else {
                      //connect from
                      this.projects[projectIdx[0]].holes[connectedEventIdx[1]].sections[connectedEventIdx[2]].markers[connectedEventIdx[3]].event.push([
                        event[0],
                        "through-up",
                        newMarkerData.id,
                        event[3],
                        event[4],
                      ]);
                    }
                  }

                  m = 0;
                  break;
                } else if (event.length > 0) {
                  //already connected
                } else {
                  this.setErrorAlert("","E029: Unsuspected error ocured at finding connected Deposition Event Pairs");
                  console.log(
                    "E029: Unsuspected error ocured at finding connected Deposition Event Pairs"
                  );
                }
                //----------------------------------------------------------------------------------------------------
              }
            }else if(event[0] == "connection"){
              if(event[1] == "downward"){
                outer :for(let s2 = s+1; s2<sectionList.length; s2++){
                  const sectionData2 = this.projects[projectIdx[0]].holes[h].sections[s2];
                  for(let m2 = 0; m2<sectionData2.markers.length; m2++){
                    for(let e2 = 0; e2<sectionData2.markers[m2].event.length; e2++){
                      const eventData2 = sectionData2.markers[m2].event[e2];
                      if(sectionData2.markers[m2].name.includes("-top") && eventData2[0] == "connection" && eventData2[1] == "upward"){
                        //if found connected pair
                        sectionData2.markers[m2].v_connection.push(markerData.id);
                        markerData.v_connection.push(sectionData2.markers[m2].id);
                        
                        //remove event
                        markerData.event.splice(e,1);
                        sectionData2.markers[m2].event.splice(e2,1);
                        break outer;
                      }
                    }
                  }
                }
              }
            }else {
              this.setErrorAlert("","E030: Undefiend type event detected at"+this.getMarkerNameFromId(this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id))
              console.log("E030: Undefiend type event detected at"+this.getMarkerNameFromId(this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id));
            }
          }
        }
      }
    }
    this.setStatus("completed","");
  }
  checkReliability(){
    //legacy
    //console.time("reliability")
    this.projects.forEach(project=>{
      project.holes.forEach(hole=>{
        hole.sections.forEach(section=>{
          section.markers.forEach(marker=>{
            const calcedEFD = this.getEFDfromCD(marker.composite_depth);
            if(Math.abs(marker.event_free_depth - calcedEFD) > 0.1){
              marker.unreliability = 1;
              //console.log(hole.name+"-"+section.name+": "+Math.abs(marker.event_free_depth - calcedEFD))
            }else{
              marker.unreliability = 0;
            }
          })
        })
      })
    })
    //console.timeEnd("reliability")
  }
  getMarkerNameFromId(id) {
    this.setStatus("running","start getMarkerNameFromId");
    if (id === null){
      this.setError("","E053: Input id is empty.")
      return null;
    } 

    const idx = this.search_idx_list[id.toString()];
    if(idx===undefined){
      this.setError("","E073: Traget index is undefined. The target may not be connected. ")
      return null
    } 
    
    const holeName   = this.projects[idx[0]].holes[idx[1]].name;
    const secName    = this.projects[idx[0]].holes[idx[1]].sections[idx[2]].name;
    const markerName = this.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].name;
    const output = "[" + holeName + "-" + secName + "-" + markerName + "]";
    this.setStatus("completed","")
    return output;
  }
  getDataByIdx(idxs) {
    this.setStatus("running","start getDataByIdx")
    let output;

    if(idxs==undefined) return output;

    if (idxs.filter(item => item !== null).length == 1) {
      //case project data
      output = this.projects[idxs[0]];
    } else if (idxs.filter(item => item !== null).length == 2) {
      //case hole data
      output = this.projects[idxs[0]].holes[idxs[1]];
    } else if (idxs.filter(item => item !== null).length == 3) {
      //case section data
      output = this.projects[idxs[0]].holes[idxs[1]].sections[idxs[2]];
    } else if (idxs.filter(item => item !== null).length == 4) {
      //case marker/event data
      output = this.projects[idxs[0]].holes[idxs[1]].sections[idxs[2]].markers[idxs[3]];
    }

    this.setStatus("completed","")
    return output;
  }
  sortModelByOrder() {
    this.setStatus("running","strat sortModelByOrder");
    //sort project by order
    this.projects.sort((a, b) => (a.order < b.order ? -1 : 1));

    for (let p = 0; p < this.projects.length; p++) {
      //sort hole by order
      this.projects[p].holes.sort((a, b) => (a.order < b.order ? -1 : 1));

      for (let h = 0; h < this.projects[p].holes.length; h++) {
        //sort section by order
        this.projects[p].holes[h].sections.sort((a, b) => a.order < b.order ? -1 : 1);
        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
          this.projects[p].holes[h].sections[s].markers.sort((a, b) => a.distance < b.distance ? -1 : 1);
        }
      }
    }

    //add new order
    this.projects.forEach((project, p) => {
      project.order = p;
      project.holes.forEach((hole, h) => {
        hole.order = h;
        hole.sections.forEach((section, s) => {
          section.order = s;
          section.markers.forEach((marker, m) => {
            marker.order = m;
          });
        });
      });
    });

    //update search_ids_list
    this.updateSearchIdx();
    this.setStatus("completed","");
  }
  sortModel() {
    this.setStatus("running","start sort model");
    //sort markers by distance
    for (let p = 0; p < this.projects.length; p++) {
      for (let h = 0; h < this.projects[p].holes.length; h++) {
        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
          this.projects[p].holes[h].sections[s].markers.sort((a, b) => a.distance < b.distance ? -1 : 1);
          for (let m = 0; m < this.projects[p].holes[h].sections[s].markers.length; m++){
            this.projects[p].holes[h].sections[s].markers[m].order = m;
          }
        }
      }
    }

    //sort section by drilling depth of top marker
    for (let p = 0; p < this.projects.length; p++) {
      for (let h = 0; h < this.projects[p].holes.length; h++) {      
        this.projects[p].holes[h].sections.sort((a, b) =>{
          return a.markers[0].drilling_depth < b.markers[0].drilling_depth ? -1 : 1
        });
        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++){
          this.projects[p].holes[h].sections[s].order = s;
        }
      }
    }

    //sort hole by order (name)
    for (let p = 0; p < this.projects.length; p++) {
      this.projects[p].holes.sort((a, b) => {
        return a.order < b.order ? -1 : 1;
        //return a.name.localeCompare(b.name);
      });
    }

    //sort project by order (name)
    this.projects.sort((a, b) => {
      return a.order < b.order ? -1 : 1;
      //return a.name.localeCompare(b.name);
    });

    //add new order
    this.projects.forEach((project, p) => {
      project.order = p;
      project.holes.forEach((hole, h) => {
        hole.order = h;
        hole.sections.forEach((section, s) => {
          section.order = s;
          section.markers.forEach((marker, m) => {
            marker.order = m;
          });
        });
      });
    });

    //update search_ids_list
    this.updateSearchIdx();
    this.setStatus("completed","");
  }
  updateSearchIdx() {
    this.setStatus("running","start updateSearchIdx");
    this.search_idx_list = {};
    for (let p = 0; p < this.projects.length; p++) {
      this.search_idx_list[this.projects[p].id.toString()] = [
        p,
        null,
        null,
        null,
      ];

      for (let h = 0; h < this.projects[p].holes.length; h++) {
        this.search_idx_list[this.projects[p].holes[h].id.toString()] = [
          p,
          h,
          null,
          null,
        ];

        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
          this.search_idx_list[
            this.projects[p].holes[h].sections[s].id.toString()
          ] = [p, h, s, null];
          for (
            let m = 0;
            m < this.projects[p].holes[h].sections[s].markers.length;
            m++
          ) {
            this.search_idx_list[
              this.projects[p].holes[h].sections[s].markers[m].id.toString()
            ] = [p, h, s, m];
          }
        }
      }
    }
    this.setStatus("completed","");
  }
  searchShortestVerticalPath(startId, endId) {
    this.setStatus("running","strat searchShortestVerticalPath");
    let visitedId = new Set(); 
    let queue = [];
    let previous = {};
    
    //Initialize
    queue.push(startId);
    visitedId.add(startId.toString());
    previous[startId.toString()] = null;
    
    while (queue.length > 0) {
      let currentId = queue.shift();  // get node from the top of queue
        
      // if reached goal
      if (currentId.toString() === endId.toString()) {
        // get path
        let path = [];
        let id = currentId;
        
  
        while (id !== null) {
          path.unshift(id);
          id = previous[id.toString()];
        }
  
        this.setStatus("completed","");
        return path;
      }
  
      // get current idx
      let currentIdx = this.search_idx_list[currentId.toString()];
  
      // get connected v_connection
      this.projects[currentIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].v_connection.forEach((v) => {
        if (!visitedId.has(v.toString())) {
          queue.push(v);
          visitedId.add(v.toString());
          previous[v.toString()] = currentId;
        }
      });
    }

    this.setStatus("completed","");
    return null;
  }
  findZeroPointId() {
    this.setStatus("running","start findZeroPointId");
    let output = [];
    
    this.projects.forEach((project,p) => {
      let numZropoints = 0;
      let visited = new Set();
      output.push(null);
      project.holes.forEach((hole) => {
        hole.sections.forEach((section) => {
          section.markers.forEach((marker) => {
        
            if (marker.isZeroPoint !== false) {
              if(!visited.has(marker.id.toString())){
                //first visit including h_connections
                numZropoints+=1;

                let isBaseProject = false;
                if (project.id[0] == this.base_project_id[0]) {
                  isBaseProject = true;
                } else {
                  isBaseProject = false;
                }

                output[p] = [marker.id, parseFloat(marker.isZeroPoint), isBaseProject];
              }
              if(numZropoints>1){
                this.setErrorAlert("","E031: There are multiple Zro Points.")
                console.error("LCCore: E031: There are multiple Zro Points.")
                return null;
              }
              
              visited.add(marker.id.toString());
              marker.h_connection.forEach(h=>{
                visited.add(h.toString());
              })
            }
            
          });
        });
      });
    });
    this.setStatus("completed","");
    return output;
  }
  graphSearch(startNodeId, startVal, calcType, method="bfs") {
    this.setStatus("running","start");
    //calc composite depth in the project containing start node
    let visited = new Set();
    let list = [];
    if (startNodeId == null) {
      this.setError("","E032: There is no Zero point.")
      console.log("LCCore: E032: There is no Zero point.");
      return null;
    }
    
    list.push([startNodeId, startVal, null, null]); // stack distance
    let results = {info:{}, depth:{}};

    let c=0;//for safty
    while (list.length > 0 && c<100000) {
      c++

      let data
      if(method==="dfs"){
        data = list.pop();
      }else{
        data = list.shift();
      }

      let markerId      = data[0];
      let stackDistance = data[1];
      let fromDir       = data[2];
      let parent        = data[3];

      if (visited.has(markerId.toString())) {
        continue;
      }

      visited.add(markerId.toString());
      results.depth[markerId.toString()] = stackDistance;
      results.info[markerId.toString()]  = {fromDirection:fromDir, parent:parent};

      let hNeighbors = this.getNeighborSet(markerId, calcType, "horizontal");
      let vNeighbors = this.getNeighborSet(markerId, calcType, "vertical");
      
      let hasHMaster = hNeighbors.some(n => n.master) ?? false;
      let hasVMaster = vNeighbors.some(n => n.master) ?? false;

      let nextTargets = [];
      if (hasHMaster && hasVMaster) {
        if (fromDir === "horizontal") {
            nextTargets = vNeighbors;
        } else if (fromDir === "vertical" || fromDir === "deeper" || fromDir === "shallower") {
            nextTargets = hNeighbors;
        } else {
            nextTargets = [...hNeighbors, ...vNeighbors];
        }
      } else {
        nextTargets = [...hNeighbors, ...vNeighbors];
      }

      for (let neighbor of nextTargets) {
        if (!visited.has(neighbor.id)) {
          list.push([
              neighbor.id,
              stackDistance + neighbor.distance,
              neighbor.direction,
              neighbor.parent
          ]);
        }
      }      
    }
    if(c===100000){
      this.setError("","E074: Graph traversal limit reached.");
    }

    this.setStatus("completed","");
    return results;
  }
  getNeighborSet(currentMarkerId, calcType, direction) {
    this.setStatus("running","strat getNeighborSet");
    let output = [];
    //get marker data
    const currentMarkerIdx = this.search_idx_list[currentMarkerId.toString()];
    const currentMarkerData = this.projects[currentMarkerIdx[0]].holes[currentMarkerIdx[1]].sections[currentMarkerIdx[2]].markers[currentMarkerIdx[3]];

    //get connections
    const hNeighborMarkerIds = currentMarkerData.h_connection;
    const vNeighborMarkerIds = currentMarkerData.v_connection;

    if(direction == "horizontal"){
      //get horizontal connection
      for (let h = 0; h < hNeighborMarkerIds.length; h++) {
        //get marker data
        if(hNeighborMarkerIds[h][0] !== currentMarkerId[0]){
          //if different project, skip
          continue
        }

        //console.log(currentMarkerId+"=>"+hNeighborMarkerIds[h])
        const neighborMarkerIdx  = this.search_idx_list[hNeighborMarkerIds[h].toString()];
        if(!neighborMarkerIdx){
          //if marker is not exit
          continue;
        }
        const neighborMarkerData = this.projects[neighborMarkerIdx[0]].holes[neighborMarkerIdx[1]].sections[neighborMarkerIdx[2]].markers[neighborMarkerIdx[3]];
      
        //get master connection
        if (currentMarkerData.isMaster == true && currentMarkerId[1] !== neighborMarkerData.id[1]) {
          //case same Project, different hole
          output.push({
            id: neighborMarkerData.id,
            parent: currentMarkerData.id,
            distance: 0,
            rank: neighborMarkerData.connection_rank,
            direction: "horizontal",                
            master: neighborMarkerData.isMaster
          });          
        }
      }
    }else{
      //get vertivcal connection
      for (let v = 0; v < vNeighborMarkerIds.length; v++) {
        if(vNeighborMarkerIds[v][0] !== currentMarkerId[0]){
          //if different project, skip
          continue
        }

        //vertical correlation
        const neighborMarkerIdx = this.search_idx_list[vNeighborMarkerIds[v]];
        if(!neighborMarkerIdx){
          //if marker is not exit
          continue;
        }
        const neighborMarkerData = this.projects[neighborMarkerIdx[0]].holes[neighborMarkerIdx[1]].sections[neighborMarkerIdx[2]].markers[neighborMarkerIdx[3]];
        let dir = "vertical";
        if(neighborMarkerData.distance < currentMarkerData.distance){
          dir = "deeper"
        }else{
          dir = "shallower";
        }

        //get master connections
        if (currentMarkerData.isMaster == true && neighborMarkerData.isMaster == true) {
          if (currentMarkerId[1] === neighborMarkerData.id[1]) {
            //case same project, same hole
            if (currentMarkerData.id[2] == neighborMarkerData.id[2]) {
              //case of the same core (general core type)
              let distanceMarkers = this.calcMarkerDistance(neighborMarkerData, currentMarkerData, calcType); 
  
              output.push({
                id: neighborMarkerData.id, 
                parent: currentMarkerData.id,
                distance: distanceMarkers, 
                rank: neighborMarkerData.connection_rank,
                direction: dir,
                master: neighborMarkerData.isMaster
              });

            } else {
              //case of different cores (piston core type)
              output.push({
                id: neighborMarkerData.id, 
                parent: currentMarkerData.id,
                distance: 0, 
                rank: neighborMarkerData.connection_rank,
                direction: "vertical",
                master: neighborMarkerData.isMaster
              });
            }
          }
        }
      }
    }
    
    this.setStatus("completed","");
    return output;
  }
  applyMarkerPolation(calcType) {
    this.setStatus("running","strat applyMarkerPolation");
    //get list of inter/extra polation in each project
    let skippedList = [];
    for (let p = 0; p < this.projects.length; p++) {
      
      let polationList;
      let interpolationList;
      let extrapolationList;

      //1.1. interpolate hconnected markers
      polationList = this.getPolationList(p, calcType, false);
      interpolationList = polationList.filter(item => item[0] === "interpolation");
      this.polation(interpolationList, calcType, "interpolation");

      //1.2. interpolate isolated markers
      polationList = this.getPolationList(p, calcType, true);
      interpolationList = polationList.filter(item => item[0] === "interpolation");
      this.polation(interpolationList, calcType, "interpolation");

      //2.1. extrapolate hconnected markers
      polationList = this.getPolationList(p, calcType, false);
      extrapolationList = polationList.filter(item => item[0] === "extrapolation");
      this.polation(extrapolationList, calcType, "extrapolation");

      //1.3. interpolate hconnected markers(between extrapolattion isolated markers)
      polationList = this.getPolationList(p, calcType, true);
      interpolationList = polationList.filter(item => item[0] === "interpolation");
      this.polation(interpolationList, calcType, "interpolation");

      //2.2. extrapolate isolated markers
      polationList = this.getPolationList(p, calcType, true);
      extrapolationList = polationList.filter(item => item[0] == "extrapolation");
      this.polation(extrapolationList, calcType, "extrapolation");

      polationList = this.getPolationList(p, calcType, "none");
      const floatingList = polationList.filter(item => item[0] === "floating");
      const incompletedList = polationList.filter(item => item[0] !== "floating");
      skippedList = polationList;

      skippedList.forEach(s=>{
        //console.log("L3361: ",this.getMarkerNameFromId(s[2]))
      })

      if(polationList.length>0){        
        if(floatingList.length>0){
          for (const [type, upperId, targetId, lowerId] of floatingList) {
            const targetIdx = this.search_idx_list[targetId.toString()]; 
            this.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]].depth_source[0] = "floating";
          }
        }
        
        console.log("LCCore: E033: Incompleted interpolation exist: Floating (N="+floatingList.length+") Incompleted(N="+incompletedList.length+")");
        if(incompletedList.length>0 && calcType == "composite_depth"){
          //this.setErrorAlert("","E033: Incompleted interpolations exist: Floating (N="+floatingList.length+") Incompleted(N="+incompletedList.length+")")
        }
        /*
        incompletedList.forEach(c=>{
          console.log(c[2]);
        })
          */
      }
        
    }
        
    //console.log("LCCore: from applyMarkerPolation ")
    if(this._measurePerformance ){
      console.log(this._performance)
    }
    
    this.setStatus("completed","");
    return skippedList;
  }
  getPolationList(p, calcType, isIsolated=false){
    this.setStatus("running","start getPolationList");
    let polationList = [];
    
    for (let h = 0; h < this.projects[p].holes.length; h++) {
      for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
        for (let m = 0; m < this.projects[p].holes[h].sections[s].markers.length; m++) {
          //check reversed markers
          const targetMarkerData = this.projects[p].holes[h].sections[s].markers[m];
          if(targetMarkerData[calcType]==null){
            //if target depth(CD/EFD) is null
            const targetId = targetMarkerData.id;
            let numConnections = 0;
            targetMarkerData.h_connection.forEach(hcId=>{
              if(hcId[0]===targetMarkerData.id[0]){
                numConnections+=1;
              }
            })

           

            if(isIsolated !== "none" && (isIsolated !== (numConnections===0))){
              continue;
            }

            //find nearest CD/EFD
            const nearestMarkers = this.measurePerformance(this.searchNearestMarkers, targetMarkerData, calcType);

            //polation type
            let polationType = "";
            if (nearestMarkers.upperId ==null && nearestMarkers.lowerId == null){
              polationType = "floating";
            } else if (nearestMarkers.upperId ==null || nearestMarkers.lowerId == null){
              polationType = "extrapolation";
            } else if (nearestMarkers.upperId !==null && nearestMarkers.lowerId !== null){
              polationType = "interpolation";
            }

            polationList.push([polationType, nearestMarkers.upperId, targetId, nearestMarkers.lowerId]);
          }
        }
      }
    }
    this.setStatus("completed","");
    return polationList;
  }
  polation(polationList, calcType, interpolationType="interpolation"){
   
    this.setStatus("running","start polation");
    if(polationList.length==0){
      this.setError("","E054: Input polation list is empty.");
      return null;
    }

    let skippedList = [];
    const interpolationRank = 1;
    const extrapolationRank = 3;

    //apply polation
    if(interpolationType == "interpolation"){
      //make group between the same markers
      const groupedList = {};
      for (let i = 0; i < polationList.length; i++) {
        const [type, upperId, targetId, lowerId] = polationList[i];
        if(type !== interpolationType){
          skippedList.push(polationList[i]);
          continue
        }
        const key = `${upperId.toString()}<->${lowerId.toString()}`;
        if (!groupedList[key]){
          groupedList[key] = [[type, upperId, targetId, lowerId]];
        } else{
          groupedList[key].push([type, upperId, targetId, lowerId]);
        }        
          
      }

      //calc by each group
      for (const key in groupedList) {
        //console.log(key)
        const group = groupedList[key];
        if(group.length == 0){
          continue
        }

        //get base data
        const upperId = group[0][1];
        const lowerId = group[0][3];
        const upperIdx = this.search_idx_list[upperId.toString()];
        const lowerIdx = this.search_idx_list[lowerId.toString()];
        const upperMarkerData = this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]];
        const lowerMarkerData = this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]];
        //const groupDistance   = this.calcMarkerDistance(lowerMarkerData,upperMarkerData,calcType);

        //1.calc reliable value
        let totalInterpPosError = 0;
        let numInterpolations = 0;
        for(let i=0; i<group.length;i++){
          const targetIdx = this.search_idx_list[group[i][2].toString()];
          const targetMarkerData = this.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]];
          const upperDistance = Math.abs(this.calcMarkerDistance(targetMarkerData,upperMarkerData,  calcType));
          const lowerDistance = Math.abs(this.calcMarkerDistance(lowerMarkerData, targetMarkerData, calcType));
          totalInterpPosError += upperDistance * lowerDistance;
          numInterpolations += 1;
        }

        //2. calc interpolation unreliability & get target lists
        let targetIds = [];
        for(let i=0; i<group.length;i++){
          const targetIdx = this.search_idx_list[group[i][2].toString()];
          const targetMarkerData = this.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]];

          targetIds.push(group[i][2]);
          targetMarkerData.unreliability = totalInterpPosError / numInterpolations;   
            
        }

        //3. apply horizontally connected markers
        this.interpolation(targetIds, upperMarkerData, lowerMarkerData, calcType, interpolationRank);

      }
    }else if(interpolationType == "extrapolation"){
      //make group between the same markers
      const groupedList = {};
      for (let i = 0; i < polationList.length; i++) {
        const [type, upperId, targetId, lowerId] = polationList[i];
        if(type !== interpolationType){
          skippedList.push(polationList[i]);
          continue
        }

        const key = `${upperId ? upperId.toString():""}<->${lowerId ? lowerId.toString():""}`;
        if (!groupedList[key]){
          groupedList[key] = [[type, upperId, targetId, lowerId]];
        } else{
          groupedList[key].push([type, upperId, targetId, lowerId]);
        }          
      }

      //calc by each group
      for (const key in groupedList) {
        const group = groupedList[key];
        if(group.length == 0){
          continue
        }

        //get base data
        const upperId = group[0][1];
        const lowerId = group[0][3];
        const upperIdx = upperId ? this.search_idx_list[upperId.toString()] : null;
        const lowerIdx = lowerId ? this.search_idx_list[lowerId.toString()] : null;
        const upperMarkerData = upperIdx ? this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]] : null;
        const lowerMarkerData = lowerIdx ? this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]] : null;

        //get reliable hole
        /*
        for(let i=0; i<group.length;i++){
          const targetIdx = this.search_idx_list[group[i][2].toString()];
          //const sourceIdx = this.search_idx_list[group[i][1] ? group[i][1].toString() : group[i][3].toString()];

          const targetMarkerData = this.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]];
          //const sourceMarkerData = this.projects[sourceIdx[0]].holes[sourceIdx[1]].sections[sourceIdx[2]].markers[sourceIdx[3]];

          targetMarkerData.unreliability = null;//because extrapolation
        }
        */

        //get target ids
        let targetIds = [];
        for(let i=0; i<group.length;i++){
          const targetIdx = this.search_idx_list[group[i][2].toString()];
          const targetMarkerData = this.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]];

          targetIds.push(group[i][2]);         

        }

        //apply extrapolation
        this.extrapolation(targetIds, upperMarkerData, lowerMarkerData, calcType, extrapolationRank);
      }
    }

    this.setStatus("completed","");
    return skippedList;
  }
 
  interpolation(targetIds, upperMarkerData, lowerMarkerData, calcType, interpolationRank=1){
    const maxRank = Math.max(upperMarkerData.connection_rank, lowerMarkerData.connection_rank);

    for(let i=0;i<targetIds.length;i++){
      const tIdx= this.search_idx_list[targetIds[i]];
      const targetMarkerData = this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]];

      //interpoilate
      const D1 = parseFloat(upperMarkerData[calcType]);
      const D3 = parseFloat(lowerMarkerData[calcType]);
      const d2d1 = -1 * parseFloat(this.calcMarkerDistance(upperMarkerData, targetMarkerData, calcType));
      const d3d1 = parseFloat(this.calcMarkerDistance(lowerMarkerData, targetMarkerData, calcType)) - parseFloat(this.calcMarkerDistance(upperMarkerData, targetMarkerData, calcType));
      const depth = this.linearInterp(D1, D3, d2d1, d3d1);

      //check data
      const reliableMarker = {id: targetMarkerData.id, unreliability: targetMarkerData.unreliability};
      for(let h=0; h<targetMarkerData.h_connection.length; h++){
        const hcIdx= this.search_idx_list[targetMarkerData.h_connection[h]];

        if(hcIdx && targetMarkerData.h_connection[h][0]===targetMarkerData.id[0]){
          const hcMarkerData = this.projects[hcIdx[0]].holes[hcIdx[1]].sections[hcIdx[2]].markers[hcIdx[3]];
          if(hcMarkerData.unreliability && reliableMarker.unreliability > hcMarkerData.unreliability){
            reliableMarker.id = hcMarkerData.id;
            reliableMarker.unreliability = hcMarkerData.unreliability;
          }          
        }
      }

      if(upperMarkerData.isMaster || lowerMarkerData.isMaster){
        reliableMarker.id = targetMarkerData.id;
        reliableMarker.unreliability = targetMarkerData.unreliability;
      }

      if(!reliableMarker.id || reliableMarker.id[3] !== targetMarkerData.id[3]){
        continue
      }      
      
      //set results
      targetMarkerData[calcType] = depth;
      targetMarkerData.connection_rank = maxRank + interpolationRank;
      targetMarkerData.depth_source = ["interpolation", upperMarkerData.id, lowerMarkerData.id];

      //3. transfer to h_connected marker
      for(let h=0; h<targetMarkerData.h_connection.length; h++){
        const hcId  = targetMarkerData.h_connection[h];
        const hcIdx = this.search_idx_list[hcId.toString()];

        if(!hcIdx || hcId[0] !== targetMarkerData.id[0]){
          continue
        }

        const hMarkerData = this.projects[hcIdx[0]].holes[hcIdx[1]].sections[hcIdx[2]].markers[hcIdx[3]];
        //set results
        hMarkerData[calcType] = depth;
        hMarkerData.connection_rank = maxRank + interpolationRank;
        hMarkerData.depth_source = ["transfer", targetMarkerData.id, null];
      }

    }
  }
  extrapolation(targetIds, upperMarkerData, lowerMarkerData, calcType, extrapolationRank=3){
    for(let i=0;i<targetIds.length;i++){
      const tIdx= this.search_idx_list[targetIds[i]];
      const targetMarkerData = this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]];
      
      //check
      const reliableMarker = {id: null, unreliability: null, isMaster: false};
      if(!reliableMarker.id || upperMarkerData?.isMaster || lowerMarkerData?.isMaster){
        reliableMarker.id = targetMarkerData.id;
        reliableMarker.unreliability = targetMarkerData.unreliability;
        if(upperMarkerData?.isMaster || lowerMarkerData?.isMaster){
          reliableMarker.isMaster = true;
        }
      }
     
      if(!reliableMarker.id || reliableMarker.id[3] !== targetMarkerData.id[3]){
        continue
      }
      if(targetMarkerData[calcType] && !reliableMarker.isMaster){
        continue
      }
               

      //apply
      if(upperMarkerData ===null && lowerMarkerData !== null){
        // upward extrapolation 
        const exDistance = this.calcMarkerDistance(targetMarkerData, lowerMarkerData, calcType);
        const depth = lowerMarkerData[calcType] + exDistance;


        if(!Number.isFinite(depth)){
          continue
        }

        
        targetMarkerData[calcType] = depth;
        targetMarkerData.connection_rank = lowerMarkerData.connection_rank + extrapolationRank;
        targetMarkerData.depth_source = ["extrapolation", null, lowerMarkerData.id];

        //transfer to h_connected marker
        for(let h=0; h<targetMarkerData.h_connection.length; h++){
          const hcId  = targetMarkerData.h_connection[h];
          const hcIdx = this.search_idx_list[hcId.toString()];

          if(!hcIdx || hcId[0] !== targetMarkerData.id[0]){
            continue
          }

          const hMarkerData = this.projects[hcIdx[0]].holes[hcIdx[1]].sections[hcIdx[2]].markers[hcIdx[3]];
          //set results
          hMarkerData[calcType] = depth;
          hMarkerData.connection_rank = lowerMarkerData.connection_rank + extrapolationRank;
          hMarkerData.depth_source = ["transfer", targetMarkerData.id, null];
        }

      }else if(upperMarkerData !== null && lowerMarkerData === null){
        // downward extrapolation
        const exDistance = this.calcMarkerDistance(targetMarkerData, upperMarkerData, calcType);
        const depth = upperMarkerData[calcType] + exDistance;

        targetMarkerData[calcType] = depth;
        targetMarkerData.connection_rank = upperMarkerData.connection_rank + extrapolationRank;
        targetMarkerData.depth_source = ["extrapolation", upperMarkerData.id, null];
        
        //transfer to h_connected marker]
        if(!targetMarkerData.isMaster){
          continue
        }
        for(let h=0; h<targetMarkerData.h_connection.length; h++){
          const hcId  = targetMarkerData.h_connection[h];
          const hcIdx = this.search_idx_list[hcId.toString()];

          if(!hcIdx || hcId[0] !== targetMarkerData.id[0]){
            continue
          }

          const hMarkerData = this.projects[hcIdx[0]].holes[hcIdx[1]].sections[hcIdx[2]].markers[hcIdx[3]];
          //set results
          hMarkerData[calcType] = depth;
          hMarkerData.connection_rank = upperMarkerData.connection_rank + extrapolationRank;
          hMarkerData.depth_source = ["transfer", targetMarkerData.id, null];
        }

      }else if(upperMarkerData === null && lowerMarkerData === null){
        // floating marker
        skippedList.push(targetIds[i]);
      }    
    }
  }
  searchNearestMarkers(startMarkerData, calcType) {
    this.setStatus("running","start searchNearestMarkers");
    //calcType:"composite_depth", "event_free_depth"
    //search vertically connected markers
    let connectedIds = this.searchVconnection(startMarkerData.id);
    let distanceData = [];
    for (let i=0; i<connectedIds.length; i++){
      let connectedId = connectedIds[i];
      let connectedMarkerData = this.measurePerformance(this.getDataByIdx,this.search_idx_list[connectedId.toString()]);

      if (connectedMarkerData[calcType] !== null){
        //check target is null?, calc distance by CD because of simplify
        const key = startMarkerData.id + "->" + connectedMarkerData.id;
        if(this._distanceCache[key]===undefined){
          this._distanceCache[key] = {
            distance: this.measurePerformance(this.calcMarkerDistance,connectedMarkerData, startMarkerData, "composite_depth"),
            id: connectedMarkerData.id
          };
        }

        distanceData.push(this._distanceCache[key]); 

        //distanceData.push({
        //  distance: this.measurePerformance(this.calcMarkerDistance,connectedMarkerData, startMarkerData, "composite_depth"),
        //  id: connectedMarkerData.id
        //})
      }

    }
    

    //find nearest markers
    let upperIdx = -1;
    let lowerIdx = -1;
    let lowerDistance = Infinity;
    let upperDistance = Infinity;
    let ownIdx = -1;
    let zeroIdx = -1;
    for (let i=0; i<distanceData.length; i++){
      const dist = distanceData[i];
      //lower case
      if(dist.distance > 0){
        if(Math.abs(dist.distance) < Math.abs(lowerDistance)){
          lowerDistance = dist.distance;
          lowerIdx = i;
        }        
      }
      //upper case
      if(dist.distance < 0 ){
        if(Math.abs(dist.distance) < Math.abs(upperDistance)){
          upperDistance = dist.distance;
          upperIdx = i;
        }        
      }
      //case interpolated marker distance is as same as upper/lower marker
      if(dist.distance == 0 ){
        if (dist.id.toString() == startMarkerData.id.toString()){
          //case target marker itself
          ownIdx = i;
        } else {
          //case upper/lower marker
          zeroIdx = i;
        }
      }
    }

    if (zeroIdx !== -1){
      //case interpolated marker is located on lower/upper marker.
      if(zeroIdx>ownIdx){
        upperIdx = zeroIdx;
      }else{
        lowerIdx = zeroIdx;
      }
    }

    let upperId = null;
    let lowerId = null;
    if (upperIdx !== -1){
      upperId = distanceData[upperIdx].id;
    }
    if (lowerIdx !== -1){
      lowerId = distanceData[lowerIdx].id;
    }

    /*
    if (startMarkerData.id.toString() == '1,2,2,'){
      console.log(this.getMarkerNameFromId(upperId)+" / "+this.getMarkerNameFromId(startMarkerData.id)+" / "+this.getMarkerNameFromId(lowerId));
      connectedIds.forEach(e=>{if(e[3]==1||e[3]==2||e[3]==3){
        console.log(e);
      }});
    }
    */
    this.setStatus("completed","");

    return {"upperId": upperId,"lowerId":lowerId};

  }
  calcMarkerDistance(neighborMarkerData, currentMarkerData, calcType){
    this.setStatus("running","start calcMarkerDistance");
    //this function is calced distance from the same hole for initial model construction.
    //pathIds contains defferent section and hole data
    if (neighborMarkerData == null || currentMarkerData == null){
      //case extrapolation
      this.setError("","E055: Input neighborMarkerData or currentMarkerData is empty.")
      return null;
    }

    //get connected node idbetween both markers
    const key = currentMarkerData.id + "->" + neighborMarkerData.id;
    const revKey = neighborMarkerData.id + "->" +currentMarkerData.id;
    let pathIds;
    if(this._pathCache[key]===undefined && this._pathCache[revKey] === undefined){
      this._pathCache[key]    = this.measurePerformance(this.searchShortestVerticalPath,currentMarkerData.id, neighborMarkerData.id);
    }
    pathIds = this._pathCache[key] ?? this._pathCache[revKey]?.slice().reverse();

    if(pathIds===undefined){
      return null;
    }
    
    
    if (pathIds == null){
      this.setErrorAlert("","E034: Connected path is not found between"+this.getMarkerNameFromId(currentMarkerData.id)+" and "+this.getMarkerNameFromId(neighborMarkerData.id))
      console.log("LCCore: E034: Connected path is not found between"+this.getMarkerNameFromId(currentMarkerData.id)+" and "+this.getMarkerNameFromId(neighborMarkerData.id));
      return null;
    }
    
    //calc composite depth
    let compositeThickness = 0;
    let eventThickness = 0;

    for (let i = 1; i < pathIds.length; i++){
      if (pathIds[i-1][1] == pathIds[i][1] && pathIds[i-1][2] == pathIds[i][2]){
        //case same hole & section
        let currentMarkerData   = this.getDataByIdx(this.search_idx_list[pathIds[i-1].toString()]);
        let connectedMarkerData = this.getDataByIdx(this.search_idx_list[pathIds[i].toString()]);

        //calc raw thickness [upward:-, downward:+]
        compositeThickness += connectedMarkerData.distance - currentMarkerData.distance;

        //calc event thickness E.G. ['deposition', 'upward', Array(4), 'general']
        if (calcType == "event_free_depth"){
          if (currentMarkerData.event.length == 0){
            //case No event
            eventThickness += 0;
          } else {
            eventThickness += 0;
            for (let e =0; e < currentMarkerData.event.length; e++){
              if (currentMarkerData.event[e][2] == null){
                //console.log(currentMarkerData)
                this.setErrorFatal("","E035: Event connection is not correct at "+this.getMarkerNameFromId(currentMarkerData.id));
                console.log("E035: Event connection is not correct at "+this.getMarkerNameFromId(currentMarkerData.id));
                return null;
              }
              if (currentMarkerData.event[e][2].toString() == connectedMarkerData.id.toString()){
                //case current marker is connected to connected marker with event layer
                const eventType = currentMarkerData.event[e][0];
                if (eventType == "deposition"){
                  eventThickness += connectedMarkerData.distance - currentMarkerData.distance;
                } else if (eventType == "erosion"){
                  eventThickness += connectedMarkerData.distance - currentMarkerData.distance + currentMarkerData.event[e][4];
                } else {
                  //case "markup"
                  eventThickness += 0;
                }
              } 
            }
          }  
        }
      } else if (pathIds[i-1][1] == pathIds[i][1] && pathIds[i-1][2] !== pathIds[i][2]){
        //case same hole, different section (case of piston core connection)
        compositeThickness += 0;
        eventThickness += 0;
      } else {
        //undefined case
        this.setError("","E036: Unsuspected case detected during calc marker distance between "+this.getMarkerNameFromId(currentMarkerData.id)+" and "+this.getMarkerNameFromId(neighborMarkerData.id))
        console.log("LCCore: E036: Unsuspected case detected during calc marker distance between "+this.getMarkerNameFromId(currentMarkerData.id)+" and "+this.getMarkerNameFromId(neighborMarkerData.id));
      }
    }

    //output
    let distance = 0;
    if (calcType == "composite_depth"){
      distance = compositeThickness;
    } else if (calcType == "event_free_depth"){
      distance = compositeThickness - eventThickness;
    }
    this.setStatus("completed","");
    return distance;
  }
  linearInterp(D1, D3, d2d1, d3d1){
    this.setStatus("running","start linearInterp");
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
    this.setStatus("completed","");
    return output;
  }
  linearExtrap(D2, D3, d3d2, d3d1, method){
    this.setStatus("running","start linearExtrap");
    //output(D2): target marker depth(e.g.CD/EFD)
    //D1(target out), D2, D3
    //d1(target in ), d2, d3

    let output = null;
    let D1 = null;

    if(method == "nearest"){
      if (d3d1 == 0) {
        //case defined markers on the duplicated same distance marker(e.g. core top)
        D1 = D3;
      } else {
        D1 = D3 - ((D3-D2)*(d3d1)/ (d3d2));
      }
  
    } else if(method == "linear"){
      D1 = D3 - d3d1;
    }

    if (!isNaN(D1) && D1 !== null) {
      output = D1;
    }
    this.setStatus("completed","");
    return output;
  }
  connectMarkers(fromId, toId, direction, isAlertDisconnection=true) {
    this.setStatus("running","start connectMarkers");
    if(fromId.toString()==toId.toString()){
      return;
    }
    //this.updateSearchIdx();
    const fromIdx = this.search_idx_list[fromId.toString()];
    const toIdx = this.search_idx_list[toId.toString()];
    if(!fromIdx && !toIdx) return;

    if (direction == "vertical") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });

      //check in connection of to
      this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //connect
      if (connectionIdxFrom == null && connectionIdxTo == null) {
        //connect markers
        this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].v_connection.push(toId);
        this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].v_connection.push(fromId);
        
        /*
        console.log(
          "Connected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
       return true
      } else {
        this.setError(
          "",
          "E037: Fail to connect markers because there are already connected between ." +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
          )
        /*
        console.log(
          "Fail to connect markers because there are already connected between ." +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
          return false;
      }
    } else if (direction == "horizontal") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from to avoid duplication
      this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });
      //check in connection of to to avoid duplication
      this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //check
      for(let h of this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection){
        if(h[0] == toId[0] && h[1] == toId[1]){
          //if connected same hole
          if(!(h[2] == toId[2] && h[3] == toId[3])){
            this.setErrorAlert(
              "",
              "E038: Fail to connect to " +
              this.getMarkerNameFromId(toId) +
              "markers because "+this.getMarkerNameFromId(fromId)+ 
              " have been connected the 'to hole' at " + 
              this.getMarkerNameFromId(h)
            )
            console.log("E038: Fail to connect to " +this.getMarkerNameFromId(toId) + "markers because "+this.getMarkerNameFromId(fromId)+ " have been connected the 'to hole' at " + this.getMarkerNameFromId(h));
            return;
          }
        }
      }
        
      for(let h of this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].h_connection){
        if(h[0] == fromId[0] && h[1] == fromId[1]){
          //if connected same hole
          if(!(h[2] == fromId[2] && h[3] == fromId[3])){
            this.setErrorAlert("","E039: Fail to connect to "+this.getMarkerNameFromId(fromId)+ " markers because "+this.getMarkerNameFromId(toId)+ " have been connected the 'to hole' at " + this.getMarkerNameFromId(h))
            console.log("E039: Fail to connect to "+this.getMarkerNameFromId(fromId)+ " markers because "+this.getMarkerNameFromId(toId)+ " have been connected the 'to hole' at " + this.getMarkerNameFromId(h));
            return;
          }
        }
      }

      //connect
      if (connectionIdxFrom == null) {
        this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection.push(toId);
      }

      if (connectionIdxTo == null) {
        this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].h_connection.push(fromId);
      }

      //connect horizontal correlation
      let hconnected = this.searchHconnection(fromId);
      
      hconnected.forEach((c) => {
        const ci = this.search_idx_list[c];
        if(ci){
          let newhconnected = hconnected.filter(item => item.toString() !== c.toString());
          this.projects[ci[0]].holes[ci[1]].sections[ci[2]].markers[ci[3]].h_connection = newhconnected;
        }else{
          if(isAlertDisconnection){
            console.log("LCCore: disconnected marker detected.",c)
          }          
        }        
      });
      return true
    } else {
      this.setErrorAlert("","E040: Fail to connect markers because direction is not correct.")
      console.log("E040: Fail to connect markers because direction is not correct.");
    }
    this.setStatus("completed","");
  }
  disconnectMarkers(fromId, toId, direction) {
    this.setStatus("running","start disconnectMarkers");
    this.updateSearchIdx();
    const fromIdx = this.search_idx_list[fromId.toString()];
    const toIdx = this.search_idx_list[toId.toString()];

    if (direction == "vertical") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });
      //check in connection of to
      this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //disconnect
      if (connectionIdxFrom !== null && connectionIdxTo !== null) {
        //disconnect markers
        this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].v_connection.splice(connectionIdxFrom, 1);
        this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].v_connection.splice(connectionIdxTo, 1);


        /*
        console.log(
          "Disconnected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
       return true
      } else {
        this.setError("","E041: Fail to disconnect markers because there is no connection between " + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId))
        console.log("E041: Fail to disconnect markers because there is no connection between " + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId));
        return false
      }
    } else if (direction == "horizontal") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      if(fromIdx){
        this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection.forEach((h_c, n) => {
          if (h_c.toString() == toId.toString()) {
            connectionIdxFrom = n;
          }
        });
      }
      
      //check in connection of to
      if(toIdx){
        this.projects?.[toIdx[0]]?.holes?.[toIdx[1]]?.sections?.[toIdx[2]]?.markers?.[toIdx[3]]?.h_connection.forEach((h_c, n) => {
          if (h_c.toString() == fromId.toString()) {
            connectionIdxTo = n;
          }
        });
      }      

      //disconnect
      if (connectionIdxFrom !== null && connectionIdxTo !== null) {
        this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection.splice(connectionIdxFrom, 1);
        this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].h_connection.splice(connectionIdxTo, 1);
        console.log(
          "Disconnected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        return true
      } else {
        this.setError("","E042: Fail to disconnect markers because there is no connection between ." + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId))
        console.log("E042: Fail to disconnect markers because there is no connection between ." + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId));
        return false
      }
    }
    this.setStatus("completed","");
  }
  checkEventConnection(fromId, toId){
    let results = {
      result: false,
      from: fromId,
      to: toId,
      connection:[fromId]
    };
    
    const markerConnections = this.searchShortestVerticalPath(fromId, toId);
    if(!markerConnections){
      //marker is not connected
      return results
    }
    if(markerConnections.length==1){
      results.result = true;
      return results;
    }

    let visitedId = new Set();
    visitedId.add(fromId);
    let prevId = fromId;

    outer: for(let i=1; i<markerConnections.length; i++){
      const prevMarkerData = this.getDataByIdx(this.search_idx_list[markerConnections[i-1].toString()]);
      const nextMarkerData = this.getDataByIdx(this.search_idx_list[markerConnections[i].toString()]);

      for(let ep = 0; ep<prevMarkerData.event.length; ep++){
        if(prevMarkerData.event[ep][2].toString() == nextMarkerData.id.toString()){
          for(let en = 0; en<nextMarkerData.event.length; en++){
            if(nextMarkerData.event[en][2].toString() == prevMarkerData.id.toString()){
              //if event connected
              results.connection.push(nextMarkerData.id);
              if(nextMarkerData.event[en][1].includes("through")){
                //if connect, goto next
                break;
              }else{
                break outer;
              }
            }
          }
        }        
      }
    }

    //check
    if(results.connection[results.connection.length-1].toString() == toId.toString()){
      results.result = true;
    }
    
    return results;
  }
  deleteMarker(targetId){
    this.setStatus("running","start deleteMarker");
    this.updateSearchIdx();
    const targetMarkerIdx = this.search_idx_list[targetId.toString()];
    const targetMarkerData = this.getDataByIdx(targetMarkerIdx);
    const targetSectionData = this.getDataByIdx(this.search_idx_list[[targetId[0],targetId[1],targetId[2],null].toString()]);
    let upperMarkerId = null;
    let lowerMarkerId = null;
    if(targetMarkerData.v_connection.length == 2){
      //case not top/bottom(excluding piston core)
      upperMarkerId = targetMarkerData.v_connection[0];
      lowerMarkerId = targetMarkerData.v_connection[1];
    } 
    
    //fix event connecttion
    const results = this.checkEventConnection(upperMarkerId, lowerMarkerId)
    if(results.result == true){
      //if event is connected between upper and lower
      
      const upperIdx = this.search_idx_list[upperMarkerId.toString()];
      const lowerIdx = this.search_idx_list[lowerMarkerId.toString()];
      const upperEvents = this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event;
      const lowerEvents = this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]].event;
      //fix upper marker
      for(let e=0;e<upperEvents.length;e++){
        if(upperEvents[e][2].toString() == results.connection[1].toString()){
          //if connect to lower direction
          upperEvents[e][2] = lowerMarkerId;
          break;
        }        
      }
      //fix lower marker
      for(let e=0;e<lowerEvents.length;e++){
        if(lowerEvents[e][2].toString() == results.connection[results.connection.length-2].toString()){
          //if connect to upper direction
          lowerEvents[e][2] = upperMarkerId;
          break;
        }        
      }

    }

    //trim target markerdata
    if(upperMarkerId !== null){
      //not top
      this.disconnectMarkers(upperMarkerId, targetId, "vertical");
    }
    if(lowerMarkerId !== null){
      this.disconnectMarkers(targetId, lowerMarkerId, "vertical");
    }
    if(upperMarkerId !== null && lowerMarkerId !== null){
      this.connectMarkers(upperMarkerId, lowerMarkerId, "vertical");
    }
    
    const newMarkers = targetSectionData.markers.filter(m=> m.id.toString() !== targetId.toString());
    this.projects[targetMarkerIdx[0]].holes[targetMarkerIdx[1]].sections[targetMarkerIdx[2]].markers = newMarkers;
    
    //remove from horizontal connection
    for(let id of targetMarkerData.h_connection){
      const connectedIdx = this.search_idx_list[id.toString()];
      const connectedMarkerData = this.projects[connectedIdx[0]].holes[connectedIdx[1]].sections[connectedIdx[2]].markers[connectedIdx[3]];
      
      this.projects[connectedIdx[0]].holes[connectedIdx[1]].sections[connectedIdx[2]].markers[connectedIdx[3]].h_connection 
          = connectedMarkerData.h_connection.filter(id=>id.toString() !== targetId.toString());
    }
    this.setStatus("completed","");
    return true
  }
  addMarker(...args){
    this.setStatus("running","start addMarker");
    const sectionId = args[0];
    const depth = args[1];
    const depthScale = args[2];
    let relative_x = null;
    if(args.length==4){
      relative_x = args[3];
    }

    this.updateSearchIdx()
    const sectionIdx  = this.search_idx_list[sectionId.toString()];
    const sectionData = this.getDataByIdx(sectionIdx);

    let newId = lcfnc.getUniqueId();
    const newMarkerId = [sectionId[0], sectionId[1], sectionId[2], newId];

    const results = this.getNearestTrinity(sectionId, depth, depthScale);

    let upperIdx = null;
    let lowerIdx = null;
    let lowerDistance = Infinity;
    let upperDistance = -Infinity;

    for(let m=0; m<this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers.length; m++){
      const marker_y0 = this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers[m].distance;
      if(marker_y0 - results.distance > 0 && Math.abs(lowerDistance) >= Math.abs(marker_y0 - results.distance)){
        lowerDistance = marker_y0 - results.distance;
        lowerIdx = m;
      }

      if(marker_y0 - results.distance <= 0 && Math.abs(upperDistance) >= Math.abs(marker_y0 - results.distance)){
        upperDistance = marker_y0 - results.distance;
        upperIdx = m;
      }
    }
    //console.log("Target is located between " +upperIdx+" and "+lowerIdx);

    const upperMarkerData = this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers[upperIdx];
    const lowerMarkerData = this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers[lowerIdx];
    const upperId = upperMarkerData.id;
    const lowerId = lowerMarkerData.id;

    //make new marker
    let newMarkerData = new Marker();
    newMarkerData.id = newMarkerId;
    newMarkerData[depthScale] = depth
    newMarkerData.distance = results.distance;
    newMarkerData.definition_relative_x = relative_x;
    if(depthScale !== "drilling_depth"){
      const D1 = upperMarkerData.drilling_depth;
      const D3 = lowerMarkerData.drilling_depth;
      const d1 = upperMarkerData[depthScale];
      const d2 = depth;
      const d3 = lowerMarkerData[depthScale];
      const d3d1 = d3 - d1;
      const d2d1 = d2 - d1;
      newMarkerData.drilling_depth = this.linearInterp(D1, D3, d2d1, d3d1);
    }
    
    if(this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers[upperIdx].isMaster == true && this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers[lowerIdx].isMaster == true){
      newMarkerData.isMaster = true;
    }

    //fix event connecttion
    const eventConnection = this.checkEventConnection(upperId, lowerId);
    let upperEventData = null;
    if(eventConnection.result==true){
      //if connected
      //upper
      for(let e=0; upperMarkerData.event.length; e++){
        if(upperMarkerData.event[e][2].toString() == lowerMarkerData.id.toString()){
          //if connected to lower marker, update
          upperMarkerData.event[e][2] = newMarkerData.id;
          upperEventData = JSON.parse(JSON.stringify(upperMarkerData.event[e]));
          break;
        }        
      }
      //new
      newMarkerData.event.push([upperEventData[0], "through-up",   upperId, upperEventData[3], upperEventData[4]]);
      newMarkerData.event.push([upperEventData[0], "through-down", lowerId, upperEventData[3], upperEventData[4]]);

      //lower
      for(let e=0; lowerMarkerData.event.length; e++){
        if(lowerMarkerData.event[e][2].toString() == upperMarkerData.id.toString()){
          //if connected to upper marker, update
          lowerMarkerData.event[e][2] = newMarkerData.id;
          break;
        }        
      }
    }

    //add marker
    this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers.push(newMarkerData);

    //connect markers
    this.disconnectMarkers(upperId, lowerId, "vertical");
    this.connectMarkers(upperId, newMarkerId, "vertical");
    this.connectMarkers(newMarkerId, lowerId, "vertical");

    this.sortModel();

    this.setStatus("completed","");
    return true
  }
  setZeroPoint(markerId, value){
    this.setStatus("running","start setZeroPoint");
    //remove previous zero point in the same prohject
    this.updateSearchIdx();
    const idx = this.search_idx_list[markerId.toString()];
    //Initialise zerpoint
    //breakpoint:
    for(let h of this.projects[idx[0]].holes){
      for(let s of h.sections){
        for(let m of s.markers){
          if(m.isZeroPoint !== false){
            m.isZeroPoint = false;
            //break breakpoint;
          }
        }
      }
    }

    //set new
    this.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[[idx[3]]].isZeroPoint = parseFloat(value);

    this.setStatus("completed","");
    return true;

  }
  setMaster(markerid, type){
    this.setStatus("running","start setMaster");
    const idx = this.search_idx_list[markerid.toString()];
    if(type == "disable"){
      this.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].isMaster = false;
    }else if(type == "enable"){
      //check
      let numMaster = 0;
      for(let hc of this.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].h_connection){
        const idxh = this.search_idx_list[hc.toString()];
        if(!idxh){
          continue
        }
        if(idx[0] == idxh[0]){
          if(this.projects[idxh[0]].holes[idxh[1]].sections[idxh[2]].markers[idxh[3]].isMaster == true){
            numMaster++;
          }
        }
        
      }
      if(numMaster>2){
        this.setErrorAlert("","E056: Too many master section exist in the same horizon.")
        return "too_much_master";
      }

      this.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].isMaster = true;
    }

    this.setStatus("completed","");
    return true;
  }
  changeDistance(markerId, distance){
    this.setStatus("running","start changeDistance");
    distance = parseFloat(distance);
    this.updateSearchIdx();
    const markerIdx = this.search_idx_list[markerId.toString()];
    let markerData = JSON.parse(JSON.stringify(this.getDataByIdx(markerIdx)));
    let sectionData = JSON.parse(JSON.stringify(this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]]));
    sectionData.markers.sort((a,b)=>a.distance-b.distance);
    const minSecDistance = sectionData.markers[0].distance;
    const maxSecDistance = sectionData.markers[sectionData.markers.length-1].distance;

    let curUpperIdx = null;
    let curLowerIdx = null;
    let curTargetIdx = null;
    let curLowerDistance = Infinity;
    let curUpperDistance = -Infinity;
    for(let m=0; m<sectionData.markers.length; m++){
      const marker_y0 = sectionData.markers[m].distance;
      if(marker_y0 - markerData.distance > 0 && Math.abs(curLowerDistance) > Math.abs(marker_y0 - markerData.distance)){
        curLowerDistance = marker_y0 - markerData.distance;
        curLowerIdx = m;
      }

      if(marker_y0 - markerData.distance < 0 && Math.abs(curUpperDistance) > Math.abs(marker_y0 - markerData.distance)){
        curUpperDistance = marker_y0 - markerData.distance;
        curUpperIdx = m;
      }
      if(marker_y0 - markerData.distance == 0){
        curTargetIdx = m;
      }
    }

    let newUpperIdx = null;
    let newLowerIdx = null;
    let newLowerDistance = Infinity;
    let newUpperDistance = -Infinity;
    for(let m=0; m<sectionData.markers.length; m++){
      if(m == curTargetIdx){
        continue;
      }
      const marker_y0 = sectionData.markers[m].distance;
      if(marker_y0 - distance > 0 && Math.abs(newLowerDistance) > Math.abs(marker_y0 - distance)){
        newLowerDistance = marker_y0 - distance;
        newLowerIdx = m;
      }

      if(marker_y0 - distance < 0 && Math.abs(newUpperDistance) > Math.abs(marker_y0 - distance)){
        newUpperDistance = marker_y0 - distance;
        newUpperIdx = m;
      }
    }
    //console.log(newLowerIdx, newUpperIdx, curLowerIdx, curUpperIdx, curTargetIdx)

    //check position
    if(newLowerIdx == null && newUpperIdx == null){
      this.setErrorAlert("","E041: Unsuspected case 1. Upper and Lower marker is not exist.")
      console.log("LCCore: E041: Unsuspected case 1. Upper and Lower marker is not exist.");
      return "unsuspected";
    }

    //case top/bottom move to out of section, move
    if(newUpperIdx == null){
      //out of upper
      if(markerData.name.includes("top")){
        //if top, move
        this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].distance = distance;
        this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].drilling_depth = markerData.drilling_depth + (distance - markerData.distance);
        console.log("LCCore: Change distance (Move section top exceeding the current section upper).");
        this.setStatus("completed","");
        return true;
      }else{
        this.setErrorAlert("","E042: No change distance (New position exceeds the current section upper).")
        console.log("LCCore: E042: No change distance (New position exceeds the current section upper).");
        return "must_be_top";
      }
    }
    if(newLowerIdx == null){
      //out of upper
      if(markerData.name.includes("bottom")){
        //if top, move
        this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].distance = distance;
        this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].drilling_depth = markerData.drilling_depth + (distance - markerData.distance);
        console.log("LCCore: Change distance (Move section bottom exceeding the current section lower).");
        this.setStatus("completed","");
        return true;
      }else{
        this.setErrorAlert("","E043: No change distance (New position exceeds the current section lower).")
        console.log("LCCore: E043: No change distance (New position exceeds the current section lower).");
        return "must_be_bottom";
      }
    }
    
    //case move within section
    if(newLowerIdx !== null && newUpperIdx !== null){
       //case marker is top marker
      if(curUpperIdx == null){
        if(curLowerIdx == newLowerIdx){
          //between the same markers
          this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].distance = distance;
          this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].drilling_depth = markerData.drilling_depth + (distance - markerData.distance);
          console.log("LCCore: Change distance (between the same markers).");
          this.setStatus("completed","");
          return true;
        }else{
          //between other markers(top marker must be top.)
          this.setErrorAlert("","E044: No change distance because the top marker must be the top of the section.")
          console.log("LCCore: E044: No change distance because the top marker must be the top of the section.")
          return "must_be_top";
        }
      }
      //case marker is bottom marker
      if(curLowerIdx == null){
        if(curUpperIdx == newUpperIdx){
          //between the same markers
          this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].distance = distance;
          this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].drilling_depth = markerData.drilling_depth + (distance - markerData.distance);
          console.log("LCCore: Change distance (between the same markers).");
          this.setStatus("completed","");
          return true;
        }else{
          //between other markers(top marker must be top.)
          this.setErrorAlert("","E045: No change distance because the bottom marker must be the bottom of the section.")
          console.log("LCCore: E045: No change distance because the bottom marker must be the bottom of the section.")
          return "must_be_bottom";
        }
      }
      //case marker is other type
      if(newUpperIdx !== null && newLowerIdx !== null){
        if(newUpperIdx == curUpperIdx && newLowerIdx == curLowerIdx){
          //between the same markers
          this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].distance = distance;
          this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].drilling_depth = markerData.drilling_depth + (distance - markerData.distance);
          console.log("LCCore: Change distance (between the same markers).");
          this.setStatus("completed","");
          return true;
        }else{
          //between other markers
          this.deleteMarker(markerId);
          this.addMarker([markerId[0],markerId[1],markerId[2],null], distance, "distance");
          console.log("LCCore: Change distance (between the different markers).");
          this.setStatus("completed","");
          return true;
        }
      }else{
        this.setErrorAlert("","E046: No change distance because the marker must be located between top and bottom.")
        console.log("LCCore: E046: No change distance because the marker must be located between top and bottom.")
        return "out_of_section";
      }
    }else{
      this.setErrorAlert("","E047: Unsuspected case 2.")
      console.log("LCCore: E047: Unsuspected case 2")
      return "unsuspected";
    }
  }
  changeDrillingDepth(markerId, dd){
    this.setStatus("running","start changeDrillingDepth");
    this.updateSearchIdx();
    const markerIdx = this.search_idx_list[markerId.toString()];
    this.projects[markerIdx[0]].holes[markerIdx[1]].sections[markerIdx[2]].markers[markerIdx[3]].drilling_depth = parseFloat(dd);
    this.setStatus("completed","");
    return true;
  }
  addEvent(upperId, lowerId, depositionType, value){
    this.setStatus("running","start addEvent");
    //depositionType: deposition, erosion, markup
    //value: [deposition, markup]:disturbed, tephra, void
    //value: [erosion]: erosion distance
    const upperIdx = this.search_idx_list[upperId.toString()];

    //check number of previous event connection
    let prevEvent = {deposition:0,erosion:0,markup:0};
    for(let e of this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event){
      if(e[2].toString() == lowerId.toString()){
        //if connected
        if(e[0] == "deposition"){
          prevEvent.deposition++;
        }else if(e[0] == "erosion"){
          prevEvent.erosion++;
        }else if(e[0] == "markup"){
          prevEvent.markup++;
        }
      }
    }

    if(prevEvent[depositionType] > 0){
      this.setErrorAlert("","E048: Failed to add event later because input type of event has already been set.")
      console.log("LCCore: E048: Failed to add event later because input type of event has already been set.");
      return "occupied"
    }

    if(["deposition","markup", "d","D","m","M"].includes(depositionType)){
      const lowerIdx = this.search_idx_list[lowerId.toString()];

      let deposition_type = depositionType;
      let colour_type = value;
      if(value == "g"){
        colour_type = "general";
      }else if(value == "t"){
        colour_type = "tephra";
      }else if(value == "v"){
        colour_type = "void";
      }else if(value == "d"){
        colour_type = "disturbed";
      }

      if(["d","D"].includes(depositionType)){
        deposition_type = "deposition";
      }if(["m","M"].includes(depositionType)){
        deposition_type = "markup";
      }

      let upperEvent = [deposition_type, "downward", lowerId, colour_type, null];
      let lowerEvent = [deposition_type, "upward",   upperId, colour_type, null];

      this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event.push(upperEvent);
      this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]].event.push(lowerEvent);
      //console.log(upperEvent, lowerEvent)

    }else if(["erosion","e","E"].includes(depositionType)){
      
      let deposition_type = depositionType;
      if(["e","E"].includes(depositionType)){
        deposition_type = "erosion";
      }
    
      //make lower marker
      this.addMarker(
        this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].id, 
        this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].distance, 
        "distance",
      )
      const lowerId = [upperId[0],upperId[1],upperId[2], lcfnc.getUniqueId()];
      const lowerIdx = this.search_idx_list[lowerId.toString()];

      //make event data
      let upperEvent = [deposition_type, "downward", lowerId, "erosion", -Math.abs(parseFloat(value))];
      let lowerEvent = [deposition_type, "upward",   upperId, "erosion",  Math.abs(parseFloat(value))];

      //add event into upper
      this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event.push(upperEvent);
      this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]].event = [lowerEvent];
      
    }else{
      this.setErrorAlert("","E057: Unsuspected error ocured during add event.")
      return "unsuspected"  
    }

    this.updateSearchIdx();

    this.setStatus("completed","");
    return true;
    
  }
  deleteEvent(upperId, lowerId, type){
    this.setStatus("running","deleteEvent");
    let targetTypes = type;
    if(type.length==0){
      //delete all
      targetTypes = ["deposition","markup","erosion"];
    }
    const upperIdx = this.search_idx_list[upperId.toString()];
    const lowerIdx = this.search_idx_list[lowerId.toString()];

    let deleteIdx = [];
    //delete upper
    for(let e=0; e<this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event.length;e++){
      const ev = this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event[e];
      if(ev[2].toString() == lowerId.toString()){
        //if connected
        if(targetTypes.includes(ev[0])){      
          deleteIdx.push(e);
        }
      }
    }
    for(let idx of deleteIdx.sort((a, b) => b - a)){
      const event = this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event;
      //update
      for(let e=0; e<event.length; e++){
        if(event[e][1]=="through-up"){
          event[e][1] = "upward";
        }
      }
      //delete
      event.splice(idx, 1);
    }
    
    //delete lower
    deleteIdx = [];
    for(let e=0; e<this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]].event.length;e++){
      const ev = this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]].event[e];
      if(ev[2].toString() == upperId.toString()){
        //if connected
        if(targetTypes.includes(ev[0])){          
          deleteIdx.push(e);
        }
      }
    }
    for(let idx of deleteIdx.sort((a, b) => b - a)){
      const event = this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]].event;

      //update
      for(let e=0; e<event.length; e++){
        if(event[e][1]=="through-down"){
          event[e][1] = "downward";
        }
      }
      //delete
      event.splice(idx, 1);
    }

    //case erosion remove lower marker
    //if(targetTypes.includes("erosion")){
    //  this.deleteMarker(lowerId);
    //}

    this.updateSearchIdx();

    console.log("LCCore: Delete deposite/markup event.")

    this.setStatus("completed","");
    return true;

  }
  deleteSection(sectionId){
    this.setStatus("running","start deleteSection");
    const sectionIdx = this.search_idx_list[sectionId.toString()];
    let deleteList = new Set();
    for(let markerData of this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers){
      deleteList.add(markerData.id.toString());
    }
    
    //delete connection
    for(let p=0; p<this.projects.length;p++){
      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            //remove deleted h_connection
            this.projects[p].holes[h].sections[s].markers[m].h_connection
              = this.projects[p].holes[h].sections[s].markers[m].h_connection.filter(hc=>!deleteList.has(hc.toString()));
            //remove deleted v_connection
            this.projects[p].holes[h].sections[s].markers[m].v_connection
              = this.projects[p].holes[h].sections[s].markers[m].v_connection.filter(vc=>!deleteList.has(vc.toString()));
            //Initialise
            this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
            this.projects[p].holes[h].sections[s].markers[m].event_free_depth = null;
          }
        }
      }
    }
    
    //delete section
    this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections = this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections.filter(sec=>sec.id[2].toString()!==sectionId[2].toString());
    
    this.updateSearchIdx();

    this.setStatus("completed","");
    return true;
  }
  addSection(holeId, inData){
    this.setStatus("running","addSection");
    this.updateSearchIdx();
    const holeIdx = this.search_idx_list[holeId.toString()];
    const holeData = this.projects[holeIdx[0]].holes[holeIdx[1]];
    let newSectionData    = new Section();
    let topMarkerData     = new Marker();
    let bottomMarkerData  = new Marker();

    const newSectionId = [holeId[0], holeId[1], lcfnc.getUniqueId(),null];
    newSectionData.name = lcfnc.zeroPadding(inData.name);
    newSectionData.id = newSectionId;

    topMarkerData.name = holeData.name+"-"+inData.name+"-top";
    topMarkerData.distance = inData.distance_top;
    topMarkerData.drilling_depth = inData.dd_top;
    topMarkerData.id = [newSectionId[0],newSectionId[1],newSectionId[2],lcfnc.getUniqueId()];
    bottomMarkerData.name = holeData.name+"-"+inData.name+"-bottom";
    bottomMarkerData.distance =inData.distance_bottom;
    bottomMarkerData.drilling_depth =inData.dd_bottom;
    bottomMarkerData.id = [newSectionId[0],newSectionId[1],newSectionId[2],lcfnc.getUniqueId()];

    newSectionData.markers.push(topMarkerData);
    newSectionData.markers.push(bottomMarkerData);

    this.projects[holeIdx[0]].holes[holeIdx[1]].sections.push(newSectionData);
    this.updateSearchIdx();
    this.connectMarkers(topMarkerData.id, bottomMarkerData.id, "vertical");

    this.sortModel();

    this.setStatus("completed","");
    return true
  }
  addSectionModel(holeId, sectionModel){
    this.setStatus("running","start addSectionFromModel");
    try{
      let targetId;
      if(holeId){
        targetId = holeId;
      }

      if(!targetId){
        return
      }
  
      //search location
      const idx = this.search_idx_list[holeId.toString()];
      const holeData = this.projects[idx[0]].holes[idx[1]];
  
      //make sectiondata
      let sectionData = sectionModel;
      const newId = lcfnc.getUniqueId();
      sectionData.id = [holeData.id[0], holeData.id[1], newId, null];

      //upodate marker id & connections
      for (let m=0;m<sectionData.markers.length;m++){
        sectionData.markers[m].id = [sectionData.id[0], sectionData.id[1], sectionData.id[2], sectionData.markers[m].id[3]];
        for (let vc=0; vc<sectionData.markers[m].v_connection.length;vc++){
          sectionData.markers[m].v_connection[vc] = [sectionData.id[0], sectionData.id[1], sectionData.id[2], sectionData.markers[m].v_connection[vc][3]];
        }
      }

      holeData.sections.push(sectionData);
      this.updateSearchIdx();
      this.setStatus("completed","");
      return true
    }catch(err){
      console.log(err)
      this.setErrorAlert("","E066: Failed to add section from lcsection model.")
      return false
    }   
  }
  deleteHole(holeId, deleteConnections=true){
    this.setStatus("running","start deleteHole");
    this.updateSearchIdx();
    const holeIdx = this.search_idx_list[holeId.toString()];
    let deleteList = new Set();

    for(let s=0;s<this.projects[holeIdx[0]].holes[holeIdx[1]].sections.length;s++){
      for(let m=0;m<this.projects[holeIdx[0]].holes[holeIdx[1]].sections[s].markers.length;m++){
        const markerData = this.projects[holeIdx[0]].holes[holeIdx[1]].sections[s].markers[m];
        deleteList.add(markerData.id.toString());
      }
    }
    
    //delete connection
    if(deleteConnections){
      for(let p=0; p<this.projects.length;p++){
        for(let h=0;h<this.projects[p].holes.length;h++){
          for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
            for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
              //remove deleted h_connection
              this.projects[p].holes[h].sections[s].markers[m].h_connection
                = this.projects[p].holes[h].sections[s].markers[m].h_connection.filter(hc=>!deleteList.has(hc.toString()));
              //remove deleted v_connection
              this.projects[p].holes[h].sections[s].markers[m].v_connection
                = this.projects[p].holes[h].sections[s].markers[m].v_connection.filter(vc=>!deleteList.has(vc.toString()));
              //Initialise
              this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
              this.projects[p].holes[h].sections[s].markers[m].event_free_depth = null;
            }
          }
        }
      }
    }    
    
    //delete hole
    this.projects[holeIdx[0]].holes = this.projects[holeIdx[0]].holes.filter(hole=>hole.id[1].toString()!==holeId[1].toString());      
    if(deleteConnections){
      this.calcCompositeDepth();
      this.calcEventFreeDepth();
    }

    this.updateSearchIdx();

    this.setStatus("completed","");
    return true;
    
  }
  addHole(projectId, name){
    this.setStatus("running","start addHole");
    this.updateSearchIdx()
    const projectIdx = this.search_idx_list[projectId.toString()];

    if(!projectIdx) return false
    let newHole = new Hole();

    const newHoleId = [projectId[0], lcfnc.getUniqueId(), null, null];
    newHole.id = newHoleId;
    newHole.order = this.projects[projectIdx[0]].holes.length;
    if(this.projects[projectIdx[0]].holes.filter(h=>h.name == name).length !== 0){
      this.setErrorAlert("","E057: Inupt hole name has been already used.")
      return "used";
    } else{
      newHole.name = name;
    }
    
    //set hole data
    this.projects[projectIdx[0]].holes.push(newHole);
    this.sortModel();

    //console.log("LCCore: Add hole.")
    this.setStatus("completed","");
    return true;
  }
  moveHoleToProject(holeId, toProjectId){
    if(holeId[0]==toProjectId[0]) return false;

    this.setStatus("running","start moveHoleToProject");
    this.updateSearchIdx();
    const projectIdx = this.search_idx_list[toProjectId.toString()];
    const holeIdx    = this.search_idx_list[holeId.toString()];

    //change ids
    for(let p=0; p<this.projects.length; p++){
      const project = this.projects[p];
      for(let h=0; h<project.holes.length; h++){
        const hole = project.holes[h];
        if(hole.id[1] === holeId[1]){
          //if target hole          
          for(let s=0; s<hole.sections.length; s++){
            const section = hole.sections[s];
            section.id[0] = toProjectId[0];
            for(let m=0; m<section.markers.length; m++){
              const marker = section.markers[m];
              marker.id[0] = toProjectId[0];              
              marker.isMaster = false;
              marker.isZeroPoint = false;
              marker.composite_depth = null;
              marker.event_free_depth = null;
              marker.connection_rank = null;

              //v_connection
              for(let i=0; i<marker.v_connection.length; i++){
                const vcId = marker.v_connection[i];
                if(vcId.slice(0, 2).join(',') == holeId.slice(0, 2).join(',')){
                  vcId[0] = toProjectId[0];
                }
              }              

              //evet
              for(let i=0; i<marker.event.length; i++){
                const event = marker.event[i];
                if(event[2] !== null && event[2].slice(0, 2).join(',') == holeId.slice(0, 2).join(',')){
                  event[2][0] = toProjectId[0];
                }                
              }

              //depth_source 
              const source = marker.depth_source;
              for(let i=1; i<source.length; i++){
                if(source[i] !== null && source[i].slice(0, 2).join(',') == holeId.slice(0, 2).join(',')){
                  source[i][0] = toProjectId[0];
                }
              }
            }
          }
          hole.id[0] = toProjectId[0];
        }else{
          //if other holes
          for(let s=0; s<hole.sections.length; s++){
            const section = hole.sections[s];
            for(let m=0; m<section.markers.length; m++){
              const marker = section.markers[m];
              //h_connection(if connected to target hole)
              for(let i=0; i<marker.h_connection.length; i++){
                const connectedId = marker.h_connection[i];
                if(connectedId[1] === holeId[1]){
                  //if move target hole
                  connectedId[0] = toProjectId[0];
                }
              }
            }
          }
        }
        
      }
    }

    //move hole
    const fromHole = this.projects[holeIdx[0]].holes[holeIdx[1]].clone();
    fromHole.order = this.projects[projectIdx[0]].holes.length + 1;
    this.projects[projectIdx[0]].holes.push(fromHole);

    //delete moved hole
    this.projects[holeIdx[0]].holes = this.projects[holeIdx[0]].holes.filter(hole => hole.id[1].toString()!==holeId[1].toString());
    console.log(this.projects[0].holes[this.projects[0].holes.length-1].sections[0].markers[1].distance)
    console.log(this.projects[0].holes[this.projects[0].holes.length-1].sections[0].markers[1].h_connection)
    

    //update model
    this.sortModelByOrder();    
    this.updateSearchIdx()

    this.setStatus("completed","");
    return true;    
  }
  changeHoleOrder(holeId1, holeId2){
    this.setStatus("running","start changeHoleOrder");
    this.updateSearchIdx()

    if(holeId1[1]==null||holeId2[1]==null){
      this.setErrorAlert("","E068: There is no hole to replace.")
      return false
    }

    const Idx1 = this.search_idx_list[holeId1.toString()];
    const Idx2 = this.search_idx_list[holeId2.toString()];
    const hole1Data  = this.projects[Idx1[0]].holes[Idx1[1]];
    const hole2Data  = this.projects[Idx2[0]].holes[Idx2[1]];
    const hole1Order = hole1Data.order;
    const hole2Order = hole2Data.order;
    
    if(hole1Order == hole2Order){
      this.setErrorAlert("","E069: The new order is as same sa the old order.");
      return false;
    }
    
    //apply
    hole1Data.order = hole2Order;
    hole2Data.order = hole1Order;

    return true;
    
  }
  addProject(type, name){
    this.setStatus("running","start addProject");
    this.updateSearchIdx()
    //check type
    if(!["correlation","duo"].includes(type)){
      this.setErrorAlert("","E058: Inupt type is incorrect. Please use 'correlation' or 'duo'.")
      return "incorrect_type"
    }

    if(this.projects.filter(p=>p.model_type=="correlation").length !== 0){
      if(type == "correlation"){
        this.setErrorAlert("","E059: Inupt name has been already used.")
        return "correlation_exist";
      }
    }else{
      if(type == "duo"){
        this.setErrorAlert("","E060: There is no 'correlation' type. Please use 'correlation' type first.")
        return "no_correlation";
      }
    }
    
    //check name
    if(this.projects.filter(p=>p.name==name).length !== 0){
      this.setErrorAlert("","E061: Inupt name has been already used.")
      return "used";
    }

    let newProject = new Project();
    newProject.name = name;
    newProject.id = [lcfnc.getUniqueId(), null, null, null];
    newProject.order = this.projects.length;
    newProject.model_type = type;
    if(type == "correlation"){
      if(this.base_project_id==null){
        this.base_project_id = newProject.id;
      }
    }

    this.projects.push(newProject);
    this.updateSearchIdx();

    //console.log("LCCore: Add Project.")
    this.setStatus("completed","");
    return true;

  }
  deleteProject(projectId, isDeleteConnection = true){
    this.setStatus("running","start deleteProject");
    this.updateSearchIdx();
    const projectIdx = this.search_idx_list[projectId.toString()];
    let deleteList = new Set();

    for(let h=0; h<this.projects[projectIdx[0]].holes.length;h++){
      for(let s=0;s<this.projects[projectIdx[0]].holes[h].sections.length;s++){
        for(let m=0;m<this.projects[projectIdx[0]].holes[h].sections[s].markers.length;m++){
          const markerData = this.projects[projectIdx[0]].holes[h].sections[s].markers[m];
          deleteList.add(markerData.id.toString());
        }
      }
    }
        
    //delete connection
    if(isDeleteConnection){
      for(let p=0; p<this.projects.length;p++){
        for(let h=0;h<this.projects[p].holes.length;h++){
          for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
            for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
              //remove deleted h_connection
              this.projects[p].holes[h].sections[s].markers[m].h_connection
                = this.projects[p].holes[h].sections[s].markers[m].h_connection.filter(hc=>!deleteList.has(hc.toString()));
              //remove deleted v_connection
              this.projects[p].holes[h].sections[s].markers[m].v_connection
                = this.projects[p].holes[h].sections[s].markers[m].v_connection.filter(vc=>!deleteList.has(vc.toString()));
              //Initialise
              this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
              this.projects[p].holes[h].sections[s].markers[m].event_free_depth = null;
            }
          }
        }
      }
    }    
    
    //delete project
    this.projects = this.projects.filter(project=>project.id.toString()!==projectId.toString());

    //update base id
    if(this.base_project_id[0] == projectId[0]){
      //if delete master "correlation" project
      if(this.projects.length>0){
        this.base_project_id = this.projects[0].id;
      }else{
        this.base_project_id = null;
      }      
    }    

    this.updateSearchIdx();

    this.setStatus("completed","");
    return true;
    
  }
  mergeProjects(){
    this.setStatus("completed","start mergeProject");

    //move holes
    let moveList = [];
    for(let p=0; p<this.projects.length; p++){
      const project = this.projects[p];
      if(project.id.toString() !== this.base_project_id.toString()){
        //if target project, move hole
        for (let h=0; h<project.holes.length; h++) {
          moveList.push(project.holes[h].id);
        }
      }
    }
    for(let i=0; i<moveList.length; i++) {
       console.log(moveList[i])

      this.moveHoleToProject(moveList[i], this.base_project_id); //delete hole function included
    }
    //console.log(this.projects)

    //delete projects
    let deleteList = [];
    for(let p=0; p<this.projects.length; p++){
      const project = this.projects[p];
      if(project.id.toString() !== this.base_project_id.toString()){
        deleteList.push(JSON.parse(JSON.stringify(project.id)));
      }
    }
    for(let p=0; p<deleteList.length; p++){
      console.log(deleteList[p])
      this.deleteProject(deleteList[p]);
    }

    //update model
    this.sortModelByOrder();  
    this.updateSearchIdx();

    this.setStatus("completed","");
    return true;
  }
  changeName(targetId, value){
    this.setStatus("running","start changeName");
    this.updateSearchIdx();
    const idx = this.search_idx_list[targetId.toString()];
    const targetData = this.getDataByIdx(idx);

     //check duplicate
    let isUsed = false;
    let isUpdateMarkerName = false;
    if(idx.filter(item => item !== null).length == 1){
      //project
      for(let data of this.projects){
        if(value !== "" && data.name == lcfnc.zeroPadding(value)){
          isUsed = true;
          break;
        }
      }
    }else if(idx.filter(item => item !== null).length == 2){
      //hole
      isUpdateMarkerName = true;
      for(let data of this.projects[idx[0]].holes){
        if(value !== "" && data.name == lcfnc.zeroPadding(value)){
          isUsed = true;
          break;
        }
      }
    }else if(idx.filter(item => item !== null).length == 3){
      //section
      isUpdateMarkerName = true;
      for(let data of this.projects[idx[0]].holes[idx[1]].sections){
        if(value !== "" && data.name == lcfnc.zeroPadding(value)){
          isUsed = true;          
          break;
        }
      }
    }else if(idx.filter(item => item !== null).length == 4){
      //marker
      for(let data of this.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers){
        if(value !== "" && data.name == lcfnc.zeroPadding(value)){
          isUsed = true;
          break;
        }
      }
    }
    
    //apply to reference type array
    if(isUsed == false){
      targetData.name = lcfnc.zeroPadding(value);
      if(isUpdateMarkerName){
        //update top/bottom name
        const holeData    = this.getDataByIdx([idx[0],idx[1],null,null]);
        let sectionData = null;
        if(idx[2]){
          //change section name
          sectionData = this.getDataByIdx([idx[0],idx[1],idx[2],null]);
          sectionData.markers[0].name = holeData.name+"-"+sectionData.name+"-top";
          sectionData.markers[sectionData.markers.length-1].name = holeData.name+"-"+sectionData.name+"-bottom";
        }else{
          //change hole name
          for(let i=0;i<holeData.sections.length;i++){
            sectionData = holeData.sections[i];
            sectionData.markers[0].name = holeData.name+"-"+sectionData.name+"-top";
            sectionData.markers[sectionData.markers.length-1].name = holeData.name+"-"+sectionData.name+"-bottom";
          }        
        }
      }
      console.log("MAIN: Change target name.");
      this.setStatus("completed","");
      return true;
    }else{
      if(targetData.name == lcfnc.zeroPadding(value)){
        this.setError("","E063: Same name has been input.")
        return "same"
      }else{
        this.setErrorAlert("","E064: Inupt name has been already used.")
        return "used"
      }        
    }
  }
  changeDescriptions(targetId, value){
    this.setStatus("running","start changeDescriptions");
    this.updateSearchIdx();
    const idx = this.search_idx_list[targetId.toString()];
    const targetData = this.getDataByIdx(idx);
    
    //apply to reference type array
    if(targetData.descriptions == value){
      this.setError("","E067: Descriptions is the same as previous values.")
      return "same"
    }else{
      targetData.descriptions = value.toString();
      console.log("MAIN: Change descriptions of " + targetData.name + ".");
      this.setStatus("completed","");
      return true;
    }
  }
  changeEnable(targetId, isEnable){
    this.setStatus("running","start change enable");
    this.updateSearchIdx();
    const idx = this.search_idx_list[targetId.toString()];
    const targetData = this.getDataByIdx(idx);

    targetData.enable = isEnable;

    console.log("MAIN: Change enable of " + targetData.name + ".");
    this.setStatus("completed","");
    return true;
  }
  searchHconnection(startId) {
    this.setStatus("running","searchHconnection");
    let visitedId = new Set();
    let stack = [];

    //first data
    let currentId = startId;
    let currentIdx = this.search_idx_list[currentId.toString()];
    visitedId.add(currentId.toString());
    this.projects[currentIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].h_connection.forEach((h) => {
      if (!visitedId.has(h.toString())) {
        stack.push(h);
      }
    });

    let counts = 0;
    while (stack.length > 0 && counts < 100) {
      counts += 1;
      currentId = stack.pop();
      if (!visitedId.has(currentId.toString())) {
        currentIdx = this.search_idx_list[currentId];
        
        visitedId.add(currentId.toString());

        if(currentIdx){
          
          this.projects[currentIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].h_connection.forEach((h) => {
            if (!visitedId.has(h.toString())) {
              stack.push(h);
            }
          });
        }
        
      }
    }

    //chage type
    let output = [];
    visitedId.forEach((v) => {
      const val = v.split(",");
      output.push([val[0], val[1], val[2], val[3]]);
    });

    this.setStatus("completed","");
    return output;
  }
  searchVconnection(startId) {
    this.setStatus("running","start searchVConnection");
    let visitedId = new Set();
    let stack = [];

    //first data
    let currentId = startId;
    let currentIdx = this.search_idx_list[currentId.toString()];
    visitedId.add(currentId.toString());
    this.projects[currentIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].v_connection.forEach((v) => {
      if (!visitedId.has(v.toString())) {
        stack.push(v);
      }
    });

    let counts = 0;
    while (stack.length > 0){// && counts < 10000) {
      counts += 1;
      currentId = stack.pop();
      if (!visitedId.has(currentId.toString())) {
        currentIdx = this.search_idx_list[currentId.toString()];
        if(!currentIdx) continue;

        visitedId.add(currentId.toString());
        this.projects[currentIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].v_connection.forEach((v) => {
          if (!visitedId.has(v.toString())) {
            stack.push(v);
          }
        });
      }
    }

    //chage type
    let output = [];
    visitedId.forEach((v) => {
      const val = v.split(",");
      output.push([val[0], val[1], val[2], val[3]]);
    });

    this.setStatus("completed","");
    return output;
  }
  getMarkerIdsByDistance(sectionId, dist) {
    this.setStatus("running","start getMarkerIdsByDistance");
    const secIdx = this.search_idx_list[sectionId.toString()];
    const sectionData = this.projects[secIdx[0]].holes[secIdx[1]].sections[secIdx[2]];
    const num_m = sectionData.markers.length;
    for (let m = 0; m < num_m - 1; m++) {
      const dist_upper = sectionData.markers[m].distance;
      const dist_lower = sectionData.markers[m + 1].distance;

      if (dist <= dist_lower && dist >= dist_upper) {
        const rate_from_upper = (dist - dist_upper) / (dist_lower - dist_upper);
        const rate_from_lower = (dist_lower - dist) / (dist_lower - dist_upper);
        this.setStatus("completed","");
        return [sectionData.markers[m].id, sectionData.markers[m + 1].id, rate_from_upper, rate_from_lower];
      }
    }

    this.setError("","E049: There is no marker.");
    return [null, null, null, null];
  }
  getNearestTrinity(targetId, depth, calcType) {
    this.setStatus("completed","start getNearestTrinity");

    let output = {index:[null,null,null,null], project:null, hole:null, section: null, distance: null, section_type: false};
    let nearestSectionData = null;
    let selectedIdx = [null,null,null,null];

    const hasProject = targetId[0] !== null;
    const hasHole    = targetId[1] !== null;
    const hasSection = targetId[2] !== null;

    const targetIdx = this.search_idx_list[targetId.toString()];

    // =========================================================
    // Fast Path (80% cases): project, hole, section are specified
    // =========================================================
    if (hasProject && hasHole && hasSection) {
      if (targetIdx !== undefined && targetIdx !== null) {
        nearestSectionData = this.getDataByIdx(targetIdx);
        selectedIdx = targetIdx;
      }
    } 
    // =========================================================
    // Unified Search Path: targetId is partially or not specified
    // =========================================================
    else {
      // Step 1: Determine search scope (holes to iterate)
      let targetHoles = [];
      
      if (hasProject) {
        if (targetIdx && this.projects[targetIdx[0]]) {
          const proj = this.projects[targetIdx[0]];
          if (hasHole) {
            // Scope: specific hole only
            if (proj.holes && proj.holes[targetIdx[1]]) {
              targetHoles.push({ pIdx: targetIdx[0], hIdx: targetIdx[1], holeData: proj.holes[targetIdx[1]] });
            }
          } else {
            // Scope: all holes in the specific project
            if (proj.holes) {
              for (let h = 0; h < proj.holes.length; h++) {
                targetHoles.push({ pIdx: targetIdx[0], hIdx: h, holeData: proj.holes[h] });
              }
            }
          }
        }
      } else {
        // Scope: all holes in all projects
        for (let p = 0; p < this.projects.length; p++) {
          if (this.projects[p] && this.projects[p].holes) {
            for (let h = 0; h < this.projects[p].holes.length; h++) {
              targetHoles.push({ pIdx: p, hIdx: h, holeData: this.projects[p].holes[h] });
            }
          }
        }
      }

      // Step 2: Single pass scoring loop
      let bestScore = Infinity;
      let minDepthDiff = Infinity;

      for (let i = 0; i < targetHoles.length; i++) {
        const hInfo = targetHoles[i];
        const sections = hInfo.holeData.sections;
        if (!sections) continue;

        for (let s = 0; s < sections.length; s++) {
          const sectionData = sections[s];
          if (!sectionData || !sectionData.markers || sectionData.markers.length === 0) continue;

          const topDepth = sectionData.markers[0][calcType];
          const botDepth = sectionData.markers[sectionData.markers.length - 1][calcType];
          
          const isContained = (depth >= topDepth && depth <= botDepth);
          
          let isMS = false;
          const mLen = sectionData.markers.length;
          if (mLen > 1) {
            if (depth <= topDepth) {
              isMS = sectionData.markers[0].isMaster; // 外挿の基準となる上端マーカーのみ判定
            } else if (depth >= botDepth) {
              isMS = sectionData.markers[mLen - 1].isMaster; // 外挿の基準となる下端マーカーのみ判定
            } else {
              for (let m = 0; m < mLen - 1; m++) {
                if (sectionData.markers[m][calcType] <= depth && depth <= sectionData.markers[m + 1][calcType]) {
                  isMS = sectionData.markers[m].isMaster && sectionData.markers[m + 1].isMaster;
                  break;
                }
              }
            }
          } else if (mLen === 1) {
            isMS = sectionData.markers[0].isMaster;
          }
          
          let currentScore;
          let depthDiff = Infinity;

          // Dynamic Scoring Logic
          if (hasHole) {
            // Human Preference (Hole specified): Ignore MS priority
            if (isContained) {
              currentScore = 1; // Rank 1: Contained
            } else {
              currentScore = 2; // Rank 2: Outside (Extrapolation base)
              depthDiff = Math.min(Math.abs(topDepth - depth), Math.abs(botDepth - depth));
            }
          } else {
            // AI Preference (Hole not specified): MS priority
            if (isContained && isMS) {
              currentScore = 1; // Rank 1: Contained & MS
            } else if (isContained && !isMS) {
              currentScore = 2; // Rank 2: Contained & Regular
            } else if (!isContained && isMS) {
              currentScore = 3; // Rank 3: Outside & MS (Extrapolation base)
              depthDiff = Math.min(Math.abs(topDepth - depth), Math.abs(botDepth - depth));
            } else {
              currentScore = 4; // Rank 4: Outside & Regular (Extrapolation base)
              depthDiff = Math.min(Math.abs(topDepth - depth), Math.abs(botDepth - depth));
            }
          }

          // Update tentative best candidate
          if (currentScore < bestScore || (currentScore === bestScore && depthDiff < minDepthDiff)) {
            bestScore = currentScore;
            minDepthDiff = depthDiff;
            nearestSectionData = sectionData;
            
            const sIdxStr = sectionData.id ? sectionData.id.toString() : [null, null, null, null];
            selectedIdx = (sIdxStr && this.search_idx_list[sIdxStr]) ? this.search_idx_list[sIdxStr] : [hInfo.pIdx, hInfo.hIdx, s, null];
          }

          // Early Exit: if absolute best (Rank 1) is found, stop searching
          if (bestScore === 1) break;
        }
        if (bestScore === 1) break;
      }
    }

    // =========================================================
    // Check section data (Return empty format if literally no data exists)
    // =========================================================
    if (nearestSectionData == null) {
      output.index = [null,null,null,null];
      this.setError("","E065: Nearest section data is not exist.");
      return output;
    }

    // =========================================================
    // find upper/lower markers
    // =========================================================
    const mLen = nearestSectionData.markers.length;
    let selectedIdxs = [0, 0];
    let upperMarkerData = nearestSectionData.markers[0];
    let lowerMarkerData = nearestSectionData.markers[0];

    if (mLen > 1) {
      const topDepth = nearestSectionData.markers[0][calcType];
      const botDepth = nearestSectionData.markers[mLen - 1][calcType];

      if (depth <= topDepth) {
        // Extrapolation top
        selectedIdxs = [0, 0];
        upperMarkerData = nearestSectionData.markers[0];
        lowerMarkerData = nearestSectionData.markers[0];
      } else if (depth >= botDepth) {
        // Extrapolation bottom
        selectedIdxs = [mLen - 1, mLen - 1];
        upperMarkerData = nearestSectionData.markers[mLen - 1];
        lowerMarkerData = nearestSectionData.markers[mLen - 1];
      } else {
        // Interpolation
        for (let m = 0; m < mLen - 1; m++) {
          if (nearestSectionData.markers[m][calcType] <= depth && depth <= nearestSectionData.markers[m + 1][calcType]) {
            selectedIdxs = [m, m + 1];
            upperMarkerData = nearestSectionData.markers[m];
            lowerMarkerData = nearestSectionData.markers[m + 1];
            break; 
          }
        }
      }
    }

    // =========================================================
    // interpolate / extrapolate distance
    // =========================================================
    const D1 = upperMarkerData.distance;
    const D3 = lowerMarkerData.distance;
    const d1 = upperMarkerData[calcType];
    const d2 = depth;
    const d3 = lowerMarkerData[calcType];
    const d2d1 = d2 - d1;
    const d3d1 = d3 - d1;

    let interpDistance = null;
    if(D1 < D3){
      interpDistance = this.linearInterp(D1, D3, d2d1, d3d1);
    }else if(D1===D3){
      interpDistance = this.linearExtrap(null, D1, null, -d2d1, "linear");
    }else{
      this.setError("","E065: Nearest upper and lower markers are reversed.");
      return output;
    }

    // =========================================================
    // build output
    // =========================================================
    const idx = this.search_idx_list[nearestSectionData.id.toString()];
    if (idx !== undefined && idx !== null) {
      selectedIdx = idx;
    }

    output.index = selectedIdx;
    
    // Safety guard to avoid TypeError if selectedIdx is somehow malformed
    if (selectedIdx[0] !== null && selectedIdx[1] !== null && selectedIdx[2] !== null) {
      output.project = this.projects[selectedIdx[0]].name;
      output.hole    = this.projects[selectedIdx[0]].holes[selectedIdx[1]].name;
      output.section = this.projects[selectedIdx[0]].holes[selectedIdx[1]].sections[selectedIdx[2]].name;
    }
    
    output.distance= interpDistance;
    output.section_type = "";

    if(upperMarkerData.id && lowerMarkerData.id && upperMarkerData.id[3] == lowerMarkerData.id[3]){
      output.section_type = "Paseudo Parallel Section";
    }else{
      if(upperMarkerData.isMaster && lowerMarkerData.isMaster){
        output.section_type = "Paseudo Master Section";
      }else{
        output.section_type = "Paseudo Parallel Section";
      };
    }

    this.setStatus("completed","");
    return output;
  }
  getIdxFromTrinity(projectId, [holeName, sectionName, distance],epsilon = 1e-1) {
    this.setStatus("running","getIdxFromTrinity");
    //get idx
    let projectIdx = null;
    this.projects.forEach((project, p) => {
      if (project.id[0] == projectId[0]) {
        projectIdx = [p, null, null, null];
      }
    });

    let idx = [projectIdx[0], null, null, null];
    for (let h = 0; h < this.projects[projectIdx[0]].holes.length; h++) {
      const hole = this.projects[projectIdx[0]].holes[h];
      if (this.equalName(hole.name, holeName)) {
        idx[1] = h;
        for (let s = 0; s < hole.sections.length; s++) {
          const section = hole.sections[s];
          if (this.equalName(section.name, sectionName)) {
            idx[2] = s;
            for (let m = 0; m < section.markers.length; m++) {
              const marker = section.markers[m];
              if(Math.abs(marker.distance - parseFloat(distance)) < epsilon){
                idx[3] = m;
              }
            }
          }
        }
      }
    }
    this.setStatus("completed","");
    return idx;
  }
  constructModelMap(){
    // Set status
    this.setStatus("running","start constructCSVModel");
    const isIgnoreWithoutCD = true;

    // Check model integrity
    const results = this.checkModel();
    let isError = false;
    results.forEach(r=>{
      if(r.evaluation==false){
        isError = true;
      }
    })

    if(isError==true){
      console.log("MAIN: Correlation models have some interpolation errors.");
      console.log(results);
      if(!isIgnoreWithoutCD){
        this.setErrorAlert("","E050: Failed to make csv model.  Correlation models have some interpolation errors.");
        return
      }      
    }

    // Initialise
    this.sortModel();
    this.updateSearchIdx(); // Make search_idx_list available

    // --- STEP 1: Create Horizon List (Data Transformation) ---

    // 'resultIds'  [cd, markerIds]
    let resultIds = []; 
    let visitedMarkers = new Set();
     
    for(let p=0; p<this.projects.length;p++){
      for(let h=0;h<this.projects[p].holes.length;h++){
        const holeData = this.projects[p].holes[h];
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          const sectionData = this.projects[p].holes[h].sections[s];
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            const markerData = this.projects[p].holes[h].sections[s].markers[m];
            
            if(isIgnoreWithoutCD){
              if(markerData.composite_depth == null) continue
            }
            
            if(!visitedMarkers.has(markerData.id.toString())){       
              let markerGroup = [];
              let cd = null;

              cd = markerData.composite_depth;

              visitedMarkers.add(markerData.id.toString());
              markerGroup.push(markerData.id);

              for(let h=0;h<markerData.h_connection.length;h++){
                visitedMarkers.add(markerData.h_connection[h].toString());
                markerGroup.push(markerData.h_connection[h]);
              }

              // format: [cd, markerIds]
              resultIds.push([cd, markerGroup]);
            }
          }
        }
      }   
    }    

    // --- STEP 2: Sort by CD ---

    // Sort the resultIds array
    resultIds.sort((rowA, rowB) => {
      // 1. Helper function to get physical location details
      const getMarkerDetails = (markerIds) => {
        const details = [];
        markerIds.forEach(id => {
          const idx = this.search_idx_list[id.toString()];
          if (!idx) return;

          const p_idx = idx[0]; // Project index
          const h_idx = idx[1]; // Hole index
          const s_idx = idx[2]; // Section index
          const m_idx = idx[3]; // Marker index

          try {
            const mData    = this.projects[p_idx].holes[h_idx].sections[s_idx].markers[m_idx];
            const secData  = this.projects[p_idx].holes[h_idx].sections[s_idx];
            const holeData = this.projects[p_idx].holes[h_idx];
            
            details.push({
              holeName: holeData.name,    // Key 1: Hole name
              sectionRank: secData.order, // Key 2: Section order
              distance: mData.distance    // Key 3: Distance within section
            });
          } catch (e) {
            console.error("Failed to retrieve marker data during sort:", id, idx, e);
          }
        });
        return details;
      };

      // Access using index [0] (for cd) and [1] (for markers)
      const cd_A = rowA[0];
      const cd_B = rowB[0];
      const aDetails = getMarkerDetails(rowA[1]); // Pass rowA[1] (markerIds)
      const bDetails = getMarkerDetails(rowB[1]); // Pass rowB[1] (markerIds)

      // 2. Constraint Comparison
      let physicalDecision = 0; // 0: Undecided, -1: A is upper, 1: B is upper, 99: Conflict

      for (const detailA of aDetails) {
        for (const detailB of bDetails) {
          if (detailA.holeName === detailB.holeName) {
            let currentDecision = 0;

            // 2a. Compare section order
            if (detailA.sectionRank < detailB.sectionRank) {
              currentDecision = -1; // A is in an upper section
            } else if (detailA.sectionRank > detailB.sectionRank) {
              currentDecision = 1;  // B is in an upper section
            
            // 2b. Compare distance (if same section)
            } else if (detailA.distance < detailB.distance) {
              currentDecision = -1; // A is upper
            } else if (detailA.distance > detailB.distance) {
              currentDecision = 1;  // B is upper
            }

            if (currentDecision !== 0) {
              if (physicalDecision === 0) {
                physicalDecision = currentDecision;
              } else if (physicalDecision !== currentDecision) {
                console.warn(`Sorting conflict detected. Rows contain physically crossed data: `, detailA,detailB);
                physicalDecision = 99; // Set conflict flag
                break; 
            }
            }
          }
        }
        if (physicalDecision === 99) break;
      }

      // 3. Final Decision
      // Case 1: Physically decided
      if (physicalDecision === -1) return -1; // A is upper
      if (physicalDecision === 1) return 1;  // B is upper

      // Case 2: Fallback to Composite Depth (using cd_A, cd_B from above)      
      if (cd_A === null && cd_B === null) return 0;
      if (cd_A === null) return 1;  // A is null, so B comes first
      if (cd_B === null) return -1; // B is null, so A comes first
      
      return cd_A - cd_B; // Normal CD comparison
    });
    
    // Return the sorted list in the original format [ [cd, markerIds], ... ]
    return resultIds; 
  }
  constructCSVforLC(resultIds, targetProjectID=this.base_project_id){
    this.setStatus("running","construct csv for LC");
    //resultIds: [cd, [horizontalMarkers...]]
    //type: "lc", "lf"
    //make output data
    
    //check duo
    let isMain = true;
    const targetIdx = this.search_idx_list[targetProjectID.toString()];
    if(this.projects[targetIdx[0]].model_type==="duo"){
      isMain = false;
    }

    let prevMasterHole = "";
    let output = [];
    for(let i=0;i<resultIds.length;i++){
      const cd  = resultIds[i][0];
      const ids  = resultIds[i][1];
      let rowData = [];
      let zeroMarker = "";
      let masterHole = "";
      let curMasterHole = [];
      let masterConnections = [null,null,null,null];
      for(let p=0; p<this.projects.length;p++){
        const projectData = this.projects[p];
        for(let h=0; h<projectData.holes.length; h++){
          const holeData = projectData.holes[h];
          let cellsData = []; //[name, distance, drilling depth, event]
          if(this.projects[p].id.toString() == targetProjectID.toString()){
            cellsData = [null,null,null,null];
          }
        
          for(let c=0;c<ids.length;c++){
            const id = ids[c]; 
            const idx = this.search_idx_list[id.toString()];
            const sectionData = this.getDataByIdx([idx[0],idx[1],idx[2],null]);       
            const markerData  = this.getDataByIdx(idx);

            if(holeData.id.toString() == [id[0],id[1],null,null].toString()){
              if(this.projects[p].id.toString() == targetProjectID.toString()){
                //if target project   
                //get marker data
                cellsData[0] = markerData.name;
                cellsData[1] = markerData.distance;
                cellsData[2] = markerData.drilling_depth;  

                //add events
                //for event list
                let eventFlag = "";
                for(let e=0;e<markerData.event.length;e++){
                  if(markerData.event[e][0]=="erosion"){   
                    if(markerData.event[e][1] == "upward"){
                      if(eventFlag !==""){eventFlag += "/";}
                      eventFlag += markerData.event[e][0] +"-lower("+markerData.event[e][4]+")["+markerData.event[e][3]+"]";
                    }else if(markerData.event[e][1] == "downward"){
                      if(eventFlag !==""){eventFlag += "/";}
                      eventFlag += markerData.event[e][0] +"-upper("+markerData.event[e][4]+")["+markerData.event[e][3]+"]";
                    }                                     
                  }else{
                    if(markerData.event[e][1] == "upward"){
                      if(eventFlag !==""){eventFlag += "/";}
                      eventFlag += markerData.event[e][0] +"-lower()["+markerData.event[e][3]+"]";
                    }else if(markerData.event[e][1] == "downward"){
                      if(eventFlag !==""){eventFlag += "/";}
                      eventFlag += markerData.event[e][0] +"-upper()["+markerData.event[e][3]+"]";
                    }else if(markerData.event[e][1] == "through-up"){
                      //"through-up" and "through-down" is set, so set only "through-up"
                      if(eventFlag !==""){eventFlag += "/";}
                      eventFlag += markerData.event[e][0] +"-through()["+markerData.event[e][3]+"]";
                    } 
                  }
                }

                //for connection
                for(let v=0; v<markerData.v_connection.length; v++){
                  if(markerData.v_connection[v][2] !== markerData.id[2]){
                    //if connected to other section
                    if(markerData.name.includes("-bottom")){
                      const connectedIdx = this.search_idx_list[markerData.v_connection[v].toString()];
                      const connectedMarkerData2 = this.projects[connectedIdx[0]].holes[connectedIdx[1]].sections[connectedIdx[2]].markers[connectedIdx[3]];
                      for(let v2=0; v2<connectedMarkerData2.v_connection.length;v2++){
                        if(connectedMarkerData2.name.includes("-top") && connectedMarkerData2.v_connection[v2].toString() == markerData.id.toString()){
                          //if connect both ways
                          if(eventFlag !==""){eventFlag += "/";}
                          eventFlag += "connection-upper()";
                          break;
                        }                        
                      }                       
                    }
                    if(markerData.name.includes("-top")){
                      const connectedIdx = this.search_idx_list[markerData.v_connection[v].toString()];
                      const connectedMarkerData2 = this.projects[connectedIdx[0]].holes[connectedIdx[1]].sections[connectedIdx[2]].markers[connectedIdx[3]];
                      for(let v2=0; v2<connectedMarkerData2.v_connection.length;v2++){
                        if(connectedMarkerData2.name.includes("-bottom") && connectedMarkerData2.v_connection[v2].toString() == markerData.id.toString()){
                          //if connect both ways
                          if(eventFlag !==""){eventFlag += "/";}
                          eventFlag += "connection-lower()";
                          break;
                        }                        
                      }                       
                    }
                  }
                }

                cellsData[3] = eventFlag;//for test cd              
              }
              
              //get master connections
              if(targetProjectID.toLocaleString() == this.projects[p].id.toString() && markerData.isMaster == true){
                curMasterHole.push(this.getDataByIdx(this.search_idx_list[[markerData.id[0],markerData.id[1],null,null].toString()]).name);
              }        
             
              if(targetProjectID.toLocaleString() == this.projects[p].id.toString() && markerData.isZeroPoint !== false){
                zeroMarker  = "(" + markerData.isZeroPoint + ")";
              }

              //get workspace master (MAIN) connections
              for(let hc=0;hc<markerData.h_connection.length; hc++){
                const connectedId  = markerData.h_connection[hc];
                if(projectData.model_type === "correlation"){
                  if(masterConnections[0] == null || markerData.isMaster){
                    masterConnections[0] = holeData.name;
                    masterConnections[1] = sectionData.name;
                    masterConnections[2] = markerData.distance.toFixed(1);
                    masterConnections[3] = holeData.name+"-"+sectionData.name+"-"+markerData.name; 
                  }                                   
                }                              
              } 
            }
          }

          rowData = [...rowData, ...cellsData];
        }
      }

      //calc master hole
      if(curMasterHole.length==0){
        //case top/bottom
        masterHole = prevMasterHole;
      }else if(curMasterHole.length==1){
        //case not connection point
        if(prevMasterHole==""){
          //case top
          prevMasterHole = curMasterHole[0];
        }
        masterHole = prevMasterHole;
      }else if(curMasterHole.length == 2){
        //case connection point
        for(let c=0;c<curMasterHole.length;c++){
          if(curMasterHole[c] !== prevMasterHole){
            masterHole = prevMasterHole +"/"+ curMasterHole[c];
            prevMasterHole = curMasterHole[c];
            break;
          }            
        }          
      }else{
        console.log("LCCore: Too many master marker detected at Line: " + c+1);
        return;
      }

      //add header      
      if(i==0){
        //header
        let header = ["Master hole"];

        //if duo        
        if(isMain == false){
          header  = [...header, "Master hole",	"Master section",	"Master distance (cm)", "Master lamina name"];
        }

        for(let p=0; p<this.projects.length; p++){
          if(this.projects[p].id.toString() == targetProjectID.toString()){
            for(let h=0; h<this.projects[p].holes.length; h++){
              const hole = this.projects[p].holes[h];
              header = [...header, "Laminaname(" + hole.name + ")[" + hole.type + "]", "Distance from core top (cm)", "Drilling depth (cm)", "Event"];
            }
          }
        }
        output.push(header);
      }

      //check data
      if (rowData.every(item => item === null)) {
        //there is no data
        continue;
      }

      //add master info
      if(isMain==false){
        //if duo
        rowData.unshift(...masterConnections);
        rowData.unshift(masterHole + zeroMarker);
      }else{
        rowData.unshift(masterHole + zeroMarker);
      }      

      //add row to csv
      output.push(rowData);
    }

    //add top/bottom markers
    output[1][0] = "top/" + output[1][0];
    output[output.length-1][0] = output[output.length-1][0] + "/bottom";
    
    this.setStatus("completed","");
    return output;
  }
  constructCSVforLF(resultIds, targetProjectID=this.base_project_id){
    this.setStatus("running","construct csv for LF");
    //resultIds: [cd, [horizontalMarkers...]]
    //type: "lc", "lf"
    //make output data
    let prevMasterHole = "";
    let modelOutput = [];
    let eventListOutput = [
      ["Bore_hole",	"Core_number",	"Event_top",	"Event_bottom",	"ID"],
      //["This",	"is",	"0",	"100",	""],
      //["dummy",	"for LF",	"0",	"100",	""],
    ];
    let connectionCounts = 0;

    for(let i=0;i<resultIds.length;i++){
      let masterConnections = ["@9999", "@9999", "@9999","@9999"];
      let compositeDepth = "@9999";

      const ids  = resultIds[i][1];
      let rowData = [];
      let masterHole = "";
      let curMasterHole = [];      
      for(let p=0; p<this.projects.length;p++){
        if(this.projects[p].id !== targetProjectID){
          continue;
        }
        for(let h=0; h<this.projects[p].holes.length; h++){
          const holeData = this.projects[p].holes[h];
          let cellsData = []; //[name, distance, drilling depth]
          if(this.projects[p].id.toString() == targetProjectID.toString()){
            cellsData[0] = "@9999";
            cellsData[1] = "@9999";
            cellsData[2] = "@9999";
          }
        
          for(let c=0;c<ids.length;c++){
            const id = ids[c];          
            const idx = this.search_idx_list[id.toString()];   
            if(!idx){
              //case: undifined(e.g. disconnected project)
              continue
            } 
            const sectionData = this.getDataByIdx([idx[0],idx[1],idx[2],null]);       
            const markerData  = this.getDataByIdx(idx);
            if(holeData.id.toString() == [id[0],id[1],null,null].toString()){              
              //get marker data
              if(targetProjectID.toString() == this.projects[p].id.toString()){
                //if target project
                
                cellsData[0] = "@"+markerData.name.replace(/-(top|bottom)/g, " $1");
                cellsData[1] = "@"+markerData.distance.toFixed(1);
                cellsData[2] = "@"+markerData.drilling_depth.toFixed(1);

                //calc composite depth
                let targetData = new Trinity();
                targetData.name = "";
                targetData.project_name = this.projects[p].name;
                targetData.hole_name    = holeData.name;
                targetData.section_name = sectionData.name;
                targetData.distance     = markerData.distance;
                const cd = resultIds[i][0];
                compositeDepth = "@"+cd.toFixed(1);
                //const cd = this.getDepthFromTrinity(id, [targetData], "composite_depth");
                //if(cd[0][1]!==null){
                //  compositeDepth = "@"+cd[0][1].toFixed(1);
                //}

                //get event list
                //Bore_hole	core_number	Event_top	Event_bottom	ID
                let eventData = [];
                for(let e=0;e<markerData.event.length;e++){
                  if(markerData.event[e][0]=="erosion"){
                    //case erosion event
                    const txt = "Erosion event was detected at "+
                                holeData.name+"-"+sectionData.name+"-"+markerData.distance.toFixed(1)+"cm. "+
                                "Level Finder does not support erosion event.";
                    console.log("LCCore: "+txt);
                    this.setErrorAlert("",txt);
                    return false;
                  }else if(markerData.event[e][0]=="markup"){
                    //case markup
                    const txt = "Unsupported markup event for Level Finder was detected at "+
                                holeData.name+"-"+sectionData.name+"-"+markerData.distance.toFixed(1)+"cm. "+
                                "Removed from exported data.";
                    console.log("LCCore: "+txt);
                    this.setError("",txt);
                    continue;
                    //return "Unsupported markup event for Level Finder was detected.";
                  }else{
                    //case deposition event
                    if(markerData.event[e][1] == "upward"){
                      //event start
                      eventData[0] = holeData.name;
                      eventData[1] = sectionData.name;
                      eventData[3] = markerData.distance.toFixed(1);
                      if(markerData.event[e][3]=="tephra"){
                        eventData[4] = "(Tephra)";
                      }else{
                        eventData[4] = "";
                      }
                      eventData[4] += markerData.name;

                      //find event end
                      let connectedId = markerData.event[e][2];
                      let tc = 0;
                      while(connectedId && tc<100){
                        tc++;
                        const connectedIdx = this.search_idx_list[connectedId.toString()];
                        const connectedMarkerData = this.getDataByIdx(connectedIdx);
                        for(let ce=0; ce<connectedMarkerData.event.length; ce++){
                          if(connectedMarkerData.event[ce][1] == "downward"){
                            //found end point
                            connectedId = null;
                            eventData[2] = connectedMarkerData.distance.toFixed(1);
                          }else if(connectedMarkerData.event[ce][1] == "through-up"){
                            //found through-up
                            connectedId = connectedMarkerData.event[ce][2];
                            break;
                          }else{
                            //found through-down
                          }
                        }
                        if(tc==100){
                          console.log("LCCore: Failed to detect event upper.");
                          this.setErrorAlert("","Failed to detect event upper.");
                          return false;
                        }                        
                      }                      
                    } 
                    
                    //add row to output event data
                    if(eventData.length == 5){
                      eventListOutput.push(eventData);
                    }else if(eventData.length == 0){

                    }else{
                      console.log("LCCore: Failed to get event data.");
                      this.setErrorAlert("","Failed to get event data.");
                      return false;
                    }
                  }

                }
              }

              //get project master connections
              if((targetProjectID.toString() == this.projects[p].id.toString()) && markerData.isMaster == true){
                curMasterHole.push(this.getDataByIdx(this.search_idx_list[[markerData.id[0],markerData.id[1],null,null].toString()]).name);
              }  
              
              //get workspace master connections
              for(let hc=0;hc<markerData.h_connection.length; hc++){
                const connectedId = markerData.h_connection[hc];
                if([connectedId[0], null,null,null].toString() == this.base_project_id.toString()){
                  //if connected base project
                  const connectedMarkerData = this.getDataByIdx(this.search_idx_list[connectedId.toString()]);
                  if((connectedMarkerData.id.toString() == this.base_project_id.toString() && connectedMarkerData.isMaster )|| masterConnections[0] == "@9999"){
                    masterConnections[0] = "@"+holeData.name;
                    masterConnections[1] = "@"+sectionData.name;
                    masterConnections[2] = "@"+markerData.distance.toFixed(1);
                    masterConnections[3] = "@"+holeData.name+"-"+sectionData.name+"-"+markerData.name;
                  }
                }                
              } 
            }
          }

          rowData = [...rowData, ...cellsData];
        }        
      }

      //check length
      if(rowData.length<12){
        const numAddHole = (12-rowData.length)/3;
        if(Number.isInteger(numAddHole)){
          for(let n=0;n<numAddHole;n++){
            rowData = [...rowData,"@9999","@9999","@9999"];
          }
        }else{
          console.log("LCCore: Unexpected number of columns encountered");
          this.setErrorAlert("","Unexpected number of columns encountered");
          return false;
        }
      }       

      //calc master hole
      if(curMasterHole.length==0){
        //case top/bottom
        masterHole = prevMasterHole;
      }else if(curMasterHole.length==1){
        //case not connection point
        if(prevMasterHole==""){
          //case top
          prevMasterHole = "@"+curMasterHole[0];
        }
        masterHole = prevMasterHole;
      }else if(curMasterHole.length == 2){
        //case connection point
        connectionCounts += 1;
        for(let c=0;c<curMasterHole.length;c++){
          if("@"+curMasterHole[c] !== prevMasterHole){
            masterHole = "@K-"+String(connectionCounts).padStart(3, "0");
            prevMasterHole = "@"+curMasterHole[c];
            break;
          }            
        }          
      }else{
        console.log("LCCore: Too many master marker detected at Line: " + c+1);
        this.setErrorAlert("","Too many master marker detected at Line: " + c+1);
        return false;
      }

      //add header
      if(i==0){
        //header
        let header = ["@Master section"];
        for(let p=0; p<this.projects.length; p++){
          for(let h=0; h<this.projects[p].holes.length; h++){
            const hole = this.projects[p].holes[h];
            if(targetProjectID.toString() == this.projects[p].id.toString()){
              //if target id
              header = [...header, "@Lamina name (" + hole.name + ")", "@Position on the Scale in the Photo (PSP) (cm)", "@Drilling depth (cm)"];
            }            
          }
        }

        if(header.length-1<12){
          const numAddHole = (12-(header.length-1))/3;
          if(Number.isInteger(numAddHole)){
            for(let n=0;n<numAddHole;n++){
              header = [...header,"@Laminaname()", "@Position on the Scale in the Photo (PSP) (cm)", "@Drilling depth (cm)"];
            }
          }else{
            console.log("LCCore: Unexpected number of columns encountered");
            this.setErrorAlert("","Unexpected number of columns encountered");
            return false;
          }
        }

        //add composite depth
        header = [...header, "@Compsite depth (cm)"];

        //if duo
        if(targetProjectID.toString() !== this.base_project_id.toString()){
          header  = [...header, "@Master core hole name",	"@Master core number",	"@Master core distance from core top (cm)", "@Master core lamina name"];
        }

        modelOutput.push(header);
      }

      //check data
      if (rowData.every(item => item === "@9999")) {
        //there is no data
        continue;
      }

      //add master info
      rowData.unshift(masterHole);
      rowData.push(compositeDepth);

      //if duo
      if(targetProjectID !== this.base_project_id){
        rowData = [...rowData, ...masterConnections];
      }

      //add row to outpt model data
      modelOutput.push(rowData);
      
    }
    
    this.setStatus("completed","");
    return {model: modelOutput, event:eventListOutput};
  }
  changeBaseProject(baseProjectId){
    this.base_project_id = baseProjectId;
  }
  measurePerformance(func, ...args) {
    if (this._measurePerformance === false) {
      return func.apply(this, args); 
    }

    const label = func.name;
    performance.mark(label + "-start");

    const result = func.apply(this, args);
    performance.mark(label + "-end");
    performance.measure(label, label + "-start", label + "-end");

    const entry = performance.getEntriesByName(label).pop();
    if (!this._performance[label]) {
      this._performance[label] = { time: 0, counts: 0 };
    }
    this._performance[label].time += entry?.duration || 0;
    this._performance[label].counts += 1;

    performance.clearMarks(label + "-start");
    performance.clearMarks(label + "-end");
    performance.clearMeasures(label);

    return result;
  }
  exportSerialisedModel() {
    return JSON.parse(JSON.stringify(this, (key, value) => {
      
      if (typeof value === "function") return undefined;

      if (key && key[0] === "_") return undefined;



      return value;
    }));
  }

  /*
  convertLF2LC(filepath){
    //this function is converting correlation model csv for Level Finder to correlation model csv for Level Compiler
    
    let outModelData = [];

    //load model
    const modelData = lcfnc.readcsv(filepath);
    
    //check
    let version = "";
    let modelName = "";
    var fileName = filepath.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // ^(.*?)\((.*?)\)\.csv$/)
    var match = fileName.match(patern);
    if(match && match[1] && match[2]){    
      modelName = match[2]; 
      version = match[3];
    }

    let modelType = "correlation";
    if(modelData[0][14] !== undefined && modelData[0][15] !== undefined && modelData[0][16] !== undefined){
      modelType = "duo";
    }

    //check is jump hole necessary
    let isSpacer = false;
    let isJumpSec = false;
    for(let r=1; r<modelData.length; r++){
      if(modelData[r][0].includes("-")){
        //if jump point
        if(modelData[r-1][0].slice(1).trim() !== modelData[r+1][0].slice(1).trim()){
          if(isJumpSec){
            //If jump point appears consecutively
            isSpacer = true;
            break;
          }
          isJumpSec = true;          
        }else{
          //irregular jump point
          isSpacer = true;
          break;
        }
      }else{
        isJumpSec = false;
      }
    }

    //header
    let header = ["Master"];
    if(modelType=="duo"){
      header.push("Master hole",	"Master section",	"Master distance (cm)",	"Master lamina name");
    }

    let numHoles = 0;    
    let holeNames = new Set();
    for(let i=0; i<4; i++){
      //count holes
      
      if(modelData[0][1+3*i]){
        const match = modelData[0][1+3*i].slice(1).match(/\(([^)]*)\)/);

        if(match && match[1]){     
          numHoles++;   
          holeNames.add((modelData[0][1+3*i].slice(1).match(/\(([^)]+)\)/) || [,""])[1]);
          

          //LF model has 4 holes
          header.push(modelData[0][1+3*i].slice(1)+"[general]"); //lamina name
          header.push("Distance from core top (cm)"); //distance
          header.push("Drilling depth (cm)"); //drilling depth
          header.push("Event"); // event
        }
      }      
    }

    if(isSpacer){
      header.push("Lamina name (jump)[general]"); //lamina name
      header.push("Distance from core top (cm)"); //distance
      header.push("Drilling depth (cm)"); //drilling depth
      header.push("Event"); // event
    }
    outModelData.push(header);
      console.log(holeNames)

    //body
    let jumpSecType = "";
    let isSteppedJumpSec = false;
    for(let r=1; r<modelData.length; r++){
      let fromRow = modelData[r];
      let toRow   = [];
      jumpSecType = "";

      //master hole
      let masterHole = "";
      if(r==1){
        masterHole += "top/";
      }

      //if(fromRow[0].includes("-")){
      if(!holeNames.has(fromRow[0].slice(1))){
        //if jump point
        if(modelData[r-1][0].slice(1) == modelData[r+1][0].slice(1)){
          if(isSteppedJumpSec){
            masterHole += "jump";
            jumpSecType = "";
          }else{
            masterHole += modelData[r-1][0].slice(1);
            jumpSecType = "";
          }
          
           console.log(masterHole)
        }else{
          

          if(!modelData[r+1][0].includes("-") && !modelData[r-1][0].includes("-")){
            masterHole += modelData[r-1][0].slice(1)+"/"+modelData[r+1][0].slice(1);
            jumpSecType = "";           
          }else{
            if(isSpacer && r<modelData.length-1 && modelData[r+1][0].includes("-")){
              //if spacer necessary
              masterHole += modelData[r-1][0].slice(1)+"/jump";
              jumpSecType = "top";
              isSteppedJumpSec = true;
              console.log(masterHole)
            }
            if(isSpacer && isSteppedJumpSec && r>1 && modelData[r-1][0].includes("-")){
              //if spacer necessary
              masterHole += "jump/"+modelData[r+1][0].slice(1);
              jumpSecType = "bottom";
              isSteppedJumpSec = false;
              console.log(masterHole)
            }
          }
        }        
      }else{
        //others        
        masterHole += fromRow[0].slice(1);
      }

      if(r==modelData.length-1){
        masterHole += "/bottom";
      }

      //add zero point
      if(r==1){
        masterHole += "("+modelData[1][13].slice(1)+")";        
      }

      toRow.push(masterHole);

      //add master connection
      let startPos = 1;
      if(modelType=="duo"){
        const masterHole = (fromRow[14].slice(1) == "9999") ? "" : fromRow[14].slice(1);
        const masterSec  = (fromRow[15].slice(1) == "9999") ? "" : fromRow[15].slice(1);
        const masterDist = (fromRow[16].slice(1) == "9999") ? "" : fromRow[16].slice(1);
        const masterName = (fromRow[17].slice(1) == "9999") ? "" : fromRow[17].slice(1);

        toRow.push(masterHole, masterSec, masterDist, masterName);
      }

      //hole data
      for(let h=0; h<numHoles; h++){
        let name   = (fromRow[startPos+3*h].slice(1) == "9999")   ? "" : fromRow[startPos+3*h].slice(1);
        const dist = (fromRow[startPos+1+3*h].slice(1) == "9999") ? "" : fromRow[startPos+1+3*h].slice(1);
        const dd   = (fromRow[startPos+2+3*h].slice(1) == "9999") ? "" : fromRow[startPos+2+3*h].slice(1);
        const event= "";

        if(name.includes("top")){
          name = name.replace(" top","");
          name = name.trim();//remove end space
          name += "-top";
        }
        if(name.includes("bottom")){
          name = name.replace(" bottom","");
          name = name.trim();//remove end space
          name += "-bottom";
        }

        toRow.push(name, dist, dd, event);
      }

      if(isSpacer){
        if(jumpSecType==""){
          toRow.push("","","","");
        }else if(jumpSecType=="top"){
          toRow.push("jump-00-top", "0", modelData[r][13].slice(1), "");
        }else if(jumpSecType=="bottom"){
          toRow.push("jump-00-bottom", String(Number(modelData[r][13].slice(1))-Number(modelData[r-1][13].slice(1))), modelData[r][13].slice(1), "");
        }
          
      }
      outModelData.push(toRow);
    }

    return {name: modelName, type:modelType, version: version, model: outModelData};
  }
    */
  convertLF2LC(filepath){
    //this function is converting correlation model csv for Level Finder to correlation model csv for Level Compiler
    
    let outModelData = [];

    //load model
    const modelData = lcfnc.readcsv(filepath);
    
    //check
    let version = "";
    let modelName = "";
    var fileName = filepath.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // ^(.*?)\((.*?)\)\.csv$/)
    var match = fileName.match(patern);
    if(match && match[1] && match[2]){    
      modelName = match[2]; 
      version = match[3];
    }

    let modelType = "correlation";
    if(modelData[0][14] !== undefined && modelData[0][15] !== undefined && modelData[0][16] !== undefined){
      modelType = "duo";
    }

    //check is jump hole necessary
    let isSpacer = false;
    let isJumpSec = false;
    for(let r=1; r<modelData.length; r++){
      if(modelData[r][0].includes("-")){
        //if jump point
        if(modelData[r-1][0].slice(1).trim() !== modelData[r+1][0].slice(1).trim()){
          if(isJumpSec){
            //If jump point appears consecutively
            isSpacer = true;
            break;
          }
          isJumpSec = true;          
        }else{
          //irregular jump point
          isSpacer = true;
          break;
        }
      }else{
        isJumpSec = false;
      }
    }

    //header
    let header = ["Master"];
    if(modelType=="duo"){
      header.push("Master hole",	"Master section",	"Master distance (cm)",	"Master lamina name");
    }

    let numHoles = 0;    
    let holeNames = new Set();
    for(let i=0; i<4; i++){
      //count holes
      
      if(modelData[0][1+3*i]){
        const match = modelData[0][1+3*i].slice(1).match(/\(([^)]*)\)/);

        if(match && match[1]){     
          numHoles++;   
          holeNames.add((modelData[0][1+3*i].slice(1).match(/\(([^)]+)\)/) || [,""])[1]);
          

          //LF model has 4 holes
          header.push(modelData[0][1+3*i].slice(1)+"[general]"); //lamina name
          header.push("Distance from core top (cm)"); //distance
          header.push("Drilling depth (cm)"); //drilling depth
          header.push("Event"); // event
        }
      }      
    }

    if(isSpacer){
      header.push("Lamina name (jump)[general]"); //lamina name
      header.push("Distance from core top (cm)"); //distance
      header.push("Drilling depth (cm)"); //drilling depth
      header.push("Event"); // event
    }
    outModelData.push(header);

    //body
    let jumpSec = "";
    let jumpTopCD = null;
    for(let r=1; r<modelData.length; r++){
      let fromRow = modelData[r];
      let toRow   = [];

      //master hole
      let masterHole = "";
      if(r==1){
        masterHole += "top/";
      }

      if(!holeNames.has(fromRow[0].slice(1))){
        //step layer
        if(jumpSec===""){
          //not jumped
          //normal or top
          const upperMaster = modelData[r-1][0].slice(1);
          const lowerMaster = modelData[r+1][0].slice(1);
          if(r>1 && r<modelData.length-1){
            if(holeNames.has(upperMaster)){
              if(holeNames.has(lowerMaster)){
                if(upperMaster !== lowerMaster){
                  //normal step
                  masterHole += modelData[r-1][0].slice(1)+"/"+modelData[r+1][0].slice(1);
                  jumpSec = "";
                }else{
                  //irregular jump(same hole)
                  masterHole += modelData[r-1][0].slice(1)+"/jump";
                  jumpSec = "top";
                  jumpTopCD = Number(modelData[r][13].slice(1));
                  //console.log(1, r)
                }                  
              }else{
                //jump top
                masterHole += modelData[r-1][0].slice(1)+"/jump";
                jumpSec = "top";
                jumpTopCD = Number(modelData[r][13].slice(1));
                //console.log(2, r)
              }
            }
          }
        }else{
          //jumped
          //case: bottom
          if(r<modelData.length-1){
            masterHole += "jump/"+modelData[r+1][0].slice(1);
            jumpSec = "bottom";// use below
            //console.log(3, r)
          }        
        }        
      }else{
        //continue layer
        if(jumpSec===""){
          //not jumped
          masterHole += modelData[r][0].slice(1);
          jumpSec = "";
        }else{
          //jumped
          masterHole += "jump";
          jumpSec = "continue";
        }        
      }

      if(r==modelData.length-1){
        masterHole += "/bottom";
      }

      //add zero point
      if(r==1){
        masterHole += "("+modelData[1][13].slice(1)+")";        
      }
      
      toRow.push(masterHole);

      //add master connection
      let startPos = 1;
      if(modelType=="duo"){
        const masterHole = (fromRow[14].slice(1) == "9999") ? "" : fromRow[14].slice(1);
        const masterSec  = (fromRow[15].slice(1) == "9999") ? "" : fromRow[15].slice(1);
        const masterDist = (fromRow[16].slice(1) == "9999") ? "" : fromRow[16].slice(1);
        const masterName = (fromRow[17].slice(1) == "9999") ? "" : fromRow[17].slice(1);

        toRow.push(masterHole, masterSec, masterDist, masterName);
      }

      //hole data
      for(let h=0; h<numHoles; h++){
        let name   = (fromRow[startPos+3*h].slice(1) == "9999")   ? "" : fromRow[startPos+3*h].slice(1);
        const dist = (fromRow[startPos+1+3*h].slice(1) == "9999") ? "" : fromRow[startPos+1+3*h].slice(1);
        const dd   = (fromRow[startPos+2+3*h].slice(1) == "9999") ? "" : fromRow[startPos+2+3*h].slice(1);
        const event= "";

        /*
        if(name.includes("top")){
          name = name.replace(" top","");
          name = name.trim();//remove end space
          name += "-top";
        }
        if(name.includes("bottom")){
          name = name.replace(" bottom","");
          name = name.trim();//remove end space
          name += "-bottom";
        }
          */
        const regexTop = /\s*(top)$/i;
        if (regexTop.test(name)) {
          name = name.replace(regexTop, "");
          
          name = name.trim();
          name += "-top"; 
        }
        const regexBottom = /\s*(bottom|bottm|bttom|botom)$/i;
        if (regexBottom.test(name)) {
          name = name.replace(regexBottom, "");
          
          name = name.trim();
          name += "-bottom"; 
        }

        toRow.push(name, dist, dd, event);
      }

      if(isSpacer){
        if(jumpSec==""){
          toRow.push("","","","");
        }else if(jumpSec=="bottom"){
          toRow.push("jump-00-bottom", String(Number(modelData[r][13].slice(1))-jumpTopCD), modelData[r][13].slice(1), "");
          jumpSec = "";
          jumpTopCD = null;
          //console.log("jump-00-bottom", String(Number(modelData[r][13].slice(1))-Number(modelData[r-1][13].slice(1))), modelData[r][13].slice(1), "")
        }else if(jumpSec=="top"){
          toRow.push("jump-00-top", "0", modelData[r][13].slice(1), "");
          //console.log("jump-00-top", "0", modelData[r][13].slice(1), "")
        }else if(jumpSec=="continue"){
          toRow.push("","","","");
          //console.log("_","_","_","_")
        }
          
      }
      
      outModelData.push(toRow);
    }

    return {name: modelName, type:modelType, version: version, model: outModelData};
  }
  updateVersionInfo(date=null){
    let version = "";
    if(date){
      version = date;
    }else{
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const sec = String(now.getSeconds()).padStart(2, '0');


      version = `${year}-${month}-${day} (${hour}:${min}:${sec})`;
    }
    
    for(let i=0;i<this.projects.length;i++){
      if(this.projects[i].correlation_version !== version){
        console.log("LCCore: Update version [" + this.projects[i].name + "] " + this.projects[i].correlation_version + " => " + version);
        this.projects[i].correlation_version = version;
      }      
    }    
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
  isConnectMasterProject(targetId){
    let masterProjectId = null;
    for(let p=0; p<this.projects.length; p++){
      if(this.projects[p].model_type=="correlation" && this.projects[p].id[0] == this.base_project_id[0]){
        masterProjectId = this.projects[p].id;
        if(this.projects[p].id[0] === targetId[0]){
          //target is master project
          return true
        }
      }
    }

    if(!masterProjectId){
      return false;
    }

    for(let p=0; p<this.projects.length; p++){
      if(this.projects[p].id[0] !== targetId[0]){
        continue
      }
      if(this.projects[p].model_type!=="duo"){
        continue
      }
      for(let h=0; h<this.projects[p].holes.length; h++){
        for(let s=0; s<this.projects[p].holes[h].sections.length; s++){
          for(let m=0; m<this.projects[p].holes[h].sections[s].markers.length; m++){
            const marker = this.projects[p].holes[h].sections[s].markers[m];
            for(let hc=0; hc<marker.h_connection.length; hc++){
              if(marker.h_connection[hc][0]===masterProjectId[0]){
                return true;                
              }
            }
          }
        }
      }
    }
    return false
  }
  leaveOneOut(target="in"){
    const data = [];

    data.push([
      "Project Name",
      "Hole Name",
      "Section Name",
      "Position",
      "Original interpolate Source",
      "Leave One Out interpolate Source",
      "Original Composite Depth",
      "Leave One Out Composite Depth"
    ]);

    const backupProjects = structuredClone(this.projects);
    console.log("Start Leave-One-Out evaluation")

    for (let p=0; p<this.projects.length; p++){
      for(let h=0; h<this.projects[p].holes.length; h++){
        for(let s=0; s<this.projects[p].holes[h].sections.length; s++){
          for(let m=0; m<this.projects[p].holes[h].sections[s].markers.length; m++){
            const rateProject = ((p)/(this.projects.length));
            const rateHole    = ((h)/(this.projects[p].holes.length));
            const rateSection = ((s)/(this.projects[p].holes[h].sections.length));
            
            //progress
            console.log((rateProject*100).toFixed(1)+"%", (rateHole*100).toFixed(1)+"%", (rateSection*100).toFixed(1)+"%")
            
            //get current data
            const currentMarkerData = structuredClone(this.projects[p].holes[h].sections[s].markers[m]);
            
            //disconnect horizontal connections
            for(let hc=0; hc<this.projects[p].holes[h].sections[s].markers[m].h_connection.length; hc++){
              const connectedId = this.projects[p].holes[h].sections[s].markers[m].h_connection[hc]
              if(target==="in"){
                //case in same project
                if(connectedId[0] ===  this.projects[p].id[0]){
                  //if same project
                  const connectedMarkerData = this.getDataByIdx(this.search_idx_list[connectedId.toString()]);
                  this.disconnectMarkers(currentMarkerData.id, connectedId, "horizontal");
                }
              }else{
                //case between projects
                if(connectedId[0] !==  this.projects[p].id[0]){
                  //if between project
                  
                  this.disconnectMarkers(currentMarkerData.id, connectedId, "horizontal");
                }
              }              
            }  

            //calc new composite depth
            this.calcCompositeDepth();
            const newCurrentMarkerData = this.projects[p].holes[h].sections[s].markers[m];
            data.push([
              this.projects[p].name,
              this.projects[p].holes[h].name,
              this.projects[p].holes[h].sections[s].name,
              this.projects[p].holes[h].sections[s].markers[m].distance,
              currentMarkerData.depth_source[0],
              newCurrentMarkerData.depth_source[0],
              currentMarkerData.composite_depth,
              newCurrentMarkerData.composite_depth
            ]);

            //restore connections
            this.projects = structuredClone(backupProjects);
            this.updateSearchIdx();

          }
        }
      }
    }

    //restore


    console.log("Done")
    return data;
  }

  
}


module.exports = { LevelCompilerCore };
