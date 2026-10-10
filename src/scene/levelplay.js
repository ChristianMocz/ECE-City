// src/scene/levelplay.js
//
// Playing a campaign level: the level picker, loading a level's board, its
// toolbox and budget, the win check, stars, time trials and no-undo runs.
//
// Gives city: openLevels, startLevel, checkLevel, levelSpentNow,
// levelOverBudget, toolLeft.
// Uses: src/rules/campaign.js, src/rules/levels.js, src/ui/levelmap.js.

function installLevelplay(city) {
  const { profile, save, scene, setBanner, state, status } = city;
  // --- Campaign levels ---
  let levelCheckTimer = 0;
  function openLevels(world = profile.region, opts = {}) {
    showLevels(scene, {
      profile, world,
      onWorld: (w, s) => { s.close(); openLevels(w); },
      onPick: (lv, s, u) => {
        if (!u.ok) { city.cantBuy(u.why); return; }
        s.close();
        showLevelCard(scene, { profile, level: lv, onPlay: (l, mode) => startLevel(l, mode), onBack: () => openLevels(lv.world) });
      },
      onTraining: (s) => { s.close(); city.openMissions(); },
      onBack: state.context !== "town" ? (s) => { s.close(); city.backToTown(); } : null,
    });
  }

  // mode: "normal", "time" (a time trial) or "noundo" (no UNDO, no HINT).
  function startLevel(def, mode = "normal") {
    const snap = JSON.parse(JSON.stringify(def.board));
    for (const p of snap.parts) p.fixed = true;
    city.enterContext("level", snap);
    state.level = { def, done: false, popped: false, mode, time: 0, cardsBefore: notebookCards(profile).length };
    levelCheckTimer = 0;
    setRegionScenery(scene, def.world);
    city.applyEnvironment(true);
    city.refreshPower();
    city.playMusicHere();
    const where = def.custom ? `"${def.title}"` : def.expert ? `${REGIONS[def.world].name} EXPERT` : `${REGIONS[def.world].name} ${def.n}`;
    setBanner(`★ ${where}: ${def.goal}`);
    const modeNote = mode === "time" ? " ⏱ Time trial: the clock is running!" : mode === "noundo" ? " No-undo challenge: no UNDO and no HINT — think first!" : " Stuck? Tap ? HINT.";
    status.setText(`${def.title}: ${def.goal}${def.tool.length ? " Your parts are in + BUILD." : ""}${modeNote}`);
    city.updateChip();
    city.refreshBadges();
  }

  // Money spent in this level: added wires (by length) and placed parts.
  // The level's own wires and parts are free.
  function levelSpentNow() {
    const level = state.level?.def;
    if (!level) return { spent: 0, wiresAdded: 0 };
    let spent = 0, wiresAdded = 0;
    for (const w of state.wires) {
      if (level.board.wires.some(v => (v.a === w.a && v.b === w.b) || (v.a === w.b && v.b === w.a))) continue;
      const pa = city.nodePos(w.a), pb = city.nodePos(w.b);
      spent += wireCost(Math.hypot(pa.x - pb.x, pa.y - pb.y));
      wiresAdded++;
    }
    for (const n of state.nodes.values()) if (n.data?.role === "primary" && n.data.kind && !n.data.fixed) spent += PART_COST[n.data.kind] || 0;
    return { spent, wiresAdded };
  }
  // In a tight-budget level, would spending `extra` go over? Tells the player if so.
  function levelOverBudget(extra) {
    const level = state.level?.def;
    if (!level || !level.hard || state.level.done) return false;
    const { spent } = levelSpentNow();
    if (spent + extra <= level.budget) return false;
    Sfx.play("wrong");
    status.setText(`Not enough money: that costs $${extra}, and you have $${level.budget - spent} left. DELETE a wire to get its copper back, or find a shorter way.`);
    showToast(scene, 450, 200, "Over budget!", "#ff9f9f");
    return true;
  }
  // How many of a toolbox item are still in the box.
  function toolLeft(t) {
    let used = 0;
    for (const n of state.nodes.values()) {
      if (n.data?.role !== "primary" || n.data.fixed || n.data.kind !== t.kind) continue;
      const opt = t.kind === "RES" ? n.data.ohms : t.kind === "CAP" ? n.data.uF : t.kind === "XFMR" ? n.data.ratio : null;
      if (t.opt === null || opt === t.opt) used++;
    }
    return t.n - used;
  }

  function checkLevel(dt) {
    const play = state.level;
    if (!play || play.done || state.context !== "level") return;
    city.updateChip();
    levelCheckTimer += dt;
    // A check may solve the circuit several times, so unless the board
    // changed, check at most 5 times a second.
    if (!state.levelDirty && levelCheckTimer < 0.2) return;
    state.levelDirty = false;
    levelCheckTimer = 0;
    let won = false;
    try { won = checkLevelWin(play.def, state); } catch (e) { won = false; }
    if (!won) return;
    play.done = true;
    const cost = levelSpentNow();
    const result = { ...cost, popped: play.popped, ...levelStars(play.def, { ...cost, popped: play.popped }) };
    // Home-made puzzles don't count towards the campaign.
    const rec = play.def.custom ? { coins: 0, xp: 0 } : recordLevelResult(profile, play.def, result.stars);
    let challenge = null;
    if (!play.def.custom && (play.mode === "time" || play.mode === "noundo")) {
      const c = recordChallenge(profile, play.def.id, play.mode, play.time);
      rec.coins += c.coins; rec.xp += c.xp;
      challenge = play.mode === "time"
        ? `⏱ ${formatTime(play.time)}${c.newBest ? (c.prev == null ? " — your first time!" : ` — NEW RECORD! (was ${formatTime(c.prev)})`) : ` (record ${formatTime(profile.records[play.def.id].time)})`}`
        : c.firstNoUndo ? "No-undo challenge beaten! ✓" : "No-undo challenge beaten again ✓";
      if (play.mode === "noundo" && Object.values(profile.records).filter(r => r.noUndo).length >= 5) city.sticker("no_undo");
      if (play.mode === "time") city.sticker("speedy");
    }
    const reward = rec.coins || rec.xp ? addReward(profile, rec.coins, rec.xp) : null;
    const newCards = notebookCards(profile).length - (play.cardsBefore ?? 0);
    if (newCards > 0) scene.time.delayedCall(3200, () => { showToast(scene, 450, 200, "New Notebook card!", "#a7f070"); city.refreshBadges(); });
    save();
    city.clearHelper();
    playCelebration(scene, `${play.def.title} — ${"★".repeat(result.stars)}`, "★  Level complete!  ★");
    Sfx.play("win");
    if (reward) scene.time.delayedCall(900, () => city.giveReward(reward, 450, 420));
    if (result.stars === 3 && !play.def.custom) city.sticker("three_stars");
    if (play.def.expert) city.sticker("expert");
    if (campaignStars(profile) >= 10) city.sticker("star_student");
    const all = play.def.custom || play.def.expert ? [] : campaignLevelsOf(play.def.world);
    const next = all[play.def.n] || null;
    const msg = `Level complete! ${"★".repeat(result.stars)}${"☆".repeat(3 - result.stars)} — ${result.budget ? "in budget" : "over budget"}, ${result.neat ? "neat wiring" : "try fewer wires (and no pops) for the last star"}.`;
    setBanner(play.def.custom ? `★ "${play.def.title}" solved!` : play.def.expert ? `★ ${REGIONS[play.def.world].name} EXPERT complete!` : `★ ${REGIONS[play.def.world].name} ${play.def.n} complete!`);
    status.setText(msg);
    scene.time.delayedCall(0, () => status.setText(msg));
    city.refreshBadges();
    scene.time.delayedCall(2300, () => {
      if (state.level !== play) return;
      showLevelResult(scene, {
        level: play.def, result, reward: { coins: rec.coins, xp: rec.xp }, hasNext: !!next, challenge,
        onNext: () => startLevel(next),
        onRetry: () => startLevel(play.def, play.mode),
        onMap: () => (play.def.custom ? city.openMakerHome() : openLevels(play.def.world)),
      });
    });
  }

  Object.assign(city, { checkLevel, levelOverBudget, levelSpentNow, openLevels, startLevel, toolLeft });
}
