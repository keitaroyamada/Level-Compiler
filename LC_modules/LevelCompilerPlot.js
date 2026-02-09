const lcfnc = require("./lcfnc.js");

const { Project } = require("./Project.js");
const { Hole } = require("./Hole.js");
const { Section } = require("./Section.js");
const { Marker } = require("./Marker.js");
const { Trinity } = require("./Trinity.js");
const { PlotDataset } = require("./PlotDataset.js");

class LevelCompilerPlot {
  constructor() {
    this.data_collections = []; //dataRepository > dataCollection > dataset > data
    this.data_selected_id = null;

    this.draw_collections = []; //temporary dataset for renderer
  }

  //from new csv

  //methods
  initialiseDataCollection(){
    this.data_collections = [];
    this.draw_collections = [];
    this.data_selected_id = null;
  }
  addNewDataset(){
    const newDataset = new PlotDataset();
    if(!newDataset.id){
      newDataset.id = lcfnc.getUniqueId();
    }
    
    this.data_collections.push(newDataset);
  }
  addDataset(data) {
    /*
    call from main from converter

    const flatData = {
      id: null,
      name: null,
      correlation_model_version:null,
      age_model_version: null,
      descriptions: null,
      
      header: [],
      rows: [],
    };
    
    rows= ["id","name","project","hole","section","distance","composite_depth","event_free_depth","drilling_depth","age","age_upper","age_lower", "source_depth_type",...dataHeader] 
    */
    
    //add dataset
    if(!data.id){
      data.id = lcfnc.getUniqueId();
    }
    
    this.data_collections.push(data);
    
  }
  calcDataCollectionPosition(LCCore, LCAge) {
    const allowExtrapolation = true;

    if(this.data_collections.length == 0){
      return {ok: false, type: 1, reason: "There is no target data."}
    }

    //calc depth
    for (let c = 0; c < this.data_collections.length; c++) {

      const dataset = this.data_collections[c];
     
      if(dataset.rows.length==0){continue}
      const calcType = dataset.rows[0][12];//data source depth

      for (let r = 0; r < dataset.rows.length; r++) {
        const data = dataset.rows[r];
        /*
        0 "id"
        1 "name"
        2 "project"
        3 "hole"
        4 "section"
        5 "distance"
        6 "composite_depth"
        7 "event_free_depth"
        8 "drilling_depth"
        9 "age"
        10 "age_upper"
        11 "age_lower"
        12 "source_depth_type"
        13~...dataHeader]
        */

        //get info
        
        let targetProjectId = null;
        LCCore.projects.forEach(p=>{
          if(p.name === data[2]){
            targetProjectId = p.id;
          }
        })

        if(targetProjectId===null){continue}

        //calc
        if (calcType == "trinity") {
          let td = new Trinity();
          td.name         = data[1];
          td.project_name = data[2];
          td.hole_name    = data[3];
          td.section_name = data[4];
          td.distance     = parseFloat(data[5]);

          //calc
          const cd  = LCCore.getDepthFromTrinity( targetProjectId, [td], "composite_depth", allowExtrapolation );
          const efd = LCCore.getDepthFromTrinity( targetProjectId, [td], "event_free_depth", allowExtrapolation );
          const dd  = LCCore.getDepthFromTrinity( targetProjectId, [td], "drilling_depth", allowExtrapolation );
          const age = LCAge.getAgeFromEFD( efd[0][1], "linear" );

          //add
          data[6] = cd[0][1];
          data[7] = efd[0][1];
          data[8] = dd[0][1];
          data[9] = age.age.mid;
          data[10] = age.age.upper;
          data[11]= age.age.lower;
        } else if (calcType == "composite_depth") {
          //calc
          const efd = LCCore.getEFDfromCD( targetProjectId, data[6] );
          const age = LCAge.getAgeFromEFD( efd, "linear" );

          //add
          data[7] = efd;
          data[9] = age.age.mid;
          data[10]= age.age.upper;
          data[11]= age.age.lower;
        } else if (calcType == "event_free_depth") {
          //calc
          const cd  = LCCore.getCDfromEFD( targetProjectId, data[7] ); //paseudo
          const age = LCAge.getAgefromEFD( data[7] );

          //add
          data[6] = cd;
          data[9] = age.age.mid;
          data[10] = age.age.upper;
          data[11]= age.age.lower;
        } else if (calcType == "age") {
          //calc
          const efd = LCAge.getEFDFromAge( data[9], "linear" );          
          const cd  = LCCore.getCDfromEFD( efd ); //paseudo

          //add
          data[6] = cd;
          data[7] = efd;
        } else {
          continue;
        }
      }

      //sort
      this.sortDataBy(LCCore, c, calcType);

    }
    console.log("LCPlot: Data point CD/EFD/DD/Age are calculated.")
    return {ok: true, type: 0, reason: ""}
  }

  
  sortDataBy(LCCore, idx=0, target){
   /*
    0 "id"
    1 "name"
    2 "project"
    3 "hole"
    4 "section"
    5 "distance"
    6 "composite_depth"
    7 "event_free_depth"
    8 "drilling_depth"
    9 "age"
    10 "age_upper"
    11 "age_lower"
    12 "source_depth_type"
    13~...dataHeader]
    */

    const dataSet = this.data_collections[idx];
    console.log(target)
    if(target == "trinity"){
      //sort based on model
      const order    = {};
      LCCore.projects.forEach(project=>{
        project.holes.forEach(hole=>{
          order[hole.name] = [];
          hole.sections.forEach(sec=>{
            order[hole.name].push(sec.name);
          })
        })
      })
      const holeOrder = Object.keys(order);
      const holeIndex = new Map(holeOrder.map((v, i) => [v, i]));

      const sectionIndex = {};
      for (const h in order) {
        sectionIndex[h] = new Map(order[h].map((v, i) => [v, i]));
      }

      //sort
      dataSet.rows.sort((a, b) => {
        // hole
        const h =
          (holeIndex.get(a[3]) ?? Infinity) -
          (holeIndex.get(b[3]) ?? Infinity);
        if (h !== 0) return h;

        // section（each hole）
        const s =
          (sectionIndex[a[3]]?.get(a[4]) ?? Infinity) -
          (sectionIndex[b[3]]?.get(b[4]) ?? Infinity);
        if (s !== 0) return s;

        // distance
        return a[5] - b[5];
      });

    }else if(target == "trinity_name"){
      dataSet.rows.sort((a, b) => {
        if (a[3] !== b[3]) {
          return a[3].localeCompare(b[3]);
        }
        if (a[4] !== b[4]) {
          return a[4].localeCompare(b[4]);
        }
        return a[5] - b[5];
      });
    }else{
      let targetIdx = [6];
      if(target == "composite_depth"){
        targetIdx = [6];
      }else if(target == "event_free_depth"){
        targetIdx = [7];
      }else if(target == "age"){
        targetIdx = [9];
      }

      targetIdx.forEach(ti=>{
        dataSet.rows.sort((a, b) => {
          const x = Number(a[ti]);
          const y = Number(b[ti]);
          if (!Number.isFinite(x) && !Number.isFinite(y)) return 0;
          if (!Number.isFinite(x)) return 1;  
          if (!Number.isFinite(y)) return -1;
          return x - y;      
        });
      })
    }
   
    console.log("LCPlot: Plot Data is sorted by "+target);
  }

