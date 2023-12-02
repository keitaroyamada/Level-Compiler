const { Trinity } = require("./Trinity.js");

class PlotDataset {
  //private properties
  constructor() {
    this.id = null;
    this.name = "";
    this.data_series = [];
    this.plot_type = "scatter";
  }
}
module.exports = { PlotDataset };
