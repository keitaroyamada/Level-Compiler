document.addEventListener("DOMContentLoaded", () => {
  let projectList = [];
  let holeList = [];
  let sectionList = [];
  let interpolatedData = null;
  let calcDirection = "act->def";
  let   isDragging    = false;
  let dividerReady = false;

  //-------------------------------------------------------------------------------------------
  //initialise
  window.DividerApi.receive("DividerToolClicked", async (data) => {
    await getList();
    await updateHoleList();
    await updateSectionList();
    await updateMarkerTable();
    updatePlot();
    dividerReady = true;
    console.log("[Divider]: Divider making");
  });
  //-------------------------------------------------------------------------------------------

  //hole
  document.getElementById("holeOptions").addEventListener("change", async (event) => {
      console.log(`Hole: ${event.target.value}`);

      //calc
      //change sec list
      await updateSectionList();
      await updateMarkerTable();
      updatePlot();
    });
  //-------------------------------------------------------------------------------------------
  //section
  document.getElementById("sectionOptions").addEventListener("change", async (event) => {
      
      //calc
      await updateMarkerTable();
      updatePlot();
      console.log(`Section: ${event.target.value}`);
    });
 //-------------------------------------------------------------------------------------------
  document.getElementById("add_definition").addEventListener("click", async (event) => {
    //add point data
    var table = document.getElementById("depth_body");
    
    //make new row
    var row = table.insertRow();

    var cell0 = row.insertCell();
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    
    cell0.appendChild(checkbox);

    //Actural depth
    var cell1 = row.insertCell();
    cell1.textContent = ""; //target name
    cell1.setAttribute("contenteditable", "true");
    var cell2 = row.insertCell();
    cell2.textContent = null; //target upper
    makeCellNumericOnly(cell2);
    var cell3 = row.insertCell();
    cell3.textContent = null; //target lower
    makeCellNumericOnly(cell3);
    
    sortTable('depth_table', 1);
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("remove_definition").addEventListener("click", async (event) => {
    const tbody = document.getElementById("depth_body");
    const rows = tbody.querySelectorAll("tr");
    rows.forEach(row => {
      const checkbox = row.querySelector("input[type='checkbox']");
      if (checkbox && checkbox.checked) {
        row.remove();
      }
    });
  });
 //-------------------------------------------------------------------------------------------
  document.getElementById("directionOptions").addEventListener("change", async (event) => {

    //get data
    let [targetData] = getTableData("target_table");

    if(event.target.value=="actual2definition"){
      calcDirection = "act->def";
      for(let i=0; i<targetData.length;i++){
      
        //updateTableCell("target_table", i, 0, ""); //name
        updateTableCell("target_table", i, 2, 0,    true); //actural upper
        updateTableCell("target_table", i, 3, 0,    true); //actural lower
        updateTableCell("target_table", i, 4, null, false); //definition upper
        updateTableCell("target_table", i, 5, null, false); //definition lower
        updateTableCell("target_table", i, 6, null, false); //age upper
        updateTableCell("target_table", i, 7, null, false); //age lower
        updateTableCell("target_table", i, 8, null, false); //polation type
      }
    }else{
      calcDirection = "def->act";
      for(let i=0; i<targetData.length;i++){
        //updateTableCell("target_table", i, 0, ""); //name
        updateTableCell("target_table", i, 2, null, false); //actural upper
        updateTableCell("target_table", i, 3, null, false); //actural lower
        updateTableCell("target_table", i, 4, 0,    true); //definition upper
        updateTableCell("target_table", i, 5, 0,    true); //definition lower
        updateTableCell("target_table", i, 6, null, false); //age upper
        updateTableCell("target_table", i, 7, null, false); //age lower
        updateTableCell("target_table", i, 8, null, false); //polation type
      } 
    }
    console.log(calcDirection)
  });
 //-------------------------------------------------------------------------------------------
  document.getElementById("add_target").addEventListener("click", async (event) => {
    //add point data
    var table = document.getElementById("target_body");
    
    //make new row
    var row = table.insertRow();
    console.log(calcDirection)

    if(calcDirection == "act->def"){
      var cell0 = row.insertCell();
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      cell0.appendChild(checkbox);

      //Actural depth
      var cell1 = row.insertCell();
      cell1.textContent = ""; //target name
      cell1.setAttribute("contenteditable", "true");
      var cell2 = row.insertCell();
      cell2.textContent = 0; //target upper
      makeCellNumericOnly(cell2);
      var cell3 = row.insertCell();
      cell3.textContent = 0; //target lower
      makeCellNumericOnly(cell3);
      //Definition depth
      var cell4 = row.insertCell();
      cell4.textContent = null; //definition depth of target upper
      //cell4.setAttribute("contenteditable", "false");
      var cell5 = row.insertCell();
      cell5.textContent = null; //definition depth of target lower
      //cell5.setAttribute("contenteditable", "false");
      var cell6 = row.insertCell();
      cell6.textContent = null; //definition age of target upper
      var cell7 = row.insertCell();
      cell7.textContent = null; //definition age of target lower
      var cell8 = row.insertCell();
      cell8.textContent = null; //polation type
      var cell9 = row.insertCell();
      cell9.textContent = null; //description
      cell9.setAttribute("contenteditable", "true");
    }else{
      var cell0 = row.insertCell();
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      cell0.appendChild(checkbox);

      //Actural depth
      var cell1 = row.insertCell();
      cell1.textContent = ""; //target name
      cell1.setAttribute("contenteditable", "true");
      var cell2 = row.insertCell();
      cell2.textContent = null; //target upper
      var cell3 = row.insertCell();
      cell3.textContent = null; //target lower
      //Definition depth
      var cell4 = row.insertCell();
      cell4.textContent = 0; //definition depth of target upper
      makeCellNumericOnly(cell4);
      var cell5 = row.insertCell();
      cell5.textContent = 0; //definition depth of target lower
      makeCellNumericOnly(cell5);
      var cell6 = row.insertCell();
      cell6.textContent = null; //definition age of target upper
      var cell7 = row.insertCell();
      cell7.textContent = null; //definition age of target lower
      var cell8 = row.insertCell();
      cell8.textContent = null; //polation type
      var cell9 = row.insertCell();
      cell9.textContent = null; //description
      cell9.setAttribute("contenteditable", "true");
    }
 
    
    sortTable('target_table', 1);
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("add_batch_target").addEventListener("click", async (event) => {
     //data: ["name","depth_data","target_id"] e.g. ["name",[projectName(no use),holeName, sectionName, distance],[null, null, null, null]]
    //type: "trinity", "composite_depth", "event_free_depth","age"
    //method(age): "linear"

    //get hole/section data
  const holeIdx = document.getElementById("holeOptions").value;
  const sectionIdx = document.getElementById("sectionOptions").value;

  const holeId = holeList[holeIdx][1];
  const holeName = holeList[holeIdx][2];
  const sectionId  = sectionList[holeIdx][sectionIdx][1];
  const sectionName  = sectionList[holeIdx][sectionIdx][2];
  
  //calc main
    let type = "Distance";

     let askData = {
            title:"Batch input",
            label:"Please input START position(cm).",
            value:1.0,
            type:"number",
          };
      let start = parseFloat(await window.DividerApi.inputdialog(askData));

      if(isNaN(start)){
        return;
      }
      askData = {
            title:"Batch input",
            label:"Please input END position(cm).",
            value:10.0,
            type:"number",
          };
      let end = parseFloat(await window.DividerApi.inputdialog(askData));
      if(isNaN(end)){
        return;
      }
      askData = {
            title:"Batch input",
            label:"Please input interval(cm).",
            value:1.0,
            type:"number",
          };
      let interval = parseFloat(await window.DividerApi.inputdialog(askData));
      if(isNaN(interval)){
        return;
      }

    //make target list
    console.log(start, interval, end)
    let targetLists = [];
    let posUpper;
    let distUpper;
    let distLower;
    if(type == "Distance"){
      posUpper = start;
      distUpper = start;
      distLower = start + interval;
    }else if(type == "Event free depth"){
      let options = {
        sourceType: "trinity",
        polationType: "linear",  
        allowOutside: true
      };
      const resultUpper = await window.DividerApi.depthConverter([["NoUse", ["NoUse", holeName, sectionName, start], sectionId]], options);
      posUpper = resultUpper.efd;
      options = {
        sourceType: "event_free_depth",
        polationType: "linear",  
        allowOutside: true
      };
      const resultLower = await window.DividerApi.depthConverter([["NoUse", posUpper+interval, sectionId]], options);
      distUpper = resultUpper.distance;
      distLower = resultLower.distance;
    }else if(type == "Age"){
      let options = {
        sourceType: "trinity",
        polationType: "linear",  
        allowOutside: true
      };
      const result = await window.DividerApi.depthConverter([["NoUse", ["NoUse", holeName, sectionName, start], sectionId]], options);
      posUpper = result.age_mid;
      options = {
        sourceType: "age",
        polationType: "linear",  
        allowOutside: true
      };
      const resultLower = await window.DividerApi.depthConverter([["NoUse", posUpper+interval, sectionId]], options);
      distUpper = resultUpper.distance;
      distLower = resultLower.distance;
    }

    let i = 1;
    while(distLower <= end){
      var target = [];
      if(calcDirection == "act->def"){
        //Actural depth
        target.push("S"+String(i).padStart(3, '0')); //target name
        target.push(distUpper); //target upper
        target.push(distLower); //target lower

        //Definition depth
        target.push(null); //definition depth of target upper
        target.push(null); //definition depth of target lower
        target.push(null); //definition age of target upper
        target.push(null); //definition age of target lower
        target.push(null); //polation type
      }else{
        //Actural depth
        target.push("S"+String(i).padStart(3, '0')); //target name
        target.push(null); //target upper
        target.push(null); //target lower

        //Definition depth
        target.push(distUpper); //definition depth of target upper
        target.push(distLower); //definition depth of target lower
        target.push(null); //definition age of target upper
        target.push(null); //definition age of target lower
        target.push(null); //polation type
      }
      targetLists.push(target);

      //for next interval
      if(type == "Distance"){
        posUpper  = distLower;
        distUpper = distLower;
        distLower = distLower + interval;
      }else if(type == "Event free depth"){
        posUpper += interval;
        const options = {
          sourceType: "event_free_depth",
          polationType: "linear",  
          allowOutside: true
        };
        const resultLower = await window.DividerApi.depthConverter([["NoUse", posUpper, sectionId]], options);
        
        distUpper = distLower;
        distLower = resultLower.distance;
      }else if(type == "Age"){
        posUpper += interval;
        const options = {
          sourceType: "age",
          polationType: "linear",  
          allowOutside: true
        };
        const resultLower = await window.DividerApi.depthConverter([["NoUse", posUpper, sectionId]], options);
        
        distUpper = distLower;
        distLower = resultLower.distance;
      }
      i += 1;
    }

    //add point data
    var table = document.getElementById("target_body");
    
    //make new row    
    //console.log(calcDirection)
    for (let i=0; i<targetLists.length;i++){
      var row = table.insertRow();
      const target = targetLists[i];

      var cell0 = row.insertCell();
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      cell0.appendChild(checkbox);

      //Actural depth
      var cell1 = row.insertCell();
      cell1.textContent = target[0]; //target name
      cell1.setAttribute("contenteditable", "true");
      var cell2 = row.insertCell();
      cell2.textContent = target[1]; //target upper
      makeCellNumericOnly(cell2);
      var cell3 = row.insertCell();
      cell3.textContent = target[2]; //target lower
      makeCellNumericOnly(cell3);
      //Definition depth
      var cell4 = row.insertCell();
      cell4.textContent = target[3]; //definition depth of target upper
      //cell4.setAttribute("contenteditable", "false");
      var cell5 = row.insertCell();
      cell5.textContent = target[4]; //definition depth of target lower
      //cell5.setAttribute("contenteditable", "false");
      var cell6 = row.insertCell();
      cell6.textContent = target[5]; //definition age of target upper
      var cell7 = row.insertCell();
      cell7.textContent = target[6]; //definition age of target lower
      var cell8 = row.insertCell();
      cell8.textContent = target[7]; //polation type
      var cell9 = row.insertCell();
      cell9.textContent = null; //description
      cell9.setAttribute("contenteditable", "true");
    }
    
    
    sortTable('target_table', 1);
  });
 //-------------------------------------------------------------------------------------------
  document.getElementById("remove_target").addEventListener("click", async (event) => {
    const tbody = document.getElementById("target_body");
    const rows = tbody.querySelectorAll("tr");
    rows.forEach(row => {
      const checkbox = row.querySelector("input[type='checkbox']");
      if (checkbox && checkbox.checked) {
        row.remove();
      }
    });
    updatePlot();
  });
 //-------------------------------------------------------------------------------------------
  document.getElementById("target_check").addEventListener("change", e => {
    const checked = e.target.checked;
    document
      .querySelectorAll('#target_body input[type="checkbox"]')
      .forEach(cb => cb.checked = checked);

  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("depth_check").addEventListener("change", e => {
    const checked = e.target.checked;
    document
      .querySelectorAll('#depth_body input[type="checkbox"]')
      .forEach(cb => cb.checked = checked);
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById('divider1').addEventListener('mousedown', ()=>{ isDragging = "div1"; });
  document.addEventListener('mouseup',  ()=>{ isDragging = false; });
  document.addEventListener('mousemove', e=>{
    if (isDragging !== "div1") return;

    const container = document.getElementById('table_container');
    const depthDiv  = document.getElementById('depth_table_div');
    const divider1  = document.getElementById('divider1');
    const targetDiv = document.getElementById('target_table_div');
    const divider2  = document.getElementById('divider2');
    const canvasDiv = document.getElementById('plot_canvas_div');
    const pgraphDiv = document.getElementById('plot_graph');
    const divider3  = document.getElementById('divider3');
    const plotDiv   = document.getElementById('plot_canvas');

    const parentWidth   = container.parentElement.getBoundingClientRect().width;
    const plotWidth     = plotDiv.getBoundingClientRect().width;
    const targetWidth   = targetDiv.offsetWidth;
    const divider1Width = divider1.offsetWidth;
    const divider2Width = divider2.offsetWidth;
        
    let offset = e.clientX - container.getBoundingClientRect().left; 
    offset = Math.max(offset, 100);
    offset = Math.min(offset, parentWidth - plotWidth - targetWidth - divider1Width - divider2Width - 10);
      
    depthDiv.style.width  = offset + 'px';

    updatePlot();
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById('divider2').addEventListener('mousedown', ()=>{ isDragging = "div2"; });
  document.addEventListener('mouseup',  ()=>{ isDragging = false; });
  document.addEventListener('mousemove', e=>{
    if (isDragging !== "div2") return;
    
    const container = document.getElementById('table_container');
    const depthDiv  = document.getElementById('depth_table_div');
    const divider1  = document.getElementById('divider1');
    const targetDiv = document.getElementById('target_table_div');
    const divider2  = document.getElementById('divider2');
    const canvasDiv = document.getElementById('plot_canvas_div');
    const pgraphDiv = document.getElementById('plot_graph');
    const divider3  = document.getElementById('divider3');
    const plotDiv   = document.getElementById('plot_canvas');

    const parentWidth   = container.parentElement.getBoundingClientRect().width;
    const plotWidth     = plotDiv.getBoundingClientRect().width;
    const depthWidth    = depthDiv.offsetWidth;;
    const targetWidth   = targetDiv.offsetWidth;
    const divider1Width = divider1.offsetWidth;
    const divider2Width = divider2.offsetWidth;
        
    let offset = e.clientX - targetDiv.getBoundingClientRect().left; 
    offset = Math.max(offset, 100);
    offset = Math.min(offset, parentWidth - plotWidth - depthWidth - divider1Width - divider2Width - 10);
      
    targetDiv.style.width  = offset + 'px';

    updatePlot();
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById('divider3').addEventListener('mousedown', ()=>{ isDragging = "div3"; });
  document.addEventListener('mouseup',  ()=>{ isDragging = false; });
  document.addEventListener('mousemove', e=>{
    if (isDragging !== "div3") return;
    const rect   = document.getElementById('plot_canvas_div').getBoundingClientRect();
    let offset = e.clientY - rect.top; 
    offset = Math.max(offset, 50);
    offset = Math.min(offset, rect.width - 50);
    document.getElementById('plot_graph').style.height = offset + 'px';
    document.getElementById('plot_canvas').style.height = (rect.height - offset - document.getElementById('divider3').offsetHeight) + 'px';
    updatePlot();
  });
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
  async function getList() {
    //get hole list
    [projectList, holeList, sectionList] = await window.DividerApi.dividerGetCoreList();
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
  async function updateMarkerTable() {
    var table = document.getElementById("depth_body");
    var rows = table.rows;

    if (rows.length > 1) {
      const userResponse = await window.DividerApi.Confirm(
        {
          title:"Confirm",
          message:"Do you want to update the definition table?",
          parent: "divider"
        }
      );
      
      //var userResponse = confirm("Do you want to update the definition table?");
      if (userResponse == false) {
        return;
      }
    }

    //if true
    const selectedHole = document.getElementById("holeOptions").value;
    const selectedSection = document.getElementById("sectionOptions").value;
    const markerList = sectionList[selectedHole][selectedSection][5];

    //apply data into table
    //initialise table
    while (table.rows.length > 0) { 
      table.deleteRow(0);           
    } 

    //add data
    for (let i = 0; i < markerList.length; i++) {
      //make new row
      var row = table.insertRow();

      var cell0 = row.insertCell();
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      cell0.appendChild(checkbox);
      
      var cell1 = row.insertCell();
      cell1.textContent = markerList[i].name;
      cell1.setAttribute("contenteditable", "true");
      var cell2 = row.insertCell();
      cell2.textContent = Math.round(parseFloat(markerList[i].distance)*10)/10;
      var cell3 = row.insertCell();
      cell3.textContent = Math.round(parseFloat(markerList[i].distance)*10)/10;
      makeCellNumericOnly(cell3);      
    }

    await window.DividerApi.dividerReflow();
    
  }
  //-------------------------------------------------------------------------------------------
  function makeCellNumericOnly(cell) {
    cell.setAttribute("contenteditable", "true");
    cell.addEventListener("input", function (e) {
      const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        const cursorPosition = range.startOffset;

        e.target.innerText = e.target.innerText
        .replace(/(?!^)-/g, "")
        .replace(/[^0-9\-.]/g, "");

        if (!e.target.firstChild) {
          return;
          //e.target.appendChild(document.createTextNode(""));
        }

        range.setStart(e.target.firstChild, Math.min(cursorPosition, e.target.innerText.length));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    });
    cell.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
  }
  //-------------------------------------------------------------------------------------------
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  //-------------------------------------------------------------------------------------------
  function updatePlot() {
    //show model-------------------------------------------------------------------------------
    const canvas = document.getElementById("plot_canvas");

    const rectCanvas = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rectCanvas.width * dpr;
    canvas.height = rectCanvas.height * dpr;
    
    let ctx = canvas.getContext("2d");

    const padding_left = 50;
    const padding_top = 50;

    //get depth definition data from table
    var table = document.getElementById("depth_table");
    var rows = table.rows;

    //plot section
    const section_height = parseFloat(rows[rows.length - 1].cells[2].innerText) - parseFloat(rows[1].cells[2].innerText);
    const plot_height_rate = canvas.height / (section_height + padding_top * 2);

    //calc pos
    const y0 = (parseFloat(rows[1].cells[2].innerText) + padding_top) * plot_height_rate;
    const h = section_height * plot_height_rate;
    const x0 = padding_left;
    const w = 100;

    //plot target
    ctx.lineWidth = 1;
    ctx.strokeStyle = "black";
    ctx.fillStyle = "lightgray";
    ctx.beginPath();
    ctx.strokeRect(x0, y0, w, h);
    ctx.fillRect(x0, y0, w, h);
    ctx.stroke();
    ctx.fillStyle = "black";
    ctx.font = "15px Arial";
    //ctx.fillText(           );

    for (let r = 1; r < rows.length; r++) {
      const marker_name = rows[r].cells[1].innerText;
      const marker_def = Math.round(parseFloat(rows[r].cells[2].innerText) * 10)/10;
      const marker_act = parseFloat(rows[r].cells[3].innerText);

      let marker_act_exist = false;

      if (!isNaN(marker_act)) {
        marker_act_exist = true;
      }

      //plot
      ctx.lineWidth = 1;
      ctx.strokeStyle = "black";
      if (marker_act_exist) {
        ctx.strokeStyle = "blue";
      }
      ctx.beginPath();
      ctx.moveTo(x0, (marker_def + padding_top) * plot_height_rate); //start point
      ctx.lineTo(x0 + w, (marker_def + padding_top) * plot_height_rate); //end point
      ctx.stroke();
      ctx.fillText(
        marker_name,
        x0 + w + 5,
        (marker_def + padding_top) * plot_height_rate
      );
      ctx.fillText(
        marker_def,
        x0 - 40,
        (marker_def + padding_top) * plot_height_rate
      );

      if(interpolatedData !== null){
        for(let i=0;i<interpolatedData.length;i++){
          const px = x0 + w * 0.3;
          const py0 = (interpolatedData[i].definition_distance_upper + padding_top) * plot_height_rate;
          const py1 = (interpolatedData[i].definition_distance_lower + padding_top) * plot_height_rate;

          if(interpolatedData[i].calc_type_lower == "extraplation" || interpolatedData[i].calc_type_upper == "extrapolation"){
            ctx.strokeStyle = "Red";
          }else{
            ctx.strokeStyle = "Black";
          }
          ctx.beginPath();
          ctx.strokeRect(px, py0, 10, py1-py0);
          //ctx.fillRect(px, py0, 10, py1-py0);
          ctx.stroke();
        }
      }
    }


    //plot graph-----------------------------------------------------------------------
    const graph  = document.getElementById("plot_graph");
    const rectGraph = graph.getBoundingClientRect();
    graph.width  = rectGraph.width * dpr;
    graph.height = rectGraph.width * dpr;

    let ctx2 = graph.getContext("2d");
    
    // --- clear plot area ---
    ctx2.clearRect(0, 0, graph.width, graph.height);
    const rowsData = Array.from(rows);

    const margin = { left: 70, right: 20, top: 70, bottom: 20 };
    const graphH   = graph.height - margin.top  - margin.bottom;
    const graphW   = graphH;

    // --- extract data and compute ranges ---
    const defs = rowsData.filter(r => r.cells[0].querySelector('input[type="checkbox"]')?.checked).map(r => parseFloat(r.cells[2].innerText)).filter(v => !isNaN(v));
    const acts = rowsData.filter(r => r.cells[0].querySelector('input[type="checkbox"]')?.checked).map(r => parseFloat(r.cells[3].innerText)).filter(v => !isNaN(v));
    const targetTable = document.getElementById("target_table");
    const targetRows  = Array.from(targetTable.tBodies[0].rows);
    const targetActsUpper = targetRows.map(r => parseFloat(r.cells[2].innerText)).filter(v => !isNaN(v));
    const targetActsLower = targetRows.map(r => parseFloat(r.cells[3].innerText)).filter(v => !isNaN(v));
    const targetDefsUpper = targetRows.map(r => parseFloat(r.cells[4].innerText)).filter(v => !isNaN(v));
    const targetDefsLower = targetRows.map(r => parseFloat(r.cells[5].innerText)).filter(v => !isNaN(v));
    const allDefs = defs.concat(targetDefsUpper, targetDefsLower);
    const allActs = acts.concat(targetActsUpper, targetActsLower);
    const xMin = Math.min(...allDefs), xMax = Math.max(...allDefs);
    const yMin = Math.min(...allActs), yMax = Math.max(...allActs);

    // --- draw axes ---
    ctx2.strokeStyle = 'black';
    ctx2.lineWidth = 2;
    // X axis
    const zeroY = margin.top + ((0 - yMin) / (yMax - yMin)) * graphH;
    // X axis at bottom
    //ctx2.beginPath();
    //ctx2.moveTo(margin.left,             margin.top + graphH);
    //ctx2.lineTo(margin.left + graphW,    margin.top + graphH);
    //ctx2.stroke();
    ctx2.beginPath();
    ctx2.moveTo(margin.left, zeroY);
    ctx2.lineTo(margin.left + graphW, zeroY);
    ctx2.stroke();

    // Y axis
    ctx2.beginPath();
    ctx2.moveTo(margin.left,             margin.top);
    ctx2.lineTo(margin.left,             margin.top + graphH);
    ctx2.stroke();

    // --- draw X ticks and labels ---
    ctx2.fillStyle = 'black';
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'top';
    const xTicks = 5;
    const tickStepX = Math.ceil((xMax - xMin) / xTicks / 10) * 10;
    const niceMinX = Math.floor(xMin / tickStepX) * tickStepX;
    const niceMaxX = Math.ceil(xMax / tickStepX) * tickStepX;
    for (let i = 0; i <= xTicks; i++) {
      const v = niceMinX + i * ((niceMaxX - niceMinX) / xTicks);
      const x = margin.left + ((v - niceMinX) / (niceMaxX - niceMinX)) * graphW;
      ctx2.beginPath();
      //ctx2.moveTo(x, margin.top + graphH);
      //ctx2.lineTo(x, margin.top + graphH + 5);
      ctx2.moveTo(x, zeroY);
      ctx2.lineTo(x, zeroY - 5);
      ctx2.stroke();
      //ctx2.fillText(v, x, margin.top + graphH + 8);
      ctx2.font = "20px Arial"
      ctx2.fillText(v, x, zeroY - 25);
    }

    // --- draw Y ticks and labels ---
    ctx2.textAlign = 'right';
    ctx2.textBaseline = 'middle';
    const yTicks = 5;
    const tickStep = Math.ceil((yMax - yMin) / yTicks / 10) * 10;
    const niceMin = Math.floor(yMin / tickStep) * tickStep;
    const niceMax = Math.ceil(yMax / tickStep) * tickStep;
    for (let i = 0; i <= yTicks; i++) {
      
      const v = niceMin + i * ((niceMax - niceMin) / yTicks);
      const y = margin.top + ((v - niceMin) / (niceMax - niceMin)) * graphH;

      ctx2.beginPath();
      ctx2.moveTo(margin.left, y);
      ctx2.lineTo(margin.left - 5, y);
      ctx2.stroke();
      ctx2.fillText(v, margin.left - 8, y);
    }

    // --- axis titles ---
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'bottom';
    //ctx2.fillText('Definition (cm)', margin.left + graphW / 2, margin.top + graphH + 40);
    ctx2.fillText('Definition (cm)', margin.left + graphW / 2, zeroY - 30);

    ctx2.save();
    ctx2.translate(margin.left - 40, margin.top + graphH / 2);
    ctx2.rotate(-Math.PI / 2);
    ctx2.textAlign = 'center';
    ctx2.textBaseline = 'middle';
    ctx2.fillText('Actual (cm)', 0, -10);
    ctx2.restore();

    //legends
    const ledx = margin.left  + (xMax  / (xMax - xMin) * graphW) * 0.1;
    const ledy = margin.top + (yMax  / (xMax - xMin) * graphH) * 0.8;
    ctx2.strokeStyle = 'blue';
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    ctx2.moveTo(ledx, ledy);
    ctx2.lineTo(ledx+20, ledy+10)
    ctx2.stroke();
    ctx2.textAlign = "left";
    ctx2.textBaseline = "middle";
    ctx2.fillText('model', ledx+30, ledy+5);
    ctx2.beginPath();
    ctx2.fillStyle = 'blue';
    ctx2.arc(ledx+5, ledy+30, 5, 0, 2 * Math.PI);
    ctx2.fill();
    ctx2.fillStyle = 'black';
    ctx2.fillText('Control point', ledx+30, ledy+35);
    ctx2.strokeStyle = 'red';
    ctx2.strokeRect(ledx, ledy+60,10,10);
    ctx2.fillStyle = 'black';
    ctx2.fillText('Sampling point', ledx+30, ledy+65);


    // --- prepare points ---
    const points = defs.map((d, i) => {
      const a = acts[i];
      return {
        x: margin.left + ((d - xMin) / (xMax - xMin)) * graphW,
        y: margin.top  + ((a - yMin) / (yMax - yMin)) * graphH
      };
    });

    // --- draw line ---
    ctx2.strokeStyle = 'blue';
    ctx2.lineWidth = 2;
    ctx2.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx2.moveTo(p.x, p.y);
      else         ctx2.lineTo(p.x, p.y);
    });
    ctx2.stroke();

    // --- draw circles ---
    ctx2.fillStyle = 'blue';
    points.forEach(p => {
      ctx2.beginPath();
      ctx2.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      ctx2.fill();
    });

    // --- plot targettable data as red squares
    const targetPoints = targetRows.map(r => {
      const au = parseFloat(r.cells[2].innerText);
      const al = parseFloat(r.cells[3].innerText);
      const du = parseFloat(r.cells[4].innerText);
      const dl = parseFloat(r.cells[5].innerText);

      if (isNaN(au) || isNaN(al) || isNaN(du) || isNaN(dl)) return null;
      return {
        x: margin.left + ((du - xMin) / (xMax - xMin)) * graphW,
        y: margin.top  + ((au - yMin) / (yMax - yMin)) * graphH,
        w: ((dl - du) / (xMax - xMin)) * graphW,
        h: ((al - au) / (yMax - yMin)) * graphH,
      };
    }).filter(p => p);
    ctx2.strokeStyle = 'red';
    targetPoints.forEach(p => {
      ctx2.strokeRect(p.x, p.y, p.w, p.h);
    });

    
    ctx2
  }
  //-------------------------------------------------------------------------------------------
  function sortTable(tableId, columnIndex) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.rows);

    rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[columnIndex].innerText;
        const cellB = rowB.cells[columnIndex].innerText;
        return cellA.localeCompare(cellB, undefined, { numeric: true });
    });

    rows.forEach(row => tbody.appendChild(row));  
  }

  function getTableData(targetName) {
    const table = document.getElementById(targetName);
    const tbody = table.querySelector("tbody");
    const rows = Array.from(tbody.rows);
    const data = rows
      .map((row, idx) => {
        if (!row.querySelector('input[type="checkbox"]')?.checked) return null;
        return {
          index: idx,
          values: Array.from(row.cells).map((cell, i) => {
            if(i === 0){
              return true; // checked
            }

            const text = cell.innerText.trim();
            return text === "" ? null : text;  
          })
        };
    }).filter(v => v !== null);

    return [data.map(v => v.values), data.map(v => v.index)]
  }
  function updateTableCell(tableId, rowIndex, colIndex, value, editable=false) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector("tbody");
    if (!tbody) return; 
    
    const cell = tbody.rows[rowIndex]?.cells[colIndex];
    if (cell) {
        cell.innerText = value;
        cell.setAttribute("contenteditable", editable);
    }
  }
document.getElementById("depth_table").addEventListener("input", (e) => {
  updatePlot();
});
document.getElementById("depth_name").addEventListener("click", () => {
  sortTable('depth_table', 1);
  console.group("[Divider]: Definition table is Sorted by name.");
  window.DividerApi.rendererLog("[Divider]: Definition table is Sorted by name.");
});
document.getElementById("depth_definition").addEventListener("click", () => {
  sortTable('depth_table', 2);
  console.group("[Divider]: Definition table is Sorted by definition depth.");
  window.DividerApi.rendererLog("[Divider]: Definition table is Sorted by definition depth.");
});
document.getElementById("depth_actural").addEventListener("click", () => {
  sortTable('depth_table', 3);
  console.group("[Divider]: Definition table is Sorted by actural depth.");
  window.DividerApi.rendererLog("[Divider]: Definition table is Sorted by actural depth.");
});
document.getElementById("target_upper").addEventListener("click", () => {
  if(calcDirection=="act->def"){
    sortTable('target_table', 2);
    console.group("[Divider]: Target table is Sorted by actual upper depth.");
    window.DividerApi.rendererLog("[Divider]: Target table is Sorted by actual upper depth.");
  }  
});
document.getElementById("target_lower").addEventListener("click", () => {
  if(calcDirection=="act->def"){
    sortTable('target_table', 3);
    console.group("[Divider]: Target table is Sorted by actual lower depth.");
    window.DividerApi.rendererLog("[Divider]: Target table is Sorted by actual lower depth.");
  }
});
document.getElementById("definition_upper").addEventListener("click", () => {
  if(calcDirection=="def->act"){
    sortTable('target_table', 4);
    console.group("[Divider]: Target table is Sorted by definition upper depth.");
    window.DividerApi.rendererLog("[Divider]: Target table is Sorted by definition upper depth.");
  }  
});
document.getElementById("definition_lower").addEventListener("click", () => {
  if(calcDirection=="def->act"){
    sortTable('target_table', 5);
    console.group("[Divider]: Target table is Sorted by definition lower depth.");
    window.DividerApi.rendererLog("[Divider]: Target table is Sorted by definition lower depth.");
  }
});
  //-------------------------------------------------------------------------------------------
document.getElementById("calcButton").addEventListener("click", () => {
  //get data
  const [targetData, targetIdx] = getTableData("target_table");
  //const filteredTargetData = targetData.filter(row => row[0]===true);
  const [depthData] = getTableData("depth_table");

  if(targetData.length==0 || depthData.length==0) return;

  //sort data
  targetData.sort((item1, item2) => {
    return parseFloat(item1[1]) - parseFloat(item2[1]);
  });
  depthData.sort((item1, item2) => {
    return parseFloat(item1[1]) - parseFloat(item2[1]);
  });4

  //get hole/section data
  const holeIdx = document.getElementById("holeOptions").value;
  const sectionIdx = document.getElementById("sectionOptions").value;

  const holeId = holeList[holeIdx][1];
  const secId  = sectionList[holeIdx][sectionIdx][1];

  //calc main
  let resultList = window.DividerApi.dividerConverter([holeId, secId, depthData], targetData, calcDirection);
  console.log("[divider]: calced results", resultList);

  if(resultList==null){
    return
  }

  //for plot/export
  interpolatedData = resultList;

  //for counts
  const table = document.getElementById("target_table");
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.rows);

  //apply table
  for(let i=0;i<rows.length;i++){
    if(targetIdx.includes(i)){
      const idx = targetIdx.indexOf(i);
      const result = resultList[idx];

      updateTableCell("target_table", targetIdx[idx], 1, result.name); //name
      updateTableCell("target_table", targetIdx[idx], 2, result.actual_distance_upper==null ? NaN : Math.round(result.actual_distance_upper * 10) / 10); //actural upper
      updateTableCell("target_table", targetIdx[idx], 3, result.actual_distance_lower==null ? NaN : Math.round(result.actual_distance_lower * 10) / 10); //actural lower
      updateTableCell("target_table", targetIdx[idx], 4, result.definition_distance_upper==null ? NaN : Math.round(result.definition_distance_upper * 10) / 10); //definition upper
      updateTableCell("target_table", targetIdx[idx], 5, result.definition_distance_lower==null ? NaN: Math.round(result.definition_distance_lower * 10) / 10); //definition lower
      updateTableCell("target_table", targetIdx[idx], 6, result.age_mid_upper==null ? NaN : Math.round(result.age_mid_upper * 10) / 10); //age upper
      updateTableCell("target_table", targetIdx[idx], 7, result.age_mid_lower==null ? NaN : Math.round(result.age_mid_lower * 10) / 10); //age lower
      updateTableCell("target_table", targetIdx[idx], 8, result.calc_type_upper +"/"+ result.calc_type_lower); //polation type
    }else{
      //delete data
      //updateTableCell("target_table", i, 1, result.name); //name
      if(calcDirection == "def->act"){
        updateTableCell("target_table", i, 2, null); //age upper
        updateTableCell("target_table", i, 3, null); //age lower
      }else if(calcDirection == "act->def" ){
        updateTableCell("target_table", i, 4, null); //age upper
        updateTableCell("target_table", i, 5, null); //age lower
      }
      updateTableCell("target_table", i, 6, null); //age upper
      updateTableCell("target_table", i, 7, null); //age lower
      updateTableCell("target_table", i, 8, null); //polation type
    }
  }

  updatePlot();

  console.log("[Divider]: Calc depth and age.");
  window.DividerApi.rendererLog("[Divider]: Calc depth and age.");

});
document.getElementById("exportButton").addEventListener("click", () => {
  //initialise
  if(interpolatedData !== null){
    let output = [[
      "Name", 
      "Project",
      "Hole", 
      "Section",
      "Actural position upper (cm)",
      "Actural position lower (cm)",
      "Definition position upper (cm)", 
      "Definition position lower (cm)",
      "Conversion direction",
      "Definition CD upper (cm)", 
      "Definition CD lower (cm)", 
      "Definition EFD upper (cm)", 
      "Definition EFD lower (cm)",
      "Definition Age upper (cm)", 
      "Definition Age lower (cm)", 
      "Calc method upper", 
      "Calc method lower",
      "Descriptions (system)",
      "Descriptions (user)",
    ]];

    const [targetData, targetIdx] = getTableData("target_table");

    for(let i=0; i<interpolatedData.length; i++){
      const data = [
        interpolatedData[i].name,
        interpolatedData[i].project,
        interpolatedData[i].hole,
        interpolatedData[i].section,
        Math.round(interpolatedData[i].actual_distance_upper*100)/100,
        Math.round(interpolatedData[i].actual_distance_lower*100)/100,
        Math.round(interpolatedData[i].definition_distance_upper*100)/100,
        Math.round(interpolatedData[i].definition_distance_lower*100)/100,
        interpolatedData[i].direction,
        Math.round(interpolatedData[i].definition_cd_upper*100)/100,
        Math.round(interpolatedData[i].definition_cd_lower*100)/100,
        Math.round(interpolatedData[i].definition_efd_upper*100)/100,
        Math.round(interpolatedData[i].definition_efd_lower*100)/100,
        Math.round(interpolatedData[i].age_mid_upper*100)/100,
        Math.round(interpolatedData[i].age_mid_lower*100)/100,
        interpolatedData[i].calc_type_upper,
        interpolatedData[i].calc_type_upper,
        interpolatedData[i].descriptions,
        targetData[i][9]
      ];
      
      output.push(data);
       /*
      name:    targetRowData[0],
      project: depthList[0].project_name,
      hole:    depthList[0].hole_name,
      section: depthList[0].section_name,
      definition_distance_lower:null,
      definition_distance_upper:null,
      definition_cd_upper: null,
      definition_cd_lower: null,
      definition_efd_upper: null,
      definition_efd_lower: null,
      target_distance_lower: parseFloat(targetRowData[2]),
      target_distance_upper: parseFloat(targetRowData[1]),
      age_mid_lower:null,
      age_mid_upper:null,
      age_upper_lower:null,
      age_upper_upper:null,
      age_lower_lower:null,
      age_lower_upper:null,
      calc_type_upper: null,
      calc_type_lower: null
      */
    }

    window.DividerApi.writeCsv(output);
    console.log("[DIvider]: Divided list is exported.");
    window.DividerApi.rendererLog("[DIvider]: Divided list is exported.");
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "F12") {
    window.DividerApi.toggleDevTools("divider");
  }
});

  window.__LC_DIVIDER_E2E__ = {
    isReady: () => dividerReady,
    getState: () => ({
      holeCount: document.getElementById("holeOptions").options.length,
      sectionCount: document.getElementById("sectionOptions").options.length,
      calcDirection: document.getElementById("directionOptions").value,
    }),
  };
   //-------------------------------------------------------------------------------------------
});
