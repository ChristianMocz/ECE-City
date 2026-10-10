// src/scene/sparky.js
//
// Sparky's "predict, then test" questions. Before a wire is added or removed,
// or a switch flips, Sparky may ask whether a light will get brighter, dimmer
// or stay the same. Right answers pay coins and build a streak; in a boss
// fight they zap the Captain.
//
// Gives city: maybeAsk, levelsWith (and sets city.lastAskAt).

function installSparky(city) {
  const { profile, refreshHud, save, scene, state, status } = city;
  // --- Predict, then test ---
  // Solve a copy of the circuit before and after the change to pick a
  // question, ask it, then make the real change so the player sees it.
  city.lastAskAt = -Infinity;

  function levelsWith(change) {
    const s = Object.assign({}, state);
    s.nodes = new Map();
    for (const [id, n] of state.nodes) s.nodes.set(id, { id, type: n.type, data: { ...n.data } });
    let wires = state.wires.map(w => ({ a: w.a, b: w.b }));
    if (change.addWire) wires.push({ a: change.addWire[0], b: change.addWire[1] });
    if (change.removeWire) {
      const [a, b] = change.removeWire;
      const i = wires.findIndex(w => (w.a === a && w.b === b) || (w.a === b && w.b === a));
      if (i >= 0) wires.splice(i, 1);
    }
    if (change.flip && s.nodes.get(change.flip)) s.nodes.get(change.flip).data.on = !s.nodes.get(change.flip).data.on;
    // Mirror refitPoppedLEDs, so Sparky predicts what will really happen.
    const changed = change.addWire || change.removeWire;
    if (changed) {
      const grouping = change.addWire ? wires : state.wires.map(w => ({ a: w.a, b: w.b }));
      for (const id of poppedLEDsTouched(s, changed, grouping)) s.nodes.get(id).data.burned = false;
    }
    s.wires = wires;
    s.nodeVoltages = new Map(); s.powered = new Map(); s.wireMetrics = new Map(); s.solverError = false;
    computePower(s, 0);
    const out = new Map();
    for (const n of s.nodes.values()) {
      if (n.type === "HOUSE" || n.type === "LED") out.set(n.id, s.solverError ? "OFF" : (s.powered.get(n.id)?.level ?? "OFF"));
    }
    return out;
  }

  function maybeAsk(change, action, commit) {
    // In a boss fight Sparky always asks (that's how you zap the Captain),
    // with a shorter cooldown.
    const inBoss = state.context === "boss" && state.boss && !state.boss.done;
    const canAsk = inBoss
      ? scene.time.now - city.lastAskAt >= BOSS_ASK_COOLDOWN_MS
      : profile.settings.sparky && state.context !== "daily" && state.context !== "boss" && scene.time.now - city.lastAskAt >= ASK_COOLDOWN_MS;
    let q = null;
    if (canAsk) {
      try { q = pickPrediction(levelsWith({}), levelsWith(change)); } catch (e) { q = null; }
    }
    if (!q) { commit(); return; }
    city.lastAskAt = scene.time.now;
    const vFrom = state.powered.get(q.targetId)?.V;
    showPrediction(scene, {
      targetName: city.partName(q.targetId),
      streak: profile.streak,
      onAnswer: (answer) => {
        city.lastAskAt = scene.time.now;
        if (commit() === false) return;
        const bossJustWon = !!(state.boss && state.boss.done && state.boss.won);
        if (answer === null) { if (!bossJustWon) status.setText("No guess this time — watch what happens!"); return; }
        // Judge against what really happened on the board.
        const now = state.powered.get(q.targetId)?.level ?? "OFF";
        const a = BRIGHTNESS_RANK[q.from] ?? 0, b = BRIGHTNESS_RANK[now] ?? 0;
        const dir = b > a ? "brighter" : b < a ? "dimmer" : "same";
        const correct = answer === dir;
        const score = scorePrediction(profile, correct);
        const why = explainPrediction({ ...q, answer: dir, vFrom, vTo: state.powered.get(q.targetId)?.V, levelTo: now }, action);
        const n = state.nodes.get(q.targetId);
        const at = n ? n.container.getBounds() : { centerX: 450, top: 300 };
        if (correct) {
          const reward = addReward(profile, score.coins, score.xp);
          reward.multiplier = score.multiplier;
          city.giveReward(reward, at.centerX, at.top - 10);
          const streakNote = score.multiplier > 1 ? ` ${score.streak} in a row — ×${score.multiplier} coins!` : score.streak >= 2 ? ` ${score.streak} in a row!` : "";
          if (!bossJustWon) status.setText(`Right! ${why}${streakNote}`);
          if (score.streak >= 3) city.sticker("sharp_guesser");
          if (inBoss) city.zapCaptain();
        } else {
          Sfx.play("wrong");
          if (!bossJustWon) status.setText(`Not quite! ${why}`);
        }
        city.clearHelper();
        if (!(state.boss && state.boss.done)) city.showHelperBubble(at.centerX, at.top - 50, `${correct ? "Right!" : "Not quite!"} ${why}`);
        save();
        refreshHud();
      },
    });
  }

  Object.assign(city, { levelsWith, maybeAsk });
}
