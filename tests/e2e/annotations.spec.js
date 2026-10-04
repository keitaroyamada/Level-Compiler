const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const { launchApp, closeElectronApp, clickMenuItemByLabel, ROOT_DIR, FIXTURE_PATHS } = require("./helpers/app");

async function interceptContextMenu(electronApp, choice = null) {
  await electronApp.evaluate(({ Menu }, label) => {
    global.__ANNOTATION_MENU_CHOICE__ = label;
    if (global.__ANNOTATION_MENU_INTERCEPTED__) return;
    global.__ANNOTATION_MENU_INTERCEPTED__ = true;
    Menu.prototype.popup = function (options) {
      const items = [];
      const visit = menu => {
        for (const item of menu.items) {
          items.push(item);
          if (item.submenu) visit(item.submenu);
        }
      };
      visit(this);
      global.__ANNOTATION_MENU_LABELS__ = items.map(item => item.label);
      const selected = items.find(item => item.label === global.__ANNOTATION_MENU_CHOICE__);
      if (selected) selected.click(selected, options.window);
      options.callback?.();
    };
  }, choice);
}

async function loadFixture(page, includeAge = false) {
  await page.evaluate(async ({ paths, includeAge }) => {
    await window.__LC_E2E__.loadLcModelFromPath(paths.lcmodel);
    if (includeAge) await window.__LC_E2E__.dropAgeModelFromPath(paths.ageCsv);
  }, { paths: FIXTURE_PATHS, includeAge });
  if (includeAge) {
    await expect(page.locator("#lcModalDialog .lc-dialog-message")).toContainText("inverted chronological order");
    await page.locator("#lcModalDialog button[type='submit']").click();
    await expect(page.locator("#lcModalDialog")).not.toBeVisible();
  }
  await page.locator("#YAxisSelect").selectOption("drilling_depth");
}

function annotationTarget() {
  const { model: LCCore, options: objOpts, canvasPos } = window.__LC_E2E__.getAnnotationTestData();
  const scroller = document.getElementById("scroller");
  const depthScale = objOpts.canvas.depth_scale;
  const xMag = objOpts.canvas.dpir * objOpts.canvas.zoom_level[0];
  let yMag = objOpts.canvas.dpir * objOpts.canvas.zoom_level[1];
  let padY = objOpts.canvas.pad_y;
  if (depthScale === "age") {
    yMag *= objOpts.canvas.age_zoom_correction[0];
    padY += objOpts.canvas.age_zoom_correction[1];
  }
  const rect = document.getElementById("p5Canvas").getBoundingClientRect();
  const numDisable = { total: 0, hole: 0 };
  for (const project of LCCore?.projects ?? []) {
    if (!project.enable) numDisable.hole += objOpts.project.interval;
    for (const hole of project.holes) {
      if (!hole.enable) { numDisable.hole += 1; continue; }
      const holeX0 = (objOpts.hole.distance + objOpts.hole.width) *
        (numDisable.total + hole.order - numDisable.hole);
      for (const section of hole.sections) {
        const markers = section.markers ?? [];
        const top = markers[0]?.[depthScale];
        const bottom = markers[markers.length - 1]?.[depthScale];
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || top === bottom) continue;
        const depth = (top + bottom) / 2;
        const x = (holeX0 + objOpts.section.width / 2 + objOpts.canvas.shift_x) * xMag + objOpts.canvas.pad_x;
        const y = (depth + objOpts.canvas.shift_y) * yMag + padY;
        return { sectionId: section.id, depth, depthScale,
          yMag,
          scrollSynchronized: canvasPos[0] === scroller.scrollLeft && canvasPos[1] === scroller.scrollTop,
          x: rect.left + x - canvasPos[0], y: rect.top + y - canvasPos[1] };
      }
    }
    numDisable.total += project.holes.length + objOpts.project.interval;
  }
  return null;
}

