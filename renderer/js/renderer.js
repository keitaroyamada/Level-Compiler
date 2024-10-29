document.addEventListener("DOMContentLoaded", () => {
  //============================================================================================
  let developerMode = true;
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
  let isDrawVector = true; //plot p5 or canvas
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

  //view control
  let finderEnable = false;
  let dividerEnable = false;
  let isSVG = false;
  //============================================================================================

  //--------------------------------------------------------------------------------------------
  //plot properties
  let objOpts = {
    interface:[],
    canvas: [],
    project:[],
    hole: [],
    section: [],
    marker: [],
    event: [],
    connection: [],
    age: [],
    pen: [],
    edit:[],
  };
  objOpts.canvas.depth_scale = "composite_depth";
  objOpts.canvas.zoom_level = [4, 3]; //[x, y](1pix/2cm)
  objOpts.canvas.age_zoom_correction = [1/10, 100];//[zoom level, pad level]
  objOpts.canvas.dpir = 1; //window.devicePixelRatio || 1;
  objOpts.canvas.mouse_over_colour = "red";
  objOpts.canvas.pad_x = 200; //[px]
  objOpts.canvas.pad_y = 800; //[px]
  objOpts.canvas.shift_x = 0; //[cm]
  objOpts.canvas.shift_y = 0; //[cm]
  objOpts.canvas.bottom_pad = 100; //[cm]
  objOpts.canvas.background_colour = "white";
  objOpts.canvas.target_horizon = false;
  objOpts.canvas.is_grid = false;
  objOpts.canvas.grid_width = 0.8;
  objOpts.canvas.grid_colour = "gray";
  objOpts.canvas.is_target = false;//mouse target
  objOpts.canvas.is_event = true;
  objOpts.canvas.is_connection = true;
  objOpts.canvas.draw_core_photo = false;
  objOpts.canvas.finder_y = 0;

  objOpts.project.interval = 0;

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
  objOpts.marker.is_rank = false;
  objOpts.marker.rank_colours = [
    "blue",
    "green",
    "lightgreen",
    "orange",
    "red",
  ];
  objOpts.marker.ignore_zoom_level = 0.4;
  objOpts.marker.font = "Arial";
  objOpts.marker.font_size = 12;
  objOpts.marker.font_colour = "black";

  objOpts.event.line_colour = "red";
  objOpts.event.face_colour = {
    general: "Gold",
    erosion: "Teal",
    tephra: "Crimson",
    void: "Purple",
    disturbed: "SlateGray",
    earthquake: "green",
  };
  objOpts.event.line_width = 1;
  objOpts.event.line_colour = "Gray"; //rate
  objOpts.event.folded_width  = 0.2;//rate
  objOpts.event.face_height = 0.98;//rate

  objOpts.connection.line_colour = "Gray";
  objOpts.connection.line_width = 1.5;
  objOpts.connection.indexWidth = objOpts.hole.distance * 0.7; //20;
  objOpts.connection.emphasize_non_horizontal = true;
  objOpts.connection.show_remote_connections = true;
  objOpts.connection.emphasize_remote_connections = false;

  objOpts.pen.colour = "Red";

  objOpts.age.incon_size = 20;
  objOpts.age.alt_radius = 3;
   
  objOpts.age.incon_list = {
    terrestrial: [
      "",//"./resources/plot/terrestrial.png",
      "Green",
    ],
    marine: [
      "",//"./resources/plot/marine.png",
      "Blue",
    ],
    tephra: [
      "",//"./resources/plot/tephra.png",
      "Red",
    ],
    climate: [
      "",//"./resources/plot/climate.png",
      "Yellow",
    ],
    orbital: [
      "",//"./resources/plot/orbital.png",
      "Orange",
    ],
    general: [
      "",//"./resources/plot/general.png",
      "Gray",
    ],
    historical: [
      "",//"./resources/plot/historical.png",
      "Black"
    ],
    interpolation: [
      "",//"./resources/plot/interpolation.png",
      "Gray"
    ]
  };
  let resourcePaths = window.LCapi.getResourcePath();
  objOpts.age.incon_list = resourcePaths.plot;
  objOpts.interface.icon_list = resourcePaths.tool;
  //============================================================================================
  //resources
  //get plot image data
  let ageVectorPlotIcons = {};
  let modelImages = {
    image_dir: [],
    load_target_ids: [],
    drilling_depth: {},
    composite_depth: {},
    event_free_depth: {},
  };

  let agePlotIcons = {};

  LoadRasterIcons(agePlotIcons, objOpts);
  loadVectorPlotIcons(ageVectorPlotIcons, objOpts);
  loadToolIcons(objOpts);

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
    if(developerMode){
      //initiarise
      await initiariseCorrelationModel();
      await initiariseAgeModel();
      await initiariseCanvas();
      await initiarisePlot();

      //get model path
      const model_path1 = 
        "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG06 Correlation(24 Nov. 2023).csv";

      const model_path2 =
        "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[duo]SG14 Correlation(temp).csv";
      //const model_path =     "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[correlation]SG14 LC test model with event(temp).csv";
      const age1_path =
        "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal20 yr BP chronology for LC (01 Jun. 2021).csv";

      const age2_path =
        "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/[age]SG IntCal13 yr BP chronology for LC (06 Apr. 2020).csv";

      const photo_path = "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/core photo";

      //register correlation model
      await registerModel(model_path1);
      await registerModel(model_path2);

      //load model into renderer
      await loadModel();

      //register age model
      await registerAge(age1_path);
      await registerAge(age2_path);

      //load age model into LCCore
      await loadAge(age_model_list[0].id);

      //register age into LCplot
      await registerAgePlotFromLCAge();

      //load core images
      const response = await window.LCapi.askdialog(
        "Load core images",
        "Do you want to load the core images?"
      );
      if (response.response) {
        modelImages.image_dir = photo_path;
        modelImages.load_target_ids = [[1,1,1,null],[1,1,2,null],[1,1,3,null],[1,2,1,null],[1,2,2,null],[1,2,3,null]]; //= [];//load all

        //load images
        let originalImages = await loadCoreImages(modelImages, LCCore, "drilling_depth");
        modelImages["drilling_depth"] = originalImages;
        let compositeImages = await loadCoreImages(modelImages, LCCore, "composite_depth");
        modelImages["composite_depth"] = compositeImages;
        let eventFreeImages = await loadCoreImages(modelImages, LCCore, "event_free_depth");
        modelImages["event_free_depth"] = eventFreeImages;

      }

      //load LCplot
      await loadPlotData();

      //console.log(LCCore);
      //update
      updateView();
      //console.log(LCCore);
      //console.log(LCplot);
  }
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
  //target
  document.getElementById("bt_target").addEventListener("click", async (event) => {
      var target_line = document.getElementById("horizontal_target");
      if (objOpts.canvas.is_target) {
        objOpts.canvas.is_target = false;
        document.getElementById("bt_target").style.backgroundColor = "#f0f0f0";
        target_line.style.display = "none";
      } else {
        objOpts.canvas.is_target = true;
        document.getElementById("bt_target").style.backgroundColor = "#ccc";
        target_line.style.display = "block";
      }
      updateView();
    });
    //============================================================================================
  //connection
  document.getElementById("bt_connection").addEventListener("click", async (event) => {
    if (objOpts.canvas.is_connection) {
      objOpts.canvas.is_connection = false;
      document.getElementById("bt_connection").style.backgroundColor = "#f0f0f0";
    } else {
      objOpts.canvas.is_connection = true;
      document.getElementById("bt_connection").style.backgroundColor = "#ccc";
    }
    updateView();
  });
  //============================================================================================
  //show event layers
  document.getElementById("bt_event_layer").addEventListener("click", async (event) => {
      if (objOpts.canvas.is_event) {
        objOpts.canvas.is_event = false;
        document.getElementById("bt_event_layer").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.canvas.is_event = true;
        document.getElementById("bt_event_layer").style.backgroundColor = "#ccc";
      }
      updateView();
    });
  //============================================================================================
  //show core images
  document.getElementById("bt_core_photo").addEventListener("click", async (event) => {
    if (Object.keys(modelImages[objOpts.canvas.depth_scale]).length === 0) {
      return
    }
    if (objOpts.canvas.draw_core_photo) {
      objOpts.canvas.draw_core_photo = false;
      document.getElementById("bt_core_photo").style.backgroundColor = "#f0f0f0";
    } else {
      objOpts.canvas.draw_core_photo = true;
      document.getElementById("bt_core_photo").style.backgroundColor = "#ccc";
    }
    updateView();

    });
  //============================================================================================
  //rank
  document.getElementById("bt_rank").addEventListener("click", async (event) => {
      if (objOpts.marker.is_rank) {
        objOpts.marker.is_rank = false;
        document.getElementById("bt_rank").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.marker.is_rank = true;
        document.getElementById("bt_rank").style.backgroundColor = "#ccc";
      }
      updateView();
    });
  //============================================================================================
  //grid
  document.getElementById("bt_grid").addEventListener("click", async (event) => {
      if (objOpts.canvas.is_grid) {
        objOpts.canvas.is_grid = false;
        document.getElementById("bt_grid").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.canvas.is_grid = true;
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
  document.getElementById("AgeModelSelect").addEventListener("change", async (event) => {
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
  document.getElementById("bt_snapshot").addEventListener("click", async (event) => {
      if (isDrawVector) {
        //download vector image from p5 canvas
        isSVG = true;
        const targetCanvas = new p5(p5Sketch);
        targetCanvas.save("model.svg");
        const annotationCanvas = new p5(penSketch);
        annotationCanvas.save("model_annotation.svg");
        //targetCanvas.save("model.png");
        isSVG = false;
        console.log("[Renderer]: Take snapshot as svg.");
      } else {
        //download raster image from canvas
        const dataURL = canvas.toDataURL("image/png");
        measureSketch;
        const downloadLink = document.createElement("a");
        downloadLink.href = dataURL;
        downloadLink.download = "canvas-image.png";
        downloadLink.click();
        console.log("Take snapshot as png.");
      }
    });
  //============================================================================================
  //measure
  document.getElementById("bt_measure").addEventListener("click", async (event) => {
      if (LCCore) {
        if(objOpts.canvas.depth_scale !== "drilling_depth"){
          if (!measureObject.isMeasure) {
            measureObject.isMeasure = true;
            measureObject.measureCanvas = new p5(measureSketch);
            document.getElementById("bt_measure").style.backgroundColor = "#ccc";
            measureObject.measureData.type = objOpts.canvas.depth_scale;
          } else {
            measureObject.isMeasure = false;
            measureObject.measureCanvas = null;
            document.getElementById("bt_measure").style.backgroundColor = "#f0f0f0";
          }
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
      console.log("[Renderer]: Unload Models of Correlations, Ages and Canvas.");
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
    await registerAgePlotFromLCAge();
    await loadPlotData();

    //update plot
    updateView();
  });
  //============================================================================================
  //load age model
  window.LCapi.receive("LoadCoreImagesMenuClicked", async () => {
    if (correlation_model_list.length == 0) {
      return;
    }
    //call from main process
    let path = "";
    try {
      path = await window.LCapi.FolderChoseDialog("Chose Core images folder");
      if (path == null) {
        return;
      }
    } catch (error) {
      console.error("ERROR: File load error", error);
      return;
    }

    //load images
    modelImages.image_dir = path;
    modelImages.load_target_ids = [];//load all
    let originalImages = await loadCoreImages(modelImages, LCCore, "drilling_depth");
    modelImages["drilling_depth"] = originalImages;
    let compositeImages = await loadCoreImages(modelImages, LCCore, "composite_depth");
    modelImages["composite_depth"] = compositeImages;
    let eventFreeImages = await loadCoreImages(modelImages, LCCore, "event_free_depth");
    modelImages["event_free_depth"] = eventFreeImages;

    //update plot
    updateView();
  });
  //============================================================================================
  //load age model
  window.LCapi.receive("LoadPlotDataMenuClicked", async () => {
    if (correlation_model_list.length == 0) {
      return;
    }

    //call from main process
    let path = "";
    try {
      path = await window.LCapi.FileChoseDialog("Chose Plot Data csv file");
      if (path == null) {
        return;
      }
    } catch (error) {
      console.error("ERROR: File load error", error);
      return;
    }

    //load plot data

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
      console.error("[Renderer]: Correlation model load error.", error);
      return;
    }

    path

    //initiarise
    //await initiariseCorrelationModel();
    await initiariseAgeModel();
    await initiariseCanvas();
    await initiarisePlot();

    //mount correlation model
    const isResiter = await registerModel(path);

    if(isResiter){
      //load model into renderer
      await loadModel();

      //update plot
      updateView();
    }
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
  document.querySelector("#hole_list").addEventListener("change", function (event) {
      if (event.target.type === "checkbox") {
        //get id
        const target_id = event.target.id.split(",");
        const target_idx = getIdxById(LCCore, target_id);

        let setVal = false;
        let setType = "";
        if (event.target.checked) {
          setVal = true;
          setType = "Enable";
        } else {
          setVal = false;
          setType = "Disable";
        }

        if (target_id[1] == "") {
          //case project selected
          LCCore.projects[target_idx[0]].enable = setVal;
          LCCore.projects[target_idx[0]].holes.forEach((hole) => {
            hole.enable = setVal;
            const el = document.getElementById(hole.id.toString());
            el.checked = setVal;
            console.log("[Renderer]: Hole "+hole.name +" is "+setType+".");
          });
        } else {
          //case hole selected
          LCCore.projects[target_idx[0]].holes[target_idx[1]].enable = setVal;
          console.log("[Renderer]: Hole "+LCCore.projects[target_idx[0]].holes[target_idx[1]].name +" is "+setType+".");
        }

        //console.log(LCCore);
        //update plot
        updateView();
      }
    });
  //============================================================================================
  //reload
  document.getElementById("bt_reload").addEventListener("click", async (event) => {
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

      //reload correlation model
      for (let i = 0; i < temp_correlation_model_list.length; i++) {
        await registerModel(temp_correlation_model_list[i].path);
      }
      await loadModel(selecteed_cprrelation_model_id);

      //reload age model
      for (let i = 0; i < temp_age_model_list.length; i++) {
        await registerAge(temp_age_model_list[i].path);
      }
      await loadAge(selected_age_model_id);

      //reload plot data
      await registerAgePlotFromLCAge();
      await loadPlotData();

      console.log(LCCore);
      console.log(LCplot);

      //update plot
      updateView();

      console.log("Model reloaded.");
    });
  //============================================================================================
  //zoomout
  document.getElementById("bt_zoomout").addEventListener("click", async (event) => {
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
  //zoom0
  document.getElementById("bt_zoom0").addEventListener("click", async (event) => {
    if (LCCore) {
      objOpts.canvas.zoom_level = [4,3];

      
      //mouse position
      const relative_scroll_pos_x = scroller.scrollLeft / scroller.scrollWidth;
      const relative_scroll_pos_y = scroller.scrollTop / scroller.scrollHeight;

      //calc new canvas size
      const [canvasBase_width, canvasBase_height] = calcCanvasBaseSize(LCCore, objOpts);

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
  document.getElementById("bt_zoomin").addEventListener("click", async (event) => {
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
        objOpts.canvas.finder_y = 0;
        updateView();
      } else {
        finderEnable = false;
        document.getElementById("bt_finder").style.backgroundColor = "#f0f0f0";
        await LCapi.CloseFinder("CloseFinder", async () => {});
        updateView();
      }
    }
  });
  //============================================================================================
  //close finder
  window.LCapi.receive("FinderClosed", async () => {
    //call from main process
    finderEnable = false;
    updateView();
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

      //calc position
      let results = getClickedItemIdx(mouseX, mouseY, LCCore, objOpts);
      //console.log(results);
 
      await window.LCapi.SendDepthToFinder(results);
      console.log("[Renderer]: Send the clicked depth to Finder", results.y, objOpts.canvas.depth_scale);
    }
  });
  //============================================================================================
  window.LCapi.receive("rendererLog", async (data) => {
    console.log(data);
  });
  //============================================================================================
  //FInder send event (move to)
  window.LCapi.receive("MoveToHorizonFromFinder", async (data) => {
    //move position based on finder
      //get location
    let pos_y = data[objOpts.canvas.depth_scale];
    objOpts.canvas.finder_y = pos_y;
    console.log("[Renderer]: Recieved data from Finder: ", pos_y, objOpts.canvas.depth_scale);
    if(data.isMove){
      if (objOpts.canvas.depth_scale !== "drilling_depth") {
        var rect;
        if (isDrawVector) {
          rect = document.getElementById("p5Canvas").getBoundingClientRect(); // Canvas position and size
        } else {
          rect = document.getElementById("rasterCanvas").getBoundingClientRect(); // Canvas position and size
        }

        //convert scale from depth to pix
        //const canvasPosY =  yMag  * age_mod * (pos_y + shift_y) + pad_y - scroller.scrollTop;
        let canvasPosY = null;
        if (objOpts.canvas.depth_scale == "age") {
          canvasPosY = ((pos_y + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y + objOpts.canvas.age_zoom_correction[1])  * objOpts.canvas.age_zoom_correction[0];
        } else {
          canvasPosY = (pos_y + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y;
        }

        //update footer
        const txt = await getFooterInfo(LCCore, pos_y, objOpts);
        document.getElementById("footerLeftText").innerText = txt;

        //move scroller
        scroller.scrollTop = canvasPosY - scroller.clientHeight / 2;
        //scroller.moveTo(scroller.scrollLeft, pos_y);

        //move canvas
        let newPosY = canvasPosY - scroller.clientHeight / 2;
        if(newPosY <= 0){
          newPosY = 0;
        }
        canvasPos[1] = newPosY;

        //window.scrollTo({top:canvasPosY})
        
        //update plot
        //updateView();

        //target line
        var target_line = document.getElementById("horizontal_target");
        target_line.style.top = scroller.clientHeight / 2 + "px";
      }
    }
    updateView();
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
    let age_mod = 1;

    

    const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
    let yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
    const pad_x = objOpts.canvas.pad_x;
    let pad_y = objOpts.canvas.pad_y;
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;
    if (objOpts.canvas.depth_scale == "age") {
      yMag = yMag * objOpts.canvas.age_zoom_correction[0];
      pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
    }
    

    //mouse position
    let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
    let y = (scroller.scrollTop + mouseY - pad_y) / yMag  - shift_y;

    //get text
    const txt = await getFooterInfo(LCCore, y, objOpts);

    //update
    var el = document.getElementById("footerLeftText");
    el.innerText = txt;

    mousePos = [mouseX, mouseY];

    //target line
    var target_line = document.getElementById("horizontal_target");
    target_line.style.top = event.clientY + "px";
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
  scroller.addEventListener("scroll",async function (event) {
      //show depth/age
      //const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
      let yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
      //const pad_x = objOpts.canvas.pad_x;
      let pad_y = objOpts.canvas.pad_y;
      //const shift_x = objOpts.canvas.shift_x;
      const shift_y = objOpts.canvas.shift_y;
      if (objOpts.canvas.depth_scale == "age") {
        yMag = yMag * objOpts.canvas.age_zoom_correction[0];
        pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
      }

      //mouse position
      //const mouseCanvasPosX = (scroller.scrollLeft + mousePos[0] - pad_x) / xMag - shift_x;
      const mouseCanvasPosY =  (scroller.scrollTop + mousePos[1] - pad_y) / yMag - shift_y;
      const txt = await getFooterInfo(LCCore, mouseCanvasPosY, objOpts);
      document.getElementById("footerLeftText").innerText = txt;

      ///scroller position
      canvasPos[0] = scroller.scrollLeft; //* xMag;
      canvasPos[1] = scroller.scrollTop; //* yMag;

      //update plot
      updateView();

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
  document.addEventListener( "wheel",  function (event) {
      //wheel event
      var deltaX = event.deltaX;
      var deltaY = event.deltaY;

      if (event.ctrlKey) {
        //scroll lateral
        event.preventDefault();
        scroller.scrollBy({ left: deltaY * 1, behavior: "auto" });
      }

      if (event.shiftKey) {
        //change hole distance
        event.preventDefault();
        objOpts.hole.distance += 0.01 * deltaY;
        objOpts.connection.indexWidth = objOpts.hole.distance * 0.7;
        //objOpts.connection.indexWidth += 0.015 * deltaY;
        if (objOpts.connection.indexWidth < 0) {
          objOpts.connection.indexWidth = 0;
        }
        if (objOpts.connection.indexWidth > 20) {
          objOpts.connection.indexWidth = 20;
        }

        //update plot
        updateView();
      }

      if (event.altKey) {
        event.preventDefault();
        //add zoom level
        objOpts.canvas.zoom_level[0] += 0.01 * deltaX;
        if (event.ctrlKey) {
          //If ctrl key, x scroll
          objOpts.canvas.zoom_level[0] += 0.01 * deltaY;
        } else {
          //if no ctrl key, yscroll
          objOpts.canvas.zoom_level[1] += 0.01 * deltaY;
        }

        //limit of smaller
        if (objOpts.canvas.zoom_level[1] < 0.1) {
          objOpts.canvas.zoom_level[1] = 0.1;
        }
        if (objOpts.canvas.zoom_level[0] < 0.1) {
          objOpts.canvas.zoom_level[0] = 0.1;
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
      window.LCapi.toggleDevTools("main");
    }
  });
  //============================================================================================


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

    for (let p = 0; p < LCCore.projects.length; p++) {
      for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
        let hole_top =
          LCCore.projects[p].holes[h].sections[0].markers[0][
            objOpts.canvas.depth_scale
          ];
        let hole_bottom = LCCore.projects[p].holes[h].sections
          .slice(-1)[0]
          .markers.slice(-1)[0][objOpts.canvas.depth_scale];
        if (holes_top > hole_top) {
          holes_top = hole_top;
        }
        if (holes_bottom < hole_bottom) {
          holes_bottom = hole_bottom;
        }
      }
    }

    objOpts.canvas.shift_y = holes_top;

    //scale factor
    const dpir = objOpts.canvas.dpir; //window.devicePixelRatio || 1;

    const xMag = dpir * objOpts.canvas.zoom_level[0];
    let yMag = dpir * objOpts.canvas.zoom_level[1];
    const pad_x = objOpts.canvas.pad_x;
    let pad_y = objOpts.canvas.pad_y;
    if (objOpts.canvas.depth_scale == "age") {
      yMag = yMag * objOpts.canvas.age_zoom_correction[0];
      pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
    }

    //get shift amounts
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;

    //initiarise off screan canvas
    let num_total_holes = 0;
    LCCore.projects.forEach((project) => {
      if (project.enable) {
        project.holes.forEach((hole) => {
          if (hole.enable) {
            num_total_holes += 1;
          }
        });
      }
    });

    let canvasBaseWidth = parseInt(
      (objOpts.hole.distance + objOpts.hole.width + shift_x) *
        (num_total_holes + 1) *
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
      const pad_x = objOpts.canvas.pad_x;
      let pad_y = objOpts.canvas.pad_y;
      if (objOpts.canvas.depth_scale == "age") {
        yMag = yMag * objOpts.canvas.age_zoom_correction[0];
        pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
      }
      
      //get shift amounts
      const shift_x = objOpts.canvas.shift_x;
      const shift_y = objOpts.canvas.shift_y;

      //-----------------------------------------------------------------------------------------
      //draw grid
      if (LCCore && objOpts.canvas.is_grid) {
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
          age_mod = objOpts.canvas.age_zoom_correction[0];
        }
        const gridStepY = fitScaler(objOpts.canvas.zoom_level[1], yMag / age_mod); //pix

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
            const text = " " + (Math.round(d) / 100).toFixed(2).toLocaleString();
            return text;
          }
        };

        //ygrid downward
        for (let y = gridStartY; y < gridMaxY; y += gridStepY) {
          //grid
          sketch.drawingContext.setLineDash([]);
          sketch.strokeWeight(objOpts.canvas.grid_width);
          sketch.stroke(objOpts.canvas.grid_colour);
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
          sketch.stroke(objOpts.canvas.grid_colour);
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
      //draw finder target line
      if(finderEnable){        
        //get pos
        let num_disable = {total: 0, hole: 0};
        let maxHoleOrder = 0;
        let hole_x1 = 0;
        for (let p = 0; p < LCCore.projects.length; p++) {
          for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
            maxHoleOrder = LCCore.projects[p].holes[h].order;
            if (!LCCore.projects[p].holes[h].enable) {
              //case not plot, count
              num_disable.hole += 1;
              
              continue;
            }
            hole_x1 = 20 + (objOpts.hole.distance + objOpts.hole.width) * (num_disable.total + LCCore.projects[p].holes[h].order - num_disable.hole);
          }
          num_disable.total += LCCore.projects[p].holes.length + objOpts.project.interval;
        } 

        //fix position
        const target_y = (objOpts.canvas.finder_y + shift_y) * yMag + pad_y;
        //const target_x0 = 140;
        //const target_x1 = (hole_x1 + shift_x + objOpts.hole.width / 2) * xMag + pad_x;
        const target_x0 = canvasPos[0] + 20;
        const target_x1 = canvasPos[0] + scroller.clientWidth - 20;
        

        sketch.strokeWeight(1);
        sketch.stroke("Red");
        sketch.line(
          target_x0,
          target_y,
          target_x1,
          target_y
        );
        sketch.fill("Red");
        sketch.triangle(
          target_x0,      target_y,
          target_x0 - 10, target_y + 5, 
          target_x0 - 10, target_y - 5
          );
          sketch.triangle(
            target_x1,      target_y,
            target_x1 + 10, target_y + 5, 
            target_x1 + 10, target_y - 5
            );
      }

      //main
      let num_disable = {total: 0, hole: 0};
      for (let p = 0; p < LCCore.projects.length; p++) {
        const project = LCCore.projects[p];
        for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
          //make hole objects===================================================================================
          //load hole data
          const hole = project.holes[h];

          //check enable
          if (!hole.enable) {
            //case not plot, count
            num_disable.hole += 1;
            continue;
          }

          //calc position excluding diable holes------------------------------
          let hole_top = hole.sections[0].markers[0][objOpts.canvas.depth_scale];
          let hole_bottom = hole.sections.slice(-1)[0].markers.slice(-1)[0][objOpts.canvas.depth_scale];
          let hole_x0 = (objOpts.hole.distance + objOpts.hole.width) * (num_disable.total + hole.order - num_disable.hole);

          //check position
          if (hole_top == null && hole_bottom == null && hole_x0 == null) {
            //console.log(h + " th hole has any problem in the position.");
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
          }

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

            const view_rect = {
              x: scroller.scrollLeft,
              y: scroller.scrollTop,
              width: offScreenCanvas.width,
              height: offScreenCanvas.height,
            };

            //calc position----------------------------------------------------
            let section_top = section.markers[0][objOpts.canvas.depth_scale];
            let section_bottom =
              section.markers.slice(-1)[0][objOpts.canvas.depth_scale];
            let section_mid = (section_top + section_bottom) / 2;

            //check position
            if (section_top == null || section_bottom == null) {
              //console.log(  h +" th hole, " +  s +   " th section has any problem in the position."      );
              continue;
            }

            //calc position
            const sec_x0 = (hole_x0 + shift_x) * xMag + pad_x;
            const sec_y0 = (section_top + shift_y) * yMag + pad_y;
            const sec_w = objOpts.section.width * xMag;
            const sec_h = (section_bottom - section_top) * yMag;
            const sec_rect = {
              x: sec_x0,
              y: sec_y0,
              width: sec_w,
              height: sec_h,
            };

            //draw section-----------------------------------------------------
            if (!isInside(view_rect, sec_rect, 500)) {
              continue;
            }
            //sketch.drawingContext.setLineDash([]);
            sketch.strokeWeight(objOpts.section.line_width);
            sketch.stroke(objOpts.section.line_colour);
            sketch.fill(objOpts.section.face_colour);
            sketch.rect(sec_x0, sec_y0, sec_w, sec_h, 3, 3, 3, 3); //rounded

            //check zoom level for ignoring plot markers
            if (
              objOpts.canvas.zoom_level[1] < objOpts.marker.ignore_zoom_level
            ) {
              continue;
            }

            //add section photo-------------------------------------------------
            if (objOpts.canvas.draw_core_photo) {
              try {
                let ptoto_depth_scale;
                if(objOpts.canvas.depth_scale == "age"){
                  ptoto_depth_scale = "event_free_depth";
                } else {
                  ptoto_depth_scale = objOpts.canvas.depth_scale;
                }
                
                if (modelImages[ptoto_depth_scale][hole.name + "-" + section.name] !== undefined) {
                  try {
                    sketch.image(
                      modelImages[ptoto_depth_scale][
                        hole.name + "-" + section.name
                      ],
                      sec_x0,
                      sec_y0,
                      sec_w,
                      sec_h
                    );
                  } catch (error) {
                    console.error(error);
                    console.log(modelImages[ptoto_depth_scale][hole.name + "-" + section.name]);
                  }
                }
              } catch (err) {}
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
                //console.log(  h + " th hole, " + s + " th section, " +  m + " th marker position has any problem."  );
              }

              //first, draw event
              let ew = 1;
              if (!objOpts.canvas.is_event) {
                ew = objOpts.event.folded_width;
              }
              
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
                  if( objOpts.canvas.is_connection){
                    sketch.fill(objOpts.event.face_colour[event[3]]);
                    sketch.noStroke();
                    sketch.stroke(objOpts.event.face_colour[event[3]]);
                    sketch.rect(
                      (hole_x0 + shift_x) * xMag + pad_x + 3,
                      (lowerDepth + shift_y) * yMag + pad_y,
                      objOpts.section.width * ew * xMag - 6,
                      eventThickness * yMag * objOpts.event.face_height,
                      1,1,1,1 //rounded option
                    );
                  }
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
              let mw = 1;
               
              if (!objOpts.canvas.is_event) {
                mw = 0.2;
              }

              if( objOpts.canvas.is_connection){
                sketch.line(
                  (hole_x0 + shift_x) * xMag + pad_x,
                  (marker_top + shift_y) * yMag + pad_y,
                  (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * mw * xMag,// + topBot,
                  (marker_top + shift_y) * yMag + pad_y
                );
              }

              //add rank marker-------------------------------------------
              if (objOpts.marker.is_rank) {
                sketch.fill("black");
                sketch.noStroke();
                sketch.textFont("Arial");
                sketch.textSize(15);
                let rank_name = "null";
                if (marker.connection_rank != null){
                  rank_name = marker.connection_rank.toString();
                }
                sketch.text(
                  rank_name,
                  (hole_x0 + shift_x) * xMag + pad_x + 10,//- 23,
                  (marker_top + shift_y) * yMag + pad_y + 5
                );

                if (marker.connection_rank == null) {
                  sketch.fill("black");
                } else if (marker.connection_rank > 4) {
                  sketch.fill("brown");
                } else {
                  sketch.fill(
                    objOpts.marker.rank_colours[marker.connection_rank]
                  );
                }
                sketch.ellipse(
                  (hole_x0 + shift_x) * xMag + pad_x,
                  (marker_top + shift_y) * yMag + pad_y,
                  8
                );
              }

              //add marker name--------------------------------------------
              //add marker name without top/bottom name
              if (m !== 0 && m !== section.markers.length - 1) {
                if( objOpts.canvas.is_connection){
                  sketch.fill(objOpts.marker.font_colour);
                  sketch.noStroke();
                  sketch.textFont(objOpts.marker.font);
                  sketch.textSize(objOpts.marker.font_size);
                  sketch.text(
                    marker.name,
                    (hole_x0 + shift_x) * xMag + pad_x - sketch.textWidth(marker.name) - 5,//+ 10,
                    (marker_top + shift_y) * yMag + pad_y - 2
                  );
                }
              }

              //add marker distance----------------------------------------
              sketch.fill(objOpts.marker.font_colour);
              sketch.noStroke();
              sketch.textFont(objOpts.marker.font);
              sketch.textSize(objOpts.marker.font_size);
              if( objOpts.canvas.is_connection){
                sketch.text(
                  (Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
                  (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * xMag + 5,
                  (marker_top + shift_y) * yMag + pad_y - 2
                );
              }
              //add master section-----------------------------------------
              if (marker.isMaster) {
                if (section.markers[m + 1] !== undefined) {
                  if (section.markers[m + 1].isMaster) {
                    sketch.drawingContext.setLineDash([]);
                    sketch.strokeWeight(4);
                    sketch.stroke("blue"); //(markerLineColour);
                    const next_marker_top = section.markers[m + 1][objOpts.canvas.depth_scale];
                    sketch.line(
                      (hole_x0 + shift_x) * xMag + pad_x,
                      (marker_top + shift_y) * yMag + pad_y,
                      (hole_x0 + shift_x) * xMag + pad_x,
                      (next_marker_top + shift_y) * yMag + pad_y
                    );
                  }
                }
              }

              //-----------------------------------------------------------
              //make connection objects=================================================================================
              //add connection
              if( objOpts.canvas.is_connection){
                const connectionData = this.getNearestConnectedMarkerIdx( LCCore, marker.id, objOpts);

                //check connection
                if (connectionData == null) {
                  //there is no connection
                  continue;
                }

                const idxTo = connectionData.connected_idx;

                //get connectied hole position
                const connectedHole_x0 = (objOpts.hole.distance + objOpts.hole.width) * ((LCCore.projects[idxTo[0]].order * objOpts.project.interval)+ (connectionData.num_total - connectionData.num_total_disable)); //LCCore.projects[idxTo[0]].holes[idxTo[1]].order

                const connectedMarker_top = LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]][objOpts.canvas.depth_scale];

                if (connectedMarker_top == null) {
                  //console.log("Connected marker position is null.");
                  continue;
                }

                //get connector position
                const cn_x0 = (hole_x0 + shift_x + objOpts.marker.width) * xMag + pad_x;
                const cn_y0 = (marker_top + shift_y) * yMag + pad_y;
                const cn_x1 = cn_x0 + objOpts.connection.indexWidth;
                const cn_y1 = cn_y0;
                const cn_x3 = (connectedHole_x0 + shift_x) * xMag + pad_x;
                const cn_y3 = (connectedMarker_top + shift_y) * yMag + pad_y;
                const cn_x2 = cn_x3 - objOpts.connection.indexWidth;
                const cn_y2 = cn_y3;
                let connection_colour = objOpts.connection.line_colour;
                let connection_line_width = objOpts.connection.line_width;

                //get style
                if (cn_y0 !== cn_y3) {
                  //not horizontal
                  if (objOpts.connection.emphasize_non_horizontal && objOpts.canvas.depth_scale !== "drilling_depth"){
                    connection_colour = "Red";
                  }
                }

                if (connectionData.isNext == false) {
                  //connected core is not located at the next
                  if (objOpts.connection.show_remote_connections){
                    if(objOpts.connection.emphasize_remote_connections){
                      sketch.drawingContext.setLineDash([5, 5]);
                    }
                  }else{
                    continue
                  }
                }

                if ( marker.isMaster && 
                    LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]].isMaster &&
                    LCCore.projects[idxTo[0]].id[0] == marker.id[0]
                    ) {
                  //if connection of master section
                  connection_colour = "Blue";
                  connection_line_width = objOpts.connection.line_width * 1.3
                }

                //draw connection---------------------------------------------
                sketch.strokeWeight(connection_line_width);
                sketch.stroke(connection_colour);

                sketch.line(cn_x0, cn_y0, cn_x1, cn_y1); //start point
                sketch.line(cn_x1, cn_y1, cn_x2, cn_y2); //index left
                sketch.line(cn_x2, cn_y2, cn_x3, cn_y3); //index right
              } 
              
              //=====================================================================================================
            }
          }
        }
        num_disable.total += project.holes.length + objOpts.project.interval;
      }

      //==========================================================================================
      //draw age points
      if (LCplot == null || LCplot.age_collections.length == 0) {
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
      const ageSeries = LCplot.age_collections[age_plot_idx].datasets[0].data_series;

      //get position & plot

      for (let a = 0; a < ageSeries.length; a++) {
        num_disable = {hole: 0};
        let posX;
        let posY;
        if (ageSeries[a].original_depth_type == "trinity") {
          //plot next to core
          //get hole
          let hole = null;
          let isSkip = false;
          let num_hole = {enable:0,disable:0};
          outerloop:
          for (let po = 0; po < LCCore.projects.length; po++) {
            for (let ho = 0; ho < LCCore.projects[po].holes.length; ho++) {
              const hole_temp = LCCore.projects[po].holes[ho];
              if (hole_temp.name == ageSeries[a].trinity.hole_name){
                if(LCCore.projects[po].holes[ho].enable == true){
                  num_hole.enable += 1;
                  hole = hole_temp;
                }else{
                  num_hole.disable += 1;
                  isSkip = true;                  
                }
                break outerloop;
              } else {
                if(LCCore.projects[po].holes[ho].enable == true){
                  num_hole.enable += 1;
                }else{
                  num_hole.disable += 1;
                }
              }
            }
          }

          if (isSkip || hole == null) {
            //if disabel hole
            continue;
          }
         
          //calc position
          posX = ((objOpts.hole.distance + objOpts.hole.width) * (num_hole.enable -1 ) + shift_x) * xMag +  
              pad_x + objOpts.hole.width * xMag - objOpts.age.incon_size * 1.2;

          posY = (ageSeries[a][objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;

          //console.log(posX + "/" + posY);
          //------------------------------------------------
        } else {
          //plot 0
          const age_shift_x = -50;
          posX = age_shift_x + shift_x * xMag + pad_x - objOpts.age.incon_size * 1.2;
          posY = (ageSeries[a][objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;

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
    for (let p = 0; p < LCCore.projects.length; p++) {
      for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
        let hole_top =
          LCCore.projects[p].holes[h].sections[0].markers[0][
            objOpts.canvas.depth_scale
          ];
        let hole_bottom = LCCore.projects[p].holes[h].sections
          .slice(-1)[0]
          .markers.slice(-1)[0][objOpts.canvas.depth_scale];
        if (holes_top > hole_top) {
          holes_top = hole_top;
        }
        if (holes_bottom < hole_bottom) {
          holes_bottom = hole_bottom;
        }
      }
    }

    objOpts.canvas.shift_y = holes_top;

    //scale factor
    const dpir = objOpts.canvas.dpir; //window.devicePixelRatio || 1;

    const xMag = dpir * objOpts.canvas.zoom_level[0];
    let yMag = dpir * objOpts.canvas.zoom_level[1];
    const pad_x = objOpts.canvas.pad_x;
    let pad_y = objOpts.canvas.pad_y;
    if (objOpts.canvas.depth_scale == "age") {
      yMag = yMag * objOpts.canvas.age_zoom_correction[0];
      pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
    }
    //get shift amounts
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;

    //initiarise canvas base
    let num_total_holes = 0;
    LCCore.projects.forEach((project) => {
      if (project.enable) {
        project.holes.forEach((hole) => {
          if (hole.enable) {
            num_total_holes += 1;
          }
        });
      }
    });

    let canvasBaseWidth = parseInt(
      (objOpts.hole.distance + objOpts.hole.width + shift_x) *
        (num_total_holes + 1) *
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
    if (objOpts.canvas.is_grid) {
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
        age_mod = objOpts.canvas.age_zoom_correction[0];
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
        offScreenCtx.strokeStyle = objOpts.canvas.grid_colour; //"#ccc";
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
        offScreenCtx.strokeStyle = objOpts.canvas.grid_colour; //"#ccc";
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
    //draw area
    const view_rect = {
      x: scroller.scrollLeft,
      y: scroller.scrollTop,
      width: offScreenCanvas.width,
      height: offScreenCanvas.height,
    };

    //draw model
    let num_disable = {
      hole: 0,
      total: 0,
    };

    for (let p = 0; p < LCCore.projects.length; p++) {
      if (LCCore.projects[p].enable == false) {
        return;
      }
      const project = LCCore.projects[p];
      for (let h = 0; h < project.holes.length; h++) {
        //make hole objects===================================================================================
        //load hole data
        const hole = project.holes[h];

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
          (num_disable.total + hole.order - num_disable.hole);

        //check position
        if (hole_top !== null && hole_bottom !== null && hole_x0 !== null) {
          //if bottom core has depth, draw hole line
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
        }

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
            //console.log( h + " th hole, " +   s +  " th section has any problem in the position."  );
            continue;
          }

          //calc position
          const sec_x0 = (hole_x0 + shift_x) * xMag + pad_x;
          const sec_y0 = (section_top + shift_y) * yMag + pad_y;
          const sec_w = objOpts.section.width * xMag;
          const sec_h = (section_bottom - section_top) * yMag;
          const sec_rect = {
            x: sec_x0,
            y: sec_y0,
            width: sec_w,
            height: sec_h,
          };

          //draw section-----------------------------------------------------
          if (!isInside(view_rect, sec_rect, 500)) {
            continue;
          }
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

          //add section photo-------------------------------------------------
          if (objOpts.canvas.draw_core_photo) {
            try {
              if (coreImages[hole.name + "-" + section.name] != undefined) {
                const sec_im = new Image();
                if (objOpts.canvas.depth_scale == "drilling_depth") {
                  try {
                    sec_im.src = coreImages[hole.name + "-" + section.name];
                  } catch (error) {}
                } else if (objOpts.canvas.depth_scale == "composite_depth") {
                  try {
                    sec_im.src = CDImages[hole.name + "-" + section.name];
                  } catch (error) {}
                } else if (objOpts.canvas.depth_scale == "event_free_depth") {
                  try {
                    sec_im.src = EFDImages[hole.name + "-" + section.name];
                  } catch (error) {}
                }

                offScreenCtx.drawImage(sec_im, sec_x0, sec_y0, sec_w, sec_h);
              }
            } catch (err) {}
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
              //console.log( hole.name + "-" +  section.name +  "-" +  marker.distance +  "cm" +  " marker position has any problem."   );
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
                let ew = 0;
                let eh = eventThickness * yMag;
                if (objOpts.canvas.is_event) {
                  ew = objOpts.section.width * xMag - 6;
                } else {
                  ew = 8;
                }
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
            if (objOpts.marker.is_rank) {
              offScreenCtx.fillStyle = "black";
              offScreenCtx.font = "15px Arial";
              offScreenCtx.fillText(
                marker.connection_rank,
                (hole_x0 + shift_x) * xMag + pad_x - 23,
                (marker_top + shift_y) * yMag + pad_y + 5
              );

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
              } else if (marker.connection_rank > 4) {
                offScreenCtx.fillStyle = "brown";
              } else {
                offScreenCtx.fillStyle =
                  objOpts.marker.rank_colours[marker.connection_rank];
              }
              offScreenCtx.fill();
            }

            //add master section-----------------------------------------
            if (marker.isMaster) {
              if (section.markers[m + 1] !== undefined) {
                if (section.markers[m + 1].isMaster) {
                  offScreenCtx.setLineDash([]);
                  offScreenCtx.lineWidth = 4;
                  offScreenCtx.strokeStyle = "blue"; //markerLineColour;
                  const next_marker_top =
                    section.markers[m + 1][objOpts.canvas.depth_scale];

                  offScreenCtx.beginPath();
                  offScreenCtx.moveTo(
                    (hole_x0 + shift_x) * xMag + pad_x,
                    (marker_top + shift_y) * yMag + pad_y
                  ); //start point
                  offScreenCtx.lineTo(
                    (hole_x0 + shift_x) * xMag + pad_x,
                    (next_marker_top + shift_y) * yMag + pad_y
                  ); //end point
                  offScreenCtx.stroke();
                }
              }
            }

            //-----------------------------------------------------------

            //add marker name--------------------------------------------
            //add marker name without top/bottom name
            if (m !== 0 && m !== section.markers.length - 1) {
              offScreenCtx.fillStyle = objOpts.marker.font_colour;
              offScreenCtx.font =
                objOpts.marker.font_size.toString() +
                "px " +
                objOpts.marker.font;
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
              //(Math.round(marker.event_free_depth * 10) / 10).toFixed(1).toString(),
              (hole_x0 + shift_x) * xMag +
                pad_x +
                objOpts.marker.width * xMag +
                5,
              (marker_top + shift_y) * yMag + pad_y - 2
            );
            //make connection objects=================================================================================
            //add connection
            const connectionData = this.getNearestConnectedMarkerIdx(
              LCCore,
              marker.id,
              objOpts
            );

            //check connection
            if (connectionData == null) {
              //there is no connection
              continue;
            }

            //get connectied hole position
            //
            const idxTo = connectionData.connected_idx;

            /*
            console.log(connectionData);
            console.log(
              hole.name +
                "-" +
                section.name +
                "-" +
                marker.name +
                " --> " +
                LCCore.projects[idxTo[0]].holes[idxTo[1]].name +
                "-" +
                LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]]
                  .name +
                "-" +
                LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]]
                  .markers[idxTo[3]].name
            );
            */

            const connectedHole_x0 =
              (objOpts.hole.distance + objOpts.hole.width) *
              (1 * LCCore.projects[idxTo[0]].order +
                connectionData.num_total -
                connectionData.num_total_disable); //LCCore.projects[idxTo[0]].holes[idxTo[1]].order

            const connectedMarker_top =
              LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]]
                .markers[idxTo[3]][objOpts.canvas.depth_scale];

            if (connectedMarker_top == null) {
              //console.log("Connected marker position is null.");
              continue;
            }
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
            offScreenCtx.strokeStyle  = objOpts.connection.line_colour;
            if (cn_y0 !== cn_y3) {
              if (objOpts.canvas.depth_scale !== "drilling_depth") {
                //not horizontal
                connection_colour = "red";
              }
            }
            if (!connectionData.isNext) {
              //connected core is not located at the next
              offScreenCtx.setLineDash([3, 3]);
            }

            if (connectionData.is_master_connection > 1) {
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
      num_disable.total += project.holes.length + 1;
    }

    //==========================================================================================
    //draw age points
    if (LCplot == null || LCplot.age_collections.length == 0) {
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
        total: 0,
        hole: 0,
      };
      let posX;
      let posY;
      if (ageSeries[a].original_depth_type == "trinity") {
        //plot next to core
        //get hole
        let hole = null;
        let isSkip = false;

        breakMarker: 
        for (let p = 0; p < LCCore.projects.length; p++) {
          for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
            const hole_temp = LCCore.projects[p].holes[h];
            if (hole_temp.name == ageSeries[a].trinity.hole_name) {
              if (hole_temp.enable == false) {
                isSkip = true;
              }
              hole = hole_temp;
              break breakMarker;
            } else {
              if (hole_temp.enable == false) {
                num_disable.hole += 1;
              }
            }
          }
          num_disable.total += LCCore.projects[p].holes.length + 1;
        }

        if (isSkip || hole == null) {
          //if disabel hole
          continue;
        }

        //calc position
        posX =
          ((objOpts.hole.distance + objOpts.hole.width) *
            (num_disable.total + hole.order - num_disable.hole) +
            shift_x) *
            xMag +
          pad_x +
          objOpts.hole.width * xMag -
          objOpts.age.incon_size * 1.2;

        posY =
          (ageSeries[a][objOpts.canvas.depth_scale] + shift_y) * yMag +
          pad_y -
          objOpts.age.incon_size / 2;

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
        const ageicon = new Image();
        ageicon.src = agePlotIcons[ageSeries[a].source_type];
        offScreenCtx.drawImage(
          ageicon,
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

    let age_correction = [1, 0];
    if(objOpts.canvas.depth_scale == "age"){
      age_correction[0] = objOpts.canvas.age_zoom_correction[0];
      age_correction[1] = objOpts.canvas.age_zoom_correction[1];
    }

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
      sketch.strokeWeight(2);
      sketch.push(); // Save settings
      sketch.translate(-scroller.scrollLeft, -scroller.scrollTop);

      sketch.clear();
      if (clickCount == 1) {
        sketch.line(
          (startPoint[0] + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,
          (startPoint[1] + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir * age_correction[0] + objOpts.canvas.pad_y + age_correction[1],
          sketch.mouseX  + scroller.scrollLeft,
          sketch.mouseY  + scroller.scrollTop
        );
        sketch.pop(); // Restore settings
      } else if (clickCount == 0) {
        sketch.line(
          (startPoint[0] + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,
          (startPoint[1] + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir *  + age_correction[0] + objOpts.canvas.pad_y + age_correction[1],
          (endPoint[0] + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,
          (endPoint[1] + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir *  + age_correction[0] + objOpts.canvas.pad_y + age_correction[1]
        );
      }
    };

    // Window resize handler should be outside of draw()
    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };

    //let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
    //let y = (scroller.scrollTop + mouseY - pad_y) / yMag / age_mod - shift_y;
    
    sketch.mouseClicked = () => {
      if (clickCount == 2) {
        startPoint = [0, 0];
        clickCount -= 1;
        sketch.loop();
        //convert depth scale
        startPoint[0] = (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir - objOpts.canvas.shift_x;
        startPoint[1] = (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y - age_correction[1]) / (objOpts.canvas.zoom_level[1]  * objOpts.canvas.dpir * age_correction[0]) - objOpts.canvas.shift_y;
        //finish
        measureObject.measureData.start = startPoint;
        console.log("[Measure]: Strat from " + startPoint);
      } else if (clickCount == 1) {
        endPoint = [0, 0];
        clickCount -= 1;
        sketch.noLoop();
        //convert depth scale
        endPoint[0] = (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir - objOpts.canvas.shift_x;
        endPoint[1] = (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y - age_correction[1]) / (objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir * age_correction[0]) - objOpts.canvas.shift_y;
        //finish
        measureObject.measureData.end = endPoint;
        console.log("[Measure]: End to " + endPoint);
        measureResults();
      } else if (clickCount > 0) {
        clickCount -= 1;
      }
    };
  };
  //--------------------------------------------------------------------------------------------

  async function measureResults() {
    //calc
    let x0;
    let x1;
    let y0;
    let y1;
    let age_correction = 1;
    if(objOpts.canvas.depth_scale == "age"){
      age_correction = objOpts.canvas.age_zoom_correction[0];
    }


    if (measureObject.measureData.start[1] <= measureObject.measureData.end[1]) {
      x0 = measureObject.measureData.start[0];
      y0 = measureObject.measureData.start[1];
      x1 = measureObject.measureData.end[0];      
      y1 = measureObject.measureData.end[1];
    } else {
      x1 = measureObject.measureData.start[0];
      y1 = measureObject.measureData.start[1];
      x0 = measureObject.measureData.end[0];      
      y0 = measureObject.measureData.end[1];
    }

    //get click position
    const upperData = await window.LCapi.depthConvert(["measured_upper", y0, [null, null, null, null]], measureObject.measureData.type,"linear");
    const lowerData = await window.LCapi.depthConvert(["measured_lower", y1, [null, null, null, null]], measureObject.measureData.type,"linear");

    //calc stat
    const meanAge = (lowerData.age_mid + upperData.age_mid) / 2;
    const meanCD  = (lowerData.cd + upperData.cd) / 2;
    const meanEFD = (lowerData.efd + upperData.efd) / 2;

    const duration = lowerData.age_mid - upperData.age_mid;
    const thicknessCD = lowerData.cd - upperData.cd;
    const thicknessEFD = lowerData.efd - upperData.efd;

    const srCD = thicknessCD / duration;
    const srEFD = thicknessEFD / duration;

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
      " yrs\n\n3. Sedimentation rate\nComposite Depth: " +
      Math.round(srCD * 1000) / 1000 +
      " cm/yr\nEvent Free Depth: " +
      Math.round(srEFD * 1000) / 1000 +
      " cm/yr";
    alert(text);

    console.log("[Renderer]: Measured " +  measureObject.measureData.start[1] + "==>" + measureObject.measureData.end[1] + measureObject.measureData.type);

    document.getElementById("bt_measure").style.backgroundColor = "#f0f0f0";
    //penObject.isMeasure = false;
    measureObject.isMeasure = false;
    measureObject.measureCanvas = null;
    measureObject.measureData.type = null;
    measureObject.measureData.start = null;
    measureObject.measureData.end = null;

    const parentElement2 = document.getElementById("p5measureCanvas");
    while (parentElement2.firstChild) {
      parentElement2.removeChild(parentElement2.firstChild);
    }
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
      return null;
    }

    //mount model into LCCore
    const results = await window.LCapi.RegisterModelFromCsv(in_path);

    if (results == null) {
      console.log("[Renderer]: Failed to resister correlation model.")
      return null;
    }

    correlation_model_list.push(results); //{id,name,path}

    console.log("[Renderer]: Resistered Correlation Model: " + results.name +".");
    //console.log(results);
    return true;
  }

  async function loadModel() {
    //load model into LCCore
    //now, LC is able to hold one project file, model_id is dummy
    LCCore = await window.LCapi.LoadModelFromLCCore();

    if (LCCore) {
      //add hole list
      LCCore.projects.forEach((project, p) => {
        const container = document.getElementById("hole_list");
        const projItemDiv = document.createElement("div");
        const projListCheck = document.createElement("input");
        projListCheck.type = "checkbox";
        projListCheck.id = project.id;
        projListCheck.checked = true;
        const projListlabel = document.createElement("label");
        projListlabel.htmlFor = projListCheck.id;
        projListlabel.textContent = project.name;
        projItemDiv.style.paddingLeft = "0px";

        projItemDiv.appendChild(projListCheck);
        projItemDiv.appendChild(projListlabel);

        project.holes.forEach((hole) => {
          const checkboxDiv = document.createElement("div");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = hole.id.toString();
          checkbox.name = hole.name;
          checkbox.checked = true;
          const label = document.createElement("label");
          label.htmlFor = hole.id.toString();
          label.textContent = hole.name;
          checkboxDiv.style.paddingLeft = "20px";

          checkboxDiv.appendChild(checkbox);
          checkboxDiv.appendChild(label);

          projItemDiv.appendChild(checkboxDiv);
        });

        container.appendChild(projItemDiv);
      });

      //calc composite depth
      LCCore = await window.LCapi.CalcCompositeDepth();

      //calc event free depth
      LCCore = await window.LCapi.CalcEventFreeDepth();

      //sort
      sortHoleByOrder(LCCore);

      //update position
      let newPad_y = 100 - LCCore.projects[0].composite_depth_top * 10;
      objOpts.canvas.pad_y = newPad_y;

      //shwo model summary
      console.log("[Renderer]: Loaded Correlation Model(s).");
      LCCore.projects.forEach(p=>{
        console.log({ ID: p.id[0], Name: p.name ,Version:p.correlation_version, Type: p.model_type});
      })
      console.log(LCCore);

      //updateView();
    }
  }

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(console.log("Load image rejected."));
      img.src = path;
    });
  }

  async function registerAge(in_path) {
    if (in_path == null) {
      return;
    }

    //load age model
    const results = await window.LCapi.RegisterAgeFromCsv(in_path);
    //console.log(results);

    if (results) {
      //add list
      age_model_list.push(results); //{id,name,path}

      //add dropdown
      const newOption = document.createElement("option");
      newOption.value = results.id;
      newOption.textContent = results.name;
      document.getElementById("AgeModelSelect").appendChild(newOption);

      console.log("[Renderer]: Registered Age Model: "+results.name);
      //console.log(results);
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

      console.log("[Renderer]: Age model loaded.");
      console.log({ ID: age_id, Name: name });

      console.log(LCCore);

      updateView();
    } else {
      console.log("[Renderer]: Fail to read age model.");
    }
  }
  async function registerAgePlotFromLCAge() {
    if (correlation_model_list.length == 0) {
      return;
    }
    if (age_model_list.length == 0) {
      return;
    }
    //load age model
    await window.LCapi.RegisterAgePlotFromLCAge();
  }
  async function loadPlotData() {
    //LC plot age_collection id is as same as LCAge id
    const results = await window.LCapi.LoadPlotFromLCPlot();
    if (results) {
      LCplot = results;
      console.log("[Renderer]: Loaded Plot Age Data");
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
    //canvas initiarise
    const parentElement = document.getElementById("hole_list");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }
    
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
      document.getElementById("bt_pen").style.backgroundColor =  "#f0f0f0";
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
        //vectorObjects.clear();
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
function getNearestConnectedMarkerIdx(LCCore, idFrom, objOpts) {
  //temp function
  const getListIdx = (list, p, h) => {
    let output = null;
    list.forEach((hl) => {
      if (hl[3] == p && hl[4] == h) {
        output = hl[0];
      }
    });
    return output;
  };
  //list of holes
  let holeList = [];
  for (let p = 0; p < LCCore.projects.length; p++) {
    for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
      holeList.push([
        null, //0
        LCCore.projects[p].order, //1
        LCCore.projects[p].holes[h].order, //2
        p, //3
        h, //4
        LCCore.projects[p].enable, //5
        LCCore.projects[p].holes[h].enable, //6
      ]);
    }
  }

  //sort by oreder
  holeList.sort((a, b) => (a[2] < b[2] ? -1 : 1));
  holeList.sort((a, b) => (a[1] < b[1] ? -1 : 1));

  holeList.forEach((h, i) => {
    h[0] = i;
  });

  //get start marker data
  const idxFrom  = this.getIdxById(LCCore, idFrom);
  const listFrom = getListIdx(holeList, idxFrom[0], idxFrom[1]);
  const currentTotalOrder  = holeList[listFrom][0];
  const currentMarkerData  = LCCore.projects[idxFrom[0]].holes[idxFrom[1]].sections[idxFrom[2]].markers[idxFrom[3]];
  const currentHoleData    = LCCore.projects[idxFrom[0]].holes[idxFrom[1]];
  const currentProjectData = LCCore.projects[idxFrom[0]];

  //check first data
  let isMasterConnection = 0;
  if (currentMarkerData.h_connection == null || currentMarkerData.h_connection.length == 0) {
    //case there is no connection
    return null;
  } else {
    currentMarkerData.h_connection.forEach((c) => {
      const idx = this.getIdxById(LCCore, c);
      if (LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].isMaster) {
        isMasterConnection += 1;
      }
    });
  }

  //get first connection data
  let connectedMarkerData  = null;
  let connectedHoleData    = null;
  let connectedProjectData = null;

  //check and replace connection---------------------------------------------------------------------------

  //get first data beacause some case include only single connection
  let idTo   = currentMarkerData.h_connection[0];
  let idxTo  = this.getIdxById(LCCore, idTo);
  let listTo = getListIdx(holeList, idxTo[0], idxTo[1]);
  let connectedTotalOrder = holeList[listTo][0];

  //if next marker order is large and enable, get
  if (connectedTotalOrder > currentTotalOrder && LCCore.projects[idxTo[0]].holes[idxTo[1]].enable) {
    connectedMarkerData = LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
    connectedHoleData   = LCCore.projects[idxTo[0]].holes[idxTo[1]];
    connectedProjectData= LCCore.projects[idxTo[0]];
  } else {
    //case lost connected marker and remains only connection (unsuspected error)
  }

  //if find marker located in nearer hole, replace---------------------------------------------
  if (currentMarkerData.h_connection.length > 1) {
    for (let i = 1; i < currentMarkerData.h_connection.length; i++) {
      //get 2nd or later index
      idTo = currentMarkerData.h_connection[i];
      idxTo = this.getIdxById(LCCore, idTo);
      let listTo = getListIdx(holeList, idxTo[0], idxTo[1]);

      //new connection available
      if (connectedHoleData !== null) {
        if (holeList[listTo][0] > currentTotalOrder && holeList[listTo][0] < connectedTotalOrder && LCCore.projects[idxTo[0]].holes[idxTo[1]].enable ) {
          //if connected hole has large order, enable but the order smaller (nearer place in canvas) than stocked one.
          connectedMarkerData  = LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
          connectedHoleData    = LCCore.projects[idxTo[0]].holes[idxTo[1]];
          connectedProjectData = LCCore.projects[idxTo[0]];
          connectedTotalOrder  = holeList[listTo][0];
        }
      } else {
        //previously checked connection is died (unsuspected error)
        if (holeList[listTo][0] > currentTotalOrder && LCCore.projects[idxTo[0]].holes[idxTo[1]].enable) {
          connectedMarkerData  = LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
          connectedHoleData    = LCCore.projects[idxTo[0]].holes[idxTo[1]];
          connectedProjectData = LCCore.projects[idxTo[0]];
          connectedTotalOrder  = holeList[listTo][0];
        }
      }
    }
  }
    

  //count num disable holes between connection for plot x position------------------------------
  if (connectedHoleData == null) {
    return null;
  }

  //get index between current and connected
  let betweenRange = [];
  holeList.forEach((btl, b) => {
    if (btl[1] == currentProjectData.order) {
      if (btl[2] == currentHoleData.order) {
        betweenRange[0] = b;
      }
    }
    if (btl[1] == connectedProjectData.order) {
      if (btl[2] == connectedHoleData.order) {
        betweenRange[1] = b;
      }
    }
  });

  //count enable holes between current and connected holes
  const numBetween = betweenRange[1] - betweenRange[0];
  const numTotal = betweenRange[1] - 0;
  let numProject = 0;
  let numBetweenDisable = 0;
  let numTotalDisable = 0;
  for (let i = 0; i < betweenRange[1]; i++) {
    if (holeList[i][6] == false) {
      numTotalDisable += 1;
    }
  }

  let projList = new Set();
  for (let b = betweenRange[0]; b < betweenRange[1] + 1; b++) {
    if (!projList.has(holeList[b][1])) {
      projList.add(holeList[b][1]);
      numProject += 1;
    }
    if (!holeList[b][6]) {
      numBetweenDisable += 1;
    }
  }

;
  //console.log(    "total: " + numTotal + "|proj: " + numProject + "|diable: " + numDisable  );

  //check and output---------------------------------------------------------------------------
  if (connectedMarkerData == null) {
    //if all connected markers are died(unsuspected error)
    return null;
  } else {
    //check is ringht next for plot style
    let isNext = false;
    const idxTo = this.getIdxById(LCCore, connectedMarkerData.id);
    if ((betweenRange[1] - betweenRange[0] - numBetweenDisable) == 1) {
      isNext = true;
    }

    const output = {
      num_total: numTotal,
      num_projects: numProject,
      num_total_disable: numTotalDisable,
      num_between: numBetween,
      num_between_disable: numBetweenDisable,
      connected_id: connectedMarkerData.id,
      connected_idx: idxTo,
      isNext: isNext,
      is_master_connection: isMasterConnection,
    };

    return output;
  }
}
function getIdxById(LCCore, id) {
  let relative_idxs = [null, null, null, null];

  if (id[0] !== null || id[0] !== "") {
    for (let p = 0; p < LCCore.projects.length; p++) {
      const projectData = LCCore.projects[p];
      if (projectData.id[0] == id[0]) {
        relative_idxs[0] = p;
        if (id[1] !== null || id[1] !== "") {
          const num_holes = projectData.holes.length;
          for (let h = 0; h < num_holes; h++) {
            const holeData = projectData.holes[h];
            if (holeData.id[1] == id[1]) {
              relative_idxs[1] = h;

              if (id[2] !== null || id[2] !== "") {
                const num_sections = holeData.sections.length;
                for (let s = 0; s < num_sections; s++) {
                  const sectionData = holeData.sections[s];
                  if (sectionData.id[2] == id[2]) {
                    relative_idxs[2] = s;

                    if (id[3] !== null || id[3] !== "") {
                      const num_markers = sectionData.markers.length;
                      for (let m = 0; m < num_markers; m++) {
                        const markerData = sectionData.markers[m];
                        if (markerData.id[3] == id[3]) {
                          relative_idxs[3] = m;
                        }
                      }
                    }
                  }
                }
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
async function getFooterInfo(LCCore, y, objOpts) {
  let txt = "...";
  let age = "";

  if (!LCCore) {
    return txt;
  }

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
        lowerDepth = LCCore.projects[conIdx[0]].holes[conIdx[1]].sections[conIdx[2]].markers[conIdx[3]][objOpts.canvas.depth_scale];
        eventThickness = marker_top - lowerDepth;
      } else {
        console.group(
          "Null detected on the Event connection at the idx of [" + event + "]."
        );
      }
    } else if (event[0] == "erosion") {
      if (
        objOpts.canvas.depth_scale == "event_free_depth" ||
        //objOpts.canvas.depth_scale == "composite_depth" ||
        objOpts.canvas.depth_scale == "age"
      ) {
        const conIdx = this.getIdxById(LCCore, event[2]); //event layer connected MarkerId
        lowerDepth = LCCore.projects[conIdx[0]].holes[conIdx[1]].sections[conIdx[2]].markers[conIdx[3]][objOpts.canvas.depth_scale];
        eventThickness = marker_top - lowerDepth;
        //lowerDepth = marker_top + event[4];
        //eventThickness = -event[4];
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

  for (let p = 0; p < LCCore.projects.length; p++) {
    for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
      let hole_top =
        LCCore.projects[p].holes[h].sections[0].markers[0][
          objOpts.canvas.depth_scale
        ];
      let hole_bottom = LCCore.projects[p].holes[h].sections
        .slice(-1)[0]
        .markers.slice(-1)[0][objOpts.canvas.depth_scale];
      if (holes_top > hole_top) {
        holes_top = hole_top;
      }
      if (holes_bottom < hole_bottom) {
        holes_bottom = hole_bottom;
      }
    }
  }

  objOpts.canvas.shift_y = holes_top;

  //scale factor
  const dpir = objOpts.canvas.dpir; //window.devicePixelRatio || 1;

  const xMag = dpir * objOpts.canvas.zoom_level[0];
  let yMag = dpir * objOpts.canvas.zoom_level[1];
  const pad_x = objOpts.canvas.pad_x;
  let pad_y = objOpts.canvas.pad_y;
  if (objOpts.canvas.depth_scale == "age") {
    yMag = yMag * objOpts.canvas.age_zoom_correction[0];
    pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
  }
  //get shift amounts
  const shift_x = objOpts.canvas.shift_x;
  const shift_y = objOpts.canvas.shift_y;

  //initiarise off screan canvas
  let num_total_holes = 0;
  LCCore.projects.forEach((project) => {
    if (project.enable) {
      project.holes.forEach((hole) => {
        if (hole.enable) {
          num_total_holes += 1;
        }
      });
    }
  });

  let canvasBaseWidth = parseInt(
    (objOpts.hole.distance + objOpts.hole.width + shift_x) *
      (num_total_holes + 1) *
      xMag +
      pad_x
  );
  let canvasBaseHeight = parseInt(
    (holes_bottom - holes_top + shift_y + objOpts.canvas.bottom_pad) * yMag +
      pad_y
  );
  return [canvasBaseWidth, canvasBaseHeight];
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
      const imageBase64 = await window.LCapi.LoadRasterImage(path, 0);
      ageVectorPlotIcons[key] = await p.loadImage(
        "data:image/png;base64," + imageBase64,
        async () => {
          //console.log("");
        },
        async () => {
          console.log("Fail to load image of " + key);
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

function sortHoleByOrder(LCCore) {
  LCCore.projects.sort((a, b) => {
    a.order < b.order ? -1 : 1;
  });

  LCCore.projects.forEach((project) => {
    project.holes.sort((a, b) => {
      a.order < b.order ? -1 : 1;
    });
  });
}
//--------------------------------------------------------------------------------------------------
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
//--------------------------------------------------------------------------------------------------
async function createVectorCircleImage(p, canvasSize, radius, color) {
  let fallbackImg = p.createGraphics(canvasSize, canvasSize);
  fallbackImg.clear();
  fallbackImg.fill(color);
  fallbackImg.ellipse(canvasSize / 2, canvasSize / 2, radius * 2, radius * 2);
  return fallbackImg;
}
//--------------------------------------------------------------------------------------------------
async function LoadRasterIcons(agePlotIcons, objOpts) {
  for (let key in objOpts.age.incon_list) {
    const path = objOpts.age.incon_list[key][0];
    const colour = objOpts.age.incon_list[key][1];

    let img = new Image();
    try {
      const imageBase64 = await window.LCapi.LoadRasterImage(path, 0);
      agePlotIcons[key] = "data:image/png;base64," + imageBase64;
    } catch (error) {
      console.log(error);
      agePlotIcons[key] = await createRasterCircleImage(
        objOpts.age.incon_size,
        objOpts.age.alt_radius,
        colour
      );
    }
  }

  let img = new Image();
  img.src = await createRasterCircleImage(
    objOpts.age.incon_size,
    objOpts.age.alt_radius,
    "black"
  );

  agePlotIcons["none"] = img;
  return agePlotIcons;
}

function isInside(rectA, rectB, pad) {
  if (
    rectA.x + rectA.width + pad < rectB.x ||
    rectB.x + rectB.width < rectA.x - pad
  ) {
    return false;
  }
  if (
    rectA.y + rectA.height + pad < rectB.y ||
    rectB.y + rectB.height < rectA.y - pad
  ) {
    return false;
  }
  return true;
}

async function loadCoreImages(modelImages, LCCore, depthScale) {
  return new Promise(async (resolve, reject) => {
  //const prom = new Promise((resolve, reject) => {
    let results = {};

    //check
    if (modelImages.image_dir.length == 0) {
      console.log("[Renderer]: There is no image path.");
      resolve(results);
    }
    if (LCCore == null) {
      console.log("[Renderer]: There is no LCCore.");
      resolve(results);
    }

    
    if (depthScale == "composite_depth" || depthScale == "event_free_depth" || depthScale == "age") {
      if (Object.keys(modelImages.drilling_depth).length == 0) {
        console.log("[Renderer]: There is no original image.");
        resolve(results);
      }
    }

    //main get num images
    let N = 0;
    if(modelImages.load_target_ids.length == 0){
      //case all
      LCCore.projects.forEach((p) => {
        p.holes.forEach((h) => {
          h.sections.forEach((s) => {
            N += 1;
            modelImages.load_target_ids.push(s.id);
          });
        });
      });
    } else {
      N = modelImages.load_target_ids.length;
    }
    

    //main Progress
    let txt = "Converting section images to " + depthScale + " scale...";
    if (depthScale == "drilling_depth") {
      txt = "Loading original section images...";
    }
    window.LCapi.progressbar("Load images", txt);
    let n = 0;
  
    let suc = 0;
    await new Promise((p5resolve)=>{
      new p5(async (p) => {
        

        for(let t=0; t<N;t++){
          const targeIdx = getIdxById(LCCore, modelImages.load_target_ids[t]);
          const project = LCCore.projects[targeIdx[0]];
          const hole    = project.holes[targeIdx[1]];
          const section = hole.sections[targeIdx[2]];

          const im_name = hole.name + "-" + section.name;
          if (depthScale == "drilling_depth") {
            //case original image
            const dpcm = 30; //pix/cm}
            const im_height = Math.round(dpcm * (section.markers[section.markers.length - 1].distance - section.markers[0].distance), 0);
            //load image
            try {
              const imageBase64 = await window.LCapi.LoadRasterImage(modelImages.image_dir +"/" +project.name +"/" +im_name +".jpg", im_height);

              if (imageBase64 !== undefined) {
                results[im_name] = await p.loadImage("data:image/png;base64," + imageBase64,
                  async () => {
                    //console.log("");
                    suc++;
                  },
                  async () => {
                    console.log("Fail to load image of " + im_name);
                  }
                );
              } else {
                results[im_name] = undefined;
              }
            } catch (error) {
              //console.log(error);
              results[im_name] = undefined;
            }
          } else if ( depthScale == "composite_depth" ||  depthScale == "event_free_depth"  ) {
            //case CD, EF, convert original to CD EFD image
            const dpcm = 30; //pix/cm}
            const im_height = Math.round(
              dpcm * (section.markers[section.markers.length - 1].distance - section.markers[0].distance),
              0
            );

            //load image
            try {
              const imageBase64 = await window.LCapi.makeModelImage(
                modelImages.image_dir +"/" +project.name +"/" +im_name +".jpg", 
                section,
                im_height,
                depthScale
              );//[imPath, sectionData, imHeight, depthScale]

              if (imageBase64 !== undefined) {
                results[im_name] = await p.loadImage(
                  "data:image/png;base64," + imageBase64,
                  async () => {
                    //console.log("");
                    suc++;
                  },
                  async () => {
                    console.log("Fail to load image of " + im_name);
                  }
                );
              } else {
                results[im_name] = undefined;
              }
            } catch (error) {
              //console.log(error);
              results[im_name] = undefined;
            }
          }
          n += 1;
          window.LCapi.updateProgressbar(n, N);
        }
        p5resolve();
      });
    })
    
    //console.log(modelImages.load_target_ids.length);

    console.log("[Renderer]: Load " + suc +" images / "+N+ " sections in " + depthScale + " scale.");
    resolve(results);
  });


}

async function loadResourcePath(objOpts){
  let path = null;
  try {
   // path = await window.LCapi.getResourcePath();
    objOpts.age.incon_list = path;
    console.log(path);
    return path;
  } catch {
    console.log("Failed to load resource path", error);

  }
}
function loadToolIcons(objOpts) {
  for (let key in objOpts.interface.icon_list) {
    let path = null;
    try {
      path =  objOpts.interface.icon_list[key];
      document.getElementById(key).querySelector("img").src = path;
    }catch{}
    
       /*
    let img = new Image();
    try {
      const imageBase64 = await window.LCapi.LoadRasterImage(path, 0);
      agePlotIcons[key] = "data:image/png;base64," + imageBase64;
    } catch (error) {
      console.log(error);
      continue;
    }
      */

  }
}
function getClickedItemIdx(mouseX, mouseY, LCCore, objOpts){
 
  const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
  let yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
  const pad_x = objOpts.canvas.pad_x;
  let pad_y = objOpts.canvas.pad_y;
  if (objOpts.canvas.depth_scale == "age") {
    yMag = yMag * objOpts.canvas.age_zoom_correction[0];
    pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
  }
  const shift_x = objOpts.canvas.shift_x;
  const shift_y = objOpts.canvas.shift_y;

  //mouse position
  let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
  let y = (scroller.scrollTop + mouseY - pad_y) / yMag - shift_y;

  //calc which hole
  let num_hole = {
    total: 0,
    disable: 0,
  };

  let results = {x:x, y:y, depth_scale:objOpts.canvas.depth_scale, project:null, hole:null, section:null, distance:null, nearest_marker: null, nearest_distance:null};

  breakpoint:
  for(let p=0; p<LCCore.projects.length; p++){
    for(let h=0; h<LCCore.projects[p].holes.length; h++){     
      if(!LCCore.projects[p].holes[h].enable){
        num_hole.disable += 1;
      }
      const hole_x0 = (objOpts.hole.distance + objOpts.hole.width) * (num_hole.total + LCCore.projects[p].holes[h].order - num_hole.disable);
      const hole_x1 = hole_x0 + objOpts.hole.width;
      if(x >= hole_x0 && x <= hole_x1){
        results.project = LCCore.projects[p].holes[h].id[0];
        results.hole = LCCore.projects[p].holes[h].id[1];
        for(let s=0; s<LCCore.projects[p].holes[h].sections.length; s++){
          const sec_y0 = LCCore.projects[p].holes[h].sections[s].markers[0][objOpts.canvas.depth_scale];//cd/efd
          const sec_y1 = LCCore.projects[p].holes[h].sections[s].markers.slice(-1)[0][objOpts.canvas.depth_scale];//cd/efd
          //const sec_y0 = (section_top + shift_y) * yMag + pad_y;
          //const sec_y1 = sec_y0 + ((section_bottom - section_top) * yMag);

          if(y >= sec_y0 && y <= sec_y1){
            results.section = LCCore.projects[p].holes[h].sections[s].id[2];

            let upperIdx = null;
            let lowerIdx = null;
            let lowerDistance = Infinity;
            let upperDistance = -Infinity;

            for(let m=0; m<LCCore.projects[p].holes[h].sections[s].markers.length; m++){
              const marker_y0 = LCCore.projects[p].holes[h].sections[s].markers[m][objOpts.canvas.depth_scale];
              if(marker_y0 - y > 0 && Math.abs(lowerDistance) >= Math.abs(marker_y0 - y)){
                lowerDistance = marker_y0 - y;
                lowerIdx = m;
              }

              if(marker_y0 - y <= 0 && Math.abs(upperDistance) >= Math.abs(marker_y0 - y)){
                upperDistance = marker_y0 - y;
                upperIdx = m;
              }
            } 
    
            //Distance calculation is not recommended because the interpolation is in charge of LCCroe module.
            /*
            let D1 = LCCore.projects[p].holes[h].sections[s].markers[upperIdx].distance; //distance
            let D3 = LCCore.projects[p].holes[h].sections[s].markers[lowerIdx].distance; //distance
            let d1 = LCCore.projects[p].holes[h].sections[s].markers[upperIdx][objOpts.canvas.depth_scale]; //cd/efd
            let d2 = y; //cd/efd
            let d3 = LCCore.projects[p].holes[h].sections[s].markers[lowerIdx][objOpts.canvas.depth_scale]; //cd/efd

            let d2d1 = Math.abs(d2 - d1);
            let d3d1 = Math.abs(d3 - d1);
            let D2 = null;
            if (d3d1 == 0) {
              D2 = D1;
            } else {
              D2 = D1 + (d2d1 / d3d1) * (D3 - D1);
            }
            results.distance = D2; //(((y - sec_y0) - pad_y) / yMag) - shift_y;
            */

            let nearestIdx = null;
            let markerDistance = null;
            if(Math.abs(lowerDistance) >= Math.abs(upperDistance)){
              nearestIdx = upperIdx;
              markerDistance = upperDistance;
            }else{
              nearestIdx = lowerIdx;
              markerDistance = lowerDistance;
            }

            results.nearest_distance = markerDistance;
            results.nearest_marker = LCCore.projects[p].holes[h].sections[s].markers[nearestIdx].id[3];   
            break breakpoint;
          }     
        }  
      }
    }  
    num_hole.total += LCCore.projects[p].holes.length + objOpts.project.interval;
  }
  
  return results;
}
//============================================================================================
