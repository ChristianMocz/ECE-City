// tests/game.test.mjs
//
// Tests for the game rules (src/rules/game.js) and daily puzzles
// (src/rules/daily.js): coins, XP, levels, unlocks, the shop and wardrobe,
// saving, the daily gift and streaks, weather, the day/night clock, Sparky's
// questions, power orders and storm repairs. Circuits use the real solver.
//
// Run: node tests/game.test.mjs  (or open tests/run-in-browser.html)
// Works as a Node module and a classic script (see tests/sim.test.mjs).
(async () => {
if (typeof computePower === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  for (const f of ["../src/art/pixelart.js", "../src/circuit/solver.js", "../src/circuit/diagnose.js", "../src/rules/missions.js", "../src/rules/game.js", "../src/rules/world.js", "../src/rules/daily.js", "../src/rules/plants.js", "../src/rules/campaign.js", "../src/rules/levels.js"]) {
    const path = resolve(dirname(process.argv[1]), f);
    runInThisContext(readFileSync(path, "utf8"), { filename: path });
  }
}

let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log(`  ok  - ${name}`); }
  catch (e) { fail++; failures.push({ name, error: e }); console.log(`FAIL  - ${name}`); console.log(`        ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || "assertion failed"); }
function eq(a, b, m) { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error(`${m || "not equal"}: got ${A}, want ${B}`); }

function makeState(extra = {}) {
  const s = {
    nodes: new Map(), wires: [], V: 12, R_WIRE: 0.03, R_GEN: 1.5, R_HOUSE: 18, V_LED_F: 2, R_LED_INTERNAL: 10,
    I_LED_GLOW: 0.003, I_LED_BRIGHT: 0.012, I_LED_MAX: 0.025, RES_DEFAULT_OHMS: 470, XFMR_DEFAULT_RATIO: 0.5,
    V_HOUSE_ON: 9, V_HOUSE_DIM: 7, dt: 1 / 30, solverError: false, V_SOLAR: 12, R_SOLAR: 4, solarFactor: 1, BAT_C: 20, loadScale: 1,
    ...extra,
  };
  s.nodes.set("GEN", { id: "GEN", type: "GEN", data: {} });
  s.nodes.set("GND", { id: "GND", type: "GND", data: {} });
  return s;
}
// Build a board from a setup snapshot the way src/scene/board.js places parts.
function fromSetup(setup, extra) {
  const s = makeState(extra);
  for (const p of setup.parts) {
    if (p.kind === "XFMR") {
      s.nodes.set(p.id + "P", { id: p.id + "P", type: "XFMR_PRI", data: { pairId: p.id } });
      s.nodes.set(p.id, { id: p.id, type: "XFMR_SEC", data: { pairId: p.id + "P", ratio: p.ratio ?? 0.5 } });
      continue;
    }
    const d = { pairId: p.id + "b" };
    if (p.kind === "RES") d.ohms = p.ohms ?? 470;
    if (p.kind === "CAP") { d.C = (p.uF ?? 220) * 1e-6 * 9000; d.Vprev = p.Vprev ?? 0; d.uF = p.uF; }
    if (p.kind === "BAT") { d.Vprev = p.Vprev ?? 0; }
    if (p.kind === "TRANS") d.on = p.on ?? true;
    if (p.kind === "HOUSE" && p.building) { const B = BUILDINGS[p.building]; Object.assign(d, { building: p.building, R: B.R, vOn: B.vOn, vDim: B.vDim }); }
    s.nodes.set(p.id, { id: p.id, type: p.kind, data: d });
    s.nodes.set(p.id + "b", { id: p.id + "b", type: p.kind + "_B", data: { pairId: p.id } });
  }
  for (const w of setup.wires) s.wires.push({ a: w.a, b: w.b });
  return s;
}
function addHouse(s, id, building) {
  const d = { pairId: id + "b" };
  if (building) { const B = BUILDINGS[building]; Object.assign(d, { building, R: B.R, vOn: B.vOn, vDim: B.vDim }); }
  s.nodes.set(id, { id, type: "HOUSE", data: d });
  s.nodes.set(id + "b", { id: id + "b", type: "HOUSE_B", data: { pairId: id } });
}
function addPart(s, id, type, data = {}) {
  s.nodes.set(id, { id, type, data: { pairId: id + "b", ...data } });
  s.nodes.set(id + "b", { id: id + "b", type: type + "_B", data: { pairId: id } });
}
const wire = (s, a, b) => s.wires.push({ a, b });
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
function fakeStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }; }

console.log("Levels and unlocks");
test("XP thresholds map to levels; progress runs 0..1 within a level", () => {
  eq([0, 39, 40, 99, 100, 1300, 11799, 11800, 99999].map(levelForXp), [1, 1, 2, 2, 3, 10, 24, 25, 25]);
  eq(MAX_LEVEL, 25);
  for (let i = 1; i < XP_FOR_LEVEL.length; i++) assert(XP_FOR_LEVEL[i] > XP_FOR_LEVEL[i - 1], "XP grows every level");
  eq(levelProgress(0), 0); eq(levelProgress(20), 0.5); eq(levelProgress(99999), 1);
});
test("parts unlock in teaching order: houses, then resistor+LED, switch, capacitor, battery, solar, transformer", () => {
  const order = Object.entries(PARTS).sort((a, b) => a[1].level - b[1].level).map(([k]) => k);
  eq(order, ["HOUSE", "RES", "LED", "TRANS", "CAP", "BAT", "SOLAR", "XFMR"]);
  const p = createProfile();
  assert(partUnlocked(p, "HOUSE") && !partUnlocked(p, "LED"), "level 1: houses only");
  p.xp = 40; assert(partUnlocked(p, "LED") && partUnlocked(p, "RES") && !partUnlocked(p, "TRANS"), "level 2: + resistor, LED");
});
test("addReward levels you up and lists what just unlocked", () => {
  const p = createProfile();
  const r = addReward(p, 10, 45);
  assert(r.leveledUp && r.level === 2, "level 2");
  assert(r.unlocked.includes("Resistor") && r.unlocked.includes("LED") && r.unlocked.includes("Bakery"), JSON.stringify(r.unlocked));
  eq(p.coins, 60, "coins added");
  const r2 = addReward(p, 0, 1000); // jump several levels at once
  assert(r2.unlocked.includes("Switch") && r2.unlocked.includes("Battery"), "every level in between counts");
});
test("streak multiplier: x1, then x2 from 3 in a row, x3 from 6", () => {
  eq([0, 1, 2, 3, 5, 6, 20].map(streakMultiplier), [1, 1, 1, 2, 2, 3, 3]);
});

console.log("Shop and wardrobe");
test("you can't buy what you can't afford, haven't unlocked, or already have", () => {
  const p = createProfile(); // 50 coins, level 1
  assert(/Unlocks at level 2/.test(cannotBuy(p, "building", "bakery")), "locked");
  p.xp = 100; p.coins = 10;
  assert(/50 more coins/.test(cannotBuy(p, "building", "bakery")), cannotBuy(p, "building", "bakery"));
  assert(cannotBuy(p, "building", "house"), "cottages are free, not sold");
  assert(cannotBuy(p, "outfit", "shirt_blue"), "already own the starter shirt");
  assert(cannotBuy(p, "outfit", "nope") && cannotBuy(p, "spaceship", "x"), "unknown items");
});
test("buying takes the coins exactly once and records ownership; clothes are put on", () => {
  const p = createProfile(); p.coins = 100;
  assert(buy(p, "outfit", "hat_cap").ok && p.coins === 75 && p.wearing.hat === "hat_cap", "hat bought and worn");
  assert(!buy(p, "outfit", "hat_cap").ok && p.coins === 75, "can't buy it twice");
  p.xp = 100;
  assert(buy(p, "building", "bakery").ok && p.owned.buildings.bakery === 1 && p.coins === 15, "bakery");
  assert(!buy(p, "building", "bakery").ok && p.coins === 15, "not enough left for a second");
  p.coins = 20; assert(buy(p, "decor", "flowers").ok && p.owned.decor.flowers === 1 && p.coins === 10, "decor");
});
test("wearing: switch items, take a hat off, shirts fall back to the starter shirt", () => {
  const p = createProfile(); p.coins = 500; p.xp = 1000;
  buy(p, "outfit", "hat_cap"); buy(p, "outfit", "hat_crown");
  eq(p.wearing.hat, "hat_crown"); toggleWear(p, "hat_cap"); eq(p.wearing.hat, "hat_cap");
  toggleWear(p, "hat_cap"); eq(p.wearing.hat, null, "took it off");
  buy(p, "outfit", "shirt_labcoat"); toggleWear(p, "shirt_labcoat"); eq(p.wearing.shirt, "shirt_blue");
  assert(!toggleWear(p, "acc_cape"), "can't wear what you don't own");
});
test("bought buildings can only be placed as many times as you own them", () => {
  const p = createProfile(); p.owned.buildings.bakery = 1;
  const s = makeState();
  eq(buildingsAvailable(p, "bakery", s), 1);
  addHouse(s, "H0", "bakery");
  eq(buildingsAvailable(p, "bakery", s), 0);
  eq(buildingsAvailable(p, "house", s), Infinity, "cottages are unlimited");
});

console.log("Saving");
test("save and load round-trip", () => {
  const st = fakeStorage(); const p = createProfile(); p.coins = 148; p.xp = 77; buy(p, "outfit", "hat_cap"); eq(p.coins, 123, "cap cost 25");
  assert(saveProfile(st, p));
  const q = loadProfile(st);
  eq([q.coins, q.xp, q.wearing.hat, q.owned.outfits.includes("hat_cap")], [123, 77, "hat_cap", true]);
});
test("a broken or hacked save never crashes the game", () => {
  const st = fakeStorage();
  st.setItem(SAVE_KEY, "{not json"); eq(loadProfile(st).coins, 50, "corrupt -> fresh start");
  st.setItem(SAVE_KEY, JSON.stringify({ coins: -50, xp: "lots", owned: { outfits: ["hat_crown", "dragon"], buildings: { bakery: 2, castle: 9 } }, wearing: { hat: "hat_wizard", shirt: "dragon" }, orders: "x", daily: { giftDay: "yesterday" } }));
  const p = loadProfile(st);
  eq(p.coins, 0, "no negative coins"); eq(p.xp, 0, "bad xp ignored");
  assert(p.owned.outfits.includes("hat_crown") && !p.owned.outfits.includes("dragon"), "unknown items dropped");
  eq(p.owned.buildings, { bakery: 2 }, "unknown buildings dropped");
  eq(p.wearing.hat, null, "can't wear a hat you don't own"); eq(p.wearing.shirt, "shirt_blue", "bad shirt ignored");
  eq(p.orders, [null, null, null]); eq(p.daily.giftDay, null);
  eq(loadProfile({ getItem() { throw new Error("blocked"); } }).coins, 50, "storage blocked");
  assert(!saveProfile({ setItem() { throw new Error("full"); } }, p), "save failure reported, not thrown");
});

console.log("Daily gift, puzzle streak, weather, day/night");
test("day keys and 'yesterday' across month and year boundaries", () => {
  eq(dayKey(at(2026, 3, 9)), "2026-03-09");
  eq(yesterdayKey(at(2026, 3, 1)), "2026-02-28"); eq(yesterdayKey(at(2027, 1, 1)), "2026-12-31"); eq(yesterdayKey(at(2028, 3, 1)), "2028-02-29");
  eq(dayNumber(at(2026, 10, 5, 23)) - dayNumber(at(2026, 10, 4, 0)), 1);
});
test("login streak grows on consecutive days and resets after a gap", () => {
  const p = createProfile();
  assert(checkLogin(p, at(2026, 10, 1)), "gift waiting"); eq(p.daily.loginStreak, 1);
  checkLogin(p, at(2026, 10, 1, 20)); eq(p.daily.loginStreak, 1, "same day twice");
  checkLogin(p, at(2026, 10, 2)); eq(p.daily.loginStreak, 2);
  checkLogin(p, at(2026, 10, 5)); eq(p.daily.loginStreak, 1, "missed days");
});
test("the gift opens once a day; a longer streak gives more coins", () => {
  const p = createProfile(); checkLogin(p, at(2026, 10, 1));
  const g = openGift(p, at(2026, 10, 1), () => 0.9);
  eq(g, { type: "coins", coins: 20 }); eq(p.coins, 70);
  eq(openGift(p, at(2026, 10, 1, 22), () => 0.9), null, "not twice");
  assert(!checkLogin(p, at(2026, 10, 1)), "no gift waiting");
  for (let d = 2; d <= 9; d++) checkLogin(p, at(2026, 10, d));
  eq(openGift(p, at(2026, 10, 9), () => 0.9).coins, 50, "capped at a 7-day streak bonus");
  const q = createProfile(); checkLogin(q, at(2026, 10, 1));
  const d = openGift(q, at(2026, 10, 1), () => 0.1);
  assert(d.type === "decor" && q.owned.decor[d.key] === 1 && DECOR[d.key].level <= 1, "sometimes a decoration you can use");
});
test("daily puzzle: once a day, streak for consecutive days, same puzzle for everyone on a date", () => {
  const p = createProfile();
  const r1 = completeDailyPuzzle(p, at(2026, 10, 1)); eq([r1.streak, r1.coins, r1.xp], [1, 45, 25]);
  eq(completeDailyPuzzle(p, at(2026, 10, 1, 23)), null, "only once a day");
  assert(puzzleDoneToday(p, at(2026, 10, 1)) && !puzzleDoneToday(p, at(2026, 10, 2)));
  eq(completeDailyPuzzle(p, at(2026, 10, 2)).streak, 2);
  eq(completeDailyPuzzle(p, at(2026, 10, 4)).streak, 1, "skipped a day");
  eq(puzzleIndexFor(at(2026, 10, 4, 1), 12), puzzleIndexFor(at(2026, 10, 4, 23), 12), "same all day");
  const seen = new Set(); for (let d = 0; d < 12; d++) seen.add(puzzleIndexFor(new Date(2026, 0, 1 + d, 12), DAILY_PUZZLES.length));
  eq(seen.size, DAILY_PUZZLES.length, "12 days in a row = every puzzle once");
});
test("weather: same all day, and every kind of weather happens over a year", () => {
  eq(weatherFor(at(2026, 6, 1, 1)).key, weatherFor(at(2026, 6, 1, 23)).key);
  const kinds = {}; for (let d = 0; d < 365; d++) { const k = weatherFor(new Date(2026, 0, 1 + d, 12)).key; kinds[k] = (kinds[k] || 0) + 1; }
  eq(Object.keys(kinds).sort(), ["cloudy", "heat", "normal", "storm", "sunny"]);
  assert(kinds.storm > 15 && kinds.storm < 70, "storms are occasional: " + kinds.storm);
});
test("day/night clock and what it does to the physics", () => {
  eq(clockInfo(0).night, false); eq(clockInfo(159).night, false); eq(clockInfo(160).night, true); eq(clockInfo(239).night, true);
  eq(clockInfo(240).night, false); eq(clockInfo(240).cycle, 1); eq(clockInfo(100).untilSwitch, 60);
  eq(environmentFor(WEATHER.sunny, false), { solarFactor: 1.6, loadScale: 1 });
  eq(environmentFor(WEATHER.sunny, true), { solarFactor: 0, loadScale: 0.7 });
  eq(environmentFor(WEATHER.heat, true).loadScale, 0.7);
  eq(environmentFor(WEATHER.heat, false).loadScale, 0.8);
});

console.log("Sparky's questions");
test("no question when nothing visibly changes", () => {
  eq(pickPrediction(new Map([["H0", "ON"], ["H1", "OFF"]]), new Map([["H0", "ON"], ["H1", "OFF"]])), null);
});
test("asks about what changes, and sometimes about something that stays the same", () => {
  const before = new Map([["H0", "OFF"], ["H1", "ON"]]), after = new Map([["H0", "ON"], ["H1", "ON"]]);
  eq(pickPrediction(before, after, () => 0.9), { targetId: "H0", answer: "brighter", from: "OFF", to: "ON" });
  eq(pickPrediction(before, after, () => 0.1).answer, "same");
  eq(pickPrediction(new Map([["H0", "ON"]]), new Map([["H0", "DIM"]]), () => 0.5).answer, "dimmer");
  eq(pickPrediction(new Map([["L0", "ON"]]), new Map([["L0", "BURNED"]]), () => 0.5).answer, "dimmer", "a popped LED is darker");
});
test("every answer has a one-line explanation that names the building", () => {
  for (const answer of ["brighter", "dimmer", "same"]) for (const action of ["wire", "unwire", "switch-on", "switch-off"]) {
    const t = explainPrediction({ targetId: "H7", answer }, action);
    assert(t.includes("H7") && t.length < 120 && t.startsWith(answer[0].toUpperCase() + answer.slice(1)), t);
    const v = explainPrediction({ targetId: "H7", answer, vFrom: 10.2, vTo: answer === "brighter" ? 11.1 : 9.4 }, action);
    assert(v.includes("H7") && v.length < 140 && v.startsWith(answer[0].toUpperCase() + answer.slice(1)), v);
  }
});
test("a 'same' answer is honest: a small voltage change is called a small change, not 'nothing reached it'", () => {
  const t = explainPrediction({ targetId: "H3", answer: "same", vFrom: 9.6, vTo: 9.3 }, "wire");
  assert(t.includes("changed only a little") && t.includes("9.6 V → 9.3 V"), t);
  const u = explainPrediction({ targetId: "H3", answer: "same", vFrom: 9.6, vTo: 9.6 }, "wire");
  assert(u.includes("nothing reached it"), u);
  const d = explainPrediction({ targetId: "H3", answer: "dimmer", vFrom: 11, vTo: 0 }, "unwire");
  assert(d.startsWith("Dimmer (11.0 V → 0.0 V) — that broke H3's loop"), d);
});
test("scoring: right answers build the streak (3 in a row = double), a wrong one resets it with no penalty", () => {
  const p = createProfile();
  eq([1, 2, 3, 4].map(() => scorePrediction(p, true).coins), [5, 5, 10, 10]);
  const coins = p.coins; const w = scorePrediction(p, false);
  eq([w.coins, p.streak, p.coins], [0, 0, coins], "no penalty"); eq(p.bestStreak, 4);
});

console.log("Power orders");
function townState(n = 3, lit = 1) {
  const s = makeState();
  for (let i = 0; i < n; i++) addHouse(s, "H" + i);
  for (let i = 0; i < lit; i++) { wire(s, "GEN", "H" + i); wire(s, "H" + i + "b", "GND"); }
  computePower(s);
  return s;
}
test("orders read like requests from residents and pay more for bigger jobs", () => {
  const p = createProfile(); const s = townState();
  const seen = new Set();
  for (let i = 0; i < 200; i++) { const o = generateOrder(p, s, seededRandom(i)); seen.add(o.kind); assert(o.text.length > 10 && o.coins > 0 && o.xp > 0 && o.id > 0, JSON.stringify(o)); }
  eq([...seen].sort(), ["light", "lightN", "night"], "level 1: only house orders");
  p.xp = 1300; addHouse(s, "H9", "hospital"); computePower(s);
  for (let i = 0; i < 400; i++) seen.add(generateOrder(p, s, seededRandom(1000 + i)).kind);
  eq([...seen].sort(), ["hold", "leds", "light", "lightN", "night", "nightBattery", "solar", "storage", "switch"], "every kind at level 10");
});
test("a new order is never already complete (no free coins), across 3000 random towns", () => {
  for (let t = 0; t < 3000; t++) {
    const r = seededRandom(t);
    const n = 1 + Math.floor(r() * 5), lit = Math.floor(r() * (n + 1));
    const s = townState(n, lit);
    if (r() < 0.5) { addPart(s, "R0", "RES", { ohms: 470 }); addPart(s, "L0", "LED"); wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND"); computePower(s); }
    const p = createProfile(); p.xp = Math.floor(r() * 1400);
    const night = r() < 0.5;
    const o = generateOrder(p, s, r, { night });
    if (o.kind === "hold" || o.kind === "switch") continue;
    assert(!checkOrder({ ...o }, s, { night, switchCycled: new Set() }), `town ${t}: ${o.text} was already done`);
  }
});
test("checkOrder for every kind", () => {
  const s = townState(2, 1); // H0 lit, H1 dark
  assert(checkOrder({ kind: "light", target: "H0" }, s) && !checkOrder({ kind: "light", target: "H1" }, s));
  assert(checkOrder({ kind: "lightN", n: 1 }, s) && !checkOrder({ kind: "lightN", n: 2 }, s));
  assert(!checkOrder({ kind: "night", target: "H0" }, s, { night: false }) && checkOrder({ kind: "night", target: "H0" }, s, { night: true }));
  assert(checkOrder({ kind: "switch", target: "H0" }, s, { switchCycled: new Set(["H0"]) }) && !checkOrder({ kind: "switch", target: "H0" }, s, { switchCycled: new Set() }));
  assert(!checkOrder({ kind: "storage", target: "H0" }, s), "generator is supplying it");
  const h = { kind: "hold", target: "H0", seconds: 30, progress: 0 };
  for (let i = 0; i < 29; i++) assert(!checkOrder(h, s, { dt: 1 }));
  assert(checkOrder(h, s, { dt: 1 }), "30 seconds lit");
  const h2 = { kind: "hold", target: "H1", seconds: 30, progress: 25 };
  checkOrder(h2, s, { dt: 1 }); eq(h2.progress, 0, "going dark resets the timer");
  const sol = makeState(); addHouse(sol, "H0"); addPart(sol, "S0", "SOLAR"); wire(sol, "S0", "H0"); wire(sol, "H0b", "S0b"); computePower(sol);
  assert(checkOrder({ kind: "solar", target: "H0" }, sol, { night: false }) && checkOrder({ kind: "storage", target: "H0" }, sol), "sunshine only");
  assert(!checkOrder({ kind: "nightBattery", target: "H0" }, sol, { night: true }), "no battery");
  // Sunshine-only still counts while GEN runs the rest of town...
  addHouse(sol, "H1"); wire(sol, "GEN", "H1"); wire(sol, "H1b", "GND"); computePower(sol);
  assert(sol.nodeVoltages.get("GEN") < 12 && checkOrder({ kind: "solar", target: "H0" }, sol, { night: false }), "GEN busy elsewhere");
  assert(!checkOrder({ kind: "solar", target: "H1" }, sol, { night: false }), "H1 runs on GEN, not sunshine");
  assert(!checkOrder({ kind: "solar", target: "H0" }, sol, { night: true }), "not at night");
  // ...and a battery that would carry a building on its own counts at night, even with GEN wired too.
  const bat = makeState(); addHouse(bat, "H0"); addPart(bat, "B0", "BAT", { C: 20, Vprev: 11.5 });
  wire(bat, "GEN", "H0"); wire(bat, "H0b", "GND"); wire(bat, "B0", "H0"); wire(bat, "B0b", "GND"); computePower(bat, 0);
  assert(checkOrder({ kind: "nightBattery", target: "H0" }, bat, { night: true }), "battery could carry it");
  bat.nodes.get("B0").data.Vprev = 0; computePower(bat, 0);
  assert(!checkOrder({ kind: "nightBattery", target: "H0" }, bat, { night: true }), "an empty battery can't");
  eq(bat.nodes.get("B0").data.Vprev !== undefined, true);
  const led = makeState(); addPart(led, "R0", "RES", { ohms: 470 }); addPart(led, "L0", "LED"); wire(led, "GEN", "R0"); wire(led, "R0b", "L0"); wire(led, "L0b", "GND"); computePower(led);
  assert(checkOrder({ kind: "leds", n: 1 }, led) && !checkOrder({ kind: "leds", n: 2 }, led));
});
test("the board fills up, pays out finished orders (with the streak bonus), and refills after a wait", () => {
  const p = createProfile(); const s = townState(3, 1);
  assert(maintainOrders(p, s, 1000, seededRandom(5)) && p.orders.every(Boolean), "three orders");
  p.orders[0] = { kind: "light", target: "H0", coins: 10, xp: 10, id: 99, text: "x" };
  p.streak = 3; const coins = p.coins;
  const done = settleOrders(p, s, 5000);
  eq(done.length, 1); eq(p.coins - coins, 20, "x2 streak bonus"); eq(p.orders[0], null); eq(p.refillAt[0], 5000 + ORDER_REFILL_MS); eq(p.ordersDone, 1);
  assert(!maintainOrders(p, s, 6000, seededRandom(6)) || p.orders[0] === null, "not before the wait");
  eq(p.orders[0], null);
  maintainOrders(p, s, 5000 + ORDER_REFILL_MS, seededRandom(7)); assert(p.orders[0], "refilled");
});
test("an order for a building you deleted disappears (no stuck orders)", () => {
  const p = createProfile(); const s = townState(2, 1);
  p.orders = [{ kind: "light", target: "H1", coins: 1, xp: 1, id: 1, text: "x" }, null, null]; p.refillAt = [0, 99999, 99999];
  s.nodes.delete("H1"); s.nodes.delete("H1b");
  maintainOrders(p, s, 100, seededRandom(1));
  assert(!p.orders[0] || p.orders[0].target !== "H1", "dropped");
});
test("skip an order", () => {
  const p = createProfile(); p.orders = [{ kind: "lightN", n: 9, id: 1 }, null, null];
  assert(skipOrder(p, 0, 100) && p.orders[0] === null && p.refillAt[0] === 100 + ORDER_REFILL_MS);
  assert(!skipOrder(p, 1, 100), "nothing to skip");
});
test("storms knock down only a working wire, once per day/night cycle, and the repair is a wire back between the same dots", () => {
  const p = createProfile();
  eq(pickStormWire(p, [{ a: "GEN", b: "H0", amps: 0.01 }], 0), null, "no busy wire");
  const r = pickStormWire(p, [{ a: "GEN", b: "H0", amps: 0.6 }, { a: "H0b", b: "GND", amps: 0.6 }], 0, () => 0);
  eq([r.a, r.b], ["GEN", "H0"]);
  eq(pickStormWire(p, [{ a: "X", b: "Y", amps: 1 }], 1), null, "not while a repair is waiting");
  p.repair = null; eq(pickStormWire(p, [{ a: "X", b: "Y", amps: 1 }], 0), null, "not twice in a cycle");
  p.repair = { a: "GEN", b: "H0" };
  assert(!repairDone(p, [{ a: "H0b", b: "GND" }]) && repairDone(p, [{ a: "H0", b: "GEN" }]), "either direction");
});

console.log("Daily puzzles");
for (const [i, pz] of DAILY_PUZZLES.entries()) {
  test(`puzzle ${i + 1} "${pz.title}": not solved at the start, solved by its solution`, () => {
    const s = fromSetup(pz.setup);
    computePower(s, 0);
    assert(!pz.check(s, {}), "already solved at the start");
    for (const [op, a, b] of pz.solution) {
      if (op === "wire") s.wires.push({ a, b });
      else if (op === "unwire") { const n = s.wires.length; s.wires = s.wires.filter(w => !((w.a === a && w.b === b) || (w.a === b && w.b === a))); assert(s.wires.length === n - 1, `no wire ${a}-${b}`); }
      else if (op === "flip") s.nodes.get(a).data.on = !s.nodes.get(a).data.on;
      for (const id of [a, b]) if (id) assert(s.nodes.has(id), `unknown id ${id}`);
    }
    computePower(s, 0);
    assert(pz.check(s, {}), "solution doesn't solve it");
    for (const p of pz.setup.parts) assert(PARTS[p.kind] || p.kind === "HOUSE", "known part " + p.kind);
  });
}

console.log("Save files");
test("three save files: slot 1 is the old save; each slot keeps its own game", () => {
  const st = fakeStorage();
  eq(currentSlot(st), 1, "slot 1 by default");
  const a = createProfile(); a.coins = 111; saveProfile(st, a);           // no slot given means slot 1
  assert(st._m.has(SAVE_KEY), "slot 1 uses the original key");
  const b = createProfile(); b.coins = 222; b.xp = 1300; saveProfile(st, b, 2);
  eq([loadProfile(st, 1).coins, loadProfile(st, 2).coins, loadProfile(st, 3).coins], [111, 222, 50], "separate games; an empty slot is a new game");
  assert(setCurrentSlot(st, 2)); eq(currentSlot(st), 2);
  assert(!setCurrentSlot(st, 4)); eq(currentSlot(st), 2, "only 1..3");
  st.setItem("ececity.slot", "banana"); eq(currentSlot(st), 1, "junk falls back to slot 1");
});
test("the title screen's summary of each slot", () => {
  const st = fakeStorage();
  eq(slotSummary(st, 2), null, "empty");
  const p = createProfile(); p.xp = 1300; p.coins = 77; p.region = "batterybay"; p.campaign = { "sparkville-1": 3, "sparkville-2": 2 };
  saveProfile(st, p, 2);
  const sum = slotSummary(st, 2);
  eq([sum.slot, sum.level, sum.coins, sum.region, sum.stars], [2, 10, 77, "batterybay", 5]);
  assert(sum.savedAt > 0 && sum.wearing && sum.sidekick, "has a time and the outfit");
  st.setItem(SAVE_KEY + ".slot3", "{not json"); eq(slotSummary(st, 3), null, "a broken save shows as empty");
});
test("erasing a slot removes only that slot (and its missions)", () => {
  const st = fakeStorage();
  saveProfile(st, createProfile(), 1); saveProfile(st, createProfile(), 2);
  st.setItem("ececity.missionsDone.slot2", "[1]"); st.setItem("ececity.missionsDone", "[0]");
  assert(eraseSlot(st, 2));
  eq([!!st.getItem(SAVE_KEY), !!st.getItem(SAVE_KEY + ".slot2"), st.getItem("ececity.missionsDone"), st.getItem("ececity.missionsDone.slot2")], [true, false, "[0]", null]);
  assert(!eraseSlot(st, 0), "not a slot");
});
test("the new save fields have safe defaults and drop junk", () => {
  const p = normalizeProfile({ settings: { music: false, emergencies: false }, population: { sparkville: 12.7, moon: -4, mars: 9 }, fuelCycle: "x", coalPaid: false, emergenciesDone: 3.9 });
  eq([p.settings.music, p.settings.emergencies, p.settings.sparky], [false, false, true]);
  eq(p.population, { sparkville: 12 });
  eq([p.fuelCycle, p.coalPaid, p.emergenciesDone], [-1, false, 3]);
  const q = normalizeProfile(null);
  eq([q.settings.music, q.settings.emergencies, q.campaign, q.lines, q.plantIn, q.owned.plants], [true, true, {}, [], {}, []]);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) process.exitCode = 1;
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "game", pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) });
})();
