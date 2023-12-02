const lcfnc = require("./lcfnc.js");

const { Project } = require("./Project.js");
const { Hole } = require("./Hole.js");
const { Section } = require("./Section.js");
const { Marker } = require("./Marker.js");
const { Trinity } = require("./Trinity.js");
var ss = require("simple-statistics");

class LevelCompilerCore {
  constructor() {
    this.projectData = new Project();
    this.projectData.id = [1, null, null, null];
    this.model_data = null;
    this.reserved_project_ids = [1];
    this.search_idx_list = {};
    this.selected_id = null;
  }

  //methods
  loadModelFromCsv(model_path) {
    //load model
    this.model_data = lcfnc.readcsv(model_path);
    var fileName = model_path.split(/[/\\]/).pop();
    const patern = /\[?(.*?)\]?([^\[\]()]*)(?:\((.*?)\))?\.csv$/; // ^(.*?)\((.*?)\)\.csv$/)
    var match = fileName.match(patern);
    let model_info = {};

    if (match) {
      //check model type
      if (!match[1].toLowerCase().includes("correlation")) {
        console.error("Mounted file is not correlation model.");
        this.model_data = null;
        return;
      } else if (match[1] !== "") {
        console.log("There is no identifier for correlation model.");
      }
      model_info.name = match[2];
      model_info.version = match[3];
    } else {
      model_info.name = fileName.replace(".csv", "");
      model_info.version = "";
    }
    this.projectData.name = model_info.name;
    this.projectData.correlation_version = model_info.version;

    //make brank marker id list
    const markerIdList = lcfnc.makeMarkerIdBase(
      this.model_data.length,
      this.model_data[0].length
    );

    //get hole list
    const holeList = this.getHoleListFromCsv(); //return:[holeidx, name]
    if (holeList.length == 0) {
      console.log("There is no holes.");
      return;
    }

    //add each hole
    for (let h = 0; h < holeList.length; h++) {
      //make instance
      let holeData = new Hole();

      //add info
      const newHoleId = lcfnc.getUniqueId(this.projectData.reserved_hole_ids);
      this.projectData.reserved_hole_ids.push(newHoleId);

      holeData.id = [this.projectData.id[0], newHoleId, null, null];
      holeData.name = lcfnc.zeroPadding(holeList[h][1]);
      holeData.type = holeList[h][2];
      holeData.order = h;

      //get section list
      const sectionList = this.getSectionListFromCsv(holeList[h]); //return: [holeidx, [top secidx, bottom secidx], name]

      for (let s = 0; s < sectionList.length; s++) {
        //make instance
        let sectionData = new Section();

        //add info
        const newSectionId = lcfnc.getUniqueId(holeData.reserved_section_ids);
        holeData.reserved_section_ids.push(newSectionId);
        sectionData.id = [
          this.projectData.id[0],
          newHoleId,
          newSectionId,
          null,
        ];
        sectionData.name = lcfnc.zeroPadding(sectionList[s][2]);
        sectionData.order = s;

        //get marker list
        const markerList = this.getMarkerListFromCsv(sectionList[s]); //return: [holeIdx, [top secidx, bottom secidx], [markerIdxs]]

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
            this.projectData.id[0],
            newHoleId,
            newSectionId,
            newMarkerId,
          ];
          markerData.order = m;

          const marker_r = markerList[2][m]; //id is deified at marker row
          const marker_c = markerList[0]; //id is defied at marker Name col

          markerIdList[marker_r][marker_c] = markerData.id; //add marker list

          markerData.name = lcfnc.zeroPadding(
            this.model_data[marker_r][marker_c].toString()
          );
          markerData.distance = parseFloat(
            this.model_data[marker_r][marker_c + 1]
          );
          markerData.drilling_depth = parseFloat(
            this.model_data[marker_r][marker_c + 2]
          );

          //check master section
          const masterHole = this.model_data[marker_r][0]
            .replace(/\([^)]*\)/, "") //replace (num)
            .split("/");

          for (let k = 0; k < masterHole.length; k++) {
            if (masterHole[k] == holeList[h][1]) {
              //chekc is master
              markerData.isMaster = true;

              //if master, check is zero point
              //check zero point
              if (
                this.model_data[marker_r][0].match(/\((-?\d+(\.\d+)?)\)/) !==
                null
              ) {
                markerData.isZeroPoint =
                  this.model_data[marker_r][0].match(/\((-?\d+(\.\d+)?)\)/)[1];
              }
            }
          }

          //load event data
          const events = this.model_data[marker_r][marker_c + 3].split("/");
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

            if (event[0] == "deposition" || event[0] == "d") {
              if (event[1] == "upper" || event[1] == "u") {
                //add list
                eventData.push(["deposition", "downward", null, eventCategory]);
              } else if (event[1] == "lower" || event[1] == "l") {
                //add list
                eventData.push(["deposition", "upward", null, eventCategory]);
              } else if (event[1] == "through" || event[1] == "t") {
                //add 2 events for upward and downward
                eventData.push([
                  "deposition",
                  "through-up",
                  null,
                  eventCategory,
                ]);
                eventData.push([
                  "deposition",
                  "through-down",
                  null,
                  eventCategory,
                ]);
              } else if (event[1] == "upward") {
                let thickness = parseFloat(event[2]);
                if (!isNaN(thickness)) {
                  thickness = Math.abs(thickness);
                  //
                  eventData.push([
                    "deposition",
                    "upward",
                    -thickness,
                    eventCategory,
                  ]);
                }
              } else if (event[1] == "downward") {
                let thickness = parseFloat(event[2]);
                if (!isNaN(thickness)) {
                  thickness = Math.abs(thickness);
                  eventData.push([
                    "deposition",
                    "downward",
                    thickness,
                    eventCategory,
                  ]);
                }
              } else {
                console.log(
                  "Undifined deosition event data detected at ID:" +
                    markerData.id
                );
              }
            } else if (event[0] == "erosion" || event[0] == "e") {
              let thickness = parseFloat(event[2]);
              if (!isNaN(thickness)) {
                thickness = Math.abs(thickness);
                if (event[1] == "downward" || event[1] == "d") {
                  eventData.push(["erosion", "downward", thickness, "erosion"]);
                } else if (event[1] == "upward" || event[1] == "u") {
                  eventData.push(["erosion", "upward", thickness, "erosion"]);
                } else {
                  console.log(
                    "Undifined erosion event data detected at ID:" +
                      markerData.id
                  );
                  continue;
                }
              }
            } else if (event[0] == "markup" || event[0] == "m") {
              if (event[1] == "upper" || event[1] == "u") {
                eventData.push(["markup", "downward", null, eventCategory]);
              } else if (event[1] == "lower" || event[1] == "l") {
                eventData.push(["markup", "upward", null, eventCategory]);
              } else if (event[1] == "through" || event[1] == "t") {
                eventData.push(["markup", "through-up", null, eventCategory]);
                eventData.push(["markup", "through-down", null, eventCategory]);
              } else {
                console.log(
                  "Undifined markup data detected at ID:" + markerData.id
                );
              }
            } else if (event[0] == "") {
              //no event
            } else {
              console.log("Undifined event type detected at " + markerData.id);
              //this.getMarkerNameFromId(markerData.id)

              continue;
            }
          }

          markerData.event = eventData;

