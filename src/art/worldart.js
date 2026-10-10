// src/art/worldart.js
//
// Sprites for power plants, the last eight worlds (ground tiles, scenery,
// map islands), the town's walking people and cars, emergency critters,
// title-screen pieces and a few more clothes. Same kit and palette as
// src/art/pixelart.js.
//
// Main pieces: PLANT_ART, PLANT_LIGHTS, PLANT_VENTS, makeWorldTextures().
// Used by: src/scene/setup.js (makes the textures), src/scene/parts.js (smoke vents).

// --- Power plants ---
// 40 x 30, the same size as the generator so the GEN dot never moves.
// Each also gets a "lights" overlay for its windows.
const PLANT_ART = {
  plant_solarfarm: () => pixGrid(40, 30, k => {
    for (const [x0, y0] of [[1, 6], [14, 2], [27, 6], [6, 17], [22, 17]]) {
      for (let r = 0; r < 8; r++) k.hline(x0 + Math.floor(r / 3), y0 + r, 12, r % 4 === 3 ? "A" : "9");
      k.px(x0 + 1, y0 + 1, "C");
      k.rect(x0 + 6, y0 + 8, 2, 3, "E");
    }
    k.hline(0, 29, 40, "b"); k.box(30, 22, 9, 7, "D"); k.rect(32, 24, 2, 2, "8"); k.rect(35, 24, 2, 2, "8");
    k.outline("0");
  }),
  plant_wind: () => pixGrid(40, 30, k => {
    k.rect(19, 6, 3, 23, "C"); k.vline(21, 6, 23, "D");                // tower
    k.box(16, 3, 9, 5, "C");                                            // nacelle
    k.rect(8, 26, 24, 3, "6"); k.hline(6, 29, 28, "7");                 // hill
    k.box(28, 22, 8, 7, "D"); k.rect(30, 24, 2, 2, "8"); k.rect(33, 24, 2, 2, "8"); // control hut
    k.outline("0");
  }),
  plant_wind_blades: () => pixGrid(30, 30, k => {
    for (let i = 0; i < 13; i++) { k.px(15, 14 - i, "C"); k.px(16, 14 - i, i > 2 ? "D" : "C"); }      // up
    for (let i = 0; i < 12; i++) { k.px(15 - i, 15 + Math.round(i * 0.58), "C"); k.px(15 - i, 16 + Math.round(i * 0.58), "D"); } // down-left
    for (let i = 0; i < 12; i++) { k.px(16 + i, 15 + Math.round(i * 0.58), "C"); k.px(16 + i, 16 + Math.round(i * 0.58), "D"); } // down-right
    k.box(14, 13, 4, 4, "E");
  }),
  plant_hydro: () => pixGrid(40, 30, k => {
    k.rect(0, 0, 40, 9, "A"); k.hline(2, 3, 6, "B"); k.hline(20, 5, 8, "B");             // lake
    for (let y = 9; y < 28; y++) k.hline(Math.round((y - 9) / 4), y, 40 - 2 * Math.round((y - 9) / 4), y % 4 === 0 ? "D" : "E"); // dam wall
    for (const x of [12, 19, 26]) { k.rect(x, 12, 3, 15, "A"); k.vline(x + 1, 12, 15, "B"); } // spillways
    k.rect(0, 27, 40, 3, "A"); k.hline(3, 28, 5, "C"); k.hline(30, 28, 6, "C");
    k.box(31, 13, 7, 6, "C"); k.rect(33, 15, 2, 2, "8");
    k.outline("0");
  }),
  plant_coal: () => pixGrid(40, 30, k => {
    k.box(6, 0, 6, 16, "2"); k.hline(7, 3, 4, "C"); k.hline(7, 8, 4, "C");               // striped stack
    k.box(26, 5, 5, 11, "E");
    k.box(1, 14, 38, 15, "b"); k.hline(0, 14, 40, "0"); k.hline(2, 15, 36, "1");          // brick hall
    for (const x of [4, 9, 14, 30]) k.rect(x, 18, 3, 3, "8");
    k.box(19, 19, 8, 10, "F");
    for (let i = 0; i < 6; i++) k.hline(30 + (i % 2), 25 + Math.floor(i / 2), 7 - (i % 2), "0"); // coal pile
    k.hline(0, 29, 40, "0");
  }),
  plant_nuclear: () => pixGrid(40, 30, k => {
    for (let y = 0; y < 28; y++) { const half = 7 - Math.round(Math.sin((y / 27) * Math.PI) * 2.5) + (y > 20 ? 1 : 0); k.hline(12 - half, y + 1, half * 2, y % 6 === 0 ? "D" : "C"); } // cooling tower
    k.rect(23, 14, 14, 15, "D"); for (let r = 0; r < 7; r++) k.hline(30 - r, 8 + r, 2 * r + 1, "D");  // reactor dome
    k.hline(23, 20, 14, "4"); k.rect(28, 24, 4, 5, "8");
    k.px(29, 10, "C"); k.px(30, 9, "C");
    k.outline("0");
  }),
  plant_geothermal: () => pixGrid(40, 30, k => {
    k.box(2, 12, 22, 17, "n"); k.hline(1, 12, 24, "0"); for (const x of [5, 11, 17]) k.rect(x, 16, 3, 3, "8");
    k.box(26, 6, 6, 23, "D"); k.box(33, 10, 5, 19, "D");                                    // towers
    k.rect(0, 26, 40, 4, "3"); for (const x of [3, 15, 29]) k.px(x, 27, "4");               // hot rocks
    k.hline(22, 22, 12, "E"); k.vline(23, 18, 4, "E");                                       // pipes
    k.outline("0");
  }),
  plant_biogas: () => pixGrid(40, 30, k => {
    for (const [cx, w] of [[10, 9], [28, 8]]) for (let y = 0; y < w; y++) { const half = Math.round(Math.sqrt(w * w - (w - y) * (w - y))); k.hline(cx - half, 10 + y, 2 * half, "6"); }
    k.rect(1, 18, 19, 10, "6"); k.rect(20, 18, 17, 10, "6"); k.hline(1, 21, 36, "5");
    k.rect(8, 22, 4, 6, "7"); k.rect(26, 22, 4, 6, "7");
    k.box(17, 6, 5, 12, "D"); k.px(19, 5, "3");                                              // flare
    k.hline(0, 28, 40, "b"); k.hline(0, 29, 40, "b");
    k.outline("0");
  }),
  plant_tidal: () => pixGrid(40, 30, k => {
    k.rect(0, 18, 40, 12, "A"); for (const x of [2, 12, 22, 32]) { k.hline(x, 19, 4, "B"); k.hline(x + 3, 24, 4, "B"); }  // sea
    k.box(4, 8, 32, 12, "D"); k.hline(3, 8, 34, "0");                                        // barrage
    for (const x of [8, 18, 28]) { k.rect(x, 12, 5, 6, "8"); k.box(x + 1, 21, 3, 3, "E"); } // turbine gates
    k.box(14, 1, 12, 7, "C"); k.rect(16, 3, 2, 2, "8"); k.rect(22, 3, 2, 2, "8");
  }),
  plant_fusion: () => pixGrid(40, 30, k => {
    for (let y = 0; y < 22; y++) for (let x = 0; x < 40; x++) { const d = Math.hypot((x - 19.5) / 1.4, y - 12); if (d < 10) k.px(x, y + 1, d < 4 ? "4" : d < 6 ? "h" : d > 8.6 ? "F" : "E"); }
    k.hline(2, 13, 36, "v"); k.hline(1, 14, 38, "B"); k.hline(2, 15, 36, "v");               // glowing ring
    k.box(6, 23, 28, 6, "D"); k.rect(17, 25, 6, 4, "8");
    k.outline("0");
  }),
};
// Window lights for each plant, shown while it supplies power.
const PLANT_LIGHTS = {
  plant_solarfarm: [[32, 24], [35, 24]], plant_wind: [[30, 24], [33, 24]], plant_hydro: [[33, 15]],
  plant_coal: [[4, 18], [9, 18], [14, 18], [30, 18]], plant_nuclear: [[28, 24]], plant_geothermal: [[5, 16], [11, 16], [17, 16]],
  plant_biogas: [[8, 22], [26, 22]], plant_tidal: [[16, 3], [22, 3]], plant_fusion: [[17, 25]],
};
// Chimney and vent spots (art pixels) for smoke and steam puffs.
const PLANT_VENTS = { generator: [[7.5, 0], [14, 4]], plant_coal: [[9, 0], [28.5, 5]], plant_nuclear: [[12, 1]], plant_geothermal: [[29, 6], [35.5, 10]], plant_biogas: [[19.5, 5]] };

