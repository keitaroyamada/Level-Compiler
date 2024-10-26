const { Trinity } = require("./Trinity.js");

class Age {
  //private properties
  constructor() {
    this.id = null;
    this.name = "";
    this.age_mid = null;
    this.age_upper_1std = null;
    this.age_lower_1std = null;
    this.age_upper_2std = null;
    this.age_lower_2std = null;
    this.age_raw = null;

    this.original_depth_type = null;
    this.trinityData = new Trinity();
    this.section_id = [null, null, null, null];
    this.composite_depth = null;
    this.event_free_depth = null;

    this.source_type = "general"; //"general", "terrestrial", "marine", "tephra", "orbital", "climate"
    this.source_code = "";

    this.unit = "";
    this.note = "";

    this.order = null;
  }
}

module.exports = { Age };
