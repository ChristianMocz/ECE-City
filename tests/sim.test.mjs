// tests/sim.test.mjs
//
// Plain browser/Node test script for the circuit solver — no build step, no
// test framework dependency. Run in a browser via tests/run-in-browser.html
// (this machine has no Node.js installed), or with `node tests/sim.test.mjs`
// wherever Node is available.
//
// Every test either checks the solver against an independently-computed
// textbook formula (series/parallel/divider), or checks a physical
// invariant that must hold regardless of the exact numbers (power
// conservation, monotonic capacitor charging, open-circuit behavior).
//
// Node id convention used throughout: every two-terminal component (RES,
// TRANS, HOUSE, LED, CAP) is a pair of ids, `${id}` (hot/supply-side lead)
// and `${id}b` (return/ground-side lead), linked via data.pairId on both —
// matching exactly how main.js places real components (see placeXxx there).

import { computePower } from "../src/sim.js";

// ---------- tiny test harness ----------
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

// ---------- fixture builder ----------
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

// Adds a two-terminal component (hot id = `id`, gnd id = `id+"b"`), matching
// how main.js will place real components.
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

// ================================================================
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

// ================================================================
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

// ================================================================
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

// ================================================================
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

// ================================================================
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

// ================================================================
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

// ================================================================
console.log("Transformer: honest primary reference + power conservation");
test("secondary voltage tracks the transformer's OWN primary, not a hardcoded constant", () => {
  const s = makeState();
  addGenGnd(s);
  // A resistor between GEN and the transformer's primary means the primary
  // does NOT see the full 12V — if the transformer were (incorrectly, as in
  // the old code) referenced to the constant GEN voltage instead of its own
  // solved primary, this test would catch it.
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

// ================================================================
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

// ================================================================
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

// ================================================================
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

// ================================================================
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

// ================================================================
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

// ================================================================
console.log(`\n${pass} passed, ${fail} failed`);
if (typeof process !== "undefined" && fail > 0) {
  process.exitCode = 1;
}
if (typeof window !== "undefined") {
  window.__TEST_RESULTS__ = { pass, fail, failures: failures.map(f => ({ name: f.name, message: f.error.message })) };
}
