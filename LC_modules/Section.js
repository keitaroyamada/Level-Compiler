const { Marker } = require("./Marker.js");

class Section {
  //Private properties
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.markers = [];
    this.order = null;
    this.enable = true;
    this.descriptions = "";
  }

  clone(){
    const newSection  = new Section();
    const sectionData = structuredClone(this);
    Object.assign(newSection, sectionData);
    newSection.markers = this.markers.map(marker => marker.clone());
    return newSection;
  }

  load(obj) {
    const tmpl = new Section();

    //update data & add new data
    for (const k of Object.keys(tmpl)) {
      if (k === "markers") {
        if (obj && Array.isArray(obj.markers)) {
          this.markers = obj.markers.map(m => Marker.fromObject(m)); //update
        } else {
          this.markers = []; 
        }
      } else {
        if (obj && k in obj) {
          this[k] = obj[k]; //update
        } else {
          this[k] = tmpl[k]; //add
        }
      }
    }

    //delete old data
    for (const k of Object.keys(this)) {
      if (!(k in tmpl)) {
        delete this[k];
      }
    }
    return this;
  }

  static fromObject(obj) {
    return new Section().load(obj || {});
  }
}
module.exports = { Section };
