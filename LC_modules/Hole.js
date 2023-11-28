class Hole {
  //private properties
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.sections = [];
    this.type = "general"; //["general","piston"]
    this.order = null;
    this.reserved_section_ids = [0];
    this.enable = true;
  }
}

module.exports = { Hole };
