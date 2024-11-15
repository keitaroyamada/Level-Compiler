const { workerData, parentPort } = require('worker_threads');
const fs = require('fs');
const sharp = require('sharp');


const { imPath, sectionData, imHeight, depthScale } = workerData.data;
(async () => {
  try {
    let imageBuffer = fs.readFileSync(imPath);

    if (imHeight != 0) {
      const metadata = await sharp(imageBuffer).metadata();
      const new_size = { height: imHeight, width: 1 };

      imageBuffer = await sharp(imageBuffer)
        .resize({ height: new_size.height })
        .toBuffer();
    }

    const undifBuffer = Buffer.from([0xba, 0x77, 0x5e, 0x7e, 0x29, 0xde]);
    if (imageBuffer.equals(undifBuffer)) {
      parentPort.postMessage(undefined);
      return;
    }

    const im = sharp(imageBuffer);
    const metadata = await im.metadata();
    let pixPerCm = imHeight / (sectionData.markers[sectionData.markers.length - 1].distance - sectionData.markers[0].distance);

    let newHeight = 0;
    let operations = [];
    const d0 = sectionData.markers[0].distance;
    const m0 = sectionData.markers[0][depthScale];
    for (let i = 0; i < sectionData.markers.length - 1; i++) {
      const id = sectionData.markers[i].id;
      const name = sectionData.markers[i].name;
      const dTop = sectionData.markers[i].distance;
      const dBottom = sectionData.markers[i + 1].distance;
      const mTop = sectionData.markers[i][depthScale];
      const mBottom = sectionData.markers[i + 1][depthScale];

      const fromP0 = (dTop - d0) * pixPerCm;
      const fromP1 = (dBottom - d0) * pixPerCm;
      const toP0 = (mTop - m0) * pixPerCm;
      const toP1 = (mBottom - m0) * pixPerCm;

      operations.push({
        id: id,
        name: name,
        fromTop: fromP0,
        fromBottom: fromP1,
        toTop: toP0,
        toBottom: toP1,
      });
      newHeight += toP1 - toP0;
    }

    if (newHeight < 0.5) {
      parentPort.postMessage([]);
      return;
    }

    let newIm = sharp({
      create: {
        width: metadata.width,
        height: Math.round(newHeight),
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    }).jpeg();

    let compositeOperations = [];
    for (const ope of operations) {
      if (Math.round(ope.fromBottom - ope.fromTop) === 0 || Math.round(ope.toBottom - ope.toTop) === 0) {
        continue;
      }

      const baseIm = sharp(imageBuffer);

      const currSection = await baseIm
        .extract({
          left: 0,
          top: Math.round(ope.fromTop),
          width: metadata.width,
          height: Math.round(ope.fromBottom - ope.fromTop),
        })
        .resize({
          width: metadata.width,
          height: Math.round(ope.toBottom - ope.toTop),
          fit: 'fill',
        })
        .toBuffer();

      compositeOperations.push({
        input: currSection,
        top: Math.round(ope.toTop),
        left: 0,
      });
    }

    if (compositeOperations.length > 0) {
      newIm = await newIm.composite(compositeOperations).toBuffer();
    }

    const base64Image = newIm.toString('base64');
    parentPort.postMessage(base64Image);

  } catch (error) {
    if (error.code === 'ENOENT') {
      parentPort.postMessage(null);
    } else {
      throw error;
    }
  }
})();
