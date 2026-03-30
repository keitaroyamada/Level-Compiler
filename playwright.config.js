const path = require("path");

module.exports = {
  testDir: path.join(__dirname, "tests", "e2e"),
  timeout: 120000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
};
