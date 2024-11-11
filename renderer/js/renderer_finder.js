document.addEventListener("DOMContentLoaded", () => {
  let isFix = true;
  let isLink = true;
  let isCalledFinder = false;
  let projectList = [];
  let holeList = [];
  let sectionList = [];
  let inputDistance = null;
  let targetId = [null, null, null, null];
  let resourcePaths ={};
  let previousValue = {project:null,hole:null,section:null,distance:null,cd:null,efd:null,age:null,ageUpper:null,ageLower:null};
  
  //-------------------------------------------------------------------------------------------
  //when startup
  window.FinderApi.receive("FinderToolClicked", async () => {
    window.FinderApi.rendererLog("[Finder]: Finder started.");

    await getList();
    await updateHoleList();
    await updateSectionList();
    await limitDistance();

    //load tool icon images
    resourcePaths = await window.FinderApi.getResourcePath();
    document.getElementById("link").querySelector("img").src = resourcePaths.finder["linked"];
    document.getElementById("fix").querySelector("img").src = resourcePaths.finder["fixed"];

    previousValue = {
      project:null,
      hole:document.getElementById("holeOptions").value,
      section:document.getElementById("sectionOptions").value,
      distance:document.getElementById("distanceInput").value,
      cd:document.getElementById("cdInput"),
      efd:document.getElementById("efdInput").value,
      age:document.getElementById("ageInput").value,
      ageUpper:document.getElementById("ageUpperInput").value,
      ageLower:document.getElementById("ageLowerInput").value
    };

  });

  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  //distance
  document.getElementById("distanceInput").addEventListener("change", async (event) => {
      //calc
      await limitDistance();
      if(parseFloat(event.target.value) > document.getElementById("distanceInput").max){
        document.getElementById("distanceInput").value = document.getElementById("distanceInput").max;
      }
      if(parseFloat(event.target.value) < document.getElementById("distanceInput").min){
        document.getElementById("distanceInput").value = document.getElementById("distanceInput").min;
      }
      await window.FinderApi.rendererLog(`[Finder]: Distance is changed to : ${event.target.value} cm`);
      
      isCalledFinder = true;
      targetId = [null,null,null,null];
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
    await limitDistance();
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
      await limitDistance();
    });
  //-------------------------------------------------------------------------------------------
  //cd
  document.getElementById("cdInput").addEventListener("change", async (event) => {
      //calc
      await window.FinderApi.rendererLog(`[Finder]: CD is changed to : ${event.target.value} cm`);
 
      isCalledFinder = true;
      await calc("composite_depth");
    });
  //-------------------------------------------------------------------------------------------
  //efd
  document.getElementById("efdInput").addEventListener("change", async (event) => {
      //calc
      await window.FinderApi.rendererLog(`[Finder]: EFD is changed to : ${event.target.value} cm`);

      isCalledFinder = true;
      await calc("event_free_depth");
    });
  //-------------------------------------------------------------------------------------------
  //age
  document.getElementById("ageInput").addEventListener("change", async (event) => {
      //calc
      await window.FinderApi.rendererLog(`[Finder]: Age is changed to : ${event.target.value} calBP`);

      isCalledFinder = true;
      await calc("age");
    });
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  async function limitDistance() {
    const holeName = holeList[document.getElementById("holeOptions").value][2];
    const sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
    const sectionId = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value];

    const secLimit = await window.FinderApi.getSectionLimit(
      [sectionId[1][0], null, null, null],
      holeName,
      sectionName
    );

    document.getElementById("distanceInput").max = parseFloat(secLimit[1]);
    document.getElementById("distanceInput").min = parseFloat(secLimit[0]);
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
      for (let i = 0; i < sectionList[selectedHole].length; i++) {
        const option = document.createElement("option");
        option.textContent = sectionList[selectedHole][i][2]; //name
        option.value       = sectionList[selectedHole][i][0]; //idx
        option.id          = sectionList[selectedHole][i][1]; //id

        document.getElementById("sectionOptions").appendChild(option);
      }
    }
  }
  //-------------------------------------------------------------------------------------------
  async function calc(...args) {
    let calcType = args[0];

    //calc depth from calcType
    let calcedData = {};
    if (calcType == "trinity") {
      //get trinity data
      let holeName    = holeList[document.getElementById("holeOptions").value][2];
      let sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
      const distance    = parseFloat(document.getElementById("distanceInput").value);
      let sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
      const cd          = parseFloat(document.getElementById("cdInput").value);

      //calc
      if(targetId[1] == null){
        console.log("FInder: Target hole is exist.")
        //case changed section and distance
        await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
        calcedData = await window.FinderApi.finderConvert(["", ["", holeName, sectionName, distance], targetId], "trinity", "linear");
        await window.FinderApi.rendererLog(calcedData);
        //apply
        document.getElementById("cdInput").value        = Math.round(calcedData.cd * 10) / 10;
        document.getElementById("efdInput").value       = Math.round(calcedData.efd * 10) / 10;
        document.getElementById("ageInput").value       = Math.round(calcedData.age_mid * 10) / 10;
        document.getElementById("ageUpperInput").value  = Math.round(calcedData.age_upper * 10) / 10;
        document.getElementById("ageLowerInput").value  = Math.round(calcedData.age_lower * 10) / 10;
      } else {
        console.log("FInder: There is no target hole.")
        //case changed hole
        //try to find same CD in selected hole
        calcedData = await window.FinderApi.finderConvert(["", cd, targetId], "composite_depth", "linear");
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
          document.getElementById("distanceInput").value  = isNaN(calcedData.distance) ? "" : Math.round(calcedData.distance * 10) / 10;
          document.getElementById("cdInput").value        = Math.round(calcedData.cd * 10) / 10;
          document.getElementById("efdInput").value       = Math.round(calcedData.efd * 10) / 10;
          document.getElementById("ageInput").value       = Math.round(calcedData.age_mid * 10) / 10;
          document.getElementById("ageUpperInput").value  = Math.round(calcedData.age_upper * 10) / 10;
          document.getElementById("ageLowerInput").value  = Math.round(calcedData.age_lower * 10) / 10;
        } else {
          console.log("FInder: Replace trinity")
          //if selected hole is not exist
          //await window.FinderApi.rendererLog(previousValue); 
          const alterType = "top";

          //apply
          if(alterType == "top"){
            holeName    = holeList[document.getElementById("holeOptions").value][2];
            sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
            sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
            const secLimit = await window.FinderApi.getSectionLimit([sectionId[0], null, null, null],holeName,sectionName);
            const topDistance    = secLimit[0];

            //calc
            await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
            calcedData = await window.FinderApi.finderConvert(["", ["", holeName, sectionName, topDistance], targetId], "trinity", "linear");
            await window.FinderApi.rendererLog(calcedData);
            //apply
            document.getElementById("distanceInput").value  = isNaN(calcedData.distance) ? "" : Math.round(calcedData.distance * 10) / 10;
            document.getElementById("cdInput").value        = Math.round(calcedData.cd * 10) / 10;
            document.getElementById("efdInput").value       = Math.round(calcedData.efd * 10) / 10;
            document.getElementById("ageInput").value       = Math.round(calcedData.age_mid * 10) / 10;
            document.getElementById("ageUpperInput").value  = Math.round(calcedData.age_upper * 10) / 10;
            document.getElementById("ageLowerInput").value  = Math.round(calcedData.age_lower * 10) / 10;

          }else if(alterType == "bottom"){
            holeName    = holeList[document.getElementById("holeOptions").value][2];
            sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
            sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
            const secLimit = await window.FinderApi.getSectionLimit([sectionId[0], null, null, null],holeName,sectionName);
            const topDistance    = secLimit[1];

            //calc
            await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
            calcedData = await window.FinderApi.finderConvert(["", ["", holeName, sectionName, topDistance], targetId], "trinity", "linear");
            await window.FinderApi.rendererLog(calcedData);
            //apply
            document.getElementById("cdInput").value        = Math.round(calcedData.cd * 10) / 10;
            document.getElementById("efdInput").value       = Math.round(calcedData.efd * 10) / 10;
            document.getElementById("ageInput").value       = Math.round(calcedData.age_mid * 10) / 10;
            document.getElementById("ageUpperInput").value  = Math.round(calcedData.age_upper * 10) / 10;
            document.getElementById("ageLowerInput").value  = Math.round(calcedData.age_lower * 10) / 10;

          }if(alterType == "centre"){
            holeName    = holeList[document.getElementById("holeOptions").value][2];
            sectionId   = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][1];
            sectionName = sectionList[document.getElementById("holeOptions").value][document.getElementById("sectionOptions").value][2];
            const secLimit = await window.FinderApi.getSectionLimit([sectionId[0], null, null, null],holeName,sectionName);
            const topDistance    = (secLimit[0] + secLimit[1]) / 2;

            //calc
            await window.FinderApi.rendererLog(["", holeName, sectionName, distance]);
            calcedData = await window.FinderApi.finderConvert(["", ["", holeName, sectionName, topDistance], targetId], "trinity", "linear");
            await window.FinderApi.rendererLog(calcedData);
            //apply
            document.getElementById("cdInput").value        = Math.round(calcedData.cd * 10) / 10;
            document.getElementById("efdInput").value       = Math.round(calcedData.efd * 10) / 10;
            document.getElementById("ageInput").value       = Math.round(calcedData.age_mid * 10) / 10;
            document.getElementById("ageUpperInput").value  = Math.round(calcedData.age_upper * 10) / 10;
            document.getElementById("ageLowerInput").value  = Math.round(calcedData.age_lower * 10) / 10;

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
      calcedData = await window.FinderApi.finderConvert(["finder_from_cd", cd, targetId], "composite_depth", "linear");
      //window.FinderApi.rendererLog(calcedData);

      //apply//calc(data[2]);
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

      document.getElementById("holeOptions").value = selected_hole_id;
      updateSectionList();
      document.getElementById("sectionOptions").value = selected_sec_id;

      document.getElementById("distanceInput").value = isNaN(calcedData.distance) ? "" : Math.round(calcedData.distance * 10) / 10;
      document.getElementById("efdInput").value      = isNaN(calcedData.efd) ? "" : Math.round(calcedData.efd * 10) / 10;
      document.getElementById("ageInput").value      = isNaN(calcedData.age_mid) ? "" : Math.round(calcedData.age_mid * 10) / 10;
      document.getElementById("ageUpperInput").value = isNaN(calcedData.age_upper) ? "" : Math.round(calcedData.age_upper * 10) / 10;
      document.getElementById("ageLowerInput").value = isNaN(calcedData.age_lower) ? "" : Math.round(calcedData.age_lower * 10) / 10;
    } else if (calcType == "event_free_depth") {
      //get efd
      let efd = parseFloat(document.getElementById("efdInput").value);

      //calc
      calcedData = await window.FinderApi.finderConvert(["finder_from_efd", efd, targetId], "event_free_depth", "linear");
      //await window.FinderApi.rendererLog(calcedData);

      //apply
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

      document.getElementById("holeOptions").value = selected_hole_id;
      updateSectionList();
      document.getElementById("sectionOptions").value = selected_sec_id;

      document.getElementById("distanceInput").value = isNaN(calcedData.distance) ? "" : Math.round(calcedData.distance * 10) / 10;
      document.getElementById("cdInput").value       = isNaN(calcedData.cd) ? "" : Math.round(calcedData.cd * 10) / 10;
      document.getElementById("ageInput").value      = isNaN(calcedData.age_mid) ? "" : Math.round(calcedData.age_mid * 10) / 10;
      document.getElementById("ageUpperInput").value = isNaN(calcedData.age_upper) ? "" : Math.round(calcedData.age_upper * 10) / 10;
      document.getElementById("ageLowerInput").value = isNaN(calcedData.age_lower) ? "" : Math.round(calcedData.age_lower * 10) / 10;
    } else if (calcType == "age") {
      let age = parseFloat(document.getElementById("ageInput").value);

      //calc
      calcedData = await window.FinderApi.finderConvert(["", age, targetId], "age", "linear");
      await window.FinderApi.rendererLog(calcedData);

      //apply
      let hole_idx = null;
      let selected_hole_id = null;
      holeList.forEach((hole, h) => {
        if (hole[2] == calcedData.hole) {
          hole_idx = h;
          selected_hole_id = hole[0];
        }
      });

      let sec_idx = null;
      let selected_sec_id = null;
      sectionList[hole_idx].forEach((sec, s) => {
        if (sec[2] == calcedData.section) {
          sec_idx = s;
          selected_sec_id = sec[0];
        }
      });

      document.getElementById("holeOptions").value = selected_hole_id;
      updateSectionList();
      document.getElementById("sectionOptions").value = selected_sec_id;

      document.getElementById("distanceInput").value = isNaN(calcedData.distance) ? "" : Math.round(calcedData.distance * 10) / 10;
      document.getElementById("efdInput").value      = isNaN(calcedData.efd) ? "" : Math.round(calcedData.efd * 10) / 10;
      document.getElementById("cdInput").value       = isNaN(calcedData.cd) ? "" : Math.round(calcedData.cd * 10) / 10;
      document.getElementById("ageInput").value      = isNaN(calcedData.age_mid) ? "" : Math.round(calcedData.age_mid * 10) / 10;
      document.getElementById("ageUpperInput").value = isNaN(calcedData.age_upper) ? "" : Math.round(calcedData.age_upper * 10) / 10;
      document.getElementById("ageLowerInput").value = isNaN(calcedData.age_lower) ? "" : Math.round(calcedData.age_lower * 10) / 10;
    }

    //move position
    if (isCalledFinder) {
      document.getElementById("Options");
      const send_data = {
        isMove: isLink,
        source: calcType,
        composite_depth: calcedData.cd,
        event_free_depth: calcedData.efd,
        age: calcedData.age_mid,
      };

      await window.FinderApi.MoveToHorizon(send_data);
    }

    //update
    previousValue = {
      project:null,
      hole:document.getElementById("holeOptions").value,
      section:document.getElementById("sectionOptions").value,
      distance:document.getElementById("distanceInput").value,
      cd:document.getElementById("cdInput"),
      efd:document.getElementById("efdInput").value,
      age:document.getElementById("ageInput").value,
      ageUpper:document.getElementById("ageUpperInput").value,
      ageLower:document.getElementById("ageLowerInput").value
    };
  }

  //-------------------------------------------------------------------------------------------

  document.getElementById("fix").addEventListener("click", async (event) => {
    if (isFix) {
      isFix = false;
      //document.getElementById("fix").style.backgroundColor = "white";
      document.getElementById("fix").querySelector("img").src = resourcePaths.finder["fix"];
    } else {
      isFix = true;
      //document.getElementById("fix").style.backgroundColor = "lightgray";
      document.getElementById("fix").querySelector("img").src = resourcePaths.finder["fixed"];
    }
    window.FinderApi.changeFix(isFix);
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("link").addEventListener("click", async (event) => {
    if (isLink) {
      isLink = false;
      //document.getElementById("fix").style.backgroundColor = "white";
      document.getElementById("link").querySelector("img").src = resourcePaths.finder["link"];
    } else {
      isLink = true;
      //document.getElementById("fix").style.backgroundColor = "lightgray";
      document.getElementById("link").querySelector("img").src = resourcePaths.finder["linked"];

      //move to target
      const send_data = {
        isMove: isLink,
        source: "composite_depth",
        composite_depth:  Math.round(document.getElementById("cdInput").value * 10) / 10,
        event_free_depth: Math.round(document.getElementById("efdInput").value * 10) / 10,
        age: Math.round(document.getElementById("ageInput").value * 10) / 10,
      };
      await window.FinderApi.MoveToHorizon(send_data);
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
        document.getElementById("cdInput").value = Math.round(data.y * 10) / 10;
        document.getElementById("cdInput").dispatchEvent(new Event("change"));
      } else if (data.depth_scale == "event_free_depth") {
        document.getElementById("efdInput").value = Math.round(data.y * 10) / 10;
        document.getElementById("efdInput").dispatchEvent(new Event("change"));
      } else if (data.depth_scale == "age") {
        document.getElementById("ageInput").value = Math.round(data.y * 10) / 10;
        document.getElementById("ageInput").dispatchEvent(new Event("change"));
      }
      
    }
  });

  //-------------------------------------------------------------------------------------------
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
      window.FinderApi.toggleDevTools("finder");
    }
  });
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
});
