const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

// パスの初期設定
const paths = [];
const createPath = (x, y, width, height) => {
  const path = new Path2D();
  path.rect(x, y, width, height);
  paths.push({ path: path, color: "black" });
};

// パスの作成
createPath(10, 10, 100, 100);
createPath(150, 10, 100, 100);

// パスの描画
const drawPaths = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paths.forEach(({ path, color }) => {
    ctx.strokeStyle = color;
    ctx.stroke(path);
  });
};

//===============================================================================
const W = 400
const H = 300
const virtualW = 10000
const virtualH = 10000

const canvas = document.querySelector('#canvas')
canvas.width = W
canvas.height = H
const ctx = canvas.getContext('2d')

const scroller = document.querySelector('#canvas-scroller')

const offscreenCanvas = document.createElement('canvas')
offscreenCanvas.width = virtualW
offscreenCanvas.height = virtualH
const offscreenCtx = offscreenCanvas.getContext('2d')

const cellSize = 25
const xList = [...Array(Math.floor(virtualW / cellSize))]
const yList = [...Array(Math.floor(virtualH / cellSize))]

const setupMap = (ctx) => {
     xList.map((_, xIndex) => {
        yList.map((_, yIndex) => {
            offscreenCtx.fillStyle = `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`
            offscreenCtx.fillRect(xIndex * cellSize, yIndex * cellSize, cellSize, cellSize)
        })
    })
}

const drawMap = (ctx) => {
    ctx.drawImage(offscreenCanvas, 0, 0)
}

const clearCanvas = (ctx) => {
    ctx.clearRect(0, 0, virtualW, virtualH)
}

const updateMapPos = (ctx, pos) => {
    const { x, y } = pos
    clearCanvas(ctx)
    ctx.save()
    ctx.translate(-x, -y)
    drawMap(ctx)
    ctx.restore()
}

const init = () => {
    setupMap(ctx)
    drawMap(ctx)
}

init()

scroller.addEventListener('scroll', (e) => {
    e.preventDefault()
    const target = e.target
    updateMapPos(ctx,{ x: target.scrollLeft, y: target.scrollTop})
}, { passive: false})


//------------
<div class="canvas-wrapper">
  <canvas id="canvas"></canvas>
  <div id="canvas-scroller">
    <div class="inner"></div>
  </div>
</div>

//----------------
.canvas-wrapper
    position: relative
    width: 400px
    height: 300px
    
#canvas
    pointer-events: none
    
#canvas-scroller
    position: absolute
    top: 0
    left: 0
    width: 100%
    height: 100%
    overflow: auto
    
.inner
    position: absolute
    top: 0
    left: 0
    width: 10000px
    height: 10000px
    
    