// --- Ground tiles (16 x 16) for the last eight worlds ---
const GROUND_ART = {
  meadow: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "5"); for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 9], [11, 12], [1, 13]]) { k.px(x, y, "6"); k.px(x + 1, y - 1, "6"); } k.px(7, 6, "C"); k.px(14, 11, "4"); k.px(3, 6, "p"); }),
  forest: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "7"); for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 9], [11, 12], [1, 13], [7, 14]]) { k.px(x, y, "6"); k.px(x + 1, y - 1, "6"); } for (const [x, y] of [[6, 5], [14, 2], [3, 11]]) k.px(x, y, "b"); }),
  pavement: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "E"); k.hline(0, 7, 16, "F"); k.hline(0, 15, 16, "F"); k.vline(7, 0, 7, "F"); k.vline(15, 8, 7, "F"); k.px(3, 3, "D"); k.px(11, 11, "D"); }),
  snow: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "C"); for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 9], [11, 12], [1, 13]]) k.px(x, y, "D"); k.px(7, 6, "B"); k.px(14, 14, "B"); }),
  ash: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "F"); for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 9], [11, 12]]) k.px(x, y, "E"); for (const [x, y] of [[6, 5], [14, 2], [3, 12]]) k.px(x, y, "2"); k.px(10, 8, "3"); }),
  metal: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "D"); k.hline(0, 0, 16, "C"); k.vline(0, 0, 16, "C"); k.hline(0, 15, 16, "E"); k.vline(15, 0, 16, "E"); for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) k.px(x, y, "F"); k.hline(5, 7, 6, "E"); k.hline(5, 9, 6, "E"); }),
  cliff: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "6"); for (const [x, y] of [[2, 3], [9, 1], [13, 7]]) { k.px(x, y, "5"); k.px(x + 1, y - 1, "5"); } for (const [x, y] of [[5, 10], [11, 12], [1, 14]]) { k.px(x, y, "D"); k.px(x + 1, y, "E"); } k.px(7, 6, "7"); }),
  moondust: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "D"); for (const [x, y, r] of [[4, 4, 2], [11, 10, 3]]) { for (let j = -r; j <= r; j++) k.hline(x - r + Math.abs(j) - 1, y + j, 2 * (r - Math.abs(j)) + 2, "E"); k.px(x, y - r, "C"); } k.px(14, 2, "C"); k.px(1, 12, "E"); }),
};
const SKY_SPACE = () => pixGrid(4, 34, k => { for (let y = 0; y < 34; y++) for (let x = 0; x < 4; x++) k.px(x, y, y < 20 ? "0" : (x + y) % 2 ? "8" : "0"); k.px(1, 5, "C"); k.px(3, 13, "4"); k.px(0, 25, "D"); });

