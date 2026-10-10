// src/rules/game.js
//
// The core game rules: XP and levels, the shop catalogue, the save file
// ("profile") and its slots, rewards, buying and wearing, the daily gift and
// puzzle streak, weather and the day/night clock, Sparky's questions, power
// orders and storm damage. Pure logic, no Phaser and no DOM: functions take
// plain data (profile, solved circuit `state`, time `now`, an rng) and return
// plain data, so tests/game.test.mjs can check every rule.
//
// Main pieces: levelForXp(), BUILDINGS, OUTFITS, createProfile(),
// normalizeProfile(), loadProfile(), saveProfile(), addReward(), buy(),
// openGift(), weatherFor(), clockInfo(), pickPrediction(), generateOrder(),
// settleOrders(), pickStormWire().
// Uses: genAmps() and computePower() from src/circuit/solver.js. Reads names
// from other src/rules/ files when they are loaded (REGIONS, PLANTS, ...).
// Used by: most scene and ui modules, e.g. src/scene/setup.js (loading),
// src/scene/town.js (orders), src/scene/sparky.js, src/ui/shop.js.

// localStorage key for save slot 1 (see Save slots below).
const SAVE_KEY = "ececity.save.v1";

// --- XP and levels ---
// Parts unlock in teaching order, one idea at a time. Levels go 1 to 25, with
// a new world on the map every two levels after level 8 (see REGIONS in
// src/rules/world.js).
const XP_FOR_LEVEL = [0, 40, 100, 180, 280, 400, 550, 750, 1000, 1300,
  1650, 2050, 2500, 3000, 3550, 4150, 4800, 5500, 6250, 7050, 7900, 8800, 9750, 10750, 11800];
const MAX_LEVEL = XP_FOR_LEVEL.length;

function levelForXp(xp) {
  let lvl = 1;
  for (let i = 0; i < XP_FOR_LEVEL.length; i++) if (xp >= XP_FOR_LEVEL[i]) lvl = i + 1;
  return lvl;
}
// Progress through the current level, 0..1 (1 at max level).
function levelProgress(xp) {
  const lvl = levelForXp(xp);
  if (lvl >= MAX_LEVEL) return 1;
  const lo = XP_FOR_LEVEL[lvl - 1], hi = XP_FOR_LEVEL[lvl];
  return Math.max(0, Math.min(1, (xp - lo) / (hi - lo)));
}

// The level each part unlocks at. Each region also teaches its own parts
// (see REGIONS in src/rules/world.js): Sparkville has houses, resistors, LEDs
// and switches; Battery Bay stores power; Solar Desert makes it from sunshine;
// Transformer Mountains moves it over long distances.
const PARTS = {
  HOUSE: { name: "House", level: 1 },
  RES:   { name: "Resistor", level: 2 },
  LED:   { name: "LED", level: 2 },
  TRANS: { name: "Switch", level: 3 },
  CAP:   { name: "Capacitor", level: 4 },
  BAT:   { name: "Battery", level: 5 },
  SOLAR: { name: "Solar panel", level: 6 },
  XFMR:  { name: "Transformer", level: 8 },
};
const MISSION_LEVELS = [1, 1, 2, 3, 4]; // which level each of the 5 missions needs

function partUnlocked(profile, kind) {
  return levelForXp(profile.xp) >= (PARTS[kind]?.level ?? 99);
}

// --- Catalogue ---
// Buildings (each with its own power needs), decorations, and clothes for the
// engineer in the corner. R is the building's load in ohms; it lights fully
// at vOn volts and glows dim from vDim.
const BUILDINGS = {
  house:    { name: "Cottage", price: 0, level: 1, R: 18, vOn: 9, vDim: 7, need: "A cottage: lights and a fridge." },
  park:     { name: "Park lights", price: 50, level: 2, R: 36, vOn: 8, vDim: 6, need: "Park lamps sip only a little power." },
  bakery:   { name: "Bakery", price: 60, level: 2, R: 9, vOn: 9, vDim: 7, need: "Its big oven draws twice the power of a cottage." },
  icecream: { name: "Ice-cream shop", price: 80, level: 3, R: 15, vOn: 9.5, vDim: 7, need: "The freezer needs steady power — no flickering!" },
  school:   { name: "School", price: 120, level: 4, R: 12, vOn: 10, vDim: 8, need: "Needs at least 10 volts for its computers." },
  hospital: { name: "Hospital", price: 200, level: 5, R: 10, vOn: 9.5, vDim: 8, need: "Must never go dark — give it a battery backup." },
  library:  { name: "Library", price: 70, level: 3, R: 24, vOn: 8.5, vDim: 6.5, need: "Quiet reading lamps: a gentle load." },
  hotel:    { name: "Hotel", price: 150, level: 6, R: 8, vOn: 9, vDim: 7, need: "Lots of rooms, lots of lights: more than two cottages' worth." },
  cinema:   { name: "Cinema", price: 140, level: 7, R: 12, vOn: 10, vDim: 8, need: "The projector needs 10 volts, or the film flickers." },
  firestation: { name: "Fire station", price: 160, level: 8, R: 14, vOn: 9.5, vDim: 8, need: "Always ready: a battery backup is smart." },
  arcade:   { name: "Arcade", price: 180, level: 9, R: 11, vOn: 9.5, vDim: 8, need: "Dozens of game machines: hungry for power, and they need steady volts." },
  stadium:  { name: "Stadium", price: 300, level: 12, R: 5, vOn: 9.5, vDim: 8, bigPlant: true, need: "Giant floodlights — too much for the little generator! Buy a bigger power plant: a hydro dam or stronger keeps it bright day and night." },
  // Decorations that light up. They are wired just like buildings.
  streetlight: { name: "Street light", price: 20, level: 1, R: 60, vOn: 6, vDim: 4, decor: true, need: "One small bulb: it glows on hardly any power." },
  xmastree: { name: "Twinkly tree", price: 40, level: 2, R: 45, vOn: 7, vDim: 5, decor: true, need: "Strings of tiny lights — a small load." },
  litfountain: { name: "Light-up fountain", price: 55, level: 3, R: 30, vOn: 8, vDim: 6, decor: true, need: "A water pump and coloured lights." },
  billboard: { name: "Billboard", price: 75, level: 5, R: 20, vOn: 9, vDim: 7, decor: true, need: "A big glowing sign: it needs 9 volts." },
  ferriswheel: { name: "Ferris wheel", price: 220, level: 10, R: 9, vOn: 9.5, vDim: 8, decor: true, need: "A motor and hundreds of bulbs: as hungry as a bakery." },
};
const BUILDING_KEYS = Object.keys(BUILDINGS);

