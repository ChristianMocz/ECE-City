// src/art/shopart.js
//
// More shop items: six buildings, decorations that light up when powered
// (wired just like buildings), plain decorations, more clothes and a few UI
// icons. Loads after src/art/gameart.js and adds its sprites to the tables
// there. Buildings that don't use the cottage's two windows bring their own
// overlays, "bld_<key>_lit" and "bld_<key>_dim", on the same 30 x 28 frame.
//
// Main pieces: MORE_BUILDINGS, MORE_POWERED, MORE_DECOR, MORE_OUTFITS,
// UI_ICONS, makeMoreTextures().
// Used by: src/scene/setup.js (makes the textures).

// Window rectangles: glass on the building, light on the overlays.
function windowsOn(k, wins, glass) { for (const [x, y, w, h] of wins) k.rect(x, y, w, h, glass); }
function litWindows(wins, { on = "4", hi = "h" } = {}) {
  return {
    lit: () => pixGrid(30, 28, k => { for (const [x, y, w, h] of wins) { k.rect(x, y, w, h, on); k.px(x, y, hi); } }),
    dim: () => pixGrid(30, 28, k => { for (const [x, y, w, h] of wins) k.rect(x, y, w, h, "3"); }),
  };
}

const HOTEL_WINS = [];
for (const y of [9, 13, 17]) for (const x of [6, 11, 17, 22]) HOTEL_WINS.push([x, y, 3, 2]);
const ARCADE_WINS = [[5, 12, 8, 6], [17, 12, 8, 6]];
const FIRE_WINS = [[20, 13, 5, 3], [22, 3, 2, 3]];

const MORE_BUILDINGS = {
  hotel: () => pixGrid(30, 28, k => {
    k.box(3, 3, 24, 25, "9");
    k.rect(4, 4, 22, 3, "2"); for (let x = 6; x <= 24; x += 3) k.px(x, 5, "4");     // sign band
    windowsOn(k, HOTEL_WINS, "F");
    k.hline(11, 21, 8, "2"); k.box(12, 22, 6, 6, "b"); k.px(16, 25, "4");          // awning and door
    k.hline(4, 26, 22, "8");
  }),
  library: () => pixGrid(30, 28, k => {
    buildingBase(k, { roof: "D", shade: "E", wall: "n", door: "b", chimney: false });
    k.rect(11, 6, 8, 4, "2"); k.vline(15, 6, 4, "4");                                // a red book on the gable
    for (const x of [4, 12, 18, 25]) k.vline(x, 13, 13, "C");                         // columns
  }),
  cinema: () => pixGrid(30, 28, k => {
    k.box(11, 0, 8, 8, "2"); for (const y of [2, 4, 6]) k.hline(13, y, 4, "4");      // sign tower
    k.box(2, 7, 26, 21, "1");
    k.rect(3, 12, 24, 4, "4"); for (let x = 4; x < 27; x += 2) { k.px(x, 12, "2"); k.px(x, 15, "2"); } // marquee
    k.rect(4, 18, 5, 6, "B"); k.rect(21, 18, 5, 6, "p");                              // posters
    k.box(11, 19, 8, 9, "8"); k.vline(15, 20, 8, "0");                                // double door
  }),
  firestation: () => pixGrid(30, 28, k => {
    k.box(19, 1, 7, 10, "2"); k.rect(20, 1, 5, 1, "F"); windowsOn(k, [FIRE_WINS[1]], "F");   // tower
    k.box(3, 9, 24, 19, "2"); k.rect(2, 8, 26, 2, "F");
    k.box(5, 15, 12, 13, "D"); for (const y of [18, 21, 24]) k.hline(6, y, 10, "E");    // garage door
    windowsOn(k, [FIRE_WINS[0]], "F");
    k.box(20, 20, 5, 8, "b"); k.px(23, 24, "4");
    k.rect(6, 11, 10, 2, "C");                                                         // sign
  }),
  arcade: () => pixGrid(30, 28, k => {
    k.box(5, 0, 20, 6, "1"); for (let x = 7; x < 23; x += 2) k.px(x, 2 + (x % 4 ? 0 : 1), "p");  // sign
    k.box(2, 5, 26, 23, "8");
    windowsOn(k, ARCADE_WINS, "F");
    k.box(12, 20, 6, 8, "F"); k.px(16, 24, "B");
    k.hline(3, 9, 24, "v");
  }),
  stadium: () => pixGrid(30, 28, k => {
    for (const x of [2, 26]) { k.rect(x + 1, 3, 1, 14, "E"); k.box(x, 0, 3, 4, "F"); }    // floodlight masts
    k.rect(1, 14, 28, 14, "D"); k.rect(3, 12, 24, 2, "E");                                // stands
    for (let y = 16; y < 26; y += 3) k.hline(2, y, 26, "E");
    k.rect(6, 18, 18, 8, "6"); k.hline(6, 22, 18, "C"); k.vline(15, 18, 8, "C");         // the pitch
    k.box(13, 23, 4, 5, "b");
  }),
};
const MORE_BUILDING_LIGHTS = {
  hotel: litWindows(HOTEL_WINS),
  arcade: litWindows(ARCADE_WINS, { on: "B", hi: "p" }),
  firestation: litWindows(FIRE_WINS),
  cinema: {
    lit: () => pixGrid(30, 28, k => { for (let x = 4; x < 27; x += 2) { k.px(x, 12, "h"); k.px(x, 15, "h"); } for (const y of [2, 4, 6]) k.hline(13, y, 4, "h"); }),
    dim: () => pixGrid(30, 28, k => { for (let x = 4; x < 27; x += 4) { k.px(x, 12, "3"); k.px(x, 15, "3"); } }),
  },
  stadium: {
    lit: () => pixGrid(30, 28, k => { for (const x of [2, 26]) { k.rect(x + 1, 1, 1, 2, "h"); k.px(x, 1, "4"); k.px(x + 2, 1, "4"); } k.rect(6, 18, 18, 1, "5"); }),
    dim: () => pixGrid(30, 28, k => { for (const x of [2, 26]) k.rect(x + 1, 1, 1, 2, "3"); }),
  },
};