// --- Scenery for the last eight worlds ---
const SCENERY_ART = {
  windmill: () => pixGrid(22, 30, k => {
    for (let y = 10; y < 30; y++) { const half = 4 + Math.floor((y - 10) / 5); k.hline(11 - half, y, 2 * half, y % 5 === 0 ? "b" : "n"); }
    k.rect(9, 24, 4, 6, "b"); k.px(10, 14, "8"); k.px(11, 14, "8");
    for (let i = 0; i < 9; i++) { k.px(11 - i, 9 - i, "b"); k.px(11 + i, 9 - i, "b"); k.px(11 - i, 9 + i, "b"); k.px(11 + i, 9 + i, "b"); }
    for (let i = 2; i < 9; i++) { k.px(10 - i, 9 - i, "C"); k.px(12 + i, 9 - i, "C"); }
    k.outline("0");
  }),
  haybale: () => pixGrid(12, 9, k => { k.rect(1, 1, 10, 7, "4"); k.hline(1, 1, 10, "h"); k.vline(3, 1, 7, "g"); k.vline(8, 1, 7, "g"); k.outline("0"); }),
  fence: () => pixGrid(20, 8, k => { for (const x of [1, 9, 17]) k.rect(x, 0, 2, 8, "b"); k.hline(0, 2, 20, "b"); k.hline(0, 5, 20, "b"); k.outline("0"); }),
  bigtree: () => pixGrid(22, 30, k => {
    k.rect(9, 18, 4, 11, "b"); k.vline(12, 18, 11, "1");
    k.rect(3, 4, 16, 14, "7"); k.rect(1, 8, 20, 7, "7"); k.rect(6, 1, 10, 4, "7"); k.rect(5, 5, 4, 3, "6"); k.rect(12, 3, 3, 2, "6"); k.rect(3, 10, 3, 3, "6");
    k.outline("0");
  }),
  waterfall: () => pixGrid(30, 30, k => {
    k.rect(0, 0, 9, 30, "E"); k.rect(21, 0, 9, 30, "E"); k.rect(0, 0, 30, 4, "E");
    for (let y = 4; y < 26; y++) k.hline(9, y, 12, y % 3 === 0 ? "C" : "A");
    k.rect(4, 25, 22, 5, "A"); k.hline(6, 26, 4, "C"); k.hline(17, 27, 5, "C");
    for (const [x, y] of [[2, 6], [24, 9], [3, 17]]) { k.px(x, y, "6"); k.px(x + 1, y, "6"); }
    k.outline("0");
  }),
  log: () => pixGrid(26, 8, k => { k.rect(2, 1, 22, 6, "b"); k.hline(2, 2, 22, "1"); k.rect(22, 1, 3, 6, "n"); k.px(23, 3, "b"); k.px(8, 0, "6"); k.px(9, 0, "6"); k.outline("0"); }),
  mushroom: () => pixGrid(9, 9, k => { k.rect(1, 1, 7, 3, "2"); k.px(3, 1, "C"); k.px(6, 2, "C"); k.rect(3, 4, 3, 4, "n"); k.outline("0"); }),
  skyscraper: () => pixGrid(18, 34, k => { k.box(1, 2, 16, 32, "F"); k.hline(4, 0, 10, "E"); k.vline(9, 0, 2, "D"); for (let y = 5; y < 32; y += 4) for (let x = 3; x < 15; x += 3) k.rect(x, y, 2, 2, (x + y) % 5 ? "8" : "4"); }),
  tower: () => pixGrid(14, 28, k => { k.box(1, 3, 12, 25, "8"); k.hline(3, 1, 8, "9"); for (let y = 6; y < 26; y += 4) for (let x = 3; x < 11; x += 3) k.rect(x, y, 2, 2, (x * y) % 7 ? "9" : "B"); }),
  neonsign: () => pixGrid(20, 12, k => { k.box(0, 0, 20, 10, "0"); for (let x = 2; x < 18; x++) k.px(x, 2, x % 2 ? "p" : "v"); k.hline(3, 5, 14, "B"); k.hline(2, 7, 16, "p"); k.rect(5, 10, 2, 2, "E"); k.rect(13, 10, 2, 2, "E"); }),
  igloo: () => pixGrid(24, 14, k => { for (let y = 0; y < 13; y++) { const half = Math.round(Math.sqrt(Math.max(0, 144 - (12 - y) ** 2))); k.hline(12 - half, y + 1, 2 * half, (y % 4 === 3) ? "D" : "C"); } k.rect(9, 8, 6, 6, "0"); k.rect(10, 9, 4, 5, "8"); k.outline("0"); }),
  iceblock: () => pixGrid(12, 10, k => { k.rect(1, 1, 10, 8, "B"); k.hline(1, 1, 10, "C"); k.px(3, 3, "C"); k.vline(9, 2, 6, "A"); k.outline("0"); }),
  penguin: () => pixGrid(9, 12, k => { k.rect(2, 1, 5, 10, "0"); k.rect(3, 4, 3, 6, "C"); k.px(3, 2, "C"); k.px(5, 2, "C"); k.px(4, 3, "3"); k.rect(2, 11, 2, 1, "3"); k.rect(5, 11, 2, 1, "3"); }),
  volcano: () => pixGrid(44, 26, k => {
    for (let r = 0; r < 26; r++) { const half = 4 + Math.round(r * 0.75); k.hline(22 - half, r, 2 * half, r < 3 ? "2" : r % 6 === 0 ? "E" : "F"); }
    k.rect(19, 0, 7, 2, "3"); k.px(21, 3, "3"); k.px(22, 4, "2"); k.px(23, 6, "3"); k.px(24, 8, "2");
    k.outline("0");
  }),
  lavarock: () => pixGrid(12, 8, k => { k.rect(1, 1, 10, 6, "F"); k.hline(2, 1, 6, "E"); k.px(4, 4, "3"); k.px(7, 3, "2"); k.px(8, 5, "3"); k.outline("0"); }),
  gear: () => pixGrid(16, 16, k => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - 7.5, y - 7.5), a = Math.atan2(y - 7.5, x - 7.5); const tooth = Math.cos(a * 8) > 0.3; if (d < (tooth ? 7.6 : 6) && d > 2.2) k.px(x, y, d < 4 ? "E" : "D"); } k.outline("0"); }),
  robotarm: () => pixGrid(20, 26, k => { k.box(4, 22, 12, 4, "E"); k.rect(9, 12, 3, 10, "4"); k.rect(9, 10, 10, 3, "4"); k.box(16, 5, 3, 6, "4"); k.px(17, 4, "E"); k.px(18, 11, "E"); k.box(7, 10, 6, 4, "F"); k.outline("0"); }),
  crate: () => pixGrid(12, 11, k => { k.box(0, 0, 12, 11, "b"); k.hline(1, 5, 10, "1"); k.vline(5, 1, 9, "1"); k.px(2, 2, "n"); }),
  bentpine: () => pixGrid(18, 24, k => { k.rect(7, 16, 2, 7, "b"); for (const [top, height, maxHalf] of [[1, 6, 3], [5, 7, 5], [10, 8, 6]]) for (let i = 0; i < height; i++) { const half = 1 + Math.round((i * (maxHalf - 1)) / (height - 1)); k.hline(10 - half + Math.round(i / 3), top + i, 2 * half, i < height - 2 ? "7" : "F"); } k.outline("0"); }),
  wave: () => pixGrid(20, 8, k => { k.rect(0, 4, 20, 4, "A"); for (let x = 0; x < 20; x++) k.px(x, 3 - Math.round(Math.sin(x / 3) * 2 + 1), "C"); k.hline(2, 5, 4, "B"); k.hline(12, 6, 5, "B"); }),
  dome: () => pixGrid(30, 18, k => { for (let y = 0; y < 15; y++) { const half = Math.round(Math.sqrt(Math.max(0, 225 - (15 - y) ** 2))); k.hline(15 - half, y, 2 * half, y < 5 ? "B" : "A"); } k.px(9, 4, "C"); k.px(10, 3, "C"); k.rect(0, 15, 30, 3, "D"); k.rect(12, 10, 6, 5, "8"); k.outline("0"); }),
  rocket: () => pixGrid(12, 30, k => { for (let y = 0; y < 6; y++) k.hline(6 - Math.ceil(y / 2), y, Math.ceil(y / 2) * 2, "2"); k.rect(3, 6, 6, 18, "C"); k.rect(5, 10, 2, 2, "9"); k.rect(0, 18, 3, 7, "2"); k.rect(9, 18, 3, 7, "2"); k.rect(4, 24, 4, 2, "E"); k.rect(4, 26, 4, 3, "3"); k.px(5, 29, "4"); k.px(6, 29, "4"); k.outline("0"); }),
  dish: () => pixGrid(18, 18, k => { for (let i = 0; i < 12; i++) k.hline(3 + Math.round(i / 3), 1 + i, 12 - Math.round(i * 0.8), i % 3 ? "C" : "D"); k.rect(8, 12, 2, 5, "E"); k.hline(4, 17, 10, "E"); k.px(13, 3, "4"); k.outline("0"); }),
  crater: () => pixGrid(18, 7, k => { k.rect(2, 1, 14, 5, "E"); k.hline(4, 0, 10, "D"); k.hline(3, 2, 12, "F"); k.outline("0"); }),
  flag: () => pixGrid(12, 20, k => { k.vline(1, 0, 20, "D"); k.rect(2, 1, 9, 7, "9"); k.px(7, 2, "4"); k.px(6, 3, "4"); k.px(5, 4, "4"); k.px(6, 4, "4"); k.px(7, 4, "4"); k.px(6, 5, "4"); k.px(5, 6, "4"); }),
};

