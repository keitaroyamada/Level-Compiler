class AgeSet {
  //private properties
  constructor() {
    this.name = "";
    this.version = "";
    this.ages = [];
    this.reserved_age_ids = new Set();
    this.reserved_age_ids.add(0);
  }
}

module.exports = { AgeSet };
