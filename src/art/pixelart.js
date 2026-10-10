// src/art/pixelart.js
//
// The pixel-art kit and the core sprites: houses, the generator, circuit
// parts (resistor, capacitor, LED, switch, transformer), trees and ground
// tiles. Everything is drawn in code at startup, so there are no image files.
// Each sprite is a small grid of palette letters, turned into a Phaser
// texture where one art pixel is PIX screen pixels wide.
// Palette: Sweetie 16 by GrafxKid, plus a few extras (wood, beige, violet, gold).
//
// Main pieces: PAL, PALN, pixGrid(), makeTex(), makePixelTextures(),
// resistorTexture(), resistorBandNames().
// Used by: the other src/art/ files (same kit), src/scene/setup.js,
// src/scene/parts.js, src/ui/*.

const PIX = 3; // screen pixels per art pixel

const PAL = {
  "0": "#1a1c2c", // ink / outline
  "1": "#5d275d", // plum
  "2": "#b13e53", // brick red
  "3": "#ef7d57", // orange
  "4": "#ffcd75", // warm yellow
  "5": "#a7f070", // light green
  "6": "#38b764", // green
  "7": "#257179", // teal
  "8": "#29366f", // navy
  "9": "#3b5dc9", // blue
  "A": "#41a6f6", // sky blue
  "B": "#73eff7", // cyan
  "C": "#f4f4f4", // white
  "D": "#94b0c2", // light steel
  "E": "#566c86", // steel
  "F": "#333c57", // dark steel
  "b": "#7a4a2a", // wood brown
  "n": "#e8c9a0", // beige (resistor body, walls)
  "v": "#8a4fd8", // violet (resistor stripe 7)
  "g": "#c9a227", // gold (resistor tolerance stripe)
  "h": "#fff6b8", // window highlight
  "r": "#e04848", // LED red, lit
  "s": "#f2b880", // skin (the engineer in the corner)
  "k": "#5a3a22", // hair
  "p": "#e86aa8", // pink (ice cream, flowers)
};

// Colours used outside textures (wires, dots, UI), as numbers for Phaser.
const PALN = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [k, parseInt(v.slice(1), 16)]));

// Draw on a w x h grid of palette characters ("." = transparent).
function pixGrid(w, h, draw) {
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const kit = {
    px: set,
    rect(x, y, rw, rh, c) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) set(i, j, c); },
    box(x, y, rw, rh, fill, line = "0") { kit.rect(x, y, rw, rh, line); kit.rect(x + 1, y + 1, rw - 2, rh - 2, fill); },
    hline(x, y, len, c) { kit.rect(x, y, len, 1, c); },
    vline(x, y, len, c) { kit.rect(x, y, 1, len, c); },
    // Outline everything drawn so far, so a green tree shows up on green grass.
    outline(c = "0") {
      const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && g[y][x] !== "." && g[y][x] !== "*";
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (g[y][x] === "." && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g[y][x] = "*";
      }
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === "*") g[y][x] = c;
    },
  };
  draw(kit);
  return g.map(r => r.join(""));
}

function makeTex(scene, key, rows, scale = PIX) {
  if (!scene.textures.exists(key)) scene.textures.generate(key, { data: rows, pixelWidth: scale, palette: PAL });
  return key;
}

// --- Sprite designs ---

// House, 30 x 28. houseWindows() draws the glass for both window overlays (dim and lit).
function houseWindows(k, glass, hi) {
  for (const wx of [6, 19]) {
    k.rect(wx + 1, 17, 4, 4, glass);
    if (hi) { k.px(wx + 1, 17, hi); k.px(wx + 2, 17, hi); k.px(wx + 1, 18, hi); }
  }
}
const SPRITE_HOUSE = () => pixGrid(30, 28, k => {
  k.box(20, 2, 4, 9, "E");                 // chimney
  k.hline(19, 2, 6, "0");
  for (let r = 0; r <= 11; r++) {           // stepped roof
    k.hline(14 - r, r, 2 + 2 * r, r % 3 === 2 ? "1" : "2");
    k.px(14 - r, r, "0"); k.px(15 + r, r, "0");
  }
  k.hline(14, 0, 2, "0");
  k.hline(2, 12, 26, "0");                  // eave
  k.box(4, 13, 22, 15, "n");                // walls
  k.hline(5, 26, 20, "D");                  // baseboard
  k.box(13, 19, 5, 9, "b");                 // door
  k.px(16, 23, "4");                        // door knob
  for (const wx of [6, 19]) {               // windows: dark frame, dark glass, white sill
    k.box(wx, 16, 6, 6, "F");
    k.hline(wx - 1, 22, 8, "C");
  }
});
const SPRITE_HOUSE_WIN_DIM = () => pixGrid(30, 28, k => houseWindows(k, "3", null));
const SPRITE_HOUSE_WIN_ON = () => pixGrid(30, 28, k => houseWindows(k, "4", "h"));

