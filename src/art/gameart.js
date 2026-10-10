// src/art/gameart.js
//
// Sprites for the game layer: shop buildings, solar panel and battery, the
// engineer and their clothes, coins, the gift chest, weather icons,
// decorations, the sidekick pets, Captain Short Circuit, Sparky and the
// first four world-map islands. Same kit and palette as src/art/pixelart.js.
//
// Main pieces: SPRITE_BUILDINGS, SPRITE_OUTFIT, SPRITE_DECOR, BAT_INNER,
// makeGameTextures(), buildingTexture().
// Used by: src/scene/setup.js (makes the textures), src/scene/parts.js,
// src/ui/popups.js. src/art/shopart.js adds more entries to these tables.

// --- Buildings ---
// All use the cottage's 30 x 28 frame and window spots, so the house_win_dim
// and house_win_on overlays fit every one.
function buildingBase(k, { roof = "2", shade = "1", wall = "n", door = "b", chimney = true }) {
  if (chimney) { k.box(20, 2, 4, 9, "E"); k.hline(19, 2, 6, "0"); }
  for (let r = 0; r <= 11; r++) {
    k.hline(14 - r, r, 2 + 2 * r, r % 3 === 2 ? shade : roof);
    k.px(14 - r, r, "0"); k.px(15 + r, r, "0");
  }
  k.hline(14, 0, 2, "0");
  k.hline(2, 12, 26, "0");
  k.box(4, 13, 22, 15, wall);
  k.hline(5, 26, 20, "D");
  k.box(13, 19, 5, 9, door);
  k.px(16, 23, "4");
  for (const wx of [6, 19]) { k.box(wx, 16, 6, 6, "F"); k.hline(wx - 1, 22, 8, "C"); }
}
function awning(k, a, b) { for (let x = 5; x <= 24; x++) { k.px(x, 13, x % 2 ? a : b); k.px(x, 14, x % 2 ? a : b); } k.hline(4, 15, 22, "0"); }

const SPRITE_BUILDINGS = {
  bakery: () => pixGrid(30, 28, k => {
    buildingBase(k, { roof: "b", shade: "1", wall: "C", door: "3" });
    awning(k, "2", "C");
    k.hline(12, 5, 6, "4"); k.rect(10, 6, 10, 3, "4"); k.hline(10, 9, 10, "3");   // a loaf on the roof
    for (const x of [12, 15, 18]) { k.px(x, 7, "3"); k.px(x - 1, 8, "3"); }        // score marks on the loaf
    k.px(12, 6, "h"); k.px(13, 6, "h");
  }),
  icecream: () => pixGrid(30, 28, k => {
    buildingBase(k, { roof: "B", shade: "A", wall: "C", door: "p", chimney: false });
    awning(k, "p", "C");
    k.rect(13, 2, 4, 3, "p"); k.hline(14, 1, 2, "p"); k.px(14, 2, "C");              // scoop
    for (let r = 0; r < 5; r++) k.hline(13 + Math.floor(r / 2), 5 + r, 4 - 2 * Math.floor(r / 2), "g"); // cone
  }),
  school: () => pixGrid(30, 28, k => {
    buildingBase(k, { roof: "9", shade: "8", wall: "2", door: "8", chimney: false });
    k.box(11, 0, 8, 6, "n"); k.rect(13, 2, 4, 3, "4"); k.px(14, 4, "b"); k.px(15, 4, "b"); // bell tower
    k.hline(5, 18, 20, "b"); k.hline(5, 24, 8, "b"); k.hline(18, 24, 7, "b");       // brick lines
    k.hline(8, 14, 14, "C");                                                         // sign board
  }),
  hospital: () => pixGrid(30, 28, k => {
    buildingBase(k, { roof: "D", shade: "E", wall: "C", door: "9", chimney: false });
    k.rect(11, 3, 8, 8, "C"); k.rect(14, 4, 2, 6, "2"); k.rect(12, 6, 6, 2, "2");   // red cross
    k.hline(5, 14, 20, "9");                                                         // blue stripe
  }),
  park: () => pixGrid(30, 28, k => {
    for (let r = 0; r <= 11; r++) { k.hline(14 - r, r, 2 + 2 * r, r % 3 === 2 ? "7" : "6"); k.px(14 - r, r, "0"); k.px(15 + r, r, "0"); }
    k.hline(14, 0, 2, "0"); k.hline(2, 12, 26, "0");
    k.rect(4, 13, 2, 14, "b"); k.rect(24, 13, 2, 14, "b");                         // posts
    k.rect(3, 26, 24, 2, "b"); k.hline(6, 23, 18, "b");                              // floor and rail
    for (const wx of [6, 19]) { k.vline(wx + 3, 13, 3, "0"); k.box(wx, 16, 6, 6, "F"); } // hanging lanterns
    k.rect(11, 20, 8, 2, "b");                                                       // bench
  }),
};