// --- Map islands for the last eight worlds (44 x 28) ---
const WORLD_ISLANDS = {
  windmill: () => SPRITE_ISLAND("5", "6", k => { k.vline(21, 6, 8, "b"); for (let i = 0; i < 4; i++) { k.px(21 - i, 6 - i, "C"); k.px(21 + i, 6 - i, "C"); } }),
  waterfall: () => SPRITE_ISLAND("7", "6", k => { k.rect(19, 3, 5, 14, "A"); k.vline(21, 3, 14, "C"); }),
  neon: () => SPRITE_ISLAND("E", "F", k => { for (const [x, h] of [[12, 10], [18, 14], [25, 9], [30, 12]]) { k.rect(x, 16 - h, 4, h, "8"); k.px(x + 1, 18 - h, "p"); } }),
  tundra: () => SPRITE_ISLAND("C", "D", k => { k.rect(16, 9, 10, 5, "B"); k.hline(17, 8, 8, "C"); }),
  volcano: () => SPRITE_ISLAND("6", "F", k => { for (let r = 0; r < 10; r++) k.hline(21 - r, 2 + r, 2 * r + 2, r < 2 ? "2" : "F"); k.px(21, 1, "3"); }),
  robot: () => SPRITE_ISLAND("D", "E", k => { k.rect(14, 6, 14, 9, "E"); k.rect(17, 2, 3, 5, "F"); k.rect(23, 4, 3, 3, "F"); k.px(18, 9, "4"); k.px(24, 9, "4"); }),
  storm: () => SPRITE_ISLAND("6", "E", k => { k.rect(12, 4, 18, 4, "E"); k.px(20, 8, "4"); k.px(19, 9, "4"); k.px(20, 10, "4"); }),
  moon: () => SPRITE_ISLAND("D", "E", k => { for (const [x, y] of [[11, 8], [25, 12], [30, 6]]) { k.rect(x, y, 4, 3, "E"); k.px(x + 1, y, "C"); } k.rect(17, 3, 9, 5, "B"); }),
};

