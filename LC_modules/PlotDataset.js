const { Trinity } = require("./Trinity.js");

class PlotDataset {
  //private properties
  constructor() {
    this.id = null;
    this.name = "";
    this.data_series = [];
    this.data_max = null;
    this.data_min = null;
    this.unit = "";
    this.plot_type = "scatter";
  }
}
module.exports = { PlotDataset };
