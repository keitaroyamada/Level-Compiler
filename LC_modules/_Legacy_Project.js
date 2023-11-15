const lcfnc = require("./lcfnc.js");

class Project {
  #id;
  #holes;
  #name;
  constructor() {
    this.#id = lcfnc.uuidv4();
    this.#name = "";
    this.#holes = [];
  }

  //getter setter
  get id() {
    return this.#id;
  }
  set id(value) {
    //uneditable
    console.log("ERROR: [Project] ID is not editable.");
    return;
  }
  get name() {
    return this.#name;
  }
  set name(value) {
    this.#name = value;
  }
  get holes() {
    return this.#holes;
  }

  //method
  addHole(HoleData) {
    HoleData.onChange(handleEvent);
    HoleData;
    //add
    this.#holes.push(HoleData);
    //this.#holes.sort((a, b) => (a.distance < b.distance ? -1 : 1)); //auto sort
  }
}

function handleEvent(propLevel, propName, newValue) {
  // ここでイベントに応じた処理を行う
  console.log(
    `Handling event for ${propName} at level ${propLevel} changed to ${newValue} !!!!!!!!!!!!!!!!!!!!!!`
  );
}

module.exports = { Project };
