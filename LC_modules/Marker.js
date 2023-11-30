class Marker {
  //private properties
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.distance = null;
    this.composite_depth = null;
    this.event_free_depth = null;
    this.drilling_depth = null;
    this.event = [];
    this.age = null;
    this.h_connection = [];
    this.v_connection = [];
    this.connection_rank = null;
    this.isMaster = false;
    this.isZeroPoint = false; //if NOT zerpoint,"false", if START point, "value"(e.g. 8.4)
    this.reliability = 1; //use calculation for CD and EFD. Core with smaller value is used preferenticall.
    this.order = null;
    this.enable = true;
  }
}

module.exports = { Marker };