// Decorations that light up. They're wired like buildings.
const MORE_POWERED = {
  streetlight: () => pixGrid(30, 28, k => {
    k.rect(14, 6, 2, 20, "F"); k.rect(11, 26, 8, 2, "F");
    k.box(11, 1, 8, 6, "E"); k.rect(12, 4, 6, 2, "F");
  }),
  litfountain: () => pixGrid(30, 28, k => {
    k.box(3, 19, 24, 9, "D"); k.rect(4, 20, 22, 4, "A");
    k.rect(14, 10, 2, 10, "D"); k.box(10, 8, 10, 3, "D");
    for (const [x, y] of [[8, 14], [21, 14], [11, 4], [18, 4], [15, 2]]) k.px(x, y, "B");
  }),
  xmastree: () => pixGrid(30, 28, k => {
    for (let r = 0; r < 20; r++) { const half = Math.floor(r / 2) + 1; k.hline(15 - half, 3 + r, half * 2, r % 5 === 4 ? "7" : "6"); }
    k.rect(13, 23, 4, 5, "b"); k.px(15, 1, "g"); k.px(14, 2, "g"); k.px(15, 2, "g"); k.px(16, 2, "g");
    k.outline("0");
  }),
  billboard: () => pixGrid(30, 28, k => {
    k.rect(7, 16, 2, 12, "F"); k.rect(21, 16, 2, 12, "F");
    k.box(2, 2, 26, 15, "C");
    k.rect(4, 4, 8, 11, "A"); k.rect(6, 6, 4, 4, "4");                                 // a sun picture
    for (const y of [6, 9, 12]) k.hline(14, y, 11, "E");                               // lines of text
  }),
  ferriswheel: () => pixGrid(30, 28, k => {
    for (let a = 0; a < 48; a++) { const t = (a / 48) * Math.PI * 2; k.px(Math.round(15 + Math.cos(t) * 11), Math.round(12 + Math.sin(t) * 11), "E"); }
    for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; for (let r = 1; r < 11; r++) k.px(Math.round(15 + Math.cos(t) * r), Math.round(12 + Math.sin(t) * r), "D"); }
    for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2 + 0.2; k.box(Math.round(14 + Math.cos(t) * 11), Math.round(12 + Math.sin(t) * 11), 3, 3, ["2", "9", "4", "6"][a % 4]); }
    k.rect(14, 11, 3, 3, "F");
    for (let y = 13; y < 28; y++) { k.px(15 - Math.floor((y - 12) / 2), y, "F"); k.px(15 + Math.floor((y - 12) / 2), y, "F"); }
  }),
};
const MORE_POWERED_LIGHTS = {
  streetlight: { lit: () => pixGrid(30, 28, k => { k.rect(12, 4, 6, 2, "4"); k.px(12, 4, "h"); k.px(13, 4, "h"); }), dim: () => pixGrid(30, 28, k => k.rect(12, 4, 6, 2, "3")) },
  litfountain: { lit: () => pixGrid(30, 28, k => { k.rect(4, 20, 22, 2, "B"); for (const [x, y, c] of [[8, 14, "p"], [21, 14, "4"], [11, 4, "B"], [18, 4, "p"], [15, 2, "h"], [6, 21, "4"], [24, 21, "p"]]) k.px(x, y, c); }), dim: () => pixGrid(30, 28, k => k.rect(4, 20, 22, 1, "7")) },
  xmastree: { lit: () => pixGrid(30, 28, k => { const c = ["4", "2", "B", "p"]; let i = 0; for (let r = 3; r < 21; r += 3) { const half = Math.floor((r - 3) / 2) + 1; for (let x = 15 - half + 1; x < 15 + half; x += 3) k.px(x, r + 1, c[i++ % 4]); } k.px(15, 1, "h"); }), dim: () => pixGrid(30, 28, k => { for (let r = 6; r < 21; r += 6) k.px(15, r, "3"); }) },
  billboard: { lit: () => pixGrid(30, 28, k => { for (let x = 3; x < 28; x += 2) { k.px(x, 2, "4"); k.px(x, 16, "4"); } for (let y = 4; y < 16; y += 2) { k.px(2, y, "4"); k.px(27, y, "4"); } k.rect(6, 6, 4, 4, "h"); }), dim: () => pixGrid(30, 28, k => { for (let x = 3; x < 28; x += 4) k.px(x, 2, "3"); }) },
  ferriswheel: { lit: () => pixGrid(30, 28, k => { for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; k.px(Math.round(15 + Math.cos(t) * 11), Math.round(12 + Math.sin(t) * 11), ["4", "p", "B"][a % 3]); } k.rect(14, 11, 3, 3, "4"); }), dim: () => pixGrid(30, 28, k => { for (let a = 0; a < 12; a++) { const t = (a / 12) * Math.PI * 2; k.px(Math.round(15 + Math.cos(t) * 11), Math.round(12 + Math.sin(t) * 11), "3"); } }) },
};

