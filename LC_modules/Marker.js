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
    this.connection_rank = null; //Level of inter/extrapolation
    this.unreliability = null;  //Level of Reliability of Composite Depth when comparing to EFD
    this.isMaster = false;
    this.isZeroPoint = false; //if NOT zerpoint,"false", if START point, "value"(e.g. 8.4)
    this.order = null;
    this.enable = true;
    this.depth_source = ["", null, null];
    this.definition_relative_x = 0; //[0~1]: definitoin position on the photo
  }
}

module.exports = { Marker };
