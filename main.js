import { createGameState } from "./src/state.js";
import { buildUI, Mode, showConfirmOverlay } from "./src/ui.js";
import { computePower } from "./src/sim.js";
import {
  drawBackground,
  addTownDecor,
  makeGenerator,
  makeGroundTerminal,
  makeHouse,
  makeResistor,
  makeTransistor,
  makeLED,
  makeCapacitor,
  makeTransformer,
  setHouseVisual,
  setLEDVisual,
  setTransistorVisual,
  playBurnoutEffect,
} from "./src/factory.js";

const config = {
  type: Phaser.AUTO,
  width: 900,
  height: 640,
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: { create, update },
};

new Phaser.Game(config);

const PREFIX = { HOUSE: "H", RES: "R", CAP: "C", TRANS: "T", LED: "L" };

function create() {
  const scene = this;
  const state = createGameState();
  const UI_HEIGHT = 150;

  scene.__state = state;
  scene.input.setTopOnly(true);

  drawBackground(scene);
  addTownDecor(scene);

  const { status } = buildUI(scene, state);
  scene.__status = status;

  const dotsGfx = scene.add.graphics().setDepth(15);

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
    return { x: n.hit.x, y: n.hit.y };
  }

  function wireKey(a, b) {
    return [a, b].sort().join("|");
  }
  function wireExists(a, b) {
    return state.wires.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  }

  function markDirty() {
    state.dirty = true;
  }

  // ---------------------------------------------------------------------
  // Placement — a single dispatcher for every two-terminal component
  // (HOUSE/RES/CAP/TRANS/LED all share the same hot+ground-lead pattern;
  // see factory.js header comment). XFMR gets its own function since its
  // two nodes aren't a simple id/id+"b" pair.
  // ---------------------------------------------------------------------
  function placePart(kind, x, y, opts = {}) {
    const id = opts.id || nextId(PREFIX[kind]);
    const bId = id + "b";
    const hotData = { kind, role: "primary", pairId: bId };
    let obj;

    if (kind === "HOUSE") {
      obj = makeHouse(scene, x, y, id);
    } else if (kind === "RES") {
      const ohms = opts.ohms ?? state.placeResOhms;
      obj = makeResistor(scene, x, y, id, ohms);
      hotData.ohms = ohms;
    } else if (kind === "CAP") {
      const uF = opts.uF ?? state.placeCapUF;
      obj = makeCapacitor(scene, x, y, id, uF);
      hotData.uF = uF;
      hotData.C = (uF * 1e-6) * (state.CAP_TIME_SCALE ?? 1);
      hotData.Vprev = opts.Vprev ?? 0;
    } else if (kind === "TRANS") {
      obj = makeTransistor(scene, x, y, id);
      hotData.on = opts.on ?? true;
    } else if (kind === "LED") {
      obj = makeLED(scene, x, y, id);
      hotData.burned = opts.burned ?? false;
    } else {
      throw new Error(`Unknown part kind: ${kind}`);
    }

    const hotNode = addNode({ id, type: kind, container: obj.container, hit: obj.inHit, visual: obj.visual, data: hotData });
    const gndNode = addNode({ id: bId, type: kind + "_B", container: obj.container, hit: obj.outHit, visual: {}, data: { kind, role: "secondary", pairId: id } });

    registerNodeClicks(hotNode);
    registerNodeClicks(gndNode);
    if (kind === "TRANS" && obj.toggleHit) registerTransistorToggle(hotNode, obj.toggleHit);

    markDirty();
    return { hotNode, gndNode };
  }

  function placeXfmr(x, y, opts = {}) {
    const id = opts.id || nextId("X");
    const priId = id + "P";
    const ratio = opts.ratio ?? state.placeXfmrRatio;
    const obj = makeTransformer(scene, x, y, id, ratio);

    const priNode = addNode({
      id: priId, type: "XFMR_PRI", container: obj.container, hit: obj.priHit, visual: {},
      data: { kind: "XFMR", role: "secondary", pairId: id },
    });
    const secNode = addNode({
      id, type: "XFMR_SEC", container: obj.container, hit: obj.secHit, visual: obj.visual,
      data: { kind: "XFMR", role: "primary", pairId: priId, ratio },
    });

    registerNodeClicks(priNode);
    registerNodeClicks(secNode);
    markDirty();
    return { priNode, secNode };
  }

  function createWireDirect(a, b) {
    const pa = nodePos(a), pb = nodePos(b);
    const line = scene.add.line(0, 0, pa.x, pa.y, pb.x, pb.y, 0x2b2b2b).setOrigin(0, 0).setLineWidth(4).setDepth(state.wireDepth);
    state.wires.push({ a, b, line, labelText: null, phase: Math.random() });
  }

  // ---------------------------------------------------------------------
  // Undo/redo — snapshot the whole build, tear down, rebuild. Simple,
  // robust, and plenty fast for a sandbox this size (see AUDIT.md B7).
  // ---------------------------------------------------------------------
  let rebuilding = false;

  function serializeBuild() {
    const parts = [];
    for (const node of state.nodes.values()) {
      if (node.data.role !== "primary") continue;
      const kind = node.data.kind;
      const entry = { kind, id: node.id, x: node.container.x, y: node.container.y };
      if (kind === "RES") entry.ohms = node.data.ohms;
      if (kind === "CAP") { entry.uF = node.data.uF; entry.Vprev = node.data.Vprev; }
      if (kind === "TRANS") entry.on = node.data.on;
      if (kind === "LED") entry.burned = node.data.burned;
      if (kind === "XFMR") entry.ratio = node.data.ratio;
      parts.push(entry);
    }
    return {
      counters: { ...state.counters },
      parts,
      wires: state.wires.map(w => ({ a: w.a, b: w.b })),
    };
  }

  function clearAllNodesAndWires() {
    for (const w of state.wires) { w.line?.destroy(); w.labelText?.destroy(); }
    state.wires = [];
    const destroyed = new Set();
    for (const node of state.nodes.values()) {
      if (node.type === "GEN" || node.type === "GND") continue;
      if (node.container && !destroyed.has(node.container)) { node.container.destroy(true); destroyed.add(node.container); }
      node.hit?.destroy();
    }
    for (const id of [...state.nodes.keys()]) {
      const n = state.nodes.get(id);
      if (n.type === "GEN" || n.type === "GND") continue;
      state.nodes.delete(id);
    }
    clearPreview();
  }

  function rebuildFrom(snapshot) {
    rebuilding = true;
    clearAllNodesAndWires();
    state.counters = { ...snapshot.counters };
    for (const part of snapshot.parts) {
      if (part.kind === "XFMR") placeXfmr(part.x, part.y, { id: part.id, ratio: part.ratio });
      else placePart(part.kind, part.x, part.y, part);
    }
    for (const w of snapshot.wires) createWireDirect(w.a, w.b);
    rebuilding = false;
    markDirty();
    refreshPower();
  }

  function pushUndo() {
    if (rebuilding) return;
    state.undoStack.push(serializeBuild());
    if (state.undoStack.length > state.historyLimit) state.undoStack.shift();
    state.redoStack = [];
  }

  function undo() {
    if (!state.undoStack.length) { status.setText("Nothing to undo yet."); return; }
    state.redoStack.push(serializeBuild());
    rebuildFrom(state.undoStack.pop());
    status.setText("Undid that.");
  }
  function redo() {
    if (!state.redoStack.length) { status.setText("Nothing to redo."); return; }
    state.undoStack.push(serializeBuild());
    rebuildFrom(state.redoStack.pop());
    status.setText("Redid that.");
  }

  // ---------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------
  function deleteComponent(anyId) {
    const node = state.nodes.get(anyId);
    if (!node) return;
    if (node.type === "GEN" || node.type === "GND") {
      status.setText("The generator and ground can't be deleted — everything needs somewhere to plug in!");
      return;
    }
    pushUndo();
    const pairId = node.data?.pairId;
    const idsToRemove = pairId ? [anyId, pairId] : [anyId];

    state.wires = state.wires.filter(w => {
      if (idsToRemove.includes(w.a) || idsToRemove.includes(w.b)) { w.line?.destroy(); w.labelText?.destroy(); return false; }
      return true;
    });

    const destroyed = new Set();
    for (const id of idsToRemove) {
      const n = state.nodes.get(id);
      if (!n) continue;
      if (n.container && !destroyed.has(n.container)) { n.container.destroy(true); destroyed.add(n.container); }
      n.hit?.destroy();
      state.nodes.delete(id);
    }
    clearPreview();
    markDirty();
    refreshPower();
    status.setText("Deleted. (Tap UNDO if that was a mistake.)");
  }

  function pointSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function deleteNearestWire(x, y) {
    let best = null, bestDist = 14;
    for (const w of state.wires) {
      const pa = nodePos(w.a), pb = nodePos(w.b);
      const d = pointSegDist(x, y, pa.x, pa.y, pb.x, pb.y);
      if (d < bestDist) { bestDist = d; best = w; }
    }
    if (!best) { status.setText("Tap closer to a wire (or a part) to delete it."); return; }
    pushUndo();
    best.line?.destroy(); best.labelText?.destroy();
    state.wires = state.wires.filter(w => w !== best);
    markDirty();
    refreshPower();
    status.setText("Wire deleted. (Tap UNDO if that was a mistake.)");
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------
  function clearPreview() {
    if (state.previewLine) { state.previewLine.destroy(); state.previewLine = null; }
    state.wireStart = null;
  }

  function startWire(id) {
    clearPreview();
    state.wireStart = id;
    const p = nodePos(id);
    state.previewLine = scene.add.line(0, 0, p.x, p.y, p.x, p.y, 0x2b2b2b).setOrigin(0, 0).setLineWidth(4).setDepth(state.wireDepth);
    status.setText("Now tap the OTHER dot to finish the wire. (Tap empty ground to cancel.)");
  }

  function finishWire(id) {
    if (!state.previewLine || !state.wireStart) return;
    const a = state.wireStart, b = id;
    if (a === b) {
      clearPreview();
      status.setText("That's the same dot — tap a different one, or tap empty ground to cancel.");
      return;
    }
    if (wireExists(a, b)) {
      clearPreview();
      status.setText("Those two are already wired together.");
      return;
    }
    pushUndo();
    const pa = nodePos(a), pb = nodePos(b);
    state.previewLine.setTo(pa.x, pa.y, pb.x, pb.y);
    const permLine = state.previewLine;
    permLine.setDepth(state.wireDepth);
    state.wires.push({ a, b, line: permLine, labelText: null, phase: Math.random() });
    state.previewLine = null;
    state.wireStart = null;
    markDirty();
    refreshPower();
  }

  function registerNodeClicks(node) {
    node.hit.setInteractive({ useHandCursor: true });
    node.hit.on("pointerdown", (pointer, lx, ly, event) => {
      event.stopPropagation();
      if (state.mode === Mode.DELETE) { deleteComponent(node.id); return; }
      if (state.mode !== Mode.WIRE) {
        status.setText("Switch to the WIRE tool to connect dots.");
        return;
      }
      if (!state.wireStart) startWire(node.id);
      else finishWire(node.id);
    });
  }

  function registerTransistorToggle(hotNode, toggleZone) {
    toggleZone.setInteractive({ useHandCursor: true });
    toggleZone.on("pointerdown", (pointer, lx, ly, event) => {
      event.stopPropagation();
      if (state.mode === Mode.DELETE) { deleteComponent(hotNode.id); return; }
      pushUndo();
      hotNode.data.on = !hotNode.data.on;
      markDirty();
      refreshPower();
      status.setText(`${hotNode.id} is now ${hotNode.data.on ? "ON (closed)" : "OFF (open)"}.`);
    });
  }

  // ---------------------------------------------------------------------
  // Power / visuals
  // ---------------------------------------------------------------------
  function hasAnyCap() {
    for (const n of state.nodes.values()) if (n.type === "CAP") return true;
    return false;
  }

  function colorForCurrent(absI) {
    if (absI >= state.WIRE_HOT_I) return 0xd94848;
    if (absI >= state.WIRE_WARM_I) return 0xe0b400;
    return 0x2b2b2b;
  }

  function ensureWireLabel(w) {
    if (w.labelText) return w.labelText;
    w.labelText = scene.add.text(0, 0, "", {
      fontFamily: "Arial", fontSize: "12px", color: "#0b1020", backgroundColor: "rgba(255,255,255,0.7)",
    }).setDepth(25);
    return w.labelText;
  }

  function updateWireVisuals() {
    const showWireI = state.showCurrent && state.advancedWireCurrent;
    for (const w of state.wires) {
      const key = wireKey(w.a, w.b);
      const m = state.wireMetrics.get(key);
      const absI = m ? Math.abs(m.Iab) : 0;
      w.line.strokeColor = colorForCurrent(absI);

      if (!showWireI) {
        if (w.labelText) w.labelText.setVisible(false);
        continue;
      }
      const label = ensureWireLabel(w);
      const pa = nodePos(w.a), pb = nodePos(w.b);
      label.setPosition((pa.x + pb.x) / 2 - 28, (pa.y + pb.y) / 2 - 10);
      label.setText(`I=${absI.toFixed(2)}A`);
      label.setVisible(true);
    }
  }

  function refreshPower(dtForCaps = state.dt) {
    if (state.dirty || hasAnyCap()) {
      computePower(state, dtForCaps);
      state.dirty = false;
    }

    const genNode = state.nodes.get("GEN");
    if (genNode?.visual?.supplyLabel) {
      if (state.solverError) {
        genNode.visual.supplyLabel.setText("can't calculate this circuit");
      } else {
        const Vgen = state.nodeVoltages.get("GEN") ?? state.V;
        const totalI = Math.max(0, (state.V - Vgen) / state.R_GEN);
        genNode.visual.supplyLabel.setText(`supplying ${totalI.toFixed(2)}A`);
      }
    }

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
        const b = p.level === "BURNED" ? null : Math.max(0, Math.min(1, p.I / state.I_LED_BRIGHT));
        setLEDVisual(node.visual, p.level, b);
        node.visual.voltLabel.setText(`V=${p.V.toFixed(2)}V`);
        node.visual.currLabel.setText(`I=${(p.I * 1000).toFixed(1)}mA`);
        node.visual.voltLabel.setVisible(!!state.showVoltage);
        node.visual.currLabel.setVisible(!!state.showCurrent);

        if (node.data.justBurned) {
          node.data.justBurned = false;
          const pos = nodePos(node.id);
          playBurnoutEffect(scene, pos.x, pos.y - 10, "Whoa, too much power!\nI need a resistor buddy\nto slow things down.");
          status.setText(`${node.id} popped from too much current — try adding a resistor in front of it next time, or just delete and place a new one.`);
        }
      }

      if (node.type === "TRANS") setTransistorVisual(node.visual, !!node.data.on);
      if (node.type === "RES" && node.visual?.ohmLabel) node.visual.ohmLabel.setVisible(!!state.showResistance);
      if (node.type === "CAP" && node.visual?.capLabel) node.visual.capLabel.setVisible(!!state.showResistance);
      if (node.type === "XFMR_SEC" && node.visual?.ratioLabel) node.visual.ratioLabel.setVisible(!!state.showResistance);
    }

    updateWireVisuals();
  }

  scene.__refreshPower = refreshPower;

  // Current-visualization dots: small dots drifting along every carrying
  // wire, speed/density scaled by |I|, direction matching current sign —
  // reads without needing color vision at all (PhET steal, see DESIGN.md).
  // This is cheap and runs every frame off the LAST solved currents; it does
  // NOT trigger a fresh KCL solve.
  function advanceCurrentDots(deltaMs) {
    dotsGfx.clear();
    const dtSec = Math.max(0, deltaMs) / 1000;
    for (const w of state.wires) {
      const m = state.wireMetrics.get(wireKey(w.a, w.b));
      const I = m ? m.Iab : 0;
      const absI = Math.abs(I);
      if (absI < 0.001) continue;

      if (w.phase == null) w.phase = 0;
      const speed = Math.min(2.2, 0.5 + absI * 1.2);
      const dir = I < 0 ? -1 : 1;
      w.phase = ((w.phase + dtSec * speed * dir) % 1 + 1) % 1;

      const pa = nodePos(w.a), pb = nodePos(w.b);
      const dotCount = Math.min(6, Math.max(2, Math.round(absI * 3)));
      dotsGfx.fillStyle(0xffffff, 0.9);
      for (let k = 0; k < dotCount; k++) {
        const t = (w.phase + k / dotCount) % 1;
        dotsGfx.fillCircle(pa.x + (pb.x - pa.x) * t, pa.y + (pb.y - pa.y) * t, 3);
      }
    }
  }
  scene.__advanceDots = advanceCurrentDots;

  // ---------------------------------------------------------------------
  // Scene setup
  // ---------------------------------------------------------------------
  const genObj = makeGenerator(scene, 130, 260);
  const genNode = addNode({ id: "GEN", type: "GEN", container: genObj.container, hit: genObj.outHit, visual: genObj.visual, data: {} });
  registerNodeClicks(genNode);

  const gndObj = makeGroundTerminal(scene, 130, 480);
  const gndNode = addNode({ id: "GND", type: "GND", container: gndObj.container, hit: gndObj.inHit, visual: gndObj.visual, data: {} });
  registerNodeClicks(gndNode);

  // Starter town: one house pre-wired so the page loads already "working"
  // (ten-second onboarding goal — see DESIGN.md), plus two unwired houses
  // inviting the player to try connecting one themselves.
  placePart("HOUSE", 430, 260);
  placePart("HOUSE", 650, 260);
  placePart("HOUSE", 650, 440);
  createWireDirect("GEN", "H0");
  createWireDirect("H0b", "GND");

  scene.input.on("pointermove", (p) => {
    if (!state.previewLine || !state.wireStart) return;
    const a = nodePos(state.wireStart);
    state.previewLine.setTo(a.x, a.y, p.x, p.y);
  });

  scene.events.on("tool-switch", (mode) => {
    clearPreview();
    state.mode = mode;
  });

  scene.events.on("toggles-changed", () => refreshPower());

  scene.events.on("undo-requested", () => undo());
  scene.events.on("redo-requested", () => redo());

  scene.events.on("clear-all-requested", () => {
    showConfirmOverlay(scene, {
      title: "Clear everything?",
      message: "This removes every part and wire you've placed (not the generator or ground). You can UNDO right after if you change your mind!",
      confirmLabel: "Yes, clear it",
      cancelLabel: "No, keep building",
      onConfirm: () => {
        pushUndo();
        clearAllNodesAndWires();
        markDirty();
        refreshPower();
        status.setText("Cleared! Fresh start.");
      },
    });
  });

  scene.events.on("run-check", () => {
    refreshPower();
    let houseOn = 0, houseDim = 0, houseOff = 0;
    let ledOn = 0, ledDim = 0, ledOff = 0, ledBurned = 0;

    for (const node of state.nodes.values()) {
      if (node.type === "HOUSE") {
        const lvl = state.powered.get(node.id)?.level ?? "OFF";
        if (lvl === "ON") houseOn++; else if (lvl === "DIM") houseDim++; else houseOff++;
      }
      if (node.type === "LED") {
        const lvl = state.powered.get(node.id)?.level ?? "OFF";
        if (lvl === "ON") ledOn++; else if (lvl === "DIM") ledDim++; else if (lvl === "BURNED") ledBurned++; else ledOff++;
      }
    }
    status.setText(`Houses: ${houseOn} bright, ${houseDim} dim, ${houseOff} dark.  LEDs: ${ledOn} bright, ${ledDim} dim, ${ledOff} dark, ${ledBurned} popped.`);
  });

  scene.input.on("pointerdown", (p) => {
    if (p.y < UI_HEIGHT) return;

    if (state.mode === Mode.WIRE) {
      if (state.previewLine) { clearPreview(); status.setText("Cancelled."); }
      return;
    }
    if (state.mode === Mode.DELETE) { deleteNearestWire(p.x, p.y); return; }

    if (state.mode === Mode.PLACE_HOUSE) { pushUndo(); placePart("HOUSE", p.x, p.y); refreshPower(); status.setText("Placed a house — wire it up!"); return; }
    if (state.mode === Mode.PLACE_RES) { pushUndo(); placePart("RES", p.x, p.y); refreshPower(); status.setText(`Placed a ${state.placeResOhms}Ω resistor.`); return; }
    if (state.mode === Mode.PLACE_CAP) { pushUndo(); placePart("CAP", p.x, p.y); refreshPower(); status.setText(`Placed a ${state.placeCapUF}µF capacitor.`); return; }
    if (state.mode === Mode.PLACE_XFR) { pushUndo(); placeXfmr(p.x, p.y); refreshPower(); status.setText("Placed a transformer."); return; }
    if (state.mode === Mode.PLACE_TRANS) { pushUndo(); placePart("TRANS", p.x, p.y); refreshPower(); status.setText("Placed a switch — tap its body to flip it."); return; }
    if (state.mode === Mode.PLACE_LED) { pushUndo(); placePart("LED", p.x, p.y); refreshPower(); status.setText("Placed an LED — give it a resistor buddy so it doesn't pop!"); return; }
  });

  refreshPower();
  status.setText("WIRE tool: tap two dots to connect them. Tap empty ground to cancel.");
}

function update(time, delta) {
  const scene = this;
  const state = scene.__state;
  if (!state) return;
  const dt = Math.max(0, delta) / 1000;
  if (scene.__refreshPower) scene.__refreshPower(dt);
  if (scene.__advanceDots) scene.__advanceDots(delta);
}
