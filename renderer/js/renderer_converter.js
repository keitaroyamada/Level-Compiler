document.addEventListener("DOMContentLoaded", () => {
  let source_data = null;
  let source_path = null;
  let n_r = null;
  let n_c = null;
  let output_type = "export";
  let called_from = "";
  let headrLines = 1;
  //-------------------------------------------------------------------------------------------
  window.ConverterApi.receive("ConverterMenuClicked", async (data) => {
    output_type = data.output_type;
    called_from = data.called_from;
    source_path = data.path;

    console.log("[Converter]: Conterter starting type: " + output_type);

    if(output_type == "export"){
      document.getElementById("cvt_bt_convert").textContent = "Export";
    } else if (output_type == "import"){
      document.getElementById("cvt_bt_convert").textContent = "Import";
    }

    //make model chooser
    //correlation
    document.getElementById("cvt_correlation_model").innerHTML = "";
    const correlation_model_list = await window.ConverterApi.cvtGetCorrelationModelList();
    for (let i = 0; i < correlation_model_list.length; i++) {
      const correlationOption = document.createElement("option");
      correlationOption.value = correlation_model_list[i][0]; //id
      correlationOption.textContent = correlation_model_list[i][1]; //name
      document.getElementById("cvt_correlation_model").appendChild(correlationOption);
    }

    //age
    document.getElementById("cvt_age_model").innerHTML = "";
    const age_model_list = await window.ConverterApi.cvtGetAgeModelList();
    for (let i = 0; i < age_model_list.length; i++) {
      const ageOption = document.createElement("option");
      ageOption.value = age_model_list[i][0]; //id
      ageOption.textContent = age_model_list[i][1]; //name
      document.getElementById("cvt_age_model").appendChild(ageOption);
    }

    //if path exist
    if(source_path !== null){
      await loadCsv(source_path )
    }
  });
  //-------------------------------------------------------------------------------------------
  //load data
  document.getElementById("cvt_bt_import").addEventListener("click", async (event) => {
      console.log("Load from file chose.");
      source_data = null;
      let path = null;
      
      await loadCsv(path);
    });

  //-------------------------------------------------------------------------------------------

  document.getElementById("cvt_source_type").addEventListener("change", (event) => {
      //clear
      const parentElement = document.getElementById("cvt_source_chooser");

      //initialise
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
          const key = {
            Name:["name"],
            Hole:["hole"],
            Section:["sec"],
            Distance:["dist","psp","position"],
          }
          for (let n = 0; n < 4; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            selectElement.style.width = "100px";
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              
              //check match key
              key[disp[n]].forEach(k=>{
                if (source_data[0][i].toLowerCase().includes(k)) {
                  option.selected = true;
                }
              })
              
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("cvt_source_chooser").appendChild(div);
          }
        }
      } else if (select == "drilling_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Drilling_depth"];
          const key = {
            Name:["name"],
            Drilling_depth:["drilling","dd"],
          }

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            selectElement.style.width = "100px";
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              //check match key
              key[disp[n]].forEach(k=>{
                if (source_data[0][i].toLowerCase().includes(k)) {
                  option.selected = true;
                }
              })
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("cvt_source_chooser").appendChild(div);
          }
        }
      } else if (select == "composite_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Composite_depth"];
          const key = {
            Name:["name"],
            Composite_depth:["composite","cd"],
          }

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            selectElement.style.width = "100px";
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              //check match key
              key[disp[n]].forEach(k=>{
                if (source_data[0][i].toLowerCase().includes(k)) {
                  option.selected = true;
                }
              })
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("cvt_source_chooser").appendChild(div);
          }
        }
      } else if (select == "event_free_depth") {
        //-----------------------------------------------------
        if (source_data !== null) {
          const disp = ["Name", "Event_free_depth"];
          const key = {
            Name:["name"],
            Event_free_depth:["free","efd"],
          }

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            selectElement.style.width = "100px";
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              //check match key
              key[disp[n]].forEach(k=>{
                if (source_data[0][i].toLowerCase().includes(k)) {
                  option.selected = true;
                }
              })
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
          const key = {
            Name:["name"],
            Age:["age"],
          }

          for (let n = 0; n < 2; n++) {
            const div = document.createElement("div");
            const p = document.createElement("p");
            p.textContent = disp[n];
            div.appendChild(p);

            const selectElement = document.createElement("select");
            selectElement.id = "depth_chooser" + n.toString();
            selectElement.style.width = "100px";
            for (let i = 0; i < n_c; i++) {
              const option = document.createElement("option");
              option.textContent = source_data[0][i];
              option.value = i;
              //check match key
              key[disp[n]].forEach(k=>{
                if (source_data[0][i].toLowerCase().includes(k)) {
                  option.selected = true;
                }
              })
              selectElement.appendChild(option);
            }
            div.appendChild(selectElement);
            document.getElementById("cvt_source_chooser").appendChild(div);
          }
        }
      }
    });
  //-------------------------------------------------------------------------------------------
  //convert
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
        for (let i = headrLines; i < source_data.length; i++) {
          const datumName =  source_data[i][nameIdx];//data name
          const projectName = null;
          let holeName = source_data[i][holeIdx];
          if (/^\d+$/.test(holeName.toString()) == true) {
            //case number
            holeName = holeName.toString().padStart(2, "0");
          }
          const sectionName = source_data[i][sectionIdx];
          const distance = parseFloat(source_data[i][distanceIdx]);

          indataList.push([
            datumName,
            [projectName, holeName, sectionName, distance],//position trinity name
            [null,null,null,null],//search range
          ]);
        }
      } else if (sourceType == "composite_depth") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const cdIdx = document.getElementById("depth_chooser1").value;
        depthMaxIdx = Math.max(...[nameIdx, cdIdx]);
        for (let i = headrLines; i < source_data.length; i++) {
          indataList.push([
            source_data[i][nameIdx],
            source_data[i][cdIdx],
            [null,null,null,null], 
          ]);
        }
      } else if (sourceType == "event_free_depth") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const efdIdx = document.getElementById("depth_chooser1").value;
        depthMaxIdx = Math.max(...[nameIdx, efdIdx]);
        for (let i = headrLines; i < source_data.length; i++) {
          indataList.push([
            source_data[i][nameIdx], 
            source_data[i][efdIdx],
            [null,null,null,null],
          ]);
        }
      } else if (sourceType == "drilling_depth") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ddIdx = document.getElementById("depth_chooser1").value;
        depthMaxIdx = Math.max(...[nameIdx, ddIdx]);
        for (let i = headrLines; i < source_data.length; i++) {
          indataList.push([
            source_data[i][nameIdx], 
            source_data[i][ddIdx],
            [null,null,null,null],
          ]);
        }
      } else if (sourceType == "age") {
        const nameIdx = document.getElementById("depth_chooser0").value;
        const ageIdx = document.getElementById("depth_chooser1").value;

        depthMaxIdx = Math.max(...[nameIdx, ageIdx]);
        for (let i = headrLines; i < source_data.length; i++) {
          indataList.push([
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
          
          const sendData = {
            name:"",
            path:source_path,
            data:output,
            send_to:called_from,
            send_from:"Converter",
          };
          console.log(sendData)

          await window.ConverterApi.sendImportedData(sendData);
          console.log("[Converter]: Converted data is imported.");
        }

        //colose window
        window.close();

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
  document.getElementById('container').addEventListener("dragover", (e) => {
    e.preventDefault(e);
  });
  document.getElementById('container').addEventListener("drop", async (e) => {
      e.preventDefault(e);
      //get file paths
      let dataList = [];
      for(const file of e.dataTransfer.files){
          const fileParseData = await window.ConverterApi.getFilePath(file);
          if(fileParseData.ext==".csv"){
              dataList.push(fileParseData);
          }
      }
      if(dataList.length>0){
          console.log("Load csv files: "+dataList.length);
      }else{
          return
      }
      
      //load
      for(let d=0;d<dataList.length;d++){
        //initialise
        source_data = null;

        await loadCsv(dataList[d].fullpath);
      }

    });
  async function loadCsv(path){
    [source_data, loadedpath] = await window.ConverterApi.cvtLoadCsv(
      "Please select the conversion target data",
      [
        {
          name: "CSV file",
          extensions: ["csv"],
        },
      ],
      path
    );

    if (source_data !== null) {
      source_path = loadedpath;
      n_r = 10;//source_data.length;
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
          tc.style.padding = "5px"
          tc.style.border = "1px solid #ccc";
          if(r==0){
            //header
            tc.style.fontWeight = "bold";
          }
        }
      }
      //document.getElementById("data_table").appendChild(table);

      //estimate type of depth
      const key = {
        trinity:["section","hole","distance"],
        composite_depth:["cd","composite"],
        event_free_depth:["free","efd"],
        age:["age","bp"],
      };

      let sourceType = "trinity";
      breakpoint:
      for (let i = 0; i < n_c; i++) {
        //check match key
        
        for(const k in key){
          let isContain = false;
          key[k].forEach(c=>{
            if (source_data[0][i].toLowerCase().includes(c)) {
              isContain = true;
            }
          })
          if(isContain==true){
            sourceType = k.toLocaleLowerCase();
            break breakpoint;
          }
        }
      }
      console.log("Estimated Source Type: "+sourceType);
      document.getElementById("cvt_source_type").value = sourceType;//"trinity";
      document.getElementById("cvt_source_type").dispatchEvent(new Event("change"));

      document.getElementById("data_path").textContent = loadedpath.match(/[^\\\/]*$/)[0];
    }
  }
});