// Plain decorations (just for looks).
const MORE_DECOR = {
  hedge: () => pixGrid(20, 8, k => { k.rect(1, 1, 18, 7, "6"); for (let x = 2; x < 19; x += 3) { k.px(x, 0, "6"); k.px(x + 1, 3, "7"); } k.hline(1, 7, 18, "7"); k.outline("0"); }),
  mailbox: () => pixGrid(8, 14, k => { k.rect(3, 6, 2, 8, "F"); k.box(0, 0, 8, 7, "9"); k.rect(6, 1, 1, 3, "2"); k.hline(1, 3, 5, "8"); }),
  picnic: () => pixGrid(20, 10, k => { k.rect(1, 2, 18, 2, "b"); k.rect(0, 6, 20, 1, "b"); k.rect(3, 4, 1, 6, "b"); k.rect(16, 4, 1, 6, "b"); for (let x = 2; x < 18; x += 2) k.px(x, 2, "2"); k.outline("0"); }),
  flagpole: () => pixGrid(12, 24, k => { k.rect(1, 0, 1, 24, "E"); k.rect(0, 22, 4, 2, "F"); k.rect(2, 1, 9, 6, "9"); k.rect(5, 2, 3, 4, "4"); k.px(6, 3, "C"); }),
  slide: () => pixGrid(22, 16, k => { k.rect(2, 3, 1, 13, "E"); k.rect(6, 3, 1, 13, "E"); for (let y = 5; y < 16; y += 3) k.hline(2, y, 5, "E"); k.rect(2, 2, 5, 2, "2"); for (let i = 0; i < 14; i++) k.rect(7 + i, 3 + Math.floor(i * 0.85), 1, 2, "4"); k.outline("0"); }),
  gazebo: () => pixGrid(24, 22, k => { for (let r = 0; r < 7; r++) k.hline(Math.round(11 - r * 1.5), r, 2 + r * 3, r % 2 ? "2" : "C"); k.rect(1, 7, 22, 2, "2"); for (const x of [2, 8, 15, 21]) k.rect(x, 9, 1, 11, "C"); k.rect(0, 20, 24, 2, "b"); k.hline(2, 15, 20, "C"); k.outline("0"); }),
};

