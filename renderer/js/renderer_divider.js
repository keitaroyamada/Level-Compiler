document.addEventListener("DOMContentLoaded", () => {
  let n_r = null;
  let n_c = null;
  //-------------------------------------------------------------------------------------------
  window.DividerApi.receive("DividerToolClicked", async (data) => {
    console.log("Divider making");
    //make model chooser

    document
      .getElementById("dv_source_type")
      .dispatchEvent(new Event("change"));
  });
  //-------------------------------------------------------------------------------------------
  document
    .getElementById("dv_source_type")
    .addEventListener("change", (event) => {
      //clear
      const parentElement = document.getElementById("dv_source_chooser");

      while (parentElement.firstChild) {
        parentElement.removeChild(parentElement.firstChild);
      }

      //add
      const select = event.target.value;

      console.log(select);
      if (select == "trinity") {
        //-----------------------------------------------------
        const disp = ["Name", "Hole", "Section", "Distance"];
        const key = ["name", "hole", "sec", "dist"];

        for (let n = 0; n < 4; n++) {
          const div = document.createElement("div");
          const p = document.createElement("p");
          p.textContent = disp[n];
          div.appendChild(p);

          const selectElement = document.createElement("select");

          selectElement.id = "depth_chooser" + n.toString();
          for (let i = 0; i < n_c; i++) {
            const option = document.createElement("option");
            option.textContent = source_data[0][i];
            option.value = i;
            if (source_data[0][i].toLowerCase().includes(key[n])) {
              option.selected = true;
            }
            selectElement.appendChild(option);
          }
          div.appendChild(selectElement);
          document.getElementById("dv_source_chooser").appendChild(div);
        }
      } else if (select == "drilling_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Drilling depth"];
          const key = ["name", "drilling"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      } else if (select == "composite_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Composite depth"];
          const key = ["name", "composite"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      } else if (select == "event_free_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Event free depth"];
          const key = ["name", "free"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      } else if (select == "age") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Age"];
          const key = ["name", "age"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      }
    });
  //-------------------------------------------------------------------------------------------
  document
    .getElementById("dv_source_type")
    .addEventListener("change", (event) => {
      //clear
      const parentElement = document.getElementById("dv_source_chooser");

      while (parentElement.firstChild) {
        parentElement.removeChild(parentElement.firstChild);
      }

      //add
      const select = event.target.value;

      console.log(select);
      if (select == "trinity") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Hole", "Section", "Distance"];
          const key = ["name", "hole", "sec", "dist"];

          for (let n = 0; n < 4; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      } else if (select == "drilling_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Drilling depth"];
          const key = ["name", "drilling"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      } else if (select == "composite_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Composite depth"];
          const key = ["name", "composite"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      } else if (select == "event_free_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Event free depth"];
          const key = ["name", "free"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      } else if (select == "age") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Age"];
          const key = ["name", "age"];

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              if (source_data[0][i].toLowerCase().includes(key[n])) {
                option.selected = true;
              }
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("dv_source_chooser").appendChild(div);
          }
        }
      }
    });
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

  //-------------------------------------------------------------------------------------------

  //-------------------------------------------------------------------------------------------
  document
    .getElementById("dv_bt_divide")
    .addEventListener("click", async (event) => {
      console.log("Dividing...");

      //get source type
      const sourceType = document.getElementById("dv_source_type").value;

      //make data
      let indata = [];
      if (document.getElementById("dv_source_type").value == "trinity") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const holeIdx = document.getElementById("depth_chooser1").value;
        const sectionIdx = document.getElementById("depth_chooser2").value;
        const distanceIdx = document.getElementById("depth_chooser3").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([
            source_data[i][nameIdx],
            source_data[i][holeIdx],
            source_data[i][sectionIdx],
            source_data[i][distanceIdx],
          ]);
        }
      } else if (
        document.getElementById("dv_source_type").value == "composite_depth"
      ) {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const cdIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][cdIdx]]);
        }
      } else if (
        document.getElementById("dv_source_type").value == "event_free_depth"
      ) {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const efdIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][efdIdx]]);
        }
      } else if (
        document.getElementById("dv_source_type").value == "drilling_depth"
      ) {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ddIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][ddIdx]]);
        }
      } else if (document.getElementById("dv_source_type").value == "age") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ageIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][ageIdx]]);
        }
      }

      console.log(indata);

      //calc
      /*
      let convertedData = [];
      if (source_data !== null) {
        convertedData = await window.ConverterApi.cvtConvert(
          modelIds,
          indata,
          sourceType,
          "linear"
        );
      }

      //export
      await window.ConverterApi.cvtExport(convertedData);
      console.log("done");
      //console.log(convertedData);
      */
    });

  //-------------------------------------------------------------------------------------------
});
