document.addEventListener("DOMContentLoaded", () => {
  //-------------------------------------------------------------------------------------------
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  let original_image_height = 20000;
  let zoom_rate = [0.3, 0.3];
  let relative_pos = [0, 0];
  let mousePos = [0,0];
  let canvasPos = [0, 0]; //canvas scroller position
  let pad = [500,200];
  let tempCore = null;
  //initiarise
  let vectorObjects = null; //p5 instance data
  let isSVG = false;
  let isDev = true;
  let holeName = "";
  let sectionName = "";
  let rect = null;
  loadToolIcons();
  resizeScroller();
  document.body.style.cursor = "crosshair"; 
  let modelImages = {
    image_dir: [],
    load_target_ids: [],
    drilling_depth: {},
    composite_depth: {},
    event_free_depth: {},
    age:{},
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
  };
  //-------------------------------------------------------------------------------------------
  document.getElementById("scroller").addEventListener("dragover", (e) => {
    e.preventDefault(e);
  });
  
  document.getElementById("scroller").addEventListener("drop", async (e) => {
    e.preventDefault(e);
    if(tempCore !== null){
      tempCore = await window.LabelerApi.InitiariseTempCore();
    }


    //get list
    let dataList = [];
    for(const file of e.dataTransfer.files){
      const fileParseData = await window.LabelerApi.getFilePath(file);
      dataList.push(fileParseData);
    }

    //check
    let order = [];

    //check image
    dataList.forEach((data,i)=>{
      if(data.ext == ".jpg"){
        order.push(i);
      }
    })

    if(order.length > 0){
      //load first image
      modelImages = await loadCoreImage(modelImages, dataList[0])
      console.log(modelImages)
      if(Object.keys(modelImages.drilling_depth).length>0){
        console.log("[Labeler]: Section image loaded: "+holeName+"-"+sectionName);
      }
    }

    //add marker
    tempCore = await addSectionData(holeName, sectionName);
    console.log(tempCore)

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
      const relative_scroll_pos_x = scroller.scrollLeft / scroller.scrollWidth;
      const relative_scroll_pos_y = scroller.scrollTop / scroller.scrollHeight;

      //calc new canvas size
      //makeRasterObjects(false); //make only base canvas
      makeP5CanvasBase();
      const canvasBase_height = parseInt(canvasBase.style.height.match(/\d+/)[0], 10);
      const canvasBase_width  = parseInt(canvasBase.style.width.match(/\d+/)[0], 10);

      //get new scroll pos
      const new_scroll_pos_x = canvasBase_width * relative_scroll_pos_x;
      const new_scroll_pos_y = canvasBase_height * relative_scroll_pos_y;

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
      if(isDev){
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
    //initiarise
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
    console.log(objOpts.tool_on)
    //main
    if (objOpts.tool_on !== "add_marker") {
      
      objOpts.tool_on = "add_marker";
      document.getElementById("bt_add_marker").style.backgroundColor = "#ccc";

      objOpts.mode = "add_marker";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      objOpts.tool_on = false;
      document.getElementById("bt_add_marker").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
  document.getElementById("bt_change_distance").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initiarise
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
    if (objOpts.tool_on!=="change_marker_distance") {
      objOpts.tool_on = "change_marker_distance";
      document.getElementById("bt_change_distance").style.backgroundColor = "#ccc";

      objOpts.mode = "change_marker_distance";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      objOpts.tool_on = false;
      document.getElementById("bt_change_distance").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
  document.getElementById("bt_change_name").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initiarise
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
    if (objOpts.tool_on !== "change_marker_name") {
      objOpts.tool_on= "change_marker_name";
      document.getElementById("bt_change_name").style.backgroundColor = "#ccc";

      objOpts.mode = "change_marker_name";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
      objOpts.tool_on = false;
      document.getElementById("bt_change_name").style.backgroundColor = "#f0f0f0";
      
    }
    updateView();
  });
  document.getElementById("bt_delete_marker").addEventListener("click", async (event) => {
    if(!tempCore){
      return
    }
    //initiarise
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
    if (objOpts.tool_on !== "delete_marker") {
      objOpts.tool_on = "delete_marker";
      document.getElementById("bt_delete_marker").style.backgroundColor = "#ccc";

      objOpts.mode = "delete_marker";
      objOpts.handleMove = handleMarkerMouseMove;
      document.addEventListener("mousemove", objOpts.handleMove);
    } else {
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
    if(ht.section !== null){
      //on the section
      if(objOpts.mode == "add_marker"){
        if(objOpts.handleClick == null || objOpts.handleClick !== handleMarkerAddClick){
          objOpts.handleClick = handleMarkerAddClick;
          document.addEventListener('click', objOpts.handleClick);
        }else{
          document.removeEventListener('click', objOpts.handleClick);
          objOpts.handleClick = null;
        }
      }else if(objOpts.mode == "delete_marker"){
        if (Math.abs(ht.nearest_distance) < objOpts.sensibility) {
          objOpts.handleClick = handleMarkerDeleteClick;
          document.addEventListener('click', objOpts.handleClick);
        }else if(objOpts.handleClick !== null){
          document.removeEventListener('click', objOpts.handleClick);
          objOpts.handleClick = null;
        }
      }else if(["change_marker_name","change_marker_distance", "set_zero_point", "enable_master","disable_master"].includes(objOpts.mode)){
        if (Math.abs(ht.nearest_distance) < objOpts.sensibility) {
          objOpts.handleClick = handleMarkerChangeClick;
          document.addEventListener('click', objOpts.handleClick);
        }
      }else if(["add_event","delete_event"].includes(objOpts.mode)){
        if(objOpts.edit.handleClick == null){
          objOpts.edit.handleClick = handleEventAddClick;
          document.addEventListener('click', objOpts.edit.handleClick);
        }else{
          document.removeEventListener('click', objOpts.edit.handleClick);
          objOpts.edit.handleClick = null;
        }
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
      if(["change_marker_name","change_marker_distance"].includes(objOpts.mode)){
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
        }
         
        if (response !== null) {
          const targetId = [1, ht.hole, ht.section, ht.nearest_marker];

          //await undo("save");//undo
          tempCore = await window.LabelerApi.changeMarker(targetId, target, response);
          console.log(tempCore)

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

          //await undo("save");//undo
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

    //initiarise
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

        console.log(ht)
        //await undo("save");//undo

        tempCore = await addMarkerData(response, ht.distance, ht.relative_x);
        console.log(tempCore);
        updateView();
      }
    }

    
    
  }
  document.getElementById("exportButton").addEventListener("click", async (event) => {
    if(tempCore){
      const sectionData = tempCore.projects[0].holes[0].sections[0];
      const sectionHeight = sectionData.markers[sectionData.markers.length-1].distance - sectionData.markers[0];
      const dpcm = 50;
      const canvasWidth = 2000;
      const canvasHeight= parseInt(dpcm * sectionHeight);
    
      const targetCanvas = new p5(exportSketch);

      saveBuffer();


      
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "F12") {
      window.LabelerApi.toggleDevTools("labeler");
    }
    if (e.code === "Space") {
      zoom_rate = [0.3, 0.3];
      scroller.scrollTo(0,0); 
    }
  });
//-------------------------------------------------------------------------------------------
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  function loadToolIcons() {
    let resourcePaths = window.LabelerApi.getResourcePath();
    for (let key in resourcePaths.labeler) {
      let path = null;
      try {
        path =  resourcePaths.labeler[key];
        document.getElementById(key).querySelector("img").src = path;
      }catch{}
    }
  }
  async function loadCoreImage(modelImages, pathData) {
    return new Promise(async (resolve, reject) => {
      //initiarise
      let results = modelImages;

      await new Promise((p5resolve) => {
        new p5(async (p) => {
          const tasks = []; 
          const N = 1;
          for (let t = 0; t < N; t++) {
      
            const im_name = pathData.name;
            const im_path = pathData.fullpath;

            //check name
            const split_name = im_name.split("-");
            if(split_name.length !==2){
              alert("Incorrectly named image dropped. Please rename it as 'Hole Name'- 'Section Name' first.");
              return 
            }
            holeName = split_name[0];
            sectionName = split_name[1];
      
            const task = (async () => {
              try {
                let imageBase64;
                imageBase64 = await window.LabelerApi.LoadRasterImage(im_path, original_image_height);//load original size
      
                if (imageBase64 !== undefined) {
                  results["drilling_depth"][im_name] = await p.loadImage(
                    "data:image/png;base64," + imageBase64,
                    async () => {
                    },
                    async () => {
                      console.log("[Labeler]: Fail to load image of " + im_name);
                    }
                  );
                } else {
                  results["drilling_depth"][im_name] = undefined;
                }
              } catch (error) {
                console.error(error);
                results["drilling_depth"][im_name] = undefined;
              }
            })();
      
            tasks.push(task);
          }
      
          await Promise.all(tasks); 
          p5resolve();
        });
      });

      resolve(results);
    });
  }
  function resizeScroller() {
    const toolbarHeight = document.getElementById('toolbar').offsetHeight;
    const optionsHeight = document.getElementById('options').offsetHeight;
    const footerHeight = document.getElementById('footer').offsetHeight;
    const scrollerHeight = window.innerHeight - toolbarHeight - optionsHeight - footerHeight/2;
    document.getElementById('scroller').style.height = `${scrollerHeight}px`;
  }
  function makeP5CanvasBase() {
    let canvasBaseWidth  = 5000;//scroller.clientWidth 
    let canvasBaseHeight = 10000;//scroller.clientHeight;

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
    }

    resizeScroller();
    document.getElementById("p5Canvas").style.display = "block";

    makeP5CanvasBase();
    //vectorObjects.clear();
    vectorObjects.clear();
    vectorObjects.redraw();

 
  }
  function calcRelativePos(){
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
      //sketch.background("Black");
      let imgLoaded = false;
      //translate plot position
      sketch.push(); //save
      sketch.translate(-canvasPos[0], -canvasPos[1]);
      try{
        if(Object.keys(modelImages["drilling_depth"]).length>0){
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
          if(objOpts.hittest && ["change_marker_distance","change_marker_name","delete_marker"].includes(objOpts.mode)){
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
          sketch.textSize(18);
          //sketch.rotate((-90 / 180) * Math.PI);
          sketch.text(
            tempCore.projects[0].holes[0].sections[0].markers[m].distance.toFixed(1) + " cm", 
            sectionRight + 10, 
            marker_y,
          );
          sketch.pop();

          //show name
          sketch.push();
          sketch.fill("black");
          sketch.noStroke();
          sketch.textFont("Arial");
          sketch.textSize(18);
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
      resizeScroller();
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };
    sketch.keyPressed = () => {
      if (sketch.key === 's' || sketch.key === 'S') {
        sketch.saveCanvas("name","jpg")
      }
  };
  }
  let saveBuffer;
  const exportSketch = (sketch) => {
    sketch.setup = () => {
      let sketchCanvas = null;
      sketchCanvas = sketch.createCanvas(
        scroller.clientWidth,
        scroller.clientHeight,
        sketch.P2D
      );

      buffer = sketch.createGraphics(5000,10000,sketch.P2D);
      buffer.pixelDensity(2);
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
      buffer.translate(-canvasPos[0], -canvasPos[1]);
      
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
        for(let m=0; m<tempCore.projects[0].holes[0].sections[0].markers.length; m++){
          //calc marker position
          const relativeDistance = (tempCore.projects[0].holes[0].sections[0].markers[m].distance-sectionTopDistance)/(sectionBottomDistance-sectionTopDistance);
          const marker_y = sectionTop + (sectionBottom-sectionTop) * relativeDistance;
          const relativeX = tempCore.projects[0].holes[0].sections[0].markers[m].definition_relative_x;

          //show top/bottom
          if(tempCore.projects[0].holes[0].sections[0].markers[m].name.includes("top")){
            buffer.push();
            buffer.strokeWeight(2);
            buffer.stroke("Black");
            buffer.line(sectionLeft, sectionTop, sectionRight, sectionTop);
            
            buffer.fill("black");
            buffer.noStroke();
            buffer.textFont("Arial");
            buffer.textSize(20);
            //sketch.rotate((-90 / 180) * Math.PI);
            buffer.text(
              "Top", 
              sectionLeft + (sectionRight - sectionLeft)/2 -20, 
              sectionTop -10
            );
            buffer.pop();
          }



          saveBuffer = () => {
            let img = buffer.createImage(2000, 10000);

            img.copy(
              buffer,
              0, 0, 1000, 2000,     // ソースの矩形（論理ピクセル）
              0, 0, 2000, 10000    // デスティネーションの矩形（実際のピクセル）
            );

            img.save('croppedBuffer.png');
            // /buffer.save('bufferImage.png');
          };



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
          if(objOpts.hittest && ["change_marker_distance","change_marker_name","delete_marker"].includes(objOpts.mode)){
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
          sketch.textSize(18);
          //sketch.rotate((-90 / 180) * Math.PI);
          sketch.text(
            tempCore.projects[0].holes[0].sections[0].markers[m].distance.toFixed(1) + " cm", 
            sectionRight + 10, 
            marker_y,
          );
          sketch.pop();

          //show name
          sketch.push();
          sketch.fill("black");
          sketch.noStroke();
          sketch.textFont("Arial");
          sketch.textSize(18);
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
      resizeScroller();
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