// More clothes.
const MORE_OUTFITS = {
  hat_cowboy:  () => pixGrid(16, 26, k => { k.rect(5, 1, 6, 3, "b"); k.hline(2, 4, 12, "b"); k.px(2, 3, "b"); k.px(13, 3, "b"); k.hline(5, 3, 6, "k"); }),
  hat_chef:    () => pixGrid(16, 26, k => { k.rect(5, 2, 6, 3, "C"); k.rect(4, 0, 8, 3, "C"); k.px(4, 0, "D"); k.px(11, 0, "D"); k.hline(5, 4, 6, "D"); }),
  hat_party:   () => pixGrid(16, 26, k => { for (let r = 0; r < 5; r++) k.hline(8 - Math.ceil(r / 2), r, 1 + 2 * Math.ceil(r / 2), r % 2 ? "p" : "B"); k.px(8, 0, "4"); }),
  hat_pirate:  () => pixGrid(16, 26, k => { k.rect(4, 2, 8, 3, "0"); k.hline(3, 4, 10, "0"); k.px(3, 3, "0"); k.px(12, 3, "0"); k.px(7, 2, "C"); k.px(8, 2, "C"); k.px(7, 3, "C"); }),
  shirt_space: () => pixGrid(16, 26, k => { shirtShape(k, "C", { sleeves: "C" }); k.rect(3, 16, 1, 3, "C"); k.rect(12, 16, 1, 3, "C"); k.rect(6, 14, 4, 3, "D"); k.px(7, 15, "2"); k.px(8, 15, "A"); k.hline(4, 19, 8, "A"); }),
  shirt_jersey:() => pixGrid(16, 26, k => { shirtShape(k, "6", { trim: "C" }); k.rect(7, 15, 2, 3, "C"); k.px(9, 15, "C"); }),
  shirt_tux:   () => pixGrid(16, 26, k => { shirtShape(k, "0", { sleeves: "0" }); k.rect(7, 13, 2, 7, "C"); k.px(7, 13, "2"); k.px(8, 13, "2"); k.px(7, 16, "0"); k.px(7, 18, "0"); }),
  pants_cargo: () => pixGrid(16, 26, k => { pantsShape(k, "7"); k.px(5, 21, "6"); k.px(10, 21, "6"); }),
  pants_space: () => pixGrid(16, 26, k => { pantsShape(k, "C"); k.hline(5, 21, 6, "D"); }),
  acc_medal:   () => pixGrid(16, 26, k => { k.px(6, 13, "2"); k.px(9, 13, "9"); k.px(7, 14, "2"); k.px(8, 14, "9"); k.rect(7, 15, 2, 2, "4"); k.px(7, 15, "h"); }),
  acc_backpack:() => pixGrid(16, 26, k => { k.rect(2, 14, 2, 6, "2"); k.rect(12, 14, 2, 6, "2"); k.vline(5, 13, 3, "1"); k.vline(10, 13, 3, "1"); }),
  acc_mustache:() => pixGrid(16, 26, k => { k.hline(6, 9, 4, "k"); k.px(5, 10, "k"); k.px(10, 10, "k"); }),
};