// Solar panel, 24 x 22: a tilted blue cell grid on a stand.
const SPRITE_SOLAR = () => pixGrid(24, 22, k => {
  k.rect(10, 13, 2, 8, "E"); k.rect(6, 20, 10, 2, "E");                           // stand
  for (let r = 0; r < 12; r++) { const x0 = 2 + Math.floor(r / 3); k.hline(x0, r + 1, 18, r % 4 === 3 ? "A" : "9"); }
  for (let r = 0; r < 12; r++) { const x0 = 2 + Math.floor(r / 3); for (const c of [6, 12]) k.px(x0 + c, r + 1, "A"); }
  k.px(4, 2, "C"); k.px(5, 2, "C"); k.px(4, 3, "C");                                // glint
  k.outline("0");
});

// Battery, 14 x 24. src/scene/parts.js draws the charge bar inside BAT_INNER.
const BAT_INNER = { x: 3, y: 5, w: 8, h: 16 };
const SPRITE_BAT = () => pixGrid(14, 24, k => {
  k.box(5, 0, 4, 3, "4");                                                          // + terminal
  k.box(1, 2, 12, 22, "F");
  k.rect(BAT_INNER.x, BAT_INNER.y, BAT_INNER.w, BAT_INNER.h, "8");
  k.hline(3, 3, 8, "E");
  k.px(11, 4, "4"); k.px(10, 4, "4"); k.px(12, 4, "4"); k.px(11, 3, "4"); k.px(11, 5, "4"); // little "+"
});

