const { parentPort } = require("worker_threads");
const fs = require("fs");
const sharp = require("sharp");
const JSZip = require("jszip");
const path = require("path");

parentPort.on("message", async (task) => {
  if (task.type == "exit") {
    process.exit(0);
  } else if (task.type == "continue") {
    let results = {
      load_target_ids: [],
      operations: [],
      image_resolution: {},
      drilling_depth: {},
      composite_depth: {},
      event_free_depth: {},
      age: {},
    };

    try {
      let resizedBuffer;
      let imageBufferDD;

      if (task.operations.includes("drilling_depth")) {
        if (task.imagePath == null) {
          parentPort.postMessage(results);
          return;
        } else {
          if (typeof task.imagePath === "string") {
            imageBufferDD = await fs.promises.readFile(task.imagePath);

          } else if (
            typeof task.imagePath === "object" &&
            task.imagePath.zipPath &&
            task.imagePath.innerPath
          ) {
            imageBufferDD = await extractFileByPath(
              task.imagePath.zipPath,
              task.imagePath.innerPath
            );

          } else {
            throw new Error("Invalid imagePath: " + JSON.stringify(task.imagePath));
          }

          resizedBuffer = await sharp(imageBufferDD)
            .resize({ height: task.imageSize.height, fit: "inside" })
            .toBuffer();

          results["drilling_depth"][task.imageName] = resizedBuffer;
        }
      }

      if (!resizedBuffer) {
        console.error("Worker: Please load image of drilling depth scale");
        parentPort.postMessage({
          status: "error",
          message: "There is no original image.",
        });
        return;
      }

      await makeModelImage("composite_depth");
      await makeModelImage("event_free_depth");
      await makeModelImage("age");

      parentPort.postMessage(results);

      async function makeModelImage(depthScale) {
        if (task.operations.includes(depthScale)) {
          const metadata = await sharp(resizedBuffer).metadata();

          const pixPerCm =
            task.imageSize.height /
            (task.sectionData.markers[task.sectionData.markers.length - 1].distance -
             task.sectionData.markers[0].distance);

          let newHeight = 0;
          const operations = [];
          const d0 = task.sectionData.markers[0].distance;
          const m0 = task.sectionData.markers[0][depthScale];

          let ageCorrection = depthScale === "age" ? 0.1 : 1;

          for (let i = 0; i < task.sectionData.markers.length - 1; i++) {
            const { id, name } = task.sectionData.markers[i];
            const dTop = task.sectionData.markers[i].distance;
            const dBottom = task.sectionData.markers[i + 1].distance;
            const mTop = task.sectionData.markers[i][depthScale];
            const mBottom = task.sectionData.markers[i + 1][depthScale];

            const fromP0 = (dTop - d0) * pixPerCm;
            const fromP1 = (dBottom - d0) * pixPerCm;
            const toP0 = (mTop - m0) * pixPerCm * ageCorrection;
            const toP1 = (mBottom - m0) * pixPerCm * ageCorrection;

            if (toP0 > toP1) {
              console.log(task.sectionData.markers[i].name, task.sectionData.markers[i + 1].name);
              console.log(mTop, mBottom, m0, pixPerCm);
              console.log(
                "Worker: Contradiction is detected in ",
                task.sectionData.markers[i].name,
                " of ",
                task.sectionData.markers[0].name.split("-")[0],
                "-",
                task.sectionData.markers[0].name.split("-")[1],
                " (", depthScale, ": ", toP0, "<->", toP1, ")"
              );
            }

            operations.push({
              id,
              name,
              fromTop: fromP0,
              fromBottom: fromP1,
              toTop: Math.floor(toP0),
              toBottom: Math.ceil(toP1),
            });

            newHeight += toP1 - toP0;
          }

          if (newHeight < 0.5) {
            results[depthScale][task.imageName] = undefined;
          } else {
            let newIm = sharp({
              create: {
                width: metadata.width,
                height: Math.round(newHeight),
                channels: 3,
                background: { r: 0, g: 0, b: 0 },
              },
            }).jpeg();

            const compositeOperations = [];

            for (const op of operations) {
              if (
                Math.round(op.fromBottom - op.fromTop) === 0 ||
                Math.round(op.toBottom - op.toTop) === 0
              ) {
                continue;
              }

              let extractHeight = op.fromBottom - op.fromTop;

              try {
                if (Math.round(op.fromTop) + Math.round(extractHeight) > metadata.height) {
                  console.log(
                    "Worker: change ",
                    task.imageName,
                    " height at ",
                    depthScale,
                    " from",
                    Math.round(extractHeight) + " to ",
                    metadata.height - Math.round(op.fromTop)
                  );
                  extractHeight = metadata.height - Math.round(op.fromTop);
                }

                extractHeight = Math.max(1, Math.round(extractHeight));

                const currSection = await sharp(resizedBuffer)
                  .extract({
                    left: 0,
                    top: Math.round(op.fromTop),
                    width: metadata.width,
                    height: Math.round(extractHeight),
                  })
                  .resize({
                    width: metadata.width,
                    height: Math.round(op.toBottom - op.toTop),
                    fit: "fill",
                  })
                  .toBuffer();

                compositeOperations.push({
                  input: currSection,
                  top: Math.round(op.toTop),
                  left: 0,
                });
              } catch (err) {
                console.error("Worker:", err);
                console.log(op, metadata, Math.round(op.fromTop) + Math.round(extractHeight));
              }
            }

            if (compositeOperations.length > 0) {
              newIm = await newIm.composite(compositeOperations).toBuffer();
            }

            results[depthScale][task.imageName] = newIm;
          }
        }
      }
    } catch (error) {
      console.error("Worker:", error, task);
      parentPort.postMessage({
        status: "error",
        message: error.message,
      });
    }
  }
});

