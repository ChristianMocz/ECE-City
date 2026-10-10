// src/scene/board.js
//
// The board itself: placing parts and transformers, ids, wires, the "why is
// it dark?" highlight layer, and UNDO/REDO. A build is saved as a snapshot
// (parts, wires, id counters); the same snapshot saves your town and sets
// up missions and puzzles.
//
// Gives city: placePart, placeXfmr, addNode, nodePos, partName, wireKey,
// wireExists, createWireDirect, markDirty, serializeBuild, rebuildFrom,
// clearAllNodesAndWires, destroyNodeObjects, pushUndo, undo, redo, noUndoNow,
// clearHelper, showHelperBubble, helperGlow, helperMarks (and sets city.drag,
// city.townDirty, city.rebuilding, city.lastBoardChange, city.helperTween).

function installBoard(city) {
  const { scene, state, status } = city;
  // --- Helper highlights ---
  // Drawing for "why is it dark?" (the logic is in src/circuit/diagnose.js).
  const helperGlow = scene.add.graphics().setDepth(9);    // under the wires (depth 10)
  const helperMarks = scene.add.graphics().setDepth(22);  // over the dots (depth 21)
  let helperBubble = null, helperTimer = null; city.helperTween = null;

  // The part being dragged (see src/scene/touch.js). Set here so teardown can
  // always cancel it.
  city.drag = null;

  function clearHelper() {
    helperGlow.clear();
    helperMarks.clear();
    if (city.helperTween) { city.helperTween.stop(); city.helperTween = null; }
    helperMarks.setAlpha(1);
    if (helperTimer) { helperTimer.remove(false); helperTimer = null; }
    if (helperBubble) { helperBubble.destroy(); helperBubble = null; }
  }

  function showHelperBubble(x, y, text) {
    helperBubble = makeBubble(scene, x, y, text, 250, 302);
    helperTimer = scene.time.delayedCall(8000, clearHelper);
  }

  function nextId(prefix) {
    // Never reuse an id already on the board, even if a save's counters lag.
    let id;
    do { const n = state.counters[prefix] ?? 0; state.counters[prefix] = n + 1; id = `${prefix}${n}`; }
    while (state.nodes.has(id) || state.nodes.has(id + "b") || state.nodes.has(id + "P"));
    return id;
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

  city.townDirty = false;
  city.lastBoardChange = 0; // scene time of the last change to the board
  function markDirty() {
    state.dirty = true;
    state.levelDirty = true;
    if (!city.rebuilding) city.lastBoardChange = scene.time.now;
    if (state.context === "town" && !city.rebuilding) city.townDirty = true;
    clearHelper(); // the circuit changed, so any highlighted loop is out of date
  }

  // A friendly name for a building or LED.
  function partName(id) {
    const n = state.nodes.get(id);
    if (!n) return id;
    if (n.type === "LED") return `LED ${id}`;
    const b = n.data?.building;
    return b && b !== "house" && BUILDINGS[b] ? `the ${BUILDINGS[b].name.toLowerCase()} (${id})` : `house ${id}`;
  }

  // --- Placement ---
  // Every two-dot part is a pair of nodes: id (IN dot) and id+"b" (OUT dot).
  // Transformers use id+"P" and id instead, so they get placeXfmr.
  function placePart(kind, x, y, opts = {}) {
    const id = opts.id || nextId(PREFIX[kind]);
    const bId = id + "b";
    const hotData = { kind, role: "primary", pairId: bId };
    let obj;

    if (kind === "HOUSE") {
      // Every building is a house with its own load and voltage needs
      // (see BUILDINGS in src/rules/game.js).
      const building = opts.building && BUILDINGS[opts.building] ? opts.building : "house";
      obj = makeHouse(scene, x, y, building === "house" ? id : `${BUILDINGS[building].name} ${id}`, building);
      Object.assign(hotData, { building: building, R: BUILDINGS[building].R, vOn: BUILDINGS[building].vOn, vDim: BUILDINGS[building].vDim });
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
    } else if (kind === "SOLAR") {
      obj = makeSolar(scene, x, y, id);
    } else if (kind === "BAT") {
      obj = makeBattery(scene, x, y, id);
      hotData.C = state.BAT_C;
      hotData.Vprev = opts.Vprev ?? 0;
    } else {
      throw new Error(`Unknown part kind: ${kind}`);
    }

    if (opts.fixed) hotData.fixed = true; // a campaign level's own part: it can't be deleted
    const hotNode = addNode({ id, type: kind, container: obj.container, hit: obj.inHit, visual: obj.visual, data: hotData });
    const gndNode = addNode({ id: bId, type: kind + "_B", container: obj.container, hit: obj.outHit, visual: {}, data: { kind, role: "secondary", pairId: id } });

    city.registerNodeClicks(hotNode);
    city.registerNodeClicks(gndNode);
    if (kind === "TRANS" && obj.toggleHit) {
      city.registerTransistorToggle(hotNode, obj.toggleHit);
      // The toggle zone isn't inside the container, so it must be destroyed
      // with the part or it stays behind as an invisible tap target.
      hotNode.extraHits = [obj.toggleHit];
    }

    if (city.visualNight()) setPartNight(obj.visual, true);
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
      data: { kind: "XFMR", role: "primary", pairId: priId, ratio, ...(opts.fixed ? { fixed: true } : {}) },
    });

    city.registerNodeClicks(priNode);
    city.registerNodeClicks(secNode);
    if (city.visualNight()) setPartNight(obj.visual, true);
    markDirty();
    return { priNode, secNode };
  }

  function createWireDirect(a, b) {
    const pa = nodePos(a), pb = nodePos(b);
    const line = scene.add.line(0, 0, pa.x, pa.y, pb.x, pb.y, WIRE_COLOR).setOrigin(0, 0).setLineWidth(4).setDepth(state.wireDepth);
    state.wires.push({ a, b, line, labelText: null, phase: Math.random() });
  }

  // --- Undo and redo ---
  // Snapshot the whole build, tear it down, rebuild it.
  city.rebuilding = false;

  function serializeBuild() {
    const parts = [];
    for (const node of state.nodes.values()) {
      if (node.data.role !== "primary") continue;
      const kind = node.data.kind;
      const entry = { kind, id: node.id, x: node.container.x, y: node.container.y };
      if (kind === "HOUSE" && node.data.building && node.data.building !== "house") entry.building = node.data.building;
      if (kind === "RES") entry.ohms = node.data.ohms;
      if (kind === "CAP") { entry.uF = node.data.uF; entry.Vprev = node.data.Vprev; }
      if (kind === "BAT") entry.Vprev = node.data.Vprev;
      if (kind === "TRANS") entry.on = node.data.on;
      if (kind === "LED") entry.burned = node.data.burned;
      if (kind === "XFMR") entry.ratio = node.data.ratio;
      if (node.data.fixed) entry.fixed = true;
      parts.push(entry);
    }
    return {
      counters: { ...state.counters },
      parts,
      wires: state.wires.map(w => ({ a: w.a, b: w.b })),
    };
  }

  function destroyNodeObjects(node, destroyed) {
    if (node.container && !destroyed.has(node.container)) { node.container.destroy(true); destroyed.add(node.container); }
    node.hit?.destroy();
    for (const h of (node.extraHits || [])) h.destroy();
  }

  function clearAllNodesAndWires() {
    for (const w of state.wires) { w.line?.destroy(); w.labelText?.destroy(); }
    state.wires = [];
    const destroyed = new Set();
    for (const node of state.nodes.values()) {
      if (node.type === "GEN" || node.type === "GND") continue;
      destroyNodeObjects(node, destroyed);
    }
    for (const id of [...state.nodes.keys()]) {
      const n = state.nodes.get(id);
      if (n.type === "GEN" || n.type === "GND") continue;
      state.nodes.delete(id);
    }
    city.clearPreview();
    city.drag = null; // the part being dragged (if any) no longer exists
  }

  // Rebuild the board from a snapshot. Bad parts or wires in a save are
  // skipped instead of breaking the game.
  function rebuildFrom(snapshot) {
    city.rebuilding = true;
    clearAllNodesAndWires();
    state.counters = { ...DEFAULT_COUNTERS, ...(snapshot.counters || {}) };
    for (const part of snapshot.parts || []) {
      if (!part || !PLACEABLE_KINDS.has(part.kind) || !Number.isFinite(part.x) || !Number.isFinite(part.y)) continue;
      if (part.id && state.nodes.has(part.id)) continue;
      try {
        if (part.kind === "XFMR") placeXfmr(part.x, part.y, { id: part.id, ratio: part.ratio, fixed: part.fixed });
        else placePart(part.kind, part.x, part.y, part);
      } catch (e) { /* skip a part that can't be built */ }
    }
    for (const w of snapshot.wires || []) {
      if (!w || w.a === w.b || !state.nodes.has(w.a) || !state.nodes.has(w.b) || wireExists(w.a, w.b)) continue;
      createWireDirect(w.a, w.b);
    }
    city.rebuilding = false;
    markDirty();
    city.quietLights = true;
    city.refreshPower();
    city.quietLights = false;
  }

  // Pass `snapshot` to record the build from before a change already under
  // way (a drag) instead of as it is now.
  function pushUndo(snapshot) {
    if (city.rebuilding) return;
    state.undoStack.push(snapshot || serializeBuild());
    if (state.undoStack.length > state.historyLimit) state.undoStack.shift();
    state.redoStack = [];
  }

  const noUndoNow = () => state.context === "level" && state.level && state.level.mode === "noundo" && !state.level.done;
  function undo() {
    if (noUndoNow()) { Sfx.play("wrong"); status.setText("No UNDO in the No-undo challenge — DELETE a wire if you need to."); return; }
    if (!state.undoStack.length) { status.setText("Nothing to undo yet."); return; }
    state.redoStack.push(serializeBuild());
    rebuildFrom(state.undoStack.pop());
    Sfx.play("undo");
    status.setText("Undid that.");
  }
  function redo() {
    if (noUndoNow()) return;
    if (!state.redoStack.length) { status.setText("Nothing to redo."); return; }
    state.undoStack.push(serializeBuild());
    rebuildFrom(state.redoStack.pop());
    Sfx.play("undo");
    status.setText("Redid that.");
  }

  Object.assign(city, { addNode, clearAllNodesAndWires, clearHelper, createWireDirect, destroyNodeObjects, helperGlow, helperMarks, markDirty, noUndoNow, nodePos, partName, placePart, placeXfmr, pushUndo, rebuildFrom, redo, serializeBuild, showHelperBubble, undo, wireExists, wireKey });
}
