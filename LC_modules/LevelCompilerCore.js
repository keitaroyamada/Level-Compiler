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

class LevelCompilerCore extends EventEmitter{
  constructor() {
    super();
    this.projects = [];
    this.search_idx_list = {};
    this.base_project_id = null;
    this.reserved_project_ids = [0];
    this.state = {
      status: 'initiarise',
      statusDetails: null,      
      hasError: false,    
      errorDetails: null,  
    };
    
    this.on('error', (err) => {
      console.error('LCCore:'+ err.statusDetails);
    });
    this.on('error_alert', (err) => {
      console.error('LCCore:'+ err.statusDetails);
    });
  }
  
  //status type: ["initiarise","running","completed","error","error_important"]
  setStatus(newStatus, statusDetails) {
    this.state.status = newStatus;
    this.state.statusDetails = statusDetails;
    this.state.hasError = false; 
    this.state.errorDetails = null;
    this.emit('change', this.state);
  }
  setError(errorMessage,statusDetails) {
    this.state.status = 'error';
    this.state.statusDetails = statusDetails;
    this.state.hasError = true; 
    this.state.errorDetails = errorMessage;
    this.emit('error', this.state);
  }
  setErrorAlert(errorMessage,statusDetails) {
    this.state.status = 'error_alert';
    this.state.statusDetails = statusDetails;
    this.state.hasError = true; 
    this.state.errorDetails = errorMessage;
    this.emit('error_alert', this.state);
  }
  setUpdateDepth() {
    //set update event for LCAge, LCPlot
    this.state.status = 'update_depth';
    this.state.statusDetails = null;
    this.state.hasError = false; 
    this.state.errorDetails = null;
    this.emit('update_depth');
  }
  getState() {
    return this.state;
  }

  //methods
  loadModelFromCsv(model_path) {
    console.time("        Load csv");
    this.setStatus("running", "Start loadModelFromCsv");

    //initiarise
    const projectData = new Project();

    //load model
    projectData.model_data = lcfnc.readcsv(model_path);
    var fileName = model_path.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // ^(.*?)\((.*?)\)\.csv$/)
    var match = fileName.match(patern);
    let model_info = {};

    let isDuo = false;
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
      this.setError("","E051: The is no project data.");
      return null;
    }