async function captureAnnotationText(page) {
  await page.evaluate(() => {
    window.__ANNOTATION_DRAWN_TEXT__ = [];
    window.__ANNOTATION_TEXT_POSITIONS__ = {};
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...args) {
      if (this.canvas.parentElement?.id === "p5penCanvas") {
        const matrix = this.getTransform();
        const ratio = this.canvas.width / this.canvas.getBoundingClientRect().width;
        const label = String(text);
        window.__ANNOTATION_DRAWN_TEXT__.push(label);
        window.__ANNOTATION_TEXT_POSITIONS__[label] = {
          x: (matrix.a * x + matrix.c * y + matrix.e) / ratio,
          y: (matrix.b * x + matrix.d * y + matrix.f) / ratio,
        };
      }
      return original.call(this, text, x, y, ...args);
    };
  });
}

async function target(page) {
  const point = await page.evaluate(annotationTarget);
  await page.evaluate(point => {
    const scroller = document.getElementById("scroller");
    const rect = document.getElementById("p5Canvas").getBoundingClientRect();
    scroller.scrollBy(point.x - rect.left - scroller.clientWidth / 2,
      point.y - rect.top - scroller.clientHeight / 2);
  }, point);
  await expect.poll(async () => {
    const point = await page.evaluate(annotationTarget);
    return page.evaluate(point => {
      const rect = document.getElementById("scroller").getBoundingClientRect();
      return point.scrollSynchronized && point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom;
    }, point);
  }).toBe(true);
  return page.evaluate(annotationTarget);
}

async function choose(page, app, label, point) {
  await interceptContextMenu(app, label);
  await page.mouse.click(point.x, point.y, { button: "right" });
  if (label === "Add (Shift-click to continue)" || label === "Delete") {
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().mode)).toBe(
      label === "Delete" ? "annotation_delete" : "annotation_add"
    );
  }
}

async function submitMemo(page, point, memo, shift = false) {
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.click(point.x, point.y);
  if (shift) await page.keyboard.up("Shift");
  await expect(page.locator("#lcModalDialog textarea")).toBeVisible();
  await page.locator("#lcModalDialog textarea").fill(memo);
  await page.locator("#lcModalDialog button[type='submit']").click();
  await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().processing)).toBe(false);
}

test("annotation menus and Shift input, cancellation, deletion and clear preserve the model", async () => {
  const { electronApp, firstWindow: page, runtimeIssueMonitor } = await launchApp();
  try {
    await loadFixture(page);
    await interceptContextMenu(electronApp);
    for (const type of ["normalContextMenu", "holeContextMenu", "sectionContextMenu", "editContextMenu"]) {
      await page.evaluate(type => window.LCapi.showContextMenu({ type }), type);
      const labels = await electronApp.evaluate(() => global.__ANNOTATION_MENU_LABELS__);
      expect(labels).toEqual(expect.arrayContaining(["Annotation", "Add (Shift-click to continue)", "Delete", "Clear all"]));
    }
    const before = await page.evaluate(async () => Array.from(await window.LCapi.LoadModelFromLCCore()));
    let point = await target(page);
    // Browser mouse events use integral client coordinates, unlike the projected midpoint.
    const expected = await page.evaluate(point => window.LCapi.GetAnnotationPosition({
      ...point, depth: point.depth + (Math.floor(point.y) - point.y) / point.yMag,
    }), point);
    expect(Number.isFinite(expected.distance)).toBe(true);
    await choose(page, electronApp, "Add (Shift-click to continue)", point);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().mode)).toBe("annotation_add");
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records)).toEqual([]);

    await submitMemo(page, point, "日本語メモ\nsecond line", true);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(1);
    let state = await page.evaluate(() => window.__LC_E2E__.getAnnotationState());
    expect(state.mode).toBe("annotation_add");
    expect(state.records[0]).toEqual({ ...expected, distance: state.records[0].distance, memo: "日本語メモ\nsecond line" });
    expect(state.records[0].distance).toBeCloseTo(expected.distance, 10);
    expect(Object.keys(state.records[0]).sort()).toEqual(["distance", "hole", "memo", "project", "section"]);

    await page.keyboard.down("Shift");
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up("Shift");
    await expect(page.locator("#lcModalDialog textarea")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().mode)).toBe("annotation_add");
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(1);
    await submitMemo(page, point, "", false);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().mode)).toBe("");
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().regions.length)).toBe(2);

    await choose(page, electronApp, "Delete", point);
    const canvasRect = await page.locator("#p5Canvas").boundingBox();
    state = await page.evaluate(() => window.__LC_E2E__.getAnnotationState());
    const hit = state.regions[state.regions.length - 1];
    // Memo text is not a deletion target, even when notes overlap.
    await page.mouse.click(canvasRect.x + hit.right + 8, point.y);
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().mode)).toBe("annotation_delete");
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(2);
    await expect(page.locator("#lcModalDialog")).not.toBeVisible();
    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(1));
    await page.mouse.click(point.x + 10, point.y);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().mode)).toBe("");
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(2);
    await choose(page, electronApp, "Delete", point);
    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(0));
    await page.mouse.click(point.x + 10, point.y);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(1);
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records[0].memo)).toBe("日本語メモ\nsecond line");
    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(1));
    await choose(page, electronApp, "Clear all", point);
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(1);
    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(0));
    await choose(page, electronApp, "Clear all", point);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(0);
    const after = await page.evaluate(async () => Array.from(await window.LCapi.LoadModelFromLCCore()));
    expect(after).toEqual(before);
  } finally {
    await closeElectronApp(electronApp, page, runtimeIssueMonitor);
  }
});