// --- Town life: people (8 x 12, two walking frames) and cars ---
const WALKER_COLORS = [["9", "8"], ["2", "8"], ["6", "b"], ["4", "F"], ["p", "9"], ["C", "E"], ["3", "8"], ["v", "F"]];
const WALKER_SKIN = ["s", "n", "b"];
function SPRITE_WALKER(shirt, pants, skin, frame) {
  return pixGrid(8, 12, k => {
    k.rect(2, 0, 4, 4, skin); k.hline(2, 0, 4, "k"); k.px(3, 2, "0"); k.px(5, 2, "0");
    k.rect(2, 4, 4, 4, shirt); k.px(1, 5, skin); k.px(6, 5, skin);
    if (frame) { k.rect(2, 8, 2, 3, pants); k.rect(4, 8, 2, 2, pants); k.px(5, 10, pants); }
    else { k.rect(2, 8, 2, 2, pants); k.px(1, 10, pants); k.rect(4, 8, 2, 3, pants); }
    k.outline("0");
  });
}
const CAR_COLORS = ["2", "9", "4", "6", "p", "C"];
function SPRITE_CAR(c) {
  return pixGrid(20, 10, k => {
    k.rect(1, 4, 18, 4, c); k.rect(5, 1, 9, 4, c); k.rect(6, 2, 3, 2, "B"); k.rect(10, 2, 3, 2, "B");
    k.px(18, 5, "4"); k.px(1, 5, "2");
    k.rect(3, 7, 4, 3, "0"); k.rect(13, 7, 4, 3, "0"); k.px(4, 8, "D"); k.px(14, 8, "D");
    k.outline("0");
  });
}

