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
  makeCapacitor,
  makeTransformer,
  setHouseVisual,
  setLEDVisual,
  setTransistorVisual
} from "./src/factory.js";

const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 550,
  backgroundColor: "#000000",
  scene: { create, update }
};

new Phaser.Game(config);

function create() {
  const scene = this;
  const state = createGameState();
  const UI_HEIGHT = 140;

  scene.__state = state;

  scene.input.setTopOnly(true);

  drawBackground(scene);
  addTownDecor(scene);

  const { status } = buildUI(scene, state);
  scene.__status = status;

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

  function wireKey(a, b) {
    return [a, b].sort().join("|");
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

    status.setText(`Wiring from ${id}... click another node to connect. (Click empty ground to cancel)`);
  }

  function ensureWireLabel(w) {
    if (w.labelText) return w.labelText;
    w.labelText = scene.add.text(0, 0, "", {
      fontFamily: "Arial",
      fontSize: "12px",
      color: "#0b1020",
      backgroundColor: "rgba(255,255,255,0.65)"
    }).setDepth(25);
    return w.labelText;
  }

  function updateWireLabels() {
    const showWireI = state.showCurrent && state.advancedWireCurrent;

    for (const w of state.wires) {
      const key = wireKey(w.a, w.b);
      const m = state.wireMetrics.get(key);

      if (!showWireI && !state.showResistance) {
        if (w.labelText) w.labelText.setVisible(false);
        continue;
      }

      const label = ensureWireLabel(w);

      const pa = nodePos(w.a);
      const pb = nodePos(w.b);
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;

      label.setPosition(mx - 42, my - 10);

      let parts = [];
      if (state.showResistance) parts.push(m ? `R=${m.R.toFixed(2)}Ω` : `R=?`);
      if (showWireI) parts.push(`I=${(m ? Math.abs(m.Iab) : 0).toFixed(2)}A`);

      label.setText(parts.join("  "));
      label.setVisible(parts.length > 0);
    }
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

    state.wires.push({ a, b, line: permLine, labelText: null });

    state.previewLine = null;
    state.wireStart = null;

    refreshPower();
  }

  function refreshPower(dtForCaps = state.dt) {
    computePower(state, dtForCaps);

    for (const node of state.nodes.values()) {
      if (node.type === "HOUSE") {
        const p = state.powered.get(node.id) || { V: 0, I: 0, level: "OFF" };
        setHouseVisual(node.visual, p.level);

        node.visual.voltLabel.setText(`V=${p.V.toFixed(2)}V`);
        node.visual.currLabel.setText(`I=${p.I.toFixed(2)}A`);
        node.visual.voltLabel.setVisible(!!state.showVoltage);
        node.visual.currLabel.setVisible(!!state.showCurrent);
      }

      if (node.type === "LED") {
        const p = state.powered.get(node.id) || { V: 0, I: 0, level: "OFF" };
        const b = Math.max(0, Math.min(1, p.V / state.V_LED_ON));
        setLEDVisual(node.visual, p.level, b);

        node.visual.voltLabel.setText(`V=${p.V.toFixed(2)}V`);
        node.visual.currLabel.setText(`I=${p.I.toFixed(2)}A`);
        node.visual.voltLabel.setVisible(!!state.showVoltage);
        node.visual.currLabel.setVisible(!!state.showCurrent);
      }

      if (node.type === "TRANS") {
        setTransistorVisual(node.visual, !!node.data.on);
      }

      if (node.type === "RES") {
        if (node.visual?.ohmLabel) node.visual.ohmLabel.setVisible(!!state.showResistance);
      }
      if (node.type === "CAP") {
        if (node.visual?.capLabel) node.visual.capLabel.setVisible(!!state.showResistance);
      }
      if (node.type === "XFMR") {
        if (node.visual?.ratioLabel) node.visual.ratioLabel.setVisible(!!state.showResistance);
      }
    }

    updateWireLabels();
  }

  scene.__refreshPower = refreshPower;

  function registerNodeClicks(node) {
    node.hit.setInteractive({ useHandCursor: true });

    node.hit.on("pointerdown", (pointer, localX, localY, event) => {
      event.stopPropagation();

      // transistor toggles when NOT wiring
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

  // placement
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

  function placeCap(x, y) {
    const id = nextId("C");
    const uF = state.placeCapUF;
    const obj = makeCapacitor(scene, x, y, id, uF);

    // ✅ Slow-but-capped capacitor: scale C so it charges over seconds (teaching time)
    // Still capped automatically by the circuit’s final DC voltage.
    const C_real = uF * 1e-6;
    const C = C_real * (state.CAP_TIME_SCALE ?? 1);

    const node = addNode({
      id,
      type: "CAP",
      ...obj,
      data: { C, Vprev: 0 }
    });

    registerNodeClicks(node);
    refreshPower();
    status.setText(`Placed ${id} = ${uF.toFixed(0)}µF (slow-charge). Wire it into the circuit.`);
  }

  function placeXfmr(x, y) {
    const id = nextId("X");
    const ratio = state.placeXfmrRatio;
    const obj = makeTransformer(scene, x, y, id, ratio);

    // IMPORTANT: must be "XFMR" (matches sim.js)
    const node = addNode({ id, type: "XFMR", ...obj, data: { ratio } });

    registerNodeClicks(node);
    refreshPower();
    status.setText(`Placed ${id} ratio ${ratio.toFixed(2)}×. Wire GEN → ${id} to create a substation.`);
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

  // starter houses (spaced)
  placeHouse(720, 170);
  placeHouse(720, 325);
  placeHouse(720, 480);

  // preview wire follows mouse
  scene.input.on("pointermove", (p) => {
    if (!state.previewLine || !state.wireStart) return;
    const a = nodePos(state.wireStart);
    state.previewLine.setTo(a.x, a.y, p.x, p.y);
  });

  // toggles changed
  scene.events.on("toggles-changed", () => {
    refreshPower();
  });

  // RUN CHECK (counts ON/DIM/OFF reliably)
  scene.events.on("run-check", () => {
    refreshPower();

    let houseOn = 0, houseDim = 0, houseOff = 0;
    let ledOn = 0, ledDim = 0, ledOff = 0;

    for (const node of state.nodes.values()) {
      if (node.type === "HOUSE") {
        const V = state.powered.get(node.id)?.V ?? 0;
        if (V >= state.V_HOUSE_ON) houseOn++;
        else if (V >= state.V_HOUSE_DIM) houseDim++;
        else houseOff++;
      }
      if (node.type === "LED") {
        const V = state.powered.get(node.id)?.V ?? 0;
        if (V >= state.V_LED_ON) ledOn++;
        else if (V >= state.V_LED_DIM) ledDim++;
        else ledOff++;
      }
    }

    status.setText(
      `RUN CHECK ✅  Houses: ON ${houseOn} | DIM ${houseDim} | OFF ${houseOff}   LEDs: ON ${ledOn} | DIM ${ledDim} | OFF ${ledOff}`
    );
  });

  // ground click: place or cancel
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
    if (state.mode === Mode.PLACE_CAP) return void placeCap(p.x, p.y);
    if (state.mode === Mode.PLACE_XFR) return void placeXfmr(p.x, p.y);
    if (state.mode === Mode.PLACE_TRANS) return void placeTrans(p.x, p.y);
    if (state.mode === Mode.PLACE_LED) return void placeLED(p.x, p.y);
  });

  refreshPower();
  status.setText("WIRE: click a node, then click another node to connect. (Click empty ground to cancel)");
}

function update(time, delta) {
  const scene = this;
  const state = scene.__state;
  if (!state) return;

  // advance transient using dt (seconds)
  const dt = Math.max(0, delta) / 1000;

  if (scene.__refreshPower) scene.__refreshPower(dt);
}