// --- The engineer and clothes ---
// All layers share one 16 x 26 frame, stacked: cape, body, pants, shirt, accessory, hat.
const SPRITE_PERSON = () => pixGrid(16, 26, k => {
  k.rect(5, 5, 6, 7, "s"); k.px(4, 8, "s"); k.px(11, 8, "s");                      // head + ears
  k.rect(5, 4, 6, 2, "k"); k.px(4, 5, "k"); k.px(11, 5, "k"); k.px(5, 6, "k");      // hair
  k.px(6, 8, "0"); k.px(9, 8, "0"); k.hline(7, 10, 2, "2");                         // eyes, smile
  k.rect(7, 12, 2, 1, "s");                                                         // neck
  k.rect(4, 13, 8, 7, "9");                                                         // torso (covered by a shirt)
  k.rect(3, 13, 1, 6, "s"); k.rect(12, 13, 1, 6, "s");                              // arms
  k.rect(5, 20, 6, 4, "8");                                                         // legs (covered by pants)
  k.rect(4, 24, 3, 2, "0"); k.rect(9, 24, 3, 2, "0");                               // shoes
  k.outline("0");
});
function shirtShape(k, main, { sleeves = main, trim = null } = {}) {
  k.rect(4, 13, 8, 7, main); k.rect(3, 13, 1, 3, sleeves); k.rect(12, 13, 1, 3, sleeves);
  if (trim) k.hline(4, 13, 8, trim);
}
function pantsShape(k, c, shorts = false) {
  k.rect(5, 20, 6, shorts ? 2 : 4, c); k.px(7, 22, shorts ? "s" : "0"); k.px(8, 22, shorts ? "s" : "0"); k.px(7, 23, shorts ? "s" : "0"); k.px(8, 23, shorts ? "s" : "0");
  if (shorts) { k.rect(5, 22, 2, 2, "s"); k.rect(9, 22, 2, 2, "s"); }
}
const SPRITE_OUTFIT = {
  shirt_blue:    () => pixGrid(16, 26, k => shirtShape(k, "9")),
  shirt_green:   () => pixGrid(16, 26, k => shirtShape(k, "6")),
  shirt_stripes: () => pixGrid(16, 26, k => { shirtShape(k, "C"); for (const y of [14, 16, 18]) k.hline(4, y, 8, "2"); }),
  shirt_labcoat: () => pixGrid(16, 26, k => { shirtShape(k, "C", { sleeves: "C" }); k.rect(3, 16, 1, 3, "C"); k.rect(12, 16, 1, 3, "C"); k.vline(7, 13, 7, "D"); k.vline(8, 13, 7, "D"); k.px(5, 15, "9"); k.rect(4, 20, 8, 2, "C"); }),
  shirt_hero:    () => pixGrid(16, 26, k => { shirtShape(k, "2"); k.rect(6, 14, 4, 3, "4"); k.px(7, 15, "2"); k.hline(4, 19, 8, "4"); }),
  pants_jeans:   () => pixGrid(16, 26, k => pantsShape(k, "8")),
  pants_shorts:  () => pixGrid(16, 26, k => pantsShape(k, "b", true)),
  pants_overalls:() => pixGrid(16, 26, k => { pantsShape(k, "9"); k.rect(5, 16, 6, 4, "9"); k.vline(5, 13, 3, "9"); k.vline(10, 13, 3, "9"); k.px(5, 16, "4"); k.px(10, 16, "4"); }),
  hat_cap:       () => pixGrid(16, 26, k => { k.rect(5, 2, 6, 3, "2"); k.rect(10, 4, 4, 1, "2"); k.px(7, 1, "2"); k.px(8, 1, "2"); k.px(8, 3, "C"); }),
  hat_beanie:    () => pixGrid(16, 26, k => { k.rect(5, 2, 6, 3, "1"); k.hline(5, 4, 6, "p"); k.rect(7, 0, 2, 2, "4"); }),
  hat_hardhat:   () => pixGrid(16, 26, k => { k.rect(5, 1, 6, 3, "4"); k.hline(4, 4, 8, "4"); k.vline(8, 1, 3, "g"); k.px(6, 2, "h"); }),
  hat_wizard:    () => pixGrid(16, 26, k => { for (let r = 0; r < 5; r++) k.hline(8 - Math.ceil(r / 2), r, 1 + 2 * Math.ceil(r / 2), "9"); k.hline(3, 4, 10, "9"); k.px(8, 2, "4"); k.px(6, 3, "4"); }),
  hat_crown:     () => pixGrid(16, 26, k => { k.rect(5, 2, 6, 3, "4"); k.px(5, 1, "4"); k.px(8, 0, "4"); k.px(7, 1, "4"); k.px(8, 1, "4"); k.px(10, 1, "4"); k.px(6, 3, "2"); k.px(9, 3, "B"); }),
  acc_glasses:   () => pixGrid(16, 26, k => { k.rect(5, 7, 3, 2, "0"); k.rect(8, 7, 3, 2, "0"); k.px(6, 7, "B"); k.px(9, 7, "B"); }),
  acc_bowtie:    () => pixGrid(16, 26, k => { k.rect(6, 12, 1, 2, "2"); k.rect(9, 12, 1, 2, "2"); k.px(7, 12, "2"); k.px(8, 12, "2"); k.px(7, 13, "1"); k.px(8, 13, "1"); }),
  acc_cape:      () => pixGrid(16, 26, k => { k.rect(2, 13, 12, 10, "2"); k.rect(1, 18, 1, 5, "2"); k.rect(14, 18, 1, 5, "2"); k.hline(2, 13, 12, "1"); }),
  shirt_bolt:    () => pixGrid(16, 26, k => { shirtShape(k, "F"); for (const [x, y] of [[8, 14], [7, 15], [8, 15], [6, 16], [7, 16], [8, 16], [9, 16], [8, 17], [7, 18]]) k.px(x, y, "4"); }),
  shirt_hoodie:  () => pixGrid(16, 26, k => { shirtShape(k, "E", { sleeves: "E" }); k.rect(3, 16, 1, 3, "E"); k.rect(12, 16, 1, 3, "E"); k.rect(5, 11, 6, 2, "E"); k.px(7, 14, "C"); k.px(8, 14, "C"); k.px(7, 15, "C"); k.px(8, 15, "C"); k.hline(5, 18, 6, "F"); }),
  pants_red:     () => pixGrid(16, 26, k => pantsShape(k, "2")),
  acc_scarf:     () => pixGrid(16, 26, k => { k.rect(5, 12, 6, 2, "2"); k.rect(9, 13, 2, 4, "2"); k.px(6, 12, "C"); k.px(8, 12, "C"); k.px(10, 12, "C"); k.px(9, 15, "C"); }),
  acc_headphones:() => pixGrid(16, 26, k => { k.hline(5, 3, 6, "0"); k.px(4, 4, "0"); k.px(11, 4, "0"); k.rect(3, 6, 2, 3, "2"); k.rect(11, 6, 2, 3, "2"); k.px(3, 5, "0"); k.px(12, 5, "0"); }),
  hat_propeller: () => pixGrid(16, 26, k => { k.rect(5, 2, 6, 3, "2"); k.rect(7, 2, 2, 3, "4"); k.px(9, 2, "9"); k.px(10, 3, "9"); k.vline(8, 0, 2, "0"); k.hline(4, 0, 9, "E"); k.px(4, 0, "D"); k.px(12, 0, "D"); }),
};