const DECOR = {
  flowers:  { name: "Flower bed", price: 10, level: 1 },
  bench:    { name: "Bench", price: 15, level: 1 },
  lamp:     { name: "Old lamp post", price: 25, level: 1 },
  fountain: { name: "Fountain", price: 45, level: 2 },
  pond:     { name: "Duck pond", price: 50, level: 3 },
  statue:   { name: "Statue", price: 90, level: 4 },
  hedge:    { name: "Hedge", price: 10, level: 1 },
  mailbox:  { name: "Mailbox", price: 15, level: 1 },
  picnic:   { name: "Picnic table", price: 30, level: 2 },
  flagpole: { name: "Flag pole", price: 35, level: 3 },
  slide:    { name: "Slide", price: 60, level: 5 },
  gazebo:   { name: "Gazebo", price: 110, level: 8 },
};

const OUTFITS = {
  // slot: hat / shirt / pants / acc. Price 0 means you start with it.
  shirt_blue:   { slot: "shirt", name: "Blue tee", price: 0, level: 1 },
  pants_jeans:  { slot: "pants", name: "Jeans", price: 0, level: 1 },
  hat_cap:      { slot: "hat", name: "Red cap", price: 25, level: 1 },
  hat_beanie:   { slot: "hat", name: "Beanie", price: 35, level: 1 },
  shirt_green:  { slot: "shirt", name: "Green tee", price: 20, level: 1 },
  acc_glasses:  { slot: "acc", name: "Glasses", price: 30, level: 1 },
  acc_bowtie:   { slot: "acc", name: "Bow tie", price: 30, level: 1 },
  pants_shorts: { slot: "pants", name: "Shorts", price: 25, level: 1 },
  hat_hardhat:  { slot: "hat", name: "Hard hat", price: 50, level: 2 },
  shirt_stripes:{ slot: "shirt", name: "Stripes", price: 40, level: 2 },
  pants_overalls:{ slot: "pants", name: "Overalls", price: 60, level: 2 },
  shirt_labcoat:{ slot: "shirt", name: "Lab coat", price: 90, level: 3 },
  hat_wizard:   { slot: "hat", name: "Wizard hat", price: 120, level: 4 },
  shirt_hero:   { slot: "shirt", name: "Hero suit", price: 160, level: 5 },
  acc_cape:     { slot: "acc", name: "Cape", price: 140, level: 5 },
  hat_crown:    { slot: "hat", name: "Crown", price: 250, level: 6 },
  shirt_bolt:   { slot: "shirt", name: "Lightning tee", price: 35, level: 1 },
  pants_red:    { slot: "pants", name: "Red pants", price: 30, level: 1 },
  acc_scarf:    { slot: "acc", name: "Scarf", price: 25, level: 1 },
  acc_headphones:{ slot: "acc", name: "Headphones", price: 35, level: 1 },
  hat_propeller:{ slot: "hat", name: "Propeller cap", price: 45, level: 2 },
  shirt_hoodie: { slot: "shirt", name: "Hoodie", price: 45, level: 2 },
  hat_straw:    { slot: "hat", name: "Straw hat", price: 60, level: 10 },
  acc_shades:   { slot: "acc", name: "Neon shades", price: 80, level: 14 },
  shirt_parka:  { slot: "shirt", name: "Snow parka", price: 120, level: 16 },
  hat_helmet:   { slot: "hat", name: "Space helmet", price: 300, level: 24 },
  acc_mustache: { slot: "acc", name: "Mustache", price: 20, level: 1 },
  hat_party:    { slot: "hat", name: "Party hat", price: 30, level: 2 },
  shirt_jersey: { slot: "shirt", name: "Team jersey", price: 50, level: 3 },
  pants_cargo:  { slot: "pants", name: "Cargo pants", price: 45, level: 4 },
  hat_chef:     { slot: "hat", name: "Chef hat", price: 70, level: 6 },
  acc_backpack: { slot: "acc", name: "Backpack", price: 60, level: 7 },
  hat_cowboy:   { slot: "hat", name: "Cowboy hat", price: 90, level: 9 },
  shirt_tux:    { slot: "shirt", name: "Tuxedo", price: 150, level: 11 },
  hat_pirate:   { slot: "hat", name: "Pirate hat", price: 110, level: 13 },
  acc_medal:    { slot: "acc", name: "Gold medal", price: 200, level: 18 },
  shirt_space:  { slot: "shirt", name: "Space suit", price: 260, level: 22 },
  pants_space:  { slot: "pants", name: "Space pants", price: 180, level: 22 },
};
const OUTFIT_SLOTS = ["hat", "shirt", "pants", "acc"];

// --- The save ("profile") ---

