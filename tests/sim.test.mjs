// tests/sim.test.mjs
//
// Tests for the circuit solver (src/circuit/solver.js). Each test checks the
// solver against a textbook formula (series, parallel, divider) or a rule
// that must always hold (power is conserved, capacitors charge steadily,
// open circuits carry no current). LEDs, transistors, batteries and solar too.
//
// Part ids: each two-lead part is `${id}` (supply side) and `${id}b` (ground
// side), linked by data.pairId, the same way src/scene/board.js places parts.
//
// Run: node tests/sim.test.mjs  (or open tests/run-in-browser.html)

// The whole file sits in one async function so it works as a Node ES module
// and as a classic <script> (browsers won't load modules from file://).
// In the browser the solver is already loaded; under Node we load it here.
(async () => {
if (typeof computePower === "undefined" && typeof process !== "undefined" && process.versions?.node) {
  const { readFileSync } = await import("node:fs");
  const { runInThisContext } = await import("node:vm");
  const { resolve, dirname } = await import("node:path");
  // No import.meta in a classic script, so find src/ from the test file's path.
  const simPath = resolve(dirname(process.argv[1]), "../src/circuit/solver.js");
  runInThisContext(readFileSync(simPath, "utf8"), { filename: simPath });
}

// --- Tiny test harness ---
let pass = 0, fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    fail++;
    failures.push({ name, error: e });
    console.log(`FAIL  - ${name}`);
    console.log(`        ${e.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}
function assertClose(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg || "values not close"}: expected ${expected}, got ${actual} (tol ${tol})`);
  }
}

// --- Test circuits ---
function makeState(overrides = {}) {
  return {
    nodes: new Map(),
    wires: [],
    V: 12.0,
    R_WIRE: 0.03,
    R_GEN: 1.5,
    R_HOUSE: 18,
    V_LED_F: 2.0,
    R_LED_INTERNAL: 10,
    I_LED_GLOW: 0.003,
    I_LED_BRIGHT: 0.012,
    I_LED_MAX: 0.025,
    RES_DEFAULT_OHMS: 470,
    XFMR_DEFAULT_RATIO: 0.5,
    V_HOUSE_ON: 9.0,
    V_HOUSE_DIM: 7.0,
    dt: 1 / 30,
    solverError: false,
    ...overrides,
  };
}

function addGenGnd(state) {
  state.nodes.set("GEN", { id: "GEN", type: "GEN", data: {} });
  state.nodes.set("GND", { id: "GND", type: "GND", data: {} });
}
function wire(state, a, b) { state.wires.push({ a, b }); }

// Adds a two-lead part: `id` on the supply side, `id+"b"` on the ground side.
function addPart(state, id, type, extraData = {}) {
  const bId = id + "b";
  state.nodes.set(id, { id, type, data: { pairId: bId, ...extraData } });
  state.nodes.set(bId, { id: bId, type: type + "_B", data: { pairId: id } });
  return bId;
}
function addXfmr(state, priId, secId, ratio) {
  state.nodes.set(priId, { id: priId, type: "XFMR_PRI", data: {} });
  state.nodes.set(secId, { id: secId, type: "XFMR_SEC", data: { pairId: priId, ratio } });
}

// --- Series resistance ---
console.log("Series resistance");
test("two resistors in series match R_GEN + wires + R1 + R2", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 2 });
  addPart(s, "R2", "RES", { ohms: 3 });
  wire(s, "GEN", "R1");
  wire(s, "R1b", "R2");
  wire(s, "R2b", "GND");

  computePower(s);

  const Rtotal = s.R_GEN + 3 * s.R_WIRE + 2 + 3;
  const Iexpected = s.V / Rtotal;
  const Vgen = s.nodeVoltages.get("GEN");
  const Iactual = (s.V - Vgen) / s.R_GEN;

  assertClose(Iactual, Iexpected, 1e-9, "loop current should match textbook series formula");
  assert(!s.solverError, "should solve cleanly");
});