// --- Icons and decorations ---
const SPRITE_COIN = () => pixGrid(8, 8, k => { k.rect(2, 0, 4, 8, "4"); k.rect(1, 1, 6, 6, "4"); k.rect(0, 2, 8, 4, "4"); k.rect(3, 2, 2, 4, "g"); k.px(2, 1, "h"); k.outline("0"); });
const SPRITE_STAR = () => pixGrid(9, 9, k => { k.vline(4, 0, 9, "4"); k.hline(0, 3, 9, "4"); k.rect(2, 2, 5, 5, "4"); k.px(2, 7, "4"); k.px(6, 7, "4"); k.px(1, 8, "4"); k.px(7, 8, "4"); k.px(4, 3, "h"); });
const SPRITE_CHEST = (open) => pixGrid(18, 14, k => {
  k.box(1, 6, 16, 8, "b"); k.hline(2, 9, 14, "1");
  if (open) { k.box(1, 0, 16, 5, "b"); k.rect(3, 5, 12, 2, "4"); k.px(5, 4, "h"); k.px(11, 4, "h"); }
  else { k.box(1, 2, 16, 5, "b"); }
  k.rect(7, open ? 7 : 5, 4, 3, "4"); k.px(8, open ? 8 : 6, "0");
  k.vline(4, open ? 6 : 2, open ? 8 : 12, "g"); k.vline(13, open ? 6 : 2, open ? 8 : 12, "g");
});
const SPRITE_LOCK = () => pixGrid(7, 8, k => { k.box(1, 0, 5, 4, "."); k.rect(2, 1, 3, 2, "."); k.box(0, 3, 7, 5, "4"); k.px(3, 5, "0"); k.px(3, 6, "0"); k.box(1, 0, 5, 4, "."); k.hline(2, 0, 3, "0"); k.px(1, 1, "0"); k.px(5, 1, "0"); k.px(1, 2, "0"); k.px(5, 2, "0"); });
const SPRITE_SPARKY = () => pixGrid(16, 16, k => {
  k.vline(8, 0, 3, "E"); k.rect(7, 0, 3, 2, "4");                                  // antenna
  k.box(2, 3, 13, 10, "D"); k.box(4, 5, 9, 5, "8");                                 // head, screen
  k.rect(5, 6, 2, 2, "B"); k.rect(10, 6, 2, 2, "B"); k.hline(6, 9, 5, "B");         // eyes, smile
  k.rect(0, 6, 2, 3, "E"); k.rect(15, 6, 1, 3, "E");                                 // ears
  k.box(5, 13, 7, 3, "E");                                                          // neck
});
const SPRITE_WEATHER = {
  sunny: () => pixGrid(12, 12, k => { k.rect(3, 3, 6, 6, "4"); k.rect(2, 4, 8, 4, "4"); k.rect(4, 2, 4, 8, "4"); for (const [x, y] of [[5, 0], [6, 0], [0, 5], [0, 6], [11, 5], [11, 6], [5, 11], [6, 11], [1, 1], [10, 1], [1, 10], [10, 10]]) k.px(x, y, "3"); k.px(4, 4, "h"); }),
  normal: () => pixGrid(12, 12, k => { k.rect(5, 1, 5, 5, "4"); k.rect(4, 2, 7, 3, "4"); k.rect(1, 6, 9, 4, "C"); k.rect(3, 5, 4, 2, "C"); k.hline(2, 10, 8, "D"); k.outline("E"); }),
  cloudy: () => pixGrid(12, 12, k => { k.rect(1, 5, 10, 4, "C"); k.rect(3, 3, 5, 3, "C"); k.rect(7, 4, 3, 2, "C"); k.hline(2, 9, 8, "D"); k.outline("E"); }),
  heat: () => pixGrid(12, 12, k => { k.rect(3, 1, 6, 6, "3"); k.rect(2, 2, 8, 4, "3"); k.px(4, 2, "4"); for (let x = 1; x < 11; x++) { k.px(x, 8 + (x % 2), "2"); k.px(x, 10 + (x % 2), "2"); } }),
  storm: () => pixGrid(12, 12, k => { k.rect(1, 2, 10, 4, "E"); k.rect(3, 0, 5, 3, "E"); k.hline(2, 6, 8, "F"); k.px(6, 7, "4"); k.px(5, 8, "4"); k.px(6, 8, "4"); k.px(7, 9, "4"); k.px(6, 10, "4"); k.px(2, 8, "A"); k.px(9, 9, "A"); k.px(3, 10, "A"); }),
};
const SPRITE_MOON = () => pixGrid(10, 10, k => { k.rect(2, 0, 6, 10, "4"); k.rect(0, 2, 10, 6, "4"); k.rect(1, 1, 8, 8, "4"); k.rect(5, 0, 5, 7, "."); k.rect(6, 7, 3, 1, "."); k.px(3, 3, "g"); k.px(2, 6, "g"); });
const SPRITE_DECOR = {
  flowers: SPRITE_FLOWERS,
  bench: () => pixGrid(16, 9, k => { k.rect(1, 2, 14, 2, "b"); k.rect(1, 5, 14, 2, "b"); k.rect(2, 7, 1, 2, "0"); k.rect(13, 7, 1, 2, "0"); k.rect(2, 0, 1, 2, "0"); k.rect(13, 0, 1, 2, "0"); k.outline("0"); }),
  lamp: () => pixGrid(7, 20, k => { k.rect(3, 4, 1, 15, "F"); k.rect(1, 19, 5, 1, "F"); k.box(1, 0, 5, 5, "4"); k.px(3, 2, "h"); }),
  fountain: () => pixGrid(20, 14, k => { k.box(1, 8, 18, 6, "D"); k.rect(2, 9, 16, 3, "A"); k.rect(9, 3, 2, 6, "D"); k.rect(7, 1, 6, 2, "B"); for (const x of [6, 13]) { k.px(x, 3, "B"); k.px(x, 5, "B"); k.px(x, 7, "B"); } k.px(4, 10, "C"); k.px(14, 10, "C"); }),
  pond: () => pixGrid(24, 12, k => { k.rect(3, 2, 18, 9, "A"); k.rect(1, 4, 22, 5, "A"); k.hline(4, 6, 5, "B"); k.hline(14, 8, 4, "B"); k.rect(15, 2, 3, 2, "4"); k.px(17, 1, "4"); k.px(18, 1, "3"); k.outline("0"); }),
  statue: () => pixGrid(12, 20, k => { k.box(1, 15, 10, 5, "E"); k.rect(4, 2, 4, 4, "D"); k.rect(3, 6, 6, 6, "D"); k.rect(4, 12, 1, 3, "D"); k.rect(7, 12, 1, 3, "D"); k.rect(9, 3, 1, 4, "D"); k.px(9, 2, "4"); k.outline("0"); }),
};

