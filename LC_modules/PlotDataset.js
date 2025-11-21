class PlotDataset {
  //private properties
  constructor() {
    this.id =  null;
    this.name =  null;
    this.correlation_model_version = null;
    this.age_model_version = null;
    this.descriptions = null;
    
    this.header = [];
    this.rows = []; //["name","project","hole","section","distance","composite_depth","event_free_depth","drilling_depth","age","age_upper","age_lower", "source_depth_type",...data]
  }
}
module.exports = { PlotDataset };
