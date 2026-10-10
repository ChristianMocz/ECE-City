// src/scene/weather.js
//
// Weather and the day/night clock: sets solar and load levels, switches day
// and night, lightning storms that knock down a wire, rain, skipping time,
// and worldTick(), which main.js update() calls every frame.
//
// Gives city: anyScreenOpen, applyEnvironment, currentWeather, skipTime, triggerStorm.
// Uses: src/rules/game.js (weather, clock, storms).

function installWeather(city) {
  const { profile, save, scene, setClock, state, status, townLife } = city;
  // --- Weather and clock ---
  function currentWeather() {
    const k = state.weatherOverride;
    return k && WEATHER[k] ? { key: k, ...WEATHER[k] } : regionWeather(weatherFor(new Date()), profile.region);
  }

  let lastClockText = "";
  function applyEnvironment(force = false) {
    const inTown = state.context === "town";
    const inLevel = state.context === "level" && !!state.level;
    const clock = clockInfo(state.clock);
    const lvEnv = inLevel ? levelEnv(state.level.def) : null;
    const night = inTown ? clock.night : inLevel ? lvEnv.night : false;
    const wx = currentWeather();
    let env = inTown ? environmentFor(wx, night) : inLevel ? { solarFactor: lvEnv.solarFactor, loadScale: lvEnv.loadScale } : { solarFactor: 1, loadScale: 1 };
    if (inTown && state.emergency?.plan.env) env = { ...env, ...state.emergency.plan.env };
    city.applySupply();
    if (env.solarFactor !== state.solarFactor || env.loadScale !== state.loadScale) {
      state.solarFactor = env.solarFactor;
      state.loadScale = env.loadScale;
      state.dirty = true;
    }
    if (night !== !!state.night || force) {
      const dusk = night && !state.night && inTown && !force;
      state.night = night;
      city.applyNight();
      if (dusk) city.flickerOnLights();
    }

    // Clock + weather, bottom right.
    const mmss = (s) => { const t = Math.ceil(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`; };
    const line2 = !inTown ? (state.context === "boss" ? "Beat the clock!" : inLevel ? (night ? "Night level" : "Clock paused") : "Clock paused") : night ? `Morning in ${mmss(clock.untilSwitch)}` : `Night in ${mmss(clock.untilSwitch)}`;
    const text = wx.key + "|" + line2 + "|" + state.context;
    if (text !== lastClockText || force) {
      lastClockText = text;
      const icon = inTown ? wx.key : state.context === "boss" ? "storm" : inLevel && lvEnv.solarFactor > 1 ? "sunny" : inLevel && lvEnv.solarFactor > 0 && lvEnv.solarFactor < 1 ? "cloudy" : "normal";
      setClock(icon, inTown ? wx.name : state.context === "boss" ? "Blackout!" : state.context === "daily" ? "Puzzle" : inLevel ? `Level ${state.level.def.n}` : "Mission", line2);
    }
  }

  // --- Storms ---
  // Lightning knocks down a busy wire once per day/night cycle on stormy
  // days. It can't be undone; the player has to rewire it.
  function triggerStorm() {
    if (state.context !== "town") return false;
    const clock = clockInfo(state.clock);
    const wires = state.wires.map(w => ({ a: w.a, b: w.b, amps: Math.abs(state.wireMetrics.get(city.wireKey(w.a, w.b))?.Iab ?? 0) }));
    const r = pickStormWire(profile, wires, clock.cycle);
    if (!r) return false;
    const w = state.wires.find(x => (x.a === r.a && x.b === r.b) || (x.a === r.b && x.b === r.a));
    if (w) {
      w.line?.destroy(); w.labelText?.destroy();
      state.wires = state.wires.filter(x => x !== w);
    }
    state.undoStack = [];
    state.redoStack = [];
    city.markDirty();
    city.refreshPower();
    const flash = scene.add.rectangle(450, 320, 900, 640, 0xffffff, 0).setDepth(450);
    scene.tweens.add({ targets: flash, alpha: { from: 0.85, to: 0 }, duration: 260, repeat: 1, onComplete: () => flash.destroy() });
    Sfx.play("thunder");
    status.setText(`⚡ Lightning knocked down the power line between ${r.a} and ${r.b}! Wire those two dots together again to fix it (+${r.coins} coins).`);
    save();
    city.refreshBadges();
    return true;
  }

  // Blinking dashed line where the broken wire was.
  function drawRepair(timeMs) {
    city.repairGfx.clear();
    const r = profile.repair;
    if (!r || state.context !== "town" || !state.nodes.has(r.a) || !state.nodes.has(r.b)) return;
    const pa = city.nodePos(r.a), pb = city.nodePos(r.b);
    const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const steps = Math.max(2, Math.floor(len / 14));
    city.repairGfx.lineStyle(4, PALN["2"], 0.55 + 0.45 * Math.abs(Math.sin(timeMs / 300)));
    for (let i = 0; i < steps; i += 2) {
      const t0 = i / steps, t1 = Math.min(1, (i + 1) / steps);
      city.repairGfx.lineBetween(pa.x + (pb.x - pa.x) * t0, pa.y + (pb.y - pa.y) * t0, pa.x + (pb.x - pa.x) * t1, pa.y + (pb.y - pa.y) * t1);
    }
    // Lightning bolt in the middle.
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
    city.repairGfx.fillStyle(PALN["4"], 1);
    city.repairGfx.fillTriangle(mx + 2, my - 14, mx - 7, my + 2, mx + 1, my + 1);
    city.repairGfx.fillTriangle(mx - 2, my + 14, mx + 7, my - 2, mx - 1, my - 1);
  }

  function animateRain(dt) {
    const on = state.context === "town" && currentWeather().key === "storm";
    for (const r of city.rain) {
      if (!on) { if (r.alpha) r.setAlpha(0); continue; }
      r.setAlpha(0.55);
      r.y += r.speed * dt;
      r.x -= r.speed * dt * 0.15;
      if (r.y > 600) { r.y = 140; r.x = Math.random() * 940; }
    }
  }

  // Jump to the next morning or evening. Batteries and capacitors keep
  // charging (or draining) through the skipped time, in 0.5 s steps.
  function skipTime() {
    if (state.context !== "town") { status.setText("Time only passes in your town. (Missions and puzzles are always in the daytime.)"); return; }
    const clock = clockInfo(state.clock);
    if (city.hasAnyStore()) {
      let left = clock.untilSwitch;
      while (left > 0) { const step = Math.min(0.5, left); computePower(state, step); left -= step; }
    }
    state.clock += clock.untilSwitch + 0.01;
    state.dirty = true;
    applyEnvironment();
    city.refreshPower();
    status.setText(state.night
      ? "It's night! Buildings need more power now, and solar panels rest. Batteries charged in the day can help."
      : "Good morning! The sun is up — solar panels are working again.");
  }

  // --- Every frame ---
  let secondTimer = 0, saveTimer = 0;
  function worldTick(dt, timeMs) {
    // The world waits behind the title screen.
    if (state.paused) { townLife.update(dt, { show: false }); return; }
    if (state.context === "town" && !state.clockFrozen) state.clock += dt;
    applyEnvironment();
    city.payForCoal();
    city.growTown(dt);
    city.maybeOfferEmergency(dt);
    city.emergencyTick(dt);
    townLife.update(dt, { show: state.context === "town", population: profile.population[profile.region] || 0, night: !!state.night });
    city.updateChip();
    if (city.genNode.visual.blades.visible) city.genNode.visual.blades.angle += dt * 360 * Math.max(0.05, state.genScale ?? 1) * 0.6;
    // Lightning waits for a calm moment: no screen open, no drag or wire in
    // progress, and no board change in the last 5 s (else it looks like the
    // player's own action broke it).
    if (state.context === "town" && !state.clockFrozen && currentWeather().key === "storm" && clockInfo(state.clock).t >= STORM_AT
        && !profile.repair && profile.stormCycle !== clockInfo(state.clock).cycle
        && scene.time.now - city.lastBoardChange > 5000 && !city.drag && !state.wireStart && !anyScreenOpen()) triggerStorm();
    city.bossTick(dt);
    if (state.context === "level" && state.level && !state.level.done && state.level.mode === "time" && !anyScreenOpen()) state.level.time += dt;
    city.makerTick();
    drawRepair(timeMs);
    animateRain(dt);
    secondTimer += dt;
    if (secondTimer >= 1) { secondTimer = 0; city.refreshBadges(); }
    saveTimer += dt;
    if (state.context === "town" && !city.drag && ((city.townDirty && saveTimer >= 1.5) || (city.hasAnyStore() && saveTimer >= 5))) {
      saveTimer = 0;
      city.saveTown();
    }
  }
  scene.__worldTick = worldTick;

  // Pop-up screens are containers at depth 500 and up.
  function anyScreenOpen() {
    return scene.children.list.some(o => o.type === "Container" && o.depth >= 500 && o.active && !o.isClosing);
  }

  Object.assign(city, { anyScreenOpen, applyEnvironment, currentWeather, skipTime, triggerStorm });
}
