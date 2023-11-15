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
  let selectedObject = null;
  let mousePos = [0, 0];
  let canvasPos = [0, 0];
  //--------------------------------------------------------------------------------------------
  //plot properties
  let objOpts = {
    canvas: [],
    hole: [],
    section: [],
    marker: [],
    event: [],
    connection: [],
  };
  objOpts.canvas.depth_scale = "drilling_depth";
  objOpts.canvas.zoom_level = [3, 3]; //[x, y](1pix/2cm)
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
    //get model path
    const model_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/0. LC test model with event.csv";
    const event_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/2. LC test event.csv";

    const sg06_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/SG Correlation model for LC (24 Nov. 2023).csv";

    console.log(
      "Actual canvas: " + scroller.clientWidth + "x" + scroller.clientHeight
    );

    //    alert("test");

    //initiarise
    LCCore = await window.LCapi.Initiarise();
    //load model
    //LCCore = await window.LCapi.LoadModelFromCsv(model_path);
    LCCore = await window.LCapi.LoadModelFromCsv(sg06_path);
    //LCCore = await window.LCapi.LoadEventFromCsv(event_path);
    //calc composite depth
    LCCore = await window.LCapi.CalcCompositeDepth();

    //calc event free depth
    LCCore = await window.LCapi.CalcEventFreeDepth();
    //shwo model summary
    console.log(LCCore);

    //make virtual canva data
    makeVirtualObjects([0, 0]);

    //plot update
    updatePlot([0, 0]);

    /*updateObjectPosition(
      warper,
      dummyInner,
      scroller,
      ctx,
      virtualCanvas,
      [0, 0]
    );
    */
    //updateObjectPosition(ctx, [0, 0], [virtualCtx.width, virtualCtx.height]);

    console.log("Canvas size: " + canvas.height + "x" + canvas.width);
    css = getComputedStyle(canvas);
    cssWidth = parseInt(css.width, 10);
    cssHeight = parseInt(css.height, 10);

    console.log("CSS size: " + cssHeight + "x" + cssWidth);
    //LC.testMethod();
  });
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //============================================================================================
  //open finder
  document.getElementById("bt_finder").addEventListener("click", async () => {
    //await LCapi.OpenFinder("OpenFinder", async () => {});
    window.open("Finder.html", "", "width=300,height=300");
  });
  //============================================================================================
  //mouse position event
  document.addEventListener("mousemove", function (event) {
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

    let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
    let y = (scroller.scrollTop + mouseY - pad_y) / yMag - shift_y;

    //console.log(      "Mouse position: X=" +        (mouseX - pad) / xMag +        ", Y=" +        (mouseY - pad) / yMag    );
    if (objOpts.canvas.depth_scale == "age") {
      txt = "Age: " + Math.round(y) + " calBP";
    } else if (objOpts.canvas.depth_scale == "composite_depth") {
      txt = "Composite Depth: " + (Math.round(y) / 100).toFixed(2) + " m";
    } else if (objOpts.canvas.depth_scale == "drilling_depth") {
      txt = "Drilling Depth: " + (Math.round(y) / 100).toFixed(2) + " m";
    } else if (objOpts.canvas.depth_scale == "event_free_depth") {
      txt = "Event Free Depth: " + (Math.round(y) / 100).toFixed(2) + " m";
    } else if (objOpts.canvas.depth_scale == "canvas_position") {
      txt = "Canvas Position: [" + mouseX + "," + mouseY + "]";
    }
    //update
    var el = document.getElementById("footerLeftText");

    el.innerText = txt;

    mousePos = [mouseX, mouseY];
    //makeVirtualObjects();
    //updatePlot([0, 0]);
  });
  //============================================================================================
  //scroll event
  scroller.addEventListener(
    "scroll",
    (event) => {
      //scroll event
      const xMag = objOpts.canvas.zoom_level[0] * objOpts.canvas.dpir;
      const yMag = objOpts.canvas.zoom_level[1] * objOpts.canvas.dpir;
      const pad_x = objOpts.canvas.pad_x;
      const pad_y = objOpts.canvas.pad_y;
      const shift_x = objOpts.canvas.shift_x;
      const shift_y = objOpts.canvas.shift_y;

      //event.preventDefault();
      //const target = event.target;

      const x = scroller.scrollLeft; //* xMag;
      const y = scroller.scrollTop; //* yMag;

      //canvas.getBoundingClientRect().top = 0;
      //console.log("Scroll pos: " + canvas.getBoundingClientRect().top);//top position of canvas
      //console.log("Scroll pos: " + x + "x" + y);
      //console.log(canvas.width + "x" + canvas.height);

      canvasPos = [x, y];
      makeVirtualObjects();
      updatePlot([0, 0]);
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

        var deltaX = event.deltaX;
        var deltaY = event.deltaY;

        //add zoom level
        const zlx = objOpts.canvas.zoom_level[0];
        const zly = objOpts.canvas.zoom_level[1];
        objOpts.canvas.zoom_level[1] -= 0.001 * deltaY;
        objOpts.canvas.zoom_level[0] -= 0.001 * deltaX;

        if (objOpts.canvas.zoom_level[0] < 0.1) {
          objOpts.canvas.zoom_level[0] = 0.1;
        }
        if (objOpts.canvas.zoom_level[1] < 0.1) {
          objOpts.canvas.zoom_level[1] = 0.1;
        }

        //calc image centre
        var rect = canvas.getBoundingClientRect();
        var mouseX = event.clientX - rect.left;
        var mouseY = event.clientY - rect.top;
        const xMag = zlx * objOpts.canvas.dpir;
        const yMag = zly * objOpts.canvas.dpir;
        const pad_x = objOpts.canvas.pad_x;
        const pad_y = objOpts.canvas.pad_y;
        const shift_x = objOpts.canvas.shift_x;
        const shift_y = objOpts.canvas.shift_y;

        let x = 0;
        // scroller.scrollLeft + scroller.clientWidth / 2;
        //1st: let y = (scroller.scrollTop + scroller.clientHeight / 2 + shift_y) * yMag;
        let y = (scroller.scrollTop + scroller.clientHeight / 2) * yMag;

        // let x = (scroller.scrollLeft + mouseX - pad_x) / xMag - shift_x;
        // let y = (scroller.scrollTop + mouseY - pad_y) / yMag - shift_y;

        //var rect = canvas.getBoundingClientRect(); // Canvas position and size
        //const pad = objOpts.canvas.pad;
        //var mouseX = 0; //event.clientX - rect.left;
        //var mouseY = event.clientY - rect.top;

        //console.log("Alt+Scroll detected!");
        //console.log(mouseX + "--" + mouseY);
        //console.log("Zoom Level: " + objOpts.canvas.zoom_level[1]);
        //make new image

        canvasPos = [x, y];
        makeVirtualObjects();
        updatePlot([0, 0]);

        const plotCener = true;
        if (plotCener) {
          ctx.stroke();
          ctx.arc(x, y, 10, 0, 2 * Math.PI, false);
          ctx.fillStyle = "red";
          ctx.fill();
        }
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

    makeVirtualObjects();
    updatePlot([0, 0]);
  });
  //============================================================================================
  //============================================================================================
  //main functions
  //============================================================================================
  //============================================================================================
  function makeVirtualObjects() {
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
    const yMag = dpir * objOpts.canvas.zoom_level[1];
    const pad_x = objOpts.canvas.pad_x;
    const pad_y = objOpts.canvas.pad_y;
    //get shift amounts
    const shift_x = objOpts.canvas.shift_x;
    const shift_y = objOpts.canvas.shift_y;

    //get mouse position on off screen
    //=====================================================================================================
    //let mouse_x =       (scroller.scrollLeft + mousePos[0] - pad_x) / xMag - shift_x;//cm
    //let mouse_y =       (scroller.scrollTop + mousePos[1] - pad_y) / yMag - shift_y ;
    let mouse_x = scroller.scrollLeft + mousePos[0]; //pix
    let mouse_y = scroller.scrollTop + mousePos[1];
    //=====================================================================================================

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

    //move trimed area(left, top)
    offScreenCtx.save(); //save current location. after processing, restore
    offScreenCtx.translate(-x, -y);

    //draw grid
    const gridSizeX = this.fitScaler(objOpts.canvas.zoom_level[0]);
    const gridSizeY = this.fitScaler(objOpts.canvas.zoom_level[1]);
    gridCanvas(
      [gridSizeX, gridSizeY],
      [xMag, yMag],
      offScreenCtx,
      [canvasBaseWidth, canvasBaseHeight],
      [shift_x, shift_y],
      [pad_x, pad_y]
    );

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
              if (marker.composite_depth !== null) {
                offScreenCtx.fillText(
                  (Math.round(marker.event_free_depth * 10) / 10)
                    .toFixed(1)
                    .toString(),
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
                  "NO DATA",
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
  function gridCanvas(gridSize, scale, ctx, canvasSize, shift, pad) {
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
      ctx.strokeStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(
        " " +
          (
            Math.round((y / yMag / 100) * 10 ** (showOrder + 1)) /
            10 ** (showOrder + 1)
          )
            .toFixed(showOrder)
            .toString(),
        pad[0] + ytickLoc,
        y + shift[1] * yMag + pad[1]
      );
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
function fitScaler(zoom_level) {
  let step = 50;
  if (zoom_level <= 0.1) {
    step = 1000;
  } else if (zoom_level <= 0.5) {
    step = 100;
  } else if (zoom_level <= 2.0) {
    step = 50;
  } else if (zoom_level <= 5) {
    step = 10;
  } else if (zoom_level <= 10) {
    step = 5;
  } else if (zoom_level <= 15) {
    step = 1;
  }

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
//============================================================================================
