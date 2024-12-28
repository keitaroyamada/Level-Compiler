document.addEventListener("DOMContentLoaded", () => {
 
  //============================================================================================xxxxxxxxxx
  let developerMode = false;
  //base properties
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  let mousePos = [0, 0]; //mouse absolute position
  let canvasPos = [0, 0]; //canvas scroller position

  //model
  let LCCore = null;
  let LCPlot = null;

  //model source path
  let age_model_list = []; //for reload

  //p5(vector) canvas
  let vectorObjects = null; //p5 instance data
  document.getElementById("p5Canvas").style.display = "none"; //disable

  //raster canvas
  let canvas = document.getElementById("rasterCanvas");
  let ctx = canvas.getContext("2d");
  document.getElementById("rasterCanvas").style.display = "block"; //enable

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
  //============================================================================================

  //--------------------------------------------------------------------------------------------
  //plot properties
  let objOpts = setupSettings();
  function setupSettings(){
    let objOpts = {
      interface:{},
      canvas: {},
      project:{},
      hole: {},
      section: {},
      marker: {},
      event: {},
      connection: {},
      age: {},
      pen: {},
      edit:{},
      plot:{},
      edit:{},
      image:{},
    };
    objOpts.canvas.depth_scale = "composite_depth";
    objOpts.canvas.zoom_level = [4, 3]; //[x, y](1pix/2cm)
    objOpts.canvas.age_zoom_correction = [1/10, 100];//[zoom level, pad level]
    objOpts.canvas.dpir = 1; //window.devicePixelRatio || 1;
    objOpts.canvas.mouse_over_colour = "red";
    objOpts.canvas.pad_x = 200; //[px]
    objOpts.canvas.pad_y = 100; //[px]
    objOpts.canvas.shift_x = 0; //[cm]
    objOpts.canvas.shift_y = 100; //[cm]
    objOpts.canvas.bottom_pad = 100; //[cm]
    objOpts.canvas.background_colour = "#f4f5f7";//"#f7f7f7"//"#f8fbff";//"#fffdfa";//""white
    objOpts.canvas.target_horizon = false;
    objOpts.canvas.is_grid = false;
    objOpts.canvas.grid_width = 0.5;
    objOpts.canvas.grid_colour = "lightgray";
    objOpts.canvas.is_target = false;//mouse target
    objOpts.canvas.is_event = true;
    objOpts.canvas.is_connection = true;
    objOpts.canvas.draw_core_photo = false;
    objOpts.canvas.finder_y = 0;
    objOpts.canvas.age_precision = 0;
  
    objOpts.project.interval = 0;
    objOpts.project.font = "Arial";
    objOpts.project.font_size = 25;
    objOpts.project.font_colour = "black";
  
    objOpts.hole.distance = 20;
    objOpts.hole.width = 20;
    objOpts.hole.line_colour = "lightgreen";
    objOpts.hole.line_width = 2;
    objOpts.hole.font = "Arial";
    objOpts.hole.font_size = 20;
    objOpts.hole.font_colour = "black";
  
    objOpts.section.line_colour = "gray";
    objOpts.section.face_colour = "lightgray";
    objOpts.section.line_width = 2;
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
    objOpts.marker.show_labels = true;
  
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
    objOpts.event.folded_width  = 0.1;//rate
    objOpts.event.face_height = 0.98;//rate
  
    objOpts.connection.line_colour = "Gray";
    objOpts.connection.line_width = 1.5;
    objOpts.connection.indexWidth = objOpts.hole.distance * 0.7; //20;
    objOpts.connection.emphasize_non_horizontal = true;
    objOpts.connection.show_remote_connections = true;
    objOpts.connection.emphasize_remote_connections = true;
  
    objOpts.plot.isVisible = false;
    objOpts.plot.collecion_idx = 0;
    objOpts.plot.series_idx = 0;
    objOpts.plot.selected_options = null;
    objOpts.plot.on_section = true;
  
    objOpts.edit.editable = false;
    objOpts.edit.contextmenu_enable = false;
    objOpts.edit.hittest = null;
    objOpts.edit.mode = null;
    objOpts.edit.sensibility = 2;
    objOpts.edit.marker_from = null;
    objOpts.edit.marker_to = null;
    objOpts.edit.handleClick = null;
    objOpts.edit.handleMove = null;
    objOpts.edit.passwards = "admin";
  
    objOpts.pen.colour = "Red";
    objOpts.image.dpcm = 30;
    objOpts.image.dpcm_high = 200;
  
    objOpts.age.incon_size = 20;
    objOpts.age.alt_radius = 3;
     
    objOpts.age.incon_list = {
      terrestrial: ["", "Green"],
      terrestrial_unreliable: ["", "Green"],
      terrestrial_disable: ["", "Gray"],
      marine: ["", "Blue"],
      marine_unreliable: ["", "Blue"],
      marine_disable: ["", "Gray"],
      tephra: ["", "Red"],
      tephra_unreliable: ["", "Red"],
      tephra_disable: ["", "Gray"],
      orbital: ["", "Orange"],
      orbital_unreliable: ["", "Orange"],
      orbital_disable: ["", "Gray"],
      general: ["", "Black"],
      general_unreliable: ["", "Black"],
      general_disable: ["", "Gray"],
      historical: ["", "Brown"],
      historical_unreliable: ["", "Brown"],
      historical_disable: ["", "Gray"],
      interpolation: ["", "transparent"],
      interpolation_unreliable: ["", "transparent"],
      interpolation_disable: ["", "transparent"],
    };
    let resourceIcons = window.LCapi.GetResources();
    objOpts.interface.icon_list = resourceIcons.tool;
    for(const key in objOpts.age.incon_list){
      objOpts.age.incon_list[key][0] = resourceIcons.plot[key];
    }

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
  document.getElementById("footerLeftText").addEventListener("click", async () => {
    if(developerMode){
      await loadPlotData();
      console.log(LCPlot);
      updateView()

      LCPlot.age_collections.forEach(c=>{
        c.datasets[0].data_series.forEach(s=>{
          if(s.enable==true&&s.reliable==false){
            console.log(c.name, "true/false",s)
          }
          if(s.enable==false&&s.reliable==false){
            console.log(c.name, "false/false",s)
          }
          
        })
      })

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
      dataList.forEach((data,i)=>{
        if(data.type == "lcmodel"){
          order.push(i);
        }
      })

      //check correlation model
      let numModel = 0;
      dataList.forEach((data,i)=>{
        if(data.name.includes("[correlation]")){
          order.push(i);
          numModel++;
        }
      })

      if(order.length>1){
        alert("Multiple [correlation] model detected. Please load base [correlation] model first.");
        return;
      }

      dataList.forEach((data,i)=>{
        if(data.name.includes("[duo]")){
          order.push(i);
          numModel++;
        }
      })

      if(!LCCore && order.length == 0){
        alert("There is no correlation/duo model. Please load correlation model first.");
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
            alert("The section model can only be loaded in edit mode.")
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
        alert("To load images, please drop the folder where they are saved. The image names also must be 'holeName-sectionName'.")
        return
      }

      //get
      let N = order.length;
      if(isPhotoLoaded==true){
        N-=1;
      }


      if(N>0){
        await window.LCapi.progressbar("Load models", "Now loading...", true);
      }

      for(let i=0;i<order.length;i++){
        const droppedData = dataList[order[i]];//type,name,path
        if(droppedData.type == "lcmodel"){
          console.log("[Renderer]: LCmodel load from drop..");
          await initialiseCorrelationModel();
          await initialiseAgeModel();
          await initialiseCanvas();
          await initialisePlot();
          modelImages = initialiseImages();
          await initialisePaths();

          //load into LCCore (load process is in receive("RegisteredLCModel")
          await registerLCModel(droppedData.path);
          //load registered model from main to renderer with making up hole list view
          await loadModel();
          updateView();
          const selected_age_model_id = document.getElementById("AgeModelSelect").value; 
          await loadAge(selected_age_model_id);//load age data included LCCore

          await loadPlotData();
        }else if(droppedData.type == "csv"){
          if(droppedData.name.includes("[correlation]") || droppedData.name.includes("[duo]") ){
            //case model file
            console.log("[Renderer]: Correlation model file load from drop.");
            //register correlation model
            console.log(droppedData.path)
            await registerModel(droppedData.path);

            if(numModel==i+1){
              await loadModel();
            }
            updateView();
          } else if(droppedData.name.includes("[age]")){
            //case age file
            console.log("[Renderer]: Age model file load from drop.");
            //register age model
            await registerAge(droppedData.path);

            if(age_model_list.length >0){
              document.getElementById("AgeModelSelect").value = age_model_list[age_model_list.length-1].id;
              await loadAge(age_model_list[age_model_list.length-1].id);
              await loadPlotData();//age plot
            }
            updateView();
          }
        }else if(droppedData.type == "lcsection"){
          const result = await window.LCapi.addSectionFromLcsection(droppedData.path);
          //"duplicate_section","duplicate_hole","fail_to_add","no_path","no_hole"
          if(result==true){
            await loadModel();
            console.log(LCCore)
            updateView();
          }else{
            console.log("[Renderer]: Failed to load section data"+result);
            alert("Failed to load lcsectoion because: "+result);
            
            return
          }
        }else{        
          //case core image
          const response = await window.LCapi.askdialog(
            "Load core images",
            "Do you want to load the core images?"
          );

          if (response.response) {
            await window.LCapi.clearProgressbar()
            console.log("[Renderer]: Directory load from drop..");
            //register dir path
            await window.LCapi.RegisterCoreImage(droppedData.path, "core_images");

            //load images
            modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth","age"]);
          }

        }      
      }

      //update photo
      if(isPhotoLoaded == false && isAgeLoaded == true){
        if(Object.keys(modelImages.drilling_depth).length>0){
          modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth", "age"]);
        }
      }

      //update
      await window.LCapi.clearProgressbar()
      updateView();
    }catch(err){
      console.log(err)
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
    if(LCCore){
      if (objOpts.canvas.is_grid) {
        objOpts.canvas.is_grid = false;
        document.getElementById("bt_grid").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.canvas.is_grid = true;
        document.getElementById("bt_grid").style.backgroundColor = "#ccc";
      }
      updateView();
      }        
    });
  //============================================================================================
  //show labels
  document.getElementById("bt_show_labels").addEventListener("click", async (event) => {
    if(LCCore){
      if (objOpts.marker.show_labels) {
        objOpts.marker.show_labels = false;
        document.getElementById("bt_show_labels").style.backgroundColor = "#f0f0f0";
      } else {
        objOpts.marker.show_labels = true;
        document.getElementById("bt_show_labels").style.backgroundColor = "#ccc";
      }
      updateView();
      }        
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
      //download vector image from p5 canvas
      isSVG = true;
      const targetCanvas = new p5(p5Sketch);
      targetCanvas.save("model.svg");
      const annotationCanvas = new p5(penSketch);
      annotationCanvas.save("model_annotation.svg");
      //targetCanvas.save("model.png");
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
      "Confirmation",
      "Are you sure you want to clear the loaded models?"
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

      modelImages = {
        image_dir: "",
        load_target_ids: [],
        drilling_depth: {},
        composite_depth: {},
        event_free_depth: {},
        image_resolution:{},
        age:{},
      };


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
        modelImages = await assignCoreImages(modelImages, imageBuffers, objOpts);
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
    console.log("[Renderer]: Imported data received.");
    
    //load renderer
    await loadPlotData()
  });
  
  //============================================================================================
  //load correlation model
  window.LCapi.receive("UpdateViewFromMain", async () => {
    await loadModel();
    const registeredAgeList = await window.LCapi.MirrorAgeList();
    setAgeList(registeredAgeList);
    const selected_age_model_id = document.getElementById("AgeModelSelect").value; 
    await loadAge(selected_age_model_id);//load age data included LCCore

    await loadPlotData();

    //update photo
    if(Object.keys(modelImages.drilling_depth).length>0){
      //modelImages = await loadCoreImages(modelImages, LCCore, objOpts, "age");
    }
    
    updateView();
  });

 //============================================================================================
  //load correlation model
  window.LCapi.receive("RegisteredLCModel", async (filepath) => {
    document.body.style.cursor = "wait";
    isLoadedLCModel = true; //initialise
    
    //load
    await registerModelFromLCCore()
    await registerAgeFromLCAge();

    console.time("Load model") 
    await loadModel();//make up hole list view
    console.timeEnd("Load model")

    console.time("Load age")
    const selected_age_model_id = document.getElementById("AgeModelSelect").value; 
    await loadAge(selected_age_model_id);//load age data included LCCore
    console.timeEnd("Load age")

    await loadPlotData();


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
    console.log("[Renderer]: Plot options are received.",data)
    if(data.emitType=="new"){
      //await loadPlotData();//latest ver is load plot data at the same time of loading plotter
    }

    objOpts.plot.selected_options = data.data;
    objOpts.plot.isVisible = true;
    document.getElementById("bt_chart").style.backgroundColor = "#ccc";
    updateView();
  });
  //============================================================================================
  //Edit correlation model
  document.addEventListener('contextmenu', handleNormalContextmenu);
  window.LCapi.receive("EditCorrelation", async () => {
    if(!developerMode && !objOpts.edit.editable){   
      const askData = {
        title:"Edit model",
        label:"Please enter passwards.",
        value:"",
        type:"password",
      };
      response = await window.LCapi.inputdialog(askData);
      if(response !==null){
        if(response !== objOpts.edit.passwards){
          alert("Please input correct paswards.");
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
      await window.LCapi.changeEditMode(objOpts.edit.editable);
      document.removeEventListener('contextmenu', handleEditContextmenu);
      document.addEventListener('contextmenu', handleNormalContextmenu);
    }else{
      objOpts.edit.editable = true;
      await window.LCapi.changeEditMode(objOpts.edit.editable);
      objOpts.edit.contextmenu_enable = true;
      document.body.style.cursor = "crosshair"; 
      if(objOpts.edit.contextmenu_enable){
        document.addEventListener('contextmenu', handleEditContextmenu);
        document.removeEventListener('contextmenu', handleNormalContextmenu);
      }
    }
  });
  async function handleNormalContextmenu(event) {
    event.preventDefault();
    let clickResult = null;
    if(objOpts.edit.hittest.hole!==null){
      if(objOpts.edit.hittest.section!==null){
        clickResult = await window.LCapi.showContextMenu("sectionContextMenu");
      }else{
        clickResult = await window.LCapi.showContextMenu("holeContextMenu");
      }
    }else{
      clickResult = await window.LCapi.showContextMenu("normalContextMenu");  
    }

    
    if(clickResult=="loadHighResolutionImage"){
      const curDPCM = JSON.parse(JSON.stringify(objOpts.image.dpcm));

      const targetId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole,objOpts.edit.hittest.section,null];
      modelImages.load_target_ids = [targetId];//load target
      objOpts.image.dpcm = objOpts.image.dpcm_high;
      modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth", "composite_depth","event_free_depth","age"]);
      
      updateView();
      objOpts.image.dpcm = curDPCM;
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
                      sectionProperties.data = s;
                    }
                  })
                }              
              })
            }
          })
          if(sectionProperties.data!==null){
            console.log(sectionProperties)
            await window.LCapi.sendSettings(sectionProperties, "settings");
          }
        }
      }      
    }
  }
  //0 Context menu--------------------------------------------
  async function handleEditContextmenu(event) {
    event.preventDefault();

    const clickResult = await window.LCapi.showContextMenu("editContextMenu");

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
    } else if(clickResult == "disconnectMarkers"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "disconnect_marker";
      objOpts.edit.handleMove = handleConnectMouseMove;
      objOpts.edit.handleClick = null;
      document.addEventListener("mousemove", objOpts.edit.handleMove);
    }else if(clickResult == "connectSections"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "connect_section";
      objOpts.edit.handleMove = handleConnectMouseMove;
      objOpts.edit.handleClick = null;
      document.addEventListener("mousemove", objOpts.edit.handleMove);
      console.log(objOpts.edit);
    } else if(clickResult == "disconnectSections"){
      objOpts.edit.contextmenu_enable = false;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
      objOpts.edit.mode = "disconnect_section";
      objOpts.edit.handleMove = handleConnectMouseMove;
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
    }else if(clickResult == "addProject"){
      if(LCCore){
        if(LCCore.projects[LCCore.projects.length-1].holes.length  <= 0){
          alert("Previous project is empty. Please add a hole to the previous project first.");
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
      
    }else if(clickResult == "mergeProjects"){
      const response = await window.LCapi.askdialog(
        "Merge all projects",
        "Are you sure you want to merge all the projects?"
      );
      if (response.response) {
        const result = await window.LCapi.mergeProjects();
        if(result == true){
          await loadModel();
          await registerModelFromLCCore()
          await registerAgeFromLCAge();
          const selected_age_model_id = document.getElementById("AgeModelSelect").value;
          await loadAge(selected_age_model_id)
          await loadPlotData();
          updateView();   

        }else if (result == "duplicate_holes"){
          alert("There are duplicate hole names. Please rename to unique hole name first.")
        }
      }
      

      
    
    }else if(clickResult=="loadHighResolutionImage"){
      const curDPCM = JSON.parse(JSON.stringify(objOpts.image.dpcm));

      const targetId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole,objOpts.edit.hittest.section,null];
      modelImages.load_target_ids = [targetId];//load all
      objOpts.image.dpcm = 200;
      modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth", "age"]);
      updateView();
      objOpts.image.dpcm = curDPCM;
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
      updateView();
    }else if(clickResult == "cancel"){
      objOpts.edit.editable = true;
      objOpts.edit.contextmenu_enable = true;
      objOpts.edit.hittest = null;
      objOpts.edit.marker_from = null;
      objOpts.edit.marker_to = null;
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
      if(objOpts.edit.mode == "connect_marker" || objOpts.edit.mode == "disconnect_marker"){
        objOpts.edit.marker_from = ht;
      }else if(objOpts.edit.mode == "connect_section" || objOpts.edit.mode == "disconnect_section"){
        //case piston core
        if(ht.markerName.includes("top") || ht.markerName.includes("bottom")){
          objOpts.edit.marker_from = ht;
        }
      }
    }

    if(objOpts.edit.marker_to == null && ht.nearest_marker !== null){
      if(objOpts.edit.mode == "connect_marker" || objOpts.edit.mode == "disconnect_marker"){
        if(!(objOpts.edit.marker_from.project == ht.project && objOpts.edit.marker_from.hole == ht.hole)){
          objOpts.edit.marker_to = ht;
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
          "Connect markers",
          "Do you want to CONNECT between selected markers?"
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          const toId   = [objOpts.edit.marker_to.project,   objOpts.edit.marker_to.hole,   objOpts.edit.marker_to.section,   objOpts.edit.marker_to.nearest_marker];
          
          console.log("[Editor]: Connected markers between " + fromId +" and " + toId);

          await undo("save");//undo
          const result = await window.LCapi.connectMarkers(fromId, toId, "horizontal");
          
          
          if(result==true){
            await loadModel();

            const affectedSections = getConnectedSectionIds([fromId, toId]);
            console.log(affectedSections)
            if(affectedSections.length>0){
              modelImages.load_target_ids = affectedSections;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth", "age"]);
            }
            
            updateView();
          }
         
        }
      } else if(objOpts.edit.mode == "disconnect_marker"){
        const response = await window.LCapi.askdialog(
          "Connect markers",
          "Do you want to DISCONNECT between selected markers?"
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          const toId   = [objOpts.edit.marker_to.project,   objOpts.edit.marker_to.hole,   objOpts.edit.marker_to.section,   objOpts.edit.marker_to.nearest_marker];

          console.log("[Editor]: Disconnected markers between " + fromId +" and " + toId);

          await undo("save");//undo
          const result = await window.LCapi.disconnectMarkers(fromId, toId, "horizontal");
          if(result == true){
            await loadModel();

            const affectedSections = getConnectedSectionIds([fromId, toId]);
            if(affectedSections.length>0){
              modelImages.load_target_ids = affectedSections;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth", "age"]);
            }
  
            updateView();
          }else{
            console.log("Fail")
          }
          
        }
      } else if(objOpts.edit.mode == "connect_section"){
        const response = await window.LCapi.askdialog(
          "Connect markers",
          "Do you want to CONNECT between selected sections?"
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          const toId   = [objOpts.edit.marker_to.project,   objOpts.edit.marker_to.hole,   objOpts.edit.marker_to.section,   objOpts.edit.marker_to.nearest_marker];
          
          console.log("[Editor]: Connected markers between " + fromId +" and " + toId);

          await undo("save");//undo
          let result = null;
          if(fromId[0] == toId[0] && fromId[1] == toId[1] && fromId[2] !== toId[2]){
            //case connect vertival
            result = await window.LCapi.connectMarkers(fromId, toId, "vertical");
          }
          console.log(result)
          
          if(result==true){
            await loadModel();
            const affectedSections = getConnectedSectionIds([fromId, toId]);
            if(affectedSections.length>0){
              modelImages.load_target_ids = affectedSections;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth", "age"]);
            }
            
            updateView();
          }
         
        }
      } else if(objOpts.edit.mode == "disconnect_section"){
        const response = await window.LCapi.askdialog(
          "Connect markers",
          "Do you want to DISCONNECT between selected sections?"
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          const toId   = [objOpts.edit.marker_to.project,   objOpts.edit.marker_to.hole,   objOpts.edit.marker_to.section,   objOpts.edit.marker_to.nearest_marker];

          console.log("[Editor]: Disconnected markers between " + fromId +" and " + toId);

          await undo("save");//undo
          if(fromId[0] == toId[0] && fromId[1] == toId[1] && fromId[2] !== toId[2]){
            //case connect vertival
            result = await window.LCapi.disconnectMarkers(fromId, toId, "vertical");
          }
          if(result == true){
            await loadModel();

            const affectedSections = getConnectedSectionIds([fromId, toId]);
            if(affectedSections.length>0){
              modelImages.load_target_ids = affectedSections;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","composite_depth","event_free_depth", "age"]);
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
      }else{
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
    }else if(["change_marker_name","change_marker_distance", "set_zero_point", "enable_master","disable_master"].includes(objOpts.edit.mode)){
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
    
    if (objOpts.edit.marker_from !== null) {
      //if get both markers
      if(["change_marker_name","change_marker_distance"].includes(objOpts.edit.mode)){
        let target = null;
        let response=null;
        if(objOpts.edit.mode == "change_marker_name"){
          target = "name";
          const askData = {
            title:"Change marker name",
            label:"Please input new name",
            value:"",
            type:"text",
          };
          response = await window.LCapi.inputdialog(askData);
          console.log("[Editor]: Change marker: " + target);
        }else if(objOpts.edit.mode == "change_marker_distance"){
          target = "distance";
          const askData = {
            title:"Change marker distance",
            label:"Please input new distance(cm).",
            value:0.0,
            type:"number",
          };
          response = await window.LCapi.inputdialog(askData);
            
          console.log("[Editor]: Change marker: " + target);
        }
         
        if (response !== null) {
          const targetId = [ht.project, ht.hole, ht.section, ht.nearest_marker];

          await undo("save");//undo
          const result = await window.LCapi.changeMarker(targetId, target, response);
          if(result == true){
            await loadModel();
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
          console.log(idx, idxh)
          if(idxh[0] == idx[0]){
            if(LCCore.projects[idxh[0]].holes[idxh[1]].sections[idxh[2]].markers[idxh[3]].isMaster == true){
              numMaster++;
            }
          }          
        }
        if(numMaster>2){
          alert("Only up to 2 master markers can beset in the same horizon. Please delete any unnecessary masters first.");
          return;
        }
        
        //apply
        await undo("save");//undo
        const result = await window.LCapi.SetMaster(targetId, "enable");
        if(result==true){
          await loadModel();
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
          updateView();
          console.log("[Renderer]: Set a new master.");
        }else{
          console.log("[Renderer]: Failed to set a new master.");
        }
      }else if(objOpts.edit.mode == "disable_master"){
        //apply
        const targetId = [ht.project, ht.hole, ht.section, ht.nearest_marker];
        await undo("save");//undo
        const result = await window.LCapi.SetMaster(targetId, "disable");
        if(result==true){
          await loadModel();
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
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
            "Set Zero Point",
            "The Zero point has alrady been defined. Do you want to replace this?"
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
          console.log(targetId,response)
          await undo("save");//undo
          const result = await window.LCapi.SetZeroPoint(targetId, response);
          if(result==true){
            await loadModel();
            await loadAge(document.getElementById("AgeModelSelect").value);
            await loadPlotData();
            updateView();
            console.log("[Renderer]: Set a new Zero point.");
          }else{
            console.log("[Renderer]: Failed to set zero point.");
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

    //canvasPos[0] = newPosY;
    //canvasPos[1] = newPosY;
    
    //canvasPos[1] = newPosY;
    updateView();
  }
  //2 Marker click--------------------------------------------
  async function handleMarkerDeleteClick(event) {
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
      if(objOpts.edit.mode == "delete_marker"){
        const response = await window.LCapi.askdialog(
          "Delete markers",
          "Do you want to DELETE the selected marker?"
        );
        if (response.response) {
          const fromId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
          
          console.log("[Editor]: Delete marker: " + fromId);

          await undo("save");//undo
          await window.LCapi.deleteMarker(fromId);
          await loadModel();
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
  //2 Marker click--------------------------------------------
  async function handleMarkerAddClick(event) {
    console.log("[Renderer]: Add Marker clicked.")
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));

    //initialise
    objOpts.edit.marker_from = ht;
    objOpts.edit.marker_to = 999999;//dummy

    //if get both markers
    if(objOpts.edit.mode == "add_marker"){
      const response = await window.LCapi.askdialog(
        "Add new markers",
        "Do you want to ADD a new marker?"
      );
      if (response.response) {
        const upperId   = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.upper_marker];
        const lowerId   = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.lower_marker];
        const sectionId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, null];
        console.log("[Editor]: Add marker between " + upperId +" and "+lowerId);

        await undo("save");//undo
        await window.LCapi.addMarker(sectionId, objOpts.edit.marker_from.y, objOpts.canvas.depth_scale, ht.relative_x);
        await loadModel();
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

    updateView();
  }
  //2 Marker click--------------------------------------------
  async function handleEventAddClick(event) {
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
          console.log("[Editor]: Add event between " + upperId +" and "+lowerId);

          let result = null;
          if(["deposition","d","markup","m"].includes(response1.toLowerCase())){
            if(["general","tephra","disturbed","void","g","t","d","v"].includes(response2.toLowerCase())){
              await undo("save");//undo
              result = await window.LCapi.AddEvent(upperId, lowerId, response1, response2);
            }
          }else  if(["erosion","e"].includes(response1.toLowerCase())){
            await undo("save");//undo
            result = await window.LCapi.AddEvent(upperId, [], response1, response2);
          }

          if(result == true){
            await loadModel();
            await loadAge(document.getElementById("AgeModelSelect").value);
            await loadPlotData();
            const affectedSections = getConnectedSectionIds([upperId, lowerId]);
            if(affectedSections.length>0){
              modelImages.load_target_ids = affectedSections;
              modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","event_free_depth", "age"]);
            }

            console.log("[Renderer]: Add a new event.]");
          }else if(result == "occupied"){
            alert("The input deposition type of event has already used between the markers.");
          }
        }        
      }
    }else if(objOpts.edit.mode == "delete_event"){
      const response = await window.LCapi.askdialog(
        "Delete event",
        "Are you sure you want to REMOVE all events?",
      );
      if(response.response){
        const upperId   = [ht.project, ht.hole, ht.section, ht.upper_marker];
        const lowerId   = [ht.project, ht.hole, ht.section, ht.lower_marker];
        console.log("[Editor]: Add event between " + upperId +" and "+lowerId);
        await undo("save");//undo
        result = await window.LCapi.DeleteEvent(upperId, lowerId,[]);
        if(result == true){
          await loadModel();
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
          const affectedSections = getConnectedSectionIds([upperId, lowerId]);
          if(affectedSections.length>0){
            modelImages.load_target_ids = affectedSections;
            modelImages = await loadCoreImages(modelImages, LCCore, objOpts, ["drilling_depth","event_free_depth", "age"]);
          }
          updateView();
          console.log("[Renderer]: Delete event")
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

        await undo("save");//undo
        const result = await window.LCapi.changeSection(targetId, target, response);
        if(result=="used"){
          console.log("[Renderer]: "+response+" has already been used. Please input a unique name that has not been used.");
          alert("[ "+response+" ] has already been used. Please input a unique name that has not been used.");
        }
        
        await loadModel();
        updateView();
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
      const response = await window.LCapi.askdialog(
        "Delete section",
        "Do you want to delete the section?",
      );
      if (response.response) {
        const targetId = [ht.project, ht.hole, ht.section, null];

        await undo("save");//undo
        const result = await window.LCapi.deleteSection(targetId);
        await loadModel();
        await loadAge(document.getElementById("AgeModelSelect").value);
        await loadPlotData();
        updateView();
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
          value:0.0,
          type:"number",
        };
        inData.distance_top    = parseFloat(await window.LCapi.inputdialog(askData));
        if(inData.distance_top!==NaN){
          askData = {
            title:"Add a new section",
            label:"Section BOTTOM distance (cm)?",
            value:100.0,
            type:"number",
          };
          inData.distance_bottom = parseFloat(await window.LCapi.inputdialog(askData));
          if(inData.distance_bottom!==NaN){
            askData = {
              title:"Add a new section",
              label:"Section TOP drilling depth (cm)?",
              value:0.0,
              type:"number",
            };
            inData.dd_top = parseFloat(await window.LCapi.inputdialog(askData));
            if(inData.dd_top!==NaN){
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
        
          await undo("save");//undo
          const result = await window.LCapi.addSection(targetId, inData);
          if(result==true){
            await loadModel();
            await loadAge(document.getElementById("AgeModelSelect").value);
            await loadPlotData();
          }else{
            console.log("[Renderer]: Failed to add section.")
          }
        }else{
          alert("Incrrect input values are detected.")
          console.log("[Renderer]: Input data is incorrect values.")
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
    updateView();
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
        await undo("save");//undo
        const result = await window.LCapi.changeHole(targetId, target, response);
        if(result=="used"){
          console.log("[Renderer]: "+response+" has already been used. Please input a unique name that has not been used.");
          alert("[ "+response+" ] has already been used. Please input a unique name that has not been used.");
        }
        
        await loadModel();
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
        "Delete hole",
        "Do you want to delete the hole?",
      );
      if (response.response) {
        const targetId = [ht.project, ht.hole, null, null];

        await undo("save");//undo
        const result = await window.LCapi.deleteHole(targetId);
        if(result == true){
          console.log("[Renderer]: Delete hole.")
          await loadModel();
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
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

        await undo("save");//undo
        const result = await window.LCapi.addHole(targetId, response);
        if(result == true){
          console.log("[Renderer]: Add hole.")
          await loadModel();

          //add dummy section for plot


          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
          updateView();
        }else if(result=="used"){
          console.log("[Renderer]: "+response+" has already been used. Please input a unique name that has not been used.");
          alert("[ "+response+" ] has already been used. Please input a unique name that has not been used.");
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
        objOpts.edit.handleClick = handleProjectDeleteClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else if(objOpts.edit.mode == "change_project_name"){
        objOpts.edit.handleClick = handleProjectDeleteClick;
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


        await undo("save");//undo
        const result = await window.LCapi.addProject(response, response2);
        if(result == true){
          console.log("[Renderer]: Add project.")
          await loadModel();
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
          updateView();
        }else if(result=="used"){
          console.log("[Renderer]: "+response+" has already been used. Please input a unique name that has not been used.");
          alert("[ "+response+" ] has already been used. Please input a unique name that has not been used.");
        }else if(result == "correlation_exist"){
          console.log("[Renderer]: Base Correlation Model has already been registered. Please use duo model.");
          alert("Base Correlation Model has already been registered. Please use duo model.");
        }else if(result == "no_correlation"){
          console.log("[Renderer]: 'Duo' model requires Base Correlation Model. Please use correlation model first.");
          alert("'Duo' model requires Base Correlation Model. Please use correlation model first.");
        }
        
      }else{
        console.log("[Renderer]: "+response+" is incorrect type. Please select the type from 'correlation' or 'duo'.");
        alert("[ "+response+" ] is incorrect type. Please select the type from 'correlation' or 'duo'.");
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
  }
  //5 Project click--------------------------------------------
  async function handleProjectDeleteClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, LCCore, objOpts)));
    event.preventDefault();

    if(objOpts.edit.mode == "delete_project"){
      const response = await window.LCapi.askdialog(
        "Delete project",
        "Are you sure to delete this project?",
      );
      if (response.response) {
        const targetId = [ht.project, null, null, null];

        await undo("save");//undo
        const result = await window.LCapi.deleteProject(targetId);
        if(result == true){
          console.log("[Renderer]: Delete project.")
          await loadModel();

          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
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
        const result = await window.LCapi.changeProject(targetId, "name",response);
        if(result == true){
          console.log("[Renderer]: Chnage project name.")
          await loadModel();
          await loadAge(document.getElementById("AgeModelSelect").value);
          await loadPlotData();
          updateView();
        }else if(result=="used"){
          console.log("[Renderer]: "+response+" has already been used. Please input a unique name that has not been used.");
          alert("[ "+response+" ] has already been used. Please input a unique name that has not been used.");
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
  
  //============================================================================================
  //load correlation model
  window.LCapi.receive("ExportCorrelationAsCsvMenuClicked", async () => {
    await window.LCapi.ExportCorrelationAsCsv(LCCore);
  });
  window.LCapi.receive("ExportCorrelationAsLFMenuClicked", async () => {
    await window.LCapi.ExportCorrelationAsLF(LCCore);
  });
  //============================================================================================
  document.getElementById("bt_chart").addEventListener("click", async () => {
    if (LCCore) {
      if (!objOpts.plot.isVisible ) {
        objOpts.plot.isVisible = true;
        document.getElementById("bt_chart").style.backgroundColor = "#ccc";
        updateView();
      } else {
        objOpts.plot.isVisible = false;
        document.getElementById("bt_chart").style.backgroundColor = "#f0f0f0";
        updateView();
      }
    }
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
          //backup
          backup_hole_enable[LCCore.projects[target_idx[0]].id.toString()] = setVal;
          LCCore.projects[target_idx[0]].holes.forEach((hole) => {
            hole.enable = setVal;
            const el = document.getElementById(hole.id.toString());
            el.checked = setVal;
            //backup
            backup_hole_enable[hole.id.toString()] = setVal;
            console.log("[Renderer]: Hole "+hole.name +" is "+setType+".");
          });
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
            backup_hole_enable[LCCore.projects[target_idx[0]].id.toString()] = false;
          }else{
            document.getElementById([target_id[0],null,null,null].toString()).checked = true;
            LCCore.projects[target_idx[0]].enable = true;
            //backup
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

      await loadModel();
      const registeredAgeList = await window.LCapi.MirrorAgeList();
      console.log(registeredAgeList)
      setAgeList(registeredAgeList);
      const selected_age_model_id = document.getElementById("AgeModelSelect").value; 
      await loadAge(selected_age_model_id);//load age data included LCCore

      await loadPlotData();
      console.log(LCPlot)

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
          objOpts.connection.indexWidth = objOpts.hole.distance * 0.7;
          //objOpts.connection.indexWidth += 0.015 * deltaY;
          if (objOpts.connection.indexWidth < 0) {
            objOpts.connection.indexWidth = 0;
          }
          if (objOpts.connection.indexWidth > 20) {
            objOpts.connection.indexWidth = 20;
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
          objOpts.connection.indexWidth = objOpts.hole.distance * 0.7;
          //objOpts.connection.indexWidth += 0.015 * deltaY;
          if (objOpts.connection.indexWidth < 0) {
            objOpts.connection.indexWidth = 0;
          }
          if (objOpts.connection.indexWidth > 20) {
            objOpts.connection.indexWidth = 20;
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
      var mouseX = mousePos[0];
      var mouseY = mousePos[1];

      //calc position
      const ht = getClickedItemIdx(mouseX, mouseY, LCCore, objOpts);
      objOpts.edit.hittest = ht;
 
      await window.LCapi.SendDepthToFinder(ht);
      console.log("[Renderer]: Send the clicked depth to Finder", ht.y, objOpts.canvas.depth_scale);
    }
  });
  //============================================================================================
  window.LCapi.receive("rendererLog", async (data) => {
    console.log(data);
  });
  window.LCapi.receive("errors", async (data) => {
    console.log(data);
  });
  window.LCapi.receive("SettingsMenuClicked", async () => {

    const canvas = objOpts.canvas;
    const project = objOpts.project;
    const hole = objOpts.hole;
    const section = objOpts.section;
    const marker = objOpts.marker;
    const event = objOpts.event;
    const connection = objOpts.connection;
    const age = objOpts.age;
    const pen = objOpts.pen;
    const plot = objOpts.plot; 
    const options={
      editable:true,
      called_from:"renderer",
      title:"Preferences",
    }

    const settings = {
      options,
      data:{
        canvas,
        project,
        hole,
        section,
        marker,
        event,
        connection,
        age,
        pen,
        plot,
      }
    };
      
   await window.LCapi.sendSettings(settings, "settings");

  });
  
  window.LCapi.receive("SettingsData", async (data) => {
    if(data == null){
      //set default
      objOpts = setupSettings();

      //back to settings menu
      const canvas = objOpts.canvas;
      const project = objOpts.project;
      const hole = objOpts.hole;
      const section = objOpts.section;
      const marker = objOpts.marker;
      const event = objOpts.event;
      const connection = objOpts.connection;
      const age = objOpts.age;
      const pen = objOpts.pen;
      const plot = objOpts.plot; 

      const settings = {
        canvas,
        project,
        hole,
        section,
        marker,
        event,
        connection,
        age,
        pen,
        plot,  
      };
        
    await window.LCapi.sendSettings(settings, "settings");
    }else{
      Object.assign(objOpts.canvas, data.canvas);
      Object.assign(objOpts.project, data.project);
      Object.assign(objOpts.hole, data.hole);
      Object.assign(objOpts.section, data.section);
      Object.assign(objOpts.marker, data.marker);
      Object.assign(objOpts.event, data.event);
      Object.assign(objOpts.connection, data.connection);
      Object.assign(objOpts.age, data.age);
      Object.assign(objOpts.pen, data.pen);
      Object.assign(objOpts.plot, data.plot); 
    }
    
    console.log("[RENDERER]: Setting is updated.",data)
    updateView();
  });
  
  //============================================================================================
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
        let rect = document.getElementById("p5Canvas").getBoundingClientRect(); // Canvas position and size

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
    let options = {canvas:{depth_scale: objOpts.canvas.depth_scale, age_precision: objOpts.canvas.age_precision}};
    if(developerMode){
      options.canvas.depth_scale = "canvas_position";
    }
    
    const txt = await getFooterInfo(LCCore, objOpts.edit.hittest, options);
    document.getElementById("footerLeftText").innerText = txt;

    //update mouse position
    mousePos = [mouseX, mouseY];

    //target line
    var target_line = document.getElementById("horizontal_target");
    target_line.style.top = event.clientY + "px";
  });
  //============================================================================================
  //scroll event
  scroller.addEventListener("scroll",async function (event) {
      //hittest
      const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mousePos[0], mousePos[1], LCCore, objOpts)));
      objOpts.edit.hittest = ht;

      const txt = await getFooterInfo(LCCore, objOpts.edit.hittest, objOpts);
      document.getElementById("footerLeftText").innerText = txt;

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
        objOpts.hole.distance -= 0.01 * deltaY;
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
        const relative_scroll_pos_x = (scroller.scrollLeft - objOpts.canvas.pad_x) / scroller.scrollWidth;
        const relative_scroll_pos_y = scroller.scrollTop / scroller.scrollHeight;

        //calc new canvas size
        makeP5CanvasBase();
        const canvasBase_width  = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);
        const canvasBase_height = parseInt(canvasBase.style.height.match(/\d+/)[0], 10);

        //get new scroll pos
        const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x + objOpts.canvas.pad_x;
        const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y;

        scroller.scrollTo(new_scroll_pos_x, new_scroll_pos_y); //move scroll position

        //update data
        canvasPos = [new_scroll_pos_x, new_scroll_pos_y];

        //update plot
        updateView();
      }
    },
    { passive: false }
  );
  //============================================================================================
  //YAxis dropdown changed event
  document.getElementById("YAxisSelect").addEventListener("change", (event) => {
    console.log(`Selected: ${event.target.value}`);
    objOpts.canvas.depth_scale = event.target.value;
    var mouseX = scroller.scrollLeft;
    var mouseY = scroller.scrollTop;

    //update plot
    updateView();
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

        await loadModel();
        await loadAge(selected_age_model_id);
        await loadPlotData();
          
        console.log("[Renderer]: Undo model");
        console.log(LCCore);
  
        //update plot
        updateView();
      }
    }

    // Ctrl + R => Redo model
    if (event.ctrlKey && event.key === "r") {
      event.preventDefault();
      const result = await undo("redo");//undo
      if(result == true){
        const selected_age_model_id = document.getElementById("AgeModelSelect").value;

        await loadModel();
        await loadAge(selected_age_model_id);
        await loadPlotData();
          
        console.log("[Renderer]: Redo model");
        console.log(LCCore);

        //update plot
        updateView();
      }
    }

    // Ctrl + 0 => reset zoom leevel
    if (event.ctrlKey && event.key === "0") {
      //reset zoom
      if (LCCore) {
        objOpts.canvas.zoom_level = [4,3];
  
        
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
          }else if(event.ctrlKey && event.key ==="2"){
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
        let hole_top = LCCore.projects[p].holes[h].sections[0].markers[0][objOpts.canvas.depth_scale];
        let hole_bottom = LCCore.projects[p].holes[h].sections.slice(-1)[0].markers.slice(-1)[0][objOpts.canvas.depth_scale];
        
        if (hole_top !== null && holes_top > hole_top) {
          holes_top = hole_top;
        }
        if (hole_bottom !== null && holes_bottom < hole_bottom) {
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

    let canvasBaseWidth  = parseInt((objOpts.hole.distance + objOpts.hole.width + shift_x) * (num_total_holes + 1) * xMag + pad_x);
    let canvasBaseHeight = parseInt((holes_bottom + bottom_padding - holes_top + shift_y + objOpts.canvas.bottom_pad) * yMag + pad_y);

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

      sketch.strokeWeight(2);
      sketch.stroke("#ED225D");

      sketchCanvas.parent("p5Canvas");
      sketch.noLoop();
    };

    //draw data=============================================================================================
    console.log(canvasBase.style)
    
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

      //initialise
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
        //make project objects===================================================================================
        const project = LCCore.projects[p];
        //show project name
        if(project.enable == true){
          let num_enable_left = 0;
          LCCore.projects.filter(p=>p.order<project.order).forEach(p=>p.holes.forEach(h=>{if(h.enable){num_enable_left++;}}))
          const project_x0 = ((objOpts.section.width + objOpts.hole.distance) * num_enable_left + shift_x) * xMag + pad_x;
          let project_y0 = (shift_y) * yMag + pad_y;;//pad_y;
          if(project.composite_depth_top !== null){
            project_y0 = (project.composite_depth_top + shift_y) * yMag + pad_y;
          }     
          sketch.drawingContext.setLineDash([]);
          sketch.fill(objOpts.project.font_colour);
          sketch.stroke(objOpts.project.font_colour);
          sketch.textFont(objOpts.project.font);
          sketch.textSize(objOpts.project.font_size);
          sketch.text(
            project.name,
            project_x0,
            project_y0 - 70,
          );
        }
        

        //live hittest
        if(objOpts.edit.hittest){
          //console.log(objOpts.edit.hittest.project, objOpts.edit.hittest.hole)
          if(["add_hole","delete_project","change_project_name"].includes(objOpts.edit.mode)){
            if(objOpts.edit.hittest.project == project.id[0]){
              
              let num_enable_right = 0;
              
              project.holes.forEach(hc=>{
                if(hc.enable){
                  num_enable_right++;
                }
              })
              
              let num_enable_left = 0;
              LCCore.projects.filter(p=>p.order<project.order).forEach(p=>p.holes.forEach(h=>{if(h.enable){num_enable_left++;}}))

              sketch.push();//save
              sketch.fill(0,0,0,0);
              sketch.strokeWeight(3);
              sketch.stroke("Red");
              
              const project_ht_x0 = ((objOpts.section.width + objOpts.hole.distance) * num_enable_left + shift_x) * xMag + pad_x - 3;
              const project_ht_y0 = (project.composite_depth_top + shift_y) * yMag + pad_y - 3;
              let project_ht_w  = (objOpts.section.width + objOpts.hole.distance) * num_enable_right * xMag - objOpts.hole.distance/2;
              if(project_ht_w<=0){
                project_ht_w = 100;
              }
              let project_ht_h = 1000;
              if(project.composite_depth_bottom !== null &&  project.composite_depth_top !== null){
                project_ht_h = (project.composite_depth_bottom - project.composite_depth_top) * yMag + 6;
              }

              sketch.rect(project_ht_x0, project_ht_y0, project_ht_w, project_ht_h, 3, 3, 3, 3); //rounded
              sketch.pop();

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
          sketch.fill(objOpts.hole.font_colour);
          sketch.stroke(objOpts.hole.font_colour);
          sketch.textFont(objOpts.hole.font);
          sketch.textSize(objOpts.hole.font_size);
          sketch.text(
            hole.name,
            // /(hole_x0 + shift_x + objOpts.hole.width * 0.3) * xMag + pad_x
            (hole_x0 + shift_x) * xMag + pad_x + objOpts.section.width * xMag /2 - sketch.textWidth(hole.name)/2,
            (hole_top + shift_y) * yMag + pad_y - 20
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

          //get plot order for hit test--------------------------------------

          let section_plot_order = [];
          for (let i = 0; i < hole.sections.length; i++) {
            section_plot_order.push(i);
          }

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
                sketch.stroke("Red");
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

            //hittest
            if(objOpts.edit.hittest){
              if(["change_section_name","delete_section"].includes(objOpts.edit.mode)){
                if(objOpts.edit.hittest.hole == hole.id[1] && objOpts.edit.hittest.section == section.id[2]){
                  sketch.strokeWeight(3);
                  sketch.stroke("Red");
                }               
              }
            }
            
            sketch.rect(sec_x0, sec_y0, sec_w, sec_h, 3, 3, 3, 3); //rounded

            //check zoom level for ignoring plot markers
            if (objOpts.canvas.zoom_level[1] < objOpts.marker.ignore_zoom_level) {
              continue;
            }

            //add section photo-------------------------------------------------
             let isPhtoExist = false;
            if (objOpts.canvas.draw_core_photo) {
              try {
                let ptoto_depth_scale;
                  ptoto_depth_scale = objOpts.canvas.depth_scale;
               
                if (modelImages[ptoto_depth_scale][hole.name + "-" + section.name] !== undefined) {
                  isPhtoExist = true;
                }

                if (isPhtoExist) {
                  try {
                    sketch.image(
                      modelImages[ptoto_depth_scale][hole.name + "-" + section.name],
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
                    sketch.stroke("Red");
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
              let topBot = 0;
              if (m == 0 || m == section.markers.length - 1) {
                topBot -= objOpts.marker.width * xMag; //or +20
              }
              //draw markers
              sketch.drawingContext.setLineDash([]);
              sketch.strokeWeight(objOpts.marker.line_width);
              if(objOpts.canvas.draw_core_photo){
                sketch.stroke("Magenta"); //(markerLineColour);
              }else{
                sketch.stroke(objOpts.marker.line_colour); //(markerLineColour);
              }
              
              let mw = 1;
               
              if (!objOpts.canvas.is_event) {
                mw = objOpts.event.folded_width;
              }

              //----------------------------------------------------------------------------------------------------------------------------------
              //show hittest
              if(objOpts.edit.editable){
                //live hittest
                if(objOpts.edit.hittest !== null){
                  if(["connect_marker", "disconnect_marker","connect_section", "disconnect_section", "delete_marker","change_marker_name","change_marker_distance","set_zero_point","enable_master","disable_master"].includes(objOpts.edit.mode)){
                    const hitId = [objOpts.edit.hittest.project, objOpts.edit.hittest.hole, objOpts.edit.hittest.section, objOpts.edit.hittest.nearest_marker];
                    if(Math.abs(objOpts.edit.hittest.nearest_distance) < objOpts.edit.sensibility){
                      if(hitId.toString() == marker.id.toString()){
                        if(["disconnect_marker","connect_section"].includes(objOpts.edit.mode)){
                          if(marker.name.includes("top") || marker.name.includes("bottom")){
                            sketch.strokeWeight(3);
                            sketch.stroke("Red");
                          }
                        }else{
                          sketch.strokeWeight(3);
                          sketch.stroke("Red");
                        }
                      }
                    }
                  } else if(objOpts.edit.mode == "add_marker"){
                    if(objOpts.edit.hittest.project == project.id[0] && objOpts.edit.hittest.hole == hole.id[1] && objOpts.edit.hittest.section == section.id[2]){
                      sketch.push();//save
                      sketch.strokeWeight(1);
                      sketch.stroke("Red");
                      sketch.line(
                        (hole_x0 + shift_x) * xMag + pad_x,
                        sketch.mouseY+scroller.scrollTop, //(marker_top + shift_y) * yMag + pad_y,
                        (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * mw * xMag,// + topBot,
                        sketch.mouseY+scroller.scrollTop, //(marker_top + shift_y) * yMag + pad_y
                      )
                      sketch.pop();//load
                    }
                  }
                } 

                if(objOpts.edit.marker_from !== null && ["connect_marker", "disconnect_marker", "connect_section", "disconnect_section", "delete_marker"].includes(objOpts.edit.mode)){
                  const hitId = [objOpts.edit.marker_from.project, objOpts.edit.marker_from.hole, objOpts.edit.marker_from.section, objOpts.edit.marker_from.nearest_marker];
                  if(hitId.toString() == marker.id.toString()){
                    sketch.strokeWeight(3);
                    sketch.stroke("Red");

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
                    sketch.stroke("Red");
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
              if (marker.isMaster) {
                if (section.markers[m + 1] !== undefined) {
                  if (section.markers[m + 1].isMaster) {
                    sketch.drawingContext.setLineDash([]);
                    sketch.strokeWeight(4);                    
                    sketch.stroke("blue"); //(markerLineColour);
                    if(project.model_type == "duo"){
                      sketch.stroke(115,167,209);
                    }
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

                //connection rank
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
                  9
                );

                //cd rank(unreliability)
                if (marker.unreliability== 1) {
                  sketch.fill("red");
                  sketch.ellipse(
                    (hole_x0 + shift_x) * xMag + pad_x,
                    (marker_top + shift_y) * yMag + pad_y,
                    4
                  );
                }

                //master flag
                if (marker.isMaster){
                  sketch.noFill();
                  sketch.stroke("Blue");
                  sketch.strokeWeight(1); 
                  sketch.ellipse(
                    (hole_x0 + shift_x) * xMag + pad_x,
                    (marker_top + shift_y) * yMag + pad_y,
                    12
                  );
                }
              }

              
              //add marker name without top/bottom name
              if(objOpts.marker.show_labels){
                //add marker name--------------------------------------------
                if (m !== 0 && m !== section.markers.length - 1) {
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

                //add marker distance----------------------------------------
                sketch.fill(objOpts.marker.font_colour);
                sketch.noStroke();
                sketch.textFont(objOpts.marker.font);
                sketch.textSize(objOpts.marker.font_size);
                sketch.text(
                  (Math.round(marker.distance * 10) / 10).toFixed(1).toString(),
                  (hole_x0 + shift_x) * xMag + pad_x + objOpts.marker.width * xMag + 5,
                  (marker_top + shift_y) * yMag + pad_y - 2
                );
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
                      connection_colour = [115,167,209];
                    }else{
                      connection_colour = "Blue";
                    }                    
                    connection_line_width = objOpts.connection.line_width * 1.3
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
      if (LCPlot !== null && LCPlot.age_collections.length > 0) {
        let age_plot_idx = null;
        LCPlot.age_collections.forEach((a, idx) => {
          if (a.id == LCPlot.age_selected_id) {
            age_plot_idx = idx;
          }
        });

        //get age data(because age data, age series is single)
        const ageSet = LCPlot.age_collections[age_plot_idx].datasets[0];

        //get position & plot        
        for (let a = 0; a < ageSet.data_series.length; a++) {    
          let pData = {
            type: "age", //used
            amplification_x: 1,//used
            amplification_y: 1, //used
            original_depth_type: ageSet.data_series[a].original_depth_type,//used

            x: ageSet.data_series[a].data, //used
            min_x:NaN,

            hole_name: ageSet.data_series[a].original_depth_type=="trinity" ? ageSet.data_series[a].trinity.hole_name : null, //used
            section_name: ageSet.data_series[a].original_depth_type=="trinity" ? ageSet.data_series[a].trinity.section_name : null,
            distance: ageSet.data_series[a].original_depth_type=="trinity" ? ageSet.data_series[a].trinity.distance : null,
            composite_depth: ageSet.data_series[a].composite_depth,//used
            evemnt_free_depth: ageSet.data_series[a].event_free_depth,//used
            age: ageSet.data_series[a].age,//used
          } 

          const result = getPlotPosiotion( pData, LCCore, objOpts);

          const posX = result.pos_canvas_x;
          const posY = result.pos_canvas_y;
          //check inside
          const age_rect = {
            x: posX,
            y: posY,
            width: objOpts.age.incon_size,
            height: objOpts.age.incon_size,
          };
          if (!isInside(view_rect, age_rect, 500)) {
            continue;
          }

          //plot main
          if (ageSet.data_series[a].source_type == "" || agePlotIcons[ageSet.data_series[a].source_type] == undefined) {
            sketch.image(
              agePlotIcons["none"],
              posX,
              posY,
              objOpts.age.incon_size,
              objOpts.age.incon_size
            );
          } else { 
            if(ageSet.data_series[a].enable==true){
              if(ageSet.data_series[a].reliable == true){
                sketch.image(
                  agePlotIcons[ageSet.data_series[a].source_type],
                  posX,
                  posY,
                  objOpts.age.incon_size,
                  objOpts.age.incon_size
                );
              }else{
                sketch.image(
                  agePlotIcons[ageSet.data_series[a].source_type+"_unreliable"],
                  posX,
                  posY,
                  objOpts.age.incon_size,
                  objOpts.age.incon_size
                );
              }
            }else{
              sketch.image(
                agePlotIcons[ageSet.data_series[a].source_type+"_disable"],
                posX,
                posY,
                objOpts.age.incon_size,
                objOpts.age.incon_size
              );
            }                
            
          }
        }
      }
      
      //==========================================================================================
      //==========================================================================================
      //draw data points
      if(objOpts.plot.isVisible == true){
        if(objOpts.plot.selected_options !== null){
          sketch.push();

          const selectedList = objOpts.plot.selected_options;
          for(let t=0; t< selectedList.length;t++){
            const target = selectedList[t];           
            
            //check draw
            if(target.isDraw == false){
                continue
            }
  
            //main
            //get idx
            let colIdx = null;
            LCPlot.data_collections.forEach((c,i)=>{
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
            LCPlot.data_collections[colIdx].datasets.forEach((d,i)=>{
                if(d.id == target.numeratorId){
                    nIdx = i;
                }
                if(d.id == target.denominatorId){
                    dIdx = i;
                }
            })
            
            if(nIdx==null && dIdx==null){
                continue
            }

            //calc draw positions
            let xoffset = 0;
            if(objOpts.plot.on_section == false){
              xoffset = objOpts.section.width;
            };

            let drawPositions = {
              name:"",
              unit:"",
              max_x:NaN,
              min_x:NaN,
              pos_max_x:NaN,
              pos_min_x:NaN,            
              data:{
                global:{
                  data:[],
                  max_x:NaN,
                  min_x:NaN,
                  hole_max_x:NaN,
                  hole_min_x:NaN,
                  hole_zero_x:NaN,
                },
              },//stack each hole data
            };
            LCCore.projects.forEach(tempp=>{
              tempp.holes.forEach(temph=>{
                drawPositions.data[temph.id.toString()] = {data:[],max_x:NaN,min_x:NaN,hole_max_x:NaN,hole_min_x:NaN,hole_zero_x:NaN};
              })
            })

            if(nIdx!==null && dIdx!==null){
              //case numerator/denominator

              //get original data
              const numeratorData   = LCPlot.data_collections[colIdx].datasets[nIdx];
              const denominatorData = LCPlot.data_collections[colIdx].datasets[dIdx];
              const numdenoData = numeratorData.data_series.map((val,idx)=>val.data / denominatorData.data_series[idx].data);
              const minNumDno = Math.min(...numdenoData.filter(val=>val!==null&&!isNaN(val)&&val!==Infinity&&val!==-Infinity));
              const maxNumDno = Math.max(...numdenoData.filter(val=>val!==null&&!isNaN(val)&&val!==Infinity&&val!==-Infinity));
                            
              const dataMin = minNumDno;
              const dataMax = maxNumDno;
              drawPositions.max_x = dataMax;
              drawPositions.min_x = dataMin;
              drawPositions.unit  = numeratorData.unit + "/" + denominatorData.unit;
              drawPositions.name  = numeratorData.name + "/" + denominatorData.name;
              
              for(let i=0; i<numeratorData.data_series.length;i++){
                //get hole name
                let holeName = "global";
                if(numeratorData.data_series[i].original_depth_type=="trinity"){
                  LCCore.projects.forEach(tempp=>{tempp.holes.forEach(temph=>{
                    if(temph.name == numeratorData.data_series[i].trinity.hole_name){
                      holeName = temph.id.toString();//at this point, different prroject but same hole is not supported
                    }
                  })})                  
                }

                //get plot position
                let pData = {
                  type: "data", //used
                  amplification_x: (objOpts.hole.width / 2) * target.amplification / (dataMax - dataMin),//used
                  amplification_y: 1, //used
                  original_depth_type: numeratorData.data_series[i].original_depth_type,//used
      
                  x: numeratorData.data_series[i].data / denominatorData.data_series[i].data, //used
                  min_x: dataMin,
      
                  hole_name: numeratorData.data_series[i].original_depth_type=="trinity" ? numeratorData.data_series[i].trinity.hole_name : null, //used
                  section_name: numeratorData.data_series[i].original_depth_type=="trinity" ? numeratorData.data_series[i].trinity.section_name : null,
                  distance: numeratorData.data_series[i].original_depth_type=="trinity" ? numeratorData.data_series[i].trinity.distance : null,
                  composite_depth: numeratorData.data_series[i].composite_depth,//used
                  evemnt_free_depth: numeratorData.data_series[i].event_free_depth,//used
                  age: numeratorData.data_series[i].age,//used
                }  

                //get position
                let result = getPlotPosiotion( pData, LCCore, objOpts);

                if(isNaN(drawPositions.data[holeName].hole_max_x) || drawPositions.data[holeName].hole_max_x < result.pos_canvas_x){
                  drawPositions.data[holeName].hole_max_x = result.pos_canvas_x;
                  drawPositions.data[holeName].max_x      = result.original_x;
                }
                if(isNaN(drawPositions.data[holeName].hole_min_x) || drawPositions.data[holeName].hole_min_x > result.pos_canvas_x){
                  drawPositions.data[holeName].hole_min_x = result.pos_canvas_x;
                  drawPositions.data[holeName].min_x      = result.original_x;
                }
                //get 0 position
                if(isNaN(drawPositions.data[holeName].hole_zero_x)){
                  pData.x = 0;
                  const zeroResult = getPlotPosiotion( pData, LCCore, objOpts);
                  drawPositions.data[holeName].hole_zero_x = zeroResult.pos_canvas_x;
                }

                //add plot list
                drawPositions.data[holeName].data.push(result);

                //
                if(drawPositions.data[holeName].data.length>1){
                  const prevSectionName = drawPositions.data[holeName].data[drawPositions.data[holeName].data.length-2].section_name;

                  if(prevSectionName !== pData.section_name){
                    //different section, add separator
                    result.original_x = NaN;
                    result.original_y = NaN;
                    result.pos_canvas_x = NaN;
                    result.pos_canvas_y = NaN;
                    drawPositions.data[holeName].data.push(result);
                  }
                }
              }
             
              
            }else if(nIdx!==null){
              //case numerator
              //get original data
              const numeratorData   = LCPlot.data_collections[colIdx].datasets[nIdx];

              const minNum = Math.min(...numeratorData.data_series.filter(value => (!isNaN(value.data) && value.data!==null)).map(value => value.data));
              const maxNum = Math.max(...numeratorData.data_series.filter(value => (!isNaN(value.data) && value.data!==null)).map(value => value.data));
              const dataMin = minNum;
              const dataMax = maxNum;
              drawPositions.max_x = dataMax;
              drawPositions.min_x = dataMin;
              drawPositions.unit  = numeratorData.unit;
              drawPositions.name  = numeratorData.name;
              
              for(let i=0; i<numeratorData.data_series.length;i++){
                //get hole name
                let holeName = "global";
                if(numeratorData.data_series[i].original_depth_type=="trinity"){
                  LCCore.projects.forEach(tempp=>{tempp.holes.forEach(temph=>{
                    if(temph.name == numeratorData.data_series[i].trinity.hole_name){
                      holeName = temph.id.toString();//at this point, different prroject but same hole is not supported
                    }
                  })})                  
                }

                //get plot position
                let pData = {
                  type: "data", //used
                  amplification_x: (objOpts.hole.width / 2) * target.amplification / (dataMax - dataMin),//used
                  amplification_y: 1, //used
                  original_depth_type: numeratorData.data_series[i].original_depth_type,//used
      
                  x: numeratorData.data_series[i].data, //used
                  min_x: dataMin,
      
                  hole_name: numeratorData.data_series[i].original_depth_type=="trinity" ? numeratorData.data_series[i].trinity.hole_name : null, //used
                  section_name: numeratorData.data_series[i].original_depth_type=="trinity" ? numeratorData.data_series[i].trinity.section_name : null,
                  distance: numeratorData.data_series[i].original_depth_type=="trinity" ? numeratorData.data_series[i].trinity.distance : null,
                  composite_depth: numeratorData.data_series[i].composite_depth,//used
                  evemnt_free_depth: numeratorData.data_series[i].event_free_depth,//used
                  age: numeratorData.data_series[i].age,//used
                }  

                //get position
                let result = getPlotPosiotion( pData, LCCore, objOpts);

                if(isNaN(drawPositions.data[holeName].hole_max_x) || drawPositions.data[holeName].hole_max_x < result.pos_canvas_x){
                  drawPositions.data[holeName].hole_max_x = result.pos_canvas_x;
                  drawPositions.data[holeName].max_x      = result.original_x;
                }
                if(isNaN(drawPositions.data[holeName].hole_min_x) || drawPositions.data[holeName].hole_min_x > result.pos_canvas_x){
                  drawPositions.data[holeName].hole_min_x = result.pos_canvas_x;
                  drawPositions.data[holeName].min_x      = result.original_x;
                }

                //get 0 position
                if(isNaN(drawPositions.data[holeName].hole_zero_x)){
                  pData.x = 0;
                  const zeroResult = getPlotPosiotion( pData, LCCore, objOpts);
                  drawPositions.data[holeName].hole_zero_x = zeroResult.pos_canvas_x;
                }

                //add plot list
                drawPositions.data[holeName].data.push(result);

                //
                if(drawPositions.data[holeName].data.length>1){
                  const prevSectionName = drawPositions.data[holeName].data[drawPositions.data[holeName].data.length-2].section_name;

                  if(prevSectionName !== pData.section_name){
                    //different section, add separator
                    result.original_x = NaN;
                    result.original_y = NaN;
                    result.pos_canvas_x = NaN;
                    result.pos_canvas_y = NaN;
                    drawPositions.data[holeName].data.push(result);
                  }
                }
              }
            }else if(dIdx!==null){
              //case 1/denominator

              //get original data
              const denominatorData = LCPlot.data_collections[colIdx].datasets[dIdx];

              const minDno = Math.min(...denominatorData.data_series.filter(value => (!isNaN(value.data) && value.data!==null)).map(value => 1 / value.data));
              const maxDno = Math.max(...denominatorData.data_series.filter(value => (!isNaN(value.data) && value.data!==null)).map(value => 1 / value.data));

              const dataMin = minDno;
              const dataMax = maxDno;
              drawPositions.max_x = dataMax;
              drawPositions.min_x = dataMin;
              drawPositions.unit  = denominatorData.unit;
              drawPositions.name  = denominatorData.name;
              
              for(let i=0; i<denominatorData.data_series.length;i++){
                //get hole name
                let holeName = "global";
                if(denominatorData.data_series[i].original_depth_type=="trinity"){
                  LCCore.projects.forEach(tempp=>{tempp.holes.forEach(temph=>{
                    if(temph.name == denominatorData.data_series[i].trinity.hole_name){
                      holeName = temph.id.toString();//at this point, different prroject but same hole is not supported
                    }
                  })})                  
                }

                //get plot position
                let pData = {
                  type: "data", //used
                  amplification_x: (objOpts.hole.width / 2) * target.amplification / (dataMax - dataMin),//used
                  amplification_y: 1, //used
                  original_depth_type: denominatorData.data_series[i].original_depth_type,//used
      
                  x: 1 / denominatorData.data_series[i].data, //used
                  min_x: dataMin,
      
                  hole_name: denominatorData.data_series[i].original_depth_type=="trinity" ? denominatorData.data_series[i].trinity.hole_name : null, //used
                  section_name: denominatorData.data_series[i].original_depth_type=="trinity" ? denominatorData.data_series[i].trinity.section_name : null,
                  distance: denominatorData.data_series[i].original_depth_type=="trinity" ? denominatorData.data_series[i].trinity.distance : null,
                  composite_depth: denominatorData.data_series[i].composite_depth,//used
                  evemnt_free_depth: denominatorData.data_series[i].event_free_depth,//used
                  age: denominatorData.data_series[i].age,//used
                }  

                //get position
                let result = getPlotPosiotion( pData, LCCore, objOpts);

                if(isNaN(drawPositions.data[holeName].hole_max_x) || drawPositions.data[holeName].hole_max_x < result.pos_canvas_x){
                  drawPositions.data[holeName].hole_max_x = result.pos_canvas_x;
                  drawPositions.data[holeName].max_x      = result.original_x;
                }
                if(isNaN(drawPositions.data[holeName].hole_min_x) || drawPositions.data[holeName].hole_min_x > result.pos_canvas_x){
                  drawPositions.data[holeName].hole_min_x = result.pos_canvas_x;
                  drawPositions.data[holeName].min_x      = result.original_x;
                }
                //get 0 position
                if(isNaN(drawPositions.data[holeName].hole_zero_x)){
                  pData.x = 0;
                  const zeroResult = getPlotPosiotion( pData, LCCore, objOpts);
                  drawPositions.data[holeName].hole_zero_x = zeroResult.pos_canvas_x;
                }

                //add plot list
                drawPositions.data[holeName].data.push(result);

                //
                if(drawPositions.data[holeName].data.length>1){
                  const prevSectionName = drawPositions.data[holeName].data[drawPositions.data[holeName].data.length-2].section_name;

                  if(prevSectionName !== pData.section_name){
                    //different section, add separator
                    result.original_x = NaN;
                    result.original_y = NaN;
                    result.pos_canvas_x = NaN;
                    result.pos_canvas_y = NaN;
                    drawPositions.data[holeName].data.push(result);
                  }
                }
              }



            }

            drawPositions.pos_max_x = Math.max(...Object.values(drawPositions.data).flatMap(item=>item.hole_max_x).filter(value => !isNaN(value)));
            drawPositions.pos_min_x = Math.min(...Object.values(drawPositions.data).flatMap(item=>item.hole_min_x).filter(value => !isNaN(value)));

            //draw plot
            if(target.plotType =="line"){
              for(let holeKey in drawPositions.data){
                const posData = drawPositions.data[holeKey].data;
                if(posData.length==0){
                  continue
                }

                //if data exist
                sketch.strokeWeight(1);
                sketch.stroke(target.colour);
                for(let i=0; i<posData.length-1;i++){
                  //check is draw
                  const data_rect = {
                    x: posData[i].pos_canvas_x,
                    y: posData[i].pos_canvas_y,
                    width: posData[i+1].pos_canvas_x-posData[i].pos_canvas_x,
                    height: posData[i+1].pos_canvas_y-posData[i].pos_canvas_y,
                  };
                  if (!isInside(view_rect, data_rect, 500)) {
                    continue;
                  } 
                  //draw
                  sketch.line(
                    posData[i].pos_canvas_x,
                    posData[i].pos_canvas_y,
                    posData[i+1].pos_canvas_x,
                    posData[i+1].pos_canvas_y,
                  )
                }

              }
            }else if(target.plotType == "scatter"){
              sketch.push();
              sketch.noStroke();
              sketch.fill(target.colour);
               
              for(let holeKey in drawPositions.data){
                const posData = drawPositions.data[holeKey].data;
                if(posData.length==0){
                  continue
                }

                //if data exist
                sketch.strokeWeight(1);
                sketch.stroke(target.colour);
                for(let i=0; i<posData.length-1;i++){
                  //check is draw
                  const data_rect = {
                    x: posData[i].pos_canvas_x,
                    y: posData[i].pos_canvas_y,
                    width: posData[i+1].pos_canvas_x-posData[i].pos_canvas_x,
                    height: posData[i+1].pos_canvas_y-posData[i].pos_canvas_y,
                  };
                  if (!isInside(view_rect, data_rect, 500)) {
                    continue;
                  } 
                  //draw
                  sketch.ellipse(
                    posData[i].pos_canvas_x,
                    posData[i].pos_canvas_y,
                    3
                ); 
                }
              }
              sketch.pop();              
            }else if(target.plotType == "bar"){
              sketch.push()
              const binWidth = 4;

              for(let holeKey in drawPositions.data){
                const posData = drawPositions.data[holeKey].data;
                if(posData.length==0){
                  continue
                }

                //if data exist
                sketch.noStroke();
                sketch.fill(target.colour);
                for(let i=0; i<posData.length;i++){
                  //check is draw
                  const data_rect = {
                    x: posData[i].pos_canvas_x,
                    y: posData[i].pos_canvas_y,
                    width: posData.hole_max_x = posData.hole_min_x,
                    height: binWidth,
                  };
                  if (!isInside(view_rect, data_rect, 500)) {
                    continue;
                  } 


                  let rectX0 = drawPositions.data[holeKey].hole_zero_x;//hole_min_x
                  if(drawPositions.max_x < 0){
                    rectX0 = drawPositions.pos_max_x;
                  }
                  if(drawPositions.min_x > 0){
                    rectX0 = drawPositions.pos_min_x;
                  }
                  let rectX1 = posData[i].pos_canvas_x;
                  let rectY0 = posData[i].pos_canvas_y - binWidth/2;
                  let rectY1 = posData[i].pos_canvas_y + binWidth/2;
                  
                  //draw
                  sketch.rect(
                    rectX0,
                    rectY0,
                    rectX1 - rectX0,
                    rectY1 - rectY0,
                  );
                }

              }
              sketch.pop()
            }

            //x scale
            sketch.push()
            for(const plotKey in drawPositions.data){
              if(drawPositions.data[plotKey].data.length>0){
                sketch.strokeWeight(1);
                sketch.stroke(target.colour);    
                sketch.line(
                  drawPositions.data[plotKey].hole_min_x,
                  100    + scroller.scrollTop,
                  drawPositions.data[plotKey].hole_max_x,
                  100    + scroller.scrollTop,
                )
                sketch.textSize(12);
                sketch.noStroke();
                sketch.fill(target.colour)
                sketch.text(
                  autoRound(drawPositions.data[plotKey].min_x).toString(),
                  drawPositions.data[plotKey].hole_min_x - sketch.textWidth(autoRound(drawPositions.data[plotKey].min_x).toString()),
                  90    + scroller.scrollTop,
                )
                sketch.text(
                  autoRound(drawPositions.data[plotKey].max_x).toString(),
                  drawPositions.data[plotKey].hole_max_x,
                  90    + scroller.scrollTop,
                )
                const title = drawPositions.name + " [" +drawPositions.unit+"]";
                sketch.text(
                  title,
                  drawPositions.data[plotKey].hole_min_x + (drawPositions.data[plotKey].hole_max_x - drawPositions.data[plotKey].hole_min_x)/2 - sketch.textSize(title),
                  70    + scroller.scrollTop,
                )
              }
            }
            sketch.pop()
          }
          sketch.pop();
        }
      }
      

      /*
      objOpts.plot.colour_dot = "gray";
      objOpts.plot.colour_line = "gray";
      objOpts.plot.colour_bar = "gray";
      objOpts.plot.collecion_idx = 0;
      objOpts.plot.series_idx = 0;
      objOpts.plot.selected_options = null;
      */

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
    
    sketch.mouseClicked = () => {
      if (clickCount == 2) {
        startPoint = null;
        clickCount -= 1;
        sketch.loop();
        //convert depth scale
        startPoint = getClickedItemIdx(sketch.mouseX, sketch.mouseY, LCCore, objOpts)        
        //startPoint[0] = (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir - objOpts.canvas.shift_x;
        //startPoint[1] = (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y - age_correction[1]) / (objOpts.canvas.zoom_level[1]  * objOpts.canvas.dpir * age_correction[0]) - objOpts.canvas.shift_y;
        //finish
        console.log("[Measure]: Strat from " + startPoint.y);
      } else if (clickCount == 1) {
        endPoint = null;
        clickCount -= 1;
        sketch.noLoop();
        //convert depth scale
        endPoint = getClickedItemIdx(sketch.mouseX, sketch.mouseY, LCCore, objOpts) 
        //endPoint[0] = (sketch.mouseX + scroller.scrollLeft - objOpts.canvas.pad_x) / objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir - objOpts.canvas.shift_x;
        //endPoint[1] = (sketch.mouseY + scroller.scrollTop - objOpts.canvas.pad_y - age_correction[1]) / (objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir * age_correction[0]) - objOpts.canvas.shift_y;
        //finish
        console.log("[Measure]: End to " + endPoint.y);

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
    const upperData = await window.LCapi.depthConverter(["", y0, upperTargetId], objOpts.canvas.depth_scale, "linear");
    const lowerData = await window.LCapi.depthConverter(["", y1, upperTargetId], objOpts.canvas.depth_scale, "linear");

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
    sketch.keyPressed = () => {
      if (sketch.key === 'n' && sketch.keyIsDown(sketch.CONTROL)) { 
        if (confirm("Are you sure you want to delete the written data?")) {
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
    const results = await window.LCapi.RegisterModelFromCsv(in_path);

    if (results == null) {
      console.log("[Renderer]: Failed to resister correlation model.")
      return null;
    }else{
      console.log("[Renderer]: Correlation Model has been resistered into the LCCore: " + in_path.name +".");
    }
    return true;
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
  async function loadModel() {
    //load model into LCCore
    //now, LC is able to hold one project file, model_id is dummy
     const result = await window.LCapi.LoadModelFromLCCore();

     if(result !== null){
      //unzip
      const cs = new DecompressionStream('gzip');
      const decompressedStream = new Response(
        new Blob([result]).stream().pipeThrough(cs)
      );
      const decompressed = await decompressedStream.text();
      LCCore = JSON.parse(decompressed);

      if (LCCore) {
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
          projListCheck.checked = backup_hole_enable[project.id.toString()] !== undefined?  backup_hole_enable[project.id.toString()]:true;
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
  
        //calc composite depth
        LCCore = await window.LCapi.CalcCompositeDepth();
  
        //calc event free depth
        LCCore = await window.LCapi.CalcEventFreeDepth();
  
        //sort
        sortHoleByOrder(LCCore);
  
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
        LCCore.projects.forEach(p=>{
          console.log(
            "Project ID: " + p.id[0],
            "\nProject name: " + p.name,
            "\nVersion: " + p.correlation_version,
            "\nType: " + p.model_type,
            "\nModel data: " , LCCore
          );
        })
  
        updateView();
      }

     }    
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
      age_model_list.push(results); //{id,name}

      //add dropdown
      const newOption = document.createElement("option");
      newOption.value = results.id;
      newOption.textContent = results.name;
      document.getElementById("AgeModelSelect").appendChild(newOption);

      console.log("[Renderer]: Age Model has been registered into the LCAge: "+results.name);
      //console.log(results);
    }
  }
  async function loadAge(age_id) {
    //load age model
    const results = await window.LCapi.LoadAgeFromLCAge(age_id);

    if (results) {
      //unzip
      const cs = new DecompressionStream('gzip');
      const decompressedStream = new Response(
        new Blob([results]).stream().pipeThrough(cs)
      );
      const decompressed = await decompressedStream.text();
      LCCore = JSON.parse(decompressed);

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

      console.log("[Renderer]: Marker Ages updated.",LCCore);

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
    const loadResult = await window.LCapi.RegisterLCmodel(in_path);

    setAgeList(loadResult);
  } 
  function setAgeList(loadResult){
    if(loadResult !== false){
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
  async function loadPlotData() {
    //LC plot age_collection id is as same as LCAge id
    const results = await window.LCapi.LoadPlotFromLCPlot();
    if (results!==null) {
      //unzip
      const cs = new DecompressionStream('gzip');
      const decompressedStream = new Response(
        new Blob([results]).stream().pipeThrough(cs)
      );
      const decompressed = await decompressedStream.text();
      const originalData = JSON.parse(decompressed);

      //load
      LCPlot = originalData;
      const num_age_collections = LCPlot.age_collections.length;
      const num_data_collections= LCPlot.data_collections.length;
      console.log("[Renderer]: Plot Data have been loaded into the renderer.");
      console.log(
        "Plot data summary:",
        "\nAge dataset: " + num_age_collections,
        "\nData dataset:" + num_data_collections,
        "\nData: ", LCPlot
      );
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
    await window.LCapi.InitialiseAgePlot();
    await window.LCapi.InitialiseDataPlot();

    LCPlot = null;
  }
  function initialiseImages(){
    let modelImages = {
      load_target_ids: [],
      image_resolution: {},
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
    if (LCCore) {
      //update
      if (vectorObjects == null) {
        vectorObjects = new p5(p5Sketch);
      }

      document.getElementById("p5Canvas").style.display = "block";
      document.getElementById("rasterCanvas").style.display = "none";

      makeP5CanvasBase();
      //vectorObjects.clear();
      vectorObjects.redraw();
    }

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
    return null;
  }
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
  if(hittest.section!==null){
    const targetId = [hittest.project, hittest.hole, hittest.section, null];
    const calcedData = await window.LCapi.depthConverter(["", hittest.y, targetId], objOpts.canvas.depth_scale, "linear");
    age = calcedData !== null ? calcedData.age_mid.toFixed(objOpts.canvas.age_precision) + " calBP)" : "---)";
  }

  if (objOpts.canvas.depth_scale == "age") {
  txt = "Age: " + hittest.y.toFixed(objOpts.canvas.age_precision) + " calBP";
  }else if (objOpts.canvas.depth_scale == "composite_depth") {
    txt =
      "Composite Depth: " +
      (hittest.y/100).toFixed(2) +
      " m (Age: " +
      age
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
  } else if (objOpts.canvas.depth_scale == "canvas_position") {
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
      if (objOpts.canvas.depth_scale == "event_free_depth" || objOpts.canvas.depth_scale == "age") {
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
      "black"
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
async function createCircleImage(p, canvasSize, radius, color) {
  let fallbackImg = p.createGraphics(canvasSize, canvasSize);
  fallbackImg.clear();
  fallbackImg.fill(color);
  fallbackImg.ellipse(canvasSize / 2, canvasSize / 2, radius * 2, radius * 2);
  return fallbackImg;
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
async function undo(type){
  return new Promise(async(resolve, reject)=>{
    let result;
    if(type == "undo"){
      result = await window.LCapi.sendUndo("main");
      console.log("[Renderer]: Recieved undo data: "+result);
    }else if(type == "redo"){
      result = await window.LCapi.sendRedo("main");
      console.log("[Renderer]: Recieved redo data: "+result);
    }else if(type == "save"){
      result = await window.LCapi.sendSaveState("main");
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
            const isImExist = await window.LCapi.CheckImagesInDir(h.name+"-"+s.name+".jpg");
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
  return new Promise(async (resolve, reject) => {
    //initialise
    let results = modelImages;

    try{
      //check
      if (LCCore == null) {
        console.log("[Renderer]: There is no LCCore.");
        await window.LCapi.updateProgressbar(1, 1);
        resolve(results);
        return;
      }
      
      if (operations.includes("composite_depth") || operations.includes("event_free_depth") || operations.includes("age")) {
        if(!operations.includes("drilling_depth")){
          if (Object.keys(modelImages.drilling_depth).length == 0) {
            console.log("[Renderer]: There is no original image.");
            await window.LCapi.updateProgressbar(1, 1);
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
                modelImages.load_target_ids.push(s.id);
              });
            });
          });
        }else{
          //case target
          console.log("[Renderer]: Load selected images]")
        }
        
        N = modelImages.load_target_ids.length;
      }else{
        N=0;
        modelImages.load_target_ids=[];
      }
      
      if(N==0){
        console.log("[Renderer]: There is no update image.")
        await window.LCapi.updateProgressbar(1, 1);
        resolve(results);
        return;
      }

      //main Progress   
      await new Promise(async(p5resolve,p5reject) => {
        try{
          //load image
          const imageBuffers = await new Promise(async(resolve, reject)=>{
            const imBufferDict = await window.LCapi.LoadCoreImage({
              targetIds:modelImages.load_target_ids,
              operations:operations,
              dpcm:objOpts.image.dpcm,
            },"core_images");
            resolve(imBufferDict)
          }) 

          results = await assignCoreImages(results, imageBuffers, objOpts);
          results.load_target_ids = [];
          p5resolve();
        }catch(err){
          p5reject();
        }
        
      });
      
      resolve(results);
    }catch(err){
      console.error(err);
      reject(results);
    }
  });

}
async function assignCoreImages(coreImages, imageBuffers, objOpts) {
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
          await window.LCapi.progressbar("Assigning images", "Now assigning...",true);
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
            for (const imName in imageBuffers[depthScale]) {
              const promise = new Promise(async (resolveImage) => {
                try {
                  let blob = new Blob([imageBuffers[depthScale][imName]], { type: 'image/jpeg' });
                  let url = URL.createObjectURL(blob);
                  results[depthScale][imName] = await p.loadImage(
                    url,
                    async () => {
                      //console.log("[Renderer]: Assign image of " + imName +" in "+depthScale);
                      suc+=1;
                      resolveImage();
                    },
                    async () => {
                      //console.log("[Renderer]: Failed to assign image of " + imName +" in "+depthScale);
                      resolveImage();
                    }
                  );
                  results.image_resolution[imName] = objOpts.image.dpcm;
                } catch (err) {
                  console.log(err);
                  results[depthScale][imName] = undefined;
                  resolveImage();
                }
  
                n+=1;
                //await window.LCapi.updateProgressbar(n, N, "");
              });
              promises.push(promise);            
            }
          }
          
          await Promise.all(promises);
          
          resolve(results);
        } catch (err) {
          reject(err);
        }
      });
    });

    await window.LCapi.clearProgressbar();
    console.log("[Renderer]: Load " + suc + " images / " + N + " models.");
    return results;
  }catch(err){
    console.error("[Renderer]: An error occurred during image assignment:", error);
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
    console.log("Failed to load resource path", error);

  }
}
function loadToolIcons(objOpts) {
  for (let key in objOpts.interface.icon_list) {
    try {
      data =  objOpts.interface.icon_list[key];
      document.getElementById(key).querySelector("img").src = data;
    }catch{}
  }
}
//--------------------------------------------------------------------------------------------------
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

  let results = {
    x:x, 
    y:y, 
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
  };
  
  if(!LCCore){return results}

  breakpoint:
  for(let p=0; p<LCCore.projects.length; p++){
    let num_enable_right = 0;
    LCCore.projects[p].holes.forEach(hc=>{
      if(hc.enable){
        num_enable_right++;
      }
    })
    let num_enable_left = 0;
    LCCore.projects.filter(p1=>p1.order<LCCore.projects[p].order).forEach(p2=>p2.holes.forEach(h1=>{if(h1.enable){num_enable_left++;}}))
      
    //const project_x0 = ((objOpts.section.width + objOpts.hole.distance) * num_enable_left + shift_x) * xMag + pad_x - 3;
    //const project_w  = (objOpts.section.width + objOpts.hole.distance) * num_enable_right * xMag - objOpts.hole.distance/2;
    const project_x0 = (objOpts.section.width + objOpts.hole.distance) * num_enable_left  + 1;
    let project_w    = (objOpts.section.width + objOpts.hole.distance) * num_enable_right + 1;
    if(num_enable_right == 0){
      project_w = (objOpts.hole.distance + objOpts.hole.width);
    }
    const project_x1 = project_x0 + project_w;
    if(x >= project_x0 && x <= project_x1){
      results.project = LCCore.projects[p].id[0];
      results.projectName = LCCore.projects[p].name;
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
        for(let s=0; s<LCCore.projects[p].holes[h].sections.length; s++){
          const sec_y0 = LCCore.projects[p].holes[h].sections[s].markers[0][objOpts.canvas.depth_scale];//cd/efd
          const sec_y1 = LCCore.projects[p].holes[h].sections[s].markers.slice(-1)[0][objOpts.canvas.depth_scale];//cd/efd

          if(y >= sec_y0 && y <= sec_y1){
            results.section = LCCore.projects[p].holes[h].sections[s].id[2];
            results.relative_y = (y-sec_y0)/(sec_y1-sec_y0);
            results.sectionName = LCCore.projects[p].holes[h].sections[s].name;

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
            results.nearest_marker   = LCCore.projects[p].holes[h].sections[s].markers[nearestIdx].id[3];   
            results.markerName       = LCCore.projects[p].holes[h].sections[s].markers[nearestIdx].name;
            results.upper_marker     = LCCore.projects[p].holes[h].sections[s].markers[upperIdx].id[3];
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
//============================================================================================
