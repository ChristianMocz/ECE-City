// src/rules/progress.js
//
// What you've unlocked, what to do next, and what you've learned.
// Every toolbar button is there from the start; phone apps appear as you
// play ("unlock as you go"). Pure logic, no Phaser (tests/progress.test.mjs).
//
// Main pieces: FEATURES and toolbarFor() (unlocks), todayItems() (Today board),
// NOTEBOOK (Engineer's Notebook cards), recordChallenge() and gameProgress() (Records).
// Used by: src/scene/toolbar.js, src/scene/phone.js, src/scene/levelplay.js, src/ui/phone.js.

const doneLevel = (p, id) => (p.campaign?.[id] || 0) >= 1;
const playerLvl = (p) => levelForXp(p.xp);

// where: "bar" = the toolbar, "phone" = an app inside the phone (with its tab).
const FEATURES = {
  wire:     { where: "bar", name: "WIRE", unlock: () => true },
  levels:   { where: "bar", name: "LEVELS", unlock: () => true },
  hint:     { where: "bar", name: "HINT", unlock: () => true },
  undo:     { where: "bar", name: "UNDO and REDO", unlock: () => true },
  today:    { where: "bar", name: "TODAY", unlock: () => true },
  phone:    { where: "bar", name: "PHONE", unlock: () => true },
  delete:   { where: "bar", name: "DELETE", unlock: () => true },
  build:    { where: "bar", name: "+ BUILD", unlock: () => true },
  // Phone apps.
  settings: { where: "phone", tab: "settings", name: "Settings", icon: "ico_gear", unlock: () => true },
  howto:    { where: "phone", tab: "settings", name: "How to play", icon: "sparky", unlock: () => true },
  title:    { where: "phone", tab: "settings", name: "Save & title", icon: "house", unlock: () => true },
  shop:     { where: "phone", tab: "town", name: "Shop", icon: "coin", unlock: (p) => playerLvl(p) >= 2 || doneLevel(p, "sparkville-2"), say: "The SHOP is open (in your phone)!" },
  orders:   { where: "today", name: "Orders", icon: "people", unlock: (p) => playerLvl(p) >= 2 || doneLevel(p, "sparkville-2"), say: "ORDERS: your town asks for things — find them on your TODAY board, and finish them for coins." },
  clothes:  { where: "phone", tab: "me", name: "Clothes", icon: "person", unlock: (p) => playerLvl(p) >= 2 || doneLevel(p, "sparkville-2"), say: "CLOTHES: dress up your engineer (in your phone)." },
  clear:    { where: "phone", tab: "town", name: "Clear board", icon: "ico_tools", unlock: (p) => playerLvl(p) >= 2 || doneLevel(p, "sparkville-2") },
  count:    { where: "phone", tab: "town", name: "Count lights", icon: "led_on", unlock: (p) => playerLvl(p) >= 2 || doneLevel(p, "sparkville-2") },
  notebook: { where: "phone", tab: "me", name: "Notebook", icon: "ico_book", unlock: (p) => notebookCards(p).length > 0, say: "Your Engineer's NOTEBOOK collects everything you learn (in your phone)." },
  records:  { where: "phone", tab: "me", name: "Records", icon: "ico_trophy", unlock: (p) => Object.keys(p.campaign || {}).length >= 3, say: "RECORDS: your progress, best times and challenges (in your phone)." },
  daily:    { where: "phone", tab: "town", name: "Daily", icon: "chest", unlock: (p) => playerLvl(p) >= 3 || doneLevel(p, "sparkville-6"), say: "DAILY: a gift and a new puzzle every day (in your phone)." },
  map:      { where: "phone", tab: "world", name: "World map", icon: "map_pin", unlock: (p) => playerLvl(p) >= 3 || doneLevel(p, "sparkville-6"), say: "The WORLD MAP is in your phone — Captain Short Circuit is waiting in Sparkville!" },
  stickers: { where: "phone", tab: "me", name: "Stickers", icon: "badge", unlock: (p) => playerLvl(p) >= 3 || doneLevel(p, "sparkville-6") },
  skip:     { where: "phone", tab: "town", name: "Skip time", icon: "moon", unlock: (p) => playerLvl(p) >= 3 || doneLevel(p, "sparkville-6") },
  lines:    { where: "phone", tab: "world", name: "Power lines", icon: "pylon", unlock: (p) => Object.keys(p.bossWins || {}).length >= 1 && playerLvl(p) >= 4 },
  maker:    { where: "phone", tab: "make", name: "Puzzle maker", icon: "ico_tools", unlock: (p) => playerLvl(p) >= 5 || doneLevel(p, "sparkville-10"), say: "PUZZLE MAKER: build your own puzzle and share its code with a friend (in your phone)!" },
  playcode: { where: "phone", tab: "make", name: "Play a code", icon: "ico_phone", unlock: (p) => playerLvl(p) >= 2 || doneLevel(p, "sparkville-2") },
};
const FEATURE_KEYS = Object.keys(FEATURES);
// An older save shows these as New.
const BRAND_NEW_FEATURES = ["today", "phone", "notebook", "records", "maker", "playcode"];
const PHONE_TABS = [["town", "Town"], ["world", "World"], ["me", "Me"], ["make", "Make"], ["settings", "Settings"]];

