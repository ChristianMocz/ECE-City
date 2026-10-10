// src/scene/start.js
//
// Runs last in create(): loads your saved town (or the starter town),
// records today's login, then shows the title screen with its three save
// files and settings. Also builds scene.__api, the hook tests use.
//
// Gives city: openSettings, openTitle.
// Uses: src/ui/title.js.

function installStart(city) {
  const { buttonsRef, profile, refreshToggles, save, scene, setTitle, slot, state, status, townLife } = city;
  // --- Start ---
  // Your saved town (or the starter town), today's login, the gift.
  state.mission = null;
  state.boss = null;
  setRegionScenery(scene, profile.region);
  setTitle(REGIONS[profile.region].name);
  city.applyEnvironment(true);
  city.rebuildFrom(JSON.parse(JSON.stringify(city.regionTown())));
  city.economyOn = true;
  city.refreshPower();
  city.townDirty = false;
  city.drawDecor();
  city.arrivedAt = scene.time.now;
  const giftWaiting = checkLogin(profile, new Date());
  save();
  city.refreshBadges();
  city.updateChip();
  status.setText(profile.ordersDone > 0
    ? "Welcome back! Tap TODAY to see what to do next — or LEVELS ★ for puzzles."
    : "Welcome to ECE City! Your town is empty: tap + BUILD to place a house, then WIRE it up. Or tap LEVELS ★ for puzzles.");
  // After the title screen: "how to play" the very first time, then the
  // daily gift if it's waiting.
  const maybeGift = () => { if (profile.daily.giftDay !== dayKey(new Date())) city.openGiftScreen(); };
  let afterTitleDone = false;
  function afterTitle() {
    state.paused = false;
    city.playMusicHere();
    if (afterTitleDone) return;
    afterTitleDone = true;
    if (!profile.seenIntro) {
      scene.time.delayedCall(300, () => showIntro(scene, { onClose: () => { profile.seenIntro = true; save(); if (giftWaiting) scene.time.delayedCall(250, maybeGift); } }));
    } else if (giftWaiting) scene.time.delayedCall(600, maybeGift);
  }

  // --- Title screen ---
  // Continue, three save files, settings. Switching save file restarts the scene.
  function openTitle() {
    if (city.titleLayer && city.titleLayer.active) city.titleLayer.destroy();
    state.paused = true;
    const slots = [1, 2, 3].map(n => slotSummary(GAME_STORAGE, n));
    city.titleLayer = showTitle(scene, {
      slots, current: slot,
      onContinue: () => { city.titleLayer.close(); afterTitle(); },
      onSlot: (n, s) => {
        if (n === slot) { s.close(); city.titleLayer.close(); afterTitle(); return; }
        switchSlot(n);
      },
      onErase: (n, slotsScreen) => {
        const c = showConfirmOverlay(scene, {
          title: `Erase file ${n}?`, message: "Everything in this save file will be gone for good: coins, levels, stars, towns.", confirmLabel: "Yes, erase it", cancelLabel: "No, keep it",
          onConfirm: () => {
            slotsScreen?.close();
            eraseSlot(GAME_STORAGE, n);
            if (n === slot) { window.__eceForceTitle = true; restartWithSlot(n); return; }
            openTitle();
          },
        });
        c.setDepth(TITLE_DEPTH + 30);
      },
      onSettings: () => openSettings(TITLE_DEPTH + 10),
    });
    Music.play("title");
  }
  function switchSlot(n) {
    if (state.context === "town") city.saveTown(); else save();
    restartWithSlot(n);
  }
  function restartWithSlot(n) {
    setCurrentSlot(GAME_STORAGE, n);
    window.__eceBooted = true;
    scene.scene.restart();
  }
  function openSettings(depth) {
    showSettings(scene, {
      depth,
      get: (k) => k === "music" ? Music.enabled : k === "sound" ? !Sfx.muted : !!profile.settings[k],
      set: (k, v) => {
        if (k === "music") Music.setEnabled(v);
        else if (k === "sound") Sfx.setMuted(!v);
        else { profile.settings[k] = v; save(); }
        refreshToggles(); city.refreshBadges();
      },
    });
  }
  // Show the title on first boot; skip it after a save-file switch or in tests.
  if (window.__eceForceTitle) { window.__eceForceTitle = false; openTitle(); }
  else if (window.__eceBooted || window.ECE_SKIP_TITLE) afterTitle();
  else openTitle();
  window.__eceBooted = true;

  // --- Test hooks ---
  // The game's own actions, for tests and the browser console.
  scene.__api = {
    profile, state, startMission: city.startMission, startDaily: city.startDaily, backToTown: city.backToTown, triggerStorm: city.triggerStorm, skipTime: city.skipTime, save, saveTown: city.saveTown,
    refreshHud: city.refreshBadges, openShop: city.openShop, openWardrobe: city.openWardrobe, openBuild: city.openBuild, openOrders: city.openOrders, openDaily: city.openDaily, openGiftScreen: city.openGiftScreen,
    setWeather: (k) => { state.weatherOverride = k; city.applyEnvironment(true); },
    resetAskCooldown: () => { city.lastAskAt = -Infinity; },
    levelsWith: (change) => Object.fromEntries(city.levelsWith(change)),
    travel: city.travel, openMap: city.openMap, openRegion: city.openRegion, startBoss: city.startBoss, pickDifficulty: city.pickDifficulty, sticker: city.sticker,
    bossState: () => state.boss && { ...state.boss, breaks: state.boss.breaks.length },
    slot, openTitle, switchSlot, openLevels: city.openLevels, startLevel: city.startLevel, levelSpentNow: city.levelSpentNow, levelToolFor: city.levelToolFor,
    levelState: () => state.level && { id: state.level.def.id, done: state.level.done, popped: state.level.popped, ...city.levelSpentNow() },
    offerEmergency: city.offerEmergency, startEmergency: city.startEmergency, endEmergency: city.endEmergency, emergencyState: () => state.emergency && { key: state.emergency.plan.key, timeLeft: state.emergency.timeLeft, plan: state.emergency.plan },
    setNextEmergencyIn: (t) => { city.nextEmergencyIn = t; },
    setEmergencyTime: (t) => { if (state.emergency) state.emergency.timeLeft = t; },
    loadTown: (snap) => city.enterContext("town", snap),
    openPlantCard: city.openPlantCard, openLines: city.openLines, supplyNow: city.supplyNow, plantEnvFor: city.plantEnvFor, growTown: city.growTown, flickerOnLights: city.flickerOnLights, townLife,
    setArrived: (t) => { city.arrivedAt = t; },
    openPhone: city.openPhone, openToday: city.openToday, openNotebook: city.openNotebook, openRecords: city.openRecords, openMakerHome: city.openMakerHome, openCodeEntry: city.openCodeEntry, startMaker: city.startMaker, makerSetStep: city.makerSetStep, playPuzzle: city.playPuzzle, runApp: city.runApp, refreshBadges: city.refreshBadges,
    makerState: () => state.maker && { step: state.maker.step, lit: [...state.maker.goal.lit], dark: [...state.maker.goal.dark], testing: !!state.maker.test, solved: !!state.maker.test?.done, draft: state.maker.draft },
    toolbar: () => Object.fromEntries(Object.entries(buttonsRef).map(([k, b]) => [k, b.shown])),
    badges: () => Object.fromEntries(Object.entries(buttonsRef).map(([k, b]) => [k, b.badgeDot.visible ? b.badgeText.text : b.newTag.visible ? 'New!' : null])),
    levelMode: () => state.level && { mode: state.level.mode, time: state.level.time },
  };

  Object.assign(city, { openSettings, openTitle });
}
