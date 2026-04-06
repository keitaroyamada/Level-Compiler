document.addEventListener("DOMContentLoaded", () => {
  //-------------------------------------------------------------------------------------------
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  let zoom_rate = [0.3, 0.3];
  let mousePos = [0,0];
  let canvasPos = [0, 0]; //canvas scroller position
  let pad = [0,0];

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
    dpcm:150, // load dpcm
    disp_dpcm:100, //display dpcm
  };
  let viewerReady = true;
  window.__LC_VIEWER_E2E__ = {
    isReady() {
      return viewerReady;
    },
    getState() {
      return {
        title: document.title,
        loadedImageCount: Object.keys(modelImages.drilling_depth || {}).length,
      };
    },
  };
  //-------------------------------------------------------------------------------------------
  window.ViewerApi.receive("ImageViewerMenuClicked", async (imBuffer) => {
    document.addEventListener('contextmenu', handleNormalContextmenu);

    const res = await initialise();
    if(!res){return}

    console.log("VIEWER: Initialised models");

    //main Progress   
    await new Promise(async(p5resolve,reject) => {
      try{
        //load image
        modelImages = await assignCoreImages(modelImages, imBuffer, objOpts);
        modelImages.load_target_ids = [];
        p5resolve();
      }catch(err){
        console.log(err)
        reject();
      }
      
    });

    console.log(modelImages);

  });

  async function initialise(){
    zoom_rate = [0.3, 0.3];
    relative_pos = [0, 0];
    mousePos = [0,0];
    canvasPos = [0, 0]; //canvas scroller position
    pad = [0,0];

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
      xMag:1,
      yMag:1,
    };

    return true
  }
  
  //-------------------------------------------------------------------------------------------
  document.getElementById("scroller").addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  
  document.getElementById("scroller").addEventListener("drop", async (e) => {
    return;
    e.preventDefault();
    if(Object.keys(modelImages.drilling_depth).length!==0){
      alert("The target image is already registered. To replace it with a new image, please press the 'Initialise' button first.");
      return
    }

    //get list
    let dataList = [];
    for(const file of e.dataTransfer.files){
      const isHyphenSeparated = (text) => /^([^\s-]+-)+[^\s-]+$/.test(text);

      if (isHyphenSeparated(file.name)){
        dataList.push({type:file.name.split(".").pop(), name:file.name, path:file});
      } else {
        console.log("Image has incorrect name.");
        alert("Image has incorrect name.");
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
    const prev_zoom_rate = zoom_rate;

    if (event.ctrlKey) {
      //scroll lateral
      event.preventDefault();
      scroller.scrollBy({ left: deltaY * 1, behavior: "auto" });
    }

    if (event.altKey) {      
      //add zoom level
      if(event.ctrlKey){
        zoom_rate[0] += 0.0001 * deltaY;
      }else{
        zoom_rate[1] += 0.0001 * deltaY;
      }

      //limit of smaller
      if (zoom_rate[1] < 0.001) {
        zoom_rate[1] = 0.001;
      }
      if (zoom_rate[0] < 0.001) {
        zoom_rate[0] = 0.001;
      }

      rect = document.getElementById("p5Canvas").getBoundingClientRect();

      //positin in view
      var mouseX = event.clientX - rect.left + scroller.scrollLeft;
      var mouseY = event.clientY - rect.top + scroller.scrollTop;

      const im = Object.values(modelImages["drilling_depth"])[0];

      const relativeX = mouseX / (im.width  * prev_zoom_rate[0]);
      const relativeY = mouseY / (im.height * prev_zoom_rate[1]);

      const newX = relativeX * (im.width  * zoom_rate[0]) - event.clientX + rect.left;
      const newY = relativeY * (im.height * zoom_rate[1]) - event.clientY + rect.top;

      scroller.scrollTo(newX, newY); //move scroll position

      //update data
      canvasPos = [newX, newY];
      updateView();

      //console.log(scroller.clientHeight, zoom_rate, objOpts.disp_dpcm)
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
       
    updateView();
  });


  document.addEventListener("keydown", async (event) => {
    //dev tool
    if (event.key === "F12") {
      window.ViewerApi.toggleDevTools("viewer");
    }

    //reset zoom level
    if (event.ctrlKey && event.key === "0") {
      zoom_rate = [0.3, 0.05];
      scroller.scrollTo(0,0); 
    }

  });
  //-------------------------------------------------------------------------------------------
  async function handleNormalContextmenu(event) {
    event.preventDefault();
    let clickResult  = await window.ViewerApi.showContextMenu({ type: "imageViewerContextMenu" });
  }
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    let rx = -1;
    let ry = -1;
    if(Object.keys(modelImages.drilling_depth).length>0){
      //if image loaded
      const x0 = pad[0];
      const y0 = pad[1];
      const x1 = x0 + Object.values(modelImages["drilling_depth"])[0].width;
      const y1 = y0 + Object.values(modelImages["drilling_depth"])[0].height;
      const mx = mousePos[0];//position in scroller
      const my = mousePos[1];//position in scroller
      rx = (mx-x0)/(x1-x0);
      ry = (my-y0)/(y1-y0);
    }
    return [rx,ry];
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

      //translate plot position
      sketch.push(); //save
      sketch.translate(-canvasPos[0], -canvasPos[1]);
      

      //draw grid
      const grid_step = 2;//grid/cm  

      let coreLength = 100;
      let dpcm = null;
      
      //draw image
      if(Object.keys(modelImages["drilling_depth"]).length>0){
        try{          
            const im = Object.values(modelImages["drilling_depth"])[0];
            if(im){              
              sketch.image(
                im,
                pad[0] * zoom_rate[0],
                pad[1] * zoom_rate[1],
                im.width  * zoom_rate[0],
                im.height * zoom_rate[1],
              );
            }else{
              console.log("There is no such a image.")
            }
        } catch (error) {
          console.error(error);
        }
      }      


      
    }    
    //draw data=============================================================================================
    sketch.windowResized = () => {
      sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
    };
  }

  //-------------------------------------------------------------------------------------------
});