function featureUnlocked(profile, key) { const f = FEATURES[key]; return !!f && !!f.unlock(profile); }
// Unlocked but not yet tapped: shows a "New!" tag.
function featureIsNew(profile, key) { return featureUnlocked(profile, key) && !(profile.seenFeatures || []).includes(key); }
function markFeatureSeen(profile, key) {
  profile.seenFeatures ??= [];
  if (!profile.seenFeatures.includes(key)) profile.seenFeatures.push(key);
}
// Unlocked since we last looked (for the "New: ..." message): marks them announced.
function newlyUnlocked(profile) {
  profile.announced ??= [];
  const out = FEATURE_KEYS.filter(k => featureUnlocked(profile, k) && !profile.announced.includes(k));
  for (const k of out) profile.announced.push(k);
  return out;
}
// Which toolbar buttons show right now. In a level, boss fight or puzzle,
// the tools the board needs are always shown.
function toolbarFor(profile, ctx = {}) {
  const on = (k) => featureUnlocked(profile, k);
  const needs = ctx.needs || {};
  return {
    wire: true, levels: true, hint: true,
    undo: on("undo") || !!needs.undo, redo: on("undo") || !!needs.undo,
    delete: on("delete") || !!needs.delete,
    build: on("build") || !!needs.build,
    today: on("today"), phone: on("phone"),
  };
}
// What a campaign level needs from the toolbar.
function levelNeeds(level) {
  if (!level) return {};
  const ops = new Set((level.solution || []).map(s => s[0]));
  return { delete: ops.has("u") || (level.board?.wires?.length > 0), build: (level.tool || []).length > 0, undo: true };
}

// --- Today board ---
// ctx holds what only the running game knows: { now, emergency, ordersOpen,
// ordersReady, giftWaiting, puzzleDone, repair }. Each item: { key, icon, text, action, urgent }.
function todayItems(profile, ctx = {}) {
  const items = [];
  if (ctx.emergency) items.push({ key: "emergency", icon: "alarm", urgent: true, text: `EMERGENCY: ${ctx.emergency.name} — ${ctx.emergency.secondsLeft}s left!`, action: "emergency" });
  if (ctx.repair) items.push({ key: "repair", icon: "wx_storm", urgent: true, text: "The storm broke a wire in your town. Fix it for a reward!", action: "hint" });
  // Orders only show here: always a row once unlocked.
  if (featureUnlocked(profile, "orders")) items.push({ key: "orders", icon: "people", orders: true, action: "orders",
    text: ctx.ordersReady ? `Town orders: ${ctx.ordersReady} waiting — finish them for coins and XP.` : "Town orders: none right now — new ones arrive soon." });
  const next = typeof nextLevelIn === "function" ? nextLevelIn(profile, profile.region) : null;
  if (next && levelUnlocked(profile, next).ok) items.push({ key: "level", icon: "star_big", text: `Next level: ${REGIONS[next.world].name} ${next.n} — "${next.title}"`, action: "level", level: next.id });
  else {
    // This world is done: find the next world with an unfinished level.
    const w = REGION_KEYS.find(k => regionStatus(profile, k).ok && nextLevelIn(profile, k));
    if (w) { const lv = nextLevelIn(profile, w); items.push({ key: "level", icon: "star_big", text: `Next level: ${REGIONS[w].name} ${lv.n} — "${lv.title}"`, action: "level", level: lv.id }); }
  }
  const cap = typeof nextCaptain === "function" ? nextCaptain(profile) : null;
  if (cap) {
    const where = REGIONS[cap.key].name, opens = cap.unlocks ? ` to open ${REGIONS[cap.unlocks].name}` : "";
    if (cap.ready) items.push({ key: "captain", icon: "captain", urgent: true, text: `Captain Short Circuit is waiting in ${where}. Beat him${opens}!`, action: "captain", region: cap.key });
    else items.push({ key: "captain", icon: "captain", text: `Captain Short Circuit comes to ${where} at level ${REGIONS[cap.key].bossLevel} (you're level ${playerLvl(profile)}).`, action: null });
  }
  const exp = REGION_KEYS.map(k => typeof expertLevelOf === "function" ? expertLevelOf(k) : null).find(lv => lv && levelUnlocked(profile, lv).ok && !doneLevel(profile, lv.id));
  if (exp) items.push({ key: "expert", icon: "ico_trophy", text: `Expert level open: ${REGIONS[exp.world].name} — "${exp.title.replace(/^Expert: /, "")}"`, action: "level", level: exp.id });
  if (featureUnlocked(profile, "daily")) {
    if (ctx.giftWaiting) items.push({ key: "gift", icon: "chest", text: "Your daily gift is waiting!", action: "daily" });
    if (!ctx.puzzleDone) items.push({ key: "daily", icon: "ico_today", text: "Today's daily puzzle isn't solved yet.", action: "daily" });
  }
  const fresh = notebookCards(profile).filter(c => !(profile.seenCards || []).includes(c.key));
  if (fresh.length) items.push({ key: "notebook", icon: "ico_book", text: `${fresh.length} new card${fresh.length > 1 ? "s" : ""} in your Notebook.`, action: "notebook" });
  if (!items.some(i => !i.orders)) items.unshift({ key: "free", icon: "sparky", text: "All caught up! Build something in your town, or try a time trial.", action: null });
  return items;
}

