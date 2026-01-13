// src/ui.js
export const Mode = {
  WIRE: "WIRE",
  PLACE_HOUSE: "PLACE_HOUSE",
  PLACE_RES: "PLACE_RES",
  PLACE_TRANS: "PLACE_TRANS",
  PLACE_LED: "PLACE_LED",
};

export function buildUI(scene, state) {
  scene.add.text(20, 12, "ECE City (Power Grid)", {
    fontFamily: "Arial",
    fontSize: "24px",
    color: "#0b1020"
  }).setDepth(60);

  const toolText = scene.add.text(20, 45, "Tool: WIRE", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#0b1020"
  }).setDepth(60);

  function setToolLabel() {
    if (state.mode === Mode.PLACE_RES) {
      toolText.setText(`Tool: RES (${state.placeResOhms.toFixed(2)}Ω)`);
    } else if (state.mode === Mode.PLACE_LED) {
      toolText.setText(`Tool: LED (ON at ${state.V_LED_ON.toFixed(0)}V)`);
    } else if (state.mode === Mode.PLACE_HOUSE) {
      toolText.setText(`Tool: HOUSE (ON at ${state.V_HOUSE_ON.toFixed(0)}V)`);
    } else if (state.mode === Mode.PLACE_TRANS) {
      toolText.setText("Tool: TRANS");
    } else {
      toolText.setText("Tool: WIRE");
    }
  }

  function makeUIButton(x, y, w, h, text, onClick) {
    const r = scene.add.rectangle(x, y, w, h, 0xffffff)
      .setDepth(60)
      .setInteractive({ useHandCursor: true });

    scene.add.text(x - w / 2 + 12, y - 10, text, {
      fontFamily: "Arial",
      fontSize: "14px",
      color: "#000"
    }).setDepth(61);

    r.on("pointerdown", onClick);
  }

  // Row 1 (fits in 900px)
  makeUIButton(450, 40, 170, 38, "RUN CHECK", () => {
    // keep simple; you’ll see voltages under nodes
  });

  makeUIButton(635, 40, 110, 34, "WIRE", () => {
    state.mode = Mode.WIRE;
    setToolLabel();
  });

  makeUIButton(750, 40, 110, 34, "HOUSE", () => {
    state.mode = Mode.PLACE_HOUSE;
    setToolLabel();
  });

  makeUIButton(865, 40, 110, 34, "RES", () => {
    const raw = prompt("Enter resistor value in ohms (example: 1.5):", String(state.placeResOhms));
    if (raw !== null) {
      const val = Number(raw);
      if (Number.isFinite(val) && val > 0) state.placeResOhms = val;
    }
    state.mode = Mode.PLACE_RES;
    setToolLabel();
  });

  // Row 2 (TRANS + LED)
  makeUIButton(750, 74, 110, 28, "TRANS", () => {
    state.mode = Mode.PLACE_TRANS;
    setToolLabel();
  });

  makeUIButton(865, 74, 110, 28, "LED", () => {
    state.mode = Mode.PLACE_LED;
    setToolLabel();
  });

  const status = scene.add.text(
    20,
    515,
    "WIRE: connect GEN to houses. Voltage labels appear under each HOUSE/LED.",
    { color: "#0b1020", fontSize: "18px", fontFamily: "Arial" }
  ).setDepth(60);

  setToolLabel();
  return { status, setToolLabel };
}
