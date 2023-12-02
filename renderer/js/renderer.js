document.addEventListener("DOMContentLoaded", () => {
  //============================================================================================
  //base properties
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  let mousePos = [0, 0]; //mouse absolute position
  let canvasPos = [0, 0]; //canvas scroller position

  //model
  let LCCore = null;
  let LCplot = null;

  //model source path
  let correlation_model_list = []; //for reload
  let age_model_list = []; //for reload

  //p5(vector) canvas
  let isDrawVector = false; //plot p5 or canvas
  let vectorObjects = null; //p5 instance data
  document.getElementById("p5Canvas").style.display = "none"; //disable

  //raster canvas
  let canvas = document.getElementById("rasterCanvas");
  let ctx = canvas.getContext("2d");
  let offScreenCanvas = new OffscreenCanvas(1000, 1000);
  let offScreenCtx = offScreenCanvas.getContext("2d");
  document.getElementById("rasterCanvas").style.display = "block"; //enable

  //pen canvas
  let penObject = { isPen: false, penCanvas: null, penData: null };

  //measure canvas
  let measureObject = {
    isMeasure: false,
    measureCanvas: null,
    measureData: { type: null, start: null, end: null },
  };

  //finder control
  let finderEnable = false;
  let dividerEnable = false;
  let isSVG = false;
  let isGrid = false;
  //============================================================================================

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
    pen: [],
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
  objOpts.canvas.background_colour = "white";
  objOpts.canvas.target_horizon = false;
  objOpts.canvas.grid_width = 0.8;
  objOpts.canvas.grid_solour = "gray";

  objOpts.hole.distance = 20;
  objOpts.hole.width = 20;
  objOpts.hole.line_colour = "lightgreen";
  objOpts.hole.line_width = 2;
  objOpts.hole.font = "Arial";
  objOpts.hole.font_size = 20;
  objOpts.hole.font_colour = "black";

  objOpts.section.line_colour = "gray";
  objOpts.section.face_colour = "lightgray";
  objOpts.section.line_width = 4;
  objOpts.section.width = 20;
  objOpts.section.font = "Arial";
  objOpts.section.font_size = 20;
  objOpts.section.font_colour = "black";

  objOpts.marker.line_colour = "gray";
  objOpts.marker.line_width = 1;
  objOpts.marker.width = 20;
  objOpts.marker.rank_colours = ["blue", "green", "#088F8F", "orange", "red"];
  objOpts.marker.ignore_zoom_level = 0.4;
  objOpts.marker.font = "Arial";
  objOpts.marker.font_size = 12;
  objOpts.marker.font_colour = "black";

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
  objOpts.event.line_colour = "gray"; //rate

  objOpts.connection.line_colour = "gray";
  objOpts.connection.line_width = 1;
  objOpts.connection.indexWidth = 30;

  objOpts.pen.colour = "red";

  objOpts.age.incon_size = 20;
  objOpts.age.alt_radius = 3;
  objOpts.age.incon_list = {
    terrestrial: ["../resources/plot/terrestrial.png", "green"],
    marine: ["../resources/plot/marine.png", "blue"],
    tephra: ["../resources/plot/tephra.png", "red"],
    climate: ["../resources/plot/climate.png", "yellow"],
    orbital: ["../resources/plot/orbital.png", "orange"],
    general: ["../resources/plot/general.png", "black"],
  };

  //============================================================================================
  //resources
  //get plot image data
  let agePlotIcons = {};
  loadRasterPlotIcons(agePlotIcons, objOpts);
  let ageVectorPlotIcons = {};
  loadVectorPlotIcons(ageVectorPlotIcons, objOpts);

  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //hide test event
  const testButton = document.getElementById("footerLeftText");
  testButton.addEventListener("click", async () => {
    //initiarise
    await initiariseCorrelationModel();
    await initiariseAgeModel();
    await initiariseCanvas();
    await initiarisePlot();

    //get model path
    const model_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG Correlation model for LC (24 Nov. 2023).csv";
    const age1_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv";

    const age2_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal13 yr BP chronology for LC (06 Apr. 2020).csv";
    //register correlation model
    await registerModel(model_path);

    //load model into renderer
    await loadModel(1);

    //register age model
    await registerAge(age1_path);
    await registerAge(age2_path);

    //load age model into LCCore
    console.log(age_model_list);
    await loadAge(age_model_list[0].id);

    //register age into LCplot
    await registerPlotFromLCAge();

    //load LCplot
    await loadPlotData();

    //update
    updateView();

    //console.log("Canvas size: " + canvas.height + "x" + canvas.width);
  });
  //============================================================================================
  //open divider
  document.getElementById("bt_divider").addEventListener("click", async () => {
    if (LCCore) {
      if (!dividerEnable) {
        dividerEnable = true;
        document.getElementById("bt_divider").style.backgroundColor = "#ccc";
        await LCapi.OpenDivider("OpenDivider", async () => {});
      } else {
        dividerEnable = false;
        document.getElementById("bt_divider").style.backgroundColor = "#f0f0f0";
        await LCapi.CloseDivider("CloseDvider", async () => {});
      }
    }
  });

  window.LCapi.receive("DividerClosed", async () => {
    //call from main process
    dividerEnable = false;
    document.getElementById("bt_divider").style.backgroundColor = "#f0f0f0";
  });
  //============================================================================================
  //grid
  document
    .getElementById("bt_grid")
    .addEventListener("click", async (event) => {
      if (isGrid) {
        isGrid = false;
        document.getElementById("bt_grid").style.backgroundColor = "#f0f0f0";
      } else {
        isGrid = true;
        document.getElementById("bt_grid").style.backgroundColor = "#ccc";
      }
      updateView();
    });
  //============================================================================================
  //pen
  document.getElementById("bt_pen").addEventListener("click", async (event) => {
    if (!penObject.isPen) {
      penObject.isPen = true;
      document.getElementById("bt_pen").style.backgroundColor = "#ccc";
      //make new pen canvas
      document.getElementById("p5penCanvas").style.display = "block";
      if (penObject.penCanvas == null) {
        penObject.penCanvas = new p5(penSketch);
      }
    } else {
      penObject.isPen = false;
      document.getElementById("bt_pen").style.backgroundColor = "#f0f0f0";
      //undisplay canvas plot
      document.getElementById("p5penCanvas").style.display = "none";
    }
  });
  //============================================================================================

  //============================================================================================
  //age model chooser
  document
    .getElementById("AgeModelSelect")
    .addEventListener("change", async (event) => {
      const ageId = event.target.value;
      console.log(`Selected: ${ageId}`);

      //load age model
      selected_age_model_id = ageId;
      await loadAge(selected_age_model_id);
      await loadPlotData();

      //update plot
      updateView();
    });
  //============================================================================================
  //snapshot
  document
    .getElementById("bt_snapshot")
    .addEventListener("click", async (event) => {
      if (isDrawVector) {
        //download vector image from p5 canvas
        isSVG = true;
        const targetCanvas = new p5(p5Sketch);
        targetCanvas.save("model.svg");
        //targetCanvas.save("model.png");
        isSVG = false;
        console.log("Take snapshot as svg.");
      } else {
        //download raster image from canvas
        const dataURL = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = dataURL;
        downloadLink.download = "canvas-image.png";
        downloadLink.click();
        console.log("Take snapshot as png.");
      }
    });
  //============================================================================================
  //measure
  document
    .getElementById("bt_measure")
    .addEventListener("click", async (event) => {
      if (LCCore) {
        if (!measureObject.isMeasure) {
          measureObject.isMeasure = true;
          measureObject.measureCanvas = new p5(measureSketch);
          document.getElementById("bt_measure").style.backgroundColor = "#ccc";
          measureObject.measureData.type = objOpts.canvas.depth_scale;
        } else {
          measureObject.isMeasure = false;
          measureObject.measureCanvas = null;
          document.getElementById("bt_measure").style.backgroundColor =
            "#f0f0f0";
        }
      }
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
      await initiariseCanvas();
      await initiarisePlot();
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
      if (path == null) {
        return;
      }
    } catch (error) {
      console.error("ERROR: File load error", error);
      return;
    }

    //mount correlation model
    await registerAge(path);

    //load model into renderer
    selected_age_model_id = age_model_list.length; //load latest
    document.getElementById("AgeModelSelect").value = selected_age_model_id;

    //load
    await loadAge(selected_age_model_id);

    //
    await registerPlotFromLCAge();
    await loadPlotData();

    //update plot
    updateView();
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
    await initiariseCorrelationModel();
    await initiariseAgeModel();
    await initiariseCanvas();
    await initiarisePlot();

    //mount correlation model
    await registerModel(path);

    //load model into renderer
    await loadModel(1);

    //update plot
    updateView();
  });
  //============================================================================================
  //change canvas mode
  window.LCapi.receive("CanvasModeChanged", async (data) => {
    //call from main process
    if (data == "vector") {
      isDrawVector = true;
    } else if (data == "raster") {
      isDrawVector = false;
    }

    //update plot
    updateView();
  });

  //============================================================================================
  //check hole list
  document
    .querySelector("#hole_list")
    .addEventListener("change", function (event) {
      if (event.target.type === "checkbox") {
        //get id
        const section_id = event.target.id.split(",");
        const section_idx = getIdxById(LCCore, section_id);

        if (event.target.checked) {
          //case checked
          LCCore.holes[section_idx[1]].enable = true;
          console.log("Hole " + event.target.name + " show.");
        } else {
          //case unchecked
          LCCore.holes[section_idx[1]].enable = false;
          console.log("Hole " + event.target.name + " hide.");
        }
        //update plot
        updateView();
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
      const selecteed_cprrelation_model_id = 1;
      const selected_age_model_id =
        document.getElementById("AgeModelSelect").value;

      //initiarise
      await initiariseCorrelationModel();
      await initiariseAgeModel();
      await initiariseCanvas();
      await initiarisePlot();
      console.log("list" + temp_age_model_list);

      //correlation model
      for (let i = 0; i < temp_correlation_model_list.length; i++) {
        //mount
        await registerModel(temp_correlation_model_list[i].path);
      }
      await loadModel(selecteed_cprrelation_model_id);

      for (let i = 0; i < temp_age_model_list.length; i++) {
        //mount
        await registerAge(temp_age_model_list[i].path);
      }
      await loadAge(selected_age_model_id);
      console.log(LCCore);

      //plot update
      await registerPlotFromLCAge();
      await loadPlotData();

      //update plot
      updateView();

      console.log("Model reloaded.");
    });
  //============================================================================================
  //zoomout
  document
    .getElementById("bt_zoomout")
    .addEventListener("click", async (event) => {
      if (LCCore) {
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
        const relative_scroll_pos_x =
          scroller.scrollLeft / scroller.scrollWidth;
        const relative_scroll_pos_y =
          scroller.scrollTop / scroller.scrollHeight;

        //calc new canvas size
        const [canvasBase_width, canvasBase_height] = calcCanvasBaseSize(
          LCCore,
          objOpts
        );

        //get new scroll pos
        const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x;
        const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y;

        let x = new_scroll_pos_x;
        let y = new_scroll_pos_y;

        scroller.scrollTo(x, y); //move scroll position

        //update plot
        canvasPos = [x, y];

        //update plot
        updateView();
      }
    });
  //============================================================================================
  //zoomin
  document
    .getElementById("bt_zoomin")
    .addEventListener("click", async (event) => {
      if (LCCore) {
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
        const relative_scroll_pos_x =
          scroller.scrollLeft / scroller.scrollWidth;
        const relative_scroll_pos_y =
          scroller.scrollTop / scroller.scrollHeight;

        //calc new canvas size
        const [canvasBase_width, canvasBase_height] = calcCanvasBaseSize(
          LCCore,
          objOpts
        );

        //get new scroll pos
        const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x;
        const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y;

        let x = new_scroll_pos_x;
        let y = new_scroll_pos_y;

        scroller.scrollTo(x, y); //move scroll position

        //update plot
        canvasPos = [x, y];

        //update plot
        updateView();
      }
    });
  //============================================================================================
  //open finder
  document.getElementById("bt_finder").addEventListener("click", async () => {
    if (LCCore) {
      if (!finderEnable) {
        finderEnable = true;
        document.getElementById("bt_finder").style.backgroundColor = "#ccc";
        await LCapi.OpenFinder("OpenFinder", async () => {});
      } else {
        finderEnable = false;
        document.getElementById("bt_finder").style.backgroundColor = "#f0f0f0";
        await LCapi.CloseFinder("CloseFinder", async () => {});
      }
    }
  });
  //close finder
  window.LCapi.receive("FinderClosed", async () => {
    //call from main process
    finderEnable = false;
    document.getElementById("bt_finder").style.backgroundColor = "#f0f0f0";
  });
  //mouse click (send depth to finder)
  scroller.addEventListener("click", async function () {
    //send to finder
    if (finderEnable) {
      //get depth scale position
      var rect = canvas.getBoundingClientRect(); // Canvas position and size
      var mouseX = mousePos[0];
      var mouseY = mousePos[1];

      const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
      const yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
      const pad_x = objOpts.canvas.pad_x;
      const pad_y = objOpts.canvas.pad_y;
      const shift_x = objOpts.canvas.shift_x;
      const shift_y = objOpts.canvas.shift_y;

      //mouse position
      let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
      let y = (scroller.scrollTop + mouseY - pad_y) / yMag - shift_y;

      await window.LCapi.SendDepthToFinder([
        correlation_model_list[0].id,
        y,
        objOpts.canvas.depth_scale,
      ]);
      console.log("Click: Send the depth to Finder");
    }
  });
  //FInder send event (move to)
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

      //update plot
      updateView();
    }
  });
  //============================================================================================
  //mouse move position event
  document.addEventListener("mousemove", async function (event) {
    //show depth/age
    var rect;
    if (isDrawVector) {
      rect = document.getElementById("p5Canvas").getBoundingClientRect(); // Canvas position and size
    } else {
      rect = document.getElementById("rasterCanvas").getBoundingClientRect(); // Canvas position and size
    }

    var mouseX = event.clientX - rect.left;
    var mouseY = event.clientY - rect.top;

    const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
    const yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
    const pad_x = objOpts.canvas.pad_x;
    const pad_y = objOpts.canvas.pad_y;
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;
    let age_mod = 1;

    if (objOpts.canvas.depth_scale == "age") {
      age_mod = objOpts.canvas.age_zoom_correction;
    }

    //mouse position
    let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
    let y = (scroller.scrollTop + mouseY - pad_y) / yMag / age_mod - shift_y;

    //get text
    const txt = await getFooterInfo(y, objOpts);

    //update
    var el = document.getElementById("footerLeftText");
    el.innerText = txt;

    mousePos = [mouseX, mouseY];

    /*
    //send to finder
    if (finderEnable) {
      await window.LCapi.SendDepthToFinder([
        correlation_model_list[0].id,
        y,
        objOpts.canvas.depth_scale,
      ]);
    }
    */
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
      updateView();

      //get text
      const txt = await getFooterInfo(mouseCanvasPosY, objOpts);

      //update footer info
      var el = document.getElementById("footerLeftText");
      el.innerText = txt;

      /*
      //send to finder
      if (finderEnable) {
        await window.LCapi.SendDepthToFinder([
          correlation_model_list[0].id,
          mouseCanvasPosY,
          objOpts.canvas.depth_scale,
        ]);
      }
      */
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
        objOpts.canvas.zoom_level[0] += 0.01 * deltaX;
        objOpts.canvas.zoom_level[1] += 0.01 * deltaY;

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
        makeRasterObjects(false); //make only base canvas
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

        //update data
        canvasPos = [x, y];

        //update plot
        updateView();
      }
    },
    { passive: false }
  );
  //============================================================================================
  //YAxis dropdown changed event
  const YAxisDropdown = document.getElementById("YAxisSelect");
  YAxisDropdown.addEventListener("change", (event) => {
    console.log(`Selected: ${event.target.value}`);
    objOpts.canvas.depth_scale = event.target.value;
    var mouseX = scroller.scrollLeft;
    var mouseY = scroller.scrollTop;

    //update plot
    updateView();
  });
  //============================================================================================
  //============================================================================================
  //main functions
  //============================================================================================
  //============================================================================================
  //make vector view by using p5.js (auto loop)
  function makeP5CanvasBase() {
    if (LCCore == null) {
      return;
    }

    //get hole length
    let holes_top = Infinity;
    let holes_bottom = -Infinity;

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

    //change scroller size from canvas base(make full size canvas area)
    canvasBase.style.width = canvasBaseWidth.toString() + "px"; //offsetWidth
    canvasBase.style.height = canvasBaseHeight.toString() + "px";
  }

  //m,ain canvas(vector)
  const p5Sketch = (sketch) => {
    let offscreen;
    //setup p5 canvas instance forma=======================================================================
    sketch.setup = () => {
      let sketchCanvas = null;

      if (isSVG) {
        sketchCanvas = sketch.createCanvas(
          scroller.clientWidth,
          scroller.clientHeight,
          sketch.SVG
        );
      } else {
        sketchCanvas = sketch.createCanvas(
          scroller.clientWidth,
          scroller.clientHeight,
          sketch.P2D
        );
      }
      //offscreen = sketch.createGraphics(        scroller.clientWidth,        scroller.clientHeight      );
      sketch.strokeWeight(2);
      sketch.stroke("#ED225D");

      sketchCanvas.parent("p5Canvas");
      sketch.noLoop();
    };

    //draw data=============================================================================================
    sketch.draw = () => {
      //sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
      //back ground
      sketch.background(objOpts.canvas.background_colour);

      //translate plot position
      sketch.push(); //save
      sketch.translate(-canvasPos[0], -canvasPos[1]); //if you want revers move

      //draw model
      //get adjust values
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

      //-----------------------------------------------------------------------------------------
      //draw grid
      if (isGrid) {
        //function
        const title = (tickType) => {
          if (tickType == "age") {
            const text = "Age [calBP]";
            return text;
          } else if (tickType == "composite_depth") {
            const text = "Composite depth [m]";
            return text;
          } else if (tickType == "event_free_depth") {
            const text = "Event free depth [m]";
            return text;
          } else if (tickType == "drilling_depth") {
            const text = "Drilling depth [m]";
            return text;
          }
        };

        //scale title
        sketch.drawingContext.setLineDash([]);
        sketch.fill("black");
        sketch.noStroke(); // sketch.stroke("black");
        sketch.textFont("Arial");
        sketch.textSize("30px");
        sketch.push();
        sketch.translate(
          scroller.scrollLeft + 30,
          scroller.scrollTop + scroller.clientHeight / 2
        );
        sketch.rotate((-90 / 180) * Math.PI);
        sketch.text(title(objOpts.canvas.depth_scale), 0, 0);
        sketch.pop();

        //
        const gridStartY = (0 + shift_y) * yMag + pad_y; //pix
        let age_mod = 1;
        if (objOpts.canvas.depth_scale == "age") {
          age_mod = objOpts.canvas.age_zoom_correction;
        }
        const gridStepY = fitScaler(
          objOpts.canvas.zoom_level[1],
          yMag / age_mod
        ); //pix

        const gridMaxY = parseInt(canvasBase.style.height.match(/\d+/)[0], 10);
        const gridMaxX = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);

        const gridMinY = objOpts.canvas.shift_y; //pix

        const tickType = objOpts.canvas.depth_scale;
        const tickStepY = 2;

        //function
        const txt = (tickType, y) => {
          const d = (y - pad_y) / yMag - shift_y;
          if (tickType == "age") {
            const text = " " + Math.round(d).toLocaleString();
            return text;
          } else {
            const text =
              " " + (Math.round(d) / 100).toFixed(2).toLocaleString();
            return text;
          }
        };

        //ygrid downward
        for (let y = gridStartY; y < gridMaxY; y += gridStepY) {
          //grid
          sketch.drawingContext.setLineDash([]);
          sketch.strokeWeight(objOpts.canvas.grid_width);
          sketch.stroke(objOpts.canvas.grid_solour);
          sketch.line(120, y, gridMaxX, y);

          //label
          const tickLabel = txt(tickType, y);
          const tickWidth = ctx.measureText(tickLabel).width;
          sketch.fill("black");
          sketch.noStroke(); // sketch.stroke("black");
          sketch.textFont("Arial");
          sketch.textSize("20px");
          sketch.text(tickLabel, scroller.scrollLeft + 50, y + 8);
        }

        //ygrid upward
        for (let y = gridStartY; y > gridMinY; y -= gridStepY) {
          //grid
          sketch.drawingContext.setLineDash([]);
          sketch.strokeWeight(objOpts.canvas.grid_width);
          sketch.stroke(objOpts.canvas.grid_solour);
          sketch.line(120, y, gridMaxX, y);

          //label
          const tickLabel = txt(tickType, y);
          const tickWidth = ctx.measureText(tickLabel).width;
          sketch.fill("black");
          sketch.noStroke(); // sketch.stroke("black");
          sketch.textFont("Arial");
          sketch.textSize("20px");
          sketch.text(tickLabel, scroller.scrollLeft + 50, y + 8);
        }
      }
      //-----------------------------------------------------------------------------------------

      //initiarise
      let num_disable = {
        hole: 0,
      };

      //main
      for (let h = 0; h < LCCore.holes.length; h++) {
        //make hole objects===================================================================================
        //load hole data
        const hole = LCCore.holes[h];

        //check enable
        if (!hole.enable) {
          //case not plot, count
          num_disable.hole += 1;
          continue;
        }

        //calc position excluding diable holes------------------------------
        let hole_top = hole.sections[0].markers[0][objOpts.canvas.depth_scale];
        let hole_bottom = hole.sections.slice(-1)[0].markers.slice(-1)[0][
          objOpts.canvas.depth_scale
        ];
        let hole_x0 =
          (objOpts.hole.distance + objOpts.hole.width) *
          (hole.order - num_disable.hole);

        //check position
        if (hole_top == null || hole_bottom == null || hole_x0 == null) {
          console.log(h + " th hole has any problem in the position.");
          continue;
        }

        // draw hole line --------------------------------------------------
        sketch.drawingContext.setLineDash([5, 5]);
        sketch.strokeWeight(objOpts.hole.line_width);
        sketch.stroke(objOpts.hole.line_colour);
        sketch.line(
          (hole_x0 + shift_x + objOpts.hole.width / 2) * xMag + pad_x,
          (hole_top + shift_y) * yMag + pad_y,
          (hole_x0 + shift_x + objOpts.hole.width / 2) * xMag + pad_x,
          (hole_bottom + shift_y) * yMag + pad_y
        );

        //add  hole name---------------------------------------------------
        sketch.drawingContext.setLineDash([]);
        sketch.fill(objOpts.hole.font_colour);
        sketch.stroke(objOpts.hole.font_colour);
        sketch.textFont(objOpts.hole.font);
        sketch.textSize(objOpts.hole.font_size);
        sketch.text(
          hole.name,
          (hole_x0 + shift_x + objOpts.hole.width * 0.3) * xMag + pad_x,
          (hole_top + shift_y) * yMag + pad_y - 20
        );

        //get plot order for hit test--------------------------------------

        let section_plot_order = [];
        for (let i = 0; i < hole.sections.length; i++) {
          section_plot_order.push(i);
        }

        /*
        if (hit_object_idx !== null) {
          if (h == hit_object_idx[0]) {
            //extract hit object
            const hitObj = section_plot_order.slice(hit_object_idx[1], 1)[0];

            //insert last order
            section_plot_order.push(hitObj);
          }
        }
        */

        for (let s_o = 0; s_o < hole.sections.length; s_o++) {
          const s = section_plot_order[s_o];

          //make section objects===================================================================================
          //load section data
          const section = hole.sections[s];

          //calc position----------------------------------------------------
          let section_top = section.markers[0][objOpts.canvas.depth_scale];
          let section_bottom =
            section.markers.slice(-1)[0][objOpts.canvas.depth_scale];
          let section_mid = (section_top + section_bottom) / 2;

          //check position
          if (section_top == null || section_bottom == null) {
            console.log(
              h +
                " th hole, " +
                s +
                " th section has any problem in the position."
            );
            continue;
          }

          //calc position
          const sec_x0 = (hole_x0 + shift_x) * xMag + pad_x;
          const sec_y0 = (section_top + shift_y) * yMag + pad_y;
          const sec_w = objOpts.section.width * xMag;
          const sec_h = (section_bottom - section_top) * yMag;

          //draw section-----------------------------------------------------
          //sketch.drawingContext.setLineDash([]);
          sketch.strokeWeight(objOpts.section.line_width);
          sketch.stroke(objOpts.section.line_colour);
          sketch.fill(objOpts.section.face_colour);
          sketch.rect(sec_x0, sec_y0, sec_w, sec_h, 3, 3, 3, 3); //rounded

          //check zoom level for ignoring plot markers
          if (objOpts.canvas.zoom_level[1] < objOpts.marker.ignore_zoom_level) {
            continue;
          }

          //add section name-------------------------------------------------
          sketch.fill(objOpts.section.font_colour);
          sketch.noStroke();
          sketch.textFont(objOpts.section.font);
          sketch.textSize(objOpts.section.font_size);
          sketch.push();
          sketch.translate(
            (hole_x0 + shift_x) * xMag + pad_x - 10,
            (section_mid + shift_y) * yMag + pad_y
          );
          sketch.rotate((-90 / 180) * Math.PI);
          sketch.text(hole.name + "-" + section.name, 0, 0);
          sketch.pop();

          for (let m = 0; m < section.markers.length; m++) {
            //make marker objects=================================================================================
            //load marker data
            const marker = section.markers[m];
            let markerLineColour = objOpts.marker.line_colour;

            //calc marker position
            let marker_top = marker[objOpts.canvas.depth_scale];

            //check position
            if (marker_top == null) {
              console.log(
                h +
                  " th hole, " +
                  s +
                  " th section, " +
                  m +
                  " th marker position has any problem."
              );
            }

            //first, draw event
            for (let e = 0; e < marker.event.length; e++) {
              //make marker objects=================================================================================
              //get position
              const event = marker.event[e];

              const [lowerDepth, eventThickness] = getEventPosiotion(
                LCCore,
                event,
                marker_top,
                objOpts
              );

              //draw event layers

              if (lowerDepth !== null) {
                sketch.fill(objOpts.event.face_colour[event[3]]);
                sketch.noStroke();
                sketch.stroke(objOpts.event.face_colour[event[3]]);
                sketch.rect(
                  (hole_x0 + shift_x) * xMag + pad_x + 3,
                  (lowerDepth + shift_y) * yMag + pad_y,
                  objOpts.section.width * xMag - 6,
                  eventThickness * yMag
                );
              }
            }
            //make marker objects=================================================================================
            // remove top and bottom markers
            let topBot = 0;
            if (m == 0 || m == section.markers.length - 1) {
              topBot -= objOpts.marker.width * xMag; //or +20
            }

            //draw markers
            sketch.drawingContext.setLineDash([]);
            sketch.strokeWeight(objOpts.marker.line_width);
            sketch.stroke(objOpts.marker.line_colour); //(markerLineColour);
            sketch.line(
              (hole_x0 + shift_x) * xMag + pad_x,
              (marker_top + shift_y) * yMag + pad_y,
              (hole_x0 + shift_x) * xMag +
                pad_x +
                objOpts.marker.width * xMag +
                topBot,
              (marker_top + shift_y) * yMag + pad_y
            );

            //add rank marker-------------------------------------------
            if (marker.connection_rank == null) {
              sketch.fill("black");
            } else {
              sketch.fill(objOpts.marker.rank_colours[marker.connection_rank]);
            }
            sketch.ellipse(
              (hole_x0 + shift_x) * xMag + pad_x,
              (marker_top + shift_y) * yMag + pad_y,
              8
            );

            //add marker name--------------------------------------------
            //add marker name without top/bottom name
            if (m !== 0 && m !== section.markers.length - 1) {
              sketch.fill(objOpts.marker.font_colour);
              sketch.noStroke();
              sketch.textFont(objOpts.marker.font);
              sketch.textSize(objOpts.marker.font_size);
              sketch.text(
                marker.name,
                (hole_x0 + shift_x) * xMag + pad_x + 10,
                (marker_top + shift_y) * yMag + pad_y - 2
              );
            }

            //add marker distance----------------------------------------
            sketch.fill(objOpts.marker.font_colour);
            sketch.noStroke();
            sketch.textFont(objOpts.marker.font);
            sketch.textSize(objOpts.marker.font_size);
            sketch.text(
              (Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
              (hole_x0 + shift_x) * xMag +
                pad_x +
                objOpts.marker.width * xMag +
                5,
              (marker_top + shift_y) * yMag + pad_y - 2
            );
            //make connection objects=================================================================================
            //add connection
            const [idxTo, isNext, numDisable] =
              this.getNearestConnectedMarkerIdx(LCCore, marker.id);

            //check connection
            if (idxTo == null) {
              //there is no connection
              continue;
            }

            //get connectied hole position
            const connectedHole_x0 =
              (objOpts.hole.distance + objOpts.hole.width) *
              (LCCore.holes[idxTo[1]].order - num_disable.hole - numDisable);
            const connectedMarker_top =
              LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]][
                objOpts.canvas.depth_scale
              ];

            //get connector position
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
            if (cn_y0 !== cn_y3) {
              //not horizontal
              //offScreenCtx.strokeStyle = "red";
            }
            if (!isNext) {
              //connected core is not located at the next
              sketch.drawingContext.setLineDash([5, 5]);
            } else {
              sketch.drawingContext.setLineDash([]);
            }

            if (
              marker.isMaster &&
              LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]]
                .isMaster
            ) {
              //if connection of master section
              sketch.stroke("blue");
            }

            //draw connection---------------------------------------------
            sketch.strokeWeight(objOpts.connection.line_width);
            sketch.stroke(markerLineColour);

            sketch.line(cn_x0, cn_y0, cn_x1, cn_y1); //start point
            sketch.line(cn_x1, cn_y1, cn_x2, cn_y2); //index left
            sketch.line(cn_x2, cn_y2, cn_x3, cn_y3); //index right

            //=====================================================================================================
          }
        }
      }

      //==========================================================================================
      //draw age points
      if (LCplot == null) {
        return;
      }

      //
      let age_plot_idx = null;
      LCplot.age_collections.forEach((a, idx) => {
        if (a.id == LCplot.age_selected_id) {
          age_plot_idx = idx;
        }
      });

      //get age data(because age data, age series is single)
      const ageSeries =
        LCplot.age_collections[age_plot_idx].datasets[0].data_series;

      //get position & plot

      for (let a = 0; a < ageSeries.length; a++) {
        num_disable = {
          hole: 0,
        };
        let posX;
        let posY;
        if (ageSeries[a].original_depth_type == "trinity") {
          //plot next to core
          //get hole
          let hole = null;
          let isSkip = false;
          for (let i = 0; i < LCCore.holes.length; i++) {
            const hole_temp = LCCore.holes[i];
            if (hole_temp.name == ageSeries[a].trinity.hole_name) {
              if (hole_temp.enable == false) {
                isSkip = true;
              }
              hole = hole_temp;
              break;
            } else {
              if (hole_temp.enable == false) {
                num_disable.hole += 1;
              }
            }
          }

          if (isSkip || hole == null) {
            //if disabel hole
            continue;
          }

          //calc position

          posX =
            ((objOpts.hole.distance + objOpts.hole.width) *
              (hole.order - num_disable.hole) +
              shift_x) *
              xMag +
            pad_x +
            objOpts.hole.width * xMag -
            objOpts.age.incon_size * 1.2;
          posY =
            (ageSeries[a][objOpts.canvas.depth_scale] + shift_y) * yMag +
            pad_y -
            objOpts.age.incon_size / 2;

          //console.log(posX + "/" + posY);
          //------------------------------------------------
        } else {
          //plot 0
          const age_shift_x = -50;
          posX =
            age_shift_x + shift_x * xMag + pad_x - objOpts.age.incon_size * 1.2;
          posY =
            (ageSeries[a][objOpts.canvas.depth_scale] + shift_y) * yMag +
            pad_y -
            objOpts.age.incon_size / 2;

          //console.log(ageSeries[a]);
          //console.log(ageSeries[a].name + ":" + posX + "/" + posY);
        }
        //---------------------------------------------------------------------------------------
        //plot main
        if (ageSeries[a].source_type == "") {
          sketch.image(
            ageVectorPlotIcons["none"],
            posX,
            posY,
            objOpts.age.incon_size,
            objOpts.age.incon_size
          );
        } else {
          sketch.image(
            ageVectorPlotIcons[ageSeries[a].source_type],
            posX,
            posY,
            objOpts.age.incon_size,
            objOpts.age.incon_size
          );
        }

        //---------------------------------------------------------------------------------------
      }

      //==========================================================================================

      sketch.pop(); //restore
    };

    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };
  };

  //============================================================================================
  //make raster view with using update plot
  function makeRasterObjects(isDrawObject) {
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

    //move area based on left and top loc
    offScreenCtx.save(); //save current location. after processing, restore
    offScreenCtx.translate(-canvasPos[0], -canvasPos[1]);

    //draw grid
    if (isGrid) {
      //function
      const title = (tickType) => {
        if (tickType == "age") {
          const text = "Age [calBP]";
          return text;
        } else if (tickType == "composite_depth") {
          const text = "Composite depth [m]";
          return text;
        } else if (tickType == "event_free_depth") {
          const text = "Event free depth [m]";
          return text;
        } else if (tickType == "drilling_depth") {
          const text = "Drilling depth [m]";
          return text;
        }
      };

      //scale title
      offScreenCtx.strokeStyle = "black";
      offScreenCtx.font = "20px Arial";
      rotateText(
        offScreenCtx,
        title(objOpts.canvas.depth_scale),
        -90,
        [
          scroller.scrollLeft + 30,
          scroller.scrollTop + scroller.clientHeight / 2,
        ],
        objOpts
      );

      //
      const gridStartY = (0 + shift_y) * yMag + pad_y; //pix
      let age_mod = 1;
      if (objOpts.canvas.depth_scale == "age") {
        age_mod = objOpts.canvas.age_zoom_correction;
      }
      const gridStepY = fitScaler(objOpts.canvas.zoom_level[1], yMag / age_mod); //pix

      const gridMaxY = canvasBaseHeight; //pix
      const gridMinY = objOpts.canvas.shift_y; //pix
      const gridMaxX = canvasBaseWidth;

      const tickType = objOpts.canvas.depth_scale;
      const tickStepY = 2;

      //function
      const txt = (tickType, y) => {
        const d = (y - pad_y) / yMag - shift_y;
        if (tickType == "age") {
          const text = " " + Math.round(d).toLocaleString();
          return text;
        } else {
          const text = " " + (Math.round(d) / 100).toFixed(2).toLocaleString();
          return text;
        }
      };

      //ygrid downward
      for (let y = gridStartY; y < gridMaxY; y += gridStepY) {
        //grid
        offScreenCtx.beginPath();
        offScreenCtx.moveTo(120, y);
        offScreenCtx.lineTo(gridMaxX, y);
        offScreenCtx.strokeStyle = objOpts.canvas.grid_solour; //"#ccc";
        offScreenCtx.lineWidth = objOpts.canvas.grid_width;
        offScreenCtx.stroke();

        //label
        const tickLabel = txt(tickType, y);
        const tickWidth = ctx.measureText(tickLabel).width;
        offScreenCtx.strokeStyle = "black";
        offScreenCtx.font = "20px Arial";
        offScreenCtx.fillText(tickLabel, scroller.scrollLeft + 50, y + 8);
      }

      //ygrid upward
      for (let y = gridStartY; y > gridMinY; y -= gridStepY) {
        //grid
        offScreenCtx.beginPath();
        offScreenCtx.moveTo(120, y);
        offScreenCtx.lineTo(gridMaxX, y);
        offScreenCtx.strokeStyle = objOpts.canvas.grid_solour; //"#ccc";
        offScreenCtx.lineWidth = objOpts.canvas.grid_width;
        offScreenCtx.stroke();

        //label
        const tickLabel = txt(tickType, y);
        const tickWidth = ctx.measureText(tickLabel).width;
        offScreenCtx.strokeStyle = "black";
        offScreenCtx.font = "20px Arial";
        offScreenCtx.fillText(tickLabel, scroller.scrollLeft + 50, y + 8);
      }
    }

    //-----------------------------------------------------------------------------------------------------------------------
    //draw model
    let num_disable = {
      hole: 0,
    };

    for (let h = 0; h < LCCore.holes.length; h++) {
      //make hole objects===================================================================================
      //load hole data
      const hole = LCCore.holes[h];

      //check enable
      if (!hole.enable) {
        //case not plot, count
        num_disable.hole += 1;
        continue;
      }

      //calc position excluding diable holes------------------------------
      let hole_top = hole.sections[0].markers[0][objOpts.canvas.depth_scale];
      let hole_bottom = hole.sections.slice(-1)[0].markers.slice(-1)[0][
        objOpts.canvas.depth_scale
      ];
      let hole_x0 =
        (objOpts.hole.distance + objOpts.hole.width) *
        (hole.order - num_disable.hole);

      //check position
      if (hole_top == null || hole_bottom == null || hole_x0 == null) {
        console.log(h + " th hole has any problem in the position.");
        continue;
      }

      // draw hole line --------------------------------------------------
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

      //add  hole name---------------------------------------------------
      offScreenCtx.fillStyle = objOpts.hole.font_colour;
      offScreenCtx.font =
        objOpts.hole.font_size.toString() + "px " + objOpts.hole.font;
      offScreenCtx.fillText(
        hole.name,
        (hole_x0 + shift_x + objOpts.hole.width * 0.3) * xMag + pad_x,
        (hole_top + shift_y) * yMag + pad_y - 20
      );

      //get plot order for hit test--------------------------------------
      let section_plot_order = [];
      for (let i = 0; i < hole.sections.length; i++) {
        section_plot_order.push(i);
      }

      /*
      if (hit_object_idx !== null) {
        if (h == hit_object_idx[0]) {
          //extract hit object
          const hitObj = section_plot_order.slice(hit_object_idx[1], 1)[0];

          //insert last order
          section_plot_order.push(hitObj);
        }
      }
      */

      for (let s_o = 0; s_o < hole.sections.length; s_o++) {
        const s = section_plot_order[s_o];

        //make section objects===================================================================================
        //load section data
        const section = hole.sections[s];

        //calc position----------------------------------------------------
        let section_top = section.markers[0][objOpts.canvas.depth_scale];
        let section_bottom =
          section.markers.slice(-1)[0][objOpts.canvas.depth_scale];
        let section_mid = (section_top + section_bottom) / 2;

        //check position
        if (section_top == null || section_bottom == null) {
          console.log(
            h +
              " th hole, " +
              s +
              " th section has any problem in the position."
          );
          continue;
        }

        //calc position
        const sec_x0 = (hole_x0 + shift_x) * xMag + pad_x;
        const sec_y0 = (section_top + shift_y) * yMag + pad_y;
        const sec_w = objOpts.section.width * xMag;
        const sec_h = (section_bottom - section_top) * yMag;

        //draw section-----------------------------------------------------
        offScreenCtx.setLineDash([]);
        offScreenCtx.lineWidth = objOpts.section.line_width;
        offScreenCtx.strokeStyle = objOpts.section.line_colour;
        offScreenCtx.fillStyle = objOpts.section.face_colour;
        offScreenCtx.beginPath();
        filledRoundSection(offScreenCtx, sec_x0, sec_y0, sec_w, sec_h, 10);
        roundSection(offScreenCtx, sec_x0, sec_y0, sec_w, sec_h, 10);

        //check zoom level for ignoring plot markers
        if (objOpts.canvas.zoom_level[1] < objOpts.marker.ignore_zoom_level) {
          continue;
        }

        //add section name-------------------------------------------------
        offScreenCtx.fillStyle = objOpts.section.font;
        offScreenCtx.font = objOpts.section.font_colour;
        offScreenCtx.beginPath();
        rotateText(
          offScreenCtx,
          hole.name + "-" + section.name,
          -90,
          [
            (hole_x0 + shift_x) * xMag + pad_x - 10,
            (section_mid + shift_y) * yMag + pad_y,
          ],
          objOpts
        );

        for (let m = 0; m < section.markers.length; m++) {
          //make marker objects=================================================================================
          //load marker data
          const marker = section.markers[m];
          let markerLineColour = objOpts.marker.line_colour;

          //calc marker position
          let marker_top = marker[objOpts.canvas.depth_scale];

          //check position
          if (marker_top == null) {
            console.log(
              h +
                " th hole, " +
                s +
                " th section, " +
                m +
                " th marker position has any problem."
            );
          }

          //first, draw event
          for (let e = 0; e < marker.event.length; e++) {
            //make marker objects=================================================================================
            //get position
            const event = marker.event[e];

            const [lowerDepth, eventThickness] = getEventPosiotion(
              LCCore,
              event,
              marker_top,
              objOpts
            );

            //draw event layers
            if (lowerDepth !== null) {
              offScreenCtx.setLineDash([]);
              offScreenCtx.fillStyle = objOpts.event.face_colour[event[3]];
              markerLineColour = objOpts.event.face_colour[event[3]];
              offScreenCtx.beginPath();
              const ex0 = (hole_x0 + shift_x) * xMag + pad_x + 3;
              const ey0 = (lowerDepth + shift_y) * yMag + pad_y;
              const ew = objOpts.section.width * xMag - 6;
              const eh = eventThickness * yMag;
              offScreenCtx.fillRect(ex0, ey0, ew, eh);
              offScreenCtx.stroke();
            }
          }

          //make marker objects=================================================================================
          // draw markers
          offScreenCtx.setLineDash([]);
          offScreenCtx.lineWidth = objOpts.marker.line_width;
          offScreenCtx.strokeStyle = objOpts.marker.line_colour; //markerLineColour;

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

          //add rank marker-------------------------------------------
          offScreenCtx.beginPath();
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

          //add marker name--------------------------------------------
          //add marker name without top/bottom name
          if (m !== 0 && m !== section.markers.length - 1) {
            offScreenCtx.fillStyle = objOpts.marker.font_colour;
            offScreenCtx.font =
              objOpts.marker.font_size.toString() + "px " + objOpts.marker.font;
            offScreenCtx.beginPath();
            offScreenCtx.fillText(
              marker.name,
              (hole_x0 + shift_x) * xMag + pad_x + 10,
              (marker_top + shift_y) * yMag + pad_y - 2
            );
          }

          //add marker distance----------------------------------------
          offScreenCtx.fillStyle = objOpts.marker.font_colour;
          offScreenCtx.font =
            objOpts.marker.font_size.toString() + "px " + objOpts.marker.font;
          offScreenCtx.beginPath();
          offScreenCtx.fillText(
            (Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
            (hole_x0 + shift_x) * xMag +
              pad_x +
              objOpts.marker.width * xMag +
              5,
            (marker_top + shift_y) * yMag + pad_y - 2
          );
          //make connection objects=================================================================================
          //add connection
          const [idxTo, isNext, numDisable] = this.getNearestConnectedMarkerIdx(
            LCCore,
            marker.id
          );

          //check connection
          if (idxTo == null) {
            //there is no connection
            continue;
          }

          //get connectied hole position
          const connectedHole_x0 =
            (objOpts.hole.distance + objOpts.hole.width) *
            (LCCore.holes[idxTo[1]].order - num_disable.hole - numDisable);
          const connectedMarker_top =
            LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]][
              objOpts.canvas.depth_scale
            ];

          //get connector position
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
            LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]].isMaster
          ) {
            //if connection of master section
            offScreenCtx.strokeStyle = "blue";
          }

          //draw connection---------------------------------------------
          offScreenCtx.beginPath();
          offScreenCtx.moveTo(cn_x0, cn_y0); //start point
          offScreenCtx.lineTo(cn_x1, cn_y1); //index left
          offScreenCtx.lineTo(cn_x2, cn_y2); //index right
          offScreenCtx.lineTo(cn_x3, cn_y3); //index left
          offScreenCtx.stroke();
          //=====================================================================================================
        }
      }
    }
    //==========================================================================================
    //draw age points
    if (LCplot == null) {
      return;
    }

    //
    let age_plot_idx = null;
    LCplot.age_collections.forEach((a, idx) => {
      if (a.id == LCplot.age_selected_id) {
        age_plot_idx = idx;
      }
    });

    //get age data(because age data, age series is single)
    const ageSeries =
      LCplot.age_collections[age_plot_idx].datasets[0].data_series;

    //plot

    for (let a = 0; a < ageSeries.length; a++) {
      num_disable = {
        hole: 0,
      };
      let posX;
      let posY;
      if (ageSeries[a].original_depth_type == "trinity") {
        //plot next to core
        //get hole
        let hole = null;
        let isSkip = false;

        for (let i = 0; i < LCCore.holes.length; i++) {
          const hole_temp = LCCore.holes[i];
          if (hole_temp.name == ageSeries[a].trinity.hole_name) {
            if (hole_temp.enable == false) {
              isSkip = true;
            }
            hole = hole_temp;
            break;
          } else {
            if (hole_temp.enable == false) {
              num_disable.hole += 1;
            }
          }
        }

        if (isSkip || hole == null) {
          //if disabel hole
          continue;
        }

        //calc position
        posX =
          ((objOpts.hole.distance + objOpts.hole.width) *
            (hole.order - num_disable.hole) +
            shift_x) *
            xMag +
          pad_x +
          objOpts.hole.width * xMag -
          objOpts.age.incon_size * 1.2;
        posY =
          (ageSeries[a][objOpts.canvas.depth_scale] + shift_y) * yMag +
          pad_y -
          objOpts.age.incon_size / 2;

        //console.log(posX + "/" + posY);
        //------------------------------------------------
      } else {
        //plot 0
        const age_shift_x = -50;
        posX =
          age_shift_x + shift_x * xMag + pad_x - objOpts.age.incon_size * 1.2;
        posY =
          (ageSeries[a][objOpts.canvas.depth_scale] + shift_y) * yMag +
          pad_y -
          objOpts.age.incon_size / 2;

        //console.log(ageSeries[a]);
        //console.log(ageSeries[a].name + ":" + posX + "/" + posY);
      }

      //plotlet
      if (ageSeries[a].source_type == "") {
        offScreenCtx.drawImage(
          agePlotIcons["none"],
          posX,
          posY,
          objOpts.age.incon_size,
          objOpts.age.incon_size
        );
      } else if (
        ageSeries[a].source_type == "terrestrial" ||
        ageSeries[a].source_type == "marine" ||
        ageSeries[a].source_type == "orbital" ||
        ageSeries[a].source_type == "climate" ||
        ageSeries[a].source_type == "tephra" ||
        ageSeries[a].source_type == "general"
      ) {
        offScreenCtx.drawImage(
          agePlotIcons[ageSeries[a].source_type],
          posX,
          posY,
          objOpts.age.incon_size,
          objOpts.age.incon_size
        );
      } else {
        offScreenCtx.drawImage(
          agePlotIcons["none"],
          posX,
          posY,
          objOpts.age.incon_size,
          objOpts.age.incon_size
        );
      }
    }
    //==========================================================================================
    offScreenCtx.restore();
  }
  //--------------------------------------------------------------------------------------------
  function updateRaster(drawPosition) {
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

  //=============================================================================================
  //--------------------------------------------------------------------------------------------
  const measureSketch = (sketch) => {
    let clickCount = 2;
    let startPoint = null;
    let endPoint = null;
    measureObject;

    sketch.setup = () => {
      sketchCanvas = sketch.createCanvas(
        scroller.clientWidth,
        scroller.clientHeight,
        sketch.P2D
      );

      sketch.background(0, 0, 0, 0);
      sketch.strokeWeight(2);
      sketch.stroke("red");
      //sketch.noLoop();
      sketchCanvas.parent("p5measureCanvas");
      clickCount = 3;
    };

    sketch.draw = () => {
      console.log(clickCount);
      sketch.strokeWeight(2);
      sketch.push(); // Save settings
      sketch.translate(-scroller.scrollLeft, -scroller.scrollTop);

      sketch.clear();
      if (clickCount == 1) {
        sketch.line(
          (startPoint[0] + objOpts.canvas.shift_x) *
            objOpts.canvas.zoom_level[0] *
            objOpts.canvas.dpir +
            objOpts.canvas.pad_x,
          (startPoint[1] + objOpts.canvas.shift_y) *
            objOpts.canvas.zoom_level[1] *
            objOpts.canvas.dpir +
            objOpts.canvas.pad_y,
          sketch.mouseX + scroller.scrollLeft,
          sketch.mouseY + scroller.scrollTop
        );
        sketch.pop(); // Restore settings
      } else if (clickCount == 0) {
        sketch.line(
          (startPoint[0] + objOpts.canvas.shift_x) *
            objOpts.canvas.zoom_level[0] *
            objOpts.canvas.dpir +
            objOpts.canvas.pad_x,
          (startPoint[1] + objOpts.canvas.shift_y) *
            objOpts.canvas.zoom_level[1] *
            objOpts.canvas.dpir +
            objOpts.canvas.pad_y,
          (endPoint[0] + objOpts.canvas.shift_x) *
            objOpts.canvas.zoom_level[0] *
            objOpts.canvas.dpir +
            objOpts.canvas.pad_x,
          (endPoint[1] + objOpts.canvas.shift_y) *
            objOpts.canvas.zoom_level[1] *
            objOpts.canvas.dpir +
            objOpts.canvas.pad_y
        );
      }
    };

    // Window resize handler should be outside of draw()
    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };

    sketch.mouseClicked = () => {
      if (clickCount == 2) {
        startPoint = [0, 0];
        clickCount -= 1;
        sketch.loop();
        //convert depth scale
        startPoint[0] =
          (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) /
            objOpts.canvas.zoom_level[0] /
            objOpts.canvas.dpir -
          objOpts.canvas.shift_x;
        startPoint[1] =
          (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y) /
            objOpts.canvas.zoom_level[1] /
            objOpts.canvas.dpir -
          objOpts.canvas.shift_y;
        //finish
        measureObject.measureData.start = startPoint;
        console.log("Strat: " + startPoint);
      } else if (clickCount == 1) {
        endPoint = [0, 0];
        clickCount -= 1;
        sketch.noLoop();
        //convert depth scale
        endPoint[0] =
          (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) /
            objOpts.canvas.zoom_level[0] /
            objOpts.canvas.dpir -
          objOpts.canvas.shift_x;
        endPoint[1] =
          (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y) /
            objOpts.canvas.zoom_level[1] /
            objOpts.canvas.dpir -
          objOpts.canvas.shift_y;
        //finish
        measureObject.measureData.end = endPoint;
        console.log("End: " + endPoint);
        measureResults();
      } else if (clickCount > 0) {
        clickCount -= 1;
      }
    };
  };
  //--------------------------------------------------------------------------------------------

  async function measureResults() {
    //calc
    let upperVal = null;
    let lowerVal = null;

    if (
      measureObject.measureData.start[1] <= measureObject.measureData.end[1]
    ) {
      upperVal = measureObject.measureData.start[1];
      lowerVal = measureObject.measureData.end[1];
    } else {
      lowerVal = measureObject.measureData.start[1];
      upperVal = measureObject.measureData.end[1];
    }

    const upperData = await window.LCapi.depthConvert(
      ["", upperVal],
      measureObject.measureData.type,
      "linear"
    );
    const lowerData = await window.LCapi.depthConvert(
      ["", lowerVal],
      measureObject.measureData.type,
      "linear"
    );

    //calc stat
    const meanAge = (lowerData.age_mid + upperData.age_mid) / 2;
    const meanCD = (lowerData.cd + upperData.cd) / 2;
    const meanEFD = (lowerData.efd + upperData.efd) / 2;

    const duration = lowerData.age_mid - upperData.age_mid;
    const thicknessCD = lowerData.cd - upperData.cd;
    const thicknessEFD = lowerData.efd - upperData.efd;

    const srCD = thicknessCD / duration;
    const srEFD = thicknessEFD / duration;

    console.log(lowerData);
    console.log(upperData);

    //show
    const text =
      "1. Mean\nComposite depth: " +
      (Math.round(meanCD * 10) / 10).toLocaleString() +
      " cm\nEvent free depth: " +
      (Math.round(meanEFD * 10) / 10).toLocaleString() +
      " cm\nAge: " +
      (Math.round(meanAge * 10) / 10).toLocaleString() +
      " calBP\n\n2. Duration/Thickness\nThickness(CD): " +
      (Math.round(thicknessCD * 10) / 10).toLocaleString() +
      " cm\nThickness(EFD): " +
      (Math.round(thicknessEFD * 10) / 10).toLocaleString() +
      " cm\nDuration: " +
      (Math.round(duration * 10) / 10).toLocaleString() +
      " yrs\n\n3. Sedimentation rate\nCD: " +
      Math.round(srCD * 1000) / 1000 +
      " cm/yr\nEFD: " +
      Math.round(srEFD * 1000) / 1000 +
      " cm/yr";
    alert(text);

    document.getElementById("bt_measure").style.backgroundColor = "#f0f0f0";
    penObject.isMeasure = false;
    measureObject.measureCanvas = null;
    measureObject.measureData.type = null;
    measureObject.measureData.start = null;
    measureObject.measureData.end = null;

    const parentElement2 = document.getElementById("p5measureCanvas");
    while (parentElement2.firstChild) {
      parentElement2.removeChild(parentElement2.firstChild);
    }

    console.log(
      measureObject.measureData.start + "==>" + measureObject.measureData.end
    );
  }
  //--------------------------------------------------------------------------------------------
  const penSketch = (sketch) => {
    let penData = [];
    let count = 0;

    sketch.setup = () => {
      sketchCanvas = sketch.createCanvas(
        scroller.clientWidth,
        scroller.clientHeight,
        sketch.P2D
      );

      sketch.background(0, 0, 0, 0);
      sketch.strokeWeight(2);
      sketch.stroke("red");
      sketch.noLoop();
      sketchCanvas.parent("p5penCanvas");
    };

    sketch.draw = () => {
      sketch.clear();
      if (penObject.isPen) {
        sketch.strokeWeight(2);
        sketch.push(); // Save settings
        sketch.translate(-scroller.scrollLeft, -scroller.scrollTop);

        //plot previousdata(convert pixscale)
        for (let i = 0; i < penData.length; i++) {
          sketch.line(
            (penData[i][0] + objOpts.canvas.shift_x) *
              objOpts.canvas.zoom_level[0] *
              objOpts.canvas.dpir +
              objOpts.canvas.pad_x,
            (penData[i][1] + objOpts.canvas.shift_y) *
              objOpts.canvas.zoom_level[1] *
              objOpts.canvas.dpir +
              objOpts.canvas.pad_y,
            (penData[i][2] + objOpts.canvas.shift_x) *
              objOpts.canvas.zoom_level[0] *
              objOpts.canvas.dpir +
              objOpts.canvas.pad_x,
            (penData[i][3] + objOpts.canvas.shift_y) *
              objOpts.canvas.zoom_level[1] *
              objOpts.canvas.dpir +
              objOpts.canvas.pad_y
          );
        }

        sketch.stroke(objOpts.pen.colour);

        if (sketch.mouseIsPressed) {
          sketch.line(
            sketch.mouseX + scroller.scrollLeft,
            sketch.mouseY + scroller.scrollTop,
            sketch.pmouseX + scroller.scrollLeft,
            sketch.pmouseY + scroller.scrollTop
          );

          //convert depth scale
          penData.push([
            (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) /
              objOpts.canvas.zoom_level[0] /
              objOpts.canvas.dpir -
              objOpts.canvas.shift_x,
            (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y) /
              objOpts.canvas.zoom_level[1] /
              objOpts.canvas.dpir -
              objOpts.canvas.shift_y,
            (sketch.pmouseX + scroller.scrollLeft - objOpts.canvas.pad_x) /
              objOpts.canvas.zoom_level[0] /
              objOpts.canvas.dpir -
              objOpts.canvas.shift_x,
            (sketch.pmouseY + scroller.scrollTop - objOpts.canvas.pad_y) /
              objOpts.canvas.zoom_level[1] /
              objOpts.canvas.dpir -
              objOpts.canvas.shift_y,
          ]);
        }

        sketch.pop(); // Restore settings
      }
    };

    // Window resize handler should be outside of draw()
    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };
    sketch.mousePressed = () => {
      if (sketch.mouseButton == sketch.LEFT) {
        sketch.pmouseX = sketch.mouseX;
        sketch.pmouseY = sketch.mouseY;
        sketch.loop(); //
      } else if (sketch.mouseButton == sketch.RIGHT) {
        if (confirm("Are you sure you want to delete the written data?")) {
          sketch.pmouseX = sketch.mouseX;
          sketch.pmouseY = sketch.mouseY;
          penData = [];
          sketch.redraw();
        } else {
        }
      }
    };

    sketch.mouseReleased = () => {
      sketch.noLoop(); //
    };
  };
  //--------------------------------------------------------------------------------------------

  //--------------------------------------------------------------------------------------------

  async function registerModel(in_path) {
    if (in_path == null) {
      return;
    }

    //mount model into LCCore
    const results = await window.LCapi.RegisterModelFromCsv(in_path);

    if (results == null) {
      return;
    }

    correlation_model_list.push(results); //{id,name,path}

    console.log("Correlation model is registered.");
    console.log(results);
  }

  async function loadModel(model_id) {
    model_id = 1;
    //load model into LCCore
    //now, LC is able to hold one project file, model_id is dummy
    LCCore = await window.LCapi.LoadModelFromLCCore(model_id);

    if (LCCore) {
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

      //sort
      sortHoleByRank(LCCore);
      //shwo model summary
      //console.log(LCCore);
      console.log("Correlation model Loaded.");
      console.log({ ID: LCCore.id, Name: LCCore.name });

      updateView();
    }
  }

  async function registerAge(in_path) {
    if (in_path == null) {
      return;
    }

    //load age model
    const results = await window.LCapi.RegisterAgeFromCsv(in_path);
    console.log(results);

    if (results) {
      //add list
      age_model_list.push(results); //{id,name,path}

      //add dropdown
      const newOption = document.createElement("option");
      newOption.value = results.id;
      newOption.textContent = results.name;
      document.getElementById("AgeModelSelect").appendChild(newOption);

      console.log("Age model is registered.");
      console.log(results);
    }
  }

  async function loadAge(age_id) {
    //load age model
    const results = await window.LCapi.LoadAgeFromLCAge(age_id);

    if (results) {
      //shwo model summary
      LCCore = results;

      let name = "";
      age_model_list.forEach((a) => {
        if (a.id == age_id) {
          name = a.name;
        }
      });

      console.log("Age model loaded.");
      console.log({ ID: age_id, Name: name });

      console.log(LCCore);

      updateView();
    } else {
      console.log("RENDERER: Fail to read age model.");
    }
  }
  async function registerPlotFromLCAge() {
    if (correlation_model_list.length == 0) {
      return;
    }
    if (age_model_list.length == 0) {
      return;
    }
    //load age model
    await window.LCapi.RegisterPlotFromLCAge();
  }
  async function loadPlotData() {
    //LC plot age_collection id is as same as LCAge id
    const results = await window.LCapi.LoadPlotFromLCPlot();
    if (results) {
      LCplot = results;
      console.log("Plot age data loaded");
      console.log(results);
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
  }
  async function initiarisePlot() {
    //canvas initiarise(remove all children)

    //data initiarise
    await window.LCapi.InitiarisePlot();
    LCplot = null;
  }
  async function initiariseCanvas() {
    //plot update
    if (isDrawVector) {
      //canvas initiarise
      const parentElement1 = document.getElementById("p5Canvas"); //vector plot
      while (parentElement1.firstChild) {
        parentElement1.removeChild(parentElement1.firstChild);
      }
      const parentElement2 = document.getElementById("p5penCanvas"); //pen
      while (parentElement2.firstChild) {
        parentElement2.removeChild(parentElement2.firstChild);
      }
      vectorObjects = null;
      penObject = { isPen: false, penCanvas: null, penData: [] };
      document.getElementById("bt_pen").style.backgroundColor = "#f0f0f0";
      document.getElementById("p5penCanvas").style.display = "none";
    } else {
      //clear canvas data
      offScreenCtx.clearRect(0, 0, scroller.clientWidth, scroller.clientHeight); //initiarise
      //plot update
      updateRaster([0, 0]);
    }
  }
  function updateView() {
    if (LCCore) {
      //update
      if (isDrawVector) {
        if (vectorObjects == null) {
          vectorObjects = new p5(p5Sketch);
        }

        document.getElementById("p5Canvas").style.display = "block";
        document.getElementById("rasterCanvas").style.display = "none";
        makeP5CanvasBase();
        vectorObjects.redraw();
      } else {
        document.getElementById("p5Canvas").style.display = "none";
        document.getElementById("rasterCanvas").style.display = "block";
        //make virtual canvas data
        makeRasterObjects(true);
        //plot update
        updateRaster([0, 0]);
      }
    }

    //update pen canvas
    if (penObject.penCanvas) {
      penObject.penCanvas.redraw();
    }
  }
  //============================================================================================
});