    //add project data
    const newProjectId = lcfnc.getUniqueId(this.reserved_project_ids);
    this.reserved_project_ids.push(newProjectId);
    let p = this.projects.length;
    projectData.id = [newProjectId, null, null, null];
    projectData.name = model_info.name;
    projectData.correlation_version = model_info.version;
    projectData.order = newProjectId;
    //make brank marker id list
    const markerIdList = lcfnc.makeMarkerIdBase(
      projectData.model_data.length,
      projectData.model_data[0].length
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
      const newHoleId = lcfnc.getUniqueId(projectData.reserved_hole_ids);
      projectData.reserved_hole_ids.push(newHoleId);

      holeData.id = [newProjectId, newHoleId, null, null];
      holeData.name = lcfnc.zeroPadding(holeList[h][1]);
      holeData.type = holeList[h][2];
      holeData.order = h;

      //get section list
      const sectionList = this.getSectionListFromCsv(projectData, holeList[h]); //return: [holeidx, [top secidx, bottom secidx], name]

      for (let s = 0; s < sectionList.length; s++) {
        //make instance
        let sectionData = new Section();

        //add info
        const newSectionId = lcfnc.getUniqueId(holeData.reserved_section_ids);
        holeData.reserved_section_ids.push(newSectionId); //reserve id
        sectionData.id = [newProjectId, newHoleId, newSectionId, null];
        sectionData.name = lcfnc.zeroPadding(sectionList[s][2]);
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
          const newMarkerId = lcfnc.getUniqueId(
            sectionData.reserved_marker_ids
          );
          sectionData.reserved_marker_ids.push(newMarkerId);
          markerData.id = [
            projectData.id[0],
            newHoleId,
            newSectionId,
            newMarkerId,
          ];
          markerData.order = m;

          const marker_r = markerList[2][m]; //id is deified at marker row
          const marker_c = markerList[0]; //id is defied at marker Name col

          markerIdList[marker_r][marker_c] = markerData.id; //add marker list

          markerData.name = lcfnc.zeroPadding(
            projectData.model_data[marker_r][marker_c].toString()
          );
          markerData.distance = parseFloat(
            projectData.model_data[marker_r][marker_c + 1]
          );
          markerData.drilling_depth = parseFloat(
            projectData.model_data[marker_r][marker_c + 2]
          );

          //check master section
          const masterHole = projectData.model_data[marker_r][0]
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
                  projectData.model_data[marker_r][0].match( /\((-?\d+(\.\d+)?)\)/ ) !== null
                ) {
                  markerData.isZeroPoint = projectData.model_data[marker_r][0].match( /\((-?\d+(\.\d+)?)\)/ )[1];
                }
              //}
            }
          }

          //load event data
          const events =
            projectData.model_data[marker_r][marker_c + 3].split("/");
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
              } else if (event[1] == "upward" || event[1]) {
                let thickness = parseFloat(event[2]);
                if (!isNaN(thickness)) {
                  eventData.push(["deposition", "upward", -thickness, eventCategory, -thickness]);
                }
              } else if (event[1] == "downward" || event[1]) {
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
            } else if (event[0] == "") {
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
        [this.projects[0], this.projects[this.projects.length-1]] = [this.projects[this.projects.length-1], this.projects[0]];
        this.updateSearchIdx();
        this.base_project_id = projectData.id;
        [this.projects[0].order, this.projects[this.projects.length-1].order] = [this.projects[this.projects.length-1].order, this.projects[0].order];
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
          let row_data = projectData.model_data[marker_r];
          let start_k;
          if (projectData.model_type == "correlation") {
            start_k = 2;
            for (let k = start_k; k < row_data.length; k += 4) {
              //check distance data col
              const val = projectData.model_data[marker_r][k];
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
              const val = projectData.model_data[marker_r][k];
              if (val != "" && !isNaN(parseFloat(val))) {
                const correlated_marker_id = markerIdList[marker_r][k - 1];

                //exclude own id
                if (correlated_marker_id.join("-") !== this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id.join("-")) {
                  this.projects[projectIdx[0]].holes[h].sections[s].markers[m].h_connection.push(correlated_marker_id);
                }

                //add duo connection object
                const model_r = projectData.model_data[marker_r];
                if (model_r[1] !== "") {
                  const duo_connected_hole = lcfnc.zeroPadding(model_r[1]);
                  const duo_connected_sec = lcfnc.zeroPadding(model_r[2]);
                  const duo_connected_dist = Math.round(parseFloat(model_r[3]) * 10) / 10;
                  this.projects[projectIdx[0]].duo_connection[correlated_marker_id.toString()] = [
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
            let previousMarker =
              this.projects[projectIdx[0]].holes[h].sections[s].markers[m - 1];
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
            let nextMarker =
              this.projects[projectIdx[0]].holes[h].sections[s].markers[m + 1];

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
    const isMakeNewMarker = this.connectEventPairs(projectIdx);

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

    console.timeEnd("        Load csv")

    return true;

  }
  connectDuoModel() {
    console.time("        Connect duo")
    this.setStatus("running","Start connectDuoModel")
    //if no connected markers in the master project, create a new marker.
    let isAllowAddMarker = true;

    if (this.projects.length < 1) {
      return;
    }
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
            const masterTrinity = this.projects[p].duo_connection[markerData.id.toString()];
            if (masterTrinity == undefined) {
              continue;
            }
            //search previously loaded model
            let connectedMarkerIdx = [];
            for (let i = 0; i < 1; i++) {
              //search only in master
              //for (let i = 0; i < p; i++) {
              let tempIdx = this.getIdxFromTrinity(this.projects[i].id, masterTrinity);
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
                      tempIdx = this.getIdxFromTrinity(this.projects[i].id, masterTrinity);
  
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
            }

            //check connection
            if (connectedMarkerIdx.length == 0) {
              this.setError("","E012: There is no correlated marker in the previously loaded projects.");
              //console.log( "LCCore: E012: There is no correlated marker in the previously loaded projects."  );
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
            this.connectMarkers(duoId, msId, "horizontal");

            //this.projects[p].holes[h].sections[s].markers[m].h_connection
          }
        }
      }
    }
    this.setStatus("completed","Connected duo model.")
    console.timeEnd("        Connect duo")
  }
  calcCompositeDepth() {
    console.time("        Calc CD")
    this.setStatus("running","start calcCompositeDepth");
    this.initiariseCDEFD();
    //"all(not recommended)": All mode contains some problems in 2nd order interpolation and matchs between extrapolations.
    const calcRange = "project";
    
    this.calcDFSDepth(calcRange, "composite_depth");

    if(calcRange == "project"){
      this.convertDepthDuo2Master("composite_depth");
    }
    
    console.log("LCCore: Calced composite depth.");
    this.setStatus("completed","Calced composite depth.")
    console.timeEnd("        Calc CD")
  }
  calcEventFreeDepth() {
    console.time("        Calc EFD")
    this.setStatus("running","start calcEventFreeDepth");
    const calcRange = "project";
       
    this.calcDFSDepth(calcRange, "event_free_depth");

    if(calcRange == "project"){
      this.convertDepthDuo2Master("event_free_depth");
    }

    console.log("LCCore: Calced event free depth.");
    this.setUpdateDepth();
    this.setStatus("completed","Calced Event Free Depth.")
    console.timeEnd("        Calc EFD")
  }
  calcDFSDepth(calcRange, calcType){
    this.setStatus("running","start calcDFSDpeth")
    //check data
    if (this.projects.length == 0) {
      this.setErrorAlert("","E014: There is no correlation model.")
      console.log("E014: There is no correlation model.");
      return;
    }

    //initiarise
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
    let masterDfsList = [];
    for (let p=0; p<this.projects.length; p++){
      //calc composite depth by limited DFS method
      if(zeroPoints[p] == null){
        //case no zero point in the project
        this.setError("","E015: There is no Zero point in the project: "+this.projects[p].name)
        console.log("LCCore: E015: There is no Zero point in the project: "+this.projects[p].name);
        continue;
      }
      const [id_zero_point, startVal, isBaseProject] = zeroPoints[p];

      if(calcRange == "project" || (calcRange == "all" && isBaseProject == true)){
        masterDfsList.push([this.projects[p].id, this.dfs(id_zero_point, startVal, calcRange, calcType)]);
      }
    }
    
    //initial submit local CD/EFD in each project
    for(let pi=0;pi<masterDfsList.length;pi++){
      //get project data
      let [projectId, depthDict] = masterDfsList[pi]

      //get depth data of each marker
      for (let key in depthDict) {
        let depth  = parseFloat(depthDict[key]);
        const midx = this.search_idx_list[key];

        //submit depth
        this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]][calcType] = depth;

        //submit rank, depth_source
        let currentMarkerData = this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]];

        if(calcRange=="all"){
          //submit rank & depth_source
          if (currentMarkerData.isMaster == true && currentMarkerData.id[0]==this.base_project_id[0]) {
            //case master section in the base master model
            this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].connection_rank = 0;
            this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].depth_source = ["master",null,null];
          }else{
            //case pallarel section in the base master section(transfer)
            this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].connection_rank = 1;
            for (let i = 0; i < currentMarkerData.h_connection.length; i++){
              let transferMarkerData = this.getDataByIdx(this.search_idx_list[currentMarkerData.h_connection[i]]);
              //if connect master marker
              if(transferMarkerData.isMaster && transferMarkerData.id[0]==1){
                this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].depth_source = ["master-transfer",transferMarkerData.id,null];
              }
            }
                
          }          
        }else if(calcRange="project"){
          if (currentMarkerData.isMaster == true) {
            //submit rank & depth_source
            if(currentMarkerData.id[0]==this.base_project_id[0]){
              //case base master project
              this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].connection_rank = 0;
              this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].depth_source = ["master", null, null];    
            }else{
              //case duo master project
              this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].connection_rank = 1;
              this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].depth_source = ["duo-master", null, null];    
            }
          } else{
            //case pallarel section in the base master section(transfer)
            if(currentMarkerData.id[0]==this.base_project_id[0]){
              //case base master project
              this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].connection_rank = 1;
              let transferMarkerData = null;
              for (let i = 0; i < currentMarkerData.h_connection.length; i++){
                let tempMarkerData = this.getDataByIdx(this.search_idx_list[currentMarkerData.h_connection[i]]);
                if (tempMarkerData.isMaster == true){
                  //if connect master marker
                  transferMarkerData = tempMarkerData;
                  this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].depth_source = ["master-transfer",transferMarkerData.id,null];
                }
              }
            }else{
              //case duo master project
              this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].connection_rank = 1;
              let transferMarkerData = null;
              for (let i = 0; i < currentMarkerData.h_connection.length; i++){
                let tempMarkerData = this.getDataByIdx(this.search_idx_list[currentMarkerData.h_connection[i]]);
                if (tempMarkerData.isMaster == true){
                  //if connect master marker
                  transferMarkerData = tempMarkerData;
                  this.projects[midx[0]].holes[midx[1]].sections[midx[2]].markers[midx[3]].depth_source = ["duo-master-transfer",transferMarkerData.id,null];
                }
              }
            }
          }
        }
      }
    }

    console.time("    interpolate")
    //apply 1st order interpolation -> extrapolation 
    let NoCDmarkers = this.applyMarkerPolation(calcRange, calcType);
    if (NoCDmarkers.length !== 0){
      this.setError("","E016: "+NoCDmarkers.length+" markers without " + calcType);
      console.log("LCCore: E016: "+NoCDmarkers.length+" markers without " + calcType);
      //console.log(NoCDmarkers);
    }
    console.timeEnd("    interpolate")

    //calc & submit project top/bottom
    if (calcType=="composite_depth"){
      for(let p=0;p<this.projects.length;p++){
        let CD_bottom = -Infinity;
        let CD_top = Infinity;
        this.projects[p].holes.forEach(h=>{
          h.sections.forEach(s=>{
            s.markers.forEach(m=>{
              if(m.composite_depth>CD_bottom){
                CD_bottom = m.composite_depth;
              }
              if(m.composite_depth<CD_top){
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
    this.setStatus("completed","Calaced DFS depth.")
  }
  convertDepthDuo2Master(calcType){
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
                  if(hConnectedMarkerData[calcType]!==null){
                    comparisonData.push([
                      hConnectedMarkerData.id,              //base project
                      hConnectedMarkerData.composite_depth, //base project
                      hConnectedMarkerData.event_free_depth,//base project
                      currentMarkerData.id,                 //duo project
                      currentMarkerData.composite_depth,    //duo project
                      currentMarkerData.event_free_depth    //duo project
                    ]);
                  }
                  
                }
              }
            }
          }
        }
      }

      comparisonData.sort((a,b)=>a[1] - b[1]);//sort by base composite depth
     
      comparisonChart.push([this.projects[p].id.toString(), comparisonData]);      
    }
    //apply base CD/EFD
    for(let p=0;p<this.projects.length; p++){
      const [comparisonId, comparisonData] = comparisonChart[p];
      if(comparisonData == null){
        continue;
      }

      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            const currentMarkerData = this.projects[p].holes[h].sections[s].markers[m];
            //search upper and lower marker [base ID, base CD, base EFD, duo ID, duo CD, duo EFD]
            let upperIdx = -1;
            let lowerIdx = -1;

            const epsilon = 1e-3;
            for(let c=0;c<comparisonData.length;c++){ 
              if(Math.abs(comparisonData[c][4] - currentMarkerData.composite_depth) < epsilon ||  comparisonData[c][4] < currentMarkerData.composite_depth){
                lowerIdx = c;
              }
              if(Math.abs(comparisonData[c][4] - currentMarkerData.composite_depth) < epsilon || comparisonData[c][4] > currentMarkerData.composite_depth){
                upperIdx = c;
                break;
              }
            }

            //chec end of project
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
              this.setError("","E017: Undefiened marker detected during connecintg duo model. " + this.getMarkerNameFromId(currentMarkerData.id));
              //console.log("LCCore: Undefiened marker detected during connecintg duo model. " + this.getMarkerNameFromId(currentMarkerData.id));
            }

            if(upperIdx == -1 && lowerIdx !== -1){
              //case upward extrapolation(project top)
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
              
              if(false){
                //master model is null
                D2 = null;  
              }else{
                D2  = D3  - (d3 - d2);
              }
              
              this.projects[p].holes[h].sections[s].markers[m][calcType]  = D2;
            }
            if(upperIdx !== -1 && lowerIdx == -1){
              //case downward extrapolation(project bottom)
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
              
              if(false){
                //master model is null
                D2 = null;
              }else{
                D2 = D1 + (d2 - d1);
              }
              
              this.projects[p].holes[h].sections[s].markers[m][calcType] = D2;
            }
            if(upperIdx !== -1 && lowerIdx !== -1){
              //case interpolation
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
               
              if(true){
                const d2d1 = d2 - d1;
                const d3d1 = d3 - d1;
                D2 = this.linearInterp(D1, D3, d2d1, d3d1);
              }else{
                //master model is null
                D2 = null;
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
            if(this.projects[p].holes[h].sections[s].markers[m].composite_depth > projectCdBottom){
              projectCdBottom = this.projects[p].holes[h].sections[s].markers[m].composite_depth;
            }
            if(this.projects[p].holes[h].sections[s].markers[m].composite_depth < projectCdTop){
              projectCdTop = this.projects[p].holes[h].sections[s].markers[m].composite_depth;
            }
          }
        }
      }

      if(projectCdBottom  == -Infinity){
        projectCdBottom  = 1000;
      }
      if(projectCdTop == Infinity){
        projectCdTop= 0;
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
    this.setStatus("running","start checkModel");
    if (this.projects.length == 0) {
      this.setError("","E018: There is no project data.")
      console.log("E018: There is no project data.");
      return;
    }

    let results = [];
    
    this.projects.forEach((project) => {
      let result = {
        id:project.id,
        name:project.name,
        type:project.model_type,
        evaluation:false,
        cd_error_counts:0,
        efd_error_counts:0,
        rank_error_counts:0,
        age_error_counts:0,
        max_rank:-1,  
      };
  
      project.holes.forEach((hole) => {
        hole.sections.forEach((section) => {
          section.markers.forEach((marker) => {
            if (marker.composite_depth == null) {
              if (project.model_type !== "duo") {
                //console.log("ERROR: CD is null. " + this.getMarkerNameFromId(marker.id));
              }

              result.cd_error_counts += 1;
            }
            if (marker.connection_rank == null) {
              if (project.model_type !== "duo") {
                //console.log("ERROR: Rank is null. " + this.getMarkerNameFromId(marker.id));
              }
              result.rank_error_counts += 1;
            } else {
              if (marker.connection_rank > result.max_rank) {
                result.max_rank = marker.connection_rank;
              }
            }
            if (marker.event_free_depth == null) {
              if (project.model_type !== "duo") {
                //console.log("ERROR: EFD is null. " + this.getMarkerNameFromId(marker.id));
              }
              result.efd_error_counts += 1;
            }
            if (marker.age == null) {
              if (project.model_type !== "duo") {
                //console.log("ERROR: EFD is null. " + this.getMarkerNameFromId(marker.id));
              }
              result.age_error_counts += 1;
            }
          });
        });
      });

      this.setStatus(
        "info",
        "LCCore: [" +
          project.model_type +
          "]" +
          project.name +
          ": Total interpolation error: CD:" +
          result.cd_error_counts +
          ", EFD:" +
          result.efd_error_counts +
          ", Rank:" +
          result.rank_error_counts +
          ", Max rank:" +
          result.max_rank +
          ", Age:" +
          result.age_error_counts
        )
        if(args[0]==true){
          console.log(
              "LCCore: [" +
              project.model_type +
              "]" +
              project.name +
              ": Total interpolation error: CD:" +
              result.cd_error_counts +
              ", EFD:" +
              result.efd_error_counts +
              ", Rank:" +
              result.rank_error_counts +
              ", Max rank:" +
              result.max_rank +
              ", Age:" +
              result.age_error_counts
          );
    
        }
      
      if (result.cd_error_counts == 0 && result.efd_error_counts == 0) {
        result.evaluation = true;
      } else {
        result.evaluation = false;
      }
      results.push(result);
    });

    this.setStatus("completed","Checked model.")
    return results;
  }
  getDepthFromTrinity(targetId, trinityList, calcType) {
    this.setStatus("running","start getDepthFromTrinity");

    let output = [];
    
    for (let t = 0; t < trinityList.length; t++) {
      //initiarize
      let upperIdxs = [];
      let lowerIdxs = [];

      const holeName    = lcfnc.zeroPadding(trinityList[t].hole_name);
      const sectionName = lcfnc.zeroPadding(trinityList[t].section_name);
      const distance    = parseFloat(trinityList[t].distance);

      for(let p=0;p<this.projects.length;p++){
        if(targetId[0] == null || targetId[0] == this.projects[p].id[0]){

          for (let h = 0; h < this.projects[p].holes.length; h++) {
            const holeData = this.projects[p].holes[h];

            if(targetId[1] == null || targetId[1] == holeData.id[1]){
              for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
                const sectionData = holeData.sections[s];

                if(targetId[2] == null || targetId[2] == sectionData.id[2]){
                  for (let m = 0; m < this.projects[p].holes[h].sections[s].markers.length - 1; m++) {

                    //check name and distance
                    if (holeData.name === holeName) {
                      if (sectionData.name === sectionName) {
                        if (distance >= sectionData.markers[m].distance) {
                          if (distance <= sectionData.markers[m + 1].distance) {
                            if (upperIdxs.length > 0) {
                              if (lowerIdxs[lowerIdxs.length - 1].toString() == [p, h, s, m].toString()) {
                                //case the target horizon located on the marker
                                //none
                              }
                            } else {
                              upperIdxs.push([p, h, s, m]);
                              lowerIdxs.push([p, h, s, m + 1]);
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }           
          }
        }
      }

      //check num of detection
      if (upperIdxs.length == 0 || lowerIdxs.length == 0) {
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
        output.push([null, null, null]);
        continue;
      } else if (upperIdxs.length > 1 || lowerIdxs.length > 1) {
        this.setError(
          "",
          "E019: Duplicate set detected. [" +
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
        output.push([null, null, null]);
      }

      //get section data
      let sectionId = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].id;

      //get nearest cd/efd data
      const D1      = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].markers[upperIdxs[0][3]][calcType];
      const D3      = this.projects[lowerIdxs[0][0]].holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]].markers[lowerIdxs[0][3]][calcType];
      const d1      = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].markers[upperIdxs[0][3]].distance;
      const d3      = this.projects[lowerIdxs[0][0]].holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]].markers[lowerIdxs[0][3]].distance;
      const D1_rank = this.projects[upperIdxs[0][0]].holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].markers[upperIdxs[0][3]].connection_rank;
      const D3_rank = this.projects[lowerIdxs[0][0]].holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]].markers[lowerIdxs[0][3]].connection_rank;
      
      if (D1 == null || D3 == null) {
        this.setError("","E020: "+ calcType + " of value is empty.");
        //console.log("ERROR: " + calcType + " of value is empty.");
        //console.log("D1:" + D1 + "/D3:" + D3 + "/d1:" + d1 + "/d3:" + d3);

        output.push([null, null, null]);
        continue;
      }

      //calc interpolated depth between markers
      const d2d1 = distance - d1;
      const d3d1 = d3 - d1;
      const interpolatedEFD = this.linearInterp(D1, D3, d2d1, d3d1);

      const new_rank = Math.max([D1_rank, D3_rank]);
      output.push([sectionId, interpolatedEFD, new_rank]);
    }
    this.setStatus("completed","");
    return output;
  }
  getEFDfromCD(targetCD) {
    this.setStatus("running","start getEFDfromCD");
    //initiarise   
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
    //initiarise
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
  initiariseCDEFD(){
    this.setStatus("running","start initiariseCDEFD");
    for(let p=0; p<this.projects.length;p++){
      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            //initiarise
            this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
            this.projects[p].holes[h].sections[s].markers[m].event_free_depth = null;
          }
        }
      }
    }
    this.setStatus("completed","initiarised");
  }
  calcMarkerAges(LCAge) {
    LCAge.updateAgeDepth(this);
    this.setStatus("running","start calcMarkerAges");
    if (this.projects.length == 0) {
      this.setError("E021: There is no correlation model.")
      console.log("","LCCore: E021: There is no correlation model.");
      return;
    }
    if (LCAge.AgeModels.length == 0) {
      this.setError("","E022: There is no age model.")
      console.log("LCCore: E022: There is no age model.");
      return;
    }

    for (let p = 0; p < this.projects.length; p++) {
      for (let h = 0; h < this.projects[p].holes.length; h++) {
        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
          for (
            let m = 0;
            m < this.projects[p].holes[h].sections[s].markers.length;
            m++
          ) {
            const marker = this.projects[p].holes[h].sections[s].markers[m];
            if (marker.event_free_depth !== null) {
              const age = LCAge.getAgeFromEFD(marker.event_free_depth, "linear"); //{age: { type: null, mid: null, upper: null, lower: null }, age_idx:null};
              this.projects[p].holes[h].sections[s].markers[m].age = age.age.mid;
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
    const model_data = projectData.model_data;
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
    const model_data = projectData.model_data;

    //holeIdx: retrurned from "getHoleListFromCsv"
    let sectionList = [];
    const topIndices = lcfnc.findCsvIdx(model_data, "top", null, holeIdx[0]);
    const bottomIndices = lcfnc.findCsvIdx(
      model_data,
      "bottom",
      null,
      holeIdx[0]
    );

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
      this.setErrorAlert("","E027: Numbers of section 'top' and 'bottom' do not match.");
      console.log("ERROR: E027: Numbers of section 'top' and 'bottom' do not match.");
      return;
    }
    this.setStatus("completed","");
    return sectionList;
  }
  getMarkerListFromCsv(projectData, sectionIdx) {
    this.setStatus("running","start getMarkerListFromCsv")
    //get model data
    const model_data = projectData.model_data;

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
  connectEventPairs(projectIdx) {
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
          for (let e = 0; e < num_e; e++) {
            let event = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].event[e];
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
                  event_border_distance_for_check = Math.round(event_border_distance * 10) / 10;
                } else if (event[0]=="deposition" || event[0]=="markup"){
                  event_border_drilling_depth = this.projects[projectIdx[0]].holes[h].sections[s].markers[m].drilling_depth + event[2];
                  event_border_distance = event_start_distance + event[2];
                  event_border_distance_for_check = Math.round(event_border_distance * 10) / 10;
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
                    const current_distance = Math.round(currentMarkerData.distance * 10) / 10;
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
                    const current_distance = Math.round(currentMarkerData.distance * 10) / 10;

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
                      name = "errosion_bottom";
                    }    
                    //console.log(this.getMarkerNameFromId(upper_marker_id) +"=="+this.getMarkerNameFromId(lower_marker_id));      
                  }

                  const upper_marker_idx = this.search_idx_list[upper_marker_id];
                  const lower_marker_idx = this.search_idx_list[lower_marker_id];

                  //make new marker
                  //no marker at the event border
                  const newMarkerData = new Marker();
                  const newid = lcfnc.getUniqueId(this.projects[projectIdx[0]].holes[startIdx[1]].sections[startIdx[2]].reserved_marker_ids);
                  newMarkerData.id = [
                    targetSectionData.id[0],
                    targetSectionData.id[1],
                    targetSectionData.id[2],
                    newid,
                  ];

                  //update reserved ids
                  this.projects[projectIdx[0]].holes[startIdx[1]].sections[startIdx[2]].reserved_marker_ids.push(newid);
                  newMarkerData.distance = newDistance;
                  newMarkerData.name = name;
                  newMarkerData.drilling_depth = event_border_drilling_depth;
                  newMarkerData.reliability += 1;
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
                  const connectedEvrentIdx = this.search_idx_list[newMarkerData.event[0][2]];
                  if (newMarkerData.event[0][1] == "upward") {
                    if (through_dir[0] == 0) {
                      //if first
                      //connect from
                      this.projects[projectIdx[0]].holes[connectedEvrentIdx[1]].sections[connectedEvrentIdx[2]].markers[connectedEvrentIdx[3]].event[e] = [
                        event[0],
                        event[1],
                        newMarkerData.id,
                        event[3],
                        event[4],
                      ];
                    } else {
                      //connect from
                      this.projects[projectIdx[0]].holes[connectedEvrentIdx[1]].sections[connectedEvrentIdx[2]].markers[connectedEvrentIdx[3]].event.push([
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
                      this.projects[projectIdx[0]].holes[connectedEvrentIdx[1]].sections[connectedEvrentIdx[2]].markers[connectedEvrentIdx[3]].event[e] = [
                        event[0],
                        event[1],
                        newMarkerData.id,
                        event[3],
                        event[4],
                      ];
                    } else {
                      //connect from
                      this.projects[projectIdx[0]].holes[connectedEvrentIdx[1]].sections[connectedEvrentIdx[2]].markers[connectedEvrentIdx[3]].event.push([
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
            } else {
              this.setErrorAlert("","E030: Undefiend type event detected at"+this.getMarkerNameFromId(this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id))
              console.log("E030: Undefiend type event detected at"+this.getMarkerNameFromId(this.projects[projectIdx[0]].holes[h].sections[s].markers[m].id));
            }
          }
        }
      }
    }
    this.setStatus("completed","");
  }
  getMarkerNameFromId(id) {
    this.setStatus("running","start getMarkerNameFromId");
    if (id == null){
      this.setError("","E053: Input id is empty.")
      return null;
    }
    const idx = this.search_idx_list[id.toString()];
    const holeName = this.projects[idx[0]].holes[idx[1]].name;
    const secName = this.projects[idx[0]].holes[idx[1]].sections[idx[2]].name;
    const markerName =
      this.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].name;
    const output = "[" + holeName + "-" + secName + "-" + markerName + "]";
    this.setStatus("completed","")
    return output;
  }
  getDataByIdx(idxs) {
    this.setStatus("running","start getDataByIdx")
    let output;

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
        this.projects[p].holes[h].sections.sort((a, b) =>
          a.order < b.order ? -1 : 1
        );
        for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
          this.projects[p].holes[h].sections[s].markers.sort((a, b) =>
            a.distance < b.distance ? -1 : 1
          );
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
          this.projects[p].holes[h].sections[s].markers.sort((a, b) => 
            a.distance < b.distance ? -1 : 1
          );
        }
      }
    }

    //sort section by drilling depth of top marker
    for (let p = 0; p < this.projects.length; p++) {
      for (let h = 0; h < this.projects[p].holes.length; h++) {      
        this.projects[p].holes[h].sections.sort((a, b) =>{
          a.markers[0].drilling_depth < b.markers[0].drilling_depth ? -1 : 1
        });
      }
    }

    //sort hole by name
    for (let p = 0; p < this.projects.length; p++) {
      for (let h = 0; h < this.projects[p].holes.length; h++) {
        this.projects[p].holes.sort((a, b) => {
          a.name.localeCompare(b.name);
        });
      }
    }

    //sort project by name
    this.projects.sort((a, b) => {
      a.name.localeCompare(b.name);
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
    this.search_idx_list = [];
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
    
    //initiarize
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
  dfs(startNodeId, startVal, calcRange, calcType) {
    this.setStatus("running","start dfs");
    //calc composite depth
    let visited = new Set();
    let stack = [];
    if (startNodeId == null) {
      this.setError("","E032: There is no Zero point.")
      console.log("LCCore: E032: There is no Zero point.");
      return null;
    }
    
    stack.push([startNodeId.toString(), startVal]); // stack distance
    let compositeDepth = {}; // composite/eventFree depth at each node

    let c=0;
    while (stack.length > 0) {
      c+=1;
      //console.log(stack.length);
      const data = stack.pop();
      let markerId = data[0];
      let stackDistance = data[1];

      

      if (!visited.has(markerId)) {
        visited.add(markerId); //add finish flag
        compositeDepth[markerId] = stackDistance;

        // Add neighbor  node to stack
        let neighborMarkers = this.dfs_getNeighborSet(
          markerId,
          calcRange,
          calcType
        );

        //console.log(neighborMarker.length);
        for (let neighbor of neighborMarkers) {
          if (!visited.has(neighbor[0])) {
            stack.push([neighbor[0], stackDistance + neighbor[1]]);
          }
        }
      }
    }

    //show path of master section
    /*
    visited.forEach((v) => {
      console.log(this.getMarkerNameFromId(v));
    });
    */
    this.setStatus("completed","");
   return compositeDepth;
  }

  dfs_getNeighborSet(currentMarkerId, calcRange, calcType) {
    this.setStatus("running","strat dfs_getNeighborSet");
    let output = [];
    //get marker data
    const currentMarkerIdx = this.search_idx_list[currentMarkerId];
    const currentMarkerData = this.projects[currentMarkerIdx[0]].holes[currentMarkerIdx[1]].sections[currentMarkerIdx[2]].markers[currentMarkerIdx[3]];

    //get connections
    const hNeighborMarkerIds = currentMarkerData.h_connection;
    const vNeighborMarkerIds = currentMarkerData.v_connection;

    //get horizontal connection
    for (let h = 0; h < hNeighborMarkerIds.length; h++) {
      //get marker data
      //console.log(currentMarkerId+"=>"+hNeighborMarkerIds[h])
      const neighborMarkerIdx = this.search_idx_list[hNeighborMarkerIds[h].toString()];
      const neighborMarkerData = this.projects[neighborMarkerIdx[0]].holes[neighborMarkerIdx[1]].sections[neighborMarkerIdx[2]].markers[neighborMarkerIdx[3]];
     
      //get master connection
      if (calcRange == "project"){
        if (currentMarkerData.isMaster == true) {
          if (currentMarkerData.id[0] == neighborMarkerData.id[0]) {
            //case of different hole
            output.push([neighborMarkerData.id.toString(), 0, neighborMarkerData.connection_rank]);
          }
        }
      }

      if(calcRange =="all"){
        //case "all". The base project must be load first at this setting.
        if (currentMarkerData.isMaster == true) {
          if(currentMarkerData.id[0] == 1){
            output.push([neighborMarkerData.id.toString(), 0, neighborMarkerData.connection_rank]);
          }
        }
      }
    }

    //get vertivcal connection
    for (let v = 0; v < vNeighborMarkerIds.length; v++) {
      //vertical correlation
      const neighborMarkerIdx = this.search_idx_list[vNeighborMarkerIds[v]];
      const neighborMarkerData = this.projects[neighborMarkerIdx[0]].holes[neighborMarkerIdx[1]].sections[neighborMarkerIdx[2]].markers[neighborMarkerIdx[3]];

      if ( neighborMarkerData.isMaster == true && currentMarkerData.isMaster == true) {
        let targetProject = null;
        if(calcRange == "all"){
          targetProject = 1;
        }else{
          targetProject = neighborMarkerData.id[0];
        }

        if(currentMarkerData.id[0]==targetProject){
          //&& isMasterHmarkerExist == false
          //if h_connec and v_connec exist, give priority to h_connec.
          //case same project
          if (currentMarkerData.id[1] == neighborMarkerData.id[1]) {
            //case same hole
            if (currentMarkerData.id[2] == neighborMarkerData.id[2]) {
              //case of the same core
              let distanceMarkers = this.calcMarkerDistance(neighborMarkerData, currentMarkerData, calcType); 
  
              output.push([neighborMarkerData.id.toString(), distanceMarkers, neighborMarkerData.connection_rank]);
            } else {
              //case of different cores (piston core type)
              output.push([neighborMarkerData.id.toString(), 0, neighborMarkerData.connection_rank]);
            }
          }
        }
      }
    }
    this.setStatus("completed","");
    return output;
  }
  applyMarkerPolation(calcRange, calcType) {
    this.setStatus("running","strat applyMarkerPolation");
    //get list of inter/extra polation in each project
    let skippedList = [];
 
    for (let p = 0; p < this.projects.length; p++) {
      
      //apply interpolation    
      let polationList = this.getPolationList(p, calcType);
      let interpolationList = polationList.filter(item => item[0] == "interpolation");
      let extrapolationList = polationList.filter(item => item[0] == "extrapolation");
      skippedList = polationList.filter(item => item[0] == "floating");
      this.polation(interpolationList, calcRange, calcType);
      
      
      //apply extrapolation  
      polationList = this.getPolationList(p, calcType);
      interpolationList = polationList.filter(item => item[0] == "interpolation");
      extrapolationList = polationList.filter(item => item[0] == "extrapolation");
      skippedList = polationList.filter(item => item[0] == "floating");
      this.polation(extrapolationList, calcRange, calcType);

      //apply 2nd interpolation    
      polationList = this.getPolationList(p, calcType);
      
      interpolationList = polationList.filter(item => item[0] == "interpolation");
      extrapolationList = polationList.filter(item => item[0] == "extrapolation");
      skippedList = polationList.filter(item => item[0] == "floating");
      this.polation(interpolationList, calcRange, calcType);

      //calc result
      polationList = this.getPolationList(p, calcType);
      interpolationList = polationList.filter(item => item[0] == "interpolation");
      extrapolationList = polationList.filter(item => item[0] == "extrapolation");
      skippedList = polationList.filter(item => item[0] == "floating");

      if(interpolationList.length!==0){
        this.setErrorAlert("","E033: The 3rd order interpolation exist. The 3rd order interpolation is not suportted."+interpolationList)
        console.log("LCCore: E033: The 3rd order interpolation exist. The 3rd order interpolation is not suportted.", interpolationList);
      }
    }    
    this.setStatus("completed","");
    return skippedList;
  }

  getPolationList(p, calcType){
    this.setStatus("running","start getPolationList");
    let polationList = [];
    
    for (let h = 0; h < this.projects[p].holes.length; h++) {
      for (let s = 0; s < this.projects[p].holes[h].sections.length; s++) {
        for (let m = 0; m < this.projects[p].holes[h].sections[s].markers.length; m++) {
          if (this.projects[p].holes[h].sections[s].markers[m][calcType]==null){
            //if target depth(CD/EFD) is null
            let targetId = this.projects[p].holes[h].sections[s].markers[m].id;

            //find nearest CD/EFD
            let nearestMarkers = this.searchNearestMarkers(this.projects[p].holes[h].sections[s].markers[m], calcType);

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
  polation(polationList, calcRange, calcType){
    this.setStatus("running","start polation");
    if(polationList.length==0){
      this.setError("","E054: Input polation list is empty.");
      return null;
    }

    let skippedList = [];
    //apply polation
    for (let i=0; i < polationList.length; i++){
      if (polationList[i][0] == "interpolation"){
        const addRank = 1;

        //case of interpolation
        let uIdx = this.search_idx_list[polationList[i][1].toString()];
        let tIdx = this.search_idx_list[polationList[i][2].toString()];
        let lIdx = this.search_idx_list[polationList[i][3].toString()];
        let upperMarkerData   = this.projects[uIdx[0]].holes[uIdx[1]].sections[uIdx[2]].markers[uIdx[3]];
        let targetMarkerData  = this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]];
        let lowerMarkerData   = this.projects[lIdx[0]].holes[lIdx[1]].sections[lIdx[2]].markers[lIdx[3]];

        //check connection rank
        let maxRank = Math.max(upperMarkerData.connection_rank, lowerMarkerData.connection_rank);
        if(targetMarkerData.connection_rank !== null){
          if(targetMarkerData.connection_rank <= maxRank + addRank && targetMarkerData.depth_source[0] == "extrapolation" || 
             targetMarkerData.connection_rank <= maxRank + addRank + addRank && targetMarkerData.depth_source[0] == "transfer" ||
             targetMarkerData.connection_rank <= maxRank + addRank + addRank && targetMarkerData.depth_source[0] == "master-transfer"
          ){
            continue;
          } 
        }

        //interpoilate
        const D1 = parseFloat(upperMarkerData[calcType]);
        const D3 = parseFloat(lowerMarkerData[calcType]);
        const d2d1 = -1 * parseFloat(this.calcMarkerDistance(upperMarkerData, targetMarkerData, calcType));
        const d3d1 = parseFloat(this.calcMarkerDistance(lowerMarkerData, targetMarkerData, calcType)) - parseFloat(this.calcMarkerDistance(upperMarkerData, targetMarkerData, calcType));
        const depth = this.linearInterp(D1, D3, d2d1, d3d1);
      
        //set values
        this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]][calcType] = depth;       
        this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]].connection_rank = maxRank + addRank;
        this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]].depth_source = ["interpolate",polationList[i][1], polationList[i][3]];

        //set values into hConnected markers
        for(let h=0; h<targetMarkerData.h_connection.length; h++){
          const hConnectedId = targetMarkerData.h_connection[h];
          const hConnectedIdx = this.search_idx_list[hConnectedId.toString()];
          const hConnectedRank = this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]].connection_rank;
          const hConnectedIsMaster = this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]].isMaster;
          if(
            hConnectedRank == null || 
            (hConnectedIsMaster == false && hConnectedRank >= maxRank + addRank)
          ){
            if(calcRange=="all"){
              this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]][calcType] = depth;
              this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]].connection_rank = maxRank + addRank + 1;
              this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]].depth_source = ["transfer", targetMarkerData.id,null];
            } else {
              if(targetMarkerData.id[0]==hConnectedId[0]){
                this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]][calcType] = depth;
                this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]].connection_rank = maxRank + addRank + 1;
                this.projects[hConnectedIdx[0]].holes[hConnectedIdx[1]].sections[hConnectedIdx[2]].markers[hConnectedIdx[3]].depth_source = ["transfer", targetMarkerData.id,null];
              }
            }
            
          }

        }

      } else if (polationList[i][0] == "extrapolation"){
        //
        const addRank = 2;

        //case of extrapolation
        if (polationList[i][1] == null){
          //case upward extrapolation
          let tIdx = this.search_idx_list[polationList[i][2].toString()];
          let lIdx = this.search_idx_list[polationList[i][3].toString()];
          let targetMarkerData = this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]];
          let lowerMarkerData  = this.projects[lIdx[0]].holes[lIdx[1]].sections[lIdx[2]].markers[lIdx[3]];
          let exDistance = this.calcMarkerDistance(targetMarkerData, lowerMarkerData, calcType);

          //check connection rank
          if(targetMarkerData.connection_rank !== null || targetMarkerData.connection_rank <= lowerMarkerData + addRank){
            continue;
          }

          //set values
          this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]][calcType] = lowerMarkerData[calcType] + exDistance;
          this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]].connection_rank = lowerMarkerData.connection_rank + addRank;
          this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]].depth_source = ["extrapolate",null, polationList[i][3]];
        } else if (polationList[i][3] == null){
          // case downward extrapolation
          let uIdx = this.search_idx_list[polationList[i][1].toString()];
          let tIdx = this.search_idx_list[polationList[i][2].toString()];
          let upperMarkerData  = this.projects[uIdx[0]].holes[uIdx[1]].sections[uIdx[2]].markers[uIdx[3]];
          let targetMarkerData = this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]];
          let exDistance = this.calcMarkerDistance(targetMarkerData, upperMarkerData, calcType);

          //check connection rank
          if(targetMarkerData.connection_rank !== null || targetMarkerData.connection_rank <= upperMarkerData + addRank){
            continue;
          }

          //set values
          this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]][calcType] = upperMarkerData[calcType] + exDistance;
          this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]].connection_rank = upperMarkerData.connection_rank + addRank;
          this.projects[tIdx[0]].holes[tIdx[1]].sections[tIdx[2]].markers[tIdx[3]].depth_source = ["extrapolate",polationList[i][1], null];
        }
      } else if (polationList[i][0] == "floating"){
        //case of NO correlation points
        skippedList.push(polationList[i]);
      }
    }
    this.setStatus("completed","");
    return skippedList;
  }
  searchNearestMarkers(startMarkerData, calcType) {
    this.setStatus("running","start searchNearestMarkers");
    //calcType:"composite_depth", "event_free_depth"
    //search vertically connected markers
    let connectedIds = this.searchVconnection(startMarkerData.id);
    let distances = [];
    let distanceIds = [];
    for (let i=0; i<connectedIds.length; i++){
      let connectedId = connectedIds[i];
      let connectedMarkerData = this.getDataByIdx(this.search_idx_list[connectedId.toString()]);
      if (connectedMarkerData[calcType] !== null){
        //check target is null?, calc distance by CD because of simplify
        distances.push(this.calcMarkerDistance(connectedMarkerData, startMarkerData, "composite_depth"));
        distanceIds.push(connectedMarkerData.id);
      }

    }
    

    //find nearest markers
    let upperIdx = -1;
    let lowerIdx = -1;
    let lowerDistance = Infinity;
    let upperDistance = Infinity;
    let ownIdx = -1;
    let zeroIdx = -1;
    for (let i=0; i<distances.length; i++){
      //lower case
      if(distances[i] > 0){
        if(Math.abs(distances[i]) < Math.abs(lowerDistance)){
          lowerDistance = distances[i];
          lowerIdx = i;
        }        
      }
      //upper case
      if(distances[i] < 0 ){
        if(Math.abs(distances[i]) < Math.abs(upperDistance)){
          upperDistance = distances[i];
          upperIdx = i;
        }        
      }
      //case interpolated marker distance is as same as upper/lower marker
      if(distances[i] == 0 ){
        if (distanceIds[i].toString() == startMarkerData.id.toString()){
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
      upperId = distanceIds[upperIdx];
    }
    if (lowerIdx !== -1){
      lowerId = distanceIds[lowerIdx];
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
    let pathIds = this.searchShortestVerticalPath(currentMarkerData.id, neighborMarkerData.id);
    
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
                this.setErrorAlert("","E035: Event connection is not correct at "+this.getMarkerNameFromId(currentMarkerData.id));
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
  
      if (!isNaN(D1) && D1 !== null) {
        output = D1;
      }
    } else if(method == "linear"){
      D1 = D3 - d3d1;
    }
    this.setStatus("completed","");
    return output;
  }
  connectMarkers(fromId, toId, direction) {
    this.setStatus("running","start connectMarkers");
    if(fromId.toString()==toId.toString()){
      return;
    }
    //this.updateSearchIdx();
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

      //connect
      if (connectionIdxFrom == null && connectionIdxTo == null) {
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
        let newhconnected = hconnected.filter(item => item.toString() !== c.toString());
        this.projects[ci[0]].holes[ci[1]].sections[ci[2]].markers[ci[3]].h_connection = newhconnected;
      });
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
        this.projects[fromIdx[0]].holes[fromIdx[1]].sections[
          fromIdx[2]
        ].markers[fromIdx[3]].v_connection.splice(connectionIdxFrom, 1);
        this.projects[toIdx[0]].holes[fromIdx[1]].sections[toIdx[2]].markers[
          toIdx[3]
        ].v_connection.splice(connectionIdxTo, 1);
        /*
        console.log(
          "Disconnected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
      } else {
        this.setError("","E041: Fail to disconnect markers because there is no connection between " + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId))
        console.log("E041: Fail to disconnect markers because there is no connection between " + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId));
      }
    } else if (direction == "horizontal") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      
      this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });
      //check in connection of to
      this.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //disconnect
      if (connectionIdxFrom !== null && connectionIdxTo !== null) {
        this.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]].h_connection.splice(connectionIdxFrom, 1);
        this.projects[toIdx[0]].holes[fromIdx[1]].sections[toIdx[2]].markers[toIdx[3]].h_connection.splice(connectionIdxTo, 1);
        /*
        console.log(
          "Disconnected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
      } else {
        this.setError("","E042: Fail to disconnect markers because there is no connection between ." + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId))
        console.log("E042: Fail to disconnect markers because there is no connection between ." + this.getMarkerNameFromId(fromId) + " and " + this.getMarkerNameFromId(toId));
      }
    }
    this.setStatus("completed","");
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

    //remove event layers
    if(targetMarkerData.event !== 0){
      for(let e of targetMarkerData.event){
        //["deposition", "upward", connected_marker_id, [label], (value))]
        if(e[1] == "through-up"){
          if(targetMarkerData.v_connection.length==2){
            const upperMarkerId = targetMarkerData.v_connection[0];
            const lowerMarkerId = targetMarkerData.v_connection[1];
            const upperMarkerIdx = this.search_idx_list[upperMarkerId.toString()];
            const lowerMarkerIdx = this.search_idx_list[lowerMarkerId.toString()];
            const connectedMarkerIdx = this.search_idx_list[e[2].toString()];
            const upperMarkerData = JSON.parse(JSON.stringify(this.getDataByIdx(upperMarkerIdx)));
            const lowerMarkerData = JSON.parse(JSON.stringify(this.getDataByIdx(lowerMarkerIdx)));
            const connectedMarkerData = JSON.parse(JSON.stringify(this.getDataByIdx(connectedMarkerIdx)));

            this.projects[upperMarkerIdx[0]].holes[upperMarkerIdx[1]].sections[upperMarkerIdx[2]].markers[upperMarkerIdx[3]].event 
                = connectedMarkerData.event.filter(e2=> e2[2].toString() !== targetId.toString());
            let newEvent = lowerMarkerData.event.filter(e2=>e2[2].toString() !== targetId.toString());
            newEvent = newEvent[0];
            this.projects[upperMarkerIdx[0]].holes[upperMarkerIdx[1]].sections[upperMarkerIdx[2]].markers[upperMarkerIdx[3]].event.push(newEvent);
          }
        } else if(e[1] == "upward"){
          const connectedMarkerIdx = this.search_idx_list[e[2].toString()];
          const connectedMarkerData = JSON.parse(JSON.stringify(this.getDataByIdx(connectedMarkerIdx)));
          //if downward, remove
          this.projects[connectedMarkerIdx[0]].holes[connectedMarkerIdx[1]].sections[connectedMarkerIdx[2]].markers[connectedMarkerIdx[3]].event 
              = connectedMarkerData.event.filter(e2=>!(e2[0] == e[0] && e2[1] == "downward" || e2[1] == "through-down" || e2[1] == "through-up"));

          //if through, replace
          let newEvent = connectedMarkerData.event.filter(e2=>(e2[0] == e[0] && e2[1] == "through-up"));
          if(newEvent.length !== 0){
            newEvent[0][1] = e[1];
            newEvent = newEvent[0];
          }          
          this.projects[connectedMarkerIdx[0]].holes[connectedMarkerIdx[1]].sections[connectedMarkerIdx[2]].markers[connectedMarkerIdx[3]].event.push(newEvent);        
        } else if(e[1] == "downward"){
          const connectedMarkerIdx = this.search_idx_list[e[2].toString()];
          const connectedMarkerData = JSON.parse(JSON.stringify(this.getDataByIdx(connectedMarkerIdx)));
          //if upward, remove
          this.projects[connectedMarkerIdx[0]].holes[connectedMarkerIdx[1]].sections[connectedMarkerIdx[2]].markers[connectedMarkerIdx[3]].event 
              = connectedMarkerData.event.filter(e2=>!(e[0] == e2[0] && e2[1] == "upward" || e2[1] == "through-down" || e2[1] == "through-up"));
          //if through, replace
          let newEvent = connectedMarkerData.event.filter(e2=>(e[0] == e2[0] && e2[1] == "through-down"));          
          if(newEvent.length !== 0){
            newEvent[0][1] = e[1];
            newEvent = newEvent[0];
          }   
          this.projects[connectedMarkerIdx[0]].holes[connectedMarkerIdx[1]].sections[connectedMarkerIdx[2]].markers[connectedMarkerIdx[3]].event.push(newEvent);
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
    
    this.projects[targetMarkerIdx[0]].holes[targetMarkerIdx[1]].sections[targetMarkerIdx[2]].reserved_marker_ids = targetSectionData.reserved_marker_ids.filter(num => num !== targetId[3]);
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

    let newId = Math.max(...sectionData.reserved_marker_ids) + 1;
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
    //event
    for(let ue of upperMarkerData.event){
      if(ue[2].toString() == lowerMarkerData.id.toString()){
        if(ue[1] == "downward" || ue[1] == "through-down"){
          newMarkerData.event.push([ue[0], "through-up", upperId, ue[3], ue[4]]);
          newMarkerData.event.push([ue[0], "through-down", lowerId, ue[3], ue[4]]);
        }
      }
    }

    this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].markers.push(newMarkerData);

    this.disconnectMarkers(upperId, lowerId, "vertical");
    this.connectMarkers(upperId, newMarkerId, "vertical");
    this.connectMarkers(newMarkerId, lowerId, "vertical");
    this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections[sectionIdx[2]].reserved_marker_ids.push(newId);
    this.sortModel();

    this.setStatus("completed","");
    return true
  }
  setZeroPoint(markerId, value){
    this.setStatus("running","start setZeroPoint");
    //remove previous zero point in the same prohject
    this.updateSearchIdx();
    const idx = this.search_idx_list[markerId.toString()];
    //initiarise zerpoint
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

    this.calcCompositeDepth();
    this.calcEventFreeDepth();
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

    this.calcCompositeDepth();
    this.calcEventFreeDepth();

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
      const lowerId = [upperId[0],upperId[1],upperId[2],Math.max(...this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].reserved_marker_ids)];
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
    this.calcCompositeDepth();
    this.calcEventFreeDepth();

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
    for(let idx of deleteIdx){
      this.projects[upperIdx[0]].holes[upperIdx[1]].sections[upperIdx[2]].markers[upperIdx[3]].event.splice(idx, 1);
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
    for(let idx of deleteIdx){
      this.projects[lowerIdx[0]].holes[lowerIdx[1]].sections[lowerIdx[2]].markers[lowerIdx[3]].event.splice(idx, 1);
    }

    //case erosion remove lower marker
    if(targetTypes == "erosion"){
      this.deleteMarker(lowerId);
    }

    this.updateSearchIdx();
    this.calcCompositeDepth();
    this.calcEventFreeDepth();
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
            //initiarise
            this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
            this.projects[p].holes[h].sections[s].markers[m].event_free_depth = null;
          }
        }
      }
    }
    
    //delete section
    this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections 
      = this.projects[sectionIdx[0]].holes[sectionIdx[1]].sections.filter(sec=>sec.id[2].toString()!==sectionId[2].toString());
    this.projects[sectionIdx[0]].holes[sectionIdx[1]].reserved_section_ids
      = this.projects[sectionIdx[0]].holes[sectionIdx[1]].reserved_section_ids.filter(sid=>sid!==sectionId[2]);
    
    
    this.calcCompositeDepth();
    this.calcEventFreeDepth();
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

    const newSectionId = [holeId[0], holeId[1], Math.max(...this.projects[holeIdx[0]].holes[holeIdx[1]].reserved_section_ids)+1,null];
    newSectionData.name = lcfnc.zeroPadding(inData.name);
    newSectionData.id = newSectionId;

    topMarkerData.name = holeData.name+"-"+inData.name+"-top";
    topMarkerData.distance = inData.distance_top;
    topMarkerData.drilling_depth = inData.dd_top;
    topMarkerData.id = [newSectionId[0],newSectionId[1],newSectionId[2],1];
    bottomMarkerData.name = holeData.name+"-"+inData.name+"-bottom";
    bottomMarkerData.distance =inData.distance_bottom;
    bottomMarkerData.drilling_depth =inData.dd_bottom;
    bottomMarkerData.id = [newSectionId[0],newSectionId[1],newSectionId[2],2];

    newSectionData.markers.push(topMarkerData);
    newSectionData.markers.push(bottomMarkerData);
    newSectionData.reserved_marker_ids.push(1);
    newSectionData.reserved_marker_ids.push(2);

    this.projects[holeIdx[0]].holes[holeIdx[1]].sections.push(newSectionData);
    this.projects[holeIdx[0]].holes[holeIdx[1]].reserved_section_ids.push(newSectionId[2]);

    this.sortModel();

    this.setStatus("completed","");
    return true
  }
  deleteHole(holeId){
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
            //initiarise
            this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
            this.projects[p].holes[h].sections[s].markers[m].event_free_depth = null;
          }
        }
      }
    }
    
    //delete hole
    this.projects[holeIdx[0]].holes = this.projects[holeIdx[0]].holes.filter(hole=>hole.id[1].toString()!==holeId[1].toString());      
    this.projects[holeIdx[0]].reserved_hole_ids = this.projects[holeIdx[0]].reserved_hole_ids.filter(hid=>hid!==holeId[1]);
    
    this.calcCompositeDepth();
    this.calcEventFreeDepth();
    this.updateSearchIdx();

    this.setStatus("completed","");
    return true;
    
  }
  addHole(projectId, name){
    this.setStatus("running","start addHole");
    this.updateSearchIdx()
    const projectIdx = this.search_idx_list[projectId.toString()];
    let newHole = new Hole();
    const newHoleId = [projectId[0], Math.max(...this.projects[projectIdx[0]].reserved_hole_ids) + 1, null, null];
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
    this.projects[projectIdx[0]].reserved_hole_ids.push(newHole.id[1]);
    this.sortModel();

    this.setStatus("completed","");
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
    newProject.id = [Math.max(...this.reserved_project_ids)+1, null, null, null];
    newProject.order = this.projects.length+1;
    newProject.model_type = type;
    if(type == "correlation"){
      if(this.base_project_id==null){
        this.base_project_id = newProject.id;
      }
    }

    this.projects.push(newProject);
    this.reserved_project_ids.push(newProject.id[0]);

    this.setStatus("completed","");
    return true;

  }
  deleteProject(projectId){
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
            //initiarise
            this.projects[p].holes[h].sections[s].markers[m].composite_depth = null;
            this.projects[p].holes[h].sections[s].markers[m].event_free_depth = null;
          }
        }
      }
    }
    
    //delete project
    this.projects = this.projects.filter(project=>project.id.toString()!==projectId.toString());   
    this.reserved_project_ids = this.reserved_project_ids.filter(pid=>pid!==projectId[0]);

    this.updateSearchIdx();
    this.calcCompositeDepth();
    this.calcEventFreeDepth();

    this.setStatus("completed","");
    return true;
    
  }
  mergeProjects(){
    this.setStatus("completed","start mergeProject");
    let holeNames = new Set();
    for(let p=0; p<this.projects.length; p++){
      for(let h=0; h<this.projects[p].holes.length;h++){
        if(!holeNames.has(this.projects[p].holes[h].name)){
          holeNames.add(this.projects[p].holes[h].names)
        }else{
          this.setErrorAlert("","E062: Inupt name has been already used.")
          return "duplicate_holes"
        }
      }
    }

    //get changed id list
    let fromToIds = {};
    const newProjectId = this.base_project_id;
    let newHoleId = 0;//Math.max(...this.projects[0].reserved_hole_ids);
    for(let p=0; p<this.projects.length; p++){
      for(let h=0; h<this.projects[p].holes.length;h++){
        newHoleId += 1;
        let newHoleIds = JSON.parse(JSON.stringify(this.projects[p].holes[h].id));
        newHoleIds[0] = newProjectId[0];
        newHoleIds[1] = newHoleId;
        if(p==0){
          fromToIds[this.projects[p].holes[h].id.toString()] = this.projects[p].holes[h].id;
        }else{
          fromToIds[this.projects[p].holes[h].id.toString()] = newHoleIds;   
        }
        
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          let newSecIds = JSON.parse(JSON.stringify(this.projects[p].holes[h].sections[s].id));
          newSecIds[0] = newProjectId[0];
          newSecIds[1] = newHoleId;
          if(p==0){
            fromToIds[this.projects[p].holes[h].sections[s].id.toString()] = this.projects[p].holes[h].sections[s].id; 
          }else{
            fromToIds[this.projects[p].holes[h].sections[s].id.toString()] = newSecIds; 
          }
          
          for(let m=0; m<this.projects[p].holes[h].sections[s].markers.length;m++){
            let newMarkerIds = JSON.parse(JSON.stringify(this.projects[p].holes[h].sections[s].markers[m].id));
            newMarkerIds[0] = newProjectId[0];
            newMarkerIds[1] = newHoleId;
            if(p==0){
              fromToIds[this.projects[p].holes[h].sections[s].markers[m].id.toString()] = this.projects[p].holes[h].sections[s].markers[m].id; 
            }else{
              fromToIds[this.projects[p].holes[h].sections[s].markers[m].id.toString()] = newMarkerIds; 
            }
            
          }
        }
      }
    }


    //mark
    for(let p=0; p<this.projects.length; p++){
      for(let h=0; h<this.projects[p].holes.length;h++){
        let newHoleData = new Hole();
        let prevHoleData = JSON.parse(JSON.stringify(this.projects[p].holes[h]));
        prevHoleData.id = fromToIds[prevHoleData.id.toString()];
        if(p!==0){
          prevHoleData.order = this.projects[0].holes.length;
        }
        
        //change to new id
        for(let s=0; s<prevHoleData.sections.length;s++){
          prevHoleData.sections[s].id = fromToIds[prevHoleData.sections[s].id.toString()];
          for(let m=0;m<prevHoleData.sections[s].markers.length;m++){
            prevHoleData.sections[s].markers[m].id = fromToIds[prevHoleData.sections[s].markers[m].id.toString()];
            //h_connection
            for(let c=0;c<prevHoleData.sections[s].markers[m].h_connection.length;c++){
              prevHoleData.sections[s].markers[m].h_connection[c] = fromToIds[prevHoleData.sections[s].markers[m].h_connection[c].toString()];
            }
            //v_connection
            for(let c=0;c<prevHoleData.sections[s].markers[m].v_connection.length;c++){
              prevHoleData.sections[s].markers[m].v_connection[c] = fromToIds[prevHoleData.sections[s].markers[m].v_connection[c].toString()];
            }
            //event connection
            for(let c=0;c<prevHoleData.sections[s].markers[m].event.length;c++){
              if(prevHoleData.sections[s].markers[m].event[c][2] !== null){
                prevHoleData.sections[s].markers[m].event[c][2] = fromToIds[prevHoleData.sections[s].markers[m].event[c][2].toString()];
              }              
            }
            //data source connection
            for(let c=1;c<prevHoleData.sections[s].markers[m].depth_source.length;c++){
              if(prevHoleData.sections[s].markers[m].depth_source[c] !== null){
                prevHoleData.sections[s].markers[m].depth_source[c] = fromToIds[prevHoleData.sections[s].markers[m].depth_source[c].toString()];
              }              
            }
            if(p!==0){
              //remove master flag
              prevHoleData.sections[s].markers[m].isMaster = false;
              prevHoleData.sections[s].markers[m].isZeroPoint = false;
            }
            
          }
        }
  
        //set
        Object.assign(newHoleData, prevHoleData);
        if(p==0){
          this.projects[0].holes[h] = newHoleData;
        }else{
          this.projects[0].holes.push(newHoleData);
          this.projects[0].reserved_hole_ids.push(newHoleData.id[1]);
        }
      }
    }

    //delete
    for(let p=1;p<this.projects.length;p++){
      this.deleteProject(this.projects[p].id);
    }

    
    this.updateSearchIdx()
    this.calcCompositeDepth();
    this.calcEventFreeDepth();

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
      for(let data of this.projects[idx[0]].holes){
        if(value !== "" && data.name == lcfnc.zeroPadding(value)){
          isUsed = true;
          break;
        }
      }
    }else if(idx.filter(item => item !== null).length == 3){
      //section
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
      console.log("MAIN: Change marker name.");
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

        this.projects[currentIdx[0]].holes[currentIdx[1]].sections[currentIdx[2]].markers[currentIdx[3]].h_connection.forEach((h) => {
          if (!visitedId.has(h.toString())) {
            stack.push(h);
          }
        });
      }
    }

    //chage type
    let output = [];
    visitedId.forEach((v) => {
      const val = v.split(",");
      output.push([
        parseInt(val[0]) == NaN ? Null : parseInt(val[0]),
        parseInt(val[1]) == NaN ? Null : parseInt(val[1]),
        parseInt(val[2]) == NaN ? Null : parseInt(val[2]),
        parseInt(val[3]) == NaN ? Null : parseInt(val[3]),
      ]);
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
        currentIdx = this.search_idx_list[currentId];

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
      output.push([
        parseInt(val[0]) == NaN ? Null : parseInt(val[0]),
        parseInt(val[1]) == NaN ? Null : parseInt(val[1]),
        parseInt(val[2]) == NaN ? Null : parseInt(val[2]),
        parseInt(val[3]) == NaN ? Null : parseInt(val[3]),
      ]);
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
        return [ sectionData.markers[m].id, sectionData.markers[m + 1].id, rate_from_upper, rate_from_lower];
      }
    }

    this.setError("","E049: There is no marker.");
    return [null, null, null, null];
  }
  getNearestTrinity(targetId, depth, calcType) {
    this.setStatus("completed","start getNearestTrinity");
    //search in target
    //this method returns paseudo result because multiple sections matched, but returns most goood sections based on centre of sections.
    let output = {index:[null,null,null,null], project:null, hole:null, section: null, distance: null};
    let nearestSectionData = null;
    let nearestSectionList = [];
    let tempSectionData = null;
    let diffDepth = Infinity;

    //search target section, if not 
    if(targetId[0] !== null && targetId[1] !== null && targetId[2] !== null){
      //if section is selected
      const targetIdx = this.search_idx_list[targetId.toString()];
      nearestSectionData = this.getDataByIdx(targetIdx);
      output.index = targetIdx;
    } else {
      //if section is not selected
      for(let p=0; p<this.projects.length;p++){
        //if target project
        for(let h=0; h<this.projects[p].holes.length;h++){            
          //fisrt, search in the selected hole
          tempSectionData = null;
          diffDepth = Infinity;
          for(let s=0; s<this.projects[p].holes[h].sections.length; s++){             
            const sectionData = this.projects[p].holes[h].sections[s];
            const midSec = (sectionData.markers[0][calcType] + sectionData.markers[sectionData.markers.length - 1][calcType]) / 2;  
            if (diffDepth > Math.abs(midSec - depth)) {
              diffDepth = Math.abs(midSec - depth);
              tempSectionData = sectionData;
              output.index = [p, h, s, null];
            }
          }
          nearestSectionList.push([diffDepth, tempSectionData]);
        }
      }

      //get best nearestData
      for(let s=0; s<nearestSectionList.length; s++){
        tempSectionData = nearestSectionList[s][1];
        const tempUpperDepth = tempSectionData.markers[0][calcType];
        const tempLowerDepth = tempSectionData.markers[tempSectionData.markers.length - 1][calcType];
        if(tempSectionData.id[0] == targetId[0] && tempSectionData.id[1] == targetId[1] && targetId[0] !==null && targetId[1] !== null){
          //target hole
          if(depth >= tempUpperDepth && depth <= tempLowerDepth){
            // on the section
            nearestSectionData = tempSectionData;
            break;
          }
        }
      }

      //case of out side of section&hole
      if(nearestSectionData == null){
        diffDepth = Infinity;
        for(let s=0; s<nearestSectionList.length; s++){
          if(nearestSectionList[s][0] < diffDepth){
            if(!(nearestSectionList[s][1].id[0] == targetId[0] && nearestSectionList[s][1].id[1] == targetId[1])){
              nearestSectionData = nearestSectionList[s][1];
              diffDepth = nearestSectionList[s][0];
            }
          }
        }
      }
      
    }
    
    //check section data
    if (nearestSectionData == null) {
      output.index = [null,null,null,null];
      this.setError("","E065: Nearest section data is not exist.")
      return output;
    }

    //if section data is exist
    let upperMarkerData = nearestSectionData.markers[0];
    let lowerMarkerData = nearestSectionData.markers[nearestSectionData.markers.length - 1];
    for(let m=0; m<nearestSectionData.markers.length;m++){
      let marker = nearestSectionData.markers[m];
      const temp = marker[calcType] - depth;
      if (temp <= 0 && Math.abs(temp) < Math.abs(upperMarkerData[calcType] - depth)) {
        upperMarkerData = marker;
      }
      if (temp >= 0 && Math.abs(temp) < Math.abs(lowerMarkerData[calcType] - depth)) {
        lowerMarkerData = marker;
      }
    }

    //make function
    const D1 = upperMarkerData.distance;
    const D3 = lowerMarkerData.distance;
    const d1 = upperMarkerData[calcType];
    const d2 = depth;
    const d3 = lowerMarkerData[calcType];
    const d2d1 = d2 - d1;
    const d3d1 = d3 - d1;

    const interpDistance = this.linearInterp(D1, D3, d2d1, d3d1);

    const idx = this.search_idx_list[nearestSectionData.id.toString()];

    output.project = this.projects[idx[0]].name;
    output.hole    = this.projects[idx[0]].holes[idx[1]].name;
    output.section = this.projects[idx[0]].holes[idx[1]].sections[idx[2]].name;
    output.distance= interpDistance;

    this.setStatus("completed","");
    return output;
 }
  getIdxFromTrinity(projectId, [holeName, sectionName, distance]) {
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
      if (hole.name == lcfnc.zeroPadding(holeName)) {
        idx[1] = h;
        for (let s = 0; s < hole.sections.length; s++) {
          const section = hole.sections[s];
          if (
            lcfnc.zeroPadding(section.name) == lcfnc.zeroPadding(sectionName)
          ) {
            idx[2] = s;
            for (let m = 0; m < section.markers.length; m++) {
              const marker = section.markers[m];
              if (
                Math.round(marker.distance * 10) / 10 ==
                Math.round(parseFloat(distance) * 10) / 10
              ) {
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
  constructCSVModel(){
    this.setStatus("running","start constructCSVModel");
    //NOT RECOMMENDED, becase all descriptions are not saved.
    //check model
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
      this.setErrorAlert("","E050: Failed to make csv model.  Correlation models have some interpolation errors.");
      return
    }

    //initiarise
    this.sortModel();
    this.updateSearchIdx();

    //get row id list
    let resultIds = [];
    let visited = new Set();
    
    for(let p=0; p<this.projects.length;p++){
      const projectData = this.projects[p];
      for(let h=0;h<this.projects[p].holes.length;h++){
        for(let s=0;s<this.projects[p].holes[h].sections.length;s++){
          for(let m=0;m<this.projects[p].holes[h].sections[s].markers.length;m++){
            const markerData = this.projects[p].holes[h].sections[s].markers[m];
            if(!visited.has(markerData.id.toString())){              
              //initiarise
              let horizontalMarkers = [];
              let cd = null;

              //set cd
              //Sometimes extrapolared CD is reversal, so use tempolary very thin CD for extrapolation row. 
              if(markerData.depth_source[0] == "extrapolate"){
                //case "extrapolate"
                if(markerData.depth_source[1] !== null){
                  //downward extrapolation
                  let sourceId = markerData.depth_source[1];
                  //count layers between target and source               
                  const pathIds = this.searchShortestVerticalPath(sourceId,markerData.id);
                  let numIds = pathIds.length - 1;
                  pathIds.forEach((pid, n)=>{
                    if(visited.has(pid.toString())){
                      //search nearest calced row
                      sourceId = pid;
                      numIds = n;
                    }
                  })

                  if(numIds == pathIds.length - 1){
                    cd = this.getDataByIdx(this.search_idx_list[sourceId.toString()]).composite_depth + 0.01 * (numIds);
                  }else{
                    resultIds.forEach(r=>{
                      r[1].forEach(id=>{
                        if(id.toString() == sourceId.toString()){
                          //get previous hole temp CD
                          cd = r[0] + 0.01 * (numIds);
                        }
                      })
                    })
                  }
                }else if(markerData.depth_source[2] !== null){
                  //upward extrapolation
                  let sourceId = markerData.depth_source[2];
                  //count layers between target and source               
                  const pathIds = this.searchShortestVerticalPath(markerData.id, sourceId);
                  let numIds = pathIds.length - 1;
                  pathIds.forEach((pid, n)=>{
                    if(visited.has(pid.toString())==true){
                      //search nearest calced row
                      sourceId = pid;
                      numIds = n;
                    }
                  })

                  if(numIds == pathIds.length - 1){
                    cd = this.getDataByIdx(this.search_idx_list[sourceId.toString()]).composite_depth - 0.01 * (numIds);
                  }else{
                    resultIds.forEach(r=>{
                      r[1].forEach(id=>{
                        if(id.toString() == sourceId.toString()){
                          //get previous hole temp CD
                          cd = r[0] - 0.01 * (numIds);
                        }
                      })
                    })
                  }
                }

                
                
              }else{
                //case "master","master-transfer","duo-master","duo-master-transfer","interpolate","transfer"
                cd = markerData.composite_depth;
              }

              //set vigited id 
              visited.add(markerData.id.toString());

              //get row ids
              horizontalMarkers.push(markerData.id);

              for(let h=0;h<markerData.h_connection.length;h++){
                //set visited flag
                visited.add(markerData.h_connection[h].toString());
                //set row data
                horizontalMarkers.push(markerData.h_connection[h]);
              }

              //add row data
              resultIds.push([cd, horizontalMarkers]);
            }
          }
        }
      }   
    }    

    //sort by composite depth
    resultIds.sort((a,b)=>{
      return a[0] - b[0];
    })
    

    //make output data
    let prevMasterHole = "";
    let output = [];
    for(let i=0;i<resultIds.length;i++){
      const cd  = resultIds[i][0];
      const ids  = resultIds[i][1];
      let rowData = [];
      let zeroMarker = "";
      let masterHole = "";
      let curMasterHole = [];
      for(let p=0; p<this.projects.length;p++){
        for(let h=0; h<this.projects[p].holes.length; h++){
          const holeData = this.projects[p].holes[h];
          let cellsData = [null, null, null, null]; //[name, distance, drilling depth, event]
        
          for(let c=0;c<ids.length;c++){
            const id = ids[c];          
            if(holeData.id.toString() == [id[0],id[1],null,null].toString()){
              //if same hole, get markerdata            
              const markerData = this.getDataByIdx(this.search_idx_list[id.toString()]);
              //get marker data
              cellsData[0] = markerData.name;
              cellsData[1] = markerData.distance;
              cellsData[2] = markerData.drilling_depth;
              let eventFlag = "";
              for(let e=0;e<markerData.event.length;e++){
                if(markerData.event[e][0]=="erosion" && markerData.event[e][1]=="upward"){
                  if(eventFlag !==""){eventFlag += "/";}
                  eventFlag += markerData.event[e][0] +"-downward("+markerData.event[e][4]+")";
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
              cellsData[3] = eventFlag;//for test cd

              //get master connections              
              if(this.base_project_id.toLocaleString() == this.projects[p].id.toString() && markerData.isMaster == true){
                curMasterHole.push(this.getDataByIdx(this.search_idx_list[[markerData.id[0],markerData.id[1],null,null].toString()]).name);
              }

              if(markerData.isZeroPoint !== false){
                zeroMarker  = "(" + markerData.isZeroPoint + ")";
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

      //add top/bottom markers
      if(i==0){
        masterHole = "top/" + masterHole;
      } else if(i==resultIds.length-1){
        masterHole = masterHole + "/bottom";
      }

      //add header
      if(i==0){
        //header
        let header = ["Master hole"];
        for(let p=0; p<this.projects.length; p++){
          for(let h=0; h<this.projects[p].holes.length; h++){
            const hole = this.projects[p].holes[h];

            header = [...header, "Laminaname(" + hole.name + ")[" + hole.type + "]", "Distance from core top (cm)", "Drilling depth (cm)", "Event"];
          }
        }
        output.push(header);
      }

      //add master info
      rowData.unshift(masterHole + zeroMarker);
      output.push(rowData);
    }
    
    this.setStatus("completed","");
    return output; 
  }
 
}


module.exports = { LevelCompilerCore };