          //add marker
          sectionData.markers.push(markerData);
          this.search_idx_list[markerData.id.toString()] = [0, h, s, m];
        }
        //add section
        holeData.sections.push(sectionData);
        this.search_idx_list[sectionData.id.toString()] = [0, h, s, null];
      }
      //add hole
      this.projectData.holes.push(holeData);
      this.search_idx_list[holeData.id.toString()] = [0, h, null, null];
    }

    //add unique id for each markers

    //--------------------------------------------------------
    //connect correlation
    //const holeList = this.getHoleList();
    for (let h = 0; h < holeList.length; h++) {
      const sectionList = this.getSectionListFromCsv(holeList[h]);

      let isContinuousSection = false;
      if (this.projectData.holes[h].type == "piston") {
        isContinuousSection = true;
      }

      for (let s = 0; s < sectionList.length; s++) {
        const markerList = this.getMarkerListFromCsv(sectionList[s]);
        for (let m = 0; m < markerList[2].length; m++) {
          const marker_r = markerList[2][m]; //id is deified at marker row
          const marker_c = markerList[0]; //id is defied at marker Name col

          //add horizontal correlation
          let row_data = this.model_data[marker_r];
          for (let k = 2; k < row_data.length; k += 4) {
            //check distance data col
            const val = this.model_data[marker_r][k];
            if (val != "" && !isNaN(parseFloat(val))) {
              const correlated_marker_id = markerIdList[marker_r][k - 1];

              if (
                correlated_marker_id.join("-") !==
                this.projectData.holes[h].sections[s].markers[m].id.join("-")
              ) {
                //excluding own id
                this.projectData.holes[h].sections[s].markers[
                  m
                ].h_connection.push(correlated_marker_id);
              }
            }
            //console.log( this.projectData.holes[h].sections[c].markers[m].h_connection);
          }

          //add vertical connection (with case of piston core)
          if (m == 0) {
            //let previousMarker = this.projectData.holes[h].sections[s].markers[m - 1];
            //let currentMarker = this.projectData.holes[h].sections[s].markers[m];
            let nextMarker =
              this.projectData.holes[h].sections[s].markers[m + 1];
            this.projectData.holes[h].sections[s].markers[m].v_connection.push(
              nextMarker.id
            );
            //case piston core
            if (isContinuousSection == true) {
              if (s > 0) {
                let previousMarker =
                  this.projectData.holes[h].sections[s - 1].markers.slice(
                    -1
                  )[0];
                this.projectData.holes[h].sections[s].markers[
                  m
                ].v_connection.push(previousMarker.id);
              }
            }
          } else if (m == markerList[2].length - 1) {
            let previousMarker =
              this.projectData.holes[h].sections[s].markers[m - 1];
            //let currentMarker = this.projectData.holes[h].sections[s].markers[m];
            //let nextMarker = this.projectData.holes[h].sections[s].markers[m] + 1;
            this.projectData.holes[h].sections[s].markers[m].v_connection.push(
              previousMarker.id
            );
            //case piston core
            if (isContinuousSection == true) {
              if (s < sectionList.length - 1) {
                let nextMarker =
                  this.projectData.holes[h].sections[s + 1].markers.slice(
                    -1
                  )[0];
                this.projectData.holes[h].sections[s].markers[
                  m
                ].v_connection.push(nextMarker.id);
              }
            }
          } else {
            let previousMarker =
              this.projectData.holes[h].sections[s].markers[m - 1];
            //let currentMarker = this.projectData.holes[h].sections[s].markers[m];
            let nextMarker =
              this.projectData.holes[h].sections[s].markers[m + 1];

            this.projectData.holes[h].sections[s].markers[m].v_connection.push(
              previousMarker.id
            );
            this.projectData.holes[h].sections[s].markers[m].v_connection.push(
              nextMarker.id
            );
          }
          if (s > 1 && s < sectionList.length) {
            //excluding very top and very bottom cores

            this.projectData.holes[h];
          }
        }
      }
    }

    //connect event
    const isMakeNewMarker = this.connectEventPairs();

    this.sortModel();

    console.log("LCCore: Model loaded from csv.");
  }
  calcCompositeDepth() {
    //master section        : [Master Section * ]
    //1st degree connection: [Master Section]-[Parallel Section * ]
    //2nd degree connection: [Master Section]-[Parallel Section]-[Parallel Section * ]
    //3rd degree connection: [Master Section]-[Parallel Section]-[Parallel Section]-[Parallel Section * ] and extrapolation

    //check data
    if (this.model_data == null) {
      console.log("There is no correlation model.");
      return;
    }
    //initiarise
    this.sortModel();

    //find zero point
    const [id_zero_point, startVal] = this.findZeroPointId();
    //calc composite depth by limited DFS method (clac for 0 degree to 1st degree)
    let composite_depth = this.dfs(id_zero_point, startVal, "composite_depth");
    //console.log(composite_depth);

    for (let key in composite_depth) {
      const midx = this.search_idx_list[key];

      this.projectData.holes[midx[1]].sections[midx[2]].markers[
        midx[3]
      ].composite_depth = parseFloat(composite_depth[key]);
      if (
        this.projectData.holes[midx[1]].sections[midx[2]].markers[midx[3]]
          .isMaster == true
      ) {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[3]
        ].connection_rank = 0;
      } else {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[3]
        ].connection_rank = 1;
      }
    }

    //calc composite depth of 2nd degree connection node/extrapolation
    this.applyMarkerInterpolation(1, "composite_depth", true);

    //calc composite depth of 3nd degree connection node
    this.applyMarkerInterpolation(2, "composite_depth", false);

    console.log("LCCore: Calced composite depth.");
  }
  calcEventFreeDepth() {
    //master section        : [Master Section * ]
    //1st degree connection: [Master Section]-[Parallel Section * ]
    //2nd degree connection: [Master Section]-[Parallel Section]-[Parallel Section * ]
    //3rd degree connection: [Master Section]-[Parallel Section]-[Parallel Section]-[Parallel Section * ] and extrapolation

    //check data
    if (this.model_data == null) {
      console.log("There is no correlation model.");
      return;
    }
    //initiarise
    this.sortModel();

    //find zero point
    const [id_zero_point, startVal] = this.findZeroPointId();

    //calc composite depth by limited DFS method (clac for 0 degree to 1st degree)
    let event_free_depth = this.dfs(
      id_zero_point,
      startVal,
      "event_free_depth"
    );

    for (let key in event_free_depth) {
      const midx = this.search_idx_list[key.toString()];

      this.projectData.holes[midx[1]].sections[midx[2]].markers[
        midx[3]
      ].event_free_depth = parseFloat(event_free_depth[key]);
      if (
        this.projectData.holes[midx[1]].sections[midx[2]].markers[midx[3]]
          .isMaster == true
      ) {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[3]
        ].connection_rank = 0;
      } else {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[3]
        ].connection_rank = 1;
      }
    }
    //calc composite depth of 2nd degree connection node/extrapolation
    this.applyMarkerInterpolation(1, "event_free_depth", true);

    //calc composite depth of 3nd degree connection node
    this.applyMarkerInterpolation(2, "event_free_depth", false);

    console.log("LCCore: Calced event free depth.");
  }
  checkModel() {
    if (this.projectData.holes.length == 0) {
      console.log("There is no correlation model.");
      return;
    }

    let cd_counts = 0;
    let efd_counts = 0;
    this.projectData.holes.forEach((hole) => {
      hole.sections.forEach((section) => {
        section.markers.forEach((marker) => {
          if (marker.composite_depth == null) {
            console.log(
              "ERROR: CD is null. " + this.getMarkerNameFromId(marker.id)
            );
            cd_counts += 1;
          }
          if (marker.event_free_depth == null) {
            console.log(
              "ERROR: EFD is null. " + this.getMarkerNameFromId(marker.id)
            );
            efd_counts += 1;
          }
        });
      });
    });
    console.log(
      "Total Model Interpolation Error: CD:" + cd_counts + ", EFD:" + efd_counts
    );

    if (cd_counts == 0 && efd_counts == 0) {
      return true;
    } else {
      return false;
    }
  }
  getDepthFromTrinity(trinityList, calcType) {
    let output = [];
    for (let t = 0; t < trinityList.length; t++) {
      //initiarize
      let upperIdxs = [];
      let lowerIdxs = [];

      const holeName = lcfnc.zeroPadding(trinityList[t].hole_name);
      const sectionName = lcfnc.zeroPadding(trinityList[t].section_name);
      const distance = parseFloat(trinityList[t].distance);

      const num_holes = this.projectData.holes.length;
      for (let h = 0; h < num_holes; h++) {
        const holeData = this.projectData.holes[h];
        const num_secs = holeData.sections.length;
        for (let s = 0; s < num_secs; s++) {
          const sectionData = holeData.sections[s];
          const num_markers = sectionData.markers.length;
          for (let m = 0; m < num_markers - 1; m++) {
            //check name and distance
            if (holeData.name === holeName) {
              if (sectionData.name === sectionName) {
                if (distance >= sectionData.markers[m].distance) {
                  if (distance <= sectionData.markers[m + 1].distance) {
                    if (upperIdxs.length > 0) {
                      if (
                        lowerIdxs[lowerIdxs.length - 1].toString() ==
                        [1, h, s, m].toString()
                      ) {
                        //case the target horizon located on the marker
                        //none
                      }
                    } else {
                      upperIdxs.push([1, h, s, m]);
                      lowerIdxs.push([1, h, s, m + 1]);
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
        console.log(
          "ERROR: Nearest unique marker set does not exist. [" +
            trinityList[t].name +
            " : " +
            trinityList[t].hole_name +
            "-" +
            trinityList[t].section_name +
            "-" +
            trinityList[t].distance +
            " cm]"
        );
        output.push([null, null]);
        continue;
      } else if (upperIdxs.length > 1 || lowerIdxs.length > 1) {
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
        output.push([null, null]);
      }

      //get section data
      let sectionId =
        this.projectData.holes[upperIdxs[0][1]].sections[upperIdxs[0][2]].id;

      //get nearest cd/efd data
      const D1 =
        this.projectData.holes[upperIdxs[0][1]].sections[upperIdxs[0][2]]
          .markers[upperIdxs[0][3]][calcType];
      const D3 =
        this.projectData.holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]]
          .markers[lowerIdxs[0][3]][calcType];

      const d1 =
        this.projectData.holes[upperIdxs[0][1]].sections[upperIdxs[0][2]]
          .markers[upperIdxs[0][3]].distance;
      const d3 =
        this.projectData.holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]]
          .markers[lowerIdxs[0][3]].distance;
      const D1_rank =
        this.projectData.holes[upperIdxs[0][1]].sections[upperIdxs[0][2]]
          .markers[upperIdxs[0][3]].connection_rank;
      const D3_rank =
        this.projectData.holes[lowerIdxs[0][1]].sections[lowerIdxs[0][2]]
          .markers[lowerIdxs[0][3]].connection_rank;

      if (D1 == null || D3 == null) {
        console.log("ERROR: " + calcType + " of value is empty.");
        console.log("D1:" + D1 + "/D3:" + D3 + "/d1:" + d1 + "/d3:" + d3);

        output.push([null, null]);
        continue;
      }

      //merge data
      let upperData = {
        id: null,
        nearest_data: {
          event_free_depth: D1,
          composite_depth: D1,
          drilling_depth: D1,
          connection_rank: D1_rank,
        },
        cumulate_distance: d1 - distance,
      };
      let lowerData = {
        id: null,
        nearest_data: {
          event_free_depth: D3,
          composite_depth: D3,
          drilling_depth: D3,
          connection_rank: D3_rank,
        },
        cumulate_distance: d3 - distance,
      };

      //calc interpolated depth between markers
      const interpolatedEFD = this.clacInterpolateDepth(
        upperData,
        lowerData,
        calcType
      );
      const new_rank = ss.max([D1_rank, D3_rank]);
      output.push([sectionId, interpolatedEFD, new_rank]);
    }
    return output;
  }
  getEFDfromCD(targetCD) {
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

    this.projectData.holes.forEach((hole) => {
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

    const interpolatedEFD = this.clacInterpolateDepth(
      upperData,
      lowerData,
      "event_free_depth"
    );
    //console.log(      this.getMarkerNameFromId(upperData.id) +        "-" +        this.getMarkerNameFromId(lowerData.id) +        ":" +        interpolatedEFD    );
    return interpolatedEFD;
  }
  getCDfromEFD(targetEFD) {
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

    this.projectData.holes.forEach((hole) => {
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

    const interpolatedEFD = this.clacInterpolateDepth(
      upperData,
      lowerData,
      "composite_depth"
    );
    //console.log(      this.getMarkerNameFromId(upperData.id) +        "-" +        this.getMarkerNameFromId(lowerData.id) +        ":" +        interpolatedEFD    );
    return interpolatedEFD;
  }

  clacMarkerAges(LCAge) {
    if (this.projectData.holes.length == 0) {
      console.log("There is no correlation model.");
      return;
    }
    if (LCAge.AgeModels.length == 0) {
      console.log("There is no age model.");
      return;
    }

    this.projectData.holes.forEach((hole, h) => {
      hole.sections.forEach((section, s) => {
        section.markers.forEach((marker, m) => {
          if (marker.event_free_depth !== null) {
            const age = LCAge.getAgeFromEFD(marker.event_free_depth, "linear");
            marker.age = age.mid;
          }
        });
      });
    });
  }
  getModelSummary() {
    console.log("----------------------------------");
    console.log("           Model summary          ");
    console.log("----------------------------------");
    console.log("Project name: " + this.projectData.name);

    const num_holes = this.projectData.holes.length;
    console.log("Holes: " + num_holes);

    for (let h = 0; h < num_holes; h++) {
      let hole_name = this.projectData.holes[h].name;
      //console.log(this.projectData.holes[h]);
      const num_sections = this.projectData.holes[h].sections.length;
      console.log("Hole name: " + hole_name);

      let num_markers = 0;
      for (let s = 0; s < num_sections; s++) {
        const num_markers_temp =
          this.projectData.holes[h].sections[s].markers.length;
        num_markers += num_markers_temp;
      }
      console.log("   Total sections: " + num_sections);
      console.log("   Total markers: " + num_markers);
    }
    console.log("==================================");
  }

  findSectionIdByName(hole_name, section_name) {
    //get section id
    let section_ids = [];

    const num_holes = this.projectData.holes.length;
    for (let h = 0; h < num_holes; h++) {
      if (this.projectData.holes[h].name === hole_name) {
        const num_sections = this.projectData.holes[h].sections.length;
        for (let s = 0; s < num_sections; s++) {
          if (this.projectData.holes[h].sections[s].name === section_name) {
            section_ids.push(this.projectData.holes[h].sections[s].id);
          }
        }
      }
    }

    if (section_ids.length == 1) {
      return section_ids[0];
    } else if (section_ids.length == 0) {
      console.log(
        "ERROR: There is no suca a section.:" + hole_name + "-" + section_name
      );
    } else {
      console.log("ERROR: Duplicate ids exist.");
      console.log(hole_name + "-" + section_name);
      console.log(section_ids);
      return null;
    }
  }

  //subfunctions
  getHoleListFromCsv() {
    //get hole list from csv
    let holeList = [];
    for (let i = 1; i < this.model_data[0].length + 1; i += 4) {
      const str = this.model_data[0][i];
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
    return holeList;
  }
  getSectionListFromCsv(holeIdx) {
    //holeIdx: retrurned from "getHoleListFromCsv"
    let sectionList = [];
    const topIndices = lcfnc.findCsvIdx(
      this.model_data,
      "top",
      null,
      holeIdx[0]
    );
    const bottomIndices = lcfnc.findCsvIdx(
      this.model_data,
      "bottom",
      null,
      holeIdx[0]
    );

    //check matches num of top and bottom
    if (topIndices.length === bottomIndices.length) {
      for (let i = 0; i < topIndices.length; i++) {
        const topStr = this.model_data[topIndices[i][0]][topIndices[i][1]];
        const bottomStr =
          this.model_data[bottomIndices[i][0]][bottomIndices[i][1]];
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
            console.log(
              "ERROR: Section names between top and bottom does not matched.[Line: " +
                topIndices[i][0] +
                ", " +
                topStr +
                " != " +
                bottomStr +
                " ]"
            );
          }
        } else {
          console.log(
            "ERROR: Hole names does not matched.[Line: " +
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
      console.log("ERROR: Numbers of section 'top' and 'bottom' do not match.");
      return;
    }
    return sectionList;
  }
  getMarkerListFromCsv(sectionIdx) {
    //sectionIdx: returned from "getSectionListFromCsv"
    let markerList = [];
    for (let i = sectionIdx[1][0]; i < sectionIdx[1][1] + 1; i++) {
      const val = this.model_data[i][sectionIdx[0] + 1]; //check at distance col
      if (val !== "") {
        markerList.push(i);
      }
    }

    const output = [sectionIdx[0], sectionIdx[1], markerList];

    return output;
  }
  sortModel() {
    //sort hole bu order
    this.projectData.holes.sort((a, b) => (a.order < b.order ? -1 : 1));
    for (let h = 0; h < this.projectData.holes.length; h++) {
      //sort section by order
      this.projectData.holes[h].sections.sort((a, b) =>
        a.order < b.order ? -1 : 1
      );
      for (let s = 0; s < this.projectData.holes[h].sections.length; s++) {
        this.projectData.holes[h].sections[s].markers.sort((a, b) =>
          a.distance < b.distance ? -1 : 1
        );
      }
    }

    //add new order
    this.projectData.holes.forEach((hole, h) => {
      hole.order = h;
      hole.sections.forEach((section, s) => {
        section.order = s;
        section.markers.forEach((marker, m) => {
          marker.order = m;
        });
      });
    });

    //update search_ids_list
    this.updateSearchIdx();
  }
  updateSearchIdx() {
    this.search_idx_list = [];
    for (let h = 0; h < this.projectData.holes.length; h++) {
      this.search_idx_list[this.projectData.holes[h].id.toString()] = [
        1,
        h,
        null,
        null,
      ];

      for (let s = 0; s < this.projectData.holes[h].sections.length; s++) {
        this.search_idx_list[
          this.projectData.holes[h].sections[s].id.toString()
        ] = [1, h, s, null];
        for (
          let m = 0;
          m < this.projectData.holes[h].sections[s].markers.length;
          m++
        ) {
          this.search_idx_list[
            this.projectData.holes[h].sections[s].markers[m].id.toString()
          ] = [1, h, s, m];
        }
      }
    }
  }
  findZeroPointId() {
    let output = [null, null];
    this.projectData.holes.forEach((h) => {
      h.sections.forEach((s) => {
        s.markers.forEach((m) => {
          if (m.isZeroPoint !== false) {
            output = [m.id, parseFloat(m.isZeroPoint)];
          }
        });
      });
    });
    return output;
  }
  dfs(startNodeId, startVal, type) {
    //calc composite depth
    let visited = new Set();
    let stack = [];
    stack.push([startNodeId.toString(), startVal]); // stack distance
    let compositeDepth = {}; // composite/eventFree depth at each node

    while (stack.length > 0) {
      //console.log(stack.length);
      const data = stack.pop();
      let markerId = data[0];
      let stackDistance = data[1];

      if (!visited.has(markerId)) {
        visited.add(markerId); //add flag
        compositeDepth[markerId] = stackDistance;

        // Add neighbor  node to stack
        const neighborMarkers = this.dfs_getNeighborSet(
          markerId,
          visited,
          type
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
    return compositeDepth;
  }

  dfs_getNeighborSet(currentMarkerId, visited, type) {
    let output = [];
    //get marker data
    const currentMarkerIdx = this.search_idx_list[currentMarkerId];
    const currentMarkerData =
      this.projectData.holes[currentMarkerIdx[1]].sections[currentMarkerIdx[2]]
        .markers[currentMarkerIdx[3]];

    //get connections
    const hNeighborMarkerIds = currentMarkerData.h_connection;
    const vNeighborMarkerIds = currentMarkerData.v_connection;

    //get horizontal connection
    let isMasterHmarkerExist = false;
    for (let h = 0; h < hNeighborMarkerIds.length; h++) {
      //get marker data
      const neighborMarkerIdx =
        this.search_idx_list[hNeighborMarkerIds[h].toString()];
      const neighborMarkerData =
        this.projectData.holes[neighborMarkerIdx[1]].sections[
          neighborMarkerIdx[2]
        ].markers[neighborMarkerIdx[3]];

      //get master connection
      if (currentMarkerData.isMaster == true) {
        //excluding 2nd degree connection
        if (currentMarkerId.split(",")[1] !== neighborMarkerData.id[1]) {
          //case different hole
          output.push([neighborMarkerData.id.toString(), 0]);
          if (
            !visited.has(neighborMarkerData.id.toString()) &&
            neighborMarkerData.isMaster == true
          ) {
            isMasterHmarkerExist = true;
            //console.log("Hcorrelation exist:" + currentMarkerData.id);
          }

          /*
          if (
            !visited.has(neighborMarkerData.id.toString()) &&
            neighborMarkerData.isMaster == true
          ) {
            isMasterHmarkerExist = true;
            //console.log("Hcorrelation exist:" + currentMarkerData.id);
          }
          */
        }
      }
    }

    //get vertivcal connection
    for (let v = 0; v < vNeighborMarkerIds.length; v++) {
      //vertical correlation
      const neighborMarkerIdx = this.search_idx_list[vNeighborMarkerIds[v]];
      const neighborMarkerData =
        this.projectData.holes[neighborMarkerIdx[1]].sections[
          neighborMarkerIdx[2]
        ].markers[neighborMarkerIdx[3]];

      if (
        neighborMarkerData.isMaster == true &&
        isMasterHmarkerExist == false
      ) {
        //if h_connec and v_connec exist, give priority to h_connec.
        if (currentMarkerId.split(",")[1] == neighborMarkerData.id[1]) {
          //case same hole
          if (currentMarkerId.split(",")[2] == neighborMarkerData.id[2]) {
            //same core
            let distanceMarkers = null;
            if (type == "composite_depth") {
              distanceMarkers =
                neighborMarkerData.distance - currentMarkerData.distance;
            } else if (type == "event_free_depth") {
              distanceMarkers = this.calcEFDistance(
                neighborMarkerData,
                currentMarkerData
              );
            }

            output.push([neighborMarkerData.id.toString(), distanceMarkers]);
          } else {
            //case different core(piston)
            output.push([neighborMarkerData.id.toString(), 0]);
          }
        }
      }
    }
    return output;
  }
  applyMarkerInterpolation(MaxSourceDegree, calcType, isExtrapolation) {
    for (let h = 0; h < this.projectData.holes.length; h++) {
      //
      for (let s = 0; s < this.projectData.holes[h].sections.length; s++) {
        //;
        for (
          let m = 0;
          m < this.projectData.holes[h].sections[s].markers.length;
          m++
        ) {
          //find marker without composite depth
          const targetMarkerData =
            this.projectData.holes[h].sections[s].markers[m];

          //get nearest cd/efd data
          const upperMarkerDepth = this.searchNearestMarker(
            MaxSourceDegree,
            targetMarkerData,
            "above",
            calcType
          );
          const lowerMarkerDepth = this.searchNearestMarker(
            MaxSourceDegree,
            targetMarkerData,
            "below",
            calcType
          );

          let interpolatedDepth = this.clacInterpolateDepth(
            upperMarkerDepth,
            lowerMarkerDepth,
            calcType
          );

          if (upperMarkerDepth == null && lowerMarkerDepth == null) {
            continue;
          }

          //apply interpolation
          let ref_max_rank = null;
          if (upperMarkerDepth !== null && lowerMarkerDepth !== null) {
            ref_max_rank = ss.max([
              upperMarkerDepth.nearest_data.connection_rank,
              lowerMarkerDepth.nearest_data.connection_rank,
            ]);
          }

          //apply interpolation
          /*
          if ([1, 4, 1, 3].toString() == targetMarkerData.id.toString()) {
            console.log("L931:" + interpolatedDepth);
            console.log(upperMarkerDepth);
            console.log(lowerMarkerDepth);
          }
          */

          if (interpolatedDepth !== null) {
            if (targetMarkerData[calcType] == null) {
              this.projectData.holes[h].sections[s].markers[m][calcType] =
                interpolatedDepth;
              this.projectData.holes[h].sections[s].markers[m].connection_rank =
                MaxSourceDegree + 1;
            } else {
              if (
                targetMarkerData.connection_rank == null ||
                targetMarkerData.connection_rank > ref_max_rank + 1
              ) {
                this.projectData.holes[h].sections[s].markers[m][calcType] =
                  interpolatedDepth;
                this.projectData.holes[h].sections[s].markers[
                  m
                ].connection_rank = MaxSourceDegree + 1;
              }
            }
          }

          //if reliability is low
          if (
            this.projectData.holes[h].sections[s].markers[m].reliability == 2
          ) {
            this.projectData.holes[h].sections[s].markers[
              m
            ].connection_rank += 1;
          }

          //apply cd/efd to connected other markers based on reliability and rank
          const curret_reliability =
            this.projectData.holes[h].sections[s].markers[m].reliability;
          const h_connection =
            this.projectData.holes[h].sections[s].markers[m].h_connection;
          for (let c = 0; c < h_connection.length; c++) {
            const hc_idx = this.search_idx_list[h_connection[c]];
            const connected_rliability =
              this.projectData.holes[hc_idx[1]].sections[hc_idx[2]].markers[
                hc_idx[3]
              ].reliability;
            const connected_rank =
              this.projectData.holes[hc_idx[1]].sections[hc_idx[2]].markers[
                hc_idx[3]
              ].connection_rank;
            const current_rank =
              this.projectData.holes[h].sections[s].markers[m].connection_rank;

            //if connected marler is lower reliability and rank, write cd
            if (connected_rliability >= curret_reliability) {
              if (connected_rank > current_rank || connected_rank == null) {
                if (
                  this.projectData.holes[h].sections[s].markers[m][calcType] !==
                  null
                ) {
                  this.projectData.holes[hc_idx[1]].sections[hc_idx[2]].markers[
                    hc_idx[3]
                  ][calcType] =
                    this.projectData.holes[h].sections[s].markers[m][calcType];
                }
              }
            }
          }

          //apply extrapolation
          if (isExtrapolation == true) {
            //switch extrapolation by direction
            let extrapolatedDepth = null;
            if (upperMarkerDepth == null) {
              extrapolatedDepth = lowerMarkerDepth;
            } else if (lowerMarkerDepth == null) {
              extrapolatedDepth = upperMarkerDepth;
            } else {
              continue;
            }

            if (extrapolatedDepth !== null) {
              //set depth
              if (targetMarkerData[calcType] == null) {
                this.projectData.holes[h].sections[s].markers[m][calcType] =
                  extrapolatedDepth.nearest_data[calcType] -
                  extrapolatedDepth.cumulate_distance;

                this.projectData.holes[h].sections[s].markers[
                  m
                ].connection_rank = MaxSourceDegree + 2;
              }
            }
          }
        }
      }
    }
  }

  searchNearestMarker(nth, startMarkerData, searchDirection, calcType) {
    //nth: max data source of n degree connection

    let flagDirection;
    null;
    if (searchDirection == "above") {
      flagDirection = false;
    } else if (searchDirection == "below") {
      flagDirection = true;
    } else {
      console.log("Search nearest marker direction is not correct.");
      return null;
    }

    let flagSearch = true;
    let visitedId = new Set();
    visitedId.add(startMarkerData.id.toString());
    let nextIds = startMarkerData.v_connection;
    let distanceFromStartMarker = 0; //cumulate distance
    let cdAtStartMarker = startMarkerData.composite_depth; //composite depth
    let cdAtNearestMarker = null;
    let efdAtStartMarker = startMarkerData.event_free_depth;
    let efdAtNearestMarker = null;
    let currMarkerData = startMarkerData;
    let nextMarkerData = null;
    let roopCounts = 0;
    let isSuccess = false;

    while (flagSearch) {
      roopCounts += 1;
      //search from vertical connection list
      for (let i = 0; i < nextIds.length; i++) {
        //check new marker
        if (visitedId.has(nextIds[i].toString()) == false) {
          //add visited list
          visitedId.add(nextIds[i].toString());

          //get checking next marker
          nextMarkerData = this.getDataByIdx(
            this.search_idx_list[nextIds[i].toString()]
          );

          //get distance between markers
          let distanceBetweenMarkers = null;
          if (calcType == "composite_depth") {
            distanceBetweenMarkers =
              nextMarkerData.distance - currMarkerData.distance;
          } else if (calcType == "event_free_depth") {
            distanceBetweenMarkers = this.calcEFDistance(
              nextMarkerData,
              currMarkerData
            );
          }

          //check connected direction
          if (
            (flagDirection && distanceBetweenMarkers >= 0) ||
            (!flagDirection && distanceBetweenMarkers <= 0)
          ) {
            //add cumlate distance
            distanceFromStartMarker += distanceBetweenMarkers;

            //checking marker connection rank
            if (
              nextMarkerData.connection_rank <= nth &&
              nextMarkerData.connection_rank !== null &&
              nextMarkerData[calcType] !== null
            ) {
              //case found nth or more good marker, extract data, and finish
              isSuccess = true;
              flagSearch = false;
              break;
            } else {
              //nextMarker is not suitable in this direction
              nextIds = [];
              nextIds = nextMarkerData.v_connection;

              if (nextIds.length == 0) {
                //there is no next marker
                flagSearch = false;
              } else {
                currMarkerData = nextMarkerData;
              }
            }
          }
        }
      }

      //limit max search count
      if (roopCounts > 100) {
        flagSearch = false;
      }
    }

    //output process
    let output = null;
    if (isSuccess == true) {
      //case successfull
      cdAtNearestMarker = nextMarkerData.composite_depth;
      cdAtStartMarker = startMarkerData.composite_depth;
      efdAtNearestMarker = nextMarkerData.event_free_depth;
      efdAtStartMarker = startMarkerData.event_free_depth;

      output = {
        direction: searchDirection,
        cumulate_distance: distanceFromStartMarker,
        search_count: roopCounts,
        target_data: {
          id: startMarkerData.id,
          connection_rank: startMarkerData.connection_rank,
        },
        nearest_data: {
          composite_depth: cdAtNearestMarker,
          event_free_depth: efdAtNearestMarker,
          id: nextMarkerData.id,
          connection_rank: nextMarkerData.connection_rank,
        },
      };
    }

    return output;
  }
  connectEventPairs() {
    let isMakeNewMarker = false;
    const holeList = this.getHoleListFromCsv();
    for (let h = 0; h < holeList.length; h++) {
      const sectionList = this.getSectionListFromCsv(holeList[h]);
      for (let s = 0; s < sectionList.length; s++) {
        const markerList = this.getMarkerListFromCsv(sectionList[s]);
        for (let m = 0; m < markerList[2].length; m++) {
          const num_e =
            this.projectData.holes[h].sections[s].markers[m].event.length;
          isMakeNewMarker = false;

          for (let e = 0; e < num_e; e++) {
            let event =
              this.projectData.holes[h].sections[s].markers[m].event[e];
            //================================================================================================
            if (event[0] == "deposition" || event[0] == "markup") {
              if (event[2] == null) {
                //----------------------------------------------------------------------------------------------------
                //case defined by upper/lower/through
                if (event[1] == "downward" || event[1] == "through-down") {
                  //get lower marker
                  const currentIdx =
                    this.search_idx_list[
                      this.projectData.holes[h].sections[s].markers[
                        m
                      ].id.toString()
                    ];
                  let nextId = null;
                  this.projectData.holes[h].sections[s].markers[
                    m
                  ].v_connection.forEach((vc) => {
                    const temopIdx = this.search_idx_list[vc];
                    const diff =
                      this.projectData.holes[temopIdx[1]].sections[temopIdx[2]]
                        .markers[temopIdx[3]].distance -
                      this.projectData.holes[h].sections[s].markers[m].distance;
                    if (diff >= 0) {
                      //if downward
                      nextId =
                        this.projectData.holes[temopIdx[1]].sections[
                          temopIdx[2]
                        ].markers[temopIdx[3]].id;
                    }
                  });

                  let nextIdx = this.search_idx_list[nextId];

                  //case out of section
                  if (
                    nextIdx[3] >
                    this.projectData.holes[nextIdx[1]].sections[nextIdx[2]]
                      .markers.length
                  ) {
                    continue;
                  }

                  //get lower next marker data
                  const nextMarkerData = this.getDataByIdx(nextIdx);
                  const events_next = nextMarkerData.event;

                  for (let i = 0; i < events_next.length; i++) {
                    const event_next = events_next[i];
                    if (
                      event_next[0] == "deposition" ||
                      event_next[0] == "markup"
                    ) {
                      if (
                        event_next[1] == "upward" ||
                        event_next[1] == "through-up"
                      ) {
                        //connect current -> next
                        if (
                          this.projectData.holes[currentIdx[1]].sections[
                            currentIdx[2]
                          ].markers[currentIdx[3]].event[e][2] == null
                        ) {
                          this.projectData.holes[currentIdx[1]].sections[
                            currentIdx[2]
                          ].markers[currentIdx[3]].event[e][2] =
                            nextMarkerData.id;
                        }

                        //connect next -> current
                        if (
                          this.projectData.holes[nextIdx[1]].sections[
                            nextIdx[2]
                          ].markers[nextIdx[3]].event[i][2] == null
                        ) {
                          this.projectData.holes[nextIdx[1]].sections[
                            nextIdx[2]
                          ].markers[nextIdx[3]].event[i][2] =
                            this.projectData.holes[h].sections[s].markers[m].id;
                        }
                      }
                    }
                  }
                } else if (event[1] == "upward" || event[1] == "through-up") {
                  //----------------------------------------------------------------------------------------------------
                  //get upper marker
                  const currentIdx =
                    this.search_idx_list[
                      this.projectData.holes[h].sections[s].markers[
                        m
                      ].id.toString()
                    ];
                  let nextId = null;
                  this.projectData.holes[h].sections[s].markers[
                    m
                  ].v_connection.forEach((vc) => {
                    const temopIdx = this.search_idx_list[vc];
                    const diff =
                      this.projectData.holes[temopIdx[1]].sections[temopIdx[2]]
                        .markers[temopIdx[3]].distance -
                      this.projectData.holes[h].sections[s].markers[m].distance;
                    if (diff < 0) {
                      //if upward
                      nextId =
                        this.projectData.holes[temopIdx[1]].sections[
                          temopIdx[2]
                        ].markers[temopIdx[3]].id;
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
                    if (
                      event_next[0] == "deposition" ||
                      event_next[0] == "markup"
                    ) {
                      if (
                        event_next[1] == "downward" ||
                        event_next[1] == "through-down"
                      ) {
                        //connect current -> next
                        if (
                          this.projectData.holes[currentIdx[1]].sections[
                            currentIdx[2]
                          ].markers[currentIdx[3]].event[e][2] == null
                        ) {
                          this.projectData.holes[currentIdx[1]].sections[
                            currentIdx[2]
                          ].markers[currentIdx[3]].event[e][2] =
                            nextMarkerData.id;
                        }

                        //connect next -> current
                        if (
                          this.projectData.holes[nextIdx[1]].sections[
                            nextIdx[2]
                          ].markers[nextIdx[3]].event[i][2] == null
                        ) {
                          this.projectData.holes[nextIdx[1]].sections[
                            nextIdx[2]
                          ].markers[nextIdx[3]].event[i][2] =
                            this.projectData.holes[h].sections[s].markers[m].id;
                        }
                      }
                    }
                  }
                } else if (event[0] == "erosion") {
                  //----------------------------------------------------------------------------------------------------
                  if (!isNaN(parseFloat(event[2]))) {
                    this.projectData.holes[h].sections[s].markers[m].event.push(
                      ["erosion", event[1], event[2], "erosion"]
                    );
                  }
                }
              }

              if (event[2] == null) {
                console.log(
                  "ERROR: There is no pair event maker at " +
                    this.getMarkerNameFromId(
                      this.projectData.holes[h].sections[s].markers[m].id
                    )
                );
                return;
              }

              if (event[2][2] === undefined) {
                //----------------------------------------------------------------------------------------------------
                //case defined by numerical thickness(NOT recommended)
                const event_border_distance =
                  this.projectData.holes[h].sections[s].markers[m].distance +
                  event[2];
                const event_border_distance_for_check =
                  Math.round(event_border_distance * 10) / 10;
                const event_border_drilling_depth =
                  this.projectData.holes[h].sections[s].markers[m]
                    .drilling_depth + event[2];

                const startIdx =
                  this.search_idx_list[
                    this.projectData.holes[h].sections[s].markers[
                      m
                    ].id.toString()
                  ];
                const targetSectionData =
                  this.projectData.holes[startIdx[1]].sections[startIdx[2]];

                let previousIdx = startIdx;
                let previousMarkerData =
                  targetSectionData.markers[previousIdx[3]];
                let currentIdx = [];
                let through_dir = [null, null];
                if (event[1] == "upward") {
                  for (let m = startIdx[3] - 1; m >= 0; m--) {
                    //get current data
                    const currentMarkerData = targetSectionData.markers[m];
                    currentIdx =
                      this.search_idx_list[currentMarkerData.id.toString()];
                    const current_distance =
                      Math.round(currentMarkerData.distance * 10) / 10;

                    if (current_distance > event_border_distance_for_check) {
                      //case through(layer exist between current and event border)

                      if (m == startIdx[3] - 1) {
                        //if first, update event

                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                        ];
                      } else {
                        //if not first

                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-up",
                          currentMarkerData.id,
                          event[3],
                        ]);
                      }

                      //connect to
                      this.projectData.holes[currentIdx[1]].sections[
                        currentIdx[2]
                      ].markers[currentIdx[3]].event.push([
                        event[0],
                        "through-down",
                        previousMarkerData.id,
                        event[3],
                      ]);

                      //for next
                      previousIdx = currentIdx;
                      previousMarkerData = currentMarkerData;

                      //finish process
                      isMakeNewMarker = false;
                    } else if (
                      current_distance == event_border_distance_for_check
                    ) {
                      //if match the distance
                      if (m == startIdx[3] - 1) {
                        //if first

                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                        ];
                      } else {
                        //if not first
                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-up",
                          currentMarkerData.id,
                          event[3],
                        ]);
                      }

                      //connect to
                      this.projectData.holes[currentIdx[1]].sections[
                        currentIdx[2]
                      ].markers[currentIdx[3]].event.push([
                        event[0],
                        "downward-down",
                        previousMarkerData.id,
                        event[3],
                      ]);

                      isMakeNewMarker = false;
                      break;
                    } else if (
                      current_distance < event_border_distance_for_check
                    ) {
                      through_dir = [m - startIdx[3] + 1, "upward"];
                      isMakeNewMarker = true;
                      break;
                    }
                  }
                } else if (event[1] == "downward") {
                  for (
                    let m = startIdx[3] + 1;
                    m < targetSectionData.markers.length;
                    m++
                  ) {
                    //get current data
                    const currentMarkerData = targetSectionData.markers[m];
                    currentIdx =
                      this.search_idx_list[currentMarkerData.id.toString()];
                    const current_distance =
                      Math.round(currentMarkerData.distance * 10) / 10;

                    if (current_distance < event_border_distance_for_check) {
                      //case through(layer exist between current and event border)

                      if (m == startIdx[3] + 1) {
                        //if first, update event

                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                        ];
                      } else {
                        //if not first

                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-down",
                          currentMarkerData.id,
                          event[3],
                        ]);
                      }

                      //connect to
                      this.projectData.holes[currentIdx[1]].sections[
                        currentIdx[2]
                      ].markers[currentIdx[3]].event.push([
                        event[0],
                        "through-up",
                        previousMarkerData.id,
                        event[3],
                      ]);

                      //for next
                      previousIdx = currentIdx;
                      previousMarkerData = currentMarkerData;

                      isMakeNewMarker = false;
                    } else if (
                      current_distance == event_border_distance_for_check
                    ) {
                      //if match the distance
                      if (m == startIdx[3] + 1) {
                        //if first

                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event[e] = [
                          event[0],
                          event[1],
                          currentMarkerData.id,
                          event[3],
                        ];
                      } else {
                        //if not first
                        //connect from
                        this.projectData.holes[previousIdx[1]].sections[
                          previousIdx[2]
                        ].markers[previousIdx[3]].event.push([
                          event[0],
                          "through-down",
                          currentMarkerData.id,
                          event[3],
                        ]);
                      }

                      //connect to
                      this.projectData.holes[currentIdx[1]].sections[
                        currentIdx[2]
                      ].markers[currentIdx[3]].event.push([
                        event[0],
                        "downward-up",
                        previousMarkerData.id,
                        event[3],
                      ]);

                      //finish process
                      isMakeNewMarker = false;
                      break;
                    } else if (
                      current_distance > event_border_distance_for_check
                    ) {
                      through_dir = [m - startIdx[3] - 1, "downward"];
                      isMakeNewMarker = true;
                      break;
                    }
                  }
                }

                //----------------------------------------------------------------------------------------------------
                //case defined by thickness and no matched marker, make new marker
                if (isMakeNewMarker) {
                  //get border marker ids of target horizon
                  const [
                    upper_marker_id,
                    lower_marker_id,
                    rate_upper,
                    rate_lower,
                  ] = this.getMarkerIdsByDistance(
                    targetSectionData.id,
                    event_border_distance
                  );
                  const upper_marker_idx =
                    this.search_idx_list[upper_marker_id];
                  const lower_marker_idx =
                    this.search_idx_list[lower_marker_id];

                  //make new marker
                  //no marker at the event border
                  const newMarkerData = new Marker();
                  newMarkerData.id = [
                    targetSectionData.id[0],
                    targetSectionData.id[1],
                    targetSectionData.id[2],
                    lcfnc.getUniqueId(
                      this.projectData.holes[startIdx[1]].sections[startIdx[2]]
                        .reserved_marker_ids
                    ),
                  ];

                  newMarkerData.distance = event_border_distance;
                  newMarkerData.name = "event_border";
                  newMarkerData.drilling_depth = event_border_drilling_depth;
                  newMarkerData.reliability += 1;
                  newMarkerData.event = [];
                  if (event[1] == "upward") {
                    newMarkerData.event.push([
                      event[0],
                      "downward",
                      lower_marker_id,
                      event[3],
                    ]);
                  } else if (event[1] == "downward") {
                    newMarkerData.event.push([
                      event[0],
                      "upward",
                      upper_marker_id,
                      event[3],
                    ]);
                  }

                  newMarkerData.h_connection = [];
                  newMarkerData.v_connection = [];
                  newMarkerData.order =
                    (this.projectData.holes[upper_marker_idx[1]].sections[
                      upper_marker_idx[2]
                    ].markers[upper_marker_idx[3]].order +
                      this.projectData.holes[lower_marker_idx[1]].sections[
                        lower_marker_idx[2]
                      ].markers[lower_marker_idx[3]].order) /
                    2; //temp data
                  if (
                    this.projectData.holes[upper_marker_idx[1]].sections[
                      upper_marker_idx[2]
                    ].markers[upper_marker_idx[3]].isMaster == true &&
                    this.projectData.holes[lower_marker_idx[1]].sections[
                      lower_marker_idx[2]
                    ].markers[lower_marker_idx[3]].isMaster == true
                  ) {
                    newMarkerData.isMaster = true;
                  }

                  //add marker
                  this.projectData.holes[currentIdx[1]].sections[
                    currentIdx[2]
                  ].markers.push(newMarkerData);

                  //disconnect markers
                  this.disconnectMarkers(
                    upper_marker_id,
                    lower_marker_id,
                    "virtical"
                  );

                  //connect with new marker
                  this.connectMarkers(
                    upper_marker_id,
                    newMarkerData.id,
                    "virtical"
                  );
                  this.connectMarkers(
                    lower_marker_id,
                    newMarkerData.id,
                    "virtical"
                  );

                  //connect event
                  const connectedEvrentIdx =
                    this.search_idx_list[newMarkerData.event[0][2]];
                  if (newMarkerData.event[0][1] == "upward") {
                    if (through_dir[0] == 0) {
                      //if first
                      //connect from
                      this.projectData.holes[connectedEvrentIdx[1]].sections[
                        connectedEvrentIdx[2]
                      ].markers[connectedEvrentIdx[3]].event[e] = [
                        event[0],
                        event[1],
                        newMarkerData.id,
                        event[3],
                      ];
                    } else {
                      //connect from
                      this.projectData.holes[connectedEvrentIdx[1]].sections[
                        connectedEvrentIdx[2]
                      ].markers[connectedEvrentIdx[3]].event.push([
                        event[0],
                        "through-down",
                        newMarkerData.id,
                        event[3],
                      ]);
                    }
                  } else if (newMarkerData.event[0][1] == "downward") {
                    if (through_dir[0] == 0) {
                      //if first
                      //connect from
                      this.projectData.holes[connectedEvrentIdx[1]].sections[
                        connectedEvrentIdx[2]
                      ].markers[connectedEvrentIdx[3]].event[e] = [
                        event[0],
                        event[1],
                        newMarkerData.id,
                        event[3],
                      ];
                    } else {
                      //connect from
                      this.projectData.holes[connectedEvrentIdx[1]].sections[
                        connectedEvrentIdx[2]
                      ].markers[connectedEvrentIdx[3]].event.push([
                        event[0],
                        "through-up",
                        newMarkerData.id,
                        event[3],
                      ]);
                    }
                  }

                  m = 0;
                  break;
                } else if (event.length > 0) {
                  //already connected
                } else {
                  console.log(
                    "Unsuspected error ocured at finding connected Deposition Event Pairs"
                  );
                }
                //----------------------------------------------------------------------------------------------------
              }
            }
          }
        }
      }
    }
  }

  getMarkerIdsByDistance(sectionId, dist) {
    const secIdx = this.search_idx_list[sectionId.toString()];
    const sectionData = this.projectData.holes[secIdx[1]].sections[secIdx[2]];
    const num_m = sectionData.markers.length;
    for (let m = 0; m < num_m - 1; m++) {
      const dist_upper = sectionData.markers[m].distance;
      const dist_lower = sectionData.markers[m + 1].distance;

      if (dist <= dist_lower && dist >= dist_upper) {
        const rate_from_upper = (dist - dist_upper) / (dist_lower - dist_upper);
        const rate_from_lower = (dist_lower - dist) / (dist_lower - dist_upper);
        return [
          sectionData.markers[m].id,
          sectionData.markers[m + 1].id,
          rate_from_upper,
          rate_from_lower,
        ];
      }
    }
    return [null, null, null, null];
  }

  disconnectMarkers(fromId, toId, direction) {
    this.updateSearchIdx();
    const fromIdx = this.search_idx_list[fromId.toString()];
    const toIdx = this.search_idx_list[toId.toString()];

    if (direction == "virtical") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
        fromIdx[3]
      ].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });
      //check in connection of to
      this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
        toIdx[3]
      ].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //disconnect
      if (connectionIdxFrom !== null && connectionIdxTo !== null) {
        this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
          fromIdx[3]
        ].v_connection.splice(connectionIdxFrom, 1);
        this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
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
        console.log(
          "Fail to disconnect markers because there is no connection between ." +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
      }
    } else if (dirction == "horizontal") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
        fromIdx[3]
      ].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });
      //check in connection of to
      this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
        toIdx[3]
      ].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //disconnect
      if (connectionIdxFrom !== null && connectionIdxTo !== null) {
        this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
          fromIdx[3]
        ].h_connection.splice(connectionIdxFrom, 1);
        this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
          toIdx[3]
        ].h_connection.splice(connectionIdxTo, 1);
        /*
        console.log(
          "Disconnected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
      } else {
        console.log(
          "Fail to disconnect markers because there is no connection between ." +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
      }
    }
  }
  connectMarkers(fromId, toId, direction) {
    this.updateSearchIdx();
    const fromIdx = this.search_idx_list[fromId.toString()];
    const toIdx = this.search_idx_list[toId.toString()];

    if (direction == "virtical") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
        fromIdx[3]
      ].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });

      //check in connection of to
      this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
        toIdx[3]
      ].v_connection.forEach((v_c, n) => {
        if (v_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //connect
      if (connectionIdxFrom == null && connectionIdxTo == null) {
        this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
          fromIdx[3]
        ].v_connection.push(toId);

        this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
          toIdx[3]
        ].v_connection.push(fromId);
        /*
        console.log(
          "Connected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
      } else {
        /*
        console.log(
          "Fail to connect markers because there are already connected between ." +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
      }
    } else if (dirction == "horizontal") {
      let connectionIdxFrom = null;
      let connectionIdxTo = null;
      //check in connection of from
      this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
        fromIdx[3]
      ].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == toId.toString()) {
          connectionIdxFrom = n;
        }
      });
      //check in connection of to
      this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
        toIdx[3]
      ].h_connection.forEach((h_c, n) => {
        if (h_c.toString() == fromId.toString()) {
          connectionIdxTo = n;
        }
      });

      //connect
      if (connectionIdxFrom == null && connectionIdxTo == null) {
        this.projectData.holes[fromIdx[1]].sections[fromIdx[2]].markers[
          fromIdx[3]
        ].h_connection.push(toId);

        this.projectData.holes[toIdx[1]].sections[toIdx[2]].markers[
          toIdx[3]
        ].h_connection.push(fromId);
        /*
        console.log(
          "Connected between " +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
        */
      } else {
        console.log(
          "Fail to connect markers because there are already connected between ." +
            this.getMarkerNameFromId(fromId) +
            " and " +
            this.getMarkerNameFromId(toId)
        );
      }
    }
  }
  calcEFDistance(neighborMarkerData, currentMarkerData) {
    let distanceMarkers =
      neighborMarkerData.distance - currentMarkerData.distance;
    let erosion_thickness = 0;
    let deposition_thickness = 0;

    //calc erosion event thickness
    if (distanceMarkers >= 0) {
      //downward case
      currentMarkerData.event.forEach((e) => {
        if (e[0] == "erosion" && e[1] == "downward") {
          erosion_thickness += Math.abs(e[2]);
        }
      });
      neighborMarkerData.event.forEach((e) => {
        if (e[0] == "erosion" && e[1] == "upward") {
          erosion_thickness += Math.abs(e[2]);
        }
      });
    } else if (distanceMarkers < 0) {
      //upward case
      currentMarkerData.event.forEach((e) => {
        if (e[0] == "erosion" && e[1] == "upward") {
          erosion_thickness += Math.abs(e[2]);
        }
      });
      neighborMarkerData.event.forEach((e) => {
        if (e[0] == "erosion" && e[1] == "downward") {
          erosion_thickness += Math.abs(e[2]);
        }
      });
    }

    //calc deposition event thickness
    let isConnectCur2Neb = false;
    let isConnectNeb2Cur = false;
    currentMarkerData.event.forEach((e_cur) => {
      if (e_cur[0] == "deposition") {
        if (e_cur[2] !== null) {
          if (e_cur[2].toString() == neighborMarkerData.id.toString()) {
            isConnectCur2Neb = true;
          }
        }
      }
    });
    neighborMarkerData.event.forEach((e_neb) => {
      if (e_neb[0] == "deposition") {
        if (e_neb[2] !== null) {
          if (e_neb[2].toString() == currentMarkerData.id.toString()) {
            isConnectNeb2Cur = true;
          }
        }
      }
    });
    //if both connected
    if (isConnectCur2Neb && isConnectNeb2Cur) {
      //if event data linked, all thickness is event layer
      deposition_thickness =
        neighborMarkerData.distance - currentMarkerData.distance;
    } else if (
      currentMarkerData.event.length !== 0 &&
      neighborMarkerData.event.length !== 0
    ) {
      //usually not necessaly
      /*
      console.log(
        "Fail to calc EFD because Event is not connected between " +
          this.getMarkerNameFromId(currentMarkerData.id) +
          "--" +
          this.getMarkerNameFromId(neighborMarkerData.id)
      );
      */
    }

    //calc event free depth
    distanceMarkers =
      distanceMarkers - deposition_thickness + erosion_thickness;

    return distanceMarkers;
  }

  getDataByIdx(relative_idxs) {
    let output;
    if (relative_idxs.length == 2) {
      //case hole data
      output = this.projectData.holes[relative_idxs[1]];
    } else if (relative_idxs.length == 3) {
      //case section data
      output =
        this.projectData.holes[relative_idxs[1]].sections[relative_idxs[2]];
    } else if (relative_idxs.length == 4) {
      //case marker/event data
      output =
        this.projectData.holes[relative_idxs[1]].sections[relative_idxs[2]]
          .markers[relative_idxs[3]];
    }

    return output;
  }

  clacInterpolateDepth(upperData, lowerData, calcType) {
    //input data is results of searchNearestMarker
    //check mach
    let output = null;

    if (upperData == null || lowerData == null) {
      return output;
    }

    let D1 = null;
    let D2 = null;
    let D3 = null;

    D1 = parseFloat(upperData.nearest_data[calcType]);
    D3 = parseFloat(lowerData.nearest_data[calcType]);

    //if (upperData.target_data.id == lowerData.target_data.id) {   }
    const d2d1 = -1 * parseFloat(upperData.cumulate_distance);
    const d3d1 =
      parseFloat(lowerData.cumulate_distance) -
      parseFloat(upperData.cumulate_distance);

    if (d2d1 == 0 && d3d1 == 0) {
      //case defined markers on the duplicated same distance marker(e.g. core top)
      D2 = D1;
    } else {
      D2 = D1 + (d2d1 / d3d1) * (D3 - D1);
    }
    if (!isNaN(D2) && D2 !== null) {
      output = D2;
    }

    /*
    if ([1, 4, 1, 3].toString() == upperData.target_data.id.toString()) {
      console.log(
        "D1:" +
          D1 +
          "/D3:" +
          D3 +
          "/d2d1:" +
          d2d1 +
          "/d3d1:" +
          d3d1 +
          "/D2:" +
          D2
      );
    }
    */

    return output;
  }
  getMarkerNameFromId(id) {
    const idx = this.search_idx_list[id.toString()];
    const holeName = this.projectData.holes[idx[1]].name;
    const secName = this.projectData.holes[idx[1]].sections[idx[2]].name;
    const markerName =
      this.projectData.holes[idx[1]].sections[idx[2]].markers[idx[3]].name;
    const output = "[" + holeName + "-" + secName + "-" + markerName + "]";
    return output;
  }
  getIdxById(id) {
    const num_id = id.length;
    if (num_id < 2) {
      return;
    }
    let relative_idxs = [1];

    if (num_id >= 2) {
      const num_holes = this.projectData.holes.length;
      for (let h = 0; h < num_holes; h++) {
        const holeData = this.projectData.holes[h];
        if (holeData.id[1] == id[1]) {
          relative_idxs.push(h);

          if (num_id >= 3) {
            const num_sections = holeData.sections.length;
            for (let s = 0; s < num_sections; s++) {
              const sectionData = holeData.sections[s];
              if (sectionData.id[2] == id[2]) {
                relative_idxs.push(s);

                if (num_id == 5) {
                  if (id[3] == "marker") {
                    const num_markers = sectionData.markers.length;
                    for (let m = 0; m < num_markers; m++) {
                      const markerData = sectionData.markers[m];
                      if (markerData.id[4] == id[4]) {
                        relative_idxs.push("marker");
                        relative_idxs.push(m);
                      }
                    }
                  } else if (id[3] == "event") {
                    const num_events = sectionData.events.length;
                    for (let e = 0; e < num_events; e++) {
                      const eventData = sectionData.events[m];
                      if (eventData.id[4] == id[4]) {
                        relative_idxs.push("event");
                        relative_idxs.push(e);
                      }
                    }
                  }
                } else if (num_id > 5) {
                  console.log("Too long undefined id.");
                }
              }
            }
          }
        }
      }
    }
    return relative_idxs;
  }
  getNearestTrinity(depth, calcType) {
    //this method returns paseudo result because multiple sections matched, but returns most goood sections based on centre of sections.
    let nearestSectionData = null;
    let diffDepth = Infinity;
    for (let h = 0; h < this.projectData.holes.length; h++) {
      for (let s = 0; s < this.projectData.holes[h].sections.length; s++) {
        const sectionData = this.projectData.holes[h].sections[s];
        const midSec =
          (sectionData.markers[0][calcType] +
            sectionData.markers[sectionData.markers.length - 1][calcType]) /
          2;

        if (diffDepth > Math.abs(midSec - depth)) {
          diffDepth = Math.abs(midSec - depth);
          nearestSectionData = sectionData;
        }
      }
    }

    if (nearestSectionData == null) {
      return [null, null, null];
    }

    //
    let upperData = nearestSectionData.markers[0];
    let lowerData =
      nearestSectionData.markers[nearestSectionData.markers.length - 1];

    nearestSectionData.markers.forEach((marker) => {
      const temp = marker[calcType] - depth;
      if (temp <= 0 && marker[calcType] - upperData[calcType] < temp) {
        upperData = marker;
      }
      if (temp >= 0 && marker[calcType] - lowerData[calcType] > temp) {
        lowerData = marker;
      }
    });

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

    const interpDistance = interp(
      [upperData[calcType], lowerData[calcType]],
      [upperData.distance, lowerData.distance],
      depth
    );

    const idxs = this.getIdxById(nearestSectionData.id);

    return [
      this.projectData.holes[idxs[1]].name,
      nearestSectionData.name,
      interpDistance,
    ];
  }
  getIdxFromTrinity([holeName, sectionName, distance]) {
    let idx = [0, null, null, null];
    for (let h = 0; h < this.projectData.holes.length; h++) {
      const hole = this.projectData.holes[h];
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
              if (marker.distance == distance) {
                idx[3] == m;
              }
            }
          }
        }
      }
    }
    return idx;
  }

  getParallelSection;
}

module.exports = { LevelCompilerCore };