// --- Sidekick pets ---
// A dog or a robot, 18 x 16, in several colours, plus hats and extras.
const DOG_COLORS = { dog_brown: ["b", "1"], dog_golden: ["4", "g"], dog_black: ["F", "0"], dog_spotty: ["C", "F"] };
const ROBOT_COLORS = { robot_silver: ["D", "E"], robot_red: ["2", "1"], robot_green: ["6", "7"], robot_gold: ["4", "g"] };
const SPRITE_DOG = (key) => pixGrid(18, 16, k => {
  const [c, d] = DOG_COLORS[key];
  k.px(1, 6, c); k.px(1, 7, c); k.px(2, 8, c);                                    // tail
  k.rect(3, 9, 9, 4, c); k.rect(3, 12, 3, 3, c); k.rect(9, 12, 2, 3, c); k.rect(11, 11, 1, 4, c); // body, legs
  k.rect(10, 4, 6, 6, c); k.rect(15, 6, 3, 3, c);                                 // head, snout
  k.rect(10, 3, 2, 5, d);                                                          // ear
  k.px(17, 6, "0"); k.px(13, 5, key === "dog_black" ? "C" : "0"); k.hline(15, 8, 2, d); // nose, eye, mouth
  if (key === "dog_spotty") { k.rect(5, 10, 2, 2, "F"); k.px(9, 9, "F"); k.px(14, 4, "F"); }
  k.outline("0");
});
const SPRITE_ROBOT = (key) => pixGrid(18, 16, k => {
  const [c, d] = ROBOT_COLORS[key];
  k.vline(9, 1, 2, "E"); k.px(9, 0, "4");                                         // antenna
  k.rect(3, 3, 12, 6, c); k.rect(5, 4, 8, 4, "0"); k.rect(6, 5, 6, 2, "8");         // head, screen
  k.px(7, 5, "B"); k.px(10, 5, "B"); k.hline(7, 6, 4, "B");                        // eyes, smile
  k.px(2, 5, d); k.px(2, 6, d); k.px(15, 5, d); k.px(15, 6, d);                    // ears
  k.rect(5, 9, 8, 4, d); k.rect(6, 9, 6, 1, c); k.px(8, 11, "4"); k.px(9, 11, "4"); // body + light
  k.rect(5, 13, 3, 2, "0"); k.rect(10, 13, 3, 2, "0");                             // wheels
  k.outline("0");
});
// Where hats and extras sit on each sidekick.
const PET_ANCHOR = { dog: { hx: 13, hy: 3, nx: 11, ny: 9, ex: 13, ey: 5 }, robot: { hx: 9, hy: 3, nx: 9, ny: 9, ex: 7, ey: 6 } };
const PET_HAT_DRAW = {
  phat_cap:    (k, x, y) => { k.rect(x - 2, y - 2, 4, 2, "2"); k.hline(x + 1, y - 1, 3, "2"); k.px(x - 1, y - 3, "2"); },
  phat_party:  (k, x, y) => { k.hline(x - 2, y - 1, 5, "p"); k.hline(x - 1, y - 2, 3, "4"); k.px(x, y - 3, "p"); },
  phat_wizard: (k, x, y) => { k.hline(x - 3, y - 1, 7, "9"); k.hline(x - 1, y - 2, 3, "9"); k.px(x, y - 3, "9"); k.px(x, y - 2, "4"); },
  phat_crown:  (k, x, y) => { k.hline(x - 2, y - 1, 5, "4"); k.px(x - 2, y - 2, "4"); k.px(x, y - 2, "4"); k.px(x + 2, y - 2, "4"); k.px(x, y - 1, "2"); },
};
const PET_ACC_DRAW = {
  pacc_bandana: (k, a) => { k.hline(a.nx - 2, a.ny, 5, "2"); k.hline(a.nx - 1, a.ny + 1, 3, "2"); k.px(a.nx, a.ny + 2, "2"); k.px(a.nx - 1, a.ny, "C"); },
  pacc_bowtie:  (k, a) => { k.px(a.nx - 2, a.ny, "9"); k.px(a.nx - 2, a.ny + 1, "9"); k.px(a.nx + 2, a.ny, "9"); k.px(a.nx + 2, a.ny + 1, "9"); k.px(a.nx - 1, a.ny, "9"); k.px(a.nx + 1, a.ny + 1, "9"); k.px(a.nx, a.ny, "A"); k.px(a.nx, a.ny + 1, "A"); },
  pacc_goggles: (k, a) => { k.rect(a.ex - 1, a.ey - 1, 3, 2, "0"); k.px(a.ex, a.ey - 1, "B"); k.rect(a.ex + 2, a.ey - 1, 2, 2, "0"); k.px(a.ex + 2, a.ey - 1, "B"); },
  pacc_cape:    (k, a, type) => { if (type === "dog") { k.rect(3, 7, 7, 4, "2"); k.px(2, 9, "2"); k.hline(8, 7, 3, "1"); } else { k.rect(3, 8, 12, 5, "2"); k.hline(4, 8, 10, "1"); } },
};
function petItemSprite(key, type) {
  const a = PET_ANCHOR[type];
  return pixGrid(18, 16, k => {
    if (PET_HAT_DRAW[key]) PET_HAT_DRAW[key](k, a.hx, a.hy);
    else PET_ACC_DRAW[key](k, a, type);
  });
}