// --- Emergency critters, props and title-screen pieces ---
const SPRITE_SQUIRREL = () => pixGrid(14, 11, k => {
  k.rect(0, 1, 4, 7, "3"); k.rect(1, 0, 3, 2, "3"); k.vline(1, 2, 5, "4");          // big tail
  k.rect(4, 5, 6, 4, "3"); k.rect(8, 2, 4, 4, "3"); k.px(9, 1, "3"); k.px(11, 3, "0"); k.px(12, 4, "1");
  k.rect(5, 9, 2, 2, "1"); k.rect(8, 9, 2, 2, "1");
  k.outline("0");
});
const SPRITE_BOLT_BIG = () => pixGrid(14, 22, k => {
  for (const [x0, y, len] of [[8, 0, 5], [7, 1, 5], [6, 2, 5], [5, 3, 5], [4, 4, 5], [3, 5, 5], [2, 6, 5], [1, 7, 10], [2, 8, 10], [6, 9, 5], [5, 10, 5], [5, 11, 4], [4, 12, 4], [4, 13, 3], [3, 14, 3], [3, 15, 3], [2, 16, 3], [2, 17, 2], [1, 18, 2], [1, 19, 1], [0, 20, 1]]) k.hline(x0, y, len, "4");
  for (const [x, y] of [[9, 1], [8, 2], [7, 3], [6, 4], [5, 5], [4, 6]]) k.px(x, y, "h");
  k.outline("0");
});
const SPRITE_PEOPLE_ICON = () => pixGrid(12, 9, k => { k.rect(1, 0, 3, 3, "s"); k.rect(0, 3, 5, 5, "9"); k.rect(7, 1, 3, 3, "s"); k.rect(6, 4, 5, 5, "2"); k.outline("0"); });
const SPRITE_ALARM = () => pixGrid(14, 14, k => { k.rect(4, 1, 6, 2, "2"); k.rect(2, 3, 10, 8, "2"); k.rect(4, 4, 2, 3, "C"); k.rect(1, 11, 12, 2, "F"); k.px(7, 0, "4"); k.outline("0"); });
function starShape(fill, shine) {
  // Five-pointed star: fill every pixel whose centre is inside the polygon.
  const N = 15, c = (N - 1) / 2, pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.1 : 7.4; pts.push([c + r * Math.cos(a), c + 0.6 + r * Math.sin(a)]); }
  const inside = (x, y) => { let s = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  return pixGrid(N, N, k => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inside(x + 0.5, y + 0.5)) k.px(x, y, fill);
    if (shine) { k.px(6, 4, shine); k.px(6, 5, shine); k.px(5, 6, shine); }
    k.outline("0");
  });
}
const SPRITE_STAR_BIG = () => starShape("4", "h");
const SPRITE_STAR_EMPTY = () => starShape("F", null);
const SPRITE_PYLON = () => pixGrid(12, 26, k => { for (let y = 2; y < 26; y++) { const half = 1 + Math.floor(y / 6); k.px(6 - half, y, "F"); k.px(5 + half, y, "F"); if (y % 4 === 0) k.hline(6 - half, y, 2 * half, "F"); } k.hline(0, 3, 12, "F"); k.hline(1, 8, 10, "F"); k.px(0, 4, "D"); k.px(11, 4, "D"); });

