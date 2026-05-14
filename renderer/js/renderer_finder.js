document.addEventListener("DOMContentLoaded", () => {
  let isFix = true;
  let isLink = true;
  let isCalledFinder = false;
  let numCalled = 0;
  let projectList = [];
  let holeList = [];
  let sectionList = [];
  let inputDistance = null;
  let targetId = [null, null, null, null];
  let preserveTargetIdOnNextDistanceChange = false;
  let resourceData ={};
  let previousValue = {project:null,hole:null,section:null,distance:null,cd:null,efd:null,age:null,ageUpper:null,ageLower:null};
  let bookmarks = {};
  bookmarks["Please select"] = {holeName: null, holeId: null, sectionName:null, sectionId:null, distance:null};
  let settings = {enableRealtimeUpdate: false};
  let isLimitDistanceEnable = false;
  let displayPrecision = {
    position: 1,
    cd: 1,
    efd: 1,
    age: 0,
  };

  function formatFinderValue(value, precisionKey) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "";
    }
    return numericValue.toFixed(displayPrecision[precisionKey]);
  }

  function formatPositionValue(value) {
    return formatFinderValue(value, "position");
  }

  function formatCdValue(value) {
    return formatFinderValue(value, "cd");
  }

  function formatEfdValue(value) {
    return formatFinderValue(value, "efd");
  }

  function formatAgeValue(value) {
    return formatFinderValue(value, "age");
  }

  function refreshDisplayedPrecision() {
    const precisionTargets = {
      distanceInput: "position",
      cdInput: "cd",
      efdInput: "efd",
      ageInput: "age",
      ageUpperInput: "age",
      ageLowerInput: "age",
    };
    Object.entries(precisionTargets).forEach(([inputId, precisionKey]) => {
      const input = document.getElementById(inputId);
      if (input && input.value !== "") {
        input.value = formatFinderValue(input.value, precisionKey);
      }
    });
  }

  function resetTargetIdForDistanceChange() {
    if (preserveTargetIdOnNextDistanceChange) {
      preserveTargetIdOnNextDistanceChange = false;
      return;
    }

    targetId = [null, null, null, null];
  }

  function idMatches(actualId, expectedId, depth) {
    if (!Array.isArray(actualId) || !Array.isArray(expectedId)) {
      return false;
    }

    for (let i = 0; i < depth; i++) {
      if (actualId[i] !== expectedId[i]) {
        return false;
      }
    }

    return true;
  }

  async function selectFinderLocationFromDepthResult(calcedData, fallbackData) {
    const resultHoleId = calcedData?.hole_id;
    const resultSectionId = calcedData?.section_id;
    const fallbackHoleId =
      fallbackData?.project != null && fallbackData?.hole != null
        ? [fallbackData.project, fallbackData.hole, null, null]
        : null;
    const fallbackSectionId =
      fallbackData?.project != null && fallbackData?.hole != null && fallbackData?.section != null
        ? [fallbackData.project, fallbackData.hole, fallbackData.section, null]
        : null;

    let selectedHoleValue = null;
    for (const hole of holeList) {
      const holeId = hole[1];
      const sameResultId = idMatches(holeId, resultHoleId, 2);
      const sameFallbackId = idMatches(holeId, fallbackHoleId, 2);
      const sameName = calcedData?.hole != null && hole[2] === calcedData.hole;

      if (sameResultId || sameFallbackId || sameName) {
        selectedHoleValue = hole[0];
        break;
      }
    }

    if (selectedHoleValue == null) {
      return false;
    }

    document.getElementById("holeOptions").value = selectedHoleValue;
    await updateSectionList();

    let selectedSectionValue = null;
    const currentSections = sectionList[selectedHoleValue] ?? [];
    for (const section of currentSections) {
      const sectionId = section[1];
      const sameResultId = idMatches(sectionId, resultSectionId, 3);
      const sameFallbackId = idMatches(sectionId, fallbackSectionId, 3);
      const sameName = calcedData?.section != null && section[2] === calcedData.section;

      if (sameResultId || sameFallbackId || sameName) {
        selectedSectionValue = section[0];
        break;
      }
    }

    if (selectedSectionValue != null) {
      document.getElementById("sectionOptions").value = selectedSectionValue;
      return true;
    }

    return false;
  }

  function resolveDrillingDepthClickTarget(data) {
    if (
      data?.depth_scale !== "drilling_depth" ||
      data.project == null ||
      data.hole == null ||
      data.section != null
    ) {
      return data;
    }

    const clickedDepth = Number(data.y);
    if (!Number.isFinite(clickedDepth)) {
      return data;
    }

    const selectedHole = holeList.find((hole) => {
      const holeId = hole[1];
      return holeId?.[0] === data.project && holeId?.[1] === data.hole;
    });

    if (!selectedHole) {
      return data;
    }

    const sections = sectionList[selectedHole[0]] ?? [];
    let selectedSection = null;
    let nearestDistance = Infinity;

    for (const section of sections) {
      const markers = section[5] ?? [];
      const topDepth = Number(markers[0]?.drilling_depth);
      const bottomDepth = Number(markers[markers.length - 1]?.drilling_depth);
      if (!Number.isFinite(topDepth) || !Number.isFinite(bottomDepth)) {
        continue;
      }

      const sectionTop = Math.min(topDepth, bottomDepth);
      const sectionBottom = Math.max(topDepth, bottomDepth);

      if (clickedDepth >= sectionTop && clickedDepth <= sectionBottom) {
        selectedSection = section;
        break;
      }

      const distanceToSection = Math.min(
        Math.abs(clickedDepth - sectionTop),
        Math.abs(clickedDepth - sectionBottom)
      );

      if (distanceToSection < nearestDistance) {
        nearestDistance = distanceToSection;
        selectedSection = section;
      }
    }

    if (!selectedSection) {
      return data;
    }

    return {
      ...data,
      section: selectedSection[1]?.[2] ?? data.section,
      sectionIdx: selectedSection[0],
    };
  }

  function applyDepthFromMainInput(inputId, value, precisionFormatter) {
    document.getElementById(inputId).value = precisionFormatter(value);
    const eventName = settings.enableRealtimeUpdate ? "input" : "change";
    document.getElementById(inputId).dispatchEvent(new Event(eventName));
  }
  //-------------------------------------------------------------------------------------------
  //when startup
  window.FinderApi.receive("FinderToolClicked", async () => {
    window.FinderApi.rendererLog("[Finder]: Finder started.");

    isInitialCall = true;
    await getList();
    await updateHoleList();
    await updateSectionList();
    await limitDistance(isLimitDistanceEnable);

    //load tool icon images
    resourceData = await window.FinderApi.GetResources();
    document.getElementById("link").querySelector("img").src = resourceData.finder["linked"];
    document.getElementById("fix").querySelector("img").src = resourceData.finder["fixed"];

    previousValue = {
      project:null,
      hole:document.getElementById("holeOptions").value,
      section:document.getElementById("sectionOptions").value,
      distance:document.getElementById("distanceInput").value,
      cd:document.getElementById("ddInput").value,
      cd:document.getElementById("cdInput").value,
      efd:document.getElementById("efdInput").value,
      age:document.getElementById("ageInput").value,
      ageUpper:document.getElementById("ageUpperInput").value,
      ageLower:document.getElementById("ageLowerInput").value
    };

    //get current position
    await window.FinderApi.requestCurrentPosition();

  });
  window.FinderApi.receive("Bookmarks", async (bookmarkData) => {
    window.FinderApi.rendererLog("[Finder]: Finder received bookmarks.");

    if(bookmarkData !== null){
      bookmarks = bookmarkData;
      //clear
      var parentElement = document.getElementById("bookmarksOptions");
      while (parentElement.firstChild) {
        parentElement.removeChild(parentElement.firstChild);
      }

      //update
      for (const key in bookmarks) {
        const option = document.createElement("option");
        option.textContent = key; //name
        //option.value       = holeList[i][0]; //idx
        //option.id          = holeList[i][1]; //id
        document.getElementById("bookmarksOptions").appendChild(option);
      }
    }
  });

  
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  //distance
  document.getElementById("distanceInput").addEventListener("change", async (event) => {
    if(settings.enableRealtimeUpdate) return;

    //calc
    const secLimitDists = await limitDistance(isLimitDistanceEnable);
    if(parseFloat(event.target.value) > document.getElementById("distanceInput").max){
      document.getElementById("distanceInput").value = document.getElementById("distanceInput").max;
    }
    if(parseFloat(event.target.value) < document.getElementById("distanceInput").min){
      document.getElementById("distanceInput").value = document.getElementById("distanceInput").min;
    }

    //change color
    if(document.getElementById("distanceInput").value<secLimitDists[0] || document.getElementById("distanceInput").value>secLimitDists[1]){
      document.getElementById("distanceInput").style.color = "red";
    }else{
      document.getElementById("distanceInput").style.color = "black";
    }
    
    await window.FinderApi.rendererLog(`[Finder]: Distance is changed to : ${event.target.value} cm`);
    
    isCalledFinder = true;
    resetTargetIdForDistanceChange();
    await calc("trinity");
  });
  document.getElementById("distanceInput").addEventListener("input", async (event) => {
    if(!settings.enableRealtimeUpdate) return;

    //calc
    const secLimitDists = await limitDistance(isLimitDistanceEnable);
    if(parseFloat(event.target.value) > document.getElementById("distanceInput").max){
      document.getElementById("distanceInput").value = document.getElementById("distanceInput").max;
    }
    if(parseFloat(event.target.value) < document.getElementById("distanceInput").min){
      document.getElementById("distanceInput").value = document.getElementById("distanceInput").min;
    }
    //change color
    if(document.getElementById("distanceInput").value<secLimitDists[0] || document.getElementById("distanceInput").value>secLimitDists[1]){
      document.getElementById("distanceInput").style.color = "red";
    }else{
      document.getElementById("distanceInput").style.color = "black";
    }
    await window.FinderApi.rendererLog(`[Finder]: Distance is changed to : ${event.target.value} cm`);
    
    isCalledFinder = true;
    resetTargetIdForDistanceChange();
    await calc("trinity");
  });
  //-------------------------------------------------------------------------------------------
  //hole
  document.getElementById("holeOptions").addEventListener("change", async (event) => {
    //display
    await window.FinderApi.rendererLog(`[Finder]: Hole is changed to : ${event.target.value}.`);

    //calc, fixed CD
    isCalledFinder = true;
    const newHoleData = holeList[document.getElementById("holeOptions").value][1];
    targetId = newHoleData;
    await updateSectionList();
    await calc("trinity");
    const secLimitDists = await limitDistance(isLimitDistanceEnable);
    //change color
    if(document.getElementById("distanceInput").value<secLimitDists[0] || document.getElementById("distanceInput").value>secLimitDists[1]){
      document.getElementById("distanceInput").style.color = "red";
    }else{
      document.getElementById("distanceInput").style.color = "black";
    }
    //change sec list
  });
  //-------------------------------------------------------------------------------------------
  //section
  document.getElementById("sectionOptions").addEventListener("change", async (event) => {
      //change distance max/min
      document.getElementById("distanceInput").max = 100;
      //calc
      await window.FinderApi.rendererLog(`[Finder]: Section is changed to : ${event.target.value}.`);
      
      isCalledFinder = true;
      targetId = [null,null,null,null];
      await calc("trinity");
      const secLimitDists = await limitDistance(isLimitDistanceEnable);
      //change color
      if(document.getElementById("distanceInput").value<secLimitDists[0] || document.getElementById("distanceInput").value>secLimitDists[1]){
        document.getElementById("distanceInput").style.color = "red";
      }else{
        document.getElementById("distanceInput").style.color = "black";
      }
    });
    //-------------------------------------------------------------------------------------------
  //dd
  document.getElementById("ddInput").addEventListener("change", async (event) => {
    if(settings.enableRealtimeUpdate) return;
    //calc
    await window.FinderApi.rendererLog(`[Finder]: DD is changed to : ${event.target.value} cm`);

    isCalledFinder = true;
    await calc("drilling_depth");
  });
  document.getElementById("ddInput").addEventListener("input", async (event) => {
    if(!settings.enableRealtimeUpdate) return;
    //calc
    await window.FinderApi.rendererLog(`[Finder]: DD is changed to : ${event.target.value} cm`);

    isCalledFinder = true;
    await calc("drilling_depth");
  });
  //-------------------------------------------------------------------------------------------
  //cd
  document.getElementById("cdInput").addEventListener("change", async (event) => {
    if(settings.enableRealtimeUpdate) return;
    //calc
    await window.FinderApi.rendererLog(`[Finder]: CD is changed to : ${event.target.value} cm`);

    isCalledFinder = true;
    await calc("composite_depth");
  });
  document.getElementById("cdInput").addEventListener("input", async (event) => {
    if(!settings.enableRealtimeUpdate) return;
    //calc
    await window.FinderApi.rendererLog(`[Finder]: CD is changed to : ${event.target.value} cm`);

    isCalledFinder = true;
    await calc("composite_depth");
  });
  //-------------------------------------------------------------------------------------------
  //efd
  document.getElementById("efdInput").addEventListener("change", async (event) => {
    if(settings.enableRealtimeUpdate) return;  
    //calc
    await window.FinderApi.rendererLog(`[Finder]: EFD is changed to : ${event.target.value} cm`);

    isCalledFinder = true;
    await calc("event_free_depth");
  });
  document.getElementById("efdInput").addEventListener("input", async (event) => {
    if(!settings.enableRealtimeUpdate) return;  
    //calc
    await window.FinderApi.rendererLog(`[Finder]: EFD is changed to : ${event.target.value} cm`);

    isCalledFinder = true;
    await calc("event_free_depth");
  });
  //-------------------------------------------------------------------------------------------
  //age
  document.getElementById("ageInput").addEventListener("change", async (event) => {
    if(settings.enableRealtimeUpdate) return;  
    //calc
    await window.FinderApi.rendererLog(`[Finder]: Age is changed to : ${event.target.value} calBP`);

    isCalledFinder = true;
    await calc("age");
  });
  document.getElementById("ageInput").addEventListener("input", async (event) => {
    if(!settings.enableRealtimeUpdate) return;  
    //calc
    await window.FinderApi.rendererLog(`[Finder]: Age is changed to : ${event.target.value} calBP`);

    isCalledFinder = true;
    await calc("age");
  });
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  async function limitDistance(limit=true) {

    const holeName = holeList[document.getElementById("holeOptions").value][2];
    const sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
    const sectionId = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value];

    const secLimit = await window.FinderApi.getSectionLimit({
      projectId: [sectionId[1][0], null, null, null],
      holeName,
      sectionName,
    });

    if(!limit){
      document.getElementById("distanceInput").max = Infinity;
      document.getElementById("distanceInput").min = -Infinity;
    }else{
      document.getElementById("distanceInput").max = parseFloat(secLimit[1]);
      document.getElementById("distanceInput").min = parseFloat(secLimit[0]);
    }     
    return secLimit; 
  }
  //-------------------------------------------------------------------------------------------
  async function getList() {
    //get hole list
    //[p, project.id, project.name]
    //[nh, hole.id, hole.name] nh:total idex
    //[s,section.id,section.name,section.markers[0].distance,section.markers[section.markers.length - 1].distance, section.markers ]
    [projectList, holeList, sectionList] = await window.FinderApi.finderGetCoreList();
  }
  //-------------------------------------------------------------------------------------------
  async function updateHoleList() {
    //clear
    var parentElement = document.getElementById("holeOptions");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }

    //mount data into dropdown list
    if (holeList.length !== 0) {
      for (let i = 0; i < holeList.length; i++) {
        const option = document.createElement("option");
        option.textContent = holeList[i][2]; //name
        option.value       = holeList[i][0]; //idx
        option.id          = holeList[i][1]; //id

        document.getElementById("holeOptions").appendChild(option);
      }
    }
  }
  //-------------------------------------------------------------------------------------------
  async function updateSectionList() {
    //clear
    var parentElement = document.getElementById("sectionOptions");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }

    const selectedHole = document.getElementById("holeOptions").value;
    //mout date into dropdown list
    if (sectionList.length !== 0) {
      const sortedList = sectionList[selectedHole].slice().sort((a, b) => {
        return a[2].localeCompare(b[2]); // sort by name
      });

      for (let i = 0; i < sortedList.length; i++) {
        const option = document.createElement("option");
        option.textContent = sortedList[i][2]; //name
        option.value       = sortedList[i][0]; //idx
        option.id          = sortedList[i][1]; //id

        document.getElementById("sectionOptions").appendChild(option);
      }
    }
  }
  //-------------------------------------------------------------------------------------------
  async function calc(...args) {
    let calcType = args[0];
    const alterType = "extrapolation";

    //calc depth from calcType
    let calcedData = {};
    if (calcType == "trinity") {
      //get trinity data
      let holeName    = holeList[document.getElementById("holeOptions").value][2];
      let sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
      const distance  = parseFloat(document.getElementById("distanceInput").value);
      let sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
      const cd        = parseFloat(document.getElementById("cdInput").value);

      //calc
      if(targetId[1] == null){
        console.log("Finder: Target hole is already selected.")
        //case changed section and distance
        await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
        const options = {
          sourceType: "trinity",
          polationType: "linear",  
          allowOutside: alterType=="extrapolation" ? true : false,          
        };

        calcedData = await window.FinderApi.depthConverter({
          dataList: [["", ["", holeName, sectionName, distance], targetId]],
          options,
        });
        await window.FinderApi.rendererLog(calcedData);
        //apply
        document.getElementById("ddInput").value        = formatPositionValue(calcedData.dd);
        document.getElementById("cdInput").value        = formatCdValue(calcedData.cd);
        document.getElementById("efdInput").value       = formatEfdValue(calcedData.efd);
        document.getElementById("ageInput").value       = formatAgeValue(calcedData.age_mid);
        document.getElementById("ageUpperInput").value  = formatAgeValue(calcedData.age_upper);
        document.getElementById("ageLowerInput").value  = formatAgeValue(calcedData.age_lower);
      } else {
        console.log("Finder: A new target hole has been selected.")
        //case changed hole
        //try to find same CD in selected hole
        const options = {
          sourceType: "composite_depth",
          polationType: "linear",  
          allowOutside: alterType=="extrapolation" ? true : false,
        };

        if(alterType=="extrapolation"){
          console.log("Finder: Extrapolation is on")
          //get trinity data
          //const holeName    = holeList[document.getElementById("holeOptions").value][2];
          //const sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
          //const sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
          console.log(targetId, holeName, sectionName)
          //targetId = sectionId;
        }else{
          console.log("Finder: Extrapolation is off")
          
        }

        calcedData = await window.FinderApi.depthConverter({
          dataList: [["", cd, targetId]],
          options,
        });
        console.log(calcedData)
        //await window.FinderApi.rendererLog(calcedData); 
        if(calcedData.hole == holeName){
          //if selected hole exist
          let hole_idx = null;
          let selected_hole_id = null;
          for(let h=0; h<holeList.length;h++){
            const hole = holeList[h];
            if (hole[2] == calcedData.hole) {
              hole_idx = h;
              selected_hole_id = hole[0];
            }
          }
          
          let sec_idx = null;
          let selected_sec_id = null;
          for(let s=0;s<sectionList[hole_idx].length;s++){
            const sec = sectionList[hole_idx][s];
            if (sec[2] == calcedData.section) {
              
              sec_idx = s;
              selected_sec_id = sec[0];
            }
          }
  
          //apply
          document.getElementById("holeOptions").value = selected_hole_id;
          updateSectionList();
          document.getElementById("sectionOptions").value = selected_sec_id;
          document.getElementById("distanceInput").value  = isNaN(calcedData.distance) ? "" : formatPositionValue(calcedData.distance);
          document.getElementById("ddInput").value        = formatPositionValue(calcedData.dd);
          document.getElementById("cdInput").value        = formatCdValue(calcedData.cd);
          document.getElementById("efdInput").value       = formatEfdValue(calcedData.efd);
          document.getElementById("ageInput").value       = formatAgeValue(calcedData.age_mid);
          document.getElementById("ageUpperInput").value  = formatAgeValue(calcedData.age_upper);
          document.getElementById("ageLowerInput").value  = formatAgeValue(calcedData.age_lower);
        } else {
          console.log("Finder: Replace trinity")
          //if selected hole is not exist
          //await window.FinderApi.rendererLog(previousValue); 

          //apply
          if(alterType == "top"){
            holeName    = holeList[document.getElementById("holeOptions").value][2];
            sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
            sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
            const secLimit = await window.FinderApi.getSectionLimit({
              projectId: [sectionId[0], null, null, null],
              holeName,
              sectionName,
            });
            const topDistance    = secLimit[0];

            //calc
            await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
            const options = {
              sourceType: "trinity",
              polationType: "linear",  
              allowOutside: false
            };
            calcedData = await window.FinderApi.depthConverter({
              dataList: [["", ["", holeName, sectionName, topDistance], targetId]],
              options,
            });
            await window.FinderApi.rendererLog(calcedData);
            //apply
            document.getElementById("distanceInput").value  = isNaN(calcedData.distance) ? "" : formatPositionValue(calcedData.distance);
            document.getElementById("ddInput").value        = formatPositionValue(calcedData.dd);
            document.getElementById("cdInput").value        = formatCdValue(calcedData.cd);
            document.getElementById("efdInput").value       = formatEfdValue(calcedData.efd);
            document.getElementById("ageInput").value       = formatAgeValue(calcedData.age_mid);
            document.getElementById("ageUpperInput").value  = formatAgeValue(calcedData.age_upper);
            document.getElementById("ageLowerInput").value  = formatAgeValue(calcedData.age_lower);

          }else if(alterType == "bottom"){
            holeName    = holeList[document.getElementById("holeOptions").value][2];
            sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
            sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
            const secLimit = await window.FinderApi.getSectionLimit({
              projectId: [sectionId[0], null, null, null],
              holeName,
              sectionName,
            });
            const topDistance    = secLimit[1];

            //calc
            await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
            const options = {
              sourceType: "trinity",
              polationType: "linear",  
              allowOutside: false
            };
            calcedData = await window.FinderApi.depthConverter({
              dataList: [["", ["", holeName, sectionName, topDistance], targetId]],
              options,
            });
            await window.FinderApi.rendererLog(calcedData);
            //apply
            document.getElementById("ddInput").value        = formatPositionValue(calcedData.dd);
            document.getElementById("cdInput").value        = formatCdValue(calcedData.cd);
            document.getElementById("efdInput").value       = formatEfdValue(calcedData.efd);
            document.getElementById("ageInput").value       = formatAgeValue(calcedData.age_mid);
            document.getElementById("ageUpperInput").value  = formatAgeValue(calcedData.age_upper);
            document.getElementById("ageLowerInput").value  = formatAgeValue(calcedData.age_lower);

          }if(alterType == "centre"){
            holeName    = holeList[document.getElementById("holeOptions").value][2];
            sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
            sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
            const secLimit = await window.FinderApi.getSectionLimit({
              projectId: [sectionId[0], null, null, null],
              holeName,
              sectionName,
            });
            const topDistance    = (secLimit[0] + secLimit[1]) / 2;

            //calc
            await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
            const options = {
              sourceType: "trinity",
              polationType: "linear",  
              allowOutside: false
            };
            calcedData = await window.FinderApi.depthConverter({
              dataList: [["", ["", holeName, sectionName, topDistance], targetId]],
              options,
            });
            await window.FinderApi.rendererLog(calcedData);
            //apply
            document.getElementById("ddInput").value        = formatPositionValue(calcedData.dd);
            document.getElementById("cdInput").value        = formatCdValue(calcedData.cd);
            document.getElementById("efdInput").value       = formatEfdValue(calcedData.efd);
            document.getElementById("ageInput").value       = formatAgeValue(calcedData.age_mid);
            document.getElementById("ageUpperInput").value  = formatAgeValue(calcedData.age_upper);
            document.getElementById("ageLowerInput").value  = formatAgeValue(calcedData.age_lower);

          }else if(alterType == "none"){
            document.getElementById("holeOptions").value    = previousValue.hole;
            updateSectionList();
            document.getElementById("sectionOptions").value  = previousValue.section;  
          }
        }
      }
            
    } else if (calcType == "composite_depth") {
      //get cd
      let cd = parseFloat(document.getElementById("cdInput").value);

      //calc 
      const options = {
        sourceType: "composite_depth",
        polationType: "linear",  
        allowOutside: false
      };

      if(alterType=="extrapolation" && targetId[2]===null){
        const sectionId   = sectionList[previousValue.hole][previousValue.section][1]; 
        //targetId = sectionId;//extraplate same section
        targetId = [sectionId[0],sectionId[1],null,null];//extrapolate nearest section
      }
      
      calcedData = await window.FinderApi.depthConverter({
        dataList: [["finder_from_cd", cd, targetId]],
        options,
      });
      //window.FinderApi.rendererLog(calcedData);

      await selectFinderLocationFromDepthResult(calcedData);

      document.getElementById("distanceInput").value = isNaN(calcedData.distance) ? "" : formatPositionValue(calcedData.distance);
      document.getElementById("ddInput").value       = isNaN(calcedData.dd) ? "": formatPositionValue(calcedData.dd);
      document.getElementById("efdInput").value      = isNaN(calcedData.efd) ? "" : formatEfdValue(calcedData.efd);
      document.getElementById("ageInput").value      = isNaN(calcedData.age_mid) ? "" : formatAgeValue(calcedData.age_mid);
      document.getElementById("ageUpperInput").value = isNaN(calcedData.age_upper) ? "" : formatAgeValue(calcedData.age_upper);
      document.getElementById("ageLowerInput").value = isNaN(calcedData.age_lower) ? "" : formatAgeValue(calcedData.age_lower);
    
    } else if (calcType == "event_free_depth") {
      //get efd
      let efd = parseFloat(document.getElementById("efdInput").value);

      //calc
      const options = {
        sourceType: "event_free_depth",
        polationType: "linear",  
        allowOutside: false
      };
      if(alterType=="extrapolation" && targetId[2]===null){
        const sectionId   = sectionList[previousValue.hole][previousValue.section][1]; 
        //targetId = sectionId;//extraplate same section
        targetId = [sectionId[0],sectionId[1],null,null];//extrapolate nearest section
      }
      calcedData = await window.FinderApi.depthConverter({
        dataList: [["finder_from_efd", efd, targetId]],
        options,
      });
      //await window.FinderApi.rendererLog(calcedData);

      await selectFinderLocationFromDepthResult(calcedData);

      document.getElementById("distanceInput").value = isNaN(calcedData.distance) ? "" : formatPositionValue(calcedData.distance);
      document.getElementById("ddInput").value       = isNaN(calcedData.dd) ? "" : formatPositionValue(calcedData.dd);
      document.getElementById("cdInput").value       = isNaN(calcedData.cd) ? "" : formatCdValue(calcedData.cd);
      document.getElementById("ageInput").value      = isNaN(calcedData.age_mid) ? "" : formatAgeValue(calcedData.age_mid);
      document.getElementById("ageUpperInput").value = isNaN(calcedData.age_upper) ? "" : formatAgeValue(calcedData.age_upper);
      document.getElementById("ageLowerInput").value = isNaN(calcedData.age_lower) ? "" : formatAgeValue(calcedData.age_lower);
    } else if (calcType == "age") {
      let age = parseFloat(document.getElementById("ageInput").value);

      //calc
      const options = {
        sourceType: "age",
        polationType: "linear",  
        allowOutside: false
      };
      if(alterType=="extrapolation" && targetId[2]===null){
        const sectionId   = sectionList[previousValue.hole][previousValue.section][1]; 
        //targetId = sectionId;//extraplate same section
        targetId = [sectionId[0],sectionId[1],null,null];//extrapolate nearest section
      }
      calcedData = await window.FinderApi.depthConverter({
        dataList: [["", age, targetId]],
        options,
      });
      await window.FinderApi.rendererLog(calcedData);

      await selectFinderLocationFromDepthResult(calcedData);

      document.getElementById("distanceInput").value = isNaN(calcedData.distance) ? "" : formatPositionValue(calcedData.distance);
      document.getElementById("ddInput").value       = isNaN(calcedData.dd) ? "" : formatPositionValue(calcedData.dd);
      document.getElementById("efdInput").value      = isNaN(calcedData.efd) ? "" : formatEfdValue(calcedData.efd);
      document.getElementById("cdInput").value       = isNaN(calcedData.cd) ? "" : formatCdValue(calcedData.cd);
      document.getElementById("ageInput").value      = isNaN(calcedData.age_mid) ? "" : formatAgeValue(calcedData.age_mid);
      document.getElementById("ageUpperInput").value = isNaN(calcedData.age_upper) ? "" : formatAgeValue(calcedData.age_upper);
      document.getElementById("ageLowerInput").value = isNaN(calcedData.age_lower) ? "" : formatAgeValue(calcedData.age_lower);
    }

    const secLimitDists = await limitDistance(isLimitDistanceEnable);
    //change color
    if(document.getElementById("distanceInput").value<secLimitDists[0] || document.getElementById("distanceInput").value>secLimitDists[1]){
      document.getElementById("distanceInput").style.color = "red";
    }else{
      document.getElementById("distanceInput").style.color = "black";
    }

    //move position
    if (isCalledFinder) {
      document.getElementById("Options");
      const send_data = {
        isMove: isLink,
        source: calcType,
        trinity:{
          holeName:holeList[document.getElementById("holeOptions").value][2],
          holeIdx:parseInt(document.getElementById("holeOptions").value), 
          holeId:holeList[document.getElementById("holeOptions").value][1],
          sectionName:sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2], 
          sectionIdx:parseInt(document.getElementById("sectionOptions").value), 
          sectionId:sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1],
          distance:parseFloat(document.getElementById("distanceInput").value)
        },
        drilling_depth:calcedData.dd,
        composite_depth: calcedData.cd,
        event_free_depth: calcedData.efd,
        age: calcedData.age_mid,
      };

      await window.FinderApi.MoveToHorizon({ data: send_data });
    }

    //update
    previousValue = {
      project:null,
      hole:document.getElementById("holeOptions").value,
      section:document.getElementById("sectionOptions").value,
      distance:document.getElementById("distanceInput").value,
      dd:document.getElementById("ddInput").value,
      cd:document.getElementById("cdInput").value,
      efd:document.getElementById("efdInput").value,
      age:document.getElementById("ageInput").value,
      ageUpper:document.getElementById("ageUpperInput").value,
      ageLower:document.getElementById("ageLowerInput").value
    };

    numCalled++;
  }

  //-------------------------------------------------------------------------------------------

  document.getElementById("fix").addEventListener("click", async (event) => {
    if (isFix) {
      isFix = false;
      //document.getElementById("fix").style.backgroundColor = "white";
      document.getElementById("fix").querySelector("img").src = resourceData.finder["fix"];
    } else {
      isFix = true;
      //document.getElementById("fix").style.backgroundColor = "lightgray";
      document.getElementById("fix").querySelector("img").src = resourceData.finder["fixed"];
    }
    window.FinderApi.changeFix({ isFix });
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("link").addEventListener("click", async (event) => {
    if (isLink) {
      isLink = false;
      //document.getElementById("fix").style.backgroundColor = "white";
      document.getElementById("link").querySelector("img").src = resourceData.finder["link"];
    } else {
      isLink = true;
      //document.getElementById("fix").style.backgroundColor = "lightgray";
      document.getElementById("link").querySelector("img").src = resourceData.finder["linked"];

      //move to target
      const send_data = {
        isMove: isLink,
        source: "composite_depth",
        trinity:{
          holeName:holeList[document.getElementById("holeOptions").value][2],
          holeIdx:parseInt(document.getElementById("holeOptions").value), 
          holeId:holeList[document.getElementById("holeOptions").value][1],
          sectionName:sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2], 
          sectionIdx:parseInt(document.getElementById("sectionOptions").value), 
          sectionId:sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1],
          distance:parseFloat(document.getElementById("distanceInput").value)
        },
        drilling_depth: parseFloat(formatPositionValue(document.getElementById("ddInput").value)),
        composite_depth:  parseFloat(formatCdValue(document.getElementById("cdInput").value)),
        event_free_depth: parseFloat(formatEfdValue(document.getElementById("efdInput").value)),
        age: parseFloat(formatAgeValue(document.getElementById("ageInput").value)),
      };
      await window.FinderApi.MoveToHorizon({ data: send_data });
        
    }
  });
  //-------------------------------------------------------------------------------------------
  //update depth from main renderer
  window.FinderApi.receive("SendDepthFromMain", async (data) => {
    if (isLink) {
      //if recieved data from main process
      //data: {x:x, y:y, depth_scale:objOpts.canvas.depth_scale, project:null, hole:null, section:null, distance:null, nearest_marker: null, nearest_distance:null};
      await window.FinderApi.rendererLog("[Finder]: Recieved data from renderer.");
      targetId = [data.project, data.hole, data.section, null]; // update target section

      //input value
      if (data.depth_scale == "composite_depth") {
        applyDepthFromMainInput("cdInput", data.y, formatCdValue);
      } else if (data.depth_scale == "event_free_depth") {
        applyDepthFromMainInput("efdInput", data.y, formatEfdValue);
      } else if (data.depth_scale == "age") {
        applyDepthFromMainInput("ageInput", data.y, formatAgeValue);
      } else if (data.depth_scale == "drilling_depth"){
        const resolvedData = resolveDrillingDepthClickTarget(data);

        const options = {
          sourceType: "drilling_depth",
          polationType: "linear",  
          allowOutside: false
        };

        const calcedData = await window.FinderApi.depthConverter({
          dataList: [["finder_from_dd", resolvedData.y, [resolvedData.project, resolvedData.hole, resolvedData.section, null]]],
          options,
        });

        await selectFinderLocationFromDepthResult(calcedData, resolvedData);

        document.getElementById("distanceInput").value = isNaN(calcedData.distance) ? "" : formatPositionValue(calcedData.distance);
        document.getElementById("ddInput").value       = isNaN(calcedData.dd) ? "" : formatPositionValue(calcedData.dd);
        document.getElementById("cdInput").value       = isNaN(calcedData.cd) ? "" : formatCdValue(calcedData.cd);
        document.getElementById("efdInput").value      = isNaN(calcedData.efd) ? "" : formatEfdValue(calcedData.efd);
        document.getElementById("ageInput").value      = isNaN(calcedData.age_mid) ? "" : formatAgeValue(calcedData.age_mid);
        document.getElementById("ageUpperInput").value = isNaN(calcedData.age_upper) ? "" : formatAgeValue(calcedData.age_upper);
        document.getElementById("ageLowerInput").value = isNaN(calcedData.age_lower) ? "" : formatAgeValue(calcedData.age_lower);
        
        const secLimitDists = await limitDistance(isLimitDistanceEnable);  
        //change color
        if(document.getElementById("distanceInput").value<secLimitDists[0] || document.getElementById("distanceInput").value>secLimitDists[1]){
          document.getElementById("distanceInput").style.color = "red";
        }else{
          document.getElementById("distanceInput").style.color = "black";
        } 

        const send_data = {
          isMove: isLink,
          source: "drilling_depth",
          trinity:{
            holeName:holeList[document.getElementById("holeOptions").value][2],
            holeIdx:parseInt(document.getElementById("holeOptions").value),
            holeId:holeList[document.getElementById("holeOptions").value][1],
            sectionName:sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2],
            sectionIdx:parseInt(document.getElementById("sectionOptions").value),
            sectionId:sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1],
            distance:parseFloat(document.getElementById("distanceInput").value)
          },
          drilling_depth: calcedData.dd,
          composite_depth: calcedData.cd,
          event_free_depth: calcedData.efd,
          age: calcedData.age_mid,
        };
        await window.FinderApi.MoveToHorizon({ data: send_data });

        previousValue = {
          project:null,
          hole:document.getElementById("holeOptions").value,
          section:document.getElementById("sectionOptions").value,
          distance:document.getElementById("distanceInput").value,
          dd:document.getElementById("ddInput").value,
          cd:document.getElementById("cdInput").value,
          efd:document.getElementById("efdInput").value,
          age:document.getElementById("ageInput").value,
          ageUpper:document.getElementById("ageUpperInput").value,
          ageLower:document.getElementById("ageLowerInput").value
        };
      }
      
      
    }
  });

  //-------------------------------------------------------------------------------------------
  window.FinderApi.receive("updateModeChanged", async (data) => {
    settings.enableRealtimeUpdate = data;
    console.log("Finder: update mode is changed to ", data)
  });

  window.FinderApi.receive("FinderPrecisionChanged", async (data) => {
    const precisionKey = data?.key;
    const parsedPrecision = Number.parseInt(data?.precision, 10);
    if (
      !Object.prototype.hasOwnProperty.call(displayPrecision, precisionKey) ||
      !Number.isInteger(parsedPrecision) ||
      parsedPrecision < 0
    ) {
      return;
    }
    displayPrecision[precisionKey] = parsedPrecision;
    refreshDisplayedPrecision();
    if (holeList.length > 0 && sectionList.length > 0) {
      const wasCalledFinder = isCalledFinder;
      isCalledFinder = false;
      await calc("trinity");
      isCalledFinder = wasCalledFinder;
    }
  });
  
  //-------------------------------------------------------------------------------------------

  document.getElementById("add_bookmark").addEventListener("click", async (event) => {
    const holeNameCurrent = holeList[document.getElementById("holeOptions").value][2];
    const holeIdCurrent   = holeList[document.getElementById("holeOptions").value][1];
    const sectionNameCurrent = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
    const sectionIdCurrent   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
    const distanceCUrrent = document.getElementById("distanceInput").value;

    const numBookmarks = Object.keys(bookmarks).length;
    const defName = `Bookmark${String(numBookmarks).padStart(2, '0')}`;

    const askData = {
      title:"Bookmark name",
      label:"Please enter new bookmark name.",
      value:defName,
      type:"text",
    };

      response = await window.FinderApi.inputdialog(askData);
      if(response !==null){
        bookmarks[response] = {holeName: holeNameCurrent, holeId: holeIdCurrent, sectionName:sectionNameCurrent, sectionId:sectionIdCurrent, distance:distanceCUrrent};
        console.log("Finder: "+response+" is bookmarked.")

        //update list
        //clear
        var parentElement = document.getElementById("bookmarksOptions");
        while (parentElement.firstChild) {
          parentElement.removeChild(parentElement.firstChild);
        }

        //update        
        for (const key in bookmarks) {
          const option = document.createElement("option");
          option.textContent = key; //name
          //option.value       = holeList[i][0]; //idx
          //option.id          = holeList[i][1]; //id
          document.getElementById("bookmarksOptions").appendChild(option);
        }

        //save
        await window.FinderApi.saveBookmarks({ bookmarks });
      }
    
  });
  document.getElementById("delete_bookmark").addEventListener("click", async (event) => {
    const select = document.getElementById("bookmarksOptions").value;

    if(select == "Please select"){
      return
    }
    const response = await window.FinderApi.askdialog(
      {
        opts: {
          title:"Delete bookmark",
          message:"Are you sure you want to delete this bookmark?",
          parent:"finder"
        }
      }
    );

    if(response.response){
      //delete
      delete bookmarks[select];
      console.log("Finder: "+select+" is deleted.")
      //update list
      //clear
      var parentElement = document.getElementById("bookmarksOptions");
      while (parentElement.firstChild) {
        parentElement.removeChild(parentElement.firstChild);
      }

      //update
      for (const key in bookmarks) {
        const option = document.createElement("option");
        option.textContent = key; //name
        //option.value       = holeList[i][0]; //idx
        //option.id          = holeList[i][1]; //id
        document.getElementById("bookmarksOptions").appendChild(option);
      }

      //save
      await window.FinderApi.saveBookmarks({ bookmarks });
    }
  });
  document.getElementById("bookmarksOptions").addEventListener("change", async (event) => {
    console.log("Finder: "+event.target.value+" is selected.")
    console.log(bookmarks[event.target.value])
    console.log(holeList)


    //get hole index
    let hole_idx = null;
    let selected_hole_id = null;
    holeList.forEach((hole, h) => {
      if (hole[2] == bookmarks[event.target.value].holeName) {
        hole_idx = h;
        selected_hole_id = hole[0];
      }
    });

    if(selected_hole_id == null){
      return
    }

    //get section index
    let sec_idx = null;
    let selected_sec_id = null;
    sectionList[hole_idx].forEach((sec, s)=>{
      if (sec[2] == bookmarks[event.target.value].sectionName) {        
        sec_idx = s;
        selected_sec_id = sec[0];
      }
    })

    //change selections
    document.getElementById("holeOptions").value = selected_hole_id;
    await updateSectionList();
    document.getElementById("sectionOptions").value = selected_sec_id;
    document.getElementById("distanceInput").value  = isNaN(bookmarks[event.target.value].distance) ? "" : formatPositionValue(bookmarks[event.target.value].distance);
          

    //
    isCalledFinder = true;
    targetId = [null,null,null,null];
    
    await calc("trinity");
    const secLimitDists = await limitDistance(isLimitDistanceEnable);  
    //change color
    if(document.getElementById("distanceInput").value<secLimitDists[0] || document.getElementById("distanceInput").value>secLimitDists[1]){
      document.getElementById("distanceInput").style.color = "red";
    }else{
      document.getElementById("distanceInput").style.color = "black";
    }  
  });

  //-------------------------------------------------------------------------------------------
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
      window.FinderApi.toggleDevTools("finder");
    }
  });
  //-------------------------------------------------------------------------------------------
  window.__LC_FINDER_E2E__ = {
    isReady: () => true,
    getState: () => ({
      hole: document.getElementById("holeOptions").value,
      section: document.getElementById("sectionOptions").value,
      distance: document.getElementById("distanceInput").value,
      cd: document.getElementById("cdInput").value,
      efd: document.getElementById("efdInput").value,
      age: document.getElementById("ageInput").value,
      holeCount: document.getElementById("holeOptions").options.length,
      sectionCount: document.getElementById("sectionOptions").options.length,
    }),
    getCurrentSectionLimit: async () => {
      const holeIndex = document.getElementById("holeOptions").value;
      const sectionIndex = document.getElementById("sectionOptions").value;
      const holeName = holeList[holeIndex][2];
      const sectionName = sectionList[holeIndex][sectionIndex][2];
      const sectionId = sectionList[holeIndex][sectionIndex][1];
      const sectionLimit = await window.FinderApi.getSectionLimit({
        projectId: [sectionId[0], null, null, null],
        holeName,
        sectionName,
      });
      return {
        holeName,
        sectionName,
        sectionLimit,
      };
    },
  };
  //-------------------------------------------------------------------------------------------
});
