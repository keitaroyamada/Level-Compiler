document.addEventListener("DOMContentLoaded", () => {
    let LCPlot = null;
    let numSeries = 0;
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
    document.getElementById('bt_add').addEventListener("click", async (e) => {
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
        const seriesCheck = document.createElement("input");
        seriesDiv.style.paddingLeft = "0px";
        seriesCheck.type = "checkbox";
        seriesCheck.id = numSeries;
        seriesCheck.checked = true;
        const serieslabel = document.createElement("label");
        serieslabel.htmlFor = numSeries;
        serieslabel.textContent = LCPlot.data_collections[selectedIdx].name;
        const separatorlabel = document.createElement("label");
        separatorlabel.htmlFor = 0;
        separatorlabel.textContent = "/";
        const numeratorDropdown = document.createElement("select");
        numeratorDropdown.style.width = "80px";
        numeratorDropdown.style.marginRight = "5px";
        numeratorDropdown.id = numSeries;
        LCPlot.data_collections[selectedIdx].datasets.forEach(dataset=>{
            const option = document.createElement("option");
            option.value = dataset.id;
            option.textContent = dataset.name;
            numeratorDropdown.appendChild(option);
        })
        const denominatorDropdown = document.createElement("select");
        denominatorDropdown.style.width = "80px";
        denominatorDropdown.style.marginLeft = "5px";
        denominatorDropdown.id = numSeries;
        const option = document.createElement("option");
        option.value = 0;
        option.textContent = "1";
        denominatorDropdown.appendChild(option);
        LCPlot.data_collections[selectedIdx].datasets.forEach(dataset=>{
            const option = document.createElement("option");
            option.value = dataset.id;
            option.textContent = dataset.name;
            denominatorDropdown.appendChild(option);
        })

        //stack
        seriesDiv.appendChild(seriesCheck);
        //seriesDiv.appendChild(serieslabel);
        seriesDiv.appendChild(numeratorDropdown);
        seriesDiv.appendChild(separatorlabel);
        seriesDiv.appendChild(denominatorDropdown);
        container.appendChild(seriesDiv);

    
    });
    //============================================================================
    window.PlotterApi.receive("importedData", async (data) => {
        //load LCPlot
        LCPlot = data;
        console.log("[Plotter]: Imported data recieved.");
        console.log(LCPlot)

        //show
        LCPlot.data_collections.forEach(collection=>{
            const option = document.createElement("option");
            option.value = collection.id;
            option.textContent = collection.name;

            document.getElementById("c_collection").appendChild(option);
        });
    });  
});