test("annotations follow depth axes, zoom and scrolling in normal and edit modes", async () => {
  const { electronApp, firstWindow: page, runtimeIssueMonitor } = await launchApp();
  try {
    await loadFixture(page, true);
    await captureAnnotationText(page);
    let point = await target(page);
    await choose(page, electronApp, "Add (Shift-click to continue)", point);
    await submitMemo(page, point, "Axis tracking");
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().regions.length)).toBe(1);
    const record = await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records[0]);
    for (const scale of ["composite_depth", "event_free_depth", "age", "drilling_depth"]) {
      await page.locator("#YAxisSelect").selectOption(scale);
      const expected = await page.evaluate(({ record, scale }) =>
        window.LCapi.GetAnnotationDepths({ records: [record], depthScale: scale }), { record, scale });
      expect(expected[0]).not.toBeNull();
      await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().depths)).toEqual(expected);
      const anchor = await page.evaluate(annotationTarget);
      expect(anchor.sectionId).toEqual(expected[0].sectionId);
      const canvasRect = await page.locator("#p5Canvas").boundingBox();
      const expectedY = anchor.y - canvasRect.y + (expected[0].depth - anchor.depth) * anchor.yMag;
      await expect.poll(() => page.evaluate(() =>
        Object.entries(window.__ANNOTATION_TEXT_POSITIONS__).find(([label]) => label.endsWith(":Axis tracking"))?.[1].y - 4
      )).toBeCloseTo(expectedY, 4);
      const hit = (await page.evaluate(() => window.__LC_E2E__.getAnnotationState())).regions[0];
      expect(hit.right - hit.left).toBe(20);
      expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records[0])).toEqual(record);
    }
    point = await target(page);
    const drawnY = () => page.evaluate(() =>
      Object.entries(window.__ANNOTATION_TEXT_POSITIONS__).find(([label]) => label.endsWith(":Axis tracking"))?.[1].y - 4
    );
    const oldY = await drawnY();
    await page.evaluate(() => document.getElementById("scroller").scrollBy(0, 20));
    await expect.poll(drawnY).toBeCloseTo(oldY - 20, 5);
    await page.locator("#bt_zoomin").click();
    await expect.poll(drawnY).not.toBeCloseTo(oldY - 20, 5);

    await electronApp.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find(window => window.getTitle() === "Level Compiler").webContents.send("EditCorrelation");
    });
    await expect(page.locator("#lcModalDialog input[type='password']")).toBeVisible();
    await page.locator("#lcModalDialog input[type='password']").fill("admin");
    await page.locator("#lcModalDialog button[type='submit']").click();
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getEditCommandState().editable)).toBe(true);
    point = await target(page);
    const before = await page.evaluate(async () => Array.from(await window.LCapi.LoadModelFromLCCore()));
    await choose(page, electronApp, "Add (Shift-click to continue)", point);
    await submitMemo(page, point, "Edit mode");
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(2);
    expect(await page.evaluate(async () => Array.from(await window.LCapi.LoadModelFromLCCore()))).toEqual(before);
    await page.locator("#bt_pen").click();
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().penEnabled)).toBe(true);
    const patch = { x: point.x - 50, y: point.y + 25, width: 45, height: 50 };
    const readPenPatch = () => page.evaluate(patch => {
      const canvas = document.querySelector("#p5penCanvas canvas");
      const rect = canvas.getBoundingClientRect();
      const ratio = canvas.width / rect.width;
      return Array.from(canvas.getContext("2d").getImageData(
        (patch.x - rect.left) * ratio, (patch.y - rect.top) * ratio,
        patch.width * ratio, patch.height * ratio
      ).data);
    }, patch);
    await page.mouse.move(point.x - 40, point.y + 35);
    await page.mouse.down();
    await page.mouse.move(point.x - 15, point.y + 60, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => (await readPenPatch()).some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    // Compare persisted strokes after a redraw, rather than the last live preview frame.
    await page.locator("#bt_pen").click();
    await page.locator("#bt_pen").click();
    const penPixels = await readPenPatch();
    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(0));
    await choose(page, electronApp, "Clear all", point);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(0);
    // Redrawing transformed strokes can vary edge antialiasing. Compare their silhouette.
    const silhouette = pixels => pixels.filter((_, index) => index % 4 === 3).map(alpha => alpha > 32);
    expect(silhouette(await readPenPatch())).toEqual(silhouette(penPixels));
    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(0));
    await page.keyboard.press("Control+n");
    await expect.poll(async () => (await readPenPatch()).some((value, index) => index % 4 === 3 && value > 0)).toBe(false);
    await page.locator("#bt_pen").click();
    expect(await page.locator("#p5penCanvas").isVisible()).toBe(false);
  } finally {
    await closeElectronApp(electronApp, page, runtimeIssueMonitor);
  }
});

