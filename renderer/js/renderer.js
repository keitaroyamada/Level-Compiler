document.addEventListener("DOMContentLoaded", () => {
  //============================================================================================
  //properties
  const scroller = document.getElementById("scroller");
  let canvasBase = document.getElementById("canvasBase");
  const positioner = document.getElementById("positioner");
  let canvas = document.getElementById("plotCanvas");
  let ctx = canvas.getContext("2d");
  let offScreenCanvas = new OffscreenCanvas(1000, 1000000);
  //document.createElement("canvas"); //make virtual canvas
  let offScreenCtx = offScreenCanvas.getContext("2d");
  const YAxisDropdown = document.getElementById("YAxisSelect");

  const dpir = window.devicePixelRatio || 1;
  ctx.scale(dpir, dpir);

  let LCCore = null;
  let selectedObject = null;
  let scrollPos = [0, 0];
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
  objOpts.canvas.zoom_level = [1 * dpir, 1 * dpir]; //[x, y](1pix/2cm)
  objOpts.canvas.dpir = dpir;
  objOpts.canvas.pad = 100;

  objOpts.hole.distance = 20;
  objOpts.hole.width = 20;
  objOpts.hole.line_colour = "lightgreen";
  objOpts.hole.line_width = 2;

  objOpts.section.line_colour = "gray";
  objOpts.section.face_colour = "lightgray";
  objOpts.section.line_width = 4;
  objOpts.section.width = 20;

  objOpts.marker.line_colour = "black";
  objOpts.marker.line_width = 2;
  objOpts.marker.width = 20;
  objOpts.marker.rank_colours = ["blue", "green", "#088F8F", "orange", "red"];

  objOpts.event.line_colour = "gray";
  objOpts.event.face_colour = "red";
  objOpts.event.line_width = 1;
  objOpts.event.width = 12;

  objOpts.connection.line_colour = "gray";
  objOpts.connection.line_width = 1;
  objOpts.connection.indexWidth = 20;

  //============================================================================================
  //hide test event
  const testButton = document.getElementById("footerLeftText");
  testButton.addEventListener("click", async () => {
    //get model path
    const model_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/0. LC test model with event.csv";
    const event_path =
      "C:/Users/slinn/Dropbox/Prj_LevelCompiler/_LC test data/2. LC test event.csv";

    console.log(
      "Actual canvas: " + scroller.clientWidth + "x" + scroller.clientHeight
    );

    //initiarise
    LCCore = await window.LCapi.Initiarise();
    //load model
    LCCore = await window.LCapi.LoadModelFromCsv(model_path);
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
  //mouse position event
  document.addEventListener("mousemove", function (event) {
    //show depth/age
    var rect = canvas.getBoundingClientRect(); // Canvas position and size
    var mouseX = event.clientX - rect.left;
    var mouseY = event.clientY - rect.top;

    let txt = "";
    let factor = 1;
    if (objOpts.canvas.depth_scale == "age") {
      factor = 2;
    }

    const xMag = objOpts.canvas.zoom_level[0] * dpir * factor;
    const yMag = objOpts.canvas.zoom_level[1] * dpir * factor;
    const pad = objOpts.canvas.pad;

    let x = (mouseX - pad + scrollPos[0]) / xMag;
    let y = (mouseY - pad + scrollPos[1]) / yMag;

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
  });
  //============================================================================================
  //scroll event
  scroller.addEventListener(
    "scroll",
    (event) => {
      //scroll event
      let factor = 1;
      if (objOpts.canvas.depth_scale == "age") {
        factor = 2;
      }
      const xMag = objOpts.canvas.zoom_level[0] * dpir * factor;
      const yMag = objOpts.canvas.zoom_level[1] * dpir * factor;
      const pad = objOpts.canvas.pad;

      //event.preventDefault();
      //const target = event.target;

      const x = scroller.scrollLeft; //* xMag;
      const y = scroller.scrollTop; //* yMag;

      //canvas.getBoundingClientRect().top = 0;
      //console.log("Scroll pos: " + canvas.getBoundingClientRect().top);//top position of canvas
      //console.log("Scroll pos: " + x + "x" + y);
      //console.log(canvas.width + "x" + canvas.height);

      makeVirtualObjects([x, y]);
      updatePlot([0, 0]);

      scrollPos = [scroller.scrollLeft, scroller.scrollTop];
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
        objOpts.canvas.zoom_level[1] -= 0.01 * deltaY;
        objOpts.canvas.zoom_level[0] -= 0.01 * deltaX;

        if (objOpts.canvas.zoom_level[0] < 0.1) {
          objOpts.canvas.zoom_level[0] = 0.1;
        }
        if (objOpts.canvas.zoom_level[1] < 0.1) {
          objOpts.canvas.zoom_level[1] = 0.1;
        }

        //calc image centre
        let x = scroller.scrollLeft;
        let y = scroller.scrollTop;

        //console.log("Alt+Scroll detected!");
        console.log("Zoom Level: " + objOpts.canvas.zoom_level[1]);
        //make new image
        makeVirtualObjects([x, y]);
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

    makeVirtualObjects([mouseX, mouseY]);
    updatePlot([0, 0]);
  });
  //============================================================================================
  //============================================================================================
  //main functions
  //============================================================================================
  //============================================================================================
  function makeVirtualObjects(drawPosition) {
    const [x, y] = drawPosition;
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

    //scale factor
    const dpir = window.devicePixelRatio || 1;
    const facterMod = 1;
    if (objOpts.canvas.depth_scale == "age") {
      facterMod / 2;
    }
    const xMag = dpir * facterMod * objOpts.canvas.zoom_level[0];
    const yMag = dpir * facterMod * objOpts.canvas.zoom_level[1];
    const pad = objOpts.canvas.pad;

    //initiarise off screan canvas
    let canvasBaseWidth = parseInt(
      (objOpts.hole.distance + objOpts.hole.width) *
        (LCCore.holes.length + 1) *
        xMag +
        2 * pad
    );
    let canvasBaseHeight = parseInt(
      (holes_bottom - holes_top) * yMag + 2 * pad
    );
    if (canvasBaseWidth < scroller.clientWidth) {
      canvasBaseWidth = scroller.clientWidth;
    }
    if (canvasBaseHeight < scroller.clientHeight) {
      canvasBaseHeight = scroller.clientHeight;
    }

    let offScreenCanvasWidth = scroller.clientWidth;
    let offScreenCanvasHeight = scroller.clientHeight;

    offScreenCanvas.width = offScreenCanvasWidth;
    offScreenCanvas.height = offScreenCanvasHeight;

    offScreenCtx = offScreenCanvas.getContext("2d");
    offScreenCtx.clearRect(0, 0, offScreenCanvasWidth, offScreenCanvasHeight);

    //change scroller size from canvas base
    canvasBase.style.width = canvasBaseWidth.toString() + "px"; //offsetWidth
    canvasBase.style.height = canvasBaseHeight.toString() + "px";

    //change view canvas size
    canvas.style.width = scroller.clientWidth.toString() + "px"; //offsetWidth
    canvas.style.height = scroller.clientHeight.toString() + "px";
    /*
    console.log(
      "Canvas Base size:" +
        canvasBase.style.width +
        "x" +
        canvasBase.style.height
    );
    console.log(
      "Offscreen canvas: " +
        offScreenCanvas.width +
        "x" +
        offScreenCanvas.height
    );
    console.log("View canvas: " + canvas.width + "x" + canvas.height);
    */
    //-----------------------------------------------------------------------
    offScreenCtx.save();
    offScreenCtx.translate(-x, -y);
    //-----------------------------------------------------------------------

    //draw grid
    const gridSize = this.fitScaler(objOpts.canvas.zoom_level[1]);
    gridCanvas(
      [gridSize, gridSize],
      [xMag, yMag],
      offScreenCtx,
      canvasBaseWidth,
      canvasBaseHeight,
      pad
    );

    //draw model
    LCCore.holes.forEach((hole, h) => {
      //calc
      let hole_top = hole.sections[0].markers[0][objOpts.canvas.depth_scale];
      let hole_bottom = hole.sections.slice(-1)[0].markers.slice(-1)[0][
        objOpts.canvas.depth_scale
      ];
      let hole_x0 =
        (objOpts.hole.distance + objOpts.hole.width) * hole.display_order * 1.5;

      // draw hole
      offScreenCtx.setLineDash([5, 5]);
      offScreenCtx.lineWidth = objOpts.hole.line_width;
      offScreenCtx.strokeStyle = objOpts.hole.line_colour;

      offScreenCtx.beginPath();
      offScreenCtx.moveTo(
        (hole_x0 + objOpts.hole.width / 2) * xMag + pad,
        hole_top * yMag + pad
      ); //start point
      offScreenCtx.lineTo(
        (hole_x0 + objOpts.hole.width / 2) * xMag + pad,
        hole_bottom * yMag + pad
      ); //end point
      offScreenCtx.stroke();

      hole.sections.forEach((section, s) => {
        //calc
        let section_top = section.markers[0][objOpts.canvas.depth_scale];
        let section_bottom =
          section.markers.slice(-1)[0][objOpts.canvas.depth_scale];
        let section_mid = (section_top + section_bottom) / 2;

        // draw sections
        offScreenCtx.setLineDash([]);
        offScreenCtx.lineWidth = objOpts.section.line_width;
        offScreenCtx.strokeStyle = objOpts.section.line_colour;
        offScreenCtx.fillStyle = objOpts.section.face_colour;

        filledRoundSection(
          offScreenCtx,
          hole_x0 * xMag + pad,
          section_top * yMag + pad,
          objOpts.section.width * xMag,
          (section_bottom - section_top) * yMag,
          10
        );
        roundSection(
          offScreenCtx,
          hole_x0 * xMag + pad,
          section_top * yMag + pad,
          objOpts.section.width * xMag,
          (section_bottom - section_top) * yMag,
          10
        );

        if (objOpts.canvas.zoom_level[1] < 0.4) {
          return;
        }
        //add section name
        rotateText(offScreenCtx, hole.name + "-" + section.name, -90, [
          hole_x0 * xMag + pad - 10,
          section_mid * yMag + pad,
        ]);

        section.markers.forEach((marker, m) => {
          //calc
          let marker_top = marker[objOpts.canvas.depth_scale];

          // draw markers
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

          //add rank marker
          offScreenCtx.arc(
            hole_x0 * xMag + pad,
            marker_top * yMag + pad,
            4,
            0,
            2 * Math.PI,
            false
          );
          offScreenCtx.fillStyle =
            objOpts.marker.rank_colours[marker.connection_rank];
          offScreenCtx.fill();

          //add connection
          const idxTo = this.getNearestConnectedMarkerIdx(LCCore, marker.id);
          if (idxTo !== null) {
            const connectedHole_x0 =
              (objOpts.hole.distance + objOpts.hole.width) *
              LCCore.holes[idxTo[1]].display_order *
              1.5;
            const connectedMarker_top =
              LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[4]][
                objOpts.canvas.depth_scale
              ];
            //get position
            const cn_x0 = (hole_x0 + objOpts.marker.width) * xMag + pad;
            const cn_y0 = marker_top * yMag + pad;
            const cn_x1 = cn_x0 + objOpts.connection.indexWidth;
            const cn_y1 = cn_y0;
            const cn_x3 = connectedHole_x0 * xMag + pad;
            const cn_y3 = connectedMarker_top * yMag + pad;
            const cn_x2 = cn_x3 - objOpts.connection.indexWidth;
            const cn_y2 = cn_y3;

            //get style
            offScreenCtx.beginPath();
            offScreenCtx.setLineDash([]);
            offScreenCtx.lineWidth = objOpts.connection.line_width;
            offScreenCtx.strokeStyle = objOpts.connection.line_colour;
            if (cn_y0 !== cn_y3) {
              offScreenCtx.setLineDash([3, 3]);
              //offScreenCtx.strokeStyle = "red";
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
        });
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
  function gridCanvas(gridSize, scale, ctx, canvasWidth, canvasHeight, pad) {
    //grid canvas
    //const gridSize = 50 * dpir;
    const gridColor = "#ccc";

    //horizontal grid
    for (let y = 0; y <= canvasHeight; y += gridSize[1] * scale[1]) {
      ctx.beginPath();
      ctx.moveTo(0 + pad, y + pad);
      ctx.lineTo(canvasWidth + pad, y + pad);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = "black";
      ctx.font = "20px Arial";
      ctx.fillText(
        (Math.round((y / scale[1] / 100) * 100) / 100).toFixed(1).toString(),
        pad - 60,
        y + pad
      );
    }

    //vertical grid
    for (let x = 0; x <= canvasWidth; x += gridSize[0] * scale[0]) {
      ctx.beginPath();
      ctx.moveTo(x + pad, 0 + pad);
      ctx.lineTo(x + pad, canvasHeight + pad);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
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
  }

  return step;
}
function getNearestConnectedMarkerIdx(LCCore, idFrom) {
  const idxFrom = this.getIdxById(LCCore, idFrom);
  const currentMarkerData =
    LCCore.holes[idxFrom[1]].sections[idxFrom[2]].markers[idxFrom[4]];
  const currentHoleData = LCCore.holes[idxFrom[1]];
  if (
    currentMarkerData.h_connection == null ||
    currentMarkerData.h_connection.length == 0
  ) {
    return null;
  }

  //get first data
  let connectedMarkerData = null;
  let connectedHoleData = null;

  let idTo = currentMarkerData.h_connection[0];
  let idxTo = this.getIdxById(LCCore, idTo);
  if (LCCore.holes[idxTo[1]].display_order > currentHoleData.display_order) {
    connectedMarkerData =
      LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[4]];
    connectedHoleData = LCCore.holes[idxTo[1]];
  }

  //if find near hole, replace
  for (let i = 1; i < currentMarkerData.h_connection.length; i++) {
    const idTo = currentMarkerData.h_connection[i];
    const idxTo = this.getIdxById(LCCore, idTo);

    if (connectedHoleData == null) {
      if (
        LCCore.holes[idxTo[1]].display_order > currentHoleData.display_order
      ) {
        connectedMarkerData =
          LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[4]];
        connectedHoleData = LCCore.holes[idxTo[1]];
      }
    } else {
      if (
        LCCore.holes[idxTo[1]].display_order - currentHoleData.display_order >
          0 &&
        LCCore.holes[idxTo[1]].display_order < connectedHoleData.display_order
      ) {
        //get only next hole
        connectedMarkerData =
          LCCore.holes[idxTo[1]].sections[idxTo[2]].markers[idxTo[4]];
        connectedHoleData = LCCore.holes[idxTo[1]];
      }
    }
  }

  if (connectedMarkerData == null) {
    return null;
  } else {
    const idxTo = this.getIdxById(LCCore, connectedMarkerData.id);
    return idxTo;
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

              if (num_id == 5) {
                if (id[3] == "marker") {
                  const num_markers = sectionData.markers.length;
                  for (let m = 0; m < num_markers; m++) {
                    const markerData = sectionData.markers[m];
                    if (markerData.id[4] == id[4]) {
                      relative_idxs.push("marker");
                      relative_idxs.push(m);
                    }
                  }
                } else if (id[3] == "event") {
                  const num_events = sectionData.events.length;
                  for (let e = 0; e < num_events; e++) {
                    const eventData = sectionData.events[m];
                    if (eventData.id[4] == id[4]) {
                      relative_idxs.push("event");
                      relative_idxs.push(e);
                    }
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
//============================================================================================
