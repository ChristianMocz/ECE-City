// src/scene/setup.js
//
// The first scene module to run. Creates the game state, loads the current
// save file, builds the textures, background and HUD, and sets up scene
// events that are cleaned up when the scene restarts.
//
// Gives city: scene, state, profile, slot, save, status, refreshHud, setBanner,
// setTitle, setToolLabel, setToolbar, setClock, setChip, refreshToggles,
// buttonsRef, onEvent, windowListeners, townLife, dotsGfx, UI_HEIGHT.

function installSetup(city) {
  const scene = city.scene;
  const state = createGameState();
  // Three save files: load the one played last (see src/rules/game.js).
  const slot = currentSlot(GAME_STORAGE);
  const profile = loadProfile(GAME_STORAGE, slot);
  const UI_HEIGHT = 150;

  scene.__state = state;
  scene.__profile = profile;
  scene.input.setTopOnly(true);

  // Phaser keeps a scene's event listeners across a restart (switching save
  // files restarts it), so remove them on shutdown or every tap runs twice.
  const sceneEvents = [];
  const onEvent = (name, fn) => { sceneEvents.push(name); scene.events.on(name, fn); };
  const windowListeners = [];
  scene.events.once("shutdown", () => {
    for (const n of new Set(sceneEvents)) scene.events.removeAllListeners(n);
    for (const [target, ev, fn] of windowListeners) target.removeEventListener?.(ev, fn);
  });

  // Where the player is: their town (with orders, weather and the day/night
  // clock), a mission or the daily puzzle. Missions and puzzles are daytime.
  state.context = "town";
  state.clock = 20;              // seconds into the in-game day (see clockInfo)
  state.clockFrozen = false;     // tests freeze time
  state.weatherOverride = null;  // only tests set this

  makePixelTextures(scene);
  makeGameTextures(scene);
  makeWorldTextures(scene);
  makeMoreTextures(scene);
  drawBackground(scene);
  addTownDecor(scene);

  const { status, setToolLabel, setBanner, setTitle, refreshHud, setClock, setChip, refreshToggles, setToolbar, buttons: buttonsRef } = buildUI(scene, state, profile);
  scene.__status = status;

  function save() { saveProfile(GAME_STORAGE, profile, slot); }

  // People and cars (src/scene/life.js).
  const townLife = makeTownLife(scene);
  city.titleLayer = null; // the title screen, while it's up

  // Current sparks moving along the wires (see advanceCurrentDots).
  const dotsGfx = scene.add.graphics().setDepth(15);

  Object.assign(city, { UI_HEIGHT, buttonsRef, dotsGfx, onEvent, profile, refreshHud, refreshToggles, save, scene, setBanner, setChip, setClock, setTitle, setToolLabel, setToolbar, slot, state, status, townLife, windowListeners });
}
