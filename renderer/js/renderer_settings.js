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
    let settingFields = {};
    let settingsMenuSignature = null;

    function formatSettingName(name) {
      return String(name)
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function formatSectionTitle(key, value) {
      const keyText = String(key);
      const baseTitle = /^\d+$/.test(keyText) ? `[${keyText}]` : formatSettingName(key);
      if (value && typeof value.name === "string" && value.name !== "") {
        return `${baseTitle} ${value.name}`;
      }
      return baseTitle;
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
    function updatePreferenceActions(options = {}) {
      const isPreferences = options.title === "Preferences";
      const isDeveloperMode = ["root", "developer"].includes(settings?.developer?.mode);
      document.getElementById("default").style.display = isPreferences ? "block" : "none";
      document.getElementById("open_settings_folder").style.display = isPreferences && isDeveloperMode ? "block" : "none";
    }

    function getOpenSettingsSections(container) {
      return new Set(
        Array.from(container?.querySelectorAll("details.settings-section[open][data-settings-path]") ?? [])
          .map((details) => details.dataset.settingsPath)
      );
    }

    function restoreOpenSettingsSections(container, openPaths) {
      for (const details of container?.querySelectorAll("details.settings-section[data-settings-path]") ?? []) {
        details.open = openPaths.has(details.dataset.settingsPath);
      }
    }

    function getValueAtPath(source, path) {
      return path.reduce((current, key) => current?.[key], source);
    }

    function setValueAtPath(source, path, value) {
      const lastKey = path[path.length - 1];
      const parent = path.slice(0, -1).reduce((current, key) => current?.[key], source);
      if (parent && Object.prototype.hasOwnProperty.call(parent, lastKey)) {
        parent[lastKey] = value;
      }
    }

    function getSettingsMenuSignature(data, editables, fields) {
      return JSON.stringify({
        keys: getSettingsShape(data),
        editables,
        fields,
      });
    }

    function getSettingsShape(value) {
      if (value === null || typeof value !== "object") {
        return typeof value;
      }

      if (Array.isArray(value)) {
        return value.map((child) => getSettingsShape(child));
      }

      const shape = {};
      for (const key of Object.keys(value)) {
        shape[key] = getSettingsShape(value[key]);
      }
      return shape;
    }

    function setInputDisplayValue(input, value) {
      if (document.activeElement === input) {
        return;
      }

      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = value;
      }
    }

    function updateMenuValues(nextSettings) {
      for (const input of document.querySelectorAll("input[data-settings-path], select[data-settings-path], textarea[data-settings-path]")) {
        const path = input.dataset.settingsPath.split(".");
        const value = getValueAtPath(nextSettings, path);
        if (value !== undefined) {
          setInputDisplayValue(input, value);
        }
      }
    }

    function createMenu(data, editables, container, depth = 0, fields = {}, path = []) {
      Object.entries(data).forEach(([key, value]) => {
        const fieldOptions = settingFieldsForKey(fields, key);
        const itemPath = [...path, key];
        let isEditableObj;
        if (typeof editables === "object"){
          isEditableObj = editables[key];
        }else{
          isEditableObj = editables;
        }

        if (typeof value === "object" && value !== null) {
          const details = document.createElement("details");
          details.classList.add("settings-section", `settings-depth-${Math.min(depth, 3)}`);
          details.dataset.settingsPath = itemPath.join(".");

          const summary = document.createElement("summary");
          summary.classList.add("settings-section-title");
          if (fieldOptions.description) {
            summary.title = fieldOptions.description;
          }

          const title = document.createElement("span");
          title.classList.add("settings-section-name");
          title.textContent = formatSectionTitle(key, value);

          const count = document.createElement("span");
          count.classList.add("settings-section-count");
          count.textContent = `${countLeafSettings(value)} items`;

          summary.appendChild(title);
          summary.appendChild(count);
          details.appendChild(summary);

          const childFields = fieldOptions;
          createMenu(value, isEditableObj, details, depth + 1, childFields, itemPath);
          container.appendChild(details);
        } else {
          const wrapper = document.createElement("div");
          wrapper.classList.add("settings-item", `settings-value-${getValueType(value)}`);
          if (fieldOptions.description) {
            wrapper.title = fieldOptions.description;
          }
          const label = document.createElement("label");
          label.textContent = formatSettingName(key);
          if (fieldOptions.description) {
            label.title = fieldOptions.description;
          }

          
          if (isEditable && isEditableObj) {
            const input = createInput(value, fieldOptions);
            input.dataset.settingsPath = itemPath.join(".");
            const field = document.createElement("div");
            field.classList.add("settings-field");
            input.addEventListener("change", () => {
              setValueAtPath(settings, itemPath, parseInputValue(input, value));
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
              updatePreferenceActions({ title: document.getElementById("title").textContent });
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
    function settingFieldsForKey(fields, key) {
      if (fields && typeof fields === "object" && fields[key] && typeof fields[key] === "object") {
        return fields[key];
      }
      return {};
    }
    function createInput(value, fieldOptions = {}) {
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
        
        
      if (typeof value === "string" && fieldOptions.type === "select" && Array.isArray(fieldOptions.options)) {
        input = document.createElement("select");
        fieldOptions.options.forEach(optionValue => {
          const option = document.createElement("option");
          option.value = optionValue;
          option.textContent = formatSettingName(optionValue);
          if (optionValue === value) {
            option.selected = true;
          }
          input.appendChild(option);
        });
      }else if (typeof value === "string" && isColor) {
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

        const nextSettings = receivedData.data;
        const nextSignature = getSettingsMenuSignature(
          nextSettings,
          receivedData.editable,
          receivedData.options.fields ?? {}
        );
        const shouldRebuildMenu = nextSignature !== settingsMenuSignature;

        settings = nextSettings;
        isEditable = receivedData.options.editable;
        settingFields = receivedData.options.fields ?? {};
        updatePreferenceActions(receivedData.options);
        const container = document.getElementById("menu-container");
        if (container) {
          if (shouldRebuildMenu) {
            const openPaths = getOpenSettingsSections(container);
            container.innerHTML = "";
            createMenu(settings,receivedData.editable, container, 0, settingFields);
            restoreOpenSettingsSections(container, openPaths);
            settingsMenuSignature = nextSignature;
          } else {
            updateMenuValues(settings);
          }
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
    document.getElementById("open_settings_folder").addEventListener("click", async () => {
      const result = await window.SettingsApi.openSettingsFolder();
      if (!result?.ok) {
        await window.SettingsApi.askdialog({
          opts: {
            title: "Open settings folder",
            message: result?.error || "Failed to open the settings folder.",
            parent: "settings",
          },
        });
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "F12") {
        window.SettingsApi.toggleDevTools("settings");
      }
    });
});
  
