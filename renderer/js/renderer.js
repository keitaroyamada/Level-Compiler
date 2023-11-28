document.addEventListener("DOMContentLoaded", () => {
  //============================================================================================
  //properties
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  const positioner = document.getElementById("positioner");
  let canvas = document.getElementById("plotCanvas");
  let ctx = canvas.getContext("2d");
  let offScreenCanvas = new OffscreenCanvas(1000, 1000);
  //document.createElement("canvas"); //make virtual canvas
  let offScreenCtx = offScreenCanvas.getContext("2d");
  const YAxisDropdown = document.getElementById("YAxisSelect");

  let LCCore = null;
  let correlation_model_list = [];
  let age_model_list = [];
  let selected_correlation_model_id = null;
  let selected_age_model_id = null;
  let finderEnable = false;
  let selectedObject = null;
  let mousePos = [0, 0]; //mouse absolute position
  let canvasPos = [0, 0]; //canvas scroller position
  //--------------------------------------------------------------------------------------------
  //plot properties
  let objOpts = {
    canvas: [],
    hole: [],
    section: [],
    marker: [],
    event: [],
    connection: [],
    age: [],
  };
  objOpts.canvas.depth_scale = "composite_depth";
  objOpts.canvas.zoom_level = [4, 3]; //[x, y](1pix/2cm)
  objOpts.canvas.age_zoom_correction = 1 / 20;
  objOpts.canvas.dpir = 1; //window.devicePixelRatio || 1;
  objOpts.canvas.mouse_over_colour = "red";
  objOpts.canvas.pad_x = 200; //[px]
  objOpts.canvas.pad_y = 150; //[px]
  objOpts.canvas.shift_x = 0; //[cm]
  objOpts.canvas.shift_y = 0; //[cm]
  objOpts.canvas.bottom_pad = 100; //[cm]

  objOpts.hole.distance = 20;
  objOpts.hole.width = 20;
  objOpts.hole.line_colour = "lightgreen";
  objOpts.hole.line_width = 2;

  objOpts.section.line_colour = "gray";
  objOpts.section.face_colour = "lightgray";
  objOpts.section.line_width = 4;
  objOpts.section.width = 20;

  objOpts.marker.line_colour = "black";
  objOpts.marker.line_width = 1;
  objOpts.marker.width = 20;
  objOpts.marker.rank_colours = ["blue", "green", "#088F8F", "orange", "red"];

  objOpts.event.line_colour = "red";
  objOpts.event.face_colour = {
    general: "yellow",
    erosion: "orange",
    tephra: "pink",
    void: "purple",
    disturbed: "white",
    earthquake: "green",
  };
  objOpts.event.line_width = 1;
  objOpts.event.width = 20;

  objOpts.connection.line_colour = "gray";
  objOpts.connection.line_width = 1;
  objOpts.connection.indexWidth = 30;

  //============================================================================================
  //hide test event
  const testButton = document.getElementById("footerLeftText");
  testButton.addEventListener("click", async () => {
    //initiarise
    await initiariseCorrelationModel();
    await initiariseAgeModel();

    //get model path
    const model_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG Correlation model for LC (24 Nov. 2023).csv";
    const age_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv";

    //mount correlation model
    await mountModel(model_path);

    //load model into renderer
    selected_correlation_model_id = correlation_model_list.length; //load latest
    await window.LCapi.UpdateModelSelection({
      correlation: selected_correlation_model_id,
      age: selected_age_model_id,
    });
    await loadModel(selected_correlation_model_id);

    //mount age model
    await mountAge(age_path);

    //load age model into LCCore
    selected_age_model_id = age_model_list.length; //load latest
    await window.LCapi.UpdateModelSelection({
      correlation: selected_correlation_model_id,
      age: selected_age_model_id,
    });
    await loadAge(selected_age_model_id);

    //make virtual canvas data
    makeVirtualObjects(true);

    //plot update
    updatePlot([0, 0]);

    //console.log("Canvas size: " + canvas.height + "x" + canvas.width);
  });
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //Unload all models
  window.LCapi.receive("MoveToHorizonFromFinder", async (data) => {
    //move position based on finder
    if (objOpts.canvas.depth_scale !== "drilling_depth") {
      //get location
      const pos_y = data[objOpts.canvas.depth_scale];

      //convert scale from depth to pix
      let canvasPosY = null;
      if (objOpts.canvas.depth_scale == "age") {
        canvasPosY =
          (pos_y + objOpts.canvas.shift_y) *
            (objOpts.canvas.dpir *
              objOpts.canvas.zoom_level[1] *
              objOpts.canvas.age_zoom_correction) +
          objOpts.canvas.pad_y;
      } else {
        canvasPosY =
          (pos_y + objOpts.canvas.shift_y) *
            (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) +
          objOpts.canvas.pad_y;
      }

      //move scroller
      scroller.scrollTop = canvasPosY - scroller.clientHeight / 2;
      //scroller.moveTo(scroller.scrollLeft, pos_y);

      //move canvas
      canvasPos[1] = canvasPosY - scroller.clientHeight / 2;
      makeVirtualObjects(true);
      updatePlot([0, 0]);
    }
  });
  //============================================================================================
  //age model choser
  document
    .getElementById("AgeModelSelect")
    .addEventListener("change", async (event) => {
      const ageId = event.target.value;
      console.log(`Selected: ${ageId}`);

      //load age model
      selected_age_model_id = ageId;
      await window.LCapi.UpdateModelSelection({
        correlation: selected_correlation_model_id,
        age: selected_age_model_id,
      });
      loadAge(ageId);

      makeVirtualObjects(true);
      updatePlot([0, 0]);
    });
  //============================================================================================
  //measure
  document
    .getElementById("bt_measure")
    .addEventListener("click", async (event) => {
      const canvas = document.getElementById("plotCanvas");
      const ctx = canvas.getContext("2d");
      let clickCount = 0;
      let firstPoint = null;

      canvas.addEventListener("click", (event) => {
        if (clickCount === 0) {
          console.log("click first");
          firstPoint = { x: event.offsetX, y: event.offsetY };
          clickCount++;
        } else if (clickCount === 1) {
          console.log("click end");
          const secondPoint = { x: event.offsetX, y: event.offsetY };
          ctx.beginPath();
          ctx.moveTo(firstPoint.x, firstPoint.y);
          ctx.lineTo(secondPoint.x, secondPoint.y);
          ctx.stroke();

          //calc
          const distance = Math.sqrt(
            Math.pow(secondPoint.x - firstPoint.x, 2) +
              Math.pow(secondPoint.y - firstPoint.y, 2)
          );
          console.log("距離:", distance);

          clickCount = 0; // カウントリセット
        }
      });

      console.log("Model reloaded.");
    });
  //============================================================================================
  //Unload all models
  window.LCapi.receive("UnLoadModelsMenuClicked", async () => {
    const response = await window.LCapi.Confirm(
      "Confirmation",
      "Are you sure you want to clear the loaded model?"
    );
    if (response) {
      //ok
      //initiarise
      await initiariseCorrelationModel();
      await initiariseAgeModel();

      //clear canvas data
      await initiariseCanvas();
    } else {
      //no
      return;
    }
  });
  //============================================================================================
  //load age model
  window.LCapi.receive("LoadAgeModelMenuClicked", async () => {
    if (correlation_model_list.length == 0) {
      return;
    }
    //call from main process
    let path = "";
    try {
      path = await window.LCapi.FileChoseDialog("Chose Age model", [
        {
          name: "CSV file",
          extensions: ["csv"],
        },
      ]);
      if (path == nul) {
        return;
      }
    } catch (error) {
      console.error("ERROR: File load error", error);
      return;
    }

    //mount correlation model
    await mountAge(path);

    //load model into renderer
    selected_age_model_id = age_model_list.length; //load latest
    await window.LCapi.UpdateModelSelection({
      correlation: selected_correlation_model_id,
      age: selected_age_model_id,
    });
    await loadAge(selected_age_model_id);

    //make virtual canvas data
    makeVirtualObjects(true);

    //plot update
    updatePlot([0, 0]);
  });
  //============================================================================================
  //load correlation model
  window.LCapi.receive("LoadCorrelationModelMenuClicked", async () => {
    //call from main process
    let path = "";
    try {
      path = await window.LCapi.FileChoseDialog("Chose correlation model", [
        {
          name: "CSV file",
          extensions: ["csv"],
        },
      ]);
      if (path == null) {
        return;
      }
    } catch (error) {
      console.error("ERROR: File load error", error);
      return;
    }

    //initiarise
    initiariseCorrelationModel();
    initiariseAgeModel();
    selected_age_model_id = null;
    selected_correlation_model_id = null;
    await window.LCapi.UpdateModelSelection({
      correlation: selected_correlation_model_id,
      age: selected_age_model_id,
    });

    //mount correlation model
    await mountModel(path);

    //load model into renderer
    selected_correlation_model_id = correlation_model_list.length; //load latest
    await window.LCapi.UpdateModelSelection({
      correlation: selected_correlation_model_id,
      age: selected_age_model_id,
    });
    await loadModel(selected_correlation_model_id);

    //make virtual canvas data
    makeVirtualObjects(true);

    //plot update
    updatePlot([0, 0]);
  });
  //============================================================================================
  //check hole list
  document
    .querySelector("#hole_list")
    .addEventListener("change", function (event) {
      if (event.target.type === "checkbox") {
        console.log(
          "チェックボックス " +
            event.target.id +
            " が " +
            (event.target.checked
              ? "チェックされました"
              : "チェック解除されました")
        );
      }
    });
  //============================================================================================
  //reload
  document
    .getElementById("bt_reload")
    .addEventListener("click", async (event) => {
      if (correlation_model_list.length == 0) {
        return;
      }

      const temp_correlation_model_list = correlation_model_list;
      const temp_age_model_list = age_model_list;

      //initiarise
      await initiariseCorrelationModel();
      await initiariseAgeModel();
      await initiariseCanvas();
      console.log("list" + temp_age_model_list);

      //correlation model
      for (let i = 0; i < temp_correlation_model_list.length; i++) {
        //mount
        await mountModel(temp_correlation_model_list[i][2]);

        //load
        selected_correlation_model_id = i + 1;
        await window.LCapi.UpdateModelSelection({
          correlation: selected_correlation_model_id,
          age: selected_age_model_id,
        });
        await loadModel(selected_correlation_model_id);
      }

      for (let i = 0; i < temp_age_model_list.length; i++) {
        //mount
        await mountAge(temp_age_model_list[i][2]);

        //load
        selected_age_model_id = i + 1;
        await window.LCapi.UpdateModelSelection({
          correlation: selected_correlation_model_id,
          age: selected_age_model_id,
        });
        await loadAge(selected_age_model_id);
      }

      //make virtual canvas data
      makeVirtualObjects(true);

      //plot update
      updatePlot([0, 0]);

      console.log("Model reloaded.");
    });
  //============================================================================================
  //zoomout
  document
    .getElementById("bt_zoomout")
    .addEventListener("click", async (event) => {
      if (event.altKey) {
        objOpts.canvas.zoom_level[0] -= 1;
      } else {
        objOpts.canvas.zoom_level[1] -= 2;
      }

      //limit of smaller
      if (objOpts.canvas.zoom_level[0] < 0.1) {
        objOpts.canvas.zoom_level[0] = 0.1;
      }
      if (objOpts.canvas.zoom_level[1] < 0.1) {
        objOpts.canvas.zoom_level[1] = 0.1;
      }

      //mouse position
      const relative_scroll_pos_x = scroller.scrollLeft / scroller.scrollWidth;
      const relative_scroll_pos_y = scroller.scrollTop / scroller.scrollHeight;

      //calc new canvas size
      makeVirtualObjects(false); //make only base canvas
      const canvasBase_height = parseInt(
        canvasBase.style.height.match(/\d+/)[0],
        10
      );
      const canvasBase_width = parseInt(
        canvasBase.style.width.match(/\d+/)[0],
        10
      );

      //get new scroll pos
      const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x;
      const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y;

      let x = new_scroll_pos_x;
      let y = new_scroll_pos_y;

      scroller.scrollTo(x, y); //move scroll position

      //update plot
      canvasPos = [x, y];
      makeVirtualObjects(true);
      updatePlot([0, 0]);
    });
  //============================================================================================
  //zoomin
  document
    .getElementById("bt_zoomin")
    .addEventListener("click", async (event) => {
      if (event.altKey) {
        objOpts.canvas.zoom_level[0] += 1;
      } else {
        objOpts.canvas.zoom_level[1] += 2;
      }

      //limit of smaller
      if (objOpts.canvas.zoom_level[0] < 0.1) {
        objOpts.canvas.zoom_level[0] = 0.1;
      }
      if (objOpts.canvas.zoom_level[1] < 0.1) {
        objOpts.canvas.zoom_level[1] = 0.1;
      }

      //mouse position
      const relative_scroll_pos_x = scroller.scrollLeft / scroller.scrollWidth;
      const relative_scroll_pos_y = scroller.scrollTop / scroller.scrollHeight;

      //calc new canvas size
      makeVirtualObjects(false); //make only base canvas
      const canvasBase_height = parseInt(
        canvasBase.style.height.match(/\d+/)[0],
        10
      );
      const canvasBase_width = parseInt(
        canvasBase.style.width.match(/\d+/)[0],
        10
      );

      //get new scroll pos
      const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x;
      const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y;

      let x = new_scroll_pos_x;
      let y = new_scroll_pos_y;

      scroller.scrollTo(x, y); //move scroll position

      //update plot
      canvasPos = [x, y];
      makeVirtualObjects(true);
      updatePlot([0, 0]);
    });
  //============================================================================================
  //open finder
  document.getElementById("bt_finder").addEventListener("click", async () => {
    if (!finderEnable) {
      finderEnable = true;
      document.getElementById("bt_finder").style.backgroundColor = "#ccc";
      await LCapi.OpenFinder("OpenFinder", async () => {});
    } else {
      finderEnable = false;
      document.getElementById("bt_finder").style.backgroundColor = "#f0f0f0";
      await LCapi.CloseFinder("CloseFinder", async () => {});
    }
  });
  //load correlation model
  window.LCapi.receive("FinderClosed", async () => {
    //call from main process
    finderEnable = false;
    document.getElementById("bt_finder").style.backgroundColor = "#f0f0f0";
  });
  //============================================================================================

  //mouse position event
  document.addEventListener("mousemove", async function (event) {
    //show depth/age
    var rect = canvas.getBoundingClientRect(); // Canvas position and size
    var mouseX = event.clientX - rect.left;
    var mouseY = event.clientY - rect.top;

    const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
    const yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
    const pad_x = objOpts.canvas.pad_x;
    const pad_y = objOpts.canvas.pad_y;
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;

    //mouse position
    let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
    let y = (scroller.scrollTop + mouseY - pad_y) / yMag - shift_y;

    //get text
    const txt = await getFooterInfo(selected_correlation_model_id, y, objOpts);

    //update
    var el = document.getElementById("footerLeftText");
    el.innerText = txt;

    mousePos = [mouseX, mouseY];
    //makeVirtualObjects(true);
    //updatePlot([0, 0]);
  });
  //============================================================================================
  //scroll event
  scroller.addEventListener(
    "scroll",
    async function (event) {
      //show depth/age
      //const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
      const yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
      //const pad_x = objOpts.canvas.pad_x;
      const pad_y = objOpts.canvas.pad_y;
      //const shift_x = objOpts.canvas.shift_x;
      const shift_y = objOpts.canvas.shift_y;

      //mouse position
      //const mouseCanvasPosX = (scroller.scrollLeft + mousePos[0] - pad_x) / xMag - shift_x;
      const mouseCanvasPosY =
        (scroller.scrollTop + mousePos[1] - pad_y) / yMag - shift_y;

      ///scroller position
      canvasPos[0] = scroller.scrollLeft; //* xMag;
      canvasPos[1] = scroller.scrollTop; //* yMag;

      //update plot
      makeVirtualObjects(true);
      updatePlot([0, 0]);
      //get text
      const txt = await getFooterInfo(
        selected_correlation_model_id,
        mouseCanvasPosY,
        objOpts
      );

      //update footer info
      var el = document.getElementById("footerLeftText");
      el.innerText = txt;
    },
    { passive: false }
  );
  //============================================================================================
  //Scroll + Alt (zoom)
  document.addEventListener(
    "wheel",
    function (event) {
      if (event.altKey) {
        event.preventDefault();

        //wheel event
        var deltaX = event.deltaX;
        var deltaY = event.deltaY;

        //add zoom level
        objOpts.canvas.zoom_level[0] += 0.001 * deltaX;
        objOpts.canvas.zoom_level[1] += 0.001 * deltaY;

        //limit of smaller
        if (objOpts.canvas.zoom_level[0] < 0.1) {
          objOpts.canvas.zoom_level[0] = 0.1;
        }
        if (objOpts.canvas.zoom_level[1] < 0.1) {
          objOpts.canvas.zoom_level[1] = 0.1;
        }

        //mouse position
        const relative_scroll_pos_x =
          scroller.scrollLeft / scroller.scrollWidth;
        const relative_scroll_pos_y =
          scroller.scrollTop / scroller.scrollHeight;

        //calc new canvas size
        makeVirtualObjects(false); //make only base canvas
        const canvasBase_height = parseInt(
          canvasBase.style.height.match(/\d+/)[0],
          10
        );
        const canvasBase_width = parseInt(
          canvasBase.style.width.match(/\d+/)[0],
          10
        );

        //get new scroll pos
        const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x;
        const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y;

        let x = new_scroll_pos_x;
        let y = new_scroll_pos_y;

        scroller.scrollTo(x, y); //move scroll position

        //update plot
        canvasPos = [x, y];
        makeVirtualObjects(true);
        updatePlot([0, 0]);
      }
    },
    { passive: false }
  );
  //============================================================================================
  //YAxis dropdown changed event
  YAxisDropdown.addEventListener("change", (event) => {
    console.log(`Selected: ${event.target.value}`);
    objOpts.canvas.depth_scale = event.target.value;
    var mouseX = scroller.scrollLeft;
    var mouseY = scroller.scrollTop;

    makeVirtualObjects(true);
    updatePlot([0, 0]);
  });
  //============================================================================================
  //============================================================================================
  //main functions
  //============================================================================================
  //============================================================================================
  function makeVirtualObjects(isDrawObject) {
    const [x, y] = canvasPos;
    let mouse_over_txt = "";
    let isIn = [];

    //get hole length
    let holes_top = Infinity;
    let holes_bottom = -Infinity;
    if (LCCore == null) {
      return;
    }
    for (let h = 0; h < LCCore.holes.length; h++) {
      let hole_top =
        LCCore.holes[h].sections[0].markers[0][objOpts.canvas.depth_scale];
      let hole_bottom = LCCore.holes[h].sections
        .slice(-1)[0]
        .markers.slice(-1)[0][objOpts.canvas.depth_scale];
      if (holes_top > hole_top) {
        holes_top = hole_top;
      }
      if (holes_bottom < hole_bottom) {
        holes_bottom = hole_bottom;
      }
    }
    objOpts.canvas.shift_y = holes_top;

    //scale factor
    const dpir = objOpts.canvas.dpir; //window.devicePixelRatio || 1;

    const xMag = dpir * objOpts.canvas.zoom_level[0];
    let yMag = dpir * objOpts.canvas.zoom_level[1];
    if (objOpts.canvas.depth_scale == "age") {
      yMag = yMag * objOpts.canvas.age_zoom_correction;
    }
    const pad_x = objOpts.canvas.pad_x;
    const pad_y = objOpts.canvas.pad_y;
    //get shift amounts
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;

    //initiarise off screan canvas
    let canvasBaseWidth = parseInt(
      (objOpts.hole.distance + objOpts.hole.width + shift_x) *
        (LCCore.holes.length + 1) *
        xMag +
        pad_x
    );
    let canvasBaseHeight = parseInt(
      (holes_bottom - holes_top + shift_y + objOpts.canvas.bottom_pad) * yMag +
        pad_y
    );

    //case base is too small
    if (canvasBaseWidth < scroller.clientWidth) {
      canvasBaseWidth = scroller.clientWidth;
    }
    if (canvasBaseHeight < scroller.clientHeight) {
      canvasBaseHeight = scroller.clientHeight;
    }

    //make offscreen canvas
    //offscreen canvas size is limited in canvas, so make trimed offscreen
    let offScreenCanvasWidth = scroller.clientWidth;
    let offScreenCanvasHeight = scroller.clientHeight;
    offScreenCanvas.width = offScreenCanvasWidth;
    offScreenCanvas.height = offScreenCanvasHeight;

    //console.log(      "Viertual size" + offScreenCanvas.height + "x" + offScreenCanvas.width    );

    offScreenCtx = offScreenCanvas.getContext("2d");
    offScreenCtx.clearRect(0, 0, offScreenCanvasWidth, offScreenCanvasHeight); //initiarise

    //change scroller size from canvas base(make full size canvas area)
    canvasBase.style.width = canvasBaseWidth.toString() + "px"; //offsetWidth
    canvasBase.style.height = canvasBaseHeight.toString() + "px";

    //change view canvas size(trimed area)
    canvas.style.width = scroller.clientWidth.toString() + "px"; //offsetWidth
    canvas.style.height = scroller.clientHeight.toString() + "px";

    //console.log(      "Canvas Base size:" +        canvasBase.style.width +        "x" +        canvasBase.style.height    );
    //console.log(      "Offscreen canvas: " +        offScreenCanvas.width +        "x" +        offScreenCanvas.height    );
    //console.log("View canvas: " + canvas.width + "x" + canvas.height);

    if (!isDrawObject) {
      return;
    }
    //---------------------------------------------------------------------------------------------------------------------------
    //make objects on canvas

    //move trimed area(left, top)
    offScreenCtx.save(); //save current location. after processing, restore
    offScreenCtx.translate(-x, -y);

    //draw grid
    /*
    let gridMag = 1;
    if (objOpts.canvas.depth_scale == "age") {
      gridMag = objOpts.canvas.age_zoom_correction;
    }
    const gridSizeX = this.fitScaler(objOpts.canvas.zoom_level[0], gridMag);
    const gridSizeY = this.fitScaler(objOpts.canvas.zoom_level[1], gridMag);
    gridCanvas(
      [gridSizeX, gridSizeY],
      [xMag, yMag],
      offScreenCtx,
      [canvasBaseWidth, canvasBaseHeight],
      [shift_x, shift_y],
      [pad_x, pad_y],
      objOpts
    );
    */

    //draw model
    LCCore.holes.forEach((hole, h) => {
      //calc
      let hole_top = hole.sections[0].markers[0][objOpts.canvas.depth_scale];
      let hole_bottom = hole.sections.slice(-1)[0].markers.slice(-1)[0][
        objOpts.canvas.depth_scale
      ];
      let hole_x0 = (objOpts.hole.distance + objOpts.hole.width) * hole.order;

      // draw hole
      offScreenCtx.setLineDash([5, 5]);
      offScreenCtx.lineWidth = objOpts.hole.line_width;
      offScreenCtx.strokeStyle = objOpts.hole.line_colour;

      offScreenCtx.beginPath();
      offScreenCtx.moveTo(
        (hole_x0 + shift_x + objOpts.hole.width / 2) * xMag + pad_x,
        (hole_top + shift_y) * yMag + pad_y
      ); //start point
      offScreenCtx.lineTo(
        (hole_x0 + shift_x + objOpts.hole.width / 2) * xMag + pad_x,
        (hole_bottom + shift_y) * yMag + pad_y
      ); //end point
      offScreenCtx.stroke();

      //add  hole name
      offScreenCtx.fillStyle = "black";
      offScreenCtx.font = "20px Arial";
      offScreenCtx.fillText(
        hole.name,
        (hole_x0 + shift_x + objOpts.hole.width * 0.3) * xMag + pad_x,
        (hole_top + shift_y) * yMag + pad_y - 20
      );

      hole.sections.forEach((section, s) => {
        //calc
        let section_top = section.markers[0][objOpts.canvas.depth_scale];
        let section_bottom =
          section.markers.slice(-1)[0][objOpts.canvas.depth_scale];
        let section_mid = (section_top + section_bottom) / 2;

        if (section_top !== null && section_bottom !== null) {
          const sec_x0 = (hole_x0 + shift_x) * xMag + pad_x;
          const sec_y0 = (section_top + shift_y) * yMag + pad_y;
          const sec_w = objOpts.section.width * xMag;
          const sec_h = (section_bottom - section_top) * yMag;

          // draw sections
          offScreenCtx.setLineDash([]);
          offScreenCtx.lineWidth = objOpts.section.line_width;
          offScreenCtx.strokeStyle = objOpts.section.line_colour;
          offScreenCtx.fillStyle = objOpts.section.face_colour;

          //hittest
          /*
          const isInSec = isPointInRect(
            [mouse_x, mouse_y],
            [sec_x0, sec_y0, sec_w, sec_h]
          );

          if (isInSec) {
            offScreenCtx.strokeStyle = objOpts.canvas.mouse_over_colour;
            mouse_over_txt = section.name;
            isIn.push("section");

            //offScreenCtx.fillStyle = "black";
            offScreenCtx.font = "20px Arial";
            offScreenCtx.fillText(mouse_over_txt, mouse_x, mouse_y);
          }
          */

          //draw
          filledRoundSection(offScreenCtx, sec_x0, sec_y0, sec_w, sec_h, 10);
          roundSection(offScreenCtx, sec_x0, sec_y0, sec_w, sec_h, 10);

          if (objOpts.canvas.zoom_level[1] < 0.4) {
            return;
          }
          //add section name
          rotateText(offScreenCtx, hole.name + "-" + section.name, -90, [
            (hole_x0 + shift_x) * xMag + pad_x - 10,
            (section_mid + shift_y) * yMag + pad_y,
          ]);

          section.markers.forEach((marker, m) => {
            //calc
            let marker_top = marker[objOpts.canvas.depth_scale];
            if (marker_top !== null) {
              //draw event
              marker.event.forEach((event) => {
                let eventThickness = 0;
                let lowerDepth = null;
                if (event[1] == "downward" || event[1] == "through-down") {
                  if (event[0] == "deposition" || event[0] == "markup") {
                    if (event[2] !== null) {
                      const conIdx = this.getIdxById(LCCore, event[2]); //event layer connected MarkerId
                      lowerDepth =
                        LCCore.holes[conIdx[1]].sections[conIdx[2]].markers[
                          conIdx[3]
                        ][objOpts.canvas.depth_scale];

                      eventThickness = marker_top - lowerDepth;
                    } else {
                      /*
                      console.group(
                        "Null detected on the Event connection at the idx of [" +
                          h +
                          "," +
                          s +
                          "," +
                          m +
                          "]."
                      );
                      */
                    }
                  } else if (event[0] == "erosion") {
                    if (
                      objOpts.canvas.depth_scale == "event_free_depth" ||
                      objOpts.canvas.depth_scale == "composite_depth"
                    ) {
                      lowerDepth = marker[objOpts.canvas.depth_scale];
                      eventThickness = event[2];
                    } else {
                      lowerDepth = null;
                      eventThickness = 0;
                    }
                  }
                }

                //if event exist, plot
                if (lowerDepth !== null) {
                  offScreenCtx.setLineDash([]);
                  offScreenCtx.fillStyle = objOpts.event.face_colour[event[3]];

                  offScreenCtx.fillRect(
                    (hole_x0 + shift_x) * xMag + pad_x + 2,
                    (lowerDepth + shift_y) * yMag + pad_y,
                    objOpts.event.width * xMag - 4,
                    eventThickness * yMag
                  );
                  offScreenCtx.stroke();
                }
              });

              // draw markers
              offScreenCtx.setLineDash([]);
              offScreenCtx.lineWidth = objOpts.marker.line_width;
              offScreenCtx.strokeStyle = objOpts.marker.line_colour;

              let topBot = 0;
              if (m == 0 || m == section.markers.length - 1) {
                topBot -= objOpts.marker.width * xMag; //or +20
              }
              offScreenCtx.beginPath();
              offScreenCtx.moveTo(
                (hole_x0 + shift_x) * xMag + pad_x,
                (marker_top + shift_y) * yMag + pad_y
              ); //start point
              offScreenCtx.lineTo(
                (hole_x0 + shift_x) * xMag +
                  pad_x +
                  objOpts.marker.width * xMag +
                  topBot,
                (marker_top + shift_y) * yMag + pad_y
              ); //end point
              offScreenCtx.stroke();

              //add rank marker
              offScreenCtx.arc(
                (hole_x0 + shift_x) * xMag + pad_x,
                (marker_top + shift_y) * yMag + pad_y,
                4,
                0,
                2 * Math.PI,
                false
              );
              if (marker.connection_rank == null) {
                offScreenCtx.fillStyle = "black";
              } else {
                offScreenCtx.fillStyle =
                  objOpts.marker.rank_colours[marker.connection_rank];
              }

              offScreenCtx.fill();

              //add marker name without top/bottom name
              if (m !== 0 && m !== section.markers.length - 1) {
                offScreenCtx.fillStyle = "black";
                offScreenCtx.font = "12px Arial";
                offScreenCtx.fillText(
                  marker.name,
                  (hole_x0 + shift_x) * xMag + pad_x + 10,
                  (marker_top + shift_y) * yMag + pad_y - 2
                );
              }

              //add marker distance
              offScreenCtx.fillStyle = "black";
              offScreenCtx.font = "12px Arial";

              offScreenCtx.fillText(
                (Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
                (hole_x0 + shift_x) * xMag +
                  pad_x +
                  objOpts.marker.width * xMag +
                  5,
                (marker_top + shift_y) * yMag + pad_y - 2
              );

              //----------------------------------------------------------------------------------temp
              /*
              const tag = "age";
              if (marker[tag] !== null && !isNaN(marker[tag])) {
                offScreenCtx.fillText(
                  (Math.round(marker[tag] * 10) / 10).toFixed(1).toString(),
                  //(Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
                  (hole_x0 + shift_x) * xMag +
                    pad_x +
                    objOpts.marker.width * xMag +
                    5,
                  (marker_top + shift_y) * yMag + pad_y - 2
                );
              } else {
                offScreenCtx.fillStyle = "red";
                offScreenCtx.fillText(
                  tag + " NO DATA",
                  //(Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
                  (hole_x0 + shift_x) * xMag +
                    pad_x +
                    objOpts.marker.width * xMag +
                    5,
                  (marker_top + shift_y) * yMag + pad_y - 2
                );
              }
              */
              //----------------------------------------------------------------------------------temp

              //add connection
              const [idxTo, isNext] = this.getNearestConnectedMarkerIdx(
                LCCore,
                marker.id
              );
              //console.log(idxTo);
              if (idxTo !== null) {
                const connectedHole_x0 =
                  (objOpts.hole.distance + objOpts.hole.width) *
                  LCCore.holes[idxTo[1]].order;
                const connectedMarker_top =
                  LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]][
                    objOpts.canvas.depth_scale
                  ];
                //get position
                const cn_x0 =
                  (hole_x0 + shift_x + objOpts.marker.width) * xMag + pad_x;
                const cn_y0 = (marker_top + shift_y) * yMag + pad_y;
                const cn_x1 = cn_x0 + objOpts.connection.indexWidth;
                const cn_y1 = cn_y0;
                const cn_x3 = (connectedHole_x0 + shift_x) * xMag + pad_x;
                const cn_y3 = (connectedMarker_top + shift_y) * yMag + pad_y;
                const cn_x2 = cn_x3 - objOpts.connection.indexWidth;
                const cn_y2 = cn_y3;

                //get style
                offScreenCtx.beginPath();
                offScreenCtx.setLineDash([]);
                offScreenCtx.lineWidth = objOpts.connection.line_width;
                offScreenCtx.strokeStyle = objOpts.connection.line_colour;
                if (cn_y0 !== cn_y3) {
                  //not horizontal
                  //offScreenCtx.strokeStyle = "red";
                }
                if (!isNext) {
                  //connected core is not located at the next
                  offScreenCtx.setLineDash([3, 3]);
                }

                if (
                  marker.isMaster &&
                  LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]]
                    .isMaster
                ) {
                  offScreenCtx.strokeStyle = "blue";
                }

                offScreenCtx.moveTo(cn_x0, cn_y0); //start point
                offScreenCtx.lineTo(cn_x1, cn_y1); //index left
                offScreenCtx.lineTo(cn_x2, cn_y2); //index right
                offScreenCtx.lineTo(cn_x3, cn_y3); //index left
                offScreenCtx.stroke();
              }

              //add event
              //marker.event_data.flat(Infinity).join().toLowerCase().includes();
              /*
          offScreenCtx.setLineDash([]);
          offScreenCtx.lineWidth = objOpts.marker.line_width;
          offScreenCtx.strokeStyle = objOpts.marker.line_colour;

          let topBot = 0;
          if (m == 0 || m == section.markers.length - 1) {
            topBot -= objOpts.marker.width * xMag; //or +20
          }
          offScreenCtx.beginPath();
          offScreenCtx.rect(
            hole_x0 * xMag + pad,
            marker_top * yMag + pad,
            objOpts.marker.width * xMag + topBot,
            0
          );
          offScreenCtx.stroke();
          */
            }
          });
        }
      });
    });

    offScreenCtx.restore();
  }
  //--------------------------------------------------------------------------------------------
  function updatePlot(drawPosition) {
    //initiarise
    const [x, y] = drawPosition;
    const viewWidth = scroller.clientWidth;
    const viewHeight = scroller.clientHeight;
    canvas.width = viewWidth;
    canvas.height = viewHeight;

    ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, viewWidth, viewHeight); //clear canvas

    //plot
    //ctx.save();
    //ctx.translate(-x, -y);
    //ctx.scale(5, 5);
    //ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      offScreenCanvas,
      x,
      y,
      viewWidth,
      viewHeight,
      0,
      0,
      viewWidth,
      viewHeight
    );

    //ctx.restore();
  }
  //--------------------------------------------------------------------------------------------
  function gridCanvas(gridSize, scale, ctx, canvasSize, shift, pad, opts) {
    //grid canvas
    //gridSize: pix
    const gridColor = "#ccc";
    const gridWidth = 0.8;
    const ytickLoc = -100;
    const [xMag, yMag] = scale;
    let y0 = 0;
    let showOrder = 1;
    if (gridSize[1] <= 5) {
      showOrder = 2;
    } else if (gridSize[1] >= 100) {
      showOrder = 0;
    }

    //let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
    //let y = (scroller.scrollTop + mouseY - pad_y) / yMag - shift_y;

    //horizontal grid(downward)
    for (
      let y = 0;
      y <= canvasSize[1] + shift[1] * yMag;
      y += gridSize[1] * scale[1]
    ) {
      ctx.beginPath();
      ctx.moveTo(
        0 + shift[0] * xMag + pad[0] + ytickLoc,
        y + shift[1] * yMag + pad[1]
      );
      ctx.lineTo(
        canvasSize[0] + pad[0] + ytickLoc,
        y + shift[1] * yMag + pad[1]
      );
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = gridWidth;
      ctx.stroke();

      //ytick labels
      let tickText = null;
      if (opts.canvas.depth_scale == "age") {
        tickText =
          " " +
          (
            Math.round((y / yMag / 100) * 1000 ** (showOrder + 1)) /
            10 ** (showOrder + 1)
          )
            .toFixed(showOrder)
            .toString();
      } else {
        tickText =
          " " +
          (
            Math.round((y / yMag / 100) * 10 ** (showOrder + 1)) /
            10 ** (showOrder + 1)
          )
            .toFixed(showOrder)
            .toString();
      }
      ctx.strokeStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(tickText, pad[0] + ytickLoc, y + shift[1] * yMag + pad[1]);
    }
    //horizontal grid(upward)
    for (let y = 0; y >= -shift[1] * yMag; y -= gridSize[1] * scale[1]) {
      if (y !== 0) {
        ctx.beginPath();
        ctx.moveTo(
          0 + shift[0] * xMag + pad[0] + ytickLoc,
          y + shift[1] * yMag + pad[1]
        );
        ctx.lineTo(
          canvasSize[0] + pad[0] + ytickLoc,
          y + shift[1] * yMag + pad[1]
        );
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = gridWidth;
        ctx.stroke();

        ctx.strokeStyle = "black";
        ctx.font = "20px Arial";
        ctx.fillText(
          (
            Math.round((y / yMag / 100) * 10 ** (showOrder + 1)) /
            10 ** (showOrder + 1)
          )
            .toFixed(showOrder)
            .toString(),
          pad[0] + ytickLoc,
          y + shift[1] * yMag + pad[1]
        );
        y0 = y;
      }
    }

    //vertical grid (rightward)
    for (let x = 0; x <= canvasSize[0]; x += gridSize[0] * scale[0]) {
      ctx.beginPath();
      ctx.moveTo(x + shift[0] * xMag + pad[0], y0 + shift[1] * yMag + pad[1]);
      ctx.lineTo(
        x + shift[0] * xMag + pad[0],
        canvasSize[1] + shift[1] * xMag + pad[1]
      );
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = gridWidth;
      ctx.stroke();
    }
    //vertical grid (leftward)
    for (let x = 0; x >= canvasSize[0]; x -= gridSize[0] * scale[0]) {
      ctx.beginPath();
      ctx.moveTo(x + shift[0] * xMag + pad[0], y0 + shift[1] * yMag + pad[1]);
      ctx.lineTo(
        x + shift[0] * xMag + pad[0],
        canvasSize[1] + shift[1] * xMag + pad[1]
      );
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = gridWidth;
      ctx.stroke();
    }
  }
  //--------------------------------------------------------------------------------------------
  async function mountModel(in_path) {
    if (in_path == null) {
      return;
    }

    //mount model into LCCore
    const name = await window.LCapi.MountModelFromCsv(in_path);
    const id = correlation_model_list.length + 1;
    correlation_model_list.push([id, name, in_path]); //[id,name,path]
    console.log("Mounted. ID: " + id + ", Name: " + name);
  }

  async function loadModel(model_id) {
    model_id = 1;
    //load model into LCCore
    //now, LC is able to hold one project file, model_id is dummy
    LCCore = await window.LCapi.LoadModelFromLCCore(model_id);

    //add hole list
    LCCore.holes.forEach((hole) => {
      const container = document.getElementById("hole_list");
      const checkboxDiv = document.createElement("div");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = hole.id.toString();
      checkbox.name = hole.name;
      checkbox.checked = true;
      const label = document.createElement("label");
      label.htmlFor = hole.id.toString();
      label.textContent = hole.name;

      checkboxDiv.appendChild(checkbox);
      checkboxDiv.appendChild(label);
      container.appendChild(checkboxDiv);
    });

    //calc composite depth
    LCCore = await window.LCapi.CalcCompositeDepth();

    //calc event free depth
    LCCore = await window.LCapi.CalcEventFreeDepth();

    //shwo model summary
    console.log(LCCore);
    console.log("Loaded ID: " + model_id + ", Name: " + LCCore.name);
  }

  async function mountAge(in_path) {
    if (in_path == null) {
      return;
    }

    //load age model
    const results = await window.LCapi.MountAgeFromCsv(in_path);
    age_model_list.push([results[0], results[1], in_path]); //[id,name,path]

    //add dropdown
    const newOption = document.createElement("option");
    newOption.value = results[0];
    newOption.textContent = results[1];
    document.getElementById("AgeModelSelect").appendChild(newOption);

    console.log("Mounted ID: " + results[0] + ", Name: " + results[1]);
  }

  async function loadAge(age_id) {
    //load age model
    const results = await window.LCapi.LoadAgeFromLCAge(age_id);

    if (results == null) {
      console.log("RENDERER: Fail to read age model.");
    } else {
      //shwo model summary
      LCCore = results;

      let name = "";
      age_model_list.forEach((a) => {
        if (a[0] == age_id) {
          name = a[1];
        }
      });

      console.log("Loaded ID: " + age_id + ", Name: " + name);

      console.log(LCCore);
    }
  }

  async function initiariseCorrelationModel() {
    //canvas initiarise
    const parentElement = document.getElementById("hole_list");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }

    //data initiarise
    LCCore = null;
    await window.LCapi.InitiariseCorrelationModel();
    correlation_model_list = [];
    selected_correlation_model_id = null;
    await window.LCapi.UpdateModelSelection({
      correlation: selected_correlation_model_id,
      age: selected_age_model_id,
    });
  }

  async function initiariseAgeModel() {
    //canvas initiarise(remove all children)
    const parentElement = document.getElementById("AgeModelSelect");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }

    //data initiarise
    await window.LCapi.InitiariseAgeModel();
    age_model_list = [];
    selected_age_model_id = null;
    await window.LCapi.UpdateModelSelection({
      correlation: selected_correlation_model_id,
      age: selected_age_model_id,
    });
  }
  async function initiariseCanvas() {
    //clear canvas data
    offScreenCtx.clearRect(0, 0, scroller.clientWidth, scroller.clientHeight); //initiarise

    //plot update
    updatePlot([0, 0]);
  }
  //============================================================================================
});