// --- Engineer's Notebook ---
// A card unlocks with the level that teaches it. `pic` is a texture key; `fig`
// names a small circuit drawing (drawn in src/ui/phone.js).
const NOTEBOOK = [
  { key: "loop", title: "A complete loop", pic: "house", fig: "loop", text: "Power flows out of GEN, through a building, and back to GND. No loop, no light.", when: (p) => doneLevel(p, "sparkville-1") },
  { key: "share", title: "Sharing wires", pic: "house", fig: "parallel", text: "Dots wired together are the same place for electricity, so houses can share wires.", when: (p) => doneLevel(p, "sparkville-4") },
  { key: "load", title: "Too many loads", pic: "gen", text: "One generator only has so much power. More buildings means each gets less.", when: (p) => doneLevel(p, "sparkville-5") },
  { key: "short", title: "Short circuits", pic: "bolt_big", fig: "short", text: "A wire straight past a part is a shortcut: the power skips the part entirely.", when: (p) => doneLevel(p, "sparkville-6") },
  { key: "resistor", title: "Resistors", pic: "res_470", text: "A resistor slows the current down. Bigger ohms (Ω) means less current.", when: (p) => doneLevel(p, "sparkville-7") },
  { key: "led", title: "LEDs need a buddy", pic: "led_on", fig: "led", text: "An LED pops without a resistor in front. One LED + a Medium (470Ω) is just right.", when: (p) => doneLevel(p, "sparkville-8") },
  { key: "switch", title: "Switches", pic: "switch_on", text: "A switch opens or closes the loop. Open loop = no current = dark.", when: (p) => doneLevel(p, "sparkville-10") },
  { key: "capacitor", title: "Capacitors", pic: "cap", text: "A capacitor is a little bucket of charge: it fills up, then lets power out for a moment.", when: (p) => doneLevel(p, "batterybay-1") },
  { key: "battery", title: "Batteries", pic: "battery", text: "A battery is a huge bucket: charge it by day, run your town at night.", when: (p) => doneLevel(p, "batterybay-3") },
  { key: "solar", title: "Solar power", pic: "solar", text: "A solar panel turns sunlight into electricity — more in bright sun, none at night.", when: (p) => doneLevel(p, "solardesert-1") },
  { key: "transformer", title: "Transformers", pic: "xfmr", text: "A transformer steps voltage up (×2) or down (×0.5). Up to travel far, down to use.", when: (p) => doneLevel(p, "mountains-1") },
  { key: "lines", title: "Long lines lose power", pic: "pylon", text: "Long wires waste power as heat. High voltage means less current, so less is lost.", when: (p) => doneLevel(p, "mountains-2") },
  { key: "series", title: "Series (in a row)", pic: "led_on", fig: "series", text: "Parts in a row share the push (voltage) and all carry the same current.", when: (p) => doneLevel(p, "windmill-1") },
  { key: "parallel", title: "Parallel (side by side)", pic: "house", fig: "parallel", text: "Parts side by side each get the full push. Unplug one and the others stay on.", when: (p) => doneLevel(p, "windmill-2") },
  { key: "ohm", title: "Ohm's law", pic: "res_470", text: "Current = voltage ÷ resistance (I = V ÷ R). Double the ohms, half the current.", when: (p) => doneLevel(p, "waterfall-4") },
  { key: "strings", title: "LED strings", pic: "led_on", fig: "series", text: "LEDs in a row can share one resistor. LEDs side by side each need their own.", when: (p) => doneLevel(p, "neon-3") },
  { key: "storage", title: "Long nights", pic: "battery", text: "Use the battery, not the capacitor, to last the night — a capacitor drains in seconds.", when: (p) => doneLevel(p, "tundra-4") },
  { key: "bigloads", title: "Big loads", pic: "bld_hospital", text: "Hungry buildings take more current. Put the most important ones first.", when: (p) => doneLevel(p, "volcano-3") },
  { key: "and", title: "AND logic", pic: "switch_on", fig: "and", text: "Two switches in a row: the light is on only when BOTH are on.", when: (p) => doneLevel(p, "robot-1") },
  { key: "or", title: "OR logic", pic: "switch_on", fig: "or", text: "Two switches side by side: the light is on when EITHER one is on.", when: (p) => doneLevel(p, "robot-2") },
  { key: "backup", title: "Backup power", pic: "battery", text: "A battery beside a building keeps it lit even if the line to GEN is cut.", when: (p) => doneLevel(p, "storm-2") },
  { key: "redundant", title: "Two paths", pic: "pylon", text: "Two paths to GEN and two to GND: cut any one wire and it still works.", when: (p) => doneLevel(p, "storm-5") },
  { key: "plants", title: "Power plants", pic: "plant_hydro", text: "Every plant has a catch: sun only by day, wind only when it blows, fuel costs money.", when: (p) => (p.owned?.plants || []).length > 0 },
  { key: "grid", title: "The power grid", pic: "pylon", text: "Towns joined by power lines share power, like the real grid.", when: (p) => (p.lines || []).length > 0 },
];
function notebookCards(profile) { return NOTEBOOK.filter(c => c.when(profile)); }
function markCardsSeen(profile) {
  profile.seenCards ??= [];
  for (const c of notebookCards(profile)) if (!profile.seenCards.includes(c.key)) profile.seenCards.push(c.key);
}