// --- Parallel resistance ---
console.log("Parallel resistance");
test("two resistor branches match textbook parallel formula", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 4 });
  addPart(s, "R2", "RES", { ohms: 12 });
  wire(s, "GEN", "R1"); wire(s, "R1b", "GND");
  wire(s, "GEN", "R2"); wire(s, "R2b", "GND");

  computePower(s);

  const path1 = 2 * s.R_WIRE + 4;
  const path2 = 2 * s.R_WIRE + 12;
  const Rparallel = 1 / (1 / path1 + 1 / path2);
  const Rtotal = s.R_GEN + Rparallel;
  const Itotal = s.V / Rtotal;
  const VgenExpected = s.V - Itotal * s.R_GEN;

  assertClose(s.nodeVoltages.get("GEN"), VgenExpected, 1e-9, "terminal voltage should match parallel-combination formula");

  const I1 = (s.nodeVoltages.get("GEN") - s.nodeVoltages.get("R1")) / s.R_WIRE;
  const I2 = (s.nodeVoltages.get("GEN") - s.nodeVoltages.get("R2")) / s.R_WIRE;
  assertClose(I1 + I2, Itotal, 1e-9, "branch currents should sum to total current (KCL)");
});

// --- Voltage divider (resistor + house) ---
console.log("Voltage divider (resistor + house)");
test("house voltage matches a two-resistor divider formula", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 6 });
  addPart(s, "H0", "HOUSE");
  wire(s, "GEN", "R1");
  wire(s, "R1b", "H0");
  wire(s, "H0b", "GND");

  computePower(s);

  const Rtotal = s.R_GEN + 3 * s.R_WIRE + 6 + s.R_HOUSE;
  const Itotal = s.V / Rtotal;
  const Vhouse = Itotal * s.R_HOUSE;

  const p = s.powered.get("H0");
  assertClose(p.V - s.nodeVoltages.get("H0b"), Vhouse, 1e-9, "voltage across the house should match the divider formula");
  assertClose(p.I, Itotal, 1e-9, "house current should match loop current");
});

// --- Open circuit (no return path) ---
console.log("Open circuit (no return path)");
test("a house with no return wire shows near full source voltage but zero current", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "H0", "HOUSE");
  wire(s, "GEN", "H0"); // H0b is never wired to anything

  computePower(s);

  const p = s.powered.get("H0");
  assertClose(p.V, s.V, 1e-6, "dangling node should sit at the source's full voltage — no current, no drop");
  assert(Math.abs(p.I) < 1e-9, "an open circuit must carry (approximately) zero current, regardless of voltage present");
  assert(p.level === "OFF", "open circuit reads as OFF even though voltage is present");
});

// --- Near-short ---
console.log("Near-short (direct GEN-GND wire, no components)");
test("wiring straight across draws far more current than any loaded path", () => {
  const shortState = makeState();
  addGenGnd(shortState);
  wire(shortState, "GEN", "GND");
  computePower(shortState);
  const Vgen = shortState.nodeVoltages.get("GEN");
  const Ishort = (shortState.V - Vgen) / shortState.R_GEN;

  const loadedState = makeState();
  addGenGnd(loadedState);
  addPart(loadedState, "H0", "HOUSE");
  wire(loadedState, "GEN", "H0");
  wire(loadedState, "H0b", "GND");
  computePower(loadedState);
  const p = loadedState.powered.get("H0");

  assert(Ishort > p.I * 5, "a bare wire across the source should draw dramatically more current than any normal load (this sandbox's stand-in for a short — R_WIRE keeps it from being a literal 0Ω short)");
});

