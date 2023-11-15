const W = 400;
const H = 300;
const virtualW = 10000;
const virtualH = 10000;

const canvas = document.querySelector("#canvas");
canvas.width = W;
canvas.height = H;
const ctx = canvas.getContext("2d");

const scroller = document.querySelector("#canvas-scroller");

const offscreenCanvas = document.createElement("canvas");
offscreenCanvas.width = virtualW;
offscreenCanvas.height = virtualH;
const offscreenCtx = offscreenCanvas.getContext("2d");

const cellSize = 25;
const xList = [...Array(Math.floor(virtualW / cellSize))];
const yList = [...Array(Math.floor(virtualH / cellSize))];

const setupMap = (ctx) => {
  xList.map((_, xIndex) => {
    yList.map((_, yIndex) => {
      offscreenCtx.fillStyle = `rgb(${Math.random() * 255}, ${
        Math.random() * 255
      }, ${Math.random() * 255})`;
      offscreenCtx.fillRect(
        xIndex * cellSize,
        yIndex * cellSize,
        cellSize,
        cellSize
      );
    });
  });
};

const drawMap = (ctx) => {
  ctx.drawImage(offscreenCanvas, 0, 0);
};

const clearCanvas = (ctx) => {
  ctx.clearRect(0, 0, virtualW, virtualH);
};

const updateMapPos = (ctx, pos) => {
  const { x, y } = pos;
  clearCanvas(ctx);
  ctx.save();
  ctx.translate(-x, -y);
  drawMap(ctx);
  ctx.restore();
};

const init = () => {
  setupMap(ctx);
  drawMap(ctx);
};

init();

scroller.addEventListener(
  "scroll",
  (e) => {
    e.preventDefault();
    const target = e.target;
    updateMapPos(ctx, { x: target.scrollLeft, y: target.scrollTop });
  },
  { passive: false }
);
