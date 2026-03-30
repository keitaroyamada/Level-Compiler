module.exports = [
  {
    name: "CLI regression",
    scriptName: "test:cli",
    description: "Core logic and data-model regression checks executed without launching the Electron UI.",
    coverage: [
      "Saved-answer regression for LC csv, LF csv, and lcmodel fixtures",
      "Invalid-input handling for broken csv, age, and lcmodel fixtures",
      "Depth conversion regression including trinity sweep and CD/EFD round trips",
      "Age-model regression including round trips, contradiction counts, and extrapolation behavior",
    ],
  },
  {
    name: "Electron E2E",
    scriptName: "test:e2e",
    description: "Playwright-based Electron end-to-end checks covering app startup and critical UI loading flows.",
    coverage: [
      "App startup and renderer test-hook availability",
      "lcmodel fixture loading through renderer",
      "age csv fixture loading after model load",
      "Finder CD, EFD, and age consistency after loading the age model",
    ],
  },
];
