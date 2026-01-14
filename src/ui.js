// src/ui.js
export const Mode = {
  WIRE: "WIRE",
  PLACE_HOUSE: "PLACE_HOUSE",
  PLACE_RES: "PLACE_RES",
  PLACE_TRANS: "PLACE_TRANS",
  PLACE_LED: "PLACE_LED",
  PLACE_CAP: "PLACE_CAP",
  PLACE_XFR: "PLACE_XFR",
};

export function buildUI(scene, state) {
  const W = scene.scale.width;

  // Title
  scene.add.text(20, 12, "ECE City (Power Grid)", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#0b1020",
  }).setDepth(200);

  // Tool label
  const toolText = scene.add.text(20, 45, "Tool: WIRE", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#0b1020",
  }).setDepth(200);

  function setToolLabel() {
    if (state.mode === Mode.PLACE_RES) toolText.setText(`Tool: RES (${state.placeResOhms.toFixed(2)}Ω)`);
    else if (state.mode === Mode.PLACE_CAP) toolText.setText(`Tool: CAP (${state.placeCapUF.toFixed(0)}µF)`);
    else if (state.mode === Mode.PLACE_XFR) toolText.setText(`Tool: XFMR (ratio ${state.placeXfmrRatio.toFixed(2)}×)`);
    else if (state.mode === Mode.PLACE_LED) toolText.setText(`Tool: LED (needs ~${state.V_LED_ON.toFixed(0)}V)`);
    else if (state.mode === Mode.PLACE_HOUSE) toolText.setText(`Tool: HOUSE (needs ~${state.V_HOUSE_ON.toFixed(0)}V)`);
    else if (state.mode === Mode.PLACE_TRANS) toolText.setText("Tool: TRANS (click device to toggle)");
    else toolText.setText("Tool: WIRE");
  }

  // ----- Toggles (top-left under Tool) -----
  function toggleLine(i, label, get, set) {
    const t = scene.add.text(20, 70 + i * 18, "", {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#0b1020",
    }).setDepth(200);

    const refresh = () => t.setText(`${get() ? "☑" : "☐"} ${label}`);
    refresh();

    t.setInteractive({ useHandCursor: true });
    t.on("pointerdown", () => {
      set(!get());
      refresh();
      scene.events.emit("toggles-changed");
    });
  }

  toggleLine(0, "Show Voltage", () => state.showVoltage, v => state.showVoltage = v);
  toggleLine(1, "Show Current", () => state.showCurrent, v => state.showCurrent = v);
  toggleLine(2, "Show Resistance", () => state.showResistance, v => state.showResistance = v);
  toggleLine(3, "Advanced Mode (wire current)", () => state.advancedWireCurrent, v => state.advancedWireCurrent = v);

  // ----- Button helper -----
  function makeBtn(x, y, w, h, text, onClick, fill = 0xffffff) {
    const r = scene.add.rectangle(x, y, w, h, fill)
      .setDepth(200)
      .setInteractive({ useHandCursor: true });

    scene.add.text(x - w / 2 + 10, y - 10, text, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#000",
    }).setDepth(201);

    r.on("pointerdown", onClick);
    return r;
  }

  // ✅ RUN CHECK centered top and WHITE
  makeBtn(W / 2, 28, 220, 36, "RUN CHECK", () => scene.events.emit("run-check"), 0xffffff);

  // ✅ Clean top-right grid (all same size, XFMR top-right)
  const PAD = 14;
  const GAP = 10;
  const BTN_W = 105;
  const BTN_H = 32;

  // 4 columns, 2 rows
  // Row 1: WIRE | HOUSE | LED | XFMR
  // Row 2: RES  | TRANS | CAP | (empty)
  const cols = 4;
  const gridW = cols * BTN_W + (cols - 1) * GAP;

  const startX = W - PAD - gridW + BTN_W / 2;
  const row1Y = 28 + 46;             // under RUN CHECK
  const row2Y = row1Y + BTN_H + GAP;

  const xAt = (c) => startX + c * (BTN_W + GAP);

  // Row 1
  makeBtn(xAt(0), row1Y, BTN_W, BTN_H, "WIRE", () => { state.mode = Mode.WIRE; setToolLabel(); });
  makeBtn(xAt(1), row1Y, BTN_W, BTN_H, "HOUSE", () => { state.mode = Mode.PLACE_HOUSE; setToolLabel(); });
  makeBtn(xAt(2), row1Y, BTN_W, BTN_H, "LED", () => { state.mode = Mode.PLACE_LED; setToolLabel(); });

  makeBtn(xAt(3), row1Y, BTN_W, BTN_H, "XFMR", () => {
    const raw = prompt("Enter transformer ratio (0.5=step down, 2=step up):", String(state.placeXfmrRatio));
    if (raw !== null) {
      const v = Number(raw);
      if (Number.isFinite(v) && v > 0) state.placeXfmrRatio = v;
    }
    state.mode = Mode.PLACE_XFR;
    setToolLabel();
    scene.events.emit("toggles-changed");
  });

  // Row 2
  makeBtn(xAt(0), row2Y, BTN_W, BTN_H, "RES", () => {
    const raw = prompt("Enter resistor value in ohms (example: 2):", String(state.placeResOhms));
    if (raw !== null) {
      const v = Number(raw);
      if (Number.isFinite(v) && v > 0) state.placeResOhms = v;
    }
    state.mode = Mode.PLACE_RES;
    setToolLabel();
    scene.events.emit("toggles-changed");
  });

  makeBtn(xAt(1), row2Y, BTN_W, BTN_H, "TRANS", () => {
    state.mode = Mode.PLACE_TRANS;
    setToolLabel();
  });

  makeBtn(xAt(2), row2Y, BTN_W, BTN_H, "CAP", () => {
    const raw = prompt("Enter capacitor in µF (example: 220):", String(state.placeCapUF));
    if (raw !== null) {
      const v = Number(raw);
      if (Number.isFinite(v) && v > 0) state.placeCapUF = v;
    }
    state.mode = Mode.PLACE_CAP;
    setToolLabel();
    scene.events.emit("toggles-changed");
  });

  // Status line
  const status = scene.add.text(
    20,
    515,
    "WIRE: click a node then another node to connect. (Click empty ground to cancel)",
    { color: "#0b1020", fontSize: "18px", fontFamily: "Arial" }
  ).setDepth(200);

  setToolLabel();
  return { status, setToolLabel };
}
