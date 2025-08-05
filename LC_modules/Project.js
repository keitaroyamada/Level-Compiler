const lcfnc = require("./lcfnc.js");

class Project {
  constructor() {
    this.id = [null, null, null, null];
    this.uuid = lcfnc.uuidv4();
    this.uuid_base = this.uuid;
    this.holes = [];
    this.correlation_version = [];
    this.reserved_hole_ids = [0];
    this.model_data = null;
    this.composite_depth_top = null;
    this.composite_depth_bottom = null;
    this.order = null;
    this.enable = true;
    this.model_type = "correlation"; //"duo"
    this.duo_connection = {};
    this.descriptions = "";
  }
}

module.exports = { Project };
