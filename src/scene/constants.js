// src/scene/constants.js
//
// Constants shared by the scene modules: part id prefixes, how far each part
// reaches above and below its placement point, the play field's edges, the
// save storage, and Sparky's question cooldowns.
//
// Main pieces: PREFIX, PLACEABLE_KINDS, PART_EXTENT, FIELD_TOP/BOTTOM, GAME_STORAGE.

const WIRE_COLOR = 0x1a1c2c; // dark ink; turns orange (warm) or red (hot) under load

const PREFIX = { HOUSE: "H", RES: "R", CAP: "C", TRANS: "T", LED: "L", SOLAR: "S", BAT: "B" };
const DEFAULT_COUNTERS = { H: 0, R: 0, T: 0, L: 0, C: 0, X: 0, S: 0, B: 0 };
const PLACEABLE_KINDS = new Set(["HOUSE", "RES", "CAP", "TRANS", "LED", "SOLAR", "BAT", "XFMR"]);

// How far each part's art and dots reach above/below its placement point
// (see the make* functions in src/scene/parts.js). Keeps both dots on the
// field: not off the bottom edge, not under the toolbar.
const PART_EXTENT = {
  HOUSE: { up: 68, down: 100 },
  RES:   { up: 18, down: 90 },
  CAP:   { up: 38, down: 96 },
  XFMR:  { up: 40, down: 96 },
  TRANS: { up: 28, down: 85 },
  LED:   { up: 22, down: 102 },
  SOLAR: { up: 30, down: 85 },
  BAT:   { up: 30, down: 82 },
};
const FIELD_TOP = 150;      // below the HUD
const FIELD_BOTTOM = 590;   // above the status bar (see src/ui/hud.js)
const FIELD_X_MARGIN = 62;

// Saves live in this browser. If storage is blocked (private mode), the game
// still works, it just doesn't remember.
const GAME_STORAGE = (() => { try { return window.localStorage; } catch (e) { return null; } })();

const ASK_COOLDOWN_MS = 15000;   // Sparky asks at most this often
const BOSS_ASK_COOLDOWN_MS = 4000; // in a boss fight, this often
const STORM_AT = 45;             // seconds into a stormy in-game day when lightning strikes
