const { spawnSync } = require("child_process");
const path = require("path");
const testSuites = require("./test-suites.js");

const ROOT_DIR = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function buildCommand(scriptName) {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `${npmCommand} run ${scriptName}`],
    };
  }

  return {
    command: npmCommand,
    args: ["run", scriptName],
  };
}

function runStep(name, scriptName) {
  const startedAt = Date.now();
  console.log(`\n[TEST] ${name} started`);

  const invocation = buildCommand(scriptName);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd: ROOT_DIR,
    stdio: "inherit",
    shell: false,
  });

  const durationMs = Date.now() - startedAt;
  const durationSec = (durationMs / 1000).toFixed(1);
  const status = result.status === 0 ? "PASS" : "FAIL";

  console.log(`[TEST] ${name} ${status} (${durationSec}s)`);

  return {
    name,
    scriptName,
    ok: result.status === 0,
    durationMs,
    exitCode: typeof result.status === "number" ? result.status : 1,
    error: result.error || null,
  };
}

function formatDuration(durationMs) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

const startedAt = Date.now();
const results = [];

for (const step of testSuites) {
  const result = runStep(step.name, step.scriptName);
  results.push(result);

  if (!result.ok) {
    break;
  }
}

const totalDurationMs = Date.now() - startedAt;
const passedCount = results.filter((result) => result.ok).length;
const failedCount = results.filter((result) => !result.ok).length;

console.log("\n=== Test Summary ===");
for (const result of results) {
  console.log(
    `${result.ok ? "PASS" : "FAIL"} | ${result.name} | ${result.scriptName} | ${formatDuration(result.durationMs)}`
  );
}

for (const step of testSuites.slice(results.length)) {
  console.log(`SKIP | ${step.name} | ${step.scriptName} | not run`);
}

console.log(`Total: ${results.length}/${testSuites.length} steps run`);
console.log(`Passed: ${passedCount}`);
console.log(`Failed: ${failedCount}`);
console.log(`Elapsed: ${formatDuration(totalDurationMs)}`);

console.log("\n=== Suite Details ===");
for (const suite of testSuites) {
  const result = results.find((item) => item.scriptName === suite.scriptName);
  const status = result ? (result.ok ? "PASS" : "FAIL") : "SKIP";
  const duration = result ? formatDuration(result.durationMs) : "not run";

  console.log(`${status} | ${suite.name} | ${suite.scriptName} | ${duration}`);
  console.log(`What it covers: ${suite.description}`);
  for (const item of suite.coverage || []) {
    console.log(`- ${item}`);
  }
}

if (failedCount > 0) {
  const failed = results.find((result) => !result.ok);
  if (failed && failed.error) {
    console.error(failed.error);
  }
  process.exitCode = failed ? failed.exitCode : 1;
} else {
  console.log("Overall: PASS");
}
