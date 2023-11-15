class Project {
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.holes = [];
    this.correlation_version = [];
    this.reserved_hole_ids = [0];
  }
}

module.exports = { Project };
