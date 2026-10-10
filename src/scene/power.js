// src/scene/power.js
//
// Solves the circuit and updates every part's look to match: house windows,
// LED brightness and pop effects, the GEN's supply label, capacitor and
// battery gauges, wire colors and the moving current dots. Then runs the
// mission, puzzle, level, boss, emergency and economy checks.
//
// Gives city: refreshPower, updateWireVisuals, hasAnyStore (and sets city.quietLights).

function installPower(city) {
  const { dotsGfx, scene, state, status } = city;
  // --- Power and visuals ---
  // Capacitors and batteries change over time, so they need a solve every frame.
  function hasAnyStore() {
    for (const n of state.nodes.values()) if (n.type === "CAP" || n.type === "BAT") return true;
    return false;
  }

  function colorForCurrent(absI) {
    if (absI >= state.WIRE_HOT_I) return PALN["2"];
    if (absI >= state.WIRE_WARM_I) return PALN["3"];
    return WIRE_COLOR;
  }

  function ensureWireLabel(w) {
    if (w.labelText) return w.labelText;
    w.labelText = scene.add.text(0, 0, "", {
      fontFamily: GAME_FONT, fontSize: "12px", color: "#1a1c2c", backgroundColor: "rgba(244,244,244,0.85)",
    }).setDepth(25);
    return w.labelText;
  }

  function updateWireVisuals() {
    const showWireI = state.showCurrent && state.advancedWireCurrent;
    for (const w of state.wires) {
      const key = city.wireKey(w.a, w.b);
      const metrics = state.wireMetrics.get(key);
      const absI = metrics ? Math.abs(metrics.Iab) : 0;
      w.line.strokeColor = colorForCurrent(absI);

      if (!showWireI) {
        if (w.labelText) w.labelText.setVisible(false);
        continue;
      }
      const label = ensureWireLabel(w);
      const pa = city.nodePos(w.a), pb = city.nodePos(w.b);
      label.setPosition((pa.x + pb.x) / 2 - 28, (pa.y + pb.y) / 2 - 10);
      label.setText(`I=${absI.toFixed(2)}A`);
      label.setVisible(true);
    }
  }

  // dtForCaps: simulated seconds since the last solve. Only the per-frame
  // update passes a real time; refreshes after a tap or edit pass 0.
  function refreshPower(dtForCaps = 0) {
    if (state.dirty || hasAnyStore()) {
      computePower(state, dtForCaps);
      state.dirty = false;
    }

    const genNode = state.nodes.get("GEN");
    if (genNode?.visual?.supplyLabel) {
      if (state.solverError) {
        genNode.visual.supplyLabel.setText("can't calculate this circuit");
      } else {
        const totalI = genAmps(state);
        genNode.visual.supplyLabel.setText(state.genOff && genEmf(state) < state.V ? "resting (too weak)" : `supplying ${totalI.toFixed(2)}A`);
        state.genAmps = totalI;
        setGeneratorVisual(genNode.visual, totalI);
      }
    }
    const night = city.visualNight();

    for (const node of state.nodes.values()) {
      if (node.type === "HOUSE") {
        const p = state.powered.get(node.id) || { V: 0, I: 0, level: "OFF" };
        setHouseVisual(node.visual, p.level, night);
        node.visual.voltLabel.setText(`V=${p.V.toFixed(2)}V`);
        node.visual.currLabel.setText(`I=${p.I.toFixed(2)}A`);
        node.visual.voltLabel.setVisible(!!state.showVoltage);
        node.visual.currLabel.setVisible(!!state.showCurrent);
      }

      if (node.type === "LED") {
        const p = state.powered.get(node.id) || { V: 0, I: 0, level: "OFF" };
        const glow = p.level === "BURNED" ? null : Math.max(0, Math.min(1, p.I / state.I_LED_BRIGHT));
        setLEDVisual(node.visual, p.level, glow, night);
        node.visual.voltLabel.setText(`V=${p.V.toFixed(2)}V`);
        node.visual.currLabel.setText(`I=${(p.I * 1000).toFixed(1)}mA`);
        node.visual.voltLabel.setVisible(!!state.showVoltage);
        node.visual.currLabel.setVisible(!!state.showCurrent);

        if (node.data.justBurned) {
          node.data.justBurned = false;
          const pos = city.nodePos(node.id);
          playBurnoutEffect(scene, pos.x, pos.y - 10, "Whoa, too much power!\nI need a resistor buddy\nto slow things down.");
          Sfx.play("pop");
          scene.cameras.main.shake(170, 0.006);
          if (state.level && !state.level.done) state.level.popped = true;
          const why = ledPopCause(state, node.id);
          status.setText(`${node.id} popped${node.data.refitted ? " again" : ""}! ${why.text} Then tap the LED to fit a new one.`);
        }
        node.data.refitted = false;
      }

      if (node.type === "TRANS") setTransistorVisual(node.visual, !!node.data.on);
      if (node.type === "RES" && node.visual?.ohmLabel) node.visual.ohmLabel.setVisible(!!state.showResistance);
      if (node.type === "CAP" && node.visual?.capLabel) {
        node.visual.capLabel.setVisible(!!state.showResistance);
        const Vcap = Math.abs(node.data.Vprev ?? 0); // voltage across it after this solve
        setCapacitorVisual(node.visual, Vcap / state.V);
        node.visual.voltLabel.setText(`${Vcap.toFixed(1)}V`);
        node.visual.voltLabel.setVisible(!!state.showVoltage);
      }
      if (node.type === "BAT" && node.visual?.level) setBatteryVisual(node.visual, Math.abs(node.data.Vprev ?? 0) / state.V);
      if (node.type === "SOLAR" && node.visual?.sunLabel) {
        const f = state.solarFactor ?? 1;
        node.visual.sunLabel.setText(f > 0 ? `${Math.round(f * 100)}% sun` : "no sun");
      }
      if (node.type === "XFMR_SEC" && node.visual?.ratioLabel) node.visual.ratioLabel.setVisible(!!state.showResistance);
    }

    updateWireVisuals();
    chimeForNewLights();
    city.checkMission();
    city.checkDaily();
    city.checkBoss();
    city.checkLevel(dtForCaps);
    city.checkEmergencyNow(dtForCaps);
    city.townEconomy(dtForCaps);
  }

  scene.__refreshPower = refreshPower;

  // A chime when a house or LED newly lights up. Silent on the first solve
  // and while the board is rebuilt (UNDO, REDO, loading a mission).
  let prevLit = null;
  city.quietLights = false;
  function chimeForNewLights() {
    const lit = new Set();
    for (const [id, p] of state.powered) if (p.level === "ON") lit.add(id);
    const fresh = prevLit && !city.quietLights ? [...lit].filter(id => !prevLit.has(id)) : [];
    if (fresh.length) {
      Sfx.play("light");
      // Stickers for lighting things up yourself.
      const types = fresh.map(id => state.nodes.get(id)?.type);
      if (types.includes("HOUSE")) city.sticker("first_light");
      if (types.includes("LED")) city.sticker("led_saver");
      if (types.includes("HOUSE") && (state.genAmps ?? 0) < 0.001 && [...state.nodes.values()].some(n => n.type === "SOLAR") && !state.solverError) city.sticker("sun_catcher");
    }
    prevLit = lit;
  }

  // Dots drifting along every wire that carries current. Speed and count grow
  // with |I|; direction follows the current's sign. Uses the last solve.
  function advanceCurrentDots(deltaMs) {
    dotsGfx.clear();
    const dtSec = Math.max(0, deltaMs) / 1000;
    for (const w of state.wires) {
      const metrics = state.wireMetrics.get(city.wireKey(w.a, w.b));
      const I = metrics ? metrics.Iab : 0;
      const absI = Math.abs(I);
      if (absI < 0.001) continue;

      if (w.phase == null) w.phase = 0;
      const speed = Math.min(2.2, 0.5 + absI * 1.2);
      const dir = I < 0 ? -1 : 1;
      w.phase = ((w.phase + dtSec * speed * dir) % 1 + 1) % 1;

      const pa = city.nodePos(w.a), pb = city.nodePos(w.b);
      const dotCount = Math.min(6, Math.max(2, Math.round(absI * 3)));
      dotsGfx.fillStyle(PALN["B"], 1);
      for (let k = 0; k < dotCount; k++) {
        const t = (w.phase + k / dotCount) % 1;
        dotsGfx.fillRect(Math.round(pa.x + (pb.x - pa.x) * t) - 3, Math.round(pa.y + (pb.y - pa.y) * t) - 3, 6, 6);
      }
    }
  }
  scene.__advanceDots = advanceCurrentDots;

  Object.assign(city, { hasAnyStore, refreshPower, updateWireVisuals });
}