// --- Captain Short Circuit (22 x 30) ---
const SPRITE_CAPTAIN = () => pixGrid(22, 30, k => {
  k.rect(3, 12, 16, 15, "1"); k.rect(2, 20, 1, 7, "1"); k.rect(19, 20, 1, 7, "1");    // cape
  for (const [x, y] of [[6, 0], [5, 1], [9, 0], [10, 1], [13, 0], [14, 1], [16, 1], [7, 2], [11, 2], [15, 2]]) k.px(x, y, "4"); // crackling hair
  k.rect(6, 2, 10, 3, "4");
  k.rect(6, 4, 10, 8, "s");                                                          // face
  k.rect(6, 6, 10, 3, "0"); k.px(8, 7, "C"); k.px(13, 7, "C"); k.px(9, 7, "2"); k.px(14, 7, "2"); // mask + eyes
  k.hline(9, 10, 4, "0"); k.px(8, 9, "0"); k.px(13, 9, "0");                        // grin
  k.rect(6, 12, 10, 9, "8");                                                         // suit
  for (const [x, y] of [[11, 13], [10, 14], [11, 14], [9, 15], [10, 15], [11, 15], [12, 15], [11, 16], [10, 17]]) k.px(x, y, "4"); // bolt emblem
  k.rect(4, 13, 2, 6, "8"); k.rect(16, 13, 2, 6, "8"); k.rect(4, 19, 2, 2, "2"); k.rect(16, 19, 2, 2, "2"); // arms, gloves
  k.rect(7, 21, 3, 6, "F"); k.rect(12, 21, 3, 6, "F"); k.rect(6, 27, 4, 2, "0"); k.rect(12, 27, 4, 2, "0"); // legs, boots
  k.outline("0");
});
const SPRITE_ZAP = () => pixGrid(9, 13, k => {
  for (const [x0, y, len] of [[5, 0, 3], [4, 1, 3], [3, 2, 3], [2, 3, 3], [1, 4, 6], [3, 5, 3], [3, 6, 2], [2, 7, 2], [2, 8, 2], [1, 9, 2], [1, 10, 1], [0, 11, 1]]) k.hline(x0, y, len, "4");
  k.outline("0");
});

