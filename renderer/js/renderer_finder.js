document.addEventListener("DOMContentLoaded", () => {
  let isFix = true;
  let isLink = true;
  let isCalledFinder = false;
  let holeList = [];
  let sectionList = [];
  let inputDistance = null;
  //-------------------------------------------------------------------------------------------
  //when startup
  window.FinderApi.receive("FinderToolClicked", async () => {
    console.log("Start finder");

    await getList();
    await updateHoleList();
    await updateSectionList();
    await limitDistance();
  });

  //-------------------------------------------------------------------------------------------
  //check input event
  document
    .getElementById("distanceInput")
    .addEventListener("change", function (event) {
      var numberInput = event.target;
      var minValue = parseFloat(numberInput.min);
      var maxValue = parseFloat(numberInput.max);
      var currentValue = parseFloat(numberInput.value);

      if (currentValue > maxValue) {
        numberInput.value = maxValue;
      } else if (currentValue < minValue) {
        numberInput.value = minValue;
      }
    });
  //-------------------------------------------------------------------------------------------
  //hole
  document
    .getElementById("holeOptions")
    .addEventListener("change", async (event) => {
      console.log(`Hole: ${event.target.value}`);

      //calc
      isCalledFinder = true;
      await calc("trinity");
      await limitDistance();
      //change sec list
      await updateSectionList();
    });
  //-------------------------------------------------------------------------------------------
  //section
  document
    .getElementById("sectionOptions")
    .addEventListener("change", async (event) => {
      //change distance max/min
      document.getElementById("distanceInput").max = 100;

      //calc
      console.log(`Section: ${event.target.value}`);
      isCalledFinder = true;
      await calc("trinity");
      await limitDistance();
    });
  //-------------------------------------------------------------------------------------------
  //distance
  document
    .getElementById("distanceInput")
    .addEventListener("change", async (event) => {
      //calc
      console.log(`Distance: ${event.target.value}`);
      isCalledFinder = true;
      await calc("trinity");
    });
  //-------------------------------------------------------------------------------------------
  //cd
  document
    .getElementById("cdInput")
    .addEventListener("change", async (event) => {
      //calc
      console.log(`CD: ${event.target.value}`);
      isCalledFinder = true;
      await calc("composite_depth");
    });
  //-------------------------------------------------------------------------------------------
  //efd
  document
    .getElementById("efdInput")
    .addEventListener("change", async (event) => {
      //calc
      console.log(`EFD: ${event.target.value}`);
      isCalledFinder = true;
      await calc("event_free_depth");
    });
  //-------------------------------------------------------------------------------------------
  //age
  document
    .getElementById("ageInput")
    .addEventListener("change", async (event) => {
      //calc
      console.log(`Age: ${event.target.value}`);
      isCalledFinder = true;
      await calc("age");
    });
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  async function limitDistance() {
    const holeName = holeList[document.getElementById("holeOptions").value][2];
    const sectionName =
      sectionList[document.getElementById("holeOptions").value][
        document.getElementById("sectionOptions").value
      ][2];

    const secLimit = await window.FinderApi.getSectionLimit(
      holeName,
      sectionName
    );

    document.getElementById("distanceInput").max = parseFloat(secLimit[1]);
    document.getElementById("distanceInput").min = parseFloat(secLimit[0]);
  }
  //-------------------------------------------------------------------------------------------
  async function getList() {
    //get hole list
    [holeList, sectionList] = await window.FinderApi.finderGetCoreList();
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
        option.value = holeList[i][0]; //idx
        option.id = holeList[i][1]; //id

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
        option.value = sectionList[selectedHole][i][0]; //idx
        option.id = sectionList[selectedHole][i][1]; //idx

        document.getElementById("sectionOptions").appendChild(option);
      }
    }
  }
  //-------------------------------------------------------------------------------------------
  async function calc(...args) {
    let calcType = args[0];
    let depth = null;
    if (args.length == 2) {
      depth = args[1];
    }
    console.log(calcType, depth);

    let calcedData = {};
    if (calcType == "trinity") {
      //get trinity data
      const holeName =
        holeList[document.getElementById("holeOptions").value][2];
      const sectionName =
        sectionList[document.getElementById("holeOptions").value][
          document.getElementById("sectionOptions").value
        ][2];
      const distance = parseFloat(
        document.getElementById("distanceInput").value
      );

      //calc
      calcedData = await window.FinderApi.finderConvert(
        ["", holeName, sectionName, distance],
        "trinity",
        "linear"
      );

      //apply
      document.getElementById("cdInput").value =
        Math.round(calcedData.cd * 10) / 10;
      document.getElementById("efdInput").value =
        Math.round(calcedData.efd * 10) / 10;
      document.getElementById("ageInput").value =
        Math.round(calcedData.age_mid * 10) / 10;
      document.getElementById("ageUpperInput").value =
        Math.round(calcedData.age_upper * 10) / 10;
      document.getElementById("ageLowerInput").value =
        Math.round(calcedData.age_lower * 10) / 10;
    } else if (calcType == "composite_depth") {
      let cd = null;
      if (depth == null) {
        cd = parseFloat(document.getElementById("cdInput").value);
      } else {
        cd = depth;
      }

      //calc
      calcedData = await window.FinderApi.finderConvert(
        ["", cd],
        "composite_depth",
        "linear"
      );

      //apply//calc(data[2]);
      let hole_idx = null;
      holeList.forEach((hole, h) => {
        if (hole[2] == calcedData.hole) {
          hole_idx = h;
        }
      });

      let sec_idx = null;
      sectionList[hole_idx].forEach((sec, s) => {
        if (sec[2] == calcedData.section) {
          sec_idx = s;
        }
      });

      document.getElementById("holeOptions").value = hole_idx;
      updateSectionList();
      document.getElementById("sectionOptions").value = sec_idx;

      document.getElementById("distanceInput").value =
        Math.round(calcedData.distance * 10) / 10;
      document.getElementById("efdInput").value =
        Math.round(calcedData.efd * 10) / 10;
      document.getElementById("ageInput").value =
        Math.round(calcedData.age_mid * 10) / 10;
      document.getElementById("ageUpperInput").value =
        Math.round(calcedData.age_upper * 10) / 10;
      document.getElementById("ageLowerInput").value =
        Math.round(calcedData.age_lower * 10) / 10;
    } else if (calcType == "event_free_depth") {
      let efd = null;
      if (depth == null) {
        efd = parseFloat(document.getElementById("efdInput").value);
      } else {
        efd = depth;
      }

      //calc
      calcedData = await window.FinderApi.finderConvert(
        ["", efd],
        "event_free_depth",
        "linear"
      );

      //apply
      let hole_idx = null;
      holeList.forEach((hole, h) => {
        if (hole[2] == calcedData.hole) {
          hole_idx = h;
        }
      });

      let sec_idx = null;
      sectionList[hole_idx].forEach((sec, s) => {
        if (sec[2] == calcedData.section) {
          sec_idx = s;
        }
      });

      document.getElementById("holeOptions").value = hole_idx;
      updateSectionList();
      document.getElementById("sectionOptions").value = sec_idx;

      document.getElementById("distanceInput").value =
        Math.round(calcedData.distance * 10) / 10;
      document.getElementById("cdInput").value =
        Math.round(calcedData.cd * 10) / 10;
      document.getElementById("ageInput").value =
        Math.round(calcedData.age_mid * 10) / 10;
      document.getElementById("ageUpperInput").value =
        Math.round(calcedData.age_upper * 10) / 10;
      document.getElementById("ageLowerInput").value =
        Math.round(calcedData.age_lower * 10) / 10;
    } else if (calcType == "age") {
      let age = null;
      if (depth == null) {
        age = parseFloat(document.getElementById("ageInput").value);
      } else {
        age = depth;
      }

      //calc
      calcedData = await window.FinderApi.finderConvert(
        ["", age],
        "age",
        "linear"
      );

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

      document.getElementById("distanceInput").value =
        Math.round(calcedData.distance * 10) / 10;
      document.getElementById("efdInput").value =
        Math.round(calcedData.efd * 10) / 10;
      document.getElementById("cdInput").value =
        Math.round(calcedData.cd * 10) / 10;
      document.getElementById("ageInput").value =
        Math.round(calcedData.age_mid * 10) / 10;
      document.getElementById("ageUpperInput").value =
        Math.round(calcedData.age_upper * 10) / 10;
      document.getElementById("ageLowerInput").value =
        Math.round(calcedData.age_lower * 10) / 10;
    }

    // /      console.log(calcedData);

    //move position
    if (isLink && isCalledFinder) {
      document.getElementById("Options");
      const send_data = {
        source: calcType,
        composite_depth: calcedData.cd,
        event_free_depth: calcedData.efd,
        age: calcedData.age_mid,
      };
      await window.FinderApi.MoveToHorizon(send_data);
    }
  }

  //-------------------------------------------------------------------------------------------

  document.getElementById("fix").addEventListener("click", async (event) => {
    await window.FinderApi.changeFix(isFix);
    if (isFix) {
      isFix = false;
      //document.getElementById("fix").style.backgroundColor = "white";
      document.getElementById("fix_img").src = "../icons/tool/fix.png";
    } else {
      isFix = true;
      //document.getElementById("fix").style.backgroundColor = "lightgray";
      document.getElementById("fix_img").src = "../icons/tool/fixed.png";
    }
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("link").addEventListener("click", async (event) => {
    if (isLink) {
      isLink = false;
      //document.getElementById("fix").style.backgroundColor = "white";
      document.getElementById("link_img").src = "../icons/tool/unlink.png";
    } else {
      isLink = true;
      //document.getElementById("fix").style.backgroundColor = "lightgray";
      document.getElementById("link_img").src = "../icons/tool/link.png";
    }
  });
  //-------------------------------------------------------------------------------------------
  //update depth from main renderer
  window.FinderApi.receive("SendDepthFromMain", async (data) => {
    if (isLink) {
      //data[correlation id, depth, depth scale]

      if (data[2] == "composite_depth") {
        document.getElementById("cdInput").value =
          Math.round(data[1] * 10) / 10;
      } else if (data[2] == "event_free_depth") {
        document.getElementById("efdInput").value =
          Math.round(data[1] * 10) / 10;
      } else if (data[2] == "age") {
        document.getElementById("ageInput").value =
          Math.round(data[1] * 10) / 10;
      }

      //call event
      //document.getElementById("cdInput").dispatchEvent(new Event("change"));

      //calc
      await calc(data[2], data[1]);
    }
  });

  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
});
