// main.js
//
// Starts the game. Every file is a plain <script> loaded by index.html, and
// this one comes last. We do not use ES modules because browsers block them
// on file://, and the game must work when you just double-click index.html.
//
// Phaser starts once the pixel font is ready. create() makes `city`, one
// shared object, and calls each installX(city) in order: each scene module
// (in src/scene/) adds its functions to `city` and calls the others through
// it. update() runs every frame (world clock, power, current dots, fireflies).

// If Phaser failed to load, index.html already shows a message.
if (typeof Phaser !== "undefined") {
  let started = false;
  const startGame = () => {
    if (started) return;
    started = true;
    new Phaser.Game({
      type: Phaser.AUTO,
      width: 900,
      height: 640,
      backgroundColor: "#1a1c2c",
      pixelArt: true, // crisp, unblurred pixels when the canvas is scaled up
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: { create, update },
    });
  };
  // Phaser never redraws text when a font arrives late, so wait for the
  // pixel font (src/art/font.js). Give up after 2 s and use a fallback font.
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('bold 16px "Pixelify Sans"')])
    : Promise.resolve();
  fontsReady.then(startGame, startGame);
  setTimeout(startGame, 2000);
}

function create() {
  const city = { scene: this };
  installSetup(city);
  installNight(city);
  installBoard(city);
  installEditing(city);
  installSparky(city);
  installTouch(city);
  installPower(city);
  installRewards(city);
  installContexts(city);
  installWorldmap(city);
  installBoss(city);
  installTraining(city);
  installLevelplay(city);
  installTown(city);
  installWeather(city);
  installToolbar(city);
  installDecor(city);
  installBuildmenu(city);
  installPhone(city);
  installMakerplay(city);
  installMenus(city);
  installEvents(city);
  installStart(city);
}

function update(time, delta) {
  const scene = this;
  const state = scene.__state;
  if (!state) return;
  const dt = Math.max(0, delta) / 1000;
  if (scene.__worldTick) scene.__worldTick(dt, time);
  if (scene.__refreshPower) scene.__refreshPower(dt);
  if (scene.__advanceDots) scene.__advanceDots(delta);
  if (scene.__animateFireflies) scene.__animateFireflies(time);
}