function createProfile() {
  return {
    v: 1,
    coins: 50,
    xp: 0,
    streak: 0,            // Sparky questions answered right in a row
    bestStreak: 0,
    owned: { buildings: {}, decor: {}, outfits: ["shirt_blue", "pants_jeans"], pet: ["dog_brown", "robot_silver"], plants: [] },
    wearing: { hat: null, shirt: "shirt_blue", pants: "pants_jeans", acc: null },
    decorPlaced: [],      // [{ key, x, y, region }]
    orders: [null, null, null],
    refillAt: [0, 0, 0],  // when an empty order slot gets a new order (ms timestamp)
    orderSeq: 0,
    ordersDone: 0,
    repair: null,         // storm damage: { a, b, coins, xp }
    stormCycle: -1,       // last day/night cycle a storm broke a line
    daily: { lastLoginDay: null, loginStreak: 0, giftDay: null, puzzleDay: null, lastPuzzleDay: null, puzzleStreak: 0 },
    town: null,           // only in old saves; read into towns.sparkville
    towns: {},            // region key -> saved town board (undo/redo snapshot format)
    region: "sparkville", // the world-map region you're in
    visited: ["sparkville"],
    bossWins: {},         // region key -> { easy: true, medium: true, ... }
    zaps: 0,              // Captain Short Circuit zapped, all time
    stickers: {},         // sticker id -> day you earned it
    sidekick: { type: "dog", color: "dog_brown", hat: null, acc: null },
    seenIntro: false,     // the "how to play" box shows once
    settings: { sparky: true, music: true, emergencies: true },
    campaign: {},         // level id -> best stars (1..3), see src/rules/campaign.js
    plantIn: {},          // region key -> plant powering that town, see src/rules/plants.js
    lines: [],            // power lines between towns: [{ a, b, ratio }]
    population: {},       // region key -> how many people live there
    fuelCycle: -1,        // last day/night cycle the coal was paid for
    coalPaid: true,
    emergenciesDone: 0,
    savedAt: 0,           // ms timestamp of the last save (for the save-slot list)
    // Feature unlocks and records: see src/rules/progress.js and src/rules/maker.js.
    seenFeatures: ["wire", "levels", "hint", "settings", "howto", "title"], // buttons tapped since they appeared (no more "New!")
    announced: ["wire", "levels", "hint", "settings", "howto", "title"],    // features already announced with "New: ..."
    seenCards: [],        // Notebook cards you've looked at
    records: {},          // level id -> { time: best seconds, noUndo: true }
    myPuzzles: [],        // puzzles you made: [{ name, code }] (newest first, max 12)
  };
}

