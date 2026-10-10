// src/scene/touch.js
//
// Touching parts on the board: drag a part's body to move it (its dots and
// wires follow), or tap it to see why a light is dark or what a part is.
//
// Gives city: beginDrag, dragTo, endDrag, tapPart (and uses city.drag).

function installTouch(city) {
  const { scene, state, status } = city;
  // --- Drag to move ---
  // A press that doesn't move counts as a tap (see tapPart). One UNDO puts a
  // move back. GEN and GND never move.
  const DRAG_START_PX = 8;

  function beginDrag(node, pointer, onTap) {
    city.drag = { node, sx: pointer.x, sy: pointer.y, ox: node.container.x, oy: node.container.y, moved: false, snap: null, onTap };
  }

  function movePartTo(node, x, y) {
    const dx = x - node.container.x, dy = y - node.container.y;
    if (!dx && !dy) return;
    node.container.x += dx;
    node.container.y += dy;
    const ids = [node.id, node.data.pairId];
    for (const id of ids) {
      const n = state.nodes.get(id);
      if (!n) continue;
      n.hit.x += dx; n.hit.y += dy;
      for (const h of (n.extraHits || [])) { h.x += dx; h.y += dy; }
    }
    for (const w of state.wires) {
      if (!ids.includes(w.a) && !ids.includes(w.b)) continue;
      const pa = city.nodePos(w.a), pb = city.nodePos(w.b);
      w.line.setTo(pa.x, pa.y, pb.x, pb.y);
    }
    city.updateWireVisuals();
  }

  function dragTo(pointer) {
    if (!city.drag.moved) {
      if (Math.hypot(pointer.x - city.drag.sx, pointer.y - city.drag.sy) < DRAG_START_PX) return;
      city.drag.moved = true;
      city.drag.snap = city.serializeBuild(); // the build before the move, for UNDO
      city.clearHelper();
    }
    const e = PART_EXTENT[city.drag.node.data.kind];
    const W = scene.scale.width;
    movePartTo(city.drag.node,
      Phaser.Math.Clamp(city.drag.ox + pointer.x - city.drag.sx, FIELD_X_MARGIN, W - FIELD_X_MARGIN),
      Phaser.Math.Clamp(city.drag.oy + pointer.y - city.drag.sy, FIELD_TOP + e.up, FIELD_BOTTOM - e.down));
  }

  function endDrag() {
    if (!city.drag) return;
    const d = city.drag;
    city.drag = null;
    if (state.nodes.get(d.node.id) !== d.node) return; // part vanished mid-drag
    if (d.moved) {
      city.pushUndo(d.snap);
      if (state.context === "town") city.townDirty = true;
      status.setText(`Moved ${d.node.id}. (UNDO puts it back.)`);
    } else {
      d.onTap();
    }
  }

  // A plain tap (no drag) on a part's body.
  function tapPart(part) {
    if (state.context === "make" && state.maker?.step === "goal") {
      if (part.type === "HOUSE" || part.type === "LED") city.makerTapLight(part);
      else status.setText("Tap the houses and LEDs to set the goal.");
      return;
    }
    if (part.type === "LED" && part.data.burned) {
      city.pushUndo();
      part.data.burned = false; part.data.justBurned = false; part.data.refitted = true;
      city.clearHelper();
      city.markDirty();
      status.setText(`You fitted a new LED in ${part.id}.`);
      Sfx.play("click");
      city.refreshPower();
      return;
    }
    if (part.type === "HOUSE" || part.type === "LED") {
      city.refreshPower();
      const d = diagnosePart(state, part.id);
      if (d) {
        showDiagnosis(d);
        // A shop building also says what it needs.
        const b = part.data?.building;
        if (part.type === "HOUSE" && b && b !== "house" && BUILDINGS[b]) status.setText(`${d.message} (${BUILDINGS[b].need})`);
      }
      return;
    }
    // Everything else gets a "What is this?" card.
    const info = describePart(state, part.id);
    city.clearHelper();
    if (info) {
      const box = part.container.getBounds();
      city.showHelperBubble(box.centerX, box.top - 50, info);
      Sfx.play("blip");
    }
    const how = part.type === "GEN" || part.type === "GND"
      ? " Wire parts to its round dot."
      : state.mode === Mode.WIRE ? " To wire it, tap its round dots — orange is where power goes in, blue is where it comes out." : " Drag it to move it.";
    // The bubble shows the whole card; the status bar only the first
    // sentence, so it fits in two lines.
    const headline = info ? info.split(/(?<=[.!])\s/)[0] : "";
    status.setText((headline + how).trim());
  }

  // Highlight the loop that should carry power and mark what's wrong.
  function showDiagnosis(d) {
    city.clearHelper();
    city.helperGlow.lineStyle(14, d.lit ? 0x4cd964 : 0xffd84d, 0.6);
    for (const w of state.wires) {
      if (!d.path.includes(city.wireKey(w.a, w.b))) continue;
      const pa = city.nodePos(w.a), pb = city.nodePos(w.b);
      city.helperGlow.lineBetween(pa.x, pa.y, pb.x, pb.y);
    }
    city.helperMarks.lineStyle(4, 0xe8222b, 1);
    for (const m of d.marks) {
      const n = state.nodes.get(m.nodeId);
      if (!n) continue;
      if (m.kind === "gap") {
        const { x, y } = city.nodePos(m.nodeId);
        city.helperMarks.strokeCircle(x, y, 17);
        city.helperMarks.lineBetween(x + 14, y - 26, x + 26, y - 14);
        city.helperMarks.lineBetween(x + 14, y - 14, x + 26, y - 26);
      } else {
        const box = n.container.getBounds();
        city.helperMarks.strokeRoundedRect(box.x - 6, box.y - 6, box.width + 12, box.height + 12, 10);
      }
    }
    if (d.marks.length) city.helperTween = scene.tweens.add({ targets: city.helperMarks, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
    const box = state.nodes.get(d.id).container.getBounds();
    city.showHelperBubble(box.centerX, box.top - 50, d.message);
    status.setText(d.message);
    Sfx.play("blip");
  }

  Object.assign(city, { beginDrag, dragTo, endDrag, tapPart });
}
