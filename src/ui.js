// src/ui.js
const Mode = {
  WIRE: "WIRE",
  DELETE: "DELETE",
  PLACE_HOUSE: "PLACE_HOUSE",
  PLACE_RES: "PLACE_RES",
  PLACE_TRANS: "PLACE_TRANS",
  PLACE_LED: "PLACE_LED",
  PLACE_CAP: "PLACE_CAP",
  PLACE_XFR: "PLACE_XFR",
};

// ---------------------------------------------------------------------------
// In-canvas overlay system. Replaces window.prompt()/window.confirm() (Phase
// 4 requirement — native dialogs are blocked in some embeds, painful on
// mobile, and just plain unfriendly to a kid) with big, obvious, tappable
// buttons rendered on the canvas itself.
// ---------------------------------------------------------------------------
function showChoiceOverlay(scene, { title, choices, onPick, onCancel }) {
  const W = scene.scale.width, H = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(500);

  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45)
    .setInteractive(); // blocks clicks from reaching the game underneath
  layer.add(dim);

  const panelW = Math.min(520, W - 60);
  const btnH = 56;
  const gap = 12;
  const panelH = 70 + choices.length * (btnH + gap) + 20;
  const cx = W / 2, cy = H / 2;

  const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0xffffff).setStrokeStyle(3, 0x0b1020);
  layer.add(panel);

  const titleText = scene.add.text(cx, cy - panelH / 2 + 30, title, {
    fontFamily: "Arial", fontSize: "20px", color: "#0b1020", fontStyle: "bold",
  }).setOrigin(0.5);
  layer.add(titleText);

  const close = () => { layer.destroy(); if (onCancel) onCancel(); };
  dim.on("pointerdown", close);

  choices.forEach((choice, i) => {
    const by = cy - panelH / 2 + 66 + i * (btnH + gap) + btnH / 2;
    const btn = scene.add.rectangle(cx, by, panelW - 40, btnH, 0xeef4ff).setStrokeStyle(2, 0x2b5fa8)
      .setInteractive({ useHandCursor: true });
    const label = scene.add.text(cx, by - (choice.sub ? 9 : 0), choice.label, {
      fontFamily: "Arial", fontSize: "17px", color: "#0b1020", fontStyle: "bold",
    }).setOrigin(0.5);
    layer.add([btn, label]);
    if (choice.sub) {
      const sub = scene.add.text(cx, by + 13, choice.sub, {
        fontFamily: "Arial", fontSize: "12px", color: "#445",
      }).setOrigin(0.5);
      layer.add(sub);
    }
    btn.on("pointerdown", (pointer, lx, ly, event) => {
      event.stopPropagation();
      layer.destroy();
      onPick(choice);
    });
  });

  return layer;
}

function showConfirmOverlay(scene, { title, message, confirmLabel = "Yes", cancelLabel = "No, keep it", onConfirm, danger = true }) {
  const W = scene.scale.width, H = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(500);

  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setInteractive();
  layer.add(dim);

  const panelW = Math.min(420, W - 60);
  const panelH = 190;
  const cx = W / 2, cy = H / 2;

  const panel = scene.add.rectangle(cx, cy, panelW, panelH, 0xffffff).setStrokeStyle(3, 0x0b1020);
  const titleText = scene.add.text(cx, cy - 60, title, {
    fontFamily: "Arial", fontSize: "19px", color: "#0b1020", fontStyle: "bold",
  }).setOrigin(0.5);
  const msgText = scene.add.text(cx, cy - 24, message, {
    fontFamily: "Arial", fontSize: "13px", color: "#333", align: "center", wordWrap: { width: panelW - 40 },
  }).setOrigin(0.5, 0);
  layer.add([panel, titleText, msgText]);

  const close = () => layer.destroy();
  dim.on("pointerdown", close);

  const yesBtn = scene.add.rectangle(cx - 90, cy + 60, 150, 46, danger ? 0xffdede : 0xeef4ff)
    .setStrokeStyle(2, danger ? 0xb02a2a : 0x2b5fa8).setInteractive({ useHandCursor: true });
  const yesText = scene.add.text(cx - 90, cy + 60, confirmLabel, { fontFamily: "Arial", fontSize: "14px", color: "#0b1020", fontStyle: "bold" }).setOrigin(0.5);
  const noBtn = scene.add.rectangle(cx + 90, cy + 60, 150, 46, 0xeeeeee).setStrokeStyle(2, 0x888888).setInteractive({ useHandCursor: true });
  const noText = scene.add.text(cx + 90, cy + 60, cancelLabel, { fontFamily: "Arial", fontSize: "13px", color: "#0b1020" }).setOrigin(0.5);
  layer.add([yesBtn, yesText, noBtn, noText]);

  yesBtn.on("pointerdown", (p, lx, ly, event) => { event.stopPropagation(); layer.destroy(); onConfirm(); });
  noBtn.on("pointerdown", (p, lx, ly, event) => { event.stopPropagation(); layer.destroy(); });

  return layer;
}

