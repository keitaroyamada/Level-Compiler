var ss = require("simple-statistics");
const lcfnc = require("./lcfnc.js");

const A = [0, 1000, 100];
const B = [100, 2000, 100];
const C = 30;

function s(upperHorizon, lowerHorizon, targetHorizon, n) {
  //make normal distribution random values
  const upperRand = lcfnc.randNormal(upperHorizon[1], upperHorizon[2], n);
  const lowerRand = lcfnc.randNormal(lowerHorizon[1], lowerHorizon[2], n);

  let C = [];
  for (let i = 0; i < n; i++) {
    //interpolate linear
    const a =
      (lowerRand[i] - upperRand[i]) / (lowerHorizon[0] - upperHorizon[0]);
    const b = upperRand[i];

    if (a >= 0) {
      const c = targetHorizon * a + b;
      C.push(c);
    }
  }

  //calc statics
  console.log(ss.mean(C) + "±" + ss.standardDeviation(C));
}

s(A, B, 100, 100000);