//============================================================================================
//============================================================================================
//subfunctions
//============================================================================================
//============================================================================================

function rotateText(ctx, txt, degree, center) {
  ctx.save();
  ctx.translate(center[0], center[1]); //move rotation center
  ctx.rotate((degree * Math.PI) / 180);
  ctx.fillStyle = "black";
  ctx.font = "20px Arial";
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}

function roundSection(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.stroke(); // 線で描画
  // ctx.fill(); // 塗りつぶしで描画する場合はこちらを使用
}

function filledRoundSection(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  ctx.fill(); // ここで塗りつぶしを実行
}
function fitScaler(zoom_level, mag) {
  let step = 0;
  let mod = 5;

  if (zoom_level <= 0.1) {
    step = (1000 * mod) / mag;
  } else if (zoom_level <= 0.5) {
    step = (100 * mod) / mag;
  } else if (zoom_level <= 2.0) {
    step = (50 * mod) / mag;
  } else if (zoom_level <= 5) {
    step = (10 * mod) / mag;
  } else if (zoom_level <= 10) {
    step = (5 * mod) / mag;
  }
  /*
  else if (zoom_level <= 15) {
    step = (1 * mod) / mag;
  }
  */

  return step;
}
function getNearestConnectedMarkerIdx(LCCore, idFrom) {
  const idxFrom = this.getIdxById(LCCore, idFrom);
  const currentMarkerData =
    LCCore.holes[idxFrom[1]].sections[idxFrom[2]].markers[idxFrom[3]];
  const currentHoleData = LCCore.holes[idxFrom[1]];
  if (
    currentMarkerData.h_connection == null ||
    currentMarkerData.h_connection.length == 0
  ) {
    return [null, null];
  }

  //get first data
  let connectedMarkerData = null;
  let connectedHoleData = null;

  let idTo = currentMarkerData.h_connection[0];
  let idxTo = this.getIdxById(LCCore, idTo);
  if (LCCore.holes[idxTo[1]].order > currentHoleData.order) {
    connectedMarkerData =
      LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
    connectedHoleData = LCCore.holes[idxTo[1]];
  }

  //if find near hole, replace
  for (let i = 1; i < currentMarkerData.h_connection.length; i++) {
    const idTo = currentMarkerData.h_connection[i];
    const idxTo = this.getIdxById(LCCore, idTo);

    if (connectedHoleData == null) {
      if (LCCore.holes[idxTo[1]].order > currentHoleData.order) {
        connectedMarkerData =
          LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
        connectedHoleData = LCCore.holes[idxTo[1]];
      }
    } else {
      if (
        LCCore.holes[idxTo[1]].order - currentHoleData.order > 0 &&
        LCCore.holes[idxTo[1]].order < connectedHoleData.order
      ) {
        //get only next hole
        connectedMarkerData =
          LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
        connectedHoleData = LCCore.holes[idxTo[1]];
      }
    }
  }

  //check and output
  if (connectedMarkerData == null) {
    return [null, null];
  } else {
    //check is next
    let isNext = false;
    const idxTo = this.getIdxById(LCCore, connectedMarkerData.id);
    if (
      Math.abs(LCCore.holes[idxTo[1]].order - LCCore.holes[idxFrom[1]].order) ==
      1
    ) {
      isNext = true;
    }

    //output

    return [idxTo, isNext];
  }
}
function getIdxById(LCCore, id) {
  const num_id = id.length;
  if (num_id < 2) {
    return;
  }
  let relative_idxs = [1];

  if (num_id >= 2) {
    const num_holes = LCCore.holes.length;
    for (let h = 0; h < num_holes; h++) {
      const holeData = LCCore.holes[h];
      if (holeData.id[1] == id[1]) {
        relative_idxs.push(h);

        if (num_id >= 3) {
          const num_sections = holeData.sections.length;
          for (let s = 0; s < num_sections; s++) {
            const sectionData = holeData.sections[s];
            if (sectionData.id[2] == id[2]) {
              relative_idxs.push(s);

              if (num_id == 4) {
                const num_markers = sectionData.markers.length;
                for (let m = 0; m < num_markers; m++) {
                  const markerData = sectionData.markers[m];
                  if (markerData.id[3] == id[3]) {
                    relative_idxs.push(m);
                  }
                }
              } else if (num_id > 5) {
                console.log("Too long undefined id.");
              }
            }
          }
        }
      }
    }
  }
  return relative_idxs;
}

