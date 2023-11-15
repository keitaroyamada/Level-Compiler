const lcfnc = require("./lcfnc.js");

class Core {
  //Private properties
  #id;
  #name;
  #markers;
  #events;
  constructor() {
    this.#id = [null, null, lcfnc.uuidv4()];
    this.#name = "";
    this.#markers = [];
    this.#events = [];
    this.posX = 0;
    this.posY = 0;
    this.listeners = [];

    this.VCEfromChild = this.VCEfromChild.bind(this);
  }

  //Methods
  addParentId(parentId) {
    if (this.#id[0] == null) {
      if (this.#id[1] == null) {
        this.#id[0] = parentId[0];
        this.#id[1] = parentId[1];
      } else {
        console.log("ERROR: [Core] Parent ID(hole)) is already set.");
        return;
      }
    } else {
      console.log("ERROR: [Core] Parent ID(project) is already set.");
      return;
    }
  }
  addMarker(MarkerData) {
    //add
    MarkerData.onChange(this.VCEfromChild); //set callback
    this.#markers.push(MarkerData);
    this.#markers.sort((a, b) => (a.distance < b.distance ? -1 : 1)); //auto sort
  }
  addEvent(EventData) {
    //add
    MarkerData.onChange(VCEfromChild); //set callback
    this.#events.push(EventData);
    this.#events.sort((a, b) => (a.upper_distance < b.upper_distance ? -1 : 1)); //auto sort
  }
  makeTestData() {
    for (let i = 0; i < 10; i++) {
      m = new Marker();
      m.distance = Math.round(Math.random() * 1000) / 10;

      if (i == 0) {
        m.name = "top";
      } else if (i == 9) {
        m.name = "bottom";
      } else if (i > 5 && i < 7) {
        m.isMaster = true;
      }

      testCore.addMarker(m);
    }
  }

  //getter setter listener
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
  get markers() {
    return this.#markers;
  }
  get events() {
    return this.#events;
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

  VCEfromChild(propLevel, propName, newValue) {
    console.log(
      `Handling event for ${propName} at level ${propLevel} changed to ${newValue} `
    );
    this.#markers[0].distance += 1;
  }
}

function handleEvent(propLevel, propName, newValue) {
  // ここでイベントに応じた処理を行う
  console.log(
    `Handling event for ${propName} at level ${propLevel} changed to ${newValue} !!!!!!!!!!!!!!!!!!!!!!`
  );
}

//subfunction
function validateType(type) {
  const reservedWord = ["normal", "piston"];
  if (reservedWord.includes(type)) {
    this._type = inType;
  } else {
    this._type = "normal";
    console.log(name + " is not supported core type.");
  }
  return name;
}

function getRelativeLocs(vals) {}

module.exports = { Core };
