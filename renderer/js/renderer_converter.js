document.addEventListener("DOMContentLoaded", () => {
  let source_data = null;
  let n_r = null;
  let n_c = null;
  let output_type = "export";
  //-------------------------------------------------------------------------------------------
  window.ConverterApi.receive("ConverterMenuClicked", async (data) => {
    output_type = data;
    console.log("[Converter]: Conterter starting type: " + output_type);

    if(output_type == "export"){
      document.getElementById("cvt_bt_convert").textContent = "Export";
    } else if (output_type == "import"){
      document.getElementById("cvt_bt_convert").textContent = "Import";
    }

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
      console.log("[Converter]: Converting...");

      //get model ids
      const corId = parseInt(document.getElementById("cvt_correlation_model").value.split(",")[0]);
      const ageId = parseInt(document.getElementById("cvt_age_model").value.split(",")[0]);
      let modelIds = {correlation: corId,  age: ageId};

      //get source type
      const sourceType = document.getElementById("cvt_source_type").value;
      let depthMaxIdx = 0;

      //make data
      let indataList = [];
      if (sourceType == "trinity") {
        const nameIdx     = document.getElementById("depth_chooser0").value;
        const holeIdx     = document.getElementById("depth_chooser1").value;
        const sectionIdx  = document.getElementById("depth_chooser2").value;
        const distanceIdx = document.getElementById("depth_chooser3").value;
        depthMaxIdx = Math.max(...[nameIdx, holeIdx, sectionIdx, distanceIdx]);
        //skip header
        for (let i = 1; i < source_data.length; i++) {
          indataList.push([
            source_data[i][nameIdx], //data name
            [null,source_data[i][holeIdx], source_data[i][sectionIdx],source_data[i][distanceIdx]],//position trinity name
            [null,null,null,null],//search range
          ]);
        }
      } else if (sourceType == "composite_depth") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const cdIdx = document.getElementById("depth_chooser1").value;
        depthMaxIdx = Math.max(...[nameIdx, cdIdx]);
        for (let i = 0; i < source_data.length; i++) {
          indata.push([
            source_data[i][nameIdx],
            source_data[i][cdIdx],
            [null,null,null,null], 
          ]);
        }
      } else if (sourceType == "event_free_depth") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const efdIdx = document.getElementById("depth_chooser1").value;
        depthMaxIdx = Math.max(...[nameIdx, efdIdx]);
        for (let i = 0; i < source_data.length; i++) {
          indata.push([
            source_data[i][nameIdx], 
            source_data[i][efdIdx],
            [null,null,null,null],
          ]);
        }
      } else if (sourceType == "drilling_depth") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ddIdx = document.getElementById("depth_chooser1").value;
        depthMaxIdx = Math.max(...[nameIdx, ddIdx]);
        for (let i = 0; i < source_data.length; i++) {
          indata.push([
            source_data[i][nameIdx], 
            source_data[i][ddIdx],
            [null,null,null,null],
          ]);
        }
      } else if (sourceType == "age") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ageIdx = document.getElementById("depth_chooser1").value;
        depthMaxIdx = Math.max(...[nameIdx, ageIdx]);
        for (let i = 0; i < source_data.length; i++) {
          indata.push([
            source_data[i][nameIdx], 
            source_data[i][ageIdx],
            [null,null,null,null],
          ]);
        }
      }

      //output
      if(output_type == "export"){
        //calc
        let convertedData = [];
        let header = [
            "Name",
            "Project",
            "Hole",
            "Section",
            "Distance (cm)",
            "Composite depth (cm)",
            "Eventfree depth (cm)",
            "Drilling depth (cm)",
            "Age mid (calBP)",
            "Age upper (calBP)",
            "Age lower (calBP)",
            "Connection Rank",
            "Source Type",
            "Correlation Model Version",
            "Event Model Version",
            "Age Model Version",
            "",
        ];
        if(n_c>depthMaxIdx+1){
          for(let d=depthMaxIdx+1; d<n_c; d++){
            header.push(source_data[0][d]);
          }
        }
        convertedData.push(header);

        if (source_data !== null) {
          for(let i=0;i<indataList.length;i++){
            const calcedData = await window.ConverterApi.depthConverter(indataList[i], sourceType, "linear");
            //make output array
            let rowData = [
              calcedData.name, 
              calcedData.project,
              calcedData.hole,
              calcedData.section,
              parseFloat(calcedData.distance).toFixed(1),
              parseFloat(calcedData.cd).toFixed(1),
              parseFloat(calcedData.efd).toFixed(1),
              parseFloat(calcedData.dd).toFixed(1),
              parseFloat(calcedData.age_mid).toFixed(1),
              parseFloat(calcedData.age_upper).toFixed(1),
              parseFloat(calcedData.age_lower).toFixed(1),
              calcedData.correlation_rank,
              calcedData.source_type,
              calcedData.correlation_model_version,
              calcedData.event_model_version,
              calcedData.age_model_version,
              NaN,
            ];
            
            for(let d=depthMaxIdx; d<n_c; d++){
              rowData.push(source_data[i+1][d]); //remove header
            }
            convertedData.push(rowData);
          }
        }

        //export
        await window.ConverterApi.cvtExport(convertedData);
        console.log("[Converter]: Converted data is exported.");
      } else if (output_type == "import"){

        if (source_data !== null) {
          let output = [];
          for(let i=0;i<indataList.length;i++){
            let calcedData = await window.ConverterApi.depthConverter(indataList[i], sourceType, "linear");

            let header = [];
            for(let d=depthMaxIdx+1; d<n_c; d++){
              header.push(source_data[0][d]); //remove header
            }
            let values = [];
            for(let d=depthMaxIdx+1; d<n_c; d++){
              values.push(source_data[i+1][d]); //remove header
            }
            
            calcedData.data_header = header;
            calcedData.data_values = values;

            output.push(calcedData);
          }

          await window.ConverterApi.sendImportedData(output);
          console.log("[Converter]: Converted data is imported.");
        }

      } else {
        console.log("Unkown conert type.")
        return
      }

      
      //console.log(convertedData);
    });

  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
      window.ConverterApi.toggleDevTools("converter");
    }
  });
});
