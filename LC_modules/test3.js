let v = new Set();
v.add([1, 1, 1, null].join("-"));
v.add([1, 1, 2].join("-"));
v.forEach((s) => {
  console.log(parseFloat(s.split("-")[3]));
  console.log();
});
