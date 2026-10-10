// tests/emergencies.test.mjs
//
// Tests for the twelve emergencies (src/rules/emergencies.js). On a town where
// it fits, each one must really break something (or ask for something new)
// and be fixable the way a player would fix it.
//
// Run: node tests/emergencies.test.mjs  (or open tests/run-in-browser.html)
(async () => {
if (typeof computePower === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  for (const f of ["../src/art/pixelart.js", "../src/rules/game.js", "../src/rules/world.js", "../src/rules/plants.js", "../src/circuit/solver.js", "../src/circuit/diagnose.js", "../src/rules/campaign.js", "../src/rules/levels.js", "../src/rules/emergencies.js"]) {
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

// A busy test town: a hospital, two houses, an LED with its resistor, a
// switch on one house, a charged battery and a solar panel running a house.
const TOWN = {
  parts: parseParts("H0@330,260:hospital H1@480,260 T0@600,250 H2@720,260 R0@330,430:470 L0@450,440 B0@560,470:12 S0@680,470 H3@790,450"),
  wires: parseWires("GEN-H0 H0b-GND GEN-H1 H1b-GND GEN-T0 T0b-H2 H2b-GND GEN-R0 R0b-L0 L0b-GND GEN-B0 B0b-GND S0-H3 H3b-S0b"),
};
const profile = (() => { const p = createProfile(); p.xp = XP_FOR_LEVEL[9]; return p; })();
function town(snap = TOWN, env = {}) { const s = circuitFromSnapshot(snap, { R_GEN: 0.7, ...env }); computePower(s, 0); return s; }
const rngOf = (seed) => seededRandom(seed);
const same = (w, a, b) => (w.a === a && w.b === b) || (w.a === b && w.b === a);
function startOn(s, plan) {
  applyEmergencyActions(s, plan.actions);
  if (plan.env) Object.assign(s, plan.env);
  computePower(s, 0);
}
const solved = (s, plan, dt = 0) => checkEmergency(s, plan, dt);
// Emergencies you must hold for N seconds: run the clock.
function hold(s, plan, seconds) { let ok = false; for (let i = 0; i < seconds * 10 + 5 && !ok; i++) { computePower(s, 0.1); ok = solved(s, plan, 0.1); } return ok; }

console.log("Every emergency");
test("there are twelve, each with a name, an icon, a time limit and a plan", () => {
  eq(EMERGENCY_KEYS.length, 12);
  for (const k of EMERGENCY_KEYS) { const E = EMERGENCIES[k]; assert(E.name && E.icon && E.seconds >= 25 && typeof E.plan === "function" && typeof E.check === "function", k); }
});
test("the test town is lit to start with", () => {
  const s = town();
  for (const id of ["H0", "H1", "H2", "H3", "L0"]) eq(s.powered.get(id).level, "ON", id);
});
const fixes = {
  hospital: (s, p) => { undoEmergencyActions(s, p.actions); },
  squirrel: (s, p) => { undoEmergencyActions(s, p.actions); },
  tree: (s, p) => { undoEmergencyActions(s, p.actions); },
  heatspike: (s, p) => { s.wires = s.wires.filter(w => !same(w, "GEN", "H1") && !same(w, "GEN", "T0") && !same(w, "GEN", "B0")); },
  surge: (s, p) => { for (const id of p.lit) s.nodes.get(id).data.burned = false; },
  stuckswitch: (s, p) => { s.nodes.get(p.target).data.on = true; },
  shortcut: (s, p) => { undoEmergencyActions(s, p.actions); },
  overheat: (s, p) => { s.wires = s.wires.filter(w => !same(w, "GEN", "H1") && !same(w, "GEN", "T0")); },
  sciencefair: (s, p) => { addPartToCircuit(s, { kind: "RES", id: "R9", x: 0, y: 0, ohms: 470 }); addPartToCircuit(s, { kind: "LED", id: "L9", x: 0, y: 0 }); s.wires.push({ a: "GEN", b: "R9" }, { a: "R9b", b: "L9" }, { a: "L9b", b: "GND" }); },
  gremlin: (s, p) => { undoEmergencyActions(s, p.actions); },
  drained: (s, p) => { for (let i = 0; i < 300; i++) computePower(s, 0.1); },
  eclipse: (s, p) => { s.wires = s.wires.filter(w => !same(w, "S0", "H3") && !same(w, "H3b", "S0b")); s.wires.push({ a: "GEN", b: "H3" }, { a: "H3b", b: "GND" }); },
};
for (const key of EMERGENCY_KEYS) {
  test(`${EMERGENCIES[key].name}: fits the test town, breaks it, and can be fixed`, () => {
    // Overheating needs the GEN doing all the work, with no battery helping.
    const s = key === "overheat" ? town({ parts: TOWN.parts.filter(p => p.id !== "B0"), wires: TOWN.wires.filter(w => w.a !== "B0" && w.b !== "B0b" && w.b !== "B0") }) : town();
    const plan = pickEmergency(s, profile, rngOf(7), key);
    assert(plan, "offered");
    eq(plan.key, key);
    assert(plan.text && plan.text.length > 20, "explains itself");
    startOn(s, plan);
    assert(!solved(s, plan, 0), "not already fixed");
    fixes[key](s, plan);
    computePower(s, 0);
    const ok = EMERGENCIES[key].hold ? hold(s, plan, EMERGENCIES[key].hold) : (solved(s, plan, 0) || hold(s, plan, 2));
    assert(ok, "fixed");
  });
}
test("emergencies that don't fit a town aren't offered there", () => {
  const empty = town({ parts: parseParts("H0@450,260"), wires: [] });
  for (const k of ["hospital", "squirrel", "tree", "surge", "stuckswitch", "gremlin", "drained", "eclipse", "overheat", "heatspike", "shortcut"]) eq(pickEmergency(empty, profile, rngOf(1), k), null, k);
  const low = createProfile();
  eq(pickEmergency(town(), low, rngOf(1), "sciencefair"), null, "no LEDs before level 2");
  eq(pickEmergency(town(TOWN, { solarFactor: 0 }), profile, rngOf(1), "eclipse"), null, "no eclipse at night");
});
test("a random pick always gives a working emergency for this town", () => {
  for (let seed = 1; seed < 60; seed++) {
    const s = town();
    const plan = pickEmergency(s, profile, rngOf(seed));
    assert(plan && EMERGENCIES[plan.key], "picked " + seed);
    startOn(s, plan);
    assert(EMERGENCIES[plan.key].hold || !solved(s, plan, 0), `${plan.key} (seed ${seed}) starts unsolved`);
  }
});
test("undoing a plan's board changes puts the town back exactly", () => {
  for (const key of ["hospital", "squirrel", "tree", "shortcut", "gremlin", "stuckswitch"]) {
    const s = town(), before = JSON.stringify(s.wires.map(w => [w.a, w.b].sort().join("|")).sort());
    const plan = pickEmergency(s, profile, rngOf(3), key);
    applyEmergencyActions(s, plan.actions); undoEmergencyActions(s, plan.actions);
    eq(JSON.stringify(s.wires.map(w => [w.a, w.b].sort().join("|")).sort()), before, key);
  }
});
test("heat spike: the building it picks could always be lit on its own", () => {
  for (const b of Object.keys(BUILDINGS)) {
    const s = town({ parts: parseParts(`H0@450,260:${b}`), wires: parseWires("GEN-H0 H0b-GND") });
    if (BUILDINGS[b].bigPlant) { s.R_GEN = PLANTS.fusion.R; computePower(s, 0); } // the stadium needs a big plant
    const plan = pickEmergency(s, profile, rngOf(2), "heatspike");
    assert(plan, b);
    startOn(s, plan);
    assert(hold(s, plan, 15), b + " stays lit alone through the spike");
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) process.exitCode = 1;
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "emergencies", ...{ pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) } });
})();