test("annotation CSV import/export preserves notes and model, with normal-mode menus and distance labels", async () => {
  const { electronApp, firstWindow: page, runtimeIssueMonitor } = await launchApp();
  const outputPath = path.join(ROOT_DIR, "tests", "temp", `annotations-${Date.now()}.csv`);
  const invalidPath = outputPath.replace(/\.csv$/, "-invalid.csv");
  const masterPath = outputPath.replace(/\.csv$/, "-master.csv");
  try {
    const exportMenu = () => electronApp.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu().items.find(item => item.label === "File")
        .submenu.items.find(item => item.label === "Export");
      return { visible: menu.visible, enabled: menu.enabled,
        items: menu.submenu.items.map(item => ({ label: item.label, enabled: item.enabled, visible: item.visible })) };
    });
    const enabledNormalItems = ["Export annotations as CSV", "Export master section list"];
    let menu = await exportMenu();
    expect(menu.visible).toBe(true);
    expect(menu.enabled).toBe(true);
    expect(menu.items.filter(item => item.visible).map(item => item.label)).toEqual(enabledNormalItems);
    expect(menu.items.filter(item => item.visible).every(item => item.enabled)).toBe(true);
    await page.evaluate(() => window.LCapi.changeEditMode({ mode: true }));
    expect((await exportMenu()).items.every(item => item.enabled && item.visible)).toBe(true);
    await page.evaluate(() => window.LCapi.changeEditMode({ mode: false }));
    menu = await exportMenu();
    expect(menu.items.filter(item => item.visible).map(item => item.label)).toEqual(enabledNormalItems);
    expect(menu.items.filter(item => item.visible).every(item => item.enabled)).toBe(true);

    await electronApp.evaluate(({ dialog }, outputPath) => {
      global.__ANNOTATION_SAVE_CALLS__ = 0;
      global.__ANNOTATION_OPEN_CALLS__ = 0;
      global.__ANNOTATION_SAVE_CANCELED__ = false;
      global.__ANNOTATION_SAVE_PATH__ = outputPath;
      global.__ANNOTATION_OPEN_PATH__ = outputPath;
      dialog.showSaveDialog = async () => {
        global.__ANNOTATION_SAVE_CALLS__++;
        return { canceled: global.__ANNOTATION_SAVE_CANCELED__, filePath: global.__ANNOTATION_SAVE_PATH__ };
      };
      dialog.showOpenDialog = async () => {
        global.__ANNOTATION_OPEN_CALLS__++;
        return { canceled: !global.__ANNOTATION_OPEN_PATH__,
          filePaths: global.__ANNOTATION_OPEN_PATH__ ? [global.__ANNOTATION_OPEN_PATH__] : [] };
      };
    }, outputPath);
    await clickMenuItemByLabel(electronApp, "Export annotations as CSV");
    await expect(page.locator("#lcModalDialog .lc-dialog-message")).toContainText("no recorded annotations");
    await page.locator("#lcModalDialog button[type='submit']").click();
    expect(await electronApp.evaluate(() => global.__ANNOTATION_SAVE_CALLS__)).toBe(0);

    await loadFixture(page);
    const before = await page.evaluate(async () => Array.from(await window.LCapi.LoadModelFromLCCore()));
    await captureAnnotationText(page);
    const point = await target(page);
    const memo = '日本語, "quoted"\nsecond line';
    await choose(page, electronApp, "Add (Shift-click to continue)", point);
    await submitMemo(page, point, memo, true);
    await submitMemo(page, point, "");
    const records = await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records);
    expect(records).toHaveLength(2);
    await expect.poll(() => page.evaluate(() => window.__ANNOTATION_DRAWN_TEXT__)).toEqual(
      expect.arrayContaining([`[${records[0].distance.toFixed(2)} cm]:日本語, "quoted"`,
        `[${records[1].distance.toFixed(2)} cm]:`])
    );
    await clickMenuItemByLabel(electronApp, "Export annotations as CSV");
    await expect.poll(() => fs.existsSync(outputPath)).toBe(true);
    const bytes = fs.readFileSync(outputPath);
    expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const csv = parse(bytes.toString("utf8"), { bom: true, columns: true });
    expect(Object.keys(csv[0])).toEqual(["ID", "project", "hole", "section", "distance", "memo"]);
    expect(csv).toEqual(records.map((record, index) => ({
      ID: String(index + 1), project: record.project, hole: record.hole, section: record.section,
      distance: String(record.distance), memo: record.memo,
    })));

    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(0));
    await choose(page, electronApp, "Clear all", point);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records.length)).toBe(0);
    await clickMenuItemByLabel(electronApp, "Import annotations from CSV");
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records)).toEqual(records);
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().regions.length)).toBe(2);
    const imported = [...records.map(record => ({ ...record, memo: record.memo + " (imported)" })),
      { project: "Missing project", hole: "Missing hole", section: "Missing section", distance: 12.5, memo: "Undrawable note" }];
    fs.writeFileSync(invalidPath, stringify([
      ["ID", "project", "hole", "section", "distance", "memo"],
      ...imported.map((record, index) => ["note-" + index, record.project, record.hole, record.section, record.distance, record.memo]),
    ], { bom: true }), "utf8");
    await electronApp.evaluate((_electron, filePath) => { global.__ANNOTATION_OPEN_PATH__ = filePath; }, invalidPath);
    await page.evaluate(async () => {
      await window.LCapi.e2eGetAndClearDialogLog();
      await window.LCapi.e2ePushDialogResponse(1);
    });
    await clickMenuItemByLabel(electronApp, "Import annotations from CSV");
    await expect.poll(() => page.evaluate(() => window.LCapi.e2eGetAndClearDialogLog()))
      .toEqual(expect.arrayContaining([expect.objectContaining({ title: "Import annotations" })]));
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records)).toEqual(records);
    await page.evaluate(() => window.LCapi.e2ePushDialogResponse(0));
    await clickMenuItemByLabel(electronApp, "Import annotations from CSV");
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().records)).toEqual(imported);
    await expect(page.locator("#lcModalDialog .lc-dialog-message")).toContainText("1 annotation(s) could not be drawn");
    await page.locator("#lcModalDialog button[type='submit']").click();
    await expect.poll(() => page.evaluate(() => window.__LC_E2E__.getAnnotationState().regions.length)).toBe(2);
    expect(await page.evaluate(() => typeof window.LCapi.ImportAnnotationsFromCsv)).toBe("undefined");

    fs.writeFileSync(invalidPath, stringify([
      ["ID", "project", "hole", "section", "distance", "memo"],
      [1, records[0].project, records[0].hole, records[0].section, records[0].distance, "valid row"],
      [2, records[0].project, records[0].hole, records[0].section, "", "invalid distance"],
    ], { bom: true }), "utf8");
    await electronApp.evaluate((_electron, filePath) => { global.__ANNOTATION_OPEN_PATH__ = filePath; }, invalidPath);
    await clickMenuItemByLabel(electronApp, "Import annotations from CSV");
    await expect(page.locator("#lcModalDialog .lc-dialog-message")).toContainText("Invalid annotation CSV at row 3");
    await page.locator("#lcModalDialog button[type='submit']").click();
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records)).toEqual(imported);

    await electronApp.evaluate(() => {
      global.__ANNOTATION_OPEN_PATH__ = null;
      global.__ANNOTATION_SAVE_CANCELED__ = true;
    });
    const openCalls = await electronApp.evaluate(() => global.__ANNOTATION_OPEN_CALLS__);
    await clickMenuItemByLabel(electronApp, "Import annotations from CSV");
    await expect.poll(() => electronApp.evaluate(() => global.__ANNOTATION_OPEN_CALLS__)).toBe(openCalls + 1);
    expect(await page.evaluate(() => window.LCapi.ExportAnnotationsAsCsv(window.__LC_E2E__.getAnnotationState().records)))
      .toEqual({ ok: false, reason: "canceled" });
    expect(fs.readFileSync(outputPath)).toEqual(bytes);
    expect(await page.evaluate(() => window.__LC_E2E__.getAnnotationState().records)).toEqual(imported);
    expect(await page.evaluate(async () => Array.from(await window.LCapi.LoadModelFromLCCore()))).toEqual(before);
    await expect(page.locator("#lcModalDialog")).not.toBeVisible();

    // The shared writer's default remains unchanged for the existing MS export.
    await electronApp.evaluate((_electron, filePath) => {
      global.__ANNOTATION_SAVE_CANCELED__ = false;
      global.__ANNOTATION_SAVE_PATH__ = filePath;
    }, masterPath);
    await clickMenuItemByLabel(electronApp, "Export master section list");
    await expect.poll(() => fs.existsSync(masterPath)).toBe(true);
    const masterCsv = fs.readFileSync(masterPath, "utf8");
    expect(masterCsv.startsWith("\ufeff")).toBe(false);
    expect(masterCsv).toContain("\r\n");
    expect(parse(masterCsv)[0]).toEqual(["Master section", "Section top", "Section bottom", "Master top", "Master bottom"]);
  } finally {
    fs.rmSync(outputPath, { force: true });
    fs.rmSync(invalidPath, { force: true });
    fs.rmSync(masterPath, { force: true });
    await closeElectronApp(electronApp, page, runtimeIssueMonitor);
  }
});