// --- World map, region ground tiles and region scenery ---
const SPRITE_ISLAND = (land, shade, extra) => pixGrid(44, 28, k => {
  for (let y = 0; y < 28; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 13.5) / 13.5) ** 2)) * 21);
    if (half > 0) k.hline(22 - half, y, 2 * half, y > 20 ? shade : land);
  }
  if (extra) extra(k);
  k.outline("0");
});
const ISLANDS = {
  sparkville: () => SPRITE_ISLAND("6", "7", k => { for (const [x, y] of [[10, 8], [30, 6], [24, 16]]) { k.px(x, y, "5"); k.px(x + 1, y, "5"); } }),
  batterybay: () => SPRITE_ISLAND("n", "4", k => { k.rect(14, 10, 14, 7, "A"); k.hline(16, 12, 5, "B"); }),
  solardesert: () => SPRITE_ISLAND("4", "3", k => { for (const [x, y] of [[9, 9], [28, 12], [20, 5]]) { k.vline(x, y, 4, "6"); k.px(x - 1, y + 1, "6"); k.px(x + 1, y + 2, "6"); } }),
  mountains: () => SPRITE_ISLAND("E", "F", k => { for (let r = 0; r < 9; r++) k.hline(21 - r, 2 + r, 2 * r + 2, r < 3 ? "C" : "D"); }),
};
const SPRITE_PIN = () => pixGrid(7, 10, k => { k.rect(1, 0, 5, 5, "2"); k.rect(0, 1, 7, 3, "2"); k.rect(2, 5, 3, 2, "2"); k.px(3, 7, "2"); k.px(2, 1, "C"); k.outline("0"); });
const SPRITE_BADGE = () => pixGrid(20, 20, k => {
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const d = Math.hypot(x - 9.5, y - 9.5);
    if (d < 9.6) k.px(x, y, d > 7.8 ? "0" : d > 6.6 ? "C" : "D");
  }
});

const SPRITE_GROUND = {
  sand: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "n"); for (const [x, y] of [[2, 3], [9, 1], [13, 7], [5, 10], [11, 13], [1, 14]]) k.px(x, y, "4"); for (const [x, y] of [[6, 5], [14, 2], [3, 11], [12, 10], [8, 15]]) k.px(x, y, "D"); }),
  dune: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "4"); for (const [x, y] of [[1, 4], [2, 4], [3, 3], [9, 9], [10, 9], [11, 8], [5, 13], [6, 13]]) k.px(x, y, "g"); for (const [x, y] of [[13, 2], [7, 6], [2, 11], [14, 12]]) k.px(x, y, "3"); }),
  rocky: () => pixGrid(16, 16, k => { k.rect(0, 0, 16, 16, "7"); for (const [x, y] of [[2, 3], [9, 1], [13, 6], [5, 9], [11, 12]]) { k.px(x, y, "6"); k.px(x + 1, y - 1, "6"); } for (const [x, y] of [[6, 5], [14, 2], [3, 12], [10, 15]]) { k.px(x, y, "E"); k.px(x + 1, y, "D"); } k.px(12, 9, "C"); k.px(1, 7, "C"); }),
};
const SPRITE_SCENERY = {
  palm: () => pixGrid(18, 26, k => {
    for (let y = 9; y < 26; y++) k.rect(8 + Math.round((y - 9) / 7), y, 2, 1, y % 3 ? "b" : "1");
    for (const [dx, dy] of [[-1, 0], [1, 0]]) for (let i = 0; i < 8; i++) { k.px(9 + dx * i, 6 + Math.round(i * i / 12) + dy, "6"); k.px(9 + dx * i, 5 + Math.round(i * i / 12), i % 2 ? "5" : "6"); }
    k.rect(7, 3, 4, 4, "6"); k.px(8, 3, "5"); k.rect(8, 8, 2, 2, "b");
    k.outline("0");
  }),
  lighthouse: () => pixGrid(12, 30, k => {
    k.rect(3, 0, 6, 2, "2"); k.rect(3, 2, 6, 3, "4"); k.px(5, 3, "h"); k.hline(2, 5, 8, "0");
    for (let y = 6; y < 28; y++) { const w = 6 + Math.floor((y - 6) / 7) * 2; k.hline(6 - w / 2, y, w, Math.floor((y - 6) / 4) % 2 ? "2" : "C"); }
    k.rect(5, 23, 2, 5, "b"); k.hline(0, 28, 12, "D"); k.hline(0, 29, 12, "E");
    k.outline("0");
  }),
  boat: () => pixGrid(20, 12, k => { k.vline(9, 0, 7, "b"); for (let r = 0; r < 6; r++) k.hline(10, r + 1, 6 - r, "C"); for (let r = 0; r < 4; r++) k.hline(1 + r, 7 + r, 18 - 2 * r, r ? "2" : "C"); k.outline("0"); }),
  cactus: () => pixGrid(12, 20, k => { k.rect(5, 2, 3, 17, "6"); k.rect(1, 7, 2, 6, "6"); k.rect(1, 12, 4, 2, "6"); k.rect(10, 4, 2, 6, "6"); k.rect(8, 9, 3, 2, "6"); k.vline(6, 3, 15, "5"); k.px(6, 1, "p"); k.outline("0"); }),
  boulder: () => pixGrid(14, 9, k => { k.rect(2, 1, 10, 7, "E"); k.rect(1, 3, 12, 5, "E"); k.hline(3, 2, 6, "D"); k.px(4, 3, "C"); k.hline(1, 8, 12, "F"); k.outline("0"); }),
  snowpine: () => pixGrid(14, 24, k => {
    k.rect(6, 18, 2, 5, "b");
    for (const [top, height, maxHalf] of [[1, 6, 3], [5, 7, 5], [10, 8, 6]]) {
      for (let i = 0; i < height; i++) { const half = 1 + Math.round((i * (maxHalf - 1)) / (height - 1)); k.hline(7 - half, top + i, 2 * half, i < 2 ? "C" : i < height - 2 ? "7" : "F"); }
    }
    k.outline("0");
  }),
  peak: () => pixGrid(44, 22, k => { for (let r = 0; r < 22; r++) { const half = Math.round(r * 1.0) + 1; k.hline(22 - half, r, 2 * half, r < 6 ? "C" : r % 5 === 0 ? "D" : "E"); } k.outline("0"); }),
};