// More clothes for the engineer (same 16 x 26 frame).

const NEW_OUTFITS = {
  hat_straw:   () => pixGrid(16, 26, k => { k.rect(5, 1, 6, 3, "4"); k.hline(2, 4, 12, "4"); k.hline(5, 3, 6, "2"); k.px(6, 1, "h"); }),
  acc_shades:  () => pixGrid(16, 26, k => { k.rect(4, 7, 4, 2, "0"); k.rect(8, 7, 4, 2, "0"); k.px(5, 7, "p"); k.px(9, 7, "p"); k.px(6, 8, "v"); k.px(10, 8, "v"); }),
  shirt_parka: () => pixGrid(16, 26, k => { k.rect(3, 12, 10, 9, "A"); k.rect(2, 13, 1, 6, "A"); k.rect(13, 13, 1, 6, "A"); k.hline(4, 11, 8, "C"); k.px(4, 12, "C"); k.px(11, 12, "C"); k.vline(8, 13, 8, "9"); k.hline(3, 20, 10, "9"); }),
  hat_helmet:  () => pixGrid(16, 26, k => { for (let y = 1; y < 13; y++) { const half = Math.round(Math.sqrt(Math.max(0, 36 - (y - 7) ** 2))) + 1; k.px(8 - half, y, "C"); k.px(7 + half, y, "C"); } k.hline(4, 1, 8, "C"); k.hline(3, 12, 10, "D"); k.px(5, 3, "B"); k.px(10, 3, "4"); }),
};