async function extractFileByPath(basePath, innerPath) {
  if (!extractFileByPath._cache) {
    extractFileByPath._cache = {
      rootZipPath: null,
      rootZip: null,
      nestedZipKey: null,
      nestedZip: null,
    };
  }

  const cache = extractFileByPath._cache;
  const layers = innerPath.split("::");

  if (!fs.existsSync(basePath)) {
    throw new Error("Zip file not found: " + basePath);
  }

  let zip;

  if (cache.rootZipPath === basePath && cache.rootZip) {
    zip = cache.rootZip;
  } else {
    const zipBuffer = await fs.promises.readFile(basePath);
    zip = await JSZip.loadAsync(zipBuffer);
    cache.rootZipPath = basePath;
    cache.rootZip = zip;
    cache.nestedZipKey = null;
    cache.nestedZip = null;
  }

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const isLast = i === layers.length - 1;

    if (i > 0) {
      const nestedZipKey = basePath + "::" + layers.slice(0, i).join("::");

      if (cache.nestedZipKey === nestedZipKey && cache.nestedZip) {
        zip = cache.nestedZip;
      } else {
        const prevLayer = layers[i - 1];
        const prevFile = zip.file(prevLayer);

        if (!prevFile) {
          throw new Error("File not found in zip: " + innerPath);
        }

        const nestedBuffer = await prevFile.async("nodebuffer");
        zip = await JSZip.loadAsync(nestedBuffer);

        cache.nestedZipKey = nestedZipKey;
        cache.nestedZip = zip;
      }
    }

    const file = zip.file(layer);

    if (!file) {
      throw new Error("File not found in zip: " + innerPath);
    }

    if (isLast) {
      return await file.async("nodebuffer");
    }

    if (path.extname(layer).toLowerCase() !== ".zip") {
      throw new Error("Intermediate layer is not zip: " + layer);
    }
  }

  throw new Error("Could not resolve path to file: " + innerPath);
}