// Fill in anything missing (an older or hand-edited save) and drop junk, so
// the rest of the game can trust the shape. The typeof checks are there
// because tests may load this file without the other rule files.
function normalizeProfile(raw) {
  const p = createProfile();
  if (!raw || typeof raw !== "object") return p;
  const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  p.coins = Math.max(0, Math.floor(num(raw.coins, p.coins)));
  p.xp = Math.max(0, Math.floor(num(raw.xp, p.xp)));
  p.streak = Math.max(0, Math.floor(num(raw.streak, 0)));
  p.bestStreak = Math.max(p.streak, Math.floor(num(raw.bestStreak, 0)));
  const ob = raw.owned || {};
  for (const k of BUILDING_KEYS) if (num(ob.buildings?.[k], 0) > 0) p.owned.buildings[k] = Math.floor(ob.buildings[k]);
  for (const k of Object.keys(DECOR)) if (num(ob.decor?.[k], 0) > 0) p.owned.decor[k] = Math.floor(ob.decor[k]);
  if (Array.isArray(ob.outfits)) for (const k of ob.outfits) if (OUTFITS[k] && !p.owned.outfits.includes(k)) p.owned.outfits.push(k);
  const w = raw.wearing || {};
  for (const slot of OUTFIT_SLOTS) {
    const k = w[slot];
    if (k === null) p.wearing[slot] = slot === "shirt" ? "shirt_blue" : slot === "pants" ? "pants_jeans" : null;
    else if (k && OUTFITS[k]?.slot === slot && p.owned.outfits.includes(k)) p.wearing[slot] = k;
  }
  const regionOk = (r) => (typeof REGION_KEYS !== "undefined" ? REGION_KEYS : ["sparkville"]).includes(r);
  if (Array.isArray(raw.decorPlaced)) p.decorPlaced = raw.decorPlaced.filter(d => d && DECOR[d.key] && Number.isFinite(d.x) && Number.isFinite(d.y)).map(d => ({ key: d.key, x: d.x, y: d.y, region: regionOk(d.region) ? d.region : "sparkville" }));
  if (Array.isArray(raw.orders) && raw.orders.length === 3) p.orders = raw.orders.map(o => (o && typeof o === "object" && o.kind ? o : null));
  if (Array.isArray(raw.refillAt) && raw.refillAt.length === 3) p.refillAt = raw.refillAt.map(t => num(t, 0));
  p.orderSeq = Math.floor(num(raw.orderSeq, 0));
  p.ordersDone = Math.floor(num(raw.ordersDone, 0));
  if (raw.repair && typeof raw.repair.a === "string" && typeof raw.repair.b === "string") p.repair = { a: raw.repair.a, b: raw.repair.b, coins: num(raw.repair.coins, 25), xp: num(raw.repair.xp, 15) };
  p.stormCycle = Math.floor(num(raw.stormCycle, -1));
  const d = raw.daily || {};
  const day = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  p.daily = {
    lastLoginDay: day(d.lastLoginDay), loginStreak: Math.max(0, Math.floor(num(d.loginStreak, 0))), giftDay: day(d.giftDay),
    puzzleDay: day(d.puzzleDay), lastPuzzleDay: day(d.lastPuzzleDay), puzzleStreak: Math.max(0, Math.floor(num(d.puzzleStreak, 0))),
  };
  const goodBoard = (t) => t && typeof t === "object" && Array.isArray(t.parts) && Array.isArray(t.wires) && t.counters && typeof t.counters === "object";
  const regionKeys = typeof REGION_KEYS !== "undefined" ? REGION_KEYS : ["sparkville"];
  if (raw.towns && typeof raw.towns === "object") for (const k of regionKeys) if (goodBoard(raw.towns[k])) p.towns[k] = raw.towns[k];
  if (!p.towns.sparkville && goodBoard(raw.town)) p.towns.sparkville = raw.town; // old save with a single town
  p.region = regionKeys.includes(raw.region) ? raw.region : "sparkville";
  if (Array.isArray(raw.visited)) for (const k of raw.visited) if (regionKeys.includes(k) && !p.visited.includes(k)) p.visited.push(k);
  if (!p.visited.includes(p.region)) p.visited.push(p.region);
  if (raw.bossWins && typeof raw.bossWins === "object") {
    for (const k of regionKeys) {
      const w = raw.bossWins[k];
      if (!w || typeof w !== "object") continue;
      for (const d of ["easy", "medium", "hard", "extreme"]) if (w[d] === true) (p.bossWins[k] = p.bossWins[k] || {})[d] = true;
    }
  }
  p.zaps = Math.max(0, Math.floor(num(raw.zaps, 0)));
  if (raw.stickers && typeof raw.stickers === "object") {
    const ids = typeof STICKERS !== "undefined" ? Object.keys(STICKERS) : [];
    for (const id of ids) if (day(raw.stickers[id])) p.stickers[id] = raw.stickers[id];
  }
  if (Array.isArray(ob.pet) && typeof PET_ITEMS !== "undefined") for (const k of ob.pet) if (PET_ITEMS[k] && !p.owned.pet.includes(k)) p.owned.pet.push(k);
  const sk = raw.sidekick || {};
  if (sk.type === "dog" || sk.type === "robot") p.sidekick.type = sk.type;
  const petOk = (k, slot) => typeof PET_ITEMS !== "undefined" && PET_ITEMS[k]?.slot === slot && p.owned.pet.includes(k);
  const colorSlot = p.sidekick.type === "dog" ? "dogcolor" : "robotcolor";
  p.sidekick.color = petOk(sk.color, colorSlot) ? sk.color : (p.sidekick.type === "dog" ? "dog_brown" : "robot_silver");
  p.sidekick.hat = petOk(sk.hat, "pethat") ? sk.hat : null;
  p.sidekick.acc = petOk(sk.acc, "petacc") ? sk.acc : null;
  p.seenIntro = raw.seenIntro === true;
  p.settings.sparky = raw.settings?.sparky !== false;
  p.settings.music = raw.settings?.music !== false;
  p.settings.emergencies = raw.settings?.emergencies !== false;
  if (raw.campaign && typeof raw.campaign === "object" && typeof CAMPAIGN_LEVELS !== "undefined") {
    for (const lv of CAMPAIGN_LEVELS) { const st = raw.campaign[lv.id]; if (Number.isInteger(st) && st >= 1 && st <= 3) p.campaign[lv.id] = st; }
  }
  const plantKeys = typeof PLANTS !== "undefined" ? Object.keys(PLANTS) : [];
  if (Array.isArray(ob.plants)) for (const k of ob.plants) if (plantKeys.includes(k) && k !== "generator" && !p.owned.plants.includes(k)) p.owned.plants.push(k);
  if (raw.plantIn && typeof raw.plantIn === "object") for (const k of regionKeys) { const v = raw.plantIn[k]; if (v === "generator" || p.owned.plants.includes(v)) p.plantIn[k] = v; }
  if (Array.isArray(raw.lines) && typeof lineNeighbours === "function") {
    for (const l of raw.lines) {
      if (!l || !regionKeys.includes(l.a) || !regionKeys.includes(l.b) || !lineNeighbours(l.a, l.b) || ![1, 5, 10].includes(l.ratio)) continue;
      if (p.lines.some(x => (x.a === l.a && x.b === l.b) || (x.a === l.b && x.b === l.a))) continue;
      p.lines.push({ a: l.a, b: l.b, ratio: l.ratio });
    }
  }
  if (raw.population && typeof raw.population === "object") for (const k of regionKeys) { const n = num(raw.population[k], 0); if (n > 0) p.population[k] = Math.min(9999, Math.floor(n)); }
  p.fuelCycle = Math.floor(num(raw.fuelCycle, -1));
  p.coalPaid = raw.coalPaid !== false;
  p.emergenciesDone = Math.max(0, Math.floor(num(raw.emergenciesDone, 0)));
  p.savedAt = Math.max(0, num(raw.savedAt, 0));
  const strList = (v, ok) => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === "string" && ok(x)))] : null);
  const feat = typeof FEATURES !== "undefined" ? FEATURES : null;
  const seen = strList(raw.seenFeatures, k => !feat || !!feat[k]);
  if (seen) { p.seenFeatures = seen; p.announced = strList(raw.announced, k => !feat || !!feat[k]) || []; }
  else if (feat && (num(raw.xp, 0) > 0 || raw.campaign)) {
    // An old save without seenFeatures: everything you can already use counts
    // as seen and announced, so only the brand-new things say "New!".
    const had = Object.keys(feat).filter(k => !BRAND_NEW_FEATURES.includes(k) && featureUnlocked(p, k));
    p.seenFeatures = had; p.announced = [...had];
  }
  const cardOk = typeof NOTEBOOK !== "undefined" ? (k => NOTEBOOK.some(c => c.key === k)) : (() => true);
  p.seenCards = strList(raw.seenCards, cardOk) || [];
  if (raw.records && typeof raw.records === "object") {
    for (const [id, r] of Object.entries(raw.records)) {
      if (!/^[a-z]+-\d+$/.test(id) || !r || typeof r !== "object") continue;
      const out = {};
      if (Number.isFinite(r.time) && r.time > 0 && r.time < 36000) out.time = Math.round(r.time * 10) / 10;
      if (r.noUndo === true) out.noUndo = true;
      if (Object.keys(out).length) p.records[id] = out;
    }
  }
  if (Array.isArray(raw.myPuzzles)) p.myPuzzles = raw.myPuzzles.filter(x => x && typeof x.name === "string" && typeof x.code === "string" && x.code.length < 4000).slice(0, 12).map(x => ({ name: x.name.slice(0, 30), code: x.code }));
  return p;
}

