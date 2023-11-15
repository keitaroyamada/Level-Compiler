class Event {
  //Private properties
  constructor() {
    this.id = [null, null, null, "event", null];
    this.name = "";
    this.upper_distance = null;
    this.lower_distance = null;
    this.upper_composite_depth = null;
    this.lower_composite_depth = null;
    this.event_free_depth = null;
    this.age = null;
    this.age_error = null;
    this.thickness = null;
    this.type = "";
  }
}

module.exports = { Event };