// Power station, 40 x 30, with two smokestacks and a lightning-bolt sign.
const GEN_WINDOWS = [4, 8, 12, 28, 32];
const SPRITE_GEN = () => pixGrid(40, 30, k => {
  k.box(5, 0, 5, 14, "D"); k.hline(6, 2, 3, "2"); k.hline(6, 5, 3, "2");   // tall stack
  k.box(12, 4, 4, 10, "D"); k.hline(13, 6, 2, "2");                       // short stack
  k.box(1, 12, 38, 17, "E");                                              // hall
  k.hline(0, 12, 40, "0"); k.hline(2, 13, 36, "D");                       // roof edge
  for (const x of GEN_WINDOWS) k.rect(x, 16, 3, 3, "8");                 // dark windows
  k.box(17, 15, 8, 11, "4");                                              // bolt sign
  for (const [x, y] of [[21, 16], [20, 17], [21, 17], [19, 18], [20, 18], [19, 19], [20, 19], [21, 19], [22, 19], [21, 20], [22, 20], [21, 21], [20, 22], [20, 23]]) k.px(x, y, "0");
  k.box(30, 21, 6, 8, "F"); k.px(34, 25, "4");                            // door
  k.hline(0, 29, 40, "0");
});
const SPRITE_GEN_LIGHTS = () => pixGrid(40, 30, k => { for (const x of GEN_WINDOWS) { k.rect(x, 16, 3, 3, "B"); k.px(x, 16, "C"); } });

// Ground symbol on a little dirt patch, 16 x 15.
const SPRITE_GND = () => pixGrid(16, 15, k => {
  k.rect(7, 0, 2, 6, "0");
  k.rect(1, 6, 14, 2, "0");
  k.rect(3, 9, 10, 2, "0");
  k.rect(5, 12, 6, 2, "0");
  k.hline(0, 14, 16, "b");
});

// Resistor, 10 x 31, standing up, with the real colour-code stripes.
const BAND_COLOR = ["0", "b", "2", "3", "4", "6", "9", "v", "E", "C"];
const BAND_NAME = ["black", "brown", "red", "orange", "yellow", "green", "blue", "violet", "grey", "white"];
function resistorBands(ohms) {
  let m = 0, v = Math.max(1, Math.round(ohms));
  while (v >= 100) { v = Math.round(v / 10); m++; }
  if (v < 10) { v *= 10; m--; }
  const digits = [Math.floor(v / 10), v % 10, Math.max(0, Math.min(9, m))];
  return digits;
}
const SPRITE_RES = (ohms) => pixGrid(10, 31, k => {
  k.rect(4, 0, 2, 9, "D");                       // top lead
  k.rect(4, 22, 2, 9, "D");                      // bottom lead
  k.box(1, 8, 8, 15, "n");                       // body
  k.px(1, 8, "."); k.px(8, 8, "."); k.px(1, 22, "."); k.px(8, 22, ".");
  const [d1, d2, mul] = resistorBands(ohms);
  k.rect(2, 10, 6, 2, BAND_COLOR[d1]);
  k.rect(2, 13, 6, 2, BAND_COLOR[d2]);
  k.rect(2, 16, 6, 2, BAND_COLOR[mul]);
  k.rect(2, 19, 6, 1, "g");                      // gold tolerance stripe
});

