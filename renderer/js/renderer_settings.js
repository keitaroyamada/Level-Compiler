window.addEventListener("DOMContentLoaded", () => {
    let settings = {};
    function createMenu(data, container) {
      Object.entries(data).forEach(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          const details = document.createElement("details");
          const summary = document.createElement("summary");
          summary.textContent = key;
          summary.style.fontSize = "25px";
          details.appendChild(summary);
          createMenu(value, details);
          container.appendChild(details);
        } else {
          const wrapper = document.createElement("div");
          const label = document.createElement("label");
          label.textContent = key;
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

            console.log("Updated:", parentNames,settings);
            window.SettingsApi.sendSettings(settings,"renderer")
          });
          wrapper.appendChild(label);
          wrapper.appendChild(input);
          container.appendChild(wrapper);
        }
      });
    }
  
    function createInput(value) {
      let input;
      if (typeof value === "string") {
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
        throw new Error("Unsupported type data detected.", value);
      }
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
    window.SettingsApi.receive("SettingsData", async (data) => {

        console.log(data)
        settings = data;
        const container = document.getElementById("menu-container");
        if (container) {
        createMenu(settings, container);
        }
        
    });

    document.getElementById("default").addEventListener("click", async (event) => {
      const response = await window.SettingsApi.askdialog(
        "Initiarise settings",
        "All settings will be reset. Do you want to restore them to their default values?"
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
  