function isPointInRect(point, rect) {
  return (
    point[0] >= rect[0] &&
    point[0] <= rect[0] + rect[2] &&
    point[1] >= rect[1] &&
    point[1] <= rect[1] + rect[3]
  );
}
async function getFooterInfo(model_id, y, objOpts) {
  let txt = "";
  let age = "";

  if (objOpts.canvas.depth_scale == "age") {
    txt = "Age: " + Math.round(y).toLocaleString() + " calBP";
  } else if (objOpts.canvas.depth_scale == "composite_depth") {
    age = await window.LCapi.GetAgeFromCD(model_id, y, "linear");
    txt =
      "Composite Depth: " +
      (Math.round(y) / 100).toFixed(2) +
      " m (Age: " +
      Math.round(age).toLocaleString() +
      " calBP)";
  } else if (objOpts.canvas.depth_scale == "drilling_depth") {
    txt = "Drilling Depth: " + (Math.round(y) / 100).toFixed(2) + " m";
  } else if (objOpts.canvas.depth_scale == "event_free_depth") {
    age = await window.LCapi.GetAgeFromEFD(model_id, y, "linear");
    txt =
      "Event Free Depth: " +
      (Math.round(y) / 100).toFixed(2) +
      " m (Age: " +
      Math.round(age).toLocaleString() +
      " calBP)";
  } else if (objOpts.canvas.depth_scale == "canvas_position") {
    txt = "Canvas Position: [" + mouseX + "," + mouseY + "]";
  }
  return txt;
}
//============================================================================================
