const { Trinity } = require("./Trinity.js");

class PlotDataset {
  //private properties
  constructor() {
    this.id = null;
    this.name = "";
    this.original_depth_type = null;
    this.trinity = new Trinity();
    this.drilling_depth = null;
    this.composite_depth = null;
    this.event_free_depth = null;
    this.data = [[]];
  }
}
module.exports = { PlotDataset };
