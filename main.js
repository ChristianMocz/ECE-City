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

  // UI now uses 2 rows, so ignore clicks in a taller top strip
  const UI_HEIGHT = 110;

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
      .setDepth(state.wireDepth);

    status.setText(`Wiring from ${id}... click another node. (Click empty ground to cancel)`);
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

    const permLine = state.previewLine;
    permLine.setDepth(state.wireDepth);

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
        const Vn = r ? r.V : 0;
        node.visual.voltLabel.setText(`V=${Vn.toFixed(2)}V`);
      }

      if (node.type === "LED") {
        const r = state.powered.get(node.id);
        setLEDVisual(node.visual, r ? r.level : "OFF");
        const Vn = r ? r.V : 0;
        node.visual.voltLabel.setText(`V=${Vn.toFixed(2)}V`);
      }

      if (node.type === "TRANS") {
        setTransistorVisual(node.visual, !!node.data.on);
      }
    }
  }

  function registerNodeClicks(node) {
    node.hit.setInteractive({ useHandCursor: true });

    node.hit.on("pointerdown", (pointer, localX, localY, event) => {
      event.stopPropagation();

      // Toggle transistor if not wiring
      if (node.type === "TRANS" && state.mode !== Mode.WIRE) {
        node.data.on = !node.data.on;
        refreshPower();
        status.setText(`${node.id} is now ${node.data.on ? "ON" : "OFF"}.`);
        return;
      }

      if (state.mode !== Mode.WIRE) return;

      if (!state.wireStart) startWire(node.id);
      else finishWire(node.id);
    });
  }

  // placement helpers
  function placeHouse(x, y) {
    const id = nextId("H");
    const obj = makeHouse(scene, x, y, id);
    const node = addNode({ id, type: "HOUSE", ...obj, data: {} });
    registerNodeClicks(node);
    refreshPower();
  }

  function placeRes(x, y) {
    const id = nextId("R");
    const ohms = state.placeResOhms;
    const obj = makeResistor(scene, x, y, id, ohms);
    const node = addNode({ id, type: "RES", ...obj, data: { ohms } });
    registerNodeClicks(node);
    refreshPower();
    status.setText(`Placed ${id} = ${ohms.toFixed(2)}Ω`);
  }

  function placeTrans(x, y) {
    const id = nextId("T");
    const obj = makeTransistor(scene, x, y, id);
    const node = addNode({ id, type: "TRANS", ...obj, data: { on: true } });
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

  // generator
  const genObj = makeGenerator(scene, 140, 285);
  const genNode = addNode({ id: "GEN", type: "GEN", ...genObj, data: {} });
  registerNodeClicks(genNode);

  // starter houses (slightly more spaced)
  placeHouse(700, 190);
  placeHouse(700, 315);
  placeHouse(700, 440);

  // wire preview follows mouse
  scene.input.on("pointermove", (p) => {
    if (!state.previewLine || !state.wireStart) return;
    const a = nodePos(state.wireStart);
    state.previewLine.setTo(a.x, a.y, p.x, p.y);
  });

  // empty ground click
  scene.input.on("pointerdown", (p) => {
    if (p.y < UI_HEIGHT) return;

    if (state.mode === Mode.WIRE) {
      if (state.previewLine) {
        clearPreview();
        status.setText("Cancelled wire.");
      }
      return;
    }

    if (state.mode === Mode.PLACE_HOUSE) return void placeHouse(p.x, p.y);
    if (state.mode === Mode.PLACE_RES) return void placeRes(p.x, p.y);
    if (state.mode === Mode.PLACE_TRANS) return void placeTrans(p.x, p.y);
    if (state.mode === Mode.PLACE_LED) return void placeLED(p.x, p.y);
  });

  refreshPower();
  status.setText("WIRE: connect GEN to houses. Voltage labels appear under each HOUSE/LED.");
}