  /*  sortDataBy(target) {
    // 1. Select target column index
    let targetIdx;
    if (target === "composite_depth") {
      targetIdx = 6;
    } else if (target === "event_free_depth") {
      targetIdx = 7;
    } else if (target === "age") {
      targetIdx = 9;
    } else {
      console.warn(`LCPlot: Unknown sort target "${target}". Using composite_depth.`);
      targetIdx = 6;
    }

    // 2. Process each dataset
    for (let c = 0; c < this.data_collections.length; c++) {
      const dataSet = this.data_collections[c];
      const allRows = dataSet.rows;

      // skip empty datasets
      if (!Array.isArray(allRows) || allRows.length === 0) continue;

      // group by hole name
      const groupedByHole = {};
      for (const row of allRows) {
        const holeName = String(row[3]);
        if (!groupedByHole[holeName]) groupedByHole[holeName] = [];
        groupedByHole[holeName].push(row);
      }

      // 3. sort each group and flatten into a preallocated array
      const totalRows = allRows.length;
      const sortedAndFlattenedRows = new Array(totalRows);
      let offset = 0;

      for (const holeName in groupedByHole) {
        if (!Object.prototype.hasOwnProperty.call(groupedByHole, holeName)) continue;

        const rowsInHole = groupedByHole[holeName];

        rowsInHole.sort((a, b) => {
          const valA = a[targetIdx];
          const valB = b[targetIdx];

          if (!Number.isFinite(valA) && !Number.isFinite(valB)) return 0;
          if (!Number.isFinite(valA)) return 1;
          if (!Number.isFinite(valB)) return -1;

          return valA - valB;
        });

        for (let j = 0; j < rowsInHole.length; j++) {
          sortedAndFlattenedRows[offset++] = rowsInHole[j];
        }
      }

      // 4. replace dataset rows
      dataSet.rows = sortedAndFlattenedRows;
    }

    console.log(`LCPlot: Data sorted by ${target}.`);
  }
*/
 
}

module.exports = { LevelCompilerPlot };
