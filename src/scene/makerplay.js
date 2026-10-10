// src/scene/makerplay.js
//
// The Puzzle maker (board context "make"), in three steps:
//   1 Build: place parts and any wires the puzzle starts with
//   2 Goal:  tap lights (✓ must be bright, ✗ must stay dark)
//   3 Test:  solve it yourself, then name it, set the budget and get a share code
// Also plays puzzles from a share code.
//
// Gives city: makerHelp, makerSetStep, makerTapLight, makerTick,
// openCodeEntry, openMakerHome, playPuzzle, startMaker.
// Uses: src/rules/maker.js, src/ui/makerscreens.js.

function installMakerplay(city) {
  const { profile, save, scene, setBanner, state, status } = city;
  function openMakerHome() {
    showMakerHome(scene, {
      profile,
      onNew: () => startMaker(),
      onCode: () => openCodeEntry(),
      onPlayMine: (m) => { const r = decodePuzzle(m.code); if (r.ok) playPuzzle(r.puzzle, m.code); else city.cantBuy(r.why); },
      onShareMine: (m) => showShareCode(scene, { name: m.name, code: m.code, onBack: openMakerHome }),
    });
  }
  function openCodeEntry() {
    showCodeEntry(scene, { onPlay: (pz, code) => playPuzzle(pz, code), onBack: () => (featureUnlocked(profile, "maker") ? openMakerHome() : null) });
  }
  function playPuzzle(pz, code) {
    city.startLevel(puzzleToLevel(pz, code), "normal");
    status.setText(`"${pz.name}": ${makerGoalText(pz.goal)} Budget $${pz.budget}${pz.tight ? " (tight!)" : ""}.`);
  }
  function makerHelp() {
    const maker = state.maker;
    if (maker.step === "build") return "Step 1: + BUILD to place parts (up to 16). Any wires you add now are already there when someone plays. Then tap 2 Goal.";
    if (maker.step === "goal") return "Step 2: tap each light. Once = ✓ must be bright. Twice = ✗ must stay dark. Three times = doesn't matter. Then tap 3 Test.";
    return "Step 3: solve your own puzzle! Wire it so every ✓ is bright and every ✗ is dark. Then you pick the budget and get a code to share.";
  }
  const MAKER_EMPTY = { counters: { ...DEFAULT_COUNTERS }, parts: [], wires: [] };
  function startMaker(draft = null) {
    city.enterContext("make", draft || MAKER_EMPTY);
    state.maker = { step: "build", draft: null, goal: { lit: new Set(), dark: new Set() }, marks: [], bar: null, test: null };
    if (draft?.goal) { state.maker.goal = { lit: new Set(draft.goal.lit), dark: new Set(draft.goal.dark) }; }
    drawMakerBar();
    setBanner("Puzzle maker — 1 Build: place parts and any starting wires.");
    status.setText(makerHelp());
    city.refreshBadges();
  }
  function drawMakerBar() {
    const maker = state.maker;
    if (maker.bar) maker.bar.destroy();
    maker.bar = makeMakerBar(scene, { step: maker.step, onStep: (k) => makerSetStep(k), onExit: () => { city.backToTown(); city.refreshBadges(); } });
  }
  function makerLights() { return [...state.nodes.values()].filter(n => n.type === "HOUSE" || n.type === "LED"); }
  function drawMakerMarks() {
    const maker = state.maker;
    for (const o of maker.marks) o.destroy();
    maker.marks = [];
    if (maker.step === "build") return;
    for (const n of makerLights()) {
      const lit = maker.goal.lit.has(n.id), dark = maker.goal.dark.has(n.id);
      if (!lit && !dark) { if (maker.step !== "goal") continue; }
      const box = n.container.getBounds();
      const t = scene.add.text(box.centerX, box.top - 4, lit ? "✓ bright" : dark ? "✗ dark" : "?", {
        fontFamily: GAME_FONT, fontSize: "15px", fontStyle: "bold", color: lit ? "#a7f070" : dark ? "#ff9f9f" : "#f4f4f4", stroke: "#1a1c2c", strokeThickness: 4,
      }).setOrigin(0.5, 1).setDepth(208);
      maker.marks.push(t);
    }
  }
  function makerGoal() { return { lit: [...state.maker.goal.lit], dark: [...state.maker.goal.dark] }; }
  function makerSetStep(step) {
    const maker = state.maker;
    if (!maker || maker.step === step) return;
    if (maker.step === "build") {
      // Leaving Build: remember the board as the puzzle's start.
      const snap = city.serializeBuild();
      const nParts = snap.parts.length;
      if (!nParts) { city.cantBuy("Place some parts first (+ BUILD)."); return; }
      if (!makerLights().length) { city.cantBuy("Add at least one house or LED to light up."); return; }
      maker.draft = snap;
      for (const id of [...maker.goal.lit, ...maker.goal.dark]) if (!state.nodes.has(id)) { maker.goal.lit.delete(id); maker.goal.dark.delete(id); }
    }
    if (step === "test") {
      if (!maker.goal.lit.size) { city.cantBuy("Step 2 first: tap at least one light so it must be bright."); if (maker.step === "build") { maker.step = "goal"; drawMakerBar(); drawMakerMarks(); } return; }
      const draft = JSON.parse(JSON.stringify(maker.draft));
      for (const p of draft.parts) p.fixed = true;
      city.rebuildFrom(draft); state.undoStack = []; state.redoStack = []; city.refreshPower();
      const def = puzzleToLevel({ name: "test", world: profile.region, parts: maker.draft.parts.map(makerPartOf), wires: maker.draft.wires, goal: makerGoal(), budget: 999, tight: false, par: 1 });
      if (checkLevelWin(def, state)) { city.cantBuy("It's already solved before any wiring! Remove a starting wire or change the goal."); city.rebuildFrom(JSON.parse(JSON.stringify(maker.draft))); maker.step = "goal"; drawMakerBar(); drawMakerMarks(); return; }
      maker.test = { def, done: false };
      maker.step = "test";
      setBanner("Puzzle maker — 3 Test: solve your own puzzle!");
    } else if (step === "build") {
      if (maker.draft) { city.rebuildFrom(JSON.parse(JSON.stringify(maker.draft))); state.undoStack = []; state.redoStack = []; city.refreshPower(); }
      maker.test = null; maker.step = "build";
      setBanner("Puzzle maker — 1 Build: place parts and any starting wires.");
    } else if (step === "goal") {
      if (maker.step === "test" && maker.draft) { city.rebuildFrom(JSON.parse(JSON.stringify(maker.draft))); state.undoStack = []; state.redoStack = []; city.refreshPower(); }
      maker.test = null; maker.step = "goal";
      setBanner("Puzzle maker — 2 Goal: tap each light (✓ bright / ✗ dark).");
      city.pickTool(Mode.WIRE);
    }
    drawMakerBar();
    drawMakerMarks();
    status.setText(makerHelp());
  }
  // A placed part (snapshot form) as a puzzle part, with positions on a 2px grid.
  function makerPartOf(p) {
    const out = { kind: p.kind, id: p.id, x: Math.round(p.x / 2) * 2, y: Math.round(p.y / 2) * 2 };
    if (p.kind === "RES") out.ohms = p.ohms ?? 470;
    if (p.kind === "CAP") { out.uF = p.uF ?? 220; out.Vprev = 0; }
    if (p.kind === "BAT") out.Vprev = Math.round(Math.max(0, Math.min(12, p.Vprev ?? 0)));
    if (p.kind === "XFMR") out.ratio = p.ratio ?? 1;
    if (p.kind === "TRANS") out.on = p.on !== false;
    if (p.kind === "HOUSE" && p.building && p.building !== "house") out.building = p.building;
    return out;
  }
  // Each tap cycles: must be bright, must stay dark, doesn't matter.
  function makerTapLight(part) {
    const maker = state.maker, id = part.id;
    if (maker.goal.lit.has(id)) { maker.goal.lit.delete(id); maker.goal.dark.add(id); }
    else if (maker.goal.dark.has(id)) maker.goal.dark.delete(id);
    else maker.goal.lit.add(id);
    Sfx.play("click");
    drawMakerMarks();
    status.setText(`${id}: ${maker.goal.lit.has(id) ? "must be BRIGHT ✓" : maker.goal.dark.has(id) ? "must stay DARK ✗" : "doesn't matter"}.`);
  }
  // Wires added in the test, and what they cost (the starting wires are free).
  function makerSpent() {
    const maker = state.maker; let spent = 0, wiresAdded = 0;
    for (const w of state.wires) {
      if (maker.draft.wires.some(v => (v.a === w.a && v.b === w.b) || (v.a === w.b && v.b === w.a))) continue;
      const pa = city.nodePos(w.a), pb = city.nodePos(w.b);
      spent += wireCost(Math.hypot(pa.x - pb.x, pa.y - pb.y)); wiresAdded++;
    }
    return { spent, wiresAdded };
  }
  // In the Test step, check for a win every 6th frame.
  let makerCheckTimer = 0;
  function makerTick() {
    const maker = state.maker;
    if (state.context !== "make" || !maker || maker.step !== "test" || !maker.test || maker.test.done) return;
    makerCheckTimer += 1;
    if (makerCheckTimer % 6) return;
    let won = false;
    try { won = checkLevelWin(maker.test.def, state); } catch (e) { won = false; }
    if (!won || city.anyScreenOpen()) return;
    maker.test.done = true;
    const c = makerSpent();
    Sfx.play("win");
    playCelebration(scene, "Your puzzle works!", "★  Solved!  ★");
    scene.time.delayedCall(1600, () => {
      if (state.maker !== maker) return;
      showMakerFinish(scene, {
        spent: Math.max(1, c.spent), wires: c.wiresAdded, defaultName: `${REGIONS[profile.region].name} puzzle ${(profile.myPuzzles || []).length + 1}`,
        onKeepEditing: () => { maker.test.done = false; makerSetStep("build"); },
        onSave: ({ name, budget, tight }) => {
          const puzzle = { name, world: profile.region, parts: maker.draft.parts.map(makerPartOf), wires: maker.draft.wires.map(w => ({ a: w.a, b: w.b })), goal: makerGoal(), budget, tight, par: Math.max(1, c.wiresAdded) };
          const check = validatePuzzle(puzzle);
          if (!check.ok) { city.cantBuy(check.why); maker.test.done = false; return; }
          const code = encodePuzzle(puzzle);
          profile.myPuzzles = [{ name, code }, ...(profile.myPuzzles || []).filter(x => x.code !== code)].slice(0, 12);
          save();
          city.sticker("puzzle_maker");
          city.backToTown();
          showShareCode(scene, { name, code, onBack: openMakerHome });
        },
      });
    });
  }

  Object.assign(city, { makerHelp, makerSetStep, makerTapLight, makerTick, openCodeEntry, openMakerHome, playPuzzle, startMaker });
}
