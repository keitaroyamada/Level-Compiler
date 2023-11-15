class Marker {
  //private properties
  constructor() {
    this.id = [null, null, null, "marker", null];
    this.name = "";
    this.distance = null;
    this.composite_depth = null;
    this.event_free_depth = null;
    this.drilling_depth = null;
    this.event_data = null;
    this.age = null;
    this.age_error = null;
    this.h_connection = [];
    this.v_connection = [];
    this.connection_rank = null;
    this.isMaster = false;
    this.isZeroPoint = false;
    this.reliability = 1; //use calculation for CD and EFD. Core with smaller value is used preferenticall.
  }
}

module.exports = { Marker };