// --- Generator sag under load ---
console.log("Generator sag under load");
test("terminal voltage strictly decreases as more parallel houses are added", () => {
  function terminalVoltageWithNHouses(n) {
    const s = makeState();
    addGenGnd(s);
    for (let i = 0; i < n; i++) {
      const id = `H${i}`;
      addPart(s, id, "HOUSE");
      wire(s, "GEN", id);
      wire(s, id + "b", "GND");
    }
    computePower(s);
    return s.nodeVoltages.get("GEN");
  }

  const v1 = terminalVoltageWithNHouses(1);
  const v4 = terminalVoltageWithNHouses(4);
  const v10 = terminalVoltageWithNHouses(10);

  assert(v1 < 12.0, "even one house should sag the generator below its ideal EMF");
  assert(v4 < v1, "more load should sag voltage further");
  assert(v10 < v4, "and further still");
  assert(v10 < 7.0, "ten houses should be enough to brown the grid out toward OFF");
});

// --- Transformer ---
console.log("Transformer: honest primary reference + power conservation");
test("secondary voltage tracks the transformer's OWN primary, not a hardcoded constant", () => {
  const s = makeState();
  addGenGnd(s);
  // The resistor means the primary sees less than 12V, so the secondary must
  // follow the primary's real voltage, not the GEN voltage.
  addPart(s, "R1", "RES", { ohms: 20 });
  addXfmr(s, "XP", "XS", 0.5);
  addPart(s, "H0", "HOUSE");
  wire(s, "GEN", "R1");
  wire(s, "R1b", "XP");
  wire(s, "XS", "H0");
  wire(s, "H0b", "GND");

  computePower(s);

  const Vpri = s.nodeVoltages.get("XP");
  const Vsec = s.nodeVoltages.get("XS");

  assert(Vpri < 11, "the series resistor should have pulled the primary well below the source's 12V");
  assertClose(Vsec, 0.5 * Vpri, 1e-9, "secondary must equal ratio × the transformer's OWN primary voltage");
});

test("power in equals power out (no energy manufactured by stepping up)", () => {
  const s = makeState();
  addGenGnd(s);
  addXfmr(s, "XP", "XS", 2.0); // step UP
  addPart(s, "H0", "HOUSE");
  wire(s, "GEN", "XP");
  wire(s, "XS", "H0");
  wire(s, "H0b", "GND");

  computePower(s);

  const Vpri = s.nodeVoltages.get("XP");
  const Vsec = s.nodeVoltages.get("XS");
  const Ipri = (s.nodeVoltages.get("GEN") - Vpri) / s.R_WIRE;
  const Isec = (Vsec - s.nodeVoltages.get("H0")) / s.R_WIRE;

  assertClose(Vsec, 2.0 * Vpri, 1e-9, "step-up ratio should double the primary's own voltage");
  assertClose(Ipri, 2.0 * Isec, 1e-6, "stepping voltage UP must step current DOWN on the secondary (conservation)");
  assertClose(Vpri * Ipri, Vsec * Isec, 1e-6, "primary power must equal secondary power — no energy manufactured");
});

// --- Capacitor charging curve ---
console.log("Capacitor charging curve");
test("capacitor charges monotonically toward the final DC voltage, ~63% at one time constant", () => {
  const s = makeState({ CAP_TIME_SCALE: 9000 });
  addGenGnd(s);
  const C_real = 220e-6;
  addPart(s, "C0", "CAP", { C: C_real * s.CAP_TIME_SCALE, Vprev: 0 });
  wire(s, "GEN", "C0");
  wire(s, "C0b", "GND");

  const tau = (s.R_GEN + 2 * s.R_WIRE) * (C_real * s.CAP_TIME_SCALE);
  const dt = 1 / 30;
  let prevV = -Infinity;

  const stepsToTau = Math.round(tau / dt);
  for (let i = 0; i < stepsToTau; i++) {
    computePower(s, dt);
    const v = s.nodeVoltages.get("C0") - s.nodeVoltages.get("C0b");
    assert(v >= prevV - 1e-9, `capacitor voltage must not decrease while charging (step ${i})`);
    prevV = v;
  }
  const vAtTau = s.nodeVoltages.get("C0") - s.nodeVoltages.get("C0b");
  const finalV = s.V; // at true steady state, zero current flows anywhere, so terminal = full EMF
  const fractionAtTau = vAtTau / finalV;
  assertClose(fractionAtTau, 1 - Math.exp(-1), 0.03, "should be close to the classic 63.2% RC charge point after one time constant");

  for (let i = 0; i < stepsToTau * 8; i++) computePower(s, dt);
  const vFinal = s.nodeVoltages.get("C0") - s.nodeVoltages.get("C0b");
  assertClose(vFinal, finalV, finalV * 0.01, "should converge to the final DC voltage");
});

