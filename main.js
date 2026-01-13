import { createGameState } from "./src/state.js";
import { buildUI, Mode } from "./src/ui.js";
import { computePower } from "./src/sim.js";
import {
  drawBackground,
  addTownDecor,
  makeGenerator,
  makeHouse,
  makeResistor,
  makeTransistor,
  makeLED,
  setHouseVisual,
  setLEDVisual,
  setTransistorVisual
} from "./src/factory.js";

const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 550,
  backgroundColor: "#000000",
  scene: { create }
};

new Phaser.Game(config);

function create() {
  const scene = this;
  const state = createGameState();

  // ✅ make input choose top-most object only
  scene.input.setTopOnly(true);

  drawBackground(scene);
  addTownDecor(scene);

  const { status } = buildUI(scene, state);

  function nextId(prefix) {
    const n = state.counters[prefix]++;
    return `${prefix}${n}`;
  }

  function addNode({ id, type, container, hit, visual, data = {} }) {
    const node = { id, type, container, hit, visual, data };
    state.nodes.set(id, node);
    return node;
  }

  function nodePos(id) {
    const n = state.nodes.get(id);
    return { x: n.container.x, y: n.container.y };
  }

  function wireExists(a, b) {
    return state.wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  }

  function clearPreview() {
    if (state.previewLine) {
      state.previewLine.destroy();
      state.previewLine = null;
    }
    state.wireStart = null;
  }

  function startWire(id) {
    clearPreview();
    state.wireStart = id;

    const p = nodePos(id);
    state.previewLine = scene.add.line(0, 0, p.x, p.y, p.x, p.y, 0x2b2b2b)
      .setOrigin(0, 0)
      .setLineWidth(4)
      .setDepth(10);

    // ✅ wires must never steal clicks
    state.previewLine.disableInteractive?.();

    status.setText(`Wiring from ${id}... click another node to connect. (Click empty ground to cancel)`);
  }

  function finishWire(id) {
    if (!state.previewLine || !state.wireStart) return;

    const a = state.wireStart;
    const b = id;

    if (a === b) return;

    if (wireExists(a, b)) {
      clearPreview();
      status.setText("That wire already exists.");
      return;
    }

    const pa = nodePos(a);
    const pb = nodePos(b);

    state.previewLine.setTo(pa.x, pa.y, pb.x, pb.y);

    // store permanent
    const permLine = state.previewLine;
    permLine.setDepth(10);
    permLine.disableInteractive?.(); // ✅ permanent wire also can’t steal clicks

    state.wires.push({ a, b, line: permLine, r: state.R_WIRE });

    state.previewLine = null;
    state.wireStart = null;

    refreshPower();
  }

  function refreshPower() {
    computePower(state);

    for (const node of state.nodes.values()) {
      if (node.type === "HOUSE") {
        const r = state.powered.get(node.id);
        setHouseVisual(node.visual, r ? r.level : "OFF");
      }
      if (node.type === "LED") {
        const r = state.powered.get(node.id);
        setLEDVisual(node.visual, r ? r.level : "OFF");
      }
      if (node.type === "TRANS") {
        setTransistorVisual(node.visual, node.data.on);
      }
    }
  }

  // ✅ key: stopPropagation so background click doesn’t cancel your wire
  function registerNodeClicks(node) {
    node.hit.setInteractive({ useHandCursor: true });

    node.hit.on("pointerdown", (pointer, localX, localY, event) => {
      event.stopPropagation();

      // transistor toggle when NOT in WIRE mode
      if (node.type === "TRANS" && state.mode !== Mode.WIRE) {
        node.data.on = !node.data.on;
        setTransistorVisual(node.visual, node.data.on);
        refreshPower();
        status.setText(`${node.id} is now ${node.data.on ? "ON" : "OFF"}.`);
        return;
      }

      if (state.mode !== Mode.WIRE) return;

      if (!state.wireStart) startWire(node.id);
      else finishWire(node.id);
    });
  }

  // ---- Place functions ----
  function placeHouse(x, y) {
    const id = nextId("H");
    const obj = makeHouse(scene, x, y, id);
    const node = addNode({ id, type: "HOUSE", ...obj, data: {} });
    registerNodeClicks(node);
    refreshPower();
  }

  function placeRes(x, y) {
    const id = nextId("R");
    const obj = makeResistor(scene, x, y, id);
    const node = addNode({ id, type: "RES", ...obj, data: {} });
    registerNodeClicks(node);
    refreshPower();
  }

  function placeTrans(x, y) {
    const id = nextId("T");
    const obj = makeTransistor(scene, x, y, id);
    const node = addNode({ id, type: "TRANS", ...obj, data: { on: true } });
    setTransistorVisual(node.visual, true);
    registerNodeClicks(node);
    refreshPower();
  }

  function placeLED(x, y) {
    const id = nextId("L");
    const obj = makeLED(scene, x, y, id);
    const node = addNode({ id, type: "LED", ...obj, data: {} });
    registerNodeClicks(node);
    refreshPower();
  }

  // ---- Initial generator ----
  const genObj = makeGenerator(scene, 140, 285);
  const genNode = addNode({ id: "GEN", type: "GEN", ...genObj, data: {} });
  registerNodeClicks(genNode);

  // ---- Initial houses ----
  placeHouse(700, 210); // H0
  placeHouse(700, 310); // H1
  placeHouse(700, 410); // H2

  // preview wire follows mouse
  scene.input.on("pointermove", (p) => {
    if (!state.previewLine || !state.wireStart) return;
    const a = nodePos(state.wireStart);
    state.previewLine.setTo(a.x, a.y, p.x, p.y);
  });

  // click empty ground cancels wire OR places components
  scene.input.on("pointerdown", (p) => {
    if (p.y < 80) return;

    if (state.mode === Mode.WIRE) {
      if (state.previewLine) {
        clearPreview();
        status.setText("Cancelled wire.");
      }
      return;
    }

    if (state.mode === Mode.PLACE_HOUSE) return void (placeHouse(p.x, p.y), status.setText("Placed HOUSE."));
    if (state.mode === Mode.PLACE_RES) return void (placeRes(p.x, p.y), status.setText("Placed RESISTOR."));
    if (state.mode === Mode.PLACE_TRANS) return void (placeTrans(p.x, p.y), status.setText("Placed TRANSISTOR."));
    if (state.mode === Mode.PLACE_LED) return void (placeLED(p.x, p.y), status.setText("Placed LED."));
  });

  refreshPower();
  status.setText("WIRE: click GEN → R0 → H0, then click H0 → H1 (house-to-house works).");
}
