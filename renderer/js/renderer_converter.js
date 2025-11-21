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
      document.querySelectorAll('.check_outside, .precision_output').forEach(el => el.style.display = 'flex');
    } else if (output_type == "import"){
      document.getElementById("cvt_bt_convert").textContent = "Import";
      document.querySelectorAll('.precision_output').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.check_outside').forEach(el => el.style.display = 'flex');
      document.querySelectorAll('.check_outside').forEach(el => el.checked = true);
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
            Section:["sec","core number"],
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
    try{
      document.getElementById("cvt_bt_convert").disabled = true;
      await window.ConverterApi.progressbar("Depth converter", "Now checking...", true, "converterWindow");

      console.log("[Converter]: Converting...");
      document.body.style.cursor = "wait"; 

      const precision = parseInt(document.getElementById("precision").value, 10);

      //get model ids
      const corId = parseInt(document.getElementById("cvt_correlation_model").value.split(",")[0]);
      const ageId = parseInt(document.getElementById("cvt_age_model").value.split(",")[0]);
      let modelIds = {correlation: corId,  age: ageId};

      //get source type
      const sourceType = document.getElementById("cvt_source_type").value;
      let depthMaxIdx = 0;
      const allowOutside = document.getElementById("allow_outside_data").checked;
      
      //make indata
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
          let sectionName = source_data[i][sectionIdx];
          if (/^\d+$/.test(sectionName.toString()) == true) {
            //case number
            sectionName = sectionName.toString().padStart(2, "0");
          }
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
      console.log("[Converter]: Finish making input data list.")

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

            "Connection",
            "Connection Rank",
            "Source Type",
            "Calc Type",
            "Correlation Model Version",
            "Event Model Version",
            "Age Model Version",
            "Description"
        ];
        if(n_c>depthMaxIdx+1){
          for(let d=depthMaxIdx+1; d<n_c; d++){
            header.push(source_data[0][d]);
          }
        }
        convertedData.push(header);

        //main
        if (source_data === null) {return}
        //cal depth in main
        const options = {
          sourceType: sourceType,
          polationType: "linear",  
          allowOutside: allowOutside,
          callFrom: "converter",
          isZip: true,
        };

        const zipInData = await zip(indataList);

        const calcedDataList = await unzip(await window.ConverterApi.depthConverter(zipInData, options));

        if(calcedDataList===null) {
          document.body.style.cursor = "default"; 
          window.ConverterApi.clearProgressbar();
          return
        }

        for(let i=0; i<calcedDataList.length; i++){
          //calc depth
          const calcedData = calcedDataList[i];
          
          if(!calcedData){
            console.log("Conversion was skipped at line: "+i+".");
            continue
          }

          //update header
          if(i==0){
            if(calcedData.is_main_model===false){
              header[5]+=" [DUO]";
              header[6]+=" [DUO]";
              header[13]+=" [DUO]";
              header[14]+=" [DUO]";
            }else{
              header[5]+=" [MAIN]";
              header[6]+=" [MAIN]";
              header[13]+=" [MAIN]";
              header[14]+=" [MAIN]";
            }
            if(sourceType !== "trinity"){
              header[1]+="[PASEUDO]";
              header[2]+="[PASEUDO]";
              header[3]+="[PASEUDO]";
              header[4]+="[PASEUDO]";
            }
          }

          //make output array
          let rowData = [
            calcedData.name, //data name
            calcedData.project, //project name
            calcedData.hole, //hole name
            calcedData.section, //section name
            parseFloat(calcedData.distance).toFixed(precision), //distance
            parseFloat(calcedData.cd).toFixed(precision), //composite depth
            parseFloat(calcedData.efd).toFixed(precision), //event free depth
            parseFloat(calcedData.dd).toFixed(precision), //drilling depth
            parseFloat(calcedData.age_mid).toFixed(precision), //age mid
            parseFloat(calcedData.age_upper).toFixed(precision), //age upper
            parseFloat(calcedData.age_lower).toFixed(precision), //age lower

            calcedData.is_main_model ? "MAIN " + calcedData.section_type : "DUO " + calcedData.section_type, // MAIN master section/parallel section
            calcedData.correlation_rank,  //connection rank

            calcedData.source_type,
            calcedData.calc_type,
            calcedData.is_main_model ? "[MAIN]" + calcedData.correlation_model_version : "[DUO]" + calcedData.correlation_model_version,
            calcedData.is_main_model ? "[MAIN]" + calcedData.event_model_version : "[DUO]" + calcedData.event_model_version,
            calcedData.age_model_version ? "[MAIN]" + calcedData.age_model_version : "",
            calcedData.description, 
          ];

          //add data
          if(n_c>depthMaxIdx+1){
            for(let d=depthMaxIdx+1; d<n_c; d++){
              rowData.push(source_data[i+1][d]);//remove header
            }
          }
                    
          convertedData.push(rowData);
        }
        
        //export
        await window.ConverterApi.progressbar("Depth converter", "Now saving...", true, "converterWindow");

        const exRes = await window.ConverterApi.cvtExport(await zip(convertedData));

        if(exRes){
          console.log("[Converter]: Converted data is exported.");
          window.ConverterApi.clearProgressbar();
          alert("Conversion completed successfully.");
        }else{
          window.ConverterApi.clearProgressbar();
          console.log("[Converter]: Failed to export.");
          alert("Failed to convert data.");
        }
        
      } else if (output_type == "import"){
        //main convertion
        if (source_data === null) {return}
        const options = {
          sourceType: sourceType,
          polationType: "linear",  
          allowOutside: true,
          callFrom: "converter",
          isZip: true,
        };

        //main calc
        const calcedDataList = await unzip(await window.ConverterApi.depthConverter(await zip(indataList), options));
        console.log("[Converter]: Receive convereted depth datalist.")

        if(calcedDataList===null) {
          document.body.style.cursor = "default"; 
          window.ConverterApi.clearProgressbar();
          return
        }

        let output = [];

        for(let i=0; i<calcedDataList.length; i++){
          //calc depth
          const calcedData = calcedDataList[i];
          
          if(!calcedData){
            console.log("Conversion was skipped at line: "+i+".");
            continue
          }

          let header = [];
          let units  = [];
          for(let d=depthMaxIdx+1; d<n_c; d++){
            const m = source_data[0][d].match(/^(.+?)(?:\[(.+)\])?$/) || [];
            const name = m[1] || "";
            const unit = m[2] || "";

            header.push(name); //remove header
            units.push(unit);
          }
          let values = [];
          for(let d=depthMaxIdx+1; d<n_c; d++){
            values.push(parseFloat(source_data[i+1][d])); //remove header
          }
          
          calcedData.data_header = header;
          calcedData.data_values = values;
          calcedData.data_units  = units;

          output.push(calcedData);
        }

        const cvtData = cvt2flat(output);
        cvtData.name = source_path.name;

        const sendData = {
          name:"",
          path: source_path,
          data: cvtData,
          send_to:called_from,
          send_from:"Converter",
        };

        
        await window.ConverterApi.sendImportedData(await zip(sendData));
        console.log("[Converter]: Converted data is imported.");

        //colse window
        //window.close();

      } else {
        console.log("Unkown convert type.")
      }

      document.body.style.cursor = "default"; 
      document.getElementById("cvt_bt_convert").disabled = false;

      window.ConverterApi.clearProgressbar();
      //console.log(convertedData);
      
    }catch(err){
      console.log(err);
    }      
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
      
      if(dataList.length>1){
        alert("Only one file can be imported.");
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
    const result = await window.ConverterApi.progressbar("Depth converter", "Now loading...", true, "converterWindow");

    if(result){
      let data;
      [data, loadedpath] = await window.ConverterApi.cvtLoadCsv(
        "Please select the conversion target data",
        [
          {
            name: "CSV file",
            extensions: ["csv"],
          },
        ],
        path
      );
      source_data = await unzip(data);
    }
     await window.ConverterApi.clearProgressbar();


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
      document.getElementById("num_rows").textContent  = "Rows = "+source_data.length;
    }
   
  }
  async function unzip(result) {
  if (result == null) {
    return null;
  }

  try {
    // 1. Gunzip
    const ds = new DecompressionStream('gzip');
    const blob = new Blob([result]);
    const stream = blob.stream().pipeThrough(ds);
    const response = new Response(stream);
    
    const arrayBuffer = await response.arrayBuffer();

    // 2. MessagePack decode
    const decodedData = msgpack.decode(new Uint8Array(arrayBuffer));
    
    return decodedData;

  } catch (e) {
    console.error("[renderer] Gzip is failed to unzip:", e);
    return null; 
  }
  }
  async function zip(data) {
    // Return null if input is invalid
    if (data == null) {
      return null;
    }

    try {
      // 1. Encode to MessagePack (using msgpack-lite)
      const encoded = msgpack.encode(data);

      // 2. Compress with Gzip (using standard browser API)
      const cs = new CompressionStream('gzip');
      
      // Create a stream from the encoded data and pipe it through the compressor
      const blob = new Blob([encoded]);
      const stream = blob.stream().pipeThrough(cs);
      const response = new Response(stream);
      
      // Wait for the compression to finish and get the buffer
      const arrayBuffer = await response.arrayBuffer();

      // Return as Uint8Array
      return new Uint8Array(arrayBuffer);

    } catch (e) {
      console.error("[renderer] Failed to zip:", e);
      return null;
    }
  }
  function cvt2flat(depthConverterDataList){
    const flatData = {
      id: null,
      name: null,
      correlation_model_version:null,
      age_model_version: null,
      descriptions: null,
      
      header: [],
      units: [],
      rows: [],
    };

    //initiarise
    flatData.id   = null;
    flatData.name = null;
    flatData.correlation_model_version = depthConverterDataList[0].correlation_model_version;
    flatData.age_model_version         = depthConverterDataList[0].age_model_version;
    flatData.descriptions              = "";
    
    const dataHeader = depthConverterDataList[0].data_header;
    flatData.header  = ["id","name","project","hole","section","distance","composite_depth","event_free_depth","drilling_depth","age","age_upper","age_lower", "source_depth_type",...dataHeader];
    const dataUnits  = depthConverterDataList[0].data_units;
    flatData.units   = ["","","","","","","","","","","","","",...dataUnits];

    //data
    for(let r=0; r<depthConverterDataList.length; r++){
      const dt = depthConverterDataList[r];
      const row = [
        r,
        dt.name,
        dt.project,
        dt.hole,
        dt.section,
        dt.distance,
        dt.cd,
        dt.efd,
        dt.dd,
        dt.age_mid,
        dt.age_upper,
        dt.age_lower,
        dt.source_type,
        ...dt.data_values//spread
      ];

      flatData.rows.push(row);
    }

    //unit

    return flatData;
  }

  function getPathInfo(path) {
    const filename = path.replace(/\\/g, '/').split('/').pop();

    const lastDotIndex = filename.lastIndexOf('.');

    if (lastDotIndex < 1) { 
      return {
        name: filename, 
        ext: ""         
      };
    }

    return {
      name: filename.substring(0, lastDotIndex), 
      ext: filename.substring(lastDotIndex)    
    };
  }
});
