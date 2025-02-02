document.addEventListener("DOMContentLoaded", () => {
  //-------------------------------------------------------------------------------------------
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  let original_image_height = 0;
  let zoom_rate = [0.3, 0.3];
  let mousePos = [0,0];
  let canvasPos = [0, 0]; //canvas scroller position
  let pad = [0,0];
  let tempCore = null;
  //initialise
  let vectorObjects = null; //p5 instance data
  let isSVG = false;
  let isDev = false;
  let holeName = "";
  let sectionName = "";
  let rect = null;  
  let modelImages = {
    load_target_ids: [],
    image_resolution: {},
    drilling_depth: {},
    composite_depth: {},
    event_free_depth: {},
    age:{},
    operations:[],
  };
  let objOpts = {
    tool_on: false,
    hittest: null,
    marker_from: null,
    marker_to: null,
    mode: null,
    handleMove: null,
    handleClick: null,
    sensibility:20,
    dpcm:150,
  };
  //-------------------------------------------------------------------------------------------
  window.LabelerApi.receive("LabelerMenuClicked", async () => {
    loadToolIcons();
    const res = await initialise();
    if(res){
      console.log("Initialised models: ",tempCore);
      console.log("Initialised images; ", modelImages);
    }
  });
  document.getElementById("resetButton").addEventListener("click", async (event) => {
    //initialise
    objOpts.hittest = null;
    objOpts.marker_from = null;
    objOpts.marker_to = null;
    objOpts.mode = null;
    if(objOpts.handleMove!==null){
      document.removeEventListener('mousemove', objOpts.handleMove);
      objOpts.handleMove = null;
    }
    if(objOpts.handleClick !== null){
      document.removeEventListener('click', objOpts.handleClick);
      objOpts.handleClick = null;
    }
    document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_delete_marker").style.backgroundColor = "#f0f0f0";

    const response = await window.LabelerApi.askdialog(
      "Initialise Canvas",
      "Do you want to Remove all data?"
    );
    if (response.response) {
      loadToolIcons();
      const res = await initialise();
      if(res){
        console.log("Initialised models: ",tempCore);
        console.log("Initialised images; ", modelImages);
      }
    }   
  });
  async function initialise(){
    tempCore = await window.LabelerApi.InitialiseTempCore();

    zoom_rate = [0.3, 0.3];
    relative_pos = [0, 0];
    mousePos = [0,0];
    canvasPos = [0, 0]; //canvas scroller position
    pad = [1200,500];

    //initialise
    if(vectorObjects!==null){
      vectorObjects.remove(); //p5 instance data
      vectorObjects = null;
    }
    
    isSVG = false;
    holeName = "";
    sectionName = "";
    rect = null;
    modelImages = {
      load_target_ids: [],
      image_resolution: {},
      drilling_depth: {},
      composite_depth: {},
      event_free_depth: {},
      age:{},
      operations:[],
    };
    objOpts = {
      tool_on: false,
      hittest: null,
      marker_from: null,
      marker_to: null,
      mode: null,
      handleMove: null,
      handleClick: null,
      sensibility:20,
      dpcm:150,
    };

    original_image_height = objOpts.dpcm * (100 - 0);
    return true
  }
  
  //-------------------------------------------------------------------------------------------
  document.getElementById("scroller").addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  
  document.getElementById("scroller").addEventListener("drop", async (e) => {
    e.preventDefault();
    if(Object.keys(modelImages.drilling_depth).length!==0){
      alert("The target image is already registered. To replace it with a new image, please press the 'Initialise' button first.");
      return
    }

    //get list
    let dataList = [];
    for(const file of e.dataTransfer.files){
      dataList.push({type:file.name.split(".").pop(), name:file.name, path:file});
    }

    //check
    let orderLC = [];
    let orderImage = [];

    //check lcmodel
    dataList.forEach((data,i)=>{
      if(data.type == "lcsection"){
        orderLC.push(i);
      }
    })
    //check image
    dataList.forEach((data,i)=>{
      if(data.type == "jpg"){
        orderImage.push(i);
      }
    })


    //load
    let droppedData;
    if(orderLC.length > 0){
      //load from model
      droppedData = dataList[orderLC[0]];
      const baseName = dataList[orderLC[0]].name.split(/[.]+/)[0];
      
      holeName = baseName.split(/[-]+/)[0];
      sectionName = baseName.split(/[-]+/)[1];

      const isImExist = await window.LabelerApi.isExistFile(droppedData.path, baseName+".jpg");

      //const isImExist = await window.LabelerApi.CheckImagesInDir(h.name+"-"+s.name+".jpg");
      if(isImExist){
        //if same name imaeg exist          
        tempCore = await addSectionData(holeName, sectionName);
        tempCore = await loadSectionModel(droppedData.path, droppedData.name);
        
        console.log("Load annotation data: \n",tempCore);
        //register&load image
        const res = await window.LabelerApi.RegisterCoreImage(droppedData.path, "labeler");
        if(res==true){
          //load images
          console.log("loading")
          modelImages = await loadCoreImages(modelImages, tempCore, objOpts, ["drilling_depth"]);
          console.log("Created model Info: \n",modelImages);
        }else{
          alert("Failed to load image. The image name and the model name need to match.")
          return
        }
      }else{
        alert("There is no image corresponding LC model. The image name and the model name need to match.");
        return
      }     
    }else{
      //load from image
      if(orderImage.length > 0){
        //chekc image exist, read only first image
        droppedData = dataList[orderImage[0]];
        const baseName = droppedData.name.split(/[.]+/)[0];
        holeName = baseName.split(/[-]+/)[0];
        sectionName = baseName.split(/[-]+/)[1];

        tempCore = await addSectionData(holeName, sectionName);
        console.log("Create new annotation data: \n",tempCore);

        //register&load image
        const res = await window.LabelerApi.RegisterCoreImage(droppedData.path, "labeler");

        if(res==true){
          //load images
          modelImages = await loadCoreImages(modelImages, tempCore, objOpts, ["drilling_depth"]);
          console.log("Created model Info: \n",modelImages);

          //check model exist
          const isExist = await window.LabelerApi.isExistFile(droppedData.path, baseName+".lcsection");
          if(isExist){
            tempCore = await window.LabelerApi.InitialiseTempCore();
            tempCore = await addSectionData(holeName, sectionName);
            tempCore = await loadSectionModel(droppedData.path, droppedData.name);
            console.log("Load annotation data: \n",tempCore);

          }

        }else{
          alert("Failed to load a image.")
          return
        }
      }
    }

    
  
    



    //show image
    makeP5CanvasBase();
    updateView();
    scroller.scrollTo(0,0);
  }); 
  document.addEventListener( "wheel",  function (event) {
    //event.preventDefault();
    //wheel event
    var deltaX = event.deltaX;
    var deltaY = event.deltaY;
    if (event.altKey) {      
      //add zoom level
      if(event.ctrlKey){
        zoom_rate[1] += 0.001 * deltaY;  
      }else{
        zoom_rate[0] += 0.001 * deltaY;
        zoom_rate[1] += 0.001 * deltaY;
      }

      //limit of smaller
      if (zoom_rate[1] < 0.1) {
        zoom_rate[1] = 0.1;
      }
      if (zoom_rate[0] < 0.1) {
        zoom_rate[0] = 0.1;
      }

      //mouse position
      const relative_scroll_pos_x = (scroller.scrollLeft - pad[0]) / scroller.scrollWidth;
      const relative_scroll_pos_y = (scroller.scrollTop  - pad[1]) / scroller.scrollHeight;

      //calc new canvas size
      //makeRasterObjects(false); //make only base canvas
      makeP5CanvasBase();
      const canvasBase_height = parseInt(canvasBase.style.height.match(/\d+/)[0], 10);
      const canvasBase_width  = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);

      //get new scroll pos
      const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x  + pad[0];
      const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y + pad[1];

      let x = new_scroll_pos_x;
      let y = new_scroll_pos_y;

      scroller.scrollTo(x, y); //move scroll position

      //update data
      canvasPos = [x, y];
      updateView();
    }
  });  
  scroller.addEventListener("scroll",async function (event) {
    ///scroller position
    canvasPos[0] = scroller.scrollLeft;//* xMag;
    canvasPos[1] = scroller.scrollTop;//* yMag;

    //update plot
    updateView();
  },
  { passive: false }
  );
  document.addEventListener("mousemove", async function (event) {
    if(!tempCore){return}
    rect = document.getElementById("p5Canvas").getBoundingClientRect();

    //positin in view
    var mouseX = event.clientX - rect.left;
    var mouseY = event.clientY - rect.top;

    //position in scroller
    const rowx = scroller.scrollLeft + mouseX;
    const rowy = scroller.scrollTop + mouseY;
    const x = (scroller.scrollLeft + mouseX) / zoom_rate[0];
    const y = (scroller.scrollTop + mouseY) / zoom_rate[1];
    mousePos = [x,y];
    const [rx,ry] = calcRelativePos();

    //hittest
    if(tempCore){
      const ht = getClickedItemIdx(mouseX, mouseY, tempCore, zoom_rate, pad);
      objOpts.hittest = ht;
      let dist = ht.distance;
      if(dist==null){
        dist=NaN;
      }
      
      //show footer
      if(isDev==true){
        document.getElementById("footerLeftText").innerText ="distance: "+dist.toFixed(2)+" cm; RowPos: <"+rowx.toFixed(0)+","+rowy.toFixed(0)+">; ZoomCorrectionPos: <" + x.toFixed(0)+","+y.toFixed(0)+">; RelativePos: <"+rx.toFixed(2)+","+ry.toFixed(2)+">";
      }else{
        document.getElementById("footerLeftText").innerText ="Distance: "+dist.toFixed(1)+" cm";
      }
    }
       
    updateView();
  });
  document.getElementById("bt_add_marker").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initialise
    objOpts.hittest = null;
    objOpts.marker_from = null;
    objOpts.marker_to = null;
    objOpts.mode = null;
    if(objOpts.handleMove!==null){
      document.removeEventListener('mousemove', objOpts.handleMove);
      objOpts.handleMove = null;
    }
    if(objOpts.handleClick !== null){
      document.removeEventListener('click', objOpts.handleClick);
      objOpts.handleClick = null;
    }
    document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_dd").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_delete_marker").style.backgroundColor = "#f0f0f0";

    //main
    if (objOpts.tool_on !== "add_marker") {
      document.body.style.cursor = "crosshair"; 
      
      objOpts.tool_on = "add_marker";
      document.getElementById("bt_add_marker").style.backgroundColor = "#ccc";

      objOpts.mode = "add_marker";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      document.body.style.cursor = "default"; 

      objOpts.tool_on = false;
      document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
  document.getElementById("bt_change_distance").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initialise
    objOpts.hittest = null;
    objOpts.marker_from = null;
    objOpts.marker_to = null;
    objOpts.mode = null;
    if(objOpts.handleMove!==null){
      document.removeEventListener('mousemove', objOpts.handleMove);
      objOpts.handleMove = null;
    }
    if(objOpts.handleClick !== null){
      document.removeEventListener('click', objOpts.handleClick);
      objOpts.handleClick = null;
    }
    document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_dd").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_delete_marker").style.backgroundColor = "#f0f0f0";

    //main
    if (objOpts.tool_on!=="change_marker_distance") {
      document.body.style.cursor = "crosshair"; 

      objOpts.tool_on = "change_marker_distance";
      document.getElementById("bt_change_distance").style.backgroundColor = "#ccc";

      objOpts.mode = "change_marker_distance";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      document.body.style.cursor = "default"; 

      objOpts.tool_on = false;
      document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
  document.getElementById("bt_change_dd").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initialise
    objOpts.hittest = null;
    objOpts.marker_from = null;
    objOpts.marker_to = null;
    objOpts.mode = null;
    if(objOpts.handleMove!==null){
      document.removeEventListener('mousemove', objOpts.handleMove);
      objOpts.handleMove = null;
    }
    if(objOpts.handleClick !== null){
      document.removeEventListener('click', objOpts.handleClick);
      objOpts.handleClick = null;
    }
    document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_delete_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_dd").style.backgroundColor = "#f0f0f0";

    //main
    if (objOpts.tool_on!=="change_marker_dd") {
      document.body.style.cursor = "crosshair"; 

      objOpts.tool_on = "change_marker_dd";
      document.getElementById("bt_change_dd").style.backgroundColor = "#ccc";

      objOpts.mode = "change_marker_dd";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      document.body.style.cursor = "default"; 

      objOpts.tool_on = false;
      document.getElementById("bt_change_dd").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
  document.getElementById("bt_change_name").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initialise
    objOpts.hittest = null;
    objOpts.marker_from = null;
    objOpts.marker_to = null;
    objOpts.mode = null;
    if(objOpts.handleMove!==null){
      document.removeEventListener('mousemove', objOpts.handleMove);
      objOpts.handleMove = null;
    }
    if(objOpts.handleClick !== null){
      document.removeEventListener('click', objOpts.handleClick);
      objOpts.handleClick = null;
    }
    document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_delete_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_dd").style.backgroundColor = "#f0f0f0";

    //main
    if (objOpts.tool_on !== "change_marker_name") {
      document.body.style.cursor = "crosshair"; 

      objOpts.tool_on= "change_marker_name";
      document.getElementById("bt_change_name").style.backgroundColor = "#ccc";

      objOpts.mode = "change_marker_name";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      document.body.style.cursor = "default"; 

      objOpts.tool_on = false;
      document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
  document.getElementById("bt_delete_marker").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initialise
    objOpts.hittest = null;
    objOpts.marker_from = null;
    objOpts.marker_to = null;
    objOpts.mode = null;
    if(objOpts.handleMove!==null){
      document.removeEventListener('mousemove', objOpts.handleMove);
      objOpts.handleMove = null;
    }
    if(objOpts.handleClick !== null){
      document.body.style.cursor = "default"; 
      document.removeEventListener('click', objOpts.handleClick);
      objOpts.handleClick = null;
    }
    document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_delete_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_dd").style.backgroundColor = "#f0f0f0";

    //main
    if (objOpts.tool_on !== "delete_marker") {
      document.body.style.cursor = "crosshair"; 

      objOpts.tool_on = "delete_marker";
      document.getElementById("bt_delete_marker").style.backgroundColor = "#ccc";

      objOpts.mode = "delete_marker";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      document.body.style.cursor = "default"; 

      objOpts.tool_on = false;
      document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
   //2 Marker move--------------------------------------------
  function handleMarkerMouseMove(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, tempCore, zoom_rate, pad)));
    objOpts.hittest = ht;
    updateView();
  
    //context menu
    //on the section
    if(objOpts.mode == "add_marker"){
      if(ht.section !== null){
        objOpts.handleClick = handleMarkerAddClick;
        document.addEventListener('click', objOpts.handleClick);
      }else{
        document.removeEventListener('click', objOpts.handleClick);
        objOpts.handleClick = null;
      }
    }else if(objOpts.mode == "delete_marker"){
      if (ht.section !== null && Math.abs(ht.nearest_distance) < objOpts.sensibility) {
        objOpts.handleClick = handleMarkerDeleteClick;
        document.addEventListener('click', objOpts.handleClick);
      }else if(objOpts.handleClick !== null){
        document.removeEventListener('click', objOpts.handleClick);
        objOpts.handleClick = null;
      }
    }else if(["change_marker_name","change_marker_distance", "set_zero_point", "enable_master","disable_master","change_marker_dd"].includes(objOpts.mode)){
      if (ht.section !== null && Math.abs(ht.nearest_distance) < objOpts.sensibility) {
        objOpts.handleClick = handleMarkerChangeClick;
        document.addEventListener('click', objOpts.handleClick);
      }
    }else if(["add_event","delete_event"].includes(objOpts.mode)){
      if(ht.section !== null && objOpts.edit.handleClick == null){
        objOpts.edit.handleClick = handleEventAddClick;
        document.addEventListener('click', objOpts.edit.handleClick);
      }else{
        document.removeEventListener('click', objOpts.edit.handleClick);
        objOpts.edit.handleClick = null;
      }
    }
  }
  //2 Marker Change Name & Change distance--------------------------------------------
  async function handleMarkerChangeClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, tempCore, zoom_rate, pad)));
    event.preventDefault();

    if(objOpts.marker_from == null && ht.nearest_marker !== null){
      objOpts.marker_from = ht;
      objOpts.marker_to = 999999;//dummy
    }
    
    if (objOpts.marker_from !== null) {
      //if get both markers
      if(["change_marker_name","change_marker_distance","change_marker_dd"].includes(objOpts.mode)){
        let target = null;
        let response=null;
        if(objOpts.mode == "change_marker_name"){
          console.log(tempCore.projects[0].holes[0].sections[0].markers.filter(m=>m.id[3]==ht.nearest_marker)[0].name)
          if(
            tempCore.projects[0].holes[0].sections[0].markers.filter(m=>m.id[3]==ht.nearest_marker)[0].name.includes("top") ||
            tempCore.projects[0].holes[0].sections[0].markers.filter(m=>m.id[3]==ht.nearest_marker)[0].name.includes("bottom") 
          ){
            alert("Top/Bottom marker is not allowed to change name.");
            return
          }

          target = "name";
          const askData = {
            title:"Change marker name",
            label:"Please input new name",
            value:"",
            type:"text",
          };
          response = await window.LabelerApi.inputdialog(askData);
          console.log("[Labeler]: Change marker: " + target);
        }else if(objOpts.mode == "change_marker_distance"){
          target = "distance";
          const askData = {
            title:"Change marker distance",
            label:"Please input new distance(cm).",
            value:0.0,
            type:"number",
          };
          response = await window.LabelerApi.inputdialog(askData);
            
          console.log("[Labeler]: Change marker: " + target);
        }else if(objOpts.mode == "change_marker_dd"){
          target = "drilling_depth";
          const askData = {
            title:"Change marker drilling depth",
            label:"Please input new drilling depth (cm).",
            value:0.0,
            type:"number",
          };
          response = await window.LabelerApi.inputdialog(askData);
            
          console.log("[Labeler]: Change marker: " + target);
        }
         
        if (response !== null) {
          const targetId = [1, ht.hole, ht.section, ht.nearest_marker];

          await undo("save");//undo
          tempCore = await window.LabelerApi.changeMarker(targetId, target, response);
          console.log("Annotation data: \n",tempCore);

        }
      }

    }

    updateView();
  }
  //2 Marker Delete--------------------------------------------
  async function handleMarkerDeleteClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, tempCore, zoom_rate, pad)));
    event.preventDefault();

    if(objOpts.marker_from == null && ht.nearest_marker !== null){
      objOpts.marker_from = ht;
      objOpts.marker_to = 999999;//dummy
    }
    
    if (objOpts.marker_from !== null) {
      //if get both markers
      if(objOpts.mode == "delete_marker"){
        const response = await window.LabelerApi.askdialog(
          "Delete markers",
          "Do you want to DELETE the selected marker?"
        );
        if (response.response) {
          const fromId = [1, objOpts.marker_from.hole, objOpts.marker_from.section, objOpts.marker_from.nearest_marker];
          
          console.log("[Editor]: Delete marker: " + fromId);

          await undo("save");//undo
          tempCore = await window.LabelerApi.deleteMarker(fromId);

        }
      }
    }
    updateView();
  }
  //2 Marker Add--------------------------------------------
  async function handleMarkerAddClick(event) {
    const rect = document.getElementById("p5Canvas").getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const ht = JSON.parse(JSON.stringify(getClickedItemIdx(mouseX, mouseY, tempCore, zoom_rate, pad)));
    console.log("[Labeler]: Add Marker clicked at " + ht.distance +" cm.")

    //initialise
    objOpts.marker_from = ht;
    objOpts.marker_to = 999999;//dummy

    //if get both markers
    if(objOpts.mode == "add_marker"){
      const askData = {
        title:"Add new marker",
        label:"Please input name of new marker.",
        value:"",
        type:"text",
      };
      const response = await window.LabelerApi.inputdialog(askData);

      if (response !== null) {
        const upperId   = [objOpts.marker_from.project, objOpts.marker_from.hole, objOpts.marker_from.section, objOpts.marker_from.upper_marker];
        const lowerId   = [objOpts.marker_from.project, objOpts.marker_from.hole, objOpts.marker_from.section, objOpts.marker_from.lower_marker];
        const sectionId = [objOpts.marker_from.project, objOpts.marker_from.hole, objOpts.marker_from.section, null];
        console.log("[Labeler]: Add marker between " + upperId +" and "+lowerId);

        await undo("save");//undo

        tempCore = await addMarkerData(response, ht.distance, ht.relative_x);
        console.log("Annotation data: \n",tempCore);
        updateView();
      }
    }

    
    
  }
  document.getElementById("exportButton").addEventListener("click", async (event) => {
    //initialise
    objOpts.hittest = null;
    objOpts.marker_from = null;
    objOpts.marker_to = null;
    objOpts.mode = null;
    if(objOpts.handleMove!==null){
      document.removeEventListener('mousemove', objOpts.handleMove);
      objOpts.handleMove = null;
    }
    if(objOpts.handleClick !== null){
      document.removeEventListener('click', objOpts.handleClick);
      objOpts.handleClick = null;
    }
    document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
    document.getElementById("bt_delete_marker").style.backgroundColor = "#f0f0f0";

    //main
    if(tempCore){

      zoom_rate = [1.0,1.0];
      const targetCanvas = new p5(exportSketch);
      const [originalBase64, labeledBase64] = saveBuffer();

      let data = {
        hole_name: holeName,
        section_name: sectionName,
        section_data: tempCore.projects[0].holes[0].sections[0],
        image_labeled:labeledBase64,
        image_original:originalBase64,
      }
      

      const result = await window.LabelerApi.saveLabelerData(data);

      /*
      if(result == true){
        console.log("Successfully saved data.")
      }else{
        alert("Failed to save annotated data.")
      }
        */
      
    }
  });
  document.addEventListener("keydown", async (event) => {
    //dev tool
    if (event.key === "F12") {
      window.LabelerApi.toggleDevTools("labeler");
    }

    //reset zoom level
    if (event.ctrlKey && event.key === "0") {
      zoom_rate = [0.3, 0.3];
      scroller.scrollTo(0,0); 
    }

    // Ctrl + Z => Undo model
    if (event.ctrlKey && event.key === "z") {
      event.preventDefault();
      const result = await undo("undo");//undo
      if(result == true){
        tempCore = await window.LabelerApi.loadModel();
        console.log("[Labeler]: Undo model");
        console.log(tempCore);
  
        //update plot
        updateView();
      }
    }

    // Ctrl + R => Redo model
    if (event.ctrlKey && event.key === "r") {
      event.preventDefault();
      const result = await undo("redo");//undo
      if(result == true){
        tempCore = await window.LabelerApi.loadModel();
          
        console.log("[Labeler]: Redo model");
        console.log(tempCore);

        //update plot
        updateView();
      }
    }
  });
  //-------------------------------------------------------------------------------------------
  

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  function loadToolIcons() {
    let resourceData = window.LabelerApi.GetResources();
    for (let key in resourceData.labeler) {
      let path = null;
      try {
        document.getElementById(key).querySelector("img").src = resourceData.labeler[key];
      }catch{}
    }
  }
  async function loadCoreImages(modelImages, LCCore, objOpts, operations) {

    return new Promise(async (resolve, reject) => {
      try{
        //initialise
        let results = modelImages;
  
        //check
        if (LCCore == null) {
          console.log("There is no LCCore.");
          resolve(results);
          return;
        }
        
        if (operations.includes("composite_depth") || operations.includes("event_free_depth") || operations.includes("age")) {
          if(!operations.includes("drilling_depth")){
            if (Object.keys(modelImages.drilling_depth).length == 0) {
              console.log("[Renderer]: There is no original image.");
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
            LCCore.projects.forEach((p) => {
              p.holes.forEach((h) => {
                h.sections.forEach((s) => {
                  modelImages.load_target_ids.push(s.id);
                });
              });
            });
          }else{
            //case target
          }
          
          N = modelImages.load_target_ids.length;
        }else{
          N=0;
          modelImages.load_target_ids=[];
        }
        
        if(N==0){
          console.log("[Renderer]: There is no update image.")
          resolve(results);
          return;
        }
  
        //main Progress   
        await new Promise(async(p5resolve,reject) => {
          try{
            //load image
            const imageBuffers = await new Promise(async(resolve, reject)=>{
              const imBufferDict = await window.LabelerApi.LoadCoreImage({
                targetIds:modelImages.load_target_ids,
                operations:operations,
                dpcm:objOpts.dpcm,
              },"labeler");
              resolve(imBufferDict)
            }) 
            results = await assignCoreImages(results, imageBuffers, objOpts);
            results.load_target_ids = [];
            p5resolve();
          }catch(err){
            reject();
          }
          
        });
        
        resolve(results);
      }catch(err){
        reject(err);
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
  
    await new Promise((resolve, reject) => {
      new p5(async (p) => {
        try {
          let n = 0;
          if(imageBuffers==null){
            console.log("[Renderer]: Failed to assign images because there are no loaded images.");
            reject();
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
                      console.log("[Renderer]: Assign image of " + imName +" in "+depthScale);
                      suc+=1;
                      resolveImage();
                    },
                    async () => {
                      console.log("[Renderer]: Failed to assign image of " + imName +" in "+depthScale);
                      resolveImage();
                    }
                  );
                  results.image_resolution[imName] = objOpts.dpcm;
                } catch (err) {
                  console.log(err);
                  results[depthScale][imName] = undefined;
                  resolveImage();
                }
  
                n+=1;
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
  
    console.log("[Renderer]: Load " + suc + " images / " + N + " models.");
    return results;
  }  
  async function loadSectionModel(pathData, modelName) {
    return new Promise(async (resolve, reject) => {
      //initialise
      let results;
      const res = await window.LabelerApi.LoadSectionModel(pathData, modelName);//load original size
      if(res!==false){
        results = res;
      }
      
      resolve(results);
    });
  }
  function resizeScroller() {
    const toolbarHeight  = document.getElementById('toolbar').offsetHeight;
    const optionsHeight  = document.getElementById('options').offsetHeight;
    const footerHeight   = document.getElementById('footer').offsetHeight;
    const scrollerHeight = window.innerHeight - toolbarHeight - optionsHeight - footerHeight/2;
    //const scrollerWidth  = window.innerWidth;
    
    //document.getElementById('scroller').style.height = `${scrollerHeight}px`;
    //document.getElementById('scroller').style.width  = `${scrollerWidth}px`;
  }
  function makeP5CanvasBase() {
    let canvasBaseWidth  = 5000;//scroller.clientWidth 
    let canvasBaseHeight = 20000;//scroller.clientHeight;

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
  function updateView() {
    if (vectorObjects == null) {
      vectorObjects = new p5(p5Sketch);
      document.getElementById("p5Canvas").style.display = "block";
      makeP5CanvasBase();
      vectorObjects.redraw();
    }else{
      document.getElementById("p5Canvas").style.display = "block";
      makeP5CanvasBase();
      vectorObjects.clear();
      vectorObjects.redraw();
    } 
  }
  function calcRelativePos(){
    if(!tempCore){
      return null
    }
    let rx = -1;
    let ry = -1;
    if(Object.keys(modelImages.drilling_depth).length>0){
      //if image loaded
      const x0 = pad[0];
      const y0 = pad[1];
      const x1 = x0 + modelImages["drilling_depth"][holeName+"-"+sectionName].width;
      const y1 = y0 + modelImages["drilling_depth"][holeName+"-"+sectionName].height;
      const mx = mousePos[0];//position in scroller
      const my = mousePos[1];//position in scroller
      rx = (mx-x0)/(x1-x0);
      ry = (my-y0)/(y1-y0);
    }
    return [rx,ry];
  }
  async function addSectionData(holeName, sectionName){
    return new Promise(async (resolve, reject) => {
      tempCore = await window.LabelerApi.addSectionData(holeName, sectionName);

      resolve(tempCore)
    });
  }
  async function addMarkerData(name, distance, relative_x){
    return new Promise(async (resolve, reject) => {
      tempCore = await window.LabelerApi.addMarkerData(name, distance, relative_x);
      resolve(tempCore)
    });
  }
  function getClickedItemIdx(mouseX, mouseY, LCCore, zoom_rate, pad){
    let results = {
      x:null, 
      y:null, 
      relative_x:null,
      relative_y:null,
      depth_scale:"distance", 
      project:null, 
      hole:null, 
      section:null, 
      distance:null, 
      nearest_marker: null, 
      nearest_distance:null,
      upper_marker:null,
      lower_marker:null,
    };

    if(Object.keys(modelImages["drilling_depth"]).length==0){
      return results;
    }

    //mouse position (without zoom effect)
    const x = (scroller.scrollLeft + mouseX) / zoom_rate[0];
    const y = (scroller.scrollTop + mouseY) / zoom_rate[1];
    results.x = x;
    results.y = y;

    const sectionTop    = pad[1];
    const sectionBottom = (pad[1]+ modelImages["drilling_depth"][holeName+"-"+sectionName].height);
    const sectionLeft   = pad[0];
    const sectionRight  = (pad[0]+ modelImages["drilling_depth"][holeName+"-"+sectionName].width);
    const sectionTopDistance    = LCCore.projects[0].holes[0].sections[0].markers[0].distance;
    const sectionBottomDistance = LCCore.projects[0].holes[0].sections[0].markers[LCCore.projects[0].holes[0].sections[0].markers.length-1].distance;
    
    //search
    if(x >= sectionLeft && x <= sectionRight){
      results.hole    = LCCore.projects[0].holes[0].id[1];
      results.relative_x = (x-sectionLeft)/(sectionRight-sectionLeft);

      if(y >= sectionTop && y <= sectionBottom){
        results.section = LCCore.projects[0].holes[0].sections[0].id[2];
        results.relative_y = (y-sectionTop)/(sectionBottom-sectionTop);
        const distance = sectionTopDistance + (sectionBottomDistance-sectionTopDistance) * results.relative_y;
        results.distance = distance;

        let upperIdx = null;
        let lowerIdx = null;
        let lowerDistance = Infinity;
        let upperDistance = -Infinity;

        for(let m=0; m<LCCore.projects[0].holes[0].sections[0].markers.length; m++){
          const relativeDistance = (LCCore.projects[0].holes[0].sections[0].markers[m].distance-sectionTopDistance)/(sectionBottomDistance-sectionTopDistance);
          
          const marker_y0 = sectionTop + (sectionBottom-sectionTop) * relativeDistance;
          if(marker_y0 - y > 0 && Math.abs(lowerDistance) >= Math.abs(marker_y0 - y)){
            lowerDistance = marker_y0 - y;
            lowerIdx = m;
          }

          if(marker_y0 - y <= 0 && Math.abs(upperDistance) >= Math.abs(marker_y0 - y)){
            upperDistance = marker_y0 - y;
            upperIdx = m;
          }
        } 

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
        results.nearest_marker   = LCCore.projects[0].holes[0].sections[0].markers[nearestIdx].id[3];  
        results.upper_marker     = LCCore.projects[0].holes[0].sections[0].markers[upperIdx].id[3];
        results.lower_marker     = LCCore.projects[0].holes[0].sections[0].markers[lowerIdx].id[3];
        
      }
    }
    
    return results;
  }
  async function undo(type){
    return new Promise(async(resolve, reject)=>{
      let result;
      if(type == "undo"){
        result = await window.LabelerApi.sendUndo("labeler");
        console.log("[Labeler]: Recieved undo data: "+result);
      }else if(type == "redo"){
        result = await window.LabelerApi.sendRedo("labeler");
        console.log("[Labeler]: Recieved redo data: "+result);
      }else if(type == "save"){
        result = await window.LabelerApi.sendSaveState("labeler");
      }
      
       resolve(result);
    })
  }
  const p5Sketch = (sketch) => {
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
    sketch.draw = () => {
      if(Object.keys(modelImages.drilling_depth).length==0){
        let centerX = window.innerWidth / 2;
        let centerY = window.innerHeight / 2;
        sketch.push();
        sketch.fill("lightgray");
        sketch.noStroke();
        sketch.textFont("Arial");
        sketch.textSize(40);
        sketch.text("Drop section image here.",centerX - sketch.textWidth("Drop section image here.")/2, centerY)
        sketch.pop();
        return
      }
      //sketch.background("Black");
      let imgLoaded = false;
      //translate plot position
      sketch.push(); //save
      sketch.translate(-canvasPos[0], -canvasPos[1]);

      //draw grid
      const grid_step = 2;//grid/cm  

      let coreLength = 100;
      let dpcm = null;
      
      let sectionTop    = null;
      let sectionBottom = null;
      let sectionLeft   = null;
      let sectionRight  = null;
      let sectionTopDistance    = null;
      let sectionBottomDistance = null;
      
      if(tempCore !== null && modelImages["drilling_depth"][holeName+"-"+sectionName] !== undefined){
        coreLength = tempCore.projects[0].holes[0].sections[0].markers[tempCore.projects[0].holes[0].sections[0].markers.length-1].distance - tempCore.projects[0].holes[0].sections[0].markers[0].distance;
        dpcm = original_image_height / coreLength;

        sectionTop    = zoom_rate[1] * pad[1];
        sectionBottom = zoom_rate[1] * (pad[1]+ modelImages["drilling_depth"][holeName+"-"+sectionName].height);
        sectionLeft   = zoom_rate[0] * pad[0];
        sectionRight  = zoom_rate[0] * (pad[0]+ modelImages["drilling_depth"][holeName+"-"+sectionName].width);
        sectionTopDistance    = tempCore.projects[0].holes[0].sections[0].markers[0].distance;
        sectionBottomDistance = tempCore.projects[0].holes[0].sections[0].markers[tempCore.projects[0].holes[0].sections[0].markers.length-1].distance;
      }

      for(let g=0;g<coreLength*grid_step + 2;g++){
        sketch.push();
        if(g%grid_step===0){
          sketch.strokeWeight(2);
        }else{
          sketch.strokeWeight(1);
        }
        
        sketch.stroke("White");
        sketch.line(
          sectionLeft -200,
          (pad[1]-(sectionTopDistance*dpcm)+(dpcm/grid_step)*g) * zoom_rate[1],
          sectionRight + 200,
          (pad[1]-(sectionTopDistance*dpcm)+(dpcm/grid_step)*g) * zoom_rate[1],
        );
        sketch.pop();
      }
      

      //draw image
      if(Object.keys(modelImages["drilling_depth"]).length>0){
        try{          
            if(modelImages["drilling_depth"][holeName+"-"+sectionName]){
              sketch.image(
                modelImages["drilling_depth"][holeName+"-"+sectionName],
                pad[0] * zoom_rate[0],
                pad[1] * zoom_rate[1],
                modelImages["drilling_depth"][holeName+"-"+sectionName].width * zoom_rate[0],
                modelImages["drilling_depth"][holeName+"-"+sectionName].height * zoom_rate[1],
              );
            }else{
              console.log("There is no such a image: "+holeName+"-"+sectionName)
            }
        } catch (error) {
          console.error(error);
        }
      }      

      //main
      if(tempCore !== null && modelImages["drilling_depth"][holeName+"-"+sectionName] !== undefined){
        
        for(let m=0; m<tempCore.projects[0].holes[0].sections[0].markers.length; m++){
          //calc marker position
          const relativeDistance = (tempCore.projects[0].holes[0].sections[0].markers[m].distance-sectionTopDistance)/(sectionBottomDistance-sectionTopDistance);
          const marker_y = sectionTop + (sectionBottom-sectionTop) * relativeDistance;
          const relativeX = tempCore.projects[0].holes[0].sections[0].markers[m].definition_relative_x;

          //show top/bottom
          if(tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("top")){
            sketch.push();
            sketch.strokeWeight(2);
            sketch.stroke("Black");
            sketch.line(sectionLeft, sectionTop, sectionRight, sectionTop);
            
            sketch.fill("black");
            sketch.noStroke();
            sketch.textFont("Arial");
            sketch.textSize(20);
            //sketch.rotate((-90 / 180) * Math.PI);
            sketch.text(
              "Top", 
              sectionLeft + (sectionRight - sectionLeft)/2 -20, 
              sectionTop -10
            );
            sketch.pop();
          }
          if(tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("bottom")){
            sketch.push();
            sketch.strokeWeight(2);
            sketch.stroke("Black");
            sketch.line(sectionLeft, sectionBottom, sectionRight, sectionBottom);

            sketch.fill("black");
            sketch.noStroke();
            sketch.textFont("Arial");
            sketch.textSize(20);
            //sketch.rotate((-90 / 180) * Math.PI);
            sketch.text(
              "Bottom", 
              sectionLeft + (sectionRight - sectionLeft)/2 -40, 
              sectionBottom + 20
            );
            sketch.pop();
          }

          //show markers
          if(!(tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("top")&&tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("bottom"))){
            sketch.push();
            sketch.strokeWeight(2);
            sketch.stroke("Magenta");
            sketch.line(
              sectionLeft + (sectionRight-sectionLeft)*relativeX, 
              marker_y, 
              sectionRight, 
              marker_y,
            );
            sketch.pop();
          }
          
          //hittest marker
          if(objOpts.hittest && ["change_marker_distance","change_marker_name","delete_marker","change_marker_dd"].includes(objOpts.mode)){
            if(objOpts.hittest.nearest_marker == tempCore.projects[0].holes[0].sections[0].markers[m].id[3]){
              if(Math.abs(objOpts.hittest.nearest_distance) <50){
                sketch.push();
                sketch.strokeWeight(5);
                sketch.stroke("Red");
                sketch.line(
                  sectionLeft + (sectionRight-sectionLeft)*relativeX, 
                  marker_y, 
                  sectionRight, 
                  marker_y,
                );
                sketch.pop();
              }
            }
          }

          //hittest cursol
          if(objOpts.hittest && objOpts.mode == "add_marker"){
            sketch.push();
            sketch.strokeWeight(1);
            sketch.stroke("Red");
            sketch.line(
              sectionLeft + (sectionRight-sectionLeft)*relativeX, 
              sectionTop + (sectionBottom-sectionTop) * objOpts.hittest.relative_y,
              sectionRight, 
              sectionTop + (sectionBottom-sectionTop) * objOpts.hittest.relative_y,
            );
            sketch.pop();
          }
          

          //show distance
          sketch.push();
          sketch.fill("black");
          sketch.noStroke();
          sketch.textFont("Arial");
          sketch.textSize(20);
          //sketch.rotate((-90 / 180) * Math.PI);
          sketch.text(
            tempCore.projects[0].holes[0].sections[0].markers[m].distance.toFixed(1) 
              + " cm    [Drilling depth: "+tempCore.projects[0].holes[0].sections[0].markers[m].drilling_depth.toFixed(1)+" cm]", 
            sectionRight + 10, 
            marker_y,
          );
          sketch.pop();

          //show name
          sketch.push();
          sketch.fill("black");
          sketch.noStroke();
          sketch.textFont("Arial");
          sketch.textSize(20);
          //sketch.rotate((-90 / 180) * Math.PI);
          sketch.text(
            tempCore.projects[0].holes[0].sections[0].markers[m].name, 
            sectionLeft - sketch.textWidth(tempCore.projects[0].holes[0].sections[0].markers[m].name) -10, 
            marker_y,
          );
          sketch.pop();


        }
      }
      
    }    
    //draw data=============================================================================================
    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };
  }

  //---------------------------------------------------------
  let saveBuffer;
  let OutSizeType = "fix_dpcm";//cm
  const dpcm = 100;
  const density = 1;
  const exportSketch = (sketch) => {

    let outSize = [0,0];//less than 20000px
    let drawSize = [0,0];
    let mod = 1;
    let r = 1;
    if(OutSizeType == "relative"){
      const coreLength = tempCore.projects[0].holes[0].sections[0].markers[tempCore.projects[0].holes[0].sections[0].markers.length-1].distance - tempCore.projects[0].holes[0].sections[0].markers[0].distance;
      outSize[0] = parseInt(600 + pad[0] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].width * density);
      outSize[1] = parseInt(coreLength * dpcm  * density + 3000);
      if(outSize[1]>=20000){
        mod = 20000/outSize[1];//limit size
      }
    }else if(OutSizeType=="fix_outsize"){
      drawSize[0] = pad[0] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].width;
      drawSize[1] = pad[1] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].height;
      outSize[0]  = pad[0] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].width;
      outSize[1]  = pad[1] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].height;
    }else if(OutSizeType=="fix_dpcm"){
      const coreLength = tempCore.projects[0].holes[0].sections[0].markers[tempCore.projects[0].holes[0].sections[0].markers.length-1].distance - tempCore.projects[0].holes[0].sections[0].markers[0].distance;
      r = (pad[1] * 2 + 100 * 100) / (pad[1] * 2+ coreLength * 100);//load size(cm)/actural size(cm)
      console.log("Load size:"+modelImages["drilling_depth"][holeName+"-"+sectionName].width+","+modelImages["drilling_depth"][holeName+"-"+sectionName].height)
      console.log("Modified rate: "+ r+"(100/"+coreLength+")")

      drawSize[0] =  pad[0] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].width;
      drawSize[1] =  pad[1] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].height;
      outSize[0]  = (pad[0] * 2 + modelImages["drilling_depth"][holeName+"-"+sectionName].width) * (1/r);
      outSize[1]  =  pad[1] * 2 + (parseInt(coreLength * dpcm  * density));
    }
    

    sketch.setup = () => {
      let sketchCanvas = null;
      sketchCanvas = sketch.createCanvas(
        scroller.clientWidth,
        scroller.clientHeight,
        sketch.P2D
      );

      buffer = sketch.createGraphics(drawSize[0], drawSize[1], sketch.P2D);
      buffer.pixelDensity(density);
      sketch.strokeWeight(2);
      sketch.stroke("#ED225D");

      sketchCanvas.parent("p5Canvas");
      sketch.noLoop();
    };

    //draw data=============================================================================================
    sketch.draw = () => {
      buffer.background(255)
      //translate plot position
      buffer.push(); //save
      buffer.translate(0, 0);
      
      try{
        if(Object.keys(modelImages["drilling_depth"]).length>0){
          if(modelImages["drilling_depth"][holeName+"-"+sectionName]){
            buffer.image(
              modelImages["drilling_depth"][holeName+"-"+sectionName],
              pad[0] * zoom_rate[0],
              pad[1] * zoom_rate[1],
              modelImages["drilling_depth"][holeName+"-"+sectionName].width * zoom_rate[0],
              modelImages["drilling_depth"][holeName+"-"+sectionName].height * zoom_rate[1],
            );

          }else{
            console.log("There is no such a image: "+holeName+"-"+sectionName)
          }
        }        
      } catch (error) {
        console.error(error);
      }

      //main
      if(tempCore){
        const sectionTop    = zoom_rate[1] * pad[1];
        const sectionBottom = zoom_rate[1] * (pad[1]+ modelImages["drilling_depth"][holeName+"-"+sectionName].height);
        const sectionLeft   = zoom_rate[0] * pad[0];
        const sectionRight  = zoom_rate[0] * (pad[0]+ modelImages["drilling_depth"][holeName+"-"+sectionName].width);
        const sectionTopDistance    = tempCore.projects[0].holes[0].sections[0].markers[0].distance;
        const sectionBottomDistance = tempCore.projects[0].holes[0].sections[0].markers[tempCore.projects[0].holes[0].sections[0].markers.length-1].distance;
        const fontRate = 1.6 * r;

        for(let m=0; m<tempCore.projects[0].holes[0].sections[0].markers.length; m++){
          //calc marker position
          const relativeDistance = (tempCore.projects[0].holes[0].sections[0].markers[m].distance-sectionTopDistance)/(sectionBottomDistance-sectionTopDistance);
          const marker_y = sectionTop + (sectionBottom-sectionTop) * relativeDistance;
          const relativeX = tempCore.projects[0].holes[0].sections[0].markers[m].definition_relative_x;

          //show section name
          buffer.push();
          buffer.strokeWeight(2);
          buffer.stroke("Magenta");
          buffer.line(sectionLeft, sectionTop, sectionRight, sectionTop);
          
          buffer.fill("black");
          buffer.noStroke();
          buffer.textFont("Arial");
          buffer.textSize(fontRate*80);
          //sketch.rotate((-90 / 180) * Math.PI);
          const holeName = tempCore.projects[0].holes[0].name;
          const secName  = tempCore.projects[0].holes[0].sections[0].name;
          buffer.text(
            holeName+"-"+secName, 
            pad[0]*0.1,
            pad[1]*0.5,
          );
          buffer.pop();
          //show top/bottom
          if(tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("top")){
            buffer.push();
            buffer.strokeWeight(2);
            buffer.stroke("Magenta");
            buffer.line(sectionLeft, sectionTop, sectionRight, sectionTop);
            
            buffer.fill("black");
            buffer.noStroke();
            buffer.textFont("Arial");
            buffer.textSize(fontRate*60);
            //sketch.rotate((-90 / 180) * Math.PI);
            buffer.text(
              "Top", 
              sectionLeft + (sectionRight - sectionLeft)/2 -100, 
              sectionTop -70
            );
            buffer.pop();
          }


          if(tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("bottom")){
            buffer.push();
            buffer.strokeWeight(2);
            buffer.stroke("Black");
            buffer.line(sectionLeft, sectionBottom, sectionRight, sectionBottom);

            buffer.fill("black");
            buffer.noStroke();
            buffer.textFont("Arial");
            buffer.textSize(fontRate*60);
            //buffer.rotate((-90 / 180) * Math.PI);
            buffer.text(
              "Bottom", 
              sectionLeft + (sectionRight - sectionLeft)/2 -100, 
              sectionBottom + 170
            );
            buffer.pop();
          }

          //show markers
          if(!(tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("top")&&tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("bottom"))){
            buffer.push();
            buffer.strokeWeight(5);
            buffer.stroke("Magenta");
            buffer.line(
              sectionLeft + (sectionRight-sectionLeft)*relativeX, 
              marker_y, 
              sectionRight, 
              marker_y,
            );
            buffer.pop();
          }
                    

          //show distance
          buffer.push();
          buffer.fill("black");
          buffer.noStroke();
          buffer.textFont("Arial");
          buffer.textSize(fontRate*50);
          //buffer.rotate((-90 / 180) * Math.PI);
          buffer.text(
            tempCore.projects[0].holes[0].sections[0].markers[m].distance.toFixed(1) + " cm", 
            sectionRight + 40, 
            marker_y,
          );
          buffer.pop();

          //show name
          buffer.push();
          buffer.fill("black");
          buffer.noStroke();
          buffer.textFont("Arial");
          buffer.textSize(fontRate*50);
          //buffer.rotate((-90 / 180) * Math.PI);
          buffer.text(
            tempCore.projects[0].holes[0].sections[0].markers[m].name, 
            sectionLeft - buffer.textWidth(tempCore.projects[0].holes[0].sections[0].markers[m].name) -40, 
            marker_y,
          );
          buffer.pop();
        }

        //for export
        saveBuffer = () => {
          let img = buffer.createImage(drawSize[0], drawSize[1]);//output size
         
          console.log("Draw size: "+ parseInt(drawSize[0]) +","+ parseInt(drawSize[1]))
          console.log("Out size: "+ parseInt(outSize[0]) +","+ parseInt(outSize[1]))

          img.copy(
            buffer,
            0, 0, drawSize[0], drawSize[1],     // source size
            0, 0, outSize[0], outSize[1],    // actural size
          );
          img.loadPixels();

          console.log("Image data: "+img)

          const labeledBase64  = img.canvas.toDataURL("image/jpeg");
          const originalBase64 = modelImages["drilling_depth"][holeName+"-"+sectionName].canvas.toDataURL("image/jpeg");

          console.log("Converted to Base64");

          return [originalBase64, labeledBase64];
          
          /*
          sketch.resizeCanvas(outSize[0], outSize[1]); // キャンバスをリサイズ
          sketch.image(img, 0, 0);                    // トリミング後の画像を描画
          sketch.saveCanvas(holeName+"-"+sectionName, 'jpg');
          */
        };
      }
      
    }    
    //draw data=============================================================================================
    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };
    sketch.keyPressed = () => {
      if (sketch.key === 's' || sketch.key === 'S') {
        //buffer.saveCanvas("name","jpg")
      }
    };
  }
  //-------------------------------------------------------------------------------------------
});
