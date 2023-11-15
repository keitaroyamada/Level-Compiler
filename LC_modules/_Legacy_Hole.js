const lcfnc = require("./lcfnc.js");

class Hole {
  //private properties
  #id;
  #name;
  #cores;
  #type;
  constructor() {
    this.#id = [null, lcfnc.uuidv4()];
    this.#name = "";
    this.#cores = [];
    this.#type = "general";
    this.listeners = [];
  }

  //methods
  addParentId(parentId) {
    if (this.#id[0] == null) {
      this.#id[0] = parentId;
    } else {
      console.log("ERROR: [Hole] Parent ID(project) is already set.");
      return;
    }
  }

  addCore(CoreData) {
    CoreData.onChange(handleEvent);
    //add
    this.#cores.push(CoreData);
    //this.#cores.sort((a, b) => (a.distance < b.distance ? -1 : 1)); //auto sort
  }

  //getter setter
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
    this.#name = value;
  }
  get type() {
    return this.#type;
  }
  set type(value) {
    this.#type = value;
  }
  get cores() {
    return this.#cores;
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

function handleEvent(propLevel, propName, newValue) {
  // ここでイベントに応じた処理を行う
  console.log(
    `Handling event for ${propName} at level ${propLevel} changed to ${newValue} !!!!!!!!!!!!!!!!!!!!!!`
  );
}

module.exports = { Hole };