// --- LED model and burnout ---
console.log("LED forward-voltage model and overcurrent burnout");
test("an LED wired directly to the supply (no resistor) burns out", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "L0", "LED");
  wire(s, "GEN", "L0");
  wire(s, "L0b", "GND");

  computePower(s);

  const p = s.powered.get("L0");
  assert(p.level === "BURNED", "an unprotected LED on a 12V supply should exceed I_LED_MAX and burn");
  assert(s.nodes.get("L0").data.burned === true, "the node itself should be marked burned");
});

test("a 470ohm ('Medium' preset) series resistor protects the LED and lights it well", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 470 });
  addPart(s, "L0", "LED");
  wire(s, "GEN", "R1");
  wire(s, "R1b", "L0");
  wire(s, "L0b", "GND");

  computePower(s);

  const p = s.powered.get("L0");
  assert(p.level !== "BURNED", "470ohm should keep current under I_LED_MAX");
  assert(p.I < s.I_LED_MAX, "current should be under the burn threshold");
  assert(p.level === "ON", "470ohm should give a solidly bright, healthy current");
});

test("a 100ohm ('Small' preset) series resistor is NOT enough to save the LED on 12V", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 100 });
  addPart(s, "L0", "LED");
  wire(s, "GEN", "R1");
  wire(s, "R1b", "L0");
  wire(s, "L0b", "GND");

  computePower(s);

  const p = s.powered.get("L0");
  assert(p.level === "BURNED", "100ohm on 12V should still exceed I_LED_MAX (documented in state.js as an intentional 'not enough' preset)");
});

// --- Resistor values ---
console.log("Resistor value fix (B5): label matches simulated value exactly once, not doubled");
test("a resistor's series contribution equals its labeled ohms, not double", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 10 });
  wire(s, "GEN", "R1");
  wire(s, "R1b", "GND");

  computePower(s);

  const Rtotal = s.R_GEN + 2 * s.R_WIRE + 10;
  const Iexpected = s.V / Rtotal;
  const Vgen = s.nodeVoltages.get("GEN");
  const Iactual = (s.V - Vgen) / s.R_GEN;
  assertClose(Iactual, Iexpected, 1e-9, "a single inline resistor must contribute exactly its labeled value once, not twice");
});

// --- Transistor as a real switch ---
console.log("Transistor as a real switch");
test("an OFF transistor is a true open circuit (not just extra resistance)", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "T0", "TRANS", { on: false });
  addPart(s, "H0", "HOUSE");
  wire(s, "GEN", "T0");
  wire(s, "T0b", "H0");
  wire(s, "H0b", "GND");

  computePower(s);
  const p = s.powered.get("H0");
  assert(p.I === 0, "an open switch must pass zero current downstream");
});

test("an ON transistor closes the loop and current flows", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "T0", "TRANS", { on: true });
  addPart(s, "H0", "HOUSE");
  wire(s, "GEN", "T0");
  wire(s, "T0b", "H0");
  wire(s, "H0b", "GND");

  computePower(s);
  const p = s.powered.get("H0");
  assert(p.I > 0, "a closed switch should pass current downstream");
});

