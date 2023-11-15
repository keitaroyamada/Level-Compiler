document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("myCanvas");
  const ctx = canvas.getContext("2d");
  const addObjectButton = document.getElementById("addObjectButton");
  let objects = [];
  let selectedObject = null;
  let offsetX, offsetY;

  function drawObjects() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // キャンバスをクリア
    objects.forEach((obj) => {
      // 四角形を描画
      ctx.beginPath();
      ctx.rect(obj.x, obj.y, obj.width, obj.height);
      ctx.stroke();
      // 円を描画
      obj.circles.forEach((circle) => {
        ctx.beginPath();
        ctx.arc(circle.x, circle.y, circle.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function addObject() {
    const numOfCircles = Math.floor(Math.random() * 4) + 1; // 1~4のランダムな数
    const newObject = {
      x: Math.random() * (canvas.width - 100),
      y: Math.random() * (canvas.height - 100),
      width: 100,
      height: 100,
      circles: [],
    };
    // 四角形の中に円を追加
    for (let i = 0; i < numOfCircles; i++) {
      newObject.circles.push({
        x: newObject.x + (newObject.width / (numOfCircles + 1)) * (i + 1),
        y: newObject.y + newObject.height / 2,
        radius: 10,
      });
    }
    objects.push(newObject);
    drawObjects();
  }

  canvas.addEventListener("mousedown", function (e) {
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    // クリックされたオブジェクトを特定
    objects.forEach((obj) => {
      if (
        mouseX > obj.x &&
        mouseX < obj.x + obj.width &&
        mouseY > obj.y &&
        mouseY < obj.y + obj.height
      ) {
        selectedObject = obj;
        offsetX = mouseX - obj.x;
        offsetY = mouseY - obj.y;
        canvas.addEventListener("mousemove", onMouseMove);
      }
    });
  });

  function onMouseMove(e) {
    if (selectedObject) {
      selectedObject.x = e.offsetX - offsetX;
      selectedObject.y = e.offsetY - offsetY;
      // 円の位置も更新
      selectedObject.circles.forEach((circle) => {
        circle.x =
          selectedObject.x +
          (selectedObject.width / (selectedObject.circles.length + 1)) *
            (selectedObject.circles.indexOf(circle) + 1);
        circle.y = selectedObject.y + selectedObject.height / 2;
      });
      drawObjects();
    }
  }

  canvas.addEventListener("mouseup", function (e) {
    canvas.removeEventListener("mousemove", onMouseMove);
    selectedObject = null;
  });

  addObjectButton.addEventListener("click", addObject);

  drawObjects();
});
