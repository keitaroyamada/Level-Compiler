window.addEventListener("DOMContentLoaded", () => {
    function mergeSettingsPatch(target, source) {
      for (const [key, value] of Object.entries(source)) {
        if (
          value !== null &&
          typeof value === "object" &&
          Array.isArray(value) === false &&
          target[key] !== null &&
          typeof target[key] === "object" &&
          Array.isArray(target[key]) === false
        ) {
          mergeSettingsPatch(target[key], value);
        } else {
          target[key] = value;
        }
      }
      return target;
    }

    let settingsReady = true;
    window.__LC_SETTINGS_E2E__ = {
      isReady() {
        return settingsReady;
      },
      getState() {
        return {
          title: document.title,
          itemCount: document.querySelectorAll(".settings-item").length,
        };
      },
      applySettingsPatch(patch) {
        settings = mergeSettingsPatch(structuredClone(settings), patch);
        window.SettingsApi.sendSettings({
          sendData: { data: settings, editable: null, options: null },
          to: "renderer",
        });
        return {
          ok: true,
          ...window.__LC_SETTINGS_E2E__.getState(),
        };
      },
    };

    let settings = {};
    let isEditable = false;

    function formatSettingName(name) {
      return String(name)
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function getValueType(value) {
      if (value === null) return "empty";
      if (typeof value === "boolean") return "boolean";
      if (typeof value === "number") return "number";
      if (typeof value === "string") {
        const s = new Option().style;
        s.color = "";
        s.color = value;
        return s.color !== "" ? "color" : "text";
      }
      return "text";
    }

    function countLeafSettings(value) {
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return 1;
      }
      return Object.values(value).reduce((count, child) => count + countLeafSettings(child), 0);
    }

    function createMenu(data, editables, container, depth = 0) {
      Object.entries(data).forEach(([key, value]) => {
        let isEditableObj;
        if (typeof editables === "object"){
          isEditableObj = editables[key];
        }else{
          isEditableObj = editables;
        }

        if (typeof value === "object" && value !== null) {
          const details = document.createElement("details");
          details.classList.add("settings-section", `settings-depth-${Math.min(depth, 3)}`);

          const summary = document.createElement("summary");
          summary.classList.add("settings-section-title");

          const title = document.createElement("span");
          title.classList.add("settings-section-name");
          title.textContent = formatSettingName(key);

          const count = document.createElement("span");
          count.classList.add("settings-section-count");
          count.textContent = `${countLeafSettings(value)} items`;

          summary.appendChild(title);
          summary.appendChild(count);
          details.appendChild(summary);

          createMenu(value, isEditableObj, details, depth + 1);
          container.appendChild(details);
        } else {
          const wrapper = document.createElement("div");
          wrapper.classList.add("settings-item", `settings-value-${getValueType(value)}`);
          const label = document.createElement("label");
          label.textContent = formatSettingName(key);

          
          if (isEditable && isEditableObj) {
            const input = createInput(value);
            const field = document.createElement("div");
            field.classList.add("settings-field");
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
              window.SettingsApi.sendSettings({
                sendData: {data: settings, editable:null, options:null},
                to: "renderer",
              });
            });
            wrapper.appendChild(label);
            field.appendChild(input);
            wrapper.appendChild(field);
          } else {
            const textNode = document.createElement("span");
            textNode.textContent = value;
            textNode.classList.add("settings-readonly-value");
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
        input.setAttribute("aria-label", "Color value");
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
          opts: {
            title:"Initialise settings",
            message:"All settings will be reset. Do you want to restore them to their default values?",
            parent: "settings"
          }
        }        
      );

      if (response.response) {
        window.SettingsApi.sendSettings({
          sendData: {data: null, editable:null, options:null},
          to: "renderer",
        })
      }
      
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "F12") {
        window.SettingsApi.toggleDevTools("settings");
      }
    });
});
  
