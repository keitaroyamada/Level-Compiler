window.addEventListener("DOMContentLoaded", () => {
    let settings = {};
    let isEditable = false;

    function createMenu(data, editables, container) {
      Object.entries(data).forEach(([key, value]) => {
        let isEditableObj;
        if (typeof editables === "object"){
          isEditableObj = editables[key];
        }else{
          isEditableObj = editables;
        }

        if (typeof value === "object" && value !== null) {
          const details = document.createElement("details");
          const summary = document.createElement("summary");
          summary.textContent = key;
          summary.style.fontSize = "25px";
          details.style.fontSize = "20px";
          details.appendChild(summary);

          createMenu(value, isEditableObj, details);
          container.appendChild(details);
        } else {
          const wrapper = document.createElement("div");
          wrapper.classList.add("settings-item");
          const label = document.createElement("label");
          label.textContent = key;

          
          if (isEditable && isEditableObj) {
            const input = createInput(value);
            input.addEventListener("change", () => {
              data[key] = parseInputValue(input, value);
              const parentNames = [];
              let currentElement = wrapper.parentElement;
              while (currentElement && currentElement.tagName !== "BODY") {
                if (currentElement.tagName === "DETAILS") {
                  const summary = currentElement.querySelector("summary");
                  if (summary) parentNames.unshift(summary.textContent);
                }
                currentElement = currentElement.parentElement;
              }
              console.log("Updated: ", parentNames);
              window.SettingsApi.sendSettings({data: settings, editable:null, options:null}, "renderer");
            });
            wrapper.appendChild(label);
            wrapper.appendChild(input);
          } else {
            const textNode = document.createElement("span");
            textNode.textContent = value;
            label.style.fontSize = "25px";
            textNode.style.fontSize = "25px";
            wrapper.appendChild(label);
            wrapper.appendChild(textNode);
          }

          
          container.appendChild(wrapper);
        }
      });
    } 
    function createInput(value) {
      console.log(value, typeof value)
      let input;

      const isColor = (() => {
        const s = new Option().style;
        s.color = "";
        s.color = value;
        return s.color !== "";
      })();

      const fontOptions = [
        "Arial",
        "BIZ UD Gothic",
        "BIZ UD Mincho",
        "Bradley Hand",
        "Brush Script MT",
        "Comic Sans MS",
        "Consolas",
        "Courier New",
        "cursive",
        "Georgia",
        "Helvetica",
        "HanziPen SC",
        "HanziPen TC",
        "Hiragino Sans",
        "Lucida Handwriting",
        "Meiryo",
        "Menlo",
        "Monaco",
        "monospace",
        "sans-serif",
        "Segoe Print",
        "Segoe UI",
        "serif",
        "Snell Roundhand",
        "system-ui",
        "Tahoma",
        "Times New Roman",
        "UD Gothic",
        "UD Mincho",
        "Verdana",
        "Yu Gothic",
      ];

      let isString = false;
      if(value === null){
        isString = true;
      }
        
        
      if (typeof value === "string" && isColor) {
        const dummy = document.createElement("div");
        dummy.style.color = value;
        document.body.appendChild(dummy);
        const rgb = getComputedStyle(dummy).color;
        document.body.removeChild(dummy);
        
        const match = rgb.match(/\d+/g);
        let hex = "#000000";
        if (match && match.length >= 3) {
          hex = "#" + match.slice(0, 3).map(c => {
            const h = parseInt(c).toString(16);
            return h.length === 1 ? "0" + h : h;
          }).join("");
        }

        input = document.createElement("input");
        input.type = "color";
        input.value = hex;
      }else if(typeof value === "string" && fontOptions.includes(value)){
        input = document.createElement("select");
        fontOptions.forEach(font => {
          const option = document.createElement("option");
          option.value = font;
          option.textContent = font;
          option.style.fontFamily = font;
          if (font.toLowerCase() === value.toLowerCase()) {
            option.selected = true;
          }
          input.appendChild(option);
        });
      }else if (typeof value === "string" || isString) {
        input = document.createElement("input");
        input.type = "text";
        input.value = value;
      } else if (typeof value === "number") {
        input = document.createElement("input");
        input.type = "number";
        input.value = value;
      } else if (typeof value === "boolean") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.checked = value;
        input.style.marginTop = "15px";
        input.style.marginBottom = "15px";
      } else {
        console.log(value, typeof value)
      
        throw new Error("Unsupported type data detected.");
      }  

      //add event
      input.addEventListener("change", function(e){
        console.log("");
      });
      return input;
    }
    function parseInputValue(input, originalValue) {
      if (typeof originalValue === "string") {
        return input.value;
      } else if (typeof originalValue === "number") {
        return parseFloat(input.value);
      } else if (typeof originalValue === "boolean") {
        return input.checked;
      } else {
        return originalValue;
      }
    }
  
    
    //----------------------------------------------------------------
    window.SettingsApi.receive("SettingsData", async (receivedData) => {
      console.log("Received data: ", receivedData)

      document.getElementById("title").textContent = receivedData.options.title;

        if(receivedData.options.title=="Preferences"){
          document.getElementById("default").style.display = "block";
        }else{
        document.getElementById("default").style.display = "none";  
        }
          
        settings = receivedData.data;
        isEditable = receivedData.options.editable;
        const container = document.getElementById("menu-container");
        if (container) {
          container.innerHTML = "";
          createMenu(settings,receivedData.editable, container);
        }
    });

    document.getElementById("default").addEventListener("click", async (event) => {
      const response = await window.SettingsApi.askdialog(
        {
          title:"Initialise settings",
          message:"All settings will be reset. Do you want to restore them to their default values?",
          parent: "settings"
        }        
      );

      if (response.response) {
        window.SettingsApi.sendSettings(null,"renderer")
      }
      
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "F12") {
        window.SettingsApi.toggleDevTools("settings");
      }
    });
});
  