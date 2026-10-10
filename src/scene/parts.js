// src/scene/parts.js
//
// Draws every part on the board as pixel art (textures from src/art/pixelart.js):
// GEN, GND, houses and shop buildings, resistors, capacitors, transformers,
// switches, LEDs, solar panels and batteries. Each two-lead part has an orange
// IN dot near the top and a blue OUT dot near the bottom; GEN has only an OUT
// dot, GND only an IN dot. Also the background and region scenery, the
// player's engineer and sidekick, speech bubbles and celebration effects.
//
// Main pieces: makeHouse() and the other make*() part builders, the set*Visual()
// updaters, setRegionScenery(), makeBubble(), playCelebration().
// Used by: src/scene/board.js (placing parts), src/scene/power.js (visuals),
// src/ui/hud.js, src/ui/shop.js, src/ui/title.js (engineer and sidekick).
//
// The dot offsets must match PART_EXTENT in src/scene/constants.js.

const HOT_COLOR = PALN["3"];
const GND_COLOR = PALN["A"];
const INK = PALN["0"];
const TERMINAL_RADIUS = 8;
const TERMINAL_DEPTH = 21;
const NIGHT_TINT = 0x7b86b8; // how unlit parts look at night

function addTerminal(scene, x, y, kind) {
  return scene.add.circle(x, y, TERMINAL_RADIUS, kind === "hot" ? HOT_COLOR : GND_COLOR)
    .setStrokeStyle(3, INK)
    .setDepth(TERMINAL_DEPTH);
}

// Part labels: dark text with a light outline, readable anywhere.
function partLabel(scene, x, y, text, size = 13, originX = 0.5) {
  return scene.add.text(x, y, text, {
    fontFamily: GAME_FONT, fontSize: `${size}px`, color: "#1a1c2c", stroke: "#f4f4f4", strokeThickness: 3,
  }).setOrigin(originX, 0.5);
}

function drawBackground(scene) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  scene.__sky = scene.add.tileSprite(0, 0, W, 136, "sky").setOrigin(0, 0).setDepth(-100);
  scene.__ground = scene.add.tileSprite(0, 135, W, H - 135, "grass").setOrigin(0, 0).setDepth(-100);
  scene.add.tileSprite(0, 294, W, 72, "road").setOrigin(0, 0).setDepth(-99);
}