//============================================================================================
//============================================================================================
//subfunctions
//============================================================================================
//============================================================================================

function rotateText(ctx, txt, degree, center, objOpts) {
  const textWidth = ctx.measureText(txt).width;
  ctx.save();
  ctx.translate(center[0], center[1] + textWidth / 2); //move rotation center
  ctx.rotate((degree * Math.PI) / 180);
  ctx.fillStyle = objOpts.section.font_colour;
  ctx.font =
    objOpts.section.font_size.toString() + "px " + objOpts.section.font;
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
  let step = null;

  if (zoom_level <= 0.4) {
    step = 1000 * mag;
  } else if (zoom_level <= 1.2) {
    step = 100 * mag;
  } else if (zoom_level <= 3) {
    step = 50 * mag;
  } else if (zoom_level <= 8) {
    step = 10 * mag;
  } else if (zoom_level <= 20) {
    step = 5 * mag;
  } else {
    step = 1 * mag;
  }

  return step;
}
function getNearestConnectedMarkerIdx(LCCore, idFrom) {
  //get first step data
  const idxFrom = this.getIdxById(LCCore, idFrom);
  const currentMarkerData =
    LCCore.holes[idxFrom[1]].sections[idxFrom[2]].markers[idxFrom[3]];
  const currentHoleData = LCCore.holes[idxFrom[1]];

  //check first data
  if (
    currentMarkerData.h_connection == null ||
    currentMarkerData.h_connection.length == 0
  ) {
    return [null, null, null];
  }

  //get first connection data
  let connectedMarkerData = null;
  let connectedHoleData = null;

  //check and replace---------------------------------------------------------------------------
  //get first data beacause some case include only single connection
  let idTo = currentMarkerData.h_connection[0];
  let idxTo = this.getIdxById(LCCore, idTo);

  //if next marker order is large and enable, get
  if (
    LCCore.holes[idxTo[1]].order > currentHoleData.order &&
    LCCore.holes[idxTo[1]].enable
  ) {
    connectedMarkerData =
      LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
    connectedHoleData = LCCore.holes[idxTo[1]];
  } else {
    //case lost connected marker and remains only connection (unsuspected error)
  }

  //if find marker located in nearer hole, replace---------------------------------------------
  if (currentMarkerData.h_connection.length > 1) {
    for (let i = 1; i < currentMarkerData.h_connection.length; i++) {
      //get 2nd or later index
      idTo = currentMarkerData.h_connection[i];
      idxTo = this.getIdxById(LCCore, idTo);

      //new connection available
      if (connectedHoleData !== null) {
        if (
          LCCore.holes[idxTo[1]].order - currentHoleData.order > 0 &&
          LCCore.holes[idxTo[1]].order < connectedHoleData.order &&
          LCCore.holes[idxTo[1]].enable
        ) {
          //if connected hole has large order, enable but the order smaller (nearer place in canvas) than stocked one.
          connectedMarkerData =
            LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
          connectedHoleData = LCCore.holes[idxTo[1]];
        }
      } else {
        //previously checked connection is died (unsuspected error)
        if (
          LCCore.holes[idxTo[1]].order > currentHoleData.order &&
          LCCore.holes[idxTo[1]].enable
        ) {
          connectedMarkerData =
            LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
          connectedHoleData = LCCore.holes[idxTo[1]];
        }
      }
    }
  }

  //count num disable holes between connection for plot x position------------------------------
  let numDisable = 0;
  if (connectedHoleData !== null) {
    //get all disable list of holes
    let disableList = [];
    for (let i = 0; i < LCCore.holes.length; i++) {
      disableList.push([LCCore.holes[i].order, LCCore.holes[i].enable]);
    }

    //sort by oreder
    disableList.sort((a, b) => (a[0] < b[0] ? -1 : 1));

    //count enable holes between current and connected holes
    for (let i = currentHoleData.order + 1; i < connectedHoleData.order; i++) {
      if (disableList[i][1] == false) {
        numDisable += 1;
      }
    }
  }

  //check and output---------------------------------------------------------------------------
  if (connectedMarkerData == null) {
    //if all connected markers are died(unsuspected error)
    return [null, null, null];
  } else {
    //check is ringht next for plot style
    let isNext = false;
    const idxTo = this.getIdxById(LCCore, connectedMarkerData.id);
    if (
      Math.abs(
        LCCore.holes[idxTo[1]].order -
          LCCore.holes[idxFrom[1]].order -
          numDisable
      ) == 1
    ) {
      isNext = true;
    }
    return [idxTo, isNext, numDisable];
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
async function getFooterInfo(y, objOpts) {
  let txt = "";
  let age = "";

  if (objOpts.canvas.depth_scale == "age") {
    txt = "Age: " + Math.round(y).toLocaleString() + " calBP";
  } else if (objOpts.canvas.depth_scale == "composite_depth") {
    age = await window.LCapi.GetAgeFromCD(y, "linear");
    txt =
      "Composite Depth: " +
      (Math.round(y) / 100).toFixed(2) +
      " m (Age: " +
      Math.round(age).toLocaleString() +
      " calBP)";
  } else if (objOpts.canvas.depth_scale == "drilling_depth") {
    txt = "Drilling Depth: " + (Math.round(y) / 100).toFixed(2) + " m";
  } else if (objOpts.canvas.depth_scale == "event_free_depth") {
    age = await window.LCapi.GetAgeFromEFD(y, "linear");
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

function getEventPosiotion(LCCore, event, marker_top, objOpts) {
  let eventTyoe = "none";
  let eventThickness = 0;
  let lowerDepth = null;
  if (event[1] == "downward" || event[1] == "through-down") {
    if (event[0] == "deposition" || event[0] == "markup") {
      if (event[2] !== null) {
        const conIdx = this.getIdxById(LCCore, event[2]); //event layer connected MarkerId
        lowerDepth =
          LCCore.holes[conIdx[1]].sections[conIdx[2]].markers[conIdx[3]][
            objOpts.canvas.depth_scale
          ];

        eventThickness = marker_top - lowerDepth;
      } else {
        console.group(
          "Null detected on the Event connection at the idx of [" +
            h +
            "," +
            s +
            "," +
            m +
            "]."
        );
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
  return [lowerDepth, eventThickness];
}

function calcCanvasBaseSize(LCCore, objOpts) {
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
  return [canvasBaseWidth, canvasBaseHeight];
}
async function createRasterCircleImage(canvasSize, radius, color) {
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");
  canvas.width = canvas.height = canvasSize;
  ctx.beginPath();
  ctx.arc(canvasSize / 2, canvasSize / 2, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
  return canvas.toDataURL();
}
async function loadRasterPlotIcons(agePlotIcons, objOpts) {
  for (let key in objOpts.age.incon_list) {
    const path = objOpts.age.incon_list[key][0];
    const colour = objOpts.age.incon_list[key][1];

    let img = new Image();
    img.src = path;
    img.onerror = async () => {
      img.src = await createRasterCircleImage(
        objOpts.age.incon_size,
        objOpts.age.alt_radius,
        colour
      );
    };
    agePlotIcons[key] = img;
  }

  let img = new Image();
  img.src = await createRasterCircleImage(
    objOpts.age.incon_size,
    objOpts.age.alt_radius,
    "black"
  );
  agePlotIcons["none"] = img;
}

async function loadVectorPlotIcons(ageVectorPlotIcons, objOpts) {
  new p5(async (p) => {
    ageVectorPlotIcons["none"] = await createVectorCircleImage(
      p,
      objOpts.age.incon_size,
      objOpts.age.alt_radius,
      "black"
    );
    for (let key in objOpts.age.incon_list) {
      const path = objOpts.age.incon_list[key][0];
      const colour = objOpts.age.incon_list[key][1];
      ageVectorPlotIcons[key] = await p.loadImage(
        path,
        async () => {
          //console.log("");
        },
        async () => {
          console.log("fail to load image of " + key);
          ageVectorPlotIcons[key] = await createVectorCircleImage(
            p,
            objOpts.age.incon_size,
            objOpts.age.alt_radius,
            colour
          );
        }
      );
    }
  });
}

async function createVectorCircleImage(p, canvasSize, radius, color) {
  let fallbackImg = p.createGraphics(canvasSize, canvasSize);
  fallbackImg.clear();
  fallbackImg.fill(color);
  fallbackImg.ellipse(canvasSize / 2, canvasSize / 2, radius * 2, radius * 2);
  return fallbackImg;
}

function sortHoleByRank(LCCore) {
  LCCore.holes.sort((a, b) => {
    a.order < b.order ? -1 : 1;
  });
}
//============================================================================================