// Electrolytic capacitor, 14 x 40: a can with a minus stripe and a longer + leg.
const CAP_INNER = { x: 2, y: 3, w: 7, h: 18 };  // charge gauge area, in art pixels
const SPRITE_CAP = () => pixGrid(14, 40, k => {
  k.box(1, 0, 12, 22, "A");
  k.hline(2, 1, 10, "B");                        // rim highlight
  k.rect(CAP_INNER.x, CAP_INNER.y, CAP_INNER.w, CAP_INNER.h, "B");
  k.rect(9, 2, 3, 19, "E");                      // minus stripe
  for (const y of [5, 9, 13, 17]) k.px(10, y, "C");
  k.rect(4, 22, 2, 18, "D");                     // + leg (longer)
  k.rect(9, 22, 2, 14, "D");                     // - leg
});

// Transformer, 20 x 22: iron core, input coil (orange) on top, output coil
// (blue) below, matching the dot colours.
const SPRITE_XFMR = () => pixGrid(20, 22, k => {
  k.rect(2, 4, 16, 14, "0"); k.rect(3, 5, 14, 12, "E");
  k.rect(6, 8, 8, 6, "0"); k.rect(7, 9, 6, 4, ".");
  k.rect(4, 1, 12, 7, "0"); k.rect(5, 2, 10, 5, "3");
  for (let x = 6; x <= 14; x += 2) k.vline(x, 2, 5, "2");
  k.rect(4, 14, 12, 7, "0"); k.rect(5, 15, 10, 5, "A");
  for (let x = 6; x <= 14; x += 2) k.vline(x, 15, 5, "9");
});

// Knife switch, 22 x 16. Blade down = closed (ON), up = open (OFF).
const SPRITE_SWITCH = (closed) => pixGrid(22, 16, k => {
  k.box(1, 11, 20, 5, "b");
  k.box(2, 7, 4, 5, "D");                         // pivot post
  k.box(15, 7, 5, 5, "D");                        // contact post
  k.rect(16, 8, 3, 1, "0");                       // contact slot
  if (closed) {
    k.rect(4, 7, 15, 2, "E"); k.hline(4, 7, 15, "D");
    k.box(17, 4, 4, 4, "2");
  } else {
    for (let i = 0; i <= 10; i++) { const y = 7 - Math.round(i * 0.65); k.px(4 + i, y, "D"); k.px(4 + i, y + 1, "E"); }
    k.box(13, 0, 4, 4, "2");
  }
  k.px(4, 8, "0");                                // pivot pin
});

// LED, 10 x 24. The longer leg is + (anode), like a real LED.
const LED_DOME = { off: "1", dim: "2", on: "r", burned: "F" };
const SPRITE_LED = (state) => pixGrid(10, 24, k => {
  const c = LED_DOME[state];
  k.box(1, 1, 8, 9, c);
  k.px(1, 1, "."); k.px(8, 1, "."); k.hline(3, 0, 4, "0"); k.px(2, 1, "0"); k.px(7, 1, "0");
  if (state === "on") { k.px(3, 2, "C"); k.px(3, 3, "C"); k.px(4, 2, "h"); }
  if (state === "dim") k.px(3, 3, "3");
  if (state === "burned") { k.px(4, 3, "0"); k.px(5, 4, "0"); k.px(4, 5, "0"); k.px(5, 6, "0"); }
  k.rect(0, 9, 10, 2, "0"); k.hline(1, 9, 8, "E");
  k.rect(3, 11, 1, 13, "D");                      // + leg (longer)
  k.rect(6, 11, 1, 10, "D");                      // - leg
});

// --- Scenery ---
const SPRITE_TREE = () => pixGrid(18, 22, k => {
  k.rect(8, 14, 3, 7, "b"); k.vline(10, 14, 7, "1");                 // trunk with a shaded side
  k.rect(4, 3, 10, 11, "6"); k.rect(2, 6, 14, 6, "6"); k.rect(6, 1, 6, 3, "6");
  k.rect(5, 4, 3, 2, "5"); k.rect(3, 7, 2, 2, "5"); k.rect(10, 2, 2, 1, "5"); // sunlit leaves
  k.rect(10, 10, 4, 3, "7"); k.rect(4, 11, 3, 2, "7"); k.rect(13, 7, 2, 3, "7"); // shade
  k.outline("0");
});
const SPRITE_PINE = () => pixGrid(14, 24, k => {
  k.rect(6, 18, 2, 5, "b");
  // three stacked triangles (top, height, widest half-width), lit on the left
  for (const [top, height, maxHalf] of [[1, 6, 3], [5, 7, 5], [10, 8, 6]]) {
    for (let i = 0; i < height; i++) {
      const half = 1 + Math.round((i * (maxHalf - 1)) / (height - 1));
      k.hline(7 - half, top + i, 2 * half, i < height - 2 ? "6" : "7");
      k.px(7 - half, top + i, "5");
    }
  }
  k.outline("0");
});
const SPRITE_FLOWERS = () => pixGrid(9, 6, k => {
  k.px(1, 1, "4"); k.px(2, 2, "6"); k.px(5, 0, "C"); k.px(5, 1, "4"); k.px(6, 2, "6"); k.px(7, 3, "2"); k.px(8, 4, "6"); k.px(2, 4, "3"); k.px(2, 5, "6");
});
const SPRITE_ROCK = () => pixGrid(7, 4, k => { k.box(0, 1, 7, 3, "D"); k.hline(1, 0, 5, "0"); k.hline(1, 1, 3, "C"); });

