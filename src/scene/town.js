// src/scene/town.js
//
// Life in your own town: what powers the GEN (plants and power lines), the
// daily coal bill, people moving in, timed emergencies, power orders and
// storm repairs, and the chip at the top of the board.
//
// Gives city: plantEnvFor, supplyNow, applySupply, payForCoal, growTown,
// maybeOfferEmergency, offerEmergency, startEmergency, checkEmergencyNow,
// emergencyTick, endEmergency, updateChip, townEconomy, seenOrders.
// Uses: src/rules/plants.js, src/rules/emergencies.js, src/rules/game.js.

function installTown(city) {
  const { profile, refreshHud, save, scene, setChip, state, status } = city;
  // --- Power plants ---
  // What powers GEN now: the town's plant plus towns joined by power lines.
  city.arrivedAt = 0; // scene time you arrived here (the nuclear plant warms up)
  function plantEnvFor(region) {
    const wx = state.weatherOverride && WEATHER[state.weatherOverride] ? { key: state.weatherOverride, ...WEATHER[state.weatherOverride] } : regionWeather(weatherFor(new Date()), region);
    const clock = clockInfo(state.clock);
    const env = environmentFor(wx, clock.night);
    return {
      region, weatherKey: wx.key, night: clock.night, solarFactor: env.solarFactor, wind: windFor(new Date(), region),
      tideT: clock.t / DAY_LENGTH, population: profile.population[region] || 0, coalPaid: profile.coalPaid,
      warm: region === profile.region ? (scene.time.now - city.arrivedAt) / 1000 : NUCLEAR_WARMUP,
    };
  }
  function supplyNow() {
    if (state.context === "town") {
      const g = gridSupply(profile, profile.region, plantEnvFor);
      return { genScale: g.genScale, R_GEN: g.R, plant: plantOf(profile, profile.region) };
    }
    if (state.context === "level" && state.level) {
      const e = levelEnv(state.level.def);
      return { genScale: e.genScale, R_GEN: e.R_GEN, plant: state.level.def.env.plant || "generator" };
    }
    return { genScale: 1, R_GEN: 1.5, plant: "generator" };
  }
  let shownPlant = "generator";
  function applySupply() {
    const s = supplyNow();
    if (Math.abs((state.genScale ?? 1) - s.genScale) > 1e-6 || Math.abs(state.R_GEN - s.R_GEN) > 1e-9) {
      state.genScale = s.genScale; state.R_GEN = s.R_GEN; state.dirty = true;
    }
    if (s.plant !== shownPlant) { shownPlant = s.plant; setGeneratorPlant(city.genNode.visual, s.plant); }
    const genArt = city.genNode.visual;
    const label = state.context === "town" && s.plant !== "generator" ? plantStatusText(s.plant, plantEnvFor(profile.region)) : s.plant !== "generator" ? PLANTS[s.plant].name : s.genScale === 0 ? "Generator: broken" : s.genScale < 1 ? `Generator: ${Math.round(s.genScale * 100)}%` : "";
    if (genArt.plantLabel.text !== label) genArt.plantLabel.setText(label);
  }
  // Coal: paid every morning while a coal plant powers your town.
  function payForCoal() {
    if (state.context !== "town" || plantOf(profile, profile.region) !== "coal") return;
    const cycle = clockInfo(state.clock).cycle;
    if (profile.fuelCycle === cycle) return;
    profile.fuelCycle = cycle;
    if (profile.coins >= COAL_FUEL) { profile.coins -= COAL_FUEL; profile.coalPaid = true; status.setText(`The coal plant burned ${COAL_FUEL} coins of coal today.`); }
    else { profile.coalPaid = false; status.setText("Out of coal money! The coal plant runs at half power today."); }
    save(); refreshHud();
  }

  // --- Population ---
  // People move into a town while its buildings are lit.
  let popTimer = 0;
  function growTown(dt) {
    if (state.context !== "town" || state.paused) return;
    popTimer += dt;
    if (popTimer < 8) return;
    popTimer = 0;
    const lit = city.litHouseIds().size;
    if (!lit) return;
    const r = profile.region, pop = profile.population[r] || 0;
    const cap = 6 + lit * 5;
    if (pop >= cap) return;
    if (plantOf(profile, r) === "coal" && Math.random() < 0.5) return; // smoke: fewer people want to move in
    profile.population[r] = pop + 1;
    if ((pop + 1) % 20 === 0) {
      const reward = addReward(profile, 10, 5);
      city.giveReward(reward, 450, 200);
      status.setText(`${pop + 1} people live in ${REGIONS[r].name} now! New families moved in because your town has power.`);
    }
    if (pop + 1 >= 50) city.sticker("growing_town");
    save();
  }

  // --- Emergencies ---
  // Optional and timed, in your town only (src/rules/emergencies.js).
  city.nextEmergencyIn = 90; // seconds of town time until the next offer
  let emergencyProps = [];
  function maybeOfferEmergency(dt) {
    if (state.context !== "town" || state.emergency || state.paused || !profile.settings.emergencies) return;
    if (city.anyScreenOpen() || city.drag || state.wireStart || profile.repair || scene.time.now - city.lastBoardChange < 4000) return;
    city.nextEmergencyIn -= dt;
    if (city.nextEmergencyIn > 0) return;
    offerEmergency();
  }
  function offerEmergency(only = null, rng = Math.random) {
    if (state.context !== "town" || state.emergency) return false;
    const plan = pickEmergency(state, profile, rng, only);
    if (!plan) { city.nextEmergencyIn = 30; return false; }
    city.nextEmergencyIn = 150 + Math.random() * 90;
    showEmergencyAlert(scene, {
      plan,
      onAccept: () => startEmergency(plan),
      onDecline: () => status.setText("OK — maybe next time. (Emergencies can be switched off in PHONE → Settings.)"),
    });
    return true;
  }
  function startEmergency(plan) {
    if (state.context !== "town") return;
    const a = plan.actions || {};
    for (const [x, y] of a.cut || []) {
      const w = state.wires.find(v => (v.a === x && v.b === y) || (v.a === y && v.b === x));
      if (w) { w.line?.destroy(); w.labelText?.destroy(); state.wires = state.wires.filter(v => v !== w); }
    }
    for (const [x, y] of a.add || []) if (state.nodes.has(x) && state.nodes.has(y) && !city.wireExists(x, y)) city.createWireDirect(x, y);
    for (const id of a.off || []) { const n = state.nodes.get(id); if (n) n.data.on = false; }
    for (const id of a.pop || []) { const n = state.nodes.get(id); if (n) { n.data.burned = true; n.data.justBurned = true; } }
    for (const id of a.drain || []) { const n = state.nodes.get(id); if (n) n.data.Vprev = 0; }
    state.undoStack = []; state.redoStack = [];
    state.emergency = { plan, timeLeft: plan.seconds };
    city.markDirty();
    city.applyEnvironment(true);
    city.refreshPower();
    // Critter emergencies: a squirrel or log slides along the wire.
    if (plan.at && state.nodes.has(plan.at[0]) && state.nodes.has(plan.at[1])) {
      const pa = city.nodePos(plan.at[0]), pb = city.nodePos(plan.at[1]);
      const key = plan.key === "squirrel" ? "squirrel" : "scn_log";
      const critter = scene.add.image(pa.x, pa.y, key).setDepth(30);
      scene.tweens.add({ targets: critter, x: pb.x, y: pb.y, duration: 1600, onComplete: () => scene.tweens.add({ targets: critter, alpha: 0, duration: 800, delay: 1200, onComplete: () => critter.destroy() }) });
      emergencyProps.push(critter);
    }
    Sfx.play("thunder");
    status.setText(`⚠ ${plan.text}`);
    updateChip();
  }
  function checkEmergencyNow(dt) {
    const emergency = state.emergency;
    if (!emergency || state.context !== "town") return;
    if (checkEmergency(state, emergency.plan, dt)) endEmergency("won");
  }
  function emergencyTick(dt) {
    const emergency = state.emergency;
    if (!emergency) return;
    if (city.anyScreenOpen()) return; // the clock waits while a screen is open
    emergency.timeLeft -= dt;
    updateChip();
    if (emergency.timeLeft <= 0) endEmergency("timeout");
  }
  function endEmergency(how) {
    const emergency = state.emergency;
    if (!emergency) return;
    state.emergency = null;
    for (const p of emergencyProps) if (p.active) p.destroy();
    emergencyProps = [];
    if (how === "won") {
      profile.emergenciesDone += 1;
      const reward = addReward(profile, EMERGENCY_REWARD.coins, EMERGENCY_REWARD.xp);
      save();
      playCelebration(scene, EMERGENCIES[emergency.plan.key].name, "★  Emergency fixed!  ★");
      Sfx.play("win");
      scene.time.delayedCall(800, () => city.giveReward(reward, 450, 400));
      city.sticker("hero");
      const msg = `Emergency fixed with ${Math.ceil(emergency.timeLeft)} seconds to spare! +${EMERGENCY_REWARD.coins} coins, +${EMERGENCY_REWARD.xp} XP.`;
      status.setText(msg);
      scene.time.delayedCall(0, () => status.setText(msg));
    } else if (how === "timeout") {
      Sfx.play("wrong");
      status.setText("Time's up on that emergency — no harm done. You can still fix it now.");
    }
    city.applyEnvironment(true);
    city.refreshPower();
    updateChip();
  }

  // --- Board chip ---
  // Emergency timer, level budget, or the town's population.
  function updateChip() {
    const emergency = state.emergency;
    if (emergency) {
      const t = Math.max(0, Math.ceil(emergency.timeLeft));
      const hold = EMERGENCIES[emergency.plan.key].hold;
      const extra = hold ? `  (${Math.floor(emergency.plan.progress || 0)}/${hold}s)` : "";
      setChip(`${EMERGENCIES[emergency.plan.key].name}  0:${String(t).padStart(2, "0")}${extra}`, { icon: "alarm", color: t <= 10 ? "#ef7d57" : "#ffcd75" });
      return;
    }
    if (state.context === "level" && state.level) {
      const level = state.level.def, c = city.levelSpentNow(), mode = state.level.mode;
      const pre = mode === "time" ? `⏱ ${formatTime(state.level.time)}  ·  ` : mode === "noundo" ? "No-undo  ·  " : "";
      setChip(`${pre}${level.hard ? "Tight budget" : "Budget"}: $${c.spent} / $${level.budget}  ·  wires ${c.wiresAdded}`, { icon: mode === "time" ? "ico_clock" : "coin", color: c.spent > level.budget ? "#ef7d57" : "#f4f4f4" });
      return;
    }
    if (state.context === "make") { setChip(null); return; }
    if (state.context === "town") {
      const pop = profile.population[profile.region] || 0;
      setChip(pop ? `${pop} ${pop === 1 ? "person lives" : "people live"} here` : "Light up houses so people move in!", { icon: "people" });
      return;
    }
    setChip(null);
  }

  // --- Town economy ---
  // Power orders and storm repairs. Runs after every solve in your town.
  const seenOrders = new Set();
  // Off while the board is being swapped, so orders are never judged
  // against the wrong board.
  city.economyOn = false;
  function townEconomy(dt) {
    if (!city.economyOn || state.context !== "town" || city.rebuilding) return;
    const now = Date.now();
    const ctx = { night: !!state.night, dt, switchCycled: city.switchCycled };
    let changed = false;

    const done = settleOrders(profile, state, now, ctx);
    for (const { order, reward } of done) {
      const n = order.target && state.nodes.get(order.target);
      const b = n ? n.container.getBounds() : null;
      city.giveReward(reward, b ? b.centerX : 450, b ? b.top - 10 : 300);
      const who = order.who || (order.kind === "leds" ? "The science fair" : "Mayor Volt");
      status.setText(`Order done! ${who} says thank you: +${reward.coins} coins, +${reward.xp} XP.`);
      if (order.kind === "solar") city.sticker("sun_catcher");
      if (profile.ordersDone >= 10) city.sticker("order_up");
      changed = true;
    }
    if (maintainOrders(profile, state, now, Math.random, ctx)) changed = true;
    for (const o of profile.orders) {
      if (!o || seenOrders.has(o.id)) continue;
      seenOrders.add(o.id);
      // A new "switch" order needs a fresh off-then-on.
      if (o.kind === "switch") { city.sawOff.delete(o.target); city.switchCycled.delete(o.target); }
    }

    // Storm damage: a repair whose dots are gone can't be done any more.
    const r = profile.repair;
    if (r && (!state.nodes.has(r.a) || !state.nodes.has(r.b))) {
      profile.repair = null;
      changed = true;
    } else if (r && repairDone(profile, state.wires)) {
      profile.repair = null;
      const reward = addReward(profile, r.coins, r.xp);
      const pa = city.nodePos(r.a), pb = city.nodePos(r.b);
      city.giveReward(reward, (pa.x + pb.x) / 2, (pa.y + pb.y) / 2 - 20);
      status.setText(`You fixed the storm damage! +${reward.coins} coins, +${reward.xp} XP.`);
      city.sticker("storm_chaser");
      changed = true;
    }
    if (state.night && city.litHouseIds().size > 0) city.sticker("night_owl");
    if (changed) { save(); city.refreshBadges(); }
  }

  Object.assign(city, { applySupply, checkEmergencyNow, emergencyTick, endEmergency, growTown, maybeOfferEmergency, offerEmergency, payForCoal, plantEnvFor, seenOrders, startEmergency, supplyNow, townEconomy, updateChip });
}