// --- Save slots ---
// Three save files. Slot 1 uses the plain SAVE_KEY, so an old single save
// simply becomes slot 1.
const SLOT_COUNT = 3;
const SLOT_KEY = "ececity.slot"; // which slot was played last
function slotSaveKey(slot) { return slot === 1 ? SAVE_KEY : `${SAVE_KEY}.slot${slot}`; }
function validSlot(n) { return Number.isInteger(n) && n >= 1 && n <= SLOT_COUNT; }
function currentSlot(storage) {
  try { const n = parseInt(storage?.getItem(SLOT_KEY), 10); return validSlot(n) ? n : 1; } catch (e) { return 1; }
}
function setCurrentSlot(storage, n) {
  if (!validSlot(n)) return false;
  try { storage?.setItem(SLOT_KEY, String(n)); return true; } catch (e) { return false; }
}
function loadProfile(storage, slot = 1) {
  try {
    const txt = storage?.getItem(slotSaveKey(validSlot(slot) ? slot : 1));
    return normalizeProfile(txt ? JSON.parse(txt) : null);
  } catch (e) {
    return createProfile();
  }
}
function saveProfile(storage, profile, slot = 1) {
  profile.savedAt = Date.now();
  try { storage?.setItem(slotSaveKey(validSlot(slot) ? slot : 1), JSON.stringify(profile)); return true; } catch (e) { return false; }
}
// A short summary of a save file for the title screen, or null if empty.
function slotSummary(storage, slot) {
  let raw = null;
  try { const txt = storage?.getItem(slotSaveKey(slot)); raw = txt ? JSON.parse(txt) : null; } catch (e) { raw = null; }
  if (!raw || typeof raw !== "object") return null;
  const p = normalizeProfile(raw);
  const stars = Object.values(p.campaign).reduce((a, b) => a + b, 0);
  return { slot, level: levelForXp(p.xp), coins: p.coins, region: p.region, stars, wearing: p.wearing, sidekick: p.sidekick, savedAt: p.savedAt, profile: p };
}
function eraseSlot(storage, slot) {
  if (!validSlot(slot)) return false;
  try {
    storage?.removeItem(slotSaveKey(slot));
    storage?.removeItem(slot === 1 ? "ececity.missionsDone" : `ececity.missionsDone.slot${slot}`);
    return true;
  } catch (e) { return false; }
}

// --- Rewards ---

// What the player can newly use at exactly `level`.
function unlocksAtLevel(level) {
  const out = [];
  for (const [k, v] of Object.entries(PARTS)) if (v.level === level) out.push(v.name);
  for (const [k, v] of Object.entries(BUILDINGS)) if (v.level === level && v.price > 0) out.push(v.name);
  MISSION_LEVELS.forEach((l, i) => { if (l === level && level > 1) out.push(`Mission ${i + 1}`); });
  if (typeof REGIONS !== "undefined") {
    for (const r of Object.values(REGIONS)) {
      if (r.level === level && level > 1) out.push(`${r.name} on the map`);
      if (r.bossLevel === level) out.push(`the ${r.name} boss`);
    }
  }
  if (typeof PLANTS !== "undefined") for (const p of Object.values(PLANTS)) if (p.level === level && p.price > 0) out.push(`the ${p.name.toLowerCase()} (PHONE → Shop)`);
  return out;
}

// Add coins and XP. Returns what happened, for the celebration.
function addReward(profile, coins, xp) {
  const before = levelForXp(profile.xp);
  profile.coins = Math.max(0, profile.coins + Math.round(coins));
  profile.xp = Math.max(0, profile.xp + Math.round(xp));
  const after = levelForXp(profile.xp);
  const unlocked = [];
  for (let l = before + 1; l <= after; l++) unlocked.push(...unlocksAtLevel(l));
  return { coins: Math.round(coins), xp: Math.round(xp), leveledUp: after > before, level: after, unlocked };
}

// Streak multiplier: 3 right in a row doubles coins, 6 in a row triples.
function streakMultiplier(streak) {
  return streak >= 6 ? 3 : streak >= 3 ? 2 : 1;
}

// --- Shop and wardrobe ---

function catalogueItem(kind, key) {
  if (kind === "pet") return typeof PET_ITEMS !== "undefined" ? PET_ITEMS[key] || null : null;
  return kind === "building" ? BUILDINGS[key] : kind === "decor" ? DECOR[key] : kind === "outfit" ? OUTFITS[key] : null;
}

// Why you can't buy this right now, or null if you can.
function cannotBuy(profile, kind, key) {
  const item = catalogueItem(kind, key);
  if (!item || (kind === "building" && key === "house")) return "That isn't for sale.";
  if (kind === "outfit" && profile.owned.outfits.includes(key)) return "You already have it.";
  if (kind === "pet" && profile.owned.pet.includes(key)) return "You already have it.";
  const lvl = levelForXp(profile.xp);
  if (lvl < item.level) return `Unlocks at level ${item.level}.`;
  if (profile.coins < item.price) return `You need ${item.price - profile.coins} more coins.`;
  return null;
}

function buy(profile, kind, key) {
  const why = cannotBuy(profile, kind, key);
  if (why) return { ok: false, why };
  const item = catalogueItem(kind, key);
  profile.coins -= item.price;
  if (kind === "building") profile.owned.buildings[key] = (profile.owned.buildings[key] || 0) + 1;
  else if (kind === "decor") profile.owned.decor[key] = (profile.owned.decor[key] || 0) + 1;
  else if (kind === "pet") { profile.owned.pet.push(key); equipPetItem(profile, key); }
  else { profile.owned.outfits.push(key); profile.wearing[item.slot] = key; }
  return { ok: true };
}

// Put on an owned item, or take it off (shirt and pants go back to the
// starter ones; hats and accessories can be empty).
function toggleWear(profile, key) {
  const item = OUTFITS[key];
  if (!item || !profile.owned.outfits.includes(key)) return false;
  if (profile.wearing[item.slot] === key) {
    profile.wearing[item.slot] = item.slot === "shirt" ? "shirt_blue" : item.slot === "pants" ? "pants_jeans" : null;
  } else {
    profile.wearing[item.slot] = key;
  }
  return true;
}

// How many of a bought building you can still place: owned minus placed.
// Counts every region's town: the board on screen (when you're in your
// town) plus the saved towns of the others.
function buildingsAvailable(profile, key, state) {
  if (key === "house") return Infinity;
  let placed = 0;
  const inTown = !state.context || state.context === "town";
  if (inTown) for (const n of state.nodes.values()) if (n.type === "HOUSE" && n.data?.building === key) placed++;
  for (const [rk, t] of Object.entries(profile.towns || {})) {
    if (inTown && rk === (profile.region || "sparkville")) continue;
    for (const part of t.parts || []) if (part.kind === "HOUSE" && part.building === key) placed++;
  }
  return Math.max(0, (profile.owned.buildings[key] || 0) - placed);
}

// --- Days and the daily gift ---

// "YYYY-MM-DD" in local time.
function dayKey(date) {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
// Whole days since 1970, for picking "today's" puzzle, weather and wind.
function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}
function yesterdayKey(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, 12);
  return dayKey(d);
}

