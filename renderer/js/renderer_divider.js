document.addEventListener("DOMContentLoaded", () => {
  let holeList = [];
  let sectionList = [];
  //-------------------------------------------------------------------------------------------
  //initiarise
  window.DividerApi.receive("DividerToolClicked", async (data) => {
    await getList();
    await updateHoleList();
    await updateSectionList();
    await updateMarkerList();
    updatePlot();
    console.log("Divider making");
  });
  //-------------------------------------------------------------------------------------------

  //hole
  document
    .getElementById("holeOptions")
    .addEventListener("change", async (event) => {
      console.log(`Hole: ${event.target.value}`);

      //calc
      //change sec list
      await updateSectionList();
      await updateMarkerList();
      updatePlot();
    });
  //-------------------------------------------------------------------------------------------
  //section
  document
    .getElementById("sectionOptions")
    .addEventListener("change", async (event) => {
      console.log(`Section: ${event.target.value}`);
      //calc
      await updateMarkerList();
      updatePlot();
    });
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------

  //-------------------------------------------------------------------------------------------
  async function getList() {
    //get hole list
    [holeList, sectionList] = await window.DividerApi.dividerGetCoreList();
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
  async function updateMarkerList() {
    var table = document.getElementById("depth_table");
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
    //initiarise table
    for (var i = rows.length - 1; i > 0; i--) {
      table.deleteRow(i);
    }

    //add data
    for (let i = 0; i < markerList.length; i++) {
      //make new row
      var row = table.insertRow();
      var cell1 = row.insertCell();
      cell1.textContent = markerList[i].name;
      var cell2 = row.insertCell();
      cell2.textContent = markerList[i].distance;
      var cell3 = row.insertCell();

      cell3.textContent = "";
      makeCellNumericOnly(cell3);
    }
  }
  //-------------------------------------------------------------------------------------------
  function makeCellNumericOnly(cell) {
    cell.setAttribute("contenteditable", "true");
    cell.addEventListener("input", function (e) {
      if (isNaN(e.target.innerText)) {
        e.target.innerText = e.target.innerText.replace(/[^0-9]/g, "");
      }
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
    canvas.height = 500;
    let ctx = canvas.getContext("2d");
    const padding_left = 50;
    const padding_top = 10;

    //get depth definition data from table
    var table = document.getElementById("depth_table");
    var rows = table.rows;
    //plot section
    const section_height =
      parseFloat(rows[rows.length - 1].cells[1].innerText) -
      parseFloat(rows[1].cells[1].innerText);
    const plot_height_rate = canvas.height / (section_height + padding_top * 2);

    //calc pos
    const y0 =
      (parseFloat(rows[1].cells[1].innerText) + padding_top) * plot_height_rate;
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
      const marker_def = parseFloat(rows[r].cells[1].innerText);
      const marker_act = parseFloat(rows[r].cells[2].innerText);

      let marker_act_exist = false;

      if (!isNaN(marker_act)) {
        console.log(marker_act);
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
    }
  }
  //-------------------------------------------------------------------------------------------
  //-------------------------------------------------------------------------------------------
});
