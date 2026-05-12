document.addEventListener("DOMContentLoaded", () => {
  let source_data = null;
  let source_path = null;
  let n_r = null;
  let n_c = null;
  let output_type = "export";
  let called_from = "";
  let headerLines = 1;
  let dataId = null;
  let converterReady = false;
  function showAlertDialog(message, title = "Alert") {
    return window.LCModal.show({
      title,
      message,
      submitLabel: "OK",
      hideCancel: true,
    });
  }
  //-------------------------------------------------------------------------------------------
  window.ConverterApi.receive("ConverterMenuClicked", async (data) => {
    output_type = data.output_type;
    called_from = data.called_from;
    source_path = data.path;

    console.log("[Converter]: Conterter starting type: " + output_type);

    if(output_type == "export"){
      document.getElementById("cvt_bt_convert").textContent = "Export";
      document.querySelectorAll('.check_outside, .precision_output, .check_unconnected').forEach(el => el.style.display = 'flex');
    } else if (output_type == "import"){
      document.getElementById("cvt_bt_convert").textContent = "Import";
      document.querySelectorAll('.precision_output').forEach(el => el.style.display = 'none');
      document.querySelectorAll('.check_outside','.check_unconnected').forEach(el => el.style.display = 'flex');
      document.querySelectorAll('.check_outside input[type="checkbox"]').forEach(el => el.checked = true);
      document.querySelectorAll('.check_unconnected input[type="checkbox"]').forEach(el => el.checked = true);
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

    converterReady = true;
  });
  //-------------------------------------------------------------------------------------------
  //load data
  document.getElementById("cvt_bt_import").addEventListener("click", async (event) => {
    //select csv button
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
          const disp = ["Name", "Hole", "Section", "Position"];
          const key = {
            Name:["name"],
            Hole:["hole"],
            Section:["sec","core number"],
            Position:["dist","psp","position"],
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
      //await window.ConverterApi.progressbar("Depth converter", "Now checking...", true, "converterWindow");

      console.log("[Converter]: Converting...");
      document.body.style.cursor = "wait"; 

      const precision = parseInt(document.getElementById("precision").value, 10);

      //get model ids
      const corId = parseInt(document.getElementById("cvt_correlation_model").value.split(",")[0]);
      const ageId = parseInt(document.getElementById("cvt_age_model").value.split(",")[0]);
      let modelIds = {correlation: corId,  age: ageId};

      //get source type
      const sourceType   = document.getElementById("cvt_source_type").value;
      let depthMaxIdx    = 0;
      const allowOutside = document.getElementById("allow_outside_data").checked;
      const allowUnconnected = document.getElementById("allow_unconnected_models").checked;
      
      //make send data
      const sendData = {
        //for preparation
        id: dataId,
        sourceType: sourceType,
        nameIdx: null,
        holeIdx: null, 
        sectionIdx: null, 
        distanceIdx: null,
        cdIdx: null,
        efdIdx: null,
        ddIdx: null,
        ageIdx: null,
        dataStartFrom: null,
        headerLines: headerLines,

        //for converter
        polationType: "linear",  
        returnType: "min",
        outType: output_type,//"export" or "import"
        allowOutside: allowOutside,
        isForceCalculation: allowUnconnected,// disable safety for model whitch not connect master model
        callFrom: (output_type == "export") ? "converter" : "plotter",
        isZip: true,
        precision:precision        
      };

      if (sourceType == "trinity") {
        sendData.nameIdx       = parseInt(document.getElementById("depth_chooser0").value);
        sendData.holeIdx       = parseInt(document.getElementById("depth_chooser1").value);
        sendData.sectionIdx    = parseInt(document.getElementById("depth_chooser2").value);
        sendData.distanceIdx   = parseInt(document.getElementById("depth_chooser3").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.holeIdx, sendData.sectionIdx, sendData.distanceIdx]);
      } else if (sourceType == "composite_depth") {
        sendData.nameIdx       = parseInt(document.getElementById("depth_chooser0").value);
        sendData.cdIdx         = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.cdIdx]);        
      } else if (sourceType == "event_free_depth") {
        sendData.nameIdx       = parseInt(document.getElementById("depth_chooser0").value);
        sendData.efdIdx        = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.efdIdx]);
      } else if (sourceType == "drilling_depth") {
        sendData.nameIdx       = parseInt(document.getElementById("depth_chooser0").value);
        sendData.ddIdx         = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.ddIdx]);
      } else if (sourceType == "age") {
        sendData.nameIdx       = parseInt(document.getElementById("depth_chooser0").value);
        sendData.ageIdx        = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.ageIdx]);
      }

      //convert
      const result = await window.ConverterApi.cvtConverter({
        options: await zip(sendData),
      });
      
      if(result.ok){
        console.log("[Converter]: Converted data is exported successfully.");
      }else{          
        showAlertDialog(result.reason);
        console.log("[Converter]: Failed to export.",result.reason);
        document.body.style.cursor = "default";
      }

      //finish
      document.body.style.cursor = "default";
      //window.ConverterApi.clearProgressbar();
      document.getElementById("cvt_bt_convert").disabled = false;
      //console.log(convertedData);

      return
    }catch(err){
      console.log("[Converter]: Failed to convert.",err);
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
        showAlertDialog("Only one file can be imported.");
        return
      }
      //load
      for(let d=0;d<dataList.length;d++){
        //initialise
        source_data = null;
        dataId      = null;

        await loadCsv(dataList[d].fullpath);
      }

      

    });
  async function loadCsv(path){
    //const result = await window.ConverterApi.progressbar("Depth converter", "Now loading...", true, "converterWindow");

    let numRows = 0;
    const zippedResults = await window.ConverterApi.cvtLoadCsv({
      title: "Please select the conversion target data",
      ext: [
        {
          name: "CSV file",
          extensions: ["csv"],
        },
      ],
      pathData: path,
    });
      const unzippedResults = await unzip(zippedResults);

      source_data = unzippedResults.data;
      loadedpath  = unzippedResults.path;
      numRows     = unzippedResults.counts;
      dataId      = unzippedResults.id;
     //await window.ConverterApi.clearProgressbar();


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
      document.getElementById("num_rows").textContent  = "Rows = " + numRows;
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

  window.__LC_CONVERTER_E2E__ = {
    isReady: () => converterReady,
    getState: () => ({
      outputType: output_type,
      calledFrom: called_from,
    }),
    loadCsvFromPath: async (inputPath) => {
      await loadCsv(inputPath);
      const chooserCount = document.querySelectorAll("[id^='depth_chooser']").length;
      return {
        path: loadedpath,
        counts: source_data == null ? 0 : source_data.length,
        previewRows: Array.isArray(source_data) ? source_data.length : 0,
        chooserCount,
      };
    },
    runConverterPayload: async () => {
      for (let i = 0; i < 20; i++) {
        if (document.getElementById("depth_chooser0") != null) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const sourceType = document.getElementById("cvt_source_type").value;
      const sendData = {
        id: dataId,
        sourceType,
        polationType: "linear",
        returnType: "min",
        headerLines,
        outType: "import",
        allowOutside: true,
        isForceCalculation: true,
        callFrom: "converter",
        isZip: true,
        precision: 1,
      };
      const chooser0 = document.getElementById("depth_chooser0");
      if (chooser0 == null) {
        return { ok: false, reason: "source chooser is not ready." };
      }

      if (sourceType === "age") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.ageIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.ageIdx]);
      } else if (sourceType === "trinity") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.holeIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.sectionIdx = parseInt(document.getElementById("depth_chooser2").value);
        sendData.distanceIdx = parseInt(document.getElementById("depth_chooser3").value);
        sendData.dataStartFrom = Math.max(
          ...[sendData.nameIdx, sendData.holeIdx, sendData.sectionIdx, sendData.distanceIdx]
        );
      } else if (sourceType === "composite_depth") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.cdIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.cdIdx]);
      } else if (sourceType === "event_free_depth") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.efdIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.efdIdx]);
      } else if (sourceType === "drilling_depth") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.ddIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.ddIdx]);
      } else {
        return { ok: false, reason: `unsupported_source_type:${sourceType}` };
      }

      return window.ConverterApi.cvtConverter({
        options: await zip(sendData),
      });
    },
    runCurrentPayload: async () => {
      for (let i = 0; i < 20; i++) {
        if (document.getElementById("depth_chooser0") != null) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const sourceType = document.getElementById("cvt_source_type").value;
      const sendData = {
        id: dataId,
        sourceType,
        polationType: "linear",
        returnType: "min",
        headerLines,
        outType: "import",
        allowOutside: true,
        isForceCalculation: true,
        callFrom: called_from || "converter",
        isZip: true,
        precision: 1,
      };
      const chooser0 = document.getElementById("depth_chooser0");
      if (chooser0 == null) {
        return { ok: false, reason: "source chooser is not ready." };
      }

      if (sourceType === "age") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.ageIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.ageIdx]);
      } else if (sourceType === "trinity") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.holeIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.sectionIdx = parseInt(document.getElementById("depth_chooser2").value);
        sendData.distanceIdx = parseInt(document.getElementById("depth_chooser3").value);
        sendData.dataStartFrom = Math.max(
          ...[sendData.nameIdx, sendData.holeIdx, sendData.sectionIdx, sendData.distanceIdx]
        );
      } else if (sourceType === "composite_depth") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.cdIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.cdIdx]);
      } else if (sourceType === "event_free_depth") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.efdIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.efdIdx]);
      } else if (sourceType === "drilling_depth") {
        sendData.nameIdx = parseInt(chooser0.value);
        sendData.ddIdx = parseInt(document.getElementById("depth_chooser1").value);
        sendData.dataStartFrom = Math.max(...[sendData.nameIdx, sendData.ddIdx]);
      } else {
        return { ok: false, reason: `unsupported_source_type:${sourceType}` };
      }

      return window.ConverterApi.cvtConverter({
        options: await zip(sendData),
      });
    },
  };
});

