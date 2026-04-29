(function () {
  let activeDialog = null;

  function ensureDialog() {
    let backdrop = document.getElementById("lcModalDialog");
    if (backdrop) {
      return backdrop;
    }

    backdrop = document.createElement("div");
    backdrop.id = "lcModalDialog";
    backdrop.className = "lc-dialog-backdrop";
    backdrop.hidden = true;
    document.body.appendChild(backdrop);
    return backdrop;
  }

  function formatDecimal(value, fallback = 0, precision = 1) {
    const numberValue = Number(value);
    const safeValue = Number.isFinite(numberValue) ? numberValue : Number(fallback);
    return safeValue.toFixed(precision);
  }

  function parseDecimal(value, step = 0.1) {
    const numberValue = Number(String(value ?? "").trim());
    if (!Number.isFinite(numberValue)) {
      return NaN;
    }
    if (!Number.isFinite(step) || step <= 0) {
      return numberValue;
    }
    return Math.round(numberValue / step) * step;
  }

  function createInput(field) {
    if (field.type === "textarea") {
      const textarea = document.createElement("textarea");
      textarea.name = field.name;
      textarea.value = field.value ?? "";
      textarea.required = !!field.required;
      return textarea;
    }

    if (field.type === "select") {
      const select = document.createElement("select");
      select.name = field.name;
      select.required = !!field.required;
      for (const optionData of field.options ?? []) {
        const option = document.createElement("option");
        option.value = optionData.value;
        option.textContent = optionData.label ?? optionData.value;
        select.appendChild(option);
      }
      select.value = field.value ?? select.options[0]?.value ?? "";
      return select;
    }

    const input = document.createElement("input");
    input.name = field.name;
    input.type = field.type === "password" ? "password" : "text";
    input.value = field.value ?? "";
    input.required = !!field.required;
    if (field.type === "numberText") {
      input.inputMode = "decimal";
    }
    return input;
  }

  function setError(errorElement, message, focusElement = null) {
    errorElement.textContent = message;
    errorElement.hidden = false;
    if (focusElement) {
      focusElement.focus();
    }
  }

  function show(options) {
    if (activeDialog !== null) {
      return Promise.resolve(null);
    }

    const backdrop = ensureDialog();
    const form = document.createElement("form");
    form.className = "lc-dialog";
    form.autocomplete = "off";

    const header = document.createElement("div");
    header.className = "lc-dialog-header";
    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = options.title ?? "";
    titleWrap.appendChild(title);
    if (options.subtitle) {
      const subtitle = document.createElement("p");
      subtitle.textContent = options.subtitle;
      titleWrap.appendChild(subtitle);
    }
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "lc-dialog-icon-button";
    closeButton.title = "Cancel";
    closeButton.textContent = "x";
    header.appendChild(titleWrap);
    header.appendChild(closeButton);

    const body = document.createElement("div");
    body.className = "lc-dialog-body";
    const fields = {};
    const fieldRows = [];

    if (options.message) {
      const message = document.createElement("p");
      message.className = "lc-dialog-message";
      message.textContent = options.message;
      body.appendChild(message);
    }

    for (const field of options.fields ?? []) {
      if (field.type === "matrix") {
        const grid = document.createElement("div");
        grid.className = "lc-range-grid";
        const blank = document.createElement("div");
        blank.className = "lc-range-label";
        grid.appendChild(blank);
        for (const column of field.columns ?? []) {
          const head = document.createElement("div");
          head.className = "lc-range-head";
          head.textContent = column.label ?? "";
          grid.appendChild(head);
        }
        for (const row of field.rows ?? []) {
          const rowLabel = document.createElement("div");
          rowLabel.className = "lc-range-label";
          rowLabel.textContent = row.label ?? "";
          grid.appendChild(rowLabel);
          for (const childField of row.fields ?? []) {
            const childInput = createInput(childField);
            fields[childField.name] = childInput;
            grid.appendChild(childInput);
          }
        }
        body.appendChild(grid);
        continue;
      }

      const label = document.createElement("label");
      label.className = "lc-form-field";
      if (field.wide !== false) {
        label.classList.add("lc-form-field-wide");
      }
      if (field.visibleWhen) {
        label.dataset.visibleWhenField = field.visibleWhen.field;
        label.dataset.visibleWhenValues = field.visibleWhen.values.join(",");
      }
      const labelText = document.createElement("span");
      labelText.textContent = field.label ?? "";
      const input = createInput(field);
      fields[field.name] = input;
      label.appendChild(labelText);
      label.appendChild(input);
      body.appendChild(label);
      fieldRows.push(label);
    }

    const error = document.createElement("p");
    error.className = "lc-dialog-error";
    error.hidden = true;
    body.appendChild(error);

    const actions = document.createElement("div");
    actions.className = "lc-dialog-actions";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = options.cancelLabel ?? "Cancel";
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "lc-dialog-primary";
    submitButton.textContent = options.submitLabel ?? "OK";
    if (!options.hideCancel) {
      actions.appendChild(cancelButton);
    }
    actions.appendChild(submitButton);

    form.appendChild(header);
    form.appendChild(body);
    form.appendChild(actions);
    backdrop.replaceChildren(form);
    backdrop.hidden = false;

    const updateVisibility = () => {
      for (const row of fieldRows) {
        const controller = fields[row.dataset.visibleWhenField];
        if (!controller) {
          row.hidden = false;
          continue;
        }
        const values = row.dataset.visibleWhenValues.split(",");
        row.hidden = !values.includes(controller.value);
      }
    };
    updateVisibility();

    const firstField = fields[options.initialFocus] ?? Object.values(fields)[0];
    if (firstField) {
      firstField.focus();
      if (typeof firstField.select === "function") {
        firstField.select();
      }
    }

    activeDialog = new Promise(resolve => {
      const stopDialogEvent = event => event.stopPropagation();
      const cleanup = () => {
        form.removeEventListener("submit", handleSubmit);
        form.removeEventListener("click", stopDialogEvent);
        backdrop.removeEventListener("click", handleBackdropClick);
        backdrop.removeEventListener("mousemove", stopDialogEvent);
        backdrop.removeEventListener("mousedown", stopDialogEvent);
        backdrop.removeEventListener("wheel", stopDialogEvent);
        closeButton.removeEventListener("click", handleCancel);
        cancelButton.removeEventListener("click", handleCancel);
        document.removeEventListener("keydown", handleKeydown);
        for (const field of Object.values(fields)) {
          field.removeEventListener("input", updateVisibility);
          field.removeEventListener("change", updateVisibility);
        }
        backdrop.hidden = true;
        backdrop.replaceChildren();
        activeDialog = null;
      };
      const cancel = () => {
        cleanup();
        resolve(null);
      };
      const handleCancel = () => cancel();
      const handleBackdropClick = event => {
        event.stopPropagation();
        if (event.target === backdrop) {
          cancel();
        }
      };
      const handleKeydown = event => {
        if (event.key === "Escape") {
          cancel();
        }
      };
      const handleSubmit = event => {
        event.preventDefault();
        const values = {};
        for (const [name, field] of Object.entries(fields)) {
          if (field.closest("[hidden]")) {
            continue;
          }
          values[name] = field.value;
        }
        const validation = options.validate?.(values, fields);
        if (validation && validation.ok === false) {
          setError(error, validation.message ?? "Invalid input.", validation.field ? fields[validation.field] : null);
          return;
        }
        cleanup();
        resolve(validation?.values ?? values);
      };

      for (const field of Object.values(fields)) {
        field.addEventListener("input", updateVisibility);
        field.addEventListener("change", updateVisibility);
      }
      form.addEventListener("submit", handleSubmit);
      form.addEventListener("click", stopDialogEvent);
      backdrop.addEventListener("click", handleBackdropClick);
      backdrop.addEventListener("mousemove", stopDialogEvent);
      backdrop.addEventListener("mousedown", stopDialogEvent);
      backdrop.addEventListener("wheel", stopDialogEvent);
      closeButton.addEventListener("click", handleCancel);
      cancelButton.addEventListener("click", handleCancel);
      document.addEventListener("keydown", handleKeydown);
    });

    return activeDialog;
  }

  window.LCModal = {
    show,
    formatDecimal,
    parseDecimal,
  };
})();
