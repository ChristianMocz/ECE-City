// src/scene/contexts.js
//
// Switching where the player is: their town, a mission, the daily puzzle, a
// level or a boss fight. Saves the town before leaving it, rebuilds the board
// from a snapshot, and plays each world's song. Also tracks finished missions.
//
// Gives city: enterContext, backToTown, saveTown, regionTown, playMusicHere,
// missionsDone, saveMissionProgress, MISSION_REWARD.

function installContexts(city) {
  const { profile, save, scene, setBanner, setToolLabel, slot, state, status } = city;
  // --- Missions ---
  // Definitions and win checks are in src/rules/missions.js. A finished
  // mission pays once and gets a ✓ in the mission list.
  const MISSION_SAVE_KEY = slot === 1 ? "ececity.missionsDone" : `ececity.missionsDone.slot${slot}`;
  const missionsDone = (() => {
    try { return new Set(JSON.parse(GAME_STORAGE?.getItem(MISSION_SAVE_KEY) || "[]")); } catch (e) { return new Set(); }
  })();
  function saveMissionProgress() {
    try { GAME_STORAGE?.setItem(MISSION_SAVE_KEY, JSON.stringify([...missionsDone])); } catch (e) { /* storage blocked: just not remembered */ }
  }
  const MISSION_REWARD = { coins: 30, xp: 30 };

  // --- Switching ---
  // Your town is saved first and comes back as you left it. UNDO history is
  // cleared on every switch.
  function enterContext(ctx, snapshot) {
    if (state.context === "town") saveTown();
    if (state.maker) { state.maker.bar?.destroy(); for (const o of state.maker.marks) o.destroy(); state.maker = null; }
    city.economyOn = false;
    city.clearHelper();
    city.drag = null;
    if (state.emergency) city.endEmergency("left");
    state.mission = null;
    state.daily = null;
    state.level = null;
    city.endBossVisuals();
    state.boss = null;
    if (ctx !== "boss") setRegionScenery(scene, profile.region);
    state.context = ctx;
    state.undoStack = [];
    state.redoStack = [];
    city.applyEnvironment(true);
    city.rebuildFrom(JSON.parse(JSON.stringify(snapshot)));
    city.economyOn = true;
    city.refreshPower();
    city.drawDecor();
    scene.events.emit("tool-switch", Mode.WIRE);
    setToolLabel();
    playMusicHere();
    city.refreshBadges();
  }

  // Music: starts with this world's song, then shuffles (src/audio/music.js).
  function playMusicHere() {
    if (city.titleLayer && city.titleLayer.active && !city.titleLayer.isClosing) { Music.play("title"); return; }
    const world = state.context === "level" && state.level ? state.level.def.world : state.context === "boss" && state.boss ? state.boss.region : profile.region;
    Music.shuffle(SONGS[world] ? world : "sparkville");
  }

  function saveTown() {
    if (state.context !== "town") return;
    profile.towns[profile.region] = city.serializeBuild();
    profile.town = null; // single-town saves now live in towns.sparkville
    city.townDirty = false;
    save();
  }

  // This region's saved town, or its starter town.
  function regionTown(key = profile.region) {
    return profile.towns[key] || REGION_STARTERS[key] || STARTER_TOWN;
  }

  function backToTown() {
    if (state.context === "town") return;
    enterContext("town", regionTown());
    setBanner(null);
    status.setText(`Welcome back to ${REGIONS[profile.region].name}! Tap TODAY to see what to do next.`);
  }

  Object.assign(city, { MISSION_REWARD, backToTown, enterContext, missionsDone, playMusicHere, regionTown, saveMissionProgress, saveTown });
}
