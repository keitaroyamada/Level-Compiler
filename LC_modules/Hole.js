class Hole {
  //private properties
  constructor() {
    this.id = [null, null];
    this.name = "";
    this.sections = [];
    this.type = "general"; //["general","piston"]
    this.reserved_section_ids = [null];
    this.display_order = null;
  }
}

module.exports = { Hole };