// --- Scenery ---
// Each region has its own ground and scenery, behind the parts (depth -96/-97).
// Calling setRegionScenery again swaps the look.
const REGION_SCENERY = {
  sparkville: {
    tall: [[80, 430, "tree"], [140, 470, "pine"], [220, 440, "tree"], [820, 450, "pine"], [760, 480, "tree"], [680, 445, "tree"]],
    small: [[300, 560, "flowers"], [480, 522, "flowers"], [520, 578, "flowers"], [880, 525, "flowers"], [40, 565, "flowers"], [610, 560, "flowers"], [380, 545, "rock"], [725, 562, "rock"], [250, 395, "rock"]],
  },
  batterybay: {
    tall: [[70, 440, "scn_palm"], [225, 450, "scn_palm"], [770, 470, "scn_palm"], [860, 455, "scn_lighthouse"]],
    small: [[60, 572, "scn_boat"], [470, 570, "scn_boat"], [380, 545, "rock"], [725, 562, "rock"], [300, 560, "flowers"]],
  },
  solardesert: {
    tall: [[75, 440, "scn_cactus"], [225, 455, "scn_cactus"], [780, 470, "scn_cactus"], [860, 440, "scn_cactus"]],
    small: [[380, 548, "scn_boulder"], [610, 565, "scn_boulder"], [40, 570, "rock"], [500, 525, "rock"], [250, 395, "rock"]],
  },
  mountains: {
    tall: [[800, 470, "scn_peak"], [80, 430, "scn_snowpine"], [140, 470, "scn_snowpine"], [225, 445, "scn_snowpine"], [690, 455, "scn_snowpine"]],
    small: [[380, 548, "scn_boulder"], [520, 575, "scn_boulder"], [40, 570, "rock"], [610, 560, "rock"]],
  },
  windmill: {
    tall: [[80, 440, "scn_windmill"], [830, 455, "scn_windmill"], [225, 450, "tree"], [700, 470, "tree"]],
    small: [[380, 548, "scn_haybale"], [600, 565, "scn_haybale"], [40, 570, "scn_fence"], [480, 525, "flowers"], [880, 525, "flowers"], [300, 560, "scn_fence"]],
  },
  waterfall: {
    tall: [[70, 430, "scn_bigtree"], [140, 470, "scn_bigtree"], [830, 440, "scn_waterfall"], [700, 470, "scn_bigtree"], [225, 450, "pine"]],
    small: [[380, 548, "scn_log"], [600, 565, "scn_mushroom"], [40, 570, "scn_mushroom"], [520, 580, "rock"], [300, 562, "flowers"]],
  },
  neon: {
    tall: [[60, 440, "scn_skyscraper"], [830, 440, "scn_skyscraper"], [770, 470, "scn_tower"], [220, 455, "scn_tower"]],
    small: [[380, 548, "scn_neonsign"], [600, 560, "scn_neonsign"], [40, 572, "scn_crate"], [500, 580, "scn_crate"]],
  },
  tundra: {
    tall: [[80, 430, "scn_snowpine"], [140, 470, "scn_snowpine"], [830, 455, "scn_snowpine"], [700, 470, "scn_snowpine"]],
    small: [[380, 548, "scn_igloo"], [600, 565, "scn_iceblock"], [40, 570, "scn_penguin"], [520, 580, "scn_penguin"], [300, 560, "scn_iceblock"]],
  },
  volcano: {
    tall: [[820, 470, "scn_volcano"], [70, 440, "scn_palm"], [225, 455, "scn_palm"], [700, 470, "scn_palm"]],
    small: [[380, 548, "scn_lavarock"], [600, 565, "scn_lavarock"], [40, 570, "scn_lavarock"], [500, 580, "rock"]],
  },
  robot: {
    tall: [[80, 440, "scn_robotarm"], [830, 455, "scn_robotarm"], [225, 455, "scn_tower"], [700, 470, "scn_robotarm"]],
    small: [[380, 548, "scn_gear"], [600, 565, "scn_crate"], [40, 570, "scn_gear"], [500, 580, "scn_crate"], [300, 560, "scn_gear"]],
  },
  storm: {
    tall: [[80, 440, "scn_bentpine"], [140, 470, "scn_bentpine"], [830, 450, "scn_lighthouse"], [700, 470, "scn_bentpine"]],
    small: [[380, 560, "scn_wave"], [600, 572, "scn_wave"], [40, 575, "scn_wave"], [500, 548, "scn_boulder"], [300, 552, "rock"]],
  },
  moon: {
    tall: [[70, 440, "scn_rocket"], [830, 450, "scn_dish"], [225, 455, "scn_flag"], [700, 470, "scn_dome"]],
    small: [[380, 548, "scn_crater"], [600, 565, "scn_crater"], [40, 570, "scn_crater"], [500, 580, "rock"]],
  },
};
const REGION_GROUND = { sparkville: "grass", batterybay: "sand", solardesert: "dune", mountains: "rocky",
  windmill: "meadow", waterfall: "forest", neon: "pavement", tundra: "snow", volcano: "ash", robot: "metal", storm: "cliff", moon: "moondust" };
