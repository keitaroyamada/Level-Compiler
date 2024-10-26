document.addEventListener("DOMContentLoaded", () => {
  let source_data = null;
  let n_r = null;
  let n_c = null;
  //-------------------------------------------------------------------------------------------
  window.ConverterApi.receive("ConverterMenuClicked", async (data) => {
    console.log("making");
    //make model chooser

    //correlation
    const correlation_model_list = await window.ConverterApi.cvtGetCorrelationModelList();
    for (let i = 0; i < correlation_model_list.length; i++) {
      const correlationOption = document.createElement("option");
      correlationOption.value = correlation_model_list[i][0]; //id
      correlationOption.textContent = correlation_model_list[i][1]; //name
      document.getElementById("cvt_correlation_model").appendChild(correlationOption);
    }

    //age
    const age_model_list = await window.ConverterApi.cvtGetAgeModelList();
    for (let i = 0; i < age_model_list.length; i++) {
      const ageOption = document.createElement("option");
      ageOption.value = age_model_list[i][0]; //id
      ageOption.textContent = age_model_list[i][1]; //name
      document.getElementById("cvt_age_model").appendChild(ageOption);
    }
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("cvt_bt_import").addEventListener("click", async (event) => {
      console.log("import");
      source_data = null;
      let path = "";
      [source_data, path] = await window.ConverterApi.cvtLoadCsv(
        "Please select the conversion target data",
        [
          {
            name: "CSV file",
            extensions: ["csv"],
          },
        ]
      );

      if (source_data !== null) {
        n_r = source_data.length;
        n_c = source_data[0].length;

        //Clear all rows within tbody
        const table = document.getElementById("data_table");
        const tbody = table.querySelector("tbody");
        if (tbody) {
            tbody.innerHTML = "";
        }

        //show table
        //const table = document.createElement("table");
        for (let r = 0; r < n_r; r++) {
          const tr = table.insertRow();
          for (let c = 0; c < n_c; c++) {
            const tc = tr.insertCell();
            tc.textContent = source_data[r][c];
          }
        }
        //document.getElementById("data_table").appendChild(table);
        document.getElementById("cvt_source_type").value = "trinity";
        document.getElementById("cvt_source_type").dispatchEvent(new Event("change"));

        document.getElementById("data_path").textContent = path.match(/[^\\\/]*$/)[0];
      }
    });

  //-------------------------------------------------------------------------------------------

  document.getElementById("cvt_source_type").addEventListener("change", (event) => {
      //clear
      const parentElement = document.getElementById("cvt_source_chooser");

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
            document.getElementById("cvt_source_chooser").appendChild(div);
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
            document.getElementById("cvt_source_chooser").appendChild(div);
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
            document.getElementById("cvt_source_chooser").appendChild(div);
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
            document.getElementById("cvt_source_chooser").appendChild(div);
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
            document.getElementById("cvt_source_chooser").appendChild(div);
          }
        }
      }
    });
  //-------------------------------------------------------------------------------------------
  document.getElementById("cvt_bt_convert").addEventListener("click", async (event) => {
      console.log("Converting...");

      //get model ids
      const corId = parseInt(
        document.getElementById("cvt_correlation_model").value.split(",")[0]
      );
      const ageId = parseInt(
        document.getElementById("cvt_age_model").value.split(",")[0]
      );
      let modelIds = {
        correlation: corId,
        age: ageId,
      };

      //get source type
      const sourceType = document.getElementById("cvt_source_type").value;

      //make data
      let indata = [];
      if (document.getElementById("cvt_source_type").value == "trinity") {
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
        document.getElementById("cvt_source_type").value == "composite_depth"
      ) {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const cdIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][cdIdx]]);
        }
      } else if (
        document.getElementById("cvt_source_type").value == "event_free_depth"
      ) {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const efdIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][efdIdx]]);
        }
      } else if (
        document.getElementById("cvt_source_type").value == "drilling_depth"
      ) {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ddIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][ddIdx]]);
        }
      } else if (document.getElementById("cvt_source_type").value == "age") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ageIdx = document.getElementById("depth_chooser1").value;
        for (let i = 0; i < source_data.length; i++) {
          indata.push([source_data[i][nameIdx], source_data[i][ageIdx]]);
        }
      }

      document.getElementById("cvt_age_model").value.split(",")[0];

      //calc
      let convertedData = [];
      if (source_data !== null) {
        convertedData = await window.ConverterApi.cvtConvert(modelIds, indata, sourceType,"linear");
      }

      //export
      await window.ConverterApi.cvtExport(convertedData);
      console.log("done");
      //console.log(convertedData);
    });

  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
      window.ConverterApi.toggleDevTools("divider");
    }
  });
});