// --- Solver errors ---
console.log("Solver error surfacing (B12)");
test("an absurd, ill-conditioned value is reported distinctly, not as silent zeros", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 1e18 });
  wire(s, "GEN", "R1");
  wire(s, "R1b", "GND");
  computePower(s);
  const vgen = s.nodeVoltages.get("GEN");
  assert(s.solverError === true || Number.isFinite(vgen), "must either flag an error or produce a finite, honest answer — never silently NaN");
});

// --- LED as a one-way valve ---
console.log("LED is a one-way valve (diode), not a reversible battery");
function supplyCurrent(s) { return (s.V - s.nodeVoltages.get("GEN")) / s.R_GEN; }

test("an LED wired BACKWARDS (with a resistor) passes no current at all", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 470 });
  addPart(s, "L0", "LED");
  wire(s, "GEN", "R1");
  wire(s, "R1b", "L0b"); // into the LED's return lead...
  wire(s, "L0", "GND");  // ...and out of its hot lead: reversed
  computePower(s);
  assert(Math.abs(supplyCurrent(s)) < 1e-6, `reverse-biased LED must block; generator supplied ${supplyCurrent(s)}A`);
  assert(s.powered.get("L0").level === "OFF", "reversed LED reads OFF");
  assert(!s.nodes.get("L0").data.burned, "reversed LED must not burn");
});

test("a backwards LED straight across the supply doesn't drag down a house next to it", () => {
  const alone = makeState();
  addGenGnd(alone);
  addPart(alone, "H0", "HOUSE");
  wire(alone, "GEN", "H0"); wire(alone, "H0b", "GND");
  computePower(alone);

  const s = makeState();
  addGenGnd(s);
  addPart(s, "H0", "HOUSE");
  addPart(s, "L0", "LED");
  wire(s, "GEN", "H0"); wire(s, "H0b", "GND");
  wire(s, "GEN", "L0b"); wire(s, "L0", "GND"); // reversed LED, no resistor
  computePower(s);
  assertClose(s.powered.get("H0").V, alone.powered.get("H0").V, 1e-6, "house voltage must be unaffected by a blocking LED");
  assertClose(supplyCurrent(s), supplyCurrent(alone), 1e-6, "generator draw must be unaffected by a blocking LED");
});

test("an LED below its forward voltage stays dark and never pushes current back into the source", () => {
  const s = makeState();
  addGenGnd(s);
  addXfmr(s, "XP", "XS", 0.1); // 12V -> ~1.2V, below V_LED_F
  addPart(s, "L0", "LED");
  wire(s, "GEN", "XP");
  wire(s, "XS", "L0");
  wire(s, "L0b", "GND");
  computePower(s);
  assert(supplyCurrent(s) >= -1e-9, `generator must never be back-fed by an LED (got ${supplyCurrent(s)}A)`);
  assert(s.powered.get("L0").I === 0 && s.powered.get("L0").level === "OFF", "under-biased LED is dark");
});

test("two LEDs in series each claim their own forward drop", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "R1", "RES", { ohms: 470 });
  addPart(s, "L0", "LED");
  addPart(s, "L1", "LED");
  wire(s, "GEN", "R1"); wire(s, "R1b", "L0"); wire(s, "L0b", "L1"); wire(s, "L1b", "GND");
  computePower(s);
  const expected = (s.V - 2 * s.V_LED_F) / (s.R_GEN + 4 * s.R_WIRE + 470 + 2 * s.R_LED_INTERNAL);
  assertClose(s.powered.get("L0").I, expected, 1e-9, "series LED current matches (V - 2·Vf)/R_total");
  assertClose(s.powered.get("L1").I, expected, 1e-9, "same current through both");
});