function buildUI(scene, state) {
  const W = scene.scale.width;

  scene.add.text(20, 12, "ECE City (Power Grid)", {
    fontFamily: "Arial", fontSize: "24px", color: "#0b1020",
  }).setDepth(200);

  const toolText = scene.add.text(20, 45, "Tool: WIRE", {
    fontFamily: "Arial", fontSize: "16px", color: "#0b1020",
  }).setDepth(200);

  function setToolLabel() {
    if (state.mode === Mode.PLACE_RES) toolText.setText(`Tool: RESISTOR (${state.placeResOhms.toFixed(0)}Ω)`);
    else if (state.mode === Mode.PLACE_CAP) toolText.setText(`Tool: CAPACITOR (${state.placeCapUF.toFixed(0)}µF)`);
    else if (state.mode === Mode.PLACE_XFR) toolText.setText(`Tool: TRANSFORMER (×${state.placeXfmrRatio.toFixed(2)})`);
    else if (state.mode === Mode.PLACE_LED) toolText.setText("Tool: LED");
    else if (state.mode === Mode.PLACE_HOUSE) toolText.setText("Tool: HOUSE");
    else if (state.mode === Mode.PLACE_TRANS) toolText.setText("Tool: SWITCH");
    else if (state.mode === Mode.DELETE) toolText.setText("Tool: DELETE (tap a part or a wire)");
    else toolText.setText("Tool: WIRE (tap two orange/blue dots to connect them)");
  }

  // ----- Toggles (top-left under Tool) — consolidated to two, per the
  // "fewer visible choices" design steal (see DESIGN.md, Toca Boca/Sago Mini
  // section): one for the numbers every kid might want, one for the deeper
  // wire-level detail an advanced kid might want.
  function toggleLine(i, label, get, set) {
    const t = scene.add.text(20, 70 + i * 20, "", {
      fontFamily: "Arial", fontSize: "14px", color: "#0b1020",
    }).setDepth(200);
    const refresh = () => t.setText(`${get() ? "☑" : "☐"} ${label}`);
    refresh();
    t.setInteractive({ useHandCursor: true });
    t.on("pointerdown", () => { set(!get()); refresh(); scene.events.emit("toggles-changed"); });
  }

  toggleLine(0, "Show Numbers (V / I)", () => state.showVoltage, v => { state.showVoltage = v; state.showCurrent = v; });
  toggleLine(1, "Show Wire Details", () => state.showResistance, v => { state.showResistance = v; state.advancedWireCurrent = v; });

  function makeBtn(cx, cy, w, h, text, onClick, fill = 0xffffff) {
    const r = scene.add.rectangle(cx, cy, w, h, fill).setDepth(200).setStrokeStyle(1, 0x333333).setInteractive({ useHandCursor: true });
    const t = scene.add.text(cx, cy, text, {
      fontFamily: "Arial", fontSize: "12px", color: "#000", align: "center", wordWrap: { width: w - 10 },
    }).setOrigin(0.5).setDepth(201);
    r.on("pointerdown", onClick);
    return r;
  }

  const PAD = 14, GAP = 8, BTN_W = 92, BTN_H = 32;
  const COLS = 5;
  const rowW = COLS * BTN_W + (COLS - 1) * GAP;
  const startX = W - PAD - rowW + BTN_W / 2;
  const xAt = (c) => startX + c * (BTN_W + GAP);
  const yRow1 = 28, yRow2 = yRow1 + BTN_H + GAP, yRow3 = yRow2 + BTN_H + GAP;

  makeBtn(xAt(0), yRow1, BTN_W, BTN_H, "RUN CHECK", () => scene.events.emit("run-check"), 0xffcc00);
  makeBtn(xAt(1), yRow1, BTN_W, BTN_H, "WIRE", () => { scene.events.emit("tool-switch", Mode.WIRE); setToolLabel(); });
  makeBtn(xAt(2), yRow1, BTN_W, BTN_H, "HOUSE", () => { scene.events.emit("tool-switch", Mode.PLACE_HOUSE); setToolLabel(); });
  makeBtn(xAt(3), yRow1, BTN_W, BTN_H, "LED", () => { scene.events.emit("tool-switch", Mode.PLACE_LED); setToolLabel(); });

  makeBtn(xAt(4), yRow1, BTN_W, BTN_H, "TRANSFORMER", () => {
    showChoiceOverlay(scene, {
      title: "Pick a transformer",
      choices: state.XFMR_PRESETS.map(p => ({ label: p.label, ratio: p.ratio })),
      onPick: (choice) => {
        state.placeXfmrRatio = choice.ratio;
        scene.events.emit("tool-switch", Mode.PLACE_XFR);
        setToolLabel();
      },
    });
  });

  makeBtn(xAt(0), yRow2, BTN_W, BTN_H, "RESISTOR", () => {
    showChoiceOverlay(scene, {
      title: "Pick a resistor",
      choices: state.RES_PRESETS.map(p => ({ label: `${p.label} (${p.ohms}Ω)`, ohms: p.ohms })),
      onPick: (choice) => {
        state.placeResOhms = choice.ohms;
        scene.events.emit("tool-switch", Mode.PLACE_RES);
        setToolLabel();
      },
    });
  });

  makeBtn(xAt(1), yRow2, BTN_W, BTN_H, "SWITCH", () => { scene.events.emit("tool-switch", Mode.PLACE_TRANS); setToolLabel(); });

  makeBtn(xAt(2), yRow2, BTN_W, BTN_H, "CAPACITOR", () => {
    showChoiceOverlay(scene, {
      title: "Pick a capacitor",
      choices: state.CAP_PRESETS.map(p => ({ label: `${p.label} (${p.uF}µF)`, uF: p.uF })),
      onPick: (choice) => {
        state.placeCapUF = choice.uF;
        scene.events.emit("tool-switch", Mode.PLACE_CAP);
        setToolLabel();
      },
    });
  });

  makeBtn(xAt(3), yRow2, BTN_W, BTN_H, "DELETE", () => { scene.events.emit("tool-switch", Mode.DELETE); setToolLabel(); }, 0xffd7d7);
  makeBtn(xAt(4), yRow2, BTN_W, BTN_H, "CLEAR ALL", () => scene.events.emit("clear-all-requested"), 0xffd7d7);

  makeBtn(xAt(0), yRow3, BTN_W, BTN_H, "UNDO", () => scene.events.emit("undo-requested"));
  makeBtn(xAt(1), yRow3, BTN_W, BTN_H, "REDO", () => scene.events.emit("redo-requested"));

  const status = scene.add.text(20, 518, "WIRE: tap two dots to connect them. Tap empty ground to cancel.", {
    color: "#0b1020", fontSize: "16px", fontFamily: "Arial",
  }).setDepth(200);

  setToolLabel();
  return { status, setToolLabel };
}