// Called when the game opens. Updates the login streak; returns whether
// today's gift is still waiting.
function checkLogin(profile, now) {
  const today = dayKey(now);
  if (profile.daily.lastLoginDay !== today) {
    profile.daily.loginStreak = profile.daily.lastLoginDay === yesterdayKey(now) ? profile.daily.loginStreak + 1 : 1;
    profile.daily.lastLoginDay = today;
  }
  return profile.daily.giftDay !== today;
}

// Open today's gift chest (once a day): usually coins (more for a longer
// login streak), sometimes a decoration.
function openGift(profile, now, rng = Math.random) {
  const today = dayKey(now);
  if (profile.daily.giftDay === today) return null;
  profile.daily.giftDay = today;
  const lvl = levelForXp(profile.xp);
  const decorChoices = Object.keys(DECOR).filter(k => DECOR[k].level <= lvl);
  if (decorChoices.length && rng() < 0.3) {
    const key = decorChoices[Math.floor(rng() * decorChoices.length) % decorChoices.length];
    profile.owned.decor[key] = (profile.owned.decor[key] || 0) + 1;
    return { type: "decor", key, name: DECOR[key].name };
  }
  const coins = 15 + 5 * Math.min(profile.daily.loginStreak, 7);
  profile.coins += coins;
  return { type: "coins", coins };
}

// --- Daily puzzle ---

// Which of the `count` daily puzzles is today's.
function puzzleIndexFor(now, count) {
  return ((dayNumber(now) % count) + count) % count;
}
function puzzleDoneToday(profile, now) {
  return profile.daily.puzzleDay === dayKey(now);
}
// Mark today's puzzle solved: returns the reward, or null if already done today.
function completeDailyPuzzle(profile, now) {
  const today = dayKey(now);
  if (profile.daily.puzzleDay === today) return null;
  profile.daily.puzzleStreak = profile.daily.lastPuzzleDay === yesterdayKey(now) ? profile.daily.puzzleStreak + 1 : 1;
  profile.daily.puzzleDay = today;
  profile.daily.lastPuzzleDay = today;
  return { coins: 40 + 5 * Math.min(profile.daily.puzzleStreak, 6), xp: 25, streak: profile.daily.puzzleStreak };
}

// --- Weather and clock ---

// Small, fast, seeded random numbers, so today's weather is the same for
// everyone.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEATHER = {
  sunny:  { name: "Sunny", solar: 1.6, load: 1, note: "Solar panels work extra well today!" },
  normal: { name: "Fair", solar: 1, load: 1, note: "A nice, ordinary day." },
  cloudy: { name: "Cloudy", solar: 0.5, load: 1, note: "Clouds: solar panels make only half their power." },
  heat:   { name: "Heat wave", solar: 1.3, load: 0.8, note: "Heat wave! Air conditioners make every building need more power." },
  storm:  { name: "Storm", solar: 0.35, load: 1, note: "Storm! Lightning may knock down a power line — be ready to fix it." },
};
function weatherFor(now) {
  const r = seededRandom(dayNumber(now) * 7919 + 13)();
  const key = r < 0.35 ? "sunny" : r < 0.65 ? "normal" : r < 0.8 ? "cloudy" : r < 0.9 ? "heat" : "storm";
  return { key, ...WEATHER[key] };
}