function setRegionScenery(scene, key) {
  const look = REGION_SCENERY[key] || REGION_SCENERY.sparkville;
  for (const o of scene.__scenery || []) o.destroy();
  scene.__scenery = [];
  if (scene.__ground) scene.__ground.setTexture(REGION_GROUND[key] || "grass");
  if (scene.__sky) scene.__sky.setTexture(key === "moon" && scene.textures.exists("sky_space") ? "sky_space" : "sky");
  for (const [x, y, k] of look.tall) scene.__scenery.push(clearOfPower(scene.add.image(x, y + 30, k).setOrigin(0.5, 1).setDepth(-96), scene.__scenery));
  for (const [x, y, k] of look.small) scene.__scenery.push(clearOfPower(scene.add.image(x, y, k).setDepth(-97), scene.__scenery));
}
// GEN and GND live in the left column; scenery is kept out of it so they
// and their dots stay easy to see and tap.
const POWER_KEEP_OUT = { left: 52, right: 208, top: 150, bottom: 525 };
function clearOfPower(img, others = []) {
  const box = img.getBounds(), K = POWER_KEEP_OUT;
  if (box.right <= K.left || box.left >= K.right || box.bottom <= K.top || box.top >= K.bottom) return img;
  const half = box.width / 2;
  // Slide it out sideways, to whichever side it was nearer.
  const leftX = Math.max(half - 10, K.left - half - 2);
  img.x = img.x < (K.left + K.right) / 2 && leftX + half <= K.left ? leftX : K.right + half + 2;
  // Then nudge it off any other scenery.
  const hits = () => others.some(o => Phaser.Geom.Intersects.RectangleToRectangle(o.getBounds(), img.getBounds()));
  for (let i = 0; i < 12 && hits(); i++) img.x += 24;
  return img;
}
function addTownDecor(scene) { setRegionScenery(scene, "sparkville"); }

// --- Parts ---

function makeGenerator(scene, x, y) {
  const container = scene.add.container(x, y).setDepth(20);
  const base = scene.add.image(0, 5, "gen");
  const lights = scene.add.image(0, 5, "gen_lights").setVisible(false);
  // A wind turbine's spinning blades (only shown for that plant).
  const blades = scene.add.image(1.5, -23.5, scene.textures.exists("plant_wind_blades") ? "plant_wind_blades" : "gen").setVisible(false);
  const label = partLabel(scene, 0, 58, "GEN", 15);
  const supplyLabel = partLabel(scene, 0, 76, "supplying 0.00A", 13);
  const plantLabel = partLabel(scene, 0, -58, "", 12);
  container.add([base, lights, blades, label, supplyLabel, plantLabel]);
  const outDot = addTerminal(scene, x, y + 100, "hot");
  const visual = { base, lights, blades, label, supplyLabel, plantLabel, stacks: [], steam: false, tintables: [base], x, y, plant: "generator" };
  setGeneratorPlant(visual, "generator");
  return { container, outHit: outDot, visual };
}
// Dress the GEN as a power plant (see PLANTS in src/rules/plants.js): its
// picture, lights, chimneys (smoke) or vents (steam), and its name.
function setGeneratorPlant(v, key) {
  const sprite = typeof PLANTS !== "undefined" && PLANTS[key] ? PLANTS[key].sprite : "gen";
  v.plant = key;
  v.base.setTexture(sprite);
  v.lights.setTexture(sprite === "gen" ? "gen_lights" : sprite + "_lights");
  v.blades.setVisible(key === "wind");
  const vents = (typeof PLANT_VENTS !== "undefined" && PLANT_VENTS[key === "generator" ? "generator" : sprite]) || [];
  // art pixel (ax, ay) -> scene: the image is centred at (x, y + 5), 40 x 30 art pixels.
  v.stacks = vents.map(([ax, ay]) => ({ x: v.x - 60 + ax * PIX, y: v.y + 5 - 45 + ay * PIX }));
  v.steam = key === "nuclear" || key === "geothermal" || key === "biogas";
  v.plantLabel.setText(key === "generator" || typeof PLANTS === "undefined" ? "" : PLANTS[key].name);
}

function makeGroundTerminal(scene, x, y) {
  const container = scene.add.container(x, y).setDepth(20);
  const art = scene.add.image(0, -4, "gnd");
  const label = partLabel(scene, 0, 30, "GND", 15);
  container.add([art, label]);
  const inDot = addTerminal(scene, x, y - 30, "gnd");
  return { container, inHit: inDot, visual: { tintables: [art] } };
}

function makeGlow(scene, x, y, color, scale) {
  return scene.add.image(x, y, "glow").setTint(color).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(0);
}

