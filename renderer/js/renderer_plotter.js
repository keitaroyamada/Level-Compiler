document.addEventListener("DOMContentLoaded", () => {
    const scroller = document.getElementById("scroller");
    
    let LCPlot = null;
    let numSeries = 0;
    let vectorObjects = null;
    let zoom_rate = [0.5, 1.5, 1.0];//[x,y,shift]
    let canvasPos = [0, 0];
    let age_correction = 1/10;
    let pad = [200, 200];
    let seriesDistance = 100;
    let defWidth = 200;        
    let isSVG = false;
    const isGrid = true;
    let canvasBaseSize = [100,100]; 
    let depthScale = "composite_depth";
    let _inDraw = false;
    let _updateQueued = false;

    //-------------------------------------------------------------------------------------------
    //initialise
    window.PlotterApi.receive("PlotterMenuClicked", async (data) => {
        if(data){
            //data already loaded
        }else{
            //
            await initialiseLCPlotDataCollection();
        }        
    })    
    window.onbeforeunload = () => {
        window.PlotterAPI.send('windowCloseButton');
    };
    //-------------------------------------------------------------------------------------------
    document.addEventListener("mousemove", async function (event) {     
        const rect = document.getElementById("p5Canvas").getBoundingClientRect(); // Canvas position and size   
        var mouseX = event.clientX - rect.left;
        var mouseY = event.clientY - rect.top;
    });
    document.getElementById('container').addEventListener("dragover", (e) => {
        e.preventDefault(e);
    });
    document.getElementById('container').addEventListener("drop", async (e) => {
        e.preventDefault(e);
        //get file paths
        let dataList = [];
        for(const file of e.dataTransfer.files){
            const fileParseData = await window.PlotterApi.getFilePath(file);
            if(fileParseData.ext==".csv"){
                dataList.push(fileParseData);
            }
        }
        if(dataList.length>0){
            console.log("[Plotter]: Load csv files: "+dataList.length);
        }else{
            return
        }
        
        //register
        for(let d=0;d<dataList.length;d++){
            const sendData = {
                output_type:"import",
                called_from:"plotter",
                path:dataList[d].fullpath,
            };
            await window.PlotterApi.getPlotData(sendData);//plotter -> main -> converter -> main(LCPlot)
        }
        console.log("[Plotter]: All csvs are registered into LCPlot.")
    });
    document.getElementById('depth_scale').addEventListener("change", async (e) => {
        depthScale = e.target.value;
        updateView();
    });
    document.getElementById('plot_list').addEventListener("change", async (e) => {
        updateView();
        sendToRenderer("update");
    });
    document.getElementById('bt_add').addEventListener("click", async (e) => {
        if(LCPlot !== null ){ 
            numSeries += 1;
            //get selected collection
            const selectedCollectionId = document.getElementById("c_collection").value;
            let selectedIdx = null;
            LCPlot.data_collections.forEach((c, i)=>{
                if(c.id == selectedCollectionId){
                    selectedIdx = i;
                }
            })

            //make data
            const container = document.getElementById("plot_list");
            const seriesDiv = document.createElement("div");

            //is plot
            const seriesCheck = document.createElement("input");
            seriesDiv.style.paddingLeft = "0px";
            seriesCheck.type = "checkbox";
            seriesCheck.id = numSeries;
            seriesCheck.checked = true;            

            //data No
            const Nolabel = document.createElement("label");
            Nolabel.htmlFor = numSeries;
            Nolabel.textContent = numSeries.toString().padStart(2, "0");
            Nolabel.style.marginRight = "5px";
            Nolabel.title = "Source: " + LCPlot.data_collections[selectedIdx].name;

            //data name
            const serieslabel = document.createElement("label");
            serieslabel.htmlFor = numSeries;
            serieslabel.dataset.value = LCPlot.data_collections[selectedIdx].id;
            serieslabel.style.marginRight = "5px";

            //separator
            const separatorlabel = document.createElement("label");
            separatorlabel.htmlFor = 0;
            separatorlabel.textContent = "/";
            
            //numerator
            const numeratorDropdown = document.createElement("select");
            numeratorDropdown.style.width = "80px";
            numeratorDropdown.style.marginRight = "5px";
            numeratorDropdown.id = numSeries;
            numeratorDropdown.title = "Numerator";

            const option1 = document.createElement("option");
            option1.value = 0;
            option1.textContent = "1";
            numeratorDropdown.appendChild(option1);
            LCPlot.data_collections[selectedIdx].datasets.forEach(dataset=>{
                const option = document.createElement("option");
                option.value = dataset.id;
                option.textContent = dataset.name;
                numeratorDropdown.appendChild(option);
            })
            numeratorDropdown.selectedIndex = 1; 

            //denominator
            const denominatorDropdown = document.createElement("select");
            denominatorDropdown.style.width = "80px";
            denominatorDropdown.style.marginLeft = "5px";
            denominatorDropdown.id = numSeries;
            denominatorDropdown.title = "Denominator";

            const option0 = document.createElement("option");
            option0.value = 0;
            option0.textContent = "1";
            denominatorDropdown.appendChild(option0);
            LCPlot.data_collections[selectedIdx].datasets.forEach(dataset=>{
                const option = document.createElement("option");
                option.value = dataset.id;
                option.textContent = dataset.name;
                denominatorDropdown.appendChild(option);
            })

            //plot colour options
            const plotColour = document.createElement("input");
            plotColour.type = "color";
            //plotColour.type = "text";
            plotColour.id = numSeries;
            plotColour.value = "#ff0000";
            plotColour.placeholder = "#ff0000";
            //plotColour.className = "color-picker";                        
            //plotColour.value = "red";
            plotColour.style.width = "40px";
            plotColour.style.marginLeft= "40px";
            plotColour.title = "Plot colour";

            //amplification options
            const amplification = document.createElement("input");
            amplification.type = "number";
            amplification.id = numSeries;
            amplification.placeholder = 1;
            amplification.value = 1;
            amplification.style.width = "40px";
            amplification.title = "Amplitude gain";
            amplification.style.marginLeft = "5px";

            //plot type options
            const plotTypeDropdown = document.createElement("select");
            plotTypeDropdown.style.width = "70px";
            plotTypeDropdown.style.marginLeft = "5px";
            plotTypeDropdown.id = numSeries;
            plotTypeDropdown.title = "Plot type";

            //const plotType = ["line", "scatter","bar"];
            const plotType = ["line", "scatter", "bar"];
            plotType.forEach(p=>{
                const opt = document.createElement("option");
                opt.value = p;
                opt.textContent = p;
                plotTypeDropdown.appendChild(opt);
            })
            
            //delete button
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "×";
            deleteBtn.title = "delete";
            deleteBtn.style.marginLeft = "10px";
            deleteBtn.addEventListener("click", () => {
                const parentElement = document.getElementById("plot_list");
                const grandChild = seriesDiv.querySelector("input[type='checkbox']");
                if (grandChild) {
                    grandChild.checked = false;
                    parentElement.dispatchEvent(new Event('change'));
                }
                seriesDiv.remove();
                updateView();
                });
            

            //stack
            seriesDiv.appendChild(deleteBtn);
            seriesDiv.appendChild(Nolabel);
            seriesDiv.appendChild(numeratorDropdown);
            seriesDiv.appendChild(separatorlabel);
            seriesDiv.appendChild(denominatorDropdown);
            seriesDiv.appendChild(seriesCheck);
            seriesDiv.appendChild(plotColour);
            seriesDiv.appendChild(serieslabel);
            seriesDiv.appendChild(amplification);
            seriesDiv.appendChild(plotTypeDropdown);

            container.appendChild(seriesDiv);

            updateView();

            let selectedList = getSelectedData();
            if(selectedList.length==1){
                sendToRenderer("new")
            }else{
                sendToRenderer("add")
            }
        }    
    });
    scroller.addEventListener("scroll",async function (event) {
        const rect = document.getElementById("p5Canvas").getBoundingClientRect()
        ///scroller position
        canvasPos[0] = scroller.scrollLeft;//* xMag;
        canvasPos[1] = scroller.scrollTop;//* yMag;

        const absoluteX = scroller.scrollLeft + rect.width / 2 - rect.left;
        const absoluteY = scroller.scrollTop + rect.height / 2 - rect.top;

        //update plot
        updateView();
      },
      { passive: false }
    );
    document.addEventListener( "wheel",  function (event) {
        event.preventDefault();
        var deltaY = event.deltaY;

        if (event.shiftKey) {
            zoom_rate[2] += 0.01 * deltaY;
        }

        if (event.altKey) {
            // store zoom rate
            const oldCanvasBaseWidth = canvasBaseSize[0];
            const oldCanvasBaseHeight = canvasBaseSize[1];

            // calc centre of vartual area
            const viewCenterX = scroller.scrollLeft + scroller.clientWidth / 2;
            const viewCenterY = scroller.scrollTop + scroller.clientHeight / 2;

            // update zoom rate
            if(event.ctrlKey){
                zoom_rate[0] += 0.001 * deltaY;
            }else{
                zoom_rate[1] += 0.001 * deltaY;
            }

            // limit zoom rate
            if (zoom_rate[1] < 0.1) {
                zoom_rate[1] = 0.1;
            }
            if (zoom_rate[0] < 0.1) {
                zoom_rate[0] = 0.1;
            }

            // get new canvas size
            makeP5CanvasBase();
            const newCanvasBaseWidth = canvasBaseSize[0];
            const newCanvasBaseHeight = canvasBaseSize[1];

            // calc new scrolled position
            const scaleX = newCanvasBaseWidth / oldCanvasBaseWidth;
            const scaleY = newCanvasBaseHeight / oldCanvasBaseHeight;

            const newScrollLeft = viewCenterX * scaleX - scroller.clientWidth / 2;
            const newScrollTop = viewCenterY * scaleY - scroller.clientHeight / 2;

            // move to new position
            scroller.scrollTo(newScrollLeft, newScrollTop);

            updateView();
        }
    },
    { passive: false });
    window.PlotterApi.receive("PlotterImport", async (data) => {
        if(LCPlot !== null ){ 
            console.log("Plotter: Importing...")
        }  
    })
    window.PlotterApi.receive("PlotterExport", async (data) => {
        if(LCPlot !== null ){ 
            console.log("Plotter: Exporting...")
            isSVG = true;
            const targetCanvas = new p5(p5Sketch);
            targetCanvas.save("plot.svg");
            isSVG = false;
            console.log("Done.")
        }
    })
    window.PlotterApi.receive("importedData", async (data) => {
        document.body.style.cursor = "wait"; 
        console.log("[Plotter]: Imported data recieved.");

        //unzip
        const cs = new DecompressionStream('gzip');
        const decompressedStream = new Response(
            new Blob([data]).stream().pipeThrough(cs)
        );
        const decompressed = await decompressedStream.text();
        const originalData = JSON.parse(decompressed);

        //load LCPlot
        LCPlot = originalData;
        console.log(LCPlot)

        //initialise
        const parentElement = document.getElementById("c_collection");
        while (parentElement.firstChild) {
            parentElement.removeChild(parentElement.firstChild);
        }

        //show
        LCPlot.data_collections.forEach(collection=>{
            const option = document.createElement("option");
            option.value = collection.id;
            option.textContent = collection.name;

            document.getElementById("c_collection").appendChild(option);
        });
        document.body.style.cursor = "default"; 
        window.PlotterApi.clearProgressbar();
        window.PlotterApi.ConverterClose();
    }); 
    function getSelectedData(){
        const children = document.getElementById("plot_list").children;
        let results = [];
        Array.from(children).forEach((child, i) => {
            let result = {
                isDraw:false,
                collectionId:null,
                numeratorId:null,
                denominatorId:null,
                colour: "black",
                order:0,
                plotType:"line",
            };

            const checkbox            = child.querySelector("input[type='checkbox']");
            const numeratorDropdown   = child.querySelector("select:nth-of-type(1)");
            const denominatorDropdown = child.querySelector("select:nth-of-type(2)");
            const parentCollection    = child.querySelector("label[data-value]");
            const plotColour          = child.querySelector("input[type='color']");
            const amplification       = child.querySelector("input[type='number']");
            const plotTypeDropdown    = child.querySelector("select:nth-of-type(3)");
            const noLabel             = child.querySelector("label:nth-of-type(1)");
            const splitLabel          = child.querySelector("label:nth-of-type(2)");
          
            const checkboxValue = checkbox ? checkbox.checked : null;
            const numeratorId   = numeratorDropdown ? numeratorDropdown.value : null;
            const denominatorId = denominatorDropdown ? denominatorDropdown.value : null;
            const collectionId  = parentCollection ? parentCollection.dataset.value : null;
            const colourValue   = plotColour ? plotColour.value : "gray";
            const amplificationValue = amplification ? amplification.value : null;
            const plotType = plotTypeDropdown ? plotTypeDropdown.value : "line";

            //set colour value
            numeratorDropdown.style.color   = colourValue;
            denominatorDropdown.style.color = colourValue;
            noLabel.style.color             = colourValue;
            splitLabel.style.color          = colourValue;
            parentCollection.style.color    = colourValue;
            plotTypeDropdown.style.color    = colourValue;
            amplification.style.color       = colourValue;
            //plotColour.style.color = colourValue;

            result.isDraw = checkboxValue;
            result.collectionId = parseInt(collectionId);
            result.numeratorId = parseInt(numeratorId);
            result.denominatorId = parseInt(denominatorId);
            result.colour = colourValue;
            result.order = i;
            result.amplification = parseFloat(amplificationValue);
            result.plotType = plotType;
            results.push(result);
        });
        return results;
    }
    document.addEventListener("keydown", async (event) => {
        //dev tool
        if (event.key === "F12") {
          window.PlotterApi.toggleDevTools("plotter");
        }
    
      });
    window.PlotterApi.receive("PlotterCleared", async (data) => {
        if(LCPlot !== null ){ 
            //remove all sended data
            const parentElement = document.getElementById("plot_list");
            Array.from(parentElement.children).forEach((child) => {
                const grandChild = child.querySelector("input[type='checkbox']");
                grandChild.checked = false;                
                parentElement.dispatchEvent(new Event('change'));
                child.remove();
              });

            //clear loaded plot data
            await initialiseLCPlotDataCollection();
            getSelectedData();
            updateView();
            await window.PlotterApi.PlotterClose();
        } 

    })    
    //============================================================================
    function updateView() {
    if (vectorObjects == null) {
        vectorObjects = new p5(p5Sketch);
        vectorObjects.noLoop();
        requestAnimationFrame(() => {
        if (vectorObjects && !vectorObjects._inDraw) { vectorObjects.clear(); vectorObjects.redraw(); }
        });
        return;
    }
    if (vectorObjects._inDraw) return;
    requestAnimationFrame(() => {
        if (vectorObjects && !vectorObjects._inDraw) { vectorObjects.clear(); vectorObjects.redraw(); }
    });
    }
    async function initialiseLCPlotDataCollection(){
        await window.PlotterApi.initialisePlotDataCollection();
    }
    function makeP5CanvasBase() {        //case base is too small
        let ymin = 0;
        let ymax = 1000;
        
        LCPlot.data_collections.forEach(c=>{
            c.datasets.forEach(d=>{
                d.data_series.forEach(s=>{
                    if(ymin>s[depthScale]){
                        ymin = s[depthScale];
                    }
                    if(ymax<s[depthScale]){
                        ymax = s[depthScale];
                    }  
                })
            })
        })

        if(ymin<0){
            pad[1] = 200 + Math.abs(ymin) * zoom_rate[1]; 
        }

        const results = getSelectedData();
        let cumAmp = 0;
        let numPlot = 0;
        results.forEach(res=>{
            cumAmp += res.amplification;
            numPlot ++;
        })
        let maxWidth = pad[0] +  cumAmp * defWidth * zoom_rate[0] + seriesDistance * numPlot * zoom_rate[2];
        
        if(maxWidth>50000){
            maxWidth = 50000;
        }

       
        let ageMod= 1;
        if(depthScale=="age"){
            ageMod = age_correction;
        }
        let maxHeight = pad[1] + (ymax - ymin) * ageMod * zoom_rate[1] * 1.1;
        if(maxHeight == 0){
            maxHeight = 100;
        }

        canvasBaseSize[0] = maxWidth;
        canvasBaseSize[1] = maxHeight;

        if (canvasBaseSize[0] < scroller.clientWidth) {
          canvasBaseSize[0] = scroller.clientWidth;
        }
        if (canvasBaseSize[1] < scroller.clientHeight) {
          canvasBaseSize[1] = scroller.clientHeight;
        }
        //change scroller size from canvas base(make full size canvas area)
        canvasBase.style.width = canvasBaseSize[0].toString() + "px"; //offsetWidth
        canvasBase.style.height = canvasBaseSize[1].toString() + "px";

       

    }
    const p5Sketch = (sketch) => {        
        sketch.setup = () => {
            let sketchCanvas = null;
            if (isSVG) {
            sketchCanvas = sketch.createCanvas(
                scroller.clientWidth,
                scroller.clientHeight,
                sketch.SVG
            );
            } else {            
            sketchCanvas = sketch.createCanvas(
                scroller.clientWidth,
                scroller.clientHeight,
                sketch.P2D
            );
            
            }

            sketch.strokeWeight(2);
            sketch.stroke("#ED225D");

            sketchCanvas.parent("p5Canvas");
            sketch.noLoop();
        };

        //draw data vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
        sketch.draw = () => {
            sketch.clear();
            if(LCPlot !== null ){  
                sketch.push(); //save
                sketch.translate(-canvasPos[0], -canvasPos[1]);
                //check plot data exist
                const selectedList = getSelectedData();
                if(selectedList.length==0){
                    return
                }

                //plot
                for(let t=0; t< selectedList.length;t++){
                    const target = selectedList[t];          
                    
                    //check draw
                    if(target.isDraw == false){
                        continue
                    }

                    //main
                    //get idx
                    let colIdx = null;
                    LCPlot.data_collections.forEach((c,i)=>{
                        if(c.id == target.collectionId){
                            colIdx = i;
                        }
                    })

                    if(colIdx==null){
                        continue
                    }

                    //get data
                    let nIdx = null;
                    let dIdx = null;
                    LCPlot.data_collections[colIdx].datasets.forEach((d,i)=>{
                        if(d.id == target.numeratorId){
                            nIdx = i;
                        }
                        if(d.id == target.denominatorId){
                            dIdx = i;
                        }
                    })

                    if(nIdx==null && dIdx==null){
                        continue
                    }

                    let ageMod = 1;
                    if(depthScale == "age"){
                        ageMod = age_correction;
                    }
                    let x0 = [];
                    let y0 = [];

                    let numeratorName = "";
                    let denominatorName = "";
                    let numeratorUnit = "";
                    let denominatorUnit = "";
                    if(nIdx!==null && dIdx!==null){
                        //normarise by values
                        const numeratorSeries   = LCPlot.data_collections[colIdx].datasets[nIdx].data_series;//[id,name,age,...]
                        const denominatorSeries = LCPlot.data_collections[colIdx].datasets[dIdx].data_series;//[id,name,age,...]
                        numeratorName = LCPlot.data_collections[colIdx].datasets[nIdx].name;
                        denominatorName = " / "+LCPlot.data_collections[colIdx].datasets[dIdx].name;
                        denominatorUnit = " / "+LCPlot.data_collections[colIdx].datasets[dIdx].unit;
                        for(let i=0;i<numeratorSeries.length;i++){
                            const y = numeratorSeries[i][depthScale]!==null ? numeratorSeries[i][depthScale]*ageMod : NaN;
                            let x = NaN;
                            if(numeratorSeries[i].data !== null && denominatorSeries[i].data!==null){
                                x = numeratorSeries[i].data / denominatorSeries[i].data;
                            }else{
                                x = NaN;
                            }
                            
                            x0.push(x);
                            y0.push(y);                            
                        }
                    }else{
                        if(nIdx!==null){
                            //without normarisation
                            const numeratorSeries = LCPlot.data_collections[colIdx].datasets[nIdx].data_series;//[id,name,age,...]
                            numeratorName = LCPlot.data_collections[colIdx].datasets[nIdx].name;
                            numeratorUnit = LCPlot.data_collections[colIdx].datasets[nIdx].unit;
                            for(let i=0;i<numeratorSeries.length;i++){
                                const y = numeratorSeries[i][depthScale]!==null ? numeratorSeries[i][depthScale]*ageMod : NaN;
                                const x = numeratorSeries[i].data!==null ? numeratorSeries[i].data : NaN;
                                x0.push(x);
                                y0.push(y);                            
                            }
                        }else if(dIdx!==null){
                            //without normarisation
                            const denominatorSeries = LCPlot.data_collections[colIdx].datasets[dIdx].data_series;//[id,name,age,...]
                            numeratorName = "1";
                            numeratorUnit = "1";
                            denominatorName = " / "+LCPlot.data_collections[colIdx].datasets[dIdx].name;
                            denominatorUnit = " / "+LCPlot.data_collections[colIdx].datasets[dIdx].unit;
                            for(let i=0;i<denominatorSeries.length;i++){
                                const y = denominatorSeries[i][depthScale]!==null ? denominatorSeries[i][depthScale]*ageMod : NaN;
                                const x = denominatorSeries[i].data!==null ? 1/denominatorSeries[i].data : NaN;
                                x0.push(x);
                                y0.push(y);                            
                            }
                        }
                    }

                    if(x0.length==0){
                        continue
                    }

                    //calc zoom rate                 
                    const x = x0;
                    const y = y0;
                    // Avoid Math.min(...array) / Math.max(...array) for large datasets to prevent
                    // stack overflow caused by argument spreading. Compute min/max in a single　iteration instead.
                    //const xmin = Math.min(...x.filter(Number.isFinite));
                    //const xmax = Math.max(...x.filter(Number.isFinite));
                    let xmin = Infinity, xmax = -Infinity;
                    for (let v, i = 0; i < x.length; i++) {
                    v = x[i];
                    if (!Number.isFinite(v)) continue;
                    if (v < xmin) xmin = v;
                    if (v > xmax) xmax = v;
                    }
                    if (xmin === Infinity) { xmin = 0; xmax = 1; } 
                    let dataWidth = xmax-xmin;
                    if(dataWidth==0){
                        dataWidth = 1;
                    }
                    let mod = [defWidth/dataWidth, 1];

                    //draw plot
                    if(target.plotType =="line"){
                        sketch.strokeWeight(1);
                        sketch.stroke(target.colour);        
                        for(let i=0; i<x.length-1;i++){
                            const x1 = pad[0] + ((x[i] -xmin)  * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                            const y1 = pad[1] + (y[i]   * zoom_rate[1]);
                            const x2 = pad[0] + ((x[i+1] - xmin) * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                            const y2 = pad[1] + (y[i+1] * zoom_rate[1]);
                            if(
                                typeof x1 === 'number' && !isNaN(x1) &&
                                typeof y1 === 'number' && !isNaN(y1) &&
                                typeof x2 === 'number' && !isNaN(x2) &&
                                typeof y2 === 'number' && !isNaN(y2)
                            ){
                                sketch.line(x1,y1,x2,y2)
                            }                            
                        }
                    }else if(target.plotType == "scatter"){
                        //sketch.strokeWeight(1);
                        //sketch.stroke(target.colour);
                        sketch.push();
                        sketch.noStroke();
                        sketch.fill(target.colour);
                              
                        for(let i=0; i<x.length;i++){
                            sketch.ellipse(
                                pad[0] + ((x[i] - xmin) * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order,
                                pad[1] + (y[i]   * zoom_rate[1]),
                                8
                            );  
                        }          
                        sketch.pop();              
                    }else if(target.plotType == "bar"){
                        sketch.push();
                        sketch.noStroke();
                        sketch.fill(target.colour);                        

                        for(let i=0; i<x.length;i++){
                            let rectX0 = pad[0] + ((0-xmin)      * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                            let rectX1 = pad[0] + ((x[i]-xmin)   * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                            let rectY  = pad[1] + (y[i]   * zoom_rate[1]);
                            let rectY0 = rectY -2;
                            let rectY1 = rectY +2;
                            if(0>xmax){
                                rectX0 = pad[0] + ((xmax-xmin) * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                            }
                            if(0<xmin){
                                rectX0 = pad[0] + ((xmin-xmin) * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                            }
                            
                            sketch.rect(
                                rectX0,
                                rectY0,
                                rectX1 - rectX0,
                                rectY1-rectY0,
                            );  
                        }          
                        sketch.pop(); 

                    }
                    

                    //draw grid                    
                    let precision = 1;
                    if(isGrid){
                        //calc pos
                        const numXGrids = 5;
                        let rawInterval = dataWidth / numXGrids;

                        let precision = Math.pow(10, Math.floor(Math.log10(rawInterval)));
                        let interval = precision * Math.round(rawInterval/precision);
                        const xstart = Math.floor(xmin / interval) * interval;
                        const xend = Math.ceil(xmax / interval) * interval;

                        const gridPositions = [];
                        for (let pos = xstart; pos <= xend; pos += interval) {
                            gridPositions.push(pos);
                        }

                        //x axis--------------------------------------------
                        //baseline
                        sketch.strokeWeight(2);
                        sketch.stroke("Gray");
                        sketch.line(
                            pad[0] + ((gridPositions[0] - xmin)   * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order,
                            100    + scroller.scrollTop,
                            pad[0] + ((gridPositions[gridPositions.length-1] - xmin) * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order,
                            100    + scroller.scrollTop,
                        )
                        //tick
                        gridPositions.forEach(p=>{
                            sketch.line(
                               pad[0] + ((p - xmin)  * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order,
                               100    + scroller.scrollTop,
                               pad[0] + ((p - xmin)  * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order,
                               100    + scroller.scrollTop - 10,
                            )
                        })
                        //tick label
                        const tickX0 = pad[0] + ((gridPositions[0] - xmin)  * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                        const tickX1 = pad[0] + ((gridPositions[gridPositions.length-1] - xmin)  * zoom_rate[0] * mod[0] * target.amplification) + seriesDistance * zoom_rate[2] * target.order;
                        const tickY0 = 100    + scroller.scrollTop - 15;
                        sketch.noStroke();
                        sketch.text(
                            Math.round(gridPositions[0]/precision)*precision.toString(),
                            tickX0,
                            tickY0,
                        );
                        sketch.text(
                            Math.round(gridPositions[gridPositions.length-1]/precision)*precision.toString(),
                            tickX1,
                            tickY0,
                        );
                        const unit = "["+numeratorUnit+denominatorUnit+"]";
                        const title = numeratorName+denominatorName;
                        sketch.textSize(15);
                        sketch.text(
                            title +" "+ unit,
                            tickX0 + (tickX1-tickX0-sketch.textWidth(title+" "+unit))/2,
                            tickY0 - 20,
                        );

                        //y axis--------------------------------------------
                        const numYGrids = 10;
                        rawInterval = scroller.clientHeight/zoom_rate[1]/100/numYGrids;
                        precision = Math.pow(10, Math.floor(Math.log10(rawInterval)));
                        
                        const ystart = Math.floor((scroller.scrollTop-pad[1])/zoom_rate[1]/100 / precision) * precision;
                        const yend = Math.ceil((scroller.scrollTop-pad[1]+scroller.clientHeight)/zoom_rate[1]/100 / precision) * precision;

                        const gridYPositions = [];
                        for (let pos = ystart; pos <= yend; pos += precision) {
                            gridYPositions.push(pos);
                        }
                        sketch.strokeWeight(2);
                        sketch.stroke("Gray");
                        gridYPositions.forEach(g=>{
                            sketch.line(
                                pad[0] - 10 + scroller.scrollLeft,
                                pad[1] + g*100 * zoom_rate[1],
                                pad[0] - 30 + scroller.scrollLeft,
                                pad[1] + g*100 * zoom_rate[1],
                            )
                        })
                        sketch.noStroke();
                        gridYPositions.forEach(g=>{
                            let val = g;
                            let prec = 1;
                            if(depthScale=="age"){
                                val = val  * 100 * 1/ageMod;
                                prec = 0;
                            }
                            
                            sketch.text(
                                val.toFixed(prec),
                                pad[0] - 40 + scroller.scrollLeft - sketch.textWidth(val.toFixed(1) + " m"),
                                pad[1] + g*100 * zoom_rate[1],
                            )
                        })
                        
                        sketch.push();
                        sketch.translate(
                            scroller.scrollLeft + 40,
                            scroller.scrollTop + scroller.clientHeight / 2
                            );
                        sketch.rotate((-90 / 180) * Math.PI);
                        let scale_label = "";
                        if(depthScale=="age"){
                            scale_label = "Age [calBP]";
                        }else if(depthScale=="composite_depth"){
                            scale_label = "Composite depth [m]";
                        }else if(depthScale=="event_free_depth"){
                            scale_label = "Event Free depth [m]";
                        }else if(depthScale=="drilling_depth"){
                            scale_label = "Drilling depth [m]";
                        }

                        sketch.text(scale_label, 0, 0);
                        sketch.pop();
                        
                    }
                    


                }
                sketch.pop();
            }                        
        }    
        //draw data ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        sketch.windowResized = () => {
            //sketch.resizeCanvas(scroller.clientWidth, scroller.clientHeight);
            if (sketch._resizing) return;
            const w = scroller.clientWidth, h = scroller.clientHeight;
            if (w === sketch.width && h === sketch.height) return;
            sketch._resizing = true;
            sketch.resizeCanvas(w, h);
            sketch._resizing = false;
        };
    }
    function sendToRenderer(type){
        let selectedList = getSelectedData();
        window.PlotterApi.sendPlotOptions({data:selectedList, emitType:type}, "renderer");
    }
    //============================================================================

});

