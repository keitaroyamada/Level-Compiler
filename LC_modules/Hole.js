const { Section } = require("./Section.js");

class Hole {
  //private properties
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.sections = [];
    this.type = "general"; //["general","piston"]
    this.order = null;
    this.enable = true;
    this.descriptions = "";
  }

  clone(){
    const newHole  = new Hole();
    const holeData = structuredClone(this);
    Object.assign(newHole, holeData);
    newHole.sections = this.sections.map(section=>section.clone());
    return newHole;
  }

  load(obj) {
    const tmpl = new Hole();

    //add data & update data
    for (const k of Object.keys(tmpl)) {
      if (k === "sections") {
        if (obj && Array.isArray(obj.sections)) {
          this.sections = obj.sections.map(s => Section.fromObject(s)); //update
        } else {
          this.sections = [];
        }
      } else {
        if (obj && k in obj) {
          this[k] = obj[k]; //update
        } else {
          this[k] = tmpl[k]; //add
        }
      }
    }

    //delete
    for (const k of Object.keys(this)) {
      if (!(k in tmpl)) {
        delete this[k];
      }
    }
    return this;
  }

  static fromObject(obj) {
    return new Hole().load(obj || {});
  }
}

module.exports = { Hole };