// The day/night clock: one in-game day lasts DAY_LENGTH seconds of play, and
// the last NIGHT_LENGTH of them are night.
const DAY_LENGTH = 240;
const NIGHT_LENGTH = 80;
function clockInfo(seconds) {
  const t = ((seconds % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH;
  const night = t >= DAY_LENGTH - NIGHT_LENGTH;
  return { cycle: Math.floor(seconds / DAY_LENGTH), t, night, untilSwitch: night ? DAY_LENGTH - t : DAY_LENGTH - NIGHT_LENGTH - t };
}
// What the physics should use right now.
function environmentFor(weather, night) {
  return {
    solarFactor: night ? 0 : weather.solar,
    // Night is cooler, so a heat wave doesn't stack on top of it. This keeps a
    // building wired straight to the generator lit in any weather (tested).
    loadScale: night ? 0.7 : weather.load,
  };
}

// --- Sparky's questions ---
// Sparky asks the player to predict what a change will do, then they test it.

const BRIGHTNESS_RANK = { OFF: 0, BURNED: 0, DIM: 1, ON: 2 };

// Given every building's and LED's level before and after a change, pick a
// question. Usually it's about something that visibly changes; sometimes
// about something that stays the same, so "same" is a real answer. Returns
// null when nothing visibly changes.
function pickPrediction(before, after, rng = Math.random) {
  const changed = [], same = [];
  for (const [id, lvlBefore] of before) {
    if (!after.has(id)) continue;
    const a = BRIGHTNESS_RANK[lvlBefore] ?? 0, b = BRIGHTNESS_RANK[after.get(id)] ?? 0;
    (a === b ? same : changed).push({ id, from: lvlBefore, to: after.get(id), dir: b > a ? "brighter" : b < a ? "dimmer" : "same" });
  }
  if (!changed.length) return null;
  const pool = same.length && rng() < 0.25 ? same : changed;
  const q = pool[Math.floor(rng() * pool.length) % pool.length];
  return { targetId: q.id, answer: q.dir, from: q.from, to: q.to };
}

// One line explaining the answer. `action` is what the player did:
// "wire", "unwire", "switch-on", "switch-off". Optional q.vFrom / q.vTo
// (the part's voltage before and after) make the answer concrete.
function explainPrediction(q, action) {
  const id = q.targetId;
  const adding = action === "wire" || action === "switch-on";
  // A part with no complete loop has no real voltage across it, so show 0 V
  // (otherwise "OFF → ON" could look like the volts went down).
  const vFrom = q.from === "OFF" || q.from === "BURNED" ? 0 : q.vFrom;
  const vTo = q.levelTo === "OFF" || q.levelTo === "BURNED" ? 0 : q.vTo;
  const volts = Number.isFinite(vFrom) && Number.isFinite(vTo) ? ` (${Math.abs(vFrom).toFixed(1)} V → ${Math.abs(vTo).toFixed(1)} V)` : "";
  q = { ...q, vFrom, vTo };
  if (q.answer === "same") {
    // Everything on one generator shares it, so "same" usually means a tiny
    // change too small to see. Say so.
    if (volts && Math.abs(Math.abs(q.vTo) - Math.abs(q.vFrom)) >= 0.05) return `Same — ${id}'s voltage changed only a little${volts}, not enough to change how bright it looks.`;
    return `Same — ${id} isn't on the part of the circuit you changed, so nothing reached it.`;
  }
  if (q.answer === "brighter") {
    return adding
      ? `Brighter${volts} — that finished a loop, so electricity can flow all the way around through ${id}.`
      : `Brighter${volts} — ${id} no longer shares the generator with what you took away (or you removed a shortcut).`;
  }
  return adding
    ? `Dimmer${volts} — ${id} now shares the generator's power with more parts (or a shortcut is stealing it).`
    : `Dimmer${volts} — that broke ${id}'s loop, so electricity can't get all the way around anymore.`;
}

// Score an answer. Right: the streak grows and coins use the new multiplier.
// Wrong: the streak resets, but nothing is taken away.
function scorePrediction(profile, correct) {
  if (!correct) { profile.streak = 0; return { correct: false, coins: 0, xp: 0, multiplier: 1, streak: 0 }; }
  profile.streak += 1;
  profile.bestStreak = Math.max(profile.bestStreak, profile.streak);
  const multiplier = streakMultiplier(profile.streak);
  const coins = 5 * multiplier, xp = 4;
  return { correct: true, coins, xp, multiplier, streak: profile.streak };
}

// --- Power orders ---
// Up to three requests from townspeople at once, paid in coins and XP.

const RESIDENTS = {
  house: ["Grandma Rosa", "Mr. Patel", "Little Sam", "The Nguyens", "Ms. Bell", "Uncle Theo", "Mia and Max"],
  park: ["Coach Kim"],
  bakery: ["Chef Lou"],
  icecream: ["Scoops McGee"],
  school: ["Principal Okafor"],
  hospital: ["Dr. Reyes"],
};

// Every building on the board, with a name for order text.
function townBuildings(state) {
  const out = [];
  for (const n of state.nodes.values()) {
    if (n.type !== "HOUSE") continue;
    const key = n.data?.building && BUILDINGS[n.data.building] ? n.data.building : "house";
    out.push({ id: n.id, key, name: key === "house" ? `house ${n.id}` : `the ${BUILDINGS[key].name.toLowerCase()} (${n.id})` });
  }
  return out;
}
const isLit = (state, id) => state.powered?.get(id)?.level === "ON";

function genCurrentOf(state) {
  if (state.solverError) return Infinity;
  return genAmps(state);
}
// Would this building stay lit with every wire to GEN unplugged? Solved on a
// copy, so the board doesn't change. Lets "sunshine only" and "battery at
// night" orders count while GEN still runs the rest of town.
function litWithoutGen(state, id) {
  if (!isLit(state, id)) return false;
  if (genCurrentOf(state) < 0.001) return true;
  if (typeof computePower !== "function") return false;
  const s = Object.assign({}, state);
  s.nodes = new Map();
  for (const [k, n] of state.nodes) s.nodes.set(k, { id: n.id, type: n.type, data: { ...n.data } });
  s.wires = state.wires.filter(w => w.a !== "GEN" && w.b !== "GEN").map(w => ({ a: w.a, b: w.b }));
  s.nodeVoltages = new Map(); s.powered = new Map(); s.wireMetrics = new Map(); s.solverError = false;
  try { computePower(s, 0); } catch (e) { return false; }
  return !s.solverError && s.powered.get(id)?.level === "ON";
}
function count(state, type) { let n = 0; for (const x of state.nodes.values()) if (x.type === type) n++; return n; }

// Is this order done right now? `ctx`: { night, dt (seconds since the last
// check), switchCycled (Set of building ids a switch turned off and back on) }.
// "hold" orders add up order.progress in seconds and reset if the light goes out.
function checkOrder(order, state, ctx = {}) {
  const lit = (id) => isLit(state, id);
  const gen = genCurrentOf(state);
  switch (order.kind) {
    case "light": return lit(order.target);
    case "lightN": return townBuildings(state).filter(b => lit(b.id)).length >= order.n;
    case "night": return !!ctx.night && lit(order.target);
    case "leds": { let n = 0; for (const x of state.nodes.values()) if (x.type === "LED" && state.powered?.get(x.id)?.level === "ON") n++; return n >= order.n; }
    case "switch": return !!ctx.switchCycled?.has(order.target) && lit(order.target);
    case "storage": return gen < 0.001 && lit(order.target);
    case "solar": return !ctx.night && count(state, "SOLAR") > 0 && litWithoutGen(state, order.target);
    case "nightBattery": return !!ctx.night && count(state, "BAT") > 0 && litWithoutGen(state, order.target);
    case "hold": {
      if (lit(order.target)) order.progress = (order.progress || 0) + (ctx.dt || 0);
      else order.progress = 0;
      return order.progress >= order.seconds;
    }
    default: return false;
  }
}

// Does the order still make sense? Its building might have been deleted.
function orderStillValid(order, state) {
  if (!order.target) return true;
  const n = state.nodes.get(order.target);
  return !!n && n.type === "HOUSE";
}

function orderText(o) {
  switch (o.kind) {
    case "light": return `${o.who}: "Please bring power to ${o.name}!"`;
    case "lightN": return `Mayor Volt: "Light up ${o.n} buildings at the same time!"`;
    case "night": return `${o.who}: "We need ${o.name} lit tonight!"`;
    case "leds": return `Science fair: "We need ${o.n} bright LED${o.n > 1 ? "s" : ""}!"`;
    case "switch": return `${o.who}: "Put a light switch on ${o.name} — turn it off, then on!"`;
    case "storage": return `${o.who}: "Keep ${o.name} lit with the generator unplugged!"`;
    case "solar": return `${o.who}: "Power ${o.name} with sunshine only!"`;
    case "nightBattery": return `${o.who}: "Keep ${o.name} lit at night on battery power!"`;
    case "hold": return `${o.who}: "Keep ${o.name} lit for ${o.seconds} seconds straight!"`;
    default: return "Mystery order";
  }
}

// Make a new order the player can do at their level with what's in their
// town. Never returns one that is already complete (it would pay out at
// once). Tests pass a seeded `rng`.
function generateOrder(profile, state, rng = Math.random, ctx = {}) {
  const lvl = levelForXp(profile.xp);
  const buildings = townBuildings(state);
  const pick = (arr) => arr[Math.floor(rng() * arr.length) % arr.length];
  const regionFolk = typeof REGIONS !== "undefined" && REGIONS[profile.region]?.residents;
  const who = (b) => pick(b.key === "house" && regionFolk ? regionFolk : RESIDENTS[b.key] || RESIDENTS.house);
  const bonus = (b) => ({ house: 0, park: 3, bakery: 8, icecream: 10, school: 15, hospital: 20 }[b.key] || 0);
  const dark = buildings.filter(b => !isLit(state, b.id));

  const makers = [];
  if (dark.length) makers.push(() => { const b = pick(dark); return { kind: "light", target: b.id, name: b.name, who: who(b), coins: 12 + bonus(b), xp: 10 + bonus(b) }; });
  makers.push(() => {
    const litNow = buildings.filter(b => isLit(state, b.id)).length;
    const n = Math.max(2, litNow + 1 + (rng() < 0.4 ? 1 : 0));
    return { kind: "lightN", n, coins: 6 * n, xp: 5 * n };
  });
  if (buildings.length) makers.push(() => { const b = pick(dark.length ? dark : buildings); return { kind: "night", target: b.id, name: b.name, who: who(b), coins: 18 + bonus(b), xp: 14 + bonus(b) }; });
  if (lvl >= PARTS.LED.level) makers.push(() => { const n = 1 + Math.floor(rng() * 3); return { kind: "leds", n, coins: 14 * n, xp: 10 * n }; });
  if (lvl >= PARTS.TRANS.level && buildings.length) makers.push(() => { const b = pick(buildings); return { kind: "switch", target: b.id, name: b.name, who: who(b), coins: 25 + bonus(b), xp: 20 + bonus(b) }; });
  if (lvl >= PARTS.CAP.level && buildings.length) makers.push(() => { const b = pick(buildings); return { kind: "storage", target: b.id, name: b.name, who: who(b), coins: 30 + bonus(b), xp: 24 + bonus(b) }; });
  if (lvl >= PARTS.SOLAR.level && buildings.length) makers.push(() => { const b = pick(buildings); return { kind: "solar", target: b.id, name: b.name, who: who(b), coins: 35 + bonus(b), xp: 26 + bonus(b) }; });
  if (lvl >= PARTS.BAT.level && buildings.length) makers.push(() => { const b = pick(buildings); return { kind: "nightBattery", target: b.id, name: b.name, who: who(b), coins: 50 + bonus(b), xp: 40 + bonus(b) }; });
  const holdable = buildings.filter(b => b.key === "icecream" || b.key === "hospital");
  if (holdable.length) makers.push(() => { const b = pick(holdable); const seconds = b.key === "hospital" ? 45 : 30; return { kind: "hold", target: b.id, name: b.name, who: who(b), seconds, progress: 0, coins: 30 + bonus(b), xp: 22 + bonus(b) }; });

  for (let tries = 0; tries < 12; tries++) {
    const o = pick(makers)();
    const probe = { ...o };
    if (o.kind !== "hold" && o.kind !== "switch" && checkOrder(probe, state, ctx)) continue; // already done: no free coins
    o.id = ++profile.orderSeq;
    o.text = orderText(o);
    return o;
  }
  // Fallback that can't be complete yet: one more lit building than now.
  const litNow = buildings.filter(b => isLit(state, b.id)).length;
  const n = Math.max(2, litNow + 1);
  const o = { kind: "lightN", n, coins: 6 * n, xp: 5 * n, id: ++profile.orderSeq };
  o.text = orderText(o);
  return o;
}

const ORDER_REFILL_MS = 12000;

// Keep the order board full: drop orders whose building is gone and refill
// empty slots once their timer is up. Returns true if anything changed.
function maintainOrders(profile, state, now, rng = Math.random, ctx = {}) {
  let changed = false;
  for (let i = 0; i < 3; i++) {
    const o = profile.orders[i];
    if (o && !orderStillValid(o, state)) { profile.orders[i] = null; profile.refillAt[i] = now; changed = true; }
    if (!profile.orders[i] && now >= (profile.refillAt[i] || 0)) {
      profile.orders[i] = generateOrder(profile, state, rng, ctx);
      changed = true;
    }
  }
  return changed;
}

// Check every order and pay out finished ones (the streak multiplier applies).
// Returns [{ order, reward }] for each order completed now.
function settleOrders(profile, state, now, ctx = {}) {
  const done = [];
  for (let i = 0; i < 3; i++) {
    const o = profile.orders[i];
    if (!o || !checkOrder(o, state, ctx)) continue;
    const bonus = streakMultiplier(profile.streak);
    const reward = addReward(profile, o.coins * bonus, o.xp);
    reward.multiplier = bonus;
    profile.orders[i] = null;
    profile.refillAt[i] = now + ORDER_REFILL_MS;
    profile.ordersDone += 1;
    done.push({ order: o, reward });
  }
  return done;
}

// Swap an order you don't want for a new one (after the refill wait).
function skipOrder(profile, i, now) {
  if (!profile.orders[i]) return false;
  profile.orders[i] = null;
  profile.refillAt[i] = now + ORDER_REFILL_MS;
  return true;
}

// --- Storms ---

// Storm damage: pick a busy wire to knock down. `wires` are {a, b, amps}.
// At most once per day/night cycle, and never while a repair is waiting.
function pickStormWire(profile, wires, cycle, rng = Math.random) {
  if (profile.repair || profile.stormCycle === cycle) return null;
  const busy = wires.filter(w => w.amps >= 0.05);
  if (!busy.length) return null;
  const w = busy[Math.floor(rng() * busy.length) % busy.length];
  profile.stormCycle = cycle;
  profile.repair = { a: w.a, b: w.b, coins: 25, xp: 15 };
  return profile.repair;
}
// The repair is done when any wire joins the same two dots again.
function repairDone(profile, wires) {
  const r = profile.repair;
  return !!r && wires.some(w => (w.a === r.a && w.b === r.b) || (w.a === r.b && w.b === r.a));
}