// A cottage or a shop building (bakery, school...): same dots, different art
// and power needs.
function makeHouse(scene, x, y, idText = "H0", buildingKey = "house") {
  const container = scene.add.container(x, y).setDepth(20);
  const body = scene.add.image(0, -6, buildingTexture(buildingKey));
  // Most buildings light the cottage's two windows; odd shapes bring their own lights.
  const own = scene.textures.exists(`bld_${buildingKey}_lit`);
  const winDim = scene.add.image(0, -6, own ? `bld_${buildingKey}_dim` : "house_win_dim").setVisible(false);
  const winOn = scene.add.image(0, -6, own ? `bld_${buildingKey}_lit` : "house_win_on").setVisible(false);
  const glows = [makeGlow(scene, -18, 9, PALN["4"], 1.1), makeGlow(scene, 21, 9, PALN["4"], 1.1)];
  const idLabel = partLabel(scene, 0, 44, idText);
  const voltLabel = partLabel(scene, 0, 60, "V=0.00V", 12);
  const currLabel = partLabel(scene, 0, 75, "I=0.00A", 12);
  container.add([...glows, body, winDim, winOn, idLabel, voltLabel, currLabel]);
  const inDot = addTerminal(scene, x, y - 68, "hot");
  const outDot = addTerminal(scene, x, y + 100, "gnd");
  return { container, inHit: inDot, outHit: outDot, visual: { body, winDim, winOn, glows, voltLabel, currLabel, tintables: [body] } };
}

function makeResistor(scene, x, y, idText = "R0", ohms = 470) {
  const container = scene.add.container(x, y).setDepth(20);
  const art = scene.add.image(0, 33, resistorTexture(scene, ohms));
  const label = partLabel(scene, 18, 18, idText, 14, 0);
  const ohmLabel = partLabel(scene, 18, 36, `${ohms.toFixed(0)}Ω`, 12, 0);
  container.add([art, label, ohmLabel]);
  const inDot = addTerminal(scene, x, y - 18, "hot");
  const outDot = addTerminal(scene, x, y + 90, "gnd");
  return { container, inHit: inDot, outHit: outDot, visual: { base: art, ohmLabel, tintables: [art] } };
}

// The capacitor's charge gauge fills the can from the bottom (see
// setCapacitorVisual), drawn over CAP_INNER.
const CAP_TOP = -28;
const CAP_LEVEL_MAX_H = CAP_INNER.h * PIX; // 54
function makeCapacitor(scene, x, y, idText = "C0", uF = 220) {
  const container = scene.add.container(x, y).setDepth(20);
  const can = scene.add.image(0, CAP_TOP, "cap").setOrigin(0.5, 0);
  const left = -7 * PIX + CAP_INNER.x * PIX;
  const level = scene.add.rectangle(left + (CAP_INNER.w * PIX) / 2, CAP_TOP + (CAP_INNER.y + CAP_INNER.h) * PIX, CAP_INNER.w * PIX, 0, PALN["9"])
    .setOrigin(0.5, 1);
  const label = partLabel(scene, 24, 0, idText, 14, 0);
  const capLabel = partLabel(scene, 24, 17, `${uF.toFixed(0)}µF`, 12, 0);
  const voltLabel = partLabel(scene, 24, 33, "0.0V", 12, 0);
  container.add([can, level, label, capLabel, voltLabel]);
  const inDot = addTerminal(scene, x, y - 38, "hot");
  const outDot = addTerminal(scene, x, y + 96, "gnd");
  return { container, inHit: inDot, outHit: outDot, visual: { body: can, level, capLabel, voltLabel, tintables: [can] } }; // the gauge is a shape, so it can't be tinted and stays bright at night
}

function makeTransformer(scene, x, y, idText = "X0", ratio = 0.5) {
  const container = scene.add.container(x, y).setDepth(20);
  const art = scene.add.image(0, 22, "xfmr");
  const label = partLabel(scene, 34, 12, idText, 14, 0);
  const ratioLabel = partLabel(scene, 34, 30, `ratio ${ratio.toFixed(2)}×`, 12, 0);
  container.add([art, label, ratioLabel]);
  const priDot = addTerminal(scene, x, y - 40, "hot");
  const secDot = addTerminal(scene, x, y + 96, "gnd");
  return { container, priHit: priDot, secHit: secDot, visual: { base: art, ratioLabel, tintables: [art] } };
}