console.log("Burnout updates the whole circuit immediately");
test("after an LED pops, wires and the generator stop showing current through it", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "L0", "LED");
  wire(s, "GEN", "L0");
  wire(s, "L0b", "GND");
  computePower(s);
  assert(s.powered.get("L0").level === "BURNED", "should burn");
  assert(Math.abs(supplyCurrent(s)) < 1e-9, `generator must supply nothing to a dead LED (got ${supplyCurrent(s)}A)`);
  for (const [k, m] of s.wireMetrics) assert(Math.abs(m.Iab) < 1e-9, `wire ${k} still shows ${m.Iab}A after the LED popped`);
});

test("a popped LED in parallel with a house restores the house to its normal brightness", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "H0", "HOUSE");
  addPart(s, "L0", "LED");
  wire(s, "GEN", "H0"); wire(s, "H0b", "GND");
  wire(s, "GEN", "L0"); wire(s, "L0b", "GND");
  computePower(s);
  const Rloop = s.R_GEN + 2 * s.R_WIRE + s.R_HOUSE;
  assertClose(s.powered.get("H0").I, s.V / Rloop, 1e-9, "house current equals the single-house value once the LED is gone");
});

console.log("Capacitor holds its charge when no time passes");
test("solving with dt≈0 (an event-driven refresh) does not advance the charge", () => {
  const s = makeState({ CAP_TIME_SCALE: 9000 });
  addGenGnd(s);
  addPart(s, "C0", "CAP", { C: 220e-6 * 9000, Vprev: 3.0 });
  wire(s, "GEN", "C0"); wire(s, "C0b", "GND");
  for (let i = 0; i < 10; i++) computePower(s, 0);
  const v = s.nodeVoltages.get("C0") - s.nodeVoltages.get("C0b");
  assertClose(v, 3.0, 0.01, "ten zero-time refreshes must leave the cap where it was");
});

console.log("A charged capacitor is a power source of its own");
test("a fully unplugged charged capacitor keeps its charge", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "C0", "CAP", { C: 220e-6 * 9000, Vprev: 10 });
  for (let i = 0; i < 30; i++) computePower(s, 1 / 30);
  assertClose(s.nodes.get("C0").data.Vprev, 10, 1e-9, "an isolated cap has nowhere to discharge");
});

test("unplug the generator: a charged cap lights a house through GND, then drains on the RC curve", () => {
  const s = makeState();
  addGenGnd(s); // GEN is NOT wired to anything
  const C = 220e-6 * 9000;
  addPart(s, "C0", "CAP", { C, Vprev: 12 });
  addPart(s, "H0", "HOUSE");
  wire(s, "C0", "H0"); wire(s, "H0b", "GND"); wire(s, "C0b", "GND");
  computePower(s, 1 / 30);
  assert(s.powered.get("H0").level === "ON", "house should light from the stored charge");
  assert(s.wireMetrics.get("C0|H0").Iab > 0.5, "current flows from the cap into the house");
  const tau = (s.R_HOUSE + 3 * s.R_WIRE) * C;
  const steps = Math.round(tau * 30) - 1;
  for (let i = 0; i < steps; i++) computePower(s, 1 / 30);
  assertClose(s.nodes.get("C0").data.Vprev / 12, Math.exp(-1), 0.03, "after one time constant ~37% remains");
});

test("a charged cap and a house wired in a loop with NO ground still light the house", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "C0", "CAP", { C: 220e-6 * 9000, Vprev: 12 });
  addPart(s, "H0", "HOUSE");
  wire(s, "C0", "H0"); wire(s, "H0b", "C0b");
  computePower(s, 1 / 30);
  assert(!s.solverError, "floating island must be solvable");
  assert(s.powered.get("H0").level === "ON", "house lit by the cap alone");
  assert(s.nodes.get("C0").data.Vprev < 12, "and the cap starts draining");
});

test("an uncharged, unplugged cap stays at zero and doesn't disturb anything", () => {
  const s = makeState();
  addGenGnd(s);
  addPart(s, "C0", "CAP", { C: 1, Vprev: 0 });
  addPart(s, "H0", "HOUSE");
  wire(s, "C0", "H0"); wire(s, "H0b", "C0b");
  computePower(s, 1 / 30);
  assert(!s.solverError && s.powered.get("H0").level === "OFF" && s.nodes.get("C0").data.Vprev === 0, "inert");
});