function makeGameTextures(scene) {
  for (const [key, fn] of Object.entries(SPRITE_BUILDINGS)) makeTex(scene, "bld_" + key, fn());
  makeTex(scene, "solar", SPRITE_SOLAR());
  makeTex(scene, "battery", SPRITE_BAT());
  makeTex(scene, "person", SPRITE_PERSON());
  for (const [key, fn] of Object.entries(SPRITE_OUTFIT)) makeTex(scene, "fit_" + key, fn());
  makeTex(scene, "coin", SPRITE_COIN(), 2);
  makeTex(scene, "star", SPRITE_STAR(), 2);
  makeTex(scene, "chest", SPRITE_CHEST(false));
  makeTex(scene, "chest_open", SPRITE_CHEST(true));
  makeTex(scene, "lock", SPRITE_LOCK(), 2);
  makeTex(scene, "sparky", SPRITE_SPARKY());
  makeTex(scene, "moon", SPRITE_MOON(), 2);
  for (const [key, fn] of Object.entries(SPRITE_WEATHER)) makeTex(scene, "wx_" + key, fn(), 2);
  for (const [key, fn] of Object.entries(SPRITE_DECOR)) makeTex(scene, "decor_" + key, fn());
  for (const key of Object.keys(DOG_COLORS)) makeTex(scene, "pet_" + key, SPRITE_DOG(key));
  for (const key of Object.keys(ROBOT_COLORS)) makeTex(scene, "pet_" + key, SPRITE_ROBOT(key));
  for (const key of [...Object.keys(PET_HAT_DRAW), ...Object.keys(PET_ACC_DRAW)]) for (const type of ["dog", "robot"]) makeTex(scene, `pet_${key}_${type}`, petItemSprite(key, type));
  makeTex(scene, "captain", SPRITE_CAPTAIN());
  makeTex(scene, "zap", SPRITE_ZAP());
  for (const [key, fn] of Object.entries(ISLANDS)) makeTex(scene, "island_" + key, fn());
  makeTex(scene, "map_pin", SPRITE_PIN());
  makeTex(scene, "badge", SPRITE_BADGE());
  for (const [key, fn] of Object.entries(SPRITE_GROUND)) makeTex(scene, key, fn());
  for (const [key, fn] of Object.entries(SPRITE_SCENERY)) makeTex(scene, "scn_" + key, fn());
}

// Texture key for a building type. "house" and unknown keys use the cottage.

function buildingTexture(key) {
  return key && key !== "house" && SPRITE_BUILDINGS[key] ? "bld_" + key : "house";
}