function makeWorldTextures(scene) {
  for (const [key, fn] of Object.entries(PLANT_ART)) makeTex(scene, key, fn());
  for (const [key, spots] of Object.entries(PLANT_LIGHTS)) makeTex(scene, key + "_lights", pixGrid(40, 30, k => { for (const [x, y] of spots) { k.rect(x, y, 2, 2, "B"); k.px(x, y, "C"); } }));
  for (const [key, fn] of Object.entries(GROUND_ART)) makeTex(scene, key, fn());
  makeTex(scene, "sky_space", SKY_SPACE(), 4);
  for (const [key, fn] of Object.entries(SCENERY_ART)) makeTex(scene, "scn_" + key, fn());
  for (const [key, fn] of Object.entries(WORLD_ISLANDS)) makeTex(scene, "island_" + key, fn());
  WALKER_COLORS.forEach(([shirt, pants], i) => { for (const f of [0, 1]) makeTex(scene, `walker_${i}_${f}`, SPRITE_WALKER(shirt, pants, WALKER_SKIN[i % WALKER_SKIN.length], f), 2); });
  CAR_COLORS.forEach((c, i) => makeTex(scene, "car_" + i, SPRITE_CAR(c), 2));
  makeTex(scene, "squirrel", SPRITE_SQUIRREL(), 2);
  makeTex(scene, "bolt_big", SPRITE_BOLT_BIG(), 4);
  makeTex(scene, "people", SPRITE_PEOPLE_ICON(), 2);
  makeTex(scene, "alarm", SPRITE_ALARM(), 2);
  makeTex(scene, "star_big", SPRITE_STAR_BIG(), 3);
  makeTex(scene, "star_empty", SPRITE_STAR_EMPTY(), 3);
  makeTex(scene, "pylon", SPRITE_PYLON(), 2);
  for (const [key, fn] of Object.entries(NEW_OUTFITS)) makeTex(scene, "fit_" + key, fn());
}
