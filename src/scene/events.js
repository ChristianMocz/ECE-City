// src/scene/events.js
//
// Wires the scene together: creates the GEN and GND terminals, hooks every
// toolbar and menu event to its handler, handles taps on the board (place a
// part, start a drag, delete), and saves the town when the page is hidden.
//
// Gives city: genNode.

function installEvents(city) {
  const { UI_HEIGHT, onEvent, profile, save, scene, setToolLabel, state, status, windowListeners } = city;
  // --- Generator and ground ---
  const genObj = makeGenerator(scene, 130, 190);
  const genNode = city.addNode({ id: "GEN", type: "GEN", container: genObj.container, hit: genObj.outHit, visual: genObj.visual, data: {} });
  city.registerNodeClicks(genNode);

  // Smoke puffs from the stacks: more current, more smoke.
  let puffTurn = 0;
  scene.time.addEvent({
    delay: 380, loop: true, callback: () => {
      const amps = state.genAmps || 0;
      if (amps < 0.03 || Math.random() > 0.35 + amps / 2) return;
      const stacks = genNode.visual.stacks;
      if (!stacks.length) return;
      const stack = stacks[puffTurn++ % stacks.length];
      puffSmoke(scene, stack.x, stack.y, genNode.visual.steam);
    },
  });

  const gndObj = makeGroundTerminal(scene, 130, 480);
  const gndNode = city.addNode({ id: "GND", type: "GND", container: gndObj.container, hit: gndObj.inHit, visual: gndObj.visual, data: {} });
  city.registerNodeClicks(gndNode);

  // --- Pointer and UI events ---
  scene.input.on("pointermove", (p) => {
    if (city.drag && p.isDown) city.dragTo(p);
    if (!state.previewLine || !state.wireStart) return;
    const a = city.nodePos(state.wireStart);
    state.previewLine.setTo(a.x, a.y, p.x, p.y);
  });
  scene.input.on("pointerup", city.endDrag);
  scene.input.on("pointerupoutside", city.endDrag);

  onEvent("build-requested", city.openBuild);
  onEvent("map-requested", city.openMap);
  onEvent("stickers-requested", () => showStickers(scene, { profile }));
  onEvent("howto-requested", () => showIntro(scene, {}));
  onEvent("shop-requested", () => city.openShop());
  onEvent("wardrobe-requested", () => {
    if (!featureUnlocked(profile, "clothes")) { status.setText("CLOTHES unlock at level 2 — finish a couple of LEVELS first!"); return; }
    city.openWardrobe();
  });
  onEvent("phone-requested", () => city.openPhone());
  onEvent("today-requested", city.openToday);
  onEvent("orders-requested", city.openOrders);
  onEvent("daily-requested", city.openDaily);
  onEvent("missions-requested", city.openMissions);
  onEvent("levels-requested", () => city.openLevels(state.context === "level" && state.level ? state.level.def.world : profile.region));
  onEvent("menu-requested", () => showGameMenu(scene, {
    onHowTo: () => showIntro(scene, {}),
    onSettings: () => city.openSettings(),
    onTitle: () => { if (state.context === "town") city.saveTown(); save(); city.openTitle(); },
  }));
  onEvent("music-setting", (on) => { Music.setEnabled(on); });
  onEvent("skip-time-requested", city.skipTime);
  onEvent("settings-changed", () => save());

  onEvent("hint-requested", () => {
    city.clearHelper();
    const mission = state.mission;
    let text;
    if (state.context === "mission" && mission && !mission.done) text = MISSIONS[mission.index].hint;
    else if (state.context === "daily" && state.daily && !state.daily.done) text = DAILY_PUZZLES[state.daily.index].hint;
    else if (city.noUndoNow()) text = "No hints in the No-undo challenge — but you can still tap a dark light to see what's wrong.";
    else if (state.context === "level" && state.level) text = state.level.done ? "Level complete! Tap LEVELS to pick the next one." : state.level.def.hint;
    else if (state.context === "make" && state.maker) text = city.makerHelp();
    else if (state.context === "town" && state.emergency) text = state.emergency.plan.text;
    else if (state.context === "boss" && state.boss && !state.boss.done) {
      text = DIFFICULTIES[state.boss.difficulty].hints
        ? bossHint(breaksLeft(state.boss.breaks, state.wires, id => state.nodes.get(id)?.type === "TRANS" && !state.nodes.get(id).data.on))
        : "No hints in Extreme mode — but you can still tap a dark building to see what's wrong!";
    }
    else if (state.context === "town" && profile.repair) text = `Storm damage! The dashed red line shows the broken wire: tap ${profile.repair.a}'s dot, then ${profile.repair.b}'s dot, to wire it back up.`;
    else text = "Tap TODAY to see what to do next, or LEVELS ★ for puzzles. Tap a dark building to find out why it's dark. + BUILD adds parts; TODAY has your town's orders; your PHONE has the shop, map and more.";
    status.setText(text);
    city.showHelperBubble(scene.scale.width / 2, 330, text);
  });

  onEvent("tool-switch", (mode) => {
    city.clearPreview();
    state.mode = mode;
  });

  onEvent("toggles-changed", () => city.refreshPower());

  onEvent("undo-requested", () => city.undo());
  onEvent("redo-requested", () => city.redo());

  onEvent("clear-all-requested", () => {
    showConfirmOverlay(scene, {
      title: "Clear everything?",
      message: "This removes every part and wire you've placed (not the generator or ground). You can UNDO right after if you change your mind!",
      confirmLabel: "Yes, clear it",
      cancelLabel: "No, keep building",
      onConfirm: () => {
        city.pushUndo();
        city.clearAllNodesAndWires();
        city.markDirty();
        city.refreshPower();
        status.setText("Cleared! Fresh start.");
      },
    });
  });

  // Count bright, dim and dark lights.
  onEvent("run-check", () => {
    city.refreshPower();
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
    status.setText(`Buildings: ${houseOn} bright, ${houseDim} dim, ${houseOff} dark.  LEDs: ${ledOn} bright, ${ledDim} dim, ${ledOff} dark, ${ledBurned} popped.`);
  });

  // --- Taps on the board ---
  scene.input.on("pointerdown", (p) => {
    if (p.y < UI_HEIGHT || p.y > scene.scale.height - 44) return; // HUD / status bar
    // A tap used by a pop-up never also acts on the board (pop-ups already
    // stop it; this is a second guard).
    if (city.anyScreenOpen() || (scene.__overlayTapAt !== undefined && p.downTime === scene.__overlayTapAt)) return;
    city.clearHelper();

    if (state.context === "make" && state.maker?.step === "goal") { const part = city.partAt(p.x, p.y); if (part) city.tapPart(part); return; }
    if (state.mode === Mode.DELETE) { city.deleteAt(p.x, p.y); return; }
    if (state.mode === Mode.WIRE && state.previewLine) { city.clearPreview(); status.setText("Cancelled."); return; }

    // Press on a part: maybe a drag. Lifting without moving counts as a tap
    // (houses and LEDs then explain why they're dark).
    const part = city.partAt(p.x, p.y);
    if (part) {
      if (part.type === "GEN" || part.type === "GND" || (state.context === "make" && state.maker?.step !== "build")) city.tapPart(part);
      else city.beginDrag(part, p, () => city.tapPart(part));
      return;
    }
    if (state.mode === Mode.WIRE) return;

    const W = scene.scale.width;
    // Keep the whole part inside the field.
    const clampFor = (kind) => {
      const e = PART_EXTENT[kind];
      return {
        x: Phaser.Math.Clamp(p.x, FIELD_X_MARGIN, W - FIELD_X_MARGIN),
        y: Phaser.Math.Clamp(p.y, FIELD_TOP + e.up, FIELD_BOTTOM - e.down),
      };
    };
    const place = (kind, msg, opts) => {
      // In a campaign level, parts come from the level's toolbox and cost money.
      let tool = null;
      if (state.context === "level" && state.level) {
        tool = city.levelToolFor(kind);
        if (!tool || city.toolLeft(tool) <= 0) { city.pickTool(Mode.WIRE, "There are no more of those in this level's toolbox."); return; }
        if (city.levelOverBudget(PART_COST[kind] || 0)) return;
      }
      if (state.context === "make") {
        if (state.maker?.step !== "build") { city.pickTool(Mode.WIRE, "Parts go in during step 1 (Build)."); return; }
        if (city.serializeBuild().parts.length >= MAKER_MAX_PARTS) { city.pickTool(Mode.WIRE, `That's the most parts a puzzle can have (${MAKER_MAX_PARTS}).`); return; }
      }
      const { x, y } = clampFor(kind);
      city.pushUndo();
      if (kind === "XFMR") city.placeXfmr(x, y); else city.placePart(kind, x, y, opts);
      Sfx.play("place");
      city.refreshPower();
      status.setText(msg);
      if (tool && city.toolLeft(tool) <= 0) { scene.events.emit("tool-switch", Mode.WIRE); setToolLabel(); }
    };

    if (state.mode === Mode.PLACE_HOUSE) { place("HOUSE", "Placed a house — wire it up!"); return; }
    if (state.mode === Mode.PLACE_RES) { place("RES", `Placed a ${state.placeResOhms}Ω resistor.`); return; }
    if (state.mode === Mode.PLACE_CAP) { place("CAP", `Placed a ${state.placeCapUF}µF capacitor.`); return; }
    if (state.mode === Mode.PLACE_XFR) { place("XFMR", "Placed a transformer — orange dot is the input side, blue dot is the output side."); return; }
    if (state.mode === Mode.PLACE_TRANS) { place("TRANS", "Placed a switch — tap its body to flip it."); return; }
    if (state.mode === Mode.PLACE_LED) { place("LED", "Placed an LED — give it a resistor buddy so it doesn't pop!"); return; }
    if (state.mode === Mode.PLACE_SOLAR) { place("SOLAR", "Placed a solar panel — wire a loop from its orange dot, through a building, back to its blue dot. It only works in daylight!"); return; }
    if (state.mode === Mode.PLACE_BAT) { place("BAT", "Placed a battery — charge it from GEN in the day, and it can keep a building lit at night."); return; }

    if (state.mode === Mode.PLACE_BUILDING) {
      const key = state.placeBuilding;
      if (state.context !== "town" || !BUILDINGS[key]) { city.pickTool(Mode.WIRE, "Buildings go in your town."); return; }
      if (buildingsAvailable(profile, key, state) <= 0) { city.pickTool(Mode.WIRE, `You've placed every ${BUILDINGS[key].name.toLowerCase()} you own. Buy more in PHONE → Shop.`); return; }
      place("HOUSE", `Placed the ${BUILDINGS[key].name.toLowerCase()}! ${BUILDINGS[key].need} Wire it up!`, { building: key });
      if (buildingsAvailable(profile, key, state) <= 0) { scene.events.emit("tool-switch", Mode.WIRE); setToolLabel(); }
      return;
    }
    if (state.mode === Mode.PLACE_DECOR) {
      const key = state.placeDecor;
      if (state.context !== "town" || !DECOR[key]) { city.pickTool(Mode.WIRE, "Decorations go in your town."); return; }
      if (city.decorLeft(key) <= 0) { city.pickTool(Mode.WIRE, `You've placed every ${DECOR[key].name.toLowerCase()} you own. Buy more in PHONE → Shop.`); return; }
      profile.decorPlaced.push({
        key,
        x: Math.round(Phaser.Math.Clamp(p.x, 30, W - 30)),
        y: Math.round(Phaser.Math.Clamp(p.y, FIELD_TOP + 20, FIELD_BOTTOM - 20)),
        region: profile.region,
      });
      city.drawDecor();
      save();
      Sfx.play("place");
      status.setText(`Placed the ${DECOR[key].name.toLowerCase()}. Pretty! (DELETE puts it back in your BUILD box.)`);
      if (city.decorLeft(key) <= 0) { scene.events.emit("tool-switch", Mode.WIRE); setToolLabel(); }
    }
  });

  // Save the town when the page is hidden or closed.
  if (typeof window !== "undefined" && window.addEventListener) {
    const flush = () => { if (state.context === "town") city.saveTown(); else save(); };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener?.("visibilitychange", onHide);
    windowListeners.push([window, "pagehide", flush], [document, "visibilitychange", onHide]);
  }

  Object.assign(city, { genNode });
}
