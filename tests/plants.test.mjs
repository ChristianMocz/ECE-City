// tests/plants.test.mjs
//
// Tests for power plants and power lines (src/rules/plants.js), using the
// real solver: each plant's catch, buying and using plants, the GEN's one-way
// valve (a battery never drains back into a weak plant), building lines, the
// "% lost" figure, and towns sharing power.
//
// Run: node tests/plants.test.mjs  (or open tests/run-in-browser.html)
(async () => {
if (typeof computePower === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  for (const f of ["../src/art/pixelart.js", "../src/rules/game.js", "../src/rules/world.js", "../src/rules/plants.js", "../src/circuit/solver.js", "../src/circuit/diagnose.js"]) {
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

function circuit(extra = {}) {
  const s = { nodes: new Map(), wires: [], V: 12, R_WIRE: 0.03, R_GEN: 1.5, R_HOUSE: 18, V_LED_F: 2, R_LED_INTERNAL: 10,
    I_LED_GLOW: 0.003, I_LED_BRIGHT: 0.012, I_LED_MAX: 0.025, V_HOUSE_ON: 9, V_HOUSE_DIM: 7, dt: 1 / 30,
    V_SOLAR: 12, R_SOLAR: 4, solarFactor: 1, BAT_C: 20, loadScale: 1, solverError: false, ...extra };
  s.nodes.set("GEN", { id: "GEN", type: "GEN", data: {} }); s.nodes.set("GND", { id: "GND", type: "GND", data: {} });
  return s;
}
function part(s, id, type, data = {}) {
  s.nodes.set(id, { id, type, data: { pairId: id + "b", ...data } });
  s.nodes.set(id + "b", { id: id + "b", type: type + "_B", data: { pairId: id } });
}
const house = (s, id) => part(s, id, "HOUSE", { R: 18, vOn: 9, vDim: 7 });
const wire = (s, a, b) => s.wires.push({ a, b });
const lvl = (s, id) => s.powered.get(id)?.level;
const atLevel = (l) => { const p = createProfile(); p.xp = XP_FOR_LEVEL[l - 1]; return p; };
const allOpen = (p) => { for (const k of REGION_KEYS) (p.bossWins[k] = p.bossWins[k] || {}).easy = true; };
function housesOnGen(n, { R_GEN = 1.5, genScale = 1 } = {}) {
  const s = circuit({ R_GEN, genScale });
  for (let i = 0; i < n; i++) { house(s, "H" + i); wire(s, "GEN", "H" + i); wire(s, "H" + i + "b", "GND"); }
  computePower(s, 0);
  return s;
}

console.log("The plants");
test("ten plants, from the little generator up to fusion, each bigger and later than the last few", () => {
  eq(PLANT_KEYS, ["generator", "solarfarm", "wind", "hydro", "coal", "nuclear", "geothermal", "biogas", "tidal", "fusion"]);
  for (const k of PLANT_KEYS) { const P = PLANTS[k]; assert(P.name && P.good && P.catchText && P.sprite && P.R > 0 && P.level >= 1 && P.level <= MAX_LEVEL, k); }
  for (const k of PLANT_KEYS.slice(1)) assert(PLANTS[k].R < PLANTS.generator.R && PLANTS[k].price > 0, k + " is bigger than the little generator");
  assert(PLANTS.fusion.R === Math.min(...PLANT_KEYS.map(k => PLANTS[k].R)), "fusion is the biggest");
  for (const k of REGION_KEYS) if (REGIONS[k].plant) assert(PLANTS[REGIONS[k].plant], k + "'s plant exists");
});
test("a bigger plant keeps more houses bright (the little generator manages 3)", () => {
  assert(["ON", "ON", "ON"].every((x, i) => lvl(housesOnGen(3), "H" + i) === "ON"), "3 on the little generator");
  assert(lvl(housesOnGen(5), "H0") !== "ON", "5 is too many for it");
  eq(lvl(housesOnGen(5, { R_GEN: PLANTS.hydro.R }), "H0"), "ON", "the hydro dam runs 5");
  eq(lvl(housesOnGen(12, { R_GEN: PLANTS.fusion.R }), "H0"), "ON", "fusion runs 12");
});
test("no plant ever pushes more than 12 V, so a Medium resistor keeps an LED safe on any of them", () => {
  for (const k of PLANT_KEYS) for (const env of [{}, { night: true }, { weatherKey: "sunny", solarFactor: 1.6 }, { weatherKey: "storm" }, { region: "volcano" }, { region: "storm", tideT: 0 }, { population: 999 }, { warm: 999 }]) {
    const a = plantAvail(k, env); assert(a >= 0 && a <= 1, `${k} ${JSON.stringify(env)}: ${a}`);
    const s = circuit({ R_GEN: PLANTS[k].R, genScale: a });
    part(s, "R0", "RES", { ohms: 470 }); part(s, "L0", "LED"); wire(s, "GEN", "R0"); wire(s, "R0b", "L0"); wire(s, "L0b", "GND");
    computePower(s, 0);
    assert(!s.nodes.get("L0").data.burned, `${k} ${JSON.stringify(env)} popped an LED`);
  }
});

console.log("Each plant's catch");
test("solar farm: full in sunshine, weak under clouds, nothing at night", () => {
  eq(plantAvail("solarfarm", { solarFactor: 1.6 }), 1); eq(plantAvail("solarfarm", { solarFactor: 0.5 }), 0.5); eq(plantAvail("solarfarm", { night: true, solarFactor: 1 }), 0);
});
test("wind turbine: follows the wind, brakes in a storm, and there's no wind on the Moon", () => {
  assert(plantAvail("wind", { wind: 1 }) > plantAvail("wind", { wind: 0.3 }), "windier = more");
  eq(plantAvail("wind", { wind: 1, weatherKey: "storm" }), 0.3);
  eq(windFor(new Date(2026, 9, 5), "moon"), 0);
  eq(plantAvail("wind", { wind: windFor(new Date(2026, 9, 5), "moon") }), 0);
  const d = new Date(2026, 9, 5);
  eq(windFor(d, "windmill"), windFor(new Date(2026, 9, 5, 18), "windmill"), "the same wind all day");
  let more = 0; for (let i = 0; i < 60; i++) { const day = new Date(2026, 0, 1 + i); if (windFor(day, "windmill") >= windFor(day, "sparkville")) more++; }
  eq(more, 60, "Windmill Valley is always at least as windy");
});
test("hydro: steady, low in a heat wave, nothing without a river", () => {
  eq(plantAvail("hydro", { region: "sparkville" }), 1); eq(plantAvail("hydro", { region: "sparkville", weatherKey: "heat" }), 0.7);
  eq(plantAvail("hydro", { region: "solardesert" }), 0); eq(plantAvail("hydro", { region: "moon" }), 0);
});
test("coal: full power when paid, half when you're out of coal money", () => {
  eq(plantAvail("coal", {}), 1); eq(plantAvail("coal", { coalPaid: false }), 0.5);
});
test("nuclear: warms up over 45 seconds", () => {
  eq(plantAvail("nuclear", { warm: 0 }), 0); eq(plantAvail("nuclear", { warm: 22.5 }), 0.5); eq(plantAvail("nuclear", { warm: 100 }), 1);
});
test("geothermal: full on Volcano Island, 60% elsewhere", () => {
  eq(plantAvail("geothermal", { region: "volcano" }), 1); eq(plantAvail("geothermal", { region: "sparkville" }), 0.6);
});
test("biogas: more people, more power", () => {
  eq(plantAvail("biogas", { population: 0 }), 0.3); assert(plantAvail("biogas", { population: 40 }) > 0.7); eq(plantAvail("biogas", { population: 500 }), 1);
});
test("tidal: only by the sea, strongest at high tide", () => {
  eq(plantAvail("tidal", { region: "sparkville" }), 0);
  eq(plantAvail("tidal", { region: "storm", tideT: 0 }), 1);
  assert(plantAvail("tidal", { region: "storm", tideT: 0.125 }) < 0.6, "low tide");
});
test("every plant has a plain status line", () => {
  for (const k of PLANT_KEYS) { const t = plantStatusText(k, { region: "sparkville", wind: 0.5, solarFactor: 1 }); assert(t.startsWith(PLANTS[k].name) && /%/.test(t), t); }
  assert(/no sea here/.test(plantStatusText("tidal", { region: "sparkville" })));
  assert(/night/.test(plantStatusText("solarfarm", { night: true })));
});

console.log("The generator's one-way valve");
test("a full battery on the GEN dot never drains back into a weak plant", () => {
  for (const genScale of [0, 0.3, 0.7]) {
    const s = circuit({ genScale });
    part(s, "B0", "BAT", { C: 20, Vprev: 12 }); house(s, "H0");
    wire(s, "GEN", "B0"); wire(s, "B0b", "GND"); wire(s, "GEN", "H0"); wire(s, "H0b", "GND");
    computePower(s, 0);
    for (let i = 0; i < 30; i++) computePower(s, 1 / 30);
    eq(genAmps(s), 0, "no current from the plant");
    assert(s.genOff, "valve shut");
    eq(lvl(s, "H0"), "ON", "the battery runs the house");
    const v = s.nodes.get("B0").data.Vprev;
    assert(v > 11.8, `battery only feeds the house (${v.toFixed(2)} V)`);
  }
});
test("…and the valve opens again when the plant can push", () => {
  const s = circuit({ genScale: 1 });
  part(s, "B0", "BAT", { C: 20, Vprev: 6 }); wire(s, "GEN", "B0"); wire(s, "B0b", "GND");
  computePower(s, 0);
  assert(!s.genOff && genAmps(s) > 0.5, "charging from the plant");
});
test("a dead plant on its own lights nothing (and doesn't crash)", () => {
  const s = housesOnGen(2, { genScale: 0 });
  assert(!s.solverError, "solves"); eq(lvl(s, "H0"), "OFF");
});
test("the valve doesn't change anything with the normal generator (charging, a capacitor lamp)", () => {
  const s = circuit();
  part(s, "C0", "CAP", { C: 220e-6 * 9000, Vprev: 0 }); wire(s, "GEN", "C0"); wire(s, "C0b", "GND");
  computePower(s, 0); for (let i = 0; i < 90; i++) computePower(s, 1 / 30);
  assert(s.nodes.get("C0").data.Vprev > 7, "charges as before");
});

console.log("Buying and using plants");
test("buy once, use in any town; locked by level; not twice", () => {
  const p = atLevel(10); p.coins = 1000;
  assert(/level 12/.test(cannotBuyPlant(p, "hydro")), "hydro locked");
  eq(buyPlant(p, "wind", "sparkville"), { ok: true });
  eq([p.coins, p.owned.plants, p.plantIn.sparkville], [820, ["wind"], "wind"]);
  assert(/already/.test(cannotBuyPlant(p, "wind")));
  eq(plantOf(p, "batterybay"), "generator", "other towns keep theirs");
  assert(usePlant(p, "wind", "batterybay")); eq(plantOf(p, "batterybay"), "wind");
  assert(!usePlant(p, "fusion", "sparkville"), "not owned");
  assert(usePlant(p, "generator", "sparkville")); eq(plantOf(p, "sparkville"), "generator");
  const poor = atLevel(10); poor.coins = 10; assert(/more coins/.test(cannotBuyPlant(poor, "wind")));
  assert(/isn't for sale/.test(cannotBuyPlant(p, "generator")));
});
test("plants and lines survive saving; junk is dropped", () => {
  const p = atLevel(12); p.coins = 5000; allOpen(p);
  buyPlant(p, "hydro", "waterfall"); buildLine(p, "sparkville", "batterybay", 10);
  const q = normalizeProfile(JSON.parse(JSON.stringify(p)));
  eq([q.owned.plants, q.plantIn, q.lines], [["hydro"], { waterfall: "hydro" }, [{ a: "sparkville", b: "batterybay", ratio: 10 }]]);
  const r = normalizeProfile({ owned: { plants: ["hydro", "warp", "generator"] }, plantIn: { sparkville: "fusion", waterfall: "hydro" }, lines: [{ a: "sparkville", b: "moon", ratio: 10 }, { a: "sparkville", b: "batterybay", ratio: 3 }, { a: "batterybay", b: "sparkville", ratio: 5 }, { a: "sparkville", b: "batterybay", ratio: 10 }] });
  eq([r.owned.plants, r.plantIn, r.lines], [["hydro"], { waterfall: "hydro" }, [{ a: "batterybay", b: "sparkville", ratio: 5 }]]);
});

console.log("Power lines");
test("lines join neighbours on the map route only", () => {
  assert(lineNeighbours("sparkville", "batterybay") && lineNeighbours("mountains", "windmill") && lineNeighbours("storm", "moon"));
  assert(!lineNeighbours("sparkville", "solardesert") && !lineNeighbours("sparkville", "moon"));
});
test("stepping up loses far less: 57% → 5% → 1%", () => {
  eq([1, 5, 10].map(lineLossPercent), [57, 5, 1]);
  eq([1, 5, 10].map(lineR), [8, 0.32, 0.08]);
});
test("building a line: both towns open, coins, upgrade, no rebuilding the same", () => {
  const p = atLevel(10); p.coins = 1000;
  assert(/still locked/.test(cannotBuildLine(p, "sparkville", "batterybay", 1)), "Battery Bay locked (no boss win)");
  allOpen(p);
  assert(/next to each other/.test(cannotBuildLine(p, "sparkville", "solardesert", 1)));
  eq(buildLine(p, "sparkville", "batterybay", 1), { ok: true }); eq(p.coins, 1000 - LINE_RATIOS[1].price);
  assert(/already built/.test(cannotBuildLine(p, "batterybay", "sparkville", 1)));
  eq(buildLine(p, "batterybay", "sparkville", 10), { ok: true }); eq(p.lines, [{ a: "sparkville", b: "batterybay", ratio: 10 }], "upgraded in place");
  const poor = atLevel(10); allOpen(poor); poor.coins = 5; assert(/more coins/.test(cannotBuildLine(poor, "sparkville", "batterybay", 5)));
});
test("joined towns share their plants: more capacity, and a working plant covers a dead one", () => {
  const p = atLevel(25); p.coins = 99999; allOpen(p);
  const env = () => ({});
  const alone = gridSupply(p, "sparkville", env);
  eq([alone.genScale, alone.R], [1, 1.5]);
  buildLine(p, "sparkville", "batterybay", 10);
  const joined = gridSupply(p, "sparkville", env);
  assert(joined.R < 0.8 && joined.genScale === 1, `two little generators in parallel: R ${joined.R}`);
  // Sparkville on a solar farm at night, joined to a working generator.
  buyPlant(p, "solarfarm", "sparkville");
  const night = gridSupply(p, "sparkville", () => ({ night: true }));
  assert(night.genScale > 0.9, `the neighbour keeps it going (${night.genScale.toFixed(2)})`);
  // A chain reaches further, with more line on the way.
  buildLine(p, "batterybay", "solardesert", 1);
  const linked = linkedTowns(p, "sparkville");
  eq(linked.map(t => t.region).sort(), ["batterybay", "solardesert"]);
  eq(+linked.find(t => t.region === "solardesert").R.toFixed(2), 8.08);
});
test("a plain 12 V line barely helps; a ×10 line nearly doubles the power", () => {
  const p = atLevel(25); allOpen(p); p.coins = 9999;
  const lit = (q) => { const g = gridSupply(q, "sparkville", () => ({})); return lvl(housesOnGen(5, { R_GEN: g.R, genScale: g.genScale }), "H0"); };
  eq(lit(p), "DIM", "5 houses: too many alone");
  const plain = JSON.parse(JSON.stringify(p)); buildLine(plain, "sparkville", "batterybay", 1);
  eq(lit(plain), "DIM", "a lossy line doesn't save them");
  const up = JSON.parse(JSON.stringify(p)); buildLine(up, "sparkville", "batterybay", 10);
  eq(lit(up), "ON", "a stepped-up line does");
});

console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) process.exitCode = 1;
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "plants", ...{ pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) } });
})();