function makeTransistor(scene, x, y, idText = "T0") {
  const container = scene.add.container(x, y).setDepth(20);
  const base = scene.add.image(0, 20, "switch_on");
  const label = partLabel(scene, 0, 52, idText, 14);
  const hint = partLabel(scene, 0, 67, "(tap to flip)", 11);
  container.add([base, label, hint]);
  const inDot = addTerminal(scene, x, y - 28, "hot");
  const outDot = addTerminal(scene, x, y + 85, "gnd");
  const toggleZone = scene.add.zone(x, y + 20, 90, 60).setInteractive({ useHandCursor: true });
  return { container, inHit: inDot, outHit: outDot, toggleHit: toggleZone, visual: { base, tintables: [base] } };
}

function makeLED(scene, x, y, idText = "L0") {
  const container = scene.add.container(x, y).setDepth(20);
  const glow = makeGlow(scene, -1, 1, PALN["r"], 0.9);
  const art = scene.add.image(0, 22, "led_off");
  const label = partLabel(scene, 18, 10, idText, 14, 0);
  const voltLabel = partLabel(scene, 18, 28, "V=0.00V", 12, 0);
  const currLabel = partLabel(scene, 18, 44, "I=0.0mA", 12, 0);
  container.add([glow, art, label, voltLabel, currLabel]);
  const inDot = addTerminal(scene, x, y - 22, "hot");
  const outDot = addTerminal(scene, x, y + 102, "gnd");
  return { container, inHit: inDot, outHit: outDot, visual: { art, glow, voltLabel, currLabel, tintables: [] } };
}

function makeSolar(scene, x, y, idText = "S0") {
  const container = scene.add.container(x, y).setDepth(20);
  const art = scene.add.image(0, 24, "solar");
  const label = partLabel(scene, 40, 8, idText, 14, 0);
  const sunLabel = partLabel(scene, 40, 26, "", 12, 0);
  container.add([art, label, sunLabel]);
  const inDot = addTerminal(scene, x, y - 30, "hot");
  const outDot = addTerminal(scene, x, y + 85, "gnd");
  return { container, inHit: inDot, outHit: outDot, visual: { base: art, sunLabel, tintables: [art] } };
}

const BAT_TOP = -14;
function makeBattery(scene, x, y, idText = "B0") {
  const container = scene.add.container(x, y).setDepth(20);
  const cell = scene.add.image(0, BAT_TOP, "battery").setOrigin(0.5, 0);
  const left = -7 * PIX + BAT_INNER.x * PIX;
  const level = scene.add.rectangle(left + (BAT_INNER.w * PIX) / 2, BAT_TOP + (BAT_INNER.y + BAT_INNER.h) * PIX, BAT_INNER.w * PIX, 0, PALN["5"])
    .setOrigin(0.5, 1);
  const label = partLabel(scene, 24, 6, idText, 14, 0);
  const voltLabel = partLabel(scene, 24, 24, "0%", 12, 0);
  container.add([cell, level, label, voltLabel]);
  const inDot = addTerminal(scene, x, y - 30, "hot");
  const outDot = addTerminal(scene, x, y + 82, "gnd");
  return { container, inHit: inDot, outHit: outDot, visual: { body: cell, level, voltLabel, tintables: [cell] } };
}
function setBatteryVisual(v, fraction01) {
  const f = Math.max(0, Math.min(1, fraction01 || 0));
  v.level.setSize(BAT_INNER.w * PIX, BAT_INNER.h * PIX * f);
  v.level.setFillStyle(f > 0.5 ? PALN["5"] : f > 0.2 ? PALN["4"] : PALN["2"]);
  v.voltLabel.setText(`${Math.round(f * 100)}%`);
}