Object.assign(SPRITE_BUILDINGS, MORE_BUILDINGS, MORE_POWERED);
Object.assign(SPRITE_DECOR, MORE_DECOR);
Object.assign(SPRITE_OUTFIT, MORE_OUTFITS);

// Icons for the phone, the Today board, the notebook and records.

const UI_ICONS = {
  ico_phone: () => pixGrid(12, 18, k => { k.box(0, 0, 12, 18, "F"); k.rect(2, 2, 8, 12, "A"); k.rect(3, 3, 2, 2, "4"); k.rect(7, 3, 2, 2, "5"); k.rect(3, 7, 2, 2, "p"); k.rect(7, 7, 2, 2, "B"); k.rect(5, 15, 2, 1, "D"); }),
  ico_today: () => pixGrid(14, 14, k => { k.box(0, 1, 14, 13, "C"); k.rect(1, 2, 12, 3, "2"); k.px(3, 0, "F"); k.px(10, 0, "F"); k.rect(3, 7, 2, 2, "6"); k.rect(6, 7, 2, 2, "E"); k.rect(9, 7, 2, 2, "E"); k.rect(3, 10, 2, 2, "E"); k.rect(6, 10, 2, 2, "4"); }),
  ico_book: () => pixGrid(14, 14, k => { k.box(0, 0, 14, 14, "8"); k.rect(2, 1, 1, 12, "4"); k.rect(5, 4, 6, 2, "C"); k.px(7, 8, "4"); k.px(8, 9, "4"); k.px(7, 10, "4"); }),
  ico_clock: () => pixGrid(14, 14, k => { for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; k.px(Math.round(7 + Math.cos(t) * 6), Math.round(7 + Math.sin(t) * 6), "0"); } k.rect(3, 3, 9, 9, "C"); k.rect(5, 2, 5, 11, "C"); k.rect(2, 5, 11, 5, "C"); k.vline(7, 3, 5, "0"); k.hline(7, 7, 3, "2"); }),
  ico_tools: () => pixGrid(14, 14, k => { for (let i = 0; i < 10; i++) { k.px(2 + i, 11 - i, "D"); k.px(3 + i, 11 - i, "E"); } k.rect(10, 0, 4, 4, "D"); k.px(12, 1, "0"); for (let i = 0; i < 9; i++) k.px(3 + i, 3 + i, "b"); k.rect(1, 0, 4, 3, "F"); }),
  ico_gear: () => pixGrid(14, 14, k => { k.rect(4, 1, 6, 12, "E"); k.rect(1, 4, 12, 6, "E"); k.rect(2, 2, 10, 10, "E"); k.rect(5, 5, 4, 4, "C"); }),
  ico_trophy: () => pixGrid(14, 14, k => { k.rect(3, 0, 8, 6, "4"); k.rect(4, 6, 6, 2, "4"); k.rect(6, 8, 2, 3, "g"); k.rect(4, 11, 6, 3, "b"); k.px(1, 1, "4"); k.px(1, 2, "4"); k.px(2, 3, "4"); k.px(12, 1, "4"); k.px(12, 2, "4"); k.px(11, 3, "4"); k.px(5, 1, "h"); }),
  ico_new: () => pixGrid(18, 9, k => { k.box(0, 0, 18, 9, "2"); for (const [x, y] of [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [4, 3], [5, 4], [6, 5], [6, 2], [6, 3], [6, 4], [6, 6], [8, 2], [8, 3], [8, 4], [8, 5], [8, 6], [9, 2], [10, 2], [9, 4], [9, 6], [10, 6], [12, 2], [12, 3], [12, 4], [12, 5], [13, 6], [14, 5], [15, 6], [16, 2], [16, 3], [16, 4], [16, 5]]) k.px(x, y, "C"); }),
};

function makeMoreTextures(scene) {
  for (const [key, set] of Object.entries({ ...MORE_BUILDING_LIGHTS, ...MORE_POWERED_LIGHTS })) {
    makeTex(scene, `bld_${key}_lit`, set.lit());
    makeTex(scene, `bld_${key}_dim`, set.dim());
  }
  for (const [key, fn] of Object.entries(UI_ICONS)) makeTex(scene, key, fn(), 2);
}
