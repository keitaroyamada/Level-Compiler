function updateObjectPosition(
  warper,
  dummyInner,
  scroller,
  ctx,
  virtualCanvas,
  drawPosition
) {
  //this fun make the same size canvas as virtual canvas and draw area only real window
  const [x, y] = drawPosition;
  //initiarise
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.width = warper.clientWidth; // real show size
  canvas.height = warper.clientWidth;

  dummyInner.offsetWidth = virtualCanvas.width; //scroll event size
  dummyInner.offsetHeight = virtualCanvas.height;

  scroller.scrollWidth = virtualCanvas.width; //virtual canvas size
  scroller.scrollHeight = virtualCanvas.height;
  scroller.offsetWidth = virtualCanvas.width; //virtual canvas size
  scroller.offsetHeight = virtualCanvas.height;

  console.log(
    "Virtual: [" + virtualCanvas.height + "x" + virtualCanvas.width + "]"
  );
  console.log(
    "Scroll: [" + scroller.scrollHeight + "x" + scroller.scrollWidth + "]"
  );
  console.log("View: [" + canvas.height + "x" + canvas.width + "]");

  //transrage zero point
  ctx.save();
  ctx.translate(-x, -y);
  ctx.drawImage(virtualCanvas, 0, 0);
  ctx.restore();
}

function newHole(obj) {
  const newObject = {
    id: null,
    name: null,
    order: null,
    x0_position: null,
    y0_position: null,
    width: null,
    height: null,
    type: null,
    sections: [],
  };
  return newObject;
}
function newSection(obj) {
  const newObject = {
    id: null,
    name: null,
    order: null,
    x0_position: null,
    y0_position: null,
    width: null,
    height: null,
    image: null,
    markers: [],
    events: [],
  };
  return newObject;
}
function newMarker(obj) {
  const newObject = {
    id: null,
    name: null,
    order: null,
    x0_position: null,
    y0_position: null,
    width: null,
    height: null,
    type: null,
    isMaster: false,
    isZeroPoint: false,
    h_connection: [],
    v_connection: [],
  };
  return newObject;
}
function newEvent(obj) {
  const newObject = {
    id: null,
    name: null,
    order: null,
    x0_position: null,
    y0_position: null,
    width: null,
    height: null,
    type: null,
  };
  return newObject;
}
