// src/scene/editing.js
//
// Changing the circuit by tapping: deleting parts and wires, drawing new
// wires dot to dot, flipping switches, and fitting new LEDs in place of
// popped ones. Wire and switch changes go through Sparky's questions first.
//
// Gives city: registerNodeClicks, registerTransistorToggle, deleteAt, partAt,
// clearPreview, litHouseIds, sawOff, switchCycled.

function installEditing(city) {
  const { scene, state, status } = city;
  // --- Delete ---

  // Fit a new LED in place of every popped one the change touched (see
  // poppedLEDsTouched in src/circuit/diagnose.js). Returns the refitted ids.
  function refitPoppedLEDs(ids, wires) {
    const out = poppedLEDsTouched(state, ids, wires);
    for (const id of out) {
      const n = state.nodes.get(id);
      n.data.burned = false; n.data.justBurned = false; n.data.refitted = true;
    }
    return out;
  }
  const refitNote = (ids) => ids.length ? ` You fitted a new LED in ${ids.join(" and ")}.` : "";

  function deleteComponent(anyId) {
    const node = state.nodes.get(anyId);
    if (!node) return;
    if (node.type === "GEN" || node.type === "GND") {
      status.setText("The generator and ground can't be deleted — everything needs somewhere to plug in!");
      return;
    }
    const hotOf = node.data?.role === "primary" ? node : state.nodes.get(node.data?.pairId);
    if (hotOf?.data?.fixed) {
      Sfx.play("wrong");
      status.setText("That part belongs to this level — it can't be deleted. (You can drag it, and delete wires.)");
      return;
    }
    city.pushUndo();
    const pairId = node.data?.pairId;
    const idsToRemove = pairId ? [anyId, pairId] : [anyId];
    const hot = state.nodes.get(idsToRemove.find(id => state.nodes.get(id)?.data?.role === "primary"));
    const building = hot?.type === "HOUSE" && hot.data.building !== "house" ? BUILDINGS[hot.data.building]?.name : null;
    if (city.drag && idsToRemove.includes(city.drag.node.id)) city.drag = null;
    const touched = state.wires.filter(w => idsToRemove.includes(w.a) || idsToRemove.includes(w.b)).flatMap(w => [w.a, w.b]).filter(id => !idsToRemove.includes(id));
    const refit = refitPoppedLEDs(touched, state.wires);

    state.wires = state.wires.filter(w => {
      if (idsToRemove.includes(w.a) || idsToRemove.includes(w.b)) { w.line?.destroy(); w.labelText?.destroy(); return false; }
      return true;
    });

    const destroyed = new Set();
    for (const id of idsToRemove) {
      const n = state.nodes.get(id);
      if (!n) continue;
      city.destroyNodeObjects(n, destroyed);
      state.nodes.delete(id);
    }
    clearPreview();
    city.markDirty();
    // Status first: refreshPower replaces it if a refitted LED pops again.
    status.setText((building
      ? `The ${building.toLowerCase()} went back in your BUILD box. (Tap UNDO if that was a mistake.)`
      : "Deleted. (Tap UNDO if that was a mistake.)") + refitNote(refit));
    city.refreshPower();
    Sfx.play("delete");
  }

  // Distance from a point to a line segment.
  function pointSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Only a part's dots are interactive, so a tap on its body reaches the
  // scene. Find which part, if any, was tapped.
  function partAt(x, y) {
    for (const node of state.nodes.values()) {
      if (node.data?.role !== "primary" && node.type !== "GEN" && node.type !== "GND") continue;
      if (node.container?.getBounds().contains(x, y)) return node;
    }
    return null;
  }

  // DELETE tool tap: the nearest wire in reach wins (wires are thin, so a tap
  // on one is on purpose), then a part's body, then a decoration.
  function deleteAt(x, y) {
    let best = null, bestDist = 12;
    for (const w of state.wires) {
      const pa = city.nodePos(w.a), pb = city.nodePos(w.b);
      const d = pointSegDist(x, y, pa.x, pa.y, pb.x, pb.y);
      if (d < bestDist) { bestDist = d; best = w; }
    }
    if (!best) {
      const part = partAt(x, y);
      if (part) { deleteComponent(part.id); return; }
      const di = city.decorAt(x, y);
      if (di >= 0) { city.removeDecor(di); return; }
      status.setText("Tap closer to a wire (or a part) to delete it.");
      return;
    }
    const wire = best;
    city.maybeAsk({ removeWire: [wire.a, wire.b] }, "unwire", () => {
      if (!state.wires.includes(wire)) return false;
      city.pushUndo();
      const refit = refitPoppedLEDs([wire.a, wire.b], state.wires);
      wire.line?.destroy(); wire.labelText?.destroy();
      state.wires = state.wires.filter(w => w !== wire);
      city.markDirty();
      status.setText("Wire deleted. (Tap UNDO if that was a mistake.)" + refitNote(refit));
      city.refreshPower();
      Sfx.play("delete");
      return true;
    });
  }

  // --- Wiring ---
  function clearPreview() {
    if (state.previewLine) { state.previewLine.destroy(); state.previewLine = null; }
    state.wireStart = null;
  }

  function startWire(id) {
    clearPreview();
    state.wireStart = id;
    const p = city.nodePos(id);
    state.previewLine = scene.add.line(0, 0, p.x, p.y, p.x, p.y, PALN["4"]).setOrigin(0, 0).setLineWidth(4).setDepth(state.wireDepth);
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
    if (city.wireExists(a, b)) {
      clearPreview();
      status.setText("Those two are already wired together.");
      return;
    }
    // The wire is drawn now but only joins the circuit once committed
    // (right away, or after Sparky's question).
    const pa = city.nodePos(a), pb = city.nodePos(b);
    const line = state.previewLine;
    line.setTo(pa.x, pa.y, pb.x, pb.y);
    state.previewLine = null;
    state.wireStart = null;
    // A tight-budget level won't let you spend more than its budget.
    if (city.levelOverBudget(wireCost(Math.hypot(pa.x - pb.x, pa.y - pb.y)))) { line.destroy(); return; }
    city.maybeAsk({ addWire: [a, b] }, "wire", () => {
      if (!state.nodes.has(a) || !state.nodes.has(b) || city.wireExists(a, b)) { line.destroy(); return false; }
      city.pushUndo();
      city.sparkAt(pa.x, pa.y); city.sparkAt(pb.x, pb.y);
      line.setDepth(state.wireDepth);
      state.wires.push({ a, b, line, labelText: null, phase: Math.random() });
      const refit = refitPoppedLEDs([a, b], state.wires);
      city.markDirty();
      // Set this first: refreshPower may replace it with something more
      // important, like an LED popping.
      status.setText(`Connected ${a} to ${b}.${refitNote(refit)} Tap another dot to start the next wire.`);
      Sfx.play("wire");
      city.refreshPower();
      return true;
    });
  }

  // Dots are drawn 16px wide, too small for a finger, so each gets a larger
  // invisible tap circle (radius TAP_RADIUS).
  const TAP_RADIUS = 18;
  function registerNodeClicks(node) {
    const r = node.hit.radius;
    node.hit.setInteractive({
      hitArea: new Phaser.Geom.Circle(r, r, Math.max(r, TAP_RADIUS)),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });
    node.hit.on("pointerdown", (pointer, lx, ly, event) => {
      event.stopPropagation();
      // Big tap areas can overlap when dots are close (the starter town has
      // a pair 12px apart), so send the tap to the dot nearest the finger.
      const id = nearestDotId(pointer.worldX, pointer.worldY) ?? node.id;
      if (state.context === "make" && state.maker?.step === "goal") {
        // Maker step 2 sets the goal: tapping a light's dot picks that light.
        const n = state.nodes.get(id), hot = n && (n.type === "HOUSE" || n.type === "LED") ? n : n && state.nodes.get(n.data?.pairId);
        if (hot && (hot.type === "HOUSE" || hot.type === "LED")) city.makerTapLight(hot);
        else status.setText("In step 2 you only tap lights. Go back to 1 Build to change wires.");
        return;
      }
      if (state.mode === Mode.DELETE) { deleteComponent(id); return; }
      if (state.mode !== Mode.WIRE) {
        status.setText("Switch to the WIRE tool to connect dots.");
        return;
      }
      if (!state.wireStart) startWire(id);
      else finishWire(id);
    });
  }

  function nearestDotId(x, y) {
    let best = null, bestD = Infinity;
    for (const n of state.nodes.values()) {
      const d = Math.hypot(n.hit.x - x, n.hit.y - y);
      if (d < bestD) { bestD = d; best = n.id; }
    }
    return bestD <= TAP_RADIUS ? best : null;
  }

  // A switch's body flips it on a tap and moves it on a drag.
  function registerTransistorToggle(hotNode, toggleZone) {
    toggleZone.setInteractive({ useHandCursor: true });
    toggleZone.on("pointerdown", (pointer, lx, ly, event) => {
      event.stopPropagation();
      if (state.mode === Mode.DELETE) { deleteComponent(hotNode.id); return; }
      city.clearHelper();
      city.beginDrag(hotNode, pointer, () => toggleSwitch(hotNode));
    });
  }

  function litHouseIds() {
    const ids = new Set();
    for (const n of state.nodes.values()) if (n.type === "HOUSE" && state.powered.get(n.id)?.level === "ON") ids.add(n.id);
    return ids;
  }

  // Buildings a switch turned off (sawOff) and then back on (switchCycled),
  // for the "put a light switch on it" order.
  const sawOff = new Set(), switchCycled = new Set();

  function toggleSwitch(hotNode) {
    if (state.nodes.get(hotNode.id) !== hotNode) return; // deleted or rebuilt meanwhile
    city.maybeAsk({ flip: hotNode.id }, hotNode.data.on ? "switch-off" : "switch-on", () => {
      if (state.nodes.get(hotNode.id) !== hotNode) return false;
      const litBefore = litHouseIds();
      city.pushUndo();
      hotNode.data.on = !hotNode.data.on;
      city.markDirty();
      city.refreshPower();
      status.setText(`${hotNode.id} is now ${hotNode.data.on ? "ON (closed)" : "OFF (open)"}.`);
      Sfx.play("click");
      const litAfter = litHouseIds();
      for (const id of litBefore) if (!litAfter.has(id)) sawOff.add(id);
      for (const id of litAfter) if (!litBefore.has(id) && sawOff.has(id)) switchCycled.add(id);
      // "Light switch" mission: did this flip turn a house off, or back on
      // after an earlier flip turned one off?
      if (state.mission && !state.mission.done) {
        const turnedOn = [...litAfter].some(id => !litBefore.has(id));
        const turnedOff = [...litBefore].some(id => !litAfter.has(id));
        if (turnedOn && state.mission.sawOff) state.mission.cycled = true;
        if (turnedOff) state.mission.sawOff = true;
        city.checkMission();
      }
      city.refreshPower(); // an order may be done now (switchCycled changed)
      return true;
    });
  }

  Object.assign(city, { clearPreview, deleteAt, litHouseIds, partAt, registerNodeClicks, registerTransistorToggle, sawOff, switchCycled });
}
