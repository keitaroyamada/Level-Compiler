const { Trinity } = require("./Trinity.js");

class PlotData {
  //private properties
  constructor() {
    this.id = null;
    this.name = "";
    this.original_depth_type = null;
    this.trinity = null; //new Trinity();
    this.drilling_depth = null;
    this.composite_depth = null;
    this.event_free_depth = null;
    this.age = null;
    this.data = null;
    this.data_type = "data";
    this.source_type = "general";
    this.source_code = null;
    this.description = null;
    this.connection_rank = null;
    this.enable = true;
    this.reliable = true;
  }
}
module.exports = { PlotData };
