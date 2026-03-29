const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");

const { LevelCompilerCore } = require("../LC_modules/LevelCompilerCore.js");

async function loadLcModelFile(filepath) {
  const fileBuffer = fs.readFileSync(filepath);
  const isZip =
    fileBuffer[0] === 0x50 &&
    fileBuffer[1] === 0x4b &&
    fileBuffer[2] === 0x03 &&
    fileBuffer[3] === 0x04;

  if (isZip) {
    const zip = await JSZip.loadAsync(fileBuffer);
    const file = zip.file("lcmodel.json");
    if (!file) {
      throw new Error("lcmodel.json was not found in lcmodel archive.");
    }
    const content = await file.async("string");
    return JSON.parse(content);
  }

  return JSON.parse(fileBuffer.toString("utf8"));
}

function parseArgs(argv) {
  const args = {
    input: null,
    output: null,
    type: "lc-csv",
    event: null,
    roundDigits: 3,
    trinityStepCm: 1,
    includeTrinitySweep: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--input") {
      args.input = next;
      i++;
    } else if (token === "--output") {
      args.output = next;
      i++;
    } else if (token === "--type") {
      args.type = next;
      i++;
    } else if (token === "--event") {
      args.event = next;
      i++;
    } else if (token === "--round-digits") {
      args.roundDigits = Number(next);
      i++;
    } else if (token === "--trinity-step") {
      args.trinityStepCm = Number(next);
      i++;
    } else if (token === "--no-trinity-sweep") {
      args.includeTrinitySweep = false;
    }
  }

  if (!args.input || !args.output) {
    throw new Error(
      "Usage: node scripts/export-test-answer.js --input <path> --output <path> [--type lc-csv|lf-csv|lcmodel] [--event <lf event csv>] [--round-digits 3] [--trinity-step 1] [--no-trinity-sweep]"
    );
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  const outputPath = path.resolve(args.output);

  const core = new LevelCompilerCore();

  if (args.type === "lc-csv") {
    core.loadModelFromCsv(inputPath, "forLC");
  } else if (args.type === "lf-csv") {
    core.loadModelFromCsv(inputPath, "forLF");
    if (args.event) {
      core.loadEventListFromCsv(path.resolve(args.event));
    }
  } else if (args.type === "lcmodel") {
    const rawLcmodelData = await loadLcModelFile(inputPath);
    const lcmodelData = rawLcmodelData && rawLcmodelData.LCCore ? rawLcmodelData.LCCore : rawLcmodelData;
    core.loadModelFromLcmodel(lcmodelData);
  } else {
    throw new Error(`Unsupported type: ${args.type}`);
  }

  core.calcCompositeDepth();
  core.calcEventFreeDepth(false);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  core.exportTestAnswer(outputPath, {
    roundDigits: args.roundDigits,
    trinityStepCm: args.trinityStepCm,
    includeTrinitySweep: args.includeTrinitySweep,
  });

  console.log(`Exported test answer: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