console.log("A house works either way round");
test("a house wired backwards lights exactly like one wired forwards", () => {
  const fwd = makeState(); addGenGnd(fwd); addPart(fwd, "H0", "HOUSE");
  wire(fwd, "GEN", "H0"); wire(fwd, "H0b", "GND"); computePower(fwd);
  const rev = makeState(); addGenGnd(rev); addPart(rev, "H0", "HOUSE");
  wire(rev, "GEN", "H0b"); wire(rev, "H0", "GND"); computePower(rev);
  assert(rev.powered.get("H0").level === "ON", "backwards house should be ON, got " + rev.powered.get("H0").level);
  assertClose(rev.powered.get("H0").I, fwd.powered.get("H0").I, 1e-12, "same current");
});

console.log("Solar panels, batteries and different buildings");
function solarState(extra = {}) { return makeState({ V_SOLAR: 12, R_SOLAR: 4, solarFactor: 1, BAT_C: 20, ...extra }); }
test("a solar panel alone lights a house in daylight, exactly as a 12V/4ohm source would", () => {
  const s = solarState(); addGenGnd(s);
  addPart(s, "S0", "SOLAR"); addPart(s, "H0", "HOUSE");
  wire(s, "S0", "H0"); wire(s, "H0b", "S0b");
  computePower(s);
  const expected = 12 * 18 / (18 + 4 + 2 * s.R_WIRE);
  assertClose(s.nodeVoltages.get("H0") - s.nodeVoltages.get("H0b"), expected, 1e-9, "voltage across the house");
  assert(s.powered.get("H0").level === "ON", "lit");
  assert(!s.solverError, "no ground anywhere, still solvable");
});
test("at night (no light) the same solar panel gives nothing", () => {
  const s = solarState({ solarFactor: 0 }); addGenGnd(s);
  addPart(s, "S0", "SOLAR"); addPart(s, "H0", "HOUSE");
  wire(s, "S0", "H0"); wire(s, "H0b", "S0b");
  computePower(s);
  assert(s.powered.get("H0").I === 0 && s.powered.get("H0").level === "OFF", "dark at night");
});
test("sunny is brighter than cloudy", () => {
  const v = (f) => { const s = solarState({ solarFactor: f }); addGenGnd(s); addPart(s, "S0", "SOLAR"); addPart(s, "H0", "HOUSE"); wire(s, "S0", "H0"); wire(s, "H0b", "GND"); wire(s, "S0b", "GND"); computePower(s); return s.powered.get("H0").I; };
  assert(v(1.6) > v(1) && v(1) > v(0.5), "more light, more current");
});
test("solar + generator together: every watt is accounted for", () => {
  const s = solarState(); addGenGnd(s);
  addPart(s, "S0", "SOLAR"); addPart(s, "H0", "HOUSE"); addPart(s, "H1", "HOUSE");
  wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); wire(s, "S0", "H1"); wire(s, "H1b", "GND"); wire(s, "S0b", "GND"); wire(s, "H0", "H1");
  computePower(s);
  const V = (id) => s.nodeVoltages.get(id) ?? 0;
  const Igen = (s.V - V("GEN")) / s.R_GEN;
  let absorbed = Igen * Igen * s.R_GEN;
  for (const w of s.wires) absorbed += (V(w.a) - V(w.b)) ** 2 / s.R_WIRE;
  for (const id of ["H0", "H1"]) absorbed += (V(id) - V(id + "b")) ** 2 / s.R_HOUSE;
  const dvS = V("S0") - V("S0b"); const G = 1 / 4;
  absorbed += dvS * G * (dvS - 12); // the panel absorbs negative power: it supplies it
  assertClose(absorbed, s.V * Igen, 1e-9, "generator's power = everything absorbed (panel counted as negative)");
  assert(G * (dvS - 12) < 0, "the panel is supplying power");
});
test("a battery charges from GEN on the RC curve, then runs a house after GEN is unplugged", () => {
  const s = solarState(); addGenGnd(s);
  addPart(s, "B0", "BAT", { Vprev: 0 }); wire(s, "GEN", "B0"); wire(s, "B0b", "GND");
  const tau = (s.R_GEN + 2 * s.R_WIRE) * 20;
  for (let i = 0; i < Math.round(tau * 30); i++) computePower(s, 1 / 30);
  assertClose(s.nodes.get("B0").data.Vprev / 12, 1 - Math.exp(-1), 0.03, "63% after one time constant");
  for (let i = 0; i < Math.round(tau * 30) * 6; i++) computePower(s, 1 / 30);
  assert(s.nodes.get("B0").data.Vprev > 11.9, "full");
  addPart(s, "H0", "HOUSE"); wire(s, "B0", "H0"); wire(s, "H0b", "GND");
  s.wires = s.wires.filter(w => !(w.a === "GEN" && w.b === "B0"));
  computePower(s, 1 / 30);
  assert(s.powered.get("H0").level === "ON", "battery alone lights the house");
  for (let i = 0; i < 30 * 60; i++) computePower(s, 1 / 30);
  assert(s.powered.get("H0").level === "ON", "still bright a minute later");
});
test("a bakery (9 ohms) draws twice a cottage's current; a school (needs 10V) is only dim at 9.5V", () => {
  const s = solarState(); addGenGnd(s);
  addPart(s, "H0", "HOUSE"); addPart(s, "B0", "HOUSE", { R: 9 });
  wire(s, "GEN", "H0"); wire(s, "H0b", "GND"); wire(s, "GEN", "B0"); wire(s, "B0b", "GND");
  computePower(s);
  assertClose(s.powered.get("B0").I / s.powered.get("H0").I, 2, 0.01, "twice the current");
  const sc = solarState(); addGenGnd(sc);
  addPart(sc, "R0", "RES", { ohms: 1.5 }); addPart(sc, "S0", "HOUSE", { R: 12, vOn: 10, vDim: 7 });
  wire(sc, "GEN", "R0"); wire(sc, "R0b", "S0"); wire(sc, "S0b", "GND");
  computePower(sc);
  const vs = sc.nodeVoltages.get("S0") - sc.nodeVoltages.get("S0b");
  assertClose(vs, 12 * 12 / (1.5 + 1.5 + 3 * sc.R_WIRE + 12), 1e-9, "voltage across the school");
  assert(vs > 9 && vs < 10, "about 9.5V: " + vs);
  assert(sc.powered.get("S0").level === "DIM", "the school is only dim at 9.5V");
  assert(levelByVoltage(sc, vs) === "ON", "a cottage would be bright at the same 9.5V");
});
test("at night (loadScale 0.6) buildings draw more and the generator sags more", () => {
  const run = (scale) => { const s = solarState({ loadScale: scale }); addGenGnd(s); for (let i = 0; i < 4; i++) { addPart(s, "H" + i, "HOUSE"); wire(s, "GEN", "H" + i); wire(s, "H" + i + "b", "GND"); } computePower(s); return s; };
  const day = run(1), night = run(0.6);
  assert(night.powered.get("H0").I > day.powered.get("H0").I, "more current at night");
  assert(night.nodeVoltages.get("GEN") < day.nodeVoltages.get("GEN"), "more sag at night");
  assert(day.powered.get("H0").level !== "OFF" && night.powered.get("H0").level !== "ON", "four houses: fine by day, not bright at night");
});

// --- Summary ---
console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) {
  process.exitCode = 1;
}
if (typeof window !== "undefined") (window.__TEST_SUITES__ = window.__TEST_SUITES__ || []).push({ suite: "solver", ...{ pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) } });
})();