// --- Characters ---
// The engineer: same-size layers (cape behind, body, pants, shirt, accessory,
// hat). `wearing` is profile.wearing.
function makeEngineer(scene, x, y) {
  const container = scene.add.container(x, y);
  const layers = {};
  for (const name of ["cape", "body", "pants", "shirt", "acc", "hat"]) {
    layers[name] = scene.add.image(0, 0, name === "body" ? "person" : "__DEFAULT").setOrigin(0.5, 1).setVisible(name === "body");
    container.add(layers[name]);
  }
  return { container, layers };
}
function dressEngineer(eng, wearing) {
  const set = (layer, key) => {
    const img = eng.layers[layer];
    if (key) { img.setTexture("fit_" + key).setVisible(true); } else img.setVisible(false);
  };
  set("pants", wearing.pants);
  set("shirt", wearing.shirt);
  set("hat", wearing.hat);
  set("cape", wearing.acc === "acc_cape" ? "acc_cape" : null);
  set("acc", wearing.acc && wearing.acc !== "acc_cape" ? wearing.acc : null);
}

// The sidekick (a pup or Sparky): cape (behind), body, extra, hat.
function makeSidekick(scene, x, y) {
  const container = scene.add.container(x, y);
  const layers = {};
  for (const name of ["cape", "body", "acc", "hat"]) {
    layers[name] = scene.add.image(0, 0, name === "body" ? "pet_dog_brown" : "__DEFAULT").setOrigin(0.5, 1).setVisible(name === "body");
    container.add(layers[name]);
  }
  return { container, layers };
}
function dressSidekick(sk, side) {
  const type = side.type === "robot" ? "robot" : "dog";
  sk.layers.body.setTexture("pet_" + side.color);
  const set = (layer, key) => { const img = sk.layers[layer]; if (key) img.setTexture(`pet_${key}_${type}`).setVisible(true); else img.setVisible(false); };
  set("hat", side.hat);
  set("cape", side.acc === "pacc_cape" ? "pacc_cape" : null);
  set("acc", side.acc && side.acc !== "pacc_cape" ? side.acc : null);
}

// --- Visual state ---
// Called after every solve (src/scene/power.js). At night unlit art is
// darkened and lit things glow brighter.
function setPartNight(v, night) {
  for (const img of (v.tintables || [])) {
    if (night) img.setTint(NIGHT_TINT); else img.clearTint();
  }
}

function setHouseVisual(v, level, night = false) {
  v.winDim.setVisible(level === "DIM");
  v.winOn.setVisible(level === "ON");
  const a = level === "ON" ? (night ? 0.8 : 0.25) : level === "DIM" ? (night ? 0.4 : 0.1) : 0;
  for (const g of v.glows) g.setAlpha(a);
}

function setLEDVisual(v, level, brightness01 = null, night = false) {
  const glow = level === "BURNED" ? 0 : Math.max(0, Math.min(1, brightness01 ?? (level === "ON" ? 1 : level === "DIM" ? 0.4 : 0)));
  // The picture follows the solver's level, so a DIM LED never looks fully lit.
  const state = level === "BURNED" ? "burned" : level === "ON" ? "on" : level === "DIM" && glow > 0.02 ? "dim" : "off";
  v.art.setTexture("led_" + state);
  if (night && (state === "off" || state === "burned")) v.art.setTint(NIGHT_TINT); else v.art.clearTint();
  v.glow.setAlpha(state === "off" || state === "burned" ? 0 : glow * (night ? 0.95 : 0.5));
}

function setTransistorVisual(v, on) {
  v.base.setTexture(on ? "switch_on" : "switch_off");
}

// fraction01 = how full the capacitor is (0 = empty, 1 = charged to the
// generator's full voltage).
function setCapacitorVisual(v, fraction01) {
  const f = Math.max(0, Math.min(1, fraction01 || 0));
  v.level.setSize(CAP_INNER.w * PIX, CAP_LEVEL_MAX_H * f);
}

function setGeneratorVisual(v, amps) {
  v.lights.setVisible(amps > 0.01);
}

// --- Effects ---

