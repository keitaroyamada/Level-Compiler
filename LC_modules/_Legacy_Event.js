const lcfnc = require("./lcfnc.js");

class Event {
  //Private properties
  #id;
  #name;
  #type;
  #upper_distance;
  #lower_distance;
  constructor() {
    this.#id = lcfnc.uuidv4();
    this.#name = "";
    this.#upper_distance = null;
    this.#lower_distance = null;
    this.type = "deposition";
    this.posX = 0;
    this.posY = 0;
    this.listeners = [];
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
  get upper_distance() {
    return this.#upper_distance;
  }
  set upper_distance(value) {
    if (this.#upper_distance !== value) {
      this.#upper_distance = value;
      this.emitChange("Event", "upper", value);
    }
  }
  get lower_distance() {
    return this.#lower_distance;
  }
  set lower_distance(value) {
    if (this.#lower_distance !== value) {
      this.#lower_distance = value;
      this.emitChange("Event", "lower", value);
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

module.exports = { Event };
