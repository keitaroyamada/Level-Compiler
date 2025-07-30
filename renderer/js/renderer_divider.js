document.addEventListener("DOMContentLoaded", () => {
  let projectList = [];
  let holeList = [];
  let sectionList = [];
  let interpolatedData = null;
  let calcDirection = "act->def";

  //-------------------------------------------------------------------------------------------
  //initialise
  window.DividerApi.receive("DividerToolClicked", async (data) => {
    await getList();
    await updateHoleList();
    await updateSectionList();
    await updateMarkerTable();
    updatePlot();
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
    let targetData = getTableData("target_table");

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
    }
 
    
    sortTable('target_table', 1);
  });
  //-------------------------------------------------------------------------------------------
  document.getElementById("add_batch_target").addEventListener("click", async (event) => {
    
     let askData = {
            title:"Batch input",
            label:"Please input strat distance(cm).",
            value:1.0,
            type:"number",
          };
      let start = parseFloat(await window.DividerApi.inputdialog(askData));
      if(start == null){
        return;
      }
      askData = {
            title:"Batch input",
            label:"Please input end distance(cm).",
            value:10.0,
            type:"number",
          };
      let end = parseFloat(await window.DividerApi.inputdialog(askData));
      if(end == null){
        return;
      }
      askData = {
            title:"Batch input",
            label:"Please input interval(cm).",
            value:1.0,
            type:"number",
          };
      let interval = parseFloat(await window.DividerApi.inputdialog(askData));
      if(interval == null){
        return;
      }

      console.log(start, interval, end)

    //add point data
    var table = document.getElementById("target_body");
    
    //make new row    
    console.log(calcDirection)

    let dist = start;
    let i = 1;
    while(dist <= end-interval){
      var row = table.insertRow();
      if(calcDirection == "act->def"){
        var cell0 = row.insertCell();
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        cell0.appendChild(checkbox);

        //Actural depth
        var cell1 = row.insertCell();
        cell1.textContent = "S"+String(i).padStart(3, '0'); //target name
        cell1.setAttribute("contenteditable", "true");
        var cell2 = row.insertCell();
        cell2.textContent = dist; //target upper
        makeCellNumericOnly(cell2);
        var cell3 = row.insertCell();
        cell3.textContent = dist+interval; //target lower
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
      }else{
        var cell0 = row.insertCell();
        var checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        cell0.appendChild(checkbox);

        //Actural depth
        var cell1 = row.insertCell();
        cell1.textContent = "S"+String(i).padStart(3, '0'); //target name
        cell1.setAttribute("contenteditable", "true");
        var cell2 = row.insertCell();
        cell2.textContent = null; //target upper
        var cell3 = row.insertCell();
        cell3.textContent = null; //target lower
        //Definition depth
        var cell4 = row.insertCell();
        cell4.textContent = dist; //definition depth of target upper
        makeCellNumericOnly(cell4);
        var cell5 = row.insertCell();
        cell5.textContent = dist+interval; //definition depth of target lower
        makeCellNumericOnly(cell5);
        var cell6 = row.insertCell();
        cell6.textContent = null; //definition age of target upper
        var cell7 = row.insertCell();
        cell7.textContent = null; //definition age of target lower
        var cell8 = row.insertCell();
        cell8.textContent = null; //polation type
      }

      dist += interval;
      i += 1;
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
      var userResponse = confirm("Do you want to update the definition table?");
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
    for (var i = rows.length - 1; i >= 0; i--) {
      table.deleteRow(i);
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
    const canvas = document.getElementById("plot_canvas");
    canvas.width = 200;
    canvas.height = 630;
    let ctx = canvas.getContext("2d");
    const padding_left = 50;
    const padding_top = 50;

    //get depth definition data from table
    var table = document.getElementById("depth_table");
    var rows = table.rows;
    //plot section
    const section_height = parseFloat(rows[rows.length - 1].cells[1].innerText) - parseFloat(rows[1].cells[1].innerText);
    const plot_height_rate = canvas.height / (section_height + padding_top * 2);

    //calc pos
    const y0 = (parseFloat(rows[1].cells[1].innerText) + padding_top) * plot_height_rate;
    const h = section_height * plot_height_rate;
    const x0 = padding_left;
    const w = 100;

    //plot
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
      const marker_name = rows[r].cells[0].innerText;
      const marker_def = Math.round(parseFloat(rows[r].cells[1].innerText) * 10)/10;
      const marker_act = parseFloat(rows[r].cells[2].innerText);

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
    const data = rows.map(row => {
        return Array.from(row.cells).map(cell => {
          const checkbox = cell.querySelector('input[type="checkbox"]');
          if (checkbox) {
            return checkbox.checked;
          }
          const text = cell.innerText.trim();
          return text === "" ? null : text;  
        });
    });
    return data;
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
  let targetData = getTableData("target_table");
  //const filteredTargetData = targetData.filter(row => row[0]===true);
  let depthData  = getTableData("depth_table");

  //sort data
  targetData.sort((item1, item2) => {
    return parseFloat(item1[1]) - parseFloat(item2[1]);
  });
  depthData.sort((item1, item2) => {
    return parseFloat(item1[1]) - parseFloat(item2[1]);
  });

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

  //for plot
  interpolatedData = resultList;

  //apply table
  for(let i=0;i<resultList.length;i++){
    const result = resultList[i];

    updateTableCell("target_table", i, 1, result.name); //name
    updateTableCell("target_table", i, 2, result.actual_distance_upper==null ? NaN : Math.round(result.actual_distance_upper * 10) / 10); //actural upper
    updateTableCell("target_table", i, 3, result.actual_distance_lower==null ? NaN : Math.round(result.actual_distance_lower * 10) / 10); //actural lower
    updateTableCell("target_table", i, 4, result.definition_distance_upper==null ? NaN : Math.round(result.definition_distance_upper * 10) / 10); //definition upper
    updateTableCell("target_table", i, 5, result.definition_distance_lower==null ? NaN: Math.round(result.definition_distance_lower * 10) / 10); //definition lower
    updateTableCell("target_table", i, 6, result.age_mid_upper==null ? NaN : Math.round(result.age_mid_upper * 10) / 10); //age upper
    updateTableCell("target_table", i, 7, result.age_mid_lower==null ? NaN : Math.round(result.age_mid_lower * 10) / 10); //age lower
    updateTableCell("target_table", i, 8, result.calc_type_upper +"/"+ result.calc_type_lower); //polation type

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
      "Actural distance upper (cm)",
      "Actural distance lower (cm)",
      "Definition distance upper (cm)", 
      "Definition distance lower (cm)",
      "Conversion direction",
      "Definition CD upper (cm)", 
      "Definition CD lower (cm)", 
      "Definition EFD upper (cm)", 
      "Definition EFD lower (cm)",
      "Definition Age upper (cm)", 
      "Definition Age lower (cm)", 
      "Calc method upper", 
      "Calc method lower",
      "Descriptions"
    ]];

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
        Math.round(interpolatedData[i].calc_type_upper*100)/100,
        Math.round(interpolatedData[i].calc_type_upper*100)/100,
        interpolatedData[i].descriptions
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
   //-------------------------------------------------------------------------------------------
});