// --- Ground tiles (scale 3) and road (scale 4) ---
const SPRITE_GRASS = () => pixGrid(16, 16, k => {
  k.rect(0, 0, 16, 16, "6");
  for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 9], [11, 12], [1, 13], [7, 14]]) { k.px(x, y, "5"); k.px(x + 1, y - 1, "5"); }
  for (const [x, y] of [[6, 5], [14, 2], [3, 11], [12, 9], [9, 15]]) k.px(x, y, "7");
});
const SPRITE_ROAD = () => pixGrid(16, 18, k => {
  k.hline(0, 0, 16, "D"); k.hline(0, 1, 16, "0");
  k.rect(0, 2, 16, 14, "F");
  for (const [x, y] of [[3, 4], [11, 6], [6, 12], [14, 13], [1, 10]]) k.px(x, y, "E");
  k.rect(0, 8, 8, 2, "4");                       // centre dash
  k.hline(0, 16, 16, "0"); k.hline(0, 17, 16, "D");
});
const SPRITE_SKY = () => pixGrid(4, 34, k => {
  for (let y = 0; y < 34; y++) {
    const band = y < 12 ? "A" : y < 24 ? ((y + 0) % 2 === 0 ? "B" : "A") : "B";
    for (let x = 0; x < 4; x++) k.px(x, y, (y >= 12 && y < 24) ? ((x + y) % 2 ? "A" : "B") : band);
  }
});

function makePixelTextures(scene) {
  makeTex(scene, "house", SPRITE_HOUSE());
  makeTex(scene, "house_win_dim", SPRITE_HOUSE_WIN_DIM());
  makeTex(scene, "house_win_on", SPRITE_HOUSE_WIN_ON());
  makeTex(scene, "gen", SPRITE_GEN());
  makeTex(scene, "gen_lights", SPRITE_GEN_LIGHTS());
  makeTex(scene, "gnd", SPRITE_GND());
  makeTex(scene, "cap", SPRITE_CAP());
  makeTex(scene, "xfmr", SPRITE_XFMR());
  makeTex(scene, "switch_on", SPRITE_SWITCH(true));
  makeTex(scene, "switch_off", SPRITE_SWITCH(false));
  for (const s of Object.keys(LED_DOME)) makeTex(scene, "led_" + s, SPRITE_LED(s));
  makeTex(scene, "tree", SPRITE_TREE());
  makeTex(scene, "pine", SPRITE_PINE());
  makeTex(scene, "flowers", SPRITE_FLOWERS());
  makeTex(scene, "rock", SPRITE_ROCK());
  makeTex(scene, "grass", SPRITE_GRASS());
  makeTex(scene, "road", SPRITE_ROAD(), 4);
  makeTex(scene, "sky", SPRITE_SKY(), 4);

  // Soft round glow for lit windows and LEDs, shown with additive blending.

  if (!scene.textures.exists("glow")) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    for (let r = 32; r > 0; r -= 4) { g.fillStyle(0xffffff, 0.06 + (32 - r) * 0.004); g.fillCircle(32, 32, r); }
    g.generateTexture("glow", 64, 64);
    g.destroy();
  }
}

function resistorTexture(scene, ohms) {
  return makeTex(scene, "res_" + Math.round(ohms), SPRITE_RES(ohms));
}

// "yellow-violet-brown" for 470 ohms, etc.
function resistorBandNames(ohms) {
  return resistorBands(ohms).map(d => BAND_NAME[d]).join("-");
}
