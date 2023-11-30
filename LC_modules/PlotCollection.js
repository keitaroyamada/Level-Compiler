const { Trinity } = require("./Trinity.js");

class PlotCollection {
  //private properties
  constructor() {
    this.id = null;
    this.name = null;
    this.datasets = []; //list of PlotDatum
    this.descriptions = null;
  }
}

module.exports = { PlotCollection };
