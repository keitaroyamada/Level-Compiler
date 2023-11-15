  loadModelFromCsv(model_path) {
    //load model
    this.model_data = lcfnc.readcsv(model_path);

    //add unique id for each markers
    const markerIdList = lcfnc.makeMarkerIdBase(
      this.model_data.length,
      this.model_data[0].length
    );

    //get hole list
    const holeList = this.getHoleListFromCsv();

    //add each hole
    for (let h = 0; h < holeList.length; h++) {
      //make instance
      let holeData = new Hole();
      //add info
      const newHoleId = lcfnc.getUniqueId(this.projectData.reserved_hole_ids);
      this.projectData.reserved_hole_ids.push(newHoleId);
      holeData.id = [this.projectData.id, newHoleId];
      holeData.name = lcfnc.zeroPadding(holeList[h][1]);
      holeData.display_order = h;

      //get section list
      const sectionList = this.getSectionListFromCsv(holeList[h]);

      for (let c = 0; c < sectionList.length; c++) {
        //make instance
        let sectionData = new Section();
        //add info
        const newSectionId = lcfnc.getUniqueId(holeData.reserved_section_ids);
        holeData.reserved_section_ids.push(newSectionId);
        sectionData.id = [this.projectData.id, newHoleId, newSectionId];
        sectionData.name = lcfnc.zeroPadding(sectionList[c][2]);

        //get marker list
        const markerList = this.getMarkerListFromCsv(sectionList[c]);

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
            this.projectData.id,
            newHoleId,
            newSectionId,
            "marker",
            newMarkerId,
          ];

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

          //check zero point
          if (this.model_data[marker_r][0].includes("(0)")) {
            markerData.isZeroPoint = true;
          }

          //check master section
          const masterHole = this.model_data[marker_r][0]
            .replace("(0)", "")
            .split("/");

          for (let k = 0; k < masterHole.length; k++) {
            if (masterHole[k] == holeList[h][1]) {
              markerData.isMaster = true;
            }
          }

          //load event data
          const events = this.model_data[marker_r][marker_c + 3].split("/");
          let event_data = [];
          for (let e = 0; e < events.length; e++) {
            const event = events[e].split(/[()]+/);
            event_data.push([event[0], event[1]]);
          }
          markerData.event_data = event_data;

          //add marker
          sectionData.markers.push(markerData);
        }
        //add section
        holeData.sections.push(sectionData);
      }
      //add hole
      this.projectData.holes.push(holeData);
    }

    //--------------------------------------------------------
    //initiarise
    //this.sortModel();

    //check correlation
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
            if (val != "") {
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

    console.log("Model loaded from csv.");
  }
  loadCorrelationFromCsv(model_path) {
    //load model
    this.model_data = lcfnc.readcsv(model_path);

    //add unique id for each markers
    const markerIdList = lcfnc.makeMarkerIdBase(
      this.model_data.length,
      this.model_data[0].length
    );

    //get hole list
    const holeList = this.getHoleListFromCsv();

    //add each hole
    for (let h = 0; h < holeList.length; h++) {
      //make instance
      let holeData = new Hole();
      //add info
      const newHoleId = lcfnc.getUniqueId(this.projectData.reserved_hole_ids);
      this.projectData.reserved_hole_ids.push(newHoleId);
      holeData.id = [this.projectData.id, newHoleId];
      holeData.name = lcfnc.zeroPadding(holeList[h][1]);

      //get section list
      const sectionList = this.getSectionListFromCsv(holeList[h]);

      for (let c = 0; c < sectionList.length; c++) {
        //make instance
        let sectionData = new Section();
        //add info
        const newSectionId = lcfnc.getUniqueId(holeData.reserved_section_ids);
        holeData.reserved_section_ids.push(newSectionId);
        sectionData.id = [this.projectData.id, newHoleId, newSectionId];
        sectionData.name = lcfnc.zeroPadding(sectionList[c][2]);

        //get marker list
        const markerList = this.getMarkerListFromCsv(sectionList[c]);

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
            this.projectData.id,
            newHoleId,
            newSectionId,
            "marker",
            newMarkerId,
          ];

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

          //check zero point
          if (this.model_data[marker_r][0].includes("(0)")) {
            markerData.isZeroPoint = true;
          }

          //check master section
          const masterHole = this.model_data[marker_r][0]
            .replace("(0)", "")
            .split("/");

          for (let k = 0; k < masterHole.length; k++) {
            if (masterHole[k] == holeList[h][1]) {
              markerData.isMaster = true;
            }
          }

          //add marker
          sectionData.markers.push(markerData);
        }
        //add section
        holeData.sections.push(sectionData);
      }
      //add hole
      this.projectData.holes.push(holeData);
    }
    //--------------------------------------------------------
    //initiarise
    //this.sortModel();

    //check correlation
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
          for (let k = 2; k < row_data.length; k += 3) {
            //check distance data col
            const val = this.model_data[marker_r][k];
            if (val != "") {
              const correlated_marker_id = markerIdList[marker_r][k - 1];

              this.projectData.holes[h].sections[s].markers[
                m
              ].h_connection.push(correlated_marker_id);
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

    console.log("Model loaded from csv.");
  }
  loadEventFromCsv(data_path) {
    if (this.projectData.holes.length == 0) {
      console.log("Plead load model first.");
      return;
    }
    //load event list
    this.event_data = lcfnc.readcsv(data_path);

    //get section data
    for (let e = 1; e < this.event_data.length; e++) {
      //get event data
      const event_datum = this.event_data[e];
      const event_name = lcfnc.zeroPadding(event_datum[0]);
      const hole_name = lcfnc.zeroPadding(event_datum[1]);
      const section_name = lcfnc.zeroPadding(event_datum[2]);
      const top_distance = parseFloat(event_datum[3]);
      const bottom_distance = parseFloat(event_datum[4]);
      const event_thickness = parseFloat(event_datum[5]);
      const event_type = event_datum[6];

      //find section
      const section_id = this.findSectionIdByName(hole_name, section_name);
      const idxs = this.getIdxById(section_id);

      //add event data
      const newEventId = lcfnc.getUniqueId(
        this.projectData.holes[idxs[1]].sections[idxs[2]].reserved_event_ids
      );
      this.projectData.holes[idxs[1]].sections[idxs[2]].reserved_event_ids.push(
        newEventId
      );

      const eventData = new Event();
      eventData.id = newEventId;
      eventData.name = event_name;
      eventData.upper_distance = top_distance;
      eventData.lower_distance = bottom_distance;
      eventData.thickness = event_thickness;
      eventData.type = event_type;

      this.projectData.holes[idxs[1]].sections[idxs[2]].events.push(eventData);
    }
  }
  calcCompositeDepth() {
    //master section        : [Master Section * ]
    //1st degree connection: [Master Section]-[Parallel Section * ]
    //2nd degree connection: [Master Section]-[Parallel Section]-[Parallel Section * ]
    //3rd degree connection: [Master Section]-[Parallel Section]-[Parallel Section]-[Parallel Section * ] and extrapolation

    //check data
    if (this.model_data == null) {
      return;
    }
    //initiarise
    this.sortModel();

    //find zero point
    const id_zero_point = this.findZeroPointId();

    //calc composite depth by limited DFS method (clac for 0 degree to 1st degree)
    let composite_depth = this.dfs(id_zero_point, "composite_depth");

    for (let key in composite_depth) {
      const calcedMarkerId = key.split("-");
      const midx = this.getIdxById(calcedMarkerId);

      this.projectData.holes[midx[1]].sections[midx[2]].markers[
        midx[4]
      ].composite_depth = parseFloat(composite_depth[key]);
      if (
        this.projectData.holes[midx[1]].sections[midx[2]].markers[midx[4]]
          .isMaster == true
      ) {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[4]
        ].connection_rank = 0;
      } else {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[4]
        ].connection_rank = 1;
      }
    }

    //calc composite depth of 2nd degree connection node/extrapolation
    this.applyInterpolation(1, "composite_depth", true);

    //calc composite depth of 3nd degree connection node
    this.applyInterpolation(2, "composite_depth", false);

    console.log("Calced composite depth.");
  }
  calcEventFreeDepth() {
    //master section        : [Master Section * ]
    //1st degree connection: [Master Section]-[Parallel Section * ]
    //2nd degree connection: [Master Section]-[Parallel Section]-[Parallel Section * ]
    //3rd degree connection: [Master Section]-[Parallel Section]-[Parallel Section]-[Parallel Section * ] and extrapolation

    //check data
    if (this.model_data == null) {
      return;
    }
    //initiarise
    this.sortModel();

    //find zero point
    const id_zero_point = this.findZeroPointId();

    //calc composite depth by limited DFS method (clac for 0 degree to 1st degree)
    let event_free_depth = this.dfs(id_zero_point, "event_free_depth");

    for (let key in event_free_depth) {
      const calcedMarkerId = key.split("-");
      const midx = this.getIdxById(calcedMarkerId);

      this.projectData.holes[midx[1]].sections[midx[2]].markers[
        midx[4]
      ].event_free_depth = parseFloat(event_free_depth[key]);
      if (
        this.projectData.holes[midx[1]].sections[midx[2]].markers[midx[4]]
          .isMaster == true
      ) {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[4]
        ].connection_rank = 0;
      } else {
        this.projectData.holes[midx[1]].sections[midx[2]].markers[
          midx[4]
        ].connection_rank = 1;
      }
    }
    //calc composite depth of 2nd degree connection node/extrapolation
    this.applyInterpolation(1, "event_free_depth", true);

    //calc composite depth of 3nd degree connection node
    this.applyInterpolation(2, "event_free_depth", false);

    console.log("Calced event free depth.");
  }

  sortModel() {
    //skip hole
    //this.projectData.holes.sort((a, b) => (a.distance < b.distance ? -1 : 1));
    for (let h = 0; h < this.projectData.holes.length; h++) {
      //skip section
      //this.projectData.holes[h].sections.sort((a, b) =>
      //  a.distance < b.distance ? -1 : 1
      //);
      for (let s = 0; s < this.projectData.holes[h].sections.length; s++) {
        this.projectData.holes[h].sections[s].markers.sort((a, b) =>
          a.distance < b.distance ? -1 : 1
        );
      }
    }
  }
  findZeroPointId() {
    let output = null;
    this.projectData.holes.forEach((h) => {
      h.sections.forEach((s) => {
        s.markers.forEach((m) => {
          if (m.isZeroPoint == true) {
            output = m.id;
          }
        });
      });
    });
    return output;
  }
  getHoleListFromCsv() {
    //get hole list from csv
    let holeList = [];
    for (let i = 1; i < this.model_data[0].length + 1; i += 4) {
      const str = this.model_data[0][i];
      if (str !== "" && str !== undefined) {
        let matches = str.match(/\(([^)]+)\)/);
        let name = "";
        if (matches) {
          name = matches[1];
          holeList.push([i, name]);
        }
      }
    }
    return holeList;
  }
  getSectionListFromCsv(holeIdx) {
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

    //check length
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
              "ERROR: Section names does not matched.[Line: " +
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
  getEventListFromCsv(data) {}

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
      let event_thickness = 0;
      for (let s = 0; s < num_sections; s++) {
        const num_markers_temp =
          this.projectData.holes[h].sections[s].markers.length;
        num_markers += num_markers_temp;
        for (
          let e = 0;
          e < this.projectData.holes[h].sections[s].events.length;
          e++
        ) {
          event_thickness +=
            this.projectData.holes[h].sections[s].events[e].thickness;
        }
      }
      console.log("   Total sections: " + num_sections);
      console.log("   Total markers: " + num_markers);
      console.log(
        "   Total event thickness: " +
          Math.round(event_thickness * 10) / 10 +
          "cm"
      );
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

  getDataByIdx(relative_idxs) {
    let output;
    if (relative_idxs.length == 2) {
      //case hole data
      output = this.projectData.holes[relative_idxs[1]];
    } else if (relative_idxs.length == 3) {
      //case section data
      output =
        this.projectData.holes[relative_idxs[1]].sections[relative_idxs[2]];
    } else if (relative_idxs.length == 5) {
      //case marker/event data
      if (relative_idxs[3] == "marker") {
        output =
          this.projectData.holes[relative_idxs[1]].sections[relative_idxs[2]]
            .markers[relative_idxs[4]];
      } else if (relative_idxs[3] == "event") {
        output =
          this.projectData.holes[relative_idxs[1]].sections[relative_idxs[2]]
            .events[relative_idxs[4]];
      }
    }

    return output;
  }

  dfs(startNodeId, type) {
    //calc composite depth
    let visited = new Set();
    let stack = [];
    stack.push([startNodeId, 0]); // stack distance
    let compositeDepth = {}; // composite/eventFree depth at each node

    while (stack.length > 0) {
      //console.log(stack.length);
      const data = stack.pop();
      let markerId = data[0];
      let stackDistance = data[1];

      if (!visited.has(markerId)) {
        visited.add(markerId); //add flag
        compositeDepth[markerId.join("-")] = stackDistance;

        // Add neighbor  node to stack
        const neighborMarker = this.getNeighborSet(markerId, visited, type);
        //console.log(neighborMarker.length);
        for (let neighbor of neighborMarker) {
          if (!visited.has(neighbor[0])) {
            stack.push([neighbor[0], stackDistance + neighbor[1]]);
          }
        }
      }
    }

    return compositeDepth;
  }

  getNeighborSet(currentMarkerId, visited, type) {
    let output = [];
    const currentMarkerIdx = this.getIdxById(currentMarkerId);
    const currentMarkerData =
      this.projectData.holes[currentMarkerIdx[1]].sections[currentMarkerIdx[2]]
        .markers[currentMarkerIdx[4]];
    const hNeighborMarkerIds = currentMarkerData.h_connection;
    const vNeighborMarkerIds = currentMarkerData.v_connection;
    let isMasterHmarkerExist = false;
    for (let h = 0; h < hNeighborMarkerIds.length; h++) {
      //case horizontal correlation
      const neighborMarkerIdx = this.getIdxById(hNeighborMarkerIds[h]);
      const neighborMarkerData =
        this.projectData.holes[neighborMarkerIdx[1]].sections[
          neighborMarkerIdx[2]
        ].markers[neighborMarkerIdx[4]];
      if (currentMarkerData.isMaster == true) {
        //excluding 2nd degree connection
        if (currentMarkerId[1] !== neighborMarkerData.id[1]) {
          //case different hole
          output.push([neighborMarkerData.id, 0]);
          if (
            !visited.has(neighborMarkerData.id) &&
            neighborMarkerData.isMaster == true
          ) {
            isMasterHmarkerExist = true;
            //console.log("Hcorrelation exist:" + currentMarkerData.id);
          }
        }
      }
    }

    for (let v = 0; v < vNeighborMarkerIds.length; v++) {
      //vertical correlation
      const neighborMarkerIdx = this.getIdxById(vNeighborMarkerIds[v]);
      const neighborMarkerData =
        this.projectData.holes[neighborMarkerIdx[1]].sections[
          neighborMarkerIdx[2]
        ].markers[neighborMarkerIdx[4]];

      if (
        neighborMarkerData.isMaster == true &&
        isMasterHmarkerExist == false
      ) {
        //if h_connec and v_connec exist, give priority to h_connec.
        if (currentMarkerId[1] == neighborMarkerData.id[1]) {
          //case same hole
          if (currentMarkerId[2] == neighborMarkerData.id[2]) {
            //same core
            let distanceMarkers =
              neighborMarkerData.distance - currentMarkerData.distance;

            if (type == "composite_depth") {
              //
            } else if (type == "event_free_depth") {
              distanceMarkers = this.calcEFDistance(
                neighborMarkerData,
                currentMarkerData
              );
            }

            output.push([neighborMarkerData.id, distanceMarkers]);
          } else {
            //case different core(piston)
            output.push([neighborMarkerData.id, 0]);
          }
        }
      }
    }
    return output;
  }

  searchNearestMarker(nth, startMarkerData, searchDirection, calcType) {
    //nth: max data source of n degree connection

    let flagDirection;
    if (searchDirection == "above") {
      flagDirection = false;
    } else if (searchDirection == "below") {
      flagDirection = true;
    } else {
      return null;
    }

    let flagSearch = true;
    let visitedId = new Set();
    visitedId.add(startMarkerData.id);
    let nextId = startMarkerData.v_connection; //vertical connection id list
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
      for (let i = 0; i < nextId.length; i++) {
        //get checking next marker
        nextMarkerData = this.getDataByIdx(this.getIdxById(nextId[i]));
        visitedId.add(nextId[i]); //add visited list

        let distanceBetweenMarkers =
          nextMarkerData.distance - currMarkerData.distance;
        if (calcType == "event_free_depth") {
          distanceBetweenMarkers = this.calcEFDistance(
            nextMarkerData,
            currMarkerData
          );
        }

        if (
          (flagDirection && distanceBetweenMarkers >= 0) ||
          (!flagDirection && distanceBetweenMarkers <= 0)
        ) {
          //case marker located search direction (including piston core case)
          //add cumlate distance
          distanceFromStartMarker += distanceBetweenMarkers;

          //checking marker connection rank
          if (
            nextMarkerData.connection_rank <= nth &&
            nextMarkerData.connection_rank !== null
          ) {
            //case found nth or more good marker, extract data, and finish
            isSuccess = true;
            flagSearch = false;
          } else {
            //if not found NearestMarker that match the condition(nth), go next generation
            nextId = [];
            for (let n = 0; n < nextMarkerData.v_connection.length; n++) {
              if (!visitedId.has(nextMarkerData.v_connection[n])) {
                //case not visited marker
                nextId.push(nextMarkerData.v_connection[n]);
              }
            }

            if (nextId.length == 0) {
              //there is no next marker
              flagSearch = false;
            } else {
              currMarkerData = nextMarkerData;
            }
          }
          break;
        } else {
          //case NO marker located search direction
        }

        if (i == nextId.length - 1) {
          //case there is no good marker located search direction
          flagSearch = false;
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
        target_id: startMarkerData.id,
        cumulate_distance: distanceFromStartMarker,
        nearest_composite_depth: cdAtNearestMarker,
        nearest_event_free_depth: efdAtNearestMarker,
        search_count: roopCounts,
        target_rank: startMarkerData.connection_rank,
        nearest_rank: nextMarkerData.connection_rank,
      };
    }

    return output;
  }

  clacInterpolateCD(upperData, lowerData) {
    //input data is results of searchNearestMarker
    //check mach
    if (upperData == null || lowerData == null) {
      return null;
    }

    let CD2 = null;
    if (upperData.target_id == lowerData.target_id) {
      const CD1 = parseFloat(upperData.nearest_composite_depth);
      const CD3 = parseFloat(lowerData.nearest_composite_depth);

      const d2d1 = -1 * parseFloat(upperData.cumulate_distance);
      const d3d1 =
        parseFloat(lowerData.cumulate_distance) -
        parseFloat(upperData.cumulate_distance);

      if (d2d1 == 0 && d3d1 == 0) {
        //case defined markers on the duplicated same distance marker(e.g. core top)
        CD2 = CD1;
      } else {
        CD2 = CD1 + (d2d1 / d3d1) * (CD3 - CD1);
      }
    }
    return CD2;
  }

  clacInterpolateEFD(upperData, lowerData) {
    //input data is results of searchNearestMarker
    //check mach
    if (upperData == null || lowerData == null) {
      return null;
    }

    let EFD2 = null;
    if (upperData.target_id == lowerData.target_id) {
      const EFD1 = parseFloat(upperData.nearest_event_free_depth);
      const EFD3 = parseFloat(lowerData.nearest_event_free_depth);

      const d2d1 = -1 * parseFloat(upperData.cumulate_distance);
      const d3d1 =
        parseFloat(lowerData.cumulate_distance) -
        parseFloat(upperData.cumulate_distance);

      if (d2d1 == 0 && d3d1 == 0) {
        //case defined markers on the duplicated same distance marker(e.g. core top)
        EFD2 = EFD1;
      } else {
        EFD2 = EFD1 + (d2d1 / d3d1) * (EFD3 - EFD1);
      }
    }
    return EFD2;
  }

  applyInterpolation(MaxSourceDegree, calcType, isExtrapolation) {
    for (let h = 0; h < this.projectData.holes.length; h++) {
      //
      for (let s = 0; s < this.projectData.holes[h].sections.length; s++) {
        //;
        for (
          let m = 0;
          m < this.projectData.holes[h].sections[s].markers.length;
          m++
        ) {
          //find no composite depth marker
          const targetMarkerData =
            this.projectData.holes[h].sections[s].markers[m];

          if (
            calcType == "composite_depth" &&
            targetMarkerData.composite_depth == null
          ) {
            //case calc composite depth
            //get nearest cd data
            const upperMarkerCD = this.searchNearestMarker(
              MaxSourceDegree,
              targetMarkerData,
              "above",
              calcType
            );
            const lowerMarkerCD = this.searchNearestMarker(
              MaxSourceDegree,
              targetMarkerData,
              "below",
              calcType
            );

            const interpolatedCD = this.clacInterpolateCD(
              upperMarkerCD,
              lowerMarkerCD
            );

            if (upperMarkerCD !== null || lowerMarkerCD !== null) {
              if (interpolatedCD !== null) {
                //apply interpolation
                this.projectData.holes[h].sections[s].markers[
                  m
                ].composite_depth = interpolatedCD;
                this.projectData.holes[h].sections[s].markers[
                  m
                ].connection_rank = MaxSourceDegree + 1;
              }
              if (isExtrapolation == true) {
                //case extrapolation
                let extrapolatedCD;
                if (upperMarkerCD == null) {
                  extrapolatedCD = lowerMarkerCD;
                } else if (lowerMarkerCD == null) {
                  extrapolatedCD = upperMarkerCD;
                } else {
                  continue;
                }

                //set
                this.projectData.holes[h].sections[s].markers[
                  m
                ].composite_depth =
                  extrapolatedCD.nearest_composite_depth -
                  extrapolatedCD.cumulate_distance;
                this.projectData.holes[h].sections[s].markers[
                  m
                ].connection_rank = MaxSourceDegree + 2;
              }

              //apply cd to connected other markers based on reliability
              const curret_reliability =
                this.projectData.holes[h].sections[s].markers[m].reliability;
              const h_connection =
                this.projectData.holes[h].sections[s].markers[m].h_connection;
              for (let c = 0; c < h_connection.length; c++) {
                const hc_idx = this.getIdxById(h_connection[c]);
                const connected_rliability =
                  this.projectData.holes[hc_idx[1]].sections[hc_idx[2]].markers[
                    hc_idx[4]
                  ].reliability;
                const connected_rank =
                  this.projectData.holes[hc_idx[1]].sections[hc_idx[2]].markers[
                    hc_idx[4]
                  ].connection_rank;
                const current_rank =
                  this.projectData.holes[h].sections[s].markers[m]
                    .connection_rank;

                if (connected_rliability <= curret_reliability) {
                  if (connected_rank > current_rank || connected_rank == null) {
                    //if connected marler is lower reliability and rank, write cd
                    this.projectData.holes[hc_idx[1]].sections[
                      hc_idx[2]
                    ].markers[hc_idx[4]].composite_depth =
                      this.projectData.holes[h].sections[s].markers[
                        m
                      ].composite_depth;
                  }
                }
              }
            }
          } else if (
            calcType == "event_free_depth" &&
            targetMarkerData.event_free_depth == null
          ) {
            //case calc event free depth
            //get nearest cd data
            const upperMarkerEFD = this.searchNearestMarker(
              MaxSourceDegree,
              targetMarkerData,
              "above",
              calcType
            );
            const lowerMarkerEFD = this.searchNearestMarker(
              MaxSourceDegree,
              targetMarkerData,
              "below",
              calcType
            );

            const interpolatedEFD = this.clacInterpolateEFD(
              upperMarkerEFD,
              lowerMarkerEFD
            );

            if (upperMarkerEFD !== null || lowerMarkerEFD !== null) {
              if (interpolatedEFD !== null) {
                //apply interpolation
                this.projectData.holes[h].sections[s].markers[
                  m
                ].event_free_depth = interpolatedEFD;
                this.projectData.holes[h].sections[s].markers[
                  m
                ].connection_rank = MaxSourceDegree + 1;
              }
              if (isExtrapolation == true) {
                //case extrapolation
                let extrapolatedEFD;
                if (upperMarkerEFD == null) {
                  extrapolatedEFD = lowerMarkerEFD;
                } else if (lowerMarkerEFD == null) {
                  extrapolatedEFD = upperMarkerEFD;
                } else {
                  continue;
                }

                //set
                this.projectData.holes[h].sections[s].markers[
                  m
                ].event_free_depth =
                  extrapolatedEFD.nearest_event_free_depth -
                  extrapolatedEFD.cumulate_distance;
                this.projectData.holes[h].sections[s].markers[
                  m
                ].connection_rank = MaxSourceDegree + 2;
              }

              //apply efd to connected other markers based on reliability
              const curret_reliability =
                this.projectData.holes[h].sections[s].markers[m].reliability;
              const h_connection =
                this.projectData.holes[h].sections[s].markers[m].h_connection;
              for (let c = 0; c < h_connection.length; c++) {
                const hc_idx = this.getIdxById(h_connection[c]);
                const connected_rliability =
                  this.projectData.holes[hc_idx[1]].sections[hc_idx[2]].markers[
                    hc_idx[4]
                  ].reliability;
                const connected_rank =
                  this.projectData.holes[hc_idx[1]].sections[hc_idx[2]].markers[
                    hc_idx[4]
                  ].connection_rank;
                const current_rank =
                  this.projectData.holes[h].sections[s].markers[m]
                    .connection_rank;

                if (connected_rliability < curret_reliability) {
                  if (connected_rank > current_rank || connected_rank == null) {
                    //if connected marler is lower reliability and rank, write cd
                    this.projectData.holes[hc_idx[1]].sections[
                      hc_idx[2]
                    ].markers[hc_idx[4]].event_free_depth =
                      this.projectData.holes[h].sections[s].markers[
                        m
                      ].event_free_depth;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  calcEFDistance(neighborMarkerData, currentMarkerData) {
    let distanceMarkers =
      neighborMarkerData.distance - currentMarkerData.distance;
    let currentEvent = currentMarkerData.event_data
      .flat(Infinity)
      .join()
      .toLowerCase();
    let neighborEvent = neighborMarkerData.event_data
      .flat(Infinity)
      .join()
      .toLowerCase();

    if (distanceMarkers >= 0) {
      //downward case
      //apply deposition event
      if (currentEvent.includes("upper") || currentEvent.includes("through")) {
        if (
          (currentEvent.includes("upper") && neighborEvent.includes("lower")) ||
          (currentEvent.includes("upper") &&
            neighborEvent.includes("through")) ||
          (currentEvent.includes("through") &&
            neighborEvent.includes("lower")) ||
          (currentEvent.includes("through") &&
            neighborEvent.includes("through"))
        ) {
          //case deposition event between current and neighbor markers
          distanceMarkers -=
            neighborMarkerData.distance - currentMarkerData.distance;
        } else {
          const markerName = this.getMarkerNameFromId(currentMarkerData.id);
          console.log(
            "LC detected start flag of deposition event but cnannot detect end flag." +
              markerName
          );
        }
      }

      //apply erosion event
      if (neighborEvent.includes("upward_erosion")) {
        //case erosion event exist below current marker
        const idx = neighborMarkerData.event_data.indexOf("upward_erosion") / 2;
        const erosion_distance = neighborMarkerData.event_data[idx][1];
        distanceMarkers += erosion_distance;
        console.log("Upward erosion detected:" + erosion_distance);
      }
      if (currentEvent.includes("downward_erosion")) {
        //case erosion event exist below current marker
        const idx =
          currentMarkerData.event_data.indexOf("downward_erosion") / 2;
        const erosion_distance = currentMarkerData.event_data[idx][1];
        distanceMarkers += erosion_distance;
        console.log("Downward erosion detected:" + erosion_distance);
      }
    } else {
      //upward case
      //apply deposition event
      if (currentEvent.includes("lower") || currentEvent.includes("through")) {
        if (
          (currentEvent.includes("lower") && neighborEvent.includes("upper")) ||
          (currentEvent.includes("lower") &&
            neighborEvent.includes("through")) ||
          (currentEvent.includes("through") &&
            neighborEvent.includes("upper")) ||
          (currentEvent.includes("through") &&
            neighborEvent.includes("through"))
        ) {
          //case deposition event between current and neighbor markers
          distanceMarkers -=
            neighborMarkerData.distance - currentMarkerData.distance;
        } else {
          const currName = this.getMarkerNameFromId(currentMarkerData.id);
          const neighborName = this.getMarkerNameFromId(neighborMarkerData.id);
          console.log(
            "LC detected start flag of deposition event but cnannot detect end flag." +
              currName +
              "==>" +
              neighborName
          );
        }
      }

      //apply erosion event
      if (neighborEvent.includes("downward_erosion")) {
        //case erosion event exist below current marker
        const idx =
          neighborMarkerData.event_data.indexOf("downward_erosion") / 2;
        const erosion_distance = neighborMarkerData.event_data[idx][1];
        distanceMarkers -= erosion_distance;
        console.log("Downward erosion detected:" + erosion_distance);
      }
      if (currentEvent.includes("upward_erosion")) {
        //case erosion event exist below current marker
        const idx = currentMarkerData.event_data.indexOf("upward_erosion") / 2;
        const erosion_distance = currentMarkerData.event_data[idx][1];
        distanceMarkers -= erosion_distance;
        console.log("Upwnward erosion detected:" + erosion_distance);
      }
    }
    return distanceMarkers;
  }
  getMarkerNameFromId(id) {
    const idx = this.getIdxById(id);
    const holeName = this.projectData.holes[idx[1]].name;
    const secName = this.projectData.holes[idx[1]].sections[idx[2]].name;
    const markerName =
      this.projectData.holes[idx[1]].sections[idx[2]].markers[idx[4]].name;
    const output = "[" + holeName + "-" + secName + "-" + markerName + "]";
    return output;
  }
}