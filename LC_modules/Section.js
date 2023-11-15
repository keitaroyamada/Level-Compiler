class Section {
  //Private properties
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.markers = [];
    this.order = null;
    this.reserved_marker_ids = [0];
  }
}
module.exports = { Section };