// A puff of smoke from one of the generator's stacks; destroys itself.
function puffSmoke(scene, x, y, steam = false) {
  const s = PIX * 2;
  const puff = scene.add.rectangle(x, y, s, s, steam ? PALN["C"] : PALN["D"], 0.9).setDepth(19);
  scene.tweens.add({
    targets: puff, y: y - 34 - Math.random() * 10, x: x + 6 + Math.random() * 10,
    scale: 2.2, alpha: 0, duration: 1300, ease: "Sine.Out", onComplete: () => puff.destroy(),
  });
}

// A cartoon "pop" for a burned-out LED: pixel bits burst out, plus a speech
// bubble. Meant to be funny, not punishing.
function playBurnoutEffect(scene, x, y, message) {
  const colors = [PALN["4"], PALN["3"], PALN["2"], PALN["C"]];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const dist = 26 + Math.random() * 14;
    const chip = scene.add.rectangle(x, y, PIX * 2, PIX * 2, colors[i % colors.length]).setDepth(300);
    scene.tweens.add({
      targets: chip, x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, alpha: 0,
      duration: 420, ease: "Cubic.Out", onComplete: () => chip.destroy(),
    });
  }
  const bubble = makeBubble(scene, x, y - 60, message, 170);
  scene.tweens.add({ targets: bubble, y: bubble.y - 30, alpha: { from: 1, to: 0 }, duration: 2200, delay: 500, onComplete: () => bubble.destroy() });
}

// A speech bubble with wrapped text, centred on (x, y) and kept on screen.
function makeBubble(scene, x, y, message, wrapWidth = 220, depth = 301) {
  const pad = 10;
  const bubble = scene.add.container(x, y).setDepth(depth);
  const txt = scene.add.text(0, 0, message, {
    fontFamily: GAME_FONT, fontSize: "14px", color: "#1a1c2c", align: "center", wordWrap: { width: wrapWidth }, lineSpacing: 2,
  }).setOrigin(0.5);
  const w = Math.ceil(txt.width + pad * 2), h = Math.ceil(txt.height + pad * 2);
  const bg = scene.add.rectangle(0, 0, w, h, PALN["C"], 0.97).setStrokeStyle(3, INK);
  const shade = scene.add.rectangle(3, 3, w, h, INK, 0.35); // hard pixel drop shadow
  bubble.add([shade, bg, txt]); // order matters: shadow, background, text
  const W = scene.scale.width, H = scene.scale.height;
  bubble.x = Math.max(w / 2 + 4, Math.min(W - w / 2 - 4, x));
  bubble.y = Math.max(h / 2 + 4, Math.min(H - 48 - h / 2, y));
  bubble.bubbleText = txt;
  return bubble;
}

// Celebration: confetti over the board plus a big banner. Cleans itself up.
function playCelebration(scene, title, header = "★  Mission complete!  ★") {
  const W = scene.scale.width;
  const colors = [PALN["4"], PALN["3"], PALN["5"], PALN["A"], PALN["2"], PALN["C"]];
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W;
    const bit = scene.add.rectangle(x, -10 - Math.random() * 120, PIX * 2, PIX * 3, colors[i % colors.length]).setDepth(400);
    scene.tweens.add({
      targets: bit, y: 560 + Math.random() * 60, x: x + (Math.random() - 0.5) * 160, angle: (Math.random() - 0.5) * 720,
      alpha: { from: 1, to: 0.2 }, duration: 1800 + Math.random() * 900, ease: "Sine.In", onComplete: () => bit.destroy(),
    });
  }
  const banner = makeBubble(scene, W / 2, 300, `${header}\n${title}`, 380, 401);
  banner.bubbleText.setFontSize(26).setFontStyle("bold");
  const bw = banner.bubbleText.width + 44, bh = banner.bubbleText.height + 32;
  banner.list[0].setSize(bw, bh); banner.list[1].setSize(bw, bh).setFillStyle(PALN["4"], 0.98);
  banner.setScale(0.3);
  scene.tweens.add({ targets: banner, scale: 1, duration: 350, ease: "Back.Out" });
  scene.tweens.add({ targets: banner, alpha: 0, delay: 2600, duration: 500, onComplete: () => banner.destroy() });
}
