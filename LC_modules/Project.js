class Project {
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.holes = [];
    this.correlation_version = [];
    this.reserved_hole_ids = [0];
    this.model_data = null;
    this.order = null;
    this.enable = true;
    this.model_type = "correlation"; //"duo"
    this.duo_connection = {};
  }
}

module.exports = { Project };
