const suites = [];

function registerTest(name, fn) {
  suites.push({ name, fn });
}

function getRegisteredTests() {
  return suites;
}

module.exports = {
  registerTest,
  getRegisteredTests,
};