// --- Records: time trials and no-undo ---
// profile.records[levelId] = { time: best seconds, noUndo: true }
const TIME_TRIAL_REWARD = { coins: 15, xp: 10 };
const NO_UNDO_REWARD = { coins: 25, xp: 15 };
// Record a finished challenge. Returns { coins, xp, newBest, firstNoUndo, time, prev }.
function recordChallenge(profile, levelId, mode, seconds) {
  profile.records ??= {};
  const r = (profile.records[levelId] ??= {});
  const out = { coins: 0, xp: 0, newBest: false, firstNoUndo: false, time: seconds, prev: r.time ?? null };
  if (mode === "time") {
    if (r.time == null || seconds < r.time) {
      out.newBest = true;
      if (r.time == null) { out.coins += TIME_TRIAL_REWARD.coins; out.xp += TIME_TRIAL_REWARD.xp; }
      else { out.coins += 5; }
      r.time = Math.round(seconds * 10) / 10;
    }
  }
  if (mode === "noundo" && !r.noUndo) {
    r.noUndo = true; out.firstNoUndo = true;
    out.coins += NO_UNDO_REWARD.coins; out.xp += NO_UNDO_REWARD.xp;
  }
  return out;
}
function formatTime(s) {
  if (s == null) return "—";
  const m = Math.floor(s / 60), sec = s - m * 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`;
}

// How much of the game you've done: { percent, parts: [{ label, have, of }] }.
function gameProgress(profile) {
  const levels = typeof CAMPAIGN_LEVELS !== "undefined" ? CAMPAIGN_LEVELS : [];
  const stars = levels.reduce((n, l) => n + (profile.campaign?.[l.id] || 0), 0);
  const bosses = REGION_KEYS.filter(k => bossBeaten(profile, k)).length;
  const stickers = Object.keys(profile.stickers || {}).length, stickersOf = typeof STICKERS !== "undefined" ? Object.keys(STICKERS).length : 1;
  const cards = notebookCards(profile).length;
  const challenges = Object.values(profile.records || {}).filter(r => r.noUndo).length;
  const parts = [
    { label: "Level stars", have: stars, of: levels.length * 3, weight: 50 },
    { label: "Captains beaten", have: bosses, of: REGION_KEYS.length, weight: 15 },
    { label: "Notebook cards", have: cards, of: NOTEBOOK.length, weight: 10 },
    { label: "Stickers", have: stickers, of: stickersOf, weight: 10 },
    { label: "No-undo challenges", have: Math.min(challenges, 20), of: 20, weight: 5 },
    { label: "Power plants", have: (profile.owned?.plants || []).length, of: typeof PLANT_KEYS !== "undefined" ? PLANT_KEYS.length - 1 : 9, weight: 5 },
    { label: "Outfits", have: (profile.owned?.outfits || []).length, of: Object.keys(OUTFITS).length, weight: 5 },
  ];
  const percent = Math.floor(parts.reduce((t, p) => t + p.weight * Math.min(1, p.have / Math.max(1, p.of)), 0));
  return { percent, parts };
}
