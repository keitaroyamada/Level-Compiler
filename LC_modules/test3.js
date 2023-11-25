const interp = ([d1, d3], [D1, D3], d2) => {
  const D2 = D1 + ((d2 - d1) / (d3 - d1)) * (D3 - D1);
  return D2;
};

console.log(interp([0, 1], [0, 0.1], 0.5));
