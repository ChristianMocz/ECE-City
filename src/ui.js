import { summarizePower } from "./sim.js";

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
  }).setDepth(1000);

  const toolText = scene.add.text(20, 45, "Tool: WIRE", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#0b1020"
  }).setDepth(1000);

  function button(x, y, w, h, label, onClick) {
    const bg = scene.add.rectangle(x, y, w, h, 0xffffff)
      .setDepth(1000)
      .setInteractive({ useHandCursor: true });

    scene.add.text(x - w/2 + 10, y - 10, label, {
      fontFamily: "Arial",
      fontSize: "13px",
      color: "#000"
    }).setDepth(1001);

    bg.on("pointerdown", onClick);
  }

  button(520, 40, 85, 34, "WIRE", () => {
    state.mode = Mode.WIRE;
    toolText.setText("Tool: WIRE");
  });

  button(610, 40, 85, 34, "HOUSE", () => {
    state.mode = Mode.PLACE_HOUSE;
    toolText.setText("Tool: PLACE HOUSE");
  });

  button(700, 40, 85, 34, "RES", () => {
    state.mode = Mode.PLACE_RES;
    toolText.setText("Tool: PLACE RESISTOR");
  });

  button(790, 40, 85, 34, "TRANS", () => {
    state.mode = Mode.PLACE_TRANS;
    toolText.setText("Tool: PLACE TRANSISTOR");
  });

  button(880, 40, 85, 34, "LED", () => {
    state.mode = Mode.PLACE_LED;
    toolText.setText("Tool: PLACE LED");
  });

  const runBtn = scene.add.rectangle(380, 40, 150, 38, 0xffcc00)
    .setDepth(1000)
    .setInteractive({ useHandCursor: true });

  scene.add.text(318, 28, "RUN CHECK", {
    fontFamily: "Arial",
    fontSize: "16px",
    color: "#000"
  }).setDepth(1001);

  const status = scene.add.text(
    20,
    515,
    "WIRE: click node A then node B. Click empty ground to cancel.",
    { fontFamily: "Arial", fontSize: "16px", color: "#0b1020" }
  ).setDepth(1000);

  runBtn.on("pointerdown", () => status.setText(summarizePower(state)));

  return { status, toolText };
}
