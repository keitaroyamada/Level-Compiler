const lcfnc = require("./lcfnc.js");

class Marker {
  //private properties
  #id;
  #name;
  #distance;
  #composite_depth;
  #event_free_depth;
  #drilling_depth;
  #age;
  #age_error;
  #correlation;
  #isMaster;
  #isZeroPoint;
  constructor() {
    this.#id = [null, null, null, null];
    this.#name = "";
    this.#distance = null;
    this.#composite_depth = null;
    this.#event_free_depth = null;
    this.#drilling_depth = null;
    this.#age = null;
    this.#age_error = null;
    this.#correlation = [];
    this.#isMaster = false;
    this.#isZeroPoint = false;
    this.posX = 0;
    this.posY = 0;
    this.listeners = [];
  }
  //methods
  addParentId(parentId) {
    if (this.#id[0] == null) {
      if (this.#id[1] == null) {
        if (this.#id[2] == null) {
          this.#id[0] = parentId[0];
          this.#id[1] = parentId[1];
          this.#id[2] = parentId[2];
        } else {
          console.log("ERROR: [Marker] Parent ID(core)) is already set.");
          return;
        }
      } else {
        console.log("ERROR: [Marker] Parent ID(hole)) is already set.");
        return;
      }
    } else {
      console.log("ERROR: [Marker] Parent ID(project) is already set.");
      return;
    }
  }
  initiariseUniqueID(newID) {
    //this method is basically not used excluding first loading.
    if (this.#id[3] == null) {
      this.#id[3] = newID;
    } else {
      console.log("ERROR: [Marker init] Parent ID(marker) is already set.");
    }
  }
  //getter setter event listener
  get id() {
    return this.#id;
  }
  set id(value) {
    //uneditable
    console.log("ID is not editable.");
    return;
  }
  get name() {
    return this.#name;
  }
  set name(value) {
    if (this.#name !== validateName(value)) {
      this.#name = validateName(value);
    }
  }
  get distance() {
    return this.#distance;
  }
  set distance(value) {
    if (this.#distance !== value) {
      this.#distance = value;
      this.emitChange("Marker", "distance", value);
    }
  }
  get composite_depth() {
    return this.#composite_depth;
  }
  set composite_depth(value) {
    if (this.#composite_depth !== value) {
      this.#composite_depth = value;
      this.emitChange("Marker", "composite_depth", value);
    }
  }
  get event_free_depth() {
    return this.#event_free_depth;
  }
  set event_free_depth(value) {
    if (this.#event_free_depth !== value) {
      this.#event_free_depth = value;
      this.emitChange("Marker", "event_free_depth", value);
    }
  }
  get drilling_depth() {
    return this.#drilling_depth;
  }
  set drilling_depth(value) {
    if (this.#drilling_depth !== value) {
      this.#drilling_depth = value;
      this.emitChange("Marker", "drilling_depth", value);
    }
  }
  get age() {
    return this.#age;
  }
  set age(value) {
    if (this.#age !== value) {
      this.#age = value;
      this.emitChange("Marker", "age", value);
    }
  }
  get age_error() {
    return this.#age_error;
  }
  set age_error(value) {
    if (this.#age_error !== value) {
      this.#age_error = value;
      this.emitChange("Marker", "age_error", value);
    }
  }
  get correlation() {
    return this.#correlation;
  }
  set correlation(value) {
    if (this.#correlation !== value) {
      this.#correlation = value;
      this.emitChange("Marker", "correlation", value);
    }
  }
  get isMaster() {
    return this.#isMaster;
  }
  set isMaster(value) {
    if (this.#isMaster !== value) {
      this.#isMaster = value;
      this.emitChange("Marker", "isMaster", value);
    }
  }
  get isZeroPoint() {
    return this.#isZeroPoint;
  }
  set isZeroPoint(value) {
    if (this.#isZeroPoint !== value) {
      this.#isZeroPoint = value;
      this.emitChange("Marker", "isZeroPoint", value);
    }
  }

  //event
  //emit listener
  emitChange(propLevel, propName, newValue) {
    this.listeners.forEach((callback) =>
      callback(propLevel, propName, newValue)
    );
  }
  //add listener
  onChange(callback) {
    this.listeners.push(callback);
  }
}

//subfunction
function validateName(name) {
  const reservedWord = ["top", "bottom"];
  if (reservedWord.includes(name)) {
    name = "__" + name;
    //throw new Error(name +' is the reserved word.');
    console.log(
      name + " is reserved word. Therefore, name is renamed to __",
      +name + "."
    );
  }
  return name;
}

module.exports = { Marker };
