document.addEventListener("DOMContentLoaded", () => {

  //============================================================================================xxxxxxxxxx
  //base properties
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  let mousePos = [0, 0]; //mouse absolute position
  let canvasPos = [0, 0]; //canvas scroller position

  //model
  let LCCore = null;
  let LCPlotAge  = null;
  let LCPlotData = null;

  //model source path
  let age_model_list = []; //for reload
  let lcE2ELastPlotPayload = null;

  //p5(vector) canvas
  let vectorObjects = null; //p5 instance data
  document.getElementById("p5Canvas").style.display = "block"; //disable

  //raster canvas
  let canvas = document.getElementById("rasterCanvas");
  let ctx = canvas.getContext("2d");
  document.getElementById("rasterCanvas").style.display = "none"; //enable

  //pen canvas
  let penObject = { isPen: false, penCanvas: null, penData: null };

  //measure canvas
  let measureObject = {
    isMeasure: false,
    measureCanvas: null,
  };

  //view control
  let finderEnable = false;
  let dividerEnable = false;
  let isSVG = false;
  let isLoadedLCModel = false;
  let backup_hole_enable = {};
  let isProcessing = false;
  let isHoleMenuDragging = false;
  //============================================================================================

  //--------------------------------------------------------------------------------------------
  //plot properties
  let objOpts = setupSettings();
  function setupSettings(){
    let objOpts = {
      canvas: {},
      project:{},
      hole: {},
      section: {},
      marker: {},

      event: {},
      connection: {},
      age: {},
      
      plot:{},
      pen: {},
      image:{},      
      information:{},
      developer: {},
      
      edit:{},
      plotter: {},
      interface:{},
    };

    //=========== public properties =========== 
    objOpts.information.version = "2.3";
    objOpts.developer.mode = "user";//"user";"developer";"root"; 
    objOpts.canvas.use_touchpad_mode = true;
    objOpts.canvas.depth_scale = "composite_depth";
    objOpts.canvas.background_colour = "#ffffff";//"#f4f5f7";//"#f7f7f7"//"#f8fbff";//"#fffdfa";//""white    
    objOpts.canvas.display_height = 20.2;
    objOpts.canvas.is_model_visible = true;
    objOpts.canvas.is_event_expanded = true;
    objOpts.canvas.is_connection_visible = true;
    objOpts.canvas.is_target_visible = false;//mouse target
    objOpts.canvas.is_core_photo_visible = false;
    objOpts.canvas.is_grid_visible = false;
    objOpts.canvas.grid_width = 0.5;
    objOpts.canvas.grid_colour = "#565656";
    objOpts.canvas.finder_colour = "#ff0000";
    objOpts.canvas.zoom_level = [4, 3]; //[x, y](300pix/1m)
    objOpts.canvas.age_zoom_correction = [1/10, 100];//[zoom level, pad level]
    objOpts.canvas.dpir = 1; //window.devicePixelRatio || 1;
    objOpts.canvas.pad_x = 210; //[px]
    objOpts.canvas.pad_y = 110; //[px]
    objOpts.canvas.shift_x = 10; //[cm]
    objOpts.canvas.shift_y = 100; //[cm]
    objOpts.canvas.bottom_pad = 100; //[cm]
    objOpts.canvas.buffer_depth = 0.2; //[rate]
    objOpts.canvas.buffer_width = 0.3; //[rate]
    
    objOpts.project.interval = 1;
    objOpts.project.is_area_visible = true;
    objOpts.project.area_colour = "#EBEBEB";
    objOpts.project.area_colour_disconnected = "#f96a6a";
    objOpts.project.pad_x = 80;
    objOpts.project.pad_y = 200;
    objOpts.project.font = "Arial";
    objOpts.project.font_size = 25;
    objOpts.project.font_colour = "#000000";
  
    objOpts.hole.distance = 20;
    objOpts.hole.width = 20;
    objOpts.hole.line_colour = "#90EE90";
    objOpts.hole.line_width = 2;
    objOpts.hole.font = "Arial";
    objOpts.hole.font_size = 20;
    objOpts.hole.font_colour = "#000000";
  
    objOpts.section.line_colour = "#808080";
    objOpts.section.face_colour = "#D3D3D3";
    objOpts.section.line_width = 2;
    objOpts.section.width = 20;
    objOpts.section.font = "Arial";
    objOpts.section.font_size = 20;
    objOpts.section.font_angle =  -90;
    objOpts.section.font_pos_x = -10;
    objOpts.section.font_colour = "#000000";

    objOpts.marker.is_name_labels_visible = true;
    objOpts.marker.is_position_labels_visible = true;
    objOpts.marker.is_reverse_highlighted = true;
    objOpts.marker.is_rank_visible = false;
    objOpts.marker.line_colour = "#808080";
    objOpts.marker.line_width = 1;
    objOpts.marker.width = 20;    
    objOpts.marker.rank_colours = [
      "#008000", // green
      "#66CC66", // medium green
      "#99FF99", // light green
      "#FFD580", // light orange-yellow
      "#FFA500", // orange
      "#FF0000"  // red
    ];
    objOpts.marker.ignore_zoom_level = 0.4;
    objOpts.marker.font = "Arial";
    objOpts.marker.font_size = 12;
    objOpts.marker.font_colour = "#414141";
    
    objOpts.event.line_colour = "#ff0000";
    objOpts.event.face_colour = {
      general: "#FFD700",    // gold
      erosion: "#008080",    // teal
      tephra: "#DC143C",     // crimson
      void: "#800080",       // purple
      disturbed: "#708090",  // slate gray
      earthquake: "#008000"  // green
    };
    objOpts.event.line_width = 1;
    objOpts.event.folded_width  = 0.1;//rate
    objOpts.event.face_height = 0.98;//rate
  
    objOpts.connection.is_master_connections_highlighted = true;
    objOpts.connection.master_section_line_width = 4;
    objOpts.connection.base_master_section_colour = "#0000FF"
    objOpts.connection.duo_master_section_colour = "#73A7D1";
    objOpts.connection.line_colour = "#000000";
    objOpts.connection.line_width = 1.5;
    objOpts.connection.tab_length = objOpts.hole.distance * 0.7; //20;
    objOpts.connection.is_non_horizontal_connections_highlighted = false;
    objOpts.connection.is_remote_connections_visible = true;
    objOpts.connection.is_remote_connections_highlighted = true;
    objOpts.connection.is_source_visible = false;
  
    objOpts.plotter.selected_options = [];// store plot options from plotter
    
    objOpts.plot.is_plot_visible = false;
    objOpts.plot.is_axis_visible = true;
    objOpts.plot.resample_method = "block";//"block", "moving"
    objOpts.plot.barplot_width = 1;
    objOpts.plot.scatterplot_size = 3;
    objOpts.plot.lineplot_stroke = 1;
    objOpts.plot.lineplot_split_sections = true;
    objOpts.plot.lineplot_ignore_invalid = true;
    objOpts.plot.invalid_values = ["-9999","na", "n/a", "null", "none", "nan","missing"];
    
    objOpts.pen.colour = "#ff0000";

    objOpts.image.is_core_photo_visible = false;
    objOpts.image.photo_plot_colour = "#ff0000";
    objOpts.image.dpcm = 24;
    objOpts.image.dpcm_highresolution = 200;
    objOpts.image.is_load_enabled = {composite_depth: true, event_free_depth: true, age: true};

    objOpts.age.is_age_visible = true;
    objOpts.age.age_precision = 0;
    objOpts.age.incon_size = 20;
    objOpts.age.alt_radius = 3;     
    objOpts.age.is_age_label_visible = false;
    objOpts.age.font_colour = "#000000";
    objOpts.age.font = "Arial";
    objOpts.age.font_size = 15;
    objOpts.age.incon_list = {
      terrestrial: ["", "#008000"],
      terrestrial_unreliable: ["", "#008000"],
      terrestrial_disable: ["", "#808080"],
      marine: ["", "#0000FF"],
      marine_unreliable: ["", "#0000FF"],
      marine_disable: ["", "#808080"],
      tephra: ["", "#ff0000"],
      tephra_unreliable: ["", "#ff0000"],
      tephra_disable: ["", "#808080"],
      orbital: ["", "#FFA500"],
      orbital_unreliable: ["", "#FFA500"],
      orbital_disable: ["", "#808080"],
      general: ["", "#000000"],
      general_unreliable: ["", "#000000"],
      general_disable: ["", "#808080"],
      historical: ["", "#A52A2A"],
      historical_unreliable: ["", "#A52A2A"],
      historical_disable: ["", "#808080"],
      interpolation: ["", "transparent"],
      interpolation_unreliable: ["", "transparent"],
      interpolation_disable: ["", "transparent"],
    };

    //=========== private properties =========== 
    objOpts.edit.editable = false;
    objOpts.edit.contextmenu_enable = false;
    objOpts.edit.hittest = null;
    objOpts.edit.mode = null;
    objOpts.edit.sensibility = 2;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.section_from = null;
    objOpts.edit.section_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    objOpts.edit.passwards = "admin";    
    objOpts.edit.is_full_snapshot = false;
    
    let resourceIcons = window.LCapi.GetResources();
    objOpts.interface.icon_list = resourceIcons.tool;
    for(const key in objOpts.age.incon_list){
      objOpts.age.incon_list[key][0] = resourceIcons.plot[key];
    }
    objOpts.interface.finder_data = null;

    return objOpts;
  }
  //============================================================================================
  //resources
  //get plot image data
  let agePlotIcons = {};
  let modelImages = initialiseImages();

  loadPlotIcons(agePlotIcons, objOpts);
  loadToolIcons(objOpts);

  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //hide test event
  document.getElementById("footerRightText").addEventListener("click", async () => {
    if(["root"].includes(objOpts.developer.mode)){
      //const results = await window.LCapi.getDisplayInfo();
      //const dpi = results.height / objOpts.canvas.display_height; // hight is already divided by scale factor
      //console.log(results.height , objOpts.canvas.display_height , results.scaleFactor,dpi)
      
      document.getElementById("footerLeftText").textContent = "aaaaaaaaaaaaa";  
    }
  });
  //============================================================================================
  document.getElementById("scroller").addEventListener("dragover", (e) => {
    e.preventDefault(e);
  });
  
  document.getElementById("scroller").addEventListener("drop", async (e) => {
    e.preventDefault(e);
    try{
      //get list
      let dataList = [];
      for(const file of e.dataTransfer.files){
        dataList.push({type:file.name.split(".").pop(), name:file.name, path:file});
      }

      //check
      let order = [];

      //check LCMODEL first
      let numModel = 0;
      dataList.forEach((data,i)=>{
        if(data.type == "lcmodel"){
          order.push(i);
          numModel++;
        }
      })

      //check correlation model
      dataList.forEach((data,i)=>{
        if(data.name.includes("[correlation]")){
          order.push(i);
          numModel++;
        }
      })

      /*
      if(order.length>1){
        alert("Multiple [correlation] model detected. Please load base [correlation] model first.");
        return;
      }
      */

      dataList.forEach((data,i)=>{
        if(data.name.includes("[duo]")){
          order.push(i);
          numModel++;
        }
      })

      if(!LCCore && order.length == 0){
        alert("No correlation/duo model is loaded. Please load a correlation model first.");
        return;
      }

      //check age model
      let isAgeLoaded = false;
      dataList.forEach((data,i)=>{
        if(data.name.includes("[age]")){
          isAgeLoaded = true;
          order.push(i);
        }
      })

      //check corephoto
      let isPhotoLoaded = false;
      dataList.forEach((data,i)=>{
        if(!["csv","lcmodel","lcsection"].includes(data.type)){
          order.push(i);
          isPhotoLoaded = true;
        }
      })

      //check lc section
      if(objOpts.edit.editable == true){
        dataList.forEach((data,i)=>{
          if(data.type == "lcsection"){
            order.push(i);
          }
        })
      }else{
        dataList.forEach((data,i)=>{
          if(data.type == "lcsection"){
            alert("The section model can only be loaded in Edit mode.")
            return;
          }
        })
      }

      //check jpg
      let numIm = 0;
      dataList.forEach((data,i)=>{
        if(data.type == "jpg"){
          //order.push(i);
          numIm ++;
        }
      })

      if(numIm>0){
        alert("To load images, drop the folder containing them. Image names must follow the format 'holeName-sectionName'.")
        return
      }

      //get
      let N = order.length;
      if(isPhotoLoaded==true){
        N-=1;
      }


      if(N>0){
        await window.LCapi.progressbar({ title: "Load models", text: "Now chacking...", indeterminate: true });
      }

      for(let i=0;i<order.length;i++){
        const droppedData = dataList[order[i]];//type,name,path
        if(droppedData.type == "lcmodel"){
          numModel--;
          console.log("[Renderer]: LCmodel load from drop..");
          await importLcModelSource(droppedData.path, {
            resetCanvas: true,
            syncRendererState: numModel === 0,
          });
          
        }else if(droppedData.type == "csv"){
          if(droppedData.name.includes("[correlation]") || droppedData.name.includes("[duo]") ){
            numModel--;
            //case model file
            console.log("[Renderer]: Correlation model file load from drop.");
            console.log(droppedData.path)
            await importCorrelationModelSource(droppedData.path, {
              syncRendererState: numModel === 0,
            });
          } else if(droppedData.name.includes("[age]")){

            //case age file
            console.log("[Renderer]: Age model file load from drop.");
            await importAgeModelSource(droppedData.path, {
              syncRendererState: true,
            });
          }
        }else if(droppedData.type == "lcsection"){
          const result = await window.LCapi.addSectionFromLcsection(droppedData.path);
          //"duplicate_section","duplicate_hole","fail_to_add","no_path","no_hole"
          if(result==true){
            await loadModel(true, true);
            console.log(LCCore)
          }else{
            console.log("[Renderer]: Failed to load section data"+result);
            alert("Failed to load LC section: "+result);
            await window.LCapi.clearProgressbar()
            return
          }
        }else{        
          //case core image
          const response = await window.LCapi.askdialog(
            {
              opts: {
                title: "Load core images",
                message: "Do you want to load the core images?",
                parent: "main"
              }
            }
          );

          if (response.response) {
            await window.LCapi.clearProgressbar()
            console.log("[Renderer]: Directory load from drop..");
            const imported = await importCoreImagesSource(droppedData.path, {
              depthScales: ["drilling_depth","composite_depth","event_free_depth","age"],
              togglePhoto: true,
            });
            if (!imported.ok) {
              await window.LCapi.clearProgressbar()
              return
            }
          }

        }      
      }

      //update photo
      if(isPhotoLoaded == false && isAgeLoaded == true){
        if(Object.keys(modelImages.drilling_depth).length>0){
          await window.LCapi.clearProgressbar(); // clear previous progress bar
          modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth", "age"]);
        }
      }

      //update
      await window.LCapi.clearProgressbar()
      updateView();
    }catch(err){
      console.error(err)
      await window.LCapi.clearProgressbar()
      updateView();
    }
    
  });
  //============================================================================================
  //open divider
  document.getElementById("bt_divider").addEventListener("click", async () => {
    if (LCCore) {
      if (!dividerEnable) {
        dividerEnable = true;
        document.getElementById("bt_divider").style.backgroundColor = "#ccc";
        await LCapi.OpenDivider();
      } else {
        dividerEnable = false;
        document.getElementById("bt_divider").style.backgroundColor = "#f0f0f0";
        await LCapi.CloseDivider();
      }
    }
  });

  window.LCapi.receive("DividerClosed", async () => {
    //call from main process
    dividerEnable = false;
    document.getElementById("bt_divider").style.backgroundColor = "#f0f0f0";
    recordLcE2EEvent("DividerClosed");
  });
  //============================================================================================
  //target
  document.getElementById("bt_target").addEventListener("click", async (event) => {
      var target_line = document.getElementById("horizontal_target");
      if (objOpts.canvas.is_target_visible) {
        objOpts.canvas.is_target_visible = false;
        document.getElementById("bt_target").style.backgroundColor = "#f0f0f0";
        target_line.style.display = "none";
      } else {
        objOpts.canvas.is_target_visible = true;
        document.getElementById("bt_target").style.backgroundColor = "#ccc";
        target_line.style.display = "block";
      }
      updateView();
    });
    //============================================================================================
  //show model
  document.getElementById("bt_core_model").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.canvas.is_model_visible) {
        objOpts.canvas.is_model_visible = false;
        document.getElementById("bt_core_model").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.canvas.is_model_visible = true;
        document.getElementById("bt_core_model").style.backgroundColor = "#ccc";
      }
      updateView();
    }      
    });
    //============================================================================================
  //connection
  document.getElementById("bt_connection").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.canvas.is_connection_visible) {
        objOpts.canvas.is_connection_visible = false;
        document.getElementById("bt_connection").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.canvas.is_connection_visible = true;
        document.getElementById("bt_connection").style.backgroundColor = "#ccc";
      }
      updateView();
    }    
  });
  //============================================================================================
  //show event layers
  document.getElementById("bt_event_layer").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.canvas.is_event_expanded) {
        objOpts.canvas.is_event_expanded = false;
        document.getElementById("bt_event_layer").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.canvas.is_event_expanded = true;
        document.getElementById("bt_event_layer").style.backgroundColor = "#ccc";
      }
      updateView();
    }      
    });
  //============================================================================================
  //show core images
  document.getElementById("bt_core_photo").addEventListener("click", async (event) => {
    if (Object.keys(modelImages[objOpts.canvas.depth_scale]).length === 0) {
      return
    }
    if (objOpts.canvas.is_core_photo_visible) {
      objOpts.canvas.is_core_photo_visible = false;
      document.getElementById("bt_core_photo").style.backgroundColor = "#f0f0f0";
    } else {
      objOpts.canvas.is_core_photo_visible = true;
      document.getElementById("bt_core_photo").style.backgroundColor = "#ccc";
    }
    updateView();

    });
  //============================================================================================
  //rank
  document.getElementById("bt_rank").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.marker.is_rank_visible) {
        objOpts.marker.is_rank_visible = false;
        document.getElementById("bt_rank").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.marker.is_rank_visible = true;
        document.getElementById("bt_rank").style.backgroundColor = "#ccc";
      }
      updateView();
    }      
  });
  //============================================================================================
  //rank
  document.getElementById("bt_source").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.connection.is_source_visible) {
        objOpts.connection.is_source_visible = false;
        document.getElementById("bt_source").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.connection.is_source_visible = true;
        document.getElementById("bt_source").style.backgroundColor = "#ccc";
      }
      updateView();
    }      
  });
  //============================================================================================
  //grid
  document.getElementById("bt_grid").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.canvas.is_grid_visible) {
        objOpts.canvas.is_grid_visible = false;
        document.getElementById("bt_grid").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.canvas.is_grid_visible = true;
        document.getElementById("bt_grid").style.backgroundColor = "#ccc";
      }
      updateView();
      }        
    });
  //============================================================================================
  //show labels
  document.getElementById("bt_show_labels").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.marker.is_name_labels_visible || objOpts.marker.is_position_labels_visible) {      
        if (event.shiftKey){
          objOpts.marker.is_name_labels_visible = false;
          objOpts.marker.is_position_labels_visible = true;
        } else if (event.ctrlKey){
          objOpts.marker.is_name_labels_visible = true;
          objOpts.marker.is_position_labels_visible = false;
        } else {
          objOpts.marker.is_name_labels_visible = false;
          objOpts.marker.is_position_labels_visible = false;
          document.getElementById("bt_show_labels").style.backgroundColor = "#f0f0f0";
        }
      } else {
        if (event.shiftKey){
          objOpts.marker.is_name_labels_visible = false;
          objOpts.marker.is_position_labels_visible = true;
        } else if (event.ctrlKey){
          objOpts.marker.is_name_labels_visible = true;
          objOpts.marker.is_position_labels_visible = false;
        } else {
          objOpts.marker.is_name_labels_visible = true;
          objOpts.marker.is_position_labels_visible = true;
        }
        document.getElementById("bt_show_labels").style.backgroundColor = "#ccc";
      }

      
      updateView();
      }        
    });
  //============================================================================================
  //pen
  document.getElementById("bt_pen").addEventListener("click", async (event) => {
    if(LCCore){
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
      await loadPlotData("age");
      await loadPlotData("data")

      //update photo
      if(Object.keys(modelImages.drilling_depth).length>0){
        modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth", "age"]);
      }

      //update plot
      updateView();
    });
  //============================================================================================
  //snapshot
  document.getElementById("bt_snapshot").addEventListener("click", async (event) => {
    if(LCCore!==null){
      isSVG = true;

      const targetCanvas = new p5(p5Sketch);
      targetCanvas.redraw();
      targetCanvas.save("model.svg");

      const annotationCanvas = new p5(penSketch);
      annotationCanvas.redraw();
      annotationCanvas.save("model_annotation.svg");

      targetCanvas.remove();
      annotationCanvas.remove();

      objOpts.edit.is_full_snapshot = false;
      isSVG = false;
      console.log("[Renderer]: Take snapshot as svg.");
    }
  });
  //============================================================================================
  //measure
  document.getElementById("bt_measure").addEventListener("click", async (event) => {
      if (LCCore) {
        if(objOpts.canvas.depth_scale !== "drilling_depth"){
          if (!measureObject.isMeasure) {
            measureObject.isMeasure = true;
            document.body.style.cursor = "crosshair"; 
            
            measureObject.measureCanvas = new p5(measureSketch);
            document.getElementById("bt_measure").style.backgroundColor = "#ccc";
          } else {
            measureObject.measureCanvas.clear();

            measureObject.isMeasure = false;
            measureObject.measureCanvas = null;
            document.body.style.cursor = "default"; 
            const parentElement2 = document.getElementById("p5measureCanvas");
            while (parentElement2.firstChild) {
              parentElement2.removeChild(parentElement2.firstChild);
            }
            document.getElementById("bt_measure").style.backgroundColor = "#f0f0f0";
          }
        }
      }else{
        measureObject.isMeasure = false;
        measureObject.measureCanvas = null;
        const parentElement2 = document.getElementById("p5measureCanvas");
        while (parentElement2.firstChild) {
          parentElement2.removeChild(parentElement2.firstChild);
        }
      }
    });
  //============================================================================================
  //Unload all models
  window.LCapi.receive("UnLoadModelsMenuClicked", async () => {
    const response = await window.LCapi.Confirm(
      {
        opts: {
          title:"Confirm",
          message:"Are you sure you want to clear the loaded models?",
          parent: "main"
        }
      }
    );
    if (response) {
      //ok
      //initialise
      await initialiseCorrelationModel();
      await initialiseAgeModel();
      await initialiseCanvas();
      await initialisePlot();
      await initialisePaths();
      isLoadedLCModel = false;

      modelImages = initialiseImages();

      console.log("[Renderer]: Unload Models of Correlations, Ages and Canvas.");
    } else {
      //no
      return;
    }
  });
  
  //============================================================================================
  //load age model
  window.LCapi.receive("LoadCoreImagesMenuClicked", async (imageBuffers) => {
    if (!LCCore) {
      return;
    }

    //call from main process
    try {
      if(modelImages !== null){
        modelImages = await assignCoreImages(modelImages, imageBuffers);
      }
      
    } catch (error) {
      console.error("ERROR: File load error", error);
      return;
    }

    //update plot
    updateView();
  });
   //============================================================================================
   //import plot data
  window.LCapi.receive("importedData", async (data) => {    
    if(data){
      console.log("[Renderer]: Imported data received.");
      //load renderer
      await loadPlotData("data")
    }  
  });
  
  //============================================================================================
  //load correlation model
  window.LCapi.receive("UpdateViewFromMain", async () => {
    await loadModel(false, false);
    const registeredAgeList = await window.LCapi.MirrorAgeList();
    setAgeList(registeredAgeList);
    const selected_age_model_id = document.getElementById("AgeModelSelect").value; 
    await loadAge(selected_age_model_id);//load age data included LCCore

    await loadPlotData("age");
    await loadPlotData("data")

    //update photo
    if(Object.keys(modelImages.drilling_depth).length>0){
      //modelImages = await loadCoreImages(modelImages, LCCore, objOpts, "age");
    }

    let isConnected = true;
    for(let p=0; p<LCCore.projects.length; p++){
      if(LCCore.projects[p].id[0] === LCCore.base_project_id[0]){
        //if base project
        continue;
      }

      if(!isConnectMasterProject(LCCore, LCCore.projects[p].id)){
        isConnected = false;
      }
    }

    if(!objOpts.edit.editable && !isConnected){
      alert(
        "The loaded model contains a project not connected to the master.\n" +
        "CD and EFD will be calculated independently for that project."
      );
    }
    
    updateView();
  });

 //============================================================================================
  //load correlation model
  window.LCapi.receive("RegisteredLCModel", async (filepath) => {
    document.body.style.cursor = "wait";
    isLoadedLCModel = true; //initialise
    
    //load
    //await registerModelFromLCCore()
    //await registerAgeFromLCAge();

    await loadModel(false, true);//make up hole list view

    const selected_age_model_id = document.getElementById("AgeModelSelect").value; 
    await loadAge(selected_age_model_id);//load age data included LCCore

    await loadPlotData("age");
    await loadPlotData("data")

    updateView();    
    await window.LCapi.clearProgressbar();
    document.body.style.cursor = "default";
  });
   //============================================================================================
  window.LCapi.receive("AlertRenderer", async (data) => {
    //data: status, statusDetails, hasError, statusDetails

    console.log("Error: \n",data);
    alert(data.statusDetails)
    //data.errorDetails
  });
  //============================================================================================
  window.LCapi.receive("PlotDataOptions", async (data) => {
     console.log("[Renderer]: Plot options are received.", data)
     lcE2ELastPlotPayload = data;

     try{
      
      if(LCPlotData?.draw_collections){
        LCPlotData.draw_collections = [];
      }      

      //get plotter options
      objOpts.plotter.selected_options = data.data;
      objOpts.plot.is_plot_visible = true;
      document.getElementById("bt_chart").style.backgroundColor = "#ccc";

      //emit type: new: start plot, add: add new data, updateDataset: update data values, updateSetting: update only setting
      if(objOpts.plotter.selected_options.emitType=="updateSetting"){
        //If only settings are changed, skip data recalculation as it is unnecessary        
        if(["root","developer"].includes(objOpts.developer.mode)){
          console.log("[Renderer]: Plotter update only settings")
        }
        return
      }

      //initiarise
      const invalidSet = new Set(objOpts.plot.invalid_values);

      //calc plotvaluse
      if(objOpts.plotter.selected_options !== null && (LCPlotData?.data_collections?.length ?? 0) > 0){
        // clac each datasets
        const selectedList = objOpts.plotter.selected_options;
        for(let t=0; t< selectedList.length; t++){
          //each Plot list in plotter
          const target = selectedList[t];       
          
          //main
          //get idx
          let colIdx = null;
          LCPlotData.data_collections.forEach((c, i)=>{
            if(c.id == target.collectionId){
                colIdx = i;
            }
          })

          if(colIdx==null){
            continue
          }

          //get data
          let nIdx = null;
          let dIdx = null;
          const numInfoData = 12;

          if(LCPlotData.data_collections[colIdx].rows.length > 0){
            //if row data exist
            
            if(target.numeratorId>0){
              nIdx = target.numeratorId   + numInfoData;
            }
            if(target.denominatorId>0){
              dIdx = target.denominatorId + numInfoData;
            }
          }

          if(nIdx==null && dIdx==null){
            continue
          }

          //calc bin size
          let th = [0.010, 0.025, 0.050, 0.075, 0.10, 0.25, 0.50, 0.75, 1.0, 2.5, 5.0, 7.5, 10]; //cm          
          //console.time("[Renderer]: Making multi-level data: ")
          //-------numerator----------------------------------------------------------------------------------------------------   
          //the data row is sorted by the original depth source
          const numeratorDataSeries   = [];          
          if(nIdx!==null){         
            const numeratorDataset0 = drawPointDataset();     
            numeratorDataset0.zoom_level = 0;     
            let val_min = Infinity;
            let val_max = - Infinity;

            LCPlotData.data_collections[colIdx].rows.forEach((row,ridx)=>{     
              const drawPoint  = drawPointData(row, LCCore);
              
              if(!Number.isFinite(drawPoint.composite_depth)){
                return
              } 

              drawPoint.idx = ridx;
              drawPoint.id  = row[0] ? row[0] : "";

              drawPoint.type   = "data";
              drawPoint.header = LCPlotData.data_collections[colIdx].header[nIdx] ? LCPlotData.data_collections[colIdx].header[nIdx] : "";
              drawPoint.unit   = LCPlotData.data_collections[colIdx].units[nIdx]  ? LCPlotData.data_collections[colIdx].units[nIdx]  : "";

              // Sanitize input: assign 'raw' only if it is a valid, finite number; otherwise fallback to NaN.              
              const isValid = row[nIdx] !== null && !invalidSet.has(String(row[nIdx]).toLowerCase()) && Number.isFinite(Number(row[nIdx]));
              drawPoint.val = isValid ? Number(row[nIdx]) : NaN;

              numeratorDataset0.data.push(drawPoint);     
              if(drawPoint.val < val_min){
                val_min = drawPoint.val;
              }
              if(drawPoint.val > val_max){
                val_max = drawPoint.val;
              }       
            })
            
            //set values
            if(Number.isFinite(val_min)){
              numeratorDataset0.min = val_min;
            }
            if(Number.isFinite(val_max)){
              numeratorDataset0.max = val_max;
            }

            //sunbmit
            numeratorDataSeries.push(numeratorDataset0);//original data
          }
          //-------denominator------------------------------------------------------------------------------------------
          //the data row is sorted by the original depth source
          const denominatorDataSeries = [];
          if(dIdx!==null){            
            const denominatorDataset0     = drawPointDataset();     
            denominatorDataset0.zoom_level = 0;     
            let val_min = Infinity;
            let val_max = - Infinity;

            LCPlotData.data_collections[colIdx].rows.forEach((row,ridx)=>{     
              const drawPoint  = drawPointData(row, LCCore);
              if(!Number.isFinite(drawPoint.composite_depth)){
                return
              }
              
              drawPoint.idx = ridx;
              drawPoint.id  = row[0] ? row[0] : "";

              drawPoint.type   = "data";
              drawPoint.header = LCPlotData.data_collections[colIdx].header[dIdx] ? LCPlotData.data_collections[colIdx].header[dIdx] : "";
              drawPoint.unit   = LCPlotData.data_collections[colIdx].units[dIdx]  ? LCPlotData.data_collections[colIdx].units[dIdx]  : "";
              
              // Sanitize input: assign 'raw' only if it is a valid, finite number; otherwise fallback to NaN.              
              const isValid = row[dIdx] !== null && !invalidSet.has(String(row[dIdx]).toLowerCase()) && Number.isFinite(Number(row[dIdx]));
              drawPoint.val = isValid ? Number(row[dIdx]) : NaN;
              
              denominatorDataset0.data.push(drawPoint);     

              if(drawPoint.val < val_min){
                val_min = drawPoint.val;
              }
              if(drawPoint.val > val_max){
                val_max = drawPoint.val;
              }       
            })
            
            //set values
            if(Number.isFinite(val_min)){
              denominatorDataset0.min = val_min;
            }
            if(Number.isFinite(val_max)){
              denominatorDataset0.max = val_max;
            }

            //sunbmit
            denominatorDataSeries.push(denominatorDataset0);
          }

          //=================== calc divided values ============================================================================
          //calc divided values
          const dividedDataSeries = dividePlotData(numeratorDataSeries, denominatorDataSeries);

          //resample
          const bin_width = target.resampleWidth;
          if(bin_width>0){
            
            let resampledDataset;
            if(objOpts.plot.resample_method=="moving"){
              //moving averaging
              resampledDataset = movingAvPointData(dividedDataSeries, [bin_width], objOpts);
            }else{
              //block averaging
              resampledDataset = resamplePointData(dividedDataSeries, [bin_width], objOpts);
            }

            0
            const sortedDataset = sortDataSetRowsByModelOrder(resampledDataset, LCCore);

            //fix max/min
            sortedDataset.min = dividedDataSeries[0].min;
            sortedDataset.max = dividedDataSeries[0].max;

            dividedDataSeries[0] = sortedDataset;//overwrite
            dividedDataSeries[0].is_resampled = true;
          }

          //2. sort dataset map by composite depth(if not exist, keep original order)
          dividedDataSeries.forEach(dividedData => {
            if (dividedData.data.length > 0) {
              if (dividedData.data[0].source == "trinity") {
                // 1. Create a combined array of objects pairing 'data' and 'depth_map'
                // (Assumes both arrays have the same length)
                const combined = dividedData.depth_map.composite_depth.map((list, index) => ({
                  index,
                  mapDrillingDepth:  dividedData.depth_map.drilling_depth[index],
                  mapCompositeDepth: list,
                  mapEventFreeDepth: dividedData.depth_map.event_free_depth[index],
                  mapAge:            dividedData.depth_map.age[index],
                }));

                // 2. Sort the combined array based on 'hname'
                combined.sort((a, b) => {
                  const d = a.mapCompositeDepth.value - b.mapCompositeDepth.value;
                  return d !== 0 ? d : a.index - b.index;  
                })
                
                //sort((a, b) => a.dataItem.hname.localeCompare(b.dataItem.hname));

                // 3. Map the sorted results back to the original properties
                dividedData.depth_map.drilling_depth = combined.map(c => c.mapDrillingDepth);
                dividedData.depth_map.composite_depth = combined.map(c => c.mapCompositeDepth);
                dividedData.depth_map.event_free_depth = combined.map(c => c.mapEventFreeDepth);
                dividedData.depth_map.age = combined.map(c => c.mapAge);
                
              }
            }
          });

          //submit
          LCPlotData.draw_collections.push(dividedDataSeries);

          //console.timeEnd("[Renderer]: Making multi-level data: ")       
        }

        if(["root","developer"].includes(objOpts.developer.mode)){
          console.log("[Renderer]: Plot data: ",LCPlotData)
        }else{
          console.log("[Renderer]: Plot data is loaded.")
        }
      }else{
        console.log(
          "[Renderer]: There is no plot data or information: ",
          objOpts.plotter.selected_options,
          LCPlotData?.data_collections ?? null
        )
      }
           
      updateView();
    }catch(er){
      console.error(er)
    }
  });
  //============================================================================================
  //Edit correlation model
  document.addEventListener('contextmenu', handleNormalContextmenu);
  window.LCapi.receive("EditCorrelation", async () => {
    if(["user"].includes(objOpts.developer.mode) && !objOpts.edit.editable){   
      const askData = {
        title:"Edit model",
        label:"Please enter passwards.",
        value:"",
        type:"password",
      };
      response = await window.LCapi.inputdialog(askData);
      if(response !==null){
        if(response !== objOpts.edit.passwards){
          alert("Please enter the correct passwords.");
          return
        }
      }else{
        return;
      }
    };

    if(objOpts.edit.editable == true){
      objOpts.edit.editable = false;
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      document.body.style.cursor = "default";
      await window.LCapi.changeEditMode({ mode: objOpts.edit.editable });
      document.removeEventListener('contextmenu', handleEditContextmenu);
      document.addEventListener('contextmenu', handleNormalContextmenu);
    }else{
      objOpts.edit.editable = true;
      await window.LCapi.changeEditMode({ mode: objOpts.edit.editable });
      objOpts.edit.contextmenu_enable = true;
      document.body.style.cursor = "crosshair"; 
      if(objOpts.edit.contextmenu_enable){
        document.addEventListener('contextmenu', handleEditContextmenu);
        document.removeEventListener('contextmenu', handleNormalContextmenu);
      }
    }
  });
  //============================================================================================

  //============================================================================================
  async function handleNormalContextmenu(event) {
    event.preventDefault();
    let clickResult = null;

    if(objOpts.edit.hittest==null) return
    if(objOpts.edit.hittest.hole!==null){
      if(objOpts.edit.hittest.section!==null){
        clickResult = await window.LCapi.showContextMenu({ type: "sectionContextMenu" });
      }else{
        clickResult = await window.LCapi.showContextMenu({ type: "holeContextMenu" });
      }
    }else{
      clickResult = await window.LCapi.showContextMenu({ type: "normalContextMenu" });  
    }

    if(clickResult==null){
      return;
    }
    
    if(clickResult=="loadHighResolutionImage"){

      const targetId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole,objOpts.edit.hittest.section,null];
      modelImages.load_target_ids = [targetId];//load target
      const targetIdx = getIdxById(LCCore, targetId);
      const holeName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].name;
      const sectionName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].name;

      modelImages.image_resolution[holeName+"-"+sectionName] = objOpts.image.dpcm_highresolution;

      modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth", "composite_depth","event_free_depth","age"]);
      
      updateView();
    }else if(clickResult.includes("holeMoveTo")){
      const minHoleOrder = Math.min(...LCCore.projects.flatMap(p => p.holes.map(h => h.order)));
      const maxHoleOrder = Math.max(...LCCore.projects.flatMap(p => p.holes.map(h => h.order)));
      LCCore.projects.forEach(p=>{
        if(p.id[0]==objOpts.edit.hittest.project){
          p.holes.forEach(h=>{
            if(h.id[1]==objOpts.edit.hittest.hole){
              const currentOrder = h.order;
              let newOrder = null;
              if(clickResult.includes("Right")){
                newOrder = currentOrder+1;
              }else if(clickResult.includes("Left")){
                newOrder = currentOrder-1;
              }
              
              if(newOrder>maxHoleOrder){
                newOrder = maxHoleOrder;
              }
              if(newOrder<minHoleOrder){
                newOrder = minHoleOrder;
              }

              p.holes.forEach(h2=>{
                if(h2.order == newOrder){
                  h2.order = currentOrder;
                  h.order = newOrder;
                }
              })
              
            }
          })
        }
      })
      LCCore = sortHoleByOrder(LCCore);
      
      updateView();
    }else if(clickResult=="showSectionProperties"){
      if(LCCore){
        if(objOpts.edit.hittest.section!==null){
          const ht = objOpts.edit.hittest;
          let sectionProperties = {
            options:{
              title:"Properties: ",
              editable:false,
            },
            editable:{},
            data:null,
          };
          LCCore.projects.forEach(p=>{
            if(p.id[0]==ht.project){
              p.holes.forEach(h=>{
                if(h.id[1]==ht.hole){
                  h.sections.forEach(s=>{
                    if(s.id[2]==ht.section){
                      console.log(p.name)
                      sectionProperties.options.title += p.name+" "+h.name+"-"+s.name; 

                      //replace marker => position(becase definition)
                      const secData = structuredClone(s);
                      secData.markers.forEach((m,i)=>{
                        m.position = s.markers[i].distance;
                        delete m.distance;
                      })
                      
                      //send to window
                      sectionProperties.data = secData;
                    }
                  })
                }              
              })
            }
          })
          if(sectionProperties.data!==null){
            
            const editable = {};
            for(let key in sectionProperties.data){
              sectionProperties.editable[key] = false;
            }             

            console.log("[Renderer]: Send section properties: ", sectionProperties)

            await window.LCapi.sendSettings({
              sendData: sectionProperties,
              to: "settings",
            });
          }
        }
      }      
    }else if(clickResult=="reloadImage"){
      const curDPCM = JSON.parse(JSON.stringify(objOpts.image.dpcm));
      const targetId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole,objOpts.edit.hittest.section,null];      
      modelImages.load_target_ids = [targetId];//load target
      
      const reloadDefaultDpcm = true;
      if(reloadDefaultDpcm){
        const targetIdx = getIdxById(LCCore, targetId);
        const holeName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].name;
        const sectionName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].name;

        modelImages.image_resolution[holeName+"-"+sectionName] = objOpts.image.dpcm;
      }
     
      modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth", "composite_depth","event_free_depth","age"]);

      updateView();
      objOpts.image.dpcm = curDPCM;
    }else if(clickResult=="reload"){
      document.getElementById("bt_reload").click();
    }else if(clickResult=="finder"){
      document.getElementById("bt_finder").click();
    }else if(clickResult=="zoomin"){
      document.getElementById("bt_zoomin").click();
    }else if(clickResult=="zoomout"){
      document.getElementById("bt_zoomout").click();
    }else if(clickResult=="zoom0"){
      document.getElementById("bt_zoom0").click();
    }else if(clickResult=="zoomactual"){
      document.getElementById("bt_zoomactual").click();
    }
  }
  //0 Context menu--------------------------------------------
  async function handleEditContextmenu(event) {
    event.preventDefault();

    const clickResult = await window.LCapi.showContextMenu({ type: "editContextMenu" });
    if(clickResult==null) return

    if(clickResult == "connectMarkers"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "connect_marker";
      objOpts.edit.handleMove = handleConnectMouseMove;
      objOpts.edit.handleClick = null;
      document.addEventListener("mousemove", objOpts.edit.handleMove);
      console.log(objOpts.edit);
    }else if(clickResult == "disconnectMarkers"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "disconnect_marker";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      objOpts.edit.handleClick = null;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "connectSections"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "connect_section";
      objOpts.edit.handleMove = handleSectionConnectMouseMove;
      objOpts.edit.handleClick = null;
      document.addEventListener("mousemove", objOpts.edit.handleMove);
      console.log(objOpts.edit);
    }else if(clickResult == "disconnectSections"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "disconnect_section";
      objOpts.edit.handleMove = handleSectionConnectMouseMove;
      objOpts.edit.handleClick = null;
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "addMarker"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "add_marker";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "calcCD"){
      await loadModel(true, true);
    }else if(clickResult == "deleteMarker"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "delete_marker";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "changeMarkerName"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "change_marker_name";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "setZeroPoint"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "set_zero_point";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "addMaster"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "enable_master";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "deleteMaster"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "disable_master";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "changeMarkerDistance"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "change_marker_distance";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "changeMarkerDescriptions"){
      if(LCCore){
        if(objOpts.edit.hittest.nearest_marker!==null){
          const ht = objOpts.edit.hittest;
          const targetId  = [ht.project, ht.hole, ht.section, ht.nearest_marker];
          const targetIdx = getIdxById(LCCore, targetId); 
          const projectName = LCCore.projects[targetIdx[0]].name
          const holeName    = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].name;
          const sectionName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].name;
          const markerName  = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]].name;

          const askData = {
            title:"Edit marker descriptions: " + projectName +" " +holeName+"-"+sectionName+"-"+markerName,
            label:"",
            value:LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]].descriptions,
            type:"textarea",
          };
          const response = await window.LCapi.inputdialog(askData);
          if(response !== null){
            const result = await window.LCapi.changeMarker({
              markerId: targetId,
              type: "descriptions",
              value: response,
            });
            if(result == true){
              console.log("[Renderer]: Chnage marker descriptions.")
              await loadModel(false, false);
            }
          }
        }
      }
    }else if(clickResult == "addEvent"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "add_event";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "deleteEvent"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "delete_event";
      objOpts.edit.handleMove = handleMarkerMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "showSectionProperties"){
      if(LCCore){
        if(objOpts.edit.hittest.section!==null){
          const ht = objOpts.edit.hittest;
          let sectionProperties = {
            options:{
              title:"Properties: ",
              editable:false,
            },
            editable:{},
            data:null,
          };
          LCCore.projects.forEach(p=>{
            if(p.id[0]==ht.project){
              p.holes.forEach(h=>{
                if(h.id[1]==ht.hole){
                  h.sections.forEach(s=>{
                    if(s.id[2]==ht.section){
                      console.log(p.name)
                      sectionProperties.options.title += p.name+" "+h.name+"-"+s.name; 

                      //replace marker => position(becase definition)
                      const secData = structuredClone(s);
                      secData.markers.forEach((m,i)=>{
                        m.position = s.markers[i].distance;
                        delete m.distance;
                      })
                      
                      //send to window
                      sectionProperties.data = secData;
                    }
                  })
                }              
              })
            }
          })
          if(sectionProperties.data!==null){
            
            const editable = {};
            for(let key in sectionProperties.data){
              if(key !=="id"){
                sectionProperties.editable[key] = false;
              }
              
            }             

            console.log("[Renderer]: Send section properties: ", sectionProperties)

            await window.LCapi.sendSettings({
              sendData: sectionProperties,
              to: "settings",
            });
          }
        }
      }   
    }else if(clickResult == "changeSectionName"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "change_section_name";
      objOpts.edit.handleMove = handleSectionMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "changeSectionDescriptions"){
      if(LCCore){
        if(objOpts.edit.hittest.section!==null){
          const ht = objOpts.edit.hittest;
          const targetId  = [ht.project, ht.hole, ht.section, null];
          const targetIdx = getIdxById(LCCore, targetId); 
                    
          const projectName = LCCore.projects[targetIdx[0]].name
          const holeName    = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].name;
          const sectionName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].name;

          const askData = {
            title:"Edit section descriptions: " + projectName +" " +holeName+"-"+sectionName,
            label:"",
            value:LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].descriptions,
            type:"textarea",
          };
          const response = await window.LCapi.inputdialog(askData);
          if(response !== null){
            const result = await window.LCapi.changeSection({
              sectionId: targetId,
              type: "descriptions",
              value: response,
            });
            if(result == true){
              console.log("[Renderer]: Chnage section descriptions.")
              await loadModel(false,false);
            }
          }
        }
      }
    }else if(clickResult == "addSection"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "add_section";
      objOpts.edit.handleMove = handleHoleMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "deleteSection"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "delete_section";
      objOpts.edit.handleMove = handleSectionMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "changeHoleName"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "change_hole_name";
      objOpts.edit.handleMove = handleHoleMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "changeHoleDescriptions"){
      if(LCCore){
        if(objOpts.edit.hittest.hole!==null){
          const ht = objOpts.edit.hittest;
          const targetId  = [ht.project, ht.hole, null, null];
          const targetIdx = getIdxById(LCCore, targetId); 

          const projectName = LCCore.projects[targetIdx[0]].name
          const holeName    = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].name;

          const askData = {
            title:"Edit hole descriptions: " + projectName +" " +holeName,
            label:"",
            value:LCCore.projects[targetIdx[0]].holes[targetIdx[1]].descriptions,
            type:"textarea",
          };
          const response = await window.LCapi.inputdialog(askData);
          if(response !== null){
            const result = await window.LCapi.changeHole({
              holeId: targetId,
              type: "descriptions",
              value: response,
            });
            if(result == true){
              console.log("[Renderer]: Chnage hole descriptions.")
              await loadModel(false,false);
            }
          }
        }
      }
    }else if(clickResult == "deleteHole"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "delete_hole";
      objOpts.edit.handleMove = handleHoleMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "addHole"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "add_hole";
      objOpts.edit.handleMove = handleProjectMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "holeMoveToOtherProject"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.marker_from = JSON.parse(JSON.stringify(objOpts.edit.hittest));
      objOpts.edit.hittest = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "move_hole_to_project";
      objOpts.edit.handleMove = handleProjectMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "addProject"){
      if(LCCore){
        if(LCCore.projects[LCCore.projects.length-1].holes.length  <= 0){
          alert("The previous project is empty. Please add a hole to it first.");

          return
        }else{
          ProjectAdd();
        }
      }else{
        ProjectAdd();
      }
      
      
    }else if(clickResult == "deleteProject"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "delete_project";
      objOpts.edit.handleMove = handleProjectMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
      
    }else if(clickResult == "changeProjectName"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "change_project_name";
      objOpts.edit.handleMove = handleProjectMouseMove;
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      document.addEventListener("mousemove", objOpts.edit.handleMove);
      
    }else if(clickResult == "changeProjectDescriptions"){
      if(LCCore){
        if(objOpts.edit.hittest.project!==null){
          const ht = objOpts.edit.hittest;
          const targetId  = [ht.project, null, null, null];
          const targetIdx = getIdxById(LCCore, targetId); 

          const projectName = LCCore.projects[targetIdx[0]].name

          const askData = {
            title:"Edit project descriptions: " + projectName,
            label:"",
            value:LCCore.projects[targetIdx[0]].descriptions,
            type:"textarea",
          };
          const response = await window.LCapi.inputdialog(askData);
          if(response !== null){
            const result = await window.LCapi.changeProject({
              projectId: targetId,
              type: "descriptions",
              value: response,
            });
            if(result == true){
              console.log("[Renderer]: Chnage project descriptions.")
              await loadModel(false,false);
            }
          }
        }
      }
    }else if(clickResult == "mergeProjects"){
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Merge all projects",
            message:"Are you sure you want to merge all the projects?",
            parent: "main"
          }
        }        
      );
      if (response.response) {
        const result = await window.LCapi.mergeProjects();

        if(result == true){
          await undo("save", "Merge Project");

          await loadModel(false,false);
          //await registerModelFromLCCore()
          //await registerAgeFromLCAge();
          const selected_age_model_id = document.getElementById("AgeModelSelect").value;
          await loadAge(selected_age_model_id)
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();   

        }else if (result == "duplicate_holes"){
          alert("Duplicate hole names detected. Please rename them to unique names.");
        }
      }    
    }else if(clickResult == "changeProjectType"){
      console.log(111111111111111111111111111111)
      if(LCCore){
        if(objOpts.edit.hittest.project!==null){
          const ht = objOpts.edit.hittest;
          const targetId  = [ht.project, null, null, null];
          const targetIdx = getIdxById(LCCore, targetId); 

          const project = LCCore.projects[targetIdx[0]];
          const projectName = project.name;
          let newType="duo";
          if(project.model_type=="duo"){
            newType = "correlation";
          }else{
            newType = "duo";
          }

          const askData = {
            title:"Edit project type: " + projectName,
            label:"Current model type: " + project.model_type,
            value:newType,
            type:"textarea",
          };
          const response = await window.LCapi.inputdialog(askData);

          if(response !== null){
            const result = await window.LCapi.changeProject({
              projectId: targetId,
              type: "model_type",
              value: response.toString(),
            });
            if(result === true){
              console.log("[Renderer]: Chnage project type.")
              await loadModel(false,false);
              updateView();
            }
          }
        }
      }    
    }else if(clickResult == "loadHighResolutionImage"){

      const targetId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole,objOpts.edit.hittest.section,null];
      modelImages.load_target_ids = [targetId];//load 
      const targetIdx = getIdxById(LCCore, targetId);
      const holeName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].name;
      const sectionName = LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].name;

      modelImages.image_resolution[holeName+"-"+sectionName] = objOpts.image.dpcm_highresolution;

      modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth", "age"]);
      updateView();
    }else if(clickResult == "plotImageBrightness"){
      if(LCCore){
        if(objOpts.edit.hittest.section!==null){
          const ht = objOpts.edit.hittest;

          LCCore.projects.forEach(p=>{
            if(p.id[0]==ht.project){
              p.holes.forEach(h=>{
                if(h.id[1]==ht.hole){
                  h.sections.forEach(s=>{
                    if(s.id[2]==ht.section){
                      modelImages.plot_colour[h.name+"-"+s.name] = !modelImages.plot_colour[h.name+"-"+s.name];
                      console.log("Renderer: Draw image brightness: ", h.name+"-"+s.name, modelImages.plot_colour[h.name+"-"+s.name])
                    }
                  })
                }              
              })
            }
          })
        }
      }
      updateView();      
    }else if(clickResult == "showFloatingImage"){
      const targetId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole,objOpts.edit.hittest.section,null];
      if(Object.keys(modelImages["drilling_depth"]).length>0){
        console.log("Renderer: openfloating image viewer");
        await window.LCapi.floatingImageViewer({ targetId });
      }
    }else if(clickResult.includes("holeMoveTo")){
      const minHoleOrder = Math.min(...LCCore.projects.flatMap(p => p.holes.map(h => h.order)));
      const maxHoleOrder = Math.max(...LCCore.projects.flatMap(p => p.holes.map(h => h.order)));
      let newOrder;
      let currentOrder;
      let targetIds = [];
      if(objOpts.edit.hittest.project == null || objOpts.edit.hittest.hole == null){
        return
      }
      LCCore.projects.forEach(p=>{
        if(p.id[0]==objOpts.edit.hittest.project){
          p.holes.forEach(h=>{
            if(h.id[1]==objOpts.edit.hittest.hole){
              currentOrder = h.order;
              
              if(clickResult.includes("Right")){
                newOrder = currentOrder+1;
              }else if(clickResult.includes("Left")){
                newOrder = currentOrder-1;
              }
              
              if(newOrder>maxHoleOrder){
                newOrder = maxHoleOrder;
              }
              if(newOrder<minHoleOrder){
                newOrder = minHoleOrder;
              }

              p.holes.forEach(h2=>{
                if(h2.order == newOrder){
                  targetIds.push(h.id);
                  targetIds.push(h2.id);
                  holeId = h.id;
                  //apply
                  //h2.order = currentOrder;
                  //h.order = newOrder;
                }
              })
              
            }
          })
        }
      })

      //update model
      if(targetIds.length == 2){
        console.log("renderer: Change order "+ targetIds[0] +"<->"+targetIds[1]);        

        const result = await window.LCapi.changeHole({
          holeId: targetIds[0],
          type: "order",
          value: targetIds[1],
        });
        if(result == true){
          await undo("save", "Change Hole Order");//undo
          console.log("[Renderer]: Chnage hole order.")
          await loadModel(false,false);
        }
        updateView();
      }
      
    }else if(clickResult == "cancel"){
      objOpts.edit.editable = true;
      objOpts.edit.contextmenu_enable = true;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.section_from = null;
      objOpts.edit.section_to = null;
      objOpts.edit.mode = "";
      document.body.style.cursor = "default";
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
      if(objOpts.edit.handleMove !== null){
        document.removeEventListener('mousemove', objOpts.edit.handleMove);
        objOpts.edit.handleMove = null;
      }
      console.log("[Renderer]: Edit cancelled.",objOpts.edit.handleMove, objOpts.edit.handleClick);
      updateView();
    }else if(clickResult == "editWorkspaceName"){
      if(LCCore){
        const askData = {
          title:"Edit workspace name: ",
          label:"",
          value:LCCore.descriptions,
          type:"text",
        };
        const response = await window.LCapi.inputdialog(askData);
        if(response !== null){
          const result = await window.LCapi.changeWorkspace({
            type: "name",
            value: response,
          });
          if(result == true){
            console.log("[Renderer]: Chnage workspace name.")
            await loadModel(false,false);
          }
        }        
      }else{
        alert("Please create a project first.");
      }
    }else if(clickResult == "editWorkspaceDescriptions"){
      if(LCCore){
        const askData = {
          title:"Edit workspace descriptions: ",
          label:"",
          value:LCCore.descriptions,
          type:"textarea",
        };
        const response = await window.LCapi.inputdialog(askData);
        if(response !== null){
          const result = await window.LCapi.changeWorkspace({
            type: "descriptions",
            value: response,
          });
          if(result == true){
            console.log("[Renderer]: Chnage workspace descriptions.")
            await loadModel(false,false);
          }
        }        
      }else{
        alert("Please create a project first.");
      }
    }else if(clickResult == "reload"){
      document.getElementById("bt_reload").click();
    }else if(clickResult == "finder"){
      document.getElementById("bt_finder").click();
    }else if(clickResult == "zoomin"){
      document.getElementById("bt_zoomin").click();
    }else if(clickResult == "zoomout"){
      document.getElementById("bt_zoomout").click();
    }else if(clickResult == "zoom0"){
      document.getElementById("bt_zoom0").click();
    }else if(clickResult == "zoomactual"){
      document.getElementById("bt_zoomactual").click();
    }else if(clickResult == "reloadModel"){
      if(LCCore){
               
      }
    }else{
      objOpts.edit.contextmenu_enable = true;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.handleClick = null;
      objOpts.edit.handleMove = null;
    }

  }
  //1 Connect move--------------------------------------------
  function handleConnectMouseMove(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;
    updateView();
  
    //context menu
    if (Math.abs(ht.nearest_distance) < objOpts.edit.sensibility) {
      objOpts.edit.handleClick = handleConnectClick;
      document.addEventListener('click', objOpts.edit.handleClick);
    }else if(objOpts.edit.handleClick !== null){
      document.removeEventListener('click', objOpts.edit.handleClick);
      objOpts.edit.handleClick = null;
    }
  }
  //1 Connect click--------------------------------------------
  async function handleConnectClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    //initialise
    if(objOpts.edit.marker_from !== null && objOpts.edit.marker_to !== null){
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = null;
    }

    //if clicked same hole
    if(objOpts.edit.marker_from == null && ht.nearest_marker !== null){
      if(objOpts.edit.mode == "connect_marker"){
        objOpts.edit.marker_from = ht;
      }else if(objOpts.edit.mode == "connect_section" || objOpts.edit.mode == "disconnect_section"){
        //case piston core
        if(ht.markerName.includes("top") || ht.markerName.includes("bottom")){
          objOpts.edit.marker_from = ht;
        }
      }
    }

    if(objOpts.edit.marker_to == null && ht.nearest_marker !== null){
      if(objOpts.edit.mode == "connect_marker"){
        if(!(objOpts.edit.marker_from.project == ht.project && objOpts.edit.marker_from.hole == ht.hole)){
          objOpts.edit.marker_to = ht;
          isProcessing = true;
        }  
      }else if(objOpts.edit.mode == "connect_section" || objOpts.edit.mode == "disconnect_section"){
        //case piston core
        if(objOpts.edit.marker_from.project == ht.project && objOpts.edit.marker_from.hole ==ht.hole && objOpts.edit.marker_from.section !== ht.section){
          if((objOpts.edit.marker_from.markerName.includes("top") && ht.markerName.includes("bottom")) || (objOpts.edit.marker_from.markerName.includes("bottom") && ht.markerName.includes("top"))){
            objOpts.edit.marker_to = ht;
          }
        }
        
      }
      
    }    
    
    if (objOpts.edit.marker_from !== null && objOpts.edit.marker_to !== null) {
      //if get both markers
      
      if(objOpts.edit.mode == "connect_marker"){
        const response = await window.LCapi.askdialog(
          {
            opts: {
              title:"Connect markers",
              message:"Do you want to CONNECT between selected markers?",
              parent: "main"
            }
          }
        );
        if (response.response) {
          
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          const toId   = [objOpts.edit.marker_to.project,   objOpts.edit.marker_to.hole,   objOpts.edit.marker_to.section,   objOpts.edit.marker_to.nearest_marker];
          
          console.log("[Editor]: Connected markers between " + fromId +" and " + toId);
          
          const result = await window.LCapi.connectMarkers({
            fromId,
            toId,
            direction: "horizontal",
          });
                    
          if(result==true){
            await undo("save","Connect Markers");//undo
            await loadModel(false, false);
            const fromIdx = getIdxById(LCCore, fromId);
            const fromMarkerData = LCCore.projects[fromIdx[0]].holes[fromIdx[1]].sections[fromIdx[2]].markers[fromIdx[3]];
            const toIdx = getIdxById(LCCore, toId);
            const toMarkerData = LCCore.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]];
            let targetIds = [];

            if(fromMarkerData.depth_source[0]!=="master"){
              targetIds.push(fromId);
            }
            if(toMarkerData.depth_source[0]!=="master"){
              targetIds.push(toId);
            } 
            const changedData = await getUpdatedSectionIds("depth");
            console.log("[Renderer]: Affected sections:",changedData);
            //const affectedSections = getConnectedSectionIds(targetIds);
            if(changedData.ids.length>0){
              modelImages.load_target_ids = changedData.ids;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
            }
            isProcessing = false;
            updateView();
          }
         
        }
      } else if(objOpts.edit.mode == "connect_section"){
        const response = await window.LCapi.askdialog(
          {
            opts: {
              title:"Connect markers",
              message:"Do you want to CONNECT between selected sections?",
              parent: "main"
            }
          }
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          const toId   = [objOpts.edit.marker_to.project,   objOpts.edit.marker_to.hole,   objOpts.edit.marker_to.section,   objOpts.edit.marker_to.nearest_marker];
          
          console.log("[Editor]: Connected markers between " + fromId +" and " + toId);
          
          let result = null;
          if(fromId[0] == toId[0] && fromId[1] == toId[1] && fromId[2] !== toId[2]){
            //case connect vertival
            result = await window.LCapi.connectMarkers({
              fromId,
              toId,
              direction: "vertical",
            });
          }
          console.log(result)
          
          if(result==true){
            await undo("save","Connect Sections");//undo
            await loadModel(false,false);
            const changedData = await getUpdatedSectionIds("depth");
            console.log("[Renderer]: Affected sections:",changedData);
            //const affectedSections = getConnectedSectionIds([fromId, toId]);
            if(changedData.ids.length>0){
              modelImages.load_target_ids = changedData.ids;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
            }
            
            updateView();
          }
         
        }
      } else if(objOpts.edit.mode == "disconnect_section"){
        const response = await window.LCapi.askdialog(
          {
            opts: {
              title:"Connect markers",
              message:"Do you want to DISCONNECT between selected sections?",
              parent: "main"
            }
          }
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          const toId   = [objOpts.edit.marker_to.project,   objOpts.edit.marker_to.hole,   objOpts.edit.marker_to.section,   objOpts.edit.marker_to.nearest_marker];

          console.log("[Editor]: Disconnected markers between " + fromId +" and " + toId);
          
          if(fromId[0] == toId[0] && fromId[1] == toId[1] && fromId[2] !== toId[2]){
            //case connect vertival
            result = await window.LCapi.disconnectMarkers({
              fromId,
              toId,
              direction: "vertical",
            });
          }
          if(result == true){
            await undo("save","Disconnect Sections");//undo
            await loadModel(false,false);

            const changedData = await getUpdatedSectionIds("depth");
            console.log("[Renderer]: Affected sections:",changedData);
            //const affectedSections = getConnectedSectionIds([fromId, toId]);
            if(changedData.ids.length>0){
              modelImages.load_target_ids = changedData.ids;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
            }
  
            updateView();
          }else{
            console.log("Fail")
          }
          
        }
      }

      //exit process
      document.removeEventListener("click", handleConnectClick);
      document.removeEventListener("mousemove", handleConnectMouseMove);
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      isProcessing = false;
    }
  }
  //2 Marker move--------------------------------------------
  function handleMarkerMouseMove(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;
    updateView();
    
    //on the sectionif(ht.section !== null){}
    if(objOpts.edit.mode == "add_marker"){
      if(ht.section !== null){
        //console.log(ht.hole+"-"+ht.section+"-"+ht.nearest_marker)
        objOpts.edit.handleClick = handleMarkerAddClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
    }else if(objOpts.edit.mode == "delete_marker"){
      if (ht.section !== null && Math.abs(ht.nearest_distance) < objOpts.edit.sensibility) {
        objOpts.edit.handleClick = handleMarkerDeleteClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
    }else if(["change_marker_name","change_marker_distance", "set_zero_point", "enable_master","disable_master","disconnect_marker"].includes(objOpts.edit.mode)){
      if (ht.section !== null && Math.abs(ht.nearest_distance) < objOpts.edit.sensibility) {
        objOpts.edit.handleClick = handleMarkerChangeClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
    }else if(["add_event","delete_event"].includes(objOpts.edit.mode)){
      if(ht.section !== null){
        objOpts.edit.handleClick = handleEventAddClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else{
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
    }
    
  }
  //2 Marker click--------------------------------------------
  async function handleMarkerChangeClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    //initialise
    if(objOpts.edit.marker_from !== null ){
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = 999999;//dummy
      objOpts.edit.mode = null;
      return;
    }

    if(objOpts.edit.marker_from == null && ht.nearest_marker !== null){
      objOpts.edit.marker_from = ht;
      objOpts.edit.marker_to = 999999;//dummy
    }

    let isShift = false;
    if (event.shiftKey) {
      //Set continuous selection mode
      isShift = true;
      console.log("[Renderer: Set continuous selection mode.]")
    }
    
    if (objOpts.edit.marker_from !== null) {
      isProcessing = true;
      //if get both markers
      if(["change_marker_name","change_marker_distance"].includes(objOpts.edit.mode)){
        let target = null;
        let response=null;
        
        if(objOpts.edit.mode == "change_marker_name"){
          if(objOpts.edit.marker_from.markerName.includes("-top") || objOpts.edit.marker_from.markerName.includes("-bottom")){
            response = await window.LCapi.askdialog(
              {
                opts: {
                  title:"Reserved Name Change Warning",
                  message:"You are attempting to change a name that is reserved by system rules. Do you want to proceed with this change?",
                  parent: "main"
                }
              }
            );

            if(!response.response){
              isProcessing = false;
              return
            } else{
              response = null;
            }           
          }
          target = "name";
          const askData = {
            title:"Change marker name",
            label:"Please input new name",
            value:"",
            type:"text",
          };

          response = await window.LCapi.inputdialog(askData);

          //if top/bottom
          if(objOpts.edit.marker_from.markerName.includes("-top") || objOpts.edit.marker_from.markerName.includes("-bottom")){            
            const regex = new RegExp(`^${objOpts.edit.marker_from.holeName}-${objOpts.edit.marker_from.sectionName}-(top|bottom)$`);
            if(!regex.test(response)){
              isProcessing = false;
              alert("Invalid name format. Use: <Hole Name>-<Section Name>-top/bottom");
              return
            }
          }          

          console.log("[Editor]: Change marker: " + target);
          
        }else if(objOpts.edit.mode == "change_marker_distance"){
          target = "distance";
          const askData = {
            title:"Change marker position",
            label:"Please input new position(cm).",
            value:0.0,
            type:"number",
          };
          response = await window.LCapi.inputdialog(askData);
            
          console.log("[Editor]: Change marker: " + target);
        } 
         
        if (response !== null) {
          const targetId = [ht.project, ht.hole, ht.section, ht.nearest_marker];
          
          const result = await window.LCapi.changeMarker({
            markerId: targetId,
            type: target,
            value: response,
          });
          if(result == true){
            await undo("save","Change Marker "+target.charAt(0).toUpperCase() + target.slice(1));//undo
            await loadModel(false,false);
            updateView();
          }else{
            let txt="";
            if(result == "must_be_bottom"){
              txt = "The bottom marker must be located the bottom of the section.";
            }else if(result == "must_be_top"){
              txt = "The top marker must be located the top of the section.";
            }else if(result == "out_of_section"){
              txt = "The marker must be located between top and bottom of the section.";
            }else if(result == "used"){
              txt = response + " already has been used.";
            }else if(result == "same"){
              txt = "";
            }else{
              txt = "Unsuspected error occurred.";
            }
            
            if(txt !== ""){
              alert(txt);
            }
            
          }
        }
      }else if(objOpts.edit.mode == "enable_master"){
        //check
        const targetId = [ht.project, ht.hole, ht.section, ht.nearest_marker];
        const idx = getIdxById(LCCore, targetId);
        console.log(LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]])
        let numMaster = 0;
        for(let hc of LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].h_connection){
          const idxh = getIdxById(LCCore, hc);
          
          if(idxh[0] == idx[0]){
            if(LCCore.projects[idxh[0]].holes[idxh[1]].sections[idxh[2]].markers[idxh[3]].isMaster == true){
              numMaster++;
            }
          }          
        }
        if(numMaster>2){
          alert("Only up to two master markers can be set in the same horizon. Please remove any unnecessary ones first.");

          return;
        }
        
        //apply        
        const result = await window.LCapi.SetMaster({
          markerId: targetId,
          type: "enable",
        });
        if(result==true){
          await undo("save","Set Master");//undo
          await loadModel(false, false);
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          
          const changedData = await getUpdatedSectionIds("depth");          
          console.log("[Renderer]: Affected sections:",changedData);

          if(changedData.ids.length>0){
              modelImages.load_target_ids = changedData.ids;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);//11111111
          }
            
          updateView();
          console.log("[Renderer]: Set a new master.");
        }else{
          console.log("[Renderer]: Failed to set a new master.");
        }
      }else if(objOpts.edit.mode == "disable_master"){
        //apply
        const targetId = [ht.project, ht.hole, ht.section, ht.nearest_marker];
        console.log(targetId)
        
        const result = await window.LCapi.SetMaster({
          markerId: targetId,
          type: "disable",
        });
        if(result==true){
          await undo("save","Unset Master");//undo
          await loadModel(false,false);
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();
          console.log("[Renderer]: Delete master.");
        }else{
          console.log("[Renderer]: Failed to delete master.");
        }
      }else if(objOpts.edit.mode == "set_zero_point"){
        //check
        let isExistZeroPoint = false;
        breakpoint:
        for(let p of LCCore.projects){
          for(let h of p.holes){
            for(let s of h.sections){
              for(let m of s.markers){
                if(m.isZeroPoint !== false){
                  isExistZeroPoint = true;
                  break breakpoint;
                }
              }
            }
          }
        }
        let response = true;
        if(isExistZeroPoint == true){
          response = await window.LCapi.askdialog(
            {
              opts: {
                title:"Set Zero Point",
                message: "The Zero point has alrady been defined. Do you want to replace this?",
                parent: "main"
              }
            }
          );
        }

        if (response.response == false) {
          return
        }

        const askData = {
          title:"Set Zero Point",
          label:"Please input new composite depth (cm) at the Zero Point.",
          value:0.0,
          type:"number",
        };
        response = await window.LCapi.inputdialog(askData);
        if(response !== null){
          const targetId = [ht.project, ht.hole, ht.section, ht.nearest_marker];
          //console.log(targetId,response)
          
          const result = await window.LCapi.SetZeroPoint({
            markerId: targetId,
            value: response,
          });
          if(result==true){
            await undo("save","Set Zero Point");//undo
            await loadModel(false,false);
            await loadAge(document.getElementById("AgeModelSelect").value);
            await loadPlotData("age");
            await loadPlotData("data")
            updateView();
            console.log("[Renderer]: Set a new Zero point.");
          }else{
            console.log("[Renderer]: Failed to set zero point.");
          }
        }            
        
      }else if (objOpts.edit.mode == "disconnect_marker"){
          const response = await window.LCapi.askdialog(
            {
              opts: {
                title:"Disconnect markers",
                message:"Do you want to DISCONNECT connections in this marker?",
                parent: "main"
              }
            }
          );
          if (response.response) {
            const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
            const toIdx  = getIdxById(LCCore, fromId);
            const toIds  = LCCore.projects[toIdx[0]].holes[toIdx[1]].sections[toIdx[2]].markers[toIdx[3]].h_connection;

            console.log("[Editor]: Disconnected connections in " + fromId);
            
            const result = await window.LCapi.disconnectAllConnections({
              fromId,
              direction: "horizontal",
            });
            if(result.success > 0 && result.failure == 0){
              console.log("[Renderer]: Disconnected markers");
            }else if(result.success > 0 && result.failure > 0){
              console.log("[Renderer]: Partially disconnected the markers.");
            }else if(result.success == 0 && result.failure > 0){
              console.log("[Renderer]: Failed to disconnect markers");
            }

            await undo("save","Disconnect Marker");//undo
            await loadModel(false,false);

            const changedData = await getUpdatedSectionIds("depth");          
            console.log("[Renderer]: Affected sections:",changedData);
            //const affectedSections = getConnectedSectionIds(disconnectedIds);
            
            if(changedData.ids.length>0){
              modelImages.load_target_ids = changedData.ids;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
            }
  
            updateView();
            
          }
        }

    }
    
    if(isShift){
      objOpts.edit.contextmenu_enable = true;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.handleClick = null;
      objOpts.edit.handleMove = null;
    }else{
      document.removeEventListener("click", objOpts.edit.handleClick);
      document.removeEventListener("mousemove", objOpts.edit.handleMove);      

      objOpts.edit.contextmenu_enable = true;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.handleClick = null;
      objOpts.edit.handleMove = null;
      //objOpts.edit.mode=null; // if enable, continuous mode need shift.

      ///update scroller position
      let canvasPosY = null;
      let canvasPosX = (ht.x + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y;
      if (objOpts.canvas.depth_scale == "age") {
        canvasPosY = ((ht.y+ objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y + objOpts.canvas.age_zoom_correction[1])  * objOpts.canvas.age_zoom_correction[0];
      } else {
        canvasPosY = (ht.y + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y;
      }

      //if move to centre
      //scroller.scrollTop = canvasPosY - scroller.clientHeight / 2;
      //scroller.moveTo(scroller.scrollLeft, pos_y);

      //move canvas
      let newPosY = canvasPosY - scroller.clientHeight / 2;
      let newPosX = canvasPosX - scroller.clientWidth / 2;
      if(newPosY <= 0){
        newPosY = 0;
      }
      if(newPosX <= 0){
        newPosX = 0;
      }
    }
    isProcessing = false;
    updateView();
  }
  //2 Marker click--------------------------------------------
  async function handleMarkerDeleteClick(event) {
    if(isProcessing) return
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    //initialise
    if(objOpts.edit.marker_from !== null ){
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = 999999;//dummy
      objOpts.edit.mode = null;
      return;
    }

    if(objOpts.edit.marker_from == null && ht.nearest_marker !== null){
      objOpts.edit.marker_from = ht;
      objOpts.edit.marker_to = 999999;//dummy
    }
    
    if (objOpts.edit.marker_from !== null) {
      //if get both markers
      isProcessing = true;
      if(objOpts.edit.mode == "delete_marker"){
        const response = await window.LCapi.askdialog(
          {
            opts: {
              title:"Delete markers",
              message:"Do you want to DELETE the selected marker?",
              parent: "main"
            }
          }
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          
          console.log("[Editor]: Delete marker: " + fromId);
          
          const result = await window.LCapi.deleteMarker({
            markerId: fromId,
          });
          if(result==true){
            await undo("save","Delete Marker");//undo
            await loadModel(false,false);
          }          
        }
      }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    isProcessing = false;
    updateView();
  }
  //2 Marker click--------------------------------------------
  async function handleMarkerAddClick(event) {
    if(isProcessing) return
    console.log("[Renderer]: Add Marker clicked.")
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    //initialise
    if(objOpts.edit.marker_from !== null ){
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = 999999;//dummy
      objOpts.edit.mode = null;
      return;
    }

    if(objOpts.edit.marker_from == null){
      objOpts.edit.marker_from = ht;
      objOpts.edit.marker_to = 999999;//dummy
    }

    let isShift = false;
    if (event.shiftKey) {
      //Set continuous selection mode
      isShift = true;
      console.log("[Renderer: Set continuous selection mode.]")
    }

    //if get both markers
    if(objOpts.edit.mode == "add_marker"){
      isProcessing = true;
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Add new markers",
            message:"Do you want to ADD a new marker?",
            parent: "main"
          }
        }
      );
      if (response.response) {
        
        const upperId   = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.upper_marker];
        const lowerId   = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.lower_marker];
        const sectionId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, null];
        console.log("[Editor]: Add marker between " + upperId +" and "+lowerId);
        
        const result = await window.LCapi.addMarker({
          sectionId,
          depth: objOpts.edit.marker_from.y,
          depthScale: objOpts.canvas.depth_scale,
          relativeX: ht.relative_x,
        });
        if(result == true){
          await undo("save","Add Marker");//undo
          await loadModel(false,false);
        }
        
      }
    }

    if(isShift){
      objOpts.edit.contextmenu_enable = true;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;

      objOpts.edit.handleClick = null;
      objOpts.edit.handleMove = null;
    }else{
      document.removeEventListener("click", objOpts.edit.handleClick);
      document.removeEventListener("mousemove", objOpts.edit.handleMove);

      //objOpts.edit.mode=null; // if enable, continuous mode need shift.
      objOpts.edit.contextmenu_enable = true;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;

      objOpts.edit.handleClick = null;
      objOpts.edit.handleMove = null;   

      ///update scroller position
      let canvasPosY = null;
      let canvasPosX = (ht.x + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y;
      if (objOpts.canvas.depth_scale == "age") {
        canvasPosY = ((ht.y+ objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y + objOpts.canvas.age_zoom_correction[1])  * objOpts.canvas.age_zoom_correction[0];
      } else {
        canvasPosY = (ht.y + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y;
      }

      //if move to centre
      //scroller.scrollTop = canvasPosY - scroller.clientHeight / 2;
      //scroller.moveTo(scroller.scrollLeft, pos_y);

      //move canvas
      let newPosY = canvasPosY - scroller.clientHeight / 2;
      let newPosX = canvasPosX - scroller.clientWidth / 2;
      if(newPosY <= 0){
        newPosY = 0;
      }
      if(newPosX <= 0){
        newPosX = 0;
      }

      //canvasPos[0] = newPosX;
      //canvasPos[1] = objOpts.canvas.shift_y;////newPosY;
    }
        
    isProcessing = false;
    updateView();
  }
  //2 Marker click--------------------------------------------
  async function handleEventAddClick(event) {
    if(isProcessing) return
    console.log("[Renderer]: Event select clicked.")
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();
    /*
    let results = {
    x:x, 
    y:y, 
    depth_scale:objOpts.canvas.depth_scale, 
    project:null, 
    hole:null, 
    section:null, 
    distance:null, 
    nearest_marker: null, 
    nearest_distance:null,
    upper_marker:null,
    lower_marker:null,
    };
    */
  
    //
    if(objOpts.edit.mode == "add_event"){
      let askData = {
        title:"Add new event",
        label:'Event type? ["deposition", "erosion", "markup"]',
        value:"deposition",
        type:"text"
      };
      
      const response1 = await window.LCapi.inputdialog(askData);
      isProcessing = true;
      if (response1 !== null) {
        let response2 = null;
        if(["deposition","d","markup","m"].includes(response1.toLowerCase())){
          askData = {
            title:"Add new event",
            label:'Colour tyep? ["general", "tephra", "disturbed","void"]',
            value:"general",
            type:"text"
          };
          response2 = await window.LCapi.inputdialog(askData);
        }else if(["erosion","e"].includes(response1.toLowerCase())){
          data = {
            title:"Add new event",
            label:"Erosion thickness? (cm).",
            value:0.0,
            type:"number"
          };
          response2 = await window.LCapi.inputdialog(data);
        }

        if(response2 !== null){
          const upperId   = [ht.project, ht.hole, ht.section, ht.upper_marker];
          const lowerId   = [ht.project, ht.hole, ht.section, ht.lower_marker];
          //console.log("[Editor]: Add event between " + upperId +" and "+lowerId);

          let result = null;
          if(["deposition","d","markup","m"].includes(response1.toLowerCase())){
            if(["general","tephra","disturbed","void","g","t","d","v"].includes(response2.toLowerCase())){
              result = await window.LCapi.AddEvent({
                upperId,
                lowerId,
                depositionType: response1,
                value: response2,
              });
            }
          }else  if(["erosion","e"].includes(response1.toLowerCase())){
            result = await window.LCapi.AddEvent({
              upperId,
              lowerId: [],
              depositionType: response1,
              value: response2,
            });
          }

          if(result == true){
            await undo("save","Add Event");//undo

            await loadModel(false,false);
            await loadAge(document.getElementById("AgeModelSelect").value);
            await loadPlotData("age");
            await loadPlotData("data")
            const changedData = await getUpdatedSectionIds("depth");          
            console.log("[Renderer]: Affected sections:",changedData);
            //const affectedSections = getConnectedSectionIds([upperId, lowerId]);
            if(changedData.ids.length>0 && (objOpts.image.is_load_enabled.event_free_depth || objOpts.image.is_load_enabled.age)){
              modelImages.load_target_ids = changedData.ids;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
            }

            console.log("[Renderer]: Add a new event.]");
          }else if(result == "occupied"){
            alert("This event deposition type is already used between the markers.");

          }
        }        
      }
    }else if(objOpts.edit.mode == "delete_event"){
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Delete event", 
            message:"Are you sure you want to REMOVE all events?",
            parent: "main"
          }
        }
      );
      if(response.response){
        const upperId   = [ht.project, ht.hole, ht.section, ht.upper_marker];
        const lowerId   = [ht.project, ht.hole, ht.section, ht.lower_marker];
        
        console.log("[Renderer]: Deleting event between ",upperId,lowerId);

        result = await window.LCapi.DeleteEvent({
          upperId,
          lowerId,
          type: [],
        });
        if(result == true){
          await undo("save","Delete Event");//undo
          await loadModel(false,false);
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          const changedData = await getUpdatedSectionIds("depth");
          console.log("[Renderer]: Affected sections:",changedData);
          //const affectedSections = getConnectedSectionIds([upperId, lowerId]);
          if(changedData.ids.length>0 && (objOpts.image.is_load_enabled.event_free_depth || objOpts.image.is_load_enabled.age)){
            modelImages.load_target_ids = changedData.ids;
            modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
          }
          updateView();
          console.log("[Renderer]: Deleted selected event.")
        }

      }
      
      
    }

    objOpts.edit.mode=null;
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    isProcessing = false;

    updateView();
  }
  //3 Section move--------------------------------------------
  function handleSectionMouseMove(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;
    updateView();
  
    //context menu
    if(ht.section !== null){
      //on the section
      if(objOpts.edit.mode == "change_section_name"){
        objOpts.edit.handleClick = handleSectionChangeClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.mode == "delete_section"){
        objOpts.edit.handleClick = handleSectionDeleteClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else{
        if(objOpts.edit.handleClick !== null){
          document.removeEventListener('click', objOpts.edit.handleClick);
        }        
      }
    }else{
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
      }
    }

    
  }
  //3 Section click--------------------------------------------
  async function handleSectionChangeClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    if(objOpts.edit.mode == "change_section_name"){
      let target = "name";
      const askData = {
        title:"Change section name",
        label:"Please input a new section name.",
        value:"",
        type:"text",
      };
      const response = await window.LCapi.inputdialog(askData);
      if (response !== null) {
        const targetId = [ht.project, ht.hole, ht.section, null];
        
        const result = await window.LCapi.changeSection({
          sectionId: targetId,
          type: target,
          value: response,
        });
        if(result=="used"){
          console.log(`[Renderer]: "${response}" is already in use. Please enter a unique name.`);
          alert(`"${response}" is already in use. Please enter a unique name.`);

        }else if(result==true){
          await undo("save","Change Section Name");//undo
          await loadModel(false,false);
          updateView();
        }
      }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    updateView();
  }
  //3 Section click--------------------------------------------
  async function handleSectionDeleteClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    if(objOpts.edit.mode == "delete_section"){
      isProcessing = true;
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Delete section",
            message:"Do you want to delete the section?",
            parent: "main"
          }
        }
      );
      if (response.response) {
        const targetId = [ht.project, ht.hole, ht.section, null];
        
        const result = await window.LCapi.deleteSection({
          sectionId: targetId,
        });
        if(result){
          await undo("save","Delete Section");//undo
          await loadModel(false,false);
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();
        }
      }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    isProcessing = false;
    updateView();
  }
  //3 Section click--------------------------------------------
  async function handleSectionAddClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    
    if(objOpts.edit.mode == "add_section"){
      
      //let inData = {name:"00",distance_top:0, distance_bottom:100,dd_top:1000,dd_bottom:1100};
      let inData = {};
      let askData = {
        title:"Add a new section",
        label:"Section Name?",
        value:"",
        type:"text",
      };
      inData.name = await window.LCapi.inputdialog(askData);
      if(inData.name!==null){
        askData = {
          title:"Add a new section",
          label:"Section TOP distance (cm)?",
          value:"0.0",
          type:"number",
        };
        inData.distance_top    = parseFloat(await window.LCapi.inputdialog(askData));
        if(!isNaN(inData.distance_top)){
          askData = {
            title:"Add a new section",
            label:"Section BOTTOM distance (cm)?",
            value:"100.0",
            type:"number",
          };
          inData.distance_bottom = parseFloat(await window.LCapi.inputdialog(askData));
          if(!isNaN(inData.distance_bottom)){
            askData = {
              title:"Add a new section",
              label:"Section TOP drilling depth (cm)?",
              value:"0.0",
              type:"number",
            };
            inData.dd_top = parseFloat(await window.LCapi.inputdialog(askData));
            if(!isNaN(inData.dd_top)){
              askData = {
                title:"Add a new section",
                label:"Section BOTTOM drilling depth (cm)?",
                value:100.0,
                type:"number",
              };
              inData.dd_bottom       = parseFloat(await window.LCapi.inputdialog(askData));
            }
          }
        }
      }
      
      //check data
      if(inData.distance_top !== null && inData.distance_bottom !== null && inData.dd_top !== null && inData.dd_bottom !== null){
        if(inData.distance_top<inData.distance_bottom && inData.dd_top<inData.dd_bottom){
          const targetId = [ht.project, ht.hole, null, null];
                  
          const result = await window.LCapi.addSection({
            sectionId: targetId,
            data: inData,
          });
          if(result==true){
            await undo("save","Add Section");//undo
            await loadModel(false,false);
            await loadAge(document.getElementById("AgeModelSelect").value);
            await loadPlotData("age");
            await loadPlotData("data")
          }else{
            console.log("[Renderer]: Failed to add section.")
          }
        }else{
          alert("Incorrect input values detected.");
          console.log("[Renderer]: Input data contains incorrect values.");

        }
      }else{
        return;
      }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    objOpts.edit.mode = "";
    updateView();
  }
  //3 Connect move--------------------------------------------
  function handleSectionConnectMouseMove(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;
    updateView();
  
    //context menu
    const hasListener = !!objOpts.edit.handleClick;
    if (ht.section !== null) {
      if (!hasListener) {
        objOpts.edit.handleClick = handleSectionConnectClick;
        document.addEventListener('click', objOpts.edit.handleClick, { once:false });
      }
    } else if (hasListener) {
      document.removeEventListener('click', objOpts.edit.handleClick);
      objOpts.edit.handleClick = null;
    }
  }
  //3 Connect click--------------------------------------------
  async function handleSectionConnectClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    //initialise
    if(objOpts.edit.section_from !== null && objOpts.edit.section_to !== null){
      objOpts.edit.section_from = null;
      objOpts.edit.section_to = null;
      objOpts.edit.mode = null;
    }

    //if clicked same hole
    if(objOpts.edit.section_from == null && ht.section !== null){
      if(objOpts.edit.mode == "connect_section" || objOpts.edit.mode == "disconnect_section"){
        objOpts.edit.section_from = ht;
      }
    }

    if(objOpts.edit.section_to == null && ht.section !== null){
      if(objOpts.edit.mode == "connect_section" || objOpts.edit.mode == "disconnect_section"){
        if((objOpts.edit.section_from.project == ht.project && objOpts.edit.section_from.hole == ht.hole && objOpts.edit.section_from.section !== ht.section)){
          //case save project, same hole, different section
          objOpts.edit.section_to = ht;
        }  
      }
    }    
    
    if (objOpts.edit.section_from !== null && objOpts.edit.section_to !== null) {
      //find top/bottom markers
      const fromSectionId = [objOpts.edit.section_from.project, objOpts.edit.section_from.hole, objOpts.edit.section_from.section, null];
      const toSectionId   = [objOpts.edit.section_to.project,   objOpts.edit.section_to.hole,   objOpts.edit.section_to.section,   null];
      const fromSectionIdx= getIdxById(LCCore, fromSectionId);
      const toSectionIdx  = getIdxById(LCCore, toSectionId);
      const fromSectionData = LCCore.projects[fromSectionIdx[0]].holes[fromSectionIdx[1]].sections[fromSectionIdx[2]];
      const toSectionData   = LCCore.projects[toSectionIdx[0]].holes[toSectionIdx[1]].sections[toSectionIdx[2]];
      
      let fromMarker = null;
      let toMarker   = null;
      if(fromSectionData.order > toSectionData.order ){
        //TOP<- to | from -> bottom            
        fromMarker = fromSectionData.markers[0].id[3]; 
        toMarker   = toSectionData.markers[toSectionData.markers.length-1].id[3];
      }else{
        //TOP<- from | to -> bottom
        fromMarker = fromSectionData.markers[fromSectionData.markers.length-1].id[3]; 
        toMarker   = toSectionData.markers[0].id[3];
      }

      const fromId = [fromSectionId[0], fromSectionId[1], fromSectionId[2], fromMarker];
      const toId   = [toSectionId[0],   toSectionId[1],   toSectionId[2],   toMarker];

      //if get both sections
      if(objOpts.edit.mode == "connect_section"){
        const response = await window.LCapi.askdialog(
          {
            opts: {
              title:"Connect sections",
              message:"Do you want to CONNECT between selected sections?",
              parent: "main"
            }
          }
        );
        if (response.response) {
          console.log("[Editor]: Connected sections between " + fromId +" and " + toId);
          
          if(fromId[0] == toId[0] && fromId[1] == toId[1] && fromId[2] !== toId[2]){
            //case connect vertival
            if(await window.LCapi.connectMarkers({
              fromId,
              toId,
              direction: "vertical",
            })){
              await undo("save","Connect Sections");//undo
              await loadModel(false,false);
              const changedData = await getUpdatedSectionIds("depth");
              console.log("[Renderer]: Affected sections:",changedData);
              //const affectedSections = getConnectedSectionIds([fromId, toId]);
              if(changedData.ids.length>0){
                modelImages.load_target_ids = changedData.ids;
                modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
              }
              
              updateView();
            }else{
              console.log("Fail")
            }
          }
         
        }
      } else if(objOpts.edit.mode == "disconnect_section"){
        const response = await window.LCapi.askdialog(
          {
            opts: {
              title:"Connect sections",
              message:"Do you want to DISCONNECT between selected sections?",
              parent: "main"
            }
          }
        );
        if (response.response) {
          console.log("[Editor]: Disconnected markers between " + fromId +" and " + toId);
          
          if(fromId[0] == toId[0] && fromId[1] == toId[1] && fromId[2] !== toId[2]){
            //case connect vertival
            if(await window.LCapi.disconnectMarkers({
              fromId,
              toId,
              direction: "vertical",
            })){
              await undo("save","Disconnect Markers");//undo
              await loadModel(false,false);
              const changedData = await getUpdatedSectionIds("depth");
              console.log("[Renderer]: Affected sections:",changedData);
              //const affectedSections = getConnectedSectionIds([fromId, toId]);
              if(changedData.ids.length>0){
                modelImages.load_target_ids = changedData.ids;
                modelImages = await loadCoreImages(modelImages, LCCore, objOpts, changedData.details);
              }
    
              updateView();
            }else{
              console.log("Fail")
            }
          }          
        }
      }

      //exit process
      document.removeEventListener("click", objOpts.edit.handleClick);
      document.removeEventListener("mousemove", objOpts.edit.handleMove);
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.section_from = null;
      objOpts.edit.section_to = null;
      objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null; 
    }
  }
  //4 Hole move--------------------------------------------
  function handleHoleMouseMove(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;
    updateView();
  
    //context menu
    if(ht.hole !== null){
      //on the section
      if(objOpts.edit.mode == "change_hole_name"){
        objOpts.edit.handleClick = handleHoleChangeClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.mode == "add_section"){
        objOpts.edit.handleClick = handleSectionAddClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.mode == "delete_hole"){
        objOpts.edit.handleClick = handleHoleDeleteClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else{
        if(objOpts.edit.handleClick !== null){
          document.removeEventListener('click', objOpts.edit.handleClick);
        }
      }
    }else{
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
      }
    }   
  }
  //4 Hole click--------------------------------------------
  async function handleHoleChangeClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    if(objOpts.edit.mode == "change_hole_name"){
      let target = "name";
      const askData = {
        title:"Change hole name",
        label:"Please input a new hole name.",
        value:"",
        type:"text",
      };
      const response = await window.LCapi.inputdialog(askData);
      if (response !== null) {
        const targetId = [ht.project, ht.hole, null, null];
        console.log(targetId)
        
        const result = await window.LCapi.changeHole({
          holeId: targetId,
          type: target,
          value: response,
        });
        if(result=="used"){
          console.log(`[Renderer]: "${response}" is already in use. Please enter a unique name.`);
          alert(`"${response}" is already in use. Please enter a unique name.`);

        }else if(result==true){
          await undo("save","Change Hole Name");//undo
          await loadModel(false,false);
        }        
      }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    updateView();
  }
  //4 Hole click--------------------------------------------
  async function handleHoleDeleteClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    if(objOpts.edit.mode == "delete_hole"){
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Delete hole",
            message:"Do you want to delete the hole?",
            parent: "main"
          }
        }
      );
      if (response.response) {
        const targetId = [ht.project, ht.hole, null, null];
        
        const result = await window.LCapi.deleteHole({
          holeId: targetId,
        });
        if(result == true){
          await undo("save","Delete Hole");//undo
          console.log("[Renderer]: Delete hole.")
          await loadModel(false,false);
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();
        }
      }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    updateView();
  }
  //4 Hole click--------------------------------------------
  async function handleHoleAddClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    if(objOpts.edit.mode == "add_hole"){
      const askData = {
        title:"Add hole",
        label:"Please input a name of a new hole.",
        value:"",
        type:"text",
      };
      const response = await window.LCapi.inputdialog(askData);
      if (response !== null) {
        const targetId = [ht.project, null, null, null];
        
        const result = await window.LCapi.addHole({
          projectId: targetId,
          name: response,
        });
        if(result == true){
          await undo("save", "Add Hole");//undo
          console.log("[Renderer]: Add hole.")
          await loadModel(false,false);

          //add dummy section for plot


          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();
        }else if(result=="used"){
          console.log(`[Renderer]: "${response}" is already in use. Please enter a unique name.`);
          alert(`"${response}" is already in use. Please enter a unique name.`);

        }
      }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    objOpts.edit.mode = "";
    updateView();
  }
  //5 Project Move--------------------------------------------
  function handleProjectMouseMove(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;
    updateView();
  
    //context menu
    if(ht.project !== null){
      //on the section
      if(objOpts.edit.mode == "add_hole"){
        objOpts.edit.handleClick = handleHoleAddClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.mode == "delete_project"){
        objOpts.edit.handleClick = handleProjectSelectClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.mode == "change_project_name"){
        objOpts.edit.handleClick = handleProjectSelectClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.mode == "move_hole_to_project"){
        objOpts.edit.handleClick = handleProjectSelectClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else{
        if(objOpts.edit.handleClick !== null){
          document.removeEventListener('click', objOpts.edit.handleClick);
        }
      }
    }else{
      if(objOpts.edit.handleClick !== null){
        document.removeEventListener('click', objOpts.edit.handleClick);
      }
    }   
  }
  //5 Project click--------------------------------------------
  async function ProjectAdd(){
    let askData = {
      title:"Add new project",
      label:"Please input a type of a new Project: 'correlation' OR 'duo'.",
      value:"correlation",
      type:"text",
    };
    const response = await window.LCapi.inputdialog(askData);
    if (response !== null) {
      if(response == "correlation" || response == "duo"){
        askData = {
          title:"Add new project",
          label:"Please input a unique name of a new Project.",
          value:"",
          type:"text",
        };
        const response2 = await window.LCapi.inputdialog(askData);

        const result = await window.LCapi.addProject({
          type: response,
          name: response2,
        });
        if(result == true){
          await undo("save","Add Project");//undo
          console.log("[Renderer]: Add project.")
          await loadModel(false,false);
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();
        }else if(result=="used"){
          console.log(`[Renderer]: "${response}" is already in use. Please enter a unique name.`);
          alert(`"${response}" is already in use. Please enter a unique name.`);
        }else if(result == "correlation_exist"){
          console.log("[Renderer]: A base correlation model already exists. Please use a duo model.");
          alert("A base correlation model already exists. Please use a duo model.");
        }else if(result == "no_correlation"){
          console.log("[Renderer]: A duo model requires a base correlation model. Please load a correlation model first.");
          alert("A duo model requires a base correlation model. Please load a correlation model first.");
        }

        }else{
          console.log(`[Renderer]: "${response}" is an invalid type. Please select 'correlation' or 'duo'.`);
          alert(`"${response}" is an invalid type. Please select 'correlation' or 'duo'.`);
        }
    }
    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    objOpts.edit.mode = "";
  }
  //5 Project click--------------------------------------------
  async function handleProjectSelectClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    if(objOpts.edit.mode == "delete_project"){
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Delete project",
            message:"Are you sure to delete this project?",
            parent: "main"
          }
        }
      );
      if (response.response) {
        const targetId = [ht.project, null, null, null];
        
        const result = await window.LCapi.deleteProject({
          projectId: targetId,
        });
        if(result == true){
          await undo("save","Delete Project");//undo
          console.log("[Renderer]: Delete project.")
          await loadModel(false,false);

          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();
        }
      }
    }else if(objOpts.edit.mode == "change_project_name"){
      const askData = {
        title:"Change project name",
        label:"Please input new project name.",
        value:"",
        type:"text",
      };
      const response = await window.LCapi.inputdialog(askData);
      if(response !== null){
        const targetId = [ht.project, null, null, null];
        const result = await window.LCapi.changeProject({
          projectId: targetId,
          type: "name",
          value: response,
        });
        if(result == true){
          console.log("[Renderer]: Chnage project name.")
          await loadModel(false,false);
          //await loadAge(document.getElementById("AgeModelSelect").value);
          //await loadPlotData("age");
          updateView();
        }else if(result=="used"){
          console.log(`[Renderer]: "${response}" is already in use. Please enter a unique name.`);
          alert(`"${response}" is already in use. Please enter a unique name.`);

        }
      }
    }else if(objOpts.edit.mode == "move_hole_to_project"){
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Move hole to project",
            message:"Are you sure to move the hole to this selected project?",
            parent: "main"
          }
        }
      );

      if(response.response){
        const holeHt = objOpts.edit.marker_from;

        const toProjectId = [ht.project, null, null, null];
        const holeId      = [holeHt.project, holeHt.hole, null, null];
        
        const result = await window.LCapi.moveHoleToProject({
          holeId,
          projectId: toProjectId,
        });

        if(result == true){
          await undo("save","Move Hole");//undo
          console.log("[Renderer]: Move the selected hole to this project.")
          await loadModel(false,false);
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData("age");
          await loadPlotData("data")
          updateView();
        }else if(result==false){
          console.log("[Renderer]: Failed to move the hole to the selected project.");
          // alert(`"${response}" is already in use. Please enter a unique name.`);
        }
      }
    }

    document.removeEventListener("click", objOpts.edit.handleClick);
    document.removeEventListener("mousemove", objOpts.edit.handleMove);
    objOpts.edit.contextmenu_enable = true;
    objOpts.edit.hittest = null;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    objOpts.edit.mode = "";
    updateView();
  }
  
  //============================================================================================
  //load correlation model
  window.LCapi.receive("ExportCorrelationAsLCMenuClicked", async () => {
    console.log(LCCore.projects.length)
    //check model
    await loadModel(false, false);
    const projectData = getDataFromId(LCCore, LCCore.base_project_id);
    if(projectData.model_type == "duo"){
      const response = await window.LCapi.askdialog(
        {
          opts: {
            title:"Export model",
            message:"Connections to the main model will not be exported because the main model is not loaded.\n"+      
                    "Are you sure you want to export?",
            parent: "main"
          }
        }        
      );

      if(response.response){
        await window.LCapi.ExportCorrelationAsCsv();
      }
    }

    await window.LCapi.ExportCorrelationAsCsv();
    
  });
  window.LCapi.receive("ExportCorrelationAsLFMenuClicked", async () => {
    const response = await window.LCapi.askdialog(
      {
        opts: {
          title:"Export model",
          message:
            "Please note that the following expression cannot be used in LF format.\n"+      
            "+ If erosion event included, it cannot be converted.\n"+
            "+ If CD is not defined, the marker will be ignored.: \n"+
            "+ If markup event included, it will be ignored.\n"+
            "+ With 5 or more holes in a project, output is produced but cannot be loaded in Level Finder.\n"+
            "Are you sure you want to export?",
          parent: "main"
        }
      }
      
      
    );

    if(response.response){
      const result = await window.LCapi.ExportCorrelationAsLF();
    }
    
  });
  //============================================================================================
  document.getElementById("bt_chart").addEventListener("click", async () => {
    if (LCCore) {
      if (!objOpts.plot.is_plot_visible ) {
        objOpts.plot.is_plot_visible = true;
        document.getElementById("bt_chart").style.backgroundColor = "#ccc";
        updateView();
      } else {
        objOpts.plot.is_plot_visible = false;
        document.getElementById("bt_chart").style.backgroundColor = "#f0f0f0";
        updateView();
      }
    }
  });
  //============================================================================================
  //check hole list
  document.querySelector("#hole_list").addEventListener("change", async function (event) {
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
          console.log("[Renderer]: Project "+LCCore.projects[target_idx[0]].name +" is "+setType+".");
          //backup
          backup_hole_enable[LCCore.projects[target_idx[0]].id.toString()] = setVal;
          for(let h=0; h<LCCore.projects[target_idx[0]].holes.length;h++){
            const hole = LCCore.projects[target_idx[0]].holes[h];
            hole.enable = setVal;
            const el = document.getElementById(hole.id.toString());
            el.checked = setVal;
            //backup
            backup_hole_enable[hole.id.toString()] = setVal;
            //update model
            if(objOpts.edit.editable){
              await window.LCapi.changeEnable({
                targetId: hole.id,
                isEnable: setVal,
              });
            }
            
            console.log("[Renderer]: Hole "+hole.name +" is "+setType+".");
          }
        } else {
          //case hole selected
          LCCore.projects[target_idx[0]].holes[target_idx[1]].enable = setVal;
          //backup
          backup_hole_enable[LCCore.projects[target_idx[0]].holes[target_idx[1]].id.toString()] = setVal;
          console.log("[Renderer]: Hole "+LCCore.projects[target_idx[0]].holes[target_idx[1]].name +" is "+LCCore.projects[target_idx[0]].holes[target_idx[1]].enable +".");

          //case all holes are disable
          let isAllHoleDisable = true;
          LCCore.projects[target_idx[0]].holes.forEach((hole) => {
            if(hole.enable==true){
              isAllHoleDisable = false;
            }
          });
          if(isAllHoleDisable==true){
            document.getElementById([target_id[0],null,null,null].toString()).checked = false;            
            LCCore.projects[target_idx[0]].enable = false;
            //backup
            //update model
            if(objOpts.edit.editable){
              await window.LCapi.changeEnable({
                targetId: LCCore.projects[target_idx[0]].id,
                isEnable: false,
              });
            }

            backup_hole_enable[LCCore.projects[target_idx[0]].id.toString()] = false;
          }else{
            document.getElementById([target_id[0],null,null,null].toString()).checked = true;
            LCCore.projects[target_idx[0]].enable = true;
            //backup
            //update model
            if(objOpts.edit.editable){
              await window.LCapi.changeEnable({
                targetId: LCCore.projects[target_idx[0]].id,
                isEnable: true,
              });
            }            

            backup_hole_enable[LCCore.projects[target_idx[0]].id.toString()] = true;
          }
        }

        //console.log(LCCore);
        //update plot
        updateView();
      }
    });    
  //============================================================================================
  //reload
  document.getElementById("bt_reload").addEventListener("click", async (event) => {
      if (!LCCore) {
        return;
      }

      await initialiseCorrelationModel();
      await initialiseAgeModel();
      await initialiseCanvas();
      await initialisePlot();

      await window.LCapi.Reregister();

      await loadModel(false, true);
      const registeredAgeList = await window.LCapi.MirrorAgeList();
      console.log(registeredAgeList)
      setAgeList(registeredAgeList);
      const selected_age_model_id = document.getElementById("AgeModelSelect").value; 
      await loadAge(selected_age_model_id);//load age data included LCCore

      await loadPlotData("age");
      await loadPlotData("data")

      //modelImages = initialiseImages();
      modelImages = await updateImageRegistration(modelImages, LCCore);
      modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth", "age"]);

      updateView();
      
    });
  //============================================================================================
  //zoomout
  document.getElementById("bt_zoomout").addEventListener("click", async (event) => {
      if (LCCore) {
        if (event.ctrlKey) {
          objOpts.canvas.zoom_level[0] -= 1;
        } else if(event.shiftKey){
          //change hole distance
          event.preventDefault();
          objOpts.hole.distance -= 1;
          objOpts.connection.tab_length = objOpts.hole.distance * 0.7;
          //objOpts.connection.tab_length += 0.015 * deltaY;
          if (objOpts.connection.tab_length < 0) {
            objOpts.connection.tab_length = 0;
          }
          if (objOpts.connection.tab_length > 20) {
            objOpts.connection.tab_length = 20;
          }
        }else {
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
        makeP5CanvasBase();
        const canvasBase_height = parseInt(canvasBase.style.height.match(/\d+/)[0], 10);
        const canvasBase_width = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);

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
    });
 //============================================================================================
  //zoom0
  document.getElementById("bt_zoom0").addEventListener("click", async (event) => {
    if (LCCore) {
      objOpts.canvas.zoom_level = [4,3];
      objOpts.hole.distance = 20;

      
      //mouse position
      const relative_scroll_pos_x =
      scroller.scrollLeft / scroller.scrollWidth;
    const relative_scroll_pos_y =
      scroller.scrollTop / scroller.scrollHeight;

    //calc new canvas size
    makeP5CanvasBase();
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
  });  
  //============================================================================================
  //zoom actual
  document.getElementById("bt_zoomactual").addEventListener("click", async (event) => {
    if (LCCore) {
        //update display dpcm
        const results = await window.LCapi.getDisplayInfo();
        const display_dpcm = results.height / objOpts.canvas.display_height; 

        objOpts.canvas.zoom_level = [display_dpcm/3, display_dpcm];
        objOpts.hole.distance = 1;
        
        //mouse position
        const relative_scroll_pos_x =
        scroller.scrollLeft / scroller.scrollWidth;
      const relative_scroll_pos_y =
        scroller.scrollTop / scroller.scrollHeight;

      //calc new canvas size
      makeP5CanvasBase();
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
  });
  //============================================================================================
  //zoomin
  document.getElementById("bt_zoomin").addEventListener("click", async (event) => {
      if (LCCore) {
        if (event.ctrlKey) {
          objOpts.canvas.zoom_level[0] += 1;
        } else if(event.shiftKey){
          //change hole distance
          event.preventDefault();
          objOpts.hole.distance += 1;
          objOpts.connection.tab_length = objOpts.hole.distance * 0.7;
          //objOpts.connection.tab_length += 0.015 * deltaY;
          if (objOpts.connection.tab_length < 0) {
            objOpts.connection.tab_length = 0;
          }
          if (objOpts.connection.tab_length > 20) {
            objOpts.connection.tab_length = 20;
          }
        }else{
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
        makeP5CanvasBase();
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
      
    });
  //============================================================================================
  //open finder
  document.getElementById("bt_finder").addEventListener("click", async () => {
    if (LCCore) {
      if (!finderEnable) {
        finderEnable = true;
        document.getElementById("bt_finder").style.backgroundColor = "#ccc";
        await LCapi.OpenFinder();
        objOpts.interface.finder_data = null;

      } else {
        finderEnable = false;
        document.getElementById("bt_finder").style.backgroundColor = "#f0f0f0";
        await LCapi.CloseFinder();
        updateView();
      }
    }
  });

  
  //============================================================================================
  //close finder
  window.LCapi.receive("FinderRequestCurrentPosition", async () => {
    console.log("[Finder]: Finder request current position.")
    //calc current centre position
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const centerX = (rect.width / 2);
    const centerY = (rect.height / 2);//IF ADD 76PIX, CENTRED

    const ht = getClickedItemIdx(centerX, centerY, LCCore, objOpts);   
    await window.LCapi.SendDepthToFinder({ data: ht });

  });
  window.LCapi.receive("FinderClosed", async () => {
    console.log("[Finder]: Finder closed.")
    //call from main process
    finderEnable = false;
    updateView();
    document.getElementById("bt_finder").style.backgroundColor = "#f0f0f0";
    recordLcE2EEvent("FinderClosed");
  });
  window.LCapi.receive("ConverterClosed", async () => {
    recordLcE2EEvent("ConverterClosed");
  });
  window.LCapi.receive("ImageViewerClosed", async () => {
    recordLcE2EEvent("ImageViewerClosed");
  });
  window.LCapi.receive("LabelerClosed", async () => {
    recordLcE2EEvent("LabelerClosed");
  });
  window.LCapi.receive("PlotterHide", async () => {
    recordLcE2EEvent("PlotterHide");
  });
  window.LCapi.receive("PlotterClosed", async () => {
    recordLcE2EEvent("PlotterClosed");
  });
  window.LCapi.receive("SettingsClosed", async () => {
    recordLcE2EEvent("SettingsClosed");
  });
  //mouse click (send depth to finder)   1111111111111111111111111
  scroller.addEventListener("click", async function (event) {
    //calc position
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;

    //send to finder
    if (finderEnable) {
      await window.LCapi.SendDepthToFinder({ data: ht });
      console.log("[Renderer]: Send the clicked depth to Finder", ht.y, objOpts.canvas.depth_scale);
    }

    //update section order
    if(ht.projectIdx!==null && ht.holeIdx!==null &&ht.sectionIdx!==null ){
      const targetHole = LCCore.projects[ht.projectIdx].holes[ht.holeIdx];

      //upper
      for(let s=0; s<ht.sectionIdx; s++){
        targetHole.sections[s].order = s;
      }

      //target
      targetHole.sections[ht.sectionIdx].order = targetHole.sections.length-1;

      //lower
      for(let s=ht.sectionIdx+1; s<targetHole.sections.length; s++){
        targetHole.sections[s].order = s-1;
      }

      updateView();
    }     

  });
  //============================================================================================
  const lcE2EEventLog = [];

  function recordLcE2EEvent(name, payload = null) {
    lcE2EEventLog.push({
      name,
      payload,
      timestamp: Date.now(),
    });
  }

  window.LCapi.receive("rendererLog", async (data) => {
    console.log(data);
  });
  window.LCapi.receive("errors", async (data) => {
    console.log(data);
  });
  window.LCapi.receive("SettingsMenuClicked", async () => {
    recordLcE2EEvent("SettingsMenuClicked");
    const settings = makeSendSettingData();
    await window.LCapi.sendSettings({
      sendData: settings,
      to: "settings",
    });
  });
  window.LCapi.receive("getSettingsFromRenderer", async () => {
    const settings = makeSendSettingData();
    await window.LCapi.sendSettings({
      sendData: settings,
      to: "main",
    });
  });

  function makeSendSettingData(){
    const editable_deny = new Set([
      "information",
      "interface",
      "edit",
      "plotter"
    ]);
    const list_deny = new Set([
      "interface",
      "edit",
      "plotter"
    ]);

    const settings = {};
    for (const k in objOpts) {
      if (objOpts[k] && typeof objOpts[k] === "object") {
        if (!list_deny.has(k)) {
          settings[k] = structuredClone(objOpts[k]);
        }
      }
    }

    const editable = {};
    for (const k in objOpts) {
      if (objOpts[k] && typeof objOpts[k] === "object" && !editable_deny.has(k)) {
        editable[k] = true;
      }
    }

    const options={
      editable:true,
      called_from:"renderer",
      title:"Preferences",
    }

    const sendData = {
      options,
      editable,
      data:settings
    };
    
    return sendData
  }
  
  window.LCapi.receive("SettingsData", async (data) => {
    if(data == null){
      //call default settings
      objOpts = setupSettings();

      //back to settings menu
      const settings = makeSendSettingData();
      await window.LCapi.sendSettings({
        sendData: settings,
        to: "settings",
      });
    }else{
      //call saved settings
      let isOldFormat = false;

      const savedVersion = String(data.information?.version ?? "0").split('.').map(n=>parseInt(n,10)||0);
      const currentVersion = String(objOpts.information.version).split('.').map(n=>parseInt(n,10)||0);

      for(let i=0;i<Math.max(savedVersion.length,currentVersion.length);i++){
        const s = savedVersion[i]||0;
        const c = currentVersion[i]||0;
        if(s < c){ isOldFormat = true; break; }
        if(s > c){ break; }
      }

      if(isOldFormat){
        // case: old beta version format, older version format
        // overwrite the saved settings with app settings

        const settings = makeSendSettingData()

        await window.LCapi.sendSettings({
          sendData: settings,
          to: "save",
        });
              
        console.log("[Renderer]: Legacy-format settings detected. Replacing with the current version.", settings)

      }else{
        //case: same version (or app is older than saved settings)
        const updateDeny = new Set([
          "canvas.zoom_level" //To avoid errors
        ]);

        for (const k in data) {
          if (!objOpts[k]) continue;

          if (typeof data[k] === "object" && typeof objOpts[k] === "object") {

            const filtered = {};
            for (const subk in data[k]) {
              if (updateDeny.has(`${k}.${subk}`)) continue;
              filtered[subk] = data[k][subk];
            }

            Object.assign(objOpts[k], filtered);

          } else {
            objOpts[k] = data[k];
          }
        }

        console.log("[Renderer]: Settings are loaded.", objOpts)        
      }
    }    
    
    updateView();
  });

  
  //-------------------------------------------------------------------------------------------
  window.LCapi.receive("DividerMenuClicked", async () => {
    document.getElementById("bt_divider").click();
  });
  window.LCapi.receive("ReloadMenuClicked", async () => {
    recordLcE2EEvent("ReloadMenuClicked");
    document.getElementById("bt_reload").click();
  });
  window.LCapi.receive("ZoominMenuClicked", async () => {
    recordLcE2EEvent("ZoominMenuClicked");
    document.getElementById("bt_zoomin").click();
  });
  window.LCapi.receive("ZoomoutMenuClicked", async () => {
    document.getElementById("bt_zoomout").click();
  });
  window.LCapi.receive("ZoomdefaultMenuClicked", async () => {
    document.getElementById("bt_zoom0").click();
  });
  window.LCapi.receive("ZoomactualMenuClicked", async () => {
    document.getElementById("bt_zoomactual").click();
  });
  window.LCapi.receive("SnapshotMenuClicked", async (data) => {
    recordLcE2EEvent("SnapshotMenuClicked", data);

    const isShift = data?.isShift === true;

    if (isShift) {
      objOpts.edit.is_full_snapshot = true;
    } else {
      objOpts.edit.is_full_snapshot = false;
    }

    document.getElementById("bt_snapshot").click();
  });
  window.LCapi.receive("MeasureMenuClicked", async () => {
    recordLcE2EEvent("MeasureMenuClicked");
    document.getElementById("bt_measure").click();
  });
  //============================================================================================
  window.LCapi.receive("footerLeft", async (data) => {

    document.getElementById("footerLeftText").textContent = data; 
    
    setTimeout(() => {
      document.getElementById("footerLeftText").textContent = "";
    }, 10000);

  });
  //============================================================================================
  //FInder send event (move to)
  window.LCapi.receive("MoveToHorizonFromFinder", async (data) => {
    //move position based on finder
      //get location
    let pos_y = data[objOpts.canvas.depth_scale];
    objOpts.interface.finder_data = data;
    console.log("[Renderer]: Received data from Finder: ", pos_y, objOpts.canvas.depth_scale);
    if(data.isMove){
      //let rect = document.getElementById("p5Canvas").getBoundingClientRect(); // Canvas position and size

      //convert scale from depth to pix
      //const canvasPosY =  yMag  * age_mod * (pos_y + shift_y) + pad_y - scroller.scrollTop;
      let canvasPosY = null;
      if (objOpts.canvas.depth_scale == "age") {
        canvasPosY = ((pos_y + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y + objOpts.canvas.age_zoom_correction[1])  * objOpts.canvas.age_zoom_correction[0];
      } else {
        canvasPosY = (pos_y + objOpts.canvas.shift_y) * (objOpts.canvas.dpir * objOpts.canvas.zoom_level[1]) + objOpts.canvas.pad_y;
      }

      //update footer
      //const txt = await getFooterInfo(LCCore, objOpts.edit.hittest, objOpts);
      //document.getElementById("footerLeftText").innerText = txt;

      //move scroller
      scroller.scrollTop = canvasPosY - scroller.clientHeight / 2;
      //scroller.moveTo(scroller.scrollLeft, pos_y);

      //move canvas
      let newPosY = canvasPosY - scroller.clientHeight / 2;
      if(newPosY <= 0){
        newPosY = 0;
      }
      canvasPos[1] = newPosY;

      //target line
      var target_line = document.getElementById("horizontal_target");
      target_line.style.top = scroller.clientHeight / 2 + "px";
    }
    updateView();
  });
  //============================================================================================
  //mouse move position event

  document.addEventListener("mousemove", async function (event) {
    if(!LCCore){return}

    //get mouse position
    let rect = document.getElementById("p5Canvas").getBoundingClientRect(); // Canvas position and size  
    var mouseX = event.clientX - rect.left;
    var mouseY = event.clientY - rect.top;

    //hittest
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    objOpts.edit.hittest = ht;
    
    //get/show footer text
    const txt = await getFooterInfo(LCCore, objOpts.edit.hittest, objOpts);
    document.getElementById("footerRightText").textContent = txt;

    //target line
    var target_line = document.getElementById("horizontal_target");
    target_line.style.top = event.clientY + "px";

    //move hole menu
    if(isHoleMenuDragging){
      const rectScroller = document.getElementById("scroller").getBoundingClientRect();
      const footerHeight = document.querySelector('footer').offsetHeight || 0;
      const holeMenu = document.querySelector('.hole_menu');
      const dx = mouseX - mousePos[0];
      const dy = mouseY - mousePos[1];

      const currentRight = parseFloat(getComputedStyle(holeMenu).right);
      const currentBottom = parseFloat(getComputedStyle(holeMenu).bottom);
      const newRight = currentRight - dx;
      const newBottom = currentBottom - dy;

      const menuRect = holeMenu.getBoundingClientRect();
      const maxRight = rectScroller.width - menuRect.width;
      const maxBottom = rectScroller.height - menuRect.height + footerHeight;

      holeMenu.style.right = `${Math.min(Math.max(newRight, 0), maxRight)}px`;
      holeMenu.style.bottom = `${Math.min(Math.max(newBottom, 0), maxBottom)}px`;
    }

    //update mouse position
    mousePos = [mouseX, mouseY];
  });
  document.querySelector('.hole_menu').addEventListener('mousedown', (e) => {
    isHoleMenuDragging = true;
  });
  document.addEventListener('mouseup', () => {
    isHoleMenuDragging = false;
  });
  //============================================================================================
  //scroll event
  scroller.addEventListener("scroll",async function (event) {
    //console.log("[SCROLL]", { left: scroller.scrollLeft, top: scroller.scrollTop });

    //hittest
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mousePos[0], mousePos[1], LCCore, objOpts)));
    objOpts.edit.hittest = ht;

    const txt = await getFooterInfo(LCCore, objOpts.edit.hittest, objOpts);
    document.getElementById("footerRightText").textContent = txt;

    ///scroller position
    canvasPos[0] = scroller.scrollLeft;//* xMag;
    canvasPos[1] = scroller.scrollTop;//* yMag;

    //update plot
    updateView();
  },
  { passive: false }
  );
  //============================================================================================
  //Scroll + Alt (zoom)
  /*
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
        objOpts.connection.tab_length = objOpts.hole.distance * 0.7;
        //objOpts.connection.tab_length += 0.015 * deltaY;
        if (objOpts.connection.tab_length < 0) {
          objOpts.connection.tab_length = 0;
        }
        if (objOpts.connection.tab_length > 20) {
          objOpts.connection.tab_length = 20;
        }

        //update plot
        updateView();
      }

      if (event.altKey) {
        event.preventDefault();

        const viewH = scroller.clientHeight;
        
        // Calculate the ratio of the "content" only, excluding the fixed offset
        const relative_scroll_pos_y = (scroller.scrollTop + viewH / 2 - canvasBase.offsetTop) / objOpts.canvas.zoom_level[1];
        const relative_scroll_pos_x = (scroller.scrollLeft - objOpts.canvas.pad_x) / scroller.scrollWidth;

        // add zoom level
        objOpts.canvas.zoom_level[0] += 0.01 * deltaX;
        if (event.ctrlKey) {
          objOpts.canvas.zoom_level[0] += 0.01 * deltaY;
        } else {
          objOpts.canvas.zoom_level[1] += 0.01 * deltaY;
        }

        // limit of smaller
        if (objOpts.canvas.zoom_level[1] < 0.1) {
          objOpts.canvas.zoom_level[1] = 0.1;
        }
        if (objOpts.canvas.zoom_level[0] < 0.1) {
          objOpts.canvas.zoom_level[0] = 0.1;
        }

        // calc new canvas size
        makeP5CanvasBase();
        const canvasBase_width  = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);
        // canvasBase_height is maintained as an existing variable

        // get new scroll pos
        const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x + objOpts.canvas.pad_x;
        
        // Calculate position with the new zoom level and add back the fixed offset
        const new_scroll_pos_y = (relative_scroll_pos_y * objOpts.canvas.zoom_level[1]) - (viewH / 2) + canvasBase.offsetTop;

        // MOVE
        scroller.scrollTo(new_scroll_pos_x, new_scroll_pos_y);

        // update data
        canvasPos = [new_scroll_pos_x, new_scroll_pos_y];

        // update plot
        updateView();
      }
    },
    { passive: false }
  );
  */

  document.addEventListener("wheel", function (event) {
      // 1. Setup Variables
      var deltaX = event.deltaX;
      var deltaY = event.deltaY;

      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
      const USE_TOUCHPAD_MODE = !!(objOpts.canvas && objOpts.canvas.use_touchpad_mode);

      // Unified zoom direction (deltaY < 0 => zoom in)
      const ZOOM_SIGN = -1;

      // Pinch heuristic
      const isPinch =
        event.ctrlKey &&
        event.deltaMode === 0 &&
        Math.abs(deltaY) < 50;
      const gain = isPinch ? 0.02 : 0.01;

      // Common helper for distance adjustment
      const updateHoleDistance = (delta) => {
        objOpts.hole.distance += 0.01 * delta;
        objOpts.connection.tab_length = objOpts.hole.distance * 0.7;

        //if (objOpts.hole.distance < 0.1) objOpts.hole.distance = 0.1;
        if (objOpts.connection.tab_length < 0) objOpts.connection.tab_length = 0;
        if (objOpts.connection.tab_length > 20) objOpts.connection.tab_length = 20;

        updateView();
      };

      // ============================================================
      // MODE A: TOUCHPAD MODE
      // ============================================================
      if (USE_TOUCHPAD_MODE) {

        // ---- 1. Zoom Logic (Ctrl is pressed) ----
        // Handle both Ctrl-only (vertical) and Ctrl+Alt (horizontal) here
        if (event.ctrlKey) {
          event.preventDefault();

          const viewH = scroller.clientHeight;
          const rect = scroller.getBoundingClientRect();
          const mouseX = event.clientX - rect.left;

          // [Step A] Calculate Anchors
          const relative_pos_y =
            (scroller.scrollTop + viewH / 2 - canvasBase.offsetTop) / objOpts.canvas.zoom_level[1];

          const relative_ratio_x =
            (scroller.scrollLeft + mouseX - objOpts.canvas.pad_x) / scroller.scrollWidth;

          // [Step B] Apply Zoom
          if (event.altKey) {
            // Ctrl + Alt: zoom in X direction (horizontal zoom)
            objOpts.canvas.zoom_level[0] += ZOOM_SIGN * gain * deltaY;
            if (objOpts.canvas.zoom_level[0] < 0.1) objOpts.canvas.zoom_level[0] = 0.1;
          } else {
            // Ctrl only: zoom in Y direction (vertical zoom)
            objOpts.canvas.zoom_level[1] += ZOOM_SIGN * gain * deltaY;
            if (objOpts.canvas.zoom_level[1] < 0.1) objOpts.canvas.zoom_level[1] = 0.1;
          }

          // [Step C] Render & Restore
          makeP5CanvasBase();
          const canvasBase_width = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);

          const new_scroll_pos_x =
            (canvasBase_width * relative_ratio_x) - mouseX + objOpts.canvas.pad_x;

          const new_scroll_pos_y =
            relative_pos_y * objOpts.canvas.zoom_level[1] - viewH / 2 + canvasBase.offsetTop;

          scroller.scrollTo(new_scroll_pos_x, new_scroll_pos_y);
          canvasPos = [new_scroll_pos_x, new_scroll_pos_y];

          updateView();
        }

        // ---- 2. Hole Distance (Alt Only) ----
        // When Ctrl is not pressed and Alt is pressed
        else if (event.altKey) {
          event.preventDefault();
          updateHoleDistance(deltaY);
        }

        // ---- 3. Horizontal Scroll (Shift) ----
        else if (event.shiftKey) {
          event.preventDefault();
          const d = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
          scroller.scrollBy({ left: d, behavior: "auto" });
        }

        return;
      }

      // ============================================================
      // MODE B: LEGACY MODE (Mouse Wheel Optimized)
      // ============================================================

      // Enable horizontal zoom with Ctrl+Alt in legacy mode as well
      if (event.ctrlKey && event.altKey) {
        event.preventDefault();
        // Horizontal zoom logic (simplified)
        objOpts.canvas.zoom_level[0] += ZOOM_SIGN * 0.01 * deltaY;
        if (objOpts.canvas.zoom_level[0] < 0.1) objOpts.canvas.zoom_level[0] = 0.1;

        makeP5CanvasBase();
        updateView(); // legacy mode: simple refresh
      }
      // Alt only -> distance adjustment
      else if (event.altKey) {
        event.preventDefault();
        updateHoleDistance(deltaY);
      }
      // Ctrl only -> horizontal scroll
      else if (event.ctrlKey) {
        event.preventDefault();
        scroller.scrollBy({ left: deltaY * 1, behavior: "auto" });
      }
      // Shift/Cmd -> distance adjustment (keep existing behavior)
      else if ((!isMac && event.shiftKey) || (isMac && event.metaKey)) {
        event.preventDefault();
        const d = isMac ? (Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY) : deltaY;
        updateHoleDistance(d);
      }
    },
    { passive: false }
  );

  
  //============================================================================================
  //YAxis dropdown changed event
  document.getElementById("YAxisSelect").addEventListener("change", async (event) => {
    console.log(`Selected: ${event.target.value}`);
    objOpts.canvas.depth_scale = event.target.value;
    var mouseX = scroller.scrollLeft;
    var mouseY = scroller.scrollTop;

    //update plot
    updateView();

    //update images
    //if(Object.keys(modelImages[event.target.value]).length==0){
      //load images
    //  modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth", event.target.value]); 
    //}

    //updateView();

  });
  //============================================================================================
  document.addEventListener("keydown", async (event) => {
    //F12 => Dev tool
    if (event.key === "F12") {
      window.LCapi.toggleDevTools("main");
    }

    
    // Ctrl + Z => Undo model
    if (event.ctrlKey && event.key === "z") {
      event.preventDefault();
      const result = await undo("undo");//undo
      if(result == true){
        const selected_age_model_id = document.getElementById("AgeModelSelect").value;

        await loadModel(false,false);
        await loadAge(selected_age_model_id);
        await loadPlotData("age");
        await loadPlotData("data")
          
        console.log("[Renderer]: Undo model");
        console.log(LCCore);
  
        //update plot
        updateView();
      }
    }

    // Ctrl + R => Redo model
    if (event.ctrlKey && event.shiftKey && (event.key === "z" || event.key === "Z")) {
      event.preventDefault();
      const result = await undo("redo");//undo
      if(result == true){
        const selected_age_model_id = document.getElementById("AgeModelSelect").value;

        await loadModel(false, false);
        await loadAge(selected_age_model_id);
        await loadPlotData("age");
        await loadPlotData("data")
          
        console.log("[Renderer]: Redo model");
        console.log(LCCore);

        //update plot
        updateView();
      }
    }

    // Ctrl + 0 => zoom actual size
    if (event.ctrlKey && event.key === "1") {
      //zoom actural
      if (LCCore) {
        //update display dpcm
        const results = await window.LCapi.getDisplayInfo();
        const display_dpcm = results.height / objOpts.canvas.display_height; 

        objOpts.canvas.zoom_level = [display_dpcm/3, display_dpcm];
        objOpts.hole.distance = 1;
        
        //mouse position
        const relative_scroll_pos_x =
        scroller.scrollLeft / scroller.scrollWidth;
      const relative_scroll_pos_y =
        scroller.scrollTop / scroller.scrollHeight;
  
      //calc new canvas size
      makeP5CanvasBase();
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
    }

    // Ctrl + 0 => reset zoom leevel
    if (event.ctrlKey && event.key === "0") {
      //reset zoom
      if (LCCore) {
        objOpts.canvas.zoom_level = [4,3];
        objOpts.hole.distance = 20;
  
        
        //mouse position
        const relative_scroll_pos_x =
        scroller.scrollLeft / scroller.scrollWidth;
      const relative_scroll_pos_y =
        scroller.scrollTop / scroller.scrollHeight;
  
      //calc new canvas size
      makeP5CanvasBase();
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
    }
    //Shift +1/2 => add masterflag
    if(LCCore){
      if(objOpts.edit.editable){
        if(objOpts.edit.contextmenu_enable){
          if(event.ctrlKey && event.key ==="1"){
            //same of context menu
            objOpts.edit.contextmenu_enable = false;
            objOpts.edit.hittest = null;
            objOpts.edit.marker_from = null;
            objOpts.edit.marker_to = null;
            objOpts.edit.mode = "enable_master";
            objOpts.edit.handleMove = handleMarkerMouseMove;
            if(objOpts.edit.handleClick !== null){
              document.removeEventListener('click', objOpts.edit.handleClick);
              objOpts.edit.handleClick = null;
            }
            document.addEventListener("mousemove", objOpts.edit.handleMove);
          }else if(event.ctrlKey && event.key ==="0"){
            objOpts.edit.contextmenu_enable = false;
            objOpts.edit.hittest = null;
            objOpts.edit.marker_from = null;
            objOpts.edit.marker_to = null;
            objOpts.edit.mode = "disable_master";
            objOpts.edit.handleMove = handleMarkerMouseMove;
            if(objOpts.edit.handleClick !== null){
              document.removeEventListener('click', objOpts.edit.handleClick);
              objOpts.edit.handleClick = null;
            }
            document.addEventListener("mousemove", objOpts.edit.handleMove);
          }
        }
      }
    }

    // Ctrl + f => finder
    if (event.ctrlKey && event.key === "f") {
      document.getElementById("bt_finder").click();
    }
    
    // Ctrl + g => grid
    if (event.ctrlKey && event.key === "g") {
      document.getElementById("bt_grid").click();
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
    //console.log(objOpts.canvas)
    //get hole length
    let holes_top = Infinity;
    let holes_bottom = -Infinity;

    for (let p = 0; p < LCCore.projects.length; p++) {
      for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
        if(LCCore.projects[p].holes[h].sections.length == 0){
          continue
        }
        let hole_top = Infinity;
        let hole_bottom = -Infinity;
        for (let s = 0; s < LCCore.projects[p].holes[h].sections.length; s++) {
          const section_top_cd = LCCore.projects[p].holes[h].sections[s].markers[0][objOpts.canvas.depth_scale];
          if(section_top_cd!==null &&section_top_cd!==undefined&& hole_top > section_top_cd){
            hole_top = section_top_cd;
          }
          
          const section_bottom_cd = LCCore.projects[p].holes[h].sections[s].markers.slice(-1)[0][objOpts.canvas.depth_scale];
          if(section_bottom_cd!==null && section_bottom_cd!==undefined && hole_bottom<section_bottom_cd){
            hole_bottom = section_bottom_cd;
          } 
        }
        
        if (hole_top !== Infinity && hole_top !== null && holes_top > hole_top) {
          holes_top = hole_top;
        }
        if (hole_bottom !== -Infinity && hole_bottom !== null && holes_bottom < hole_bottom) {
          holes_bottom = hole_bottom;
        }
      }
    }

    if(holes_top == Infinity){
      holes_top = 0;
    }
    if(holes_bottom == -Infinity){
      holes_bottom = 1000;
    }

    holes_bottom += 200;

    objOpts.canvas.shift_y =  -1 * holes_top  + 50;

    //scale factor
    const dpir = objOpts.canvas.dpir; //window.devicePixelRatio || 1;

    const xMag = dpir * objOpts.canvas.zoom_level[0];
    let yMag   = dpir * objOpts.canvas.zoom_level[1];
    const pad_x = objOpts.canvas.pad_x;
    let pad_y   = objOpts.canvas.pad_y;
    if (objOpts.canvas.depth_scale == "age") {
      yMag  = yMag * objOpts.canvas.age_zoom_correction[0];
      pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
    }

    //get shift amounts
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;

    //initialise off screan canvas
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

    const bottom_padding = 100;

    let canvasBaseWidth  = parseInt(objOpts.project.pad_x*3+(objOpts.hole.distance + objOpts.hole.width + shift_x) * (num_total_holes + 1) * xMag + pad_x + 500);
    let canvasBaseHeight = parseInt(objOpts.project.pad_y*3+(holes_bottom + bottom_padding - holes_top + shift_y + objOpts.canvas.bottom_pad) * yMag + pad_y);

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

    return {width: canvasBaseWidth, height:canvasBaseHeight}
  }

  //m,ain canvas(vector)
  const p5Sketch = (sketch) => {
    //setup p5 canvas instance forma=======================================================================
    sketch.setup = () => {
      let sketchCanvas = null;
      let w, h;

      if (objOpts.edit.is_full_snapshot) {
        w = scroller.scrollWidth;
        h = scroller.scrollHeight;
      } else {
        w = scroller.clientWidth;
        h = scroller.clientHeight;
      }

      if (isSVG) {
        sketchCanvas = sketch.createCanvas(w, h, sketch.SVG);
      } else {
        sketchCanvas = sketch.createCanvas(w, h, sketch.P2D);
      }

      sketch.strokeWeight(2);
      sketch.stroke("#ED225D");

      sketchCanvas.parent("p5Canvas");
      sketch.noLoop();
    };

    //draw data=============================================================================================
    //console.log(canvasBase.style)
    
    sketch.draw = () => {
      //sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
      //back ground
      sketch.background(objOpts.canvas.background_colour);

      //translate plot position 
      sketch.push(); //save
      
      //under construction
      //sketch.translate(scroller.clientWidth, scroller.clientHeight);
      //sketch.rotate(-Math.PI / 2);

      sketch.translate(-canvasPos[0], -canvasPos[1]); //if you want revers move

      //calc draw area
      const view_rect = {
        x: scroller.scrollLeft,
        y: scroller.scrollTop,
        width: window.innerWidth,
        height: window.innerHeight,
      };


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

      const scrollerLeftRealScale  = (scroller.scrollLeft - pad_x) / xMag - shift_x;//cm
      const scrollerRightRealScale = (scroller.scrollLeft + window.innerWidth - pad_x) / xMag - shift_x;//cm
      const scrollerTopRealScale   = (scroller.scrollTop - pad_y) / yMag - shift_y;//cm
      const scrollerBotRealScale   = (scroller.scrollTop + window.innerHeight - pad_y) / yMag - shift_y;//cm
      const xBufferVal = (scrollerRightRealScale-scrollerLeftRealScale) * objOpts.canvas.buffer_width * xMag;
      const yBufferVal = (scrollerBotRealScale-scrollerTopRealScale) * objOpts.canvas.buffer_depth * yMag;
      
      //-----------------------------------------------------------------------------------------
      //draw grid
      if (LCCore && objOpts.canvas.is_grid_visible) {
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
        sketch.fill("#000000");
        sketch.noStroke(); // sketch.stroke("#000000");
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

        const gridStartY = (0 + shift_y) * yMag + pad_y; //pix scroller.scrollTop;
        let age_mod = 1;
        try {
          if (objOpts.canvas.depth_scale == "age") {
            age_mod = objOpts.canvas.age_zoom_correction[0];
          }
        } catch (err){
          console.error(err)
          alert("An unexpected error occurred. The LC cache or temporary files may be corrupted.");

          return
        }
        
        const gridStepY = fitScaler(objOpts.canvas.zoom_level[1], yMag / age_mod); //pix

        //const gridMaxY = parseInt(canvasBase.style.height.match(/\d+/)[0], 10);
        //const gridMaxX = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);
        const gridMaxY = parseInt(getComputedStyle(canvasBase).height, 10);
        const gridMaxX = parseInt(getComputedStyle(canvasBase).width, 10);


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
        
        //ygrid downward from zero
        for (let y = gridStartY; y < gridMaxY; y += gridStepY) {
          const grid_rect = {
            x: 120,
            y: y,
            width: gridMaxX - 120,
            height: 1,
          };
          if(!objOpts.edit.is_full_snapshot){
            if (!isInside(view_rect, grid_rect, [xBufferVal, yBufferVal])) {
              continue;
            }
          }
          
          //grid
          sketch.drawingContext.setLineDash([]);
          sketch.strokeWeight(objOpts.canvas.grid_width);
          sketch.stroke(objOpts.canvas.grid_colour);
          sketch.line(120, y, gridMaxX, y);
        
          //label
          const tickLabel = txt(tickType, y);
          const tickWidth = ctx.measureText(tickLabel).width;
          sketch.fill("#000000");
          sketch.noStroke(); // sketch.stroke("#000000");
          sketch.textFont("Arial");
          sketch.textSize("20px");
          sketch.text(tickLabel, scroller.scrollLeft + 50, y + 8);
        }

        for (let y = gridStartY; y > gridMinY; y -= gridStepY) {
          const grid_rect = {
            x: 120,
            y: y,
            width: gridMaxX - 120,
            height: 1,
          };
          if(!objOpts.edit.is_full_snapshot){
            if (!isInside(view_rect, grid_rect, [xBufferVal,yBufferVal])) {
              continue;
            }
          }
      
          //grid
          sketch.drawingContext.setLineDash([]);
          sketch.strokeWeight(objOpts.canvas.grid_width);
          sketch.stroke(objOpts.canvas.grid_colour);
          sketch.line(120, y, gridMaxX, y);

          //label
          const tickLabel = txt(tickType, y);
          const tickWidth = ctx.measureText(tickLabel).width;
          sketch.fill("#000000");
          sketch.noStroke(); // sketch.stroke("#000000");
          sketch.textFont("Arial");
          sketch.textSize("20px");
          sketch.text(tickLabel, scroller.scrollLeft + 50, y + 8);
        }      
        
      }
      //-----------------------------------------------------------------------------------------

      //========================================================================================== 
      //========================================================================================== 
      //main
      let isBaseProjectMaster = false;
      const baseProjectIdx = getIdxById(LCCore, LCCore.base_project_id);
      //console.log(LCCore.base_project_id, baseProjectIdx) 
      if(LCCore.projects[baseProjectIdx[0]].model_type == "correlation"){
        isBaseProjectMaster = true;
      }      

      let num_disable = {total: 0, hole: 0};
      for (let p = 0; p < LCCore.projects.length; p++) {
        //make project objects===================================================================================
        const project = LCCore.projects[p];
        if(!LCCore.projects[p].enable){
          num_disable.hole += objOpts.project.interval;
        }


        //get position
        let prj_num_enable_right = 0;
              
        project.holes.forEach(hc=>{
          if(hc.enable){
            prj_num_enable_right++;
          }
        })
        
        /*
        let prj_num_enable_left = 0;
        LCCore.projects.filter(p=>p.order<project.order).forEach(p=>p.holes.forEach(h=>{if(h.enable){prj_num_enable_left++;}}))
        prj_num_enable_left += objOpts.project.interval * project.order;
        */

        const active_projects_before = LCCore.projects.filter(p => p.order < project.order && p.enable).length;
        let prj_num_enable_left = 0;
        LCCore.projects.filter(p => p.order < project.order).forEach(p => 
          p.holes.forEach(h => {
            if(h.enable){ prj_num_enable_left++; }
          })
        );
        prj_num_enable_left += objOpts.project.interval * active_projects_before;

        const prj_padx = objOpts.project.pad_x;//objOpts.hole.distance * xMag;
        const prj_pady = objOpts.project.pad_y;
        const project_x0 = -prj_padx + ((objOpts.section.width + objOpts.hole.distance) * prj_num_enable_left + shift_x) * xMag + pad_x;
        const project_y0 = -prj_pady + (shift_y) * yMag + pad_y;
        let project_w  = prj_padx/2 + (objOpts.section.width + objOpts.hole.distance) * (prj_num_enable_right-1) * xMag + pad_x;
        if(project_w<=0){
          project_w = 100;
        }

        let project_h = 10000;
        let project_top = Infinity;
        let project_bot = -Infinity;

        for (let i = 0, n = project.holes.length; i < n; i++) {
          if (!project.holes[i].sections?.length) continue;
          if (!project.holes[i].sections[0]?.markers?.length) continue;
          if (!project.holes[i].sections[project.holes[i].sections.length - 1]?.markers?.length) continue;

          const vmin = project.holes[i].sections[0].markers[0][objOpts.canvas.depth_scale];
          if (vmin < project_top) project_top = vmin;

          const vmax = project.holes[i].sections[project.holes[i].sections.length - 1]
            .markers[project.holes[i].sections[project.holes[i].sections.length - 1].markers.length - 1][objOpts.canvas.depth_scale];
          if (vmax > project_bot) project_bot = vmax;
        }

        if(project_top !== Infinity && project_bot !== -Infinity){
          project_h = 2*prj_pady + (project_bot - project_top) * yMag;
        }        
                
        if(project.enable == true){
          //show project name
          let projectDispName = project.name; 
          if(["root"].includes(objOpts.developer.mode)){
            projectDispName = project.id[0].slice(0,5);
          }
          
          sketch.drawingContext.setLineDash([]);
          sketch.fill(objOpts.project.font_colour);
          sketch.stroke(objOpts.project.font_colour);
          sketch.strokeWeight(2);
          sketch.textFont(objOpts.project.font);
          sketch.textSize(objOpts.project.font_size);
          sketch.text(
            projectDispName,
            project_x0 + 40,
            project_y0 + 40,
          ); 

          //show project area
          //check master project connection
          /*
          if(!isConnectMasterProject(LCCore, project.id) && ["user"].includes(objOpts.developer.mode)){
            objOpts.project.is_area_visible = true;
            objOpts.project.area_colour_disconnected = "#f96a6a";
          }
            */

          if(objOpts.project.is_area_visible){
            sketch.push();//save
            //check connection to base correlation model
            if(isBaseProjectMaster && isConnectMasterProject(LCCore, project.id)){
              //connected master model
              sketch.fill(objOpts.project.area_colour+"50");//HEX+alpha rate                            
            }else{
              //disconnected master model
              sketch.fill(objOpts.project.area_colour_disconnected+"50");//HEX+alpha rate
            }            
            sketch.noStroke();
            
            sketch.rect(project_x0, project_y0, project_w, project_h, 5, 5, 5, 5); //rounded
            sketch.pop();
          }          

          //live hittest
          if(objOpts.edit.hittest){
            //console.log(objOpts.edit.hittest.project, objOpts.edit.hittest.hole)
            if(["add_hole","delete_project","change_project_name","move_hole_to_project"].includes(objOpts.edit.mode)){
              if(objOpts.edit.hittest.project == project.id[0]){
                
                sketch.push();//save
                sketch.fill(0,0,0,0);
                sketch.strokeWeight(3);
                sketch.stroke("#ff0000");
                
                sketch.rect(project_x0, project_y0, project_w, project_h, 3, 3, 3, 3); //rounded
                sketch.pop();
              }
            }
          }
        }
        
                        
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
          let hole_top    = null;
          let hole_bottom = null;
          if(hole.sections.length!==0){
            hole_top = hole.sections[0].markers[0][objOpts.canvas.depth_scale];
            hole_bottom = hole.sections.slice(-1)[0].markers.slice(-1)[0][objOpts.canvas.depth_scale];
          }
          let hole_x0 = (objOpts.hole.distance + objOpts.hole.width) * (num_disable.total + hole.order - num_disable.hole);
          //add  hole name---------------------------------------------------
          let holeDispName = hole.name; 
          if(["root"].includes(objOpts.developer.mode)){
            holeDispName = hole.id[1].slice(0,5);
          }
          sketch.fill(objOpts.hole.font_colour);
          sketch.noStroke();
          sketch.textFont(objOpts.hole.font);
          sketch.textSize(objOpts.hole.font_size);
          sketch.text(
            holeDispName,
            // /(hole_x0 + shift_x + objOpts.hole.width * 0.3) * xMag + pad_x
            (hole_x0 + shift_x) * xMag + pad_x + objOpts.section.width * xMag /2 - sketch.textWidth(hole.name)/2,
            scroller.scrollTop + pad_y - 20,
            //(hole_top + shift_y) * yMag + pad_y - 20
          );
          
          //check position --------------------------------------------------
          // draw empty hole line
          if (hole_top == null && hole_bottom == null) { 
            let Htop = 0;
            let Hbot = 2000;
            if(project.composite_depth_top !== null){
              Htop = project.composite_depth_top;
            }
            if(project.composite_depth_bottom !== null){
              Hbot = project.composite_depth_bottom;
            }       
            sketch.push();
            sketch.drawingContext.setLineDash([5, 5]);
            sketch.strokeWeight(objOpts.hole.line_width);
            sketch.stroke(objOpts.hole.line_colour);
            sketch.line(
              (hole_x0 + shift_x + objOpts.hole.width / 2) * xMag + pad_x, //if centre, + objOpts.hole.width / 2
              (Htop + shift_y) * yMag + pad_y,
              (hole_x0 + shift_x + objOpts.hole.width / 2) * xMag + pad_x,
              (Hbot + shift_y) * yMag + pad_y,
            );
            sketch.pop();
          }

          //finder target lines---------------------------------------------------
          //draw finder target line

          if(finderEnable){
            sketch.push();      
            //fix position
            let finder_pos_y = objOpts.interface.finder_data[objOpts.canvas.depth_scale];
            const target_y = (finder_pos_y + shift_y) * yMag + pad_y;
            //const target_x0 = 140;//for full
            //const target_x1 = (hole_x1 + shift_x + objOpts.hole.width / 2) * xMag + pad_x;//for full
          
            const target_x0 = ((hole_x0 + shift_x) - (objOpts.hole.distance/2)) * xMag + pad_x;
            const target_x1 = target_x0 +(objOpts.hole.width + objOpts.hole.distance) * xMag; 

            if(objOpts.canvas.depth_scale =="drilling_depth"){
              if(hole.id[1]==objOpts.interface.finder_data.trinity.holeId[1]){
                sketch.strokeWeight(1);
                sketch.stroke(objOpts.canvas.finder_colour);
                sketch.line(
                  target_x0,
                  target_y,
                  target_x1,
                  target_y
                );
              }
            }else{
              sketch.strokeWeight(1);
              sketch.stroke(objOpts.canvas.finder_colour);
              sketch.line(
                target_x0,
                target_y,
                target_x1,
                target_y
              );
            }

            //(hole_x0 + shift_x) * xMag + pad_x;
            //let hole_x0 = (objOpts.hole.distance + objOpts.hole.width) * (num_disable.total + hole.order - num_disable.hole);
            
            /*
            sketch.fill("#ff0000");
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
            */
            sketch.pop();
          }
          
          if(objOpts.canvas.is_model_visible){
            //get plot order for hit test--------------------------------------
            let section_plot_order = [];
            for (let i = 0; i < hole.sections.length; i++) {
              section_plot_order.push([i, hole.sections[i].order]);
            }
            section_plot_order.sort((a, b) => a[1] - b[1]);

            //show live hitttest
            if(objOpts.edit.hittest){
              if(objOpts.edit.hittest.project == hole.id[0] && objOpts.edit.hittest.hole == hole.id[1]){
                if(["change_hole_name","delete_hole","add_section"].includes(objOpts.edit.mode)){
                  let hole_bottom_e = null;
                  if(hole_bottom == null){
                    if(project.composite_depth_bottom !== null){
                      hole_bottom_e = project.composite_depth_bottom;
                    }else{
                      hole_bottom_e = 1000;
                    }
                    
                  }else{
                    hole_bottom_e = hole_bottom;
                  }
                  
                  sketch.push();//save
                  sketch.fill(0,0,0,0);
                  sketch.strokeWeight(3);
                  sketch.stroke("#ff0000");
                  const hole_ht_x0 = (hole_x0 + shift_x) * xMag + pad_x - 3;
                  const hole_ht_y0 = (hole_top + shift_y) * yMag + pad_y - 3;
                  const hole_ht_w  = objOpts.section.width * xMag + 6;
                  const hole_ht_h  = (hole_bottom_e - hole_top) * yMag + 6;
                  //console.log(hole_ht_x0,hole_ht_y0,hole_ht_w,hole_ht_h)
                  sketch.rect(hole_ht_x0, hole_ht_y0, hole_ht_w, hole_ht_h, 3, 3, 3, 3); //rounded
                  sketch.pop();
                }
              }
            }

            for (let s_o = 0; s_o < hole.sections.length; s_o++) {
              const s = section_plot_order[s_o][0];

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
              if(!objOpts.edit.is_full_snapshot){
                if (!isInside(view_rect, sec_rect, [xBufferVal,yBufferVal])) {
                  continue;
                }
              }
              
              //sketch.drawingContext.setLineDash([]);
              sketch.strokeWeight(objOpts.section.line_width);
              sketch.stroke(objOpts.section.line_colour);
              sketch.fill(objOpts.section.face_colour);

              //hittest
              if(objOpts.edit.hittest){
                if(["change_section_name","delete_section","connect_section", "disconnect_section"].includes(objOpts.edit.mode)){
                  if(objOpts.edit.hittest.hole == hole.id[1] && objOpts.edit.hittest.section == section.id[2]){
                    sketch.strokeWeight(3);
                    sketch.stroke("#ff0000");
                  }               
                }
              }
              //if selected
              if(objOpts.edit.section_from !== null){
                if(objOpts.edit.section_from.project == section.id[0] && objOpts.edit.section_from.hole == section.id[1] && objOpts.edit.section_from.section == section.id[2]){
                  sketch.strokeWeight(3);
                  sketch.stroke("#008000");
                }
              }
              
              
              sketch.rect(sec_x0, sec_y0, sec_w, sec_h, 3, 3, 3, 3); //rounded

              //check zoom level for ignoring plot markers
              if (objOpts.canvas.zoom_level[1] < objOpts.marker.ignore_zoom_level) {
                continue;
              }

              //add section photo-------------------------------------------------
              let isPhtoExist = false;
              if (objOpts.canvas.is_core_photo_visible) {
                try {
                  let ptoto_depth_scale;
                    ptoto_depth_scale = objOpts.canvas.depth_scale;
                
                  if (modelImages[ptoto_depth_scale][hole.name + "-" + section.name] !== undefined) {
                    isPhtoExist = true;
                  }

                  if (isPhtoExist) {
                    try {
                      const img = modelImages[ptoto_depth_scale][hole.name + "-" + section.name];
                      sketch.image(
                        img,
                        sec_x0,
                        sec_y0,
                        sec_w,
                        sec_h
                      );
                      if(objOpts.image.is_core_photo_visible && modelImages.plot_colour[hole.name + "-" + section.name]){
                        const getWidth = 10;
                        const scanWidth = (getWidth*2)+1;
                        const imCx = img.width / 2;
                        const px = img.get(imCx-getWidth, 0, scanWidth, img.height);
                        px.loadPixels();

                        sketch.noFill();
                        sketch.stroke(objOpts.image.photo_plot_colour); 
                        sketch.beginShape(); 
                        
                        for (let y = 0; y < img.height; y++) {
                          let rSum = 0, gSum = 0, bSum = 0;

                          for (let x = 0; x < scanWidth; x++) {
                            const i = (y * scanWidth+ x) * 4;
                            rSum += px.pixels[i];
                            gSum += px.pixels[i + 1];
                            bSum += px.pixels[i + 2];
                          }

                          const rAvg = rSum / scanWidth;
                          const gAvg = gSum / scanWidth
                          const bAvg = bSum / scanWidth;

                          const L = (0.2126 * rAvg + 0.7152 * gAvg + 0.0722 * bAvg) * (100 / 255);

                          const impy = sec_y0 + (y /img.height) *  sec_h;
                          const impx = sec_x0 + (L / 100) * sec_w

                          sketch.vertex(impx, impy);
                        }
                        sketch.endShape();

                      }
                    } catch (error) {
                      console.error(error);
                      console.log(modelImages[ptoto_depth_scale][hole.name + "-" + section.name]);
                    }
                  }
                } catch (err) {
                  console.error(err)
                }
              }

              //add section name-------------------------------------------------
              let secDispName = hole.name + "-" + section.name; 
              if(["root"].includes(objOpts.developer.mode)){
                secDispName = section.id[2].slice(0,5);
              }

              sketch.fill(objOpts.section.font_colour);
              sketch.noStroke();
              sketch.textFont(objOpts.section.font);
              sketch.textSize(objOpts.section.font_size); 
              sketch.push();
              sketch.translate(
                (hole_x0 + shift_x) * xMag + pad_x + objOpts.section.font_pos_x, //-10
                (section_mid + shift_y) * yMag + pad_y + sketch.textWidth(secDispName)/2
              );
              sketch.rotate((objOpts.section.font_angle / 180) * Math.PI);
              sketch.text(secDispName, 0, 0);
              sketch.pop();

              //make marker objects=================================================================================
              let msaterDirection = "none";
              for (let m = 0; m < section.markers.length; m++) {
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
                if (!objOpts.canvas.is_event_expanded) {
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
                    sketch.fill(objOpts.event.face_colour[event[3]]);
                    sketch.noStroke();
                    sketch.stroke(objOpts.event.face_colour[event[3]]);
                    sketch.rect(
                      (hole_x0 + shift_x) * xMag + pad_x + (objOpts.section.line_width+2)/2,
                      (lowerDepth + shift_y) * yMag + pad_y,
                      objOpts.section.width * ew * xMag - objOpts.section.line_width-2,
                      eventThickness * yMag * objOpts.event.face_height,
                      1,1,1,1 //rounded option
                    );
                  }
                }
                
                //live hittest
                if(objOpts.edit.hittest){
                  if(["add_event","delete_event"].includes(objOpts.edit.mode)){
                    const uid = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole, objOpts.edit.hittest.section, objOpts.edit.hittest.upper_marker];
                    const lid = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole, objOpts.edit.hittest.section, objOpts.edit.hittest.lower_marker];
                    if(marker.id.toString() == lid.toString()){
                      const upper_depth = section.markers.filter((m)=>m.id.toString()==uid.toString())[0][objOpts.canvas.depth_scale];
                      const lower_depth = marker[objOpts.canvas.depth_scale];
                      sketch.push()
                      sketch.noFill();
                      sketch.stroke("#ff0000");
                      sketch.strokeWeight(3);
                      sketch.rect(
                        (hole_x0 + shift_x) * xMag + pad_x + 3,
                        (upper_depth + shift_y) * yMag + pad_y,
                        objOpts.section.width * ew * xMag - 6,
                        ((lower_depth-upper_depth)) * yMag,
                        1,1,1,1 //rounded option
                      );
                      sketch.pop()
                    }
                  }
                }

                //make marker objects=================================================================================
                // remove top and bottom markers
                
                //draw markers
                sketch.drawingContext.setLineDash([]);
                sketch.strokeWeight(objOpts.marker.line_width);
                let topBot = 0;
                               
                if(objOpts.canvas.is_core_photo_visible){
                  sketch.stroke("Magenta"); //(markerLineColour);
                  if (m == 0 || m == section.markers.length - 1) {
                    topBot -= objOpts.marker.width * xMag; //or +20
                    sketch.strokeWeight(objOpts.marker.line_width*3);
                  } 
                }else{
                  sketch.stroke(objOpts.marker.line_colour); //(markerLineColour);
                }
                
                let mw = 1;
                
                if (!objOpts.canvas.is_event_expanded) {
                  mw = objOpts.event.folded_width;
                }

                //check reversed
                if(objOpts.marker.is_reverse_highlighted){
                  if(m!==0){
                    if(section.markers[m-1][objOpts.canvas.depth_scale] > marker[objOpts.canvas.depth_scale]){
                      sketch.stroke("Cyan"); 
                      sketch.strokeWeight(objOpts.marker.line_width * 5);
                    }
                  }

                }
                
                //----------------------------------------------------------------------------------------------------------------------------------
                //show hittest
                if(objOpts.edit.editable){
                  //live hittest
                  if(objOpts.edit.hittest !== null){
                    if(["connect_marker","disconnect_marker", "delete_marker","change_marker_name","change_marker_distance","set_zero_point","enable_master","disable_master"].includes(objOpts.edit.mode)){
                      const hitId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole, objOpts.edit.hittest.section, objOpts.edit.hittest.nearest_marker];
                      if(Math.abs(objOpts.edit.hittest.nearest_distance) < objOpts.edit.sensibility){
                        if(hitId.toString() == marker.id.toString()){
                          sketch.strokeWeight(3);
                          sketch.stroke("#ff0000");
                        }
                      }
                    } else if(objOpts.edit.mode == "add_marker"){
                      if(objOpts.edit.hittest.project == project.id[0] && objOpts.edit.hittest.hole == hole.id[1] && objOpts.edit.hittest.section == section.id[2]){
                        sketch.push();//save
                        sketch.strokeWeight(1);
                        sketch.stroke("#ff0000");
                        sketch.line(
                          (hole_x0 + shift_x) * xMag + pad_x,
                          sketch.mouseY+scroller.scrollTop, //(marker_top + shift_y) * yMag + pad_y,
                          (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * xMag,// + topBot,
                          sketch.mouseY+scroller.scrollTop, //(marker_top + shift_y) * yMag + pad_y
                        )
                        sketch.pop();//load
                      }
                    }
                  } 

                  if(objOpts.edit.marker_from !== null && ["connect_marker", "delete_marker", "disconnect_marker"].includes(objOpts.edit.mode)){
                    const hitId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
                    if(hitId.toString() == marker.id.toString()){
                      sketch.strokeWeight(3);
                      sketch.stroke("#ff0000");

                      if(objOpts.edit.marker_to == null){
                        //console.log(objOpts.edit);

                        let ex0 = (hole_x0 + shift_x) * xMag + pad_x;
                        let ey0 = (marker_top + shift_y) * yMag + pad_y;
                        let ex1 = sketch.mouseX + scroller.scrollLeft;
                        let ey1 = sketch.mouseY+scroller.scrollTop;
                        
                        //mouse position is righ/left of "from hole"
                        if((sketch.mouseX + scroller.scrollLeft) > ((hole_x0 + shift_x) * xMag + pad_x + (objOpts.marker.width * mw * xMag)/2)){
                          ex0 = (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * mw * xMag;
                        }

                        //if hit second marker
                        if(objOpts.edit.hittest.marker !== null){
                          //under construction
                        }
                        
                        sketch.line(ex0,ey0,ex1,ey1);
                      }
                    }
                  }
                  if(objOpts.edit.marker_to !== null){
                    const hitId = [objOpts.edit.marker_to.project, objOpts.edit.marker_to.hole, objOpts.edit.marker_to.section, objOpts.edit.marker_to.nearest_marker];
                    if(hitId.toString() == marker.id.toString()){
                      sketch.strokeWeight(3);
                      sketch.stroke("#ff0000");
                    }
                  }
                }
                //----------------------------------------------------------------------------------------------------------------------------------
                //drow marker line
                const marker_x0 = (hole_x0 + shift_x) * xMag + pad_x;
                const marker_y0 = (marker_top + shift_y) * yMag + pad_y;
                const marker_w  = (objOpts.marker.width * mw * xMag);
                let relative_marker_x0 = 0;
                if (isPhtoExist) {
                  relative_marker_x0 = marker.definition_relative_x;
                }
                sketch.line(
                  marker_x0 + marker_w * relative_marker_x0,
                  marker_y0,
                  marker_x0 + marker_w,// + topBot,
                  marker_y0,                  
                );

                //add master section-----------------------------------------
                const curreM = countMaster(LCCore, marker, "project");   
                const lowerM = countMaster(LCCore, section.markers[m + 1], "project");   

                if(curreM.own == 1){
                  if(curreM.horizontal==0){
                    //horizontal marker is NOT master
                    if(lowerM.own == 1){
                      msaterDirection = "vertical";
                    }else{
                      msaterDirection = "none";
                    }
                  }else if(curreM.horizontal==1){
                    //horizontal marker is master
                    if(lowerM.own == 0){
                      //lower marker is NOT master
                      msaterDirection = "horizontal";
                    }else{
                      //lower marker is also master


                      if(msaterDirection=="none" || msaterDirection=="horizontal"){
                        //master come from hconnection or startpoint or parallel section
                        msaterDirection = "vertical";
                      }else if(msaterDirection=="vertical"){
                        //master come from vconnection
                        msaterDirection = "horizontal";
                      }
                    }
                  }else{
                    //unsuspected case (master marker>=3)
                    msaterDirection = "none";
                  }
                }else{
                  msaterDirection = "none";
                }

                if(msaterDirection == "vertical"){
                  //plot
                  sketch.drawingContext.setLineDash([]);
                  sketch.strokeWeight(objOpts.connection.master_section_line_width);                    
                  sketch.stroke(objOpts.connection.base_master_section_colour); //(markerLineColour);
                  if(project.model_type == "duo"){
                    sketch.stroke(objOpts.connection.duo_master_section_colour);
                  }

                  const next_marker_top = section.markers[m + 1][objOpts.canvas.depth_scale];
                  sketch.line(
                    (hole_x0 + shift_x) * xMag + pad_x,
                    (marker_top + shift_y) * yMag + pad_y,
                    (hole_x0 + shift_x) * xMag + pad_x,
                    (next_marker_top + shift_y) * yMag + pad_y
                  );

                  
                }

                if(objOpts.connection.is_source_visible){
                    //data depth source arrow
                    sketch.push();
                    sketch.drawingContext.setLineDash([]);
                    sketch.strokeWeight(1);                    
                    sketch.stroke("white");
                    sketch.fill("white");
                    if(marker.depth_source[1] || marker.depth_source[2]){
                      if(section.markers[m - 1] && marker.depth_source[1]){
                        const upper_source = getDataFromId(LCCore, marker.depth_source[1]);
                        if(upper_source  && section.markers[m - 1].id[1] === marker.depth_source[1][1]){
                          const before_marker_top = upper_source[objOpts.canvas.depth_scale];
                          //sec_w - 10
                          sketch.line(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (marker_top + shift_y) * yMag + pad_y,
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (before_marker_top + shift_y) * yMag + pad_y
                          );
                          sketch.line(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (marker_top + shift_y) * yMag + pad_y,
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7 + 5,
                            (marker_top + shift_y) * yMag + pad_y - 10
                          );
                          sketch.line(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (marker_top + shift_y) * yMag + pad_y,
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7 -5,
                            (marker_top + shift_y) * yMag + pad_y - 10
                          );
                          sketch.ellipse(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (before_marker_top + shift_y) * yMag + pad_y,
                            3
                          );
                        }                    
                      }

                      if(section.markers[m + 1] && marker.depth_source[2]){
                        const lower_source = getDataFromId(LCCore, marker.depth_source[2]);
                        if(lower_source && section.markers[m + 1].id[1] === marker.depth_source[2][1]){     
                          const next_marker_top = lower_source[objOpts.canvas.depth_scale];                 
                          sketch.line(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (marker_top + shift_y) * yMag + pad_y,
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (next_marker_top + shift_y) * yMag + pad_y
                          );
                          sketch.line(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7 + 5,
                            (marker_top + shift_y) * yMag + pad_y + 10,
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (marker_top + shift_y) * yMag + pad_y
                          );
                          sketch.line(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7 -5,
                            (marker_top + shift_y) * yMag + pad_y + 10,
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (marker_top + shift_y) * yMag + pad_y
                          );
                          sketch.ellipse(
                            (hole_x0 + shift_x) * xMag + pad_x + sec_w *0.7,
                            (next_marker_top + shift_y) * yMag + pad_y,
                            3
                          );
                        }                     
                      }
                    }     
                    sketch.pop();             
                  }

                //add rank marker-------------------------------------------
                if (objOpts.marker.is_rank_visible) {
                  sketch.fill("#000000");
                  sketch.noStroke();
                  sketch.textFont("Arial");
                  sketch.textSize(15);
                  let rank_name = "null";
                  if (marker.connection_rank != null){
                    //1111111111111111
                  // rank_name = marker.depth_source[0];//marker.connection_rank.toString();
                  rank_name = marker.connection_rank.toString();
                  }
                  sketch.text(
                    rank_name,
                    (hole_x0 + shift_x) * xMag + pad_x + 10,//- 23,
                    (marker_top + shift_y) * yMag + pad_y + 5
                  );


                  //connection rank
                  if (marker.connection_rank == null) {
                    sketch.fill("#000000");
                  } else if (marker.connection_rank > 4) {
                    sketch.fill("#A52A2A");
                  } else {
                    sketch.fill(
                      objOpts.marker.rank_colours[marker.connection_rank]
                    );
                  }
                  sketch.ellipse(
                    (hole_x0 + shift_x) * xMag + pad_x,
                    (marker_top + shift_y) * yMag + pad_y,
                    9
                  );

                  //master flag
                  if (marker.isMaster){
                    sketch.noFill();
                    sketch.stroke("#0000FF");
                    
                    sketch.strokeWeight(2); 
                    sketch.ellipse(
                      (hole_x0 + shift_x) * xMag + pad_x,
                      (marker_top + shift_y) * yMag + pad_y,
                      17
                    );
                    if (marker.isZeroPoint!==false){
                      sketch.noFill();
                      sketch.stroke("Cyan");
                      sketch.strokeWeight(3); 
                      sketch.ellipse(
                        (hole_x0 + shift_x) * xMag + pad_x,
                        (marker_top + shift_y) * yMag + pad_y,
                        25
                      );
                    }
                  }  
                  
                  if(["root"].includes(objOpts.developer.mode)){
                    //data source is dirrerent project
                    if(
                      marker.depth_source[1] && 
                      marker.depth_source[1][0] !== marker.id[0] &&
                      marker.depth_source[1][0] !== LCCore.base_project_id[0]
                    ){                  
                      sketch.noFill();
                      sketch.stroke("#ff0000");
                      
                      sketch.strokeWeight(2); 
                      sketch.ellipse(
                        (hole_x0 + shift_x) * xMag + pad_x,
                        (marker_top + shift_y) * yMag + pad_y,
                        17
                      );
                    }
                  }                

                }
                
                //add marker name without top/bottom name
                if(objOpts.marker.is_name_labels_visible){
                  //add marker name--------------------------------------------
                  if (m !== 0 && m !== section.markers.length - 1) {
                    let markerDispName = marker.name;
                    if(["root"].includes(objOpts.developer.mode)){
                      markerDispName = marker.id[3].slice(0,5);
                    }
                    sketch.fill(objOpts.marker.font_colour);
                    sketch.noStroke();
                    sketch.textFont(objOpts.marker.font);
                    sketch.textSize(objOpts.marker.font_size);
                    sketch.text(
                      markerDispName,
                      (hole_x0 + shift_x) * xMag + pad_x - sketch.textWidth(marker.name) - 5,//+ 10,
                      (marker_top + shift_y) * yMag + pad_y - 2
                    );
                  }
                }
                if(objOpts.marker.is_position_labels_visible){
                  //add marker distance----------------------------------------
                  sketch.fill(objOpts.marker.font_colour);
                  sketch.noStroke();
                  sketch.textFont(objOpts.marker.font);
                  sketch.textSize(objOpts.marker.font_size);
                  if(["root"].includes(objOpts.developer.mode)){
                    sketch.text(
                      //objOpts.canvas.depth_scale
                      (Math.round(marker["composite_depth"] * 10) / 10).toFixed(1).toString()+'('+(Math.round(marker.distance * 10) / 10).toFixed(1).toString()+')['+marker.unreliability?.toFixed(2).toString()+']',
                      (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * xMag + 5,
                      (marker_top + shift_y) * yMag + pad_y - 2
                    );
                  }else{
                    sketch.text(
                      (Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
                      (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * xMag + 5,
                      (marker_top + shift_y) * yMag + pad_y - 2
                    );
                  }                
                }              

                //-----------------------------------------------------------
                //make connection objects=================================================================================
                //add connection
                if( objOpts.canvas.is_connection_visible){
                  let connection_colour = objOpts.connection.line_colour;
                  let connection_line_width = objOpts.connection.line_width;

                  //v_connection--------------------------------------------
                  if(m == 0){
                    sketch.strokeWeight(connection_line_width);
                    sketch.stroke(connection_colour);
                    //case top
                    marker.v_connection.forEach(c=>{
                      if(c[2]!==marker.id[2]){
                        //if connect other section
                        const arrowSize=[8,8,20];
                        sketch.line(
                          marker_x0+marker_w/2,
                          marker_y0 -arrowSize[2],
                          marker_x0+marker_w/2,
                          marker_y0 +arrowSize[2]
                        )
                        sketch.line(
                          marker_x0+marker_w/2,
                          marker_y0 +arrowSize[2],
                          marker_x0+marker_w/2-arrowSize[0],
                          marker_y0 +arrowSize[2] - arrowSize[1]
                        )
                        sketch.line(
                          marker_x0+marker_w/2,
                          marker_y0 +arrowSize[2],
                          marker_x0+marker_w/2+arrowSize[0],
                          marker_y0 +arrowSize[2] - arrowSize[1]
                        )
                      }
                      return;
                    })
                  }
                  if(m == section.markers.length - 1){
                    sketch.strokeWeight(connection_line_width);
                    sketch.stroke(connection_colour);
                    //case top
                    marker.v_connection.forEach(c=>{
                      if(c[2]!==marker.id[2]){
                        //if connect other section
                        const arrowSize=[8,8,20];
                        sketch.line(
                          marker_x0+marker_w/2,
                          marker_y0 -arrowSize[2],
                          marker_x0+marker_w/2,
                          marker_y0 +arrowSize[2]
                        )
                        sketch.line(
                          marker_x0+marker_w/2,
                          marker_y0 -arrowSize[2],
                          marker_x0+marker_w/2-arrowSize[0],
                          marker_y0 -arrowSize[2] + arrowSize[1]
                        )
                        sketch.line(
                          marker_x0+marker_w/2,
                          marker_y0 -arrowSize[2],
                          marker_x0+marker_w/2+arrowSize[0],
                          marker_y0 -arrowSize[2] + arrowSize[1]
                        )
                        return;
                      }
                    })
                  }

                  //h_connection--------------------------------------------
                  const connectionData = this.getNearestConnectedMarkerIdx( LCCore, marker.id, objOpts);

                  //check connection
                  if (connectionData == null) {
                    //there is no connection
                    continue;
                  }

                  const idxTo = connectionData.connected_idx;

                  //get connectied hole position
                  const connectedHole_x0 = (objOpts.hole.distance + objOpts.hole.width) * ((LCCore.projects[idxTo[0]].order * objOpts.project.interval)+ (connectionData.num_total - connectionData.num_total_disable)); //LCCore.projects[idxTo[0]].holes[idxTo[1]].order
                  const connectedMarker  = LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
                  const connectedMarker_top = connectedMarker[objOpts.canvas.depth_scale];

                  if (connectedMarker_top == null) {
                    //console.log("Connected marker position is null.");
                    continue;
                  }

                  //get connector position
                  const cn_x0 = (hole_x0 + shift_x + objOpts.marker.width) * xMag + pad_x;
                  const cn_y0 = (marker_top + shift_y) * yMag + pad_y;
                  const cn_x1 = cn_x0 + objOpts.connection.tab_length;
                  const cn_y1 = cn_y0;
                  const cn_x3 = (connectedHole_x0 + shift_x) * xMag + pad_x;
                  const cn_y3 = (connectedMarker_top + shift_y) * yMag + pad_y;
                  const cn_x2 = cn_x3 - objOpts.connection.tab_length;
                  const cn_y2 = cn_y3;

                  //get style
                  if (cn_y0 !== cn_y3) {
                    //not horizontal
                    if (objOpts.connection.is_non_horizontal_connections_highlighted && objOpts.canvas.depth_scale !== "drilling_depth"){
                      sketch.fill(objOpts.marker.font_colour);
                      sketch.noStroke();
                      sketch.textFont(objOpts.marker.font);
                      sketch.textSize(objOpts.marker.font_size);
                      sketch.text(
                        "("+Math.abs(marker[objOpts.canvas.depth_scale] - connectedMarker[objOpts.canvas.depth_scale]).toFixed(1).toString()+")",
                        (cn_x1 + cn_x2)/2,
                        (cn_y1 + cn_y2)/2 - 10
                      )
                      
                      connection_colour = "Cyan";
                      connection_line_width = objOpts.connection.line_width * 4;
                      
                    }
                  }

                  //find master connections
                  let orderMaster = [];
                  let numMaster = 0;
                  if(marker.isMaster){
                    numMaster+=1;
                    orderMaster.push(hole.order);
                  }
                  if(marker.h_connection.length>0){
                    marker.h_connection.forEach(hc=>{
                      if(hc[0]==project.id[0]){
                        const idxH = getIdxById(LCCore, hc);
                        const hHole = LCCore.projects[idxH[0]].holes[idxH[1]];
                        const hMarker = hHole.sections[idxH[2]].markers[idxH[3]];
                        if(hMarker.isMaster){
                          numMaster+=1;
                          orderMaster.push(hHole.order);
                        }
                      }
                    })
                  }
                  
                  if(numMaster==2) {
                    orderMaster.sort();
                    if(hole.order>=orderMaster[0] && hole.order<orderMaster[1]){
                      //if connection of master section
                      if(project.model_type == "duo"){
                        connection_colour = objOpts.connection.duo_master_section_colour;
                      }else{
                        connection_colour = objOpts.connection.base_master_section_colour;
                      }
                      
                      connection_line_width = objOpts.connection.line_width;

                      if(objOpts.connection.is_master_connections_highlighted){
                        connection_line_width = connection_line_width * 2;
                      }               
                      
                    }
                  }

                  sketch.push();
                  if (connectionData.isNext == false) {
                    //connected core is not located at the next
                    if (objOpts.connection.is_remote_connections_visible){
                      if(objOpts.connection.is_remote_connections_highlighted){
                        sketch.drawingContext.globalAlpha = 0.25;
                        sketch.drawingContext.setLineDash([5, 5]);
                      }
                    }else{
                      continue
                    }
                  }

                  //draw connection---------------------------------------------
                  sketch.strokeWeight(connection_line_width);
                  sketch.stroke(connection_colour);

                  sketch.line(cn_x0, cn_y0, cn_x1, cn_y1); //start point
                  sketch.line(cn_x1, cn_y1, cn_x2, cn_y2); //index left
                  sketch.line(cn_x2, cn_y2, cn_x3, cn_y3); //index right

                  if(objOpts.connection.is_source_visible){
                    //source arrow
                    let dir = null;
                    if(marker.depth_source[1]){
                      if(marker.depth_source[1][1] !== marker.id[1]){
                        //not same hole
                        if(marker.depth_source[1][3] == connectedMarker.id[3]){
                          //connected between markers
                          dir = "left";
                        }else{
                          //not connected directly
                          const sourceHole = getDataFromId(LCCore, [marker.depth_source[1][0],marker.depth_source[1][1],null,null]);
                          if(sourceHole.order > hole.order && marker.depth_source[1][0] === marker.id[0]){
                            dir = "left";
                          }
                        }
                      }                                     
                    }

                    if(connectedMarker.depth_source[1]){
                      if(connectedMarker.depth_source[1][1] !== connectedMarker.id[1]){
                        //not same hole
                        if(connectedMarker.depth_source[1][3] == marker.id[3]){
                          //connected between markers
                          dir = "right";
                        }else{
                          //not connected directly
                          const sourceHole = getDataFromId(LCCore, [connectedMarker.depth_source[1][0],connectedMarker.depth_source[1][1],null,null]);
                          if(sourceHole.order < hole.order && connectedMarker.depth_source[1][0] === connectedMarker.id[0]){
                            dir = "right";
                          }
                        }
                      }   
                    }
                  

                    //connectedMarker
                    //sourceMarker
                        
                    sketch.drawingContext.setLineDash([]);
                    if(dir=="right"){
                      sketch.line(cn_x2, cn_y2-5, cn_x3, cn_y3); 
                      sketch.line(cn_x2, cn_y2+5, cn_x3, cn_y3); 
                    }else if(dir=="left"){
                      sketch.line(cn_x0, cn_y0, cn_x1, cn_y1-5);
                      sketch.line(cn_x0, cn_y0, cn_x1, cn_y1+5);
                    }

                  }

                  sketch.pop();
                  sketch.drawingContext.globalAlpha = 1;

                  //------------------------------------------------------------                
                } 
                
                //=====================================================================================================
              }
            }  
          }
        }
        num_disable.total += project.holes.length + objOpts.project.interval;
      }

      //==========================================================================================      
      //draw age points      
      if (objOpts.canvas.is_model_visible && objOpts.age.is_age_visible && LCPlotAge !== null &&  LCPlotAge.ages.length > 0) {
        //if(LCPlotAge.id == document.getElementById("AgeModelSelect").value) //if check id
        
        //get age data(because age data, age series is single)
        const ageList = LCPlotAge.ages;        

        //get position & plot        
        if(ageList){

          //check inside
          //result.pos_canvas_y  = (data[objOpts.canvas.depth_scale] * data.amplification_y + shift_y) * yMag + pad_y;
          const scrollerTopRealScale   = (scroller.scrollTop - pad_y) / yMag - shift_y;//cm
          const scrollerBotRealScale   = (scroller.scrollTop + window.innerHeight - pad_y) / yMag - shift_y;//cm
          const yBufferVal = (scrollerBotRealScale-scrollerTopRealScale) * objOpts.canvas.buffer_depth * yMag;
          const searchTop = scrollerTopRealScale - yBufferVal;
          const searchBot = scrollerBotRealScale + yBufferVal;
          let startIndex = binarySearchIndex(ageList, searchTop, (d) => d[objOpts.canvas.depth_scale]);
          let endIndex   = binarySearchIndex(ageList, searchBot, (d) => d[objOpts.canvas.depth_scale]);

          //convert age point
          let val_max = -Infinity;
          let val_min = Infinity;
          const ageDataSet = drawPointDataset();
          for (let a = startIndex; a < endIndex; a++) {   
            //set values
            const ageData = drawPointData();
            ageData.id          = ageList[a].id;
            ageData.enable      = ageList[a].enable;
            ageData.reliable    = ageList[a].reliable;
            ageData.age         = ageList[a].age_mid;
            ageData.name        = ageList[a].name;
            ageData.type        = ageList[a].data_type;
            ageData.source_type = ageList[a].source_type;//e.g. tephra
            ageData.source_code = ageList[a].source_code;//e.g. c4
            ageData.unit        = ageList[a].unit;
            ageData.source      = ageList[a].original_depth_type;

            ageData.hname = ageList[a].original_depth_type=="trinity" ? ageList[a].trinityData.hole_name    : null;
            ageData.sname = ageList[a].original_depth_type=="trinity" ? ageList[a].trinityData.section_name : null;
            ageData.dist  = ageList[a].original_depth_type=="trinity" ? ageList[a].trinityData.distance     : null;
            ageData.pidx  = ageList[a].pidx;
            ageData.hidx  = ageList[a].hidx;
            ageData.sidx  = ageList[a].sidx;

            ageData.drilling_depth  = ageList[a].drilling_depth;
            ageData.composite_depth = ageList[a].composite_depth;
            ageData.event_free_depth= ageList[a].event_free_depth;
           
            //calc max/min
            if (Number.isFinite(ageData.age)){
              if(ageData.age < val_min){
                val_min = ageData.age;
              }

              if(ageData.age > val_max){
                val_max = ageData.age;
              }
            }

            //submit
            ageDataSet.data.push(ageData);
            ageDataSet.depth_map.drilling_depth.push({idx:a, value:ageData.drilling_depth });
            ageDataSet.depth_map.composite_depth.push({idx:a, value:ageData.composite_depth});
            ageDataSet.depth_map.event_free_depth.push({idx:a, value:ageData.event_free_depth});
            ageDataSet.depth_map.age.push({idx:a, value:ageData.age});
          }

          //set max/min
          ageDataSet.min = val_max;
          ageDataSet.min = val_min;

          //calc draw position
          const drawDataSet = calcDrawPosition(ageDataSet, LCCore, objOpts, null);
 
          //draw age point main
          for(let d=0; d<drawDataSet.data.length; d++){
            const drawData = drawDataSet.data[d];
            
            if (drawData.source_type == "" || agePlotIcons[drawData.source_type] == undefined) {
              //case: Unknown source type
              sketch.image(
                agePlotIcons["none"],
                drawData.pos_x,
                drawData.pos_y,
                objOpts.age.incon_size,
                objOpts.age.incon_size
              );
            } else {
              //case: known source type
              if(drawData.enable==true){
                //case: enable data
                if(drawData.reliable == true){
                  //case: reliable(normal data)
                  sketch.image(
                    agePlotIcons[drawData.source_type],
                    drawData.pos_x,
                    drawData.pos_y,
                    objOpts.age.incon_size,
                    objOpts.age.incon_size
                  );
                }else{
                  //case: unreliable(reversed data, but used for age model)
                  sketch.image(
                    agePlotIcons[drawData.source_type+"_unreliable"],
                    drawData.pos_x,
                    drawData.pos_y,
                    objOpts.age.incon_size,
                    objOpts.age.incon_size
                  );
                }
              }else{
                //case: disable data(reversed data, not used for age model)
                sketch.image(
                  agePlotIcons[drawData.source_type+"_disable"],
                  drawData.pos_x,
                  drawData.pos_y,
                  objOpts.age.incon_size,
                  objOpts.age.incon_size
                );
              }     
              
              if(objOpts.age.is_age_label_visible){
                sketch.push();
                sketch.fill(objOpts.age.font_colour);
                sketch.noStroke();
                sketch.textFont(objOpts.age.font);
                sketch.textSize(objOpts.age.font_size);

                sketch.text(
                  drawData.name, 
                  drawData.pos_x+objOpts.age.incon_size+10, 
                  drawData.pos_y+objOpts.age.incon_size*0.7
                );
                sketch.pop();
              }

              
            }
          }
        }        
      }
      
      //==========================================================================================
      //==========================================================================================
      //draw data points     //0000000000000000000000000000
      if(objOpts.plot.is_plot_visible == true){
        if(objOpts.plotter.selected_options !== null){          
          sketch.drawingContext.setLineDash([]);
          if(LCPlotData){
            for(let t=0; t<LCPlotData.draw_collections.length; t++){
              //get inside data
              //const scrollerTopRealScale   = (scroller.scrollTop - pad_y) / yMag - shift_y;//cm
              //const scrollerBotRealScale   = (scroller.scrollTop + window.innerHeight - pad_y) / yMag - shift_y;//cm            

              //calc zoom level
              const dispPix = scroller.clientHeight * objOpts.canvas.dpir;     
              const drawResolution = (scrollerBotRealScale - scrollerTopRealScale)/dispPix;//cm/pic
              let zoomLevel = 0;

              if (drawResolution >= 10) {        // 10 cm/pix 〜 7.5 cm/pix
                  zoomLevel = 13;
              } else if (drawResolution >= 7.5000) {  
                  zoomLevel = 12;
              } else if (drawResolution >= 5.0000) { 
                  zoomLevel = 11;
              } else if (drawResolution >= 2.5000) {
                  zoomLevel = 10;
              } else if (drawResolution >= 1.0000) {  
                  zoomLevel = 9;
              } else if (drawResolution >= 0.7500) { 
                  zoomLevel = 8;
              } else if (drawResolution >= 0.5000) { 
                  zoomLevel = 7;
              } else if (drawResolution >= 0.2500) { 
                  zoomLevel = 6;
              } else if (drawResolution >= 0.1000) { 
                  zoomLevel = 5;
              } else if (drawResolution >= 0.0750) { 
                  zoomLevel = 4;
              } else if (drawResolution >= 0.050) {  
                  zoomLevel = 3;
              } else if (drawResolution >= 0.025) { 
                  zoomLevel = 2;
              } else if (drawResolution >= 0.010) { 
                  zoomLevel = 1;
              } else {
                  zoomLevel = 0;
              }

              //getdata
              const pOptions = objOpts.plotter.selected_options[t];   
              
              if(!pOptions.isDraw){
                continue
              }
              
              let drawDataset ;
              if(objOpts.plot.use_resample_by_scale){        
                drawDataset = LCPlotData.draw_collections[t][zoomLevel];
              }else{
                drawDataset = LCPlotData.draw_collections[t][0];
              }

              //check inside
              //const bufferVal = (scrollerBotRealScale-scrollerTopRealScale) * objOpts.canvas.buffer_depth * yMag;

              const searchTop  = scrollerTopRealScale - yBufferVal;
              const searchBot  = scrollerBotRealScale + yBufferVal;
              //if changed resample option after plotted, depth_map error
              const depthArr   = drawDataset.depth_map[objOpts.canvas.depth_scale]; 
              let startIndex = binarySearchIndex(depthArr, searchTop, (e) => e.value);
              let endIndex   = binarySearchIndex(depthArr, searchBot, (e) => e.value);

              const targetIdxs = depthArr.slice(startIndex, endIndex).map(e => e.idx).sort((a, b) => a - b);
              const numPoints = targetIdxs.length;

              //extract
              /*
              const searchTop = scrollerTopRealScale - bufferVal;
              const searchBot = scrollerBotRealScale + bufferVal;
              let startIndex  = binarySearchIndex(drawDataset.data, searchTop, (d) => d[objOpts.canvas.depth_scale]);
              let endIndex    = binarySearchIndex(drawDataset.data, searchBot, (d) => d[objOpts.canvas.depth_scale]);
              const numPoints = endIndex - startIndex ? endIndex - startIndex + 1 : 0;

              const extractedDrawDataset = { ...drawDataset };
              extractedDrawDataset.data = drawDataset.data.slice(startIndex, endIndex + 1).map(d => ({ ...d }));
              */

              if(["root"].includes(objOpts.developer.mode)){
                console.log("Dipslay: Zoom: ",zoomLevel,", hight pix: ",sketch.height * dpir,", hight cm: ", (searchBot-searchTop).toFixed(2)," cm, points: N=", numPoints)
              }
              
              //extract
              const extractedDrawDataset = {};
              for (const k in drawDataset) {
                if (k !== "data") extractedDrawDataset[k] = drawDataset[k];
              }

              extractedDrawDataset.data = new Array(targetIdxs.length);
              for (let i = 0; i < targetIdxs.length; i++) {
                const d = drawDataset.data[targetIdxs[i]];
                extractedDrawDataset.data[i] = { ...d };
              }
                
              if(extractedDrawDataset.data.length==0) continue;
              
              //calc position             
              const drawData = calcDrawPosition(extractedDrawDataset, LCCore, objOpts, pOptions);

              //draw
              let zeroDataset;
              let zeroDataDict = {};
              // Calculate zero position if not yet calculated
              const firstDataPoint = extractedDrawDataset.data[0];

              if(firstDataPoint){                
                if(firstDataPoint.source === "trinity"){
                  //if input data source is trinity
                  LCCore.projects.forEach((project, p)=>{
                    project.holes.forEach((hole, h)=>{
                      if(!hole.enable){
                        return
                      }

                      if(firstDataPoint.pidx === p){
                        //case trinity data
                        const d1 = { ...firstDataPoint };
                        const d2 = { ...firstDataPoint };
                        const d3 = { ...firstDataPoint };
                        
                        const zeroDrawDataset = { 
                            ...extractedDrawDataset, 
                            data: [d1, d2, d3]
                        };

                        //set zero
                        zeroDrawDataset.data[0].val   = 0;
                        zeroDrawDataset.data[0].hname = hole.name;
                        zeroDrawDataset.data[0].hidx  = h;
                        //set max
                        zeroDrawDataset.data[1].val   = zeroDrawDataset.max;
                        zeroDrawDataset.data[1].hname = hole.name;
                        zeroDrawDataset.data[1].hidx  = h;
                        //set min
                        zeroDrawDataset.data[2].val   = zeroDrawDataset.min;
                        zeroDrawDataset.data[2].hname = hole.name;
                        zeroDrawDataset.data[2].hidx  = h;

                        zeroDataset = calcDrawPosition(zeroDrawDataset, LCCore, objOpts, pOptions);
                        for(let z=0; z<zeroDataset.data.length;z++){
                                                  
                          if(pOptions.position == "rightside"){
                            zeroDataset.data[z].pos_x = zeroDataset.data[z].pos_x + objOpts.hole.width * xMag;
                          }else if(pOptions.position == "leftside"){
                            zeroDataset.data[z].pos_x = zeroDataset.data[z].pos_x - objOpts.hole.width * xMag;
                          }
                        }
                        zeroDataDict[hole.name] = zeroDataset.data;
                        //========== X axis for trinity===============                        
                        if (objOpts.plot.is_axis_visible) {
                          if(pOptions.isAxis){
                            let yAxis = 100 + scroller.scrollTop + 60 * t;

                            if(h%2==0){
                              yAxis -= 60; 
                            }
                              
                            const yLabel = yAxis - 5;
                            const yTitle = yAxis - 25;
                            
                            const xMax = zeroDataset.data[1].pos_x;
                            const xMin = zeroDataset.data[2].pos_x;
                            const xCenter = xMin + (xMax - xMin) / 2;
                          
                            const minValueStr = autoRound(zeroDataset.min).toString();
                            const maxValueStr = autoRound(zeroDataset.max).toString();
                            const title = zeroDataset.data[0].header + " [" + zeroDataset.data[0].unit + "]";
                            sketch.push();

                            sketch.strokeWeight(2);
                            sketch.stroke(pOptions.colour);
                            sketch.fill(pOptions.colour);
                            
                            sketch.line(xMax, yAxis, xMin, yAxis);

                            /*
                            const tickLength = 5;
                            sketch.strokeWeight(1);
                            sketch.line(xMin, yAxis, xMin, yAxis + tickLength);
                            sketch.line(xMax, yAxis, xMax, yAxis + tickLength);
                            */
                            sketch.noStroke();
                            sketch.textSize(12);

                            sketch.textAlign(sketch.RIGHT);
                            sketch.text(minValueStr, xMin, yLabel);

                            sketch.textAlign(sketch.LEFT);
                            sketch.text(maxValueStr, xMax, yLabel);
                            
                            sketch.textAlign(sketch.CENTER); 
                            sketch.textSize(14);
                            sketch.text(title, xCenter, yTitle);

                            sketch.pop(); 
                          }                          
                        }
                      }
                    })
                  })   

                  }else{
                  //}else if(["composite_depth", "age", "event_free_depth"].includes(firstDataPoint.source)){
                  //case trinity data
                  const d1 = { ...firstDataPoint };
                  const d2 = { ...firstDataPoint };
                  const d3 = { ...firstDataPoint };
                  
                  const zeroDrawDataset = { 
                      ...extractedDrawDataset, 
                      data: [d1, d2, d3]
                  };

                  //set zero
                  zeroDrawDataset.data[0].val   = 0;
                  zeroDrawDataset.data[0].hname = null;
                  zeroDrawDataset.data[0].hidx  = null;
                  //set max
                  zeroDrawDataset.data[1].val   = zeroDrawDataset.max;
                  zeroDrawDataset.data[1].hname = null;
                  zeroDrawDataset.data[1].hidx  = null;
                  //set min
                  zeroDrawDataset.data[2].val   = zeroDrawDataset.min;
                  zeroDrawDataset.data[2].hname = null;
                  zeroDrawDataset.data[2].hidx  = null;
                  
                  zeroDataset = calcDrawPosition(zeroDrawDataset, LCCore, objOpts, pOptions);
                  zeroDataDict["global"] = zeroDataset.data;

                  //========== X axis for global ===============
                  if (objOpts.plot.is_axis_visible) {
                    if(pOptions.isAxis){
                      let yAxis = 200 + scroller.scrollTop;
                        
                      const yLabel = yAxis - 5;
                      const yTitle = yAxis - 25;
                      
                      const xMax = zeroDataset.data[1].pos_x;
                      const xMin = zeroDataset.data[2].pos_x;
                      const xCenter = xMin + (xMax - xMin) / 2;
                    
                      const minValueStr = autoRound(zeroDataset.min).toString();
                      const maxValueStr = autoRound(zeroDataset.max).toString();
                      const title = zeroDataset.data[0].header + " [" + zeroDataset.data[0].unit + "]";
                      sketch.push();

                      sketch.strokeWeight(2);
                      sketch.stroke(pOptions.colour);
                      sketch.fill(pOptions.colour);
                      
                      sketch.line(xMax, yAxis, xMin, yAxis);

                      /*
                      const tickLength = 5;
                      sketch.strokeWeight(1);
                      sketch.line(xMin, yAxis, xMin, yAxis + tickLength);
                      sketch.line(xMax, yAxis, xMax, yAxis + tickLength);
                      */
                      sketch.noStroke();
                      sketch.textSize(12);

                      sketch.textAlign(sketch.RIGHT);
                      sketch.text(minValueStr, xMin, yLabel);

                      sketch.textAlign(sketch.LEFT);
                      sketch.text(maxValueStr, xMax, yLabel);
                      
                      sketch.textAlign(sketch.CENTER); 
                      sketch.textSize(14);
                      sketch.text(title, xCenter, yTitle);

                      sketch.pop();
                    }
                  }
                }
              }

              //========== main plot ====================
              let isPlotting = false;
              let objCounts  = 0;
              let linePlotStroke = objOpts.plot.lineplot_stroke;
              if(drawDataset.is_resampled){
                linePlotStroke += 1;
              }
              const numCut = 2000;
              //main roop
              for(let d=0; d<drawData.data.length; d++){
                objCounts += 1;
                //get data
                const pData = drawData.data[d];
                if(pOptions.position == "rightside"){
                  pData.pos_x = pData.pos_x + objOpts.hole.width * xMag;
                }else if(pOptions.position == "leftside"){
                  pData.pos_x = pData.pos_x - objOpts.hole.width * xMag;
                }

                //if valid data exist, plot
                if(pOptions.plotType == "line"){
                  // ---------------------------------------------------------
                  // Line Plot: (using vertex)
                  // ---------------------------------------------------------
                  
                  // Check for Discontinuity (Section/Hole Change)
                  if (isPlotting && d>0) {
                    const prevData = drawData.data[d - 1];
                    if (pData.hname !== prevData.hname || (pData.sname !== prevData.sname && objOpts.plot.lineplot_split_sections)) {
                        sketch.endShape();
                        objCounts = 0;
                        isPlotting = false;    
                    }
                  }

                  // Check Delimiter
                  if (!Number.isFinite(pData.pos_y) || !Number.isFinite(pData.pos_x)) {
                    if (isPlotting && !objOpts.plot.lineplot_ignore_invalid) {
                        sketch.endShape();
                        objCounts = 0;
                        isPlotting = false;
                    }
                    //to next loop
                    continue;
                  }

                  // ---------------------------------------------------------
                  // Draw
                  if (!isPlotting) {
                    sketch.beginShape();
                    sketch.strokeJoin(sketch.BEVEL);
                    sketch.strokeWeight(linePlotStroke);
                    sketch.stroke(pOptions.colour);
                    sketch.noFill();
                    isPlotting = true;
                  }

                  // ---------------------------------------------------------
                  // plot vertex
                  sketch.vertex(pData.pos_x, pData.pos_y);

                  if(objCounts>numCut){
                    sketch.endShape();
                    objCounts = 0;
                    sketch.beginShape();
                    sketch.strokeJoin(sketch.BEVEL);
                    sketch.strokeWeight(linePlotStroke);
                    sketch.stroke(pOptions.colour);
                    sketch.noFill();
                    isPlotting = true;
                  }
            
                }else if(pOptions.plotType == "scatter"){
                  // ---------------------------------------------------------
                  // Scatter Plot
                  // ---------------------------------------------------------   
                  if (!Number.isFinite(pData.pos_y) || !Number.isFinite(pData.pos_x)) {
                    continue;
                  }

                  if (!isPlotting) {
                    sketch.beginShape(sketch.POINTS);
                    sketch.stroke(pOptions.colour);
                    sketch.strokeWeight(objOpts.plot.scatterplot_size);
                    isPlotting = true;
                  }

                  sketch.vertex(pData.pos_x, pData.pos_y);

                  if(objCounts > numCut){
                    sketch.endShape();
                    isPlotting = false;
                    objCounts = 0;
                  }

                }else if(pOptions.plotType == "bar"){
                  // ---------------------------------------------------------
                  // Bar Plot: (using QUADS)
                  // ---------------------------------------------------------
                  // Check Delimiter (same as line)
                  if (!Number.isFinite(pData.pos_y) || !Number.isFinite(pData.pos_x)) {
                    if (isPlotting) {
                      sketch.endShape();
                      isPlotting = false;
                    }
                    continue;
                  }

                  // ---------------------------------------------------------
                  // Check for Discontinuity (Section/Hole Change) (same as line)
                  if (isPlotting && d>0) {
                    const prevData = drawData.data[d - 1];
                    if (pData.hname !== prevData.hname || pData.sname !== prevData.sname) {
                      sketch.endShape();
                      isPlotting = false;
                    }
                  }

                  // ---------------------------------------------------------
                  // Draw (start a QUADS batch)
                  if (!isPlotting) {
                    sketch.beginShape(sketch.QUADS);
                    sketch.noStroke();
                    sketch.fill(pOptions.colour);
                    isPlotting = true;
                  }

                  // ---------------------------------------------------------
                  // Bar Plot Logic 
                  let depthDiff = 0;

                  if (d < drawData.data.length - 1) {
                    depthDiff = Math.abs(drawData.data[d+1][objOpts.canvas.depth_scale] - drawData.data[d][objOpts.canvas.depth_scale]);
                  } else if (d > 0) {
                    depthDiff = Math.abs(drawData.data[d][objOpts.canvas.depth_scale] - drawData.data[d-1][objOpts.canvas.depth_scale]);
                  } else {
                    depthDiff = 1.0;
                  }

                  
                  let binWidth = objOpts.plot.barplot_width;//if fix depth, => * yMag;
                  if (binWidth < 1) binWidth = 1;

                  // Define rectangle coordinates
                  let rectX0;
                  if(firstDataPoint.source === "trinity"){
                    rectX0 = zeroDataDict[pData.hname][2].pos_x;
                  }else{
                    rectX0 = zeroDataDict["global"][2].pos_x;  
                  }
                  const rectX1 = pData.pos_x;

                  const rectY0 = pData.pos_y - binWidth/2;
                  const rectY1 = pData.pos_y + binWidth/2;

                  // Register the 4 corners (QUADS)
                  sketch.vertex(rectX0, rectY0);
                  sketch.vertex(rectX1, rectY0);
                  sketch.vertex(rectX1, rectY1);
                  sketch.vertex(rectX0, rectY1);

                  if(objCounts > numCut){ 
                    sketch.endShape();
                    isPlotting = false;
                    objCounts = 0;
                  }
                }                 
              }

              // Ensure the last shape is closed
              if (isPlotting) {
                sketch.endShape();
                isPlotting = false;
              }
              
            } 
          }          
        }
      }

      //==========================================================================================

      sketch.pop(); //restore
    };

    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };
  };

  //============================================================================================
  function autoRound(num, { precision = 2, decimalPlaces = null, significantFigures = null } = {}) {
    if (!isFinite(num)) return num;
    if (num === 0) return 0;

    if (significantFigures !== null) {
      const factor = Math.pow(10, significantFigures - Math.ceil(Math.log10(Math.abs(num))));
      return Math.round(num * factor) / factor;
    }

    if (decimalPlaces !== null) {
      const factor = Math.pow(10, decimalPlaces);
      return Math.round(num * factor) / factor;
    }

    const decimalPlacesForAuto = Math.max(0, Math.floor(-Math.log10(Math.abs(num)) + precision));
    const factor = Math.pow(10, decimalPlacesForAuto);
    return Math.round(num * factor) / factor;
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
      sketch.stroke("#ff0000");
      sketch.noLoop();
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
          (startPoint.x + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,
          (startPoint.y + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir * age_correction[0] + objOpts.canvas.pad_y + age_correction[1],
          sketch.mouseX  + scroller.scrollLeft,
          sketch.mouseY  + scroller.scrollTop
        );
        sketch.pop(); // Restore settings
      } else if (clickCount == 0) {
        sketch.line(
          (startPoint.x + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,
          (startPoint.y + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir *  + age_correction[0] + objOpts.canvas.pad_y + age_correction[1],
          (endPoint.x + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,
          (endPoint.y + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir *  + age_correction[0] + objOpts.canvas.pad_y + age_correction[1]
        );
      }
    };

    // Window resize handler should be outside of draw()
    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };

    //let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
    //let y = (scroller.scrollTop + mouseY - pad_y) / yMag / age_mod - shift_y;
    
    console.log('clicked', clickCount);
    sketch.mouseClicked = () => {
      if (clickCount == 2) {
        //get clicked point
        startPoint = null;
        startPoint = getClickedItemIdx(sketch.mouseX, sketch.mouseY, LCCore, objOpts);
        clickCount -= 1;

        //draw
        sketch.loop();
        console.log("[Measure]: Strat from " + startPoint.y);
        
        //startPoint[0] = (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir - objOpts.canvas.shift_x;
        //startPoint[1] = (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y - age_correction[1]) / (objOpts.canvas.zoom_level[1]  * objOpts.canvas.dpir * age_correction[0]) - objOpts.canvas.shift_y;
      } else if (clickCount == 1) {
        //get clicked point
        endPoint = null;
        endPoint = getClickedItemIdx(sketch.mouseX, sketch.mouseY, LCCore, objOpts) 
        clickCount -= 1;

        //draw
        sketch.noLoop();
        console.log("[Measure]: End to " + endPoint.y);
        
        //endPoint[0] = (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir - objOpts.canvas.shift_x;
        //endPoint[1] = (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y - age_correction[1]) / (objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir * age_correction[0]) - objOpts.canvas.shift_y;

        //calc distance
        measureResults(startPoint, endPoint);
        document.body.style.cursor = "default"; 
        
      } else if (clickCount > 0) {
        clickCount -= 1;
      }
    };
  };
  //--------------------------------------------------------------------------------------------
  
  //--------------------------------------------------------------------------------------------
  async function measureResults(startPoint, endPoint) {
    //calc
    let x0;
    let x1;
    let y0;
    let y1;

    if (startPoint.y <= endPoint.y) {
      x0 = startPoint.x;
      y0 = startPoint.y;
      x1 = endPoint.x;      
      y1 = endPoint.y;
    } else {
      x1 = startPoint.x;
      y1 = startPoint.y;
      x0 = endPoint.x;      
      y0 = endPoint.y;
    }

    //get click position
    const upperTargetId = [startPoint.project, startPoint.hole, startPoint.section, null];
    const lowerTargetId = [endPoint.project, endPoint.hole, endPoint.section, null];
    const options = {
      sourceType: objOpts.canvas.depth_scale,
      polationType: "linear",  
      allowOutside: false
    };
    const upperData = await window.LCapi.depthConverter({
      dataList: [["", y0, upperTargetId]],
      options,
    });
    const lowerData = await window.LCapi.depthConverter({
      dataList: [["", y1, upperTargetId]],
      options,
    });

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

    document.getElementById("bt_measure").style.backgroundColor = "#f0f0f0";
    //penObject.isMeasure = false;
    measureObject.isMeasure = false;
    measureObject.measureCanvas = null;

    const parentElement2 = document.getElementById("p5measureCanvas");
    while (parentElement2.firstChild) {
      parentElement2.removeChild(parentElement2.firstChild);
    }
  }
  //--------------------------------------------------------------------------------------------
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
      sketch.stroke(objOpts.pen.colour);
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
            (penData[i][0] + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,
            (penData[i][1] + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir + objOpts.canvas.pad_y,
            (penData[i][2] + objOpts.canvas.shift_x) * objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir + objOpts.canvas.pad_x,    
            (penData[i][3] + objOpts.canvas.shift_y) * objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir + objOpts.canvas.pad_y
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
            (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] / objOpts.canvas.dpir - objOpts.canvas.shift_x,
            (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y) / objOpts.canvas.zoom_level[1] / objOpts.canvas.dpir - objOpts.canvas.shift_y,
            (sketch.pmouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] / objOpts.canvas.dpir - objOpts.canvas.shift_x,
            (sketch.pmouseY + scroller.scrollTop - objOpts.canvas.pad_y) / objOpts.canvas.zoom_level[1] / objOpts.canvas.dpir - objOpts.canvas.shift_y,
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
      } 
    };
    sketch.keyPressed = async () => {
      if (sketch.key === 'n' && sketch.keyIsDown(sketch.CONTROL)) { 
        const response = await window.LCapi.Confirm(
          {
            opts: {
              title:"Confirm",
              message:"Are you sure you want to delete the written data?",
              parent: "main"
            }
          }
        );

        if (response) {
        //if (confirm("Are you sure you want to delete the written data?")) {
          penData = [];
          sketch.pmouseX = sketch.mouseX;
          sketch.pmouseY = sketch.mouseY;
          sketch.setup();
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
    const results =
      typeof in_path === "string"
        ? await window.LCapi.RegisterModelFromPath(in_path)
        : await window.LCapi.RegisterModelFromCsv(in_path);

    if (results == null) {
      console.log("[Renderer]: Failed to resister correlation model.")
      return null;
    }else{
      const displayName = typeof in_path === "string" ? in_path : in_path.name;
      console.log("[Renderer]: Correlation Model has been resistered into the LCCore: " + displayName +".");
    }
    return true;
  }
  async function importCorrelationModelSource(in_path, options = {}) {
    const {
      syncRendererState = true,
    } = options;

    const registered = await registerModel(in_path);
    if (!registered) {
      return { ok: false, error: "register_failed" };
    }

    if (syncRendererState) {
      await loadModel(true, true);
    }

    return { ok: true };
  }
  async function registerModelFromLCCore() {
  
    //mount model into LCCore
    const results = await window.LCapi.RegisterModelFromLCCore(); //[]

    if (results == null && results.length==0) {
      console.error("[Renderer]: Failed to resister correlation model.")
      return null;
    }
    
    return true;
  }
  async function loadModel(isUpdateView=true, isRecalcDepth=true) {
    //load model into LCCore
    //now, LC is able to hold one project file, model_id is dummy
    const results = await unzip( await window.LCapi.LoadModelFromLCCore() );
    
    if (results) {
      //load model
      LCCore = results;

      let isConnected = true;
      
      //check model
      for(let p=0; p<LCCore.projects.length; p++){
        if(!isConnectMasterProject(LCCore, LCCore.projects[p].id)){
          isConnected = false;
        }
      }
      
      if(!objOpts.edit.editable && !isConnected && ["user"].includes(objOpts.developer.mode)){
        objOpts.project.is_area_visible = true;
        objOpts.project.area_colour_disconnected = "#f96a6a";
        alert(
              "Please note that the loaded model contains a project not connected to the master.\n"+
              "CD and EFD will be calculated independently for that project."
            );
      }

      if(isRecalcDepth){
        //calc composite depth
        LCCore = await unzip( await window.LCapi.CalcCompositeDepth());
      
        //calc event free depth
        LCCore = await unzip( await window.LCapi.CalcEventFreeDepth());
      }

      //sort
      //LCCore = sortProjectByOrder(LCCore);
      //LCCore = sortHoleByOrder(LCCore);

      //initialise hole list
      while (document.getElementById("hole_list").firstChild) {
        document.getElementById("hole_list").removeChild(document.getElementById("hole_list").firstChild);
      }

      //add hole list
      LCCore.projects.forEach((project, p) => {
        const container = document.getElementById("hole_list");
        const projItemDiv = document.createElement("div");
        const projListCheck = document.createElement("input");
        projListCheck.type = "checkbox";
        projListCheck.id = project.id;
        projListCheck.checked = backup_hole_enable[project.id.toString()] !== undefined?  backup_hole_enable[project.id.toString()] : true;
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
          checkbox.checked = backup_hole_enable[hole.id.toString()] !== undefined ?  backup_hole_enable[hole.id.toString()] : true;
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

      
      //apply enable info
      for(let  project of LCCore.projects){
        let en = backup_hole_enable[project.id.toString()];
        if(en === undefined){
          //initial case
          project.enable = true;
        }else{
          project.enable = en;
        }
        for(let hole of project.holes){
          en = backup_hole_enable[hole.id.toString()];
          if(en === undefined){
            hole.enable = true;
          }else{
            hole.enable = en;
          }
        }
      }

      //update position
      objOpts.canvas.depth_scale = document.getElementById("YAxisSelect").value;    

      let yMag = objOpts.canvas.dpir * objOpts.canvas.zoom_level[1];
      let pad_y = objOpts.canvas.pad_y;
      const shift_y = objOpts.canvas.shift_y;

      if (objOpts.canvas.depth_scale == "age") {
        yMag = yMag * objOpts.canvas.age_zoom_correction[0];
        pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
      }

      /*
      let newPad_y = objOpts.canvas.pad_y;;
      if(LCCore.projects[0].composite_depth_top !==null){
        newPad_y = (LCCore.projects[0].composite_depth_top + shift_y) * yMag + pad_y;
      }
      objOpts.canvas.pad_y = newPad_y;
      */

      //shwo model summary
      console.log("[Renderer]: Correlation Model has been loaded into the renderer.");
      if(["root","developer"].includes(objOpts.developer.mode)){
        console.log(
          "Name: " + LCCore.name,
          "\nDescriptions: " + LCCore.descriptions,
          "\nModel data: " , LCCore
        );
      }
      
      /*
      LCCore.projects.forEach(p=>{
        console.log(
          "Project ID: " + p.id[0],
          "\nProject name: " + p.name,
          "\nVersion: " + p.correlation_version,
          "\nType: " + p.model_type,
          "\nModel data: " , p
        );
      })
      */

      if(isUpdateView){
        updateView();
      }
      
    }   
  }
  async function registerAge(in_path) {
    if (in_path == null) {
      return;
    }

    //load age model
    const results =
      typeof in_path === "string"
        ? await window.LCapi.RegisterAgeFromPath(in_path)
        : await window.LCapi.RegisterAgeFromCsv(in_path);
    //console.log(results);

    if (results) {
      //add list
      age_model_list.push(results); //{id,name}

      //add dropdown
      const newOption = document.createElement("option");
      newOption.value = results.id;
      newOption.textContent = results.name;
      document.getElementById("AgeModelSelect").appendChild(newOption);

      console.log("[Renderer]: Age Model has been registered into the LCAge: "+results.name);
      //console.log(results);
    }
    return results ?? null;
  }
  function getLatestAgeModelId(preferredId = null) {
    if (preferredId != null) {
      return preferredId;
    }

    const selectedAgeModelId = document.getElementById("AgeModelSelect").value;
    if (selectedAgeModelId) {
      return selectedAgeModelId;
    }

    return age_model_list.length > 0 ? age_model_list[age_model_list.length-1].id : null;
  }
  async function syncAgeSelection(ageId) {
    const selectedAgeModelId = getLatestAgeModelId(ageId);
    if (!selectedAgeModelId) {
      return null;
    }

    document.getElementById("AgeModelSelect").value = selectedAgeModelId;
    await loadAge(selectedAgeModelId);
    await loadPlotData("age");
    await loadPlotData("data");

    return selectedAgeModelId;
  }
  async function importAgeModelSource(in_path, options = {}) {
    const {
      syncRendererState = false,
    } = options;

    if (!LCCore) {
      return { ok: false, error: "lcmodel_not_loaded" };
    }

    const loadedAge = await registerAge(in_path);
    if (!loadedAge) {
      return { ok: false, error: "register_age_failed" };
    }

    if (syncRendererState) {
      await syncAgeSelection(loadedAge.id);
      updateView();
    }

    return {
      ok: true,
      loadedAge,
    };
  }
  async function loadAge(age_id) {
    //load age model
    const results = await unzip( await window.LCapi.LoadAgeFromLCAge({ ageId: age_id }));
    
    if (results) {
      LCCore = results;

      //apply enable info
      for(let  project of LCCore.projects){
        let en = backup_hole_enable[project.id.toString()];
        if(en === undefined){
          //initial case
          project.enable = true;
        }else{
          project.enable = en;
        }
        for(let hole of project.holes){
          en = backup_hole_enable[hole.id.toString()];
          if(en === undefined){
            hole.enable = true;
          }else{
            hole.enable = en;
          }
        }
      }

      let name = "";
      age_model_list.forEach((a) => {
        if (a.id == age_id) {
          name = a.name;
        }
      });

      console.log("[Renderer]: Marker Ages updated.");
      if(["root","developer"].includes(objOpts.developer.mode)){
        console.log("Model data: ",LCCore);
      }

      console.log("[Renderer]: Age model has been loaded into the renderer.");
      console.log(
        "ID: " + age_id,
        "\nName: " + name,
        "\nData: ",LCCore
      );

      updateView();
    } else {
      console.log("[Renderer]: Failed to read the age model.");
    }
  }
  async function registerLCModel(in_path){
    //register main
    const loadResult =
      typeof in_path === "string"
        ? await window.LCapi.RegisterLCmodelFromPath(in_path)
        : await window.LCapi.RegisterLCmodel(in_path);

    if (loadResult === false) {
      return false;
    }

    setAgeList(loadResult);
    return loadResult;
  } 
  async function importLcModelSource(in_path, options = {}) {
    const {
      resetCanvas = false,
      syncRendererState = true,
    } = options;

    if (resetCanvas) {
      await initialiseCanvas();
    }

    const loadResult = await registerLCModel(in_path);
    if (loadResult === false) {
      isLoadedLCModel = false;
      return { ok: false, error: "register_failed" };
    }

    if (syncRendererState) {
      await loadModel(true, true);
      isLoadedLCModel = true;
      await syncAgeSelection();
    }

    return {
      ok: true,
      loadResult,
    };
  }
  async function importCoreImagesSource(in_path, options = {}) {
    const {
      depthScales = ["drilling_depth"],
      togglePhoto = false,
    } = options;

    if (!LCCore) {
      return { ok: false, error: "lcmodel_not_loaded" };
    }

    const resolvedPath =
      typeof in_path === "string"
        ? { fullpath: in_path }
        : await window.LCapi.getFilePath(in_path);
    const dirPath = resolvedPath?.fullpath ?? null;
    if (!dirPath) {
      console.log("[Renderer]: Failed to resolve dropped image path.");
      return { ok: false, error: "path_resolution_failed" };
    }

    const registered = await window.LCapi.RegisterCoreImageFromPath({
      dirHandle: dirPath,
      type: "core_images",
    });
    if (!registered) {
      return { ok: false, error: "register_core_images_failed" };
    }

    modelImages = await loadCoreImages(modelImages, LCCore, objOpts, depthScales);
    if (togglePhoto && !objOpts.canvas.is_core_photo_visible) {
      document.getElementById("bt_core_photo").click();
    }
    updateView();

    return { ok: true };
  }
  function setAgeList(loadResult){
    if(loadResult !== false){
      age_model_list = [];
      //fetcf age data from main to renderer
      //initialise dropdown
      const parentElement = document.getElementById("AgeModelSelect");
      while (parentElement.firstChild) {
        parentElement.removeChild(parentElement.firstChild);
      }

      //fetch main
      if (loadResult.length !== 0) {
        //add list
        for(let data of loadResult){
          age_model_list.push(data); //{id,name,path}
          //add dropdown
          const newOption = document.createElement("option");
          newOption.value = data.id;
          newOption.textContent = data.name;
          parentElement .appendChild(newOption);
  
          console.log("[Renderer]: Age Model has been registered into the LCAge: "+data.name);
        }
        //console.log(results);
      }

    }
  }
  window.__LC_E2E__ = {
    isReady: () => true,
    clearEvents: () => {
      lcE2EEventLog.length = 0;
    },
    getEvents: () => lcE2EEventLog.map((entry) => ({ ...entry })),
    getRendererState: () => ({
      isLoadedLCModel,
      projectCount: LCCore?.projects?.length ?? 0,
      holeCount: LCCore?.projects?.reduce((sum, project) => sum + project.holes.length, 0) ?? 0,
      ageModelCount: document.getElementById("AgeModelSelect").options.length,
      holeListCount: document.querySelectorAll("#hole_list input[type='checkbox']").length,
      yAxisScale: document.getElementById("YAxisSelect").value,
      loadedImageCount: Object.keys(modelImages?.drilling_depth ?? {}).length,
      canvasBackgroundColour: objOpts.canvas.background_colour,
      lastPlotPayload: lcE2ELastPlotPayload,
    }),
    getFirstSectionReference: () => {
      const firstProject = LCCore?.projects?.[0];
      const firstHole = firstProject?.holes?.[0];
      const firstSection = firstHole?.sections?.[0];
      if (!firstSection || !firstHole || firstSection.markers.length < 2) {
        return null;
      }

      const topMarker = firstSection.markers[0];
      const bottomMarker = firstSection.markers[firstSection.markers.length - 1];
      return {
        holeName: firstHole.name,
        sectionName: firstSection.name,
        sectionId: firstSection.id,
        midpoint: (Number(topMarker.distance) + Number(bottomMarker.distance)) / 2,
      };
    },
    deleteFirstSection: async () => {
      const firstProject = LCCore?.projects?.[0];
      const firstHole = firstProject?.holes?.[0];
      const firstSection = firstHole?.sections?.[0];
      if (!firstProject || !firstHole || !firstSection) {
        return { ok: false, error: "section_not_found" };
      }

      const beforeSectionCount = firstHole.sections.length;
      const result = await window.LCapi.deleteSection({
        sectionId: firstSection.id,
      });
      if (result === true) {
        await loadModel(false, false);
      }
      const nextProject = LCCore?.projects?.[0];
      const nextHole = nextProject?.holes?.[0];
      const afterSectionCount = nextHole?.sections?.length ?? 0;

      return {
        ok: result === true,
        result,
        beforeSectionCount,
        afterSectionCount,
      };
    },
    depthConvert: async (payload) => window.LCapi.depthConverter(payload),
    addEventToFirstAvailablePair: async () => {
      if (!LCCore) {
        return { ok: false, error: "lcmodel_not_loaded" };
      }

      for (const project of LCCore.projects) {
        for (const hole of project.holes) {
          for (const section of hole.sections) {
            for (let i = 0; i < section.markers.length - 1; i += 1) {
              const upperMarker = section.markers[i];
              const lowerMarker = section.markers[i + 1];
              if ((upperMarker.event?.length ?? 0) > 0) {
                continue;
              }

              const upperId = upperMarker.id;
              const lowerId = lowerMarker.id;
              const beforeCount = upperMarker.event?.length ?? 0;
              const result = await window.LCapi.AddEvent({
                upperId,
                lowerId,
                depositionType: "deposition",
                value: "general",
              });
              if (result === true) {
                await loadModel(false, false);
              }
              const nextIdx = getIdxById(LCCore, upperId);
              const nextMarker =
                LCCore.projects[nextIdx[0]].holes[nextIdx[1]].sections[nextIdx[2]].markers[nextIdx[3]];
              const afterCount = nextMarker.event?.length ?? 0;

              return {
                ok: result === true,
                result,
                upperId,
                lowerId,
                beforeCount,
                afterCount,
              };
            }
          }
        }
      }

      return { ok: false, error: "event_target_not_found" };
    },
    deleteEventBetween: async (upperId, lowerId) => {
      const targetIdx = getIdxById(LCCore, upperId);
      if (!targetIdx || targetIdx[0] == null) {
        return { ok: false, error: "event_target_not_found" };
      }

      const upperMarker =
        LCCore.projects[targetIdx[0]].holes[targetIdx[1]].sections[targetIdx[2]].markers[targetIdx[3]];
      const beforeCount = upperMarker.event?.length ?? 0;
      const result = await window.LCapi.DeleteEvent({
        upperId,
        lowerId,
        type: [],
      });
      if (result === true) {
        await loadModel(false, false);
      }
      const nextIdx = getIdxById(LCCore, upperId);
      const nextMarker =
        LCCore.projects[nextIdx[0]].holes[nextIdx[1]].sections[nextIdx[2]].markers[nextIdx[3]];
      const afterCount = nextMarker.event?.length ?? 0;

      return {
        ok: result === true,
        result,
        beforeCount,
        afterCount,
      };
    },
    saveStateAndGetChangedSectionsAfterEvent: async () => {
      const saved = await window.LCapi.sendSaveState({
        type: "main",
        name: "e2e-state-snapshot",
      });
      if (saved !== true) {
        return { ok: false, error: "save_state_failed", saved };
      }

      const added = await window.__LC_E2E__.addEventToFirstAvailablePair();
      if (!added.ok) {
        return { ok: false, error: "add_event_failed", added };
      }

      const changed = await getUpdatedSectionIds("depth");

      return {
        ok: true,
        added,
        changed,
      };
    },
    allowCloseWithoutSaving: async () => {
      return window.LCapi.e2eSetCloseDialogResponse(1);
    },
    keepWindowOpenOnUnsavedClose: async () => {
      return window.LCapi.e2eSetCloseDialogResponse(0);
    },
    pushDialogResponse: async (response) => {
      return window.LCapi.e2ePushDialogResponse(response);
    },
    getAndClearDialogLog: async () => {
      return window.LCapi.e2eGetAndClearDialogLog();
    },
    setOpenDialogResponse: async (payload) => {
      return window.LCapi.e2eSetOpenDialogResponse(payload);
    },
    getOpenDialogResponse: async () => {
      return window.LCapi.e2eGetOpenDialogResponse();
    },
    chooseFile: async (title, ext) => {
      return window.LCapi.FileChoseDialog({ title, ext });
    },
    chooseFolder: async (title) => {
      return window.LCapi.FolderChoseDialog({ title });
    },
    loadLcModelFromPath: async (inputPath) => {
      const imported = await importLcModelSource(inputPath, {
        resetCanvas: true,
        syncRendererState: true,
      });
      if (!imported.ok) {
        return imported;
      }

      return {
        ok: true,
        ...window.__LC_E2E__.getRendererState(),
      };
    },
    dropLcModelFromPath: async (inputPath) => {
      const imported = await importLcModelSource(inputPath, {
        resetCanvas: true,
        syncRendererState: true,
      });
      if (!imported.ok) {
        return imported;
      }

      return {
        ok: true,
        ...window.__LC_E2E__.getRendererState(),
      };
    },
    dropAgeModelFromPath: async (inputPath) => {
      const imported = await importAgeModelSource(inputPath, {
        syncRendererState: true,
      });
      if (!imported.ok) {
        return imported;
      }

      return {
        ok: true,
        loadedAge: imported.loadedAge,
        ...window.__LC_E2E__.getRendererState(),
      };
    },
    loadAgeModelFromPath: async (inputPath) => {
      const imported = await importAgeModelSource(inputPath, {
        syncRendererState: false,
      });
      if (!imported.ok) {
        return imported;
      }

      const selectedAgeModelId = getLatestAgeModelId(imported.loadedAge.id);
      if (selectedAgeModelId) {
        document.getElementById("AgeModelSelect").value = selectedAgeModelId;
      }

      return {
        ok: true,
        loadedAge: imported.loadedAge,
        ...window.__LC_E2E__.getRendererState(),
      };
    },
    dropCoreImagesFromPath: async (inputPath) => {
      const imported = await importCoreImagesSource(inputPath, {
        depthScales: ["drilling_depth", "composite_depth", "event_free_depth", "age"],
      });
      if (!imported.ok) {
        return imported;
      }

      return {
        ok: true,
        ...window.__LC_E2E__.getRendererState(),
      };
    },
    loadCoreImagesFromPath: async (inputPath) => {
      const imported = await importCoreImagesSource(inputPath, {
        depthScales: ["drilling_depth"],
      });
      if (!imported.ok) {
        return imported;
      }

      return {
        ok: true,
        ...window.__LC_E2E__.getRendererState(),
      };
    },
    loadCoreImageBuffersForFirstSection: async () => {
      if (!LCCore) {
        return { ok: false, error: "lcmodel_not_loaded" };
      }

      const firstSection = LCCore.projects?.[0]?.holes?.[0]?.sections?.[0];
      if (!firstSection?.id) {
        return { ok: false, error: "section_not_found" };
      }

      const imageBuffers = await window.LCapi.LoadCoreImage({
        loadOptions: {
          targetIds: [firstSection.id],
          operations: [],
          dpcm: objOpts.image.dpcm,
        },
        type: "core_images",
      });
      const datasets = Object.keys(imageBuffers ?? {});
      const totalBufferCount = datasets.reduce(
        (count, dataset) => count + Object.keys(imageBuffers?.[dataset] ?? {}).length,
        0
      );

      return {
        ok: datasets.length > 0,
        datasetCount: datasets.length,
        totalBufferCount,
      };
    },
    openFloatingImageViewerForFirstSection: async () => {
      if (!LCCore) {
        return { ok: false, error: "lcmodel_not_loaded" };
      }

      if (Object.keys(modelImages?.drilling_depth ?? {}).length === 0) {
        return { ok: false, error: "core_images_not_loaded" };
      }

      const firstProject = LCCore.projects?.[0];
      const firstHole = firstProject?.holes?.[0];
      const firstSection = firstHole?.sections?.[0];
      if (!firstSection?.id) {
        return { ok: false, error: "section_not_found" };
      }

      const opened = await window.LCapi.floatingImageViewer({ targetId: firstSection.id });
      return {
        ok: opened === true,
        targetId: firstSection.id,
      };
    },
  };
  async function loadPlotData(type) {
    //LC plot age_collection id is as same as LCAge id 
    const results = await window.LCapi.LoadPlotData({ type });
    if (results!==null) {
      //load
      const dataType = results.type;
      const protocol = results.protocol;

      if(dataType=="age"){
        LCPlotAge = await unzip(results.data);;
        console.log("Age data: ", LCPlotAge);

        /*
        //set row data
        LCPlotAge.data = data;

        //conversion 
        const ageCollection = drawPointDataset();
        ageCollection.id      = LCPlotAge.data.id;
        ageCollection.name    = LCPlotAge.data.name;
        ageCollection.version = LCPlotAge.data.version;
        for(let i=0; i<LCPlotAge.data.ages.length; i++){
          const dt = LCPlotAge.data.ages[i];
          const agePData = drawPointData();
          agePData.id     = dt.id;
          agePData.type   = dt.data_type;
          agePData.name   = dt.name;
          agePData.header = "age";
          agePData.val    = dt.age_mid;
          agePData.unit   = dt.unit;

          agePData.pname = dt
          agePData.hname = dt.trinityData.hole_name;
          agePData.sname = dt.trinityData.section_name;
          agePData.dist  = dt.trinityData.distance;

          agePData.pidx = dt.;
          agePData.hidx = dt.;
          agePData.sidx = dt.;

          agePData.composite_depth  = dt.composite_depth;
          agePData.event_free_depth = dt.evemnt_free_depth;
          agePData.drilling_depth   = null;
          agePData.age    = dt.age_mid;
          agePData.ageu   = dt.age_upper_1std ? dt.age_upper_1std : dt.age_upper_2std;
          agePData.agel   = dt.age_lower_1std ? dt.age_lower_1std : dt.age_lower_2std;
          agePData.source = {code: dt.source_code, type: dt.source_type};

        }
        */
      }else if(dataType=="data"){
        if(protocol == "direct"){
          //The plot contains multiple datasets, so the conversion is performed when the plot options are loaded.
          LCPlotData = await unzip(results.data);

          
          console.log("Plot data loaded.")
          if(["root","developer"].includes(objOpts.developer.mode)){
            console.log("Plot data: ", LCPlotData);
          }
        }else if(protocol == "buffer"){
          //if buffer URL
          const res = await fetch("app://data");
          const u8  = new Uint8Array(await res.arrayBuffer());   
          LCPlotData =  msgpack.decode(u8);//;await unzip(u8);
        }
        
      }   
    }
  }
  //-------------------------------------------------------------------------------------------

  async function initialiseCorrelationModel() {
    //canvas initialise
    const parentElement = document.getElementById("hole_list");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }

    //data initialise
    LCCore = null;
    await window.LCapi.InitialiseCorrelationModel();
    lcmodel_path = null;
  }

  async function initialiseAgeModel() {
    //canvas initialise(remove all children)
    const parentElement = document.getElementById("AgeModelSelect");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }

    //data initialise
    await window.LCapi.InitialiseAgeModel();
    age_model_list = [];
  }
  async function initialisePlot() {
    //canvas initialise(remove all children)

    //data initialise
    await window.LCapi.InitialiseDataPlot();

    LCPlotAge = null;
    LCPlotData= null;
    objOpts.plotter.selected_options = [];
  }
  window.LCapi.receive("initialiseLCPlotData", async () => {
    //call from main process
    LCPlotData= null;
    objOpts.plotter.selected_options = [];

    updateView();

    if(["root","developer"].includes(objOpts.developer.mode)){
      console.log(LCPlotData)
    }
  });
  function initialiseImages(){
    let modelImages = {
      image_dir: "",
      load_target_ids: [],
      image_resolution: {},
      plot_colour:{},

      drilling_depth: {},
      composite_depth: {},
      event_free_depth: {},
      age:{},
      
      operations:[],
    };
    return modelImages
  }
  async function initialiseCanvas() {
    //canvas initialise
    const parentElement = document.getElementById("hole_list");
    while (parentElement.firstChild) {
      parentElement.removeChild(parentElement.firstChild);
    }
    
    //plot update
    //canvas initialise
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
   
  }
  async function initialisePaths(){
    await window.LCapi.InitialisePaths();
  }
  function updateView() {
    objOpts.edit.is_full_snapshot = false;
    if(isProcessing || !LCCore){return}
    //update
    if (vectorObjects == null) {
      vectorObjects = new p5(p5Sketch);
    }

    makeP5CanvasBase();
    vectorObjects.clear();
    vectorObjects.redraw();

    //update pen canvas
    if (penObject.penCanvas) {
      penObject.penCanvas.redraw();
    }
  }
  function getConnectedSectionIds(markerIds){
    let outIdList = new Set();
    for(let id of markerIds){
      const idx = getIdxById(LCCore, id);
      if(idx==null){
        console.log(id)
        continue
      }
      const sectionData = LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
      sectionData.markers.forEach(m=>{
        m.h_connection.forEach(h=>{
          outIdList.add(JSON.stringify([h[0],h[1],h[2],null]));
        })
      });
    }

    let output = [];
    for(let id of outIdList){
      output.push(JSON.parse(id));
    }

    return output;
  }
  async function getUpdatedSectionIds(mode="normal"){
    //mode: normal, depth
    const changedSectionIds = await undo("getChangedSectionIds");
    
    let ids = [];
    let details = new Set();
    for(let i=0; i< changedSectionIds.length; i++){
      const changedData = changedSectionIds[i];
      
      if(changedData.change == "updated"){
        if(mode == "depth"){
          if(changedData.details.includes("drilling_depth") || changedData.details.includes("composite_depth") || changedData.details.includes("event_free_depth") || changedData.details.includes("age")){
            ids.push(changedData.id);
            changedData.details.forEach(d=>{
              details.add(d);
            })
            if(details.size>0 && !details.has("drilling_depth")){
              details.add("drilling_depth");
            }
          }        
        }else if(mode == "normal"){
          ids.push(changedData.id);
          changedData.details.forEach(d=>{
            details.add(d);
          })
        }        
      } else if(changedData.change == "deleted"){

      } else if(changedData.change == "added"){
        if(mode == "depth"){
          if(changedData.details.includes("drilling_depth") || changedData.details.includes("composite_depth") || changedData.details.includes("event_free_depth") || changedData.details.includes("age")){
            ids.push(changedData.id);
            changedData.details.forEach(d=>{
              details.add(d);
            })
            if(details.size>0 && !details.has("drilling_depth")){
              details.add("drilling_depth");
            }
          } 
        }else if(mode == "normal"){
          ids.push(changedData.id);
          changedData.details.forEach(d=>{
            details.add(d);
          })
        }
      }
    }
    return {ids: ids, details:Array.from(details)};
  }
  
  //============================================================================================
});

//============================================================================================
//============================================================================================
//subfunctions
//============================================================================================
//============================================================================================
function binarySearchIndex(arr, target, getValueFn = (item) => item) {
  let low = 0;
  let high = arr.length - 1;

  while (low <= high) {
    const mid = (low + high) >>> 1; 
    const midVal = getValueFn(arr[mid]);

    if (midVal < target) {
      low = mid + 1;
    } else if (midVal > target) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return low; 
}
function isConnectMasterProject(LCCpre, targetId){
  let masterProjectId = null;
  for(let p=0; p<LCCpre.projects.length; p++){
    if(LCCpre.projects[p].model_type=="correlation" && LCCpre.projects[p].id[0] == LCCpre.base_project_id[0]){
      masterProjectId = LCCpre.projects[p].id;
      if(LCCpre.projects[p].id[0] === targetId[0]){
        //target is master project
        return true
      }
    }
  }

  if(!masterProjectId){
    return false;
  }

  for(let p=0; p<LCCpre.projects.length; p++){
    if(LCCpre.projects[p].id[0] !== targetId[0]){
      continue
    }
    if(LCCpre.projects[p].model_type!=="duo"){
      continue
    }
    for(let h=0; h<LCCpre.projects[p].holes.length; h++){
      for(let s=0; s<LCCpre.projects[p].holes[h].sections.length; s++){
        for(let m=0; m<LCCpre.projects[p].holes[h].sections[s].markers.length; m++){
          const marker = LCCpre.projects[p].holes[h].sections[s].markers[m];
          for(let hc=0; hc<marker.h_connection.length; hc++){
            if(marker.h_connection[hc][0]===masterProjectId[0]){
              return true;                
            }
          }
        }
      }
    }
  }
  return false
}

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
/*
function getNearestConnectedMarkerIdx(LCCore, idFrom, objOpts) {
  //objOpts.project.interval
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
      if (idx.every(id=>id!==null)){
        if (LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].isMaster) {
          isMasterConnection += 1;
        }
      }
    });
  }

  //get first connection data
  let connectedMarkerData  = null;
  let connectedHoleData    = null;
  let connectedProjectData = null;

  if(currentMarkerData.h_connection.length==0) return null;
  let idTo;
  let idxTo;
  let listTo;
  let connectedTotalOrder = Infinity;
  for (let i = 0; i < currentMarkerData.h_connection.length; i++) {
    //get 2nd or later index
    idTo = currentMarkerData.h_connection[i];
    idxTo = this.getIdxById(LCCore, idTo);
    if(idxTo.every(id=>id===null)) continue
    listTo = getListIdx(holeList, idxTo[0], idxTo[1]);

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
  if(connectedTotalOrder===Infinity) return null

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
    //check bidirectional connection
    let isBiconnect = false;
    connectedMarkerData.h_connection.forEach(hc=>{
      if(hc.toString() === idFrom.toString()){
        isBiconnect = true;
      }
    });
    if(!isBiconnect) return null;

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
  */
function getNearestConnectedMarkerIdx(LCCore, idFrom, objOpts) {
  // --- (Helper & List Generation logic remains the same) ---
  const getListIdx = (list, p, h) => {
    let output = null;
    list.forEach((hl) => {
      if (hl[3] == p && hl[4] == h) {
        output = hl[0];
      }
    });
    return output;
  };

  let holeList = [];
  for (let p = 0; p < LCCore.projects.length; p++) {
    for (let h = 0; h < LCCore.projects[p].holes.length; h++) {
      holeList.push([
        null, //0: Total Order
        LCCore.projects[p].order, //1
        LCCore.projects[p].holes[h].order, //2
        p, //3: Project Index
        h, //4: Hole Index
        LCCore.projects[p].enable, //5: Project Enable
        LCCore.projects[p].holes[h].enable, //6: Hole Enable
      ]);
    }
  }

  holeList.sort((a, b) => (a[2] < b[2] ? -1 : 1));
  holeList.sort((a, b) => (a[1] < b[1] ? -1 : 1));

  holeList.forEach((h, i) => {
    h[0] = i;
  });

  // --- (Start Marker & Connection Check logic remains same) ---
  const idxFrom  = this.getIdxById(LCCore, idFrom);
  const listFrom = getListIdx(holeList, idxFrom[0], idxFrom[1]);
  const currentTotalOrder  = holeList[listFrom][0];
  const currentMarkerData  = LCCore.projects[idxFrom[0]].holes[idxFrom[1]].sections[idxFrom[2]].markers[idxFrom[3]];
  const currentHoleData    = LCCore.projects[idxFrom[0]].holes[idxFrom[1]];
  const currentProjectData = LCCore.projects[idxFrom[0]];

  let isMasterConnection = 0;
  if (currentMarkerData.h_connection == null || currentMarkerData.h_connection.length == 0) {
    return null;
  } else {
    currentMarkerData.h_connection.forEach((c) => {
      const idx = this.getIdxById(LCCore, c);
      if (idx.every(id=>id!==null)){
        if (LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].isMaster) {
          isMasterConnection += 1;
        }
      }
    });
  }

  // --- (Find Nearest Connection Logic) ---
  let connectedMarkerData  = null;
  let connectedHoleData    = null;
  let connectedProjectData = null;

  if(currentMarkerData.h_connection.length==0) return null;
  let idTo;
  let idxTo;
  let listTo;
  let connectedTotalOrder = Infinity;
  
  for (let i = 0; i < currentMarkerData.h_connection.length; i++) {
    idTo = currentMarkerData.h_connection[i];
    idxTo = this.getIdxById(LCCore, idTo);
    if(idxTo.every(id=>id===null)) continue
    listTo = getListIdx(holeList, idxTo[0], idxTo[1]);

    // Check Project & Hole Enable
    const isTargetEnable = LCCore.projects[idxTo[0]].enable && LCCore.projects[idxTo[0]].holes[idxTo[1]].enable;

    if (connectedHoleData !== null) {
      if (holeList[listTo][0] > currentTotalOrder && holeList[listTo][0] < connectedTotalOrder && isTargetEnable ) {
        connectedMarkerData  = LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
        connectedHoleData    = LCCore.projects[idxTo[0]].holes[idxTo[1]];
        connectedProjectData = LCCore.projects[idxTo[0]];
        connectedTotalOrder  = holeList[listTo][0];
      }
    } else {
      if (holeList[listTo][0] > currentTotalOrder && isTargetEnable) {
        connectedMarkerData  = LCCore.projects[idxTo[0]].holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[3]];
        connectedHoleData    = LCCore.projects[idxTo[0]].holes[idxTo[1]];
        connectedProjectData = LCCore.projects[idxTo[0]];
        connectedTotalOrder  = holeList[listTo][0];
      }
    }
  }
  if(connectedTotalOrder===Infinity) return null

  // --- (Range Calculation) ---
  if (connectedHoleData == null) return null;

  let betweenRange = [];
  holeList.forEach((btl, b) => {
    if (btl[1] == currentProjectData.order && btl[2] == currentHoleData.order) {
      betweenRange[0] = b;
    }
    if (btl[1] == connectedProjectData.order && btl[2] == connectedHoleData.order) {
      betweenRange[1] = b;
    }
  });

  const numBetween = betweenRange[1] - betweenRange[0];
  const numTotal = betweenRange[1] - 0;
  
  // --- [Correction] Calculate disabled spaces ---
  let numProject = 0;
  let numBetweenDisable = 0;
  let numTotalDisable = 0;

  // Get interval value (default to 0 if undefined)
  const projectInterval = (objOpts && objOpts.project && objOpts.project.interval) ? objOpts.project.interval : 0;

  // 1. Total Range Loop (0 to End)
  let totalDisabledProjects = new Set();
  for (let i = 0; i < betweenRange[1]; i++) {
    // Check if Project is disabled
    if (holeList[i][5] === false) {
      numTotalDisable += 1; // Add hole count
      totalDisabledProjects.add(holeList[i][1]); // Record Project ID
    } 
    // Check if Project is enabled but Hole is disabled
    else if (holeList[i][6] === false) {
      numTotalDisable += 1;
    }
  }
  // Add (number of disabled projects * interval) to total disabled count
  numTotalDisable += (totalDisabledProjects.size * projectInterval);


  // 2. Between Range Loop (Start to End)
  let projList = new Set();
  let betweenDisabledProjects = new Set();

  for (let b = betweenRange[0]; b < betweenRange[1] + 1; b++) {
    // Count numProject only if Project is enabled
    if (holeList[b][5] === true) {
      if (!projList.has(holeList[b][1])) {
        projList.add(holeList[b][1]);
        numProject += 1;
      }
      
      // If Project is enabled and Hole is disabled, count as disable
      if (holeList[b][6] === false) {
        numBetweenDisable += 1;
      }
    } else {
      // If Project is disabled
      numBetweenDisable += 1; // Add hole count
      betweenDisabledProjects.add(holeList[b][1]); // Record Project ID
    }
  }
  // Add (number of disabled projects * interval) to between disabled count
  numBetweenDisable += (betweenDisabledProjects.size * projectInterval);


  // --- (Output & Next Logic) ---
  if (connectedMarkerData == null) {
    return null;
  } else {
    let isBiconnect = false;
    connectedMarkerData.h_connection.forEach(hc=>{
      if(hc.toString() === idFrom.toString()){
        isBiconnect = true;
      }
    });
    if(!isBiconnect) return null;

    let isNext = false;
    const idxTo = this.getIdxById(LCCore, connectedMarkerData.id);
    
    // Effective distance (in Hole units) = Raw distance - (Disabled holes + Interval of disabled projects)
    const validDistance = betweenRange[1] - betweenRange[0] - numBetweenDisable;

    if (validDistance == 1) {
      isNext = true;
      
      // If projects are different and an interval is set, there is a physical gap 
      // even if no disabled projects exist in between, so returns false.
      if (currentProjectData.order !== connectedProjectData.order) {
         if (projectInterval > 0) {
            isNext = false;
         }
      }
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

  try{
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
  }catch(err){
    console.error(err)
    return null;
  }
}
function getDataFromId(LCCore, id){
  const idx = getIdxById(LCCore, id);
  const nullIndex = idx.indexOf(null);
  const validLevels = nullIndex !== -1 ? nullIndex : idx.length;

  switch (validLevels) {
    case 4:
      return LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]];
    case 3:
      return LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]];
    case 2:
      return LCCore.projects[idx[0]].holes[idx[1]];
    case 1:
      return LCCore.projects[idx[0]];
    default:
      return null;
  }
}
function countMaster(LCCore, markerData, calcRange="project"){
  let results = {own: 0, horizontal:0, total :0};
  if(!markerData){
    return results
  }

  if (markerData.isMaster){
    results.own +=1;
  }
     
  markerData.h_connection.forEach(hid=>{
    const idx = getIdxById(LCCore, hid);
    if(idx){
      if(calcRange == "project"){
        if(markerData.id[0]===hid[0]){
          if(LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].isMaster){
            results.horizontal++;
          }
        }
      }else{
        if(LCCore.projects[idx[0]].holes[idx[1]].sections[idx[2]].markers[idx[3]].isMaster){
          results.horizontal++;
        }
      } 
    }
  })

  results.total = results.own + results.horizontal;
  return results;
}
function isPointInRect(point, rect) {
  return (
    point[0] >= rect[0] &&
    point[0] <= rect[0] + rect[2] &&
    point[1] >= rect[1] &&
    point[1] <= rect[1] + rect[3]
  );
}
async function getFooterInfo(LCCore, hittest, objOpts) {
  let txt = "---";

  if (!LCCore) {
    return txt;
  }

  //get age
  let age = "---)";
  if(hittest.project!==null && hittest.hole!==null && hittest.section!==null){
    const targetId = [hittest.project, hittest.hole, hittest.section, null];
    if(hittest == undefined){
      return txt;
    }

    const options = {
      sourceType: objOpts.canvas.depth_scale,
      polationType: "linear",  
      allowOutside: false
    };

    const calcedData = await window.LCapi.depthConverter({
      dataList: [["", hittest.y, targetId]],
      options,
    });
    age = calcedData !== null ? calcedData.age_mid.toFixed(objOpts.age.age_precision) + " calBP)" : "---)";
  }

  let trinityData = "[----]";
  if(hittest.sectionName){
    trinityData = " ["+hittest.holeName+"-"+hittest.sectionName+"]";
  }
   
  if (objOpts.canvas.depth_scale == "age") {
  txt = "Age: " + hittest.y.toFixed(objOpts.age.age_precision) + " calBP";
  }else if (objOpts.canvas.depth_scale == "composite_depth") {
    txt =
      "Composite Depth: " +
      (hittest.y/100).toFixed(2) +
      " m (Age: " +
      age + 
      trinityData
  } else if (objOpts.canvas.depth_scale == "event_free_depth") {
    txt =
      "Event Free Depth: " +
      (hittest.y/100).toFixed(2) +
      " m (Age: " +
      age;
  } else if (objOpts.canvas.depth_scale == "drilling_depth") {
    txt = 
      "Drilling Depth: " + 
      (hittest.y/100).toFixed(2) + 
      " m (Age: " +
      age
  } else if (["root"].includes(objOpts.developer.mode)) {
    txt = "Canvas Position: [x: " + hittest.raw_x.toFixed(2) + ",y: " + hittest.raw_y.toFixed(2) + "]";
  } else if (objOpts.canvas.depth_scale == "real_position") {
    txt = "Canvas Position: [x: " + hittest.x.toFixed(2) + ",y: " + hittest.y.toFixed(2) + "]";
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
      if (objOpts.canvas.depth_scale == "drilling_depth" || objOpts.canvas.depth_scale == "composite_depth" || objOpts.canvas.depth_scale == "event_free_depth" || objOpts.canvas.depth_scale == "age") {
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

async function loadPlotIcons(agePlotIcons, objOpts) {
  new p5(async (p) => {
    agePlotIcons["none"] = await createCircleImage(
      p,
      objOpts.age.incon_size,
      objOpts.age.alt_radius,
      "#000000"
    );
    for (let key in objOpts.age.incon_list) {
      const im = objOpts.age.incon_list[key][0];
      const colour = objOpts.age.incon_list[key][1];
      agePlotIcons[key] = await p.loadImage(
        im,
        async () => {
          //console.log("");
        },
        async () => {
          console.log("Fail to load image of " + key);
          agePlotIcons[key] = await createCircleImage(
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

function sortProjectByOrder(LCCore) {
  LCCore.projects.sort((a, b) => {
      return a.order - b.order;
  });
  return LCCore;
}

function sortHoleByOrder(LCCore) {
  LCCore.projects.forEach((project) => {
    project.holes.sort((a, b) => {
      return a.order - b.order;
    });
  });
  return LCCore;
}
/*
async function unzip(result){
  if(result !== null){
    //unzip
    const cs = new DecompressionStream('gzip');
    const decompressedStream = new Response(
      new Blob([result]).stream().pipeThrough(cs)
    );
    const decompressed = await decompressedStream.text();
    
    return JSON.parse(decompressed);
  }else{
    return null
  }
}
  */
async function unzip(result) {
  console.time("unzip: ")
  if (result == null) {
    console.timeEnd("unzip: ")
    return null;
  }

  // normalize to Uint8Array
  let u8;
  if (result instanceof Uint8Array) {
    u8 = result;
  } else if (result instanceof ArrayBuffer) {
    u8 = new Uint8Array(result);
  } else {
    // Blob ,Response 
    const buf = await result.arrayBuffer();
    u8 = new Uint8Array(buf);
  }

  const isGzip =
    u8.length >= 3 &&
    u8[0] === 0x1f &&
    u8[1] === 0x8b &&
    u8[2] === 0x08;

  try {
    let decodedData;

    if (isGzip) {
      // 1. Gunzip
      const ds = new DecompressionStream('gzip');
      const blob = new Blob([u8]);
      const stream = blob.stream().pipeThrough(ds);
      const response = new Response(stream);
      
      const arrayBuffer = await response.arrayBuffer();

      // 2. MessagePack decode
      decodedData = msgpack.decode(new Uint8Array(arrayBuffer));
    }else{
      decodedData = msgpack.decode(u8);
    }
    
    console.timeEnd("unzip: ")
    return decodedData;

  } catch (e) {
    console.error("[renderer] Gzip is failed to unzip:", e);
    console.timeEnd("unzip: ")
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
//--------------------------------------------------------------------------------------------------
async function createCircleImage(p, canvasSize, radius, color) {
  let fallbackImg = p.createGraphics(canvasSize, canvasSize);
  fallbackImg.clear();
  fallbackImg.fill(color);
  fallbackImg.ellipse(canvasSize / 2, canvasSize / 2, radius * 2, radius * 2);
  return fallbackImg;
}

function isInside(rectA, rectB, pad=[0,0]) {
  if (
    rectA.x + rectA.width + pad[0] < rectB.x ||
    rectB.x + rectB.width < rectA.x - pad[0]
  ) {
    return false;
  }
  if (
    rectA.y + rectA.height + pad[1] < rectB.y ||
    rectB.y + rectB.height < rectA.y - pad[1]
  ) {
    return false;
  }
  return true;
}
async function undo(type, name="unnamed"){
  return new Promise(async(resolve, reject)=>{
    let result;
    if(type == "undo"){
      result = await window.LCapi.sendUndo({ type: "main" });
      console.log("[Renderer]: received undo data: ",result);
    }else if(type == "redo"){
      result = await window.LCapi.sendRedo({ type: "main" });
      console.log("[Renderer]: received redo data: ",result);
    }else if(type == "save"){
      result = await window.LCapi.sendSaveState({
        type: "main",
        name,
      });
    }else if(type == "getChangedSectionIds"){
      result = await window.LCapi.getChangedSectionIds({
        type: "main",
        numPrevious: 1,
      });
    }

     resolve(result);
  })
}
async function updateImageRegistration(modelImages, LCCore){
  return new Promise(async (resolve, reject) => {
    modelImages.load_target_ids = [];
    for(let p of LCCore.projects){
      for(let h of p.holes){
        for(let s of h.sections){
          //check loaded im
          const im_in_array = modelImages.drilling_depth[h.name+"-"+s.name];
          //check folder im
          //console.log(modelImages.image_dir, h.name+"-"+s.name+".jpg")
          if(Object.keys(modelImages.drilling_depth).length > 0){
            const isImExist = await window.LCapi.CheckImagesInDir({ fileName: h.name+"-"+s.name+".jpg" });
            //console.log(h.name+"-"+s.name,  isImExist)

            // /im_in_dir
            if(im_in_array==undefined){
              if(isImExist == true){
                //add case
                modelImages.load_target_ids.push(s.id);//add load list
              }
            }else{
              if(isImExist == false){
                //remove case
                delete modelImages.drilling_depth[h.name+"-"+s.name];
                delete modelImages.composite_depth[h.name+"-"+s.name];
                delete modelImages.event_free_depth[h.name+"-"+s.name];
                delete modelImages.age[h.name+"-"+s.name];
              }
            }

          }
        }
      }
    }

    console.log(modelImages);
    if(modelImages.load_target_ids.length == 0){
      modelImages.load_target_ids = null;
      console.log("[Renderer]: No images added.")
    }

    resolve(modelImages);
  });
  
}
async function loadCoreImages(modelImages, LCCore, objOpts, operations) {

  //await window.LCapi.progressbar("Load images"+depthScale, txt);
  //await window.LCapi.updateProgressbar(1, 1);

  //check operations
  
  for (const op in objOpts.image.is_load_enabled) {
    if(!objOpts.image.is_load_enabled[op]){
      operations = operations.filter(item => item !== op);
    }
  }  
  
  return new Promise(async (resolve, reject) => {
    //initialise
    let results = modelImages;

    try{
      //check
      if (LCCore == null) {
        console.log("[Renderer]: There is no LCCore.");
        await window.LCapi.updateProgressbar({ current: 1, total: 1 });
        resolve(results);
        return;
      }
      
      if (operations.includes("composite_depth") || operations.includes("event_free_depth") || operations.includes("age")) {
        if(!operations.includes("drilling_depth")){
          if (Object.keys(modelImages.drilling_depth).length == 0) {
            console.log("[Renderer]: There is no original image.");
            await window.LCapi.updateProgressbar({ current: 1, total: 1 });
            resolve(results);
            return;
          }
        }
      
      }

      //get target image list
      let N = 0;
      if(modelImages.load_target_ids !== null){
        if(modelImages.load_target_ids.length == 0){
          //case all
          console.log("[Renderer]: Load all images]")
          LCCore.projects.forEach((p) => {
            p.holes.forEach((h) => {
              h.sections.forEach((s) => {
                results.load_target_ids.push(s.id);
                if ((h.name+"-"+s.name) in modelImages.image_resolution){
                }else{
                  results.image_resolution[h.name+"-"+s.name] = objOpts.image.dpcm;
                }
              });
            });
          });
        }else{
          //case target
          console.log("[Renderer]: Load selected images]")
        }
        
        N = results.load_target_ids.length;
      }else{
        N=0;
        results.load_target_ids=[];
      }
      
      if(N==0){
        console.log("[Renderer]: There is no update image.")
        await window.LCapi.updateProgressbar({ current: 1, total: 1 });
        resolve(results);
        return;
      }

      const loadOptions = {
        targetIds:results.load_target_ids, 
        operations:operations,
        dpcm:results.image_resolution,//dpcm:objOpts.image.dpcm,
      };
      console.log(loadOptions)
      
      //main Progress   
      try{
        //load image
        const imageBuffers = await window.LCapi.LoadCoreImage({
          loadOptions,
          type: "core_images",
        });
        //const imageBuffers = await new Promise(async(resolve, reject)=>{
        //  const imBufferDict = await window.LCapi.LoadCoreImage(loadOptions,"core_images");
        //  resolve(imBufferDict)
        //}) 

        results = await assignCoreImages(results, imageBuffers);

        for (const ds of Object.keys(imageBuffers || {})) {                 
          for (const k in imageBuffers[ds]) delete imageBuffers[ds][k];     
          delete imageBuffers[ds];                                          
        } 


        results.load_target_ids = [];
      }catch(err){
        console.error(err)
      }
      
      resolve(results);
    }catch(err){
      console.error(err);
      reject(results);
    }
  });

}
async function assignCoreImages(coreImages, imageBuffers) {
  const allowedScalses = ["drilling_depth", "composite_depth", "event_free_depth", "age"];
  let results = coreImages;
  let suc = 0; 
  let N = 0;
  for(const depthTyep in imageBuffers){
    N += Object.keys(imageBuffers[depthTyep]).length;
  }

  try{
    await new Promise((resolve, reject) => {
      new p5(async (p) => {
        try {
          await window.LCapi.progressbar({ title: "Assigning images", text: "Now assigning...", indeterminate: true });
          //await window.LCapi.updateProgressbar(0, N, "");
          let n = 0;
          if(imageBuffers==null){
            console.log("[Renderer]: Failed to assign images because there are no loaded images.");
            //await window.LCapi.updateProgressbar(N, N, "");
            await window.LCapi.clearProgressbar();
            //reject();
            resolve();
          }
  
          const promises = [];
  
          for (const depthScale of Object.keys(imageBuffers)) {
            if (!allowedScalses.includes(depthScale)){
              continue;
            }
            for (const imName in imageBuffers[depthScale]) {
              const promise = new Promise(async (resolveImage) => {
                try {
                  let blob = new Blob([imageBuffers[depthScale][imName]], { type: 'image/jpeg' });
                  let url = URL.createObjectURL(blob);

                  if (results[depthScale][imName]) { 
                    results[depthScale][imName] = undefined; 
                  }

                  results[depthScale][imName] = await new Promise((resolveImg, rejectImg)=>{
                    p.loadImage(
                      url,
                      img => {
                        suc += 1;
                        setTimeout(() => URL.revokeObjectURL(url),0);
                        blob = null;
                        resolveImg(img);
                      },
                      () => {
                        results[depthScale][imName] = undefined;
                        setTimeout(() => {try { URL.revokeObjectURL(url); } catch(_) {}},0)
                        
                        blob = null;
                        resolveImg(undefined);
                      }
                    );
                  });

                  results.plot_colour[imName] = false; 
                  resolveImage();
                } catch (err) {
                  console.error(err);
                  
                  imageBuffers[depthScale][imName] = null; delete imageBuffers[depthScale][imName];
                  resolveImage();
                }
  
                n+=1;
                //await window.LCapi.updateProgressbar(n, N, "");
              });
              promises.push(promise);            
            }
          }
          
          await Promise.all(promises);
          for (const ds of Object.keys(imageBuffers || {})) { for (const k in imageBuffers[ds]) delete imageBuffers[ds][k]; delete imageBuffers[ds]; }
          
          resolve(results);
        } catch (err) {
          console.error(err)
          reject(err);
        }
      });
    });

    await window.LCapi.clearProgressbar();
    console.log("[Renderer]: Load " + suc + " images / " + N + " models(DD, CD, EFD, Age).");
    return results;
  }catch(err){
    console.error("[Renderer]: An error occurred during image assignment:", err);
    await window.LCapi.clearProgressbar();
    return results;
  }  
}

async function loadResourcePath(objOpts){
  let path = null;
  try {
   // path = await window.LCapi.getResourcePath();
    objOpts.age.incon_list = path;
    console.log(path);
    return path;
  } catch {
    console.error("Failed to load resource path", error);

  }
}
function loadToolIcons(objOpts) {
  for (let key in objOpts.interface.icon_list) {
    try {
      data =  objOpts.interface.icon_list[key];
      document.getElementById(key).querySelector("img").src = data;
    }catch(err){
      console.error(err)
    }
  }
}
//--------------------------------------------------------------------------------------------------
function getClickedItemIdx(mouseX, mouseY, LCCore, objOpts){
  
  const xMag  = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
  let yMag    = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
  const pad_x = objOpts.canvas.pad_x;
  let pad_y   = objOpts.canvas.pad_y;
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

  let results = {
    x:x, 
    y:y, //real scale
    relative_x:null,
    relative_y:null,
    raw_x:mouseX,
    raw_y:mouseY,
    depth_scale:objOpts.canvas.depth_scale, 
    project:null, //single id
    hole:null, //single id
    section:null, //single id
    distance:null, 
    nearest_marker: null, 
    nearest_distance:null,
    upper_marker:null,
    lower_marker:null,
    projectName:null,
    holeName:null,
    sectionName:null,
    markerName:null,
    projectIdx:null,
    holeIdx:null,
    sectionIdx:null,
    markerIdx:null,
  };
  
  if(!LCCore){return results}

  breakpoint:
  for(let p=0; p<LCCore.projects.length; p++){
    if(!LCCore.projects[p].enable){
      num_hole.disable += objOpts.project.interval;
    }

    let num_enable_right = 0;
    LCCore.projects[p].holes.forEach(hc=>{
      if(hc.enable){
        num_enable_right++;
      }
    })
    /*
    let num_enable_left = 0;
    LCCore.projects.filter(p1=>p1.order<LCCore.projects[p].order).forEach(p2=>p2.holes.forEach(h1=>{if(h1.enable){num_enable_left++;}}))
      
    //const project_x0 = ((objOpts.section.width + objOpts.hole.distance) * num_enable_left + shift_x) * xMag + pad_x - 3;
    //const project_w  = (objOpts.section.width + objOpts.hole.distance) * num_enable_right * xMag - objOpts.hole.distance/2;
    //const project_x0 = -objOpts.project.pad_x + ((objOpts.section.width + objOpts.hole.distance) * prj_num_enable_left + shift_x) * xMag + pad_x
    const project_x0 = -objOpts.project.pad_x/xMag + (objOpts.section.width + objOpts.hole.distance) * (num_enable_left + objOpts.project.interval*p);//  + 1;
    let project_w    = -objOpts.project.pad_x/xMag + (objOpts.section.width + objOpts.hole.distance)  * (num_enable_right + 1);
    */
    const active_projects_before = LCCore.projects.filter(proj => proj.order < LCCore.projects[p].order && proj.enable).length;

    let num_enable_left = 0;
    LCCore.projects.filter(p1 => p1.order < LCCore.projects[p].order && p1.enable).forEach(p2 => {
      p2.holes.forEach(h1 => {
        if(h1.enable){ num_enable_left++; }
      });
    });

    const project_x0 = -objOpts.project.pad_x/xMag + (objOpts.section.width + objOpts.hole.distance) * (num_enable_left + objOpts.project.interval * active_projects_before);
    let project_w = -objOpts.project.pad_x/xMag + (objOpts.section.width + objOpts.hole.distance) * (num_enable_right + 1);
    
    if(num_enable_right == 0){
      project_w = (objOpts.hole.distance + objOpts.hole.width);
    }
    const project_x1 = project_x0 + project_w;
    if(x >= project_x0 && x <= project_x1){
      results.project = LCCore.projects[p].id[0];
      results.projectName = LCCore.projects[p].name;
      results.projectIdx  = p;
    }

    for(let h=0; h<LCCore.projects[p].holes.length; h++){     
      if(!LCCore.projects[p].holes[h].enable){
        num_hole.disable += 1;
      }
      const hole_x0 = (objOpts.hole.distance + objOpts.hole.width) * (num_hole.total + LCCore.projects[p].holes[h].order - num_hole.disable);
      const hole_x1 = hole_x0 + objOpts.hole.width;
      if(x >= hole_x0 && x <= hole_x1){
        results.hole    = LCCore.projects[p].holes[h].id[1];
        results.relative_x = (x-hole_x0)/(hole_x1-hole_x0);
        results.holeName = LCCore.projects[p].holes[h].name;
        results.holeIdx = h;

        const section_order=[];
        for(let s=0; s<LCCore.projects[p].holes[h].sections.length; s++){
          section_order.push([s, LCCore.projects[p].holes[h].sections[s].order])
        }
        section_order.sort((a,b)=>b[1]-a[1]);

        for(let so=0; so<LCCore.projects[p].holes[h].sections.length; so++){
          const s= section_order[so][0];
          const sec_y0 = LCCore.projects[p].holes[h].sections[s].markers[0][objOpts.canvas.depth_scale];//cd/efd
          const sec_y1 = LCCore.projects[p].holes[h].sections[s].markers.slice(-1)[0][objOpts.canvas.depth_scale];//cd/efd

          if(y >= sec_y0 && y <= sec_y1){
            results.section = LCCore.projects[p].holes[h].sections[s].id[2];
            results.relative_y = (y-sec_y0)/(sec_y1-sec_y0);
            results.sectionName = LCCore.projects[p].holes[h].sections[s].name;
            results.sectionIdx = s;
            let upperIdx = null;
            let lowerIdx = null;
            let lowerDistance = Infinity;
            let upperDistance = -Infinity;

            for(let m=0; m<LCCore.projects[p].holes[h].sections[s].markers.length; m++){
              const marker_y0 = LCCore.projects[p].holes[h].sections[s].markers[m][objOpts.canvas.depth_scale];

              if(marker_y0 - y <= 0 && Math.abs(upperDistance) >= Math.abs(marker_y0 - y)){
                upperDistance = marker_y0 - y;
                upperIdx = m;
              }

              if(marker_y0 - y > 0 && Math.abs(lowerDistance) >= Math.abs(marker_y0 - y) && upperIdx+1==m){
                //if erosion, some layers with same distance exist 
                lowerDistance = marker_y0 - y;
                lowerIdx = m;
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
            results.nearest_marker   = LCCore.projects[p].holes[h].sections[s].markers[nearestIdx].id[3];   
            results.markerName       = LCCore.projects[p].holes[h].sections[s].markers[nearestIdx].name;
            results.upper_marker     = LCCore.projects[p].holes[h].sections[s].markers[upperIdx].id[3];
            results.markerIdx = nearestIdx;
            if(lowerIdx !== null){
              results.lower_marker = LCCore.projects[p].holes[h].sections[s].markers[lowerIdx].id[3];
            }            

            break breakpoint;
          }     
        }  
      }
    }  
    num_hole.total += LCCore.projects[p].holes.length + objOpts.project.interval;
  }
  
  return results;
}

function getPlotPosiotion(data, LCCore, objOpts){
  //legacy style for age points
  /*
  data = {
    type:"age",
    x:,
    min_x,
    
    project_name:,
    hole_name:,
    section_name:,
    distance:,
    
    comspoite_depth:,
    evemnt_free_depth:,
    age:,

    amplification_x:,
    amplification_y:,    
  }
  */

  //initialise
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

  let result ={
    hole_name:data.hole_name,
    section_name:data.section_name,
    original_x: data.x, //data value
    original_y: data[objOpts.canvas.depth_scale], //depth
    pos_canvas_x: NaN,
    pos_canvas_y: NaN,      
  };

  if(data[objOpts.canvas.depth_scale]==null){
    return result
  }
  
  //get hole
  let hole = null;
  let isSkip = false;
  let num_hole = {enable:0, disable:0};
  if (data.original_depth_type == "trinity") {
    //plot next to core    
    outerloop:
    for (let po = 0; po < LCCore.projects.length; po++) {
      for (let ho = 0; ho < LCCore.projects[po].holes.length; ho++) {
        const hole_temp = LCCore.projects[po].holes[ho];
        if (hole_temp.name == data.hole_name){
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
      return result;
    }
    
    //calc position
    if(data.type == "age"){
      //age xpos is fixed. adjust icon size
      result.pos_canvas_x = ((objOpts.hole.distance + objOpts.hole.width) * (num_hole.enable -1 ) + shift_x) * xMag + pad_x + objOpts.hole.width * xMag - objOpts.age.incon_size * 1.2;
      
      //age ypos, adjust icon size
      if(data[objOpts.canvas.depth_scale] !== null){
        result.pos_canvas_y = (data[objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;
      }
    } else{
      //data xpos, without adjust
      if(data.x !== null){
        result.pos_canvas_x = ((objOpts.hole.distance + objOpts.hole.width) * (num_hole.enable -1 ) + (data.x - data.min_x) * data.amplification_x + shift_x) * xMag + pad_x;
      }
      //data ypos, without adjust
      if(data[objOpts.canvas.depth_scale] !== null){
        result.pos_canvas_y = (data[objOpts.canvas.depth_scale]  * data.amplification_y + shift_y) * yMag + pad_y;
      }
    }
    //------------------------------------------------
  } else {
    //case depth source is CD, EFD, AGE
    if(data.type == "age"){
      const age_shift_x = -50;
      result.pos_canvas_x = age_shift_x + shift_x * xMag + pad_x - objOpts.age.incon_size * 1.2;
      result.pos_canvas_y = (data[objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;
    }else{
      result.pos_canvas_x  = ((data.x - data.min_x) * data.amplification_x + shift_x) * xMag + 20;
      result.pos_canvas_y  = (data[objOpts.canvas.depth_scale] * data.amplification_y + shift_y) * yMag + pad_y;
    }
  }

  return result
}

function drawPointDataset(){
  const output = {
    //id: null,
    //name: null,
    //version: null,

    zoom_level: 0,
    max: null,
    min: null,
    is_resampled: false,

    data: [],
    depth_map:{
      drilling_depth:[],
      composite_depth:[],
      event_free_depth:[],
      age:[],
    },
  };

  return output
}
function drawPointData(data=null, LCCore=null){
  const output = {
    id: null,
    idx:null,
    type: null,
    name: null,
    header: null,
    val: null,
    unit:null,

    pname: null,
    hname: null,
    sname: null,
    dist: null,

    pidx: null,
    hidx: null,
    sidx: null,

    composite_depth: null,
    event_free_depth: null,
    drilling_depth: null,
    age: null,
    ageu: null,
    agel: null,
    source: null,

    pos_x: null,
    pos_y: null
  };
  
  if(data){
    output.id     = data[0];
    output.type   = null;
    output.name   = data[1];
    output.header = null;
    output.val    = null;

    output.pname  = data[2];
    output.hname  = data[3];
    output.sname  = data[4];
    output.dist   = data[5];
    output.composite_depth  = data[6];
    output.event_free_depth = data[7];
    output.drilling_depth   = data[8];
    output.age    = data[9];
    output.ageu   = data[10];
    output.agel   = data[11];
    output.source = data[12];// == "trinity" ? "trinity" : "global";

    output.pos_x  = null;
    output.pos_y  = null;
  }

  if(LCCore){
    LCCore.projects.forEach((project, p)=>{
      if(equalName(project.name, output.pname)){
        project.holes.forEach((hole, h)=>{
          if(equalName(hole.name, output.hname)){
            hole.sections.forEach((section, s)=>{
              if(equalName(section.name, output.sname)){
                output.pidx = p;
                output.hidx = h;
                output.sidx = s;
              }
            })
          }
        })
      }
    })    
  }

  return output;
}
function resamplePointData(inDataset, th, objOpts){
  //resample top dataset
  const numeratorDataset1 = drawPointDataset();

  let idxs = [];
  let val_max = -Infinity;
  let val_min = Infinity;
  for(let d=0; d<inDataset[0].data.length; d++){
    idxs.push(d);

    if(idxs.length==1){
      //start              
      continue
    }else{
      const startProjName = inDataset[0].data[idxs[0]].pname;
      const startHoleName = inDataset[0].data[idxs[0]].hname;
      const startSecName  = inDataset[0].data[idxs[0]].sname;
      const currtProjName = inDataset[0].data[d].pname;
      const currtHoleName = inDataset[0].data[d].hname;
      const currtSecName  = inDataset[0].data[d].sname;
      const startPos      = inDataset[0].data[idxs[0]][objOpts.canvas.depth_scale];
      const currtPos      = inDataset[0].data[d][objOpts.canvas.depth_scale];

      if(startProjName === currtProjName && startHoleName === currtHoleName && startSecName === currtSecName){
        //if same section                 
        if(currtPos - startPos <= th){
          //if in threshold
          continue
        }else{
          //if out of threshold
          const nextIdx = idxs.pop();
          // composite_depth
          let vals = idxs.map(i => { const val = inDataset[0].data[i].composite_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mCD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // event_free_depth
          vals = idxs.map(i => { const val = inDataset[0].data[i].event_free_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mEFD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // drilling_depth
          vals = idxs.map(i => { const val = inDataset[0].data[i].drilling_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mDD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // age
          vals = idxs.map(i => { const val = inDataset[0].data[i].age; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mAge = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // ageu
          vals = idxs.map(i => { const val = inDataset[0].data[i].ageu; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mAgeu = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // agel
          vals = idxs.map(i => { const val = inDataset[0].data[i].agel; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mAgel = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // dist
          vals = idxs.map(i => { const val = inDataset[0].data[i].dist; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mDist = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // val
          vals = idxs.map(i => { const val = inDataset[0].data[i].val; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mVal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          //name
          const names = `${inDataset[0].data[idxs[0]].name}<->${inDataset[0].data[idxs[idxs.length-1]].name} [N=${idxs.length}]`;


          //calc max/min
          if (Number.isFinite(mVal)){
            if(mVal < val_min){
              val_min = mVal;
            }

            if(mVal > val_max){
              val_max = mVal;
            }
          }

          //apply
          const newPointData = drawPointData()

          newPointData.id = inDataset[0].data[idxs[0]].id;
          newPointData.type = inDataset[0].data[idxs[0]].type
          newPointData.name = names;
          newPointData.header = inDataset[0].data[idxs[0]].header;
          newPointData.unit   = inDataset[0].data[idxs[0]].unit;
          newPointData.val = mVal;

          newPointData.pname = startProjName;
          newPointData.hname = startHoleName;
          newPointData.sname = startSecName;

          newPointData.pidx  = inDataset[0].data[idxs[0]].pidx;
          newPointData.hidx  = inDataset[0].data[idxs[0]].hidx;
          newPointData.sidx  = inDataset[0].data[idxs[0]].sidx;

          newPointData.dist  = mDist;
          newPointData.composite_depth  = mCD;
          newPointData.event_free_depth = mEFD;
          newPointData.drilling_depth   = mDD;
          newPointData.age    = mAge;
          newPointData.ageu   = mAgeu;
          newPointData.agel   = mAgel;
          newPointData.source = inDataset[0].data[idxs[0]].source;

          newPointData.pos_x = inDataset[0].data[idxs[0]].pos_x;
          newPointData.pos_y = inDataset[0].data[idxs[0]].pos_y;

          //submit
          numeratorDataset1.data.push(newPointData);
          numeratorDataset1.depth_map.drilling_depth.push({idx:d, value:mDD});
          numeratorDataset1.depth_map.composite_depth.push({idx:d, value:mCD});
          numeratorDataset1.depth_map.event_free_depth.push({idx:d, value:mEFD});
          numeratorDataset1.depth_map.age.push({idx:d, value:mAge});

          //initialise
          idxs = [nextIdx];
        }
      }else{
        //if different section, restart
        //if out of threshold
          const nextIdx = idxs.pop();
          // composite_depth
          let vals = idxs.map(i => { const val = inDataset[0].data[i].composite_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mCD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // event_free_depth
          vals = idxs.map(i => { const val = inDataset[0].data[i].event_free_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mEFD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // drilling_depth
          vals = idxs.map(i => { const val = inDataset[0].data[i].drilling_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mDD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // age
          vals = idxs.map(i => { const val = inDataset[0].data[i].age; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mAge = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // ageu
          vals = idxs.map(i => { const val = inDataset[0].data[i].ageu; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mAgeu = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // agel
          vals = idxs.map(i => { const val = inDataset[0].data[i].agel; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mAgel = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // dist
          vals = idxs.map(i => { const val = inDataset[0].data[i].dist; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mDist = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          // val
          vals = idxs.map(i => { const val = inDataset[0].data[i].val; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
          const mVal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

          const names = `${inDataset[0].data[idxs[0]].name}<-|${inDataset[0].data[idxs[idxs.length-1]].name} [N=${idxs.length}]`;

          //calc max/min
          if (Number.isFinite(mVal)){
            if(mVal < val_min){
              val_min = mVal;
            }

            if(mVal > val_max){
              val_max = mVal;
            }
          }

          //apply
          const newPointData = drawPointData()

          newPointData.id = inDataset[0].data[idxs[0]].id;
          newPointData.type = inDataset[0].data[idxs[0]].type
          newPointData.name = names;
          newPointData.header = inDataset[0].data[idxs[0]].header;
          newPointData.unit   = inDataset[0].data[idxs[0]].unit;
          newPointData.val = mVal;

          newPointData.pname = startProjName;
          newPointData.hname = startHoleName;
          newPointData.sname = startSecName;

          newPointData.pidx  = inDataset[0].data[idxs[0]].pidx;
          newPointData.hidx  = inDataset[0].data[idxs[0]].hidx;
          newPointData.sidx  = inDataset[0].data[idxs[0]].sidx;

          newPointData.dist  = mDist;
          newPointData.composite_depth  = mCD;
          newPointData.event_free_depth = mEFD;
          newPointData.drilling_depth   = mDD;
          newPointData.age    = mAge;
          newPointData.ageu   = mAgeu;
          newPointData.agel   = mAgel;
          newPointData.source = inDataset[0].data[idxs[0]].source;

          newPointData.pos_x = inDataset[0].data[idxs[0]].pos_x;
          newPointData.pos_y = inDataset[0].data[idxs[0]].pos_y;

          //submit
          numeratorDataset1.data.push(newPointData);
          numeratorDataset1.depth_map.drilling_depth.push({idx:d, value:mDD});
          numeratorDataset1.depth_map.composite_depth.push({idx:d, value:mCD});
          numeratorDataset1.depth_map.event_free_depth.push({idx:d, value:mEFD});
          numeratorDataset1.depth_map.age.push({idx:d, value:mAge});

          //initialise
          idxs = [nextIdx];
      } 
    }
  }

  //finish process
  // The last group in `idxs` may not be flushed inside the loop,
  // because no threshold break or section change occurs at the array end.
  // This block finalizes and outputs the remaining accumulated points.
  if(idxs.length>0){
    // composite_depth
    let vals = idxs.map(i => { const val = inDataset[0].data[i].composite_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mCD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // event_free_depth
    vals = idxs.map(i => { const val = inDataset[0].data[i].event_free_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mEFD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // drilling_depth
    vals = idxs.map(i => { const val = inDataset[0].data[i].drilling_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mDD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // age
    vals = idxs.map(i => { const val = inDataset[0].data[i].age; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mAge = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // ageu
    vals = idxs.map(i => { const val = inDataset[0].data[i].ageu; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mAgeu = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // agel
    vals = idxs.map(i => { const val = inDataset[0].data[i].agel; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mAgel = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // dist
    vals = idxs.map(i => { const val = inDataset[0].data[i].dist; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mDist = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // val
    vals = idxs.map(i => { const val = inDataset[0].data[i].val; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mVal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    const names = `${inDataset[0].data[idxs[0]].name}<-||${inDataset[0].data[idxs[idxs.length-1]].name} [N=${idxs.length}]`;

    //calc max/min
    if (Number.isFinite(mVal)){
      if(mVal < val_min){
        val_min = mVal;
      }

      if(mVal > val_max){
        val_max = mVal;
      }
    }

    //apply
    const newPointData = drawPointData()

    newPointData.id = inDataset[0].data[idxs[0]].id;
    newPointData.type = inDataset[0].data[idxs[0]].type
    newPointData.name = names;
    newPointData.header = inDataset[0].data[idxs[0]].header;
    newPointData.unit   = inDataset[0].data[idxs[0]].unit;
    newPointData.val = mVal;

    newPointData.pname = inDataset[0].data[idxs[0]].pname;
    newPointData.hname = inDataset[0].data[idxs[0]].hname;
    newPointData.sname = inDataset[0].data[idxs[0]].sname;

    newPointData.pidx  = inDataset[0].data[idxs[0]].pidx;
    newPointData.hidx  = inDataset[0].data[idxs[0]].hidx;
    newPointData.sidx  = inDataset[0].data[idxs[0]].sidx;

    newPointData.dist  = mDist;
    newPointData.composite_depth  = mCD;
    newPointData.event_free_depth = mEFD;
    newPointData.drilling_depth   = mDD;
    newPointData.age    = mAge;
    newPointData.ageu   = mAgeu;
    newPointData.agel   = mAgel;
    newPointData.source = inDataset[0].data[idxs[0]].source;

    newPointData.pos_x = inDataset[0].data[idxs[0]].pos_x;
    newPointData.pos_y = inDataset[0].data[idxs[0]].pos_y;

    //submit
    numeratorDataset1.data.push(newPointData);    
    numeratorDataset1.depth_map.drilling_depth.push({idx:numeratorDataset1.depth_map.drilling_depth.length, value:mDD});
    numeratorDataset1.depth_map.composite_depth.push({idx:numeratorDataset1.depth_map.composite_depth.length, value:mCD});
    numeratorDataset1.depth_map.event_free_depth.push({idx:numeratorDataset1.depth_map.event_free_depth.length, value:mEFD});
    numeratorDataset1.depth_map.age.push({idx:numeratorDataset1.depth_map.age.length, value:mAge});

  }

  //
  numeratorDataset1.max = Number.isFinite(val_max) ? val_max : null;
  numeratorDataset1.min = Number.isFinite(val_min) ? val_min : null;

  return numeratorDataset1;
}
function movingAvPointData(inDataset, th, objOpts){
  //resample top dataset
  const numeratorDataset1 = drawPointDataset();

  let val_max = -Infinity;
  let val_min = Infinity;

  const half = th / 2;

  for(let d=0; d<inDataset[0].data.length; d++){

    const currProjName = inDataset[0].data[d].pname;
    const currHoleName = inDataset[0].data[d].hname;
    const currSecName  = inDataset[0].data[d].sname;

    const currPos = inDataset[0].data[d][objOpts.canvas.depth_scale];
    const posMin  = currPos - half;
    const posMax  = currPos + half;

    // ---- centre ----
    let idxs = [];

    // backward
    for(let i=d; i>=0; i--){
      const r = inDataset[0].data[i];
      if(r.pname !== currProjName || r.hname !== currHoleName || r.sname !== currSecName){
        break;
      }
      const p = r[objOpts.canvas.depth_scale];
      if(p < posMin){
        break;
      }
      idxs.push(i);
    }

    // forward
    for(let i=d+1; i<inDataset[0].data.length; i++){
      const r = inDataset[0].data[i];
      if(r.pname !== currProjName || r.hname !== currHoleName || r.sname !== currSecName){
        break;
      }
      const p = r[objOpts.canvas.depth_scale];
      if(p > posMax){
        break;
      }
      idxs.push(i);
    }

    // sort indices (because backward added in reverse)
    idxs.sort((a,b)=>a-b);

    // composite_depth
    let vals = idxs.map(i => { const val = inDataset[0].data[i].composite_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mCD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // event_free_depth
    vals = idxs.map(i => { const val = inDataset[0].data[i].event_free_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mEFD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // drilling_depth
    vals = idxs.map(i => { const val = inDataset[0].data[i].drilling_depth; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mDD = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // age
    vals = idxs.map(i => { const val = inDataset[0].data[i].age; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mAge = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // ageu
    vals = idxs.map(i => { const val = inDataset[0].data[i].ageu; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mAgeu = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // agel
    vals = idxs.map(i => { const val = inDataset[0].data[i].agel; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mAgel = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // dist
    vals = idxs.map(i => { const val = inDataset[0].data[i].dist; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mDist = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    // val
    vals = idxs.map(i => { const val = inDataset[0].data[i].val; return val === null ? NaN : Number(val); }).filter(Number.isFinite);
    const mVal = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

    //name
    const names = `${inDataset[0].data[idxs[0]].name}<~>${inDataset[0].data[idxs[idxs.length-1]].name} [W=${th},N=${idxs.length}]`;

    //calc max/min
    if (Number.isFinite(mVal)){
      if(mVal < val_min){ val_min = mVal; }
      if(mVal > val_max){ val_max = mVal; }
    }

    //apply
    const newPointData = drawPointData()

    newPointData.id = inDataset[0].data[d].id;
    newPointData.type = inDataset[0].data[d].type
    newPointData.name = names;
    newPointData.header = inDataset[0].data[d].header;
    newPointData.unit   = inDataset[0].data[d].unit;
    newPointData.val = mVal;

    newPointData.pname = currProjName;
    newPointData.hname = currHoleName;
    newPointData.sname = currSecName;

    newPointData.pidx  = inDataset[0].data[d].pidx;
    newPointData.hidx  = inDataset[0].data[d].hidx;
    newPointData.sidx  = inDataset[0].data[d].sidx;

    newPointData.dist  = mDist;
    newPointData.composite_depth  = mCD;
    newPointData.event_free_depth = mEFD;
    newPointData.drilling_depth   = mDD;
    newPointData.age    = mAge;
    newPointData.ageu   = mAgeu;
    newPointData.agel   = mAgel;
    newPointData.source = inDataset[0].data[d].source;

    newPointData.pos_x = inDataset[0].data[d].pos_x;
    newPointData.pos_y = inDataset[0].data[d].pos_y;

    //submit
    numeratorDataset1.data.push(newPointData);
    numeratorDataset1.depth_map.drilling_depth.push({idx:d, value:mDD});
    numeratorDataset1.depth_map.composite_depth.push({idx:d, value:mCD});
    numeratorDataset1.depth_map.event_free_depth.push({idx:d, value:mEFD});
    numeratorDataset1.depth_map.age.push({idx:d, value:mAge});
  }

  numeratorDataset1.max = Number.isFinite(val_max) ? val_max : null;
  numeratorDataset1.min = Number.isFinite(val_min) ? val_min : null;

  return numeratorDataset1;
}


function dividePlotData(numeratorDataSeries, denominatorDataSeries){
  const dividedDataSeries = [];
  if(numeratorDataSeries.length>0){              
    if(denominatorDataSeries.length>0){
      //===========================================================================
      //case n/d
      for(let i = 0; i< numeratorDataSeries.length; i++){
        const dividedDataset = drawPointDataset();
        let val_max = -Infinity;
        let val_min = Infinity;
        for(let d = 0; d < numeratorDataSeries[i].data.length; d++){
          const nPdata = numeratorDataSeries[i].data[d];
          const dPdata = denominatorDataSeries[i].data[d];
          const ndPdata= drawPointData(); //base is numerator          
          
          //set val
          ndPdata.id    = nPdata.id;                 
          ndPdata.idx   = nPdata.idx;
          ndPdata.type  = nPdata.type;                 
          ndPdata.pname = nPdata.pname;
          ndPdata.hname = nPdata.hname;
          ndPdata.sname = nPdata.sname;
          ndPdata.pidx  = nPdata.pidx;
          ndPdata.hidx  = nPdata.hidx;
          ndPdata.sidx  = nPdata.sidx;
          ndPdata.dist  = nPdata.dist;
          ndPdata.composite_depth  = nPdata.composite_depth;
          ndPdata.event_free_depth = nPdata.event_free_depth;
          ndPdata.drilling_depth   = nPdata.drilling_depth;
          ndPdata.age    = nPdata.age;
          ndPdata.ageu   = nPdata.ageu;
          ndPdata.agel   = nPdata.agel;
          ndPdata.source = nPdata.source;         
                        
          //divide
          ndPdata.name   = nPdata.name+"/"+dPdata.name;
          ndPdata.header = nPdata.header+"/"+dPdata.header;
          const numeratorUnit   = nPdata.unit!=="" ? nPdata.unit : "";
          const denominatorUnit = dPdata.unit!=="" ? "·"+dPdata.unit+"⁻¹" : "";
          ndPdata.unit   = numeratorUnit + denominatorUnit;

          const nv = Number(nPdata.val);
          const dv = Number(dPdata.val);
          ndPdata.val = (Number.isFinite(nv) && Number.isFinite(dv) && dv !== 0) ? nv / dv : NaN;

          //calc max/min
          if(ndPdata.val<val_min){
            val_min = ndPdata.val;
          }
          if(ndPdata.val>val_max){
            val_max = ndPdata.val;
          }

          //submit
          dividedDataset.data.push(ndPdata);

          //set depth map
          dividedDataset.depth_map.composite_depth.push({ idx:d, value: ndPdata.composite_depth });
          dividedDataset.depth_map.drilling_depth.push({ idx:d, value: ndPdata.drilling_depth });
          dividedDataset.depth_map.event_free_depth.push({ idx:d, value: ndPdata.event_free_depth });
          dividedDataset.depth_map.age.push({ idx:d, value: ndPdata.age });
        }   

        //submit
        dividedDataset.max = Number.isFinite(val_max) ? val_max : null;
        dividedDataset.min = Number.isFinite(val_min) ? val_min : null;
        dividedDataset.zoom_level = numeratorDataSeries[i].zoom_level;

        dividedDataSeries.push(dividedDataset);        
      }
    }else{
      //======================================================================
      // case n/1
      for(let i = 0; i< numeratorDataSeries.length; i++){
        const dividedDataset = drawPointDataset();
        let val_max = -Infinity;
        let val_min = Infinity;
        for(let d = 0; d < numeratorDataSeries[i].data.length; d++){
          //divide point data 
          const nPdata = numeratorDataSeries[i].data[d];
          //submit
          dividedDataset.data.push(nPdata);

          //set depth map
          dividedDataset.depth_map.composite_depth.push({ idx:d, value: nPdata.composite_depth });
          dividedDataset.depth_map.drilling_depth.push({ idx:d, value: nPdata.drilling_depth });
          dividedDataset.depth_map.event_free_depth.push({ idx:d, value: nPdata.event_free_depth });
          dividedDataset.depth_map.age.push({ idx:d, value: nPdata.age });
        }   
        //submit
        dividedDataset.max = numeratorDataSeries[i].max;
        dividedDataset.min = numeratorDataSeries[i].min;
        dividedDataset.zoom_level = numeratorDataSeries[i].zoom_level;

        dividedDataSeries.push(dividedDataset);        
      }
    }
  }else{
    if(denominatorDataSeries.length>0){
      //===========================================================
      //case 1/d
      for(let i = 0; i< denominatorDataSeries.length; i++){
        const dividedDataset = drawPointDataset();
        let val_max = -Infinity;
        let val_min = Infinity;
        for(let d = 0; d < denominatorDataSeries[i].data.length; d++){
          const dPdata = denominatorDataSeries[i].data[d];
          const ndPdata= drawPointData(); //base is numerator
                    
          //set val
          ndPdata.id    = dPdata.id;                 
          ndPdata.idx   = dPdata.idx;
          ndPdata.type  = dPdata.type;                 
          ndPdata.pname = dPdata.pname;
          ndPdata.hname = dPdata.hname;
          ndPdata.sname = dPdata.sname;
          ndPdata.pidx  = dPdata.pidx ;
          ndPdata.hidx  = dPdata.hidx ;
          ndPdata.sidx  = dPdata.sidx ;
          ndPdata.dist  = dPdata.dist;
          ndPdata.composite_depth  = dPdata.composite_depth;
          ndPdata.event_free_depth = dPdata.event_free_depth;
          ndPdata.drilling_depth   = dPdata.drilling_depth;
          ndPdata.age    = dPdata.age;
          ndPdata.ageu   = dPdata.ageu;
          ndPdata.agel   = dPdata.agel;
          ndPdata.source = dPdata.source;
                        
          //divide
          ndPdata.name   = "1/"+dPdata.name;
          ndPdata.header = "1/"+dPdata.header;
          ndPdata.unit   = dPdata.unit!=="" ? dPdata.unit+"⁻¹" : "";

          "·"+dPdata.unit
          const dv = Number(dPdata.val);//check value
          ndPdata.val = Number.isFinite(dv) && dv !== 0 ? 1 / dv : NaN;

          //calc max/min
          if(ndPdata.val<val_min){
            val_min = ndPdata.val;
          }
          if(ndPdata.val>val_max){
            val_max = ndPdata.val;
          }

          //submit
          dividedDataset.data.push(ndPdata);

          //set depth map
          dividedDataset.depth_map.composite_depth.push({ idx:d, value: ndPdata.composite_depth });
          dividedDataset.depth_map.drilling_depth.push({ idx:d, value: ndPdata.drilling_depth });
          dividedDataset.depth_map.event_free_depth.push({ idx:d, value: ndPdata.event_free_depth });
          dividedDataset.depth_map.age.push({ idx:d, value: ndPdata.age });
        }   

        //submit
        dividedDataset.max = Number.isFinite(val_max) ? val_max : null;
        dividedDataset.min = Number.isFinite(val_min) ? val_min : null;
        dividedDataset.zoom_level = denominatorDataSeries[i].zoom_level;

        dividedDataSeries.push(dividedDataset);        
      }
    }else{
      //1/1
    }            
  }
  return dividedDataSeries
}
/*
function calcDrawPosition(drawPointDataset, LCCore, objOpts, pOptions){
  if(drawPointDataset.data.length==0){
    //console.log("[Renderer]: There is no target point data.")
    return drawPointDataset
  }

  //initialise
  const isFlip = pOptions?.isFlip ? pOptions.isFlip : false;
  const xMag  = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
  let yMag    = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
  const pad_x = objOpts.canvas.pad_x;
  let pad_y   = objOpts.canvas.pad_y;
  if (objOpts.canvas.depth_scale == "age") {
    yMag  = yMag * objOpts.canvas.age_zoom_correction[0];
    pad_y = pad_y + objOpts.canvas.age_zoom_correction[1];
  }
  const shift_x = objOpts.canvas.shift_x;
  const shift_y = objOpts.canvas.shift_y;

  const val_min = drawPointDataset.min;
  const val_max = drawPointDataset.max;
  const amp     = pOptions?.amplification ? [(objOpts.hole.width / 2) * pOptions.amplification / (val_max - val_min), 1] : 1;

  //get enable hole num
  let numEnable  = 0;
  let numDisable = 0;
  const holeEnableList = [];
  for(let p=0; p< LCCore.projects.length; p++){  
    
    if(LCCore.projects[p].enable){
      if (p > 0) {
        numEnable += objOpts.project.interval;
      }      
    }else{
      if (p > 0) {
        numDisable += objOpts.project.interval;
      } 
    }
    
    const hCounts = [];
    for(let h=0; h< LCCore.projects[p].holes.length; h++){
      
      if(LCCore.projects[p].holes[h].enable){
        numEnable += 1;
      }else{
        numDisable += 1;
      }
      hCounts.push({enable: numEnable, disable: numDisable});      
    }  
    holeEnableList.push(hCounts);
  }

  //calc
  for(let i=0; i<drawPointDataset.data.length; i++){
    const drawData = drawPointDataset.data[i];   
    
    if(drawData.source === "trinity"){
      if(drawData.pidx !== null && drawData.hidx !== null){
        if (!LCCore.projects[drawData.pidx].holes[drawData.hidx].enable) {
          drawData.pos_x = NaN;
          drawData.pos_y = NaN;
          continue;
        }
        
        const enableHoles = holeEnableList[drawData.pidx][drawData.hidx];
        //calc        
        if(drawData.type == "age"){
          //age xpos is fixed. adjust icon size
          drawData.pos_x = ((objOpts.hole.distance + objOpts.hole.width) * (enableHoles.enable -1 ) + shift_x) * xMag + pad_x + objOpts.hole.width * xMag - objOpts.age.incon_size * 1.2;
          drawData.pos_y = (drawData[objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;
        } else{
          //data xpos, without adjust
          if(Number.isFinite(drawData.val)){
            let relative_x = (drawData.val - val_min) * amp[0];
            if(isFlip){
              relative_x = objOpts.hole.width - relative_x;
            }
            drawData.pos_x = ((objOpts.hole.distance + objOpts.hole.width) * (enableHoles.enable -1 ) + relative_x + shift_x) * xMag + pad_x;
          }else{
            drawData.pos_x = NaN;
          }
          
          drawData.pos_y = (drawData[objOpts.canvas.depth_scale]  * amp[1] + shift_y) * yMag + pad_y;
        }
      }
    }else{
      //case depth source is CD, EFD, AGE
      if(drawData.type == "age"){
        const age_shift_x   = -50;
        drawData.pos_x = age_shift_x + shift_x * xMag + pad_x - objOpts.age.incon_size * 1.2;
        drawData.pos_y = (drawData[objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;
      }else{
        let relative_x = (drawData.val - val_min) * amp[0];

        if(isFlip){
          relative_x = objOpts.hole.width - relative_x;
        }

        drawData.pos_x = (relative_x + shift_x) * xMag + 20;
        drawData.pos_y = (drawData[objOpts.canvas.depth_scale] * amp[1] + shift_y) * yMag + pad_y;
      }
    }
  }

  return drawPointDataset
}
*/
function calcDrawPosition(drawPointDataset, LCCore, objOpts, pOptions) {
  if (drawPointDataset.data.length == 0) {
    //console.log("[Renderer]: There is no target point data.")
    return drawPointDataset
  }

  //initialise
  const isFlip = pOptions?.isFlip ? pOptions.isFlip : false;
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

  const val_min = drawPointDataset.min;
  const val_max = drawPointDataset.max;
  const amp = pOptions?.amplification ? [(objOpts.hole.width / 2) * pOptions.amplification / (val_max - val_min), 1] : 1;

  //get enable hole num
  let numEnable = 0;
  let numDisable = 0;
  const holeEnableList = [];

  // [Correction] Flag to track if we have encountered any visible project yet.
  // This ensures the first visible project starts at 0 without adding an interval gap.
  let hasVisibleProject = false;

  const projectInterval = (objOpts.project && objOpts.project.interval) ? objOpts.project.interval : 0;

  for (let p = 0; p < LCCore.projects.length; p++) {

    const isProjectEnable = LCCore.projects[p].enable;

    if (isProjectEnable) {
      // Add interval ONLY if there is a preceding visible project.
      // If this is the first visible project (even if p > 0), no interval is added before it.
      if (hasVisibleProject) {
        numEnable += projectInterval;
      }
      hasVisibleProject = true; // Mark that we have seen a visible project
    } else {
      // If project is disabled, we count the interval as disabled space 
      // (assuming an interval typically exists between projects).
      if (p > 0) {
        numDisable += projectInterval;
      }
    }

    const hCounts = [];
    for (let h = 0; h < LCCore.projects[p].holes.length; h++) {

      // [Correction] Check Project Enable status as well.
      // If Project is disabled, its holes should not increment numEnable,
      // regardless of the hole's individual enable status.
      if (isProjectEnable && LCCore.projects[p].holes[h].enable) {
        numEnable += 1;
      } else {
        numDisable += 1;
      }
      hCounts.push({
        enable: numEnable,
        disable: numDisable
      });
    }
    holeEnableList.push(hCounts);
  }

  //calc
  for (let i = 0; i < drawPointDataset.data.length; i++) {
    const drawData = drawPointDataset.data[i];

    if (drawData.source === "trinity") {
      if (drawData.pidx !== null && drawData.hidx !== null) {
        if (!LCCore.projects[drawData.pidx].holes[drawData.hidx].enable) {
          drawData.pos_x = NaN;
          drawData.pos_y = NaN;
          continue;
        }
        
        // If the project itself is disabled, the point should not be drawn
        if (!LCCore.projects[drawData.pidx].enable) {
          drawData.pos_x = NaN;
          drawData.pos_y = NaN;
          continue;
        }

        const enableHoles = holeEnableList[drawData.pidx][drawData.hidx];
        //calc        
        if (drawData.type == "age") {
          //age xpos is fixed. adjust icon size
          drawData.pos_x = ((objOpts.hole.distance + objOpts.hole.width) * (enableHoles.enable - 1) + shift_x) * xMag + pad_x + objOpts.hole.width * xMag - objOpts.age.incon_size * 1.2;
          drawData.pos_y = (drawData[objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;
        } else {
          //data xpos, without adjust
          if (Number.isFinite(drawData.val)) {
            let relative_x = (drawData.val - val_min) * amp[0];
            if (isFlip) {
              relative_x = objOpts.hole.width - relative_x;
            }
            drawData.pos_x = ((objOpts.hole.distance + objOpts.hole.width) * (enableHoles.enable - 1) + relative_x + shift_x) * xMag + pad_x;
          } else {
            drawData.pos_x = NaN;
          }

          drawData.pos_y = (drawData[objOpts.canvas.depth_scale] * amp[1] + shift_y) * yMag + pad_y;
        }
      }
    } else {
      //case depth source is CD, EFD, AGE
      if (drawData.type == "age") {
        const age_shift_x = -50;
        drawData.pos_x = age_shift_x + shift_x * xMag + pad_x - objOpts.age.incon_size * 1.2;
        drawData.pos_y = (drawData[objOpts.canvas.depth_scale] + shift_y) * yMag + pad_y - objOpts.age.incon_size / 2;
      } else {
        let relative_x = (drawData.val - val_min) * amp[0];

        if (isFlip) {
          relative_x = objOpts.hole.width - relative_x;
        }

        drawData.pos_x = (relative_x + shift_x) * xMag + 20;
        drawData.pos_y = (drawData[objOpts.canvas.depth_scale] * amp[1] + shift_y) * yMag + pad_y;
      }
    }
  }

  return drawPointDataset
}
function equalName(a, b) {
  const isNumLike = v =>
    typeof v === "number" ||
    (typeof v === "string" && /^[0-9]+$/.test(v));

  if (isNumLike(a) && isNumLike(b)) {
    return Number(a) === Number(b);
  }
  return String(a) === String(b);
}
function sortDataSetRowsByModelOrder(dataSet, LCCore){
  // sort order based on model
  const order = {};
  LCCore.projects.forEach(project=>{
    project.holes.forEach(hole=>{
      order[hole.name] = [];
      hole.sections.forEach(sec=>{
        order[hole.name].push(sec.name);
      });
    });
  });

  const holeOrder = Object.keys(order);
  const holeIndex = new Map(holeOrder.map((v, i) => [v, i]));

  const sectionIndex = {};
  for (const h in order) {
    sectionIndex[h] = new Map(order[h].map((v, i) => [v, i]));
  }

  // sort
  dataSet.data.sort((a, b) => {
    const h = (holeIndex.get(a.hname) ?? Infinity) - (holeIndex.get(b.hname) ?? Infinity);
    if (h !== 0) return h;

    const s = (sectionIndex[a.hname]?.get(a.sname) ?? Infinity) - (sectionIndex[b.hname]?.get(b.sname) ?? Infinity);
    if (s !== 0) return s;

    return a.dist - b.dist;
  });

  //update map
  dataSet.depth_map = {
    drilling_depth: [],
    composite_depth: [],
    event_free_depth: [],
    age: []
  }

  dataSet.data.forEach((d, i)=>{
    dataSet.depth_map.drilling_depth.push({idx: i, value: d.drilling_depth});
    dataSet.depth_map.composite_depth.push({idx: i, value: d.composite_depth});
    dataSet.depth_map.event_free_depth.push({idx: i, value: d.event_free_depth});
    dataSet.depth_map.age.push({idx: i, value: d.age});
  })
  
  return dataSet
}


//============================================================================================
