const { parentPort } = require("worker_threads");
const fs = require("fs");
const sharp = require("sharp");

parentPort.on("message", async(task) => {
  if(task.type=="exit"){
    //close this worker
    process.exit(0);
  }else if(task.type=="continue"){
    let results = {
      load_target_ids: [],
      operations:[],
      image_resolution: {},
      drilling_depth: {},
      composite_depth: {},
      event_free_depth: {},
      age:{},
    };

    
    try {
      //load original images
      let resizedBuffer;
      if(task.operations.includes("drilling_depth")){
        //load original image from file
        const imageBufferDD = await fs.promises.readFile(task.imagePath);
        //resize
        resizedBuffer = await sharp(imageBufferDD).resize({ height: task.imageSize.height, width: 30000, fit: 'inside' }).toBuffer();
        //save
        results["drilling_depth"][task.imageName] = resizedBuffer;
      }
      if(!resizedBuffer){
        console.error("Worker: Please load image of drilling depth scale");
        parentPort.postMessage({
          status: "error",
          message: "There is no original image.",
        });
      }
  
      await makeModelImage("composite_depth");
      await makeModelImage("event_free_depth");
      await makeModelImage("age");
  
      // return results
      parentPort.postMessage(results);

      async function makeModelImage(depthScale){
        if(task.operations.includes(depthScale)){
          // Retrieve image metadata
          const metadata = await sharp(resizedBuffer).metadata();
      
          // Calculate pixels per cm for scaling
          const pixPerCm = task.imageSize.height / (task.sectionData.markers[task.sectionData.markers.length - 1].distance - task.sectionData.markers[0].distance);

          // Initialize new image height and operation list
          let newHeight = 0;
          const operations = [];
          const d0 = task.sectionData.markers[0].distance;
          const m0 = task.sectionData.markers[0][depthScale];
      
          // Adjust scaling for age, if applicable
          let ageCorrection = depthScale === "age" ? 0.1 : 1;
      
          // Iterate through markers to calculate transformation operations
          for (let i = 0; i < task.sectionData.markers.length - 1; i++) {
            const { id, name } = task.sectionData.markers[i];
            const dTop    = task.sectionData.markers[i].distance;
            const dBottom = task.sectionData.markers[i + 1].distance;
            const mTop    = task.sectionData.markers[i][depthScale];
            const mBottom = task.sectionData.markers[i + 1][depthScale];
      
            // Calculate positions in pixels
            const fromP0 = (dTop - d0) * pixPerCm;
            const fromP1 = (dBottom - d0) * pixPerCm;
            const toP0 = (mTop - m0) * pixPerCm * ageCorrection;
            const toP1 = (mBottom - m0) * pixPerCm * ageCorrection;
            if(toP0>toP1){
              console.log(task.sectionData.markers[i].name,task.sectionData.markers[i + 1].name)
              console.log(mTop, mBottom, m0, pixPerCm)
              console.log(
                "Worker: Contradiction is detected in ", 
                " of ",task.sectionData.markers[i].name,
                task.sectionData.markers[0].name.split("-")[0],
                "-",
                task.sectionData.markers[0].name.split("-")[1],
                " (", depthScale,": ",toP0,"<->", toP1,")"
              );
            }
      
            // Add transformation operation
            operations.push({
              id,
              name,
              fromTop: fromP0,
              fromBottom: fromP1,
              toTop: toP0,
              toBottom: toP1,
            });
      
            // Update the total height of the new image
            newHeight += toP1 - toP0;
          }
      
          // If the new height is too small, return an empty result
          if (newHeight < 0.5) {
            results[depthScale][task.imageName] = undefined;
          }else{
            // Create a blank new image with calculated dimensions
            let newIm = sharp({
              create: {
                width: metadata.width,
                height: Math.round(newHeight),
                channels: 3,
                background: { r: 0, g: 0, b: 0 }, // Black background
              },
            }).jpeg();
      
            // Prepare composite operations for the new image
            const compositeOperations = [];
            for (const op of operations) {
              if (Math.round(op.fromBottom - op.fromTop) === 0 || Math.round(op.toBottom - op.toTop) === 0) {
                continue; // Skip invalid sections
              }
              
              let extractHeight = op.fromBottom - op.fromTop;
              try{
                //limit size
                
                if (Math.round(op.fromTop) + Math.round(extractHeight) > metadata.height) {
                  console.log("Worker: change ",task.imageName," height at ",depthScale," from", Math.round(extractHeight) + " to ", metadata.height - Math.round(op.fromTop));
                  extractHeight = metadata.height - Math.round(op.fromTop);
                }

                // Extract and resize each section of the original image
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
        
                // Add the processed section to composite operations
                compositeOperations.push({
                  input: currSection,
                  top: Math.round(op.toTop),
                  left: 0,
                });
              }catch(err){
                console.error("Worker:", err);
                console.log(op, metadata, Math.round(op.fromTop) + Math.round(extractHeight))
              }             
            }
      
            // Apply composite operations to the new image
            if (compositeOperations.length > 0) {
              newIm = await newIm.composite(compositeOperations).toBuffer();
            }
      
            //save
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
