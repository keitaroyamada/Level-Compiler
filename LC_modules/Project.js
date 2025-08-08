const { Hole } = require("./Hole.js");

class Project {
  constructor() {
    this.id = [null, null, null, null];
    this.name = "";
    this.holes = [];
    this.model_type = "correlation"; //"duo"    
    this.descriptions = "";

    this.correlation_version = [];
    this.composite_depth_top = null;
    this.composite_depth_bottom = null;
    this.order = null;
    this.enable = true;
    this._model_data = null;
    this._duo_connection = {};//temp connections for csv model
  }

  clone(){
    const newProject  = new Project();
    const projectData = structuredClone(this);
    Object.assign(newProject, projectData);
    newProject.holes = this.holes.map(hole=>hole.clone());
    return newProject;
  }

  load(obj) {
    const tmpl = new Project();

    //add data & update data
    for (const k of Object.keys(tmpl)) {
      if (k === "holes") {
        if (obj && Array.isArray(obj.holes)) {
          this.holes = obj.holes.map(h => Hole.fromObject(h)); //update
        } else {
          this.holes = [];
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
    return new Project().load(obj || {});
  }
}

module.exports = { Project };
